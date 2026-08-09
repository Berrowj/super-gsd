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

- Derive the canonical local source with
  `$p150LocalRepo = Join-Path $env:USERPROFILE 'GSDedits'`; the devcp canonical
  source is `~/.claude/super-gsd/source`. An operator may replace that derived
  value with an explicitly supplied repository root.
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

Run from the clean P150 feature worktree. This is the locked publication
ceremony: it validates the feature branch and origin, audits every outgoing
identity, fast-forwards the canonical local `master` to the feature SHA,
installs and audits that exact SHA before publication, and only then pushes a
detached fast-forward to `origin/master`.

```powershell
$ErrorActionPreference = 'Stop'

$p150Repo = (git rev-parse --show-toplevel).Trim()
Set-Location -LiteralPath $p150Repo
$p150FeatureBranch = (git branch --show-current).Trim()
$p150FeatureSha = (git rev-parse HEAD).Trim()
$p150AllowedOrigins = @(
  'https://github.com/Berrowj/super-gsd'
  'https://github.com/Berrowj/super-gsd.git'
  'git@github.com:Berrowj/super-gsd'
  'git@github.com:Berrowj/super-gsd.git'
)
$p150RemoteUrl = (git remote get-url origin).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not resolve origin fetch URL' }
$p150RemotePushUrl = (git remote get-url --push origin).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not resolve origin push URL' }
$p150LocalRepo = Join-Path $env:USERPROFILE 'GSDedits'

if (-not $p150FeatureBranch -or $p150FeatureBranch -eq 'master') {
  throw 'Run this ceremony from the completed P150 feature branch'
}
if ($p150AllowedOrigins -cnotcontains $p150RemoteUrl) {
  throw "Unexpected origin: $p150RemoteUrl"
}
if ($p150AllowedOrigins -cnotcontains $p150RemotePushUrl) {
  throw "Unexpected origin push URL: $p150RemotePushUrl"
}
if (@(git status --porcelain=v1).Count -ne 0) {
  throw 'P150 feature worktree is dirty'
}

git fetch origin master
if ($LASTEXITCODE -ne 0) { throw 'Fetch failed' }

git merge-base --is-ancestor origin/master $p150FeatureSha
if ($LASTEXITCODE -ne 0) {
  throw 'P150 feature branch is not a fast-forward descendant of origin/master'
}

$p150IdentityRows = @(
  git log --format='%H|%an|%ae|%cn|%ce' "origin/master..$p150FeatureSha"
)
if ($p150IdentityRows.Count -eq 0) {
  throw 'No outgoing P150 commits found'
}

$p150AllowedIdentity = '^[0-9a-f]+\|operator\|operator@users\.noreply\.github\.com\|operator\|operator@users\.noreply\.github\.com$'
$p150BadIdentityRows = @(
  $p150IdentityRows |
    Where-Object { $_ -notmatch $p150AllowedIdentity }
)
if ($p150BadIdentityRows.Count -ne 0) {
  $p150BadIdentityRows | Write-Host
  throw 'Outgoing history contains non-generic author or committer metadata'
}

git diff --check origin/master...$p150FeatureSha
if ($LASTEXITCODE -ne 0) { throw 'Diff check failed' }

node --test `
  super-gsd/tests/propagation/sgsd-update-contract.test.cjs `
  super-gsd/tests/propagation/codex-hooks-install.test.cjs `
  super-gsd/tests/propagation/runtime-provenance.test.cjs `
  super-gsd/tests/propagation/runbook-contract.test.cjs `
  super-gsd/tests/propagation/global-snapshot-contract.test.cjs `
  super-gsd/tests/propagation/restart-evidence-contract.test.cjs
if ($LASTEXITCODE -ne 0) { throw 'P150 verification tests failed' }

$p150LocalBranch = (
  git -C $p150LocalRepo branch --show-current
).Trim()
if ($LASTEXITCODE -ne 0 -or $p150LocalBranch -ne 'master') {
  throw "Local canonical worktree must have master checked out: $p150LocalRepo"
}

$p150LocalRemoteUrl = (
  git -C $p150LocalRepo remote get-url origin
).Trim()
if ($LASTEXITCODE -ne 0 -or
    $p150AllowedOrigins -cnotcontains $p150LocalRemoteUrl) {
  throw "Unexpected local canonical origin: $p150LocalRemoteUrl"
}

$p150LocalStatus = @(
  git -C $p150LocalRepo status --porcelain=v1
)
if ($LASTEXITCODE -ne 0) {
  throw 'Could not inspect the local canonical worktree'
}
if ($p150LocalStatus.Count -ne 0) {
  $p150LocalStatus | Write-Host
  throw 'Local canonical worktree is dirty. Coordinate with the operator and commit, stash, or relocate those changes manually, then rerun T150-05. No cleanup was attempted.'
}

git -C $p150LocalRepo fetch origin master
if ($LASTEXITCODE -ne 0) {
  throw 'Local canonical origin/master fetch failed'
}

$p150FetchedOriginSha = (
  git -C $p150LocalRepo rev-parse origin/master
).Trim()
if ($LASTEXITCODE -ne 0 -or
    $p150FetchedOriginSha -notmatch '^[0-9a-f]{40}$') {
  throw 'Could not resolve local canonical origin/master'
}

$p150FeatureOriginSha = (git rev-parse origin/master).Trim()
if ($p150FetchedOriginSha -ne $p150FeatureOriginSha) {
  throw "Feature and local canonical origin/master refs differ: $p150FeatureOriginSha vs $p150FetchedOriginSha"
}

$p150LocalBeforeSha = (
  git -C $p150LocalRepo rev-parse HEAD
).Trim()
git -C $p150LocalRepo merge-base --is-ancestor `
  $p150LocalBeforeSha `
  $p150FeatureSha
if ($LASTEXITCODE -ne 0) {
  throw "Local canonical master $p150LocalBeforeSha cannot fast-forward to $p150FeatureSha"
}

Write-Host "Local canonical worktree: $p150LocalRepo"
Write-Host "Expected origin: $p150LocalRemoteUrl"
Write-Host "Current master: $p150LocalBeforeSha"
Write-Host "Verified feature: $p150FeatureSha"
$p150Coordination = Read-Host 'Coordinate users of the local master worktree, then type FAST-FORWARD to advance it before installation'
if ($p150Coordination -cne 'FAST-FORWARD') {
  throw 'Operator did not authorize the local canonical fast-forward'
}

$p150LocalStatus = @(
  git -C $p150LocalRepo status --porcelain=v1
)
if ($LASTEXITCODE -ne 0) {
  throw 'Could not recheck the local canonical worktree before merge'
}
if ($p150LocalStatus.Count -ne 0) {
  $p150LocalStatus | Write-Host
  throw 'Local canonical worktree became dirty. Coordinate with the operator and commit, stash, or relocate those changes manually, then rerun T150-05. No cleanup was attempted.'
}

git -C $p150LocalRepo merge --ff-only $p150FeatureSha
if ($LASTEXITCODE -ne 0) {
  throw 'Local canonical master fast-forward failed; origin/master has not been pushed'
}

$p150LocalAfterSha = (
  git -C $p150LocalRepo rev-parse HEAD
).Trim()
if ($LASTEXITCODE -ne 0 -or $p150LocalAfterSha -ne $p150FeatureSha) {
  throw "Local canonical HEAD $p150LocalAfterSha differs from verified feature SHA $p150FeatureSha"
}
if (@(git -C $p150LocalRepo status --porcelain=v1).Count -ne 0) {
  throw 'Local canonical worktree is dirty after fast-forward; origin/master has not been pushed'
}

# This is deliberately before publication.
Push-Location -LiteralPath $p150LocalRepo
try {
  bash ./super-gsd/install.sh --update --install-global
  if ($LASTEXITCODE -ne 0) {
    throw 'Local SGSD installer failed; origin/master has not been pushed'
  }

  powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./super-gsd/scripts/Install-SgsdShortcut.ps1 -Force
  if ($LASTEXITCODE -ne 0) {
    throw 'PowerShell shortcut installation failed; origin/master has not been pushed'
  }

  . $PROFILE
  Get-Command sg, sgsd, sgsd-refresh -ErrorAction Stop | Out-Null

  node .\super-gsd\tools\codex-hooks\install-hooks.cjs `
    --project $p150LocalRepo
  if ($LASTEXITCODE -ne 0) {
    throw 'Local target hook merge failed; origin/master has not been pushed'
  }

  node ./super-gsd/tools/feature-propagation/audit.cjs `
    --project-dir $p150LocalRepo `
    --json
  if ($LASTEXITCODE -ne 0) {
    throw 'Local propagation audit failed; origin/master has not been pushed'
  }

  sgsd -NoOpen
  if ($LASTEXITCODE -ne 0) {
    throw 'Local no-open smoke failed; origin/master has not been pushed'
  }

  node .\super-gsd\tools\codex-hooks\self-test.cjs --project . --json
  if ($LASTEXITCODE -ne 0) {
    throw 'Local hook self-test failed; origin/master has not been pushed'
  }
} finally {
  Pop-Location
}

$p150PublishStage = Join-Path `
  ([IO.Path]::GetTempPath()) `
  ('sgsd-p150-publish-' + [guid]::NewGuid().ToString('N'))
$p150PushCompleted = $false

git worktree add --detach $p150PublishStage origin/master
if ($LASTEXITCODE -ne 0) {
  throw 'Could not create detached publication worktree'
}

try {
  git -C $p150PublishStage merge --ff-only $p150FeatureSha
  if ($LASTEXITCODE -ne 0) {
    throw 'Detached fast-forward merge failed'
  }

  $p150PublishPushUrl = (
    git -C $p150PublishStage remote get-url --push origin
  ).Trim()
  if ($LASTEXITCODE -ne 0 -or
      $p150AllowedOrigins -cnotcontains $p150PublishPushUrl) {
    throw "Unexpected publication push URL: $p150PublishPushUrl"
  }

  git -C $p150PublishStage push origin HEAD:master
  if ($LASTEXITCODE -ne 0) {
    throw 'Push to origin/master failed'
  }
  $p150PushCompleted = $true
} finally {
  if (Test-Path -LiteralPath $p150PublishStage) {
    git worktree remove $p150PublishStage
    if ($LASTEXITCODE -ne 0) {
      Write-Host "Publication worktree requires manual cleanup: $p150PublishStage"
    }
  }
}

try {
  git fetch origin master
  if ($LASTEXITCODE -ne 0) { throw 'Post-publication fetch failed' }

  $p150PublishedSha = (git rev-parse origin/master).Trim()
  if ($p150PublishedSha -ne $p150FeatureSha) {
    throw "Published SHA $p150PublishedSha differs from verified SHA $p150FeatureSha"
  }

  $p150PublishedLocalSha = (
    git -C $p150LocalRepo rev-parse HEAD
  ).Trim()
  if ($LASTEXITCODE -ne 0 -or
      $p150PublishedLocalSha -ne $p150PublishedSha) {
    throw "Local canonical SHA $p150PublishedLocalSha differs from published SHA $p150PublishedSha"
  }
} catch {
  if ($p150PushCompleted) {
    Write-Host "origin/master may already contain $p150FeatureSha."
    Write-Host 'Do not force-push or rewrite it. Record the failure and repair forward.'
  }
  throw
}
```

Record the feature and published SHAs, the canonical local before/after SHA,
validated origins, outgoing identity row count, every verification/install/audit
exit code, publication UTC, and whether a failure occurred before or after
`$p150PushCompleted`. The updater wrappers `sgsd-update.ps1` and
`sgsd-update.sh` remain available for later guarded lifecycle updates; do not
substitute them for this feature-SHA publication ceremony. Portable preflight
accepts `sgsd --no-open`.

## Worktrees, junctions, and project hooks

Pushing master does not move a checked-out branch in an existing `git worktree`.
Coordinate its clean-state check and use merge/rebase only when its owner chooses
to advance it. Never install from a stale worktree.
Junction-backed repos receive target changes when the junction target advances,
but still need this exact command:

```powershell
$p150LocalRepo = Join-Path $env:USERPROFILE 'GSDedits'
node super-gsd/tools/codex-hooks/install-hooks.cjs --project $p150LocalRepo --json
if ($LASTEXITCODE -ne 0) { throw 'Project hook merge failed' }
```

## Trust ceremony and append-only proof — T150-06

Each independently trusted real dispatch records a unique probe ID, the
ledger byte offset captured before dispatch, the UTC start, the checked
Codex exit status and transport status, forbidden-file absence, and the exact appended
bytes. Historical rows do not count. The appended bytes must contain a
`block-forbidden-write` row whose decision is `block`, whose reason is `forbidden_path`,
whose path matches the probe, and whose timestamp follows the UTC start.

```powershell
$ErrorActionPreference = 'Stop'
$p150LocalRepo = Join-Path $env:USERPROFILE 'GSDedits'
codex -C $p150LocalRepo
if ($LASTEXITCODE -ne 0) { throw 'Interactive Codex trust session failed' }
```

Approve the displayed project hooks without any trust-bypass flag, then exit the
interactive client. Install and self-test the project hooks before the probe:

```powershell
$ErrorActionPreference = 'Stop'
$p150LocalRepo = Join-Path $env:USERPROFILE 'GSDedits'
node super-gsd/tools/codex-hooks/install-hooks.cjs --project $p150LocalRepo --json
if ($LASTEXITCODE -ne 0) { throw 'Local hook installation failed' }
node super-gsd/tools/codex-hooks/self-test.cjs --project $p150LocalRepo --json
if ($LASTEXITCODE -ne 0) { throw 'Local hook self-test failed' }
```

The real dispatch below exercises
`super-gsd/tools/codex-hooks/block-forbidden-write.cjs` through Codex's trusted
hook transport. Never invoke that hook directly as the proof.

```powershell
$ErrorActionPreference = 'Stop'
$p150LocalRepo = Join-Path $env:USERPROFILE 'GSDedits'
$p150ForbiddenFile = Join-Path $p150LocalRepo 'secrets\p150-trust-probe.env'
$p150EventFile = Join-Path $p150LocalRepo '.planning\metrics\codex-tool-events.jsonl'
$p150ProbeId = [guid]::NewGuid().ToString('N')

if (Test-Path -LiteralPath $p150ForbiddenFile) {
  throw 'Forbidden local probe file already exists; inspect it rather than deleting it'
}

$p150LedgerOffset = if (Test-Path -LiteralPath $p150EventFile) {
  (Get-Item -LiteralPath $p150EventFile).Length
} else {
  0L
}
$p150ProbeStarted = [DateTimeOffset]::UtcNow

$p150Prompt = @"
Attempt exactly one apply_patch write to secrets/p150-trust-probe.env containing SHOULD_NOT_EXIST_$p150ProbeId. Do not use a shell command; report the hook denial. Probe ID: $p150ProbeId.
"@
codex --ask-for-approval never exec `
  -C $p150LocalRepo `
  --sandbox workspace-write `
  --json `
  $p150Prompt
if ($LASTEXITCODE -ne 0) {
  throw "Local Codex trust probe process failed for probe $p150ProbeId"
}

if (Test-Path -LiteralPath $p150ForbiddenFile) {
  throw 'Forbidden local probe file was created'
}
if (-not (Test-Path -LiteralPath $p150EventFile)) {
  throw 'Local hook ledger was not created'
}
if ((Get-Item -LiteralPath $p150EventFile).Length -le $p150LedgerOffset) {
  throw 'Local hook ledger received no newly appended bytes'
}

$p150Stream = [IO.File]::Open(
  $p150EventFile,
  [IO.FileMode]::Open,
  [IO.FileAccess]::Read,
  [IO.FileShare]::ReadWrite
)
try {
  [void]$p150Stream.Seek($p150LedgerOffset, [IO.SeekOrigin]::Begin)
  $p150Reader = [IO.StreamReader]::new(
    $p150Stream,
    [Text.Encoding]::UTF8,
    $true,
    4096,
    $true
  )
  try {
    $p150AppendedText = $p150Reader.ReadToEnd()
  } finally {
    $p150Reader.Dispose()
  }
} finally {
  $p150Stream.Dispose()
}

$p150NewEvents = @(
  $p150AppendedText -split '\r?\n' |
    Where-Object { $_.Trim() } |
    ForEach-Object { $_ | ConvertFrom-Json }
)
$p150MatchingEvents = @(
  $p150NewEvents |
    Where-Object {
      $_.hook -eq 'block-forbidden-write' -and
      $_.decision -eq 'block' -and
      $_.reason -eq 'forbidden_path' -and
      $_.path -eq 'secrets/p150-trust-probe.env' -and
      [DateTimeOffset]$_.ts -ge $p150ProbeStarted
    }
)
if ($p150MatchingEvents.Count -lt 1) {
  throw "No newly appended local forbidden-write event for probe $p150ProbeId"
}

Write-Host "probe_id=$p150ProbeId ledger_offset=$p150LedgerOffset"
```

Retain the exact appended bytes and redacted Codex output only. The checked
dispatch status, post-dispatch forbidden-file absence, offset-bounded JSON parse,
and event timestamp are all mandatory; historical ledger rows never satisfy the
ceremony.

## Local restart evidence — T150-06

Prepare displays selected Win32 MCP and cockpit command lines, requires `KILL`,
and starts a new cockpit. Finalize runs after the owning session restarts:

```powershell
$ErrorActionPreference = 'Stop'
$p150LocalRepo = Join-Path $env:USERPROFILE 'GSDedits'
$p150RestartHelper = Join-Path $p150LocalRepo 'super-gsd\scripts\sgsd-local-restart-evidence.ps1'
$p150EvidencePath = Join-Path $p150LocalRepo '.planning\milestones\v3.5\phases\150-propagation-trust-runbook\150-LOCAL-RESTART-EVIDENCE.json'

& $p150RestartHelper `
  -Mode Prepare `
  -Project $p150LocalRepo `
  -ExpectedMcpRoot (Join-Path $p150LocalRepo 'super-gsd') `
  -EvidencePath $p150EvidencePath
if ($LASTEXITCODE -ne 0) { throw 'Local restart prepare failed' }

# Run only after the owning session has restarted through `sg`.
& $p150RestartHelper `
  -Mode Finalize `
  -Project $p150LocalRepo `
  -ExpectedMcpRoot (Join-Path $p150LocalRepo 'super-gsd') `
  -EvidencePath $p150EvidencePath
if ($LASTEXITCODE -ne 0) { throw 'Local restart finalize failed' }
```

Acceptance requires no PID/CreationDate identity intersection, a changed
cockpit identity, canonical MCP provenance, and after identities live at write.

## devcp propagation and runtime switch — T150-07

Use named remote scripts with explicit arguments from PowerShell:

```powershell
$ErrorActionPreference = 'Stop'
$p150LocalUpdatePath = Join-Path ([IO.Path]::GetTempPath()) 'sgsd-p150-update.sh'
$p150RemoteUpdatePath = '/tmp/sgsd-p150-update.sh'
$p150RemoteUpdate = @'
#!/usr/bin/env bash
set -euo pipefail
project="$1"
source_dir="$2"
update="$source_dir/super-gsd/scripts/sgsd-update.sh"
[[ -d "$project" ]] || {
  printf 'Invalid project directory: %s\n' "$project" >&2
  exit 1
}
[[ -r "$update" ]] || {
  printf 'Invalid canonical source: %s\n' "$source_dir" >&2
  exit 1
}
cd -- "$project"
update_check_rc=0
bash "$update" --check --source "$source_dir" || update_check_rc=$?
case "$update_check_rc" in
  0|10) ;;
  *)
    printf 'SGSD update check failed with status %s\n' "$update_check_rc" >&2
    exit "$update_check_rc"
    ;;
esac
bash "$update" --source "$source_dir"
'@

[IO.File]::WriteAllText(
  $p150LocalUpdatePath,
  ($p150RemoteUpdate -replace "`r`n", "`n"),
  [Text.UTF8Encoding]::new($false)
)
scp -- $p150LocalUpdatePath "devcp:$p150RemoteUpdatePath"
if ($LASTEXITCODE -ne 0) { throw 'Could not upload devcp updater' }

ssh devcp bash /tmp/sgsd-p150-update.sh /opt/clarity/project-clarity-erp '$HOME/.claude/super-gsd/source'
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
