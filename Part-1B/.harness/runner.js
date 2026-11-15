'use strict';

/**
 * 3-layer eval runner for the NL Reminder Agent.
 *
 * Usage (key-free, offline default):
 *   node .harness/runner.js          # full eval, writes evidence/eval-results.json
 *   node .harness/runner.js --list   # list dataset cases only
 *
 * Mirrors the Lab Sheet 2 sensor model: dataset → agent/backend call →
 * L1 → L2 → L3 → aggregate → PASS/FAIL → structured findings for repair.
 * Generation/backend failures (ServiceFailure) are classified separately
 * from evaluation failures (Lab Sheet 2 §8.5).
 */

const fs = require('fs');
const path = require('path');
const { generate, ServiceFailure } = require('../src/agent');
const { evaluateCase, aggregate, findingsFor, THRESHOLD } = require('./layers');

const ROOT = path.join(__dirname, '..');
const EVIDENCE_DIR = path.join(ROOT, 'evidence');

function loadDataset() {
  const raw = fs.readFileSync(path.join(ROOT, 'evals', 'dataset.json'), 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.cases) || data.cases.length < 15) {
    throw new Error(`dataset must have >= 15 cases, found ${data.cases ? data.cases.length : 0}`);
  }
  return data.cases;
}

async function runEval(opts = {}) {
  const backend = opts.backend || 'spawned';
  const now = new Date();
  const nowIso = now.toISOString();
  const cases = loadDataset();

  // Offline-probe line (constitution II): confirm the key-free mechanism.
  let probe = { backend, key_free: false };
  if (backend === 'spawned' && !opts.skipProbe) {
    const { SpawnedAgentBackend } = require('../src/backend');
    const agent = new SpawnedAgentBackend({});
    try {
      probe = agent.probe(nowIso);
      console.log(`[offline-probe] spawned-subagent OK: ${JSON.stringify(probe)} (no API key used, no network key required)`);
    } catch (err) {
      console.warn(`[offline-probe] spawned-subagent unavailable (${err.kind || 'error'}): ${err.message}`);
      console.warn('[offline-probe] falling back to seeded-candidate backend for this run (documented in harness-log).');
      probe = { backend: 'seeded-candidate-fallback', reason: err.message };
      process.env._P1B_USE_SEEDED = '1';
    }
  }
  const activeBackend = probe.reason ? 'seeded' : backend;

  const results = [];
  const serviceFailures = [];
  for (const c of cases) {
    let entry;
    try {
      const res = await generate(c.input, { now: nowIso, backend: activeBackend, runId: opts.runId });
      entry = evaluateCase(res.output, c, now);
      entry.backend = res.backend;
    } catch (err) {
      if (err instanceof ServiceFailure) {
        serviceFailures.push({ case_id: c.id, kind: err.kind, message: err.message });
        entry = {
          case_id: c.id, category: c.category, input: c.input,
          output: null,
          l1: { score: 0, checks: [{ code: 'L1-GENERATION', ok: false, detail: `backend failure: ${err.message}` }] },
          l2: { score: 0, checks: [{ code: 'L2-GENERATION', ok: false, detail: 'skipped: generation failed' }] },
          l3: { score: 0, checks: [{ code: 'L3-GENERATION', ok: false, detail: 'skipped: generation failed' }] },
          score: 0, l1_pass: false, l2_pass: false, l3_pass: false,
          generation_failed: true, failure_kind: err.kind,
          backend: activeBackend,
        };
      } else {
        throw err;
      }
    }
    results.push(entry);
  }

  const agg = aggregate(results);
  const report = {
    run_id: opts.runId || path.basename(process.cwd()),
    timestamp: new Date().toISOString(),
    reference_now: nowIso,
    backend: activeBackend,
    probe,
    threshold: THRESHOLD,
    scoring: { formula: 'case = 0.40*L1 + 0.40*L2 + 0.20*L3; aggregate = mean; PASS iff aggregate >= threshold AND every L1 == 1.0 AND every L2 == 1.0' },
    cases: results,
    service_failures: serviceFailures,
    aggregate: agg,
    final: agg.pass ? 'PASS' : 'FAIL',
  };
  report.findings = agg.pass ? [] : findingsFor(results);
  return report;
}

async function main() {
  const listOnly = process.argv.includes('--list');
  if (listOnly) {
    const cases = loadDataset();
    for (const c of cases) console.log(`${c.id.padEnd(8)} ${c.category.padEnd(22)} ${c.input}`);
    console.log(`\n${cases.length} cases, threshold ${THRESHOLD}`);
    return;
  }
  const opts = {};
  if (process.argv.includes('--seeded')) opts.backend = 'seeded';
  if (process.argv.includes('--skip-probe')) opts.skipProbe = true;
  const report = await runEval(opts);
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'eval-results.json'), JSON.stringify(report, null, 2));
  console.log(`\n=== EVAL SUMMARY ===`);
  console.log(`backend=${report.backend} aggregate=${report.aggregate.mean} threshold=${report.threshold} L1all=${report.aggregate.all_l1} L2all=${report.aggregate.all_l2}`);
  console.log(`FINAL: ${report.final}`);
  if (!report.final) {
    console.log('Findings (structured evidence for repair):');
    console.log(JSON.stringify(report.findings, null, 2));
  }
  if (report.service_failures.length) {
    console.log(`\nService failures (distinct from eval failures): ${JSON.stringify(report.service_failures)}`);
  }
  process.exitCode = report.final === 'PASS' ? 0 : 1;
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { runEval, loadDataset };
