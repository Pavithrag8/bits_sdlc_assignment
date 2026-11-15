# Part 1A — Deterministic Harness Log (Tasks REST API)

This narrative is the human-authored record of the feedforward → generate →
sense → repair → audit loop for Part 1A. The machine-generated evidence
(`evidence/sensor-report.json`, `evidence/attempt-log.json`, and the
`initial-generation/` / `final-generation/` snapshots) is cited inline.

## 1. What the coding agent was asked to generate

**Contract (single source of truth):** `openapi.yaml` — a 7-endpoint Tasks API:
`POST /tasks` (201/400), `GET /tasks` (+`?status=` filter, 200),
`GET /tasks/{id}` (200/404), `PATCH /tasks/{id}` (200/400/404),
`DELETE /tasks/{id}` (204 with confirm / 409 without / 404),
`GET /tasks/overdue` (+`?now=`, 200).

**Feedforward files** attached to the generation task (Lab Sheet 2 §4.4–4.6):
- `.harness/style-guide.md` — CommonJS, zero deps, export-the-server / listen-only-when-direct,
  exact `assert.strictEqual(response.status, N)` assertions, close server in `finally`.
- `.harness/harness-rules.md` — treat `openapi.yaml` as truth; generate exactly
  `src/app.js` + `tests/app.test.js`; FORBID broad `>= 400` assertions; bounded 2
  attempts; repairs may not change the contract or weaken assertions.
- `.harness/generation-task.md` — required output shape + native-`http` constraint.

**Output generated:** `src/app.js` (an exported `node:http` server) and
`tests/app.test.js` (`node:test`, ephemeral port, exact status assertions).

## 2. The deterministic sensor (no LLM)

`sensor.js` runs two gates, fully deterministic:

1. **Static gate** — required files present; exact-assertion literals present in
   the test (`strictEqual(response.status, N)` for 200/201/204/400/404/409);
   broad-assertion `status >= 400` is forbidden; contract-completeness patterns in
   `app.js` (all routes visible, `X-Confirm` header read, 409/204 returned,
   `?status=` filter, overdue view); server exported; JSON `Content-Type` visible;
   listen-only-when-direct; server closed in a `finally` block.
2. **Dynamic gate** — `node --test tests/app.test.js` on an ephemeral port; the
   server is closed in `finally`. Skipped if static findings exist.

`sensor-report.json` = `{staticPassed, dynamicPassed, passed, findings[],
testExecution{passed, exitCode, stdout, stderr}}`; exit 0/1.

## 3. Run-by-run (bounded, ≤2 attempts)

### Run 1 — initial generation
The first-cut test file exercised every endpoint **except** the DELETE
confirmation path, so it contained no `409` / `204` exact assertions. The static
sensor therefore FAILed and reported exactly these findings (fed back verbatim
for repair — nothing else):

```json
[
  { "code": "MISSING_409_ASSERTION", "message": "Missing exact assertion: assert.strictEqual(response.status, 409);" },
  { "code": "MISSING_204_ASSERTION", "message": "Missing exact assertion: assert.strictEqual(response.status, 204);" }
]
```
`staticPassed=false`, `dynamicPassed=false` (skipped until static clears),
sensor exit 1. Snapshot saved to `evidence/initial-generation/`.

### Run 2 — repair (from findings only)
The repair added the missing DELETE-confirmation test
(`test_us3_ac3_delete_requires_confirmation`), which asserts the exact 409
(no `X-Confirm`) and 204 (with `X-Confirm: true`). Only
`tests/app.test.js` changed — `src/app.js` is byte-identical between
`initial-generation/` and `final-generation/`, the contract was untouched, and no
assertion was weakened or test deleted (Constitution III). Re-running the sensor:

- `staticPassed=true` (all exact-assertion + contract-completeness patterns now present).
- `dynamicPassed=true` (`node --test` → 12/12 pass, exit 0, server closed in `finally`).
- `passed=true`, sensor exit 0.

Snapshot saved to `evidence/final-generation/`. `evidence/attempt-log.json`
records both attempts with `generationSucceeded`, the `findings[]` fed back, and
`finalStatus: "SUCCESS"`, and separates the generation outcome from the
code-validation (sensor) outcome.

## 4. Final human decision & known limitations

**Decision: ACCEPT.** The final-generation set satisfies the full OpenAPI
contract, passes every static and dynamic gate, and the repair was confined to
the implementation/tests without touching the spec, the assertions, or the
sensor.

**Known limitations / residual risks (surviving the PASS):**
- **In-memory store** — state does not survive process restart (out of scope per
  spec §Out of Scope); acceptable for this demo, not a production data layer.
- **Overdue default "now"** — the live default uses `Date.now()`; determinism
  holds only when `?now=` is pinned (tests pin it). Time-zone handling is naive
  UTC via `Date.parse`.
- **Sensor is pattern-based** — the static gate checks that the exact-assertion
  *literals* are present; it does not execute every assertion's *semantic*
  correctness. A test could pass the static gate yet assert the wrong body.
  The dynamic gate (`node --test`) closes that gap by executing the suite.
- **No integration with a real database / network** — by design (zero deps,
  key-free, deterministic).

**Extra control I would add for a higher-risk / production setting:**
- A live-regression suite run against a real data store + CI (not just the
  ephemeral in-memory harness).
- Human-in-the-loop confirmation gating for any destructive operation that
  writes to real user data (today delete is header-confirmed, but not
  audited/persisted).
- A semantic (not just pattern) check, or a lightweight LLM judge, as a
  supplementary gate that must not replace the deterministic static/dynamic
  gates.
