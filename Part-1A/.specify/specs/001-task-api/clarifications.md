# Clarifications: Smart Todo & Task REST API

**Feature**: 001-task-api · **Command**: `/speckit.clarify` · **Date**: 2026-11-14

## Clarification Log

### C-1 — Is a due date mandatory?
**Q:** Can a task be created without a due date?
**A:** No. `due_date` is optional; when omitted it is stored as `null` and the
task is never overdue.
**Source:** assumption
**Impact on spec:** FR-1 (optional `due_date`), US4 edge case "no due_date".

### C-2 — What counts as an overdue task?
**Q:** Do completed tasks still appear as overdue?
**A:** No. Overdue applies to *open* tasks only: `completed == false` AND
`due_date` is not null AND `due_date < now`. This removes the ambiguity of
showing long-finished tasks as overdue.
**Source:** ambiguity
**Impact on spec:** US4 AC-2, FR-8.

### C-3 — How is task deletion confirmed?
**Q:** The lab requires "delete after confirmation" — what is the mechanism?
**A:** A single-step confirmation: `DELETE /tasks/{id}` returns 409 with an
error unless the request carries header `X-Confirm: true`, in which case it
returns 204. No separate "arm then confirm" endpoint.
**Source:** ambiguity
**Impact on spec:** US3 AC-3, FR-7.

### C-4 — Default priority and default sort order?
**Q:** What priority is used when none is given, and how is the list ordered?
**A:** Priority defaults to `medium`. `GET /tasks` returns tasks in insertion
order (by ascending id); no re-ordering by priority is applied in v1.
**Source:** ambiguity
**Impact on spec:** FR-1 (default medium), FR-3.

### C-5 — Can a completed task be edited back to pending?
**Q:** Is the completed state reversible?
**A:** Yes. `completed` is a plain boolean toggled by PATCH in both directions
(pending ⇄ completed); completing a task does not lock its fields.
**Source:** assumption
**Impact on spec:** US3 AC-2, FR-6.

### C-6 — Where does "now" come from for the overdue view?
**Q:** The API must be deterministic under test — how is the reference time
fixed?
**A:** `GET /tasks/overdue` accepts a `?now=` ISO-8601 query parameter; tests
pass an explicit value. The live default is the current UTC time. This keeps
the overdue logic a pure function of input.
**Source:** ambiguity
**Impact on spec:** US4, NFR-1, FR-8.

### C-7 — Response shape on success vs validation error?
**Q:** Must error responses follow a fixed shape?
**A:** Yes. Every 4xx (400/404/409) returns a JSON object with exactly one
string property, `error`. Success create returns the created task; list/get
return task objects/arrays; delete-success is a bare 204 (no body).
**Source:** scope
**Impact on spec:** NFR-3, FR-1/FR-2/FR-7.
