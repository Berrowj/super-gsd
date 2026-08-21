# P161 close-fix round 2 — recovery fixture must ship a complete local runtime

Files: guard test (fixture construction) primarily; preflight/install only if a
genuine seam remains. Edits-first; no spawns; do NOT commit.

## Live evidence

The post-distribution re-smoke (close-fix round 1) works and now correctly
smokes the freshly distributed local sgsd-session-start.js — which FAILS:
ERROR: hook_smoke_failed ...clarity project\super-gsd\hooks\sgsd-session-start.js
because the fixture's fixedSha commit distributes ONLY the four hooks +
install.sh + overlay, without the scripts/lib + registry siblings those hooks
require at runtime (seedClarityUpdateProject vendors only hooks/systemd). A
real repaired update distributes the full repo-local integration set, so the
FIXTURE under-models reality.

## Fix

1. Make the recovery fixture's repaired distribution include the sibling
   runtime the hooks need (whichever is truthful to real sgsd-update: fixedSha
   commit carries scripts/lib+registry, or the seed vendors them like
   createDistributionFixture does for other cases). The healthy repaired path
   must reach exit 0 with the re-smoke GREEN.
2. Keep the broken-local-runtime regression DISTINCT and asserted: one
   distributed hook with a deliberately missing sibling must fail the install
   loud, naming the hook (this is the protection round 1 added — prove it).
3. Both case names (recovery + shape alias) green; all other cases untouched.

Report: FILES_CHANGED / VERIFICATION (static) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 120 words.
