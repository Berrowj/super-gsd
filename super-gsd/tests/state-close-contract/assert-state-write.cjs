#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..', '..');
const writerPath = path.join(root, 'super-gsd', 'tools', 'state-write', 'write.cjs');
const resolverPath = path.join(root, 'super-gsd', 'tools', 'state-resolver', 'resolve.cjs');
const skillPath = path.join(root, 'super-gsd', 'skills', 'sgsd-orchestrate', 'SKILL.md');
const hookPath = path.join(root, 'super-gsd', 'hooks', 'gsd-phase-boundary.sh');
const installPath = path.join(root, 'super-gsd', 'install.sh');
const decisionPath = path.join(root, 'super-gsd', 'scripts', 'lib', 'decision-state.cjs');
const requested = arg('--case') || 'all';
const cases = ['atomic-idempotent', 'refuse-backwards', 'refuse-ambiguity', 'orchestrator-hook-wire'];

if (requested !== 'all' && !cases.includes(requested)) {
  console.error(`Usage: ${path.basename(__filename)} --case all|${cases.join('|')}`);
  process.exit(2);
}
if (!fs.existsSync(writerPath)) {
  console.error(`FAIL state.write implementation missing: ${writerPath}`);
  console.error('state_write_contract: 0/1 assertions passed');
  process.exit(1);
}

const { writeState, runCli: runStateCli } = require(writerPath);
const { resolveEffectiveState } = require(resolverPath);
let passed = 0;
let total = 0;
const failures = [];

function arg(flag) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? null : process.argv[index + 1];
}
function check(name, value, detail = '') {
  total += 1;
  if (value) passed += 1;
  else failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}
function equal(name, actual, expected) {
  try { assert.deepStrictEqual(actual, expected); check(name, true); }
  catch (error) { check(name, false, error.message); }
}
function put(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}
function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function roadmap() {
  return [
    '# devcp ROADMAP', '', '| Phase | Name | Status |', '|---:|---|---|',
    '| v30-06.8 | Decimal seam | Complete |',
    '| v30-07 | Active opaque | Active |',
    '| v30-08 | Opaque successor | Planned |', '',
  ].join('\n');
}
function ambiguousRoadmap() {
  return roadmap().replace(
    '| v30-08 | Opaque successor | Planned |',
    '| v30-07 | Duplicate active opaque | Active |\n'
      + '| v30-08 | Opaque successor | Planned |');
}
function state(phase) {
  return [
    '---', 'gsd_state_version: 1.0', 'milestone: v3.0',
    `current_phase: "${phase}"  # legacy comment`,
    'milestone_name: "devcp byte fixture"',
    'last_updated: "2026-08-19T00:00:00.000Z"', 'legacy_flag: true',
    'progress:', '  v3_0:', '    total_phases: 99',
    '    completed_phases: 0', '    completed_plans: 7', '    percent: 0',
    '    phase_v30_06_8: "PASS legacy"',
    '    legacy_nested: "keep # punctuation: and spacing"',
    '  v2_9:', '    total_phases: 9', '    completed_phases: 9',
    '    completed_plans: 9', '    percent: 100',
    '    phase_105: "PASS unrelated milestone row"', '---', '', '# Project State', '',
    'Unrelated body bytes:  keep  two spaces, # markers, and: colons.', '',
  ].join('\r\n');
}
function fixture(label, projected = 'v30-07', resolved = 'v30-07') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `state-write-${label}-`));
  const planning = path.join(dir, '.planning');
  const statePath = path.join(planning, 'STATE.md');
  const tokens = ['v30-06.8', 'v30-07', 'v30-08'];
  const slugs = ['decimal-seam', 'active-opaque', 'opaque-successor'];
  const active = tokens.indexOf(resolved);
  put(path.join(planning, 'milestones', 'v3.0', 'ROADMAP.md'), roadmap());
  tokens.forEach((token, index) => {
    const phaseDir = path.join(planning, 'milestones', 'v3.0', 'phases', `${token}-${slugs[index]}`);
    fs.mkdirSync(phaseDir, { recursive: true });
    if (index < active) put(path.join(phaseDir, `${token}-VERIFICATION.md`), '---\nstatus: PASS\n---\n');
    if (index === active) put(path.join(phaseDir, 'CONTEXT.md'), `# ${token}\n`);
  });
  put(statePath, state(projected));
  return { dir, planning, statePath, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
function event(kind, projectDir, patch = {}) {
  const base = {
    event: kind, projectDir, milestone: 'v3.0', evidence_phase: 'v30-07',
    current_phase: kind === 'phase-close' ? 'v30-08' : 'v30-07',
    last_updated: '2026-08-20T12:34:56.000Z',
    progress: {
      total_phases: 3, completed_phases: kind === 'phase-close' ? 2 : 1,
      completed_plans: 8,
      status_row: { phase: 'v30-07', value: kind === 'phase-close' ? 'PASS phase' : '1/2 plans complete - ACTIVE' },
    },
  };
  return {
    ...base, ...patch,
    progress: {
      ...base.progress, ...(patch.progress || {}),
      status_row: { ...base.progress.status_row, ...((patch.progress || {}).status_row || {}) },
    },
  };
}
function temps(f) {
  return fs.readdirSync(f.planning).filter((name) => name.includes('STATE.md') && name.includes('tmp'));
}
function expected(original) {
  return original
    .replace('current_phase: "v30-06.8"  # legacy comment', 'current_phase: "v30-07"')
    .replace('last_updated: "2026-08-19T00:00:00.000Z"', 'last_updated: "2026-08-20T12:34:56.000Z"')
    .replace('    total_phases: 99', '    total_phases: 3')
    .replace('    completed_phases: 0', '    completed_phases: 1')
    .replace('    completed_plans: 7', '    completed_plans: 8')
    .replace('    percent: 0', '    percent: 33')
    .replace('    legacy_nested: "keep # punctuation: and spacing"\r\n',
      '    legacy_nested: "keep # punctuation: and spacing"\r\n'
      + '    phase_v30_07: "1/2 plans complete - ACTIVE"\r\n');
}

function atomicIdempotent() {
  const f = fixture('atomic', 'v30-06.8', 'v30-07');
  try {
    const original = fs.readFileSync(f.statePath, 'utf8');
    const before = hash(f.statePath);
    const rename = fs.renameSync;
    fs.renameSync = () => { const error = new Error('injected rename seam failure'); error.code = 'EINJECTED'; throw error; };
    let redSeam;
    try { redSeam = writeState(event('plan-close', f.dir)); }
    finally { fs.renameSync = rename; }
    equal('rename failure envelope', [redSeam.ok, redSeam.changed, redSeam.exit_code, redSeam.reason],
      [false, false, 2, 'atomic_rename_failed']);
    check('rename failure preserves hash', hash(f.statePath) === before);
    equal('rename failure cleans temp', temps(f), []);
    const first = writeState(event('plan-close', f.dir));
    equal('plan close changes projection', [first.ok, first.changed, first.exit_code], [true, true, 0]);
    check('surgical bytes exactly match whitelist patch', fs.readFileSync(f.statePath, 'utf8') === expected(original));
    const firstHash = hash(f.statePath);
    const replay = writeState(event('plan-close', f.dir));
    equal('replay changed=false', [replay.ok, replay.changed, replay.reason], [true, false, 'already_applied']);
    check('replay byte-identical', hash(f.statePath) === firstHash);
    equal('success paths clean temp', temps(f), []);
  } finally { f.cleanup(); }
}

function refuseBackwards() {
  const ahead = fixture('ahead', 'v30-08', 'v30-07');
  try {
    const resolved = resolveEffectiveState({ projectDir: ahead.dir });
    check('resolver signals stale STATE', resolved.ok && resolved.phase === 'v30-07'
      && resolved.projection_stale && resolved.stale_sources.includes('state_md'), JSON.stringify(resolved));
    const before = hash(ahead.statePath);
    const refused = writeState(event('plan-close', ahead.dir));
    equal('projection ahead refusal', [refused.ok, refused.changed, refused.exit_code, refused.reason],
      [false, false, 1, 'projection_ahead']);
    check('refusal byte-identical', hash(ahead.statePath) === before);
  } finally { ahead.cleanup(); }
  const same = fixture('same');
  try { check('same phase control passes', writeState(event('plan-close', same.dir)).ok); }
  finally { same.cleanup(); }
  const next = fixture('next');
  try {
    const result = writeState(event('phase-close', next.dir));
    equal('immediate ROADMAP successor passes', [result.ok, result.current_phase], [true, 'v30-08']);
  } finally { next.cleanup(); }
  const end = fixture('end', 'v30-08', 'v30-08');
  try {
    const result = writeState(event('phase-close', end.dir, {
      evidence_phase: 'v30-08', current_phase: 'complete',
      progress: { completed_phases: 3, status_row: { phase: 'v30-08', value: 'PASS final' } },
    }));
    equal('roadmap end accepts complete', [result.ok, result.current_phase], [true, 'complete']);
  } finally { end.cleanup(); }
  const evidenceAhead = fixture('evidence-ahead', 'v30-07', 'v30-08');
  try {
    const result = writeState(event('plan-close', evidenceAhead.dir));
    equal('resolver evidence ahead refuses', [result.exit_code, result.reason], [1, 'evidence_ahead']);
  } finally { evidenceAhead.cleanup(); }
  const noRoadmap = fixture('no-roadmap');
  try {
    put(path.join(noRoadmap.planning, 'ORCHESTRATOR-CHECKPOINT.md'), '---\nmilestone: v3.0\ncurrent_phase: v30-07\n---\n');
    fs.unlinkSync(path.join(noRoadmap.planning, 'milestones', 'v3.0', 'ROADMAP.md'));
    const result = writeState(event('plan-close', noRoadmap.dir));
    equal('absent ROADMAP refuses', [result.exit_code, result.reason], [1, 'roadmap_identity_absent']);
  } finally { noRoadmap.cleanup(); }
  const invalid = fixture('invalid');
  try {
    const before = hash(invalid.statePath);
    const result = writeState(event('plan-close', invalid.dir, { progress: { total_phases: 0 } }));
    equal('invalid progress exits 2', [result.exit_code, result.reason], [2, 'invalid_progress']);
    check('invalid progress preserves bytes', hash(invalid.statePath) === before);
  } finally { invalid.cleanup(); }
  const source = fs.readFileSync(writerPath, 'utf8');
  check('writer consumes resolver signals and sole parser', source.includes('resolveEffectiveState')
    && source.includes('projection_stale') && source.includes('stale_sources')
    && source.includes("require('../../scripts/lib/phase-name.cjs')"));
  check('writer has no copied/private phase parser', !source.includes('function parsePhase') && !source.includes('parseInt('));
}

function refuseAmbiguity() {
  const f = fixture('ambiguity');
  try {
    put(path.join(f.planning, 'milestones', 'v3.0', 'ROADMAP.md'), ambiguousRoadmap());
    const before = hash(f.statePath);
    const result = writeState(event('plan-close', f.dir));
    equal('duplicate ROADMAP identity refuses',
      [result.ok, result.changed, result.exit_code, result.reason],
      [false, false, 1, 'roadmap_identity_ambiguous']);
    check('ambiguity refusal preserves bytes', hash(f.statePath) === before);
  } finally { f.cleanup(); }
}

function documented(skill, kind, replacements) {
  const marker = `--event-json '{"event":"${kind}"`;
  const line = skill.split(/\r?\n/).find((row) => row.includes(marker));
  if (!line) throw new Error(`missing ${kind} documented command`);
  let json = line.slice(line.indexOf("'{") + 1, line.lastIndexOf("}'") + 1);
  Object.entries(replacements).forEach(([key, value]) => { json = json.split(key).join(value); });
  return JSON.parse(json);
}
function cli(cwd, envelope) {
  const previousCwd = process.cwd();
  const originalWrite = process.stdout.write;
  let stdout = '';
  process.chdir(cwd);
  process.stdout.write = (chunk) => { stdout += String(chunk); return true; };
  try {
    const status = runStateCli(['node', writerPath, '--event-json', JSON.stringify(envelope)]);
    return { status, stdout, stderr: '' };
  } finally {
    process.stdout.write = originalWrite;
    process.chdir(previousCwd);
  }
}
function orchestratorHookWire() {
  const skill = fs.readFileSync(skillPath, 'utf8');
  const step11 = skill.indexOf('  11. UPDATE STATE');
  const planAt = skill.indexOf('--event-json \'{"event":"plan-close"', step11);
  const stepJ = skill.indexOf('j. PHASE-CLOSE STATE PROJECTION');
  const phaseAt = skill.indexOf('--event-json \'{"event":"phase-close"', stepJ);
  check('Step 11 has plan-close command', step11 >= 0 && planAt > step11);
  check('Step 6.6.j phase-close precedes 6.7', stepJ >= 0 && phaseAt > stepJ && skill.indexOf('  6.7.', phaseAt) > phaseAt);
  check('Step 11 has no manual STATE edit', !skill.slice(step11, skill.indexOf('  11.5.', step11)).includes('Update STATE.md'));
  const replacements = {
    '{{MILESTONE}}': 'v3.0', '{{PHASE}}': 'v30-07', '{{NEXT_PHASE_OR_COMPLETE}}': 'v30-08',
    '{{LAST_UPDATED}}': '2026-08-20T13:00:00.000Z', '{{TOTAL_PHASES}}': '3',
    '{{COMPLETED_PHASES}}': '1', '{{COMPLETED_PLANS}}': '8',
    '{{PHASE_STATUS_ROW}}': 'documented command fixture',
  };
  for (const kind of ['plan-close', 'phase-close']) {
    const f = fixture(`${kind}-wire`);
    try {
      const input = documented(skill, kind, kind === 'phase-close'
        ? { ...replacements, '{{COMPLETED_PHASES}}': '2' } : replacements);
      const result = cli(f.dir, input);
      const output = result.stdout ? JSON.parse(result.stdout) : null;
      check(`documented ${kind} command executes`, result.status === 0 && output && output.ok,
        `status=${result.status} stdout=${result.stdout} stderr=${result.stderr}`);
    } finally { f.cleanup(); }
  }
  const refusal = fixture('cli-refusal', 'v30-08', 'v30-07');
  try { check('CLI refusal exits 1', cli(refusal.dir, event('plan-close', '.')).status === 1); }
  finally { refusal.cleanup(); }
  const invalid = fixture('cli-invalid');
  try { check('CLI input failure exits 2', cli(invalid.dir, event('plan-close', '.', { progress: { total_phases: -1 } })).status === 2); }
  finally { invalid.cleanup(); }

  const message = 'STATE.md close projections are owned by the orchestrator via state.write; arbitrary PostToolUse writes are not close evidence.';
  check('repo-owned boundary hook exists', fs.existsSync(hookPath));
  const hook = fs.readFileSync(hookPath, 'utf8');
  equal('hook line 25 is truthful', hook.split(/\r?\n/)[24], `  echo "${message}"`);
  check('old hook question absent', !hook.includes('Should STATE.md be updated'));
  check('install hook loop extended', fs.readFileSync(installPath, 'utf8').includes('"$SCRIPT_DIR/hooks/gsd-phase-boundary.sh"'));

  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'state-write-home-'));
  const live = path.join(process.env.USERPROFILE || os.homedir(), '.claude', 'hooks', 'gsd-phase-boundary.sh');
  const liveBefore = fs.existsSync(live) ? fs.readFileSync(live) : null;
  try {
    fs.mkdirSync(path.join(home, '.claude', 'get-shit-done'), { recursive: true });
    const installed = spawnSync('bash', ['super-gsd/install.sh', '--install-global'], {
      cwd: root, env: { ...process.env, HOME: home, USERPROFILE: home }, encoding: 'utf8', timeout: 120000,
    });
    check('isolated install succeeds', installed.status === 0,
      installed.error
        ? `spawn ${installed.error.code || 'UNKNOWN'}: ${installed.error.message}`
        : `status=${installed.status} stderr=${installed.stderr}`);
    const target = path.join(home, '.claude', 'hooks', 'gsd-phase-boundary.sh');
    check('hook reaches isolated live path', fs.existsSync(target));
    if (fs.existsSync(target)) check('installed hook matches source', fs.readFileSync(target, 'utf8') === hook);
    const liveAfter = fs.existsSync(live) ? fs.readFileSync(live) : null;
    check('operator hook untouched', liveBefore === null ? liveAfter === null
      : liveAfter !== null && Buffer.compare(liveBefore, liveAfter) === 0);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
  const decision = fs.readFileSync(decisionPath, 'utf8');
  check('decision-state remains render-only', !decision.includes('state-write') && !decision.includes('writeState('));
}

const runners = {
  'atomic-idempotent': atomicIdempotent,
  'refuse-backwards': refuseBackwards,
  'refuse-ambiguity': refuseAmbiguity,
  'orchestrator-hook-wire': orchestratorHookWire,
};
Object.entries(runners).forEach(([name, run]) => {
  if (requested !== 'all' && requested !== name) return;
  const before = failures.length;
  try { run(); } catch (error) { check(`${name} completes`, false, error.stack || error.message); }
  console.log(`${failures.length === before ? 'PASS' : 'FAIL'} ${name}`);
});
failures.forEach((failure) => console.error(`FAIL ${failure}`));
console.log(`state_write_contract: ${passed}/${total} assertions passed`);
process.exit(failures.length ? 1 : 0);
