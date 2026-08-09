# Phase 150 propagation, trust, recovery, and restart runbook

This is the operator runbook for T150-05, T150-06, and T150-07. Those tasks
are operator-present: do not execute them during the automatable T150-04
documentation task. Every command below names its shell, uses concrete paths,
and stops when a guard fails.

## Reload and reboot matrix

A machine reboot is not required for any Phase 150 layer. The owning process,
client session, or tmux session is the reload boundary. Preserve evidence before
using a full reboot as an optional last-resort recovery action.

| Runtime layer | When new content becomes Live | Required reload | Identity evidence | Machine reboot |
|---|---|---|---|---|
| Hook bodies | Next hook event | None; the next event reads the new hook body | Hook name, event timestamp, probe ID, and appended ledger row | No |
| Skills, agents, and settings registrations | Next session | Start a new client session | Client PID, start time, and resolved registrations | No |
| Registries and singleton caches | Cache reset or new process | Run registry sync, then replace the owning process | Registry source plus process identity | No |
| PowerShell functions | Immediately after `. $PROFILE`, otherwise next terminal | Reload the profile or open a new terminal | `Get-Command sg,sgsd,sgsd-refresh` | No |
| Claude settings and hooks | Next owning Claude session | Restart the owning Claude session | New Claude process plus hook self-test | No |
| Local MCP modules | After verified child termination and owning-session restart | Display and replace only canonical MCP children | PID plus CreationDate before and after | No |
| Local cockpit | After verified PID termination and relaunch | Run `sgsd-refresh -SkipPreflight` | PID, CreationDate, and canonical command line | No |
| devcp MCP modules | After verified child termination and tmux relaunch | Reset the owning `clarity-sgsd` session | PID plus `/proc/PID/stat` start_ticks | No |
| devcp cockpit | After verified PID termination and canonical relaunch | Relaunch from the selected global scripts directory | PID, start_ticks, and command line | No |
| devcp tmux | After coordinated reset | Reset, greet, and initially do not attach | session ID, creation epoch, and server PID before and after | No |

## Invariants and stop conditions

- The canonical local source is `C:\Users\jack.berrow\GSDedits`; the devcp
  canonical source is `~/.claude/super-gsd/source`.
- `/opt/clarity/project-clarity-erp/super-gsd` is a vendored application tree,
  never an implicit framework-propagation source.
- Before any update, the clean-state check is `git status --porcelain`; it must
  be empty. Validate the origin URL, capture the intended SHA, and allow only a
  guarded fast-forward.
- A failed candidate is quarantined. Rollback restores the exact pre-install
  manifest while retaining the original archive and failed candidate.
- Every evidence record contains the exact command, captured UTC timestamp,
  machine, exit status, before/after identities, canonical provenance, and
  redacted output.

## Installed-layer recovery boundary

The snapshot owns every target mutated by `super-gsd/install.sh --install-global`:

- `~/.claude/agents`
- `~/.claude/commands`
- `~/.claude/hooks`
- `~/.claude/settings.json`
- `~/.claude/get-shit-done/templates/super-gsd`
- `~/.claude/get-shit-done/workflows`
- `~/.claude/get-shit-done/config/model-routing.json`
- `~/.claude/super-gsd/scripts`
- `~/.local/bin/sgsd`

Create and later verify the snapshot from Bash on devcp:

```bash
set -euo pipefail
source_dir=$HOME/.claude/super-gsd/source
snapshot_dir=$HOME/.claude/super-gsd/reconciliation/p150-candidate
bash $source_dir/super-gsd/scripts/sgsd-global-snapshot.sh create --home $HOME --output-dir $snapshot_dir
bash $source_dir/super-gsd/install.sh --update --install-global
bash $source_dir/super-gsd/scripts/sgsd-global-snapshot.sh verify --home $HOME --snapshot-dir $snapshot_dir
```

Verification proves the complete pre-install scripts path set is a subset of
the post-install set and every pre-install extra is byte-identical. If any
candidate check fails, use the exact rollback command. It quarantines current
targets and reconstructs the exact pre-install manifest from the original archive:

```bash
set -euo pipefail
source_dir=$HOME/.claude/super-gsd/source
snapshot_dir=$HOME/.claude/super-gsd/reconciliation/p150-candidate
failed_dir=$HOME/.claude/super-gsd/reconciliation/p150-failed-candidate
bash $source_dir/super-gsd/scripts/sgsd-global-snapshot.sh restore --home $HOME --snapshot-dir $snapshot_dir --failed-candidate-dir $failed_dir
test -r $snapshot_dir/archive.tar
find $failed_dir -mindepth 1 -print -quit
```

## Local propagation — T150-05

Run in PowerShell after verifying the intended feature SHA and generic identity:

```powershell
$ErrorActionPreference = 'Stop'
$p150Project = 'C:\Users\jack.berrow\GSDedits'
Set-Location -LiteralPath $p150Project
$p150Status = @(git status --porcelain)
if ($LASTEXITCODE -ne 0 -or $p150Status.Count -ne 0) { throw 'Canonical source is not clean' }
bash super-gsd/install.sh --update --install-global
if ($LASTEXITCODE -ne 0) { throw 'Global install failed' }
powershell -NoProfile -ExecutionPolicy Bypass -File super-gsd/scripts/Install-SgsdShortcut.ps1 -Force
if ($LASTEXITCODE -ne 0) { throw 'Shortcut install failed' }
. $PROFILE
Get-Command sg,sgsd,sgsd-refresh -ErrorAction Stop | Out-Null
sgsd -NoOpen
if ($LASTEXITCODE -ne 0) { throw 'Local preflight failed' }
```

```powershell
node super-gsd/tools/codex-hooks/install-hooks.cjs --project C:\Users\jack.berrow\GSDedits --json
node super-gsd/tools/codex-hooks/self-test.cjs --project C:\Users\jack.berrow\GSDedits --json
& .\super-gsd\scripts\sgsd-update.ps1 -Check -Source C:\Users\jack.berrow\GSDedits
& .\super-gsd\scripts\sgsd-update.ps1 -Source C:\Users\jack.berrow\GSDedits
```

The Bash equivalents are `sgsd-update.sh --check --source` and
`sgsd-update.sh --source`. Portable preflight accepts `sgsd --no-open`.

## Worktrees, junctions, and project hooks

Pushing master does not move a checked-out branch in an existing `git worktree`.
Coordinate its clean-state check and use merge/rebase only when its owner chooses
to advance it. Never install from a stale worktree.
Junction-backed repos receive target changes when the junction target advances,
but still need this exact command:

```powershell
node super-gsd/tools/codex-hooks/install-hooks.cjs --project C:\Users\jack.berrow\GSDedits --json
```

## Trust ceremony and append-only proof — T150-06

Each independently trusted real dispatch records a unique probe ID, the
ledger byte offset captured before dispatch, the UTC start, the checked
Codex exit status and transport status, forbidden-file absence, and the exact appended
bytes. Historical rows do not count. The appended bytes must contain a
`block-forbidden-write` row whose decision is `block`, whose reason is `forbidden_path`,
whose path matches the probe, and whose timestamp follows the UTC start.

```powershell
node super-gsd/tools/codex-hooks/install-hooks.cjs --project C:\Users\jack.berrow\GSDedits --json
node super-gsd/tools/codex-hooks/self-test.cjs --project C:\Users\jack.berrow\GSDedits --json
node super-gsd/tools/codex-hooks/block-forbidden-write.cjs
```

Retain appended bytes and redacted output only; prove forbidden-file absence at
`secrets/p150-trust-probe.env` after the dispatch.

## Local restart evidence — T150-06

Prepare displays selected Win32 MCP and cockpit command lines, requires `KILL`,
and starts a new cockpit. Finalize runs after the owning session restarts:

```powershell
& C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-local-restart-evidence.ps1 -Mode Prepare -Project C:\Users\jack.berrow\GSDedits -ExpectedMcpRoot C:\Users\jack.berrow\GSDedits -EvidencePath .planning\milestones\v3.5\phases\150-propagation-trust-runbook\150-LOCAL-RESTART-EVIDENCE.json
& C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-local-restart-evidence.ps1 -Mode Finalize -Project C:\Users\jack.berrow\GSDedits -ExpectedMcpRoot C:\Users\jack.berrow\GSDedits -EvidencePath .planning\milestones\v3.5\phases\150-propagation-trust-runbook\150-LOCAL-RESTART-EVIDENCE.json
```

Acceptance requires no PID/CreationDate identity intersection, a changed
cockpit identity, canonical MCP provenance, and after identities live at write.

## devcp propagation and runtime switch — T150-07

Use named remote scripts with explicit arguments from PowerShell:

```powershell
$ErrorActionPreference = 'Stop'
ssh devcp bash ~/.claude/super-gsd/source/super-gsd/scripts/sgsd-update.sh --check --source ~/.claude/super-gsd/source
if ($LASTEXITCODE -ne 0) { throw 'devcp update preflight failed' }
ssh devcp bash ~/.claude/super-gsd/source/super-gsd/scripts/sgsd-update.sh --source ~/.claude/super-gsd/source
if ($LASTEXITCODE -ne 0) { throw 'devcp guarded update failed' }
ssh -t devcp bash ~/.claude/super-gsd/source/super-gsd/scripts/sgsd-devcp-restart-evidence.sh --project /opt/clarity/project-clarity-erp --session clarity-sgsd --scripts-dir ~/.claude/super-gsd/scripts --agents-dir ~/.claude/agents --source-dir ~/.claude/super-gsd/source --evidence ~/.claude/super-gsd/reconciliation/p150-devcp-restart-evidence.json
if ($LASTEXITCODE -ne 0) { throw 'devcp restart evidence failed' }
ssh devcp tmux attach -t clarity-sgsd
```

The helper calls `sgsd-remote-tmux.sh` with `--project`, `--scripts-dir`,
`--agents-dir`, `--source-dir`, `--reset`, `--greet`, and `--no-attach`, then
runs `--doctor`. Acceptance requires new MCP identities, changed cockpit and
tmux identities, canonical command lines, PID/start_ticks, and tmux session ID,
creation epoch, and server PID evidence.

## Evidence capture

For every local or devcp operation, capture the exact command, machine, UTC
timestamp, exit status, redacted output, source SHA, project pin, and referenced
manifest or ledger range. Do not copy secrets, authentication tokens, raw trust
database contents, or unrelated process command lines into phase evidence.
