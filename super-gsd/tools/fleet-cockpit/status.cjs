// Phase 162 P162-T2: pure fleet status derivation.
// Consumes the cockpit-state adapter envelope without mutating it.
// ASCII-only. No runtime dependencies.

'use strict';

var DEFAULT_STALE_AFTER_MS = 86400000;
var RECOGNISED_AGENT_NAMES = Object.freeze([
  'gsd-executor',
  'gsd-planner',
  'gsd-researcher',
  'gsd-verifier',
  'codex',
  'planner',
  'researcher',
  'executor',
  'verifier',
  'reviewer'
]);
var HEADLINES = Object.freeze({
  gate_failed: 'gate failed',
  operator_attention_required: 'operator attention required',
  blockers_present: 'blockers present',
  checkpoint_waiting_for_run: 'checkpoint waiting for run',
  codex_live: 'Codex live',
  agent_in_flight: 'agent in flight',
  state_md_stale: 'STATE.md stale',
  last_activity_stale: 'last activity stale',
  codex_stale: 'Codex signal stale',
  idle_no_signal: 'idle',
  snapshot_unavailable: 'snapshot unavailable'
});

function cloneValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(function (item) { return cloneValue(item); });
  }
  var result = {};
  Object.keys(value).forEach(function (key) {
    result[key] = cloneValue(value[key]);
  });
  return result;
}

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value : {};
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function valueOrNull(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key)
    ? cloneValue(object[key]) : null;
}

function parseTimestamp(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  var parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecognisedAgent(row) {
  if (!row || typeof row !== 'object') return false;
  if (typeof row.model === 'string' && row.model.trim() !== '') return true;
  return typeof row.agent === 'string'
    && RECOGNISED_AGENT_NAMES.indexOf(row.agent.trim()) !== -1;
}

function filterAgents(section) {
  var agents = objectOrEmpty(section);
  var roster = Array.isArray(agents.roster)
    ? agents.roster.filter(isRecognisedAgent).map(cloneValue) : [];
  var sourceByPhase = objectOrEmpty(agents.by_phase);
  var byPhase = {};
  Object.keys(sourceByPhase).forEach(function (phase) {
    var rows = Array.isArray(sourceByPhase[phase]) ? sourceByPhase[phase] : [];
    byPhase[phase] = rows.filter(isRecognisedAgent).map(cloneValue);
  });
  return {
    state: roster.length > 0 ? 'data' : 'no_data',
    roster: roster,
    by_phase: byPhase,
    count: roster.length,
    reason: roster.length > 0 ? null : 'no_agent_data'
  };
}

function deriveTokens(section) {
  var tokens = objectOrEmpty(section);
  if (tokens.source === 'absent') {
    return {
      state: 'no_data',
      value: null,
      reason: 'tokens_source_absent',
      source: 'absent'
    };
  }
  if (finiteNumber(tokens.total_tokens)) {
    return {
      state: 'data',
      value: tokens.total_tokens,
      reason: null,
      source: valueOrNull(tokens, 'source')
    };
  }
  return {
    state: 'no_data',
    value: null,
    reason: 'token_data_unavailable',
    source: valueOrNull(tokens, 'source')
  };
}

function deriveGates(section) {
  var gates = objectOrEmpty(section);
  var items = Array.isArray(gates.gates) ? cloneValue(gates.gates) : [];
  var latest = cloneValue(objectOrEmpty(gates.latest_per_gate));
  var liveCount = finiteNumber(gates.live_event_count)
    ? gates.live_event_count : null;
  if (items.length === 0 && Object.keys(latest).length === 0
      && liveCount === 0) {
    return {
      state: 'no_data',
      reason: 'no_gate_data',
      gates: items,
      latest_per_gate: latest,
      live_event_count: liveCount
    };
  }
  if (Object.keys(gates).length === 0) {
    return {
      state: 'no_data',
      reason: 'gate_data_unavailable',
      gates: items,
      latest_per_gate: latest,
      live_event_count: liveCount
    };
  }
  return {
    state: 'data',
    reason: null,
    gates: items,
    latest_per_gate: latest,
    live_event_count: liveCount
  };
}

function deriveArtifacts(section) {
  var artifacts = objectOrEmpty(section);
  var source = valueOrNull(artifacts, 'source');
  var items = Array.isArray(artifacts.items) ? cloneValue(artifacts.items) : [];
  if (source === 'phases_dir_missing') {
    return {
      state: 'no_data',
      reason: 'phases_dir_missing',
      source: source,
      items: items
    };
  }
  if (Object.keys(artifacts).length === 0) {
    return {
      state: 'no_data',
      reason: 'artifact_data_unavailable',
      source: source,
      items: items
    };
  }
  return { state: 'data', reason: null, source: source, items: items };
}

function deriveObjectiveConflict(section) {
  var objective = objectOrEmpty(section);
  if (objective.projection_stale !== true) return null;
  return {
    milestone: valueOrNull(objective, 'milestone'),
    phase: valueOrNull(objective, 'phase'),
    source: valueOrNull(objective, 'source'),
    state_md_milestone: valueOrNull(objective, 'state_md_milestone'),
    state_md_phase: valueOrNull(objective, 'state_md_phase'),
    effective_confidence: valueOrNull(objective, 'effective_confidence')
  };
}

function hasFailedGate(section) {
  var latest = objectOrEmpty(objectOrEmpty(section).latest_per_gate);
  return Object.keys(latest).some(function (name) {
    var verdict = objectOrEmpty(latest[name]).verdict;
    if (typeof verdict !== 'string') return false;
    var normalized = verdict.toLowerCase();
    return normalized === 'fail' || normalized === 'failed';
  });
}

function hasOperatorAttention(section) {
  var blockers = objectOrEmpty(section);
  var items = Array.isArray(blockers.items) ? blockers.items : [];
  return items.some(function (item) {
    return item && item.source === 'live_events.operator_attention_required';
  });
}

function hasInFlightAgent(agents) {
  var completed = Object.create(null);
  agents.roster.forEach(function (row) {
    if (!row || typeof row.task_id !== 'string' || row.task_id.trim() === '') return;
    if ((typeof row.completed_ts === 'string' && row.completed_ts.trim() !== '')
        || (row.outcome !== null && row.outcome !== undefined)) {
      completed[row.task_id] = true;
    }
  });
  return agents.roster.some(function (row) {
    return row && typeof row.task_id === 'string' && row.task_id.trim() !== ''
      && !completed[row.task_id];
  });
}

function deriveLaneStatus(snapshot, options) {
  var degraded = snapshot && Array.isArray(snapshot._section_degraded)
    ? cloneValue(snapshot._section_degraded) : [];
  if (!snapshot || typeof snapshot !== 'object' || snapshot.ok !== true
      || !snapshot.data || typeof snapshot.data !== 'object') {
    return {
      status: 'error',
      headline: HEADLINES.snapshot_unavailable,
      reasons: ['snapshot_unavailable'],
      phase: null,
      phase_name: null,
      last_activity_ts: null,
      age_minutes: null,
      conflict: false,
      degraded: degraded,
      agents: filterAgents(null),
      tokens: deriveTokens(null),
      gates: deriveGates(null),
      artifacts: deriveArtifacts(null),
      objective_conflict: null
    };
  }

  var data = snapshot.data;
  var objective = objectOrEmpty(data.objective);
  var blockers = objectOrEmpty(data.blockers);
  var codex = objectOrEmpty(data.codex);
  var staleness = objectOrEmpty(data.staleness);
  var stateMd = objectOrEmpty(staleness.state_md);
  var resume = objectOrEmpty(data.resume_command);
  var agents = filterAgents(data.agents);
  var conflictDetail = deriveObjectiveConflict(objective);
  var opts = objectOrEmpty(options);
  var nowMs = finiteNumber(opts.nowMs) ? opts.nowMs : Date.now();
  var staleAfterMs = finiteNumber(opts.staleAfterMs) && opts.staleAfterMs >= 0
    ? opts.staleAfterMs : DEFAULT_STALE_AFTER_MS;
  var activityMs = parseTimestamp(objectOrEmpty(data.now).ts);
  var ageMinutes = activityMs === null ? null
    : Math.max(0, Math.floor((nowMs - activityMs) / 60000));
  var attentionReasons = [];
  var runningReasons = [];
  var staleReasons = [];

  if (hasFailedGate(data.gates)) attentionReasons.push('gate_failed');
  if (hasOperatorAttention(blockers)) {
    attentionReasons.push('operator_attention_required');
  }
  if (finiteNumber(blockers.count) && blockers.count > 0) {
    attentionReasons.push('blockers_present');
  }
  if (resume.source === 'live_events.checkpoint_written') {
    attentionReasons.push('checkpoint_waiting_for_run');
  }

  var codexFresh = (codex.live_state === 'ok' || codex.live_state === 'running')
    && finiteNumber(codex.live_json_age_seconds)
    && finiteNumber(codex.stale_threshold_seconds)
    && codex.live_json_age_seconds < codex.stale_threshold_seconds;
  if (codexFresh) runningReasons.push('codex_live');
  if (hasInFlightAgent(agents)) runningReasons.push('agent_in_flight');

  if (stateMd.stale === true) staleReasons.push('state_md_stale');
  if (activityMs !== null && nowMs - activityMs > staleAfterMs) {
    staleReasons.push('last_activity_stale');
  }
  if (codex.live_state === 'stale') staleReasons.push('codex_stale');

  var status;
  var reasons;
  if (attentionReasons.length > 0) {
    status = 'attention';
    reasons = attentionReasons;
  } else if (runningReasons.length > 0) {
    status = 'running';
    reasons = runningReasons;
  } else if (staleReasons.length > 0) {
    status = 'stale';
    reasons = staleReasons;
  } else {
    status = 'idle';
    reasons = ['idle_no_signal'];
  }
  if (conflictDetail) reasons.push('state_projection_conflict');

  return {
    status: status,
    headline: HEADLINES[reasons[0]],
    reasons: reasons,
    phase: valueOrNull(objective, 'phase'),
    phase_name: valueOrNull(objective, 'phase_name'),
    last_activity_ts: activityMs === null ? null : data.now.ts,
    age_minutes: ageMinutes,
    conflict: !!conflictDetail,
    degraded: degraded,
    agents: agents,
    tokens: deriveTokens(data.tokens),
    gates: deriveGates(data.gates),
    artifacts: deriveArtifacts(data.artifacts),
    objective_conflict: conflictDetail
  };
}

module.exports = {
  deriveLaneStatus: deriveLaneStatus,
  filterAgents: filterAgents,
  deriveTokens: deriveTokens,
  deriveGates: deriveGates,
  deriveArtifacts: deriveArtifacts,
  deriveObjectiveConflict: deriveObjectiveConflict,
  DEFAULT_STALE_AFTER_MS: DEFAULT_STALE_AFTER_MS,
  RECOGNISED_AGENT_NAMES: RECOGNISED_AGENT_NAMES
};
