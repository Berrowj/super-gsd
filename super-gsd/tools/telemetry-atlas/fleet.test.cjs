'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { registerRun } = require('./global-store.cjs');
const entry = path.join(__dirname, 'fleet.cjs');
function api() {
  assert.ok(fs.existsSync(entry), 'fleet ownership implementation must exist');
  return require(entry);
}
function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-fleet-test-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, 'atlas');
  const projects = ['alpha', 'beta'].map(name => {
    const project = path.join(temporary, name);
    fs.mkdirSync(path.join(project, '.planning'), { recursive: true });
    return fs.realpathSync(project);
  });
  const runs = projects.map(projectDir => registerRun({ root, projectDir }));
  return { temporary, root, projects, runs, run: runs[0] };
}
function processFixture(run, overrides = {}) {
  return { state: 'alive', pid: 12001, start_time: '987654', executable: '/fixture/claude',
    environment: { SGSD_RUN_ID: run.run_id, SGSD_ATLAS_PROJECT_ID: run.project_id,
      PRIVATE_SECRET: 'NEVER_PERSIST_ENV' }, argv: ['NEVER_PERSIST_ARGV'], ...overrides };
}
const options = f => ({ root: f.root, runId: f.run.run_id, projectDir: f.projects[0], pid: 12001,
  sessionId: 'session-123', tmux: { server_pid: 11000, session_id: '$1', session_name: 'alpha', pane_id: '%3', socket_path: '/tmp/tmux-1000/default' } });
function inventory(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).flatMap(name => {
    const file = path.join(directory, name), s = fs.lstatSync(file);
    return s.isDirectory() ? inventory(file) : [{ file, body: fs.readFileSync(file, 'utf8'), mtime: s.mtimeMs }];
  });
}

test('registered projects share one durable coordinator and same-run reserve is idempotent', t => {
  const f = fixture(t), fleet = api();
  const first = fleet.reserve({ root: f.root, run: f.run });
  assert.equal(first.status, 'pending'); assert.equal(first.run_id, f.run.run_id);
  assert.equal(first.project_id, f.run.project_id); assert.equal(first.project_dir, f.projects[0]);
  assert.match(first.coordinator_id, /^fleet-[a-f0-9-]{36}$/);
  assert.deepEqual(fleet.reserve({ root: f.root, run: f.run }), first);
  const other = fleet.reserve({ root: f.root, run: f.runs[1] });
  assert.equal(other.coordinator_id, first.coordinator_id);
  const queried = fleet.status({ root: f.root });
  assert.equal(queried.claims.length, 2); assert.equal(queried.coordinator_id, first.coordinator_id);
  assert.equal(queried.limited, false);
});
test('another run cannot take pending, dead, reused, or unknown project ownership', t => {
  const f = fixture(t), fleet = api(), competing = registerRun({ root: f.root, projectDir: f.projects[0] });
  fleet.reserve({ root: f.root, run: f.run });
  assert.throws(() => fleet.reserve({ root: f.root, run: competing }), /fleet_project_owned/);
  fleet.bind(options(f), { processLookup: () => processFixture(f.run) });
  for (const observed of [{ state: 'dead' }, { state: 'unknown' }, processFixture(f.run, { start_time: '999999' })]) {
    assert.equal(fleet.status({ root: f.root }, { processLookup: () => observed }).claims[0].active, false);
    assert.throws(() => fleet.reserve({ root: f.root, run: competing }), /fleet_project_owned/);
  }
});
test('registration is authoritative: forged project, unregistered run and worker role refuse', t => {
  const f = fixture(t), fleet = api();
  assert.throws(() => fleet.reserve({ root: f.root, run: { ...f.run, project_dir: f.projects[1] } }), /fleet_registration_mismatch/);
  assert.throws(() => fleet.reserve({ root: f.root, run: { ...f.run, run_id: 'sgsd-00000000-0000-0000-0000-000000000000' } }), /fleet_run_unregistered/);
  const worker = registerRun({ root: f.root, projectDir: f.projects[1], provider: 'openai', role: 'executor' });
  assert.throws(() => fleet.reserve({ root: f.root, run: worker }), /fleet_role_unsupported/);
});
test('bind requires exact project and process environment, persists selected fields only', t => {
  const f = fixture(t), fleet = api(); fleet.reserve({ root: f.root, run: f.run });
  assert.throws(() => fleet.bind({ ...options(f), projectDir: f.projects[1] }, { processLookup: () => processFixture(f.run) }), /fleet_project_mismatch/);
  for (const environment of [{ SGSD_RUN_ID: f.run.run_id }, { SGSD_RUN_ID: f.runs[1].run_id, SGSD_ATLAS_PROJECT_ID: f.run.project_id }]) {
    assert.throws(() => fleet.bind(options(f), { processLookup: () => processFixture(f.run, { environment }) }), /fleet_process_scope_mismatch/);
  }
  assert.throws(() => fleet.bind(options(f), { processLookup: () => ({ state: 'unknown' }) }), /fleet_process_unverified/);
  const bound = fleet.bind({ ...options(f), prompt: 'NEVER_PERSIST_PROMPT' }, { processLookup: () => processFixture(f.run) });
  assert.equal(bound.status, 'bound');
  assert.deepEqual(bound.identity, { pid: 12001, start_time: '987654', executable: '/fixture/claude' });
  assert.deepEqual(fleet.bind(options(f), { processLookup: () => processFixture(f.run) }), bound);
  assert.throws(() => fleet.bind({ ...options(f), sessionId: 'different-session' }, { processLookup: () => processFixture(f.run) }), /fleet_binding_conflict/);
  assert.throws(() => fleet.bind(options(f), { processLookup: () => processFixture(f.run, { start_time: '999999' }) }), /fleet_binding_conflict/);
  assert.doesNotMatch(inventory(path.join(f.root, 'fleet')).map(r => r.body).join('\n'), /NEVER_PERSIST|environment|argv|prompt/);
});
test('status is read-only and detects PID reuse or environment changes without declaring active', t => {
  const f = fixture(t), fleet = api();
  const absent = path.join(f.temporary, 'absent');
  assert.deepEqual(fleet.status({ root: absent }).claims, []); assert.equal(fs.existsSync(absent), false);
  fleet.reserve({ root: f.root, run: f.run }); fleet.bind(options(f), { processLookup: () => processFixture(f.run) });
  const before = inventory(f.root);
  const read = value => fleet.status({ root: f.root, projectDir: f.projects[0] }, { processLookup: () => value }).claims[0];
  assert.equal(read(processFixture(f.run)).active, true);
  assert.equal(read(processFixture(f.run, { start_time: '123' })).process_state, 'reused');
  assert.equal(read({ state: 'dead' }).process_state, 'dead');
  assert.equal(read({ state: 'unknown' }).process_state, 'unknown');
  assert.equal(read(processFixture(f.run, { environment: {} })).active, false);
  assert.deepEqual(inventory(f.root), before);
});
test('release refuses other owners, live/unknown processes and pending claims without explicit abort', t => {
  const f = fixture(t), fleet = api(), competing = registerRun({ root: f.root, projectDir: f.projects[0] });
  fleet.reserve({ root: f.root, run: f.run });
  assert.throws(() => fleet.release({ root: f.root, runId: competing.run_id, allowPending: true }), /fleet_owner_mismatch/);
  assert.throws(() => fleet.release({ root: f.root, runId: f.run.run_id }), /fleet_pending_abort_required/);
  fleet.bind(options(f), { processLookup: () => processFixture(f.run) });
  for (const observed of [processFixture(f.run), { state: 'unknown' }, processFixture(f.run, { environment: {} })]) {
    assert.throws(() => fleet.release({ root: f.root, runId: f.run.run_id, allowPending: true }, { processLookup: () => observed }), /fleet_process_not_dead/);
  }
});
test('explicit pending abort writes terminal receipt before removing claim and never reuses run', t => {
  const f = fixture(t), fleet = api(); fleet.reserve({ root: f.root, run: f.run });
  const receipt = fleet.release({ root: f.root, runId: f.run.run_id, allowPending: true });
  assert.equal(receipt.status, 'released'); assert.equal(receipt.reason, 'pending_launch_aborted');
  assert.equal(receipt.run_id, f.run.run_id); assert.equal(fleet.status({ root: f.root }).claims.length, 0);
  const persisted = JSON.parse(fs.readFileSync(path.join(f.root, 'fleet', 'receipts', `${f.run.run_id}.json`), 'utf8'));
  assert.deepEqual(persisted, receipt);
  assert.throws(() => fleet.reserve({ root: f.root, run: f.run }), /fleet_run_released/);
  assert.equal(fleet.reserve({ root: f.root, run: f.runs[1] }).coordinator_id, receipt.coordinator_id);
});
test('release of proved-dead or replaced original process does not signal the replacement', t => {
  const f = fixture(t), fleet = api();
  for (const [run, observed] of [[f.run, { state: 'dead' }], [f.runs[1], processFixture(f.runs[1], { start_time: '111' })]]) {
    fleet.reserve({ root: f.root, run });
    fleet.bind({ ...options(f), runId: run.run_id, projectDir: run.project_dir }, { processLookup: () => processFixture(run) });
    const receipt = fleet.release({ root: f.root, runId: run.run_id }, { processLookup: () => observed });
    assert.equal(receipt.status, 'released'); assert.equal(receipt.identity.start_time, '987654');
  }
  assert.equal(fleet.status({ root: f.root }).claims.length, 0);
});
test('symlinked root and claim paths fail closed', t => {
  const f = fixture(t), fleet = api(), alias = path.join(f.temporary, 'alias');
  fs.symlinkSync(f.root, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => fleet.status({ root: alias }), /unsafe|symlink/);
  assert.throws(() => fleet.reserve({ root: alias, run: f.run }), /unsafe|symlink/);
  fleet.reserve({ root: f.root, run: f.run });
  const claim = path.join(f.root, 'fleet', 'claims', `${f.run.project_id}.json`);
  const original = path.join(f.temporary, 'saved-claim.json'); fs.renameSync(claim, original);
  // A directory junction works without Windows symlink privileges and must also refuse.
  fs.symlinkSync(f.projects[1], claim, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => fleet.reserve({ root: f.root, run: f.run }), /unsafe|symlink/);
  assert.throws(() => fleet.release({ root: f.root, runId: f.run.run_id, allowPending: true }), /unsafe|symlink/);
});
test('pre-existing lock is never stolen and malformed ownership never becomes unowned', t => {
  const f = fixture(t), fleet = api(); fleet.reserve({ root: f.root, run: f.run });
  const claim = path.join(f.root, 'fleet', 'claims', `${f.run.project_id}.json`);
  fs.writeFileSync(claim, '{corrupt');
  const status = fleet.status({ root: f.root });
  assert.equal(status.claims[0].active, false); assert.equal(status.claims[0].process_state, 'unknown');
  assert.throws(() => fleet.reserve({ root: f.root, run: f.run }), /fleet_claim_invalid/);
  const lock = path.join(f.root, 'fleet', 'ownership.lock'); fs.writeFileSync(lock, 'unknown-owner');
  assert.throws(() => fleet.reserve({ root: f.root, run: f.runs[1] }), /fleet_busy/);
  assert.equal(fs.readFileSync(lock, 'utf8'), 'unknown-owner');
});
test('failed terminal receipt publication preserves the exact claim', t => {
  const f = fixture(t), fleet = api(); const claim = fleet.reserve({ root: f.root, run: f.run });
  fs.mkdirSync(path.join(f.root, 'fleet', 'receipts'), { recursive: true });
  const receiptPath = path.join(f.root, 'fleet', 'receipts', `${f.run.run_id}.json`);
  fs.symlinkSync(f.projects[1], receiptPath, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => fleet.release({ root: f.root, runId: f.run.run_id, allowPending: true }), /unsafe|symlink/);
  const retained = JSON.parse(fs.readFileSync(path.join(f.root, 'fleet', 'claims', `${f.run.project_id}.json`), 'utf8'));
  assert.deepEqual(retained, claim);
});
test('a crash after terminal receipt cannot revive an aborted claim or replace the coordinator', t => {
  const f = fixture(t), fleet = api(); const claim = fleet.reserve({ root: f.root, run: f.run });
  fleet.release({ root: f.root, runId: f.run.run_id, allowPending: true });
  const file = path.join(f.root, 'fleet', 'claims', `${f.run.project_id}.json`);
  fs.writeFileSync(file, JSON.stringify(claim), { mode: 0o600 });
  assert.throws(() => fleet.bind(options(f), { processLookup: () => processFixture(f.run) }), /fleet_run_released/);
  // The exact terminal receipt permits only finishing that interrupted release.
  assert.equal(fleet.release({ root: f.root, runId: f.run.run_id, allowPending: true }).status, 'released');
  fs.unlinkSync(path.join(f.root, 'fleet', 'coordinator.json'));
  assert.throws(() => fleet.reserve({ root: f.root, run: f.runs[1] }), /fleet_coordinator_missing/);
});
test('status caps inventory and never exposes unvalidated record content', t => {
  const f = fixture(t), fleet = api(); fleet.reserve({ root: f.root, run: f.run });
  const claims = path.join(f.root, 'fleet', 'claims');
  for (let n = 0; n < 260; n++) fs.writeFileSync(path.join(claims, `${n.toString(16).padStart(64, '0')}.json`), JSON.stringify({ secret: 'NEVER_PERSIST_OUTPUT' }));
  const before = inventory(f.root), result = fleet.status({ root: f.root });
  assert.equal(result.limited, true); assert.ok(result.claims.length <= 256);
  assert.doesNotMatch(JSON.stringify(result), /NEVER_PERSIST_OUTPUT|secret/);
  assert.deepEqual(inventory(f.root), before);
});
test('interrupted release refuses altered terminal metadata instead of returning arbitrary content', t => {
  const f = fixture(t), fleet = api(); const claim = fleet.reserve({ root: f.root, run: f.run });
  const receipt = fleet.release({ root: f.root, runId: f.run.run_id, allowPending: true });
  fs.writeFileSync(path.join(f.root, 'fleet', 'claims', `${f.run.project_id}.json`), JSON.stringify(claim), { mode: 0o600 });
  fs.writeFileSync(path.join(f.root, 'fleet', 'receipts', `${f.run.run_id}.json`), JSON.stringify({ ...receipt, secret: 'NEVER_RETURN_PRIVATE' }), { mode: 0o600 });
  assert.throws(() => fleet.release({ root: f.root, runId: f.run.run_id, allowPending: true }), /fleet_receipt_conflict/);
  assert.equal(fleet.status({ root: f.root }).claims.length, 1);
});
test('unsupported platform cannot bind through the production path', { skip: process.platform === 'linux' }, t => {
  const f = fixture(t), fleet = api(); fleet.reserve({ root: f.root, run: f.run });
  assert.throws(() => fleet.bind({ ...options(f), pid: process.pid }), /fleet_process_unverified/);
});
test('real concurrent processes can publish only one project owner', async t => {
  const f = fixture(t); api();
  const competing = registerRun({ root: f.root, projectDir: f.projects[0] });
  const launch = run => new Promise(resolve => {
    const script = 'const f=require(process.argv[1]);const a=JSON.parse(process.argv[2]);try{console.log(JSON.stringify({ok:true,claim:f.reserve(a)}))}catch(e){console.log(JSON.stringify({ok:false,reason:e.message}))}';
    const child = spawn(process.execPath, ['-e', script, entry, JSON.stringify({ root: f.root, run })], { windowsHide: true });
    let output = ''; child.stdout.on('data', chunk => { output += chunk; });
    child.on('error', error => resolve({ error: error.code }));
    child.on('close', code => { try { resolve({ code, ...JSON.parse(output) }); } catch { resolve({ code, invalid: true }); } });
  });
  const outcomes = await Promise.all([launch(f.run), launch(competing), launch(competing), launch(f.run)]);
  const successes = outcomes.filter(o => o.ok);
  assert.ok(successes.length >= 1, JSON.stringify(outcomes));
  assert.equal(new Set(successes.map(o => o.claim.run_id)).size, 1);
  assert.ok(outcomes.filter(o => !o.ok).every(o => /fleet_busy|fleet_project_owned/.test(o.reason)), JSON.stringify(outcomes));
  assert.equal(api().status({ root: f.root }).claims.length, 1);
});
test('CLI status is bounded read-only and accepts no unknown flags or model/process controls', t => {
  const f = fixture(t), fleet = api(); fleet.reserve({ root: f.root, run: f.run });
  const before = inventory(f.root);
  const result = spawnSync(process.execPath, [entry, 'status', '--root', f.root, '--project-dir', f.projects[0]], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).claims.length, 1);
  const bad = spawnSync(process.execPath, [entry, 'release', '--root', f.root, '--run-id', f.run.run_id, '--force'], { encoding: 'utf8', windowsHide: true });
  assert.notEqual(bad.status, 0); assert.deepEqual(inventory(f.root), before);
  const source = fs.readFileSync(entry, 'utf8');
  assert.doesNotMatch(source, /require\(['"](?:node:)?(?:child_process|https?|net)['"]\)|process\.kill\s*\(/);
});
test('production Linux lookup binds a real fixture process without persisting its environment', { skip: process.platform !== 'linux' }, async t => {
  const f = fixture(t), fleet = api(); fleet.reserve({ root: f.root, run: f.run });
  const child = spawn(process.execPath, ['-e', 'process.stdout.write("ready\\n");process.stdin.resume()'], {
    env: { ...process.env, SGSD_RUN_ID: f.run.run_id, SGSD_ATLAS_PROJECT_ID: f.run.project_id, PRIVATE_SECRET: 'NEVER_PERSIST_ENV' }, stdio: ['pipe', 'pipe', 'ignore'] });
  t.after(() => child.stdin.destroy());
  await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); });
  const bound = fleet.bind({ ...options(f), pid: child.pid });
  assert.equal(bound.identity.pid, child.pid); assert.equal(fleet.status({ root: f.root }).claims[0].active, true);
  const ended = new Promise(resolve => child.once('close', resolve)); child.stdin.end(); await ended;
  assert.equal(fleet.release({ root: f.root, runId: f.run.run_id }).status, 'released');
  assert.doesNotMatch(inventory(path.join(f.root, 'fleet')).map(r => r.body).join('\n'), /NEVER_PERSIST/);
});
