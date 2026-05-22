---
phase: 52
milestone: v1.9
source: C:\Users\user\Downloads\Redis_ePub_Guide_MasteringContextEngineering_20251023.pdf
status: locked-delta
created: 2026-04-28
---

# Phase 52 Redis Guide Delta

## Operator Decision

Redis is useful for SGSD, but only after the v1.9 governance stack exists.

The Redis guide strengthens Phase 52. It does not move Redis earlier and does
not make Redis canonical memory.

## What Changes

Phase 52 is no longer just "cockpit cache". It is now an optional **Redis Live
Memory Projection Adapter**.

It should support:

1. live cockpit/cache state;
2. active agent and session checkpoint markers;
3. hot context packet previews;
4. semantic cache entries for repeated intent/role/source-hash combinations;
5. provider health and canary cache;
6. Redis stream rows for agent/cockpit/progress events;
7. hot validated-thought projections with source hashes and metadata filters.

## What Does Not Change

Canonical truth remains:

- `.planning` artifacts;
- JSONL streams;
- phase capsules;
- source hashes;
- memory lifecycle rows;
- route decisions;
- git history.

Redis must be rebuildable from those surfaces.

## Design Locks

### REDIS-LOCK-01: Projection Only

Redis stores derived state. It must never be the only copy of any decision,
debt item, evidence row, phase capsule, validated thought, memory lifecycle
transition, benchmark result, or route decision.

### REDIS-LOCK-02: Source-Hash Invalidation

Every Redis value that can influence context must carry the source hash set it
was built from. If the source hash set no longer matches canonical state, the
cache hit is invalid.

### REDIS-LOCK-03: Intent-Scoped Semantic Cache

Semantic cache keys must be based on normalized intent, role, phase/milestone,
context policy, and source hashes. Raw semantic similarity alone is not enough
to inject cached content.

### REDIS-LOCK-04: TTL + Dedup

Every Redis key must have a TTL unless it is a stream entry with explicit
retention policy. Duplicate hot packet or event records should collapse by
content hash.

### REDIS-LOCK-05: Safe Flush

`FLUSHDB` is a required acceptance scenario. It must lose no canonical truth
and must only force cache/cockpit warm-up from SQLite/local files.

### REDIS-LOCK-06: Degraded-OK

Redis down, Redis timeout, Redis auth missing, and Redis missing module support
all degrade to SQLite/local files. They do not halt automode.

### REDIS-LOCK-07: Poisoned-Key Defense

A Redis value with missing schema fields, invalid registry references, stale
source hashes, unknown key kind, or prompt-injection-like text in executable
fields must be rejected and logged as cache-poison evidence.

## Adapter Surface

The implementation should live behind the existing context-cache interface:

```text
super-gsd/tools/context-cache/redis-adapter.cjs
```

Required APIs:

```text
isAvailable(opts) -> { ok, degraded_reason, metadata }
getHotPacket(key) -> { hit, stale, packet, reason }
putHotPacket(key, packet, metadata) -> { ok, key, ttl_seconds }
getSemanticCache(query) -> { hit, stale, value, reason }
putSemanticCache(query, value, metadata) -> { ok, key, ttl_seconds }
publishEvent(event) -> { ok, stream_id }
readEvents(scope) -> { ok, events }
invalidateBySourceHash(source_hash) -> { ok, count }
selfTest() -> { pass, fail }
```

All public APIs must catch internally and return falsey/degraded sentinels,
matching Lock 13.

## Redis Key Kinds

Allowed kinds:

- `cockpit_snapshot`
- `active_agent_marker`
- `session_checkpoint_marker`
- `provider_health_cache`
- `hot_context_packet`
- `semantic_cache`
- `validated_thought_projection`
- `agent_event_stream`
- `short_lived_counter`

Forbidden kinds:

- `decision`
- `debt`
- `evidence`
- `phase_capsule`
- `memory_lifecycle`
- `benchmark_result`
- `route_decision`

## Metadata Required On Context-Influencing Values

```json
{
  "schema_version": 1,
  "kind": "hot_context_packet",
  "milestone": "v1.9",
  "phase": "52",
  "role": "researcher",
  "intent_id": "intent-...",
  "source_hashes": ["sha256:..."],
  "registry_hash": "sha256:...",
  "canonical_refs": [".planning/..."],
  "created_at": "2026-04-28T00:00:00Z",
  "ttl_seconds": 900
}
```

## Acceptance Additions

Phase 52 must prove:

- Redis unavailable -> SQLite/local fallback, no halt.
- Redis `FLUSHDB` -> no canonical truth lost.
- Hot packet cache hit -> source hashes match before use.
- Stale source hash -> cache miss/rebuild, not injection.
- Semantic cache hit -> requires intent + role + policy + source-hash match.
- Poisoned key -> rejected and logged.
- Stream events can render cockpit progress, but cockpit still works from files.
- Redis key inventory contains zero forbidden kinds.

## Relationship To Existing v1.9 Phases

- Phase 45 defines intent maps and context packet shape.
- Phase 46 provides rebuildable local index/fallback.
- Phase 47 routes by structural uncertainty and context pressure.
- Phase 48 gates VTP evidence.
- Phase 49 governs memory promotion/revocation.
- Phase 50 shows the operator what cache/context is doing.
- Phase 51 proves failure behavior before Redis is trusted.
- Phase 52 adds Redis only after those contracts exist.
