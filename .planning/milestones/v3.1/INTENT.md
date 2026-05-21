---
milestone: v3.1
title: SGSD Chronicle Layer — anti-brain-fog projection of phase truth
why: >-
  v3.0 shipped lineaged role-filtered memory (CMBs, evidence_validator,
  pseudo_operator, escalation_gate, Codex Pro Mode, Context Authority). The
  agents are now safer and more auditable but the OPERATOR can drift out of
  the loop — each phase produces 50-200 commits, 100+ self-test assertions,
  and 5-15 Codex dispatches. Without a deliberate cognitive bridge, the
  operator becomes detached from their own repo.
  The Clarity ERP 2026-05-18 incident demonstrated the cost of operator
  detachment from the inside: six phases closed PASS while end-to-end
  behavior was broken. The v3.0 substrate prevents that class of failure
  at agent layer; v3.1 prevents it at OPERATOR layer by ensuring every
  phase ships an evidence-grounded, validator-checked, operator-readable
  chronicle.
outcome_delivered: >-
  After every phase close (and every milestone close), SGSD produces a
  validated Operator Chronicle — an HTML projection of mesh memory +
  canonical artefacts + cockpit logs + git evidence. The chronicle
  separates observations / claims / evidence verdicts / decisions, links
  every claim to a citable source, includes a Fog Score gauging cognitive
  cost, and survives offline as a self-contained file. Operator can safely
  delegate without becoming detached from their own repo.
parent_project: Super GSD Framework
created_at: 2026-05-21
closed_at: null
entry_criteria:
  - v3.0 ALL-PHASES-CLOSED @ a19528a (DLB-08 Mesh Memory Lite + DLB-09 Codex Pro Mode + DLB-10 Context Authority complete)
  - HTML user-guide proof-of-concept shipped @ 6d04d19 (.planning/analyses/2026-05-21-sgsd-v3-user-guide.html)
  - All 7 CMB types live in mesh ledger
  - Codex Pro Mode lanes + escalation_gate + Context Authority context_anchor CMBs all consumable as chronicle inputs
exit_criteria:
  - Every v3.1 phase closes with a validated Operator Chronicle (HTML + MD + JSON + manifest)
  - chronicle-validator rejects any HTML claim lacking a CMB/file/test/plan reference
  - Phase close is BINDING-GATED on chronicle validation (REPORT_UNGROUNDED → phase halts)
  - At least one v3.1 milestone-level chronicle authored
  - Fog Score computed + recorded per phase chronicle
  - Roadmap miner produces at least one cross-milestone analysis artifact
non_goals:
  - No retroactive chronicles for v3.0 phases (P106-P112). Forward-only policy. Operator lived through them; backport effort exceeds value.
  - No replacement of mesh memory ledger as canonical truth (chronicle is a projection, not authority)
  - No external CDN dependencies in published HTML (offline-survivable + locked-down-repo-friendly)
  - No agent-authored "summary" replacing evidence (every claim must cite a source CMB/file/test/commit)
  - No interactive editing of chronicles post-publication (append-only or re-render fully)
  - No Pi-harness / sym-mesh-channel dependencies (inherited from v3.0 constraints)
open_questions:
  - VTP routing: VTP-MCP available but v3.0 didn't wire it to storage. Should chronicles publish to VTP via MCP when available, with local-only fallback? Or always store local + optional VTP sync?
  - Fog Score thresholds: what fog level triggers "must read sections X, Y" recommendation? Hand-coded thresholds initially; tune based on operator feedback.
  - Cockpit integration scope: v2.9 DEFERRED-2 (cockpit 12th section) was deferred under frozen-array Lock-13. P118 likely inherits this debt or works around.
  - Milestone retrospective for v3.0: one-off operator-readable v3.0 chronicle? Forward-only policy excludes per-phase backport, but the milestone-level retro might be worth a single-shot effort.
---

# v3.1 SGSD Chronicle Layer — INTENT

## Why (strategic rationale)

The v3.0 substrate (DLB-08/-09/-10) closed three failure modes at the agent layer:
- Reviewer hallucination → evidence_validator
- Lost milestone context → Context Authority capsule
- Session memory death → mesh ledger + lineage DAG

A fourth failure mode remains, this one at the **operator layer**:

**Operator brain fog after autonomous phase runs.** Each v3.0 phase produces 50-200 commits, 100+ self-test assertions, 5-15 Codex dispatches, multiple writers + validators + reviewers emitting CMBs. The operator can technically resume work but loses the mental model of what just happened. Cognitive drift compounds across phases.

The Clarity ERP 2026-05-18 incident demonstrated the cost from INSIDE: six phases closed PASS while end-to-end behavior was broken, because the operator wasn't tracking what the gates actually verified vs what they claimed to verify.

v3.1 SGSD Chronicle Layer prevents that class of failure at the operator layer. After every phase (and every milestone), SGSD generates a validated HTML chronicle — a projection of mesh memory + canonical artefacts + cockpit logs + git evidence — that the operator reads to maintain cognitive grip.

## Outcome (Jobs-To-Be-Done)

After every phase, the operator has a single artefact (HTML) that answers:
- **Why did this phase exist?** (cited to CONTEXT.md / milestone INTENT)
- **What changed?** (cited to execution_receipt CMBs + git diff)
- **What did reviewers claim was wrong?** (cited to review_finding CMBs)
- **What was refuted vs verified vs stale?** (cited to evidence_verdict CMBs)
- **What did SGSD decide?** (cited to decision_recommendation + promotion_decision CMBs)
- **What should I remember tomorrow?** (synthesised but grounded in cited evidence)
- **What's risky in the next phase?** (derived from lineage + open carve-outs)

Each chronicle ships in 4 forms:
- `phase-chronicle.html` — human view (self-contained, offline-survivable)
- `phase-chronicle.md` — lightweight Markdown
- `phase-chronicle.json` — machine-readable structured report
- `phase-chronicle.manifest.json` — hashes + source CMB IDs + generated_at

## How we'll know

Four bound exit criteria (see exit_criteria above):
1. Every v3.1 phase ships a validated chronicle
2. chronicle-validator REJECTS ungrounded HTML claims
3. Phase close is binding-gated on chronicle validation
4. At least one milestone-level chronicle authored
5. Fog Score computed per phase
6. Roadmap miner produces at least one cross-milestone retrospective

## Architectural axiom (carried forward from v3.0)

```
Cockpit = live awareness.
Chronicle = post-phase understanding and long-term memory.
```

They do NOT duplicate. Cockpit answers "what's happening NOW?" Chronicle answers "what happened, and what does it mean?"

Both link to each other. Cockpit shows "Open latest chronicle." Chronicle shows "Open cockpit state at close."

## Architectural axiom (new, binding for v3.1)

```
A phase is not cognitively complete until the operator can understand it.
Technical completeness (tests pass, gates pass, promotion decision exists) is necessary but not sufficient.
SGSD optimizes for both.
```

This means: chronicle generation + validation is a phase-close gate, not a nice-to-have. REPORT_UNGROUNDED status halts phase close until fixed.

## Workstream sequence

| Phase | DLB | Topic |
|---|---|---|
| P113 | DLB-11.1 | Chronicle schema + manifest |
| P114 | DLB-11.2 | Context-pack builder (CMB + artefacts → CHRONICLE-CONTEXT.json) |
| P115 | DLB-11.3 | Static HTML renderer with inline SVG diagrams |
| P116 | DLB-11.4 | Chronicle validator (binding gate) |
| P117 | DLB-11.5 | Storage adapter (VTP-MCP routing + local fallback) |
| P118 | DLB-11.6 | Cockpit integration (chronicle links + Fog Score badge) |
| P119 | DLB-11.7 | Milestone Chronicle + roadmap miner (cross-milestone analysis) |

7 phases. Mirrors v3.0's scale.

## Cross-references

- `.planning/decisions/DLB-11-CHRONICLE-LAYER.md` — design lock (this milestone)
- `.planning/milestones/v3.0/SUMMARY.md` — v3.0 close; substrate that chronicles consume
- `.planning/analyses/2026-05-21-sgsd-v3-user-guide.html` — POC for the HTML style + ELI5 idiom
- `super-gsd/schemas/cmb.schema.json` — CMB types chronicles consume
- `super-gsd/tools/mesh-memory/*` — runtime inputs (execution_receipt + review_finding + evidence_verdict + decision_recommendation + operator_precedent + context_anchor + promotion_decision)
- DLB-08 + DLB-09 + DLB-10 — predecessor design locks
