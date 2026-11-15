// Deterministic sensor — Tasks API (Part 1A).
// Mirrors Lab Sheet 2 §5 and extends it to the full Tasks API.
// NO LLM, fully deterministic. Static checks first, then a real
// `node --test` execution. Writes sensor-report.json, exits 0/1.

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const targetDir = path.resolve(process.argv[2] || '.');
const appPath = path.join(targetDir, 'src', 'app.js');
const testPath = path.join(targetDir, 'tests', 'app.test.js');
const reportPath = path.join(targetDir, 'sensor-report.json');

function addFinding(findings, code, message) {
  findings.push({ code, message });
}

function runStaticChecks() {
  const findings = [];
  if (!fs.existsSync(appPath)) {
    addFinding(findings, 'MISSING_APP', 'src/app.js does not exist.');
  }
  if (!fs.existsSync(testPath)) {
    addFinding(findings, 'MISSING_TEST', 'tests/app.test.js does not exist.');
  }
  if (findings.length > 0) return findings;

  const appCode = fs.readFileSync(appPath, 'utf8');
  const testCode = fs.readFileSync(testPath, 'utf8');

  // Exact-assertion requirement (Constitution II / harness-rules #8, #9):
  // the test file MUST assert every status the contract declares, exactly.
  const requiredTestPatterns = [
    { code: 'MISSING_ROUTE_TEST', regex: /POST\s+\/tasks|method\s*:\s*['"]POST['"]|request\(port,\s*['"]POST['"]/, message: 'tests/app.test.js does not visibly exercise POST /tasks.' },
    { code: 'MISSING_201_ASSERTION', regex: /assert\.strictEqual\(response\.status,\s*201\);/, message: 'Missing exact assertion: assert.strictEqual(response.status, 201);' },
    { code: 'MISSING_200_ASSERTION', regex: /assert\.strictEqual\(response\.status,\s*200\);/, message: 'Missing exact assertion: assert.strictEqual(response.status, 200);' },
    { code: 'MISSING_400_ASSERTION', regex: /assert\.strictEqual\(response\.status,\s*400\);/, message: 'Missing exact assertion: assert.strictEqual(response.status, 400);' },
    { code: 'MISSING_404_ASSERTION', regex: /assert\.strictEqual\(response\.status,\s*404\);/, message: 'Missing exact assertion: assert.strictEqual(response.status, 404);' },
    { code: 'MISSING_409_ASSERTION', regex: /assert\.strictEqual\(response\.status,\s*409\);/, message: 'Missing exact assertion: assert.strictEqual(response.status, 409);' },
    { code: 'MISSING_204_ASSERTION', regex: /assert\.strictEqual\(response\.status,\s*204\);/, message: 'Missing exact assertion: assert.strictEqual(response.status, 204);' },
    { code: 'BROAD_ASSERTION_FORBIDDEN', regex: /status\s*(?:>=|>)\s*400/, message: 'Forbidden broad assertion (status >= 400) detected; use an exact assert.strictEqual.' },
  ];
  for (const rule of requiredTestPatterns) {
    const found = rule.regex.test(testCode);
    // BROAD_ASSERTION_FORBIDDEN is inverted: it FAILs when present.
    if (rule.code === 'BROAD_ASSERTION_FORBIDDEN') {
      if (found) addFinding(findings, rule.code, rule.message);
    } else if (!found) {
      addFinding(findings, rule.code, rule.message);
    }
  }

  // Contract-completeness patterns (the implementation must visibly cover
  // every route + confirmation header the contract declares).
  const requiredAppPatterns = [
    { code: 'ROUTE_POST_TASKS', regex: /['"]\/tasks['"]/, message: 'src/app.js does not visibly handle POST /tasks.' },
    { code: 'ROUTE_GET_BY_ID', regex: /\/tasks\/([^/']+)|\btasks\/[\{]/, message: 'src/app.js does not visibly route /tasks/{id}.' },
    { code: 'ROUTE_OVERDUE', regex: /overdue/, message: 'src/app.js does not visibly implement GET /tasks/overdue.' },
    { code: 'DELETE_409_CONFIRM', regex: /409/, message: 'src/app.js does not visibly return 409 for an unconfirmed DELETE.' },
    { code: 'DELETE_204', regex: /204/, message: 'src/app.js does not visibly return 204 for a confirmed DELETE.' },
    { code: 'CONFIRM_HEADER', regex: /X-Confirm/i, message: 'src/app.js does not visibly read the X-Confirm header (delete confirmation).' },
    { code: 'STATUS_FILTER', regex: /status/, message: 'src/app.js does not visibly support ?status= filtering.' },
  ];
  for (const rule of requiredAppPatterns) {
    if (!rule.regex.test(appCode)) addFinding(findings, rule.code, rule.message);
  }

  if (!/module\.exports\s*=/.test(appCode)) {
    addFinding(findings, 'SERVER_NOT_EXPORTED', 'src/app.js must export the server (module.exports =).');
  }
  if (!/['"]Content-Type['"]\s*:\s*['"]application\/json['"]/.test(appCode) &&
      !/Content-Type['"]?\s*,?\s*['"]application\/json/.test(appCode)) {
    addFinding(findings, 'JSON_HEADER_NOT_VISIBLE', 'src/app.js does not visibly set Content-Type to application/json.');
  }
  if (!/require\.main\s*===\s*module/.test(appCode)) {
    addFinding(findings, 'LISTENS_WHEN_DIRECT_ONLY', 'src/app.js must only listen when run directly (require.main === module), so tests can bind an ephemeral port.');
  }
  if (!/finally\s*{/m.test(testCode)) {
    addFinding(findings, 'SERVER_NOT_CLOSED_IN_FINALLY', 'tests/app.test.js must close the server in a finally block so the dynamic check can exit cleanly.');
  }
  return findings;
}

function runDynamicChecks() {
  if (!fs.existsSync(testPath)) {
    return {
      passed: false,
      exitCode: null,
      stdout: '',
      stderr: 'Dynamic checks skipped because tests/app.test.js is missing.',
    };
  }
  const result = spawnSync(
    process.execPath,
    ['--test', 'tests/app.test.js'],
    { cwd: targetDir, encoding: 'utf8', timeout: 30000 },
  );
  return {
    passed: result.status === 0,
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

const staticFindings = runStaticChecks();
const dynamic =
  staticFindings.length === 0
    ? runDynamicChecks()
    : {
        passed: false,
        exitCode: null,
        stdout: '',
        stderr: 'Dynamic checks skipped until static findings are resolved.',
      };

const report = {
  targetDir,
  checkedAt: new Date().toISOString(),
  staticPassed: staticFindings.length === 0,
  dynamicPassed: dynamic.passed,
  passed: staticFindings.length === 0 && dynamic.passed,
  findings: staticFindings,
  testExecution: dynamic,
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.passed ? 0 : 1);
