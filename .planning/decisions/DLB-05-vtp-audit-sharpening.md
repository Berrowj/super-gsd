---
type: deliberation-memo
date: 2026-04-20
brief: .planning/briefs/2026-04-20-vtp-audit-sharpening.md
board: [architect, pragmatist, contrarian, moonshot]
rounds: 2
vote: "3-1 ADOPT narrow synthesis + Moonshot SPEC-NOW hybrid on Q3; Contrarian dissents on Q1 (cap-never-fired) and Q3 (0 recurrence)"
decision: "Ship soft-warn budget log, metric-only conformance log, 2 new MUDA write-path probes, adopt Moonshot's 7 Process Mining patterns as the DLB-02 read-path specification (wiring gated, activation deferred). Q4 deferred to v1.3 Gate 3 signal."
---

# DLB-05: VTP-Audit Sharpening — Narrow Synthesis with SPEC-NOW Retype

## Recommendation

Adopt the coherent stance **(1b, 2b, 3-hybrid, 4b)**: soft-warn budget logging on `/sgsd-deliberate`; metric-only conformance logging at phase close; two additional MUDA write-path probes (extra-processing + inventory) with concrete measurable signals; and adopt Moonshot's refined retype as **SPEC-NOW** — documenting Process Mining's 7 anomaly patterns as the algorithm specification for DLB-02's deferred read-path, WITHOUT activating the read-path (2-milestone recurrence gate still applies). Q4 continuous distillation deferred until v1.3 Gate 3 novelty rating produces the first evidence cycle.

The deliberation's signal move was Round 2's convergence on a hybrid Q3 resolution: Architect + Pragmatist's 2-probe write-path expansion (evidence-backed thresholds coming after one milestone) **combined** with Moonshot's SPEC-NOW contribution (adopting the Process Mining 7-pattern taxonomy as documentation for how the future read-path will query, not as a new set of active probes). This satisfies Contrarian's sample-of-one concern (no read-path activation without recurrence data) while still capturing the VTP-audit signal structurally.

Moonshot's honest R2 concessions were decisive: (1a→1b) after the factual record showed DLB-03 and DLB-04 both crossed 80k tokens before synthesizing — a hard cap at 80k would have force-killed both successful deliberations mid-convergence; (4a→4b) after admitting no factual refutation to Contrarian's "two-source research convergence ≠ operational evidence." This is the DLB-04 pattern Moonshot claimed credit for: when factual refutation fails, defer.

## Board Stances — R1 → R2 Evolution

| Agent | R1 Position | R2 Final | Key Movement |
|---|---|---|---|
| **Architect** | (1b, 2b, 3b, 4b) | (1b, 2b-converged, 3b-narrow, 4b-deferred) | **Converged Q2** toward Contrarian's "minimal proliferation" discipline. **Rejected Moonshot's retype-MUDA as overreach** — argued it's DLB-03 pattern-matching without the structural unlock. Held 2-probe narrow against Pragmatist's R1 5-probe breadth. |
| **Pragmatist** | (1b, 2c, 3a, 4c) | (1b, 2b, 3a-narrow-to-2, 4c-clarified) | **Moved Q2c→2b** after conceding the regression-risk argument was overcooked for metric-only (no gate chain touched). **Narrowed Q3** from 5 guessed-threshold stubs to 2 concrete-signal probes after Architect's coherence attack. **Clarified Q4c** as "wait for v1.3 Gate 3 signal" (not "never reopen"). |
| **Contrarian** | (1c, 2b-conditional, 3c, 4c) | (1c, 2b no condition, 3c-spec-only, 4c) | **Dropped Q2b's "single field in existing log" condition** — admitted it was "Contrarian-cosplay" rather than real architectural discipline. **Held hardest on Q4** ("two literature sources agreeing with each other is still literature"). Held 1c defer: "cap has never fired." Called Moonshot's retype **"(B) terminology trick"** — DLB-02 gate still unmet. **Named memory-tier dependency** as prerequisite kill condition. |
| **Moonshot** | (1a, 2b, 3-RETYPE, 4a) | (1b, 2b, **3-SPEC-NOW**, 4b) | **Largest overall shifts**. (1a→1b) factual: DLB-03 and DLB-04 crossed 80k pre-synthesis; hard cap would've killed both. (4a→4b) honest: no factual refutation analogous to DLB-04's phases-1-7 move. (Retype clarified): SPEC-NOW means adopt Process Mining's 7 patterns as the algorithm specification for when DLB-02's 2-milestone gate unlocks the read-path — it does NOT activate the read-path now. |

### Unanimous (4/4) in R2

1. **Q2b metric-only conformance logging.** Unanimous that a full 6.8 gate is overkill and that DEVIATIONS text alone is unstructured; a scalar `drift_pct` fills a real gap. Form: new `.planning/metrics/conformance-log.jsonl` emitting `{ts, phase, drift_pct, planned_tasks, evidenced_tasks, top_3_drivers}` per phase close.

2. **Q4 deferred — "not now."** Labels varied (4b defer-until-v1.3 vs 4c reject) but practical effect identical: no reopening of DLB-04 Q3 before the first live Gate 3 novelty rating completes. Revisit post-v1.2 close.

### Strong consensus (3/4) in R2

3. **Q1b soft-warn budget log.** Architect + Pragmatist + Moonshot converge. Contrarian dissents on 1c defer ("cap has never fired, instrumentation for a failure mode that hasn't happened"). Overridden because logging is ~30-minute cost, evidence-before-cap is DLB-02-consistent, and Moonshot's factual refutation of 1a (DLB-03/04 crossed 80k pre-synthesis) makes 1b the defensible middle.

4. **Q3 write-path narrow: 2 probes (extra-processing + inventory).** Architect + Pragmatist converge. Contrarian dissents on 3c stay-at-3 ("0 recurrence data from existing 3"). Moonshot's SPEC-NOW is complementary, not competing — it specifies the read-path algorithm without activating it.

## Unresolved Tensions

### Q1 — "Cap Never Fired" (Contrarian's live critique)

Track record: 4 of 4 DLBs converged within `max_rounds: 3` without a token ceiling. Contrarian's 1c defer is architecturally honest: you shouldn't instrument for a failure mode that hasn't occurred.

**Majority resolution:** Soft-warn logging is ~30 minutes, near-zero runtime cost, and passively collects the data needed to decide whether a real cap is ever warranted. If 4 more DLBs continue to converge naturally without triggering the warn, the log has proven Contrarian right and the mechanism can be retired per DLB-02 kill-condition discipline. If even one DLB warns and the operator has to intervene early, Contrarian's "never fired" claim is falsified.

**Specific concession to Contrarian:** the warn emits on log only, never blocks synthesis, never jumps CEO to early termination. It is purely observational. No behavior change.

### Q2 — Reporting-Layer Creep (Architect's reserved objection)

Architect's R2 reserved objection: *"(2b-converged) adds conformance signal to the token log, but nobody has specified who reads it. A metric nobody queries is the exact write-path-nobody-reads anti-pattern that nearly killed DLB-02."*

**Resolution:** the Next Actions include an explicit reader requirement — `/sgsd-token-audit` extended to surface top-N highest-`drift_pct` phases in its quick-mode output, and a milestone-close trigger that summarizes drift trends. Without a specified reader, (2b) degrades to (1b)'s pattern. This is a hard precondition on shipping Q2.

### Q3 — Retype Verdict (Architect+Contrarian vs Moonshot)

Architect R2: *"Moonshot's retype-MUDA is rejected overreach. It does not produce the 2 milestones of validated dispatch data DLB-02 mandated before wiring the classifier."*

Moonshot R2: *"SPEC-NOW fills the gap DLB-02 explicitly left open — the read-path's query templates were never specified. Adopting the spec now does not open the gate early."*

Contrarian R2: *"Terminology trick. Same empty-store activation problem, DLB-02 gate still unmet."*

**CEO synthesis:** Moonshot's SPEC-NOW is narrowly acceptable **as documentation only** — the Process Mining 7 patterns (bottleneck / rework / deviation / resource-outlier / temporal / variant / handoff) are written into `.brv/context-tree/architecture/patterns/muda-read-path-spec.md` as the algorithm specification. No code executes. No read-path wires. DLB-02's 2-milestone recurrence gate remains the activation trigger. Architect's concern about DLB-02 violation is addressed by the non-execution nature; Contrarian's "terminology trick" concern is logged as a risk (see below).

**This is NOT a win for Moonshot on read-path activation.** It is a narrow contribution to DLB-02's deferred specification, analogous to how DLB-03 left pre-mortem and V-model traceability as "future work when trace data exists" — naming the shape without building the machinery.

### Q4 — Research-Literature Evidence Bar (Contrarian's hardest hold)

Contrarian's decisive R2: *"Two independent literature sources are still literature. The 'two sources converging' argument would justify activating any well-researched idea before it has been run once."*

**Unanimous defer.** The first live v1.2 milestone-batch distillation output (built 2026-04-19/20, awaiting Gate 3 rating) IS the evidence cycle Contrarian demands. Running it against VTP research before it completes once is the sample-of-one fallacy. Revisit Q4 at v1.3 milestone close with actual promotion data.

## Trade-offs Accepted

- **Budget soft-warn without enforcement.** If a future DLB runs to 200k tokens, the warn fires but the deliberation continues to synthesis. No hard cap, no force-termination. Rationale: DLB-03 and DLB-04 both crossed 80k naturally and produced their best synthesis in R2; a hard cap risks killing legitimate convergence. Revisit if operator reports warn fatigue OR if deliberation exceeds 200k more than once.

- **Conformance metric without blocking.** `drift_pct` is logged per phase but does not block phase close. Verifier remains the blocking authority. Rationale: we don't know the distribution of drift values yet; a blocking threshold would be guessed. Metric-only for 1 milestone, then the question of "does drift_pct earn a gate verdict" can be revisited with real data.

- **MUDA write-path 3→5 probes (total), not 3→8.** Only extra-processing and inventory get probes; NUT, overproduction, transportation skipped. Rationale: the three skipped require higher-order inference (detecting "talent misallocation" or "overproduction" without explicit thresholds is ML-grade work). Extra-processing and inventory have mechanical proxies (ATC tier-vs-line-count mismatch; file-without-reference count). Contrarian's "0 recurrence" concern acknowledged but overridden on the narrow 2-probe scope — these are cheap and concrete.

- **SPEC-NOW as documentation, not activation.** Process Mining 7 patterns enter the memory tier as a read-path-spec artifact. The spec gets consulted if/when DLB-02's 2-milestone recurrence gate unlocks the read-path. Until then, it is an architectural commitment on paper. Accepted because Moonshot correctly identified that DLB-02 left the read-path algorithm unspecified, and filling that gap now (cost: one curated spec file) costs less than trying to specify it retroactively at activation time.

- **Q4 deferred to v1.3, not rejected.** Reopening hook lives at v1.3 milestone-close trigger: if Gate 3 novelty rating produces zero promotions (Contrarian kill fires) OR ≥2 promotions with cross-milestone confirmation, Q4 is re-opened with concrete evidence. Until then, no per-phase distillation.

## Risks Acknowledged

- **"Cap never fires" Contrarian dissent could be right (Q1).** If 4 more DLBs converge naturally without tripping the warn, the log is write-path-nobody-reads. *Mitigation*: explicit kill condition — retire the warn mechanism if warn count is 0 across next 4 DLBs. Sunset the instrumentation honestly rather than keep it "just in case."

- **Conformance reader absence (Q2).** Architect's reserved objection: a metric nobody queries is DLB-02's anti-pattern. *Mitigation*: `/sgsd-token-audit` extended in the SAME commit as conformance logging to surface top-3 drift phases. Do NOT ship conformance-log.jsonl writes without the audit-read integration.

- **Moonshot's SPEC-NOW as Trojan horse (Q3).** Contrarian's "terminology trick" read: SPEC-NOW documents the read-path so thoroughly that future reopening-pressure is hard to resist. *Mitigation*: the spec file explicitly states "DLB-02 2-milestone recurrence gate still applies to activation" in its frontmatter. Architect additionally gets veto authority on any future PR that cites the spec to justify early activation.

- **`drift_pct` denominator instability (Architect Q2 reserved objection).** Phase task counts vary widely (some phases 3 tasks, others 12); raw percentages produce noise on light phases. *Mitigation*: minimum-task-count guard (skip conformance if `planned_tasks < 5`) — matches Architect's R1 specification.

- **The 2 new MUDA probes may never fire either (Q3).** DLB-02 kill condition applies: if extra-processing or inventory probe shows 0 recurrence across 2 milestones, retire that probe. Same discipline as the existing 3.

- **Q4 deferral risks lock-in (Moonshot's residual concern).** By v1.3 close, the milestone-batch form will have shipped two live runs and gathered inertia; reopening becomes harder. *Mitigation*: DLB-05 explicitly mandates Q4 re-evaluation at v1.3 milestone close — no "if we remember" language. Automated trigger in `sgsd-distill-milestone` at v1.3 close emits a deliberation-needed flag if zero cross-milestone promotions occur.

## Next Actions

### Wave A — Q1 budget soft-warn (~30 min)
- [ ] Add `max_tokens` (default 120k) and `max_minutes` (default 20) to brief `## Termination` frontmatter in `super-gsd/templates/brief-template.md`
- [ ] Update `/sgsd-deliberate` SKILL.md: before each round, CEO reads current `token-log.jsonl` session total + elapsed wall clock; emits `[BUDGET WARN]` line if either exceeded; appends `{ts, dlb_id, spent_tokens, elapsed_sec, warn_fired: true|false, reason: cap_warned|natural|blocker}` to `.planning/metrics/deliberation-budget.jsonl`
- [ ] NO synthesis-jump, NO gate verdict — log only
- [ ] Kill instrumentation: retire the warn mechanism if warn count is 0 across 4 consecutive DLBs

### Wave B — Q2 conformance metric (~2-3h)
- [ ] Ship `super-gsd/scripts/sgsd-conformance-check.sh <phase>` — Haiku diff of PLAN.md task list (`- [ ]`/`- [x]`) vs SUMMARY.md FILES_CHANGED + VERIFICATION lines
- [ ] Compute `planned_tasks`, `evidenced_tasks`, `drift_pct = (planned - evidenced) / planned` — skip if `planned_tasks < 5` (minimum-count guard)
- [ ] Emit `{ts, phase, planned_tasks, evidenced_tasks, drift_pct, top_3_drivers}` to `.planning/metrics/conformance-log.jsonl`
- [ ] **MUST ship in same commit:** extend `/sgsd-token-audit` to surface top-N highest-`drift_pct` phases in quick-mode output (Architect's reserved-objection mitigation — no shipping conformance logs without a reader)
- [ ] Wire into phase-close sequence AFTER verifier (no gate verdict; does not block close)

### Wave C — Q3 narrow write-path expansion (~1.5h)
- [ ] Extend `super-gsd/scripts/sgsd-muda-probe.sh` with two new probes:
  - `extra_processing`: check `atc_tier` vs lines changed in phase (warn if FULL tier on <20 lines OR LITE tier on >80 lines; threshold GUESSED — 1-milestone calibration window)
  - `inventory`: count `.md` files written under phase dir not referenced by any subsequent phase within 3 commits (warn if ≥3; threshold GUESSED)
- [ ] Mark both with explicit `# threshold: GUESSED - 1 milestone evidence run per DLB-02 calibration rule` comment
- [ ] Update `sgsd-muda-audit.sh` to parse both new JSON fields alongside existing three
- [ ] Kill: retire either probe if 0 recurrence across 2 milestones (DLB-02 discipline)

### Wave D — Q3 SPEC-NOW adoption (~30 min, docs only)
- [ ] Create `.planning/memory/architecture/patterns/muda-read-path-spec.md` — curated via `sgsd-curate --type pattern --slug muda-read-path-spec`
- [ ] Document the 7 Process Mining anomaly patterns as query templates for DLB-02's deferred classifier-consults-memory read-path: bottleneck / rework / deviation / resource-outlier / temporal / variant / handoff
- [ ] Frontmatter must include: `activation: DEFERRED`, `gate: DLB-02 2-milestone recurrence rule`, `reviewer: Architect has veto on PRs citing this for early activation`
- [ ] This is documentation only. No code, no hooks, no tests. If you find yourself wiring anything, STOP — that's what's deferred.

### Wave E — Q4 defer instrumentation (~15 min)
- [ ] Add milestone-close trigger in `sgsd-distill-milestone` Mode 3 (`--rate`): after operator novelty rating completes, emit `q4_reopen_needed: true` to the memo if median novelty < 2.0 OR if zero cross-milestone promotions occur at v1.3
- [ ] Document in `.planning/decisions/DLB-05-vtp-audit-sharpening.md` trigger metadata: reopen Q4 at v1.3 close with actual evidence

### Kill-condition instrumentation (cross-cutting)
- [ ] `.planning/metrics/deliberation-budget.jsonl` — track warn count across DLBs; kill-check at DLB-09 (4 DLBs after this one)
- [ ] `.planning/metrics/conformance-log.jsonl` — track drift_pct distribution; calibrate threshold at v1.2 close
- [ ] `.planning/metrics/muda-log.jsonl` — two new class tags (`extra_processing`, `inventory`); kill-check per-probe at milestone close

## Deliberation Metadata

- Agents: Architect, Pragmatist, Contrarian, Moonshot (all Sonnet)
- Rounds: 2
- R1 token usage: ~112k (four agents, varying depth — Architect 36k read codebase, Pragmatist 36k read codebase, Contrarian 24k, Moonshot 16k)
- R2 token usage: ~73k (four agents, responses tighter after R1 positions available)
- **Estimated total: ~185k tokens**
- Phases affected: 6 (deliberation skill, verifier gate chain, MUDA write-path, memory tier spec file, metrics logging, architecture docs)
- Depends on: DLB-01 (memory tier — now v1.2 consolidated), DLB-02 (write-path discipline + read-path deferral), DLB-04 (milestone-batch distillation baseline)
- Blocks: nothing — unblocks v1.3 Q4 re-evaluation with actual Gate 3 rating data

## Pattern observed across DLB-01 → DLB-05

Every board deliberation has now validated the same principle: **evidence-before-machinery, with narrow write-path contributions that defer read-path activation until operational evidence earns it**. DLB-01 deferred BM25 ranking; DLB-02 deferred read-path; DLB-03 deferred scoring gates; DLB-04 deferred classifier consult of trajectory lessons; DLB-05 defers continuous distillation + MUDA read-path activation. VTP's external research signal is usefully catalogued (in the SPEC-NOW spec file), architecturally honored (in the conformance metric), but **not substituted for operational evidence** at activation grain.

The compounding-improvement loop the user named in DLB-03's combustion-engine framing is not yet closed — but it has been moved forward by one notch per deliberation, and DLB-05's convergent 4/4 on Q2 conformance is the first shared quantitative metric the substrate has produced. That is a real instrument, not a symbolic commitment.
