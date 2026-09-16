'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { registerCurrentCoordination } = require('./codex-parent-bridge.cjs');
const { readRun, readCoordination, validCoordinationBinding } = require('./global-store.cjs');
const { COORDINATION_RUN } = require('./supervised-coordination.cjs');
const { candidates } = require('./codex-continuous-manager.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-coordination-'));
  const coordinationDir = path.join(root, 'pm-delivery'); fs.mkdirSync(coordinationDir, { recursive: true });
  fs.writeFileSync(path.join(coordinationDir, 'CHARTER.md'), '# PM Delivery\n');
  fs.writeFileSync(path.join(coordinationDir, 'ASSIGNMENT.json'), JSON.stringify({ name: 'PM Delivery', session: 'pm-session', index: 9, workers: [] }));
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
  fs.writeFileSync(path.join(f.coordinationDir, 'ASSIGNMENT.json'), JSON.stringify({ name: 'PM Automation', session: 'pm-session', index: 9, workers: [] }));
  await assert.rejects(registerCurrentCoordination(options(f)), /coordination_assignment_mismatch/);
  fs.writeFileSync(path.join(f.coordinationDir, 'ASSIGNMENT.json'), JSON.stringify({ name: 'PM Delivery', session: 'pm-session', index: 9, workers: [] }));
  await assert.rejects(registerCurrentCoordination({ ...options(f), expectedStartTime: 'wrong' }), /codex_bridge_identity_mismatch/);
  await assert.rejects(registerCurrentCoordination({ ...options(f), threadId: 'other-thread' }), /codex_bridge_rollout_mismatch/);
  f.process.environment.SGSD_RUN_ID = 'sgsd-pre-scoped';
  await assert.rejects(registerCurrentCoordination(options(f)), /codex_bridge_process_already_scoped/);
});
