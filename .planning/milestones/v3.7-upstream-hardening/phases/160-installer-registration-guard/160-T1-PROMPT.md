# P160-T1 — atomic hook-registration preflight (edits-first; orchestrator owns spawns)

You are the implementer for ONE task. Fresh context. The sandbox denies nested
spawns — do NOT run suites, do NOT stop on spawnSync EPERM; write the edits,
verify with node --check / in-process loads, report. Do NOT commit.

Task P160-T1 in `160-01-PLAN-LOCKED.md` (same dir) is your VERBATIM contract.
Files: NEW super-gsd/scripts/lib/hook-registration-preflight.cjs,
super-gsd/scripts/merge-settings.js (the shared merge boundary both installer
sites call), NEW super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs.

Contract essentials (plan review GO 5/5 confirmed these):
- Preflight validates EVERY hook command's script path before any settings write:
  file exists AND `node --check` passes (resolvability, not just existence).
- Refusal is ATOMIC: nothing written, target settings byte-identical (hash
  preserved), no temp files left, loud error naming every missing/unresolvable
  path. No partial registrations ever.
- Test fixtures: the exact Clarity vendored-9-hook shape (only
  sgsd-session-start.js of the four present) must REFUSE with zero writes;
  the canonical 16-hook layout must register cleanly (positive control).
  Red path encoded as fixtures (guard-absent behaviour is the committed history;
  the orchestrator runs the suites unsandboxed).

Report: FILES_CHANGED / VERIFICATION (static, name checks) / DEVIATIONS /
BLOCKERS / ONE_LINER, max 180 words.
