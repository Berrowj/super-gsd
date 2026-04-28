# Fixture: redis-adapter-flushdb-recovery

Scenario id: redis-adapter-flushdb-recovery
Target tool: super-gsd/tools/context-cache/redis-adapter.cjs (_testHook_simulateFlushAndPoison)
Inject mechanism: test_hook_simulate_flush_and_poison

## Failure mode

The harness spawns a node -e wrapper that requires the real
redis-adapter.cjs and invokes the public test-hook
`_testHook_simulateFlushAndPoison({})`. This hook drives a 5-step
REDIS-LOCK-05 + REDIS-LOCK-07 protocol against a live Redis instance:

1. inject a poisoned (non-JSON) value at a sgsd:v19:test:poisoned key
2. attempt getHotPacket -> reason='poisoned_unparseable' (Defense 1 binding)
3. simulate FLUSHDB (or sendCommand(['FLUSHDB']) for older drivers)
4. post-flush getHotPacket -> reason='miss' (canonical files untouched)
5. emit projection-log row reason='redis_flushdb_recovered_via_sqlite'

If the redis npm module is not installed (the dev / CI default),
_getClient() returns null, and the hook returns the documented degraded
sentinel { ok:false, reason:'redis_not_available_soft_skip', steps:[] }.

## Closed-vocab observation

`expected_reason_codes` per scenarios.json:
`['redis_flushdb_recovered_via_sqlite', 'poisoned_unparseable']`.

When live Redis IS available, the wrapper emits the success path: result
ok=true, steps array contains step 2 reason 'poisoned_unparseable' AND
step 5 reason 'redis_flushdb_recovered_via_sqlite' - the byte-equality
intersection with expected is therefore the full 2-element set.

When live Redis is NOT available (this is the typical dev environment;
no docker compose redis up), the wrapper emits the soft-skip sentinel
result.reason === 'redis_not_available_soft_skip'. Per scenarios.json
`soft_skip_when: redis_not_available_soft_skip`, the harness records a
PASS-WITH-SOFT-SKIP rather than FAIL.

Structural assertion (load-bearing):
- subprocess exit_code is a number (real spawn proven)
- the wrapper printed valid JSON to stdout (parseable)
- either reason==='redis_not_available_soft_skip' (soft-skip path) OR
  the reason intersection with expected_reason_codes is non-empty
  (success path)

## Files

- README.md (this file)

No seed-data files: the test hook injects state directly into the live
Redis namespace via client.set(), so no on-disk fixtures are required.

ASCII-only. No credentials.
