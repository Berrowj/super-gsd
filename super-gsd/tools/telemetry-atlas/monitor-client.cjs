#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),net=require('node:net');
const {spawnSync,spawn}=require('node:child_process');
const {readJson,writeJson}=require('./global-store.cjs');
const {safePath,fileDigest}=require('./contract.cjs');
const {privateDirectory}=require('./quota-sampler.cjs');
const ID=/^atlas-\d{8}T\d{6}Z-[a-f0-9]{8}$/;
const FILE=/^[a-f0-9]{64}\.(json|jsonl)$/;
const HEX=/^[a-f0-9]{64}$/;
const MAX_LOCAL=20*1024**3;
const DEFAULTS={schema_version:1,host:'devcp',remote_root:'/home/jackberrow/.local/state/sgsd/telemetry/global',remote_node:'/home/jackberrow/.nvm/versions/node/v24.15.0/bin/node',remote_tools:'/home/jackberrow/.claude/tools/telemetry-atlas',remote_cockpit_port:7777,local_port:17777};
const clientRoot=()=>path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'SGSD','Atlas','devcp');
function optional(file,max=2*1024*1024){try{return readJson(file,max);}catch{return null;}}
function config(root){const file=path.join(root,'config.json');if(!fs.existsSync(file))return {...DEFAULTS};let value;try{value=readJson(file,65536);}catch{throw new Error('client_config_unreadable');}if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('client_config_invalid');return {...DEFAULTS,...value};}
function remoteCommand(c,command){
  if(!['snapshot','catalogue','receipt'].includes(command))throw new Error('invalid_remote_command');
  for(const p of [c.remote_node,c.remote_tools,c.remote_root])if(typeof p!=='string'||!/^\/[a-zA-Z0-9_./-]+$/.test(p)||p.split('/').includes('..'))throw new Error('unsafe_remote_config');
  const script=command==='catalogue'?'monitor-evidence.cjs':'monitor-schedule.cjs';
  return c.remote_node+' '+c.remote_tools+'/'+script+' '+command+' --root '+c.remote_root;
}
function transportFor(c){
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$/.test(c.host))throw new Error('unsafe_ssh_alias');
  const ssh=process.platform==='win32'?'ssh.exe':'ssh',scp=process.platform==='win32'?'scp.exe':'scp';
  return {json(command,input){const r=spawnSync(ssh,['-o','BatchMode=yes','-o','ConnectTimeout=10',c.host,remoteCommand(c,command)],{input:input?JSON.stringify(input):undefined,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024,windowsHide:true});if(r.error||r.status!==0)throw new Error('ssh_'+command+'_failed');try{return JSON.parse(r.stdout);}catch{throw new Error('remote_invalid_json');}},
    copy(directory,names,destination){
      if(!directory.startsWith(c.remote_root+'/monitor/exports/')||!ID.test(directory.split('/').pop())||directory!==c.remote_root+'/monitor/exports/'+directory.split('/').pop())throw new Error('unsafe_remote_directory');
      if(names.some(n=>n!=='manifest.json'&&!FILE.test(n)))throw new Error('unsafe_remote_file');
      const args=['-B','-q','-o','ConnectTimeout=10',...names.map(n=>c.host+':'+directory+'/'+n),'.'];
      const r=spawnSync(scp,args,{cwd:destination,encoding:'utf8',timeout:120000,maxBuffer:65536,windowsHide:true});if(r.error||r.status!==0)throw new Error('scp_transfer_failed');
    }};
}
function validateCatalogue(value,remoteRoot){
  if(!value||!Array.isArray(value.bundles)||value.bundles.length>128)throw new Error('invalid_catalogue');
  const ids=new Set();
  for(const b of value.bundles){
    if(!ID.test(b.bundle_id)||ids.has(b.bundle_id)||b.remote_directory!==remoteRoot+'/monitor/exports/'+b.bundle_id||!Array.isArray(b.files)||b.files.length>4096)throw new Error('unsafe_catalogue_bundle');ids.add(b.bundle_id);
    if(b.manifest?.name!=='manifest.json'||!HEX.test(b.manifest.sha256)||!Number.isSafeInteger(b.manifest.bytes)||b.manifest.bytes<2||b.manifest.bytes>2*1024*1024)throw new Error('invalid_catalogue_manifest');
    const names=new Set();let bytes=b.manifest.bytes;
    for(const f of b.files){if(!FILE.test(f.name)||names.has(f.name)||!HEX.test(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<0||f.bytes>1024**3)throw new Error('unsafe_catalogue_file');names.add(f.name);bytes+=f.bytes;}
    if(bytes>MAX_LOCAL)throw new Error('bundle_capacity_exceeded');
    b.validated_bytes=bytes;
  }
  return value.bundles.slice().sort((a,b)=>a.bundle_id.localeCompare(b.bundle_id));
}
function localStatus(root=clientRoot()){
  let saved=optional(path.join(root,'status.json'))||{schema_version:1,status:'unobserved',last_verified_at:null};
  if(saved.schema_version!==1||!['unobserved','verified','failed','awaiting_baseline','already_running'].includes(saved.status))saved={schema_version:1,status:'failed',reason:'local_status_invalid',last_verified_at:null};
  if(saved.last_verified_at){
    const receipt=ID.test(saved.bundle_id||'')?optional(path.join(root,'receipts',saved.bundle_id+'.json'),16384):null;
    let bound=false;try{const file=path.join(root,'snapshots',saved.bundle_id,'manifest.json');safePath(file);bound=fs.statSync(file).size<=2*1024*1024&&fileDigest(file)===saved.manifest_sha256;}catch{}
    if(!Number.isFinite(Date.parse(saved.last_verified_at))||Date.parse(saved.last_verified_at)>Date.now()+60000||receipt?.schema_version!==1||receipt.status!=='verified'||receipt.bundle_id!==saved.bundle_id||receipt.verified_at!==saved.last_verified_at||receipt.manifest_sha256!==saved.manifest_sha256||!HEX.test(saved.manifest_sha256||'')||!bound)saved={...saved,status:'failed',reason:'local_verification_unproven',last_verified_at:null};
  }else if(saved.status==='verified')saved={...saved,status:'failed',reason:'local_verification_unproven',last_verified_at:null};
  return {...saved,copy_overdue:!saved.last_verified_at||Date.now()-Date.parse(saved.last_verified_at)>30*3600000,
    contact_stale:!saved.last_contact_at||Date.now()-Date.parse(saved.last_contact_at)>10*60000};
}
function directoryBytes(root){
  let total=0,count=0;const queue=[root];
  while(queue.length){const dir=queue.pop();safePath(path.join(dir,'.check'));for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(++count>50000)throw new Error('local_inventory_limit');const p=path.join(dir,e.name),s=fs.lstatSync(p);if(s.isSymbolicLink())throw new Error('unsafe_local_symlink');if(s.isDirectory())queue.push(p);else {safePath(p);total+=s.size;if(total>MAX_LOCAL)throw new Error('local_capacity_exceeded');}}}
  return total;
}
async function pull({root=clientRoot(),transport,budgetMs=10*60000}={}){
  root=path.resolve(root);privateDirectory(root);const old=localStatus(root),lock=path.join(root,'pull.lock');safePath(lock);
  if(fs.existsSync(lock)){const held=optional(lock);if(!Number.isSafeInteger(held?.pid)||held.pid<=0)throw new Error('client_lock_unverified');let alive=true;try{process.kill(held.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}if(alive)return {...old,status:'already_running'};const failed={...old,status:'failed',reason:'stale_client_lock_requires_review',failed_at:new Date().toISOString()};writeJson(path.join(root,'status.json'),failed);return failed;}
  const token=crypto.randomUUID();const fd=fs.openSync(lock,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({pid:process.pid,token}));fs.closeSync(fd);
  let latest={...old,schema_version:1,attempted_at:new Date().toISOString()};
  const deadline=Date.now()+Math.min(Math.max(budgetMs,0),10*60000);
  const withinBudget=()=>{if(Date.now()>=deadline)throw new Error('pull_time_budget_exceeded');};
  try{
    const c=config(root),tx=transport||transportFor(c);withinBudget();
    const health=tx.json('snapshot');withinBudget();if(health?.schema_version!==1||!['PASS','WARN','FAIL'].includes(health.status))throw new Error('invalid_remote_health');
    writeJson(path.join(root,'health.json'),health);latest.last_contact_at=new Date().toISOString();
    const bundles=validateCatalogue(tx.json('catalogue'),c.remote_root);withinBudget();
    let used=directoryBytes(root),copied=0;
    const snapshots=path.join(root,'snapshots'),receipts=path.join(root,'receipts');privateDirectory(snapshots);privateDirectory(receipts);
    for(const b of bundles){
      withinBudget();
      const finalDir=path.join(snapshots,b.bundle_id),receiptFile=path.join(receipts,b.bundle_id+'.json');
      let receipt=optional(receiptFile);
      if(receipt?.status==='verified'&&receipt.manifest_sha256===b.manifest.sha256&&fs.existsSync(finalDir)){
        latest={...latest,bundle_id:b.bundle_id,last_verified_at:receipt.verified_at,manifest_sha256:receipt.manifest_sha256};continue;
      }
      if(used+b.validated_bytes>MAX_LOCAL)throw new Error('local_capacity_exceeded');
      if(fs.existsSync(finalDir))throw new Error('existing_copy_unverified');
      const staging=path.join(root,'.partial-'+b.bundle_id+'-'+crypto.randomUUID());privateDirectory(staging);
      tx.copy(b.remote_directory,['manifest.json'],staging);withinBudget();
      const manifestFile=path.join(staging,'manifest.json');safePath(manifestFile);
      if(fs.statSync(manifestFile).size!==b.manifest.bytes||fileDigest(manifestFile)!==b.manifest.sha256)throw new Error('manifest_hash_mismatch');
      for(let index=0;index<b.files.length;index+=16){withinBudget();tx.copy(b.remote_directory,b.files.slice(index,index+16).map(f=>f.name),staging);withinBudget();}
      const checked=require('./monitor-evidence.cjs').verifyBundle({directory:staging});
      withinBudget();
      if(!checked.verified||checked.bundle_id!==b.bundle_id)throw new Error('bundle_verification_failed');
      fs.renameSync(staging,finalDir);
      receipt={schema_version:1,status:'verified',bundle_id:b.bundle_id,verified_at:new Date().toISOString(),manifest_sha256:b.manifest.sha256,audit_status:checked.audit_status,capture_status:checked.capture_status};
      writeJson(receiptFile,receipt);used+=b.validated_bytes;copied++;
      latest={...latest,bundle_id:b.bundle_id,last_verified_at:receipt.verified_at,manifest_sha256:b.manifest.sha256,audit_status:checked.audit_status,capture_status:checked.capture_status};
    }
    withinBudget();latest={...latest,status:latest.last_verified_at?'verified':'awaiting_baseline',reason:null,copied_bundles:copied,local_bytes:used,capacity_warning:used>=MAX_LOCAL*.8,health_status:health.status};
    writeJson(path.join(root,'status.json'),latest);
    if(latest.last_verified_at){withinBudget();tx.json('receipt',{status:'verified',bundle_id:latest.bundle_id,manifest_sha256:latest.manifest_sha256,verified_at:latest.last_verified_at});withinBudget();}
    return localStatus(root);
  }catch(error){latest={...latest,status:'failed',reason:error.message,failed_at:new Date().toISOString()};writeJson(path.join(root,'status.json'),latest);return localStatus(root);}
  finally {if(optional(lock)?.token===token)fs.unlinkSync(lock);}
}
async function openCockpit(root=clientRoot()){
  privateDirectory(root);const c=config(root);remoteCommand(c,'snapshot');
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$/.test(c.host)||![c.local_port,c.remote_cockpit_port].every(p=>Number.isInteger(p)&&p>1024&&p<65536))throw new Error('invalid_tunnel_config');
  const url=`http://127.0.0.1:${c.local_port}/`;
  const probe=async()=>{try{const r=await fetch(url+'atlas',{signal:AbortSignal.timeout(1000)});const v=await r.json();return r.ok&&v.snapshot?.schema_version===1&&typeof v.html==='string';}catch{return false;}};
  const prior=optional(path.join(root,'tunnel.json'));let alive=false;
  if(Number.isSafeInteger(prior?.pid)&&prior.url===url&&prior.host===c.host&&prior.remote_port===c.remote_cockpit_port){try{process.kill(prior.pid,0);alive=true;}catch{}}
  // Reuse only a recorded, still-live tunnel with a revalidated Atlas endpoint.
  // Never stop or replace an occupied listener, even if an old PID was recycled.
  if(alive&&await probe())return {...prior,reused:true,checked_at:new Date().toISOString()};
  await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',()=>reject(new Error('local_port_already_in_use')));server.listen(c.local_port,'127.0.0.1',()=>server.close(resolve));});
  const child=spawn(process.platform==='win32'?'ssh.exe':'ssh',['-N','-o','BatchMode=yes','-o','ConnectTimeout=10','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=30','-o','ServerAliveCountMax=3','-L',`127.0.0.1:${c.local_port}:127.0.0.1:${c.remote_cockpit_port}`,c.host],{stdio:'ignore',windowsHide:true,detached:true});
  await new Promise((resolve,reject)=>{child.once('error',reject);child.once('spawn',resolve);});child.unref();
  let verified=false;
  for(let i=0;i<15;i++){if(await probe()){verified=true;break;}await new Promise(r=>setTimeout(r,300));}
  if(!verified){try{child.kill();}catch{}throw new Error('cockpit_tunnel_unverified');}
  const result={schema_version:1,url,pid:child.pid,host:c.host,remote_port:c.remote_cockpit_port,opened_at:new Date().toISOString()};writeJson(path.join(root,'tunnel.json'),result);return result;
}
async function cli(argv=process.argv.slice(2)){
  const command=argv.shift();let root=clientRoot();if(argv.length){if(argv.length!==2||argv[0]!=='--root')throw new Error('invalid_client_arguments');root=path.resolve(argv[1]);}
  if(command==='pull')return pull({root});if(command==='status')return localStatus(root);
  if(command==='open')return openCockpit(root);
  if(command==='configure'){privateDirectory(root);const file=path.join(root,'config.json');if(fs.existsSync(file))return config(root);writeJson(file,DEFAULTS);return DEFAULTS;}
  throw new Error('unknown_client_command');
}
if(require.main===module)cli().then(result=>{process.stdout.write(JSON.stringify(result)+'\n');if(result.status==='failed')process.exitCode=1;}).catch(error=>{process.stdout.write(JSON.stringify({schema_version:1,status:'failed',reason:error.message,last_verified_at:null,copy_overdue:true})+'\n');process.exitCode=1;});
module.exports={clientRoot,remoteCommand,validateCatalogue,localStatus,pull,openCockpit,cli};
