#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const classifier = require('../../hooks/sgsd-intent-classifier.cjs');
const { ledgerPath } = require('../../scripts/lib/gate-evidence-log.cjs');
const {
  CLASSIFIER_PATH,
  ROOT,
  validateRegistration,
} = require('./assert-registration.cjs');

const GATE_LEDGER_PATH = ledgerPath(ROOT);
const SHADOW_LEDGER_PATH = classifier.kbTriageShadowLedgerPath(ROOT);
const PROBES = Object.freeze({
  planning: {
    prompt: 'there are multiple valid approaches; how should we architect the retry layer; reply with OK only and do not use tools',
    route: 'planning-triage',
  },
  'no-match': {
    prompt: 'fix the failing test in parser.cjs; reply with OK only and do not use tools',
    noMatch: true,
  },
  'p149-skill-routing': {
    prompt: 'please run a token waste audit before this closes; reply with OK only and do not use tools',
    routePrefix: 'sgsd-token-audit:prompt-time:',
    registrySuffix: '/super-gsd/registry/skill-routing.yaml',
  },
  'p152-shadow': {
    prompt: 'what did Ada say about the last meeting; reply with OK only and do not use tools',
    noMatch: true,
    shadow: true,
  },
});

function fileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
}

function snapshotLedgers() {
  return {
    gate: { path: GATE_LEDGER_PATH, offset: fileSize(GATE_LEDGER_PATH) },
    shadow: { path: SHADOW_LEDGER_PATH, offset: fileSize(SHADOW_LEDGER_PATH) },
  };
}

function readBytes(filePath, start, end) {
  if (!filePath || !fs.existsSync(filePath) || end <= start) return '';
  const length = end - start;
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(filePath, 'r');
  try {
    const bytesRead = fs.readSync(fd, buffer, 0, length, start);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function assertNonceFresh(snapshot, nonce) {
  for (const item of Object.values(snapshot)) {
    const prior = readBytes(item.path, 0, item.offset);
    assert.ok(!prior.includes(nonce), `nonce already appears before snapshot: ${nonce}`);
  }
}

function postSnapshotRows(item) {
  const end = fileSize(item.path);
  assert.ok(end >= item.offset, `ledger shrank after snapshot: ${item.path}`);
  const text = readBytes(item.path, item.offset, end);
  if (!text) return [];
  assert.ok(text.endsWith('\n'), `post-snapshot ledger fragment is incomplete: ${item.path}`);
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function parseStream(stdout) {
  return String(stdout || '').split(/\r?\n/).filter(Boolean).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`Claude stream contained non-JSON output: ${line.slice(0, 240)}`);
    }
  });
}

function normalizedCommand(value) {
  return String(value || '')
    .replace(/[\x22']/g, '')
    .replace(/\\/g, '/')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function assertOneRegisteredUserPromptSubmit(hooks) {
  const entries = hooks && Array.isArray(hooks.UserPromptSubmit)
    ? hooks.UserPromptSubmit
    : [];
  const commands = entries.flatMap((entry) => Array.isArray(entry && entry.hooks) ? entry.hooks : []);
  assert.strictEqual(entries.length, 1,
    'isolation requires exactly one UserPromptSubmit registration');
  assert.strictEqual(commands.length, 1,
    'isolation requires exactly one UserPromptSubmit hook command');
}

function assertRegistrationIsolation() {
  const registration = validateRegistration({ silent: true });
  assertOneRegisteredUserPromptSubmit(registration.hooks);
  return registration;
}

function claudeArgs(prompt, sessionId, settingSources) {
  const args = ['-p', prompt];
  if (settingSources) args.push('--setting-sources', settingSources);
  args.push(
    '--session-id',
    sessionId,
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-hook-events',
  );
  return args;
}

function assertProjectSettingSource(args) {
  const settingSourceIndexes = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--setting-sources') settingSourceIndexes.push(i);
  }
  assert.strictEqual(settingSourceIndexes.length, 1,
    'isolation requires exactly one --setting-sources argument');
  assert.strictEqual(args[settingSourceIndexes[0] + 1], 'project',
    'isolation requires --setting-sources project');
}

function claudeExecutable() {
  if (process.platform !== 'win32') return 'claude';
  const shimPath = String(process.env.PATH || '')
    .split(path.delimiter)
    .map((directory) => path.join(directory, 'claude.cmd'))
    .find((candidate) => fs.existsSync(candidate));
  assert.ok(shimPath, 'claude.cmd was not found on PATH');
  const executable = path.join(
    path.dirname(shimPath),
    'node_modules',
    '@anthropic-ai',
    'claude-code',
    'bin',
    'claude.exe',
  );
  assert.ok(fs.existsSync(executable), 'Claude Code executable behind claude.cmd is missing');
  return executable;
}

function runClaude(cwd, args) {
  return new Promise((resolve) => {
    const child = spawn(claudeExecutable(), args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let spawnError = null;
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', (error) => { spawnError = error; });
    const timer = setTimeout(() => child.kill(), 180000);
    child.on('close', (status, signal) => {
      clearTimeout(timer);
      resolve({ status, signal, stdout, stderr, spawnError, args });
    });
  });
}

function observedRun(run) {
  return JSON.stringify({
    status: run.status,
    signal: run.signal,
    spawn_error: run.spawnError ? run.spawnError.message : null,
    stdout: run.stdout,
    stderr: run.stderr,
  });
}

function assertCausalEvidence(run, gateRows, sessionId, registration, providedEvents) {
  assert.ok(registration && registration.classifierPath,
    'registration isolation must be established before attribution');
  assertProjectSettingSource(run.args);
  assert.ifError(run.spawnError);
  assert.strictEqual(run.status, 0, `headless Claude failed: ${observedRun(run)}`);
  const events = providedEvents || parseStream(run.stdout);
  assert.ok(events.some((event) => event.session_id === sessionId),
    'Claude stream did not carry the caller-chosen session id');
  const lifecycleEvents = events.filter((event) => event
    && event.type === 'system'
    && event.hook_name === 'UserPromptSubmit'
    && event.session_id === sessionId);
  const responses = lifecycleEvents.filter((event) => event.subtype === 'hook_response');
  assert.strictEqual(responses.length, 1,
    'expected exactly one UserPromptSubmit hook_response for the session');
  const response = responses[0];
  assert.strictEqual(response.exit_code, 0, 'UserPromptSubmit hook_response exit_code must be 0');
  assert.strictEqual(response.outcome, 'success', 'UserPromptSubmit hook_response outcome must be success');
  assert.ok(lifecycleEvents.some((event) => event.subtype === 'hook_started'
    && event.hook_id === response.hook_id),
  'UserPromptSubmit hook_response must pair with hook_started under the same hook_id');
  const correlated = gateRows.filter((row) => row
    && row.signal === classifier.ROUTING_DECISION_SIGNAL
    && row.session_id === sessionId);
  assert.strictEqual(correlated.length, 1,
    'expected exactly one post-snapshot classifier row with the session id');
  return { events, lifecycleEvents, response, row: correlated[0] };
}

function assertDecision(definition, result, shadowRows, fullPrompt, run) {
  const row = result.row;
  if (definition.noMatch) {
    assert.strictEqual(row.route_decision, 'no_match', 'probe requires an explicit no-match decision');
    assert.deepStrictEqual(row.route_ids, [], 'no-match row must carry an empty route_ids array');
  } else {
    assert.strictEqual(row.route_decision, 'matched', 'matched probe requires an explicit matched decision');
  }
  if (definition.route) {
    assert.ok(row.route_ids.includes(definition.route), `route was not matched: ${definition.route}`);
  }
  if (definition.routePrefix) {
    assert.ok(row.route_ids.some((id) => id.startsWith(definition.routePrefix)),
      `P149 route prefix was not matched: ${definition.routePrefix}`);
    const artifactPaths = (row.artifacts || []).map((item) => normalizedCommand(item.path));
    assert.ok(artifactPaths.some((item) => item.endsWith(definition.registrySuffix)),
      'P149 row did not originate from the skill-routing registry');
  }
  if (definition.shadow) {
    assert.strictEqual(shadowRows.length, 1, 'P152 probe must append exactly one shadow row');
    const shadowRow = shadowRows[0];
    assert.deepStrictEqual(Object.keys(shadowRow).sort(), [
      'decision_id',
      'latency_ms',
      'matched_signature_ids',
      'matcher_version',
      'operator_label',
      'soft_path_action',
      'ts',
    ], 'P152 shadow row must retain its text-free schema');
    assert.deepStrictEqual(shadowRow.matched_signature_ids, ['kb-lookup-triage']);
    const injectedOutput = result.lifecycleEvents
      .flatMap((event) => [event.stdout, event.output])
      .filter((value) => typeof value === 'string' && value.length > 0)
      .join('\n');
    assert.strictEqual(injectedOutput, '', 'P152 shadow probe injected hook output');
    const serialized = JSON.stringify(shadowRow).toLowerCase();
    assert.ok(!serialized.includes(fullPrompt.toLowerCase()), 'P152 shadow row contains prompt text');
    assert.ok(!serialized.includes(fullPrompt.split(' ', 1)[0].toLowerCase()),
      'P152 shadow row contains the prompt nonce');
    for (const forbidden of ['ada', 'meeting']) {
      assert.ok(!serialized.includes(forbidden), `P152 shadow row contains entity text: ${forbidden}`);
    }
  }
}

async function runProbe(name, providedNonce) {
  const registration = assertRegistrationIsolation();
  const snapshot = snapshotLedgers();
  const nonce = providedNonce || crypto.randomUUID();
  assertNonceFresh(snapshot, nonce);
  const sessionId = crypto.randomUUID();
  const definition = PROBES[name];
  assert.ok(definition, `unknown probe: ${name}`);
  const fullPrompt = `${nonce} ${definition.prompt}`;
  const args = claudeArgs(fullPrompt, sessionId, 'project');
  assertProjectSettingSource(args);
  const run = await runClaude(ROOT, args);
  const gateRows = postSnapshotRows(snapshot.gate);
  const shadowRows = postSnapshotRows(snapshot.shadow);
  const result = assertCausalEvidence(run, gateRows, sessionId, registration);
  assertDecision(definition, result, shadowRows, fullPrompt, run);
  console.log(`PROGRESS P153-T1b probe=${name} PASS session_id=${sessionId}`);
}

function spawnForgedClassifier(sessionId, nonce, prompt) {
  const payload = {
    cwd: ROOT,
    hook_event_name: 'UserPromptSubmit',
    session_id: sessionId,
    prompt: `${nonce} ${prompt}`,
  };
  const run = spawnSync(process.execPath, [CLASSIFIER_PATH], {
    cwd: ROOT,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.ifError(run.error);
  assert.strictEqual(run.status, 0, `direct classifier spawn failed: ${JSON.stringify(run)}`);
  return run;
}

function expectRejected(label, assertion, messagePattern) {
  let rejection = null;
  try {
    assertion();
  } catch (error) {
    rejection = error;
  }
  assert.ok(rejection, `${label} unexpectedly passed`);
  if (messagePattern) {
    assert.match(rejection.message, messagePattern, `${label} rejected for the wrong reason`);
  }
}

function runForgedAndConfusedControl() {
  const registration = assertRegistrationIsolation();
  const snapshot = snapshotLedgers();
  const nonce = crypto.randomUUID();
  assertNonceFresh(snapshot, nonce);
  const sessionId = crypto.randomUUID();
  const directRun = spawnForgedClassifier(sessionId, nonce, PROBES.planning.prompt);
  const gateRows = postSnapshotRows(snapshot.gate);
  assert.strictEqual(gateRows.filter((row) => row
    && row.signal === classifier.ROUTING_DECISION_SIGNAL
    && row.session_id === sessionId).length, 1,
  'forged direct spawn must create the tempting correlated ledger row');

  const noClaudeRun = {
    status: directRun.status,
    signal: directRun.signal,
    stdout: '',
    stderr: directRun.stderr,
    spawnError: directRun.error || null,
    args: claudeArgs(`${nonce} ${PROBES.planning.prompt}`, sessionId, 'project'),
  };
  expectRejected(
    'forged direct spawn',
    () => assertCausalEvidence(noClaudeRun, gateRows, sessionId, registration, []),
    /caller-chosen session id|hook_response/,
  );

  const confusedHooks = JSON.parse(JSON.stringify(registration.hooks));
  confusedHooks.UserPromptSubmit.push(JSON.parse(JSON.stringify(confusedHooks.UserPromptSubmit[0])));
  expectRejected(
    'duplicate UserPromptSubmit registration',
    () => assertOneRegisteredUserPromptSubmit(confusedHooks),
    /exactly one UserPromptSubmit registration/,
  );
  expectRejected(
    'omitted project setting source',
    () => assertProjectSettingSource(claudeArgs('control', crypto.randomUUID(), null)),
    /--setting-sources/,
  );
  console.log('PROGRESS P153-T1b control=forged-and-confused-must-fail PASS');
}

function runStaleNonceControl() {
  assertRegistrationIsolation();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-live-dispatch-stale-nonce-'));
  try {
    const nonce = crypto.randomUUID();
    const tempLedger = path.join(tempRoot, 'ledger.jsonl');
    fs.writeFileSync(tempLedger, JSON.stringify({ prompt_nonce: nonce }) + '\n', 'utf8');
    const snapshot = { gate: { path: tempLedger, offset: fileSize(tempLedger) } };
    expectRejected(
      'stale nonce replay',
      () => assertNonceFresh(snapshot, nonce),
      /nonce already appears before snapshot/,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  console.log('PROGRESS P153-T1b control=stale-nonce-must-fail PASS');
}

async function main() {
  const argv = process.argv.slice(2);
  const probeIndex = argv.indexOf('--probe');
  const controlIndex = argv.indexOf('--control');
  assert.notStrictEqual(probeIndex >= 0, controlIndex >= 0,
    'provide exactly one of --probe <name> or --control <name>');
  if (probeIndex >= 0) {
    const name = argv[probeIndex + 1];
    assert.ok(Object.prototype.hasOwnProperty.call(PROBES, name), `unknown probe: ${name || ''}`);
    await runProbe(name);
    return;
  }

  const name = argv[controlIndex + 1];
  if (name === 'forged-and-confused-must-fail') {
    runForgedAndConfusedControl();
    return;
  }
  if (name === 'stale-nonce-must-fail') {
    runStaleNonceControl();
    return;
  }
  throw new Error(`unknown control: ${name || ''}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`live dispatch FAIL: ${error && error.message ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
