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
$p150RemotePushUrls = @(
  git remote get-url --push --all origin
)
if ($LASTEXITCODE -ne 0 -or $p150RemotePushUrls.Count -eq 0) { throw 'Could not resolve origin push URLs' }
$p150LocalRepo = Join-Path $env:USERPROFILE 'GSDedits'

if (-not $p150FeatureBranch -or $p150FeatureBranch -eq 'master') {
  throw 'Run this ceremony from the completed P150 feature branch'
}
if ($p150AllowedOrigins -cnotcontains $p150RemoteUrl) {
  throw "Unexpected origin: $p150RemoteUrl"
}
foreach ($p150RemotePushUrl in $p150RemotePushUrls) {
  if ($p150AllowedOrigins -cnotcontains $p150RemotePushUrl) {
    throw "Unexpected origin push URL: $p150RemotePushUrl"
  }
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

  $p150PublishPushUrls = @(
    git -C $p150PublishStage remote get-url --push --all origin
  )
  if ($LASTEXITCODE -ne 0 -or $p150PublishPushUrls.Count -eq 0) {
    throw 'Could not resolve publication push URLs'
  }
  foreach ($p150PublishPushUrl in $p150PublishPushUrls) {
    if ($p150AllowedOrigins -cnotcontains $p150PublishPushUrl) {
      throw "Unexpected publication push URL: $p150PublishPushUrl"
    }
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
