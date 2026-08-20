# P156-T1 spec-compliance review — raw artifacts, not executor claims

Read only. The T1 changes are UNCOMMITTED in the working tree; use `git diff` and
`git status` plus direct file reads. Do not trust the executor report's claims — it is
orchestrator-salvaged after a killed pipe (provenance inside it).

Raw artifacts:
1. Task P156-T1 contract in `.planning/milestones/v3.6-vtp-bridge/phases/156-state-close-contract/156-01-PLAN-LOCKED.md`
   (revision 2 with AMENDMENT-1) — input_contract, falsifier, stop_rule, SAC-1/2/3.
2. The diff: `git diff -- super-gsd/install.sh super-gsd/skills/sgsd-orchestrate/SKILL.md`
   plus new files `super-gsd/tools/state-write/write.cjs`,
   `super-gsd/tests/state-close-contract/assert-state-write.cjs`,
   `super-gsd/hooks/gsd-phase-boundary.sh`.
3. Report: `156-T1-REPORT.md` (salvage provenance disclosed).

Check against the contract, in order:
1. Boundary: resolve.cjs / decision-state.cjs / registries untouched (git status must
   show no modifications there). Any write-side leak into the read side is CRITICAL.
2. AMENDMENT-1 change 1 honoured: refusal is projection-ahead, keyed on the resolver's
   projection_stale/stale_sources, ROADMAP order used only to classify direction —
   confirm in write.cjs source AND the refuse-backwards test fixture direction
   (STATE at v30-08, evidence+event v30-07).
3. Atomicity/idempotence real: same-directory temp + fsync + rename, temp cleaned on
   failure, changed=false replay, unrelated STATE bytes preserved surgically.
4. Wiring: SKILL Step 11 + Step 6.6.j call the CLI exactly; gsd-phase-boundary.sh
   advisory rewritten; install.sh deploys the hook.
5. No parser copies, no arithmetic/lexical phase ordering, no num-plus-one.

Output, contract lines first, then max 150 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
SPEC_VERDICT: pass | fix_required | blocked
REQUIRED_FIXES: none | <numbered>
```
