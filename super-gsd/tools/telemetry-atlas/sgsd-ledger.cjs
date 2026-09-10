'use strict';
// Pure, content-free projection of existing SGSD operational records.
const crypto = require('node:crypto');
const { digest, validate } = require('./contract.cjs');

const freezeSource = (family, format, mode, detailCoverage, paths, extra = {}) => Object.freeze({
  family, format, mode, detail_coverage: detailCoverage, paths: Object.freeze(paths), ...extra
});
const SOURCES = Object.freeze({
  gate_value: freezeSource('gate_value', 'jsonl', 'append', 'typed_partial', ['.planning/metrics/gate-value-log.jsonl']),
  review: freezeSource('review', 'jsonl', 'rewrite', 'typed_partial', ['.planning/metrics/review-ledger.jsonl']),
  commit_review: freezeSource('commit_review', 'jsonl', 'append', 'typed_partial', ['.planning/phases/*/commit-reviews.jsonl', '.planning/milestones/*/phases/*/commit-reviews.jsonl'],
    { fallback_for: 'review', collect_when_primary_absent: true }),
  gate_evidence: freezeSource('gate_evidence', 'jsonl', 'append', 'typed_partial', ['.planning/metrics/gate-evidence.jsonl']),
  muda: freezeSource('muda', 'jsonl', 'append', 'typed_partial', ['.planning/metrics/muda-log.jsonl']),
  route_decision: freezeSource('route_decision', 'jsonl', 'append', 'typed_partial', ['.planning/metrics/route-decisions.jsonl']),
  edge_guard: freezeSource('edge_guard', 'jsonl', 'append', 'typed_partial', ['.planning/metrics/edge-guard-log.jsonl']),
  orchestrator_live: freezeSource('orchestrator_live', 'jsonl', 'append', 'typed_partial', ['.planning/ORCHESTRATOR-LIVE.jsonl']),
  worker: freezeSource('worker', 'jsonl', 'append', 'typed_partial', ['.planning/metrics/worker-events.jsonl']),
  worker_state: freezeSource('worker_state', 'json', 'snapshot', 'typed_partial', ['.planning/worker-sessions/*/state.json']),
  wrapper_result: freezeSource('wrapper_result', 'json', 'immutable', 'typed_partial', ['.planning/worker-sessions/*/wrapper-result.json']),
  generic_metric: freezeSource('generic_metric', 'jsonl', 'append', 'generic', ['.planning/metrics/*.jsonl'], {
    exclude_basenames: Object.freeze(['gate-value-log.jsonl','review-ledger.jsonl','gate-evidence.jsonl','muda-log.jsonl',
      'route-decisions.jsonl','edge-guard-log.jsonl','worker-events.jsonl']),
    exclude_prefixes: Object.freeze(['sgsd-atlas-'])
  })
});

const PROJECT = /^[a-f0-9]{64}$/;
const HEX = /^[a-f0-9]{64}$/;
const UUID_BODY = '[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const UUID = new RegExp(`^${UUID_BODY}$`, 'i');
const SGSD_RUN = new RegExp(`^sgsd-${UUID_BODY}$`, 'i');
const ATOM = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/;
const STATUS = new Set(['ok','warn','fail','skipped','timeout','blocked','starting','running','waiting_input','completed','failed','orphaned','stopped','queued','unconfirmed']);
const VERDICT = new Set(['pass','warn','fail','block','skip','critical','critical-halt','logged','halt','ok']);
const GATES = new Set(['per-dispatch-ATC','phase-level-ATC','classifier-haiku','context-selector-haiku',
  'sgsd-recall-queries','intent-injection','MUDA-waste-audit','qualitative-waste-audit',
  'sgsd-curate-learnings','token-log','vtp-enrichment','verifier-row-arithmetic','verifier-detail-vs-summary']);
const PROBES = new Set(['haiku_fails','narrative_age_sec','git_spawn_pct','extra_processing','inventory']);
const COVERAGE = new Set(['measured','partial','no_input','synthetic','unknown']);
const MUDA_REASON = new Set(['disabled','mechanical_findings','insufficient_diff','dry_run','attempt_failed','completed']);
const ROUTES = new Set(['milestone_promotion','phase_dispatch_first','executor_choice','gate_skip','codex_route',
  'handoff_decision','gate_override','dispatch_route','vtp_bridge','execution_route','vtp_triage_advisory']);
const LIVE = new Set(['run_started','phase_started','plan_selected','agent_dispatched','agent_progress','agent_completed',
  'codex_started','codex_completed','gate_started','gate_passed','gate_warned','gate_failed',
  'token_threshold_crossed','checkpoint_written','operator_attention_required','run_completed']);
const ROLE = new Set(['executor','reviewer','orchestrator','researcher','planner','verifier','subagent']);
const WORKER_BOUNDARY = new Set(['create','save','submit','result']);
const WORKER_ACTION = new Set(['reply','steer','stop']);
const WORKER_RESULT = new Set(['applied','rejected','unconfirmed']);
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const only = (value, names) => plain(value) && Object.keys(value).every(name => names.includes(name));
const hash = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const boolOrNull = value => value === null || typeof value === 'boolean';
const numberOrNull = value => value === null || finite(value);
const iso = value => typeof value === 'string' && TIMESTAMP.test(value) && Number.isFinite(Date.parse(value));
const enumValue = (value, values) => typeof value === 'string' && values.has(value.toLowerCase()) ? value.toLowerCase() : null;
const id = value => typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : null;
const hashed = value => typeof value === 'string' && value.length ? hash(value) : null;
function selectedIdentifier(value, name) {
  const exact = id(value);
  const prehashed = typeof value === 'string' && HEX.test(value) ? value : null;
  return { [name]: exact, [`${name}_sha256`]: exact ? null : prehashed || hashed(value),
    [`${name}_identity`]: exact ? 'exact_uuid' : typeof value === 'string' && value.length ? 'hashed_non_join' : 'absent' };
}

function schemaReason(family, row) {
  if (!plain(row)) return 'invalid_source_row';
  if (row.schema_version != null && row.schema_version !== 1) return 'unsupported_source_schema';
  if (row.envelope_version != null && row.envelope_version !== 1) return 'unsupported_source_schema';
  if (family === 'orchestrator_live' && row.schema_version !== 1) return 'unsupported_source_schema';
  if (['worker','worker_state','wrapper_result'].includes(family) && row.schema_version !== 1) return 'unsupported_source_schema';
  const logical = reviewLogical(row);
  for (const a of [row.atlas_observation, logical !== row ? logical.atlas_observation : null]) {
    if (a == null) continue;
    if (!only(a, ['schema_version','observation_id','sgsd_run_id','gate_invocation_id'])
        || a.schema_version !== 1 || !UUID.test(a.observation_id || '')
        || (a.gate_invocation_id != null && !UUID.test(a.gate_invocation_id))
        || (a.sgsd_run_id != null && typeof a.sgsd_run_id !== 'string')) return 'invalid_observation_shape';
  }
  if (family === 'muda' && row.atlas_muda != null && mudaDetail(row) === null) return 'invalid_muda_shape';
  return null;
}

function recordedRun(row, logical) {
  const candidates = [row.atlas_observation?.sgsd_run_id, row.sgsd_run_id, row.atlas_run_id,
    logical !== row ? logical.atlas_run_id : null, logical !== row ? logical.sgsd_run_id : null];
  const present = candidates.find(value => value != null);
  return { value: SGSD_RUN.test(present || '') ? present : null,
    invalid: present != null && !SGSD_RUN.test(present) };
}

function actualTime(row, logical, observedAt) {
  for (const value of [row.ts,row.occurred_at,row.generated_at,row.recorded_at,row.finished_at,row.updated_at,row.created_at,
    logical !== row ? logical.ts : null, logical !== row ? logical.occurred_at : null,
    logical !== row ? logical.generated_at : null, logical !== row ? logical.recorded_at : null]) {
    if (iso(value)) return { value, unknown: false };
  }
  return { value: observedAt, unknown: true };
}

function reviewLogical(row) { return plain(row._legacy) ? row._legacy : row; }
function observation(row, logical) { return plain(row.atlas_observation) ? row.atlas_observation
  : logical !== row && plain(logical.atlas_observation) ? logical.atlas_observation : null; }

function identityFor(family, row, logical, recordDigest, sourceId, sequence) {
  const obs = observation(row, logical);
  if (obs) return { key: ['producer_observation', family === 'commit_review' ? 'review' : family,
    obs.observation_id.toLowerCase()], provenance: 'producer_observation' };
  if (family === 'wrapper_result' && UUID.test(row.wrapper_attempt_id || ''))
    return { key: ['wrapper_attempt', row.wrapper_attempt_id.toLowerCase()], provenance: 'recorded_attempt_identity' };
  return { key: ['source_occurrence_fallback', family, hash(sourceId), sequence, recordDigest],
    provenance: 'source_occurrence_fallback' };
}

function commonDetail(family, provenance, sourceId, recordDigest, sequence) {
  return { schema_version: 1, family, detail_coverage: SOURCES[family].detail_coverage,
    identity_provenance: provenance, source_occurrence_id: hash(sourceId),
    source_record_sha256: recordDigest, sequence };
}

function counts(row, keys) {
  const out = {};
  for (const [source, target] of Object.entries(keys)) if (finite(row[source])) out[target] = row[source];
  return out;
}

function gateDetail(row, common) {
  const outcome = enumValue(row.outcome || row.verdict, VERDICT);
  const status = enumValue(row.status, STATUS);
  return { ...common, outcome: outcome || 'unknown', status: status || 'unknown',
    duration_ms: integer(row.duration_ms) ? row.duration_ms : null,
    gate_name: GATES.has(row.gate) ? row.gate : null, gate_sha256: GATES.has(row.gate) ? null : hashed(row.gate) };
}

function reviewDetail(row, common) {
  const logical = reviewLogical(row), verdict = enumValue(logical.verdict || row.status, VERDICT);
  const rawPhase = row._source_phase || logical.phase || row.phase || null;
  const phase = typeof rawPhase === 'string' ? (/^\d+/.exec(rawPhase)?.[0] || rawPhase) : rawPhase;
  return { ...common, verdict: verdict || 'unknown',
    ...counts(logical, { critical: 'critical_count', warning: 'warning_count', pass_rate: 'pass_rate', duration_ms: 'duration_ms' }),
    plan_sha256: hashed(logical.plan), report_sha256: HEX.test(logical.report_sha256 || '') ? logical.report_sha256 : null,
    semantic_equivalence_sha256: hash(['legacy_review_semantic', logical.ts || row.ts || null,
      logical.plan || null, logical.provider || null, phase]), semantic_equivalence_confidence: 'unknown',
    findings_detail_supplied: typeof logical.findings_detail_supplied === 'boolean' ? logical.findings_detail_supplied : null,
    fallback_triggered: typeof logical.fallback_triggered === 'boolean' ? logical.fallback_triggered : null };
}

function mudaProbe(value, coverage) {
  const verdict = enumValue(plain(value) ? value.verdict : value, new Set(['pass','warn','fail','skip'])) || 'unknown';
  if (!plain(value)) return { verdict, value: null, warn_threshold: null, fail_threshold: null,
    denominator: null, no_input: null, measurement: 'unknown' };
  const noInput = boolOrNull(value.no_input) ? value.no_input : null;
  return { verdict, value: numberOrNull(value.value) ? value.value : null,
    warn_threshold: numberOrNull(value.warn_threshold) ? value.warn_threshold : null,
    fail_threshold: numberOrNull(value.fail_threshold) ? value.fail_threshold : null,
    denominator: numberOrNull(value.denominator) ? value.denominator : null, no_input: noInput,
    measurement: value.no_input === true ? 'no_input' : coverage === 'synthetic' ? 'synthetic'
      : coverage === 'measured' || coverage === 'partial' ? 'measured' : 'unknown' };
}

function mudaDetail(row, common) {
  const atlas = row.atlas_muda;
  if (atlas == null) {
    if (!plain(row.probes)) return common ? { ...common, warn_count: finite(row.warn) ? row.warn : null,
      fail_count: finite(row.fail) ? row.fail : null, exit_code: finite(row.exit) ? row.exit : null,
      coverage: 'unknown', no_input: null, synthetic: false, probes: {} } : {};
    const probes = {};
    for (const [name, value] of Object.entries(row.probes)) if (PROBES.has(name)) probes[name] = mudaProbe(value, 'unknown');
    return common ? { ...common, warn_count: finite(row.warn) ? row.warn : null,
      fail_count: finite(row.fail) ? row.fail : null, exit_code: finite(row.exit) ? row.exit : null,
      coverage: 'unknown', no_input: null, synthetic: false, probes } : {};
  }
  if (!only(atlas, ['schema_version','mechanical','qualitative']) || atlas.schema_version !== 1
      || !only(atlas.mechanical, ['executed','coverage','no_input','synthetic','exit','probes'])
      || !only(atlas.qualitative, ['enabled','diff_lines','mechanical_exit','dry_run','eligible','attempted','exit_code','closed_reason','critical','warnings'])) return null;
  const m = atlas.mechanical, q = atlas.qualitative;
  if (typeof m.executed !== 'boolean' || !COVERAGE.has(m.coverage) || !boolOrNull(m.no_input)
      || typeof m.synthetic !== 'boolean' || !numberOrNull(m.exit) || !plain(m.probes)
      || Object.keys(m.probes).some(name => !PROBES.has(name))) return null;
  for (const probe of Object.values(m.probes)) {
    if (!only(probe, ['value','denominator','verdict','warn_threshold','fail_threshold','no_input'])
        || !['PASS','WARN','FAIL','SKIP'].includes(probe.verdict)
        || !numberOrNull(probe.value) || !numberOrNull(probe.denominator)
        || !numberOrNull(probe.warn_threshold) || !numberOrNull(probe.fail_threshold)
        || !boolOrNull(probe.no_input)) return null;
  }
  if (typeof q.enabled !== 'boolean' || !finite(q.diff_lines) || !numberOrNull(q.mechanical_exit)
      || typeof q.dry_run !== 'boolean' || typeof q.eligible !== 'boolean' || typeof q.attempted !== 'boolean'
      || !numberOrNull(q.exit_code) || !MUDA_REASON.has(q.closed_reason)
      || !numberOrNull(q.critical) || !numberOrNull(q.warnings)) return null;
  if (!common) return {};
  const probes = Object.fromEntries(Object.entries(m.probes).map(([name, value]) => [name,mudaProbe(value,m.coverage)]));
  return { ...common, warn_count: finite(row.warn) ? row.warn : null, fail_count: finite(row.fail) ? row.fail : null,
    exit_code: finite(row.exit) ? row.exit : null, coverage: m.coverage, no_input: m.no_input,
    synthetic: m.synthetic, executed: m.executed, probes,
    qualitative: { enabled: q.enabled, diff_lines: q.diff_lines, mechanical_exit: q.mechanical_exit,
      dry_run: q.dry_run, eligible: q.eligible, attempted: q.attempted, exit_code: q.exit_code,
      closed_reason: q.closed_reason, critical_count: q.critical, warning_count: q.warnings } };
}

function detailFor(family, row, common) {
  if (family === 'gate_value') return gateDetail(row, common);
  if (['review','commit_review'].includes(family)) return reviewDetail(row, common);
  if (family === 'muda') return mudaDetail(row, common);
  if (family === 'gate_evidence') return { ...common, status: enumValue(row.status, STATUS) || 'unknown',
    signal_sha256: hashed(row.signal), duration_ms: integer(row.duration_ms) ? row.duration_ms : null,
    route_ok: typeof row.route_ok === 'boolean' ? row.route_ok : null,
    eligible: typeof row.eligible === 'boolean' ? row.eligible : null,
    fired: typeof row.fired === 'boolean' ? row.fired : null,
    decision: enumValue(row.decision, new Set(['allow','deny','skip','fire','eligible','ineligible'])) || null,
    outcome: enumValue(row.outcome, VERDICT),
    ...counts(row, { evidence_hit_count: 'evidence_hit_count', iterations: 'iterations', p95_ms: 'p95_ms' }) };
  if (family === 'route_decision') return { ...common, status: enumValue(row.status, STATUS) || 'unknown',
    boundary: ROUTES.has(row.boundary) ? row.boundary : 'unknown', duration_ms: integer(row.duration_ms) ? row.duration_ms : null,
    fallback_triggered: typeof row.decision?.fallback_triggered === 'boolean' ? row.decision.fallback_triggered : null,
    exit_code: finite(row.decision?.exit) ? row.decision.exit : null,
    timeout_hit: typeof row.decision?.timeout_hit === 'boolean' ? row.decision.timeout_hit : null };
  if (family === 'edge_guard') return { ...common, resolution: enumValue(row.resolution, VERDICT) || 'unknown',
    from_step: finite(Number(row.from_step)) ? Number(row.from_step) : null,
    to_step: finite(Number(row.to_step)) ? Number(row.to_step) : null,
    expected_emit_count: Array.isArray(row.expected_emits) ? row.expected_emits.length : null,
    actual_emit_count: Array.isArray(row.actual_emits) ? row.actual_emits.length : null,
    missing_emit_count: Array.isArray(row.missing_emits) ? row.missing_emits.length : null,
    gate_name: GATES.has(row.gate) ? row.gate : null, gate_sha256: GATES.has(row.gate) ? null : hashed(row.gate) };
  if (family === 'orchestrator_live') return { ...common, event_type: LIVE.has(row.type) ? row.type : 'unknown',
    status: enumValue(row.data?.status, STATUS), ...selectedIdentifier(row.data?.worker_id, 'worker_id'),
    gate_name: GATES.has(row.data?.gate) ? row.data.gate : null };
  if (family === 'worker') return { ...common, boundary: WORKER_BOUNDARY.has(row.boundary) ? row.boundary : null,
    action: WORKER_ACTION.has(row.action) ? row.action : null, status: enumValue(row.status, STATUS),
    result_status: enumValue(row.result_status, WORKER_RESULT), ...selectedIdentifier(row.worker_id, 'worker_id'),
    ...selectedIdentifier(row.wrapper_attempt_id, 'attempt_id'), ...selectedIdentifier(row.thread_id, 'thread_id'),
    ...selectedIdentifier(row.turn_id, 'turn_id'), role: ROLE.has(row.role) ? row.role : null,
    pending_count: integer(row.pending_count) ? row.pending_count : null };
  if (family === 'worker_state') return { ...common, status: enumValue(row.status, STATUS), ...selectedIdentifier(row.worker_id, 'worker_id'),
    ...selectedIdentifier(row.wrapper_attempt_id, 'attempt_id'), ...selectedIdentifier(row.thread_id, 'thread_id'),
    ...selectedIdentifier(row.turn_id, 'turn_id'),
    role: ROLE.has(row.role) ? row.role : null, pending_count: Array.isArray(row.pending) ? row.pending.length : null };
  if (family === 'wrapper_result') return { ...common, status: finite(row.exit_code) ? row.exit_code === 0 ? 'completed' : 'failed' : 'unknown',
    exit_code: finite(row.exit_code) ? row.exit_code : null, ...selectedIdentifier(row.worker_id, 'worker_id'),
    ...selectedIdentifier(row.wrapper_attempt_id, 'attempt_id'), ...selectedIdentifier(row.thread_id, 'thread_id'),
    ...selectedIdentifier(row.turn_id, 'turn_id'), report_sha256: HEX.test(row.sha256 || '') ? row.sha256 : null,
    report_bytes: integer(row.bytes) ? row.bytes : null };
  return { ...common, detail_coverage: 'unknown', activity: true };
}

function projectRecord(args) {
  if (!plain(args) || !Object.hasOwn(SOURCES, args.family)) return { event: null, detail: null, reason: 'unknown_family' };
  const { family, row, projectId, sourceId, recordDigest, sequence, observedAt } = args;
  if (!PROJECT.test(projectId || '')) return { event: null, detail: null, reason: 'invalid_project_id' };
  if (typeof sourceId !== 'string' || !sourceId.length || Buffer.byteLength(sourceId) > 2048)
    return { event: null, detail: null, reason: 'invalid_source_id' };
  if (!HEX.test(recordDigest || '')) return { event: null, detail: null, reason: 'invalid_record_digest' };
  if (!integer(sequence)) return { event: null, detail: null, reason: 'invalid_sequence' };
  if (!iso(observedAt)) return { event: null, detail: null, reason: 'invalid_observed_at' };
  const sourceReason = schemaReason(family, row);
  if (sourceReason) return { event: null, detail: null, reason: sourceReason };
  const logical = reviewLogical(row), identity = identityFor(family, row, logical, recordDigest, sourceId, sequence);
  const run = recordedRun(row, logical), time = actualTime(row, logical, observedAt);
  const reasons = [];
  if (run.invalid) reasons.push('invalid_recorded_run_identity');
  if (time.unknown) reasons.push('unknown_time_observed_at');
  if (family === 'generic_metric') reasons.push('semantic_detail_unknown');
  const reason = reasons[0] || null;
  const weakIdentity = identity.provenance === 'source_occurrence_fallback';
  const common = commonDetail(family, identity.provenance, sourceId, recordDigest, sequence);
  if (weakIdentity) reasons.push('underlying_invocation_unknown');
  if (reasons.length) common.capture_reasons = reasons;
  const detail = detailFor(family, row, common);
  if (!detail) return { event: null, detail: null, reason: 'invalid_source_shape' };
  const occurrence = hash(sourceId), eventType = family === 'route_decision' ? 'handoff'
    : ['gate_value','gate_evidence','edge_guard'].includes(family) ? 'gate'
    : ['review','commit_review','muda'].includes(family) ? 'outcome'
    : family === 'generic_metric' ? 'coverage' : 'artifact';
  const status = enumValue(row.status, STATUS), verdict = enumValue(row.outcome || logical.verdict || row.resolution, VERDICT);
  const event = {
    schema_version: 1, source_event_id: hash(['sgsd-ledger-event-v1', ...identity.key]), occurred_at: time.value,
    event_sequence: sequence, event_type: eventType,
    source: { kind: 'sgsd_ledger', instance: projectId, version: `occ-${occurrence}`,
      provenance: identity.provenance,
      confidence: ['producer_observation','recorded_attempt_identity'].includes(identity.provenance) ? 'exact'
        : weakIdentity ? 'unknown' : 'derived',
      completeness_reason: weakIdentity ? 'underlying_invocation_unknown'
        : reason || (family === 'generic_metric' ? 'semantic_detail_unknown' : 'content_free_projection') },
    identity: { sgsd_run_id: run.value, gate_invocation_id: id(observation(row, logical)?.gate_invocation_id),
      attempt_id: id(row.wrapper_attempt_id), thread_id: id(row.thread_id), turn_id: id(row.turn_id) },
    scope: { launcher_repo_id: projectId,
      milestone: hashed(row.milestone || logical.milestone), phase: hashed(row.phase || logical.phase),
      plan: hashed(row.plan || logical.plan), gate: GATES.has(row.gate) ? row.gate : hashed(row.gate),
      role: ROLE.has(row.role) ? row.role : null, attribution_method: 'project_registration' },
    payload: { purpose: family, artifact_ref: digest(detail), content_digest: recordDigest, raw_content_recorded: false }
  };
  const duration = integer(row.duration_ms) ? row.duration_ms : integer(logical.duration_ms) ? logical.duration_ms : null;
  if (status) event.execution = { status };
  if (duration != null) event.usage = { duration_ms: duration };
  if (eventType === 'gate') event.gate = { verdict: verdict || status || 'unknown',
    eligible: typeof row.eligible === 'boolean' ? row.eligible : null,
    fired: typeof row.fired === 'boolean' ? row.fired : null };
  if (eventType === 'outcome') event.outcome = { gate_outcome: verdict || status || 'unknown' };
  const invalid = validate(event);
  if (invalid) return { event: null, detail: null, reason: `canonical_${invalid}` };
  return { event: Object.freeze(event), detail: Object.freeze(detail), reason };
}

module.exports = Object.freeze({ SOURCES, projectRecord });
