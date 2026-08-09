# P150 SPEC + PHASE-ATC REVIEW — automatable tasks T150-01..04

Combined SDD spec review + ATC over the four automatable tasks' work. Locked plan: .planning/milestones/v3.5/phases/150-propagation-trust-runbook/150-01-PLAN-LOCKED.md (read tasks T150-01..04 + Registry/Architecture sections). Host verification: all six propagation suites green (sgsd-update 19, codex-hooks 10, runtime-provenance 5, runbook 5, snapshot 5, restart-evidence 6 = 50/50). T150-05..07 are operator-present and NOT in scope.

Review the diff below: (1) spec conformance to T150-01..04 contracts; (2) ATC 10-point anti-slop; (3) security: updater guards actually fail closed, snapshot/restore cannot destroy user data, no PII paths in runbook commands; (4) salvage-chain coherence (T4 went through 5 dispatches — check for leftover half-implementations or contradictory content).

Report contract — ALL exact lines: FINDINGS/CRITICAL/WARNINGS/PASS_RATE/ONE_LINER/SPEC_VERDICT: pass|fix_required. THEN — MANDATORY, the report is INVALID without them — one FINDINGS_DETAIL line per CRITICAL and WARNING: FINDINGS_DETAIL: [severity] [dimension] <specific defect with file:line and concrete failure scenario>. A prior reviewer found 7 CRITs (areas: unsafe origin, rollback, trust-proof, PII, Linux-install) but emitted no detail — your job is to emit EVERY finding with actionable detail.

## Diff (since plan lock 58d298b)
```diff
diff --git a/.planning/milestones/v3.5/phases/150-propagation-trust-runbook/DEVCP-RECONCILIATION.md b/.planning/milestones/v3.5/phases/150-propagation-trust-runbook/DEVCP-RECONCILIATION.md
new file mode 100644
index 0000000..6ad8ad3
--- /dev/null
+++ b/.planning/milestones/v3.5/phases/150-propagation-trust-runbook/DEVCP-RECONCILIATION.md
@@ -0,0 +1,47 @@
+# devcp non-destructive reconciliation decision
+
+## Historical fork quarantine
+
+The 883-commit `~/GSDedits` fork is historical evidence. Never rewrite or push
+it, and preserve `devcp-fork-backup-2026-08-05`. It is not the installation
+source. Valuable fork-only capabilities move forward only as reviewed patches
+on a clean origin/master-based branch with generic operator identity. Always
+validate canonical source origin before fetch, patch, merge, or installation.
+
+The observed 43-file installed drift is also evidence. The decision is
+non-deleting: preserve and classify it rather than replace the directory.
+Review dependencies for `board-runner.cjs`, `execution-authority.sh`,
+`concurrency-policy.cjs`, and `decision-registry.cjs` before extracting any
+capability.
+
+## Complete recovery boundary
+
+Snapshot the complete global mutation boundary before bootstrap or
+`/sgsd-update`, not only scripts. Each manifest records every file, directory,
+symlink, mode, link target, and SHA.
+
+The pre-install path set must be a subset of the post-install path set. Compute
+the pre-install extra-file set relative to the canonical scripts tree, then
+prove every extra remains byte-identical after bootstrap and `/sgsd-update`.
+A mismatch stops the candidate; rollback retains the archive, quarantines the
+failed candidate, and restores prior targets including their absent state.
+
+## Shadow deployment decision
+
+Use a VTP shadow deployment: coordinate sessions, validate origin and clean
+state, capture the intended SHA, perform a guarded fast-forward, snapshot,
+install without switching processes, and verify SHA, smoke, hooks, model pin,
+and manifest evidence. Verify the 43-file preservation result before switching
+tmux, cockpit, and MCP with before/after identities.
+
+Failure before the switch leaves current processes untouched and triggers the
+non-deleting rollback. Failure after the switch freezes further propagation and
+is repaired by a reviewed forward change.
+
+## Clarity boundary
+
+The path `/opt/clarity/project-clarity-erp/super-gsd` remains
+outside framework propagation. It is application-owned vendored content, not canonical framework
+evidence. Runtime authority comes from `~/.claude/super-gsd/source`,
+`~/.claude/super-gsd/scripts`, and `~/.claude/agents`; candidate acceptance
+requires tmux, cockpit, and MCP to resolve through those canonical locations.
diff --git a/.planning/milestones/v3.5/phases/150-propagation-trust-runbook/PROPAGATION.md b/.planning/milestones/v3.5/phases/150-propagation-trust-runbook/PROPAGATION.md
new file mode 100644
index 0000000..e120f8b
--- /dev/null
+++ b/.planning/milestones/v3.5/phases/150-propagation-trust-runbook/PROPAGATION.md
@@ -0,0 +1,181 @@
+# Phase 150 propagation, trust, recovery, and restart runbook
+
+This is the operator runbook for T150-05, T150-06, and T150-07. Those tasks
+are operator-present: do not execute them during the automatable T150-04
+documentation task. Every command below names its shell, uses concrete paths,
+and stops when a guard fails.
+
+## Reload and reboot matrix
+
+A machine reboot is not required for any Phase 150 layer. The owning process,
+client session, or tmux session is the reload boundary. Preserve evidence before
+using a full reboot as an optional last-resort recovery action.
+
+| Runtime layer | When new content becomes Live | Required reload | Identity evidence | Machine reboot |
+|---|---|---|---|---|
+| Hook bodies | Next hook event | None; the next event reads the new hook body | Hook name, event timestamp, probe ID, and appended ledger row | No |
+| Skills, agents, and settings registrations | Next session | Start a new client session | Client PID, start time, and resolved registrations | No |
+| Registries and singleton caches | Cache reset or new process | Run registry sync, then replace the owning process | Registry source plus process identity | No |
+| PowerShell functions | Immediately after `. $PROFILE`, otherwise next terminal | Reload the profile or open a new terminal | `Get-Command sg,sgsd,sgsd-refresh` | No |
+| Claude settings and hooks | Next owning Claude session | Restart the owning Claude session | New Claude process plus hook self-test | No |
+| Local MCP modules | After verified child termination and owning-session restart | Display and replace only canonical MCP children | PID plus CreationDate before and after | No |
+| Local cockpit | After verified PID termination and relaunch | Run `sgsd-refresh -SkipPreflight` | PID, CreationDate, and canonical command line | No |
+| devcp MCP modules | After verified child termination and tmux relaunch | Reset the owning `clarity-sgsd` session | PID plus `/proc/PID/stat` start_ticks | No |
+| devcp cockpit | After verified PID termination and canonical relaunch | Relaunch from the selected global scripts directory | PID, start_ticks, and command line | No |
+| devcp tmux | After coordinated reset | Reset, greet, and initially do not attach | session ID, creation epoch, and server PID before and after | No |
+
+## Invariants and stop conditions
+
+- The canonical local source is `$env:USERPROFILE\GSDedits`; the devcp
+  canonical source is `~/.claude/super-gsd/source`.
+- `/opt/clarity/project-clarity-erp/super-gsd` is a vendored application tree,
+  never an implicit framework-propagation source.
+- Before any update, the clean-state check is `git status --porcelain`; it must
+  be empty. Validate the origin URL, capture the intended SHA, and allow only a
+  guarded fast-forward.
+- A failed candidate is quarantined. Rollback restores the exact pre-install
+  manifest while retaining the original archive and failed candidate.
+- Every evidence record contains the exact command, captured UTC timestamp,
+  machine, exit status, before/after identities, canonical provenance, and
+  redacted output.
+
+## Installed-layer recovery boundary
+
+The snapshot owns every target mutated by `super-gsd/install.sh --install-global`:
+
+- `~/.claude/agents`
+- `~/.claude/commands`
+- `~/.claude/hooks`
+- `~/.claude/settings.json`
+- `~/.claude/get-shit-done/templates/super-gsd`
+- `~/.claude/get-shit-done/workflows`
+- `~/.claude/get-shit-done/config/model-routing.json`
+- `~/.claude/super-gsd/scripts`
+- `~/.local/bin/sgsd`
+
+Create and later verify the snapshot from Bash on devcp:
+
+```bash
+set -euo pipefail
+source_dir=$HOME/.claude/super-gsd/source
+snapshot_dir=$HOME/.claude/super-gsd/reconciliation/p150-candidate
+bash $source_dir/super-gsd/scripts/sgsd-global-snapshot.sh create --home $HOME --output-dir $snapshot_dir
+bash $source_dir/super-gsd/install.sh --update --install-global
+bash $source_dir/super-gsd/scripts/sgsd-global-snapshot.sh verify --home $HOME --snapshot-dir $snapshot_dir
+```
+
+Verification proves the complete pre-install scripts path set is a subset of
+the post-install set and every pre-install extra is byte-identical. If any
+candidate check fails, use the exact rollback command. It quarantines current
+targets and reconstructs the exact pre-install manifest from the original archive:
+
+```bash
+set -euo pipefail
+source_dir=$HOME/.claude/super-gsd/source
+snapshot_dir=$HOME/.claude/super-gsd/reconciliation/p150-candidate
+failed_dir=$HOME/.claude/super-gsd/reconciliation/p150-failed-candidate
+bash $source_dir/super-gsd/scripts/sgsd-global-snapshot.sh restore --home $HOME --snapshot-dir $snapshot_dir --failed-candidate-dir $failed_dir
+test -r $snapshot_dir/archive.tar
+find $failed_dir -mindepth 1 -print -quit
+```
+
+## Local propagation — T150-05
+
+Run in PowerShell after verifying the intended feature SHA and generic identity:
+
+```powershell
+$ErrorActionPreference = 'Stop'
+$p150Project = '$env:USERPROFILE\GSDedits'
+Set-Location -LiteralPath $p150Project
+$p150Status = @(git status --porcelain)
+if ($LASTEXITCODE -ne 0 -or $p150Status.Count -ne 0) { throw 'Canonical source is not clean' }
+bash super-gsd/install.sh --update --install-global
+if ($LASTEXITCODE -ne 0) { throw 'Global install failed' }
+powershell -NoProfile -ExecutionPolicy Bypass -File super-gsd/scripts/Install-SgsdShortcut.ps1 -Force
+if ($LASTEXITCODE -ne 0) { throw 'Shortcut install failed' }
+. $PROFILE
+Get-Command sg,sgsd,sgsd-refresh -ErrorAction Stop | Out-Null
+sgsd -NoOpen
+if ($LASTEXITCODE -ne 0) { throw 'Local preflight failed' }
+```
+
+```powershell
+node super-gsd/tools/codex-hooks/install-hooks.cjs --project $env:USERPROFILE\GSDedits --json
+node super-gsd/tools/codex-hooks/self-test.cjs --project $env:USERPROFILE\GSDedits --json
+& .\super-gsd\scripts\sgsd-update.ps1 -Check -Source $env:USERPROFILE\GSDedits
+& .\super-gsd\scripts\sgsd-update.ps1 -Source $env:USERPROFILE\GSDedits
+```
+
+The Bash equivalents are `sgsd-update.sh --check --source` and
+`sgsd-update.sh --source`. Portable preflight accepts `sgsd --no-open`.
+
+## Worktrees, junctions, and project hooks
+
+Pushing master does not move a checked-out branch in an existing `git worktree`.
+Coordinate its clean-state check and use merge/rebase only when its owner chooses
+to advance it. Never install from a stale worktree.
+Junction-backed repos receive target changes when the junction target advances,
+but still need this exact command:
+
+```powershell
+node super-gsd/tools/codex-hooks/install-hooks.cjs --project $env:USERPROFILE\GSDedits --json
+```
+
+## Trust ceremony and append-only proof — T150-06
+
+Each independently trusted real dispatch records a unique probe ID, the
+ledger byte offset captured before dispatch, the UTC start, the checked
+Codex exit status and transport status, forbidden-file absence, and the exact appended
+bytes. Historical rows do not count. The appended bytes must contain a
+`block-forbidden-write` row whose decision is `block`, whose reason is `forbidden_path`,
+whose path matches the probe, and whose timestamp follows the UTC start.
+
+```powershell
+node super-gsd/tools/codex-hooks/install-hooks.cjs --project $env:USERPROFILE\GSDedits --json
+node super-gsd/tools/codex-hooks/self-test.cjs --project $env:USERPROFILE\GSDedits --json
+node super-gsd/tools/codex-hooks/block-forbidden-write.cjs
+```
+
+Retain appended bytes and redacted output only; prove forbidden-file absence at
+`secrets/p150-trust-probe.env` after the dispatch.
+
+## Local restart evidence — T150-06
+
+Prepare displays selected Win32 MCP and cockpit command lines, requires `KILL`,
+and starts a new cockpit. Finalize runs after the owning session restarts:
+
+```powershell
+& $env:USERPROFILE\GSDedits\super-gsd\scripts\sgsd-local-restart-evidence.ps1 -Mode Prepare -Project $env:USERPROFILE\GSDedits -ExpectedMcpRoot $env:USERPROFILE\GSDedits -EvidencePath .planning\milestones\v3.5\phases\150-propagation-trust-runbook\150-LOCAL-RESTART-EVIDENCE.json
+& $env:USERPROFILE\GSDedits\super-gsd\scripts\sgsd-local-restart-evidence.ps1 -Mode Finalize -Project $env:USERPROFILE\GSDedits -ExpectedMcpRoot $env:USERPROFILE\GSDedits -EvidencePath .planning\milestones\v3.5\phases\150-propagation-trust-runbook\150-LOCAL-RESTART-EVIDENCE.json
+```
+
+Acceptance requires no PID/CreationDate identity intersection, a changed
+cockpit identity, canonical MCP provenance, and after identities live at write.
+
+## devcp propagation and runtime switch — T150-07
+
+Use named remote scripts with explicit arguments from PowerShell:
+
+```powershell
+$ErrorActionPreference = 'Stop'
+ssh devcp bash ~/.claude/super-gsd/source/super-gsd/scripts/sgsd-update.sh --check --source ~/.claude/super-gsd/source
+if ($LASTEXITCODE -ne 0) { throw 'devcp update preflight failed' }
+ssh devcp bash ~/.claude/super-gsd/source/super-gsd/scripts/sgsd-update.sh --source ~/.claude/super-gsd/source
+if ($LASTEXITCODE -ne 0) { throw 'devcp guarded update failed' }
+ssh -t devcp bash ~/.claude/super-gsd/source/super-gsd/scripts/sgsd-devcp-restart-evidence.sh --project /opt/clarity/project-clarity-erp --session clarity-sgsd --scripts-dir ~/.claude/super-gsd/scripts --agents-dir ~/.claude/agents --source-dir ~/.claude/super-gsd/source --evidence ~/.claude/super-gsd/reconciliation/p150-devcp-restart-evidence.json
+if ($LASTEXITCODE -ne 0) { throw 'devcp restart evidence failed' }
+ssh devcp tmux attach -t clarity-sgsd
+```
+
+The helper calls `sgsd-remote-tmux.sh` with `--project`, `--scripts-dir`,
+`--agents-dir`, `--source-dir`, `--reset`, `--greet`, and `--no-attach`, then
+runs `--doctor`. Acceptance requires new MCP identities, changed cockpit and
+tmux identities, canonical command lines, PID/start_ticks, and tmux session ID,
+creation epoch, and server PID evidence.
+
+## Evidence capture
+
+For every local or devcp operation, capture the exact command, machine, UTC
+timestamp, exit status, redacted output, source SHA, project pin, and referenced
+manifest or ledger range. Do not copy secrets, authentication tokens, raw trust
+database contents, or unrelated process command lines into phase evidence.
diff --git a/super-gsd/config/codex-hooks.json b/super-gsd/config/codex-hooks.json
new file mode 100644
index 0000000..a1c3374
--- /dev/null
+++ b/super-gsd/config/codex-hooks.json
@@ -0,0 +1,52 @@
+{
+  "hooks": {
+    "UserPromptSubmit": [
+      {
+        "matcher": "*",
+        "hooks": [
+          {
+            "type": "command",
+            "command": "node super-gsd/tools/codex-hooks/block-secret-leak.cjs"
+          }
+        ]
+      }
+    ],
+    "PreToolUse": [
+      {
+        "matcher": "*",
+        "hooks": [
+          {
+            "type": "command",
+            "command": "node super-gsd/tools/codex-hooks/block-forbidden-write.cjs"
+          },
+          {
+            "type": "command",
+            "command": "node super-gsd/tools/codex-hooks/enforce-allowed-files.cjs"
+          }
+        ]
+      }
+    ],
+    "PostToolUse": [
+      {
+        "matcher": "*",
+        "hooks": [
+          {
+            "type": "command",
+            "command": "node super-gsd/tools/codex-hooks/log-tool-event.cjs"
+          }
+        ]
+      }
+    ],
+    "Stop": [
+      {
+        "matcher": "*",
+        "hooks": [
+          {
+            "type": "command",
+            "command": "node super-gsd/tools/codex-hooks/validate-stop-contract.cjs"
+          }
+        ]
+      }
+    ]
+  }
+}
diff --git a/super-gsd/install.sh b/super-gsd/install.sh
index f84cdf5..5c875db 100644
--- a/super-gsd/install.sh
+++ b/super-gsd/install.sh
@@ -1,81 +1,82 @@
-#!/bin/bash
-# Super GSD Orchestrator - safe installer
-#
-# Default behavior is read-only. Global Claude changes and global auto-approve
-# are separate explicit opt-ins.
-
-set -e
-
-if [ -d "$HOME/.local/bin" ]; then
-  PATH="$HOME/.local/bin:$PATH"
-fi
-if [ -d "$HOME/.nvm/versions/node" ]; then
-  SGSD_NODE_BIN="$(find "$HOME/.nvm/versions/node" -maxdepth 2 -type d -name bin 2>/dev/null | sort -V | tail -1)"
-  if [ -n "$SGSD_NODE_BIN" ]; then
-    PATH="$SGSD_NODE_BIN:$PATH"
-  fi
-fi
-export PATH
-
-normalize_windows_home() {
-  case "$(uname -s 2>/dev/null || echo unknown)" in
-    MINGW*|MSYS*|CYGWIN*)
-      if command -v cygpath >/dev/null 2>&1 && [ -n "${USERPROFILE:-}" ]; then
-        win_home="$(cygpath -u "$USERPROFILE" 2>/dev/null || true)"
-        if [ -n "$win_home" ] && [ -d "$win_home" ] && [ "${HOME:-}" != "$win_home" ]; then
-          HOME="$win_home"
-          export HOME
-        fi
-      fi
-      ;;
-  esac
-}
-
-normalize_windows_home
-
-SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
-PROJECT_DIR="$(pwd)"
-CLAUDE_DIR="$HOME/.claude"
-GSD_DIR="$CLAUDE_DIR/get-shit-done"
-HOOKS_DIR="$CLAUDE_DIR/hooks"
-AGENTS_DIR="$CLAUDE_DIR/agents"
-COMMANDS_DIR="$CLAUDE_DIR/commands"
-TEMPLATES_DIR="$GSD_DIR/templates/super-gsd"
+#!/bin/bash
+# Super GSD Orchestrator - safe installer
+#
+# Default behavior is read-only. Global Claude changes and global auto-approve
+# are separate explicit opt-ins.
+
+set -e
+
+if [ -d "$HOME/.local/bin" ]; then
+  PATH="$HOME/.local/bin:$PATH"
+fi
+if [ -d "$HOME/.nvm/versions/node" ]; then
+  SGSD_NODE_BIN="$(find "$HOME/.nvm/versions/node" -maxdepth 2 -type d -name bin 2>/dev/null | sort -V | tail -1)"
+  if [ -n "$SGSD_NODE_BIN" ]; then
+    PATH="$SGSD_NODE_BIN:$PATH"
+  fi
+fi
+export PATH
+
+normalize_windows_home() {
+  case "$(uname -s 2>/dev/null || echo unknown)" in
+    MINGW*|MSYS*|CYGWIN*)
+      if command -v cygpath >/dev/null 2>&1 && [ -n "${USERPROFILE:-}" ]; then
+        win_home="$(cygpath -u "$USERPROFILE" 2>/dev/null || true)"
+        if [ -n "$win_home" ] && [ -d "$win_home" ] && [ "${HOME:-}" != "$win_home" ]; then
+          HOME="$win_home"
+          export HOME
+        fi
+      fi
+      ;;
+  esac
+}
+
+normalize_windows_home
+
+SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
+PROJECT_DIR="$(pwd)"
+CLAUDE_DIR="$HOME/.claude"
+GSD_DIR="$CLAUDE_DIR/get-shit-done"
+HOOKS_DIR="$CLAUDE_DIR/hooks"
+AGENTS_DIR="$CLAUDE_DIR/agents"
+COMMANDS_DIR="$CLAUDE_DIR/commands"
+TEMPLATES_DIR="$GSD_DIR/templates/super-gsd"
 GLOBAL_SCRIPTS_DIR="$CLAUDE_DIR/super-gsd/scripts"
-
-DRY_RUN=false
-RUN_DOCTOR=false
-INIT_LOCAL=false
-INSTALL_GLOBAL=false
-ENABLE_AUTOAPPROVE=false
-SAW_ACTION=false
-# P143.5 cockpit dep handling — opt-in for the ~112MB Chromium download.
-SKIP_COCKPIT_DEPS=false
-SETUP_COCKPIT_DEPS=false
-# P143.6 in-place update of an existing install (no skeleton rewrite, no
-# config overwrite — just refresh npm deps + agent registry + memory taxonomy).
+LOCAL_BIN_DIR="$HOME/.local/bin"
+
+DRY_RUN=false
+RUN_DOCTOR=false
+INIT_LOCAL=false
+INSTALL_GLOBAL=false
+ENABLE_AUTOAPPROVE=false
+SAW_ACTION=false
+# P143.5 cockpit dep handling — opt-in for the ~112MB Chromium download.
+SKIP_COCKPIT_DEPS=false
+SETUP_COCKPIT_DEPS=false
+# P143.6 in-place update of an existing install (no skeleton rewrite, no
+# config overwrite — just refresh npm deps + agent registry + memory taxonomy).
 UPDATE_MODE=false
 INSTALL_COMMIT_GATE=false
-UNINSTALL_COMMIT_GATE=false
-
-AGENT_COUNT=0
-SKILL_COUNT=0
-HOOK_COUNT=0
-SCRIPT_COUNT=0
-
-usage() {
-  cat <<'EOF'
-Super GSD installer
-
-Safe defaults:
-  bash super-gsd/install.sh
-      Read-only doctor + usage. No writes.
-
-Read-only:
-  --doctor
-      Check Node, Claude, Codex, SGSD git freshness, local config, and visible
-      Claude global state. Does not modify files or settings.
-
+UNINSTALL_COMMIT_GATE=false
+
+AGENT_COUNT=0
+SKILL_COUNT=0
+HOOK_COUNT=0
+SCRIPT_COUNT=0
+
+usage() {
+  cat <<'EOF'
+Super GSD installer
+
+Safe defaults:
+  bash super-gsd/install.sh
+      Read-only doctor + usage. No writes.
+
+Read-only:
+  --doctor
+      Check Node, Claude, Codex, SGSD git freshness, local config, and visible
+      Claude global state. Does not modify files or settings.
+
 Commit gate:
   --install-commit-gate
       Install or refresh the SGSD-marked Git pre-commit trampoline at the
@@ -85,370 +86,380 @@ Commit gate:
       Remove only an SGSD-marked pre-commit trampoline. Refuses unmarked hooks
       and never invokes the gate during rollback.
 
-Local project setup:
-  --init-local
-  --init-project
+Local project setup:
+  --init-local
+  --init-project
       Create/update only project-local SGSD files in the current directory:
       .planning/, .planning/config.json, metrics skeleton, CLAUDE.md when
-      absent, and repo-local .claude/settings.json hooks. --init-project
-      is kept as a backward-compatible safe alias.
-  --update
-      Refresh an existing SGSD install in place. Re-runs npm install + agent
-      registry sync + memory taxonomy ensure + repo-local hook merge, but does
+      absent, repo-local .claude/settings.json hooks, and safely merged
+      project .codex/hooks.json registrations. --init-project
+      is kept as a backward-compatible safe alias.
+  --update
+      Refresh an existing SGSD install in place. Re-runs npm install + agent
+      registry sync + memory taxonomy ensure + repo-local Claude/Codex hook
+      merges, but does
       NOT recreate the .planning/ skeleton, overwrite CLAUDE.md, or replace
       config.json. Safe to run after a `git pull` to pick up new dependencies
       and registry entries. Pair with --install-global to also refresh ~/.claude
-      assets.
-
-Global Claude install:
-  --install-global
-      Copy SGSD agents, commands, hooks, templates, workflows, config, and
-      scripts into ~/.claude. Does not enable auto-approve.
-
-Dangerous permission change:
-  --enable-autoapprove
-      Explicitly run claude config set --global autoApprove for autonomous mode.
-      This affects every Claude Code session for the current OS user.
-
-Optional:
-  --skip-brv
-      Accepted for older docs/scripts as a no-op. Current SGSD memory is
-      project-local .planning/memory, not BRV/ByteRover.
-  --skip-cockpit-deps
-      Skip 'npm install' for cockpit tooling during --init-project. Use when
-      you'll manage dependencies separately. The ATC playwright gate will not
-      work until 'npm install' is run.
-  --setup-cockpit-deps
-      Pair with --init-project to also download the Chromium binary
-      (~112MB) via 'npx playwright install chromium'. Required for the
-      ATC visual gate. Without this flag, the operator runs it manually:
-      'npm run cockpit:setup'.
-  --dry-run
-      Print actions without writing.
-  --help
-      Show this help.
-
-Examples:
-  bash super-gsd/install.sh --doctor
-  bash super-gsd/install.sh --init-project
-  bash super-gsd/install.sh --init-project --setup-cockpit-deps
-  bash super-gsd/install.sh --update
-  bash super-gsd/install.sh --update --install-global
-  bash super-gsd/install.sh --install-global --dry-run
-  bash super-gsd/install.sh --enable-autoapprove
-EOF
-}
-
-log() { echo "  [super-gsd] $1"; }
-
-run() {
-  if [ "$DRY_RUN" = true ]; then
-    log "DRY RUN: $*"
-  else
-    "$@"
-  fi
-}
-
-copy_file() {
-  if [ "$DRY_RUN" = true ]; then
-    log "DRY RUN: $1 -> $2"
-  else
-    if [ -e "$2" ] && command -v readlink >/dev/null 2>&1; then
-      src_real="$(readlink -f "$1" 2>/dev/null || true)"
-      dst_real="$(readlink -f "$2" 2>/dev/null || true)"
-      if [ -n "$src_real" ] && [ "$src_real" = "$dst_real" ]; then
-        log "  same file, skipping copy: $2"
-        return 0
-      fi
-    fi
-    mkdir -p "$(dirname "$2")"
-    if [ -d "$1" ]; then
-      cp -R "$1" "$2"
-    else
-      cp "$1" "$2"
-    fi
-  fi
-}
-
-remove_path_if_exists() {
-  target="$1"
-  if [ "$DRY_RUN" = true ]; then
-    log "DRY RUN: would remove legacy asset $target"
-    return 0
-  fi
-  if [ -e "$target" ]; then
-    rm -rf "$target"
-    log "  removed legacy asset: $target"
-  fi
-}
-
-is_legacy_brv_asset() {
-  case "$(basename "$1")" in
-    *brv*|*BRV*) return 0 ;;
-    *) return 1 ;;
-  esac
-}
-
-remove_legacy_global_assets() {
-  remove_path_if_exists "$COMMANDS_DIR/sgsd-brv-setup"
-  remove_path_if_exists "$HOOKS_DIR/brv-query-local.js"
-  remove_path_if_exists "$HOOKS_DIR/brv-curate-local.js"
-  remove_path_if_exists "$TEMPLATES_DIR/brv-seed"
-  remove_path_if_exists "$TEMPLATES_DIR/executor-brv-overlay.xml"
-  remove_path_if_exists "$TEMPLATES_DIR/planner-brv-overlay.xml"
-  remove_path_if_exists "$TEMPLATES_DIR/verifier-brv-overlay.xml"
-  remove_path_if_exists "$TEMPLATES_DIR/overwatcher/brv-query-local.js"
-  remove_path_if_exists "$TEMPLATES_DIR/overwatcher/brv-curate-local.js"
-}
-
-frontmatter_field() {
-  awk -v f="$2" '
-    /^---[[:space:]]*$/ { if (in_fm) exit; in_fm = 1; next }
-    in_fm && $0 ~ "^"f":" {
-      sub("^"f":[[:space:]]*", "")
-      gsub(/^"|"$|^'\''|'\''$/, "")
-      print
-      exit
-    }
-  ' "$1"
-}
-
-require_node_22() {
-  if ! command -v node >/dev/null 2>&1; then
-    echo "ERROR: Node.js not found. Install Node.js >= 22 first."
-    exit 1
-  fi
-  NODE_MAJOR="$(node -v | sed 's/v//' | cut -d. -f1)"
-  if [ "$NODE_MAJOR" -lt 22 ]; then
-    echo "ERROR: Node.js >= 22 required (found $(node -v))"
-    exit 1
-  fi
-}
-
-print_banner() {
-  echo ""
-  echo "========================================"
-  echo "   Super GSD Orchestrator - Installer   "
-  echo "========================================"
-  echo ""
-}
-
-doctor() {
-  echo ""
-  log "Doctor mode is read-only."
-
-  if command -v node >/dev/null 2>&1; then
-    log "Node.js: $(node -v)"
-  else
-    log "Node.js: missing"
-  fi
-
-  if command -v claude >/dev/null 2>&1; then
-    CLAUDE_VERSION="$(claude --version 2>/dev/null | head -1 || true)"
-    log "Claude CLI: ${CLAUDE_VERSION:-found}"
-    AUTOAPPROVE="$(claude config get --global autoApprove 2>/dev/null || true)"
-    if [ -n "$AUTOAPPROVE" ]; then
-      log "Claude global autoApprove: $AUTOAPPROVE"
-    else
-      log "Claude global autoApprove: empty or unavailable"
-    fi
-  else
-    log "Claude CLI: missing"
-  fi
-
-  if command -v codex >/dev/null 2>&1; then
-    CODEX_VERSION="$(codex --version 2>/dev/null | head -1 || true)"
-    log "Codex CLI: ${CODEX_VERSION:-found}"
-    CODEX_STATUS="$(codex login status 2>&1 || true)"
-    if echo "$CODEX_STATUS" | grep -qi "logged in"; then
-      log "Codex login: available"
-    else
-      log "Codex login: not ready ($CODEX_STATUS)"
-    fi
-  else
-    log "Codex CLI: missing"
-  fi
-
-  if [ -d "$PROJECT_DIR/.git" ]; then
-    LOCAL_HEAD="$( ( cd "$PROJECT_DIR" && git rev-parse HEAD ) 2>/dev/null || true )"
-    REMOTE_HEAD="$(git ls-remote https://github.com/Berrowj/super-gsd.git refs/heads/master 2>/dev/null | awk '{print $1}' || true)"
-    log "Project git HEAD: ${LOCAL_HEAD:-unknown}"
-    log "SGSD GitHub master: ${REMOTE_HEAD:-unavailable}"
-    if [ -n "$LOCAL_HEAD" ] && [ -n "$REMOTE_HEAD" ] && [ "$LOCAL_HEAD" = "$REMOTE_HEAD" ]; then
-      log "Freshness: local repo matches SGSD GitHub master"
-    elif [ -n "$REMOTE_HEAD" ]; then
-      log "Freshness: local repo differs from SGSD GitHub master"
-    fi
-  else
-    log "Project git HEAD: not a git repo"
-  fi
-
-  if [ -f "$PROJECT_DIR/.planning/config.json" ]; then
-    log "Project .planning/config.json: present"
-    if command -v node >/dev/null 2>&1; then
-      node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); console.log('  [super-gsd] Project config JSON: valid')" "$PROJECT_DIR/.planning/config.json" 2>/dev/null || \
-        log "Project config JSON: invalid"
-    fi
-  else
-    log "Project .planning/config.json: missing"
-  fi
-
-  [ -d "$AGENTS_DIR" ] && log "Global agents dir: present ($AGENTS_DIR)" || log "Global agents dir: missing"
-  [ -d "$COMMANDS_DIR" ] && log "Global commands dir: present ($COMMANDS_DIR)" || log "Global commands dir: missing"
-  [ -d "$HOOKS_DIR" ] && log "Global hooks dir: present ($HOOKS_DIR)" || log "Global hooks dir: missing"
-}
-
-ensure_gsd_base() {
-  if [ "$DRY_RUN" = true ]; then
-    if command -v node >/dev/null 2>&1; then
-      log "DRY RUN: Node.js available ($(node -v))"
-    else
-      log "DRY RUN: Node.js missing; actual --install-global requires Node.js >= 22"
-    fi
-  else
-    require_node_22
-  fi
-  if [ ! -d "$GSD_DIR" ]; then
-    echo ""
-    if [ "$DRY_RUN" = true ]; then
-      log "DRY RUN: would install GSD 1.0 via npx get-shit-done-cc@latest"
-    else
-      log "GSD 1.0 not found. Installing because --install-global was requested..."
-      run npx get-shit-done-cc@latest
-    fi
-  fi
-  log "GSD 1.0: $GSD_DIR"
-}
-
-install_global_assets() {
-  ensure_gsd_base
-
-  echo ""
-  log "Installing global Claude agents..."
-  AGENT_COUNT=0
-  for agent in "$SCRIPT_DIR/agents/"*.md; do
-    [ -f "$agent" ] || continue
-    name="$(basename "$agent")"
-    agent_model="$(frontmatter_field "$agent" model)"
-    case "$agent_model" in
-      sonnet|haiku)
-        log "  skipping legacy Claude agent $name ($agent_model not a fresh-clone route)"
-        continue
-        ;;
-    esac
-    copy_file "$agent" "$AGENTS_DIR/$name"
-    AGENT_COUNT=$((AGENT_COUNT + 1))
-  done
-  if [ -f "$SCRIPT_DIR/agents/sgsd-executor.md" ]; then
-    copy_file "$SCRIPT_DIR/agents/sgsd-executor.md" "$AGENTS_DIR/gsd-executor.md"
-    log "  legacy gsd-executor disabled -> Codex executor only"
-  fi
-  log "  $AGENT_COUNT agents installed"
-
-  echo ""
-  log "Installing global Claude commands..."
-  SKILL_COUNT=0
-  for skill_dir in "$SCRIPT_DIR/skills/"*/; do
-    [ -f "$skill_dir/SKILL.md" ] || continue
-    name="$(basename "$skill_dir")"
-    [ "$name" = "sgsd-brv-setup" ] && continue
-    copy_file "$skill_dir/SKILL.md" "$COMMANDS_DIR/$name/SKILL.md"
-    SKILL_COUNT=$((SKILL_COUNT + 1))
-  done
-  log "  $SKILL_COUNT commands installed"
-
-  echo ""
-  log "Installing global hooks..."
-  [ "$DRY_RUN" = true ] || mkdir -p "$HOOKS_DIR"
-  HOOK_COUNT=0
-  for hook in "$SCRIPT_DIR/hooks/"*.js; do
-    [ -f "$hook" ] || continue
-    name="$(basename "$hook")"
-    copy_file "$hook" "$HOOKS_DIR/$name"
-    HOOK_COUNT=$((HOOK_COUNT + 1))
-  done
-  log "  $HOOK_COUNT hooks installed"
-
-  echo ""
-  log "Registering hooks in ~/.claude/settings.json..."
-  SETTINGS_FILE="$CLAUDE_DIR/settings.json"
-  OVERLAY_FILE="$SCRIPT_DIR/config/settings-overlay.json"
-  MERGE_SCRIPT="$SCRIPT_DIR/scripts/merge-settings.js"
-  if [ ! -f "$OVERLAY_FILE" ]; then
-    log "  WARNING: $OVERLAY_FILE missing - skipping merge"
-  elif [ ! -f "$MERGE_SCRIPT" ]; then
-    log "  WARNING: $MERGE_SCRIPT missing - skipping merge"
-  elif [ "$DRY_RUN" = true ]; then
-    log "  DRY RUN: would merge $OVERLAY_FILE into $SETTINGS_FILE"
-  else
-    node "$MERGE_SCRIPT" "$OVERLAY_FILE" "$SETTINGS_FILE" 2>&1 | sed 's/^/  /'
-  fi
-
-  echo ""
-  log "Installing templates + overwatcher..."
-  [ "$DRY_RUN" = true ] || mkdir -p "$TEMPLATES_DIR/overwatcher"
-  for template in "$SCRIPT_DIR/templates/"*; do
-    [ -e "$template" ] || continue
-    is_legacy_brv_asset "$template" && continue
-    name="$(basename "$template")"
-    copy_file "$template" "$TEMPLATES_DIR/$name"
-  done
-  for ow in "$SCRIPT_DIR/overwatcher/"*.js "$SCRIPT_DIR/overwatcher/"*.md; do
-    [ -f "$ow" ] || continue
-    is_legacy_brv_asset "$ow" && continue
-    name="$(basename "$ow")"
-    copy_file "$ow" "$TEMPLATES_DIR/overwatcher/$name"
-  done
-  remove_legacy_global_assets
-  log "  Templates + overwatcher installed"
-
-  echo ""
-  log "Installing workflows and config..."
-  [ "$DRY_RUN" = true ] || mkdir -p "$GSD_DIR/workflows" "$GSD_DIR/config"
-  for workflow in "$SCRIPT_DIR/workflows/"*; do
-    [ -e "$workflow" ] || continue
-    name="$(basename "$workflow")"
-    copy_file "$workflow" "$GSD_DIR/workflows/$name"
-  done
-  copy_file "$SCRIPT_DIR/config/model-routing.json" "$GSD_DIR/config/model-routing.json"
-  log "  Workflows + model routing config installed"
-
-  echo ""
-  log "Installing SGSD scripts globally..."
-  [ "$DRY_RUN" = true ] || mkdir -p "$GLOBAL_SCRIPTS_DIR/lib" "$GLOBAL_SCRIPTS_DIR/watchdogs"
-  SCRIPT_COUNT=0
+      assets.
+
+Global Claude install:
+  --install-global
+      Copy SGSD agents, commands, hooks, templates, workflows, config, and
+      scripts into ~/.claude. Does not enable auto-approve.
+
+Dangerous permission change:
+  --enable-autoapprove
+      Explicitly run claude config set --global autoApprove for autonomous mode.
+      This affects every Claude Code session for the current OS user.
+
+Optional:
+  --skip-brv
+      Accepted for older docs/scripts as a no-op. Current SGSD memory is
+      project-local .planning/memory, not BRV/ByteRover.
+  --skip-cockpit-deps
+      Skip 'npm install' for cockpit tooling during --init-project. Use when
+      you'll manage dependencies separately. The ATC playwright gate will not
+      work until 'npm install' is run.
+  --setup-cockpit-deps
+      Pair with --init-project to also download the Chromium binary
+      (~112MB) via 'npx playwright install chromium'. Required for the
+      ATC visual gate. Without this flag, the operator runs it manually:
+      'npm run cockpit:setup'.
+  --dry-run
+      Print actions without writing.
+  --help
+      Show this help.
+
+Examples:
+  bash super-gsd/install.sh --doctor
+  bash super-gsd/install.sh --init-project
+  bash super-gsd/install.sh --init-project --setup-cockpit-deps
+  bash super-gsd/install.sh --update
+  bash super-gsd/install.sh --update --install-global
+  bash super-gsd/install.sh --install-global --dry-run
+  bash super-gsd/install.sh --enable-autoapprove
+EOF
+}
+
+log() { echo "  [super-gsd] $1"; }
+
+run() {
+  if [ "$DRY_RUN" = true ]; then
+    log "DRY RUN: $*"
+  else
+    "$@"
+  fi
+}
+
+copy_file() {
+  if [ "$DRY_RUN" = true ]; then
+    log "DRY RUN: $1 -> $2"
+  else
+    if [ -e "$2" ] && command -v readlink >/dev/null 2>&1; then
+      src_real="$(readlink -f "$1" 2>/dev/null || true)"
+      dst_real="$(readlink -f "$2" 2>/dev/null || true)"
+      if [ -n "$src_real" ] && [ "$src_real" = "$dst_real" ]; then
+        log "  same file, skipping copy: $2"
+        return 0
+      fi
+    fi
+    mkdir -p "$(dirname "$2")"
+    if [ -d "$1" ]; then
+      cp -R "$1" "$2"
+    else
+      cp "$1" "$2"
+    fi
+  fi
+}
+
+remove_path_if_exists() {
+  target="$1"
+  if [ "$DRY_RUN" = true ]; then
+    log "DRY RUN: would remove legacy asset $target"
+    return 0
+  fi
+  if [ -e "$target" ]; then
+    rm -rf "$target"
+    log "  removed legacy asset: $target"
+  fi
+}
+
+is_legacy_brv_asset() {
+  case "$(basename "$1")" in
+    *brv*|*BRV*) return 0 ;;
+    *) return 1 ;;
+  esac
+}
+
+remove_legacy_global_assets() {
+  remove_path_if_exists "$COMMANDS_DIR/sgsd-brv-setup"
+  remove_path_if_exists "$HOOKS_DIR/brv-query-local.js"
+  remove_path_if_exists "$HOOKS_DIR/brv-curate-local.js"
+  remove_path_if_exists "$TEMPLATES_DIR/brv-seed"
+  remove_path_if_exists "$TEMPLATES_DIR/executor-brv-overlay.xml"
+  remove_path_if_exists "$TEMPLATES_DIR/planner-brv-overlay.xml"
+  remove_path_if_exists "$TEMPLATES_DIR/verifier-brv-overlay.xml"
+  remove_path_if_exists "$TEMPLATES_DIR/overwatcher/brv-query-local.js"
+  remove_path_if_exists "$TEMPLATES_DIR/overwatcher/brv-curate-local.js"
+}
+
+frontmatter_field() {
+  awk -v f="$2" '
+    /^---[[:space:]]*$/ { if (in_fm) exit; in_fm = 1; next }
+    in_fm && $0 ~ "^"f":" {
+      sub("^"f":[[:space:]]*", "")
+      gsub(/^"|"$|^'\''|'\''$/, "")
+      print
+      exit
+    }
+  ' "$1"
+}
+
+require_node_22() {
+  if ! command -v node >/dev/null 2>&1; then
+    echo "ERROR: Node.js not found. Install Node.js >= 22 first."
+    exit 1
+  fi
+  NODE_MAJOR="$(node -v | sed 's/v//' | cut -d. -f1)"
+  if [ "$NODE_MAJOR" -lt 22 ]; then
+    echo "ERROR: Node.js >= 22 required (found $(node -v))"
+    exit 1
+  fi
+}
+
+print_banner() {
+  echo ""
+  echo "========================================"
+  echo "   Super GSD Orchestrator - Installer   "
+  echo "========================================"
+  echo ""
+}
+
+doctor() {
+  echo ""
+  log "Doctor mode is read-only."
+
+  if command -v node >/dev/null 2>&1; then
+    log "Node.js: $(node -v)"
+  else
+    log "Node.js: missing"
+  fi
+
+  if command -v claude >/dev/null 2>&1; then
+    CLAUDE_VERSION="$(claude --version 2>/dev/null | head -1 || true)"
+    log "Claude CLI: ${CLAUDE_VERSION:-found}"
+    AUTOAPPROVE="$(claude config get --global autoApprove 2>/dev/null || true)"
+    if [ -n "$AUTOAPPROVE" ]; then
+      log "Claude global autoApprove: $AUTOAPPROVE"
+    else
+      log "Claude global autoApprove: empty or unavailable"
+    fi
+  else
+    log "Claude CLI: missing"
+  fi
+
+  if command -v codex >/dev/null 2>&1; then
+    CODEX_VERSION="$(codex --version 2>/dev/null | head -1 || true)"
+    log "Codex CLI: ${CODEX_VERSION:-found}"
+    CODEX_STATUS="$(codex login status 2>&1 || true)"
+    if echo "$CODEX_STATUS" | grep -qi "logged in"; then
+      log "Codex login: available"
+    else
+      log "Codex login: not ready ($CODEX_STATUS)"
+    fi
+  else
+    log "Codex CLI: missing"
+  fi
+
+  if [ -d "$PROJECT_DIR/.git" ]; then
+    LOCAL_HEAD="$( ( cd "$PROJECT_DIR" && git rev-parse HEAD ) 2>/dev/null || true )"
+    REMOTE_HEAD="$(git ls-remote https://github.com/Berrowj/super-gsd.git refs/heads/master 2>/dev/null | awk '{print $1}' || true)"
+    log "Project git HEAD: ${LOCAL_HEAD:-unknown}"
+    log "SGSD GitHub master: ${REMOTE_HEAD:-unavailable}"
+    if [ -n "$LOCAL_HEAD" ] && [ -n "$REMOTE_HEAD" ] && [ "$LOCAL_HEAD" = "$REMOTE_HEAD" ]; then
+      log "Freshness: local repo matches SGSD GitHub master"
+    elif [ -n "$REMOTE_HEAD" ]; then
+      log "Freshness: local repo differs from SGSD GitHub master"
+    fi
+  else
+    log "Project git HEAD: not a git repo"
+  fi
+
+  if [ -f "$PROJECT_DIR/.planning/config.json" ]; then
+    log "Project .planning/config.json: present"
+    if command -v node >/dev/null 2>&1; then
+      node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); console.log('  [super-gsd] Project config JSON: valid')" "$PROJECT_DIR/.planning/config.json" 2>/dev/null || \
+        log "Project config JSON: invalid"
+    fi
+  else
+    log "Project .planning/config.json: missing"
+  fi
+
+  [ -d "$AGENTS_DIR" ] && log "Global agents dir: present ($AGENTS_DIR)" || log "Global agents dir: missing"
+  [ -d "$COMMANDS_DIR" ] && log "Global commands dir: present ($COMMANDS_DIR)" || log "Global commands dir: missing"
+  [ -d "$HOOKS_DIR" ] && log "Global hooks dir: present ($HOOKS_DIR)" || log "Global hooks dir: missing"
+}
+
+ensure_gsd_base() {
+  if [ "$DRY_RUN" = true ]; then
+    if command -v node >/dev/null 2>&1; then
+      log "DRY RUN: Node.js available ($(node -v))"
+    else
+      log "DRY RUN: Node.js missing; actual --install-global requires Node.js >= 22"
+    fi
+  else
+    require_node_22
+  fi
+  if [ ! -d "$GSD_DIR" ]; then
+    echo ""
+    if [ "$DRY_RUN" = true ]; then
+      log "DRY RUN: would install GSD 1.0 via npx get-shit-done-cc@latest"
+    else
+      log "GSD 1.0 not found. Installing because --install-global was requested..."
+      run npx get-shit-done-cc@latest
+    fi
+  fi
+  log "GSD 1.0: $GSD_DIR"
+}
+
+install_global_assets() {
+  ensure_gsd_base
+
+  echo ""
+  log "Installing global Claude agents..."
+  AGENT_COUNT=0
+  for agent in "$SCRIPT_DIR/agents/"*.md; do
+    [ -f "$agent" ] || continue
+    name="$(basename "$agent")"
+    agent_model="$(frontmatter_field "$agent" model)"
+    case "$agent_model" in
+      sonnet|haiku)
+        log "  skipping legacy Claude agent $name ($agent_model not a fresh-clone route)"
+        continue
+        ;;
+    esac
+    copy_file "$agent" "$AGENTS_DIR/$name"
+    AGENT_COUNT=$((AGENT_COUNT + 1))
+  done
+  if [ -f "$SCRIPT_DIR/agents/sgsd-executor.md" ]; then
+    copy_file "$SCRIPT_DIR/agents/sgsd-executor.md" "$AGENTS_DIR/gsd-executor.md"
+    log "  legacy gsd-executor disabled -> Codex executor only"
+  fi
+  log "  $AGENT_COUNT agents installed"
+
+  echo ""
+  log "Installing global Claude commands..."
+  SKILL_COUNT=0
+  for skill_dir in "$SCRIPT_DIR/skills/"*/; do
+    [ -f "$skill_dir/SKILL.md" ] || continue
+    name="$(basename "$skill_dir")"
+    [ "$name" = "sgsd-brv-setup" ] && continue
+    copy_file "$skill_dir/SKILL.md" "$COMMANDS_DIR/$name/SKILL.md"
+    SKILL_COUNT=$((SKILL_COUNT + 1))
+  done
+  log "  $SKILL_COUNT commands installed"
+
+  echo ""
+  log "Installing global hooks..."
+  [ "$DRY_RUN" = true ] || mkdir -p "$HOOKS_DIR"
+  HOOK_COUNT=0
+  for hook in "$SCRIPT_DIR/hooks/"*.js; do
+    [ -f "$hook" ] || continue
+    name="$(basename "$hook")"
+    copy_file "$hook" "$HOOKS_DIR/$name"
+    HOOK_COUNT=$((HOOK_COUNT + 1))
+  done
+  log "  $HOOK_COUNT hooks installed"
+
+  echo ""
+  log "Registering hooks in ~/.claude/settings.json..."
+  SETTINGS_FILE="$CLAUDE_DIR/settings.json"
+  OVERLAY_FILE="$SCRIPT_DIR/config/settings-overlay.json"
+  MERGE_SCRIPT="$SCRIPT_DIR/scripts/merge-settings.js"
+  if [ ! -f "$OVERLAY_FILE" ]; then
+    log "  WARNING: $OVERLAY_FILE missing - skipping merge"
+  elif [ ! -f "$MERGE_SCRIPT" ]; then
+    log "  WARNING: $MERGE_SCRIPT missing - skipping merge"
+  elif [ "$DRY_RUN" = true ]; then
+    log "  DRY RUN: would merge $OVERLAY_FILE into $SETTINGS_FILE"
+  else
+    node "$MERGE_SCRIPT" "$OVERLAY_FILE" "$SETTINGS_FILE" 2>&1 | sed 's/^/  /'
+  fi
+
+  echo ""
+  log "Installing templates + overwatcher..."
+  [ "$DRY_RUN" = true ] || mkdir -p "$TEMPLATES_DIR/overwatcher"
+  for template in "$SCRIPT_DIR/templates/"*; do
+    [ -e "$template" ] || continue
+    is_legacy_brv_asset "$template" && continue
+    name="$(basename "$template")"
+    copy_file "$template" "$TEMPLATES_DIR/$name"
+  done
+  for ow in "$SCRIPT_DIR/overwatcher/"*.js "$SCRIPT_DIR/overwatcher/"*.md; do
+    [ -f "$ow" ] || continue
+    is_legacy_brv_asset "$ow" && continue
+    name="$(basename "$ow")"
+    copy_file "$ow" "$TEMPLATES_DIR/overwatcher/$name"
+  done
+  remove_legacy_global_assets
+  log "  Templates + overwatcher installed"
+
+  echo ""
+  log "Installing workflows and config..."
+  [ "$DRY_RUN" = true ] || mkdir -p "$GSD_DIR/workflows" "$GSD_DIR/config"
+  for workflow in "$SCRIPT_DIR/workflows/"*; do
+    [ -e "$workflow" ] || continue
+    name="$(basename "$workflow")"
+    copy_file "$workflow" "$GSD_DIR/workflows/$name"
+  done
+  copy_file "$SCRIPT_DIR/config/model-routing.json" "$GSD_DIR/config/model-routing.json"
+  log "  Workflows + model routing config installed"
+
+  echo ""
+  log "Installing SGSD scripts globally..."
+  [ "$DRY_RUN" = true ] || mkdir -p "$GLOBAL_SCRIPTS_DIR/lib" "$GLOBAL_SCRIPTS_DIR/watchdogs"
+  SCRIPT_COUNT=0
   for f in "$SCRIPT_DIR/scripts/"*.sh "$SCRIPT_DIR/scripts/"*.ps1; do
-    [ -f "$f" ] || continue
-    name="$(basename "$f")"
-    copy_file "$f" "$GLOBAL_SCRIPTS_DIR/$name"
-    case "$name" in
-      *.sh) [ "$DRY_RUN" = false ] && chmod +x "$GLOBAL_SCRIPTS_DIR/$name" ;;
-    esac
+    [ -f "$f" ] || continue
+    name="$(basename "$f")"
+    copy_file "$f" "$GLOBAL_SCRIPTS_DIR/$name"
+    case "$name" in
+      *.sh) [ "$DRY_RUN" = false ] && chmod +x "$GLOBAL_SCRIPTS_DIR/$name" ;;
+    esac
     SCRIPT_COUNT=$((SCRIPT_COUNT + 1))
   done
-  if [ -d "$SCRIPT_DIR/scripts/lib" ]; then
-    for f in "$SCRIPT_DIR/scripts/lib/"*; do
-      [ -f "$f" ] || continue
-      name="$(basename "$f")"
-      copy_file "$f" "$GLOBAL_SCRIPTS_DIR/lib/$name"
-    done
-  fi
-  if [ -d "$SCRIPT_DIR/scripts/watchdogs" ]; then
-    for f in "$SCRIPT_DIR/scripts/watchdogs/"*; do
-      [ -f "$f" ] || continue
-      name="$(basename "$f")"
-      copy_file "$f" "$GLOBAL_SCRIPTS_DIR/watchdogs/$name"
-      case "$name" in
-        *.sh) [ "$DRY_RUN" = false ] && chmod +x "$GLOBAL_SCRIPTS_DIR/watchdogs/$name" ;;
-      esac
-    done
+  if [ -f "$SCRIPT_DIR/scripts/sgsd" ]; then
+    copy_file "$SCRIPT_DIR/scripts/sgsd" "$GLOBAL_SCRIPTS_DIR/sgsd"
+    copy_file "$SCRIPT_DIR/scripts/sgsd" "$LOCAL_BIN_DIR/sgsd"
+    if [ "$DRY_RUN" = false ]; then
+      chmod +x "$GLOBAL_SCRIPTS_DIR/sgsd" "$LOCAL_BIN_DIR/sgsd"
+    fi
+    SCRIPT_COUNT=$((SCRIPT_COUNT + 1))
   fi
-  log "  $SCRIPT_COUNT scripts + lib + watchdogs installed to $GLOBAL_SCRIPTS_DIR"
-
-  echo ""
-  log "Global install complete. Permission settings were not changed."
-}
-
+  if [ -d "$SCRIPT_DIR/scripts/lib" ]; then
+    for f in "$SCRIPT_DIR/scripts/lib/"*; do
+      [ -f "$f" ] || continue
+      name="$(basename "$f")"
+      copy_file "$f" "$GLOBAL_SCRIPTS_DIR/lib/$name"
+    done
+  fi
+  if [ -d "$SCRIPT_DIR/scripts/watchdogs" ]; then
+    for f in "$SCRIPT_DIR/scripts/watchdogs/"*; do
+      [ -f "$f" ] || continue
+      name="$(basename "$f")"
+      copy_file "$f" "$GLOBAL_SCRIPTS_DIR/watchdogs/$name"
+      case "$name" in
+        *.sh) [ "$DRY_RUN" = false ] && chmod +x "$GLOBAL_SCRIPTS_DIR/watchdogs/$name" ;;
+      esac
+    done
+  fi
+  log "  $SCRIPT_COUNT scripts + lib + watchdogs installed to $GLOBAL_SCRIPTS_DIR"
+
+  echo ""
+  log "Global install complete. Launcher installed at $LOCAL_BIN_DIR/sgsd."
+}
+
 register_repo_local_hooks() {
   echo ""
   log "Registering repo-local Claude hooks..."
@@ -468,6 +479,25 @@ register_repo_local_hooks() {
   fi
 }
 
+register_codex_hooks() {
+  echo ""
+  log "Registering project-local Codex hooks..."
+  CODEX_HOOK_INSTALLER="$SCRIPT_DIR/tools/codex-hooks/install-hooks.cjs"
+  if [ ! -f "$CODEX_HOOK_INSTALLER" ]; then
+    echo "ERROR: Codex hook installer missing: $CODEX_HOOK_INSTALLER" >&2
+    exit 1
+  fi
+  if ! command -v node >/dev/null 2>&1; then
+    echo "ERROR: Node.js is required to install project Codex hooks" >&2
+    exit 1
+  fi
+  if [ "$DRY_RUN" = true ]; then
+    log "DRY RUN: would safely merge SGSD registrations into $PROJECT_DIR/.codex/hooks.json"
+  else
+    node "$CODEX_HOOK_INSTALLER" --project "$PROJECT_DIR"
+  fi
+}
+
 run_commit_gate_installer() {
   mode="$1"
   INSTALLER_SCRIPT="$SCRIPT_DIR/scripts/install-commit-gate.cjs"
@@ -496,253 +526,255 @@ run_commit_gate_installer() {
   fi
 }
 
-ensure_memory_tree() {
-  echo ""
-  log "Ensuring project-local .planning/memory store..."
-  if [ "$DRY_RUN" = true ]; then
-    log "DRY RUN: would create .planning/memory taxonomy + MEMORY.md"
-    return 0
-  fi
-
-  mkdir -p "$PROJECT_DIR/.planning/memory/architecture/patterns" \
-           "$PROJECT_DIR/.planning/memory/architecture/anti-patterns" \
-           "$PROJECT_DIR/.planning/memory/architecture/decisions" \
-           "$PROJECT_DIR/.planning/memory/architecture/expertise" \
-           "$PROJECT_DIR/.planning/memory/code" \
-           "$PROJECT_DIR/.planning/memory/domain" \
-           "$PROJECT_DIR/.planning/memory/workflow/user" \
-           "$PROJECT_DIR/.planning/memory/workflow/feedback" \
-           "$PROJECT_DIR/.planning/memory/workflow/preferences" \
-           "$PROJECT_DIR/.planning/memory/project" \
-           "$PROJECT_DIR/.planning/memory/reference" \
-           "$PROJECT_DIR/.planning/memory/errors" \
-           "$PROJECT_DIR/.planning/memory/trajectory/hypothesis" \
-           "$PROJECT_DIR/.planning/memory/trajectory/candidate" \
-           "$PROJECT_DIR/.planning/memory/trajectory/lesson"
-
-  MEMORY_MD="$PROJECT_DIR/.planning/memory/MEMORY.md"
-  if [ ! -f "$MEMORY_MD" ]; then
-    cat > "$MEMORY_MD" <<'EOF'
-# Memory Index
-
-Format: one markdown list item per file, readable by auto-memory and sgsd-recall.
-EOF
-    log "  Created .planning/memory/MEMORY.md"
-  else
-    log "  .planning/memory/MEMORY.md already exists"
-  fi
-}
-
-init_local_project() {
-  echo ""
-  log "Initializing project-local SGSD files only..."
-  if [ "$DRY_RUN" = true ]; then
-    log "DRY RUN: would create .planning skeleton under $PROJECT_DIR"
-  else
-    mkdir -p "$PROJECT_DIR/.planning/phases" \
-             "$PROJECT_DIR/.planning/metrics" \
-             "$PROJECT_DIR/.planning/briefs" \
-             "$PROJECT_DIR/.planning/decisions" \
-             "$PROJECT_DIR/.planning/deliberations" \
-             "$PROJECT_DIR/.planning/overwatcher"
-  fi
-
-  if [ ! -f "$PROJECT_DIR/.planning/config.json" ]; then
-    copy_file "$SCRIPT_DIR/config/planning-config-overlay.json" "$PROJECT_DIR/.planning/config.json"
-  else
-    log "  .planning/config.json already exists - leaving untouched"
-  fi
-
-  if [ "$DRY_RUN" = true ]; then
-    log "DRY RUN: would ensure .planning/metrics/token-log.jsonl exists"
-  else
-    touch "$PROJECT_DIR/.planning/metrics/token-log.jsonl"
-  fi
-
-  if [ ! -f "$PROJECT_DIR/CLAUDE.md" ]; then
-    copy_file "$SCRIPT_DIR/CLAUDE-OVERLAY.md" "$PROJECT_DIR/CLAUDE.md"
-    log "  Created CLAUDE.md from overlay"
-  else
-    log "  CLAUDE.md already exists - append super-gsd/CLAUDE-OVERLAY.md manually"
-  fi
-
-  if [ -x "$SCRIPT_DIR/scripts/sgsd-registry-sync.sh" ] && [ "$DRY_RUN" = false ]; then
-    bash "$SCRIPT_DIR/scripts/sgsd-registry-sync.sh" --root "$PROJECT_DIR" 2>/dev/null \
-      | sed 's/^/  /' \
-      || log "  WARNING: registry sync failed (non-blocking)"
-  elif [ -x "$SCRIPT_DIR/scripts/sgsd-registry-sync.sh" ]; then
-    log "DRY RUN: would sync agent registry under .planning/resource-registry"
-  fi
-
+ensure_memory_tree() {
+  echo ""
+  log "Ensuring project-local .planning/memory store..."
+  if [ "$DRY_RUN" = true ]; then
+    log "DRY RUN: would create .planning/memory taxonomy + MEMORY.md"
+    return 0
+  fi
+
+  mkdir -p "$PROJECT_DIR/.planning/memory/architecture/patterns" \
+           "$PROJECT_DIR/.planning/memory/architecture/anti-patterns" \
+           "$PROJECT_DIR/.planning/memory/architecture/decisions" \
+           "$PROJECT_DIR/.planning/memory/architecture/expertise" \
+           "$PROJECT_DIR/.planning/memory/code" \
+           "$PROJECT_DIR/.planning/memory/domain" \
+           "$PROJECT_DIR/.planning/memory/workflow/user" \
+           "$PROJECT_DIR/.planning/memory/workflow/feedback" \
+           "$PROJECT_DIR/.planning/memory/workflow/preferences" \
+           "$PROJECT_DIR/.planning/memory/project" \
+           "$PROJECT_DIR/.planning/memory/reference" \
+           "$PROJECT_DIR/.planning/memory/errors" \
+           "$PROJECT_DIR/.planning/memory/trajectory/hypothesis" \
+           "$PROJECT_DIR/.planning/memory/trajectory/candidate" \
+           "$PROJECT_DIR/.planning/memory/trajectory/lesson"
+
+  MEMORY_MD="$PROJECT_DIR/.planning/memory/MEMORY.md"
+  if [ ! -f "$MEMORY_MD" ]; then
+    cat > "$MEMORY_MD" <<'EOF'
+# Memory Index
+
+Format: one markdown list item per file, readable by auto-memory and sgsd-recall.
+EOF
+    log "  Created .planning/memory/MEMORY.md"
+  else
+    log "  .planning/memory/MEMORY.md already exists"
+  fi
+}
+
+init_local_project() {
+  echo ""
+  log "Initializing project-local SGSD files only..."
+  if [ "$DRY_RUN" = true ]; then
+    log "DRY RUN: would create .planning skeleton under $PROJECT_DIR"
+  else
+    mkdir -p "$PROJECT_DIR/.planning/phases" \
+             "$PROJECT_DIR/.planning/metrics" \
+             "$PROJECT_DIR/.planning/briefs" \
+             "$PROJECT_DIR/.planning/decisions" \
+             "$PROJECT_DIR/.planning/deliberations" \
+             "$PROJECT_DIR/.planning/overwatcher"
+  fi
+
+  if [ ! -f "$PROJECT_DIR/.planning/config.json" ]; then
+    copy_file "$SCRIPT_DIR/config/planning-config-overlay.json" "$PROJECT_DIR/.planning/config.json"
+  else
+    log "  .planning/config.json already exists - leaving untouched"
+  fi
+
+  if [ "$DRY_RUN" = true ]; then
+    log "DRY RUN: would ensure .planning/metrics/token-log.jsonl exists"
+  else
+    touch "$PROJECT_DIR/.planning/metrics/token-log.jsonl"
+  fi
+
+  if [ ! -f "$PROJECT_DIR/CLAUDE.md" ]; then
+    copy_file "$SCRIPT_DIR/CLAUDE-OVERLAY.md" "$PROJECT_DIR/CLAUDE.md"
+    log "  Created CLAUDE.md from overlay"
+  else
+    log "  CLAUDE.md already exists - append super-gsd/CLAUDE-OVERLAY.md manually"
+  fi
+
+  if [ -x "$SCRIPT_DIR/scripts/sgsd-registry-sync.sh" ] && [ "$DRY_RUN" = false ]; then
+    bash "$SCRIPT_DIR/scripts/sgsd-registry-sync.sh" --root "$PROJECT_DIR" 2>/dev/null \
+      | sed 's/^/  /' \
+      || log "  WARNING: registry sync failed (non-blocking)"
+  elif [ -x "$SCRIPT_DIR/scripts/sgsd-registry-sync.sh" ]; then
+    log "DRY RUN: would sync agent registry under .planning/resource-registry"
+  fi
+
   ensure_memory_tree
   register_repo_local_hooks
-
-  # P143.5: cockpit dependencies. Skipped if no package.json at PROJECT_DIR
-  # (operators using SGSD as an embedded subdir of a different project don't
-  # have a root package.json and shouldn't be forced into one). Skipped if
-  # --skip-cockpit-deps was passed. The chromium binary is ~112MB; running it
-  # requires explicit operator consent on bandwidth-constrained machines, so
-  # we print the command and only run it when --setup-cockpit-deps is given.
-  if [ "$SKIP_COCKPIT_DEPS" = true ]; then
-    log "Skipping cockpit dep install (--skip-cockpit-deps)."
-  elif [ -f "$PROJECT_DIR/package.json" ] && command -v npm >/dev/null 2>&1; then
-    if [ "$DRY_RUN" = true ]; then
-      log "DRY RUN: would run 'npm install' in $PROJECT_DIR"
-      log "DRY RUN: would run 'npm run cockpit:setup' (downloads ~112MB Chromium)"
-    else
-      log "Installing cockpit npm deps (includes Playwright for ATC visual gate)..."
-      ( cd "$PROJECT_DIR" && npm install --no-audit --no-fund 2>&1 | sed 's/^/  /' ) \
-        || log "  WARNING: npm install failed (run manually: npm install)"
-      if [ "$SETUP_COCKPIT_DEPS" = true ]; then
-        # P143.6 — on Linux, Chromium needs apt-installed system libs to
-        # actually launch (libnss3, libatk-bridge2.0-0, etc.). The Linux
-        # variant uses `--with-deps`; it requires sudo. On Windows/macOS
-        # the binary download alone is sufficient.
-        if [ "$(uname -s 2>/dev/null)" = "Linux" ]; then
-          log "Detected Linux. Chromium needs system libs (libnss3 etc.)."
-          if [ "$EUID" = "0" ] || [ "$(id -u)" = "0" ]; then
-            log "Running 'npm run cockpit:setup-linux' (apt-installs deps + downloads Chromium)..."
-            ( cd "$PROJECT_DIR" && npm run --silent cockpit:setup-linux 2>&1 | sed 's/^/  /' ) \
-              || log "  WARNING: chromium install failed"
-          else
-            log "  Not running as root. Run manually with sudo:"
-            log "    sudo npm run cockpit:setup-linux"
-            log "  Or skip system libs (Chromium will fail to launch without them):"
-            log "    npm run cockpit:setup"
-          fi
-        else
-          log "Downloading Chromium binary for Playwright (one-time, ~112MB)..."
-          ( cd "$PROJECT_DIR" && npm run --silent cockpit:setup 2>&1 | sed 's/^/  /' ) \
-            || log "  WARNING: chromium install failed (run manually: npm run cockpit:setup)"
-        fi
-      else
-        log "  Chromium binary NOT downloaded. Run manually when ready:"
-        log "    cd $PROJECT_DIR && npm run cockpit:setup"
-        log "  (~112MB; required for the ATC playwright gate to work)"
-      fi
-    fi
-  fi
-
-  log "Project-local initialization complete."
-}
-
-update_existing() {
-  # P143.6 surgical update of an existing SGSD install. Never touches
-  # operator state (.planning/, CLAUDE.md, config.json) — only refreshes
-  # the things that legitimately need a pull after a git update: npm deps,
-  # agent registry, memory taxonomy, and repo-local hook settings.
-  echo ""
-  log "Updating existing SGSD install in $PROJECT_DIR..."
-
-  if [ ! -f "$PROJECT_DIR/.planning/config.json" ] && [ ! -d "$PROJECT_DIR/.planning" ]; then
-    log "  WARN: no .planning/ directory found at $PROJECT_DIR"
-    log "  This looks like a first install, not an update."
-    log "  Run: bash super-gsd/install.sh --init-project"
-    return 0
-  fi
-
-  # 1. npm install — picks up new dependencies in package.json
-  if [ -f "$PROJECT_DIR/package.json" ] && command -v npm >/dev/null 2>&1; then
-    if [ "$DRY_RUN" = true ]; then
-      log "DRY RUN: would run 'npm install' in $PROJECT_DIR"
-    else
-      log "Refreshing npm dependencies..."
-      ( cd "$PROJECT_DIR" && npm install --no-audit --no-fund 2>&1 | sed 's/^/  /' ) \
-        || log "  WARNING: npm install failed (re-run manually)"
-    fi
-  else
-    log "  Skipping npm install (no package.json or npm not in PATH)"
-  fi
-
-  # 2. Agent registry sync — picks up newly-added agents/commands/skills
-  if [ -x "$SCRIPT_DIR/scripts/sgsd-registry-sync.sh" ]; then
-    if [ "$DRY_RUN" = true ]; then
-      log "DRY RUN: would sync agent registry under .planning/resource-registry"
-    else
-      log "Syncing agent / skill / command registry..."
-      bash "$SCRIPT_DIR/scripts/sgsd-registry-sync.sh" --root "$PROJECT_DIR" 2>/dev/null \
-        | sed 's/^/  /' \
-        || log "  WARNING: registry sync failed (non-blocking)"
-    fi
-  fi
-
-  # 3. Memory taxonomy — ensure new memory dirs exist if the schema grew.
-  # ensure_memory_tree is idempotent; existing entries are left untouched.
+  register_codex_hooks
+
+  # P143.5: cockpit dependencies. Skipped if no package.json at PROJECT_DIR
+  # (operators using SGSD as an embedded subdir of a different project don't
+  # have a root package.json and shouldn't be forced into one). Skipped if
+  # --skip-cockpit-deps was passed. The chromium binary is ~112MB; running it
+  # requires explicit operator consent on bandwidth-constrained machines, so
+  # we print the command and only run it when --setup-cockpit-deps is given.
+  if [ "$SKIP_COCKPIT_DEPS" = true ]; then
+    log "Skipping cockpit dep install (--skip-cockpit-deps)."
+  elif [ -f "$PROJECT_DIR/package.json" ] && command -v npm >/dev/null 2>&1; then
+    if [ "$DRY_RUN" = true ]; then
+      log "DRY RUN: would run 'npm install' in $PROJECT_DIR"
+      log "DRY RUN: would run 'npm run cockpit:setup' (downloads ~112MB Chromium)"
+    else
+      log "Installing cockpit npm deps (includes Playwright for ATC visual gate)..."
+      ( cd "$PROJECT_DIR" && npm install --no-audit --no-fund 2>&1 | sed 's/^/  /' ) \
+        || log "  WARNING: npm install failed (run manually: npm install)"
+      if [ "$SETUP_COCKPIT_DEPS" = true ]; then
+        # P143.6 — on Linux, Chromium needs apt-installed system libs to
+        # actually launch (libnss3, libatk-bridge2.0-0, etc.). The Linux
+        # variant uses `--with-deps`; it requires sudo. On Windows/macOS
+        # the binary download alone is sufficient.
+        if [ "$(uname -s 2>/dev/null)" = "Linux" ]; then
+          log "Detected Linux. Chromium needs system libs (libnss3 etc.)."
+          if [ "$EUID" = "0" ] || [ "$(id -u)" = "0" ]; then
+            log "Running 'npm run cockpit:setup-linux' (apt-installs deps + downloads Chromium)..."
+            ( cd "$PROJECT_DIR" && npm run --silent cockpit:setup-linux 2>&1 | sed 's/^/  /' ) \
+              || log "  WARNING: chromium install failed"
+          else
+            log "  Not running as root. Run manually with sudo:"
+            log "    sudo npm run cockpit:setup-linux"
+            log "  Or skip system libs (Chromium will fail to launch without them):"
+            log "    npm run cockpit:setup"
+          fi
+        else
+          log "Downloading Chromium binary for Playwright (one-time, ~112MB)..."
+          ( cd "$PROJECT_DIR" && npm run --silent cockpit:setup 2>&1 | sed 's/^/  /' ) \
+            || log "  WARNING: chromium install failed (run manually: npm run cockpit:setup)"
+        fi
+      else
+        log "  Chromium binary NOT downloaded. Run manually when ready:"
+        log "    cd $PROJECT_DIR && npm run cockpit:setup"
+        log "  (~112MB; required for the ATC playwright gate to work)"
+      fi
+    fi
+  fi
+
+  log "Project-local initialization complete."
+}
+
+update_existing() {
+  # P143.6 surgical update of an existing SGSD install. Never touches
+  # operator state (.planning/, CLAUDE.md, config.json) — only refreshes
+  # the things that legitimately need a pull after a git update: npm deps,
+  # agent registry, memory taxonomy, and repo-local hook settings.
+  echo ""
+  log "Updating existing SGSD install in $PROJECT_DIR..."
+
+  if [ ! -f "$PROJECT_DIR/.planning/config.json" ] && [ ! -d "$PROJECT_DIR/.planning" ]; then
+    log "  WARN: no .planning/ directory found at $PROJECT_DIR"
+    log "  This looks like a first install, not an update."
+    log "  Run: bash super-gsd/install.sh --init-project"
+    return 0
+  fi
+
+  # 1. npm install — picks up new dependencies in package.json
+  if [ -f "$PROJECT_DIR/package.json" ] && command -v npm >/dev/null 2>&1; then
+    if [ "$DRY_RUN" = true ]; then
+      log "DRY RUN: would run 'npm install' in $PROJECT_DIR"
+    else
+      log "Refreshing npm dependencies..."
+      ( cd "$PROJECT_DIR" && npm install --no-audit --no-fund 2>&1 | sed 's/^/  /' ) \
+        || log "  WARNING: npm install failed (re-run manually)"
+    fi
+  else
+    log "  Skipping npm install (no package.json or npm not in PATH)"
+  fi
+
+  # 2. Agent registry sync — picks up newly-added agents/commands/skills
+  if [ -x "$SCRIPT_DIR/scripts/sgsd-registry-sync.sh" ]; then
+    if [ "$DRY_RUN" = true ]; then
+      log "DRY RUN: would sync agent registry under .planning/resource-registry"
+    else
+      log "Syncing agent / skill / command registry..."
+      bash "$SCRIPT_DIR/scripts/sgsd-registry-sync.sh" --root "$PROJECT_DIR" 2>/dev/null \
+        | sed 's/^/  /' \
+        || log "  WARNING: registry sync failed (non-blocking)"
+    fi
+  fi
+
+  # 3. Memory taxonomy — ensure new memory dirs exist if the schema grew.
+  # ensure_memory_tree is idempotent; existing entries are left untouched.
   ensure_memory_tree
   register_repo_local_hooks
-
-  # 4. Diff check for CLAUDE.md — DO NOT overwrite. Just tell the operator
-  # if the bundled overlay has diverged from their CLAUDE.md so they can
-  # merge manually.
-  if [ -f "$PROJECT_DIR/CLAUDE.md" ] && [ -f "$SCRIPT_DIR/CLAUDE-OVERLAY.md" ]; then
-    if ! diff -q "$PROJECT_DIR/CLAUDE.md" "$SCRIPT_DIR/CLAUDE-OVERLAY.md" >/dev/null 2>&1; then
-      log "  NOTE: CLAUDE.md differs from super-gsd/CLAUDE-OVERLAY.md"
-      log "  This is expected if you customized CLAUDE.md. Compare manually:"
-      log "    diff CLAUDE.md super-gsd/CLAUDE-OVERLAY.md"
-    fi
-  fi
-
-  # 5. Diff check for config.json. Same policy — never overwrite.
-  if [ -f "$PROJECT_DIR/.planning/config.json" ] && [ -f "$SCRIPT_DIR/config/planning-config-overlay.json" ]; then
-    if ! diff -q "$PROJECT_DIR/.planning/config.json" "$SCRIPT_DIR/config/planning-config-overlay.json" >/dev/null 2>&1; then
-      log "  NOTE: .planning/config.json differs from the bundled overlay."
-      log "  Compare manually if you want to pick up new defaults:"
-      log "    diff .planning/config.json super-gsd/config/planning-config-overlay.json"
-    fi
-  fi
-
-  # 6. Cockpit deps (Chromium) — opt-in same as --init-project.
-  if [ "$SETUP_COCKPIT_DEPS" = true ] && [ -f "$PROJECT_DIR/package.json" ]; then
-    if [ "$DRY_RUN" = true ]; then
-      log "DRY RUN: would run cockpit:setup (Linux uses --with-deps under sudo)"
-    elif [ "$(uname -s 2>/dev/null)" = "Linux" ]; then
-      if [ "$EUID" = "0" ] || [ "$(id -u)" = "0" ]; then
-        log "Detected Linux + root. Running 'npm run cockpit:setup-linux'..."
-        ( cd "$PROJECT_DIR" && npm run --silent cockpit:setup-linux 2>&1 | sed 's/^/  /' ) \
-          || log "  WARNING: chromium install failed"
-      else
-        log "Detected Linux. Run as root for system libs:"
-        log "  sudo npm run cockpit:setup-linux"
-      fi
-    else
-      log "Downloading Chromium binary for Playwright..."
-      ( cd "$PROJECT_DIR" && npm run --silent cockpit:setup 2>&1 | sed 's/^/  /' ) \
-        || log "  WARNING: chromium install failed"
-    fi
-  fi
-
-  log "Update complete. Operator state (.planning/, CLAUDE.md, config.json) untouched."
-}
-
-enable_autoapprove() {
-  echo ""
-  log "Enabling global Claude autoApprove because --enable-autoapprove was requested."
-  log "This affects every Claude Code session for this OS user."
-  if [ "$DRY_RUN" = true ]; then
-    log "DRY RUN: would run claude config set --global autoApprove \"Bash,Read,Write,Edit,Glob,Grep,Agent,WebFetch,WebSearch\""
-    return 0
-  fi
-  if ! command -v claude >/dev/null 2>&1; then
-    echo "ERROR: claude CLI not found. Cannot set autoApprove."
-    exit 1
-  fi
-  claude config set --global autoApprove "Bash,Read,Write,Edit,Glob,Grep,Agent,WebFetch,WebSearch"
-  log "Global autoApprove enabled."
-}
-
-for arg in "$@"; do
-  case "$arg" in
-    --doctor)
-      RUN_DOCTOR=true
-      SAW_ACTION=true
-      ;;
-    --init-local|--init-project)
-      INIT_LOCAL=true
-      SAW_ACTION=true
-      ;;
-    --update)
-      UPDATE_MODE=true
-      SAW_ACTION=true
+  register_codex_hooks
+
+  # 4. Diff check for CLAUDE.md — DO NOT overwrite. Just tell the operator
+  # if the bundled overlay has diverged from their CLAUDE.md so they can
+  # merge manually.
+  if [ -f "$PROJECT_DIR/CLAUDE.md" ] && [ -f "$SCRIPT_DIR/CLAUDE-OVERLAY.md" ]; then
+    if ! diff -q "$PROJECT_DIR/CLAUDE.md" "$SCRIPT_DIR/CLAUDE-OVERLAY.md" >/dev/null 2>&1; then
+      log "  NOTE: CLAUDE.md differs from super-gsd/CLAUDE-OVERLAY.md"
+      log "  This is expected if you customized CLAUDE.md. Compare manually:"
+      log "    diff CLAUDE.md super-gsd/CLAUDE-OVERLAY.md"
+    fi
+  fi
+
+  # 5. Diff check for config.json. Same policy — never overwrite.
+  if [ -f "$PROJECT_DIR/.planning/config.json" ] && [ -f "$SCRIPT_DIR/config/planning-config-overlay.json" ]; then
+    if ! diff -q "$PROJECT_DIR/.planning/config.json" "$SCRIPT_DIR/config/planning-config-overlay.json" >/dev/null 2>&1; then
+      log "  NOTE: .planning/config.json differs from the bundled overlay."
+      log "  Compare manually if you want to pick up new defaults:"
+      log "    diff .planning/config.json super-gsd/config/planning-config-overlay.json"
+    fi
+  fi
+
+  # 6. Cockpit deps (Chromium) — opt-in same as --init-project.
+  if [ "$SETUP_COCKPIT_DEPS" = true ] && [ -f "$PROJECT_DIR/package.json" ]; then
+    if [ "$DRY_RUN" = true ]; then
+      log "DRY RUN: would run cockpit:setup (Linux uses --with-deps under sudo)"
+    elif [ "$(uname -s 2>/dev/null)" = "Linux" ]; then
+      if [ "$EUID" = "0" ] || [ "$(id -u)" = "0" ]; then
+        log "Detected Linux + root. Running 'npm run cockpit:setup-linux'..."
+        ( cd "$PROJECT_DIR" && npm run --silent cockpit:setup-linux 2>&1 | sed 's/^/  /' ) \
+          || log "  WARNING: chromium install failed"
+      else
+        log "Detected Linux. Run as root for system libs:"
+        log "  sudo npm run cockpit:setup-linux"
+      fi
+    else
+      log "Downloading Chromium binary for Playwright..."
+      ( cd "$PROJECT_DIR" && npm run --silent cockpit:setup 2>&1 | sed 's/^/  /' ) \
+        || log "  WARNING: chromium install failed"
+    fi
+  fi
+
+  log "Update complete. Operator state (.planning/, CLAUDE.md, config.json) untouched."
+}
+
+enable_autoapprove() {
+  echo ""
+  log "Enabling global Claude autoApprove because --enable-autoapprove was requested."
+  log "This affects every Claude Code session for this OS user."
+  if [ "$DRY_RUN" = true ]; then
+    log "DRY RUN: would run claude config set --global autoApprove \"Bash,Read,Write,Edit,Glob,Grep,Agent,WebFetch,WebSearch\""
+    return 0
+  fi
+  if ! command -v claude >/dev/null 2>&1; then
+    echo "ERROR: claude CLI not found. Cannot set autoApprove."
+    exit 1
+  fi
+  claude config set --global autoApprove "Bash,Read,Write,Edit,Glob,Grep,Agent,WebFetch,WebSearch"
+  log "Global autoApprove enabled."
+}
+
+for arg in "$@"; do
+  case "$arg" in
+    --doctor)
+      RUN_DOCTOR=true
+      SAW_ACTION=true
+      ;;
+    --init-local|--init-project)
+      INIT_LOCAL=true
+      SAW_ACTION=true
+      ;;
+    --update)
+      UPDATE_MODE=true
+      SAW_ACTION=true
       ;;
     --install-global)
       INSTALL_GLOBAL=true
@@ -755,41 +787,41 @@ for arg in "$@"; do
     --uninstall-commit-gate)
       UNINSTALL_COMMIT_GATE=true
       SAW_ACTION=true
-      ;;
-    --enable-autoapprove)
-      ENABLE_AUTOAPPROVE=true
-      SAW_ACTION=true
-      ;;
-    --skip-brv)
-      log "--skip-brv accepted as a no-op; current SGSD uses .planning/memory."
-      ;;
-    --skip-cockpit-deps)
-      SKIP_COCKPIT_DEPS=true
-      ;;
-    --setup-cockpit-deps)
-      # Opt-in for the ~112MB Chromium download as part of --init-project.
-      SETUP_COCKPIT_DEPS=true
-      ;;
-    --with-brv)
-      echo "ERROR: --with-brv is no longer supported. Current SGSD uses .planning/memory; run sgsd-memory-migrate for legacy BRV projects."
-      exit 1
-      ;;
-    --dry-run)
-      DRY_RUN=true
-      ;;
-    --help|-h)
-      usage
-      exit 0
-      ;;
-    *)
-      echo "ERROR: unknown argument '$arg'"
-      echo ""
-      usage
-      exit 1
-      ;;
-  esac
-done
-
+      ;;
+    --enable-autoapprove)
+      ENABLE_AUTOAPPROVE=true
+      SAW_ACTION=true
+      ;;
+    --skip-brv)
+      log "--skip-brv accepted as a no-op; current SGSD uses .planning/memory."
+      ;;
+    --skip-cockpit-deps)
+      SKIP_COCKPIT_DEPS=true
+      ;;
+    --setup-cockpit-deps)
+      # Opt-in for the ~112MB Chromium download as part of --init-project.
+      SETUP_COCKPIT_DEPS=true
+      ;;
+    --with-brv)
+      echo "ERROR: --with-brv is no longer supported. Current SGSD uses .planning/memory; run sgsd-memory-migrate for legacy BRV projects."
+      exit 1
+      ;;
+    --dry-run)
+      DRY_RUN=true
+      ;;
+    --help|-h)
+      usage
+      exit 0
+      ;;
+    *)
+      echo "ERROR: unknown argument '$arg'"
+      echo ""
+      usage
+      exit 1
+      ;;
+  esac
+done
+
 if [ "$INSTALL_COMMIT_GATE" = true ] && [ "$UNINSTALL_COMMIT_GATE" = true ]; then
   echo "[SGSD] commit-gate installer usage_conflict: choose install or uninstall, not both" >&2
   exit 1
@@ -797,22 +829,22 @@ fi
 
 if [ "$SAW_ACTION" = false ]; then
   RUN_DOCTOR=true
-fi
-
-print_banner
-
-if [ "$RUN_DOCTOR" = true ]; then
-  doctor
-fi
-
-if [ "$INSTALL_GLOBAL" = true ]; then
-  install_global_assets
-fi
-
-if [ "$INIT_LOCAL" = true ]; then
-  init_local_project
-fi
-
+fi
+
+print_banner
+
+if [ "$RUN_DOCTOR" = true ]; then
+  doctor
+fi
+
+if [ "$INSTALL_GLOBAL" = true ]; then
+  install_global_assets
+fi
+
+if [ "$INIT_LOCAL" = true ]; then
+  init_local_project
+fi
+
 if [ "$UPDATE_MODE" = true ]; then
   update_existing
 fi
@@ -825,33 +857,33 @@ if [ "$UNINSTALL_COMMIT_GATE" = true ]; then
   run_commit_gate_installer uninstall
 fi
 
-if [ "$ENABLE_AUTOAPPROVE" = true ]; then
-  enable_autoapprove
-fi
-
-echo ""
-echo "========================================"
-echo "       SGSD Installer Summary           "
-echo "========================================"
-echo ""
-echo "Actions:"
-[ "$RUN_DOCTOR" = true ] && echo "  doctor: read-only checks"
-[ "$INSTALL_GLOBAL" = true ] && echo "  install-global: ~/.claude assets updated"
-[ "$INIT_LOCAL" = true ] && echo "  init-local: project-local SGSD files and hooks updated"
-[ "$UPDATE_MODE" = true ] && echo "  update: refreshed npm + registry + repo-local hooks"
+if [ "$ENABLE_AUTOAPPROVE" = true ]; then
+  enable_autoapprove
+fi
+
+echo ""
+echo "========================================"
+echo "       SGSD Installer Summary           "
+echo "========================================"
+echo ""
+echo "Actions:"
+[ "$RUN_DOCTOR" = true ] && echo "  doctor: read-only checks"
+[ "$INSTALL_GLOBAL" = true ] && echo "  install-global: ~/.claude assets updated"
+[ "$INIT_LOCAL" = true ] && echo "  init-local: project-local SGSD files and Claude/Codex hooks updated"
+[ "$UPDATE_MODE" = true ] && echo "  update: refreshed npm + registry + repo-local Claude/Codex hooks"
 [ "$INSTALL_COMMIT_GATE" = true ] && echo "  install-commit-gate: Git pre-commit trampoline installed/refreshed"
-[ "$UNINSTALL_COMMIT_GATE" = true ] && echo "  uninstall-commit-gate: SGSD-marked Git pre-commit trampoline removed/no-op"
-[ "$ENABLE_AUTOAPPROVE" = true ] && echo "  enable-autoapprove: global Claude permissions changed"
-echo "  memory: .planning/memory"
-echo ""
-echo "Next safe commands:"
-echo "  bash super-gsd/install.sh --doctor"
-echo "  bash super-gsd/install.sh --init-project"
-echo "  bash super-gsd/install.sh --update"
+[ "$UNINSTALL_COMMIT_GATE" = true ] && echo "  uninstall-commit-gate: SGSD-marked Git pre-commit trampoline removed/no-op"
+[ "$ENABLE_AUTOAPPROVE" = true ] && echo "  enable-autoapprove: global Claude permissions changed"
+echo "  memory: .planning/memory"
+echo ""
+echo "Next safe commands:"
+echo "  bash super-gsd/install.sh --doctor"
+echo "  bash super-gsd/install.sh --init-project"
+echo "  bash super-gsd/install.sh --update"
 echo "  bash super-gsd/install.sh --install-commit-gate --dry-run"
 echo "  bash super-gsd/install.sh --uninstall-commit-gate --dry-run"
-echo "  bash super-gsd/install.sh --install-global --dry-run"
-echo ""
-if [ "$SAW_ACTION" = false ]; then
-  usage
+echo "  bash super-gsd/install.sh --install-global --dry-run"
+echo ""
+if [ "$SAW_ACTION" = false ]; then
+  usage
 fi
diff --git a/super-gsd/scripts/lib/sgsd-readiness.ps1 b/super-gsd/scripts/lib/sgsd-readiness.ps1
index bd40663..c86f136 100644
--- a/super-gsd/scripts/lib/sgsd-readiness.ps1
+++ b/super-gsd/scripts/lib/sgsd-readiness.ps1
@@ -1,243 +1,279 @@
-﻿# sgsd-readiness.ps1
-# Reports whether a repo is ready for full SGSD usage. Returns a list of
-# component records — each with id, description, status (OK/MISSING/STALE/WARN),
-# fix hint. The single source of truth for the wizard, the auto-trigger
-# guard, and `sgsd-doctor`.
-#
-# Usage:
-#   . sgsd-readiness.ps1
-#   $report = Test-SgsdReadiness -ProjectDir <path>
-#   $report | Format-Table -AutoSize
-#   $missing = $report | Where-Object { $_.Status -ne 'OK' }
-#
-# Exit code from a top-level script that calls this:
-#   0 if all OK, 1 if any missing/stale/warn — same shape as warp-doctor.
-
-function Resolve-SgsdHome {
-    # Best-effort discovery of the canonical super-gsd/ install directory.
-    # Order: $env:SGSD_HOME, walk-up from cwd, well-known fallback.
-    param([string]$StartDir = (Get-Location).Path)
-
-    if ($env:SGSD_HOME -and (Test-Path -LiteralPath $env:SGSD_HOME)) {
-        return (Resolve-Path -LiteralPath $env:SGSD_HOME).Path
-    }
-
-    $current = $StartDir
-    while ($current -and (Test-Path -LiteralPath $current)) {
-        $candidate = Join-Path $current 'super-gsd'
-        if ((Test-Path -LiteralPath $candidate) -and (Test-Path -LiteralPath (Join-Path $candidate 'scripts'))) {
-            return (Resolve-Path -LiteralPath $candidate).Path
-        }
-        $parent = Split-Path -Parent $current
-        if (-not $parent -or $parent -eq $current) { break }
-        $current = $parent
-    }
-
-    $wellKnown = 'C:\Users\user\GSDedits\super-gsd'
-    if (Test-Path -LiteralPath $wellKnown) { return (Resolve-Path -LiteralPath $wellKnown).Path }
-    return $null
-}
-
-function Test-SgsdReadiness {
-    param([string]$ProjectDir = (Get-Location).Path)
-
-    try { $ProjectDir = (Resolve-Path -LiteralPath $ProjectDir -ErrorAction Stop).Path } catch {}
-
-    $sgsdHome = Resolve-SgsdHome -StartDir $ProjectDir
-    $checks   = New-Object System.Collections.Generic.List[object]
-
-    function Add-Check {
-        param([string]$Id, [string]$Desc, [string]$Status, [string]$Path = '', [string]$Fix = '')
-        $script:checks.Add([pscustomobject]@{
-            Id          = $Id
-            Description = $Desc
-            Status      = $Status
-            Path        = $Path
-            Fix         = $Fix
-        })
-    }
-    $script:checks = $checks
-
-    # 1. super-gsd/ runtime
-    $superGsd = Join-Path $ProjectDir 'super-gsd'
-    $superGsdPresent = Test-Path -LiteralPath (Join-Path $superGsd 'scripts')
-    Add-Check 'super-gsd' 'super-gsd/ runtime tree (junction or local clone)' `
-        $(if ($superGsdPresent) { 'OK' } else { 'MISSING' }) $superGsd `
-        'Create directory junction to canonical install (mklink /J)'
-
-    # 2. .planning/ directory
-    $planning = Join-Path $ProjectDir '.planning'
-    Add-Check 'planning-dir' '.planning/ directory present' `
-        $(if (Test-Path -LiteralPath $planning) { 'OK' } else { 'MISSING' }) $planning `
-        'Initialize .planning/ tree with default subdirs'
+﻿# sgsd-readiness.ps1
+# Reports whether a repo is ready for full SGSD usage. Returns a list of
+# component records — each with id, description, status (OK/MISSING/STALE/WARN),
+# fix hint. The single source of truth for the wizard, the auto-trigger
+# guard, and `sgsd-doctor`.
+#
+# Usage:
+#   . sgsd-readiness.ps1
+#   $report = Test-SgsdReadiness -ProjectDir <path>
+#   $report | Format-Table -AutoSize
+#   $missing = $report | Where-Object { $_.Status -ne 'OK' }
+#
+# Exit code from a top-level script that calls this:
+#   0 if all OK, 1 if any missing/stale/warn — same shape as warp-doctor.
+
+function Resolve-SgsdHome {
+    # Best-effort discovery of the canonical super-gsd/ install directory.
+    # Order: $env:SGSD_HOME, walk-up from cwd, well-known fallback.
+    param([string]$StartDir = (Get-Location).Path)
+
+    if ($env:SGSD_HOME -and (Test-Path -LiteralPath $env:SGSD_HOME)) {
+        return (Resolve-Path -LiteralPath $env:SGSD_HOME).Path
+    }
+
+    $current = $StartDir
+    while ($current -and (Test-Path -LiteralPath $current)) {
+        $candidate = Join-Path $current 'super-gsd'
+        if ((Test-Path -LiteralPath $candidate) -and (Test-Path -LiteralPath (Join-Path $candidate 'scripts'))) {
+            return (Resolve-Path -LiteralPath $candidate).Path
+        }
+        $parent = Split-Path -Parent $current
+        if (-not $parent -or $parent -eq $current) { break }
+        $current = $parent
+    }
+
+    $wellKnown = 'C:\Users\user\GSDedits\super-gsd'
+    if (Test-Path -LiteralPath $wellKnown) { return (Resolve-Path -LiteralPath $wellKnown).Path }
+    return $null
+}
+
+function Test-SgsdReadiness {
+    param([string]$ProjectDir = (Get-Location).Path)
+
+    try { $ProjectDir = (Resolve-Path -LiteralPath $ProjectDir -ErrorAction Stop).Path } catch {}
+
+    $sgsdHome = Resolve-SgsdHome -StartDir $ProjectDir
+    $checks   = New-Object System.Collections.Generic.List[object]
+
+    function Add-Check {
+        param([string]$Id, [string]$Desc, [string]$Status, [string]$Path = '', [string]$Fix = '')
+        $script:checks.Add([pscustomobject]@{
+            Id          = $Id
+            Description = $Desc
+            Status      = $Status
+            Path        = $Path
+            Fix         = $Fix
+        })
+    }
+    $script:checks = $checks
+
+    # 1. super-gsd/ runtime
+    $superGsd = Join-Path $ProjectDir 'super-gsd'
+    $superGsdPresent = Test-Path -LiteralPath (Join-Path $superGsd 'scripts')
+    Add-Check 'super-gsd' 'super-gsd/ runtime tree (junction or local clone)' `
+        $(if ($superGsdPresent) { 'OK' } else { 'MISSING' }) $superGsd `
+        'Create directory junction to canonical install (mklink /J)'
+
+    # 2. .planning/ directory
+    $planning = Join-Path $ProjectDir '.planning'
+    Add-Check 'planning-dir' '.planning/ directory present' `
+        $(if (Test-Path -LiteralPath $planning) { 'OK' } else { 'MISSING' }) $planning `
+        'Initialize .planning/ tree with default subdirs'
+
+    # 3. STATE.md frontmatter
+    $statePath = Join-Path $planning 'STATE.md'
+    if (Test-Path -LiteralPath $statePath) {
+        $hasFrontmatter = $false
+        try {
+            $head = Get-Content -LiteralPath $statePath -TotalCount 5 -ErrorAction SilentlyContinue
+            if ($head -and $head[0] -match '^---' -and ($head -join "`n") -match 'gsd_state_version|milestone:') {
+                $hasFrontmatter = $true
+            }
+        } catch {}
+        Add-Check 'state-md' '.planning/STATE.md with valid frontmatter' `
+            $(if ($hasFrontmatter) { 'OK' } else { 'WARN' }) $statePath `
+            'Re-init STATE.md with default frontmatter template'
+    } else {
+        Add-Check 'state-md' '.planning/STATE.md with valid frontmatter' 'MISSING' $statePath `
+            'Write default STATE.md template'
+    }
+
+    # 4. .planning/milestones/
+    $milestones = Join-Path $planning 'milestones'
+    Add-Check 'milestones-dir' '.planning/milestones/ directory present' `
+        $(if (Test-Path -LiteralPath $milestones) { 'OK' } else { 'MISSING' }) $milestones `
+        'Create empty milestones/ subdir'
+
+    # 5. .planning/metrics/ (key metrics files create-on-empty so probes don't fail)
+    $metrics = Join-Path $planning 'metrics'
+    $metricsPresent = Test-Path -LiteralPath $metrics
+    $metricsKeyFiles = @('codex-log.jsonl', 'activity-log.jsonl', 'narrative.md')
+    $missingKeyMetrics = @()
+    if ($metricsPresent) {
+        foreach ($f in $metricsKeyFiles) {
+            if (-not (Test-Path -LiteralPath (Join-Path $metrics $f))) { $missingKeyMetrics += $f }
+        }
+    }
+    Add-Check 'metrics-dir' ".planning/metrics/ + key files ($($metricsKeyFiles -join ', '))" `
+        $(if ($metricsPresent -and $missingKeyMetrics.Count -eq 0) { 'OK' } elseif ($metricsPresent) { 'WARN' } else { 'MISSING' }) $metrics `
+        $(if ($missingKeyMetrics.Count -gt 0) { "Create empty: $($missingKeyMetrics -join ', ')" } else { 'Create metrics/ + empty log files' })
+
+    # 6. .planning/memory/ tree
+    $memory = Join-Path $planning 'memory'
+    $memoryIndex = Join-Path $memory 'MEMORY.md'
+    Add-Check 'memory-tree' '.planning/memory/ + MEMORY.md index' `
+        $(if (Test-Path -LiteralPath $memoryIndex) { 'OK' } elseif (Test-Path -LiteralPath $memory) { 'WARN' } else { 'MISSING' }) $memory `
+        'Initialize memory tree with empty MEMORY.md index + folder skeleton'
+
+    # 7. CLAUDE.md (root)
+    $claudeMd = Join-Path $ProjectDir 'CLAUDE.md'
+    $claudeMdHasSgsd = $false
+    if (Test-Path -LiteralPath $claudeMd) {
+        try {
+            $content = Get-Content -LiteralPath $claudeMd -Raw -ErrorAction SilentlyContinue
+            if ($content -match 'super-gsd|sgsd|SGSD|Super GSD') { $claudeMdHasSgsd = $true }
+        } catch {}
+    }
+    Add-Check 'claude-md' 'CLAUDE.md with SGSD section' `
+        $(if ($claudeMdHasSgsd) { 'OK' } elseif (Test-Path -LiteralPath $claudeMd) { 'WARN' } else { 'MISSING' }) $claudeMd `
+        $(if (Test-Path -LiteralPath $claudeMd) { 'Append SGSD overlay section (HTML-comment delimited)' } else { 'Create CLAUDE.md with full SGSD overlay' })
+
+    # 8. AGENTS.md (root) — per-repo agent rules
+    $agentsMd = Join-Path $ProjectDir 'AGENTS.md'
+    Add-Check 'agents-md' 'AGENTS.md per-repo agent rules' `
+        $(if (Test-Path -LiteralPath $agentsMd) { 'OK' } else { 'MISSING' }) $agentsMd `
+        'Create AGENTS.md from default template'
+
+    # 9. WARP.md (root) — Warp-specific
+    $warpMd = Join-Path $ProjectDir 'WARP.md'
+    Add-Check 'warp-md' 'WARP.md Warp-specific instructions' `
+        $(if (Test-Path -LiteralPath $warpMd) { 'OK' } else { 'WARN' }) $warpMd `
+        'Create WARP.md from default template (only needed if using Warp)'
+
+    # 10. .warpindexingignore
+    $wii = Join-Path $ProjectDir '.warpindexingignore'
+    Add-Check 'warpindexingignore' '.warpindexingignore present' `
+        $(if (Test-Path -LiteralPath $wii) { 'OK' } else { 'MISSING' }) $wii `
+        'Create with default exclusions (.planning/, node_modules/, etc.)'
+
+    # 11. .warp/workflows/ (Warp workflow palette)
+    $warpWorkflows = Join-Path $ProjectDir '.warp\workflows'
+    $warpWorkflowsPresent = Test-Path -LiteralPath $warpWorkflows
+    Add-Check 'warp-workflows' '.warp/workflows/ palette' `
+        $(if ($warpWorkflowsPresent) { 'OK' } else { 'WARN' }) $warpWorkflows `
+        'Junction or copy SGSD workflows from canonical install'
+
+    # 12. .mcp.json (MCP server config)
+    $mcpJson = Join-Path $ProjectDir '.mcp.json'
+    Add-Check 'mcp-json' '.mcp.json MCP server config' `
+        $(if (Test-Path -LiteralPath $mcpJson) { 'OK' } else { 'WARN' }) $mcpJson `
+        'Create .mcp.json with default SGSD MCP server entry'
+
+    # 13. .planning/resource-registry/agents.jsonl
+    $registry = Join-Path $planning 'resource-registry\agents.jsonl'
+    Add-Check 'resource-registry' '.planning/resource-registry/agents.jsonl' `
+        $(if (Test-Path -LiteralPath $registry) { 'OK' } else { 'WARN' }) $registry `
+        'Snapshot agents.jsonl from canonical or run /gsd-intel refresh'
+
+    # 14. .gitignore SGSD entries
+    $gitignore = Join-Path $ProjectDir '.gitignore'
+    $gitignoreOk = $false
+    if (Test-Path -LiteralPath $gitignore) {
+        try {
+            $gi = Get-Content -LiteralPath $gitignore -Raw -ErrorAction SilentlyContinue
+            if ($gi -match 'ORCHESTRATOR-CHECKPOINT|\.planning/metrics/.*\.jsonl|metrics/\*\.jsonl') {
+                $gitignoreOk = $true
+            }
+        } catch {}
+    }
+    Add-Check 'gitignore' '.gitignore has SGSD entries' `
+        $(if ($gitignoreOk) { 'OK' } elseif (Test-Path -LiteralPath $gitignore) { 'WARN' } else { 'MISSING' }) $gitignore `
+        'Append SGSD entries: .planning/metrics/*.jsonl, .planning/ORCHESTRATOR-CHECKPOINT.md, etc.'
+
+    # 15. Auto-memory junction
+    # Encoded path: ~/.claude/projects/C--Users-user-<repo>/memory/
+    $repoLeaf = Split-Path -Leaf $ProjectDir
+    $encoded  = ($ProjectDir -replace '[\\:]', '-') -replace '^-', ''
+    $autoMem  = Join-Path $env:USERPROFILE ".claude\projects\$encoded\memory"
+    $autoMemLinked = $false
+    if (Test-Path -LiteralPath $autoMem) {
+        # Check if it's a junction back to .planning/memory/
+        try {
+            $item = Get-Item -LiteralPath $autoMem -Force -ErrorAction SilentlyContinue
+            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { $autoMemLinked = $true }
+        } catch {}
+    }
+    Add-Check 'auto-memory' "Auto-memory at ~/.claude/projects/$encoded/memory linked to .planning/memory/" `
+        $(if ($autoMemLinked) { 'OK' } elseif (Test-Path -LiteralPath $autoMem) { 'WARN' } else { 'MISSING' }) $autoMem `
+        'Junction auto-memory dir to .planning/memory/ for git tracking'
 
-    # 3. STATE.md frontmatter
-    $statePath = Join-Path $planning 'STATE.md'
-    if (Test-Path -LiteralPath $statePath) {
-        $hasFrontmatter = $false
-        try {
-            $head = Get-Content -LiteralPath $statePath -TotalCount 5 -ErrorAction SilentlyContinue
-            if ($head -and $head[0] -match '^---' -and ($head -join "`n") -match 'gsd_state_version|milestone:') {
-                $hasFrontmatter = $true
+    # 16. Project-local Codex hook registrations
+    $codexHooks = Join-Path $ProjectDir '.codex\hooks.json'
+    $codexHookStatus = 'MISSING'
+    $codexHookFix = 'Run the SGSD Codex hook safe-merge installer'
+    if (Test-Path -LiteralPath $codexHooks) {
+        $codexHookStatus = 'WARN'
+        if ($sgsdHome) {
+            $codexHookInstaller = Join-Path $sgsdHome 'tools\codex-hooks\install-hooks.cjs'
+            $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
+            if ((Test-Path -LiteralPath $codexHookInstaller) -and $nodeCommand) {
+                try {
+                    $hookJson = & $nodeCommand.Source $codexHookInstaller `
+                        --project $ProjectDir --check --json 2>$null
+                    $hookReport = ($hookJson -join "`n") | ConvertFrom-Json -ErrorAction Stop
+                    if ($hookReport.ok) {
+                        $codexHookStatus = 'OK'
+                        $codexHookFix = ''
+                    } elseif ($hookReport.status -eq 'stale') {
+                        $codexHookStatus = 'STALE'
+                        $codexHookFix = "Merge $($hookReport.missing.Count) missing, $($hookReport.stale.Count) stale, and $($hookReport.duplicates.Count) duplicate managed registrations"
+                    } else {
+                        $codexHookStatus = 'WARN'
+                        $codexHookFix = "Repair Codex hook configuration: $($hookReport.status)"
+                    }
+                } catch {
+                    $codexHookStatus = 'WARN'
+                    $codexHookFix = 'Codex hook configuration could not be audited; run install-hooks.cjs manually'
+                }
             }
-        } catch {}
-        Add-Check 'state-md' '.planning/STATE.md with valid frontmatter' `
-            $(if ($hasFrontmatter) { 'OK' } else { 'WARN' }) $statePath `
-            'Re-init STATE.md with default frontmatter template'
-    } else {
-        Add-Check 'state-md' '.planning/STATE.md with valid frontmatter' 'MISSING' $statePath `
-            'Write default STATE.md template'
-    }
-
-    # 4. .planning/milestones/
-    $milestones = Join-Path $planning 'milestones'
-    Add-Check 'milestones-dir' '.planning/milestones/ directory present' `
-        $(if (Test-Path -LiteralPath $milestones) { 'OK' } else { 'MISSING' }) $milestones `
-        'Create empty milestones/ subdir'
-
-    # 5. .planning/metrics/ (key metrics files create-on-empty so probes don't fail)
-    $metrics = Join-Path $planning 'metrics'
-    $metricsPresent = Test-Path -LiteralPath $metrics
-    $metricsKeyFiles = @('codex-log.jsonl', 'activity-log.jsonl', 'narrative.md')
-    $missingKeyMetrics = @()
-    if ($metricsPresent) {
-        foreach ($f in $metricsKeyFiles) {
-            if (-not (Test-Path -LiteralPath (Join-Path $metrics $f))) { $missingKeyMetrics += $f }
         }
     }
-    Add-Check 'metrics-dir' ".planning/metrics/ + key files ($($metricsKeyFiles -join ', '))" `
-        $(if ($metricsPresent -and $missingKeyMetrics.Count -eq 0) { 'OK' } elseif ($metricsPresent) { 'WARN' } else { 'MISSING' }) $metrics `
-        $(if ($missingKeyMetrics.Count -gt 0) { "Create empty: $($missingKeyMetrics -join ', ')" } else { 'Create metrics/ + empty log files' })
-
-    # 6. .planning/memory/ tree
-    $memory = Join-Path $planning 'memory'
-    $memoryIndex = Join-Path $memory 'MEMORY.md'
-    Add-Check 'memory-tree' '.planning/memory/ + MEMORY.md index' `
-        $(if (Test-Path -LiteralPath $memoryIndex) { 'OK' } elseif (Test-Path -LiteralPath $memory) { 'WARN' } else { 'MISSING' }) $memory `
-        'Initialize memory tree with empty MEMORY.md index + folder skeleton'
-
-    # 7. CLAUDE.md (root)
-    $claudeMd = Join-Path $ProjectDir 'CLAUDE.md'
-    $claudeMdHasSgsd = $false
-    if (Test-Path -LiteralPath $claudeMd) {
-        try {
-            $content = Get-Content -LiteralPath $claudeMd -Raw -ErrorAction SilentlyContinue
-            if ($content -match 'super-gsd|sgsd|SGSD|Super GSD') { $claudeMdHasSgsd = $true }
-        } catch {}
-    }
-    Add-Check 'claude-md' 'CLAUDE.md with SGSD section' `
-        $(if ($claudeMdHasSgsd) { 'OK' } elseif (Test-Path -LiteralPath $claudeMd) { 'WARN' } else { 'MISSING' }) $claudeMd `
-        $(if (Test-Path -LiteralPath $claudeMd) { 'Append SGSD overlay section (HTML-comment delimited)' } else { 'Create CLAUDE.md with full SGSD overlay' })
-
-    # 8. AGENTS.md (root) — per-repo agent rules
-    $agentsMd = Join-Path $ProjectDir 'AGENTS.md'
-    Add-Check 'agents-md' 'AGENTS.md per-repo agent rules' `
-        $(if (Test-Path -LiteralPath $agentsMd) { 'OK' } else { 'MISSING' }) $agentsMd `
-        'Create AGENTS.md from default template'
-
-    # 9. WARP.md (root) — Warp-specific
-    $warpMd = Join-Path $ProjectDir 'WARP.md'
-    Add-Check 'warp-md' 'WARP.md Warp-specific instructions' `
-        $(if (Test-Path -LiteralPath $warpMd) { 'OK' } else { 'WARN' }) $warpMd `
-        'Create WARP.md from default template (only needed if using Warp)'
-
-    # 10. .warpindexingignore
-    $wii = Join-Path $ProjectDir '.warpindexingignore'
-    Add-Check 'warpindexingignore' '.warpindexingignore present' `
-        $(if (Test-Path -LiteralPath $wii) { 'OK' } else { 'MISSING' }) $wii `
-        'Create with default exclusions (.planning/, node_modules/, etc.)'
-
-    # 11. .warp/workflows/ (Warp workflow palette)
-    $warpWorkflows = Join-Path $ProjectDir '.warp\workflows'
-    $warpWorkflowsPresent = Test-Path -LiteralPath $warpWorkflows
-    Add-Check 'warp-workflows' '.warp/workflows/ palette' `
-        $(if ($warpWorkflowsPresent) { 'OK' } else { 'WARN' }) $warpWorkflows `
-        'Junction or copy SGSD workflows from canonical install'
-
-    # 12. .mcp.json (MCP server config)
-    $mcpJson = Join-Path $ProjectDir '.mcp.json'
-    Add-Check 'mcp-json' '.mcp.json MCP server config' `
-        $(if (Test-Path -LiteralPath $mcpJson) { 'OK' } else { 'WARN' }) $mcpJson `
-        'Create .mcp.json with default SGSD MCP server entry'
-
-    # 13. .planning/resource-registry/agents.jsonl
-    $registry = Join-Path $planning 'resource-registry\agents.jsonl'
-    Add-Check 'resource-registry' '.planning/resource-registry/agents.jsonl' `
-        $(if (Test-Path -LiteralPath $registry) { 'OK' } else { 'WARN' }) $registry `
-        'Snapshot agents.jsonl from canonical or run /gsd-intel refresh'
-
-    # 14. .gitignore SGSD entries
-    $gitignore = Join-Path $ProjectDir '.gitignore'
-    $gitignoreOk = $false
-    if (Test-Path -LiteralPath $gitignore) {
-        try {
-            $gi = Get-Content -LiteralPath $gitignore -Raw -ErrorAction SilentlyContinue
-            if ($gi -match 'ORCHESTRATOR-CHECKPOINT|\.planning/metrics/.*\.jsonl|metrics/\*\.jsonl') {
-                $gitignoreOk = $true
-            }
-        } catch {}
-    }
-    Add-Check 'gitignore' '.gitignore has SGSD entries' `
-        $(if ($gitignoreOk) { 'OK' } elseif (Test-Path -LiteralPath $gitignore) { 'WARN' } else { 'MISSING' }) $gitignore `
-        'Append SGSD entries: .planning/metrics/*.jsonl, .planning/ORCHESTRATOR-CHECKPOINT.md, etc.'
-
-    # 15. Auto-memory junction
-    # Encoded path: ~/.claude/projects/C--Users-user-<repo>/memory/
-    $repoLeaf = Split-Path -Leaf $ProjectDir
-    $encoded  = ($ProjectDir -replace '[\\:]', '-') -replace '^-', ''
-    $autoMem  = Join-Path $env:USERPROFILE ".claude\projects\$encoded\memory"
-    $autoMemLinked = $false
-    if (Test-Path -LiteralPath $autoMem) {
-        # Check if it's a junction back to .planning/memory/
-        try {
-            $item = Get-Item -LiteralPath $autoMem -Force -ErrorAction SilentlyContinue
-            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { $autoMemLinked = $true }
-        } catch {}
-    }
-    Add-Check 'auto-memory' "Auto-memory at ~/.claude/projects/$encoded/memory linked to .planning/memory/" `
-        $(if ($autoMemLinked) { 'OK' } elseif (Test-Path -LiteralPath $autoMem) { 'WARN' } else { 'MISSING' }) $autoMem `
-        'Junction auto-memory dir to .planning/memory/ for git tracking'
+    Add-Check 'codex-hooks' 'Project .codex/hooks.json has current SGSD registrations' `
+        $codexHookStatus $codexHooks $codexHookFix
 
     return $checks
-}
-
-function Format-SgsdReadinessReport {
-    # Non-pipelined: caller passes the full report array.
-    # Pipeline mode would split each item into its own invocation.
-    param($Report)
-
-    if (-not $Report) { return }
-    $reportArr    = @($Report)  # force array shape even on single item
-    $okCount      = @($reportArr | Where-Object { $_.Status -eq 'OK' }).Count
-    $missingCount = @($reportArr | Where-Object { $_.Status -eq 'MISSING' }).Count
-    $warnCount    = @($reportArr | Where-Object { $_.Status -eq 'WARN' }).Count
-    $total        = $reportArr.Count
-
-    Write-Host ""
-    Write-Host "SGSD readiness: " -NoNewline -ForegroundColor White
-    Write-Host "$okCount OK" -NoNewline -ForegroundColor Green
-    Write-Host " · " -NoNewline -ForegroundColor DarkGray
-    Write-Host "$missingCount missing" -NoNewline -ForegroundColor Red
-    Write-Host " · " -NoNewline -ForegroundColor DarkGray
-    Write-Host "$warnCount warn" -NoNewline -ForegroundColor Yellow
-    Write-Host " (total $total)"
-    Write-Host ""
-
-    foreach ($c in $reportArr) {
+}
+
+function Format-SgsdReadinessReport {
+    # Non-pipelined: caller passes the full report array.
+    # Pipeline mode would split each item into its own invocation.
+    param($Report)
+
+    if (-not $Report) { return }
+    $reportArr    = @($Report)  # force array shape even on single item
+    $okCount      = @($reportArr | Where-Object { $_.Status -eq 'OK' }).Count
+    $missingCount = @($reportArr | Where-Object { $_.Status -eq 'MISSING' }).Count
+    $warnCount    = @($reportArr | Where-Object { $_.Status -eq 'WARN' }).Count
+    $total        = $reportArr.Count
+
+    Write-Host ""
+    Write-Host "SGSD readiness: " -NoNewline -ForegroundColor White
+    Write-Host "$okCount OK" -NoNewline -ForegroundColor Green
+    Write-Host " · " -NoNewline -ForegroundColor DarkGray
+    Write-Host "$missingCount missing" -NoNewline -ForegroundColor Red
+    Write-Host " · " -NoNewline -ForegroundColor DarkGray
+    Write-Host "$warnCount warn" -NoNewline -ForegroundColor Yellow
+    Write-Host " (total $total)"
+    Write-Host ""
+
+    foreach ($c in $reportArr) {
         $glyph = switch ($c.Status) {
             'OK'      { '✓' }
             'MISSING' { '✗' }
+            'STALE'   { '↻' }
             'WARN'    { '⚠' }
-            default   { '·' }
-        }
+            default   { '·' }
+        }
         $color = switch ($c.Status) {
             'OK'      { 'Green' }
             'MISSING' { 'Red' }
+            'STALE'   { 'Yellow' }
             'WARN'    { 'Yellow' }
-            default   { 'DarkGray' }
-        }
-        Write-Host ("  {0} {1,-22} " -f $glyph, $c.Id) -NoNewline -ForegroundColor $color
-        Write-Host $c.Description -ForegroundColor Gray
-    }
-    Write-Host ""
-}
+            default   { 'DarkGray' }
+        }
+        Write-Host ("  {0} {1,-22} " -f $glyph, $c.Id) -NoNewline -ForegroundColor $color
+        Write-Host $c.Description -ForegroundColor Gray
+    }
+    Write-Host ""
+}
diff --git a/super-gsd/scripts/sgsd b/super-gsd/scripts/sgsd
new file mode 100644
index 0000000..4f13811
--- /dev/null
+++ b/super-gsd/scripts/sgsd
@@ -0,0 +1,66 @@
+#!/usr/bin/env bash
+# Extensionless Linux launcher installed at ~/.local/bin/sgsd.
+
+set -u
+
+die() {
+  echo "sgsd: $*" >&2
+  exit 1
+}
+
+SELF_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd -P)" \
+  || die "cannot resolve launcher directory"
+SCRIPTS_DIR="${SGSD_SCRIPTS_DIR:-}"
+AGENTS_DIR="${SGSD_AGENTS_DIR:-}"
+SOURCE_DIR="${SGSD_SOURCE_DIR:-}"
+ARGS=("$@")
+
+# Select the boot script from the authoritative CLI override as well as
+# forwarding that override to boot for every child path it resolves.
+for ((i = 0; i < ${#ARGS[@]}; i++)); do
+  case "${ARGS[$i]}" in
+    --scripts-dir)
+      ((i + 1 < ${#ARGS[@]})) || die "--scripts-dir requires a path"
+      SCRIPTS_DIR="${ARGS[$((i + 1))]}"
+      i=$((i + 1))
+      ;;
+    --agents-dir)
+      ((i + 1 < ${#ARGS[@]})) || die "--agents-dir requires a path"
+      AGENTS_DIR="${ARGS[$((i + 1))]}"
+      i=$((i + 1))
+      ;;
+    --source-dir)
+      ((i + 1 < ${#ARGS[@]})) || die "--source-dir requires a path"
+      SOURCE_DIR="${ARGS[$((i + 1))]}"
+      i=$((i + 1))
+      ;;
+  esac
+done
+
+if [[ -z "$SCRIPTS_DIR" ]]; then
+  if [[ -f "$SELF_DIR/sgsd-boot.sh" ]]; then
+    SCRIPTS_DIR="$SELF_DIR"
+  else
+    SCRIPTS_DIR="$HOME/.claude/super-gsd/scripts"
+  fi
+fi
+[[ -n "$AGENTS_DIR" ]] || AGENTS_DIR="$HOME/.claude/agents"
+[[ -n "$SOURCE_DIR" ]] || SOURCE_DIR="$HOME/.claude/super-gsd/source"
+
+[[ -d "$SCRIPTS_DIR" ]] || die "missing SGSD scripts dir: $SCRIPTS_DIR"
+[[ -d "$AGENTS_DIR" ]] || die "missing SGSD agents dir: $AGENTS_DIR"
+[[ -d "$SOURCE_DIR" ]] || die "missing SGSD source dir: $SOURCE_DIR"
+SCRIPTS_DIR="$(cd "$SCRIPTS_DIR" 2>/dev/null && pwd -P)" \
+  || die "cannot resolve scripts dir: $SCRIPTS_DIR"
+AGENTS_DIR="$(cd "$AGENTS_DIR" 2>/dev/null && pwd -P)" \
+  || die "cannot resolve agents dir: $AGENTS_DIR"
+SOURCE_DIR="$(cd "$SOURCE_DIR" 2>/dev/null && pwd -P)" \
+  || die "cannot resolve source dir: $SOURCE_DIR"
+BOOT="$SCRIPTS_DIR/sgsd-boot.sh"
+[[ -f "$BOOT" ]] || die "missing SGSD boot script: $BOOT"
+
+exec bash "$BOOT" \
+  --scripts-dir "$SCRIPTS_DIR" \
+  --agents-dir "$AGENTS_DIR" \
+  --source-dir "$SOURCE_DIR" \
+  "$@"
diff --git a/super-gsd/scripts/sgsd-boot.sh b/super-gsd/scripts/sgsd-boot.sh
index e282a38..2f3e628 100644
--- a/super-gsd/scripts/sgsd-boot.sh
+++ b/super-gsd/scripts/sgsd-boot.sh
@@ -11,7 +11,9 @@
 # terminal windows in a cross-platform way.
 #
 # Usage:
-#   bash super-gsd/scripts/sgsd-boot.sh [--project PATH] [--skip-preflight]
+#   bash super-gsd/scripts/sgsd-boot.sh [-NoOpen|--no-open] [--project PATH]
+#     [--scripts-dir PATH] [--agents-dir PATH] [--source-dir PATH]
+#     [--skip-preflight]
 # ============================================================================
 
 set -u
@@ -30,11 +32,36 @@ fi
 export PATH
 
 PROJECT=""
+SCRIPTS="${SGSD_SCRIPTS_DIR:-}"
+AGENTS_DIR="${SGSD_AGENTS_DIR:-}"
+SOURCE_DIR="${SGSD_SOURCE_DIR:-}"
 SKIP_PREFLIGHT=false
+NO_OPEN=false
+
+die() {
+    echo "sgsd-boot: $*" >&2
+    exit 1
+}
 
 while [[ $# -gt 0 ]]; do
     case "$1" in
-        --project)        PROJECT="$2"; shift 2 ;;
+        --project)
+            [[ $# -ge 2 ]] || die "--project requires a path"
+            PROJECT="$2"; shift 2
+            ;;
+        --scripts-dir)
+            [[ $# -ge 2 ]] || die "--scripts-dir requires a path"
+            SCRIPTS="$2"; shift 2
+            ;;
+        --agents-dir)
+            [[ $# -ge 2 ]] || die "--agents-dir requires a path"
+            AGENTS_DIR="$2"; shift 2
+            ;;
+        --source-dir)
+            [[ $# -ge 2 ]] || die "--source-dir requires a path"
+            SOURCE_DIR="$2"; shift 2
+            ;;
+        -NoOpen|--no-open) NO_OPEN=true; shift ;;
         --skip-preflight) SKIP_PREFLIGHT=true; shift ;;
         --help|-h)        head -20 "$0" | tail -15; exit 0 ;;
         *) echo "sgsd-boot: unknown argument: $1" >&2; exit 2 ;;
@@ -45,19 +72,41 @@ done
 if [[ -z "$PROJECT" ]]; then
     d="$(pwd -P)"
     while [[ "$d" != "/" && "$d" != "" ]]; do
-        if [[ -d "$d/.planning" && -d "$d/super-gsd/scripts" ]]; then
+        if [[ -d "$d/.planning" ]]; then
             PROJECT="$d"
             break
         fi
         d="$(dirname "$d")"
     done
 fi
-if [[ -z "$PROJECT" || ! -d "$PROJECT/super-gsd/scripts" ]]; then
-    echo "sgsd-boot: no super-gsd project root found. Pass --project PATH." >&2
-    exit 1
+[[ -n "$PROJECT" && -d "$PROJECT" ]] || die "no SGSD project root found. Pass --project PATH."
+PROJECT="$(cd "$PROJECT" 2>/dev/null && pwd -P)" || die "cannot resolve project: $PROJECT"
+[[ -d "$PROJECT/.planning" ]] || die "missing .planning/ under $PROJECT"
+
+[[ -n "$SCRIPTS" ]] || SCRIPTS="$PROJECT/super-gsd/scripts"
+[[ -n "$AGENTS_DIR" ]] || AGENTS_DIR="$PROJECT/super-gsd/agents"
+[[ -n "$SOURCE_DIR" ]] || SOURCE_DIR="$PROJECT"
+
+[[ -d "$SCRIPTS" ]] || die "missing SGSD scripts dir: $SCRIPTS"
+[[ -d "$AGENTS_DIR" ]] || die "missing SGSD agents dir: $AGENTS_DIR"
+[[ -d "$SOURCE_DIR" ]] || die "missing SGSD source dir: $SOURCE_DIR"
+SCRIPTS="$(cd "$SCRIPTS" 2>/dev/null && pwd -P)" || die "cannot resolve scripts dir: $SCRIPTS"
+AGENTS_DIR="$(cd "$AGENTS_DIR" 2>/dev/null && pwd -P)" || die "cannot resolve agents dir: $AGENTS_DIR"
+SOURCE_DIR="$(cd "$SOURCE_DIR" 2>/dev/null && pwd -P)" || die "cannot resolve source dir: $SOURCE_DIR"
+FORCE_REGISTRY_SYNC=false
+[[ "$AGENTS_DIR" == "$PROJECT/super-gsd/agents" ]] || FORCE_REGISTRY_SYNC=true
+
+FRAMEWORK_HEAD="$(git -C "$SOURCE_DIR" rev-parse --verify 'HEAD^{commit}' 2>/dev/null)" \
+    || die "cannot resolve canonical source HEAD: $SOURCE_DIR"
+[[ "$FRAMEWORK_HEAD" =~ ^[0-9a-fA-F]{40}$ ]] \
+    || die "canonical source HEAD is not a full commit SHA: $FRAMEWORK_HEAD"
+
+PROJECT_PIN="not-pinned"
+if [[ -e "$PROJECT/.super-gsd-version" ]]; then
+    [[ -f "$PROJECT/.super-gsd-version" ]] || die "project pin is not a file: $PROJECT/.super-gsd-version"
+    PROJECT_PIN="$(tr -d '[:space:]' < "$PROJECT/.super-gsd-version")"
 fi
 
-SCRIPTS="$PROJECT/super-gsd/scripts"
 COCKPIT_SERVER_START="$SCRIPTS/start-cockpit-server.sh"
 
 # ── Banner ──
@@ -66,8 +115,25 @@ echo "================================================"
 echo "          SUPER GSD · Boot Command              "
 echo "================================================"
 echo "  Project: $PROJECT"
+echo "  Framework Source: $SOURCE_DIR"
+echo "  Framework Scripts: $SCRIPTS"
+echo "  Framework Agents: $AGENTS_DIR"
+echo "  Framework HEAD: $FRAMEWORK_HEAD"
+echo "  Project Pin: $PROJECT_PIN"
 echo ""
 
+if [[ "$PROJECT_PIN" != "not-pinned" ]]; then
+    [[ "$PROJECT_PIN" =~ ^[0-9a-fA-F]{40}$ ]] \
+        || die "project pin is not a full commit SHA: $PROJECT_PIN"
+    [[ "$PROJECT_PIN" == "$FRAMEWORK_HEAD" ]] \
+        || die "framework provenance mismatch: source HEAD $FRAMEWORK_HEAD != project pin $PROJECT_PIN"
+fi
+
+export SGSD_PROJECT_DIR="$PROJECT"
+export SGSD_SCRIPTS_DIR="$SCRIPTS"
+export SGSD_AGENTS_DIR="$AGENTS_DIR"
+export SGSD_SOURCE_DIR="$SOURCE_DIR"
+
 step() {
     local status="$1" label="$2"
     case "$status" in
@@ -134,14 +200,15 @@ if [[ "$SKIP_PREFLIGHT" != true ]]; then
     # Registry sync
     if [[ -x "$SCRIPTS/sgsd-registry-sync.sh" ]]; then
         MANIFEST="$PROJECT/.planning/resource-registry/agents.jsonl"
-        AGENTS_DIR="$PROJECT/super-gsd/agents"
         AGENT_COUNT=$(find "$AGENTS_DIR" -maxdepth 1 -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
         MANIFEST_COUNT=$(grep -c '^{' "$MANIFEST" 2>/dev/null || echo 0)
         NEWER_AGENT=$(find "$AGENTS_DIR" -maxdepth 1 -type f -name '*.md' -newer "$MANIFEST" -print -quit 2>/dev/null || true)
-        if [[ -f "$MANIFEST" && "$MANIFEST_COUNT" -eq "$AGENT_COUNT" && -z "$NEWER_AGENT" ]]; then
+        if [[ "$FORCE_REGISTRY_SYNC" != true && -f "$MANIFEST" \
+              && "$MANIFEST_COUNT" -eq "$AGENT_COUNT" && -z "$NEWER_AGENT" ]]; then
             step OK "Agents registry fresh ($AGENT_COUNT agents)"
         else
-            SYNC_OUT="$(bash "$SCRIPTS/sgsd-registry-sync.sh" --root "$PROJECT" 2>&1)"
+            SYNC_OUT="$(bash "$SCRIPTS/sgsd-registry-sync.sh" \
+                --root "$PROJECT" --agents-dir "$AGENTS_DIR" 2>&1)"
             if [[ $? -eq 0 ]]; then
                 COUNT=$(echo "$SYNC_OUT" | grep -oE '[0-9]+ agent records' | grep -oE '^[0-9]+')
                 step OK "Agents registry synced (${COUNT:-?} agents)"
@@ -181,7 +248,7 @@ if [[ "$SKIP_PREFLIGHT" != true ]]; then
         exit 8
     fi
 
-    FEATURE_AUDIT="$PROJECT/super-gsd/tools/feature-propagation/audit.cjs"
+    FEATURE_AUDIT="$SOURCE_DIR/super-gsd/tools/feature-propagation/audit.cjs"
     if [[ -f "$FEATURE_AUDIT" ]]; then
         AUDIT_JSON="$(node "$FEATURE_AUDIT" --project-dir "$PROJECT" --repair-safe --json 2>/dev/null || true)"
         AUDIT_OK="$(printf '%s' "$AUDIT_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{let j=JSON.parse(s);process.stdout.write(j.ok?"ok":"drift")}catch(e){process.stdout.write("parse_fail")}})' 2>/dev/null || echo parse_fail)"
@@ -217,6 +284,12 @@ if [[ "$SKIP_PREFLIGHT" != true ]]; then
 fi
 
 # ── Launch instructions ──
+if [[ "$NO_OPEN" == true ]]; then
+    echo "Preflight and provenance complete (--no-open)."
+    echo ""
+    exit 0
+fi
+
 echo "LAUNCH"
 echo "------"
 echo ""
diff --git a/super-gsd/scripts/sgsd-devcp-restart-evidence.sh b/super-gsd/scripts/sgsd-devcp-restart-evidence.sh
new file mode 100644
index 0000000..0eab976
--- /dev/null
+++ b/super-gsd/scripts/sgsd-devcp-restart-evidence.sh
@@ -0,0 +1,358 @@
+#!/usr/bin/env bash
+# Identity-verified one-shot restart evidence for devcp SGSD runtimes.
+set -euo pipefail
+
+usage() {
+  cat <<'EOF'
+Usage: sgsd-devcp-restart-evidence.sh \
+  --project ABSOLUTE_PROJECT --session TMUX_SESSION \
+  --scripts-dir ABSOLUTE_SCRIPTS --agents-dir ABSOLUTE_AGENTS \
+  --source-dir ABSOLUTE_SOURCE --evidence ABSOLUTE_JSON
+
+The helper displays canonical MCP and cockpit command lines, requires KILL,
+then invokes sgsd-remote-tmux.sh with --reset --greet --no-attach.
+EOF
+}
+
+die() { printf 'sgsd-devcp-restart-evidence: ERROR: %s\n' "$*" >&2; exit 1; }
+
+project=""
+session=""
+scripts_dir=""
+agents_dir=""
+source_dir=""
+evidence=""
+while [[ $# -gt 0 ]]; do
+  case "$1" in
+    --project) [[ $# -ge 2 ]] || die '--project requires a value'; project="$2"; shift 2 ;;
+    --session) [[ $# -ge 2 ]] || die '--session requires a value'; session="$2"; shift 2 ;;
+    --scripts-dir) [[ $# -ge 2 ]] || die '--scripts-dir requires a value'; scripts_dir="$2"; shift 2 ;;
+    --agents-dir) [[ $# -ge 2 ]] || die '--agents-dir requires a value'; agents_dir="$2"; shift 2 ;;
+    --source-dir) [[ $# -ge 2 ]] || die '--source-dir requires a value'; source_dir="$2"; shift 2 ;;
+    --evidence) [[ $# -ge 2 ]] || die '--evidence requires a value'; evidence="$2"; shift 2 ;;
+    --help|-h) usage; exit 0 ;;
+    *) die "unknown argument: $1" ;;
+  esac
+done
+
+for required in project session scripts_dir agents_dir source_dir evidence; do
+  [[ -n "${!required}" ]] || die "missing --${required//_/-}"
+done
+for directory in project scripts_dir agents_dir source_dir; do
+  value="${!directory}"
+  [[ "$value" == /* && "$value" != / && -d "$value" ]] ||
+    die "--${directory//_/-} must be an existing absolute directory"
+  printf -v "$directory" '%s' "$(cd "$value" && pwd -P)"
+done
+[[ "$evidence" == /* && "$evidence" != / ]] || die '--evidence must be an absolute file path'
+[[ -d "$project/.planning" ]] || die "project has no .planning directory: $project"
+remote_tmux="$scripts_dir/sgsd-remote-tmux.sh"
+[[ -r "$remote_tmux" ]] || die "sgsd-remote-tmux.sh is missing: $remote_tmux"
+command -v node >/dev/null 2>&1 || die 'node is required'
+command -v tmux >/dev/null 2>&1 || die 'tmux is required'
+
+runtime_dir="$(mktemp -d "${TMPDIR:-/tmp}/sgsd-restart-evidence.XXXXXX")"
+cleanup() { rm -rf -- "$runtime_dir"; }
+trap cleanup EXIT
+before_mcp="$runtime_dir/before-mcp.jsonl"
+after_mcp="$runtime_dir/after-mcp.jsonl"
+before_cockpit="$runtime_dir/before-cockpit.json"
+after_cockpit="$runtime_dir/after-cockpit.json"
+
+load_proc_identity() {
+  local pid="$1" stat_line stat_tail
+  [[ "$pid" =~ ^[0-9]+$ && -r "/proc/$pid/stat" && -r "/proc/$pid/cmdline" ]] || return 1
+  IFS= read -r stat_line < "/proc/$pid/stat" || return 1
+  stat_tail="${stat_line##*) }"
+  read -r -a stat_fields <<< "$stat_tail"
+  [[ ${#stat_fields[@]} -ge 20 ]] || return 1
+  PROC_PID="$pid"
+  PROC_PPID="${stat_fields[1]}"
+  PROC_START_TICKS="${stat_fields[19]}"
+  printf -v PROC_CMDLINE '%s' "$(tr '\0' ' ' < "/proc/$pid/cmdline")"
+  PROC_CMDLINE="${PROC_CMDLINE% }"
+  [[ -n "$PROC_CMDLINE" ]] || return 1
+}
+
+append_identity() {
+  local destination="$1"
+  SGSD_IDENTITY_DEST="$destination" SGSD_IDENTITY_PID="$PROC_PID" \
+  SGSD_IDENTITY_PPID="$PROC_PPID" SGSD_IDENTITY_START="$PROC_START_TICKS" \
+  SGSD_IDENTITY_CMDLINE="$PROC_CMDLINE" node <<'NODE'
+const fs = require('node:fs');
+const row = {
+  pid: Number(process.env.SGSD_IDENTITY_PID),
+  parent_pid: Number(process.env.SGSD_IDENTITY_PPID),
+  start_ticks: process.env.SGSD_IDENTITY_START,
+  command_line: process.env.SGSD_IDENTITY_CMDLINE,
+  live_at_write: true,
+};
+fs.appendFileSync(process.env.SGSD_IDENTITY_DEST, JSON.stringify(row) + '\n');
+NODE
+}
+
+collect_mcp_identities() {
+  local destination="$1" stat_file pid lower_cmd
+  : > "$destination"
+  mcp_count=0
+  for stat_file in /proc/[0-9]*/stat; do
+    pid="${stat_file#/proc/}"
+    pid="${pid%/stat}"
+    load_proc_identity "$pid" || continue
+    lower_cmd="${PROC_CMDLINE,,}"
+    if [[ "$lower_cmd" == *mcp* && "$PROC_CMDLINE" == *"$source_dir"* ]]; then
+      append_identity "$destination"
+      mcp_count=$((mcp_count + 1))
+    fi
+  done
+}
+
+write_cockpit_identity() {
+  local destination="$1" require_canonical="$2" pid_file="$project/.planning/runtime/cockpit-server.pid" pid
+  [[ -r "$pid_file" ]] || return 1
+  IFS= read -r pid < "$pid_file"
+  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
+  load_proc_identity "$pid" || return 1
+  [[ "$PROC_CMDLINE" == *cockpit-sidecar/serve.cjs* && "$PROC_CMDLINE" == *"$project"* ]] || return 1
+  if [[ "$require_canonical" == true ]]; then
+    [[ "$PROC_CMDLINE" == *"$scripts_dir"* ]] || return 1
+  fi
+  : > "$destination"
+  append_identity "$destination"
+}
+
+print_identity_cmdlines() {
+  local label="$1" file="$2"
+  SGSD_IDENTITY_FILE="$file" SGSD_IDENTITY_LABEL="$label" node <<'NODE'
+const fs = require('node:fs');
+const rows = fs.readFileSync(process.env.SGSD_IDENTITY_FILE, 'utf8')
+  .split(/\r?\n/).filter(Boolean).map(JSON.parse);
+for (const row of rows) {
+  process.stdout.write(`${process.env.SGSD_IDENTITY_LABEL} PID=${row.pid} start_ticks=${row.start_ticks} cmdline=${row.command_line}\n`);
+}
+NODE
+}
+
+identity_live() {
+  local pid="$1" expected_start="$2" kind="$3"
+  kill -0 "$pid" 2>/dev/null || return 1
+  load_proc_identity "$pid" || return 1
+  [[ "$PROC_START_TICKS" == "$expected_start" ]] || return 1
+  case "$kind" in
+    mcp) [[ "${PROC_CMDLINE,,}" == *mcp* && "$PROC_CMDLINE" == *"$source_dir"* ]] ;;
+    cockpit) [[ "$PROC_CMDLINE" == *cockpit-sidecar/serve.cjs* && "$PROC_CMDLINE" == *"$project"* ]] ;;
+    *) return 1 ;;
+  esac
+}
+
+terminate_identities() {
+  local file="$1" kind="$2" pid start_ticks expected_cmdline
+  while IFS=$'\t' read -r pid start_ticks expected_cmdline; do
+    identity_live "$pid" "$start_ticks" "$kind" ||
+      die "$kind identity changed before termination: $pid|$start_ticks"
+    [[ "$PROC_CMDLINE" == "$expected_cmdline" ]] ||
+      die "$kind command line changed before termination: $pid|$start_ticks"
+    kill -TERM "$pid"
+    for _ in {1..50}; do
+      identity_live "$pid" "$start_ticks" "$kind" || break
+      sleep 0.1
+    done
+    identity_live "$pid" "$start_ticks" "$kind" &&
+      die "$kind identity remained live after termination: $pid|$start_ticks"
+  done < <(SGSD_IDENTITY_FILE="$file" node <<'NODE'
+const fs = require('node:fs');
+for (const line of fs.readFileSync(process.env.SGSD_IDENTITY_FILE, 'utf8').split(/\r?\n/).filter(Boolean)) {
+  const row = JSON.parse(line);
+  process.stdout.write(`${row.pid}\t${row.start_ticks}\t${row.command_line.replaceAll('\t', ' ')}\n`);
+}
+NODE
+  )
+}
+
+tmux has-session -t "$session" 2>/dev/null || die "tmux session is not live: $session"
+read -r before_session_id before_creation_epoch before_server_pid < <(
+  tmux display-message -p -t "$session" '#{session_id} #{session_created} #{pid}'
+)
+[[ -n "$before_session_id" && -n "$before_creation_epoch" && -n "$before_server_pid" ]] ||
+  die 'could not capture tmux session_id, creation_epoch, and server_pid'
+
+collect_mcp_identities "$before_mcp"
+if [[ "$mcp_count" -lt 1 ]]; then
+  die "no canonical MCP process uses source root: $source_dir"
+fi
+write_cockpit_identity "$before_cockpit" false ||
+  die "cockpit-server.pid does not identify a live cockpit for $project"
+printf 'Verified command lines selected for termination:\n'
+print_identity_cmdlines 'MCP cmdline' "$before_mcp"
+print_identity_cmdlines 'cockpit cmdline' "$before_cockpit"
+read -r -p 'Type KILL to terminate only these verified identities: ' confirmation
+[[ "$confirmation" == KILL ]] || die 'confirmation declined; no signal sent'
+
+terminate_identities "$before_mcp" mcp
+terminate_identities "$before_cockpit" cockpit
+
+exact_command="$remote_tmux --project $project --session $session --scripts-dir $scripts_dir --agents-dir $agents_dir --source-dir $source_dir --reset --greet --no-attach"
+set +e
+restart_output="$("$remote_tmux" --project "$project" --session "$session" \
+  --scripts-dir "$scripts_dir" --agents-dir "$agents_dir" --source-dir "$source_dir" \
+  --reset --greet --no-attach 2>&1)"
+restart_code=$?
+set -e
+[[ $restart_code -eq 0 ]] || die "sgsd-remote-tmux.sh restart failed with status $restart_code"
+
+deadline=$((SECONDS + 60))
+after_ready=false
+while (( SECONDS < deadline )); do
+  collect_mcp_identities "$after_mcp"
+  if [[ "$mcp_count" -ge 1 ]] && write_cockpit_identity "$after_cockpit" true; then
+    after_ready=true
+    break
+  fi
+  sleep 1
+done
+[[ "$after_ready" == true ]] || die 'timed out waiting for canonical after MCP and cockpit identities'
+
+tmux has-session -t "$session" 2>/dev/null || die 'tmux session is absent after restart'
+read -r after_session_id after_creation_epoch after_server_pid < <(
+  tmux display-message -p -t "$session" '#{session_id} #{session_created} #{pid}'
+)
+tmux_session_identity_changed=false
+tmux_server_pid_changed=false
+if [[ "$after_session_id" != "$before_session_id" || "$after_creation_epoch" != "$before_creation_epoch" ]]; then
+  tmux_session_identity_changed=true
+fi
+if [[ "$after_server_pid" != "$before_server_pid" ]]; then
+  tmux_server_pid_changed=true
+fi
+if [[ "$tmux_session_identity_changed" != true && "$tmux_server_pid_changed" != true ]]; then
+  die 'tmux session ID, creation epoch, and server PID tuple did not change'
+fi
+
+identity_intersection="$(SGSD_BEFORE="$before_mcp" SGSD_AFTER="$after_mcp" node <<'NODE'
+const fs = require('node:fs');
+const read = (file) => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
+const before = new Set(read(process.env.SGSD_BEFORE).map((row) => `${row.pid}|${row.start_ticks}`));
+const overlap = read(process.env.SGSD_AFTER)
+  .map((row) => `${row.pid}|${row.start_ticks}`).filter((key) => before.has(key));
+process.stdout.write(JSON.stringify(overlap));
+NODE
+)"
+[[ "$identity_intersection" == '[]' ]] || die "MCP identity_intersection is not empty: $identity_intersection"
+
+cockpit_identity_changed="$(SGSD_BEFORE="$before_cockpit" SGSD_AFTER="$after_cockpit" node <<'NODE'
+const fs = require('node:fs');
+const before = JSON.parse(fs.readFileSync(process.env.SGSD_BEFORE, 'utf8'));
+const after = JSON.parse(fs.readFileSync(process.env.SGSD_AFTER, 'utf8'));
+process.stdout.write(String(before.pid !== after.pid || before.start_ticks !== after.start_ticks));
+NODE
+)"
+[[ "$cockpit_identity_changed" == true ]] || die 'cockpit_identity_changed is false'
+
+after_identities_live=true
+while IFS=$'\t' read -r pid start_ticks; do
+  identity_live "$pid" "$start_ticks" mcp || after_identities_live=false
+done < <(SGSD_IDENTITY_FILE="$after_mcp" node <<'NODE'
+const fs = require('node:fs');
+for (const line of fs.readFileSync(process.env.SGSD_IDENTITY_FILE, 'utf8').split(/\r?\n/).filter(Boolean)) {
+  const row = JSON.parse(line);
+  process.stdout.write(`${row.pid}\t${row.start_ticks}\n`);
+}
+NODE
+)
+read -r cockpit_pid cockpit_ticks < <(SGSD_IDENTITY_FILE="$after_cockpit" node <<'NODE'
+const fs = require('node:fs');
+const row = JSON.parse(fs.readFileSync(process.env.SGSD_IDENTITY_FILE, 'utf8'));
+process.stdout.write(`${row.pid} ${row.start_ticks}\n`);
+NODE
+)
+identity_live "$cockpit_pid" "$cockpit_ticks" cockpit || after_identities_live=false
+[[ "$after_identities_live" == true ]] || die 'after_identities_live check failed'
+canonical_mcp_provenance=true
+
+set +e
+doctor_output="$("$remote_tmux" --project "$project" --session "$session" \
+  --scripts-dir "$scripts_dir" --agents-dir "$agents_dir" --source-dir "$source_dir" \
+  --doctor 2>&1)"
+doctor_code=$?
+set -e
+[[ $doctor_code -eq 0 ]] || die "sgsd-remote-tmux.sh doctor failed with status $doctor_code"
+
+captured_utc="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
+machine="$(hostname)"
+redacted_output="$(printf '%s\n%s\n' "$restart_output" "$doctor_output" |
+  sed -E 's/((api[_-]?key|token|password|secret)[[:space:]]*[:=][[:space:]]*)[^[:space:]]+/\1<redacted>/Ig')"
+mkdir -p -- "$(dirname "$evidence")"
+temporary_evidence="$evidence.tmp.$$"
+SGSD_SCHEMA='sgsd.restart-evidence.v1' SGSD_PROJECT="$project" \
+SGSD_SESSION="$session" SGSD_SOURCE_DIR="$source_dir" SGSD_EXACT_COMMAND="$exact_command" \
+SGSD_CAPTURED_UTC="$captured_utc" SGSD_MACHINE="$machine" SGSD_OUTPUT="$redacted_output" \
+SGSD_BEFORE_MCP="$before_mcp" SGSD_AFTER_MCP="$after_mcp" \
+SGSD_BEFORE_COCKPIT="$before_cockpit" SGSD_AFTER_COCKPIT="$after_cockpit" \
+SGSD_IDENTITY_INTERSECTION="$identity_intersection" \
+SGSD_COCKPIT_CHANGED="$cockpit_identity_changed" \
+SGSD_TMUX_SESSION_CHANGED="$tmux_session_identity_changed" \
+SGSD_TMUX_SERVER_CHANGED="$tmux_server_pid_changed" \
+SGSD_BEFORE_SESSION_ID="$before_session_id" SGSD_BEFORE_CREATION="$before_creation_epoch" \
+SGSD_BEFORE_SERVER_PID="$before_server_pid" SGSD_AFTER_SESSION_ID="$after_session_id" \
+SGSD_AFTER_CREATION="$after_creation_epoch" SGSD_AFTER_SERVER_PID="$after_server_pid" \
+SGSD_EVIDENCE_TEMP="$temporary_evidence" node <<'NODE'
+const fs = require('node:fs');
+const readLines = (file) => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
+const readOne = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
+const base = {
+  exit_status: 'passed',
+  exact_command: process.env.SGSD_EXACT_COMMAND,
+  captured_utc: process.env.SGSD_CAPTURED_UTC,
+  machine: process.env.SGSD_MACHINE,
+  live_at_write: true,
+  redacted_output: process.env.SGSD_OUTPUT,
+};
+const mcp = {
+  ...base,
+  before_mcp_present: true,
+  after_mcp_present: true,
+  identity_intersection: JSON.parse(process.env.SGSD_IDENTITY_INTERSECTION),
+  canonical_mcp_provenance: true,
+  after_identities_live: true,
+  before: readLines(process.env.SGSD_BEFORE_MCP),
+  after: readLines(process.env.SGSD_AFTER_MCP),
+};
+const cockpit = {
+  ...base,
+  cockpit_identity_changed: process.env.SGSD_COCKPIT_CHANGED === 'true',
+  after_identities_live: true,
+  before: readOne(process.env.SGSD_BEFORE_COCKPIT),
+  after: readOne(process.env.SGSD_AFTER_COCKPIT),
+};
+const tmux = {
+  ...base,
+  tmux_session_identity_changed: process.env.SGSD_TMUX_SESSION_CHANGED === 'true',
+  tmux_server_pid_changed: process.env.SGSD_TMUX_SERVER_CHANGED === 'true',
+  before: {
+    session_id: process.env.SGSD_BEFORE_SESSION_ID,
+    creation_epoch: Number(process.env.SGSD_BEFORE_CREATION),
+    server_pid: Number(process.env.SGSD_BEFORE_SERVER_PID),
+  },
+  after: {
+    session_id: process.env.SGSD_AFTER_SESSION_ID,
+    creation_epoch: Number(process.env.SGSD_AFTER_CREATION),
+    server_pid: Number(process.env.SGSD_AFTER_SERVER_PID),
+  },
+};
+const evidence = {
+  schema: process.env.SGSD_SCHEMA,
+  exit_status: 'passed',
+  project: process.env.SGSD_PROJECT,
+  session: process.env.SGSD_SESSION,
+  source_dir: process.env.SGSD_SOURCE_DIR,
+  exact_command: process.env.SGSD_EXACT_COMMAND,
+  captured_utc: process.env.SGSD_CAPTURED_UTC,
+  machine: process.env.SGSD_MACHINE,
+  live_at_write: true,
+  redacted_output: process.env.SGSD_OUTPUT,
+  components: { mcp_restart: mcp, cockpit_restart: cockpit, tmux_restart: tmux },
+};
+fs.writeFileSync(process.env.SGSD_EVIDENCE_TEMP, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
+NODE
+mv -- "$temporary_evidence" "$evidence"
+printf 'restart_evidence=%s\n' "$evidence"
diff --git a/super-gsd/scripts/sgsd-global-snapshot.sh b/super-gsd/scripts/sgsd-global-snapshot.sh
new file mode 100644
index 0000000..51f41d8
--- /dev/null
+++ b/super-gsd/scripts/sgsd-global-snapshot.sh
@@ -0,0 +1,301 @@
+#!/usr/bin/env bash
+# Snapshot, verify, and exactly restore install.sh's global mutation boundary.
+set -euo pipefail
+
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
+INSTALLER="$SCRIPT_DIR/../install.sh"
+TARGETS=(
+  ".claude/agents"
+  ".claude/commands"
+  ".claude/hooks"
+  ".claude/settings.json"
+  ".claude/get-shit-done/templates/super-gsd"
+  ".claude/get-shit-done/workflows"
+  ".claude/get-shit-done/config/model-routing.json"
+  ".claude/super-gsd/scripts"
+  ".local/bin/sgsd"
+)
+
+usage() {
+  cat <<'EOF'
+Usage:
+  sgsd-global-snapshot.sh create  --home ABSOLUTE_HOME --output-dir ABSOLUTE_DIR
+  sgsd-global-snapshot.sh verify  --home ABSOLUTE_HOME --snapshot-dir ABSOLUTE_DIR
+  sgsd-global-snapshot.sh restore --home ABSOLUTE_HOME --snapshot-dir ABSOLUTE_DIR --failed-candidate-dir ABSOLUTE_DIR
+
+create writes manifest-before.jsonl and archive.tar. verify writes
+manifest-after.jsonl and proves the pre-install scripts path set is a subset of
+the post-install set while every scripts extra remains byte-identical. restore
+quarantines the failed candidate before reproducing the exact saved manifest.
+EOF
+}
+die() { printf 'sgsd-global-snapshot: ERROR: %s\n' "$*" >&2; exit 1; }
+
+normalize_path_arg() {
+  local value="$1"
+  case "$(uname -s 2>/dev/null || true)" in
+    MINGW*|MSYS*|CYGWIN*)
+      if command -v cygpath >/dev/null 2>&1; then cygpath -u -- "$value"; return; fi
+      ;;
+  esac
+  printf '%s\n' "$value"
+}
+node_path_arg() {
+  local value="$1"
+  case "${OSTYPE:-}" in
+    msys*|cygwin*|win32*)
+      if command -v cygpath >/dev/null 2>&1; then
+        cygpath -w -- "$value"
+        return
+      fi
+      ;;
+  esac
+  printf '%s\n' "$value"
+}
+resolved_dir() {
+  local candidate="$1"
+  if command -v realpath >/dev/null 2>&1; then realpath -- "$candidate"
+  elif command -v readlink >/dev/null 2>&1; then readlink -f -- "$candidate"
+  else (cd "$candidate" && pwd -P)
+  fi
+}
+require_absolute_safe_dir_value() {
+  local label="$1" value="$2"
+  [[ -n "$value" ]] || die "$label must not be empty"
+  [[ "$value" != "/" && "$value" != "~" ]] || die "$label is unsafe: $value"
+  [[ "$value" == /* ]] || die "$label must be absolute: $value"
+}
+validate_home() {
+  local requested="$1" expected resolved
+  [[ "$requested" != "~"* ]] || die "--home contains an unexpanded tilde path: $requested"
+  requested="$(normalize_path_arg "$requested")"
+  require_absolute_safe_dir_value "--home" "$requested"
+  [[ -d "$requested" ]] || die "--home does not exist: $requested"
+  [[ -n "${HOME:-}" ]] || die "current HOME is empty"
+  expected="$(normalize_path_arg "$HOME")"
+  [[ -d "$expected" ]] || die "current HOME does not exist: $expected"
+  resolved="$(resolved_dir "$requested")" || die "cannot resolve --home: $requested"
+  expected="$(resolved_dir "$expected")" || die "cannot resolve current HOME"
+  [[ "$resolved" == "$expected" ]] || die "--home differs from the current user's resolved home"
+  printf '%s\n' "$resolved"
+}
+validate_contract() {
+  [[ -r "$INSTALLER" ]] || die "install.sh is missing or unreadable: $INSTALLER"
+  local markers=(
+    'AGENTS_DIR="$CLAUDE_DIR/agents"'
+    'COMMANDS_DIR="$CLAUDE_DIR/commands"'
+    'HOOKS_DIR="$CLAUDE_DIR/hooks"'
+    'SETTINGS_FILE="$CLAUDE_DIR/settings.json"'
+    'TEMPLATES_DIR="$GSD_DIR/templates/super-gsd"'
+    '"$GSD_DIR/workflows'
+    '"$GSD_DIR/config/model-routing.json"'
+    'GLOBAL_SCRIPTS_DIR="$CLAUDE_DIR/super-gsd/scripts"'
+    '"$LOCAL_BIN_DIR/sgsd"'
+  )
+  local marker
+  for marker in "${markers[@]}"; do
+    grep -Fq -- "$marker" "$INSTALLER" ||
+      die "install.sh contract mismatch: missing global target marker $marker"
+  done
+}
+validate_storage_path() {
+  local label="$1" raw="$2" home="$3" normalized target live
+  normalized="$(normalize_path_arg "$raw")"
+  require_absolute_safe_dir_value "$label" "$normalized"
+  for target in "${TARGETS[@]}"; do
+    live="$home/$target"
+    case "$normalized/" in "$live/"*) die "$label must remain outside live install target $target" ;; esac
+  done
+  printf '%s\n' "$normalized"
+}
+
+write_manifest() {
+  local home="$1" destination="$2"
+  local node_home node_destination
+  node_home="$(node_path_arg "$home")"
+  node_destination="$(node_path_arg "$destination")"
+  SGSD_SNAPSHOT_HOME="$node_home" SGSD_SNAPSHOT_DESTINATION="$node_destination" \
+  SGSD_SNAPSHOT_TARGETS="$(printf '%s\n' "${TARGETS[@]}")" node <<'NODE'
+const crypto = require('node:crypto');
+const fs = require('node:fs');
+const path = require('node:path');
+const home = process.env.SGSD_SNAPSHOT_HOME;
+const destination = process.env.SGSD_SNAPSHOT_DESTINATION;
+const targets = process.env.SGSD_SNAPSHOT_TARGETS.split('\n').filter(Boolean);
+const rows = [];
+function sha256(file) {
+  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
+}
+function walk(full, relative) {
+  const stat = fs.lstatSync(full);
+  const type = stat.isSymbolicLink() ? 'symlink' : stat.isDirectory() ? 'directory' : 'file';
+  rows.push({
+    path: relative.split(path.sep).join('/'), type, mode: stat.mode & 0o7777,
+    link: type === 'symlink' ? fs.readlinkSync(full) : null,
+    sha256: type === 'file' ? sha256(full) : null,
+  });
+  if (type === 'directory') {
+    for (const name of fs.readdirSync(full).sort()) walk(path.join(full, name), path.join(relative, name));
+  }
+}
+for (const target of targets) {
+  const full = path.join(home, ...target.split('/'));
+  try { walk(full, target); }
+  catch (error) {
+    if (error.code !== 'ENOENT') throw error;
+    rows.push({ path: target, type: 'absent', mode: null, link: null, sha256: null });
+  }
+}
+fs.writeFileSync(destination, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
+NODE
+}
+write_scripts_extras() {
+  local home="$1" manifest="$2" destination="$3"
+  local node_home node_manifest node_destination
+  node_home="$(node_path_arg "$home")"
+  node_manifest="$(node_path_arg "$manifest")"
+  node_destination="$(node_path_arg "$destination")"
+  SGSD_SNAPSHOT_HOME="$node_home" SGSD_SNAPSHOT_MANIFEST="$node_manifest" \
+  SGSD_SNAPSHOT_EXTRAS="$node_destination" node <<'NODE'
+const fs = require('node:fs');
+const path = require('node:path');
+const home = process.env.SGSD_SNAPSHOT_HOME;
+const rows = fs.readFileSync(process.env.SGSD_SNAPSHOT_MANIFEST, 'utf8')
+  .split(/\r?\n/).filter(Boolean).map(JSON.parse);
+const prefix = '.claude/super-gsd/scripts';
+const canonical = path.join(home, '.claude', 'super-gsd', 'source', 'super-gsd', 'scripts');
+const extras = rows.filter((row) => {
+  if (row.type === 'absent' || (row.path !== prefix && !row.path.startsWith(prefix + '/'))) return false;
+  const relative = row.path === prefix ? '' : row.path.slice(prefix.length + 1);
+  if (!relative) return false;
+  try { fs.lstatSync(path.join(canonical, ...relative.split('/'))); return false; }
+  catch (error) { if (error.code === 'ENOENT') return true; throw error; }
+});
+fs.writeFileSync(process.env.SGSD_SNAPSHOT_EXTRAS,
+  extras.map((row) => JSON.stringify(row)).join('\n') + (extras.length ? '\n' : ''));
+NODE
+}
+
+create_snapshot() {
+  local home="$1" output="$2" target live
+  [[ ! -e "$output" ]] || die "--output-dir already exists: $output"
+  mkdir -p -- "$output"; output="$(resolved_dir "$output")"
+  write_manifest "$home" "$output/manifest-before.jsonl"
+  write_scripts_extras "$home" "$output/manifest-before.jsonl" "$output/scripts-extra-before.jsonl"
+  local present=()
+  for target in "${TARGETS[@]}"; do
+    live="$home/$target"
+    if [[ -e "$live" || -L "$live" ]]; then present+=("$target"); fi
+  done
+  if [[ ${#present[@]} -eq 0 ]]; then tar -cf "$output/archive.tar" --files-from /dev/null
+  else tar -cf "$output/archive.tar" -C "$home" -- "${present[@]}"
+  fi
+  [[ -r "$output/archive.tar" ]] || die "archive does not exist or is unreadable"
+  tar -tf "$output/archive.tar" >/dev/null || die "archive exists but is not readable by tar"
+  printf 'snapshot=%s\nmanifest=%s\narchive=%s\n' \
+    "$output" "$output/manifest-before.jsonl" "$output/archive.tar"
+}
+verify_snapshot() {
+  local home="$1" snapshot="$2"
+  [[ -d "$snapshot" ]] || die "--snapshot-dir does not exist: $snapshot"
+  snapshot="$(resolved_dir "$snapshot")"
+  [[ -r "$snapshot/manifest-before.jsonl" ]] || die "manifest-before.jsonl is missing or unreadable"
+  [[ -r "$snapshot/scripts-extra-before.jsonl" ]] || die "scripts-extra-before.jsonl is missing or unreadable"
+  [[ -r "$snapshot/archive.tar" ]] || die "archive does not exist or is unreadable"
+  tar -tf "$snapshot/archive.tar" >/dev/null || die "archive exists but is not readable by tar"
+  write_manifest "$home" "$snapshot/manifest-after.jsonl"
+  local node_before node_after node_extras
+  node_before="$(node_path_arg "$snapshot/manifest-before.jsonl")"
+  node_after="$(node_path_arg "$snapshot/manifest-after.jsonl")"
+  node_extras="$(node_path_arg "$snapshot/scripts-extra-before.jsonl")"
+  SGSD_BEFORE="$node_before" SGSD_AFTER="$node_after" \
+  SGSD_EXTRAS="$node_extras" node <<'NODE'
+const fs = require('node:fs');
+const read = (file) => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
+const before = read(process.env.SGSD_BEFORE);
+const after = read(process.env.SGSD_AFTER);
+const extras = read(process.env.SGSD_EXTRAS);
+const afterByPath = new Map(after.map((row) => [row.path, row]));
+const scriptsRoot = '.claude/super-gsd/scripts';
+const missing = before.filter((row) => row.type !== 'absent'
+  && (row.path === scriptsRoot || row.path.startsWith(scriptsRoot + '/'))
+  && (!afterByPath.has(row.path) || afterByPath.get(row.path).type === 'absent'));
+if (missing.length) {
+  throw new Error('pre-install scripts path set is not a subset of post-install set: '
+    + missing.map((row) => row.path).join(', '));
+}
+const changedExtras = extras.filter((expected) => {
+  const actual = afterByPath.get(expected.path);
+  return !actual || actual.type !== expected.type || actual.mode !== expected.mode
+    || actual.link !== expected.link || actual.sha256 !== expected.sha256;
+});
+if (changedExtras.length) {
+  throw new Error('scripts extra-file set is not byte-identical: '
+    + changedExtras.map((row) => row.path).join(', '));
+}
+NODE
+  printf 'verified=%s\nmanifest_after=%s\n' "$snapshot" "$snapshot/manifest-after.jsonl"
+}
+restore_snapshot() {
+  local home="$1" snapshot="$2" failed="$3" target live quarantine
+  [[ -d "$snapshot" ]] || die "--snapshot-dir does not exist: $snapshot"
+  snapshot="$(resolved_dir "$snapshot")"
+  [[ -r "$snapshot/manifest-before.jsonl" ]] || die "manifest-before.jsonl is missing or unreadable"
+  [[ -r "$snapshot/archive.tar" ]] || die "archive does not exist or is unreadable"
+  tar -tf "$snapshot/archive.tar" >/dev/null || die "archive exists but is not readable by tar"
+  if [[ -e "$failed" ]]; then
+    [[ -d "$failed" ]] || die "--failed-candidate-dir exists and is not a directory"
+    [[ -z "$(find "$failed" -mindepth 1 -print -quit)" ]] || die "--failed-candidate-dir is not empty"
+  else mkdir -p -- "$failed"
+  fi
+  failed="$(resolved_dir "$failed")"; mkdir -p -- "$failed/targets"
+  for target in "${TARGETS[@]}"; do
+    live="$home/$target"
+    if [[ -e "$live" || -L "$live" ]]; then
+      quarantine="$failed/targets/$target"; mkdir -p -- "$(dirname "$quarantine")"; mv -- "$live" "$quarantine"
+    fi
+  done
+  tar -xf "$snapshot/archive.tar" -C "$home"
+  write_manifest "$home" "$snapshot/manifest-restored.jsonl"
+  cmp -s "$snapshot/manifest-before.jsonl" "$snapshot/manifest-restored.jsonl" ||
+    die "restore did not reproduce the exact pre-install manifest; failed candidate and original archive were retained"
+  printf 'restored=%s\nfailed_candidate=%s\noriginal_archive=%s\n' \
+    "$snapshot" "$failed" "$snapshot/archive.tar"
+}
+
+[[ $# -ge 1 ]] || { usage >&2; exit 2; }
+action="$1"; shift
+home_arg=""; output_arg=""; snapshot_arg=""; failed_arg=""
+while [[ $# -gt 0 ]]; do
+  case "$1" in
+    --home) [[ $# -ge 2 ]] || die "--home requires a value"; home_arg="$2"; shift 2 ;;
+    --output-dir) [[ $# -ge 2 ]] || die "--output-dir requires a value"; output_arg="$2"; shift 2 ;;
+    --snapshot-dir) [[ $# -ge 2 ]] || die "--snapshot-dir requires a value"; snapshot_arg="$2"; shift 2 ;;
+    --failed-candidate-dir) [[ $# -ge 2 ]] || die "--failed-candidate-dir requires a value"; failed_arg="$2"; shift 2 ;;
+    --help|-h) usage; exit 0 ;;
+    *) die "unknown argument: $1" ;;
+  esac
+done
+validate_contract
+home="$(validate_home "$home_arg")"
+case "$action" in
+  create)
+    [[ -n "$output_arg" && -z "$snapshot_arg" && -z "$failed_arg" ]] || die "create requires only --home and --output-dir"
+    output_arg="$(validate_storage_path "--output-dir" "$output_arg" "$home")"
+    create_snapshot "$home" "$output_arg"
+    ;;
+  verify)
+    [[ -n "$snapshot_arg" && -z "$output_arg" && -z "$failed_arg" ]] || die "verify requires only --home and --snapshot-dir"
+    snapshot_arg="$(validate_storage_path "--snapshot-dir" "$snapshot_arg" "$home")"
+    verify_snapshot "$home" "$snapshot_arg"
+    ;;
+  restore)
+    [[ -n "$snapshot_arg" && -n "$failed_arg" && -z "$output_arg" ]] ||
+      die "restore requires --home, --snapshot-dir, and --failed-candidate-dir"
+    snapshot_arg="$(validate_storage_path "--snapshot-dir" "$snapshot_arg" "$home")"
+    failed_arg="$(validate_storage_path "--failed-candidate-dir" "$failed_arg" "$home")"
+    [[ "$snapshot_arg" != "$failed_arg" ]] || die "snapshot and failed-candidate directories must differ"
+    restore_snapshot "$home" "$snapshot_arg" "$failed_arg"
+    ;;
+  *) usage >&2; die "action must be create, verify, or restore" ;;
+esac
diff --git a/super-gsd/scripts/sgsd-local-restart-evidence.ps1 b/super-gsd/scripts/sgsd-local-restart-evidence.ps1
new file mode 100644
index 0000000..809838e
--- /dev/null
+++ b/super-gsd/scripts/sgsd-local-restart-evidence.ps1
@@ -0,0 +1,530 @@
+#requires -Version 5.1
+
+<#
+.SYNOPSIS
+Captures identity-verified local SGSD MCP and cockpit restart evidence.
+
+.DESCRIPTION
+Prepare records and terminates only MCP/cockpit processes whose current
+Win32_Process identity still matches the displayed PID, CreationDate, and
+command line. It then starts a fresh cockpit through sgsd-refresh.
+
+Finalize is intentionally a separate invocation: the owning Warp/Claude
+session must be restarted between modes so it can create new MCP children.
+Finalize refuses evidence when an old MCP identity survives, provenance is
+not rooted at ExpectedMcpRoot, or any recorded after identity is not live.
+#>
+
+[CmdletBinding()]
+param(
+    [Parameter(Mandatory = $true)]
+    [ValidateSet('Prepare', 'Finalize')]
+    [string]$Mode,
+
+    [Parameter(Mandatory = $true)]
+    [string]$Project,
+
+    [Parameter(Mandatory = $true)]
+    [string]$ExpectedMcpRoot,
+
+    [Parameter(Mandatory = $true)]
+    [string]$EvidencePath
+)
+
+Set-StrictMode -Version Latest
+$ErrorActionPreference = 'Stop'
+
+$Schema = 'sgsd.restart-evidence.v1'
+
+function Resolve-SgsdDirectory {
+    param(
+        [Parameter(Mandatory = $true)][string]$Path,
+        [Parameter(Mandatory = $true)][string]$Label
+    )
+
+    try {
+        $resolved = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
+    } catch {
+        throw "$Label does not exist or cannot be resolved: $Path"
+    }
+    if (-not (Test-Path -LiteralPath $resolved -PathType Container)) {
+        throw "$Label is not a directory: $resolved"
+    }
+    return [IO.Path]::GetFullPath($resolved).TrimEnd('\', '/')
+}
+
+function Test-SgsdPathWithinProject {
+    param(
+        [Parameter(Mandatory = $true)][string]$Candidate,
+        [Parameter(Mandatory = $true)][string]$ProjectRoot
+    )
+
+    $candidateFull = [IO.Path]::GetFullPath($Candidate)
+    $projectPrefix = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
+    return $candidateFull.StartsWith($projectPrefix, [StringComparison]::OrdinalIgnoreCase)
+}
+
+function Convert-SgsdCreationDate {
+    param([Parameter(Mandatory = $true)]$CreationDate)
+
+    try {
+        return ([DateTime]$CreationDate).ToUniversalTime().ToString(
+            'o',
+            [Globalization.CultureInfo]::InvariantCulture
+        )
+    } catch {
+        throw "Could not normalize Win32_Process CreationDate: $CreationDate"
+    }
+}
+
+function ConvertTo-SgsdProcessIdentity {
+    param([Parameter(Mandatory = $true)]$Process)
+
+    if ([string]::IsNullOrWhiteSpace([string]$Process.CommandLine)) {
+        throw "Process $($Process.ProcessId) has no inspectable CommandLine"
+    }
+    $startedUtc = Convert-SgsdCreationDate -CreationDate $Process.CreationDate
+    return [pscustomobject][ordered]@{
+        pid           = [int]$Process.ProcessId
+        creation_date = $startedUtc
+        started_utc   = $startedUtc
+        command_line  = [string]$Process.CommandLine
+        live_at_write = $true
+    }
+}
+
+function Get-SgsdIdentityKey {
+    param([Parameter(Mandatory = $true)]$Identity)
+    return '{0}|{1}' -f ([int]$Identity.pid), ([string]$Identity.started_utc)
+}
+
+function Test-SgsdCommandRoot {
+    param(
+        [Parameter(Mandatory = $true)][string]$CommandLine,
+        [Parameter(Mandatory = $true)][string]$Root
+    )
+
+    $normalizedCommand = $CommandLine.Replace('/', '\')
+    $normalizedRoot = $Root.Replace('/', '\').TrimEnd('\')
+    return $normalizedCommand.IndexOf(
+        $normalizedRoot,
+        [StringComparison]::OrdinalIgnoreCase
+    ) -ge 0
+}
+
+function Test-SgsdMcpCommandLine {
+    param(
+        [Parameter(Mandatory = $true)][string]$CommandLine,
+        [Parameter(Mandatory = $true)][string]$Root
+    )
+
+    return ($CommandLine -match '(?i)mcp') -and
+        (Test-SgsdCommandRoot -CommandLine $CommandLine -Root $Root)
+}
+
+function Test-SgsdCockpitCommandLine {
+    param(
+        [Parameter(Mandatory = $true)][string]$CommandLine,
+        [Parameter(Mandatory = $true)][string]$ProjectRoot
+    )
+
+    return ($CommandLine -match '(?i)cockpit-sidecar[\\/]serve\.cjs') -and
+        (Test-SgsdCommandRoot -CommandLine $CommandLine -Root $ProjectRoot)
+}
+
+function Get-SgsdProcessIdentityByPid {
+    param([Parameter(Mandatory = $true)][int]$ProcessId)
+
+    $process = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
+    if (-not $process) { return $null }
+    return ConvertTo-SgsdProcessIdentity -Process $process
+}
+
+function Get-SgsdMatchingMcpProcesses {
+    param([Parameter(Mandatory = $true)][string]$Root)
+
+    return @(
+        Get-CimInstance -ClassName Win32_Process -ErrorAction Stop |
+            Where-Object {
+                [int]$_.ProcessId -ne $PID -and
+                -not [string]::IsNullOrWhiteSpace([string]$_.CommandLine) -and
+                (Test-SgsdMcpCommandLine -CommandLine ([string]$_.CommandLine) -Root $Root)
+            } |
+            ForEach-Object { ConvertTo-SgsdProcessIdentity -Process $_ }
+    )
+}
+
+function Get-SgsdCockpitIdentity {
+    param([Parameter(Mandatory = $true)][string]$ProjectRoot)
+
+    $pidPath = Join-Path $ProjectRoot '.planning\runtime\cockpit-server.pid'
+    if (-not (Test-Path -LiteralPath $pidPath -PathType Leaf)) {
+        throw "Cockpit PID file is missing: $pidPath"
+    }
+    $rawPid = (Get-Content -LiteralPath $pidPath -TotalCount 1 -ErrorAction Stop).Trim()
+    if ($rawPid -notmatch '^\d+$' -or [int64]$rawPid -gt [int]::MaxValue -or [int]$rawPid -le 0) {
+        throw "cockpit-server.pid is not a positive process ID: $rawPid"
+    }
+    $identity = Get-SgsdProcessIdentityByPid -ProcessId ([int]$rawPid)
+    if (-not $identity) {
+        throw "Cockpit PID is not live: $rawPid"
+    }
+    if (-not (Test-SgsdCockpitCommandLine -CommandLine $identity.command_line -ProjectRoot $ProjectRoot)) {
+        throw "Cockpit PID $rawPid does not run cockpit-sidecar/serve.cjs for $ProjectRoot"
+    }
+    return $identity
+}
+
+function Get-SgsdLiveIdentity {
+    param([Parameter(Mandatory = $true)]$Identity)
+
+    $current = Get-SgsdProcessIdentityByPid -ProcessId ([int]$Identity.pid)
+    if (-not $current) { return $null }
+    if ((Get-SgsdIdentityKey -Identity $current) -ne (Get-SgsdIdentityKey -Identity $Identity)) {
+        return $null
+    }
+    if ($current.command_line -cne [string]$Identity.command_line) {
+        return $null
+    }
+    return $current
+}
+
+function Stop-SgsdVerifiedIdentity {
+    param(
+        [Parameter(Mandatory = $true)]$Identity,
+        [Parameter(Mandatory = $true)][ValidateSet('MCP', 'Cockpit')][string]$Kind,
+        [Parameter(Mandatory = $true)][string]$ExpectedRoot
+    )
+
+    $current = Get-SgsdLiveIdentity -Identity $Identity
+    if (-not $current) {
+        Write-Host "$Kind identity already stopped or replaced; no signal sent: $(Get-SgsdIdentityKey $Identity)"
+        return
+    }
+
+    $provenanceOk = if ($Kind -eq 'MCP') {
+        Test-SgsdMcpCommandLine -CommandLine $current.command_line -Root $ExpectedRoot
+    } else {
+        Test-SgsdCockpitCommandLine -CommandLine $current.command_line -ProjectRoot $ExpectedRoot
+    }
+    if (-not $provenanceOk) {
+        throw "$Kind PID $($Identity.pid) changed provenance after confirmation; refusing Stop-Process"
+    }
+
+    Stop-Process -Id ([int]$Identity.pid) -ErrorAction Stop
+    for ($attempt = 0; $attempt -lt 50; $attempt++) {
+        Start-Sleep -Milliseconds 100
+        if (-not (Get-SgsdLiveIdentity -Identity $Identity)) { return }
+    }
+    throw "$Kind identity did not stop: $(Get-SgsdIdentityKey $Identity)"
+}
+
+function Test-SgsdIdentityLiveWithProvenance {
+    param(
+        [Parameter(Mandatory = $true)]$Identity,
+        [Parameter(Mandatory = $true)][ValidateSet('MCP', 'Cockpit')][string]$Kind,
+        [Parameter(Mandatory = $true)][string]$ExpectedRoot
+    )
+
+    $current = Get-SgsdLiveIdentity -Identity $Identity
+    if (-not $current) { return $false }
+    if ($Kind -eq 'MCP') {
+        return Test-SgsdMcpCommandLine -CommandLine $current.command_line -Root $ExpectedRoot
+    }
+    return Test-SgsdCockpitCommandLine -CommandLine $current.command_line -ProjectRoot $ExpectedRoot
+}
+
+function Protect-SgsdOutput {
+    param([AllowNull()][object[]]$Lines)
+
+    $text = (@($Lines) | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
+    $text = $text -replace '(?im)\b(api[_-]?key|token|password|secret)\s*[:=]\s*(?:"[^"]*"|''[^'']*''|\S+)', '$1=<redacted>'
+    $text = $text -replace '(?i)\bBearer\s+[A-Za-z0-9._~+/-]+=*', 'Bearer <redacted>'
+    return $text
+}
+
+function Write-SgsdEvidence {
+    param(
+        [Parameter(Mandatory = $true)]$Evidence,
+        [Parameter(Mandatory = $true)][string]$Path
+    )
+
+    $temporaryPath = '{0}.tmp.{1}.{2}' -f $Path, $PID, ([Guid]::NewGuid().ToString('N'))
+    $json = $Evidence | ConvertTo-Json -Depth 16
+    $utf8NoBom = New-Object Text.UTF8Encoding($false)
+    try {
+        [IO.File]::WriteAllText($temporaryPath, $json + [Environment]::NewLine, $utf8NoBom)
+        Move-Item -LiteralPath $temporaryPath -Destination $Path -Force -ErrorAction Stop
+    } finally {
+        if (Test-Path -LiteralPath $temporaryPath) {
+            Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
+        }
+    }
+}
+
+$ProjectRoot = Resolve-SgsdDirectory -Path $Project -Label 'Project'
+$ExpectedRoot = Resolve-SgsdDirectory -Path $ExpectedMcpRoot -Label 'ExpectedMcpRoot'
+if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot '.planning') -PathType Container)) {
+    throw "Project has no .planning directory: $ProjectRoot"
+}
+
+$EvidenceFile = if ([IO.Path]::IsPathRooted($EvidencePath)) {
+    [IO.Path]::GetFullPath($EvidencePath)
+} else {
+    [IO.Path]::GetFullPath((Join-Path $ProjectRoot $EvidencePath))
+}
+if (-not (Test-SgsdPathWithinProject -Candidate $EvidenceFile -ProjectRoot $ProjectRoot)) {
+    throw "EvidencePath must remain inside Project: $EvidenceFile"
+}
+$EvidenceDirectory = Split-Path -Parent $EvidenceFile
+if (-not (Test-Path -LiteralPath $EvidenceDirectory -PathType Container)) {
+    New-Item -ItemType Directory -Path $EvidenceDirectory -Force -ErrorAction Stop | Out-Null
+}
+$EvidenceDirectory = (Resolve-Path -LiteralPath $EvidenceDirectory -ErrorAction Stop).Path
+if (-not (Test-SgsdPathWithinProject -Candidate $EvidenceDirectory -ProjectRoot $ProjectRoot)) {
+    throw "Resolved evidence directory escapes Project: $EvidenceDirectory"
+}
+
+if ($Mode -eq 'Prepare') {
+    $profileCommands = @(Get-Command -Name @('sg', 'sgsd', 'sgsd-refresh') -ErrorAction Stop)
+    if ($profileCommands.Count -ne 3) {
+        throw 'The current PowerShell session does not expose sg, sgsd, and sgsd-refresh'
+    }
+
+    $BeforeMcp = @(Get-SgsdMatchingMcpProcesses -Root $ExpectedRoot)
+    if ($BeforeMcp.Count -lt 1) {
+        throw "No matching MCP process uses ExpectedMcpRoot: $ExpectedRoot"
+    }
+    $BeforeCockpit = Get-SgsdCockpitIdentity -ProjectRoot $ProjectRoot
+
+    Write-Host 'Verified MCP command lines selected for termination:' -ForegroundColor Yellow
+    foreach ($identity in $BeforeMcp) {
+        Write-Host ("  PID={0} CreationDate={1} CommandLine={2}" -f $identity.pid, $identity.creation_date, $identity.command_line)
+    }
+    Write-Host ("Verified cockpit CommandLine: PID={0} CreationDate={1} CommandLine={2}" -f $BeforeCockpit.pid, $BeforeCockpit.creation_date, $BeforeCockpit.command_line)
+
+    $confirmation = Read-Host 'Type KILL to terminate only the verified MCP and cockpit identities'
+    if ($confirmation -cne 'KILL') {
+        throw 'Confirmation declined; no process was terminated'
+    }
+
+    foreach ($identity in $BeforeMcp) {
+        Stop-SgsdVerifiedIdentity -Identity $identity -Kind MCP -ExpectedRoot $ExpectedRoot
+    }
+    Stop-SgsdVerifiedIdentity -Identity $BeforeCockpit -Kind Cockpit -ExpectedRoot $ProjectRoot
+
+    $ExactCommand = 'sgsd-refresh -ProjectDir "{0}" -SkipPreflight' -f ($ProjectRoot -replace '"', '""')
+    $LASTEXITCODE = 0
+    $refreshOutput = @(& sgsd-refresh -ProjectDir $ProjectRoot -SkipPreflight 2>&1)
+    $refreshSucceeded = $?
+    $refreshExitStatus = $LASTEXITCODE
+    if (-not $refreshSucceeded -or $refreshExitStatus -ne 0) {
+        throw "sgsd-refresh failed while restarting the cockpit (native status $refreshExitStatus)"
+    }
+
+    $AfterCockpit = $null
+    for ($attempt = 0; $attempt -lt 30; $attempt++) {
+        try {
+            $AfterCockpit = Get-SgsdCockpitIdentity -ProjectRoot $ProjectRoot
+        } catch {
+            $AfterCockpit = $null
+        }
+        if ($AfterCockpit -and
+            (Get-SgsdIdentityKey $AfterCockpit) -ne (Get-SgsdIdentityKey $BeforeCockpit)) {
+            break
+        }
+        Start-Sleep -Milliseconds 500
+    }
+    $cockpit_identity_changed = $AfterCockpit -and
+        ((Get-SgsdIdentityKey $AfterCockpit) -ne (Get-SgsdIdentityKey $BeforeCockpit))
+    if (-not $cockpit_identity_changed) {
+        throw 'Cockpit identity did not change after sgsd-refresh'
+    }
+    if (-not (Test-SgsdIdentityLiveWithProvenance -Identity $AfterCockpit -Kind Cockpit -ExpectedRoot $ProjectRoot)) {
+        throw 'Restarted cockpit identity is not live with canonical cockpit provenance'
+    }
+
+    $capturedUtc = [DateTime]::UtcNow.ToString('o', [Globalization.CultureInfo]::InvariantCulture)
+    $machine = [Environment]::MachineName
+    $redactedOutput = Protect-SgsdOutput -Lines $refreshOutput
+    $profile = [ordered]@{
+        exit            = 0
+        exit_status     = 'passed'
+        exact_command   = 'Get-Command sg,sgsd,sgsd-refresh -ErrorAction Stop'
+        captured_utc    = $capturedUtc
+        machine         = $machine
+        live_at_write   = $true
+        redacted_output = 'Commands resolved in the current PowerShell session.'
+    }
+    $localMcp = [ordered]@{
+        exit                     = $null
+        exit_status              = 'pending_session_restart'
+        before_mcp_present       = $true
+        after_mcp_present        = $false
+        identity_intersection    = @()
+        canonical_mcp_provenance = $false
+        after_identities_live     = $false
+        expected_root             = $ExpectedRoot
+        before                    = @($BeforeMcp)
+        after                     = @()
+        exact_command             = 'Stop-Process for each freshly verified MCP identity'
+        captured_utc              = $capturedUtc
+        machine                   = $machine
+        live_at_write             = $false
+        redacted_output           = 'MCP after-evidence is intentionally deferred to Finalize.'
+    }
+    $localCockpit = [ordered]@{
+        exit                     = 0
+        exit_status              = 'passed'
+        cockpit_identity_changed = [bool]$cockpit_identity_changed
+        before                   = $BeforeCockpit
+        after                    = $AfterCockpit
+        exact_command            = $ExactCommand
+        captured_utc             = $capturedUtc
+        machine                  = $machine
+        live_at_write            = $true
+        redacted_output          = $redactedOutput
+    }
+    $prepareEvidence = [ordered]@{
+        schema            = $Schema
+        mode              = 'Prepare'
+        exit_status       = 'pending_session_restart'
+        project           = $ProjectRoot
+        expected_mcp_root = $ExpectedRoot
+        evidence_path     = $EvidenceFile
+        exact_command     = $ExactCommand
+        captured_utc      = $capturedUtc
+        machine           = $machine
+        live_at_write     = $true
+        redacted_output   = $redactedOutput
+        profile           = $profile
+        local_mcp         = $localMcp
+        local_cockpit     = $localCockpit
+        components        = [ordered]@{
+            mcp_restart     = $localMcp
+            cockpit_restart = $localCockpit
+        }
+    }
+    Write-SgsdEvidence -Evidence $prepareEvidence -Path $EvidenceFile
+    Write-Host "Prepare evidence written: $EvidenceFile" -ForegroundColor Green
+    Write-Host 'Restart the owning Warp/Claude session, then invoke this helper with -Mode Finalize.' -ForegroundColor Yellow
+    return
+}
+
+if (-not (Test-Path -LiteralPath $EvidenceFile -PathType Leaf)) {
+    throw "Finalize requires Prepare evidence: $EvidenceFile"
+}
+$Prior = Get-Content -Raw -LiteralPath $EvidenceFile -ErrorAction Stop | ConvertFrom-Json
+if ([string]$Prior.schema -cne $Schema -or [string]$Prior.mode -cne 'Prepare') {
+    throw 'Finalize requires sgsd.restart-evidence.v1 Prepare evidence'
+}
+if ([string]$Prior.project -ine $ProjectRoot -or
+    [string]$Prior.expected_mcp_root -ine $ExpectedRoot) {
+    throw 'Finalize Project or ExpectedMcpRoot differs from Prepare evidence'
+}
+
+$BeforeMcp = @($Prior.components.mcp_restart.before)
+if ($BeforeMcp.Count -lt 1) {
+    throw 'Prepare evidence contains no before MCP identity'
+}
+$AfterMcp = @(Get-SgsdMatchingMcpProcesses -Root $ExpectedRoot)
+if ($AfterMcp.Count -lt 1) {
+    throw "No matching after MCP process uses ExpectedMcpRoot: $ExpectedRoot"
+}
+
+$beforeKeys = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
+foreach ($identity in $BeforeMcp) {
+    [void]$beforeKeys.Add((Get-SgsdIdentityKey -Identity $identity))
+}
+$identity_intersection = @(
+    $AfterMcp |
+        ForEach-Object { Get-SgsdIdentityKey -Identity $_ } |
+        Where-Object { $beforeKeys.Contains($_) }
+)
+if ($identity_intersection.Count -ne 0) {
+    throw "Prior MCP identity survived the owning-session restart: $($identity_intersection -join ', ')"
+}
+
+$canonical_mcp_provenance = @(
+    $AfterMcp | Where-Object {
+        -not (Test-SgsdMcpCommandLine -CommandLine $_.command_line -Root $ExpectedRoot)
+    }
+).Count -eq 0
+if (-not $canonical_mcp_provenance) {
+    throw 'An after MCP command line lacks canonical MCP provenance'
+}
+
+$after_identities_live = @(
+    $AfterMcp | Where-Object {
+        -not (Test-SgsdIdentityLiveWithProvenance -Identity $_ -Kind MCP -ExpectedRoot $ExpectedRoot)
+    }
+).Count -eq 0
+if (-not $after_identities_live) {
+    throw 'An after MCP identity is no longer live with canonical provenance'
+}
+
+$BeforeCockpit = $Prior.components.cockpit_restart.before
+$AfterCockpit = Get-SgsdCockpitIdentity -ProjectRoot $ProjectRoot
+$cockpit_identity_changed = (Get-SgsdIdentityKey -Identity $AfterCockpit) -ne
+    (Get-SgsdIdentityKey -Identity $BeforeCockpit)
+if (-not $cockpit_identity_changed) {
+    throw 'Cockpit still has its pre-Prepare PID plus CreationDate identity'
+}
+if (-not (Test-SgsdIdentityLiveWithProvenance -Identity $AfterCockpit -Kind Cockpit -ExpectedRoot $ProjectRoot)) {
+    throw 'After cockpit identity is not live with canonical cockpit provenance'
+}
+
+$capturedUtc = [DateTime]::UtcNow.ToString('o', [Globalization.CultureInfo]::InvariantCulture)
+$machine = [Environment]::MachineName
+$ExactCommand = 'sgsd-local-restart-evidence.ps1 -Mode Finalize -Project "{0}" -ExpectedMcpRoot "{1}" -EvidencePath "{2}"' -f $ProjectRoot, $ExpectedRoot, $EvidenceFile
+$localMcp = [ordered]@{
+    exit                     = 0
+    exit_status              = 'passed'
+    before_mcp_present       = $true
+    after_mcp_present        = $true
+    identity_intersection    = @($identity_intersection)
+    canonical_mcp_provenance = [bool]$canonical_mcp_provenance
+    after_identities_live     = [bool]$after_identities_live
+    expected_root             = $ExpectedRoot
+    before                    = @($BeforeMcp)
+    after                     = @($AfterMcp)
+    exact_command             = $ExactCommand
+    captured_utc              = $capturedUtc
+    machine                   = $machine
+    live_at_write             = $true
+    redacted_output           = 'After MCP identities were re-read from Win32_Process.'
+}
+$localCockpit = [ordered]@{
+    exit                     = 0
+    exit_status              = 'passed'
+    cockpit_identity_changed = [bool]$cockpit_identity_changed
+    before                   = $BeforeCockpit
+    after                    = $AfterCockpit
+    exact_command            = $ExactCommand
+    captured_utc             = $capturedUtc
+    machine                  = $machine
+    live_at_write            = $true
+    redacted_output          = 'Cockpit PID, CreationDate, and command line were re-read.'
+}
+$finalEvidence = [ordered]@{
+    schema            = $Schema
+    mode              = 'Finalize'
+    exit_status       = 'passed'
+    project           = $ProjectRoot
+    expected_mcp_root = $ExpectedRoot
+    evidence_path     = $EvidenceFile
+    exact_command     = $ExactCommand
+    captured_utc      = $capturedUtc
+    machine           = $machine
+    live_at_write     = $true
+    redacted_output   = 'All after identities are live with canonical provenance.'
+    profile           = $Prior.profile
+    local_mcp         = $localMcp
+    local_cockpit     = $localCockpit
+    components        = [ordered]@{
+        mcp_restart     = $localMcp
+        cockpit_restart = $localCockpit
+    }
+}
+Write-SgsdEvidence -Evidence $finalEvidence -Path $EvidenceFile
+Write-Host "Finalize evidence written: $EvidenceFile" -ForegroundColor Green
diff --git a/super-gsd/scripts/sgsd-onboard.ps1 b/super-gsd/scripts/sgsd-onboard.ps1
index f3fefd1..ba20191 100644
--- a/super-gsd/scripts/sgsd-onboard.ps1
+++ b/super-gsd/scripts/sgsd-onboard.ps1
@@ -1,356 +1,375 @@
-﻿# sgsd-onboard.ps1
-# /sgsd-onboard wizard. Runs Test-SgsdReadiness against the current repo,
-# shows what's missing, and installs each missing/incomplete component.
-#
-# Usage:
-#   sgsd-onboard.ps1                        # interactive wizard in cwd
-#   sgsd-onboard.ps1 -ProjectDir <path>     # target a specific repo
-#   sgsd-onboard.ps1 -All                   # install everything missing without prompting
-#   sgsd-onboard.ps1 -Check                 # readiness report only, no install
-
-param(
-    [string]$ProjectDir = (Get-Location).Path,
-    [switch]$All,
-    [switch]$Check
-)
-
-# UTF-8 output for emoji + box-drawing. Best-effort under managed CLM shells.
-try {
-    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
-    $OutputEncoding = [System.Text.Encoding]::UTF8
-} catch {}
-
-try { $ProjectDir = (Resolve-Path -LiteralPath $ProjectDir -ErrorAction Stop).Path } catch {
-    Write-Host "ERR: cannot resolve project dir '$ProjectDir'" -ForegroundColor Red
-    exit 1
-}
-
-# Locate the canonical super-gsd/ install — needed for templates and as the
-# junction target. Use the readiness module's Resolve-SgsdHome.
-$scriptDir = Split-Path -Parent $PSCommandPath
-$libDir    = Join-Path $scriptDir 'lib'
-$readinessLib = Join-Path $libDir 'sgsd-readiness.ps1'
-if (-not (Test-Path -LiteralPath $readinessLib)) {
-    Write-Host "ERR: sgsd-readiness.ps1 not found at $readinessLib" -ForegroundColor Red
-    exit 1
-}
-. $readinessLib
-
-$sgsdHome = Resolve-SgsdHome -StartDir $ProjectDir
-if (-not $sgsdHome) {
-    # Fall back to the caller's super-gsd location (we're inside it).
-    $sgsdHome = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
-    if (-not (Test-Path -LiteralPath (Join-Path $sgsdHome 'scripts'))) {
-        Write-Host "ERR: cannot locate canonical super-gsd/ install" -ForegroundColor Red
-        exit 1
-    }
-}
-$templatesDir = Join-Path $sgsdHome 'templates\onboard'
-if (-not (Test-Path -LiteralPath $templatesDir)) {
-    Write-Host "ERR: templates dir missing: $templatesDir" -ForegroundColor Red
-    exit 1
-}
-
-function Read-Template {
-    param([string]$Name)
-    $p = Join-Path $templatesDir $Name
-    if (-not (Test-Path -LiteralPath $p)) { return $null }
-    return [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
-}
-
-function Write-FileWithBom {
-    # Write UTF-8 with BOM so PowerShell 5.1 reads non-ASCII chars correctly.
-    param([string]$Path, [string]$Content)
-    $dir = Split-Path -Parent $Path
-    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
-    $utf8Bom = New-Object System.Text.UTF8Encoding($true)
-    [System.IO.File]::WriteAllText($Path, $Content, $utf8Bom)
-}
-
-function Apply-TemplateVars {
-    param([string]$Content, [hashtable]$Vars)
-    foreach ($k in $Vars.Keys) {
-        $Content = $Content -replace ('\{\{' + [regex]::Escape($k) + '\}\}'), $Vars[$k]
-    }
-    return $Content
-}
-
-function Install-SgsdComponent {
-    # Returns $true on success, $false on failure or skip-by-design.
-    param([string]$ComponentId, [string]$ProjectDir, [string]$SgsdHome)
-
-    $repoLeaf = Split-Path -Leaf $ProjectDir
-    $today    = (Get-Date).ToString('yyyy-MM-dd')
-    $vars     = @{ 'REPO_NAME' = $repoLeaf; 'TODAY' = $today }
-
-    switch ($ComponentId) {
-        'super-gsd' {
-            $link = Join-Path $ProjectDir 'super-gsd'
-            if (Test-Path -LiteralPath $link) { Write-Host "    super-gsd/ already exists — leaving alone" -ForegroundColor DarkYellow; return $true }
-            $out = cmd /c "mklink /J `"$link`" `"$SgsdHome`"" 2>&1
-            if ($LASTEXITCODE -eq 0) {
-                Write-Host "    ✓ junction → $SgsdHome" -ForegroundColor Green
-                return $true
-            }
+﻿# sgsd-onboard.ps1
+# /sgsd-onboard wizard. Runs Test-SgsdReadiness against the current repo,
+# shows what's missing, and installs each missing/incomplete component.
+#
+# Usage:
+#   sgsd-onboard.ps1                        # interactive wizard in cwd
+#   sgsd-onboard.ps1 -ProjectDir <path>     # target a specific repo
+#   sgsd-onboard.ps1 -All                   # install everything missing without prompting
+#   sgsd-onboard.ps1 -Check                 # readiness report only, no install
+
+param(
+    [string]$ProjectDir = (Get-Location).Path,
+    [switch]$All,
+    [switch]$Check
+)
+
+# UTF-8 output for emoji + box-drawing. Best-effort under managed CLM shells.
+try {
+    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
+    $OutputEncoding = [System.Text.Encoding]::UTF8
+} catch {}
+
+try { $ProjectDir = (Resolve-Path -LiteralPath $ProjectDir -ErrorAction Stop).Path } catch {
+    Write-Host "ERR: cannot resolve project dir '$ProjectDir'" -ForegroundColor Red
+    exit 1
+}
+
+# Locate the canonical super-gsd/ install — needed for templates and as the
+# junction target. Use the readiness module's Resolve-SgsdHome.
+$scriptDir = Split-Path -Parent $PSCommandPath
+$libDir    = Join-Path $scriptDir 'lib'
+$readinessLib = Join-Path $libDir 'sgsd-readiness.ps1'
+if (-not (Test-Path -LiteralPath $readinessLib)) {
+    Write-Host "ERR: sgsd-readiness.ps1 not found at $readinessLib" -ForegroundColor Red
+    exit 1
+}
+. $readinessLib
+
+$sgsdHome = Resolve-SgsdHome -StartDir $ProjectDir
+if (-not $sgsdHome) {
+    # Fall back to the caller's super-gsd location (we're inside it).
+    $sgsdHome = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
+    if (-not (Test-Path -LiteralPath (Join-Path $sgsdHome 'scripts'))) {
+        Write-Host "ERR: cannot locate canonical super-gsd/ install" -ForegroundColor Red
+        exit 1
```
