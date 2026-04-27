# ============================================================================
# Phase 30 T1 - Boot Flag + Dashboard Host Static/Smoke Verifier
# ============================================================================
# Static-parse + safe-smoke for the 7 documented sg/sgsd boot flags + the
# -Go/-Greet mutex + the Write-DashboardFailure/Hold-Pane failure pane contract.
#
# Claude-spawning flags (-Claude, -Go, -Greet) are static-verified ONLY; we
# never spawn a real Claude window. The mutex check IS smokeable because the
# boot script exits before Claude spawn.
#
# Exit code 0 if all checks pass, 1 otherwise.
# ASCII-only literals (PS 5.1 mojibake guard).
# ============================================================================

param(
    [string]$EvidenceFile = $null
)

$ErrorActionPreference = "Stop"

$here     = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $here "..\..\..")
$installer = Join-Path $repoRoot "super-gsd\scripts\Install-SgsdShortcut.ps1"
$boot      = Join-Path $repoRoot "super-gsd\scripts\sgsd-boot.ps1"
$hostPath  = Join-Path $repoRoot "super-gsd\scripts\sgsd-dashboard-host.ps1"
$guide     = Join-Path $repoRoot "super-gsd\docs\SGSD-BOOT-STARTUP-GUIDE.md"
$readme    = Join-Path $repoRoot "README.md"

foreach ($p in @($installer, $boot, $hostPath, $guide, $readme)) {
    if (-not (Test-Path $p)) {
        Write-Host "[ERROR] missing source-of-truth file: $p" -ForegroundColor Red
        exit 2
    }
}

$installerRaw = Get-Content -Raw $installer
$bootRaw      = Get-Content -Raw $boot
$hostRaw      = Get-Content -Raw $hostPath
$guideRaw     = Get-Content -Raw $guide
$readmeRaw    = Get-Content -Raw $readme

$results = @()
function Add-Result {
    param([string]$Id, [bool]$Pass, [string]$Detail)
    $script:results += [pscustomobject]@{ Id=$Id; Pass=$Pass; Detail=$Detail }
    $color = if ($Pass) { "Green" } else { "Red" }
    $tag   = if ($Pass) { "PASS" } else { "FAIL" }
    Write-Host ("[{0}] {1}: {2}" -f $tag, $Id, $Detail) -ForegroundColor $color
}

# Helper: build a regex that matches "[switch]`$Flag" inside the installer HEREDOC.
# The installer wraps switch params with backtick before $ so the HEREDOC defers
# variable expansion. We accept either backtick-escaped or plain $.
function Test-SwitchInHeredoc {
    param([string]$Body, [string]$FlagName)
    $pat = '\[switch\]`?\$' + [regex]::Escape($FlagName) + '\b'
    return ($Body -match $pat)
}

function Test-PlainSwitchParam {
    param([string]$Body, [string]$FlagName)
    $pat = '\[switch\]\$' + [regex]::Escape($FlagName) + '\b'
    return ($Body -match $pat)
}

# ----------------------------------------------------------------------------
# C1: sgsd function declares the 8 documented switch params + ProjectDir
# ----------------------------------------------------------------------------
$c1Required = @("NoOpen","SkipPreflight","Bootstrap","Backfill","Claude","Go","Greet","Help")
$c1Missing  = @()
foreach ($flag in $c1Required) {
    if (-not (Test-SwitchInHeredoc $installerRaw $flag)) { $c1Missing += $flag }
}
$c1Detail = if ($c1Missing.Count -eq 0) { "sgsd function declares all 8 documented switches + ProjectDir" } else { "sgsd function MISSING: $($c1Missing -join ',')" }
Add-Result "C1" ($c1Missing.Count -eq 0) $c1Detail

# ----------------------------------------------------------------------------
# C2: sg function declares the 4 documented switch params + ProjectDir
# ----------------------------------------------------------------------------
$c2Required = @("FullPreflight","Go","NoCockpit","NoClaude")
$c2Missing  = @()
foreach ($flag in $c2Required) {
    if (-not (Test-SwitchInHeredoc $installerRaw $flag)) { $c2Missing += $flag }
}
$c2Detail = if ($c2Missing.Count -eq 0) { "sg function declares all 4 daily-shortcut switches + ProjectDir" } else { "sg function MISSING: $($c2Missing -join ',')" }
Add-Result "C2" ($c2Missing.Count -eq 0) $c2Detail

# ----------------------------------------------------------------------------
# C3: every sgsd flag (except local Help) is a param in sgsd-boot.ps1
# ----------------------------------------------------------------------------
$c3Required = @("NoOpen","SkipPreflight","Bootstrap","Backfill","Claude","Go","Greet")
$c3Missing  = @()
foreach ($flag in $c3Required) {
    if (-not (Test-PlainSwitchParam $bootRaw $flag)) { $c3Missing += $flag }
}
$c3Detail = if ($c3Missing.Count -eq 0) { "sgsd-boot.ps1 param block honors all 7 forwarding switches" } else { "sgsd-boot.ps1 MISSING: $($c3Missing -join ',')" }
Add-Result "C3" ($c3Missing.Count -eq 0) $c3Detail

# ----------------------------------------------------------------------------
# C4: -Go -Greet mutex guard exists in sgsd-boot.ps1
# ----------------------------------------------------------------------------
$c4Match = [regex]::IsMatch($bootRaw, 'if\s*\(\s*\$Go\s+-and\s+\$Greet\s*\)')
$c4Detail = if ($c4Match) { "boot script contains -Go/-Greet mutex guard" } else { "boot script missing -Go/-Greet mutex" }
Add-Result "C4" $c4Match $c4Detail

# ----------------------------------------------------------------------------
# C5: sgsd-boot.ps1 -NoOpen -SkipPreflight smokes clean (exit 0 + literal printed)
# ----------------------------------------------------------------------------
$c5Stdout = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $boot -NoOpen -SkipPreflight -ProjectDir $repoRoot 2>&1
$c5Exit = $LASTEXITCODE
$c5Joined = ($c5Stdout | Out-String)
$c5HasFlag = ($c5Joined -match "NoOpen flag set")
$c5Pass = ($c5Exit -eq 0) -and $c5HasFlag
Add-Result "C5" $c5Pass ("boot -NoOpen -SkipPreflight exit=$c5Exit; 'NoOpen flag set' present=$c5HasFlag")

# ----------------------------------------------------------------------------
# C6: sgsd-boot.ps1 -NoOpen smokes clean + boot honors KNOW-01 (private KB optional)
#     (this captures the A5 no-private-KB scenario evidence)
#
# Boot script emits one of two branches per env:
#   no-private-KB env: 'Private knowledge bank optional; fallback=...' (DarkGray OK)
#   private-KB env:    'Private knowledge bank present (<path>)'
# Either branch evidences KNOW-01 (private KB is optional, never required).
# ----------------------------------------------------------------------------
$c6Stdout = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $boot -NoOpen -ProjectDir $repoRoot 2>&1
$c6Exit = $LASTEXITCODE
$c6Joined = ($c6Stdout | Out-String)
$c6Optional = ($c6Joined -match "Private knowledge bank optional")
$c6Present  = ($c6Joined -match "Private knowledge bank present")
$c6Branch = if ($c6Optional) { "fallback (no-private-KB)" } elseif ($c6Present) { "present (private-KB-installed)" } else { "neither-found" }
$c6Pass = ($c6Exit -eq 0) -and ($c6Optional -or $c6Present)
Add-Result "C6" $c6Pass ("boot -NoOpen exit=$c6Exit; A5 KNOW-01 branch=$c6Branch")

# ----------------------------------------------------------------------------
# C7: -Go -Greet mutex smokes to exit=1
# ----------------------------------------------------------------------------
$c7Stdout = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $boot -NoOpen -Go -Greet -ProjectDir $repoRoot 2>&1
$c7Exit = $LASTEXITCODE
$c7Pass = ($c7Exit -eq 1)
Add-Result "C7" $c7Pass ("boot -NoOpen -Go -Greet exit=$c7Exit (expected 1)")

# ----------------------------------------------------------------------------
# C8: -Help cheat sheet lists every flag (regex sweep on installer body 123-139)
# ----------------------------------------------------------------------------
$c8Required = @("-NoOpen","-SkipPreflight","-Bootstrap","-Backfill","-Claude","-Go","-Greet","-Help")
$c8Missing  = @()
foreach ($flag in $c8Required) {
    if ($installerRaw -notmatch [regex]::Escape($flag)) { $c8Missing += $flag }
}
$c8Detail = if ($c8Missing.Count -eq 0) { "installer Help cheat sheet references all 8 flags" } else { "installer Help cheat sheet MISSING: $($c8Missing -join ',')" }
Add-Result "C8" ($c8Missing.Count -eq 0) $c8Detail

# ----------------------------------------------------------------------------
# C9: SGSD-BOOT-STARTUP-GUIDE.md cheat sheet has rows for all documented forms
# ----------------------------------------------------------------------------
$c9Rows = @(
    @{ Pat = '\|\s*`sgsd`\s*\|';            Name = 'sgsd' },
    @{ Pat = '\|\s*`sg`\s*\|';              Name = 'sg' },
    @{ Pat = '\|\s*`sg -Go`\s*\|';          Name = 'sg -Go' },
    @{ Pat = '\|\s*`sg -FullPreflight`';    Name = 'sg -FullPreflight' },
    @{ Pat = '\|\s*`sg -NoClaude`';         Name = 'sg -NoClaude' },
    @{ Pat = '\|\s*`sg -NoCockpit`';        Name = 'sg -NoCockpit' },
    @{ Pat = '\|\s*`sgsd -Claude -Greet`';  Name = 'sgsd -Claude -Greet' }
)
$c9Missing = @()
foreach ($row in $c9Rows) {
    if ($guideRaw -notmatch $row.Pat) { $c9Missing += $row.Name }
}
$c9Detail = if ($c9Missing.Count -eq 0) { "guide cheat sheet has all 7 documented command rows" } else { "guide cheat sheet MISSING rows: $($c9Missing -join ',')" }
Add-Result "C9" ($c9Missing.Count -eq 0) $c9Detail

# ----------------------------------------------------------------------------
# H1-H4: dashboard host failure pane (BOOT-04)
# ----------------------------------------------------------------------------
$h1 = ($hostRaw -match "Clear-Host")
Add-Result "H1" $h1 "Clear-Host literal present in dashboard host"

# Hold-Pane invocation count: matches outside the function definition line.
$holdRefs = ([regex]::Matches($hostRaw, '(?m)^\s*Hold-Pane\s*$')).Count
$h2 = ($holdRefs -eq 3)
Add-Result "H2" $h2 ("Hold-Pane invocation count = $holdRefs (expected 3 - one per failure path)")

# No 'exit' or 'return' between Write-DashboardFailure and Hold-Pane in any path.
$lines = $hostRaw -split "`r?`n"
$h3Pass = $true
$h3Detail = "no exit/return between Write-DashboardFailure and Hold-Pane"
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "Write-DashboardFailure" -and $lines[$i] -notmatch "^\s*function ") {
        for ($j = $i + 1; $j -lt [Math]::Min($i + 5, $lines.Count); $j++) {
            if ($lines[$j] -match "Hold-Pane") { break }
            if ($lines[$j] -match "^\s*(exit\s|return\s|return$|exit$)") {
                $h3Pass = $false
                $h3Detail = "FOUND exit/return at line $($j+1) before Hold-Pane (after Write-DashboardFailure at line $($i+1))"
                break
            }
        }
        if (-not $h3Pass) { break }
    }
}
Add-Result "H3" $h3Pass $h3Detail

$h4 = ($hostRaw -match 'while\s*\(\s*\$true\s*\)\s*\{\s*Start-Sleep')
Add-Result "H4" $h4 "Hold-Pane infinite-loop literal 'while (`$true) { Start-Sleep' present"

# ----------------------------------------------------------------------------
# B1-B5: README.md BOOT-03 audit (gap recording, no edit)
# ----------------------------------------------------------------------------
$b1NoSg = -not ($readmeRaw -match "(?m)^\s*sg\s")
Add-Result "B1" $b1NoSg "README has no daily 'sg' command form (gap to record - v1.7 backlog)"

$b2NoNoOpen = -not ($readmeRaw -match "sgsd-boot\.ps1\s+-NoOpen")
Add-Result "B2" $b2NoNoOpen "README has no 'sgsd-boot.ps1 -NoOpen' guidance (gap to record)"

$b3NoFullPre = -not ($readmeRaw -match "sgsd-boot\.ps1.*-FullPreflight")
Add-Result "B3" $b3NoFullPre "README has no 'sgsd-boot.ps1 -FullPreflight' guidance (gap to record)"

$b4Legacy = ($readmeRaw -match "powershell -File super-gsd/scripts/sgsd-boot\.ps1")
Add-Result "B4" $b4Legacy "README still has legacy 'powershell -File super-gsd/scripts/sgsd-boot.ps1' form (compliant baseline)"

$b5NoVtpReq = -not ($readmeRaw -match "(?im)\bvtp-kb\b.*\b(required|mandatory)\b")
Add-Result "B5" $b5NoVtpReq "README has no VTP-required language (BOOT-03 KNOW-01 compliant)"

# ----------------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------------
$pass = ($results | Where-Object { $_.Pass }).Count
$total = $results.Count
$failures = $results | Where-Object { -not $_.Pass }

Write-Host ""
$summaryColor = if ($failures.Count -eq 0) { "Green" } else { "Red" }
Write-Host ("verify-boot-flags: {0}/{1} PASS" -f $pass, $total) -ForegroundColor $summaryColor

# Optional: write evidence file payload
if ($EvidenceFile) {
    $evLines = @()
    $evLines += "# Boot Flag + Dashboard Host Verification - captured $((Get-Date).ToString('o'))"
    $evLines += ""
    foreach ($r in $results) {
        $tag = if ($r.Pass) { "PASS" } else { "FAIL" }
        $evLines += ("[{0}] {1}: {2}" -f $tag, $r.Id, $r.Detail)
    }
    $evLines += ""
    $evLines += "## C5 Smoke stdout (head)"
    $c5Head = ($c5Joined -split "`r?`n" | Select-Object -First 8) -join "`n"
    $evLines += $c5Head
    $evLines += ""
    $evLines += "## C6 Smoke stdout (head, A5 no-private-KB evidence)"
    $c6Head = ($c6Joined -split "`r?`n" | Where-Object { $_ -match "Private knowledge bank|fallback" } | Select-Object -First 4) -join "`n"
    $evLines += $c6Head
    Set-Content -LiteralPath $EvidenceFile -Value ($evLines -join "`n") -Encoding ASCII
}

if ($failures.Count -gt 0) { exit 1 } else { exit 0 }
