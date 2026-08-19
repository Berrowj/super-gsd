---
phase: "155"
slug: propagation-readiness
milestone: v3.6-vtp-bridge
status: CORE-COMPLETE
closed: 2026-08-20
commits: [adeb751, ff595cc, d508069, "2990970", 7be92df]
gates: {muda_mechanical: "PASS 0/0", muda_qualitative: "degraded (codex timeout)", phase_atc: "2 CRIT found, both closed pre-summary", spec_reviews: "all pass after fix rounds", browser_verify: "skipped, no frontend files"}
---

# P155 Summary — Propagation Readiness (core)

## What shipped, five commits

1. `adeb751` T1 — one hook overlay on the real merge path; classifier AND secret-leak
   guard install together; executor-safe P153 regression runner.
2. `ff595cc` T2-T3 — `phase-name.cjs` as the sole phase-name parser (three schemes,
   numeric ordering, dual-root discovery, realpath dedup, fault-vs-empty); installer
   and clean-room stop shipping the legacy root; four blind consumers plus audit and
   resolver name-lookups rerouted; distill fails loud on missing corpus.
3. `d508069` T4b — ROADMAP-ordered opaque phase model; all evidence tiers
   resolve-or-abstain; partial/heading-only/empty tables forfeit ordering authority;
   devcp reproduction and hostile fixtures as permanent guards.
4. `2990970` T4 — `decision-state.cjs` rendering boundary; SessionStart hook and
   orchestrator READ STATE consume derived truth loudly; installer deploys the hook;
   nesting-aware frontmatter reading after this repo's own sediment hijacked the
   parser (SEDIMENT fixture 8/8).
5. `7be92df` gap fix — the 12th activation seam closed (hook registered in
   settings-overlay, activation proven through merged settings); CLAUDE-OVERLAY and
   dashboard deprecated raw-STATE reads retired; v3.6 ROADMAP.md authored.

Final live evidence on this repo: render = v3.6-vtp-bridge, folder-tier, confidence
0.7. Note: it names 158 as active because seeded CONTEXT stubs read as scoped phases;
operator ground truth is 155. Honest per evidence, worth knowing when reading renders.

## Devcp update instructions (CRIT-1 carried here)

`sgsd-update` refreshes the canonical source and the CURRENT project. It does NOT
advance: (a) vendored `super-gsd` trees outside the propagation path, and (b) the
other worktrees' branches. Per instance: update the canonical clone, then for EACH
active worktree rebase/merge its branch onto the updated base and re-run
`install.sh --init-project` so `merge-settings` re-resolves hook paths for that
worktree. The 42 stale-STATE worktrees gain corrective conflict evidence only after
their branch carries the v3.6 ROADMAP and resolver.

## Deferred out of this phase

- P156 state-close contract (state.write, SUMMARY gate alignment), P157 VTP readiness,
  P158 notification routing — carved by plan review, seeded.
- D2: the phase-close consult still renders Windows paths MUDA cannot parse (exit 4);
  worked around identically twice now; fix belongs in the consult renderer.
- Executor visibility (V1-V3) and fleet view (V4-V5) — proposed, unrouted.
- Devcp defect D7 (STATE.md per-branch duplication) — deferred by decision in CONTEXT.

## Push gate status (exit criteria)

- [x] Six tasks verified; consumer suite 36/0; all suites green unsandboxed
- [ ] P153 gap plan resolved or operator-deferred in writing — OPERATOR DECISION
- [ ] PII fast-forward check, then one push — OPERATOR-GATED
