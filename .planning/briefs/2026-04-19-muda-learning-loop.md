# Brief: MUDA skill + classifier learning loop

## Situation

SGSD has no mechanism to detect, capture, or learn from waste across phases. This session's CPU audit uncovered 12 consecutive silent Haiku failures, an N+1 `git log | git show` pattern that spawned 21 git processes per render, a 74-minute stale narrative cache, 8.7% of a core burning continuously on one dashboard, and a 319-file session-dir rescan per tick — all accumulated over days and none surfaced by any existing audit. The orchestrator's classifier has no memory of prior misclassifications, so the same waste-producing dispatch decisions recur every phase. Meanwhile the Toyota canon offers a ready-made vocabulary (MUDA's 8 wastes: defects, overproduction, waiting, non-utilized talent, transportation, inventory, motion, extra-processing) and a remediation workflow (TBP's 8-step problem solving). VTP KB searched for prior MUDA research — zero hits across 5 queries. Planned design: `sgsd-muda-audit` (per-phase write path producing WASTE.md + memory findings), `sgsd-memory-curate` (periodic promote findings→lessons), classifier-consults-memory wire-up (per-dispatch read path).

## Stakes

If built: every phase makes the classifier measurably smarter; waste patterns identified in phase N become dispatch rules by phase N+3; tokens compound. If ignored: same classes of waste recur forever, with the 8.7% CPU-core symptom being the visible tip of a much larger invisible bleed. If built halfway — write without read path, or read path without threshold discipline — the loop is open and delivers no learning despite the token cost.

## Constraints

- Classifier pre-dispatch query must be cheap (~200 tokens, Haiku).
- Must attach to the existing `sgsd-orchestrate` dispatch path; no parallel engine.
- No external paid infra; local storage only.
- Threshold discipline required — classifier consulting hundreds of raw findings per dispatch is itself waste.
- Depends on a working memory retrieval tier (see separate Brief 2) but is the PRIMARY user of that tier.

## Key Questions

1. **Build order.** Ship (a) write path first (audit captures evidence, classifier not yet wired), (b) read path first (classifier consults memory even with zero lessons, so machinery is in place and next phase's findings flow into a live loop), or (c) both in one phase despite doubled cost? Write-first means phase-close produces data nobody reads; read-first means dispatch queries an empty store. Which asymmetry is less bad?

2. **Curation cadence.** Findings vs lessons separation: threshold-of-3 before a finding becomes a lesson surfaced to the classifier (slow, clean), or every finding immediately queryable as a lesson (fast learning, risk of noise flooding Haiku pre-dispatch context). Is a two-tier compromise (all findings queryable with `type=waste-finding`, only threshold-3 patterns get `type=waste-lesson` returned by default) worth the extra machinery, or does it add complexity for marginal benefit?

3. **Automation cadence.** Does `sgsd-muda-audit` auto-run at phase close (consistent data, zero user decision, cost paid on every phase whether worthwhile or not) or remain manual (cost-aware, but audits skipped are audits never run)? A middle option: auto-run on milestone close only, so the most significant consolidated findings are captured without per-phase overhead.

## Additional Context

- Audit commits: `b3e0355`..`8365df7` (4 commits on the CPU audit of sgsd-1/2/3 dashboards).
- Existing related skill: `sgsd-token-audit` — subset of MUDA's overproduction/transportation/motion categories. Question: fold into sgsd-muda-audit or keep parallel?
- Memory retrieval tier resolved in Brief 2 — this brief assumes *some* tier is live.

## Termination

phases_affected: 6
max_rounds: 2
gate_score: pending

<!-- 6 = sgsd-orchestrate dispatch + every future phase-close step + classifier + verifier
     (for result logging) + gsd-plan-phase (for lesson-informed planning) + sgsd-token-audit
     (folded or adjacent). -->
