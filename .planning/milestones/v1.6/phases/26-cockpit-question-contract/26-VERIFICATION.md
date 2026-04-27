---
phase: 26
status: PASS
verified: 2026-04-26
verifier: gsd-verifier
goal_achieved: true
score: 10/10 goal-backward checks
overrides_applied: 0
must_haves_score: 7/7 truths verified
deferred_count: 1
deferred_summary:
  - kind: verifier_fail
    summary: live Codex auth unavailable; fallback used (codex-exec.sh --self-test exit 11)
    backlog_row: 2026-04-26T23-13-37-843Z-3584
    evidence: .planning/milestones/v1.6/MILESTONE-READINESS.md
post_step9_update: |
  Original verifier verdict was PASS at Step 8. Step 9 (phase-level ATC)
  raised W1 (Q5 freshness band divergence) — fixed in-loop with 1-line
  annotation in PLAN.md, no backlog row. Step 9 Codex side returned
  provider_unavailable per readiness manifest — backlog row appended.
  Status downgraded from PASS to PASS-WITH-DEFERRED-1 to honor the
  controlling principle (autonomy continues; evidence tells the truth).
---

# Phase 26 — Cockpit Operator Question Contract — Verification Report

**Phase goal (cited from CONTEXT.md):** Define a contract that names the 8
operator questions the cockpit must answer, with closed status vocabulary
(8 states), freshness boundaries (no gap), and repair-path discipline (text
+ optional safe `repair_command`). The contract must be unambiguous enough
that Phases 27–30 can consume it directly without re-asking design
questions.

**Verification mode:** Initial verification (no prior VERIFICATION.md).
**Scope:** docs-only. Single deliverable
`26-01-operator-question-contract-PLAN.md` (553 lines).

---

## Per-Check Verdict (10 goal-backward checks)

| # | Check                                                                      | Verdict | Evidence |
|---|----------------------------------------------------------------------------|---------|----------|
| 1 | All 8 operator questions Q1–Q8 present                                     | PASS    | `grep -c '^### Q[1-8] ' PLAN.md == 8` |
| 2 | Each Q has the 5 mandatory subfields                                       | PASS    | Per-Q awk-block grep returned 5/5 for every Q1–Q8 |
| 3 | 8-state vocabulary documented as closed; `unavailable` and `stale` distinct | PASS    | Vocabulary table has 8 rows; `stale` ("file too old") and `unavailable` ("file missing entirely") have distinct Meaning columns |
| 4 | Freshness boundaries cover every Δ ≥ 0 with no gap; proof present          | PASS    | `**No-gap proof.**` subsection covers generic / Codex / audit-log classes; bands are half-open and exhaustive (`<30s`, `30–599s`, `≥600s` etc.) |
| 5 | 4-AND repair_command predicate enumerated + disallowed-pattern list        | PASS    | 4 numbered conditions (Deterministic / Safe / Local / Auth-free); disallowed list includes `git push`, `rm -rf`, `curl`, `wget`, `--force`, `gh `, `mcp__`, `*TOKEN*` |
| 6 | Where `repair_command:` is shipped, all 4 predicates pass                  | PASS    | Exactly 1 `repair_command` ships (Q4-stale → `node super-gsd/scripts/lib/crit-backlog.cjs --render`); inline predicate verification confirms deterministic + safe + local + auth-free |
| 7 | Contract consumable by Phases 27–30 without re-asking design               | PASS    | See "Phases 27–30 consumability" section below |
| 8 | No `cockpit-state.json` proposal (DISCUSS 27.1 = NO)                       | PASS    | Two mentions of `cockpit-state.json` in PLAN.md — both are explicit prohibitions ("Do not propose…", "No `cockpit-state.json`") |
| 9 | No new metric stream proposed                                              | PASS    | "No new telemetry stream is permitted" + falsifier line "If any Q1–Q8 lane requires a new state file, the no-cockpit-state-file decision is wrong" |
| 10 | DISCUSS verbatim citations present                                        | PASS    | `DISCUSS 26.1`, `DISCUSS 26.2`, `DISCUSS 26.3` each cited with verbatim quoted text from `2026-04-26-mass-discuss.md` lines 168–170 |

**Score: 10/10**

---

## Must-Haves (frontmatter truths)

| # | Truth                                                                              | Status |
|---|------------------------------------------------------------------------------------|--------|
| 1 | Cockpit can answer all 8 operator questions from existing 13 metric streams       | VERIFIED — every Q1–Q8 names sources from existing logs / state files only |
| 2 | Each Q has a named primary source with file path                                  | VERIFIED — every `**Primary source(s):**` block lists concrete `.planning/...` paths |
| 3 | Each Q has applicable status states drawn from the 8 closed vocabulary            | VERIFIED — applicable-state lists are subsets of the 8-state vocabulary |
| 4 | Each Q has a freshness rule whose bands cover every second (no gap)               | VERIFIED — `**Freshness rule:**` per-Q + No-gap proof in §Freshness |
| 5 | Each Q has a mandatory `repair_instruction` text                                  | VERIFIED — every Q ships `**repair_instruction:**` in plain English |
| 6 | A `repair_command` appears only when the 4-AND predicate passes                   | VERIFIED — only Q4-stale ships a command; inline predicate verification confirms all 4 conditions hold; all other Qs explicitly state the omission reason |
| 7 | `stale` and `unavailable` are never collapsed                                     | VERIFIED — vocabulary table keeps them distinct; "Distinction guarantee" paragraph explicitly forbids collapse; Phase 33 schema-load checker contract reaffirms |

**Score: 7/7**

---

## Phases 27–30 Consumability Assessment

| Downstream phase | Question it would re-ask | Answer in 26-01-PLAN.md? | Status |
|------------------|--------------------------|--------------------------|--------|
| **Phase 27** (data contract / schema-load) | "What freshness bands apply to `codex-live.json`?" | Yes — Freshness Boundaries table row 4: `<120s active(running) / 120–3599s state-field / ≥3600s stale (overrides)` | CONSUMABLE |
| **Phase 27** | "What disallowed patterns must the schema-load checker reject?" | Yes — explicit Disallowed-pattern list with 8 categories | CONSUMABLE |
| **Phase 28** (mission-strip render) | "Which states map to which strip lanes?" | Yes — Architectural Responsibility Map assigns owner per Q1–Q8 (Mission Strip vs. body pane) | CONSUMABLE |
| **Phase 28** | "What color does `timed-out` map to?" | NO — color mapping is intentionally not a contract concern (Phase 28 render decision). Vocabulary names the state and its terminal-flag; rendering is downstream. | DEFERRED-BY-DESIGN (not a gap) |
| **Phase 29** (narrative pane / Q5 scoping) | "How do we filter agents to current-phase only?" | Yes — Q5 names `phase`-field on `activity-log.jsonl` rows (DISCUSS 27.2 stamper) and the open derivation call locks the pre-stamp fallback to `unavailable` | CONSUMABLE |
| **Phase 30** (acceptance harness) | "What 8 states must each scenario verify?" | Yes — vocabulary table + per-Q applicable states + repair-path discipline; all 8 acceptance scenarios can be derived from the contract | CONSUMABLE |

**Verdict:** All four downstream phases can consume the contract without
operator re-ask. The single "DEFERRED-BY-DESIGN" item (color mapping) is
explicitly out of contract scope per the architecture map (rendering is a
Phase 28 concern, not a contract concern).

---

## Anti-Pattern Scan

- No `TODO` / `FIXME` / `XXX` markers.
- No `repair_command: null` or `repair_command: ""` patterns (predicate
  failures are omitted entirely, with a 1-line reason — verified by `! grep
  -E 'repair_command:\s*(null|"")'` returning empty).
- No new telemetry stream proposed.
- No `cockpit-state.json` proposed (only forbidden).

---

## Acceptance Commands (runnable, re-prove the goal)

```bash
PLAN=.planning/milestones/v1.6/phases/26-cockpit-question-contract/26-01-operator-question-contract-PLAN.md

# 1. All 8 Q sections
test "$(grep -c '^### Q[1-8] ' "$PLAN")" -eq 8

# 2. 5 mandatory subfields per Q
for q in 1 2 3 4 5 6 7 8; do
  c=$(awk "/^### Q$q /,/^### Q$((q+1)) |^---$/" "$PLAN" \
    | grep -cE '\*\*Primary source\(s\):\*\*|\*\*Applicable status states:\*\*|\*\*Freshness rule:\*\*|\*\*empty_state:\*\*|\*\*repair_instruction:\*\*')
  test "$c" -eq 5 || echo "Q$q FAIL: $c/5"
done

# 3. 8-state vocabulary closed; stale != unavailable
for s in active waiting blocked reviewing timed-out stale complete unavailable; do
  test "$(grep -c "^| \`$s\`" "$PLAN")" -ge 1 || echo "vocab miss: $s"
done

# 4. No-gap proof present
grep -q '^\*\*No-gap proof\.' "$PLAN"

# 5. 4-AND predicate + disallowed list
grep -q '^### 4-AND Predicate' "$PLAN"
test "$(grep -cE '^[0-9]\. \*\*(Deterministic|Safe|Local|Auth-free)\*\*' "$PLAN")" -eq 4
grep -q '^### Disallowed-pattern list' "$PLAN"

# 6. No null/empty repair_command
! grep -E 'repair_command:\s*(null|"")' "$PLAN"

# 7. DISCUSS citations
grep -qE 'DISCUSS 26\.1' "$PLAN" && grep -qE 'DISCUSS 26\.2' "$PLAN" && grep -qE 'DISCUSS 26\.3' "$PLAN"

# 8. crit-backlog lib (only shipped repair_command) self-tests
node super-gsd/scripts/lib/crit-backlog.cjs --self-test  # → "crit-backlog self-test: PASS"
```

All commands pass on the current tree.

---

## Deferred to Backlog

None foreseen at this layer. Phase 26 deliverable is complete and
goal-consistent.

**Note (informational, not a gap):** Per CONTEXT.md, Phase 26 may close as
`PASS-WITH-DEFERRED-1` if Step 9 phase-level ATC cannot reach live Codex
(MILESTONE-READINESS DEGRADED-PATH). That deferral is owned by Step 9
(phase-level ATC), not this verifier. If it lands, it produces a
`verifier_fail` row keyed "live Codex auth unavailable; fallback used" — Step 9
appends, not Step 8.

---

## Status: PASS

All 10 goal-backward checks pass. All 7 must-have truths verified. Phases
27–30 consumability probes confirm the contract is actionable without
operator re-ask. No code changes (docs-only). No anti-patterns. No CRIT
findings.

_Verified: 2026-04-26_
_Verifier: gsd-verifier (Step 8 Phase 26)_
