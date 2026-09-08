'use strict';

// Native field semantics: https://code.claude.com/docs/en/monitoring-usage
// The Collector strips content before its queue. This independent allowlist is
// the final boundary before canonical storage; OTLP bodies never enter events.
const { digest } = require('./contract.cjs');
const NAMES = new Set(['api_request', 'api_error', 'api_refusal', 'tool_result', 'tool_decision',
  'user_prompt', 'assistant_response', 'api_retries_exhausted', 'compaction']);
const COST_CENTERS = ['orchestrator', 'executor', 'observer', 'narrator', 'board', 'recovery', 'unknown'];
const TOOLS = ['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash', 'Glob', 'Grep',
  'Agent', 'Task', 'Skill', 'WebFetch', 'WebSearch', 'TodoWrite', 'AskUserQuestion', 'Workflow'];
const METRICS = {
  'claude_code.token.usage': 'token', 'claude_code.cost.usage': 'cost',
  'claude_code.session.count': 'session', 'claude_code.active_time.total': 'active_time',
};
const nulls = (keys) => Object.fromEntries(keys.split(' ').map((key) => [key, null]));
const choice = (value, values, fallback = null) => values.includes(value) ? value : value == null ? null : fallback;
function number(value, integer = false) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value))) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER && (!integer || Number.isSafeInteger(n)) ? n : null;
}
function bool(value) { return value === true || value === 'true' ? true : value === false || value === 'false' ? false : null; }
function opaque(value) {
  if (typeof value !== 'string' || !value) return null;
  return /^[a-zA-Z0-9._:-]{1,160}$/.test(value) ? value : digest(value);
}
function version(value) { return typeof value === 'string' && /^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/i.test(value) && value.length <= 48 ? value : null; }
function model(value) { return typeof value === 'string' && /^(?:fable|claude-(?:opus|sonnet|haiku|fable)(?:-[a-z0-9.]+)*)$/.test(value) && value.length <= 64 ? value : value == null ? null : 'unknown'; }
function modelFamily(value) { return /^claude-(opus|sonnet|haiku|fable)(?:$|-)/.exec(value || '')?.[1] || (value === 'fable' ? 'fable' : /^gpt-/.test(value || '') ? 'gpt' : 'unknown'); }
function queryClass(value) {
  if (['main', 'repl_main_thread', 'sdk'].includes(value)) return 'main';
  if (['auxiliary', 'compact', 'summarize', 'prompt_suggestion', 'session_title', 'auto_mode'].includes(value)) return 'auxiliary';
  if (['subagent', 'agent', 'explore', 'plan', 'general-purpose'].includes(value)) return 'subagent';
  return value == null ? null : 'unknown';
}
function attributes(rows) {
  if (rows == null) return Object.create(null);
  if (!Array.isArray(rows) || rows.length > 256) throw new Error('invalid_otlp');
  const result = Object.create(null);
  for (const row of rows) {
    if (!row || typeof row.key !== 'string' || row.key.length > 128 || !row.value || typeof row.value !== 'object') continue;
    const value = row.value;
    if (typeof value.stringValue === 'string') result[row.key] = value.stringValue;
    else if (typeof value.boolValue === 'boolean') result[row.key] = value.boolValue;
    else if (value.intValue !== undefined) result[row.key] = number(value.intValue, true);
    else if (value.doubleValue !== undefined) result[row.key] = number(value.doubleValue);
  }
  return result;
}
function list(value, required = false) {
  if (value == null && !required) return [];
  if (!Array.isArray(value) || value.length > 2048) throw new Error('invalid_otlp');
  return value;
}
function sourceTime(record, attr) {
  if (typeof attr['event.timestamp'] === 'string' && /^\d{4}-\d\d-\d\dT.*Z$/.test(attr['event.timestamp'])
      && Number.isFinite(Date.parse(attr['event.timestamp']))) return new Date(attr['event.timestamp']).toISOString();
  try {
    const raw = record.timeUnixNano;
    if (typeof raw !== 'string' || !/^\d{1,20}$/.test(raw)) return null;
    const millis = Number(BigInt(raw) / 1000000n);
    return millis > 0 ? new Date(millis).toISOString() : null;
  } catch { return null; }
}
function envelope() {
  return {
    schema_version: 1, source_event_id: null, occurred_at: null, event_sequence: null, event_type: null,
    source: { kind: 'claude_otel', instance: null, version: null, provenance: 'provider_reported', confidence: 'exact', completeness_reason: null },
    identity: nulls('sgsd_run_id session_id request_id client_request_id trace_id span_id parent_span_id message_id prompt_id agent_id parent_agent_id workflow_id handoff_id parent_handoff_id dispatch_id packet_id gate_invocation_id attempt_id retry_group_id tool_use_id finding_id repair_id'),
    scope: { ...nulls('launcher_repo_id event_cwd_repo_id target_repo_id target_repo_source milestone phase plan task gate role cost_center'), target_repo_confidence: 'unknown', attribution_method: 'unknown' },
    runtime: { ...nulls('provider model effort service_tier speed query_source active_agent active_skill active_plugin active_mcp_server source_sha pre_commit_sha post_commit_sha claude_version codex_version collector_version prometheus_version prompt_template_digest system_prompt_digest config_digest gate_registry_digest route_registry_digest pricing_table_version classifier_rules_version fingerprint_version'), provider: 'anthropic' },
    usage: nulls('input_tokens cache_creation_tokens cache_read_tokens output_tokens reasoning_tokens total_provider_tokens visible_response_chars visible_response_tokens_estimated report_bytes tool_input_bytes tool_result_bytes context_window_tokens context_occupancy_percentage unattributed_residual_tokens cost_usd_estimated duration_ms'),
    execution: nulls('success status stop_reason retry_count iteration_count time_to_first_token_ms compaction_event fallback'),
    tool: nulls('name family success duration_ms argument_digest result_digest'),
    quota: { ...nulls('window used_percentage resets_at gateway_spend_limit_percentage attribution'), scope: 'unknown' },
    payload: { ...nulls('purpose artifact_ref content_digest component_manifest_ref'), raw_content_recorded: false },
    gate: nulls('eligible fired verdict finding_fingerprint finding_disposition duplicate_of'),
    outcome: nulls('accepted tests_passed gate_outcome operator_corrected status evidence_ref'),
  };
}
function normalizeLogs(payload) {
  const result = { events: [], rejected: 0, missing_stable_identity: 0, unsupported: 0 };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid_otlp');
  let count = 0;
  for (const group of list(payload.resourceLogs, true)) {
    if (!group || typeof group !== 'object') throw new Error('invalid_otlp');
    const resource = attributes(group.resource?.attributes);
    for (const scope of list(group.scopeLogs)) {
      for (const record of list(scope?.logRecords)) {
        if (++count > 2048 || !record || typeof record !== 'object') throw new Error('invalid_otlp');
        const a = attributes(record.attributes);
        const rawName = a['event.name'] || record.eventName || record.body?.stringValue;
        const name = typeof rawName === 'string' ? rawName.replace(/^claude_code\./, '') : null;
        if (!NAMES.has(name)) { result.rejected++; result.unsupported++; continue; }
        const session = opaque(a['session.id'] || a.session_id);
        const request = opaque(a.request_id || a['request.id']);
        const client = opaque(a.client_request_id);
        const toolUse = opaque(a.tool_use_id);
        const sequence = number(a['event.sequence'], true);
        const attempt = number(a.attempt, true);
        const fallback = bool(a.server_fallback_hop);
        let stableKey;
        if (session) {
          if (name === 'api_request' && request) stableKey = [request];
          else if (name === 'api_error' && client && attempt !== null) stableKey = [client, attempt];
          else if (name === 'api_refusal' && request) stableKey = [request, attempt, fallback];
          else if (name === 'api_error' && request) stableKey = [request, attempt];
          else if (name.startsWith('tool_') && toolUse) stableKey = [toolUse];
          else if (sequence !== null) stableKey = ['sequence', sequence];
        }
        if (!stableKey) { result.rejected++; result.missing_stable_identity++; continue; }
        const time = sourceTime(record, a);
        if (!time) { result.rejected++; continue; }
        const e = envelope();
        e.source_event_id = digest(['anthropic', session, name, ...stableKey]);
        e.occurred_at = time; e.event_sequence = sequence;
        e.event_type = ['api_request', 'api_error', 'api_refusal'].includes(name) ? 'api_request'
          : name.startsWith('tool_') ? 'tool' : name === 'user_prompt' ? 'handoff'
            : name === 'assistant_response' ? 'outcome' : 'coverage';
        e.source.instance = digest(['claude_code', session]);
        e.source.version = version(a['app.version'] || resource['app.version'] || resource['service.version']);
        e.source.completeness_reason = request || (client && attempt !== null) || toolUse ? null : 'event_sequence_identity';
        e.identity.sgsd_run_id = opaque(resource['sgsd.run_id'] || resource['sgsd.run.id'] || a['sgsd.run_id'] || a['sgsd.run.id']);
        Object.assign(e.identity, { session_id: session, request_id: request, client_request_id: client,
          prompt_id: opaque(a['prompt.id']), message_id: opaque(a['message.uuid']),
          workflow_id: opaque(a['workflow.run_id']), tool_use_id: toolUse,
          trace_id: /^[a-f0-9]{32}$/i.test(record.traceId || '') ? record.traceId.toLowerCase() : null,
          span_id: /^[a-f0-9]{16}$/i.test(record.spanId || '') ? record.spanId.toLowerCase() : null });
        e.scope.launcher_repo_id = opaque(resource['sgsd.launcher_repo_id'] || a['sgsd.launcher_repo_id']);
        e.scope.cost_center = choice(resource['sgsd.cost_center'] || a['sgsd.cost_center'], COST_CENTERS, 'unknown');
        e.scope.attribution_method = e.identity.sgsd_run_id ? 'exact' : 'unknown';
        Object.assign(e.runtime, { model: model(a.model), claude_version: e.source.version,
          effort: choice(a.effort, ['low', 'medium', 'high', 'xhigh', 'max'], 'unknown'),
          speed: choice(a.speed, ['fast', 'normal'], 'unknown'), query_source: queryClass(a.query_source),
          active_agent: choice(a['agent.name'], ['Explore', 'Plan', 'general-purpose', 'custom', 'unknown'], 'unknown') });
        e.execution.status = name;
        if (name === 'api_request') {
          for (const key of ['input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_creation_tokens']) e.usage[key] = number(a[key], true);
          e.usage.cost_usd_estimated = number(a.cost_usd) ?? (number(a.cost_usd_micros) === null ? null : number(a.cost_usd_micros) / 1e6);
          e.execution.success = true;
        } else if (name === 'api_error' || name === 'api_refusal') {
          e.execution.success = false;
          e.execution.retry_count = attempt !== null && attempt >= 1 ? attempt - 1 : null;
          if (name === 'api_refusal') { e.execution.stop_reason = 'refusal'; e.execution.fallback = fallback; }
        } else if (name === 'tool_result' || name === 'tool_decision') {
          e.tool.name = choice(a.tool_name, TOOLS, 'unknown');
          e.tool.family = e.tool.name === 'Bash' ? 'shell' : ['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Glob', 'Grep'].includes(e.tool.name) ? 'filesystem' : 'other';
          e.execution.success = name === 'tool_result' ? bool(a.success) : a.decision === 'accept' ? true : a.decision === 'reject' ? false : null;
          e.tool.success = e.execution.success;
          e.tool.duration_ms = number(a.duration_ms);
          e.usage.tool_input_bytes = number(a.tool_input_size_bytes, true);
          e.usage.tool_result_bytes = number(a.tool_result_size_bytes, true);
        } else if (name === 'assistant_response') e.usage.visible_response_chars = number(a.response_length, true);
        else if (name === 'compaction') { e.execution.compaction_event = true; e.execution.success = bool(a.success); }
        else if (name === 'api_retries_exhausted') {
          const attempts = number(a.total_attempts, true);
          e.execution.retry_count = attempts !== null && attempts >= 1 ? attempts - 1 : null;
          e.execution.success = false;
        }
        e.usage.duration_ms = number(a.duration_ms);
        if (name === 'api_request' && !request) {
          // A sequence identifies a log record, not a billable provider request.
          e.event_type = 'coverage'; e.usage = envelope().usage;
          e.source.completeness_reason = 'missing_stable_request_identity';
          result.missing_stable_identity++;
        }
        result.events.push(e);
      }
    }
  }
  return result;
}
function normalizeMetrics(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid_otlp');
  const result = { observations: [], rejected: 0 };
  let count = 0;
  for (const group of list(payload.resourceMetrics, true)) {
    for (const scope of list(group?.scopeMetrics)) {
      for (const metric of list(scope?.metrics)) {
        const kind = METRICS[metric?.name];
        for (const point of list(metric?.sum?.dataPoints || metric?.gauge?.dataPoints)) {
          if (++count > 2048) throw new Error('invalid_otlp');
          const amount = number(point?.asInt ?? point?.asDouble);
          if (!kind || amount === null) { result.rejected++; continue; }
          const a = attributes(point.attributes);
          const tokenType = { input: 'input', output: 'output', cacheRead: 'cache_read', cacheCreation: 'cache_creation' }[a.type];
          if (kind === 'token' && !tokenType) { result.rejected++; continue; }
          result.observations.push({ kind, amount, labels: { provider: 'anthropic',
            model_family: modelFamily(a.model), token_type: tokenType || 'none' } });
        }
      }
    }
  }
  return result;
}
module.exports = { normalizeLogs, normalizeMetrics, canonicalClaudeLogs: (payload) => normalizeLogs(payload).events,
  canonicalClaudeMetrics: (payload) => normalizeMetrics(payload).observations, modelFamily, attributes, envelope, sourceTime, number, opaque };
