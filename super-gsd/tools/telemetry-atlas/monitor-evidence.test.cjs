'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { digest } = require('./contract.cjs');
const evidence = require('./monitor-evidence.cjs');

const WARN = Object.freeze({ schema_version: 1, generated_at: '2026-09-10T06:00:00.000Z', status: 'WARN',
  complete_coverage: false, projects: [], findings: [{ severity: 'WARN', reason: 'fixture' }] });
const hex = value => crypto.createHash('sha256').update(value).digest('hex');
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
function mkdir(directory) { fs.mkdirSync(directory, { recursive: true }); return directory; }
function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-evidence-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { base, root: mkdir(path.join(base, 'global')), clarity: path.join(base, 'clarity') };
}
function gitRoot(directory) { mkdir(path.join(directory, '.git')); return fs.realpathSync(directory); }
function gitWorktree(directory, commonRoot, name = 'linked') {
  const gitdir = mkdir(path.join(commonRoot, '.git', 'worktrees', name));
  fs.writeFileSync(path.join(gitdir, 'commondir'), '../..\n');
  mkdir(directory); fs.writeFileSync(path.join(directory, '.git'), `gitdir: ${gitdir}\n`);
  return fs.realpathSync(directory);
}
function register(root, projectDir, suffix = '1') {
  projectDir = fs.realpathSync(projectDir);
  const projectId = digest(projectDir), projectState = mkdir(path.join(root, 'projects', projectId));
  fs.writeFileSync(path.join(projectState, 'project.json'), JSON.stringify({ schema_version: 1, project_id: projectId,
    project_dir: projectDir, raw_prompt: 'must-not-export' }) + '\n');
  const runId = `sgsd-00000000-0000-4000-8000-${suffix.padStart(12, '0')}`;
  const runState = mkdir(path.join(root, 'runs', runId));
  fs.writeFileSync(path.join(runState, 'registration.json'), JSON.stringify({ schema_version: 1, project_id: projectId,
    project_dir: projectDir, run_id: runId, provider: 'openai', role: 'executor',
    registered_at: '2026-09-10T05:00:00.000Z', accountingSource: 'codex_rollout', state_dir: runState,
    metrics_dir: path.join(projectState, 'metrics'), auth_token: 'must-not-export' }) + '\n');
  return { projectId, projectState, runId };
}
function byRole(manifest, role, projectId) {
  return manifest.files.find(row => row.source_role === role && (projectId === undefined || row.project_id === projectId));
}
function payload(directory, row) { return fs.readFileSync(path.join(directory, row.name)); }

test('copies selected Clarity worktrees, complete-line prefixes and sanitized attribution without changing sources', async t => {
  const f = fixture(t), clarity = gitRoot(f.clarity), linked = gitWorktree(path.join(f.base, 'clarity-worktree'), clarity);
  const unrelated = gitRoot(path.join(f.base, 'other'));
  const main = register(f.root, clarity, '1'), worktree = register(f.root, linked, '2');
  const excluded = register(f.root, unrelated, '3');
  const metrics = mkdir(path.join(main.projectState, 'metrics'));
  const native = path.join(metrics, 'sgsd-atlas-events-reset-1.jsonl');
  fs.writeFileSync(native, '{"event":1}\n{"unfinished":true');
  fs.writeFileSync(path.join(metrics, 'sgsd-atlas-manifest.jsonl'), '{"action":"open"}\n');
  const operational = mkdir(path.join(worktree.projectState, 'operational'));
  fs.writeFileSync(path.join(operational, 'sgsd-ledger-receipts.jsonl'), '{"receipt":1}\n');
  fs.writeFileSync(path.join(operational, 'sgsd-atlas-events-reset-1.jsonl'), '{"operational":1}\n');
  mkdir(path.join(f.root, 'monitor'));
  fs.writeFileSync(path.join(f.root, 'monitor', 'incidents.jsonl'), '{"reason":"stale"}\npartial');
  const sourceBefore = fs.readFileSync(native);
  const result = await evidence.createBundle({ root: f.root, projectDirs: [clarity],
    now: Date.UTC(2026, 8, 10, 6), auditReport: WARN });
  assert.match(result.bundle_id, /^atlas-\d{8}T\d{6}Z-[a-f0-9]{8}$/);
  assert.equal(fs.readFileSync(native).equals(sourceBefore), true, 'export is read-only');
  assert.deepEqual(result.manifest.scope.included_projects.map(row => row.project_id).sort(),
    [main.projectId, worktree.projectId].sort());
  assert.ok(result.manifest.scope.excluded_projects.some(row => row.project_id === excluded.projectId));
  const nativeRow = byRole(result.manifest, 'native_event_ledger', main.projectId);
  assert.equal(payload(result.directory, nativeRow).toString(), '{"event":1}\n');
  assert.equal(nativeRow.source_length, sourceBefore.length);
  assert.equal(nativeRow.capture_status, 'incomplete_tail');
  assert.equal(result.manifest.capture_status, 'incomplete');
  const registrations = result.manifest.files.filter(row => row.source_role.endsWith('_registration'))
    .map(row => payload(result.directory, row).toString()).join('');
  assert.doesNotMatch(registrations, /must-not-export|auth_token|raw_prompt|state_dir|metrics_dir/);
  assert.ok(byRole(result.manifest, 'operational_receipts', worktree.projectId));
  assert.ok(byRole(result.manifest, 'monitor_incidents'));
  for (const row of result.manifest.files) assert.match(row.name, /^[a-f0-9]{64}\.(json|jsonl)$/);
  const verified = evidence.verifyBundle({ directory: result.directory });
  assert.equal(verified.verified, true);
  assert.equal(verified.audit_status, 'WARN');
  assert.equal(verified.capture_status, 'incomplete');
});

test('a concurrent append is allowed while the exact snapshot prefix is hashed', async t => {
  const f = fixture(t), clarity = gitRoot(f.clarity), selected = register(f.root, clarity);
  const metrics = mkdir(path.join(selected.projectState, 'metrics'));
  const source = path.join(metrics, 'sgsd-atlas-events-live.jsonl');
  const line = '{"padding":"' + 'x'.repeat(1010) + '"}\n';
  fs.writeFileSync(source, line.repeat(32768));
  const child = spawn(process.execPath, ['-e',
    "const fs=require('fs'),p=process.argv[1];let n=0;const t=setInterval(()=>{fs.appendFileSync(p,'{\\\"append\\\":'+n+'}\\n');if(++n===100)clearInterval(t)},1)", source],
    { stdio: 'ignore' });
  const exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  const result = await evidence.createBundle({ root: f.root, projectDirs: [clarity], now: Date.UTC(2026, 8, 10, 6, 1), auditReport: WARN });
  await exited;
  const row = byRole(result.manifest, 'native_event_ledger', selected.projectId);
  const copied = payload(result.directory, row), current = fs.readFileSync(source);
  assert.equal(copied.equals(current.subarray(0, row.source_length)), true);
  assert.equal(copied.length, row.source_length);
  assert.equal(row.capture_status, 'complete');
  assert.ok(current.length >= row.source_length);
  assert.equal(evidence.verifyBundle({ directory: result.directory }).verified, true);
});

test('unsafe source entries and hardlinks are excluded and make capture incomplete', async t => {
  const f = fixture(t), clarity = gitRoot(f.clarity), selected = register(f.root, clarity);
  const metrics = mkdir(path.join(selected.projectState, 'metrics'));
  fs.writeFileSync(path.join(metrics, 'sgsd-atlas-events-bad!.jsonl'), '{"unsafe":1}\n');
  const outside = path.join(f.base, 'hardlink-source'); fs.writeFileSync(outside, '{"linked":1}\n');
  fs.linkSync(outside, path.join(metrics, 'sgsd-atlas-events-linked.jsonl'));
  const result = await evidence.createBundle({ root: f.root, projectDirs: [clarity], now: Date.UTC(2026, 8, 10, 6, 2), auditReport: WARN });
  assert.equal(result.manifest.capture_status, 'incomplete');
  assert.equal(result.manifest.files.some(row => row.source_relative_path.includes('bad!')), false);
  assert.equal(result.manifest.files.some(row => row.source_relative_path.includes('linked')), false);
  assert.ok(result.manifest.findings.some(row => row.reason === 'unsafe_source_entry'));
});

test('sanitized registration may be longer than its tiny original source', async t => {
  const f = fixture(t), clarity = gitRoot(f.clarity), selected = register(f.root, clarity);
  const registration = path.join(selected.projectState, 'project.json');
  fs.writeFileSync(registration, JSON.stringify({ schema_version: 1, project_id: selected.projectId, project_dir: clarity }));
  const result = await evidence.createBundle({ root: f.root, projectDirs: [clarity],
    now: Date.UTC(2026, 8, 10, 6, 14), auditReport: WARN });
  const row = byRole(result.manifest, 'project_registration', selected.projectId);
  assert.equal(row.content, 'sanitized_projection');
  assert.ok(row.bytes > row.source_length);
  assert.equal(evidence.verifyBundle({ directory: result.directory }).verified, true);
});

test('verification rejects tamper, missing files, extras and traversal even with a recomputed manifest identity', async t => {
  const f = fixture(t), clarity = gitRoot(f.clarity);
  const first = await evidence.createBundle({ root: f.root, projectDirs: [clarity], now: Date.UTC(2026, 8, 10, 6, 3), auditReport: WARN });
  const copiedEvidence = path.join(first.directory, first.manifest.files[0].name);
  fs.appendFileSync(copiedEvidence, 'tamper');
  assert.throws(() => evidence.verifyBundle({ directory: first.directory }), /integrity/);
  const second = await evidence.createBundle({ root: f.root, projectDirs: [clarity], now: Date.UTC(2026, 8, 10, 6, 4), auditReport: WARN });
  fs.unlinkSync(path.join(second.directory, second.manifest.files[0].name));
  assert.throws(() => evidence.verifyBundle({ directory: second.directory }));
  const third = await evidence.createBundle({ root: f.root, projectDirs: [clarity], now: Date.UTC(2026, 8, 10, 6, 5), auditReport: WARN });
  fs.writeFileSync(path.join(third.directory, '0'.repeat(64) + '.json'), '{}\n');
  assert.throws(() => evidence.verifyBundle({ directory: third.directory }), /extra/);
  const fourth = await evidence.createBundle({ root: f.root, projectDirs: [clarity], now: Date.UTC(2026, 8, 10, 6, 6), auditReport: WARN });
  const manifestFile = path.join(fourth.directory, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  manifest.files[0].name = '../escape.json';
  const { manifest_identity: _, ...body } = manifest;
  manifest.manifest_identity = hex(JSON.stringify(stable(body)));
  fs.writeFileSync(manifestFile, JSON.stringify(manifest) + '\n');
  assert.throws(() => evidence.verifyBundle({ directory: fourth.directory }), /manifest_file/);
  const fifth = await evidence.createBundle({ root: f.root, projectDirs: [clarity], now: Date.UTC(2026, 8, 10, 6, 10), auditReport: WARN });
  const fifthFile = path.join(fifth.directory, 'manifest.json');
  const forged = JSON.parse(fs.readFileSync(fifthFile, 'utf8'));
  forged.audit_status = 'PASS';
  const { manifest_identity: ignored, ...forgedBody } = forged;
  forged.manifest_identity = hex(JSON.stringify(stable(forgedBody)));
  fs.writeFileSync(fifthFile, JSON.stringify(forged) + '\n');
  assert.throws(() => evidence.verifyBundle({ directory: fifth.directory }), /audit_status/);
  const sixth = await evidence.createBundle({ root: f.root, projectDirs: [clarity], now: Date.UTC(2026, 8, 10, 6, 11), auditReport: WARN });
  const sixthFile = path.join(sixth.directory, 'manifest.json');
  const renamed = JSON.parse(fs.readFileSync(sixthFile, 'utf8'));
  const auditRow = renamed.files.find(row => row.source_role === 'monitor_audit');
  const prior = path.join(sixth.directory, auditRow.name);
  auditRow.name = 'f'.repeat(64) + '.json';
  fs.renameSync(prior, path.join(sixth.directory, auditRow.name));
  const { manifest_identity: ignoredAgain, ...renamedBody } = renamed;
  renamed.manifest_identity = hex(JSON.stringify(stable(renamedBody)));
  fs.writeFileSync(sixthFile, JSON.stringify(renamed) + '\n');
  assert.throws(() => evidence.verifyBundle({ directory: sixth.directory }), /manifest_file/);
  const seventh = await evidence.createBundle({ root: f.root, projectDirs: [clarity], now: Date.UTC(2026, 8, 10, 6, 12), auditReport: WARN });
  const staging = path.join(f.base, `.partial-${seventh.bundle_id}-${crypto.randomUUID()}`);
  fs.cpSync(seventh.directory, staging, { recursive: true });
  assert.equal(evidence.verifyBundle({ directory: staging }).bundle_id, seventh.bundle_id,
    'verification supports a bounded client staging directory before atomic publish');
});

test('capacity refusal preserves an existing good immutable bundle', async t => {
  const f = fixture(t), clarity = gitRoot(f.clarity);
  const good = await evidence.createBundle({ root: f.root, projectDirs: [clarity], now: Date.UTC(2026, 8, 10, 6, 7), auditReport: WARN });
  const goodManifest = fs.readFileSync(path.join(good.directory, 'manifest.json'));
  const capacity = mkdir(path.join(f.root, 'monitor', 'exports', 'capacity-fixture'));
  fs.closeSync(fs.openSync(path.join(capacity, 'sparse'), 'w'));
  fs.truncateSync(path.join(capacity, 'sparse'), 10 * 1024 * 1024 * 1024);
  await assert.rejects(evidence.createBundle({ root: f.root, projectDirs: [clarity],
    now: Date.UTC(2026, 8, 10, 6, 8), auditReport: WARN }), /export_capacity/);
  assert.equal(fs.readFileSync(path.join(good.directory, 'manifest.json')).equals(goodManifest), true);
  assert.equal(evidence.verifyBundle({ directory: good.directory }).verified, true);
});

test('oversized supplied audit cannot leave a sealed unverifiable bundle', async t => {
  const f = fixture(t), clarity = gitRoot(f.clarity);
  const oversized = { ...WARN, note: 'x'.repeat(16 * 1024 * 1024 + 1) };
  await assert.rejects(evidence.createBundle({ root: f.root, projectDirs: [clarity],
    now: Date.UTC(2026, 8, 10, 6, 13), auditReport: oversized }), /audit_report_limit/);
  const exports = path.join(f.root, 'monitor', 'exports');
  assert.equal(fs.existsSync(exports) ? fs.readdirSync(exports).some(name => /^atlas-/.test(name)) : false, false);
});

test('catalogue uses config selection and returns bounded manifest transfer metadata', async t => {
  const f = fixture(t), clarity = gitRoot(f.clarity); register(f.root, clarity);
  const monitor = mkdir(path.join(f.root, 'monitor'));
  fs.writeFileSync(path.join(monitor, 'config.json'), JSON.stringify({ schema_version: 1, project_dirs: [clarity] }) + '\n');
  const families = Array.from({ length: 33 }, () => ({ family: 'muda',
    state: 'observed', observations: 2, time: { latest_observed_at: '2026-09-09T03:00:00.000Z' } }));
  const richAudit = { ...WARN, note: 'full-audit-only-' + 'x'.repeat(300000), projects: [{ project_id: 'a'.repeat(64), rows: 7 }],
    operations: { status: 'WARN', projects: [{ project_id: 'a'.repeat(64), families }] } };
  const result = await evidence.createBundle({ root: f.root, now: Date.UTC(2026, 8, 10, 6, 9), auditReport: richAudit });
  const auditState = JSON.parse(fs.readFileSync(path.join(monitor, 'audit.json'), 'utf8'));
  assert.equal(auditState.status, 'WARN');
  assert.equal(auditState.projection, 'compact');
  assert.equal(auditState.truncated, true);
  assert.equal(auditState.complete_coverage, false);
  assert.equal(auditState.finding_count, 1);
  assert.equal(auditState.project_count, 1);
  assert.equal(auditState.note, undefined);
  assert.equal(auditState.operations.projects[0].families[0].last_observed_at, '2026-09-09T03:00:00.000Z');
  assert.equal(auditState.operations.projects[0].families[0].latest_outcome, null);
  assert.ok(fs.statSync(path.join(monitor, 'audit.json')).size <= 256 * 1024);
  const bundledAudit = JSON.parse(payload(result.directory, byRole(result.manifest, 'monitor_audit')).toString());
  assert.equal(bundledAudit.note.startsWith('full-audit-only-'), true, 'bundle retains the full report');
  assert.equal(result.manifest.scope.included_projects.length, 1);
  const catalogue = evidence.catalogue({ root: f.root });
  assert.equal(catalogue.bundles.length, 1);
  assert.equal(catalogue.bundles[0].bundle_id, result.bundle_id);
  assert.equal(catalogue.bundles[0].remote_directory, `${path.resolve(f.root)}/monitor/exports/${result.bundle_id}`);
  assert.match(catalogue.bundles[0].manifest.sha256, /^[a-f0-9]{64}$/);
  assert.equal(catalogue.bundles[0].files.length, result.manifest.files.length);
});
