'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const modulePath = path.join(__dirname, 'atlas-panel.cjs');
const api = fs.existsSync(modulePath) ? require(modulePath) : {};
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-panel-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'monitor'));
  return root;
}
test('missing monitor cannot produce a successful empty panel', t => {
  assert.equal(typeof api.readAtlasSnapshot, 'function');
  const s = api.readAtlasSnapshot({ root: fixture(t), now: Date.now() });
  assert.equal(s.complete_coverage, false);
  assert.equal(s.status, 'WARN');
  assert.ok(s.findings.some(f => f.reason === 'monitor_unavailable'));
});
test('fresh snapshot preserves WARN and stale snapshot explicitly warns', t => {
  const root = fixture(t), now = Date.now();
  fs.writeFileSync(path.join(root, 'monitor/latest.json'), JSON.stringify({schema_version:1,
    generated_at:new Date(now).toISOString(),status:'WARN',complete_coverage:false,projects:[],findings:[]}));
  assert.equal(api.readAtlasSnapshot({root,now}).status,'WARN');
  assert.equal(api.readAtlasSnapshot({root,now:now+181000}).monitor_status,'stale');
});
test('malformed oversized or linked snapshots are never trusted', t => {
  const root = fixture(t), file = path.join(root,'monitor/latest.json');
  fs.writeFileSync(file,'{}');
  assert.equal(api.readAtlasSnapshot({root}).monitor_status,'unavailable');
  fs.writeFileSync(file,'x'.repeat(2*1024*1024+1));
  assert.equal(api.readAtlasSnapshot({root}).monitor_status,'unavailable');
  fs.unlinkSync(file);
  const target=path.join(root,'outside.json'); fs.writeFileSync(target,'{}');
  try {fs.symlinkSync(target,file);} catch(e) {if(e.code==='EPERM') return; throw e;}
  assert.equal(api.readAtlasSnapshot({root}).monitor_status,'unavailable');
});
test('renderer escapes source text and separates transfer verdict from capture', () => {
  const s={schema_version:1,generated_at:new Date().toISOString(),status:'WARN',service:{healthy:true},
    complete_coverage:false,projects:[{project_dir:'<img src=x onerror=alert(1)>',classification:'configured',
      native:{status:'unavailable',summary:{availability:'unavailable'}},operational:{status:'unavailable',families:{}},runs:[],capacity:{}}],
    unmatched_sessions:[{pid:12,cwd:'<script>bad</script>',reason:'unregistered_process'}],findings:[],
    audit:{status:'WARN'},backup:{status:'verified',verified_at:new Date().toISOString()}};
  const html=api.renderAtlasPanel(s);
  assert.ok(html.includes('&lt;img')); assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script>bad'));
  assert.ok(html.includes('Observed usage is not a complete bill'));
  assert.ok(html.includes('verified')); assert.ok(html.includes('WARN'));
  assert.ok(html.includes('unobserved')); assert.ok(!html.includes('0 tokens'));
});
test('malformed nested snapshots fail visibly without throwing from the renderer',t=>{
  const root=fixture(t),file=path.join(root,'monitor/latest.json');
  for(const malformed of [{projects:[null]},{findings:[null]},{projects:[{operational:{families:{muda:null}}}]},{projects:[{capacity:{native:null}}]},{unmatched_sessions:[null]}]){
    const body={schema_version:1,status:'PASS',generated_at:new Date().toISOString(),projects:[],findings:[],...malformed};
    fs.writeFileSync(file,JSON.stringify(body));const value=api.readAtlasSnapshot({root});
    assert.equal(value.monitor_status,'unavailable');assert.doesNotThrow(()=>api.renderAtlasPanel(value));
    assert.doesNotThrow(()=>api.renderAtlasPanel(body));
  }
});
test('real cockpit endpoint returns uncached explicit unknown and fresh WARN snapshots',async t=>{
  const root=fixture(t),workspace=path.join(root,'workspace');fs.mkdirSync(path.join(workspace,'.planning'),{recursive:true});
  const previous=process.env.SGSD_ATLAS_GLOBAL_ROOT;process.env.SGSD_ATLAS_GLOBAL_ROOT=root;
  t.after(()=>{if(previous===undefined)delete process.env.SGSD_ATLAS_GLOBAL_ROOT;else process.env.SGSD_ATLAS_GLOBAL_ROOT=previous;});
  const controller=await require('./serve.cjs').start({port:0,workspace});t.after(()=>controller.close());
  const res=await fetch('http://127.0.0.1:'+controller.port+'/atlas');assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');
  assert.equal((await res.json()).snapshot.monitor_status,'unavailable');
  fs.writeFileSync(path.join(root,'monitor/latest.json'),JSON.stringify({schema_version:1,generated_at:new Date().toISOString(),status:'WARN',projects:[],findings:[]}));
  const fresh=await (await fetch('http://127.0.0.1:'+controller.port+'/atlas')).json();assert.equal(fresh.snapshot.monitor_status,'fresh');assert.match(fresh.html,/collection health/);
});
