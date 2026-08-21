# P161-T3 — real sgsd-update Clarity-recovery proof (edits-first)

You are the implementer for ONE task. Fresh context. No spawns; do NOT stop on
spawnSync EPERM; static verification only; the orchestrator runs the
install-driven case unsandboxed. Do NOT commit.

Task P161-T3 in `161-01-PLAN-LOCKED.md` (same dir) is your VERBATIM contract.
Files: the guard test + super-gsd/skills/sgsd-update/SKILL.md (documentation of
the operator-side dead-entry removal ordering ONLY — automation of removal is
out of scope by CONTEXT).

The case (name it sgsd-update-clarity-recovery): an isolated fixture with
Clarity's exact shape — project .claude/settings.json carrying stale
sgsd_managed registrations pointing at a vendored super-gsd dir that contains
only systemd/; a source checkout at a pinned sha; .super-gsd-version behind.
Drive the REAL super-gsd/scripts/sgsd-update.sh Git->installer->pin path:
1. Prove the historical failure is now impossible: with T1+T2 in place the
   update completes exit 0, global coverage live (smoke passes), unique
   registrations, .super-gsd-version advanced to the fetched sha.
2. The stale project-local dead entries: update must NOT silently delete them
   (operator-side, ordered after global coverage per the 2026-08-13 report);
   assert they survive untouched and the run STILL exits 0 with the refusal
   downgraded to a named per-path WARN for project-local sgsd_managed entries
   ONLY when global coverage for the same hook is live — if that downgrade is
   not already how T1/T2 left the preflight, implement it exactly so (a dead
   project entry with live global coverage warns; without global coverage it
   still refuses).
3. SKILL.md documents the removal ordering verbatim from the report.

Budget every spawn with the T1D-era timings (install ~2 min here); bounded
per-spawn timeouts with headroom, not 10-minute defaults.

Report: FILES_CHANGED / VERIFICATION (static) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 150 words.
