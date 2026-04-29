# SGSD Warp Operator Notebook

Runnable command blocks for daily SGSD operations from Warp. Copy any
block into a Warp tab and run; or import the whole notebook into Warp
Drive (instructions at the bottom).

> All blocks assume project root `C:\Users\jack.berrow\GSDedits`. Edit
> the `cd` commands if your install differs.

## Daily Start

```powershell
cd C:\Users\jack.berrow\GSDedits
sg
```

This boots cockpit windows separately and starts Claude in the current
Warp tab. See `super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md` for full
daily routine.

## Autonomous Mode

```powershell
cd C:\Users\jack.berrow\GSDedits
sg -Go
```

Sends `go` to Claude after boot. Auto-mode runs until 3 valid exits:
all-phases-complete / hard-blocker / user-says-stop.

## Status Check

```powershell
cd C:\Users\jack.berrow\GSDedits
Get-Content .planning\STATE.md -TotalCount 30 -Encoding UTF8
```

Or via MCP (once configured per `super-gsd/docs/SGSD-WARP-MCP-SETUP.md`):

```powershell
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"sgsd_current_state","arguments":{}},"id":1}' | node super-gsd/tools/warp-mcp/server.cjs
```

## Token Summary

```powershell
cd C:\Users\jack.berrow\GSDedits
node super-gsd/tools/token-attribution/collect.cjs --write --all --agent-spend --summary --current
```

## Gate Status

```powershell
cd C:\Users\jack.berrow\GSDedits
Write-Host "=== latest gate value log (tail 20) ==="
if (Test-Path .planning\metrics\gate-value-log.jsonl) {
  Get-Content .planning\metrics\gate-value-log.jsonl -Encoding UTF8 -Tail 20
} else {
  Write-Host "(gate-value-log.jsonl missing -- Phase 36 not yet shipped or no gates fired)"
}
```

## Recovery Packet

```powershell
cd C:\Users\jack.berrow\GSDedits
if (Test-Path .planning\ORCHESTRATOR-CHECKPOINT.md) {
  Get-Content .planning\ORCHESTRATOR-CHECKPOINT.md -Encoding UTF8
} else {
  Write-Host "No checkpoint open. Read STATE.md frontmatter for current position:"
  Get-Content .planning\STATE.md -TotalCount 30 -Encoding UTF8
}
```

## Remote Monitor Packet

```powershell
cd C:\Users\jack.berrow\GSDedits
Write-Host "=== SGSD REMOTE MONITOR PACKET ==="
Write-Host "(Capture this block before sharing the Warp session.)"
Write-Host ""
Write-Host "[1/4] Current position:"
Get-Content .planning\STATE.md -TotalCount 9 -Encoding UTF8
Write-Host ""
Write-Host "[2/4] Watchdog state:"
if (Test-Path .planning\metrics\autopilot-watchdog.json) {
  Get-Content .planning\metrics\autopilot-watchdog.json -Encoding UTF8
} else {
  Write-Host "(watchdog absent -- autopilot not active)"
}
Write-Host ""
Write-Host "[3/4] Resume command on return:"
Write-Host "  /sgsd-orchestrate go     (auto resume from checkpoint or current STATE)"
```

## Setup Health Check

```powershell
cd C:\Users\jack.berrow\GSDedits
node super-gsd/tools/warp-doctor/check.cjs --project "C:/Users/jack.berrow/GSDedits"
```

## MCP Self-Test

```powershell
cd C:\Users\jack.berrow\GSDedits
node super-gsd/tools/warp-mcp/run-self-test.cjs
```

## Cockpit Snapshot Render (Warp PowerShell)

```powershell
cd C:\Users\jack.berrow\GSDedits
& super-gsd/scripts/lib/render-cockpit-snapshot.ps1 -ProjectDir 'C:/Users/jack.berrow/GSDedits'
```

Or just one section:

```powershell
& super-gsd/scripts/lib/render-cockpit-snapshot.ps1 -ProjectDir 'C:/Users/jack.berrow/GSDedits' -Section blockers
```

---

## Import to Warp Drive

To make these blocks searchable in Warp Command Search:

1. Open Warp.
2. `Cmd+P` (or `Ctrl+P`) → "Notebook: New".
3. Paste each block above into a separate notebook cell.
4. Save as "SGSD Operator Notebook".

Once imported, you can search for "SGSD Recovery" / "SGSD Status" / etc.
in Command Search and Warp will surface the matching cell.

## Export from Warp Drive

If you've customized your notebook in Warp Drive and want to back it up:

1. In Warp Drive, select the notebook.
2. Export → Markdown.
3. Save to repo as `super-gsd/docs/SGSD-WARP-NOTEBOOK.user.md` (gitignored
   if it contains private paths).

## Related

- `super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md` — full operator guide.
- `super-gsd/docs/SGSD-WARP-WORKFLOWS.md` — 13 Warp workflows (alternative to notebook cells).
- `super-gsd/docs/SGSD-WARP-MCP-SETUP.md` — MCP setup so the `tools/call` blocks above work.
- `super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md` — 14 MCP tool contracts.
- `AGENTS.md` — tool-neutral hard rules.
