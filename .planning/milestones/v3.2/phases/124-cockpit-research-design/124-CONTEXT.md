---
phase: 124
phase_name: Cockpit Research + Design Lock
milestone: v3.2
created: 2026-05-22
status: queued-research
implementation_status: not-started
source: DLB-12.5 — Operator Comprehension System; WS-B phase 1 (research/design, no code mutation)
predecessor: v3.2 P123 PASS (WS-A complete — chronicle HTML upgraded to gold-reference, 111/111 self-test)
ws: B
---

# Phase 124 — Cockpit Research + Design Lock

> First WS-B phase. A research/design phase: produces an evidence-grounded cockpit design spec and a design lock; ships no source code. P125-P127 implement against this spec.

## Goal

After P124, SGSD has a locked, book-grounded cockpit design spec answering: what form factor (terminal / HTML / both), what the North-Star ranking surfaces, what the alert grammar is, and how `cockpit-sidecar.cjs` evolves into a glanceable answer-first surface. Every design choice cites a retrieved book principle or is explicitly flagged un-grounded.

## Why this phase exists

WS-A made the *after-the-fact* chronicle world-class. The cockpit is the operator's *live* surface and lags it. DLB-12 invariant 2 (answer-first everywhere) and invariant 4 (preattentive discipline) apply to a live dashboard even harder than to a static report. Before evolving `cockpit-sidecar.cjs` (P126) we need a research-locked spec so the redesign is grounded, not improvised.

## Binding invariants (from DLB-12)

1. **Cockpit evolves `cockpit-sidecar.cjs` only (invariant 3).** Zero touches to the v2.9 Lock-13 frozen cockpit array — `super-gsd/tools/cockpit-state/*`, `super-gsd/tests/cockpit-acceptance/*`, `super-gsd/tests/cockpit-regression/*`. The sidecar reads signals; it does not rebuild the read-surface.
2. **One shared design system (invariant 1).** The cockpit consumes the P120 shared stylesheet + honours the P120 12-rule conformance checklist. No per-surface CSS divergence.
3. **Answer-first (invariant 2).** The cockpit leads with the single North Star; support sits beneath. The cockpit North-Star banner and the chronicle Operator Decision Panel are the same idea in two tenses.
4. **Preattentive discipline (invariant 4).** Exactly one element grabs the eye; colour used sparingly.
5. **Projection, never opinion (invariant 5).** The cockpit shows live SGSD state read-only — never an agent opinion layer.
6. **Book-research-grounded (invariant 6).** Every design choice cites a retrieved principle. P124 MUST query all 7 books — the 4 from the 2026-05-22 study (Minto Pyramid Principle, Made to Stick, Storytelling with Data, Back of the Napkin) PLUS the 3 since ingested (Resonate, Simply Said, Thing Explainer). The 3-absent-books gap from the WS-A study is now closed.

## Scope of the research pass

1. **VTP 7-book research.** Query all 7 communication books for live-dashboard / cockpit / glance-comprehension principles: information overload, preattentive attributes, North-Star / Commander's Intent ranking, alert design, colour discipline, threshold-to-alert grammar. Pull the chart-redesign book figures (c05f017, c07f034, c05f011, …) cited in the WS-A study. Separate direct evidence (chunk/figure id + similarity) from synthesis.
2. **Current-cockpit audit.** Read `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` and `super-gsd/tools/cockpit-sidecar/fog-score.cjs`. Document: what signals it reads, current output form factor, where it diverges from answer-first / preattentive discipline, what stays vs changes.
3. **Form-factor decision.** Decide terminal / HTML / both, with evidence. The sidecar today is a JSON/text CLI; the spec must say what it becomes.

## Deliverables (no source code)

| Path | Op |
|---|---|
| `.planning/milestones/v3.2/phases/124-cockpit-research-design/124-RESEARCH.md` | create — VTP 7-book research findings + current-cockpit audit, answer-first |
| `.planning/milestones/v3.2/phases/124-cockpit-research-design/124-COCKPIT-DESIGN-SPEC.md` | create — the locked cockpit design spec P125-P127 implement against |
| `.planning/milestones/v3.2/phases/124-cockpit-research-design/124-VERIFICATION.md` | create — phase-close verdict |

## Acceptance criteria

This is a research/design phase — acceptance is document-completeness, not a self-test runner.

1. 124-RESEARCH.md queries all 7 books; every principle carries a chunk/figure id + similarity score; synthesis is separated from direct evidence.
2. 124-RESEARCH.md audits the current `cockpit-sidecar.cjs` + `fog-score.cjs` — signals read, form factor, divergence from answer-first/preattentive.
3. 124-COCKPIT-DESIGN-SPEC.md locks: form factor (with evidence), the North-Star ranking concept (P125), the alert-grammar concept (P125), the answer-first surface layout (P126), and the cross-surface conformance hook (P127).
4. Every spec choice traces to a retrieved principle or is explicitly flagged un-grounded.
5. The spec honours all 6 DLB-12 invariants — explicitly no Lock-13 touches.

## Out of scope

- Any source-code change (P125 alert grammar, P126 surface, P127 integration implement the spec).
- Touching `super-gsd/tools/cockpit-state/*` or the Lock-13 frozen array.
- Re-opening WS-A (chronicle renderer / validator / data model).
- Ingesting more books — the 7-book base is now complete.

## Cross-references

- `.planning/decisions/DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md` — design lock; invariants + P124-P127 map
- `.planning/analyses/2026-05-22-chronicle-html-book-research.html` — WS-A 7-output study; 12 rules R01-R12; the 4-book base P124 extends to 7
- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` — the cockpit surface WS-B evolves
- `super-gsd/tools/cockpit-sidecar/fog-score.cjs` — the v3.1 P118 fog-score input
- `super-gsd/tools/shared/sgsd-design-system.css` + `design-rules.json` — P120 shared system the cockpit must consume
- `.planning/milestones/v3.2/ROADMAP.md` — P124-P127 row detail
