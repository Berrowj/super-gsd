---
type: deliberation-brief
date: 2026-08-02
slug: always-on-gate-substrate
phases_affected: 12
q1_impl_hours: 14
q1_revertable: partial
floor_gate: ABOVE-FLOOR
board: [architect, pragmatist, contrarian, moonshot, researcher]
max_rounds: 2
vtp_evidence: .planning/milestones/v3.5/phases/144-chronicle-host-shell-boundary/VTP-EVIDENCE.md
plan: .planning/analyses/2026-08-02-always-on-gates-and-context-handover-PLAN.md
handover: .planning/milestones/v3.5/phases/144-chronicle-host-shell-boundary/HANDOVER.md
git_head: c24a758
---

# Brief — should SGSD add an always-on hard-blocking gate substrate?

## Situation

SGSD declares quality gates (`per-dispatch-ATC` at `enforcement_mode: hard-halt`,
phase-ATC, spec-compliance, MUDA) in `super-gsd/registry/gates.yaml`, backed by a
real library (`gates-registry.cjs`, `predicate-eval.cjs`, `sampling-decider.cjs`).
No executable code calls `shouldFire()` for a dispatch decision. The only consumer
is prose inside `sgsd-orchestrate/SKILL.md`. Outside `/sgsd-orchestrate`, no
quality gate fires on any source edit.

Six declared-but-dead mechanisms were found on 2026-08-02, all of which **fail
silently while reporting success**:

1. `gates.yaml` `hard-halt` — metadata on a document, no runtime.
2. `gsd-atc-slice-gate.js` — registered `PostToolUse`/`Write`, regex targets the
   abandoned `.gsd/milestones/M*/slices/` layout; exits 0 on every real payload.
3. `codex-exec.sh` — tier ladder overrode explicit `--timeout`, capping dispatches
   at 60s. FIXED (`900bced`).
4. `.codex/hooks.json` — MatcherGroup parse failure; five Phase-111 hooks
   including `block-secret-leak.cjs` inert. Schema FIXED (`900bced`), still
   untrusted therefore still inert.
5. `sgsd-stop-handoff.sh` — chain latched at `max_chain_depth` since 2026-04-24
   because `refused` rows never reset the counter.
6. `autopilot-watchdog` — scrapes phase number from prose with
   `/\bPhase\s+([0-9]+)\b/i`, briefs every session with P95 instead of P144.

A seventh surfaced during this very triage: `vtp_route_and_retrieve` rewrote a
design question into "markdown patterns for &lt;active_file&gt;", returned meeting
transcripts instead of harness papers, and reported `reflection: null`. The
enrichment gate underperformed direct search and flagged nothing.

Downstream consequence, observed on the sibling devcp project: five units of work
shipped with zero `AUDIT.md`, ATC and MUDA never run, two units with no `PLAN.md`
at all. Three real defects — an acceptance-criterion over-claim, an authorization
hole, and a query that would not scale — were all caught after shipping.

## Stakes

The proposed fix (PLAN Tasks 1-14) adds `sgsd-quality-gate.js` as a **hard-blocking
`PreToolUse` hook on `Edit|MultiEdit|Write`**, registered in the **global**
`~/.claude/settings.json`, therefore active in every repository on this machine
including project-clarity-erp/devcp.

If right: "zero AUDIT.md across N units" becomes structurally impossible, and the
class of defect that ships-then-gets-caught largely disappears.

If wrong: every source edit in every project acquires a blocking dependency on a
newly-written hook, in a system that has just been demonstrated to be full of
mechanisms that silently do the wrong thing. The failure mode of a bad gate is
worse than the failure mode of a missing one.

## Constraints

- `CLAUDE.md` Karpathy rules: simplicity first, surgical changes, no speculative
  abstraction. A 14-task substrate is not obviously "minimum code that solves it".
- `DELIBERATION-FLOOR.md`: deliberation must not cost more than implement+revert.
- Claude orchestrates; Codex authors all SGSD orchestration code.
- Global `settings.json` env block holds live API keys — never read or echoed.
- Blast radius is machine-wide from the first commit unless deliberately scoped.

## Key Questions

**Q1 — Is a blocking gate the right instrument, or is the correct fix
reporting-only?**
The unifying diagnosis was *"absence of evidence must be loud"*. That diagnosis
supports a **detection/reporting** change (a gate that did not run leaves a record
that it did not run; a dispatch that produced nothing must not exit 0). It does
not by itself justify **blocking**. A reporting-only fix is far cheaper, has
near-zero blast radius, is trivially revertable, and would have caught the devcp
case — five missing `AUDIT.md` files would have been visible immediately.
Argue whether blocking adds enough over loud-reporting to justify its cost.

**Q2 — Does AHE-P-09 (stacked gates interfere) kill this?**
`agentic-harness-engineering-...` reports individually-good components competing
for turn budget and duplicating verification, *reducing* hard-case performance.
SGSD already runs per-dispatch ATC, phase ATC, spec-compliance, MUDA, plan-check,
verification, browser-smoke and playwright gates. Adding an unconditional
pre-edit gate stacks one more onto a stack the literature says already interferes.

**Q3 — Does AHE-P-10 make this an unacceptable bet?**
Same paper: harness changes predicted their own *fixes* at 33.7%/51.4%
precision/recall but their own *regressions* at 11.8%/11.1%. We are poor at
predicting what a gate change breaks. Does that argue for scoped-then-propagate
rather than global-from-day-one?

**Q4 — Bootstrap.** The gates are what we are fixing, so this change cannot be
gated by them. What gates the gate?

**Q5 — Is there a deletion that beats the solution?**
`sgsd-orchestrate/SKILL.md` is 2,988 lines of interleaved prose and pseudo-code
whose functions (`shellDispatch`, `logDeviation`, `runBlockerRecoveryHardLoop`)
do not exist. Is the higher-leverage move deleting/replacing that file rather
than adding a hook beside it?

## Floor assessment

**ABOVE FLOOR.** Q1 implementation is the 14-task substrate (≫2h). Revert is
partial: hook registrations revert cleanly, but the precedent and the global
blast radius do not. Board deliberation is warranted.

## Decisions routed BELOW floor (no board required)

- **Codex hook trust** — implementation is minutes either way, fully revertable.
  Below floor on cost. **BUT it is an operator authority/security decision, not a
  cost decision** — the floor governs deliberation expense, not who decides.
  Remains operator-gated regardless. Recommendation: route (a), approve
  interactively, so trust is persisted and reviewed rather than bypassed by a
  flag named "dangerously".
- **Gate substrate scoping (global vs repo-first)** — below floor on cost
  (<2h, revertable), but it is a *sub-decision of Q3* and should be settled by
  the same board round rather than pre-empted. Folded into Q3.
