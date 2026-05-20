# Milestone v3.0 — SGSD-PRO

Status: ACTIVE, planning-only scaffold; no source mutations until P106 CONTEXT is reviewed and PLAN-LOCKED.md is authored.
Created: 2026-05-20
Phase range: 106-112 (7 phases)
Source proposal: `.planning/proposals/2026-05-20-sgsd-pro-mode-codex-context-authority-plan.md`
Driving decision: `.planning/decisions/DLB-08-MESH-MEMORY-LITE.md`
Predecessor: v2.9 ALL-PHASES-CLOSED 2026-05-18 (DLB-07 protection plan complete)

## Mission

Make SGSD more autonomous without making it less governable.

Add lineaged role-filtered memory underneath the existing control plane, typed Codex lanes around the existing executor surface, and per-milestone Context Authority capsules above the existing decision-log substrate — without copying Pi-harness internals, without depending on third-party mesh transport in the critical path, and without surrendering SGSD's role as the central mission/governance/promotion authority.

## Workstream → Phase Mapping

| Phase | DLB | Workstream | Goal |
|---:|---|---|---|
| 106 | DLB-08.1 | Mesh Memory Lite | CMB schema + canonical payload hashing + 7 typed CMB classes + fixture contract (good × 7, bad × 6). Schema only; no tools, no hooks, no implementation. |
| 107 | DLB-08.2 + DLB-08.3 | Mesh Memory Lite | SGSD-emitted `execution_receipt` CMBs (post-executor observable facts) + reviewer-emitted `review_finding` CMB writer (one CMB per ATC finding). Lineage from receipts → findings auto-linked. |
| 108 | DLB-08.4 + DLB-08.5 | Mesh Memory Lite | `evidence_validator` (Tier 0 deterministic + Tier 1 heuristic admission states: REDUNDANT/ALIGNED/GUARDED/REJECTED → VERIFIED_CRIT/REFUTED_CRIT/STALE_CRIT/UNVERIFIED_CRIT) + lineage DAG (parents + ancestors) + echo detector (O(1) ancestor-set intersection). Wires into sgsd-audit@v2 Layer 4 as a CMB consumer. |
| 109 | DLB-08.6 + DLB-08.7 | Mesh Memory Lite | `pseudo_operator_peer` (Tier 2 LLM judge over admitted CMBs; emits `decision_recommendation` CMBs with authority level + confidence + evidence citations) + `escalation_gate` with hard carve-outs (production mutation always escalates; confidence < 0.70 always escalates; commercial/security/scope-change always escalates). Operator decisions become `operator_precedent` CMBs. |
| 110 | DLB-09.1 | Codex Pro Mode | Typed Codex profiles (10 lanes per SGSD-PRO §4.1) + stoplight routing (GREEN/AMBER/RED per §4.2) + native Codex review as first-class gate (§4.5). Native review runs BEFORE SGSD ATC and emits review_finding CMBs. |
| 111 | DLB-09.2 | Codex Pro Mode | `PLAN-LOCKED.md` formal lock + `.codex/hooks.json` write-lane safety rails (block-forbidden-write, block-secret-leak, enforce-allowed-files, validate-stop-contract). Plan-lock validates against plan-schema-v2 (P97.5) AND requires non-empty `semantic_acceptance_criteria` AND lists allowed_files explicitly. |
| 112 | DLB-10.1 | Context Authority | Per-milestone YAML capsule (MILESTONE-CONTEXT, PERSONA-MATRIX, DOMAIN-ONTOLOGY, LEXICON, SOURCE-OF-TRUTH, NON-GOALS) + `context_anchor` CMB projection layer (canonical truth stays in YAML; CMBs carry projection lineage with `canonical_source_path` + `canonical_source_hash`). Pseudo-operator (P109) gains full context-pack input. |

7 phases. Sits inside the operator's stated 5-8 range.

## Exit Criteria (the four green fixtures)

| Fixture | Demonstrates | Phases |
|---|---|---|
| **A** | ATC v22-13c-style false CRIT is refuted by evidence_validator against current HEAD and routes to `PASS_WITH_REFUTED_REVIEW` without waking the real operator | 106, 107, 108 |
| **B** | Context-aware `decision_recommendation` CMB produced by pseudo_operator before any operator escalation; cites milestone context anchors + decision precedents | 106, 107, 108, 109, 112 |
| **C** | Full lineage chain visible end-to-end: `execution_receipt` → `review_finding` → `evidence_verdict` → `decision_recommendation` → `promotion_decision` | 106, 107, 108, 109 |
| **D** | Production / SAP / Mongo / Qdrant destructive write scenario forces real operator escalation despite pseudo-op confidence ≥0.80 (the restraint proof) | 109 |

Fixture C is the existence proof of the mesh memory layer.
Fixture A is the load-bearing bug we are fixing.
Fixture B is the operator-escalation reduction proof.
Fixture D is the safety case — autonomy without restraint is unsafe.

## Required Reading (before any phase dispatches Codex)

1. `.planning/proposals/2026-05-20-sgsd-pro-mode-codex-context-authority-plan.md` — master proposal
2. `.planning/decisions/DLB-08-MESH-MEMORY-LITE.md` — design lock
3. `.planning/decisions/DLB-07-semantic-vs-structural-verification.md` — predecessor; evidence-backed-review principle
4. `.planning/milestones/v3.0/phases/106-mesh-cmb-schema/106-CONTEXT.md` — schema contract
5. `super-gsd/templates/plan-schema-v2.json` — every v3.0 plan must validate against this (SCHEMA-09 + semantic_acceptance_criteria required)
6. `super-gsd/skills/sgsd-audit/SKILL.md` — sgsd-audit@v2; the audit-gate Layer 4 wires into the mesh at P108
7. `wiki/research/mesh-memory-protocol.md` (VTP) — formal protocol reference (arXiv 2604.19540)
8. Pi2Pi meeting transcript `81e85fd0-33c8-478d-924e-20e616440e81` (VTP) — operational pattern reference

## Non-Negotiable Rules (DLB-08-derived)

1. **SGSD remains the central control plane.** Mission, phase boundaries, allowed files, write authority, promotion, commit, rollback, and real operator escalation are SGSD-owned. Mesh peers deliberate; SGSD decides.
2. **Observations ≠ claims ≠ decisions.** SGSD emits `execution_receipt` CMBs from observable facts. Agents emit `review_finding` CMBs (claims). Validators emit `evidence_verdict` CMBs (verdicts on claims). Pseudo-operator emits `decision_recommendation` CMBs. Operators emit `operator_precedent` CMBs. **SGSD must never treat a claim CMB as an observation CMB.**
3. **CAT7 is an envelope, not an ontology.** CAT7 fields wrap domain content; they do not replace MILESTONE-CONTEXT.yaml / PERSONA-MATRIX.yaml / LEXICON.yaml. CAT7 fields cite anchors; they must not invent new authority terms.
4. **No executor-authored CMBs in MVP.** Codex executor's report contract is unchanged. SGSD wrapper observes what happened and emits `execution_receipt` CMBs from facts. This is the load-bearing safety property: agents emit claims; SGSD emits observations.
5. **Hard carve-outs for operator escalation.** Production / SAP / Mongo / Qdrant destructive writes always escalate to real operator. Credential or security issues always escalate. Milestone scope change always escalates. Commercial/legal/policy implications always escalate. Pseudo-op confidence < 0.70 always escalates. No pseudo-operator heroics under any of these conditions.
6. **Mesh-shaped memory, central-shaped runtime.** Logical peers, sequential execution. Honest framing; no concurrent-autonomous claims we cannot back at N=1 machine.
7. **No Pi dependency. No sym-mesh-channel dependency in critical path.** Both are optional experiment branches only. Anthropic OAuth ToS forbids Pi for Claude; sym-mesh-channel propagation through Anthropic registry is still resolving.
8. **Eat our own dog food.** Every v3.0 PLAN.md must include `semantic_acceptance_criteria` per SCHEMA-09 (P97.5 enforcement). The v3.0 plans validate against the schema v3.0 itself extends.

## What v3.0 Unlocks

- Reviewer reliability becomes measurable, not assumed (`atc-reviewer-reliability.jsonl` reliability ledger appended on every refuted CRIT).
- Operator escalation becomes the exception, not the default — context loss as the root cause is structurally fixed.
- Cross-session continuity through write-time-filtered remix memory — sessions restart into role-specific working context, not raw transcript replay.
- Codex dispatch is typed and stoplight-routed — no more "send it to Codex" generic prompts.
- Every milestone going forward has a Context Authority capsule (MILESTONE-CONTEXT / PERSONA-MATRIX / LEXICON / SOURCE-OF-TRUTH / NON-GOALS) so board deliberations operate from shared context.

## First Execution Command

When P106 CONTEXT.md is reviewed and the operator authorises implementation:

```powershell
cd C:\Users\jack.berrow\GSDedits
# write 106-01-PLAN.md against plan-schema-v2 (with semantic_acceptance_criteria)
# then dispatch Codex via super-gsd/scripts/codex-executor.sh with read-pack fallback
```

If SGSD does not auto-detect v3.0 active milestone, run `/sgsd-progress` first to confirm STATE.md repointed.

## Drift Risks (carried forward from DLB-08)

These eight drift modes will be re-checked at every phase close:

1. Treating CMBs as generic chat messages instead of typed cognitive memory.
2. Letting executors author CMBs in MVP (out of scope; SGSD emits receipts on their behalf).
3. Treating reviewer claims as observations (claim CMBs ≠ observation CMBs).
4. Letting CAT7 replace the domain ontology instead of wrapping it.
5. Allowing pseudo-operator to bypass hard operator carve-outs under high confidence.
6. Adding embeddings before deterministic evidence validation works.
7. Turning Mesh Memory Lite into a concurrent autonomous agent mesh.
8. Pulling in Pi / sym-mesh dependencies before local SGSD memory works.
