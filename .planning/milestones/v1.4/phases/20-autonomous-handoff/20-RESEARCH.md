# Phase 20: Autonomous Session Handoff — Research

**Researched:** 2026-04-24
**Mode:** Focused validation + CLI discovery (no external research)

---

## Validation Results (7 claims checked)

| # | Claim | Status | Evidence |
|---|-------|--------|----------|
| V1 | `claude --print` is valid non-interactive flag | PASS | `claude --help` confirms `-p/--print`: "Print response and exit (useful for pipes)" |
| V2 | `CLAUDE_SESSION_ID` set by Claude Code in hook context | FAIL | `printenv` shows `CLAUDECODE=1` but `CLAUDE_SESSION_ID=UNSET` — not injected in Bash/hook subprocess env |
| V3 | Stop hook timeout of 60s is realistic | PASS | `settings-overlay.json` PreToolUse hooks all use 2-3s; Stop hook at 60s is safe upper bound per D-02 |
| V4 | `emergency_halt` + `phase_state` + `next_unit` fields exist in checkpoint schema | PASS | Phase 17 halt commit (1936afb) confirmed all 3 fields present |
| V5 | `gsd-session-start.js` is the right hook to extend for to_session_id lineage | PARTIAL | File exists at `super-gsd/hooks/gsd-session-start.js` but uses `toUnixPath(process.cwd())` — wrong on Windows Node; path bug present (produces `/mnt/c/...` on native Node). Phase 20 extension must use `path.join(process.cwd(), ...)` directly (same fix as activity-logger line 88) |
| V6 | `.planning/config.json` is writable, has `review_providers` block | PASS | File confirmed at expected path, `review_providers` block present from Phase 17 |
| V7 | No existing operator-vs-handoff session detection | PASS | Confirmed absent — net-new in Phase 20 |

---

## Critical Unknowns Resolved

### Unknown 1: Claude CLI spawn form
**Resolved: `claude --print "/sgsd-orchestrate go"`**

`claude --help` output:
- `-p, --print` confirmed: "Print response and exit (useful for pipes). Note: The workspace trust dialog is skipped when Claude is run with -p mode."
- Additional useful flags for handoff spawn:
  - `--dangerously-skip-permissions` / `--permission-mode bypassPermissions` — auto mode needs this
  - `--model <alias>` — can route to sonnet for handoff sessions
  - `--no-session-persistence` — optional, avoids polluting resume list
  - `--bare` — strips hooks/CLAUDE.md discovery (NOT appropriate — handoff needs hooks active)

**Recommended spawn command for D-02/D-04:**
```bash
claude --print --dangerously-skip-permissions "/sgsd-orchestrate go"
```

D-04 `spawn_args` in CONTEXT.md needs update: `["--print", "--dangerously-skip-permissions", "/sgsd-orchestrate go"]`

### Unknown 2: CLAUDE_SESSION_ID availability
**Resolved: NOT set in hook subprocess environment.**

`printenv` shows `CLAUDECODE=1`, `CLAUDE_CODE_ENTRYPOINT=cli`, `CLAUDE_CODE_EXECPATH=...` but no `CLAUDE_SESSION_ID`. The var is set *within* the Claude process context, not propagated to child processes/hooks.

**Fallback for D-05:** Use `$$` (PID of the spawning shell) as `from_session_id` in the Stop hook. The `to_session_id` written by `gsd-session-start.js` can use the same PID fallback. This weakens lineage tracing but satisfies HANDOFF-03 AC functionally.

---

## Gaps Found (CONTEXT corrections)

1. **D-04 `spawn_args`** — `["--print", "/sgsd-orchestrate go"]` is missing `--dangerously-skip-permissions`; without it the spawned session will prompt for permissions and hang.
2. **D-05 `CLAUDE_SESSION_ID`** — fallback must be PID (`$$`), not a UUID generator (no stdlib uuid in bash without uuidgen, which may be absent on Windows).
3. **`gsd-session-start.js` path bug** — `toUnixPath(process.cwd())` on Windows Node produces `/mnt/c/...` paths that don't resolve. Phase 20 extension must use native `path.join(process.cwd(), ...)`.
4. **Stop hook not yet in `settings-overlay.json`** — no `Stop` key present; Phase 20 adds it. Pattern matches existing `PreToolUse` hook structure exactly.

---

## Planner Guidance

- **Permissions flag is blocking.** Spawned session without `--dangerously-skip-permissions` will pause at the permissions prompt — handoff hangs forever. Add this flag to D-04 spawn_args.
- **Stop hook fires on ALL session ends**, not just emergency halts. The `emergency_halt: true` pre-condition check in the script is the primary guard — get this right first.
- **60s timeout is the Claude Code hard cap for Stop hooks.** The spawn itself must be fire-and-forget (background `&`) — do NOT wait for the child session to complete inside the Stop hook. Log spawn PID, exit 0.
- **`--print` sessions run headless.** No interactive prompts accepted. Test `--dry-run` path must NOT invoke `claude --print` (would attempt real API call).
- **Windows path caution:** `gsd-session-start.js` extension for to_session_id must use `path.join(process.cwd(), '.planning', ...)` not `toUnixPath(...)`.
- **Race: two codex-exec writes to narrative.md.** Phase 19 deferred this. If a handoff chain reaches the Phase 19 narrative window, writes can collide. No fix required in Phase 20 — just document in smoke test that concurrent narrative writes are a known deferred risk.
- **Operator-abort file (`.planning/STOP-HANDOFF`)** — check must happen BEFORE cooldown and chain-depth checks (fail fast, cheap check first).
- **Chain-depth reset:** operator-driven start detected by absence of `from_session_id` in latest handoff-log row — that's the cleanest heuristic available given CLAUDE_SESSION_ID unavailability.

---

## Per-HANDOFF Commit Hints

- `feat(20-01/T1): HANDOFF-01 sgsd-stop-handoff.sh + Stop hook wiring` — new script + settings-overlay.json Stop entry
- `feat(20-02/T1): HANDOFF-02 safety rails + config.json handoff block` — cooldown, max-depth, abort-file, dry-run flag
- `feat(20-03/T1): HANDOFF-03 handoff-log + MC tile + token-audit check` — telemetry + mission-control extension
