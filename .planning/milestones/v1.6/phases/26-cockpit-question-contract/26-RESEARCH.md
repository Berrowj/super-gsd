---
phase: 26
title: Cockpit Operator Question Contract — Research
type: docs-only
researched: 2026-04-26
domain: terminal cockpit / operator question contract
confidence: HIGH
discuss_decisions: 26.1, 26.2, 26.3
controlling_principle: Autonomy continues; evidence tells the truth.
---

# Phase 26 — Cockpit Operator Question Contract — Research

**Goal restated:** Define WHAT the cockpit must answer (8 operator questions),
with closed status vocabulary, freshness boundaries (no gap), and repair-path
discipline. This is a contract phase. No code. Phases 27–30 consume the
contract.

## User Constraints (from DISCUSS 26.1–26.3 + ROADMAP-AGENT.md)

### Locked Decisions

- **26.1 Status vocabulary** — exactly 8 closed states:
  `active, waiting, blocked, reviewing, timed-out, stale, complete, unavailable`.
  No collapse of `unavailable` and `stale`. [VERIFIED: discussions/2026-04-26-mass-discuss.md L168]
- **26.2 Freshness boundaries (no gap)** —
  - Generic source: `<30s = active`, `30s–599s = waiting`, `≥600s = stale`
  - Codex (`codex-live.json` mtime): `<120s = active(running)`, `≥3600s = stale`
  - Audit-log: `<24h = fresh`, `≥24h = stale` [VERIFIED: discuss L169]
- **26.3 `repair_command` field** — optional alongside mandatory
  `repair_instruction:` text. Allowed only if **deterministic AND safe AND
  local AND auth-free**. Disallowed: `git push`, `rm -rf`, `curl`/`wget`,
  token-bearing commands, `--force` flags, destructive flags on shared files.
  Schema-load checker rejects offending commands. [VERIFIED: discuss L170]
- **27.1 NO `cockpit-state.json`** — cockpit derives state from the existing 13
  metric streams every refresh. No new state file. [VERIFIED: discuss L171]
- **27.2 phase-stamping** — orchestrator stamps phase ID into every
  `activity-log.jsonl` row (Phase 28 implements). [VERIFIED: discuss L172]

### Out of scope

- New telemetry streams — forbidden unless an unanswered Q1–Q8 demands it
  [VERIFIED: EXISTING-SURFACE-AUDIT.md "Kill / Defer Conditions"]
- Web dashboard work — explicit non-goal
- Always-on LLM summarization
- Code changes (Phase 26 is docs-only; Phase 28 lands lib + edits)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-26-Q1..Q8 | Each of 8 operator questions has source, freshness rule, empty-state, repair_instruction (and optional repair_command) | §1–§5 below |
| REQ-26-VOCAB | 8 closed status values documented | §4 |
| REQ-26-FRESH | No gap in freshness boundaries | §5 |
| REQ-26-REPAIR | Repair-path discipline documented; safety predicate enumerated | §6 |

## Summary

The Mission Strip is a **derived view over existing telemetry**, not a new
data plane. All 8 operator questions resolve to existing sources today —
five are already partially rendered by `sgsd-mission-control.ps1`,
`sgsd-narrative.ps1`, and `sgsd-codex-monitor.ps1`. The gaps are
**ordering, labeling, freshness normalization, and explicit unlock + next-action
fields** — not raw signal.

**Primary recommendation:** Cockpit answers Q1–Q8 by composing existing logs:
`activity-log.jsonl`, `codex-live.json`, `codex-log.jsonl`,
`heartbeat.jsonl`, `STATE.md` frontmatter, `ROADMAP.md`, `CRIT-BACKLOG.md`,
phase-folder file presence, and the live Claude session JSONL. Repair paths
ship as text by default; commands only when they pass the 26.3 safety
predicate.

## 1. The Eight Operator Questions (Q1–Q8)

Sourced verbatim from `COCKPIT-2.0-SCOPE.md` (mission section, lines 33–43)
and `VIO-ROADMAP-ENRICHMENT.md` (lines 184–193). [CITED: COCKPIT-2.0-SCOPE.md]

| # | Question | One-line description |
|---|----------|----------------------|
| Q1 | What is the model doing right now? | Current tool/command/file the active Claude session is running |
| Q2 | What are we trying to complete? | Active milestone + phase + objective being worked |
| Q3 | What does completing it unlock? | Next phase / capability gated by current phase close |
| Q4 | What is blocked or risky? | Open blockers + open `CRIT-BACKLOG.md` rows tagged to active phase |
| Q5 | Which agents were used and what did each do? | Sub-agents dispatched in current phase + their last status/artifact |
| Q6 | What is Codex doing or what did it conclude? | Codex run state + verdict + report path |
| Q7 | What evidence/artifacts were produced? | Phase-folder artifacts (RESEARCH/CONTEXT/PLAN/VERIFICATION/ATC-REVIEW) + key logs |
| Q8 | What should happen next? | Next dispatch under the orchestrator's dispatch rules + relevant repair path |

## 2. Current-Source Mapping (per Q)

Cross-checked against `EXISTING-SURFACE-AUDIT.md` (current Q1–Q8 coverage
table) and `sgsd-mission-control.ps1` source. [VERIFIED: file inspection]

| Q | Primary source(s) | Where in code (file/function) | Coverage |
|---|-------------------|-------------------------------|----------|
| Q1 | live Claude session JSONL (`~/.claude/projects/<encoded>/*.jsonl`); `activity-log.jsonl` (last tool); `heartbeat.jsonl` (last tool end) | `sgsd-mission-control.ps1` `Get-InferenceState` (L877) + `Get-Heartbeat` (L900); `sgsd-narrative.ps1` live tool stream | partial — exists but in narrative pane, not Mission Strip |
| Q2 | `.planning/STATE.md` frontmatter (milestone, phase); `ROADMAP-AGENT.md` (phase goal) | `Get-StateInfo` + `Get-RoadmapPhases` (mission-control L1007–L1010) | partial — labels missing ("phase X" not "objective: …") |
| Q3 | `ROADMAP-AGENT.md` phase dependencies (`Dependencies: 26 → 27 → …`); milestone phase order | not currently rendered in cockpit | **missing** — derive from `Dependencies:` lines or next phase entry |
| Q4 | `STATE.md` blockers list; `.planning/CRIT-BACKLOG.md` rows tagged to phase; `crit-backlog.jsonl` (canonical) | `Get-StateBlockers` (L470–L482); mission-control L1188–L1193 | partial — STATE blockers shown; backlog row count not surfaced in strip |
| Q5 | `activity-log.jsonl` rows (`tool ∈ {TaskCreate, Agent}`); `agents.jsonl`; narrative tool stream | `Get-AgentRoster` (L822) — already filters last 6h | partial — flat list; not scoped to current phase (29.2 fixes) |
| Q6 | `.planning/metrics/codex-live.json` (state); `codex-log.jsonl` (history); Codex report paths | `sgsd-codex-monitor.ps1` (full pane, separate); mission-control summarizes via `Get-CodexCommitCount` | implemented as separate pane — strip needs 1-line summary + link |
| Q7 | phase-folder file presence (RESEARCH/CONTEXT/PLAN/VERIFICATION/ATC-REVIEW.md); `audit-log.jsonl`; recent commits | folder enumeration via `Get-ActivePhaseDir`; commits via `Get-RecentCommits` (L585) | partial — links scattered; no explicit "evidence summary" lane |
| Q8 | orchestrator dispatch rules (CLAUDE.md "Dispatch Rules" table); next pending phase artifact; open repair path from any failed gate | not currently rendered as a single field | **missing** — derive from rule-match against current phase artifact state |

## 3. Coverage Gaps (concrete, per Q)

- **Q3 (unlock):** No `unlock_text` field exists anywhere. Must be derived
  every refresh by reading the next phase's goal from `ROADMAP-AGENT.md`
  (or the milestone end-state if active phase is the last in the milestone).
  No new file; derivation only.
- **Q4 (blocked):** Mission-control reads `STATE.md` blockers but does NOT
  read `crit-backlog.jsonl` for rows tagged to the active phase. Strip must
  surface a count when `unresolvedRows.filter(r => r.phase === active).length > 0`.
- **Q5 (agents scoped):** `Get-AgentRoster` returns last 6h globally. DISCUSS
  29.2 locks "current phase only" — requires the 27.2 phase-stamp on
  activity-log rows (Phase 28 dependency).
- **Q7 (evidence):** No single function answers "what artifacts has this
  phase produced?" Must enumerate `{NN}-RESEARCH.md`, `{NN}-CONTEXT.md`,
  `{NN}-{plan-id}-PLAN.md`, `{NN}-VERIFICATION.md`, `{NN}-ATC-REVIEW.md` and
  report `present | missing` (and per-artifact mtime for freshness).
- **Q8 (next action):** No `next_action` field. Derivation: orchestrator
  dispatch-rule-match against current phase artifact state (e.g., RESEARCH
  missing → "dispatch gsd-phase-researcher").

## 4. Status Vocabulary Mapping (per Q × 8 closed states)

DISCUSS 26.1: 8 closed states. **No `unavailable` / `stale` collapse.**
`unavailable` = source file missing entirely. `stale` = source exists but
mtime is over the threshold. Distinct semantics; distinct repair paths.

| Q | Applicable states |
|---|-------------------|
| Q1 (model) | `active` (session JSONL <30s), `waiting` (30–599s), `stale` (≥600s), `unavailable` (no session JSONL found) |
| Q2 (objective) | `active` (state.md fresh), `complete` (phase status=PASS), `unavailable` (state.md missing) |
| Q3 (unlock) | `active` (next phase resolved), `complete` (no next phase — milestone-end), `unavailable` (roadmap unreadable) |
| Q4 (blocked) | `blocked` (any open blocker or unresolved CRIT row tagged to phase), `active` (none), `stale` (backlog mtime >24h with rows still open), `unavailable` (backlog file missing) |
| Q5 (agents) | `active` (≥1 agent dispatched in last 5m for this phase), `waiting` (5–15m), `stale` (≥15m), `complete` (phase verified), `unavailable` (activity-log missing/no phase-stamped rows yet) |
| Q6 (codex) | `active` (codex-live.json state=running, mtime <120s), `reviewing` (state=reviewing), `timed-out` (state=timeout), `complete` (state=ready/done), `stale` (mtime ≥3600s regardless of state — DISCUSS 29.1), `unavailable` (codex-live.json missing) |
| Q7 (evidence) | `active` (any required artifact file present, accumulating), `complete` (all 5 required artifacts present + verified), `stale` (any artifact older than 24h while phase still open), `unavailable` (phase folder missing) |
| Q8 (next) | `active` (dispatch rule matched, next action resolved), `waiting` (no rule match — heartbeat stale), `blocked` (a blocker prevents next dispatch), `reviewing` (Codex/ATC currently owns the next step), `unavailable` (orchestrator state unreadable) |

States `complete` and `timed-out` are terminal (this run). All others are
transient.

## 5. Freshness Boundaries (no gap, per primary source)

DISCUSS 26.2 — closed boundaries, no gap. [VERIFIED: discuss L169]

| Source | <fresh threshold | mid-band | stale threshold |
|--------|-----------------:|----------|----------------:|
| `STATE.md` | n/a (always read) | n/a | n/a — file always represents current truth |
| `activity-log.jsonl` (last tool row) | `<30s = active` | `30–599s = waiting` | `≥600s = stale` |
| `heartbeat.jsonl` (last PostToolUse) | `<30s = active` | `30–599s = waiting` | `≥600s = stale` |
| live Claude session JSONL (mtime) | `<30s = active` | `30–599s = waiting` | `≥600s = stale` |
| `codex-live.json` (mtime) | `<120s = active(running)` | `120–3599s = waiting/reviewing per state field` | `≥3600s = stale` (DISCUSS 29.1) |
| `codex-log.jsonl` (last row ts) | mirrors codex-live | — | mirrors codex-live |
| `crit-backlog.jsonl` (file mtime) | `<24h = fresh` | — | `≥24h = stale` (audit-log rule, DISCUSS 26.2) |
| `audit-log.jsonl` (last row ts) | `<24h = fresh` | — | `≥24h = stale` |
| phase-folder artifacts (mtime per file) | `<24h = fresh` | — | `≥24h = stale` |
| `ROADMAP-AGENT.md` (file mtime) | always treated `fresh` (operator-curated) | — | n/a |

**No-gap proof:** Generic source: 0–29s active, 30–599s waiting, ≥600s stale.
Every second is assigned exactly one band. Codex: 0–119s active, 120–3599s
the in-band state field decides (`running`/`reviewing`/`timeout`/`ready`),
≥3600s stale overrides regardless of state-field. Audit/backlog: 0 to <24h
fresh, ≥24h stale — single boundary, no gap.

## 6. Repair-Path Discipline (DISCUSS 26.3)

### 6.1 Mandatory text + optional command

Every Q1–Q8 lane that can land in a non-`active`/`complete` state MUST have:
- `repair_instruction:` (string, mandatory) — operator-readable next step
- `repair_command:` (string, optional) — only if it satisfies ALL four
  predicates below

### 6.2 Safety predicate (the four AND-conditions)

A `repair_command` is allowed iff:
1. **Deterministic** — same inputs → same outputs; no randomness, no
   wall-clock dependency, no remote-state sensitivity
2. **Safe** — does not delete, force, or overwrite shared/tracked files
   beyond a single, named target
3. **Local** — no network calls, no remote auth, no MCP, no provider API
4. **Auth-free** — no env vars carrying tokens, no `gh`, no `git push`, no
   any command that requires a credential to succeed

### 6.3 Disallowed (schema-load checker rejects)

Pattern matchers in the Phase 33 checker (referenced here so cockpit author
knows the exact list):

- `git push`, `git push --force`, any `--force` flag
- `rm -rf`, `rm -fr`
- `curl`, `wget`, `Invoke-WebRequest`, `Invoke-RestMethod`, any HTTP CLI
- Any command containing `$ENV:*TOKEN*`, `$ENV:*KEY*`, `$ENV:*SECRET*`
- `gh ` (GitHub CLI is auth-bearing)
- Network-bearing MCP calls (`mcp__*`)

### 6.4 Per-Q repair-path examples (text + optional command)

| Q | When | repair_instruction (text) | repair_command (optional, safety-passed) |
|---|------|--------------------------|------------------------------------------|
| Q1 | `unavailable` | "Open Claude Code on this project; the cockpit reads its session JSONL." | (none — requires interactive session start) |
| Q1 | `stale` | "Inference is stuck — checkpoint and restart the orchestrator session." | (none — requires operator decision) |
| Q2 | `unavailable` | "Run `gsd-state-init` to scaffold STATE.md from ROADMAP." | `node super-gsd/tools/state-init/init.cjs` (if such tool exists; otherwise none) |
| Q3 | `unavailable` | "ROADMAP-AGENT.md is unreadable — restore from git: `git checkout -- .planning/ROADMAP-AGENT.md`." | (none — destructive flag class disallowed) |
| Q4 | `blocked` | "Read open blocker in STATE.md; clear or escalate per dispatch rule 0.5." | (none — requires judgment) |
| Q4 | `stale` | "Backlog hasn't been updated; render: `node super-gsd/scripts/lib/crit-backlog.cjs --render`." | `node super-gsd/scripts/lib/crit-backlog.cjs --render` ✅ (deterministic, safe, local, auth-free) |
| Q5 | `unavailable` | "activity-log.jsonl missing or no phase-stamped rows yet — Phase 28 stamper hasn't fired." | (none) |
| Q6 | `timed-out` | "Codex timed out at tier T; retry with `--codex-tier next` or fall back to Claude reviewer." | (none — invokes provider with auth) |
| Q6 | `stale` | "codex-live.json is older than 1h — Codex worker likely dead. Restart: `super-gsd/scripts/sgsd-codex-monitor.ps1`." | (none — script invocation requires user-confirm) |
| Q7 | any artifact missing | "Re-dispatch the missing step (e.g., gsd-phase-researcher for RESEARCH.md)." | (none — agent dispatch is provider-bound) |
| Q8 | `waiting` (heartbeat stale) | "Orchestrator may have stalled — read .planning/ORCHESTRATOR-CHECKPOINT.md and resume." | (none — operator decision) |

**Net:** of 11 repair scenarios above, exactly **1** ships with a safe
`repair_command` (Q4-stale → backlog re-render). This matches the design:
text-default, command-rare. Phase 33 will formalize the checker; Phase 26
just commits to the contract.

## 7. Architectural Responsibility Map (Mission Strip vs. existing panes)

| Capability | Owner (after Phase 28) | Existing owner today | Rationale |
|------------|------------------------|----------------------|-----------|
| Q1 model activity (1-line summary) | Mission Strip top | sgsd-narrative pane (full stream) | Strip surfaces; narrative provides detail |
| Q2 objective | Mission Strip | mission-control header | Move to strip; remove duplicate header line |
| Q3 unlock | Mission Strip | (missing) | New derivation, no new data |
| Q4 blocker/risk | Mission Strip | mission-control blocker row | Promote from row 6 to row 1 (strip) |
| Q5 agents (current-phase scoped) | mission-control body pane | mission-control flat list | Re-scope using 27.2 phase-stamp |
| Q6 Codex (1-line) | Mission Strip | sgsd-codex-monitor pane (full) | Strip 1-line link; full pane unchanged |
| Q7 evidence | mission-control body pane | scattered | Single grouped lane |
| Q8 next action | Mission Strip bottom | (missing) | Derived from orchestrator rule-match |

Mission Strip = 6 lines, top of `sgsd-mission-control.ps1`, replacing the
existing 1-line header (DISCUSS 28.1, 28.2). Narrative + Codex panes stay
intact and authoritative for detail.

## 8. Open Questions for the Planner

Locked decisions cover 26.1/26.2/26.3 — open questions are minimal:

1. **Q3 derivation precedence when active phase is last in milestone.**
   Options: (a) show milestone unlock from next milestone's goal,
   (b) show "milestone close" as the unlock. Recommendation: (b) — simpler,
   no cross-milestone read at this layer.
2. **Q5 fallback when phase-stamp absent (pre-Phase-28 rows).**
   Options: (a) show `unavailable`, (b) fall back to path-based derivation.
   Recommendation: (a) — matches DISCUSS 27.2 ("path-based derivation
   removed"). Pre-stamp rows simply do not surface.
3. **Q8 rule-match precedence when multiple rules match.**
   Recommendation: first-match-wins (matches CLAUDE.md "Dispatch Rules
   (first match wins)" semantics — already canonical).

These are recommendations, not blockers. Planner can land them in
26-CONTEXT.md or 26-01-PLAN.md without re-asking the operator.

## 9. Kill / Defer Conditions for Phase 26

Per `EXISTING-SURFACE-AUDIT.md` "Kill / Defer Conditions":

- **Defer** if any Q1–Q8 cannot be answered from the existing 13 metric
  streams. (Likely: none — Q3/Q8 are derivations, not data gaps.)
- **Kill** if DISCUSS 26.1–26.3 decisions need to change (would require
  re-discussion).
- **Halt** (hard stop) only if operator approval is required to commit a
  contract decision the discuss artifact does not cover. None foreseen.

## 10. Architecture Patterns To Follow

- **Derivation, not duplication** — every Q1–Q8 lane is a pure function of
  the existing 13 metric streams + `STATE.md` + roadmap files. No new state
  file (DISCUSS 27.1).
- **First-match-wins state resolution** — for each Q, evaluate states in
  the order listed in §4. First match is the surface state.
- **mtime is the freshness substrate** — every freshness check is a
  file-mtime delta against the boundary table in §5. No application-level
  timestamps unless a JSONL row's `ts` is more authoritative (Codex uses both).
- **Text-first repair** — always provide `repair_instruction:`; only add
  `repair_command:` when the 4-AND predicate passes.
- **No collapse of `unavailable` and `stale`** — they have distinct repair
  paths and distinct semantics (file missing vs. file too old).

## 11. Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cockpit state cache | `cockpit-state.json` | Per-refresh derivation from 13 streams | DISCUSS 27.1 NO |
| Repair-command safety | Cockpit-side allow/deny list | Phase 33 schema-load checker | One source of truth |
| Phase-stamp on activity-log | Path-derivation fallback in cockpit | Phase 28 orchestrator-side stamper | DISCUSS 27.2 |
| Agent roster scoping | New agent state file | Reuse `activity-log.jsonl` filtered by stamped phase | Existing log already covers this |
| Next-action derivation | New `next_action.json` | Match against CLAUDE.md dispatch rules | Rules are already canonical |

## 12. Common Pitfalls

1. **Collapsing `stale` and `unavailable`** — file-missing vs. file-too-old
   have different repair paths. DISCUSS 26.1 explicitly forbids the collapse.
2. **Adding a `repair_command` that requires auth** — fails the 26.3
   predicate. Use text-only for any auth-bearing repair.
3. **Deriving phase from path before Phase 28 stamps activity-log** — the
   stamper IS the canonical source post-Phase-28; pre-stamp rows surface
   `unavailable`, not a guess.
4. **Rendering Codex `running` when mtime is ≥1h old** — DISCUSS 29.1
   demotes to `stale` regardless of the state field.
5. **Reading the rendered `CRIT-BACKLOG.md`** — the canonical source is
   `crit-backlog.jsonl` (Patch 2). Markdown is a render only.

## Assumptions Log

All claims in this research are either VERIFIED against the discuss
artifact, ROADMAP-AGENT.md, EXISTING-SURFACE-AUDIT.md, or
sgsd-mission-control.ps1 source — or CITED from COCKPIT-2.0-SCOPE.md.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "session JSONL freshness uses generic 30s/600s thresholds" | §5 | LOW — DISCUSS 26.2 sets generic rule; session JSONL is the only consumer where this matters. If wrong, planner can override in 26-CONTEXT. |
| A2 | "Q3 unlock derives from next phase's goal in ROADMAP-AGENT.md" | §3, §8 | LOW — if planner prefers milestone-level unlock, it's a 1-line CONTEXT change. |
| A3 | "Q8 next-action uses CLAUDE.md dispatch rules" | §3, §10 | LOW — these rules ARE canonical for the orchestrator; cockpit reading them is read-only. |

Empty-otherwise.

## Sources

### Primary (HIGH)
- `.planning/discussions/2026-04-26-mass-discuss.md` — DISCUSS 26.1, 26.2, 26.3, 27.1, 27.2, 29.1
- `.planning/ROADMAP-AGENT.md` — Phase 26 entry (lines 156–180)
- `.planning/milestones/COCKPIT-2.0-SCOPE.md` — operator questions + lane contracts
- `.planning/milestones/v1.6/EXISTING-SURFACE-AUDIT.md` — current Q1–Q8 coverage
- `super-gsd/scripts/sgsd-mission-control.ps1` — direct file read, lines 470, 540–582, 822–869, 877–891, 900–908, 1027–1070, 1188–1193

### Secondary (HIGH, audit-derived)
- `.planning/milestones/HANDBOOK-FUTURE-IMPLEMENTATION-AUDIT.md` — duplicate-risk inventory
- `.planning/milestones/VIO-ROADMAP-ENRICHMENT.md` — operator-design rules
- `super-gsd/scripts/sgsd-codex-monitor.ps1` — Codex freshness convention (1h)

### No external/web sources used
This is an internal contract phase. Context7/WebSearch were not required —
all sources are repo-internal and authoritative.

## Metadata

**Confidence breakdown:**
- Q1–Q8 enumeration: HIGH — verbatim from COCKPIT-2.0-SCOPE.md
- Source mapping: HIGH — verified against mission-control.ps1 source
- Status vocabulary: HIGH — DISCUSS 26.1 locked
- Freshness boundaries: HIGH — DISCUSS 26.2 locked, no-gap proof in §5
- Repair discipline: HIGH — DISCUSS 26.3 locked, predicate enumerated
- Open questions: MEDIUM — three minor derivation-precedence calls

**Research date:** 2026-04-26
**Valid until:** Phase 26 close (no external dependencies — internal contract)
