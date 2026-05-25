'use strict';

// P143 stream-health.cjs — HiveMind-inspired health probes for every cockpit
// data stream. Operator (2026-05-25): 'plumb in health checks for all data or
// api streams so that we know if anything goes down it wont be silent'.
//
// Principles (VTP-retrieved 2026-05-25):
//   HM-P-04 — latency-as-congestion-signal: spike before errors appear
//   HM-P-05 — circuit-breaker: fast-fail after N consecutive failures
//   HM-P-07 — per-source budgets: cap retries so one bad source can't starve
//   HM-P-09 — pre-seed defaults: every source has a known-good baseline
//
// State store: in-process Map (resets on serve.cjs restart). Persisted
// summaries written to .planning/runtime/stream-health.jsonl on demand.

const fs = require('fs');
const path = require('path');

const STREAM_DEFS = [
  // id, friendly_name, attacher_label
  { id: 'project',         label: 'PROJECT.md cascade',        attacher: 'attachProjectChain' },
  { id: 'briefs',          label: 'briefs/*.md',               attacher: 'attachProjectChain' },
  { id: 'mission',         label: 'mission card',              attacher: 'attachMission' },
  { id: 'stage_pipeline',  label: 'stage pipeline',            attacher: 'attachStagePipeline' },
  { id: 'rationale',       label: 'rationale cascade',         attacher: 'attachRationale' },
  { id: 'pipeline',        label: 'pipeline (v3.4)',           attacher: 'attachPipeline' },
  { id: 'agents',          label: 'agents (git reflog)',       attacher: 'attachAgents' },
  { id: 'architecture',    label: 'architecture nodes',        attacher: 'attachArchitecture' },
  { id: 'milestone_map',   label: 'milestones backfill',       attacher: 'attachMilestoneMap' },
  { id: 'memory_graph',    label: 'MEMORY.md mesh',            attacher: 'attachMemoryGraph' },
  { id: 'lineage',         label: 'CMB lineage',               attacher: 'attachLineage' },
  { id: 'gate_flow',       label: 'gate flow',                 attacher: 'attachGateFlow' },
  { id: 'evidence',        label: 'evidence (smoke verdicts)', attacher: 'attachEvidence' },
  { id: 'telemetry',       label: 'telemetry (token-log)',     attacher: 'attachTelemetry' },
  { id: 'alarms',          label: 'alarms',                    attacher: 'attachAlarms' },
  { id: 'events',          label: 'events (git reflog)',       attacher: 'attachEvents' },
  { id: '_sources',        label: 'liveness heartbeat',        attacher: 'attachSources' },
];

const HEALTH_STATE = new Map();
// Per-source state shape:
// { id, latency_history[], last_ok_at, last_fail_at, consecutive_failures,
//   breaker_state: 'closed'|'open'|'half-open', breaker_opened_at }

const CIRCUIT_OPEN_THRESHOLD = 3;
const CIRCUIT_HALF_OPEN_AFTER_MS = 30000;
const LATENCY_BUDGET_MS = 2000; // composition budget per source
const LATENCY_HISTORY_LEN = 30;

function nowMs() { return Date.now(); }

function getOrInit(id) {
  if (!HEALTH_STATE.has(id)) {
    HEALTH_STATE.set(id, {
      id,
      latency_history: [],
      last_ok_at: null,
      last_fail_at: null,
      consecutive_failures: 0,
      breaker_state: 'closed',
      breaker_opened_at: null,
    });
  }
  return HEALTH_STATE.get(id);
}

function recordOk(id, latencyMs) {
  const s = getOrInit(id);
  s.latency_history.push(latencyMs);
  if (s.latency_history.length > LATENCY_HISTORY_LEN) s.latency_history.shift();
  s.last_ok_at = nowMs();
  s.consecutive_failures = 0;
  if (s.breaker_state !== 'closed') s.breaker_state = 'closed';
  s.breaker_opened_at = null;
  return s;
}

function recordFail(id, reason) {
  const s = getOrInit(id);
  s.last_fail_at = nowMs();
  s.last_fail_reason = String(reason || '').slice(0, 200);
  s.consecutive_failures += 1;
  if (s.consecutive_failures >= CIRCUIT_OPEN_THRESHOLD && s.breaker_state === 'closed') {
    s.breaker_state = 'open';
    s.breaker_opened_at = nowMs();
  }
  return s;
}

function shouldAttemptProbe(id) {
  const s = getOrInit(id);
  if (s.breaker_state !== 'open') return true;
  // Half-open after cooldown
  if (s.breaker_opened_at && nowMs() - s.breaker_opened_at > CIRCUIT_HALF_OPEN_AFTER_MS) {
    s.breaker_state = 'half-open';
    return true;
  }
  return false;
}

function timedAttach(id, attachFn) {
  // Wrap an attach function: measure latency + record ok/fail. Returns the
  // attach result (or null on circuit-open).
  if (!shouldAttemptProbe(id)) return { circuit: 'open' };
  const start = nowMs();
  try {
    const result = attachFn();
    recordOk(id, nowMs() - start);
    return { ok: true, result };
  } catch (e) {
    recordFail(id, e && e.message);
    return { ok: false, reason: String(e && e.message || e) };
  }
}

function p95(arr) {
  if (!arr.length) return 0;
  const sorted = arr.slice().sort(function (a, b) { return a - b; });
  const idx = Math.max(0, Math.floor(sorted.length * 0.95) - 1);
  return sorted[idx];
}
function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
}

function summarize() {
  const out = STREAM_DEFS.map(function (def) {
    const s = HEALTH_STATE.get(def.id) || getOrInit(def.id);
    return {
      id: def.id,
      label: def.label,
      breaker: s.breaker_state,
      consecutive_failures: s.consecutive_failures,
      last_ok_at_sec_ago: s.last_ok_at ? Math.floor((nowMs() - s.last_ok_at) / 1000) : null,
      last_fail_at_sec_ago: s.last_fail_at ? Math.floor((nowMs() - s.last_fail_at) / 1000) : null,
      last_fail_reason: s.last_fail_reason || null,
      latency_p95_ms: Math.round(p95(s.latency_history)),
      latency_avg_ms: Math.round(avg(s.latency_history)),
      latency_budget_ms: LATENCY_BUDGET_MS,
      over_budget: p95(s.latency_history) > LATENCY_BUDGET_MS,
    };
  });
  return out;
}

function attachStreamHealth(output) {
  // Attach per-stream health snapshot to output. Operator-visible in the
  // cockpit's §6 Evidence section under a STREAM HEALTH panel.
  output.stream_health = {
    streams: summarize(),
    thresholds: {
      circuit_open_after_consecutive_failures: CIRCUIT_OPEN_THRESHOLD,
      circuit_half_open_after_ms: CIRCUIT_HALF_OPEN_AFTER_MS,
      latency_budget_ms: LATENCY_BUDGET_MS,
    },
  };
  return output;
}

function persist() {
  try {
    const dir = '.planning/runtime';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), streams: summarize() });
    fs.appendFileSync(path.join(dir, 'stream-health.jsonl'), line + '\n', 'utf8');
  } catch (_e) { /* ignore */ }
}

module.exports = {
  STREAM_DEFS,
  timedAttach,
  recordOk,
  recordFail,
  shouldAttemptProbe,
  summarize,
  attachStreamHealth,
  persist,
  // Constants exposed for SACs
  CIRCUIT_OPEN_THRESHOLD,
  LATENCY_BUDGET_MS,
};
