# DLB-04 — Round 2 Rebuttals

Brief: `.planning/briefs/2026-04-19-self-evolving-resource-substrate.md`
Date: 2026-04-19

## Round 2 Summary — convergence on narrow synthesis

| Agent | R1 | R2 Final | Movement |
|---|---|---|---|
| Architect | (1c, 2a, 3c, 4b) | (1c-Agents-only, 2a, 3b-modified, 4b) | Conceded trajectory-distillation is structurally different from finding-distillation; proposed `trajectory-hypothesis` typing to prevent classifier surfacing |
| Pragmatist | (1c, 2a, 3c, 4b) | (defer Q1, 2a, 3c, 4b) | Hardened Q1 concession (no named v1.2 consumer → no manifest); verified FINDING-18 slug pathology; dissented on Q3 timing |
| Contrarian | Reject all | (1c, 2a, 3b-trajectory-gated, 4b) | Largest shift — conceded Moonshot's distinction, proposed novelty-rating kill condition, conceded Architect's silent-drift argument on typed Agents |
| Moonshot | (1b, 2b, 3b-trajectory, 4b) | (1c, 2a, 3b-trajectory, 4b) | Conceded 1b collapses without consumer; conceded 2b violates operator-decides invariant; held 3b with factual refutation of "install-audit-heavy" premise |

## Architect — R2

FINAL POSITION: (1c, 2a, 3b-modified, 4b) — filesystem manifest only, operator-gated SEPL, distill trajectories on milestone-close as a Haiku pass, borrow vocab.

WHERE YOU MOVED: Concede to Moonshot on distillation timing. R1 said defer entirely. That was wrong. Moonshot's trajectory-vs-finding distinction is a genuine insight, not a rebrand. DLB-02's sample-of-one critique targeted recurrence counting across findings. Trajectory distillation is structurally different: extracting abstract principles from the shape of a phase run, not accumulating frequency counts. Every completed milestone already contains 8-16 phase trajectories. Move to 3b-modified: distill on milestone-close only, trajectory-grain, gated behind milestone completion.

WHERE YOU HELD: Contrarian's point — `/sgsd-deliberate` is already propose→assess→commit — lands against SEPL automation, not against the manifest. Resource-grain gap is real but narrow. However, I am not naming a v1.2 consumer of the manifest. Reading the briefs: MUDA-brief's classifier pre-dispatch query needs to know which agents ran and what they returned — that IS a resource-grain query, and that IS a v1.2 consumer. Manifest stays, scoped to Agents only (not Environments).

SYNTHESIS PROPOSAL: Pragmatist's FINDING-18 smoke-test gate is not orthogonal — it is the critical path. Gate order: (1) smoke-test brv-curate write confirmation, (2) if passes, wire DLB-03 intent injection as first manifest consumer, (3) milestone-close trajectory distillation as second. Moonshot's `sgsd-distill-milestone` is the right vehicle. Contrarian's "ship recurrence data first" becomes the v1.3 evaluation criterion.

ONE RESERVED OBJECTION: Trajectory distillation produces abstract principles only if Haiku can distinguish phase-shape signal from noise in a single-milestone corpus. With one closed milestone, Haiku is pattern-matching on N=1. Output will look like lessons. May be overfitting. Gate the distillation output as `type=trajectory-hypothesis` not `type=trajectory-lesson` until v1.3 cross-milestone confirmation.

## Pragmatist — R2

FINAL POSITION: (defer Q1, 2a, 3c, 4b) — concede to Contrarian on Q1 (no v1.2 consumer, defer manifest entirely); hold 3c (defer distillation to v1.3 with two milestones of non-install data).

FINDING-18 STATUS: Partially broken. Script at `super-gsd/scripts/sgsd-curate.sh` is syntactically complete with atomicity and rollback. Smoke-test command: `echo "test body" | bash super-gsd/scripts/sgsd-curate.sh --type pattern --slug finding-18-smoke --summary "smoke test entry" --root /mnt/c/Users/jack.berrow/GSDedits && grep "finding-18-smoke" .brv/context-tree/INDEX.md`. INDEX.md shows a malformed anti-pattern row at line 37 (`waste-waiting-p08-narrative-stale-2026-04-19-20-01-38z`) — curate script ran but produced a pathological slug. Write path works; slug discipline does not. **Partially broken.**

WHERE YOU MOVED: R1 said "manifest-only." Now concede to Contrarian on Q1. Architect's blind spot admission is my concession point: no v1.2 read-path consumer = write-only trap = MUDA's "inventory" waste. Building a registry nobody reads is exactly the scope-creep I oppose.

v1.2 CONSUMER OF MANIFEST: Cannot name one with sufficient certainty. Concede. Do not build it in v1.2.

On Moonshot's trajectory-distillation: 60-line shell is cheap but fires on milestone close, and we have one closed milestone with install-y findings. Output will be noise. Not worth 3h in v1.2. Revisit at v1.3.

On typed rollback: not a real gap. `git revert` covers 95% of rollback cases SGSD encounters. "Typed rollback" is marketing until someone names a concrete failure git revert cannot handle.

MONDAY MORNING (revised): Day 1 — run FINDING-18 smoke test, fix the slug-discipline bug in sgsd-curate.sh, ship DLB-02 recurrence instrumentation. Day 2 — operator-gated SEPL proposal only if Day 1 passes clean. Nothing else.

## Contrarian — R2

FINAL POSITION: MODIFY (1c, 2a, 3b-trajectory-gated, 4b) with explicit kill instrumentation.

THE TRAJECTORY-DISTILLATION QUESTION: Partial concession. Moonshot's distinction is real and worth taking seriously. Trajectories (what the orchestrator actually did across 8 phases) exist regardless of whether waste recurred. Haiku extraction over phase-close narratives isn't sample-of-one in the same way a single waste-finding is. Concede this. However: v1.1's trajectories are dominated by install-audit behaviour. That corpus is systematically unrepresentative of steady-state dispatch. Distilling from it produces priors trained on anomaly, not normal operation. Moonshot's case is structurally sound but empirically premature — schedule 3b-trajectory for v1.2 milestone close (not v1.3) contingent on at least two milestones of non-install-audit phases contributing to the corpus.

WHERE YOU MOVED:
- Off full-reject on Q3. Trajectory distillation at v1.2 milestone close is a defensible narrow build, not infra-for-infra.
- Acknowledged Architect's silent failure mode: untyped Agents silently escaping phase-readiness probes is a concrete, named failure — not vocabulary aesthetics. 4b has a real mechanical justification I understated in R1.

WHERE YOU HELD HARDEST: Vocabulary adoption creeps into spec conformance. "Borrow AGP vocab, keep SGSD idiom" is gradient descent toward full conformance. The cost isn't today's commit — it's the spec-conformance pressure created in every future review. No evidence Wave D commits to v1.2. Manifest without a named consumer remains a no-op regardless of clean vocabulary.

KILL CONDITION FOR THE SYNTHESIS: If, at v1.2 milestone close, the trajectory distillation script produces zero abstract patterns that differ from what a human reading the phase logs would already know — the whole trajectory-distillation branch ships negative value (complexity cost, zero novel signal) and must be deleted, not iterated on. Instrument this: run the extraction, have a human rate novelty on a 3-point scale before committing the output. Below 2/3: delete the script.

## Moonshot — R2

FINAL POSITION: (1c, 2a, 3b-trajectory variant, 4b) — ship `sgsd-distill-milestone` this milestone using trajectory data from phases 1-7; accept manifest-only registry and operator-gated proposals, because the compounding loop is the only mechanism that makes every future milestone cheaper, and delaying it to v1.4 is the costliest decision this board can make.

THE TRAJECTORY DEFENCE: Contrarian's "install-audit-heavy" claim is empirically wrong. Phases 1-3 are pure orchestrator dispatch wiring, model routing, and report-processing architecture. Phases 4-5 are ATC quality gates and strategic deliberation machinery. Phase 6 is overwatcher monitoring. Phase 7 is integration. Phase 8 is self-audit and does dominate *waste findings*, but the distillation target is TRAJECTORIES — the sequence of dispatch decisions across all eight phases — not the waste findings alone. Trajectory corpus contains 7 phases of real feature-build dispatch behaviour including misclassifications, plan-check loops, and verifier cycles. That is precisely the signal `sgsd-distill-milestone` needs. Contrarian is attacking a straw man.

WHERE YOU MOVED:
- **1b → 1c.** Named v1.2 consumer of a state-tracked registry is Wave D, and Wave D is evidence-gated. Makes 1b a write-only ceremony by its own logic. Manifest-only (1c) is honest.
- **2b → 2a.** Auto-committing a CLAUDE.md rule addition does retire prior rule state — automated retirement dressed as addition. Operator-decides invariant holds for a reason: Haiku over WASTE.md has no ground truth. Auto-commit on PASS violates the invariant and I cannot defend it.

WHERE YOU HELD: 3b with trajectory variant. This is not a seed library (DLB-02 failure: no grounding data, pattern invented from zero). This is not a runtime intent score (DLB-03 failure: unverifiable signal injected into live dispatch). Trajectory distillation has grounding — eight closed phases, committed summaries, real WASTE.md outputs, verifiable git history. The difference: the corpus exists before the script runs.

VALIDATION GATE FOR TRAJECTORY DISTILLATION: Before any distilled pattern writes to the memory tier, require a confirming instance from at least two distinct phases in the trajectory corpus. Haiku extracts candidates; a second Haiku pass checks each candidate against the raw summaries and must cite two phase references by commit or plan ID. Patterns citing only one phase go to a `candidate/` subdirectory, never surfaced to classifier, revisited at v1.3 close. Cost: one extra Haiku call, ~400 tokens. Addresses hallucination risk without human approval overhead.

## Convergence map

Three independent hallucination gates proposed for trajectory distillation:
- **Architect**: `trajectory-hypothesis` typing (no classifier surfacing until v1.3 confirmation)
- **Moonshot**: two-phase-citation Haiku validation gate (candidates citing 1 phase → `candidate/` subdirectory)
- **Contrarian**: human novelty-rating kill condition at v1.2 close (<2/3 median → delete script)

CEO synthesis: **stack all three**. Triple-layered gate is cheap (two Haiku calls + one human rating) and each gate targets a different failure mode (surfacing, pattern quality, overall mechanism value).
