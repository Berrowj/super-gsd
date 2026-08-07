FILES_CHANGED: `super-gsd/hooks/sgsd-intent-classifier.cjs` (modified)

VERIFICATION: `node --check super-gsd/hooks/sgsd-intent-classifier.cjs` → exit 0 ✓  
VERIFICATION: `corrupt temp-copy registry in SGSD fixture` → exit 0 ✓ (`registry_unparsed` row + breadcrumb, no stack)  
VERIFICATION: `corrupt temp-copy registry in non-SGSD dir` → exit 0 ✓ (silent, zero files written)  
VERIFICATION: `unreadable temp-copy registry path-is-directory` → exit 0 ✓ (`registry_unavailable`)  
VERIFICATION: `zero-length temp-copy registry` → exit 0 ✓ (`registry_empty`)  
VERIFICATION: `JSON.stringify corpus harness` → exit 0 ✓ (13/13 recall, 11/11 precision)  
VERIFICATION: `bench canonical + non-canonical --record` → exit 0 ✓ (`iterations=200`, `p95_ms<1000`)  
VERIFICATION: `append-failure, stdin, no-network/no-block, registry-constant, 10k timing` → exit 0 ✓  
VERIFICATION: `git diff --check -- super-gsd/hooks/sgsd-intent-classifier.cjs` → exit 0 ✓  
VERIFICATION: `git diff -- super-gsd/registry/session-governance-hooks.yaml` → exit 0 ✓ (real registry unchanged)

DEVIATIONS: none  
BLOCKERS: none  
SCRIPTS_CREATED: none

ONE_LINER: `readRegistry` now treats zero usable routes as degraded: non-zero parse-to-empty logs `registry_unparsed`; zero-length logs `registry_empty`; absent/unreadable stays `registry_unavailable` because all three silently disable required routing.
