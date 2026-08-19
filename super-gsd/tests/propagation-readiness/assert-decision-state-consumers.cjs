#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const adapter = path.join(repoRoot, 'super-gsd', 'scripts', 'lib', 'decision-state.cjs');
const installer = path.join(repoRoot, 'super-gsd', 'install.sh');
const bash = findBash();
const requestedConsumer = readArg('--consumer') || 'all';
const supportedConsumers = ['all', 'orchestrator', 'installed-session-hook'];

if (!supportedConsumers.includes(requestedConsumer)) {
  console.error('Usage: assert-decision-state-consumers.cjs '
    + '--consumer all|orchestrator|installed-session-hook');
  process.exit(2);
}

let passed = 0;
const failures = [];

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function findBash() {
  if (process.platform !== 'win32') return 'bash';
  const candidates = [
    process.env.GIT_BASH,
    process.env.LOCALAPPDATA
      && path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'usr', 'bin', 'bash.exe'),
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    'C:\\Program Files\\Git\\bin\\bash.exe',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || 'bash';
}

function bashPath(value) {
  return process.platform === 'win32' ? value.split(path.sep).join('/') : value;
}

function assert(name, condition, detail) {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function hashTree(root) {
  const hash = crypto.createHash('sha256');
  function walk(current, relative) {
    const stat = fs.lstatSync(current);
    hash.update(`${relative}\0${stat.isDirectory() ? 'd' : 'f'}\0`);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(current).sort()) {
        walk(path.join(current, name), path.join(relative, name));
      }
      return;
    }
    hash.update(fs.readFileSync(current));
  }
  walk(root, '.');
  return hash.digest('hex');
}

function createDecisionFixture(root) {
  const planning = path.join(root, '.planning');
  const milestone = 'v9.9';
  const phasesRoot = path.join(planning, 'milestones', milestone, 'phases');
  writeFile(path.join(planning, 'STATE.md'), [
    '---',
    `milestone: ${milestone}`,
    'roadmap_run:',
    '  current_milestone: v9.9',
    '  current_phase: "10"',
    '  current_phase_name: STALE_STATE_HEAD_SENTINEL',
    '  current_phase_status: in-progress',
    '---',
    '',
  ].join('\n'));
  writeFile(path.join(planning, 'milestones', milestone, 'ROADMAP.md'), [
    '# Fixture roadmap',
    '',
    '| Phase | Name | Status |',
    '|---:|---|---|',
    '| 10 | Stale projection | Complete |',
    '| v30-07 | Resolver answer | Planned |',
    '',
  ].join('\n'));
  writeFile(path.join(phasesRoot, '10-stale-projection', '10-CONTEXT.md'),
    '---\nphase: 10\nstatus: complete\n---\n');
  writeFile(path.join(phasesRoot, '10-stale-projection', '10-VERIFICATION.md'),
    '---\nphase: 10\nstatus: PASS\n---\n');
  writeFile(path.join(phasesRoot, 'v30-07-resolver-answer', 'v30-07-CONTEXT.md'),
    '---\nphase: v30-07\nstatus: in-progress\n---\n');
  return { planning, statePath: path.join(planning, 'STATE.md') };
}

function runAdapter(projectDir, render) {
  return spawnSync(process.execPath, [adapter, '--render', render, '--project', projectDir], {
    cwd: projectDir,
    encoding: 'utf8',
  });
}

function assertCanonicalRendering(label, output) {
  assert(`${label} renders the effective milestone`, output.includes('milestone: v9.9'));
  assert(`${label} preserves the opaque phase token`, output.includes('phase: v30-07'));
  assert(`${label} renders phase name and status`,
    output.includes('phase_name: Resolver Answer')
      && output.includes('phase_status: in-progress'));
  assert(`${label} renders confidence and source`,
    output.includes('confidence: 0.65') && output.includes('source: phase_folders'));
  assert(`${label} renders a loud disagreement warning`,
    output.includes('WARNING: PROJECTION STALE / EVIDENCE CONFLICT'));
  assert(`${label} names both conflicting values`,
    output.includes('phase_folders: milestone=v9.9 phase=v30-07')
      && output.includes('state_md: milestone=v9.9 phase=10'));
  assert(`${label} does not render raw STATE frontmatter`,
    !output.includes('roadmap_run:') && !output.includes('STALE_STATE_HEAD_SENTINEL'));
}

function runOrchestratorConsumer() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-decision-adapter-'));
  try {
    const fixture = createDecisionFixture(root);
    const stateBefore = fs.readFileSync(fixture.statePath);
    const planningBefore = hashTree(fixture.planning);
    const orchestratorRun = runAdapter(root, 'orchestrator');
    const sessionRun = runAdapter(root, 'session');
    assert('orchestrator adapter exits 0', orchestratorRun.status === 0,
      `exit=${orchestratorRun.status} error=${orchestratorRun.error && orchestratorRun.error.code || 'none'}`);
    assert('session adapter exits 0', sessionRun.status === 0,
      `exit=${sessionRun.status} error=${sessionRun.error && sessionRun.error.code || 'none'}`);
    assert('session and orchestrator renderings are byte-identical',
      sessionRun.status === 0 && orchestratorRun.status === 0
        && sessionRun.stdout === orchestratorRun.stdout);
    let moduleRendering = null;
    try {
      const decisionState = require(adapter);
      moduleRendering = decisionState.renderDecisionState({
        projectDir: root,
        render: 'orchestrator',
      });
    } catch (error) {
      moduleRendering = `MODULE_ERROR:${error && error.message || error}`;
    }
    assertCanonicalRendering('adapter module', moduleRendering || '');
    assert('module export uses the same rendering boundary',
      moduleRendering === orchestratorRun.stdout,
      typeof moduleRendering === 'string' ? moduleRendering.slice(0, 160) : typeof moduleRendering);
    assert('adapter never writes STATE.md',
      stateBefore.equals(fs.readFileSync(fixture.statePath)));
    assert('adapter never writes anything under .planning',
      planningBefore === hashTree(fixture.planning));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function runInstalledSessionHookConsumer() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-decision-install-'));
  try {
    const home = path.join(tmp, 'home');
    const project = path.join(tmp, 'project');
    const liveHook = path.join(home, '.claude', 'hooks', 'gsd-session-state.sh');
    fs.mkdirSync(path.join(home, '.claude', 'get-shit-done'), { recursive: true });
    fs.mkdirSync(project, { recursive: true });
    writeFile(liveHook, '#!/bin/bash\necho DISTINGUISHABLE_STALE_HOOK\n');
    const fixture = createDecisionFixture(project);
    const stateBefore = fs.readFileSync(fixture.statePath);

    const installRun = spawnSync(bash, [
      bashPath(installer),
      '--init-project',
      '--install-global',
      '--skip-cockpit-deps',
    ], {
      cwd: project,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
      },
    });
    assert('real installer exits 0', installRun.status === 0,
      `exit=${installRun.status} signal=${installRun.signal || 'none'} `
        + `error=${installRun.error && installRun.error.code || 'none'}`);
    assert('real installer deploys the live hook path',
      installRun.status === 0 && fs.existsSync(liveHook));

    const expectedRun = runAdapter(project, 'orchestrator');
    assert('installer fixture adapter exits 0', expectedRun.status === 0,
      `exit=${expectedRun.status} error=${expectedRun.error && expectedRun.error.code || 'none'}`);
    const payload = JSON.stringify({
      session_id: 'fixture-session',
      transcript_path: path.join(project, 'fixture-transcript.jsonl'),
      cwd: project,
      permission_mode: 'default',
      hook_event_name: 'SessionStart',
      source: 'startup',
    }) + '\n';
    const hookRun = spawnSync(bash, [bashPath(liveHook)], {
      cwd: project,
      encoding: 'utf8',
      input: payload,
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
      },
    });
    assert('installed SessionStart hook executes successfully', hookRun.status === 0,
      `exit=${hookRun.status} signal=${hookRun.signal || 'none'} `
        + `error=${hookRun.error && hookRun.error.code || 'none'}`);
    assert('installed hook output is the adapter rendering',
      hookRun.status === 0 && expectedRun.status === 0
        && hookRun.stdout === expectedRun.stdout,
      `hook=${JSON.stringify((hookRun.stdout || '').slice(0, 160))}`);
    assertCanonicalRendering('installed hook', hookRun.stdout || '');
    assert('installed hook replaces the distinguishable stale implementation',
      hookRun.status === 0
        && !(hookRun.stdout || '').includes('DISTINGUISHABLE_STALE_HOOK'));
    assert('installed hook never injects a raw STATE head',
      hookRun.status === 0
        && !(hookRun.stdout || '').includes('roadmap_run:')
        && !(hookRun.stdout || '').includes('STALE_STATE_HEAD_SENTINEL'));
    assert('installer, adapter, and hook preserve STATE.md bytes',
      stateBefore.equals(fs.readFileSync(fixture.statePath)));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (requestedConsumer === 'all' || requestedConsumer === 'orchestrator') {
  runOrchestratorConsumer();
}
if (requestedConsumer === 'all' || requestedConsumer === 'installed-session-hook') {
  runInstalledSessionHookConsumer();
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`assert-decision-state-consumers: ${passed} pass, ${failures.length} fail`);
  process.exit(1);
}

console.log(`assert-decision-state-consumers: ${passed} pass, 0 fail`);
