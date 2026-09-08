# Codex as Executor

Codex is the SGSD delivery worker; the default executor profile is gpt-5.6-sol/xhigh. SGSD uses
Claude/Opus for orchestration only; Codex owns phase research, planning,
plan-check, source-changing execution, verification, and gates. Claude/Sonnet is
not a default fresh-clone provider or fallback. This doc describes the
**executor** path: Codex edits files, runs commands, commits work, and returns a
free-form report.

## Why a separate wrapper

`codex-exec.sh` is locked to the **code-reviewer-v1** contract (5 fields:
FINDINGS / CRITICAL / WARNINGS / PASS_RATE / ONE_LINER). Executor work is
open-ended — Codex makes file changes and writes a free-form description,
not a structured review verdict.

`codex-executor.sh` is the sibling wrapper for executor work:

| | `codex-exec.sh` (reviewer) | `codex-executor.sh` (executor) |
|---|---|---|
| OS access | `danger-full-access`, approval `never` | `danger-full-access`, approval `never` |
| Output contract | 5 fields, parsed | Free-form stdout, written verbatim |
| Default timeout | 30s (review tier) | 1200s (20 min, executor tier) |
| Log file | `codex-log.jsonl` | `codex-executor-log.jsonl` |
| Exit code 6 (contract violation) | Yes | N/A |

Both wrappers use the retained two-way App Server worker adapter, OAuth-only
authentication, bounded deadlines and existing report/gate logging. Exit 3
means missing runtime or unsupported Windows interop; 4 means authentication
denied and 5 means timeout. Windows interop cannot fall back to one-shot work.
Prompt opening and reading are bounded too. An outer watchdog gives the adapter
three seconds beyond the configured deadline for cleanup, then terminates its
process group with a two-second grace before forced cleanup. Incomplete input
does not dispatch a worker or produce a successful wrapper receipt.

Review and board roles retain advisory no-edit instructions. Those instructions
are workflow boundaries; full OS access exposes anything the launching account
can access. Allowed-file, plan, validation and release gates still apply.

`codex-patch-executor.sh` remains an explicit read-pack mode: SGSD supplies
allowlisted file content, Codex returns a unified diff through the same worker
adapter, and the wrapper validates/applies it. Missing context can be answered
through the worker inbox. The executor does not launch a replacement worker
automatically after a file-read error; exit 8 requires explicit recovery. The
legacy `--patch-fallback-files` flag is accepted for caller compatibility only.

Patch mode applies with `git apply --recount --check` followed by
`git apply --recount`. The recount is intentional: Codex sometimes emits
correct diff content with stale hunk counts. If either command fails, the
wrapper exits non-zero and does not append `SGSD_PATCH_APPLY: success`.

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

## Orchestrator integration

This SGSD install is hardwired so Claude/Opus orchestrates only and all
code-mutating executor work runs through `codex-executor.sh`.

The orchestrator must:

1. Write the active plan's bounded executor prompt and choose a unique report path.
2. Launch `codex-executor.sh` in the background with `--workspace`, `--owner`,
   `--phase`, `--plan` and `--step` metadata.
3. Poll the project's worker inbox using `tools/codex-worker/control.cjs status`.
   Reply to the exact worker/request from authorized task context; escalate
   operator-only choices. Check the reply receipt and keep supervising the same
   active turn. Steering and interruption also target that worker and turn.
4. Await wrapper completion, read the final report and run the normal Step 9 and
   Step 9.5 commit/gate path. An answered question does not count as completion.

Every orchestration unit can supervise its own workers; no second Fable starts
automatically. Set `SGSD_WORKER_RESUME_ID` only for explicit resume of a recorded
thread. The mailbox belongs to the supervising project while the work directory
can be contained within it or a verified linked git worktree. Worker metadata
survives double-agent worktree cleanup. Resuming work from a removed worktree
requires an existing verified workspace.

Lost process handles can be recovered through the worker's `wrapper-result.json`:
match the worker/project/attempt, require `exit_code: 0`, then verify the report
path, `sha256` and `bytes` before applying report gates. A completed turn without
that receipt is not accepted wrapper completion. Receipt persistence failure
returns exit 9 and cannot print an OK result.

## Config schema

Optional visible project hint:

```json
{
  "review_providers": {
    "executor_provider": "codex",
    "codex_executor_model": "gpt-5.6-sol",
    "codex_executor_reasoning_effort": "xhigh"
  }
}
```

`executor_provider` is a visible project hint. Runtime model/effort come from the
CLI profile resolver and its existing project override rules; the default is
`gpt-5.6-sol` / `xhigh`. The worker transport preserves the resolved choices.

## Live monitoring (operator-side)

The adapter status and final report are forwarded to the existing live files:

- `.planning/metrics/codex-executor-live.txt` for cockpit executor status.
- `.planning/metrics/codex-live-output.txt` for the dedicated operator tail.

Codex gate/review checks also append stdout/stderr to
`.planning/metrics/codex-live-output.txt`, so one PowerShell window follows
both executor work and gate checking.

`sg` opens a separate Codex watch window by default. That window is split into
the raw Codex stream and a Claude Haiku ELI5 narrator. The narrator reads the
combined live file and asks Haiku for a bounded summary with boxed
architecture-style ASCII diagrams. The narrator renderer centers the summary as
a readable column and wraps prose to the current pane width so long filenames,
risks, and next-action lines remain visible instead of disappearing off the
right edge. By default, narration refreshes every 60 seconds over the last 6000
characters of Codex output to keep token spend and visual churn under control.
The prompt includes the active SGSD phase/plan context and requires a `PHASE
WHY` section, so summaries explain how a test, hook, or module affects the Quote
Trust Engine rather than only describing the file edit.

Open the same narrated view manually from any SGSD project tab:

```powershell
sgsd-watch-codex -Narrate
```

Open it in a separate PowerShell window:

```powershell
sgsd-watch-codex -OpenWindow -Narrate
```

Raw tail mode remains available:

```powershell
sgsd-watch-codex
```

The tail follows wrapper status and completed reports. Raw App Server events,
reasoning and tool payloads are not persisted. Poll the worker mailbox for active
questions and control receipts. Press `Ctrl+C` to exit the tail.

POSIX equivalent (Git Bash / WSL):

```bash
tail -F project-clarity-erp/.planning/metrics/codex-live-output.txt
```

Keep the wrapper running in the background so the supervising unit can answer
questions during its turn. After successful completion the final report is
persisted to the per-plan `--report-out` file.

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

Validate with local process fixtures without provider calls:

```bash
node --test super-gsd/tests/codex-worker/launch.test.cjs
node --test super-gsd/tests/codex-worker/install.test.cjs
```

The installer test uses a disposable home and project. Run Bash tests under
native Linux or WSL. The fixtures exercise real worker processes and report
validators; live provider access is a separate validation step.
