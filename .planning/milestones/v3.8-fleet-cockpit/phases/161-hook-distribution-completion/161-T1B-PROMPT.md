# P161-T1B — finish the timeout-interrupted T1 (four failing cases)

You are the implementer. Fresh context. Edits-first; no spawns; do NOT stop on
spawnSync EPERM; static verification only. Do NOT commit. Files ONLY:
super-gsd/install.sh and the P160 guard test.

The prior T1 run was killed at the wrapper timeout mid-edit. Orchestrator ran
the nine-case suite unsandboxed; current failures:

1. `--case hook-distribution-all-types` (your new case): spawnSync bash
   ETIMEDOUT — the case's install spawn exceeds its timeout. Apply the same
   bounded-budget approach T3C used (per-spawn timeout with a Windows floor;
   keep the fixture install minimal — the case proves the copy loops ship every
   hook TYPE, it does not need repeated full installs).
2. `--case vendored-nine-hook` REGRESSED: "refusal did not name
   hook_registration_missing:" — your install.sh edits changed the refusal
   output shape the case asserts. Restore the per-path
   hook_registration_missing naming while keeping the widened copy glob.
3. `--case node-check-both-sites` and `--case canonical-sixteen-hook` also
   exit 1 — same regression family (message shape / timeout). Fix both.

Green (do not regress): preflight-static, smoke-static, bundled-overlay-static,
bundled-overlay-current, deployed-hook-smoke.

Report: FILES_CHANGED / VERIFICATION (static) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 120 words.
