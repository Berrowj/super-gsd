# Phase Brief — Live Tab-Title Watcher

Date: 2026-04-30
Project: C:\Users\jack.berrow\GSDedits
Status: DRAFT — not yet inserted into a roadmap. Operator decides placement (next v2.10 inception phase OR insert as 87.x / 105.x).

## Goal

Each Warp tab launched via an SGSD launch configuration shows a live, role-aware title that refreshes every 120 seconds with the current SGSD state — so the sidebar tells the operator which tab is on which phase / branch / verdict without opening the cockpit window.

## Background

Phase shipped immediately before this brief: static color + emoji pass on the 8 launch configs in `~/.warp/launch_configurations/` (commit forthcoming). Each tab now has a fixed `color:` and emoji prefix in `title:` — purple/🤖 for operator, orange/📊 for cockpit, green/🧪 for codex, red/🔧 for debug, etc. That solves "which tab is which role" but the title text remains static after launch.

The operator wants one more lever: a 120s background watcher that rewrites the tab title with current STATE.md frontmatter (active milestone + phase + verdict) and current git branch. So `🤖 SGSD Main` becomes `🤖 Claude — v2.9 P98 ●auto` and updates as the loop advances.

## Design

### Component 1 — `super-gsd/scripts/lib/sgsd-tab-watcher.ps1`

Single PowerShell script (~30 lines, no dependencies). Signature:

```powershell
sgsd-tab-watcher.ps1 -Role <claude|codex|cockpit|review|debug|post-mortem|remote-monitor|token-audit> [-IntervalSeconds 120] [-ProjectDir <path>]
```

Behavior on each tick:

1. Read `.planning/STATE.md` frontmatter (offset 0, limit 30) — extract `milestone`, `current_phase` or active phase from progress block, latest verdict.
2. Run `git -C <project> rev-parse --abbrev-ref HEAD` — branch name.
3. Compose title per `-Role`:
   - `claude` → `🤖 Claude — {milestone} {phase} {state-glyph}`
   - `codex` → `🧪 Codex — {last-verdict} @ {short-sha}`
   - `cockpit` → `📊 Cockpit — {milestone} {phase}`
   - `review` → `🔍 Review — {branch}`
   - `debug` → `🔧 Debug — {phase} {checkpoint?}`
   - `post-mortem` → `📋 Post-Mortem — {branch}`
   - `remote-monitor` → `🛰 Remote — {milestone} {phase}`
   - `token-audit` → `💰 Tokens — {today-spend?}`
4. Emit `[Console]::Write("`e]0;<title>`a")` — OSC 0 set window/icon name. Atomic single write.
5. Sleep `IntervalSeconds`. Loop forever.

State glyphs (claude only): `●auto` `⏳ booting` `✓ PASS` `✗ FAIL` `⏸ paused` derived from STATE.md `last_activity` + presence of `ORCHESTRATOR-CHECKPOINT.md`.

Total dependencies: zero. Pure PowerShell stdlib.

### Component 2 — Integration into 8 launch configs

Wrap each launch config's main `exec:` line so the watcher runs as a `Start-ThreadJob` in the same PowerShell process as the foreground command. Pattern:

```yaml
- exec: |
    powershell -NoExit -Command "
      Start-ThreadJob -ScriptBlock {
        & '{{project_dir}}\super-gsd\scripts\lib\sgsd-tab-watcher.ps1' -Role 'claude' -ProjectDir '{{project_dir}}'
      } | Out-Null
      . `$PROFILE
      sg -Go -ProjectDir '{{project_dir}}'
    "
```

Why `Start-ThreadJob` (not `Start-Job`):
- Runs in the same process — shares the ConPTY stdout handle so `[Console]::Write` reaches the parent Warp tab's terminal.
- `Start-Job` spawns a child process with its own console; OSC writes wouldn't reach Warp.
- `ThreadJob` module ships with PowerShell 5.1+ — already available on the operator's machine.

Tabs that are pure shell (no foreground long-running command, e.g. `🤖 Shell` in operator-workspace) get a one-shot title set on launch but no watcher — adding a thread there serves no purpose since the tab title only matters for tabs with active work.

### Component 3 — `super-gsd/scripts/lib/sgsd-tab-watcher.test.ps1`

Self-test (≥10 assertions):
- Title compose function returns expected string for each role
- STATE.md missing → fallback title (no crash)
- git not on a branch (detached HEAD) → handled
- Emoji preserved through OSC encoding
- IntervalSeconds bounds (60–600) enforced
- Role validation (unknown role → exit 1 with message)
- Project dir resolution (absolute / relative / missing)
- ConPTY availability check (skip on bare console)
- Single-tick mode (`-Once` flag) for testability
- Idle no-op if STATE.md unchanged (skip redundant writes)

## Scope

In scope:
- 1 watcher script + 1 self-test script
- Wire into the 6 launch configs that have a long-running foreground command (cockpit-only, codex-watch, debug, operator-workspace SGSD-Main tab only, post-mortem, remote-monitor)
- Skip wiring on review + token-audit tabs — they're one-shot panes; static title is correct
- Document the OSC + ThreadJob pattern in `super-gsd/scripts/lib/README.md`

Out of scope:
- Sub-second updates (covered by separate file-watcher proposal if ever needed)
- Cross-tab coordination (each tab is independent)
- Tab title for cockpit dashboard panes within a workspace — only the parent tab gets its title set, not individual panes
- Color updates at runtime — color stays whatever the launch config declared; watcher only touches title text

## Risk / Open Questions

1. **OSC interleaving with foreground stdout.** When Claude writes to the same TTY as the watcher, byte streams could interleave. OSC 0 is short enough (typically <100 bytes) that this is rare in practice — but if observed, mitigation is a mutex around the Console.Write call.
2. **ThreadJob cleanup on tab close.** If the user closes the Warp tab, the parent PowerShell process dies and the ThreadJob dies with it. No cleanup needed. Verify on Warp's `exit` and Ctrl+C paths.
3. **STATE.md parse cost.** ~30 lines, ~2KB read every 120s = negligible. Confirmed by existing cockpit dashboards that poll the same file at 10s intervals.
4. **Title length truncation.** Warp truncates the sidebar to ~18 chars on narrow widths. Compose function should keep titles ≤ 30 chars and put the most-discriminating info in the first 18 (role + phase, not branch).
5. **Hot-reload of watcher script.** A change to `sgsd-tab-watcher.ps1` requires restarting the tab. Acceptable for a script that changes rarely.

## Acceptance

- All 8 launch configs open with their static color+emoji as today (regression: zero)
- 6 wired launch configs show their tab title updating within 120s of an SGSD state change (verify by triggering a phase advance during an open tab)
- Self-test passes ≥10 assertions
- Watcher process count = 1 per wired tab (no leaks, verified via `Get-Process powershell` or watch the ThreadJob count in `Get-Job`)
- Closing a tab terminates its watcher (no orphan threads after `taskkill` or tab close)

## Suggested Placement

Three options for the operator:

1. **v2.10 inception phase** — open a new milestone for misc Warp polish. Clean but heavyweight for one phase.
2. **Insert as 105.x** — append to v2.9 Agentic Harness Evolution as a final UX-polish phase. Off-theme but pragmatic.
3. **Insert as 87.x in warp-integration** — the directory is the right home thematically, but v2.6 has technically closed. Re-opening it sets a precedent for retroactive work.

Recommendation: **option 2** (insert as v2.9 P106 after the harness work closes) — lowest ceremony, ships in the same auto-run sequence, avoids re-opening a closed milestone or spinning up a milestone for one phase.

## Dependencies

- Static color+emoji pass on launch configs (shipped in commit immediately preceding this brief — required for the watcher to have stable per-tab role assignment)
- PowerShell ThreadJob module (built-in, no install)
- Existing `STATE.md` schema (already stable)
- No VTP, MCP, or external service dependencies
