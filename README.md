# Assignment 1 — Spec-Driven Development & Harness Engineering

Deterministic + non-deterministic parts · **25 marks** · due **Nov 15, 2026**

## Overview

This submission covers two related parts of a Spec-Driven Development (SDD) +
harness-engineering assignment. Each part follows the same SDD flow, but differs
in how it verifies the generated work:

```
Problem statement
  -> /speckit.constitution  -> /speckit.specify  -> /speckit.clarify
  -> /speckit.plan          -> /speckit.tasks    -> /speckit.analyze (where applicable)
  -> /speckit.implement     -> Harness validation -> feedback/repair -> revalidation -> human decision
```

The specification and its acceptance criteria are written **before** any
implementation. An **independent harness** — one that encodes the *spec*, not
the generated *code* — then validates the output, captures failures as
structured evidence, and feeds them back to the coding agent for repair. The
harness/repair cycle is preserved as evidence.

## Repo tour

```
Assignment-1/
├── README.md            <- this file
├── Part-1A/             <- DETERMINISTIC part (Node.js Tasks REST API)
│   ├── .specify/        <- Spec Kit SDD artifacts (constitution, spec, clarifications, plan, tasks, checklist, analysis)
│   ├── openapi.yaml     <- single source of truth (the REST contract)
│   ├── src/             <- app.js (the Tasks REST API; node:http, no framework)
│   ├── tests/           <- app.test.js (node:test; spec-derived, exact assertions)
│   ├── .harness/        <- deterministic sensor.js (static + dynamic) + bounded 2-attempt runner + feedforward files
│   └── evidence/        <- initial-generation / final-generation snapshots, sensor-report.json, attempt-log.json, harness-log.md
├── Part-1B/             <- NON-DETERMINISTIC part (NL Reminder Agent, offline-default backend)
│   ├── .specify/        <- Spec Kit SDD artifacts
│   ├── openapi.yaml-equivalent: .harness/schema/reminder-output.schema.json (output schema contract)
│   ├── src/             <- agent.js + backend.js (spawned-subagent LLM, seeded fallback, optional live LLM)
│   ├── prompts/         <- feedforward system prompt
│   ├── tests/           <- node:test unit checks
│   ├── evals/           <- dataset.json (23 cases) + eval pipeline
│   ├── .harness/        <- three-layer evaluation (structural / property-invariant / semantic) + runner
│   └── evidence/        <- initial/final snapshots, eval-results*.json, attempt-log.json, harness-log.md
└── docs/                <- shared briefs + reflection scaffolding + student to-do
```

### What each part builds

- **Part 1A — Tasks REST API (deterministic).** A small Node.js (`node:http`,
  no framework, no deps) REST API for tasks: create / list / get / patch /
  delete-with-confirmation / overdue, driven by an **OpenAPI contract
  (`openapi.yaml`)** as the single source of truth. Verification is a
  **deterministic `sensor.js` harness** (the Lab-Sheet-2 model): a static
  sensor (exact-assertion + contract-completeness checks) then a dynamic test
  run (`node --test`, ephemeral port, server closed in `finally`), with a
  **bounded 2-attempt repair loop** and audit logs that separate generation
  failures from code-validation failures. Identical inputs → identical outputs.

- **Part 1B — NL Reminder Agent (non-deterministic, offline-default).** A
  natural-language reminder agent that parses free text into structured
  reminder items (intent, time, reschedule/snooze, clarification when
  mandatory info is missing) and enforces guardrails (block destructive
  intent, refuse impossible dates). Non-determinism comes from a **spawned
  subagent** acting as the LLM (no committed API key); a **seeded-candidate**
  backend is the documented offline fallback, and a **live-LLM** backend is
  optional + config-driven (key from env only, never committed). Verification
  is a **three-layer evaluation** (L1 structural/schema, L2 property/invariant,
  L3 semantic/quality) over a **23-case** `evals/dataset.json`, with an
  aggregate weighted score against a **0.90 threshold** (L1/L2 are hard gates),
  and a bounded 2-attempt repair loop. No secrets are committed.

## How to run everything

> **Prerequisites** — **Node.js 24** (native `node:test` + `node:assert/strict`;
> no npm packages are required). Part 1B's default path is offline and key-free;
> a live-LLM backend is optional and reads its key from the environment only.

### Part 1A — run the deterministic sensor harness

A single command runs the bounded 2-attempt loop and writes the structured
evidence (`evidence/sensor-report.json`, `evidence/attempt-log.json`):

```bash
cd Part-1A
node .harness/run_all.js        # sensor.js static + dynamic gates, no LLM, no network
# inspect the deterministic sensor directly:
node .harness/sensor.js .       # exit 0 = PASS, 1 = findings
```

**Where to read the evidence:** `Part-1A/evidence/sensor-report.json`
(machine-generated gate findings), `Part-1A/evidence/attempt-log.json`
(bounded repair audit, generation vs sensor failures separated),
`Part-1A/evidence/harness-log.md` (human-written narrative: generation context,
each run, the failure→repair cycle, and the final human ACCEPT/REJECT decision).

### Part 1B — run the three-layer eval pipeline

A single command runs the offline eval (key-free) and writes
`evidence/eval-results.json`:

```bash
cd Part-1B
.harness/run.sh                # offline default (spawned-subagent LLM; falls back to seeded-candidate if unavailable), no API key
# useful variants:
.harness/run.sh --seeded       # force the seeded-candidate offline fallback backend
.harness/run.sh --no-repair    # single evaluation, no repair loop
node .harness/repair_cycle.js  # replay the genuine initial-FAIL → repair → PASS cycle
```

**Where to read the evidence:** `Part-1B/evidence/eval-results.json`
(machine-generated per-case L1/L2/L3 + aggregate),
`Part-1B/evidence/attempt-log.json` (audit, service vs eval failures separated),
`Part-1B/evidence/harness-log.md` (backend/config provenance, the declared
threshold & scoring method, layer results, the failure→repair cycle, and the
final human decision).

> **Note:** the authoritative run commands live in `Part-1A/README.md` and
> `Part-1B/README.md`. The Spec Kit feature slugs are `001-task-api`
> (Part 1A) and `001-reminder-agent` (Part 1B); the SDD trees live at
> `Part-1A/.specify/specs/001-task-api/` and
> `Part-1B/.specify/specs/001-reminder-agent/`.

## Git repo checklist

The repo must satisfy the following. All items are met in this submission;
re-verify items 3, 5 and 9 by running the two harnesses and the secret scan
before pushing.

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Both parts present (`Part-1A/` and `Part-1B/`) | ✅ done |
| 2 | Each part follows the full Spec Kit SDD flow (constitution → specify → clarify → plan → tasks → analyze → implement) via `specify 1.4.0` bootstrap + `.specify/templates/` | ✅ done |
| 3 | Part 1A: deterministic `sensor.js` gates (static + dynamic) run and PASS after repair | ✅ `cd Part-1A && node .harness/run_all.js` → final SUCCESS |
| 4 | Part 1A: tests **derived from the OpenAPI contract + spec** (spec-to-test/sensor traceability in `Part-1A/.specify/specs/001-task-api/plan.md`) | ✅ done |
| 5 | Part 1B: **23 eval cases** (≥15) and a **non-deterministic** three-layer pipeline (threshold 0.90). Reproducible green: `cd Part-1B && .harness/run.sh --seeded --no-repair` → PASS (aggregate 0.967, L1/L2 100%). The default spawned-subagent path is genuinely non-deterministic and can land on a FAIL in a given run (documented in `Part-1B/evidence/attempt-log.json` and `harness-log.md` §1b); the seeded path is the reproducible evidence trail | ✅ |
| 6 | Harness/repair evidence preserved (initial-generation snapshot, failure evidence, repaired final-generation, results JSON + attempt-log) | ✅ both parts |
| 7 | `evidence/harness-log.md` present **in both** parts (narrative + linked JSON evidence) | ✅ done |
| 8 | Final **human ACCEPT/REJECT** decision recorded in each part's `harness-log.md` | ✅ done |
| 9 | **No API keys / credentials / `.env` secrets** committed anywhere | ✅ verify before push: `grep -rIInE "api[_-]?key\|secret\|token\|OPENAI_API_KEY=\|GEMINI_API_KEY=" .` and `find . -name ".env"` |
| 10 | Instructions sufficient to run the harness from a clean clone (this README + each part's README) | ✅ done |

## Submission checklist — the three deliverables

The three things actually handed in (this repo is deliverable 1 only):

| Deliverable | Where it goes | Status |
|-------------|---------------|--------|
| **Public GitHub repo** (this `Assignment-1/` structure) | `git push` to a **public** repo | 📝 your step — see `docs/submission-todo.md` §B |
| **Demo video** (short, on-screen run of both harnesses + repair cycle) | Google Drive link | 📝 your step — script in `docs/video-script.md` |
| **Reflection report** (5 assessed questions + 2 problem-statement blurbs) | LMS submission (LMS only) | 📝 your step — scaffold in `docs/reflection-draft.md` (write it in your own words) |

## Honesty & AI-policy notes

- **Spec Kit SDD artifacts were produced with the Spec Kit CLI** — each part was
  bootstrapped with `specify init` (Spec Kit `1.4.0`, Copilot integration), which
  created `.specify/` (templates, scripts, memory) and the `.github/skills/speckit-*`
  command files; the SDD artifacts (constitution, spec, clarifications, plan,
  tasks, checklist/analysis) were authored **from the `.specify/templates/`** in the
  Lab-Sheet-1 order. Provenance is recorded in each part's
  `.specify/NOTES.md`.
- **Part 1B's default backend is offline and key-free** — non-determinism comes from
  a **spawned subagent** acting as the LLM (`claude -p` when available, else a
  documented **seeded-candidate** fallback), so the pipeline runs with no committed
  API key and no network key. A **live-LLM** backend is optional and config-driven
  (key read from the environment only, logged as a `key_present` boolean); it was
  **not** used to commit anything and **no secrets are committed**.
- Harness JSON results and tool output are machine-generated evidence. The
  `harness-log.md` narrative and the reflection report are the student's own
  words — AI-generated reflection text is an unacceptable AI use per the
  assignment. See `docs/reflection-draft.md` for the scaffold (do **not**
  submit the scaffold's placeholder boxes as the report).
- Failures recorded are **genuine** ones that happened during development —
  none were manufactured just to fill a cycle.
