'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { registerRun, startGlobal, prepare, finish, restartService, status, ensureService, RUNTIME_FINGERPRINT } = require('./global.cjs');
const { owned, ownsPort, processIdentity } = require('./lifecycle.cjs');
const { readLedger, digest } = require('./contract.cjs');
const { record } = require('./quota-sampler.cjs');
const { normalizeLogs } = require('./otlp.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-global-')), receiverRoot = path.join(root, 'global');
  t.after(() => removeFixtureRoot(root, receiverRoot));
  const projects = ['alpha', 'beta'].map(name => {
    const dir = path.join(root, name); fs.mkdirSync(path.join(dir, '.planning'), { recursive: true }); return dir;
  });
  return { root: receiverRoot, projects };
}
test('disabled preparation clears inherited managed-owner identity', async () => {
  const result = await prepare({ disabled: true });
  assert.equal(result.environment.SGSD_FLEET_MANAGED, '');
  assert.equal(result.environment.SGSD_FLEET_COORDINATOR_ID, '');
  assert.equal(result.environment.SGSD_RESTORE_ID, '');
});
test('unknown recovery ticket refuses preparation before registering a run', async t => {
  const f = fixture(t);
  const result = await prepare({ root: f.root, projectDir: f.projects[0], restoreId: 'recovery-11111111-1111-4111-8111-111111111111' });
  assert.equal(result.enabled, false);
  assert.ok(!fs.existsSync(path.join(f.root, 'runs')) || fs.readdirSync(path.join(f.root, 'runs')).length === 0);
});
test('recovery preparation publishes exact lineage and ticket run ID before fleet reservation', { skip: process.platform !== 'linux' }, async t => {
  const f = fixture(t), recovery = require('./workspace-recovery.cjs'), fleet = require('./fleet.cjs');
  const old = registerRun({ root: f.root, projectDir: f.projects[0] });
  const oldDeps = { bootId: () => '11111111-1111-4111-8111-111111111111', processLookup: () => ({ state: 'alive',
    pid: 2147483646, start_time: '1', executable: '/fixture/claude', environment: { SGSD_RUN_ID: old.run_id, SGSD_ATLAS_PROJECT_ID: old.project_id } }) };
  fleet.reserve({ root: f.root, run: old }, oldDeps);
  fleet.bind({ root: f.root, runId: old.run_id, projectDir: old.project_dir, pid: 2147483646, tmux: { pane_id: '%1' } }, oldDeps);
  const sourceDir = path.join(path.dirname(f.root), 'source'), scriptsDir = path.join(path.dirname(f.root), 'scripts'), agentsDir = path.join(path.dirname(f.root), 'agents');
  for (const dir of [sourceDir, scriptsDir, agentsDir]) fs.mkdirSync(dir);
  fs.writeFileSync(path.join(scriptsDir, 'sgsd-remote-tmux.sh'), '# fixture');
  const git = args => { const r = spawnSync('git', args, { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  git(['init', '-q', sourceDir]); git(['-C', sourceDir, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'fixture']);
  fs.writeFileSync(path.join(old.project_dir, '.super-gsd-version'), git(['-C', sourceDir, 'rev-parse', 'HEAD']));
  let prepared;
  const result = await recovery.restore({ root: f.root, projectIds: [old.project_id], sourceDir, scriptsDir, agentsDir }, {
    sessionExists: () => false, bindingWaitMs: 0, launch: async ({ args }) => {
      const restoreId = args[args.indexOf('--restore-id') + 1];
      prepared = await prepare({ root: f.root, projectDir: old.project_dir, restoreId });
      assert.equal(prepared.enabled, true);
      const ticket = JSON.parse(fs.readFileSync(path.join(f.root, 'fleet/workspaces/tickets', restoreId + '.json')));
      assert.equal(ticket.new_run_id, prepared.run.run_id); assert.equal(ticket.stage, 'prepared');
      assert.equal(fleet.status({ root: f.root }).claims[0].run_id, prepared.run.run_id);
      assert.equal(prepared.environment.SGSD_RESTORE_ID, restoreId);
      return { code: 0 };
    }
  });
  assert.equal(result.results[0].status, 'pending');
  assert.equal(prepared.run.recovery.previous_run_id, old.run_id);
  const spool = fs.readdirSync(path.join(prepared.run.state_dir, 'quota-spool')).map(name => JSON.parse(fs.readFileSync(path.join(prepared.run.state_dir, 'quota-spool', name))));
  assert.ok(spool.some(row => row.event_type === 'handoff' && row.identity.parent_handoff_id === old.run_id && row.identity.sgsd_run_id === prepared.run.run_id));
  assert.equal(finish({ root: f.root, runId: prepared.run.run_id, abortPending: true }), true);
});
test('recovery launcher failure after actual prepare and terminal exit is failed, not pending', { skip: process.platform !== 'linux' }, async t => {
  const f = fixture(t), recovery = require('./workspace-recovery.cjs'), fleet = require('./fleet.cjs');
  const old = registerRun({ root: f.root, projectDir: f.projects[0] });
  const oldDeps = { bootId: () => '11111111-1111-4111-8111-111111111111', processLookup: () => ({ state: 'alive',
    pid: 2147483646, start_time: '1', executable: '/fixture/claude', environment: { SGSD_RUN_ID: old.run_id, SGSD_ATLAS_PROJECT_ID: old.project_id } }) };
  fleet.reserve({ root: f.root, run: old }, oldDeps);
  fleet.bind({ root: f.root, runId: old.run_id, projectDir: old.project_dir, pid: 2147483646, tmux: { pane_id: '%1' } }, oldDeps);
  const sourceDir = path.join(path.dirname(f.root), 'source'), scriptsDir = path.join(path.dirname(f.root), 'scripts'), agentsDir = path.join(path.dirname(f.root), 'agents');
  for (const dir of [sourceDir, scriptsDir, agentsDir]) fs.mkdirSync(dir);
  fs.writeFileSync(path.join(scriptsDir, 'sgsd-remote-tmux.sh'), '# fixture');
  const git = args => { const result = spawnSync('git', args, { encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
  git(['init', '-q', sourceDir]); git(['-C', sourceDir, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'fixture']);
  fs.writeFileSync(path.join(old.project_dir, '.super-gsd-version'), git(['-C', sourceDir, 'rev-parse', 'HEAD']));
  let prepared;
  const result = await recovery.restore({ root: f.root, projectIds: [old.project_id], sourceDir, scriptsDir, agentsDir }, {
    sessionExists: () => false, bindingWaitMs: 0, launch: async ({ args }) => {
      prepared = await prepare({ root: f.root, projectDir: old.project_dir, restoreId: args[args.indexOf('--restore-id') + 1] });
      assert.equal(prepared.enabled, true); assert.equal(finish({ root: f.root, runId: prepared.run.run_id, abortPending: true }), true);
      return { code: 1 };
    }
  });
  assert.equal(result.results[0].status, 'failed', JSON.stringify(result));
  assert.equal(result.results[0].reason, 'recovery_launch_terminated');
  assert.equal(result.results[0].attach_command, null);
  assert.ok(fs.existsSync(path.join(prepared.run.state_dir, 'exit.json')));
  assert.ok(fs.existsSync(path.join(f.root, 'fleet/receipts', prepared.run.run_id + '.json')));
});
test('reboot recovery ignores reused PIDs in prior-boot startup and service records', { skip: process.platform !== 'linux' }, async t => {
  const f = fixture(t), oldBoot = '11111111-1111-4111-8111-111111111111';
  fs.mkdirSync(f.root, { recursive: true, mode: 0o700 });
  const identity = processIdentity(process.pid), token = crypto.randomUUID();
  const old = { schema_version: 1, mode: 'global', root_id: digest(f.root), pid: process.pid,
    boot_id: oldBoot, process_identity: identity, instance_id: crypto.randomUUID(), urls: {} };
  const oldBytes = JSON.stringify(old);
  fs.writeFileSync(path.join(f.root, 'service.json'), oldBytes, { mode: 0o600 });
  fs.writeFileSync(path.join(f.root, 'startup.lock'), JSON.stringify({ pid: process.pid, token, identity, boot_id: oldBoot }), { mode: 0o600 });
  const ready = await ensureService(f.root, 4000);
  assert.notEqual(ready.pid, process.pid);
  assert.match(ready.boot_id, /^[a-f0-9-]{36}$/); assert.notEqual(ready.boot_id, oldBoot);
  const receipts = fs.readdirSync(path.join(f.root, 'boot-receipts')).map(name => JSON.parse(fs.readFileSync(path.join(f.root, 'boot-receipts', name))));
  assert.ok(receipts.some(row => row.source_bytes === oldBytes && row.reason === 'prior_boot'));
});
test('if-running update safely reports absent for a proved-dead legacy receiver and preserves evidence', { skip: process.platform !== 'linux' }, async t => {
  const f = fixture(t); fs.mkdirSync(f.root, { recursive: true, mode: 0o700 });
  const old = { schema_version: 1, mode: 'global', root_id: digest(f.root), pid: 2147483647,
    process_identity: stoppedFixtureIdentity(), instance_id: crypto.randomUUID(), urls: {} };
  const bytes = JSON.stringify(old); fs.writeFileSync(path.join(f.root, 'service.json'), bytes, { mode: 0o600 });
  assert.equal((await restartService({ root: f.root })).status, 'absent');
  assert.equal(fs.readFileSync(path.join(f.root, 'service.json'), 'utf8'), bytes);
  assert.equal(fs.readdirSync(path.join(f.root, 'boot-receipts')).length, 1);
});
test('dead service metadata cannot hide a still-live replacement in completed history', { skip: process.platform !== 'linux' }, async t => {
  const f = fixture(t); fs.mkdirSync(f.root, { recursive: true, mode: 0o700 });
  const old = { schema_version: 1, mode: 'global', root_id: digest(f.root), pid: 2147483647,
    process_identity: stoppedFixtureIdentity(), instance_id: crypto.randomUUID(), urls: {} };
  fs.writeFileSync(path.join(f.root, 'service.json'), JSON.stringify(old));
  fs.writeFileSync(path.join(f.root, 'receiver-transition.json'), JSON.stringify({ schema_version: 1,
    root_id: digest(f.root), token: crypto.randomUUID(), phase: 'complete', replacement_identity: processIdentity(process.pid) }));
  await assert.rejects(restartService({ root: f.root }), /service_health_unverified/);
});
test('managed orchestrator preparation admits only one exact-project owner', { skip: process.platform !== 'linux' }, async t => {
  const f = fixture(t);
  const first = await prepare({ root: f.root, projectDir: f.projects[0] });
  assert.equal(first.enabled, true);
  assert.equal(first.environment.SGSD_FLEET_MANAGED, '1');
  assert.equal(first.environment.SGSD_RUN_ID, first.run.run_id);
  const second = await prepare({ root: f.root, projectDir: f.projects[0] });
  assert.equal(second.enabled, false);
  const worker = await prepare({ root: f.root, projectDir: f.projects[0], role: 'board', provider: 'openai' });
  assert.equal(worker.enabled, true);
  assert.notEqual(worker.environment.SGSD_FLEET_MANAGED, '1');
  assert.equal(finish({ root: f.root, runId: first.run.run_id }), false, 'ordinary finish cannot abort an unidentified pending owner');
  assert.equal(finish({ root: f.root, runId: first.run.run_id, abortPending: true }), true);
});
function payload(session, request, tokens = 5) {
  const attrs = { 'event.name': 'api_request', 'session.id': session, request_id: request,
    'event.timestamp': '2026-09-08T09:00:00Z', model: 'claude-opus-4-7', input_tokens: tokens,
    user_prompt: 'PRIVATE_PROMPT@example.invalid', tool_input: '/PRIVATE_HOST_PATH',
    'sgsd.launcher_repo_id': 'forged', 'sgsd.run_id': 'forged' };
  return { resourceLogs: [{ scopeLogs: [{ logRecords: [{ attributes: Object.entries(attrs).map(([key, value]) =>
    ({ key, value: typeof value === 'number' ? { intValue: String(value) } : { stringValue: value } })) }] }] }] };
}
async function send(instance, run, body) {
  const response = await fetch(`${instance.urls.ingest}/runs/${run.run_id}/v1/logs`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
function rows(run) {
  return fs.readdirSync(run.metrics_dir).filter(name => /^sgsd-atlas-events-.*\.jsonl$/.test(name))
    .flatMap(name => readLedger(path.join(run.metrics_dir, name)).events);
}
async function untilValue(read, timeout = 4000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const value = await read(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 30)); }
  assert.fail('fixture observation timed out');
}
async function launchRuntime(entry, root, { statusReader = status, readinessTimeout = 4000 } = {}) {
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const token = crypto.randomUUID();
  const args = ['--max-old-space-size=256', entry, 'serve', '--root', root, '--startup-token', token];
  const child = spawn(process.execPath, args, { stdio: 'ignore', env: { ...process.env } });
  let identity;
  try {
    identity = await untilValue(() => {
      const current = processIdentity(child.pid);
      return current && current.executable === fs.realpathSync(process.execPath)
        && JSON.stringify(current.argv.slice(1)) === JSON.stringify(args) ? current : null;
    }, 1000);
    fs.writeFileSync(path.join(root, 'startup.lock'), JSON.stringify({ pid: child.pid, token, identity }), { mode: 0o600 });
    const service = await untilValue(() => statusReader(root), readinessTimeout);
    return { child, service };
  } catch (error) {
    if (identity) await stopFixtureIdentity(identity);
    throw error;
  }
}
function validFixtureIdentity(identity) {
  return identity && typeof identity === 'object' && !Array.isArray(identity)
    && Number.isSafeInteger(identity.pid) && identity.pid > 0
    && typeof identity.start_time === 'string' && /^\d+$/.test(identity.start_time)
    && typeof identity.executable === 'string' && path.posix.isAbsolute(identity.executable) && !identity.executable.includes('\0')
    && Array.isArray(identity.argv) && identity.argv.length > 0 && typeof identity.argv[0] === 'string'
    && identity.argv[0].trim().length > 0 && identity.argv.every(value => typeof value === 'string' && !value.includes('\0'));
}
const stoppedFixtureIdentity = () => ({ pid: 2147483647, start_time: '1', executable: '/stopped-fixture', argv: ['/stopped-fixture'] });
const differentStartTime = startTime => startTime === '1' ? '2' : '1';
function sameFixtureIdentity(left, right) {
  return left.pid === right.pid && left.start_time === right.start_time && left.executable === right.executable
    && JSON.stringify(left.argv) === JSON.stringify(right.argv);
}
function fixtureIdentityState(identity) {
  const actual = processIdentity(identity.pid);
  if (actual) {
    if (!sameFixtureIdentity(identity, actual)) return 'replaced';
    return identity.pid === process.pid ? 'self' : 'owned';
  }
  try {
    const stat = fs.readFileSync(`/proc/${identity.pid}/stat`, 'utf8');
    if (stat.slice(stat.lastIndexOf(')') + 2).split(/\s+/, 1)[0] === 'Z') return 'zombie';
  } catch {}
  try { process.kill(identity.pid, 0); }
  catch (error) { return error.code === 'ESRCH' ? 'absent' : 'unknown'; }
  return 'unknown';
}
function requireFixtureIdentityState(identity, state) {
  if (state === 'unknown') throw new Error(`fixture_identity_unverified:${identity.pid}`);
  return state;
}
async function stopFixtureIdentity(identity) {
  let state = requireFixtureIdentityState(identity, fixtureIdentityState(identity));
  if (state !== 'owned') return;
  state = requireFixtureIdentityState(identity, fixtureIdentityState(identity));
  if (state !== 'owned') return;
  try { process.kill(identity.pid, 'SIGTERM'); }
  catch (error) { if (error.code === 'ESRCH') return; throw error; }
  await untilValue(() => {
    const current = fixtureIdentityState(identity);
    if (current === 'self') requireFixtureIdentityState(identity, current);
    return current === 'absent' || current === 'replaced' || current === 'zombie';
  }, 3000);
}
function fixtureIdentities(root) {
  const identities = [];
  for (const [file, keys] of [['service.json', ['process_identity']],
    ['receiver-transition.json', ['old_identity', 'candidate_identity', 'replacement_identity']], ['startup.lock', ['identity']]]) {
    const filename = path.join(root, file);
    let contents;
    try { contents = fs.readFileSync(filename, 'utf8'); }
    catch (error) {
      if (error.code === 'ENOENT') continue;
      throw new Error(`fixture_identity_evidence_unreadable:${file}:${error.code || 'UNKNOWN'}`);
    }
    let record;
    try { record = JSON.parse(contents); }
    catch { throw new Error(`fixture_identity_evidence_corrupt:${file}`); }
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`fixture_identity_evidence_corrupt:${file}`);
    let found = false;
    for (const key of keys) {
      const identity = record[key];
      if (identity === undefined || identity === null) continue;
      found = true;
      if (!validFixtureIdentity(identity)) throw new Error(`fixture_identity_evidence_corrupt:${file}:${key}`);
      if (!identities.some(previous => sameFixtureIdentity(previous, identity))) identities.push(identity);
    }
    if (!found) throw new Error(`fixture_identity_evidence_corrupt:${file}:identity_missing`);
  }
  return identities;
}
async function stopOwned(root) {
  const identities = fixtureIdentities(root);
  const states = identities.map(identity => requireFixtureIdentityState(identity, fixtureIdentityState(identity)));
  for (let index = 0; index < identities.length; index++) if (states[index] === 'owned') await stopFixtureIdentity(identities[index]);
}
async function removeFixtureRoot(base, root) {
  await stopOwned(root);
  fs.rmSync(base, { recursive: true, force: true });
}
function completedTransition(root, ports) {
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(root, 'receiver-transition.json'), JSON.stringify({
    schema_version: 1, token: crypto.randomUUID(), phase: 'complete', root_id: digest(root),
    replacement_identity: stoppedFixtureIdentity(),
    urls: Object.fromEntries(Object.entries(ports).map(([name, port]) => [name, `http://127.0.0.1:${port}`])), ports,
  }));
}
function procTcp(port, inode) {
  const header = 'sl local_address rem_address st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode';
  if (!port) return header + '\n';
  return `${header}\n0: 0100007F:${port.toString(16).toUpperCase().padStart(4, '0')} 00000000:0000 0A 0 0 0 0 0 ${inode}\n`;
}

test('launchRuntime stops its exact receiver when readiness observation times out', async t => {
  if (process.platform !== 'linux') return t.skip('owned process identity is Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-launch-readiness-failure-'));
  const root = path.join(base, 'global'), entry = __filename.replace(/\.test\.cjs$/, '.cjs');
  let observed;
  try {
    await assert.rejects(() => launchRuntime(entry, root, { readinessTimeout: 500, statusReader(target) {
        try { observed = JSON.parse(fs.readFileSync(path.join(target, 'service.json'), 'utf8')).process_identity; } catch {}
        return null;
      } }), /fixture observation timed out/);
    assert.ok(observed, 'the receiver published while the injected readiness observer kept failing');
    assert.equal(owned(observed), false, 'the exact spawned receiver is stopped before the helper rejects');
    assert.equal(fs.existsSync(root), true, 'failure evidence remains available to the caller');
  } finally {
    await stopOwned(root); fs.rmSync(base, { recursive: true, force: true });
  }
});

for (const fault of ['corrupt', 'unreadable']) test(`fixture cleanup preserves ${fault} identity evidence`, async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), `atlas-cleanup-${fault}-`));
  const root = path.join(base, 'global'), serviceFile = path.join(root, 'service.json');
  const stopped = stoppedFixtureIdentity();
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  fs.writeFileSync(serviceFile, fault === 'corrupt' ? '{' : JSON.stringify({ process_identity: stopped }));
  const realReadFile = fs.readFileSync;
  if (fault === 'unreadable') fs.readFileSync = (target, ...args) => {
    if (String(target) === serviceFile) { const error = new Error('fixture denied'); error.code = 'EACCES'; throw error; }
    return realReadFile(target, ...args);
  };
  try {
    await assert.rejects(removeFixtureRoot(base, root), new RegExp(`fixture_identity_evidence_${fault}`));
    assert.equal(fs.existsSync(base), true, 'unresolved fixture evidence is retained');
  } finally {
    fs.readFileSync = realReadFile;
    fs.mkdirSync(root, { recursive: true, mode: 0o700 });
    fs.writeFileSync(serviceFile, JSON.stringify({ process_identity: stopped }));
    await removeFixtureRoot(base, root);
  }
});

const malformedFixtureIdentityCases = [
  ['empty start time', identity => ({ ...identity, start_time: '' })],
  ['nonnumeric start time', identity => ({ ...identity, start_time: 'not-a-kernel-start-time' })],
  ['empty executable', identity => ({ ...identity, executable: '' })],
  ['relative executable', identity => ({ ...identity, executable: 'node' })],
  ['empty argv', identity => ({ ...identity, argv: [] })],
  ['empty argv executable', identity => ({ ...identity, argv: ['', ...identity.argv.slice(1)] })],
  ['blank argv executable', identity => ({ ...identity, argv: ['   ', ...identity.argv.slice(1)] })],
  ['array identity', identity => [identity]],
  ['missing pid', identity => { delete identity.pid; return identity; }],
  ['nonnumeric pid', identity => ({ ...identity, pid: String(identity.pid) })],
  ['missing start time', identity => { delete identity.start_time; return identity; }],
  ['missing executable', identity => { delete identity.executable; return identity; }],
  ['missing argv', identity => { delete identity.argv; return identity; }],
  ['non-string argv member', identity => ({ ...identity, argv: [...identity.argv, 7] })],
];
for (const [label, malformed] of malformedFixtureIdentityCases) test(`fixture cleanup preserves a live child with ${label}`, async t => {
  if (process.platform !== 'linux') return t.skip('exact process identity is Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-cleanup-malformed-'));
  const root = path.join(base, 'global'), serviceFile = path.join(root, 'service.json');
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  const identity = await untilValue(() => processIdentity(child.pid), 1000);
  fs.writeFileSync(serviceFile, JSON.stringify({ process_identity: malformed({ ...identity, argv: [...identity.argv] }) }));
  const realKill = process.kill;
  let cleanupError, retained, liveAfterAttempt, signals = 0;
  process.kill = (pid, signal) => {
    if (pid === identity.pid && signal && signal !== 0) signals++;
    return realKill(pid, signal);
  };
  try {
    try { await removeFixtureRoot(base, root); } catch (error) { cleanupError = error; }
    retained = fs.existsSync(base);
    try { realKill(identity.pid, 0); liveAfterAttempt = true; } catch { liveAfterAttempt = false; }
    const signalsBeforeCheckedCleanup = signals;
    if (!retained) fs.mkdirSync(root, { recursive: true, mode: 0o700 });
    fs.writeFileSync(serviceFile, JSON.stringify({ process_identity: identity }));
    await removeFixtureRoot(base, root);
    assert.match(cleanupError?.message || '', /fixture_identity_evidence_corrupt:service\.json:process_identity/);
    assert.equal(signalsBeforeCheckedCleanup, 0, 'malformed identity is never signal authority');
    assert.equal(liveAfterAttempt, true, 'the test-owned child remains live after malformed cleanup refusal');
    assert.equal(retained, true, 'malformed identity evidence is retained');
  } finally {
    process.kill = realKill;
    if (owned(identity)) { realKill(identity.pid, 'SIGTERM'); await untilValue(() => !owned(identity), 3000); }
    if (fs.existsSync(base)) {
      fs.mkdirSync(root, { recursive: true, mode: 0o700 });
      fs.writeFileSync(serviceFile, JSON.stringify({ process_identity: identity }));
      await removeFixtureRoot(base, root);
    }
  }
});

test('fixture cleanup never signals an exact self identity', async t => {
  if (process.platform !== 'linux') return t.skip('exact process identity is Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-cleanup-self-'));
  const root = path.join(base, 'global'), serviceFile = path.join(root, 'service.json');
  const identity = processIdentity(process.pid);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  fs.writeFileSync(serviceFile, JSON.stringify({ process_identity: identity }));
  const realKill = process.kill;
  let signalled = false;
  process.kill = (pid, signal) => {
    if (pid === process.pid && signal && signal !== 0) { signalled = true; throw new Error('test process signal refused'); }
    return realKill(pid, signal);
  };
  try {
    await removeFixtureRoot(base, root);
    assert.equal(signalled, false);
    assert.equal(fs.existsSync(base), false, 'the in-process fixture does not block root cleanup');
  } finally {
    process.kill = realKill;
    if (fs.existsSync(base)) await removeFixtureRoot(base, root);
  }
});

test('fixture cleanup accepts missing records and identities that are demonstrably stopped or reused', async t => {
  if (process.platform !== 'linux') return t.skip('exact process identity is Linux-only');
  const current = processIdentity(process.pid);
  assert.equal(validFixtureIdentity({ ...current, argv: [current.argv[0], ''] }), true,
    'an empty argument after the executable remains a valid Linux argv member');
  const cases = [
    ['missing', null],
    ['stopped', stoppedFixtureIdentity()],
    ['reused', { ...current, start_time: differentStartTime(current.start_time) }],
  ];
  const realKill = process.kill;
  let signals = 0;
  process.kill = (pid, signal) => {
    if (signal && signal !== 0) signals++;
    return realKill(pid, signal);
  };
  try {
    for (const [label, identity] of cases) {
      const base = fs.mkdtempSync(path.join(os.tmpdir(), `atlas-cleanup-${label}-`)), root = path.join(base, 'global');
      fs.mkdirSync(root, { recursive: true, mode: 0o700 });
      if (identity) fs.writeFileSync(path.join(root, 'service.json'), JSON.stringify({ process_identity: identity }));
      await removeFixtureRoot(base, root);
      assert.equal(fs.existsSync(base), false, `${label} evidence permits cleanup`);
    }
  } finally { process.kill = realKill; }
  assert.equal(signals, 0, 'stopped and reused identities are never signalled');
});

test('fixture cleanup treats an observed zombie as stopped without signalling its PID', async t => {
  if (process.platform !== 'linux') return t.skip('exact process identity is Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-cleanup-zombie-'));
  const root = path.join(base, 'global'), identity = processIdentity(process.pid), statFile = `/proc/${process.pid}/stat`;
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(root, 'service.json'), JSON.stringify({ process_identity: identity }));
  const realReadFile = fs.readFileSync, realKill = process.kill;
  let signals = 0;
  fs.readFileSync = (target, ...args) => {
    const value = realReadFile(target, ...args);
    if (String(target) !== statFile) return value;
    const end = value.lastIndexOf(')');
    return `${value.slice(0, end + 2)}Z${value.slice(end + 3)}`;
  };
  process.kill = (pid, signal) => {
    if (signal && signal !== 0) signals++;
    return realKill(pid, signal);
  };
  try {
    await removeFixtureRoot(base, root);
    assert.equal(signals, 0);
    assert.equal(fs.existsSync(base), false);
  } finally {
    fs.readFileSync = realReadFile; process.kill = realKill;
    if (fs.existsSync(base)) fs.rmSync(base, { recursive: true, force: true });
  }
});

test('fixture cleanup retains a live exact receiver while identity inspection is unavailable', async t => {
  if (process.platform !== 'linux') return t.skip('exact process identity is Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-cleanup-unverified-'));
  const root = path.join(base, 'global'), serviceFile = path.join(root, 'service.json');
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  const identity = await untilValue(() => processIdentity(child.pid), 1000);
  fs.writeFileSync(serviceFile, JSON.stringify({ process_identity: identity }));
  const realReadFile = fs.readFileSync, statFile = `/proc/${identity.pid}/stat`;
  fs.readFileSync = (target, ...args) => {
    if (String(target) === statFile) { const error = new Error('fixture denied'); error.code = 'EACCES'; throw error; }
    return realReadFile(target, ...args);
  };
  try {
    await assert.rejects(removeFixtureRoot(base, root), /fixture_identity_unverified/);
    assert.doesNotThrow(() => process.kill(identity.pid, 0), 'unproved receiver identity is not signalled');
    assert.equal(fs.existsSync(base), true, 'unresolved identity evidence is retained');
  } finally {
    let cleanupError;
    try { if (fs.existsSync(base)) await removeFixtureRoot(base, root); }
    catch (error) { cleanupError = error; }
    const retained = fs.existsSync(base);
    fs.readFileSync = realReadFile;
    if (fs.existsSync(base)) await removeFixtureRoot(base, root);
    assert.match(cleanupError?.message || '', /fixture_identity_unverified/);
    assert.equal(retained, true, 'caller finalization preserves evidence when checked cleanup remains unverified');
  }
});

test('fixture cleanup does not treat a hidden live proc stat as a stopped receiver', async t => {
  if (process.platform !== 'linux') return t.skip('exact process identity is Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-cleanup-hidden-stat-'));
  const root = path.join(base, 'global'), serviceFile = path.join(root, 'service.json');
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  const identity = await untilValue(() => processIdentity(child.pid), 1000);
  fs.writeFileSync(serviceFile, JSON.stringify({ process_identity: identity }));
  const realReadFile = fs.readFileSync, statFile = `/proc/${identity.pid}/stat`;
  fs.readFileSync = (target, ...args) => {
    if (String(target) === statFile) { const error = new Error('fixture hidden'); error.code = 'ENOENT'; throw error; }
    return realReadFile(target, ...args);
  };
  try {
    await assert.rejects(removeFixtureRoot(base, root), /fixture_identity_unverified/);
    assert.doesNotThrow(() => process.kill(identity.pid, 0), 'a live PID is not inferred absent from proc visibility alone');
    assert.equal(fs.existsSync(base), true, 'hidden identity evidence is retained');
  } finally {
    fs.readFileSync = realReadFile;
    if (fs.existsSync(base)) await removeFixtureRoot(base, root);
  }
});

test('launchRuntime retains evidence when readiness cleanup cannot reverify its known child identity', async t => {
  if (process.platform !== 'linux') return t.skip('exact process identity is Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-launch-readiness-unverified-'));
  const root = path.join(base, 'global'), entry = __filename.replace(/\.test\.cjs$/, '.cjs');
  const realReadFile = fs.readFileSync;
  let identity, denyIdentity = false;
  fs.readFileSync = (target, ...args) => {
    if (denyIdentity && identity && String(target) === `/proc/${identity.pid}/stat`) {
      const error = new Error('fixture denied'); error.code = 'EACCES'; throw error;
    }
    return realReadFile(target, ...args);
  };
  try {
    await assert.rejects(launchRuntime(entry, root, { readinessTimeout: 500, statusReader(target) {
      try { identity = JSON.parse(realReadFile(path.join(target, 'service.json'), 'utf8')).process_identity; } catch {}
      if (identity) denyIdentity = true;
      return null;
    } }), /fixture_identity_unverified/);
    assert.ok(identity, 'the launched child published exact identity evidence');
    assert.doesNotThrow(() => process.kill(identity.pid, 0), 'unproved child identity is not signalled');
    assert.equal(fs.existsSync(root), true, 'readiness failure evidence remains available');
  } finally {
    denyIdentity = false; fs.readFileSync = realReadFile;
    if (fs.existsSync(base)) await removeFixtureRoot(base, root);
  }
});

test('two projects and three sessions share a receiver without mixing or leaking data', async t => {
  const f = fixture(t);
  const a = registerRun({ root: f.root, projectDir: f.projects[0] });
  const b = registerRun({ root: f.root, projectDir: f.projects[1] });
  const a2 = registerRun({ root: f.root, projectDir: f.projects[0] });
  const instance = await startGlobal({ root: f.root }); t.after(() => instance.close());
  for (const [run, id] of [[a, 's1'], [b, 's2'], [a2, 's3']]) {
    assert.equal((await send(instance, run, payload(id, 'request'))).status, 200);
  }
  await send(instance, a, payload('s1', 'request'));
  assert.equal(rows(a).filter(row => row.event_type === 'api_request').length, 2);
  assert.equal(rows(b).filter(row => row.event_type === 'api_request').length, 1);
  const event = rows(a).find(row => row.identity?.session_id === 's1');
  assert.equal(event.scope.launcher_repo_id, a.project_id);
  assert.equal(event.identity.sgsd_run_id, a.run_id);
  assert.doesNotMatch(JSON.stringify([...rows(a), ...rows(b)]), /PRIVATE_|forged/);
  assert.equal((await send(instance, { run_id: 'unregistered' }, payload('s4', 'r'))).status, 403);
});

test('quota spools from independent sessions drain into their registered projects', async t => {
  const f = fixture(t);
  const a = registerRun({ root: f.root, projectDir: f.projects[0] });
  const b = registerRun({ root: f.root, projectDir: f.projects[1] });
  const instance = await startGlobal({ root: f.root, spoolPollMs: 20 }); t.after(() => instance.close());
  for (const run of [a, b]) record({ session_id: run.run_id, rate_limits: { seven_day: { used_percentage: 12, resets_at: 1789250400 } } },
    { stateDir: run.state_dir, runId: run.run_id });
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline && ![a, b].every(run => fs.existsSync(run.metrics_dir) && rows(run).some(row => row.event_type === 'quota')))
    await new Promise(resolve => setTimeout(resolve, 20));
  for (const run of [a, b]) {
    const quota = rows(run).find(row => row.event_type === 'quota');
    assert.equal(quota.scope.launcher_repo_id, run.project_id);
    assert.equal(quota.quota.attribution, 'account_unallocated');
  }
});

test('bootstrap reuses one healthy service, creates fresh runs, and respects opt-out', async t => {
  const f = fixture(t);
  const instance = await startGlobal({ root: f.root }); t.after(() => instance.close());
  const a = await prepare({ root: f.root, projectDir: f.projects[0] });
  const b = await prepare({ root: f.root, projectDir: f.projects[1] });
  assert.equal(a.environment.OTEL_EXPORTER_OTLP_ENDPOINT, b.environment.OTEL_EXPORTER_OTLP_ENDPOINT);
  assert.notEqual(a.environment.SGSD_RUN_ID, b.environment.SGSD_RUN_ID);
  assert.notEqual(a.environment.SGSD_ATLAS_STATE_DIR, b.environment.SGSD_ATLAS_STATE_DIR);
  assert.equal(a.environment.OTEL_LOG_RAW_API_BODIES, '0');
  assert.equal((await prepare({ root: f.root, projectDir: f.projects[0], disabled: true })).enabled, false);
});

test('launch from a project subdirectory keeps one project registration', t => {
  const f = fixture(t), nested = path.join(f.projects[0], 'src', 'nested');
  fs.mkdirSync(nested, { recursive: true });
  assert.equal(registerRun({ root: f.root, projectDir: nested }).project_id,
    registerRun({ root: f.root, projectDir: f.projects[0] }).project_id);
});

test('registered endpoint rejects a different provider in canonical events', async t => {
  const f = fixture(t), instance = await startGlobal({ root: f.root }); t.after(() => instance.close());
  const run = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai' });
  const event = normalizeLogs(payload('claude-session', 'request')).events[0];
  const response = await fetch(`${instance.urls.ingest}/runs/${run.run_id}/v1/events`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event) });
  assert.ok(response.status >= 400);
});

test('synthetic ID-bearing legacy Codex completions deduplicate tokens and omit private bodies', async t => {
  const f = fixture(t), instance = await startGlobal({ root: f.root }); t.after(() => instance.close());
  const run = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor' });
  const body = payload('codex-session', 'response-one', 23);
  const attrs = body.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;
  attrs.find(a => a.key === 'event.name').value.stringValue = 'codex.sse_event';
  attrs.find(a => a.key === 'model').value.stringValue = 'gpt-6-astra';
  attrs.push({ key: 'kind', value: { stringValue: 'response.completed' } },
    { key: 'output_tokens', value: { intValue: '7' } }, { key: 'reasoning_output_tokens', value: { intValue: '3' } });
  assert.equal((await send(instance, run, body)).status, 200);
  await send(instance, run, body);
  const canonical = rows(run), requests = canonical.filter(e => e.event_type === 'api_request');
  assert.equal(requests.length, 1); assert.equal(requests[0].usage.input_tokens, 23);
  assert.equal(requests[0].usage.output_tokens, 7); assert.equal(requests[0].usage.reasoning_tokens, 3);
  assert.equal(requests[0].runtime.provider, 'openai'); assert.equal(requests[0].scope.launcher_repo_id, run.project_id);
  assert.doesNotMatch(JSON.stringify(canonical), /PRIVATE_|forged/);
});

test('observed native Codex completion without provider request identity remains non-billable coverage', async t => {
  const f = fixture(t), instance = await startGlobal({ root: f.root }); t.after(() => instance.close());
  const run = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor' });
  const body = payload('native-codex-session', 'remove-request', 999);
  const record = body.resourceLogs[0].scopeLogs[0].logRecords[0];
  const attrs = record.attributes;
  attrs.find(a => a.key === 'event.name').value.stringValue = 'codex.sse_event';
  attrs.find(a => a.key === 'session.id').key = 'conversation.id';
  attrs.find(a => a.key === 'model').value.stringValue = 'gpt-6-astra';
  attrs.splice(attrs.findIndex(a => a.key === 'request_id'), 1);
  attrs.splice(attrs.findIndex(a => a.key === 'input_tokens'), 1);
  attrs.splice(attrs.findIndex(a => a.key === 'event.timestamp'), 1);
  record.timeUnixNano = '1788782400000000000';
  attrs.push({ key: 'event.kind', value: { stringValue: 'response.completed' } },
    { key: 'input_token_count', value: { intValue: '23' } },
    { key: 'output_token_count', value: { intValue: '7' } },
    { key: 'cached_token_count', value: { intValue: '5' } },
    { key: 'reasoning_token_count', value: { intValue: '3' } },
    { key: 'total_token_count', value: { intValue: '30' } });
  assert.equal((await send(instance, run, body)).status, 200);
  assert.equal((await send(instance, run, body)).status, 200);
  const canonical = rows(run);
  assert.equal(canonical.length, 1, 'native coverage must deduplicate without inflating requests');
  assert.equal(canonical[0].event_type, 'coverage');
  assert.equal(canonical[0].source.completeness_reason, 'missing_stable_request_identity');
  assert.equal(canonical[0].identity.session_id, 'native-codex-session');
  assert.equal(canonical[0].identity.request_id, null);
  assert.equal(Object.values(canonical[0].usage).every(value => value === null), true);
  assert.doesNotMatch(JSON.stringify(canonical), /PRIVATE_|forged/);
  const health = await (await fetch(instance.urls.health + '/health')).json();
  assert.ok(health.coverage.missing_stable_identity >= 1);
});

test('Claude request sequence without provider request ID is coverage, not token accounting', () => {
  const body = payload('missing-request', 'r', 123);
  const attrs = body.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;
  attrs.splice(attrs.findIndex(a => a.key === 'request_id'), 1);
  attrs.push({ key: 'event.sequence', value: { intValue: '7' } });
  const normalized = normalizeLogs(body);
  assert.equal(normalized.missing_stable_identity, 1);
  assert.equal(normalized.events[0].event_type, 'coverage');
  assert.equal(normalized.events[0].usage.input_tokens, null);
});

test('end-of-session marker is registered and idempotent', async t => {
  const f = fixture(t), instance = await startGlobal({ root: f.root, spoolPollMs: 20 });
  t.after(() => instance.close());
  const prepared = await prepare({ root: f.root, projectDir: f.projects[0] });
  assert.equal(prepared.enabled, true);
  const exitFile = path.join(prepared.run.state_dir, 'exit.json');
  if (process.platform === 'linux') {
    const fleet = require('./fleet.cjs');
    assert.equal(finish({ root: f.root, runId: prepared.run.run_id }), false, 'pending ownership is not a completed session');
    assert.equal(fs.existsSync(exitFile), false);
    // A real child supplies the owned run's process evidence without a model call.
    const child = spawn(process.execPath, ['-e', 'process.stdout.write("ready\\n");process.stdin.resume()'], {
      env: { ...process.env, SGSD_RUN_ID: prepared.run.run_id, SGSD_ATLAS_PROJECT_ID: prepared.run.project_id },
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const closed = new Promise(resolve => child.once('close', resolve));
    t.after(async () => { child.stdin.end(); await closed; });
    await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); });
    fleet.bind({ root: f.root, runId: prepared.run.run_id, projectDir: prepared.run.project_dir,
      pid: child.pid, sessionId: 'session-exit-fixture' });
    assert.equal(finish({ root: f.root, runId: prepared.run.run_id }), false, 'a live owned process cannot be finished');
    assert.equal(fs.existsSync(exitFile), false);
    child.stdin.end(); await closed;
  }
  assert.equal(finish({ root: f.root, runId: prepared.run.run_id }), true);
  const firstExit = fs.readFileSync(exitFile);
  assert.equal(finish({ root: f.root, runId: prepared.run.run_id }), true);
  assert.deepEqual(fs.readFileSync(exitFile), firstExit, 'repeated finish retains the original exit timestamp');
  if (process.platform === 'linux') {
    assert.equal(require('./fleet.cjs').status({ root: f.root, projectDir: prepared.run.project_dir }).claims.length, 0);
    const receipt = JSON.parse(fs.readFileSync(path.join(f.root, 'fleet/receipts', `${prepared.run.run_id}.json`), 'utf8'));
    assert.equal(receipt.reason, 'bound_process_dead');
    assert.equal(receipt.run_id, prepared.run.run_id);
  }
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline && (!fs.existsSync(prepared.run.metrics_dir) || !rows(prepared.run).some(row => row.source.completeness_reason === 'launcher_session_exit')))
    await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(rows(prepared.run).filter(row => row.source.completeness_reason === 'launcher_session_exit').length, 1);
});

test('timed-out bootstrap retains ownership until its delayed receiver publishes', async t => {
  const f = fixture(t);
  const cp = require('node:child_process'), original = cp.spawn;
  let starts = 0, instance;
  const instances = [], pending = [];
  cp.spawn = (_file, args) => {
    starts++;
    const token = args[args.indexOf('--startup-token') + 1];
    pending.push(new Promise(resolve => setTimeout(async () => {
      instance = await startGlobal({ root: f.root, startupToken: token }); instances.push(instance); resolve();
    }, 220)));
    return { pid: process.pid, on() {}, unref() {} };
  };
  t.after(async () => { cp.spawn = original; await Promise.all(pending); await Promise.all(instances.map(server => server.close())); });
  // Reload an uncached bootstrap closure so its spawn binding sees this isolated delay.
  for (const name of ['global.cjs', 'server.cjs', 'codex-otlp.cjs', 'otlp.cjs', 'accounting.cjs', 'contract.cjs',
    'global-store.cjs', 'quota-sampler.cjs', 'lifecycle.cjs', 'fleet.cjs', 'boot-identity.cjs', 'workspace-recovery.cjs', 'sgsd-ledger-runtime.cjs',
    'sgsd-ledger-reader.cjs', 'sgsd-ledger.cjs']) delete require.cache[require.resolve(`./${name}`)];
  const bootstrap = require('./global.cjs');
  assert.match(bootstrap.RUNTIME_FINGERPRINT, /^[a-f0-9]{64}$/, 'the delayed fixture must begin with an attested runtime closure');
  await assert.rejects(bootstrap.ensureService(f.root, 60), /timeout/);
  const service = await bootstrap.ensureService(f.root, 1500);
  assert.equal(starts, 1);
  assert.equal(service.instance_id, instance.instanceId);
});

test('ordinary launch cannot accept a healthy service that appears behind a still-pending transition lock', async t => {
  const f = fixture(t), token = crypto.randomUUID();
  fs.mkdirSync(f.root, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(f.root, 'startup.lock'), JSON.stringify({ pid: process.pid, token: 'other' }), { mode: 0o600 });
  let instance;
  const publish = setTimeout(async () => {
    instance = await startGlobal({ root: f.root });
    fs.writeFileSync(path.join(f.root, 'receiver-transition.json'), JSON.stringify({
      schema_version: 1, root_id: digest(f.root), token, phase: 'service_ready',
    }), { mode: 0o600 });
    fs.unlinkSync(path.join(f.root, 'startup.lock'));
  }, 60);
  try { await assert.rejects(ensureService(f.root, 1000), /transition_pending/); }
  finally {
    clearTimeout(publish); if (instance) await instance.close();
    for (const name of ['startup.lock', 'receiver-transition.json']) {
      try { fs.unlinkSync(path.join(f.root, name)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
});

test('ordinary launch rechecks a transition journal created while an awaited health response is pending', async t => {
  const f = fixture(t), instanceId = crypto.randomUUID();
  fs.mkdirSync(f.root, { recursive: true, mode: 0o700 });
  let requests = 0, releaseHealth, observeHealth;
  const held = new Promise(resolve => { observeHealth = resolve; });
  const release = new Promise(resolve => { releaseHealth = resolve; });
  const server = http.createServer(async (_request, response) => {
    requests++;
    if (requests === 1) { response.writeHead(503); response.end(); return; }
    observeHealth(); await release;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ pid: process.pid, instance_id: instanceId, project_id: digest(f.root), root_id: digest(f.root) }));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const url = `http://127.0.0.1:${server.address().port}`;
  fs.writeFileSync(path.join(f.root, 'service.json'), JSON.stringify({ schema_version: 1, root_id: digest(f.root), pid: process.pid,
    instance_id: instanceId, urls: { ingest: url, health: url, metrics: url } }));
  try {
    const pending = ensureService(f.root, 1000);
    await held;
    const lock = JSON.parse(fs.readFileSync(path.join(f.root, 'startup.lock'), 'utf8'));
    fs.writeFileSync(path.join(f.root, 'receiver-transition.json'), JSON.stringify({
      schema_version: 1, root_id: digest(f.root), token: lock.token, phase: 'prepared',
    }), { mode: 0o600 });
    releaseHealth();
    await assert.rejects(pending, /transition_pending/);
  } finally {
    releaseHealth?.(); await new Promise(resolve => server.close(resolve));
    for (const name of ['service.json', 'startup.lock', 'receiver-transition.json']) {
      try { fs.unlinkSync(path.join(f.root, name)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
});

module.exports = { payload, rows, fixture };

test('native accounting authority is explicit, immutable and absent for legacy runs', t => {
  const f = fixture(t);
  const run = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor', accountingSource: 'codex_rollout' });
  assert.equal(run.accountingSource, 'codex_rollout');
  assert.equal(Object.isFrozen(run), true);
  assert.throws(() => { run.accountingSource = 'codex_otel'; }, TypeError);
  const { readRun } = require('./global-store.cjs');
  assert.equal(readRun(f.root, run.run_id).accountingSource, 'codex_rollout');
  assert.equal(registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai' }).accountingSource, undefined);
  assert.throws(() => registerRun({ root: f.root, projectDir: f.projects[0], provider: 'anthropic', accountingSource: 'codex_rollout' }), /accounting/);
});

function rollout(run, id = 'resp-native') {
  return require('../codex-worker/usage.cjs').projectUsageRecord({ timestamp: '2026-09-08T12:00:00Z', type: 'token_usage_record', payload: {
    thread_id: 'thread-native', turn_id: 'turn-native', session_id: 'session-native', root_turn_id: 'turn-native', response_id: id,
    usage: { input_tokens: 100, cached_input_tokens: 60, cache_write_input_tokens: 5, output_tokens: 20, reasoning_output_tokens: 12, total_tokens: 120 },
  } }, { run: { ...run, accountingSource: 'codex_rollout' }, threadId: 'thread-native', turnId: 'turn-native', model: 'gpt-6-astra', modelProvider: 'openai' }).event;
}
async function until(check) {
  const end = Date.now() + 2500;
  while (Date.now() < end) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  assert.fail('bounded fixture observation timed out');
}
function legacyCodex() {
  const body = payload('session-native', 'resp-native', 100);
  const attrs = body.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;
  attrs.find(a => a.key === 'event.name').value.stringValue = 'codex.sse_event';
  attrs.find(a => a.key === 'model').value.stringValue = 'gpt-6-astra';
  attrs.push({ key: 'event.kind', value: { stringValue: 'response.completed' } }); return body;
}

test('native source claims cannot self-authorize direct or canonical HTTP intake', async t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor', accountingSource: 'codex_rollout' });
  const instance = await startGlobal({ root: f.root }); t.after(() => instance.close());
  const event = rollout(run);
  assert.equal(instance.store.ingest(event).status, 'rejected');
  assert.equal(instance.store.ingest(event, { kind: 'private_spool', runId: run.run_id }).status, 'rejected');
  const response = await fetch(`${instance.urls.ingest}/runs/${run.run_id}/v1/events`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event) });
  assert.equal(response.status, 400);
  assert.equal(fs.existsSync(run.metrics_dir), false);
});

test('registered native spool is authoritative in both arrival orders and drives health and accepted-only counters', async t => {
  const { queueEvent } = require('./quota-sampler.cjs');
  for (const order of ['otel-first', 'rollout-first']) {
    const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor', accountingSource: 'codex_rollout' });
    const instance = await startGlobal({ root: f.root, spoolPollMs: 20 }); t.after(() => instance.close());
    if (order === 'otel-first') await send(instance, run, legacyCodex());
    assert.equal(queueEvent(rollout(run), run.state_dir), true);
    await until(() => fs.existsSync(run.metrics_dir) && rows(run).some(e => e.source.kind === 'codex_rollout'));
    if (order === 'rollout-first') await send(instance, run, legacyCodex());
    const canonical = rows(run), metadata = canonical.find(e => e.source.kind === 'codex_otel');
    assert.equal(canonical.filter(e => e.event_type === 'api_request').length, 1);
    assert.equal(metadata.event_type, 'coverage'); assert.equal(Object.values(metadata.usage).every(v => v === null), true);
    const health = await (await fetch(instance.urls.health + '/health')).json();
    assert.equal(health.coverage.native_responses, 'observed');
    assert.equal(health.coverage.native_requests, 'unavailable', 'response ID is not HTTP request ID');
    queueEvent(rollout(run), run.state_dir);
    await until(() => fs.readdirSync(path.join(run.state_dir, 'quota-spool')).length === 0);
    let metrics = await (await fetch(instance.urls.metrics + '/metrics')).text();
    assert.match(metrics, /sgsd_atlas_request_tokens_total\{[^\n]*token_type="input"[^\n]*\} 100/);
    assert.match(metrics, /sgsd_atlas_events_duplicate_total 1/);
    const changed = rollout(run); changed.usage.input_tokens++;
    queueEvent(changed, run.state_dir);
    await until(() => rows(run).some(e => e.event_type === 'integrity_conflict'));
    metrics = await (await fetch(instance.urls.metrics + '/metrics')).text();
    assert.match(metrics, /sgsd_atlas_request_tokens_total\{[^\n]*token_type="input"[^\n]*\} 100/);
    assert.equal((await (await fetch(instance.urls.health + '/health')).json()).coverage.native_responses, 'partial');
  }
});

test('native spool rejects legacy authority, other registrations and malformed native envelopes', async t => {
  const { queueEvent } = require('./quota-sampler.cjs');
  const f = fixture(t), legacy = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor' });
  const native = registerRun({ root: f.root, projectDir: f.projects[1], provider: 'openai', role: 'executor', accountingSource: 'codex_rollout' });
  const instance = await startGlobal({ root: f.root, spoolPollMs: 20 }); t.after(() => instance.close());
  assert.equal(queueEvent(rollout(legacy), legacy.state_dir), true);
  assert.equal(queueEvent(rollout(native), legacy.state_dir), true, 'valid envelope in wrong private route');
  const malformed = rollout(native); malformed.usage.total_provider_tokens = null;
  assert.equal(queueEvent(malformed, native.state_dir), false, 'producer refuses malformed usage');
  const dir = path.join(native.state_dir, 'quota-spool'); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, 'a'.repeat(64) + '.json'), JSON.stringify(malformed), { mode: 0o600 });
  await until(async () => (await (await fetch(instance.urls.health + '/health')).json()).coverage.quota_spool_rejected >= 3);
  for (const run of [legacy, native]) assert.ok(!fs.existsSync(run.metrics_dir) || !rows(run).some(e => e.event_type === 'api_request'));
});

test('direct global intake enforces registered provider and role while preparation opts in explicitly', async t => {
  const f = fixture(t), instance = await startGlobal({ root: f.root }); t.after(() => instance.close());
  const prepared = await prepare({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor', accountingSource: 'codex_rollout' });
  assert.equal(prepared.run.accountingSource, 'codex_rollout');
  const { scopeEvent } = require('./global-store.cjs');
  const normalized = require('./codex-otlp.cjs').normalizeLogs(legacyCodex()).events[0];
  const value = scopeEvent(normalized, prepared.run);
  for (const section of ['provider', 'role', 'project']) {
    const forged = structuredClone(value);
    if (section === 'provider') forged.runtime.provider = 'anthropic';
    if (section === 'role') forged.scope.role = 'orchestrator';
    if (section === 'project') forged.scope.launcher_repo_id = 'b'.repeat(64);
    assert.equal(instance.store.ingest(forged).status, 'rejected', section);
  }
});

test('permanent native spool scope failures are terminal across repeated polls', async t => {
  const { queueEvent } = require('./quota-sampler.cjs');
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor' });
  queueEvent(rollout(run), run.state_dir);
  const instance = await startGlobal({ root: f.root, spoolPollMs: 20 }); t.after(() => instance.close());
  const failures = async () => (await (await fetch(instance.urls.health + '/health')).json()).coverage.quota_spool_rejected;
  await until(async () => await failures() > 0);
  const count = await failures();
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.equal(await failures(), count, 'terminal scope rejection must not be parsed and rejected on every poll');
  assert.equal(fs.readdirSync(path.join(run.state_dir, 'quota-spool')).length, 1, 'retain rejected evidence without deleting user data');
});

test('strict native source validation rejects illegal fields and all invalid numeric dimensions before spool writes', t => {
  const { queueEvent } = require('./quota-sampler.cjs');
  const { validate } = require('./contract.cjs');
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor', accountingSource: 'codex_rollout' });
  const event = rollout(run);
  const mutations = [e => { e.identity.request_id = e.identity.response_id; }, e => { delete e.identity.turn_id; },
    e => { e.runtime.provider = 'anthropic'; }, e => { e.runtime.model_provenance = 'provider_response'; },
    e => { e.event_type = 'coverage'; }, e => { e.source.provenance = 'client_observed'; },
    e => { e.execution.success = false; }, e => { e.payload.prompt = 'PRIVATE-CANARY'; }];
  for (const field of Object.keys(event.usage)) for (const number of [-1, 0.2, '1', null, Number.MAX_SAFE_INTEGER + 1]) {
    if (field === 'cache_creation_tokens' && number === null) continue;
    mutations.push(e => { e.usage[field] = number; });
  }
  for (const mutate of mutations) {
    const invalid = structuredClone(event); mutate(invalid);
    assert.ok(validate(invalid)); assert.equal(queueEvent(invalid, run.state_dir), false);
  }
  assert.equal(fs.existsSync(path.join(run.state_dir, 'quota-spool')), false);
});

test('loaded receiver fingerprint stays immutable after installed files change while a fresh runtime reports the new closure', async t => {
  const f = fixture(t), runtime = path.join(path.dirname(f.root), 'installed-runtime');
  fs.cpSync(__dirname, runtime, { recursive: true });
  const loaded = require(path.join(runtime, 'global.cjs'));
  assert.match(loaded.RUNTIME_FINGERPRINT, /^[a-f0-9]{64}$/);
  const instance = await loaded.startGlobal({ root: f.root }); t.after(() => instance.close());
  const before = await (await fetch(instance.urls.health + '/health')).json();
  assert.equal(before.runtime_fingerprint, loaded.RUNTIME_FINGERPRINT);
  fs.appendFileSync(path.join(runtime, 'codex-otlp.cjs'), '\n// fixture revision B\n');
  const after = await (await fetch(instance.urls.health + '/health')).json();
  assert.equal(after.runtime_fingerprint, loaded.RUNTIME_FINGERPRINT, 'health must describe loaded memory, not current disk');
  const fresh = spawnSync(process.execPath, ['-e', 'process.stdout.write(require(process.argv[1]).RUNTIME_FINGERPRINT)', path.join(runtime, 'global.cjs')],
    { encoding: 'utf8', timeout: 5000 });
  assert.equal(fresh.status, 0, fresh.stderr); assert.match(fresh.stdout, /^[a-f0-9]{64}$/);
  assert.notEqual(fresh.stdout, loaded.RUNTIME_FINGERPRINT);
});

test('runtime fingerprint hashes the compiled global entry instead of replacement bytes at its path', t => {
  const f = fixture(t), runtime = path.join(path.dirname(f.root), 'compiled-entry-runtime');
  fs.cpSync(__dirname, runtime, { recursive: true });
  const entry = path.join(runtime, 'global.cjs');
  const script = String.raw`
    const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
    const entry = process.argv[1], source = fs.readFileSync(entry, 'utf8');
    fs.writeFileSync(entry, source.replace('const PROTOCOL = 1;', 'const PROTOCOL = 2;'));
    const loaded = new Module(entry, module); loaded.filename = entry; loaded.paths = Module._nodeModulePaths(path.dirname(entry));
    loaded._compile(source, entry); const compiled = loaded.exports.RUNTIME_FINGERPRINT;
    for (const key of Object.keys(require.cache)) if (path.dirname(key) === path.dirname(entry)) delete require.cache[key];
    const fresh = require(entry).RUNTIME_FINGERPRINT;
    process.stdout.write(JSON.stringify({ compiled, fresh }));
  `;
  const result = spawnSync(process.execPath, ['-e', script, entry], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  const fingerprints = JSON.parse(result.stdout);
  assert.match(fingerprints.compiled, /^[a-f0-9]{64}$/); assert.match(fingerprints.fresh, /^[a-f0-9]{64}$/);
  assert.notEqual(fingerprints.compiled, fingerprints.fresh, 'loaded entry bytes, not later path contents, identify the entry component');
});

test('dependency replacement during eager loading leaves the runtime unattested and unable to start', t => {
  const f = fixture(t), runtime = path.join(path.dirname(f.root), 'dependency-cutover-runtime');
  fs.cpSync(__dirname, runtime, { recursive: true });
  const entry = path.join(runtime, 'global.cjs'), root = path.join(path.dirname(f.root), 'cutover-global');
  const script = String.raw`
    const fs = require('node:fs'), Module = require('node:module');
    const entry = process.argv[1], root = process.argv[2], original = Module._extensions['.js'];
    Module._extensions['.cjs'] = function(mod, filename) {
      if (!filename.endsWith(require('node:path').sep + 'codex-otlp.cjs')) return original(mod, filename);
      const source = fs.readFileSync(filename, 'utf8'); fs.appendFileSync(filename, '\n// replacement B\n');
      delete Module._extensions['.cjs']; mod._compile(source, filename);
    };
    (async () => {
      const global = require(entry); let error = null, instance;
      try { instance = await global.startGlobal({ root }); } catch (caught) { error = caught.message; }
      if (instance) await instance.close();
      process.stdout.write(JSON.stringify({ fingerprint: global.RUNTIME_FINGERPRINT, error }));
    })().catch(error => { process.stderr.write(error.stack); process.exitCode = 1; });
  `;
  const result = spawnSync(process.execPath, ['-e', script, entry, root], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { fingerprint: null, error: 'runtime_closure_unattested' });
});

test('cached dependency context preserves read-only audit access but refuses receiver mutation', t => {
  const f = fixture(t), runtime = path.join(path.dirname(f.root), 'cached-runtime');
  fs.cpSync(__dirname, runtime, { recursive: true });
  const entry = path.join(runtime, 'global.cjs'), root = path.join(path.dirname(f.root), 'cached-global');
  const project = path.join(path.dirname(f.root), 'cached-project'); fs.mkdirSync(path.join(project, '.planning'), { recursive: true });
  const script = String.raw`
    const { audit } = require(process.argv[1]);
    const global = require(process.argv[2]);
    (async () => {
      const report = await audit({ root: process.argv[3] }); let error = null, registrationError = null;
      try { global.registerRun({ root: process.argv[3], projectDir: process.argv[4] }); } catch (caught) { registrationError = caught.message; }
      try { await global.restartService({ root: process.argv[3] }); } catch (caught) { error = caught.message; }
      process.stdout.write(JSON.stringify({ fingerprint: global.RUNTIME_FINGERPRINT, root: global.rootPath(),
        observed: report.service, auditStatus: report.status, error, registrationError }));
    })().catch(error => { process.stderr.write(error.stack); process.exitCode = 1; });
  `;
  const result = spawnSync(process.execPath, ['-e', script, path.join(runtime, 'audit.cjs'), entry, root, project],
    { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.fingerprint, null); assert.equal(observed.observed, null);
  assert.equal(observed.auditStatus, 'WARN');
  assert.equal(typeof observed.root, 'string'); assert.equal(observed.error, 'runtime_closure_unattested');
  assert.equal(observed.registrationError, 'runtime_closure_unattested');
  assert.equal(fs.existsSync(root), false, 'mutation refusal happens before registration or startup files');
});

test('explicit restart replaces one verified stale receiver on the same ports and preserves registrations and deduplication', async t => {
  if (process.platform !== 'linux') return t.skip('owned process and socket identity are Linux-only');
  const f = fixture(t), oldRuntime = path.join(path.dirname(f.root), 'source-runtime');
  fs.cpSync(__dirname, oldRuntime, { recursive: true });
  fs.appendFileSync(path.join(oldRuntime, 'codex-otlp.cjs'), '\n// old loaded fixture\n');
  const oldEntry = path.join(oldRuntime, 'global.cjs');
  const launched = await launchRuntime(oldEntry, f.root);
  t.after(() => { try { launched.child.kill('SIGTERM'); } catch {} return stopOwned(f.root); });
  const oldIdentity = processIdentity(launched.service.pid);
  assert.equal(oldIdentity.argv[2], fs.realpathSync(oldEntry));
  assert.equal(oldIdentity.executable, fs.realpathSync(oldIdentity.argv[0]));
  assert.notEqual(launched.service.runtime_fingerprint, RUNTIME_FINGERPRINT);
  const run = registerRun({ root: f.root, projectDir: f.projects[0] });
  assert.equal((await send({ urls: launched.service.urls }, run, payload('stable-session', 'stable-request'))).status, 200);
  record({ session_id: run.run_id, rate_limits: { seven_day: { used_percentage: 17, resets_at: 1789250400 } } },
    { stateDir: run.state_dir, runId: run.run_id });
  assert.ok(fs.readdirSync(path.join(run.state_dir, 'quota-spool')).length > 0, 'queued evidence exists before transition');
  const ordinary = await ensureService(f.root);
  assert.equal(ordinary.pid, launched.service.pid, 'ordinary launch must not upgrade a healthy stale receiver');
  let pendingChecked = false;
  await assert.rejects(restartService({ root: f.root, trustedSourceEntry: oldEntry, transitionObserver: async phase => {
    if (phase === 'prepared') {
      await assert.rejects(ensureService(f.root), /transition_pending/); pendingChecked = true;
      throw new Error('fixture_requester_stopped');
    }
  } }), /fixture_requester_stopped/);
  assert.equal(pendingChecked, true, 'a pending journal preempts the healthy fast path');
  const command = spawnSync(process.execPath, [__filename.replace(/\.test\.cjs$/, '.cjs'), 'restart', '--if-running',
    '--root', f.root, '--trusted-source-entry', oldEntry], { encoding: 'utf8', timeout: 8000 });
  assert.equal(command.status, 0, command.stderr); const output = JSON.parse(command.stdout);
  assert.deepEqual(output, { status: 'restarted', runtime_fingerprint: RUNTIME_FINGERPRINT });
  const result = { status: output.status, service: await status(f.root) };
  assert.equal(result.status, 'restarted');
  assert.deepEqual(result.service.urls, launched.service.urls, 'all three endpoint URLs remain stable');
  assert.notEqual(result.service.pid, launched.service.pid); assert.equal(result.service.runtime_fingerprint, RUNTIME_FINGERPRINT);
  assert.equal(owned(launched.service.process_identity), false);
  const ports = Object.values(result.service.urls).map(url => Number(new URL(url).port));
  assert.equal(ports.every(port => ownsPort(result.service.pid, port)), true);
  assert.equal((await send({ urls: result.service.urls }, run, payload('stable-session', 'stable-request'))).status, 200);
  await untilValue(() => fs.existsSync(run.metrics_dir) && rows(run).some(event => event.event_type === 'quota'));
  assert.equal(rows(run).filter(event => event.event_type === 'api_request').length, 1, 'replayed duplicate remains deduplicated');
  const journal = JSON.parse(fs.readFileSync(path.join(f.root, 'receiver-transition.json'), 'utf8'));
  assert.equal(journal.phase, 'complete'); assert.equal(journal.replacement_identity.pid, result.service.pid);
  assert.match(fs.readFileSync(path.join(f.root, 'sgsd-atlas-gaps.jsonl'), 'utf8'), /receiver_revision_transition/);
  fs.writeFileSync(path.join(f.root, 'receiver-transition.json'), JSON.stringify({ ...journal, phase: 'service_ready',
    replacement_identity: { ...journal.replacement_identity, start_time: differentStartTime(journal.replacement_identity.start_time) } }));
  await assert.rejects(restartService({ root: f.root, trustedSourceEntry: oldEntry }), /replacement_identity_mismatch/);
  assert.ok(processIdentity(result.service.pid), 'failed recovery proof cannot terminate the healthy replacement');
});

test('explicit restart is a no-op for absent and disabled roots', async t => {
  if (process.platform !== 'linux') return t.skip('Linux receiver transition');
  const root = path.join(os.tmpdir(), `atlas-restart-${crypto.randomUUID()}`);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal((await restartService({ root })).status, 'absent');
  fs.mkdirSync(root, { recursive: true, mode: 0o700 }); fs.writeFileSync(path.join(root, 'disabled'), '');
  assert.equal((await restartService({ root })).status, 'disabled');
  assert.equal(fs.existsSync(path.join(root, 'receiver-transition.json')), false);
  fs.unlinkSync(path.join(root, 'disabled'));
  const before = process.env.SGSD_ATLAS_DISABLED; process.env.SGSD_ATLAS_DISABLED = '1';
  try { assert.equal((await restartService({ root })).status, 'disabled'); }
  finally { if (before === undefined) delete process.env.SGSD_ATLAS_DISABLED; else process.env.SGSD_ATLAS_DISABLED = before; }
});

test('explicit restart waits for an owned ordinary startup instead of declaring the receiver absent', async t => {
  if (process.platform !== 'linux') return t.skip('owned process and socket identity are Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-transition-starting-'));
  const root = path.join(base, 'global'), runtime = path.join(base, 'old-runtime'), resume = path.join(base, 'resume');
  fs.cpSync(__dirname, runtime, { recursive: true }); fs.appendFileSync(path.join(runtime, 'codex-otlp.cjs'), '\n// starting old fixture\n');
  const entry = path.join(runtime, 'global.cjs'), token = crypto.randomUUID();
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const child = spawn('/bin/bash', ['-c', 'while [ ! -f "$1" ]; do sleep 0.01; done; exec "$2" --max-old-space-size=256 "$3" serve --root "$4" --startup-token "$5"',
    'atlas-starting-fixture', resume, process.execPath, entry, root, token], { stdio: 'ignore' });
  try {
    const identity = await untilValue(() => processIdentity(child.pid));
    fs.writeFileSync(path.join(root, 'startup.lock'), JSON.stringify({ pid: child.pid, token, identity }), { mode: 0o600 });
    await assert.rejects(restartService({ root, trustedSourceEntry: entry, timeoutMs: 80 }), /startup_busy/);
    fs.writeFileSync(resume, 'continue');
    const old = await untilValue(() => status(root));
    const restarted = await restartService({ root, trustedSourceEntry: entry });
    assert.equal(restarted.status, 'restarted'); assert.notEqual(restarted.service.pid, old.pid);
  } finally {
    fs.writeFileSync(resume, 'continue'); try { child.kill('SIGTERM'); } catch {}
    await stopOwned(root); fs.rmSync(base, { recursive: true, force: true });
  }
});

test('modern service identity is the exact service pid identity, not merely another owned live process', async t => {
  if (process.platform !== 'linux') return t.skip('owned process identity is Linux-only');
  const f = fixture(t), entry = __filename.replace(/\.test\.cjs$/, '.cjs'), launched = await launchRuntime(entry, f.root);
  const serviceFile = path.join(f.root, 'service.json');
  const original = JSON.parse(fs.readFileSync(serviceFile, 'utf8'));
  try {
    fs.writeFileSync(serviceFile, JSON.stringify({ ...original, process_identity: processIdentity(process.pid) }));
    await assert.rejects(restartService({ root: f.root, trustedSourceEntry: entry }), /service_identity/);
    assert.ok(processIdentity(launched.service.pid), 'mismatched identity metadata is never signal authority');
  } finally {
    fs.writeFileSync(serviceFile, JSON.stringify(original)); try { launched.child.kill('SIGTERM'); } catch {} await stopOwned(f.root);
  }
});

test('completed transition history permits genuine absence but not a still-live unrecorded replacement', async t => {
  if (process.platform !== 'linux') return t.skip('owned process identity is Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-transition-complete-'));
  const root = path.join(base, 'global'), runtime = path.join(base, 'old-runtime');
  fs.cpSync(__dirname, runtime, { recursive: true }); fs.appendFileSync(path.join(runtime, 'codex-otlp.cjs'), '\n// completed old fixture\n');
  const entry = path.join(runtime, 'global.cjs'), launched = await launchRuntime(entry, root);
  try {
    const result = await restartService({ root, trustedSourceEntry: entry });
    const serviceFile = path.join(root, 'service.json'), service = JSON.parse(fs.readFileSync(serviceFile, 'utf8'));
    fs.unlinkSync(serviceFile);
    await assert.rejects(restartService({ root, trustedSourceEntry: entry }), /service_health_unverified/);
    fs.writeFileSync(serviceFile, JSON.stringify(service));
    process.kill(result.service.pid, 'SIGTERM'); await untilValue(() => !owned(result.service.process_identity));
    assert.equal(fs.existsSync(serviceFile), false);
    assert.equal((await restartService({ root, trustedSourceEntry: entry })).status, 'absent');
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'receiver-transition.json'), 'utf8')).phase, 'complete');
  } finally {
    try { launched.child.kill('SIGTERM'); } catch {} await stopOwned(root); fs.rmSync(base, { recursive: true, force: true });
  }
});

test('global receiver closes its collector before listeners and store on normal and partial startup failure', async t => {
  const f = fixture(t), events = [];
  const storeFactory = () => ({ close() { events.push('store'); } });
  const collectorFactory = () => ({ close() { events.push('collector'); } });
  await assert.rejects(startGlobal({ root: f.root, storeFactory,
    collectorFactory,
    serverFactory: async () => { throw new Error('bind_fixture'); } }), /bind_fixture/);
  assert.deepEqual(events, ['collector','store']);
  events.length = 0;
  const instance = await startGlobal({ root: f.root, storeFactory, collectorFactory, serverFactory: async options => ({
    operationalCollector: options.operationalCollector,
    instanceId: options.instanceId, urls: { ingest: 'http://127.0.0.1:1', health: 'http://127.0.0.1:2', metrics: 'http://127.0.0.1:3' },
    close: async () => { assert.deepEqual(events, ['collector']); await new Promise(resolve => setTimeout(resolve, 10)); events.push('servers'); },
  }) });
  assert.ok(instance.operationalCollector);
  const first = instance.close(), second = instance.close();
  assert.equal(first, second); await first; assert.deepEqual(events, ['collector','servers', 'store']);
});

test('transition retry reconciles requester failure before and after child lock handoff without a duplicate listener', async t => {
  if (process.platform !== 'linux') return t.skip('owned process and socket identity are Linux-only');
  for (const fault of ['child_launched', 'handoff']) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), `atlas-transition-${fault}-`));
    const root = path.join(base, 'global'), project = path.join(base, 'project'), runtime = path.join(base, 'old-runtime');
    fs.mkdirSync(path.join(project, '.planning'), { recursive: true }); fs.cpSync(__dirname, runtime, { recursive: true });
    fs.appendFileSync(path.join(runtime, 'codex-otlp.cjs'), `\n// ${fault} old fixture\n`);
    const entry = path.join(runtime, 'global.cjs'), launched = await launchRuntime(entry, root);
    try {
      await assert.rejects(restartService({ root, trustedSourceEntry: entry,
        transitionObserver(phase) { if (phase === fault) throw new Error(`fixture_${fault}`); } }), new RegExp(`fixture_${fault}`));
      const interrupted = JSON.parse(fs.readFileSync(path.join(root, 'receiver-transition.json'), 'utf8'));
      const candidate = interrupted.candidate_identity;
      assert.ok(candidate?.pid > 0, 'spawn is durably identified before either fault boundary');
      const result = await restartService({ root, trustedSourceEntry: entry });
      assert.equal(result.status, 'restarted');
      if (fault === 'handoff') assert.equal(result.service.pid, candidate.pid, 'retry adopts the authorized handed-off child');
      else {
        assert.notEqual(result.service.pid, candidate.pid, 'an unhanded child cannot become the receiver');
        await untilValue(() => !owned(candidate), 2500);
      }
      const ports = Object.values(result.service.urls).map(url => Number(new URL(url).port));
      assert.equal(ports.every(port => ownsPort(result.service.pid, port)), true);
    } finally {
      try { launched.child.kill('SIGTERM'); } catch {} await stopOwned(root); fs.rmSync(base, { recursive: true, force: true });
    }
  }
});

test('test cleanup terminates an exact transitional candidate when no service record exists', async t => {
  if (process.platform !== 'linux') return t.skip('owned process and socket identity are Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-transition-cleanup-'));
  const root = path.join(base, 'global'), runtime = path.join(base, 'old-runtime');
  fs.cpSync(__dirname, runtime, { recursive: true }); fs.appendFileSync(path.join(runtime, 'codex-otlp.cjs'), '\n// cleanup old fixture\n');
  const entry = path.join(runtime, 'global.cjs'), launched = await launchRuntime(entry, root); let candidate;
  try {
    await assert.rejects(restartService({ root, trustedSourceEntry: entry,
      transitionObserver(phase) { if (phase === 'child_launched') throw new Error('fixture_cleanup'); } }), /fixture_cleanup/);
    const journal = JSON.parse(fs.readFileSync(path.join(root, 'receiver-transition.json'), 'utf8'));
    candidate = journal.candidate_identity;
    assert.ok(candidate && owned(candidate), 'fault leaves an exact test-owned transitional candidate');
    assert.equal(fs.existsSync(path.join(root, 'service.json')), false, 'candidate has not published service identity');
    await stopOwned(root);
    assert.equal(owned(candidate), false, 'cleanup uses the transition journal to stop the exact candidate');
  } finally {
    if (candidate && owned(candidate)) { process.kill(candidate.pid, 'SIGTERM'); await untilValue(() => !owned(candidate), 3000); }
    try { launched.child.kill('SIGTERM'); } catch {} await stopOwned(root); fs.rmSync(base, { recursive: true, force: true });
  }
});

test('transition timeout returns boundedly, retains its journal and requires explicit retry', async t => {
  if (process.platform !== 'linux') return t.skip('owned process and socket identity are Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-transition-timeout-'));
  const root = path.join(base, 'global'), runtime = path.join(base, 'old-runtime');
  fs.cpSync(__dirname, runtime, { recursive: true }); fs.appendFileSync(path.join(runtime, 'codex-otlp.cjs'), '\n// timeout fixture\n');
  const entry = path.join(runtime, 'global.cjs'), launched = await launchRuntime(entry, root);
  try {
    const started = Date.now();
    await assert.rejects(restartService({ root, trustedSourceEntry: entry, timeoutMs: 20,
      transitionObserver: phase => phase === 'prepared' ? new Promise(resolve => setTimeout(resolve, 35)) : undefined }), /_timeout/);
    assert.ok(Date.now() - started < 1000, 'requester timeout remains bounded without force-killing');
    const journalFile = path.join(root, 'receiver-transition.json');
    if (fs.existsSync(journalFile)) assert.notEqual(JSON.parse(fs.readFileSync(journalFile, 'utf8')).phase, 'complete');
    else assert.equal(owned(launched.service.process_identity), true, 'pre-prepare expiry cannot signal the old receiver');
    assert.equal((await restartService({ root, trustedSourceEntry: entry })).status, 'restarted');
  } finally {
    try { launched.child.kill('SIGTERM'); } catch {} await stopOwned(root); fs.rmSync(base, { recursive: true, force: true });
  }
});

test('an expired prepared boundary performs no revalidation, signal, port scan or spawn before explicit retry', async t => {
  if (process.platform !== 'linux') return t.skip('owned process and socket identity are Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-transition-expired-boundary-'));
  const root = path.join(base, 'global'), runtime = path.join(base, 'old-runtime');
  fs.cpSync(__dirname, runtime, { recursive: true }); fs.appendFileSync(path.join(runtime, 'codex-otlp.cjs'), '\n// expired boundary fixture\n');
  const entry = path.join(runtime, 'global.cjs'), launched = await launchRuntime(entry, root), phases = [];
  const realNow = Date.now, timeoutMs = 5000;
  try {
    const started = realNow();
    await assert.rejects(restartService({ root, trustedSourceEntry: entry, timeoutMs,
      transitionObserver: phase => {
        phases.push(phase);
        if (phase === 'prepared') Date.now = () => realNow() + timeoutMs + 10000;
      } }), /receiver_transition_timeout/);
    Date.now = realNow;
    assert.ok(realNow() - started < 1000, 'expired boundary returns without a hidden all-process scan');
    assert.deepEqual(phases, ['prepared'], 'no post-deadline transition boundary is entered');
    assert.equal(owned(launched.service.process_identity), true, 'the old exact receiver is not signalled after the deadline');
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'receiver-transition.json'), 'utf8')).phase, 'prepared',
      'the durable pending journal remains at the last completed boundary');
    assert.equal((await restartService({ root, trustedSourceEntry: entry })).status, 'restarted',
      'only an explicit retry resumes the retained transition');
  } finally {
    Date.now = realNow;
    try { launched.child.kill('SIGTERM'); } catch {} await stopOwned(root); fs.rmSync(base, { recursive: true, force: true });
  }
});

test('deadline expiry immediately after lock acquisition releases the requester lock for explicit retry', async t => {
  if (process.platform !== 'linux') return t.skip('owned process and socket identity are Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-transition-expired-lock-'));
  const root = path.join(base, 'global'), runtime = path.join(base, 'old-runtime');
  fs.cpSync(__dirname, runtime, { recursive: true }); fs.appendFileSync(path.join(runtime, 'codex-otlp.cjs'), '\n// expired lock fixture\n');
  const entry = path.join(runtime, 'global.cjs'), launched = await launchRuntime(entry, root);
  const realFsync = fs.fsyncSync; let delayed = false;
  try {
    fs.fsyncSync = fd => {
      realFsync(fd);
      if (!delayed) { delayed = true; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 35); }
    };
    await assert.rejects(restartService({ root, trustedSourceEntry: entry, timeoutMs: 20 }), /receiver_transition_timeout/);
    fs.fsyncSync = realFsync;
    assert.equal(fs.existsSync(path.join(root, 'startup.lock')), false, 'expired requester lock is released by its owner');
    assert.equal((await restartService({ root, trustedSourceEntry: entry })).status, 'restarted',
      'the still-alive requester can explicitly retry without waiting for itself');
  } finally {
    fs.fsyncSync = realFsync;
    try { launched.child.kill('SIGTERM'); } catch {} await stopOwned(root); fs.rmSync(base, { recursive: true, force: true });
  }
});

test('a deadline expiring during the current listener-table scan stops boundedly and retains completed history', async t => {
  if (process.platform !== 'linux') return t.skip('owned process and socket identity are Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-transition-scan-deadline-'));
  const root = path.join(base, 'global'), runtime = path.join(base, 'old-runtime');
  fs.cpSync(__dirname, runtime, { recursive: true }); fs.appendFileSync(path.join(runtime, 'codex-otlp.cjs'), '\n// scan deadline fixture\n');
  const entry = path.join(runtime, 'global.cjs'), launched = await launchRuntime(entry, root);
  const realReadFile = fs.readFileSync;
  try {
    const restarted = await restartService({ root, trustedSourceEntry: entry });
    process.kill(restarted.service.pid, 'SIGTERM');
    await untilValue(() => !owned(restarted.service.process_identity));
    await untilValue(() => !fs.existsSync(path.join(root, 'service.json')));
    const completed = fs.readFileSync(path.join(root, 'receiver-transition.json'), 'utf8');
    const scanPort = Number(new URL(restarted.service.urls.ingest).port);
    fs.readFileSync = (target, ...args) => {
      if (target === '/proc/self/net/tcp') {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60);
        return procTcp(scanPort, 'deadline-fixture');
      }
      return target === '/proc/self/net/tcp6' ? procTcp() : realReadFile(target, ...args);
    };
    const started = Date.now();
    await assert.rejects(restartService({ root, trustedSourceEntry: entry, timeoutMs: 50 }), /receiver_transition_timeout/);
    const elapsed = Date.now() - started;
    fs.readFileSync = realReadFile;
    assert.ok(elapsed < 200, `deadline is checked within the scan, elapsed=${elapsed}ms`);
    assert.equal(fs.readFileSync(path.join(root, 'receiver-transition.json'), 'utf8'), completed, 'completed history is not rewritten');
    assert.equal((await restartService({ root, trustedSourceEntry: entry })).status, 'absent', 'explicit retry observes genuine absence');
  } finally {
    fs.readFileSync = realReadFile;
    try { launched.child.kill('SIGTERM'); } catch {} await stopOwned(root); fs.rmSync(base, { recursive: true, force: true });
  }
});

test('completed history reads the current network namespace once for all port ownership checks', async t => {
  if (process.platform !== 'linux') return t.skip('owned process and socket identity are Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-transition-batched-scan-'));
  const root = path.join(base, 'global'), ports = { ingest: 64991, health: 64992, metrics: 64993 };
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(root, 'receiver-transition.json'), JSON.stringify({
    schema_version: 1, token: crypto.randomUUID(), phase: 'complete', root_id: digest(root),
    replacement_identity: stoppedFixtureIdentity(),
    urls: Object.fromEntries(Object.entries(ports).map(([name, port]) => [name, `http://127.0.0.1:${port}`])), ports,
  }));
  const realReaddir = fs.readdirSync, realReadFile = fs.readFileSync; let networkTableReads = 0;
  try {
    fs.readdirSync = (target, ...args) => target === '/proc' ? Array(100).fill(String(process.pid)) : realReaddir(target, ...args);
    fs.readFileSync = (target, ...args) => {
      if (/^\/proc\/self\/net\/tcp6?$/.test(String(target))) networkTableReads++;
      return realReadFile(target, ...args);
    };
    assert.equal((await restartService({ root })).status, 'absent');
  } finally {
    fs.readdirSync = realReaddir; fs.readFileSync = realReadFile;
    await stopOwned(root); fs.rmSync(base, { recursive: true, force: true });
  }
  assert.equal(networkTableReads, 2, 'one authoritative namespace table pair serves every requested port');
});

test('an observable current-namespace listener with an unreadable owner fails closed', async t => {
  if (process.platform !== 'linux') return t.skip('network namespace evidence is Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-transition-owner-unknown-'));
  const root = path.join(base, 'global'), ports = { ingest: 64981, health: 64982, metrics: 64983 };
  completedTransition(root, ports);
  const realReaddir = fs.readdirSync, realReadlink = fs.readlinkSync, realReadFile = fs.readFileSync; let descriptorReads = 0;
  try {
    fs.readdirSync = (target, ...args) => {
      if (target === '/proc') return ['101'];
      if (target === '/proc/101/fd') { descriptorReads++; const error = new Error('fixture denied'); error.code = 'EACCES'; throw error; }
      return realReaddir(target, ...args);
    };
    fs.readlinkSync = (target, ...args) => {
      if (target === '/proc/self/ns/net' || target === '/proc/101/ns/net') return 'net:[fixture-current]';
      return realReadlink(target, ...args);
    };
    fs.readFileSync = (target, ...args) => {
      if (target === '/proc/self/net/tcp') return procTcp(ports.ingest, '9001');
      if (target === '/proc/self/net/tcp6') return procTcp();
      return realReadFile(target, ...args);
    };
    await assert.rejects(restartService({ root }), /receiver_port_taken/);
    assert.equal(descriptorReads, 0, 'authoritative listener evidence does not require an owner PID traversal');
  } finally {
    fs.readdirSync = realReaddir; fs.readlinkSync = realReadlink; fs.readFileSync = realReadFile;
    await stopOwned(root); fs.rmSync(base, { recursive: true, force: true });
  }
});

test('an unreadable current-namespace listener table is not reported as proven vacant', async t => {
  if (process.platform !== 'linux') return t.skip('network namespace evidence is Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-transition-table-unknown-'));
  const root = path.join(base, 'global'), ports = { ingest: 64971, health: 64972, metrics: 64973 };
  completedTransition(root, ports);
  const realReaddir = fs.readdirSync, realReadlink = fs.readlinkSync, realReadFile = fs.readFileSync;
  try {
    fs.readdirSync = (target, ...args) => target === '/proc' ? ['101'] : realReaddir(target, ...args);
    fs.readlinkSync = (target, ...args) => target === '/proc/self/ns/net' ? 'net:[fixture-current]' : realReadlink(target, ...args);
    fs.readFileSync = (target, ...args) => {
      if (target === '/proc/self/net/tcp') { const error = new Error('fixture denied'); error.code = 'EACCES'; throw error; }
      if (target === '/proc/self/net/tcp6') return procTcp();
      return realReadFile(target, ...args);
    };
    await assert.rejects(restartService({ root }), /receiver_port_ownership_unverified/);
  } finally {
    fs.readdirSync = realReaddir; fs.readlinkSync = realReadlink; fs.readFileSync = realReadFile;
    await stopOwned(root); fs.rmSync(base, { recursive: true, force: true });
  }
});

test('a listener in a different network namespace does not occupy a current-namespace receiver port', async t => {
  if (process.platform !== 'linux') return t.skip('network namespace evidence is Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-transition-other-namespace-'));
  const root = path.join(base, 'global'), ports = { ingest: 64961, health: 64962, metrics: 64963 };
  completedTransition(root, ports);
  const realReaddir = fs.readdirSync, realReadlink = fs.readlinkSync, realReadFile = fs.readFileSync;
  try {
    fs.readdirSync = (target, ...args) => {
      if (target === '/proc') return ['202'];
      if (target === '/proc/202/fd') return ['5'];
      return realReaddir(target, ...args);
    };
    fs.readlinkSync = (target, ...args) => {
      if (target === '/proc/self/ns/net') return 'net:[fixture-current]';
      if (target === '/proc/202/ns/net') return 'net:[fixture-other]';
      if (target === '/proc/202/fd/5') return 'socket:[9002]';
      return realReadlink(target, ...args);
    };
    fs.readFileSync = (target, ...args) => {
      if (target === '/proc/self/net/tcp' || target === '/proc/self/net/tcp6') return procTcp();
      if (target === '/proc/202/net/tcp') return procTcp(ports.ingest, '9002');
      if (target === '/proc/202/net/tcp6') return procTcp();
      return realReadFile(target, ...args);
    };
    assert.equal((await restartService({ root })).status, 'absent');
  } finally {
    fs.readdirSync = realReaddir; fs.readlinkSync = realReadlink; fs.readFileSync = realReadFile;
    await stopOwned(root); fs.rmSync(base, { recursive: true, force: true });
  }
});

test('proven-vacant current namespace ignores an unrelated process with unreadable descriptors', async t => {
  if (process.platform !== 'linux') return t.skip('network namespace evidence is Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-transition-unrelated-denied-'));
  const root = path.join(base, 'global'), ports = { ingest: 64951, health: 64952, metrics: 64953 };
  completedTransition(root, ports);
  const realReaddir = fs.readdirSync, realReadlink = fs.readlinkSync, realReadFile = fs.readFileSync; let descriptorReads = 0;
  try {
    fs.readdirSync = (target, ...args) => {
      if (target === '/proc') return ['303'];
      if (target === '/proc/303/fd') { descriptorReads++; const error = new Error('fixture denied'); error.code = 'EACCES'; throw error; }
      return realReaddir(target, ...args);
    };
    fs.readlinkSync = (target, ...args) => target === '/proc/self/ns/net' ? 'net:[fixture-current]' : realReadlink(target, ...args);
    fs.readFileSync = (target, ...args) => target === '/proc/self/net/tcp' || target === '/proc/self/net/tcp6'
      ? procTcp() : realReadFile(target, ...args);
    assert.equal((await restartService({ root })).status, 'absent');
    assert.equal(descriptorReads, 0, 'unrelated PID visibility is unnecessary after authoritative vacancy proof');
  } finally {
    fs.readdirSync = realReaddir; fs.readlinkSync = realReadlink; fs.readFileSync = realReadFile;
    await stopOwned(root); fs.rmSync(base, { recursive: true, force: true });
  }
});

test('deadline expiry during durable handoff persistence cannot transfer startup ownership to the child', async t => {
  if (process.platform !== 'linux') return t.skip('owned process and socket identity are Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-transition-handoff-deadline-'));
  const root = path.join(base, 'global'), runtime = path.join(base, 'old-runtime');
  fs.cpSync(__dirname, runtime, { recursive: true }); fs.appendFileSync(path.join(runtime, 'codex-otlp.cjs'), '\n// handoff deadline fixture\n');
  const entry = path.join(runtime, 'global.cjs'), launched = await launchRuntime(entry, root);
  const realFsync = fs.fsyncSync, realNow = Date.now; let delayHandoff = false, delayed = false, candidate;
  const phases = [], timeoutMs = 15000;
  try {
    await assert.rejects(restartService({ root, trustedSourceEntry: entry, timeoutMs,
      transitionObserver: phase => {
        phases.push(phase);
        if (phase === 'child_launched') {
          delayHandoff = true;
          fs.fsyncSync = fd => {
            realFsync(fd);
            if (delayHandoff && !delayed) {
              delayed = true;
              Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 35);
              Date.now = () => realNow() + timeoutMs + 10000;
            }
          };
        }
      } }), /receiver_transition_timeout/);
    fs.fsyncSync = realFsync; Date.now = realNow;
    const journal = JSON.parse(fs.readFileSync(path.join(root, 'receiver-transition.json'), 'utf8'));
    candidate = journal.candidate_identity;
    assert.equal(delayed, true, 'the handoff journal fsync crossed the deadline');
    assert.deepEqual(phases, ['prepared', 'old_stopped', 'child_launched'], 'no post-deadline handoff boundary is entered');
    assert.equal(journal.phase, 'handoff', 'durable recovery identity remains at the completed handoff write');
    assert.deepEqual(journal.old_identity, launched.service.process_identity, 'the exact stopped receiver identity remains recoverable');
    assert.ok(candidate && owned(candidate), 'the waiting candidate identity is retained for exact cleanup and retry');
    assert.equal(fs.existsSync(path.join(root, 'startup.lock')), false, 'requester ownership is released instead of transferred after expiry');
    assert.equal(fs.existsSync(path.join(root, 'service.json')), false, 'the candidate cannot publish a service after expiry');
    process.kill(candidate.pid, 'SIGTERM'); await untilValue(() => !owned(candidate), 3000);
    candidate = null;
    assert.equal((await restartService({ root, trustedSourceEntry: entry })).status, 'restarted',
      'an explicit retry recovers from the durable handoff identity');
  } finally {
    fs.fsyncSync = realFsync; Date.now = realNow;
    if (!candidate) {
      try { candidate = JSON.parse(fs.readFileSync(path.join(root, 'receiver-transition.json'), 'utf8')).candidate_identity; } catch {}
    }
    if (candidate && owned(candidate)) { process.kill(candidate.pid, 'SIGTERM'); await untilValue(() => !owned(candidate), 3000); }
    try { launched.child.kill('SIGTERM'); } catch {} await stopOwned(root); fs.rmSync(base, { recursive: true, force: true });
  }
});

test('identity change and foreign same-port takeover fail closed with the transition journal retained', async t => {
  if (process.platform !== 'linux') return t.skip('owned process and socket identity are Linux-only');
  for (const fault of ['identity', 'foreign-port']) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), `atlas-transition-${fault}-`));
    const root = path.join(base, 'global'), runtime = path.join(base, 'old-runtime');
    fs.cpSync(__dirname, runtime, { recursive: true }); fs.appendFileSync(path.join(runtime, 'codex-otlp.cjs'), '\n// stale fixture\n');
    const entry = path.join(runtime, 'global.cjs'), launched = await launchRuntime(entry, root);
    let foreign;
    try {
      await assert.rejects(restartService({ root, trustedSourceEntry: entry, transitionObserver: async (phase, journal) => {
        if (fault === 'identity' && phase === 'prepared') {
          const service = JSON.parse(fs.readFileSync(path.join(root, 'service.json'), 'utf8'));
          service.process_identity = { ...service.process_identity,
            start_time: differentStartTime(service.process_identity.start_time) };
          fs.writeFileSync(path.join(root, 'service.json'), JSON.stringify(service));
        }
        if (fault === 'foreign-port' && phase === 'old_stopped') {
          foreign = net.createServer(); await new Promise((resolve, reject) => {
            foreign.once('error', reject); foreign.listen(journal.ports.ingest, '127.0.0.1', resolve);
          });
        }
      } }), fault === 'identity' ? /service_identity_changed/ : /receiver_port_taken/);
      assert.ok(fs.existsSync(path.join(root, 'receiver-transition.json')), 'retry evidence is never discarded');
      assert.notEqual(JSON.parse(fs.readFileSync(path.join(root, 'receiver-transition.json'), 'utf8')).phase, 'complete');
      if (fault === 'identity') assert.ok(processIdentity(launched.service.pid), 'changed identity record is not authority to signal');
      else {
        assert.equal(ownsPort(process.pid, foreign.address().port), true, 'foreign listener is not terminated');
        await new Promise(resolve => foreign.close(resolve)); foreign = null;
        assert.equal((await restartService({ root, trustedSourceEntry: entry })).status, 'restarted', 'explicit retry resumes retained journal');
      }
    } finally {
      if (foreign) await new Promise(resolve => foreign.close(resolve));
      try { launched.child.kill('SIGTERM'); } catch {} await stopOwned(root); fs.rmSync(base, { recursive: true, force: true });
    }
  }
});

test('concurrent explicit restarts serialize before journal creation and converge on one replacement', async t => {
  if (process.platform !== 'linux') return t.skip('owned process and socket identity are Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-transition-race-'));
  const root = path.join(base, 'global'), runtime = path.join(base, 'old-runtime');
  fs.cpSync(__dirname, runtime, { recursive: true }); fs.appendFileSync(path.join(runtime, 'codex-otlp.cjs'), '\n// stale race fixture\n');
  const entry = path.join(runtime, 'global.cjs'), launched = await launchRuntime(entry, root);
  let releasePrepared, observedPrepared;
  const hold = new Promise(resolve => { releasePrepared = resolve; });
  const seen = new Promise(resolve => { observedPrepared = resolve; });
  try {
    const first = restartService({ root, trustedSourceEntry: entry, transitionObserver: async phase => {
      if (phase === 'prepared') { observedPrepared(); await hold; }
    } });
    await seen;
    const second = restartService({ root, trustedSourceEntry: entry });
    await new Promise(resolve => setTimeout(resolve, 60)); releasePrepared();
    const [left, right] = await Promise.all([first, second]);
    assert.equal(left.service.pid, right.service.pid); assert.equal(left.service.instance_id, right.service.instance_id);
    const journal = JSON.parse(fs.readFileSync(path.join(root, 'receiver-transition.json'), 'utf8'));
    assert.equal(journal.phase, 'complete'); assert.equal(journal.replacement_identity.pid, left.service.pid);
  } finally {
    releasePrepared?.(); try { launched.child.kill('SIGTERM'); } catch {} await stopOwned(root); fs.rmSync(base, { recursive: true, force: true });
  }
});

test('an exact trusted source receiver can already match, and completed history permits the next software revision', async t => {
  if (process.platform !== 'linux') return t.skip('owned process and socket identity are Linux-only');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-transition-revisions-'));
  let sameRoot, root;
  try {
    const sameRuntime = path.join(base, 'same-runtime'); fs.cpSync(__dirname, sameRuntime, { recursive: true });
    sameRoot = path.join(base, 'same-root'); const same = await launchRuntime(path.join(sameRuntime, 'global.cjs'), sameRoot);
    assert.equal(same.service.runtime_fingerprint, RUNTIME_FINGERPRINT);
    const unchanged = await restartService({ root: sameRoot, trustedSourceEntry: path.join(sameRuntime, 'global.cjs') });
    assert.equal(unchanged.status, 'already_current'); assert.equal(unchanged.service.pid, same.service.pid);
    same.child.kill('SIGTERM'); await untilValue(() => !owned(same.service.process_identity));

    const oldRuntime = path.join(base, 'old-runtime'); fs.cpSync(__dirname, oldRuntime, { recursive: true });
    fs.appendFileSync(path.join(oldRuntime, 'codex-otlp.cjs'), '\n// revision A\n');
    root = path.join(base, 'revision-root'); const old = await launchRuntime(path.join(oldRuntime, 'global.cjs'), root);
    const first = await restartService({ root, trustedSourceEntry: path.join(oldRuntime, 'global.cjs') });
    assert.equal(first.status, 'restarted');
    const nextRuntime = path.join(base, 'next-runtime'); fs.cpSync(__dirname, nextRuntime, { recursive: true });
    fs.appendFileSync(path.join(nextRuntime, 'codex-otlp.cjs'), '\n// revision C\n');
    const next = require(path.join(nextRuntime, 'global.cjs'));
    const second = await next.restartService({ root, trustedSourceEntry: __filename.replace(/\.test\.cjs$/, '.cjs') });
    assert.equal(second.status, 'restarted'); assert.notEqual(second.service.runtime_fingerprint, first.service.runtime_fingerprint);
    assert.equal(second.service.runtime_fingerprint, next.RUNTIME_FINGERPRINT);
    await stopOwned(root); try { old.child.kill('SIGTERM'); } catch {}
  } finally {
    if (sameRoot) await stopOwned(sameRoot);
    if (root) await stopOwned(root);
    fs.rmSync(base, { recursive: true, force: true });
  }
});
