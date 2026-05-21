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

## Binding invariants (inherited from DLB-11)

1. **Chronicle is a projection of SGSD truth, never an agent opinion.** Every chronicle claim must cite a CMB key, file path, test name, or commit SHA. Schema enforces this via `citations[]` required on every claim node.
2. **Observation / claim / decision separation maintained.** Chronicle sections are explicitly typed: `observations[]`, `claims[]`, `evidence_verdicts[]`, `decisions[]`. Schema rejects mixed-class buckets.
3. **Synthesis allowed only with citations.** ELI5, "remember tomorrow", agent autonomy disclosure — all permitted as synthesis nodes IFF each synthesis claim has citations[]. Empty citations array on a synthesis node → REPORT_UNGROUNDED.
4. **Self-contained HTML mandate.** Schema's `assets[]` field is for inline SVG / inline CSS / inline JS only — no external URL references. Validator (P116) cross-checks.
5. **Manifest grounds the chronicle.** Every chronicle ships with `chronicle-manifest.schema.json` describing: source CMB IDs, source file paths + hashes, source test runs + commits, generator versions, generated_at timestamp.

## Files this phase will create

| Path | Op |
|---|---|
| `super-gsd/schemas/chronicle.schema.json` | create |
| `super-gsd/schemas/chronicle-manifest.schema.json` | create |
| `super-gsd/tools/chronicle/fixtures/good-phase-chronicle.json` | create |
| `super-gsd/tools/chronicle/fixtures/good-milestone-chronicle.json` | create |
| `super-gsd/tools/chronicle/fixtures/good-manifest.json` | create |
| `super-gsd/tools/chronicle/fixtures/bad-claim-without-citation.json` | create (rejects: claim node missing citations[]) |
| `super-gsd/tools/chronicle/fixtures/bad-synthesis-without-citation.json` | create (rejects: ELI5/recommendation node missing citations[]) |
| `super-gsd/tools/chronicle/fixtures/bad-mixed-cognitive-class.json` | create (rejects: observation in claims bucket) |
| `super-gsd/tools/chronicle/fixtures/bad-external-cdn-url.json` | create (rejects: assets[] referencing external URL) |
| `super-gsd/tools/chronicle/fixtures/bad-manifest-missing-hash.json` | create (rejects: manifest with source_file_paths but no hashes) |

10 files total. No tooling.

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
```

8 SACs. Same shape as v3.0 P106 (schema-only phase with fixture-driven validation).

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
