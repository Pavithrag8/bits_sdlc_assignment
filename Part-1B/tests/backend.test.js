'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SeededCandidateBackend,
  LiveLLMBackend,
  ServiceFailure,
} = require('../src/backend');
const layers = require('../.harness/layers');

const NOW = '2026-11-14T11:40:59.000Z';

test('seeded fallback: destructive intent is blocked', () => {
  const b = new SeededCandidateBackend({ runId: 'unit' });
  const o = b.generate('delete all my reminders', NOW);
  assert.equal(o.intent, 'delete_all');
  assert.equal(o.blocked, true);
  assert.equal(o.reminder_time, null);
  assert.ok(o.block_reason);
});

test('seeded fallback: impossible date gets no time', () => {
  const b = new SeededCandidateBackend({ runId: 'unit' });
  const o = b.generate('remind me on 30th February', NOW);
  assert.equal(o.reminder_time, null);
  assert.ok(o.blocked || o.needs_clarification);
});

test('seeded fallback: deterministic for fixed seed', () => {
  const a = new SeededCandidateBackend({ runId: 'unit' }).generate('call Mum tomorrow', NOW);
  const b = new SeededCandidateBackend({ runId: 'unit' }).generate('call Mum tomorrow', NOW);
  assert.deepEqual(a, b);
});

test('live backend logs key_present only and classifies absence', () => {
  const b = new LiveLLMBackend({});
  const probe = b.keyProbe();
  assert.equal(probe.key_present, false); // no key in this environment by design
  assert.equal(Object.prototype.hasOwnProperty.call(probe, 'key'), false);
  return b.generate('x', NOW).then(
    () => assert.fail('should have thrown'),
    (err) => {
      assert.ok(err instanceof ServiceFailure);
      assert.equal(err.kind, 'key-missing');
    }
  );
});

test('L1 rejects a malformed shape', () => {
  const r = layers.layer1({ intent: 'destroy', confidence: 2 });
  assert.ok(r.score < 1);
  const codes = r.checks.map((c) => c.code);
  assert.ok(codes.includes('L1-INTENT-ENUM'));
});

test('L2 INV-5 flags an unblocked destructive intent', () => {
  const out = {
    intent: 'delete_all', title: null, reminder_time: null, time_basis: null,
    snooze_delta_minutes: null, needs_clarification: false,
    clarification_question: null, blocked: false, block_reason: null, confidence: 0.5,
  };
  const r = layers.layer2(out, { now: new Date(NOW), caseDef: { id: 'x', expected: {} } });
  assert.ok(r.checks.some((c) => c.code === 'INV-5-DESTRUCTIVE-BLOCKED' && !c.ok));
});
