'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bindSessionOwner, findProviderAncestor } = require('./atlas-session-owner.cjs');

test('manual boot is unregistered and never invokes a binding writer', () => {
  let calls = 0;
  const result = bindSessionOwner({ environment: {}, projectDir: '/project', bind: () => calls++ });
  assert.equal(result.status, 'unregistered');
  assert.equal(calls, 0);
});
test('worker registration never acquires orchestration ownership', () => {
  let calls = 0;
  const result = bindSessionOwner({ environment: { SGSD_RUN_ID: 'run', SGSD_ATLAS_GLOBAL_ROOT: '/state' },
    projectDir: '/project', bind: () => calls++ });
  assert.equal(result.status, 'unmanaged');
  assert.equal(calls, 0);
});
test('binding uses actual provider ancestor and payload session identity, never hook pid', () => {
  let received;
  const result = bindSessionOwner({ environment: { SGSD_RUN_ID: 'run', SGSD_ATLAS_GLOBAL_ROOT: '/state', SGSD_FLEET_MANAGED: '1' },
    projectDir: '/project', sessionId: 'claude-session', findProvider: () => 222, remember:()=>{},
    bind: input => { received = input; return { status: 'bound', run_id: input.runId }; } });
  assert.equal(received.pid, 222);
  assert.equal(received.sessionId, 'claude-session');
  assert.equal(received.projectDir, '/project');
  assert.equal(result.status, 'bound');
});
test('no provider and rejected ownership remain blocked, not attached', () => {
  const options = { environment: { SGSD_RUN_ID: 'run', SGSD_ATLAS_GLOBAL_ROOT: '/state', SGSD_FLEET_MANAGED: '1' }, projectDir: '/project' };
  assert.equal(bindSessionOwner({ ...options, findProvider: () => null }).status, 'blocked');
  assert.equal(bindSessionOwner({ ...options, findProvider: () => 222, bind: () => { throw Error('wrong_project'); } }).status, 'blocked');
});
test('ancestor walk skips shells, refuses another run, and has a strict depth limit', () => {
  const rows = new Map([[5, { ppid: 4, provider: false, runId: 'r' }], [4, { ppid: 3, provider: true, runId: 'r' }]]);
  assert.equal(findProviderAncestor({ pid: 5, runId: 'r', lookup: p => rows.get(p) }), 4);
  assert.equal(findProviderAncestor({ pid: 5, runId: 'other', lookup: p => rows.get(p) }), null);
  let calls = 0;
  assert.equal(findProviderAncestor({ pid: 100, runId: 'r', lookup: p => { calls++; return { ppid: p - 1, provider: false, runId: 'r' }; } }), null);
  assert.equal(calls, 16);
});

test('verified binding remembers workspace intent and validated tmux preference only afterwards', () => {
  const calls=[];
  const result=bindSessionOwner({projectDir:'/project',sessionId:'provider-session',
    environment:{SGSD_RUN_ID:'run',SGSD_ATLAS_GLOBAL_ROOT:'/state',SGSD_FLEET_MANAGED:'1',TMUX_PANE:'%7',SGSD_TMUX_SESSION:'sgsd-project'},
    findProvider:()=>222,
    bind:input=>{calls.push(['bind',input]);return {status:'bound'};},
    remember:input=>{calls.push(['remember',input]);}});
  assert.equal(result.status,'bound');assert.deepEqual(calls.map(row=>row[0]),['bind','remember']);
  assert.deepEqual(calls[0][1].tmux,{pane_id:'%7',session_name:'sgsd-project'});
  assert.deepEqual(calls[1][1],{root:'/state',runId:'run',preferredSession:'sgsd-project'});
});

test('failed binding never remembers and failed catalog persistence stays visibly blocked', () => {
  let remembered=0;
  const options={projectDir:'/project',environment:{SGSD_RUN_ID:'run',SGSD_ATLAS_GLOBAL_ROOT:'/state',SGSD_FLEET_MANAGED:'1'},
    findProvider:()=>222,remember:()=>{remembered++;}};
  assert.equal(bindSessionOwner({...options,bind:()=>({status:'blocked'})}).status,'blocked');
  assert.equal(remembered,0);
  const failed=bindSessionOwner({...options,bind:()=>({status:'bound'}),remember:()=>{throw Error('recovery_catalog_invalid');}});
  assert.equal(failed.status,'blocked');assert.equal(failed.reason,'recovery_catalog_invalid');
});
