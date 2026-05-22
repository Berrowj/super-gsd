---
milestone: v3.2
title: Operator Comprehension System — answer-first chronicle + cockpit
why: >-
  v3.1 shipped the Chronicle Layer: a validated, evidence-grounded projection
  of what happened in a phase. It works — but a retrieve-per-book-first
  research pass against the VTP knowledge base (Minto Pyramid Principle,
  Made to Stick, Storytelling with Data, Back of the Napkin) produced 12
  evidence-grounded design rules and an answer-first section order that the
  current renderer does not yet implement. Separately, the cockpit — the
  operator's LIVE surface — lags the chronicle badly: it answers "what's
  happening now?" poorly. The same book principles (answer-first,
  preattentive single-focus, one North Star, colour-used-sparingly) apply to
  a live dashboard even harder than to a static report.
outcome_delivered: >-
  Both operator-facing surfaces explain SGSD world-class. The chronicle HTML
  is rebuilt to the gold-reference standard (Operator Decision Panel,
  11-section answer-first order, SCQA framing, evidence expanders, fog gauge,
  inline-SVG diagrams with takeaway captions, jargon lint). The cockpit is
  evolved from a JSON/text CLI into a glanceable answer-first surface with a
  real threshold-to-alert grammar and one-North-Star ranking. Both surfaces
  share one design system and obey one machine-checked set of 12
  comprehension rules.
parent_project: Super GSD Framework
created_at: 2026-05-22
closed_at: null
entry_criteria:
  - v3.1 ALL-PHASES-CLOSED (DLB-11 Chronicle Layer complete; 96/96 self-test green)
  - Book research complete and committed (.planning/analyses/2026-05-22-chronicle-html-book-research.html)
  - Gold-reference chronicle HTML authored (super-gsd/tools/chronicle/templates/chronicle-gold-reference.html)
  - cockpit-sidecar.cjs exists (v3.1 P118) and reads all relevant signals read-only
exit_criteria:
  - render-html.cjs produces output structurally conformant to the gold-reference (11-section answer-first order)
  - validate-chronicle.cjs enforces the new lints (CHRONICLE-JARGON, takeaway-heading, one-primary-action, figcaption-not-title)
  - One shared design-system stylesheet consumed by BOTH chronicle HTML and cockpit
  - cockpit-sidecar.cjs emits a glanceable answer-first cockpit surface (North Star + preattentive single-alert)
  - Cockpit has a threshold-to-alert grammar (condition + duration + channel)
  - Cross-surface conformance test: both surfaces obey the 12 design rules
  - Chronicle self-test stays >=96/96 green through the renderer rebuild (zero regression)
non_goals:
  - No rebuild of the cockpit from scratch; no touch of the v2.9 Lock-13 frozen cockpit array (evolve cockpit-sidecar.cjs only)
  - No ingest of Resonate / Simply Said / Thing Explainer — operator-owned, out of scope
  - No change to the chronicle's projection-not-opinion contract (DLB-11 R3 holds)
  - No LLM in either render path — both surfaces stay deterministic
  - No external CDN / JS dependencies (offline-survivable, inherited from DLB-11)
open_questions:
  - Cockpit form factor — HTML file vs terminal render vs both. P124 RESEARCH decides with evidence.
  - Whether the shared stylesheet lives in templates/ or a new super-gsd/tools/shared/ location. P120 decides.
  - Whether the cockpit refreshes on a timer or on-demand. P124/P125 decide.
---

# v3.2 Operator Comprehension System — INTENT

## Why (strategic rationale)

DLB-11 closed the fourth SGSD failure mode — operator brain fog — at the artefact level: every phase now ships a validated chronicle. v3.2 closes the gap between "a correct chronicle exists" and "the operator actually comprehends, fast, on every surface they look at."

Two things drive this milestone:

1. **The chronicle is structurally sound but not yet world-class.** The 2026-05-22 book research — retrieve-per-book-first against the VTP Qdrant base — produced 12 design rules and an answer-first 11-section order. The single highest-value finding: lead with an Operator Decision Panel, collapse the flat 17-section layout into 11 answer-first sections. All 4 retrieved books endorse "conclusion before support" under different names. None of it is wired in.

2. **The cockpit is the operator's live surface and it underperforms.** The chronicle is post-phase understanding; the cockpit is live awareness. The cockpit currently dumps JSON/text. The same book evidence — preattentive attention, one North Star not five, colour-used-sparingly, information-overload-is-the-default — is, if anything, more urgent for a live dashboard than for a static report.

## Outcome (Jobs-To-Be-Done)

After v3.2, the operator gets:

- **A chronicle that answers "can I move on?" in 5 seconds** — Operator Decision Panel at the top, then support beneath, appendix collapsed.
- **A cockpit that does the active looking for them** — surfaces the one most-important thing (North Star), highlights exactly one alert preattentively, never a wall of equal-weight status lines.
- **One consistent visual + comprehension language** across both surfaces — learn it once, read it everywhere.

## Architectural axiom (new, binding for v3.2)

```
The chronicle and the cockpit are two views of one truth, not two codebases.
One shared design system. One set of 12 comprehension rules. Answer-first on both.
```

## Workstream sequence

| Phase | WS | Topic |
|---|---|---|
| P120 | shared | Shared design system + 12-rule conformance checklist |
| P121 | A | Chronicle data-model upgrade |
| P122 | A | Chronicle renderer rebuild → gold-reference |
| P123 | A | Chronicle validator lints + conformance test |
| P124 | B | Cockpit research + design lock |
| P125 | B | Cockpit alert grammar + North-Star ranking |
| P126 | B | Cockpit answer-first surface (evolve cockpit-sidecar.cjs) |
| P127 | B | Cockpit integration + cross-surface conformance |

8 phases. Mirrors v3.0 / v3.1 scale.

## Cross-references

- `.planning/decisions/DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md` — design lock
- `.planning/analyses/2026-05-22-chronicle-html-book-research.html` — 12 design rules + Output 6 engineering spec
- `super-gsd/tools/chronicle/templates/chronicle-gold-reference.html` — render target
- `.planning/decisions/DLB-11-CHRONICLE-LAYER.md` — predecessor
- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` — cockpit surface WS-B evolves
