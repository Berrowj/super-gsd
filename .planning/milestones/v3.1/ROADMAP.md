# Milestone v3.1 — SGSD Chronicle Layer

Status: ACTIVE 2026-05-21
Created: 2026-05-21
Phase range: P113–P119 (7 phases)
Source design: `.planning/decisions/DLB-11-CHRONICLE-LAYER.md`
Predecessor: v3.0 ALL-PHASES-CLOSED @ `a19528a` (DLB-08 + DLB-09 + DLB-10 complete)

## Mission

Prevent operator brain fog by making SGSD explain itself so well that the operator can safely delegate without becoming detached from their own repo.

Every phase close (and milestone close) generates a validated Operator Chronicle: HTML + Markdown + JSON + manifest, projected from mesh memory + canonical artefacts + cockpit logs + git evidence. Chronicle is a projection of SGSD truth, never an agent opinion.

## Workstream → Phase Mapping

| Phase | DLB | Workstream | Goal |
|---:|---|---|---|
| 113 | DLB-11.1 | Chronicle schema | `chronicle.schema.json` + `chronicle-manifest.schema.json` + ajv-errors error codes (CHRONICLE-XX) + fixtures (good × N, bad × M) |
| 114 | DLB-11.2 | Context-pack builder | `super-gsd/tools/chronicle/build-context-pack.cjs` — reads mesh ledger + phase artefacts + git evidence + cockpit logs; produces `CHRONICLE-CONTEXT.json` |
| 115 | DLB-11.3 | HTML renderer + PUML diagrams | `super-gsd/tools/chronicle/render-html.cjs` — deterministic Node.js tool (NOT a Codex dispatch; per DLB-11 R3). Consumes CHRONICLE-CONTEXT.json; emits self-contained `phase-chronicle.html`. Diagrams authored as PlantUML source in `super-gsd/tools/chronicle/templates/puml/*.puml`, pre-rendered via local `plantuml.jar` to inline SVG, and embedded with `<details>` PUML source for transparency. Components labelled with actual repo paths; arrows labelled with intent; clarity-board-deck colour scheme (sage = shipped, terracotta = added, amber = at-risk, slate = read-only). Section templates in `super-gsd/tools/chronicle/templates/sections/*.md` drive synthesis via cited-slot injection. Also emits `.md` + `.json` companions. |
| 116 | DLB-11.4 | Chronicle validator + benchmark | `super-gsd/tools/chronicle/validate-chronicle.cjs` — verifies every claim in HTML links to CMB/file/test/plan; rejects REPORT_UNGROUNDED; binding gate at phase close. Validates against `super-gsd/tools/chronicle/benchmarks/good-*.json` (≥4) and `bad-*.json` (≥4) — known-grounded vs known-ungrounded fixtures; throughput floor <2s/chronicle; ≥95% precision on held-out set authored at P119. Rejects broken citations (REPORT_BROKEN_CITATION) and external PUML includes. |
| 117 | DLB-11.5 | Storage adapter | `super-gsd/tools/chronicle/publish.cjs` — VTP-MCP first if available; local `.planning/chronicles/` fallback; updates index ledger |
| 118 | DLB-11.6 | Cockpit integration | Chronicle links + Fog Score badge in cockpit-state; chronicle ↔ cockpit cross-references. Inherits v2.9 DEFERRED-2 (12th cockpit section) or works around. |
| 119 | DLB-11.7 | Milestone Chronicle + roadmap miner | `super-gsd/tools/chronicle/milestone-chronicle.cjs` (cross-phase narrative); `super-gsd/tools/chronicle/mine-roadmap.cjs` (process-mining over closed milestones) |

## Exit Criteria

1. Every v3.1 phase closes with a validated Operator Chronicle (HTML + MD + JSON + manifest)
2. chronicle-validator (P116) rejects any HTML claim lacking CMB/file/test/plan reference
3. Phase close is BINDING-GATED on chronicle validation (REPORT_UNGROUNDED halts close)
4. At least one v3.1 milestone-level chronicle authored (P119)
5. Fog Score computed + recorded per phase
6. Roadmap miner produces at least one cross-milestone retrospective artifact
7. v3.0's own milestone-chronicle retrospectively authored (the one-off backport question)
8. Every chronicle ships PUML source for every diagram (committed + inlined as `<details>`); no rendered-only SVG
9. Every chronicle includes a populated (or empty-with-reason) `denominators[]` panel
10. Chronicle Validator benchmark: ≥4 good × ≥4 bad fixtures green; <2s/chronicle throughput; ≥95% held-out precision

## Non-Negotiable Rules (DLB-11-derived)

1. **Chronicle is a projection, never canonical truth.** Every claim links to a CMB key, file path, test name, or commit SHA. Synthesis (ELI5, "remember tomorrow") sits on top of cited evidence.
2. **Observations / claims / decisions stay separated** (inherited from DLB-08). Chronicle's section structure mirrors the cognitive class structure.
3. **Validator runs before publish.** REPORT_UNGROUNDED chronicles are never operator-facing.
4. **Static, self-contained HTML.** Inline SVG, no CDN, no JS deps. Survives offline + locked-down repos.
5. **Forward-only backport policy.** v3.0 phases (P106-P112) closed without chronicles; not retrofitted. Open question: one-off v3.0 milestone retrospective in P119.
6. **Phase close binding gate.** Phase status `PHASE_COMPLETE_PENDING_CHRONICLE` → `PHASE_CHRONICLE_RENDERED` → `PHASE_CHRONICLE_VALIDATED` → `PHASE_CLOSED`. No phase advances past pending without validator green.
7. **Roles stay separate.** Executor does work. SGSD emits observation. Reviewer claims. Evidence validator validates. Pseudo-operator decides. **Chronicle Writer renders.** **Chronicle Validator checks.** Six roles; no overlap.
8. **No agent self-promotion.** The executor that did the work does NOT write the chronicle of that work. Separate role + separate Codex dispatch.
9. **Chronicle Writer is a deterministic tool, never a Codex dispatch.** (DLB-11 R3). All synthesis prose (ELI5, "remember tomorrow", risks, persona impact) flows from operator-authored section templates with cited-slot injection. No agent prose. Missing evidence → MISSING_EVIDENCE placeholder + REPORT_UNGROUNDED.
10. **Architecture diagrams in PlantUML source.** (DLB-11 R1). All architecture / lineage / flow / persona-lane diagrams authored as `.puml` files (committed, diff-able), pre-rendered to SVG via local `plantuml.jar`, inlined into HTML with collapsible PUML source for transparency. Components labelled with actual repo paths; arrows labelled with intent. clarity-board-deck colour scheme. No external `!include http://...`. Operator owns `plantuml.jar` install (precondition); absence is REPORT_TOOLCHAIN_MISSING (distinct from REPORT_UNGROUNDED), with explicit `skip_gates: ["puml-render"]` fallback to hand-coded SVG generator + visible banner.
11. **Denominator panel mandatory.** (DLB-11 R2). Every chronicle's Agent Autonomy Disclosure includes a `denominators[]` array: scope_excluded / carve_outs_not_fired / alternatives_rejected / assumptions_made / gates_skipped. Forage V2 "denominator blindness" countermeasure. Empty array allowed only with `denominators_empty_reason:`.
12. **CMB by-reference storage.** (DLB-11 R5). Chronicle JSON / manifest stores CMB IDs, never full CMB bodies. Mesh ledger remains single source of truth. Validator cross-checks live citations; broken citations → REPORT_BROKEN_CITATION.

## What v3.1 Unlocks

- Operators can resume work after long autonomous runs without losing the mental model.
- Roadmap mining produces "this milestone resembles V_X, which had Y problems; consider Z" recommendations.
- VTP-stored chronicles become queryable long-term personal memory ("why did we build Mesh Memory Lite?").
- Fog Score becomes a metric SGSD can optimize against (lower fog = better operator delegation safety).
- Operator-trust audit trail: every autonomous decision is disclosed in the chronicle's "Agent Autonomy Disclosure" panel.

## Drift Risks (re-checked at every phase close)

1. **Chronicle becomes another agent opinion.** Prevented by: validator binding gate + every claim must cite.
2. **Synthesis bloat.** Prevented by: ELI5/recommendations sections SIZED + cite-or-omit rule.
3. **Phase close gates degrade to advisory.** Prevented by: REPORT_UNGROUNDED hard-halt (binding gate per operator decision 2026-05-21).
4. **External CDN/JS dependencies creep in.** Prevented by: self-contained-HTML invariant + validator check.
5. **Backport scope creep.** v3.0 stays untouched per forward-only policy. P119 may write ONE v3.0 milestone retro at most.
6. **VTP storage becomes critical-path dependency.** Prevented by: VTP-first / local-fallback routing — chronicle generation never blocks on VTP availability.
7. **Cockpit-Chronicle overlap.** Prevented by: enforced different roles (Cockpit = live; Chronicle = post-phase narrative).
8. **Chronicle writer becomes the same agent that did the work.** Prevented by: separate role enforcement + Chronicle Writer locked to deterministic tool (R3).
9. **Denominator blindness** (Forage V2). Prevented by: explicit `denominators[]` panel; empty requires reason; validator rejects missing field.
10. **PUML toolchain drift.** Prevented by: `plantuml.jar` precondition check at first render; REPORT_TOOLCHAIN_MISSING surfaces clearly; explicit fallback path with visible banner.
11. **Chronicle storage replicates mesh ledger.** Prevented by: by-reference (CMB IDs) storage invariant; validator cross-checks live citations.

## First Execution Command

```powershell
cd C:\Users\user\GSDedits
/sgsd-orchestrate auto
```

(Same auto-loop pattern as v3.0; binding-gated on chronicle validation per phase.)
