// Smart Todo & Task REST API — Part 1A
// Single source of truth: openapi.yaml. Node native http, zero deps.
'use strict';

const http = require('http');

// In-memory store: sequential task-<n> ids. Reset each server instance.
function createTaskStore() {
  const tasks = [];
  let next = 1;
  const VALID_PRIORITIES = ['low', 'medium', 'high'];
  const VALID_STATUS = ['all', 'pending', 'completed'];

  function makeTask(input) {
    const title = String(input.title).trim();
    const task = {
      id: `task-${next++}`,
      title,
      description: input.description == null ? '' : String(input.description),
      priority: VALID_PRIORITIES.includes(input.priority) ? input.priority : 'medium',
      due_date: input.due_date == null ? null : String(input.due_date),
      completed: false,
    };
    tasks.push(task);
    return task;
  }

  function findTask(id) {
    return tasks.find((t) => t.id === id) || null;
  }

  function isOverdue(task, nowMs) {
    return !task.completed && task.due_date != null &&
      new Date(task.due_date).getTime() < nowMs;
  }

  return { tasks, VALID_PRIORITIES, VALID_STATUS, makeTask, findTask, isOverdue };
}

// Send a JSON body. 204 is a no-body success (no Content-Type needed).
function sendJson(response, statusCode, payload) {
  if (statusCode === 204) {
    response.writeHead(204);
    response.end();
    return;
  }
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

function parseJsonBody(body) {
  // Returns { ok:true, value } | { ok:false, message }
  if (!body) return { ok: false, message: 'Request body is required' };
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return { ok: false, message: 'Invalid JSON' };
  }
}

function validateTaskInput(input, { requireTitle, store }) {
  // Returns an error string, or null when valid.
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return 'Request body must be a JSON object';
  }
  if (requireTitle) {
    if (typeof input.title !== 'string' || input.title.trim() === '') {
      return 'title is required and must be a non-empty string';
    }
  }
  if (input.priority != null && !store.VALID_PRIORITIES.includes(input.priority)) {
    return 'priority must be one of: low, medium, high';
  }
  if (input.due_date != null && input.due_date !== '' &&
      Number.isNaN(Date.parse(input.due_date))) {
    return 'due_date must be a valid ISO-8601 date/datetime string';
  }
  if (input.completed != null && typeof input.completed !== 'boolean') {
    return 'completed must be a boolean';
  }
  return null;
}

function handleTasks(store, method, url, body, headers, response) {
  const parsedUrl = new URL(url, 'http://127.0.0.1');
  const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';

  // Collection routes: /tasks  and  /tasks/overdue
  if (pathname === '/tasks') {
    if (method === 'POST') {
      const parsed = parseJsonBody(body);
      if (!parsed.ok) return sendJson(response, 400, { error: parsed.message });
      const err = validateTaskInput(parsed.value, { requireTitle: true, store });
      if (err) return sendJson(response, 400, { error: err });
      return sendJson(response, 201, store.makeTask(parsed.value));
    }
    if (method === 'GET') {
      const status = parsedUrl.searchParams.get('status') || 'all';
      if (!store.VALID_STATUS.includes(status)) {
        return sendJson(response, 400, { error: 'status must be one of: all, pending, completed' });
      }
      const rows = status === 'all' ? store.tasks
        : store.tasks.filter((t) => status === 'completed' ? t.completed : !t.completed);
      return sendJson(response, 200, rows);
    }
    return sendJson(response, 404, { error: 'Not found' });
  }

  // Derived view: /tasks/overdue
  if (pathname === '/tasks/overdue' && method === 'GET') {
    const nowParam = parsedUrl.searchParams.get('now');
    const nowMs = nowParam ? new Date(nowParam).getTime() : Date.now();
    const rows = store.tasks.filter((t) => store.isOverdue(t, nowMs));
    return sendJson(response, 200, rows);
  }

  // Item routes: /tasks/{id}
  if (pathname.startsWith('/tasks/') && pathname.length > 7) {
    const id = decodeURIComponent(pathname.slice(7));
    const task = store.findTask(id);
    if (!task) return sendJson(response, 404, { error: 'Task not found' });

    if (method === 'GET') {
      return sendJson(response, 200, task);
    }
    if (method === 'PATCH') {
      const parsed = parseJsonBody(body);
      if (!parsed.ok) return sendJson(response, 400, { error: parsed.message });
      const err = validateTaskInput(parsed.value, { requireTitle: false, store });
      if (err) return sendJson(response, 400, { error: err });
      const v = parsed.value;
      if (v.title != null) {
        if (typeof v.title !== 'string' || v.title.trim() === '') {
          return sendJson(response, 400, { error: 'title must be a non-empty string' });
        }
        task.title = v.title.trim();
      }
      if (v.description != null) task.description = String(v.description);
      if (v.priority != null) task.priority = v.priority;
      if (v.due_date != null) task.due_date = v.due_date === '' ? null : String(v.due_date);
      if (v.completed != null) task.completed = v.completed;
      return sendJson(response, 200, task);
    }
    if (method === 'DELETE') {
      // Confirmation semantics (FR-7 / US3-AC3): 409 unless X-Confirm is "true".
      if (String(headers['x-confirm']) !== 'true') {
        return sendJson(response, 409, { error: 'Deletion requires confirmation (X-Confirm: true)' });
      }
      const idx = store.tasks.indexOf(task);
      store.tasks.splice(idx, 1);
      return sendJson(response, 204, null);
    }
    return sendJson(response, 404, { error: 'Not found' });
  }

  // Fallback: unrecognised path / method.
  return sendJson(response, 404, { error: 'Not found' });
}

function createServer() {
  const store = createTaskStore();
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      try {
        handleTasks(store, request.method, request.url, body, request.headers, response);
      } catch {
        sendJson(response, 400, { error: 'Bad request' });
      }
    });
  });
  return server;
}

module.exports = createServer;
module.exports.createServer = createServer;

if (require.main === module) {
  createServer().listen(3000, () => console.log('Tasks API listening on port 3000'));
}
