'use strict';
// Pure source contract. No store, spool, transport or worker dependencies.
const NATIVE_SOURCE = 'codex_rollout';
const atom = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
const only = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).every(key => keys.includes(key));
const TOKENS = ['input_tokens', 'cache_read_tokens', 'cache_creation_tokens', 'output_tokens', 'reasoning_tokens', 'total_provider_tokens'];
function nativeResponseIdentity(event) {
  return ['sgsd-native-response-v1', event.runtime?.provider ?? null, event.identity?.response_id ?? null];
}
function validateNativeEnvelope(event) {
  if (event.source?.kind !== NATIVE_SOURCE) return null;
  if (event.event_type !== 'api_request' || event.source.provenance !== 'provider_reported'
      || event.source.confidence !== 'exact' || event.source.completeness_reason !== 'http_request_identity_unavailable'
      || !only(event.source, ['kind', 'instance', 'version', 'provenance', 'confidence', 'completeness_reason'])) return 'invalid_native_source';
  const identity = event.identity;
  if (!only(identity, ['sgsd_run_id', 'session_id', 'thread_id', 'turn_id', 'root_turn_id', 'response_id', 'request_id'])
      || !/^sgsd-[a-f0-9-]{36}$/.test(identity.sgsd_run_id || '') || identity.request_id !== null
      || !['session_id', 'thread_id', 'turn_id', 'root_turn_id', 'response_id'].every(key => atom(identity[key]))
      || event.source_event_id !== identity.response_id) return 'invalid_native_identity';
  if (!only(event.runtime, ['provider', 'model', 'model_provenance', 'response_model', 'model_provider', 'codex_version'])
      || event.runtime.provider !== 'openai' || !atom(event.runtime.model) || !atom(event.runtime.model_provider)
      || event.runtime.model_provenance !== 'thread_configuration' || event.runtime.response_model !== null) return 'invalid_native_runtime';
  if (!only(event.scope, ['launcher_repo_id', 'role', 'cost_center', 'attribution_method'])
      || !/^[a-f0-9]{64}$/.test(event.scope.launcher_repo_id || '') || !atom(event.scope.role)
      || event.scope.role !== event.scope.cost_center || event.scope.attribution_method !== 'launcher_registration') return 'invalid_native_scope';
  if (!only(event.usage, TOKENS) || !TOKENS.every(key => count(event.usage[key])
      || (key === 'cache_creation_tokens' && event.usage[key] === null))) return 'invalid_native_usage';
  if (!only(event.execution, ['status', 'success']) || event.execution.status !== 'response_completed'
      || event.execution.success !== true || !only(event.payload, ['raw_content_recorded'])
      || event.payload.raw_content_recorded !== false
      || ['tool', 'quota', 'gate', 'outcome'].some(key => event[key] != null)) return 'invalid_native_completion';
  return null;
}

function scopeReason(event, run) {
  if (!run || event.identity?.sgsd_run_id !== run.run_id || event.scope?.launcher_repo_id !== run.project_id) return 'unregistered_run';
  if ((event.runtime?.provider && event.runtime.provider !== run.provider)
      || (event.source?.kind === 'claude_otel' && run.provider !== 'anthropic')
      || (['codex_otel', NATIVE_SOURCE].includes(event.source?.kind) && run.provider !== 'openai')) return 'provider_scope_mismatch';
  const role = event.runtime?.query_source === 'subagent' ? 'subagent' : run.role;
  if (event.scope?.role !== role || event.scope?.cost_center !== run.role
      || event.scope?.attribution_method !== 'launcher_registration') return 'role_scope_mismatch';
  if (event.source?.kind === NATIVE_SOURCE && run.accountingSource !== NATIVE_SOURCE) return 'native_accounting_authority_required';
  return null;
}
function applyAuthority(event, run) {
  // Immutable run registration selects the additive source, independent of arrival order
  // and of any future provider IDs that Codex might add to OTEL.
  if (run?.accountingSource !== NATIVE_SOURCE || event.source?.kind !== 'codex_otel') return event;
  return { ...event, event_type: 'coverage',
    source: { ...event.source, completeness_reason: 'rollout_accounting_authority' },
    usage: Object.fromEntries(Object.keys(event.usage || {}).map(key => [key, null])) };
}
function classifyAccounting(event, run) {
  const kind = event.source?.kind;
  let reason = run ? scopeReason(event, run) : null;
  if (!reason && kind === NATIVE_SOURCE) reason = validateNativeEnvelope(event);
  if (!reason && run?.accountingSource === NATIVE_SOURCE && kind === 'codex_otel'
      && (event.event_type !== 'coverage' || Object.values(event.usage || {}).some(value => value !== null))) reason = 'accounting_authority_mismatch';
  const nativeEvent = !reason && [NATIVE_SOURCE, 'codex_otel', 'claude_otel'].includes(kind);
  const response = nativeEvent && kind === NATIVE_SOURCE;
  const request = nativeEvent && kind !== NATIVE_SOURCE && event.event_type === 'api_request'
    && event.execution?.status === 'api_request' && atom(event.identity?.request_id);
  const eligible = Boolean(!reason && (response || request));
  return { reason, eligible, nativeObserved: eligible, nativeEvent,
    granularity: eligible ? response ? 'response_completion' : 'http_request' : null,
    provider: eligible ? event.runtime?.provider : null, model: eligible ? event.runtime?.model : null,
    usage: eligible ? event.usage : null };
}
module.exports = Object.freeze({ NATIVE_SOURCE, TOKENS, atom, count, nativeResponseIdentity, validateNativeEnvelope,
  scopeReason, applyAuthority, classifyAccounting });
