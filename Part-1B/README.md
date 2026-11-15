# Part 1B — Non-Deterministic Natural-Language Reminder Agent

## What this is

A natural-language reminder agent that parses unstructured reminder requests
into a stable structured JSON contract (intent, title, ISO-8601 time, time
basis, snooze delta, clarification flag, guardrail flags, confidence). The
generation step is **non-deterministic**: a freshly spawned Claude subagent
per eval case (default), or a seeded deterministic fallback. A 3-layer
deterministic harness (structural / invariant / quality) evaluates it
against a pre-declared threshold.

## Run the offline key-free eval (single command)

```
cd Part-1B && .harness/run.sh
```

This runs the full bounded loop (max 2 attempts) with the default
**spawned-subagent** backend — no API key, no network key, fully offline.
It writes `evidence/eval-results.json` and `evidence/attempt-log.json`.

Other flags:
```
.harness/run.sh --no-repair   # single eval, no repair loop
.harness/run.sh --seeded      # force the seeded-candidate fallback backend
```

## How non-determinism is produced (no API key)

- **Default (spawned subagent):** `src/backend.js` → `SpawnedAgentBackend`
  freshly spawns `claude -p` per eval case (system prompt from
  `prompts/system.md` + the reminder text). Each spawn is an independent,
  non-deterministic LLM invocation: wording and choices genuinely vary
  case-to-case and run-to-run. **No API key is read or committed** — the
  locally installed agent supplies the model.
- **Seeded fallback:** `SeededCandidateBackend` samples candidate structured
  parses with a seeded RNG (seed = case id + run id), so wording/choice
  still varies between runs while remaining reproducible for a fixed seed.
  Used when a subagent cannot be spawned at grade time; the mechanism
  actually used is recorded in `evidence/harness-log.md`.
- **Optional live path:** `LiveLLMBackend` (Gemini) reads its key **only**
  from `process.env.LLM_API_KEY` / `GEMINI_API_KEY` and logs
  `key_present: true/false`. It raises a classified `ServiceFailure` when
  the key is absent so service failures are distinguished from code/eval
  failures (Lab Sheet 2 §8.5). **Not required for grading; untested-with-key
  (disclosed residual risk).**

## How to optionally enable the live backend (WITHOUT committing a key)

```
export LLM_API_KEY=...      # set in your shell, never in a committed file
node -e '
  const { LiveLLMBackend } = require("./src/backend");
  const b = new LiveLLMBackend({ model: "gemini-2.0-flash" });
  console.log(b.keyProbe());   // { backend, model, key_present: true }
  b.generate("call Mum tomorrow", new Date().toISOString())
    .then(o => console.log(JSON.stringify(o, null, 2)));
'
```

The key is read from the environment only; nothing is committed. `.gitignore`
already excludes `.env` and `*.env`.

## How to read the evidence

- `evidence/initial-generation/` — the **first** code + prompt + parser
  snapshot, with a genuine Layer-2 invariant defect (bare-day clarification
  instead of the 09:00 default) that the 3-layer harness caught.
- `evidence/final-generation/` — the post-repair snapshot (defect fixed).
- `evidence/eval-results.json` — per-case L1/L2/L3 scores, aggregate, final
  PASS/FAIL, structured findings.
- `evidence/attempt-log.json` — the bounded repair loop: attempts[],
  service_failures vs eval_failures separated (Lab Sheet 2 §8.5).
- `evidence/harness-log.md` — the narrative: backend + config, threshold +
  scoring as declared in the spec, results across layers, genuine failure +
  evidence fed to the agent, repair + re-eval outcome, **final human
  ACCEPT/REJECT + residual risks**.

## Spec Kit provenance

Spec Kit CLI **v1.4.0** was used to bootstrap `.specify/` and
`.github/skills/speckit-*`. The SDD artifacts (constitution, spec,
clarifications, plan, tasks, analysis) were authored in the Spec Kit
template formats under `.specify/specs/001-reminder-agent/`. See
`.specify/NOTES.md` for details.

## Output schema contract (stable structure)

Fields (all required in the output object):
`intent` ∈ {create, reschedule, snooze, delete_all, unknown} ·
`title` (string|null) · `reminder_time` (ISO-8601|null, within
[reference_now, reference_now+1y]) · `time_basis` ∈
{explicit, default_from_date, snooze_delta, null} ·
`snooze_delta_minutes` (int|null, positive when present) ·
`needs_clarification` (bool) · `clarification_question` (string|null) ·
`blocked` (bool) · `block_reason` (string|null) · `confidence` (float[0,1]).

JSON schema: `.harness/schema/reminder-output.schema.json`.

## Evaluation threshold + scoring (declared in spec BEFORE evaluation)

- `case_score = 0.40*L1 + 0.40*L2 + 0.20*L3`
- `aggregate = mean(case_score)`
- **PASS iff aggregate >= 0.90 AND every case L1 == 1.0 AND every case
  L2 == 1.0** (L1/L2 hard gates; L3 quality/safety-valve term).

Declared in `.specify/specs/001-reminder-agent/spec.md` §Evaluation
Threshold and constitution V; implemented in `.harness/layers.js`.

## Reflection pointers

- **Q3 (non-determinism case):** cite `evals/dataset.json` case `rln-01`
  ("call Mum tomorrow") — the L1 schema field `time_basis`, the L2
  invariant INV-3-DEFAULT-0900 (09:00 default rule), and the L3 rubric
  (`L3-TIME-BASIS`, `L3-CLARIFY-FLAG`); explain why exact string matching
  fails (wording varies) but structure + invariants + quality hold.
- **Q5 (residual risk):** cite `evidence/harness-log.md` §5 — live path
  untested-with-key, fixed reference `now`, seeded fallback is rule-based,
  no LLM judge in the default path.
