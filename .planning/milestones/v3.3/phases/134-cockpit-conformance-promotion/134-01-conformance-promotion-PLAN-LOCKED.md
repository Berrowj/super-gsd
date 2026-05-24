---
schema_version: 2
schema: plan-schema-v2
status: PLAN-LOCKED
plan_id: P134-01-conformance-promotion
phase_id: 134-cockpit-conformance-promotion
phase_number: 134
milestone: v3.3
workstream: core
title: Conformance Promotion (advisory→binding; 4-surface coverage)
created_by: sgsd-write-plan (operator + Claude Opus 4.7)
created_at: 2026-05-24
locked: true
expected_ATC_tier: LITE
skip_gates: []
depends_on:
  - P133-01-monitor-migration
tasks:
  - id: P134-T1
    agent: sgsd-exec-config
    model: codex
    files_touched:
      - super-gsd/tools/shared/design-rules.json
    input_contract: |-
      Reads existing design-rules.json (R01-R12). Reads 134-CONTEXT.md
      "design-rules.json" section for the 6 new rule proposals.
    output_contract: |-
      MODIFY design-rules.json (additive). Append 6 new rule objects R13..R18
      to the rules array. Each rule has the same shape as R01-R12: id, name,
      source_book, citation, check_type ('structural' or 'advisory'),
      severity ('binding' or 'advisory'), applies_to (array of surface names),
      description. Use the proposed text from 134-CONTEXT.md. Set check_type
      'structural' and severity 'binding' where the rule is mechanically
      checkable; use 'advisory' otherwise. Preserve R01-R12 byte-stable.
    hypothesis: |-
      The 6 new rules map cleanly to v3.3 band-grammar invariants and have
      mechanical checks in T2.
    falsifier: |-
      If any new rule's check would require LLM judgement to evaluate, it
      should be marked advisory not binding. R15 (Band 3 6 subheadings) is
      borderline — only fires when Band 3 is rendered.
    stop_rule: |-
      design-rules.json has 18 rule entries (R01-R18); JSON parses cleanly;
      schema_version unchanged.

  - id: P134-T2
    agent: sgsd-exec-backend
    model: codex
    files_touched:
      - super-gsd/tools/shared/conformance-check.cjs
    input_contract: |-
      Reads existing conformance-check.cjs (418 lines). Requires T1 design-rules.json
      to have R13-R18 entries.
    output_contract: |-
      MODIFY conformance-check.cjs:
        (a) Extend the --surface flag accepted values to include 'cockpit-html'
            and 'monitor' (in addition to existing 'chronicle' and 'cockpit').
        (b) Implement checkR13..checkR18 functions following the existing
            checkRNN(html) pattern. Each returns {ok: boolean, reason?: string}.
            R13: cockpit-html has exactly one element with class containing
                 'northstar' OR 'recommended-action' (one loud line).
            R14: cockpit-html has 5 elements with class containing 'stage'
                 (5-stage strip).
            R15: when cockpit-html contains data-band="3" not hidden, it has all
                 6 subhead labels (WHY THIS PHASE, CONTEXT, ELI5, WHAT IS,
                 WHAT COULD BE, EVIDENCE TRAIL).
            R16: when input is JSON (cockpit surface), every alert in alerts.all
                 has palette_tier ∈ Primer 5-tier set.
            R17: when input has an eli5 field, eli5-lint(eli5).out_of_list_count <= 5.
            R18: cockpit-html renderShell output contains data-band="1",
                 data-band="2", data-band="3".
        (c) Register R13-R18 in the rule map.
        (d) For each surface, define the rule subset that applies (use the
            applies_to array from design-rules.json).
    hypothesis: |-
      Mechanical pattern checks using regex/string-includes on the HTML or
      JSON input are sufficient for these new rules.
    falsifier: |-
      If a check function returns false-positive for the v3.3 reference
      output, the rule needs tightening. Mitigation: T3 SACs verify against
      a synthesized fixture.
    stop_rule: |-
      conformance-check.cjs accepts --surface cockpit-html AND --surface monitor;
      checkR13..R18 are functions in the registry; running against a synthesized
      v3.3 fixture returns binding_fail=0.

  - id: P134-T3
    agent: sgsd-exec-test
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/run-self-test.cjs
    input_contract: |-
      Reads run-self-test.cjs (post-P133; 53/53 SACs green). Reads 134-CONTEXT.md
      SAC block.
    output_contract: |-
      EXTEND run-self-test.cjs (pure append). Append SAC-P134-01..04 after
      SAC-P133-03.

      SAC-P134-01: read design-rules.json; assert each of R13..R18 appears as
      a rule id.

      SAC-P134-02: require conformance-check.cjs; access its rule registry
      (you may need to export it from the module if it isn't already — if so
      that's part of T2 scope); assert R13..R18 keys present.

      SAC-P134-03: synthesize a v3.3-conformant cockpit HTML output via
      render-html.cjs renderHtml + renderShell on a fixture; pass through
      conformance-check.checkConformance(html, {surface:'cockpit-html'});
      assert result.binding_fail === 0.

      SAC-P134-04: read sgsd-codex-monitor.ps1; pass through checkConformance
      with surface 'monitor'; assert it doesn't throw + result has structure
      {binding_fail, advisory_fail, ...}; specific binding_fail value is
      whatever the current state is (don't over-constrain).
    hypothesis: |-
      4 grep-and-call tests are sufficient.
    falsifier: |-
      Test pollution.
    stop_rule: |-
      Full self-test: 57/57 PASS exit 0.

  - id: P134-T4
    agent: sgsd-exec-docs
    model: codex
    files_touched:
      - .planning/milestones/v3.3/phases/134-cockpit-conformance-promotion/134-VERIFICATION.md
      - .planning/milestones/v3.3/phases/134-cockpit-conformance-promotion/PHASE-CAPSULE.json
    input_contract: |-
      Green self-test + git log. Mirror P133 VERIFICATION/CAPSULE shape.
    output_contract: |-
      VERIFICATION verdict=PASS, 4/4 SACs.
      CAPSULE with SHA-256 hashes.
    hypothesis: |-
      Deterministic projection.
    falsifier: |-
      Self-test not green.
    stop_rule: |-
      Both files exist; verdict=PASS; valid JSON.
    depends_on:
      - P134-T1
      - P134-T2
      - P134-T3
semantic_acceptance_criteria:
  - id: SAC-P134-01
    input: "design-rules.json parsed"
    expected_outcome: "rules array contains entries with ids R13, R14, R15, R16, R17, R18"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P134-01"
  - id: SAC-P134-02
    input: "conformance-check.cjs rule registry"
    expected_outcome: "registry contains R13..R18 keys mapped to functions"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P134-02"
  - id: SAC-P134-03
    input: "checkConformance(v3.3 fixture HTML, {surface:'cockpit-html'})"
    expected_outcome: "result.binding_fail === 0; cockpit-html surface accepted"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P134-03"
  - id: SAC-P134-04
    input: "checkConformance(PS monitor file text, {surface:'monitor'})"
    expected_outcome: "function returns without throwing; result has {binding_fail, advisory_fail} shape; 'monitor' surface accepted"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P134-04"
---

# P134-01 Conformance Promotion PLAN

## Scope

Add 6 binding rules R13-R18 for v3.3 band-grammar. Extend conformance-check.cjs to support 4 surfaces (chronicle / cockpit / cockpit-html / monitor). 4 SAC tests. Inherited from v3.2 backlog. Final v3.3 phase.

## Authoritative Inputs

134-CONTEXT.md, 133-VERIFICATION.md (baseline 53/53), conformance-check.cjs + design-rules.json (R01-R12 existing).

## Binding Invariants

Per 134-CONTEXT.md (4 invariants).

## File Operations

4 task-level ops.

## Tasks

4 tasks; full contracts in frontmatter.

## Phase Verification

`node run-self-test.cjs` → exit 0; 57/57 PASS (53 pre + 4 SAC-P134).

## Out of Scope

Per 134-CONTEXT.md.

## References

134-CONTEXT.md; v3.3 brief P134; v3.2 SUMMARY backlog entry; existing R01-R12 conformance plumbing.
