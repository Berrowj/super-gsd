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

function isHookLifecycleEvent(event) {
  if (!event || typeof event !== 'object') return false;
  const type = String(event.type || '');
  const subtype = String(event.subtype || '');
  return type.startsWith('hook_')
    || subtype.startsWith('hook_')
    || type === 'hook_event'
    || subtype === 'hook_event';
}

function commandCandidates(event) {
  const out = [];
  const add = (value) => {
    if (typeof value === 'string') out.push(value);
    if (value && typeof value === 'object') {
      if (typeof value.command === 'string') {
        const args = Array.isArray(value.args) ? value.args : [];
        out.push([value.command, ...args].join(' '));
      }
    }
  };
  add(event.hook_name);
  add(event.hook_command);
  add(event.command);
  add(event.hook);
  if (event.message && typeof event.message === 'object') {
    add(event.message.hook_name);
    add(event.message.hook_command);
    add(event.message.command);
    add(event.message.hook);
  }
  return out;
}

function candidateResolvesTo(candidate, targetPath) {
  const actual = normalizedCommand(candidate);
  const target = normalizedCommand(targetPath);
  const nodeTarget = `node ${target}`;
  return actual === target
    || actual === nodeTarget
    || actual === `node.exe ${target}`
    || actual === `userpromptsubmit:${nodeTarget}`;
}

function exactHookLifecycleEvents(events, targetPath) {
  return events.filter((event) => isHookLifecycleEvent(event)
    && commandCandidates(event).some((candidate) => candidateResolvesTo(candidate, targetPath)));
}

function runClaude(cwd, prompt, sessionId) {
  const args = [
    '-p',
    prompt,
    '--setting-sources',
    'project',
    '--session-id',
    sessionId,
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-hook-events',
  ];
  return new Promise((resolve) => {
    const child = spawn('claude', args, {
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

function assertCausalEvidence(run, gateRows, sessionId, nonce, classifierPath) {
  assert.ifError(run.spawnError);
  assert.strictEqual(run.status, 0, `headless Claude failed: ${observedRun(run)}`);
  const events = parseStream(run.stdout);
  assert.ok(events.some((event) => event.session_id === sessionId),
    'Claude stream did not carry the caller-chosen session id');
  const exactEvents = exactHookLifecycleEvents(events, classifierPath);
  assert.ok(exactEvents.length > 0,
    'hook lifecycle did not name the exact sgsd-intent-classifier.cjs command');
  const correlated = gateRows.filter((row) => row
    && row.signal === classifier.ROUTING_DECISION_SIGNAL
    && row.session_id === sessionId
    && row.prompt_nonce === nonce);
  assert.strictEqual(correlated.length, 1,
    'expected exactly one post-snapshot classifier row with the session id and nonce');
  return { events, exactEvents, row: correlated[0] };
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
    assert.deepStrictEqual(shadowRows[0].matched_signature_ids, ['kb-lookup-triage']);
    assert.ok(!run.stdout.includes('SGSD directive:'), 'P152 shadow probe injected a directive');
    assert.ok(!run.stdout.includes('SGSD skill suggestion:'), 'P152 shadow probe injected a suggestion');
    const serialized = JSON.stringify(shadowRows[0]).toLowerCase();
    assert.ok(!serialized.includes(fullPrompt.toLowerCase()), 'P152 shadow row contains prompt text');
    for (const forbidden of ['ada', 'meeting']) {
      assert.ok(!serialized.includes(forbidden), `P152 shadow row contains entity text: ${forbidden}`);
    }
  }
}

async function runProbe(name, providedNonce) {
  const snapshot = snapshotLedgers();
  const nonce = providedNonce || crypto.randomUUID();
  assertNonceFresh(snapshot, nonce);
  const sessionId = crypto.randomUUID();
  const definition = PROBES[name];
  assert.ok(definition, `unknown probe: ${name}`);
  const fullPrompt = `${nonce} ${definition.prompt}`;
  const run = await runClaude(ROOT, fullPrompt, sessionId);
  const gateRows = postSnapshotRows(snapshot.gate);
  const shadowRows = postSnapshotRows(snapshot.shadow);
  const result = assertCausalEvidence(run, gateRows, sessionId, nonce, CLASSIFIER_PATH);
  assertDecision(definition, result, shadowRows, fullPrompt, run);
  console.log(`live dispatch PASS probe=${name} session_id=${sessionId} nonce=${nonce}`);
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
