'use strict';
const { digest } = require('./contract.cjs');
const { attributes, envelope, sourceTime, number, opaque } = require('./otlp.cjs');
const NAMES = new Set(['codex.conversation_starts', 'codex.api_request', 'codex.sse_event',
  'codex.websocket_request', 'codex.websocket_event', 'codex.user_prompt', 'codex.tool_decision', 'codex.tool_result']);
const id = value => typeof value === 'string' ? opaque(value) : null;
function list(value) { if (!Array.isArray(value) || value.length > 2048) throw new Error('invalid_otlp'); return value; }
function normalizeLogs(payload) {
  const result = { events: [], rejected: 0, missing_stable_identity: 0, unsupported: 0 };
  let count = 0;
  for (const resource of list(payload?.resourceLogs)) {
    const r = attributes(resource.resource?.attributes);
    for (const scope of list(resource.scopeLogs || [])) for (const record of list(scope.logRecords || [])) {
      if (++count > 2048) throw new Error('invalid_otlp');
      const a = attributes(record.attributes);
      const name = a['event.name'] || record.eventName || record.body?.stringValue;
      if (!NAMES.has(name)) { result.rejected++; result.unsupported++; continue; }
      const session = id(a['conversation.id'] || r['conversation.id'] || a.conversation_id || a['session.id']);
      const time = sourceTime(record, a);
      if (!session || !time) { result.rejected++; result.missing_stable_identity++; continue; }
      const kind = a['event.kind'] || a.kind;
      const completed = ['codex.sse_event', 'codex.websocket_event'].includes(name) && kind === 'response.completed';
      const request = id(a.response_id || a['response.id'] || a.request_id || a['request.id']);
      const e = envelope();
      e.source.kind = 'codex_otel'; e.source.instance = digest(['codex', session]);
      e.runtime.provider = 'openai';
      e.runtime.model = typeof (a.model || r.model) === 'string' && /^gpt-\d[\w.-]{0,60}$/.test(a.model || r.model) ? (a.model || r.model) : 'unknown';
      e.runtime.codex_version = /^\d+\.\d+\.\d+$/.test(a['app.version'] || r['app.version'] || '') ? (a['app.version'] || r['app.version']) : null;
      e.identity.session_id = session; e.identity.request_id = request;
      e.occurred_at = time;
      e.event_type = 'coverage'; e.execution.status = name.replace('codex.', '');
      e.source.completeness_reason = 'native_metadata_only';
      e.source_event_id = digest(['openai', session, name, time, number(a.attempt, true)]);
      if (completed && request) {
        e.source_event_id = digest(['openai', session, request, 'response.completed']);
        e.event_type = 'api_request'; e.execution.status = 'api_request'; e.execution.success = true;
        e.source.completeness_reason = null;
        for (const [field, candidates] of Object.entries({
          input_tokens: ['input_tokens','input_token_count'], output_tokens: ['output_tokens','output_token_count'],
          cache_read_tokens: ['cached_input_tokens','cached_token_count'], reasoning_tokens: ['reasoning_output_tokens','reasoning_token_count'],
          total_provider_tokens: ['total_tokens','total_token_count'] })) {
          e.usage[field] = candidates.map(key => number(a[key], true)).find(value => value !== null) ?? null;
        }
      } else if (completed) {
        e.source.completeness_reason = 'missing_stable_request_identity';
        result.missing_stable_identity++;
      }
      // Tool snippets, prompt text, errors, cwd and account metadata never leave this parser.
      result.events.push(e);
    }
  }
  return result;
}
module.exports = { normalizeLogs };
