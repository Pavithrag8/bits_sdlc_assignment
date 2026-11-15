# Part 1A — Smart Todo & Task REST API (deterministic)

A deterministic Node.js **Tasks REST API** built from a single OpenAPI contract
(`openapi.yaml`) and verified by a deterministic feedforward/feedback harness
(the Lab Sheet 2 model). No framework, no third-party deps, no LLM, no API key.

## What it is

A REST **Items/Task API** (Sample A — Smart Todo & Task, realised as a REST
endpoint set):
- `POST /tasks` — create a task (title, description, priority, due date)
- `GET /tasks` — list; `GET /tasks?status=all|pending|completed` — filter
- `GET /tasks/{id}` — get by id
- `PATCH /tasks/{id}` — update / mark completed
- `DELETE /tasks/{id}` — delete **with confirmation** (`X-Confirm: true`)
- `GET /tasks/overdue?now=` — identify overdue (open) tasks

## Stack

- **Node.js 24**, CommonJS, native `node:http` (zero runtime dependencies).
- Tests: `node:test` + `node:assert/strict`.
- Single source of truth: `openapi.yaml`.

## How to run

```bash
cd Part-1A

# Boot the API (listens on :3000):
node src/app.js

# Run the test suite directly:
node --test tests/app.test.js
```

## The harness — one command

The whole deterministic harness (bounded 2-attempt generate → sense → repair →
audit loop) is a single command:

```bash
cd Part-1A && node .harness/run_all.js
```

It:
1. Generates **attempt 1** — a genuine first-cut `src/app.js` + `tests/app.test.js`
   (initial generation, missing the DELETE-confirmation exact assertions).
2. Runs `node .harness/sensor.js .` (static + dynamic gates, no LLM).
3. On FAIL, feeds **only** the observed `findings[]` back and runs
   **attempt 2** (repaired).
4. Writes `evidence/attempt-log.json` (attempts + finalStatus, separating
   generation failures from sensor validation failures) and
   `evidence/sensor-report.json` (the final PASS record).
5. Exits 0 on SUCCESS, 1 otherwise. Stops after 2 attempts.

Individual pieces:

```bash
node .harness/sensor.js .            # run the deterministic sensor (exit 0/1)
node --test tests/app.test.js        # run the dynamic gate directly
```

## Where the evidence lives

| File | Purpose |
|------|---------|
| `evidence/initial-generation/` | First-cut `app.js` + `app.test.js` (pre-repair snapshot) |
| `evidence/final-generation/` | Post-repair `app.js` + `app.test.js` (sensor PASS) |
| `evidence/sensor-report.json` | Final sensor report (`{staticPassed, dynamicPassed, passed, findings[], testExecution}`) |
| `evidence/attempt-log.json` | Bounded loop audit: `attempts[]`, `finalStatus` |
| `evidence/harness-log.md` | Human narrative: generation context, each run, the failure→repair, the final human ACCEPT/REJECT + known limitations |

## Spec Kit / SDD provenance

The SDD artifacts were produced in the real Spec Kit flow. `specify init --here`
(bootstrap from Spec Kit CLI **v1.4.0**) created the `.specify/` project
(templates, scripts, integrations, `memory/constitution.md`) and the
`.github/skills/speckit-*/SKILL.md` skills. The artifacts were authored
**from the installed templates** (`.specify/templates/`) in the Lab 1 order
(constitution → spec → clarifications → plan → tasks → analyze) and live at:

- `.specify/memory/constitution.md`
- `.specify/specs/001-task-api/{spec,clarifications,plan,tasks,checklist,analysis}.md`

The `/speckit.*` commands are available under `.github/skills/`. See
`.specify/NOTES.md` for the full provenance note.

## Layout

```text
Part-1A/
├── openapi.yaml            # single source of truth (the contract)
├── src/app.js              # REST server (exported; listens only when run directly)
├── tests/app.test.js       # node:test, exact assertions, ephemeral port
├── .harness/
│   ├── style-guide.md
│   ├── harness-rules.md
│   ├── generation-task.md
│   ├── sensor.js           # deterministic static + dynamic sensor
│   └── run_all.js          # bounded 2-attempt runner -> evidence/attempt-log.json
├── .specify/               # Spec Kit SDD artifacts + templates + NOTES.md
└── evidence/               # initial-generation/, final-generation/, sensor-report.json,
                            # attempt-log.json, harness-log.md
```
