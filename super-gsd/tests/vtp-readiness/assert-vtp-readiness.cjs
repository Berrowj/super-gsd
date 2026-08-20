#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const registryPath = path.join(repoRoot, 'super-gsd', 'registry', 'vtp-services.yaml');
const loaderPath = path.join(repoRoot, 'super-gsd', 'tools', 'vtp-readiness', 'registry.cjs');
const runnerPath = path.join(repoRoot, 'super-gsd', 'tools', 'vtp-readiness', 'run.cjs');
const orchestratorHooksPath = path.join(
  repoRoot, 'super-gsd', 'scripts', 'lib', 'orchestrator-hooks.cjs');
const orchestrateSkillPath = path.join(
  repoRoot, 'super-gsd', 'skills', 'sgsd-orchestrate', 'SKILL.md');
const readinessSkillPath = path.join(
  repoRoot, 'super-gsd', 'skills', 'sgsd-readiness', 'SKILL.md');
const milestoneAgentPath = path.join(
  repoRoot, 'super-gsd', 'agents', 'sgsd-milestone-readiness.md');
const phaseAgentPath = path.join(
  repoRoot, 'super-gsd', 'agents', 'sgsd-phase-readiness.md');
const requested = argument('--case') || 'all';
const requestedEntrypoint = argument('--entrypoint');
const supportedCases = [
  'registry-contract',
  'readiness-entrypoints',
  'readiness-entrypoints-green',
  'readiness-entrypoints-degraded',
];

let passed = 0;
let total = 0;
const failures = [];

function argument(flag) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? null : process.argv[index + 1];
}

function check(name, condition, detail = '') {
  total += 1;
  if (condition) {
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
    return;
  }
  failures.push(`${name}${detail ? `: ${detail}` : ''}`);
  process.stdout.write(`FAIL ${name}${detail ? ` (${detail})` : ''}\n`);
}

function equal(name, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    check(name, true);
  } catch (_error) {
    check(name, false, 'values differ');
  }
}

function replaceOnce(source, expected, replacement) {
  const index = source.indexOf(expected);
  assert.notStrictEqual(index, -1, `fixture seam missing: ${expected}`);
  assert.strictEqual(source.indexOf(expected, index + expected.length), -1,
    `fixture seam is not unique: ${expected}`);
  return source.slice(0, index) + replacement + source.slice(index + expected.length);
}

function captureLoad(loadRegistry, options) {
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  let stdout = '';
  let stderr = '';
  process.stdout.write = function captureStdout(chunk) {
    stdout += String(chunk);
    return true;
  };
  process.stderr.write = function captureStderr(chunk) {
    stderr += String(chunk);
    return true;
  };
  try {
    return { value: loadRegistry(options), stdout, stderr };
  } catch (error) {
    return { error, stdout, stderr };
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
  }
}

function rejectedSurface(error) {
  if (!error) return '';
  return [error.name, error.code, error.message, JSON.stringify(error)]
    .filter(Boolean).join(' ');
}

function withEnvironment(overrides, callback) {
  const prior = new Map();
  for (const [name, value] of Object.entries(overrides)) {
    prior.set(name, {
      present: Object.prototype.hasOwnProperty.call(process.env, name),
      value: process.env[name],
    });
    process.env[name] = value;
  }
  try {
    return callback();
  } finally {
    for (const [name, saved] of prior) {
      if (saved.present) process.env[name] = saved.value;
      else delete process.env[name];
    }
  }
}

function expectRejected(loadRegistry, tempDir, productionSource, fixture) {
  const badPath = path.join(tempDir, `${fixture.label}.yaml`);
  const badSource = fixture.mutate(productionSource);
  fs.writeFileSync(badPath, badSource, 'utf8');
  const result = captureLoad(loadRegistry, {
    registryPath: badPath,
    homeDir: path.join(tempDir, 'fake-home'),
  });
  const surface = rejectedSurface(result.error) + result.stdout + result.stderr;
  check(`${fixture.label} is rejected with stable reason code`,
    Boolean(result.error) && result.error.code === fixture.reason,
    result.error ? 'reason mismatch' : 'registry was accepted');
  check(`${fixture.label} does not echo rejected value`, !surface.includes(fixture.sentinel));
}

function scrubbedEnvironment(fakeHome, overrides = {}) {
  const allowedHostNames = [
    'SystemRoot', 'WINDIR', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP',
  ];
  const environment = {};
  for (const name of allowedHostNames) {
    if (Object.prototype.hasOwnProperty.call(process.env, name)) {
      environment[name] = process.env[name];
    }
  }
  environment.HOME = fakeHome;
  environment.USERPROFILE = fakeHome;
  return Object.assign(environment, overrides);
}

function runNode(scriptPath, args, options) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const child = childProcess.spawn(process.execPath, [scriptPath].concat(args || []), {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      shell: false,
    });
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', (error) => resolve({ status: null, stdout, stderr, error }));
    child.on('close', (status) => resolve({ status, stdout, stderr, error: null }));
  });
}

function parseJsonOutput(label, result) {
  try {
    return JSON.parse(String(result.stdout || '').trim());
  } catch (_error) {
    check(label, false, 'stdout was not one JSON document');
    return null;
  }
}

function createFixture(root, label, options) {
  const fakeHome = path.join(root, `${label}-home-SENTINEL`);
  const projectDir = path.join(root, `${label}-project-SENTINEL`);
  const sourceDir = path.join(fakeHome, 'Voice-Text-Plan', 'src');
  const cliEntry = path.join(fakeHome, 'Voice-Text-Plan', 'dist', 'cli.js');
  const evidenceTarget = path.join(fakeHome, `${label}-evidence-SENTINEL.sqlite`);
  fs.mkdirSync(path.join(sourceDir, 'nested'), { recursive: true });
  fs.mkdirSync(path.dirname(cliEntry), { recursive: true });
  fs.mkdirSync(path.join(projectDir, '.planning', 'metrics'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, '.planning', 'STATE.md'), [
    '---',
    'phase: 157',
    'milestone: fixture-vtp-readiness',
    '---',
    '',
  ].join(String.fromCharCode(10)), 'utf8');
  fs.writeFileSync(path.join(sourceDir, 'nested', 'source.ts'), 'fixture source\n', 'utf8');
  fs.writeFileSync(cliEntry, 'fixture dist\n', 'utf8');
  const nowSeconds = Date.now() / 1000;
  const sourceTime = options.fresh ? nowSeconds - 20 : nowSeconds;
  const distTime = options.fresh ? nowSeconds : nowSeconds - 20;
  fs.utimesSync(path.join(sourceDir, 'nested', 'source.ts'), sourceTime, sourceTime);
  fs.utimesSync(cliEntry, distTime, distTime);
  if (options.evidence === 'file') {
    fs.writeFileSync(evidenceTarget, 'fixture evidence\n', 'utf8');
  } else if (options.evidence === 'directory') {
    fs.mkdirSync(evidenceTarget, { recursive: true });
  }
  return {
    fakeHome,
    projectDir,
    planningDir: path.join(projectDir, '.planning'),
    evidenceTarget,
  };
}

function replaceDistWithOutsideDirectoryLink(root, fixture) {
  const vtpRoot = path.join(fixture.fakeHome, 'Voice-Text-Plan');
  const distLink = path.join(vtpRoot, 'dist');
  const outsideDist = path.join(root, 'outside-dist-SENTINEL');
  const outsideCli = path.join(outsideDist, 'cli.js');
  fs.rmSync(distLink, { recursive: true, force: true });
  fs.mkdirSync(outsideDist, { recursive: true });
  fs.writeFileSync(outsideCli, 'outside fixture dist\n', 'utf8');
  const nowSeconds = Date.now() / 1000;
  fs.utimesSync(outsideCli, nowSeconds, nowSeconds);
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';
  try {
    fs.symlinkSync(outsideDist, distLink, linkType);
  } catch (error) {
    const reason = error && (error.code || error.message)
      ? String(error.code || error.message) : 'unknown_error';
    throw new Error(`ancestor-symlink fixture creation failed (${linkType}): ${reason}`);
  }
  return { distLink, outsideDist };
}

async function openListener() {
  let connections = 0;
  const server = net.createServer((socket) => {
    connections += 1;
    socket.end();
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    port: server.address().port,
    connections: () => connections,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function unusedTcpPort() {
  const listener = await openListener();
  const port = listener.port;
  await listener.close();
  return port;
}

function fixtureEnvironment(fixture, qdrantUrl, evidenceUrl, extra = {}) {
  return scrubbedEnvironment(fixture.fakeHome, Object.assign({
    QDRANT_URL: qdrantUrl,
    VTP_EVIDENCE_STORE_URL: evidenceUrl,
  }, extra));
}

function exactRuleZeroCommand() {
  const quote = String.fromCharCode(34);
  return 'node super-gsd/tools/vtp-readiness/run.cjs --trigger auto --project-dir '
    + quote + '{project_dir}' + quote;
}

function checkStaticEntrypoints() {
  const orchestrate = fs.readFileSync(orchestrateSkillPath, 'utf8');
  const exactAuto = exactRuleZeroCommand();
  const commandIndex = orchestrate.indexOf(exactAuto);
  const classificationIndex = orchestrate.indexOf('Behavior by manifest status:');
  check('Rule 0 contains the exact automatic VTP readiness command', commandIndex >= 0);
  check('Rule 0 runs VTP readiness before manifest classification',
    commandIndex >= 0 && classificationIndex >= 0 && commandIndex < classificationIndex);
  check('Rule 0 runner target exists', fs.existsSync(runnerPath));

  const readinessSkill = fs.readFileSync(readinessSkillPath, 'utf8');
  check('manual readiness uses production on-demand routing consult',
    readinessSkill.includes('orchestrator-hooks.cjs --skill-routing-consult')
      && readinessSkill.includes('--moment on-demand')
      && readinessSkill.includes('--mode manual')
      && readinessSkill.includes('--execute'));
  check('manual readiness feeds routed PROBE LOG rows to the manifest consumer',
    readinessSkill.indexOf('orchestrator-hooks.cjs --skill-routing-consult')
        < readinessSkill.indexOf('Agent(')
      && /Consume the supplied three VTP PROBE LOG rows/i.test(readinessSkill));

  const milestoneAgent = fs.readFileSync(milestoneAgentPath, 'utf8');
  const phaseAgent = fs.readFileSync(phaseAgentPath, 'utf8');
  check('milestone readiness consumes three VTP PROBE LOG rows',
    /three VTP PROBE LOG rows/i.test(milestoneAgent)
      && /do not (?:copy|reimplement|re-implement) (?:the )?VTP probes/i.test(milestoneAgent));
  check('phase readiness reuses the VTP runner for drift',
    phaseAgent.includes('tools/vtp-readiness/run.cjs --trigger semi')
      && /three VTP PROBE LOG rows/i.test(phaseAgent));
}

function payloadResults(payload) {
  return payload && Array.isArray(payload.results) ? payload.results : [];
}

function validatePayload(label, payload, expectedTrigger, expectedAggregate) {
  check(`${label} emits one limited JSON object`, Boolean(payload)
    && JSON.stringify(Object.keys(payload).sort()) === JSON.stringify(['results', 'status', 'trigger']));
  if (!payload) return;
  equal(`${label} reports trigger`, payload.trigger, expectedTrigger);
  equal(`${label} reports aggregate status`, payload.status, expectedAggregate);
  const results = payloadResults(payload);
  equal(`${label} reports exactly three probe ids`, results.map((row) => row.probe_id), [
    'dist_freshness', 'qdrant_tcp', 'evidence_store',
  ]);
  check(`${label} probe rows use only allowed fields`, results.every((row) => {
    const allowed = new Set(['probe_id', 'status', 'env_name', 'reason_code']);
    return Object.keys(row).every((key) => allowed.has(key));
  }));
  check(`${label} probe rows use stable statuses and reason codes`,
    results.every((row) => ['pass', 'warn', 'error'].includes(row.status)
      && /^[a-z0-9_]+$/.test(row.reason_code)));
  check(`${label} environment probes name env vars only`,
    results[0] && !Object.prototype.hasOwnProperty.call(results[0], 'env_name')
      && results[1] && results[1].env_name === 'QDRANT_URL'
      && results[2] && results[2].env_name === 'VTP_EVIDENCE_STORE_URL');
}

function manualReadinessDecision(payload) {
  return payload && Array.isArray(payload.decisions)
    ? payload.decisions.find((row) => row.skill === 'sgsd-readiness')
    : null;
}

function manualArgs(fixture) {
  return [
    '--skill-routing-consult',
    '--moment', 'on-demand',
    '--mode', 'manual',
    '--phase', '157',
    '--milestone', 'fixture-vtp-readiness',
    '--project-dir', fixture.projectDir,
    '--planning-dir', fixture.planningDir,
    '--execute',
    '--json',
  ];
}

function readLedgerRows(planningDir) {
  const metricsDir = path.join(planningDir, 'metrics');
  if (!fs.existsSync(metricsDir)) return [];
  const rows = [];
  for (const entry of fs.readdirSync(metricsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
    const source = fs.readFileSync(path.join(metricsDir, entry.name), 'utf8');
    for (const line of source.split(/\r?\n/).filter(Boolean)) {
      rows.push({ file: entry.name, value: JSON.parse(line) });
    }
  }
  return rows;
}

function collectScalarStrings(value, output = []) {
  if (typeof value === 'string') {
    output.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectScalarStrings(item, output);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectScalarStrings(item, output);
  }
  return output;
}

function containsKey(value, key) {
  if (Array.isArray(value)) return value.some((item) => containsKey(item, key));
  if (!value || typeof value !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(value, key)) return true;
  return Object.values(value).some((item) => containsKey(item, key));
}

function leakScan(label, cliResult, fixture, sentinels) {
  const ledgerRows = readLedgerRows(fixture.planningDir);
  check(`${label} appends manual evidence rows`, ledgerRows.length > 0);
  let cliPayload = null;
  try {
    cliPayload = JSON.parse(String(cliResult.stdout || '').trim());
  } catch (_error) {
    cliPayload = null;
  }
  const cliScalars = collectScalarStrings(cliPayload)
    .concat(String(cliResult.stderr || ''));
  const rowScalars = ledgerRows.map((row) => collectScalarStrings(row.value));
  const leaks = [
    fixture.projectDir, fixture.fakeHome, fixture.evidenceTarget,
    repoRoot, process.execPath,
  ]
    .concat(sentinels || []).filter(Boolean);
  check(`${label} CLI JSON redacts paths, values, addresses, and raw errors`,
    leaks.every((value) =>
      cliScalars.every((scalar) => !scalar.includes(String(value)))));
  check(`${label} every appended row redacts paths, values, addresses, and raw errors`,
    rowScalars.every((scalars) => leaks.every((value) =>
      scalars.every((scalar) => !scalar.includes(String(value))))));
  check(`${label} omits dispatch.cwd from CLI JSON and every appended row`,
    !containsKey(cliPayload, 'cwd')
      && ledgerRows.every((row) => !containsKey(row.value, 'cwd')));
}

async function runAutomaticFixture(fixture, environment) {
  return runNode(runnerPath, [
    '--trigger', 'auto', '--project-dir', fixture.projectDir,
  ], { cwd: repoRoot, env: environment });
}

async function runManualFixture(fixture, environment) {
  return runNode(orchestratorHooksPath, manualArgs(fixture), {
    cwd: repoRoot,
    env: environment,
  });
}

async function manualRedProbe() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtp-readiness-red-manual-'));
  try {
    const fixture = createFixture(tempDir, 'manual-red', {
      fresh: false, evidence: 'missing',
    });
    const result = await runManualFixture(
      fixture, scrubbedEnvironment(fixture.fakeHome));
    const payload = parseJsonOutput('manual red probe returns JSON', result);
    const readiness = manualReadinessDecision(payload);
    check('production on-demand/manual/execute readiness route fires a dispatch',
      Boolean(readiness) && readiness.decision === 'fired' && Boolean(readiness.execution),
      readiness ? `decision=${readiness.decision}` : 'readiness route absent');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function readinessGreen() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtp-readiness-green-'));
  const listener = await openListener();
  try {
    const autoFixture = createFixture(tempDir, 'auto-green', {
      fresh: true, evidence: 'file',
    });
    const manualFixture = createFixture(tempDir, 'manual-green', {
      fresh: true, evidence: 'directory',
    });
    const qdrantSentinel = `tcp://127.0.0.1:${listener.port}/SENTINEL_QDRANT_GREEN`;
    const autoEvidence = pathToFileURL(autoFixture.evidenceTarget).href;
    const manualEvidence = pathToFileURL(manualFixture.evidenceTarget).href;
    const autoResult = await runAutomaticFixture(autoFixture,
      fixtureEnvironment(autoFixture, qdrantSentinel, autoEvidence));
    const autoPayload = parseJsonOutput('Rule 0 green output parses', autoResult);
    equal('Rule 0 green exits 0', autoResult.status, 0);
    validatePayload('Rule 0 green', autoPayload, 'auto', 'ready');
    check('Rule 0 green output is silent on stderr', autoResult.stderr === '');

    const manualResult = await runManualFixture(manualFixture,
      fixtureEnvironment(manualFixture, qdrantSentinel, manualEvidence));
    const manualPayload = parseJsonOutput('manual green consult output parses', manualResult);
    const readiness = manualReadinessDecision(manualPayload);
    check('manual green traverses canonical routing and real dispatch',
      manualResult.status === 0 && readiness && readiness.decision === 'fired'
        && readiness.execution && readiness.execution.decision === 'executed');
    let runnerPayload = null;
    try {
      runnerPayload = readiness && readiness.execution
        ? JSON.parse(readiness.execution.stdout_excerpt) : null;
    } catch (_error) {
      runnerPayload = null;
    }
    validatePayload('manual green', runnerPayload, 'manual', 'ready');
    check('each green runner makes exactly one TCP connection', listener.connections() === 2,
      `connections=${listener.connections()}`);
    leakScan('manual green', manualResult, manualFixture, [
      qdrantSentinel, '127.0.0.1', String(listener.port),
      manualEvidence, 'SENTINEL_QDRANT_GREEN',
    ]);
  } finally {
    await listener.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function readinessDegraded() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtp-readiness-degraded-'));
  try {
    const port = await unusedTcpPort();
    const autoFixture = createFixture(tempDir, 'auto-degraded', {
      fresh: false, evidence: 'missing',
    });
    const manualFixture = createFixture(tempDir, 'manual-degraded', {
      fresh: false, evidence: 'missing',
    });
    const qdrantSentinel =
      `http://127.0.0.1:${port}/SENTINEL_QDRANT_DEGRADED?credential=SECRET`;
    const autoEvidence = pathToFileURL(autoFixture.evidenceTarget).href;
    const manualEvidence = pathToFileURL(manualFixture.evidenceTarget).href;
    const autoResult = await runAutomaticFixture(autoFixture,
      fixtureEnvironment(autoFixture, qdrantSentinel, autoEvidence));
    const autoPayload = parseJsonOutput('Rule 0 degraded output parses', autoResult);
    equal('Rule 0 degraded exits 1', autoResult.status, 1);
    validatePayload('Rule 0 degraded', autoPayload, 'auto', 'degraded');
    const autoRows = payloadResults(autoPayload);
    check('stale freshness warns to reconnect MCP and never rebuild',
      autoRows[0] && autoRows[0].status === 'warn'
        && autoRows[0].reason_code === 'dist_stale_reconnect_mcp'
        && !JSON.stringify(autoPayload).toLowerCase().includes('rebuild'));
    check('unreachable Qdrant and absent evidence are findings',
      autoRows.slice(1).every((row) => row.status === 'warn'));

    const manualResult = await runManualFixture(manualFixture,
      fixtureEnvironment(manualFixture, qdrantSentinel, manualEvidence));
    const manualPayload = parseJsonOutput('manual degraded consult output parses', manualResult);
    const readiness = manualReadinessDecision(manualPayload);
    check('manual degraded keeps exit 1 as a findings verdict',
      manualResult.status === 0 && readiness && readiness.decision === 'fired'
        && readiness.execution
        && readiness.execution.decision === 'executed_with_findings'
        && readiness.execution.exit_code === 1);
    let runnerPayload = null;
    try {
      runnerPayload = readiness && readiness.execution
        ? JSON.parse(readiness.execution.stdout_excerpt) : null;
    } catch (_error) {
      runnerPayload = null;
    }
    validatePayload('manual degraded', runnerPayload, 'manual', 'degraded');
    equal('automatic and manual degraded probes report identical results',
      runnerPayload && runnerPayload.results, autoPayload && autoPayload.results);
    leakScan('manual degraded', manualResult, manualFixture, [
      qdrantSentinel, '127.0.0.1', String(port), manualEvidence,
      'SENTINEL_QDRANT_DEGRADED', 'SECRET',
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function readinessAncestorSymlinkContainment() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtp-readiness-ancestor-link-'));
  const listener = await openListener();
  try {
    const fixture = createFixture(tempDir, 'ancestor-link', {
      fresh: true, evidence: 'file',
    });
    const linked = replaceDistWithOutsideDirectoryLink(tempDir, fixture);
    const qdrantSentinel =
      `tcp://127.0.0.1:${listener.port}/SENTINEL_QDRANT_ANCESTOR_LINK`;
    const evidenceUrl = pathToFileURL(fixture.evidenceTarget).href;
    const runResult = await runAutomaticFixture(fixture,
      fixtureEnvironment(fixture, qdrantSentinel, evidenceUrl));
    const payload = parseJsonOutput('ancestor-link output parses', runResult);
    equal('ancestor-linked dist is rejected with a finding exit', runResult.status, 1);
    validatePayload('ancestor-linked dist', payload, 'auto', 'degraded');
    const results = payloadResults(payload);
    check('ancestor-linked dist is rejected by stable containment reason',
      results[0] && results[0].status === 'warn'
        && results[0].reason_code === 'freshness_path_outside_vtp_root');
    check('ancestor-link fixture isolates freshness from the other probes',
      results.slice(1).every((row) => row.status === 'pass'));
    const outputSurface = String(runResult.stdout || '') + String(runResult.stderr || '');
    check('ancestor-link rejection does not disclose filesystem paths',
      !outputSurface.includes(linked.distLink)
        && !outputSurface.includes(linked.outsideDist)
        && !outputSurface.includes(fixture.fakeHome));
  } finally {
    await listener.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function readinessSpawnErrorRedaction() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtp-readiness-spawn-redaction-'));
  try {
    const fixture = createFixture(tempDir, 'manual-spawn-error', {
      fresh: true, evidence: 'file',
    });
    const preloadPath = path.join(tempDir, 'deny-spawn.cjs');
    const rawSpawn = 'RAW_SPAWN_ERROR_SENTINEL_EPERM';
    const rawChild = 'RAW_CHILD_ERROR_SENTINEL_PRIVATE_PATH';
    const preloadSource = [
      '\'use strict\';',
      'const childProcess = require(\'child_process\');',
      'childProcess.spawnSync = function deniedSpawn() {',
      '  const error = new Error(\'RAW_SPAWN_ERROR_SENTINEL_EPERM\');',
      '  error.code = \'EPERM\';',
      '  return { status: null, stdout: \'RAW_CHILD_ERROR_SENTINEL_PRIVATE_PATH\',',
      '    stderr: \'RAW_CHILD_ERROR_SENTINEL_PRIVATE_PATH\', error };',
      '};',
      '',
    ].join(String.fromCharCode(10));
    fs.writeFileSync(preloadPath, preloadSource, 'utf8');
    const result = await runManualFixture(fixture,
      scrubbedEnvironment(fixture.fakeHome, {
        NODE_OPTIONS: '--require=' + preloadPath,
      }));
    const payload = parseJsonOutput('manual spawn-error consult output parses', result);
    const readiness = manualReadinessDecision(payload);
    check('manual spawn denial fails loud with a stable execution error',
      readiness && readiness.execution
        && readiness.execution.decision === 'execution_failed'
        && readiness.execution.exit_code === 126
        && readiness.execution.stderr_excerpt === 'dispatch_spawn_failed');
    leakScan('manual spawn-error', result, fixture, [rawSpawn, rawChild, preloadPath]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function readinessEntrypoints() {
  if (requestedEntrypoint === 'rule0') {
    checkStaticEntrypoints();
    return;
  }
  if (requestedEntrypoint === 'manual') {
    await manualRedProbe();
    return;
  }
  checkStaticEntrypoints();
  await readinessGreen();
  await readinessDegraded();
  await readinessAncestorSymlinkContainment();
  await readinessSpawnErrorRedaction();
}

function registryContract() {
  const missing = [registryPath, loaderPath].filter((file) => !fs.existsSync(file));
  if (missing.length) {
    check('VTP registry and loader exist', false,
      missing.map((file) => path.relative(repoRoot, file)).join(', '));
    return;
  }

  const { loadRegistry } = require(loaderPath);
  check('loader exports loadRegistry', typeof loadRegistry === 'function');
  const pinnedYamlLoaded = Object.keys(require.cache).some((file) =>
    /plan-schema[\\/]node_modules[\\/]js-yaml[\\/]/.test(file));
  check('loader uses the pinned plan-schema js-yaml', pinnedYamlLoaded);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtp-registry-contract-'));
  try {
    const fakeHome = path.join(tempDir, 'fake-home');
    fs.mkdirSync(fakeHome, { recursive: true });
    const environmentNames = [
      'QDRANT_URL',
      'VTP_EMBED_PYTHON',
      'VTP_EVIDENCE_STORE_URL',
      'CLARITY_MONGO_URI',
      'CLARITY_MONGO_DB',
      'CLARITY_ES_URL',
    ];
    const fakeEnvironment = Object.fromEntries(environmentNames.map((name, index) => [
      name, ['SENTINEL', 'ENV', String(index)].join('_'),
    ]));
    const loadedResult = withEnvironment(fakeEnvironment,
      () => captureLoad(loadRegistry, { registryPath, homeDir: fakeHome }));
    check('production registry loads', !loadedResult.error);
    check('production registry load is silent',
      loadedResult.stdout === '' && loadedResult.stderr === '');
    if (loadedResult.error) return;

    const registry = loadedResult.value;
    const loadedSurface = JSON.stringify(registry) + loadedResult.stdout + loadedResult.stderr;
    check('environment values remain outside the loaded registry',
      !Object.values(fakeEnvironment).some((value) => loadedSurface.includes(value)));
    equal('schema version is locked', registry.schema_version, 1);
    equal('server topology is locked', registry.servers, {
      canonical: 'vtp-kb',
      adjacent: ['jcl-internal', 'jcl-products', 'qmd'],
    });
    equal('environment-name allowlist is locked', registry.environment_names, environmentNames);
    equal('pins are locked', registry.pins, {
      qdrant_js: '1.18.0',
      embedder: 'bge-base-en-v1.5',
      'sentence-transformers/torch': 'NEVER-upgrade',
    });
    equal('single-writer semantics are locked', registry.single_writer, {
      scope: 'ingest',
      max_writers: 1,
      lock_path: path.join(fakeHome, '.vtp', 'ingest.lock'),
    });
    equal('local paths are home-expanded', registry.paths, {
      vtp_root: path.join(fakeHome, 'Voice-Text-Plan'),
      source_dir: path.join(fakeHome, 'Voice-Text-Plan', 'src'),
      cli_entry: path.join(fakeHome, 'Voice-Text-Plan', 'dist', 'cli.js'),
      canonical_kb_dir: path.join(fakeHome, '.vtp'),
      mirror_only_kb_dir: path.join(fakeHome, 'Voice-Text-Plan', 'kb-data'),
      pending_ledger: path.join(fakeHome, '.vtp', 'pending-ledger.jsonl'),
      ingest_lock: path.join(fakeHome, '.vtp', 'ingest.lock'),
      ingest_manifest: path.join(fakeHome, 'Voice-Text-Plan', 'config', 'ingest-manifest.yaml'),
    });

    const productionSource = fs.readFileSync(registryPath, 'utf8');
    const sentinels = {
      value: ['SENTINEL', 'VALUE', 'CARRY'].join('_'),
      default: ['SENTINEL', 'DEFAULT', 'CARRY'].join('_'),
      url: ['SENTINEL', 'URL', 'CARRY'].join('_'),
      uri: ['SENTINEL', 'URI', 'CARRY'].join('_'),
      hostField: ['SENTINEL', 'HOST', 'FIELD'].join('_'),
      endpoint: ['SENTINEL', 'ENDPOINT', 'CARRY'].join('_'),
      credential: ['SENTINEL', 'CREDENTIAL', 'CARRY'].join('_'),
      host: ['sentinel-host', 'example', 'invalid'].join('.'),
      duplicate: ['SENTINEL', 'DUPLICATE'].join('_'),
      server: ['SENTINEL', 'SERVER'].join('_'),
      path: ['~', 'SENTINEL_PATH', 'pending-ledger.jsonl'].join('/'),
      pin: ['SENTINEL', 'PIN'].join('_'),
      writer: ['SENTINEL', 'WRITER'].join('_'),
    };
    const forbiddenFieldFixtures = [
      ['value-carrying field', 'value', sentinels.value],
      ['default field', 'default', sentinels.default],
      ['URL field', 'url', sentinels.url],
      ['URI field', 'uri', sentinels.uri],
      ['host field', 'host', sentinels.hostField],
      ['endpoint field', 'endpoint', sentinels.endpoint],
      ['credential field', 'credential', sentinels.credential],
    ].map(([label, field, sentinel]) => ({
      label,
      reason: 'registry_forbidden_field',
      sentinel,
      mutate: (source) => `${source}\noperator_data:\n  ${field}: ${sentinel}\n`,
    }));
    const fixtures = forbiddenFieldFixtures.concat([
      {
        label: 'embedded host scalar',
        reason: 'registry_embedded_host',
        sentinel: sentinels.host,
        mutate: (source) => `${source}\noperator_note: ${sentinels.host}\n`,
      },
      {
        label: 'duplicate key',
        reason: 'registry_duplicate_key',
        sentinel: sentinels.duplicate,
        mutate: (source) => replaceOnce(source, 'schema_version: 1',
          `schema_version: 1\nschema_version: ${sentinels.duplicate}`),
      },
      {
        label: 'renamed canonical server',
        reason: 'registry_server_mismatch',
        sentinel: sentinels.server,
        mutate: (source) => replaceOnce(source, '  canonical: vtp-kb',
          `  canonical: ${sentinels.server}`),
      },
      {
        label: 'omitted environment name',
        reason: 'registry_environment_names_mismatch',
        sentinel: 'CLARITY_ES_URL',
        mutate: (source) => replaceOnce(source, '  - CLARITY_ES_URL\n', ''),
      },
      {
        label: 'changed locked path',
        reason: 'registry_path_mismatch',
        sentinel: sentinels.path,
        mutate: (source) => replaceOnce(source,
          '  pending_ledger: ~/.vtp/pending-ledger.jsonl',
          `  pending_ledger: ${sentinels.path}`),
      },
      {
        label: 'wrong pin fact',
        reason: 'registry_pin_mismatch',
        sentinel: sentinels.pin,
        mutate: (source) => replaceOnce(source, '  qdrant_js: 1.18.0',
          `  qdrant_js: ${sentinels.pin}`),
      },
      {
        label: 'broken single-writer semantics',
        reason: 'registry_single_writer_mismatch',
        sentinel: sentinels.writer,
        mutate: (source) => replaceOnce(source, '  max_writers: 1',
          `  max_writers: ${sentinels.writer}`),
      },
    ]);
    for (const fixture of fixtures) {
      expectRejected(loadRegistry, tempDir, productionSource, fixture);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  if (requested !== 'all' && !supportedCases.includes(requested)) {
    process.stderr.write(`Usage: ${path.basename(__filename)} --case all|${supportedCases.join('|')}\n`);
    process.exit(2);
  }
  if (requestedEntrypoint && !['rule0', 'manual'].includes(requestedEntrypoint)) {
    process.stderr.write('Usage: --entrypoint rule0|manual\n');
    process.exit(2);
  }

  if (requested === 'all' || requested === 'registry-contract') registryContract();
  if (requested === 'all' || requested === 'readiness-entrypoints') {
    await readinessEntrypoints();
  } else if (requested === 'readiness-entrypoints-green') {
    checkStaticEntrypoints();
    await readinessGreen();
  } else if (requested === 'readiness-entrypoints-degraded') {
    checkStaticEntrypoints();
    await readinessDegraded();
    await readinessAncestorSymlinkContainment();
    await readinessSpawnErrorRedaction();
  }

  process.stdout.write('---\n');
  process.stdout.write(`vtp_readiness: ${passed}/${total} assertions passed\n`);
  if (failures.length) {
    for (const failure of failures) process.stderr.write(`FAIL ${failure}\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(`FAIL readiness test harness error: ${error && error.message
    ? error.message : String(error)}\n`);
  process.exit(1);
});
