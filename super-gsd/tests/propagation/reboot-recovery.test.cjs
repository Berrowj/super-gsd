'use strict';
// Shell-boundary fixtures: no real providers, tmux sessions or Atlas production root.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const sg = path.resolve(__dirname, '../../scripts/sg');
const shellTest = (name, fn) => test(name, {skip:process.platform !== 'linux'}, fn);
const ID = 'a'.repeat(64), OTHER = 'b'.repeat(64);

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-recovery-shell-'));
  t.after(() => fs.rmSync(base, {recursive:true, force:true}));
  const home = path.join(base,'home'), source = path.join(base,'source with spaces');
  const scripts = path.join(base,'scripts with spaces'), agents = path.join(base,'agents');
  const toolDir = path.join(source,'super-gsd/tools/telemetry-atlas');
  for (const dir of [home,scripts,agents,toolDir]) fs.mkdirSync(dir,{recursive:true});
  const calls = path.join(base,'calls.jsonl'), launches = path.join(base,'launches');
  fs.writeFileSync(path.join(scripts,'sgsd-remote-tmux.sh'), '#!/usr/bin/env bash\nprintf "%s\\n" "$@" >> "$SG_TEST_LAUNCHES"\n');
  // The real coordinator is tested separately. This executable records the
  // shortcut's argument boundaries and advertises a fixed candidate list.
  fs.writeFileSync(path.join(toolDir,'workspace-recovery.cjs'), `
    const fs=require('node:fs');
    const args=process.argv.slice(2);
    fs.appendFileSync(process.env.SG_TEST_CALLS,JSON.stringify(args)+'\\n');
    const projects=[{project_id:'${ID}',display_name:'SQL',project_dir:'/fixture/sql',context_status:[{path:'.planning/HANDOFF.json',status:'missing'}]},
      {project_id:'${OTHER}',display_name:'Design',project_dir:'/fixture/design'}];
    if(args[0]==='list')process.stdout.write(JSON.stringify({entries:projects})+'\\n');
    else if(args[0]==='offer')process.stdout.write(JSON.stringify({needed:true,boot_id:'11111111-1111-4111-8111-111111111111',entries:projects})+'\\n');
    else process.stdout.write(JSON.stringify({status:'fixture',args})+'\\n');
    process.exitCode=Number(process.env.SG_TEST_RECOVERY_EXIT||0);
  `);
  const env = {...process.env, HOME:home, SGSD_SCRIPTS_DIR:scripts, SGSD_AGENTS_DIR:agents,
    PATH:`${path.dirname(process.execPath)}:${process.env.PATH}`,
    SGSD_SOURCE_DIR:source, SG_TEST_CALLS:calls, SG_TEST_LAUNCHES:launches};
  for(const key of ['BASH_ENV','ENV','SGSD_ATLAS_GLOBAL_ROOT','SGSD_RUN_ID','SGSD_RESTORE_ID'])delete env[key];
  function run(args=[], extra={}) {
    return spawnSync('bash',[sg,...args],{cwd:home,env:{...env,...extra},encoding:'utf8',timeout:10000});
  }
  function interactive(input, args=[]) {
    const quote = value => "'"+value.replaceAll("'", "'\\''")+"'";
    return spawnSync('script',['-qefc',['bash',sg,...args].map(quote).join(' '),'/dev/null'],
      {cwd:home,env,encoding:'utf8',input,timeout:10000});
  }
  return {run,interactive,calls:()=>fs.existsSync(calls)?fs.readFileSync(calls,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[],
    launches:()=>fs.existsSync(launches)?fs.readFileSync(launches,'utf8'):null,source,scripts,agents};
}

shellTest('sg --sessions is read-only from home and never launches a local owner', t => {
  const f=fixture(t), r=f.run(['--sessions']);
  assert.equal(r.status,0,r.stderr);
  assert.equal(f.launches(),null);
  assert.ok(f.calls().some(args=>args[0]==='list'));
  assert.match(r.stdout,/SQL/);
});

shellTest('sg explicit all restore delegates detached coordinator operation without local duplicate', t => {
  const f=fixture(t), r=f.run(['--restore','all']);
  assert.equal(r.status,0,r.stderr); assert.equal(f.launches(),null);
  const call=f.calls().find(args=>args[0]==='restore'); assert.ok(call);
  assert.ok(call.includes('--all'));
  for(const key of ['scripts','agents','source']) assert.equal(call[call.indexOf('--'+key+'-dir')+1],f[key]);
  assert.ok(!call.includes('--go'));
});

shellTest('sg selected retry passes exact project IDs without widening to all', t => {
  const f=fixture(t),r=f.run(['--restore',ID+','+OTHER]);
  assert.equal(r.status,0,r.stderr);assert.equal(f.launches(),null);
  const call=f.calls().find(args=>args[0]==='restore');assert.ok(call);
  assert.deepEqual(call.flatMap((v,i)=>v==='--project-id'?[call[i+1]]:[]),[ID,OTHER]);
  assert.ok(!call.includes('--all'));
});

shellTest('non-TTY restore without selection refuses and never guesses all', t => {
  const f=fixture(t),r=f.run(['--restore']);
  assert.notEqual(r.status,0);assert.equal(f.launches(),null);
  assert.ok(!f.calls().some(args=>args[0]==='restore'));
  assert.match(r.stderr,/selection|interactive|TTY/i);
});

shellTest('sg --forget changes list intent only and does not launch', t => {
  const f=fixture(t),r=f.run(['--forget',ID]);
  assert.equal(r.status,0,r.stderr);assert.equal(f.launches(),null);
  const call=f.calls().find(args=>args[0]==='forget');assert.ok(call);
  assert.equal(call[call.indexOf('--project-id')+1],ID);
});

shellTest('recovery failure propagates instead of falling through into a local session', t => {
  const f=fixture(t),r=f.run(['--restore','all'],{SG_TEST_RECOVERY_EXIT:'23'});
  assert.equal(r.status,23,r.stderr);assert.equal(f.launches(),null);
});

shellTest('ordinary non-TTY sg keeps the single current-terminal path and does not restore a fleet', t => {
  const f=fixture(t),r=f.run();assert.equal(r.status,0,r.stderr);
  assert.match(f.launches(),/--current-terminal/);
  assert.ok(!f.calls().some(args=>args[0]==='restore'));
});

shellTest('help and invalid recovery arguments do not start providers', t => {
  const f=fixture(t),r=f.run(['--help']);assert.equal(r.status,0,r.stderr);assert.equal(f.launches(),null);
  assert.match(r.stdout,/--restore/);
  for(const args of [['--forget'],['--restore','all','--go'],['--sessions','--restore','all']]) {
    assert.notEqual(f.run(args).status,0,JSON.stringify(args));assert.equal(f.launches(),null);
  }
});

shellTest('real TTY reboot offer restores all only after explicit choice and returns', t => {
  const f=fixture(t),r=f.interactive('all\n');
  assert.equal(r.status,0,r.stderr+r.stdout);assert.equal(f.launches(),null);
  assert.ok(f.calls().some(args=>args[0]==='offer'));
  assert.match(r.stdout,/HANDOFF.json.*missing/);
  assert.ok(f.calls().some(args=>args[0]==='restore'&&args.includes('--all')));
});

shellTest('explicit project on first interactive sg still offers reboot recovery',t=>{
  const f=fixture(t),r=f.interactive('all\n',['--project','/fixture/sql']);
  assert.equal(r.status,0,r.stderr+r.stdout);assert.equal(f.launches(),null);
  assert.ok(f.calls().some(args=>args[0]==='offer'));
  assert.ok(f.calls().some(args=>args[0]==='restore'&&args.includes('--all')));
});

shellTest('real TTY selected restore is exact and not-now never restores', t => {
  const f=fixture(t),r=f.interactive('2\n',['--restore']);
  assert.equal(r.status,0,r.stderr+r.stdout);assert.equal(f.launches(),null);
  const call=f.calls().find(args=>args[0]==='restore');assert.ok(call);
  assert.equal(call[call.indexOf('--project-id')+1],OTHER);assert.ok(!call.includes('--all'));
  const g=fixture(t),declined=g.interactive('n\n');
  assert.equal(declined.status,0,declined.stderr+declined.stdout);
  assert.ok(!g.calls().some(args=>args[0]==='restore'));
  assert.ok(g.calls().some(args=>args[0]==='offer'&&args.includes('--acknowledge')));
  assert.match(g.launches(),/--current-terminal/);
});

shellTest('blank TTY choice is not implicit all; explicit menu cancellation launches nothing', t => {
  const f=fixture(t),r=f.interactive('\n',['--restore']);
  assert.equal(r.status,0,r.stderr+r.stdout);assert.equal(f.launches(),null);
  assert.ok(!f.calls().some(args=>args[0]==='restore'));
});
