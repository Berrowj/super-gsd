# P159-T2 patch retry — your previous unified diff failed to apply

Your prior run designed the T2 change correctly (seven ERP/VTP routes,
availability-guarded, shadow/suggestion tiering, text-free evidence) but the
emitted patch FAILED `git apply --recount --check`:
- malformed hunk at the skill-routing.yaml/session-governance-hooks.yaml boundary
- context mismatch at super-gsd/scripts/lib/skill-routing-registry.cjs:846
- context mismatch at super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs:71

Regenerate the SAME change as a fresh unified diff with these hard rules:
1. Context lines must be copied VERBATIM from the read-pack file content —
   never reconstructed from memory.
2. Exactly 3 context lines around each hunk; keep hunks small and disjoint.
3. Hunk headers (@@ -a,b +c,d @@) must count correctly; recount before emitting.
4. Emit ONLY between PATCH_BEGIN / PATCH_END sentinels as before, then the
   5-line report (FILES_CHANGED/VERIFICATION/DEVIATIONS/BLOCKERS/ONE_LINER).

The task contract is P159-T2 in
.planning/milestones/v3.6-vtp-bridge/phases/159-skill-routing-expansion/159-01-PLAN-LOCKED.md
(revision 2), same as before. Red-first note: the orchestrator will run the red
(new erp-vtp-skill-family case against pre-patch registry is impossible after
apply; instead your test must include a fixture-registry-without-rows red path
executed inside the case itself, or document that the red is the pre-apply state
verified by the orchestrator before applying).
