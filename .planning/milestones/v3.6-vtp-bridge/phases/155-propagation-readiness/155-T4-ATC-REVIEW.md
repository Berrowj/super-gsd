FINDINGS: 2
CRITICAL: 0
WARNINGS: 2
PASS_RATE: 9/10
ONE_LINER: Hook resolution and renderer reuse are sound; diagnostics and stale orchestration instructions need cleanup.
FINDINGS_DETAIL: [WARNING] [failure-diagnostics] `gsd-session-state.sh:25` discards the adapter’s detailed stderr, replacing its error code/message with generic “decision-state command failed”; output remains a loud non-empty one-liner and exit 0 is intentionally non-blocking.
FINDINGS_DETAIL: [WARNING] [instruction-consistency] `sgsd-orchestrate/SKILL.md:122,169,1808,2585` still directs raw STATE.md reads despite resolver-only guidance at lines 186/528. The bounded CLI output fits the approximate budget, but these stale directives can reintroduce projection trust.
