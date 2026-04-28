# Phase 50: Cockpit Research Dashboard - Research

**Researched:** 2026-04-28
**Domain:** Read-only PowerShell terminal cockpit; v1.9 data-source consumption (Phase 41-49 forward contracts); pane-layout governance for operator laptop viewport
**Confidence:** HIGH

<user_constraints>
## User Constraints (from 50-CONTEXT.md + ROADMAP §50)

### Locked Decisions
- **Improve the existing cockpit. DO NOT build a second cockpit.** [VERIFIED: 50-CONTEXT.md line 14, EXISTING-SURFACE-AUDIT.md line 70 "Do not build a second cockpit. Improve the current one."]
- Fit the operator laptop viewport. Remove repeated information across panes. [VERIFIED: 50-CONTEXT.md lines 14-15]
- Goal: make current work, active agents, Codex state, evidence, blockers, token spend, and context source mix obvious at a glance. [VERIFIED: 50-CONTEXT.md line 11-12]
- depends_on: [42, 45, 47, 49]; unblocks: [51, 52]. [VERIFIED: 50-CONTEXT.md frontmatter]

### Acceptance Criteria (ROADMAP §50)
- **A1**: top-left clearly shows milestone, phase, progress map, goal, evidence, debt, blockers, context, cost, agents, and commits.
- **A2**: right panel shows only current active Claude/agent work, then agent history, then tool/skill/VTP stream.
- **A3**: Codex panel only shows Codex state and review/gate status.
- **A4**: cockpit shows the current canonical intent in operator language (operator-facing terms, no `R#`/`cascade`/`old live` jargon).
- **A5**: layout fits the operator laptop viewport without jitter.

### Claude's Discretion
- Exact line/character widths per pane (must respect 1366×768 minimum laptop viewport).
- Choice of color/visual treatment for budget verdict tiers (`ok` / `warn` / `degraded`).
- Whether `context_source_mix` renders as bar, mini-table, or compact key-value (recommendation: compact 7-key inline).
- Sparkline character set for token-burn (existing implementation uses `.-=+X#&@`; keep).
- Whether to emit `console.log` panel telemetry to a Phase 51 BENCH-readable JSON snapshot file (recommendation: yes — see §10 self-test).

### Deferred Ideas (OUT OF SCOPE)
- Redis-backed live cockpit state (Phase 52).
- Web-based dashboard (Phase 50 stays terminal/PowerShell only).
- Cross-milestone projection (cockpit shows the active milestone's state only).
- Operator-input commands (cockpit is read-only; never writes canonical streams).
</user_constraints>

<phase_requirements>
## Phase Requirements (from REQUIREMENTS.md §COCKPIT lane)

| ID | Description | Research Support |
|----|-------------|------------------|
| **COCKPIT-01** | Redesign cockpit projections around current milestone, current phase, active agents, agent token spend, context source mix, evidence, and blockers. | §3 Pane Layout (A1 left-top); §4 Active-agent panel (A2); §5 Token spend panel; §6 Context source mix panel |
| **COCKPIT-02** | Remove duplicated NOW/Codex content from wrong panes. | §7 Repeated-info elimination audit |
| **COCKPIT-03** | Show token spend by role and phase from `agent-token-spend.jsonl`. | §5 — consumes Phase 41 `summarize()` API; aggregate by `role+phase` |
| **COCKPIT-04** | Show context-packet source mix and budget status. | §6 — consumes Phase 45 `context-packet-log.jsonl` (`context_source_mix`) + Phase 42 `token-waste-status.jsonl` (`verdict`, `route_hints`, `top_offenders`) |
| **COCKPIT-05** | Keep the UI readable on the operator laptop viewport. | §3 layout dims; §10 self-test asserts 80×24 minimum + 1366×768 target |
| **COCKPIT-06** | Show the current canonical intent in operator language. | §3 left-top "current intent" line; reads `intent-map.jsonl` (Phase 45 PACKET-00) most-recent `canonical` field; truncates internal jargon |
</phase_requirements>

## Summary

Phase 50 is a **render layer over already-shipped data**. Phases 41-49 produced canonical streams, public-API helpers (`summarize()`, `runCheck()`, `getMemoryGovernanceSnapshot()`), and JSONL append-only logs. Phase 50 reads those, projects them into 4 panes (left-top + right + Codex + bottom-strip), and never writes back. The existing cockpit is `super-gsd/scripts/sgsd-mission-control.ps1` (1,999 lines) plus 4 lib files (1,506 lines). Phase 50 **extends** this surface — it does not replace it.

The current cockpit suffers from three documented defects EXISTING-SURFACE-AUDIT.md §"Existing Cockpit Surfaces" calls out: (1) old Codex state mixed with current Claude state, (2) repeated NOW summaries in multiple panes, (3) operator-hostile labels (`old live`, `R#`, `cascade`, `checkpoint present`). The redesign replaces these with one Codex-only pane, one active-agent-only pane, and operator-facing labels driven by Phase 45's `intent-map.jsonl` canonical instruction.

The forward contracts to consume are concrete: Phase 41 ships `summarize(planningDir, {groupBy:'role+phase'})` returning `[{key, calls, total, avg, cache_read_ratio, useful_findings_per_100k, status_breakdown}]`. Phase 42 ships `runCheck(planningDir, {milestone, phase, role})` returning `{verdict, totals, rules_tripped, route_hints, top_offenders, budgets_source}`. Phase 45 emits `context-packet-log.jsonl` rows containing `metadata.context_source_mix` (7 frozen keys: `raw_evidence, phase_capsule, validated_thought, reusable_rule, guardrail, index_snippet, vtp_packet`). Phase 49 ships `getMemoryGovernanceSnapshot()` returning `{ok, total_artifacts, by_compression_level{}, recently_revoked[], recently_revalidated[], complaints_pending, last_process_complaints_ts}`. All four are LOCKED in their respective RESEARCH/CAPSULE artifacts.

**Primary recommendation:** Extend `sgsd-mission-control.ps1`'s existing render cycle by adding three new lib files (`sgsd-token-panel.ps1`, `sgsd-active-agent-panel.ps1`, `sgsd-source-mix-panel.ps1`) wired through the existing `Render` function. Move existing repeated NOW/Codex prints to a single Codex-only block. Add a new "intent strip" line at the very top reading `intent-map.jsonl` for operator-language phrasing. Bound viewport to 80×24 minimum (assert in self-test) with progressive disclosure to 132×40.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Top-left mission/phase/progress projection | Cockpit render layer (PowerShell host) | n/a | Pure projection; no business logic |
| Token-spend aggregation | Phase 41 `summarize()` | Cockpit reads | Aggregation lives in Phase 41; cockpit must NOT re-aggregate |
| Token-budget verdict | Phase 42 `runCheck()` (read-only mode) | Cockpit reads JSONL tail | runCheck has Lock 13 wrapper; safe to call from render |
| Context source mix display | Cockpit reads `context-packet-log.jsonl` tail | Phase 45 schema-validates rows | Cockpit reads frozen 7-key shape verbatim |
| Memory governance state | Phase 49 `getMemoryGovernanceSnapshot()` | Cockpit reads | Phase 49 ships the API; Phase 50 owns presentation |
| Active-agent detection | Cockpit reads `activity-log.jsonl` + `orchestrator-pulse.jsonl` tails | Phase D plumbing | Existing `Get-AgentRoster` extends; window 60s for "active" |
| Codex state | Existing `sgsd-codex-status.ps1` lib | Cockpit unifies into one pane | Already implemented; just relocate |
| Operator-language intent | Phase 45 `intent-map.jsonl` `canonical` field | Cockpit truncates+renders | Phase 45 owns canonical; cockpit displays |
| Repeated-info detection | Cockpit self-test | n/a | Static analysis: scan all panes' field set, assert ∩=∅ except {milestone, phase} |
| Heartbeat / inference / readiness banners | Existing logic | Move to bottom strip | Don't fragment current-work focus |

## Standard Stack

This phase ships PowerShell + supporting Node CJS for data shapers. No new npm dependencies.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PowerShell 5.1 (Windows host) | built-in | Cockpit render host | Existing surface; ANSI escapes already handled in `sgsd-mission-control.ps1:111-143` [VERIFIED: file inspection] |
| Node 22.x | 22.22.2 detected | Reads via `runCheck()`, `summarize()`, `getMemoryGovernanceSnapshot()` | All v1.9 tools are CJS; cockpit shells out for aggregations [VERIFIED: `node --version`] |
| ANSI alt-screen buffer (`\e[?1049h`) | n/a | In-place redraw, no scrollback pollution | Already used line 168 [VERIFIED: file inspection] |
| `System.IO.FileSystemWatcher` | .NET 4.x built-in | Reactive redraw on `.planning/` writes | Already used line 1973 [VERIFIED: file inspection] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sgsd-render-cache.ps1` | extant | Mtime-keyed JSONL tail cache + git cache | Reuse to avoid re-parsing `agent-token-spend.jsonl` per render [VERIFIED: file exists 171 lines] |
| `sgsd-mission-strip.ps1` | extant 430 lines | 6-line operator-question strip | Bottom-strip relocation target [VERIFIED: file inspection] |
| `sgsd-codex-status.ps1` | extant 698 lines | Codex-pane data source | Rebadge as the ONLY codex source; remove other code paths [VERIFIED: file inspection] |
| `sgsd-substrate-status.ps1` | extant 207 lines | DLB-04 substrate one-liner | Move to bottom strip; not a top-pane field [VERIFIED: file inspection] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extend `sgsd-mission-control.ps1` | Build new web dashboard | REJECTED — violates "do not build a second cockpit"; deferred to Phase 52 (and even then, Redis-backed live cache, NOT replacement) |
| 4 panes (current proposal) | 6 panes (Q1-Q8 mission strip lives) | REJECTED — strip is bottom rail; A1-A4 specify 4 zones |
| Polling render | FileSystemWatcher | KEEP — already implemented and avoids flicker [VERIFIED: line 1973] |
| Re-aggregate token spend in PS | Call `node summarize.cjs` | KEEP — Phase 41's `summarize()` is the canonical aggregator; cockpit MUST NOT duplicate |

**Installation:** No new packages. All deliverables are PowerShell scripts and CJS libs already present in repo.

**Version verification:**
- PowerShell 5.1 ships with Windows; `pwsh` (7.x) optional. Cockpit script declares no `#requires` directive [VERIFIED: head of `sgsd-mission-control.ps1`].
- Node 22.22.2 confirmed via `node --version` [VERIFIED: shell output 2026-04-28].
- All v1.9 tools (`token-attribution`, `token-waste`, `context-packet`, `dispatch-router`, `vtp-bridge`, `memory-governance`) export public APIs as documented in their RESEARCH/PLAN files [VERIFIED: `module.exports` greps].

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────── DATA SOURCES (read-only) ──────────────────────┐
│                                                                    │
│  .planning/STATE.md ────────────────────────────┐                  │
│  .planning/ROADMAP-AGENT.md ────────────────────┤                  │
│  .planning/metrics/agent-token-spend.jsonl ─────┤                  │
│    └─ aggregated via: token-attribution/        │                  │
│       report.cjs::summarize(dir, {groupBy})     │                  │
│  .planning/metrics/token-waste-status.jsonl ────┤  Phase 42        │
│    └─ verdict via: token-waste/                 │                  │
│       check.cjs::runCheck(dir, scope)           │                  │
│  .planning/metrics/context-packet-log.jsonl ────┤  Phase 45        │
│    └─ tail row.metadata.context_source_mix      │  (7 frozen keys) │
│  .planning/metrics/intent-map.jsonl ────────────┤  Phase 45        │
│    └─ tail row.canonical (operator language)    │                  │
│  .planning/metrics/route-decisions.jsonl ───────┤  Phase 47        │
│    └─ provider mix (claude/codex/local/vtp)     │                  │
│  .planning/metrics/vtp-bridge-failures.jsonl ───┤  Phase 48        │
│  .planning/milestones/{m}/phases/*/             │  Phase 49        │
│    PHASE-CAPSULE.json (compression_level)       │                  │
│    └─ via: memory-governance/                   │                  │
│       lifecycle.cjs::getMemoryGovernanceSnapshot│                  │
│  .planning/metrics/orchestrator-pulse.jsonl ────┤                  │
│  .planning/metrics/activity-log.jsonl ──────────┤  existing        │
│  .planning/metrics/heartbeat.jsonl ─────────────┘                  │
│                                                                    │
└──────────────────────┬─────────────────────────────────────────────┘
                       │
                       ▼ (FileSystemWatcher fires Render())
┌──────────────────── COCKPIT RENDER LAYER ──────────────────────────┐
│  sgsd-mission-control.ps1 (host)                                   │
│  ├─ lib/sgsd-render-cache.ps1   (mtime-keyed reads)                │
│  ├─ lib/sgsd-token-panel.ps1    (NEW: COCKPIT-03)                  │
│  ├─ lib/sgsd-active-agent-panel.ps1 (NEW: A2)                      │
│  ├─ lib/sgsd-source-mix-panel.ps1   (NEW: COCKPIT-04)              │
│  ├─ lib/sgsd-codex-status.ps1   (existing; A3 sole owner)          │
│  ├─ lib/sgsd-mission-strip.ps1  (existing; bottom rail)            │
│  └─ lib/sgsd-substrate-status.ps1 (existing; bottom rail)          │
└──────────────────────┬─────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────── 4-PANE OUTPUT (alt-screen ANSI) ───────────────┐
│  ┌────────────────────────────────┬─────────────────────────────┐  │
│  │ A1 LEFT-TOP                    │ A2 RIGHT (active work)      │  │
│  │  • milestone + name            │  • current agent (1 line)   │  │
│  │  • phase progress bar          │  • current tool/skill (1)   │  │
│  │  • current intent (op lang)    │  • agent history (3 rows)   │  │
│  │  • current goal                │  • tool/VTP stream (5 rows) │  │
│  │  • EVIDENCE done/left          │                             │  │
│  │  • DEBT phase/milestone/edge   │                             │  │
│  │  • blockers (if any)           │                             │  │
│  │  • CTX % + model               │                             │  │
│  │  • cost: O/S/H/total + phase   │                             │  │
│  │  • SOURCE-MIX 7 keys + verdict │                             │  │
│  │  • commits (3 rows)            │                             │  │
│  ├────────────────────────────────┴─────────────────────────────┤  │
│  │ A3 CODEX (single pane)                                       │  │
│  │  state | model | think | runs | ok/fail | offload | last gate│  │
│  │  3 most-recent verdicts                                      │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ Bottom strip: heartbeat + readiness + substrate one-liner    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
super-gsd/scripts/
├── sgsd-mission-control.ps1     # MODIFIED — host orchestrates panes
└── lib/
    ├── sgsd-render-cache.ps1    # existing — keep as-is
    ├── sgsd-mission-strip.ps1   # existing — relocate prints to bottom
    ├── sgsd-codex-status.ps1    # existing — A3 sole consumer
    ├── sgsd-substrate-status.ps1 # existing — bottom strip
    ├── sgsd-token-panel.ps1     # NEW — COCKPIT-03 token spend by role+phase
    ├── sgsd-active-agent-panel.ps1 # NEW — A2 right pane
    ├── sgsd-source-mix-panel.ps1 # NEW — COCKPIT-04 context source mix
    └── sgsd-cockpit-shell.cjs   # NEW — Node helper that calls v1.9 APIs and emits JSON

super-gsd/tests/cockpit-acceptance/
└── fixtures/
    ├── A1/                      # extend existing
    ├── A2/                      # NEW
    ├── A3/                      # NEW
    ├── A4/                      # NEW
    ├── A5/                      # NEW (viewport)
    ├── A6/                      # extend existing
    ├── A7/                      # extend existing
    └── A8/                      # extend existing
```

### Pattern 1: Read-only data shaping via Node helper, render in PowerShell

**What:** PS host shells out to Node once per render (cached) for v1.9 aggregations. Avoids re-implementing `summarize()` in PS.
**When to use:** Every pane that needs Phase 41/42/45/49 data.
**Example:**
```powershell
# Source: super-gsd/scripts/sgsd-mission-control.ps1 pattern (line 267-271 idiom)
function Get-CockpitDataSnapshot {
    param([string]$ProjectDir, [string]$CurrentPhase)
    $shell = Join-Path $PSScriptRoot "lib\sgsd-cockpit-shell.cjs"
    if (-not (Test-Path $shell)) { return $null }
    $planningDir = (Join-Path $ProjectDir ".planning") -replace '\\','/'
    try {
        $json = & node $shell $planningDir $CurrentPhase 2>$null
        if (-not $json) { return $null }
        return ($json | ConvertFrom-Json -ErrorAction Stop)
    } catch { return $null }
}
```

```javascript
// Source: super-gsd/scripts/lib/sgsd-cockpit-shell.cjs (NEW)
// Single Node invocation that calls all v1.9 public APIs and returns one JSON.
const path = require('path');
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tokenAttr = require(path.join(repoRoot, 'super-gsd/tools/token-attribution/report.cjs'));
const tokenWaste = require(path.join(repoRoot, 'super-gsd/tools/token-waste/check.cjs'));
const memGov = require(path.join(repoRoot, 'super-gsd/tools/memory-governance/lifecycle.cjs'));
const planningDir = process.argv[2];
const phase = process.argv[3] || null;
const snapshot = {
  // COCKPIT-03 — token spend by role+phase
  byRolePhase: tokenAttr.summarize(planningDir, { groupBy: 'role+phase' }),
  // COCKPIT-04 — budget verdict
  budget: tokenWaste.runCheck(planningDir, { phase }),
  // Memory governance state
  governance: memGov.getMemoryGovernanceSnapshot(planningDir),
  // Frozen budgets for display
  budgets: tokenAttr.BLOAT_THRESHOLDS,
};
process.stdout.write(JSON.stringify(snapshot));
```

### Pattern 2: Frozen 7-key context_source_mix display

**What:** Phase 45 emits `metadata.context_source_mix` as a frozen 7-key object on every `context-packet-log.jsonl` row. Cockpit reads the LATEST row matching the active phase.
**When to use:** A1 left-top "SOURCE MIX" line.
**Example:**
```powershell
# Source: derived from super-gsd/tools/context-packet/build.cjs:239-268
function Format-ContextSourceMix {
    param($mix)
    if (-not $mix) { return "SOURCE MIX  unavailable" }
    # Order locked: raw_evidence, phase_capsule, validated_thought,
    # reusable_rule, guardrail, index_snippet, vtp_packet
    $parts = @(
        ("raw {0}"   -f $mix.raw_evidence),
        ("cap {0}"   -f $mix.phase_capsule),
        ("vt {0}"    -f $mix.validated_thought),
        ("rule {0}"  -f $mix.reusable_rule),
        ("guard {0}" -f $mix.guardrail),
        ("idx {0}"   -f $mix.index_snippet),
        ("vtp {0}"   -f $mix.vtp_packet)
    )
    return ("SOURCE MIX  " + ($parts -join "  "))
}
```

### Pattern 3: Active-agent detection from orchestrator-pulse + activity-log

**What:** "Currently active" means at least one of:
- `orchestrator-pulse.jsonl` last-row `ts` is within 60 seconds AND
- `activity-log.jsonl` last `Agent`/`TaskCreate` row ts within 5 minutes (the 300s window already used at `sgsd-mission-control.ps1:932`).
**When to use:** A2 right pane "current active" header line.
**Source:** existing `Get-AgentRoster` (line 891) thresholds: `<300s ACTIVE`, `<900s IDLE`, `<3600s RECENT`. Phase 50 keeps these thresholds; A2 displays only `ACTIVE`.

### Anti-Patterns to Avoid
- **Re-aggregating token spend in PS.** The Phase 41 `summarize()` API is the only canonical aggregator. Re-implementing in PS forks behavior the moment Phase 41 is patched [VERIFIED: lock-2 in REQUIREMENTS.md "`.planning` JSONL, phase artifacts, and git commits remain source of truth"; the cockpit's `Get-TokenStats` at line 830 was sufficient pre-v1.9 but now MUST be replaced with `summarize()` consumption to surface role × phase].
- **Showing the same field in two panes.** E.g., current `sgsd-mission-control.ps1` prints "phase X" in mission line (1234), milestone line (1716-1730), and phase progression block (1733-1763). Pick ONE — left-top header. The 6-line mission strip duplicates several of these (line 1346) — relocate strip to bottom or remove its overlap.
- **Crashing the render frame on missing data.** Lock 13: never throw out of Render. Existing pattern at `sgsd-mission-strip.ps1:5-8` ("this lib MUST NEVER throw out of a Render frame") is the standard — every new panel must `try{} catch{}` and degrade to "unavailable" placeholder.
- **Writing to canonical streams from cockpit.** Cockpit is read-only. The route-ledger fingerprint test in `dispatch-router/route.cjs:679-700` is the precedent: capture mtime+size before, assert no drift after. Phase 50 self-test must include the same fingerprint over 13 canonical streams + 4 governance streams.
- **Polling Phase 49 governance counts every render.** `getMemoryGovernanceSnapshot()` walks every milestone's PHASE-CAPSULE.json. Cache by fingerprint of the milestones tree (mtime of newest PHASE-CAPSULE.json) for the same reason `Get-TokenStats` caches by token-log mtime+length (line 828).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token-spend aggregation by role/phase | A new PS roll-up loop | `tokenAttribution.summarize(dir, {groupBy:'role+phase'})` | Phase 41 R1-R5 substitution rules embed in `_substitutionCandidates`; PS reimpl drifts |
| Token-budget verdict | Re-implement BUDGETS YAML parsing | `tokenWaste.runCheck(dir, scope)` | Phase 42 budgets, BLOAT_THRESHOLDS, route_hint matrix LOCKED in `check.cjs:101-124` |
| Memory governance counts | Walk PHASE-CAPSULE.json files in PS | `memGov.getMemoryGovernanceSnapshot(dir)` | Phase 49 Q14 LOCKED Phase 50 forward contract; helper exported for this |
| Context source mix shape | Define your own keys | Read `metadata.context_source_mix` directly | 7 frozen keys at `build.cjs:239-268`; do not invent an 8th |
| Codex state derivation | New parsing of `codex-live.json` | `Get-SgsdCodexStatus` from existing lib | Phase 50 must NOT split codex parsing; A3 has one source |
| Active-phase detection | New STATE.md parser | Existing `Get-StateInfo` (line 621) | Frontmatter parser already handles 4 fallback patterns |
| ANSI color rendering in Warp | New Write-Host wrapper | Existing override (line 144-164) | Phase 22 Warp-PTY workaround already documented |
| Mtime-keyed JSONL tail cache | New cache | `Get-CachedTail` (line 198-210) | Existing render-cache already memoizes by `(path, mtime, size, count)` |
| Git log slice | `git log` per render | `Invoke-CachedGit` (HEAD-sha-keyed) | Existing optimization at line 552 |
| Wave/task drill-down | New parser | `Get-WaveTasks` (line 507-595) | Already extracts (Tasks X-Y) suffix and matches commits |
| Sparkline rendering | bar-chart libs | Existing 8-char ramp `.-=+X#&@` (line 1592) | Already works; keep the visual idiom |

**Key insight:** Phase 50 is **almost entirely** a wiring problem. Every aggregation, parser, and renderer it needs is either (a) already in `sgsd-mission-control.ps1`'s lib, or (b) shipped by Phases 41/42/45/49 as a public API. The risk is duplication (re-implementing what's already there), not new work. The acceptance criteria translate to: relocate, dedupe, add 3 new pane libs that are thin readers over public APIs.

## Runtime State Inventory

**Trigger applicable:** Phase 50 RELOCATES print blocks within `sgsd-mission-control.ps1`. This is a refactor pattern, not greenfield.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — cockpit is read-only against canonical streams. The `_TailCache`, `_sessionAggKey/Parsed`, `_tokenStatsKey/Parsed` script-scope caches are in-memory only, rebuilt every PS host start. | None — existing caches keep their key shapes. |
| **Live service config** | None — no external service registers Phase 50 specifically. tmux config (`tmux-monitor.conf`) launches the script but doesn't bake in pane layout. | None. |
| **OS-registered state** | `sgsd1.cmd` launcher (referenced at `sgsd-mission-control.ps1:38` "sgsd1 C:\path\to\project") invokes the script; rename of script path would break launcher. | KEEP script path stable. Phase 50 modifies content, not filename. |
| **Secrets and env vars** | `SGSD_COCKPIT_COMPACT`, `SGSD_COCKPIT_FULL`, `SGSD_NO_PAUSE_ON_ERROR` env vars switch render mode (line 1333, 41). | Phase 50 plan must preserve these env-var contracts; new layout must still respect `SGSD_COCKPIT_COMPACT=1`. |
| **Build artifacts / installed packages** | None — pure script, no compiled output. | None. |

**Canonical question answered:** After every line in `sgsd-mission-control.ps1` is updated, what runtime systems still have the old layout cached or registered? **Answer:** None outside the running PS process. Operators must close + relaunch the cockpit window after Phase 50 ships (acceptable; documented in PLAN handoff).

## Common Pitfalls

### Pitfall 1: Acceptance fixture A4 conflict (laptop viewport)

**What goes wrong:** A laptop viewport is `1366×768` pixels at standard scale. In a default Windows Terminal at 14pt Cascadia Mono, that's roughly `120×30` characters. Existing cockpit assumes ≥80 columns (line 213) and ≥70 rows for "full" mode (line 1333). At 30 rows, the full-mode renderer overflows the viewport, scrolls, and `$ALT_EXIT` then dumps half-rendered content.
**Why it happens:** `Render-CompactMissionControl` (line 1208) is the small-screen fallback, but the `<70` cutoff is too tall for laptop. Operator never sees the laptop mode unless terminal is shrunk explicitly.
**How to avoid:** Phase 50 changes the threshold to `<40` rows for compact mode (covers default laptop). Self-test asserts default-laptop fixtures render without a `[Console]::WindowWidth/Height < threshold` clipped state.
**Warning signs:** Cockpit log lines extend past `Get-PaneWidth` and trigger `Trunc` so frequently that the agent panel goes empty.

### Pitfall 2: Phase 49 snapshot freshness vs render rate

**What goes wrong:** `getMemoryGovernanceSnapshot()` walks every PHASE-CAPSULE.json under every milestone. With ~50 capsules in v1.6-v1.9, that's a 50-stat-call traversal **per render**. FileSystemWatcher fires multiple times per JSONL append, so we can render at >1 Hz. CPU spikes; PS PTY visibly jitters.
**Why it happens:** Phase 49 didn't memoize; it was a simple walker.
**How to avoid:** Cockpit caches the snapshot by a fingerprint of `mtime` of `.planning/milestones/` directory tree (newest mtime). Refresh only when fingerprint changes. Same idiom as `_sessionAggKey` (line 345). Self-test asserts ≥10× redraws between PHASE-CAPSULE writes do not re-invoke the Node shell.
**Warning signs:** Profiler shows `node sgsd-cockpit-shell.cjs` invocations > FileSystemWatcher fire count.

### Pitfall 3: Cross-pane field duplication regression

**What goes wrong:** Future contributors add a new field to A1 left-top forgetting it's already in the bottom strip's mission line, regressing COCKPIT-02.
**Why it happens:** No automated check enforces "field appears in ≤1 pane".
**How to avoid:** Self-test fixture A6 builds a static map `pane → fields` (set of `{milestone, phase, goal, evidence, debt, blockers, ctx, cost, agents, commits, codex_state, codex_runs, source_mix, governance, intent}`). Asserts that for every key K in A1, K does not appear in A2/A3/bottom (allowed exceptions: `milestone`, `phase` may appear in mission line for spatial anchoring; encoded as a whitelist).
**Warning signs:** Code review of `Render` body shows the same `Write-Host "phase X"` pattern in three places.

### Pitfall 4: Operator-language regression (A4)

**What goes wrong:** Existing cockpit has labels like `R#`, `cascade`, `old live`, `BLK 1 / WILL 2` (line 1433), `SGSD-V2: pulse 30s gate pass tok ...=#` (line 1601-1611). EXISTING-SURFACE-AUDIT.md §"Existing Risks" #5 calls these out. Phase 50 must replace; risk is a partial replacement (some labels updated, others missed).
**Why it happens:** The repeat-test catches duplicates but not jargon.
**How to avoid:** Self-test fixture A7 maintains a forbidden-label list: `'R#', 'cascade', 'old live', 'WILL', 'pulse', 'gate', 'tok'` as a string-presence assertion against the rendered output. Also includes a positive list: `'milestone', 'phase', 'agent', 'cost', 'context', 'token', 'blocker', 'commit'` must each appear at least once.
**Warning signs:** Operators say "what does cascade mean again?" — do not ship.

### Pitfall 5: Codex state desync between panes

**What goes wrong:** Existing cockpit prints Codex state in 4+ places (line 1614, 1647 codex-tile, 1346 mission strip, 1399 inference watchdog). Each pulls from the same `codex-live.json` but with different age cutoffs. Operator sees two different "Codex states" simultaneously.
**Why it happens:** Codex tile (line 1647-1674) was added incrementally without consolidating earlier prints.
**How to avoid:** A3 is THE codex panel. Phase 50 plan removes lines 1614-1644 (CODEX one-liner) and the mission strip's `> codex` field (`sgsd-mission-strip.ps1:303-348`). Self-test fixture A3 asserts the substring `Codex` appears exactly once in the rendered frame outside A3 (which is `> codex --` placeholder if needed for layout).
**Warning signs:** Two color codes for codex state visible in the same frame.

### Pitfall 6: Empty data sources before v1.9 phases land

**What goes wrong:** Phase 50 ships during v1.9 development. `agent-token-spend.jsonl` may have <100 rows; `context-packet-log.jsonl` may not exist yet; `intent-map.jsonl` may be empty.
**Why it happens:** Phase ordering: 50 depends on 42, 45, 47, 49 — all of which exist as code but with cold ledgers.
**How to avoid:** Every pane treats missing/empty data as "unavailable" placeholder, not error. Self-test fixture A8 deletes/truncates each canonical stream individually and asserts cockpit renders without crashing or hanging. Existing degrade pattern at `sgsd-mission-strip.ps1:42-55` (default values for every field) is the template.
**Warning signs:** Render frame shows `$null` or "ERROR:" anywhere.

### Pitfall 7: Re-aggregating ledgers (token-log vs agent-token-spend)

**What goes wrong:** Existing `Get-TokenStats` (line 830) reads `token-log.jsonl` and aggregates by model. Phase 41 introduced `agent-token-spend.jsonl` with role × phase × provider. Cockpit must NOT show both — operator can't tell which is current.
**Why it happens:** Naive "add new panel without removing old" pattern.
**How to avoid:** Phase 50 plan deprecates `Get-TokenStats` in favor of `byRolePhase` from the Node shell snapshot. Cost line at 1880-1888 keeps the model breakdown (still useful) but uses `agent-token-spend.jsonl` as backing source via the new shell. Old `token-log.jsonl` reads remain for backward compat ONLY when v1.9 ledgers are empty (degrade chain).
**Warning signs:** Two cost rows render different totals.

## Code Examples

Verified patterns from official sources:

### Reading `runCheck()` for budget verdict

```javascript
// Source: super-gsd/tools/token-waste/check.cjs:441-540 (verbatim shape)
const tw = require('./super-gsd/tools/token-waste/check.cjs');
const result = tw.runCheck('.planning', { phase: '50' });
// result = {
//   scope: { milestone: null, phase: '50', role: null },
//   verdict: 'ok' | 'warn' | 'degraded',
//   totals: { rows_evaluated, ok, warn, degraded, false_positive },
//   rules_tripped: { 'researcher_local_script_candidate': 3, ... },
//   route_hints: [{ from_role, reason, count }, ...],
//   top_offenders: [{ role, phase, milestone, input_total, cache_ratio, findings, verdict, source_event_id }, ...]
// }
```

### Reading `summarize()` for token spend by role × phase

```javascript
// Source: super-gsd/tools/token-attribution/report.cjs:513-562 (verbatim shape)
const ta = require('./super-gsd/tools/token-attribution/report.cjs');
const rows = ta.summarize('.planning', { groupBy: 'role+phase' });
// rows = [{
//   key: 'researcher|50',
//   calls: 1,
//   total: 314538,
//   avg: 314538,
//   cache_read_ratio: 0.985,
//   useful_findings_per_100k: 12,
//   status_breakdown: { ok: 1 }
// }, ...] sorted descending by total
```

### Reading `getMemoryGovernanceSnapshot()` for compression-level counts

```javascript
// Source: super-gsd/tools/memory-governance/lifecycle.cjs:1266-1337 (verbatim)
const mg = require('./super-gsd/tools/memory-governance/lifecycle.cjs');
const snap = mg.getMemoryGovernanceSnapshot('.planning');
// snap = {
//   ok: true,
//   total_artifacts: 44,
//   by_compression_level: {
//     raw_evidence: 0,
//     phase_capsule: 44,
//     validated_thought: 0,
//     reusable_rule: 0,
//     guardrail: 0
//   },
//   recently_revoked: [{...}, ...],   // last 10 from memory-revocations.jsonl
//   recently_revalidated: [{...}, ...], // last 10 from memory-revalidations.jsonl
//   complaints_pending: 0,
//   last_process_complaints_ts: '2026-04-27T20:09:27.392Z'
// }
```

### Reading `context_source_mix` from the latest packet log row

```powershell
# Source: derived from super-gsd/tools/context-packet/build.cjs:239-268
# context-packet-log.jsonl rows include row.metadata.context_source_mix
# with 7 frozen keys.
function Get-LatestContextSourceMix {
    param([string]$ProjectDir, [string]$Phase)
    $log = Join-Path $ProjectDir ".planning/metrics/context-packet-log.jsonl"
    if (-not (Test-Path $log)) { return $null }
    try {
        $tail = Get-CachedTail $log 50
        for ($i = $tail.Count - 1; $i -ge 0; $i--) {
            try {
                $r = $tail[$i] | ConvertFrom-Json -ErrorAction Stop
                if ($Phase -and "$($r.phase)" -ne $Phase) { continue }
                if ($r.metadata -and $r.metadata.context_source_mix) {
                    return $r.metadata.context_source_mix
                }
            } catch {}
        }
    } catch {}
    return $null
}
```

### Reading Codex state from the existing lib

```powershell
# Source: super-gsd/scripts/lib/sgsd-codex-status.ps1 (existing, do not duplicate)
. "$PSScriptRoot/lib/sgsd-codex-status.ps1"
$codex = Get-SgsdCodexStatus -ProjectDir $ProjectDir -PlanningDir $PlanningDir
# $codex = @{
#   state            = 'running'|'ok'|'not-fired'|'error'|...
#   updatedAgeSec    = 25
#   model            = 'gpt-5.4'
#   reasoningEffort  = 'high'
#   totalRuns        = 12
#   okRuns           = 11
#   failedRuns       = 1
#   claudeTokensSaved = 245000
#   stateColor       = 'Green'|'Yellow'|'Red'|'DarkGray'
# }
```

### Active-agent detection (Phase 50 new helper)

```powershell
# Source: derived from existing Get-AgentRoster (sgsd-mission-control.ps1:891-938)
# A2 narrows to ACTIVE only (age < 60s or 300s — see §3 for boundary justification).
function Get-CurrentlyActiveAgents {
    param([string]$ProjectDir, [int]$WindowSec = 300)
    $roster = Get-AgentRoster -maxAgeSec $WindowSec
    return @($roster | Where-Object { $_.status -eq 'ACTIVE' })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `token-log.jsonl` aggregation by model only | `agent-token-spend.jsonl` aggregation by role × phase × provider | Phase 41 (2026-04-27) | Cockpit must call `summarize()`; old per-model `Get-TokenStats` becomes degrade fallback |
| Codex state in 4+ render blocks | Single A3 codex pane | Phase 50 (this) | Removes duplication; one source of truth in render |
| Mixed jargon labels | Operator-language `intent-map.jsonl` `canonical` field | Phase 45 PACKET-00 | Cockpit reads canonical instruction directly; no manual translation |
| Hand-rolled milestone walking for memory state | `getMemoryGovernanceSnapshot()` | Phase 49 (this milestone) | Cockpit consumes API; doesn't replicate walker |
| 6-line mission strip at TOP | Bottom strip (heartbeat, readiness, substrate one-liner) | Phase 50 | Top is reserved for current work; signals move below |

**Deprecated/outdated:**
- `Get-TokenStats` reading `token-log.jsonl` ONLY: keep as graceful degrade ONLY when `agent-token-spend.jsonl` empty.
- Multiple Codex prints (line 1614 + 1647 + mission-strip line 337): remove all but A3.
- Mission strip's `> model` and `> codex` fields when those data points appear in A1/A3: relocate or drop.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Operator laptop viewport ≈ 120×30 chars at default scale | §3 layout, Pitfall 1 | If operator runs at 80×24, compact-mode threshold needs lowering further |
| A2 | `intent-map.jsonl` `canonical` field length ≤80 chars | §3 left-top intent line | If longer, truncate at panel width − 12; assumed acceptable |
| A3 | `agent-token-spend.jsonl` written at every dispatch, not batched | COCKPIT-03 | If batched, render shows stale spend; mitigated by FSWatcher fallback to `token-log.jsonl` |
| A4 | All operators use Windows Terminal or Warp (ANSI alt-screen support) | §3 ANSI escapes | If running in cmd.exe legacy console, alt-screen no-ops (still works, just doesn't restore main buffer) |
| A5 | `getMemoryGovernanceSnapshot()` performance is acceptable when cached by milestones-tree mtime | Pitfall 2 | If 50+ capsules slow even cached invocation, push fingerprint to per-milestone level |
| A6 | Bottom strip (heartbeat, readiness, substrate) fits in 4 rows | §3 | If signals expand, strip becomes scrollable mini-panel — defer |

**If this table proves empty after planning:** The planner can lock all 6 by inspecting representative log rows during plan-time. None require operator clarification.

## Open Questions

1. **Do we need a separate "dispatch-routing" sub-line in A1 (Phase 47 route-decisions.jsonl)?**
   - What we know: Phase 47 logs every dispatch routing decision (claude/codex/local/vtp). Operator-relevant for COCKPIT-04 "context-packet source mix and budget status".
   - What's unclear: Whether route-decisions deserves its own line or rolls into the source-mix display.
   - Recommendation: Add a 1-line "ROUTE last 5: [c4/cdx1/loc0/vtp0]" counter as bottom of A1; keep the source-mix line distinct (different concept).

2. **Should A3 Codex pane include Codex token offload count?**
   - What we know: `sgsd-codex-status.ps1` already exposes `claudeTokensSaved`. Existing render shows it (line 1631-1637).
   - What's unclear: Per A3 spec ("only Codex state and review/gate status"), is offload "state" or "stats"?
   - Recommendation: Include — it's first-order Codex value signal and operator-meaningful. Single line: `state | runs | ok/fail | offload XXk`.

3. **How aggressively should the operator-language replacement scrub existing labels?**
   - What we know: EXISTING-SURFACE-AUDIT calls out 4 jargon strings. The codebase uses many more (`SGSD-V2`, `DLB-04`, `SUBSTRATE`, `Mission Strip`).
   - What's unclear: Is "DLB-04" jargon (operator-hostile) or shorthand (operator-trained)?
   - Recommendation: Treat `DLB-04`, `SGSD-V2` as jargon; replace with descriptive labels. Ask operator at PLAN-time if scope grows. Keep `MISSION CONTROL` as the brand.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PowerShell 5.1 | Cockpit host script | ✓ | Built-in Win11 | `pwsh` 7.x also works |
| Node.js 22.x | `sgsd-cockpit-shell.cjs` to call v1.9 APIs | ✓ | 22.22.2 | None — required |
| Phase 41 `report.cjs` | `summarize()` API | ✓ | 1027 lines | If absent, fall back to local `token-log.jsonl` aggregation |
| Phase 42 `check.cjs` | `runCheck()` API | ✓ | 1361 lines | If absent, render "budget unavailable" |
| Phase 45 `build.cjs` (writer) | populates `context-packet-log.jsonl` | ✓ | 1327 lines | If empty, render "source mix --" |
| Phase 49 `lifecycle.cjs` | `getMemoryGovernanceSnapshot()` API | ✓ | 2103 lines | If absent, render "governance unavailable" |
| `sgsd-render-cache.ps1` | mtime-keyed reads | ✓ | 171 lines | Falls back to no caching (slower but works) |
| `sgsd-codex-status.ps1` | A3 sole consumer | ✓ | 698 lines | None — required for A3 |
| Windows Terminal or Warp | ANSI alt-screen | ✓ | n/a | Legacy cmd.exe degrades to scrolling output |

**Missing dependencies with no fallback:** None. All Phase 41-49 modules exist and export their advertised public APIs (verified by `module.exports` greps).

**Missing dependencies with fallback:** `agent-token-spend.jsonl` may be empty if Phase 41 backfill hasn't run on a fresh checkout — handled by degrade chain to `token-log.jsonl`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | PowerShell `Pester` (existing acceptance pattern) + Node test runner (CJS `assert`) for shell helper |
| Config file | None — invocation pattern: `pwsh -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1` (existing) |
| Quick run command | `pwsh -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1 -Filter A1` |
| Full suite command | `pwsh -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1` + `node super-gsd/scripts/lib/sgsd-cockpit-shell.cjs --self-test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COCKPIT-01 | A1 left-top renders all 11 listed fields with seeded data | acceptance | `... -Filter A1` | ❌ Wave 0 — extend existing A1 fixture |
| COCKPIT-01 | A2 right pane renders only currently-active agent + history | acceptance | `... -Filter A2` | ❌ Wave 0 — A2 fixture exists empty |
| COCKPIT-02 | No field appears in >1 pane (whitelisted milestone+phase exception) | unit | `... -Filter A6` repeat-info | ❌ Wave 0 |
| COCKPIT-03 | Token spend by role+phase reads `summarize()` output verbatim | integration | `node super-gsd/scripts/lib/sgsd-cockpit-shell.cjs --self-test` | ❌ Wave 0 |
| COCKPIT-04 | Context source mix renders 7 frozen keys + budget verdict | integration | `... -Filter A4` | ❌ Wave 0 — A4 fixture exists empty |
| COCKPIT-05 | Layout fits 1366×768 viewport (compact mode at <40 rows) | smoke | `... -Filter A5` viewport-fit | ❌ Wave 0 — A5 fixture missing |
| COCKPIT-06 | Cockpit renders intent-map canonical (operator language) | acceptance | `... -Filter A7` operator-language | ❌ Wave 0 — A7 fixture exists empty |
| Lock 13 | Render NEVER throws on missing/corrupt source | failure injection | `... -Filter A8` empty-streams | ❌ Wave 0 — A8 fixture exists empty |
| Read-only | No canonical stream mtime/size changes after render | invariant | mirrored from `dispatch-router/route.cjs:679-700` fingerprint test | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pwsh -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1 -Filter A<task>`
- **Per wave merge:** Full acceptance suite + Node shell self-test
- **Phase gate:** Full suite green + manual visual screenshot at 1366×768 + `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `super-gsd/tests/cockpit-acceptance/fixtures/A1/` — extend with v1.9-shape token spend, source mix, governance
- [ ] `super-gsd/tests/cockpit-acceptance/fixtures/A2/` — populate with active-agent JSONL fixtures
- [ ] `super-gsd/tests/cockpit-acceptance/fixtures/A3/` (NEW) — Codex-only pane fixtures
- [ ] `super-gsd/tests/cockpit-acceptance/fixtures/A4/` — populate with context-packet-log + token-waste-status
- [ ] `super-gsd/tests/cockpit-acceptance/fixtures/A5/` (NEW) — viewport-fit fixture (80×24, 100×30, 132×40)
- [ ] `super-gsd/tests/cockpit-acceptance/fixtures/A6/` — populate with repeated-info detection map
- [ ] `super-gsd/tests/cockpit-acceptance/fixtures/A7/` — populate with operator-language label set
- [ ] `super-gsd/tests/cockpit-acceptance/fixtures/A8/` — populate with empty/missing-stream injections
- [ ] `super-gsd/scripts/lib/sgsd-cockpit-shell.cjs --self-test` — define 6+ assertion fixtures (one per pane data source + degrade chain)

*(Existing acceptance harness: `super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1` — VERIFIED: file exists.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Cockpit reads local files; no auth surface |
| V3 Session Management | no | Long-lived render loop; no session tokens |
| V4 Access Control | partial | Phase 49 `allowed_consumers[]` ('cockpit' scope future) — Phase 50 ships with `['*']` default; no enforcement code yet |
| V5 Input Validation | yes | Cockpit reads JSONL/JSON with `try{}/catch{}` per row; malformed rows skipped (existing pattern at `Get-AgentRoster` line 902) |
| V6 Cryptography | no | No crypto surface; source_hashes are read but verified by Phase 49, not 50 |
| V7 Error Handling & Logging | yes | Lock 13 invariant: never throw out of Render; all read failures degrade to "unavailable" placeholder |
| V8 Sensitive Data | yes | Token-log entries may include MCP tool names (e.g., `mcp__vtp-kb__vtp_search`); cockpit truncates display, never persists. No secrets in `agent-token-spend.jsonl` (Phase 41 envelope schema excludes auth headers) |
| V12 File and Resource | yes | Cockpit reads ONLY from `.planning/` and `super-gsd/`; never writes; FileSystemWatcher scope is `.planning/` only (line 1974) |

### Known Threat Patterns for {PowerShell + JSONL ledger consumer + render loop}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious JSONL row injection (operator pastes crafted log) | Tampering | `ConvertFrom-Json -ErrorAction Stop` per-row in try/catch; ANSI sequences in `target` field stripped via `Trunc` truncation + Write-Host wrapping. **Risk:** ANSI escape in JSON value could break terminal — mitigation: explicit ANSI strip pass before Write-Host (NEW for Phase 50, not in current code). |
| Symlink in `.planning/metrics/*.jsonl` to `/etc/passwd` (or `\Windows\System32`) | Information Disclosure | Cockpit only consumes paths under `$ProjectDir/.planning/`; resolved via `Resolve-Path` (line 49); subsequent reads use the resolved absolute path. **Recommendation:** Keep behavior; document. |
| Path traversal via `phase` field in token-log entry | Tampering | `phase` is treated as a string for filtering; never used as a path component. **Verify:** A8 fixture should include `phase: "../etc"` row and assert no file read happens off canonical paths. |
| Resource exhaustion via huge JSONL line | DoS | `Get-CachedTail` reads only N tail lines (60-500); each line bounded by `ConvertFrom-Json` parser limits. **Risk:** A 50MB single-line JSONL would still load fully via `Get-Content -Tail`. Mitigation: existing pattern; document but don't fix in scope. |
| Side-channel via shell-out timing (Node helper invocation) | Information Disclosure | Cockpit invokes `node sgsd-cockpit-shell.cjs` with `& node $shell ... 2>$null`; stderr suppressed; stdout JSON-only. No env/secret leak path identified. |
| Forbidden secret in `target` field rendered in clear (Pitfall 7 of MCP exposure) | Information Disclosure | EXPLICIT: cockpit must NEVER render `mcp__*` tool *arguments*, only tool *names*. Existing `Get-LastMcpSummary` (line 429) summarizes results, NOT requests. Phase 50 keeps this contract. **Verify:** A7 fixture asserts no row containing literal "Bearer", "sk-", "ghp_", or `password=` ever appears in render output. |

## Sources

### Primary (HIGH confidence)
- `.planning/milestones/v1.9/phases/50-cockpit-research-dashboard/50-CONTEXT.md` — phase scope and locked decisions [VERIFIED: file inspection]
- `.planning/milestones/v1.9/REQUIREMENTS.md` lines 223-234 — COCKPIT-01..06 requirements [VERIFIED: file inspection]
- `.planning/milestones/v1.9/ROADMAP.md` lines 256-275 — Phase 50 deliverables and acceptance [VERIFIED: file inspection]
- `.planning/milestones/v1.9/SGSD-HANDOVER.md` Success Bar lines 112-123 — milestone close criteria including cockpit clarity [VERIFIED: file inspection]
- `.planning/milestones/v1.9/VTP-RESEARCH-DELTA.md` — KAIROS lesson context-pressure-as-control-signal applies to Phase 50 [VERIFIED: file inspection]
- `.planning/milestones/v1.9/EXISTING-SURFACE-AUDIT.md` lines 62-79 — existing cockpit surfaces and 5 risk callouts [VERIFIED: file inspection]
- `super-gsd/scripts/sgsd-mission-control.ps1` — 1999-line existing host [VERIFIED: full read of head + key sections lines 1-300, 500-1100, 1500-1999]
- `super-gsd/scripts/lib/sgsd-mission-strip.ps1` — 430-line bottom-strip lib [VERIFIED: full read]
- `super-gsd/scripts/lib/sgsd-codex-status.ps1` — 698 lines (referenced) [VERIFIED: line count via wc -l]
- `super-gsd/tools/token-attribution/report.cjs` — `summarize()` shape [VERIFIED: lines 513-562 + module.exports lines 1013-1027]
- `super-gsd/tools/token-waste/check.cjs` — `runCheck()` shape [VERIFIED: lines 441-540 + module.exports lines 1350-1361]
- `super-gsd/tools/context-packet/build.cjs` — `_buildContextSourceMix` 7 keys [VERIFIED: lines 239-268]
- `super-gsd/tools/memory-governance/lifecycle.cjs` — `getMemoryGovernanceSnapshot()` shape [VERIFIED: lines 1266-1337]
- `super-gsd/tools/dispatch-router/route.cjs` — `routeDispatch()` and fingerprint pattern [VERIFIED: lines 660-700, 1090-1102]
- `super-gsd/tools/vtp-bridge/classify.cjs` — `vtp-bridge-failures.jsonl` schema [VERIFIED: lines 145-152, 1016-1027]
- `.planning/milestones/v1.9/phases/49-memory-governance-lifecycle/49-RESEARCH.md` lines 1169-1194 — Q14 LOCKED Phase 50 forward contract [VERIFIED: file inspection]
- `.planning/milestones/v1.9/phases/41-baseline-token-attribution/41-RESEARCH.md` lines 460-510 — R5 orchestrator turn-trim feeds Phase 50 [VERIFIED: file inspection]
- `.planning/milestones/v1.6/phases/26-cockpit-question-contract/26-CONTEXT.md` lines 25-33 — 8 closed states + freshness boundaries (re-used by Phase 50) [VERIFIED: file inspection]

### Secondary (MEDIUM confidence)
- `super-gsd/workflows/mission-control.md` — operator-facing dashboard concept doc; describes intent but pre-dates v1.9 [VERIFIED: full read; older surface reference]
- `custom-gsd-extract/tmux-mission-control/mission-control/dashboard-full.sh` — pre-PowerShell shell dashboard; archive reference [VERIFIED: file exists]
- `super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1` — existing harness pattern Phase 50 extends [VERIFIED: file exists]

### Tertiary (LOW confidence)
- ASVS V8 Sensitive Data threat model for terminal renderers — derived from training, not fetched from a current source. Mitigations listed are conservative defaults; actual risk for a read-only local cockpit is low. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries exist in repo and are imported by current cockpit
- Architecture: HIGH — extends a single existing host with 3 new pane libs; data sources are public APIs in v1.9 phases that have already shipped
- Pitfalls: HIGH — 7 pitfalls grounded in code-line citations from current cockpit and v1.9 tools
- Validation architecture: HIGH — existing acceptance fixture directories already scaffolded (A1, A2, A4, A6, A7, A8 dirs exist; A3, A5 NEW)
- Security domain: MEDIUM — local-only read surface; threat model conservative but not externally validated
- Forward contracts: HIGH — Phase 41 `summarize()`, Phase 42 `runCheck()`, Phase 49 `getMemoryGovernanceSnapshot()` all verified by reading their source code AND the documenting RESEARCH.md sections that LOCKED them

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (30 days; cockpit is stable internal interface, low rot rate)
