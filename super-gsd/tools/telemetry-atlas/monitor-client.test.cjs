'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const file=path.join(__dirname,'monitor-client.cjs'),api=fs.existsSync(file)?require(file):{};
function fixture(t){const p=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-client-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;}
test('catalogue refuses unsafe names and never trusts arbitrary remote paths',()=>{
  assert.equal(typeof api.validateCatalogue,'function');
  assert.throws(()=>api.validateCatalogue({bundles:[{bundle_id:'../../secret'}]},'/global'));
  assert.throws(()=>api.validateCatalogue({bundles:[{bundle_id:'atlas-20260910T120000Z-1234abcd',remote_directory:'/secret',files:[]}]},'/global'));
});
test('failed SSH preserves prior verified copy and records explicit failure',async t=>{
  const root=fixture(t),bundle_id='atlas-20260909T120000Z-1234abcd',when='2026-09-09T12:00:00Z';
  const dir=path.join(root,'snapshots',bundle_id);fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(path.join(root,'receipts'));fs.writeFileSync(path.join(dir,'manifest.json'),'{}');
  const manifest_sha256=require('node:crypto').createHash('sha256').update('{}').digest('hex');
  fs.writeFileSync(path.join(root,'receipts',bundle_id+'.json'),JSON.stringify({schema_version:1,status:'verified',bundle_id,verified_at:when,manifest_sha256}));
  fs.writeFileSync(path.join(root,'status.json'),JSON.stringify({schema_version:1,status:'verified',last_verified_at:when,bundle_id,manifest_sha256}));
  const result=await api.pull({root,transport:{json(){throw new Error('ssh_unavailable');}}});
  assert.equal(result.status,'failed');assert.equal(result.last_verified_at,'2026-09-09T12:00:00Z');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'status.json'))).reason,'ssh_unavailable');
});
test('absent local status is unobserved rather than a verified zero',t=>{
  const s=api.localStatus(fixture(t));assert.equal(s.status,'unobserved');assert.equal(s.last_verified_at,null);
});
test('remote command configuration rejects shell injection',()=>{
  assert.throws(()=>api.remoteCommand({remote_node:'/node;touch /x',remote_tools:'/tools',remote_root:'/global'},'snapshot'));
});
test('Windows task is user-scoped hidden and catch-up enabled',()=>{
  const installer=path.resolve(__dirname,'../../scripts/install-atlas-monitor-task.ps1');
  assert.ok(fs.existsSync(installer),'task installer exists');
  const body=fs.readFileSync(installer,'utf8');
  for(const required of ['Interactive','Limited','StartWhenAvailable','IgnoreNew','AtLogOn','WindowStyle Hidden','SGSD-Atlas-Monitor'])assert.ok(body.includes(required),required);
  assert.ok(!body.includes('Unregister-ScheduledTask')||body.includes('if ($Remove)'));
  assert.ok(!body.includes('Set-Service'));
});
test('verified WARN bundle copies once; a later tampered transfer retains the earlier good copy',async t=>{
  const evidence=require('./monitor-evidence.cjs'),base=fixture(t),remote=path.join(base,'remote'),root=path.join(base,'local'),project=path.join(base,'clarity');
  fs.mkdirSync(path.join(project,'.git'),{recursive:true});fs.mkdirSync(root,{recursive:true});
  fs.writeFileSync(path.join(root,'config.json'),JSON.stringify({remote_root:'/fixture'}));
  const auditReport={schema_version:1,status:'WARN',complete_coverage:false,generated_at:'2026-09-10T06:00:00.000Z',findings:[],projects:[]};
  const first=await evidence.createBundle({root:remote,projectDirs:[project],now:Date.UTC(2026,8,10,6),auditReport});
  let tamper=false,copies=0;const acknowledged=[];
  const transport={json(command,receipt){if(command==='snapshot')return {schema_version:1,status:'WARN'};if(command==='catalogue'){const result=evidence.catalogue({root:remote});for(const b of result.bundles)b.remote_directory='/fixture/monitor/exports/'+b.bundle_id;return result;}acknowledged.push(receipt);return receipt;},copy(dir,names,dest){copies++;const source=path.join(remote,'monitor/exports',dir.split('/').pop());for(const name of names){fs.copyFileSync(path.join(source,name),path.join(dest,name));if(tamper&&name!=='manifest.json')fs.appendFileSync(path.join(dest,name),'tamper');}}};
  const good=await api.pull({root,transport});assert.equal(good.status,'verified',good.reason);assert.equal(good.audit_status,'WARN');assert.equal(acknowledged.length,1);
  const exhausted=await api.pull({root,budgetMs:0,transport});assert.equal(exhausted.reason,'pull_time_budget_exceeded');assert.equal(exhausted.last_verified_at,good.last_verified_at);
  const count=copies;assert.equal((await api.pull({root,transport})).copied_bundles,0);assert.equal(copies,count);
  await evidence.createBundle({root:remote,projectDirs:[project],now:Date.UTC(2026,8,10,7),auditReport});tamper=true;
  const bad=await api.pull({root,transport});assert.equal(bad.status,'failed');assert.equal(bad.bundle_id,first.bundle_id);assert.equal(bad.last_verified_at,good.last_verified_at);
  assert.equal(evidence.verifyBundle({directory:path.join(root,'snapshots',first.bundle_id)}).verified,true);
});
test('pull deadline cannot promote an unproven historical status to verification',async t=>{
  const root=fixture(t),when=new Date().toISOString();fs.writeFileSync(path.join(root,'status.json'),JSON.stringify({last_verified_at:when}));
  const result=await api.pull({root,budgetMs:0,transport:{json(){throw new Error('must_not_dispatch');}}});
  assert.equal(result.reason,'pull_time_budget_exceeded');assert.equal(result.last_verified_at,null);
});
test('open refuses an unrelated occupied port without stopping its listener',async t=>{
  const http=require('node:http'),root=fixture(t),server=http.createServer((req,res)=>res.end('unrelated'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());
  fs.writeFileSync(path.join(root,'config.json'),JSON.stringify({local_port:server.address().port}));
  await assert.rejects(api.openCockpit(root),/local_port_already_in_use/);assert.equal(server.listening,true);
});
test('present invalid config does not contact default DEVCP and future status is not verified',async t=>{
  const root=fixture(t);fs.writeFileSync(path.join(root,'config.json'),'{bad');let contacted=false;
  const result=await api.pull({root,transport:{json(){contacted=true;return {};}}});assert.equal(result.status,'failed');assert.match(result.reason,/config/);assert.equal(contacted,false);
  fs.writeFileSync(path.join(root,'status.json'),JSON.stringify({schema_version:1,status:'verified',last_verified_at:'2999-01-01T00:00:00Z'}));
  const status=api.localStatus(root);assert.notEqual(status.status,'verified');assert.equal(status.copy_overdue,true);
});
test('slow catalogue cannot report success after aggregate deadline',async t=>{
  const root=fixture(t);const result=await api.pull({root,budgetMs:10,transport:{json(command){if(command==='snapshot')return {schema_version:1,status:'WARN'};Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,30);return {bundles:[]};}}});
  assert.equal(result.status,'failed');assert.equal(result.reason,'pull_time_budget_exceeded');
});
