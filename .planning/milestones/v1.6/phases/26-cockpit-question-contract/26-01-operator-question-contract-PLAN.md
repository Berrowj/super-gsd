---
schema_version: 2
phase: 26
plan: 01
title: Operator Question Contract
type: docs-only
created: 2026-04-26
expected_ATC_tier: LITE
autonomous: true
wave: 1
depends_on: []
files_modified:
  - .planning/milestones/v1.6/phases/26-cockpit-question-contract/26-01-operator-question-contract-PLAN.md
requirements:
  - REQ-26-Q1
  - REQ-26-Q2
  - REQ-26-Q3
  - REQ-26-Q4
  - REQ-26-Q5
  - REQ-26-Q6
  - REQ-26-Q7
  - REQ-26-Q8
  - REQ-26-VOCAB
  - REQ-26-FRESH
  - REQ-26-REPAIR
discuss_decisions: [26.1, 26.2, 26.3]
controlling_principle: Autonomy continues; evidence tells the truth.
must_haves:
  truths:
    - "Cockpit can answer all 8 operator questions from existing 13 metric streams"
    - "Each Q has a named primary source with file path"
    - "Each Q has applicable status states drawn from the 8 closed vocabulary"
    - "Each Q has a freshness rule whose bands cover every second (no gap)"
    - "Each Q has a mandatory repair_instruction text"
    - "A repair_command appears only when the 4-AND predicate passes"
    - "stale and unavailable are never collapsed"
  artifacts:
    - path: ".planning/milestones/v1.6/phases/26-cockpit-question-contract/26-01-operator-question-contract-PLAN.md"
      provides: "Operator question contract consumed by Phases 27-30"
      contains: "## Q1"
  key_links:
    - from: "Phase 27 (data contract)"
      to: "this PLAN.md status vocabulary + freshness table"
      via: "schema-load consumer"
    - from: "Phase 28 (mission-strip render)"
      to: "this PLAN.md Q1-Q8 source mapping"
      via: "lane-by-lane render rules"
    - from: "Phase 33 (schema-load checker)"
      to: "this PLAN.md repair-command 4-AND predicate"
      via: "disallowed-pattern matcher"
tasks:
  - id: T1
    agent: sgsd-exec-docs
    model: sonnet
    files_touched: [.planning/milestones/v1.6/phases/26-cockpit-question-contract/26-01-operator-question-contract-PLAN.md]
    input_contract:
      reads:
        - .planning/milestones/v1.6/phases/26-cockpit-question-contract/26-CONTEXT.md
        - .planning/milestones/v1.6/phases/26-cockpit-question-contract/26-RESEARCH.md
        - .planning/discussions/2026-04-26-mass-discuss.md
        - .planning/milestones/COCKPIT-2.0-SCOPE.md
    output_contract:
      writes:
        - .planning/milestones/v1.6/phases/26-cockpit-question-contract/26-01-operator-question-contract-PLAN.md
    hypothesis: "All Q1-Q8 lanes resolve to existing 13 metric streams + state files; no new telemetry needed"
    falsifier: "If any Q1-Q8 lane requires a new state file, the no-cockpit-state-file decision (DISCUSS 27.1) is wrong"
    stop_rule: "If a Q1-Q8 source cannot be named from existing files, stop and ask operator"
    minimal_test: "grep '^## Q[1-8]' 26-01-operator-question-contract-PLAN.md | wc -l == 8"
    known_deadends:
      - "Do not propose cockpit-state.json (DISCUSS 27.1=NO)"
      - "Do not propose new metric stream"
      - "Do not collapse stale and unavailable (DISCUSS 26.1)"
      - "Do not list a repair_command that fails the 4-AND predicate"
---

# Operator Question Contract (v1.6 Phase 26 deliverable)

> **Status:** locked. Phases 27, 28, 29, 30 consume this file as their authoritative
> source for status vocabulary, freshness boundaries, and repair-path discipline.
> No new telemetry stream is permitted. No `cockpit-state.json`. Cockpit derives
> state from the existing 13 metric streams every refresh (DISCUSS 27.1).
>
> The eight operator questions themselves are canonical in
> `.planning/milestones/COCKPIT-2.0-SCOPE.md` lines 33–43 — **cited, not duplicated**.

---

## Status Vocabulary (closed, 8 states)

DISCUSS 26.1 (verbatim): *"8 closed states: `active, waiting, blocked, reviewing,
timed-out, stale, complete, unavailable`. No collapse of `unavailable`↔`stale`."*

| State | Meaning | Terminal? | Typical sources |
|-------|---------|-----------|-----------------|
| `active` | Source is fresh and the question has a present-tense answer | no | live session JSONL, `activity-log.jsonl`, `STATE.md`, `codex-live.json (state=running)` |
| `waiting` | Source is reachable, mid-band freshness, no active model/tool event | no | `heartbeat.jsonl` 30–599s, `codex-live.json` 120–3599s with non-running state |
| `blocked` | Open blocker or unresolved CRIT row prevents progress | no | `STATE.md` blockers list, `crit-backlog.jsonl` rows tagged to active phase |
| `reviewing` | A reviewer (Codex / ATC / human gate) currently owns the next action | no | `codex-live.json (state=reviewing)`, ATC review files, dispatch rule 4 / 4.5 / 4.6 |
| `timed-out` | A reviewer or gate exceeded its deadline this run | yes (this run) | `codex-live.json (state=timeout)`, edge-guard log timeout rows |
| `stale` | Source exists but mtime exceeds the freshness threshold for that source | no | any source with mtime delta beyond §Freshness band |
| `complete` | Phase / step / scenario reached its successful terminal state | yes (this run) | phase status `PASS` / `PASS-WITH-DEFERRED-N`, `codex-live.json (state=ready or done)` |
| `unavailable` | The source file is missing entirely (distinct from `stale`) | no | source file does not exist on disk |

**Distinction guarantee:** `unavailable` ≠ `stale`. `unavailable` means the file
is not present on disk — repair path is to scaffold or restore. `stale` means
the file is present but its mtime exceeds the §Freshness threshold — repair
path is to refresh / restart the writer. Phase 33 schema-load checker enforces
that no Q lane collapses these into a single state.

---

## Freshness Boundaries (no gap)

DISCUSS 26.2 (verbatim): *"Closed, no gap: `<30s = active`, `30s–599s = waiting`,
`≥600s = stale`. Codex: `<120s active (running) / ≥3600s stale`. Audit-log:
`<24h fresh / ≥24h stale`."*

| Source | Active band | Mid band | Stale band |
|--------|-------------|----------|------------|
| `activity-log.jsonl` (last row mtime) | `0 ≤ Δ < 30s` → `active` | `30s ≤ Δ < 600s` → `waiting` | `Δ ≥ 600s` → `stale` |
| `heartbeat.jsonl` (last row mtime) | `0 ≤ Δ < 30s` → `active` | `30s ≤ Δ < 600s` → `waiting` | `Δ ≥ 600s` → `stale` |
| live Claude session JSONL (file mtime) | `0 ≤ Δ < 30s` → `active` | `30s ≤ Δ < 600s` → `waiting` | `Δ ≥ 600s` → `stale` |
| `codex-live.json` (file mtime) | `0 ≤ Δ < 120s` → `active(running)` | `120s ≤ Δ < 3600s` → in-band state field decides (`running`/`reviewing`/`timeout`/`ready`) | `Δ ≥ 3600s` → `stale` (overrides state field, DISCUSS 29.1) |
| `codex-log.jsonl` (last row ts) | mirrors `codex-live.json` | mirrors `codex-live.json` | mirrors `codex-live.json` |
| `crit-backlog.jsonl` (file mtime) | `Δ < 24h` → `fresh` | — | `Δ ≥ 24h` → `stale` |
| `audit-log.jsonl` (last row ts) | `Δ < 24h` → `fresh` | — | `Δ ≥ 24h` → `stale` |
| phase-folder artifacts (per-file mtime) | `Δ < 24h` → `fresh` | — | `Δ ≥ 24h` → `stale` |
| `STATE.md` | always read; no freshness band | — | — |
| `ROADMAP-AGENT.md` | operator-curated; always treated `fresh` | — | — |

**No-gap proof.**

- *Generic source* (activity / heartbeat / session JSONL): for every Δ ≥ 0,
  exactly one of `Δ < 30s`, `30s ≤ Δ < 600s`, `Δ ≥ 600s` is true.
  The bands are half-open and exhaustive — no second is unassigned.
- *Codex source*: for every Δ ≥ 0, exactly one of `Δ < 120s`,
  `120s ≤ Δ < 3600s`, `Δ ≥ 3600s` is true. The mid band defers to the
  in-file `state` field; the ≥3600s band overrides it (DISCUSS 29.1).
- *Audit-log / backlog / phase-folder*: single boundary at 24h. For every
  Δ ≥ 0, exactly one of `Δ < 24h`, `Δ ≥ 24h` is true.

Every second is assigned exactly one band for every source. No gap.

---

## Repair-Path Discipline

DISCUSS 26.3 (verbatim): *"`repair_instruction:` (text) mandatory.
`repair_command:` optional only when **deterministic AND safe AND local AND
auth-free**. Disallowed: `git push`, `rm -rf`, `curl/wget`, token-bearing
commands, `--force` flags. Schema-load checker (Phase 33) enforces."*

### 4-AND Predicate

A `repair_command` MAY appear in a Q lane iff **all four** of the following hold:

1. **Deterministic** — same inputs produce same outputs. No randomness, no
   wall-clock dependency, no remote-state sensitivity.
2. **Safe** — does not delete, force, or overwrite shared / tracked files
   beyond a single named target. No mass mutation.
3. **Local** — no network calls, no remote auth, no MCP, no provider API.
   Must succeed on a fully airgapped repo checkout.
4. **Auth-free** — no env vars carrying tokens / keys / secrets. No `gh`. No
   `git push`. No command that requires a credential to succeed.

If **any** of the four AND-conditions fails, the field is **omitted entirely**
(not set to `null`, not set to `""`). A 1-line reason follows the
`repair_instruction:` text in that Q's section.

### Disallowed-pattern list (Phase 33 schema-load checker rejects)

- `git push`, `git push --force`
- Any `--force` flag
- `rm -rf`, `rm -fr`
- `curl`, `wget`, `Invoke-WebRequest`, `Invoke-RestMethod`, any HTTP CLI
- Any command containing `$ENV:*TOKEN*`, `$ENV:*KEY*`, `$ENV:*SECRET*`
- `gh ` (GitHub CLI is auth-bearing)
- Network-bearing MCP calls (`mcp__*`)
- Destructive flags on shared / tracked files (e.g. `git checkout --` on
  multi-file globs, `git clean -fd`)

### Text-first rule

Every Q lane that can land in any non-`active` / non-`complete` state MUST
provide `repair_instruction` (string, mandatory). The text must be
operator-readable in plain English, name the file or system to act on, and
state the next concrete step. `repair_command` is the rare optional add-on,
never a replacement.

---

## Q1–Q8 Contract

The eight operator questions are sourced verbatim from
`.planning/milestones/COCKPIT-2.0-SCOPE.md` lines 33–43 (cited, not
duplicated). Each section below adds the contract fields the cockpit must
honor.

### Q1 — What is the model doing right now?

*One-line description (cited):* "Current tool/command/file the active Claude
session is running."

**Primary source(s):**

- live Claude session JSONL: `~/.claude/projects/<encoded-cwd>/*.jsonl` (mtime + last row tool name)
- `.planning/metrics/activity-log.jsonl` (last row, `tool` field)
- `.planning/metrics/heartbeat.jsonl` (last `PostToolUse` row mtime)

**Applicable status states:** `active`, `waiting`, `stale`, `unavailable`

**Freshness rule:** generic source bands per §Freshness — `<30s active`,
`30–599s waiting`, `≥600s stale` against the freshest of the three primary
sources' mtime.

**empty_state:** `unavailable` when no session JSONL is found in
`~/.claude/projects/<encoded-cwd>/` AND `activity-log.jsonl` is missing.

**repair_instruction:** "Open Claude Code on this project; the cockpit reads
its session JSONL. If a session is open and you still see `unavailable`,
verify `~/.claude/projects/` permissions."

(`repair_command` omitted — requires interactive session start; not deterministic / not local in the auth-free sense.)

### Q2 — What are we trying to complete?

*One-line description (cited):* "Active milestone + phase + objective being
worked."

**Primary source(s):**

- `.planning/STATE.md` frontmatter (`milestone`, `phase` fields)
- `.planning/ROADMAP-AGENT.md` (active phase entry — `Goal:` line)

**Applicable status states:** `active`, `complete`, `unavailable`

**Freshness rule:** `STATE.md` is always-read (no freshness band).
`ROADMAP-AGENT.md` is operator-curated (always `fresh`).

**empty_state:** `unavailable` when `STATE.md` is missing or its frontmatter
lacks both `milestone` and `phase`.

**repair_instruction:** "Run `gsd-state-init` (or its tool equivalent) to
scaffold STATE.md from ROADMAP-AGENT.md. If STATE.md exists but frontmatter
is empty, hand-edit the `milestone` and `phase` fields per the active
roadmap entry."

(`repair_command` omitted — `gsd-state-init` may not be installed locally;
the safe path is operator-confirmed scaffolding.)

### Q3 — What does completing it unlock?

*One-line description (cited):* "Next phase / capability gated by current
phase close."

**Primary source(s):**

- `.planning/ROADMAP-AGENT.md` — next phase's `Goal:` line (current phase id +1 within milestone)
- If active phase is the last in milestone → milestone close text from `.planning/milestones/<id>/MILESTONE-READINESS.md` or roadmap milestone footer

**Applicable status states:** `active`, `complete`, `unavailable`

**Freshness rule:** ROADMAP-AGENT.md is operator-curated, always `fresh`.

**empty_state:** `unavailable` when ROADMAP-AGENT.md is unreadable or has no
entry for the next phase id.

**Open derivation call (locked, RESEARCH §8.1):** When the active phase is
the last in the active milestone, the unlock string MUST be the literal
text "milestone close" (with the milestone id appended). The cockpit MUST
NOT cross-read into the next milestone's roadmap entries at this layer.
Cross-milestone derivation is explicitly out of scope.

**repair_instruction:** "ROADMAP-AGENT.md is unreadable — restore from git
history with `git log -- .planning/ROADMAP-AGENT.md` to find the last good
commit, then hand-restore the file from that revision."

(`repair_command` omitted — automatic restore would require `git checkout
--` which is on the disallowed-pattern list for shared tracked files.)

### Q4 — What is blocked or risky?

*One-line description (cited):* "Open blockers + open `CRIT-BACKLOG.md`
rows tagged to active phase."

**Primary source(s):**

- `.planning/STATE.md` blockers list (frontmatter or body, per project convention)
- `.planning/metrics/crit-backlog.jsonl` (canonical, Patch 2) — rows where
  `tagged_for_milestone` matches active milestone OR `phase` matches active
  phase, AND latest row per `id` is not `kind: cleared`

**Applicable status states:** `blocked`, `active`, `stale`, `unavailable`

**Freshness rule:** `crit-backlog.jsonl` uses the audit-log band — `<24h
fresh`, `≥24h stale`. STATE.md is always-read.

**empty_state:** `unavailable` when `crit-backlog.jsonl` is missing entirely
AND `STATE.md` has no blockers section.

**repair_instruction:** "If state is `blocked`, read the open blocker in
STATE.md or the matching row in `.planning/CRIT-BACKLOG.md`, then clear or
escalate per dispatch rule 0.5. If state is `stale`, the backlog has not
been re-rendered recently — refresh the markdown view."

**repair_command** (state=`stale` only): `node super-gsd/scripts/lib/crit-backlog.cjs --render`

*Predicate verification (state=stale lane only):* deterministic (reads JSONL,
emits markdown — no randomness), safe (writes only `.planning/CRIT-BACKLOG.md`,
a single named render target), local (no network), auth-free (no env tokens,
no `gh`, no `git push`). All four AND-conditions pass.

### Q5 — Which agents were used and what did each do?

*One-line description (cited):* "Sub-agents dispatched in current phase +
their last status/artifact."

**Primary source(s):**

- `.planning/metrics/activity-log.jsonl` rows where `tool ∈ {TaskCreate, Agent}` AND `phase` field matches active phase (Phase 28's stamper writes the `phase` field per DISCUSS 27.2)
- `.planning/resource-registry/agents.jsonl` for agent role/name resolution

**Applicable status states:** `active`, `waiting`, `stale`, `complete`, `unavailable`

**Freshness rule:** `activity-log.jsonl` generic bands. Agents pane is
**current-phase-scoped** per DISCUSS 29.2 — global last-6h scope is removed.

**empty_state:** `unavailable` when no `activity-log.jsonl` rows for the
active phase exist (typical pre-Phase-28 state — the stamper has not yet
fired).

**Open derivation call (locked, RESEARCH §8.2):** When `activity-log.jsonl`
rows exist but none carry a `phase` stamp (pre-Phase-28 history rows), the
lane MUST render `unavailable`. **No path-based derivation fallback** —
DISCUSS 27.2 forbids it. Pre-stamp rows simply do not surface in the
current-phase agents lane.

**repair_instruction:** "If state is `unavailable` and the run is post-Phase-28,
verify the orchestrator stamper is firing — check `.planning/metrics/activity-log.jsonl`
for any row carrying a `phase` field. If state is `stale`, the active phase
is idle for ≥10 minutes — operator should resume or checkpoint."

(`repair_command` omitted — agent dispatch is provider-bound and auth-bearing.)

### Q6 — What is Codex doing or what did it conclude?

*One-line description (cited):* "Codex run state + verdict + report path."

**Primary source(s):**

- `.planning/metrics/codex-live.json` (`state` field + file mtime)
- `.planning/metrics/codex-log.jsonl` (history rows for verdict and report path)
- Codex review report files referenced by `codex-live.json.report_path` when present

**Applicable status states:** `active`, `reviewing`, `timed-out`, `complete`, `stale`, `unavailable`

**Freshness rule:** Codex bands per §Freshness — `<120s active(running)`,
`120–3599s` defers to `state` field, `≥3600s stale` (overrides state field
per DISCUSS 29.1).

**empty_state:** `unavailable` when `codex-live.json` does not exist.

**repair_instruction:** "If state is `timed-out`, retry the Codex review at
the next tier (or fall back to Claude-only reviewer per the dual-provider
contract). If state is `stale`, the Codex worker is likely dead — restart
via `super-gsd/scripts/sgsd-codex-monitor.ps1` (operator confirms before
running)."

(`repair_command` omitted — Codex retries are provider-bound and
auth-bearing; Codex monitor restart requires operator-confirmed
script invocation, which is interactive, not deterministic.)

### Q7 — What evidence/artifacts were produced?

*One-line description (cited):* "Phase-folder artifacts (RESEARCH/CONTEXT/
PLAN/VERIFICATION/ATC-REVIEW) + key logs."

**Primary source(s):**

- Phase folder enumeration: `.planning/milestones/<milestone>/phases/<phase-id>-*/`
  checking presence of `<NN>-RESEARCH.md`, `<NN>-CONTEXT.md`,
  `<NN>-<plan-id>-PLAN.md`, `<NN>-VERIFICATION.md`, `<NN>-ATC-REVIEW.md`
- `.planning/metrics/audit-log.jsonl` for evidence-event history
- `git log` for recent commits touching the phase folder

**Applicable status states:** `active`, `complete`, `stale`, `unavailable`

**Freshness rule:** per-file mtime, audit-log band — `<24h fresh`, `≥24h stale`.

**empty_state:** `unavailable` when the phase folder itself does not exist.

**repair_instruction:** "If a required artifact is missing, re-dispatch the
step that produces it (e.g., `gsd-phase-researcher` for RESEARCH.md;
`gsd-planner` for PLAN.md). If state is `stale`, the phase has been open
≥24h with no artifact updates — operator should resume or close."

(`repair_command` omitted — agent re-dispatch is provider-bound and
auth-bearing.)

### Q8 — What should happen next?

*One-line description (cited):* "Next dispatch under the orchestrator's
dispatch rules + relevant repair path."

**Primary source(s):**

- `CLAUDE.md` "Dispatch Rules (first match wins)" table — the canonical
  decision tree
- Current phase artifact state (Q7 enumeration result) — feeds the rule match
- `.planning/metrics/heartbeat.jsonl` (for stall detection)
- Open repair path from any failed gate (Q4/Q6/Q7 lanes feed in)

**Applicable status states:** `active`, `waiting`, `blocked`, `reviewing`, `unavailable`

**Freshness rule:** generic source bands against `heartbeat.jsonl` mtime.

**empty_state:** `unavailable` when CLAUDE.md is unreadable OR no rule
matches the current phase artifact state.

**Open derivation call (locked, RESEARCH §8.3):** When the dispatch rules
table produces multiple matches, the cockpit MUST apply **first-match-wins**
precedence (lowest rule number wins). This mirrors CLAUDE.md "Dispatch
Rules (first match wins)" semantics, which are already canonical for the
orchestrator.

**repair_instruction:** "If state is `waiting` and heartbeat is stale, the
orchestrator may have stalled — read `.planning/ORCHESTRATOR-CHECKPOINT.md`
and resume per its `next_unit`. If state is `unavailable`, no dispatch rule
matched — the phase is in an unexpected state; checkpoint and inspect
manually."

(`repair_command` omitted — resuming requires operator decision; not
deterministic.)

---

## Architectural Responsibility Map

Per RESEARCH §7. The Mission Strip is a **derived view** over the existing
13 metric streams, not a new data plane. Detail panes (`sgsd-narrative.ps1`,
`sgsd-codex-monitor.ps1`) remain authoritative for raw streams; the strip
surfaces and links.

| Capability | Owner (after Phase 28) | Existing owner today | Rationale |
|------------|------------------------|----------------------|-----------|
| Q1 model activity (1-line summary) | Mission Strip top | sgsd-narrative pane (full stream) | Strip surfaces; narrative provides detail |
| Q2 objective | Mission Strip | mission-control header | Move to strip; remove duplicate header line |
| Q3 unlock | Mission Strip | (missing today) | New derivation, no new data |
| Q4 blocker / risk | Mission Strip | mission-control blocker row | Promote from row 6 to strip |
| Q5 agents (current-phase scoped) | mission-control body pane | mission-control flat list | Re-scope using DISCUSS 27.2 phase-stamp |
| Q6 Codex (1-line) | Mission Strip | sgsd-codex-monitor pane (full) | Strip 1-line link; full pane unchanged |
| Q7 evidence | mission-control body pane | scattered | Single grouped lane |
| Q8 next action | Mission Strip bottom | (missing today) | Derived from orchestrator rule-match |

Mission Strip = 6 lines, top of `sgsd-mission-control.ps1`, replacing the
existing 1-line header (DISCUSS 28.1, 28.2). Narrative + Codex panes stay
intact and authoritative for detail. No body lane duplicates a strip lane.

---

## Open Derivation Calls (locked recommendations)

Three minor precedence calls, locked as recommendations per RESEARCH §8.
The planner consumes them; no operator re-ask required.

1. **Q3 unlock when active phase is last in milestone** — render literal
   "milestone close" (with milestone id). Do not cross-read into next
   milestone. (RESEARCH §8.1 Recommendation b.)
2. **Q5 fallback when phase-stamp absent (pre-Phase-28 rows)** — render
   `unavailable`. Do not path-derive. (RESEARCH §8.2 Recommendation a;
   matches DISCUSS 27.2 prohibition on path-based derivation.)
3. **Q8 rule-match precedence** — first-match-wins. (RESEARCH §8.3;
   mirrors CLAUDE.md "Dispatch Rules (first match wins)" canonical
   semantics.)

---

## Acceptance Criteria (runnable)

The verifier (Step 8 of Phase 26) MUST run these checks. All must pass for
the phase to close `PASS` (or `PASS-WITH-DEFERRED-N` if Codex live-auth is
unavailable per CONTEXT.md).

1. **File exists.**
   `test -f .planning/milestones/v1.6/phases/26-cockpit-question-contract/26-01-operator-question-contract-PLAN.md`

2. **Schema version present.**
   `grep -q '^schema_version: 2' 26-01-operator-question-contract-PLAN.md`

3. **Tasks block valid.**
   `grep -q '^tasks:$' 26-01-operator-question-contract-PLAN.md` AND
   `grep -q '^  - id: T1$' 26-01-operator-question-contract-PLAN.md`

4. **All 8 Q sections present.**
   `[ "$(grep -c '^### Q[1-8] ' 26-01-operator-question-contract-PLAN.md)" -eq 8 ]`
   (matches `### Q1 `, `### Q2 ` … `### Q8 `.)

5. **Status vocabulary section present with 8 states.**
   `grep -q '^## Status Vocabulary' 26-01-operator-question-contract-PLAN.md` AND
   the 8 states (`active`, `waiting`, `blocked`, `reviewing`, `timed-out`,
   `stale`, `complete`, `unavailable`) each appear in the vocabulary
   table column 1.

6. **Freshness table no-gap.**
   `grep -q '^## Freshness Boundaries' 26-01-operator-question-contract-PLAN.md` AND
   the `## Freshness Boundaries` section contains a `**No-gap proof.**`
   subsection that names all three source classes (generic, Codex,
   audit-log/backlog/phase-folder).

7. **Repair predicate enumerated.**
   `grep -q '^### 4-AND Predicate' 26-01-operator-question-contract-PLAN.md` AND
   the four conditions (deterministic, safe, local, auth-free) each appear
   as numbered items in the 4-AND section.

8. **Disallowed pattern list present.**
   `grep -q '^### Disallowed-pattern list' 26-01-operator-question-contract-PLAN.md` AND
   the list contains at minimum: `git push`, `rm -rf`, `curl`, `wget`,
   `--force`, `gh `, `mcp__`, `*TOKEN*`.

9. **Each Q has the five mandatory sub-fields.**
   For every Q1–Q8 section, the section body contains the substrings
   `**Primary source(s):**`, `**Applicable status states:**`,
   `**Freshness rule:**`, `**empty_state:**`, and `**repair_instruction:**`.

10. **No `repair_command: null` patterns.**
    `! grep -E 'repair_command:\s*(null|"")' 26-01-operator-question-contract-PLAN.md`
    (Disallowed predicate-failed commands are omitted entirely with a
    1-line reason, never set to null.)

11. **`stale` and `unavailable` are not collapsed.**
    The Status Vocabulary table contains separate rows for `stale` and
    `unavailable` with distinct `Meaning` columns. Phase 33 schema-load
    checker reuses this assertion at runtime.

12. **DISCUSS 26.1, 26.2, 26.3 cited verbatim.**
    The strings `DISCUSS 26.1`, `DISCUSS 26.2`, and `DISCUSS 26.3` each
    appear at least once in the contract body.

13. **COCKPIT-2.0-SCOPE.md cited, not duplicated.**
    `grep -q 'COCKPIT-2.0-SCOPE.md' 26-01-operator-question-contract-PLAN.md`
    AND the contract MUST NOT contain a verbatim numbered list 1–8 of the
    operator questions. (Citation only — the canonical list lives in
    `.planning/milestones/COCKPIT-2.0-SCOPE.md` lines 33–43.)

14. **Open derivation calls (3) recorded.**
    `grep -q '^## Open Derivation Calls' 26-01-operator-question-contract-PLAN.md`
    AND the section contains exactly 3 numbered items covering Q3 last-phase
    unlock, Q5 pre-stamp fallback, and Q8 rule-match precedence.

15. **Architectural Responsibility Map present.**
    `grep -q '^## Architectural Responsibility Map' 26-01-operator-question-contract-PLAN.md`
    AND the table assigns an owner (Mission Strip vs. body pane vs. existing
    pane) for each of Q1–Q8.
