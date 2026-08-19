#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const GUARD_PATH = path.join(ROOT, 'super-gsd', 'tools', 'codex-hooks', 'block-secret-leak.cjs');
const CODEX_HOOKS_PATH = path.join(ROOT, '.codex', 'hooks.json');
const REPO_OVERLAY_PATH = path.join(ROOT, 'super-gsd', 'config', 'repo-settings-overlay.json');
const LEDGER_PATH = path.join(ROOT, '.planning', 'metrics', 'codex-tool-events.jsonl');

function snapshotLedger() {
  const exists = fs.existsSync(LEDGER_PATH);
  return { exists, size: exists ? fs.statSync(LEDGER_PATH).size : 0 };
}

function appendedRows(snapshot) {
  if (!fs.existsSync(LEDGER_PATH)) return [];
  const size = fs.statSync(LEDGER_PATH).size;
  assert.ok(size >= snapshot.size, 'guard ledger shrank during the assertion');
  if (size === snapshot.size) return [];
  const length = size - snapshot.size;
  const buffer = Buffer.alloc(length);
  const descriptor = fs.openSync(LEDGER_PATH, 'r');
  try {
    const bytesRead = fs.readSync(descriptor, buffer, 0, length, snapshot.size);
    const text = buffer.subarray(0, bytesRead).toString('utf8');
    assert.ok(text.endsWith('\n'), 'guard ledger append is incomplete');
    return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } finally {
    fs.closeSync(descriptor);
  }
}

function restoreLedger(snapshot) {
  if (snapshot.exists) {
    fs.truncateSync(LEDGER_PATH, snapshot.size);
  } else if (fs.existsSync(LEDGER_PATH)) {
    fs.unlinkSync(LEDGER_PATH);
  }
}

function spawnGuard(scriptPath, payload) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-block-guard-'));
  const stdinPath = path.join(tempRoot, 'stdin.json');
  const stdoutPath = path.join(tempRoot, 'stdout.txt');
  const stderrPath = path.join(tempRoot, 'stderr.txt');
  try {
    fs.writeFileSync(stdinPath, JSON.stringify(payload), 'utf8');
    const descriptors = [
      fs.openSync(stdinPath, 'r'),
      fs.openSync(stdoutPath, 'w'),
      fs.openSync(stderrPath, 'w'),
    ];
    let run;
    try {
      run = spawnSync(process.execPath, [scriptPath], {
        cwd: ROOT,
        stdio: descriptors,
        windowsHide: true,
      });
    } finally {
      for (const descriptor of descriptors) fs.closeSync(descriptor);
    }
    const result = Object.assign({}, run, {
      stdout: fs.readFileSync(stdoutPath, 'utf8'),
      stderr: fs.readFileSync(stderrPath, 'utf8'),
    });
    assert.ifError(result.error);
    return result;
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function assertNoCredentialSubstring(text, credential) {
  const substrings = new Set();
  for (let start = 0; start < credential.length; start += 1) {
    for (let end = start + 1; end <= credential.length; end += 1) {
      substrings.add(credential.slice(start, end));
    }
  }
  for (const substring of substrings) {
    assert.ok(!text.includes(substring), 'operator-facing output contains credential material');
  }
}

function assertSecretCase() {
  const credential = 'Q'.repeat(24);
  const snapshot = snapshotLedger();
  try {
    const run = spawnGuard(GUARD_PATH, { prompt: `deploy with API_KEY=${credential}` });
    assert.strictEqual(run.status, 2, `credential prompt was not blocked: ${run.stderr}`);
    assert.match(run.stderr, /API_KEY assignment/, 'block reason does not name the matched trigger');
    assertNoCredentialSubstring(run.stderr, credential);

    const rows = appendedRows(snapshot);
    assert.strictEqual(rows.length, 1, 'credential prompt must append exactly one decision row');
    assert.deepStrictEqual(Object.keys(rows[0]).sort(), [
      'allow', 'decision', 'hook', 'pattern', 'reason', 'ts',
    ], 'credential decision ledger row shape changed');
    assert.strictEqual(rows[0].decision, 'block');
    assertNoCredentialSubstring(JSON.stringify(rows[0]), credential);
  } finally {
    restoreLedger(snapshot);
  }
}

function assertBenignCase() {
  const snapshot = snapshotLedger();
  try {
    const run = spawnGuard(GUARD_PATH, { prompt: 'summarize the release notes' });
    assert.strictEqual(run.status, 0, `benign prompt was blocked: ${run.stderr}`);
    assert.strictEqual(run.stderr, '', 'benign prompt emitted a block reason');

    const rows = appendedRows(snapshot);
    assert.strictEqual(rows.length, 1, 'benign prompt must append exactly one decision row');
    assert.deepStrictEqual(Object.keys(rows[0]).sort(), [
      'allow', 'decision', 'hook', 'reason', 'ts',
    ], 'benign decision ledger row shape changed');
    assert.strictEqual(rows[0].decision, 'allow');
  } finally {
    restoreLedger(snapshot);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function codexGuardPaths() {
  const document = readJson(CODEX_HOOKS_PATH);
  const commands = (document.hooks?.UserPromptSubmit || [])
    .flatMap((entry) => Array.isArray(entry?.hooks) ? entry.hooks : [])
    .map((hook) => String(hook.command || '').match(/^node\s+(.+)$/))
    .filter(Boolean)
    .map((match) => path.resolve(ROOT, match[1]));
  return commands.filter((scriptPath) => path.basename(scriptPath) === 'block-secret-leak.cjs');
}

function claudeGuardPaths() {
  const document = readJson(REPO_OVERLAY_PATH);
  return (document.hooks?.UserPromptSubmit || [])
    .flatMap((entry) => Array.isArray(entry?.hooks) ? entry.hooks : [])
    .filter((hook) => hook?.command === 'node' && Array.isArray(hook.args) && hook.args.length > 0)
    .map((hook) => path.resolve(ROOT, hook.args[0]))
    .filter((scriptPath) => path.basename(scriptPath) === 'block-secret-leak.cjs');
}

function comparableDecision(row) {
  const result = Object.assign({}, row);
  delete result.ts;
  return result;
}

function assertDualSurfaceSharedCase() {
  const codexPaths = codexGuardPaths();
  const claudePaths = claudeGuardPaths();
  assert.strictEqual(codexPaths.length, 1, 'Codex must register exactly one secret-leak guard');
  assert.strictEqual(claudePaths.length, 1, 'Claude must register exactly one secret-leak guard');

  const codexPath = fs.realpathSync(codexPaths[0]);
  const claudePath = fs.realpathSync(claudePaths[0]);
  assert.strictEqual(codexPath, claudePath, 'Codex and Claude must resolve to the same guard file');
  assert.strictEqual(codexPath, fs.realpathSync(GUARD_PATH), 'both surfaces must use the shared guard');

  const payload = { prompt: `rotate API_KEY=${'R'.repeat(24)}` };
  const snapshot = snapshotLedger();
  try {
    const codexRun = spawnGuard(codexPath, payload);
    const claudeRun = spawnGuard(claudePath, payload);
    assert.strictEqual(codexRun.status, 2, 'shared guard did not block the credential payload');
    assert.strictEqual(codexRun.status, claudeRun.status, 'surface exit decisions differ');
    assert.strictEqual(codexRun.stderr, claudeRun.stderr, 'surface block reasons differ');

    const rows = appendedRows(snapshot);
    assert.strictEqual(rows.length, 2, 'dual-surface probe must append two decision rows');
    assert.deepStrictEqual(
      comparableDecision(rows[0]),
      comparableDecision(rows[1]),
      'surface ledger decisions differ',
    );
  } finally {
    restoreLedger(snapshot);
  }
}

function main() {
  const argv = process.argv.slice(2);
  const caseIndex = argv.indexOf('--case');
  assert.ok(caseIndex >= 0 && argv[caseIndex + 1], 'usage: assert-block-guard.cjs --case <name>');
  const name = argv[caseIndex + 1];
  if (name === 'secret') assertSecretCase();
  else if (name === 'benign') assertBenignCase();
  else if (name === 'dual-surface-shared') assertDualSurfaceSharedCase();
  else throw new Error(`unknown case: ${name}`);
  console.log(`block guard ${name} PASS`);
}

try {
  main();
} catch (error) {
  console.error(`block guard FAIL: ${error.message}`);
  process.exitCode = 1;
}
