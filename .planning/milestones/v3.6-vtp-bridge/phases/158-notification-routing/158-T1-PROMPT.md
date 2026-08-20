# P158-T1 — automated-turn origin gate in the intent classifier, red-then-green

You are the implementer for ONE task. Fresh context. Node works; no `claude`
spawning (EPERM). Sandbox-denied spawns fail loud, never self-fulfil; orchestrator
re-runs unsandboxed. Do NOT commit.

Task P158-T1 in `158-01-PLAN-LOCKED.md` (same dir) is your VERBATIM contract —
single file `super-gsd/hooks/sgsd-intent-classifier.cjs`. Follow its input_contract
exactly: red-first fixtures in the existing selfTest() through the production
parsePayload path; structural origin gate BEFORE route evaluation; text-free
`automated_turn_skip` written row; three-direction falsifier (operator fires;
notification skips with written row; operator QUOTING notification text still
fires). No phrase blacklists. Preserve every existing selfTest case.

## Verify before reporting

    node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test

Record the red run (new fixtures failing pre-gate) and the green run in your report.

Report: FILES_CHANGED / VERIFICATION (RED preserved) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 150 words.
