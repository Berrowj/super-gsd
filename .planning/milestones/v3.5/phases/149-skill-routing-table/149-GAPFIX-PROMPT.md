# P149-gapfix — Close verifier CRIT + 2 WARNs

Fresh SDD implementer (Codex gpt-5.6-sol/xhigh). Fix EXACTLY the three verifier findings below. Surgical constraint applies.

## Findings (verifier, with file:line)
FINDINGS_DETAIL: [CRITICAL] [logic] super-gsd/scripts/lib/orchestrator-hooks.cjs:485 only converts scheduled routes into evidence rows and returned JSON; super-gsd/skills/sgsd-orchestrate/SKILL.md:1842 invokes the consult but never captures or dispatches fired skills before Step 6.7 at line 1851. The enumeration/evidence SACs at .planning/milestones/v3.5/phases/149-skill-routing-table/149-01-PLAN-LOCKED.md:304, :311, and :339 are therefore mechanically green but semantically vacuous.
FINDINGS_DETAIL: [WARNING] [logic] super-gsd/scripts/lib/orchestrator-hooks.cjs:184 returns immediately for an observed gate_ref before evaluating cooldown at line 209; repeated in-memory consults kept MUDA, audit, and memory-hygiene fired while non-gate routes correctly became skipped.
FINDINGS_DETAIL: [WARNING] [architecture] super-gsd/scripts/lib/skill-routing-registry.cjs:47 retains a live, manually duplicated 24-row suggestion lexicon. It has already drifted: the fallback sgsd-audit row at line 86 lacks the cooldown present in super-gsd/registry/skill-routing.yaml:201.

## Fix requirements
1. CRIT (fired-but-never-dispatched): make fired semantically real. The consult JSON must include, per fired route, an actionable dispatch (concrete command derived from the table row — e.g. the skill's script/CLI invocation; add a dispatch/command field to the relevant yaml rows if needed). SKILL.md's consult step (line ~1842) must instruct the loop: for each fired row, EXECUTE its dispatch command before Step 6.7 and append an execution-outcome evidence row (fired -> executed|execution_failed with exit code). Extend the A10 self-test to assert a fired row carries a non-empty dispatch and that the execution-outcome row shape is enforced. The runtime hook itself may execute deterministic local script dispatches directly when a --execute flag is passed; SKILL.md should use --execute so fired rows run mechanically.
2. WARN (cooldown ordering): evaluate cooldown BEFORE the gate_ref observed short-circuit at orchestrator-hooks.cjs:184 so repeated consults respect once-per-phase policies; add a repeat-consult self-test assertion.
3. WARN (fallback drift): strengthen the fallback parity self-test from row-count to deep field comparison (skill/moment/modes/cooldown/gate refs) and fix the drifted sgsd-audit fallback row (missing cooldown from skill-routing.yaml:201).

## Verify before reporting: registry --self-test, orchestrator-hooks --self-test, consult with --execute on a dry phase, classifier --self-test. Report which pass.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
