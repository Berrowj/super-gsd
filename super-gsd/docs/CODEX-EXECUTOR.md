# Codex as Executor

Codex (gpt-5.5) can do open-ended code execution work as an alternative to
Claude Sonnet. Until now, SGSD's Codex usage was reviewer-only (per-dispatch
ATC, phase-level ATC, MUDA audits — see `.planning/metrics/codex-log.jsonl`).
This doc describes the **executor** path: Codex edits files, runs commands,
commits work, and returns a free-form report.

## Why a separate wrapper

`codex-exec.sh` is locked to the **code-reviewer-v1** contract (5 fields:
FINDINGS / CRITICAL / WARNINGS / PASS_RATE / ONE_LINER). Executor work is
open-ended — Codex makes file changes and writes a free-form description,
not a structured review verdict.

`codex-executor.sh` is the sibling wrapper for executor work:

| | `codex-exec.sh` (reviewer) | `codex-executor.sh` (executor) |
|---|---|---|
| Sandbox | `read-only` | `workspace-write` (via `--full-auto`) |
| Output contract | 5 fields, parsed | Free-form stdout, written verbatim |
| Default timeout | 30s (review tier) | 1200s (20 min, executor tier) |
| Log file | `codex-log.jsonl` | `codex-executor-log.jsonl` |
| Exit code 6 (contract violation) | Yes | N/A |

Both wrappers share: OAuth-only auth, GNU timeout wrapper, JSONL logging,
WSL/Windows path translation, exit codes 3 (no PATH) / 4 (auth) / 5 (timeout).

## Manual usage

Operator-side invocation, e.g. for ad-hoc executor work:

```bash
echo "Refactor app/services/foo.py to extract the validation logic into a
separate module. Run pytest after. Commit each change atomically." | \
  super-gsd/scripts/codex-executor.sh \
    --prompt-file /dev/stdin \
    --report-out  .planning/phases/153-gate-engine-runtime/codex-foo-report.md \
    --workspace   "$PWD" \
    --phase 153 --plan 153-04
```

Codex will:
1. Read the prompt
2. Edit files in `--workspace`
3. Run any commands it needs (`pytest`, `git`, etc.)
4. Write a free-form report to `--report-out` (its stdout)
5. JSONL-log to `.planning/metrics/codex-executor-log.jsonl`

## Orchestrator integration (future phase)

Today the SGSD orchestrator dispatches executor work via:
```
Agent(subagent_type: "gsd-executor", model: "sonnet", ...)
```

To route to Codex instead, the orchestrator needs to:

1. Read `.planning/config.json → review_providers.executor_provider`
2. If `"codex"`: invoke via Bash (`codex-executor.sh ...`), then read the
   report file
3. If `"claude"` (default): existing Agent() path

That routing change is a real modification to `super-gsd/skills/sgsd-orchestrate/SKILL.md`
and is scheduled as its own phase. Until then, operators can manually invoke
`codex-executor.sh` for individual executor dispatches as shown above.

## Config schema

Add to `.planning/config.json` to pin Codex executor settings (defaults shown):

```json
{
  "review_providers": {
    "executor_provider": "claude",
    "codex_executor_model": "gpt-5.5",
    "codex_executor_reasoning_effort": "xhigh"
  }
}
```

Set `executor_provider: "codex"` once the SKILL.md routing change ships.
The `codex_executor_*` overrides are read by the wrapper today and let you
A/B different reasoning levels (`low` / `medium` / `high` / `xhigh`).

## Live monitoring (operator-side)

While Codex executes, its stdout is `tee`'d to a stable per-project file at
`.planning/metrics/codex-executor-live.txt`. The wrapper writes a START
banner, lets codex output flow through, then writes an END banner with exit
code + duration. The file is overwritten each invocation so a single pane
can follow every codex executor session.

Open a separate PowerShell pane (or new Warp tab) cd'd into the project
root and run:

```powershell
Get-Content -Wait C:\Users\jack.berrow\project-clarity-erp\.planning\metrics\codex-executor-live.txt
```

That tails the file forever. While codex is running, you'll see its tool
calls / reasoning / file edits stream in real time. Between sessions the
file holds the last codex run's output. Press `Ctrl+C` to exit the tail.

POSIX equivalent (Git Bash / WSL):

```bash
tail -F project-clarity-erp/.planning/metrics/codex-executor-live.txt
```

The orchestrator (Claude Code) sees no streaming output — the `Bash()` call
to `codex-executor.sh` blocks until codex finishes — so the tail pane is
the only way to watch progress in real time. After completion the full
output is also persisted to the per-plan `--report-out` file.

## Telemetry

Each invocation appends one row to `.planning/metrics/codex-executor-log.jsonl`:

```json
{
  "ts": "2026-05-04T...",
  "phase": 153,
  "plan": "153-04",
  "role": "executor",
  "model": "gpt-5.5",
  "reasoning_effort": "xhigh",
  "exit": 0,
  "duration_ms": 312804,
  "prompt_bytes": 1842,
  "report_bytes": 23415,
  "timeout_hit": false,
  "stderr_preview": ""
}
```

Cockpit's RECENT CODEX SESSIONS panel currently reads from
`commit-reviews.jsonl` (reviewer verdicts). Adding executor sessions to that
panel is part of the same future phase as the SKILL.md routing change.

## Smoke test

Validate the wrapper end-to-end without burning real tokens:

```bash
echo "Reply with exactly the four characters: pong" | \
  super-gsd/scripts/codex-executor.sh \
    --prompt-file /dev/stdin \
    --report-out  /tmp/codex-executor-smoke.txt \
    --workspace   "$PWD" \
    --timeout 60

cat /tmp/codex-executor-smoke.txt   # should contain "pong"
tail -1 .planning/metrics/codex-executor-log.jsonl  # JSONL row
```
