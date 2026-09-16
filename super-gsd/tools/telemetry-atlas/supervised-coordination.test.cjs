'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { registerCurrentCoordination } = require('./codex-parent-bridge.cjs');
const { readRun, readCoordination, validCoordinationBinding } = require('./global-store.cjs');
const { COORDINATION_RUN, coordinationFiles } = require('./supervised-coordination.cjs');
const { candidates } = require('./codex-continuous-manager.cjs');
const { processIdentity } = require('./lifecycle.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-coordination-'));
  const coordinationDir = path.join(root, 'pm-delivery'); fs.mkdirSync(coordinationDir, { recursive: true });
  fs.writeFileSync(path.join(coordinationDir, 'CHARTER.md'), '# PM Delivery\n');
  fs.writeFileSync(path.join(coordinationDir, 'ASSIGNMENT.json'), JSON.stringify({ name: 'pm-delivery', title: 'PM Delivery', session: 'pm-session', index: 9, workers: [] }));
  const rolloutPath = path.join(root, 'rollout.jsonl');
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({ type: 'session_meta', payload: { session_id: 'coord-session', cwd: coordinationDir, model_provider: 'openai', source: 'cli', cli_version: '0.154.0' }}), '\n',
    JSON.stringify({ type: 'event_msg', payload: { thread_id: 'coord-session' } }), '\n'].join(''));
  const process = { pid: 12002, start_time: '987655', boot_id: '11111111-1111-4111-8111-111111111111',
    executable: '/codex/0.154.0-x86_64-unknown-linux-musl/bin/codex', cwd: coordinationDir, environment: {} };
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, coordinationDir, rolloutPath, process, lookup: () => process, boot: process.boot_id };
}
const options = f => ({ root: f.root, coordinationDir: f.coordinationDir, role: 'pm-delivery', pid: f.process.pid,
  expectedStartTime: f.process.start_time, sessionId: 'coord-session', threadId: 'coord-session', rolloutPath: f.rolloutPath,
  processLookup: f.lookup, bootIdLookup: () => f.boot });

test('registers a typed coordination parent idempotently without a product project', async t => {
  const f = fixture(t), first = await registerCurrentCoordination(options(f));
  assert.equal(first.status, 'registered'); assert.equal(first.run.scope, 'supervised_coordination');
  assert.equal(first.run.accountingSource, 'supervised_coordination'); assert.match(first.run.run_id, COORDINATION_RUN);
  assert.equal(first.run.coordination_dir, f.coordinationDir);
  assert.equal(first.run.coordination_id, require('./contract.cjs').digest(f.coordinationDir));
  assert.equal(validCoordinationBinding(first.binding, { coordination_dir: f.coordinationDir, role: 'pm-delivery' }), true);
  const second = await registerCurrentCoordination(options(f));
  assert.equal(second.status, 'already_registered'); assert.equal(second.run.run_id, first.run.run_id);
  assert.deepEqual(readCoordination(f.root, first.run.run_id).native_binding, first.binding);
  assert.equal(readRun(f.root, first.run.run_id), null);
  assert.equal(fs.existsSync(path.join(f.root, 'runs')), false);
  assert.deepEqual(candidates(f.root), [], 'continuous product capture does not admit coordination storage');
});

test('reader keeps coordination storage isolated from product registrations', async t => {
  const f = fixture(t), result = await registerCurrentCoordination(options(f));
  const productDir = path.join(f.root, 'product'); fs.mkdirSync(path.join(productDir, '.planning'), { recursive: true });
  const { registerRun } = require('./global-store.cjs');
  const product = registerRun({ root: f.root, projectDir: productDir });
  assert.equal(readCoordination(f.root, product.run_id), null);
  assert.equal(readRun(f.root, result.run.run_id), null);
  assert.equal(fs.readdirSync(path.join(f.root, 'coordination-runs')).length, 1);
});

test('rejects ambiguous role, authority, identity, rollout and pre-scoped parents', async t => {
  const f = fixture(t);
  await assert.rejects(registerCurrentCoordination({ ...options(f), role: 'orchestrator' }), /codex_bridge_coordination_role_invalid/);
  fs.writeFileSync(path.join(f.coordinationDir, 'ASSIGNMENT.json'), JSON.stringify({ name: 'pm-automation', title: 'PM Automation', session: 'pm-session', index: 9, workers: [] }));
  await assert.rejects(registerCurrentCoordination(options(f)), /coordination_assignment_mismatch/);
  fs.writeFileSync(path.join(f.coordinationDir, 'ASSIGNMENT.json'), JSON.stringify({ name: 'pm-delivery', title: 'PM Delivery', session: 'pm-session', index: 9, workers: [] }));
  await assert.rejects(registerCurrentCoordination({ ...options(f), expectedStartTime: 'wrong' }), /codex_bridge_identity_mismatch/);
  await assert.rejects(registerCurrentCoordination({ ...options(f), threadId: 'other-thread' }), /codex_bridge_rollout_mismatch/);
  f.process.environment.SGSD_RUN_ID = 'sgsd-pre-scoped';
  await assert.rejects(registerCurrentCoordination(options(f)), /codex_bridge_process_already_scoped/);
});

test('supported coordination CLI registers representative PM1, PM2 and Deploy artifacts', t => {
  if (process.platform !== 'linux') return t.skip('native process identity fixture is Linux-only');
  const f = fixture(t), bridge = path.join(__dirname, 'codex-parent-bridge.cjs');
  fs.writeFileSync(path.join(f.coordinationDir, 'ASSIGNMENT.json'), JSON.stringify({ name: 'pm-delivery', title: 'PM Delivery', session: 'pm-session', index: 9, workers: [] }));
  const cases = [
    { role: 'pm-delivery', name: 'pm-delivery', title: 'PM Delivery', session: 'delivery-session' },
    { role: 'pm-automation', name: 'pm-automation', title: 'PM Automation', session: 'automation-session' },
    { role: 'deploy', name: null, title: null, session: 'deploy-session' },
  ];
  for (const item of cases) {
    const directory = path.join(f.root, `case-${item.role}`); fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, 'CHARTER.md'), item.role === 'deploy' ? '# Deploy\nYou are the single release owner.\n' : `# ${item.title}\n`);
    if (item.role === 'deploy') fs.writeFileSync(path.join(directory, 'CURRENT.md'), '# Current\nOwner: deploy (deploy-20260915-1789483598);\n');
    else fs.writeFileSync(path.join(directory, 'ASSIGNMENT.json'), JSON.stringify({ name: item.name, title: item.title, session: item.session, index: 9, workers: [] }));
    const executable = path.join(f.root, 'codex', '0.154.0', 'bin', `codex-${item.role}`); fs.mkdirSync(path.dirname(executable), { recursive: true });
    fs.copyFileSync('/usr/bin/sleep', executable); fs.chmodSync(executable, 0o755);
    const child = spawn(executable, ['60'], { cwd: directory, env: { ...process.env, SGSD_RUN_ID: '', SGSD_ATLAS_PROJECT_ID: '' }, stdio: 'ignore' });
    try {
      const identity = processIdentity(child.pid); assert.ok(identity?.start_time);
      const rollout = path.join(directory, 'rollout.jsonl');
      fs.writeFileSync(rollout, [
        JSON.stringify({ type: 'session_meta', payload: { session_id: item.session, cwd: directory, model_provider: 'openai', source: 'cli', cli_version: '0.154.0' }}), '\n',
        JSON.stringify({ type: 'event_msg', payload: { thread_id: item.session } }), '\n'].join(''));
      const result = spawnSync(process.execPath, [bridge, '--root', f.root, '--coordination-dir', directory, '--role', item.role,
        '--pid', String(child.pid), '--start-time', identity.start_time, '--session-id', item.session, '--thread-id', item.session,
        '--rollout-file', rollout], { encoding: 'utf8', timeout: 5000 });
      assert.equal(result.status, 0, result.stderr);
      const receipt = JSON.parse(result.stdout);
      assert.equal(receipt.status, 'registered'); assert.equal(receipt.run.scope, 'supervised_coordination');
      assert.equal(receipt.run.role, item.role); assert.equal(readCoordination(f.root, receipt.run.run_id).authority_epoch, item.role === 'deploy' ? 'deploy-20260915-1789483598' : item.session);
      assert.equal(readRun(f.root, receipt.run.run_id), null);
    } finally { child.kill('SIGTERM'); }
  }
});

test('parses the actual Deploy Markdown owner epoch without an assignment artifact', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-deploy-authority-')), charter = path.join(root, 'CHARTER.md'), current = path.join(root, 'CURRENT.md');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(charter, '# Deploy worker contract\nYou are the single release owner.\n');
  fs.writeFileSync(current, '## Owner\nOwner: deploy (`deploy-20260915-1789483598`);\n');
  const authority = coordinationFiles(root, 'deploy');
  assert.equal(authority.epoch, 'deploy-20260915-1789483598');
  assert.equal(authority.assignment, null);
});
