#!/usr/bin/env node
// ============================================================================
// SGSD - Double-Agent Executor
// ============================================================================
// Routes one execution task capsule to local-script, Codex, or Claude and logs
// the decision to the existing route-ledger boundary `execution_route`.
//
// Design contract:
// - Task capsules are the execution surface; no broad raw context by default.
// - Codex execution is separate from codex-exec.sh, which remains read-only
//   review/ATC infrastructure.
// - Live Codex execution uses a git worktree sandbox, checks changed files
//   against allowed_files, runs acceptance commands, and writes a patch/report.
// - The CLI never blocks autonomy on routing failure; it emits a Claude
//   handoff/fallback decision.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const routeLedger = require('../../scripts/lib/route-ledger.cjs');
const providerHealth = require('../provider-health/check.cjs');

const SCHEMA_VERSION = 1;
const COMMAND_NAME = 'doubleAgentExecutor';

const ROLES = Object.freeze([
  'researcher', 'planner', 'executor', 'verifier',
  'reviewer', 'orchestrator', 'classifier', 'other',
]);

const TASK_KINDS = Object.freeze([
  'extraction', 'inventory', 'code_edit', 'refactor', 'test_repair',
  'schema_config', 'docs', 'review', 'planning', 'verification',
  'synthesis', 'general',
]);

const RISKS = Object.freeze(['low', 'medium', 'high']);
const AMBIGUITY = Object.freeze(['low', 'medium', 'high']);
const PROVIDERS = Object.freeze(['local-script', 'codex', 'claude']);

const CODEX_TASK_KINDS = Object.freeze([
  'code_edit', 'refactor', 'test_repair', 'schema_config',
]);

const CLAUDE_TASK_KINDS = Object.freeze([
  'planning', 'synthesis',
]);

const LOCAL_TASK_KINDS = Object.freeze([
  'extraction', 'inventory',
]);

function repoRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function defaultPlanningDir() {
  return path.join(repoRoot(), '.planning');
}

function nowIso() {
  return new Date().toISOString();
}

function shortId() {
  return crypto.randomBytes(3).toString('hex');
}

function slash(p) {
  return String(p || '').replace(/\\/g, '/');
}

function isSafeRelativePath(p) {
  if (typeof p !== 'string' || !p.trim()) return false;
  if (path.isAbsolute(p)) return false;
  const s = slash(p.trim());
  if (s.startsWith('../') || s.includes('/../') || s === '..') return false;
  if (s.startsWith('~')) return false;
  if (/[<>:"|?*]/.test(s)) return false;
  return true;
}

function uniq(xs) {
  return Array.from(new Set((xs || []).filter((x) => x !== undefined && x !== null).map(String)));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateCapsule(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') errors.push('capsule must be an object');
  const c = raw || {};
  if (c.schema_version !== SCHEMA_VERSION) errors.push('schema_version must be 1');
  if (!c.task_id || typeof c.task_id !== 'string') errors.push('task_id required');
  if (!c.goal || typeof c.goal !== 'string') errors.push('goal required');
  if (!ROLES.includes(c.role)) errors.push('role must be one of ' + ROLES.join(', '));
  if (!TASK_KINDS.includes(c.task_kind)) errors.push('task_kind must be one of ' + TASK_KINDS.join(', '));
  if (!RISKS.includes(c.risk)) errors.push('risk must be one of low, medium, high');
  if (c.ambiguity !== undefined && !AMBIGUITY.includes(c.ambiguity)) {
    errors.push('ambiguity must be one of low, medium, high');
  }
  if (!Array.isArray(c.allowed_files)) errors.push('allowed_files must be an array');
  for (const f of c.allowed_files || []) {
    if (!isSafeRelativePath(f)) errors.push('allowed_files contains unsafe path: ' + f);
  }
  for (const f of c.forbidden_files || []) {
    if (!isSafeRelativePath(f)) errors.push('forbidden_files contains unsafe path: ' + f);
  }
  for (const n of ['estimated_line_count', 'max_input_tokens', 'max_output_tokens']) {
    if (c[n] !== undefined && (typeof c[n] !== 'number' || c[n] < 0)) {
      errors.push(n + ' must be a non-negative number');
    }
  }
  if (c.local_command !== undefined && c.local_command !== null && typeof c.local_command !== 'string') {
    errors.push('local_command must be a string or null');
  }
  if (c.acceptance_commands !== undefined && !Array.isArray(c.acceptance_commands)) {
    errors.push('acceptance_commands must be an array');
  }
  for (const cmd of c.acceptance_commands || []) {
    if (typeof cmd !== 'string' || !cmd.trim()) errors.push('acceptance_commands contains empty command');
  }
  return { ok: errors.length === 0, errors };
}

function normalizeCapsule(raw) {
  const check = validateCapsule(raw);
  if (!check.ok) {
    const err = new Error('invalid task capsule: ' + check.errors.join('; '));
    err.errors = check.errors;
    throw err;
  }
  const c = Object.assign({}, raw);
  c.allowed_files = uniq(c.allowed_files).map(slash);
  c.forbidden_files = uniq(c.forbidden_files || []).map(slash);
  c.acceptance_commands = uniq(c.acceptance_commands || []);
  c.ambiguity = c.ambiguity || 'medium';
  c.requires_private_knowledge = !!c.requires_private_knowledge;
  c.deterministic = !!c.deterministic;
  c.estimated_line_count = Number(c.estimated_line_count || 0);
  c.max_input_tokens = Number(c.max_input_tokens || 8000);
  c.max_output_tokens = Number(c.max_output_tokens || 2000);
  c.phase = c.phase === undefined ? null : String(c.phase);
  c.milestone = c.milestone === undefined ? null : c.milestone;
  c.plan = c.plan === undefined ? null : c.plan;
  return c;
}

function codexHealth(opts) {
  const o = opts || {};
  if (o.forceCodexHealth === true) return { healthy: true, reason: 'forced_true' };
  if (o.forceCodexHealth === false) return { healthy: false, reason: 'forced_false' };
  try {
    const r = providerHealth.probeCodexLoginStatus();
    return {
      healthy: !!r.available,
      reason: r.available ? 'codex_login_status' : 'codex_login_status_failed',
      command_exit: r.command_exit,
      stderr_excerpt: r.stderr_excerpt || '',
    };
  } catch (e) {
    return { healthy: false, reason: 'provider_health_exception', error: e.message };
  }
}

function hasMechanicalAcceptance(capsule) {
  return capsule.acceptance_commands.length > 0;
}

function isCodexBounded(capsule) {
  return CODEX_TASK_KINDS.includes(capsule.task_kind)
    && capsule.role === 'executor'
    && capsule.allowed_files.length > 0
    && capsule.allowed_files.length <= 6
    && capsule.estimated_line_count <= 400
    && capsule.risk !== 'high'
    && capsule.ambiguity !== 'high'
    && !capsule.requires_private_knowledge
    && hasMechanicalAcceptance(capsule);
}

function routeCapsule(rawCapsule, opts) {
  const capsule = normalizeCapsule(rawCapsule);
  const o = opts || {};
  const health = { codex: codexHealth(o) };
  const reason_codes = [];
  let provider = 'claude';
  let primary = 'claude';
  let fallback_used = false;
  let fallback_reason = null;
  let route_class = 'claude_judgment';

  if (capsule.deterministic || LOCAL_TASK_KINDS.includes(capsule.task_kind)) {
    primary = 'local-script';
    provider = capsule.local_command ? 'local-script' : 'claude';
    fallback_used = !capsule.local_command;
    fallback_reason = capsule.local_command ? null : 'local_command_missing';
    route_class = 'deterministic_local';
    reason_codes.push(capsule.local_command ? 'local_script_primary_deterministic' : 'local_script_missing_fallback_claude');
  } else if (CLAUDE_TASK_KINDS.includes(capsule.task_kind)
      || capsule.risk === 'high'
      || capsule.ambiguity === 'high'
      || capsule.requires_private_knowledge) {
    primary = 'claude';
    provider = 'claude';
    route_class = 'claude_required';
    reason_codes.push('claude_primary_judgment_required');
  } else if (isCodexBounded(capsule)) {
    primary = 'codex';
    if (health.codex.healthy) {
      provider = 'codex';
      route_class = 'codex_bounded_execution';
      reason_codes.push('codex_primary_bounded_task');
    } else {
      provider = 'claude';
      fallback_used = true;
      fallback_reason = 'provider_codex_unavailable';
      route_class = 'codex_unavailable_fallback';
      reason_codes.push('codex_unhealthy_fallback_claude');
    }
  } else if (capsule.task_kind === 'review') {
    primary = 'codex';
    if (health.codex.healthy) {
      provider = 'codex';
      route_class = 'codex_review';
      reason_codes.push('codex_primary_review');
    } else {
      provider = 'claude';
      fallback_used = true;
      fallback_reason = 'provider_codex_unavailable';
      route_class = 'codex_review_fallback';
      reason_codes.push('codex_unhealthy_fallback_claude');
    }
  } else {
    primary = 'claude';
    provider = 'claude';
    route_class = 'claude_default';
    reason_codes.push('claude_primary_unbounded_or_no_tests');
  }

  return {
    schema_version: 1,
    command: COMMAND_NAME,
    ts: nowIso(),
    task_id: capsule.task_id,
    route_class,
    primary_provider: primary,
    chosen_provider: provider,
    fallback_used,
    fallback_reason,
    reason_codes,
    candidate_providers: candidateProviders(capsule),
    health,
    budget: {
      max_input_tokens: capsule.max_input_tokens,
      max_output_tokens: capsule.max_output_tokens,
      estimated_line_count: capsule.estimated_line_count,
    },
    capsule,
  };
}

function candidateProviders(capsule) {
  const out = [];
  if (capsule.local_command || LOCAL_TASK_KINDS.includes(capsule.task_kind)) out.push('local-script');
  if (CODEX_TASK_KINDS.includes(capsule.task_kind) || capsule.task_kind === 'review') out.push('codex');
  out.push('claude');
  return uniq(out).filter((p) => PROVIDERS.includes(p));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function artifactDir(planningDir) {
  const dir = path.join(planningDir, 'artifacts', 'double-agent-executor');
  ensureDir(dir);
  return dir;
}

function shellRun(command, cwd, timeoutMs) {
  const started = Date.now();
  const r = spawnSync(command, {
    cwd,
    shell: true,
    encoding: 'utf8',
    timeout: timeoutMs || 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    command,
    exit: r.status === null || r.status === undefined ? -1 : r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    duration_ms: Date.now() - started,
    timed_out: !!r.error && /timed out/i.test(r.error.message || ''),
    error: r.error ? r.error.message : null,
  };
}

function git(args, cwd, opts) {
  const r = spawnSync('git', args, {
    cwd,
    shell: process.platform === 'win32',
    encoding: 'utf8',
    timeout: (opts && opts.timeoutMs) || 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    exit: r.status === null || r.status === undefined ? -1 : r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    error: r.error ? r.error.message : null,
  };
}

function buildCodexPrompt(capsule) {
  return [
    'You are SGSD Codex Task Executor.',
    '',
    'Execute the task exactly as described in this capsule.',
    'Hard constraints:',
    '- Edit only files listed in allowed_files.',
    '- Do not edit forbidden_files.',
    '- Do not perform network calls.',
    '- Do not commit.',
    '- Keep the patch surgical.',
    '- If the task cannot be completed within the capsule, explain why and stop.',
    '',
    'Required final report format:',
    'FILES_CHANGED: comma-separated paths or none',
    'TESTS_RUN: commands run or none',
    'STATUS: success|partial|blocked',
    'ONE_LINER: one sentence summary',
    '',
    'TASK_CAPSULE_JSON:',
    JSON.stringify(capsule, null, 2),
    '',
  ].join('\n');
}

function changedFiles(worktreeDir) {
  const r = git(['-C', worktreeDir, 'diff', '--name-only'], repoRoot());
  if (r.exit !== 0) return { ok: false, files: [], error: r.stderr || r.error || 'git diff failed' };
  return {
    ok: true,
    files: r.stdout.split(/\r?\n/).map((x) => slash(x.trim())).filter(Boolean),
  };
}

function outOfScopeFiles(files, capsule) {
  const allowed = new Set(capsule.allowed_files.map(slash));
  const forbidden = new Set(capsule.forbidden_files.map(slash));
  return files.filter((f) => !allowed.has(slash(f)) || forbidden.has(slash(f)));
}

function runAcceptance(capsule, cwd) {
  const results = [];
  for (const command of capsule.acceptance_commands) {
    const r = shellRun(command, cwd, 180000);
    results.push({
      command,
      exit: r.exit,
      duration_ms: r.duration_ms,
      stdout_excerpt: r.stdout.slice(-1000),
      stderr_excerpt: r.stderr.slice(-1000),
      timed_out: r.timed_out,
      error: r.error,
    });
    if (r.exit !== 0) break;
  }
  return {
    passed: results.length === capsule.acceptance_commands.length
      && results.every((r) => r.exit === 0),
    results,
  };
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function executeCodex(capsule, decision, opts) {
  const o = opts || {};
  const projectDir = o.projectDir || repoRoot();
  const planningDir = o.planningDir || defaultPlanningDir();
  const outDir = artifactDir(planningDir);
  const runId = `${capsule.task_id}-${shortId()}`;
  const reportPath = path.join(outDir, `${runId}.report.json`);
  const patchPath = path.join(outDir, `${runId}.patch`);
  const worktreeParent = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-codex-task-'));
  const worktreeDir = path.join(worktreeParent, 'worktree');
  const started = Date.now();
  const prompt = buildCodexPrompt(capsule);
  const report = {
    schema_version: 1,
    ts: nowIso(),
    task_id: capsule.task_id,
    provider: 'codex',
    status: 'error',
    worktree_dir: worktreeDir,
    patch_path: patchPath,
    route: decision,
    codex: null,
    changed_files: [],
    out_of_scope_files: [],
    acceptance: null,
    applied: false,
    _started_ms: started,
    duration_ms: null,
  };

  try {
    const add = git(['worktree', 'add', '--detach', worktreeDir, 'HEAD'], projectDir, { timeoutMs: 120000 });
    if (add.exit !== 0) {
      report.status = 'worktree_failed';
      report.error = add.stderr || add.error || 'git worktree add failed';
      return finishExecutionReport(report, reportPath, planningDir, capsule, decision);
    }

    const args = [
      'exec',
      '--model', o.model || process.env.SGSD_CODEX_EXEC_MODEL || 'gpt-5.5',
      '-c', `model_reasoning_effort="${o.reasoningEffort || process.env.SGSD_CODEX_EXEC_EFFORT || 'xhigh'}"`,
      '--sandbox', 'workspace-write',
      '--ephemeral',
      '--skip-git-repo-check',
      '--cd', worktreeDir,
      '-',
    ];
    const codexStarted = Date.now();
    const cr = spawnSync('codex', args, {
      cwd: worktreeDir,
      input: prompt,
      shell: process.platform === 'win32',
      encoding: 'utf8',
      timeout: o.timeoutMs || 600000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    report.codex = {
      exit: cr.status === null || cr.status === undefined ? -1 : cr.status,
      duration_ms: Date.now() - codexStarted,
      prompt_bytes: Buffer.byteLength(prompt, 'utf8'),
      stdout_bytes: Buffer.byteLength(cr.stdout || '', 'utf8'),
      stderr_excerpt: (cr.stderr || '').slice(-1000),
      stdout_excerpt: (cr.stdout || '').slice(-2000),
      error: cr.error ? cr.error.message : null,
      timed_out: !!cr.error && /timed out/i.test(cr.error.message || ''),
    };

    const cf = changedFiles(worktreeDir);
    report.changed_files = cf.files;
    report.out_of_scope_files = cf.ok ? outOfScopeFiles(cf.files, capsule) : [];

    const diff = git(['-C', worktreeDir, 'diff', '--binary'], projectDir, { timeoutMs: 120000 });
    if (diff.exit === 0 && diff.stdout.trim()) {
      fs.writeFileSync(patchPath, diff.stdout, 'utf8');
    }

    if (report.codex.exit !== 0) {
      report.status = report.codex.timed_out ? 'timeout' : 'codex_failed';
    } else if (report.out_of_scope_files.length > 0) {
      report.status = 'scope_violation';
    } else {
      report.acceptance = runAcceptance(capsule, worktreeDir);
      if (!report.acceptance.passed) {
        report.status = 'tests_failed';
      } else if (o.apply && fs.existsSync(patchPath) && fs.statSync(patchPath).size > 0) {
        const apply = git(['apply', '--whitespace=nowarn', patchPath], projectDir, { timeoutMs: 120000 });
        report.applied = apply.exit === 0;
        report.apply_error = apply.exit === 0 ? null : (apply.stderr || apply.error);
        report.status = apply.exit === 0 ? 'accepted_applied' : 'apply_failed';
      } else {
        report.status = 'accepted_patch_written';
      }
    }
    return finishExecutionReport(report, reportPath, planningDir, capsule, decision);
  } finally {
    if (!o.keepWorktree) {
      try { git(['worktree', 'remove', '--force', worktreeDir], projectDir, { timeoutMs: 120000 }); } catch (_) {}
      try { fs.rmSync(worktreeParent, { recursive: true, force: true }); } catch (_) {}
    }
  }
}

function finishExecutionReport(report, reportPath, planningDir, capsule, decision) {
  if (typeof report.duration_ms !== 'number') {
    report.duration_ms = typeof report._started_ms === 'number' ? Date.now() - report._started_ms : 0;
  }
  delete report._started_ms;
  writeJson(reportPath, report);
  logExecutionRoute(planningDir, capsule, decision, {
    status: report.status,
    report_path: reportPath,
    patch_path: report.patch_path,
    changed_files: report.changed_files || [],
    out_of_scope_files: report.out_of_scope_files || [],
    tests_passed: !!(report.acceptance && report.acceptance.passed),
    accepted: report.status === 'accepted_patch_written' || report.status === 'accepted_applied',
    applied: !!report.applied,
    duration_ms: report.duration_ms,
    token_estimate: {
      prompt_bytes: report.codex ? report.codex.prompt_bytes : 0,
      stdout_bytes: report.codex ? report.codex.stdout_bytes : 0,
      total_estimated_tokens: report.codex
        ? Math.ceil((report.codex.prompt_bytes + report.codex.stdout_bytes) / 4)
        : 0,
    },
  });
  return report;
}

function executeLocal(capsule, decision, opts) {
  const o = opts || {};
  const planningDir = o.planningDir || defaultPlanningDir();
  const projectDir = o.projectDir || repoRoot();
  const outDir = artifactDir(planningDir);
  const reportPath = path.join(outDir, `${capsule.task_id}-${shortId()}.report.json`);
  const r = shellRun(capsule.local_command, projectDir, o.timeoutMs || 180000);
  const accepted = r.exit === 0;
  const report = {
    schema_version: 1,
    ts: nowIso(),
    task_id: capsule.task_id,
    provider: 'local-script',
    status: accepted ? 'accepted' : 'local_failed',
    command: capsule.local_command,
    exit: r.exit,
    duration_ms: r.duration_ms,
    stdout_excerpt: r.stdout.slice(-2000),
    stderr_excerpt: r.stderr.slice(-2000),
    error: r.error,
  };
  if (o.log !== false) {
    writeJson(reportPath, report);
    logExecutionRoute(planningDir, capsule, decision, {
      status: report.status,
      report_path: reportPath,
      patch_path: null,
      changed_files: [],
      out_of_scope_files: [],
      tests_passed: accepted,
      accepted,
      applied: false,
      duration_ms: r.duration_ms,
      token_estimate: { total_estimated_tokens: 0 },
    });
  }
  return report;
}

function logExecutionRoute(planningDir, capsule, decision, result) {
  const r = result || {};
  let status = 'ok';
  const reason_codes = decision.reason_codes.slice();
  if (r.status === 'timeout') {
    status = 'timeout';
    reason_codes.push('execution_timeout');
  } else if (r.accepted) {
    status = decision.fallback_used ? 'warn' : 'ok';
    reason_codes.push('execution_accepted');
  } else if (decision.chosen_provider === 'claude' && !r.status) {
    status = decision.fallback_used ? 'warn' : 'skipped';
    reason_codes.push('claude_handoff_required');
  } else {
    status = 'warn';
    reason_codes.push('execution_not_accepted');
  }

  const artifacts = [];
  if (r.report_path) artifacts.push({ kind: 'execution_report', path: path.relative(repoRoot(), r.report_path) });
  if (r.patch_path && fs.existsSync(r.patch_path)) artifacts.push({ kind: 'execution_patch', path: path.relative(repoRoot(), r.patch_path) });

  const evidence = [{ kind: 'task_capsule', ref: capsule.task_id }];

  return routeLedger.logRouteDecision(planningDir, {
    boundary: 'execution_route',
    status,
    phase: capsule.phase,
    milestone: capsule.milestone,
    reason_codes: uniq(reason_codes),
    artifacts,
    evidence,
    duration_ms: typeof r.duration_ms === 'number' ? r.duration_ms : null,
    risk: capsule.risk,
    decision: {
      task_id: capsule.task_id,
      task_kind: capsule.task_kind,
      role: capsule.role,
      route_class: decision.route_class,
      primary_provider: decision.primary_provider,
      chosen_provider: decision.chosen_provider,
      fallback_used: decision.fallback_used,
      fallback_reason: decision.fallback_reason,
      candidate_providers: decision.candidate_providers,
      allowed_files_count: capsule.allowed_files.length,
      changed_files: r.changed_files || [],
      out_of_scope_files: r.out_of_scope_files || [],
      tests_passed: !!r.tests_passed,
      accepted: !!r.accepted,
      applied: !!r.applied,
      token_estimate: r.token_estimate || null,
      health: decision.health,
    },
  });
}

function routeOnly(rawCapsule, opts) {
  const decision = routeCapsule(rawCapsule, opts);
  if (opts && opts.log) {
    logExecutionRoute(opts.planningDir || defaultPlanningDir(), decision.capsule, decision, {});
  }
  return decision;
}

function runCapsule(rawCapsule, opts) {
  const o = opts || {};
  const decision = routeCapsule(rawCapsule, o);
  const capsule = decision.capsule;
  if (o.routeOnly || o.dryRun) {
    if (o.log) logExecutionRoute(o.planningDir || defaultPlanningDir(), capsule, decision, {});
    return { mode: 'route-only', decision };
  }
  if (decision.chosen_provider === 'local-script') {
    return { mode: 'local-script', decision, result: executeLocal(capsule, decision, o) };
  }
  if (decision.chosen_provider === 'codex') {
    return { mode: 'codex', decision, result: executeCodex(capsule, decision, o) };
  }
  logExecutionRoute(o.planningDir || defaultPlanningDir(), capsule, decision, {});
  return {
    mode: 'claude-handoff',
    decision,
    result: {
      status: 'claude_handoff_required',
      message: 'Route requires Claude/orchestrator execution; no local process spawned.',
    },
  };
}

function parseArgs(argv) {
  const out = {
    selfTest: false,
    capsule: null,
    routeOnly: false,
    dryRun: false,
    execute: false,
    apply: false,
    keepWorktree: false,
    json: false,
    log: true,
    forceCodexHealth: undefined,
    planningDir: defaultPlanningDir(),
    projectDir: repoRoot(),
    timeoutMs: 600000,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--self-test') out.selfTest = true;
    else if (a === '--capsule') out.capsule = argv[++i];
    else if (a === '--route-only') out.routeOnly = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--execute') out.execute = true;
    else if (a === '--apply') out.apply = true;
    else if (a === '--keep-worktree') out.keepWorktree = true;
    else if (a === '--json') out.json = true;
    else if (a === '--no-log') out.log = false;
    else if (a === '--planning-dir') out.planningDir = path.resolve(argv[++i]);
    else if (a === '--project') out.projectDir = path.resolve(argv[++i]);
    else if (a === '--timeout-ms') out.timeoutMs = Number(argv[++i]);
    else if (a === '--force-codex-health') {
      const v = String(argv[++i]).toLowerCase();
      out.forceCodexHealth = v === 'true' || v === '1' || v === 'yes';
    } else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error('unknown flag ' + a);
  }
  return out;
}

function printHelp() {
  console.log('Usage: node super-gsd/tools/double-agent-executor/run.cjs --self-test');
  console.log('   or: node super-gsd/tools/double-agent-executor/run.cjs --capsule <file> [--route-only|--execute] [--apply] [--json]');
}

function selfTest() {
  let pass = 0, fail = 0;
  const failures = [];
  const assert = (name, cond, detail) => {
    if (cond) pass++;
    else { fail++; failures.push({ name, detail: detail || '' }); }
  };

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dae-'));
  const planningDir = path.join(tmp, '.planning');
  ensureDir(path.join(planningDir, 'metrics'));

  try {
    const base = {
      schema_version: 1,
      task_id: 'self-test-code',
      milestone: 'vX',
      phase: 1,
      role: 'executor',
      task_kind: 'code_edit',
      goal: 'Edit one bounded file.',
      allowed_files: ['super-gsd/tools/example.cjs'],
      acceptance_commands: ['node --version'],
      risk: 'medium',
      ambiguity: 'low',
      requires_private_knowledge: false,
      estimated_line_count: 50,
    };

    assert('1. valid capsule passes', validateCapsule(base).ok === true);
    assert('2. unsafe allowed path fails',
      validateCapsule(Object.assign({}, base, { allowed_files: ['../x'] })).ok === false);

    const codexRoute = routeCapsule(base, { forceCodexHealth: true });
    assert('3. bounded code edit routes to Codex when healthy',
      codexRoute.chosen_provider === 'codex' && codexRoute.primary_provider === 'codex');

    const fallbackRoute = routeCapsule(base, { forceCodexHealth: false });
    assert('4. bounded code edit falls back to Claude when Codex unhealthy',
      fallbackRoute.chosen_provider === 'claude'
      && fallbackRoute.primary_provider === 'codex'
      && fallbackRoute.fallback_used === true);

    const highRisk = routeCapsule(Object.assign({}, base, { risk: 'high' }), { forceCodexHealth: true });
    assert('5. high-risk task routes to Claude',
      highRisk.chosen_provider === 'claude' && highRisk.primary_provider === 'claude');

    const local = routeCapsule(Object.assign({}, base, {
      task_id: 'self-test-local',
      task_kind: 'extraction',
      deterministic: true,
      local_command: 'node --version',
    }), { forceCodexHealth: true });
    assert('6. deterministic local command routes to local-script',
      local.chosen_provider === 'local-script');

    logExecutionRoute(planningDir, base, codexRoute, {
      status: 'accepted_patch_written',
      report_path: path.join(planningDir, 'artifacts', 'r.json'),
      patch_path: path.join(planningDir, 'artifacts', 'r.patch'),
      changed_files: ['super-gsd/tools/example.cjs'],
      out_of_scope_files: [],
      tests_passed: true,
      accepted: true,
      applied: false,
      duration_ms: 12,
      token_estimate: { total_estimated_tokens: 123 },
    });
    const rows = routeLedger.readRows(planningDir).filter((r) => r.boundary === 'execution_route');
    assert('7. execution route row appended',
      rows.length === 1 && rows[0].decision.task_id === 'self-test-code');
    assert('8. execution route row preserves token estimate',
      rows[0].decision.token_estimate.total_estimated_tokens === 123);

    const routeOnlyResult = runCapsule(base, {
      routeOnly: true,
      log: false,
      forceCodexHealth: true,
      planningDir,
      projectDir: tmp,
    });
    assert('9. runCapsule route-only does not spawn executor',
      routeOnlyResult.mode === 'route-only'
      && routeOnlyResult.decision.chosen_provider === 'codex');

    const claudeResult = runCapsule(Object.assign({}, base, { risk: 'high' }), {
      log: true,
      forceCodexHealth: true,
      planningDir,
      projectDir: tmp,
    });
    assert('10. Claude handoff mode logs without spawning',
      claudeResult.mode === 'claude-handoff'
      && routeLedger.readRows(planningDir).filter((r) => r.boundary === 'execution_route').length === 2);

    const localResult = runCapsule(Object.assign({}, base, {
      task_id: 'self-test-local-exec',
      task_kind: 'extraction',
      deterministic: true,
      local_command: 'node --version',
    }), {
      log: true,
      forceCodexHealth: true,
      planningDir,
      projectDir: tmp,
    });
    assert('11. local-script execution runs and is accepted',
      localResult.mode === 'local-script'
      && localResult.result.status === 'accepted');
  } catch (e) {
    fail++;
    failures.push({ name: 'self-test exception', detail: e.stack || e.message });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(`double-agent-executor self-test: ${pass} pass, ${fail} fail`);
  if (fail) {
    console.error(JSON.stringify(failures, null, 2));
    return 1;
  }
  return 0;
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv);
    if (args.help) {
      printHelp();
      process.exit(0);
    }
    if (args.selfTest) process.exit(selfTest());
    if (!args.capsule) {
      printHelp();
      process.exit(2);
    }
    const capsule = readJson(args.capsule);
    const result = runCapsule(capsule, args);
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`double-agent-executor: ${result.mode}`);
      console.log(`  task: ${result.decision.task_id}`);
      console.log(`  route: ${result.decision.primary_provider} -> ${result.decision.chosen_provider}`);
      console.log(`  reason: ${result.decision.reason_codes.join(', ')}`);
      if (result.result && result.result.status) console.log(`  status: ${result.result.status}`);
    }
    process.exit(0);
  } catch (e) {
    console.error('double-agent-executor error: ' + e.message);
    process.exit(2);
  }
}

module.exports = {
  ROLES,
  TASK_KINDS,
  RISKS,
  PROVIDERS,
  validateCapsule,
  normalizeCapsule,
  routeCapsule,
  runCapsule,
  logExecutionRoute,
  selfTest,
};
