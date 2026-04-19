#!/usr/bin/env node
/**
 * Super GSD · Workflow Process Audit — Analyzer
 *
 * Deterministic pass over the event logs that Super GSD already emits:
 *   .planning/metrics/activity-log.jsonl     (PreToolUse)
 *   .planning/metrics/heartbeat.jsonl        (PostToolUse)
 *   .planning/metrics/token-log.jsonl        (per-unit spend)
 *   .planning/metrics/readiness-log.jsonl    (pre-flight + drift)
 *   git log                                  (atomic commits)
 *   .planning/phases/NN-*                    (plan / verification / checkpoints)
 *
 * Emits .planning/audit/AUDIT-METRICS.json for the synthesis agent and the
 * dashboard HTML to consume. This script is numbers-only — no narrative.
 *
 * Usage:
 *   node analyze.js [--project PATH] [--since ISO] [--out PATH]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PROJECT = path.resolve(opt('--project', process.cwd()));
const SINCE = opt('--since', null);                          // ISO timestamp
const OUT = opt('--out', path.join(PROJECT, '.planning', 'audit', 'AUDIT-METRICS.json'));

// ── helpers ──────────────────────────────────────────────────────────────────
const P = (...p) => path.join(PROJECT, ...p);
const readJsonl = (p) => {
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
};
const sinceFilter = (rows) => SINCE ? rows.filter(r => r.ts && r.ts >= SINCE) : rows;
const pct = (n, d) => d ? +(100 * n / d).toFixed(1) : 0;
const q = (arr, q) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
};
const mean = (arr) => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0;

// ── load event streams ───────────────────────────────────────────────────────
const activity  = sinceFilter(readJsonl(P('.planning/metrics/activity-log.jsonl')));
const heartbeat = sinceFilter(readJsonl(P('.planning/metrics/heartbeat.jsonl')));
const tokens    = sinceFilter(readJsonl(P('.planning/metrics/token-log.jsonl')));
const readiness = sinceFilter(readJsonl(P('.planning/metrics/readiness-log.jsonl')));

// ── 1. CONFORMANCE ───────────────────────────────────────────────────────────
// Dispatch rules from CLAUDE.md: researcher → planner → checker → readiness →
// executor → verifier. Detect violations where readiness (4.5) was skipped,
// or executor fired before plan-check, etc.
function conformance() {
  const phaseAgents = {}; // phase → ordered list of agent dispatches
  for (const e of activity) {
    if (e.tool !== 'Agent' || !e.phase) continue;
    const m = /(gsd|sgsd)-(\w+)/.exec(e.target || '');
    if (!m) continue;
    (phaseAgents[e.phase] ||= []).push({ agent: m[2], ts: e.ts });
  }
  const violations = [];
  const EXPECTED_ORDER = ['phase-researcher', 'planner', 'plan-checker', 'milestone-readiness', 'phase-readiness', 'executor', 'verifier'];
  for (const [phase, seq] of Object.entries(phaseAgents)) {
    const agents = seq.map(s => s.agent);
    // Readiness skip: executor fired but no phase-readiness in this phase
    if (agents.includes('executor') && !agents.includes('phase-readiness')) {
      violations.push({ phase, rule: '4.5-readiness-skipped', detail: 'executor ran without phase-readiness re-probe' });
    }
    // Plan-check skip
    if (agents.includes('executor') && !agents.includes('plan-checker') && !agents.includes('planner')) {
      violations.push({ phase, rule: '4-planner-skipped', detail: 'executor ran without any plan step' });
    }
    // Rework loop detection
    const verifierHits = agents.filter(a => a === 'verifier').length;
    const executorHits = agents.filter(a => a === 'executor').length;
    if (verifierHits >= 2 || executorHits >= 3) {
      violations.push({ phase, rule: 'rework-loop', detail: `verifier×${verifierHits} executor×${executorHits}` });
    }
  }
  return { phases_observed: Object.keys(phaseAgents).length, violations };
}

// ── 2. BOTTLENECKS ───────────────────────────────────────────────────────────
// Join activity (start) → heartbeat (end) by nearest-match ts per tool to
// compute durations. Approximate — tools don't always pair 1:1 but stats
// over many samples are robust enough for ranking.
function bottlenecks() {
  const byTool = {};
  let ai = 0, hi = 0;
  while (ai < activity.length && hi < heartbeat.length) {
    const a = activity[ai], h = heartbeat[hi];
    if (!a.ts || !h.ts) { ai++; continue; }
    const at = new Date(a.ts).getTime(), ht = new Date(h.ts).getTime();
    if (ht < at) { hi++; continue; }
    if (h.tool === a.tool) {
      (byTool[a.tool] ||= []).push(ht - at);
      ai++; hi++;
    } else { ai++; }
  }
  const stats = {};
  for (const [tool, samples] of Object.entries(byTool)) {
    stats[tool] = {
      n: samples.length,
      mean_ms: mean(samples),
      p50_ms: q(samples, 0.5),
      p95_ms: q(samples, 0.95),
      max_ms: Math.max(...samples)
    };
  }
  // Agent-level bottlenecks from token log (has durations if logged)
  const byAgent = {};
  for (const t of tokens) {
    const a = t.agent || 'unknown';
    (byAgent[a] ||= []).push(t.duration_sec || 0);
  }
  const agentStats = {};
  for (const [a, s] of Object.entries(byAgent)) {
    agentStats[a] = { n: s.length, mean_sec: mean(s), p95_sec: q(s, 0.95) };
  }
  return { per_tool: stats, per_agent: agentStats };
}

// ── 3. TOKEN WASTE ───────────────────────────────────────────────────────────
function tokenWaste() {
  const byModel = {};
  const byAgent = {};
  let total = 0;
  for (const t of tokens) {
    const m = t.model || 'unknown';
    const a = t.agent || 'unknown';
    const n = (t.input_tokens || 0) + (t.output_tokens || 0);
    total += n;
    byModel[m] = (byModel[m] || 0) + n;
    byAgent[a] = (byAgent[a] || 0) + n;
  }
  // Classifier/selector should be haiku — flag if they ran sonnet/opus
  const miscast = tokens.filter(t =>
    /classifier|context-selector|readiness/.test(t.agent || '') &&
    /sonnet|opus/.test(t.model || '')
  ).length;
  return {
    total_tokens: total,
    by_model: byModel,
    by_agent: byAgent,
    miscast_lightweight_units: miscast
  };
}

// ── 4. HANGS & EMPTY RESULTS ─────────────────────────────────────────────────
function hangs() {
  const empty = heartbeat.filter(h => h.empty).length;
  const errors = heartbeat.filter(h => h.status === 'error').length;
  // Detect gaps between a tool START and its END exceeding 120s
  const hangIncidents = [];
  for (let i = 0; i < activity.length - 1; i++) {
    const a = activity[i];
    const next = heartbeat.find(h => h.ts > a.ts && h.tool === a.tool);
    if (!next) continue;
    const gap = (new Date(next.ts) - new Date(a.ts)) / 1000;
    if (gap > 120) hangIncidents.push({ tool: a.tool, target: a.target, gap_sec: Math.round(gap), ts: a.ts });
  }
  return {
    empty_results: empty,
    tool_errors: errors,
    hang_incidents: hangIncidents.slice(0, 20),
    hang_count: hangIncidents.length
  };
}

// ── 5. BLOCKER SURPRISE RATE ─────────────────────────────────────────────────
// Blockers hit mid-execution that the milestone-readiness audit missed.
function blockerSurprise() {
  const driftEvents = readiness.filter(r => r.status === 'DRIFT').length;
  const readinessRuns = readiness.filter(r => r.trigger || r.phases_scanned).length;
  // Count "Blocker:" mentions in commit messages as a proxy for executor-hit blockers
  let executorBlockers = 0;
  try {
    const log = execSync('git log --since="30 days ago" --pretty=format:%s', { cwd: PROJECT, encoding: 'utf8' });
    executorBlockers = (log.match(/\b[Bb]locker\b/g) || []).length;
  } catch {}
  const surprise = executorBlockers - driftEvents;
  return {
    readiness_runs: readinessRuns,
    drift_events: driftEvents,
    executor_blockers: executorBlockers,
    surprise_blockers: Math.max(0, surprise),
    readiness_accuracy_pct: executorBlockers ? pct(executorBlockers - Math.max(0, surprise), executorBlockers) : 100
  };
}

// ── 6. VELOCITY ──────────────────────────────────────────────────────────────
function velocity() {
  let commits = [];
  try {
    const log = execSync('git log --since="30 days ago" --pretty=format:%H|%ct|%s', { cwd: PROJECT, encoding: 'utf8' });
    commits = log.split('\n').filter(Boolean).map(l => {
      const [sha, ct, msg] = l.split('|');
      return { sha, ts: new Date(+ct * 1000).toISOString(), msg };
    });
  } catch {}
  const byPhase = {};
  for (const c of commits) {
    const m = /\((\d+(?:[-.]\d+)*)/.exec(c.msg);
    if (!m) continue;
    (byPhase[m[1]] ||= []).push(c);
  }
  const phaseDurations = {};
  for (const [p, cs] of Object.entries(byPhase)) {
    if (cs.length < 2) continue;
    const sorted = cs.sort((a, b) => a.ts.localeCompare(b.ts));
    const dur = (new Date(sorted[sorted.length - 1].ts) - new Date(sorted[0].ts)) / 1000;
    phaseDurations[p] = { commits: cs.length, seconds: Math.round(dur) };
  }
  return {
    total_commits_30d: commits.length,
    phase_durations: phaseDurations,
    commits_per_day: +(commits.length / 30).toFixed(1)
  };
}

// ── 7. PROCESS MAP (for dashboard) ───────────────────────────────────────────
// Directed edges: agent A → agent B (within same phase, by ts order).
function processMap() {
  const edges = {};
  const byPhase = {};
  for (const e of activity) {
    if (e.tool !== 'Agent' || !e.phase) continue;
    const m = /(gsd|sgsd)-(\w+)/.exec(e.target || '');
    if (!m) continue;
    (byPhase[e.phase] ||= []).push({ agent: m[2], ts: e.ts });
  }
  for (const seq of Object.values(byPhase)) {
    seq.sort((a, b) => a.ts.localeCompare(b.ts));
    for (let i = 0; i < seq.length - 1; i++) {
      const key = `${seq[i].agent}→${seq[i + 1].agent}`;
      edges[key] = (edges[key] || 0) + 1;
    }
  }
  return edges;
}

// ── emit ─────────────────────────────────────────────────────────────────────
const out = {
  generated: new Date().toISOString(),
  project: PROJECT,
  since: SINCE,
  counts: {
    activity: activity.length,
    heartbeat: heartbeat.length,
    tokens: tokens.length,
    readiness: readiness.length
  },
  conformance: conformance(),
  bottlenecks: bottlenecks(),
  token_waste: tokenWaste(),
  hangs: hangs(),
  blocker_surprise: blockerSurprise(),
  velocity: velocity(),
  process_map: processMap()
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`AUDIT-METRICS written: ${OUT}`);
console.log(`  activity=${activity.length} heartbeat=${heartbeat.length} tokens=${tokens.length}`);
console.log(`  conformance_violations=${out.conformance.violations.length}`);
console.log(`  hang_incidents=${out.hangs.hang_count} empty_results=${out.hangs.empty_results}`);
console.log(`  miscast_lightweight=${out.token_waste.miscast_lightweight_units}`);
