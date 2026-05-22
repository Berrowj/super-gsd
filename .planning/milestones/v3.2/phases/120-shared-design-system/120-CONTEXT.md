---
phase: 120
phase_name: Shared Design System + 12-Rule Conformance Checklist
milestone: v3.2
created: 2026-05-22
status: queued-planning-only
implementation_status: not-started
source: DLB-12.1 — Operator Comprehension System; first phase (shared workstream)
predecessor: v3.1 P119 PASS (Chronicle Layer complete)
---

# Phase 120 — Shared Design System + 12-Rule Conformance Checklist

> The shared foundation both v3.2 workstreams build on. Extracts the gold-reference visual language into one stylesheet that the chronicle HTML (WS-A) and the cockpit (WS-B) both consume, and turns the 12 book-mined design rules into a machine-checkable conformance checklist.

## Goal

Ship the shared design-system stylesheet + the 12-rule conformance checker + a self-test. After this phase, both the chronicle renderer (P122) and the cockpit surface (P126) have one stylesheet to consume and one checklist to pass — no per-surface CSS divergence is possible.

This phase ships NO operator-facing surface. Foundation only. Same shape as v3.0 P106 / v3.1 P113 (foundation-first phases).

## Binding invariants (from DLB-12)

1. **One shared design system (DLB-12 invariant 1).** The stylesheet is the single source of visual truth. The chronicle and cockpit `<style>` blocks are generated FROM it, never hand-divergent.
2. **Book-research-grounded (DLB-12 invariant 6).** Every rule in the conformance checklist cites a specific principle from `.planning/analyses/2026-05-22-chronicle-html-book-research.html` (chunk/figure id + score). A rule with no citation does not enter the checklist.
3. **Offline-survivable.** The stylesheet uses only CSS custom properties + system font stacks. No `@import url(http...)`, no web fonts.
4. **Deterministic conformance check.** The checker is a pure Node.js function — given an HTML string, it returns pass/fail per rule. No LLM, no network.

## Files this phase will create

| Path | Op |
|---|---|
| `super-gsd/tools/shared/sgsd-design-system.css` | create — the shared stylesheet (the gold-reference `:root` + components, extracted + documented) |
| `super-gsd/tools/shared/design-rules.json` | create — the 12 design rules as structured data: id, name, source book, citation (chunk/figure id + score), check-type, severity |
| `super-gsd/tools/shared/conformance-check.cjs` | create — deterministic checker: takes an HTML string + a surface type (`chronicle` \| `cockpit`), returns per-rule pass/fail |
| `super-gsd/tools/shared/run-self-test.cjs` | create — ≥15-assertion self-test for the checker (good + bad HTML fixtures per rule) |
| `super-gsd/tools/shared/fixtures/conformant-sample.html` | create — minimal HTML that passes all 12 rules |
| `super-gsd/tools/shared/fixtures/violations-sample.html` | create — HTML that violates each rule, one per rule, for the checker's negative tests |

6 files. New `super-gsd/tools/shared/` directory — both workstreams depend on it.

## The 12 design rules (from the book research — to be encoded)

Each becomes one entry in `design-rules.json`. Rules and their retrieved citations:

| Rule | Name | Source · citation |
|---|---|---|
| R01 | Lead with the operator decision | Minto `Image00085·0.79` + SwD `::0255` |
| R02 | Section headings are testable governing statements | Minto `Image00080·0.63` + SwD `::0132·0.74` |
| R03 | Frame "why" as Situation→Complication→Question | Minto `Image00201·0.68` + `Image00190·0.67` |
| R04 | One recommended next action, alternatives folded | Stick `::0160·0.71` + `::0170·0.70` |
| R05 | Every claim is a one-click testable credential | Stick `::0103·0.65` + `::0179·0.64` |
| R06 | Pair every metric with its telling instance | Stick `::0108·0.63` |
| R07 | Collapse, never delete; declutter by default-folding | SwD `::0102·0.71` |
| R08 | Spell the "So What?" in text — no presenter | SwD `c06f002·0.64` + `::0189·0.70` |
| R09 | Match the diagram type to the question type | Napkin `::0067·0.77` + `::0069·0.67` |
| R10 | Make the layout mirror the logic | Minto `Image00048·0.76` + SwD `::0097·0.71` |
| R11 | Write against the Curse of Knowledge (jargon lint) | Stick `::0013·0.68` + `::0074·0.69` |
| R12 | Tune diagrams to an execution-oriented operator (SQVID) | Napkin `::0055·0.70` |

Plus the 5 cockpit-specific principles retrieved 2026-05-22 (preattentive single-focus, colour-sparingly, one North Star, information-overload-default, threshold→alert grammar) are recorded in `design-rules.json` as a `cockpit` rule group — flagged `applies_to: ["cockpit"]` — so WS-B (P124-P127) consumes them without a second research pass.

## Check types

Each rule declares a `check_type` so `conformance-check.cjs` knows how to verify it mechanically:

- `structural` — DOM/regex check (e.g. R01: first `<section>` has `role="operator-decision"`; R03: a `why` section contains `.scqa`)
- `lint` — text-pattern check (e.g. R11: ELI5/synthesis text contains no denylisted internal term un-expanded)
- `presence` — required element exists (e.g. R08: every `<figure>` has a `<figcaption>`)
- `advisory` — cannot be fully machine-checked; checker emits a reviewer-prompt (e.g. R02: "is this heading a genuine takeaway?" — flagged for the validator/operator, not auto-failed)

`severity`: `binding` (fail blocks) vs `advisory` (warn only).

## Semantic acceptance criteria (target — 120-01 PLAN declares verbatim)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P120-01
    input: "sgsd-design-system.css"
    expected_outcome: "parses as valid CSS; contains the gold-reference :root custom-property set; no @import url(http...) and no web-font references"
    verification_cmd: "node super-gsd/tools/shared/run-self-test.cjs --sac SAC-P120-01"

  - id: SAC-P120-02
    input: "design-rules.json"
    expected_outcome: "contains exactly 12 core rules R01-R12 plus the cockpit rule group; every rule has a non-empty source citation (chunk/figure id)"
    verification_cmd: "node super-gsd/tools/shared/run-self-test.cjs --sac SAC-P120-02"

  - id: SAC-P120-03
    input: "fixtures/conformant-sample.html"
    expected_outcome: "conformance-check.cjs returns all binding rules PASS"
    verification_cmd: "node super-gsd/tools/shared/run-self-test.cjs --sac SAC-P120-03"

  - id: SAC-P120-04
    input: "fixtures/violations-sample.html"
    expected_outcome: "conformance-check.cjs flags every binding rule it violates; no false PASS"
    verification_cmd: "node super-gsd/tools/shared/run-self-test.cjs --sac SAC-P120-04"

  - id: SAC-P120-05
    input: "conformance-check.cjs --surface cockpit on a cockpit-shaped fixture"
    expected_outcome: "checker applies the cockpit rule group, skips chronicle-only rules"
    verification_cmd: "node super-gsd/tools/shared/run-self-test.cjs --sac SAC-P120-05"

  - id: SAC-P120-06
    input: "same HTML checked twice"
    expected_outcome: "deterministic — identical per-rule verdicts across runs"
    verification_cmd: "node super-gsd/tools/shared/run-self-test.cjs --sac SAC-P120-06"

  - id: SAC-P120-07
    input: "the gold-reference chronicle-gold-reference.html"
    expected_outcome: "conformance-check.cjs --surface chronicle returns all binding rules PASS on the gold reference itself (the reference must pass its own checklist)"
    verification_cmd: "node super-gsd/tools/shared/run-self-test.cjs --sac SAC-P120-07"

  - id: SAC-P120-08
    input: "full self-test"
    expected_outcome: "all assertions green (8 SAC-P120 + >=7 STRUCT)"
    verification_cmd: "node super-gsd/tools/shared/run-self-test.cjs"
```

8 SACs. SAC-P120-07 is the keystone: the gold-reference HTML must pass the checklist derived from the same research that produced it — if it doesn't, either the reference or the checklist is wrong.

## Out of scope

- Chronicle renderer changes (P122)
- Cockpit changes (P124-P127)
- Chronicle data-model / schema changes (P121)
- Ingesting the 3 absent books

## Cross-references

- `.planning/decisions/DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md` — design lock
- `.planning/analyses/2026-05-22-chronicle-html-book-research.html` — the 12 rules + their citations (the source of `design-rules.json`)
- `super-gsd/tools/chronicle/templates/chronicle-gold-reference.html` — the visual language being extracted; also the SAC-P120-07 conformance target
- `sgsd_pro_mode_codex_infographic.html` — original visual-language source
- `.planning/milestones/v3.2/ROADMAP.md` — phase mapping
