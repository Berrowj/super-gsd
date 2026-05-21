---
phase: 114
phase_name: Context-Pack Builder + Validate Helper
milestone: v3.1
created: 2026-05-21
status: queued-planning-only
implementation_status: not-started
source: DLB-11.2 — Operator Chronicle Layer; second phase
predecessor: v3.1 P113 PASS @ 4ebb819 (chronicle schema + manifest + 14 fixtures shipped)
---

# Phase 114 — Context-Pack Builder + Validate Helper

> Builds the deterministic Node.js tool that reads SGSD truth (mesh CMBs + planning artefacts + git evidence + cockpit logs) and produces a `CHRONICLE-CONTEXT.json` conforming to the P113 schemas. Also ships the `cmb-validate-helper.cjs` CLI that P113's CONTEXT-level SACs originally referenced (now used phase-wide).

## Goal

Ship the **context-pack builder** plus the **validate helper CLI**, with a ≥15-assertion self-test that exercises both. Mirrors v3.0 P107's shape (CLI tool + writer + run-self-test) but read-only on the substrate side and write-only on the chronicle-context side.

## Binding invariants (from DLB-11)

1. **R3 — Chronicle Writer is deterministic, never a Codex dispatch.** This phase ships the writer's first half (the context pack). Pure Node.js logic. No agent prose synthesis. Section templates land at P115.
2. **R2 — Denominator panel mandatory.** Builder MUST populate `denominators` from observable signals: CONTEXT non_goals (scope_excluded), escalation_gate logs (carve_outs_not_fired), PLAN-CHECK rejections (alternatives_rejected), RESEARCH/PLAN assumptions (assumptions_made), `skip_gates:` events (gates_skipped). Empty arrays trigger `denominators_empty_reason` derivation (e.g., "no PLAN-CHECK rejections logged for this phase").
3. **R5 — By-reference citations.** Builder writes CMB IDs (`cmb-...`), file paths, test names, commit SHAs — NEVER full CMB bodies. Short evidence excerpts (≤120 chars) for inline display only.
4. **R6 — Norman signifiers.** Each section node emitted with `signifier_role` (`observations|claims|evidence_verdicts|decisions|denominators|synthesis|autonomy_disclosure`).
5. **No agent self-summary.** Builder reads observations from `execution_receipt` CMBs (SGSD-emitted) and claims from `review_finding` CMBs (reviewer-emitted) — never from the executor's own narrative summary.
6. **Missing evidence is explicit.** If a section has no source CMBs/files, emit `MISSING_EVIDENCE` placeholder for downstream validator (P116) — do NOT silently skip the section.

## Files this phase will create

| Path | Op |
|---|---|
| `super-gsd/tools/chronicle/build-context-pack.cjs` | create — main builder (~250-400 LOC) |
| `super-gsd/tools/chronicle/cmb-validate-helper.cjs` | create — CLI that loads named schema + fixture and validates (~80-120 LOC) |
| `super-gsd/tools/chronicle/run-self-test.cjs` | create — ≥15 assertions covering both tools end-to-end (~200-300 LOC) |
| `super-gsd/tools/chronicle/fixtures/sample-phase-input.json` | create — golden input: synthetic mesh CMBs + planning excerpts for self-test |
| `super-gsd/tools/chronicle/fixtures/sample-chronicle-context.json` | create — golden output that the builder must produce from sample input |

5 files. The builder + helper are read-only on the substrate (mesh ledger, planning, git); write-only on `CHRONICLE-CONTEXT.json` (passed via stdout or `--out` flag).

## Builder behavioural contract (`build-context-pack.cjs`)

### Invocation shape

```
node super-gsd/tools/chronicle/build-context-pack.cjs \
  --milestone v3.1 \
  --phase 113 \
  --out .planning/chronicles/v3.1/P113/CHRONICLE-CONTEXT.json
```

Flags:
- `--milestone <id>` (required)
- `--phase <NN>` (required) OR `--milestone-level` (mutually exclusive)
- `--out <path>` (required) — where to write CHRONICLE-CONTEXT.json
- `--mesh-ledger <path>` (default: `.planning/mesh/memory/cmbs.jsonl`)
- `--planning-root <path>` (default: `.planning/`)
- `--git-since <ref>` (optional; default: phase-start commit derived from STATE.md or CONTEXT mtime)
- `--cockpit-state <path>` (optional; if absent, skip cockpit signals with explicit reason in denominators)

### Inputs read (read-only)

1. **Mesh ledger** — filter CMBs by `milestone_id` + `phase_id`; partition by class:
   - `execution_receipt` → observations[]
   - `review_finding` → claims[]
   - `evidence_verdict` → evidence_verdicts[]
   - `decision_recommendation` + `promotion_decision` → decisions[]
   - `operator_precedent` → decisions[] (with `authority: operator`)
   - `context_anchor` → assets[] reference list
2. **Phase folder** — `CONTEXT.md` frontmatter (non_goals, status, predecessor), `PLAN.md` (skip_gates, tasks), `VERIFICATION.md` (verdict, sacs_passed/failed)
3. **Git evidence** — files changed since phase-start commit; commit count; last commit SHA
4. **Cockpit state** — if `--cockpit-state` provided; otherwise log "cockpit_signals_absent" in `denominators.gates_skipped`

### Output (`CHRONICLE-CONTEXT.json`)

Conforms to `chronicle.schema.json`. Top-level shape:

```json
{
  "schema_version": "1.0",
  "kind": "phase-chronicle-context",
  "milestone_id": "v3.1",
  "phase_id": "113",
  "generated_at": "2026-05-21T...",
  "sections": [
    {"signifier_role": "observations", "items": [...]},
    {"signifier_role": "claims", "items": [...]},
    {"signifier_role": "evidence_verdicts", "items": [...]},
    {"signifier_role": "decisions", "items": [...]},
    {"signifier_role": "synthesis", "items": [{"slot": "eli5", "MISSING_EVIDENCE": true}, ...]},
    {"signifier_role": "autonomy_disclosure", "items": [...]}
  ],
  "denominators": {
    "scope_excluded": [...],
    "carve_outs_not_fired": [...],
    "alternatives_rejected": [...],
    "assumptions_made": [...],
    "gates_skipped": [...]
  },
  "diagrams": [],
  "assets": []
}
```

Synthesis section items carry `slot` placeholders (eli5, remember_tomorrow, risks, persona_impact) populated as `MISSING_EVIDENCE: true` at P114 — P115 fills them via section templates.

Diagrams[] is empty at P114; P115 populates puml_source + rendered_svg.

### Determinism

- Same inputs → byte-identical output (sort CMBs by `created_at` then `id`; deterministic JSON key order)
- No timestamps in body content (only the top-level `generated_at`)
- No network calls; no `Math.random()`

### Error handling

- Missing mesh ledger → exit 4 with message "MESH-LEDGER-MISSING" (path)
- Missing phase folder → exit 5 with message "PHASE-FOLDER-MISSING" (path)
- Malformed CMB row → log to stderr + skip + record in `denominators.assumptions_made`
- No CMBs found for phase → emit empty observations/claims with `MISSING_EVIDENCE` placeholders + `denominators_empty_reason: "no mesh CMBs found for phase"` (still produces valid output)

## Validate helper contract (`cmb-validate-helper.cjs`)

### Invocation

```
node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema <name> --fixture <path>
```

Schemas: `chronicle`, `manifest`, `cmb`, `chronicle-context`. Loads from `super-gsd/schemas/`.

### Exit codes

- 0 — fixture validates against schema
- 1 — fixture parses but fails validation (errors written to stderr with `CHRONICLE-XX` codes preserved)
- 2 — fixture not found
- 3 — fixture JSON parse failed
- 4 — schema not found
- 5 — schema JSON parse failed

### Output

- stderr: ajv-errors messages (one per validation error)
- stdout: silent on success; on failure, one summary line `VALIDATION FAILED: <N> errors`

This helper is the canonical CLI the P113 SAC verification_cmds reference (operator can run them after P114 ships).

## Semantic acceptance criteria (target — 114-01 PLAN declares verbatim)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P114-01
    input: "self-test fixture mesh + planning excerpt for synthetic phase X"
    expected_outcome: "builder produces CHRONICLE-CONTEXT.json that validates against chronicle.schema.json"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --assertion build_validates"

  - id: SAC-P114-02
    input: "two identical input sets called twice"
    expected_outcome: "builder output is byte-identical (deterministic)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --assertion deterministic"

  - id: SAC-P114-03
    input: "mesh ledger containing 3 execution_receipt CMBs for phase X"
    expected_outcome: "observations[] section has 3 items, each citing CMB id by reference (string)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --assertion observations_by_reference"

  - id: SAC-P114-04
    input: "mesh ledger containing review_finding + evidence_verdict CMBs"
    expected_outcome: "claims[] populated from review_findings; evidence_verdicts[] populated separately"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --assertion claim_verdict_separation"

  - id: SAC-P114-05
    input: "CONTEXT.md frontmatter with non_goals = ['a', 'b', 'c']"
    expected_outcome: "denominators.scope_excluded has exactly 3 entries from non_goals"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --assertion scope_excluded_populated"

  - id: SAC-P114-06
    input: "PLAN.md with skip_gates: ['puml-render']"
    expected_outcome: "denominators.gates_skipped contains 'puml-render' with skip_reason"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --assertion gates_skipped_populated"

  - id: SAC-P114-07
    input: "phase with zero mesh CMBs"
    expected_outcome: "builder produces VALID output with MISSING_EVIDENCE placeholders + denominators_empty_reason"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --assertion empty_mesh_handled"

  - id: SAC-P114-08
    input: "mesh ledger containing CMB with full body in citations[]"
    expected_outcome: "builder REJECTS by-value citations; record dropped + logged"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --assertion by_value_citation_rejected"

  - id: SAC-P114-09
    input: "valid chronicle fixture from P113"
    expected_outcome: "cmb-validate-helper.cjs --schema chronicle returns exit 0"
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema chronicle --fixture super-gsd/schemas/fixtures/chronicle/good-phase-chronicle.json; test $? -eq 0"

  - id: SAC-P114-10
    input: "bad-claim-without-citation.json from P113"
    expected_outcome: "cmb-validate-helper.cjs --schema chronicle returns exit 1 with CHRONICLE-01 on stderr"
    verification_cmd: "node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema chronicle --fixture super-gsd/schemas/fixtures/chronicle/bad-claim-without-citation.json 2>&1 | grep -q 'CHRONICLE-01'"

  - id: SAC-P114-11
    input: "self-test full run"
    expected_outcome: "all ≥15 assertions green"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"

  - id: SAC-P114-12
    input: "builder run on the P113 phase (real data, dogfood)"
    expected_outcome: "produces CHRONICLE-CONTEXT.json for P113 that validates against chronicle.schema.json"
    verification_cmd: "node super-gsd/tools/chronicle/build-context-pack.cjs --milestone v3.1 --phase 113 --out .tmp-sgsd/p113-chronicle-context.json && node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema chronicle --fixture .tmp-sgsd/p113-chronicle-context.json"
```

12 SACs declared at CONTEXT-level. PLAN translates them verbatim + the run-self-test.cjs ≥15-assertion floor enforces additional structural checks (CMB partitioning, by-reference citation strings, signifier_role enums, etc).

## Dogfood note

SAC-P114-12 is the dogfood gate: by P114 close, we must be able to build a chronicle context for P113 (which already shipped). This proves the builder works on real data, not just synthetic fixtures. The chronicle for P113 won't be rendered to HTML until P115 — the context-pack alone is the P114 deliverable.

## Out of scope

- HTML renderer (P115)
- PUML diagram authoring (P115)
- Validator binding gate (P116)
- Storage adapter / VTP routing (P117)
- Cockpit integration (P118)
- Milestone-level chronicle + roadmap miner (P119)
- Modifying v3.0 frozen tools or DLB-11 design lock

## Cross-references

- `.planning/decisions/DLB-11-CHRONICLE-LAYER.md` — design lock (R2/R3/R5/R6 invariants this phase encodes)
- `.planning/milestones/v3.1/INTENT.md` — milestone WHY
- `.planning/milestones/v3.1/ROADMAP.md` — phase mapping (P114 = DLB-11.2)
- `.planning/milestones/v3.1/phases/113-chronicle-schema-manifest/113-VERIFICATION.md` — predecessor; schemas P114 consumes
- `super-gsd/schemas/chronicle.schema.json` + `super-gsd/schemas/chronicle-manifest.schema.json` — P113 deliverables
- `super-gsd/schemas/cmb.schema.json` — CMB shape builder reads
- `super-gsd/tools/mesh-memory/run-self-test.cjs` — pattern reference for ≥15-assertion test runner
- `super-gsd/tools/mesh-memory/lineage.cjs` — pattern reference for CMB partitioning
