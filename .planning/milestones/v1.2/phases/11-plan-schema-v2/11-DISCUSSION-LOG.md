# Phase 11: Plan Schema v2 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 11-plan-schema-v2
**Areas discussed:** Optional-field defaults, Parser ownership + location, Cross-repo schema pinning
**Area declined for discussion (Claude's Discretion):** Classifier-skip completeness

---

## Gray-Area Selection

| Gray Area | Selected |
|-----------|----------|
| Parser ownership + location | ✓ |
| Optional-field defaults | ✓ |
| Cross-repo schema pinning | ✓ |
| Classifier-skip completeness | (declined — Claude's Discretion) |

---

## Optional-field Defaults

### Q1: `expected_ATC_tier` default when unset

| Option | Description | Selected |
|--------|-------------|----------|
| Default to LITE | Match CLAUDE.md heuristic (10-50 lines / ≤3 files); declare only when NOT LITE | ✓ |
| Derive from files_touched | Parser auto-tiers from files count + heuristic line-size | |
| Force explicit declaration | Reject plans missing the field at load-time | |
| Default to FULL | Fail-safe; over-invoke quality gates | |

**User's choice:** Default to LITE
**Notes:** Ergonomic default for the common case.

### Q2: `prior_errors_lookup` default when unset

| Option | Description | Selected |
|--------|-------------|----------|
| Default true | Auto-lookup always (~200 tok/dispatch) | |
| Default false | Opt-in only | |
| Default true only for FULL/GATE | Tier-sensitive: LITE skips, FULL/GATE auto-query | ✓ |

**User's choice:** Default true only for FULL/GATE
**Notes:** Compute once from resolved expected_ATC_tier.

### Q3: `skip_gates` default when absent

| Option | Description | Selected |
|--------|-------------|----------|
| Empty list — skip nothing | Safe-by-default; Phase-10 gates run unless explicitly skipped | ✓ |
| Forward-reference Phase 10 policy | Default = gates.yaml mandatory list (Phase 10 lands the registry later) | |
| Fail-closed — require explicit [] | Force conscious declaration even when empty | |

**User's choice:** Empty list — skip nothing
**Notes:** Default is safe even before Phase 10 gates.yaml lands.

### Q4: `lessons_path` set-but-missing-file behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Warn + continue | Log warning, proceed with plan | ✓ |
| Fail plan-load | Parser rejects the plan | |
| Auto-create empty stub | Silently create missing file and proceed | |

**User's choice:** Warn + continue
**Notes:** Stale refs are a productivity issue, not a correctness blocker.

### Q5: Remaining 3 low-controversy fields

| Option | Description | Selected |
|--------|-------------|----------|
| Accept as-is — move to Parser | Lock `depends_on: []`, `known_deadends: []`, `verification_cmd: null` under Claude's Discretion | ✓ |
| Discuss one of the remaining 3 | Dig into one of them before advancing | |

**User's choice:** Accept as-is — move to Parser

---

## Parser Ownership + Location

### Q1: Where does the v2 validator live?

| Option | Description | Selected |
|--------|-------------|----------|
| Node script in super-gsd/tools/ | Standalone CLI at `super-gsd/tools/plan-schema/validate.cjs` | ✓ |
| PreToolUse hook in settings.json | Hook fires on Read of PLAN.md | |
| Embedded in sgsd-orchestrate skill | Inline prose + Bash invocation | |
| New sgsd-plan-load sub-skill | First-class skill with its own SKILL.md | |

**User's choice:** Node script in super-gsd/tools/
**Notes:** Matches the existing `tools/process-audit/` sibling pattern; testable in isolation.

### Q2: When does validation fire?

| Option | Description | Selected |
|--------|-------------|----------|
| At plan-load only | Orchestrator validates pre-dispatch | |
| Both write-time and load-time | superpowers:writing-plans self-validates + orchestrator re-validates on load | ✓ |
| At plan-write only | Trust the authoring pipeline, no load-time check | |

**User's choice:** Both write-time and load-time
**Notes:** Two enforcement points; load-time catches manual post-write drift.

### Q3: Error format

| Option | Description | Selected |
|--------|-------------|----------|
| Custom human-readable lines | `[NN-PP-PLAN.md] task #K: missing required 'falsifier'` | |
| Stock JSON Schema (ajv) | ajv errorObject array only | |
| Both — human summary + ajv log | Console summary + full ajv output to `.planning/metrics/plan-errors.jsonl` | ✓ |

**User's choice:** Both — human summary + ajv log
**Notes:** Best of both worlds; telemetry preserved in JSONL.

### Q4: Action on load-time validation failure

| Option | Description | Selected |
|--------|-------------|----------|
| Halt + write checkpoint | Block dispatch, stop loop, operator takes over | |
| Block this plan, continue to next | Skip malformed plan, emit error, proceed | |
| Fall back to v1 classifier | Treat malformed v2 plan as v1, let Haiku classify | |
| **User override (freeform)** | **Self-healing loop: detect → dispatch fix skill → replan → re-execute → loop until pass or cap** | **✓** |

**User's choice (freeform):** "We need to come up with a better way for this, i don't want to guess anythng but we cannot have the loop breaking either, can we not debug or call on another skill to debug the malformed plan, replan then rexecute and loop that until we pass through the inital failed fate"
**Notes:** User explicitly rejected all three presented options; demanded a self-healing mechanism. Follow-up design questions (Q4a + Q4b) sharpened the loop shape.

### Q4a: Fix-loop owner

| Option | Description | Selected |
|--------|-------------|----------|
| New sgsd-plan-fix skill | Dedicated skill for schema repair | |
| Extend gsd-planner with --fix-schema flag | Reuse planner that already knows the schema | ✓ |
| Route through sgsd-debug | Treat as a debug session, reuse checkpoint machinery | |

**User's choice:** Extend gsd-planner with --fix-schema flag
**Notes:** Smaller diff; planner already knows SCHEMA contract.

### Q4b: Retry cap before halting

| Option | Description | Selected |
|--------|-------------|----------|
| 3 attempts then halt | Balanced — enough runway, short enough to surface real problems | ✓ |
| 5 attempts then halt | More patience, higher cost on unfixable cases | |
| 1 attempt then halt | Conservative; one-strike | |
| Configurable cap in config.json | Default 3, operator can override | |

**User's choice:** 3 attempts then halt
**Notes:** Matches debugging cycles elsewhere in GSD.

---

## Cross-Repo Schema Pinning

### Q1: Pin mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Boot-time hash check | sha256 of plan-schema-v2.json vs pinned value in config.json | ✓ |
| Git submodule | superpowers:writing-plans pulls schema via submodule | |
| Semver + warning-on-mismatch | Semver declaration; mismatch emits warning only | |
| Manual coordination only | Document expectation, operator maintains parity | |

**User's choice:** Boot-time hash check
**Notes:** Zero build-system changes; drift surfaces at session start.

### Q2: Source of truth

| Option | Description | Selected |
|--------|-------------|----------|
| This repo (GSDedits) is canonical | super-gsd/templates/plan-schema-v2.json is source; superpowers:writing-plans consumes | ✓ |
| superpowers repo is canonical | External package owns schema; this repo mirrors | |
| Shared 3rd location | Publish to npm / dedicated repo / gist | |

**User's choice:** This repo (GSDedits) is canonical
**Notes:** Matches "super-gsd is the framework" framing.

### Q3: Drift action at session start

| Option | Description | Selected |
|--------|-------------|----------|
| Warn + continue | Log drift event, console warning, loop proceeds | ✓ |
| Block until resync | Halt at session start, require manual sync | |
| Auto-fetch canonical | Silently overwrite local with canonical, proceed | |

**User's choice:** Warn + continue
**Notes:** Non-blocking; operator decides when to resync. Matches DLB-06 "reject framing" on cross-repo distribution complexity.

---

## Closing Decision

### Q: Proceed to write CONTEXT.md or discuss the 4th declined area?

| Option | Description | Selected |
|--------|-------------|----------|
| Write CONTEXT.md now | Lock decisions; Classifier-skip completeness stays Claude's Discretion | ✓ |
| Discuss Classifier-skip completeness | Decide whether v2 plans declare full classifier surface or orchestrator derives | |

**User's choice:** Write CONTEXT.md now

---

## Claude's Discretion

Explicit hand-offs recorded in CONTEXT.md §Claude's Discretion:
- Classifier-skip completeness (operator declined discussion; derivation rule proposed in CONTEXT)
- `superpowers:writing-plans` sync mechanism (planner's call within pinning constraint)
- ajv version + vendoring strategy
- Repair attempt staging file naming convention
- JSONL line shape for `plan-errors.jsonl`

## Deferred Ideas

Captured in CONTEXT.md §Deferred:
- Classifier-skip completeness as formal discussion (revisit if Phase 12 MACH-01 exposes a gap)
- Auto-suggest fixes inline (ergonomic polish, post-Phase-11)
- Voluntary v1 → v2 migration tool (explicitly out-of-scope by "146 plans sacred" constraint)
- Schema evolution beyond v2 (no v3 planning in this phase)
- Concrete sync mechanism between this repo and `superpowers:writing-plans` (planner decides)
