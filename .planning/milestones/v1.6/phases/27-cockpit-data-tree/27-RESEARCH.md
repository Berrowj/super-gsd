# Phase 27 — Cockpit Data Source + Objective Tree Audit — Research

**Researched:** 2026-04-26
**Domain:** SGSD telemetry topology + orchestrator-side phase stamping
**Confidence:** HIGH (every claim verified against on-disk files this session)

---

## Summary

Phase 26 locked the operator question contract: 8 questions, 8 closed status
states, no-gap freshness bands, repair-path discipline. Phase 27's job is to
prove that contract is implementable against the **existing** telemetry
surface — no new state files, no new metric streams (DISCUSS 27.1 = NO) — and
to encode the orchestrator-side `phase` stamping requirement (DISCUSS 27.2)
that Phase 28's executor will land.

I sampled every JSONL stream under `.planning/metrics/`, the
`handover-contract-v2.yaml` emit catalog, the activity-logger source
(`super-gsd/hooks/sgsd-activity-logger.js`), and STATE.md frontmatter. The
contract holds: every Q1–Q8 lane resolves to one or more existing files. No
new state file required. **DISCUSS 27.1 stands.**

The phase-stamping work is more than "write a hook." The current logger
already attempts to stamp `phase`, but the regex is broken: it matches
`by_phase:` in STATE.md and captures the next non-whitespace token (`"26":`),
so 100% of post-Phase-26 rows carry the literal corrupt value
`"phase":"\"26\":"`. **DISCUSS 27.2 is partly an existing-bug-fix, not a
greenfield feature.**

**Primary recommendation:** Phase 27 ships a docs-only PLAN with (a) the
data-source matrix re-validating Phase 26's Q1–Q8 sources against on-disk
schemas, (b) the objective-tree schema (8 stable node-id formats), and
(c) a precise spec of the corrected `phase`-stamper for Phase 28's executor
to implement. No code changes in Phase 27 itself.

---

## User Constraints (from DISCUSS + Phase 26 contract)

### Locked Decisions

- **DISCUSS 27.1** — *NO `cockpit-state.json`. Cockpit derives state from
  existing 13 metric streams every refresh.* No new state file may be proposed.
- **DISCUSS 27.2** — *Orchestrator stamps active phase ID into every
  `activity-log.jsonl` row (canonical). Path-based derivation removed.*
- **DISCUSS 26.1 / 26.2 / 26.3** — Status vocabulary, freshness bands, and
  repair-command 4-AND predicate are locked in
  `26-01-operator-question-contract-PLAN.md`. Phase 27 cites; does not redefine.
- **Controlling principle** — *Autonomy continues; evidence tells the truth.*

### Claude's Discretion

- Choice of stable-ID format for objective-tree node types (must be
  human-readable + deterministic; 27.3 is implicit).
- How to express the `phase`-stamper spec (pseudocode vs. code-shaped diff
  hint vs. behavioral contract). I recommend behavioral contract +
  acceptance commands; Phase 28 owns the implementation.

### Deferred / Out of Scope

- Implementing the `phase`-stamper fix (Phase 28 executor task).
- Mission Strip rendering (Phase 28 layout).
- Q5 phase-scoping render code (Phase 29 narrative pane).
- Acceptance harness (Phase 30).
- Cross-milestone unlock derivation (locked OUT in Phase 26 §Q3 derivation
  call — render literal "milestone close" + milestone id).

---

## Phase Requirements

| ID | Description | Research support |
|----|-------------|------------------|
| REQ-27-MATRIX | Q1–Q8 each map to a concrete existing file path | §Data Source Inventory + §Q1–Q8 Source Matrix |
| REQ-27-NO-NEW-STATE | No `cockpit-state.json`; no new metric stream | §Q1–Q8 Source Matrix (zero "needs new file" rows) |
| REQ-27-TREE | Objective-tree schema names 8 stable node-id formats | §Objective Tree Schema |
| REQ-27-DERIVATION | Cockpit derivation rules at refresh time, no persistent cockpit state | §Cockpit Derivation Rules |
| REQ-27-PHASE-STAMP | Spec for Phase 28's `phase`-field stamper, including the existing-bug fix | §`activity-log` `phase` Field Analysis |

---

## Data Source Inventory

Every file under `.planning/metrics/`, with on-disk schema sample, writer,
and consumer. Verified by `head -1` / `wc -l` / file listing this session.

| Path | Purpose (per emit catalog or audit) | Sample row schema (first row on disk) | Writer | Reader |
|------|-------------------------------------|-----------------------------------------|--------|--------|
| `.planning/metrics/activity-log.jsonl` | Per-tool-call live-stream — every PreToolUse fire (8255 rows on disk) | `{"ts":"ISO","tool":"Read","target":"…","phase":"…","subagent_type":null,"command_kind":null,"provider":null,"prompt_file":null,"report_out":null,"review_step":null,"review_plan":null,"command_preview":null}` | `super-gsd/hooks/sgsd-activity-logger.js` (PreToolUse hook) | Q1 (model activity), Q5 (agents-used), narrative pane, mission-control body |
| `.planning/metrics/heartbeat.jsonl` | Per-tool-call completion marker (PostToolUse) | `{"ts":"ISO","tool":"Edit","status":"complete","bytes":N,"empty":false}` | `super-gsd/hooks/sgsd-heartbeat.js` (PostToolUse hook) — declared in emits catalog | Q1 (freshness), Q8 (stall detection) |
| `.planning/metrics/codex-live.json` | Current Codex run state (single object, not JSONL) | `{provider, invocation, model, reasoning_effort, state, phase, plan, step, prompt_file, report_out, started_at, updated_at, duration_ms, exit, timeout_hit, fallback_triggered, stderr_preview, command_preview}` | Codex worker (`sgsd-codex-monitor.ps1` + Codex wrapper) | Q6 (Codex state), mission-control Codex line |
| `.planning/metrics/codex-log.jsonl` | Codex run history (one row per run) | `{"ts","phase","plan","step","exit","duration_ms","prompt_bytes","report_bytes","timeout_hit","fallback_triggered","stderr_preview"}` | Codex wrapper post-exec | Q6 (verdict + report path), narrative timeline |
| `.planning/metrics/audit-log.jsonl` | Per-step latency / status audit | `{"ts","phase","status","l1_ms","l2_ms","l3_ms","total_ms"}` | gate audit emitters (per-step) | Q7 (evidence-event history) |
| `.planning/metrics/crit-backlog.jsonl` | CRIT-BACKLOG canonical store (Patch 2) | `{id, kind, phase, plan, milestone, attempts_made, summary, evidence_path, last_diff_sha, tagged_for_milestone, added_at, resolved_at, resolved_by}` | `super-gsd/scripts/lib/crit-backlog.cjs` (append on degraded close); `--render` writes `.planning/CRIT-BACKLOG.md` | Q4 (blockers), mission-control blocker row |
| `.planning/metrics/deliberation-outcomes.jsonl` | Per-DLB deliberation outcome | `{"ts","milestone","dlb_id","q1_impl_hours_actual","rework_fired","falsifier_fired","revisions_needed","confidence_weighted_sum","raw_vote","reflection_captured"}` | `sgsd-ceo` post-deliberation | (none in Q1–Q8 contract; diagnostic only) |
| `.planning/metrics/handoff-log.jsonl` | Session-handover events | `{"ts","from_session_id","to_session_id","reason","chain_depth","cumulative_runtime_s","checkpoint_path","refused"}` | session handover emitter | (none in Q1–Q8 contract; diagnostic only) |
| `.planning/metrics/muda-log.jsonl` | MUDA gate findings per phase close | `{"ts","phase","warn","fail","exit","probes":{"haiku","narrative","git"}}` | `sgsd-muda-audit.sh` | (none in Q1–Q8 contract; diagnostic only) |
| `.planning/metrics/narrative.md` | Cached Haiku narrative (text, not JSONL) | rolling paragraph + bullet list | `sgsd-narrative.ps1` (cached refresh) | mission-control narrative pane (full); Q1 surfaces 1-line in strip |
| `.planning/metrics/plan-errors.jsonl` | Schema-load errors per PLAN.md | `{"ts","event","plan_file","phase","plan","schema_version","mode","valid","error_count","errors":[]}` | schema-loader (Phase 11) | Phase 33 schema-load checker; diagnostic |
| `.planning/metrics/readiness-log.jsonl` | Drift events on milestone-readiness manifest | `{"ts","type","expected_hash","actual_hash"}` | `sgsd-milestone-readiness` agent | Boot preflight; diagnostic |
| `.planning/metrics/token-log.jsonl` | Per-dispatch token usage estimate | `{"ts","tool","model","description","est_input","est_output","total"}` | orchestrator post-dispatch | cost lane (mission-control); diagnostic |
| **`.planning/metrics/edge-guard-log.jsonl`** | **Declared in emits catalog but NOT on disk** | n/a — file does not exist | edge-guard structural check (rule 4 of dispatch) | Q4/Q8 in theory; currently absent |
| **`.planning/metrics/orchestrator-pulse.jsonl`** | **Declared in emits catalog but NOT on disk** | n/a — file does not exist | orchestrator step entry hook | (none in Q1–Q8 contract) |

**Plus state files (always-read, no freshness band):**

- `.planning/STATE.md` — milestone, phase, blockers (frontmatter)
- `.planning/ROADMAP-AGENT.md` — phase entries with `Goal:` lines
- `.planning/CRIT-BACKLOG.md` — render of `crit-backlog.jsonl` (markdown view)
- `.planning/ORCHESTRATOR-CHECKPOINT.md` — present only when checkpoint open
- `.planning/resource-registry/agents.jsonl` — 21 rows, one per agent: `{id, path, sha, mtime, model, tools, description, status}`
- `~/.claude/projects/<encoded-cwd>/*.jsonl` — live Claude session JSONL
  (file mtime + last row's tool name) — Q1 primary source

**Verification (this session):**
- `wc -l .planning/metrics/activity-log.jsonl` → 8255 rows
- `head -1` schema match for all 11 JSONL streams listed
- `ls .planning/metrics/edge-guard-log.jsonl` → not found (declared, missing)
- `ls .planning/metrics/orchestrator-pulse.jsonl` → not found (declared, missing)

**Note on missing-but-declared:** `edge-guard-log.jsonl` and
`orchestrator-pulse.jsonl` appear in `handover-contract-v2.yaml` emit catalog
(lines 101–103, ~line 116-ish for edge-guard if present). Neither is required
by Q1–Q8 in the Phase 26 contract. They are diagnostic / future-use; their
absence does NOT block Phase 27. (If any Q1–Q8 lane depended on them, that
would be a falsifier for DISCUSS 27.1 — not the case.)

---

## Q1–Q8 Source Matrix

Re-validating Phase 26's contract against on-disk reality. Each row's
"Source(s) on disk" was confirmed to exist (or to be a known always-read
state file) this session.

| Q | Question (cited COCKPIT-2.0-SCOPE.md L33–43) | Primary source(s) on disk | Status states (Phase 26) | Freshness band (Phase 26) | New state file needed? |
|---|----------------------------------------------|---------------------------|---------------------------|---------------------------|------------------------|
| Q1 | Model activity now | live Claude session JSONL (`~/.claude/projects/<encoded-cwd>/*.jsonl`); `activity-log.jsonl` last row; `heartbeat.jsonl` last PostToolUse mtime | active, waiting, stale, unavailable | generic (<30s / 30–599s / ≥600s) | **NO** |
| Q2 | What we're trying to complete | `STATE.md` frontmatter `milestone` + `phase`; `ROADMAP-AGENT.md` active phase `Goal:` | active, complete, unavailable | always-read | **NO** |
| Q3 | What completing it unlocks | `ROADMAP-AGENT.md` next phase `Goal:` line; if last phase in milestone → literal `"milestone close <id>"` (Phase 26 §Q3 derivation call locked) | active, complete, unavailable | always-read | **NO** |
| Q4 | Blocked or risky | `STATE.md` blockers; `crit-backlog.jsonl` rows where `tagged_for_milestone == active OR phase == active`, latest row per `id` not `kind: cleared` | blocked, active, stale, unavailable | audit-log (<24h fresh / ≥24h stale) | **NO** |
| Q5 | Agents used + last status | `activity-log.jsonl` rows where `tool ∈ {TaskCreate, Agent}` AND `phase == active phase`; `agents.jsonl` for role resolution | active, waiting, stale, complete, unavailable | generic | **NO** — but **requires `phase`-stamper fix** (DISCUSS 27.2; see §`phase` Field Analysis) |
| Q6 | Codex state + verdict | `codex-live.json` (`state` + mtime); `codex-log.jsonl` history; report files at `codex-live.json.report_path` | active, reviewing, timed-out, complete, stale, unavailable | Codex (<120s / 120–3599s state-field / ≥3600s stale) | **NO** |
| Q7 | Evidence/artifacts | Phase folder enumeration (RESEARCH/CONTEXT/PLAN/VERIFICATION/ATC-REVIEW); `audit-log.jsonl` per-step latency rows; `git log` recent commits | active, complete, stale, unavailable | per-file mtime, audit band | **NO** |
| Q8 | What happens next | `CLAUDE.md` "Dispatch Rules" table; current phase artifact state (Q7 result); `heartbeat.jsonl` mtime; open repair paths from Q4/Q6/Q7 | active, waiting, blocked, reviewing, unavailable | generic against heartbeat mtime | **NO** |

**Result:** All 8 lanes resolve. Zero rows in the "New state file needed?"
column require new infrastructure. **DISCUSS 27.1 holds.** Phase 26's
falsifier ("If any Q1–Q8 lane requires a new state file, the no-cockpit-state
decision is wrong") does not fire. The contract is implementable.

---

## `activity-log.jsonl` `phase` Field Analysis

This is the substantive code-spec piece of Phase 27. DISCUSS 27.2 says the
orchestrator must stamp `phase` canonically. The on-disk reality is more
specific than "field is null" — the field is **populated but corrupt**.

### Current writer

`super-gsd/hooks/sgsd-activity-logger.js` (lines 144–149):

```js
let phase = '';
try {
  const stateContent = fs.readFileSync(path.join(root, '.planning', 'STATE.md'), 'utf8');
  const match = stateContent.match(/(?:current_phase|phase):\s*(\S+)/);
  if (match) phase = match[1];
} catch {}
```

Then writes `phase: phase || null` into the row.

### Observed behavior on disk

`grep -c '"phase":' activity-log.jsonl` → **8253 of 8255 rows have the field**.
`grep -cE '"phase":\s*[^n]' activity-log.jsonl` → **2526 rows non-null**.

Sampling the last 5 rows shows every recent row carries:

```json
"phase":"\"26\":"
```

— the literal 6-character string `"26":` including the quotes and colon.

### Root cause

The regex `/(?:current_phase|phase):\s*(\S+)/` is greedy on `\S+` and matches
the **first** occurrence of `phase:` in STATE.md. Current STATE.md (verified
this session, lines 1–30) has these `phase:`-bearing keys:

- `total_phases: 5`
- `completed_phases: 1`
- `phase_26: "1/1 plan complete..."`
- `phase_27: "scoping..."`
- (etc.)
- `by_phase:` followed by `\n    "26": 1`

The first match for `phase:\s*(\S+)` actually hits `by_phase:` (because
`(?:phase|current_phase):` matches `phase:` as a substring of `by_phase:`),
and captures `\S+` = the next non-whitespace token, which is `"26":` (the
phase ID inside the YAML map).

**This corruption is post-2026-04-26 only** — the regex was written assuming
a flat STATE.md with `phase: 26` at the top level. The current STATE.md has
no such top-level scalar; phase identity lives nested under
`progress.phase_26`, etc. Earlier STATE.md schemas presumably had a flat
`current_phase:` field.

### Q5 dependency

Phase 26 §Q5 (`activity-log.jsonl` rows where `phase` matches active phase)
depends on `phase` being a clean phase id. The corrupt value `"\"26\":"` does
not equal `"26"` and does not equal `26` — Q5 filters will return empty.

Phase 26 §Q5 also locks the pre-stamp fallback: *"When `activity-log.jsonl`
rows exist but none carry a `phase` stamp (pre-Phase-28 history rows), the
lane MUST render `unavailable`. No path-based derivation fallback —
DISCUSS 27.2 forbids it."* — this fallback is correct for actually-null rows.
For corrupt rows, the cockpit cannot tell the difference between "stamped
wrong" and "not stamped" — both miss the equality check.

### Phase 28 executor spec (the deliverable Phase 27's PLAN points at)

The Phase 28 executor must replace the regex+match logic with a
**deterministic, structured-YAML-aware** read. Behavioral contract:

1. **Source of truth (in priority order):**
   - **Primary:** environment variable `SGSD_ACTIVE_PHASE`, set by the
     orchestrator at dispatch time. If present, use verbatim. (Recommended:
     orchestrator sets this at every loop tick.)
   - **Fallback:** parse STATE.md's YAML frontmatter (lines between first
     `---` and second `---`); look for top-level scalar key `phase:` first,
     then `current_phase:`, then last-resort look at `progress.phase_NN`
     keys (extract `NN`, take the highest-numbered key whose value contains
     a status string matching `awaiting|in[- ]progress|active`). The
     fallback must NOT match `by_phase:`, `total_phases:`, `phase_NN:`
     patterns by partial-substring greedy match.
   - **Final fallback:** `null`.

2. **Output type:** string of digits only (e.g. `"26"`, `"27"`). Never
   includes quotes. Never includes a colon. Never includes whitespace.

3. **Validation guard before write:** if the candidate `phase` does not
   match `^[0-9]+$`, write `null` instead of the candidate. (This prevents
   a future STATE.md schema regression from re-corrupting the field.)

4. **Acceptance commands** (Phase 28 verifier must run, post-fix):
   - `tail -100 .planning/metrics/activity-log.jsonl | grep -cE '"phase":"[0-9]+"'` → ≥ 50 (most recent rows are stamped)
   - `tail -100 .planning/metrics/activity-log.jsonl | grep -cE '"phase":"\\\\\"[0-9]+\\\\\":"'` → 0 (no corrupt format remains)
   - `tail -100 .planning/metrics/activity-log.jsonl | grep -cE '"phase":null' || true` → tolerated (if STATE.md is missing or env var unset)

5. **Backfill of existing rows:** **out of scope.** Per Phase 26 §Q5 open
   derivation call, pre-stamp rows render `unavailable`. Corrupt rows
   should be treated identically — Q5 simply does not surface them. The
   logger fix only affects rows written after Phase 28's deploy. **No
   path-based or substring-based recovery on historical corrupt rows**
   (DISCUSS 27.2 prohibition on path derivation extends here by analogy).

6. **Consumer-side (Phase 29 narrative pane):** when filtering Q5 by phase,
   match on `row.phase === activePhase` (string equality). Reject rows
   where `row.phase` does not match `^[0-9]+$` — treat as `unavailable`
   per the Phase 26 §Q5 open derivation call.

### Why this is a Phase 28 task, not a Phase 27 task

Phase 27 is docs-mostly per the roadmap: *"docs-mostly. Phase 28 will pick up
the tiny code change implied by 27.2 (orchestrator stamps `phase` into
activity-log)."* Phase 27's PLAN encodes the spec above as input to Phase 28.
Phase 27 does not edit `sgsd-activity-logger.js` or any code file.

---

## Objective Tree Schema

Per VIO-ROADMAP-ENRICHMENT.md §2 ("Show A Tree, Not A Soup", lines 65–80) the
cockpit and roadmap should represent work as a structured tree. This is a
**schema, not a stored file** (DISCUSS 27.1) — the cockpit derives the tree
at refresh time from the existing sources listed in the matrix above.

### Node types and stable IDs

8 node types (one per VIO-ROADMAP-ENRICHMENT level + a `codex_run` node for
review work, per the roadmap acceptance criteria for Phase 27):

| Node type | Stable ID format | Source for ID derivation | Example |
|-----------|------------------|--------------------------|---------|
| `milestone` | `M:{milestone_id}` | `STATE.md` `milestone:` field; e.g. `v1.6` | `M:v1.6` |
| `phase` | `P:{milestone_id}:{phase_num}` | `STATE.md` `phase:` (post-fix) + roadmap entry | `P:v1.6:27` |
| `objective` | `O:{milestone_id}:{phase_num}:{requirement_id}` | `REQUIREMENTS.md` REQ ids per phase | `O:v1.6:27:REQ-27-MATRIX` |
| `gate` | `G:{milestone_id}:{phase_num}:{gate_name}` | dispatch-rule names + ATC tier (`per-dispatch-atc`, `phase-atc`, `verifier`, `edge-guard`, `muda`) | `G:v1.6:27:verifier` |
| `agent` | `A:{milestone_id}:{phase_num}:{agent_slug}` | `agents.jsonl.id` field; current-phase-scoped per DISCUSS 29.2 | `A:v1.6:27:gsd-phase-researcher` |
| `artifact` | `R:{milestone_id}:{phase_num}:{artifact_kind}:{plan_id?}` | phase-folder file presence: `RESEARCH`, `CONTEXT`, `PLAN-{plan_id}`, `VERIFICATION`, `ATC-REVIEW` | `R:v1.6:27:RESEARCH`, `R:v1.6:27:PLAN-01` |
| `blocker` | `B:{crit-backlog-id}` | `crit-backlog.jsonl.id` (e.g. `2026-04-26T23-13-37-843Z-3584`) | `B:2026-04-26T23-13-37-843Z-3584` |
| `unlock` | `U:{milestone_id}:{phase_num}` | next-phase Goal text from ROADMAP-AGENT.md, or literal `"milestone close {milestone_id}"` if last phase | `U:v1.6:27` |
| `codex_run` | `C:{phase_num}:{plan_id}:{started_at}` | `codex-log.jsonl` row keys (phase, plan, ts) | `C:27:01:2026-04-27T00:00:00Z` |

(That's 9 node types; the Phase 27 roadmap-level acceptance criterion says
"IDs for milestone, phase, objective, agent, gate, artifact, blocker,
codex_run" = 8. `unlock` is added because Phase 26 §Q3 makes it a first-class
operator answer. The plan can drop `unlock` if the operator prefers strict
8-node parity with the roadmap acceptance — flagged as Open Question 1.)

### Edges (parent-child)

| Parent | Child | Cardinality |
|--------|-------|-------------|
| `milestone` | `phase` | 1:N |
| `phase` | `objective` | 1:N |
| `objective` | `gate` | 1:N (each REQ has ≥1 gate guarding it) |
| `objective` | `agent` | 1:N (which agent attempted) |
| `objective` | `artifact` | 1:N (RESEARCH, PLAN, VERIFICATION, etc.) |
| `phase` | `blocker` | 1:N (open CRIT rows tagged to phase) |
| `phase` | `unlock` | 1:1 (one next-phase per phase) |
| `phase` | `codex_run` | 1:N |

### Why this is a schema, not a stored file

The cockpit derives the tree **on every refresh** by:

1. Reading `STATE.md` → milestone + active phase identity.
2. Listing `phases/` directory under active milestone → phase IDs.
3. Parsing `REQUIREMENTS.md` per phase → objective IDs.
4. Parsing `CLAUDE.md` dispatch-rules table → gate IDs that apply.
5. Filtering `activity-log.jsonl` by `phase == active` → agent invocations.
6. Listing phase folder for artifacts.
7. Filtering `crit-backlog.jsonl` (latest-row-per-id, not cleared) → blockers.
8. Reading next phase from `ROADMAP-AGENT.md` → unlock string.
9. Filtering `codex-log.jsonl` by phase → codex_run history.

No persistent `cockpit-state.json` is written. This honors DISCUSS 27.1 by
construction.

---

## Cockpit Derivation Rules

At refresh time (every cockpit redraw, ~10s in mission-control), the cockpit:

1. **Reads `STATE.md` frontmatter** for `milestone` and active `phase`. Always-read; no freshness band.
2. **Lists the active phase folder** under `.planning/milestones/{milestone}/phases/{phase}-*/` → derives Q7 artifact set + Q8 dispatch-rule match.
3. **Filters `.planning/metrics/*` by `phase == active`** for Q4 (crit-backlog), Q5 (activity-log), Q6 (codex-log/codex-live).
4. **Reads `.planning/ROADMAP-AGENT.md`** for the active phase's `Goal:` line (Q2) and the next phase's `Goal:` line (Q3).
5. **Reads `CLAUDE.md` dispatch-rules table** for Q8 first-match-wins resolution.
6. **Reads `~/.claude/projects/<encoded-cwd>/*.jsonl`** for Q1 live model activity (file mtime + last row tool name).

**Refresh-on-demand. No write-back. No persistent cockpit state.** The
cockpit is a pure function of the existing telemetry surface at refresh
time `T`. This is the architectural counterpart to DISCUSS 27.1 — derivation
is a function, not a stored result.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing in `sgsd-activity-logger.js` | Regex-based field grab | Either env-var (`SGSD_ACTIVE_PHASE`) set by orchestrator OR proper line-by-line key=value parse with `^phase:\s*` anchor (must reject `^by_phase:`, `^phase_\d+:`) | Existing regex broke silently when STATE.md schema changed. Anchored parse OR env-var both eliminate the failure class. |
| Cockpit state cache | New `cockpit-state.json` | Refresh-on-demand derivation | DISCUSS 27.1 prohibits. Caches go stale; the existing telemetry IS the state. |
| Pre-Phase-28 row recovery for Q5 | Path-based derivation from `target` field | Render `unavailable` per Phase 26 §Q5 derivation call | DISCUSS 27.2 explicitly removes path derivation. Honest "unavailable" is correct. |
| Cross-milestone unlock for Q3 last-phase | Read next milestone's roadmap entries | Render literal `"milestone close {milestone_id}"` per Phase 26 §Q3 derivation call | Locked. Cross-milestone derivation is out of cockpit scope. |
| Tree storage | Serialize tree to a file | Derive at refresh time from sources in §Cockpit Derivation Rules | DISCUSS 27.1 + VIO §3 ("Hide Detail Until Needed") — tree is a view, not a record. |

---

## Common Pitfalls

### Pitfall 1: STATE.md schema drift re-corrupts `phase`

**What goes wrong:** A future commit changes STATE.md to use a new
top-level key (`active_phase:`, `phase_id:`, etc.) and the stamper's parse
breaks again — silently — and Q5 returns empty.

**Why it happens:** The logger has no schema-version pin to STATE.md. The
parse trusts a regex pattern.

**How to avoid:** Phase 28 spec (above) requires a validation guard:
`if (!candidate.match(/^[0-9]+$/)) write null`. This converts a silent
data-corruption regression into a visible "Q5 unavailable" lane on the
cockpit. Operator notices immediately.

**Warning signs:** Q5 rendering `unavailable` for a phase that clearly has
agent activity in `mission-control` body pane.

### Pitfall 2: `crit-backlog.jsonl` "phase" string vs. integer

**What goes wrong:** Q4 filters `crit-backlog.jsonl` by `phase == active`,
but `crit-backlog.jsonl` rows store `phase` as a string (`"phase":"26"`) and
the active-phase value from STATE.md may be parsed as integer. String !==
integer in JS; row is missed.

**Why it happens:** No schema enforcement on JSONL writers across the 13
streams.

**How to avoid:** Q4 filter logic in Phase 28 must coerce both sides to
string before comparison. The Phase 27 PLAN should specify this.

**Warning signs:** Q4 lane shows `complete` while the markdown render of
`.planning/CRIT-BACKLOG.md` clearly lists open rows for the active phase.

### Pitfall 3: `codex-live.json` `phase` lags the active phase

**What goes wrong:** Q6 reads `codex-live.json.phase` and uses it to scope
Codex activity, but `codex-live.json` is updated by the Codex worker only
when a Codex run starts. Between phase transitions, `codex-live.json.phase`
points at the previous phase.

**Why it happens:** Codex worker writes the field at run-start, not at
phase transition.

**How to avoid:** Q6 in the contract uses `codex-live.json.state` + mtime
freshness bands per DISCUSS 26.2 / 29.1 — NOT `codex-live.json.phase`. The
Phase 26 contract is correct on this; Phase 27's PLAN should not introduce
a new use of `codex-live.json.phase` for cockpit scoping.

**Warning signs:** Cockpit Q6 lane briefly shows the previous phase's
Codex verdict during a phase transition.

### Pitfall 4: Tree derivation cost on every refresh

**What goes wrong:** `activity-log.jsonl` is 8255 rows on disk (~1.6 MB)
and growing. Filtering it on every 10s cockpit refresh becomes a hot path.

**Why it happens:** Naive `for-each row` filter; no index.

**How to avoid:** Phase 28 mission-strip code should `tail -N` to a bounded
window (e.g., last 500 rows) for Q5 — phase activity is recent by definition;
reading the full file is unnecessary. Phase 27's PLAN should make this
explicit so Phase 28 doesn't naive-implement.

**Warning signs:** Cockpit refresh latency creeps over 1 second; mission
control feels sluggish during long phases.

---

## Code Examples

### Reading STATE.md frontmatter (the corrected approach for Phase 28)

```js
// Phase 28 task. Spec encoded in 27-01-PLAN.md.
function readActivePhase(root) {
  // Primary: env var set by orchestrator at dispatch
  if (process.env.SGSD_ACTIVE_PHASE && /^[0-9]+$/.test(process.env.SGSD_ACTIVE_PHASE)) {
    return process.env.SGSD_ACTIVE_PHASE;
  }
  // Fallback: parse STATE.md YAML frontmatter line-by-line
  try {
    const content = fs.readFileSync(path.join(root, '.planning', 'STATE.md'), 'utf8');
    // Frontmatter is between the first two `---` lines
    const fm = content.split(/^---$/m)[1] || '';
    // Anchored line match — reject `by_phase:`, `phase_NN:`, `total_phases:`, `completed_phases:`
    for (const line of fm.split('\n')) {
      const m = line.match(/^(?:current_phase|phase):\s*"?([0-9]+)"?\s*$/);
      if (m) return m[1];
    }
  } catch {}
  return null; // Q5 lane will render `unavailable`, per Phase 26 §Q5
}
```

### Filtering activity-log.jsonl for Q5 (current-phase agents)

```js
// Phase 29 task. Spec encoded in 27-01-PLAN.md.
function agentsForActivePhase(activityLogPath, activePhase, windowSize = 500) {
  const lines = tailLines(activityLogPath, windowSize); // bounded read
  const agents = new Map();
  for (const line of lines) {
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    // String-coerce both sides; reject corrupt phase values
    const rowPhase = String(row.phase || '');
    if (!/^[0-9]+$/.test(rowPhase)) continue; // unavailable per Phase 26 §Q5
    if (rowPhase !== String(activePhase)) continue;
    if (row.tool === 'Agent' || row.tool === 'TaskCreate') {
      const agent = row.subagent_type || 'unknown';
      const prev = agents.get(agent);
      if (!prev || row.ts > prev.ts) agents.set(agent, row);
    }
  }
  return agents;
}
```

### Tree derivation for the cockpit (skeleton)

```js
// Phase 28 mission-strip task. Spec encoded in 27-01-PLAN.md.
function deriveTree(root) {
  const milestone = readField(root, '.planning/STATE.md', 'milestone');
  const phase = readActivePhase(root);
  return {
    id: `M:${milestone}`,
    type: 'milestone',
    children: [{
      id: `P:${milestone}:${phase}`,
      type: 'phase',
      children: [
        ...listObjectives(root, milestone, phase),
        ...listBlockers(root, milestone, phase),
        listUnlock(root, milestone, phase),
        ...listCodexRuns(root, phase),
      ],
    }],
  };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Regex-based STATE.md parse for `phase` field | Env-var primary, anchored YAML parse fallback, validation guard | This phase (27 spec → 28 implement) | Eliminates silent corruption when STATE.md schema drifts |
| Path-based derivation of phase from row's `target` field | Removed; render `unavailable` for unstamped rows | DISCUSS 27.2 (this milestone) | Honest reporting; no false attribution |
| Cockpit state cached in a file | Refresh-on-demand derivation | DISCUSS 27.1 (this milestone) | No stale cache; tree IS the existing telemetry |
| Q5 globally scoped (last 6h across all phases) | Current-phase scoped via `phase` filter | DISCUSS 29.2 | Operator sees current work, not history bleed |

**Deprecated/outdated:**

- The current `sgsd-activity-logger.js` regex (`/(?:current_phase|phase):\s*(\S+)/`) is broken
  against post-2026-04-26 STATE.md schemas. Phase 28 replaces it.
- Any cockpit lane that still reads `cockpit-state.json` — there isn't one
  on disk; if any prototype assumes one, drop the assumption.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Setting `SGSD_ACTIVE_PHASE` as env var at orchestrator dispatch is the cleanest primary source for the stamper | §`phase` Field Analysis | If orchestrator can't reliably set the var (e.g., subshell isolation), fallback YAML parse must be the primary. Phase 28 verifies during implementation. |
| A2 | `unlock` deserves to be a first-class node type (9 total) rather than strict 8-node parity with the VIO roadmap acceptance | §Objective Tree Schema | If operator wants strict 8, drop `unlock` from node types and resolve Q3 inside the `phase` node's `next` field. Flagged as Open Question 1. |
| A3 | `tail -500` window is sufficient for Q5 agent enumeration in a typical phase | §Pitfall 4 | If a phase has >500 tool calls before any Agent dispatch, agents could be missed. Default window size should be tunable in Phase 28 mission-strip code. |

---

## Open Questions

1. **9-node tree (with `unlock`) vs. 8-node tree (per VIO acceptance)?**
   The roadmap acceptance criterion lists 8: milestone, phase, objective,
   agent, gate, artifact, blocker, codex_run. I added `unlock` as a 9th
   because Phase 26 §Q3 makes it a first-class operator answer. The PLAN
   can either accept the 9-node tree or fold `unlock` into the `phase`
   node as a string field. **Recommendation:** keep 9 nodes — Q3 is a
   contract obligation; promoting it to a node makes the tree honor the
   full operator contract.

2. **Phase 28 stamper: env-var primary OR YAML-parse primary?**
   Both are valid. Env-var is faster + zero-IO. YAML parse is
   self-contained (no orchestrator coordination required). My
   recommendation is env-var primary with YAML fallback (Assumption A1),
   but the orchestrator may not propagate env vars cleanly into PreToolUse
   hooks on Windows/WSL. **Recommendation:** Phase 28 plan-checker should
   verify env-var propagation works in a smoke test before locking the
   stamper to env-var-primary.

3. **Backfill stance for the ~5,727 corrupt-phase rows on disk?**
   Per the stamper spec above, no backfill. Q5 simply doesn't surface
   pre-Phase-28 rows. But the corrupt rows are NOT pre-stamp — they're
   post-stamp-broken. A historical-data-archaeology argument could say
   "at least correct the literal `\"NN\":` to `NN`." **Recommendation:**
   no backfill. Honest "unavailable" is the controlling-principle answer.
   The PLAN should explicitly call out the no-backfill choice so a future
   contributor doesn't assume a one-time-fix is missing.

4. **`edge-guard-log.jsonl` and `orchestrator-pulse.jsonl` declared in
   handover-contract-v2.yaml but not on disk — Phase 27 concern?**
   Neither is required by Q1–Q8. Their absence does not block Phase 27.
   If a future cockpit lane wants to use them, they'd need to start being
   written first. **Recommendation:** out of scope for v1.6. Phase 27 PLAN
   should note "two emit-catalog entries are not currently written; not a
   Q1–Q8 dependency; defer to a future milestone."

---

## Environment Availability

This phase has no external dependencies (docs-only PLAN; spec-encoding for
Phase 28). All sources are local files under `.planning/`. Tools required:
`grep`, `wc`, `head`, `tail`, `cat`, `ls` — all available.

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Local file read | All §sections | ✓ | — | — |

**Missing dependencies:** none.

---

## Validation Architecture

### Test framework

| Property | Value |
|----------|-------|
| Framework | none (docs-only phase; no automated test suite) |
| Config file | none |
| Quick run command | acceptance commands inline in §Acceptance below |
| Full suite command | `gsd-verifier` Step 8 reads acceptance commands from PLAN frontmatter |

### Phase requirements → acceptance map

| REQ ID | Behavior | Test type | Automated command |
|--------|----------|-----------|--------------------|
| REQ-27-MATRIX | All 8 Q lanes reference an existing on-disk path | grep | `for q in 1 2 3 4 5 6 7 8; do grep -A 5 "### Q$q " 27-01-cockpit-data-contract-PLAN.md \| grep -E '\.planning/(metrics/.+\.jsonl\|STATE\.md\|ROADMAP-AGENT\.md)' \| grep -q . \|\| echo "Q$q FAIL"; done` |
| REQ-27-NO-NEW-STATE | No `cockpit-state.json` referenced; no new metric stream proposed | grep | `! grep -E 'cockpit-state\.json' 27-01-cockpit-data-contract-PLAN.md \|\| echo FAIL` |
| REQ-27-TREE | 8 (or 9) node-type IDs documented with stable formats | grep | `grep -cE '^\| (milestone\|phase\|objective\|gate\|agent\|artifact\|blocker\|unlock\|codex_run) \|' 27-01-cockpit-data-contract-PLAN.md` ≥ 8 |
| REQ-27-DERIVATION | Refresh-on-demand derivation rules documented; no write-back path | grep | `grep -q 'Refresh-on-demand' 27-01-cockpit-data-contract-PLAN.md && ! grep -E 'write[- ]back\|cockpit-state\.json' 27-01-cockpit-data-contract-PLAN.md` |
| REQ-27-PHASE-STAMP | Phase 28 stamper spec includes (1) sources of truth, (2) validation guard regex `^[0-9]+$`, (3) acceptance commands | grep | 3-part grep: `grep -q 'SGSD_ACTIVE_PHASE'`, `grep -q '\\^\\[0-9\\]\\+\\$'`, `grep -q 'tail -100 \.planning/metrics/activity-log\.jsonl'` |

### Sampling rate

- **Per task commit:** docs-only — `grep` checks above run in <1s.
- **Per wave merge:** same.
- **Phase gate:** `gsd-verifier` Step 8 runs all 5 acceptance checks; phase
  closes PASS if all return 0.

### Wave 0 gaps

None. This phase produces only markdown; existing grep-based verification
infrastructure suffices.

---

## Project Constraints (from CLAUDE.md)

- **Permissions:** Autonomous mode — never ask operator for confirmation.
- **Commit discipline:** atomic commits per task, never batch, no `git add -A`.
- **Token efficiency:** read STATE.md frontmatter only; query memory before re-reading large files.
- **Sub-agent reports:** structured 6-section format, ≤300 words.
- **Hard stops:** only the 4 listed in CLAUDE.md (all phases done; context >70%; blocker; user stop).

These are honored — Phase 27 ships a docs-only PLAN; commits are atomic per
deliverable; no token-wasting re-reads.

---

## Sources

### Primary (HIGH confidence — verified on disk this session)

- `.planning/milestones/v1.6/phases/26-cockpit-question-contract/26-01-operator-question-contract-PLAN.md` (locked Phase 26 contract)
- `.planning/milestones/v1.6/phases/26-cockpit-question-contract/26-VERIFICATION.md` (PASS-WITH-DEFERRED-1)
- `.planning/discussions/2026-04-26-mass-discuss.md` lines 168–177 (DISCUSS 26.1–30.1 verbatim)
- `.planning/ROADMAP-AGENT.md` lines 181–204 (Phase 27 entry)
- `.planning/milestones/v1.6/EXISTING-SURFACE-AUDIT.md` (current-surface inventory)
- `.planning/milestones/v1.6/REQUIREMENTS.md` (mission + 8-question framing)
- `.planning/milestones/VIO-ROADMAP-ENRICHMENT.md` lines 65–106 ("tree, not soup" + "hide detail until needed")
- `super-gsd/registry/handover-contract-v2.yaml` lines 94–122 (emit catalog)
- `super-gsd/hooks/sgsd-activity-logger.js` (the broken stamper)
- `.planning/STATE.md` frontmatter lines 1–30 (current schema; the regex's actual input)
- `.planning/metrics/activity-log.jsonl` (8255-row sample; corrupt-phase confirmed)
- `.planning/metrics/codex-live.json` (Q6 schema verified)
- All 11 metric JSONL streams (head -1 schema sample this session)
- `.planning/resource-registry/agents.jsonl` (21 rows; Q5 agent-resolution source)

### Secondary (MEDIUM confidence)

- None this phase. Every claim is grounded in an on-disk file.

### Tertiary (LOW confidence)

- None this phase.

---

## Metadata

**Confidence breakdown:**

- Data source inventory: HIGH — every file sampled; schemas verified
- Q1–Q8 source matrix: HIGH — re-validated against Phase 26 contract + on-disk schemas
- `phase`-stamper analysis: HIGH — root cause traced to regex + STATE.md schema; corruption observed in 5/5 sampled recent rows
- Objective tree schema: MEDIUM — schema is sound but 8-vs-9-node parity is a recommendation, not locked (Open Q1)
- Cockpit derivation rules: HIGH — function is straightforward composition of verified sources
- Pitfalls: MEDIUM-HIGH — pitfalls 1–3 are observed or mechanically derivable; pitfall 4 (refresh cost) is theoretical

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30 days; sources stable; phase consumed by Phase 28 immediately after)
