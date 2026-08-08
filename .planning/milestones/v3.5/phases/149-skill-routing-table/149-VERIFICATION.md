FINDINGS: 4
CRITICAL: 1
WARNINGS: 2
PASS_RATE: 9/12
ONE_LINER: Both consumers read the YAML, but phase-close “fired” routes are logged rather than executed; fallback and cooldown drift remain, while A1 is confirmed pre-P149.
FINDINGS_DETAIL: [CRITICAL] [logic] super-gsd/scripts/lib/orchestrator-hooks.cjs:485 only converts scheduled routes into evidence rows and returned JSON; super-gsd/skills/sgsd-orchestrate/SKILL.md:1842 invokes the consult but never captures or dispatches fired skills before Step 6.7 at line 1851. The enumeration/evidence SACs at .planning/milestones/v3.5/phases/149-skill-routing-table/149-01-PLAN-LOCKED.md:304, :311, and :339 are therefore mechanically green but semantically vacuous.
FINDINGS_DETAIL: [WARNING] [logic] super-gsd/scripts/lib/orchestrator-hooks.cjs:184 returns immediately for an observed gate_ref before evaluating cooldown at line 209; repeated in-memory consults kept MUDA, audit, and memory-hygiene fired while non-gate routes correctly became skipped.
FINDINGS_DETAIL: [WARNING] [architecture] super-gsd/scripts/lib/skill-routing-registry.cjs:47 retains a live, manually duplicated 24-row suggestion lexicon. It has already drifted: the fallback sgsd-audit row at line 86 lacks the cooldown present in super-gsd/registry/skill-routing.yaml:201.
FINDINGS_DETAIL: [INFO] [logic] super-gsd/scripts/lib/orchestrator-hooks.cjs:250 and :575 blame to Phase-87 commit 41382ecc, an ancestor of c75beaa, and neither tokenWasteCheck(null) nor A1_lock13_null_opts changed in the P149 diff; the host-side 9/10 issue is pre-existing, not a P149 regression.
