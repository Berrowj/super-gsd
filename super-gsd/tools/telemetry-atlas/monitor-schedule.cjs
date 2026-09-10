#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync,spawn}=require('node:child_process');
const {rootPath}=require('./global.cjs');
const {readJson,writeJson}=require('./global-store.cjs');
const {privateDirectory}=require('./quota-sampler.cjs');
const {safePath,fileDigest}=require('./contract.cjs');
const BEGIN='# BEGIN SGSD ATLAS MONITOR',END='# END SGSD ATLAS MONITOR';
const ID=/^atlas-\d{8}T\d{6}Z-[a-f0-9]{8}$/;
function mergeCrontab(current,entry) {
  if(typeof current!=='string'||current.length>1024*1024||entry!=null&&(/[\r\n%]/.test(entry)||typeof entry!=='string')) throw new Error('invalid_cron_input');
  const start=current.indexOf(BEGIN),end=current.indexOf(END);
  if((start<0)!==(end<0)||start>=0&&(end<start||current.indexOf(BEGIN,start+1)>=0||current.indexOf(END,end+1)>=0)) throw new Error('ambiguous_cron_markers');
  let kept=current;
  if(start>=0) {if(start>0&&current[start-1]!=='\n') throw new Error('invalid_cron_boundary');const after=end+END.length;if(after<current.length&&current[after]!=='\n')throw new Error('invalid_cron_boundary');kept=current.slice(0,start)+current.slice(after+(current[after]==='\n'?1:0));}
  return entry==null?kept:kept+(kept&&!kept.endsWith('\n')?'\n':'')+BEGIN+'\n'+entry+'\n'+END+'\n';
}
function dailyDue(now,state) {
  const day=new Date(now).toISOString().slice(0,10);
  if(new Date(now).getUTCHours()<6) return false;
  if(state?.completed_at?.slice(0,10)===day)return false;
  if(Number.isFinite(Date.parse(state?.attempted_at))&&now-Date.parse(state.attempted_at)<3600000)return false;
  return true;
}
function readOptional(file,max=2*1024*1024){try{return readJson(file,max);}catch{return null;}}
function locked(root,name,fn){
  const dir=path.join(root,'monitor');privateDirectory(dir);
  const file=path.join(dir,name+'.lock');safePath(file);
  if(fs.existsSync(file)) {const old=readJson(file); if(!Number.isSafeInteger(old.pid)||old.pid<=0)throw new Error('lock_unverified');let alive=true;try{process.kill(old.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}if(alive)return {status:'already_running'};throw new Error('stale_lock_requires_review');}
  const token=crypto.randomUUID();const fd=fs.openSync(file,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({pid:process.pid,token}));fs.closeSync(fd);
  try{return fn();}finally{if(readOptional(file)?.token===token)fs.unlinkSync(file);}
}
function shellQuote(value){if(/[\r\n\0%]/.test(value))throw new Error('unsafe_shell_value');return "'"+value.replace(/'/g,"'\\''")+"'";}
function crontab(){const r=spawnSync('crontab',['-l'],{encoding:'utf8',timeout:5000,maxBuffer:1024*1024,windowsHide:true});if(r.error||r.status!==0&&!(r.status===1&&/no crontab/i.test(r.stderr)))throw new Error('crontab_read_failed');return r.status===0?r.stdout:'';}
function install(root,remove=false){
  if(process.platform!=='linux')throw new Error('linux_scheduler_required');
  return locked(root,'schedule-install',()=>{const before=crontab();const entry=remove?null:'* * * * * '+shellQuote(process.execPath)+' '+shellQuote(__filename)+' tick --root '+shellQuote(root)+' >/dev/null 2>&1';const next=mergeCrontab(before,entry);if(crontab()!==before)throw new Error('crontab_changed_during_install');if(next!==before){writeJson(path.join(root,'monitor/crontab-preimage-'+crypto.randomUUID()+'.json'),{schema_version:1,at:new Date().toISOString(),crontab:before});const r=spawnSync('crontab',['-'],{input:next,encoding:'utf8',timeout:5000,maxBuffer:1024*1024});if(r.error||r.status!==0)throw new Error('crontab_install_failed');}if(crontab()!==next)throw new Error('crontab_install_unverified');const result={schema_version:1,status:remove?'disabled':'installed',at:new Date().toISOString(),node:process.execPath,script:__filename,concurrency:'optimistic_read_compare_not_atomic_cas'};writeJson(path.join(root,'monitor/schedule.json'),result);return result;});
}
function readDailyState(file){
  if(!fs.existsSync(file))return null;
  const state=readJson(file,65536);
  if(state?.schema_version!==1||!['running','completed','failed'].includes(state.status)||!Number.isFinite(Date.parse(state.attempted_at))||state.status==='completed'&&!Number.isFinite(Date.parse(state.completed_at)))throw new Error('daily_state_invalid');
  return state;
}
function daily(root){return locked(root,'daily',()=>{
  const file=path.join(root,'monitor/daily.json');const now=Date.now();
  if(!dailyDue(now,readDailyState(file)))return {status:'not_due'};
  const attempted_at=new Date(now).toISOString();writeJson(file,{schema_version:1,status:'running',attempted_at});
  const r=spawnSync(process.execPath,[path.join(__dirname,'monitor-evidence.cjs'),'export','--root',root],{encoding:'utf8',timeout:600000,maxBuffer:8*1024*1024,windowsHide:true});
  let report;try{report=JSON.parse(r.stdout);}catch{}
  const succeeded=!r.error&&[0,10,1].includes(r.status)&&report?.verified===true;
  const result={schema_version:1,status:succeeded?'completed':'failed',attempted_at,audit_exit:r.status,...(succeeded?{completed_at:new Date().toISOString(),bundle_id:report.bundle_id,audit_status:report.audit_status}:{}),reason:succeeded?null:r.error?.code==='ETIMEDOUT'?'export_timeout':'export_failed'};
  writeJson(file,result);return result;
});}
function tick(root){return locked(root,'tick',()=>{
  const r=spawnSync(process.execPath,[path.join(__dirname,'monitor.cjs'),'check','--root',root],{encoding:'utf8',timeout:20000,maxBuffer:4*1024*1024,windowsHide:true});
  let report;try{report=JSON.parse(r.stdout);}catch{}
  const valid=!r.error&&[0,10,1].includes(r.status)&&report?.schema_version===1&&['PASS','WARN','FAIL'].includes(report.status)&&Number.isFinite(Date.parse(report.generated_at))&&Array.isArray(report.projects)&&Array.isArray(report.findings)&&readOptional(path.join(root,'monitor/latest.json'))?.generated_at===report.generated_at;
  const result={schema_version:1,checked_at:new Date().toISOString(),status:valid?'executed':'failed',monitor_exit:r.status,reason:valid?null:r.error?.code||'monitor_did_not_publish'};
  writeJson(path.join(root,'monitor/schedule-last-run.json'),result);
  let due=false;try{due=dailyDue(Date.now(),readDailyState(path.join(root,'monitor/daily.json')));}catch{result.status='failed';result.reason='daily_state_unreadable';writeJson(path.join(root,'monitor/schedule-last-run.json'),result);}
  if(due) {
    const child=spawn(process.execPath,[__filename,'daily','--root',root],{stdio:'ignore',detached:true,windowsHide:true});child.on('error',()=>{});child.unref();
  }
  return result;
});}
function acceptReceipt(root,raw){
  const verified=Date.parse(raw?.verified_at);
  if(raw?.status!=='verified'||!ID.test(raw.bundle_id)||!/^[a-f0-9]{64}$/.test(raw.manifest_sha256)||!Number.isFinite(verified)||verified>Date.now()+60000)throw new Error('invalid_receipt');
  const file=path.join(root,'monitor/exports',raw.bundle_id,'manifest.json');
  const manifest=readJson(file,2*1024*1024);
  if(manifest?.schema_version!==1||manifest.bundle_id!==raw.bundle_id||manifest.sealed!==true||fileDigest(file)!==raw.manifest_sha256)throw new Error('receipt_manifest_mismatch');
  const receipt={schema_version:1,status:'verified',bundle_id:raw.bundle_id,manifest_sha256:raw.manifest_sha256,verified_at:raw.verified_at,received_at:new Date().toISOString(),verification:'windows_client_sha256',audit_status:manifest.audit_status,capture_status:manifest.capture_status};
  writeJson(path.join(root,'monitor/backup.json'),receipt);return receipt;
}
async function cli(argv=process.argv.slice(2)){
  const command=argv.shift(),options={};for(let i=0;i<argv.length;i+=2){if(!['--root','--project-dir'].includes(argv[i])||!argv[i+1])throw new Error('invalid_arguments');if(argv[i]==='--project-dir')(options.projects||=[]).push(argv[i+1]);else options.root=argv[i+1];}
  const root=path.resolve(options.root||rootPath());
  if(command==='install'||command==='disable')return install(root,command==='disable');
  if(command==='configure'){if(!options.projects?.length)throw new Error('project_required');const project_dirs=options.projects.map(p=>{const real=fs.realpathSync(p);if(!fs.statSync(path.join(real,'.planning')).isDirectory())throw new Error('not_sgsd_project');return real;});const config={schema_version:1,project_dirs};writeJson(path.join(root,'monitor/config.json'),config);return config;}
  if(command==='tick')return tick(root);
  if(command==='daily')return daily(root);
  if(command==='snapshot')return readOptional(path.join(root,'monitor/latest.json'))||{schema_version:1,status:'WARN',findings:[{severity:'WARN',reason:'monitor_unavailable'}]};
  if(command==='receipt'){
    const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>16384)throw new Error('receipt_too_large');chunks.push(chunk);}
    const raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return acceptReceipt(root,raw);
  }
  throw new Error('unknown_monitor_schedule_command');
}
if(require.main===module)cli().then(result=>{process.stdout.write(JSON.stringify(result)+'\n');if(result.status==='failed')process.exitCode=1;}).catch(error=>{process.stderr.write(JSON.stringify({status:'failed',reason:error.message})+'\n');process.exitCode=1;});
module.exports={mergeCrontab,dailyDue,readDailyState,locked,install,tick,daily,acceptReceipt,cli};
