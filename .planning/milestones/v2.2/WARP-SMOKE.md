---
milestone: v2.2
phase: 63
artifact: warp-smoke
created: 2026-04-29
operator: jack.berrow
machine: Windows 11 Pro 10.0.26100
warp_install: C:\Users\jack.berrow\AppData\Local\Programs\Warp\Warp.exe
warp_env: TERM_PROGRAM=WarpTerminal, WARP_HONOR_PS1=0, WARP_USE_SSH_WRAPPER=1
session_topology: this Phase 63 was authored from inside an sg-launched Claude session, providing direct in-process evidence
---

# WARP-SMOKE.md — Warp Capability Evidence Matrix

This is the operator-facing summary. Deep evidence with command output,
function bodies, and probe scripts lives in
`phases/63-warp-capability-smoke/63-RESEARCH.md`. UI-bound items are split
out into `MANUAL-CHECKS.md`.

**Reading guide**:
- **PASS** — proven from terminal evidence in this audit.
- **FAIL** — terminal evidence shows the claim is currently false.
- **MANUAL-CHECK-REQUIRED** — UI-bound; operator must verify. Steps in `MANUAL-CHECKS.md`.
- **NOT-APPLICABLE** — not relevant on this Windows install.

## 1. Operator-Brief Smoke Questions

| # | Question | Verdict | Evidence | Forwarded to |
|--:|---|---|---|---|
| Q1 | Does Warp see the SGSD workflow pack in Command Search / Workflow Search? | MANUAL-CHECK-REQUIRED | 5 YAML files at `.warp/workflows/`; 4/5 lint OK, 1 missing `arguments:` block | MANUAL-CHECKS.md item M1; Phase 64 |
| Q2 | Does `sg` resolve inside Warp PowerShell? | PASS | Defined in profile lines 86-122 (interactive). This session was launched by `sg`. | — |
| Q3 | Does `sgsd` resolve inside Warp PowerShell? | PASS | Defined in profile lines 15-66 (interactive). | — |
| Q4 | Does `sgsd-setup` resolve inside Warp PowerShell? | PASS | Defined in profile lines 124-167 (interactive). | — |
| Q5 | Does direct `claude` launch get detected by Warp as a third-party CLI agent? | MANUAL-CHECK-REQUIRED | `claude` is `ExternalScript` at `~/AppData/Roaming/npm/claude.ps1`; `CLAUDECODE` env vars set in invoked process. UI utility-bar appearance not provable from terminal. | MANUAL-CHECKS.md item M2 |
| Q6 | Does `sg`-launched Claude get detected by Warp? | MANUAL-CHECK-REQUIRED (wiring PASS) | `& claude` is synchronous in `sg`'s PowerShell; this session has both `CLAUDECODE` and `TERM_PROGRAM=WarpTerminal` set. Detection-env wiring confirmed. UI utility-bar visibility still requires operator confirmation. | MANUAL-CHECKS.md item M3 |
| Q7 | Does `sg` keep Claude in the current terminal and open the cockpit separately? | PASS | Profile line 100 (`sgsd @bootArgs` opens cockpit) + line 117/120 (`& claude` synchronous). This Phase 63 was authored from the originating PowerShell tab — direct empirical evidence. | — |
| Q8 | Where are Warp launch configs stored on this machine? | PASS | `C:\Users\jack.berrow\.warp\launch_configurations\` exists; **directory is empty**. | — |
| Q9 | Can a launch config open into the active window, or only a new window? | MANUAL-CHECK-REQUIRED | Launch dir is empty (no fixture to test). Per Warp docs, launch configs open new windows by default. Active-window targeting via palette is unconfirmed on Windows. Warp CLI control is on the May-Jun 2026 roadmap (issue #9233). | MANUAL-CHECKS.md item M4; Phase 78 |
| Q10 | Is Warp Codebase Context working for `C:\Users\jack.berrow\GSDedits`? | MANUAL-CHECK-REQUIRED | `.warpindexingignore` is **missing**. Codebase Context state is not exposed to terminal. | MANUAL-CHECKS.md item M5; Phase 65 (ignore-pack) |
| Q11 | Would WSL/tmux break Codebase Context or agent detection? | DOCS-CONFIRMED | Per official Warp docs, Codebase Context is disabled in WSL/SSH sessions. `tmux` not installed natively on this Windows host (only via WSL). SGSD currently runs in native Windows PowerShell — unaffected. | — |
| Q12 | Do existing workflows validate as YAML? | PARTIAL — 4/5 PASS, 1 FAIL | All 5 parse and have `name`/`command`/`tags`. `sgsd-token-current.yaml` is missing the `arguments:` block (no `project_dir` parameter). | Phase 64 |
| Q13 | What manual checks still need operator confirmation? | See `MANUAL-CHECKS.md` | 5 items M1-M5. | — |

## 2. Bonus Findings (not in operator brief)

| # | Finding | Verdict | Evidence | Forwarded to |
|--:|---|---|---|---|
| B1 | `tmux` is not installed natively on this Windows host. | NOT-APPLICABLE | `Get-Command tmux` returns NOTFOUND. Available only via WSL. | informs Phase 78 launch-config and any future tmux-based cockpit |
| B2 | `claude.exe` is npm-installed at `~/AppData/Roaming/npm/claude.ps1`. | PASS | `Get-Command claude` returns ExternalScript. | confirms CLI surface stable |
| B3 | `codex.exe` is npm-installed at `~/AppData/Roaming/npm/codex.ps1`. | PASS | `Get-Command codex` returns ExternalScript. | confirms CLI surface stable |
| B4 | `node`, `wsl` available; `tmux` requires WSL. | PASS | `Get-Command` enumeration. | informs cross-shell tooling decisions |
| B5 | Warp install is per-user under `~/AppData/Local/Programs/Warp/`. | PASS | filesystem probe. | informs warp-doctor probe path (Phase 67) |
| B6 | `~/.warp/` only contains `launch_configurations/`. No themes, keybindings, or other operator-editable subdirs at this top-level. Warp manages app config elsewhere. | PASS | `Get-ChildItem ~/.warp -Force`. | informs Phase 67 warp-doctor probe surface |
| B7 | Working tree has 4 modified metrics ledgers from cockpit telemetry churn (activity-log, narrative, token-attribution, token-waste-status). Unrelated to Phase 63. | NOTE | `git status --short`. | will be committed separately as `chore(metrics)` |

## 3. Warp Version

Warp version is **not exposed** via env vars, filesystem path, or any
terminal-derivable mechanism observed in this audit. The matrix is a snapshot
as of **2026-04-29**. If the operator updates Warp, re-run Phase 63 probes
or `warp-doctor` (Phase 67) to refresh the matrix.

## 4. Implementation Implications (forwarded, not fixed here)

| Phase | Action | Triggered by |
|---|---|---|
| 64 | Fix `sgsd-token-current.yaml` missing `arguments:` block | Q12 |
| 64 | Add the 8 missing workflows from roadmap (Status / Recovery Packet / Gate Status / Watchdog Status / Codex Status / Current Phase Artifacts / Warp Doctor / Remote Monitor Packet) | roadmap §"Phase 64" |
| 65 (or new ignore-pack phase) | Author `.warpindexingignore` to focus Codebase Context on high-value docs | Q10 |
| 67 | warp-doctor must replicate Phase 63 probes (env, commands, launch dir, workflow lint, ignore-file presence) | all of Section A-E |
| 78 | Launch configuration templates must NOT assume active-window opening until Warp CLI lands or the operator confirms it | Q9 |
| 96 (later) | Track upstream issues #7326 (ACP) and #9233 (Warp May-Jun 2026 roadmap incl. Warp CLI / tmux control mode / wrapper command detection) at `https://github.com/warpdotdev/warp` | Q9, Q6 |

## 5. Acceptance Determination

- 4 PASS rows (Q2, Q3, Q4, Q7, Q8) and 2 PASS-tier bonus rows (B5, B6) and
  1 DOCS-CONFIRMED (Q11): **direct evidence collected from terminal**.
- 1 PARTIAL row (Q12): terminal evidence partially proves, defect logged
  to Phase 64.
- 5 MANUAL-CHECK-REQUIRED rows (Q1, Q5, Q6, Q9, Q10): **deferred to
  operator UI confirmation per Rule 14**.
- 1 NOT-APPLICABLE bonus row (B1): not relevant on this Windows install.
- 0 silently-passed UI claims.

Phase 63 status: **PASS-WITH-DEFERRED-5** — five UI-bound rows are not
verifiable from terminal and are honestly deferred to `MANUAL-CHECKS.md`.
This is the correct downgrade per the operator's Rule 14.

## 6. What This Phase Does NOT Conclude

- It does **not** conclude that Warp Command Search will surface the
  workflow pack. (UI-bound; operator confirms in M1.)
- It does **not** conclude that Warp's third-party CLI utility bar
  appears for `sg`-launched Claude. (UI-bound; M3.)
- It does **not** conclude that Codebase Context has indexed this repo.
  (UI-bound; M5.)
- It does **not** conclude that any single launch-config YAML can target
  the active Warp window. (No fixture; UI-bound; M4.)
- It does **not** make any implementation changes. The workflow pack
  defect, missing ignore file, and missing workflows are forwarded to
  Phase 64+ without inline fix.
