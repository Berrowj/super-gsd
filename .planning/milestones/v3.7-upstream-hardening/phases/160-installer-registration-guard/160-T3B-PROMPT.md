# P160-T3B — finish the timeout-interrupted T3 (three failures)

You are the implementer. Fresh context. Edits-first; no spawns; do NOT stop on
spawnSync EPERM; static verification only. Do NOT commit. Same three files as
task P160-T3.

The prior run was killed at the wrapper timeout mid-work. Orchestrator ran the
suite unsandboxed; current failures:

1. `--case node-check-both-sites` REGRESSED: refusal no longer names the missing
   hook path (assertion: "refusal did not name ...\.claude\hooks\sgsd-heartbeat.js").
   Your preflight extension changed the refusal aggregation/message shape; restore
   per-path naming in refusal errors while keeping the smoke additions.
2. `--case canonical-sixteen-hook` FAILS: `spawnSync bash ETIMEDOUT` — the
   positive fixture now smoke-runs 16 hooks and blows the per-spawn or total
   timeout on this machine (bash cold-start is slow on Windows). Fix by (a)
   respecting a per-hook timeout from the hooks registry budget with a sane
   floor, (b) running install.sh-driven smoke in the fixture with a bounded
   subset or raised test timeout — the positive case must complete in under
   ~120s total on Windows.
3. `--case deployed-hook-smoke` FAILS the same way: `spawnSync bash ETIMEDOUT`.
   Same root cause; the case must prove missing-sibling => loud named failure
   and healthy => pass, within bounded time (consider node-only hooks for the
   healthy fixture to avoid bash cold-start stacking).

Green already (do not regress): preflight-static, vendored-nine-hook,
smoke-static, bundled-overlay-static, bundled-overlay-current.

Report: FILES_CHANGED / VERIFICATION (static) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 150 words.
