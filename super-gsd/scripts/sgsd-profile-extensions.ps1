# =============================================================================
# SGSD Profile Extensions
# =============================================================================
# Repo-resident PowerShell helpers that add at-a-glance SGSD state to any
# Warp/PowerShell tab where this script is dot-sourced.
#
# IMPORTANT: This file lives in the repo deliberately. Do NOT dot-source it
# from `$PROFILE` if your `$PROFILE` lives under OneDrive (or any other
# cloud-synced shared work folder). Loading SGSD-specific code from a synced
# work profile would leak SGSD context into the synced location.
#
# RECOMMENDED ENTRY POINTS (pick one -- none of them touch your $PROFILE):
#
#   1. Warp launch configurations under
#      $HOME\.warp\launch_configurations\sgsd-*.yaml -- each pane runs
#      ". $PROFILE" then dot-sources this file. SGSD features only load in
#      SGSD-launched workspaces. (Recommended.)
#
#   2. A purely-local profile NOT in OneDrive, e.g. write a one-line file at
#      C:\Users\jack.berrow\sgsd-init.ps1 containing:
#          . "C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-profile-extensions.ps1"
#      and dot-source THAT from a manually-launched local profile when you
#      want SGSD features. Don't put the dot-source in your OneDrive
#      $PROFILE.
#
#   3. Manual one-off: just run
#          . C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-profile-extensions.ps1
#      in any tab you want to enable for the rest of that session.
#
# WHAT IT ADDS:
#   - $global:__SgsdRepoRoot      → the SGSD repo path
#   - Get-SgsdTabState            → snapshot of current SGSD state
#   - Update-SgsdTitle            → write Warp tab title from snapshot
#   - prompt override             → refresh title + repo cue every prompt
#                                   (works on PS 5.1 -- uses prompt-time
#                                    cd detection, not LocationChangedAction
#                                    which is PS 6+ only)
#   - sgsd-status / sgsd-doctor / sgsd-pulse / sgsd-route → quick aliases
#
# REVERT: dot-source `Remove-SgsdProfileExtensions` (defined below) to undo
# the prompt override and aliases for the current session. Or just exit the
# tab.
# =============================================================================

$global:__SgsdRepoRoot = 'C:\Users\jack.berrow\GSDedits'
$global:__SgsdLastDir  = $null
$global:__SgsdTabTipShown = $false

function global:Get-SgsdTabState {
    $r = @{
        Emoji = [char]::ConvertFromUtf32(0x26AB)  # idle
        Milestone = '?'
        Phase = 'P?'
        Provider = ''
        Elapsed = ''
    }
    $root = $global:__SgsdRepoRoot
    if (-not (Test-Path $root)) { return $r }

    $statePath = Join-Path $root '.planning\STATE.md'
    if (Test-Path $statePath) {
        try {
            $front = Get-Content $statePath -TotalCount 30 -Encoding UTF8 -ErrorAction Stop | Out-String
            if ($front -match 'milestone:\s*(\S+)') { $r.Milestone = $Matches[1] }
            if ($front -match 'phase_(\d+):\s*"ACTIVE') {
                $r.Phase = "P$($Matches[1])"
            } elseif ($front -match 'roadmap_run:[\s\S]*?current_phase:\s*([^\s]+)') {
                $r.Phase = $Matches[1]
            }
            if ($front -match 'BLOCKED|HARD-BLOCKER') {
                $r.Emoji = [char]::ConvertFromUtf32(0x1F534)  # blocked
            }
        } catch { }
    }

    if (Test-Path (Join-Path $root '.planning\ORCHESTRATOR-CHECKPOINT.md')) {
        $r.Emoji = [char]::ConvertFromUtf32(0x1F7E1)  # paused
    }

    $livePath = Join-Path $root '.planning\ORCHESTRATOR-LIVE.jsonl'
    if (Test-Path $livePath) {
        try {
            $tail = Get-Content $livePath -Tail 8 -Encoding UTF8 -ErrorAction Stop
            $latestTs = $null
            $latestPhaseStartedTs = $null
            foreach ($line in $tail) {
                try {
                    $evt = $line | ConvertFrom-Json -ErrorAction Stop
                    if ($evt.ts) {
                        $ts = [datetime]::Parse($evt.ts).ToUniversalTime()
                        if (-not $latestTs -or $ts -gt $latestTs) { $latestTs = $ts }
                        if ($evt.type -eq 'phase_started' -and (-not $latestPhaseStartedTs -or $ts -gt $latestPhaseStartedTs)) {
                            $latestPhaseStartedTs = $ts
                        }
                    }
                } catch { }
            }
            if ($latestTs) {
                $age = ([datetime]::UtcNow - $latestTs).TotalSeconds
                if ($age -lt 60 -and $r.Emoji -eq [char]::ConvertFromUtf32(0x26AB)) {
                    $r.Emoji = [char]::ConvertFromUtf32(0x1F7E2)  # running
                }
            }
            if ($latestPhaseStartedTs) {
                $elapsed = [datetime]::UtcNow - $latestPhaseStartedTs
                if ($elapsed.TotalMinutes -ge 5) {
                    $r.Elapsed = (' • {0}m{1:00}s' -f [math]::Floor($elapsed.TotalMinutes), $elapsed.Seconds)
                } elseif ($elapsed.TotalSeconds -ge 30) {
                    $r.Elapsed = (' • {0}s' -f [math]::Floor($elapsed.TotalSeconds))
                }
            }
        } catch { }
    }

    $routePath = Join-Path $root '.planning\metrics\route-decisions.jsonl'
    if (Test-Path $routePath) {
        try {
            $tail = Get-Content $routePath -Tail 5 -Encoding UTF8 -ErrorAction Stop
            for ($i = $tail.Count - 1; $i -ge 0; $i--) {
                try {
                    $row = $tail[$i] | ConvertFrom-Json -ErrorAction Stop
                    if ($row.boundary -eq 'execution_route' -and $row.ts) {
                        $rowTs = [datetime]::Parse($row.ts).ToUniversalTime()
                        $age = ([datetime]::UtcNow - $rowTs).TotalMinutes
                        if ($age -lt 5) {
                            $p = $row.decision.chosen_provider
                            $r.Provider = switch ($p) {
                                'codex'        { ' [Codex]' }
                                'claude'       { ' [Claude]' }
                                'local-script' { ' [Local]' }
                                default        { '' }
                            }
                            break
                        }
                    }
                } catch { }
            }
        } catch { }
    }

    return $r
}

function global:Update-SgsdTitle {
    try {
        # Multi-repo aware: walk up from cwd to find the current tab's SGSD
        # root, fall back to $global:__SgsdRepoRoot only if we're not in an
        # SGSD repo. Earlier behavior always used the hardcoded GSDedits root,
        # which gave the wrong title in non-GSDedits tabs.
        $effectiveRoot = $null
        $cur = (Get-Location).Path
        while ($cur -and (Test-Path -LiteralPath $cur)) {
            if (Test-Path -LiteralPath (Join-Path $cur '.planning\STATE.md')) { $effectiveRoot = $cur; break }
            $parent = Split-Path -Parent $cur
            if (-not $parent -or $parent -eq $cur) { break }
            $cur = $parent
        }
        if (-not $effectiveRoot) { $effectiveRoot = $global:__SgsdRepoRoot }

        $prevRoot = $global:__SgsdRepoRoot
        $global:__SgsdRepoRoot = $effectiveRoot
        try {
            $s = Get-SgsdTabState
            $repoLeaf = if ($effectiveRoot) { Split-Path -Leaf $effectiveRoot } else { '?' }
            $title = '{0} SGSD {1}·{2}/{3}{4}{5}' -f $s.Emoji, $repoLeaf, $s.Milestone, $s.Phase, $s.Provider, $s.Elapsed
            $Host.UI.RawUI.WindowTitle = $title
        } finally {
            $global:__SgsdRepoRoot = $prevRoot
        }
    } catch { }
}

function global:sgsd-watch {
    # Convenience wrapper: starts the OSC-driven tab-title watcher in the
    # current tab against whatever repo is cwd-detected. No args needed in
    # the common case — just `cd <repo>` then `sgsd-watch`.
    param(
        [ValidateSet('claude','codex','cockpit','review','debug','post-mortem','remote-monitor','token-audit')]
        [string]$Role = 'claude',
        [int]$IntervalSeconds = 120
    )
    $candidate = 'C:\Users\jack.berrow\GSDedits\super-gsd\scripts\lib\sgsd-tab-init.ps1'
    if (-not (Test-Path -LiteralPath $candidate)) {
        Write-Host "sgsd-watch: cannot find sgsd-tab-init.ps1 at $candidate" -ForegroundColor Red
        return
    }
    & $candidate -Role $Role -ProjectDir (Get-Location).Path -IntervalSeconds $IntervalSeconds
    Write-Host "sgsd-watch: live title started (Role=$Role, refresh=${IntervalSeconds}s)" -ForegroundColor Green
}

function global:Test-SgsdRepoCue {
    $cwd = (Get-Location).Path
    if ($cwd -eq $global:__SgsdLastDir) { return }
    $global:__SgsdLastDir = $cwd
    $statePath = Join-Path $cwd '.planning\STATE.md'
    if (-not (Test-Path $statePath)) { return }
    try {
        $front = Get-Content $statePath -TotalCount 8 -Encoding UTF8 -ErrorAction Stop | Out-String
        if ($front -match 'milestone:\s*(\S+)') {
            Write-Host "[SGSD] $($Matches[1]) -- type 'sg' to boot cockpit + Claude" -ForegroundColor Cyan
        }
        Update-SgsdTitle
    } catch { }
}

function global:sgsd-status {
    Get-Content (Join-Path $global:__SgsdRepoRoot '.planning\STATE.md') -TotalCount 30 -Encoding UTF8
}
function global:sgsd-doctor {
    node (Join-Path $global:__SgsdRepoRoot 'super-gsd\tools\warp-doctor\check.cjs') --project $global:__SgsdRepoRoot
}
function global:sgsd-pulse {
    $p = Join-Path $global:__SgsdRepoRoot '.planning\ORCHESTRATOR-LIVE.jsonl'
    if (Test-Path $p) { Get-Content $p -Tail 20 -Encoding UTF8 } else { Write-Host 'no live file yet' -ForegroundColor Yellow }
}
function global:sgsd-route {
    $p = Join-Path $global:__SgsdRepoRoot '.planning\metrics\route-decisions.jsonl'
    if (Test-Path $p) { Get-Content $p -Tail 10 -Encoding UTF8 } else { Write-Host 'no route-decisions.jsonl yet' -ForegroundColor Yellow }
}

# Save the original prompt so we can chain to it (and so Remove- can restore).
if (-not $global:__SgsdOriginalPrompt) {
    $global:__SgsdOriginalPrompt = $function:prompt
}
function global:prompt {
    Update-SgsdTitle
    Test-SgsdRepoCue
    if ($global:__SgsdOriginalPrompt) {
        & $global:__SgsdOriginalPrompt
    } else {
        "PS $($executionContext.SessionState.Path.CurrentLocation)$('>' * ($nestedPromptLevel + 1)) "
    }
}

function global:Remove-SgsdProfileExtensions {
    if ($global:__SgsdOriginalPrompt) {
        Set-Item -Path Function:\prompt -Value $global:__SgsdOriginalPrompt
        $global:__SgsdOriginalPrompt = $null
    }
    foreach ($n in 'Get-SgsdTabState','Update-SgsdTitle','Test-SgsdRepoCue','sgsd-status','sgsd-doctor','sgsd-pulse','sgsd-route') {
        if (Test-Path "Function:\$n") { Remove-Item "Function:\$n" -ErrorAction SilentlyContinue }
    }
    $global:__SgsdRepoRoot = $null
    $global:__SgsdLastDir = $null
    $global:__SgsdTabTipShown = $false
    Write-Host 'SGSD profile extensions removed for this session.' -ForegroundColor DarkGray
}

# Run once on dot-source so the title is correct immediately.
Update-SgsdTitle
