# Double-Agent Executor Token Audit

Generated: 2026-04-29
Repo: `GSDedits`

## Executive Read

SGSD should not solve token waste by simply "using Codex more." It should solve it by routing each unit of work to the cheapest competent executor with a small, explicit task capsule.

The current live ledger shows that execution is expensive, but it is not the worst offender. The largest waste is orchestration and planning context mass. The correct design is therefore:

1. Local scripts first for deterministic work.
2. Codex first for bounded code edits, small refactors, test repair, and diff review.
3. Claude first for ambiguous intent, architecture, milestone judgment, operator communication, and cross-phase synthesis.
4. Never send full phase/milestone context to an executor by default.
5. Record every routing decision and compare actual cost, rework, defect catches, and timeouts.

SGSD already has most of the substrate from v1.9:

- Phase 41 token attribution.
- Phase 42 token-waste budgets and route hints.
- Phase 43 phase capsules.
- Phase 45 intent-map and context-packet builder.
- Phase 47 dispatch-router.
- Phase 50 cockpit surfaces.

The next layer should be a "Double-Agent Executor": a router plus execution contract that chooses the primary doer and, when needed, a cheaper challenger.

## Live Evidence

Commands run:

```powershell
node super-gsd/tools/token-attribution/report.cjs --summary --group-by role
node super-gsd/tools/token-attribution/report.cjs --summary --group-by provider
node super-gsd/tools/token-waste/check.cjs --check --json
node super-gsd/tools/dispatch-router/route.cjs --self-test
```

### Spend By Role

| Role | Calls | Total attributed tokens | Avg per call | Cache-read ratio | Useful findings per 100k |
|---|---:|---:|---:|---:|---:|
| orchestrator | 12,093 | 4,179,758,064 | 345,635 | 96.3% | 0 |
| planner | 2,304 | 568,056,556 | 246,552 | 96.7% | 8 |
| reviewer | 5,682 | 438,851,490 | 77,235 | 92.3% | 0 |
| researcher | 2,240 | 211,146,344 | 94,262 | 90.7% | 20 |
| executor | 3,567 | 203,212,589 | 56,970 | 90.7% | 23 |
| classifier | 611 | 40,395,927 | 66,114 | 87.3% | 0 |
| other | 322 | 8,773,451 | 27,247 | 74.7% | 1 |

Interpretation:

- The executor is worth optimizing, but planner and orchestrator are the main burn.
- Executor has the best useful-finding density of the high-volume roles, so blindly replacing it would be wrong.
- Planner has a severe context problem: 246k average tokens per call, 96.7% cache-read ratio.
- Orchestrator is the biggest target: 4.18B attributed tokens and 12,093 calls.

### Spend By Provider

| Provider | Calls | Total attributed tokens | Avg per call | Status |
|---|---:|---:|---:|---|
| Claude | 26,744 | 5,650,068,988 | 211,265 | 26,744 ok |
| Codex | 75 | 125,433 | 1,672 | 58 ok, 11 timeout, 6 warn |

Interpretation:

- Codex is massively underused compared with Claude.
- Current Codex use is mostly review-style work, not execution.
- Codex timeout rate is real: 11/75 = 14.7%. Routing must avoid sending broad or under-scoped work to Codex.
- Codex should get narrow tasks with allowed files, test commands, and bounded output contracts.

### Token-Waste Gate Snapshot

`token-waste/check.cjs --check --json` returned:

| Metric | Count |
|---|---:|
| rows evaluated | 26,819 |
| ok | 2,924 |
| warn | 6,600 |
| degraded | 17,295 |

Top route hints:

| Route hint | Count |
|---|---:|
| orchestrator_turn_trim_candidate | 10,365 |
| codex_reviewer_fallback_candidate | 5,403 |
| executor_context_packet_candidate | 2,741 |
| researcher_local_script_candidate | 1,664 |

Interpretation:

- This confirms the gut feel: SGSD is still carrying too much context through the orchestration loop.
- The executor problem is real, but the bigger problem is that executor dispatches are still often reached through bloated orchestration and planning context.
- The system already detects this. The next step is enforcing routing, not just reporting.

## Existing Machinery We Should Reuse

### Dispatch Router

Source: `super-gsd/tools/dispatch-router/route.cjs`

Current supported provider decisions:

- `local-script`
- `codex`
- `claude`
- `vtp`

Current uncertainty types:

- `deterministic_extraction`
- `bounded_code_review`
- `synthesis_judgment`
- `architecture_challenge`
- `prior_memory_lookup`
- `book_lookup`

Important current behavior:

- Small extraction routes local-first.
- Bounded code review routes Codex-first when Codex is healthy.
- Synthesis judgment stays Claude.
- VTP is whitelisted only for architecture/prior-memory/book lookup.
- Context pressure biases away from Claude.
- The router never blocks autopilot. It falls back and logs.

Self-test result:

```text
dispatch-router self-test: 15 pass, 0 fail
```

### Context Packet Builder

Source: `super-gsd/tools/context-packet/build.cjs`

The builder already has the right principle:

- Current phase context first.
- Phase capsules next.
- Validated thoughts and local index snippets.
- VTP evidence only when routed.
- Raw files only as fallback.

This means the double-agent executor should not invent a new context system. It should consume a smaller, stricter execution packet built from the existing context-packet surface.

### Current Codex Wrapper Limitation

Source: `super-gsd/scripts/codex-exec.sh`

The current wrapper is a review wrapper:

- It runs `codex exec`.
- It uses read-only sandboxing.
- It expects a 5-field `code-reviewer-v1` report.
- It writes `codex-log.jsonl`.

That is correct for ATC/code review. It is not yet an executor.

For execution we need a separate wrapper, not a mutation of the review wrapper:

- `codex-task-exec.sh` or `codex-task-exec.cjs`
- task-capsule input
- allowed write set
- optional git worktree sandbox
- patch/report output
- post-run diff boundary check
- test command contract

## What Each Model Should Do

### Claude Best Fit

Claude should own:

- Operator intent and ambiguous English.
- Milestone/phase interpretation.
- Architecture tradeoffs.
- Cross-phase reasoning.
- Safety, privacy, and irreversible-change judgment.
- Final synthesis and user-facing explanation.
- Deciding whether a result actually satisfies the SGSD goal.

Claude should not spend large tokens on:

- Re-reading the same internal files.
- Mechanical schema edits.
- Simple PowerShell/Node rewrites.
- Grep/inventory tasks.
- Repeating review checklists when Codex or scripts can do them.

### Codex Best Fit

Codex should own:

- Bounded code edits.
- Focused file-level implementation.
- Small refactors with tests.
- Test failure repair.
- Code review against a diff.
- Contract/schema mismatch fixes.
- "Apply this exact plan to these files" work.

Codex should not own:

- Broad milestone design.
- Unclear operator intent.
- Large cross-repo archaeology.
- Private knowledge interpretation.
- Open-ended architecture judgment without a small evidence packet.

### Local Scripts Best Fit

Local scripts should own:

- File inventory.
- Schema validation.
- JSON/YAML parsing.
- grep/AST lookup.
- deterministic extraction.
- token reports.
- status consistency.
- gate statistics.

If a script can answer it, no model should be called.

## Double-Agent Executor Design

The system is not "Claude versus Codex." It is "primary doer plus lightweight challenger."

### Stage 1: Build A Task Capsule

Every execution task becomes a small JSON capsule:

```json
{
  "schema_version": 1,
  "task_id": "v2.2-p01-t03",
  "milestone": "v2.2",
  "phase": 63,
  "role": "executor",
  "goal": "Add route logging for Codex executor tasks.",
  "allowed_files": [
    "super-gsd/tools/dual-executor/router.cjs",
    "super-gsd/skills/sgsd-orchestrate/SKILL.md"
  ],
  "forbidden_files": [
    ".planning/metrics/*.jsonl"
  ],
  "inputs": [
    ".planning/milestones/v1.9/PHASE-INDEX.jsonl",
    "super-gsd/tools/dispatch-router/route.cjs"
  ],
  "acceptance": [
    "node super-gsd/tools/dual-executor/router.cjs --self-test",
    "node super-gsd/tools/dispatch-router/route.cjs --self-test"
  ],
  "max_input_tokens": 8000,
  "max_output_tokens": 2000,
  "risk": "medium",
  "requires_private_knowledge": false,
  "operator_intent_summary": "Reduce Claude execution spend by routing bounded code work to Codex."
}
```

Rules:

- No full `ROADMAP.md`.
- No full `STATE.md`.
- No full milestone folder.
- No raw repo scan unless the router grants it.
- All file reads must be justified by the capsule.

### Stage 2: Score The Work

Add a scoring layer above the existing dispatch-router:

| Signal | Meaning |
|---|---|
| `file_count` | How many files can change. |
| `line_count` | Expected diff size. |
| `has_tests` | Whether correctness is mechanically checkable. |
| `ambiguity` | Whether the goal has multiple plausible meanings. |
| `requires_private_knowledge` | Whether VTP/local memory is required. |
| `security_or_destructive_risk` | Whether human/Claude judgment is needed. |
| `context_pressure` | Whether current Claude role is over budget. |
| `codex_health` | Whether Codex can currently run. |
| `codex_timeout_history` | Whether this task shape has recently timed out. |
| `recent_rework_rate` | Whether prior routing caused fix loops. |

### Stage 3: Pick The Primary Executor

| Task shape | Primary | Challenger | Reason |
|---|---|---|---|
| deterministic extraction | local script | none | Cheapest and exact. |
| small schema/config edit | Codex | local tests | Bounded and testable. |
| small JS/PS implementation | Codex | Claude review if risk medium+ | Codex is good at scoped code edits. |
| test failure repair | Codex | local tests | Error is concrete. |
| docs synthesis | Claude | Codex nit review optional | Meaning and audience matter. |
| architecture choice | Claude | Codex or VTP challenger | Needs tradeoff reasoning. |
| broad research | local index or VTP | Claude synthesis | Avoid re-reading repo. |
| phase close verdict | Claude | status-consistency/local gates | Human-readable judgment plus mechanical checks. |
| code review | Codex | Claude only on WARN/CRIT or timeout | Codex is already review substrate. |

### Stage 4: Execute In A Sandbox

For Codex execution, do not start by letting Codex mutate the canonical worktree freely.

Recommended first implementation:

1. Create a temporary git worktree for the task.
2. Give Codex the task capsule and allowed files.
3. Run Codex in workspace-write mode inside the worktree.
4. Capture diff.
5. Reject if changed files are outside `allowed_files`.
6. Run tests.
7. Apply accepted patch to the main worktree.
8. Log token/cost/outcome.

This prevents the "wrong agent edited the wrong surface" problem and lets SGSD compare Codex output before adoption.

### Stage 5: Record The Result

Every task should append one row to a new or existing route ledger boundary:

```json
{
  "schema_version": 1,
  "boundary": "execution_route",
  "ts": "2026-04-29T16:45:00Z",
  "milestone": "v2.2",
  "phase": 63,
  "task_id": "v2.2-p63-t03",
  "role": "executor",
  "primary_provider": "codex",
  "challenger_provider": "claude",
  "chosen_reason": "bounded_code_edit_with_tests",
  "context_budget": 8000,
  "actual_input_tokens": 6200,
  "actual_output_tokens": 900,
  "files_allowed": 2,
  "files_changed": 2,
  "tests_passed": true,
  "rework_required": false,
  "defects_caught": 0,
  "fallback_used": false,
  "verdict": "accepted"
}
```

This is the key audit surface. Without it, we keep arguing from vibes. With it, SGSD can prove whether Codex, Claude, or local scripts are actually cheaper for each task family.

## Policy: Do Not Use Both Models By Default

The double-agent system should not mean "call Claude and Codex every time." That doubles spend.

Use pair review only when:

- risk is medium/high,
- code touches shared orchestration,
- security/privacy/destructive operations are involved,
- the primary executor produced a warning,
- tests fail,
- the task is a new pattern SGSD has not seen before.

For low-risk bounded work:

- Codex executes.
- Local tests verify.
- Claude only reads the summary if something fails.

For high-ambiguity work:

- Claude plans.
- Codex executes only the bounded subtask.
- Local tests verify.

## Required Changes

### 1. Add Execution Route Type

Extend the existing route ledger instead of adding a second ledger.

New boundary:

- `execution_route`

Fields:

- `task_id`
- `primary_provider`
- `challenger_provider`
- `chosen_reason`
- `actual_tokens`
- `tests_passed`
- `rework_required`
- `accepted`

### 2. Add Codex Executor Wrapper

New path:

- `super-gsd/scripts/codex-task-exec.sh` or `super-gsd/tools/codex-task-exec/run.cjs`

It must be separate from `codex-exec.sh` because `codex-exec.sh` is a read-only review contract.

Minimum contract:

- input: task capsule path
- output: patch/report path
- sandbox: git worktree
- allowed files enforced after diff
- tests run from capsule
- logs to token attribution and route ledger

### 3. Add Provider Scorecard

New report:

- `super-gsd/tools/execution-scorecard/report.cjs`

It should answer:

- Which provider handled which task families?
- Which provider produced fewer rework loops?
- Which provider timed out?
- Which provider saved Claude tokens?
- Which roles still exceed budget?

### 4. Wire Router Before Executor Dispatch

Current `sgsd-orchestrate/SKILL.md` already says to consult `routeDispatch` before agent invocation.

The missing enforcement is:

- If route says `codex` for a bounded executor task, do not spawn `gsd-executor` first.
- Build a task capsule.
- Run Codex executor.
- Only escalate to Claude executor if Codex fails, times out, or violates boundaries.

### 5. Add Cockpit Tile

The cockpit should show:

```text
EXEC ROUTE
current task: Codex executing P63 task 03
why: bounded code edit with tests
budget: 8k cap, 6.2k used
fallback: none
saved: Claude executor avoided
```

And project totals:

```text
ROUTE SAVINGS
local: 18 tasks
codex exec: 12 tasks, 2 fallback
claude exec: 9 tasks
rework: codex 1, claude 3
```

## Suggested Build Phases

### Phase A: Execution Route Ledger

Goal:

- Add `execution_route` as a first-class logged boundary.

Acceptance:

- self-test validates schema.
- route rows render in scorecard.
- no new metrics stream unless absolutely required.

### Phase B: Task Capsule Contract

Goal:

- Define and validate the execution capsule.

Acceptance:

- capsule has allowed files, tests, risk, token caps.
- context-packet builder can produce executor capsules.
- capsule rejects broad raw context.

### Phase C: Codex Executor Sandbox

Goal:

- Let Codex execute bounded tasks safely.

Acceptance:

- runs in a worktree.
- rejects out-of-scope file edits.
- emits patch/report.
- logs actual token/timeout status.

### Phase D: Orchestrator Wire-In

Goal:

- Use router decision to choose Codex/local/Claude before executor dispatch.

Acceptance:

- bounded low-risk executor task routes Codex-first.
- deterministic extraction routes local-first.
- ambiguous/high-risk still routes Claude.
- fallback continues autonomously.

### Phase E: Scorecard And Cockpit

Goal:

- Show whether routing is saving tokens and reducing rework.

Acceptance:

- per-phase, per-milestone, project totals.
- provider win/loss table.
- timeout and fallback counts.
- estimated Claude tokens avoided.

### Phase F: Benchmark Harness

Goal:

- Re-run historical task shapes through the router without changing source.

Acceptance:

- compare old Claude route vs proposed local/Codex route.
- report expected savings and risk.
- identify tasks that should remain Claude-only.

## First Practical Experiment

Pick 10 historical executor tasks:

- 4 small JS/Node edits.
- 2 PowerShell cockpit edits.
- 2 schema/config edits.
- 1 test fix.
- 1 docs-only edit.

For each:

1. Build task capsule.
2. Ask router for provider.
3. Run Codex in a worktree if routed to Codex.
4. Run tests.
5. Compare with original Claude executor output.
6. Score:
   - accepted first try?
   - files changed outside scope?
   - tests passed?
   - token cost?
   - time to complete?
   - follow-up fixes needed?

Do not enable Codex executor broadly until this benchmark proves the boundary is safe.

## Hard Rules

1. No executor gets full milestone context by default.
2. Every execution task must have a capsule.
3. Codex cannot write outside the allowed file list.
4. Local scripts beat LLMs when deterministic.
5. Claude remains the owner of ambiguous intent and final user-facing synthesis.
6. Codex execution must have a fallback path and must never halt autopilot.
7. Routing decisions are evidence, not guesses. If a route was bad, score it and update weights.
8. "Provider unavailable" can only be recorded from behavioral evidence, not inferred config.

## Bottom Line

The biggest quick win is not replacing the executor outright. It is forcing every executor dispatch through a small task capsule and then letting the router choose:

- local script for exact work,
- Codex for bounded code work,
- Claude for unclear or high-level work.

That turns SGSD from "Claude does everything and Codex reviews sometimes" into a real two-model operating system:

- Claude is the architect/operator interpreter.
- Codex is the scoped code worker and reviewer.
- Scripts are the deterministic substrate.
- The router learns from actual spend and rework.

