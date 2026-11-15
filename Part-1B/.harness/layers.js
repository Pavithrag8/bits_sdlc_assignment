'use strict';

/**
 * 3-layer evaluation sensor for the NL Reminder Agent.
 *
 * L1 structural   — output JSON parses and conforms to
 *                   .harness/schema/reminder-output.schema.json
 *                   (required fields, types, enums, confidence bounds).
 * L2 invariant    — deterministic spec rules INV-1..INV-8 (spec §Traceability):
 *                    INV-1 supported intent only
 *                    INV-2 valid ISO-8601 within [now, now+1y] when present
 *                    INV-4 needs_clarification flag consistent with question
 *                    INV-5 destructive intent ⇒ blocked=true, time null,
 *                          reason non-null
 *                    INV-6 impossible/horizon case ⇒ (blocked or clarification)
 *                          and time null
 *                    INV-7 source evidence: a claimed time must carry one of the
 *                          three time_basis values; a default_from_date basis
 *                          means 09:00 local (the spec's 09:00 rule, FR-4)
 *                    INV-8 snooze ⇒ positive integer delta when claimed, and
 *                          time_basis consistency
 * L3 semantic     — per-case deterministic rubric (expected fields, keyword
 *                   presence in free text, exact times). An LLM judge may
 *                   supplement L3 but must NOT replace L1/L2.
 *
 * Scoring (declared in spec §3 BEFORE evaluation):
 *   case_score  = 0.40*L1 + 0.40*L2 + 0.20*L3
 *   aggregate   = mean(case_score)
 *   PASS iff aggregate >= 0.90 AND every case L1 == 1.0 AND every case L2 == 1.0
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, 'schema', 'reminder-output.schema.json');
const WEIGHTS = { l1: 0.4, l2: 0.4, l3: 0.2 };
const THRESHOLD = 0.90;

const ONE_YEAR_MS = 366 * 24 * 60 * 60 * 1000; // generous bound

function loadSchema() {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

function parseIso(s) {
  if (typeof s !== 'string') return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return null;
  return d;
}

function localHM(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------------------------------------------------------------- L1
function layer1(output) {
  const checks = [];
  const schema = loadSchema();
  const add = (code, ok, detail) => checks.push({ code, ok, detail });

  const isObject = output !== null && typeof output === 'object' && !Array.isArray(output);
  add('L1-IS-OBJECT', isObject, isObject ? 'output is a JSON object' : 'output is not a JSON object');
  if (!isObject) return { score: 0, checks };

  for (const req of schema.required) {
    add(`L1-REQUIRED-${req}`, req in output, `${req} ${req in output ? 'present' : 'missing'}`);
  }
  const props = schema.properties;

  add('L1-INTENT-ENUM', props.intent.enum.includes(output.intent),
    `intent=${JSON.stringify(output.intent)}`);
  add('L1-TITLE-TYPE', output.title === null || typeof output.title === 'string',
    `title type=${typeof output.title}`);
  add('L1-TIME-TYPE', output.reminder_time === null || typeof output.reminder_time === 'string',
    `reminder_time type=${typeof output.reminder_time}`);

  const basisEnum = ['explicit', 'default_from_date', 'snooze_delta', null];
  add('L1-BASIS-ENUM', basisEnum.includes(output.time_basis),
    `time_basis=${JSON.stringify(output.time_basis)}`);

  const deltaOk =
    output.snooze_delta_minutes === null ||
    (Number.isInteger(output.snooze_delta_minutes) && output.snooze_delta_minutes >= 1);
  add('L1-DELTA-TYPE', deltaOk, `snooze_delta_minutes=${JSON.stringify(output.snooze_delta_minutes)}`);

  add('L1-CLARIFY-BOOL', typeof output.needs_clarification === 'boolean',
    `needs_clarification type=${typeof output.needs_clarification}`);
  add('L1-QUESTION-TYPE', output.clarification_question === null ||
    typeof output.clarification_question === 'string',
    `clarification_question type=${typeof output.clarification_question}`);
  add('L1-BLOCKED-BOOL', typeof output.blocked === 'boolean',
    `blocked type=${typeof output.blocked}`);
  add('L1-REASON-TYPE', output.block_reason === null || typeof output.block_reason === 'string',
    `block_reason type=${typeof output.block_reason}`);
  add('L1-CONFIDENCE', typeof output.confidence === 'number' &&
    output.confidence >= 0 && output.confidence <= 1,
    `confidence=${JSON.stringify(output.confidence)}`);

  const passed = checks.filter((c) => c.ok).length;
  return { score: passed / checks.length, checks };
}

// ---------------------------------------------------------------- L2
function layer2(output, ctx) {
  const { now, caseDef } = ctx;
  const checks = [];
  const add = (code, ok, detail) => checks.push({ code, ok, detail });
  const o = output;
  if (o === null || typeof o !== 'object' || Array.isArray(o)) {
    add('INV-0-OUTPUT', false, `output is ${o === null ? 'null' : typeof o}, not an object`);
    return { score: 0, checks };
  }
  const time = o.reminder_time ? parseIso(o.reminder_time) : null;

  // INV-1 supported intent
  add('INV-1-INTENT',
    ['create', 'reschedule', 'snooze', 'delete_all', 'unknown'].includes(o.intent),
    `intent=${JSON.stringify(o.intent)}`);

  // INV-2 valid ISO within [now, now+1y] when present
  let boundsOk = true;
  if (o.reminder_time !== null) {
    if (!time) boundsOk = false;
    else if (time.getTime() < now.getTime() || time.getTime() > now.getTime() + ONE_YEAR_MS) {
      boundsOk = false;
    }
  }
  add('INV-2-ISO-BOUNDS', boundsOk,
    `reminder_time=${JSON.stringify(o.reminder_time)} (now=${now.toISOString()})`);

  // INV-4 clarification flag/question consistency
  const flag = Boolean(o.needs_clarification);
  const qPresent = o.clarification_question !== null && String(o.clarification_question).length > 0;
  add('INV-4-CLARIFY-CONSISTENT', flag === qPresent,
    `needs_clarification=${flag} question=${qPresent ? 'present' : 'absent'}`);

  // INV-5 destructive ⇒ blocked + null time + reason
  if (o.intent === 'delete_all') {
    add('INV-5-DESTRUCTIVE-BLOCKED', o.blocked === true, `blocked=${o.blocked}`);
    add('INV-5-DESTRUCTIVE-TIME-NULL', o.reminder_time === null,
      `reminder_time=${JSON.stringify(o.reminder_time)}`);
    add('INV-5-DESTRUCTIVE-REASON', o.block_reason !== null,
      `block_reason=${JSON.stringify(o.block_reason)}`);
  }

  // INV-6 impossible/horizon cases ⇒ guarded + time null
  if (caseDef.expected && caseDef.expected.time_must_be_null && o.reminder_time !== null) {
    add('INV-6-IMPOSSIBLE-TIME-NULL', false,
      `reminder_time must be null for this case but is ${JSON.stringify(o.reminder_time)}`);
  }
  if (caseDef.expected && caseDef.expected.blocked_or_clarification &&
      !(o.blocked || o.needs_clarification)) {
    add('INV-6-GUARDED', false,
      'impossible/horizon case must be blocked or need clarification, but neither is set');
  }

  // INV-8 snooze ⇒ positive delta + basis consistency
  if (o.intent === 'snooze') {
    if (o.snooze_delta_minutes !== null && !(o.snooze_delta_minutes >= 1)) {
      add('INV-8-SNOOZE-DELTA-POS', false, `delta=${o.snooze_delta_minutes} not positive`);
    } else {
      add('INV-8-SNOOZE-DELTA-POS', true,
        o.snooze_delta_minutes !== null
          ? `delta=${o.snooze_delta_minutes}`
          : 'no delta claimed (default-or-ask policy applies)');
    }
    if (o.snooze_delta_minutes !== null && o.time_basis !== 'snooze_delta') {
      add('INV-8-SNOOZE-BASIS', false,
        `delta claimed but time_basis=${JSON.stringify(o.time_basis)} != snooze_delta`);
    } else {
      add('INV-8-SNOOZE-BASIS', true,
        o.time_basis === 'snooze_delta' ? 'basis consistent' : 'no delta, basis not required');
    }
  }

  // INV-7 source evidence
  if (o.reminder_time !== null) {
    const okBasis = ['explicit', 'default_from_date', 'snooze_delta'].includes(o.time_basis);
    add('INV-7-TIME-EVIDENCE', okBasis,
      `time claimed with time_basis=${JSON.stringify(o.time_basis)}`);
  } else {
    add('INV-7-TIME-EVIDENCE', true, 'no time claimed — evidence not required');
  }
  // INV-3 date-only default rule (spec FR-4, AC-2): when a specific bare day
  // is named and no time is stated, the time MUST be 09:00 local with
  // time_basis default_from_date AND needs_clarification MUST be false.
  // This is the boundary invariant the first-cut parser breached on
  // "call Mum tomorrow" (it asked for the time instead of applying the
  // 09:00 default).
  if (o.intent === 'create') {
    const inputLower = (caseDef.input || '').toLowerCase();
    const bareDay = /\btomorrow\b|\bfriday\b|\bmonday\b|\btuesday\b|\bwednesday\b|\bthursday\b|\bsaturday\b|\bsunday\b/.test(inputLower);
    const noStatedTime = !/\d/.test(caseDef.input || '');
    if (bareDay && noStatedTime) {
      const d = o.reminder_time ? parseIso(o.reminder_time) : null;
      const okDefault = o.time_basis === 'default_from_date'
        && d && localHM(d) === '09:00'
        && o.needs_clarification === false;
      add('INV-3-DEFAULT-0900', okDefault,
        `bare day named, no time stated ⇒ expected 09:00 default with basis=default_from_date and no clarification; got basis=${o.time_basis}, local=${d ? localHM(d) : 'n/a'}, clarify=${o.needs_clarification}`);
    }
  }

  const passed = checks.filter((c) => c.ok).length;
  return { score: checks.length === 0 ? 1 : passed / checks.length, checks };
}

// ---------------------------------------------------------------- L3
function layer3(output, caseDef) {
  const checks = [];
  const add = (code, ok, detail) => checks.push({ code, ok, detail });
  if (output === null || typeof output !== 'object' || Array.isArray(output)) {
    add('L3-OUTPUT', false, `output is ${output === null ? 'null' : typeof output}`);
    return { score: 0, checks };
  }
  const o = output;
  const exp = caseDef.expected || {};

  if (exp.intent) add('L3-INTENT', o.intent === exp.intent,
    `expected ${exp.intent}, got ${o.intent}`);

  if (exp.time_basis) add('L3-TIME-BASIS', o.time_basis === exp.time_basis,
    `expected ${exp.time_basis}, got ${o.time_basis}`);

  if (exp.needs_clarification !== undefined) {
    add('L3-CLARIFY-FLAG', o.needs_clarification === exp.needs_clarification,
      `expected needs_clarification=${exp.needs_clarification}, got ${o.needs_clarification}`);
  }
  if (exp.blocked !== undefined) add('L3-BLOCKED', o.blocked === exp.blocked,
    `expected blocked=${exp.blocked}, got ${o.blocked}`);
  if (exp.block_reason_required) add('L3-BLOCK-REASON',
    o.block_reason !== null && String(o.block_reason).length > 0,
    'destructive case requires a block_reason');

  if (exp.snooze_delta_minutes !== undefined) {
    add('L3-SNOOZE-DELTA', o.snooze_delta_minutes === exp.snooze_delta_minutes,
      `expected ${exp.snooze_delta_minutes}, got ${o.snooze_delta_minutes}`);
  }
  // sno-03-style policy check: either default-10 with consistent basis, or a question
  if (exp.needs_clarification_or_default) {
    const defaulted = o.snooze_delta_minutes === 10 && o.time_basis === 'snooze_delta' && !o.needs_clarification;
    const asked = o.needs_clarification === true;
    add('L3-SNOOZE-POLICY', defaulted || asked,
      `policy requires default-10 delta (consistent basis) or a clarification question; got blocked=${o.blocked} delta=${o.snooze_delta_minutes} basis=${o.time_basis} clarify=${o.needs_clarification}`);
  }

  // free-text keyword rubric (deterministic; never exact match)
  if (exp.title_keywords && exp.title_keywords.length) {
    const hay = String(o.title || '').toLowerCase();
    const hits = exp.title_keywords.filter((k) => hay.includes(k.toLowerCase()));
    add('L3-TITLE-KEYWORDS', hits.length > 0,
      `keywords ${JSON.stringify(exp.title_keywords)}: ${hits.length}/${exp.title_keywords.length} hit in title=${JSON.stringify(o.title)}`);
  }
  if (exp.clarification_question_keywords && exp.clarification_question_keywords.length) {
    const hay = String(o.clarification_question || '').toLowerCase();
    const hits = exp.clarification_question_keywords.filter((k) => hay.includes(k.toLowerCase()));
    add('L3-QUESTION-KEYWORDS', hits.length > 0,
      `keywords ${JSON.stringify(exp.clarification_question_keywords)}: ${hits.length}/${exp.clarification_question_keywords.length} hit in question=${JSON.stringify(o.clarification_question)}`);
  }

  // time-of-day rubric (explicit / default cases)
  if (exp.time_local && o.reminder_time) {
    const d = parseIso(o.reminder_time);
    const local = d ? localHM(d) : null;
    add('L3-TIME-LOCAL', local === exp.time_local,
      `expected local time ${exp.time_local}, got ${local}`);
  }
  // day-offset rubric
  if (exp.day_offset_days !== undefined && o.reminder_time) {
    const d = parseIso(o.reminder_time);
    const now = new Date();
    const expectedDay = now.getTime() + exp.day_offset_days * 86400000;
    const dayOnly = (ms) => new Date(ms).setHours(0, 0, 0, 0);
    add('L3-DAY-OFFSET',
      Math.abs(dayOnly(d.getTime()) - dayOnly(expectedDay)) < 86400000,
      `expected day offset +${exp.day_offset_days}d from now, got ${o.reminder_time}`);
  }
  // time_must_be_null rubric
  if (exp.time_must_be_null) {
    add('L3-TIME-NULL', o.reminder_time === null,
      `expected null reminder_time, got ${JSON.stringify(o.reminder_time)}`);
  }

  const passed = checks.filter((c) => c.ok).length;
  return { score: checks.length === 0 ? 1 : passed / checks.length, checks };
}

// ---------------------------------------------------------------- run
function evaluateCase(output, caseDef, now) {
  // If the generation produced no usable object, all layers fail (L1 0,
  // L2 0, L3 0) — this keeps the aggregate formula honest without
  // inventing semantics that never happened.
  if (output === null || typeof output !== 'object' || Array.isArray(output)) {
    return {
      case_id: caseDef.id, category: caseDef.category, input: caseDef.input,
      output,
      l1: { score: 0, checks: [{ code: 'L1-IS-OBJECT', ok: false, detail: `output is ${output === null ? 'null' : typeof output}` }] },
      l2: { score: 0, checks: [{ code: 'INV-0-OUTPUT', ok: false, detail: 'output not an object' }] },
      l3: { score: 0, checks: [{ code: 'L3-OUTPUT', ok: false, detail: 'output not an object' }] },
      score: 0, l1_pass: false, l2_pass: false, l3_pass: false,
    };
  }
  const l1 = layer1(output);
  const l2 = layer2(output, { now, caseDef });
  const l3 = layer3(output, caseDef);
  const score = WEIGHTS.l1 * l1.score + WEIGHTS.l2 * l2.score + WEIGHTS.l3 * l3.score;
  return {
    case_id: caseDef.id,
    category: caseDef.category,
    input: caseDef.input,
    output,
    l1,
    l2,
    l3,
    score,
    l1_pass: l1.score === 1.0,
    l2_pass: l2.score === 1.0,
    l3_pass: l3.score === 1.0,
  };
}

function aggregate(results) {
  const mean = results.reduce((acc, r) => acc + r.score, 0) / results.length;
  const allL1 = results.every((r) => r.l1_pass);
  const allL2 = results.every((r) => r.l2_pass);
  const pass = mean >= THRESHOLD && allL1 && allL2;
  return {
    threshold: THRESHOLD,
    weights: WEIGHTS,
    mean: Math.round(mean * 1000) / 1000,
    all_l1: allL1,
    all_l2: allL2,
    pass,
    failing_cases: results
      .filter((r) => !r.l1_pass || !r.l2_pass || r.score < THRESHOLD)
      .map((r) => r.case_id),
  };
}

function findingsFor(results) {
  // Structured evidence: only what failed, ready to feed back to the agent.
  // A "failing" case = any case that did NOT fully pass L1 AND L2 AND L3,
  // even when the aggregate still clears the threshold (hard gates first,
  // quality second — spec §Evaluation Threshold).
  return results
    .filter((r) => !r.l1_pass || !r.l2_pass || !r.l3_pass)
    .map((r) => ({
      case_id: r.case_id,
      input: r.input,
      generated_output: r.output,
      score: r.score,
      failed_layers: [
        ...(r.l1_pass ? [] : [{ layer: 'L1', failed: (r.l1.checks || []).filter((c) => !c.ok).map((c) => c.code) }]),
        ...(r.l2_pass ? [] : [{ layer: 'L2', failed: (r.l2.checks || []).filter((c) => !c.ok).map((c) => c.code) }]),
        ...(!r.l3_pass ? [{ layer: 'L3', failed: (r.l3.checks || []).filter((c) => !c.ok).map((c) => c.code) }] : []),
      ],
    }));
}

module.exports = {
  layer1, layer2, layer3, evaluateCase, aggregate, findingsFor,
  THRESHOLD, WEIGHTS, parseIso, SCHEMA_PATH,
};
