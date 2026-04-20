# Brief: DLB-05 — VTP-Audit Sharpening Proposals

## Situation

On 2026-04-20, a cross-project audit pulled super-gsd's current skills and tools against VTP's research briefings — specifically the `gsd-2.0-pi-framework` meetings (2026-04-08 "PI CEO Agents: Claude 1M Context Multi-Agent Strategic Decision Framework" and 2026-04-09 "LangChain vs LangGraph"), the 2026-03-15 "Process Mining & Intelligent Automation Platform" technical briefing (65 KB), and the 2026-03-17 "Toqan AI Platform — Knowledge Hub Review" (64 KB). Super-gsd has no entry in VTP's KB, so the audit is one-directional: what the research literature implies for our existing skills, not validation from prior super-gsd user history.

The PI CEO Agents meeting is functionally the blueprint super-gsd was built from — 6 of 6 key decisions match our `/sgsd-deliberate` mechanism (Opus CEO + Sonnet board, one-shot multi-agent, brief with required sections, broadcast mode, expertise-distinct-from-memory). **One decision does not match**: *"Apply real-world constraints (time 2-5 min, budget $1-5) to agent deliberation to force convergence."* We enforce `max_rounds: 3` but have no token/time ceiling; four DLBs have averaged ~117k tokens with DLB-04 at 137k.

Process Mining's technical briefing contributes three patterns we currently lack: (a) **conformance checking** — alignment-based measurement of actual execution vs planned model (§7-8), distinct from binary PASS/FAIL verification; (b) **seven specific anomaly patterns** each with a dedicated algorithm (§9), against our MUDA write-path which probes only 3 of 8 Toyota wastes; (c) **continuous Deploy→Monitor→Detect→Retune loop** (§12), against our milestone-batch distillation cadence.

Toqan contributes governance signals — explicit approval gates, audit trails — which our CEO/Board deliberation already satisfies in principle via git-committed decision memos, but without cryptographic signing.

LangGraph would add stateful-graph orchestration with loops; our 13-step shell+markdown loop already handles loops and shared state with zero Python runtime dependency. We treat this as validation of the existing architecture, not a gap.

## Stakes

**Adopted well:** deliberation gets a cost ceiling that matches the PI CEO blueprint the project was built from; verifier produces quantitative drift signal instead of binary pass/fail; MUDA completes its own stated 8-waste taxonomy instead of probing 3 of 8; learning loop closes faster via per-phase distillation.

**Adopted poorly:** we reopen DLB-04 Q3 (milestone-batch distillation, 3-1 ADOPT) without genuinely new evidence — VTP's Deploy→Monitor→Retune pattern is research-literature adjacent, not a concrete failure of the milestone-batch form we just shipped. Contrarian's sample-of-one trap resurfaces: we have **zero** live `sgsd-distill-milestone` promotions yet (v1.1 hypotheses await v1.2 close), so reopening Q3 before that evidence exists is pattern-chasing. Similarly, new MUDA probes with guessed thresholds repeat DLB-02's near-miss of a write path nobody reads. And a budget ceiling could be theatre — if DLBs naturally converge at their `max_rounds` anyway, the token cap never fires.

**Ignored:** we hit the compounding-improvement ceiling the user named in the DLB-03 combustion-engine framing. Four DLBs of disciplined architectural decisions, and each deliberation still costs ~117k tokens unregulated; verifier continues to hide drift; MUDA quietly under-specifies its own taxonomy; distillation runs at milestone-grain when per-phase grain would compound faster.

## Constraints

* Every adopted intervention must respect the DLB lineage invariants:
  - **Operator decides retirements** (DLB-02 kill discipline, DLB-04 Q2 SEPL invariant)
  - **Structure over theatre** (DLB-03 — enforcement via context-window mechanics, not regex checks or scored gates)
  - **Evidence before machinery** (DLB-02 — write-path before read-path; ≥2 milestones of real data before activation)
  - **Kill conditions are real** (no lingering half-built skills; retire what doesn't earn its keep)
* Must reuse existing primitives: `sgsd-curate`, `sgsd-recall`, the Haiku classifier, `sgsd-muda-audit` probes, the 6.x gate chain. New work is glue + specification, not replacement.
* Per-dispatch token overhead ≤ 100 tokens. We're already at Step 5.5 (intent injection) + Step 9.5 (per-dispatch ATC) + registry-lookup conditional costs.
* Must not introduce external paid infrastructure. Local filesystem + git + Claude Code Max plan OAuth only.
* VTP audit is external signal, not a mandate. The board is free to reject any of the 4 ideas as insufficient evidence.

## Key Questions

Four structured questions. Answers must be coherent across all four — they form a stance on *what sharpening deserves a build*, not four independent yes/nos.

### Q1. Budget ceilings on `/sgsd-deliberate` — enforce how?

PI CEO blueprint explicitly imposes time + budget caps to force convergence. Our four DLBs have run unbounded to ~117k tokens average. Options:

* **(a) Hard cap with synthesis jump.** Add `max_tokens` (default 80k) and `max_minutes` (default 15) to brief `## Termination`. CEO checks before each round; if exceeded, forces synthesis with current positions. Logs to `metrics/deliberation-budget.jsonl`.
* **(b) Soft warn + log.** Same fields, same logging, but exceeding the cap only emits a warning. Rounds continue. Operator sees the overage in the memo.
* **(c) Defer.** No cap. Evidence to date (4 DLBs, all converged within max_rounds) doesn't prove caps are needed. Revisit after another 4 DLBs of cost data.

### Q2. Drift / conformance detection — where and how much?

Verifier is binary PASS/FAIL; drift is invisible. Process Mining's alignment-based conformance is overkill but the concept — measure actual vs planned — applies. Options:

* **(a) Full 6.8 gate.** Haiku diff of `PLAN.md` (planned task list) vs `SUMMARY.md` (executed). Emits `CONFORMANCE.md` with `drift_pct` + top-3 drivers. Slots between 6.7 Evidence and phase close. Thresholds: warn >30%, fail >50%.
* **(b) Metric-only.** Same diff, same score, but no gate verdict — just writes to `metrics/conformance-log.jsonl` for trend analysis. No blocking. Retroactive only.
* **(c) Defer.** Acknowledge the gap but DEVIATIONS in SUMMARY.md already flags major drift. Evidence-gate on "current deviation reporting misses something concrete" before building.

### Q3. MUDA expansion — probe the missing 5 wastes or stay narrow?

Toyota taxonomy has 8 wastes; our DLB-02 write-path probes 3 (defects, waiting, motion). Options:

* **(a) Add all 5 as warn-only for 1 milestone, then calibrate FAIL thresholds.** Overproduction, non-utilised talent, transportation, inventory, extra-processing. Each ~20 lines of shell. Reuse phase-close hook.
* **(b) Add only 2 — extra-processing and inventory.** Both have concrete, measurable signals (ATC misclassification, stale files). NUT/overproduction/transportation are softer and may duplicate conformance (Q2).
* **(c) Stay at 3.** DLB-02 kill condition still active (2 milestones no recurrence → retire MUDA entirely). Do not add probes until recurrence in existing 3 proves MUDA earns its keep.

### Q4. Continuous distillation — reopen DLB-04 Q3?

DLB-04 resolved 3-1 ADOPT for milestone-batch distillation. Process Mining's Deploy→Monitor→Retune is research-literature continuous. Options:

* **(a) Reopen Q3 now.** Add `sgsd-distill-phase.sh` at phase-close; milestone aggregator still runs the triple gate. Cite VTP's architecture as new evidence.
* **(b) Defer until v1.3 close.** First let the milestone-batch form produce its v1.2 output, run Gate 3 novelty rating, and see whether the milestone-grain is the bottleneck. Then decide.
* **(c) Reject.** Deploy→Monitor→Retune is an enterprise-data-platform pattern at billions-of-events scale. Super-gsd at ~16 trajectories/milestone doesn't need continuous. The milestone-batch form has not yet had its evidence cycle.

Answers must be consistent. A stance that caps deliberation cost hard (1a) while also expanding MUDA with guessed thresholds (3a) and reopening Q3 without evidence (4a) signals cost-discipline in one place and evidence-abandonment in another — the board should catch that.

## Additional Context

* **VTP sources cited:**
  - `gsd-2.0-pi-framework` meeting 9ccfc34b-4e57-49f1-9ab1-99de470d4a7e — PI CEO Agents blueprint (topics + 6 decisions)
  - `gsd-2.0-pi-framework` meeting ce7ccd77-b737-4cb1-b76b-19f9aa1769dc — LangChain vs LangGraph (3 decisions)
  - Meeting 9a580aa1-3d72-451c-8105-35a0d581c3e9 — Process Mining briefing (65 KB, 20 sections)
  - Meeting 02f1caaf-6f89-42f9-8ba0-f2ae5cc9c97b — Toqan AI Platform briefing (64 KB)

* **Prior DLB consistency:**
  - DLB-01 (memory topology) — no direct overlap; VTP's Process Mining Kafka/Flink/ClickHouse stack would violate DLB-01's "defer ranking infra until benchmark earns it"
  - DLB-02 (MUDA learning loop) — Q3 directly extends; Contrarian's sample-of-one discipline still applies
  - DLB-03 (intent continuity) — Q1 cost ceiling is complementary (both force discipline through structural limit, not ceremony)
  - DLB-04 (self-evolving substrate) — Q4 reopens Q3 of DLB-04; board must judge whether VTP signal is sufficient new evidence

* **Contrarian pre-bait (expected critiques, being surfaced now):**
  - "New evidence for Q4?" — VTP is research-adjacent, not a super-gsd failure mode. Weakest of the four.
  - "Thresholds in Q3 are guessed." — Partially; (3a)'s "warn-only for 1 milestone then calibrate" is the mitigation. Still arguable.
  - "Budget cap (Q1) is theatre if DLBs converge naturally." — Track record: 4 of 4 DLBs converged within max_rounds. Cap may never fire.
  - "Conformance (Q2) duplicates DEVIATIONS reporting." — Possibly; need to decide whether drift_pct adds anything `DEVIATIONS:` lines don't.

* **Wave groupings for any eventual plan:**
  - **Wave A (Q1 implementation):** `max_tokens`/`max_minutes` in brief + CEO check + budget log. ~1h.
  - **Wave B (Q2 implementation):** Haiku conformance diff + CONFORMANCE.md + metrics log + optional 6.8 gate. ~2-3h.
  - **Wave C (Q3 implementation):** 2 or 5 new probes (depending on resolution). ~1-2h per probe.
  - **Wave D (Q4 implementation):** `sgsd-distill-phase.sh` + milestone aggregator adjustment. ~3h if adopted.

## Termination

phases_affected: 6
max_rounds: 2
gate_score: pending

<!-- 6 = deliberation skill (Q1), verifier + 6.x gate chain (Q2), MUDA write-path (Q3),
     distillation skill (Q4), metrics/logging (cross-cutting), architecture docs (cross-cutting).
     max_rounds 2 matches DLB-04; contrarian critiques are pre-surfaced so Round 2 is for
     synthesis refinement, not rediscovering the obvious. -->
