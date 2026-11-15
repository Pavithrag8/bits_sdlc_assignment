# Spec Kit Provenance Note — Part 1A

- **Bootstrap**: `specify init --here` was run inside `Part-1A/` using the
  installed **Spec Kit CLI v1.4.0** (`~/.local/bin/specify`, integration
  `copilot`, script type `sh`). It created the real `.specify/` project
  (templates, scripts, integrations, `memory/constitution.md`) and the
  `.github/skills/speckit-*/SKILL.md` skill commands.
- **SDD flow & artifacts** (Lab Sheet 1 order): the feature folder was created
  by the genuine Spec Kit script
  `.specify/scripts/bash/create-new-feature.sh` (feature number `001`,
  short-name `task-api` → `.specify/specs/001-task-api/`, and
  `.specify/feature.json` was written by that script). All artifacts were
  authored **from the installed Spec Kit templates** in
  `.specify/templates/`:
  - `memory/constitution.md`        ← constitution-template.md
  - `specs/001-task-api/spec.md`    ← spec-template.md
  - `specs/001-task-api/plan.md`    ← plan-template.md
  - `specs/001-task-api/tasks.md`   ← tasks-template.md
  - `specs/001-task-api/clarifications.md`, `analysis.md`, and a checklist
    (checklist-template.md) were authored in the Spec Kit `clarify`/`analyze`
    formats.
- **Available skill commands**: the `/speckit.*` commands (constitution,
  specify, clarify, plan, tasks, analyze, implement, converge, checklist) are
  installed as skills under `.github/skills/` and are available in the coding
  agent. In this offline build the artifacts were authored directly against
  those templates (same structure/naming the CLI would produce) and recorded
  here as the "reviewed artifacts" evidence.
