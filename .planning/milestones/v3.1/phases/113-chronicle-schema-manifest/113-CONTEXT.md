---
phase: 113
phase_name: Chronicle Schema + Manifest
milestone: v3.1
created: 2026-05-21
status: queued-planning-only
implementation_status: not-started
source: DLB-11.1 — Operator Chronicle Layer; first phase
predecessor: v3.0 P112 PASS (Context Authority capsule shipped)
---

# Phase 113 — Chronicle Schema + Manifest

> First v3.1 phase. Schema contract for the Operator Chronicle artefact. Defines the structure of `chronicle.schema.json` + `chronicle-manifest.schema.json` + the fixtures that prove the schema enforces the design philosophy (synthesis with citations; observation/claim/decision separation; offline-survivable).

## Goal

Ship the JSON Schema(s) + fixtures + ajv-errors CHRONICLE-XX error codes that the v3.1 chronicle toolchain (P114 builder, P115 renderer, P116 validator, P117 publisher) consumes.

This phase ships ZERO executable tools. Schema + fixtures only. Same shape as v3.0 P106.

## Binding invariants (inherited from DLB-11 + post-VTP-enrichment refinements 2026-05-21)

1. **Chronicle is a projection of SGSD truth, never an agent opinion.** Every chronicle claim must cite a CMB key, file path, test name, or commit SHA. Schema enforces this via `citations[]` required on every claim node.
2. **Observation / claim / decision separation maintained via Norman signifiers (R6).** Chronicle sections are explicitly typed: `observations[]`, `claims[]`, `evidence_verdicts[]`, `decisions[]`, `denominators[]`, `synthesis[]`, `autonomy_disclosure[]`. Each section node declares `signifier_role` (enum mirrors HTML `<section role="...">`). Schema rejects mixed-class buckets.
3. **Synthesis allowed only with citations.** ELI5, "remember tomorrow", agent autonomy disclosure — all permitted as synthesis nodes IFF each synthesis claim has citations[]. Empty citations array on a synthesis node → REPORT_UNGROUNDED.
4. **Self-contained HTML mandate.** Schema's `assets[]` field is for inline SVG / inline CSS / inline JS only — no external URL references. Validator (P116) cross-checks.
5. **Manifest grounds the chronicle.** Every chronicle ships with `chronicle-manifest.schema.json` describing: source CMB IDs, source file paths + hashes, source test runs + commits, generator versions, generated_at timestamp.
6. **PUML source is mandatory for every diagram (R1).** Schema's `diagrams[]` entries each carry: `puml_source` (string, required) + `rendered_svg` (string, required) + `repo_path_labels[]` (≥1, each component must reference an actual repo path) + `arrow_intent_labels[]` (≥1, each arrow carries semantic intent). No `!include http://...` in `puml_source` (validator rejects with CHRONICLE-05).
7. **Denominator panel mandatory (R2 — Forage V2 countermeasure).** Schema requires `denominators[]` at the chronicle root with subfields: `scope_excluded[]`, `carve_outs_not_fired[]`, `alternatives_rejected[]`, `assumptions_made[]`, `gates_skipped[]`. Empty array allowed iff `denominators_empty_reason:` is present (single-string field). Schema rejects missing field with CHRONICLE-06.

## Files this phase will create

| Path | Op |
|---|---|
| `super-gsd/schemas/chronicle.schema.json` | create |
| `super-gsd/schemas/chronicle-manifest.schema.json` | create |
| `super-gsd/tools/chronicle/fixtures/good-phase-chronicle.json` | create |
| `super-gsd/tools/chronicle/fixtures/good-milestone-chronicle.json` | create |
| `super-gsd/tools/chronicle/fixtures/good-manifest.json` | create |
| `super-gsd/tools/chronicle/fixtures/good-with-denominator-populated.json` | create (R2 — populated denominators[]) |
| `super-gsd/tools/chronicle/fixtures/good-with-puml-source.json` | create (R1 — diagram with puml_source + repo_path_labels + arrow_intent_labels) |
| `super-gsd/tools/chronicle/fixtures/bad-claim-without-citation.json` | create (rejects: CHRONICLE-01) |
| `super-gsd/tools/chronicle/fixtures/bad-synthesis-without-citation.json` | create (rejects: CHRONICLE-02) |
| `super-gsd/tools/chronicle/fixtures/bad-mixed-cognitive-class.json` | create (rejects: CHRONICLE-03) |
| `super-gsd/tools/chronicle/fixtures/bad-external-cdn-url.json` | create (rejects: CHRONICLE-04) |
| `super-gsd/tools/chronicle/fixtures/bad-puml-with-external-include.json` | create (rejects: CHRONICLE-05 — R1; `!include http://...` in puml_source) |
| `super-gsd/tools/chronicle/fixtures/bad-missing-denominator-panel.json` | create (rejects: CHRONICLE-06 — R2; denominators field absent) |
| `super-gsd/tools/chronicle/fixtures/bad-empty-denominator-no-reason.json` | create (rejects: CHRONICLE-07 — R2; denominators empty without denominators_empty_reason) |
| `super-gsd/tools/chronicle/fixtures/bad-cmb-cited-by-value.json` | create (rejects: CHRONICLE-08 — R5; citations carrying full CMB body instead of ID) |
| `super-gsd/tools/chronicle/fixtures/bad-manifest-missing-hash.json` | create (rejects: CHRONICLE-MANIFEST-01) |

16 files total. No tooling. (Original 10 + 6 refinement-driven additions: 2 good fixtures for R1/R2 + 4 bad fixtures for new error codes CHRONICLE-05..CHRONICLE-08.)

## Semantic acceptance criteria (target — 113-01 PLAN declares verbatim)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P113-01
    input: "fixtures/good-phase-chronicle.json"
    expected_outcome: "validates against chronicle.schema.json (VALID)"
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema chronicle --fixture fixtures/good-phase-chronicle.json; test $? -eq 0"

  - id: SAC-P113-02
    input: "fixtures/good-milestone-chronicle.json"
    expected_outcome: "validates against chronicle.schema.json (the milestone-level variant)"
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema chronicle --fixture fixtures/good-milestone-chronicle.json; test $? -eq 0"

  - id: SAC-P113-03
    input: "fixtures/good-manifest.json"
    expected_outcome: "validates against chronicle-manifest.schema.json"
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema manifest --fixture fixtures/good-manifest.json; test $? -eq 0"

  - id: SAC-P113-04
    input: "fixtures/bad-claim-without-citation.json"
    expected_outcome: "schema REJECTS with CHRONICLE-01 (claim node missing citations[])"
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema chronicle --fixture fixtures/bad-claim-without-citation.json 2>&1 | grep -q 'CHRONICLE-01'"

  - id: SAC-P113-05
    input: "fixtures/bad-synthesis-without-citation.json"
    expected_outcome: "schema REJECTS with CHRONICLE-02 (synthesis node missing citations[])"
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema chronicle --fixture fixtures/bad-synthesis-without-citation.json 2>&1 | grep -q 'CHRONICLE-02'"

  - id: SAC-P113-06
    input: "fixtures/bad-mixed-cognitive-class.json"
    expected_outcome: "schema REJECTS with CHRONICLE-03 (observation in claims bucket)"
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema chronicle --fixture fixtures/bad-mixed-cognitive-class.json 2>&1 | grep -q 'CHRONICLE-03'"

  - id: SAC-P113-07
    input: "fixtures/bad-external-cdn-url.json"
    expected_outcome: "schema REJECTS with CHRONICLE-04 (external CDN URL in assets[])"
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema chronicle --fixture fixtures/bad-external-cdn-url.json 2>&1 | grep -q 'CHRONICLE-04'"

  - id: SAC-P113-08
    input: "fixtures/bad-manifest-missing-hash.json"
    expected_outcome: "manifest schema REJECTS with CHRONICLE-MANIFEST-01 (source file paths without hashes)"
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema manifest --fixture fixtures/bad-manifest-missing-hash.json 2>&1 | grep -q 'CHRONICLE-MANIFEST-01'"

  - id: SAC-P113-09
    input: "fixtures/good-with-puml-source.json"
    expected_outcome: "validates against chronicle.schema.json; diagram carries puml_source + repo_path_labels[≥1] + arrow_intent_labels[≥1]"
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema chronicle --fixture fixtures/good-with-puml-source.json; test $? -eq 0"

  - id: SAC-P113-10
    input: "fixtures/good-with-denominator-populated.json"
    expected_outcome: "validates against chronicle.schema.json; denominators[] populated with all 5 sub-arrays + at least one entry each"
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema chronicle --fixture fixtures/good-with-denominator-populated.json; test $? -eq 0"

  - id: SAC-P113-11
    input: "fixtures/bad-puml-with-external-include.json"
    expected_outcome: "schema REJECTS with CHRONICLE-05 (puml_source contains !include http://...)"
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema chronicle --fixture fixtures/bad-puml-with-external-include.json 2>&1 | grep -q 'CHRONICLE-05'"

  - id: SAC-P113-12
    input: "fixtures/bad-missing-denominator-panel.json"
    expected_outcome: "schema REJECTS with CHRONICLE-06 (denominators field absent)"
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema chronicle --fixture fixtures/bad-missing-denominator-panel.json 2>&1 | grep -q 'CHRONICLE-06'"

  - id: SAC-P113-13
    input: "fixtures/bad-empty-denominator-no-reason.json"
    expected_outcome: "schema REJECTS with CHRONICLE-07 (denominators empty without denominators_empty_reason)"
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema chronicle --fixture fixtures/bad-empty-denominator-no-reason.json 2>&1 | grep -q 'CHRONICLE-07'"

  - id: SAC-P113-14
    input: "fixtures/bad-cmb-cited-by-value.json"
    expected_outcome: "schema REJECTS with CHRONICLE-08 (citation carries CMB body instead of CMB ID; R5 by-reference invariant)"
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema chronicle --fixture fixtures/bad-cmb-cited-by-value.json 2>&1 | grep -q 'CHRONICLE-08'"
```

14 SACs (8 original + 6 refinement-driven). Same shape as v3.0 P106 (schema-only phase with fixture-driven validation).

### Error code summary

| Code | Trigger | Refinement |
|---|---|---|
| CHRONICLE-01 | Claim node missing citations[] | DLB-11 v1 |
| CHRONICLE-02 | Synthesis node missing citations[] | DLB-11 v1 |
| CHRONICLE-03 | Observation appearing in claims bucket (mixed cognitive class) | DLB-11 v1 |
| CHRONICLE-04 | assets[] referencing external URL (CDN/JS) | DLB-11 v1 |
| CHRONICLE-05 | puml_source contains `!include http://...` | R1 |
| CHRONICLE-06 | denominators field absent at chronicle root | R2 |
| CHRONICLE-07 | denominators[] empty without denominators_empty_reason | R2 |
| CHRONICLE-08 | citation carrying full CMB body instead of CMB ID | R5 |
| CHRONICLE-MANIFEST-01 | manifest source_file_paths without hashes | DLB-11 v1 |

## Out of scope

- Context-pack builder (P114)
- HTML renderer (P115)
- Validator implementation (P116) — schema only here; validator tool ships P116
- Storage adapter (P117)
- Cockpit integration (P118)
- Milestone Chronicle + roadmap miner (P119)
- Modifying v3.0 frozen tools

## Cross-references

- `.planning/decisions/DLB-11-CHRONICLE-LAYER.md` — design lock; binding invariants
- `.planning/milestones/v3.1/INTENT.md` — milestone WHY
- `.planning/milestones/v3.1/ROADMAP.md` — phase mapping
- `super-gsd/schemas/cmb.schema.json` — CMB shape that chronicle citations reference (lineage)
- `super-gsd/templates/plan-schema-v2.json` — v3.1 plans validate against this; SCHEMA-09 enforced
- `.planning/analyses/2026-05-21-sgsd-v3-user-guide.html` — POC for the HTML style + ELI5 idiom the schema's HTML-generation contract supports

## Note on cmb-validate-helper.cjs

The SACs reference `super-gsd/tools/chronicle/cmb-validate-helper.cjs` — a small CLI that loads a named schema + a fixture and validates. **This is P114 work, NOT P113.** P113 ships the schemas + fixtures; P114 ships the helper + the context-pack builder; the SAC verification commands run at P114 close (same pattern as v3.0 P106 → P107).

P113's local close gate: schema files parse as valid JSON + fixtures parse as valid JSON + each fixture conforms to the design intent (validator confirms at P114).
