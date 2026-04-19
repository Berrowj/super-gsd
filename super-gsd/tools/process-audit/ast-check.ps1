param([Parameter(Mandatory)][string]$Path)
$tokens = $null
$errs = $null
[void][System.Management.Automation.Language.Parser]::ParseFile(
    (Resolve-Path $Path).Path, [ref]$tokens, [ref]$errs
)
if ($errs -and $errs.Count -gt 0) {
    foreach ($e in $errs) { Write-Host ("ERR: " + $e.ToString()) -ForegroundColor Red }
    exit 1
}
Write-Host "OK: $Path"
