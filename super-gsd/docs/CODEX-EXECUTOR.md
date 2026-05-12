# Codex as Executor

Codex (gpt-5.5/xhigh) is the current SGSD delivery worker. SGSD uses
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
| Sandbox | `read-only` | `workspace-write` (via `--full-auto`) |
| Output contract | 5 fields, parsed | Free-form stdout, written verbatim |
| Default timeout | 30s (review tier) | 1200s (20 min, executor tier) |
| Log file | `codex-log.jsonl` | `codex-executor-log.jsonl` |
| Exit code 6 (contract violation) | Yes | N/A |

Both wrappers share: OAuth-only auth, GNU timeout wrapper, JSONL logging,
WSL/Windows path translation, exit codes 3 (no PATH) / 4 (auth) / 5
(timeout). `codex-executor.sh` exits 8 when a Windows file-read block is
detected and no `--patch-fallback-files` allowlist was supplied.

`codex-patch-executor.sh` is the executor fallback for Windows hosts where the
Codex CLI cannot read files (`CreateProcessAsUserW=216` / `error 216`). This
detection checks stdout/report text as well as non-zero failures because Codex
can return exit 0 while putting the read-block in the report body. SGSD builds a
bounded allowlisted read-pack, Codex authors a unified diff, and SGSD
validates/applies that diff locally. This is still a Codex-authored code path;
Claude may assemble the read-pack and apply the patch, but Claude does not
write the code delta.

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

Now the orchestrator must:

1. Write the executor prompt to `{phaseDir}/{planId}-CODEX-EXECUTOR-PROMPT.md`
2. Write `{planId}-CODEX-FILES.txt` with one repo-relative allowed path per
   line, then invoke `codex-executor.sh` via Bash with
   `--patch-fallback-files {planId}-CODEX-FILES.txt`
3. Read `{phaseDir}/{planId}-CODEX-EXECUTOR-REPORT.md`
4. Process that report through the normal Step 9 and Step 9.5 commit/gate path

There is no Claude executor fallback. If direct Codex fails because Windows
blocks file reads, `codex-executor.sh` routes to `codex-patch-executor.sh`
before any blocker checkpoint. If direct Codex and patch-mode Codex both fail,
the orchestrator runs the board + separate Codex blocker-recovery challenge.

## Config schema

Optional visible project hint:

```json
{
  "review_providers": {
    "executor_provider": "codex",
    "codex_executor_model": "gpt-5.5",
    "codex_executor_reasoning_effort": "xhigh"
  }
}
```

`executor_provider` is retained only as a visible project hint. The wrapper does
not read model/effort overrides. Executor runtime is pinned to:

- model: `gpt-5.5`
- reasoning effort: `xhigh`

## Live monitoring (operator-side)

While Codex executes, its stdout/stderr is `tee`'d to:

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

The raw tail follows the combined live file forever. While Codex is running, you'll see its tool
calls / reasoning / file edits stream in real time. Between sessions the
file holds the last codex run's output. Press `Ctrl+C` to exit the tail.

POSIX equivalent (Git Bash / WSL):

```bash
tail -F project-clarity-erp/.planning/metrics/codex-live-output.txt
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
