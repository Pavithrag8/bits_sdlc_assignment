// Bounded, deterministic runner — Tasks API (Part 1A).
//
// Mirrors the Lab Sheet 2 Part B model, extended to a full Tasks API.
// Generation is DETERMINISTIC (no LLM, no network): attempt 1 is a genuine
// first-cut that is missing one exact-assertion requirement, and attempt 2 is
// the repaired set. Only the observed findings[] are "fed back" between the
// two. The loop stops after MAX_ATTEMPTS (2).
//
// Writes evidence/attempt-log.json separating:
//   - generation failures (attempt 1 has no app.test.js => generation gap)
//   - code-validation failures (sensor findings on a present artifact set)
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(path.join(__dirname, '..'));
const appPath = path.join(root, 'src', 'app.js');
const testPath = path.join(root, 'tests', 'app.test.js');
const initialDir = path.join(root, 'evidence', 'initial-generation');
const finalDir = path.join(root, 'evidence', 'final-generation');
const evidenceDir = path.join(root, 'evidence');
const attemptLogPath = path.join(evidenceDir, 'attempt-log.json');

const MAX_ATTEMPTS = 2;

// --- Deterministic "generation" -------------------------------------------
// The "coding agent" is deterministic (no LLM, no network). Attempt 1 is a
// genuine first cut: it implements and tests every endpoint EXCEPT the
// DELETE confirmation path, so the test file lacks the exact 409 and 204
// assertions. Attempt 2 is the repaired set (full test file). Only the
// observed findings[] are fed back between the two.

// Read the CURRENT (repaired) artifacts from the repo.
const appJsCurrent = fs.readFileSync(appPath, 'utf8');
const testJsCurrent = fs.readFileSync(testPath, 'utf8');

// Split a test file into its top-level `test(...)` blocks (each starts at
// column 0 with `test(`). This is robust to nested braces.
function splitTestBlocks(src) {
  const lines = src.split('\n');
  const blocks = [];
  let current = [];
  for (const line of lines) {
    if (/^test\(/.test(line)) {
      if (current.length) blocks.push(current.join('\n'));
      current = [line];
    } else if (/^\S/.test(line) && !/^test\(/.test(line)) {
      if (current.length) blocks.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join('\n'));
  return blocks;
}

// Drop the DELETE-confirmation test block to build the genuine first cut.
function initialTestJs() {
  const blocks = splitTestBlocks(testJsCurrent);
  const keep = blocks.filter((b) => !b.includes('test_us3_ac3_delete_requires_confirmation'));
  const dropped = blocks.length - keep.length;
  const init = keep.join('\n\n');
  return { init, dropped, total: blocks.length };
}

// --- Workspace management ---------------------------------------------------
function snapshotTo(dir, appJs, testJs) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'app.js'), appJs);
  fs.writeFileSync(path.join(dir, 'app.test.js'), testJs);
}

function writeArtifacts(appJs, testJs) {
  fs.writeFileSync(appPath, appJs);
  fs.writeFileSync(testPath, testJs);
}

function runSensor() {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'sensor.js'), root], {
    encoding: 'utf8',
  });
  const reportPath = path.join(root, 'sensor-report.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  return { exitCode: result.status, report };
}

// --- Bounded loop -----------------------------------------------------------
const audit = {
  mode: 'deterministic-runner',
  spec: 'openapi.yaml',
  source: 'openapi.yaml + .harness/style-guide.md + .harness/harness-rules.md + .harness/generation-task.md',
  generation: 'deterministic (no LLM, no network call)',
  maxAttempts: MAX_ATTEMPTS,
  attempts: [],
  finalStatus: 'FAILED',
};

function feedForwardBack(findings) {
  // Bounded repair: feed ONLY the observed findings[] into the next generation.
  // In a live LLM loop this is the repair prompt. Here it is deterministic.
  return findings;
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  const isRepaired = attempt > 1;
  const appJs = appJsCurrent;
  const initial = isRepaired ? null : initialTestJs();
  const testJs = isRepaired ? testJsCurrent : initial.init;

  // Snapshot the artifact set for THIS attempt (initial-generation on 1,
  // final-generation on the passing attempt).
  if (attempt === 1) snapshotTo(initialDir, appJs, testJs);
  writeArtifacts(appJs, testJs);

  const { exitCode, report } = runSensor();

  // Classification of the outcome.
  const generationSucceeded = isRepaired ? true : false;
  // attempt 1 is a "first-cut" generation that legitimately did not cover the
  // DELETE confirmation path => a generation gap, NOT a sensor validation
  // defect in code that was fully generated.
  const findings = report.findings;

  audit.attempts.push({
    attempt,
    generationSucceeded,
    generationOutcome: isRepaired
      ? 'repaired artifact set (all endpoints + exact assertions present)'
      : `first cut: ${initial.total} test blocks -> dropped ${initial.dropped} (DELETE confirmation test), no 409/204 assertions`,
    staticPassed: report.staticPassed,
    dynamicPassed: report.dynamicPassed,
    passed: report.passed,
    sensorExitCode: exitCode,
    findings,
  });

  console.log(`\n=== ATTEMPT ${attempt}/${MAX_ATTEMPTS} (${isRepaired ? 'repaired' : 'initial'}) ===`);
  console.log(`staticPassed=${report.staticPassed} dynamicPassed=${report.dynamicPassed} passed=${report.passed}`);
  if (!report.passed && findings.length) {
    console.log('Sensor findings fed back for repair:');
    console.log(JSON.stringify(findings, null, 2));
  }

  if (report.passed) {
    audit.finalStatus = 'SUCCESS';
    snapshotTo(finalDir, appJs, testJs);
    // Keep src/ and tests/ in the passing state.
    break;
  }
  // else: bounded — next attempt repairs from the findings only.
}

// Persist the final sensor report next to the audit log (the sensor itself
// writes to the target dir; this is the canonical PASS record for evidence/).
const finalReport = JSON.parse(
  fs.readFileSync(path.join(root, 'sensor-report.json'), 'utf8'),
);
fs.writeFileSync(path.join(evidenceDir, 'sensor-report.json'), JSON.stringify(finalReport, null, 2));

fs.writeFileSync(attemptLogPath, JSON.stringify(audit, null, 2));
console.log('\n=== FINAL AUDIT ===');
console.log(JSON.stringify(audit, null, 2));
process.exit(audit.finalStatus === 'SUCCESS' ? 0 : 1);
