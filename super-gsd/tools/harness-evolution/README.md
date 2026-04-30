# SGSD Harness Evolution Runner

> Phase 102 (v2.9 Agentic Harness Evolution).
> Outer loop: evaluate -> distill -> propose -> route bounded edit -> test
> -> commit candidate.

## What this is

The runner ties Phases 98-101 into a single safe loop. It is **conservative
by design**: it never reads protected oracles into model context, never
applies code edits without an explicit `--commit` flag (Phase 103+ will
add that), and never bypasses the protected-surface guard.

## Modes

| Mode | What it does | Side effects |
|---|---|---|
| `--dry-run` | Reads a candidate spec, prints proposal summary | Appends one row to `harness-evolution-log.jsonl` |
| `--proposal-only` | Validates spec, writes one manifest entry via Phase 100 | Appends to `harness-change-manifest.jsonl` + `harness-evolution-log.jsonl` |
| `--apply-candidate` | Route-only stub; no code edit unless `--commit` (deferred) | Appends to `harness-evolution-log.jsonl` |
| `--attribute-only` | Routes through Phase 101 attribute scorer | Appends to `harness-evolution-log.jsonl` |

## CLI

### Dry-run

```powershell
node super-gsd/tools/harness-evolution/run.cjs `
  --dry-run `
  --candidate-spec .planning/tasks/candidate-001.json
```

### Proposal-only

```powershell
node super-gsd/tools/harness-evolution/run.cjs `
  --proposal-only `
  --candidate-spec .planning/tasks/candidate-001.json
```

### Apply candidate (route-only stub)

```powershell
node super-gsd/tools/harness-evolution/run.cjs `
  --apply-candidate `
  --candidate-spec .planning/tasks/candidate-001.json
```

### Attribute against last run

```powershell
node super-gsd/tools/harness-evolution/run.cjs `
  --attribute-only `
  --manifest-file .planning/tmp/manifest-row.json `
  --prev-evidence .planning/tmp/prev-evidence.json `
  --next-evidence .planning/tmp/next-evidence.json
```

## Candidate spec format

```json
{
  "change_id": "ch-evolve-001",
  "component_id": "warp-doctor",
  "component_class": "tool",
  "files": ["super-gsd/tools/warp-doctor/check.cjs"],
  "evidence_ids": ["run-2026-04-30-overnight"],
  "root_cause": "gate_false_negative",
  "targeted_fix": "<=240 chars why this fixes that root cause",
  "predicted_fixes": ["gate_false_negative"],
  "predicted_regressions": [],
  "expected_token_delta": -200,
  "expected_gate_delta": 0,
  "rollback_method": "git-revert",
  "protected_surface_check": "false",
  "operator_override_id": null
}
```

`protected_surface_check: "true"` MUST come with `operator_override_id`
set to a non-empty string. Otherwise the runner refuses.

## Library API

```javascript
const evolve = require('super-gsd/tools/harness-evolution/run.cjs');

const r = evolve.runDryRun({
  specPath: 'path/to/spec.json',
  projectDir: process.cwd()
});
if (!r.ok) console.error(r.errors);
console.log('proposal:', r.proposal_summary);
```

All public functions are Lock-13: never throw, return `{ ok, ...errors[] }`.

## Hard boundaries

1. **Never reads hidden benchmark oracles into model context.**
   `protectedSurfaceCheck` rejects any spec whose `files[]` includes a
   path that appears in a registry row marked `protected: true`.
2. **Never applies code edits without `--commit`.** Apply-candidate today
   only routes; Phase 103+ will gate the actual `--commit` flag.
3. **Never modifies the verifier, scoring oracle, model config, or
   token budget.** These rows are class `protected_*` in the registry
   and require `operator_override_id` to even propose.

## Self-test

```powershell
node super-gsd/tools/harness-evolution/run-self-test.cjs
```

Expected: `harness-evolution-runner-self-test: 17/17 passed`.

The self-test does NOT call any LLM; all modes are exercised against
synthetic specs in temporary directories.

## How phases compose

```
Phase 98  catalog.cjs       <- registry + protected check
Phase 99  distill.cjs       <- evidence corpus reader
Phase 100 manifest.cjs      <- manifest schema + ledger
Phase 101 attribute.cjs     <- prediction scorer + verdict
Phase 102 run.cjs (THIS)    <- outer loop, 4 modes
Phase 103 ablation iterator -- iterates non-protected rows
Phase 104 transfer eval     -- held-out task decks
Phase 105 release gate      -- close-time enforcement + cockpit surface
```

Phase 102 is the seam: every later phase calls runner functions or
appends to `harness-evolution-log.jsonl`.

## Safety footer

This runner is the operational center of v2.9. Operator owns:
- The candidate spec content.
- The `--commit` flag (not yet wired; Phase 103 stop point).
- Any `operator_override_id` declarations.

Source: SGSD v2.9 Agentic Harness Evolution roadmap, Phase 102.
