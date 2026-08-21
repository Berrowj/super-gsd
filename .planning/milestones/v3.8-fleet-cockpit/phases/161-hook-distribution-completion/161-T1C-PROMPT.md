# P161-T1C — installer smoke performance: 7-minute installs are the defect

Files ONLY: super-gsd/scripts/lib/hook-registration-preflight.cjs,
super-gsd/install.sh, and the P160 guard test. Edits-first; no spawns; do NOT
commit.

## Measured evidence (orchestrator, this machine, 2026-08-21)

A real `bash install.sh --install-global --skip-cockpit-deps` into isolated HOME
now takes 7m05s (exit 0, 25 hooks land — the T1 glob fix works). Before P160's
smoke it was well under a minute. The smoke runs every deployed hook serially,
each via a bash spawn whose Windows cold-start costs seconds; multi-install test
fixtures stack this into spawnSync ETIMEDOUT for three cases
(node-check-both-sites, canonical-sixteen-hook, hook-distribution-all-types).

## Fix (installer performance, not test-budget inflation)

1. In the preflight smoke: spawn node hooks as `node <script>` DIRECTLY (no
   bash wrapper) — bash only for .sh hooks; run smoke spawns with bounded
   concurrency (4) instead of serially; keep the per-hook timeout floor and the
   loud named-failure contract exactly as shipped.
2. Any secondary install.sh hot spots you can bound cheaply (e.g. repeated node
   --check invocations one-per-file can batch into one node process) — only if
   contract-neutral.
3. Test budgets: align case timeouts to the improved reality with headroom, not
   to 7 minutes.

Target: full global install under ~120s on this machine; the three failing
cases pass; all other cases stay green; refusal naming and fail-loud semantics
byte-compatible with the vendored-nine-hook assertions.

Report: FILES_CHANGED / VERIFICATION (static) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 120 words.
