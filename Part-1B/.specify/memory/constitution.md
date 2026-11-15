# NL Reminder Agent Constitution

## Core Principles

### I. Contract Stability
<!-- Example: I. Library-First -->
The structured output schema (fields, types, enums, value bounds) is a stable
contract. Free-text fields (title, clarification_question, block_reason) may
vary wording across runs; structured fields MUST stay machine-checkable.
**Rationale:** Non-deterministic generators can only be evaluated reliably when
the shape of their output is fixed.
**Enforcement:** Layer-1 schema validation in `.harness/schema/reminder-output.schema.json`;
schema changes require a spec revision, never silent drift.

### II. Key-Free Offline Default
The default evaluation path MUST run offline with no API key, no network, and
no committed secrets.
**Rationale:** Grading environments have no secrets; the audit trail must not
depend on one.
**Enforcement:** `SpawnedAgentBackend` is the default; any live-LLM path reads
keys only from process env and logs only `key_present: true/false`.

### III. Guardrails Are Never Repaired-Away
Safety guardrails (destructive-intent blocking, impossible-date rejection,
clarification on ambiguity) MUST NOT be weakened, deleted, or threshold-
lowered during a repair cycle to force a PASS.
**Rationale:** A harness that lets repairs disable safety controls has no
safety signal.
**Enforcement:** Repairs may touch only parser/prompt/guardrail-logic; dataset
cases, expected properties, and declared threshold are frozen once evaluation
starts (Lab Sheet 2 §8.5, harness-rules #10-11 analogue).

### IV. Deterministic Senses, Bounded Repair
All sensor layers (L1 structural, L2 invariant, L3 quality) are deterministic
code; an LLM judge may SUPPLEMENT L3 but never replace L1/L2. Repair is
bounded: at most 2 generation attempts per run, and only the observed findings
are fed back.
**Rationale:** Reproducibility of the verdict is what separates a harness from
an argument (Lab Sheet 2 reflection Q8).
**Enforcement:** `.harness/layers.js` uses no LLM call; `runner.js` stops after
2 attempts and writes `evidence/attempt-log.json` separating generation/backend
failures from evaluation failures.

### V. Measurable Quality Standards
- Evaluation threshold: aggregate score >= 0.90 (declared in the spec BEFORE evaluation).
- Per-case score = 0.40*L1 + 0.40*L2 + 0.20*L3, aggregate = mean over cases.
- PASS additionally requires L1 == 1.0 and L2 == 1.0 on EVERY case (hard gates).
- The dataset has >= 15 cases across at least 10 categories.
**Rationale:** A threshold declared before evaluation prevents post-hoc
rationalisation (spec-first).
**Enforcement:** `.harness/layers.js` implements the formula; the spec
`specs/001-reminder-agent/spec.md` §Evaluation Threshold records it.

### VI. Auditability
Every run leaves machine-readable evidence: per-case L1/L2/L3 scores, the
generated output, the failing layer + requirement, repair evidence fed to the
agent, and a final human ACCEPT/REJECT with residual risks.
**Rationale:** Generated output is untrusted until the audit trail backs it.
**Enforcement:** `evidence/eval-results.json`, `evidence/attempt-log.json`,
`evidence/harness-log.md`.

## Security Requirements

- No secrets, API keys, or `.env` files with real values in this project.
- Live-LLM backend (optional) reads its key from `process.env` only and logs
  presence (`key_present`) but never the value.
- Machine-specific paths are forbidden in committed files.

## Development Workflow

- SDD flow: constitution -> spec -> clarifications -> plan -> tasks ->
  analyze -> implement -> harness validation -> bounded repair -> revalidation
  -> human decision (Lab Sheet 1 flow).
- The initial generation snapshot (with its genuine defect) is preserved at
  `evidence/initial-generation/`; the final generation at
  `evidence/final-generation/`.

## Governance

The constitution supersedes all other project practices. Amendments require a
documented spec change; the evaluation threshold may only move through a spec
revision, never through a repair.

**Version**: 1.0.0 | **Ratified**: 2026-11-14 | **Last Amended**: 2026-11-14
