---
phase: 106
phase_name: Mesh CMB Schema and Canonical Hashing
milestone: v3.0
created: 2026-05-20
status: queued-planning-only
implementation_status: not-started
source: DLB-08 Mesh Memory Lite; derived from Pi2Pi meeting 81e85fd0 + Mesh Memory Protocol (arXiv 2604.19540)
predecessor: DLB-07 schema enforcement (P97.5)
no_implementation_yet: true
---

# Phase 106 — Mesh CMB Schema and Canonical Hashing

> **This CONTEXT is the deliberation surface for P106. It is not a PLAN.md and not an implementation brief. Implementation begins only after this CONTEXT is reviewed and converted into a PLAN-LOCKED.md-style phase plan.**

## What this phase will do (eventually)

Produce the **CMB schema** for SGSD's Mesh Memory Lite layer. Defines the seven CMB types, their canonical payload, the content-hash algorithm, and the fixture contract (good × 7, bad × 6) that proves the schema enforces the design philosophy.

This phase does NOT produce: tools, hooks, MCP servers, executor wrappers, lineage walkers, echo detectors, evidence validators, pseudo-operator peers, or escalation gates. Those land in P107–P109.

## The binding rules this phase locks

Twelve rules. All twelve are non-negotiable for v3.0 and re-checked at every phase close.

### 1. Mesh-shaped memory, central-shaped runtime

Logical peers, sequential execution. We are NOT building concurrent autonomous mesh convergence. We are building lineaged role-filtered memory under a central serialised orchestrator. Honest framing prevents claims we cannot back at N=1 machine.

### 2. Observations / claims / decisions are different classes

SGSD must never treat a claim CMB as an observation CMB. Three CMB classes with hard separation:

- **Observations** (SGSD-emitted, derived from facts, high authority): `execution_receipt`, future `test_receipt`, `file_evidence`, `audit_result`.
- **Claims** (agent-emitted, low/medium authority until validated): `review_finding`, future `board_argument`, `model_recommendation`.
- **Decisions** (bounded authority, gated by carve-outs): `decision_recommendation`, `operator_precedent`, `promotion_decision`.

The schema enforces this via `created_by` role validation + `type` enum + class-specific required-field rules.

### 3. Seven allowed CMB types — no more, no fewer in MVP

```
execution_receipt        (observation)
review_finding           (claim)
evidence_verdict         (claim-with-authority)
decision_recommendation  (decision)
operator_precedent       (decision, highest)
context_anchor           (projection, not authority)
promotion_decision       (decision, terminal)
```

Adding an eighth type requires a new DLB entry. Removing one likewise.

### 4. CAT7 is an envelope, not an ontology

Every CMB has `cat7: { focus, issue, intent, motivation, commitment, perspective, mood }`. Fixed seven fields; richness lives in field text. The mood field optionally carries `valence` (−1 to 1) and `arousal` (−1 to 1) floats.

**CAT7 must not invent ontology terms as authority.** CAT7 fields cite canonical anchors:

```json
"motivation": "Preserve auditability per MILESTONE-CONTEXT.yaml#primary_user_outcome"
```

✓ acceptable — cites a canonical anchor.

```json
"motivation": "This milestone is for finance-first reversal semantics"
```

✗ rejected — invents authority not anchored in the milestone capsule.

### 5. YAML / MD canonical context rule

The milestone Context Authority capsule files (`MILESTONE-CONTEXT.yaml`, `PERSONA-MATRIX.yaml`, `DOMAIN-ONTOLOGY.yaml`, `LEXICON.yaml`, `SOURCE-OF-TRUTH.yaml`, `NON-GOALS.yaml`) are canonical truth.

`context_anchor` CMBs are PROJECTIONS of those files into the mesh. Required fields on every `context_anchor`:

- `canonical_source_path` — file path of the YAML/MD source
- `canonical_source_hash` — sha256 of the source file at projection time
- `projection_summary` — text projection of relevant content

If `canonical_source_hash` no longer matches the file's current sha256, the anchor is **stale** and must be re-projected before use. Mesh memory does not become a second source of truth.

### 6. No executor-authored CMBs in MVP

Codex executor's report contract is unchanged. Executors do not author CMBs. SGSD wrapper observes what happened and emits `execution_receipt` CMBs from observable facts.

This is the load-bearing safety property: **agents emit claims; SGSD emits observations.** Conflating the two is how model-generated memory becomes fake truth.

### 7. SGSD-emitted execution receipts

`execution_receipt` CMBs are SGSD-authored, generated from observable repo + test state. Required fields:

- `commit_before` — git rev pre-execution
- `commit_after` — git rev post-execution
- `changed_files[]` — paths that actually changed
- `tests_run[]` — `{ command, result, count }` per test invocation
- `report_path` — path to executor's free-form report
- `report_hash` — sha256 of report text (for integrity)
- `acceptance_criteria_touched[]` — which SACs from the plan were exercised

`created_by` must be `sgsd` or `sgsd-wrapper`. Agent roles are rejected.

### 8. Reviewer / evidence-validator / pseudo-operator are three distinct receivers

The roles answer three different questions:

| Role | Question | Emits |
|---|---|---|
| Reviewer (ATC / Codex / board) | What might be wrong? | `review_finding` |
| Evidence validator | Is that claim true against current evidence? | `evidence_verdict` |
| Pseudo operator | Given the validated claims and context, what should SGSD do? | `decision_recommendation` |

ATC v22-13c happened because these got blurred. The schema enforces separation by `role` field + class-specific allowed `created_by` roles.

### 9. Deterministic Tier 0 + heuristic Tier 1 evidence validation in MVP

The evidence_validator (lands P108) uses tiered admission:

- **Tier 0 — deterministic:** file exists, line exists, grep match, test passed, schema validates
- **Tier 1 — structured heuristic:** claim type, severity, changed-file overlap, lineage to prior finding

MVP uses Tier 0 + Tier 1 only. Each evidence_verdict CMB records `tier_used` and `decision_basis` for auditability.

### 10. Tier 2 LLM judge only inside pseudo-operator

The pseudo_operator (lands P109) may use Tier 2 LLM judgment for genuinely semantic decisions — milestone-context trade-offs, persona conflicts, lexicon disambiguation. Tier 2 is bounded by:

- Confidence score ≥ 0.70 required to recommend any non-escalation outcome
- Hard carve-outs (rule 11) override Tier 2 regardless of confidence

**Tier 3 (embedding-backed SVAF) is explicitly out of scope.** v3.1+ work; do not attempt in v3.0.

### 11. Hard escalation carve-outs

The pseudo_operator's escalation gate (P109) blocks autonomous decisions and forces real-operator escalation under any of:

- Production / SAP / Mongo / Qdrant / Elasticsearch destructive write
- Credential or security issue (any key/token/credential reference; any auth-bypass concern)
- Milestone scope change (introducing or removing a milestone-level commitment)
- Commercial / legal / policy implication
- Pseudo-operator confidence < 0.70
- Decision is destructive / not easily reversible

These are HARD overrides. No pseudo-operator heroics. The fake duty officer does not sign the SAP cheque book.

### 12. MVP success tests — four green fixtures

DLB-08 has succeeded when these four fixtures all run green at the end of P109:

- **Fixture A — false-CRIT refutation:** ATC v22-13c-style false CRIT refuted against current HEAD; routes to `PASS_WITH_REFUTED_REVIEW`; operator not woken.
- **Fixture B — context-aware pseudo-op:** Context-aware `decision_recommendation` produced before any escalation; cites context anchors + decision precedents.
- **Fixture C — lineage chain end-to-end:** `execution_receipt` → `review_finding` → `evidence_verdict` → `decision_recommendation` → `promotion_decision` visible.
- **Fixture D — restraint proof:** Production-mutation scenario forces real operator escalation despite pseudo-op confidence ≥ 0.80.

Fixture A is the load-bearing bug. Fixture C is the existence proof. Fixture B is the escalation reduction. Fixture D is the safety case.

---

## The seven CMB types — schema specification (target)

> The actual JSON Schema will be authored in P106's PLAN-LOCKED.md and implemented after this CONTEXT is reviewed. This section specifies the **shape** the schema must enforce.

### Common required fields (all types)

| Field | Type | Purpose |
|---|---|---|
| `key` | string | sha256 hex of canonical payload (see canonical hashing below) |
| `type` | string enum | one of the seven CMB types |
| `created_at` | ISO 8601 string | wall-clock time of emission (NOT in canonical hash) |
| `created_by` | string | emitter identity (role or `sgsd`/`sgsd-wrapper`) |
| `role` | string enum | { sgsd, reviewer, evidence_validator, pseudo_operator, operator, context_authority } |
| `milestone_id` | string | active milestone version |
| `phase_id` | string | phase number (may be null for global CMBs) |
| `cat7` | object | the seven CAT7 fields (focus, issue, intent, motivation, commitment, perspective, mood) |
| `body` | object | type-specific payload (see per-type schemas below) |
| `lineage.parents` | string[] | content-hash keys of direct provenance CMBs |
| `lineage.ancestors` | string[] | transitive closure of parents (bounded depth ≤ 50) |
| `authority_level` | enum | { observation, claim, claim_with_authority, decision, decision_highest, projection } |
| `evidence_refs` | string[] | optional file:line or test-name references |
| `status` | enum | { emitted, admitted, remixed, superseded, stale } |

### Per-type rules

**`execution_receipt`** — `created_by` must be `sgsd` or `sgsd-wrapper`; body must include `commit_before`, `commit_after`, `changed_files[]`, `tests_run[]`, `report_path`, `report_hash`, `acceptance_criteria_touched[]`.

**`review_finding`** — `created_by` is a reviewer role; body must include `severity`, `claim`, `current_commit`; SHOULD include `file_path`, `line_start`, `line_end`, `quoted_excerpt`, `violated_invariant`, `reproducer_command`, `confidence`. Without file:line refs, the claim defaults to `UNVERIFIED` admission state at P108 validation.

**`evidence_verdict`** — `created_by` is `evidence_validator`; `lineage.parents` MUST contain at least one `review_finding` key; body must include `evidence_status ∈ { VERIFIED_CRIT, REFUTED_CRIT, STALE_CRIT, UNVERIFIED_CRIT, GUARDED_CRIT }`, `refuting_evidence[]` (if applicable), `tests_refuting[]` (if applicable), `tier_used` (0|1), `decision_basis`.

**`decision_recommendation`** — `created_by` is `pseudo_operator`; body must include `recommendation`, `authority_level` (1-3), `confidence` (0-1), `real_operator_required` (bool), `context_pack_id`, `evidence_refs[]`, `carve_outs_triggered[]`. If any carve-out from rule 11 fired, `real_operator_required` is forced true regardless of confidence.

**`operator_precedent`** — `created_by` is `operator`; `authority_level: decision_highest`; supersedes prior precedents via `lineage.parents`.

**`context_anchor`** — `created_by` is `context_authority`; body MUST include `canonical_source_path`, `canonical_source_hash`, `projection_summary`. Missing either source-path or source-hash → schema reject.

**`promotion_decision`** — `created_by` is `sgsd`; body must include `verdict ∈ { PASS, PASS_WITH_REFUTED_REVIEW, PASS_WITH_WARNINGS, FAIL_VERIFIED, NEEDS_OPERATOR, STALE_REVIEW }`, `phase`, `lineage.parents` containing relevant evidence_verdict + decision_recommendation keys.

### Canonical payload hashing rule

```
content_hash = sha256(
  JSON.stringify(
    {
      type,
      created_by,
      role,
      milestone_id,
      phase_id,
      cat7,
      body,
      lineage.parents,
      authority_level,
      evidence_refs
    },
    sortedKeys = true
  )
)
```

**`created_at` is excluded.** Changing the timestamp on a CMB whose content has not changed must NOT change the content_hash. This is the foundation of echo detection by content (P108).

`status` is also excluded — status is mutable lifecycle state, not part of the cognitive content.

---

## Fixture contract (target — actual files land in P106 PLAN-LOCKED.md execution)

The P106 implementation must ship seven good fixtures and six bad fixtures. Each is a JSON file under `super-gsd/tools/mesh-memory/fixtures/`.

### Good fixtures (must validate as VALID)

| File | Demonstrates |
|---|---|
| `good-execution-receipt.json` | Valid SGSD-emitted observation with full commit/test/report fields |
| `good-review-finding.json` | Valid reviewer claim with file:line + quoted_excerpt + violated_invariant |
| `good-evidence-verdict.json` | Valid evidence_validator output with `evidence_status: REFUTED_CRIT` + refuting evidence |
| `good-decision-recommendation.json` | Valid pseudo_operator decision with authority_level + confidence + no carve-outs triggered |
| `good-operator-precedent.json` | Valid operator precedent with `authority_level: decision_highest` |
| `good-context-anchor.json` | Valid projection of a MILESTONE-CONTEXT.yaml fragment with canonical_source_path + canonical_source_hash |
| `good-promotion-decision.json` | Valid SGSD-emitted terminal decision with `verdict: PASS_WITH_REFUTED_REVIEW` |

### Bad fixtures (must validate as INVALID with specific error code)

| File | Demonstrates the rejected drift |
|---|---|
| `bad-claim-as-observation.json` | A `review_finding` with `created_by: sgsd` — rejecting the conflation of claim and observation (rule 2) |
| `bad-context-anchor-without-source.json` | A `context_anchor` missing `canonical_source_path` — rejecting the "mesh becomes second source of truth" drift (rule 5) |
| `bad-execution-receipt-created-by-agent.json` | An `execution_receipt` with `created_by: codex` — rejecting executor-authored receipts (rule 6) |
| `bad-cmb-missing-cat7.json` | A CMB without complete CAT7 fields — rejecting envelope-less CMBs (rule 4) |
| `bad-cmb-created-at-affects-hash.json` | Demonstrates that changing only `created_at` does NOT change content_hash (positive test for the hashing rule) |
| `bad-review-finding-without-lineage.json` | A `review_finding` claiming blocking status without an `evidence_verdict` parent — rejecting reviewer self-authority (rule 8) |

The bad-fixture set is the existence proof that the schema enforces the design philosophy. Any drift would have to silently pass one of these — which is exactly what we are preventing.

---

## Semantic Acceptance Criteria (target — P106 PLAN-LOCKED.md frontmatter will declare these literally)

Per SCHEMA-09 (DLB-07 enforcement), every v3.0 PLAN.md ships `semantic_acceptance_criteria` from day one. P106's SACs:

```yaml
semantic_acceptance_criteria:
  - id: SAC-P106-01
    input: "fixtures/good-execution-receipt.json"
    expected_outcome: "validates successfully and is classified as observation CMB"
    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-validate.cjs --fixture fixtures/good-execution-receipt.json && test $? -eq 0"

  - id: SAC-P106-02
    input: "fixtures/bad-execution-receipt-created-by-agent.json"
    expected_outcome: "validation rejects (non-zero exit) because execution_receipt may only be emitted by SGSD/system roles"
    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-validate.cjs --fixture fixtures/bad-execution-receipt-created-by-agent.json; test $? -ne 0"

  - id: SAC-P106-03
    input: "two CMB fixtures identical except for created_at"
    expected_outcome: "content_hash is identical — created_at is excluded from the canonical payload"
    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-hash.cjs --compare fixtures/hash-a.json fixtures/hash-a-created-at-changed.json | grep -q 'same'"

  - id: SAC-P106-04
    input: "two CMB fixtures differing only in body content"
    expected_outcome: "content_hash differs — body IS part of canonical payload"
    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-hash.cjs --compare fixtures/hash-a.json fixtures/hash-a-body-changed.json | grep -q 'different'"

  - id: SAC-P106-05
    input: "fixtures/bad-context-anchor-without-source.json"
    expected_outcome: "validation rejects because context_anchor must include canonical_source_path AND canonical_source_hash"
    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-validate.cjs --fixture fixtures/bad-context-anchor-without-source.json; test $? -ne 0"

  - id: SAC-P106-06
    input: "fixtures/bad-review-finding-without-lineage.json (claiming blocking status without evidence_verdict parent)"
    expected_outcome: "validation rejects — review_finding may not assert blocking authority without an evidence_verdict lineage parent"
    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-validate.cjs --fixture fixtures/bad-review-finding-without-lineage.json; test $? -ne 0"
```

These SACs are real-data semantic ACs per DLB-07 Rule 1. The fixture files live in the repo (not in `mock/` or `__mocks__/` — they ARE the real data for the validator's purpose, identical to how `super-gsd/tools/plan-schema/fixtures/` works for plan-schema-v2).

---

## What must NOT be implemented in this phase

Explicit non-goals for P106:

- ❌ No `super-gsd/tools/mesh-memory/cmb-validate.cjs` implementation (the validator is P107 work)
- ❌ No `super-gsd/tools/mesh-memory/cmb-hash.cjs` implementation (the hasher is P107 work)
- ❌ No execution_receipt emitter (P107)
- ❌ No review-finding writer (P107)
- ❌ No evidence_validator (P108)
- ❌ No lineage walker / echo detector (P108)
- ❌ No pseudo_operator (P109)
- ❌ No escalation gate (P109)
- ❌ No `.codex/hooks.json` (P111)
- ❌ No Context Authority YAML files (P112)
- ❌ No PLAN-LOCKED.md authored in this phase yet (waits for operator review of this CONTEXT)

P106 produces:
- ✅ The JSON Schema file (`super-gsd/schemas/cmb.schema.json`)
- ✅ The seven good fixtures + six bad fixtures
- ✅ The hash-comparison contract docs

P106's SACs (above) reference `cmb-validate.cjs` and `cmb-hash.cjs` because **those tools land in P107**, but P107's PLAN will reference the schema and fixtures P106 ships. The SAC verification commands run at P107 close, not at P106 close.

This is intentional: P106 is the **contract**; P107 is the **first implementation that consumes the contract**. SCHEMA-09 forces every plan to carry SACs, but the SAC verification can be satisfied by a downstream phase that consumes the schema. P106's local close check is just "schema parses + fixtures validate against the schema when loaded by ajv directly".

---

## The nuclear safety sign on this door

> **SGSD must never treat an agent claim CMB as an observation CMB.**

Conflating claim and observation is how model-generated memory becomes fake truth. The schema must enforce this. The fixtures must prove it. The downstream tools must respect it. If at any phase close in v3.0 a claim CMB is being trusted as observation, that is a drift event — record it in the DLB-08 drift watchlist, halt, and fix.

---

## Dispatch (not yet)

When this CONTEXT is reviewed and converted to PLAN-LOCKED.md, dispatch via:

```
Codex executor — codex.execute.bounded profile (eventually, once Codex Pro Mode lands in P110-P111)
For now (until P110+): direct codex-executor.sh with --patch-fallback-files allowlist
```

Implementation must touch ONLY:

- `super-gsd/schemas/cmb.schema.json` (new)
- `super-gsd/tools/mesh-memory/fixtures/good-*.json` × 7 (new)
- `super-gsd/tools/mesh-memory/fixtures/bad-*.json` × 6 (new)
- `super-gsd/tools/mesh-memory/fixtures/hash-a.json` + variants (new — for SAC-P106-03 + -04)

No other source files. Schema-only phase.

## Cross-references

- `.planning/milestones/v3.0/INTENT.md` — milestone WHY
- `.planning/milestones/v3.0/ROADMAP.md` — phase mapping (this is P106 of 7)
- `.planning/milestones/v3.0/REQUIREMENTS.md` — satisfies REQ-MML-01, REQ-MML-02, REQ-MML-03, REQ-POL-01, REQ-POL-07 (full coverage matrix in REQUIREMENTS.md)
- `.planning/decisions/DLB-08-MESH-MEMORY-LITE.md` — design lock; this phase's contract derives from it
- `.planning/decisions/DLB-07-semantic-vs-structural-verification.md` — predecessor; SCHEMA-09 / SCHEMA-10 enforcement that this phase's SACs satisfy
- `.planning/proposals/2026-05-20-sgsd-pro-mode-codex-context-authority-plan.md` — master SGSD-PRO proposal
- Pi2Pi meeting `81e85fd0-33c8-478d-924e-20e616440e81` (VTP) — operational source
- `wiki/research/mesh-memory-protocol.md` (VTP, arXiv 2604.19540) — formal protocol source
- `super-gsd/templates/plan-schema-v2.json` — P106 PLAN-LOCKED.md must validate against this (SCHEMA-09 + semantic_acceptance_criteria required)
