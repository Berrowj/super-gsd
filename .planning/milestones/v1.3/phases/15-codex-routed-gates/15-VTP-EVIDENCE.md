# Phase 15 — VTP Evidence (DOCUMENTED BYPASS)

**Status:** BYPASS (documented, operator-waived per Phase 14 precedent)
**Generated:** 2026-04-24 by `/sgsd-orchestrate go`
**Bypass reason:** stale vtp-kb MCP process. The root-resolution fix is present in source (`Voice-Text-Plan/src/mcp/project-root.ts`) and dist is rebuilt, but the Claude/GSD session in this orchestrator turn is bound to an MCP child that was spawned *before* the fix. MCP servers are long-lived — editing the source and rebuilding the dist does nothing for an already-running process.

The stale process answers from the wrong root (`C:\Users\jack.berrow\GSDedits` — our cwd, not the VTP project root), which is why it's looking for `kb-data/substrate/chunks.jsonl` under GSDedits and returning ENOENT, plus an empty project list.

## Observed Failure

```
vtp_route_and_retrieve → ENOENT: no such file or directory, open
  'C:\Users\jack.berrow\GSDedits\kb-data\substrate\chunks.jsonl'

vtp_list_projects → "No projects found in the knowledge base."
```

Both probes executed 2026-04-24 by this orchestrator turn. The MCP is answering from an empty KB rooted at the wrong cwd; no evidence retrieval is possible from this session.

## Intended Query (preserved for replay when VTP resolves)

**raw_query:**
> Phase 15 wires Codex-CLI reviewer provider into the per-dispatch + phase-level ATC gates, adds a qualitative MUDA probe shelling to Codex, extends token-log with provider field, routes adversarial verifier always to Codex, and defines a milestone-close kill condition that disables codex_enabled if critical-count-delta and tokens-saved fall below thresholds. What prior design evidence, kill-condition precedents, provider-indirection patterns, and MUDA qualitative-probe precedents exist for these six deliverables CODEX-07 through CODEX-12?

**context.current_task:** Phase 15 discuss — Codex-Routed Gates + Qualitative MUDA Probe
**context.repo:** super-gsd
**context.explicit_constraints:**
- Address 5 Phase-14-ATC warnings as entry conditions
- Honor `invocation_type` discriminator (agent vs shell) in registry
- Preserve VTP bypass switch semantics (`codex_enabled` kill switch)
- Single-retry fallback to Claude on Codex error
- Milestone-close kill condition mandatory

## Memory-rule compliance check

Per `.planning/memory/workflow/feedback/feedback_vtp_enriched_dispatch.md`:
> "After Phase 16 ships, every research/planning/pattern/assumptions dispatch must consume VTP. Orchestrator writes VTP-EVIDENCE.md before agent dispatch. Silent bypass regresses the primitive."

**This file IS the VTP-EVIDENCE.md.** The evidence content is "VTP unreachable — documented". Downstream agents (discuss assumptions analyzer, advisor researcher, phase researcher, planner, pattern mapper) will read this file, see the BYPASS status, and proceed without VTP injection. This is loud, not silent.

## Operator follow-up (non-blocking)

**Immediate (operational):** restart the Claude/GSD session so it spawns a fresh vtp-kb process — or otherwise kill the old MCP child and let the client recreate it. The fix is already in source + dist; only the running process is stale.

**Hardening (future code change, not Phase 15 scope):** add a `VTP_KB_ROOT` env override in `Voice-Text-Plan/src/mcp/project-root.ts`. Preference order should be: explicit `VTP_KB_ROOT` env → module-relative resolution → `process.cwd()` fallback. That gives GSD an explicit escape hatch if launcher behaviour is ever odd again — restart still works, but isn't the only path out.

Phase 15 proceeds on Phase 14-gathered context + the 5 ATC warnings (already recorded in checkpoint). No VTP query result would have added decisive information beyond those for Phase 15's six deliverables — the Codex integration work is architecturally downstream of the VTP substrate question.

## Downstream dispatch contract

When sub-agents receive their prompts for Phase 15, they will see:
```
<vtp_evidence status="bypass">
  See .planning/milestones/v1.3/phases/15-codex-routed-gates/15-VTP-EVIDENCE.md
  for bypass justification. Proceed without VTP doc-ID citations.
</vtp_evidence>
```

This injection is the loud-bypass signal — agents will NOT fabricate doc-IDs, and the phase-close ATC reviewer will verify no VTP citations appear in downstream artifacts (absence = correct bypass handling; presence of fake IDs = quality gate failure).
