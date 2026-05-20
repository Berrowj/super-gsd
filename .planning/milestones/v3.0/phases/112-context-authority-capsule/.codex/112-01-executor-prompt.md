# SDD Implementer — P112-01 executor (Context Authority capsule)

You are a fresh SDD implementer. No inherited context.

## What you are doing

3 tasks, ~14 files total. **Final v3.0 phase.** Ships the per-milestone context capsule YAML files + composer/writer tools + v3.0's own capsule instances (dogfood).

## Read

1. `.planning/milestones/v3.0/phases/112-context-authority-capsule/112-01-context-authority-capsule-PLAN.md` — 3-task contract
2. `.planning/milestones/v3.0/phases/112-context-authority-capsule/112-CONTEXT.md` — full design + 6 invariants
3. `super-gsd/schemas/cmb.schema.json` — context_anchor branch (body REQUIRED: canonical_source_path, canonical_source_hash, projection_summary)
4. `super-gsd/tools/mesh-memory/cmb-validate.cjs` — exemplar shape
5. `.planning/milestones/v3.0/INTENT.md` — source content for v3.0 MILESTONE-CONTEXT.yaml
6. `.planning/milestones/v3.0/REQUIREMENTS.md` — REQ-CTX-* requirements

## Task t1 — 6 templates + package.json + README

### Template files under `super-gsd/templates/`

Each template is a YAML skeleton with comments explaining each section. The actual content fields for each:

**`MILESTONE-CONTEXT.template.yaml`**:
```yaml
# Per-milestone context capsule. Canonical source-of-truth for WHY this milestone exists.
milestone_id: "v?.?"
title: "..."
business_why: |
  ...
primary_user_outcome: |
  ...
personas:
  - id: <role-id>
    priority: primary|secondary
    wants: [...]
    does_not_want: [...]
source_of_truth:
  <data-class>: <authoritative-system>
non_goals:
  - "..."
operator_preferences:
  review_gate_policy: "..."
  default_bias: "..."
  acceptable_override: "..."
```

**`PERSONA-MATRIX.template.yaml`**:
```yaml
personas:
  <persona-id>:
    cares_about: [...]
    usually_ignores: [...]
    search_bias:
      include: [...]
      suppress: [...]
```

**`DOMAIN-ONTOLOGY.template.yaml`**:
```yaml
entities:
  <entity-name>:
    children: [...]
    source_of_truth:
      <aspect>: <authoritative-system>
    invariants: [...]
    actions: [...]  # optional, for behavioral entities
```

**`LEXICON.template.yaml`**:
```yaml
terms:
  <term>:
    senses:
      - id: <sense-id>
        meaning: "..."
        fields: [...]  # optional
        personas: [...]  # which personas typically mean this sense
```

**`SOURCE-OF-TRUTH.template.yaml`**:
```yaml
data_classes:
  <data-class>:
    authoritative_system: "..."
    canonical_path: "..."  # optional file/db path
    notes: "..."
```

**`NON-GOALS.template.yaml`**:
```yaml
non_goals:
  - id: NG-<NN>
    statement: "..."
    rationale: "..."
    out_of_scope_for: ["this milestone", "this project", ...]
```

### `super-gsd/tools/context-authority/package.json`

```json
{
  "name": "sgsd-context-authority",
  "version": "1.0.0",
  "description": "DLB-10.1 Context Authority capsule — per-milestone YAML capsules projected into mesh as context_anchor CMBs",
  "main": "context-composer.cjs",
  "type": "commonjs",
  "dependencies": {
    "js-yaml": "^4.1.0",
    "ajv": "^8.18.0",
    "ajv-formats": "^3.0.1",
    "ajv-errors": "^3.0.0"
  }
}
```

### `super-gsd/tools/context-authority/README.md`

Brief. Cover: what context-authority is (DLB-10.1), how to author capsules (start from templates, fill in milestone-specific content), how to project (context-composer --milestone vX.Y emits anchors), how staleness detection works.

## Task t2 — `context-anchor-writer.cjs` + `context-composer.cjs`

### `super-gsd/tools/context-authority/context-anchor-writer.cjs`

CLI:
```
node context-anchor-writer.cjs [--help] [--source PATH] [--milestone vX.Y] [--phase NN] [--check-staleness <anchor-key>] [--self-test] [--self-test-stale]
```

Behavior:
- For `--source PATH --milestone vX.Y`: read the YAML/MD source, compute sha256 of contents, build a context_anchor CMB with full schema shape:
  - `key`: cmb-<sha256-of-canonical-payload>
  - `type`: context_anchor
  - `created_by`: context_authority
  - `role`: context_authority
  - `authority_level`: projection
  - `cat7`: filled with focus=source basename, issue=projection, intent=context anchor, etc.
  - `body.canonical_source_path`: the source path
  - `body.canonical_source_hash`: sha256 of source file content
  - `body.projection_summary`: short text summary of what the source contains
  - `lineage.parents: []` (root projection); `lineage.ancestors: []`
  - `status: emitted`
- Append to `.planning/mesh/memory/cmbs.jsonl`
- For `--check-staleness <anchor-key>`: load the named anchor from ledger, re-compute the source file's sha256, compare; print "fresh" or "stale" to stdout; exit 0 either way
- Validate the emitted CMB against cmb.schema.json via cmb-validate before writing
- `--self-test`: synthesize a fixture YAML, project, validate, exit 0
- `--self-test-stale`: synthesize a fixture YAML, project, then mutate the source, re-check staleness, expect "stale", exit 0

### `super-gsd/tools/context-authority/context-composer.cjs`

CLI:
```
node context-composer.cjs [--help] [--milestone vX.Y] [--self-test]
```

Behavior:
- For `--milestone vX.Y`: read `.planning/milestones/{vX.Y}/context/*.yaml` (the 6 capsule files), call context-anchor-writer for each, emit one context_anchor CMB per file (6 total)
- Print summary to stderr: how many anchors emitted, any failures
- `--self-test`: run against v3.0 capsule (assumes v3.0 instances exist; t3 creates them); expect 6 anchors emitted; exit 0

Same requireDependency pattern with plan-schema-first.

## Task t3 — v3.0 capsule instances + self-test runner

### `.planning/milestones/v3.0/context/MILESTONE-CONTEXT.yaml`

Hand-authored from the template, populated from `.planning/milestones/v3.0/INTENT.md`:
- milestone_id: "v3.0"
- title: "SGSD-PRO — Codex-native + Mesh Memory Lite + Context Authority"
- business_why: derived from INTENT.md "Why (strategic rationale)" — Clarity ERP incident, ATC reliability gap, context loss between agents
- primary_user_outcome: from INTENT.md — preserve context across gates, validate claims, detect echoes, bounded pseudo-op recs
- personas:
  - operator (priority: primary; wants clear next action, safe gates; doesn't want false escalation)
  - codex-executor (priority: secondary; wants bounded scope; doesn't want ambiguous file lists)
  - claude-orchestrator (priority: secondary; wants typed dispatches; doesn't want raw prose)
- source_of_truth:
  - cmb_schema: super-gsd/schemas/cmb.schema.json
  - plan_schema: super-gsd/templates/plan-schema-v2.json
  - codex_profiles: super-gsd/registry/codex-profiles.yaml
  - mesh_ledger: .planning/mesh/memory/cmbs.jsonl
  - decisions: .planning/decisions/
- non_goals: from REQUIREMENTS.md REQ-POL — no Pi, no sym-mesh, no concurrent mesh, no executor-CMBs in MVP, no embeddings, no autonomous production mutation, no replacing central control plane
- operator_preferences:
  - review_gate_policy: "verified critical findings block; unverified route to dispute"
  - default_bias: "preserve auditability over speed"
  - acceptable_override: "allowed when reviewer claim refuted by current file:line evidence"

### `.planning/milestones/v3.0/context/PERSONA-MATRIX.yaml`

```yaml
personas:
  operator:
    cares_about: [milestone progress, gate verdicts, real risks, decision precedents]
    usually_ignores: [routine commits, low-confidence reviewer chatter, fix-round iteration]
    search_bias:
      include: [decision_recommendation, operator_precedent, promotion_decision]
      suppress: [routine execution_receipt without follow-up review_finding]
  codex-executor:
    cares_about: [plan-locked allowed_files, acceptance commands, schema shapes]
    usually_ignores: [milestone-level context, persona priorities]
    search_bias:
      include: [PLAN-LOCKED.md, schemas, fixtures]
      suppress: [milestone INTENT/ROADMAP unless explicitly cited]
  claude-orchestrator:
    cares_about: [phase transitions, dispatch contracts, evidence chains]
    usually_ignores: [low-level code details, codex internal reasoning]
    search_bias:
      include: [CONTEXT.md, PLAN.md, VERIFICATION.md, STATE.md]
      suppress: [routine metric JSONL spam]
```

### `.planning/milestones/v3.0/context/DOMAIN-ONTOLOGY.yaml`

CMB types + their relationships (from DLB-08):
```yaml
entities:
  cmb:
    children: [execution_receipt, review_finding, evidence_verdict, decision_recommendation, operator_precedent, context_anchor, promotion_decision]
    source_of_truth:
      shape: super-gsd/schemas/cmb.schema.json
      ledger: .planning/mesh/memory/cmbs.jsonl
    invariants: [typed, append-only, content-hash-keyed, lineage-tracked, CAT7-enveloped]
  cmb_class:
    children: [observation, claim, claim_with_authority, decision, decision_highest, projection]
  authority_level:
    children: [observation, claim, claim_with_authority, decision, decision_highest, projection]
  carve_out:
    children: [production_mutation, credential_or_security, milestone_scope_change, commercial_legal_policy, low_confidence, destructive_or_irreversible]
    source_of_truth:
      enforcement: super-gsd/tools/mesh-memory/escalation-gate.cjs
```

### `.planning/milestones/v3.0/context/LEXICON.yaml`

Terms used in v3.0 with potentially-confusing senses:
```yaml
terms:
  authority_level:
    senses:
      - id: cmb_authority_field
        meaning: "Top-level CMB field declaring the cognitive class of the CMB (observation|claim|claim_with_authority|decision|decision_highest|projection)"
        personas: [codex-executor, claude-orchestrator]
      - id: decision_authority_tier
        meaning: "Body field on decision_recommendation; integer 1-3 indicating how much authority the pseudo_operator's recommendation carries"
        personas: [operator, claude-orchestrator]
  carve_out:
    senses:
      - id: escalation_carve_out
        meaning: "A hard rule that forces real_operator_required=true regardless of pseudo-op confidence (production mutation, credentials, scope change, commercial impact, low confidence, destructive)"
        personas: [operator]
  tier:
    senses:
      - id: evidence_validator_tier
        meaning: "Tier 0 deterministic / Tier 1 heuristic / Tier 2 LLM-judge in pseudo_operator / Tier 3 embedding-SVAF (not in v3.0)"
        personas: [claude-orchestrator]
  stoplight:
    senses:
      - id: codex_pro_routing
        meaning: "GREEN bounded executor / AMBER goal lane or app-lab / RED no execution route to operator"
        personas: [claude-orchestrator]
  CAT7:
    senses:
      - id: cmb_envelope
        meaning: "Fixed 7-field cognitive header on every CMB (focus, issue, intent, motivation, commitment, perspective, mood)"
        personas: [codex-executor, claude-orchestrator]
  fixture_path_in_real_data_check:
    senses:
      - id: dlb07_real_data_guard
        meaning: "Reason code emitted by evidence_validator when a review_finding's file_path resolves under fixtures/, mock/, or __mocks__/ — semantic ACs must hit real data per DLB-07"
        personas: [claude-orchestrator]
```

### `.planning/milestones/v3.0/context/SOURCE-OF-TRUTH.yaml`

```yaml
data_classes:
  cmb_schema:
    authoritative_system: file
    canonical_path: super-gsd/schemas/cmb.schema.json
  plan_schema:
    authoritative_system: file
    canonical_path: super-gsd/templates/plan-schema-v2.json
  plan_locked_schema:
    authoritative_system: file
    canonical_path: super-gsd/schemas/plan-locked.schema.json
  codex_profiles:
    authoritative_system: file
    canonical_path: super-gsd/registry/codex-profiles.yaml
  codex_hooks:
    authoritative_system: file
    canonical_path: .codex/hooks.json
  mesh_memory_ledger:
    authoritative_system: append-only-jsonl
    canonical_path: .planning/mesh/memory/cmbs.jsonl
  pro_mode_stoplight_ledger:
    authoritative_system: append-only-jsonl
    canonical_path: .planning/metrics/pro-mode-stoplight.jsonl
  codex_tool_events_ledger:
    authoritative_system: append-only-jsonl
    canonical_path: .planning/metrics/codex-tool-events.jsonl
  v3_0_intent:
    authoritative_system: file
    canonical_path: .planning/milestones/v3.0/INTENT.md
  v3_0_requirements:
    authoritative_system: file
    canonical_path: .planning/milestones/v3.0/REQUIREMENTS.md
  v3_0_roadmap:
    authoritative_system: file
    canonical_path: .planning/milestones/v3.0/ROADMAP.md
  dlb_decisions:
    authoritative_system: file
    canonical_path: .planning/decisions/
```

### `.planning/milestones/v3.0/context/NON-GOALS.yaml`

```yaml
non_goals:
  - id: NG-01
    statement: No Pi-agent-harness dependency
    rationale: Anthropic OAuth ToS forbids Pi for Claude
    out_of_scope_for: [this milestone, this project until ToS changes]
  - id: NG-02
    statement: No sym-mesh-channel critical-path dependency
    rationale: Anthropic plugin propagation unresolved (github.com/anthropics/claude-plugins-official/issues/1512); optional experiment branch only
    out_of_scope_for: [this milestone]
  - id: NG-03
    statement: No concurrent autonomous agent mesh
    rationale: Logical peers + sequential runtime; single Windows 11 box; honest framing
    out_of_scope_for: [this milestone, v3.1 unless N≥10 mesh demand emerges]
  - id: NG-04
    statement: No executor-authored CMBs in MVP
    rationale: SGSD wrapper emits execution_receipt CMBs from observable facts; agents emit claims, not observations
    out_of_scope_for: [this milestone]
  - id: NG-05
    statement: No embedding-backed SVAF (Tier 3)
    rationale: Tier 0+1 deterministic+heuristic + Tier 2 LLM judge sufficient for MVP; embeddings deferred until evidence justifies cost
    out_of_scope_for: [this milestone, v3.1]
  - id: NG-06
    statement: No autonomous production / SAP / Mongo / Qdrant destructive writes
    rationale: Hard carve-out in escalation_gate; pseudo-op cannot bypass regardless of confidence
    out_of_scope_for: [permanently — safety architecture]
  - id: NG-07
    statement: No replacement of SGSD central control plane
    rationale: Mesh-shaped memory, central-shaped runtime; SGSD owns mission/gates/promotion
    out_of_scope_for: [permanently — architectural axiom]
```

### `super-gsd/tools/context-authority/run-self-test.cjs`

≥15 assertions:

1. All 6 templates exist under super-gsd/templates/
2. All 6 templates parse as valid YAML
3. MILESTONE-CONTEXT.template has top-level keys: milestone_id, title, business_why, primary_user_outcome, personas, source_of_truth, non_goals, operator_preferences
4. PERSONA-MATRIX.template has top-level key: personas
5. DOMAIN-ONTOLOGY.template has top-level key: entities
6. LEXICON.template has top-level key: terms
7. SOURCE-OF-TRUTH.template has top-level key: data_classes
8. NON-GOALS.template has top-level key: non_goals
9. context-anchor-writer.cjs --help exits 0
10. context-composer.cjs --help exits 0
11. context-anchor-writer.cjs --self-test exits 0
12. context-anchor-writer.cjs --self-test-stale exits 0
13. All 6 v3.0 instances exist under .planning/milestones/v3.0/context/
14. All 6 v3.0 instances parse as valid YAML
15. context-composer.cjs --self-test exits 0 (emits 6 context_anchor CMBs)
16. After self-test, mesh ledger has at least 6 context_anchor CMBs

Print `[context-authority self-test] N/N passed`; exit 1 on any fail.

## All emitted CMBs must have FULL schema shape

Per the recurring lesson from P107-P110: every CMB emitted must include milestone_id + phase_id + cat7 (all 7 fields) + lineage.parents + lineage.ancestors + authority_level + evidence_refs + status. Body fields per-type per schema.

## requireDependency must use plan-schema-first candidate order.

## Verification

```bash
node super-gsd/tools/context-authority/context-composer.cjs --help
node super-gsd/tools/context-authority/run-self-test.cjs
```

The second must report ≥15/15 passed, exit 0.

## Out of scope

- Pseudo-operator live consumption of context anchors (post-v3.0 integration work)
- Backporting capsules to v2.x milestones
- Qdrant indexing
- LLM-based ontology synthesis (capsules are hand-authored)

## Report

```
PATCH_BEGIN
<unified diff>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/templates/*.template.yaml × 6 (created)
  super-gsd/tools/context-authority/* × 5 (created)
  .planning/milestones/v3.0/context/*.yaml × 6 (created)
VERIFICATION:
  - context-composer --help works
  - All 6 v3.0 capsule instances exist + parse
  - Self-test reports ≥15/15 passed
DEVIATIONS: <none>
BLOCKERS: <none>
ONE_LINER: P112 DLB-10.1 shipped — Context Authority capsule + v3.0 dogfood instances; FINAL v3.0 phase.
REPORT_END
```
