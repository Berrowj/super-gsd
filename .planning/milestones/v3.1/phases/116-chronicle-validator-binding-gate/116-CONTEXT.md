---
phase: 116
phase_name: Chronicle Validator + Binding Gate
milestone: v3.1
created: 2026-05-21
status: queued-planning-only
implementation_status: not-started
source: DLB-11.4 — Operator Chronicle Layer; fourth phase
predecessor: v3.1 P115 PASS @ 674fe1a (HTML renderer + 6 PUML templates shipped)
---

# Phase 116 — Chronicle Validator + Binding Gate

> The phase-close gatekeeper. Re-derives chronicle verdicts from raw evidence (CMBs, planning artefacts, git, rendered HTML) and rejects ungrounded chronicles with REPORT_UNGROUNDED. Binding gate at phase close: REPORT_UNGROUNDED halts close. Includes a labelled benchmark (≥4 good × ≥4 bad) with throughput floor + ≥95% precision target (P119 ships held-out set).

## Goal

Ship `validate-chronicle.cjs` + benchmark fixtures + binding-gate wiring + ≥15-assertion self-test extension. This is the **load-bearing** v3.1 phase: without the validator, chronicles can drift into agent opinion and the whole layer regresses to a fog machine.

## Binding invariants (from DLB-11 R4)

1. **Validator REDERIVES verdicts from raw evidence.** Validator must NOT trust the chronicle's own self-report. It re-reads the source CMBs / planning artefacts / git diffs / rendered HTML and independently confirms each claim's citation is sound.
2. **REPORT_UNGROUNDED is a HARD halt.** Phase close blocks when validator reports REPORT_UNGROUNDED. Operator may either fix the chronicle (re-render) or explicitly `skip_gates: ["chronicle-validation"]` with `skip_reason:` REQUIRED.
3. **Benchmark fixtures lock the validator.** ≥4 good chronicles + ≥4 bad chronicles in `super-gsd/tools/chronicle/benchmarks/`. Validator must PASS all good + FAIL all bad with the expected error code. <2s throughput per chronicle (offline; no network).
4. **Self-contained validation.** No external dependencies beyond ajv + ajv-errors already used. Validator runs offline.
5. **Broken citations REJECTED.** Citations referencing non-existent CMBs in the mesh ledger → REPORT_BROKEN_CITATION (new error code per DLB-11 R5).
6. **Missing evidence COUNTED.** MISSING_EVIDENCE placeholders in HTML are inventoried; if any exist without a corresponding `denominators_empty_reason` justification → REPORT_UNGROUNDED.

## Files this phase will create

| Path | Op |
|---|---|
| `super-gsd/tools/chronicle/validate-chronicle.cjs` | create — main validator (~300-500 LOC) |
| `super-gsd/tools/chronicle/benchmarks/good-typical-phase.json` | create — chronicle from a normal v3.1 phase pattern |
| `super-gsd/tools/chronicle/benchmarks/good-empty-phase.json` | create — chronicle with empty sections + denominators_empty_reason |
| `super-gsd/tools/chronicle/benchmarks/good-puml-fallback.json` | create — chronicle rendered via fallback generator (skip_gates) |
| `super-gsd/tools/chronicle/benchmarks/good-milestone-rollup.json` | create — chronicle for a milestone (P119 retrofit-friendly) |
| `super-gsd/tools/chronicle/benchmarks/bad-ungrounded-claim.json` | create — claim node missing all citations → CHRONICLE-01 + REPORT_UNGROUNDED |
| `super-gsd/tools/chronicle/benchmarks/bad-broken-citation.json` | create — citation references CMB ID absent from ledger → REPORT_BROKEN_CITATION |
| `super-gsd/tools/chronicle/benchmarks/bad-missing-evidence-no-reason.json` | create — MISSING_EVIDENCE present but denominators_empty_reason absent → REPORT_UNGROUNDED |
| `super-gsd/tools/chronicle/benchmarks/bad-external-cdn-leaked.json` | create — rendered HTML contains http(s):// → CHRONICLE-04 + REPORT_CONTAMINATED |
| `super-gsd/scripts/chronicle-validate.sh` | create — bash CLI wrapper for binding-gate integration (mirrors codex-exec.sh shape) |
| `super-gsd/tools/chronicle/run-self-test.cjs` | modify — extend with SAC-P116-01..NN assertions |

11 file ops (10 new + 1 modify).

## validate-chronicle.cjs contract

### Invocation
```
node super-gsd/tools/chronicle/validate-chronicle.cjs \
  --chronicle <path-to-phase-chronicle.html> \
  --context <path-to-CHRONICLE-CONTEXT.json> \
  [--mesh-ledger <path>] \
  [--planning-root <path>] \
  [--strict|--lenient]
```

### Pipeline (re-derivation)
1. Load chronicle HTML + parse for: claims, citations[], MISSING_EVIDENCE spans, external URLs, section roles, embedded SVGs, collapsible PUML blocks
2. Load CHRONICLE-CONTEXT.json (must validate against chronicle.schema.json — re-use cmb-validate-helper.cjs)
3. Load mesh ledger CMBs — build ID index
4. For each citation in HTML:
   - If CMB-shaped (`cmb-...`) → check ID exists in ledger; if absent → REPORT_BROKEN_CITATION
   - If file path → check file exists (relative to repo root)
   - If commit SHA → check `git rev-parse <sha>` succeeds (best-effort; offline-tolerant)
5. For each claim node: confirm citations[] is non-empty AND at least one citation resolves
6. For each section: confirm `signifier_role` matches HTML role attribute
7. For each MISSING_EVIDENCE span: confirm a matching entry exists in `denominators.assumptions_made` OR `denominators_empty_reason` OR section-specific `<reason>` — if no justification → REPORT_UNGROUNDED
8. Scan HTML for external URLs (http://, https://, //) in src/href attributes → REPORT_CONTAMINATED if found
9. Emit final verdict: REPORT_GROUNDED | REPORT_UNGROUNDED | REPORT_BROKEN_CITATION | REPORT_CONTAMINATED

### Exit codes
- 0 — REPORT_GROUNDED
- 1 — REPORT_UNGROUNDED
- 2 — REPORT_BROKEN_CITATION
- 3 — REPORT_CONTAMINATED
- 4 — usage error
- 5 — chronicle file not found
- 6 — context file not found

### Strict vs lenient mode
- `--strict` (default): any single REPORT_UNGROUNDED/BROKEN/CONTAMINATED fails the phase
- `--lenient`: collects all findings + emits summary report; exits 0 unless fatal (for advisory runs / dashboards)

### Throughput floor
- A baseline chronicle (~10 sections, ~20 citations, ~6 inline SVGs) must validate in <2s

## Benchmark fixtures

### Good (≥4)
1. **good-typical-phase.json** — Normal v3.1 phase. ~10 sections, ~20 citations, all CMBs in ledger, all section roles correct. Expected: REPORT_GROUNDED.
2. **good-empty-phase.json** — Phase with no observations (empty execution_receipt set). Sections empty, denominators_empty_reason present. Expected: REPORT_GROUNDED (empty is valid with reason).
3. **good-puml-fallback.json** — Phase rendered via fallback (no plantuml.jar). Banner present. Expected: REPORT_GROUNDED (fallback path is allowed).
4. **good-milestone-rollup.json** — Milestone-level chronicle (kind=milestone-chronicle). Larger; multiple phases rolled up. Expected: REPORT_GROUNDED.

### Bad (≥4)
1. **bad-ungrounded-claim.json** — Claim node has citations: []. Expected: REPORT_UNGROUNDED (CHRONICLE-01).
2. **bad-broken-citation.json** — Citation references `cmb-nonexistent-12345` not in ledger. Expected: REPORT_BROKEN_CITATION.
3. **bad-missing-evidence-no-reason.json** — `<span class="missing-evidence" data-slot="risks">MISSING_EVIDENCE</span>` present + denominators.assumptions_made has no matching entry. Expected: REPORT_UNGROUNDED.
4. **bad-external-cdn-leaked.json** — HTML body contains `<img src="https://cdn.example/x.png">` somewhere. Expected: REPORT_CONTAMINATED (CHRONICLE-04 echo).

## chronicle-validate.sh CLI wrapper

Bash wrapper that:
1. Probes chronicle + context paths
2. Invokes validate-chronicle.cjs
3. Maps exit code to human-readable verdict
4. Writes one line to `.planning/metrics/chronicle-validation-log.jsonl` per run (ts, phase, milestone, verdict, exit_code)
5. Returns the validator's exit code

Used by future binding-gate integration (sgsd-complete-phase skill or operator's manual phase-close ritual).

## Semantic acceptance criteria (target — 116-01 PLAN declares verbatim)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P116-01
    input: "benchmarks/good-typical-phase.json"
    expected_outcome: "validator emits REPORT_GROUNDED (exit 0)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P116-01"

  - id: SAC-P116-02
    input: "benchmarks/good-empty-phase.json"
    expected_outcome: "validator emits REPORT_GROUNDED (empty sections with denominators_empty_reason allowed)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P116-02"

  - id: SAC-P116-03
    input: "benchmarks/good-puml-fallback.json"
    expected_outcome: "validator emits REPORT_GROUNDED (fallback-rendered chronicle is valid)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P116-03"

  - id: SAC-P116-04
    input: "benchmarks/good-milestone-rollup.json"
    expected_outcome: "validator emits REPORT_GROUNDED for milestone-kind chronicle"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P116-04"

  - id: SAC-P116-05
    input: "benchmarks/bad-ungrounded-claim.json"
    expected_outcome: "validator emits REPORT_UNGROUNDED (exit 1) with CHRONICLE-01 in stderr"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P116-05"

  - id: SAC-P116-06
    input: "benchmarks/bad-broken-citation.json"
    expected_outcome: "validator emits REPORT_BROKEN_CITATION (exit 2)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P116-06"

  - id: SAC-P116-07
    input: "benchmarks/bad-missing-evidence-no-reason.json"
    expected_outcome: "validator emits REPORT_UNGROUNDED (MISSING_EVIDENCE without denominators justification)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P116-07"

  - id: SAC-P116-08
    input: "benchmarks/bad-external-cdn-leaked.json"
    expected_outcome: "validator emits REPORT_CONTAMINATED (exit 3) when external URL present in HTML"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P116-08"

  - id: SAC-P116-09
    input: "good-typical-phase chronicle, baseline size"
    expected_outcome: "validator completes in <2000ms wall-clock"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P116-09"

  - id: SAC-P116-10
    input: "chronicle-validate.sh CLI wrapper with --strict --chronicle <good> --context <good>"
    expected_outcome: "wrapper exits 0; appends one row to .planning/metrics/chronicle-validation-log.jsonl"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P116-10"

  - id: SAC-P116-11
    input: "chronicle-validate.sh CLI wrapper with --strict --chronicle <bad-ungrounded>"
    expected_outcome: "wrapper exits 1 (REPORT_UNGROUNDED) and log row records verdict"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P116-11"

  - id: SAC-P116-12
    input: "full benchmark run (4 good + 4 bad)"
    expected_outcome: "8/8 fixtures classified correctly (precision = 1.0 on benchmark; held-out at P119)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P116-12"

  - id: SAC-P116-13
    input: "full self-test"
    expected_outcome: "all assertions green (12 P116 SAC + existing 40 P114+P115 + new STRUCT)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"
```

13 SACs declared. Self-test adds STRUCT for: benchmark fixture parse-check, validator exit-code coverage, CLI wrapper log-row schema, throughput timing precision.

## Out of scope

- Storage adapter / VTP routing (P117)
- Cockpit integration (P118)
- Milestone chronicle / roadmap miner (P119)
- Held-out benchmark set (P119 authors per DLB-11 R4)
- Modifying P113-P115 substrate

## Cross-references

- `.planning/decisions/DLB-11-CHRONICLE-LAYER.md` — R4 binding gate + benchmark contract
- `.planning/milestones/v3.1/ROADMAP.md` — Non-Negotiable Rule 3 (REPORT_UNGROUNDED hard halt)
- `.planning/milestones/v3.1/phases/115-html-renderer-puml/115-VERIFICATION.md` — predecessor; renderer P116 validates against
- `super-gsd/tools/chronicle/render-html.cjs` (P115) — produces the HTML this phase validates
- `super-gsd/tools/chronicle/build-context-pack.cjs` (P114) — produces the CONTEXT.json this phase cross-references
- `super-gsd/tools/chronicle/cmb-validate-helper.cjs` (P114) — pattern reference for validator structure
- `super-gsd/scripts/codex-exec.sh` — bash wrapper shape reference for chronicle-validate.sh
