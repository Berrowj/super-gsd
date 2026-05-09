# sgsd-tab-init.ps1
# Single-call initializer for SGSD-launched Warp tabs. Replaces the older
# `. $PROFILE; <command>` pattern (which broke on machines whose $PROFILE
# resolves to a OneDrive path with spaces). Each launch-config exec line
# calls this helper with a role tag, then runs its own foreground command.
#
# Responsibilities:
#   1. Force UTF-8 console output (so emoji + box-drawing in titles + banners
#      survive the OSC 0 write to Warp).
#   2. Dot-source the repo-resident sgsd-profile-extensions.ps1 (avoiding any
#      $PROFILE indirection through OneDrive).
#   3. Set the tab title once synchronously (so the tab is correctly labeled
#      before any slow foreground command runs).
#   4. Spawn sgsd-tab-watcher.ps1 as a Start-ThreadJob to keep the title
#      refreshed every IntervalSeconds.
#
# All four steps are best-effort: failure of any one is non-fatal — the
# foreground command continues regardless. A bad helper should never block
# the operator from getting their shell.
#
# Usage from launch-config yaml exec:
#   powershell -NoExit -ExecutionPolicy Bypass -Command "& 'C:\Users\jack.berrow\GSDedits\super-gsd\scripts\lib\sgsd-tab-init.ps1' -Role cockpit -ProjectDir 'C:\Users\jack.berrow\GSDedits'; sgsd"

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('claude','codex','cockpit','review','debug','post-mortem','remote-monitor','token-audit')]
    [string]$Role,

    [string]$ProjectDir = (Get-Location).Path,

    [int]$IntervalSeconds = 120
)

# UTF-8 output for OSC + emoji + box-drawing. Best-effort because managed
# ConstrainedLanguage shells reject static property setters.
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

try { $ProjectDir = (Resolve-Path -LiteralPath $ProjectDir -ErrorAction Stop).Path } catch {}

# Repo-resident profile extensions (NOT $PROFILE). Idempotent; safe if missing.
$profileExt = Join-Path $ProjectDir 'super-gsd\scripts\sgsd-profile-extensions.ps1'
if (Test-Path $profileExt) {
    try { . $profileExt } catch { Write-Host "WARN: profile extensions failed to load: $_" -ForegroundColor DarkYellow }
}

# Set initial title synchronously, then spawn the watcher in background.
$watcherPath = Join-Path $ProjectDir 'super-gsd\scripts\lib\sgsd-tab-watcher.ps1'
if (Test-Path $watcherPath) {
    try {
        & $watcherPath -Role $Role -ProjectDir $ProjectDir -Once
    } catch {
        Write-Host "WARN: tab-watcher initial run failed: $_" -ForegroundColor DarkYellow
    }

    # Spawn the watcher loop in its own runspace. Pure-stdlib alternative to
    # Start-ThreadJob — works on any PS 5.1+ without the optional ThreadJob
    # module. The runspace runs independently of the main pipeline (so the
    # watcher fires even while the foreground command is busy) and shares the
    # parent process's console handle (so [Console]::Write OSC sequences
    # reach Warp's tab pty).
    try {
        $runspace = [System.Management.Automation.Runspaces.RunspaceFactory]::CreateRunspace()
        $runspace.ApartmentState = [System.Threading.ApartmentState]::MTA
        $runspace.ThreadOptions  = [System.Management.Automation.Runspaces.PSThreadOptions]::ReuseThread
        $runspace.Open()

        $ps = [PowerShell]::Create()
        $ps.Runspace = $runspace
        $null = $ps.AddScript({
            param($wp, $r, $pd, $iv)
            & $wp -Role $r -ProjectDir $pd -IntervalSeconds $iv
        }).AddArgument($watcherPath).AddArgument($Role).AddArgument($ProjectDir).AddArgument($IntervalSeconds)
        $null = $ps.BeginInvoke()

        # Stash refs at script scope so they don't get GC'd. Tab close will
        # tear down the host process, taking the runspace with it.
        $global:SgsdTabWatcherRunspace = $runspace
        $global:SgsdTabWatcherPS       = $ps
    } catch {
        Write-Host "WARN: tab-watcher runspace failed to spawn: $_" -ForegroundColor DarkYellow
    }
}
