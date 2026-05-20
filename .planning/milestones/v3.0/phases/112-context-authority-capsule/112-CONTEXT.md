---
phase: 112
phase_name: Context Authority Capsule
milestone: v3.0
created: 2026-05-20
status: queued-planning-only
implementation_status: not-started
source: DLB-10.1 from SGSD-PRO proposal §6
predecessor: P111 PASS (DLB-09 complete)
final_phase: true
---

# Phase 112 — Context Authority Capsule

> Final v3.0 phase. Ships the per-milestone context capsule YAML files (the canonical source-of-truth substrate) + a context-composer that projects them into the mesh memory ledger as `context_anchor` CMBs. Pseudo-operator (P109) gains full context-pack input. Seeds the first capsule against v3.0 itself (eat our own dog food).

## Goal

Ship two layers:

### Layer 1 — Templates + tools (canonical infrastructure)

- **`super-gsd/templates/MILESTONE-CONTEXT.template.yaml`** — milestone WHY + outcome + non-goals + entry/exit criteria + operator preferences
- **`super-gsd/templates/PERSONA-MATRIX.template.yaml`** — per-persona `cares_about` / `does_not_want` / `search_bias` fields
- **`super-gsd/templates/DOMAIN-ONTOLOGY.template.yaml`** — entity types, their children, source-of-truth mappings
- **`super-gsd/templates/LEXICON.template.yaml`** — polysemy + domain-specific terminology with senses + personas
- **`super-gsd/templates/SOURCE-OF-TRUTH.template.yaml`** — what authoritative system owns which data class
- **`super-gsd/templates/NON-GOALS.template.yaml`** — explicit out-of-scope items
- **`super-gsd/tools/context-authority/context-composer.cjs`** — loads a milestone's 6 capsule YAMLs, validates each, emits `context_anchor` CMBs (one per file) into the mesh ledger with `canonical_source_path` + `canonical_source_hash` for staleness detection
- **`super-gsd/tools/context-authority/context-anchor-writer.cjs`** — projects one specific YAML/MD file into a `context_anchor` CMB (used by composer; standalone CLI)
- **`super-gsd/tools/context-authority/run-self-test.cjs`** — ≥15 assertions covering all templates + composer + writer
- **`super-gsd/tools/context-authority/package.json`** + **`README.md`**

### Layer 2 — v3.0's own capsule (dogfood)

- **`.planning/milestones/v3.0/context/MILESTONE-CONTEXT.yaml`** — instance for v3.0 SGSD-PRO
- **`.planning/milestones/v3.0/context/PERSONA-MATRIX.yaml`** — operator persona, codex-executor persona, claude-orchestrator persona
- **`.planning/milestones/v3.0/context/DOMAIN-ONTOLOGY.yaml`** — CMB types + their relationships
- **`.planning/milestones/v3.0/context/LEXICON.yaml`** — DLB-07/-08/-09/-10 terms + Tier 0/1/2 + carve-out names
- **`.planning/milestones/v3.0/context/SOURCE-OF-TRUTH.yaml`** — schema files, registries, decision log canonical paths
- **`.planning/milestones/v3.0/context/NON-GOALS.yaml`** — Pi harness, sym-mesh-channel, concurrent mesh, executor-authored CMBs, embeddings, Tier 3 SVAF

12 files total. The 6 templates + 6 v3.0 instances.

## Binding invariants

1. **YAML is canonical truth.** `context_anchor` CMBs are PROJECTIONS, not authority. Canonical content lives in `.planning/milestones/{m}/context/*.yaml`.
2. **Staleness detection mandatory.** Every `context_anchor` CMB carries `canonical_source_path` + `canonical_source_hash` (sha256 of file contents at projection time). When the source file's current hash differs, the anchor is stale and must be re-projected.
3. **CAT7 wraps; doesn't replace.** The `cat7` envelope on context_anchor CMBs cites the YAML anchors; doesn't invent new ontology terms.
4. **One CMB per source file.** Composer emits 6 context_anchor CMBs per milestone (one per capsule YAML), not one mega-CMB.
5. **Templates are starting points, not commandments.** Each milestone's capsule is hand-authored from the template; non-applicable sections may be omitted.
6. **v3.0 eats its own dog food.** The first capsule instance must be v3.0's own, proving the format is usable.

## Semantic acceptance criteria (target — 112-01 PLAN declares verbatim)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P112-01
    input: "all 6 capsule YAML templates under super-gsd/templates/"
    expected_outcome: "each parses as valid YAML and contains at least the minimum required sections"
    verification_cmd: "node super-gsd/tools/context-authority/run-self-test.cjs --self-test-templates; test $? -eq 0"

  - id: SAC-P112-02
    input: "context-anchor-writer.cjs invoked with a sample MILESTONE-CONTEXT.yaml"
    expected_outcome: "emits one context_anchor CMB with canonical_source_path + canonical_source_hash + projection_summary"
    verification_cmd: "node super-gsd/tools/context-authority/context-anchor-writer.cjs --self-test; test $? -eq 0"

  - id: SAC-P112-03
    input: "context-composer.cjs --milestone v3.0"
    expected_outcome: "emits 6 context_anchor CMBs (one per capsule YAML) to mesh ledger; all validate against cmb.schema.json"
    verification_cmd: "node super-gsd/tools/context-authority/context-composer.cjs --self-test; test $? -eq 0"

  - id: SAC-P112-04
    input: "all 6 v3.0 capsule YAML instances (MILESTONE-CONTEXT, PERSONA-MATRIX, DOMAIN-ONTOLOGY, LEXICON, SOURCE-OF-TRUTH, NON-GOALS)"
    expected_outcome: "each file exists, parses, has all template-required sections, and projects cleanly via context-composer"
    verification_cmd: "node super-gsd/tools/context-authority/run-self-test.cjs --self-test-v3-capsule; test $? -eq 0"

  - id: SAC-P112-05
    input: "context_anchor CMB with stale canonical_source_hash (manually mutated YAML after projection)"
    expected_outcome: "context-anchor-writer --check-staleness detects mismatch and reports 'stale'"
    verification_cmd: "node super-gsd/tools/context-authority/context-anchor-writer.cjs --self-test-stale; test $? -eq 0"

  - id: SAC-P112-06
    input: "integrated self-test covering all 6 templates + composer + writer + v3.0 capsule + staleness detection"
    expected_outcome: "exit 0 with ≥15 assertions passed"
    verification_cmd: "node super-gsd/tools/context-authority/run-self-test.cjs; test $? -eq 0"
```

## Out of scope

- Pseudo-operator's actual consumption of context_anchor CMBs in its Tier 2 LLM judge (P109 currently doesn't load anchors; live integration is post-v3.0)
- Backporting capsules to older milestones (v2.x)
- Qdrant indexing of context anchors (deferred to v3.1+ per DLB-10 limits)
- LLM-based ontology synthesis (capsules are hand-authored)

## Cross-references

- `.planning/proposals/2026-05-20-sgsd-pro-mode-codex-context-authority-plan.md` §6
- `.planning/decisions/DLB-08-MESH-MEMORY-LITE.md` — `context_anchor` CMB type spec
- `super-gsd/schemas/cmb.schema.json` — `context_anchor` schema branch (canonical_source_path + canonical_source_hash + projection_summary required)
- `super-gsd/tools/mesh-memory/cmb-validate.cjs` — used by composer to validate emitted CMBs
- `super-gsd/tools/mesh-memory/cmb-hash.cjs` — canonical hash for the projection itself
- `.planning/milestones/v3.0/INTENT.md` — source for v3.0's MILESTONE-CONTEXT.yaml content
- `.planning/milestones/v3.0/REQUIREMENTS.md` — REQ-CTX-01/-02/-03/-04/-05

## After P112: v3.0 milestone close

When P112 closes, v3.0 SGSD-PRO is ALL-PHASES-CLOSED. The DLB-08 + DLB-09 + DLB-10 substrate is complete. The four MVP exit fixtures are all green (already proved at P109 close).

Operator should run `sgsd-complete-milestone` to write SUMMARY.md and archive deferred items.

Then: HTML user guide (next session task, per operator request).
