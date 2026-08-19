# P155 plan finalization gate — ATC + MUDA before execution

Read only. Change nothing. You are reviewing a LOCKED plan before any code is written.

## Read

1. `.planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-01-PLAN-LOCKED.md`
2. `.planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/CONTEXT.md`
3. `.planning/decisions/2026-08-19-canonical-work-identity-MEMO.md` and its ADDENDUM
4. `.planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-VTP-ENRICHMENT.md`
5. Spot-check the defect sites the plan claims to fix, especially
   `super-gsd/tools/state-resolver/resolve.cjs:329,349,356,473`,
   `super-gsd/install.sh:467,572`, `super-gsd/config/repo-settings-overlay.json`,
   `super-gsd/tools/phase-folder-audit/audit.cjs`.

## Provenance note

The plan frontmatter is Codex-authored (a prior dispatch that hit its timeout after
completing all entries). The orchestrator's salvage is disclosed in the plan body:
closing delimiter appended, `depends_on` integers quoted. Verify the salvage note is
accurate: nothing else in frontmatter should look orchestrator-authored.

## Your job

**ATC 7-step over the plan set as an execution contract.** In particular:
- First principles: is each of the 8 tasks needed, or can any be deleted or merged
  without losing the phase goal? The governing memo demands the NARROW option.
- Does any task smuggle back what the board killed: a registry, an alias map,
  renumbering, legacy-tree archiving, or a new work-tier taxonomy?
- Dependency order: T4b MUST precede T4 (devcp lesson: never wire consumers to a
  resolver whose phase model misreads v-scheme and decimal phases). Confirm the plan
  encodes that and that no other ordering hazard exists (e.g. T1 overlay unification
  vs the live hooks in THIS repo, which currently pass 11/11).
- Are the 12 semantic_acceptance_criteria real-data claims with runnable commands, or
  structural greps in disguise? Name any AC that could pass while production stays
  broken. This repo has ten recorded instances of that failure class.
- T4b's fixture: does the plan actually specify a devcp-shaped fixture (flat layout,
  v-named + decimal + legacy-integer mix), and does its AC forbid a backwards
  re-sync recommendation?

**MUDA waste review** over the plan set: overproduction, extra processing, inventory,
waiting. Eight tasks is a lot for one phase — say plainly if this should split, and
where, or if any task is padding.

**Blast radius.** T1 rewrites the overlay that installs live hooks; T4 rewires the
orchestrator's READ STATE step; T4c adds a close-gate requirement that could block
future phase closes. For each: what breaks if it ships wrong, and does the plan's
falsifier actually catch it?

## Output format — the five contract lines FIRST, then the review block. Both required.

```
FINDINGS: <integer>
CRITICAL: <integer>
WARNINGS: <integer>
PASS_RATE: <n>/<n>
ONE_LINER: <short summary>
VERDICT: GO | GO-WITH-CHANGES | NOGO
BOUNDARY_COMPLIANCE: PASS | FAIL — <which killed item resurfaces, if any>
ORDER_SAFE: YES | NO — <ordering hazard if NO>
AC_RISK: none | <AC ids that could pass while production stays broken>
SPLIT_ADVICE: keep-as-one | split — <where and why, one line>
REQUIRED_CHANGES: none | <numbered list>
```

Keep the review block under 500 words after the contract lines. A GO on a plan that
later fails costs more than a NOGO now.
