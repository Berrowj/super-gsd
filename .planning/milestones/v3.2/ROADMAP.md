# Milestone v3.2 — Operator Comprehension System

Status: ACTIVE 2026-05-22
Created: 2026-05-22
Phase range: P120–P127 (8 phases)
Source design: `.planning/decisions/DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md`
Predecessor: v3.1 ALL-PHASES-CLOSED (DLB-11 Chronicle Layer; 96/96 self-test)
Research base: `.planning/analyses/2026-05-22-chronicle-html-book-research.html`

## Mission

Make SGSD explain itself world-class across both operator-facing surfaces. Upgrade the chronicle HTML to the gold-reference standard, and extend the same answer-first discipline to the live cockpit — one shared design system, two surfaces, 12 book-grounded comprehension rules.

## Workstream → Phase Mapping

| Phase | WS | Workstream | Goal |
|---:|---|---|---|
| 120 | shared | Shared design system | Extract the gold-reference visual language into one shared stylesheet (`sgsd-design-system.css`); formalize the 12 book-mined design rules into a machine-checkable conformance checklist both surfaces honour. |
| 121 | A | Chronicle data-model upgrade | New fields in `build-context-pack.cjs` + `chronicle.schema.json`: `big_idea`, section `signal: high\|low`, `fog.dominant_signal`, `next.primary_action` + `next.alternatives[]`, SCQA slots for the "why" section. Schema bump. |
| 122 | A | Chronicle renderer rebuild | `render-html.cjs` + section templates rebuilt to the gold-reference: Operator Decision Panel, 11-section answer-first order, SCQA framing, evidence expanders, fog gauge, inline-SVG diagrams with mandatory takeaway figcaptions. Consumes the shared stylesheet. |
| 123 | A | Chronicle validator lints + conformance | `validate-chronicle.cjs` gains: `CHRONICLE-JARGON` lint (un-expanded internal terms in ELI5/synthesis), takeaway-heading check, one-primary-action check, figcaption-≠-title check. Gold-reference structural conformance test. Chronicle self-test stays ≥96/96. |
| 124 | B | Cockpit research + design lock | Dedicated VTP research pass — pull the chart-redesign figure images (c05f017, c07f034, c05f011 …), audit the current cockpit + cockpit-sidecar.cjs, produce the cockpit design spec. Decides form factor (HTML / terminal / both) with evidence. |
| 125 | B | Cockpit alert grammar + North-Star ranking | Threshold→duration→alert→channel grammar (modelled on Designing-ML-Systems ch8). "One North Star" ranking logic — the cockpit computes the single most-important thing to surface. |
| 126 | B | Cockpit answer-first surface | Evolve `cockpit-sidecar.cjs` from JSON/text CLI into a glanceable answer-first cockpit: North-Star banner, preattentive single-alert, colour-used-sparingly, shared design system. |
| 127 | B | Cockpit integration + cross-surface conformance | Wire the cockpit to chronicle INDEX + validator log; cross-surface conformance test asserting both chronicle and cockpit obey the shared 12 rules. |

## Exit Criteria

1. `render-html.cjs` output is structurally conformant to the gold-reference (11-section answer-first order, Operator Decision Panel first)
2. `validate-chronicle.cjs` enforces the 4 new lints (CHRONICLE-JARGON / takeaway-heading / one-primary-action / figcaption-not-title)
3. One shared design-system stylesheet consumed by BOTH chronicle HTML and cockpit
4. `cockpit-sidecar.cjs` emits a glanceable answer-first cockpit surface (North Star + preattentive single-alert)
5. Cockpit has a threshold-to-alert grammar (condition + duration + channel)
6. Cross-surface conformance test green — both surfaces obey the 12 design rules
7. Chronicle self-test stays ≥96/96 green through the renderer rebuild (zero regression)
8. Cockpit research pass (P124) produced an evidence-grounded design spec citing retrieved book figures

## Non-Negotiable Rules (DLB-12-derived)

1. **One shared design system.** Chronicle HTML and cockpit consume the same stylesheet. No per-surface CSS divergence.
2. **Answer-first on both surfaces.** Lead with the decision / North Star; support beneath (Minto top-down).
3. **Cockpit evolves `cockpit-sidecar.cjs` only.** Zero touches to the v2.9 Lock-13 frozen cockpit array.
4. **Preattentive discipline.** Exactly one element grabs the eye per surface; colour used sparingly.
5. **Projection, never opinion.** DLB-11 R3 holds — chronicle claims cited; cockpit shows live state read-only.
6. **Book-research-grounded.** Every design choice traces to a retrieved principle in the 2026-05-22 research, or is flagged un-grounded.
7. **Deterministic render paths.** No LLM in either renderer.
8. **Offline-survivable.** No external CDN / JS dependencies (inherited from DLB-11).

## Drift Risks (re-checked at every phase close)

1. Chronicle + cockpit visual systems diverge → shared stylesheet + P127 cross-surface test
2. Cockpit becomes a second fog machine → preattentive + one-North-Star discipline + P124 research lock
3. Renderer rebuild regresses the 96/96 chronicle self-test → P123 conformance test gates it
4. Lock-13 violation → sidecar-only evolution; zero cockpit/* touches
5. Un-grounded design drift → every choice cites a retrieved principle; P120 conformance checklist
6. Scope creep into the 3 absent books → forward-only; ingest operator-owned, out of scope
7. Chronicle stops being a projection → DLB-11 R3 carried forward

## What v3.2 Unlocks

- Operator reads any SGSD surface — chronicle or cockpit — and comprehends in seconds, same visual language both places.
- The cockpit does the "active looking" for the operator: surfaces the one thing that matters now.
- The 12 book-mined design rules become machine-enforced, not aspirational.
- A reusable shared design system for any future SGSD operator-facing surface.

## First Execution Command

```powershell
cd C:\Users\jack.berrow\GSDedits
/sgsd-orchestrate auto
```
