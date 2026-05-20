---
milestone: v3.0
title: SGSD-PRO — Codex-native execution + Mesh Memory Lite + Context Authority
why: >-
  Three failure modes accumulated through v2.x are now structural, not incidental:
  (1) ATC reviewer hallucination — Clarity ERP v22-13c Plan 01 incident on 2026-05-18
  where ATC v4 returned CRIT against refuting file:line evidence; (2) board
  escalation to operator because milestone context is not carried forward agent
  to agent; (3) cognitive context dies between sessions because memory is raw
  transcript replay, not lineaged role-filtered understanding.
  Pi2Pi (Indie Dev Dan, 2026-05-20) and the Mesh Memory Protocol paper
  (Hongwei Xu, arXiv 2604.19540) surface the same missing layer: per-field
  receiver admission, signal-level lineage, and write-time-filtered remix memory.
  SGSD-PRO adds that layer underneath SGSD's existing control plane, plus
  formalises Codex Pro Mode lanes and the Context Authority capsule already
  scoped in .planning/proposals/2026-05-20-sgsd-pro-mode-codex-context-authority-plan.md.
outcome_delivered: >-
  SGSD can preserve milestone context across gates, validate reviewer claims
  against current evidence, detect stale/echoed findings via lineage, produce
  bounded pseudo-operator recommendations before escalating, and route Codex
  through typed lanes with hooks-enforced write boundaries — without copying
  Pi-harness substrate or sym-mesh-channel dependencies. Mesh-shaped memory,
  central-shaped runtime; SGSD remains the mission/governance/promotion
  authority.
parent_project: Super GSD Framework
created_at: 2026-05-20
closed_at: null
entry_criteria:
  - DLB-07 (semantic vs structural verification) landed @ commit 2fa3bbc
  - plan-schema-v2 SCHEMA-09/-10 enforcement live (rejects plans without semantic_acceptance_criteria)
  - sgsd-audit@v2 Layer 4 semantic-AC enforcement landed @ commit 699936f
  - Statusline reliability fixes landed @ commits 5a26023 + 6cd6c2f
  - SGSD-PRO master proposal ingested at .planning/proposals/2026-05-20-sgsd-pro-mode-codex-context-authority-plan.md
  - Pi2Pi transcript + Mesh Memory Protocol paper fully ingested (meeting 81e85fd0-33c8-478d-924e-20e616440e81)
exit_criteria:
  - All four MVP success fixtures green
      - "Fixture A: ATC v22-13c-style false CRIT is refuted and does not wake real operator"
      - "Fixture B: context-aware pseudo-operator recommendation is produced before escalation"
      - "Fixture C: lineage chain execution_receipt → review_finding → evidence_verdict → decision_recommendation → promotion_decision is visible end-to-end"
      - "Fixture D: production/SAP/Mongo/Qdrant destructive write scenario forces real operator escalation despite pseudo-op confidence ≥0.80"
  - DLB-08 Mesh Memory Lite implementation complete (7 CMB types, schema, hash rules, lineage DAG, echo detector, evidence validator, pseudo-operator peer, escalation gate)
  - DLB-09 first Codex Pro Mode phase shipped (profile resolver + stoplight + native review)
  - DLB-10 Context Authority capsule defined for at least one milestone (MILESTONE-CONTEXT.yaml + PERSONA-MATRIX.yaml + LEXICON.yaml + SOURCE-OF-TRUTH.yaml + NON-GOALS.yaml + DOMAIN-ONTOLOGY.yaml)
  - Every v3.0 PLAN.md ships with semantic_acceptance_criteria from day one (eat our own dog food; SCHEMA-09 enforces)
non_goals:
  - No Pi-agent-harness dependency at any layer (Anthropic OAuth ToS forbids it; operator constraint)
  - No sym-mesh-channel dependency in critical path (optional experiment branch only; Anthropic plugin propagation still resolving per github.com/anthropics/claude-plugins-official/issues/1512)
  - No concurrent autonomous agent mesh (logical peers + sequential runtime only; single-machine practicality)
  - No executor-authored CMBs in MVP (Codex executor contract unchanged; SGSD emits execution_receipt CMBs from observable facts)
  - No embedding-backed SVAF in first slice (deterministic Tier 0 + heuristic Tier 1 only; LLM judge Tier 2 inside pseudo-operator)
  - No autonomous production/SAP/Mongo/Qdrant mutation under any pseudo-operator confidence
  - No replacement of SGSD's central control plane with peer-only governance
open_questions:
  - How is operator_precedent CMB emission triggered — auto on any operator decision touching SGSD state, or explicit "remember this" annotation?
  - Should role-anchor weights (α_f) be expressed per-role in a single YAML or per-decision-class? Static priors only in MVP, no learning.
  - At what milestone do we introduce embedding-backed admission (Tier 3 SVAF) — after first full v3.0 cycle, or deferred to v3.1?
  - Cross-milestone CMB visibility — does the evidence-validator in milestone N see operator_precedent CMBs from milestone M-2? Single global memory or per-milestone partitioning with explicit cross-refs?
---

# v3.0 SGSD-PRO — INTENT

## Why (strategic rationale)

Three failure modes that surfaced through v2.x are now structural:

1. **Reviewer hallucination as gate-blocker.** ATC v4 on Clarity v22-13c Plan 01 (2026-05-18) returned CRIT against file:line evidence that refuted the claim. SGSD's binary "if CRIT then fail" rule treated a false positive as a hard stop. The fix is not "trust the reviewer more"; it is "make every claim evidence-validated against current HEAD before it blocks anything."

2. **Board escalation to operator caused by lost context, not by genuine ambiguity.** When triage/board agents deliberate and then point back to the real operator, it usually means context — milestone WHY, persona priority, source-of-truth rules, prior decision precedents — was not carried agent-to-agent. The operator is currently the only persistent store of "why are we doing this for whom?" SGSD should store that itself.

3. **Memory dies between sessions.** Sub-agent dispatch contexts evaporate. Each board round re-derives understanding from raw checkpoints. There is no per-role "what I understood, why I accepted it, where it came from, whether it's original or echoed" memory layer.

Pi2Pi (Indie Dev Dan, 2026-05-20) is the operational pattern that gestures at this gap. MMP (Hongwei Xu, arXiv 2604.19540) is the formal protocol that names the three problems — per-field receiver admission (P1), signal-level lineage (P2), write-time-filtered memory (P3) — and specifies four primitives (CAT7 envelope, SVAF gate, lineage DAG, remix invariant) that solve them jointly.

SGSD-PRO **steals the invariants, not the implementations**. We cannot use the Pi harness (Anthropic OAuth ToS), we lack the multi-device topology MMP demos on, and we are deliberately not adopting third-party runtime dependencies (sym-mesh-channel) in the critical path. What we adopt is the architectural shape: lineaged role-filtered memory underneath SGSD's existing control plane.

## Outcome (Jobs-To-Be-Done)

Operators run SGSD knowing that:

- Reviewer false positives don't freeze the loop — each CRIT is evidence-validated against current HEAD; only `FAIL_VERIFIED` blocks.
- Stale findings from earlier rounds don't re-block — lineage DAG detects echoes via O(1) ancestor-set intersection.
- Board deliberations produce context-aware answers — every gate-failure routes through context composer + pseudo-operator before hitting the operator escalation gate.
- The operator is consulted only when their authority is genuinely required — production mutation, low pseudo-op confidence, security/credential issues, milestone scope change, commercial/legal impact — never because the board lacked persona/lexicon/precedent context.
- Codex is dispatched through typed lanes with hooks-enforced write boundaries — no more "send it to Codex" generic prompts; lane stoplighting (GREEN/AMBER/RED) before any write permission.

## How we'll know

Four green fixtures define the close (see `exit_criteria` above). The lineage-chain fixture (C) is the existence proof of the mesh memory layer; the false-CRIT fixture (A) is the load-bearing bug we are fixing; the context-aware-pseudo-op fixture (B) is the operator-escalation reduction proof; the production-mutation fixture (D) is the restraint proof — autonomy is the headline, restraint is the safety case.

## Architectural axiom

```
Mesh-shaped memory, central-shaped runtime.
SGSD = air traffic control.
Codex/Claude/agents = aircraft.
Mesh Memory Lite = shared radar + black box + radio protocol.
Pseudo operator = trained duty officer.
Real operator = commander, only called when authority is exceeded.
```

We are not building concurrent autonomous mesh convergence. We are building lineaged role-filtered memory under a central serialized orchestrator. Honest framing prevents claims we cannot back.

## Workstream sequence

1. **DLB-08 Mesh Memory Lite** (phases 106–109) — the substrate. CMB schema, execution receipts, review-finding/evidence-verdict/decision-recommendation/operator-precedent emission, lineage DAG, echo detection, pseudo-operator peer, escalation gate.
2. **DLB-09 Codex Pro Mode** (phases 110–111) — typed Codex lanes, stoplight routing, native review, PLAN-LOCKED.md contract, Codex hooks.
3. **DLB-10 Context Authority** (phase 112) — per-milestone YAML capsule, context_anchor CMBs, integration with pseudo-operator's Tier 2 LLM judge.

DLB-08 first because the other two depend on the CMB substrate. DLB-09 second because Codex Pro Mode tightens the executor surface that DLB-08 emits receipts FROM. DLB-10 third because it expands what context_anchor CMBs can project from.

## Cross-references

- `.planning/proposals/2026-05-20-sgsd-pro-mode-codex-context-authority-plan.md` — master proposal (53KB) ingested 2026-05-20
- `.planning/analyses/2026-05-20-sgsd-pro-mode-codex-infographic.html` — visual companion (60KB)
- `.planning/decisions/DLB-07-semantic-vs-structural-verification.md` — predecessor; established the evidence-backed review principle
- `.planning/decisions/DLB-08-MESH-MEMORY-LITE.md` — this milestone's design lock
- Pi2Pi meeting `81e85fd0-33c8-478d-924e-20e616440e81` (VTP) — operational pattern source
- `wiki/research/mesh-memory-protocol.md` (VTP) — formal protocol source (arXiv 2604.19540)
- `super-gsd/templates/plan-schema-v2.json` — v3.0 plans MUST include `semantic_acceptance_criteria` per SCHEMA-09 (eat our own dog food)
- `super-gsd/skills/sgsd-audit/SKILL.md` (sgsd-audit@v2) — consumes evidence_verdict CMBs from P108 onward
