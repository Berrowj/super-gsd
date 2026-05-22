---
schema_version: 2
status: PLAN-LOCKED
expected_ATC_tier: FULL
skip_gates: []
lessons_path: .planning/decisions/DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md
plan_id: P120-01
phase_id: P120
milestone: v3.2
title: Shared Design System
context_path: .planning/milestones/v3.2/phases/120-shared-design-system/120-CONTEXT.md
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
    expected_outcome: "conformance-check.cjs --surface chronicle returns all binding rules PASS on the gold reference itself"
    verification_cmd: "node super-gsd/tools/shared/run-self-test.cjs --sac SAC-P120-07"
  - id: SAC-P120-08
    input: "full self-test"
    expected_outcome: "all assertions green (8 SAC-P120 + >=7 STRUCT)"
    verification_cmd: "node super-gsd/tools/shared/run-self-test.cjs"
tasks:
  - id: t1
    title: Extract shared stylesheet and encode design-rule registry
    agent: codex-executor
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/tools/shared/sgsd-design-system.css
      - super-gsd/tools/shared/design-rules.json
    input_contract: |
      Read .planning/milestones/v3.2/phases/120-shared-design-system/120-CONTEXT.md, .planning/decisions/DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md, .planning/analyses/2026-05-22-chronicle-html-book-research.html, and super-gsd/tools/chronicle/templates/chronicle-gold-reference.html before editing.

      Create only the two files listed in files_touched for this task, both under the new super-gsd/tools/shared/ directory. Extract the shared stylesheet from the chronicle gold reference: include the :root custom-property set and reusable component rules needed for chronicle/cockpit visual alignment. Do not introduce @import url(http...), remote stylesheets, @font-face, or web fonts.

      Encode design-rules.json from Output 2 of the chronicle HTML book research analysis. The registry must include rules R01-R12 as structured data. Each rule must include id, name, source_book, citation with chunk or figure id plus score, check_type set to one of structural, lint, presence, or advisory, severity set to binding or advisory, and applies_to set to chronicle, cockpit, or both. Include a cockpit rule group recording the five DLB-12 cockpit principles: preattentive single-focus, colour-sparingly, one-North-Star, information-overload-default, and threshold-to-alert grammar.
    output_contract: |
      super-gsd/tools/shared/sgsd-design-system.css exists and is the single shared CSS artifact for Phase 120. It is sourced from the gold-reference visual language and has no network dependency.

      super-gsd/tools/shared/design-rules.json exists, is valid JSON, contains exactly R01-R12 with the required field shapes, and includes the cockpit principles group. The file is deterministic data only and contains no generated timestamps.
    hypothesis: |
      Extracting the gold-reference visual language into a shared stylesheet and representing the book-derived rules as data gives Phase 120 one stable source for both rendering and conformance checking.
    falsifier: |
      The task is falsified if the stylesheet diverges materially from the gold reference, introduces network/font dependencies, omits :root tokens or core component classes, or if design-rules.json is not valid JSON with exactly the required R01-R12 registry and cockpit rule group.
    stop_rule: |
      Stop after the two files in files_touched are created and local structural checks for CSS and JSON pass. Do not implement the checker or fixtures in this task.
    verification_cmd: "node -e \"const fs=require('fs');const css=fs.readFileSync('super-gsd/tools/shared/sgsd-design-system.css','utf8');if(!css.includes(':root')) throw new Error('missing :root');if(/@import\\s+url\\(['\\\"]?https?:/i.test(css)||/@font-face/i.test(css)) throw new Error('forbidden font/network import');const r=JSON.parse(fs.readFileSync('super-gsd/tools/shared/design-rules.json','utf8'));const rules=r.rules||[];if(rules.length!==12) throw new Error('expected 12 rules');for(let i=1;i<=12;i++){const id='R'+String(i).padStart(2,'0');if(!rules.some(x=>x.id===id)) throw new Error('missing '+id);}for(const x of rules){for(const k of ['id','name','source_book','citation','check_type','severity','applies_to']) if(!(k in x)) throw new Error('missing '+k+' on '+x.id);}\""
  - id: t2
    title: Implement deterministic conformance checker, fixtures, and self-test
    agent: codex-executor
    model: codex
    depends_on:
      - t1
    files_touched:
      - super-gsd/tools/shared/conformance-check.cjs
      - super-gsd/tools/shared/run-self-test.cjs
      - super-gsd/tools/shared/fixtures/conformant-sample.html
      - super-gsd/tools/shared/fixtures/violations-sample.html
    input_contract: |
      Read .planning/milestones/v3.2/phases/120-shared-design-system/120-CONTEXT.md, .planning/decisions/DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md, super-gsd/tools/shared/design-rules.json, super-gsd/tools/shared/sgsd-design-system.css, and super-gsd/tools/chronicle/templates/chronicle-gold-reference.html before editing.

      Create only the four files listed in files_touched for this task. Implement conformance-check.cjs as pure deterministic Node.js: it must accept an HTML string plus a surface type of chronicle or cockpit and return per-rule pass/fail results. It must not call an LLM, spawn a network client, fetch remote resources, or depend on services outside local Node.js execution. It must respect rule applies_to filtering and surface cockpit-specific principles as rule-group results.

      Implement run-self-test.cjs to exercise the checker against conformant-sample.html, violations-sample.html, and the chronicle gold reference. SAC-P120-07 is the keystone: every binding rule that applies to chronicle must pass when the checker runs against super-gsd/tools/chronicle/templates/chronicle-gold-reference.html.
    output_contract: |
      super-gsd/tools/shared/conformance-check.cjs exports a reusable checker API and, if it has a CLI mode, keeps CLI output deterministic.

      super-gsd/tools/shared/run-self-test.cjs exits zero only when the conformant fixture passes, the violation fixture fails expected binding checks, and the chronicle gold reference passes all chronicle binding rules.

      The two fixtures exist and cover both PASS and FAIL paths. The final implementation footprint for Phase 120 is exactly six files under super-gsd/tools/shared/.
    hypothesis: |
      A deterministic local checker backed by design-rules.json can enforce the shared design-system contract without adding SGSD gate duplication, LLM variability, or network dependencies.
    falsifier: |
      The task is falsified if checker output is nondeterministic, if it requires network/LLM access, if the fixture self-test cannot prove both passing and failing paths, or if the chronicle gold reference fails any binding chronicle rule.
    stop_rule: |
      Stop after conformance-check.cjs, run-self-test.cjs, and both fixtures are implemented and node super-gsd/tools/shared/run-self-test.cjs exits zero. Do not mutate chronicle-gold-reference.html or any files outside super-gsd/tools/shared/.
    verification_cmd: "node super-gsd/tools/shared/run-self-test.cjs"
---

# P120-01 Shared Design System Plan

This PLAN-LOCKED file scopes Phase 120 to six new shared-design-system files under `super-gsd/tools/shared/`.
