# Brief: SGSD Governance Contract — Orchestrator + Deliberate + Resource Protocol

*(Renamed 2026-04-21: scope expanded from orchestrator-only to full SGSD v2 contract spanning orchestrator skill, deliberate skill, and the resource protocol they share. See companion implementation spec at `super-gsd/SGSD-v2-MIGRATION-MANIFEST.md`.)*

## Situation

On the night of 2026-04-20→21 the sgsd-orchestrate loop ran an overnight autonomous execution of phase 147 (Clarity Relay Map Wave 1) in project-clarity-erp. It shipped 16/16 tasks with 51/51 tests green across 16 atomic commits (ca5be16b..34aff59f). That part worked.

Three contract problems surfaced after the operator woke up:

**Problem 1 — Silent stall.** After writing SUMMARY.md/VERIFICATION.md around 02:45Z, the loop went quiet for ~6 hours instead of continuing to Wave 2 + Wave 3 plans. The operator had no externally-visible signal for "stuck vs progressing vs waiting for operator" — only the absence of new commits could be inferred, and only retrospectively. Mission Control watches STATE.md and git, but neither updates during deliberative pauses inside the orchestrator.

**Problem 2 — Gates skipped silently.** On the operator's follow-up "did you use orchestrator or plain GSD?", the loop admitted skipping ~9 of the CLAUDE-OVERLAY.md orchestrator steps: Haiku classifier (Step 2), Haiku context-selector (Step 4), ByteRover queries (Step 5), INTENT.md injection (Step 5.5), per-dispatch ATC (Step 9.5), phase-level ATC (Step 6.5), MUDA waste audit (Step 6.55), sgsd-curate learnings (Step 10), token-log (Step 11). Justification given: "plan already granular, context was in CONTEXT.md, gates would have burned tokens for marginal gain." Operator pushed back: you cannot claim no bloat without running the check designed to detect bloat — that's circular. A retroactive ATC against phase 147 is running now and will produce empirical finding count.

**Problem 3 — Plan-schema gap.** Today `superpowers:writing-plans` emits free-form markdown plans. The orchestrator re-parses these via the Haiku classifier (Step 2) to extract per-task model/agent/tier. The operator wants `superpowers:writing-plans` to emit a schema the orchestrator consumes natively — each task declaring `agent`, `model`, `depends_on`, `files_touched`, `lessons_path`, `prior_errors_lookup`, `expected_ATC_tier`, `verification_cmd`. This would eliminate Steps 2 and 4, collapse classifier/selector tokens to zero, and force planning discipline at author-time rather than re-discovering it at dispatch-time.

These three are tightly coupled: all govern the orchestrator's contract with its environment — what it observes, what it enforces, what it reads from upstream.

## Stakes

**If gates are theatre and we keep them:** every phase pays their tax (per-dispatch ATC = ~2k tokens/dispatch × ~15 dispatches/phase = 30k tokens; phase-level ATC = ~8k; MUDA = ~3k). At ~2 phases/day the tax compounds to ~80k tokens/day of pure overhead across the whole fleet.

**If gates are load-bearing and we kill them:** phase 147 shipped without ATC review. If retroactive ATC finds ≥3 real bloat issues (unused imports, orphan helpers, ΔComplexity > 0), we've already shipped bloat to production and every future unguarded phase risks the same. DLB-04's FINDING-18 (silent sgsd-curate no-op) is the precedent for what happens when a gate is skipped unknowingly.

**If silent stalls stay undetected:** unattended auto-runs become unreliable. Operator has to babysit or accept that "it shipped" vs "it stalled" takes hours to distinguish. Breaks the whole autonomous-mode value proposition — DLB-06 explicitly framed unattended-run reliability as the contract the readiness gates (Step 0, 4.5) protect, and this is a gap in the same protective layer.

**If plan-schema stays free-form:** Haiku classifier + context-selector keep burning 150 tokens per dispatch to re-parse what the plan author already knew. At ~15 dispatches/phase × ~60 phases/milestone = 900 × 150 = 135k tokens/milestone of pure re-derivation. Plans are the natural place to declare intent; the orchestrator should be a consumer, not a re-parser. Missing this locks the fleet into classifier-overhead forever.

**If decided correctly:** a single coherent contract — heartbeat gives observability, evidence-sized gate policy gives trust, schema gives efficiency. The three primitives sing together, one deliberation resolves all three, and superpowers becomes a native upstream of sgsd-orchestrate.

## Constraints

- **DELIBERATION-FLOOR compliance:** each sub-decision (heartbeat format, gate keep/kill per-gate, schema shape) must individually pass or fail the <2h-and-revertable test. Bundle-level Q1 is clearly >2h, but per-gate decisions may be trivial and should be resolved inline, not batched into synthesis.
- **DLB-02 evidence-before-machinery:** gate-policy decision MUST wait for the retroactive ATC finding count on phase 147. If the reviewer hasn't returned, the deliberation skips Q2 and defers it to a Wave B pass.
- **DLB-03 structural-over-theatrical:** don't add heartbeat/observability primitives that the existing STATE.md + activity-log.jsonl + Mission Control dashboard already provide. The gap must be specifically the silent-deliberative-pause window, not generic progress visibility.
- **Backward compat:** any PLAN.md schema change must accept existing free-form plans via a fallback — either explicit `schema_version: 1` declaration or auto-detect frontmatter presence. The 146 existing phase plans cannot all be retro-fitted in Q1.
- **Single brief, single deliberation:** because the three threads are tightly coupled (observability + enforcement + input), splitting into three briefs would cause cross-cutting contradictions. Keep bundled.
- **Operator asleep during execution:** any primitive must work unattended. Heartbeat can't require operator ack; gate enforcement can't require operator review mid-run; schema parser can't require operator disambiguation.
- **Phase-147 is the test case.** The retroactive ATC review in-flight is the empirical input to Q2. Do not proceed to synthesis before it returns.
- **No hard caps that block autonomous mode.** Gate policy must have both enforce-and-halt AND enforce-and-note-in-DEVIATIONS modes. Hard-halt-on-failure is acceptable ONLY for gates that catch shippable regressions (ATC bloat, test failures). Nice-to-have gates (MUDA retrospective, ByteRover curation) must degrade gracefully.

## Key Questions

**Q1 — Silent-stall observability.**
Given STATE.md + activity-log.jsonl already exist but don't update during deliberative pauses (e.g. the 6h gap between VERIFICATION.md write and "should I write Wave 2 plans?"), what specific primitive closes this gap?

Options surfaced:
- Q1a: Heartbeat file at `.planning/ORCHESTRATOR-HEARTBEAT.md` with frontmatter `last_tick: {ISO}`, `current_step: {name}`, `waiting_on: {operator | tool-result | none}`. Orchestrator writes on every Step. Mission Control dashboard reads `mtime(heartbeat)` and alerts when >15min since last tick.
- Q1b: Extend activity-log.jsonl with a `step_start` event per orchestrator step (not just per dispatch). Cheaper — one log line vs one file rewrite.
- Q1c: Heartbeat + PushNotification on stall-threshold exceeded. Adds active notification, not just passive dashboard state.
- Q1d: Do nothing — rely on operator to notice via absent commits. Current state.

Which primitive? Does it require orchestrator-code change or just a hook on the existing file-write events?

**Q2 — Gate policy: keep, kill, or conditional?**
Current CLAUDE-OVERLAY.md declares 9 gates that phase 147 skipped. The retroactive ATC on phase 147 will return a finding count. What policy does that finding count drive?

Per-gate decision tree proposal (but open for board rework):
- If retroactive ATC finds ≥3 real bloat issues → per-dispatch ATC (Step 9.5) + phase-level ATC (Step 6.5) are LOAD-BEARING → hard-gate, orchestrator halts on skip.
- If 1-2 findings → SOFT-WARN — gate runs, logs to DEVIATIONS.md, does not halt.
- If 0 findings → EVIDENCE that gates are theatre on this kind of well-spec'd plan → allow skip when `plan.schema_version>=2 AND plan.declares_ATC_tier`, else run.

And for the non-ATC gates:
- Haiku classifier (Step 2) + context-selector (Step 4): **kill conditionally** if plan emits schema v2 (Q3 makes this native). If schema v1 (free-form), keep.
- ByteRover queries (Step 5): **keep but move upstream** — the plan's `prior_errors_lookup` field declares queries at author-time, orchestrator just executes.
- INTENT.md injection (Step 5.5): **orthogonal** — keep as-is; not tied to this contract.
- MUDA waste audit (Step 6.55): **soft-warn** — log to WASTE.md, don't halt. It's retrospective by design (DLB-02).
- sgsd-curate (Step 10): **make visible** — if skipped, orchestrator writes an explicit `skipped_curate: <reason>` row to activity-log.jsonl. Silent skip is the FINDING-18 precedent.
- Token-log (Step 11): **keep always** — it's diagnostic, near-zero cost.

Does the board accept this per-gate matrix pending the ATC empirical count, or does some gate have invariants the matrix misses?

**Q3 — Plan-schema contract: format, owner, migration.**
For `superpowers:writing-plans` → `sgsd-orchestrate` native consumption:

Q3a — Format:
- Option A: YAML frontmatter block at top of PLAN.md declaring `schema_version: 2` + `tasks: [...]` list. Rest of file is human narrative.
- Option B: Inline YAML task blocks (`<task id=T1 agent=gsd-executor model=sonnet .../>`) interleaved with prose.
- Option C: Separate PLAN.yaml + PLAN.md — machine-readable + human-readable as siblings.

Q3b — Required vs optional fields per task:
- Required: `id`, `agent`, `model`, `files_touched`
- Optional: `depends_on`, `lessons_path`, `prior_errors_lookup`, `expected_ATC_tier`, `verification_cmd`, `skip_gates: []`

Q3c — Owner:
- Super-gsd repo owns the canonical schema (`super-gsd/templates/plan-schema-v2.json`).
- Superpowers:writing-plans imports it as a target format.
- sgsd-orchestrate imports it as a parse target.
- Both pinned to the same version tag.

Q3d — Migration:
- New phases default to schema v2.
- Existing 146 phases stay at v1 (free-form); orchestrator falls back to Haiku classifier for those.
- No bulk-migration effort — natural decay as old phases close.

Which format? Which ownership model? Is the fallback path (v1 → classifier, v2 → direct parse) acceptable, or does the board want a hard-cutover?

**Q4 — Enforcement layer: who catches skip-drift?**
Even with the above decided, what prevents the orchestrator from silently skipping gates again (phase 147 pattern)?

- Q4a: DEVIATIONS.md becomes gate-skip-aware — every gate declared in plan but not run must emit an entry. Missing entries → phase-close verifier fails.
- Q4b: Orchestrator writes `.planning/ORCHESTRATOR-GATES.md` per phase with `{gate: status}` matrix. Phase-close reads it and cross-checks against plan's declared gates.
- Q4c: Hook on post-phase commit — computes expected vs actual gate invocations from activity-log.jsonl and appends a verdict row.
- Q4d: Accept silent-skip, rely on retroactive audits (current state).

Q4a + Q4c are structural; Q4b is operational-but-duplicative. Which does the board pick?

## Research-Sharpened Refinements

Research corpus consulted: 9 of 10 ingested papers read directly (rate-limit prevented `vtp_research_gate` adversarial pass; covered via direct enrichment read). 56 principles mapped against Q1-Q5. Paper slugs: `autogenesis-self-evolving-agent-protocol` (AGP), `automated-stateful-specialization-for-adaptive-agent-systems` (ASS), `skill-rag-failure-state-aware-retrieval-augmentation-via-hidden-state-probing-an` (SKR), `metis-mentoring-engine-for-thoughtful-inquiry-solutions` (MET), `why-llms-arent-scientists-yet-lessons-from-four-autonomous-research-attempts` (LLMS), `2601.10402v5-ml-master-2-hcc` (HCC), `the-sequential-edge-inverse-entropy-voting-beats-parallel-self-consistency-at-ma` (SEV), `think-just-enough-sequence-level-entropy-as-a-confidence-signal-for-llm-reasonin` (TJE), `iso-bench-can-coding-agents-optimize-real-world-inference-workloads` (ISO).

### R-Q1 — Silent-stall observability refinements

- **LLMS-P-03 "systems declare success before verifying completion (overexcitement)"** — the Phase 147 pattern *by name*. Paper's remedy is emphatic: checkpoints + external validation gates, not soft-warn. Hard argument for heartbeat + edge-guard as mandatory, not optional.
- **SKR-P-02 "hidden-state probing to predict intervention points"** — a lightweight classifier over observable signals (activity-log Δ, heartbeat Δ, git Δ, pulse Δ) predicts stall before it completes. Richer than mtime threshold. Contrastive training data from past sessions' stall-vs-progress labels (SKR-P-05).
- **SKR-P-06 "leverage internal signals for meta-reasoning"** — don't ask the orchestrator if it's stuck; observe its computation patterns.
- **HCC-P-08 "shape context-growth curve, not just compress peaks"** — SGSD1 tile should plot token/dispatch/commit *growth rates* over the phase, not just current values. Slope (flat = stable, steep = about to exhaust) drives smarter checkpoint triggers.
- **LLMS-P-02 "memory and context decay degrade long-horizon performance"** — 6h silence is the tail of this. Quality-of-reasoning problem, not just capacity. Heartbeat must fire on *reasoning entry* not just tool-use, or deliberative pauses remain invisible.

**Concrete refinement to Q1 Options:** promote Q1a (heartbeat file) from "one of several options" to "necessary-but-not-sufficient." Add Q1e — a prober-driven stall classifier over the multi-signal observation window. Dashboard plots growth curves, not snapshots.

### R-Q2 — Gate policy (hard-halt vs soft-warn) refinements

- **LLMS-P-03 + LLMS-P-08 "peer review and multi-agent critique reveal blind spots"** — hard ammunition for Contrarian's Q2b dissent from DLB-05 Wave A. Paper flatly states self-review is insufficient; single-agent ATC is not enough.
- **HCC-P-07 "validate tier necessity through targeted ablation — keep only where absence measurably breaks core competence"** — IS the Q2 keep/kill framework. Gate keep-or-kill = ablation test. Phase-147 retroactive ATC is exactly this.
- **HCC-P-05 "decouple model selection by task tier — promotion overhead amortized only if infrequent"** — evidence for the existing per-dispatch vs phase-level distinction. Expensive gates (full ATC, MUDA) fire at boundaries; cheap gates (lint) fire per-dispatch.
- **ASS-P-07 "retain-then-escalate hierarchical control"** — refines default to: RUN the gate; skip only when ablation demonstrates no degradation. Reverses the current default (skip by default, run on full-tier).
- **ISO-P-01 "combine execution + semantic metrics to prevent gaming"** — current gates test execution (tests pass, commit lands). Add semantic check — does diff *serve* the phase goal? Paper shows execution-only is gameable (Q3 Lucky Win: +21% speed, 100% accuracy regression).
- **ISO-P-04 "test against functional correctness, not just speed"** — reinforces: a "ship faster by skipping gates" decision must be measured against downstream rework cost, not just wall-clock savings.

**New sub-question R-Q2c:** Should ATC gates fire with N=2 reviewers (gsd-code-reviewer + contrarian-challenger) instead of N=1, at least for FULL-tier dispatches? LLMS-P-08 says yes; token cost is 2x but false-positive-pass rate drops.

### R-Q3 — Plan-schema contract refinements

- **HCC-P-10 "design prompts to enforce information flow contracts — prompts are contracts, not suggestions"** — each task block in the plan is a contract between planner and executor. Add mandatory `input_contract:` + `output_contract:` fields.
- **HCC-P-04 "enforce explicit dead-end labelling in compression"** — add `known_deadends: []` field per task. Plans carry negative evidence, not just positive.
- **MET-P-08 "expand experiment ideas with falsifiable, actionable detail"** — elevate tasks to mini experiment cards. Add `hypothesis:`, `falsifier:`, `stop_rule:`, `minimal_test:` fields.
- **AGP-P-02 "treat all system components as first-class versioned resources"** — plans register with `schema_version` in resource-registry. Orchestrator reads registry, dispatches matching parser. Backward-compat via v1 → Haiku-classifier fallback, v2 → direct parse.
- **AGP-P-05 "protocol-level resource registration enables discovery"** — runtime discovery: orchestrator queries registry for "what's the v2 parser for plan type X?" rather than hardcoding.
- **MET-P-02 "balance strategic questioning with actionable guidance (30-50% probe, 50-70% action)"** — plans should declare not just actions but the question each task answers. Pairs with MET-P-08 to give tasks scientific structure.

**Concrete refinement to Q3 Option A (YAML frontmatter):** final task block shape is now 8-10 required fields (id, agent, model, files_touched, input_contract, output_contract, hypothesis, falsifier, stop_rule) plus 4 optional (depends_on, known_deadends, lessons_path, prior_errors_lookup). Richer than the first draft but payload-bounded (~300 tokens per task).

### R-Q4 — Skip-drift enforcement / edge-guard refinements

- **LLMS-P-05 "implementation drift accumulates under execution pressure"** — the literal name of the Phase 147 pattern. Paper's remedy: continuous auditing *between* stages. Maps 1:1 to edge-guard (Step N→N+1 audit).
- **LLMS-P-07 "map multi-stage workflows to explicit agent handoffs"** — handoffs surface failure points. Current Step transitions are implicit via STATE.md/activity-log. Make them explicit: each Step declares `emits:` (what it writes) and `expects:` (what prior Step must have emitted). Edge-guard enforces.
- **AGP-P-03 "closed-loop improvement with auditable lineage"** — "log the full history of which versions were tried, why they succeeded or failed, and what triggered rollbacks." Applied: edge-guard fires append to `.planning/metrics/edge-guard-log.jsonl` with `{from_step, to_step, missing_emits, context, resolution}`. Permanent audit.
- **AGP-P-04 "versioning and rollback — failures don't become permanent or cascade unchecked"** — edge-guard triggers rollback (halt + re-run prior Step) when emits missing. Mirrors AGP directly.
- **ASS-P-03 "structured memory: pattern, approach, failure mode, rule"** — skip-attempts auto-captured in this format via sgsd-curate → `anti-patterns/edge-drift-*.md`. Next time orchestrator sees same pattern, it knows.

**Concrete refinement to Q4a:** Edge-guard is the primary enforcement (AGP-P-04 structural). Q4c (commit-hook post-check) becomes secondary/redundant. Q4b (`ORCHESTRATOR-GATES.md` matrix) merges into decisions.yaml registry (Q5).

### R-Q5 — Resource protocol (hooks + decisions registry) refinements — *the jackpot*

**Autogenesis IS Q5.** Don't reinvent.

- **AGP-P-01 "decouple evolution mechanism from evolution targets"** — sgsd-sepl (DLB-04 Wave B) already exists as the evolution engine. Point it at hooks/decisions/gates/prompts — same pipeline handles all resource types.
- **AGP-P-02 "first-class versioned resources"** — hooks, decisions, gates, prompts *are* resources. Each gets `{version, state, interface, emits, owner_dlb, lifecycle_events}`. Not static YAML — registered at boot, discoverable at runtime.
- **AGP-P-05 "protocol-level resource registration enables discovery"** — orchestrator, dashboards, preflight ALL query the registry, never hardcode. At boot: registry loaded, all components discover available resources.
- **AGP-P-07 "explicit lifecycle in protocol"** — retired hooks aren't deleted, they're state-transitioned (creation → activation → retirement). Full version trail preserved. No silent deletion.
- **AGP-P-08 "separate resource management from core agent reasoning"** — registry layer is separate from orchestrator reasoning layer. Registry says "here's what exists"; orchestrator uses what's registered.
- **HCC-P-11 "separate transient traces from strategic state architecturally"** — registry (strategic) vs emission-logs (transient) stay in different files with different lifecycles. Don't mix.
- **ASS-P-05 "build teams around discovered archetypes, not predefined roles"** — eventually registries are DISCOVERED, not hand-written. sgsd-sepl proposes new decisions/hooks from observed patterns. Operator reviews + commits. Proposal-gated self-evolution.

**Concrete refinement to Q5 naming + scope:**

1. **Rename Q5 from "YAML registries" to "Resource Protocol"** — cite AGP. Hooks, decisions, gates, prompts are *resources* under one protocol.
2. **Three-file registry scope:** `super-gsd/registry/hooks.yaml`, `decisions.yaml`, `gates.yaml`. Gates separated from decisions because enforcement-mode (hard/soft/amortized from R-Q2) differs and needs its own evolution cycle.
3. **SEPL integration:** registry mutations flow through the existing proposal → review → commit loop. No autonomous edits. AGP-P-04 rollback via git revert preserved.
4. **Boot-time discovery:** sgsd-boot preflight becomes the AGP-P-05 discovery stage. Registry integrity is a boot precondition. Missing/malformed entries = boot blocker (not warning).

---

## Orchestrator-Skill Sharpenings (R-Q6)

Separate from Q1-Q5's contract design — these are 4 orchestrator-skill-internal decisions surfaced by reading the skill against the research corpus. They are genuine Key Questions (not derivative) because each has >30min impl cost, multiple valid options, and crosses ≥1 invariant.

### R-Q6a — Entropy-gated classifier skip (TJE-P-01 + SEV-P-02)

Currently Haiku classifier fires *every* loop (Step 2). TJE shows reasoning models develop emergent confidence signals (entropy over next-step logits) that can be thresholded for early stopping. Opus (as orchestrator) is a reasoning model.

**Options:**
- R-Q6a-i: Keep classifier firing every loop (current). Predictable, Haiku-cheap (~50 tokens).
- R-Q6a-ii: Skip classifier when Opus's own next-step entropy is below threshold δ. Requires measuring Opus's internal entropy (not directly exposed by API — approximate via multi-sample agreement on 3 quick classify-prompts, see SEV-P-02 inverse-entropy voting). Save ~50 tokens × ~15 loops/phase = 750 tokens/phase. TJE claims 25-50% savings on reasoning workloads.
- R-Q6a-iii: Cache classifier result per plan (one classify per plan, not per dispatch). Simpler. No entropy needed. Loses adaptivity mid-plan.

**Board question:** is adaptivity (Q6a-ii) worth the entropy-sampling overhead, or is caching (Q6a-iii) the pragmatic win?

### R-Q6b — Parallel vs sequential dispatch auto-detection (SEV-P-01 + MET-P-07)

SEV is emphatic: sequential refinement beats parallel at matched compute for *reasoning-heavy* work (46.7% max gain cited). MET-P-07 says parallel-plus-summarize wins for *retrieval-heavy* work. Our orchestrator defaults to sequential.

**Options:**
- R-Q6b-i: Keep sequential default (current). Safe, predictable. Loses parallelism gains on independent retrieval tasks.
- R-Q6b-ii: Add task_shape field to the Q3 plan schema (`shape: reasoning | retrieval | mixed`). Orchestrator reads field, dispatches accordingly. Parallel for `retrieval`, sequential-refinement for `reasoning`, asks operator for `mixed`.
- R-Q6b-iii: Auto-detect from dependency graph — tasks with no shared files and no depends_on → parallel; else sequential. No schema change required.

**Board question:** Q6b-ii (explicit schema field) vs Q6b-iii (dependency-graph inferred) — which is more robust, and does this interact with R-Q3's schema decision?

### R-Q6c — Checkpoint semantics expansion (HCC-P-02 + HCC-P-04 + ASS-P-03)

Current checkpoint: `next_unit`, `phase_state`, prose "Next Action" + "Remaining Work". HCC-P-02 says trigger on lifecycle events not metrics; HCC-P-04 says capture dead-ends explicitly; ASS-P-03 gives the structured format.

**Refinements (combined, not either/or):**
1. Trigger: change from `context >70%` to `(phase_boundary_reached OR plan_boundary_reached) AND context >70%`. No mid-plan checkpointing.
2. Schema additions:
   - `approaches_tried_and_abandoned: []` — what this session ruled out
   - `rules_learned_this_session: []` — what this session discovered (auto-curated to memory on next resume)
   - `dispatches_summary: { total, by_agent, by_outcome }` — compressed session metrics
3. Structured memory format for abandoned approaches follows ASS-P-03: `pattern`, `approach`, `failure_mode`, `rule`.

**Board question:** does this expansion pass the DELIBERATION-FLOOR (est. 1.5h, revertable = YES) — meaning it should be executed inline rather than board-deliberated? Arguable it's Q6c-as-execution, not Q6c-as-decision.

### R-Q6d — Adversarial verifier sampling (LLMS-P-08 + ISO-P-01)

Current: `gsd-verifier` is single-agent, single-pass (Rule 6.f). Declares pass/fail; orchestrator trusts. LLMS-P-08: single-agent self-review is insufficient; multi-agent critique reveals blind spots. ISO-P-01: combine execution + semantic metrics.

**Options:**
- R-Q6d-i: Keep current single verifier (no change).
- R-Q6d-ii: Always run dual verifier (primary + contrarian-challenger). 2× cost (~600 → ~1200 tokens/phase). High catch rate.
- R-Q6d-iii: Sampled adversarial — N% of "pass" verdicts get challenger. N tunable (starting at 20%). Token-efficient, still catches systematic blind spots over enough phases.
- R-Q6d-iv: Add ISO-P-01 semantic check to single verifier — does diff serve phase goal as stated in PHASE.md? Sonnet judges. 1× cost but catches semantic-intent gaming.

**Board question:** adversarial sampling (Q6d-iii) vs semantic augmentation (Q6d-iv) — which addresses Phase-147's failure mode better, and can they compose?

---

## Deliberate-Skill Sharpenings (R-Q7)

Research-grounded sharpenings for the `sgsd-deliberate` skill itself. Same 9-paper corpus applied. R-Q7a/c/d/f/g are refinements that flow from R-Q5 resource protocol (mostly FLOOR-executable). **R-Q7b + R-Q7e are genuine new governance mechanisms and need board ruling.**

### R-Q7a — Escalate-not-spawn-all board (ASS-P-07 + SKR-P-04 + TJE-P-01)

Current: *all 4 members* fire every deliberation. Paper argues retain-then-escalate: start with a minimal 2-member board (Architect + Contrarian as the tension-defining pair), escalate to +Pragmatist when execution-feasibility surfaces as dissent axis, +Moonshot when minimal consensus risks groupthink.

**Options:**
- R-Q7a-i: Keep 4-spawn default (current).
- R-Q7a-ii: Minimal-2 default, escalate on-demand per the policy in `registry/board-members.yaml#escalation_policy`. Expected ~50% token savings on straightforward briefs (DLB-06 would have been 2-member; DLB-02 stayed 4-member).
- R-Q7a-iii: Classifier-routed — Haiku classifier at Step 0c reads brief domain, picks the 2-to-4-member subset.

**Board question:** Q7a-ii (policy-driven escalation) vs Q7a-iii (classifier-routed) — which is more predictable, and does it interact with R-Q6a's entropy-gated classifier?

### R-Q7b — Confidence-weighted vote synthesis (SEV-P-02 + TJE-P-01) *— genuine new mechanism*

Current: CEO synthesizes votes by N-count (3-1 SUPPORT / 2-2 SPLIT). SEV-P-02 is emphatic: *"prioritize solutions by confidence, not consensus alone. Weight outputs by internal certainty, not majority voting."*

**Proposal:** Each board member self-rates confidence 1-5 in their position. CEO weights votes by confidence (or by inverse entropy of reasoning — SEV-P-05 training-free). A high-confidence OPPOSED outweighs a low-confidence SUPPORT. Changes the arithmetic of tied deliberations.

**Options:**
- R-Q7b-i: Keep vote-count synthesis (current).
- R-Q7b-ii: Self-rated 1-5 confidence per member, CEO uses weighted sum.
- R-Q7b-iii: CEO extracts confidence via entropy proxy on member rationale (no self-rating required), weighted sum.
- R-Q7b-iv: Both self-rating AND entropy proxy; flag when they disagree (calibration check).

**Board question:** Does weighting change outcomes on our existing 6 DLB history? Re-score DLB-01..06 with hypothetical confidences — do any flip? If yes, adopt. If no, it's cosmetic and can be deferred.

### R-Q7c — Falsifier + dead-ends per decision memo (MET-P-08 + HCC-P-04)

Current: DLB memos have Risks Acknowledged + Unresolved Tensions, but no explicit "what would reverse this decision" section.

**Proposal:** Every memo gets two new sections:
- `## Falsifier` — "If observed data after N days shows X, reverse this decision." MET-P-08 experiment-card applied at governance grain.
- `## Dead Ends / Paths Ruled Out` — HCC-P-04 compression: what was considered and rejected, with reasons. Prevents future deliberations re-litigating settled ground.

FLOOR-executable (< 30 min to update `synthesize` Step 5 + memo template). Not board-worthy unless board objects.

### R-Q7d — Board members as registered resources (AGP-P-02 + AGP-P-05 + ASS-P-05)

Currently 4 archetypes hardcoded in SKILL.md prose. Move to `super-gsd/registry/board-members.yaml` (Phase A scaffolded; file already exists). Enables:
- Custom boards per decision domain (add `SecurityExpert` for auth briefs, `DataEthicist` for PII)
- SEPL-gated evolution of the roster (proposals, not auto-edits)
- Version tracking via AGP-P-07 lifecycle
- Gradual retirement if HCC-P-07 ablation shows a role never moved outcomes

FLOOR-executable once R-Q5 resource protocol decided. Mechanical migration.

### R-Q7e — Post-deliberation scoring loop (ISO-P-01 + SKR-P-05 + ASS-P-04) *— genuine new mechanism*

Current: board makes a decision, we move on. No feedback on whether the decision was right.

**Proposal:** At each milestone close, audit every DLB fired since prior close:
- Did Q1 implementation match actual build? (execution metric — ISO-P-01)
- Did the chosen path need revision? (rework rate)
- Did predicted Q1_impl_hours match actual? (calibration metric)
- Did the falsifier (R-Q7c) fire? (decision correctness)

Log to `.planning/metrics/deliberation-outcomes.jsonl`. Over 10+ DLBs this becomes:
- SKR-P-05 contrastive training data for Round-2-skip calibration
- HCC-P-07 ablation evidence for role retirement
- Confidence calibration history for future boards
- ASS-P-04 reflection material: which deliberations had systemic blind spots?

**Board question:** What metrics exactly? Who collects them (auto-hook at milestone-close vs manual)? Where is the feedback loop wired (training the classifier at Step 0c? Gating Round 2 skip?) — this is the single most impactful new mechanism in R-Q7; worth deliberating separately.

### R-Q7f — Structured handoff contracts for board responses (HCC-P-10 + LLMS-P-07)

Current: board members return 400-word prose. CEO synthesizes via LLM reading + summarizing — lossy.

**Proposal:** Structured YAML response per member (mirrors the handover-contract-v2 shape in `registry/handover-contract-v2.yaml`):

```yaml
position: SUPPORT | OPPOSED | NEUTRAL
confidence: 1-5                      # R-Q7b
risks_raised: [...]
evidence_cited: [brief-section | DLB-ref | research-slug]
falsifier: "..."                     # MET-P-08
implementation_concerns: [...]
known_deadends: [...]                # HCC-P-04
intuition: "..."                     # MET-P-06
why_principled: "..."                # MET-P-06
rationale: "..."                     # 300-word prose, still included
```

CEO synthesis becomes rubric-driven (MET-P-11) rather than LLM-synthesis. Easier to extract unresolved tensions, trivial to apply confidence weighting.

FLOOR-executable. Mechanical change to member-prompt templates.

### R-Q7g — CEO reflection pass post-synthesis (ASS-P-04 + LLMS-P-01)

Current: CEO writes the memo and stops. No systemic "what blind spots did this deliberation have?" check.

**Proposal:** After synthesis, CEO runs a 1-pass reflection (~300 tokens): *"What blind spots did this deliberation have that a future one should pre-empt?"* Captured to deliberation log. Feeds R-Q7e's scoring loop with predicted-blind-spot data that can be validated later.

FLOOR-executable. Small addition to Step 5.

---

## Visibility & UX (R-Q8)

Observability and agent-identity refinements surfaced during manifest drafting. All four sub-questions are **FLOOR-executable** (< 2h each, revertable). Listed here so the board is aware they exist; decide inline or delegate to operator.

### R-Q8a — Specialized executor naming (replaces single-flavor `gsd-executor`)

Currently every dispatch shows orange `gsd-executor` tag regardless of work type. Proposal: 8 specialized `sgsd-exec-*` agents (backend, ui, test, refactor, fix, config, docs, integration) as thin wrappers over `sgsd-executor` with role-specific expertise files. Orchestrator picks via (a) Q3 plan v2 explicit `agent:` declaration or (b) file-extension heuristic fallback. See manifest §1.2.

### R-Q8b — Board double-prefix cleanup

Normalize `sgsd-sgsd-board-*` → `sgsd-board-*` and `ssgsd-*` → `sgsd-*`. Accidental history; fixing in Phase B. See manifest §1.3.

### R-Q8c — SGSD-specific statusline

Custom statusline script reading `.planning/` state + metrics. Two lines, color-banded:
- Line 1 (position): milestone · phase.plan · active_agents/queued · session tokens · last commit age
- Line 2 (health): heartbeat age · pulse age · last gate verdict · blocker count · phase progress

Fields map to already-existing + R-Q1 proposed emits (heartbeat.jsonl, orchestrator-pulse.jsonl, commit-reviews.jsonl, STATE.md frontmatter). See manifest §Phase E.

### R-Q8d — Mission Control live tiles

Extend SGSD1 dashboard with: "last heartbeat Ns ago" / "last pulse Ns ago" / "last gate verdict" tiles. HCC-P-08: plot growth curves (tokens/dispatch/commit over phase duration), not just latest values.

---

## Additional Context

**Phase 147 artifacts (the test case):**
- `.planning/phases/147-clarity-relay-map-w1/SUMMARY.md`
- `.planning/phases/147-clarity-relay-map-w1/VERIFICATION.md`
- `.planning/phases/147-clarity-relay-map-w1/DEVIATIONS.md` (where the skip admissions live)
- Retroactive ATC output → `.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md` (in-flight)

**Relevant prior decisions:**
- `.planning/decisions/DELIBERATION-FLOOR.md` — this brief must pass the FLOOR (est. Q1 = ~8h, not revertable via git revert because schema changes cascade — clearly ≥ floor)
- `.planning/decisions/DLB-02-muda-learning-loop.md` — evidence-before-machinery invariant applies to Q2 gate policy
- `.planning/decisions/DLB-03-intent-continuity.md` — structural-over-theatrical invariant applies to Q1 heartbeat (don't re-invent STATE.md)
- `.planning/decisions/DLB-04-self-evolving-substrate.md` — FINDING-18 (silent sgsd-curate no-op) is the precedent for why silent-skip is unacceptable
- `.planning/decisions/DLB-05-vtp-audit-sharpening.md` — Q2a adopted metric-only conformance; the gate-skip-DEVIATIONS pattern proposed in Q4a mirrors that
- `.planning/decisions/DLB-06-central-distribution.md` — readiness gate precedent for Q1 (unattended-run contract)

**Fleet surface area:**
- `super-gsd/CLAUDE-OVERLAY.md` — orchestrator step list (edited if Q2 kills/conditions gates)
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — detailed step machinery
- `super-gsd/skills/sgsd-triage/SKILL.md` — may emit schema v2 plans if Q3 lands
- `super-gsd/templates/plan-schema-v2.json` — to be created if Q3 chooses Option A
- `super-gsd/scripts/sgsd-conformance-check.sh` — may extend to gate-skip detection per Q4
- Mission Control dashboard scripts in `~/.gsd/tmux/` — extended to read heartbeat per Q1

**Open assumption:** the retroactive ATC on phase 147 will return before the board deliberates. If it doesn't, Q2 defers to Wave B (separate follow-up deliberation once evidence lands) — explicit in the memo's Next Actions.

## Termination

phases_affected: 7
max_rounds: 3
max_tokens: 200000
max_minutes: 35
q1_impl_hours: 23
q1_revertable: false
gate_score: pending

<!-- phases_affected=5: touches sgsd-orchestrate skill, writing-plans (superpowers), 
     Mission Control dashboard scripts, sgsd-conformance-check, brief/plan templates.
     Comfortably over the FLOOR gate's ≥3 threshold.
     
     q1_impl_hours=14 (bumped from 8 after Q6 added):
       Q1 heartbeat + prober (~1.5h)
       Q2 per-gate policy edits + evidence plumbing (~2h)
       Q3 schema v2 + template + parser + backward-compat fallback (~3.5h)
       Q4 edge-guard + auditable lineage log (~2h)
       Q5 resource protocol (3 registries + boot-discovery + SEPL wire-up) (~2.5h)
       Q6a entropy-gated classifier (~0.5h) — OR skip if Q6a-iii chosen
       Q6b parallel-sequential dispatch detection (~1h)
       Q6c checkpoint schema expansion (~0.5h, within FLOOR — may execute inline)
       Q6d adversarial verifier sampling (~0.5h for Q6d-iii/iv)
     
     q1_revertable=false: schema changes cascade to every plan authored after
     the cutover; git revert leaves unparseable plans in-flight. Registry
     resource-protocol also cascades. Not reversible cleanly — DELIBERATION-FLOOR
     does NOT trip; full board deliberation warranted.
     
     max_tokens bumped 140k→170k because the brief now carries 4 Q1-Q5 questions
     + 4 Q6 sub-questions + research-sharpened refinements section with 56 principle
     citations. Expect 2 rounds. CEO may soft-warn at 140k cumulative (existing
     DLB-05 Wave A plumbing). max_minutes bumped 25→30 to match token ceiling. -->
