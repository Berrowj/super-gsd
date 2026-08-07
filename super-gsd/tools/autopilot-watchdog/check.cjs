#!/usr/bin/env node
/*
 * Super GSD Autopilot Watchdog
 *
 * External progress detector for autonomous SGSD runs.
 *
 * This intentionally does not trust Claude's own context estimate or dashboard
 * rendering. It looks for durable project progress: STATE.md updates, current
 * phase artifact writes, orchestrator pulses, activity/heartbeat logs, and git
 * commits. If the active phase is incomplete and durable progress goes stale,
 * it writes a machine-readable status plus a recovery packet for a fresh SGSD
 * session.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { findSgsdRoot, readState } = require('../../scripts/lib/sgsd-state.cjs');

const VERSION = 'autopilot-watchdog-v1';
const DEFAULT_WARN_MIN = 20;
const DEFAULT_STALE_MIN = 45;

function parseArgs(argv) {
  const out = {
    projectDir: process.cwd(),
    warnMin: DEFAULT_WARN_MIN,
    staleMin: DEFAULT_STALE_MIN,
    write: false,
    checkpoint: false,
    json: false,
    selfTest: false,
    selfTestPhaseResolution: false
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--project-dir') out.projectDir = next();
    else if (a === '--warn-min') out.warnMin = Number(next());
    else if (a === '--stale-min') out.staleMin = Number(next());
    else if (a === '--write') out.write = true;
    else if (a === '--checkpoint') out.checkpoint = true;
    else if (a === '--json') out.json = true;
    else if (a === '--self-test') out.selfTest = true;
    else if (a === '--self-test-phase-resolution') out.selfTestPhaseResolution = true;
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node ${path.relative(process.cwd(), __filename)} [--project-dir PATH] [--warn-min N] [--stale-min N] [--write] [--checkpoint] [--json] [--self-test] [--self-test-phase-resolution]`);
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${a}`);
    }
  }
  if (!Number.isFinite(out.warnMin) || out.warnMin < 1) throw new Error('--warn-min must be a positive number');
  if (!Number.isFinite(out.staleMin) || out.staleMin < 1) throw new Error('--stale-min must be a positive number');
  if (out.warnMin >= out.staleMin) out.warnMin = Math.max(1, Math.floor(out.staleMin / 2));
  return out;
}

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function statMs(p) {
  try { return fs.statSync(p).mtimeMs; } catch { return null; }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readText(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function writeText(p, text) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, text, 'utf8');
}

function appendJsonl(p, row) {
  ensureDir(path.dirname(p));
  fs.appendFileSync(p, JSON.stringify(row) + '\n', 'utf8');
}

function iso(ms) {
  if (!ms) return null;
  return new Date(ms).toISOString();
}

function ageSec(nowMs, ms) {
  if (!ms) return null;
  return Math.max(0, Math.round((nowMs - ms) / 1000));
}

function parseFrontmatter(text) {
  const fm = {};
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return fm;
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!mm) continue;
    fm[mm[1]] = mm[2].replace(/^['"]|['"]$/g, '').trim();
  }
  return fm;
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getState(root) {
  const statePath = path.join(root, '.planning', 'STATE.md');
  const text = readText(statePath);
  const fm = parseFrontmatter(text);
  let resolved = null;
  try {
    resolved = readState(root);
  } catch {
    resolved = null;
  }
  const helperPhase = resolved && resolved.phase ? String(resolved.phase) : '';
  const frontmatterPhase = fm.current_phase || fm.phase || '';
  const currentPhase = helperPhase || (frontmatterPhase ? String(frontmatterPhase).replace(/^P/i, '') : '');
  return {
    path: statePath,
    mtimeMs: statMs(statePath),
    milestone: resolved && resolved.milestone ? resolved.milestone : (fm.milestone || ''),
    milestoneName: fm.milestone_name || '',
    currentPhase,
    phaseSource: helperPhase
      ? (resolved && resolved.phaseSource ? resolved.phaseSource : 'sgsd-state')
      : (currentPhase ? 'frontmatter_current_phase' : 'unavailable'),
    status: fm.status || '',
    raw: text
  };
}

function findActivePhaseDir(root, milestone, phase) {
  if (!milestone || !phase) return null;
  const phaseRoots = [
    path.join(root, '.planning', 'milestones', milestone, 'phases'),
    path.join(root, '.planning', 'phases')
  ];
  const phaseRe = new RegExp(`^${escapeRegExp(phase)}(?:-|$)`);
  for (const phaseRoot of phaseRoots) {
    if (!exists(phaseRoot)) continue;
    try {
      const dirs = fs.readdirSync(phaseRoot, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name.match(phaseRe));
      if (dirs.length > 0) return path.join(phaseRoot, dirs[0].name);
    } catch {}
  }
  return null;
}

function canWriteSharedCheckpoint(checkpointPath) {
  const existing = readText(checkpointPath);
  if (!existing) return true;
  const fm = parseFrontmatter(existing);
  return fm.generated_by === VERSION;
}

function writeWatchdogCheckpoint(root, recovery) {
  const checkpointPath = path.join(root, '.planning', 'ORCHESTRATOR-CHECKPOINT.md');
  if (!canWriteSharedCheckpoint(checkpointPath)) return false;
  writeText(
    checkpointPath,
    recovery.replace('# Autopilot Stall Recovery', '# Orchestrator Checkpoint - Autopilot Stall Recovery')
  );
  return true;
}

function phaseNameFromDir(phaseDir, phase) {
  if (!phaseDir) return '';
  const base = path.basename(phaseDir);
  return base.replace(new RegExp(`^${escapeRegExp(phase)}-?`), '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function latestMtimeUnder(dir, maxFiles = 800) {
  if (!dir || !exists(dir)) return null;
  let latest = statMs(dir);
  let seen = 0;
  const stack = [dir];
  while (stack.length && seen < maxFiles) {
    const cur = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = path.join(cur, entry.name);
      const ms = statMs(full);
      if (ms && (!latest || ms > latest)) latest = ms;
      seen++;
      if (entry.isDirectory()) stack.push(full);
      if (seen >= maxFiles) break;
    }
  }
  return latest;
}

function verificationStatus(phaseDir, phase) {
  if (!phaseDir || !exists(phaseDir)) return '';
  try {
    const files = fs.readdirSync(phaseDir).filter(f => f.endsWith('-VERIFICATION.md') || f === `${phase}-VERIFICATION.md`);
    for (const f of files) {
      const fm = parseFrontmatter(readText(path.join(phaseDir, f)));
      if (fm.status) return fm.status;
    }
  } catch {}
  return '';
}

function lastJsonlTs(p) {
  const text = readText(p);
  if (!text) return null;
  const lines = text.trim().split(/\r?\n/).slice(-50).reverse();
  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      if (row.ts) {
        const t = Date.parse(row.ts);
        if (Number.isFinite(t)) return t;
      }
    } catch {}
  }
  return statMs(p);
}

function gitHeadMs(root) {
  try {
    const out = cp.execFileSync('git', ['log', '-1', '--format=%ct'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    const sec = Number(out);
    return Number.isFinite(sec) ? sec * 1000 : null;
  } catch {
    return null;
  }
}

function encodeProjectPath(projectDir) {
  return projectDir.replace(/[\\/:.]/g, '-').replace(/^-+/, '');
}

function latestClaudeSessionMs(root) {
  const home = process.env.USERPROFILE || os.homedir();
  const dir = path.join(home, '.claude', 'projects', encodeProjectPath(root));
  if (!exists(dir)) return null;
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({ f, ms: statMs(path.join(dir, f)) || 0 }))
      .sort((a, b) => b.ms - a.ms);
    return files[0] ? files[0].ms : null;
  } catch {
    return null;
  }
}

function maxCandidate(candidates) {
  return candidates
    .filter(c => c && Number.isFinite(c.ms))
    .sort((a, b) => b.ms - a.ms)[0] || null;
}

function comparePathKey(p) {
  const resolved = path.resolve(p);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isSubpath(root, candidate) {
  const rel = path.relative(comparePathKey(root), comparePathKey(candidate));
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function nearestExistingAncestor(candidate) {
  let cur = path.resolve(String(candidate || ''));
  for (;;) {
    try {
      fs.lstatSync(cur);
      return cur;
    } catch (err) {
      if (err && err.code !== 'ENOENT' && err.code !== 'ENOTDIR') throw err;
      const parent = path.dirname(cur);
      if (parent === cur) throw new Error(`no existing ancestor for path: ${candidate}`);
      cur = parent;
    }
  }
}

function resolveViaNearestExistingAncestor(candidate) {
  const resolved = path.resolve(String(candidate || ''));
  const existing = nearestExistingAncestor(resolved);
  const realExisting = fs.realpathSync(existing);
  return path.resolve(realExisting, path.relative(existing, resolved));
}

function watchdogWriteTargets(root, result, checkpoint) {
  const targets = [path.join(root, '.planning', 'metrics', 'autopilot-watchdog.json')];
  if (result.status === 'stalled') {
    targets.push(path.join(root, '.planning', 'AUTOPILOT-RECOVERY.md'));
    targets.push(path.join(root, '.planning', 'metrics', 'stall-log.jsonl'));
    if (checkpoint) targets.push(path.join(root, '.planning', 'ORCHESTRATOR-CHECKPOINT.md'));
  }
  return targets;
}

function resolveWritableSgsdRoot(projectDir, result, checkpoint) {
  try {
    const root = path.resolve(projectDir);
    if (result && result.reason === 'no .planning directory') {
      return { ok: false, reason: result.reason };
    }
    const sgsdRoot = findSgsdRoot(root);
    if (!sgsdRoot || comparePathKey(sgsdRoot) !== comparePathKey(root)) {
      return { ok: false, reason: 'no SGSD root at --project-dir' };
    }
    if (!exists(path.join(root, '.planning')) || !exists(path.join(root, '.planning', 'STATE.md'))) {
      return { ok: false, reason: 'no .planning directory' };
    }
    const realRoot = fs.realpathSync(root);
    for (const target of watchdogWriteTargets(root, result, checkpoint)) {
      const realTarget = resolveViaNearestExistingAncestor(target);
      if (!isSubpath(realRoot, realTarget)) {
        return { ok: false, reason: `write target escapes SGSD root: ${target}` };
      }
    }
    return { ok: true, root };
  } catch (err) {
    return { ok: false, reason: `write target validation failed: ${err.message}` };
  }
}

function buildRecoveryMarkdown(result) {
  const r = result;
  const phase = r.phase || '?';
  const milestone = r.milestone || '?';
  return `---
generated_by: ${VERSION}
generated_at: ${r.generated_at}
status: ${r.status}
milestone: ${milestone}
phase: ${phase}
---

# Autopilot Stall Recovery

The watchdog detected no durable SGSD progress for ${r.durable_progress_age_min} minutes.

## Current Target

- Milestone: ${milestone} ${r.milestone_name || ''}
- Phase: ${phase} ${r.phase_name || ''}
- State status: ${r.state_status || 'unknown'}
- Last durable progress: ${r.latest_durable_source || 'none'} at ${r.latest_durable_at || 'unknown'}
- Last live activity: ${r.latest_activity_source || 'none'} at ${r.latest_activity_at || 'unknown'}

## Resume Prompt

Use this prompt in a fresh Claude/SGSD session:

\`\`\`text
You are in ${r.project_dir}.

Autopilot watchdog detected a stall while working on milestone ${milestone}, phase ${phase}.

Do not rely on conversation memory. Read these files first:
1. .planning/STATE.md
2. .planning/ORCHESTRATOR-CHECKPOINT.md if present
3. .planning/AUTOPILOT-RECOVERY.md
4. The active phase folder under .planning/milestones/${milestone}/phases/ or .planning/phases/
5. git status --short and git log --oneline -8

Recover by inspecting what artifacts are missing for phase ${phase}, finishing or repairing the current phase, committing only scoped changes, updating STATE.md, and then continue with /sgsd-orchestrate go.

Do not halt because of context percentage. External files are the source of truth.
\`\`\`

## Why This Exists

The dashboard can keep rendering even when the autonomous loop has stopped making durable progress. This file is generated outside the agent loop so a fresh session can recover without trusting stale context.
`;
}

function appendStallIfNew(root, result) {
  const logPath = path.join(root, '.planning', 'metrics', 'stall-log.jsonl');
  let last = null;
  const text = readText(logPath).trim();
  if (text) {
    const tail = text.split(/\r?\n/).slice(-1)[0];
    try { last = JSON.parse(tail); } catch {}
  }
  const sameOpenStall = last &&
    last.status === 'stalled' &&
    last.milestone === result.milestone &&
    String(last.phase || '') === String(result.phase || '') &&
    (Date.parse(result.generated_at) - Date.parse(last.ts || last.generated_at || 0)) < (result.stale_min * 60 * 1000);

  if (!sameOpenStall) {
    appendJsonl(logPath, {
      ts: result.generated_at,
      probe_version: VERSION,
      status: 'stalled',
      milestone: result.milestone,
      phase: result.phase,
      phase_name: result.phase_name,
      durable_progress_age_sec: result.durable_progress_age_sec,
      latest_durable_source: result.latest_durable_source,
      latest_durable_at: result.latest_durable_at,
      latest_activity_source: result.latest_activity_source,
      latest_activity_at: result.latest_activity_at,
      recovery_packet: '.planning/AUTOPILOT-RECOVERY.md'
    });
  }
}

function writeOutputs(root, result, checkpoint) {
  const metricsDir = path.join(root, '.planning', 'metrics');
  ensureDir(metricsDir);
  writeText(path.join(metricsDir, 'autopilot-watchdog.json'), JSON.stringify(result, null, 2) + '\n');
  if (result.status === 'stalled') {
    const recovery = buildRecoveryMarkdown(result);
    writeText(path.join(root, '.planning', 'AUTOPILOT-RECOVERY.md'), recovery);
    if (checkpoint) {
      writeWatchdogCheckpoint(root, recovery);
    }
    appendStallIfNew(root, result);
  }
}

function check(projectDir, opts = {}) {
  const root = path.resolve(projectDir);
  const planning = path.join(root, '.planning');
  const nowMs = Date.now();
  if (!exists(planning)) {
    return {
      probe_version: VERSION,
      generated_at: new Date(nowMs).toISOString(),
      project_dir: root,
      status: 'unknown',
      reason: 'no .planning directory'
    };
  }

  const state = getState(root);
  const phaseDir = findActivePhaseDir(root, state.milestone, state.currentPhase);
  const vStatus = verificationStatus(phaseDir, state.currentPhase);
  const phaseComplete = /^(pass|passed|pass-with-deferred|candidate|candidate-with-debt)/i.test(vStatus);

  const metrics = path.join(planning, 'metrics');
  const durableCandidates = [
    { source: 'STATE.md', ms: state.mtimeMs },
    { source: 'active phase artifacts', ms: latestMtimeUnder(phaseDir) },
    { source: 'orchestrator-pulse.jsonl', ms: lastJsonlTs(path.join(metrics, 'orchestrator-pulse.jsonl')) },
    { source: 'git HEAD', ms: gitHeadMs(root) }
  ];
  const activityCandidates = [
    { source: 'heartbeat.jsonl', ms: lastJsonlTs(path.join(metrics, 'heartbeat.jsonl')) },
    { source: 'activity-log.jsonl', ms: lastJsonlTs(path.join(metrics, 'activity-log.jsonl')) },
    { source: 'latest Claude session', ms: latestClaudeSessionMs(root) }
  ];

  const latestDurable = maxCandidate(durableCandidates);
  const latestActivity = maxCandidate(activityCandidates);
  const durableAge = latestDurable ? ageSec(nowMs, latestDurable.ms) : null;
  const activityAge = latestActivity ? ageSec(nowMs, latestActivity.ms) : null;
  const warnSec = Math.round((opts.warnMin || DEFAULT_WARN_MIN) * 60);
  const staleSec = Math.round((opts.staleMin || DEFAULT_STALE_MIN) * 60);

  let status = 'ok';
  let reason = 'durable progress fresh';
  if (phaseComplete) {
    status = 'complete';
    reason = `phase verification status ${vStatus}`;
  } else if (!state.currentPhase || !state.milestone) {
    status = 'unknown';
    reason = 'no active milestone/phase in STATE.md';
  } else if (durableAge === null) {
    status = 'unknown';
    reason = 'no durable progress source found';
  } else if (durableAge >= staleSec) {
    status = 'stalled';
    reason = `no durable progress for ${Math.round(durableAge / 60)} min`;
  } else if (durableAge >= warnSec) {
    status = 'warn';
    reason = `durable progress stale for ${Math.round(durableAge / 60)} min`;
  }

  return {
    probe_version: VERSION,
    generated_at: new Date(nowMs).toISOString(),
    project_dir: root,
    status,
    reason,
    warn_min: opts.warnMin || DEFAULT_WARN_MIN,
    stale_min: opts.staleMin || DEFAULT_STALE_MIN,
    milestone: state.milestone,
    milestone_name: state.milestoneName,
    phase: state.currentPhase,
    phase_name: phaseNameFromDir(phaseDir, state.currentPhase),
    state_status: state.status,
    verification_status: vStatus,
    phase_complete: phaseComplete,
    active_phase_dir: phaseDir ? path.relative(root, phaseDir).replace(/\\/g, '/') : null,
    durable_progress_age_sec: durableAge,
    durable_progress_age_min: durableAge === null ? null : Math.round(durableAge / 60),
    latest_durable_source: latestDurable ? latestDurable.source : null,
    latest_durable_at: latestDurable ? iso(latestDurable.ms) : null,
    live_activity_age_sec: activityAge,
    live_activity_age_min: activityAge === null ? null : Math.round(activityAge / 60),
    latest_activity_source: latestActivity ? latestActivity.source : null,
    latest_activity_at: latestActivity ? iso(latestActivity.ms) : null,
    recovery_packet: status === 'stalled' ? '.planning/AUTOPILOT-RECOVERY.md' : null
  };
}

function selfTestPhaseResolution() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-watchdog-phase-'));
  try {
    const phaseDir = path.join(tmp, '.planning', 'milestones', 'vX', 'phases', '146-frontmatter-wins');
    ensureDir(phaseDir);
    writeText(path.join(tmp, '.planning', 'STATE.md'), `---
milestone: vX
milestone_name: Phase Resolution Test
current_phase: 146
status: Phase 999 active prose must be ignored
---
progress:
  phase_888: "PENDING - prose row must be ignored"
`);
    writeText(path.join(phaseDir, '146-CONTEXT.md'), '# frontmatter fixture\n');
    let r = check(tmp, { warnMin: 1, staleMin: 2 });
    if (r.phase !== '146') throw new Error(`expected current_phase 146, got ${r.phase}`);
    if (r.active_phase_dir !== '.planning/milestones/vX/phases/146-frontmatter-wins') {
      throw new Error(`expected frontmatter active phase dir, got ${r.active_phase_dir}`);
    }

    writeText(path.join(tmp, '.planning', 'STATE.md'), `---
milestone: vX
milestone_name: Phase Resolution Test
status: Phase 777 active prose must be ignored
---
progress:
  phase_888: "PENDING - prose row must be ignored"
`);
    r = check(tmp, { warnMin: 1, staleMin: 2 });
    if (r.phase === '777' || r.phase === '888') {
      throw new Error(`prose-derived phase leaked through: ${r.phase}`);
    }
    if (r.phase !== '') throw new Error(`expected no phase without frontmatter, got ${r.phase}`);
    console.log('autopilot-watchdog phase-resolution self-test: PASS');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-watchdog-'));
  try {
    const phaseDir = path.join(tmp, '.planning', 'milestones', 'vX', 'phases', '99-demo-phase');
    ensureDir(phaseDir);
    writeText(path.join(tmp, '.planning', 'STATE.md'), `---\nmilestone: vX\nmilestone_name: Watchdog Test\ncurrent_phase: 99\nstatus: Phase 99 active\n---\n`);
    writeText(path.join(phaseDir, '99-CONTEXT.md'), '# test\n');
    writeText(path.join(tmp, '.planning', 'metrics', 'activity-log.jsonl'), JSON.stringify({ ts: new Date().toISOString(), tool: 'Bash' }) + '\n');
    let r = check(tmp, { warnMin: 1, staleMin: 2 });
    if (r.status !== 'ok') throw new Error(`expected ok, got ${r.status}`);

    const old = new Date(Date.now() - 10 * 60 * 1000);
    writeText(path.join(tmp, '.planning', 'metrics', 'activity-log.jsonl'), JSON.stringify({ ts: old.toISOString(), tool: 'Bash' }) + '\n');
    for (const p of [
      path.join(tmp, '.planning', 'STATE.md'),
      phaseDir,
      path.join(phaseDir, '99-CONTEXT.md'),
      path.join(tmp, '.planning', 'metrics', 'activity-log.jsonl')
    ]) fs.utimesSync(p, old, old);
    r = check(tmp, { warnMin: 1, staleMin: 2 });
    if (r.status !== 'stalled') throw new Error(`expected stalled, got ${r.status}`);

    writeText(path.join(phaseDir, '99-VERIFICATION.md'), `---\nstatus: PASS\n---\n`);
    r = check(tmp, { warnMin: 1, staleMin: 2 });
    if (r.status !== 'complete') throw new Error(`expected complete, got ${r.status}`);

    const flat = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-watchdog-flat-'));
    try {
      const flatPhaseDir = path.join(flat, '.planning', 'phases', 'v22-11-classifier');
      ensureDir(flatPhaseDir);
      writeText(path.join(flat, '.planning', 'STATE.md'), `---\nmilestone: v2.2\nmilestone_name: Flat Phase Test\ncurrent_phase: v22-11-classifier\nstatus: Phase v22-11 active\n---\n`);
      writeText(path.join(flatPhaseDir, 'CONTEXT.md'), '# flat phase artifact\n');
      r = check(flat, { warnMin: 1, staleMin: 2 });
      if (r.active_phase_dir !== '.planning/phases/v22-11-classifier') {
        throw new Error(`expected flat active phase dir, got ${r.active_phase_dir}`);
      }
      if (r.latest_durable_source !== 'active phase artifacts') {
        throw new Error(`expected flat artifact durable source, got ${r.latest_durable_source}`);
      }
    } finally {
      fs.rmSync(flat, { recursive: true, force: true });
    }

    const ck = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-watchdog-checkpoint-'));
    try {
      const ckPhaseDir = path.join(ck, '.planning', 'milestones', 'vX', 'phases', '98-checkpoint');
      ensureDir(ckPhaseDir);
      writeText(path.join(ck, '.planning', 'STATE.md'), `---\nmilestone: vX\ncurrent_phase: 98\nstatus: Phase 98 active\n---\n`);
      writeText(path.join(ckPhaseDir, '98-CONTEXT.md'), '# checkpoint test\n');
      const old = new Date(Date.now() - 10 * 60 * 1000);
      for (const p of [
        path.join(ck, '.planning', 'STATE.md'),
        ckPhaseDir,
        path.join(ckPhaseDir, '98-CONTEXT.md')
      ]) fs.utimesSync(p, old, old);
      r = check(ck, { warnMin: 1, staleMin: 2 });
      if (r.status !== 'stalled') throw new Error(`expected checkpoint fixture stalled, got ${r.status}`);

      const checkpointPath = path.join(ck, '.planning', 'ORCHESTRATOR-CHECKPOINT.md');
      const operatorCheckpoint = `---\ngenerated_by: operator\n---\n# Operator Checkpoint\n`;
      writeText(checkpointPath, operatorCheckpoint);
      writeOutputs(ck, r, true);
      if (readText(checkpointPath) !== operatorCheckpoint) {
        throw new Error('expected operator checkpoint to be preserved');
      }

      const watchdogCheckpoint = `---\ngenerated_by: ${VERSION}\n---\n# Old Watchdog Checkpoint\n`;
      writeText(checkpointPath, watchdogCheckpoint);
      writeOutputs(ck, r, true);
      const rewritten = readText(checkpointPath);
      if (rewritten === watchdogCheckpoint || !rewritten.includes('# Orchestrator Checkpoint - Autopilot Stall Recovery')) {
        throw new Error('expected watchdog checkpoint to be rewritten');
      }
    } finally {
      fs.rmSync(ck, { recursive: true, force: true });
    }
    console.log('autopilot-watchdog self-test: PASS');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (args.selfTest) return selfTest();
  if (args.selfTestPhaseResolution) return selfTestPhaseResolution();
  const result = check(args.projectDir, args);
  if (args.write) {
    const writeRoot = resolveWritableSgsdRoot(args.projectDir, result, args.checkpoint);
    if (writeRoot.ok) writeOutputs(writeRoot.root, result, args.checkpoint);
    else console.error(`autopilot-watchdog: write skipped: ${writeRoot.reason}`);
  }
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    const age = result.durable_progress_age_min === null ? '?' : result.durable_progress_age_min;
    console.log(`${result.status.toUpperCase()} ${result.milestone || '?'} P${result.phase || '?'}: ${result.reason}; durable=${age}m`);
  }
  process.exit(result.status === 'stalled' ? 2 : 0);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`autopilot-watchdog: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { check };
