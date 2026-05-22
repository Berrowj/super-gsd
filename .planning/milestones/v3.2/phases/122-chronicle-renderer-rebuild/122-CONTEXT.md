---
phase: 122
phase_name: Chronicle Renderer Rebuild → Gold Reference
milestone: v3.2
created: 2026-05-22
status: queued-planning-only
implementation_status: not-started
source: DLB-12.3 — Operator Comprehension System; WS-A phase 2
predecessor: v3.2 P121 PASS (chronicle data-model upgrade)
---

# Phase 122 — Chronicle Renderer Rebuild → Gold Reference

> Rebuilds `render-html.cjs` + section templates so a rendered chronicle matches the gold-reference: Operator Decision Panel first, 11-section answer-first order, SCQA framing, evidence expanders, fog gauge, inline-SVG diagrams with takeaway figcaptions. Consumes the P121 data fields. Consumes the P120 shared design system.

## Goal

After P122, `render-html.cjs` run on a P121-shaped CHRONICLE-CONTEXT.json produces HTML structurally conformant to `chronicle-gold-reference.html` and passing the P120 conformance checker's binding chronicle rules. The chronicle self-test stays green (zero regression on the validator/builder substrate; the renderer's own assertions are rewritten for the new layout).

## Binding invariants (from DLB-12)

1. **Gold-reference conformance (DLB-12 invariant 2 + book rules R01-R12).** Rendered output leads with the Operator Decision Panel, follows the 11-section answer-first order, and passes `conformance-check.cjs --surface chronicle` on all binding rules.
2. **One shared design system (DLB-12 invariant 1).** `render-html.cjs` inlines `super-gsd/tools/shared/sgsd-design-system.css` — it does NOT carry its own divergent stylesheet. `style.css` (the v3.1 chronicle stylesheet) is reduced to chronicle-specific overrides only, or removed if fully subsumed.
3. **Deterministic writer (DLB-11 R3).** Pure Node.js; template-driven; MISSING_EVIDENCE placeholder for unfilled slots; byte-identical output across runs.
4. **Self-contained + offline (DLB-11).** Inline CSS + inline SVG; no external CDN; no `<script src>`; no web fonts. PUML still embedded as collapsible `<details>` source.
5. **Zero substrate regression.** P113 schema, P114 builder, P116 validator untouched. The chronicle self-test's builder/validator/schema assertions stay green; only the renderer's own assertions change for the new layout.

## The 11-section answer-first order (from book research Output 3)

The renderer emits, in order:
1. Operator Decision Panel (verdict + big_idea + next.primary_action + metrics)
2. Why this phase existed (SCQA)
3. What changed (ELI5)
4. What was verified / claimed / refuted (evidence spine)
5. Key decisions made
6. Agent Autonomy Disclosure + Denominator panel
7. Diagrams (inline SVG, takeaway figcaptions, collapsed PUML source)
8. Risks & rollback
9. What happens next (one primary action, alternatives folded)
10. Fog Score + cross-milestone learning
11. Raw evidence appendix (collapsed)

Sections with `signal: low` (from P121) render collapsed by default. High Fog Score auto-expands the must-read sections.

## Files this phase will modify/create

| Path | Op |
|---|---|
| `super-gsd/tools/chronicle/render-html.cjs` | modify — rebuild to the 11-section answer-first layout; inline the shared design system |
| `super-gsd/tools/chronicle/templates/sections/operator-decision.md` | create — Operator Decision Panel template |
| `super-gsd/tools/chronicle/templates/sections/why-scqa.md` | create — SCQA why-section template |
| `super-gsd/tools/chronicle/templates/sections/eli5.md` | modify — align to gold-reference idiom |
| `super-gsd/tools/chronicle/templates/sections/{remember-tomorrow,risks,persona-impact}.md` | modify — align to new layout |
| `super-gsd/tools/chronicle/templates/style.css` | modify — reduce to chronicle-only overrides; shared tokens come from sgsd-design-system.css |
| `super-gsd/tools/chronicle/run-self-test.cjs` | modify — rewrite renderer assertions for the new layout; extend with SAC-P122-NN |
| `super-gsd/tools/chronicle/fixtures/sample-rendered-chronicle.html` | regenerate — golden output of the rebuilt renderer |

~6 modified + 2 created.

## Semantic acceptance criteria (target — 122-01 PLAN declares verbatim)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P122-01
    input: "render-html.cjs run on a P121-shaped CHRONICLE-CONTEXT.json"
    expected_outcome: "produces HTML whose first <section> carries role=operator-decision"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P122-01"
  - id: SAC-P122-02
    input: "rendered HTML"
    expected_outcome: "contains all 11 answer-first sections in the canonical order"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P122-02"
  - id: SAC-P122-03
    input: "rendered HTML checked with conformance-check.cjs --surface chronicle"
    expected_outcome: "all binding chronicle rules PASS"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P122-03"
  - id: SAC-P122-04
    input: "rendered HTML"
    expected_outcome: "self-contained — no http(s):// in src/href, no <script src>, no <link rel=stylesheet href>, no @font-face"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P122-04"
  - id: SAC-P122-05
    input: "rendered HTML for a context with a section marked signal=low"
    expected_outcome: "that section renders inside a collapsed <details>"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P122-05"
  - id: SAC-P122-06
    input: "rendered HTML diagrams"
    expected_outcome: "every <figure> has a <figcaption> whose text differs from the diagram title (takeaway, not restated title)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P122-06"
  - id: SAC-P122-07
    input: "render-html.cjs consumes the shared design system"
    expected_outcome: "rendered HTML inlines sgsd-design-system.css tokens; renderer does not carry a divergent duplicate :root block"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P122-07"
  - id: SAC-P122-08
    input: "same CHRONICLE-CONTEXT.json rendered twice"
    expected_outcome: "byte-identical HTML output (deterministic)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P122-08"
  - id: SAC-P122-09
    input: "context with an unfilled template slot"
    expected_outcome: "renders <span class=missing-evidence> placeholder, not blank"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P122-09"
  - id: SAC-P122-10
    input: "full chronicle self-test"
    expected_outcome: "builder/validator/schema substrate assertions stay green; renderer assertions pass for the new layout; zero substrate regression"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"
```

10 SACs. SAC-P122-03 (conformance) + SAC-P122-10 (zero substrate regression) are the keystones.

## Out of scope

- Validator lints (P123)
- Cockpit (P124-P127)
- Changing the P121 data model or P116 validator verdict logic
- plantuml.jar rendering — the v3.1 svg-fallback-generator path carries forward (plantuml.jar absent → fallback, per DLB-11 R1)

## Cross-references

- `.planning/decisions/DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md` — design lock
- `super-gsd/tools/chronicle/templates/chronicle-gold-reference.html` — the structural render target
- `super-gsd/tools/shared/sgsd-design-system.css` — the shared stylesheet to inline (P120)
- `super-gsd/tools/shared/conformance-check.cjs` — SAC-P122-03 checker (P120)
- `.planning/analyses/2026-05-22-chronicle-html-book-research.html` — Output 3 (section order) + the 12 rules
- `super-gsd/tools/chronicle/render-html.cjs` — the renderer being rebuilt (v3.1 P115)
