---
phase: 52
name: Redis Live Memory Projection Adapter
milestone: v1.9
depends_on: [46, 50, 51]
unblocks: []
---

# Phase 52 Context

Goal: add Redis only as an optional live memory projection, never as SGSD truth.

Redis may speed up four classes of derived state:

1. **Live coordination** - cockpit snapshots, active phase/agent markers,
   heartbeat/checkpoint hints, and short-lived counters.
2. **Hot packet cache** - role-specific context packet previews keyed by
   `intent_id`, role, phase, and source hash set.
3. **Semantic cache** - prior intent/query results that can be reused only when
   the normalized intent, role, policy, and source hashes still match.
4. **Event stream** - append-style live events for cockpit rendering,
   provider canary results, retry state, and agent progress.

Redis must not own decisions, debt, evidence, phase capsules, validated
thoughts, memory lifecycle rows, benchmark results, or route decisions. Those
remain canonical in `.planning`, JSONL artifacts, source hashes, and git.

`FLUSHDB` must be safe. Redis absence must degrade to SQLite/local files.

## Source Delta

The Redis context-engineering guide reinforces Redis as a production memory
backend for:

- short-term checkpoint/session state;
- long-term structured/vector recall with metadata filters;
- semantic caching to avoid repeated LLM calls;
- streams/PubSub-style coordination for background agents and retries;
- TTL and deduplication to prevent unbounded memory growth.

SGSD adopts those as optional projections only. The milestone already built
the required safety layers first: Phase 45 intent/context packets, Phase 46
SQLite/source-hash index, Phase 49 memory governance, Phase 50 cockpit
projection, and Phase 51 stress/failure benchmark. Phase 52 must consume those
surfaces rather than bypassing them.

## Required Key Policy

Every Redis value must carry enough metadata to prove it is still valid:

- `schema_version`
- `kind`
- `milestone`
- `phase`
- `role` when role-scoped
- `intent_id` when intent-scoped
- `source_hashes`
- `registry_version` or registry content hash
- `created_at`
- `ttl_seconds`
- `canonical_refs`

If any canonical source hash, registry key, memory lifecycle row, or source
artifact changes, the Redis value is stale and must be ignored or rebuilt.

## Required Failure Contract

- Redis down: continue with SQLite/local files and log degraded cache status.
- Redis timeout: continue with SQLite/local files and log timeout metadata.
- Redis stale hit: reject hit, rebuild from canonical state, and log stale key.
- Redis `FLUSHDB`: no canonical truth lost; cockpit/cache warms back up.
- Redis poisoned key: reject on schema/source-hash validation, never inject
  value into a context packet.
