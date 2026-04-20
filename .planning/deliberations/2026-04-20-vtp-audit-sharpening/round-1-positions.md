# DLB-05 — Round 1 Positions

Brief: `.planning/briefs/2026-04-20-vtp-audit-sharpening.md`
Date: 2026-04-20

## Round 1 Summary

| Agent | Position | One-liner |
|---|---|---|
| Architect | (1b, 2b, 3b, 4b) | Soft-warn budget log; metric-only conformance; 2 new MUDA probes (extra-processing + inventory only); defer Q4 until v1.2 produces live evidence |
| Pragmatist | (1b, 2c, 3a, 4c) | Cheap soft-warn budget log; DEFER Q2 (gate chain regression risk); ship all 5 missing wastes as warn-only stubs for 1 milestone; reject Q4 outright |
| Contrarian | (1c, 2b-conditional, 3c, 4c) | Defer Q1 ("cap has never fired"); accept Q2b only if single field in existing token log; stay at 3 probes ("0 recurrence data"); reject Q4 ("literature is not operational evidence") |
| Moonshot | (1a, 2b, 3-RETYPE, 4a) | Hard cap now; metric-only conformance; RETYPE MUDA from post-hoc probes to live classifier consult (using Process Mining's 7 anomaly patterns as read-path algorithms); reopen Q4 with two-source convergence (EvolveR + Process Mining) |

## Architect — Full Response

POSITION: (1b, 2b, 3b, 4b). Add cost observability to deliberation + conformance metrics; expand MUDA by the two most mechanically grounded wastes; hold distillation cadence until v1.2 produces live evidence.

TECHNICAL RISK: Recommended path risk — soft-warn on Q1 means the cap is visible but toothless; if DLB-05 itself runs to 150k under a "warn" regime, the board gets data but the mechanism never forced the behavior change. Rejected path risk — hard synthesis-jump at 80k would have force-terminated DLB-03 and DLB-04 mid-convergence (both crossed 80k before Round 2 synthesis). All five new MUDA probes with guessed thresholds would require calibration data we don't have; if FAIL fires on a clean phase first time, DLB-02 kill condition activates against an uncalibrated probe.

KEY ARGUMENT: Q1 — 4/4 DLBs converged within max_rounds without a token ceiling. Correct architectural move: instrument first (log `tokens_used`, `elapsed_sec` to `metrics/deliberation-budget.jsonl`) and let 4 more DLBs reveal whether natural convergence persists. A hard-cap mechanism that has never fired is dead code with synthesis-corruption risk if it fires during a legitimate Round 2 pivot. Q2 — DEVIATIONS in SUMMARY.md is free-text qualitative flag, not quantitative signal; `drift_pct` catches scope-creep and partial completion that DEVIATIONS misses. Metric-only (2b) correct before gating on a distribution we haven't seen. Q3 — extra-processing and inventory have concrete measurable proxies; NUT/overproduction/transportation require higher-order inference with no threshold anchor. 3b is DLB-02-consistent. Q4 — VTP's Deploy→Monitor→Retune is valid external signal but not a failure report against milestone-batch; DLB-04's three gates were adopted precisely to earn the right to upgrade timing, and NONE have returned data yet.

IMPLEMENTATION SKETCH: Q1 (1b) ~30 min: brief frontmatter + CEO agent reads fields before each round, emits `[BUDGET WARN]`, appends to `deliberation-budget.jsonl`. Q2 (2b) ~2h: `sgsd-conformance-check.sh <phase>` diffs PLAN.md tasks vs SUMMARY.md FILES_CHANGED, computes drift_pct, logs to `conformance-log.jsonl`. No gate. Q3 (3b) ~40min each: extra-processing probe (plan-line count vs actual file-write count, warn >2x) + inventory probe (files written in phase, referenced in next phase within 2 commits, warn if 0%). Both via `sgsd-muda-probe.sh`. Total: 2-3h.

BLIND SPOTS: (1b) is evidence-collection masquerading as discipline — Pragmatist will argue this. Counter: DLB-03 structural injection came from R2 evidence not R1 assertion. On Q2, `drift_pct` assumes consistent PLAN.md task granularity (some phases 3 tasks, others 12); need minimum-count guard (skip if planned_tasks < 5).

## Pragmatist — Full Response

POSITION: (1b, 2c, 3a-warn-only, 4c). Cheap soft-warn budget log; defer conformance entirely; ship all 5 missing wastes as warn-only stubs; reject continuous distillation.

EXECUTION RISK: Q2 gate chain at `super-gsd/skills/sgsd-orchestrate/SKILL.md` already has four sequenced steps (6, 6.5, 6.55, 6.6); inserting 6.8 requires touching step numbering + phase-close path + dispatch table. Phases 4/5/7 not closed. Regression mid-milestone doesn't announce itself — silently drops phases through without the gate firing, exactly the failure Process Mining's conformance was designed to catch.

KEY ARGUMENT: 4 prior DLBs converged without cap. 137k for DLB-04 is expensive but finished — no evidence of a runaway deliberation that needed a hard stop. Q1's ceiling solves a problem that hasn't happened yet; 1b gives data without synthesis-jump code path nobody has tested. Q3 MUDA expansion is cheap — existing probe scaffold already emits structured JSON with `waste_class`, adding 5 stubs is 5 new shell conditionals against existing output paths. Risk = threshold guessing, which warn-only-for-1-milestone explicitly hedges. Q4 is dangerous: `sgsd-distill-milestone.sh` already ships DLB-04; reopening adds a Haiku pass to every phase-close in v1.2 with unknown phases remaining — unknown token burn committed before v1.1 novelty rating returns.

MONDAY MORNING: Single commit, ~30 min. Add `token_budget_warn: 120000` to brief frontmatter schema. Add 4 lines to `/sgsd-deliberate` synthesis step — after board's final round, check token-log.jsonl for session total; if over `token_budget_warn`, append one-line note to Decision Memo. No synthesis jump, no cap, no new code path. Q3 MUDA stubs follow in second commit (~1h): 5 new probe blocks in `sgsd-muda-probe.sh` with explicit `# threshold: GUESSED — 1 milestone evidence run` comments.

BLIND SPOTS: Architect will correctly argue warn-only MUDA stubs with guessed thresholds are structurally identical to write-path-nobody-reads failure mode DLB-02 already rejected. Moonshot will push that Q2 deferral ignores Process Mining finding that PLAN-vs-actual drift is highest-leverage signal available. Contrarian will note (1b) soft warn is theatre: if 4 DLBs converged naturally and DLB-04 peaked at 137k, warn fires every time and becomes invisible within two runs.

## Contrarian — Full Response

POSITION: (1c defer, 2b-metric-only-conditional, 3c stay-at-3, 4c reject). VTP research literature is not operational evidence; none of the four proposals meets the evidence bar this project has already set for itself.

WHY CONSENSUS IS WRONG: The brief is a literature-to-backlog pipeline masquerading as failure-mode analysis. VTP KB sources are external academic and vendor research. The DLB invariant — repeated across DLB-01 through DLB-04 — is "evidence before machinery." That invariant was defined against THIS system's operational data, not against research papers. The audit is one-directional by the brief's own admission: super-gsd has no VTP entry. That's not a gap to fix; it's the correct posture for a system with 24 hours of live distillation data and zero SEPL proposals submitted. The unexamined assumption: cross-referencing research briefings constitutes evidence of failure. It does not. It constitutes evidence of literature.

EVIDENCE NEEDED (absent):
- Q1: A single DLB where max_rounds was the binding constraint, not convergence. 4 of 4 converged naturally. Failure mode has not occurred.
- Q3: Any recurrence data from existing 3 MUDA probes across even one complete milestone. Probes have been live ~24 hours. DLB-02's kill condition is "no recurrence across 2 milestones" — we are nowhere near that bar. Adding 5 probes with guessed thresholds before the existing 3 have produced a single recurrence count is the sample-of-one fallacy with a Toyota label.
- Q4: Gate 3 (operator novelty rating) has PENDING user input. Triple-hallucination gate shipped yesterday. Reopening timing before first operator rating exists is not "continuous distillation" — it is reopening a 3-1 deliberation on basis of a process-mining vendor briefing.
- Q2: Specific instances where DEVIATIONS text failed to surface a drift trend drift_pct would have caught. Without that, (2b) is instrumentation-in-search-of-a-problem.

KILL CONDITION: If at v1.2 close (a) any DLB hits max_rounds without convergence, (b) any of the 3 existing MUDA probes shows recurrence across 2 phases, or (c) operator novelty rating produces non-PENDING data — reopen relevant question with actual operational evidence. Until those trigger, all four proposals stay closed.

WHERE YOU MIGHT BE WRONG: Q2 has legitimate asymmetry. DEVIATIONS is unstructured narrative; drift_pct is scalar queryable across token log. If dashboard already reads token-log.jsonl, adding drift_pct field costs near-zero and enables trend analysis. Counterargument: verifier's DEVIATIONS has never been reported as insufficient — trend analysis has no proven consumer. Would accept (2b) only if single additional field in existing token log, not a new reporting layer.

## Moonshot — Full Response

POSITION: (1a, 2b, 3-RETYPE, 4a). Adopt hard budget cap and metric-only conformance now; reframe MUDA as an active classifier not a passive taxonomy; reopen distillation with the two-source convergence argument as the factual refutation Contrarian demanded.

THE 10X VISION: Every deliberation has a dollar cost stamped on it. Every phase close emits a conformance score. Every dispatch queries a live waste-pattern classifier that gets smarter per phase. Every distillation fires at phase-close, not milestone-close. By v1.3 the orchestrator has a measurable learning curve — tokens-per-decision falling, drift-events falling, budget-per-deliberation shrinking — and you can show it on a graph.

MECHANISM UNLOCK: The loop closes at the read path. DLB-02 deferred the classifier-consults-memory wire-up. The MUDA brief names this explicitly: write without read = open loop, no learning despite cost. The 7 Process Mining anomaly patterns are not a taxonomy addition — they are the read-path algorithm. Each pattern is a query template the classifier fires pre-dispatch. That retyping of MUDA from post-hoc audit to live classifier consult is what closes the loop. Budget cap (Q1a) forces convergence; conformance metric (Q2b) measures drift; the classifier read-path (Q3 retype) learns from both. These three are one mechanism, not three features.

CHEAP MVP: One new field in sgsd-deliberate report: `BUDGET_USED: Xk tokens / $Y.ZZ`. That is Q1a cap instrumented as a log, with the hard-cap enforcement added in a second pass once the log has two deliberation samples to calibrate against. Four hours. If first two deliberations show actual spend near PI CEO's $1-5 estimate, cap number is grounded in evidence rather than guessed. Then Q2b (one conformance metric appended to DEVIATIONS) adds another two hours.

WHERE YOU'RE OVERREACHING: Q4a. The two-source argument (EvolveR + Process Mining) is real, but Contrarian will correctly note both sources point at per-phase distillation as a pattern — not as a validated improvement in this codebase. DLB-04's 3-1 win worked because you had a factual refutation (install-audit-heavy premise was wrong). Here the refutation is "two external sources converge" — that is a research argument, not an operational one. The honest move: ship Q1+Q2+Q3-retype first, let one milestone of per-phase distillation run on DLB-04 substrate already shipped, and bring actual data to Q4 at v1.3 close.
