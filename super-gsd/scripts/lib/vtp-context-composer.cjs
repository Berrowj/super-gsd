'use strict';

/**
 * vtp-context-composer.cjs — Shared VTP context builder and tier projector.
 *
 * Exports: { compose, project, isFastPathEligible, callVtp, TIERS, resetCache }
 *
 * compose(sgsd_state)         — build full_context_object once (reads STATE.md, git log, errors)
 * project(ctx, tier)          — zero-cost tier slice: triage|research|plan|pattern|assumptions|standalone
 * isFastPathEligible(ctx)     — true when current_task maps to active phase AND explicit_constraints non-empty
 * callVtp(tool, args)         — Date.now()-bracketed MCP wrapper; returns {ok, response, elapsed_ms, reason?}
 * TIERS                       — Object.freeze({...}) declarative field-map per tier
 * resetCache()                — test-only: clear in-memory cache
 *
 * Contract (per Phase 16 D-07 + E-03): skills and agents NEVER call mcp__vtp-kb__* directly.
 * All VTP invocations flow through callVtp(...), which is the single measurement point for
 * elapsed_ms and the single log-writer for .planning/metrics/vtp-routing-log.jsonl.
 *
 * Zero external runtime deps — fs, path, os only.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const crypto = require('crypto');
const { findSgsdRoot, resolveContainedPath } = require('./sgsd-state.cjs');
const Ajv = require(path.join(__dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'ajv'));

const SUBSTRATE_TOOL = 'mcp__vtp-kb__vtp_search_substrate';
const SUBSTRATE_TOOL_SHORT = 'vtp_search_substrate';
const SUBSTRATE_SCHEMA_VERSION = 'vtp-mcp-input-schemas.v2';
const SUBSTRATE_SCHEMA_PATH = path.join(__dirname, '..', '..', 'schemas', 'vtp-mcp-input-schemas.v2.json');
const SECONDARY_SUBSTRATE_FILTERS = Object.freeze([
  'entity_types',
  'project_ids',
  'speaker_ids',
  'topics',
  'meeting_ids',
]);

function policyEntry(sourceTypes, limit) {
  return Object.freeze({ source_types: Object.freeze(sourceTypes), limit });
}

const SUBSTRATE_CALL_POLICY = Object.freeze({
  triage: policyEntry(['research_paper', 'wiki_page'], 3),
  phase_research: policyEntry(['research_paper', 'wiki_page'], 5),
  planning: policyEntry(['research_paper', 'wiki_page'], 5),
  enrichment: policyEntry(['research_paper', 'wiki_page'], 5),
  board_research: policyEntry(['research_paper', 'wiki_page'], 5),
  architecture_challenge: policyEntry(['research_paper', 'wiki_page'], 3),
  book_lookup: policyEntry(['wiki_page'], 5),
});

const substrateSchemaAuthority = JSON.parse(fs.readFileSync(SUBSTRATE_SCHEMA_PATH, 'utf8'));
if (substrateSchemaAuthority.version_id !== SUBSTRATE_SCHEMA_VERSION) {
  throw new Error('vtp_substrate_schema_version_mismatch');
}
const substrateSchemaDeclaration = substrateSchemaAuthority.tools
  && substrateSchemaAuthority.tools[SUBSTRATE_TOOL];
if (!substrateSchemaDeclaration || !substrateSchemaDeclaration.inputSchema) {
  throw new Error('vtp_substrate_schema_missing');
}
const validateSubstratePayload = new Ajv({ allErrors: true, strict: true })
  .compile(substrateSchemaDeclaration.inputSchema);

/**
 * WARNING — module-level cache is a PROCESS SINGLETON.
 * Tests MUST call resetCache() in afterEach() to avoid pollution.
 */
let _cache = null;

const TIERS = Object.freeze({
  triage:      { fields: ['repo', 'current_task', 'recent_turns', 'explicit_constraints'] },
  research:    { fields: ['repo', 'current_task', 'explicit_constraints', 'recent_errors'] },
  plan:        { fields: ['repo', 'active_file', 'current_task', 'blockers', 'explicit_constraints'] },
  pattern:     { fields: ['repo', 'active_file', 'current_task'] },
  assumptions: { fields: ['repo', 'current_task', 'recent_turns', 'recent_errors'] },
  standalone:  { fields: ['repo', 'current_task', 'explicit_constraints'] },
});

const ROUTING_LOG_PATH     = path.join('.planning', 'metrics', 'vtp-routing-log.jsonl');
const CONFIG_PATH          = '.planning/config.json';
const FAST_PATH_TIMEOUT_MS = 3000;
const BUDGET_EXCEEDED      = -1;

// Env-var / secret pattern filters (CLAUDE.md security rule + threat T-16-03).
// Any recent_commands entry matching either regex is stripped before returning ctx.
const SECRET_KV_RE  = /[A-Z_]+=/;
const SECRET_KEY_RE = /[A-Z][A-Z_]+_KEY/;

/**
 * Read .planning/config.json#workflow.triage_vtp_enrichment.
 * Defaults to true when file missing or key absent. Rethrows JSON-parse errors
 * (real bugs); swallows ENOENT (first-run or no config yet).
 *
 * @param {string} projectDir
 * @returns {boolean}
 */
function readConfigToggle(projectDir) {
  const configPath = path.resolve(projectDir, CONFIG_PATH);
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(raw);
    if (cfg && cfg.workflow && typeof cfg.workflow.triage_vtp_enrichment === 'boolean') {
      return cfg.workflow.triage_vtp_enrichment;
    }
    return true;
  } catch (err) {
    // Narrow: swallow ENOENT (file missing) → default true.
    // Rethrow JSON-parse + other errors (real bugs).
    if (err && err.code === 'ENOENT') return true;
    throw err;
  }
}

/**
 * Filter env-var and API-key strings out of a recent_commands array.
 * Enforces threat T-16-03 (composer MUST NOT passthrough secrets).
 *
 * @param {string[]} commands
 * @returns {string[]}
 */
function sanitizeRecentCommands(commands) {
  if (!Array.isArray(commands)) return [];
  return commands.filter(c => {
    if (typeof c !== 'string') return false;
    if (SECRET_KV_RE.test(c))  return false;
    if (SECRET_KEY_RE.test(c)) return false;
    return true;
  });
}

/**
 * Build a stable cache-key from sgsd_state input. Keeps compose() O(1) on repeat
 * reads of the same state snapshot.
 *
 * @param {Object} sgsd_state
 * @returns {string}
 */
function cacheKey(sgsd_state) {
  const s = sgsd_state || {};
  return [
    s.milestone || '', s.phase || '', s.plan || '', s.active_file || '',
    (s.blockers || []).join('|'),
    (s.explicit_constraints || []).join('|'),
    (s.recent_turns || []).length,
    (s.recent_errors || []).length,
  ].join('::');
}

/**
 * Build a full VTP ContextInput-shaped object from SGSD state.
 * Cached per-input-signature so repeat calls on the same snapshot are O(1).
 *
 * @param {Object} sgsd_state
 * @param {string} [sgsd_state.milestone]
 * @param {string|number} [sgsd_state.phase]
 * @param {string|number} [sgsd_state.plan]
 * @param {string} [sgsd_state.repo]
 * @param {string} [sgsd_state.active_file]
 * @param {string[]} [sgsd_state.recent_turns]
 * @param {string[]} [sgsd_state.recent_commands]
 * @param {string[]} [sgsd_state.recent_errors]
 * @param {string[]} [sgsd_state.blockers]
 * @param {string[]} [sgsd_state.explicit_constraints]
 * @param {string} [sgsd_state.session_id]
 * @returns {Object}
 */
function compose(sgsd_state) {
  const s = sgsd_state || {};
  const key = cacheKey(s);
  if (_cache && _cache.key === key) return _cache.ctx;

  const phase = s.phase != null ? String(s.phase) : null;
  const plan  = s.plan  != null ? String(s.plan)  : null;
  let current_task = s.current_task || null;
  if (!current_task && (phase || plan)) {
    current_task = `phase:${phase || ''},plan:${plan || ''}`;
  }

  const ctx = {
    session_id:           s.session_id           || null,
    repo:                 s.repo                 || null,
    active_file:          s.active_file          || null,
    recent_turns:         Array.isArray(s.recent_turns)    ? s.recent_turns    : [],
    recent_commands:      sanitizeRecentCommands(s.recent_commands),
    recent_errors:        Array.isArray(s.recent_errors)   ? s.recent_errors   : [],
    current_task:         current_task,
    blockers:             Array.isArray(s.blockers)             ? s.blockers             : [],
    explicit_constraints: Array.isArray(s.explicit_constraints) ? s.explicit_constraints : [],
  };

  _cache = { key, ctx };
  return ctx;
}

/**
 * Zero-cost tier projection. Returns ONLY the fields declared in TIERS[tier].
 * Throws a narrow error whose message starts with 'vtp_tier_unknown:' on bad tier.
 *
 * @param {Object} ctx
 * @param {string} tier
 * @returns {Object}
 */
function project(ctx, tier) {
  if (!TIERS[tier]) {
    throw new Error('vtp_tier_unknown: ' + tier);
  }
  const fields = TIERS[tier].fields;
  const out = {};
  for (const k of fields) {
    out[k] = (ctx && k in ctx) ? (ctx[k] == null ? null : ctx[k]) : null;
  }
  return out;
}

/**
 * Fast-path predicate — true when current_task is a non-empty string AND
 * explicit_constraints is a non-empty array.
 *
 * @param {Object} ctx
 * @returns {boolean}
 */
function isFastPathEligible(ctx) {
  return Boolean(
    ctx
    && typeof ctx.current_task === 'string'
    && ctx.current_task.length > 0
    && Array.isArray(ctx.explicit_constraints)
    && ctx.explicit_constraints.length > 0
  );
}

/**
 * Extract the 5 row-level fields from a vtp_route_and_retrieve response.
 * Tolerates null/missing nested keys (graceful-fail discipline).
 *
 * @param {Object|null} response
 * @returns {{selected_query:string|null,retrieval_mode:string|null,reflection_verdict:string|null,evidence_hit_count:number,top_doc_id:string|null}}
 */
function extractRowFields(response) {
  const r = response || {};
  const plan = r.retrieval_plan || {};
  const refl = r.reflection || null;
  const ev   = r.evidence || {};
  const hits = Array.isArray(ev.hits) ? ev.hits : [];
  const docs = Array.isArray(ev.documents) ? ev.documents : [];
  return {
    selected_query:     plan.selected_query   || null,
    retrieval_mode:     plan.retrieval_mode   || null,
    reflection_verdict: (refl && refl.verdict) || null,
    evidence_hit_count: hits.length,
    top_doc_id:         (docs[0] && docs[0].doc_id) || null,
  };
}

/**
 * Build and append the 10-key (+elapsed_ms = 11) routing-log row per house
 * JSONL convention (edge-guard.cjs:109-112 pattern).
 *
 * @param {Object} params
 * @param {string} params.projectDir
 * @param {string} params.skillOrAgent
 * @param {string} params.tier
 * @param {string} params.rawQuery
 * @param {Object|null} [params.response]
 * @param {number} params.elapsed_ms
 * @param {string} [params.failureReason]
 * @param {string} [params.status]
 * @returns {Object} the row that was written
 */
function writeRoutingLogRow({ projectDir, logRoot, skillOrAgent, tier, rawQuery, response, elapsed_ms, failureReason, status }) {
  const fields = extractRowFields(response);
  const row = {
    ts:                 new Date().toISOString(),
    event:              'vtp_call',
    status:             status || (failureReason ? 'failure' : (fields.evidence_hit_count === 0 ? 'zero_hits' : 'success')),
    tier:               tier,
    skill_or_agent:     skillOrAgent,
    raw_query:          rawQuery,
    selected_query:     fields.selected_query,
    retrieval_mode:     fields.retrieval_mode,
    reflection_verdict: fields.reflection_verdict,
    evidence_hit_count: fields.evidence_hit_count,
    top_doc_id:         fields.top_doc_id,
    elapsed_ms:         elapsed_ms,
  };
  if (failureReason) row.failure_reason = failureReason;

  const root = findSgsdRoot(logRoot || projectDir);
  if (!root) return null;
  const logPath = resolveContainedPath(root, ROUTING_LOG_PATH);
  if (!logPath) return null;
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, JSON.stringify(row) + '\n');
  return row;
}

function isSubstrateTool(tool) {
  return tool === SUBSTRATE_TOOL || tool === SUBSTRATE_TOOL_SHORT;
}

function substratePayloadDigest(payload) {
  return crypto.createHash('sha256')
    .update(Buffer.from(JSON.stringify(payload), 'utf8'))
    .digest('hex');
}

function buildSubstrateArgs(intentFamily, input) {
  const policy = SUBSTRATE_CALL_POLICY[intentFamily];
  if (!policy) throw new Error('vtp_substrate_intent_unknown:' + String(intentFamily || ''));
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('vtp_substrate_input_invalid');
  }

  const allowed = new Set(['query', ...SECONDARY_SUBSTRATE_FILTERS]);
  for (const key of Object.keys(input)) {
    if (key === 'source_types' || key === 'limit') {
      throw new Error('vtp_substrate_policy_owned_field:' + key);
    }
    if (!allowed.has(key)) throw new Error('vtp_substrate_input_unsupported:' + key);
  }
  if (typeof input.query !== 'string' || input.query.length < 3) {
    throw new Error('vtp_substrate_query_invalid');
  }

  const payload = {
    query: input.query,
    source_types: policy.source_types.slice(),
    limit: policy.limit,
  };
  for (const key of SECONDARY_SUBSTRATE_FILTERS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    payload[key] = Array.isArray(input[key]) ? input[key].slice() : input[key];
  }
  return payload;
}

function prepareSubstrateCall(intentFamily, input) {
  const payload = buildSubstrateArgs(intentFamily, input);
  if (!validateSubstratePayload(payload)) {
    throw new Error('vtp_substrate_payload_invalid');
  }
  return {
    tool: SUBSTRATE_TOOL,
    payload,
    gateway_evidence: {
      schema_version: SUBSTRATE_SCHEMA_VERSION,
      intent_family: intentFamily,
      payload_sha256: substratePayloadDigest(payload),
    },
  };
}

function validatePreparedSubstrateCall(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
  if (!isSubstrateTool(candidate.tool)) return false;
  if (!candidate.payload || typeof candidate.payload !== 'object' || Array.isArray(candidate.payload)) return false;
  const evidence = candidate.gateway_evidence;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return false;
  if (evidence.schema_version !== SUBSTRATE_SCHEMA_VERSION) return false;
  const policy = SUBSTRATE_CALL_POLICY[evidence.intent_family];
  if (!policy) return false;
  if (evidence.payload_sha256 !== substratePayloadDigest(candidate.payload)) return false;
  if (!validateSubstratePayload(candidate.payload)) return false;
  if (candidate.payload.limit !== policy.limit) return false;
  if (!Array.isArray(candidate.payload.source_types)) return false;
  if (candidate.payload.source_types.length !== policy.source_types.length) return false;
  for (let index = 0; index < policy.source_types.length; index += 1) {
    if (candidate.payload.source_types[index] !== policy.source_types[index]) return false;
  }
  return true;
}

function rejectPromptSubstrateCallRecord(reason) {
  throw new Error('vtp_prompt_substrate_contract_invalid:' + reason);
}

function acceptPromptSubstrateCallRecord(intentFamily, preparedCall, substrateCallRecord) {
  if (!validatePreparedSubstrateCall(preparedCall)) {
    rejectPromptSubstrateCallRecord('prepared_call_missing_or_invalid');
  }
  if (preparedCall.gateway_evidence.intent_family !== intentFamily) {
    rejectPromptSubstrateCallRecord('prepared_call_intent_mismatch');
  }
  if (!substrateCallRecord || typeof substrateCallRecord !== 'object' || Array.isArray(substrateCallRecord)) {
    rejectPromptSubstrateCallRecord('substrate_call_record_missing');
  }
  if (
    !substrateCallRecord.gateway_evidence
    || typeof substrateCallRecord.gateway_evidence !== 'object'
    || Array.isArray(substrateCallRecord.gateway_evidence)
  ) {
    rejectPromptSubstrateCallRecord('gateway_evidence_missing');
  }
  if (
    !substrateCallRecord.payload
    || typeof substrateCallRecord.payload !== 'object'
    || Array.isArray(substrateCallRecord.payload)
    || substrateCallRecord.gateway_evidence.payload_sha256 !== substratePayloadDigest(substrateCallRecord.payload)
  ) {
    rejectPromptSubstrateCallRecord('record_digest_mismatch');
  }
  if (!validatePreparedSubstrateCall(substrateCallRecord)) {
    rejectPromptSubstrateCallRecord('substrate_call_record_invalid');
  }
  if (substrateCallRecord.gateway_evidence.intent_family !== intentFamily) {
    rejectPromptSubstrateCallRecord('record_intent_mismatch');
  }
  if (
    substrateCallRecord.tool !== preparedCall.tool
    || JSON.stringify(substrateCallRecord.payload) !== JSON.stringify(preparedCall.payload)
    || JSON.stringify(substrateCallRecord.gateway_evidence) !== JSON.stringify(preparedCall.gateway_evidence)
  ) {
    rejectPromptSubstrateCallRecord('record_prepared_call_mismatch');
  }
  return {
    ok: true,
    intent_family: intentFamily,
    payload_sha256: preparedCall.gateway_evidence.payload_sha256,
  };
}

/**
 * Date.now()-bracketed VTP MCP wrapper. Single measurement point for elapsed_ms
 * (per E-03 — VTP tools do not return this natively). Writes a routing-log row
 * on BOTH success AND failure paths (threat T-16-08 mitigation).
 *
 * The actual MCP dispatch is caller-injected via args.mcpInvoke(tool, payload)
 * — this keeps the composer testable and decouples the wrapper from the caller's
 * tool-invocation mechanism. Skills use their own Bash/Agent-tool invocation to
 * actually call mcp__vtp-kb__*; the composer's job is framing + measurement +
 * logging.
 *
 * @param {string} tool - canonical MCP tool name (e.g. 'mcp__vtp-kb__vtp_route_and_retrieve')
 * @param {Object} args
 * @param {Function} [args.mcpInvoke] - async (tool, payload) => response
 * @param {Object}   [args.payload]
 * @param {string}   args.projectDir
 * @param {string}   args.skillOrAgent
 * @param {string}   args.tier
 * @param {string}   args.rawQuery
 * @returns {Promise<{ok:boolean, response?:Object, elapsed_ms:number, reason?:string}>}
 */
function callVtp(tool, args) {
  const t0 = Date.now();
  const a = args || {};
  const rawQuery     = a.rawQuery     || '';
  const projectDir   = a.projectDir   || process.cwd();
  const skillOrAgent = a.skillOrAgent || 'unknown';
  const tier         = a.tier         || 'standalone';
  const logRoot      = a.logRoot      || projectDir;

  // Pre-guard: VTP schema requires raw_query.min(3) (intent-routing.ts:299).
  if (!rawQuery || typeof rawQuery !== 'string' || rawQuery.length < 3) {
    writeRoutingLogRow({
      projectDir,
      logRoot,
      skillOrAgent,
      tier,
      rawQuery,
      response: null,
      elapsed_ms: 0,
      failureReason: 'query_too_short',
      status: 'query_rejected',
    });
    return { ok: false, reason: 'query_too_short', elapsed_ms: 0 };
  }

  let transportPayload = a.payload;
  let gatewayEvidence = null;
  if (isSubstrateTool(tool)) {
    const payloadBypass = Object.prototype.hasOwnProperty.call(a, 'payload');
    if (payloadBypass || !validatePreparedSubstrateCall(a.substrateCall)) {
      const elapsed_ms = Date.now() - t0;
      writeRoutingLogRow({
        projectDir,
        logRoot,
        skillOrAgent,
        tier,
        rawQuery,
        response: null,
        elapsed_ms,
        failureReason: 'substrate_payload_invalid',
        status: 'validation_error',
      });
      return { ok: false, reason: 'substrate_payload_invalid', elapsed_ms };
    }
    transportPayload = a.substrateCall.payload;
    gatewayEvidence = a.substrateCall.gateway_evidence;
  }

  if (typeof a.mcpInvoke !== 'function') {
    // No injected invoker — return a structured failure rather than throwing.
    // Lets test fixtures and dry-runs exercise the code path cleanly.
    const elapsed_ms = Date.now() - t0;
    writeRoutingLogRow({
      projectDir,
      logRoot,
      skillOrAgent,
      tier,
      rawQuery,
      response: null,
      elapsed_ms,
      failureReason: 'no_mcp_invoke',
      status: 'mcp_unavailable',
    });
    return { ok: false, reason: 'no_mcp_invoke', elapsed_ms };
  }

  function onSuccess(response) {
    const elapsed_ms = Date.now() - t0;
    writeRoutingLogRow({ projectDir, logRoot, skillOrAgent, tier, rawQuery, response, elapsed_ms });
    const result = { ok: true, response, elapsed_ms };
    if (gatewayEvidence) result.gateway_evidence = gatewayEvidence;
    return result;
  }

  function onFailure(err) {
    const elapsed_ms = Date.now() - t0;
    const msg = (err && err.message) ? err.message : String(err);
    // Narrow-catch: swallow VTP/MCP/timeout shape errors; rethrow unknown.
    if (!/^(vtp_|mcp_|timeout)/.test(msg)) throw err;
    const status = /^timeout/.test(msg) || /timeout/.test(msg)
      ? 'timeout'
      : /^mcp_/.test(msg)
        ? 'mcp_error'
        : 'vtp_error';
    writeRoutingLogRow({ projectDir, logRoot, skillOrAgent, tier, rawQuery, response: null, elapsed_ms, failureReason: msg, status });
    return { ok: false, reason: msg, elapsed_ms };
  }

  try {
    const response = a.mcpInvoke(tool, transportPayload);
    if (response && typeof response.then === 'function') {
      return response.then(onSuccess, onFailure);
    }
    return onSuccess(response);
  } catch (err) {
    return onFailure(err);
  }
}

/**
 * Clear the in-memory cache. Test-only helper.
 */
function resetCache() {
  _cache = null;
}

module.exports = {
  compose,
  project,
  isFastPathEligible,
  callVtp,
  TIERS,
  resetCache,
  SUBSTRATE_CALL_POLICY,
  buildSubstrateArgs,
  prepareSubstrateCall,
  acceptPromptSubstrateCallRecord,
};

// Non-exported helpers kept on the function table for self-test access only
// (not part of the public contract).
module.exports._internal = {
  readConfigToggle,
  sanitizeRecentCommands,
  writeRoutingLogRow,
  extractRowFields,
  isSubstrateTool,
  validatePreparedSubstrateCall,
  substratePayloadDigest,
  FAST_PATH_TIMEOUT_MS,
  BUDGET_EXCEEDED,
};

// ---------------------------------------------------------------------------
// --self-test CLI
// Mirrors edge-guard.cjs:128-265 shape. Writes to a temp dir so the real
// .planning/metrics/ is untouched. Exits 0 on PASS, 1 on FAIL with reason.
// ---------------------------------------------------------------------------

function cliArgValue(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? null : (argv[index + 1] || null);
}

function runPrepareSubstrateCli(argv) {
  try {
    const intentFamily = cliArgValue(argv, '--intent');
    const inputFile = cliArgValue(argv, '--input-file');
    if (!intentFamily || !inputFile) throw new Error('vtp_substrate_cli_args_invalid');
    const root = findSgsdRoot(process.cwd()) || fs.realpathSync(process.cwd());
    const target = resolveContainedPath(root, inputFile);
    if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      throw new Error('vtp_substrate_input_file_uncontained');
    }
    const input = JSON.parse(fs.readFileSync(target, 'utf8').replace(/^\uFEFF/, ''));
    const envelope = prepareSubstrateCall(intentFamily, input);
    process.stdout.write(JSON.stringify(envelope) + '\n');
    return 0;
  } catch (error) {
    const reason = error && error.message ? error.message : String(error);
    process.stderr.write('vtp_prepare_substrate_call_failed:' + reason + '\n');
    return 1;
  }
}

function runAcceptSubstrateCallRecordCli(argv) {
  try {
    const intentFamily = cliArgValue(argv, '--intent');
    const preparedCallFile = cliArgValue(argv, '--prepared-call-file');
    const recordFile = cliArgValue(argv, '--record-file');
    if (!intentFamily || !preparedCallFile || !recordFile) {
      throw new Error('vtp_substrate_record_cli_args_invalid');
    }
    const root = findSgsdRoot(process.cwd()) || fs.realpathSync(process.cwd());
    const preparedTarget = resolveContainedPath(root, preparedCallFile);
    const recordTarget = resolveContainedPath(root, recordFile);
    for (const target of [preparedTarget, recordTarget]) {
      if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
        throw new Error('vtp_substrate_record_file_uncontained');
      }
    }
    const preparedCall = JSON.parse(fs.readFileSync(preparedTarget, 'utf8').replace(/^\uFEFF/, ''));
    const substrateCallRecord = JSON.parse(fs.readFileSync(recordTarget, 'utf8').replace(/^\uFEFF/, ''));
    const accepted = acceptPromptSubstrateCallRecord(intentFamily, preparedCall, substrateCallRecord);
    process.stdout.write(JSON.stringify(accepted) + '\n');
    return 0;
  } catch (error) {
    const reason = error && error.message ? error.message : String(error);
    process.stderr.write('vtp_accept_substrate_call_record_failed:' + reason + '\n');
    return 1;
  }
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) runSelfTest();
  else if (process.argv.includes('--prepare-substrate-call')) {
    process.exitCode = runPrepareSubstrateCli(process.argv.slice(2));
  } else if (process.argv.includes('--accept-substrate-call-record')) {
    process.exitCode = runAcceptSubstrateCallRecordCli(process.argv.slice(2));
  }
}

function runSelfTest() {
  const REQUIRED_ROW_KEYS = [
    'ts', 'event', 'tier', 'skill_or_agent', 'raw_query',
    'selected_query', 'retrieval_mode', 'reflection_verdict',
    'evidence_hit_count', 'top_doc_id', 'elapsed_ms',
  ];

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-composer-'));
  fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '---\nmilestone: "self-test"\ncurrent_phase: "16"\n---\n', 'utf8');
  let passed = true;
  let failReason = '';

  function fail(r) {
    if (passed) {
      passed = false;
      failReason = r;
    }
  }

  (async () => {
    try {
      // ---------------------------------------------------------------------
      // Test 1: compose() returns all documented fields
      // ---------------------------------------------------------------------
      resetCache();
      const ctx1 = compose({
        milestone: 'v1.3',
        phase: 16,
        plan: '01',
        repo: 'GSDedits',
        active_file: 'foo.cjs',
        blockers: [],
        explicit_constraints: ['D-07'],
        recent_turns: ['hi'],
        recent_errors: [],
      });
      const expectedKeys = [
        'session_id', 'repo', 'active_file', 'recent_turns', 'recent_commands',
        'recent_errors', 'current_task', 'blockers', 'explicit_constraints',
      ];
      for (const k of expectedKeys) {
        if (!(k in ctx1)) fail(`Test1: compose() missing field '${k}'`);
      }
      if (passed && ctx1.current_task !== 'phase:16,plan:01') {
        fail(`Test1: current_task expected 'phase:16,plan:01', got '${ctx1.current_task}'`);
      }

      // ---------------------------------------------------------------------
      // Test 2: project(ctx, tier) for all 6 TIERS returns exact field subset
      // ---------------------------------------------------------------------
      if (passed) {
        for (const tier of Object.keys(TIERS)) {
          const slice = project(ctx1, tier);
          const expect = TIERS[tier].fields.slice().sort();
          const got = Object.keys(slice).sort();
          if (expect.length !== got.length || expect.some((k, i) => k !== got[i])) {
            fail(`Test2: project(${tier}) keys mismatch. expected=${expect.join(',')} got=${got.join(',')}`);
            break;
          }
        }
      }

      // ---------------------------------------------------------------------
      // Test 3: project(ctx, 'bogus') throws 'vtp_tier_unknown:'
      // ---------------------------------------------------------------------
      if (passed) {
        let threw = false;
        try {
          project(ctx1, 'bogus_tier');
        } catch (e) {
          threw = true;
          if (!e.message.startsWith('vtp_tier_unknown:')) {
            fail(`Test3: error message '${e.message}' should start with 'vtp_tier_unknown:'`);
          }
        }
        if (!threw) fail(`Test3: project(ctx,'bogus') did not throw`);
      }

      // ---------------------------------------------------------------------
      // Test 4: isFastPathEligible — 4 scenarios
      // ---------------------------------------------------------------------
      if (passed) {
        if (isFastPathEligible({}) !== false)
          fail(`Test4a: empty ctx should be ineligible`);
        if (passed && isFastPathEligible({ current_task: 'x' }) !== false)
          fail(`Test4b: no constraints → ineligible`);
        if (passed && isFastPathEligible({ current_task: '', explicit_constraints: ['y'] }) !== false)
          fail(`Test4c: empty task → ineligible`);
        if (passed && isFastPathEligible({ current_task: 'phase:16', explicit_constraints: ['D-07'] }) !== true)
          fail(`Test4d: full ctx should be eligible`);
      }

      // ---------------------------------------------------------------------
      // Test 5: callVtp rawQuery < 3 chars → {ok:false, reason:'query_too_short', elapsed_ms:0}
      // ---------------------------------------------------------------------
      if (passed) {
        const r5 = await callVtp('mcp__vtp-kb__vtp_route_and_retrieve', {
          rawQuery: 'ab',
          projectDir: tmpDir,
          skillOrAgent: 'test',
          tier: 'triage',
          mcpInvoke: async () => { throw new Error('should not be called'); },
        });
        if (r5.ok !== false || r5.reason !== 'query_too_short' || r5.elapsed_ms !== 0) {
          fail(`Test5: got ${JSON.stringify(r5)}`);
        }
      }

      // ---------------------------------------------------------------------
      // Test 6: callVtp happy path writes row with all 11 keys + elapsed_ms
      // ---------------------------------------------------------------------
      if (passed) {
        const fakeResponse = {
          retrieval_plan: { selected_query: 'routed test query', retrieval_mode: 'architecture_hybrid' },
          reflection:     { verdict: 'sufficient' },
          evidence:       { hits: [{}, {}, {}], documents: [{ doc_id: 'doc:abc123' }] },
        };
        const r6 = await callVtp('mcp__vtp-kb__vtp_route_and_retrieve', {
          rawQuery: 'how should sgsd query vtp',
          projectDir: tmpDir,
          skillOrAgent: 'sgsd-triage',
          tier: 'triage',
          payload: { raw_query: 'how should sgsd query vtp' },
          mcpInvoke: async () => fakeResponse,
        });
        if (r6.ok !== true) fail(`Test6: ok should be true, got ${JSON.stringify(r6)}`);
        if (passed && typeof r6.elapsed_ms !== 'number') fail(`Test6: elapsed_ms not numeric`);

        const logPath = path.join(tmpDir, ROUTING_LOG_PATH);
        if (passed && !fs.existsSync(logPath)) fail(`Test6: routing-log file not created`);
        if (passed) {
          const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(l => l.trim());
          if (lines.length < 1) fail(`Test6: no rows written`);
          else {
            const row = JSON.parse(lines[lines.length - 1]);
            for (const k of REQUIRED_ROW_KEYS) {
              if (!(k in row)) { fail(`Test6: row missing key '${k}'`); break; }
            }
            if (passed && row.event !== 'vtp_call')               fail(`Test6: event != 'vtp_call'`);
            if (passed && row.tier !== 'triage')                  fail(`Test6: tier != 'triage'`);
            if (passed && row.selected_query !== 'routed test query') fail(`Test6: selected_query mismatch`);
            if (passed && row.reflection_verdict !== 'sufficient') fail(`Test6: reflection_verdict mismatch`);
            if (passed && row.evidence_hit_count !== 3)           fail(`Test6: evidence_hit_count != 3`);
            if (passed && row.top_doc_id !== 'doc:abc123')        fail(`Test6: top_doc_id mismatch`);
          }
        }
      }

      // ---------------------------------------------------------------------
      // Test 7: callVtp failure path (vtp_timeout) returns {ok:false} + logs row
      // ---------------------------------------------------------------------
      if (passed) {
        const r7 = await callVtp('mcp__vtp-kb__vtp_route_and_retrieve', {
          rawQuery: 'some raw query',
          projectDir: tmpDir,
          skillOrAgent: 'sgsd-triage',
          tier: 'triage',
          mcpInvoke: async () => { throw new Error('vtp_timeout: exceeded budget'); },
        });
        if (r7.ok !== false)            fail(`Test7: ok should be false`);
        if (passed && !/^vtp_timeout/.test(r7.reason)) fail(`Test7: reason should start vtp_timeout, got '${r7.reason}'`);
        if (passed && typeof r7.elapsed_ms !== 'number') fail(`Test7: elapsed_ms not numeric on failure`);

        const logPath = path.join(tmpDir, ROUTING_LOG_PATH);
        if (passed) {
          const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(l => l.trim());
          const last  = JSON.parse(lines[lines.length - 1]);
          if (last.failure_reason !== 'vtp_timeout: exceeded budget') {
            fail(`Test7: failure_reason not captured in row, got '${last.failure_reason}'`);
          }
        }
      }

      // ---------------------------------------------------------------------
      // Test 8: callVtp with unknown-shape error rethrows (programming bug)
      // ---------------------------------------------------------------------
      if (passed) {
        let rethrew = false;
        try {
          await callVtp('mcp__vtp-kb__vtp_route_and_retrieve', {
            rawQuery: 'some raw query',
            projectDir: tmpDir,
            skillOrAgent: 'test',
            tier: 'triage',
            mcpInvoke: async () => { throw new Error('RuntimeError: genuine bug'); },
          });
        } catch (e) {
          rethrew = true;
          if (!/RuntimeError/.test(e.message)) fail(`Test8: wrong error rethrown: '${e.message}'`);
        }
        if (!rethrew) fail(`Test8: unknown-shape error should have been rethrown`);
      }

      // ---------------------------------------------------------------------
      // Test 9: readConfigToggle defaults true when config missing
      // ---------------------------------------------------------------------
      if (passed) {
        const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-cfg-'));
        try {
          const toggle = module.exports._internal.readConfigToggle(emptyDir);
          if (toggle !== true) fail(`Test9: missing config should default true, got ${toggle}`);
        } finally {
          try { fs.rmSync(emptyDir, { recursive: true, force: true }); } catch (_) {}
        }
      }

      // ---------------------------------------------------------------------
      // Test 10: sanitizeRecentCommands strips env-var + KEY patterns (T-16-03)
      // ---------------------------------------------------------------------
      if (passed) {
        const sanitized = module.exports._internal.sanitizeRecentCommands([
          'git status',
          'GEMINI_API_KEY=sk-fake-abc',
          'CONTEXT7_API_KEY=ctx7-xyz',
          'FOO_KEY=bar',
          'echo hello',
          'MY_VAR=value',
        ]);
        if (sanitized.length !== 2) fail(`Test10: expected 2 clean entries, got ${sanitized.length}: ${JSON.stringify(sanitized)}`);
        if (passed && sanitized[0] !== 'git status') fail(`Test10: first clean entry wrong`);
        if (passed && sanitized[1] !== 'echo hello') fail(`Test10: second clean entry wrong`);
      }
    } catch (err) {
      fail(`Unexpected error: ${err.message}`);
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }

    if (passed) {
      console.log('PASS');
      process.exit(0);
    } else {
      console.error('FAIL: ' + failReason);
      process.exit(1);
    }
  })();
}
