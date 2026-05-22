---
title: Mass discuss for v1.6 → v2.1 full-roadmap autopilot
date: 2026-04-26
scope: substitutes for /gsd-discuss-phase across phases 26-55 (with 5 phases pre-discussed live; remainder auto-defaulted)
status: locked
operator: user
controlling_principle: Autonomy continues; evidence tells the truth.
---

# Mass Discussion — v1.6 → v2.1 (Phases 26–55)

This is the canonical record of pre-execution decisions for the full SGSD
roadmap autopilot run. It substitutes for per-phase `/gsd-discuss-phase`
interactive sessions. The roadmap document (`.planning/ROADMAP-AGENT.md`)
references this file for every phase; the orchestrator must consume both.

A previous attempt shipped 30 phases as scaffolding without honoring the
SGSD workflow. That run was reset (`git reset --hard 4b2ad5c`). This
document encodes the lessons.

---

## Controlling Principle

> **Autonomy continues; evidence tells the truth.**

Auto mode does not halt on ATC CRIT, verifier FAIL, or edge-guard miss
after the retry budget is exhausted. It:

1. Retries up to the configured attempt limit (default 3)
2. Appends the unresolved issue to `.planning/CRIT-BACKLOG.md`
3. Degrades the phase/milestone status honestly
4. Continues to the next operational step

Continuation is **never** recorded as clean success.

---

## Hard Bar (relaxed for autopilot, locked)

### What runs always (unchanged)

- Per-dispatch ATC (Codex + Claude reviewers — dual-provider contract from v1.5)
- Phase-level ATC at close (Codex + Claude)
- MUDA at phase close on the existing trigger predicate
- `gsd-verifier` real dispatch before phase close
- Edge-guard structural check on every step transition

### What changed (3-then-defer)

| Signal | Behavior |
|--------|----------|
| Per-dispatch ATC CRIT | 3 fix attempts → `CRIT-BACKLOG.md` → continue |
| Phase-level ATC CRIT | 3 fix attempts → backlog → continue |
| `gsd-verifier` FAIL on phase goal | 3 attempts → backlog → continue |
| Edge-guard missing emit | 3 retry-the-gate attempts → backlog → continue (degraded mode, see below) |
| MUDA findings | curated to memory; never block |

### Hard stops (the only autonomy halts)

- Credentials / API tokens / passwords required
- Destructive operation would affect files outside this repo
- Privacy / security judgment required from operator
- Runtime / filesystem cannot continue
- Operator approval explicitly required

Anything else: `CRIT-BACKLOG.md` + status downgrade + continue.

---

## Status Taxonomy (operational ≠ evidential)

### Phase status

| Status | Meaning |
|--------|---------|
| `PASS` | All gates green. Zero `CRIT-BACKLOG.md` rows tagged to this phase. |
| `PASS-WITH-DEFERRED-N` | Phase reached close. `N` deferred items (CRIT or verifier FAIL) tracked in backlog. **Not equivalent to `PASS`.** |
| `CANDIDATE-WITH-DEBT` | Phase reached close with at least one unresolved **structural** issue (edge_guard_miss). Strictly worse than `PASS-WITH-DEFERRED-N`. |

### Milestone status

| Status | Meaning |
|--------|---------|
| `SHIPPED` | All phases `PASS`. Zero backlog rows tagged to this milestone. |
| `SHIPPED-WITH-DEBT-N` | At least one phase `PASS-WITH-DEFERRED-N`; `N` total deferrals across the milestone. |
| `CANDIDATE` | At least one phase `CANDIDATE-WITH-DEBT`. Cannot be promoted to `SHIPPED` without first clearing structural debt. |

The orchestrator **never** writes `SHIPPED` to STATE.md or ROADMAP.md if
backlog rows exist for the milestone. Same for `PASS` at phase level.

---

## CRIT-BACKLOG schema (Patch 2 — canonical source is JSONL)

**Canonical source**: `.planning/metrics/crit-backlog.jsonl` (machine-readable,
append-only, one JSON object per line).
**Rendered view**: `.planning/CRIT-BACKLOG.md` (regenerated via
`node super-gsd/scripts/lib/crit-backlog.cjs --render`).

`release-readiness/score.cjs` and `tools/status-consistency/check.cjs` parse
the JSONL deterministically. Markdown alone is insufficient and is never the
source of truth.

Schema per row (one JSON object per line in the JSONL):

```json
{
  "id": "<auto: iso-ts-with-dashes-shorthash>",
  "kind": "per_dispatch_atc | phase_atc | verifier_fail | edge_guard_miss | cleared",
  "phase": "<phase id, nullable>",
  "plan": "<plan id, nullable>",
  "milestone": "<milestone version, nullable>",
  "attempts_made": "<int, 1-3, nullable>",
  "summary": "<single line, <120 chars>",
  "evidence_path": "<repo-relative path to ATC review or verifier output>",
  "last_diff_sha": "<git sha of last fix attempt commit, nullable>",
  "tagged_for_milestone": "<next-debt-milestone | specific id | unassigned>",
  "added_at": "<ISO timestamp>",
  "resolved_at": "<ISO timestamp, only on kind=cleared>",
  "resolved_by": "<who/what resolved, only on kind=cleared>"
}
```

Operator clears entries by appending a row with `kind: cleared` referencing the
original `id`. Unresolved = the latest row per id is not `kind: cleared`.

Lib API: `super-gsd/scripts/lib/crit-backlog.cjs` —
`appendRow / readRows / unresolvedRows / rowsForPhase / rowsForMilestone /
hasEdgeGuardMiss / renderMd / writeRender`. `--self-test` PASS, `--render`
regenerates the .md file from the .jsonl.

Surfaced at:
- Phase close: phase status string includes `(N deferred)` count
- Milestone close: milestone SUMMARY enumerates every entry
- Mission Strip: Q4 lane shows backlog count when >0
- `release-readiness/score.cjs`: hard precondition (see edge-guard rule)

---

## Edge-Guard Degraded-Mode Rule (strongest constraint)

When edge-guard detects missing emit and 3 retries fail to fire the gate:

1. **Append to `CRIT-BACKLOG.md`** with `kind: edge_guard_miss`
2. **Mark all downstream evidence** in this phase with `evidence_trust: degraded`
   in the artifact's frontmatter
3. **Phase status MUST be `CANDIDATE-WITH-DEBT`** (not `PASS-WITH-DEFERRED-N`)
4. **Milestone close lists every `edge_guard_miss`** in SUMMARY.md, separately
   from non-structural deferrals
5. **`release-readiness/score.cjs` returns RED** if any unresolved
   `edge_guard_miss` exists in `CRIT-BACKLOG.md`. **Non-overrideable.**
   v2.0 Phase 57 (was 50; renumbered 2026-04-27 by SGSD-Research promotion)
   enforces this as a hard precondition for green release readiness.

Operator can resolve by:
- Re-running the missing gate manually and updating the backlog row
- Removing the gate from the registry (with override-reason logged)
- Tagging the row to a future debt milestone (kicks the can; stays RED until cleared)

---

## Per-Phase Locked Decisions

### v1.6 Cockpit 2.0 (Phases 26–30) — interactive discussion completed

| Question | Decision |
|----------|----------|
| 26.1 Status vocabulary | 8 closed states: `active, waiting, blocked, reviewing, timed-out, stale, complete, unavailable` |
| **26.2 Freshness boundaries** | Closed, no gap: `<30s = active`, `30s–599s = waiting`, `≥600s = stale`. Codex: `<120s active (running) / ≥3600s stale`. Audit-log: `<24h fresh / ≥24h stale`. |
| **26.3 `repair_command` field** | Optional alongside mandatory `repair_instruction:` text. Allowed only if **deterministic AND safe AND local AND auth-free**. Disallowed: `git push`, `rm -rf`, `curl`/`wget`/HTTP calls, token-bearing commands, `--force` flags, destructive flags on shared files. Schema-load checker rejects offending commands. |
| 27.1 `cockpit-state.json` | NO. Cockpit derives state from existing 13 metric streams every refresh. |
| **27.2 `phase` field stamping** | Orchestrator stamps active phase ID into every `activity-log.jsonl` row (canonical). Path-based derivation removed. |
| 28.1 Strip position | Top of mission-control pane, replacing existing 1-line header. |
| 28.2 Strip line count | 6 lines: mission, objective+unlock, model, blocker, codex+agents, next. |
| 29.1 Codex stale threshold | 1 hour mtime. |
| 29.2 Agents pane scope | Current phase only. |
| **30.1 Acceptance breadth** | All 8 scenarios mandatory. Fixture-based verification permitted for the 3 hard cases (codex-timeout, forced-restart, codex-warned). No "live-only deferral" — every scenario produces evidence (live or fixture). |

### Phase 38 — Risk-Tiered Sampling (interactive)

| Question | Decision |
|----------|----------|
| 38.1 Work risk tiers | 3 tiers: `low`, `medium`, `high` |
| **38.2 Risk classifier inputs** | 4 primary: `diff_lines`, `files_touched_count`, `phase_type`, `phase_includes_security_review`. Plus 1 secondary: `gate_fitness_history` (read-only; bias weight ≤ 50% of any single primary signal; never writes back to log) |
| 38.3 Sampling matrix | Gate × work_risk: `always` fires regardless; `sampled-rate-50` fires {0%, 50%, 100%} on {low, med, high}; `low-risk-skip` fires {0%, 100%, 100%}. |
| 38.4 Default for unspecified gates | `always` |
| **38.5 Force/skip override** | `--force-gates` and `--skip-gates` both require `--override-reason="..."`. Reason logged to `route-decisions.jsonl` with `boundary=gate_override`. Override without reason is rejected. |

### Phase 41 (original) — Knowledge Provider Fallback (interactive) — RETIRED 2026-04-27

The original Phase 41 (Knowledge Provider Registry + Fallback Chain) was the
first phase of the original v1.9 (Knowledge + Memory Governance) milestone.
That milestone was SUPERSEDED on 2026-04-27 when SGSD-Research was promoted
to v1.9 (Option C in the operator slot decision). The original v1.9 plan
including this Phase 41 interactive lock is preserved at:

`.planning/archive/superseded/v1.9-knowledge-memory-governance/`

Original locks (now retired):

| Question | Decision (RETIRED) |
|----------|--------------------|
| 41.1 Default chain order | `vtp-mcp → sgsd-memory → local-knowledge → public-fallback` |
| 41.2 Fallback triggers | Fires immediately on `provider_unavailable` and `empty_hit`. Fires on `noisy_hit` only after one narrow-query retry. |
| 41.3 Per-query opt-out | `getProvider(name, { fallback: false }).query(q)` supported. |

The new Phase 41 (Baseline Token Attribution, part of v1.9 SGSD-Research)
is auto-defaulted; no interactive discuss required.

### v1.7 (31–35), v1.8 36/37/39/40, v1.9 (NEW SGSD-Research, 41–52), v2.0 (53–57), v2.1 (58–62) — auto-defaulted

For these phases, the operator confirmed "mostly defaults" against the
3-options-per-phase mass-table sent earlier in the discussion. The locked
recommendation per phase is preserved verbatim in the agent-readable roadmap
(`.planning/ROADMAP-AGENT.md`) and is summarized below for traceability.

**Renumber note (2026-04-27):** SGSD-Research promoted to v1.9 absorbed
the prior v1.9 (Knowledge + Memory) scope and shifted v2.0/v2.1 forward
by 7 phase numbers. Old phase numbers 41-45 are retired; new phase
numbers in the table below reflect the post-renumber state.

| Phase | Locked option | Rationale |
|------:|---------------|-----------|
| 31 | A — new envelope-v1, separate from handover-v2 / plan-schema-v2 | Different abstraction levels need different shapes |
| 32 | A — boundary-only logging (6 named decisions) | Avoids "log everything" trap |
| 33 | C — text + optional `repair_command` (under 26.3 constraints) | Text for humans, command for autonomous repair |
| 34 | C — aggregator + real-time writer | Closes v1.5 backfill gap AND captures forward |
| 35 | B — registries + frontmatter (no dependency graph) | Graph is gilding |
| 36 | B — outcome + retroactive fields, no cost telemetry | Cost is v2.0+ ops, not v1.8 fitness |
| 37 | A — heuristic deletion candidates only, no auto-disable | Auto-disable dangerous; operator review at close |
| 38 | C — gate × work intersection (locked above) | Full discussion completed |
| 39 | B — mechanical rubric + manual override at close | Auto-execute kills too dangerous |
| 40 | B — required + recommended file checks; no content schema | Content validation is auditor-creep |
| **v1.9 SGSD-Research (41-52)** | All auto-defaulted from handover packet | Evidence-driven scope from agent-context-bloat audit + VTP cross-check |
| 41 | Baseline Token Attribution | Measure first, optimize second |
| 42 | Token Budget Admission | Make bloat visible without halting autonomy |
| 43 | Phase Capsule Contract | Compress prior-phase context; canonical = .planning + git, capsule = projection |
| 44 | Legal Context Registry | Reject invented references at packet boundary |
| 45 | Context Packet Builder | Role-specific packets replace raw inheritance |
| 46 | SQLite Context Index | Rebuildable projection, never canonical |
| 47 | Dispatch Routing Substitution | Local script first, Codex for review, Claude for synthesis, VTP for uncertainty |
| 48 | Selective VTP Bridge | Route-gated VTP; MCP failures separated from research conclusions |
| 49 | Memory Governance Lifecycle | Promotion / demotion / revocation rules; complaints log |
| 50 | Cockpit Research Dashboard | Token spend + context source mix + active agents at a glance |
| 51 | Context Stress Benchmark | Prove ≥50% researcher token reduction with zero evidence loss |
| 52 | Redis Live Cache Adapter | Optional disposable projection; never canonical |
| **v2.0 Failure Injection (53-57; was 46-50)** | All locks shifted +7 | Renumbered by SGSD-Research promotion |
| 53 (was 46) | C — real tool invocation + container isolation | Mock predicates failed last run |
| 54 (was 47) | C — mid-phase kill simulation + manifest-shape tests (both) | Each alone misses cases |
| 55 (was 48) | B — tier + circuit breaker | Circuit is SpaceX pattern |
| 56 (was 49) | B — 6 happy + 4 adversarial scenarios | Adversarial is where hardening lives |
| 57 (was 50) | B — score gates milestone close | Non-gating score is what last run shipped and called green |
| **v2.1 Distribution + Onboarding (58-62; was 51-55)** | All locks shifted +7 | Renumbered by SGSD-Research promotion |
| 58 (was 51) | B — read-only audit + clean-room install test | Clean-room is the actual proof |
| 59 (was 52) | C — wrap sgsd-configure for knowledge/memory; new wizard owns project-level | Don't create second startup |
| 60 (was 53) | B — walkthrough + scaffolded `examples/hello-world/` runnable dir | Doc alone is paper |
| 61 (was 54) | C — README quick-start + VTP-optional callouts + "What This Repo Is For" preamble | Fixes recurring stranger confusion |
| 62 (was 55) | A — drift checker only | Migrations have all been additive; B/C is paper until non-additive break |

---

## What Auto Mode Will Do With This File

Each phase's roadmap entry has an `inputs:` block referencing this discussion.
Sub-agent dispatches receive the locked decision verbatim in their compressed
plan, removing per-phase Q&A turn cost.

If a sub-agent surfaces a question this file does not answer, the orchestrator:
1. Logs the question to `.planning/discussions/UNRESOLVED-QUESTIONS.md`
2. Picks the most conservative interpretation that respects the controlling principle
3. Notes the choice in the dispatch's report under `DEVIATIONS:`
4. Continues

If the question rises to operator-judgment-required level (security, privacy,
destructive), the orchestrator hits a hard stop and writes a checkpoint.
