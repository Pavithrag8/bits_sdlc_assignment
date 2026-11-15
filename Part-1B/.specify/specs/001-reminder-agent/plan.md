# Implementation Plan: Non-Deterministic NL Reminder Agent

**Branch**: `[001-reminder-agent]` | **Date**: 2026-11-14 | **Spec**:
`.specify/specs/001-reminder-agent/spec.md`

## 1. Summary

Parse unstructured reminder requests into a stable ReminderOutput JSON contract,
guardrail destructive/impossible input, and evaluate the non-deterministic
generator with a 3-layer deterministic harness (structural / invariant /
quality) against a pre-declared threshold of 0.90.

## 2. Technical Context

**Language/Version**: Node.js v24, CommonJS, no runtime npm dependencies.
**Generation backends** (`src/backend.js`):
- `SpawnedAgentBackend` (default): spawns a fresh `claude -p` subagent per
  case (system prompt from `prompts/system.md` + case text); key-free,
  offline (uses the installed local agent, no committed key). If spawning
  fails/is unavailable, falls back to `SeededCandidateBackend` (deterministic
  seeded-RNG sampling of candidate parses — documented as the alternative
  mechanism; wording still varies via seed derived from case + run id).
- `LiveLLMBackend` (optional, config-driven): Gemini/OpenAI via `fetch`,
  key ONLY from `process.env` (`LLM_API_KEY`), logs `key_present` only;
  raises a classified `ServiceFailure` when absent so service failures are
  distinguished from code/eval failures (Lab Sheet 2 §8.5).

**Sensor** (`.harness/layers.js`): pure JS, no LLM.
- L1: JSON parse + JSON-schema-style structural check against
  `.harness/schema/reminder-output.schema.json` (fields, types, enums,
  bounds).
- L2: deterministic invariants INV-1..INV-8 from the spec traceability table.
- L3: per-case rubric scoring (deterministic keyword/property rubrics stored
  in `evals/dataset.json`); an optional LLM-judge supplement is not part of
  the default path and never replaces L1/L2.

**Score**: `case = 0.40*L1 + 0.40*L2 + 0.20*L3`; aggregate = mean;
PASS iff aggregate >= 0.90 AND every L1 == 1.0 AND every L2 == 1.0.

## 3. Project Structure

```
Part-1B/
├── .specify/            # SDD artifacts (constitution, spec, clarifications, plan, tasks, analysis) + templates
├── .harness/
│   ├── schema/reminder-output.schema.json
│   ├── layers.js        # L1/L2/L3 + scoring + PASS rule
│   ├── runner.js        # dataset → backend → L1 → L2 → L3 → aggregate → evidence
│   ├── run_all.js       # single-command entry (initial/final snapshots + repair loop)
│   └── run.sh           # bash wrapper: node run_all.js
├── prompts/system.md    # feedforward prompt given to the subagent
├── src/
│   ├── backend.js       # SpawnedAgentBackend | SeededCandidateBackend | LiveLLMBackend
│   └── agent.js         # public entry: generate(input, opts) -> ReminderOutput
├── evals/dataset.json   # 20 cases, 10 categories, frozen at eval time
├── tests/backend.test.js# node:test unit checks for fallback + live-path key logging
└── evidence/            # initial-generation/, final-generation/, eval-results.json,
                         # attempt-log.json, harness-log.md
```

## 4. Interface Contract

`generate(text, {now}) -> ReminderOutput` — the only public API of the agent.
`runEval({maxAttempts})` in runner.js — produces
`{cases:[{id, l1, l2, l3, score, output, findings}], aggregate, pass, threshold}`.

## 5. Test Strategy (spec-to-test traceability)

| Spec item | Layer / test |
|---|---|
| AC-1 | dataset `ct-01/ct-02` + L1/L2/L3 |
| AC-2 (09:00 default) | dataset `rln-01` "call Mum tomorrow" + INV-3 |
| AC-3 | dataset `amb-01` + INV-4 + L3 rubric |
| AC-4 | dataset `mal-01/mal-02` + INV-1/INV-7 |
| AC-5 | dataset `res-01` + INV-7 |
| AC-6/7 | dataset `sno-01/sno-02` + INV-8 |
| AC-8 | dataset `deg-01/deg-02` + INV-5 |
| AC-9 | dataset `imp-01` + INV-6 |
| AC-10 | dataset `imp-02` (past) / out-of-horizon `imp-03` + INV-2 |
| AC-11/12 | runner PASS rule + 2-attempt bound in `run_all.js` |

Unit tests (`node --test tests/`) cover the seeded fallback, schema load, and
LiveLLM key-presence classification (no key ever in code).

## 6. Risks & Mitigations

- Spawned-agent output drift (wording/enum creep) → strict L1 enum gates +
  prompt with the full contract inline.
- Subagent unavailable at grade time → seeded deterministic fallback,
  mechanism recorded in harness-log.
- Live path untested with a key → declared residual risk (reflection Q5).
- Time invariants drift across days → reference `now` stamped per run and
  recorded in eval-results.
