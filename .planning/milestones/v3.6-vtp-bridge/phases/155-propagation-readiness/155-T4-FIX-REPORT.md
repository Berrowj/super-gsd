FILES_CHANGED: `gsd-session-state.sh`; `sgsd-orchestrate/SKILL.md`  
VERIFICATION: Direct adapter exit 0; static scope/diff checks passed.  
DEVIATIONS: `--consumer adapter` unsupported (exit 2); no commit.  
BLOCKERS: Supported test: 9 pass, 4 EPERM failures from sandbox-blocked nested Node spawns.  
ONE_LINER: Surfaced adapter exit/detail and aligned four stale STATE directives to the resolver CLI.
