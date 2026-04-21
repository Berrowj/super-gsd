---
type: deliberation-memo
date: 2026-04-19
brief: .planning/briefs/2026-04-19-self-evolving-resource-substrate.md
board: [architect, pragmatist, contrarian, moonshot]
rounds: 2
vote: "3-1 ADOPT (narrow synthesis) — Architect + Contrarian + Moonshot converge on (1c, 2a, 3b-trajectory, 4b) with triple hallucination gate; Pragmatist dissent on Q3 timing (holds 3c until v1.3)"
decision: "Ship a scoped Agents manifest, an operator-gated SEPL proposal script, and a milestone-close trajectory-distillation pass with three independent hallucination safeguards. Borrow RSPL/SEPL vocabulary without AGP spec conformance. FINDING-18 slug-discipline fix is a Day 0 blocker."
---

# DLB-04: Self-Evolving Resource Substrate — Narrow Trajectory-Distillation Synthesis

## Recommendation

Adopt the **coherent stance (1c, 2a, 3b-trajectory, 4b)** — minimum-viable resource manifest, operator-gated propose→commit loop, trajectory-distillation at milestone close with triple hallucination gate, and AGP-vocabulary borrow without schema conformance. This is a **narrow adoption**, not a full RSPL/SEPL build.

The deliberation's signal move was Round 2's independent convergence on **trajectory distillation as structurally distinct from finding-distillation**. DLB-02's sample-of-one critique correctly gated *finding-counting recurrence*; it does not gate *abstract pattern extraction over phase trajectories*, which are generated every phase regardless of waste recurrence. Moonshot's insight, stress-tested by Architect and conceded-in-part by Contrarian, survived Round 2. Pragmatist's dissent — that v1.1's corpus is install-audit-heavy — was refuted by Moonshot's factual rebuttal: phases 1-7 are dispatch-heavy feature-build work; only phase 8 is self-audit.

The adoption ships with three independent anti-hallucination safeguards, each proposed by a different agent, layered together:
- **Architect**: output type `trajectory-hypothesis` (not `trajectory-lesson`) until v1.3 cross-milestone confirmation — classifier never surfaces candidates as ground truth
- **Moonshot**: two-phase-citation Haiku validation gate — patterns must cite ≥2 distinct phase references or go to a `candidate/` subdirectory
- **Contrarian**: human novelty rating at v1.2 close — if zero candidates beat what a human reader would already know, **delete the script**, this is a real kill condition

FINDING-18's partial fix (`sgsd-curate.sh` runs but produces pathological slugs — Pragmatist verified a timestamped slug `waste-waiting-p08-narrative-stale-2026-04-19-20-01-38z` in INDEX.md) is a Day 0 blocker. Slug-discipline guard must land before any distillation output is committed.

## Board Stances — R1 → R2 Evolution

| Agent | R1 Position | R2 Final | Key Movement |
|---|---|---|---|
| **Architect** | (1c, 2a, 3c, 4b) — defer Wave C entirely | (1c-Agents-only, 2a, 3b-modified, 4b) | **Conceded** trajectory-distillation is not sample-of-one. Added `trajectory-hypothesis` typing to prevent classifier surfacing. Scoped manifest to Agents after MUDA-classifier identified as v1.2 consumer. |
| **Pragmatist** | (1c, 2a, 3c, 4b) — manifest-only | (defer Q1 entirely, 2a, 3c, 4b) | **Hardened** the Q1 concession: no v1.2 consumer → no manifest at all. **Verified** FINDING-18 slug pathology. Dissented on Q3: v1.1 corpus not worth 3h; revisit at v1.3. |
| **Contrarian** | Reject all 4 — do nothing | (1c, 2a, 3b-trajectory-gated, 4b) | **Largest shift**: conceded Moonshot's distinction was structurally sound but empirically premature; proposed novelty-rating kill condition. Conceded Architect's silent-drift argument on Q4 (typed Agents is a real failure-mode guard). |
| **Moonshot** | (1b, 2b, 3b-trajectory, 4b) | (1c, 2a, 3b-trajectory, 4b) | **Conceded** 1b collapsed to no-op without named v1.2 consumer. **Conceded** 2b violated "operator decides retirements" invariant (auto-commit on PASS retires prior rule state). **Held** 3b-trajectory with factual refutation of Contrarian's install-audit-heavy premise. |

### Unanimous (4/4) in R2
1. **Q2: Operator-gated SEPL (2a).** Moonshot's explicit concession that auto-commit violates the "operator decides kill conditions" invariant was decisive. `/sgsd-deliberate` + git already IS propose→assess→commit at architecture grain; at resource grain, proposals drop into `.planning/proposals/` for operator review.
2. **Q4: Borrow vocab, keep idiom (4b).** Contrarian's spec-conformance creep warning is logged as a residual risk, not a blocker. The Architect-named failure-mode (Agents silently escaping phase-readiness probes) gives the vocabulary concrete mechanical anchor.
3. **FINDING-18 is Day 0.** All four agents touched this. Slug-discipline guard must ship before any distillation output is written.

### Strong consensus (3/4) in R2
4. **Q1: Manifest-only (1c), scoped to Agents.** Architect identified MUDA classifier's pre-dispatch query as the v1.2 consumer for Agents-typed resources. Environments are dropped (no v1.2 consumer). Pragmatist dissents: no consumer is named with sufficient certainty; defer.
5. **Q3: Trajectory distillation with triple hallucination gate (3b-modified).** Architect, Contrarian, Moonshot converge. Pragmatist dissents on timing.

## Unresolved Tension — Q3 Timing (3-1 Split)

Pragmatist dissents on shipping `sgsd-distill-milestone` in v1.2. Their argument: one closed milestone with install-audit-dominated findings (v1.1) produces a corpus too weak to justify the 3h build. They would ship at v1.3 close with two milestones of data.

The 3-agent majority argument:
- **Moonshot's factual correction holds**: v1.1 phases 1-7 are dispatch feature-build, not install-audit. Phase 8 dominates *findings* but not *trajectories*.
- **Architect's hypothesis typing** defuses the Pragmatist concern: output goes to `trajectory-hypothesis/` not to active `trajectory-lesson/`. No classifier surfacing until v1.3 confirms.
- **Contrarian's novelty-rating kill** prevents the script from outliving its welcome: zero-novel-pattern milestone-close = delete the script.

**Resolution**: ship at v1.2 close with `trajectory-hypothesis` typing + two-phase-citation gate + novelty-rating kill. Pragmatist's dissent is recorded; the three gates are the cost of buying the timing.

## Trade-offs Accepted

- **Manifest scoped to Agents only.** No Prompts, Environments, Tools, Memory in the Agents manifest — Tools and Memory already have their own inventories via git + INDEX.md; Prompts are embedded in SKILL.md by DLB-03's structural-injection principle; Environments have no v1.2 consumer. If a future milestone surfaces a need (e.g., MCP state drift causing dispatch failure), re-open for Environments.
- **SEPL loop is coarse-grained by design.** `/sgsd-deliberate` handles architecture-grain; `sgsd-sepl-propose.sh` handles resource-grain (single-file CLAUDE.md additions, script tweaks); git is the commit ledger for both. No automated assess step — the operator reads the proposal and commits manually. This satisfies the "operator decides kill conditions" invariant at every grain.
- **Vocabulary adoption without spec conformance.** We call them "resources," we call proposals "SEPL proposals," we use the Autogenesis terminology in docs. We do **not** structure registry JSON to AGP spec. Contrarian's gradient-descent-toward-conformance warning is logged: if Autogenesis's revision history shows churn, we hold the vocabulary but drop the terminology references.
- **Distillation output is pre-lesson until v1.3.** `trajectory-hypothesis/` files are written at v1.2 close but never retrieved by the classifier. v1.3 close runs the recurrence check across both milestones; surviving hypotheses promote to `trajectory-lesson/` and become classifier-readable.
- **Pragmatist's dissent on timing accepted as minority view.** If at v1.2 close the novelty-rating returns zero novel patterns, Pragmatist was right and the script is deleted. No face-saving iteration.

## Risks Acknowledged

- **FINDING-18 slug-discipline bug is real and adjacent.** Pragmatist verified `sgsd-curate.sh` produces malformed slugs with embedded timestamps. Any distillation output written through this path inherits the pathology. *Mitigation*: Day 0 fix adds a slug-validation guard to `sgsd-curate.sh` — reject slugs containing `[0-9]{4}-[0-9]{2}-[0-9]{2}` or ending in `z`. Add a unit smoke-test in the installer.
- **Haiku distillation hallucination on N=1 corpus.** Architect's reserved objection. *Mitigation*: triple gate (hypothesis typing + two-phase citation + novelty rating) is exactly this risk's mitigation. If any gate fails, the output is not committed to active memory.
- **Manifest without read path = MUDA's inventory-waste near-miss.** Architect's admitted blind spot. *Mitigation*: the manifest is **only** built if the DLB-02 MUDA read path is wired within the same v1.2 milestone. If MUDA's classifier-consult wire-up slips out of v1.2, the manifest is deferred alongside it. Strict coupling, not parallel build.
- **Vocabulary creep into spec conformance.** Contrarian's R2 residual critique. *Mitigation*: annual review (v2.0) of whether AGP adoption has produced spec-conformance PRs; if it has, revert to neutral vocabulary.
- **Phase 8 trajectory dominates the v1.1 corpus.** Contrarian's partial-concession point. *Mitigation*: `sgsd-distill-milestone` must be run with a `--exclude-phase-type self-audit` flag for the v1.1 pass. Phases 1-7 trajectories only. This prevents the self-audit phase from priming the distillation with install-audit patterns.
- **`/sgsd-deliberate` + git already IS SEPL at architecture grain.** Contrarian's R1 framing holds. The new `sgsd-sepl-propose.sh` must demonstrably serve a grain that deliberation doesn't — single-file rule additions, 10-line script tweaks, prompt-template edits. If after v1.2 no proposal used the script (operator deliberated every change anyway), retire it.

## Next Actions

### Day 0 — Blockers (before any DLB-04 work)
- [ ] Fix `sgsd-curate.sh` slug-discipline bug — reject slugs matching `[0-9]{4}-[0-9]{2}-[0-9]{2}` or ending `z`; validate slug-charset `[a-z0-9-]+`
- [ ] Add smoke-test to installer: `echo body | sgsd-curate --type pattern --slug smoke-test --summary "installer smoke" && grep smoke-test .brv/context-tree/INDEX.md`
- [ ] Confirm DLB-02's MUDA write-path has landed (required precondition for 1c coupling)
- [ ] Confirm DLB-03's `outcome_delivered` injection has landed (required for trajectory corpus to be semantically aligned)

### Day 1 — Agents manifest (1c, scoped) — only if MUDA read path commits to v1.2
- [ ] Create `.planning/resource-registry/agents.jsonl` — one record per `super-gsd/agents/*.md` file: `{id, path, sha, mtime, model, type, status}`
- [ ] Ship `super-gsd/scripts/sgsd-registry-sync.sh` — walks `super-gsd/agents/`, computes sha via `git hash-object`, writes records atomically
- [ ] Wire into `sgsd-orchestrate` Step 2 (classifier) — agents manifest is readable to the classifier for agent-selection queries
- [ ] Post-install hook: run `sgsd-registry-sync.sh` after `install.sh` completes

### Day 2 — Operator-gated SEPL (2a)
- [ ] Ship `super-gsd/scripts/sgsd-sepl-propose.sh` — writes proposal file to `.planning/proposals/{date}-{slug}.md` with frontmatter `resource_type`, `target_path`, `change_description`, `rationale`
- [ ] Ship `super-gsd/scripts/sgsd-sepl-commit.sh` — reads a proposal file, applies the change (for rule additions: appends to CLAUDE.md; for script tweaks: prints diff for operator review), git-commits atomically with `feat(sepl): {proposal_slug}` message
- [ ] Document in `super-gsd/skills/sgsd-orchestrate/SKILL.md`: when an executor agent wants to propose a single-resource improvement, it emits SCRIPTS_CREATED pointing to a proposal file, not an auto-commit
- [ ] Log proposals + commits to `.planning/metrics/sepl-log.jsonl`

### Day 3 — Trajectory distillation (3b-trajectory, gated) — ship at v1.2 close
- [ ] Ship `super-gsd/scripts/sgsd-distill-milestone.sh` (~80 lines with gates; Moonshot's 60-line estimate was pre-gates)
- [ ] Input: all `.planning/phases/{milestone}/*/SUMMARY.md` + `WASTE.md` + verifier reports; `--exclude-phase-type self-audit` flag
- [ ] Haiku pass 1: extract candidate abstract patterns from trajectories
- [ ] Haiku pass 2 (**two-phase-citation gate**): each candidate must cite ≥2 distinct phase references by commit or plan ID; candidates citing only 1 phase go to `.brv/context-tree/trajectory-hypothesis/candidate/`
- [ ] Surviving candidates write to `.brv/context-tree/trajectory-hypothesis/{milestone}-{slug}.md` with frontmatter `type: trajectory-hypothesis`, `confirmed_milestones: [v1.1]`, `phases_cited: [X, Y]`
- [ ] **Novelty-rating kill gate**: at v1.2 close, operator reads the generated hypotheses and rates novelty 1-3; record in `.planning/metrics/distillation-novelty.jsonl`; if median rating <2/3 across all hypotheses, flag `sgsd-distill-milestone` for retirement at v1.3 review
- [ ] Wire into `sgsd-orchestrate` milestone-close hook (Rule 7 path extension), not phase-close

### v1.3 milestone-close — Promotion + retirement review
- [ ] Run `sgsd-distill-milestone` for v1.2; compare hypotheses with v1.1 hypotheses
- [ ] Promote hypotheses appearing in both milestones to `.brv/context-tree/trajectory-lesson/` — classifier can now surface them
- [ ] Retire the `sgsd-distill-milestone` script if zero promotions happen (Contrarian's kill condition)
- [ ] Wire classifier-consult read path for `trajectory-lesson/` entries only (never `trajectory-hypothesis/`) — gated by DLB-02's ≥2-milestone evidence gate, which this path now satisfies

### Deferred (v1.3+ or evidence-gated)
- [ ] **Prompts as typed resources** — structural injection (DLB-03) requires prompt content in context-window. Re-open only if a concrete failure mode surfaces (e.g., prompt-template drift across SKILL.md files causes measurable dispatch divergence).
- [ ] **Environments as typed resources** — no v1.2 consumer. Re-open only if MCP state drift or permission-drift causes a measurable failure.
- [ ] **Auto-commit SEPL variants (2b, 2c)** — revisit only if operator-gated proposal queue proves bottlenecked after 2+ milestones of SEPL use.
- [ ] **Full AGP spec conformance (4a)** — revisit only if Autogenesis protocol stabilises (6+ months post-publication with no breaking revisions) AND a real interop use case emerges.
- [ ] **Rollback resource-typing** — Pragmatist R2 verdict: `git revert` covers 95% of SGSD rollback cases. "Typed rollback" is marketing until someone names a failure `git revert` could not handle.

### Kill-condition instrumentation
- [ ] `.planning/metrics/distillation-novelty.jsonl` — one line per hypothesis at each milestone close: `{ts, milestone, hypothesis_id, novelty_rating, rater}`
- [ ] `.planning/metrics/sepl-log.jsonl` — one line per proposal + one per commit: `{ts, event: proposal|commit, slug, resource_type, outcome}`
- [ ] Phase-close hook appends a summary counter to `.planning/metrics/readiness-log.jsonl` so the SGSD dashboard can surface "proposals submitted / committed / idle" per milestone
- [ ] v1.3 review: if `sepl-log.jsonl` shows zero proposals submitted during v1.2, retire `sgsd-sepl-propose.sh` (it didn't serve a grain `/sgsd-deliberate` wasn't already serving)

## Deliberation Metadata

- Agents: Architect, Pragmatist, Contrarian, Moonshot (all Sonnet)
- Rounds: 2
- R1 token usage: ~68k (4 agents, ~17k each)
- R2 token usage: ~69k (4 agents, ~17k each)
- Estimated total: ~137k tokens across both rounds
- Phases affected: 8 (Wave A registry + rollback ~3 phases, Wave B SEPL scripts + lineage ~3 phases, Wave C distillation script + schema ~2 phases; Wave D explicitly out of scope, evidence-gated)
- Depends on: DLB-01 (memory tier `sgsd-recall`), DLB-02 (MUDA write path and FINDING-18 fix), DLB-03 (outcome_delivered injection)
- Blocks: nothing — unlocks the "compounding improvement across milestones" framing when `sgsd-distill-milestone` first-run completes at v1.2 close
- Cross-DLB coherence: synthesis is consistent with DLB-01 (git-native, no external infra), DLB-02 (operator-gated, evidence-first, real kill conditions), DLB-03 (structural over theatrical, context-window enforcement)

## Pattern observed across DLB-01 → DLB-04

Every SGSD deliberation so far has converged on the same architectural principle under four different vocabularies: **structure over ceremony, evidence before machinery, kill conditions that actually kill**. Autogenesis's RSPL/SEPL terminology is borrowed in this decision for the same reason DLB-03 borrowed "structural injection" — useful shorthand for principles the project already held. The adoption is linguistic, not architectural.
