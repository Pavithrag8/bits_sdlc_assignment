// Smart Todo & Task REST API — Part 1A tests.
// node:test + node:assert/strict; ephemeral port; close server in finally.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const createServer = require('../src/app');

// Start a fresh exported server on an ephemeral port, run `run(port, server)`,
// then always close it. Each test gets its own store.
async function withServer(run) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await run(port, server);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(port, method, pathname, opts) {
  const headers = { 'Content-Type': 'application/json', ...((opts && opts.headers) || {}) };
  const init = { method, headers };
  if (opts && opts.body !== undefined) init.body = opts.body;
  return fetch(`http://127.0.0.1:${port}${pathname}`, init);
}

async function post(port, pathname, obj) {
  const body = obj === undefined ? undefined : JSON.stringify(obj);
  return request(port, 'POST', pathname, { body });
}

async function patch(port, pathname, obj, headers) {
  return request(port, 'PATCH', pathname, { headers, body: JSON.stringify(obj) });
}

// US1 — create
test('test_us1_ac1_create_valid_task_returns_201', async () => {
  await withServer(async (port) => {
    const response = await request(port, 'POST', '/tasks', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Buy milk', priority: 'high', due_date: '2026-12-01' }),
    });
    assert.strictEqual(response.status, 201);
    const task = await response.json();
    assert.strictEqual(task.completed, false);
    assert.ok(typeof task.id === 'string' && task.id.length > 0);
    assert.strictEqual(task.priority, 'high');
  });
});

test('test_us1_ac2_missing_title_returns_400', async () => {
  await withServer(async (port) => {
    const response = await post(port, '/tasks', { priority: 'low' });
    assert.strictEqual(response.status, 400);
    const err = await response.json();
    assert.ok(typeof err.error === 'string');
  });
});

// US2 — list / get / filter
test('test_us2_ac1_list_returns_200', async () => {
  await withServer(async (port) => {
    await post(port, '/tasks', { title: 'a' });
    const response = await request(port, 'GET', '/tasks');
    assert.strictEqual(response.status, 200);
    const rows = await response.json();
    assert.ok(Array.isArray(rows));
  });
});

test('test_us2_ac2_get_by_id', async () => {
  await withServer(async (port) => {
    const created = await post(port, '/tasks', { title: 'a' });
    const id = (await created.json()).id;
    const response = await request(port, 'GET', `/tasks/${id}`);
    assert.strictEqual(response.status, 200);
  });
});

test('test_unknown_id_returns_404', async () => {
  await withServer(async (port) => {
    const response = await request(port, 'GET', '/tasks/nope');
    assert.strictEqual(response.status, 404);
  });
});

test('test_us2_ac3_filter_by_status', async () => {
  await withServer(async (port) => {
    const a = await post(port, '/tasks', { title: 'a' });
    const idA = (await a.json()).id;
    await patch(port, `/tasks/${idA}`, { completed: true });
    const pending = await request(port, 'GET', '/tasks?status=pending');
    assert.strictEqual(pending.status, 200);
    const completed = await request(port, 'GET', '/tasks?status=completed');
    assert.strictEqual(completed.status, 200);
    const cRows = await completed.json();
    assert.strictEqual(cRows.length, 1);
    assert.strictEqual(cRows[0].id, idA);
  });
});

// US3 — update / complete / delete
test('test_us3_ac1_patch_updates_task', async () => {
  await withServer(async (port) => {
    const a = await post(port, '/tasks', { title: 'a' });
    const idA = (await a.json()).id;
    const response = await patch(port, `/tasks/${idA}`, { title: 'edited' });
    assert.strictEqual(response.status, 200);
    const task = await response.json();
    assert.strictEqual(task.title, 'edited');
  });
});

test('test_us3_ac2_toggle_completed', async () => {
  await withServer(async (port) => {
    const a = await post(port, '/tasks', { title: 'a' });
    const idA = (await a.json()).id;
    let r = await patch(port, `/tasks/${idA}`, { completed: true });
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await r.json()).completed, true);
    r = await patch(port, `/tasks/${idA}`, { completed: false });
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await r.json()).completed, false);
  });
});

test('test_us3_ac3_delete_requires_confirmation', async () => {
  await withServer(async (port) => {
    const a = await post(port, '/tasks', { title: 'a' });
    const idA = (await a.json()).id;
    // Without confirmation: 409.
    let response = await request(port, 'DELETE', `/tasks/${idA}`);
    assert.strictEqual(response.status, 409);
    // With confirmation: 204, then gone.
    response = await request(port, 'DELETE', `/tasks/${idA}`, { headers: { 'X-Confirm': 'true' } });
    assert.strictEqual(response.status, 204);
    const after = await request(port, 'GET', `/tasks/${idA}`);
    assert.strictEqual(after.status, 404);
  });
});

// US4 — overdue (deterministic via ?now=)
test('test_us4_overdue', async () => {
  await withServer(async (port) => {
    await post(port, '/tasks', { title: 'open-overdue', due_date: '2026-01-01' });
    await post(port, '/tasks', { title: 'open-future', due_date: '2099-01-01' });
    const done = await post(port, '/tasks', { title: 'done-overdue', due_date: '2026-01-01' });
    const idDone = (await done.json()).id;
    await patch(port, `/tasks/${idDone}`, { completed: true });
    await post(port, '/tasks', { title: 'no-date' });

    const response = await request(port, 'GET', '/tasks/overdue?now=2026-06-01T00:00:00Z');
    assert.strictEqual(response.status, 200);
    const rows = await response.json();
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].title, 'open-overdue');
  });
});

// Edge — validation
test('test_invalid_priority_returns_400', async () => {
  await withServer(async (port) => {
    const response = await post(port, '/tasks', { title: 'a', priority: 'urgent' });
    assert.strictEqual(response.status, 400);
  });
});

test('test_malformed_json_returns_400', async () => {
  await withServer(async (port) => {
    const response = await request(port, 'POST', '/tasks', { body: '{not json' });
    assert.strictEqual(response.status, 400);
  });
});
