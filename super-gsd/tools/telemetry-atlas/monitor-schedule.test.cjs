'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const os=require('node:os'),crypto=require('node:crypto');
const file=path.join(__dirname,'monitor-schedule.cjs');
const api=fs.existsSync(file)?require(file):{};
test('marked cron install preserves unrelated jobs and is idempotent',()=>{
  assert.equal(typeof api.mergeCrontab,'function');
  const old='MAILTO=\"\"\n0 4 * * * /existing/job\n';
  const next=api.mergeCrontab(old,"* * * * * '/node' '/monitor' tick");
  assert.ok(next.startsWith(old));
  assert.equal(api.mergeCrontab(next,"* * * * * '/node' '/monitor' tick"),next);
  assert.equal(api.mergeCrontab(next,null),old);
});
test('ambiguous or injected cron input is refused',()=>{
  assert.throws(()=>api.mergeCrontab('# BEGIN SGSD ATLAS MONITOR\n', 'job'));
  assert.throws(()=>api.mergeCrontab('', 'job\nsecond job'));
});
test('daily UTC due logic distinguishes successful audit from retries',()=>{
  assert.equal(api.dailyDue(Date.parse('2026-09-10T05:59:00Z'),null),false);
  assert.equal(api.dailyDue(Date.parse('2026-09-10T06:01:00Z'),null),true);
  assert.equal(api.dailyDue(Date.parse('2026-09-10T12:00:00Z'),{completed_at:'2026-09-10T07:00:00Z'}),false);
  assert.equal(api.dailyDue(Date.parse('2026-09-11T06:00:00Z'),{completed_at:'2026-09-10T07:00:00Z'}),true);
  assert.equal(api.dailyDue(Date.parse('2026-09-10T12:00:00Z'),{attempted_at:'2026-09-10T11:55:00Z',status:'failed'}),false);
});
test('backup acknowledgement binds to the actual exported manifest and rejects future receipts',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-receipt-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const bundle_id='atlas-20260910T120000Z-1234abcd',dir=path.join(root,'monitor/exports',bundle_id);fs.mkdirSync(dir,{recursive:true});
  const body=JSON.stringify({schema_version:1,bundle_id,sealed:true,audit_status:'WARN',capture_status:'incomplete'});fs.writeFileSync(path.join(dir,'manifest.json'),body);
  const raw={status:'verified',bundle_id,verified_at:new Date().toISOString(),manifest_sha256:crypto.createHash('sha256').update(body).digest('hex')};
  assert.equal(typeof api.acceptReceipt,'function');
  assert.throws(()=>api.acceptReceipt(root,{...raw,manifest_sha256:'0'.repeat(64)}),/manifest/);
  assert.throws(()=>api.acceptReceipt(root,{...raw,verified_at:'2999-01-01T00:00:00Z'}),/receipt/);
  const result=api.acceptReceipt(root,raw);assert.equal(result.audit_status,'WARN');assert.equal(result.capture_status,'incomplete');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'monitor/backup.json'))).manifest_sha256,raw.manifest_sha256);
});
test('malformed daily state and stale lock are preserved rather than silently replaced',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-schedule-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const dir=path.join(root,'monitor');fs.mkdirSync(dir);const file=path.join(dir,'daily.json');fs.writeFileSync(file,'malformed');
  assert.throws(()=>api.readDailyState(file));assert.equal(fs.readFileSync(file,'utf8'),'malformed');
  const lock=path.join(dir,'tick.lock'),body=JSON.stringify({pid:2147483647,token:'old'});fs.writeFileSync(lock,body);
  assert.throws(()=>api.locked(root,'tick',()=>assert.fail('must not run')),/stale_lock/);assert.equal(fs.readFileSync(lock,'utf8'),body);
});
test('monitor internal failure is not recorded as a successful schedule execution',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-tick-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const dir=path.join(root,'monitor');fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'.check.lock'),'{}');
  const now=new Date().toISOString();fs.writeFileSync(path.join(dir,'daily.json'),JSON.stringify({schema_version:1,status:'completed',attempted_at:now,completed_at:now}));
  const result=api.tick(root);assert.equal(result.status,'failed');assert.equal(result.reason,'monitor_did_not_publish');
});
