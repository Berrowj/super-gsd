STATUS: IMPLEMENTED; SPAWN VERIFICATION DENIED

FILES_CHANGED: [guard assertions](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs:1051); [report](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/.planning/milestones/v4.0-install-contract/phases/168-install-contract/168-T1F-REPORT.md).

SUMMARY: Added bounded disclosure guards, explicit precheck → sealed publication → profile-dispatch ordering, and repaired the Clarity fixture without accepting missing capability.

PART_2_DIAGNOSIS: **(i), stale fixture.** The P161 fixture never created an MCP `vtp-kb` scope; P167’s unchanged `repairClaudeSubstrateCapability` requires a direct definition to preserve as upstream. A probe using spaced project/upstream/profile paths returned `{ok:true,reasons:[]}` and brokered it. The fixture now requires `capability_status=current`, `reasons=[]`, `substrate_granted=true`, preserved upstream, and healed hooks.

VERIFY: Guard exit 0: preflight-static, smoke-static, bundled-overlay-static, hook-manifest-completeness, witness-repair-smoke-no-mutation. Exit 1 DENIED (`bash EPERM`): six Bash-backed cases. Exit 1 DENIED (`git EPERM`): both Clarity aliases. Install-contract: generated=0; empty-tree=1 DENIED; unresolved=1 DENIED. `node --check` 5/5=0; diff-check=0.

REMOVED_ASSERTIONS:

1. [A] `global hook distribution runs after smoke` → precheck < publication < banner < global dispatch.
2. [A] `global smoke runs before script dependencies` → candidate smoke precedes global dispatch.
3. [A] `${dependencyCopy} runs after global smoke` → copies precede merge; smoke precedes dispatch.
4. [A] `global settings merge runs before hook smoke` → no rejecting installed smoke; candidate smoke precedes publication.
5. [B] deployment-source `--smoke-manifest` → project-shaped `--prepare-candidate` all-hook smoke.
6. [A] repo distribution missing → transactional delegation with local writers forbidden.
7. [B] Codex/repo copy order → one sealed candidate contains both before smoke/publication.
8. [A] Codex refusal before writer → detection < smoke < substrate check < publication.
9. [A] `[scriptPath]` → exact `[scriptPath,...argv]`.
10. [A] ignored stdio → exact piped stdio.
11. [A] fixed payload keys → event-aware keys plus conditional `tool_use_id`.
12. [A] `tool_name=Read` → descriptor matcher tool.
13. [A] Read input → exact Read/MCP-v2 input.
14. [A] `{ok:true}` → exact Read/bounded MCP response.
15. [A] hidden `MODULE_NOT_FOUND` → structured fields, one-line ≤2048 bytes, no raw stack.
16. [A] per-hook missing code → closed `hook_smoke_failed` plus exact module request.
17. [B] every missing path → fail-fast reports the first owning source exactly; all-row emission no longer exists.
