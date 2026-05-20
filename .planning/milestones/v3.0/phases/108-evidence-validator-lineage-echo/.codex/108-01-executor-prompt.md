# SDD Implementer Task — P108-01 executor (lineage + evidence-validator + echo-detector + self-test extension)

You are a fresh SDD implementer. No inherited context. Read only what this prompt names.

## What you are doing

Implementing the PLAN at `.planning/milestones/v3.0/phases/108-evidence-validator-lineage-echo/108-01-evidence-validator-lineage-echo-PLAN.md`. Three serial tasks creating 4 new files + extending 1 existing file + soft-editing 1 skill doc.

This phase ships DLB-08.4 + DLB-08.5: the evidence-admission gate, the lineage DAG walker, and the echo detector. Consumes P106 schema + P107 CLIs (cmb-validate.cjs + cmb-hash.cjs). The mesh memory ledger at `.planning/mesh/memory/cmbs.jsonl` already has 2 CMBs from P107 self-tests — your tools must work with that live state.

## Read these files

1. `.planning/milestones/v3.0/phases/108-evidence-validator-lineage-echo/108-01-evidence-validator-lineage-echo-PLAN.md` — your 3-task contract
2. `.planning/milestones/v3.0/phases/108-evidence-validator-lineage-echo/108-CONTEXT.md` — full design + 6 binding invariants
3. `super-gsd/schemas/cmb.schema.json` — what evidence_verdict CMBs must conform to
4. `super-gsd/tools/mesh-memory/cmb-validate.cjs` — exemplar Node CLI; new tools follow same shape (stderr for progress, JSONL metrics, --help, requireDependency with plan-schema FIRST in candidate order)
5. `super-gsd/tools/mesh-memory/cmb-hash.cjs` — lineage.cjs will use this hash function (or import it)
6. `super-gsd/tools/mesh-memory/run-self-test.cjs` — what you extend in t3
7. `super-gsd/tools/mesh-memory/fixtures/good-execution-receipt.json` — sample CMB shape
8. `super-gsd/tools/mesh-memory/fixtures/good-review-finding.json` — sample CMB shape; review_finding's body has `file_path`, `line_start`, `line_end`, `quoted_excerpt` which evidence-validator inspects

## Task t1 — `lineage.cjs` + `seed-ledger.jsonl`

### `super-gsd/tools/mesh-memory/lineage.cjs`

Pure-function DAG walker. CLI:
```
node lineage.cjs [--help] [--ancestors <cmb-key> [--max-depth N]] [--descendants <cmb-key>] [--provenance <cmb-key>] [--siblings <cmb-key>] [--self-test-ancestors] [--ledger PATH]
```

Default ledger path: `.planning/mesh/memory/cmbs.jsonl`. Override with `--ledger`.

Functions exported:
- `loadLedger(path)` → array of CMB objects from JSONL
- `findCmb(ledger, key)` → CMB with matching `key`, or null
- `ancestors(ledger, key, maxDepth=50)` → array of CMB keys, BFS through `lineage.parents`, deduplicated, depth-bounded
- `descendants(ledger, key)` → array of CMB keys that have `key` in their ancestors
- `provenance(ledger, key)` → ordered array of CMBs walking backward through parents (single linear chain when possible; falls back to topological order on DAG)
- `siblings(ledger, key)` → array of CMB keys sharing at least one parent with the given key

`--self-test-ancestors`: load seed-ledger.jsonl, walk ancestors from a known deep-leaf, assert ordering + depth bound. Exit 0 on pass.

### `super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl`

Multi-CMB fixture ledger with realistic lineage chains. Each line is a valid CMB (per cmb.schema.json). Provide at least:

- 1 root `execution_receipt` (no parents)
- 2 `review_finding` claims with `lineage.parents[0]` = the execution_receipt's key
- 1 `evidence_verdict` linked to first review_finding (testing the chain)
- 1 `decision_recommendation` linked to evidence_verdict
- 1 `promotion_decision` linked to decision_recommendation
- 1 "deep" CMB at depth 7+ for ancestor-walk testing
- 1 CMB whose lineage forms a cycle attempt (max_depth must cut it off)

Each fixture CMB must have valid `content_hash`-shaped keys (mock keys like `cmb-abc123...` are fine; they don't need to be real sha256 unless you choose).

## Task t2 — `evidence-validator.cjs` + `echo-detector.cjs`

### `super-gsd/tools/mesh-memory/evidence-validator.cjs`

CLI:
```
node evidence-validator.cjs [--help] [--finding-key <cmb-key>] [--ledger PATH] [--self-test-verified|--self-test-refuted|--self-test-fixture-guard]
```

Behavior:
- Loads the ledger
- Loads the named `review_finding` CMB
- Performs Tier 0 + Tier 1 admission:
  - **Tier 0 (deterministic):**
    - If `file_path` is missing → `UNVERIFIED_CRIT`
    - If `file_path` resolves under any `fixtures/`, `mock/`, `__mocks__/` dir (with whitelist for `super-gsd/tools/plan-schema/fixtures/` and `super-gsd/tools/mesh-memory/fixtures/`) → reject with reason `fixture_path_in_real_data_check`
    - If file doesn't exist → `STALE_CRIT`
    - If `line_start` / `line_end` given but exceed file's line count → `STALE_CRIT`
    - If `quoted_excerpt` given but doesn't match the actual file at those lines → `REFUTED_CRIT`
    - If `quoted_excerpt` given and DOES match → `VERIFIED_CRIT`
    - If only `file_path` (no line range) → `GUARDED_CRIT` (presence verified, content not asserted)
  - **Tier 1 (heuristic) — applies after Tier 0:**
    - If lineage parents include another `review_finding` with same `claim` substring → flag as potential echo, downgrade to `GUARDED_CRIT` if Tier 0 was VERIFIED
- Emits one `evidence_verdict` CMB:
  - `type: evidence_verdict`
  - `created_by: evidence_validator`
  - `role: evidence_validator`
  - `authority_level: claim_with_authority`
  - `lineage.parents: [<review_finding key>]`
  - `body.evidence_status: <one of the five outcomes>`
  - `body.tier_used: 0` or `1`
  - `body.decision_basis: "..." (short rationale)`
  - `body.refuting_evidence: [...]` (if applicable)
  - `body.tests_refuting: [...]` (placeholder; populated by future test integration)
- Appends to `.planning/mesh/memory/cmbs.jsonl`

`--self-test-verified`: synthesize a review_finding pointing at a real file:line under super-gsd/schemas/cmb.schema.json with matching excerpt; expect VERIFIED_CRIT. Validate the emitted CMB against schema. Exit 0 on pass.

`--self-test-refuted`: synthesize a review_finding claiming a non-matching excerpt; expect REFUTED_CRIT. Exit 0 on pass.

`--self-test-fixture-guard`: synthesize a review_finding with file_path under a non-whitelisted `__mocks__/` path; expect rejection with reason `fixture_path_in_real_data_check`. Exit 0 on pass.

### `super-gsd/tools/mesh-memory/echo-detector.cjs`

CLI:
```
node echo-detector.cjs [--help] [--incoming <cmb-key>] [--receiver-role <role>] [--ledger PATH] [--self-test-echo-hit|--self-test-echo-miss]
```

Behavior:
- Loads ledger
- Computes `Kself` = set of CMB keys where `created_by === <receiver-role>` (or `role === <receiver-role>`)
- Computes `ancestors(incoming)` via lineage.cjs's exported function (call `require('./lineage.cjs').ancestors(...)`)
- Returns `echoDetected = ancestors(incoming) ∩ Kself ≠ ∅`
- If echo detected, augments the incoming CMB's `lineage.echo_detected = true` (writes back to ledger as new CMB row with status: `superseded`)
- If not, persists normally

`--self-test-echo-hit`: synthesize incoming CMB whose ancestors intersect with receiver's Kself; expect echoDetected=true. Exit 0 on pass.

`--self-test-echo-miss`: synthesize incoming CMB whose ancestors do NOT intersect Kself; expect echoDetected=false. Exit 0 on pass.

## Task t3 — `run-self-test.cjs` extension + sgsd-audit SKILL.md soft wire-in

### `super-gsd/tools/mesh-memory/run-self-test.cjs`

Extend the existing 20 assertions with ≥10 new ones. New floor: ≥30 assertions total.

New assertion ideas (pick 10+):
1. lineage.cjs --self-test-ancestors exits 0
2. lineage.cjs ancestors() from a deep-leaf returns correct ordering
3. lineage.cjs ancestors() honours max-depth 50 cap
4. lineage.cjs descendants() works
5. evidence-validator --self-test-verified exits 0
6. evidence-validator emits CMB with type=evidence_verdict + role=evidence_validator
7. evidence-validator --self-test-refuted exits 0
8. evidence-validator --self-test-fixture-guard exits 0 (rejects mock/__mocks__/ paths)
9. echo-detector --self-test-echo-hit exits 0
10. echo-detector --self-test-echo-miss exits 0
11. seed-ledger.jsonl is loadable + every row is schema-valid (loop with cmb-validate)
12. After self-test runs, `.planning/mesh/memory/cmbs.jsonl` has at least 5 CMB rows
13. The 7th CMB written has lineage.parents linking back to earlier CMBs

Print `[run-self-test] N/N passed` to stderr on success, with N >= 30. Exit 1 on any fail with diagnostic.

### `super-gsd/skills/sgsd-audit/SKILL.md` (soft wire-in only)

This is a documentation-only edit. Add a paragraph in the Layer 4 section noting that, as of v3.0 P108, evidence_verdict CMBs become the canonical output of Layer 4 admission — but only when v3.0 DLB-08 infrastructure is present in the consuming project. Backward-compatible; old SAC verification commands still work without CMBs.

Find the existing `<layer_4>` block. Add a short subsection like:

```markdown
### Layer 4 — Optional: emit evidence_verdict CMBs (v3.0+)

When SGSD v3.0 DLB-08 Mesh Memory Lite is present (super-gsd/tools/mesh-memory/), each SAC verification MAY also emit one `evidence_verdict` CMB to the project's mesh memory ledger via `super-gsd/tools/mesh-memory/evidence-validator.cjs`. This is opt-in; the existing prose-report path remains for projects without the mesh layer.

When emitted, the evidence_verdict CMB's `lineage.parents[0]` SHOULD reference the corresponding `review_finding` CMB (or, when no claim CMB exists, the upstream `execution_receipt`'s key).
```

That's the entire SKILL.md edit. Do NOT restructure the rest of the file.

## Verification you must run

Per task verification_cmds in the PLAN:
```bash
node super-gsd/tools/mesh-memory/lineage.cjs --help
node super-gsd/tools/mesh-memory/evidence-validator.cjs --help
node super-gsd/tools/mesh-memory/echo-detector.cjs --help
node super-gsd/tools/mesh-memory/run-self-test.cjs
```

The last one is load-bearing: it must report `N/N passed` with N ≥ 30, exit 0.

## Out of scope

- pseudo_operator (P109)
- escalation gate (P109)
- Codex Pro Mode (P110-111)
- Context Authority (P112)
- LLM judgments / Tier 2 (P109 territory)
- Modifying P106 schema or fixtures (frozen)
- Modifying P107 CLIs (cmb-validate.cjs, cmb-hash.cjs, package.json, execution-receipt.cjs, review-finding-writer.cjs) — frozen
- npm install (operator handles if needed)

## requireDependency must use plan-schema-first candidate order

All new .cjs files that need ajv/ajv-formats/ajv-errors MUST use this candidate order:
```js
const candidates = [
  path.resolve(__dirname, '..', 'plan-schema', 'node_modules', name),
  path.resolve(__dirname, 'node_modules', name),
  name,
];
```

Bare name LAST. This fixes the multi-instance bug from P107.

## Report format

```
PATCH_BEGIN
<unified diff>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/tools/mesh-memory/lineage.cjs (created)
  super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl (created)
  super-gsd/tools/mesh-memory/evidence-validator.cjs (created)
  super-gsd/tools/mesh-memory/echo-detector.cjs (created)
  super-gsd/tools/mesh-memory/run-self-test.cjs (modified — extended)
  super-gsd/skills/sgsd-audit/SKILL.md (modified — soft wire-in paragraph)
VERIFICATION:
  - All new tools have --help
  - run-self-test.cjs reports >= 30/30 passed (operator runs post-patch)
DEVIATIONS: <none or list>
BLOCKERS: <none or describe>
ONE_LINER: P108 DLB-08.4+.5 tools shipped — evidence_validator + lineage + echo detector; >=30 self-test assertions; sgsd-audit Layer 4 soft wired-in.
REPORT_END
```

Be terse. No prose beyond the report.
