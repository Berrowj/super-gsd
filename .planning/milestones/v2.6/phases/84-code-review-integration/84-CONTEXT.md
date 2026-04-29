---
phase: 84
phase_name: Code Review Integration Guide And Artifact Links
milestone: v2.6
created: 2026-04-29
status: in-progress
deviation_from_standard: docs+yaml phase
---

# Phase 84 -- CONTEXT

Author SGSD-WARP-CODE-REVIEW-GUIDE.md tying together the mechanical
gates (ATC / verifier / MUDA) and Warp's human Code Review panel.
Ship 1 new workflow: `SGSD: Open Review Artifacts`.

## Locked Scope

- D84.1: Guide explains 2-layer review model (mechanical gates →
  evidence; Warp Code Review → human inspection of evidence + diff).
- D84.2: New workflow `SGSD: Open Review Artifacts` lists the active
  phase's review-relevant files + last 5 commits.
- D84.3: AGENTS.md hard rules 1, 2, 5 cited where override is
  considered.
- D84.4: Cross-reference to MCP tools (sgsd_artifact_links / sgsd_current_phase / sgsd_gate_status), gate-triage skill, cockpit-review skill.

## Outputs

- super-gsd/docs/SGSD-WARP-CODE-REVIEW-GUIDE.md (NEW)
- .warp/workflows/sgsd-open-review-artifacts.yaml (NEW)
- 5 Phase 84 standard artifacts

## Acceptance

1. Guide explains 2-layer review model.
2. Workflow lints clean (Phase 64 lint).
3. Search terms include `review`, `code-review`, `atc`.
4. AGENTS.md hard rules cited.
5. MCP tools cross-referenced.
