# Task Manager API Constitution
<!-- Smart Todo & Task REST API (deterministic Part 1A) -->

## Core Principles

### I. Determinism
<!-- Measurable: identical input => identical output; no hidden state -->
For any fixed input and any fixed reference "now", the API MUST return the same
response. No hidden global mutable state may influence a response.
**Enforcement:** every request handler is a pure function of its request;
`node --test` results are reproducible run-to-run; the sensor's dynamic stage
(`node --test app.test.js`) MUST exit 0 on every run.

### II. Testability — exact assertions (NON-NEGOTIABLE)
<!-- Measurable: 100% of acceptance criteria map to a binary test -->
Every acceptance criterion in the spec MUST map to at least one automated test,
and each test MUST use exact assertions of the form
`assert.strictEqual(response.status, <N>);`. Broad assertions such as
`status >= 400` are FORBIDDEN.
**Enforcement:** the static sensor greps `app.test.js` for the exact assertion
patterns and FAILs with a `MISSING_*_ASSERTION` finding when any are absent;
the plan's spec-to-test traceability table must be 100% complete.

### III. Spec-first, no weakening
<!-- Measurable: contract openapi.yaml is the single source of truth -->
`openapi.yaml` is the single source of truth. The implementation MUST be derived
from it. A repair MUST fix observed sensor findings without (a) changing the
contract, (b) deleting tests, or (c) lowering any assertion.
**Enforcement:** `openapi.yaml` is checked in read-only by the harness; any
diff to it or to `tests/`/`.harness/` between two generation attempts is a
process violation. Failures are recorded in `evidence/`, never deleted.

### IV. Security & input validation at all boundaries
<!-- Measurable: 0 secrets; 100% of mutation endpoints validate input -->
No secrets, credentials, `.env` values, or machine-specific paths may be
committed. Every mutating endpoint MUST validate its input and reject it with
HTTP 400 `{ "error": "..." }` on violation.
**Enforcement:** `grep -rIInE "api[_-]?key|secret|token|\.env" .` returns
nothing; the sensor's static checks confirm validation responses are asserted.

### V. Bounded repair & auditability
<!-- Measurable: <= 2 generation attempts; every run is logged -->
The automated harness MUST stop after at most **2 generation attempts**.
Every attempt MUST be logged with generation failures and code-validation
failures separated, so a reviewer can audit exactly what was fed back.
**Enforcement:** `evidence/attempt-log.json` MUST carry `attempts[]`
(`generationSucceeded`, `findings`) and `finalStatus`, with no more than 2
attempts; the runner MUST halt the loop at attempt 2.

## Additional Constraints

- **Technology:** Node.js 24, CommonJS, native `node:http` only — zero
  third-party runtime dependencies. Tests use `node:test` +
  `node:assert/strict`.
- **Module shape:** `src/app.js` MUST export the `http.Server`; it must listen
  ONLY when run directly (`require.main === module`), so tests can bind an
  ephemeral port (`listen(0)`).
- **Response shape:** all responses are JSON with `Content-Type:
  application/json`; errors use `{ "error": "<message>" }`.
- **Scope (v1):** CRUD on tasks, status filter, completion, delete-with-
  confirmation, and overdue identification. Authentication, collaboration,
  notifications, and recurring tasks are OUT OF SCOPE.

## Governance

- The constitution supersedes all other guidance in this project.
- Amendments require a documented rationale and version bump.
- All PRs/reviews verify compliance with Sections I–V; any gate the constitution
  defines MUST run before merge.

**Version**: 1.0.0 | **Ratified**: 2026-11-14 | **Last Amended**: 2026-11-14
