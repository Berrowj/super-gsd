---
schema_version: 2
status: PLAN-LOCKED
expected_ATC_tier: FULL
skip_gates: []
lessons_path: .planning/decisions/DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md
plan_id: P122-01
phase_id: P122
milestone: v3.2
title: Chronicle Renderer Rebuild
context_path: .planning/milestones/v3.2/phases/122-chronicle-renderer-rebuild/122-CONTEXT.md
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
tasks:
  - id: t1
    title: Rebuild Chronicle HTML renderer and section templates
    agent: codex-executor
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/tools/chronicle/render-html.cjs
      - super-gsd/tools/chronicle/templates/operator-decision.md
      - super-gsd/tools/chronicle/templates/why-scqa.md
      - super-gsd/tools/chronicle/templates/eli5.md
      - super-gsd/tools/chronicle/templates/remember-tomorrow.md
      - super-gsd/tools/chronicle/templates/risks.md
      - super-gsd/tools/chronicle/templates/persona-impact.md
      - super-gsd/tools/chronicle/style.css
    input_contract: |
      Read the Phase 122 context, DLB-12, chronicle-gold-reference.html, sgsd-design-system.css,
      conformance-check.cjs, and the current render-html.cjs/template/style implementation before editing.
      Treat chronicle-gold-reference.html as the structural target, while preserving renderer data contracts and
      existing substrate inputs.
    output_contract: |
      Rebuild render-html.cjs so the rendered chronicle begins with the Operator Decision Panel and follows the
      required 11-section answer-first order. Create operator-decision.md and why-scqa.md section templates.
      Modify eli5.md, remember-tomorrow.md, risks.md, and persona-impact.md for the new operator-comprehension
      layout. Reduce style.css to chronicle-only overrides and inline super-gsd/tools/shared/sgsd-design-system.css
      from render-html.cjs without introducing a duplicate divergent :root token block.
    hypothesis: |
      If the renderer owns the Phase 122 answer-first section order and consumes the shared design system directly,
      the chronicle surface can match the gold reference while staying deterministic, self-contained, and conformant
      to SGSD surface binding rules.
    falsifier: |
      This task is falsified if rendered output does not put the Operator Decision Panel first, misses the required
      11-section order, fails the chronicle conformance check, introduces CDN/script/font dependencies, drops
      MISSING_EVIDENCE placeholders, or duplicates shared design tokens in a divergent :root block.
    stop_rule: |
      Stop after the renderer and templates produce the intended static layout without changing P113 schema,
      P114 builder, P116 validator, or run-self-test.cjs assertions. Leave assertion rewrites and golden regeneration
      for t2.
    verification_cmd: 'node super-gsd/tools/shared/conformance-check.cjs --surface chronicle'
  - id: t2
    title: Rewrite renderer assertions and regenerate Chronicle golden output
    agent: codex-executor
    model: codex
    depends_on:
      - t1
    files_touched:
      - super-gsd/tools/chronicle/run-self-test.cjs
      - super-gsd/tools/chronicle/sample-rendered-chronicle.html
    input_contract: |
      Start from the t1 renderer/template output and read the current chronicle self-test, Phase 122 context SACs,
      chronicle-gold-reference.html, and DLB-11/DLB-12 constraints. Keep P113 schema, P114 builder, and P116 validator
      assertions intact.
    output_contract: |
      Rewrite only the renderer-specific assertions in run-self-test.cjs for the new Phase 122 layout. Add explicit
      SAC-P122-01 through SAC-P122-10 coverage using the required --sac command path. Regenerate
      sample-rendered-chronicle.html as the deterministic golden artifact for the rebuilt renderer.
    hypothesis: |
      If the self-test asserts the new operator-first layout, shared design-system binding, deterministic rendering,
      self-contained output, MISSING_EVIDENCE behavior, substrate non-regression, and PlantUML fallback continuity,
      then Phase 122 can verify the renderer rebuild without masking substrate regressions.
    falsifier: |
      This task is falsified if run-self-test.cjs rewrites substrate assertions, lacks any SAC-P122 coverage, accepts
      a non-conformant or non-deterministic render, fails when plantuml.jar is absent despite fallback availability,
      or leaves sample-rendered-chronicle.html out of sync with the rebuilt renderer.
    stop_rule: |
      Stop after the renderer self-test passes for every SAC-P122 command and the all-up chronicle self-test passes,
      with no edits to P113/P114/P116 substrate files or their existing assertions.
    verification_cmd: 'node super-gsd/tools/chronicle/run-self-test.cjs'
---

# P122-01 Chronicle Renderer Rebuild

Plan-locked execution scope for rebuilding the Chronicle renderer around the DLB-12 operator-comprehension system while preserving DLB-11 renderer determinism and existing substrate contracts.
