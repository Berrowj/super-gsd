#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..', '..');
const hooksPath = path.join(root, 'super-gsd', 'scripts', 'lib', 'orchestrator-hooks.cjs');
const checkerPath = path.join(root, 'super-gsd', 'tools', 'phase-close', 'check.cjs');
const p154SummaryPath = path.join(root, '.planning', 'milestones', 'v3.6-vtp-bridge',
  'phases', '154-mcp-arg-contract', 'SUMMARY.md');
const p155SummaryPath = path.join(root, '.planning', 'milestones', 'v3.6-vtp-bridge',
  'phases', '155-propagation-readiness', 'SUMMARY.md');
const requested = arg('--case') || 'all';
const cases = ['devcp-audit-without-summary', 'passing-shapes'];

if (requested !== 'all' && !cases.includes(requested)) {
  console.error(`Usage: ${path.basename(__filename)} --case all|${cases.join('|')}`);
  process.exit(2);
}

const { skillRoutingConsult } = require(hooksPath);
const { loadSkillRoutingRegistry, resetCache } = require(
  path.join(root, 'super-gsd', 'scripts', 'lib', 'skill-routing-registry.cjs'));
let passed = 0;
let total = 0;
const failures = [];

function arg(flag) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? null : process.argv[index + 1];
}

function check(name, value, detail = '') {
  total += 1;
  if (value) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failures.push(`${name}${detail ? `: ${detail}` : ''}`);
    console.log(`FAIL ${name}${detail ? `  (${detail})` : ''}`);
  }
}

function equal(name, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    check(name, true);
  } catch (error) {
    check(name, false, error.message);
  }
}

function put(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function fixture(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `phase-close-${label}-`));
  const planning = path.join(dir, '.planning');
  const milestone = 'v3.0';
  const phase = 'v30-06.8';
  const slug = 'decimal-seam';
  const phaseDir = path.join(planning, 'milestones', milestone, 'phases', `${phase}-${slug}`);
  const registryPath = path.join(planning, 'benign-skill-routing.yaml');
  put(path.join(planning, 'STATE.md'), [
    '---', `milestone: ${milestone}`, `current_phase: ${phase}`, '---', '# devcp state', '',
  ].join('\n'));
  put(path.join(planning, 'milestones', milestone, 'ROADMAP.md'), [
    '# devcp ROADMAP', '', '| Phase | Name | Status |', '|---:|---|---|',
    '| v30-06.8 | Decimal seam | Complete |',
    '| v30-07 | Active opaque | Active |',
    '| v30-08 | Opaque successor | Planned |', '',
  ].join('\n'));
  put(path.join(phaseDir, 'AUDIT.md'), [
    '---', `phase: ${phase}`, 'status: PASS', '---', '# Passing audit', '',
  ].join('\n'));
  put(registryPath, [
    'routes:',
    '  - id: devcp-benign-phase-close',
    '    skill: devcp-benign-close',
    '    signatures:',
    '      event_names: [phase-close]',
    '    moment: phase-close',
    '    modes: [auto]',
    '    availability: canonical',
    '    dispatch:',
    '      command: node',
    "      args: ['{sgsd_root}/scripts/lib/phase-name.cjs', '--self-test']",
    '      timeout_ms: 10000',
    '      success_exits: [0]',
    '      verdict_exits: []', '',
  ].join('\n'));
  return {
    dir, projectDir: dir, planning, planningDir: planning,
    milestone, phase, slug, phaseDir, registryPath,
    summaryPath: path.join(phaseDir, 'SUMMARY.md'),
    auditPath: path.join(phaseDir, 'AUDIT.md'),
    statePath: path.join(planning, 'STATE.md'),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

function adaptedSummary(templatePath, f) {
  const source = fs.readFileSync(templatePath, 'utf8');
  return source
    .replace(/^phase:\s*.*$/m, `phase: "${f.phase}"`)
    .replace(/^slug:\s*.*$/m, `slug: ${f.slug}`)
    .replace(/^milestone:\s*.*$/m, `milestone: ${f.milestone}`);
}
function routeApi(f) {
  resetCache();
  const loaded = loadSkillRoutingRegistry({ registryPath: f.registryPath, noCache: true });
  let dispatches = 0;
  let stateAdvances = 0;
  const result = skillRoutingConsult({
    projectDir: f.dir,
    planningDir: f.planning,
    registryPath: f.registryPath,
    milestone: f.milestone,
    phase: f.phase,
    moment: 'phase-close',
    mode: 'auto',
    filesChanged: 1,
    diffLines: 1,
    phaseType: 'feature',
    workRisk: 'low',
    execute: true,
    dispatchExecutor: function () {
      dispatches += 1;
      return { status: 0, stdout: 'devcp benign dispatch', stderr: '' };
    },
  });
  if (result && result.ok) stateAdvances += 1;
  return { result, dispatches, stateAdvances, loaded };
}

function routeCli(f) {
  const child = spawnSync(process.execPath, [
    hooksPath, '--skill-routing-consult',
    '--project-dir', f.dir,
    '--planning-dir', f.planning,
    '--registry', f.registryPath,
    '--milestone', f.milestone,
    '--phase', f.phase,
    '--moment', 'phase-close',
    '--mode', 'auto',
    '--files-changed', '1',
    '--diff-lines', '1',
    '--phase-type', 'feature',
    '--work-risk', 'low',
    '--execute',
  ], { cwd: f.dir, encoding: 'utf8', windowsHide: true, timeout: 20000 });
  let parsed = null;
  if (!child.error) {
    const lines = String(child.stdout || '').trim().split(/\r?\n/).filter(Boolean);
    try { parsed = lines.length ? JSON.parse(lines[lines.length - 1]) : null; } catch (_error) {}
  }
  return { child, parsed };
}

function spawnDetail(run) {
  const child = run.child;
  if (child.error) return `spawn_error=${child.error.code || ''}:${child.error.message}`;
  return `status=${child.status} stdout=${String(child.stdout || '').trim()} stderr=${String(child.stderr || '').trim()}`;
}

function checkerCli(runCli, args) {
  const originalWrite = process.stdout.write;
  let stdout = '';
  process.stdout.write = function (chunk) { stdout += String(chunk); return true; };
  let status;
  try { status = runCli(['node', checkerPath].concat(args || [])); }
  finally { process.stdout.write = originalWrite; }
  return { status, result: JSON.parse(stdout.trim()) };
}

function expectRouteRefusal(label, f, reason) {
  const before = fs.readFileSync(f.statePath, 'utf8');
  const api = routeApi(f);
  equal(`${label} API refusal`, [
    api.result && api.result.ok,
    api.result && api.result.close_contract && api.result.close_contract.reason,
    api.dispatches,
    api.stateAdvances,
  ], [false, reason, 0, 0]);
  check(`${label} production loader used generated registry`,
    api.loaded.source === 'yaml' && api.loaded.routes.length === 1,
    JSON.stringify(api.loaded.validation));
  check(`${label} leaves STATE byte-identical`, fs.readFileSync(f.statePath, 'utf8') === before);
  const cli = routeCli(f);
  check(`${label} production CLI exits 1`,
    !cli.child.error && cli.child.status === 1
      && cli.parsed && cli.parsed.ok === false
      && cli.parsed.close_contract && cli.parsed.close_contract.reason === reason,
    spawnDetail(cli));
}
function devcpAuditWithoutSummary() {
  const missing = fixture('audit-only');
  try {
    const inventory = skillRoutingConsult({
      projectDir: missing.dir,
      planningDir: missing.planning,
      registryPath: missing.registryPath,
      milestone: missing.milestone,
      phase: missing.phase,
      moment: 'phase-close',
      mode: 'auto',
      execute: false,
    });
    check('SUMMARY preflight is execute-only', inventory.ok === true
      && !Object.prototype.hasOwnProperty.call(inventory, 'close_contract')
      && inventory.executed_count === 0, JSON.stringify(inventory));
    const otherMoment = skillRoutingConsult({
      projectDir: missing.dir,
      planningDir: missing.planning,
      registryPath: missing.registryPath,
      milestone: missing.milestone,
      phase: missing.phase,
      moment: 'on-demand',
      mode: 'auto',
      execute: true,
    });
    check('SUMMARY preflight is phase-close-only', otherMoment.ok === true
      && !Object.prototype.hasOwnProperty.call(otherMoment, 'close_contract')
      && otherMoment.route_count === 0, JSON.stringify(otherMoment));
    expectRouteRefusal('AUDIT without SUMMARY', missing, 'summary_missing');
  } finally { missing.cleanup(); }

  const malformed = fixture('malformed');
  try {
    put(malformed.summaryPath, '---\nphase: [unterminated\n---\n# malformed\n');
    expectRouteRefusal('malformed SUMMARY', malformed, 'summary_yaml_malformed');
  } finally { malformed.cleanup(); }

  const mismatch = fixture('identity');
  try {
    put(mismatch.summaryPath, adaptedSummary(p154SummaryPath, mismatch)
      .replace(/^phase:\s*.*$/m, 'phase: "v30-07"'));
    expectRouteRefusal('mismatched SUMMARY identity', mismatch, 'summary_phase_mismatch');
  } finally { mismatch.cleanup(); }
}

function checkerEdgeContracts() {
  if (!fs.existsSync(checkerPath)) {
    check('phase-close checker exists', false, checkerPath);
    return;
  }
  const { checkPhaseClose, runCli } = require(checkerPath);
  const f = fixture('checker-edges');
  try {
    put(f.summaryPath, '# body only\n');
    equal('body-only SUMMARY refusal', checkPhaseClose(f).reason, 'summary_frontmatter_missing');
    put(f.summaryPath, adaptedSummary(p154SummaryPath, f).replace(
      /^slug:\s*.*$/m, `slug: ${f.slug}\nslug: duplicate`));
    equal('duplicate SUMMARY key refusal', checkPhaseClose(f).reason, 'summary_duplicate_key');
    put(f.summaryPath, adaptedSummary(p154SummaryPath, f).replace(/^commits:\s*.*$/m, 'commits: []'));
    equal('empty commits refusal', checkPhaseClose(f).reason, 'summary_commits_invalid');
    put(f.summaryPath, adaptedSummary(p154SummaryPath, f).replace(/^gates:\s*.*$/m, 'gates: {}'));
    equal('empty gates refusal', checkPhaseClose(f).reason, 'summary_gates_invalid');
    put(f.summaryPath, adaptedSummary(p154SummaryPath, f).replace(/^slug:\s*.*$/m, 'slug: wrong'));
    equal('slug identity refusal', checkPhaseClose(f).reason, 'summary_slug_mismatch');
    put(f.summaryPath, adaptedSummary(p154SummaryPath, f).replace(
      /^milestone:\s*.*$/m, 'milestone: v9.9'));
    equal('milestone identity refusal', checkPhaseClose(f).reason, 'summary_milestone_mismatch');
    put(f.summaryPath, adaptedSummary(p154SummaryPath, f).replace(/^status:\s*.*$/m, 'status: ACTIVE'));
    equal('invalid status refusal', checkPhaseClose(f).reason, 'summary_status_invalid');
    put(f.summaryPath, adaptedSummary(p154SummaryPath, f).replace(
      /^commits:\s*.*$/m, 'commits: [not-a-commit]'));
    equal('invalid commit refusal', checkPhaseClose(f).reason, 'summary_commits_invalid');
    put(f.summaryPath, adaptedSummary(p154SummaryPath, f).replace(
      /^gates:\s*.*$/m, 'gates: {audit: ""}'));
    equal('empty gate verdict refusal', checkPhaseClose(f).reason, 'summary_gates_invalid');
    put(f.summaryPath, adaptedSummary(p154SummaryPath, f).replace(/^closed:\s*.*$/m, 'closed: 2026-02-30'));
    equal('impossible calendar date refusal', checkPhaseClose(f).reason, 'summary_closed_invalid');
    put(f.summaryPath, adaptedSummary(p154SummaryPath, f).replace(
      /^status:\s*.*$/m, 'future_field: {nested: [allowed]}\nstatus: PASS'));
    equal('unknown fields remain forward-compatible', checkPhaseClose(f).ok, true);
    fs.unlinkSync(f.auditPath);
    equal('missing AUDIT refusal', checkPhaseClose(f).reason, 'audit_missing');
    equal('invalid checker input exits 2', checkPhaseClose(null).exit_code, 2);
    put(f.auditPath, '---\nstatus: PASS\n---\n');
    put(f.summaryPath, '# body only\n');
    equal('checker CLI refusal exits 1', checkerCli(runCli, [
      '--project-dir', f.dir, '--planning-dir', f.planning,
      '--milestone', f.milestone, '--phase', f.phase,
    ]).status, 1);
    put(f.summaryPath, adaptedSummary(p154SummaryPath, f));
    equal('checker CLI pass exits 0', checkerCli(runCli, [
      '--project-dir', f.dir, '--planning-dir', f.planning,
      '--milestone', f.milestone, '--phase', f.phase,
    ]).status, 0);
    equal('checker CLI bad input exits 2', checkerCli(runCli, []).status, 2);
  } finally { f.cleanup(); }
}
function passingShapes() {
  const templates = [
    ['P154 SUMMARY shape', p154SummaryPath],
    ['P155 SUMMARY shape', p155SummaryPath],
  ];
  for (const [label, templatePath] of templates) {
    const f = fixture(label.toLowerCase().replace(/\W+/g, '-'));
    try {
      put(f.summaryPath, adaptedSummary(templatePath, f));
      const before = fs.readFileSync(f.statePath, 'utf8');
      const api = routeApi(f);
      equal(`${label} API schedules exactly one execution`, [
        api.result && api.result.ok,
        api.result && api.result.close_contract && api.result.close_contract.ok,
        api.result && api.result.executed_count,
        api.dispatches,
        api.stateAdvances,
      ], [true, true, 1, 1, 1]);
      check(`${label} consult remains read-only`, fs.readFileSync(f.statePath, 'utf8') === before);
      const cli = routeCli(f);
      check(`${label} production CLI exits 0`,
        !cli.child.error && cli.child.status === 0
          && cli.parsed && cli.parsed.ok === true
          && cli.parsed.close_contract && cli.parsed.close_contract.ok === true
          && cli.parsed.executed_count === 1,
        spawnDetail(cli));
    } finally { f.cleanup(); }
  }
}
if (requested === 'all' || requested === 'devcp-audit-without-summary') {
  devcpAuditWithoutSummary();
}
if (requested === 'all' || requested === 'passing-shapes') {
  checkerEdgeContracts();
  passingShapes();
}

console.log('---');
console.log(`phase_close_route_contract: ${passed}/${total} assertions passed`);
if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL ${failure}`));
  process.exit(1);
}
