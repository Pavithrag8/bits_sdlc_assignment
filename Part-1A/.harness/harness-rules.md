# Harness Rules — Tasks API (Part 1A)

Mirror of Lab Sheet 2 §4.5, extended for the full Tasks API.

1. Treat `openapi.yaml` as the **single source of truth**.
2. Generate exactly two artifacts: `src/app.js` and `tests/app.test.js`.
3. Implement all endpoints declared in `openapi.yaml`:
   - `POST /tasks`
   - `GET /tasks` (with `?status=all|pending|completed`)
   - `GET /tasks/{id}`
   - `PATCH /tasks/{id}`
   - `DELETE /tasks/{id}` (confirmation-gated)
   - `GET /tasks/overdue` (with `?now=`)
4. A valid create (non-empty string `title`) MUST return HTTP 201.
5. A create/update with a missing, empty, or non-string `title`, an invalid
   `priority`, or a malformed body MUST return HTTP 400.
6. Unknown task ids on GET/PATCH/DELETE MUST return HTTP 404.
7. A DELETE without a correct confirmation MUST return HTTP 409; with
   confirmation it MUST return HTTP 204 (no body).
8. Tests MUST include **exact** assertions written as:
   - `assert.strictEqual(response.status, 201);`
   - `assert.strictEqual(response.status, 200);`
   - `assert.strictEqual(response.status, 400);`
   - `assert.strictEqual(response.status, 404);`
   - `assert.strictEqual(response.status, 409);`
   - `assert.strictEqual(response.status, 204);`
9. Broad assertions such as `status >= 400` are **FORBIDDEN** (Constitution
   II). The static sensor greps for these exact literals and fails otherwise.
10. A repair MUST address reported sensor findings without (a) changing
    `openapi.yaml`, (b) deleting a test, or (c) weakening any exact
    assertion. Generated files are untrusted until both static and dynamic
    sensors pass.
11. The automated loop MUST stop after **two generation attempts** (Constitution
    V).
12. If a new status is added to `openapi.yaml`, a matching static-sensor gate
    AND a traceability row MUST be added in the same change.
