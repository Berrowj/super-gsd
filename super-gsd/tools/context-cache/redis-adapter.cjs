// ============================================================================
// SGSD Phase 52 - Redis Live Cache Adapter (Skeleton, T1)
// ============================================================================
//
// PURPOSE
//   Optional Redis live memory projection adapter for the SGSD v1.9 stack.
//   This file exposes 8 Lock-13-wrapped public APIs that allow callers to
//   read/write hot context state from Redis WHEN AVAILABLE, and degrade to
//   SQLite/local files (REDIS-LOCK-06) without throwing or halting automode
//   when Redis is absent, disabled, or misbehaving.
//
//   Canonical truth NEVER moves into Redis. Redis is a derived projection
//   only (REDIS-LOCK-01).
//
// REFERENCES
//   - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-CONTEXT.md
//   - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-REDIS-GUIDE-DELTA.md
//   - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-RESEARCH.md
//   - Phase 46 super-gsd/tools/context-cache/rebuild.cjs (try/require pattern at lines 60-64;
//     KIND_VOCAB closed-enum at lines 97-103; _emitContextIndexComplaint envelope at 222-234)
//
// LOCK INVARIANTS (must hold for the entire lifetime of this file)
//
//   REDIS-LOCK-01  Projection only. Allowed kinds are exactly the 9 entries
//                  in ALLOWED_KINDS. Forbidden kinds are exactly the 7
//                  entries in FORBIDDEN_KINDS. The allowlist + denylist are
//                  Object.frozen at module load and mechanically enforced on
//                  every put (T2 wires the check; T1 ships the constants).
//
//   REDIS-LOCK-02  Source-hash invalidation. Every cached value carries the
//                  source_hashes set it was built from; on read, hashes are
//                  revalidated against canonical state, stale hits are
//                  deleted + logged (T2 fills _sourceHashesStillMatch).
//
//   REDIS-LOCK-03  Intent-scoped semantic cache. Keys = sha256 of joined
//                  (intent_id_normalized, role, phase, milestone,
//                  context_policy, sorted source_hashes). NO embedding /
//                  cosine / similarity. Two roles for same intent_id yield
//                  two distinct keys.
//
//   REDIS-LOCK-04  TTL + dedup. Every key has a TTL (TTL_BY_KIND map).
//                  Streams use approximate XADD MAXLEN trim, not manual
//                  XLEN+XDEL.
//
//   REDIS-LOCK-05  Safe flush. FLUSHDB must lose no canonical truth; the
//                  cockpit/cache warms back from SQLite/local files.
//
//   REDIS-LOCK-06  Degraded-OK. Redis down/disabled/missing-module/timeout
//                  -> degraded sentinel returned + projection log row +
//                  caller continues from SQLite/local.
//
//   REDIS-LOCK-07  Poisoned-key defense. Values failing schema validation,
//                  source-hash revalidation, or kind allowlist are deleted
//                  from Redis and logged as cache poison evidence.
//
// LOCK 4   This file may ONLY edit super-gsd/tools/context-cache/* and
//          package.json. It MUST NOT touch the Phase 41-51 trees:
//          token-attribution, token-waste, phase-capsule, context-registry,
//          context-packet, sqlite-context-index, dispatch-router, vtp-bridge,
//          memory-governance, context-bench, or sgsd-cockpit-shell.cjs.
//
// LOCK 11  Cache-hit decision is byte-equality only. NO embedding /
//          similarity. _composeSemanticKey collapses inputs to a single
//          sha256 string and the Redis GET on that exact string is the
//          ENTIRE hit/miss test.
//
// LOCK 13  Every public API is wrapped in try/catch and returns a degraded
//          sentinel of the documented shape. Public APIs MUST NEVER throw
//          upward. Internal helpers may throw; the wrapping public API
//          catches.
//
// CONVENTIONS
//   - ASCII-only literals. No smart quotes. No emoji.
//   - CommonJS only (no `import`).
//   - Module-level state is limited to the lazy redis client + the
//     singleton _client handle.
//   - All Redis keys are prefixed `sgsd:v19:` (namespace discipline).
//   - Pitfall 1: credentials in URLs are redacted via _redactRedisUrl
//     before any log emission.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ----------------------------------------------------------------------------
// OPTIONAL UPSTREAM IMPORT (Lock 13: try/require absorbs absence)
// Mirrors Phase 46 rebuild.cjs:60-64 try/require pattern for better-sqlite3.
// When redis npm module is not installed (e.g. `npm install --no-optional`),
// _redis stays null and isAvailable() returns degraded with reason
// 'redis_module_missing'. Loading this file MUST NOT throw.
// ----------------------------------------------------------------------------

let _redis = null;
try {
  _redis = require('redis');
} catch (_e) {
  _redis = null;
}

// ----------------------------------------------------------------------------
// FROZEN CONSTANTS
// ----------------------------------------------------------------------------

const SCHEMA_VERSION = 1;

const NS_PREFIX = 'sgsd:v19:';

// REDIS-LOCK-01 allowlist (9 entries). Source: 52-REDIS-GUIDE-DELTA.md
// "Redis Key Kinds" allowed list. Object.freeze + Set so size === 9 is
// mechanically checkable and `.add()` would throw at runtime.
const ALLOWED_KINDS = Object.freeze(new Set([
  'cockpit_snapshot',
  'active_agent_marker',
  'session_checkpoint_marker',
  'provider_health_cache',
  'hot_context_packet',
  'semantic_cache',
  'validated_thought_projection',
  'agent_event_stream',
  'short_lived_counter',
]));

// REDIS-LOCK-01 denylist (7 entries). Source: 52-REDIS-GUIDE-DELTA.md
// "Redis Key Kinds" forbidden list. Mechanically rejects any put with one
// of these kinds; reason='forbidden_kind'.
const FORBIDDEN_KINDS = Object.freeze(new Set([
  'decision',
  'debt',
  'evidence',
  'phase_capsule',
  'memory_lifecycle',
  'benchmark_result',
  'route_decision',
]));

// TTL_BY_KIND: 9-entry map per RESEARCH "Pitfall 3" recommended TTLs.
// agent_event_stream:0 means "stream entry, retention via XADD MAXLEN ~,
// not key-level TTL" (REDIS-LOCK-04).
const TTL_BY_KIND = Object.freeze({
  cockpit_snapshot: 60,
  active_agent_marker: 90,
  session_checkpoint_marker: 600,
  provider_health_cache: 120,
  hot_context_packet: 300,
  semantic_cache: 3600,
  validated_thought_projection: 1800,
  agent_event_stream: 0,
  short_lived_counter: 30,
});

// REDIS_REASON_CODES: closed enum, >=12 entries, used in degraded
// sentinels and projection log rows. Adding a new reason is a deliberate
// schema bump; downstream consumers (cockpit panels, F17 expected_reason_codes,
// dashboards) gate on this list.
const REDIS_REASON_CODES = Object.freeze([
  'redis_module_missing',
  'redis_disabled_no_url',
  'redis_disabled_by_env',
  'redis_connect_failed',
  'redis_op_timeout',
  'miss',
  'hit',
  'source_hash_drift',
  'poisoned_unparseable',
  'schema_invalid',
  'forbidden_kind',
  'unknown_kind',
  'redis_flushdb_recovered_via_sqlite',
  'internal_error',
]);

// Stream retention threshold (REDIS-LOCK-04). Approximate trim per
// RESEARCH Pattern 3: XADD ... MAXLEN ~ 1000 is O(1) amortized.
const STREAM_MAXLEN_APPROX = 1000;

// commandOptions.timeout per RESEARCH Pattern 1. 50ms ceiling means a
// hung Redis cannot stall the orchestrator; on timeout we degrade.
const REDIS_COMMAND_TIMEOUT_MS = 50;
const REDIS_CONNECT_TIMEOUT_MS = 5000;

// Projection log path (relative to repo root).
const PROJECTION_LOG_REL = '.planning/metrics/redis-projection-log.jsonl';

// ----------------------------------------------------------------------------
// MODULE-LEVEL STATE
// Lazy singleton client; reset on connect failure so a later isAvailable()
// will re-attempt. T5 wires reconnect strategy + backoff; T1 leaves null.
// ----------------------------------------------------------------------------

let _client = null;
let _clientConnectAttempted = false;

// ----------------------------------------------------------------------------
// __DIRNAME-ANCHORED RESOLVERS
// Mirrors Phase 46 rebuild.cjs:_resolveRepoRoot. tools/context-cache ->
// tools -> super-gsd -> repo.
// ----------------------------------------------------------------------------

function _resolveRepoRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function _resolveProjectionLogPath() {
  return path.join(_resolveRepoRoot(), PROJECTION_LOG_REL);
}

function _isoNow() {
  return new Date().toISOString();
}

// ----------------------------------------------------------------------------
// _redactRedisUrl (Pitfall 1 binding)
// Replaces the password segment in a redis URL with `***` so that projection
// log emissions cannot leak credentials (ASVS V2/V7 + self-test G2).
//
// Examples:
//   redis://user:secret@host:6379/0      -> redis://user:***@host:6379/0
//   redis://:topsecret@host:6379         -> redis://:***@host:6379
//   rediss://user:p@ss@host:6380         -> rediss://user:***@host:6380
//   redis://host:6379                    -> redis://host:6379  (unchanged)
//
// Regex `:[^@:/]*@` matches a colon, zero-or-more chars excluding @ : /,
// then @. The `[^@:/]` class prevents over-matching across slashes (path
// segments) and stops at the first `@` (the user@host boundary).
// ----------------------------------------------------------------------------

function _redactRedisUrl(s) {
  try {
    if (typeof s !== 'string' || s.length === 0) return '';
    return s.replace(/:[^@:/]*@/, ':***@');
  } catch (_e) {
    return '';
  }
}

// ----------------------------------------------------------------------------
// _emitProjectionLog (envelope-v1)
// Append-only JSONL writer for Redis adapter observability events. Mirrors
// Phase 41 envelope-v1 schema and Phase 46 rebuild.cjs:_emitContextIndexComplaint
// at lines 222-234. NEVER throws (Lock 13).
//
// Row schema:
//   { envelope_version: 1, command: 'emitProjectionLog',
//     ts: ISO-8601, status, reason, key?, kind?, detail? }
// additionalProperties:true so future fields require no schema bump.
// ----------------------------------------------------------------------------

function _emitProjectionLog(row, _opts) {
  try {
    const logPath = _resolveProjectionLogPath();
    const parent = path.dirname(logPath);
    try {
      fs.mkdirSync(parent, { recursive: true });
    } catch (_e) {
      // Directory exists or cannot be created; the appendFileSync below
      // will surface the real failure mode and be absorbed by the outer
      // try.
    }
    const base = {
      envelope_version: 1,
      command: 'emitProjectionLog',
      ts: _isoNow(),
    };
    const merged = Object.assign(base, row || {});
    // Defensive redaction: if caller passed `detail` containing a redis URL
    // with credentials, redact before write. Single-pass on the JSON string.
    const line = JSON.stringify(merged).replace(/:[^@:/"\\]*@/g, ':***@');
    fs.appendFileSync(logPath, line + '\n', 'utf8');
  } catch (_e) {
    // Lock 13: never throw on log-write failure. Caller continues.
  }
}

// ----------------------------------------------------------------------------
// _composeSemanticKey (REDIS-LOCK-03 + Lock 11 binding)
// Pitfall 2: deterministic byte-equality key. Inputs are joined with `:`
// delimiter and source_hashes are sorted (sliced copy so caller's array is
// not mutated) and joined with `,`. The whole string is sha256-hashed.
// Two different roles for the same intent yield two different keys.
// ----------------------------------------------------------------------------

function _composeSemanticKey(parts) {
  if (!parts || typeof parts !== 'object') {
    throw new Error('semantic_key: parts must be object');
  }
  const intent = String(parts.intent_id || '');
  const role = String(parts.role || '');
  const phase = String(parts.phase || '');
  const milestone = String(parts.milestone || '');
  const policy = String(parts.context_policy || '');
  const hashes = Array.isArray(parts.source_hashes)
    ? parts.source_hashes.slice().sort().join(',')
    : '';
  const joined = [intent, role, phase, milestone, policy, hashes].join(':');
  const digest = crypto.createHash('sha256').update(joined).digest('hex');
  return NS_PREFIX + 'semantic:' + digest;
}

// ----------------------------------------------------------------------------
// _validateRedisValueSchema (REDIS-LOCK-07 binding; T2 fills full body)
// Closed-enum check on val.kind + presence of required envelope fields.
// T1 ships the entry-point + ALLOWED_KINDS / FORBIDDEN_KINDS check; T2
// extends with canonical_refs walk + ttl_seconds bound check.
// ----------------------------------------------------------------------------

function _validateRedisValueSchema(val) {
  if (!val || typeof val !== 'object') {
    return { ok: false, reason: 'schema_invalid' };
  }
  if (val.schema_version !== SCHEMA_VERSION) {
    return { ok: false, reason: 'schema_invalid' };
  }
  const kind = val.kind;
  if (typeof kind !== 'string' || kind.length === 0) {
    return { ok: false, reason: 'schema_invalid' };
  }
  if (FORBIDDEN_KINDS.has(kind)) {
    return { ok: false, reason: 'forbidden_kind' };
  }
  if (!ALLOWED_KINDS.has(kind)) {
    return { ok: false, reason: 'unknown_kind' };
  }
  if (!Array.isArray(val.source_hashes)) {
    return { ok: false, reason: 'schema_invalid' };
  }
  if (!Array.isArray(val.canonical_refs)) {
    return { ok: false, reason: 'schema_invalid' };
  }
  if (typeof val.ttl_seconds !== 'number') {
    return { ok: false, reason: 'schema_invalid' };
  }
  return { ok: true };
}

// ----------------------------------------------------------------------------
// _sourceHashesStillMatch (REDIS-LOCK-02 binding; T2 fills full body)
// T1 ships a permissive stub that returns { ok: true } so T1 self-tests
// can call cache APIs without a canonical-refs file system. T2 swaps in
// the real sha256 walker over canonical_refs.
// ----------------------------------------------------------------------------

function _sourceHashesStillMatch(_sourceHashes, _canonicalRefs) {
  return { ok: true };
}

// ----------------------------------------------------------------------------
// _getClient (RESEARCH Pattern 1; T1 stub returns null when redis absent)
// Lazy singleton. Returns the connected client or null. NEVER throws.
// T5 fills the full reconnectStrategy + exponential backoff + jitter.
// T1 returns null whenever:
//   - redis npm module is absent
//   - SGSD_REDIS_DISABLED=1
//   - SGSD_REDIS_URL is empty/missing
// so all 8 public APIs hit the degraded sentinel path on a fresh
// `npm install --no-optional` machine (the entire point of optionalDependencies).
// ----------------------------------------------------------------------------

function _envFlag(name) {
  const v = process.env[name];
  if (typeof v !== 'string') return false;
  const t = v.trim().toLowerCase();
  return t === '1' || t === 'true' || t === 'yes' || t === 'on';
}

function _disabledReason() {
  if (_redis === null) return 'redis_module_missing';
  if (_envFlag('SGSD_REDIS_DISABLED')) return 'redis_disabled_by_env';
  const url = process.env.SGSD_REDIS_URL;
  if (typeof url !== 'string' || url.length === 0) return 'redis_disabled_no_url';
  return null;
}

async function _getClient() {
  // T1 short-circuit: if any disabled reason fires, do not attempt to
  // open a connection. Returning null here is the entire degraded-OK
  // contract (REDIS-LOCK-06). T5 will add reconnectStrategy when a real
  // URL is present.
  const reason = _disabledReason();
  if (reason) return null;
  if (_client) return _client;
  if (_clientConnectAttempted) return null;
  _clientConnectAttempted = true;
  try {
    // Defensive: only call into _redis.createClient if it is a function.
    // Some redis@5 builds export the symbol shape differently; guard.
    if (!_redis || typeof _redis.createClient !== 'function') {
      return null;
    }
    const url = process.env.SGSD_REDIS_URL;
    const client = _redis.createClient({
      url: url,
      socket: {
        connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      },
      commandOptions: {
        timeout: REDIS_COMMAND_TIMEOUT_MS,
      },
    });
    // T5 wires the 'error' handler + reconnectStrategy. T1 leaves the
    // client unconnected; we DO NOT call client.connect() in T1 so that
    // selfTest A4 does not need a live Redis on the build agent.
    return null;
  } catch (_e) {
    _emitProjectionLog({
      status: 'degraded',
      reason: 'redis_connect_failed',
      detail: _redactRedisUrl(String(process.env.SGSD_REDIS_URL || '')),
    });
    return null;
  }
}

// ----------------------------------------------------------------------------
// PUBLIC API SURFACE (8 + selfTest)
// Every export below is Lock-13 wrapped: try/catch around the entire body,
// catch returns a documented degraded sentinel, NEVER throws.
// ----------------------------------------------------------------------------

// 1. isAvailable(opts) -> { ok, degraded_reason, metadata }
async function isAvailable(_opts) {
  try {
    const reason = _disabledReason();
    if (reason) {
      return {
        ok: false,
        degraded_reason: reason,
        metadata: { schema_version: SCHEMA_VERSION },
      };
    }
    // T1: do not open a real connection here; return ok:false until T5
    // wires the connect path. The shape is the contract.
    const client = await _getClient();
    if (!client) {
      return {
        ok: false,
        degraded_reason: 'redis_connect_failed',
        metadata: { schema_version: SCHEMA_VERSION },
      };
    }
    return {
      ok: true,
      degraded_reason: null,
      metadata: { schema_version: SCHEMA_VERSION },
    };
  } catch (_e) {
    return {
      ok: false,
      degraded_reason: 'internal_error',
      metadata: { schema_version: SCHEMA_VERSION },
    };
  }
}

// 2. getHotPacket(key) -> { hit, stale, packet, reason }
async function getHotPacket(_key) {
  try {
    const client = await _getClient();
    if (!client) {
      return { hit: false, stale: false, packet: null, reason: _disabledReason() || 'miss', source: 'degraded' };
    }
    // T3 fills the GET + parse + revalidate body. T1 returns miss.
    return { hit: false, stale: false, packet: null, reason: 'miss', source: 'redis' };
  } catch (_e) {
    return { hit: false, stale: false, packet: null, reason: 'internal_error', source: 'degraded' };
  }
}

// 3. putHotPacket(key, packet, metadata) -> { ok, key, ttl_seconds }
async function putHotPacket(_key, _packet, _metadata) {
  try {
    const client = await _getClient();
    if (!client) {
      return { ok: false, key: null, ttl_seconds: 0, reason: _disabledReason() || 'redis_connect_failed', source: 'degraded' };
    }
    // T3 fills the SET EX + schema-validate body. T1 returns degraded.
    return { ok: false, key: null, ttl_seconds: 0, reason: 'redis_connect_failed', source: 'redis' };
  } catch (_e) {
    return { ok: false, key: null, ttl_seconds: 0, reason: 'internal_error', source: 'degraded' };
  }
}

// 4. getSemanticCache(query) -> { hit, stale, value, reason }
async function getSemanticCache(_query) {
  try {
    const client = await _getClient();
    if (!client) {
      return { hit: false, stale: false, value: null, reason: _disabledReason() || 'miss', source: 'degraded' };
    }
    // T3 fills the body. T1 returns miss.
    return { hit: false, stale: false, value: null, reason: 'miss', source: 'redis' };
  } catch (_e) {
    return { hit: false, stale: false, value: null, reason: 'internal_error', source: 'degraded' };
  }
}

// 5. putSemanticCache(query, value, metadata) -> { ok, key, ttl_seconds }
async function putSemanticCache(_query, _value, _metadata) {
  try {
    const client = await _getClient();
    if (!client) {
      return { ok: false, key: null, ttl_seconds: 0, reason: _disabledReason() || 'redis_connect_failed', source: 'degraded' };
    }
    // T3 fills the body. T1 returns degraded.
    return { ok: false, key: null, ttl_seconds: 0, reason: 'redis_connect_failed', source: 'redis' };
  } catch (_e) {
    return { ok: false, key: null, ttl_seconds: 0, reason: 'internal_error', source: 'degraded' };
  }
}

// 6. publishEvent(event) -> { ok, stream_id, reason }
async function publishEvent(_event) {
  try {
    const client = await _getClient();
    if (!client) {
      return { ok: false, stream_id: null, reason: _disabledReason() || 'redis_connect_failed', source: 'degraded' };
    }
    // T4 fills XADD + MAXLEN ~ trim. T1 returns degraded.
    return { ok: false, stream_id: null, reason: 'redis_connect_failed', source: 'redis' };
  } catch (_e) {
    return { ok: false, stream_id: null, reason: 'internal_error', source: 'degraded' };
  }
}

// 7. readEvents(scope) -> { ok, events, reason }
async function readEvents(_scope) {
  try {
    const client = await _getClient();
    if (!client) {
      return { ok: false, events: [], reason: _disabledReason() || 'redis_connect_failed', source: 'degraded' };
    }
    // T4 fills XRANGE/XREAD body. T1 returns empty.
    return { ok: false, events: [], reason: 'redis_connect_failed', source: 'redis' };
  } catch (_e) {
    return { ok: false, events: [], reason: 'internal_error', source: 'degraded' };
  }
}

// 8. invalidateBySourceHash(source_hash) -> { ok, count }
async function invalidateBySourceHash(_sourceHash) {
  try {
    const client = await _getClient();
    if (!client) {
      return { ok: false, count: 0, deleted_count: 0, reason: _disabledReason() || 'redis_connect_failed', source: 'degraded' };
    }
    // T2 fills SCAN MATCH sgsd:v19:* + DEL by source_hash match. T1 zero.
    return { ok: false, count: 0, deleted_count: 0, reason: 'redis_connect_failed', source: 'redis' };
  } catch (_e) {
    return { ok: false, count: 0, deleted_count: 0, reason: 'internal_error', source: 'degraded' };
  }
}

// ----------------------------------------------------------------------------
// _testHook_simulateFlushAndPoison (T5 fills body; T1 stub for F17 binding)
// Phase 51 F17 cross-binding hook. T1 ships a callable that returns a
// degraded sentinel so F17_STUB inject() does not crash if it lands before
// T5 fills the real flush+poison sequence.
// ----------------------------------------------------------------------------

async function _testHook_simulateFlushAndPoison(_opts) {
  try {
    return {
      ok: false,
      steps: [],
      reason: _disabledReason() || 'redis_connect_failed',
      source: 'degraded',
    };
  } catch (_e) {
    return { ok: false, steps: [], reason: 'internal_error', source: 'degraded' };
  }
}

// ----------------------------------------------------------------------------
// selfTest() - bootstrap assertions A0..A4 (T1 surface)
//
// T7 will replace this body with a require() of redis-adapter.test.cjs +
// runAll() delegating to the full 16-assertion harness. T1 ships an
// in-file bootstrap so `node redis-adapter.cjs --self-test` exits 0 with
// 5/5 PASS today, validating the surface contract before T7 lands.
// Lock 13 wrapped: any thrown exception is converted to a single fail row.
// ----------------------------------------------------------------------------

function _bootstrapAssert(id, fn) {
  try {
    const detail = fn();
    return { id: id, ok: true, detail: detail || null };
  } catch (e) {
    return { id: id, ok: false, reason: (e && e.message) ? e.message : String(e) };
  }
}

async function _bootstrapAssertAsync(id, fn) {
  try {
    const detail = await fn();
    return { id: id, ok: true, detail: detail || null };
  } catch (e) {
    return { id: id, ok: false, reason: (e && e.message) ? e.message : String(e) };
  }
}

async function selfTest() {
  const results = [];

  // A0: 8 public APIs exported as functions + REDIS_REASON_CODES frozen
  //     with >=12 entries + TTL_BY_KIND frozen with 9 entries.
  results.push(_bootstrapAssert('A0_surface', function () {
    const apis = [
      'isAvailable', 'getHotPacket', 'putHotPacket',
      'getSemanticCache', 'putSemanticCache',
      'publishEvent', 'readEvents', 'invalidateBySourceHash',
    ];
    for (const name of apis) {
      if (typeof module.exports[name] !== 'function') {
        throw new Error('export ' + name + ' must be function');
      }
    }
    if (!Object.isFrozen(REDIS_REASON_CODES)) {
      throw new Error('REDIS_REASON_CODES must be Object.freeze');
    }
    if (REDIS_REASON_CODES.length < 12) {
      throw new Error('REDIS_REASON_CODES must have >=12 entries; got ' + REDIS_REASON_CODES.length);
    }
    if (!Object.isFrozen(TTL_BY_KIND)) {
      throw new Error('TTL_BY_KIND must be Object.freeze');
    }
    const ttlKeys = Object.keys(TTL_BY_KIND);
    if (ttlKeys.length !== 9) {
      throw new Error('TTL_BY_KIND must have exactly 9 entries; got ' + ttlKeys.length);
    }
    return { apis: apis.length, reason_codes: REDIS_REASON_CODES.length, ttl_kinds: ttlKeys.length };
  }));

  // A1: ALLOWED_KINDS frozen + 9 entries + exact membership.
  results.push(_bootstrapAssert('A1_allowed_kinds', function () {
    if (!Object.isFrozen(ALLOWED_KINDS)) {
      throw new Error('ALLOWED_KINDS must be Object.freeze');
    }
    if (ALLOWED_KINDS.size !== 9) {
      throw new Error('ALLOWED_KINDS size must be 9; got ' + ALLOWED_KINDS.size);
    }
    const expected = [
      'cockpit_snapshot', 'active_agent_marker', 'session_checkpoint_marker',
      'provider_health_cache', 'hot_context_packet', 'semantic_cache',
      'validated_thought_projection', 'agent_event_stream', 'short_lived_counter',
    ];
    for (const k of expected) {
      if (!ALLOWED_KINDS.has(k)) throw new Error('ALLOWED_KINDS missing: ' + k);
    }
    return { size: ALLOWED_KINDS.size };
  }));

  // A2: FORBIDDEN_KINDS frozen + 7 entries + exact membership.
  results.push(_bootstrapAssert('A2_forbidden_kinds', function () {
    if (!Object.isFrozen(FORBIDDEN_KINDS)) {
      throw new Error('FORBIDDEN_KINDS must be Object.freeze');
    }
    if (FORBIDDEN_KINDS.size !== 7) {
      throw new Error('FORBIDDEN_KINDS size must be 7; got ' + FORBIDDEN_KINDS.size);
    }
    const expected = [
      'decision', 'debt', 'evidence', 'phase_capsule',
      'memory_lifecycle', 'benchmark_result', 'route_decision',
    ];
    for (const k of expected) {
      if (!FORBIDDEN_KINDS.has(k)) throw new Error('FORBIDDEN_KINDS missing: ' + k);
    }
    return { size: FORBIDDEN_KINDS.size };
  }));

  // A3: isAvailable() returns ok:false when SGSD_REDIS_DISABLED=1 OR
  //     redis module absent OR SGSD_REDIS_URL missing. Asserts at least
  //     one of those branches fires under the test harness env.
  results.push(await _bootstrapAssertAsync('A3_isAvailable_degraded', async function () {
    const prevDisabled = process.env.SGSD_REDIS_DISABLED;
    process.env.SGSD_REDIS_DISABLED = '1';
    try {
      const r = await isAvailable();
      if (r.ok !== false) {
        throw new Error('isAvailable must return ok:false when disabled; got ok=' + r.ok);
      }
      if (typeof r.degraded_reason !== 'string' || r.degraded_reason.length === 0) {
        throw new Error('degraded_reason must be non-empty string');
      }
      if (REDIS_REASON_CODES.indexOf(r.degraded_reason) === -1) {
        throw new Error('degraded_reason not in REDIS_REASON_CODES: ' + r.degraded_reason);
      }
      return { degraded_reason: r.degraded_reason };
    } finally {
      if (typeof prevDisabled === 'undefined') delete process.env.SGSD_REDIS_DISABLED;
      else process.env.SGSD_REDIS_DISABLED = prevDisabled;
    }
  }));

  // A4: Lock 13 - call every public API with bogus inputs; no throw escapes.
  //     Also asserts _redactRedisUrl Pitfall 1 binding.
  results.push(await _bootstrapAssertAsync('A4_lock13_no_throw', async function () {
    const redacted = _redactRedisUrl('redis://user:secret@host:6379/0');
    if (redacted !== 'redis://user:***@host:6379/0') {
      throw new Error('_redactRedisUrl Pitfall 1 fail; got ' + redacted);
    }
    const calls = [
      ['isAvailable', isAvailable, []],
      ['getHotPacket', getHotPacket, [null]],
      ['putHotPacket', putHotPacket, [null, null, null]],
      ['getSemanticCache', getSemanticCache, [null]],
      ['putSemanticCache', putSemanticCache, [null, null, null]],
      ['publishEvent', publishEvent, [null]],
      ['readEvents', readEvents, [null]],
      ['invalidateBySourceHash', invalidateBySourceHash, [null]],
    ];
    let escaped = null;
    for (const tuple of calls) {
      const name = tuple[0];
      const fn = tuple[1];
      const args = tuple[2];
      try {
        const r = await fn.apply(null, args);
        if (!r || typeof r !== 'object') {
          escaped = name + ': non-object return';
          break;
        }
      } catch (e) {
        escaped = name + ': threw ' + (e && e.message ? e.message : String(e));
        break;
      }
    }
    if (escaped) throw new Error('Lock 13 violation: ' + escaped);
    return { calls: calls.length };
  }));

  let pass = 0;
  let fail = 0;
  for (const r of results) {
    if (r.ok) pass++; else fail++;
  }
  return { pass: pass, fail: fail, total: results.length, results: results };
}

// ----------------------------------------------------------------------------
// MODULE EXPORTS
// Public API surface (8) + selfTest + frozen constants + the test hook
// stub. Helpers (_redactRedisUrl, _composeSemanticKey, etc.) are exported
// via _internals to keep the public surface minimal while letting T2..T7
// and the inline test harness reach them without monkey-patching.
// ----------------------------------------------------------------------------

module.exports = {
  // 8 public APIs (Lock 13 wrapped)
  isAvailable: isAvailable,
  getHotPacket: getHotPacket,
  putHotPacket: putHotPacket,
  getSemanticCache: getSemanticCache,
  putSemanticCache: putSemanticCache,
  publishEvent: publishEvent,
  readEvents: readEvents,
  invalidateBySourceHash: invalidateBySourceHash,

  // Self-test entry point
  selfTest: selfTest,

  // F17 cross-binding hook (T5 fills)
  _testHook_simulateFlushAndPoison: _testHook_simulateFlushAndPoison,

  // Frozen constants (read-only contract)
  ALLOWED_KINDS: ALLOWED_KINDS,
  FORBIDDEN_KINDS: FORBIDDEN_KINDS,
  TTL_BY_KIND: TTL_BY_KIND,
  REDIS_REASON_CODES: REDIS_REASON_CODES,
  SCHEMA_VERSION: SCHEMA_VERSION,
  NS_PREFIX: NS_PREFIX,
  STREAM_MAXLEN_APPROX: STREAM_MAXLEN_APPROX,

  // Internal helpers exposed for T2..T7 + inline test harness only.
  // External callers MUST use the 8 public APIs above; touching _internals
  // is a Lock 13 violation.
  _internals: {
    _redactRedisUrl: _redactRedisUrl,
    _composeSemanticKey: _composeSemanticKey,
    _validateRedisValueSchema: _validateRedisValueSchema,
    _sourceHashesStillMatch: _sourceHashesStillMatch,
    _emitProjectionLog: _emitProjectionLog,
    _disabledReason: _disabledReason,
    _envFlag: _envFlag,
  },
};

// ----------------------------------------------------------------------------
// CLI ENTRY POINT
// `node super-gsd/tools/context-cache/redis-adapter.cjs --self-test [--groups=A,B]`
// Exit 0 on green, exit 1 on first fail (per stop_rule). The --groups
// filter is a placeholder for T7's full harness; T1 ignores it but
// preserves the flag so the wiring contract is forward-compatible.
// ----------------------------------------------------------------------------

if (require.main === module) {
  const argv = process.argv.slice(2);
  const wantSelfTest = argv.indexOf('--self-test') !== -1;
  if (!wantSelfTest) {
    process.stdout.write('redis-adapter.cjs T1 skeleton. Use --self-test to run bootstrap assertions.\n');
    process.exit(0);
  }
  selfTest().then(function (out) {
    const lines = [];
    lines.push('redis-adapter.cjs --self-test (T1 bootstrap)');
    for (const r of out.results) {
      const tag = r.ok ? 'PASS' : 'FAIL';
      const reason = r.ok ? '' : ' :: ' + (r.reason || 'unknown');
      lines.push('  [' + tag + '] ' + r.id + reason);
    }
    lines.push('Summary: ' + out.pass + '/' + out.total + ' PASS, ' + out.fail + ' FAIL');
    process.stdout.write(lines.join('\n') + '\n');
    process.exit(out.fail === 0 ? 0 : 1);
  }).catch(function (e) {
    process.stdout.write('redis-adapter.cjs --self-test threw: ' + (e && e.message ? e.message : String(e)) + '\n');
    process.exit(1);
  });
}
