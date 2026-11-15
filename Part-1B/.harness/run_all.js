'use strict';

/**
 * Single-command bounded evaluation loop (Lab Sheet 2 model).
 *
 *   node .harness/run_all.js
 *
 * Flow:
 *   1. snapshot the current generation to evidence/<snapshot>/ (code + prompt)
 *   2. run the 3-layer eval (runner.js)
 *   3. on FAIL: record structured findings in the attempt log; a repair step
 *      is expected to fix parser/prompt/guardrail ONLY (never cases,
 *      threshold, or guards); loop re-runs the eval, max 2 attempts.
 *   4. write evidence/attempt-log.json separating generation/backend
 *      failures from evaluation failures (Lab Sheet 2 §8.5) and
 *      evidence/eval-results.json (last eval state).
 *
 * Flags:
 *   --snapshot initial|final     write evidence/<name>-generation/ snapshot
 *   --no-repair                  single eval, no repair loop
 *   --seeded                     force seeded-candidate backend (fallback path)
 *   --expect-initial-fail        (used when documenting the genuine defect)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EVIDENCE = path.join(ROOT, 'evidence');
const { runEval, loadDataset } = require('./runner');

function snapshot(name) {
  const dest = path.join(EVIDENCE, `${name}-generation`);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const p of ['src/agent.js', 'src/backend.js', 'prompts/system.md']) {
    const src = path.join(ROOT, p);
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.join(dest, path.dirname(p)), { recursive: true });
      fs.copyFileSync(src, path.join(dest, p));
    }
  }
  const schema = path.join(ROOT, '.harness', 'schema', 'reminder-output.schema.json');
  fs.mkdirSync(path.join(dest, '.harness', 'schema'), { recursive: true });
  fs.copyFileSync(schema, path.join(dest, '.harness', 'schema', 'reminder-output.schema.json'));
  fs.writeFileSync(
    path.join(dest, 'SNAPSHOT.md'),
    `Snapshot: ${name}\nGenerated: ${new Date().toISOString()}\n\n` +
    `Contains the source + prompt as generated at this point of the repair cycle.\n`
  );
  console.log(`[snapshot] ${name} -> ${path.relative(ROOT, dest)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const noRepair = args.includes('--no-repair');
  const seeded = args.includes('--seeded');
  const snapshotName = args.find((a) => a === 'initial' || a === 'final');

  fs.mkdirSync(EVIDENCE, { recursive: true });
  if (snapshotName) snapshot(snapshotName);

  const MAX_ATTEMPTS = 2;
  const log = {
    mode: seeded ? 'seeded-candidate-offline' : 'spawned-subagent-offline',
    reference_now: new Date().toISOString(),
    max_attempts: MAX_ATTEMPTS,
    scoring: {
      weights: { l1: 0.4, l2: 0.4, l3: 0.2 },
      threshold: 0.90,
      rule: 'aggregate = mean(case 0.40*L1 + 0.40*L2 + 0.20*L3); PASS iff aggregate >= 0.90 AND all L1 == 1.0 AND all L2 == 1.0',
      declared_in: '.specify/specs/001-reminder-agent/spec.md §Evaluation Threshold (before evaluation)',
    },
    attempts: [],
    final_status: 'FAILED',
  };

  let lastReport = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    console.log(`\n=== ATTEMPT ${attempt} of ${MAX_ATTEMPTS} ${noRepair ? '(no-repair mode)' : ''} ===`);
    let report;
    try {
      report = await runEval({ backend: seeded ? 'seeded' : 'spawned', runId: `attempt-${attempt}`, skipProbe: attempt > 1 });
    } catch (err) {
      // A runner-level crash is a generation/backend failure, not an eval result.
      log.attempts.push({
        attempt,
        generation_succeeded: false,
        failure_kind: 'runner-error',
        error: String(err && err.message || err),
      });
      break;
    }
    lastReport = report;
    const summary = {
      attempt,
      backend: report.backend,
      generation_succeeded: report.service_failures.length === 0,
      service_failures: report.service_failures,
      aggregate: report.aggregate.mean,
      threshold: report.threshold,
      all_l1: report.aggregate.all_l1,
      all_l2: report.aggregate.all_l2,
      final: report.final,
      failing_cases: report.aggregate.failing_cases,
      eval_failures: report.findings || [],
    };
    log.attempts.push(summary);
    fs.writeFileSync(path.join(EVIDENCE, `eval-results-attempt-${attempt}.json`),
      JSON.stringify(report, null, 2));

    if (report.final === 'PASS') {
      log.final_status = 'SUCCESS';
      log.success_attempt = attempt;
      break;
    }
    if (noRepair || attempt === MAX_ATTEMPTS) break;
    console.log('Eval FAILed. Structured findings (feed ONLY these back to the coding agent):');
    console.log(JSON.stringify(report.findings, null, 2));
    console.log('Repair step expected: fix parser/prompt/guardrail in src/ + prompts/ ' +
      '(never the dataset, threshold, or guards), then re-run.');
  }

  fs.writeFileSync(path.join(EVIDENCE, 'attempt-log.json'), JSON.stringify(log, null, 2));
  if (lastReport) {
    fs.writeFileSync(path.join(EVIDENCE, 'eval-results.json'), JSON.stringify(lastReport, null, 2));
  }
  console.log(`\n=== FINAL: ${log.final_status} ===`);
  console.log(JSON.stringify(log, null, 2));
  process.exitCode = log.final_status === 'SUCCESS' ? 0 : 1;
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { snapshot };
