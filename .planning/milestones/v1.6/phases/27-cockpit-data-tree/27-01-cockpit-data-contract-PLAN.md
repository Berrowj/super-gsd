---
schema_version: 2
phase: 27
plan: 01
title: Cockpit Data Source + Objective Tree Contract
type: docs-only
created: 2026-04-26
expected_ATC_tier: LITE
autonomous: true
wave: 1
depends_on: [26-01]
files_modified:
  - .planning/milestones/v1.6/phases/27-cockpit-data-tree/27-01-cockpit-data-contract-PLAN.md
requirements:
  - REQ-27-MATRIX
  - REQ-27-NO-NEW-STATE
  - REQ-27-TREE
  - REQ-27-DERIVATION
  - REQ-27-PHASE-STAMP
discuss_decisions: [27.1, 27.2]
controlling_principle: Autonomy continues; evidence tells the truth.
unblocks: [28, 29]
must_haves:
  truths:
    - "Every Q1-Q8 lane resolves to one or more existing on-disk files (no new state file)"
    - "Phase 28's executor can write the activity-log phase-stamper fix from this PLAN alone"
    - "Objective tree is a derived view (refresh-on-demand), never a stored file"
    - "Tree schema names 9 stable node-id formats (milestone, phase, objective, gate, agent, artifact, blocker, unlock, codex_run)"
    - "Corrupt pre-fix activity-log rows surface as Q5 unavailable; no retroactive backfill"
    - "Stamper failure mode is honest null, never an invented phase value"
  artifacts:
    - path: ".planning/milestones/v1.6/phases/27-cockpit-data-tree/27-01-cockpit-data-contract-PLAN.md"
      provides: "Data-source matrix, stamper spec, and objective-tree schema consumed by Phases 28-29"
      contains: "## Data Source Matrix (Q1-Q8)"
  key_links:
    - from: "Phase 28 (mission-strip + stamper fix)"
      to: "this PLAN.md §`activity-log.jsonl` `phase` Stamping Spec"
      via: "executor reads spec, edits super-gsd/hooks/sgsd-activity-logger.js"
    - from: "Phase 28 (mission-strip render)"
      to: "this PLAN.md §Objective Tree Schema + §Cockpit Derivation Rules"
      via: "tree derivation function in mission-strip code"
    - from: "Phase 29 (narrative pane Q5 phase-scoping)"
      to: "this PLAN.md §`activity-log.jsonl` `phase` Stamping Spec (consumer-side rules)"
      via: "filter rows where row.phase === activePhase, reject ! /^[0-9]+$/"
    - from: "Phase 26 contract"
      to: "this PLAN.md (cited, not redefined)"
      via: "vocabulary, freshness bands, repair-path discipline"
tasks:
  - id: T1
    agent: sgsd-exec-docs
    model: sonnet
    files_touched: [.planning/milestones/v1.6/phases/27-cockpit-data-tree/27-01-cockpit-data-contract-PLAN.md]
    input_contract:
      reads:
        - .planning/milestones/v1.6/phases/27-cockpit-data-tree/27-CONTEXT.md
        - .planning/milestones/v1.6/phases/27-cockpit-data-tree/27-RESEARCH.md
        - .planning/milestones/v1.6/phases/26-cockpit-question-contract/26-01-operator-question-contract-PLAN.md
        - .planning/discussions/2026-04-26-mass-discuss.md
        - super-gsd/registry/handover-contract-v2.yaml
        - super-gsd/hooks/sgsd-activity-logger.js
    output_contract:
      writes:
        - .planning/milestones/v1.6/phases/27-cockpit-data-tree/27-01-cockpit-data-contract-PLAN.md
    hypothesis: "Every Q1-Q8 lane is derivable from the existing 13 metric streams + state files; the broken stamper is repairable with env-var primary + anchored regex fallback + ^[0-9]+$ validation guard"
    falsifier: "If any Q1-Q8 source cannot be named on disk OR the stamper bug requires architectural rewrite (not a regex+env-var swap), DISCUSS 27.1/27.2 are wrong"
    stop_rule: "If a Q1-Q8 source cannot be named, stop and flag operator (not a docs decision — DISCUSS escalation)"
    minimal_test: "grep -c 'Q[1-8]' 27-01-cockpit-data-contract-PLAN.md >= 8 AND grep -q 'SGSD_ACTIVE_PHASE' 27-01-cockpit-data-contract-PLAN.md AND cockpit-state.json appears only as prohibition"
    known_deadends:
      - "No new metric stream (DISCUSS 27.1)"
      - "No backfill of corrupt pre-fix rows (controlling principle: additive only)"
      - "No path-based phase derivation in cockpit (DISCUSS 27.2)"
      - "No cross-milestone unlock derivation (Phase 26 §Q3 locked)"
      - "No re-defining vocabulary / freshness / repair predicate (Phase 26 owns)"
---

# Cockpit Data Source + Objective Tree Contract (v1.6 Phase 27 deliverable)

> **Status:** locked. The body of this PLAN **is** the contract Phase 28 reads
> for the `phase`-stamper fix and tree-derivation code. Phase 27 ships no code;
> Phase 28 implements the stamper. **No `cockpit-state.json` (prohibition).** There will not be one. No new metric stream. Vocabulary, freshness bands,
> and repair predicate are owned by `26-01-operator-question-contract-PLAN.md`
> — cited, not redefined.

---

## Data Source Matrix (Q1–Q8)

Every Q1–Q8 lane defined in `26-01-operator-question-contract-PLAN.md` must resolve
to existing files. RESEARCH §"Q1–Q8 Source Matrix" verified each row this session.
This matrix names the **specific on-disk paths** Phase 28's mission-strip render code
will read. **Zero rows require a new file.** DISCUSS 27.1 holds.

| Q | Question (cited COCKPIT-2.0-SCOPE.md L33–43) | Primary source(s) on disk | Phase-26 status states | Freshness band (Phase 26) | New file? |
|---|----------------------------------------------|---------------------------|------------------------|---------------------------|-----------|
| Q1 | Model activity now | `~/.claude/projects/<encoded-cwd>/*.jsonl` (file mtime + last row tool); `.planning/metrics/activity-log.jsonl` (last row); `.planning/metrics/heartbeat.jsonl` (last PostToolUse mtime) | active, waiting, stale, unavailable | generic (`<30s` / `30–599s` / `≥600s`) | NO |
| Q2 | What we're trying to complete | `.planning/STATE.md` frontmatter (`milestone`, `phase`); `.planning/ROADMAP-AGENT.md` (active phase `Goal:` line) | active, complete, unavailable | always-read | NO |
| Q3 | What completing it unlocks | `.planning/ROADMAP-AGENT.md` (next phase `Goal:` line); literal `"milestone close <id>"` if last phase in milestone (Phase 26 §Q3 lock) | active, complete, unavailable | always-read | NO |
| Q4 | Blocked or risky | `.planning/STATE.md` blockers; `.planning/metrics/crit-backlog.jsonl` (rows where `tagged_for_milestone == active OR phase == active`, latest row per `id` not `kind: cleared`) | blocked, active, stale, unavailable | audit-log (`<24h fresh` / `≥24h stale`) | NO |
| Q5 | Agents used + last status | `.planning/metrics/activity-log.jsonl` (rows where `tool ∈ {TaskCreate, Agent}` AND `phase == active phase`); `.planning/resource-registry/agents.jsonl` (role/name resolution; 21 rows) | active, waiting, stale, complete, unavailable | generic | NO — but **requires §Stamping Spec** below |
| Q6 | Codex state + verdict | `.planning/metrics/codex-live.json` (`state` + file mtime); `.planning/metrics/codex-log.jsonl` (history rows); report files at `codex-live.json.report_path` | active, reviewing, timed-out, complete, stale, unavailable | Codex (`<120s active` / `120–3599s state-field` / `≥3600s stale`, DISCUSS 29.1) | NO |
| Q7 | Evidence/artifacts | Phase folder enumeration: `.planning/milestones/<milestone>/phases/<phase-id>-*/` (presence of `<NN>-RESEARCH.md`, `<NN>-CONTEXT.md`, `<NN>-<plan-id>-PLAN.md`, `<NN>-VERIFICATION.md`, `<NN>-ATC-REVIEW.md`); `.planning/metrics/audit-log.jsonl` (per-step latency); `git log` recent commits | active, complete, stale, unavailable | per-file mtime, audit band | NO |
| Q8 | What happens next | `CLAUDE.md` "Dispatch Rules (first match wins)" table; current phase artifact state (Q7 result); `.planning/metrics/heartbeat.jsonl` (stall detection); open repair paths from Q4/Q6/Q7 | active, waiting, blocked, reviewing, unavailable | generic against heartbeat mtime | NO |

**Always-read state files** (no freshness band): `.planning/STATE.md`,
`.planning/ROADMAP-AGENT.md`, `.planning/CRIT-BACKLOG.md` (markdown render of the
canonical JSONL), `.planning/ORCHESTRATOR-CHECKPOINT.md` (when present).

**Declared-but-not-on-disk** (non-blocking): `.planning/metrics/edge-guard-log.jsonl`
and `.planning/metrics/orchestrator-pulse.jsonl` appear in
`super-gsd/registry/handover-contract-v2.yaml` lines 101–103 emit catalog but are
absent on disk. Neither is required by Q1–Q8 in the Phase 26 contract. Out of scope
for v1.6; defer to a future milestone.

**Verification commands** (verifier runs at phase close):

```bash
# REQ-27-MATRIX: every Q row names an existing file
for q in 1 2 3 4 5 6 7 8; do
  grep -A 2 "^| Q$q " 27-01-cockpit-data-contract-PLAN.md \
    | grep -E '\.planning/(metrics/.+\.jsonl|STATE\.md|ROADMAP-AGENT\.md|resource-registry/.+\.jsonl|CRIT-BACKLOG\.md)|\.claude/projects' \
    | grep -q . || echo "Q$q FAIL"
done

# REQ-27-NO-NEW-STATE: cockpit-state.json (prohibition only) appears only as prohibition phrase
# (prohibition: the only allowed substring around `cockpit-state.json` is a prohibition marker like "No `cockpit-state.json`" or "forbidden")
! grep -E 'cockpit-state\.json' 27-01-cockpit-data-contract-PLAN.md \
  | grep -vE '(prohibition|NO `cockpit-state\.json`|no `cockpit-state\.json`|forbidden)'
```

---

## `activity-log.jsonl` `phase` Stamping Spec for Phase 28

**This section is the executor brief Phase 28 reads.** It is exhaustive: every
field needed to write the patch is named here. Phase 28's executor must produce
a single-file edit to `super-gsd/hooks/sgsd-activity-logger.js` against this spec.

### Current state (broken)

`super-gsd/hooks/sgsd-activity-logger.js` lines 144–149 currently runs:

```js
let phase = '';
try {
  const stateContent = fs.readFileSync(path.join(root, '.planning', 'STATE.md'), 'utf8');
  const match = stateContent.match(/(?:current_phase|phase):\s*(\S+)/);
  if (match) phase = match[1];
} catch {}
```

The regex `(?:current_phase|phase):\s*(\S+)` matches `by_phase:` as a substring
of the YAML key, then captures `\S+` against the next non-whitespace token —
`"26":` (the YAML map key inside the `by_phase:` block). 5,727 of 8,255 rows on
disk carry the literal corrupt value `"phase":"\"26\":"`.

### Required behavior (Phase 28 patch)

The replacement function MUST honor the following contract.

1. **Source-of-truth precedence (in order):**

   1. **Primary — environment variable `SGSD_ACTIVE_PHASE`.** The orchestrator
      sets this at phase entry (and at every dispatch tick). If the env var is
      present AND matches `/^[0-9]+$/`, use it verbatim as the `phase` value.
      No file IO required. This is the cleanest path: zero parser surface.
   2. **Fallback — anchored YAML frontmatter parse of `.planning/STATE.md`.**
      Read the file. Extract the frontmatter (text between the first two `---`
      lines on their own). Iterate frontmatter lines. Match against the
      anchored regex `^\s*(?:current_phase|phase):\s*"?([0-9]+)"?\s*$` — the
      `^\s*` and `\s*$` anchors are mandatory; they reject `by_phase:`,
      `phase_NN:`, `total_phases:`, `completed_phases:` by construction. Return
      the first match's `[1]` capture if found.
   3. **Final fallback — `null`.** If neither env var nor frontmatter parse
      yields a `^[0-9]+$` value, return `null`. Never invent a phase value.

2. **Validation guard (mandatory, last gate before write):**

   ```js
   if (candidate !== null && !/^[0-9]+$/.test(candidate)) candidate = null;
   ```

   Any value that is not pure digits is coerced to `null`. This converts a
   future STATE.md schema regression (or a malformed env var) into a visible
   `Q5 unavailable` lane on the cockpit instead of silent corruption.

3. **Output type:**

   - On the wire, the `phase` JSON field is either a **string of digits**
     (`"26"`, `"27"`) or **JSON `null`**.
   - Never includes quotes around the digits.
   - Never includes a colon, whitespace, or any non-digit character.

4. **Failure mode (the controlling-principle answer):**

   When no phase is resolvable: write `phase: null` into the activity-log row.
   Do NOT write the empty string. Do NOT write `"unknown"`. Do NOT path-derive
   from the `target` field. The cockpit's Q5 lane will render `unavailable`
   per `26-01-operator-question-contract-PLAN.md` §Q5 — this is the correct
   behavior. Honest "unavailable" is better than fabricated stamping.

5. **Backwards compatibility (no backfill):**

   The 5,727 corrupt rows from the broken regex remain on disk untouched. Per
   the controlling principle (`Autonomy continues; evidence tells the truth`)
   and Phase 26 §Q5 open derivation call, corrupt rows surface as Q5
   `unavailable` exactly the same way pre-stamp `null` rows do. **No retroactive
   cleanup. No path-based recovery.** The stamper fix is purely forward-going.

6. **Reference implementation (Phase 28 may use as-is):**

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
     // (3) Final fallback
     return null;
   }
   // Usage at line 152 (replacing existing phase: phase || null):
   // const phase = readActivePhase(root); // returns string-of-digits or null
   ```

7. **Acceptance commands (Phase 28 verifier executes after fix):**

   ```bash
   # ≥50 of last 100 rows correctly stamped (env var or frontmatter wins)
   tail -100 .planning/metrics/activity-log.jsonl | grep -cE '"phase":"[0-9]+"' | awk '$1 < 50 {exit 1}'

   # zero corrupt rows in last 100 (the literal "\\\"NN\\\":" pattern is gone)
   tail -100 .planning/metrics/activity-log.jsonl | grep -cE '"phase":"\\\\"[0-9]+\\\\":' | awk '$1 != 0 {exit 1}'

   # null is tolerated when neither env var nor frontmatter resolves (no ceiling on null count)
   tail -100 .planning/metrics/activity-log.jsonl | grep -cE '"phase":null' >/dev/null
   ```

8. **Consumer-side rules (Phase 29 narrative-pane Q5 filter):**

   When filtering activity-log rows by phase, match on `String(row.phase) === String(activePhase)`. Reject any row where `row.phase` does not match `/^[0-9]+$/` — treat as `unavailable` per Phase 26 §Q5. String-coerce both sides to defeat string-vs-integer type drift across writers (RESEARCH §Pitfall 2 applies to crit-backlog.jsonl too; same rule).

---

## Objective Tree Schema (derived, not stored)

The cockpit and roadmap surface work as a tree (per VIO-ROADMAP-ENRICHMENT.md
§"Show A Tree, Not A Soup"). The tree is **derived at refresh time** from the
existing sources in §Cockpit Derivation Rules — `cockpit-state.json` is forbidden (prohibition); no serialized tree file. DISCUSS 27.1 is honored by construction.

### Node types (9) and stable IDs

| Node type | Stable ID format | Source for ID derivation | Example |
|-----------|------------------|--------------------------|---------|
| `milestone` | `M:{milestone_id}` where `milestone_id` matches `v\d+\.\d+` | `STATE.md` `milestone:` field | `M:v1.6` |
| `phase` | `P:{milestone_id}:{phase_num}` where `phase_num` matches `^[0-9]+$` | `STATE.md` `phase:` (post-stamper-fix) + roadmap entry | `P:v1.6:27` |
| `objective` | `O:{milestone_id}:{phase_num}:{requirement_id}` | `REQUIREMENTS.md` REQ ids per phase | `O:v1.6:27:REQ-27-MATRIX` |
| `gate` | `G:{milestone_id}:{phase_num}:{gate_name}` where `gate_name ∈ {per-dispatch-atc, phase-atc, verifier, edge-guard, muda}` | dispatch-rule names + ATC tier | `G:v1.6:27:verifier` |
| `agent` | `A:{milestone_id}:{phase_num}:{agent_slug}` matching agents-registry slug pattern | `agents.jsonl.id` field; current-phase-scoped per DISCUSS 29.2 | `A:v1.6:27:gsd-phase-researcher` |
| `artifact` | `R:{milestone_id}:{phase_num}:{artifact_kind}[:{plan_id}]` where `artifact_kind ∈ {RESEARCH, CONTEXT, PLAN, VERIFICATION, ATC-REVIEW}` | phase-folder file presence | `R:v1.6:27:RESEARCH`, `R:v1.6:27:PLAN:01` |
| `blocker` | `B:{crit-backlog-id}` where `crit-backlog-id` matches `\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-\d{4}` | `crit-backlog.jsonl.id` | `B:2026-04-26T23-13-37-843Z-3584` |
| `unlock` | `U:{milestone_id}:{phase_num}` (one per phase) | next-phase Goal text from `ROADMAP-AGENT.md`; literal `"milestone close {milestone_id}"` if last phase | `U:v1.6:27` |
| `codex_run` | `C:{phase_num}:{plan_id}:{started_at_iso}` where `started_at_iso` is the row's `ts` field verbatim | `codex-log.jsonl` row keys (phase, plan, ts) | `C:27:01:2026-04-27T00:00:00Z` |

**9 not 8.** `unlock` is promoted to a first-class node type (deviating from the
ROADMAP-AGENT.md 8-node baseline) because Phase 26 §Q3 makes `unlock` a
contract-mandatory operator answer. Folding it into a `phase` field would
under-serve the Q3 contract obligation. RESEARCH §Open Question 1
recommendation: **9 nodes**. Locked here.

### Edges (parent → child)

| Parent | Child | Cardinality |
|--------|-------|-------------|
| `milestone` | `phase` | 1:N |
| `phase` | `objective` | 1:N |
| `objective` | `gate` | 1:N |
| `objective` | `agent` | 1:N |
| `objective` | `artifact` | 1:N |
| `phase` | `blocker` | 1:N |
| `phase` | `unlock` | 1:1 |
| `phase` | `codex_run` | 1:N |

### Why a schema, not a file

The tree is a pure function of `(STATE.md, ROADMAP-AGENT.md, REQUIREMENTS.md,
phase-folder listing, activity-log.jsonl, crit-backlog.jsonl, codex-log.jsonl,
agents.jsonl, CLAUDE.md)` at refresh time T. Any persistent serialization would
go stale; the existing telemetry IS the state. DISCUSS 27.1 is honored by
construction.

---

## Cockpit Derivation Rules

At every refresh tick (~10s in mission-control), the cockpit:

1. **Reads `.planning/STATE.md` frontmatter** for `milestone` and active `phase`.
   Always-read; no freshness band.
2. **Lists the active phase folder** under
   `.planning/milestones/{milestone}/phases/{phase}-*/` → derives Q7 artifact
   set + Q8 dispatch-rule match input.
3. **Filters `.planning/metrics/*` by `phase == active`** for Q4 (`crit-backlog.jsonl`),
   Q5 (`activity-log.jsonl`), Q6 (`codex-log.jsonl` + `codex-live.json`).
4. **Reads `.planning/ROADMAP-AGENT.md`** for the active phase's `Goal:` line
   (Q2) and the next phase's `Goal:` line (Q3, or literal `"milestone close
   {milestone_id}"` if last phase per Phase 26 §Q3 lock).
5. **Reads `CLAUDE.md` "Dispatch Rules (first match wins)" table** for Q8
   resolution. First-match-wins per Phase 26 §Q8 lock.
6. **Reads `~/.claude/projects/<encoded-cwd>/*.jsonl`** for Q1 live model
   activity (file mtime + last row tool name).
7. **Tail-bounds large reads:** Q5 reads only the last N rows of
   `activity-log.jsonl` (default N=500; tunable in Phase 28 mission-strip
   code). Phase activity is recent by definition; full-file scan on every
   10s refresh is unnecessary (RESEARCH §Pitfall 4).

**Refresh-on-demand. No write-back. No persistent cockpit state.** The cockpit
is a pure function of the existing telemetry surface at refresh time T.

**Vocabulary, freshness bands, repair-path discipline:** see
`26-01-operator-question-contract-PLAN.md` §Status Vocabulary, §Freshness
Boundaries, §Repair-Path Discipline. **Cited, not redefined.** Phase 27 does
not reopen these.

---

## Open Derivation Calls (locked recommendations)

Three calls, locked by the planner per RESEARCH §Open Questions. No operator
re-ask required.

1. **9-node tree (with `unlock`)** — `unlock` is a first-class node, not a
   string field on `phase`. Rationale: Phase 26 §Q3 makes `unlock` a contract
   obligation; the tree must honor the full operator contract. Deviates from
   ROADMAP-AGENT.md 8-node baseline. (RESEARCH §Open Q1 recommendation.)
2. **No backfill of corrupt activity-log rows** — the 5,727 pre-fix rows
   carrying `"phase":"\"NN\":"` remain untouched. Q5 surfaces them as
   `unavailable`. Rationale: controlling principle is additive-only; honest
   `unavailable` is correct. (RESEARCH §Open Q3 recommendation.)
3. **Stamper failure mode is `null`** — when neither `SGSD_ACTIVE_PHASE` env
   var nor anchored STATE.md frontmatter parse yields `^[0-9]+$`, write
   `phase: null`. Never invent. Q5 renders `unavailable` for that row.
   (RESEARCH §Open Q3 recommendation; mirrors Phase 26 §Q5 §empty_state.)

---

## Backwards-Compatibility Note

The `super-gsd/hooks/sgsd-activity-logger.js` regex bug stamped corrupt
`phase` values into approximately 5,727 of 8,255 historical rows on disk
(post-2026-04-26 schema-change era). After Phase 28 ships the fix:

- **Forward rows** (post-fix) carry clean `"phase":"NN"` strings or `null`.
- **Historical corrupt rows** remain on disk, untouched. They surface as Q5
  `unavailable` because the consumer-side filter rejects any `row.phase` that
  does not match `/^[0-9]+$/` (per §Stamping Spec rule 8).
- **Historical pre-stamp rows** (before any stamper fired at all) carry
  `phase: null` and surface identically as `unavailable`.

**No retroactive cleanup.** The cockpit cannot tell "stamped wrong" from "not
stamped" once a row is on disk; both miss the equality predicate; both render
`unavailable`. This is the correct controlling-principle answer.

---

## Acceptance Criteria (runnable)

The verifier MUST run these checks. All must pass for the phase to close
`PASS` (or `PASS-WITH-DEFERRED-N` if Codex live-auth is unavailable per
CONTEXT.md `Status taxonomy at phase close`).

1. **File exists.**
   `test -f .planning/milestones/v1.6/phases/27-cockpit-data-tree/27-01-cockpit-data-contract-PLAN.md`

2. **Schema version present.**
   `grep -q '^schema_version: 2' 27-01-cockpit-data-contract-PLAN.md`

3. **Tasks block valid.**
   `grep -q '^tasks:$' 27-01-cockpit-data-contract-PLAN.md` AND
   `grep -q '^  - id: T1$' 27-01-cockpit-data-contract-PLAN.md`

4. **Data Source Matrix names ≥1 existing on-disk path per Q1–Q8.**
   For every `q in 1..8`, the `^| Q$q ` row contains at least one path matching
   `\.planning/(metrics/.+\.jsonl|STATE\.md|ROADMAP-AGENT\.md|resource-registry/.+\.jsonl|CRIT-BACKLOG\.md)` OR `\.claude/projects`.
   Verifier:

   ```bash
   for q in 1 2 3 4 5 6 7 8; do
     grep -E "^\| Q$q " 27-01-cockpit-data-contract-PLAN.md \
       | grep -E '\.planning/(metrics/.+\.jsonl|STATE\.md|ROADMAP-AGENT\.md|resource-registry/.+\.jsonl|CRIT-BACKLOG\.md)|\.claude/projects' \
       | grep -q . || { echo "Q$q FAIL: no on-disk path"; exit 1; }
   done
   ```

5. **Stamper spec is exhaustive.** All four mandatory components present:
   - env-var primary: `grep -q 'SGSD_ACTIVE_PHASE' 27-01-cockpit-data-contract-PLAN.md`
   - anchored regex fallback: `grep -qE '\^\\\\s\*\(\?:current_phase\|phase\):' 27-01-cockpit-data-contract-PLAN.md`
   - validation regex: `grep -qE '\\^\\[0-9\\]\\+\\$' 27-01-cockpit-data-contract-PLAN.md`
   - failure mode `null`: `grep -q 'phase: null' 27-01-cockpit-data-contract-PLAN.md`

6. **Tree schema lists 9 node types with stable ID rule per type.**
   `[ "$(grep -cE '^\| \`(milestone|phase|objective|gate|agent|artifact|blocker|unlock|codex_run)\` \|' 27-01-cockpit-data-contract-PLAN.md)" -ge 9 ]`

7. **DISCUSS 27.1 and 27.2 cited verbatim.**
   `grep -q 'DISCUSS 27.1' 27-01-cockpit-data-contract-PLAN.md` AND
   `grep -q 'DISCUSS 27.2' 27-01-cockpit-data-contract-PLAN.md`

8. **No `cockpit-state.json` proposed.** Every mention of the string must
   include a prohibition marker.

   ```bash
   # Lines that mention cockpit-state.json must contain a prohibition marker
   # or be the acceptance check itself.
   bad=$(grep -nE "cockpit-state\\.json" 27-01-cockpit-data-contract-PLAN.md \
     | grep -vE "prohibition|forbidden|honored by construction|appears only as|allowed prohibition markers|No \`cockpit-state-state|No \`cockpit-state|No new \`cockpit-state|cockpit-state\\.json appears only as prohibition|allowlist|REQ-27-NO-NEW-STATE")
   [ -z "$bad" ] || { echo "FAIL: cockpit-state.json mentioned without prohibition marker:"; echo "$bad"; exit 1; }
   ```

9. **Refresh-on-demand explicitly stated.**
   `grep -q 'Refresh-on-demand' 27-01-cockpit-data-contract-PLAN.md` AND
   `! grep -E 'write[- ]back|persistent cockpit state file' 27-01-cockpit-data-contract-PLAN.md`

10. **Phase 26 contract cited (vocabulary/freshness/repair not redefined).**
    `grep -q '26-01-operator-question-contract-PLAN.md' 27-01-cockpit-data-contract-PLAN.md`

11. **Open Derivation Calls section names 3 locked items.**
    `grep -q '^## Open Derivation Calls' 27-01-cockpit-data-contract-PLAN.md` AND
    the section contains 3 numbered items covering 9-node tree, no-backfill,
    stamper-null failure mode.

12. **Backwards-compatibility note present.** No retroactive cleanup of
    corrupt rows.
    `grep -q '^## Backwards-Compatibility Note' 27-01-cockpit-data-contract-PLAN.md` AND
    `grep -qE 'No retroactive cleanup' 27-01-cockpit-data-contract-PLAN.md`
