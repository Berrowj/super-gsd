# SGSD Double-Agent Executor

Routes execution tasks to the cheapest competent doer:

- `local-script` for deterministic extraction/inventory.
- `codex` for bounded code edits, schema/config fixes, refactors, and test repair.
- `claude` for ambiguity, architecture, private knowledge, planning, and high-risk judgment.

This does not replace `super-gsd/scripts/codex-exec.sh`. That script is the
read-only ATC/code-review wrapper. The double-agent executor is the bounded
execution path and uses task capsules plus an optional git worktree sandbox.

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

