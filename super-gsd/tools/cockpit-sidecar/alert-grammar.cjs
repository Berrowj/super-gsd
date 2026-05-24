'use strict';

const BENIGN_WARNING_PREFIXES = [
  'executor_log_unavailable',
  'chronicle_index_unavailable',
  'validator_log_unavailable',
  'token_attribution_unavailable',
  'cockpit_state_unavailable',
  'phase_commit_count_unavailable',
  'phase_file_diff_unavailable',
];

function asObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function warningList(warnings) {
  if (Array.isArray(warnings)) {
    return warnings;
  }
  if (typeof warnings === 'string' && warnings.length > 0) {
    return [warnings];
  }
  return [];
}

function isBenignWarning(warning) {
  const firstToken = String(warning).split(':', 1)[0].trim();
  return BENIGN_WARNING_PREFIXES.some((prefix) => firstToken.startsWith(prefix));
}

function paletteTierForSignal(signal) {
  switch (signal) {
    case 'binding_gate_status':
    case 'validator_verdict':
      return 'danger';
    case 'fog_score':
      return 'severe';
    case 'dispatch_count':
    case 'warnings':
      return 'attention';
    default:
      return 'accent';
  }
}

function evaluateAlerts(state) {
  const source = asObject(state);
  const verdict = source.latest_chronicle?.validator_verdict || source.validator_verdict;
  const nonBenignWarnings = warningList(source.warnings).filter((warning) => !isBenignWarning(warning));
  const all = [];

  if (source.binding_gate_status === 'RED') {
    all.push({ signal: 'binding_gate_status', channel: 'terminal+push' });
  }

  if (verdict && verdict !== 'REPORT_GROUNDED' && verdict !== 'GROUNDED') {
    all.push({ signal: 'validator_verdict', channel: 'terminal+push', detail: verdict });
  }

  if (source.fog_score?.score > 70 && source.prior_fog_high === true) {
    all.push({ signal: 'fog_score', channel: 'terminal', detail: source.fog_score.score });
  }

  if (source.signals?.dispatch_count > 12) {
    all.push({ signal: 'dispatch_count', channel: 'terminal', detail: source.signals.dispatch_count });
  }

  if (nonBenignWarnings.length > 0) {
    all.push({ signal: 'warnings', channel: 'terminal', detail: nonBenignWarnings });
  }

  for (const alert of all) {
    alert.palette_tier = paletteTierForSignal(alert.signal);
  }

  return {
    top: all[0] || null,
    others_count: Math.max(0, all.length - 1),
    all,
  };
}

module.exports = { evaluateAlerts };
