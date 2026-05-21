---
schema_version: 2
status: PLAN-LOCKED
expected_ATC_tier: FULL
skip_gates: []
lessons_path: .planning/decisions/DLB-11-CHRONICLE-LAYER.md
plan_id: P115-01
phase_id: P115
milestone: v3.1
title: HTML Renderer + PUML Templates
context_path: .planning/milestones/v3.1/phases/115-html-renderer-puml/115-CONTEXT.md
semantic_acceptance_criteria:
  - id: SAC-P115-01
    input: "fixtures/sample-chronicle-context.json (P114 golden output)"
    expected_outcome: "renderer produces phase-chronicle.html that contains all 6 inline SVG diagrams + 4 section template blocks"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-01"
  - id: SAC-P115-02
    input: "same input twice"
    expected_outcome: "byte-identical HTML output (deterministic)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-02"
  - id: SAC-P115-03
    input: "rendered HTML"
    expected_outcome: "passes self-contained check: no http(s):// in src/href; no <script src>; no <link rel=\"stylesheet\" href>"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-03"
  - id: SAC-P115-04
    input: "rendered HTML"
    expected_outcome: "every diagram block contains both rendered <svg> AND collapsible <details><summary>PUML source</summary>"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-04"
  - id: SAC-P115-05
    input: "PUML file with !include http://... attempted"
    expected_outcome: "renderer rejects with REPORT_PUML_EXTERNAL_INCLUDE before invoking plantuml.jar / fallback"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-05"
  - id: SAC-P115-06
    input: "plantuml.jar absent + skip_gates: [] (no opt-in fallback)"
    expected_outcome: "renderer falls back to svg-fallback-generator + emits visible 'PUML source available; rendered via fallback generator' banner in HTML"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-06"
  - id: SAC-P115-07
    input: "plantuml.jar absent + skip_gates: ['puml-render']"
    expected_outcome: "renderer falls back silently (no banner) but still emits PUML source in collapsible details"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-07"
  - id: SAC-P115-08
    input: "section template with {{slot_without_evidence}}"
    expected_outcome: "rendered HTML contains <span class=\"missing-evidence\" data-slot=\"slot_without_evidence\">MISSING_EVIDENCE</span>"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-08"
  - id: SAC-P115-09
    input: "rendered HTML"
    expected_outcome: "every <section> has role attribute matching one of the 7 Norman signifier classes"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-09"
  - id: SAC-P115-10
    input: "architecture.puml"
    expected_outcome: "contains ≥3 actual repo path labels (e.g. super-gsd/tools/...) and ≥3 arrows with intent labels"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-10"
  - id: SAC-P115-11
    input: "all 6 PUML templates"
    expected_outcome: "each parses (PUML syntax valid by static grep + structural check)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-11"
  - id: SAC-P115-12
    input: "rendered HTML"
    expected_outcome: "matches golden fixture sample-rendered-chronicle.html (byte-identical)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-12"
  - id: SAC-P115-13
    input: "full self-test"
    expected_outcome: "all ≥15 assertions green (12 SAC + ≥3 STRUCT)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"
tasks:
  - id: t1
    title: PUML templates
    agent: codex-executor
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/tools/chronicle/templates/puml/chronicle-architecture.puml
      - super-gsd/tools/chronicle/templates/puml/evidence-lineage.puml
      - super-gsd/tools/chronicle/templates/puml/gate-evidence-flow.puml
      - super-gsd/tools/chronicle/templates/puml/puml-render-fallback.puml
      - super-gsd/tools/chronicle/templates/puml/norman-signifiers.puml
      - super-gsd/tools/chronicle/templates/puml/autonomy-boundary.puml
    input_contract: |
      Read .planning/milestones/v3.1/phases/115-html-renderer-puml/115-CONTEXT.md and .planning/decisions/DLB-11-CHRONICLE-LAYER.md before editing.
      Create exactly six .puml templates under super-gsd/tools/chronicle/templates/puml/.
      Preserve DLB-11 R1: component labels must contain actual SGSD repo paths, including paths such as super-gsd/tools/mesh-memory/lineage.cjs where relevant, and arrows must carry intent labels such as "writes execution_receipt CMB".
      Use the clarity-board-deck sage, terracotta, amber, and slate colour scheme directly in the PlantUML templates.
      Keep templates deterministic and free of generated agent prose.
    output_contract: |
      Six deterministic .puml files exist under super-gsd/tools/chronicle/templates/puml/.
      Each file is valid PlantUML source with embedded style definitions and actual repo-path component labels.
      The six templates cover architecture, evidence lineage, gate evidence flow, PUML render fallback, Norman signifiers, and autonomy boundary views.
      Intent-labelled arrows make evidence writes, reads, validation, and fallback routing explicit.
    hypothesis: |
      If the chronicle diagrams are repo-path labelled and intent-labelled, reviewers can trace Chronicle output back to concrete SGSD code and ledgers without relying on prose.
    falsifier: |
      The task is false if any .puml file uses abstract-only component names, omits intent labels on arrows, drops the required colour scheme, or cannot be rendered by PlantUML syntax.
    stop_rule: |
      Stop after the six .puml files exist and no non-PUML Chronicle files are changed by this task.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-01,SAC-P115-02,SAC-P115-03,SAC-P115-04"

  - id: t2
    title: Section templates + CSS
    agent: codex-executor
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/tools/chronicle/templates/section-observations.md
      - super-gsd/tools/chronicle/templates/section-claims-evidence.md
      - super-gsd/tools/chronicle/templates/section-decisions-denominators.md
      - super-gsd/tools/chronicle/templates/section-synthesis-autonomy.md
      - super-gsd/tools/chronicle/templates/style.css
    input_contract: |
      Read 115-CONTEXT.md, DLB-11-CHRONICLE-LAYER.md, and the existing Chronicle context-pack shape from super-gsd/tools/chronicle/build-context-pack.cjs.
      Add four Markdown section templates and one CSS file under super-gsd/tools/chronicle/templates/.
      The templates must expose all seven Norman signifier roles exactly as observations, claims, evidence_verdicts, decisions, denominators, synthesis, and autonomy_disclosure.
      Templates must use explicit slot markers for renderer injection and must not include agent-authored narrative fallback prose.
      CSS must be self-contained, deterministic, and aligned to the clarity-board-deck sage, terracotta, amber, and slate palette.
    output_contract: |
      Four Markdown section templates and super-gsd/tools/chronicle/templates/style.css exist.
      The template set covers all seven Norman signifier roles with stable slot names consumed by render-html.cjs.
      The CSS supports the Chronicle HTML without external fonts, images, scripts, or linked stylesheets.
      Empty or missing slots render as deterministic labelled absences, not improvised prose.
    hypothesis: |
      If Chronicle content is assembled from section templates and explicit slots, the HTML renderer can stay deterministic while still presenting a human-readable board.
    falsifier: |
      The task is false if a signifier role is missing, a template relies on prose not sourced from slots, or style.css requires any external asset.
    stop_rule: |
      Stop after only the five template/style files listed for this task have been created or updated.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-05,SAC-P115-06"

  - id: t3
    title: Fallback SVG generator
    agent: codex-executor
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/tools/chronicle/svg-fallback-generator.cjs
    input_contract: |
      Read 115-CONTEXT.md, DLB-11-CHRONICLE-LAYER.md, and the six PUML template names expected by t1.
      Implement a deterministic Node.js fallback generator at super-gsd/tools/chronicle/svg-fallback-generator.cjs.
      The fallback must accept enough structured input for render-html.cjs to request a visible SVG substitute for each PUML diagram.
      The fallback output must be self-contained SVG with no external hrefs, scripts, stylesheets, fonts, or network references.
      Do not re-implement SGSD gates; this file only generates deterministic visual fallback assets.
    output_contract: |
      svg-fallback-generator.cjs exists and can be required or invoked by render-html.cjs without third-party dependencies.
      It generates stable SVG strings for all six diagram roles.
      Generated SVGs contain visible fallback labelling so Chronicle readers know PlantUML was unavailable.
      The generator exports a small API suitable for renderer unit/self-test assertions.
    hypothesis: |
      If the fallback SVG generator is deterministic and self-contained, Chronicle HTML remains reviewable on machines without plantuml.jar while making fallback status visible.
    falsifier: |
      The task is false if fallback output changes between identical runs, pulls external resources, hides fallback status, or cannot cover all six PUML diagram roles.
    stop_rule: |
      Stop after svg-fallback-generator.cjs is implemented and no renderer orchestration is added in this task.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-10"

  - id: t4
    title: Main renderer
    agent: codex-executor
    model: codex
    depends_on:
      - t1
      - t2
      - t3
    files_touched:
      - super-gsd/tools/chronicle/render-html.cjs
    input_contract: |
      Read 115-CONTEXT.md, DLB-11-CHRONICLE-LAYER.md, super-gsd/schemas/chronicle.schema.json, super-gsd/tools/chronicle/build-context-pack.cjs, and the outputs from t1, t2, and t3.
      Implement super-gsd/tools/chronicle/render-html.cjs as deterministic Node.js.
      Consume CHRONICLE-CONTEXT.json plus planning artefacts produced or referenced by the context pack; perform explicit slot injection into the Markdown section templates.
      Probe plantuml.jar exactly in this order: $PLANTUML_JAR, $HOME/plantuml.jar, C:/tools/plantuml.jar, C:/Program Files/PlantUML/plantuml.jar, C:/Users/$USER/plantuml.jar.
      If PlantUML is absent, route to svg-fallback-generator.cjs and emit a visible fallback banner unless skip_gates contains "puml-render".
      Produce self-contained HTML: no http(s):// in src or href, no <script src>, and no <link rel="stylesheet" href>.
      Do not add agent-authored prose; all rendered text must come from deterministic labels, templates, CHRONICLE-CONTEXT.json, or planning artefacts.
    output_contract: |
      render-html.cjs exists and renders a complete Chronicle HTML document from CHRONICLE-CONTEXT.json.
      The renderer embeds CSS inline, embeds rendered or fallback SVG diagrams inline, and never emits external script or stylesheet references.
      The renderer preserves all seven signifier roles in the output DOM.
      The renderer has deterministic ordering, deterministic missing-data labels, and clear failure messages for malformed input.
      PlantUML discovery and fallback behaviour match the P115 contract exactly.
    hypothesis: |
      If render-html.cjs treats context-pack data and templates as the only content sources, Chronicle HTML can be generated reproducibly and validated without relying on agent prose.
    falsifier: |
      The task is false if identical inputs produce different HTML, any external asset reference appears, the PlantUML probe order differs from the contract, fallback status is invisible when used, or any signifier role is omitted.
    stop_rule: |
      Stop after render-html.cjs can render using the t1, t2, and t3 outputs and no self-test or golden fixture edits are made by this task.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-07,SAC-P115-08,SAC-P115-09,SAC-P115-10,SAC-P115-11"

  - id: t5
    title: Self-test extension + golden fixture
    agent: codex-executor
    model: codex
    depends_on:
      - t1
      - t2
      - t3
      - t4
    files_touched:
      - super-gsd/tools/chronicle/run-self-test.cjs
      - super-gsd/tools/chronicle/fixtures/sample-rendered-chronicle.html
    input_contract: |
      Read 115-CONTEXT.md, DLB-11-CHRONICLE-LAYER.md, super-gsd/schemas/chronicle.schema.json, super-gsd/tools/chronicle/build-context-pack.cjs, super-gsd/tools/chronicle/run-self-test.cjs, and the outputs from t1 through t4.
      Extend run-self-test.cjs with SAC-P115-01 through SAC-P115-13 assertions.
      Assertions must cover PUML template count and labels, section template count, CSS self-containment, seven signifier roles, PlantUML probe order, fallback generator use, visible fallback banner rules, renderer determinism, self-contained HTML constraints, and schema validation path.
      Create the golden sample-rendered-chronicle.html fixture in the Chronicle fixtures directory.
      Keep tests deterministic and avoid network, browser, or external PlantUML requirements.
    output_contract: |
      run-self-test.cjs can assert every SAC-P115-NN criterion by ID.
      sample-rendered-chronicle.html exists as a deterministic golden fixture produced by the renderer path.
      The self-test validates the Chronicle output against super-gsd/schemas/chronicle.schema.json where applicable.
      The self-test fails on external src/href/script/link resources and fails when signifier roles or fallback banners are missing under their required conditions.
    hypothesis: |
      If the self-test owns the SAC-P115 assertions and golden fixture, Phase 116 validation can enforce CHRONICLE-04 and renderer determinism without rediscovering P115 intent.
    falsifier: |
      The task is false if any SAC-P115-NN cannot be invoked from run-self-test.cjs, if the golden fixture is not reproducible, or if the self-contained HTML checks miss forbidden external references.
    stop_rule: |
      Stop after run-self-test.cjs and the golden fixture are updated, and do not alter renderer/template implementation except to accommodate failing self-test assertions through explicit follow-up work.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P115-01,SAC-P115-02,SAC-P115-03,SAC-P115-04,SAC-P115-05,SAC-P115-06,SAC-P115-07,SAC-P115-08,SAC-P115-09,SAC-P115-10,SAC-P115-11,SAC-P115-12,SAC-P115-13"
---

# P115-01 HTML Renderer + PUML Templates

PLAN-LOCKED implementation plan for v3.1 Phase 115.
