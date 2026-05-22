---
plan_id: 66-01
phase: 66
title: SGSD Warp Operator Guide
type: docs-only
created: 2026-04-29
status: ready-for-execution
schema_version: 1
expected_ATC_tier: lite
model: sonnet
files_touched:
  - super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md
---

# Plan 66-01 -- SGSD Warp Operator Guide

## Tasks

| # | Task | Acceptance |
|--:|---|---|
| 1 | Author `super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md` | All 12 roadmap-required sections present (Warp-vs-PowerShell / Daily Start / Full Auto Run / Recovery / Gate Triage / Code Review / Remote Monitoring / Safe Sharing / VTP-optional / Plain PowerShell fallback / Ask Warp Agent / Don't ask Warp Agent to override) |
| 2 | Include >=10 concrete Windows paths | Reference Paths On This Machine table at end |
| 3 | TL;DR Operator Routine at end | 5-section daily loop summary -- daily start / daily check / daily recovery / daily diagnose / off-machine |
| 4 | Cross-link to Phase 63-67 deliverables | WARP-SMOKE.md / MANUAL-CHECKS.md / AGENTS.md / WARP.md / SGSD-WARP-WORKFLOWS.md / warp-doctor / warp-workflow-lint each cited by exact path |
| 5 | Verify all required sections present via grep | grep against the 12 section names returns 12/12 |
| 6 | Verify >=10 concrete paths via grep | grep `C:\\Users\\user` returns >=10 occurrences |

## Surgical Constraint (Karpathy)

Every section serves an operator workflow ("how do I do X?"). No filler
prose. No "in this section we will..." boilerplate. Each Warp Agent
example must be RUNNABLE (operator can copy-paste into Warp Agent
prompt). Each path must be the literal path on this machine (not a
placeholder).

The "What NOT to ask Warp Agent" section enforces the boundaries:
AGENTS.md hard rules 1-5 + operator brief Rules 1, 2, 9, 10. Each item
must reference which rule it projects.

## Acceptance (Plan-Level)

- All 6 tasks complete.
- Guide is single coherent doc readable from top to bottom.
- Reference paths block lists exact disk paths usable verbatim.
- TL;DR is short enough to memorise (5 sections, 3-5 lines each).
- All cross-references verified via filesystem.

## Self-Test

```bash
# All 12 required sections present
SECTIONS=("What Warp Adds" "Daily Start" "Full Auto Run" "Recovery" \
          "Gate Triage" "Code Review" "Remote Monitoring" "Safe Sharing" \
          "VTP" "Plain PowerShell" "What To Ask Warp Agent" "What NOT To Ask")
for s in "${SECTIONS[@]}"; do
  grep -q "$s" super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md || echo "MISS: $s"
done

# Path coverage >=10
echo "concrete-path count: $(grep -c 'C:\\\\Users' super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md)"

# Cross-references resolvable
for p in "WARP-SMOKE.md" "MANUAL-CHECKS.md" "AGENTS.md" "SGSD-WARP-WORKFLOWS.md" \
         "warp-doctor/check.cjs" "warp-workflow-lint/lint.cjs"; do
  grep -q "$p" super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md && echo "OK: $p" || echo "MISS: $p"
done
```

## Out Of Scope

- README.md changes (Phase 61).
- Authoring SGSD-WARP-MCP-CONTRACT.md (v2.3 Phase 68).
- Authoring SGSD-WARP-NOTEBOOK.md (v2.5 Phase 81).
