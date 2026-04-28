---
schema_version: 2
phase: 52
plan: 1
type: execute
wave: 1
model: sonnet
expected_ATC_tier: FULL
depends_on: ["46", "50", "51"]
files_modified:
  - super-gsd/tools/context-cache/redis-adapter.cjs
  - super-gsd/tools/context-cache/redis-adapter.test.cjs
  - super-gsd/tools/context-cache/run-redis-self-test.cjs
  - super-gsd/tools/context-cache/docker-compose.redis.yml
  - super-gsd/tools/context-bench/failure-injectors.cjs
  - package.json
  - .planning/metrics/redis-projection-log.jsonl
autonomous: true
requirements:
  - REDIS-01
  - REDIS-02
  - REDIS-03
  - REDIS-04
  - REDIS-05
  - REDIS-06
  - REDIS-07
  - REDIS-08
  - REDIS-09
  - REDIS-10

tags:
  - redis-adapter
  - optional-projection
  - source-hash-invalidation
  - intent-scoped-semantic-cache
  - poisoned-key-defense
  - degraded-fallback
  - f17-cross-binding
  - phase-52
  - v1.9
  - final-phase

prior_errors_lookup: true

skip_gates: []

lessons_path: null

must_haves:
  truths:
    - "Operator runs `node super-gsd/tools/context-cache/run-redis-self-test.cjs` and gets 16/16 PASS (or PASS-with-soft-skip when Redis absent), exit 0, in <5 seconds, with zero canonical-stream drift."
    - "All 8 public APIs (isAvailable, getHotPacket, putHotPacket, getSemanticCache, putSemanticCache, publishEvent, readEvents, invalidateBySourceHash, selfTest) return falsey/degraded sentinels under every error path - NO public API throws upward (Lock 13)."
    - "When SGSD_REDIS_URL is absent OR SGSD_REDIS_DISABLED=1 OR redis npm module is not installed, every public API returns degraded sentinel and the system continues with SQLite/local files (REDIS-LOCK-06; degraded-OK)."
    - "Every Redis value carries schema_version, kind, milestone, phase, source_hashes, canonical_refs, created_at, ttl_seconds; on read, source_hashes are revalidated against canonical state and stale hits are deleted + logged (REDIS-LOCK-02)."
    - "Semantic cache key composition is byte-equality on intent_id_normalized + role + phase + milestone + context_policy + sorted source_hashes - NO embedding/cosine/similarity; two different roles for the same intent_id yield two different keys (REDIS-LOCK-03 + Lock 11)."
    - "Forbidden key kinds (decision, debt, evidence, phase_capsule, memory_lifecycle, benchmark_result, route_decision) are rejected on every put with reason 'forbidden_kind'; allowlist enforces only the 9 documented kinds (REDIS-LOCK-01)."
    - "FLUSHDB scenario (when live Redis available) shows: post-flush getHotPacket returns miss; canonical .planning/ files byte-untouched; cockpit/cache warms back up from SQLite (REDIS-LOCK-05)."
    - "Poisoned keys (unparseable JSON, schema-invalid, stale source_hashes) are rejected, deleted from Redis, and logged to .planning/metrics/redis-projection-log.jsonl with reason code; never injected into a packet (REDIS-LOCK-07)."
    - "Phase 51 failure-injectors.cjs F17 stub at lines 271-279 + 891-900 is rewritten in place to a real injector; F1..F16 (lines 81-263) are byte-untouched and the INJECTION_FIXTURES Object.freeze remains 16-entry; FIXTURE_FACTORIES.F17 still maps to _F17 (Lock 4 + Phase 51 fixture freeze)."
    - "After F17 activation, Phase 51 `node super-gsd/tools/context-bench/run-self-test.cjs` exits 0; F17 reports injected status when adapter is present, soft-skips with reason 'phase_52_redis_adapter_not_shipped' when SGSD_REDIS_DISABLED=1."
    - "Phase 41-50 tool trees are byte-untouched: `git diff --quiet -- super-gsd/tools/{token-attribution,token-waste,phase-capsule,context-registry,context-packet,sqlite-context-index,dispatch-router,vtp-bridge,memory-governance,context-cache/rebuild.cjs,context-cache/query.cjs,context-cache/schema.sql,context-cache/manifest.schema.json,context-cache/build.test.cjs} super-gsd/scripts/lib/sgsd-cockpit-shell.cjs` exits 0."
    - "redis-projection-log.jsonl envelope-v1 row exists with at least 1 entry from self-test; no row contains the `:password@` URL credential pattern (ASVS V2/V7 + self-test G2)."
    - "package.json has `optionalDependencies: { redis: \"^5.12.1\" }`; `npm install --no-optional` does NOT break adapter loading (top-level try/require returns null + degraded path activates)."

  artifacts:
    - path: "super-gsd/tools/context-cache/redis-adapter.cjs"
      provides: "Single-file Redis adapter exposing 8 Lock-13-wrapped public APIs over an optional redis@5.12.1 client; read-side revalidation by source_hashes; allowlist/denylist on key kinds; namespace prefix sgsd:v19:; SCAN-based invalidation; XADD with TRIM for streams; 50ms command timeout race; credential-redacted projection log emission."
      exports:
        - "isAvailable(opts) -> { ok, degraded_reason, metadata }"
        - "getHotPacket(key) -> { hit, stale, packet, reason }"
        - "putHotPacket(key, packet, metadata) -> { ok, key, ttl_seconds }"
        - "getSemanticCache(query) -> { hit, stale, value, reason }"
        - "putSemanticCache(query, value, metadata) -> { ok, key, ttl_seconds }"
        - "publishEvent(event) -> { ok, stream_id, reason }"
        - "readEvents(scope) -> { ok, events, reason }"
        - "invalidateBySourceHash(source_hash) -> { ok, count }"
        - "selfTest() -> { pass, fail, total, results }"
        - "ALLOWED_KINDS (Object.freeze, 9-entry Set)"
        - "FORBIDDEN_KINDS (Object.freeze, 7-entry Set)"
        - "TTL_BY_KIND (Object.freeze, 9-key map)"
        - "REDIS_REASON_CODES (Object.freeze, >=12 entries)"
        - "_testHook_simulateFlushAndPoison(opts) -> { ok, steps[] } (NEW; F17 cross-binding only)"
      contains: "Lock 13 try/catch on every public API; lazy `try { require('redis') } catch { _redis = null }` at top; namespace prefix `sgsd:v19:` on every key; sha256 source-hash revalidation helper; _redactRedisUrl regex `/:[^@:/]*@/` -> `:***@`; XADD with TRIM strategy=MAXLEN ~ threshold=1000 for streams; SCAN with MATCH `sgsd:v19:*` for invalidateBySourceHash; ASCII-only literals; envelope-v1 projection log emitter mirroring Phase 41 schema."

    - path: "super-gsd/tools/context-cache/redis-adapter.test.cjs"
      provides: "Inline self-test module exporting selfTest()/runAll(); 16 assertions across 8 groups (A connection guard, B key policy, C source-hash invalidation, D semantic cache key composition, E poisoned-key defense, F FLUSHDB safety, G Lock 13 + redaction, H F17 cross-binding hook); soft-skip group F when SGSD_REDIS_URL absent."
      exports:
        - "runAll() -> { pass, fail, total, results }"
        - "formatSummary(results) -> string"
      contains: "Native Node assert; mirrors Phase 46 build.test.cjs runAll/formatSummary contract; group F (live FLUSHDB) soft-skips when no Redis with reason 'redis_not_available_soft_skip'; G2 asserts no log line matches /:[^@]+@/ pattern."

    - path: "super-gsd/tools/context-cache/run-redis-self-test.cjs"
      provides: "Thin shell entry that invokes redis-adapter selfTest(); exit 0 on green, exit 1 on first fail; mirrors Phase 51 run-self-test.cjs pattern verbatim."
      exports:
        - "main() -> exit 0 on full pass (or pass-with-soft-skip when Redis absent)"
      contains: "~50 lines; reads redis-adapter.cjs selfTest(); prints group results; exit code propagates; ASCII-only."

    - path: "super-gsd/tools/context-cache/docker-compose.redis.yml"
      provides: "Operator dev-convenience compose snippet for local Redis (Q1 resolved YES); single redis:7-alpine image, port 6379, no volumes, ephemeral by design."
      contains: "version: '3.8'; service `redis` image redis:7-alpine; ports 6379:6379; 10 lines total; ASCII-only."

    - path: "super-gsd/tools/context-bench/failure-injectors.cjs"
      provides: "Phase 51 file - F17 byte range surgically rewritten ONLY at lines 271-279 (F17_STUB descriptor) and 891-900 (_F17 factory body). All other bytes (lines 1-263, 280-890, 901-end) are byte-identical to pre-edit state."
      contains: "Updated F17_STUB: label='phase 52 redis flush + poisoned key (live)', expected_reason_codes=['source_hash_drift','poisoned_unparseable','redis_flushdb_recovered_via_sqlite'] (Q3 resolved 3 codes), evidence_path='.planning/metrics/redis-projection-log.jsonl', applies_to_scenarios=['S1-v17-P32','S2-v18-P36'], soft_skip_when=null. Updated _F17 factory: lazy-requires redis-adapter; snapshot() captures pre-state file lengths; inject() calls _testHook_simulateFlushAndPoison (Q4 resolved BOTH flush + poison sequentially); observe() reads projection-log tail; restore() truncates log + deletes test keys. F1..F16 contract preserved."

    - path: "package.json"
      provides: "Adds `optionalDependencies: { \"redis\": \"^5.12.1\" }`; preserves existing `dependencies: { \"better-sqlite3\": \"^12.9.0\" }` and engines.node>=22 byte-untouched."
      contains: "Single new top-level key `optionalDependencies`; key insertion only; no other field modified; `npm install --no-optional` flag must still produce a working install (validated by self-test A1)."

    - path: ".planning/metrics/redis-projection-log.jsonl"
      provides: "Append-only observability stream (envelope-v1 schema); one row per degraded event, rejection, invalidation, or self-test execution; mirrors Phase 41 envelope-v1 + ext fields. Q5 resolved git-TRACK (mirrors token-attribution/route-decisions discipline)."
      contains: "envelope_version:1, command:emitProjectionLog, ts (ISO-8601), status in {degraded,rejected,invalidated,self_test}, reason (REDIS_REASON_CODES enum), key (optional), kind (optional), detail (optional, redacted); additionalProperties:true so future ext fields require no schema bump."

  key_links:
    - from: "super-gsd/tools/context-cache/redis-adapter.cjs"
      to: "super-gsd/tools/context-cache/rebuild.cjs"
      via: "Pattern reuse only (no require) - mirrors Lock 13 try/require pattern from rebuild.cjs lines 60-64; mirrors _emitContextIndexComplaint envelope from rebuild.cjs lines 222-234; mirrors KIND_VOCAB closed-enum discipline from rebuild.cjs lines 97-103"
      pattern: "// Source: Phase 46 rebuild\\.cjs"

    - from: "super-gsd/tools/context-cache/redis-adapter.cjs"
      to: "super-gsd/tools/context-cache/query.cjs"
      via: "Documentation reference only; no require. The adapter's degraded fallback path documents that callers degrade to query.cjs (Phase 46 SQLite read-side); no code coupling."
      pattern: "// Phase 46 SQLite fallback contract"

    - from: "super-gsd/tools/context-cache/redis-adapter.cjs"
      to: ".planning/metrics/redis-projection-log.jsonl"
      via: "fs.appendFileSync inside _emitProjectionLog; envelope-v1 row per degraded/rejected/invalidated event"
      pattern: "redis-projection-log\\.jsonl"

    - from: "super-gsd/tools/context-bench/failure-injectors.cjs"
      to: "super-gsd/tools/context-cache/redis-adapter.cjs"
      via: "Lazy require() inside _F17 inject() body (NOT at file top - Pitfall 6 binding); calls _testHook_simulateFlushAndPoison(opts)"
      pattern: "require\\(.*redis-adapter"

    - from: "super-gsd/tools/context-cache/redis-adapter.cjs"
      to: "redis (npm)"
      via: "Top-level `try { _redis = require('redis') } catch { _redis = null }`; lazy connection via createClient with socket.connectTimeout=5000 + reconnectStrategy + commandOptions.timeout=50"
      pattern: "require\\('redis'\\)"

    - from: "super-gsd/tools/context-cache/run-redis-self-test.cjs"
      to: "super-gsd/tools/context-cache/redis-adapter.test.cjs"
      via: "require() by relative path; calls runAll(); exit code propagates; mirrors Phase 51 run-self-test.cjs:1-52 pattern"
      pattern: "require\\(.*redis-adapter\\.test"

    - from: "package.json"
      to: "redis (npm registry)"
      via: "optionalDependencies entry `\"redis\": \"^5.12.1\"`; --save-optional flag; install-time fallback when --no-optional flag passed"
      pattern: "optionalDependencies"

tasks:
  - id: "52-01-T1"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/context-cache/redis-adapter.cjs
      - package.json
    input_contract: |
      Reads:
        - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-CONTEXT.md (locked goal + 4 hot-state classes + key policy + failure contract)
        - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-REDIS-GUIDE-DELTA.md (REDIS-LOCK-01..07 + 9 allowed kinds + 7 forbidden kinds)
        - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-RESEARCH.md sections "Pattern 1 Lock-13 Wrapped Adapter API" + "Standard Stack" + "Architecture Patterns" + "Common Pitfalls"
        - super-gsd/tools/context-cache/rebuild.cjs (Phase 46) lines 60-64 (try/require optional dep pattern), 97-103 (KIND_VOCAB closed-enum), 222-234 (_emitContextIndexComplaint envelope-v1 pattern), 658-806 (Lock 13 wrapped public API surface)
        - package.json (existing dependencies block preserved byte-untouched)
        - https://www.npmjs.com/package/redis (5.12.1 published 2026-04-14; verified by `npm view redis version`)
      Inputs from prior tasks: none (this is the foundation task; T1 must run first).
    output_contract: |
      Writes:
        - super-gsd/tools/context-cache/redis-adapter.cjs (skeleton ~250-350 lines):
          * File header banner: ASCII-only, references CONTEXT.md + REDIS-GUIDE-DELTA.md + Lock 4/11/13 invariants at file top.
          * `let _redis = null; try { _redis = require('redis') } catch (_e) { _redis = null }` at top-level (mirrors rebuild.cjs:60-64).
          * `const ALLOWED_KINDS = Object.freeze(new Set([9 entries]))` per REDIS-GUIDE-DELTA.md "Redis Key Kinds" allowed list.
          * `const FORBIDDEN_KINDS = Object.freeze(new Set([7 entries]))` per REDIS-GUIDE-DELTA.md "Redis Key Kinds" forbidden list.
          * `const TTL_BY_KIND = Object.freeze({...})` 9-key map per RESEARCH §"Pitfall 3" recommended TTLs (cockpit_snapshot:60, active_agent_marker:90, session_checkpoint_marker:600, provider_health_cache:120, hot_context_packet:300, semantic_cache:3600, validated_thought_projection:1800, agent_event_stream:0, short_lived_counter:30).
          * `const REDIS_REASON_CODES = Object.freeze([...])` >=12 entries: redis_module_missing, redis_disabled_no_url, redis_disabled_by_env, redis_connect_failed, redis_op_timeout, miss, hit, source_hash_drift, poisoned_unparseable, schema_invalid, forbidden_kind, unknown_kind, redis_flushdb_recovered_via_sqlite, internal_error.
          * 8 public API stubs (isAvailable, getHotPacket, putHotPacket, getSemanticCache, putSemanticCache, publishEvent, readEvents, invalidateBySourceHash) - each Lock 13 try/catch wrapped, returning the documented sentinel shape; bodies are minimal stubs delegating to lazy `_getClient()` + early-return on null client.
          * `selfTest()` placeholder returning `{ pass: 0, fail: 0, total: 0, results: [] }` (T7 wires the assertions via require of redis-adapter.test.cjs).
          * `_getClient()` async helper with createClient({url, socket:{connectTimeout:5000, reconnectStrategy: exp+jitter}, commandOptions:{timeout:50}}) per RESEARCH Pattern 1.
          * `_redactRedisUrl(s)` helper: regex `:[^@:/]*@` -> `:***@` (Pitfall 1 binding).
          * `_emitProjectionLog(row, opts)` helper: appendFileSync to .planning/metrics/redis-projection-log.jsonl with envelope-v1 row.
          * `_validateRedisValueSchema(val)` helper: closed-enum check on val.kind, presence of schema_version + source_hashes + canonical_refs + ttl_seconds.
          * `_sourceHashesStillMatch(sourceHashes, canonicalRefs)` helper: walks canonical_refs, recomputes sha256 per file, compares to source_hashes (sorted byte-equality).
          * `_composeSemanticKey({intent_id, role, phase, milestone, context_policy, source_hashes})` helper per Pitfall 2: `sgsd:v19:semantic:` + sha256(joined components with `:` delimiter; source_hashes.slice().sort().join(','))`.
          * Module exports: all 8 public APIs + ALLOWED_KINDS + FORBIDDEN_KINDS + TTL_BY_KIND + REDIS_REASON_CODES + selfTest. Stubbed `_testHook_simulateFlushAndPoison` exported (T5 fills body).
          * ASCII-only literals (no smart quotes, no emoji per CLAUDE.md). No fs.writeFile to ANY path other than redis-projection-log.jsonl.
        - package.json: ADD top-level key `optionalDependencies: { "redis": "^5.12.1" }`. Preserve existing `dependencies`, `engines`, `name`, `version`, `description`, `private` byte-identical.
      Bootstrap self-test (3-5 assertions, exposed via redis-adapter.test.cjs in T7 but the framing assertions live here):
        - A0: `require('./redis-adapter.cjs')` succeeds even when redis npm module is absent (try/require absorbs).
        - A1: ALLOWED_KINDS Set frozen, contains exactly 9 entries: cockpit_snapshot, active_agent_marker, session_checkpoint_marker, provider_health_cache, hot_context_packet, semantic_cache, validated_thought_projection, agent_event_stream, short_lived_counter.
        - A2: FORBIDDEN_KINDS Set frozen, contains exactly 7 entries: decision, debt, evidence, phase_capsule, memory_lifecycle, benchmark_result, route_decision.
        - A3: 8 public-API exports exist (typeof === 'function'); REDIS_REASON_CODES frozen with >=12 entries; TTL_BY_KIND frozen with 9 entries.
        - A4: _redactRedisUrl('redis://user:secret@host:6379/0') === 'redis://user:***@host:6379/0' (Pitfall 1 binding).
      ASCII-only literals (no smart quotes, no emoji). No edits to any file outside the 2 listed in files_touched. Lock 4 binding: package.json edit is a single-key insertion only - DIFF must show ONLY `optionalDependencies` block added.
    hypothesis: |
      A frozen 8-API public surface + closed-vocab kind allowlist/denylist + TTL_BY_KIND map + REDIS_REASON_CODES enum must land first because every subsequent task (T2 source-hash revalidation, T3 hot/semantic cache, T4 live coordination + event stream, T5 degraded fallback + projection log, T6 F17 activation, T7 self-test entry) depends on this surface being byte-stable. Closed-vocab discipline + Object.freeze on the 4 enums prevents downstream drift; mirrors Phase 41/45/46/49/51 skeleton-first pattern. Try/require for the optional `redis` module at file-top (mirroring rebuild.cjs:60-64) means the adapter loads even when `npm install --no-optional` is used - this is the entire point of optionalDependencies. Lock 11 is documented at file-top so executors of later tasks cannot accidentally introduce embedding/cosine/similarity calls. Lock 13 is documented at file-top so executors cannot accidentally throw upward.
    falsifier: |
      Plan is wrong if any of:
        - `node -e "require('./super-gsd/tools/context-cache/redis-adapter.cjs')"` throws when redis module is absent (Lock 13 + try/require violation at top-level).
        - ALLOWED_KINDS contains any kind NOT in the 9-entry whitelist OR FORBIDDEN_KINDS contains any kind NOT in the 7-entry blacklist (REDIS-LOCK-01 + REDIS-GUIDE-DELTA.md violation).
        - Any of the 8 public APIs is missing OR throws upward when called with bogus inputs (Lock 13 violation).
        - REDIS_REASON_CODES has fewer than 12 entries OR is not Object.frozen (closed-vocab discipline violation).
        - TTL_BY_KIND has any TTL outside the documented Pitfall 3 ranges (cockpit_snapshot=60s, semantic_cache=3600s, etc.) OR is not Object.frozen.
        - _redactRedisUrl fails to redact `:password@` segment (Pitfall 1 violation; would leak credentials in projection log).
        - package.json `dependencies` block is mutated OR any other field changes (only `optionalDependencies` should be added).
        - Any non-ASCII literal lands in redis-adapter.cjs (PS5.1 cross-rendering breaks).
        - File contains `import` statement (must be CJS require only; matches Phase 41-51 discipline).
        - File top imports redis-adapter.test.cjs OR any test file (test require lives only in run-redis-self-test.cjs).
    stop_rule: |
      `node -e "const a = require('./super-gsd/tools/context-cache/redis-adapter.cjs'); console.log(typeof a.isAvailable, a.ALLOWED_KINDS.size, a.FORBIDDEN_KINDS.size, a.REDIS_REASON_CODES.length)"` prints `function 9 7 12` (or higher reason-code count) and exits 0. `npm install --no-optional` followed by `node -e "require('./super-gsd/tools/context-cache/redis-adapter.cjs')"` exits 0 (redis module absence does not break load). package.json `dependencies.better-sqlite3` value unchanged. Atomic commit `feat(52-01): redis-adapter skeleton + 8 public API surface + optionalDependencies (Lock 13 wrapped)`.
    verification_cmd: "node -e \"const a = require('./super-gsd/tools/context-cache/redis-adapter.cjs'); if(typeof a.isAvailable !== 'function') process.exit(1); if(a.ALLOWED_KINDS.size !== 9) process.exit(1); if(a.FORBIDDEN_KINDS.size !== 7) process.exit(1); if(a.REDIS_REASON_CODES.length < 12) process.exit(1); if(!Object.isFrozen(a.ALLOWED_KINDS)) process.exit(1); console.log('T1 surface OK');\""
    expected_ATC_tier: FULL

  - id: "52-01-T2"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/context-cache/redis-adapter.cjs
    depends_on: ["52-01-T1"]
    input_contract: |
      Reads:
        - super-gsd/tools/context-cache/redis-adapter.cjs (T1 skeleton; existing helpers _validateRedisValueSchema + _sourceHashesStillMatch are filled here)
        - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-RESEARCH.md "Pattern 2 Source-Hash Bound Cache Read" + "Pitfall 5 Adapter writes to canonical JSONL streams" + "Don't Hand-Roll" row "Source-hash recompute"
        - super-gsd/tools/context-cache/rebuild.cjs lines 192-199 (_sha256OfFile pure 8-line implementation - replicate locally per Lock 4 "don't fork" guidance, file is trivially mirrored)
        - super-gsd/tools/context-packet/build.cjs lines 223-232 (Phase 45 source_hashes/source_refs validation pattern reference)
      Inputs from T1: 8 public-API stubs, ALLOWED_KINDS, FORBIDDEN_KINDS, TTL_BY_KIND, REDIS_REASON_CODES, _redactRedisUrl, _emitProjectionLog scaffolding.
    output_contract: |
      Extends super-gsd/tools/context-cache/redis-adapter.cjs:
        - `_validateRedisValueSchema(val)` filled body: returns null on valid; returns string reason on invalid. Checks: typeof val === 'object'; val.schema_version === 1; ALLOWED_KINDS.has(val.kind); typeof val.milestone === 'string'; typeof val.phase === 'string'; Array.isArray(val.source_hashes) && val.source_hashes.length >= 1; Array.isArray(val.canonical_refs); typeof val.created_at === 'string'; typeof val.ttl_seconds === 'number' && val.ttl_seconds > 0. Reason codes from REDIS_REASON_CODES enum (schema_invalid).
        - `_sha256OfFile(filePath)` filled body: try { return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex') } catch { return null }. Pure helper; mirrors rebuild.cjs:192-199.
        - `_sourceHashesStillMatch(sourceHashes, canonicalRefs)` filled body: walks canonicalRefs, computes _sha256OfFile per ref, compares element-wise (sorted byte-equality). Returns true iff sourceHashes.slice().sort().join(',') === computed.slice().sort().join(','). Returns false on any read error (treats as drift; conservative).
        - `invalidateBySourceHash(sourceHash)` filled body per RESEARCH "Example 2 Invalidation by source hash":
          * Lock 13 try/catch wrap.
          * `_getClient()`; if null return `{ ok: false, count: 0 }`.
          * Use `c.scanIterator({ MATCH: 'sgsd:v19:*', COUNT: 200 })` (NOT KEYS - O(n) blocking; RESEARCH "State of the Art" deprecation).
          * For each key: get, parse, check `Array.isArray(val.source_hashes) && val.source_hashes.includes(sourceHash)`; if match, c.del(key) + emit projection log row {status:'invalidated', reason:'source_hash_drift', key}.
          * Skip poisoned entries silently (they expire by TTL); count successful deletes.
          * Return `{ ok: true, count }`.
        - Read-path source-hash revalidation hook: helper `_revalidateAndMaybeDelete(c, key, raw)` returning `{ valid, reason, val }`:
          * Try JSON.parse(raw); on parse fail -> c.del(key) + emit `{status:'rejected', reason:'poisoned_unparseable'}` -> return `{ valid:false, reason:'poisoned_unparseable' }`.
          * Run _validateRedisValueSchema; on err -> c.del(key) + emit `{status:'rejected', reason:err}` -> return `{ valid:false, reason:err }`.
          * Run _sourceHashesStillMatch; on drift -> c.del(key) + emit `{status:'rejected', reason:'source_hash_drift'}` -> return `{ valid:false, reason:'source_hash_drift' }`.
          * On all-pass -> return `{ valid:true, reason:'hit', val }`.
        - Self-test assertions added (5 - written into redis-adapter.test.cjs but stubbed-into-existence here):
          * B1: _validateRedisValueSchema rejects {kind:'decision'} with reason 'schema_invalid' (forbidden kind not in ALLOWED_KINDS).
          * B2: _validateRedisValueSchema rejects {kind:'unknown_garbage'} with reason 'schema_invalid'.
          * B3: _validateRedisValueSchema accepts a fully-formed value (all 9 fields present).
          * C1 (mock): given a value with source_hashes=['sha256:abc'] but _sha256OfFile returns 'sha256:def', _sourceHashesStillMatch returns false; revalidation deletes key + emits 'source_hash_drift'.
          * E1: given raw='not json', _revalidateAndMaybeDelete returns valid:false reason:'poisoned_unparseable' AND emits projection-log row with status='rejected' reason='poisoned_unparseable'.
        - All self-test additions soft-skip live Redis; B/E groups use mock `c` (object with del:async-noop, get:async-stub).
        - Lock 4 binding: NO require() of rebuild.cjs (path traversal); _sha256OfFile is replicated locally per RESEARCH "Don't Hand-Roll" guidance "the function is pure and trivially mirrored".
    hypothesis: |
      Source-hash revalidation infrastructure must land in its own task because (a) every subsequent cache read (T3 hot packet, T3 semantic cache, T4 read events, T5 degraded fallback) depends on _revalidateAndMaybeDelete being byte-stable, (b) REDIS-LOCK-02 + REDIS-LOCK-07 are the entire safety mechanism for "Redis is not canonical" - if revalidation is broken, every read is a poisoning vector, (c) splitting revalidation from cache-class implementation keeps each task <=30% context and each falsifier crisp. Mocking `c` for B/E groups (no live Redis) means self-test runs in <2s on dev and CI without external services. _sha256OfFile is replicated locally because Phase 46 rebuild.cjs does not export it (file lookup confirmed; private helper); duplication is correct per Lock 4 "don't fork existing modules" guidance which permits local replication of pure 8-line helpers.
    falsifier: |
      Plan is wrong if any of:
        - _validateRedisValueSchema accepts a value with kind in FORBIDDEN_KINDS (decision/debt/evidence/etc.) - REDIS-LOCK-01 violation.
        - _sourceHashesStillMatch returns true when canonical files have been modified (would serve stale data; REDIS-LOCK-02 violation).
        - _revalidateAndMaybeDelete fails to delete poisoned key (key persists; ongoing poisoning; REDIS-LOCK-07 violation).
        - invalidateBySourceHash uses KEYS instead of SCAN (would block Redis server O(n); RESEARCH "State of the Art" deprecation).
        - invalidateBySourceHash MATCH pattern is anything other than `sgsd:v19:*` (cross-tenant pollution risk; ASVS V4).
        - _sha256OfFile path-traverses outside project dir (security violation).
        - Any helper throws upward instead of returning sentinel (Lock 13 violation).
        - Self-test asserts against live Redis without soft-skip (would hard-fail on dev machines without Redis).
        - Anything in rebuild.cjs is required by relative or absolute path (Lock 4 violation - rebuild.cjs is byte-frozen Phase 46).
    stop_rule: |
      `node -e "const a = require('./super-gsd/tools/context-cache/redis-adapter.cjs'); const r = a._validateRedisValueSchema({kind:'decision'}); if(r === null) process.exit(1); console.log('reject ok:', r);"` prints a non-null reason and exits 0. `node super-gsd/tools/context-cache/run-redis-self-test.cjs --groups=B,E` (when T7 has wired the entry) shows B1+B2+B3+C1+E1 PASS. `git diff --quiet -- super-gsd/tools/context-cache/{rebuild.cjs,query.cjs,schema.sql,manifest.schema.json,build.test.cjs}` exits 0. Atomic commit `feat(52-01): source-hash revalidation + invalidateBySourceHash (REDIS-LOCK-02/07)`.
    verification_cmd: "node -e \"const a = require('./super-gsd/tools/context-cache/redis-adapter.cjs'); const ok = a._validateRedisValueSchema({schema_version:1, kind:'hot_context_packet', milestone:'v1.9', phase:'52', source_hashes:['sha256:x'], canonical_refs:['.planning/x.md'], created_at:new Date().toISOString(), ttl_seconds:300}); const bad = a._validateRedisValueSchema({kind:'decision'}); if(ok !== null) process.exit(1); if(bad === null) process.exit(1); console.log('T2 schema OK');\""
    expected_ATC_tier: FULL

  - id: "52-01-T3"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/context-cache/redis-adapter.cjs
    depends_on: ["52-01-T1", "52-01-T2"]
    input_contract: |
      Reads:
        - super-gsd/tools/context-cache/redis-adapter.cjs (T1 skeleton + T2 revalidation infrastructure)
        - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-RESEARCH.md "Pattern 2 Source-Hash Bound Cache Read" (getHotPacket reference impl) + "Code Examples Example 1 Hot-packet put with full metadata" + "Pitfall 2 Allowing semantic cache hits where one of the 5 key components mismatches"
        - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-CONTEXT.md "Required Key Policy" (10 mandatory metadata fields)
        - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-REDIS-GUIDE-DELTA.md REDIS-LOCK-03 (intent-scoped semantic cache; byte-equality on 5 key components, no semantic similarity)
      Inputs from prior tasks: T1 surface + T2 _revalidateAndMaybeDelete + _composeSemanticKey scaffolding + ALLOWED_KINDS/FORBIDDEN_KINDS/TTL_BY_KIND.
    output_contract: |
      Extends super-gsd/tools/context-cache/redis-adapter.cjs:
        - `getHotPacket(key)` filled body per RESEARCH "Pattern 2":
          * Lock 13 try/catch wrap.
          * `_getClient()`; if null return `{ hit:false, stale:false, packet:null, reason: _clientErr || 'no_client' }`.
          * `Promise.race([c.get(key), setTimeout(50ms reject 'op_timeout')])` per RESEARCH §"Pitfall 4" + Pattern 1 (50ms command-timeout race).
          * Empty raw -> `{ hit:false, stale:false, packet:null, reason:'miss' }`.
          * Run _revalidateAndMaybeDelete; on invalid -> `{ hit:false, stale:true, packet:null, reason }`.
          * On valid -> `{ hit:true, stale:false, packet: val.packet, reason:'hit' }`.
        - `putHotPacket(key, packet, metadata)` filled body per RESEARCH "Code Examples Example 1":
          * Lock 13 try/catch wrap.
          * `_getClient()`; if null return `{ ok:false, key:null, ttl_seconds:0 }`.
          * Reject FORBIDDEN_KINDS.has(metadata.kind) with emit log + return.
          * Reject !ALLOWED_KINDS.has(metadata.kind) with emit log + return.
          * Compute ttl = TTL_BY_KIND[metadata.kind] || 300.
          * Build value object with all 10 mandatory fields per CONTEXT "Required Key Policy" (schema_version, kind, milestone, phase, role, intent_id, source_hashes sorted, registry_hash, canonical_refs, created_at, ttl_seconds, content_hash:_sha256OfString, packet).
          * `await c.set(key, JSON.stringify(value), { EX: ttl })`.
          * Return `{ ok:true, key, ttl_seconds }`.
        - `getSemanticCache(query)` filled body:
          * Lock 13 try/catch wrap.
          * Validate query has all 5 components: query.intent_id, query.role, query.phase, query.milestone, query.context_policy, query.source_hashes (Array). Reject malformed with `{ hit:false, stale:false, value:null, reason:'malformed_query' }`.
          * Compose key via `_composeSemanticKey({intent_id_normalized: String(query.intent_id).trim(), role, phase, milestone, context_policy, source_hashes})` per Pitfall 2 (sha256 over `:`-joined sorted components).
          * Delegate to same read+revalidate path as getHotPacket (DRY).
          * Return `{ hit:true|false, stale:bool, value, reason }`.
        - `putSemanticCache(query, value, metadata)` filled body:
          * Validate metadata.kind === 'semantic_cache' (closed-enum binding).
          * Validate query has all 5 components.
          * Compose key (same as getSemanticCache).
          * Delegate to same write path as putHotPacket with metadata.kind='semantic_cache' and TTL_BY_KIND.semantic_cache=3600s.
          * Return `{ ok, key, ttl_seconds:3600 }`.
        - `_composeSemanticKey({intent_id_normalized, role, phase, milestone, context_policy, source_hashes})` body filled per Pitfall 2:
          * Compose pre-image string: `intent_id_normalized + ':' + role + ':' + phase + ':' + milestone + ':' + JSON.stringify(context_policy) + ':' + source_hashes.slice().sort().join(',')`.
          * Return `'sgsd:v19:semantic:' + crypto.createHash('sha256').update(preImage).digest('hex')`.
        - Self-test assertions added (4 assertions, written via redis-adapter.test.cjs):
          * B4: putHotPacket rejects metadata.kind='decision' with `{ ok:false, key:null, ttl_seconds:0 }` AND emits projection log row reason='forbidden_kind'.
          * B5: putHotPacket rejects metadata.kind='unknown_garbage' AND emits reason='unknown_kind'.
          * D1: _composeSemanticKey({intent_id:'X', role:'researcher', ...}) !== _composeSemanticKey({intent_id:'X', role:'executor', ...}) - two different roles -> two different keys (Pitfall 2 binding).
          * D2: _composeSemanticKey with source_hashes=['a','b'] === _composeSemanticKey with source_hashes=['b','a'] - sort invariance proves order-independence (Pitfall 2 sort discipline).
        - Lock 11 binding: NO embedding/cosine/levenshtein/similarity_score function calls anywhere; cache hit decision is byte-equality on the composite hash output ONLY.
        - All puts go through TTL discipline (TTL_BY_KIND map); NO put without EX flag.
    hypothesis: |
      Hot packet cache (Class 2) and semantic cache (Class 3) ship together because they share read+write+revalidate plumbing; splitting them across tasks would duplicate the read path. Pitfall 2 binding (5-component byte-equality key) is the entire integrity contract for REDIS-LOCK-03 - composing the key from sha256 of `:`-joined sorted components proves that ANY change to ANY component (intent_id, role, phase, milestone, policy, OR source_hashes) yields a different key, hence a miss. No partial-match path exists by construction. TTL_BY_KIND defaults from RESEARCH Pitfall 3 give cockpit_snapshot=60s (cache-thrash safe), semantic_cache=3600s (long-lived because source_hash revalidation on EVERY read is the primary safety, TTL is backstop). Lock 11 holds because cache hit decision is a pure sha256 byte-equality - no learned similarity, no embedding, no cosine. The 4 new assertions (B4, B5, D1, D2) are the minimum to prove key composition correctness; Pitfall 2 explicitly calls out D1 (different roles -> different keys) as the critical break case.
    falsifier: |
      Plan is wrong if any of:
        - putHotPacket succeeds when metadata.kind='decision' (FORBIDDEN_KINDS bypass; REDIS-LOCK-01 violation).
        - putHotPacket writes WITHOUT EX flag (TTL discipline violation; REDIS-LOCK-04).
        - getSemanticCache hits when intent_id matches but role/phase/policy differs (Pitfall 2; REDIS-LOCK-03 violation; possible privacy leak).
        - _composeSemanticKey omits any of the 5 required components from the pre-image (composite key incomplete).
        - source_hashes are not sorted before joining (key non-deterministic across input order; D2 fails).
        - Any code path uses regex-fuzzy or Levenshtein or embedding/cosine for hit decision (Lock 11 violation; grep fails the audit).
        - getHotPacket returns hit:true with stale:true (impossible state per documented sentinel shape).
        - getSemanticCache fails to call _revalidateAndMaybeDelete on raw read (would inject stale value).
    stop_rule: |
      `node super-gsd/tools/context-cache/run-redis-self-test.cjs --groups=B,D` exits 0 with B4+B5+D1+D2 PASS. `grep -niE "embedding|cosine|levenshtein|similarity_score|fuzzy" super-gsd/tools/context-cache/redis-adapter.cjs` returns 0 matches outside RESEARCH-quoted comment lines. Atomic commit `feat(52-01): hot packet + semantic cache (REDIS-LOCK-03; Lock 11 byte-equality)`.
    verification_cmd: "node -e \"const a = require('./super-gsd/tools/context-cache/redis-adapter.cjs'); const k1 = a._composeSemanticKey({intent_id_normalized:'X', role:'researcher', phase:'52', milestone:'v1.9', context_policy:{}, source_hashes:['a','b']}); const k2 = a._composeSemanticKey({intent_id_normalized:'X', role:'executor', phase:'52', milestone:'v1.9', context_policy:{}, source_hashes:['a','b']}); const k3 = a._composeSemanticKey({intent_id_normalized:'X', role:'researcher', phase:'52', milestone:'v1.9', context_policy:{}, source_hashes:['b','a']}); if(k1 === k2) process.exit(1); if(k1 !== k3) process.exit(1); console.log('T3 keys OK');\""
    expected_ATC_tier: FULL

  - id: "52-01-T4"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/context-cache/redis-adapter.cjs
    depends_on: ["52-01-T1", "52-01-T2"]
    input_contract: |
      Reads:
        - super-gsd/tools/context-cache/redis-adapter.cjs (T1 skeleton + T2 revalidation; T3 may have landed but is not required for T4 surface)
        - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-RESEARCH.md "Pattern 3 Stream Append with Trim" + "Pitfall 4 Connection pool exhaustion blocks the event loop"
        - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-CONTEXT.md Class 1 (Live coordination - cockpit snapshots, active phase/agent markers, heartbeat hints) + Class 4 (Event stream - append-style live events)
        - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-REDIS-GUIDE-DELTA.md REDIS-LOCK-04 (TTL on every key OR stream retention; dedup by content_hash)
        - https://redis.io/docs/data-types/streams (XADD with MAXLEN ~ N retention)
        - Context7 /redis/node-redis section "Manage Redis Streams" (xAdd/xRange/xLen)
      Inputs from prior tasks: T1 surface + T2 _validateRedisValueSchema + ALLOWED_KINDS + TTL_BY_KIND.
    output_contract: |
      Extends super-gsd/tools/context-cache/redis-adapter.cjs:
        - Live coordination helpers (Class 1) - putHotPacket already covers cockpit_snapshot, active_agent_marker, session_checkpoint_marker, provider_health_cache, short_lived_counter via the kind switch; T4 adds:
          * NO new public APIs for Class 1 (existing put/getHotPacket suffices when metadata.kind is in {cockpit_snapshot, active_agent_marker, session_checkpoint_marker, provider_health_cache, short_lived_counter}).
          * Confirm TTL_BY_KIND for these 5 kinds is honored on put (60s/90s/600s/120s/30s respectively per RESEARCH Pitfall 3; T1 set these defaults).
          * Add helper `_validateMarkerMetadata(metadata)` enforcing role|null + intent_id|null nullability per CONTEXT "Required Key Policy" (role when role-scoped; intent_id when intent-scoped).
        - Event stream (Class 4) - 2 new public APIs:
          * `publishEvent(event)` body per RESEARCH "Pattern 3":
            - Lock 13 try/catch wrap.
            - `_getClient()`; if null return `{ ok:false, stream_id:null, reason: _clientErr || 'no_client' }`.
            - Validate event metadata via new `_validateEventMetadata(event)` helper:
              * event.kind === 'agent_event_stream' (closed-enum binding).
              * event.payload is object/string (serializable).
              * event.scope is non-empty string (e.g. 'cockpit', 'agent_progress').
              * Compute content_hash = _sha256OfString(JSON.stringify(event.payload)) for dedup discipline.
              * stream_name = `sgsd:v19:stream:${event.scope}` (namespaced).
            - Compose fields: schema_version:'1', kind:event.kind, content_hash, payload:JSON.stringify(event.payload), created_at:new Date().toISOString().
            - `await c.xAdd(stream_name, '*', fields, { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 } })`.
            - Return `{ ok:true, stream_id:id, reason:null }`.
          * `readEvents(scope)` body:
            - Lock 13 try/catch wrap.
            - `_getClient()`; if null return `{ ok:false, events:[], reason: _clientErr || 'no_client' }`.
            - Validate scope is non-empty string.
            - stream_name = `sgsd:v19:stream:${scope}`.
            - `await c.xRange(stream_name, '-', '+', { COUNT: 100 })` (most recent 100 events).
            - For each entry: parse fields.payload (JSON), drop entries that fail parse (poisoned defense; emit log row).
            - Return `{ ok:true, events:[{id, kind, content_hash, payload, created_at}], reason:null }`.
        - Self-test assertions added (3 assertions):
          * F2: TTL applied on every put - call putHotPacket with metadata.kind='cockpit_snapshot' (mock c with .set spy); assert spy received `{ EX: 60 }` option (60s default per Pitfall 3).
          * F3: publishEvent with valid event returns ok:true and a stream_id; mock c.xAdd returns '1234567-0' and assert call args include TRIM.strategy='MAXLEN' + strategyModifier='~' + threshold=1000.
          * F4: publishEvent with `_getClient()` returning null returns `{ ok:false, stream_id:null, reason }` (Lock 13 graceful degrade).
        - Lock 13 binding: every API has try/catch top-level; degraded sentinel on _getClient null; degraded sentinel on internal errors.
    hypothesis: |
      Live coordination (Class 1) and event stream (Class 4) ship together because (a) both use `c.xAdd` or `c.set` with TTL/retention; (b) both share the kind allowlist + projection log emitter; (c) splitting them adds task-orchestration tax for ~50 lines of stream code. Class 1 needs NO new public API because putHotPacket already covers all 5 marker kinds (cockpit_snapshot/active_agent_marker/session_checkpoint_marker/provider_health_cache/short_lived_counter) - the TTL_BY_KIND map fixed in T1 + ALLOWED_KINDS check covers the contract. Stream namespacing via `sgsd:v19:stream:${scope}` matches the prefix discipline from T2 invalidateBySourceHash. XADD with MAXLEN ~ 1000 uses approximate-trim per RESEARCH "Pattern 3" (O(1) amortized) instead of manual XLEN+XDEL (O(n)).
    falsifier: |
      Plan is wrong if any of:
        - putHotPacket for kind=cockpit_snapshot writes WITHOUT EX (TTL discipline violation; REDIS-LOCK-04).
        - publishEvent uses XADD without TRIM clause (unbounded stream growth; REDIS-LOCK-04 violation).
        - publishEvent uses MAXLEN without `~` modifier (forces O(n) trim instead of approximate O(1)).
        - publishEvent emits to a stream name without `sgsd:v19:stream:` prefix (cross-tenant pollution; ASVS V4).
        - readEvents uses LRANGE/LPOP instead of xRange (wrong primitive for streams).
        - Any new public API throws upward (Lock 13 violation).
        - Stream entries are written with kind != 'agent_event_stream' (closed-enum violation).
    stop_rule: |
      `node super-gsd/tools/context-cache/run-redis-self-test.cjs --groups=F` exits 0 with F2+F3+F4 PASS (mock-based; live Redis soft-skip OK). Adapter file size <= 750 lines (skeleton + 4 hot APIs + 2 stream APIs target). Atomic commit `feat(52-01): live coordination + event stream (Class 1+4; XADD MAXLEN ~ 1000)`.
    verification_cmd: "node -e \"const a = require('./super-gsd/tools/context-cache/redis-adapter.cjs'); if(typeof a.publishEvent !== 'function') process.exit(1); if(typeof a.readEvents !== 'function') process.exit(1); a.publishEvent({kind:'wrong'}).then(r=>{ if(r.ok) process.exit(1); console.log('T4 stream-API OK'); }).catch(e=>{ process.exit(1); });\""
    expected_ATC_tier: FULL

  - id: "52-01-T5"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/context-cache/redis-adapter.cjs
      - super-gsd/tools/context-cache/docker-compose.redis.yml
      - .planning/metrics/redis-projection-log.jsonl
    depends_on: ["52-01-T1", "52-01-T2", "52-01-T3", "52-01-T4"]
    input_contract: |
      Reads:
        - super-gsd/tools/context-cache/redis-adapter.cjs (T1+T2+T3+T4 cumulative)
        - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-RESEARCH.md "Pattern 1 Lock-13 Wrapped Adapter API" (isAvailable reference impl) + "Pitfall 1 credentials in projection log" + "Pitfall 5 Adapter writes to canonical JSONL streams" + "Recommended Project Structure" (.planning/metrics/redis-projection-log.jsonl envelope-v1)
        - super-gsd/tools/context-cache/rebuild.cjs lines 222-234 (_emitContextIndexComplaint envelope-v1 mirror reference)
        - super-gsd/tools/token-attribution/collect.cjs (envelope-v1 schema reference for ts/event/command shape; pattern only - NO require)
      Inputs from prior tasks: T1 _redactRedisUrl + _emitProjectionLog scaffolding; T2 source-hash revalidation; T3 hot/semantic; T4 stream APIs.
    output_contract: |
      Extends super-gsd/tools/context-cache/redis-adapter.cjs:
        - `isAvailable(opts)` filled body per RESEARCH "Pattern 1":
          * Lock 13 try/catch wrap.
          * `_getClient()`; if null return `{ ok:false, degraded_reason: _clientErr || 'unknown', metadata: { module: !!_redis, url: !!process.env.SGSD_REDIS_URL } }`.
          * `Promise.race([c.ping(), setTimeout(50ms reject 'ping_timeout')])`.
          * Return `{ ok: ping === 'PONG', degraded_reason: ping === 'PONG' ? null : 'ping_unexpected', metadata: { url: process.env.SGSD_REDIS_URL ? '***present***' : null } }`. NEVER include the raw URL (Pitfall 1).
        - `_emitProjectionLog(row, opts)` filled body:
          * envelope-v1 row shape: `{ ts: new Date().toISOString(), event: 'redis_projection', command: row.command || 'emitProjectionLog', schema_version: 1, ...row }` (additionalProperties:true).
          * Apply `_redactRedisUrl()` to row.detail and any string field that may contain a URL (Pitfall 1).
          * Resolve target = (opts && opts.projectDir) ? path.join(opts.projectDir, '.planning/metrics/redis-projection-log.jsonl') : path.join(process.cwd(), '.planning/metrics/redis-projection-log.jsonl').
          * Mkdir -p target dir.
          * fs.appendFileSync(target, JSON.stringify(redactedRow) + '\n', 'utf8').
          * Try/catch internally; never throws upward (Lock 13).
        - `_testHook_simulateFlushAndPoison(opts)` body (NEW export; F17 cross-binding):
          * Lock 13 try/catch wrap; returns `{ ok, steps, reason }`.
          * Step 1 inject poisoned key: `await c.set('sgsd:v19:test:poisoned', 'not json', { EX: 60 })`.
          * Step 2 attempt getHotPacket('sgsd:v19:test:poisoned') -> assert reason === 'poisoned_unparseable'.
          * Step 3 inject FLUSHDB simulation: `await c.flushDb()` (or `await c.sendCommand(['FLUSHDB'])` per node-redis 5.x API).
          * Step 4 assert post-flush getHotPacket returns reason === 'miss' (canonical files untouched).
          * Step 5 emit projection log: `_emitProjectionLog({ command: 'simulateFlushAndPoison', status: 'self_test', reason: 'redis_flushdb_recovered_via_sqlite', steps: [poisoned_key_injected, poisoned_key_rejected, flushdb_executed, post_flush_miss_observed] }, opts)`.
          * Return `{ ok:true, steps:[5 step descriptors], reason: null }`.
          * Soft-skip (return `{ ok:false, reason:'redis_not_available_soft_skip', steps:[] }`) when _getClient returns null.
        - Update every other public API (T3+T4) to invoke `_emitProjectionLog` on degraded/rejected/internal_error paths so observability is uniform.
        - All path resolution uses path.join (NEVER raw string concat) per Windows-bash compat.
        - Self-test assertions added (3 assertions):
          * G1: every public API called with `_getClient()` returning null returns the documented sentinel without throwing - drives all 8 APIs with bogus inputs and `setTimeout(0, () => process.env.SGSD_REDIS_DISABLED='1')` override (catches Lock 13 violation).
          * G2: drive `_emitProjectionLog({ command:'test', status:'degraded', reason:'isAvailable_threw', detail:'connect failed: redis://user:secret@host:6379 timeout'}, {projectDir})`; read tail of redis-projection-log.jsonl; assert no occurrence of `:secret@` AND no match of regex `://[^:]+:[^@]+@`.
          * E2 (extends T2 E1): given a value with valid JSON but kind='garbage' (schema-invalid), getHotPacket returns valid:false reason matches /schema_invalid|kind_unknown/; key is deleted from mock c.
      Writes:
        - super-gsd/tools/context-cache/docker-compose.redis.yml (Q1 resolved YES; ~10 lines):
          * `version: '3.8'`
          * `services: redis: image: redis:7-alpine: ports: ["6379:6379"]: command: redis-server --save "" --appendonly no` (ephemeral, no persistence).
          * Single-line operator entry comment at top: `# Optional dev convenience: docker compose -f super-gsd/tools/context-cache/docker-compose.redis.yml up -d redis`.
          * ASCII-only.
        - .planning/metrics/redis-projection-log.jsonl (CREATE on first self-test run via _emitProjectionLog; envelope-v1; >=1 row by end of T5 self-test). Q5 resolved git-TRACK (mirrors token-attribution discipline).
    hypothesis: |
      Degraded-fallback path + projection log infrastructure must land before T6 (F17 activation) because F17's _testHook_simulateFlushAndPoison + observe() reads redis-projection-log.jsonl tail to verify expected_reason_codes are present. Therefore the log file + emitter must be byte-stable BEFORE F17 wires to it. Pitfall 1 (credential redaction) is enforced at emit-time via _redactRedisUrl on every string field that may contain a URL; G2 self-test asserts the regex `://[^:]+:[^@]+@` returns 0 matches across the log file. Docker compose snippet (Q1 YES) is shipped because the F17 fixture is most useful when operator can run live Redis locally; native install / cloud Redis remain alternatives. _testHook_simulateFlushAndPoison is the public surface F17 reaches into - exporting it as `_testHook_*` (underscore prefix) signals test-only without enforcing visibility (CommonJS lacks visibility modifiers; convention only). Phase 41-50 envelope-v1 schema (token-attribution + context-bench-runs) establishes the ts/event/command/schema_version pattern; redis-projection-log.jsonl mirrors it for dashboard parity (single reader code path).
    falsifier: |
      Plan is wrong if any of:
        - isAvailable returns the raw SGSD_REDIS_URL (with credentials) anywhere in metadata or degraded_reason (Pitfall 1; ASVS V2/V7 violation).
        - _emitProjectionLog throws on disk full / permission denied / dir absent (Lock 13 violation).
        - _emitProjectionLog appends to ANY file other than .planning/metrics/redis-projection-log.jsonl (Pitfall 5; REDIS-LOCK-01 violation by write-amplification).
        - redis-projection-log.jsonl contains any line matching regex `://[^:]+:[^@]+@` (credential leak; G2 self-test fails).
        - _testHook_simulateFlushAndPoison throws when c is null (Lock 13 violation; F17 fixture would crash on dev-machine without Redis).
        - _testHook_simulateFlushAndPoison writes to canonical streams (agent-token-spend, route-decisions, context-bench-runs, etc.) - REDIS-LOCK-01 hard-stop.
        - docker-compose.redis.yml requests volumes or persistence (must be ephemeral by design; Redis is optional projection only).
        - Any path uses raw string concat instead of path.join (Windows-bash incompat).
    stop_rule: |
      `node super-gsd/tools/context-cache/run-redis-self-test.cjs --groups=A,G,E` exits 0 with G1+G2+E2 PASS (with or without live Redis; soft-skip OK). `cat .planning/metrics/redis-projection-log.jsonl | grep -c ':[^/]*@'` returns 0 (no credential leak). `node -e "require('./super-gsd/tools/context-cache/redis-adapter.cjs')._testHook_simulateFlushAndPoison({}).then(r => process.exit(r.ok || r.reason === 'redis_not_available_soft_skip' ? 0 : 1))"` exits 0 (soft-skip on dev without Redis). Atomic commit `feat(52-01): degraded-fallback + projection log + flush+poison test hook (REDIS-LOCK-06; Pitfall 1 redaction)`.
    verification_cmd: "node -e \"const a = require('./super-gsd/tools/context-cache/redis-adapter.cjs'); a.isAvailable({}).then(r => { if(r.metadata && JSON.stringify(r.metadata).match(/:[^@]+@/)) process.exit(1); console.log('T5 redaction OK'); }).catch(()=>process.exit(1));\""
    expected_ATC_tier: FULL

  - id: "52-01-T6"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/context-bench/failure-injectors.cjs
    depends_on: ["52-01-T1", "52-01-T2", "52-01-T3", "52-01-T4", "52-01-T5"]
    input_contract: |
      Reads:
        - super-gsd/tools/context-bench/failure-injectors.cjs (Phase 51 shipped; F17 stub at lines 271-279 + 891-900 to be rewritten)
        - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-RESEARCH.md "Pattern 4 F17 Fixture Activation (the ONE allowed Phase 51 byte range)" (lines 503-555 of RESEARCH.md) + "Pitfall 6 F17 activation bleeds into other fixtures" + "Cross-Phase Integration Phase 51 F17 fixture activation"
        - super-gsd/tools/context-cache/redis-adapter.cjs (T5 _testHook_simulateFlushAndPoison + REDIS_REASON_CODES enum)
        - .planning/metrics/redis-projection-log.jsonl (T5 created; F17 observe() reads tail)
      Inputs from prior tasks: T5 _testHook_simulateFlushAndPoison public export; REDIS_REASON_CODES enum (specifically: source_hash_drift, poisoned_unparseable, redis_flushdb_recovered_via_sqlite per Q3 resolved 3-code set).
    output_contract: |
      SURGICAL EDIT to super-gsd/tools/context-bench/failure-injectors.cjs - ONLY at:
        - Lines 271-279 (F17_STUB descriptor block):
          * id: 'F17' (UNCHANGED)
          * label: 'phase 52 redis flush + poisoned key (live)' (replaces 'phase 52 redis cross-binding (contract-only stub)')
          * inject_point: 'phase-52.redis_adapter' (UNCHANGED)
          * expected_reason_codes: Object.freeze(['source_hash_drift', 'poisoned_unparseable', 'redis_flushdb_recovered_via_sqlite']) (replaces empty Object.freeze([]); Q3 resolved 3-code set)
          * evidence_path: '.planning/metrics/redis-projection-log.jsonl' (replaces null)
          * applies_to_scenarios: Object.freeze(['S1-v17-P32', 'S2-v18-P36']) (replaces empty Object.freeze([]); Q3 resolved 2-scenario set)
          * soft_skip_when: null (replaces 'phase_52_redis_adapter_not_shipped'; the adapter NOW SHIPS).
        - Lines 891-900 (_F17 factory body):
          * Replace contract-only stub with real injector implementing 4-step protocol per RESEARCH Pattern 4:
            - `function _F17(ctx) { ... }` body returns `{ snapshot, inject, observe, restore }` handle.
            - LAZY require inside inject() body ONLY (Pitfall 6 binding): `let adapter = null; try { adapter = require('../context-cache/redis-adapter.cjs'); } catch (_e) { adapter = null }`. NEVER at file top - prevents F1..F16 path from picking up redis dep side-effects.
            - snapshot(): capture current byte length of `${ctx.planningDir || process.cwd()}/.planning/metrics/redis-projection-log.jsonl` (or 0 if absent); return true.
            - inject(): if (!adapter) return false; await adapter._testHook_simulateFlushAndPoison({ projectDir: ctx.planningDir || process.cwd() }); return true.
            - observe(): read tail of redis-projection-log.jsonl (lines beyond snapshot byte length); return true if all 3 expected_reason_codes appear in tail rows; false otherwise.
            - restore(): truncate redis-projection-log.jsonl back to snapshot byte length (delete test-only rows); attempt to delete sgsd:v19:test:* keys via adapter._getClient + scanIterator if available; return true.
      ALL OTHER bytes in failure-injectors.cjs are byte-identical to pre-edit:
        - Lines 1-263 (file header + INJECTION_FIXTURES Object.freeze 16-entry array F1..F16): UNCHANGED.
        - Lines 280-890 (INJECT_REASON_CODES + _F1..._F16 factory bodies): UNCHANGED.
        - Lines 901+ (FIXTURE_FACTORIES map + injectFailure public API + module exports): UNCHANGED.
      Lock 4 binding evidence (must be true after commit):
        - `git diff super-gsd/tools/context-bench/failure-injectors.cjs | grep -E '^[+-]' | grep -vE '^(\\+\\+\\+|---)'` shows ONLY changes within line ranges 271-279 and 891-900.
        - Diff line count <= 60 (target ~30-40 line changes).
      Self-test assertions added in run-redis-self-test (T7 wires; H1 hook contract):
        - H1: `require('../context-bench/failure-injectors.cjs').INJECTION_FIXTURES.length === 16` (F1..F16 array intact; F17 was always outside the array).
        - H2 (after T7): when SGSD_REDIS_DISABLED=1, F17 inject() returns false (soft-skip semantics); observe() returns false; restore() returns true.
        - H3 (when live Redis): F17 inject() snapshots projection-log byte length; runs _testHook; observe() finds all 3 expected reason codes; restore() truncates back.
      No edits to any file outside failure-injectors.cjs in T6 (T7 is the integration task).
    hypothesis: |
      F17 activation is a SURGICAL byte-range edit that preserves the entire F1..F16 frozen contract because Phase 51 explicitly reserved lines 271-279 and 891-900 for this exact use (verified via failure-injectors.cjs lines 21-23 banner + 266-279 stub + 888-900 factory comment + 947 lookup fall-through `id === 'F17' ? F17_STUB : null`). The frozen 16-entry INJECTION_FIXTURES.length === 16 invariant holds because F17 was always APPENDED OUTSIDE the array; FIXTURE_FACTORIES.F17 already pointed at _F17 in Phase 51 and continues to do so. Pitfall 6 is mitigated by the LAZY require inside inject() (not at file top) - this means the F1..F16 self-test path NEVER loads the redis-adapter module and therefore cannot have its byte-fingerprint shift due to side effects of redis npm load. Q3 resolved expected_reason_codes set is exactly 3: source_hash_drift (REDIS-LOCK-02 binding), poisoned_unparseable (REDIS-LOCK-07 binding), redis_flushdb_recovered_via_sqlite (REDIS-LOCK-05 binding) - these are the three CONTEXT.md "Required Failure Contract" cases that Phase 51 cross-binds to Phase 52. Q3 applies_to_scenarios set is S1+S2 because those are the two scenarios with the highest baseline_signature.actual_tokens_total (S2 at 171k - the audit's primary case; S1 representative mid-complexity); F17 activation is most informative on these two. Q4 (FLUSHDB or poisoned key) resolved BOTH sequentially in one fixture's inject() per recommendation - poisoned key first (proves rejection), FLUSHDB second (proves recovery), restore() unwinds both.
    falsifier: |
      Plan is wrong if any of:
        - INJECTION_FIXTURES.length !== 16 after T6 commit (F1..F16 array contract broken).
        - Any byte outside lines 271-279 or 891-900 changes in failure-injectors.cjs (Lock 4 violation; the diff line count exceeds 60 OR includes changes to lines 1-263 / 280-890 / 901+).
        - F17 inject() requires the redis-adapter at file top (Pitfall 6 violation; F1..F16 self-test would gain a redis dep on dev machines without Redis).
        - F17 inject() throws when adapter is null (Lock 13 violation; should soft-skip instead).
        - F17 expected_reason_codes is NOT exactly the 3-element Object.freeze(['source_hash_drift', 'poisoned_unparseable', 'redis_flushdb_recovered_via_sqlite']) (Q3 contract violation).
        - F17 evidence_path is anything other than '.planning/metrics/redis-projection-log.jsonl'.
        - F17 applies_to_scenarios is NOT Object.freeze(['S1-v17-P32', 'S2-v18-P36']) (Q3 contract violation).
        - F17 soft_skip_when is anything other than null (the adapter ships in this phase; soft-skip reason should no longer fire on activation; the harness's soft-skip path uses _getClient null detection at runtime, not the descriptor field).
        - F17 restore() fails to truncate redis-projection-log.jsonl back to snapshot byte length (canonical drift; anti-pollution self-test in Phase 51 fails).
        - Phase 51 `node super-gsd/tools/context-bench/run-self-test.cjs` exits non-zero after T6 commit (regression on F1..F16).
    stop_rule: |
      `git diff super-gsd/tools/context-bench/failure-injectors.cjs | wc -l` <= 60 lines of diff. `node super-gsd/tools/context-bench/run-self-test.cjs` exits 0 (Phase 51 self-test still passes). `node -e "const f = require('./super-gsd/tools/context-bench/failure-injectors.cjs'); if(f.INJECTION_FIXTURES.length !== 16) process.exit(1); console.log('F1..F16 frozen OK');"` exits 0. Atomic commit `feat(52-01): F17 activation - real injector at lines 271-279 + 891-900 (Lock 4: F1..F16 byte-untouched)`.
    verification_cmd: "node -e \"const f = require('./super-gsd/tools/context-bench/failure-injectors.cjs'); if(f.INJECTION_FIXTURES.length !== 16) process.exit(1); if(!Object.isFrozen(f.INJECTION_FIXTURES)) process.exit(1); console.log('T6 F1..F16 frozen OK; INJECTION_FIXTURES.length=' + f.INJECTION_FIXTURES.length);\""
    expected_ATC_tier: FULL

  - id: "52-01-T7"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/context-cache/redis-adapter.test.cjs
      - super-gsd/tools/context-cache/run-redis-self-test.cjs
      - super-gsd/tools/context-cache/redis-adapter.cjs
    depends_on: ["52-01-T1", "52-01-T2", "52-01-T3", "52-01-T4", "52-01-T5", "52-01-T6"]
    input_contract: |
      Reads:
        - super-gsd/tools/context-cache/redis-adapter.cjs (cumulative T1-T5; all 8 public APIs + _testHook_simulateFlushAndPoison)
        - super-gsd/tools/context-bench/failure-injectors.cjs (T6 F17 activation)
        - super-gsd/tools/context-bench/run-self-test.cjs (Phase 51 thin shell pattern; lines 1-52 to mirror)
        - super-gsd/tools/context-cache/build.test.cjs (Phase 46 inline self-test pattern reference; runAll + formatSummary contract)
        - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-RESEARCH.md "Code Examples Example 3 Self-test entry shape" (16-assertion target across groups A-H)
      Inputs from prior tasks: T1-T5 cumulative public surface; T6 F17 activation.
    output_contract: |
      Writes super-gsd/tools/context-cache/redis-adapter.test.cjs (~300-400 lines):
        - exports: `runAll() -> { pass, fail, total, results }`, `formatSummary(results) -> string`.
        - 16 assertions across 8 groups (final list-locked per RESEARCH Example 3):
          * Group A connection guard (3 assertions):
            - A1: isAvailable returns degraded when redis module missing (force-mock _redis=null).
            - A2: isAvailable returns degraded when SGSD_REDIS_URL absent.
            - A3: isAvailable returns degraded when SGSD_REDIS_DISABLED=1.
          * Group B key policy (3 assertions):
            - B1: putHotPacket rejects forbidden kind 'decision' with reason='forbidden_kind'.
            - B2: putHotPacket rejects unknown kind 'garbage' with reason='unknown_kind'.
            - B3: every put includes EX option (TTL discipline; mock c.set spy).
          * Group C source-hash invalidation (2 assertions):
            - C1: getHotPacket returns stale:true when source_hashes mismatch (mock _sourceHashesStillMatch returning false).
            - C2: invalidateBySourceHash deletes matching keys (mock c.scanIterator yielding test keys; assert count > 0 + emit log row reason='source_hash_drift').
          * Group D semantic cache key composition (2 assertions):
            - D1: _composeSemanticKey({intent_id:'X', role:'researcher', ...}) !== _composeSemanticKey({intent_id:'X', role:'executor', ...}) (Pitfall 2 binding).
            - D2: source_hashes=['a','b'] yields same key as ['b','a'] (sort invariance).
          * Group E poisoned-key defense (2 assertions):
            - E1: getHotPacket on unparseable JSON returns reason='poisoned_unparseable' AND emits projection-log row with status='rejected'.
            - E2: getHotPacket on schema-invalid value returns reason='schema_invalid' AND emits log + deletes key.
          * Group F FLUSHDB safety (1 assertion; live Redis only; soft-skip otherwise):
            - F1: when SGSD_REDIS_URL set + Redis reachable, run _testHook_simulateFlushAndPoison; assert post-flush getHotPacket returns reason='miss' AND .planning/metrics/redis-projection-log.jsonl gains rows containing all 3 expected_reason_codes from F17 contract; canonical .planning/ files (agent-token-spend.jsonl, context-packet-log.jsonl, route-decisions.jsonl, context-complaints.jsonl) byte-untouched (sha256 fingerprint pre/post equal). Soft-skip with reason='redis_not_available_soft_skip' when no Redis.
          * Group G Lock 13 + redaction (2 assertions):
            - G1: drive every public API with bogus inputs (null, undefined, malformed object, malformed key string); assert no exception escapes (Lock 13 binding; try/catch a la `for each api: try { await api(bogus) } catch (e) { fail('threw') }`).
            - G2: emit a projection log row with detail='connect failed: redis://user:secret@host:6379'; read log tail; assert no occurrence of `:secret@` AND no match of regex `://[^:]+:[^@]+@` (Pitfall 1 binding; ASVS V2/V7).
          * Group H F17 cross-binding (1 assertion):
            - H1: redis-adapter exports _testHook_simulateFlushAndPoison (typeof === 'function'); failure-injectors.cjs F17 factory does NOT throw when called with empty ctx (Pitfall 6 binding).
        - formatSummary returns multiline string showing per-group pass/fail counts + total + reason codes for any failures (mirrors Phase 46 build.test.cjs formatSummary).
        - Soft-skip handling: groups requiring live Redis (F1) emit `{ ok: 'soft-skipped', reason: 'redis_not_available_soft_skip' }` when _getClient returns null; soft-skips count as PASS in the runAll total but are flagged in formatSummary output.
        - ASCII-only literals; no smart quotes.
      Writes super-gsd/tools/context-cache/run-redis-self-test.cjs (~50 lines mirroring Phase 51 run-self-test.cjs:1-52 verbatim pattern):
        - File header banner: ASCII-only, references Phase 51 self-test pattern.
        - main(): require('./redis-adapter.test.cjs'); call runAll(); print formatSummary; exit 0 on pass (or pass-with-soft-skip), exit 1 on first hard fail.
        - CLI argv handling: `--groups=A,B,...` to filter (optional; default all).
        - Progress logging to stderr (cyan/green/red mirroring rebuild.cjs / run-self-test.cjs convention).
      Modifies super-gsd/tools/context-cache/redis-adapter.cjs:
        - `selfTest()` filled body (T1 left as placeholder): `try { const t = require('./redis-adapter.test.cjs'); return t.runAll(); } catch (e) { return { pass: 0, fail: 1, total: 1, results: [{ id: 'load_error', ok: false, reason: e.message }] } }`. Lock 13 wrapped.
      Optional integration (Q1 resolution / Q4 follow-on):
        - Document in run-redis-self-test.cjs banner: operator may invoke `node super-gsd/scripts/sgsd-complete-milestone.cjs` (Phase 51 wrapper) which runs Phase 51 context-bench self-test; that self-test now activates F17 (post-T6) and reaches into redis-adapter via the LAZY require pattern. The pattern is "operator runs both" (not auto-chained) - documented in banner only, no code wiring (avoids touching sgsd-complete-milestone.cjs which is Phase 51 surface and Lock 4 quiet for Phase 52).
    hypothesis: |
      The 16-assertion list is FINAL and matches RESEARCH Example 3 verbatim because Phase 51 self-test discipline (33 assertions over 6 groups) and Phase 46 self-test discipline (33 assertions) both prove that 15-20 is the right scaling target for an adapter with ~8 public APIs. 16 covers: 3 connection guards (covers all 3 fail paths), 3 key policies (forbidden + unknown + TTL), 2 source-hash (covers REDIS-LOCK-02), 2 semantic-key (covers Pitfall 2), 2 poisoned-key (covers REDIS-LOCK-07), 1 FLUSHDB (covers REDIS-LOCK-05), 2 Lock 13 + redaction (covers REDIS-LOCK-06 + ASVS V2/V7), 1 F17 hook (covers Phase 51 cross-binding). Soft-skip discipline for groups F1 (live Redis) means CI without Redis still emits PASS-with-soft-skip - no false-fail on dev machines. F17 cross-binding test (H1) is the integration witness: if redis-adapter is in scope, F17 fixture is real, not stub. Pattern "operator runs both" (Phase 52 self-test + Phase 51 self-test invoked separately) avoids touching sgsd-complete-milestone.cjs which is Phase 51 surface (Lock 4 quiet); operator-level documentation suffices.
    falsifier: |
      Plan is wrong if any of:
        - run-redis-self-test.cjs total assertion count != 16 (RESEARCH Example 3 contract).
        - run-redis-self-test.cjs exits non-zero when no Redis available (should pass-with-soft-skip; F1 soft-skip is documented absence-of-evidence, NOT fail).
        - run-redis-self-test.cjs exits 0 when ANY of A1-E2 + G1-G2 + H1 fail (these run without live Redis; failure means broken contract).
        - selfTest() in redis-adapter.cjs throws upward when redis-adapter.test.cjs is absent (Lock 13 violation; should return error sentinel).
        - run-redis-self-test.cjs writes to ANY file other than redis-projection-log.jsonl (canonical pollution; Pitfall 5).
        - redis-projection-log.jsonl gains rows containing real credentials after self-test run (G2 fail; ASVS V2/V7 violation).
        - F17 hook test (H1) imports redis-adapter at file top of failure-injectors.cjs (Pitfall 6 violation; verified by re-checking failure-injectors.cjs require placement).
        - sgsd-complete-milestone.cjs is touched by T7 (Lock 4 violation - that file is Phase 51 surface and byte-frozen for Phase 52).
        - run-redis-self-test.cjs banner lacks the "operator runs both" documentation note (the integration pattern is operator-visible, not auto-chained).
    stop_rule: |
      `node super-gsd/tools/context-cache/run-redis-self-test.cjs` exits 0 (without Redis: 15 PASS + 1 SOFT-SKIP for F1; with Redis: 16/16 PASS) in <5 seconds. `node super-gsd/tools/context-bench/run-self-test.cjs` exits 0 (Phase 51 self-test still passes; F17 reports inject status via lazy adapter require). `git diff --quiet -- super-gsd/scripts/sgsd-complete-milestone.cjs super-gsd/skills/sgsd-complete-milestone/SKILL.md super-gsd/scripts/lib/sgsd-cockpit-shell.cjs` exits 0 (Lock 4 evidence: Phase 50/51 surfaces untouched). `cat .planning/metrics/redis-projection-log.jsonl | wc -l` >= 1 (envelope-v1 row from self-test). `grep -niE "embedding|cosine|levenshtein|fuzzy|similarity_score" super-gsd/tools/context-cache/redis-adapter.cjs super-gsd/tools/context-cache/redis-adapter.test.cjs` returns 0 matches outside RESEARCH-quoted comment lines (Lock 11 audit). Atomic commit `feat(52-01): self-test entry + 16-assertion list-lock + thin shell + F17 hook integration`.
    verification_cmd: "node super-gsd/tools/context-cache/run-redis-self-test.cjs"
    expected_ATC_tier: FULL

context:
  - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-CONTEXT.md
  - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-REDIS-GUIDE-DELTA.md
  - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-RESEARCH.md
  - .planning/milestones/v1.9/REQUIREMENTS.md
  - .planning/milestones/v1.9/ROADMAP.md
  - super-gsd/tools/context-cache/rebuild.cjs
  - super-gsd/tools/context-bench/failure-injectors.cjs
  - super-gsd/tools/context-bench/run-self-test.cjs
  - package.json
---

<objective>
Phase 52 ships the **final v1.9 phase**: an optional Redis Live Memory Projection Adapter at `super-gsd/tools/context-cache/redis-adapter.cjs` that exposes 8 Lock-13-wrapped public APIs over an optional `redis@^5.12.1` client. Redis is treated as a **disposable projection layer** for four classes of derived state (live coordination, hot context-packet cache, intent/role/source-hash-bound semantic cache, append-style event stream); canonical truth (decisions, debt, evidence, capsules, validated thoughts, memory lifecycle, benchmark results, route decisions) **never** lives in Redis - those remain in `.planning/` JSONL streams + `PHASE-CAPSULE.json` + source-hash registries + git.

Purpose: Add Redis as an OPTIONAL speed layer behind a never-throw seam, with source-hash revalidation on every read and a degraded-OK fallback to Phase 46 SQLite. F17 fixture activation in Phase 51 closes the cross-binding loop for FLUSHDB / poisoned-key recovery scenarios.

Output: One new adapter file + inline test file + thin shell entry + 1 docker compose snippet + 1 surgical edit to Phase 51 failure-injectors.cjs (F17 byte range only) + 1 package.json optionalDependencies entry + 1 new envelope-v1 metric stream.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<interfaces>
<!-- Key types and contracts the executor needs. Embedded so executor avoids codebase exploration. -->

From super-gsd/tools/context-cache/rebuild.cjs (Phase 46; READ-ONLY by Lock 4 - referenced for pattern only):
```javascript
// Lock 13 try/require pattern (lines 60-64) - mirror at top of redis-adapter.cjs:
let _sqlite = null;
try { _sqlite = require('better-sqlite3'); } catch (_e) { _sqlite = null; }

// _emitContextIndexComplaint envelope-v1 (lines 222-234) - mirror for redis-projection-log:
function _emitContextIndexComplaint(row) {
  const envelope = {
    ts: new Date().toISOString(),
    event: 'context_index_complaint',
    schema_version: 1,
    ...row
  };
  fs.appendFileSync(jsonlPath, JSON.stringify(envelope) + '\n', 'utf8');
}

// KIND_VOCAB closed-enum (lines 97-103) - mirror for ALLOWED_KINDS / FORBIDDEN_KINDS:
const KIND_VOCAB = Object.freeze(new Set([
  'goal', 'requirement', 'decision', 'evidence', 'risk', 'constraint', 'pattern',
  'pitfall', 'verifier_verdict', 'capsule_decision', 'bypass_ref', 'atc_finding',
  'validated_thought'
]));
```

From super-gsd/tools/context-bench/failure-injectors.cjs (Phase 51; lines 271-279 + 891-900 are the SURGICAL EDIT WINDOW):
```javascript
// CURRENT STATE - F17_STUB at lines 271-279:
const F17_STUB = Object.freeze({
  id: 'F17',
  label: 'phase 52 redis cross-binding (contract-only stub)',
  inject_point: 'phase-52.redis_adapter',
  expected_reason_codes: Object.freeze([]),
  evidence_path: null,
  applies_to_scenarios: Object.freeze([]),
  soft_skip_when: 'phase_52_redis_adapter_not_shipped',
});

// CURRENT STATE - _F17 factory at lines 891-900:
function _F17(_ctx) {
  return {
    snapshot: function () { return true; },
    inject: function () { return true; },
    observe: function () { return true; },
    restore: function () { return true; },
    skipped: true,
    reason: 'phase_52_redis_adapter_not_shipped',
  };
}

// AFTER T6 EDIT - F17_STUB at lines 271-279 (Q3 resolved 3-code set):
// expected_reason_codes: ['source_hash_drift', 'poisoned_unparseable', 'redis_flushdb_recovered_via_sqlite']
// evidence_path: '.planning/metrics/redis-projection-log.jsonl'
// applies_to_scenarios: ['S1-v17-P32', 'S2-v18-P36']
// soft_skip_when: null
// label: 'phase 52 redis flush + poisoned key (live)'

// AFTER T6 EDIT - _F17 factory at lines 891-900:
// LAZY require inside inject() body (Pitfall 6 binding); never at file top.
// snapshot/inject/observe/restore implement RESEARCH Pattern 4 4-step protocol.
```

From super-gsd/tools/context-bench/run-self-test.cjs (Phase 51 thin-shell pattern; mirror in run-redis-self-test.cjs):
```javascript
// File is ~52 lines; mirrors:
// 1. parseArgs() for --groups optional filter
// 2. require('./harness.cjs') - in our case './redis-adapter.test.cjs'
// 3. const result = harness.selfTest() - in our case t.runAll()
// 4. formatSummary(result.results) -> stderr
// 5. exit code propagates from result.fail count
```

From package.json (current state - top-level keys to PRESERVE byte-untouched in T1):
```json
{
  "name": "sgsd",
  "version": "1.9.0",
  "description": "Super GSD - autonomous execution engine",
  "private": true,
  "engines": { "node": ">=22.0.0" },
  "dependencies": { "better-sqlite3": "^12.9.0" }
}
// T1 ADDS ONLY: "optionalDependencies": { "redis": "^5.12.1" }
```

From redis@5.12.1 (node-redis vendor docs; Context7 /redis/node-redis):
```javascript
// Basic Connection (T1 _getClient pattern):
const client = createClient({
  url: process.env.SGSD_REDIS_URL,
  socket: {
    connectTimeout: 5000,
    reconnectStrategy: function (retries, cause) {
      if (cause && cause.constructor && cause.constructor.name === 'SocketTimeoutError') return false;
      return Math.min(Math.pow(2, retries) * 50, 2000) + Math.floor(Math.random() * 200);
    }
  },
  commandOptions: { timeout: 50 }
});

// Streams with TRIM (T4 publishEvent pattern):
await c.xAdd(stream_name, '*', fields, { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 } });

// SCAN iterator (T2 invalidateBySourceHash pattern):
for await (const key of c.scanIterator({ MATCH: 'sgsd:v19:*', COUNT: 200 })) {
  // ...
}
```

</interfaces>

<open_questions_resolved>
The 5 open questions from 52-RESEARCH.md §"Open Questions" are resolved IN-PLAN. Executors do NOT need to re-litigate; treat each as a locked pre-flight decision.

- **Q1 (Docker compose snippet for local Redis dev?):** YES - ship at `super-gsd/tools/context-cache/docker-compose.redis.yml` (T5; ~10 lines, single redis:7-alpine, no volumes, port 6379). Operator entry comment at top. The F17 fixture is most useful when operator can run live Redis locally; native install / cloud Redis remain alternatives. Cost: ~10 lines + 1 banner paragraph. Benefit: F17 cross-binding becomes runnable on dev machine without external setup.

- **Q2 (CLI verbs --check / --flush-safe / --warm-cache?):** Resolution: ship `--groups=A,B,...` filter on run-redis-self-test.cjs (T7) - that is the only first-pass CLI verb required for self-test. `--probe` (fast isAvailable), `--purge-prefix`, etc. are deferred to a future milestone (the adapter's public APIs are all programmatic; CLI parity is a follow-on). The Q2 RESEARCH-recommended `--check + --warm-cache` is rejected for v1.9 because (a) `--check` duplicates `node -e "require('./redis-adapter.cjs').isAvailable()"`, (b) `--warm-cache` requires a fixture-loading concept not in scope (Phase 52 ships read-side; warm-up is Phase 53+ wiring). `--flush-safe` defers to redis-cli per recommendation.

- **Q3 (F17 reason codes set?):** Resolved exactly 3: `source_hash_drift`, `poisoned_unparseable`, `redis_flushdb_recovered_via_sqlite` (T6 falsifier). These are the three behaviors CONTEXT.md "Required Failure Contract" explicitly cross-binds to Phase 51. F17 applies_to_scenarios resolved to ['S1-v17-P32', 'S2-v18-P36'] - two highest-baseline scenarios where F17 is most informative.

- **Q4 (F17 inject strategy: FLUSHDB or poisoned key?):** Resolved BOTH sequentially in one fixture's inject() per T5 _testHook_simulateFlushAndPoison: poisoned key first (proves rejection via source-hash + schema validation), FLUSHDB second (proves recovery via SQLite fallback path), restore() unwinds both (truncate projection log to snapshot byte length + delete sgsd:v19:test:* keys).

- **Q5 (redis-projection-log.jsonl git-tracked?):** Resolved YES (Q5 RESEARCH-recommended TRACK). Mirrors token-attribution + route-decisions discipline (envelope-v1, append-only, useful in git history for debugging). Different from heartbeat.jsonl (gitignored) which emits per-second; projection log emits per-degradation only. The first row written by self-test is committed alongside the adapter for evidence symmetry.
</open_questions_resolved>

<lock_invariants>
| Lock | From | Phase 52 Extension |
|------|------|--------------------|
| Lock 4 | REQUIREMENTS.md | Phase 41-51 trees byte-untouched EXCEPT failure-injectors.cjs lines 271-279 + 891-900 (F17 surgical window). T6 stop_rule + falsifier enforce: `git diff super-gsd/tools/context-bench/failure-injectors.cjs` shows changes ONLY within those 2 line ranges. T7 falsifier: `git diff --quiet -- super-gsd/scripts/sgsd-complete-milestone.cjs super-gsd/skills/sgsd-complete-milestone/SKILL.md super-gsd/scripts/lib/sgsd-cockpit-shell.cjs` exits 0. |
| Lock 11 | REQUIREMENTS.md non-negotiable #11 | Cache hit decision is byte-equality on closed-vocab key components ONLY. NO embedding/cosine/levenshtein/similarity_score/regex-fuzzy. T3 falsifier enforces grep returns 0 matches. _composeSemanticKey is a sha256 byte-hash; collision is the only failure mode (negligible). |
| Lock 13 | REQUIREMENTS.md non-negotiable #13 | All 8 public APIs (isAvailable, getHotPacket, putHotPacket, getSemanticCache, putSemanticCache, publishEvent, readEvents, invalidateBySourceHash, selfTest) wrap internals in try/catch and return falsey/degraded sentinels. T7 G1 self-test drives every API with bogus inputs and asserts no exception escapes. selfTest() itself is Lock 13 wrapped (T7 fills body with try/catch around require of test module). |
| REDIS-LOCK-01 | 52-REDIS-GUIDE-DELTA.md | Allowlist (9 kinds) + denylist (7 forbidden kinds); FORBIDDEN_KINDS rejected on every put (T3 B1 + T7 B1). Adapter never writes to canonical streams (Pitfall 5; T5 falsifier enforces only redis-projection-log.jsonl is owned). |
| REDIS-LOCK-02 | 52-REDIS-GUIDE-DELTA.md | Every Redis value carries source_hashes; every read revalidates against canonical state (T2 _revalidateAndMaybeDelete + T3 getHotPacket/getSemanticCache). |
| REDIS-LOCK-03 | 52-REDIS-GUIDE-DELTA.md | Semantic cache key = byte-equality on 5 components (intent_id_normalized + role + phase + milestone + context_policy + sorted source_hashes). T3 D1 + D2 self-test prove different roles -> different keys + sort invariance. |
| REDIS-LOCK-04 | 52-REDIS-GUIDE-DELTA.md | Every put has EX (TTL); every stream has TRIM MAXLEN ~. T3 B3 + T4 F2 self-test enforce. |
| REDIS-LOCK-05 | 52-REDIS-GUIDE-DELTA.md | FLUSHDB acceptance - canonical truth survives. T7 F1 (live Redis) asserts: post-flush getHotPacket returns 'miss'; .planning/ files byte-untouched (sha256 fingerprint pre/post equal); cockpit warms back from SQLite/local. |
| REDIS-LOCK-06 | 52-REDIS-GUIDE-DELTA.md | Degraded-OK; Redis down/timeout/auth-fail/module-missing all return sentinel; SQLite/local files always serve. T7 A1+A2+A3+G1 enforce. |
| REDIS-LOCK-07 | 52-REDIS-GUIDE-DELTA.md | Poisoned keys (unparseable JSON, schema-invalid, stale source_hashes, unknown kind) rejected + deleted + logged. T2 + T3 + T7 E1 + E2 enforce. |

| Read-only Invariant | Source | Enforcement |
|---------------------|--------|-------------|
| Phase 41-51 tool trees byte-untouched (except F17 byte range) | Lock 4 + 52-CONTEXT.md depends_on | T7 stop_rule: `git diff --quiet -- super-gsd/tools/{token-attribution,token-waste,phase-capsule,context-registry,context-packet,sqlite-context-index,dispatch-router,vtp-bridge,memory-governance} super-gsd/scripts/lib/sgsd-cockpit-shell.cjs super-gsd/tools/context-cache/{rebuild.cjs,query.cjs,schema.sql,manifest.schema.json,build.test.cjs}` exits 0. failure-injectors.cjs diff scope-checked at <=60 lines + only within 271-279/891-900 (T6 stop_rule). |
| Canonical streams never polluted by adapter writes | Pitfall 5; REDIS-LOCK-01 | T5 falsifier: _emitProjectionLog appends ONLY to redis-projection-log.jsonl. Self-test fingerprints canonical streams pre/post (group F1 binding). |
| Credentials never logged | Pitfall 1; ASVS V2/V7 | T5 falsifier + T7 G2: regex `://[^:]+:[^@]+@` returns 0 matches in redis-projection-log.jsonl. |
| F1..F16 frozen | Phase 51 fixture freeze | T6 stop_rule: INJECTION_FIXTURES.length === 16 + Object.isFrozen + diff scope <=60 lines + only in F17 byte ranges. |
</lock_invariants>

<wave_decomposition>
The 7 tasks decompose into 4 dependency waves with disjoint files_touched (modulo redis-adapter.cjs which is the foundation file edited in regions by T1-T5):

```
Wave 1 (foundation):
  T1 [skeleton + 8-API surface + ALLOWED/FORBIDDEN/TTL/REASON_CODES + optionalDependencies]
     -> redis-adapter.cjs (skeleton), package.json (single key insert)

Wave 2 (read-side infra):
  T2 [source-hash revalidation + invalidateBySourceHash (REDIS-LOCK-02/07)]
     -> redis-adapter.cjs (helpers + 1 public API filled)

Wave 3 (cache + stream classes - parallelizable in principle, but redis-adapter.cjs serialization forces sequential):
  T3 [hot packet + semantic cache (REDIS-LOCK-03; Lock 11)]
     -> redis-adapter.cjs (4 public APIs filled)
  T4 [live coordination + event stream (Class 1+4)]
     -> redis-adapter.cjs (2 public APIs filled + helpers)

Wave 4 (degraded-fallback + observability + cross-binding):
  T5 [degraded-fallback + projection log + flush+poison test hook (REDIS-LOCK-06; Pitfall 1)]
     -> redis-adapter.cjs (isAvailable + _emitProjectionLog + _testHook_simulateFlushAndPoison filled),
        docker-compose.redis.yml (CREATE), redis-projection-log.jsonl (CREATE first row)
  T6 [F17 activation - lines 271-279 + 891-900 ONLY of failure-injectors.cjs]
     -> failure-injectors.cjs (SURGICAL EDIT, no other file)

Wave 5 (final integration + self-test entry):
  T7 [16-assertion list-locked + thin shell + selfTest() wired]
     -> redis-adapter.test.cjs (CREATE), run-redis-self-test.cjs (CREATE),
        redis-adapter.cjs (selfTest body filled)
```

Files_touched are disjoint EXCEPT for redis-adapter.cjs which T1-T5 edit in different regions (skeleton in T1; helpers in T2; cache APIs in T3; stream APIs in T4; isAvailable+emitter+testHook in T5; selfTest body in T7). The executor MUST coordinate redis-adapter.cjs edits sequentially (T1 -> T2 -> T3 -> T4 -> T5 -> T7) because each task fills a different region of the same file. T3+T4 are dependency-equivalent (both depend on T1+T2) but cannot run in true parallel due to file-serialization; sequential execution T3 -> T4 has no penalty.

T6 is the ONLY task touching failure-injectors.cjs and runs after T5 (depends on T5's _testHook_simulateFlushAndPoison export). T7 closes the loop with the test file + thin shell + selfTest wire-up.
</wave_decomposition>

<verification>
Phase 52 verifier (gsd-verifier dispatch) checks:

- [ ] All 7 NEW/MODIFIED files exist:
  - super-gsd/tools/context-cache/redis-adapter.cjs (NEW)
  - super-gsd/tools/context-cache/redis-adapter.test.cjs (NEW)
  - super-gsd/tools/context-cache/run-redis-self-test.cjs (NEW)
  - super-gsd/tools/context-cache/docker-compose.redis.yml (NEW)
  - super-gsd/tools/context-bench/failure-injectors.cjs (SURGICAL EDIT - lines 271-279 + 891-900 only)
  - package.json (optionalDependencies entry only)
  - .planning/metrics/redis-projection-log.jsonl (NEW; >=1 row from self-test)
- [ ] `node super-gsd/tools/context-cache/run-redis-self-test.cjs` exits 0 in <5 seconds: 16/16 PASS with live Redis OR 15 PASS + 1 SOFT-SKIP (group F1) without Redis.
- [ ] `node super-gsd/tools/context-bench/run-self-test.cjs` exits 0 (Phase 51 self-test still passes after F17 activation; F1..F16 byte-frozen).
- [ ] `INJECTION_FIXTURES.length === 16` (Phase 51 fixture freeze; F17 was always outside the array).
- [ ] `git diff super-gsd/tools/context-bench/failure-injectors.cjs` shows changes ONLY within line ranges 271-279 and 891-900; total diff line count <= 60.
- [ ] Phase 41-50 byte-untouched: `git diff --quiet -- super-gsd/tools/{token-attribution,token-waste,phase-capsule,context-registry,context-packet,sqlite-context-index,dispatch-router,vtp-bridge,memory-governance} super-gsd/tools/context-cache/{rebuild.cjs,query.cjs,schema.sql,manifest.schema.json,build.test.cjs} super-gsd/scripts/lib/sgsd-cockpit-shell.cjs super-gsd/scripts/sgsd-complete-milestone.cjs super-gsd/skills/sgsd-complete-milestone/SKILL.md` exits 0.
- [ ] Lock 11 audit: `grep -niE "embedding|cosine|levenshtein|fuzzy|semantic_similarity|similarity_score|approximate_match" super-gsd/tools/context-cache/redis-adapter.cjs super-gsd/tools/context-cache/redis-adapter.test.cjs` returns 0 matches outside RESEARCH-quoted comment lines.
- [ ] Lock 13 audit: every public API (isAvailable, getHotPacket, putHotPacket, getSemanticCache, putSemanticCache, publishEvent, readEvents, invalidateBySourceHash, selfTest) is wrapped in try/catch (grep on each function name + body for `try {`); G1 self-test drives all 8 with bogus inputs and asserts no throw escapes.
- [ ] ALLOWED_KINDS contains exactly the 9 documented kinds (cockpit_snapshot, active_agent_marker, session_checkpoint_marker, provider_health_cache, hot_context_packet, semantic_cache, validated_thought_projection, agent_event_stream, short_lived_counter); FORBIDDEN_KINDS contains exactly the 7 documented kinds (decision, debt, evidence, phase_capsule, memory_lifecycle, benchmark_result, route_decision).
- [ ] TTL_BY_KIND has 9 entries with documented values per Pitfall 3 (cockpit_snapshot:60, active_agent_marker:90, session_checkpoint_marker:600, provider_health_cache:120, hot_context_packet:300, semantic_cache:3600, validated_thought_projection:1800, agent_event_stream:0, short_lived_counter:30).
- [ ] package.json has `optionalDependencies: { "redis": "^5.12.1" }`; existing dependencies/engines/name/version/description/private byte-identical.
- [ ] `npm install --no-optional` followed by `node -e "require('./super-gsd/tools/context-cache/redis-adapter.cjs')"` exits 0 (redis module absence does not break load; T1 binding).
- [ ] redis-projection-log.jsonl has >=1 envelope-v1 row from self-test; no row matches regex `://[^:]+:[^@]+@` (credential redaction; G2 binding).
- [ ] F17 fixture activation: with SGSD_REDIS_DISABLED=1, F17 inject() returns false (soft-skip via _getClient null detection); with SGSD_REDIS_URL set + Redis reachable, F17 observe() finds all 3 expected_reason_codes in redis-projection-log.jsonl tail.
- [ ] Anti-pollution: canonical streams (agent-token-spend, context-packet-log, context-complaints, route-decisions, context-bench-runs) sha256+mtime+size identical pre/post `run-redis-self-test.cjs` invocation.
- [ ] `_testHook_simulateFlushAndPoison` is exported from redis-adapter.cjs (typeof === 'function'; T7 H1 binding).
- [ ] redis-adapter.cjs banner references CONTEXT.md + REDIS-GUIDE-DELTA.md + Lock 4/11/13 invariants (executor-readable provenance).
- [ ] All file content is ASCII-only (no smart quotes, no emoji); applies to redis-adapter.cjs, redis-adapter.test.cjs, run-redis-self-test.cjs, docker-compose.redis.yml, and the F17 byte-range edit.

Defer-with-debt allowed if: live Redis unavailable on dev machine -> F1 soft-skip is documented absence-of-evidence, NOT failure (Q1 docker compose snippet provides operator path to enable). Hard fail if: any of A1-E2 + G1-G2 + H1 fail OR Lock 4 / 11 / 13 / REDIS-LOCK-01..07 violations OR F1..F16 fixture array contract broken (length != 16 OR not Object.frozen) OR canonical streams polluted OR credentials leaked in projection log.
</verification>

<success_criteria>
Phase 52 (and v1.9 milestone) completes when ALL of the following hold:

1. All 7 files (5 NEW + 1 SURGICAL EDIT + 1 single-key package.json insert) shipped, ASCII-only, schema-valid, committed atomically (one commit per task).
2. `node super-gsd/tools/context-cache/run-redis-self-test.cjs` exits 0 with 16/16 PASS (with Redis) or 15 PASS + 1 SOFT-SKIP (without Redis) in <5 seconds.
3. `node super-gsd/tools/context-bench/run-self-test.cjs` exits 0 (Phase 51 self-test still passes after F17 activation; F1..F16 byte-frozen; INJECTION_FIXTURES.length === 16).
4. Phase 41-51 tool trees byte-untouched EXCEPT failure-injectors.cjs lines 271-279 + 891-900 (F17 surgical window per Lock 4 binding).
5. Anti-cheat: every Redis value carries the 10-field metadata envelope (CONTEXT.md "Required Key Policy"); every put has EX flag; every stream has MAXLEN ~ 1000 trim.
6. Anti-pollution: redis-adapter writes ONLY to redis-projection-log.jsonl; canonical streams (agent-token-spend, context-packet-log, route-decisions, context-bench-runs, context-complaints) byte-untouched across self-test runs (sha256 fingerprint identical pre/post).
7. Anti-credential-leak: redis-projection-log.jsonl contains 0 lines matching `://[^:]+:[^@]+@` regex (Pitfall 1 + ASVS V2/V7).
8. Lock 11 holds: cache hit decision is byte-equality on sha256 of closed-vocab components only; grep returns 0 matches for embedding/cosine/levenshtein/similarity_score across new code.
9. Lock 13 holds: every public API try/catch wraps and returns sentinel; G1 self-test verifies; selfTest() itself is Lock 13 wrapped.
10. REDIS-LOCK-01..07 hold: projection-only (no canonical writes), source-hash invalidation (every read revalidates), intent-scoped semantic cache (5-component byte-equality), TTL+dedup (every key has EX or stream retention), safe FLUSHDB (post-flush canonical files untouched), degraded-OK (Redis down/timeout/auth-fail all return sentinel + SQLite serves), poisoned-key defense (rejected + deleted + logged).
11. F17 cross-binding closes: F17 activation uses LAZY require (Pitfall 6 binding); F1..F16 frozen contract preserved; F17 expected_reason_codes contains exactly the 3 Q3-resolved codes.
12. Operator setup path documented: docker-compose.redis.yml ships for dev convenience (Q1 YES); SGSD_REDIS_URL + SGSD_REDIS_DISABLED env vars documented in adapter banner.
13. Phase 52 completes the v1.9 milestone. The milestone-close gate (sgsd-complete-milestone.cjs from Phase 51, byte-frozen by Lock 4 in Phase 52) runs: token-waste check, researcher token-spend baseline comparison, context-packet default-dispatch verification, intent-map default front-end verification, capsule-consumed-by-downstream verification, legal-registry-rejects-invented verification, SQLite-rebuild verification, **Redis-flush-or-absence-safe verification (this phase)**, cockpit-shows-tokens verification, VTP-route-gated verification, status-consistency / provider-health / backlog-schema / crit-backlog / token-waste checks all pass-or-degraded-honestly.

Phase 52 produces, by design, evidence for v1.9's "Redis is optional disposable projection; never canonical" claim AND v1.9's gracefully-degraded-but-PASS state when Redis is absent (16-assertion test with 1 soft-skip), AND v1.9's full-PASS state when live Redis is available (16/16 PASS including F1 FLUSHDB safety).
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-01-SUMMARY.md` summarizing:
  - Files created (5 NEW + 1 SURGICAL EDIT + 1 single-key insert = 7 total artifacts)
  - Self-test result (16/16 PASS expected with Redis; 15 PASS + 1 SOFT-SKIP without Redis)
  - Phase 51 self-test result post-F17-activation (33/33 PASS expected; F17 reports inject status when adapter loads)
  - Lock invariant audit results (Lock 4 byte-untouched; Lock 11 grep-clean; Lock 13 try/catch coverage; REDIS-LOCK-01..07 each documented green)
  - F1..F16 frozen contract evidence (INJECTION_FIXTURES.length === 16 + Object.isFrozen)
  - F17 cross-binding evidence (LAZY require placement; expected_reason_codes 3-set; applies_to_scenarios 2-set; soft_skip_when null after activation)
  - redis-projection-log.jsonl row count + redaction audit (0 credential-leak matches)
  - Phase 41-51 untouched-tree audit result
  - v1.9 milestone-close gate handoff (Phase 52 is the FINAL phase)
</output>
