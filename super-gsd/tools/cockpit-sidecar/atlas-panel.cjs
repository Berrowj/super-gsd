'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { rootPath } = require('../telemetry-atlas/global.cjs');
const { safePath } = require('../telemetry-atlas/contract.cjs');
const MAX_BYTES = 2 * 1024 * 1024;
const STALE_MS = 180000;
const arr = value => Array.isArray(value) ? value : [];
const obj=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const objects=value=>Array.isArray(value)&&value.every(obj);
const optionalObject=value=>value===undefined||value===null||obj(value);
function nestedShape(s){
  return obj(s)&&objects(s.projects)&&objects(s.findings)
    &&s.findings.every(f=>f.project_id==null||typeof f.project_id==='string')
    &&(s.unmatched_sessions===undefined||objects(s.unmatched_sessions))
    &&[s.service,s.audit,s.backup].every(optionalObject)
    &&s.projects.every(p=>[p.native,p.operational,p.capacity].every(optionalObject)
      &&optionalObject(p.native?.summary)&&optionalObject(p.native?.summary?.interval)
      &&(p.runs===undefined||objects(p.runs))
      &&(p.capacity==null||Object.values(p.capacity).every(obj))
      &&(p.operational?.families===undefined||obj(p.operational.families)&&Object.values(p.operational.families).every(obj)));
}
const esc = value => String(value ?? 'unknown').replace(/[&<>"']/g,
  ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const date = value => Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : 'unobserved';
const count = value => Number.isFinite(value) ? value.toLocaleString('en-GB') : 'unknown';
function readAtlasSnapshot({ root = rootPath(), now = Date.now() } = {}) {
  const unavailable = { schema_version:1, generated_at:null, checked_at:new Date(now).toISOString(),
    status:'WARN', monitor_status:'unavailable', complete_coverage:false, projects:[],
    unmatched_sessions:[], findings:[{severity:'WARN',reason:'monitor_unavailable'}] };
  try {
    const file = path.join(root, 'monitor', 'latest.json'); safePath(file);
    const st=fs.lstatSync(file);
    if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 || st.size>MAX_BYTES
      || (process.getuid && st.uid!==process.getuid())) return unavailable;
    const fd=fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    let body;
    try {
      const opened=fs.fstatSync(fd); if(opened.ino!==st.ino || opened.dev!==st.dev || opened.size!==st.size) return unavailable;
      const data=Buffer.alloc(st.size); let offset=0;
      while(offset<data.length) {const n=fs.readSync(fd,data,offset,data.length-offset,offset); if(!n) break; offset+=n;}
      if(offset!==data.length || fs.fstatSync(fd).mtimeMs!==opened.mtimeMs) return unavailable;
      body=JSON.parse(data.toString('utf8'));
    } finally {fs.closeSync(fd);}
    if(body?.schema_version!==1 || !['PASS','WARN','FAIL'].includes(body.status)
      || !nestedShape(body)
      || !Number.isFinite(Date.parse(body.generated_at))) return unavailable;
    const age=now-Date.parse(body.generated_at), stale=age>STALE_MS || age < -60000;
    return {...body,complete_coverage:false,monitor_status:stale?'stale':'fresh',
      checked_at:new Date(now).toISOString(),age_ms:Math.max(0,age),
      status:stale && body.status!=='FAIL'?'WARN':body.status,
      findings:stale?[...body.findings,{severity:'WARN',reason:'monitor_snapshot_stale'}]:body.findings};
  } catch {return unavailable;}
}
function renderAtlasPanel(s = {}) {
  if(!nestedShape(s))s={status:'WARN',monitor_status:'unavailable',projects:[],findings:[{severity:'WARN',reason:'monitor_snapshot_invalid'}]};
  const pill=value=>'<span class="atlas-pill">'+esc(value)+'</span>';
  const cell=(title,value,detail='')=>'<div class="atlas-stat"><b>'+esc(title)+'</b><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></div>';
  const findingRows=arr(s.findings).slice(0,100).map(f=>'<li>'+pill(f.severity)+' '+esc(f.reason)+(f.project_id?' · '+esc(f.project_id.slice(0,12)):'')+'</li>').join('');
  const projects=arr(s.projects).slice(0,100).map(p=>{
    const n=p.native||{}, o=p.operational||{}, u=n.summary||{};
    const summary=u.availability==='observed'?'Input '+count(u.input_tokens)+' · output '+count(u.output_tokens)
      +' · provider total '+count(u.total_provider_tokens)+' (observed, cached/reasoning subsets not added)':'Token summary unavailable';
    const families=Object.entries(o.families||{}).slice(0,30).map(([name,f])=>esc(name)+': '+esc(f.status||'unobserved')
      +' · verdict '+esc(f.verdict||'unobserved')+' · occurred '+esc(date(f.last_occurred_at))
      +' · received '+esc(date(f.last_received_at))+' · observations '+esc(count(f.observations))).join('<br>')||'MUDA / ATC / gates: unobserved';
    const capacity=Object.entries(p.capacity||{}).map(([name,c])=>esc(name)+' '+esc(count(c.used_bytes))+' / '+esc(count(c.limit_bytes))+' bytes'+(Number.isFinite(c.percent)?' ('+esc(c.percent.toFixed(1))+'%)':'')).join('<br>');
    const runs=arr(p.runs).slice(0,200).map(r=>'<tr><td>'+esc(r.run_id)+'</td><td>'+esc(r.provider)+' / '+esc(r.role)+'</td><td>'+pill(r.native_status||'unknown')+'</td><td>'+esc(date(r.last_received_at))+'</td></tr>').join('');
    return '<details class="atlas-project"'+(['configured','worktree'].includes(p.classification)?' open':'')+'><summary>'+esc(p.project_dir)+' '+pill(p.classification)+'</summary>'
      +'<div class="atlas-grid">'+cell('Native delivery',n.status||'unobserved','Received '+date(n.last_received_at))
      +cell('Original event time',date(n.last_occurred_at),'Backfill is not new work')
      +cell('Operational capture',o.status||'unobserved','Received '+date(o.last_received_at))
      +cell('Pending bytes',count(o.pending_bytes),'Recorded gaps '+count(o.gaps))+'</div>'
      +'<p>'+esc(summary)+'</p><p class="atlas-muted">Scope '+esc(u.scope||'unavailable')+' (not weekly total); summary generated '+esc(date(u.generated_at))+'; interval '+esc(date(u.interval?.start_at))+' to '+esc(date(u.interval?.end_at))+'</p>'
      +'<div class="atlas-grid"><div><b>Operational families / original times</b><p>'+families+'</p></div><div><b>Configured capture capacities</b><p>'+capacity+'</p></div></div>'
      +(runs?'<div class="atlas-scroll"><table><thead><tr><th>Run</th><th>Provider / role</th><th>Native coverage</th><th>Last received</th></tr></thead><tbody>'+runs+'</tbody></table></div>':'<p>No matched runs observed.</p>')+'</details>';
  }).join('');
  const unmatched=arr(s.unmatched_sessions).slice(0,200).map(r=>'<li>PID '+esc(r.pid)+' · '+esc(r.cwd)+' · '+esc(r.reason||'unmatched')+'</li>').join('');
  return '<div class="atlas-panel" data-atlas-status="'+esc(s.status||'WARN')+'">'
    +'<style>.atlas-panel{margin-top:24px;border:1px solid #a1adb8;border-left:5px solid #b57c29;border-radius:8px;padding:20px;color:inherit;overflow-wrap:anywhere}.atlas-panel h3{margin:0 0 10px}.atlas-panel p{margin:10px 0}.atlas-panel [data-notice]{font-weight:700;color:#bc7928}.atlas-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,215px),1fr));gap:16px;margin:16px 0}.atlas-stat b,.atlas-stat small,.atlas-stat strong{display:block}.atlas-stat b{font-size:12px;text-transform:uppercase;opacity:.75}.atlas-stat strong{margin:6px 0;font-size:17px}.atlas-muted,.atlas-stat small{opacity:.8;font-size:12px}.atlas-pill{display:inline-block;border:1px solid currentColor;border-radius:12px;padding:2px 7px;font-size:11px}.atlas-project{border-top:1px solid #94a3b866;padding:14px 0}.atlas-project summary{cursor:pointer;font-weight:700}.atlas-scroll{overflow:auto}.atlas-panel table{width:100%;border-collapse:collapse;font-size:12px}.atlas-panel th,.atlas-panel td{text-align:left;padding:8px;border-bottom:1px solid #94a3b844}.atlas-panel ul{padding-left:20px}.atlas-panel li{margin:5px 0}</style>'
    +'<h3>Atlas · collection health '+pill(s.status||'WARN')+'</h3><p data-notice>Coverage is partial. Observed usage is not a complete bill.</p>'
    +'<p class="atlas-muted">Monitor '+esc(s.monitor_status||'unknown')+' · snapshot '+esc(date(s.generated_at))+' · no automatic session repair</p>'
    +'<div class="atlas-grid">'+cell('Receiver',s.service?.healthy?'Running':'Unavailable / unknown','Health is not proof of delivery')
    +cell('Integrity audit',s.audit?.status||'unobserved',date(s.audit?.generated_at))
    +cell('Local copy',s.backup?.status||'unobserved',date(s.backup?.verified_at||s.backup?.last_verified_at))
    +cell('Session coverage','Partial / unknown','Unmatched processes: '+arr(s.unmatched_sessions).length)+'</div>'
    +'<p class="atlas-muted">A verified copy can contain an audit WARN or FAIL. Transfer integrity and capture integrity are separate.</p>'
    +(findingRows?'<details open><summary>Current collection findings</summary><ul>'+findingRows+'</ul></details>':'<p>No current findings reported; complete fleet coverage is not established.</p>')
    +(projects||'<p>No monitored projects available.</p>')
    +'<p class="atlas-muted">Display bounds: first 100 projects/findings, 30 families per project and 200 runs/unmatched rows. The private snapshot retains the bounded monitor inventory.</p>'
    +(unmatched?'<details open><summary>Unmatched sessions · attachment unproven</summary><ul>'+unmatched+'</ul></details>':'')+'</div>';
}
module.exports={readAtlasSnapshot,renderAtlasPanel};
