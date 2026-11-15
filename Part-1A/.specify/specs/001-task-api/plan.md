# Implementation Plan: Smart Todo & Task REST API

**Branch**: `001-task-api` | **Date**: 2026-11-14 | **Spec**: `spec.md` (same dir)

**Input**: Feature specification from `/specify/specs/001-task-api/spec.md`

**Note**: Filled in by `/speckit.plan`; the contract `openapi.yaml` is the
single source of truth the plan and the sensor both key off.

## Summary

Expose a deterministic in-memory Tasks REST API on Node 24 using native
`node:http` (zero dependencies). `src/app.js` is a single exported
`http.Server` that listens only when run directly. `tests/app.test.js`
drives it on an ephemeral port and asserts **exact** status codes, one
assertion per spec acceptance criterion.

## Technical Context

**Language/Version**: Node.js 24 (CommonJS)
**Primary Dependencies**: none — Node built-ins only (`node:http`,
`node:assert/strict`, `node:test`)
**Storage**: in-memory JS array (no persistence in v1)
**Testing**: `node --test tests/app.test.js`
**Target Platform**: any Node 24 runtime (cross-platform, key-free)
**Project Type**: web-service (REST API)
**Performance Goals**: not applicable (demo scale)
**Constraints**: zero third-party deps; deterministic; exact assertions
**Scale/Scope**: 7 endpoints, 1 entity, in-process

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I Determinism** — PASS: pure request handlers; `now` is a query param.
- **II Testability (exact assertions, NON-NEGOTIABLE)** — PASS: every AC maps
  to a `assert.strictEqual(response.status, N)` test; broad `>=` assertions
  are forbidden and the sensor enforces this.
- **III Spec-first, no weakening** — PASS: `openapi.yaml` is read-only to the
  harness; repairs touch only `src/app.js` / `tests/app.test.js`.
- **IV Security & validation** — PASS: all mutation endpoints validate; no
  secrets; 400 `{error}` on bad input.
- **V Bounded repair & auditability** — PASS: runner halts at 2 attempts and
  logs generation vs validation failures separately.

## Project Structure

```text
Part-1A/
├── openapi.yaml          # single source of truth (contract)
├── src/app.js            # REST server (exported; listens only when direct)
├── tests/app.test.js     # node:test, exact assertions, ephemeral port
├── .harness/
│   ├── style-guide.md
│   ├── harness-rules.md
│   ├── generation-task.md
│   ├── sensor.js         # deterministic static+dynamic sensor
│   └── run_all.js        # bounded 2-attempt runner -> attempt-log.json
└── evidence/
    ├── initial-generation/   # app.js + app.test.js pre-repair snapshot
    ├── final-generation/     # app.js + app.test.js post-repair snapshot
    ├── sensor-report.json
    ├── attempt-log.json
    └── harness-log.md
```

**Structure Decision**: single-service layout; `src/` and `tests/` at the
Part-1A root, harness and evidence as sibling folders.

## Data & Storage

In-memory `Task` array; id generated as `task-<n>` (n = 1-based counter).
A task: `{ id, title, description, priority, due_date, completed }`.
`GET /tasks/overdue` is derived, not stored.

## API / Interface Contract

See `openapi.yaml` (authoritative). Endpoints & key statuses:

| Method & Path | 2xx | 4xx |
|---|---|---|
| `POST /tasks` | 201 | 400 (bad/missing title, bad priority/due_date, bad JSON) |
| `GET /tasks` | 200 | — |
| `GET /tasks/{id}` | 200 | 404 |
| `PATCH /tasks/{id}` | 200 | 400, 404 |
| `DELETE /tasks/{id}` | 204 | 404, 409 (no confirm header) |
| `GET /tasks/overdue` | 200 | — |

## Test Strategy

`tests/app.test.js` starts the exported server on port `0` (ephemeral), sends
requests with native `fetch`, asserts exact statuses and bodies, and closes the
server in a `finally` block. One named test per AC/FR below; each uses
`assert.strictEqual(response.status, N)`.

## Spec-to-Test Traceability

| AC / FR | Behaviour | Test function in `tests/app.test.js` | Sensor gate |
|---|---|---|---|
| US1-AC1 / FR-1 | valid create → 201 + id | `test_us1_ac1_create_valid_task_returns_201` | static `MISSING_201_ASSERTION` |
| US1-AC2 / FR-2 | missing title → 400 | `test_us1_ac2_missing_title_returns_400` | static `MISSING_400_ASSERTION` |
| US2-AC1 / FR-3 | list → 200 array | `test_us2_ac1_list_returns_200` | static contract `GET /tasks` |
| US2-AC2 / FR-4 | get known → 200; unknown → 404 | `test_us2_ac2_get_by_id`, `test_unknown_id_returns_404` | static `MISSING_404_ASSERTION` |
| US2-AC3 / FR-3 | filter `?status=completed` | `test_us2_ac3_filter_by_status` | static contract `status` param |
| US3-AC1 / FR-5 | update → 200 | `test_us3_ac1_patch_updates_task` | static contract PATCH |
| US3-AC2 / FR-6 | complete pending ⇄ | `test_us3_ac2_toggle_completed` | static contract PATCH |
| US3-AC3 / FR-7 | delete needs confirm → 409 / 204 | `test_us3_ac3_delete_requires_confirmation` | static `MISSING_409_ASSERTION` |
| US3-AC4 / FR-4/5/7 | unknown id on PATCH/DELETE → 404 | `test_unknown_id_returns_404` | static `MISSING_404_ASSERTION` |
| US4-AC1..3 / FR-8 | overdue only open, with due_date | `test_us4_overdue` | static contract overdue |
| Edge / NFR-3 | invalid priority → 400 | `test_invalid_priority_returns_400` | static `MISSING_400_ASSERTION` |

*100% of AC/FRs are mapped. No orphan requirement.*

## Risks & Mitigations

- **EADDRINUSE / port leaks** → use ephemeral port `0` + `server.close()` in
  `finally` (Lab 2 troubleshooting).
- **Time-dependent nondeterminism** → overdue driven by `?now=` query param
  (C-6).
- **Broad assertions slipping in** → static sensor greps for exact assertion
  literals and fails the build otherwise (Constitution II).
