# SGSD Harness Evolution -- Component Substrate Doc

> Phase 98 (v2.9 Agentic Harness Evolution).
> Companion to: super-gsd/registry/harness-components.yaml
> Tool: super-gsd/tools/harness-components/catalog.cjs

## Why this exists

The AHE paper (arXiv 2604.25850v1) argues that self-improving coding agents
become stable only when their editable surfaces are **explicit** and
**reversible**. Without that, the agent can change anything, nothing is
attributable, and bloat compounds.

The SGSD interpretation: every part of the harness that Claude / Codex /
Warp / MCP / SGSD itself may change must be a **named, file-addressable,
class-typed, ownership-tagged, rollback-aware** component.

This document explains the registry contract.

## The 14-class closed vocab

| Class | Meaning | Example |
|---|---|---|
| `prompt` | system/agent/skill prompt or rule doc | `CLAUDE.md`, `AGENTS.md` |
| `tool` | runnable executable / library under super-gsd/tools | `warp-doctor`, `state-resolver` |
| `middleware_hook` | live hook between orchestrator + sub-agents | `orchestrator-hooks.cjs` |
| `skill` | named SKILL.md under super-gsd/skills or .agents/skills | `sgsd-orchestrate` |
| `agent_config` | agent-definition file | (planned: agent dispatch contracts) |
| `memory` | auto-memory or curated memory file | `MEMORY.md` |
| `workflow` | Warp/Notebook/saved workflow | `.warp/workflows/*` |
| `mcp_bridge` | MCP server surface (read or write) | `warp-mcp`, `warp-mcp-actions` |
| `gate` | enforcement script that blocks/allows | `complete-milestone-gate` |
| `dashboard` | operator visualization surface | `cockpit-shell`, `mission-control-tile` |
| `docs` | reference doc, not a prompt | `SGSD-WARP-OPERATOR-GUIDE.md` |
| `protected_oracle` | hidden benchmark / scoring source-of-truth | `hidden-benchmark-decks` |
| `protected_verifier` | verifier code never touched by evolution | `gsd-verifier-contract` |
| `protected_model_config` | model routing / token budget config | `model-routing-config` |

The vocab is **frozen** in `catalog.cjs` (`Object.freeze(COMPONENT_CLASSES)`).
Drift is a validation error, not a soft warning.

## Required fields per row

```yaml
- id: warp-doctor                       # kebab-case, unique
  class: tool                           # one of 14
  paths:                                # 1-N relative paths
    - super-gsd/tools/warp-doctor/check.cjs
    - super-gsd/tools/warp-doctor/run-self-test.cjs
  owner: tools-team                     # who curates
  edit_policy: orchestrator-or-operator # who may edit
  test_commands:                        # how we know it still works
    - node super-gsd/tools/warp-doctor/run-self-test.cjs
  rollback_method: git-revert           # how to undo
  protected: false                      # true => class must be protected_*
```

## What "protected" means

`protected: true` rows are **off-limits to the evolution loop**. The AHE paper
calls this "hold the model fixed to isolate system gains" -- if the verifier,
oracle, or model config can be edited by the loop, we cannot tell whether
performance gains are real harness improvements or scoring drift.

The validator enforces:
- `protected: true` requires class `protected_oracle`, `protected_verifier`,
  or `protected_model_config`.
- Non-protected classes cannot set `protected: true`.

Currently 5 rows are protected:
- `hidden-benchmark-decks` (oracle)
- `scoring-oracle` (oracle)
- `gsd-verifier-contract` (verifier)
- `model-routing-config` (model config)
- `token-budget-config` (model config)

## Path-safety rules

The validator rejects:
- Absolute paths (Windows `C:\...` or POSIX `/...`) except for `memory` class
  (memory lives at user-profile path).
- Path traversal (`..`).
- Non-ASCII characters in any path.
- Empty `paths[]` arrays.
- Empty `test_commands[]` arrays.

## Lock-13 API contract

`catalog.cjs` exposes a Lock-13 surface: **never throw across boundary**.
Public functions return `{ ok, rows, errors }` where:

- `ok: true` -> registry loaded, all rows valid.
- `ok: false` -> see `errors[]` for reasons.
- `rows: []` -> always present (empty if load failed).

```javascript
const catalog = require('super-gsd/tools/harness-components/catalog.cjs');

const r = catalog.loadRegistry();
if (!r.ok) {
  console.error('registry errors:', r.errors);
  // continue with degraded path; do not throw
}

console.log('components:', r.rows.length);
console.log('classes:', catalog.listClasses());
console.log('protected:', catalog.listProtectedClasses());

const wd = catalog.findById('warp-doctor');
console.log('warp-doctor paths:', wd && wd.paths);
```

## How Phase 99+ will use this

- **Phase 99 (Trajectory Evidence Corpus)**: distillation tool reads
  `catalog.loadRegistry().rows` to know which components were touched in
  each run, without parsing full prose docs. The substrate is the index.
- **Phase 100 (Change Manifest Prediction Ledger)**: every harness edit
  manifest must name `target_component` matching a registry `id`.
- **Phase 101 (Attribution + Rollback Gate)**: rollback uses the registry's
  `rollback_method` field.
- **Phase 103 (Component Ablation)**: ablation iterator walks
  `r.rows.filter(x => x.protected !== true)` to pick eligible swap targets.

The stop rule from PLAN.md:

> Do not move to Phase 99 until the registry can be read by a script
> without loading full SGSD docs into context.

Verified: `require('super-gsd/tools/harness-components/catalog.cjs')` returns
the rows directly. No prose parsing needed.

## Self-test

```powershell
node super-gsd/tools/harness-components/run-self-test.cjs
```

Expected: `harness-components-catalog-self-test: 21/21 passed`.

## Component class quick reference

| If you're editing... | Use class |
|---|---|
| A markdown rule doc Claude reads | `prompt` |
| A runnable .cjs / .mjs / .ps1 in super-gsd/tools | `tool` |
| A live hook on orchestrator dispatch path | `middleware_hook` |
| A SKILL.md anywhere | `skill` |
| MEMORY.md or memory/*.md | `memory` |
| .warp/workflows/*.yaml | `workflow` |
| MCP server surface | `mcp_bridge` |
| A script that blocks/allows operations | `gate` |
| A render-only operator surface | `dashboard` |
| A reference doc not loaded into prompts | `docs` |
| A hidden benchmark deck or oracle | `protected_oracle` |
| Verifier code | `protected_verifier` |
| Model/budget config | `protected_model_config` |

When in doubt, prefer `tool` for runnable code and `docs` for prose. Use
`prompt` only for files that ARE loaded into agent context.

---

# Phase 99 -- Trajectory Evidence Corpus

## Why this exists

AHE-P-02: distill experience before asking for change. The agent should not
read millions of raw tokens. It should read a layered corpus with
drill-down pointers.

`super-gsd/tools/harness-evidence/distill.cjs` reads SGSD's 7 JSONL log
surfaces + optional benchmark RUN.json/REPORT.md and emits:

```
.planning/harness-evolution/runs/<run_id>/
  OVERVIEW.md     -- compressed summary, <=4KB by default
  INDEX.json      -- machine-readable pointer index
  tasks/<phase>_<plan>.md  -- per-group reports (pointers, not raw copies)
```

## CLI

```powershell
# Distill the latest pulse window automatically
node super-gsd/tools/harness-evidence/distill.cjs

# Distill a specific time window
node super-gsd/tools/harness-evidence/distill.cjs `
  --since 2026-04-30T00:00:00Z `
  --until 2026-04-30T23:59:59Z `
  --run-id v2.9-overnight

# Include a benchmark report
node super-gsd/tools/harness-evidence/distill.cjs `
  --benchmark .planning/benchmarks/ahe-paper-smoke `
  --run-id ahe-smoke-distill
```

## Library API

Lock-13: never throws.

```javascript
const distill = require('super-gsd/tools/harness-evidence/distill.cjs');

const r = distill.distillRun({
  projectDir: process.cwd(),
  run_id: 'overnight',
  since: '2026-04-30T00:00:00Z'
});
if (!r.ok) console.error(r.errors);
console.log('overview:', r.overview_path);
console.log('tasks:', r.task_paths.length);
```

## Closed-vocab root causes (11)

```
state_projection_drift
missing_context_packet
provider_unavailable
gate_false_negative
gate_false_positive
token_budget_breach
duplicate_verification
incomplete_artifact
hidden_fault_uncaught
successful_recovery_pattern
unknown
```

`unknown` catches the long tail. Adding new labels is a Phase 99+ change
to `ROOT_CAUSES` in `distill.cjs` (frozen via `Object.freeze`).

## Pointers, not copies

Per-task .md files contain phase/plan + label set + first-5-event
summaries + grep hints into source JSONL. Full raw events stay in source
files; the corpus does not duplicate them. This keeps per-task reports
small and avoids the million-token-prompt failure mode the AHE paper
warns against.

## Operator note: time-windowing

The full historical log set has thousands of unique phase:plan
combinations. Always use `--since` (and optionally `--until`) for
post-run analysis to keep the per-task corpus tractable. The default
"no window" path is only for live monitoring of the current iteration.

## Self-test

```powershell
node super-gsd/tools/harness-evidence/run-self-test.cjs
```

Expected: `harness-evidence-distill-self-test: 18/18 passed`.

---

# Phase 100 -- Change Manifest Prediction Ledger

## Why this exists

AHE-P-03 (falsifiable contracts) + AHE-P-10 (regression prediction is
first-class). The manifest is the contract: every harness edit must
declare what it predicts to fix and what it might regress.

Path: `super-gsd/tools/harness-manifest/`
Ledger: `.planning/metrics/harness-change-manifest.jsonl`

## Schema (14 required fields)

See `MANIFEST.schema.json`. Required: `change_id` (kebab `ch-*`),
`component_id` (must exist in catalog), `component_class` (one of 14),
`files`, `evidence_ids`, `root_cause` (one of 11 distill labels),
`targeted_fix` (<=240 chars), `predicted_fixes` (>=1), `predicted_regressions`
([] OK, null forbidden), `expected_token_delta`, `expected_gate_delta`,
`rollback_method`, `protected_surface_check` ("true"|"false").

Protected-surface edits require `operator_override_id` (non-empty string).

## Library

```javascript
const m = require('super-gsd/tools/harness-manifest/manifest.cjs');
const r = m.appendEntry(entry, { projectDir: process.cwd() });
if (!r.ok) console.error(r.errors);
```

Lock-13: never throws. Idempotent on `change_id` (re-append rejected).

---

# Phase 101 -- Attribution + Rollback Gate

## Why this exists

Manifests are aspirational without scoring. The attributor compares
prior predictions against next-run evidence and emits one of 6 verdicts.

Path: `super-gsd/tools/harness-attribution/`
Ledger: `.planning/metrics/harness-attribution.jsonl`

## Verdicts (6, frozen)

```
keep                 - all predicted fixes observed; no surprise regressions
revert               - predicted fixes missed AND new regressions appeared
quarantine           - mixed signal; needs another run before keep/revert
pivot_component      - 2nd consecutive failure on same component_class
inconclusive         - benchmark didn't run or signal too weak
environmental_skip   - provider unavailable; not the edit's fault
```

## Library

```javascript
const a = require('super-gsd/tools/harness-attribution/attribute.cjs');
const r = a.attribute({
  manifest: <manifest entry>,
  prevEvidence: { labels: [...], env: 'ok' },
  nextEvidence: { labels: [...], env: 'ok' }
});
console.log(r.verdict, r.fix_metrics, r.regression_metrics);
if (r.rollback_recommendation) console.log(r.rollback_recommendation.manual_command);
```

Surprise regressions (FN regressions) surface via
`regression_metrics.surprises[]` -- they cannot be hidden by fix recall.

## Milestone close gate

`sgsd-complete-milestone --milestone v2.9` blocks SHIPPED-clean when
manifest entries lack attribution. Phase 105 extends with transfer +
critical-regression checks.

---

# Phase 102 -- Harness Evolution Runner

## Why this exists

The outer loop. Wires Phases 98-101 into a single conservative driver
with 4 modes.

Path: `super-gsd/tools/harness-evolution/`
Log: `.planning/metrics/harness-evolution-log.jsonl`

See `super-gsd/tools/harness-evolution/README.md` for full CLI examples.

---

# Phase 103 -- Component Ablation + Interference

## Why this exists

AHE-P-08 + AHE-P-09: locate gains by swapping components; expect
non-additive interference. The runner copies+renames the target to
`*.ablated` in `os.tmpdir()`. Main workspace stays byte-stable.

Path: `super-gsd/tools/harness-ablation/`
Log: `.planning/metrics/harness-ablation.jsonl`

## Interference rules (3, frozen)

- `duplicate_verification` -- same root_cause label appears at same
  frequency in baseline and ablated (component didn't contribute).
- `redundant_gate_stack` -- ablated runs >=10% faster with same outcomes.
- `token_cost_inversion` -- ablation REDUCES tokens (component was burning).

## Library

```javascript
const ab = require('super-gsd/tools/harness-ablation/ablate.cjs');
const plan = ab.planAblation({ spec: { ... } });
if (!plan.ok) console.error(plan.errors);
const iso = ab.isolateWorkspace({ projectDir: ..., target_files: [...] });
// run benchmark in iso.temp_dir
const sigs = ab.detectInterference(baseline, ablatedResult);
ab.restoreWorkspace({ temp_dir: iso.temp_dir });
```

Hard rule: protected components (oracle / verifier / model_config) cannot be ablated.

---

# Phase 104 -- Transfer + OOD Benchmark

## Why this exists

AHE-P-07: transfer is the overfit test. A change that improves the
deterministic deck but fails on a held-out deck or burns 2x tokens is
not a clean improvement.

Path: `super-gsd/tools/harness-transfer/`
Log: `.planning/metrics/harness-transfer.jsonl`

## Hard rule: frozen-before-run

The evaluator REFUSES to attribute a transfer to a manifest entry
whose `_appended_at` is AFTER the transfer's `started_at`. No
overfit-by-temporal-cheat.

## Critical regression rules (3)

- `success_rate_drop` >= 5%
- `token_cost_bloat` > 50% (ablated > baseline * 1.5)
- `regressions_observed` non-empty

## Library

```javascript
const x = require('super-gsd/tools/harness-transfer/evaluate.cjs');
const r = x.evaluateTransfer({ record: { ... }, baseline: { ... } });
if (r.transfer_record.critical_regression) {
  console.error('blocking critical regression:', r.transfer_record.critical_regression_reasons);
}
x.recordTransfer(r.transfer_record, { projectDir: process.cwd() });
```

---

# Phase 105 -- Release Gate + Cockpit Integration

## v2.9 close gate (extended)

`node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.9`

Blocks SHIPPED-clean when ANY of:
1. Manifest entries lack attribution rows.
2. Attribution verdict=revert is not yet applied.
3. Keep-verdict change has no transfer record.
4. Transfer record reports critical regression.

Or operator marks SHIPPED-WITH-UNPROVEN-HARNESS-EVOLUTION explicitly.

## Deferred integration (operator follow-up)

Two integration points need lockstep edits to count-pinned self-tests:

1. **warp-mcp tool** (TOOL_NAMES frozen at 14; 47/47 self-test): adding
   a 15th tool `sgsd_harness_evolution_status` requires updating TOOL_NAMES
   + 4 self-test assertions (A1, A6, A7, A13).

2. **cockpit-state section** (SECTION_KEYS frozen at 11; 19/19 self-test):
   adding a 12th `harness_evolution` section requires updating
   SECTION_KEYS + 2 self-test assertions (A1_section_keys_frozen_11,
   A4_all_11_sections_present).

Until those land, operators read evolution status via:

```powershell
# Latest attributions
Get-Content .planning/metrics/harness-attribution.jsonl -Tail 5

# Latest transfers
Get-Content .planning/metrics/harness-transfer.jsonl -Tail 5

# Evolution log
Get-Content .planning/metrics/harness-evolution-log.jsonl -Tail 10

# Or run the runner directly
node super-gsd/tools/harness-evolution/run.cjs --attribute-only ...
```

---

## Footer

Source: SGSD v2.9 Agentic Harness Evolution roadmap, Phases 98-105.
Maintainer: orchestrator. Operator owns protected rows + DEFERRED items.
