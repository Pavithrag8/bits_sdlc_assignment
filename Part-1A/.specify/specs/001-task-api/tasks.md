# Tasks: Smart Todo & Task REST API

**Input**: design documents from `/specify/specs/001-task-api/`
**Prerequisites**: plan.md, spec.md, clarifications.md
**Tests**: REQUIRED here — the spec's acceptance criteria are binary tests
(Constitution II).

## Format: `[ID] [P?] [Story] Description`
- **[P]**: parallelizable · **[Story]**: US1–US4 from spec.md
- Each task cites the AC/FR it implements.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: project skeleton + the single source of truth

- [x] T001 Author the OpenAPI contract `openapi.yaml` (all 7 endpoints,
  request/response schemas, status codes 201/200/204/400/404/409)
- [x] T002 [P] Write feedforward files in `.harness/`
  (`style-guide.md`, `harness-rules.md`, `generation-task.md`)
- [x] T003 [P] Author the deterministic `sensor.js` (static + dynamic)
- [x] T004 Author the bounded runner `.harness/run_all.js` (max 2 attempts,
  writes `attempt-log.json` separating generation vs validation failures)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: no user-story work before this phase is complete

- [x] T005 Build the `sendJson(response, statusCode, payload)` helper and the
  exported `http.createServer` in `src/app.js`; listen only when
  `require.main === module`
- [x] T006 In-memory task store + sequential `task-<n>` id generation
- [x] T007 Central request router (method + path match, JSON body parse,
  malformed-JSON → 400)
- [x] T008 Unrecognised path → 404 `{ error }`
- [x] T009 [P] `tests/app.test.js` scaffolding: `withServer` helper (ephemeral
  port + close in `finally`), `get`/`post`/`patch`/`del` fetch helpers

**Checkpoint**: server boots; empty-store GET returns 200 `[]`.

---

## Phase 3: User Story 1 - Create (Priority: P1) 🎯 MVP

**Independent Test**: `test_us1_ac1_create_valid_task_returns_201` and
`test_us1_ac2_missing_title_returns_400` pass.

### Tests (written first, expected to FAIL before implementation)
- [x] T010 [P] [US1] `test_us1_ac1_create_valid_task_returns_201`
  `[FR-1, US1-AC1]` — asserts `strictEqual(response.status, 201)` and an `id`
- [x] T011 [P] [US1] `test_us1_ac2_missing_title_returns_400`
  `[FR-2, US1-AC2]` — asserts `strictEqual(response.status, 400)`

### Implementation
- [x] T012 [US1] Implement `POST /tasks` validation + 201/400
  `[FR-1, FR-2]` in `src/app.js`

**Checkpoint**: create journey works and is tested with exact assertions.

---

## Phase 4: User Story 2 - List / Get / Filter (Priority: P1)

**Independent Test**: US2 AC tests pass.

### Tests
- [x] T013 [P] [US2] `test_us2_ac1_list_returns_200` `[FR-3]`
- [x] T014 [P] [US2] `test_us2_ac2_get_by_id` + `test_unknown_id_returns_404`
  `[FR-4]` — asserts 200 and `strictEqual(response.status, 404)`
- [x] T015 [P] [US2] `test_us2_ac3_filter_by_status` `[FR-3]`

### Implementation
- [x] T016 [US2] `GET /tasks` (+ `?status=` filter), `GET /tasks/{id}`,
  404 handler `[FR-3, FR-4]` in `src/app.js`

---

## Phase 5: User Story 3 - Update / Complete / Delete (Priority: P2)

**Independent Test**: US3 AC tests pass.

### Tests
- [x] T017 [P] [US3] `test_us3_ac1_patch_updates_task` `[FR-5]`
- [x] T018 [P] [US3] `test_us3_ac2_toggle_completed` `[FR-6]`
- [x] T019 [P] [US3] `test_us3_ac3_delete_requires_confirmation`
  `[FR-7]` — asserts `strictEqual(response.status, 409)` without the header and
  204 with it

### Implementation
- [x] T020 [US3] `PATCH /tasks/{id}` (incl. completed toggle) `[FR-5, FR-6]`
- [x] T021 [US3] `DELETE /tasks/{id}` with `X-Confirm` semantics
  (409 vs 204) `[FR-7]`

---

## Phase 6: User Story 4 - Overdue (Priority: P3)

**Independent Test**: `test_us4_overdue` passes.

### Tests
- [x] T022 [P] [US4] `test_us4_overdue` `[FR-8]` — open+due+before-now only;
  excludes completed and no-due_date tasks
- [x] T023 [P] [Edge] `test_invalid_priority_returns_400` `[FR-2]` — bad
  priority → 400

### Implementation
- [x] T024 [US4] `GET /tasks/overdue?now=` derived filter `[FR-8]`
- [x] T025 [Edge] priority validation on create/update `[FR-2]`

---

## Phase 7: Verification

- [x] T026 Run `node --check src/app.js`; run the harness
  (`node .harness/run_all.js`); confirm the sensor PASSES
- [x] T027 Snapshot initial vs final generation to `evidence/`; write
  `evidence/harness-log.md` + final human ACCEPT/REJECT

## Dependencies & Execution Order

- Setup (Phase 1) → Foundational (Phase 2) → US1 → US2 → US3 → US4 →
  Verification (Phase 7).
- Within a phase, all `[P]` tasks run in parallel; tests precede their
  implementation in each story.

## Parallelism

- T010/T011 (US1 tests), T013/T014/T015 (US2 tests),
  T017/T018/T019 (US3 tests), T022/T023 (US4 tests) are all parallelizable.

## Notes

- Every test uses `assert.strictEqual(response.status, N)` — no broad
  `>=` assertions (Constitution II).
- Repairs during the harness may only touch `src/app.js` / `tests/app.test.js`
  (Constitution III). The contract, tests' assertions, and sensor are
  immutable.
