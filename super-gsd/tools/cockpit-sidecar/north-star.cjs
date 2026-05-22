'use strict';

const FAILED_CHRONICLE_VERDICTS = new Set([
  'REPORT_UNGROUNDED',
  'REPORT_BROKEN_CITATION',
  'REPORT_CONTAMINATED',
  'UNGROUNDED',
  'BROKEN_CITATION',
  'CONTAMINATED',
]);

function asObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function hasBlockers(blockers) {
  if (Array.isArray(blockers)) {
    return blockers.length > 0;
  }
  if (typeof blockers === 'string') {
    return blockers.trim().length > 0;
  }
  if (blockers && typeof blockers === 'object') {
    return Object.keys(blockers).length > 0;
  }
  return Boolean(blockers);
}

function describeBlockers(blockers) {
  if (Array.isArray(blockers)) {
    return blockers.map(String).filter(Boolean).join(', ') || 'open blocker';
  }
  if (typeof blockers === 'string') {
    return blockers.trim() || 'open blocker';
  }
  if (blockers && typeof blockers === 'object') {
    return JSON.stringify(blockers);
  }
  return 'open blocker';
}

function computeNorthStar(state) {
  const source = asObject(state);

  if (source.binding_gate_status === 'RED') {
    const reason =
      source.binding_gate_reason ||
      source.gate_reason ||
      source.reason ||
      source.binding_gate?.reason ||
      'binding gate RED';
    return {
      rank: 1,
      code: 'BLOCKED',
      message: 'BLOCKED — phase close gated: ' + reason,
    };
  }

  const verdict = source.latest_chronicle?.validator_verdict;
  if (FAILED_CHRONICLE_VERDICTS.has(verdict)) {
    return {
      rank: 2,
      code: 'CHRONICLE_FAILED',
      message: 'CHRONICLE FAILED — ' + verdict,
    };
  }

  if (source.requires_operator_review === true || hasBlockers(source.blockers)) {
    const what =
      hasBlockers(source.blockers) ? describeBlockers(source.blockers) : 'operator review required';
    return {
      rank: 3,
      code: 'NEEDS_OPERATOR',
      message: 'NEEDS OPERATOR — ' + what,
    };
  }

  if (source.fog_score?.tier === 'high') {
    const mustReadSections = Array.isArray(source.fog_score?.must_read_sections)
      ? source.fog_score.must_read_sections.map(String).filter(Boolean)
      : [];
    return {
      rank: 4,
      code: 'HEAVY_PHASE',
      message: 'HEAVY PHASE — read ' + (mustReadSections.join(', ') || 'must-read sections'),
    };
  }

  const milestone = source.milestone || 'unknown-milestone';
  const phase = source.phase || 'unknown-phase';
  const progress = source.progress;
  return {
    rank: 5,
    code: 'ON_TRACK',
    message: 'ON TRACK — ' + milestone + '/' + phase + (progress ? ', ' + progress : ''),
  };
}

module.exports = { computeNorthStar };
