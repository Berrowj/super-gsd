# Claude Handover - Double-Agent Executor Routing + Codex Blue

Use this when resuming SGSD after the double-agent routing and cockpit colour updates.

## Operator Intent

The operator wants SGSD to route execution work intelligently between Claude,
Codex, and local scripts, then show the chosen executor clearly in the cockpit.

The rule is:

```text
Claude decides what matters.
Codex does bounded implementation.
Local scripts do deterministic work.
```

The cockpit colour convention is:

```text
Codex       = blue
Claude      = yellow/orange
Local script = green
MCP/VTP/skills = cyan
```

Important limitation: Claude Code's own transcript badge colour is not controlled
by SGSD. SGSD can only colour its own cockpit/narrative/tool-stream renderers.

## Files Changed

- `super-gsd/tools/double-agent-executor/run.cjs`
- `super-gsd/tools/double-agent-executor/README.md`
- `super-gsd/scripts/lib/sgsd-cockpit-shell.cjs`
- `super-gsd/scripts/sgsd-mission-control.ps1`
- `super-gsd/scripts/sgsd-narrative.ps1`
- `super-gsd/scripts/lib/sgsd-codex-status.ps1`
- `super-gsd/tests/cockpit-regression/check.cjs`

## Execution Routing Contract

Before every `gsd-executor` dispatch, the orchestrator must build a task capsule
and run the double-agent executor route decision.

The orchestrator step is:

```text
sgsd-orchestrate Step 7.6 - DOUBLE-AGENT EXECUTOR ROUTE
```

Expected flow:

```text
phase needs executor work
  -> build task capsule
  -> run double-agent-executor route
  -> local-script / Codex / Claude executes
  -> route-decisions.jsonl gets an execution_route row
  -> cockpit shows EXECUTOR and WHY
```

Do not bypass Step 7.6 for executor work. If an executor agent is launched
without a matching `execution_route` row, the cockpit cannot explain who is
executing or why.

## Task Capsule Shape

Minimum capsule:

```json
{
  "schema_version": 1,
  "task_id": "vX-pNN-tMM",
  "milestone": "vX",
  "phase": 90,
  "plan": "90-01",
  "role": "executor",
  "task_kind": "code_edit",
  "goal": "One clear sentence.",
  "allowed_files": [
    "relative/path.ext"
  ],
  "forbidden_files": [],
  "acceptance_commands": [
    "node path/to/test.cjs --self-test"
  ],
  "risk": "low",
  "ambiguity": "low",
  "requires_private_knowledge": false,
  "estimated_line_count": 120,
  "max_input_tokens": 8000,
  "max_output_tokens": 2000
}
```

Route command:

```powershell
node super-gsd/tools/double-agent-executor/run.cjs --capsule .planning/tasks/example.json --route-only --json
```

Codex execution command:

```powershell
node super-gsd/tools/double-agent-executor/run.cjs --capsule .planning/tasks/example.json --execute
```

By default Codex writes a patch/report artifact. It does not apply to the main
worktree unless `--apply` is explicitly passed.

## Weighted Routing Matrix

Matrix version:

```text
execution-weighted-v1
```

Codex gets execution only when all of these hold:

- task kind is `code_edit`, `refactor`, `test_repair`, or `schema_config`
- role is `executor`
- `allowed_files` has 1-6 relative paths
- `estimated_line_count` is 400 or less
- risk is not `high`
- ambiguity is not `high`
- `requires_private_knowledge` is `false`
- at least one acceptance command exists
- Codex provider health is available

Claude gets execution when any of these hold:

- planning or synthesis
- high risk
- high ambiguity
- private/project knowledge required
- no mechanical test contract
- broad roadmap/state/context judgment is needed
- task is unbounded

Local script gets execution when:

- deterministic extraction/inventory work
- a safe `local_command` is supplied

## Hard Vetoes

Scores never override hard vetoes.

Codex vetoes include:

- `high_risk_requires_claude`
- `high_ambiguity_requires_claude`
- `private_context_not_compiled` (replaces the legacy
  `private_knowledge_requires_claude`; only fires when
  `requires_private_knowledge === true` AND
  `context_packet.private_context_compiled !== true`)
- `mechanical_acceptance_missing`
- `allowed_files_missing`
- `allowed_files_over_limit`
- `estimated_line_count_over_limit`
- `codex_provider_unhealthy`

Only `codex_provider_unhealthy` is treated as a Codex provider fallback.
Safety vetoes route directly to Claude and must not be described as "Codex
failed".

## Compiled Private Context Unlock

Claude remains CEO/orchestrator/context-owner. Codex may implement bounded
coding tasks when Claude has compiled the relevant private SGSD context into
the capsule.

The capsule shape adds an optional `context_packet`:

```json
{
  "context_packet": {
    "compiled_by": "claude",
    "summary": "Short relevant context Codex needs.",
    "source_refs": [
      "relative/path/to/source.md",
      "relative/path/to/source.cjs"
    ],
    "private_context_compiled": true
  }
}
```

Routing distinction:

- `requires_private_knowledge === true` and not compiled → Codex is vetoed with
  `private_context_not_compiled`; Claude executes.
- `requires_private_knowledge === true` and
  `context_packet.private_context_compiled === true` → the private-context
  veto is removed. Codex score evidence adds
  `compiled_private_context_available` (+3). Codex can win when the task is
  bounded, low/medium risk, low ambiguity, tests are present, and Codex is
  healthy.
- `risk === 'high'` still routes to Claude regardless of compiled context.
  This patch does not relax high-risk routing.

Operational rules:

- Never send Codex broad roadmap/state by default.
- Pass only what Codex needs via `context_packet.summary` and
  `context_packet.source_refs`.
- The route-ledger `decision` block records `context_packet_present`,
  `private_context_compiled`, and `context_source_refs_count` so the cockpit
  and post-hoc audits can prove which Codex tasks ran on compiled context.

## Route Ledger Output

Each route writes one `.planning/metrics/route-decisions.jsonl` row with:

- `boundary: "execution_route"`
- `decision.chosen_provider`
- `decision.primary_provider`
- `decision.fallback_used`
- `decision.fallback_reason`
- `decision.winning_reason`
- `decision.routing_matrix_version`
- `decision.scores`
- `decision.vetoes`
- `decision.score_evidence`

This is what the cockpit uses for:

```text
EXECUTOR <provider> ...
WHY <route explanation> ...
```

## Cockpit Colour Scheme

SGSD renderer changes:

- Codex provider rows are blue.
- Codex live tool-stream rows are blue.
- Codex shared timeline rows from `sgsd-codex-status.ps1` are blue.
- Claude remains yellow/orange.
- Local script remains green.

If the operator points at an orange `gsd-executor` badge inside the Claude Code
chat transcript, that is Claude Code UI, not SGSD cockpit output. Do not claim
SGSD can recolour that badge unless Warp/Claude exposes a renderer hook.

## Verification Commands

Run these after edits:

```powershell
cd "C:\Users\jack.berrow\GSDedits"

node --check super-gsd/tools/double-agent-executor/run.cjs
node super-gsd/tools/double-agent-executor/run.cjs --self-test
node super-gsd/tools/double-agent-executor/scorecard.cjs --self-test
node super-gsd/scripts/lib/route-ledger.test.cjs

$errs=$null
[System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw super-gsd/scripts/sgsd-narrative.ps1), [ref]$errs) > $null
if($errs -and $errs.Count){ $errs | ForEach-Object { $_.Message }; exit 1 } else { "narrative parse OK" }

$errs=$null
[System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw super-gsd/scripts/sgsd-mission-control.ps1), [ref]$errs) > $null
if($errs -and $errs.Count){ $errs | ForEach-Object { $_.Message }; exit 1 } else { "mission-control parse OK" }

$errs=$null
[System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw super-gsd/scripts/lib/sgsd-codex-status.ps1), [ref]$errs) > $null
if($errs -and $errs.Count){ $errs | ForEach-Object { $_.Message }; exit 1 } else { "codex-status parse OK" }

node super-gsd/scripts/lib/sgsd-cockpit-shell.cjs --self-test
node super-gsd/tests/cockpit-regression/check.cjs
```

Expected:

```text
double-agent-executor self-test: 15 pass, 0 fail
double-agent-scorecard self-test: 6 pass, 0 fail
route-ledger fallback test: 26 pass, 0 fail
narrative parse OK
mission-control parse OK
codex-status parse OK
selfTest: 8/8 pass
cockpit-regression: 12 pass, 0 fail
```

## Resume Instruction For Claude

Copy/paste this into Claude if needed:

```text
Read this handover first:
C:\Users\jack.berrow\GSDedits\.planning\briefs\2026-04-30-claude-handover-double-agent-routing-and-codex-blue.md

Then resume SGSD normally. For every future gsd-executor dispatch, use Step 7.6:
build a task capsule, run double-agent-executor route-only, obey the selected
provider, and ensure an execution_route row is logged. Do not send Codex broad
roadmap/state context. Codex gets bounded tested edits; Claude keeps judgment,
private context, high-risk, and ambiguous work. In cockpit output, Codex should
render blue, Claude yellow/orange, local script green.
```
