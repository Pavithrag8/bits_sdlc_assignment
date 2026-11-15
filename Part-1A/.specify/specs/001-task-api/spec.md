# Feature Specification: Smart Todo & Task REST API

**Feature Branch**: `001-task-api`

**Created**: 2026-11-14

**Status**: Approved

**Input**: User description: "A deterministic REST Items/Task API: create a task
(title, description, priority, due date); list, get by id, update, mark
completed, delete (with confirmation); filter by status; identify overdue."

## 1. User Scenarios & Testing

### User Story 1 - Create a task (Priority: P1)
An individual user adds a task with a title, optional description, a priority,
and an optional due date; the API assigns an id and echoes the created task.

**Why this priority**: creating tasks is the foundation; without it no other
journey works.

**Independent Test**: POST a valid body, assert HTTP 201 and an `id` field;
POST a body missing `title`, assert HTTP 400.

**Acceptance Scenarios**:
1. **Given** a valid task body (title "Buy milk", priority "high", due_date
   "2026-12-01"), **When** POST `/tasks`, **Then** the API returns HTTP 201 and
   a task object with an `id`, `title`, `completed:false`, and the supplied
   fields.
2. **Given** a body with no `title` (or an empty / non-string `title`),
   **When** POST `/tasks`, **Then** the API returns HTTP 400 with an `error`
   string.

---

### User Story 2 - View, list, and filter tasks (Priority: P1)
A user can see all tasks, one specific task by id, and a subset filtered by
status.

**Why this priority**: retrieval is the daily-driver read path.

**Independent Test**: seed tasks, GET `/tasks` and `/tasks/{id}`; assert exact
status codes; GET with `?status=completed` returns only completed.

**Acceptance Scenarios**:
1. **Given** at least one task exists, **When** GET `/tasks`, **Then** HTTP 200
   and a JSON array of task objects.
2. **Given** a known task id, **When** GET `/tasks/{id}`, **Then** HTTP 200 and
   that task; **Given** an unknown id, **When** GET `/tasks/{id}`, **Then**
   HTTP 404.
3. **Given** a mix of pending and completed tasks, **When** GET
   `/tasks?status=completed`, **Then** only completed tasks are returned.

---

### User Story 3 - Edit, complete, and delete a task (Priority: P2)
A user edits task details, marks a task completed, and deletes a task only
after confirmation.

**Why this priority**: mutation of state after creation.

**Independent Test**: create a task; PATCH it; PATCH
`completed=true`; DELETE with confirmation header; assert exact codes and the
resulting state.

**Acceptance Scenarios**:
1. **Given** an existing task, **When** PATCH `/tasks/{id}` with valid fields,
   **Then** HTTP 200 and the updated task.
2. **Given** an existing task, **When** PATCH `/tasks/{id}` with
   `completed:true`, **Then** HTTP 200 and `completed:true`; **Given** the
   same task again, **When** PATCH with `completed:false`, **Then** it reverts
   to pending.
3. **Given** an existing task, **When** DELETE `/tasks/{id}` WITHOUT the
   confirmation header, **Then** HTTP 409; **When** DELETE WITH the
   confirmation header, **Then** HTTP 204 and the task is gone.
4. **Given** an unknown id on PATCH/DELETE, **When** the request is sent,
   **Then** HTTP 404.

---

### User Story 4 - Identify overdue tasks (Priority: P3)
A user can see which tasks are overdue relative to a reference date.

**Why this priority**: derived view on top of stored data.

**Independent Test**: seed tasks with due dates before/after a reference now,
GET `/tasks/overdue?now=...`; assert exactly the overdue ones are returned.

**Acceptance Scenarios**:
1. **Given** a task whose `due_date` is strictly before the reference now,
   **When** GET `/tasks/overdue?now=<now>`, **Then** it is included in the
   result.
2. **Given** a completed task whose `due_date` is before now, **When** the same
   request is made, **Then** it is EXCLUDED (overdue applies to open tasks
   only).
3. **Given** a task with no `due_date`, **When** the same request is made,
   **Then** it is EXCLUDED.

---

### Edge Cases

- Empty store: GET `/tasks` returns `[]` (HTTP 200) — a helpful empty state,
  not an error.
- A `due_date` that is not a valid ISO-8601 date string on create → HTTP 400.
- An invalid `priority` (anything other than low/medium/high) on create or
  update → HTTP 400.
- A malformed JSON body → HTTP 400 with an `error` string.
- GET/POST/PUT/DELETE on an unrecognised path → HTTP 404.

## 2. Functional Requirements

- **FR-1**: The API MUST create a task from `POST /tasks` with `title`
  (required, non-empty string), optional `description`, `priority`
  (low|medium|high, default medium), optional ISO-8601 `due_date`. Returns 201
  with the created task (assigned `id`, `completed:false`).
- **FR-2**: The API MUST reject a create or update missing/invalid `title` or
  with an invalid `priority`/`due_date` with 400 and an `error` string.
- **FR-3**: The API MUST return all tasks (200, JSON array) from
  `GET /tasks`, supporting `?status=all|pending|completed`.
- **FR-4**: The API MUST return one task (200) from `GET /tasks/{id}` and 404
  for an unknown id.
- **FR-5**: The API MUST update mutable fields from `PATCH /tasks/{id}` (200)
  and return 404 for an unknown id.
- **FR-6**: The API MUST toggle `completed` via `PATCH /tasks/{id}` (the
  pending ⇄ completed transition) and return the updated task.
- **FR-7**: The API MUST delete a task via `DELETE /tasks/{id}` ONLY when the
  request carries the confirmation header `X-Confirm: true` (204); without it
  it MUST return 409 with an `error` string.
- **FR-8**: The API MUST return, from `GET /tasks/overdue`, the open tasks
  (not completed) whose `due_date` is strictly before the provided
  `?now=` reference (default: current time).

## 3. Non-Functional Requirements

- **NFR-1**: Fully deterministic — identical inputs and identical reference
  now yield identical responses.
- **NFR-2**: Zero third-party runtime dependencies (Node built-ins only).
- **NFR-3**: Every response is JSON with `Content-Type: application/json`
  (except 204, which has no body).
- **NFR-4**: 100% of FR/ACs are covered by automated tests using exact
  `assert.strictEqual(response.status, N)` assertions.

## 4. Key Entities

- **Task**: `id` (string), `title` (string), `description` (string|""),
  `priority` (low|medium|high), `due_date` (ISO-8601 string|null),
  `completed` (boolean).

## 5. Assumptions

- In-memory store keyed by string id; ids are sequential (`task-1`, ...).
- "now" is a client-supplied query parameter so the API stays deterministic
  under test; the live default is the current UTC time.
- Confirmation for delete is a request header, not a second round-trip.

## 6. Out of Scope

- Authentication, multi-user collaboration, notifications, recurring tasks,
  and persistence across process restarts.
