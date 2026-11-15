#!/usr/bin/env bash
# Single-command, key-free offline evaluation for the NL Reminder Agent (Part 1B).
# Usage:
#   .harness/run.sh              # bounded loop (max 2 attempts) + evidence
#   .harness/run.sh --no-repair  # single eval
#   .harness/run.sh --seeded     # force seeded-candidate backend
set -euo pipefail
cd "$(dirname "$0")/.."

# Offline-probe guard: key-free default means NO API key is read.
if [[ -n "${LLM_API_KEY:-}" || -n "${GEMINI_API_KEY:-}" ]]; then
  echo "[offline-probe] WARNING: LLM_API_KEY/GEMINI_API_KEY is set; the default path ignores it (spawned/seeded backends only)." >&2
fi
echo "[offline-probe] running key-free, offline (backend: spawned-subagent unless --seeded)"

exec node .harness/run_all.js "$@"
