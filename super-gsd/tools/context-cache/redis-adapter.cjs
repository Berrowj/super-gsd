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
//                  in ALLOWED_KINDS. Forbidden kinds are exactly the 8
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

// REDIS-LOCK-01 denylist (8 entries). Source: 52-REDIS-GUIDE-DELTA.md
// "Redis Key Kinds" forbidden list. Mechanically rejects any put with one
// of these kinds; reason='forbidden_kind'.
//
// Note on `validated_thought` vs `validated_thought_projection`:
//   - `validated_thought` is canonical truth. It lives in
//     memory-governance / .planning/ and MUST NEVER be stored in Redis
//     (REDIS-LOCK-01: projection-only). Hence forbidden.
//   - `validated_thought_projection` is a SUMMARY/projection of a
//     validated thought, safe to cache in Redis. Stays in ALLOWED_KINDS.
const FORBIDDEN_KINDS = Object.freeze(new Set([
  'decision',
  'debt',
  'evidence',
  'phase_capsule',
  'memory_lifecycle',
  'benchmark_result',
  'route_decision',
  'validated_thought',
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
// _emitProjectionLog (T1 deferral stub; T5 wires the canonical writer)
//
// CONTRACT BOUNDARY (52-01 T1 vs T5):
//   T1 must NOT perform any fs.appendFileSync / fs.writeFile to the
//   projection log file. The append-only JSONL writer + envelope-v1 row
//   schema + Pitfall 1 redaction is T5's deliverable per
//   52-PLAN.md task split. T1 ships the call sites + the disabled-OK
//   short-circuits so the 8 public APIs and _getClient compile and test
//   green; the body here is a deliberate no-op until T5 lands.
//
// Why no-op (not delete):
//   _getClient and several public-API catch blocks already invoke
//   _emitProjectionLog; making it a callable no-op preserves call-site
//   stability, prevents Lock 13 violations from a missing function, and
//   lets T5's diff be additive (fill the body, no rewiring of callers).
//
// T5 will replace this body with the envelope-v1 writer:
//   - mkdirSync(parent, { recursive: true })
//   - merge { envelope_version:1, command:'emitProjectionLog', ts } + row
//   - JSON.stringify with /:[^@:/"\\]*@/g credential redaction
//   - fs.appendFileSync(logPath, line + '\n', 'utf8')
// per REDIS-LOCK-06 + projection-log envelope-v1 schema (Phase 41).
// NEVER throws (Lock 13) - both T1 stub and T5 impl absorb errors.
// ----------------------------------------------------------------------------

function _emitProjectionLog(_row, _opts) {
  // TODO(T5): wire fs.appendFileSync per REDIS-LOCK-06 + projection-log
  // envelope-v1. T1 intentionally no-ops to honor the task-deferral
  // invariant ("No fs.writeFile/appendFile in T1 skeleton").
  return;
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
// _validateRedisValueSchema (REDIS-LOCK-07 binding; T2 full body)
//
// CONTRACT (PLAN line 227 + verification_cmd line 265):
//   Returns null on a fully-formed valid envelope.
//   Returns a string reason from REDIS_REASON_CODES on any failure.
//
// Required envelope fields (10 mandatory; per 52-CONTEXT.md "Required Key Policy"
// minus optional intent_id/role which Class 1 markers omit):
//   schema_version === 1
//   kind in ALLOWED_KINDS, NOT in FORBIDDEN_KINDS  (Lock 11 byte-equality on Set membership)
//   milestone:string, phase:string
//   source_hashes:Array, length>=1, each element string
//   canonical_refs:Array
//   created_at:string
//   ttl_seconds:number, > 0
//
// Defense in depth (REDIS-LOCK-07): kind allowlist + denylist are checked
// independently. A denylisted kind that somehow appears in ALLOWED_KINDS
// (impossible by frozen Sets, but defended anyway) is rejected as
// 'forbidden_kind' - the denylist wins.
// ----------------------------------------------------------------------------

function _validateRedisValueSchema(val) {
  if (!val || typeof val !== 'object') return 'schema_invalid';
  if (val.schema_version !== SCHEMA_VERSION) return 'schema_invalid';
  const kind = val.kind;
  if (typeof kind !== 'string' || kind.length === 0) return 'schema_invalid';
  // Denylist check FIRST (defense in depth - REDIS-LOCK-07 Lock 11 byte-equality)
  if (FORBIDDEN_KINDS.has(kind)) return 'forbidden_kind';
  // Allowlist check (closed enum)
  if (!ALLOWED_KINDS.has(kind)) return 'schema_invalid';
  if (typeof val.milestone !== 'string') return 'schema_invalid';
  if (typeof val.phase !== 'string') return 'schema_invalid';
  if (!Array.isArray(val.source_hashes) || val.source_hashes.length < 1) return 'schema_invalid';
  for (let i = 0; i < val.source_hashes.length; i++) {
    if (typeof val.source_hashes[i] !== 'string') return 'schema_invalid';
  }
  if (!Array.isArray(val.canonical_refs)) return 'schema_invalid';
  if (typeof val.created_at !== 'string') return 'schema_invalid';
  if (typeof val.ttl_seconds !== 'number' || val.ttl_seconds <= 0) return 'schema_invalid';
  return null;
}

// ----------------------------------------------------------------------------
// _sha256OfFile (REDIS-LOCK-02 binding; pure helper)
//
// LOCK 4 NOTE: Phase 46 rebuild.cjs lines 192-199 contain the canonical
// 8-line implementation. Per RESEARCH "Don't Hand-Roll" guidance, the
// function is pure and trivially mirrored - replicating locally rather
// than require()'ing rebuild.cjs avoids cross-file coupling and honors
// the Lock 4 boundary (no edits to rebuild.cjs, no reach into its
// internals). Returns null on any read error so the caller can treat
// drift conservatively (REDIS-LOCK-02: missing canonical truth = drift).
// ----------------------------------------------------------------------------

function _sha256OfFile(absPath) {
  try {
    if (typeof absPath !== 'string' || absPath.length === 0) return null;
    const buf = fs.readFileSync(absPath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch (_e) {
    return null;
  }
}

// ----------------------------------------------------------------------------
// _sourceHashesStillMatch (REDIS-LOCK-02 binding; T2 full body)
//
// Walks canonical_refs[] computing _sha256OfFile per ref, then compares
// the computed hash array against the stored source_hashes array via
// sorted byte-equality (Lock 11: NO fuzzy matching, NO subset, NO order
// tolerance). Returns true only on exact match.
//
// Conservative fail-closed (REDIS-LOCK-02 + REDIS-LOCK-07):
//   - any ref read fails -> _sha256OfFile returns null -> drift -> false
//   - canonical_refs missing/non-array -> drift -> false
//   - source_hashes count mismatches canonical_refs count -> drift -> false
//
// Resolves canonical_refs against repo root when path is relative; absolute
// paths pass through. NEVER throws; on any unexpected error returns false.
// ----------------------------------------------------------------------------

function _sourceHashesStillMatch(sourceHashes, canonicalRefs) {
  try {
    if (!Array.isArray(sourceHashes) || !Array.isArray(canonicalRefs)) return false;
    if (sourceHashes.length !== canonicalRefs.length) return false;
    if (sourceHashes.length === 0) return false;
    const repoRoot = _resolveRepoRoot();
    const computed = [];
    for (let i = 0; i < canonicalRefs.length; i++) {
      const ref = canonicalRefs[i];
      if (typeof ref !== 'string' || ref.length === 0) return false;
      const abs = path.isAbsolute(ref) ? ref : path.join(repoRoot, ref);
      const h = _sha256OfFile(abs);
      if (h === null) return false; // conservative fail-closed
      computed.push(h);
    }
    // Lock 11 byte-equality: sorted-array .every() comparison
    const a = sourceHashes.slice().sort();
    const b = computed.slice().sort();
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  } catch (_e) {
    return false;
  }
}

// ----------------------------------------------------------------------------
// _revalidateAndMaybeDelete (REDIS-LOCK-02 + REDIS-LOCK-07 binding; T2)
//
// Read-path gate. Given a raw string fetched from Redis under `key`,
// runs the three poisoned-key defenses in order:
//   1. JSON.parse - reject 'poisoned_unparseable'
//   2. _validateRedisValueSchema - reject schema_invalid|forbidden_kind|...
//   3. _sourceHashesStillMatch - reject 'source_hash_drift'
//
// On any rejection: deletes the offending key from Redis (mock or live)
// and emits a projection-log row with status='rejected' so cache poison
// evidence is observable. NEVER throws (Lock 13).
//
// Inputs:
//   c          - Redis client (or mock with .del / .get async methods)
//   key        - string namespaced key (sgsd:v19:...)
//   raw        - string from c.get(key); null/undefined means miss upstream
//
// Returns: { valid: boolean, reason: string, val: object|null }
//   valid:true,reason:'hit',val:parsed             - serve to caller
//   valid:false,reason:<code>,val:null             - upstream returns miss/stale
// ----------------------------------------------------------------------------

async function _revalidateAndMaybeDelete(c, key, raw) {
  // Defensive: missing inputs map to a generic miss so callers do not
  // attempt to serve garbage. Lock 13: never throw.
  if (!c || typeof c.del !== 'function') {
    return { valid: false, reason: 'internal_error', val: null };
  }
  if (typeof raw !== 'string' || raw.length === 0) {
    return { valid: false, reason: 'miss', val: null };
  }

  // Defense 1: JSON.parse poisoned-unparseable (Pitfall 5; REDIS-LOCK-07)
  let val;
  try {
    val = JSON.parse(raw);
  } catch (_e) {
    try { await c.del(key); } catch (_d) { /* tolerate del failure */ }
    _emitProjectionLog({
      command: 'revalidateAndMaybeDelete',
      status: 'rejected',
      reason: 'poisoned_unparseable',
      key: key,
    });
    return { valid: false, reason: 'poisoned_unparseable', val: null };
  }

  // Defense 2: schema validation (REDIS-LOCK-01 closed-enum + REDIS-LOCK-07)
  const schemaErr = _validateRedisValueSchema(val);
  if (schemaErr !== null) {
    try { await c.del(key); } catch (_d) { /* tolerate */ }
    _emitProjectionLog({
      command: 'revalidateAndMaybeDelete',
      status: 'rejected',
      reason: schemaErr,
      key: key,
    });
    return { valid: false, reason: schemaErr, val: null };
  }

  // Defense 3: source-hash revalidation (REDIS-LOCK-02 - the core invariant)
  const matches = _sourceHashesStillMatch(val.source_hashes, val.canonical_refs);
  if (!matches) {
    try { await c.del(key); } catch (_d) { /* tolerate */ }
    _emitProjectionLog({
      command: 'revalidateAndMaybeDelete',
      status: 'rejected',
      reason: 'source_hash_drift',
      key: key,
    });
    return { valid: false, reason: 'source_hash_drift', val: null };
  }

  return { valid: true, reason: 'hit', val: val };
}

// ----------------------------------------------------------------------------
// _checkKindGate (REDIS-LOCK-01 + REDIS-LOCK-07 binding; T2 write-side gate)
//
// Lightweight precheck for put-side poison defense. Runs BEFORE _getClient()
// so a forbidden/unknown kind is rejected mechanically even when Redis is
// degraded - the write side cannot be a poisoning vector. T3 layers the
// full envelope-build validation (10 mandatory fields) on top; T2 ships
// the closed-enum gate.
//
// Returns null on accept (kind is in ALLOWED_KINDS, not in FORBIDDEN_KINDS).
// Returns 'forbidden_kind' | 'schema_invalid' on reject (string from
// REDIS_REASON_CODES enum).
// ----------------------------------------------------------------------------

function _checkKindGate(metadata) {
  if (!metadata || typeof metadata !== 'object') return 'schema_invalid';
  const kind = metadata.kind;
  if (typeof kind !== 'string' || kind.length === 0) return 'schema_invalid';
  if (FORBIDDEN_KINDS.has(kind)) return 'forbidden_kind';
  if (!ALLOWED_KINDS.has(kind)) return 'schema_invalid';
  return null;
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
  // contract (REDIS-LOCK-06).
  //
  // T1 contract: this function returns null in 100% of cases. We do NOT
  // call _redis.createClient or open any socket; T2 is responsible for
  // the real connection wiring (createClient + reconnectStrategy +
  // socket lifecycle + error handler), and T5 layers the projection-log
  // emission on top. Avoiding createClient here removes the zombie
  // client object that the prior body allocated and immediately
  // discarded on every call.
  //
  // The two module-level flags (_client, _clientConnectAttempted) and
  // the REDIS_CONNECT_TIMEOUT_MS / REDIS_COMMAND_TIMEOUT_MS constants
  // remain in place so T2 can wire them without touching this surface.
  if (_disabledReason()) return null;
  if (_client) return _client;
  // T2 will set _clientConnectAttempted + call _redis.createClient
  // here. T1 stays a pure null-returner so selfTest A4 does not need a
  // live Redis on the build agent and no connection is ever leaked.
  return null;
}

// ----------------------------------------------------------------------------
// PUBLIC API SURFACE (8 + selfTest)
// Every export below is Lock-13 wrapped: try/catch around the entire body,
// catch returns a documented degraded sentinel, NEVER throws.
// ----------------------------------------------------------------------------

// 1. isAvailable(opts) -> { ok, degraded_reason, source, metadata }
//
// `source` field harmonizes the return shape with the other 7 public
// APIs (which all carry source: 'redis'|'sqlite'|'local'|'degraded').
// Mapping:
//   - ok:true  -> source:'redis'    (live Redis path is functioning)
//   - ok:false -> source:'degraded' (any disabled / connect-fail / internal-error path)
// Downstream cockpit panels and F17 expected_reason_codes can then
// branch on `source` uniformly across all 8 APIs.
async function isAvailable(_opts) {
  try {
    const reason = _disabledReason();
    if (reason) {
      return {
        ok: false,
        degraded_reason: reason,
        source: 'degraded',
        metadata: { schema_version: SCHEMA_VERSION },
      };
    }
    // T1: do not open a real connection here; return ok:false until T2
    // wires the connect path. The shape is the contract.
    const client = await _getClient();
    if (!client) {
      return {
        ok: false,
        degraded_reason: 'redis_connect_failed',
        source: 'degraded',
        metadata: { schema_version: SCHEMA_VERSION },
      };
    }
    return {
      ok: true,
      degraded_reason: null,
      source: 'redis',
      metadata: { schema_version: SCHEMA_VERSION },
    };
  } catch (_e) {
    return {
      ok: false,
      degraded_reason: 'internal_error',
      source: 'degraded',
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
//
// REDIS-LOCK-07 hardening (T2): kind allowlist+denylist precheck runs BEFORE
// _getClient() so a forbidden/unknown kind is mechanically rejected even
// when Redis is degraded (write-side poison defense). T3 fills the full
// SET EX + envelope-build path; T2 ships the gate.
async function putHotPacket(_key, _packet, metadata) {
  try {
    const kindGate = _checkKindGate(metadata);
    if (kindGate !== null) {
      _emitProjectionLog({
        command: 'putHotPacket',
        status: 'rejected',
        reason: kindGate,
      });
      return { ok: false, key: null, ttl_seconds: 0, reason: kindGate, source: 'degraded' };
    }
    const client = await _getClient();
    if (!client) {
      return { ok: false, key: null, ttl_seconds: 0, reason: _disabledReason() || 'redis_connect_failed', source: 'degraded' };
    }
    // T3 fills the SET EX + schema-validate body. T2 returns degraded.
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
//
// REDIS-LOCK-07 write-side gate (T2). Mirrors putHotPacket: closed-enum
// kind check before _getClient(). T3 will additionally enforce
// metadata.kind === 'semantic_cache' specifically; T2 just rejects
// FORBIDDEN/unknown kinds.
async function putSemanticCache(_query, _value, metadata) {
  try {
    const kindGate = _checkKindGate(metadata);
    if (kindGate !== null) {
      _emitProjectionLog({
        command: 'putSemanticCache',
        status: 'rejected',
        reason: kindGate,
      });
      return { ok: false, key: null, ttl_seconds: 0, reason: kindGate, source: 'degraded' };
    }
    const client = await _getClient();
    if (!client) {
      return { ok: false, key: null, ttl_seconds: 0, reason: _disabledReason() || 'redis_connect_failed', source: 'degraded' };
    }
    // T3 fills the body. T2 returns degraded.
    return { ok: false, key: null, ttl_seconds: 0, reason: 'redis_connect_failed', source: 'redis' };
  } catch (_e) {
    return { ok: false, key: null, ttl_seconds: 0, reason: 'internal_error', source: 'degraded' };
  }
}

// 6. publishEvent(event) -> { ok, stream_id, reason }
//
// REDIS-LOCK-07 write-side gate (T2). publishEvent receives `event` whose
// `kind` field must be 'agent_event_stream' (closed-enum). _checkKindGate
// rejects FORBIDDEN/unknown kinds before any client call. T4 fills the
// XADD + MAXLEN ~ trim body; T2 ships the gate so a poisoned put-side
// kind cannot land even when client is null.
async function publishEvent(event) {
  try {
    const kindGate = _checkKindGate(event);
    if (kindGate !== null) {
      _emitProjectionLog({
        command: 'publishEvent',
        status: 'rejected',
        reason: kindGate,
      });
      return { ok: false, stream_id: null, reason: kindGate, source: 'degraded' };
    }
    const client = await _getClient();
    if (!client) {
      return { ok: false, stream_id: null, reason: _disabledReason() || 'redis_connect_failed', source: 'degraded' };
    }
    // T4 fills XADD + MAXLEN ~ trim. T2 returns degraded.
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

// 8. invalidateBySourceHash(source_hash) -> { ok, count, deleted_count, source, reason }
//
// REDIS-LOCK-02 binding (T2). Uses scanIterator (NOT KEYS - O(n) blocking
// per RESEARCH "State of the Art" deprecation) with MATCH 'sgsd:v19:*'
// (cross-tenant pollution guard; ASVS V4). For each key: get + parse +
// check Array.isArray(val.source_hashes) && includes(old_hash); on match
// c.del + emit projection log row {status:'invalidated',
// reason:'source_hash_drift'}. Poisoned/unparseable entries are skipped
// silently (they expire by TTL; the read-path _revalidateAndMaybeDelete
// handles them).
//
// Lock 13: full try/catch wrap. When _getClient() returns null (T1+T2
// always; T5 wires the real connect path) returns the degraded sentinel
// with deleted_count:0 and reason='redis_unavailable' / disabled-cause.
// The SCAN body becomes live the moment a client is non-null (T5+).
//
// Input shape:
//   sourceHashArg can be either a raw string (legacy) or { old_hash:string }
//   per the user's prompt API. Both shapes accepted; old_hash extracted.
async function invalidateBySourceHash(sourceHashArg) {
  try {
    // Normalize input: accept both string and { old_hash } object forms.
    let oldHash = null;
    if (typeof sourceHashArg === 'string') {
      oldHash = sourceHashArg;
    } else if (sourceHashArg && typeof sourceHashArg === 'object' && typeof sourceHashArg.old_hash === 'string') {
      oldHash = sourceHashArg.old_hash;
    }
    if (typeof oldHash !== 'string' || oldHash.length === 0) {
      return {
        ok: false,
        count: 0,
        deleted_count: 0,
        source: 'degraded',
        reason: 'schema_invalid',
      };
    }

    const client = await _getClient();
    if (!client) {
      // REDIS-LOCK-06: redis absent / disabled / connect-fail -> graceful no-op.
      return {
        ok: true,
        count: 0,
        deleted_count: 0,
        source: 'degraded',
        reason: _disabledReason() || 'redis_unavailable',
      };
    }

    // Live SCAN path (executes only when T5 wires _getClient to return
    // a real client; pre-T5 this branch is dead).
    let deleted = 0;
    if (typeof client.scanIterator !== 'function') {
      // Defensive: client surface mismatch -> degraded.
      return {
        ok: false,
        count: 0,
        deleted_count: 0,
        source: 'degraded',
        reason: 'internal_error',
      };
    }
    const iter = client.scanIterator({ MATCH: NS_PREFIX + '*', COUNT: 200 });
    for await (const key of iter) {
      let raw;
      try {
        raw = await client.get(key);
      } catch (_e) {
        continue; // skip read failure on this key
      }
      if (typeof raw !== 'string' || raw.length === 0) continue;
      let val;
      try {
        val = JSON.parse(raw);
      } catch (_e) {
        continue; // poisoned entry; TTL handles it
      }
      if (!val || typeof val !== 'object') continue;
      if (!Array.isArray(val.source_hashes)) continue;
      if (val.source_hashes.indexOf(oldHash) === -1) continue;
      try {
        await client.del(key);
        deleted++;
        _emitProjectionLog({
          command: 'invalidateBySourceHash',
          status: 'invalidated',
          reason: 'source_hash_drift',
          key: key,
          old_hash: oldHash,
        });
      } catch (_e) {
        // tolerate del failure; do not increment count
      }
    }

    return {
      ok: true,
      count: deleted,
      deleted_count: deleted,
      source: 'redis',
      reason: deleted > 0 ? 'source_hash_drift' : 'miss',
    };
  } catch (_e) {
    return {
      ok: false,
      count: 0,
      deleted_count: 0,
      source: 'degraded',
      reason: 'internal_error',
    };
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

  // A2: FORBIDDEN_KINDS frozen + 8 entries + exact membership.
  // Note: `validated_thought` (canonical truth) is forbidden; the
  // distinct kind `validated_thought_projection` (a SUMMARY) lives in
  // ALLOWED_KINDS - the two are not synonyms.
  results.push(_bootstrapAssert('A2_forbidden_kinds', function () {
    if (!Object.isFrozen(FORBIDDEN_KINDS)) {
      throw new Error('FORBIDDEN_KINDS must be Object.freeze');
    }
    if (FORBIDDEN_KINDS.size !== 8) {
      throw new Error('FORBIDDEN_KINDS size must be 8; got ' + FORBIDDEN_KINDS.size);
    }
    const expected = [
      'decision', 'debt', 'evidence', 'phase_capsule',
      'memory_lifecycle', 'benchmark_result', 'route_decision',
      'validated_thought',
    ];
    for (const k of expected) {
      if (!FORBIDDEN_KINDS.has(k)) throw new Error('FORBIDDEN_KINDS missing: ' + k);
    }
    if (!FORBIDDEN_KINDS.has('validated_thought')) {
      throw new Error('FORBIDDEN_KINDS must include validated_thought (canonical truth, projection-only invariant)');
    }
    // Cross-check: validated_thought_projection (the SUMMARY kind) must
    // remain on the ALLOWED side - they are distinct concepts.
    if (FORBIDDEN_KINDS.has('validated_thought_projection')) {
      throw new Error('validated_thought_projection must NOT be forbidden; it is a projection-safe kind');
    }
    return { size: FORBIDDEN_KINDS.size, validated_thought_forbidden: true };
  }));

  // A3: isAvailable() returns ok:false when SGSD_REDIS_DISABLED=1 OR
  //     redis module absent OR SGSD_REDIS_URL missing. Asserts at least
  //     one of those branches fires under the test harness env.
  //     Also asserts the `source` field is present and equals
  //     'degraded' on the disabled branch (shape parity with the other
  //     7 public APIs; see W4 fix).
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
      // Shape parity: every public API must carry `source` per
      // 'redis'|'sqlite'|'local'|'degraded'.
      if (typeof r.source !== 'string' || r.source.length === 0) {
        throw new Error('isAvailable must return source field; got ' + JSON.stringify(r.source));
      }
      const validSources = ['redis', 'sqlite', 'local', 'degraded'];
      if (validSources.indexOf(r.source) === -1) {
        throw new Error('isAvailable.source must be one of redis|sqlite|local|degraded; got ' + r.source);
      }
      if (r.source !== 'degraded') {
        throw new Error('isAvailable.source must be "degraded" when ok:false; got ' + r.source);
      }
      return { degraded_reason: r.degraded_reason, source: r.source };
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

  // --------------------------------------------------------------------
  // T2 GROUP B/C/E - source-hash invalidation + poisoned-key defense
  // (REDIS-LOCK-02 + REDIS-LOCK-07 binding)
  // --------------------------------------------------------------------

  // B1: _validateRedisValueSchema rejects an envelope missing source_hashes
  //     (incomplete envelope -> reason 'schema_invalid').
  results.push(_bootstrapAssert('B1_validate_shape_rejects_missing_field', function () {
    const incomplete = {
      schema_version: 1,
      kind: 'hot_context_packet',
      milestone: 'v1.9',
      phase: '52',
      // source_hashes intentionally missing
      canonical_refs: [],
      created_at: new Date().toISOString(),
      ttl_seconds: 300,
    };
    const reason = _validateRedisValueSchema(incomplete);
    if (reason === null) {
      throw new Error('expected non-null reason for incomplete envelope');
    }
    if (typeof reason !== 'string') {
      throw new Error('reason must be string; got ' + typeof reason);
    }
    if (reason !== 'schema_invalid') {
      throw new Error('expected reason=schema_invalid; got ' + reason);
    }
    if (REDIS_REASON_CODES.indexOf(reason) === -1) {
      throw new Error('reason not in REDIS_REASON_CODES: ' + reason);
    }
    return { reason: reason };
  }));

  // B2: _validateRedisValueSchema rejects a value with FORBIDDEN kind
  //     (e.g. kind='decision' - canonical truth, projection-only invariant).
  //     Defense in depth (REDIS-LOCK-07): denylist wins over allowlist.
  results.push(_bootstrapAssert('B2_validate_shape_rejects_forbidden_kind', function () {
    const forbidden = {
      schema_version: 1,
      kind: 'decision', // FORBIDDEN
      milestone: 'v1.9',
      phase: '52',
      source_hashes: ['sha256:x'],
      canonical_refs: ['.planning/x.md'],
      created_at: new Date().toISOString(),
      ttl_seconds: 300,
    };
    const reason = _validateRedisValueSchema(forbidden);
    if (reason !== 'forbidden_kind') {
      throw new Error('expected reason=forbidden_kind; got ' + reason);
    }
    // Cross-check: the OTHER 7 forbidden kinds also reject
    const otherForbidden = ['debt', 'evidence', 'phase_capsule', 'memory_lifecycle',
      'benchmark_result', 'route_decision', 'validated_thought'];
    for (const k of otherForbidden) {
      const r = _validateRedisValueSchema(Object.assign({}, forbidden, { kind: k }));
      if (r !== 'forbidden_kind') {
        throw new Error('forbidden kind ' + k + ' should reject with forbidden_kind; got ' + r);
      }
    }
    return { reason: reason, cross_checked: otherForbidden.length };
  }));

  // B3: _validateRedisValueSchema accepts a fully-formed value.
  //     Asserts the positive path (returns null) - prevents over-strict
  //     regressions that would reject all writes.
  results.push(_bootstrapAssert('B3_validate_shape_accepts_valid', function () {
    const valid = {
      schema_version: 1,
      kind: 'hot_context_packet',
      milestone: 'v1.9',
      phase: '52',
      source_hashes: ['sha256:abc'],
      canonical_refs: ['.planning/x.md'],
      created_at: new Date().toISOString(),
      ttl_seconds: 300,
    };
    const reason = _validateRedisValueSchema(valid);
    if (reason !== null) {
      throw new Error('expected null (valid); got ' + reason);
    }
    return { accepted: true };
  }));

  // C1: _revalidateAndMaybeDelete with mismatched source_hashes ->
  //     action=delete, reason=source_hash_drift. Mock c with
  //     spy-tracked .del to assert deletion happened. canonical_refs
  //     points at a real file (this very file) but stored hash is bogus
  //     -> hash mismatch -> drift -> delete.
  results.push(await _bootstrapAssertAsync('C1_revalidate_source_hash_drift', async function () {
    let delCalled = false;
    let delKey = null;
    const mockC = {
      del: async function (k) { delCalled = true; delKey = k; return 1; },
    };
    const driftValue = {
      schema_version: 1,
      kind: 'hot_context_packet',
      milestone: 'v1.9',
      phase: '52',
      // bogus source_hashes that cannot match the real file content
      source_hashes: ['sha256:0000000000000000000000000000000000000000000000000000000000000000'],
      canonical_refs: [path.relative(_resolveRepoRoot(), __filename)],
      created_at: new Date().toISOString(),
      ttl_seconds: 300,
    };
    const raw = JSON.stringify(driftValue);
    const r = await _revalidateAndMaybeDelete(mockC, 'sgsd:v19:test:drift', raw);
    if (r.valid !== false) {
      throw new Error('expected valid:false on drift; got ' + r.valid);
    }
    if (r.reason !== 'source_hash_drift') {
      throw new Error('expected reason=source_hash_drift; got ' + r.reason);
    }
    if (!delCalled) {
      throw new Error('mock c.del must be called on drift (REDIS-LOCK-07)');
    }
    if (delKey !== 'sgsd:v19:test:drift') {
      throw new Error('del must be called with the offending key; got ' + delKey);
    }
    return { deleted: true, reason: r.reason };
  }));

  // E1: _revalidateAndMaybeDelete with non-JSON raw -> action=delete,
  //     reason=poisoned_unparseable (Pitfall 5; REDIS-LOCK-07 first defense).
  results.push(await _bootstrapAssertAsync('E1_poisoned_unparseable', async function () {
    let delCalled = false;
    const mockC = {
      del: async function (_k) { delCalled = true; return 1; },
    };
    const r = await _revalidateAndMaybeDelete(mockC, 'sgsd:v19:test:poison', 'not json {{{');
    if (r.valid !== false) {
      throw new Error('expected valid:false on poison; got ' + r.valid);
    }
    if (r.reason !== 'poisoned_unparseable') {
      throw new Error('expected reason=poisoned_unparseable; got ' + r.reason);
    }
    if (!delCalled) {
      throw new Error('mock c.del must be called on poisoned-unparseable');
    }
    if (REDIS_REASON_CODES.indexOf(r.reason) === -1) {
      throw new Error('reason not in REDIS_REASON_CODES: ' + r.reason);
    }
    return { deleted: true, reason: r.reason };
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
    // T2 source-hash invalidation + poisoned-key defense (REDIS-LOCK-02/07)
    _sha256OfFile: _sha256OfFile,
    _revalidateAndMaybeDelete: _revalidateAndMaybeDelete,
    _checkKindGate: _checkKindGate,
  },

  // T2 also exports _validateRedisValueSchema directly on the public
  // surface as the verification_cmd at PLAN line 265 calls it via
  // `a._validateRedisValueSchema({...})` (NOT via _internals).
  _validateRedisValueSchema: _validateRedisValueSchema,
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
    process.stdout.write('redis-adapter.cjs T2 (skeleton + source-hash invalidation + poisoned-key defense). Use --self-test to run bootstrap assertions.\n');
    process.exit(0);
  }
  selfTest().then(function (out) {
    const lines = [];
    lines.push('redis-adapter.cjs --self-test (T2 bootstrap: A0..A4 + B1..B3 + C1 + E1)');
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
