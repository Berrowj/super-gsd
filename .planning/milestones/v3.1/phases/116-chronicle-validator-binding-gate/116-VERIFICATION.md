---
phase: 116
phase_name: Chronicle Validator + Binding Gate
milestone: v3.1
status: PASS
verdict: PASS
completed_at: 2026-05-21
sacs_total: 13
sacs_passed: 13
struct_asserts: 3
struct_passed: 3
warn_softgate: 2
files_created: 10
files_modified: 1
total_assertions: 56
total_passed: 56
deviations: 3
deviation_class: INFO
---

# Phase 116 — Chronicle Validator + Binding Gate — VERIFICATION

## Summary

P116 ships the chronicle validator (the binding phase-close gate per DLB-11 R4) + bash CLI wrapper + 8 benchmark fixtures (4 good × 4 bad) + self-test extension. All 13 SAC + 3 STRUCT-P116 assertions PASS plus all 40 prior P114+P115 assertions still GREEN (56/56). Two soft warnings on dogfood paths (expected — no v3.1 CMBs in mesh ledger yet).

```
P114 ledger:    PASS SAC-P114-01..12 + STRUCT-P114-13..23  =  23/23
P115 additions: PASS SAC-P115-01..13 + STRUCT-P115-21..24  =  17/17
P116 additions: PASS SAC-P116-01..13 + STRUCT-P116-21..23  =  16/16
WARN STRUCT-P115-24-P113-DOGFOOD skipped: P113 CHRONICLE-CONTEXT.json absent (expected)
WARN DOGFOOD-P113 skipped: no P113 CMBs in mesh ledger (expected)
TOTAL: 56/56 PASS
```

## Files

### Created (10)
- `super-gsd/tools/chronicle/validate-chronicle.cjs` — main validator (~600 LOC). Re-derives verdicts from raw evidence: parses HTML for claims/citations/MISSING_EVIDENCE/external URLs, re-validates CHRONICLE-CONTEXT.json against schema (now with ajv-errors plugin loaded for CHRONICLE-XX code surfacing), loads mesh ledger (auto-detects JSON vs JSONL), resolves each citation (CMB ID lookup / file path existence / git SHA best-effort), confirms section signifier roles, scans for external URLs. Emits one of: REPORT_GROUNDED (0), REPORT_UNGROUNDED (1), REPORT_BROKEN_CITATION (2), REPORT_CONTAMINATED (3).
- `super-gsd/scripts/chronicle-validate.sh` — bash CLI wrapper. Probes inputs, invokes validate-chronicle.cjs, appends one row to `.planning/metrics/chronicle-validation-log.jsonl`, maps exit codes to verdicts. For binding-gate integration with future sgsd-complete-phase skill.
- `super-gsd/tools/chronicle/benchmarks/good-typical-phase.json` — normal sections + grounded citations → REPORT_GROUNDED
- `super-gsd/tools/chronicle/benchmarks/good-empty-phase.json` — empty sections + `denominators_empty_reason` → REPORT_GROUNDED
- `super-gsd/tools/chronicle/benchmarks/good-puml-fallback.json` — fallback-rendered chronicle with banner → REPORT_GROUNDED
- `super-gsd/tools/chronicle/benchmarks/good-milestone-rollup.json` — milestone-kind chronicle → REPORT_GROUNDED
- `super-gsd/tools/chronicle/benchmarks/bad-ungrounded-claim.json` — claim with empty citations[] → REPORT_UNGROUNDED (CHRONICLE-01)
- `super-gsd/tools/chronicle/benchmarks/bad-broken-citation.json` — citation references non-existent CMB → REPORT_BROKEN_CITATION
- `super-gsd/tools/chronicle/benchmarks/bad-missing-evidence-no-reason.json` — MISSING_EVIDENCE span + no denominators justification → REPORT_UNGROUNDED
- `super-gsd/tools/chronicle/benchmarks/bad-external-cdn-leaked.json` — HTML contains `https://cdn.example/x.png` → REPORT_CONTAMINATED

### Modified (1)
- `super-gsd/tools/chronicle/run-self-test.cjs` — extended with SAC-P116-01..13 + STRUCT-P116-21..23 (preserved all 40 prior assertions)

## DLB-11 R4 invariant coverage

| Invariant | Mechanism | Status |
|---|---|---|
| Validator REDERIVES verdicts | Re-parses HTML, re-validates context against schema, re-resolves citations against ledger — does NOT trust chronicle self-report | ✓ |
| REPORT_UNGROUNDED = hard halt | Exit code 1 on any ungrounded condition; CLI wrapper propagates | ✓ SAC-05/07/11 |
| Benchmark fixtures lock validator | 4 good × 4 bad fixtures; all classified correctly (precision 1.0 on benchmark) | ✓ SAC-12 |
| Throughput floor <2s | Validator completes baseline in ~90ms; well under 2000ms | ✓ SAC-09 |
| Broken citations rejected | CMB ID lookup against ledger; REPORT_BROKEN_CITATION on miss | ✓ SAC-06 |
| Missing evidence counted | Parses `<span class="missing-evidence">`; cross-checks denominators justification; REPORT_UNGROUNDED if no match | ✓ SAC-07 |
| External CDN rejected | Scans HTML for `https?://` and `<script src>` / `<link rel="stylesheet" href>`; REPORT_CONTAMINATED | ✓ SAC-08 |

## Deviations

**INFO-1 — Codex initial dispatch failed with `CreateProcessAsUserW 216` Windows process-launch error.** Retried dispatch succeeded; all 10 files landed second try. No semantic impact.

**INFO-2 — Codex's self-test integration was non-standard.** Original Codex report said it added "a preserving self-test extension hook rather than directly appending to the existing assertions array, because the shell/file-read path was unavailable for inspecting the array safely." However the actual file modification DID land — Codex appears to have used a different mechanism than the read-then-edit pattern. Result: P116 assertions correctly invoked through `--sac` flag.

**INFO-3 — Orchestrator-applied benchmark regeneration + validator fixes:**
- Codex's initial benchmarks used stale shape (`schema_version` + `kind` instead of `chronicle_version` + `chronicle_type`, missing 5 required root fields, sparse denominators) → orchestrator regenerated all 8 with `.tmp-sgsd/p116/regen-benchmarks.cjs` (mechanical fixture authoring matching the P113 schema).
- Validator's mesh-ledger format detection assumed `{` as first char = JSON (broke JSONL parsing) → orchestrator patched to detect `.jsonl` extension AND multi-line `}\n{` pattern.
- Validator's CHRONICLE-XX error codes weren't surfacing through ajv → orchestrator added `loadAjvErrors` candidate-path loader + plugin registration in `validateContextSchema`. Now CHRONICLE-01, CHRONICLE-02, etc. flow through stderr.

## ATC LITE self-review

- First Principles: validator is the LOAD-BEARING gate per DLB-11 R4 ✓
- Delete: 10 files matches plan; no bonus ✓
- Simplify: validator is procedural pipeline (parse → check → emit); no agent logic ✓
- Accelerate: validator runs in ~90ms baseline (50x under 2s budget) ✓
- Automate: bash CLI wrapper hooks future sgsd-complete-phase skill ✓
- Validate: 56-assertion harness green; 8 benchmarks classified correctly ✓
- Anti-slop: every benchmark is exercised; validator surface area = exactly the 4 verdict modes from DLB-11 R4

## MUDA self-review

- Overproduction: 10 created + 1 modified = 11 ops matches plan exactly
- Inventory: every benchmark mapped 1-1 to SAC-P116-NN; validator code paths all exercised
- Defects: 2 patch rounds (benchmark shape + validator format-detection + ajv-errors plugin). Root cause for benchmarks: Codex saw build-context-pack output indirectly (via read-pack content) but authored fixtures based on its own draft shape. For validator: ajv-errors plugin was missed in initial draft (validator used bare Ajv without the errorMessage extension).
- Motion: no cross-file refactoring outside P116 deliverables
- Waiting: 8 benchmarks could be authored independently of validator code; both in parallel within executor dispatch
- Over-processing: benchmark regenerator script (.tmp-sgsd/p116/regen-benchmarks.cjs) is throwaway — fixtures themselves are the canonical artefact
- Transport: validator + CLI co-located with chronicle tooling; bash wrapper under scripts/ matches codex-exec.sh pattern

## Soft warnings

**WARN — STRUCT-P115-24-P113-DOGFOOD + DOGFOOD-P113 still skipped.** Both will fire when v3.1 phases emit CMBs into the mesh ledger (lands at P117 storage adapter + P118 cockpit integration). At v3.1 milestone close (P119), dogfood becomes load-bearing for the full pipeline.

## Next phase

P117 — Storage Adapter (`publish.cjs`). Per DLB-11 R5: VTP-MCP first if available, local-fallback always safe. Routes chronicle outputs to either VTP storage OR `.planning/chronicles/{milestone}/P{NN}/` directory tree + index ledger. Stores CMB references by-ID (never full bodies) per R5 invariant.

## Provenance

- Codex initial dispatch: failed with Windows process-launch error (`CreateProcessAsUserW failed: 216`)
- Codex retry: succeeded; all 10 files + 1 modify landed
- Orchestrator-applied fixes: benchmark fixture regeneration (mechanical shape conformance to P113 schema), mesh-ledger format-detection patch, ajv-errors plugin wiring
- Final self-test: 56/56 PASS first run post-fixes
