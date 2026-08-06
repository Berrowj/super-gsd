DONE_WITH_CONCERNS

FILES_CHANGED:
`super-gsd/scripts/lib/sgsd-state.cjs` (created)  
`super-gsd/scripts/lib/gate-evidence-log.cjs` (created)  
`.planning/STATE.md` (modified)

VERIFICATION:
`node --check super-gsd/scripts/lib/sgsd-state.cjs` → exit 0 ✓  
`node --check super-gsd/scripts/lib/gate-evidence-log.cjs` → exit 0 ✓  
`node -e <resolver real STATE assertion>` → exit 0 ✓  
`node -e <OS temp findSgsdRoot null assertion>` → exit 0 ✓  
`node -e <temp logGateEvidence append + JSON parse assertion>` → exit 0 ✓  
`node -e <P146 PLAN-LOCKED helper resolves locked plan>` → exit 0 ✓

DEVIATIONS: none. Concern: ambient untracked P146 planning prompt/raw files are present in the worktree; I did not touch them.

BLOCKERS: none

SCRIPTS_CREATED:
`super-gsd/scripts/lib/sgsd-state.cjs` | shared SGSD root/STATE/phase/PLAN-LOCKED resolver | exports `findSgsdRoot`, `readState`, `findPlanLockedFiles` aliases  
`super-gsd/scripts/lib/gate-evidence-log.cjs` | envelope-v1 gate evidence JSONL writer | exports `logGateEvidence`, `readGateEvidenceRows`, `ledgerPath`

ONE_LINER: Added the shared frontmatter-only SGSD state resolver, PLAN-LOCKED file resolver, and never-throw envelope-v1 gate evidence writer; STATE now declares `current_phase: "146"`.
