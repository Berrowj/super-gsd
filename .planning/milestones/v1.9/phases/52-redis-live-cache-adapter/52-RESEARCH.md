---
phase: 52
name: Redis Live Memory Projection Adapter
milestone: v1.9
researched: 2026-04-28
domain: optional Redis projection / cache / event stream adapter behind a never-throw seam
confidence: HIGH
depends_on: [46, 50, 51]
unblocks: []
final_phase_of_milestone: true
---

# Phase 52 - Research

## Summary

Phase 52 is the LAST phase of v1.9 SGSD-Research. It ships an optional Redis
adapter that projects four classes of derived state (live coordination, hot
context-packet cache, intent/role/source-hash-bound semantic cache, append-style
event stream) without ever taking ownership of canonical truth. Canonical truth
already lives in `.planning/` JSONL streams, `PHASE-CAPSULE.json` files,
source-hash registries, and git. Phases 46 (SQLite context index), 49 (memory
governance lifecycle), 50 (cockpit), and 51 (context stress benchmark) are all
shipped; Phase 52 must consume their public surfaces by reference and treat
their files as the read-side of every cache invalidation.

The implementation is constrained by seven design locks (REDIS-LOCK-01..07),
the Phase 51 frozen-16 fixture contract (F1..F16 cannot be touched; F17 is
the dedicated Phase 52 cross-binding seat), and milestone non-negotiable Lock 4
(no edits to the Phase 41-51 tool trees). The adapter's surface is fixed by
52-REDIS-GUIDE-DELTA.md as `super-gsd/tools/context-cache/redis-adapter.cjs`
with eight public APIs that all return falsey/degraded sentinels and never
throw (Lock 13).

**Primary recommendation:** Build a single-file Node adapter
(`super-gsd/tools/context-cache/redis-adapter.cjs`) using the official
`redis` npm package (5.12.1, MIT, Redis-vendor maintained), gated behind a
feature flag (`SGSD_REDIS_URL` env var presence) and a shipped `node-redis`
dependency check via `try { require('redis') } catch { degraded }`. SQLite
remains the deterministic fallback for every read; `.planning/metrics/`
remains the deterministic fallback for every write. F17 is activated in
Phase 52 by editing `failure-injectors.cjs` ONLY at the F17 stub (line 891)
and the F17 expected_reason_codes/applies_to_scenarios fields (line 271-279),
because those bytes were specifically reserved for this phase by Plan 51-T4.
F1..F16 are out of scope.

## User Constraints (from CONTEXT.md)

### Locked Decisions

From `52-CONTEXT.md` (the phase's CONTEXT artifact, 748c7e62...):

> Goal: add Redis only as an optional live memory projection, never as
> SGSD truth.

The four allowed Redis state classes:

1. **Live coordination** - cockpit snapshots, active phase/agent markers,
   heartbeat/checkpoint hints, short-lived counters.
2. **Hot packet cache** - role-specific context packet previews keyed by
   `intent_id`, role, phase, and source hash set.
3. **Semantic cache** - prior intent/query results that can be reused only
   when the normalized intent, role, policy, and source hashes still match.
4. **Event stream** - append-style live events for cockpit rendering,
   provider canary results, retry state, agent progress.

The forbidden Redis canonical-truth domains:

- decisions
- debt
- evidence rows
- phase capsules
- validated thoughts
- memory lifecycle rows
- benchmark results
- route decisions

The required failure contract (Section "Required Failure Contract"):

- Redis down -> continue with SQLite/local files + log degraded
- Redis timeout -> continue with SQLite/local files + log timeout metadata
- Redis stale hit -> reject hit, rebuild from canonical, log stale key
- Redis FLUSHDB -> no canonical truth lost; cockpit/cache warms back up
- Redis poisoned key -> reject on schema/source-hash validation; never
  inject into a context packet

The required key metadata (Section "Required Key Policy"):
`schema_version, kind, milestone, phase, role (when role-scoped),
intent_id (when intent-scoped), source_hashes, registry_version (or
registry content hash), created_at, ttl_seconds, canonical_refs`.

From `52-REDIS-GUIDE-DELTA.md` (locked-delta, 2026-04-28):

The 7 design locks (REDIS-LOCK-01..07): projection-only, source-hash
invalidation, intent-scoped semantic cache, TTL+dedup, safe FLUSHDB,
degraded-OK, poisoned-key defense. Allowed key kinds (9):
`cockpit_snapshot, active_agent_marker, session_checkpoint_marker,
provider_health_cache, hot_context_packet, semantic_cache,
validated_thought_projection, agent_event_stream, short_lived_counter`.
Forbidden key kinds (7): `decision, debt, evidence, phase_capsule,
memory_lifecycle, benchmark_result, route_decision`.

Adapter surface fixed (Section "Adapter Surface") at
`super-gsd/tools/context-cache/redis-adapter.cjs` with these public APIs:

```text
isAvailable(opts)                      -> { ok, degraded_reason, metadata }
getHotPacket(key)                      -> { hit, stale, packet, reason }
putHotPacket(key, packet, metadata)    -> { ok, key, ttl_seconds }
getSemanticCache(query)                -> { hit, stale, value, reason }
putSemanticCache(query, value, meta)   -> { ok, key, ttl_seconds }
publishEvent(event)                    -> { ok, stream_id }
readEvents(scope)                      -> { ok, events }
invalidateBySourceHash(source_hash)    -> { ok, count }
selfTest()                             -> { pass, fail }
```

Acceptance scenarios from the Delta (Section "Acceptance Additions"):

- Redis unavailable -> SQLite/local fallback, no halt
- Redis FLUSHDB -> no canonical truth lost
- Hot packet cache hit -> source hashes match before use
- Stale source hash -> cache miss/rebuild, not injection
- Semantic cache hit -> requires intent + role + policy + source-hash match
- Poisoned key -> rejected and logged
- Stream events can render cockpit progress, but cockpit still works from
  files when the stream is absent
- Redis key inventory contains zero forbidden kinds

From REQUIREMENTS.md (REDIS-01..10, mass-discuss locked entry "Phase 52
Redis Live Cache Adapter | Optional disposable projection; never canonical").

From `.planning/discussions/2026-04-26-mass-discuss.md` Phase 52 lock:
"Optional disposable projection; never canonical". Hard stop trigger
(global): "Hard stop if an implementation makes Redis or SQLite canonical."

### Claude's Discretion

- Choice of Redis client library (recommended: official `redis` 5.12.1).
- Internal structure of `redis-adapter.cjs` (single file vs split into
  helpers under `super-gsd/tools/context-cache/`).
- TTL defaults per key kind (recommended ranges below).
- Sentinel return shapes - must match Lock 13 envelope, but exact shape is
  Claude's call as long as `{ok|hit, ...}` is consistent.
- Whether to ship a `redis-projection-log.jsonl` metrics stream (recommended
  YES for observability symmetry with Phase 41 envelope-v1).
- Whether F17 activation is a Phase 52 patch to `failure-injectors.cjs`
  (recommended YES; the byte range was reserved for this phase) or a
  separate Phase 51 patch (rejected - violates Lock 4 against Phase 51
  tool tree).

### Deferred Ideas (OUT OF SCOPE)

- Redis Cluster / Sentinel / replica support (single-node only for v1.9).
- Redis Search (RediSearch module) - requires module presence; not
  required by the spec.
- Redis Vector similarity (embedding/cosine) - explicitly forbidden by
  Lock 11 (REQUIREMENTS.md non-negotiable #11) and REDIS-LOCK-03.
- Redis ACL / auth provisioning UI (operator-supplied URL/credentials only).
- Cockpit panel rewrite to consume Redis (Phase 50 sgsd-cockpit-shell.cjs is
  shipped and Lock 4 forbids edits; the adapter exposes a read-side that
  Phase 50 *could* opt into in a future milestone, but that wiring is NOT
  shipped here).
- Distributed locks / leader election / pub-sub broadcast across N agents.
- Persistence config (AOF, RDB) - Redis is treated as ephemeral by design.
- Migration from a different cache backend (none exists today).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REDIS-01 | optional `redis-adapter.cjs` only behind context cache interface | Sec 3 architecture; Sec 5 adapter shape; the file path `super-gsd/tools/context-cache/redis-adapter.cjs` is fixed by 52-REDIS-GUIDE-DELTA.md |
| REDIS-02 | Redis only for: live cockpit, hot packets, semantic cache, provider canary, active markers, event streams, short-lived counters | Sec 1 (4 hot-state classes); Sec 6 (key kinds enumeration mirrors the 9 allowed kinds in the Delta) |
| REDIS-03 | FLUSHDB loses no canonical decisions, debt, phase evidence, capsules | Sec 8 (FLUSHDB acceptance test); Sec 12 (completion gate evidence: post-flush canary hit on .planning) |
| REDIS-04 | Redis unavailable -> SGSD runs with SQLite/local files + degraded status | Sec 9 (degraded-OK contract); Lock 13 binding pattern from Phase 46 rebuild.cjs:60-64 |
| REDIS-05 | Boot/readiness reports Redis as optional, never required | Sec 5 (`isAvailable()` API); Sec 9 (degraded-OK); cockpit consumer-side mark |
| REDIS-06 | Redis may cache hot validated-thought projections only with source hashes; invalidate when canonical changes | Sec 4 (source-hash invalidation); Sec 6 (`validated_thought_projection` is one of the 9 allowed kinds); Phase 49 lifecycle.cjs:188-191 stream paths |
| REDIS-07 | Semantic cache hits require intent + role + context policy + phase/milestone + source-hash; semantic similarity alone never injects context | Sec 5 (semantic cache key construction); Lock 11 binding (REQUIREMENTS.md:64-66) |
| REDIS-08 | Every Redis key has schema, kind, TTL/retention, canonical refs, source-hash; forbidden kinds rejected | Sec 6 (key metadata schema); Sec 10 (poisoned-key rejection at every read) |
| REDIS-09 | Redis streams may drive cockpit/progress views; cockpit degrades to canonical files when Redis flushed/absent | Sec 1.4 (event stream); Sec 8 (FLUSHDB recovery); Sec 11.cockpit (Phase 50 stays read-only) |
| REDIS-10 | Poisoned/stale Redis values rejected and logged, never injected | Sec 10 (poisoned-key defense); REDIS-LOCK-07; complaint emission pattern from Phase 46 rebuild.cjs:222-234 |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Canonical truth (decisions, debt, capsules, evidence) | Filesystem (`.planning/` + git) | SQLite Phase 46 projection | REDIS-LOCK-01: Redis is NEVER canonical. Redis is forbidden from owning these kinds. |
| Hot cache lookups (packet/semantic) | Redis (when available) | SQLite Phase 46 / `.planning/cache/context-index.db` | Redis is the speed layer; SQLite is the deterministic floor. |
| Live event stream (cockpit progress, agent retry, canary) | Redis Streams (when available) | `.planning/metrics/*.jsonl` (Phase 41 envelope-v1) | Streams give sub-second cockpit refresh; JSONL is durable + append-only. |
| Source-hash invalidation trigger | Phase 49 `memory-revocations.jsonl` writer | Phase 46 reindex on `source_hash` drift detection | Adapter subscribes to canonical change events, not the other way around. |
| Boot/readiness reporting | adapter `isAvailable()` | cockpit panel (future) | Lock 4 forbids editing cockpit-shell.cjs in this phase; adapter publishes a stable API instead. |
| F17 fixture activation | `failure-injectors.cjs` F17 byte range (lines 271-279, 891-900) | n/a | This range was specifically reserved by Plan 51-T4 for Phase 52 cross-binding. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `redis` (node-redis) | `5.12.1` (2026-04-14) | Official Node.js client maintained by Redis Inc. | Recommended by Redis vendor; modern API; supports `socket.connectTimeout`, `commandOptions.timeout`, custom `reconnectStrategy`, `xAdd`/`xRange`/`xLen` for streams, `EXPIRE`/`TTL` for hot keys. [VERIFIED: `npm view redis version` -> 5.12.1; `npm view redis time` shows 5.12.0 published 2026-04-14, 5.12.1 hotfix same day] [CITED: Context7 `/redis/node-redis`, sections "Basic Connection", "Set Command Timeout", "Custom Reconnect Strategy", "Manage Redis Streams"] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto` (Node stdlib) | n/a | sha256 of value bytes for content-hash dedup; sha256 of canonical refs for invalidation lookup keys | Every key write computes value hash for `content_hash` dedup field; every read recomputes source_hashes against canonical state. |
| `fs` (Node stdlib) | n/a | append-only `redis-projection-log.jsonl` writer | Lock 13 complaint emission pattern from Phase 46 rebuild.cjs:222-234 reused. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `redis` 5.12.1 | `ioredis` 5.10.1 | ioredis is community-maintained (Luin), has cluster/sentinel built in, slightly larger. node-redis is vendor-maintained, has stream + reconnect-strategy parity, smaller surface. node-redis wins on alignment with vendor docs (the source of the Redis-Mastering-Context-Engineering guide that motivated Phase 52). [CITED: 52-REDIS-GUIDE-DELTA.md frontmatter `source: Redis_ePub_Guide_MasteringContextEngineering_20251023.pdf`] |
| `redis` (npm dep) | no-dependency raw RESP3 socket impl | Re-implementing RESP3 + reconnect + pipeline is exactly the kind of "don't hand-roll" trap Phase 52 must avoid. Lock 4 also forbids modifying upstream phases - but here it's a deeper risk: a hand-rolled client would need its own self-test for protocol correctness. |
| Single `redis-adapter.cjs` | `super-gsd/tools/redis-projection/` directory with adapter + writers + readers | The Delta line 91-95 fixes the path: `super-gsd/tools/context-cache/redis-adapter.cjs`. Splitting into a sibling tools directory contradicts the locked path. Single-file adapter (with private helpers and an exported public API surface) is the locked choice. |

**Installation:**

```bash
npm install redis@5.12.1 --save-optional
```

The `--save-optional` flag is critical: Redis MUST be optional. If `npm
install` is run with `--no-optional`, the adapter must still load (via the
same `try { require('redis') } catch { ... degraded sentinel ... }` pattern
that Phase 46 uses for `better-sqlite3`).

**Version verification:** [VERIFIED: `npm view redis version` -> 5.12.1
2026-04-28; release timeline shows 5.12.0 -> 5.12.1 hotfix 2026-04-14;
package is actively maintained]

## Architecture Patterns

### System Architecture Diagram

```text
                           PUBLIC ADAPTER SURFACE
                           (8 APIs, all Lock-13 wrapped)
                                    |
        +---------------------------+---------------------------+
        |                           |                           |
        v                           v                           v
  isAvailable()              get/putHotPacket()          publishEvent()
  selfTest()                 get/putSemanticCache()      readEvents()
                             invalidateBySourceHash()
        |                           |                           |
        v                           v                           v
+-----------------+      +---------------------+      +--------------------+
|  CONNECTION     |      |  KEY POLICY GUARD   |      |  STREAM POLICY     |
|  GUARD          |      |  (REDIS-LOCK-02/07) |      |  GUARD             |
|  - feature flag |      |  - schema check     |      |  - LISTRIM 1000    |
|  - URL parse    |      |  - kind allowlist   |      |  - dedup by        |
|  - 50ms timeout |      |  - source_hash      |      |    content_hash    |
|  - reconnect    |      |    revalidate       |      |  - canonical_refs  |
|    strategy     |      |  - TTL on every     |      |    required        |
|                 |      |    write            |      |                    |
+-----------------+      +---------------------+      +--------------------+
        |                           |                           |
        v                           v                           v
  +---------+      hit/miss     +---------+    publish     +---------+
  |  redis  | <---------------> |  redis  | <------------> |  redis  |
  | client  |    set/get        | client  |    xAdd        | client  |
  | (5.12.1)|    EXPIRE         | (5.12.1)|    xRange      | (5.12.1)|
  +---------+                   +---------+                +---------+
        |                           |                           |
        v (on error / timeout / no client / disabled)            v
                       +---------------------+
                       |  DEGRADED SENTINEL  |
                       |  + COMPLAINT EMIT   |
                       |  + SQLite/files     |
                       |    fallback         |
                       +---------------------+
                                    |
                                    v
              +------------------------------------------+
              | Phase 46 SQLite (.planning/cache/        |
              |   context-index.db) - cache lookups       |
              | Phase 41 envelope-v1 JSONL streams        |
              |   (.planning/metrics/...) - event log    |
              | .planning/metrics/redis-projection-log    |
              |   .jsonl - degraded-state observability  |
              +------------------------------------------+

INVALIDATION INPUT FLOW (event source -> adapter):
  Phase 49 memory-revocations.jsonl ----+
  Phase 49 memory-demotions.jsonl   ----+--> invalidateBySourceHash()
  Phase 46 source_drift detection   ----+    -> DEL keys with matching
  Phase 43 phase-capsule supersedes ----+       canonical_refs
                                              -> log to projection log

CANONICAL TRUTH (NEVER WRITTEN BY ADAPTER):
  .planning/JSONL streams - written ONLY by canonical writers
  PHASE-CAPSULE.json files - written ONLY by Phase 43 write.cjs
  source_hashes / registry_version - written ONLY by Phase 44 build.cjs
  git commits - never written by the adapter
```

### Recommended Project Structure

Per the Delta lock, the entire adapter ships as ONE file:

```text
super-gsd/tools/context-cache/
+-- rebuild.cjs              # Phase 46 - SHIPPED, never edited
+-- query.cjs                # Phase 46 - SHIPPED, never edited
+-- schema.sql               # Phase 46 - SHIPPED, never edited
+-- manifest.schema.json     # Phase 46 - SHIPPED, never edited
+-- build.test.cjs           # Phase 46 - SHIPPED, never edited
+-- redis-adapter.cjs        # Phase 52 - NEW
+-- redis-adapter.test.cjs   # Phase 52 - NEW (or inline self-test)
+-- run-redis-self-test.cjs  # Phase 52 - NEW thin shell entry
```

**.planning/ owned outputs:**

```text
.planning/metrics/
+-- redis-projection-log.jsonl   # NEW - degraded-state + lifecycle events
+-- context-complaints.jsonl     # SHIPPED - APPEND-ONLY (reuse Phase 46 emitter)
```

**.gitignore additions (none needed):** the existing `node_modules/`
ignore covers the optional dep; Redis itself runs as a service or in
Docker, no ignored binary artifacts produced.

### Pattern 1: Lock-13 Wrapped Adapter API

**What:** Every public function wraps internal logic in `try/catch` and
returns a falsey/degraded sentinel on any error, never throwing upward.

**When to use:** Every one of the 8 public APIs.

**Example (mirrors Phase 46 rebuild.cjs:658-806):**

```javascript
// Source: Phase 46 rebuild.cjs lines 658-806 (Lock 13 binding)

let _redis = null;
try {
  _redis = require('redis');
} catch (_e) {
  _redis = null;
}

let _client = null;       // lazy-init connection
let _clientErr = null;    // sticky error reason

async function _getClient() {
  if (_client && _client.isOpen) return _client;
  if (!_redis) {
    _clientErr = 'redis_module_missing';
    return null;
  }
  if (!process.env.SGSD_REDIS_URL) {
    _clientErr = 'redis_disabled_no_url';
    return null;
  }
  if (process.env.SGSD_REDIS_DISABLED === '1') {
    _clientErr = 'redis_disabled_by_env';
    return null;
  }
  try {
    _client = _redis.createClient({
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
    _client.on('error', function (_err) { /* swallow per Lock 13 */ });
    await _client.connect();
    return _client;
  } catch (e) {
    _clientErr = 'redis_connect_failed:' + (e && e.message ? e.message.slice(0, 80) : 'unknown');
    return null;
  }
}

async function isAvailable(opts) {
  try {
    const c = await _getClient();
    if (!c) return { ok: false, degraded_reason: _clientErr || 'unknown', metadata: { module: !!_redis, url: !!process.env.SGSD_REDIS_URL } };
    const ping = await Promise.race([
      c.ping(),
      new Promise(function (_r, rj) { setTimeout(function () { rj(new Error('ping_timeout')); }, 50); })
    ]);
    return { ok: ping === 'PONG', degraded_reason: ping === 'PONG' ? null : 'ping_unexpected', metadata: { url: process.env.SGSD_REDIS_URL } };
  } catch (e) {
    _emitProjectionLog({ status: 'degraded', reason: 'isAvailable_threw', detail: (e && e.message) ? e.message.slice(0, 120) : 'unknown' }, opts);
    return { ok: false, degraded_reason: 'internal_error', metadata: {} };
  }
}
```

[CITED: Context7 `/redis/node-redis`, sections "Basic Connection",
"Custom Reconnect Strategy", "Set Command Timeout"]
[CITED: Phase 46 rebuild.cjs:658-806 Lock 13 binding pattern]

### Pattern 2: Source-Hash Bound Cache Read

**What:** On every read, the adapter validates that the cached value's
`source_hashes` array still matches the canonical state. Mismatch -> reject
the hit, log the stale key, return miss-equivalent sentinel so caller falls
back to canonical.

**When to use:** `getHotPacket`, `getSemanticCache`, and the read branch of
any future cache lookup.

**Example:**

```javascript
async function getHotPacket(key) {
  try {
    const c = await _getClient();
    if (!c) return { hit: false, stale: false, packet: null, reason: _clientErr || 'no_client' };
    const raw = await Promise.race([
      c.get(key),
      new Promise(function (_r, rj) { setTimeout(function () { rj(new Error('op_timeout')); }, 50); })
    ]);
    if (!raw) return { hit: false, stale: false, packet: null, reason: 'miss' };

    let val = null;
    try { val = JSON.parse(raw); }
    catch (_e) {
      // poisoned key: schema parse failed
      try { await c.del(key); } catch (_e2) {}
      _emitProjectionLog({ status: 'rejected', reason: 'poisoned_unparseable', key: key });
      return { hit: false, stale: true, packet: null, reason: 'poisoned_unparseable' };
    }

    // Schema check (REDIS-LOCK-07)
    const schemaErr = _validateRedisValueSchema(val);
    if (schemaErr) {
      try { await c.del(key); } catch (_e) {}
      _emitProjectionLog({ status: 'rejected', reason: schemaErr, key: key });
      return { hit: false, stale: true, packet: null, reason: schemaErr };
    }

    // Source-hash check (REDIS-LOCK-02): canonical_refs must still hash to source_hashes
    if (!_sourceHashesStillMatch(val.source_hashes, val.canonical_refs)) {
      try { await c.del(key); } catch (_e) {}
      _emitProjectionLog({ status: 'rejected', reason: 'source_hash_drift', key: key });
      return { hit: false, stale: true, packet: null, reason: 'source_hash_drift' };
    }

    return { hit: true, stale: false, packet: val, reason: 'hit' };
  } catch (e) {
    _emitProjectionLog({ status: 'degraded', reason: 'getHotPacket_threw', detail: (e && e.message) ? e.message.slice(0, 120) : 'unknown' });
    return { hit: false, stale: false, packet: null, reason: 'internal_error' };
  }
}
```

### Pattern 3: Stream Append with Trim

**What:** Use `XADD ... TRIM strategy=MAXLEN ~ threshold=N` to bound stream
length. Use deduplication-by-content-hash before issuing XADD.

**When to use:** `publishEvent` (Redis stream class).

**Example:**

```javascript
// Source: Context7 /redis/node-redis section "Manage Redis Streams"
// adapted for Lock 4 / Lock 13 binding

async function publishEvent(event) {
  try {
    const c = await _getClient();
    if (!c) return { ok: false, stream_id: null, reason: _clientErr || 'no_client' };
    const meta = _validateEventMetadata(event);
    if (meta.error) return { ok: false, stream_id: null, reason: meta.error };

    const fields = {
      schema_version: '1',
      kind: event.kind,
      content_hash: meta.content_hash,
      payload: JSON.stringify(event.payload),
      created_at: new Date().toISOString(),
    };

    const id = await c.xAdd(
      meta.stream_name,
      '*',
      fields,
      { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 } }
    );
    return { ok: true, stream_id: id, reason: null };
  } catch (e) {
    _emitProjectionLog({ status: 'degraded', reason: 'publishEvent_threw', detail: (e && e.message) ? e.message.slice(0, 120) : 'unknown' });
    return { ok: false, stream_id: null, reason: 'internal_error' };
  }
}
```

[CITED: Context7 `/redis/node-redis` section "Manage Redis Streams",
"Add with trimming (keep ~1000 entries)"]

### Pattern 4: F17 Fixture Activation (the ONE allowed Phase 51 byte range)

**What:** Phase 51's `failure-injectors.cjs` was specifically designed
with F17 reserved as a contract-only stub. Phase 52 activation rewrites
ONLY the F17 byte range to provide a real injector. F1..F16 are byte-frozen.

**When to use:** ONCE in this phase, in a dedicated task.

**Locked byte ranges to edit:**

```text
super-gsd/tools/context-bench/failure-injectors.cjs

Lines 271-279 (F17_STUB definition):
  - id: 'F17' (UNCHANGED)
  - label: 'phase 52 redis cross-binding (contract-only stub)'
        -> 'phase 52 redis flush + poisoned key (live)'
  - inject_point: 'phase-52.redis_adapter' (UNCHANGED)
  - expected_reason_codes: []
        -> ['source_hash_drift', 'poisoned_unparseable',
            'redis_flushdb_recovered_via_sqlite']
  - evidence_path: null
        -> '.planning/metrics/redis-projection-log.jsonl'
  - applies_to_scenarios: []
        -> ['S1-v17-P32', 'S2-v18-P36']
  - soft_skip_when: 'phase_52_redis_adapter_not_shipped'
        -> null

Lines 891-900 (_F17 factory body):
  Replace contract-only stub with real injector that:
  1. snapshot()  - capture .planning/cache/redis-projection-log.jsonl byte
                   length (or 0 if absent)
  2. inject()    - require('../context-cache/redis-adapter.cjs') and
                   call _testHook_simulateFlushAndPoison() (a new
                   internal export added in this phase)
  3. observe()   - read the new tail of redis-projection-log.jsonl and
                   verify expected_reason_codes are present
  4. restore()   - delete any test keys; truncate the projection log
                   back to snapshot length

Lock 4 binding: NO OTHER bytes in failure-injectors.cjs change. The
INJECTION_FIXTURES Object.freeze on lines 81-263 stays byte-identical;
the FIXTURE_FACTORIES map on lines 907-913 keeps its existing F17 entry
pointing at the rewritten _F17 body.

The frozen 16-entry contract (F1..F16) is therefore preserved. F17 was
always outside the array (it was appended via fall-through at line 947).
```

[CITED: super-gsd/tools/context-bench/failure-injectors.cjs lines 4
"16-fixture failure injection catalog (F1..F16) + F17 stub"; 68-79
"Closed-vocab fixture catalog. 16 entries"; 271-279 F17_STUB; 891-900
_F17 factory; 947 lookup fall-through]

### Anti-Patterns to Avoid

- **Editing Phase 41-51 tool trees beyond the F17 byte range.** Lock 4
  binding (mass-discuss + REQUIREMENTS.md non-negotiable). The cockpit
  shell, Phase 49 lifecycle.cjs, Phase 46 rebuild.cjs, Phase 51 harness.cjs,
  Phase 51 INJECTION_FIXTURES, Phase 51 BENCHMARK-REPORT template, and
  Phase 45 packet builder are ALL git-diff-quiet across this phase.
- **Throwing from any public adapter API.** Lock 13 binding. Every error
  path returns a sentinel.
- **Fetching value via semantic similarity / embedding cosine.** Lock 11
  binding (REQUIREMENTS.md non-negotiable #11) + REDIS-LOCK-03. Cache hits
  are EXACT-MATCH on the composite key only.
- **Writing to Redis without a TTL or stream-retention policy.** Lock 4
  REDIS-LOCK-04 + key inventory validator rejects un-TTL'd keys.
- **Allowing forbidden key kinds.** REDIS-LOCK-01 + the allow/deny lists
  in 52-REDIS-GUIDE-DELTA.md sec "Redis Key Kinds".
- **Synchronous Redis I/O.** All operations async; every op gates on a
  50ms `setTimeout`-backed race so connection-pool exhaustion can't pin
  the event loop.
- **Direct edits to `.planning/cache/context-index.db` or canonical JSONL
  streams.** Phase 52 NEVER writes any file the canonical writers own.
  The single new owned write is `redis-projection-log.jsonl` (degraded
  observability, append-only, mirrors Phase 41 envelope-v1 schema).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Redis protocol implementation | Hand-rolled RESP3 socket parser | `redis` 5.12.1 npm | Vendor-maintained; covers RESP3, pipelining, reconnect, command queueing. |
| Reconnect with backoff | Custom retry loop | `socket.reconnectStrategy` callback | Built-in exponential + jitter; handles socket timeout differentiation. |
| Stream trim | Manual XLEN-then-XDEL | `xAdd(..., { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 }})` | Approximate trim is O(1) amortized; manual is O(n). |
| Connection pool | Custom queue + lock | `createClientPool({minimum, maximum, acquireTimeout, cleanupDelay})` | Handles blocking commands without blocking other ops. (Optional - single client is fine for v1.9 since SGSD is single-process.) |
| Schema validation on read | Bespoke type-checks | A small `_validateRedisValueSchema()` helper that mirrors the closed-enum approach Phase 46 uses for `KIND_VOCAB` (rebuild.cjs:97-103) | Closed-vocab discipline already proven in 11 phases; reuse. |
| Source-hash recompute | Bespoke walker | Reuse Phase 46's `_sha256OfFile()` helper by reference (rebuild.cjs:192-199) | Lock 4 says don't fork. Use rebuild.cjs's exported helpers if exported, or replicate the 8-line implementation locally as a stable contract (the function is pure and trivially mirrored). |
| Projection log emitter | Custom envelope | Mirror Phase 46 `_emitContextIndexComplaint` pattern (rebuild.cjs:222-234) but emit to `redis-projection-log.jsonl` | Same envelope-v1 schema = single dashboard reader. |
| Stale-hit detection | Bespoke ledger | Subscribe to `memory-revocations.jsonl` mtime + tail-read for new rows | Phase 49 already writes these; the adapter's invalidation hook is just a pull-based reader. No coupling to Phase 49 writer code. |

**Key insight:** Phase 52 is 95% glue + 5% new logic. The new logic lives
in (a) the source-hash revalidation function, (b) the schema validator,
(c) the F17 activation. Everything else is delegation to `redis` 5.12.1
APIs and Phase 46 patterns. If a task is doing more than glue, re-read
Lock 4.

## Runtime State Inventory

> Phase 52 is a NEW adapter. No rename / refactor / migration. This
> section is INCLUDED because we are modifying one byte-range inside an
> existing shipped Phase 51 file (the F17 stub) and adding a new
> dependency to package.json - both have runtime ramifications.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | (1) Existing `.planning/cache/context-index.db` - Phase 46 SQLite. NOT touched by Phase 52. (2) NEW Redis keyspace (when SGSD_REDIS_URL is set) under any prefix the operator chooses - convention proposed: `sgsd:v19:<kind>:<intent_id>:<role>`. | None for (1). For (2): document the prefix convention + provide a `--purge-prefix` CLI verb on the adapter for ops cleanup; the FLUSHDB acceptance test covers the full-database wipe. |
| Live service config | (1) `SGSD_REDIS_URL` env var (NEW) - operator-supplied, not in git. (2) `SGSD_REDIS_DISABLED` env var (already referenced by Phase 51 F5 fixture; line 640). (3) Optional `SGSD_REDIS_TIMEOUT_MS` (NEW, default 50). | (1) Document in adapter banner; surface in cockpit `isAvailable()` reporting (read-side only - Phase 50 stays Lock-4-quiet). (2) The adapter MUST honor `SGSD_REDIS_DISABLED=1` and treat it as "no client" without attempting connect. (3) Document default + clamp to [1, 5000]. |
| OS-registered state | None - no Windows Task Scheduler, pm2, systemd entries are added or modified. Redis itself runs as the operator's choice (Docker, native install, hosted) but registration is operator scope, not SGSD. | None. |
| Secrets / env vars | `SGSD_REDIS_URL` MAY contain a password component (e.g. `redis://default:<pwd>@host:6379`). The adapter MUST NOT log the URL with credentials. | Use `_redactRedisUrl()` helper that strips the user-info portion before any log/error message. Self-test asserts no credential leak in projection log. |
| Build artifacts / installed packages | (1) `node_modules/redis/` (NEW - optional dep). (2) Modified `package.json` `optionalDependencies` block (NEW). (3) Modified `package-lock.json`. | (1) `node_modules/` is already gitignored. (2) Add `optionalDependencies: { "redis": "^5.12.1" }`. (3) `package-lock.json` is normally committed in this repo - check before commit; if absent today, leave absent. |

**Nothing found in Phase 41-50 trees that needs runtime data migration:**
verified by file-system audit. Canonical .planning/JSONL streams
(memory-revocations, memory-demotions, agent-token-spend, etc.) are
read-only inputs to the adapter.

## Common Pitfalls

### Pitfall 1: Allowing the adapter to log credentials in degraded reasons

**What goes wrong:** A timeout error message includes the connection URL
("connection to redis://user:password@host:6379 timed out") and the
adapter writes that string to `redis-projection-log.jsonl`. Credential
appears in git history if the file is ever committed (it shouldn't be,
but `.planning/metrics/` is partially git-tracked).

**Why it happens:** node-redis bubbles up the URL in error messages by
default; `Error.message` contains the configured URL on connect failure.

**How to avoid:** Wrap every error message in `_redactRedisUrl()` before
logging. The function: regex `:[^@:/]*@` -> `:***@`. Self-test asserts
no log line contains `:***@` literal AND no log line contains a string
matching `://[^:]+:[^@]+@`.

**Warning signs:** A grep over `redis-projection-log.jsonl` returns any
line containing `://` followed by `:` followed by `@`.

### Pitfall 2: Allowing semantic cache hits where one of the 5 key components mismatches

**What goes wrong:** A semantic cache hit returns the cached value when
`intent_id` matches, but `role` or `phase` or `policy` or `source_hashes`
differs - the wrong agent receives the wrong packet. Lock 11 violation,
silent context bloat, possible privacy leak (e.g. researcher gets
executor-scoped data).

**Why it happens:** Naive key constructed from `hash(intent_id)` only.
Operator runs the same intent twice across roles and the second hit
serves the first role's data.

**How to avoid:** Compose the key from ALL 5 components in a fixed,
documented order, joined by a delimiter that cannot appear in any
component (recommend `:`):

```text
key = "sgsd:v19:semantic:" + sha256(
  intent_id_normalized + ":" + role + ":" + phase + ":" + milestone +
  ":" + JSON.stringify(context_policy) + ":" +
  source_hashes.slice().sort().join(",")
)
```

The composite hash is the cache key. ANY change to ANY input -> different
key -> miss. No partial-match path exists.

**Warning signs:** A self-test where two different roles for the same
intent_id produce the same Redis key, OR where reordering source_hashes
inputs produces a different key (the `.sort()` prevents this).

### Pitfall 3: TTL too aggressive (cache thrash) or too lax (stale serves)

**What goes wrong:** TTL of 30s on hot packets means every cockpit
refresh misses (cache thrash). TTL of 24h on semantic cache means a
revoked memory row still gets served for hours after canonical change.

**Why it happens:** No documented per-class default; each call site
guesses.

**How to avoid:** Document defaults per kind with reasoning. Recommended:

| Kind | TTL | Reasoning |
|------|-----|-----------|
| `cockpit_snapshot` | 60s | Cockpit refreshes every 10s; 60s gives 6x amortization without serving stale governance data. |
| `active_agent_marker` | 90s | Heartbeat-style; 90s tolerates one missed heartbeat before fall-through. |
| `session_checkpoint_marker` | 600s | Operator session can pause-resume across 10 minutes without losing the marker. |
| `provider_health_cache` | 120s | Provider canary results stay relevant for ~2 minutes; longer risks stale "Codex green" reports. |
| `hot_context_packet` | 300s | 5-minute window covers a typical phase-execute burst of ~3-10 dispatches. |
| `semantic_cache` | 3600s | 1 hour is the longest-lived class; protected by source-hash revalidation on EVERY read. |
| `validated_thought_projection` | 1800s | Mid-tier; protected by source-hash revalidation. |
| `agent_event_stream` | n/a (LISTRIM 1000) | Streams use retention not TTL. |
| `short_lived_counter` | 30s | Counters are by definition short-lived. |

The semantic cache is the only kind with a long TTL because source-hash
revalidation on every read makes TTL a backup, not the primary safety
mechanism.

**Warning signs:** Cockpit refresh shows the same 60s-old data twice in
a row (TTL too long for cockpit_snapshot). OR provider canary cache
shows a Codex outage 5 minutes after Codex is back (TTL too long for
provider_health_cache).

### Pitfall 4: Connection pool exhaustion blocks the event loop

**What goes wrong:** A burst of cache calls saturates the connection
pool. Subsequent calls await acquisition; if the Redis server itself is
slow, the await blocks. Phase 52 is supposed to be SPEED layer; instead
it's making things slower.

**Why it happens:** Single client used naively; `createClient()` returns
a single command queue. Under burst, commands queue and block.

**How to avoid:** (Option A) Single client + Promise.race timeout on
every command (50ms default) - if the queue blocks, the timeout fires
and we degrade to fallback path. (Option B) Use `createClientPool()` from
node-redis (Context7 doc, "Create Redis Connection Pool"). Recommended:
Option A for v1.9 (simpler, lower failure surface); reserve Option B for
a future milestone if benchmark shows pool saturation.

**Warning signs:** Adapter `isAvailable()` shows `ok: true` but
`getHotPacket` consistently returns `reason: 'op_timeout'` under load.
Mitigation: drop to fallback path on timeout - canonical state ALWAYS
serves correctly even if slowly.

### Pitfall 5: Adapter writes to canonical JSONL streams

**What goes wrong:** The adapter, on degraded path, decides to "preserve
the cached value" by writing it to `.planning/metrics/agent-token-spend.jsonl`
or similar. Now Redis has effectively become the upstream of canonical
truth. REDIS-LOCK-01 violated, milestone hard stop.

**Why it happens:** A naive read-through pattern: Redis -> SQLite ->
local file. The adapter author thinks "if Redis has it but SQLite
doesn't, write it to SQLite/JSONL." That's wrong - Redis is downstream,
not upstream.

**How to avoid:** The adapter has exactly TWO owned write paths:
(1) Redis itself (any key kind in the allowlist), (2)
`.planning/metrics/redis-projection-log.jsonl` (degraded events). NO
other file is ever written. Self-test fingerprints the 13 canonical
metric streams + all phase-folder content before/after every test and
asserts byte-zero drift (mirror of Phase 51 anti-pollution test).

**Warning signs:** A self-test fixture where `getHotPacket` returns a
hit and somehow `.planning/metrics/agent-token-spend.jsonl` size
increases. That's a write-amplification bug.

### Pitfall 6: F17 activation bleeds into other fixtures

**What goes wrong:** While editing F17 in `failure-injectors.cjs`, an
import path or shared helper is changed that subtly alters F1..F16
behavior. F1..F16 self-tests still pass on the local machine but a CI
fingerprint test fails because the byte-stream produced under
F1..F16 has shifted.

**Why it happens:** The F17 _F17 factory adds a `require()` for the
new redis-adapter, and that require has side effects (e.g. loading the
optional `redis` module).

**How to avoid:** (a) The redis-adapter `require()` is LAZY - inside
the F17 factory's `inject()`, not at file top. (b) F17's
`_testHook_simulateFlushAndPoison()` is a NEW exported function on
redis-adapter that has zero side effects when the module is merely
loaded. (c) The Phase 51 self-test bootstrap-byte fingerprint (16
INJECTION_FIXTURES outer freeze + per-entry freeze) is re-run
post-F17-edit and asserted byte-equal.

**Warning signs:** Phase 51 `node super-gsd/tools/context-bench/run-self-test.cjs`
exit code differs after the F17 edit when run with no Redis available.

## Code Examples

### Example 1: Hot-packet put with full metadata

```javascript
// Source: 52-REDIS-GUIDE-DELTA.md "Metadata Required On Context-Influencing Values"
// Adapted for Lock 13 + Lock 4 + node-redis 5.12.1 idioms.

async function putHotPacket(key, packet, metadata) {
  try {
    const c = await _getClient();
    if (!c) return { ok: false, key: null, ttl_seconds: 0 };

    // Reject forbidden kinds (REDIS-LOCK-01)
    if (FORBIDDEN_KINDS.has(metadata.kind)) {
      _emitProjectionLog({ status: 'rejected', reason: 'forbidden_kind', kind: metadata.kind });
      return { ok: false, key: null, ttl_seconds: 0 };
    }
    if (!ALLOWED_KINDS.has(metadata.kind)) {
      _emitProjectionLog({ status: 'rejected', reason: 'unknown_kind', kind: metadata.kind });
      return { ok: false, key: null, ttl_seconds: 0 };
    }

    const ttl = TTL_BY_KIND[metadata.kind] || 300;
    const value = {
      schema_version: 1,
      kind: metadata.kind,
      milestone: metadata.milestone,
      phase: String(metadata.phase),
      role: metadata.role || null,
      intent_id: metadata.intent_id || null,
      source_hashes: (metadata.source_hashes || []).slice().sort(),
      registry_hash: metadata.registry_hash,
      canonical_refs: metadata.canonical_refs || [],
      created_at: new Date().toISOString(),
      ttl_seconds: ttl,
      content_hash: _sha256OfString(JSON.stringify(packet)),
      packet: packet,
    };

    await c.set(key, JSON.stringify(value), { EX: ttl });
    return { ok: true, key: key, ttl_seconds: ttl };
  } catch (e) {
    _emitProjectionLog({ status: 'degraded', reason: 'putHotPacket_threw' });
    return { ok: false, key: null, ttl_seconds: 0 };
  }
}
```

### Example 2: Invalidation by source hash

```javascript
// Source: REDIS-LOCK-02 binding; Phase 49 lifecycle.cjs:447 source-hash drift signature

async function invalidateBySourceHash(sourceHash) {
  try {
    const c = await _getClient();
    if (!c) return { ok: false, count: 0 };

    // Use SCAN (not KEYS - O(n) blocking). Redis client supports async iter.
    let count = 0;
    for await (const key of c.scanIterator({ MATCH: 'sgsd:v19:*', COUNT: 200 })) {
      try {
        const raw = await c.get(key);
        if (!raw) continue;
        const val = JSON.parse(raw);
        if (Array.isArray(val.source_hashes) && val.source_hashes.includes(sourceHash)) {
          await c.del(key);
          count++;
          _emitProjectionLog({ status: 'invalidated', reason: 'source_hash_drift', key: key });
        }
      } catch (_e) { /* skip poisoned entries silently; they expire by TTL */ }
    }
    return { ok: true, count: count };
  } catch (e) {
    _emitProjectionLog({ status: 'degraded', reason: 'invalidateBySourceHash_threw' });
    return { ok: false, count: 0 };
  }
}
```

### Example 3: Self-test entry shape

```javascript
// Mirrors Phase 46 build.test.cjs runAll/formatSummary contract;
// run-redis-self-test.cjs is a thin shell mirroring run-self-test.cjs
// (Phase 51 lines 1-52).

function selfTest() {
  const results = [];

  // Group A: connection guard
  results.push(_t('A1', 'isAvailable returns degraded when redis module missing', _a1));
  results.push(_t('A2', 'isAvailable returns degraded when SGSD_REDIS_URL absent', _a2));
  results.push(_t('A3', 'isAvailable returns degraded when SGSD_REDIS_DISABLED=1', _a3));

  // Group B: key policy
  results.push(_t('B1', 'putHotPacket rejects forbidden kind (decision)', _b1));
  results.push(_t('B2', 'putHotPacket rejects unknown kind', _b2));
  results.push(_t('B3', 'every put includes TTL', _b3));

  // Group C: source-hash invalidation (live Redis OR mock)
  results.push(_t('C1', 'getHotPacket rejects on source_hash mismatch', _c1));
  results.push(_t('C2', 'invalidateBySourceHash deletes matching keys', _c2));

  // Group D: semantic cache key composition
  results.push(_t('D1', 'two different roles -> two different keys', _d1));
  results.push(_t('D2', 'reordered source_hashes inputs -> same key (sort invariance)', _d2));

  // Group E: poisoned-key defense
  results.push(_t('E1', 'getHotPacket on unparseable JSON deletes key + logs', _e1));
  results.push(_t('E2', 'getHotPacket on schema-invalid value deletes + logs', _e2));

  // Group F: FLUSHDB safety (live Redis only; soft-skip otherwise)
  results.push(_t('F1', 'FLUSHDB then getHotPacket returns miss; canonical files untouched', _f1));

  // Group G: Lock 13 + redaction
  results.push(_t('G1', 'no API throws under any error path', _g1));
  results.push(_t('G2', 'projection log never contains URL credentials', _g2));

  // Group H: F17 cross-binding (skipped here; covered by Phase 51 harness)
  results.push(_t('H1', 'redis-adapter exports _testHook_simulateFlushAndPoison', _h1));

  const pass = results.filter(function (r) { return r.ok; }).length;
  return { pass: pass, fail: results.length - pass, total: results.length, results: results };
}
```

Target: 15-20 assertions. Above sketch: 16. Mirrors Phase 46 (33),
Phase 49 (60+), Phase 51 (33) self-test sizing discipline.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node-redis` v3 callback-based | `redis` v4+ promise-based + RESP3 + scanIterator | 2022 -> v4.0; v5 in 2024 | Modern code uses `await c.get(key)` and `for await (const key of c.scanIterator(...))`. The Phase 52 adapter targets v5.12.1. |
| `KEYS *` (blocking, O(n)) | `SCAN` / `scanIterator` (non-blocking, cursor-based) | Standard since Redis 2.8 | Required for the `invalidateBySourceHash` enumeration. KEYS would block the entire Redis server. |
| Manual XLEN+XDEL trim | `XADD ... TRIM strategy=MAXLEN ~ threshold=1000` | Redis 6.2+ | Approximate-trim is O(1) amortized vs O(n). |
| Ad-hoc retry loops | `socket.reconnectStrategy` callback | node-redis v4+ | Built-in handles socket-timeout differentiation, exponential + jitter. |

**Deprecated/outdated:**

- **`hiredis` parser:** still works but no longer required; v5 ships its
  own RESP3 parser. Don't add as a dep.
- **callback API (v3):** no longer the primary API. All v5 code is
  promise-based.
- **`client.duplicate()` for stream consumers:** still supported but the
  recommended path for blocking commands is `createClientPool()` with
  `pool.execute()`. Phase 52 doesn't use blocking commands so this is
  N/A for v1.9.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Operator will install Redis as a separate ops concern; SGSD does not own provisioning | Sec 9 / 11.adapter | LOW. If wrong, the adapter still works without Redis (degraded path). |
| A2 | `optionalDependencies` is the right install vector (vs `dependencies` or `peerDependencies`) | Sec 5 / install | LOW. If `optionalDependencies` is wrong, the install command is the only thing to change. The Lock 13 try/require already accommodates absent module. |
| A3 | F17 byte range was specifically reserved for Phase 52 by Plan 51-T4 | Sec 11 / Pattern 4 | NONE. [VERIFIED: failure-injectors.cjs line 21-23, 266-279, 891-900 all explicitly reference "Phase 52 cross-binding" / "phase_52_redis_adapter_not_shipped"] |
| A4 | `node-redis` 5.12.1 is the right client choice over `ioredis` 5.10.1 | Sec 5 alternatives | LOW. Switching cost is small (similar API surface). The adapter's public surface is library-agnostic. |
| A5 | TTL defaults (60s/90s/300s/3600s/etc.) are sensible first-pass | Pitfall 3 | MEDIUM. If the cockpit refresh interval changes or operator workflow differs, defaults need tuning. Mitigation: TTLs are tunable per-kind via env or config. |
| A6 | Redis is single-node only for v1.9 (no Cluster / Sentinel) | Deferred Ideas | NONE. Explicitly deferred in CONTEXT scope. |
| A7 | Phase 50 cockpit-shell.cjs will NOT be modified in this phase (Lock 4) | Sec 11 / Architecture map | NONE. [VERIFIED: file is in Phase 50 tree; mass-discuss says "v1.9 (NEW SGSD-Research, 41-52) ... All auto-defaulted from handover packet"; Lock 4 binds]. The adapter exposes a stable read-side; cockpit consumption is deferred to a future milestone. |
| A8 | The `redis-projection-log.jsonl` envelope-v1 schema mirrors Phase 41 envelope | Sec 5 / Pattern 1 | LOW. If schema diverges, dashboard reading code (none yet) gets a small refactor. |
| A9 | 50ms command timeout is tight enough to never block but loose enough to land most hot-cache reads | Pitfall 4 / Pattern 1 | MEDIUM. If actual Redis latency exceeds 50ms in a deployment, all calls degrade. Mitigation: env-tunable `SGSD_REDIS_TIMEOUT_MS`. |
| A10 | `package-lock.json` commit policy in this repo: TBD | Runtime State Inventory | NONE. Operator can decide on the install task. |

**Resolution notes:**
- A3, A6, A7 verified against repo state.
- A1, A2, A8, A10 are conservative assumptions; planner should confirm with
  operator before locking.
- A4 is a discretion call; recommendation is `redis` 5.12.1 but ioredis
  is acceptable.
- A5, A9 are tunable; defaults are first-pass.

## Open Questions

1. **Should the adapter ship a Docker compose snippet for local Redis dev?**
   - What we know: Redis is optional; degraded path exists; CONTEXT.md
     says "Redis absence must degrade to SQLite/local files".
   - What's unclear: developer ergonomics. Operator may want a one-line
     `docker compose up redis` for local benchmarking.
   - Recommendation: Add `super-gsd/tools/context-cache/docker-compose.redis.yml`
     (NEW, 10 lines, single redis:7 image, no volumes, port 6379) and document
     in adapter banner. Cost: ~10 lines + 1 paragraph. Benefit: F17 fixture
     becomes runnable on dev machine without external setup.

2. **Should the adapter expose a `--health` CLI verb for ops (mirroring
   Phase 46 `--status`)?**
   - What we know: Phase 46 ships `--status`, `--rebuild`, `--drop-and-rebuild`,
     `--self-test` CLI verbs (rebuild.cjs:1019-1062).
   - What's unclear: whether adapter needs CLI parity.
   - Recommendation: Yes. Verbs: `--probe` (fast isAvailable), `--purge-prefix`
     (ops cleanup), `--self-test` (matches Phase 51 contract). Total ~30
     lines of arg-parsing.

3. **F17 fixture activation: are the 3 expected_reason_codes sufficient?**
   - What we know: F17_STUB currently has `expected_reason_codes: []`.
     Phase 52 must populate it.
   - What's unclear: which subset of adapter reason codes the harness
     should fingerprint.
   - Recommendation (locked here for the planner): exactly 3:
     `source_hash_drift`, `poisoned_unparseable`,
     `redis_flushdb_recovered_via_sqlite`. These are the three behaviors
     CONTEXT.md "Required Failure Contract" calls out as cross-binding
     to Phase 51.

4. **Does the F17 inject_point need to reach into the live adapter's
   internal state, or simulate via a public test hook?**
   - What we know: Phase 51 fixtures use one of: temp-dir mirror (F1, F2, F4, F8),
     env-var flip (F5, F6, F7), or synthetic input to a public API
     (F3, F9, F10, F11). All three preserve Lock 4.
   - What's unclear: which strategy F17 should use.
   - Recommendation: synthetic input to a NEW public API named
     `_testHook_simulateFlushAndPoison(opts)`. Underscore prefix marks
     it test-only; the function deliberately writes a poisoned key, then
     issues FLUSHDB, then asserts cache reads degrade to SQLite. Mirrors
     F11's "synthetic input to a public API" strategy.

5. **Should `redis-projection-log.jsonl` be git-tracked or gitignored?**
   - What we know: `.planning/metrics/heartbeat.jsonl` is gitignored
     (line 11 of .gitignore). Other metric streams (token-attribution,
     context-bench-runs, route-decisions) are git-tracked.
   - What's unclear: which category the projection log belongs to.
   - Recommendation: TRACK (mirrors token-attribution discipline). The
     log is small (one row per degraded event), append-only, and useful
     in git history for debugging. Heartbeat is gitignored because it
     emits per-second; this log emits per-degradation only.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | adapter runtime | (assumed yes) | >= 22 (per package.json `engines.node`) | none - hard requirement of repo |
| `redis` npm package | adapter Redis path | needs `npm install` | 5.12.1 (target) | If missing -> `try { require('redis') } catch ... ` returns degraded |
| `better-sqlite3` | Phase 46 fallback path | yes (in `dependencies`) | ^12.9.0 | already in package.json |
| Redis server | live cache path | NOT INSTALLED on dev machine | n/a | If missing -> degraded; SQLite + .planning files serve every read |
| Docker (for local Redis dev) | optional convenience | check `docker info` | n/a | Document `redis-server` native install as alternative |
| `bash` shell | self-test entry script (run-redis-self-test.cjs) | yes (the env section confirms bash + Windows) | n/a | thin Node script avoids shell deps |

**Missing dependencies with no fallback:** none. Redis itself is optional;
that's the whole point of the phase.

**Missing dependencies with fallback:**

- **`redis` npm package not installed:** adapter's connection guard
  catches the `require('redis')` failure and every public API returns a
  degraded sentinel. Tests run with `pass: 16, fail: 0` since live-Redis
  tests soft-skip.
- **Redis server unreachable:** same effect via `_getClient()` timeout
  on `await client.connect()`. Self-test soft-skips groups F (FLUSHDB)
  and parts of C (live invalidation), still asserts groups A, B, D, E,
  G fully.

**Operator setup (to enable live Redis path):**

```bash
# Option 1: Docker (recommended for dev)
docker run -d --name sgsd-redis -p 6379:6379 redis:7-alpine
export SGSD_REDIS_URL=redis://localhost:6379
node super-gsd/tools/context-cache/run-redis-self-test.cjs
# Expect: 16/16 PASS

# Option 2: Native install (Mac/Linux)
brew install redis  # or apt install redis-server
redis-server &
export SGSD_REDIS_URL=redis://localhost:6379
node super-gsd/tools/context-cache/run-redis-self-test.cjs

# Option 3: Disable explicitly (CI without Redis)
export SGSD_REDIS_DISABLED=1
node super-gsd/tools/context-cache/run-redis-self-test.cjs
# Expect: 16 total, A/B/D/E/G groups PASS, F group SOFT-SKIPPED
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Native Node assert (mirror Phase 46 build.test.cjs / Phase 51 harness.cjs) |
| Config file | none - test discovery is by convention (file with `runAll()` export) |
| Quick run command | `node super-gsd/tools/context-cache/run-redis-self-test.cjs` |
| Full suite command | `node super-gsd/tools/context-cache/run-redis-self-test.cjs && node super-gsd/tools/context-bench/run-self-test.cjs` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REDIS-01 | adapter file exists at locked path | smoke | `test -f super-gsd/tools/context-cache/redis-adapter.cjs` | Wave 0 |
| REDIS-02 | adapter rejects 7 forbidden kinds | unit | `node run-redis-self-test.cjs` group B | Wave 0 |
| REDIS-03 | FLUSHDB does not touch canonical files | integration | group F1 (live Redis); soft-skip + manual evidence row when no Redis | Wave 0 |
| REDIS-04 | every public API returns degraded sentinel when client absent | unit | group A (3 assertions) | Wave 0 |
| REDIS-05 | `isAvailable()` reports optional/degraded never required | unit | group A1 (assert `ok: false` when module missing, no exception) | Wave 0 |
| REDIS-06 | hot validated-thought projection invalidates on source-hash change | unit | group C1 (mock `_sourceHashesStillMatch` returns false; assert miss) | Wave 0 |
| REDIS-07 | semantic cache requires all 5 components | unit | group D1, D2 (key composition + sort invariance) | Wave 0 |
| REDIS-08 | every key has schema + kind + TTL + canonical refs + source_hash | unit | group B3 (assert TTL on every put; group E2 asserts schema reject) | Wave 0 |
| REDIS-09 | streams drive cockpit; cockpit degrades to files when absent | integration | F17 fixture in Phase 51 harness (cross-binding) | Wave 0 |
| REDIS-10 | poisoned/stale rejected and logged | unit | group E1 (unparseable), E2 (schema-invalid), C1 (source-hash drift) | Wave 0 |
| Lock 4  | Phase 41-51 trees git-diff-quiet (except F17 byte range) | smoke | `git diff --name-only HEAD super-gsd/tools/{token-attribution,token-waste,phase-capsule,context-registry,context-packet,context-cache,dispatch-router,vtp-bridge,memory-governance} | wc -l` -> 0 | Wave 0 |
| Lock 11 | no semantic similarity in cache | unit | group D2 explicit; absence of any embedding/cosine call (grep self-test) | Wave 0 |
| Lock 13 | never throws | unit | group G1 - drive every API with bogus inputs, assert no exception | Wave 0 |
| Credential redaction | URL never appears in projection log | unit | group G2 - inject `redis://user:secret@host` URL, assert log line lacks `:secret@` | Wave 0 |

### Sampling Rate

- **Per task commit:** `node super-gsd/tools/context-cache/run-redis-self-test.cjs`
  (~16 assertions, target 200ms with no Redis, ~1s with Redis)
- **Per wave merge:** quick + Phase 51 `run-self-test.cjs`
  (~33 + 16 = ~49 assertions; F17 path activated)
- **Phase gate:** full suite green + Phase 46 `--self-test` green
  + Phase 49 self-test green (regression catch on shared canonical state)
  before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `super-gsd/tools/context-cache/redis-adapter.cjs` - main module (NEW)
- [ ] `super-gsd/tools/context-cache/redis-adapter.test.cjs` - assertion
  groups A-H (NEW; 16 assertions; mirrors Phase 46 build.test.cjs runAll
  + formatSummary contract)
- [ ] `super-gsd/tools/context-cache/run-redis-self-test.cjs` - thin
  shell entry (NEW; ~50 lines; mirrors Phase 51 run-self-test.cjs:1-52
  pattern verbatim)
- [ ] F17 byte-range edit in
  `super-gsd/tools/context-bench/failure-injectors.cjs` lines 271-279,
  891-900 ONLY (the rest is byte-frozen by Lock 4)
- [ ] `package.json` `optionalDependencies` block (NEW)
- [ ] `.planning/metrics/redis-projection-log.jsonl` - first row written
  by self-test (NEW; envelope-v1 schema mirrors Phase 41)
- [ ] `super-gsd/tools/context-cache/docker-compose.redis.yml` - dev
  convenience (OPTIONAL per Open Question 1; recommended)

*(Existing test infrastructure: Phase 46 build.test.cjs, Phase 49
lifecycle internal `_runSelfTest`, Phase 51 harness.cjs `--self-test`
all stay byte-frozen and continue to pass post-F17-edit.)*

## Security Domain

> security_enforcement default = enabled. ASVS categories applicable to
> a cache adapter:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | Operator-supplied REDIS_URL with optional `:password@` user-info; adapter never logs the credential portion. |
| V3 Session Management | no | No SGSD session is stored in Redis; Redis sessions are an internal Redis concept with no SGSD coupling. |
| V4 Access Control | yes | Allowlist on key kinds (REDIS-LOCK-01); denylist on forbidden canonical-truth kinds; key namespace prefix `sgsd:v19:` so a shared Redis cannot be cross-contaminated. |
| V5 Input Validation | yes | Schema validation on every read (REDIS-LOCK-07); closed-vocab key kinds; sha256 source_hash byte-equality on every revalidation. |
| V6 Cryptography | yes | sha256 only; no homemade crypto. |
| V7 Errors / Logging | yes | Lock 13 sentinel returns; redacted projection log; envelope-v1. |
| V14 Configuration | yes | `optionalDependencies`; env-var-driven; no secret committed; `.gitignore` already covers `.env`. |

### Known Threat Patterns for {redis-adapter stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cache poisoning (attacker writes a value with valid schema but bad payload) | Tampering | source_hash revalidation on every read; canonical state check; reject + log + delete poisoned key |
| Cache key prediction (attacker computes valid key + writes value) | Tampering | source_hashes are sha256 of canonical files attacker cannot modify; key alone is not enough to inject a packet |
| Credential leak via error message | Information disclosure | `_redactRedisUrl()` on every log path; self-test G2 |
| Connection-pool DoS | Denial of service | 50ms command timeout; degraded sentinel; SQLite fallback always serves |
| Forbidden-kind smuggling (attacker tries to put `decision` kind) | Tampering | Allowlist + denylist; closed-vocab; reject + log |
| Stale-hit replay (TTL-expired data still served) | Tampering | TTL on every key; source-hash revalidation backstop |
| Race between FLUSHDB and a hot put (write succeeds; read sees flush) | Timing | Idempotent hot path; canonical state always serves; degraded-OK by design |
| Prompt injection in cached packet payload | Tampering | The adapter does not interpret packet payloads; downstream consumers (Phase 45 buildPacket) treat fenced source as data. Redis is just a key-value store; the prompt-injection defense lives in Phase 45 (Lock 12). |
| Operator runs adapter against a Redis used for non-SGSD data | Cross-site / data leakage | Namespace prefix `sgsd:v19:` on every key; SCAN with MATCH `sgsd:v19:*` filter on every enumeration |

## Project Constraints (from CLAUDE.md)

The repo's CLAUDE.md is the SGSD orchestrator config. Constraints relevant
to Phase 52:

- **Lock 4 binding:** Phase 41-51 tool trees are byte-frozen except for
  the F17 byte range. The orchestrator + plan-checker WILL run
  `git diff` against these paths.
- **Token efficiency:** the planner should compress task context (~800
  tokens per task plan); avoid duplicating this RESEARCH file in plans.
- **Commit discipline:** `feat(52-XX): one-liner` after every unit; never
  batch; never amend; specific files staged.
- **Auto mode:** sub-agents include `mode: "bypassPermissions"`; never
  ask for confirmation on optional file writes.
- **Lock 13 binding (CLAUDE.md sec "ATC Quality Framework"):** every
  public API returns a sentinel; never throws upward.

## Cross-Phase Integration

### Phase 50 cockpit consumer (read-side, future)

The cockpit shell (`super-gsd/scripts/lib/sgsd-cockpit-shell.cjs`) is
shipped and Lock 4 forbids editing it. The adapter exposes a stable
`isAvailable()` + `readEvents(scope)` surface that a future milestone
could wire into the cockpit's "live coordination" pane. **In Phase 52,
the cockpit panel is NOT modified.** The adapter's read-side is verified
by self-test only.

### Phase 51 F17 fixture activation (cross-binding)

F17 was reserved at lines 271-279 + 891-900 of failure-injectors.cjs
specifically for this phase. Activation rewrites those byte ranges
ONLY. The frozen 16-entry F1..F16 array (lines 81-263) stays
byte-identical. After activation:

```text
INJECTION_FIXTURES (F1..F16) length: 16   <-- unchanged
F17_STUB                          : real injector
FIXTURE_FACTORIES.F17             : non-stub _F17 body
INJECT_REASON_CODES               : unchanged (still includes
                                     'bench_fixture_skipped:phase_52_redis_adapter_not_shipped'
                                     for backward-compat with prior runs)
```

The harness already drives F17 (line 947 `f.id === 'F17' ? F17_STUB : null`
fall-through); after activation it consumes the real fixture and the
soft-skip reason code stays in the catalog as a noop entry.

### Phase 47 dispatch routing (semantic cache short-circuit)

A semantic cache hit can short-circuit a route decision (saving the
provider call) but the route-decisions.jsonl ledger is STILL written.
The adapter does not write the ledger; the route caller does, with a
new boundary `boundary='semantic_cache_short_circuit'`. This preserves
the canonical truth path (REDIS-LOCK-01).

In Phase 52: NO edits to dispatch-router. The semantic cache lookup is
exposed via `getSemanticCache()`; integration is left as documentation
for a future phase (route-cache-aware dispatch).

### Phase 49 memory-governance invalidation hook

Phase 49 already writes `memory-revocations.jsonl`,
`memory-demotions.jsonl`, `memory-revalidations.jsonl`. The adapter
SUBSCRIBES (pull-based, mtime tail-read) to these files. On a new row
matching a kind/source_hash that the adapter has cached, it issues
`invalidateBySourceHash(...)`.

In Phase 52: NO edits to lifecycle.cjs. The adapter has a separate
helper `_pollMemoryGovernance(opts)` that reads the three streams
(rate-limited; only invoked from `selfTest()` and ops CLI). For
production wiring, the orchestrator can opt-in to call
`_pollMemoryGovernance` at phase-close. That wiring is defer-able to a
future milestone.

### Phase 46 SQLite fallback contract

Every cache miss / degraded path falls through to SQLite via
`require('./query.cjs')`. Phase 46's query.cjs is the canonical
read-side. The adapter NEVER writes to context-index.db.

## Completion Gate (Phase 52 PASS criteria)

- [ ] `super-gsd/tools/context-cache/redis-adapter.cjs` exists and exports
  the 8-API public surface
- [ ] `super-gsd/tools/context-cache/run-redis-self-test.cjs` exists and
  exits 0 with all groups PASS or SOFT-SKIPPED (Redis-required tests
  are soft-skipped when no Redis)
- [ ] `super-gsd/tools/context-cache/redis-adapter.test.cjs` exists with
  16 assertions across groups A-H
- [ ] `package.json` has `optionalDependencies: { redis: "^5.12.1" }`
- [ ] `.planning/metrics/redis-projection-log.jsonl` exists with at least
  1 envelope-v1 row from self-test
- [ ] F17 fixture activated: `failure-injectors.cjs` lines 271-279 and
  891-900 rewritten; ALL OTHER bytes byte-equal to pre-edit
- [ ] Phase 51 `node super-gsd/tools/context-bench/run-self-test.cjs`
  exit 0 with F17 now reporting injected status (not soft-skip
  `phase_52_redis_adapter_not_shipped`)
- [ ] Lock 4 evidence: `git diff --name-only main..HEAD
  super-gsd/tools/` lists ONLY `context-cache/redis-adapter.cjs`,
  `context-cache/redis-adapter.test.cjs`,
  `context-cache/run-redis-self-test.cjs`,
  `context-bench/failure-injectors.cjs` (the F17 byte range only)
- [ ] Lock 11 evidence: grep `embedding|cosine|similarity|approximate_match`
  across new code returns 0 hits
- [ ] Lock 13 evidence: grep `throw ` in adapter source - all hits are
  inside try blocks (or the test file)
- [ ] PHASE-CAPSULE.json updated with `status: PASS`, evidence array
  references the new files, source_hashes recomputed
- [ ] Verifier dispatch report PASS
- [ ] ATC review PASS (or PASS-WITH-DEFERRED-N if non-structural debt)

**Acceptance scenarios verified live (when Redis available) or by mock:**

1. Redis unavailable -> SQLite/local fallback, no halt   [Group A]
2. Redis FLUSHDB -> no canonical truth lost              [Group F1]
3. Hot packet cache hit -> source hashes match before use [Group C1]
4. Stale source hash -> cache miss/rebuild, not injection [Group C1]
5. Semantic cache hit -> requires intent + role + policy + source-hash
   match                                                  [Group D1, D2]
6. Poisoned key -> rejected and logged                    [Group E1, E2]
7. Stream events render cockpit progress, but cockpit still works
   from files                                             [Group F1 + Phase 50 read-only assertion]
8. Redis key inventory contains zero forbidden kinds      [Group B1, B2]

## Risks / Traps Summary

| Risk | Mitigation | Lock Binding |
|------|-----------|--------------|
| Redis becomes canonical truth (the worst-case milestone hard stop) | All 8 public APIs return `{source: 'redis'\|'sqlite'\|'local'}` (or implied by sentinel reason). REDIS-LOCK-01. Allow/deny lists on kinds. Self-test E2 + F1. | LOCK 1 / 2 / 3 (REQUIREMENTS.md non-negotiable) + REDIS-LOCK-01 |
| TTL too aggressive -> cache thrash | Per-kind defaults + tunable env vars + cockpit panel for live observation (deferred). | REDIS-LOCK-04 |
| TTL too lax -> stale serves | Source-hash revalidation on EVERY read. TTL is backstop, not primary safety. | REDIS-LOCK-02 |
| Connection pool exhaustion | 50ms command timeout + degraded sentinel + SQLite always serves. | LOCK 13 |
| Poisoned key from old schema | Schema validation on every read; reject + delete + log. | REDIS-LOCK-07 |
| F17 activation breaks Phase 51 frozen-16 contract | F17 was specifically out-of-array (lines 271-279, 891-900); F1..F16 byte-frozen pre/post edit; bootstrap fingerprint verified. | LOCK 4 + Phase 51 fixture freeze |
| Credential leak in projection log | `_redactRedisUrl()` on every log path; self-test G2. | ASVS V2/V7 |
| Cross-tenant Redis pollution (shared Redis) | `sgsd:v19:` prefix on every key; SCAN MATCH filter on every enumeration. | ASVS V4 |
| Phase 50 cockpit edited by mistake | Lock 4 binding; Wave 0 git-diff-quiet check; no cockpit code in any task. | LOCK 4 |
| Adapter throws on init when redis module absent | Top-level try/catch around `require('redis')` (mirrors Phase 46 better-sqlite3 pattern). | LOCK 13 |
| Build artifact drift (egg-info / package-lock) | package-lock.json policy resolved per Open Q + commit specific files. | n/a |

## Sources

### Primary (HIGH confidence)

- Context7 `/redis/node-redis` (vendor-maintained):
  - "Basic Connection and Command Execution"
  - "Custom Reconnect Strategy"
  - "Set Command Timeout"
  - "Manage Redis Streams" (XADD with TRIM)
  - "Create Redis Connection Pool"
- npm registry: `npm view redis version` -> 5.12.1 (2026-04-14)
- npm registry: `npm view ioredis version` -> 5.10.1
- 52-CONTEXT.md (locked CONTEXT artifact, sha256
  748c7e629b757026c868dac2df8b105ef406d3276e4586cc9ba85aa2709b07f4)
- 52-REDIS-GUIDE-DELTA.md (locked-delta, 2026-04-28)
- .planning/milestones/v1.9/REQUIREMENTS.md (REDIS-01..10 + non-negotiable
  Locks 1-13)
- .planning/milestones/v1.9/ROADMAP.md (Phase 52 deliverables +
  acceptance)
- .planning/discussions/2026-04-26-mass-discuss.md (Phase 52 lock:
  "Optional disposable projection; never canonical")
- super-gsd/tools/context-cache/rebuild.cjs (Phase 46 - Lock 13 binding
  pattern lines 60-64, 222-234, 658-806; KIND_VOCAB pattern lines
  97-103)
- super-gsd/tools/context-bench/failure-injectors.cjs (Phase 51 - F17
  reservation lines 21-23, 266-279, 891-900, 947)
- super-gsd/tools/context-bench/run-self-test.cjs (Phase 51 - thin
  shell entry pattern, 52 lines)
- super-gsd/tools/memory-governance/lifecycle.cjs (Phase 49 - JSONL
  stream paths lines 188-191; metric file naming convention)
- super-gsd/tools/context-packet/build.cjs (Phase 45 - source_hashes /
  source_refs validation pattern lines 223-232)

### Secondary (MEDIUM confidence)

- Phase 46 plan output_contract for context-cache/ (cross-checked
  rebuild.cjs banner lines 1-46)
- Phase 51 plan output_contract for failure-injectors.cjs (cross-checked
  banner lines 1-58, "16-fixture failure injection catalog (F1..F16) +
  F17 stub")

### Tertiary (LOW confidence)

- ioredis vs node-redis comparison (general Node.js community
  knowledge; both libraries are mature; choice is within Claude's
  Discretion per CONTEXT.md)
- Docker compose snippet for Redis local dev (operator convenience;
  recommendation only)

## Metadata

**Confidence breakdown:**

- Standard stack (`redis` 5.12.1): HIGH - verified via npm registry
  + Context7 vendor docs
- Architecture / Lock bindings: HIGH - verified against four shipped
  upstream phase trees (43, 46, 49, 51)
- F17 cross-binding: HIGH - byte-range explicitly reserved by Phase 51
  banner + factory comment
- Pitfalls: HIGH - cross-checked against milestone non-negotiable Locks
  1-13 and REDIS-LOCK-01..07
- TTL defaults: MEDIUM - first-pass values reasoned from cockpit
  refresh interval + governance lifecycle latency; should be revisited
  after first benchmark run
- Operator setup (Docker / native install): LOW - generic Redis ops
  knowledge, not project-specific

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (30 days; redis client + Redis server are
mature/stable; Phase 51 contract is byte-frozen so no decay there)

**Phase 52 is the FINAL v1.9 phase. After PASS, milestone close gate
runs:** token-waste check, researcher token-spend baseline comparison,
context-packet default-dispatch verification, intent-map default
front-end verification, capsule-consumed-by-downstream verification,
legal-registry-rejects-invented verification, SQLite-rebuild
verification, Redis-flush-or-absence-safe verification (this phase),
cockpit-shows-tokens verification, VTP-route-gated verification,
status-consistency / provider-health / backlog-schema / crit-backlog /
token-waste checks all pass-or-degraded-honestly.
