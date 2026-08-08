SALVAGE RECORD (executor timed out at 1200s before reporting; implementation verified complete host-side)
FILES_CHANGED: orchestrator-hooks.cjs (+311/-), skill-routing-registry.cjs (+115/-), skill-routing.yaml (+72/-, dispatch fields), sgsd-orchestrate SKILL.md (+24/-, --execute consult step)
VERIFICATION (host): registry self-test 12/12; hooks self-test 11/12 (sole fail = pre-existing Phase-87 A1); syntax OK both cjs; dry-run consult shows cooldown ordering fix live (repeat consults skip once-per-phase routes); A10 extended assertion (fired rows carry non-empty dispatch + execution-outcome row shape) green
ONE_LINER: fired is now executable — dispatch commands in table rows, --execute runs them, outcome evidence rows enforced; cooldown before gate_ref; deep fallback parity
STATUS: DONE (salvaged)
