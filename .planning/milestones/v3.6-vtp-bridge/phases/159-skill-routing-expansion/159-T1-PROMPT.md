# P159-T1 — availability guard on matched routes, red-then-green

You are the implementer for ONE task. Fresh context. Node works; no `claude`
spawning (EPERM). Sandbox-denied spawns: fail loud, never self-fulfil; the
orchestrator re-runs unsandboxed. Do NOT commit.

Task P159-T1 in `159-01-PLAN-LOCKED.md` (same dir, revision 2) is your VERBATIM
contract. Files: sgsd-intent-classifier.cjs, skill-routing-registry.cjs, and the
NEW test super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs.

Core contract: suggestion/directive emission verifies the target skill resolves on
THIS instance (global ~/.claude/skills, ~/.claude/commands, project .claude) before
emitting; unavailable => emit NOTHING plus exactly one text-free skill_unavailable
ledger row (markers/counters only). Falsifier BOTH ways with isolated fake homes.
Do not regress the P158 origin gate or any existing selfTest case.

Red-first: write the availability-guard case, run it against the unguarded
classifier, record the red. Then implement and re-run green.

## Verify before reporting

    node super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs --case availability-guard
    node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test
    node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test

Report: FILES_CHANGED / VERIFICATION (RED preserved) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 200 words.
