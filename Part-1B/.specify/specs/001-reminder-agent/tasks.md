# Tasks: Non-Deterministic NL Reminder Agent

**Input**: Design documents from `.specify/specs/001-reminder-agent/`

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 [FR-1] Create output schema `.harness/schema/reminder-output.schema.json` (fields, enums, bounds per spec §Key Entities)
- [x] T002 [FR-12] Author `evals/dataset.json`: 20 cases across 10 categories with `id`/`input`/`expected`/`category`

## Phase 2: Feedforward + Generation

- [x] T003 [FR-2..FR-8] Author `prompts/system.md`: full contract, 09:00 default rule, guardrail rules, supported horizon
- [x] T004 [FR-10] Implement `src/backend.js`: `SpawnedAgentBackend` (fresh `claude -p` per case, key-free), `SeededCandidateBackend` (seeded-RNG candidate sampling, documented fallback), `LiveLLMBackend` (env key only, `key_present` logging, classified `ServiceFailure`)
- [x] T005 [FR-1] Implement `src/agent.js`: `generate(text,{now})` wiring backend → output

## Phase 3: Sensor Layers

- [x] T006 [AC-11] Implement `.harness/layers.js`: L1 structural (schema check), L2 invariants INV-1..INV-8, L3 per-case rubric scoring; case/aggregate scoring (0.40/0.40/0.20, threshold 0.90, L1/L2 hard gates)
- [x] T007 [AC-11, AC-12] Implement `.harness/runner.js`: dataset → generate → L1/L2/L3 → aggregate → structured findings; `.harness/run_all.js` bounded 2-attempt loop writing `evidence/eval-results.json` + `evidence/attempt-log.json`; `.harness/run.sh` single-command wrapper with offline-probe line

## Phase 4: Verification

- [x] T008 [AC-12] Snapshot initial generation (with genuine defect) to `evidence/initial-generation/`, run harness, capture FAIL
- [x] T009 [AC-12] Repair parser/prompt/guardrail only; snapshot `evidence/final-generation/`; re-run to PASS (<= 2 attempts)
- [x] T010 [FR-10] `node --check` all sources; record backend mechanism + threshold + results in `evidence/harness-log.md`; final human ACCEPT/REJECT
