# Phase 16: VTP Enrichment as Cross-Phase Primitive — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `16-CONTEXT.md` — this log preserves the alternatives considered and rationale.

**Date:** 2026-04-23
**Phase:** 16-vtp-enrichment
**Mode:** Remote-control (text mode — no AskUserQuestion)
**Areas discussed:** 9 open questions from seed (Q1–Q9) — resolved in sequence Q7, Q9, Q5, Q1, Q2, Q6, Q8, Q4, Q3
**Operator stance:** After Q1, operator set standing order "accept your recommendations unless super altering scope." Q3 explicitly re-confirmed as scope-altering; all others auto-accepted at Claude's pick.

---

## Q7 — Phase 16 vs Codex CLI Phases 14/15: ordering

**Seed framing:** Phase 16 should run first (operator leaning); needs confirmation.

| Option | Description | Selected |
|---|---|---|
| 1. Phase 16 first | Codex reviewers in 14/15 inherit VTP-grounded context from day one; Phase 15's qualitative MUDA probe measures signal (not vendor-diff noise). 1-phase delay on Codex substrate. | ✓ |
| 2. Phase 16 parallel to Phase 14 | Two independent tracks. Coordination risk — both touch reviewer-prompt composition. | |
| 3. Phase 16 after 14/15 (retrofit) | Ship Codex substrate first, retrofit VTP later. Phase 15's qualitative probe runs against un-grounded Codex reviewers — measure-noise-then-change-the-system drift. | |
| 4. Something else | | |

**User's choice:** 1 (accepted Claude's recommendation).
**Notes:** The Phase 15 integrity argument was decisive — if the MUDA probe can't trust its reviewer-context baseline, the whole qualitative overproduction signal is suspect. Ordering is now structural to v1.3's scientific validity, not merely convenience.

**Decision recorded as D-01.**

---

## Q9 — Installed-skill overlay drift resync

**Seed framing:** Installed `sgsd-triage` SKILL.md differs from source — seed recommended `/sgsd-overlay-refresh` first as safer.

**Evidence check performed mid-discussion:**
```
=== File sizes ===
10265 super-gsd/skills/sgsd-triage/SKILL.md
10454 C:/Users/jack.berrow/.claude/commands/sgsd-triage/SKILL.md

=== MD5 after normalizing line endings ===
241be8ec8f2357080662d6fbba73d601 (source)
241be8ec8f2357080662d6fbba73d601 (installed)
```

Line counts identical (189:189). Diff with `\r` stripped produces empty output. Drift is line-ending only (CRLF vs LF from Windows install).

| Option | Description | Selected |
|---|---|---|
| Patch source directly | CRLF drift is harness behaviour, not content divergence. No resync needed. | ✓ |
| `/sgsd-overlay-refresh` first | Would have been right if drift were real — wasn't. | |
| Investigate per-file before deciding | Evidence check resolved it immediately. | |

**User's choice:** (no prompt needed — evidence closed the question).
**Notes:** Classic seed-anxiety false positive from a detector that didn't normalize EOLs. Good candidate for tooling fix (noted in `<deferred>`).

**Decision recorded as D-02.**

---

## Q5 — Core GSD agents vs super-gsd overrides

**Seed framing:** Patch `custom-gsd-extract/claude-agents/gsd-*.md` directly, OR create `super-gsd/agents/sgsd-*.md` wrappers.

**Evidence check:**
- `super-gsd/agents/` contains 19 files — all genuinely new capability (board, ceo, executors, readiness, workflow-auditor). **None shadow an upstream `gsd-*` agent.**
- `custom-gsd-extract/claude-agents/` = vendored local fork (not a submodule), extracted 2026-04-08.
- Memory rule `feedback_sgsd_rename_rule.md` is binding: `sgsd-*` prefix only with genuine enrichment, no blanket renaming.

| Option | Description | Selected |
|---|---|---|
| A. Patch all 7 in-place | Zero new files, memory rule honoured, minimum blast radius. | ✓ |
| B. Patch 5 in-place, promote 2 (phase-researcher, planner) to sgsd-* | Strict reading of enrichment test — but tool-access ≠ new capability. Adds 2 files + dispatch-rule changes. | |
| C. Promote all 7 to sgsd-* | Violates memory rule (blanket rename). Rejected outright. | |

**User's choice:** A.
**Notes:** Promotion trigger explicitly recorded in D-03 deferred — >50 lines of new reasoning, expertise scaffolding, or changed output contract. Cheap to promote later; hard to un-promote.

**Decision recorded as D-03.**

---

## Q1 — Evidence caching vs per-agent re-query

**Seed framing:** Shared `VTP-EVIDENCE.md` artifact (can stale) vs per-agent re-query (always fresh, more stdio cost).

**Reframing during discussion:** Phase 32's `vtp_route_and_retrieve` returns TWO things — framing (`selected_query`) and evidence (retrieved docs). These have different sharing semantics. Framing should be shared (phase-level); evidence should be tier-specific (researcher wants papers, planner wants architecture). The seed's dichotomy conflated them.

| Option | Description | Selected |
|---|---|---|
| A. Framing-only artifact | VTP-EVIDENCE.md holds selected_query + reflection + top-3 doc-IDs. Each agent re-queries for tier-specific evidence. ≤300 lines, always-fresh-at-use. | ✓ |
| B. Framing + evidence bundle | VTP-EVIDENCE.md holds framing AND top-K evidence snippets. 1000-3000 lines. Can stale if phase >7 days. Two-tier call pattern. | |
| C. No shared artifact | Every agent calls VTP directly. Max stdio cost, zero staleness, zero bloat — but agents lose phase-scope framing. | |

**User's choice:** A.
**Notes:** This was the turning point of the discussion — reframing from cache-or-not into framing-vs-evidence made all subsequent questions clearer. After this answer, operator set the "accept recommendations unless scope-altering" standing order.

**Decision recorded as D-04.**

---

## Q2 — Context-composer scope

**Seed framing:** One shared composer, OR tier-specific composers.

| Option | Description | Selected |
|---|---|---|
| A. One composer + tier projections | `compose(state)` → full context; `project(ctx, tier)` → slice. DRY; expensive reads happen once; projections zero-cost. | ✓ |
| B. Tier-specific composers | `composeForTriage`, `composeForResearcher` etc. Per-tier exactness but duplicated state reads. | |
| C. Single composer + explicit include list | `compose({ include: [...] })`. Self-documenting but easy to miss a field. | |

**User's choice:** A (via standing auto-accept order — non-scope-altering).
**Notes:** Tier definitions for projection: `triage` (current_focus, recent_turns, recent_errors), `research` (current_focus, explicit_constraints, project_intent), `plan` (current_focus, project_intent, recent_commits), `pattern` (current_focus, recent_commits), `assumptions` (current_focus, recent_turns).

**Decision recorded as D-05.**

---

## Q6 — Triage Step 0 kill-switch

**Seed framing:** Explicit `--no-vtp` opt-out for fast/trivial, OR rely on Path D exemption.

**Reframing:** Path D doesn't reach triage. The `sgsd-triage` trigger section explicitly excludes trivial questions ("what's the current phase?", direct execution requests, mid-build fixes). So Step 0 only runs on non-trivial queries by design. The real question is what to ship for edge cases (VTP offline, debugging).

| Option | Description | Selected |
|---|---|---|
| A. No kill-switch; always-on + config toggle | Trigger already excludes trivial. Ship `workflow.triage_vtp_enrichment: true` default for system-wide disable. | ✓ |
| B. Per-call `--no-vtp` flag | Emergency opt-out per invocation. Operator cognition cost. | |
| C. No mechanism at all | Nothing for edge cases. Hard-coded on. | |

**User's choice:** A (via standing auto-accept order).
**Notes:** Operator verbatim directive ("each time I ask a question I want VTP to do its job") is the strongest signal here — always-on matches intent. Config toggle is the one concession to operational reality.

**Decision recorded as D-06.**

---

## Q8 — Latency + cost budget

**Seed framing:** What latency is acceptable for the 12-step Phase-32 chain? Fast-path short-circuit needed?

| Option | Description | Selected |
|---|---|---|
| 3s P95 budget + fast-path short-circuit + elapsed_ms logging | Full route_and_retrieve targeted at 3s P95. Fast-path: when `current_focus` is active phase AND `explicit_constraints` non-empty, call `vtp_search_substrate` directly. Empirical audit via routing log. | ✓ |
| Ship without budget, measure empirically, tighten later | No explicit cap. | |
| Tighter budget (1-2s) with mandatory fast-path always | More aggressive, riskier against cold VTP state. | |

**User's choice:** First option (via standing auto-accept order).
**Notes:** 3s is generous for local stdio; tightening later based on routing-log data is cheaper than loosening from too-tight. Fast-path predicate is the minimum viable short-circuit — more aggressive branches (e.g., direct substrate on second query in rapid succession) are plan-time or future-phase.

**Decision recorded as D-07.**

---

## Q4 — Adaptive routing-weights update policy

**Seed framing:** (A) manual skill, (B) auto-fire at milestone close, (C) document-only operator-manual.

| Option | Description | Selected |
|---|---|---|
| A. Manual `/sgsd-vtp-tune` skill | New skill dedicated to tuning. Adds surface. | |
| B. Auto-fire at milestone close once routing-log ≥N rows | Closed-loop calibration. Adds logic, new failure mode, new test surface — meaningful scope expansion. | |
| C. Document-only operator-manual | Reflection-log drives operator judgment; operator runs update by hand. Phase 16 ships logging only. | ✓ |

**User's choice:** C (via standing auto-accept order — borderline scope; Claude flagged but within "implementation policy" not "what ships").
**Notes:** Currently zero routing-log rows exist. Auto-calibration would be calibrating against no data. Deferred to future phase; trigger: "one full milestone of VTP routing data." Explicitly recorded in `<deferred>`.

**Decision recorded as D-08.**

---

## Q3 — `vtp_advise_service_enrichment` placement ⚠ flagged scope-altering

**Tool status:** LIVE in current session. Wave C unblocker resolved via ToolSearch verification.

**Why flagged:** Each option ships a different deliverable — this determines what Wave C actually is.

| Option | Description | Selected |
|---|---|---|
| 1. A — new `/sgsd-vtp-advise` skill (standalone) | Operator-invoked ad-hoc. New surface. | ✓ |
| 2. B — integrate into `/sgsd-sepl` (auto-ground every proposal) | Modifies sepl. Can produce noise — advise is conservative, most findings will be "no change". | partial (conditional) |
| 3. C — integrate into `/sgsd-complete-milestone` | Milestone-close sweep. Modifies already-heavy workflow. | |
| 4. Defer VTP-08 entirely | Drop Wave C; keep 16 scoped to A+B only. | |
| 5. Something else | | |

**User's choice (verbatim):** "Lets do A and if there is a major proposal lets do B too but only if its major"

**Resolution:** Ship both — VTP-08a (A, always) + VTP-08b (B, conditional on proposal being "major").

**"Major" definition made falsifiable:** proposal touches ANY of:
- orchestrator loop (`sgsd-orchestrate`, `ORCHESTRATOR-CHECKPOINT`)
- dispatch rules (`CLAUDE-OVERLAY` routing table)
- skill surface (new skill file or new slash command)
- agent surface (new agent file or agent frontmatter change)
- new hook
- new config key under `workflow.*` or `preferences.*`
- cross-phase pattern (affects ≥2 phases)

Detection is a file-pattern + frontmatter scan inside sepl, not a judgment call. Plan-time picks exact parser approach (regex vs frontmatter flag vs hybrid) — the detection *criteria* are locked.

**Decision recorded as D-09.**

---

## Claude's Discretion

Captured in `16-CONTEXT.md <decisions> § Claude's Discretion`:
- Exact Node API of `vtp-context-composer.cjs` (signatures, options object)
- Exact JSONL shape of `.planning/metrics/vtp-routing-log.jsonl` rows
- Wording of VTP-call instructional paragraphs in each agent frontmatter
- "Major" heuristic implementation approach (parser shape — not criteria, which are locked)
- VTP doc-ID citation format in RESEARCH.md / PLAN.md output

---

## Deferred Ideas

Captured in `16-CONTEXT.md <deferred>`:
- Automatic routing-weights calibration (revisit after 1 milestone of VTP routing data)
- `sgsd-*` promotion of `gsd-phase-researcher` / `gsd-planner` (trigger: >50 lines of new reasoning)
- Retroactive VTP enrichment of v1.0/v1.1/v1.2 artifacts
- Drift detector CRLF-normalization fix (tooling improvement)
- `gsd-codebase-mapper` + `gsd-plan-checker` VTP hooks (planner-discretion scope)
- Full autonomous planner layer (explicitly `avoid` per VTP advisor test payload)
- Broad persistent-memory substrate (explicitly `avoid` per VTP advisor test payload)

---

## Session Metadata

- **Pre-discussion commits:** `0191168` (chore(roadmap): add Phase 16 VTP Enrichment to v1.3 staging), `e74a763` (feat(16): seed Phase 16 VTP Enrichment CONTEXT.md)
- **Mode:** Remote-control (text mode) — plain-text numbered lists used throughout, no `AskUserQuestion` invocations
- **Evidence checks performed during discussion:** MD5+CRLF-strip on SKILL.md source vs installed (Q9); `ls` + file-existence checks on `super-gsd/agents/` and `custom-gsd-extract/claude-agents/` (Q5); `ToolSearch select:mcp__vtp-kb__vtp_advise_service_enrichment` (Wave C readiness)
- **Operator standing order set after Q1:** "Accept your recommendations unless super altering scope" — applied to Q2, Q6, Q8, Q4; Q3 re-confirmed interactively as scope-altering
- **Memory written:** `workflow/feedback/feedback_auto_accept_recommendations.md` (new durable feedback rule)
