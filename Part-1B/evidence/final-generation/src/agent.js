'use strict';

const {
  SpawnedAgentBackend,
  SeededCandidateBackend,
  LiveLLMBackend,
  ServiceFailure,
} = require('./backend');

/**
 * Public entry for the NL Reminder Agent.
 *
 * generate(text, { now, backend }) -> ReminderOutput
 *   - now: reference timestamp (ISO-8601) used for all relative resolution.
 *   - backend: 'spawned' (default, key-free) | 'seeded' | 'live'.
 *
 * Returns the structured ReminderOutput. A ServiceFailure (backend could not
 * produce a result — spawn unavailable, key missing, HTTP error) propagates so
 * the runner can classify it separately from evaluation failures.
 */

const CONTRACT_FIELDS = {
  intent: 'unknown',
  title: null,
  reminder_time: null,
  time_basis: null,
  snooze_delta_minutes: null,
  needs_clarification: false,
  clarification_question: null,
  blocked: false,
  block_reason: null,
  confidence: 0,
};

/** Structural normalisation (L1 support): guarantee the stable contract even
 *  when a subagent returns a partial object — never invent semantics (L3). */
function normalizeContract(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ...CONTRACT_FIELDS, _unparsed: true };
  }
  const out = { ...obj };
  const NORMAL_INTENTS = ['create', 'reschedule', 'snooze', 'delete_all', 'unknown'];
  if (!NORMAL_INTENTS.includes(out.intent)) {
    out._intent_raw = out.intent;
    out.intent = 'unknown';
  }
  for (const key of Object.keys(CONTRACT_FIELDS)) {
    if (!(key in out)) out[key] = CONTRACT_FIELDS[key];
  }
  return out;
}

async function generate(text, opts = {}) {
  const nowIso = opts.now || new Date().toISOString();
  const backendName = opts.backend || 'spawned';
  let backend;
  if (backendName === 'seeded') backend = new SeededCandidateBackend({ runId: opts.runId });
  else if (backendName === 'live') backend = new LiveLLMBackend(opts);
  else backend = new SpawnedAgentBackend(opts);

  let output;
  try {
    output = await backend.generate(text, nowIso);
  } catch (err) {
    if (err instanceof ServiceFailure) throw err;
    throw new ServiceFailure(`backend "${backendName}" failed: ${err.message}`.slice(0, 200), 'unexpected');
  }

  return {
    backend: backend.name,
    now_iso: nowIso,
    output: normalizeContract(output),
  };
}

module.exports = { generate, ServiceFailure, normalizeContract };
