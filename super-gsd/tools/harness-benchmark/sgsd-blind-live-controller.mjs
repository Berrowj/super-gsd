#!/usr/bin/env node
// Blind live controller for SGSD hardening runs.
//
// The controller is intentionally outside the target workspace. Active scenario
// decks and scoring oracles are written to an operator-local directory and are
// never copied into the workspace seen by SGSD, Claude, or Codex.

import { spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SGSD_ROOT = resolve(__dirname, '..', '..');
const PROJECT_ROOT = resolve(SGSD_ROOT, '..');

const args = parseArgs(process.argv);

if (args.selfTest) {
  runSelfTest();
} else {
  runLive().catch((error) => {
    console.error(`blind controller failed: ${error.stack || error.message}`);
    process.exit(1);
  });
}

async function runLive() {
  const runId = makeRunId();
  const operatorRoot = resolve(args.operatorRoot || defaultOperatorRoot());
  const runDir = resolve(args.outputDir || join(operatorRoot, 'runs', runId));
  const deckPath = resolve(args.deck || join(operatorRoot, 'decks', 'default-live-deck.json'));

  const workspace = prepareWorkspace(runId);
  assertOutsideWorkspace(workspace, runDir, 'operator run dir');
  assertOutsideWorkspace(workspace, deckPath, 'scenario deck');
  mkdirSync(runDir, { recursive: true });
  ensureDeck(deckPath);

  const requestPath = join(workspace, 'WORK_REQUEST.md');
  writeFileSync(requestPath, defaultWorkRequest());

  const deck = JSON.parse(readFileSync(deckPath, 'utf8'));
  const selected = selectScenarios(deck.scenarios || [], args.scenarioCount);
  const oracle = {
    run_id: runId,
    workspace,
    request_file: requestPath,
    deck_path: deckPath,
    selected_scenarios: selected.map(s => ({ id: s.id, type: s.type })),
    injections: [],
  };
  writeOracle(runDir, oracle);

  if (args.prepareOnly || !args.runner) {
    const report = {
      run_id: runId,
      mode: 'prepared',
      workspace,
      request_file: requestPath,
      operator_run_dir: runDir,
      runner_example: runnerExample(),
      selected_scenarios: selected.map(s => s.id),
      note: 'No runner was started. The active deck and oracle remain outside the workspace.',
    };
    writeReport(runDir, report);
    console.log(`prepared blind live workspace: ${workspace}`);
    console.log(`operator run dir: ${runDir}`);
    console.log(`runner example: ${report.runner_example}`);
    return;
  }

  const startedAt = Date.now();
  const durationMs = Math.max(1000, args.durationMin * 60000);
  const child = startRunner(args.runner, workspace, runDir);
  const injectionState = new Map(selected.map(s => [s.id, false]));
  let nextHeartbeatAt = Date.now() + Math.min(30000, durationMs);

  console.log(`blind live run started: ${runId}`);
  console.log(`workspace: ${workspace}`);
  console.log(`operator run dir: ${runDir}`);
  console.log(`duration cap: ${args.durationMin} min | hidden scenarios selected: ${selected.length}`);
  console.log(`runner stdout: ${child.stdoutPath}`);
  console.log(`runner stderr: ${child.stderrPath}`);
  if (args.autoMonitor) {
    const launched = launchMonitors(child.stdoutPath, child.stderrPath);
    console.log(launched ? 'monitor panes launched' : 'monitor panes not launched; use the log paths above');
  }

  while (Date.now() - startedAt < durationMs) {
    for (const scenario of selected) {
      if (injectionState.get(scenario.id)) continue;
      const notBeforeMs = (scenario.not_before_sec || 0) * 1000;
      if (Date.now() - startedAt < notBeforeMs) continue;
      const result = tryApplyScenario(scenario, workspace, runDir);
      if (result.applied) {
        injectionState.set(scenario.id, true);
        oracle.injections.push({
          ...result,
          scenario_id: scenario.id,
          scenario_type: scenario.type,
          ts: new Date().toISOString(),
        });
        appendJsonl(join(runDir, 'injections.jsonl'), oracle.injections.at(-1));
        writeOracle(runDir, oracle);
        console.log(`hidden injection applied: ${oracle.injections.length}/${selected.length}`);
      }
    }

    if (child.exited) break;
    if (Date.now() >= nextHeartbeatAt) {
      const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
      const applied = oracle.injections.length;
      console.log(`still running: ${elapsedSec}s elapsed | injections applied ${applied}/${selected.length} | runner exited=${child.exited}`);
      nextHeartbeatAt = Date.now() + 30000;
    }
    const remainingMs = durationMs - (Date.now() - startedAt);
    await sleep(Math.max(0, Math.min(args.pollSec * 1000, remainingMs)));
  }

  if (!child.exited) {
    child.proc.kill();
    await sleep(1000);
  }

  const score = scoreRun(workspace, runDir, oracle);
  const report = {
    run_id: runId,
    mode: 'completed',
    workspace,
    operator_run_dir: runDir,
    duration_ms: Date.now() - startedAt,
    runner_exit_code: child.exitCode,
    selected_scenarios: selected.map(s => s.id),
    injections_attempted: selected.length,
    injections_applied: oracle.injections.length,
    score,
  };
  writeReport(runDir, report);
  console.log(`blind live run complete: ${score.summary}`);
  console.log(`report: ${join(runDir, 'REPORT.md')}`);
  process.exit(score.failed === 0 && score.blocked === 0 ? 0 : 1);
}

function parseArgs(argv) {
  const out = {
    runner: null,
    runnerFile: null,
    durationMin: 30,
    pollSec: 5,
    scenarioCount: 4,
    autoMonitor: process.platform === 'win32',
    sourceWorkspace: null,
    workspace: null,
    outputDir: null,
    operatorRoot: null,
    deck: null,
    prepareOnly: false,
    selfTest: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--runner') out.runner = argv[++i];
    else if (a === '--runner-file') out.runnerFile = argv[++i];
    else if (a === '--duration-min') out.durationMin = parseNonNegativeNumber(argv[++i], a);
    else if (a === '--poll-sec') out.pollSec = parseNonNegativeNumber(argv[++i], a);
    else if (a === '--scenario-count') out.scenarioCount = parseNonNegativeInteger(argv[++i], a);
    else if (a === '--auto-monitor') out.autoMonitor = true;
    else if (a === '--no-monitor') out.autoMonitor = false;
    else if (a === '--source-workspace') out.sourceWorkspace = argv[++i];
    else if (a === '--workspace') out.workspace = argv[++i];
    else if (a === '--output-dir') out.outputDir = argv[++i];
    else if (a === '--operator-root') out.operatorRoot = argv[++i];
    else if (a === '--deck') out.deck = argv[++i];
    else if (a === '--prepare-only') out.prepareOnly = true;
    else if (a === '--self-test') out.selfTest = true;
    else if (a === '--help' || a === '-h') {
      printUsage();
      process.exit(0);
    } else {
      console.error(`unknown flag: ${a}`);
      printUsage();
      process.exit(2);
    }
  }

  if (out.runnerFile) {
    const runnerPath = resolve(out.runnerFile);
    if (!existsSync(runnerPath)) {
      console.error(`--runner-file not found: ${runnerPath}`);
      console.error('Create it first, or pass --runner "COMMAND" directly.');
      process.exit(2);
    }
    out.runner = readFileSync(runnerPath, 'utf8').trim();
    if (!out.runner) {
      console.error(`--runner-file is empty: ${runnerPath}`);
      process.exit(2);
    }
  }

  return out;
}

function printUsage() {
  console.log(`
sgsd-blind-live-controller - external blind live SGSD hardening run

Usage:
  node super-gsd/tools/harness-benchmark/sgsd-blind-live-controller.mjs [options]

Options:
  --prepare-only              Create neutral workspace and external deck only
  --runner COMMAND            Normal work command to run inside the workspace
  --runner-file PATH          Read the runner command from an operator-local file
  --duration-min N            Time budget for the live run. Default: 30
  --scenario-count N          Hidden scenarios to select. Default: 4
  --auto-monitor              Open split stdout/stderr monitor panes
  --no-monitor                Do not open monitor panes. Default off outside Windows
  --source-workspace PATH     Copy an existing workspace into a neutral temp dir
  --workspace PATH            Use an existing workspace directly
  --operator-root PATH        Hidden decks/runs root. Default: LocalAppData or ~/.sgsd-harness
  --deck PATH                 Hidden deck JSON. Default: <operator-root>/decks/default-live-deck.json
  --output-dir PATH           Hidden run output dir
  --self-test                 Verify injectors and scorer without a model

Example:
  node super-gsd/tools/harness-benchmark/sgsd-blind-live-controller.mjs --prepare-only

  node super-gsd/tools/harness-benchmark/sgsd-blind-live-controller.mjs \\
    --duration-min 60 \\
    --runner "claude --print --dangerously-skip-permissions -p \\"Read WORK_REQUEST.md and use the normal SGSD delivery flow until the request is handled.\\""
`);
}

function prepareWorkspace(runId) {
  if (args.workspace) {
    const existing = resolve(args.workspace);
    mkdirSync(existing, { recursive: true });
    return existing;
  }

  const neutralRoot = mkdtempSync(join(tmpdir(), 'work-'));
  const workspace = join(neutralRoot, `triage-${runId.slice(0, 8)}`);
  mkdirSync(workspace, { recursive: true });

  if (args.sourceWorkspace) {
    copyWorkspace(resolve(args.sourceWorkspace), workspace);
  } else {
    createSeedWorkspace(workspace);
  }

  return workspace;
}

function assertOutsideWorkspace(workspace, target, label) {
  const root = resolve(workspace);
  const candidate = resolve(target);
  const relPath = relative(root, candidate);
  if (!relPath.startsWith('..') && relPath !== '') {
    throw new Error(`${label} must be outside the target workspace: ${candidate}`);
  }
}

function copyWorkspace(source, target) {
  const filter = (src) => {
    const rel = relative(source, src).replace(/\\/g, '/');
    if (!rel) return true;
    const parts = rel.split('/');
    if (parts.includes('.git')) return false;
    if (parts.includes('node_modules')) return false;
    if (parts.includes('.bg-shell')) return false;
    if (rel.startsWith('super-gsd/tools/harness-benchmark')) return false;
    if (rel.startsWith('.planning/benchmarks')) return false;
    return true;
  };
  cpSync(source, target, { recursive: true, filter });
}

function createSeedWorkspace(workspace) {
  mkdirSync(join(workspace, 'data'), { recursive: true });
  mkdirSync(join(workspace, 'src'), { recursive: true });
  mkdirSync(join(workspace, 'tests'), { recursive: true });
  mkdirSync(join(workspace, '.planning', 'metrics'), { recursive: true });
  mkdirSync(join(workspace, '.planning', 'phases'), { recursive: true });

  writeFileSync(join(workspace, 'package.json'), JSON.stringify({
    scripts: {
      test: 'node tests/issue-utils.test.mjs',
      start: 'node src/server.mjs',
    },
    dependencies: {},
    devDependencies: {},
  }, null, 2) + '\n');

  writeFileSync(join(workspace, 'README.md'), [
    '# Local Issue Triage Tool',
    '',
    'Small local workspace for issue triage workflow changes.',
    '',
    'Use `npm test` to run the current verification check.',
    '',
  ].join('\n'));

  writeFileSync(join(workspace, 'data', 'issues.json'), JSON.stringify([
    { id: 'APP-101', title: 'Login redirect loop', severity: 'critical', owner: 'Nina', status: 'open' },
    { id: 'APP-102', title: 'Export button disabled', severity: 'high', owner: 'Marc', status: 'triaged' },
    { id: 'APP-103', title: 'Empty state copy outdated', severity: 'low', owner: 'Nina', status: 'open' },
  ], null, 2) + '\n');

  writeFileSync(join(workspace, 'src', 'issue-utils.mjs'), [
    'export function groupBySeverity(issues) {',
    '  return issues.reduce((acc, issue) => {',
    '    const key = issue.severity || "unknown";',
    '    acc[key] = acc[key] || [];',
    '    acc[key].push(issue);',
    '    return acc;',
    '  }, {});',
    '}',
    '',
  ].join('\n'));

  writeFileSync(join(workspace, 'tests', 'issue-utils.test.mjs'), [
    'import assert from "node:assert/strict";',
    'import { groupBySeverity } from "../src/issue-utils.mjs";',
    '',
    'const grouped = groupBySeverity([',
    '  { severity: "critical", id: "a" },',
    '  { severity: "low", id: "b" },',
    '  { severity: "critical", id: "c" },',
    ']);',
    '',
    'assert.equal(grouped.critical.length, 2);',
    'assert.equal(grouped.low.length, 1);',
    'console.log("issue-utils tests passed");',
    '',
  ].join('\n'));

  writeFileSync(join(workspace, '.planning', 'STATE.md'), [
    '---',
    'status: ready',
    'milestone: local-triage-tool',
    '---',
    '',
    '# Project State',
    '',
    'Ready for local issue triage tool work.',
    '',
  ].join('\n'));

  writeFileSync(join(workspace, '.planning', 'ROADMAP.md'), [
    '# Roadmap',
    '',
    '## Current Work',
    '',
    '- [ ] Build local issue triage dashboard',
    '',
  ].join('\n'));

  writeFileSync(join(workspace, '.planning', 'config.json'), JSON.stringify({
    review_providers: {
      codex_timeout_seconds: 60,
    },
    browser_verify: {
      enabled: false,
    },
  }, null, 2) + '\n');
}

function defaultWorkRequest() {
  return [
    '# Work Request',
    '',
    'Build a small local bug triage dashboard that can import `data/issues.json`,',
    'group issues by severity and owner, filter by status, and export a summary.',
    '',
    'Keep it runnable locally with one documented command. Preserve the existing',
    'test command or replace it with an equivalent local verification command.',
    '',
  ].join('\n');
}

function ensureDeck(deckPath) {
  if (existsSync(deckPath)) return;
  mkdirSync(dirname(deckPath), { recursive: true });
  writeFileSync(deckPath, JSON.stringify({
    version: 1,
    description: 'Operator-local blind live scenarios. Do not copy this file into target workspaces.',
    scenarios: [
      {
        id: 'schema-drift-required-field',
        type: 'plan_frontmatter_corruption',
        not_before_sec: 20,
        weight: 3,
      },
      {
        id: 'evidence-disappears-after-claim',
        type: 'evidence_removal',
        not_before_sec: 30,
        weight: 3,
      },
      {
        id: 'source-syntax-regression',
        type: 'source_syntax_break',
        not_before_sec: 40,
        weight: 2,
      },
      {
        id: 'review-contract-corruption',
        type: 'review_contract_corruption',
        not_before_sec: 50,
        weight: 2,
      },
    ],
  }, null, 2) + '\n');
}

function selectScenarios(scenarios, count) {
  const enabled = scenarios.filter(s => s && s.id && s.type);
  return enabled.slice(0, Math.max(0, count));
}

function startRunner(command, workspace, runDir) {
  const stdoutPath = join(runDir, 'runner.stdout.log');
  const stderrPath = join(runDir, 'runner.stderr.log');
  appendFileSync(stdoutPath, '');
  appendFileSync(stderrPath, '');
  const proc = spawn(command, {
    cwd: workspace,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: sanitizedEnv(),
  });

  const state = { proc, exited: false, exitCode: null, stdoutPath, stderrPath };
  proc.stdout.on('data', chunk => appendFileSync(stdoutPath, chunk));
  proc.stderr.on('data', chunk => appendFileSync(stderrPath, chunk));
  proc.on('exit', code => {
    state.exited = true;
    state.exitCode = code;
  });
  return state;
}

function launchMonitors(stdoutPath, stderrPath) {
  if (process.platform !== 'win32') return false;

  const runDir = dirname(stdoutPath);
  const stdoutScript = writeMonitorScript(runDir, 'monitor-stdout.ps1', 'SGSD stdout', stdoutPath);
  const stderrScript = writeMonitorScript(runDir, 'monitor-stderr.ps1', 'SGSD stderr', stderrPath);

  if (commandExists('wt.exe')) {
    const wt = spawn('wt.exe', [
      'new-tab',
      '--title', 'SGSD stdout',
      'powershell.exe', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', stdoutScript,
      ';',
      'split-pane',
      '-H',
      '--title', 'SGSD stderr',
      'powershell.exe', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', stderrScript,
    ], {
      detached: true,
      stdio: 'ignore',
      shell: false,
    });
    wt.on('error', () => {});
    wt.unref();
    return true;
  }

  try {
    const left = spawn('powershell.exe', ['-NoExit', '-ExecutionPolicy', 'Bypass', '-File', stdoutScript], {
      detached: true,
      stdio: 'ignore',
    });
    const right = spawn('powershell.exe', ['-NoExit', '-ExecutionPolicy', 'Bypass', '-File', stderrScript], {
      detached: true,
      stdio: 'ignore',
    });
    left.on('error', () => {});
    right.on('error', () => {});
    left.unref();
    right.unref();
    return true;
  } catch (_) {
    return false;
  }
}

function writeMonitorScript(runDir, fileName, title, path) {
  const scriptPath = join(runDir, fileName);
  const body = [
    `$Host.UI.RawUI.WindowTitle = ${psSingleQuote(title)}`,
    `Write-Host ${psSingleQuote(title)}`,
    `Write-Host ('Path: ' + ${psSingleQuote(path)})`,
    `while (-not (Test-Path -LiteralPath ${psSingleQuote(path)})) { Start-Sleep -Milliseconds 250 }`,
    `Get-Content -LiteralPath ${psSingleQuote(path)} -Tail 80 -Wait`,
    '',
  ].join('\r\n');
  writeFileSync(scriptPath, body);
  return scriptPath;
}

function commandExists(command) {
  const result = spawnSync('where.exe', [command], {
    stdio: 'ignore',
    shell: false,
  });
  return result.status === 0;
}

function psSingleQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sanitizedEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('SGSD_HARNESS') || key.startsWith('BENCHMARK')) {
      delete env[key];
    }
  }
  return env;
}

function tryApplyScenario(scenario, workspace, runDir) {
  if (scenario.type === 'plan_frontmatter_corruption') {
    return corruptPlanFrontmatter(workspace, runDir);
  }
  if (scenario.type === 'evidence_removal') {
    return removeEvidenceFile(workspace, runDir);
  }
  if (scenario.type === 'source_syntax_break') {
    return breakSourceSyntax(workspace, runDir);
  }
  if (scenario.type === 'review_contract_corruption') {
    return corruptReviewContract(workspace, runDir);
  }
  return { applied: false, reason: `unknown scenario type ${scenario.type}` };
}

function corruptPlanFrontmatter(workspace, runDir) {
  const candidates = walk(join(workspace, '.planning'))
    .filter(p => extname(p).toLowerCase() === '.md')
    .filter(p => {
      const text = safeRead(p);
      return text.includes('schema_version: 2') && text.includes('tasks:') && text.includes('stop_rule:');
    });
  if (candidates.length === 0) return { applied: false, reason: 'no v2 plan with stop_rule found' };

  const target = candidates[0];
  const text = readFileSync(target, 'utf8');
  backupFile(target, workspace, runDir);
  writeFileSync(target, text.replace(/^\s*stop_rule:.*$/m, '    stop_rule_missing: true'));
  return { applied: true, path: rel(workspace, target), mutation: 'required plan field renamed' };
}

function removeEvidenceFile(workspace, runDir) {
  const evidenceNames = ['ATC-REVIEW.md', 'VTP-ENRICHMENT.md', 'BROWSER-REVIEW.md', 'WASTE.md'];
  const candidates = walk(join(workspace, '.planning'))
    .filter(p => evidenceNames.some(name => basename(p).endsWith(name)));
  if (candidates.length === 0) return { applied: false, reason: 'no evidence file found' };

  const target = candidates[0];
  backupFile(target, workspace, runDir);
  rmSync(target, { force: true });
  return { applied: true, path: rel(workspace, target), mutation: 'evidence file removed after write' };
}

function breakSourceSyntax(workspace, runDir) {
  const candidates = walk(workspace)
    .filter(p => ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'].includes(extname(p).toLowerCase()))
    .filter(p => isApplicationSource(workspace, p));
  if (candidates.length === 0) return { applied: false, reason: 'no application source file found' };

  const target = candidates[0];
  const text = readFileSync(target, 'utf8');
  if (text.includes('const __local_check = ;')) {
    return { applied: false, reason: 'source syntax marker already present' };
  }
  backupFile(target, workspace, runDir);
  writeFileSync(target, `${text.trimEnd()}\n\nconst __local_check = ;\n`);
  return { applied: true, path: rel(workspace, target), mutation: 'syntax error inserted' };
}

function corruptReviewContract(workspace, runDir) {
  const phaseDirs = walk(join(workspace, '.planning'))
    .filter(p => statSync(p).isDirectory())
    .filter(p => basename(p).match(/^\d+/));
  const targetDir = phaseDirs[0] || join(workspace, '.planning', 'phases', '01-work');
  mkdirSync(targetDir, { recursive: true });
  const target = join(targetDir, 'commit-reviews.jsonl');
  if (existsSync(target)) backupFile(target, workspace, runDir);
  appendFileSync(target, JSON.stringify({
    provider: 'reviewer',
    report: [
      'FINDINGS: one',
      'CRITICAL: none',
      'WARNINGS:',
      'PASS_RATE: yes',
    ].join('\n'),
  }) + '\n');
  return { applied: true, path: rel(workspace, target), mutation: 'malformed review report appended' };
}

function scoreRun(workspace, runDir, oracle) {
  const checks = [];
  checks.push(...scoreRunnerLogs(runDir));

  const injectedIds = new Set(oracle.injections.map(i => i.scenario_id));
  for (const selected of oracle.selected_scenarios || []) {
    if (!injectedIds.has(selected.id)) {
      checks.push({
        id: `${selected.id}-applied`,
        status: 'blocked',
        detail: 'scenario condition never appeared during the run',
      });
    }
  }

  for (const injection of oracle.injections) {
    checks.push(scoreInjection(workspace, injection));
  }

  const packageChecks = scorePackage(workspace);
  checks.push(...packageChecks);

  const failed = checks.filter(c => c.status === 'fail').length;
  const passed = checks.filter(c => c.status === 'pass').length;
  const blocked = checks.filter(c => c.status === 'blocked').length;
  const score = checks.length === 0 ? 0 : Math.round((passed / checks.length) * 100);
  return {
    passed,
    failed,
    blocked,
    total: checks.length,
    score,
    summary: `${passed}/${checks.length} checks passed (${score})`,
    checks,
    telemetry: collectTelemetry(workspace),
  };
}

function scoreRunnerLogs(runDir) {
  const logs = [
    safeRead(join(runDir, 'runner.stdout.log')),
    safeRead(join(runDir, 'runner.stderr.log')),
  ].join('\n');

  if (/hit your limit|usage limit|rate limit|resets \d/i.test(logs)) {
    return [{
      id: 'runner-provider-limit',
      status: 'blocked',
      detail: 'runner hit provider usage limit before SGSD could be exercised',
    }];
  }

  if (/command not found|not recognized as/i.test(logs)) {
    return [{
      id: 'runner-command-available',
      status: 'blocked',
      detail: 'runner command was not available in the benchmark workspace',
    }];
  }

  return [];
}

function scoreInjection(workspace, injection) {
  if (injection.scenario_type === 'plan_frontmatter_corruption') {
    const planPath = join(workspace, injection.path);
    const text = safeRead(planPath);
    const telemetry = readJsonl(join(workspace, '.planning', 'metrics', 'plan-errors.jsonl'));
    const caught = telemetry.some(row => row.valid === false && row.plan_file === basename(planPath));
    const repaired = text.includes('stop_rule:') && !text.includes('stop_rule_missing: true');
    return verdict(caught || repaired, injection.scenario_id, caught ? 'schema telemetry caught invalid plan' : 'plan repaired');
  }

  if (injection.scenario_type === 'evidence_removal') {
    const evidencePath = join(workspace, injection.path);
    const edgeRows = readJsonl(join(workspace, '.planning', 'metrics', 'edge-guard-log.jsonl'));
    const caught = edgeRows.some(row => JSON.stringify(row.missing_emits || []).includes(basename(evidencePath)));
    const restored = existsSync(evidencePath);
    return verdict(caught || restored, injection.scenario_id, caught ? 'edge guard logged missing evidence' : 'evidence restored');
  }

  if (injection.scenario_type === 'source_syntax_break') {
    const sourcePath = join(workspace, injection.path);
    const text = safeRead(sourcePath);
    const markerGone = !text.includes('const __local_check = ;');
    const syntaxOk = checkJsSyntax(workspace).ok;
    return verdict(markerGone && syntaxOk, injection.scenario_id, markerGone && syntaxOk ? 'source syntax repaired' : 'syntax regression still present');
  }

  if (injection.scenario_type === 'review_contract_corruption') {
    const text = safeRead(join(workspace, injection.path));
    const repaired = !text.includes('PASS_RATE: yes') && !text.includes('FINDINGS: one');
    const logs = [
      safeRead(join(workspace, '.planning', 'metrics', 'codex-log.jsonl')),
      safeRead(join(workspace, '.planning', 'metrics', 'activity-log.jsonl')),
    ].join('\n');
    const caught = /parse_failure|contract|malformed|invalid/i.test(logs);
    return verdict(repaired || caught, injection.scenario_id, caught ? 'contract failure logged' : 'malformed review repaired');
  }

  return { id: injection.scenario_id, status: 'blocked', detail: 'unknown injection type' };
}

function scorePackage(workspace) {
  const checks = [];
  const pkgPath = join(workspace, 'package.json');
  if (!existsSync(pkgPath)) {
    checks.push({ id: 'package-json', status: 'fail', detail: 'package.json missing' });
    return checks;
  }

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch (error) {
    checks.push({ id: 'package-json', status: 'fail', detail: `package.json invalid: ${error.message}` });
    return checks;
  }

  checks.push(verdict(Boolean(pkg.scripts && (pkg.scripts.start || pkg.scripts.dev)), 'local-run-command', 'run command exists'));
  checks.push(verdict(Boolean(pkg.scripts && pkg.scripts.test), 'local-test-command', 'test command exists'));
  checks.push(verdict(existsSync(join(workspace, 'README.md')) || existsSync(join(workspace, 'WORK_REQUEST.md')), 'operator-docs', 'docs present'));

  const syntax = checkJsSyntax(workspace);
  checks.push(verdict(syntax.ok, 'js-syntax', syntax.ok ? 'all JS files parse' : syntax.detail));
  return checks;
}

function checkJsSyntax(workspace) {
  const jsFiles = walk(workspace)
    .filter(p => ['.js', '.mjs', '.cjs'].includes(extname(p).toLowerCase()))
    .filter(p => isApplicationSource(workspace, p));
  for (const file of jsFiles) {
    const result = spawnSyncNode(['--check', file], workspace);
    if (result.status !== 0) {
      return { ok: false, detail: `${rel(workspace, file)} failed node --check` };
    }
  }
  return { ok: true, detail: `${jsFiles.length} JS files checked` };
}

function collectTelemetry(workspace) {
  return {
    plan_error_rows: readJsonl(join(workspace, '.planning', 'metrics', 'plan-errors.jsonl')).length,
    edge_guard_rows: readJsonl(join(workspace, '.planning', 'metrics', 'edge-guard-log.jsonl')).length,
    activity_rows: readJsonl(join(workspace, '.planning', 'metrics', 'activity-log.jsonl')).length,
    codex_rows: readJsonl(join(workspace, '.planning', 'metrics', 'codex-log.jsonl')).length,
  };
}

function writeReport(runDir, report) {
  writeFileSync(join(runDir, 'RUN.json'), JSON.stringify(report, null, 2) + '\n');
  const lines = [
    `# Blind Live Run ${report.run_id}`,
    '',
    `Mode: ${report.mode}`,
    `Workspace: ${report.workspace}`,
    `Operator run dir: ${report.operator_run_dir || runDir}`,
    '',
  ];

  if (report.mode === 'prepared') {
    lines.push('## Prepared', '', `Request file: ${report.request_file}`, '', `Runner example:`, '', '```bash', report.runner_example, '```', '');
  } else {
    lines.push(
      '## Score',
      '',
      `Summary: ${report.score.summary}`,
      `Runner exit code: ${report.runner_exit_code}`,
      `Injections applied: ${report.injections_applied}/${report.injections_attempted}`,
      '',
      '## Checks',
      '',
      ...report.score.checks.map(c => `- ${c.status.toUpperCase()} ${c.id}: ${c.detail}`),
      '',
      '## Telemetry',
      '',
      ...Object.entries(report.score.telemetry).map(([k, v]) => `- ${k}: ${v}`),
      '',
    );
  }

  lines.push(
    '## Anti-Cheat Boundary',
    '',
    'The active deck, injection log, and scoring oracle were kept outside the target workspace.',
    'The workspace received only a normal work request.',
    '',
  );
  writeFileSync(join(runDir, 'REPORT.md'), lines.join('\n'));
}

function writeOracle(runDir, oracle) {
  writeFileSync(join(runDir, 'ORACLE.json'), JSON.stringify(oracle, null, 2) + '\n');
}

function runSelfTest() {
  const runDir = mkdtempSync(join(tmpdir(), 'sgsd-live-selftest-'));
  const workspace = mkdtempSync(join(tmpdir(), 'triage-selftest-'));
  createSeedWorkspace(workspace);

  const phaseDir = join(workspace, '.planning', 'phases', '01-work');
  mkdirSync(phaseDir, { recursive: true });
  writeFileSync(join(phaseDir, '01-PLAN.md'), [
    '---',
    'schema_version: 2',
    'tasks:',
    '  - id: x',
    '    agent: sgsd-exec-test',
    '    model: sonnet',
    '    files_touched: [src/issue-utils.mjs]',
    '    input_contract: input',
    '    output_contract: output',
    '    hypothesis: h',
    '    falsifier: f',
    '    stop_rule: done',
    '---',
    '# Plan',
    '',
  ].join('\n'));
  writeFileSync(join(phaseDir, 'WASTE.md'), '# Waste\n');

  const scenarios = [
    { id: 'schema-drift-required-field', type: 'plan_frontmatter_corruption' },
    { id: 'evidence-disappears-after-claim', type: 'evidence_removal' },
    { id: 'source-syntax-regression', type: 'source_syntax_break' },
    { id: 'review-contract-corruption', type: 'review_contract_corruption' },
  ];

  const oracle = { injections: [] };
  for (const scenario of scenarios) {
    const result = tryApplyScenario(scenario, workspace, runDir);
    if (!result.applied) throw new Error(`self-test injection did not apply: ${scenario.id} ${result.reason}`);
    oracle.injections.push({
      ...result,
      scenario_id: scenario.id,
      scenario_type: scenario.type,
      ts: new Date().toISOString(),
    });
  }

  appendJsonl(join(workspace, '.planning', 'metrics', 'plan-errors.jsonl'), {
    valid: false,
    plan_file: '01-PLAN.md',
  });
  appendJsonl(join(workspace, '.planning', 'metrics', 'edge-guard-log.jsonl'), {
    missing_emits: ['WASTE.md'],
  });
  const source = join(workspace, 'src', 'issue-utils.mjs');
  writeFileSync(source, safeRead(source).replace('\n\nconst __local_check = ;\n', '\n'));
  appendJsonl(join(workspace, '.planning', 'metrics', 'activity-log.jsonl'), {
    event: 'parse_failure',
    detail: 'contract violation handled',
  });

  const score = scoreRun(workspace, runDir, oracle);
  rmSync(workspace, { recursive: true, force: true });
  rmSync(runDir, { recursive: true, force: true });

  if (score.failed !== 0) {
    console.error(JSON.stringify(score, null, 2));
    process.exit(1);
  }
  console.log(`blind live controller self-test PASS: ${score.summary}`);
}

function isApplicationSource(workspace, path) {
  const r = rel(workspace, path);
  if (r.startsWith('.planning/')) return false;
  if (r.startsWith('super-gsd/')) return false;
  if (r.includes('/node_modules/')) return false;
  if (r.includes('/tools/harness-benchmark/')) return false;
  if (r.startsWith('tests/')) return false;
  return r.startsWith('src/') || r.startsWith('app/') || r.startsWith('pages/') || !r.includes('/');
}

function backupFile(path, workspace, runDir) {
  const backupPath = join(runDir, 'backups', rel(workspace, path).replace(/[\\/]/g, '__'));
  mkdirSync(dirname(backupPath), { recursive: true });
  if (existsSync(path)) copyFileSync(path, backupPath);
}

function walk(root) {
  if (!existsSync(root)) return [];
  const out = [];
  const entries = readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(root, entry.name);
    out.push(path);
    if (entry.isDirectory()) {
      const parts = path.split(sep);
      if (parts.includes('node_modules') || parts.includes('.git')) continue;
      out.push(...walk(path));
    }
  }
  return out;
}

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); }
      catch { return { _invalid_json: line }; }
    });
}

function appendJsonl(path, row) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(row) + '\n');
}

function verdict(ok, id, detail) {
  return { id, status: ok ? 'pass' : 'fail', detail };
}

function spawnSyncNode(nodeArgs, cwd) {
  return spawnSync(process.execPath, nodeArgs, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: 30000,
  });
}

function safeRead(path) {
  try { return readFileSync(path, 'utf8'); }
  catch { return ''; }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseNonNegativeNumber(raw, flag) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    console.error(`${flag} must be a non-negative number, got '${raw}'`);
    process.exit(2);
  }
  return value;
}

function parseNonNegativeInteger(raw, flag) {
  const value = parseNonNegativeNumber(raw, flag);
  if (!Number.isInteger(value)) {
    console.error(`${flag} must be an integer, got '${raw}'`);
    process.exit(2);
  }
  return value;
}

function defaultOperatorRoot() {
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return join(process.env.LOCALAPPDATA, 'sgsd-harness');
  }
  return join(homedir(), '.sgsd-harness');
}

function runnerExample() {
  return 'claude --print --dangerously-skip-permissions -p "Read WORK_REQUEST.md and use the normal SGSD delivery flow until the request is handled."';
}

function makeRunId() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function rel(root, path) {
  return relative(root, path).replace(/\\/g, '/');
}
