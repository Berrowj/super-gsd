#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { resolveEffectiveState } = require('../state-resolver/resolve.cjs');
const phaseName = require('../../scripts/lib/phase-name.cjs');

const EXIT_SUCCESS = 0;
const EXIT_REFUSAL = 1;
const EXIT_INPUT_IO = 2;

class StateContractError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = 'StateContractError';
    this.reason = reason;
  }
}

function envelope(ok, changed, exitCode, reason, detail = {}) {
  return {
    ok,
    changed,
    exit_code: exitCode,
    reason,
    ...detail,
  };
}

function inputFailure(reason, message, detail) {
  return envelope(false, false, EXIT_INPUT_IO, reason, {
    category: 'input_io_failure',
    message,
    ...(detail || {}),
  });
}

function refusal(reason, message, detail) {
  return envelope(false, false, EXIT_REFUSAL, reason, {
    category: 'contract_refusal',
    message,
    ...(detail || {}),
  });
}

function samePhase(left, right) {
  return Boolean(left && right && phaseName.phaseTokensEqual(left, right));
}

function milestoneVersion(milestone) {
  const match = /^v([0-9]+)\.([0-9]+)(?:-[A-Za-z0-9][A-Za-z0-9._-]*)?$/.exec(milestone);
  return match ? { key: `v${match[1]}_${match[2]}` } : null;
}

function validTimestamp(value) {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function validateInput(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return inputFailure('invalid_event_envelope', 'event envelope must be one object');
  }
  if (options.event !== 'plan-close' && options.event !== 'phase-close') {
    return inputFailure('invalid_event', 'event must be plan-close or phase-close');
  }
  if (typeof options.projectDir !== 'string' || options.projectDir.length === 0) {
    return inputFailure('invalid_project_dir', 'projectDir must be a non-empty string');
  }
  const version = typeof options.milestone === 'string'
    ? milestoneVersion(options.milestone) : null;
  if (!version) {
    return inputFailure('invalid_milestone', 'milestone must begin with an exact vN.N version');
  }
  const evidence = phaseName.parsePhaseToken(options.evidence_phase);
  if (!evidence) {
    return inputFailure('invalid_evidence_phase', 'evidence_phase must be one opaque phase token');
  }
  const requestedComplete = options.current_phase === 'complete';
  const requested = requestedComplete ? null : phaseName.parsePhaseToken(options.current_phase);
  if (!requestedComplete && !requested) {
    return inputFailure('invalid_current_phase', 'current_phase must be one opaque phase token or complete');
  }
  if (options.event === 'plan-close' && requestedComplete) {
    return inputFailure('invalid_current_phase', 'plan-close cannot request complete');
  }
  if (!validTimestamp(options.last_updated)) {
    return inputFailure('invalid_last_updated', 'last_updated must be a parseable timestamp string');
  }
  const progress = options.progress;
  const status = progress && progress.status_row;
  const statusPhase = status && phaseName.parsePhaseToken(status.phase);
  const countsValid = progress && Number.isInteger(progress.total_phases)
    && progress.total_phases > 0
    && Number.isInteger(progress.completed_phases)
    && progress.completed_phases >= 0
    && progress.completed_phases <= progress.total_phases
    && Number.isInteger(progress.completed_plans)
    && progress.completed_plans >= 0;
  const statusValid = status && statusPhase && samePhase(statusPhase, evidence)
    && typeof status.value === 'string' && status.value.trim().length > 0;
  if (!countsValid || !statusValid) {
    return inputFailure('invalid_progress',
      'progress requires valid totals/completed counts and an evidence-phase status row');
  }
  let projectDir;
  try { projectDir = path.resolve(options.projectDir); }
  catch (error) { return inputFailure('invalid_project_dir', error.message); }
  return {
    ok: true,
    value: {
      event: options.event,
      projectDir,
      milestone: options.milestone,
      milestoneKey: version.key,
      evidence,
      requested,
      requestedComplete,
      lastUpdated: options.last_updated,
      progress: {
        totalPhases: progress.total_phases,
        completedPhases: progress.completed_phases,
        completedPlans: progress.completed_plans,
        percent: Math.round((progress.completed_phases / progress.total_phases) * 100),
        statusPhase,
        statusValue: status.value,
      },
    },
  };
}

function splitLineRecords(source) {
  const records = [];
  let start = 0;
  while (start < source.length) {
    const newline = source.indexOf('\n', start);
    if (newline === -1) {
      records.push({ text: source.slice(start), eol: '' });
      start = source.length;
    } else {
      const hasCarriage = newline > start && source.charAt(newline - 1) === '\r';
      records.push({
        text: source.slice(start, hasCarriage ? newline - 1 : newline),
        eol: hasCarriage ? '\r\n' : '\n',
      });
      start = newline + 1;
    }
  }
  if (source.length === 0) records.push({ text: '', eol: '' });
  return records;
}

function joinLineRecords(records) {
  return records.map((record) => record.text + record.eol).join('');
}

function lineInfo(record) {
  const match = /^([ \t]*)([A-Za-z0-9_]+):(?:[ \t]*(.*))?$/.exec(record.text);
  if (!match) return null;
  return { indent: match[1].length, prefix: match[1], key: match[2], value: match[3] || '' };
}

function frontmatterBounds(records) {
  if (!records.length || records[0].text.trim() !== '---') {
    throw new StateContractError('state_frontmatter_invalid', 'STATE.md must start with frontmatter');
  }
  for (let index = 1; index < records.length; index += 1) {
    if (records[index].text.trim() === '---') return { start: 1, end: index };
  }
  throw new StateContractError('state_frontmatter_invalid', 'STATE.md frontmatter is unterminated');
}

function findDirect(records, start, end, indent, key) {
  const matches = [];
  for (let index = start; index < end; index += 1) {
    const info = lineInfo(records[index]);
    if (info && info.indent === indent && info.key === key) matches.push({ index, info });
  }
  if (matches.length > 1) {
    throw new StateContractError('state_projection_ambiguous', `STATE.md contains duplicate ${key}`);
  }
  return matches.length === 1 ? matches[0] : null;
}

function blockEnd(records, blockStart, limit, indent) {
  for (let index = blockStart + 1; index < limit; index += 1) {
    const text = records[index].text.trim();
    if (text.length === 0 || text.charAt(0) === '#') continue;
    const info = lineInfo(records[index]);
    if (info && info.indent <= indent) return index;
  }
  return limit;
}

function scalarValue(raw) {
  const value = String(raw || '').trim();
  if (value.charAt(0) === '"') {
    let escaped = false;
    for (let index = 1; index < value.length; index += 1) {
      const character = value.charAt(index);
      if (character === '"' && !escaped) {
        const tail = value.slice(index + 1).trim();
        if (tail.length > 0 && tail.charAt(0) !== '#') return null;
        try { return JSON.parse(value.slice(0, index + 1)); }
        catch (_error) { return null; }
      }
      escaped = character === '\\' && !escaped;
      if (character !== '\\') escaped = false;
    }
    return null;
  }
  if (value.charAt(0) === "'") {
    for (let index = 1; index < value.length; index += 1) {
      if (value.charAt(index) !== "'") continue;
      if (value.charAt(index + 1) === "'") { index += 1; continue; }
      const tail = value.slice(index + 1).trim();
      if (tail.length > 0 && tail.charAt(0) !== '#') return null;
      return value.slice(1, index).replace(/''/g, "'");
    }
    return null;
  }
  return value.replace(/[ \t]+#.*$/, '').trim();
}

function projectedState(records, bounds) {
  const milestone = findDirect(records, bounds.start, bounds.end, 0, 'milestone');
  const current = findDirect(records, bounds.start, bounds.end, 0, 'current_phase');
  if (!milestone || !current) {
    throw new StateContractError('state_projection_invalid',
      'STATE.md requires one top-level milestone and current_phase');
  }
  return {
    milestone: scalarValue(milestone.info.value),
    phaseValue: scalarValue(current.info.value),
  };
}

function formatString(value) {
  return JSON.stringify(String(value));
}

function replaceTopScalar(records, bounds, key, value, formatted) {
  const match = findDirect(records, bounds.start, bounds.end, 0, key);
  if (!match) throw new StateContractError('state_projection_invalid', `STATE.md is missing ${key}`);
  if (scalarValue(match.info.value) !== String(value)) {
    records[match.index].text = `${key}: ${formatted}`;
  }
}

function preferredEol(records) {
  const found = records.find((record) => record.eol.length > 0);
  return found ? found.eol : '\n';
}

function upsertMappingScalar(records, start, end, indent, key, rawValue, semanticValue, eol) {
  const match = findDirect(records, start + 1, end, indent, key);
  if (match) {
    if (scalarValue(match.info.value) !== String(semanticValue)) {
      records[match.index].text = `${' '.repeat(indent)}${key}: ${rawValue}`;
    }
    return end;
  }
  records.splice(end, 0, { text: `${' '.repeat(indent)}${key}: ${rawValue}`, eol });
  return end + 1;
}

function statusKey(parsed) {
  return `phase_${parsed.token.replace(/[^A-Za-z0-9]/g, '_')}`;
}

function patchProjection(source, input) {
  const records = splitLineRecords(source);
  let bounds = frontmatterBounds(records);
  replaceTopScalar(records, bounds, 'milestone', input.milestone, input.milestone);
  replaceTopScalar(records, bounds, 'current_phase',
    input.requestedComplete ? 'complete' : input.requested.token,
    formatString(input.requestedComplete ? 'complete' : input.requested.token));
  replaceTopScalar(records, bounds, 'last_updated', input.lastUpdated, formatString(input.lastUpdated));

  const progress = findDirect(records, bounds.start, bounds.end, 0, 'progress');
  if (!progress || progress.info.value.trim().length > 0) {
    throw new StateContractError('state_progress_invalid', 'STATE.md requires a progress mapping');
  }
  const eol = preferredEol(records);
  let progressEnd = blockEnd(records, progress.index, bounds.end, 0);
  let milestone = findDirect(records, progress.index + 1, progressEnd, 2, input.milestoneKey);
  if (!milestone) {
    const rows = [
      `  ${input.milestoneKey}:`,
      `    total_phases: ${input.progress.totalPhases}`,
      `    completed_phases: ${input.progress.completedPhases}`,
      `    completed_plans: ${input.progress.completedPlans}`,
      `    percent: ${input.progress.percent}`,
      `    ${statusKey(input.progress.statusPhase)}: ${formatString(input.progress.statusValue)}`,
    ].map((text) => ({ text, eol }));
    records.splice(progressEnd, 0, ...rows);
    return joinLineRecords(records);
  }

  let milestoneEnd = blockEnd(records, milestone.index, progressEnd, 2);
  milestoneEnd = upsertMappingScalar(records, milestone.index, milestoneEnd, 4,
    'total_phases', String(input.progress.totalPhases), input.progress.totalPhases, eol);
  progressEnd = blockEnd(records, progress.index, frontmatterBounds(records).end, 0);
  milestoneEnd = blockEnd(records, milestone.index, progressEnd, 2);
  milestoneEnd = upsertMappingScalar(records, milestone.index, milestoneEnd, 4,
    'completed_phases', String(input.progress.completedPhases), input.progress.completedPhases, eol);
  progressEnd = blockEnd(records, progress.index, frontmatterBounds(records).end, 0);
  milestoneEnd = blockEnd(records, milestone.index, progressEnd, 2);
  milestoneEnd = upsertMappingScalar(records, milestone.index, milestoneEnd, 4,
    'completed_plans', String(input.progress.completedPlans), input.progress.completedPlans, eol);
  progressEnd = blockEnd(records, progress.index, frontmatterBounds(records).end, 0);
  milestoneEnd = blockEnd(records, milestone.index, progressEnd, 2);
  milestoneEnd = upsertMappingScalar(records, milestone.index, milestoneEnd, 4,
    'percent', String(input.progress.percent), input.progress.percent, eol);
  progressEnd = blockEnd(records, progress.index, frontmatterBounds(records).end, 0);
  milestoneEnd = blockEnd(records, milestone.index, progressEnd, 2);
  upsertMappingScalar(records, milestone.index, milestoneEnd, 4,
    statusKey(input.progress.statusPhase), formatString(input.progress.statusValue),
    input.progress.statusValue, eol);
  return joinLineRecords(records);
}

function roadmapIndex(roadmap, parsed) {
  const matches = [];
  for (let index = 0; index < roadmap.length; index += 1) {
    if (samePhase(roadmap[index], parsed)) matches.push(index);
  }
  if (matches.length === 0) return { ok: false, reason: 'roadmap_identity_absent' };
  if (matches.length > 1) return { ok: false, reason: 'roadmap_identity_ambiguous' };
  return { ok: true, index: matches[0] };
}

function roadmapIdentityRows(source) {
  const identities = [];
  let phaseTable = false;
  for (const line of source.split(/\r?\n/)) {
    if (!/^\s*\|/.test(line)) {
      phaseTable = false;
      continue;
    }
    const cells = line.trim().replace(/^\||\|$/g, '').split('|')
      .map((cell) => cell.trim());
    if (/^phase$/i.test((cells[0] || '').replace(/[*`]/g, ''))) {
      phaseTable = true;
      continue;
    }
    if (!phaseTable || /^:?-+:?$/.test(cells[0] || '')) continue;
    const parsed = phaseName.parseRoadmapPhases([
      '| Phase | Name |',
      '|---|---|',
      line,
    ].join('\n'));
    if (parsed.length === 1) identities.push(parsed[0]);
  }
  return identities;
}

function readRoadmap(input) {
  const roadmapPath = path.join(
    input.projectDir, '.planning', 'milestones', input.milestone, 'ROADMAP.md');
  let source;
  try { source = fs.readFileSync(roadmapPath, 'utf8'); }
  catch (error) {
    if (error && error.code === 'ENOENT') {
      return refusal('roadmap_identity_absent', 'milestone ROADMAP.md is absent', { roadmap_path: roadmapPath });
    }
    return inputFailure('roadmap_read_failed', error.message, { roadmap_path: roadmapPath });
  }
  const roadmap = phaseName.parseRoadmapPhases(source);
  if (!Array.isArray(roadmap) || roadmap.length === 0) {
    return refusal('roadmap_identity_absent', 'ROADMAP contains no parser-owned phase identities',
      { roadmap_path: roadmapPath });
  }
  if (roadmapIdentityRows(source).length !== roadmap.length) {
    return refusal('roadmap_identity_ambiguous',
      'ROADMAP contains duplicate parser-owned phase identities', { roadmap_path: roadmapPath });
  }
  return { ok: true, roadmap, roadmapPath };
}

function contextIsPending(source) {
  const records = splitLineRecords(source);
  const bounds = frontmatterBounds(records);
  const status = findDirect(records, bounds.start, bounds.end, 0, 'status');
  return Boolean(status && scalarValue(status.info.value).toUpperCase() === 'PENDING');
}

function seedInflatedResolverAhead(resolved, input) {
  if (resolved.source !== 'phase_folders' || resolved.phase_status !== 'in-progress'
      || resolved.projection_stale !== true) return null;
  if (!Array.isArray(resolved.stale_sources) || resolved.stale_sources.length !== 1
      || resolved.stale_sources[0] !== 'state_md') return null;
  if (!Array.isArray(resolved.conflicts) || resolved.conflicts.length === 0
      || !resolved.conflicts.every((conflict) => {
        const sources = [conflict && conflict.source_a, conflict && conflict.source_b].sort();
        return sources[0] === 'phase_folders' && sources[1] === 'state_md';
      })) return null;

  let phase;
  let entries;
  try {
    phase = phaseName.findPhase(input.projectDir, resolved.phase, {
      milestone: input.milestone,
      includeFlat: false,
    });
    if (!phase || phaseName.isDiscoveryError(phase)) return null;
    entries = fs.readdirSync(phase.dir, { withFileTypes: true });
  } catch (_error) {
    return null;
  }
  if (entries.length !== 1 || !entries[0].isFile()
      || !/(?:^|-)CONTEXT\.md$/i.test(entries[0].name)) return null;
  try {
    if (!contextIsPending(fs.readFileSync(path.join(phase.dir, entries[0].name), 'utf8'))) return null;
  } catch (_error) {
    return null;
  }
  return {
    phase: resolved.phase,
    reason: 'phase_folder_context_pending_without_execution_evidence',
  };
}

function atomicReplace(statePath, content) {
  const tempPath = path.join(path.dirname(statePath),
    `.${path.basename(statePath)}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`);
  let descriptor = null;
  let stage = 'open';
  try {
    descriptor = fs.openSync(tempPath, 'wx', 0o600);
    stage = 'write';
    fs.writeFileSync(descriptor, content, 'utf8');
    stage = 'fsync';
    fs.fsyncSync(descriptor);
    stage = 'close';
    fs.closeSync(descriptor);
    descriptor = null;
    stage = 'rename';
    fs.renameSync(tempPath, statePath);
    return { ok: true };
  } catch (error) {
    if (descriptor !== null) {
      try { fs.closeSync(descriptor); } catch (_closeError) { /* best effort */ }
    }
    try { fs.unlinkSync(tempPath); } catch (_cleanupError) { /* absent is clean */ }
    return inputFailure(`atomic_${stage}_failed`, error.message, { state_path: statePath });
  }
}

function writeState(options) {
  try {
    const validated = validateInput(options);
    if (!validated.ok) return validated;
    const input = validated.value;
    const resolved = resolveEffectiveState({ projectDir: input.projectDir });
    if (!resolved || resolved.ok !== true) {
      return refusal('resolver_failure', 'effective state could not be resolved', { resolver: resolved || null });
    }
    if (resolved.milestone !== input.milestone) {
      return refusal('milestone_mismatch', 'resolved milestone differs from event milestone', { resolver: resolved });
    }

    const roadmapResult = readRoadmap(input);
    if (!roadmapResult.ok) return roadmapResult;
    const roadmap = roadmapResult.roadmap;
    const resolvedPhase = phaseName.parsePhaseToken(resolved.phase);
    const resolvedAt = resolvedPhase ? roadmapIndex(roadmap, resolvedPhase)
      : { ok: false, reason: 'roadmap_identity_absent' };
    const evidenceAt = roadmapIndex(roadmap, input.evidence);
    const requestedAt = input.requestedComplete
      ? { ok: true, index: roadmap.length }
      : roadmapIndex(roadmap, input.requested);
    const failedIdentity = [resolvedAt, evidenceAt, requestedAt].find((entry) => !entry.ok);
    if (failedIdentity) {
      return refusal(failedIdentity.reason, 'resolver/event identity is absent or ambiguous in ROADMAP');
    }
    let resolverAheadDiscounted = null;
    if (resolvedAt.index > evidenceAt.index) {
      resolverAheadDiscounted = input.event === 'phase-close'
        ? seedInflatedResolverAhead(resolved, input) : null;
      if (!resolverAheadDiscounted) {
        return refusal('evidence_ahead', 'stronger resolver evidence is ahead of the incoming event',
          { resolved_phase: resolved.phase, evidence_phase: input.evidence.token });
      }
    }
    if (resolvedAt.index < evidenceAt.index) {
      return refusal('evidence_phase_mismatch', 'incoming evidence_phase is ahead of resolved evidence',
        { resolved_phase: resolved.phase, evidence_phase: input.evidence.token });
    }
    if (input.event === 'plan-close') {
      if (!samePhase(input.requested, resolvedPhase)) {
        return refusal('plan_close_must_stay', 'plan-close current_phase must stay on resolved phase');
      }
    } else {
      const atEnd = evidenceAt.index === roadmap.length - 1;
      const validComplete = atEnd && input.requestedComplete;
      const validSuccessor = !atEnd && !input.requestedComplete
        && requestedAt.index === evidenceAt.index + 1;
      if (!validComplete && !validSuccessor) {
        return refusal('phase_close_target_invalid',
          'phase-close current_phase must be the immediate ROADMAP successor or complete at ROADMAP end');
      }
    }

    const statePath = path.join(input.projectDir, '.planning', 'STATE.md');
    let source;
    try { source = fs.readFileSync(statePath, 'utf8'); }
    catch (error) { return inputFailure('state_read_failed', error.message, { state_path: statePath }); }
    let records;
    let bounds;
    let projection;
    try {
      records = splitLineRecords(source);
      bounds = frontmatterBounds(records);
      projection = projectedState(records, bounds);
    } catch (error) {
      if (error instanceof StateContractError) return refusal(error.reason, error.message);
      return inputFailure('state_parse_failed', error.message, { state_path: statePath });
    }
    const projectedComplete = projection.phaseValue === 'complete';
    const projectedPhase = projectedComplete ? null : phaseName.parsePhaseToken(projection.phaseValue);
    const projectedAt = projectedComplete
      ? { ok: true, index: roadmap.length }
      : (projectedPhase ? roadmapIndex(roadmap, projectedPhase)
        : { ok: false, reason: 'roadmap_identity_absent' });
    if (!projectedAt.ok) {
      return refusal(projectedAt.reason, 'STATE current_phase identity is absent or ambiguous in ROADMAP');
    }
    const stateMarkedStale = resolved.projection_stale === true
      && Array.isArray(resolved.stale_sources)
      && resolved.stale_sources.includes('state_md');
    if (stateMarkedStale && projectedAt.index > requestedAt.index) {
      return refusal('projection_ahead', 'STATE projection is ahead of the requested event target', {
        projection_stale: resolved.projection_stale,
        stale_sources: resolved.stale_sources,
        projected_phase: projection.phaseValue,
        requested_phase: input.requestedComplete ? 'complete' : input.requested.token,
      });
    }
    if (resolverAheadDiscounted
        && projectedAt.index !== evidenceAt.index
        && projectedAt.index !== requestedAt.index) {
      return refusal('evidence_ahead',
        'folder-tier resolver evidence cannot be discounted for an unaligned STATE projection', {
          resolved_phase: resolved.phase,
          evidence_phase: input.evidence.token,
          projected_phase: projection.phaseValue,
        });
    }

    let updated;
    try { updated = patchProjection(source, input); }
    catch (error) {
      if (error instanceof StateContractError) return refusal(error.reason, error.message);
      return inputFailure('state_patch_failed', error.message, { state_path: statePath });
    }
    const currentPhase = input.requestedComplete ? 'complete' : input.requested.token;
    if (updated === source) {
      return envelope(true, false, EXIT_SUCCESS, 'already_applied', {
        event: input.event,
        state_path: statePath,
        milestone: input.milestone,
        evidence_phase: input.evidence.token,
        current_phase: currentPhase,
        percent: input.progress.percent,
        ...(resolverAheadDiscounted ? { resolver_ahead_discounted: resolverAheadDiscounted } : {}),
      });
    }
    const replaced = atomicReplace(statePath, updated);
    if (!replaced.ok) return replaced;
    return envelope(true, true, EXIT_SUCCESS, 'state_updated', {
      event: input.event,
      state_path: statePath,
      milestone: input.milestone,
      evidence_phase: input.evidence.token,
      current_phase: currentPhase,
      percent: input.progress.percent,
      ...(resolverAheadDiscounted ? { resolver_ahead_discounted: resolverAheadDiscounted } : {}),
    });
  } catch (error) {
    return inputFailure('internal_error', error && error.message ? error.message : 'unknown error');
  }
}

function runCli(argv) {
  const args = argv.slice(2);
  if (args.length !== 2 || args[0] !== '--event-json') {
    const result = inputFailure('invalid_cli', 'usage: node write.cjs --event-json <json-object>');
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return result.exit_code;
  }
  let options;
  try { options = JSON.parse(args[1]); }
  catch (error) {
    const result = inputFailure('invalid_event_json', error.message);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return result.exit_code;
  }
  const result = writeState(options);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.exit_code;
}

if (require.main === module) process.exit(runCli(process.argv));

module.exports = {
  writeState,
  EXIT_SUCCESS,
  EXIT_REFUSAL,
  EXIT_INPUT_IO,
  runCli,
};
