# SGSD Double-Agent Executor

Routes execution tasks to the cheapest competent doer:

- `local-script` for deterministic extraction/inventory.
- `codex` for bounded code edits, schema/config fixes, refactors, and test repair.
- `claude` for ambiguity, architecture, private knowledge, planning, and high-risk judgment.

This does not replace `super-gsd/scripts/codex-exec.sh`. That script is the
read-only ATC/code-review wrapper. The double-agent executor is the bounded
execution path and uses task capsules plus an optional git worktree sandbox.

## Stable Routing Contract

Routing is scored, but hard vetoes still win. This keeps the decision cheap
and auditable without letting a score override safety.

### Codex gets execution when all of these are true

- Task kind is `code_edit`, `refactor`, `test_repair`, or `schema_config`.
- Role is `executor`.
- `allowed_files` is present and has 1-6 relative paths.
- `estimated_line_count` is 400 or less.
- `risk` is not `high`.
- `ambiguity` is not `high`.
- Either `requires_private_knowledge` is `false`, or
  `context_packet.private_context_compiled === true` (Claude compiled the
  relevant private SGSD context into the capsule — see "Compiled Private
  Context Unlock" below).
- At least one `acceptance_commands` entry exists.
- Codex provider health is available.

### Claude gets execution when any of these are true

- The work is `planning` or `synthesis`.
- Risk is high.
- Ambiguity is high.
- Private/project knowledge is required.
- The task is unbounded, lacks acceptance commands, or needs judgment over
  broad roadmap/state context.

### Local script gets execution when both are true

- The task is deterministic extraction/inventory.
- A safe `local_command` is supplied in the capsule.

## Weighted Matrix

The scorer records evidence for every provider:

| Signal | Local | Codex | Claude |
|---|---:|---:|---:|
| deterministic task | +5 | 0 | 0 |
| local command available | +3 | 0 | 0 |
| extraction / inventory | +4 | 0 | 0 |
| code edit / refactor / test repair / schema config | -2 | +4 | 0 |
| review task | 0 | +3 | 0 |
| executor role | 0 | +2 | 0 |
| acceptance command available | +1 | +4 | 0 |
| 1-6 allowed files | 0 | +3 | 0 |
| estimated lines <= 400 | 0 | +2 | 0 |
| low ambiguity | 0 | +2 | 0 |
| low/medium risk | 0 | +2/+1 | 0 |
| token budget pressure | 0 | +2 | -2 |
| planning / synthesis | 0 | 0 | +5 |
| high risk | -2 | -6 | +5 |
| high ambiguity | -3 | -6 | +5 |
| private knowledge required (no compiled context) | -2 | -6 | +5 |
| private knowledge required + compiled context | -2 | +3 | +5 |
| no mechanical acceptance | 0 | -4 | +2 |
| unbounded files or large change | 0 | 0 | +2 |

Current matrix version: `execution-weighted-v1`.

## Audit Output

Every route writes one `execution_route` row to
`.planning/metrics/route-decisions.jsonl`. The row includes:

- `chosen_provider`
- `primary_provider`
- `fallback_used`
- `fallback_reason`
- `winning_reason`
- `routing_matrix_version`
- `scores`
- `vetoes`
- `score_evidence`

Provider-health failures are the only Codex fallback case. Safety vetoes
(`high_risk_requires_claude`, `private_context_not_compiled`,
`mechanical_acceptance_missing`, etc.) route directly to Claude and are not
mislabelled as Codex failures.

## Compiled Private Context Unlock

Claude is the CEO/orchestrator/context-owner. Codex is a bounded coding
executor. `requires_private_knowledge: true` no longer means "Claude forever".

The router distinguishes three cases:

- `requires_private_knowledge === true` and no `context_packet` (or
  `context_packet.private_context_compiled !== true`) → Codex is vetoed with
  `private_context_not_compiled`. Claude executes.
- `requires_private_knowledge === true` and
  `context_packet.private_context_compiled === true` → the private-context
  veto is removed. Codex score evidence picks up
  `compiled_private_context_available`. Codex may execute when the task is
  bounded, low/medium risk, low ambiguity, has acceptance tests, and Codex is
  healthy.
- `risk === 'high'` → Claude executes regardless of compiled context. The
  high-risk veto is not relaxed by this patch.

Never send Codex broad roadmap/state by default. Use `context_packet.summary`
and `context_packet.source_refs` to pass only what is needed.

### Capsule with compiled context

```json
{
  "schema_version": 1,
  "task_id": "v2.9-p106-t01",
  "milestone": "v2.9",
  "phase": 106,
  "plan": "106-01",
  "role": "executor",
  "task_kind": "code_edit",
  "goal": "Add unlock branch to double-agent router using compiled context.",
  "allowed_files": [
    "super-gsd/tools/double-agent-executor/run.cjs"
  ],
  "acceptance_commands": [
    "node super-gsd/tools/double-agent-executor/run.cjs --self-test"
  ],
  "risk": "medium",
  "ambiguity": "low",
  "requires_private_knowledge": true,
  "estimated_line_count": 80,
  "max_input_tokens": 8000,
  "max_output_tokens": 2000,
  "context_packet": {
    "compiled_by": "claude",
    "summary": "Phase 106 router unlock; isCodexBounded must accept compiled context.",
    "source_refs": [
      ".planning/briefs/2026-04-30-claude-handover-compiled-context-codex-handoff.md",
      "super-gsd/tools/double-agent-executor/task-capsule.schema.json"
    ],
    "private_context_compiled": true
  }
}
```

The route ledger row records the unlock state in `decision`:

- `context_packet_present`
- `private_context_compiled`
- `context_source_refs_count`

## Task Capsule

```json
{
  "schema_version": 1,
  "task_id": "v2.2-p63-t03",
  "milestone": "v2.2",
  "phase": 63,
  "role": "executor",
  "task_kind": "code_edit",
  "goal": "Add execution-route scorecard aggregation.",
  "allowed_files": [
    "super-gsd/tools/double-agent-executor/scorecard.cjs"
  ],
  "acceptance_commands": [
    "node super-gsd/tools/double-agent-executor/scorecard.cjs --self-test"
  ],
  "risk": "medium",
  "ambiguity": "low",
  "requires_private_knowledge": false,
  "estimated_line_count": 120,
  "max_input_tokens": 8000,
  "max_output_tokens": 2000
}
```

## Commands

```powershell
node super-gsd/tools/double-agent-executor/run.cjs --self-test
node super-gsd/tools/double-agent-executor/scorecard.cjs --self-test
node super-gsd/tools/double-agent-executor/run.cjs --capsule .planning/tasks/example.json --route-only --json
node super-gsd/tools/double-agent-executor/scorecard.cjs --json
```

Live Codex execution is explicit:

```powershell
node super-gsd/tools/double-agent-executor/run.cjs --capsule .planning/tasks/example.json --execute
```

By default, Codex execution writes a patch/report artifact and does not apply
the patch to the main worktree. Add `--apply` only when the caller wants the
accepted patch applied after scope and acceptance checks pass.
