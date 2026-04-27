# Phase 28: Mission Control 2.0 Layout - Pattern Map

**Mapped:** 2026-04-26
**Files analyzed:** 3 (1 new lib + 2 edits)
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `super-gsd/scripts/lib/sgsd-mission-strip.ps1` (NEW) | lib (telemetry render helper) | request-response (read files → return rendered lines) | `super-gsd/scripts/lib/sgsd-substrate-status.ps1` | exact (same dashboard-helper shape) |
| `super-gsd/scripts/sgsd-mission-control.ps1` (EDIT, ~15 lines) | dashboard host (soft-load + render call) | request-response | self (lines 74-100, lib soft-load); self (lines 1027-1050, render call) | self-reference |
| `super-gsd/hooks/sgsd-activity-logger.js` (EDIT) | hook (PreToolUse logger) | event-driven (stdin payload → JSONL append) | self (existing function `findProjectRoot`); 27-PLAN reference impl | exact |

---

## Pattern Assignments

### `super-gsd/scripts/lib/sgsd-mission-strip.ps1` (NEW)

**Primary analog:** `super-gsd/scripts/lib/sgsd-substrate-status.ps1` (208 lines, 3 functions). It has the exact shape Phase 28 needs: a `Get-*` data fetcher returning a hashtable, a `Format-*Line` one-liner, and a `Format-*Panel` multi-line renderer.

**Secondary analog:** `super-gsd/scripts/lib/sgsd-codex-status.ps1` (line 51, `[ordered]@{}` return shape with state + stateColor pre-resolved).

**Header pattern** (substrate lines 1-15):
```powershell
# ============================================================================
# Super GSD · DLB-04 Substrate Status Helper
# ============================================================================
# Shared by sgsd-mission-control (SGSD1), sgsd-narrative (SGSD2), ...
# Files read:
#   .planning/...
# ============================================================================
```

**Function-naming + signature pattern** (substrate line 17):
```powershell
function Get-SubstrateStatus {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectDir
    )
    $result = @{ ... }   # hashtable accumulator
    # ... read files, populate $result ...
    return $result
}
```
Phase 28 mirror: `Get-MissionStrip -ProjectDir $ProjectDir` returning `@{}` (or `[ordered]@{}` per codex-status convention when state+stateColor are paired).

**Format-Line helper pattern** (substrate lines 111-145):
```powershell
function Format-SubstrateStatusLine {
    param([Parameter(Mandatory = $true)] [hashtable]$Status)
    $parts = @()
    if ($Status.X) { $parts += "[label N]" } else { $parts += "[label --]" }
    return ($parts -join " ")
}
```

**StateColor pre-resolution pattern** (codex-status lines 249-256) — bake the foreground color name into the returned object so the caller does not switch on state:
```powershell
$out.stateColor = switch -Regex ($out.state) {
    '^running$' { "Yellow" }
    '^(ok|success)$' { "Green" }
    '^(timeout|error)$' { "Red" }
    default { "DarkGray" }
}
```

**Failure handling** (substrate lines 41-44, 51-60): every file read is `try/catch` with empty-result default; never throw out of a render helper.

---

### `super-gsd/scripts/sgsd-mission-control.ps1` (EDIT)

**Soft-load pattern to copy verbatim** (lines 84-91, the `__substrate` block):
```powershell
$__substrate = Join-Path $PSScriptRoot "lib\sgsd-substrate-status.ps1"
if (-not (Test-Path $__substrate)) {
    __sgsd_fail "MISSING LIB: sgsd-substrate-status.ps1" @(
        "Expected: $__substrate",
        "Reinstall: run sgsd-boot -Bootstrap or copy lib\ from super-gsd/scripts/"
    )
}
. $__substrate
```
Phase 28: drop a fourth identical block for `sgsd-mission-strip.ps1` between lines 100 and 102 (after `__codex`, before ANSI escapes).

**Render-call pattern** (lines 1037-1050, the substrate render block):
```powershell
$substrate = Get-SubstrateStatus -ProjectDir $ProjectDir
$substrateLine = Format-SubstrateStatusLine -Status $substrate
$substrateColor = if ($substrate.Gate3Verdict -eq "RETIRE") { "Red" } else { "DarkGray" }
Write-Host "DLB-04 " -NoNewline -ForegroundColor Magenta
Write-Host $substrateLine -NoNewline -ForegroundColor $substrateColor
Write-Host $CLEAR_LINE
```
Phase 28's mission-strip render call goes inside `Render` (around line 1027, after the header bar), follows this exact triplet shape.

---

### `super-gsd/hooks/sgsd-activity-logger.js` (EDIT)

**Analog:** existing helper `findProjectRoot` (lines 32-41) shows the project's Node style — concise, `try/catch` silent fail, no deps beyond `fs`/`path`/`os`.

**Replacement target** (lines 144-149, the broken stamper block):
```js
let phase = '';
try {
  const stateContent = fs.readFileSync(path.join(root, '.planning', 'STATE.md'), 'utf8');
  const match = stateContent.match(/(?:current_phase|phase):\s*(\S+)/);
  if (match) phase = match[1];
} catch {}
```
Replace with reference impl from `27-01-cockpit-data-contract-PLAN.md` lines 218-237 (`function readActivePhase(root)`). Insert function above `run()` (before line 82). Replace lines 144-149 with one call: `const phase = readActivePhase(root);`.

**JSONL append idiom to preserve** (line 167):
```js
fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
```
No locking, no atomic-rename — `appendFileSync` is the project's accepted single-writer-single-line pattern. Do not change this.

**Silent-fail wrapper** (lines 83, 179-181): the entire `run()` body is wrapped in `try { ... } catch (e) {}`. Hooks must NEVER block tool execution. Phase 28's stamper fix MUST keep the `try {} catch {}` around `readActivePhase` per spec rule 6 (lines 224-231).

---

## Shared Patterns

### PowerShell rendering conventions (from mission-control lines 102-155)

**ANSI escape constants** (all dashboards declare these at top of file, NOT in libs):
```powershell
$ESC = [char]27
$HOME_POS    = "$ESC[H"
$CLEAR_LINE  = "$ESC[K"
```
Mission-strip lib should NOT redefine these — it returns plain strings; the host script wraps them with `Write-Host ... $CLEAR_LINE` per row.

**Write-Host override** (lines 116-155): mission-control overrides `Write-Host` to emit ANSI escapes via `[Console]::Out.Write` because Warp's PTY strips Windows Console color API output. The 16-color vocabulary the override accepts: `Black, DarkBlue, DarkGreen, DarkCyan, DarkRed, DarkMagenta, DarkYellow, Gray, DarkGray, Blue, Green, Cyan, Red, Magenta, Yellow, White`. Mission-strip should pick from this exact set when populating `stateColor` fields.

**Per-row render shape** (lines 983-989, `Write-Row`): every dashboard row does `Write-Host text -NoNewline -ForegroundColor X` followed by `Write-Host $CLEAR_LINE` to wipe leftovers from the previous frame.

### Render throttle + cache reuse

Mission-control already dot-sources `sgsd-render-cache.ps1` (line 74) which exposes `Test-RenderDue`, `Get-SharedActivityEntries`, `Invoke-CachedGit`. The mission-strip lib should call `Get-SharedActivityEntries -Path ... -Tail 400` if it needs activity-log data — never re-parse activity-log.jsonl independently (Phase 28 anti-pattern: each parser doing its own `ConvertFrom-Json` over the same 400 lines costs ~30 ms × N parsers per render).

### JSON/JSONL append idioms

| Pattern | Where | Use For |
|---------|-------|---------|
| `fs.appendFileSync(path, line + '\n')` | activity-logger line 167 | Single-line-per-event hook writers |
| `Get-Content $path -Tail $N` + `ConvertFrom-Json` per line | render-cache lines 111-114 | Reading JSONL with try-per-line tolerance |
| `try { JSON.parse(...) } catch {}` per row | activity-logger line 98 | Tolerate malformed lines without crashing |
| 10MB rotation, keep last 5000 lines | activity-logger lines 170-178 | Long-running JSONL files |

No file locking. No tmp+rename. Project convention: single-writer hooks, tolerant readers.

---

## Anti-Patterns to Avoid

| Anti-pattern | Where it lives | Why it's a bug |
|--------------|----------------|----------------|
| Loose unanchored regex on YAML keys | activity-logger line 146: `/(?:current_phase\|phase):\s*(\S+)/` | Matches `by_phase:` substring, captures `"26":` from inner YAML map. **5,727 corrupt rows** on disk. Phase 28 MUST anchor with `^\s*...\s*$` per 27-PLAN rule 1.2. |
| Phase value written without `^[0-9]+$` validation | activity-logger line 148 (`if (match) phase = match[1]`) | Any non-digit captured token gets written verbatim. Phase 28 MUST add the validation guard per 27-PLAN rule 2 (line 186). |
| Path-derived phase recovery | (proposed in 27-RESEARCH, rejected) | Reintroduces loose parsing surface. Phase 28 spec rule 1.3 (line 173) is explicit: `null` is the only acceptable third fallback. |
| Re-parsing activity-log.jsonl in a new lib | (would-be Phase 28 mistake) | Render-cache `Get-SharedActivityEntries` exists for exactly this. Bypassing it costs ~30 ms × N parsers per render. |
| Defining `$ESC` / ANSI constants inside a lib | (would-be Phase 28 mistake) | Each dot-sourced lib polluting the host scope causes redefinition warnings + makes lib non-reusable in non-dashboard contexts. ANSI constants live in the host script only. |
| Throwing from a render helper | (would-be Phase 28 mistake) | substrate-status / codex-status both swallow every exception with `try { ... } catch {}` and return safe defaults. The Render loop runs on FSWatcher trips — one throw kills the whole dashboard. |

---

## Metadata

**Files sampled:**
- `super-gsd/scripts/lib/sgsd-render-cache.ps1` (full, 172 lines)
- `super-gsd/scripts/lib/sgsd-substrate-status.ps1` (full, 208 lines)
- `super-gsd/scripts/lib/sgsd-codex-status.ps1` (lines 1-80, 200-260 — large file, targeted)
- `super-gsd/scripts/sgsd-mission-control.ps1` (lines 1-80, 85-205, 980-1060 — large file, targeted)
- `super-gsd/hooks/sgsd-activity-logger.js` (full, 183 lines)
- `.planning/milestones/v1.6/phases/27-cockpit-data-tree/27-01-cockpit-data-contract-PLAN.md` (lines 135-249, the §Stamping Spec)

**Pattern extraction date:** 2026-04-26
