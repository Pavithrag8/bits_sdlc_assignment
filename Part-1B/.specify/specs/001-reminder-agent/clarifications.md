# Clarifications: Non-Deterministic Natural-Language Reminder Agent (reminder-agent)

## Clarification Log

### C-1 — What is "no time given, date given"?
**Q:** Does "call Mum tomorrow" need a time from the user, or is there a default?
**A:** A date given without a time uses the 09:00 local default and is NOT
ambiguity. `time_basis` becomes `default_from_date`; `needs_clarification`
stays false.
**Source:** ambiguity
**Impact on spec:** Resolves AC-2, FR-4, L2 invariant INV-3.

### C-2 — When IS a date without time ambiguous?
**Q:** Is "meet the team next week" the same as "tomorrow"?
**A:** A coarse span (a week) with no anchor day is genuinely ambiguous —
ask which day. A single day (tomorrow, friday) is not.
**Source:** ambiguity
**Impact on spec:** Resolves AC-3, FR-5, L2 invariant INV-4 and the rubric
distinction between "ambiguous" and "date-only-default" categories.

### C-3 — What counts as destructive intent?
**Q:** Does "clear my reminders" count, or only "delete all"?
**A:** Any request to remove/bulk-delete all or many reminders is
`delete_all` and MUST be blocked (this agent proposes structured intent; it
never executes bulk deletion). "Delete this one reminder" is out of scope
(no stored reminders yet).
**Source:** scope
**Impact on spec:** Resolves AC-8, FR-6, INV-5.

### C-4 — How are impossible dates handled?
**Q:** "30th February" — block or clarify?
**A:** Either `blocked=true` (reason: impossible calendar instant) or
`needs_clarification=true` (e.g. "did you mean a different date?"). Both are
acceptable; emitting a `reminder_time` for it is a Layer-2 failure.
**Source:** ambiguity
**Impact on spec:** Resolves AC-9, FR-7, INV-6.

### C-5 — Is snooze without a duration an error?
**Q:** "snooze" with no number — default or ask?
**A:** The system prompt declares a 10-minute default delta; the agent may
apply it (`time_basis=snooze_delta`, `snooze_delta_minutes=10`) or ask. Both
are spec-legal; the L3 rubric requires whichever it chooses to be consistent
with `time_basis`.
**Source:** assumption
**Impact on spec:** Resolves AC-7, INV-8 (snooze ⇒ positive delta when a
delta is present).

### C-6 — Which backend is graded?
**Q:** Do we need a live LLM key?
**A:** No. Default backend is a freshly spawned Claude subagent per case
(`claude -p`), key-free (it uses the machine's installed agent, not a
committed key). If spawning is unavailable, a seeded deterministic fallback
samples candidate parses; the exact mechanism used at grade time is
documented in `evidence/harness-log.md`. The optional `LiveLLMBackend`
(env-keyed) is NOT part of grading and is disclosed as residual risk.
**Source:** scope
**Impact on spec:** Resolves FR-10, NFR-2, constitution II.

### C-7 — How does the harness treat L3 for ambiguous cases?
**Q:** If the agent asks a clarification, what does the L3 rubric reward?
**A:** L3 rewards the QUESTION being on-point for the missing piece
(heuristic rubric over the case's `expected.rubric`), not any particular
phrasing. Exact string matching is deliberately NOT used for free text.
**Source:** assumption
**Impact on spec:** Resolves the §Evaluation Threshold L3 formula and the
per-case rubric in `evals/dataset.json`.
