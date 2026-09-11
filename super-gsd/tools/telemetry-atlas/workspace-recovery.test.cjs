'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { registerRun, readRun } = require('./global-store.cjs');
const fleet = require('./fleet.cjs');
const BOOT_A = '11111111-1111-4111-8111-111111111111';
const BOOT_B = '22222222-2222-4222-8222-222222222222';
const entry = path.join(__dirname, 'workspace-recovery.cjs');
function api() { assert.ok(fs.existsSync(entry), 'durable workspace recovery implementation must exist'); return require(entry); }
function fixture(t) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-recovery-')), cleanups = [];
  t.after(() => { for (const cleanup of cleanups.reverse()) cleanup(); fs.rmSync(tmp, { recursive: true, force: true }); });
  const root = path.join(tmp, 'atlas'), projectDir = path.join(tmp, 'alpha');
  fs.mkdirSync(path.join(projectDir, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, '.planning', 'STATE.md'), 'PRIVATE TASK BODY NOT TO COPY');
  const run = registerRun({ root, projectDir });
  const actual = current => ({ state: 'alive', pid: 12001, start_time: '321', executable: '/fixture/claude',
    environment: { SGSD_RUN_ID: current.run_id, SGSD_ATLAS_PROJECT_ID: current.project_id } });
  const old = { bootId: () => BOOT_A, processLookup: () => actual(run) };
  fleet.reserve({ root, run }, old);
  fleet.bind({ root, runId: run.run_id, projectDir, pid: 12001, sessionId: 'claude-session', tmux: { pane_id: '%1', session_name: 'alpha' } }, old);
  const now = { bootId: () => BOOT_B, processLookup: () => ({ state: 'dead' }), sessionExists: () => false };
  const scriptsDir = path.join(tmp, 'scripts'), agentsDir = path.join(tmp, 'agents'), sourceDir = path.join(tmp, 'source');
  for (const dir of [scriptsDir, agentsDir, sourceDir]) fs.mkdirSync(dir);
  fs.writeFileSync(path.join(scriptsDir, 'sgsd-remote-tmux.sh'), '# fixture launcher');
  execFileSync('git', ['init', '-q', sourceDir]);
  execFileSync('git', ['-C', sourceDir, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'fixture']);
  const sha = execFileSync('git', ['-C', sourceDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  fs.writeFileSync(path.join(projectDir, '.super-gsd-version'), sha + '\n');
  return { tmp, root, projectDir, run, old, now, actual, cleanups, options: { root, projectIds: [run.project_id], scriptsDir, agentsDir, sourceDir } };
}
test('successful verified binding remembers bounded references, never task bodies', t => {
  const f = fixture(t), r = api();
  const saved = r.remember({ root: f.root, runId: f.run.run_id, preferredSession: 'alpha' }, f.old);
  assert.equal(saved.previous_run_id, f.run.run_id);
  assert.equal(saved.context_refs[0].path, '.planning/STATE.md');
  assert.match(saved.context_refs[0].sha256, /^[a-f0-9]{64}$/);
  const bytes = fs.readFileSync(path.join(f.root, 'fleet', 'workspaces', 'catalog.json'), 'utf8');
  assert.ok(!bytes.includes('PRIVATE TASK BODY'));
  assert.equal(r.list({ root: f.root }, f.now).entries[0].source, 'remembered');
});
test('pending or unverified owners cannot remember; list exposes legacy claims without writes', t => {
  const f = fixture(t), r = api();
  const before = fs.readdirSync(path.join(f.root, 'fleet'));
  assert.equal(r.list({ root: f.root }, f.now).entries[0].source, 'legacy_claim');
  assert.deepEqual(fs.readdirSync(path.join(f.root, 'fleet')), before);
  assert.throws(() => r.remember({ root: f.root, runId: f.run.run_id }, f.now), /recovery_owner_unverified/);
});
test('forget preserves project and live claim and cannot be undone by same-run hook or finish', t => {
  const f = fixture(t), r = api();
  r.remember({ root: f.root, runId: f.run.run_id }, f.old);
  r.forget({ root: f.root, projectId: f.run.project_id }, f.old);
  r.remember({ root: f.root, runId: f.run.run_id }, f.old);
  r.refresh({ root: f.root, runId: f.run.run_id }, f.old);
  assert.equal(r.list({ root: f.root }, f.old).entries.length, 0);
  assert.equal(fleet.status({ root: f.root }, f.old).claims.length, 1);
  assert.ok(fs.existsSync(path.join(f.projectDir, '.planning', 'STATE.md')));
});
test('remembered missing project remains visible and blocked, not silently dropped', t => {
  const f = fixture(t), r = api(); r.remember({ root: f.root, runId: f.run.run_id }, f.old);
  fs.renameSync(f.projectDir, f.projectDir + '-moved');
  const row = r.list({ root: f.root }, f.now).entries[0];
  assert.equal(row.project_id, f.run.project_id); assert.equal(row.availability, 'project_missing');
});
test('boot offer is read-only until acknowledged, and no selection launches nothing', async t => {
  const f = fixture(t), r = api();
  assert.equal(r.offer({ root: f.root }, f.now).needed, true);
  assert.ok(!fs.existsSync(path.join(f.root, 'fleet', 'workspaces')));
  r.offer({ root: f.root, acknowledge: true }, f.now);
  assert.equal(r.offer({ root: f.root }, f.now).needed, false);
  let launched = false;
  await assert.rejects(r.restore({ ...f.options, projectIds: [] }, { ...f.now, launch: async () => { launched = true; } }), /recovery_selection_required/);
  assert.equal(launched, false);
});
test('provenance mismatch is blocked before predecessor release or launch', async t => {
  const f = fixture(t), r = api(); fs.writeFileSync(path.join(f.projectDir, '.super-gsd-version'), 'a'.repeat(40));
  const result = await r.restore(f.options, { ...f.now, launch: async () => assert.fail('must not launch') });
  assert.equal(result.results[0].reason, 'recovery_provenance_mismatch');
  assert.equal(fleet.status({ root: f.root }, f.now).claims[0].run_id, f.run.run_id);
});
test('restore consumes a single ticket, preserves lineage and validates bound ownership rather than wrapper exit', async t => {
  const f = fixture(t), r = api(); let prepared;
  const deps = { ...f.now, verifyBinding: () => true, processLookup: () => prepared ? f.actual(prepared) : { state: 'dead' },
    launch: async ({ args }) => {
      assert.ok(args.includes('--greet')); assert.ok(args.includes('--no-attach')); assert.ok(!args.includes('--go'));
      assert.equal(args[args.indexOf('--source-dir') + 1], f.options.sourceDir);
      const recoveryId = args[args.indexOf('--restore-id') + 1];
      const recovery = r.consumeTicket({ root: f.root, recoveryId, projectDir: f.projectDir }, deps);
      assert.throws(() => r.consumeTicket({ root: f.root, recoveryId, projectDir: f.projectDir }, deps), /recovery_ticket_consumed/);
      prepared = registerRun({ root: f.root, projectDir: f.projectDir, recovery });
      r.recordPrepared({ root: f.root, recoveryId, runId: prepared.run_id }, deps);
      fleet.reserve({ root: f.root, run: prepared }, deps);
      fleet.bind({ root: f.root, runId: prepared.run_id, projectDir: f.projectDir, pid: 12001, tmux: { pane_id: '%4' } }, deps);
      r.remember({ root: f.root, runId: prepared.run_id }, deps); // Different short lock must not deadlock.
      return { code: 0 };
    } };
  const result = await r.restore(f.options, deps), row = result.results[0];
  assert.equal(row.status, 'restored'); assert.notEqual(row.run_id, f.run.run_id);
  assert.equal(readRun(f.root, row.run_id).recovery.previous_run_id, f.run.run_id);
  assert.equal(row.native.status, 'pending');
  assert.equal(fs.existsSync(path.join(f.root, 'fleet', 'receipts', `${f.run.run_id}.json`)), true);
  const again = await r.restore(f.options, { ...deps, launch: async () => assert.fail('must not duplicate') });
  assert.equal(again.results[0].status, 'already_running');
});
test('same-boot pending owner remains an explicit blocker even when its wrapper is dead', async t => {
  const f = fixture(t), r = api(); r.remember({ root: f.root, runId: f.run.run_id }, f.old);
  fleet.release({ root: f.root, runId: f.run.run_id }, f.now);
  const run = registerRun({ root: f.root, projectDir: f.projectDir }); fleet.reserve({ root: f.root, run }, f.now);
  const result = await r.restore(f.options, { ...f.now, launch: async () => assert.fail('must not launch') });
  assert.equal(result.results[0].status, 'blocked'); assert.equal(result.results[0].reason, 'recovery_pending_owner');
  assert.equal(fleet.status({ root: f.root }, f.now).claims[0].run_id, run.run_id);
});
test('superseded never-consumed ticket cannot be replayed after a retry', async t => {
  const f = fixture(t), r = api(); let obsolete;
  await r.restore(f.options, { ...f.now, launch: async ({ args }) => { obsolete = args[args.indexOf('--restore-id') + 1]; return { code: 1 }; } });
  const result = await r.restore(f.options, { ...f.now, launch: async ({ args }) => {
    assert.notEqual(args[args.indexOf('--restore-id') + 1], obsolete);
    assert.throws(() => r.consumeTicket({ root: f.root, recoveryId: obsolete, projectDir: f.projectDir }, f.now), /recovery_ticket_superseded/);
    return { code: 1 };
  } });
  assert.equal(result.results[0].reason, 'recovery_launch_unprepared');
});
test('malformed terminal receipt does not authorize abandoning a prepared run', async t => {
  const f = fixture(t), r = api(); let next;
  await r.restore(f.options, { ...f.now, bindingWaitMs: 0, launch: async ({ args }) => {
    const recoveryId = args[args.indexOf('--restore-id') + 1];
    const recovery = r.consumeTicket({ root: f.root, recoveryId, projectDir: f.projectDir }, f.now);
    next = registerRun({ root: f.root, projectDir: f.projectDir, recovery });
    r.recordPrepared({ root: f.root, recoveryId, runId: next.run_id }, f.now);
    return { code: 0 };
  } });
  fs.writeFileSync(path.join(next.state_dir, 'exit.json'), JSON.stringify({ fabricated: true }));
  const result = await r.restore(f.options, { ...f.now, launch: async () => assert.fail('must not duplicate') });
  assert.equal(result.results[0].reason, 'recovery_prepared_unconfirmed');
});
test('recordPrepared rejects cross-boot consumers and recordResult rejects another run', async t => {
  const f = fixture(t), r = api();
  const result = await r.restore(f.options, { ...f.now, launch: async ({ args }) => {
    const recoveryId = args[args.indexOf('--restore-id') + 1];
    const recovery = r.consumeTicket({ root: f.root, recoveryId, projectDir: f.projectDir }, f.now);
    const next = registerRun({ root: f.root, projectDir: f.projectDir, recovery });
    assert.throws(() => r.recordPrepared({ root: f.root, recoveryId, runId: next.run_id }, f.old), /recovery_ticket_boot_mismatch/);
    r.recordPrepared({ root: f.root, recoveryId, runId: next.run_id }, f.now);
    assert.throws(() => r.recordResult({ root: f.root, recoveryId, result: { status: 'restored', reason: null, run_id: f.run.run_id } }, f.now), /recovery_result_mismatch/);
    return { code: 1 };
  } });
  assert.equal(result.results[0].status, 'pending');
});
test('corrupt ticket result fields block retry rather than being ignored', async t => {
  const f = fixture(t), r = api();
  const initial = await r.restore(f.options, { ...f.now, launch: async () => ({ code: 1 }) });
  const file = path.join(f.root, 'fleet', 'workspaces', 'tickets', initial.results[0].recovery_id + '.json');
  const row = JSON.parse(fs.readFileSync(file)); row.result = { secret: 'unexpected field' }; fs.writeFileSync(file, JSON.stringify(row));
  const result = await r.restore(f.options, { ...f.now, launch: async () => assert.fail('must not launch') });
  assert.equal(result.results[0].reason, 'recovery_ticket_invalid');
});
test('reboot offering with no global root creates no directories even when acknowledged', t => {
  const f = fixture(t), r = api(), absent = path.join(f.tmp, 'never-enabled');
  assert.equal(r.offer({ root: absent, acknowledge: true }, f.now).needed, false);
  assert.ok(!fs.existsSync(absent));
});
test('unmigrated missing legacy owner remains a named blocker while another project restores', async t => {
  const f = fixture(t), r = api(), secondDir = path.join(f.tmp, 'beta');
  fs.mkdirSync(path.join(secondDir, '.planning'), { recursive: true });
  fs.copyFileSync(path.join(f.projectDir, '.super-gsd-version'), path.join(secondDir, '.super-gsd-version'));
  const second = registerRun({ root: f.root, projectDir: secondDir });
  const old = { ...f.old, processLookup: () => f.actual(second) };
  fleet.reserve({ root: f.root, run: second }, old);
  fleet.bind({ root: f.root, runId: second.run_id, projectDir: secondDir, pid: 12001 }, old);
  fs.renameSync(f.projectDir, f.projectDir + '-moved');
  const inventory = r.list({ root: f.root }, f.now);
  assert.ok(inventory.blockers.some(row => row.project_id === f.run.project_id && row.reason === 'recovery_legacy_claim_unverified'));
  let launched = 0;
  const result = await r.restore({ ...f.options, projectIds: [second.project_id] }, { ...f.now, launch: async () => { launched++; return { code: 1 }; } });
  assert.equal(launched, 1); assert.equal(result.results[0].reason, 'recovery_launch_unprepared');
});
test('unverified legacy context becomes a per-workspace blocker, not a global inventory failure', t => {
  const f = fixture(t), r = api();
  fs.writeFileSync(path.join(f.projectDir, '.planning', 'STATE.md'), Buffer.alloc(1024 * 1024 + 1));
  const inventory = r.list({ root: f.root }, f.now);
  assert.equal(inventory.entries.length, 0);
  assert.equal(inventory.blockers[0].project_id, f.run.project_id);
});
test('a newly remembered current-boot owner does not trigger a reboot offer', t => {
  const f = fixture(t), r = api(); r.remember({ root: f.root, runId: f.run.run_id }, f.old);
  assert.equal(r.offer({ root: f.root }, f.old).needed, false);
  assert.equal(r.offer({ root: f.root }, f.now).needed, true);
});
test('missing or changed saved context is visible without copying content or rewriting catalog', async t => {
  const f = fixture(t), r = api();
  fs.writeFileSync(path.join(f.projectDir, '.planning', 'ORCHESTRATOR-CHECKPOINT.md'), 'private checkpoint');
  r.remember({ root: f.root, runId: f.run.run_id }, f.old);
  const file = path.join(f.root, 'fleet/workspaces/catalog.json'), before = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(path.join(f.projectDir, '.planning', 'STATE.md'), 'changed private state');
  fs.unlinkSync(path.join(f.projectDir, '.planning', 'ORCHESTRATOR-CHECKPOINT.md'));
  const row = r.list({ root: f.root }, f.now).entries[0];
  assert.equal(row.context_status.find(item => item.path === '.planning/STATE.md').status, 'changed');
  assert.equal(row.context_status.find(item => item.path === '.planning/ORCHESTRATOR-CHECKPOINT.md').status, 'missing');
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.ok(!JSON.stringify(row).includes('changed private state'));
  const result = await r.restore(f.options, { ...f.now, launch: async () => ({ code: 1 }) });
  assert.ok(result.results[0].context_status.some(item => item.status === 'missing'));
});
test('restored owner retry verifies exact tmux binding and does not adopt a wrong pane', async t => {
  const f = fixture(t), r = api(); let next;
  const deps = { ...f.now, bindingWaitMs: 0, processLookup: () => next ? f.actual(next) : { state: 'dead' }, verifyBinding: () => false };
  // Valid pane syntax, deliberately wrong relationship to the restored session.
  deps.launch = async ({ args }) => {
    const recoveryId = args[args.indexOf('--restore-id') + 1], recovery = r.consumeTicket({ root: f.root, recoveryId, projectDir: f.projectDir }, f.now);
    next = registerRun({ root: f.root, projectDir: f.projectDir, recovery });
    r.recordPrepared({ root: f.root, recoveryId, runId: next.run_id }, f.now); fleet.reserve({ root: f.root, run: next }, deps);
    fleet.bind({ root: f.root, runId: next.run_id, projectDir: f.projectDir, pid: 12001, tmux: { pane_id: '%99' } }, deps);
    return { code: 0 };
  };
  assert.equal((await r.restore(f.options, deps)).results[0].status, 'pending');
  const result = await r.restore(f.options, { ...deps, launch: async () => assert.fail('never duplicate live owner') });
  assert.equal(result.results[0].status, 'blocked'); assert.equal(result.results[0].reason, 'recovery_binding_unconfirmed');
});
test('forget allows a genuinely new verified bound run, but late old finish cannot regress it', t => {
  const f = fixture(t), r = api(); r.remember({ root: f.root, runId: f.run.run_id }, f.old);
  r.forget({ root: f.root, projectId: f.run.project_id }, f.old); fleet.release({ root: f.root, runId: f.run.run_id }, f.now);
  const next = registerRun({ root: f.root, projectDir: f.projectDir }), deps = { ...f.now, processLookup: () => f.actual(next) };
  fleet.reserve({ root: f.root, run: next }, deps); fleet.bind({ root: f.root, runId: next.run_id, projectDir: f.projectDir, pid: 12001 }, deps);
  r.remember({ root: f.root, runId: next.run_id }, deps); r.refresh({ root: f.root, runId: f.run.run_id }, deps);
  assert.equal(r.list({ root: f.root }, deps).entries[0].previous_run_id, next.run_id);
});
test('same-path directory replacement blocks restore without releasing original claim', async t => {
  const f = fixture(t), r = api(); r.remember({ root: f.root, runId: f.run.run_id }, f.old);
  fs.renameSync(f.projectDir, f.projectDir + '-original'); fs.mkdirSync(path.join(f.projectDir, '.planning'), { recursive: true });
  fs.copyFileSync(path.join(f.projectDir + '-original', '.super-gsd-version'), path.join(f.projectDir, '.super-gsd-version'));
  assert.equal(r.list({ root: f.root }, f.now).entries[0].availability, 'project_replaced');
  const result = await r.restore(f.options, { ...f.now, launch: async () => assert.fail('must not launch') });
  assert.equal(result.results[0].reason, 'recovery_project_replaced');
  assert.equal(fleet.status({ root: f.root }, f.now).claims[0].run_id, f.run.run_id);
});
test('catalog corruption, entry bound, hardlinks and oversize files fail closed', t => {
  const f = fixture(t), r = api(); r.remember({ root: f.root, runId: f.run.run_id }, f.old);
  const file = path.join(f.root, 'fleet/workspaces/catalog.json'), original = fs.readFileSync(file, 'utf8'), row = JSON.parse(original);
  fs.writeFileSync(file, '{invalid json'); assert.throws(() => r.list({ root: f.root }, f.now));
  fs.writeFileSync(file, JSON.stringify({ ...row, entries: Array(257).fill(row.entries[0]) }));
  assert.throws(() => r.list({ root: f.root }, f.now), /recovery_catalog_invalid/);
  fs.writeFileSync(file, ' '.repeat(1024 * 1024 + 1)); assert.throws(() => r.list({ root: f.root }, f.now), /metadata_too_large/);
  fs.writeFileSync(file, original); const link = file + '.linked'; fs.linkSync(file, link);
  assert.throws(() => r.list({ root: f.root }, f.now), /unsafe_file/);
});
test('symlinked recovery catalog is refused and target bytes are preserved', t => {
  const f = fixture(t), r = api(); r.remember({ root: f.root, runId: f.run.run_id }, f.old);
  const file = path.join(f.root, 'fleet/workspaces/catalog.json'), target = path.join(f.tmp, 'untouched.json');
  fs.renameSync(file, target); const before = fs.readFileSync(target);
  try { fs.symlinkSync(target, file); } catch (error) { if (error.code === 'EPERM') { t.skip('Windows symlink permission unavailable'); return; } throw error; }
  assert.throws(() => r.list({ root: f.root }, f.now), /unsafe_symlink/);
  assert.deepEqual(fs.readFileSync(target), before);
});
test('concurrent independent coordinators serialize selected launches with one durable ticket', async t => {
  const f = fixture(t), r = api(), ready = path.join(f.tmp, 'ready'), done = path.join(f.tmp, 'done');
  const code = `const fs=require('node:fs'),r=require(${JSON.stringify(entry)});r.restore(${JSON.stringify(f.options)},
    {bootId:()=>${JSON.stringify(BOOT_B)},processLookup:()=>({state:'dead'}),sessionExists:()=>false,
     launch:async()=>{fs.writeFileSync(${JSON.stringify(ready)},'ready');const end=Date.now()+5000;
       while(!fs.existsSync(${JSON.stringify(done)})&&Date.now()<end)await new Promise(r=>setTimeout(r,20));return {code:1};}}
    ).then(()=>process.exit(0),()=>process.exit(2));`;
  const child = spawn(process.execPath, ['-e', code], { stdio: 'ignore' });
  const closed = new Promise(resolve => child.once('exit', resolve));
  const deadline = Date.now() + 4000;
  while (!fs.existsSync(ready) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(fs.existsSync(ready), 'independent coordinator reached launcher boundary');
  await assert.rejects(r.restore(f.options, { ...f.now, launch: async () => assert.fail('never concurrent launch') }), /recovery_busy/);
  assert.equal(fs.readdirSync(path.join(f.root, 'fleet/workspaces/tickets')).length, 1);
  fs.writeFileSync(done, 'done'); assert.equal(await closed, 0);
});
test('consumed and reserved crash stages block same-boot replay but prior boot can recover them', async t => {
  for (const stage of ['consumed', 'reserved']) {
    const f = fixture(t), r = api(); let attemptedId, next;
    const first = await r.restore(f.options, { ...f.now, bindingWaitMs: 0, launch: async ({ args }) => {
      attemptedId = args[args.indexOf('--restore-id') + 1];
      const recovery = r.consumeTicket({ root: f.root, recoveryId: attemptedId, projectDir: f.projectDir }, f.now);
      if (stage === 'reserved') {
        next = registerRun({ root: f.root, projectDir: f.projectDir, recovery });
        r.recordPrepared({ root: f.root, recoveryId: attemptedId, runId: next.run_id }, f.now);
        fleet.reserve({ root: f.root, run: next }, f.now);
      }
      return { code: 1 };
    } });
    assert.equal(first.results.length, 1);
    const same = await r.restore(f.options, { ...f.now, launch: async () => assert.fail('never replay') });
    assert.equal(same.results[0].reason, stage === 'reserved' ? 'recovery_pending_owner' : 'recovery_consumption_incomplete');
    let fresh;
    const reboot = { ...f.now, bootId: () => '33333333-3333-4333-8333-333333333333', launch: async ({ args }) => { fresh = args[args.indexOf('--restore-id') + 1]; return { code: 1 }; } };
    assert.equal((await r.restore(f.options, reboot)).results[0].status, 'failed'); assert.notEqual(fresh, attemptedId);
    if (next) assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, 'fleet/receipts', next.run_id + '.json'))).reason, 'prior_boot_interrupted');
  }
});
test('selected ticket crash before release keeps predecessor and retries through release receipt', async t => {
  const f = fixture(t), r = api(), rename = fs.renameSync; let interrupted = false;
  try {
    fs.renameSync = (a, b) => { const result = rename(a, b); if (!interrupted && b === path.join(f.root, 'fleet/workspaces/latest', f.run.project_id + '.json')) { interrupted = true; throw new Error('fixture_power_loss'); } return result; };
    assert.equal((await r.restore(f.options, { ...f.now, launch: async () => assert.fail('not reached') })).results[0].status, 'blocked');
  } finally { fs.renameSync = rename; }
  assert.equal(fleet.status({ root: f.root }, f.now).claims[0].run_id, f.run.run_id);
  assert.equal((await r.restore(f.options, { ...f.now, launch: async () => ({ code: 1 }) })).results[0].status, 'failed');
  assert.ok(fs.existsSync(path.join(f.root, 'fleet/receipts', f.run.run_id + '.json')));
});
test('partial selected restore preserves failure, success, and exact-run observation semantics', async t => {
  const f = fixture(t), r = api(), beta = path.join(f.tmp, 'beta'); fs.mkdirSync(path.join(beta, '.planning'), { recursive: true });
  fs.copyFileSync(path.join(f.projectDir, '.super-gsd-version'), path.join(beta, '.super-gsd-version'));
  const second = registerRun({ root: f.root, projectDir: beta });
  const old = { ...f.old, processLookup: () => f.actual(second) };
  fleet.reserve({ root: f.root, run: second }, old); fleet.bind({ root: f.root, runId: second.run_id, projectDir: beta, pid: 12001 }, old);
  let next;
  const deps = { ...f.now, bindingWaitMs: 0, verifyBinding: () => true, processLookup: () => next ? f.actual(next) : { state: 'dead' },
    launch: async ({ args }) => {
      const projectDir = args[args.indexOf('--project') + 1]; if (projectDir === f.projectDir) return { code: 1 };
      const recoveryId = args[args.indexOf('--restore-id') + 1], recovery = r.consumeTicket({ root: f.root, recoveryId, projectDir }, f.now);
      next = registerRun({ root: f.root, projectDir, recovery }); r.recordPrepared({ root: f.root, recoveryId, runId: next.run_id }, f.now);
      fleet.reserve({ root: f.root, run: next }, deps); fleet.bind({ root: f.root, runId: next.run_id, projectDir, pid: 12001, tmux: { pane_id: '%2' } }, deps);
      return { code: 0 };
    } };
  const result = await r.restore({ ...f.options, projectIds: [f.run.project_id, second.project_id] }, deps);
  assert.deepEqual(result.results.map(row => row.status), ['failed', 'restored']);
  assert.equal(result.results[1].native.status, 'pending');
  const monitor = path.join(f.root, 'monitor'); fs.mkdirSync(monitor);
  const snapshot = { schema_version: 1, generated_at: new Date().toISOString(), projects: [{ project_id: second.project_id,
    native: { status: 'observed', last_received_at: new Date().toISOString() },
    runs: [{ run_id: second.run_id, native_status: 'observed', last_received_at: new Date().toISOString() }],
    operational: { status: 'degraded', last_received_at: new Date().toISOString(), gaps: 7, pending_bytes: 128 } }] };
  fs.writeFileSync(path.join(monitor, 'latest.json'), JSON.stringify(snapshot));
  let checked = (await r.restore({ ...f.options, projectIds: [second.project_id] }, deps)).results[0];
  assert.equal(checked.native.status, 'pending', 'aggregate or predecessor native is not new run delivery');
  assert.equal(checked.operational.scope, 'project'); assert.equal(checked.operational.gaps, 7);
  snapshot.projects[0].runs[0].run_id = next.run_id; fs.writeFileSync(path.join(monitor, 'latest.json'), JSON.stringify(snapshot));
  checked = (await r.restore({ ...f.options, projectIds: [second.project_id] }, deps)).results[0]; assert.equal(checked.native.status, 'observed');
  snapshot.generated_at = '2020-01-01T00:00:00Z'; fs.writeFileSync(path.join(monitor, 'latest.json'), JSON.stringify(snapshot));
  assert.equal((await r.restore({ ...f.options, projectIds: [second.project_id] }, deps)).results[0].native.status, 'pending');
});
test('forget racing with selected restore is not overwritten by catalog migration', async t => {
  const f = fixture(t), r = api(); r.remember({ root: f.root, runId: f.run.run_id }, f.old);
  const result = await r.restore(f.options, { ...f.now, sessionExists: () => { r.forget({ root: f.root, projectId: f.run.project_id }, f.now); return false; },
    launch: async () => assert.fail('forgotten intent cannot launch') });
  assert.equal(result.results[0].reason, 'recovery_workspace_forgotten');
  assert.equal(r.list({ root: f.root }, f.now).entries.length, 0);
  assert.equal(fleet.status({ root: f.root }, f.now).claims[0].run_id, f.run.run_id);
});
test('actual coordinator death after release and after binding preserves recovery and abandoned-lock evidence', async t => {
  for (const stage of ['released', 'bound']) {
    const f = fixture(t), r = api();
    const code = `const r=require(${JSON.stringify(entry)}),store=require(${JSON.stringify(path.join(__dirname, 'global-store.cjs'))}),
      fleet=require(${JSON.stringify(path.join(__dirname, 'fleet.cjs'))});let next;
      const options=${JSON.stringify(f.options)},deps={bootId:()=>${JSON.stringify(BOOT_B)},sessionExists:()=>false,
      processLookup:()=>next?{state:'alive',pid:12001,start_time:'321',executable:'/fixture/claude',environment:{SGSD_RUN_ID:next.run_id,SGSD_ATLAS_PROJECT_ID:next.project_id}}:{state:'dead'},
      launch:async({args})=>{if(${JSON.stringify(stage)}==='bound'){
        const id=args[args.indexOf('--restore-id')+1],recovery=r.consumeTicket({root:options.root,recoveryId:id,projectDir:${JSON.stringify(f.projectDir)}},deps);
        next=store.registerRun({root:options.root,projectDir:${JSON.stringify(f.projectDir)},recovery});r.recordPrepared({root:options.root,recoveryId:id,runId:next.run_id},deps);
        fleet.reserve({root:options.root,run:next},deps);fleet.bind({root:options.root,runId:next.run_id,projectDir:next.project_dir,pid:12001,tmux:{pane_id:'%5'}},deps);
      }process.exit(23);}};r.restore(options,deps).then(()=>process.exit(9),()=>process.exit(10));`;
    const child = spawn(process.execPath, ['-e', code], { stdio: 'ignore' });
    assert.equal(await new Promise(resolve => child.once('exit', resolve)), 23);
    const recoveryRoot = path.join(f.root, 'fleet/workspaces');
    assert.ok(fs.existsSync(path.join(recoveryRoot, 'restore.lock')), 'process exit skips coordinator finally');
    const previous = JSON.parse(fs.readFileSync(path.join(recoveryRoot, 'latest', f.run.project_id + '.json'))).recovery_id;
    const prior = JSON.parse(fs.readFileSync(path.join(recoveryRoot, 'tickets', previous + '.json')));
    assert.equal(prior.stage, stage === 'bound' ? 'prepared' : 'released');
    const result = await r.restore(f.options, { ...f.now, launch: async () => ({ code: 1 }) });
    assert.equal(result.results[0].status, 'failed'); assert.notEqual(result.results[0].recovery_id, previous);
    assert.ok(fs.readdirSync(path.join(recoveryRoot, 'lock-receipts')).length > 0);
    if (prior.new_run_id) assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, 'fleet/receipts', prior.new_run_id + '.json'))).reason, 'bound_process_dead');
  }
});
test('native tmux ancestry verifies the exact restored pane without a provider or verification double', { skip: process.platform !== 'linux' }, async t => {
  const f = fixture(t), r = api(), socket = path.join(f.tmp, 'tmux.sock'), inherited = process.env.TMUX;
  const tmux = args => execFileSync('tmux', ['-S', socket, ...args], { encoding: 'utf8', timeout: 3000, maxBuffer: 8192 });
  let created = false;
  f.cleanups.push(() => {
    if (inherited === undefined) delete process.env.TMUX; else process.env.TMUX = inherited;
    // Only this test's explicit private socket, never the user's default server.
    if (created) { try { tmux(['kill-server']); } catch {} }
  });
  const deps = { bootId: () => BOOT_B, sessionExists: () => false, bindingWaitMs: 0,
    launch: async ({ args }) => {
      const recoveryId = args[args.indexOf('--restore-id') + 1], name = args[args.indexOf('--session') + 1];
      const recovery = r.consumeTicket({ root: f.root, recoveryId, projectDir: f.projectDir }, deps);
      const next = registerRun({ root: f.root, projectDir: f.projectDir, recovery }); r.recordPrepared({ root: f.root, recoveryId, runId: next.run_id }, deps);
      fleet.reserve({ root: f.root, run: next }, deps);
      const quote = text => `'${text.replace(/'/g, `'"'"'`)}'`;
      tmux(['new-session', '-d', '-s', name, '-c', f.projectDir,
        `env SGSD_RUN_ID=${quote(next.run_id)} SGSD_ATLAS_PROJECT_ID=${quote(next.project_id)} ${quote(process.execPath)} -e 'setInterval(()=>{},1000)'`]);
      created = true;
      process.env.TMUX = `${socket},${tmux(['display-message', '-p', '#{pid}']).trim()},0`;
      const [pane, rawPid] = tmux(['list-panes', '-t', `=${name}`, '-F', '#{pane_id}\t#{pane_pid}']).trim().split('\t'), pid = Number(rawPid);
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        try { if (fs.readFileSync(`/proc/${pid}/environ`, 'utf8').includes(`SGSD_RUN_ID=${next.run_id}\0`)) break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      fleet.bind({ root: f.root, runId: next.run_id, projectDir: f.projectDir, pid, tmux: { pane_id: pane, session_name: name } }, deps);
      return { code: 0 };
    } };
  const result = await r.restore(f.options, deps);
  assert.equal(result.results[0].status, 'restored', JSON.stringify(result));
  assert.equal(result.results[0].attach_command, `tmux attach -t =${result.results[0].session_name}`);
  assert.equal(result.results[0].native.status, 'pending', 'dummy process has no provider delivery');
  const again = await r.restore(f.options, { ...deps, launch: async () => assert.fail('never duplicate') });
  assert.equal(again.results[0].attach_command, result.results[0].attach_command);
});
test('CLI restore all reports unmigrated legacy blockers instead of dropping them', { skip: process.platform !== 'linux' }, t => {
  const f = fixture(t); fs.renameSync(f.projectDir, f.projectDir + '-missing');
  let result;
  try { execFileSync(process.execPath, [entry, 'restore', '--all', '--root', f.root, '--scripts-dir', f.options.scriptsDir,
    '--agents-dir', f.options.agentsDir, '--source-dir', f.options.sourceDir], { encoding: 'utf8', timeout: 5000 }); assert.fail('blocker exit required'); }
  catch (error) { assert.equal(error.status, 2); assert.ok(error.stdout.trim().startsWith('{'), 'CLI must emit structured per-workspace blocker'); result = JSON.parse(error.stdout); }
  assert.equal(result.results.length, 1); assert.equal(result.results[0].project_id, f.run.project_id);
  assert.equal(result.results[0].reason, 'recovery_legacy_claim_unverified');
});
test('blocker-only legacy inventory is offered once instead of silently disappearing on boot', t => {
  const f = fixture(t), r = api(); fs.renameSync(f.projectDir, f.projectDir + '-missing');
  const offered = r.offer({ root: f.root }, f.now);
  assert.equal(offered.entries.length, 0); assert.equal(offered.blockers.length, 1); assert.equal(offered.needed, true);
  r.offer({ root: f.root, acknowledge: true }, f.now); assert.equal(r.offer({ root: f.root }, f.now).needed, false);
});
test('catalog publication first flushes ordinary predecessor registration and its directory links', t => {
  const f = fixture(t), r = api(), originalSync = fs.fsyncSync, originalRename = fs.renameSync, synced = new Set();
  let atPublish;
  const key = file => { const s = fs.statSync(file); return `${s.dev}:${s.ino}`; };
  const required = [path.join(f.run.state_dir, 'registration.json')];
  if (process.platform !== 'win32') required.push(f.run.state_dir, path.dirname(f.run.state_dir), f.root, path.dirname(f.root));
  try {
    fs.fsyncSync = fd => { const s = fs.fstatSync(fd); synced.add(`${s.dev}:${s.ino}`); return originalSync(fd); };
    fs.renameSync = (from, to) => {
      if (to === path.join(f.root, 'fleet/workspaces/catalog.json')) atPublish = required.map(file => ({ file, synced: synced.has(key(file)) }));
      return originalRename(from, to);
    };
    r.remember({ root: f.root, runId: f.run.run_id }, f.old);
  } finally { fs.fsyncSync = originalSync; fs.renameSync = originalRename; }
  assert.ok(atPublish?.length);
  for (const row of atPublish) assert.equal(row.synced, true, `${path.relative(f.root, row.file)} must be durable before catalog rename`);
});
test('new workspace ticket and latest directories are linked durably before dependent metadata', { skip: process.platform === 'win32' }, async t => {
  const f = fixture(t), r = api(), originalSync = fs.fsyncSync, originalRename = fs.renameSync, synced = new Set(), publications = [];
  const recoveryRoot = path.join(f.root, 'fleet/workspaces');
  const key = file => { const s = fs.statSync(file); return `${s.dev}:${s.ino}`; };
  try {
    fs.fsyncSync = fd => { const s = fs.fstatSync(fd); synced.add(`${s.dev}:${s.ino}`); return originalSync(fd); };
    fs.renameSync = (from, to) => {
      if ([path.join(recoveryRoot, 'tickets'), path.join(recoveryRoot, 'latest')].includes(path.dirname(to))) {
        publications.push([path.dirname(to), recoveryRoot, path.dirname(recoveryRoot), f.root]
          .map(file => ({ file, synced: synced.has(key(file)) })));
      }
      return originalRename(from, to);
    };
    await r.restore(f.options, { ...f.now, launch: async () => ({ code: 1 }) });
  } finally { fs.fsyncSync = originalSync; fs.renameSync = originalRename; }
  assert.ok(publications.length >= 2);
  for (const publication of publications) for (const row of publication)
    assert.equal(row.synced, true, `${path.relative(f.root, row.file)} directory must be durable before dependent metadata`);
});
test('attach command is absent for an unverified existing terminal owner and a pending restore', async t => {
  const f = fixture(t), r = api();
  const active = await r.restore(f.options, { ...f.old, verifyBinding: () => false, launch: async () => assert.fail('never duplicate') });
  assert.equal(active.results[0].status, 'already_running'); assert.equal(active.results[0].attach_command, null);
  const pending = await r.restore(f.options, { ...f.now, bindingWaitMs: 0, launch: async ({ args }) => {
    const recoveryId = args[args.indexOf('--restore-id') + 1], recovery = r.consumeTicket({ root: f.root, recoveryId, projectDir: f.projectDir }, f.now);
    const next = registerRun({ root: f.root, projectDir: f.projectDir, recovery }); r.recordPrepared({ root: f.root, recoveryId, runId: next.run_id }, f.now);
    fleet.reserve({ root: f.root, run: next }, f.now); return { code: 0 };
  } });
  assert.equal(pending.results[0].status, 'pending'); assert.equal(pending.results[0].attach_command, null);
});
test('registration flush failure preserves prior catalog bytes and refuses publication', t => {
  const f = fixture(t), r = api(); r.remember({ root: f.root, runId: f.run.run_id }, f.old);
  const file = path.join(f.root, 'fleet/workspaces/catalog.json'), before = fs.readFileSync(file);
  fleet.release({ root: f.root, runId: f.run.run_id }, f.now);
  const next = registerRun({ root: f.root, projectDir: f.projectDir }), deps = { ...f.now, processLookup: () => f.actual(next) };
  fleet.reserve({ root: f.root, run: next }, deps); fleet.bind({ root: f.root, runId: next.run_id, projectDir: f.projectDir, pid: 12001 }, deps);
  const target = fs.statSync(path.join(next.state_dir, 'registration.json')), originalSync = fs.fsyncSync;
  try {
    fs.fsyncSync = fd => { const stat = fs.fstatSync(fd); if (stat.dev === target.dev && stat.ino === target.ino) throw new Error('fixture_sync_failure'); return originalSync(fd); };
    assert.throws(() => r.remember({ root: f.root, runId: next.run_id }, deps), /fixture_sync_failure/);
  } finally { fs.fsyncSync = originalSync; }
  assert.deepEqual(fs.readFileSync(file), before);
});
