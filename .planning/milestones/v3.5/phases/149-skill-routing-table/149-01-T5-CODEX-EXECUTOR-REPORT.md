FILES_CHANGED: [super-gsd/skills/sgsd-orchestrate/SKILL.md]($HOME/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/cholla-racer/super-gsd/skills/sgsd-orchestrate/SKILL.md)

VERIFICATION: PASS

- `skill-routing` references: 12
- `Step 6.7|phase-close` references: 9
- Consult placement: line 1838, between phase completion (1836) and Step 6.7 (1851)
- Stale routing prose: 0 across seven targeted patterns
- `git diff --check`: clean
- Authorized files changed: 1

DEVIATIONS: `apply_patch` was unavailable due Windows sandbox enforcement; used guarded exact-once replacements and preserved the repository’s LF convention. No scope deviation.

BLOCKERS: None

SCRIPTS_CREATED: None

ONE_LINER: Replaced five embedded neglected-skill routing rules with runtime registry/helper references and documented the phase-close consult before Step 6.7.

STATUS: DONE
