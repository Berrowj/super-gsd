'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { digest } = require('../../tools/telemetry-atlas/contract.cjs');
const { collectAtlasBootBriefing, formatAtlasBriefing } = require('./atlas-boot-briefing.cjs');

const RUN_ID = 'sgsd-11111111-2222-4333-8444-555555555555';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value));
}

function fixture(t, { receiver = true, snapshotAgeMinutes = 2 } = {}) {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-boot-briefing-'));
  t.after(() => fs.rmSync(homeDir, { recursive: true, force: true }));
  const projectRoot = path.join(homeDir, 'project');
  const otherProject = path.join(homeDir, 'other-project');
  const globalRoot = path.join(homeDir, '.local', 'state', 'sgsd', 'telemetry', 'global');
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.mkdirSync(otherProject, { recursive: true });
  fs.mkdirSync(globalRoot, { recursive: true });
  const projectId = digest(fs.realpathSync(projectRoot));
  if (receiver) {
    writeJson(path.join(globalRoot, 'service.json'), {
      schema_version: 1,
      root_id: digest(globalRoot),
      pid: process.pid,
      instance_id: 'receiver-1',
      started_at: '2026-09-10T02:17:31.000Z',
      runtime_fingerprint: '7a5a1516ffffffff',
      urls: { health: 'http://127.0.0.1:43811' },
    });
  }
  const snapshot = {
    schema_version: 1,
    generated_at: new Date(Date.now() - snapshotAgeMinutes * 60000).toISOString(),
    projects: [{
      project_id: projectId,
      project_dir: projectRoot,
      native: { status: 'unavailable', last_received_at: null, last_occurred_at: null },
      operational: { status: 'unavailable', last_received_at: null },
    }],
    findings: [],
  };
  writeJson(path.join(globalRoot, 'monitor', 'latest.json'), snapshot);
  const fetchHealth = () => ({ status: 'healthy', pid: process.pid, instance_id: 'receiver-1',
    root_id: digest(globalRoot), project_id: digest(globalRoot), runtime_fingerprint: '7a5a1516ffffffff' });
  return { homeDir, projectRoot, otherProject, projectId, globalRoot, snapshot, fetchHealth };
}

function collect(f, env = {}, overrides = {}) {
  return collectAtlasBootBriefing({
    projectRoot: f.projectRoot,
    homeDir: f.homeDir,
    env,
    fetchHealth: f.fetchHealth,
    ...overrides,
  });
}

function register(f, projectDir = f.projectRoot) {
  const projectReal = fs.realpathSync(projectDir);
  const projectId = digest(projectReal);
  writeJson(path.join(f.globalRoot, 'runs', RUN_ID, 'registration.json'), {
    schema_version: 1,
    run_id: RUN_ID,
    project_id: projectId,
    project_dir: projectReal,
    registered_at: '2026-09-10T14:12:31.887Z',
  });
  return { SGSD_RUN_ID: RUN_ID, SGSD_ATLAS_PROJECT_ID: projectId, SGSD_ATLAS_GLOBAL_ROOT: f.globalRoot };
}

function registerProject(f, overrides = {}) {
  writeJson(path.join(f.globalRoot, 'projects', f.projectId, 'project.json'), {
    schema_version: 1,
    project_id: f.projectId,
    project_dir: f.projectRoot,
    ...overrides,
  });
}

function utcClock(value) {
  const date = new Date(value);
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}Z`;
}

function unattachedLine(f, env) {
  return formatAtlasBriefing(collect(f, env))[2];
}

test('unattached session reports the exact cause and project findings without success claims', t => {
  const f = fixture(t);
  f.snapshot.findings = [
    { severity: 'WARN', reason: 'project_not_registered', project_id: f.projectId },
    { severity: 'WARN', reason: 'operational_delivery_unobserved', project_id: f.projectId },
    { severity: 'WARN', reason: 'native_storage_missing', project_id: f.projectId },
  ];
  writeJson(path.join(f.globalRoot, 'monitor', 'latest.json'), f.snapshot);
  const lines = formatAtlasBriefing(collect(f));
  assert.equal(lines[1], `- Receiver: healthy [pid ${process.pid}, fp 7a5a1516, started 02:17Z]`);
  assert.equal(lines[2], "- This session: NOT ATTACHED (no SGSD_RUN_ID; started outside the SGSD launch paths, so this session's native telemetry is not collected)");
  assert.match(lines[3], new RegExp(`^- Project ${f.projectId.slice(0, 8)}: not registered; native unavailable \\(last none\\); operational unavailable \\(last none, gaps unknown, backlog unknown bytes\\)`));
  assert.deepEqual(lines.slice(4), ['- WARN: project_not_registered', '- WARN: operational_delivery_unobserved',
    '- WARN: native_storage_missing']);
  assert.doesNotMatch(lines.join('\n'), /\bcovered\b|\bcollecting\b/);
});

test('receiver health requires every identity field and exact value', t => {
  const f = fixture(t);
  const base = { status: 'healthy', pid: process.pid, instance_id: 'receiver-1',
    root_id: digest(f.globalRoot), project_id: digest(f.globalRoot),
    runtime_fingerprint: '7a5a1516ffffffff' };
  for (const field of ['pid', 'instance_id', 'root_id', 'project_id', 'runtime_fingerprint']) {
    const missing = { ...base };
    delete missing[field];
    let lines = formatAtlasBriefing(collect(f, {}, { fetchHealth: () => missing }));
    assert.match(lines[1], new RegExp(`unhealthy \\(health ${field} missing\\)`));
    const mismatched = { ...base, [field]: field === 'pid' ? process.pid + 1 : `wrong-${field}` };
    lines = formatAtlasBriefing(collect(f, {}, { fetchHealth: () => mismatched }));
    assert.match(lines[1], new RegExp(`unhealthy \\(health ${field} mismatch\\)`));
  }
});

test('null receiver start time prints unknown', t => {
  const f = fixture(t);
  const servicePath = path.join(f.globalRoot, 'service.json');
  const service = JSON.parse(fs.readFileSync(servicePath, 'utf8'));
  writeJson(servicePath, { ...service, started_at: null });
  const lines = formatAtlasBriefing(collect(f));
  assert.equal(lines[1], `- Receiver: healthy [pid ${process.pid}, fp 7a5a1516, started unknown]`);
});

test('every not-attached branch has an exact qualified session line', t => {
  const f = fixture(t);
  const environment = { SGSD_RUN_ID: RUN_ID, SGSD_ATLAS_PROJECT_ID: f.projectId,
    SGSD_ATLAS_GLOBAL_ROOT: f.globalRoot };
  const cases = [
    [{ ...environment, SGSD_RUN_ID: 'bad-run' }, '- This session: NOT ATTACHED (invalid SGSD_RUN_ID for bad-run)'],
    [{ SGSD_RUN_ID: RUN_ID, SGSD_ATLAS_GLOBAL_ROOT: f.globalRoot },
      `- This session: NOT ATTACHED (Atlas launch environment missing for ${RUN_ID})`],
    [{ SGSD_RUN_ID: RUN_ID, SGSD_ATLAS_PROJECT_ID: f.projectId },
      `- This session: NOT ATTACHED (Atlas launch environment missing for ${RUN_ID})`],
    [environment, `- This session: NOT ATTACHED (run registration missing for ${RUN_ID})`],
  ];
  for (const [env, expected] of cases) {
    const line = unattachedLine(f, env);
    assert.equal(line, expected);
    assert.doesNotMatch(line.toLowerCase().replace('not attached', ''), /\battached\b/);
  }

  const registrationPath = path.join(f.globalRoot, 'runs', RUN_ID, 'registration.json');
  const validRegistration = { schema_version: 1, run_id: RUN_ID, project_id: f.projectId,
    project_dir: f.projectRoot, registered_at: '2026-09-10T14:12:31.887Z' };
  for (const invalid of [{ ...validRegistration, schema_version: 2 },
    { ...validRegistration, run_id: 'sgsd-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' }]) {
    writeJson(registrationPath, invalid);
    const line = unattachedLine(f, environment);
    assert.equal(line, `- This session: NOT ATTACHED (run registration invalid for ${RUN_ID})`);
    assert.doesNotMatch(line.toLowerCase().replace('not attached', ''), /\battached\b/);
  }

  writeJson(registrationPath, { ...validRegistration, project_id: '0'.repeat(64) });
  const registrationMismatch = unattachedLine(f, environment);
  assert.equal(registrationMismatch,
    `- This session: NOT ATTACHED (run registration does not match the Atlas launch environment for ${RUN_ID})`);
  assert.doesNotMatch(registrationMismatch.toLowerCase().replace('not attached', ''), /\battached\b/);

  writeJson(registrationPath, validRegistration);
  const environmentMismatch = unattachedLine(f, {
    ...environment,
    SGSD_ATLAS_PROJECT_ID: digest(fs.realpathSync(f.otherProject)),
  });
  assert.equal(environmentMismatch,
    `- This session: NOT ATTACHED (run registration does not match the Atlas launch environment for ${RUN_ID})`);
  assert.doesNotMatch(environmentMismatch.toLowerCase().replace('not attached', ''), /\battached\b/);
});

test('wrong-project registration names the different project', t => {
  const f = fixture(t);
  const env = register(f, f.otherProject);
  const lines = formatAtlasBriefing(collect(f, env));
  assert.equal(lines[2], `- This session: attached, run ${RUN_ID} registered for a DIFFERENT project (${f.otherProject})`);
});

test('healthy attached session preserves unavailable delivery status', t => {
  const f = fixture(t);
  registerProject(f);
  const lines = formatAtlasBriefing(collect(f, register(f)));
  assert.equal(lines[2], `- This session: attached, run ${RUN_ID} registered 14:12Z for this worktree`);
  assert.match(lines[3], /registered; native unavailable \(last none\); operational unavailable \(last none, gaps unknown, backlog unknown bytes\)/);
  assert.doesNotMatch(lines.join('\n'), /\bcollecting\b/);
});

test('degraded snapshot preserves statuses, timestamp, gaps and backlog', t => {
  const f = fixture(t, { snapshotAgeMinutes: 0 });
  registerProject(f);
  f.snapshot.projects[0].native.status = 'stale_or_idle';
  f.snapshot.projects[0].native.last_received_at = '2026-09-10T14:13:37.970Z';
  f.snapshot.projects[0].operational = { status: 'degraded', last_received_at: '2026-09-10T14:32:52.750Z',
    gaps: 310, pending_bytes: 8310653 };
  writeJson(path.join(f.globalRoot, 'monitor', 'latest.json'), f.snapshot);
  const lines = formatAtlasBriefing(collect(f, register(f)));
  assert.equal(lines[3], `- Project ${f.projectId.slice(0, 8)}: registered; native stale_or_idle (last 14:13Z); operational degraded (last 14:32Z, gaps 310, backlog 8310653 bytes) (monitor snapshot ${utcClock(f.snapshot.generated_at)}, 0m old)`);
  assert.doesNotMatch(lines[3], /\bobserved\b/);
});

test('observed snapshot prints observed only from literal monitor statuses', t => {
  const f = fixture(t);
  registerProject(f);
  f.snapshot.projects[0].native = { status: 'observed', last_received_at: '2026-09-10T14:13:37.970Z' };
  f.snapshot.projects[0].operational = { status: 'observed', last_received_at: '2026-09-10T14:15:52.750Z',
    gaps: 0, pending_bytes: 0 };
  writeJson(path.join(f.globalRoot, 'monitor', 'latest.json'), f.snapshot);
  const lines = formatAtlasBriefing(collect(f, register(f)));
  assert.match(lines[3], /native observed \(last 14:13Z\)/);
  assert.match(lines[3], /operational observed \(last 14:15Z, gaps 0, backlog 0 bytes\)/);
});

test('project registration comes only from a matching project record', t => {
  const f = fixture(t);
  let lines = formatAtlasBriefing(collect(f));
  assert.match(lines[3], new RegExp(`^- Project ${f.projectId.slice(0, 8)}: not registered;`));

  registerProject(f, { project_dir: f.otherProject });
  lines = formatAtlasBriefing(collect(f));
  assert.match(lines[3], new RegExp(`^- Project ${f.projectId.slice(0, 8)}: not registered;`));

  registerProject(f, { schema_version: 2 });
  lines = formatAtlasBriefing(collect(f));
  assert.match(lines[3], new RegExp(`^- Project ${f.projectId.slice(0, 8)}: not registered;`));

  registerProject(f);
  lines = formatAtlasBriefing(collect(f));
  assert.match(lines[3], new RegExp(`^- Project ${f.projectId.slice(0, 8)}: registered;`));
});

test('missing receiver and state directories remain report-only', t => {
  const f = fixture(t, { receiver: false });
  fs.rmSync(path.join(f.globalRoot, 'monitor'), { recursive: true, force: true });
  let result;
  assert.doesNotThrow(() => { result = collect(f); });
  assert.deepEqual(formatAtlasBriefing(result).slice(0, 4), [
    'Atlas Telemetry',
    '- Receiver: not deployed',
    "- This session: NOT ATTACHED (no SGSD_RUN_ID; started outside the SGSD launch paths, so this session's native telemetry is not collected)",
    `- Project ${f.projectId.slice(0, 8)}: monitor snapshot missing`,
  ]);
});

test('snapshot older than ten minutes is marked stale', t => {
  const f = fixture(t, { snapshotAgeMinutes: 11 });
  const lines = formatAtlasBriefing(collect(f));
  assert.match(lines[3], /\(stale\)$/);
});

test('null snapshot time has unknown age without stale', t => {
  const f = fixture(t);
  f.snapshot.generated_at = null;
  writeJson(path.join(f.globalRoot, 'monitor', 'latest.json'), f.snapshot);
  const lines = formatAtlasBriefing(collect(f));
  assert.match(lines[3], /\(monitor snapshot unknown, unknown age\)$/);
  assert.doesNotMatch(lines[3], /\(stale\)/);
});

test('module contains no mutating Atlas command surface', () => {
  const source = fs.readFileSync(path.join(__dirname, 'atlas-boot-briefing.cjs'), 'utf8');
  assert.doesNotMatch(source, /global\.cjs|lifecycle\.cjs|stack\.cjs|monitor-schedule\.cjs/);
});
