# Phase 28: Mission Control 2.0 Layout - Research

**Researched:** 2026-04-26
**Domain:** PowerShell 5.1 dashboard rendering + Node.js PreToolUse hook stamper
**Confidence:** HIGH (every claim cites either Phase 26/27 PLAN or an existing on-disk file)

## Summary

Phase 28 ships the Mission Strip (the 6-line operator-question panel that
replaces the existing 1-line header in `sgsd-mission-control.ps1`) and fixes
the `sgsd-activity-logger.js` phase stamper that has been writing corrupt
`"phase":"\"NN\":"` rows for the last ~5,727 of 8,255 activity-log entries.
Three code touchpoints, all with named analogs already in-tree:

1. **NEW** `super-gsd/scripts/lib/sgsd-mission-strip.ps1` — clones the shape of
   `sgsd-substrate-status.ps1` (a `Get-*` data fetcher returning a hashtable +
   a `Format-*` line-renderer pair).
2. **EDIT** `super-gsd/scripts/sgsd-mission-control.ps1` — drops a 4th
   soft-load block (line 100 area) and a render-call triplet (Render fn,
   ~line 1027) that prints the 6-line strip directly under the header bar.
3. **EDIT** `super-gsd/hooks/sgsd-activity-logger.js` — replaces the unanchored
   regex stamper (lines 144–149) with the env-var-primary +
   anchored-frontmatter-fallback + `^[0-9]+$`-validation reference impl from
   `27-01-cockpit-data-contract-PLAN.md` lines 218–237.

**Primary recommendation:** Implement the three changes as **three separate
commits** in dependency order — stamper fix first (Q5 freshness depends on
clean data), then mission-strip lib, then mission-control wiring. Each commit
will trip per-dispatch ATC (`atc_tier=full`); plan accordingly.

## User Constraints (from DISCUSS 28.1, 28.2)

### Locked Decisions

- **28.1 Strip position** — top of mission-control pane, replacing the
  existing 1-line header
- **28.2 Strip line count** — **6 lines**: `mission, objective+unlock, model,
  blocker, codex+agents, next`

### Claude's Discretion

- Internal hashtable shape of `Get-MissionStripState` (constrained only by
  the 6 locked render lines)
- Per-line color choices (must pick from the `Write-Host` override's 16-color
  vocabulary — see Pitfall §5)
- How `Get-MissionStripState` filters activity-log rows for the agents lane
  (must use `Get-SharedActivityEntries` from render-cache; must
  current-phase-scope per DISCUSS 29.2)

### Deferred Ideas (OUT OF SCOPE)

- `cockpit-state.json` — forbidden (DISCUSS 27.1)
- New metric streams — forbidden (DISCUSS 27.1)
- Path-based phase derivation in stamper — forbidden (DISCUSS 27.2)
- Backfill of pre-fix corrupt rows — forbidden (Phase 27 §Backwards-
  Compatibility Note)
- Re-defining vocabulary / freshness / repair predicate (Phase 26 owns)

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Q1–Q8 1-line surfaces | Mission Strip lib (NEW) | mission-control host (calls render) | Strip surfaces; existing detail panes stay authoritative |
| Phase-stamping into activity-log | Node hook (`sgsd-activity-logger.js`) | orchestrator env (`SGSD_ACTIVE_PHASE`) | Hook is the only writer; orchestrator owns the env var |
| Render throttle + activity-log read | mission-control host (existing) | render-cache lib | Mission-strip MUST NOT re-parse activity-log; reuse `Get-SharedActivityEntries` |
| ANSI color escape table | mission-control host (existing) | — | Lib MUST NOT redefine `$ESC`/colors (Pattern Map anti-pattern) |
| Q4 backlog row count | crit-backlog.cjs lib (existing) | mission-strip (consumer) | Lib already exposes `unresolvedRows` — call, don't reparse |

## Standard Stack

### Core (already on disk; nothing new to install)

| Library / file | Version | Purpose | Why standard |
|----------------|---------|---------|--------------|
| `super-gsd/scripts/lib/sgsd-render-cache.ps1` | repo HEAD | Activity-log + git cache, redraw throttle | Single-pass parser; bypass costs ~30 ms × N |
| `super-gsd/scripts/lib/sgsd-substrate-status.ps1` | repo HEAD | Closest analog for new lib shape | `Get-*` + `Format-*Line` + `Format-*Panel` triple |
| `super-gsd/scripts/lib/sgsd-codex-status.ps1` | repo HEAD | StateColor pre-resolution pattern | `[ordered]@{}` with state+stateColor pre-baked |
| `super-gsd/scripts/lib/crit-backlog.cjs` | repo HEAD | Q4 backlog row count | `unresolvedRows` / `rowsForPhase` API |
| Node `fs` / `path` / `os` (built-in) | Node ≥18 | Stamper hook | Existing project pattern; no deps |

### Supporting

| File | Used by | When |
|------|---------|------|
| `.planning/STATE.md` (frontmatter) | Stamper fallback, Q2 source | Always read; no freshness band |
| `.planning/ROADMAP-AGENT.md` | Q2/Q3 source | Always read; operator-curated |
| `.planning/metrics/activity-log.jsonl` | Q1, Q5 sources | tail-bounded read (N=500) |
| `.planning/metrics/codex-live.json` | Q6 source | mtime + state field |
| `.planning/metrics/crit-backlog.jsonl` | Q4 source | via crit-backlog.cjs API |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `sgsd-substrate-status.ps1` shape | `sgsd-codex-status.ps1` shape | codex-status returns `[ordered]@{}` w/ stateColor; substrate uses plain `@{}`. Codex pattern is **better** for mission-strip (we need stateColor per line) |
| `Get-SharedActivityEntries` | New `Get-Content -Tail` per render | Bypass = 30 ms × renders/sec; rejected (Pattern Map anti-pattern) |

**Installation:** none. Phase 28 adds one new file; everything else is on disk.

## Architecture Patterns

### System Architecture Diagram (data flow)

```
[FSWatcher trip / heartbeat tick]
        |
        v
[sgsd-mission-control.ps1 :: Render()]   <-- existing host, render throttle 2s
        |
        +-- Write-Host header bar (existing, preserved)
        |
        +-- Get-MissionStripState -ProjectDir $ProjectDir   <-- NEW LIB CALL
        |       |
        |       +-- read STATE.md frontmatter (Q2 milestone+phase)
        |       +-- read ROADMAP-AGENT.md (Q2 goal, Q3 unlock)
        |       +-- read codex-live.json (Q6 state + mtime)
        |       +-- Get-SharedActivityEntries -Tail 500 (Q1 model, Q5 agents)
        |       +-- read crit-backlog via crit-backlog.cjs (Q4 count)
        |       +-- read CLAUDE.md dispatch table + heartbeat (Q8)
        |       |
        |       v
        |   [hashtable: 6 line-strings + 6 stateColor strings]
        |
        +-- Render-MissionStrip -State $strip   <-- NEW LIB CALL
        |       |
        |       +-- emits 6 Write-Row calls (mission, obj+unlock, model,
        |           blocker, codex+agents, next), each with $CLEAR_LINE
        |
        +-- DLB-04 substrate row (existing)
        +-- Heartbeat row (existing)
        +-- ... rest of dashboard (existing, untouched)


[Tool call from Claude Code]
        |
        v
[PreToolUse hook: sgsd-activity-logger.js]
        |
        +-- findProjectRoot()
        +-- readActivePhase(root)   <-- NEW FN (replaces lines 144-149)
        |       |
        |       +-- (1) process.env.SGSD_ACTIVE_PHASE  if /^[0-9]+$/
        |       +-- (2) STATE.md frontmatter (anchored regex)
        |       +-- (3) null  (controlling-principle answer)
        |
        +-- validation guard: !/^[0-9]+$/.test(p) -> p = null
        +-- fs.appendFileSync(activity-log.jsonl, ...)
```

The Mission Strip is **read-only** over the existing telemetry surface. It
writes nothing. The stamper is the only writer touched in Phase 28.

### Recommended Project Structure

```
super-gsd/
  scripts/
    sgsd-mission-control.ps1          # EDIT (3 small inserts)
    lib/
      sgsd-mission-strip.ps1          # NEW (~150-220 lines)
      sgsd-substrate-status.ps1       # READ-ONLY ANALOG
      sgsd-codex-status.ps1           # READ-ONLY ANALOG
      sgsd-render-cache.ps1           # READ-ONLY DEPENDENCY (Get-SharedActivityEntries)
      crit-backlog.cjs                # READ-ONLY DEPENDENCY (unresolvedRows)
  hooks/
    sgsd-activity-logger.js           # EDIT (replace lines 144-149 + insert readActivePhase)
```

### Pattern 1: Mission Strip lib design (function signatures)

**Source:** `sgsd-substrate-status.ps1` (full 208 lines), modified to include
`stateColor` per line per `sgsd-codex-status.ps1` lines 249–256.

```powershell
# super-gsd/scripts/lib/sgsd-mission-strip.ps1 (proposed shape)

# ============================================================================
# Super GSD - Mission Strip (Cockpit 2.0)
# ============================================================================
# Renders the 6-line operator-question strip at the top of the
# sgsd-mission-control dashboard. Replaces the previous 1-line header.
# All file reads are tolerant: every parse is wrapped in try/catch with a safe
# default; this lib MUST NEVER throw out of a Render frame.
#
# Files read (cited from 27-01-cockpit-data-contract-PLAN.md Data Source Matrix):
#   .planning/STATE.md                                  (Q2 milestone+phase, always-read)
#   .planning/ROADMAP-AGENT.md                          (Q2 Goal, Q3 unlock)
#   .planning/metrics/activity-log.jsonl                (Q1 model, Q5 agents)
#     - via Get-SharedActivityEntries (do NOT re-parse)
#   .planning/metrics/codex-live.json                   (Q6 state + mtime)
#   .planning/metrics/crit-backlog.jsonl                (Q4 count, via crit-backlog.cjs)
#   .planning/metrics/heartbeat.jsonl                   (Q8 stall detection)
#   CLAUDE.md                                           (Q8 dispatch-rules table)
# ============================================================================

function Get-MissionStripState {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectDir,
        [int]$ActivityTail = 500
    )
    # Returns [ordered] hashtable with 6 line-strings + 6 stateColor strings.
    # Line keys: mission, objective, model, blocker, codex_agents, next
    # Color keys: missionColor, objectiveColor, modelColor, blockerColor,
    #             codexAgentsColor, nextColor
    # Plus debug fields the host can drop (e.g. activePhase, activeMilestone).

    $out = [ordered]@{
        mission           = "[mission unavailable]"
        missionColor      = "DarkGray"
        objective         = "[objective unavailable]"
        objectiveColor    = "DarkGray"
        model             = "[model unavailable]"
        modelColor        = "DarkGray"
        blocker           = "[blocker --]"
        blockerColor      = "DarkGray"
        codexAgents       = "[codex --] [agents --]"
        codexAgentsColor  = "DarkGray"
        next              = "[next unavailable]"
        nextColor         = "DarkGray"
        activeMilestone   = $null
        activePhase       = $null
    }

    # Q2 - read STATE.md (always-read; no freshness band)
    try { ... populate $out.mission, $out.activeMilestone, $out.activePhase ... } catch {}

    # Q3 - read ROADMAP-AGENT.md next-phase Goal OR literal "milestone close X"
    try { ... populate $out.objective ... } catch {}

    # Q1 - Get-SharedActivityEntries -Tail $ActivityTail (do NOT re-parse jsonl)
    try { ... populate $out.model + $out.modelColor via freshness band ... } catch {}

    # Q4 - crit-backlog count for active milestone/phase via crit-backlog.cjs
    try { ... populate $out.blocker + $out.blockerColor ... } catch {}

    # Q5+Q6 - codex-live.json (Q6) + agents lane filtered to activePhase (Q5)
    try { ... populate $out.codexAgents + $out.codexAgentsColor ... } catch {}

    # Q8 - dispatch-rule first-match against CLAUDE.md + heartbeat freshness
    try { ... populate $out.next + $out.nextColor ... } catch {}

    return $out
}

# Renders the 6 lines using Write-Host. Caller is responsible for cursor pos
# and CLEAR_LINE wipes via the host's Write-Row helper.
function Render-MissionStrip {
    param(
        [Parameter(Mandatory = $true)]
        $State    # the [ordered] hashtable from Get-MissionStripState
    )
    Write-Host $State.mission           -NoNewline -ForegroundColor $State.missionColor;     Write-Host $CLEAR_LINE
    Write-Host $State.objective         -NoNewline -ForegroundColor $State.objectiveColor;   Write-Host $CLEAR_LINE
    Write-Host $State.model             -NoNewline -ForegroundColor $State.modelColor;       Write-Host $CLEAR_LINE
    Write-Host $State.blocker           -NoNewline -ForegroundColor $State.blockerColor;     Write-Host $CLEAR_LINE
    Write-Host $State.codexAgents       -NoNewline -ForegroundColor $State.codexAgentsColor; Write-Host $CLEAR_LINE
    Write-Host $State.next              -NoNewline -ForegroundColor $State.nextColor;        Write-Host $CLEAR_LINE
}
```

**Why hashtable + stateColor pre-resolved:** matches `sgsd-codex-status.ps1`
lines 249–256. Caller does not switch on state — color is baked in by the
data fetcher. This collapses the render call to a single foreach.

### Pattern 2: 6-line strip layout (locked)

DISCUSS 28.2 = **6 lines**. Mapped onto the Phase 26 Q-contract:

| Line # | Content | Q source(s) | Example render | Color rule |
|-------:|---------|-------------|----------------|------------|
| 1 | **mission** = `M:{milestone_id} | {milestone_status} | {ts}` | Q2 (STATE.md) | DarkCyan when active; Yellow when SHIPPED-WITH-DEBT |
| 2 | **objective + unlock** = `P:{phase} {Goal} -> unlocks: {next-Goal or "milestone close X"}` | Q2 + Q3 | White on active; DarkGray on stale; Magenta if last phase in milestone |
| 3 | **model** = `model: {tool} {target-truncated} ({state} {Δs})` | Q1 (activity-log + claude session jsonl) | Green active / Yellow waiting / Red stale / DarkGray unavailable |
| 4 | **blocker** = `blockers: {N open} crit-backlog | {first-summary or '--'}` | Q4 (crit-backlog.cjs) | Red if N>0; Green if N==0; DarkGray if unavailable |
| 5 | **codex + agents** = `codex: {state} ({Δs}) | agents: {N this phase}` | Q5 + Q6 | Yellow running / Cyan reviewing / Red timeout / Green ready / DarkGray stale-or-unavailable |
| 6 | **next** = `next: {dispatch-rule N match} | repair: {repair_instruction or '--'}` | Q8 + open repair from Q4/Q6/Q7 | Green active / Yellow waiting / Red blocked / DarkGray unavailable |

**Reconciliation note.** `COCKPIT-2.0-SCOPE.md` originally floated a 5-line
strip and Phase 26 §Architectural Responsibility Map names 4 strip lanes
(Q2, Q4, Q6, Q8). DISCUSS 28.2 supersedes both with 6 lines. Phase 28's
6-line layout adds a dedicated `mission` line (line 1) for milestone+ts and
splits Q5 + Q6 onto a single combined line (line 5). Q7 evidence remains
in the **body pane**, not the strip (per Phase 26 ARM table).

### Pattern 3: mission-control.ps1 injection points

Two inserts into the existing host. Both verbatim-copied from the substrate
soft-load + render-call patterns already proven in this file.

**Insert 1 - soft-load block** between current line 100 (after `. $__codex`)
and the existing `# -- ANSI escape codes --` comment at line 102:

```powershell
$__missionstrip = Join-Path $PSScriptRoot "lib\sgsd-mission-strip.ps1"
if (-not (Test-Path $__missionstrip)) {
    __sgsd_fail "MISSING LIB: sgsd-mission-strip.ps1" @(
        "Expected: $__missionstrip",
        "Reinstall: run sgsd-boot -Bootstrap or copy lib\ from super-gsd/scripts/"
    )
}
. $__missionstrip
```

This mirrors **verbatim** the `__substrate` block on lines 84–91 and the
`__codex` block on lines 93–100. Pattern Map §soft-load identifies this as
the project's idiom; no deviation.

**Insert 2 - render call** inside `Render` function. Current line 1027 is
the comment `# -- Header bar --`. The header bar prints lines 1028–1033
(`SUPER GSD * Mission Control HH:MM:SS`). Insert the strip render
**immediately after** the header bar (between current line 1033's
`Write-Host $CLEAR_LINE` and line 1035's `# -- DLB-04 Substrate --`):

```powershell
# -- Mission Strip (Cockpit 2.0 - Phase 28) ----------------------------------
$strip = Get-MissionStripState -ProjectDir $ProjectDir -ActivityTail 500
Render-MissionStrip -State $strip
```

DISCUSS 28.1 says "replacing existing 1-line header". The existing 1-line
header at line 1029–1033 stays — it's the dashboard title bar, not a
question lane. The Strip lives **between** that title bar and the
DLB-04 substrate row. Pattern Map §render-call (lines 1037–1050) confirms
the same insertion zone.

### Pattern 4: Stamper fix — paste-ready impl

**Source:** `27-01-cockpit-data-contract-PLAN.md` lines 218–237 (verbatim).
Adapted to existing `sgsd-activity-logger.js` shape:

**Insert above `function run()`** (current line 82):

```js
function readActivePhase(root) {
  // (1) Primary: env var set by orchestrator
  const env = process.env.SGSD_ACTIVE_PHASE;
  if (env && /^[0-9]+$/.test(env)) return env;
  // (2) Fallback: anchored YAML frontmatter parse
  try {
    const content = fs.readFileSync(path.join(root, '.planning', 'STATE.md'), 'utf8');
    const fm = content.split(/^---$/m)[1] || '';
    for (const line of fm.split('\n')) {
      const m = line.match(/^\s*(?:current_phase|phase):\s*"?([0-9]+)"?\s*$/);
      if (m) return m[1];
    }
  } catch {}
  // (3) Final fallback - controlling-principle answer
  return null;
}
```

**Replace** the broken block (current lines 144–149) with a **single line**:

```js
  // Try to detect current phase (env var primary, anchored frontmatter fallback)
  let phase = readActivePhase(root);
  if (phase !== null && !/^[0-9]+$/.test(phase)) phase = null;  // 27-PLAN rule 2 validation guard
```

The existing line 156 `phase: phase || null,` becomes `phase: phase` since
`readActivePhase` already returns `null` when nothing resolves. Pattern Map
§silent-fail wrapper confirms preserving the outer `try {} catch {}` around
`run()`. **Do not** change `fs.appendFileSync` — Pattern Map §JSONL append
locks this as project convention (no atomic-rename, single-writer-single-line).

### Anti-Patterns to Avoid

(These are explicit prohibitions — Phase 28 verifier WILL grep for these.)

- **Loose unanchored regex on YAML keys** (the original bug). Phase 28 MUST
  anchor the fallback regex with `^\s*` and `\s*$`. Pattern Map §1.
- **Phase value written without `^[0-9]+$` validation guard** (the original
  bug). Phase 28 MUST add the guard immediately after `readActivePhase`
  returns. Pattern Map §2.
- **Path-derived phase recovery** (would re-introduce loose parsing).
  DISCUSS 27.2 forbids; Phase 27 §Stamping Spec rule 1.3 locks `null` as
  the only acceptable third fallback. Pattern Map §3.
- **Re-parsing activity-log.jsonl in mission-strip lib**. MUST call
  `Get-SharedActivityEntries -Tail 500` from render-cache. Pattern Map §4.
- **Defining `$ESC` / ANSI constants inside the lib**. Lib returns plain
  strings + color names; host owns ANSI. Pattern Map §5.
- **Throwing from a render helper**. Every file read in mission-strip MUST
  be `try {} catch {}` with safe default. One throw = dead dashboard.
  Pattern Map §6.
- **Re-defining vocabulary / freshness / repair**. Phase 26 owns those;
  cite, do not redefine.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Activity-log parsing in new lib | Per-render `Get-Content + ConvertFrom-Json` | `Get-SharedActivityEntries -Path ... -Tail 500` (render-cache) | 30 ms × N parsers per render; cache exists for this exact case |
| Crit-backlog row counting | Re-parse jsonl in PowerShell | `crit-backlog.cjs unresolvedRows` / `rowsForMilestone` / `rowsForPhase` | Lib has `--self-test` PASS; reuse it |
| ANSI color escape table | Define `$ESC[*]m` strings inside lib | Use the host's `Write-Host` override (16-color vocabulary) | Lib must work as plain string returns; ANSI is host concern |
| Freshness-band classifier | Reinvent `<30s active / 30-599 waiting / >=600 stale` per lane | Reuse same Δ-mtime → state mapping helper across lanes | Phase 26 §Freshness owns the bands; mission-strip just consumes |
| Phase regex parser in stamper | New parsing approach | Reference impl from 27-01-PLAN lines 218–237 | Already designed, reviewed, locked |
| JSONL atomic write | tmp+rename, file locks | `fs.appendFileSync(path, line + '\n')` | Project convention; activity-logger line 167 |

**Key insight:** Phase 28 has zero "build it from scratch" surface. Every
piece lives in another file already, with the only original work being
gluing them together according to the Q-contract.

## Common Pitfalls

### Pitfall 1: PowerShell 5.1 mojibake on Unicode glyphs

**What goes wrong:** PS 5.1 reads `.ps1` files as Windows-1252 by default.
A previous v1.6 attempt at `sgsd-mission-strip.ps1` (since reverted)
contained `▌`, `▸`, `─`, em-dash, and curly quotes, which rendered as `▌`
(or worse, threw `UnexpectedToken` errors on lib load) in PS 5.1 Warp PTY.

**Why it happens:** The file was saved as UTF-8 *without* a BOM. PS 5.1
falls back to Windows-1252 in that case. PS 7 reads UTF-8 by default; the
bug is invisible in PS 7 and reproducible only on the production target.

**How to avoid:** **ASCII-only string literals.** Replace box-drawing /
em-dash with `-`, `*`, `|`, `+`, `--`, `>`, `<`. The existing
`Format-SubstratePanel` (lines 149–207 in `sgsd-substrate-status.ps1`)
already declares this as policy: *"Uses ASCII-only characters for encoding
portability."* Phase 28 lib MUST follow.

**Warning signs:** lib file loads cleanly in PS 7 but emits
`UnexpectedToken` or `String missing terminator` errors when dot-sourced
from PS 5.1. Tab character (U+0009) in indentation also triggers this.

**Verification:** `file super-gsd/scripts/lib/sgsd-mission-strip.ps1` —
expected output is `ASCII text` not `UTF-8 Unicode text`. If UTF-8 BOM is
required (e.g. for non-ASCII content), `iconv -f UTF-8 -t UTF-8 --add-bom`
before the first lib load.

### Pitfall 2: Render-cache double-parse

**What goes wrong:** Mission-strip calls `Get-Content $activityLog -Tail 500`
in `Get-MissionStripState`. Render-cache *also* parses activity-log every
frame via `Get-SharedActivityEntries`. Two passes over 500 rows
(~30 ms × 2 = 60 ms per frame) inflate the dashboard render budget and
introduce drift between Q1 and Q5 lanes (one read sees newer rows than
the other).

**Why it happens:** Easy to miss the existing helper because mission-strip
is a new lib. The Phase 28 author thinks "I need activity-log data" and
reaches for `Get-Content` reflexively.

**How to avoid:** **Always go through render-cache.** Pattern Map line 145
explicitly calls this out: `Get-SharedActivityEntries -Path ... -Tail 400`
is the canonical entry point. Mission-strip raises this to 500 only if it
empirically needs the bigger window; otherwise reuse 400.

**Warning signs:** Q1 and Q5 disagree by one tool call. Frame time
> 100 ms (render-cache instrumentation logs this).

### Pitfall 3: stale codex-live.json overrides state field

**What goes wrong:** Q6 lane reads `codex-live.json.state` field and
ignores file mtime. Codex worker dies, state field stays `running`, mtime
ages past 1 hour, but lane still shows `running`.

**Why it happens:** DISCUSS 29.1 says `>=3600s stale` *overrides* the
state field. Easy to forget the override path.

**How to avoid:** Compute Δmtime first; if Δ >= 3600s, render `stale`
(DarkGray) regardless of `state` field. Phase 26 §Q6 §Freshness rule
locks this.

**Warning signs:** Codex hung 4 hours ago, dashboard still shows green
`running`.

### Pitfall 4: env var + frontmatter race

**What goes wrong:** Orchestrator sets `SGSD_ACTIVE_PHASE` *after* the
hook child process has already inherited an empty env. Stamper falls
back to STATE.md (correct), but if STATE.md has not yet been updated
for the new phase, the row gets stamped with the *previous* phase.

**Why it happens:** `process.env.X` is a snapshot at process creation.
Hooks are spawned per tool call by Claude Code; orchestrator-side env
mutation does not retroactively reach already-spawned children. In
practice the hook spawns *after* the orchestrator's STATE.md write at
phase entry, so this is rare — but worth noting.

**How to avoid:** Orchestrator MUST update STATE.md *before* setting
`SGSD_ACTIVE_PHASE`. Anchored frontmatter parse then beats stale env.
Phase 28 stamper does this naturally because env var is **first** in the
precedence chain — env wins when set, frontmatter wins when env is empty.

**Warning signs:** First N rows after a phase transition stamped with
previous phase id. Verifier acceptance command (rule 7 of 27-PLAN
Stamping Spec) catches this: ">=50 of last 100 rows correctly stamped".

### Pitfall 5: Color name typo silently strips color

**What goes wrong:** Mission-strip emits `stateColor = "Orange"`. Host's
`Write-Host` override at line 147 looks up `_AnsiColors[$ForegroundColor]`
and **silently no-ops** if the key is absent — no error, just no color.

**Why it happens:** `_AnsiColors` is a fixed 16-key hashtable (Black,
DarkBlue, ..., White). Any color outside that vocabulary is dropped.

**How to avoid:** Pick *only* from the documented 16-color vocabulary in
Pattern Map: `Black, DarkBlue, DarkGreen, DarkCyan, DarkRed, DarkMagenta,
DarkYellow, Gray, DarkGray, Blue, Green, Cyan, Red, Magenta, Yellow,
White`. No `Orange`, `LightBlue`, RGB hex, or 256-color. Lib unit tests
should assert all stateColor values are members of this set.

**Warning signs:** Strip line renders with no color (Gray default) when
expected to be highlighted.

## Per-Dispatch ATC Scope

Phase 28 will produce **3 commits** (one per touchpoint). Each commit
trips per-dispatch ATC because:

- `classifier.atc_tier = full` for every commit (50+ lines on the lib
  commit; new file on the lib commit; 4+ touched files counting plan +
  doc updates)
- `code_files_changed_count > 0` for all three commits
- DISCUSS hard-bar rules (§What runs always): "Per-dispatch ATC
  (Codex + Claude reviewers)" runs unchanged

**Codex side:** known-unavailable per current readiness state (Phase 26
shipped `PASS-WITH-DEFERRED-1` with kind=`provider_unavailable`). The
3-attempt budget will exhaust per dispatch and append three new rows to
`crit-backlog.jsonl` with `kind=per_dispatch_atc, attempts_made=3`.

**Claude reviewer side:** fires normally; does the actual ATC review.
Phase 28 expects all 3 commits to PASS the Claude reviewer (small,
mechanical, fully-spec'd changes with named analogs).

**Consequence for Phase 28 close:** `PASS-WITH-DEFERRED-3` (3 Codex
provider_unavailable rows) is the most-likely status, NOT `PASS`.
The controlling principle (autonomy continues; evidence tells the truth)
permits this; per Phase 26's milestone-status taxonomy this rolls up to
v1.6 milestone close as `SHIPPED-WITH-DEBT-N` not `SHIPPED`.

**Plan implication:** the planner must scope the executor to expect
3 commits, not 1. Each commit on its own atomic boundary.

## Open Questions

1. **Should the strip render before OR after the existing `SUPER GSD *
   Mission Control HH:MM:SS` title bar?**
   - DISCUSS 28.1 says "top of mission-control pane, replacing existing
     1-line header". Two readings: (a) replace the title bar entirely,
     (b) insert below the title bar, replacing whatever 1-line header
     came after it.
   - Reading (b) is more conservative — the title bar is information-rich
     (timestamp, app name, version cue) and removing it loses no
     question-contract information.
   - **Recommendation: reading (b).** Strip lives **between** the
     existing title bar (line 1033's `Write-Host $CLEAR_LINE`) and the
     DLB-04 substrate row (line 1035's comment). The "1-line header"
     DISCUSS 28.1 refers to is the dashboard's pre-Cockpit-2.0 1-line
     mission/phase summary, not the title bar.

2. **Should `Get-MissionStripState` accept an optional `-State` /
   `-Phase` override for tests?**
   - The substrate analog does not. But mission-strip has more inputs,
     and a test harness for the 6-line layout would benefit from
     dependency injection.
   - **Recommendation: yes, accept optional `-StateOverride` /
     `-PhaseOverride` params.** Phase 30 acceptance tests will inject
     fixtures (DISCUSS 30.1: 8 scenarios mandatory; fixture-based
     verification permitted).

3. **Should the agents lane (Q5 portion of line 5) show *all* agents
   ever dispatched in active phase, or only currently-running agents?**
   - Phase 26 §Q5 says "Sub-agents dispatched in current phase + their
     last status/artifact" — implies all-time-current-phase.
   - **Recommendation: all-time-current-phase, deduplicated by `subagent_type`.**
     Surface count + freshest agent's state. e.g. `agents: 4 (researcher
     active 18s)`. Capacity for 1 line.

## Kill / Defer Conditions for Phase 28

| Trigger | Action | Rationale |
|---------|--------|-----------|
| Stamper fix's frontmatter regex matches `total_phases:` or `completed_phases:` despite anchoring | KILL the patch; revert to `null`-only stamping; redesign | Locked-decision violation: 27-PLAN rule 1.2 must reject those keys by construction. If anchoring fails, the spec is wrong. |
| Mission-strip lib increases mission-control frame time > 200 ms (instrumented via render-cache) | DEFER lib to Phase 28b; ship stamper alone | Performance regression on the user's primary surface |
| Render-cache `Get-SharedActivityEntries` doesn't exist or has different signature | KILL the lib; STOP and ask operator | Pattern Map cited it on line 145; if missing, our pattern model is wrong |
| Post-fix tail-100 verifier shows < 50 correctly-stamped rows | DEFER phase close; investigate orchestrator env var emission | 27-PLAN acceptance command rule 7 — hard fail |
| Post-fix tail-100 shows ANY corrupt `"phase":"\"NN\":"` rows | KILL & rollback; the regex anchoring is broken | 27-PLAN rule 7 zero-tolerance |
| Codex live-auth still unavailable AND operator wants strict v1.6 SHIP not SHIPPED-WITH-DEBT | DEFER Phase 28 close until Codex available | Controlling principle permits SHIPPED-WITH-DEBT but operator can override |
| Phase 28 Claude reviewer ATC issues CRIT 3x on the lib commit (e.g. flags ASCII-only as user-facing fail) | DEGRADE: append to crit-backlog.jsonl (`kind=per_dispatch_atc`), continue per controlling principle | Non-structural; standard hard-bar §3-then-defer rule |

**No-go threshold:** if any anchored regex against STATE.md frontmatter
captures a string that fails `^[0-9]+$` (the validation guard at the end
of the chain), the phase is in an unexpected state and the stamper MUST
write `null` rather than the captured value. This is the
controlling-principle answer; it is not a kill condition, it is the
correct behavior.

## Code Examples

### Stamper reference impl (paste-ready)

```js
// super-gsd/hooks/sgsd-activity-logger.js — insert above run() at line 82.
// Source: 27-01-cockpit-data-contract-PLAN.md lines 218-237 (verbatim).
function readActivePhase(root) {
  const env = process.env.SGSD_ACTIVE_PHASE;
  if (env && /^[0-9]+$/.test(env)) return env;
  try {
    const content = fs.readFileSync(path.join(root, '.planning', 'STATE.md'), 'utf8');
    const fm = content.split(/^---$/m)[1] || '';
    for (const line of fm.split('\n')) {
      const m = line.match(/^\s*(?:current_phase|phase):\s*"?([0-9]+)"?\s*$/);
      if (m) return m[1];
    }
  } catch {}
  return null;
}
```

### Mission-control soft-load (paste-ready)

```powershell
# super-gsd/scripts/sgsd-mission-control.ps1 - insert at line 101.
# Source: lines 84-91 (substrate) and 93-100 (codex), verbatim shape.
$__missionstrip = Join-Path $PSScriptRoot "lib\sgsd-mission-strip.ps1"
if (-not (Test-Path $__missionstrip)) {
    __sgsd_fail "MISSING LIB: sgsd-mission-strip.ps1" @(
        "Expected: $__missionstrip",
        "Reinstall: run sgsd-boot -Bootstrap or copy lib\ from super-gsd/scripts/"
    )
}
. $__missionstrip
```

### Mission-control render call (paste-ready)

```powershell
# super-gsd/scripts/sgsd-mission-control.ps1 - insert in Render() after the
# header bar's CLEAR_LINE (current line 1033) and before the DLB-04 comment
# (current line 1035).
# -- Mission Strip (Cockpit 2.0 - Phase 28) ----------------------------------
$strip = Get-MissionStripState -ProjectDir $ProjectDir -ActivityTail 500
Render-MissionStrip -State $strip
```

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| 1-line header in mission-control | 6-line Mission Strip | Phase 28 | Operator sees 6/8 Q-contract answers without leaving the dashboard |
| Loose `(?:current_phase|phase):\s*(\S+)` regex | Env var primary + anchored frontmatter + null fallback + `^[0-9]+$` validation | Phase 28 | Eliminates 5,727 / 8,255 corrupt rows on disk going forward |
| Path-derived phase recovery | Honest `null` + Q5 `unavailable` | Phase 27/28 | Removes loose-parse re-entry surface |

**Deprecated/outdated:**
- Loose regex stamper (lines 144–149 of `sgsd-activity-logger.js`) —
  replaced by `readActivePhase()`. Pre-fix corrupt rows remain on disk
  and surface as Q5 `unavailable` (no backfill — controlling principle).
- Pre-Phase-28 1-line dashboard header — replaced by Mission Strip; line
  count goes from 1 → 6.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DISCUSS 28.1's "1-line header" refers to the pre-Cockpit-2.0 mission/phase summary line, NOT the `SUPER GSD * Mission Control HH:MM:SS` title bar | §Open Questions Q1 | Low — strip insertion site moves up one line; both readings preserve title bar info |
| A2 | `Get-SharedActivityEntries -Tail 500` is a sufficient activity-log window for both Q1 (model: last row) and Q5 (agents: distinct subagent_types this phase) | §Pitfall 2 | Medium — if active phase has > 500 tool calls, Q5 may underreport agent count. Tunable via `-ActivityTail` param |
| A3 | Q5 agents-lane vocabulary (`agents: N (researcher active 18s)`) is acceptable to operator | §Open Questions Q3 | Low — fixture tests in Phase 30 will surface preference; iterate then |
| A4 | Codex remains `provider_unavailable` through Phase 28's 3 commits → status = `PASS-WITH-DEFERRED-3` | §Per-Dispatch ATC Scope | Low — the deferred-N count may be lower if Codex returns mid-phase, but controlling-principle continuation behavior is unchanged |
| A5 | Existing `__sgsd_fail` global is in scope at line 101 (not just inside soft-load blocks) | §Pattern 3 Insert 1 | Low — verified at line 76 / 86 / 96 (all use the same global); same context |

**The above 5 are tagged `[ASSUMED]` for the planner. None contradict
locked decisions; all are scoped narrowly enough that A1/A2 can be re-
verified by the executor with a single grep before commit.**

## Project Constraints (from CLAUDE.md)

| Directive | Compliance | How honored in Phase 28 |
|-----------|------------|--------------------------|
| Commit after every unit; never batch | YES | 3 commits planned (stamper, lib, host) |
| Stage specific files by name; never `git add -A` | YES | `git add super-gsd/hooks/sgsd-activity-logger.js` etc. |
| Per-dispatch ATC runs always | YES | Documented in §Per-Dispatch ATC Scope |
| Honest null > fabricated values | YES | Stamper rule 4 explicit: `phase: null` over `"unknown"` or path-derive |
| No new metric stream / state file | YES | Strip is read-only; no writes to new file |
| ASCII-only PS lib content | YES | §Pitfall 1 hard rule; verifier MUST grep |
| Never read .env / settings.json env block | YES | Stamper reads only STATE.md frontmatter; env var via `process.env.X` (no file read) |

## Sources

### Primary (HIGH confidence)
- `.planning/milestones/v1.6/phases/26-cockpit-question-contract/26-01-operator-question-contract-PLAN.md` — Q1-Q8 contract, vocabulary, freshness, repair predicate
- `.planning/milestones/v1.6/phases/27-cockpit-data-tree/27-01-cockpit-data-contract-PLAN.md` — Stamping Spec lines 132-254, reference impl lines 218-237
- `.planning/milestones/v1.6/phases/28-mission-control-layout/28-PATTERNS.md` — closest-analog map, anti-patterns, 16-color vocabulary
- `.planning/discussions/2026-04-26-mass-discuss.md` — DISCUSS 28.1, 28.2, 27.1, 27.2, 26.1-26.3 verbatim
- `super-gsd/scripts/sgsd-mission-control.ps1` lines 70-105, 980-1055 (host)
- `super-gsd/scripts/lib/sgsd-substrate-status.ps1` (full 208 lines, primary analog)
- `super-gsd/hooks/sgsd-activity-logger.js` (full 183 lines)

### Secondary (MEDIUM confidence)
- `super-gsd/scripts/lib/sgsd-codex-status.ps1` — stateColor pre-resolution pattern (cited via Pattern Map)
- `super-gsd/scripts/lib/sgsd-render-cache.ps1` — `Get-SharedActivityEntries` API (cited via Pattern Map line 145)
- `.planning/STATE.md` frontmatter — milestone v1.6, Phase 26 PASS-WITH-DEFERRED-1

### Tertiary (LOW confidence — flagged in Assumptions Log)
- A1, A2 readings noted in §Open Questions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dependency on disk and verified
- Architecture (6-line layout, injection points): HIGH — explicit DISCUSS lock + verbatim Pattern Map cites
- Pitfalls: HIGH (1, 2, 3, 5) / MEDIUM (4) — pitfall 4 reasoned about env propagation, not directly observed in this codebase
- Stamper fix detail: HIGH — paste-ready impl directly from 27-PLAN reference impl

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30 days; stable codebase, locked DISCUSS decisions)
