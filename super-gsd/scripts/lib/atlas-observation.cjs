'use strict';

// Additive, content-free observation metadata for existing append-only writers.
// Every public helper is fail-open: telemetry must never alter producer results.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SGSD_RUN = /^sgsd-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const PROBES = Object.freeze([
  'haiku_fails', 'narrative_age_sec', 'git_spawn_pct', 'extra_processing', 'inventory',
]);
const VERDICTS = new Set(['PASS', 'WARN', 'FAIL', 'SKIP']);
const WORKER_BOUNDARIES = new Set(['create', 'save', 'submit', 'result']);
const WORKER_ACTIONS = new Set(['reply', 'steer', 'stop']);
const WORKER_RESULTS = new Set(['applied', 'rejected', 'unconfirmed']);
const WORKER_ROLES = new Set(['executor', 'reviewer', 'orchestrator', 'researcher', 'planner', 'verifier', 'subagent']);
const WORKER_STATUSES = new Set([
  'ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked', 'starting', 'running',
  'waiting_input', 'completed', 'failed', 'orphaned', 'stopped', 'queued', 'unconfirmed',
]);

function validRun(value) {
  return typeof value === 'string' && SGSD_RUN.test(value) ? value : null;
}

function validUuid(value) {
  return typeof value === 'string' && UUID.test(value) ? value : null;
}

function withObservation(row, context, environment) {
  try {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
    const ctx = context && typeof context === 'object' ? context : {};
    const env = environment && typeof environment === 'object' ? environment : process.env;
    const suppliedRun = validRun(ctx.sgsd_run_id) || validRun(ctx.atlas_run_id);
    return Object.assign({}, row, {
      atlas_observation: {
        schema_version: 1,
        observation_id: crypto.randomUUID(),
        sgsd_run_id: suppliedRun || validRun(env.SGSD_RUN_ID),
        gate_invocation_id: validUuid(ctx.gate_invocation_id),
      },
    });
  } catch {
    return row;
  }
}

function preserveObservation(row, source) {
  try {
    if (!row || typeof row !== 'object' || !source || typeof source !== 'object') return row;
    const value = source.atlas_observation;
    if (!value || value.schema_version !== 1 || !validUuid(value.observation_id)) return row;
    const run = value.sgsd_run_id === null ? null : validRun(value.sgsd_run_id);
    const invocation = value.gate_invocation_id === null ? null : validUuid(value.gate_invocation_id);
    if (run !== value.sgsd_run_id || invocation !== value.gate_invocation_id) return row;
    return Object.assign({}, row, { atlas_observation: {
      schema_version: 1,
      observation_id: value.observation_id,
      sgsd_run_id: run,
      gate_invocation_id: invocation,
    } });
  } catch {
    return row;
  }
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value)
    && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : null;
}

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function thresholds(value) {
  if (typeof value !== 'string') return [null, null];
  const warn = value.match(/warn[^0-9-]*(-?\d+(?:\.\d+)?)/i);
  const fail = value.match(/fail[^0-9-]*(-?\d+(?:\.\d+)?)/i);
  return [warn ? finite(Number(warn[1])) : null, fail ? finite(Number(fail[1])) : null];
}

function denominator(name, evidence) {
  if (typeof evidence !== 'string') return null;
  if (name === 'git_spawn_pct') {
    const match = evidence.match(/^\d+\/(\d+) Bash-git calls in last 100 activity entries$/);
    return match ? finite(Number(match[1])) : null;
  }
  if (name === 'extra_processing') {
    const match = evidence.match(/^\d+ commit-review files, \d+ rows, (\d+) with line counts, \d+ tier\/line mismatches$/);
    return match ? finite(Number(match[1])) : null;
  }
  return null;
}

function inferredNoInput(name, evidence, observedDenominator) {
  if (typeof evidence !== 'string') return null;
  if (name === 'haiku_fails') {
    if (evidence.startsWith('narrative.md.lastfail absent')) return true;
    if (/^narrative\.md\.lastfail = \d+$/.test(evidence)) return false;
  } else if (name === 'narrative_age_sec') {
    if (evidence.startsWith('narrative.md absent')) return true;
    if (evidence.startsWith('narrative.md age ') || evidence === 'narrative.md mtime unreadable') return false;
  } else if (name === 'git_spawn_pct') {
    if (evidence === 'activity-log.jsonl absent') return true;
    if (observedDenominator !== null) return observedDenominator === 0;
  } else if (name === 'extra_processing') {
    if (evidence === 'no commit-reviews.jsonl found') return true;
    if (observedDenominator !== null) return observedDenominator === 0;
  } else if (name === 'inventory') {
    if (evidence === 'no planning dirs scanned') return true;
    if (/^\d+ stale scratch\/draft\/temp planning artifacts/.test(evidence)) return false;
  }
  return null;
}

function qualitativeEvidence(state, mechanicalExit) {
  const enabled = state.enabled === true;
  const diffLines = nonNegativeInteger(state.diffLines) ?? 0;
  const dryRun = state.dryRun === true;
  const eligible = mechanicalExit === 0 && diffLines >= 200 && enabled && !dryRun;
  const attempted = eligible && state.attempted === true;
  const exitCode = attempted && Number.isInteger(state.qualitativeExit) ? state.qualitativeExit : null;
  const parsed = attempted && exitCode === 0 && state.reportParsed === true;
  let closedReason;
  if (dryRun) closedReason = 'dry_run';
  else if (mechanicalExit !== 0) closedReason = 'mechanical_findings';
  else if (diffLines < 200) closedReason = 'insufficient_diff';
  else if (!enabled) closedReason = 'disabled';
  else closedReason = parsed ? 'completed' : 'attempt_failed';
  return {
    enabled,
    diff_lines: diffLines,
    mechanical_exit: mechanicalExit,
    dry_run: dryRun,
    eligible,
    attempted,
    exit_code: exitCode,
    closed_reason: closedReason,
    critical: parsed ? nonNegativeInteger(state.critical) : null,
    warnings: parsed ? nonNegativeInteger(state.warnings) : null,
  };
}

function buildAtlasMuda(probeJson, state) {
  try {
    const source = probeJson && typeof probeJson === 'object' ? probeJson : {};
    const probes = source.probes && typeof source.probes === 'object' ? source.probes : {};
    const input = state && typeof state === 'object' ? state : {};
    const synthetic = input.synthetic === true;
    const executed = !synthetic && input.executed !== false;
    const mechanicalExit = Number.isInteger(input.mechanicalExit) ? input.mechanicalExit : null;
    const details = {};
    for (const name of PROBES) {
      const probe = probes[name] && typeof probes[name] === 'object' ? probes[name] : {};
      const observedDenominator = denominator(name, probe.evidence);
      const [warnThreshold, failThreshold] = thresholds(probe.threshold);
      let noInput;
      if (synthetic) noInput = true;
      else if (input.noInputByProbe && typeof input.noInputByProbe[name] === 'boolean') {
        noInput = input.noInputByProbe[name];
      } else if (name === 'inventory' && typeof input.inventoryNoInput === 'boolean') {
        noInput = input.inventoryNoInput;
      } else noInput = inferredNoInput(name, probe.evidence, observedDenominator);
      details[name] = {
        value: finite(probe.value),
        denominator: observedDenominator,
        verdict: VERDICTS.has(probe.verdict) ? probe.verdict : 'SKIP',
        warn_threshold: warnThreshold,
        fail_threshold: failThreshold,
        no_input: noInput,
      };
    }
    const noInputs = Object.values(details).map(detail => detail.no_input);
    let coverage;
    let noInput;
    if (synthetic) { coverage = 'synthetic'; noInput = true; }
    else if (!executed) { coverage = 'unknown'; noInput = null; }
    else if (noInputs.every(value => value === true)) { coverage = 'no_input'; noInput = true; }
    else if (noInputs.every(value => value === false)) { coverage = 'measured'; noInput = false; }
    else { coverage = 'partial'; noInput = null; }
    return {
      schema_version: 1,
      mechanical: {
        executed,
        coverage,
        no_input: noInput,
        synthetic,
        exit: mechanicalExit,
        probes: details,
      },
      qualitative: qualitativeEvidence(input, mechanicalExit),
    };
  } catch {
    return null;
  }
}

function workerIdentifier(value) {
  if (typeof value !== 'string' || !value.length) return null;
  const exact = validUuid(value);
  return exact ? exact.toLowerCase() : crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function workerEnum(value, values) {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase();
  return values.has(normalized) ? normalized : null;
}

function appendWorkerEvent(project, record, boundary, action, resultStatus) {
  try {
    const run = validRun(record && record.atlas_run_id);
    const event = withObservation({
      schema_version: 1,
      ts: new Date().toISOString(),
      worker_id: workerIdentifier(record && record.worker_id),
      instance: workerIdentifier(record && record.instance),
      wrapper_attempt_id: workerIdentifier(record && record.wrapper_attempt_id),
      atlas_run_id: run,
      thread_id: workerIdentifier(record && record.thread_id),
      turn_id: workerIdentifier(record && record.turn_id),
      role: workerEnum(record && record.role, WORKER_ROLES),
      status: workerEnum(record && record.status, WORKER_STATUSES),
      boundary: WORKER_BOUNDARIES.has(boundary) ? boundary : null,
      action: WORKER_ACTIONS.has(action) ? action : null,
      result_status: WORKER_RESULTS.has(resultStatus) ? resultStatus : null,
      resume_id: workerIdentifier(record && record.resumed_from),
      pending_count: Array.isArray(record && record.pending) ? record.pending.length : 0,
    }, { sgsd_run_id: run });
    const file = path.join(project, '.planning', 'metrics', 'worker-events.jsonl');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(event) + '\n', 'utf8');
    return true;
  } catch {
    return false;
  }
}

function mudaRowFromEnvironment(probeJson, environment) {
  const env = environment && typeof environment === 'object' ? environment : process.env;
  const integer = value => /^-?[0-9]+$/.test(value || '') ? Number(value) : undefined;
  const row = JSON.parse(env.ATLAS_BASE_ROW);
  const atlasMuda = buildAtlasMuda(probeJson, {
    mechanicalExit: integer(env.ATLAS_MECHANICAL_EXIT),
    synthetic: env.ATLAS_SYNTHETIC === 'true',
    inventoryNoInput: env.ATLAS_INVENTORY_NO_INPUT === 'true',
    enabled: env.ATLAS_QUAL_ENABLED === 'true',
    diffLines: integer(env.ATLAS_DIFF_LINES),
    dryRun: env.ATLAS_DRY_RUN === 'true',
    attempted: env.ATLAS_QUAL_ATTEMPTED === 'true',
    qualitativeExit: integer(env.ATLAS_QUAL_EXIT),
    reportParsed: env.ATLAS_REPORT_PARSED === 'true',
    critical: integer(env.ATLAS_QUAL_CRITICAL),
    warnings: integer(env.ATLAS_QUAL_WARNINGS),
  });
  return withObservation(Object.assign({}, row, { atlas_muda: atlasMuda }), {}, env);
}

if (require.main === module && process.argv[2] === '--muda-row') {
  try {
    const probe = JSON.parse(fs.readFileSync(0, 'utf8'));
    process.stdout.write(JSON.stringify(mudaRowFromEnvironment(probe)));
  } catch (error) {
    if (process.env.SGSD_ATLAS_DEBUG === 'true') process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  withObservation,
  preserveObservation,
  buildAtlasMuda,
  appendWorkerEvent,
  mudaRowFromEnvironment,
};
