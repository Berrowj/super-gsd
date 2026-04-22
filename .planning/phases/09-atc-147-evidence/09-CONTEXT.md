# Phase 9: ATC-147-Evidence — Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase produces **empirical evidence** that Phase 10's keep/kill gate policy matrix (`super-gsd/registry/gates.yaml`) will key against. Output is audit artifacts + a structured finding count — NOT code.

Specifically:
1. Classification of every finding in the external `project-clarity-erp` Phase-147 ATC review (10 findings total: 4 WARN + 6 INFO) into buckets Phase 10 can threshold against.
2. A gate-bypass audit that enumerates the 9 CLAUDE-OVERLAY gates Phase 147 silently skipped, with per-gate token-cost estimates so Phase 10 can decide keep/kill on empirical cost-benefit grounds.
3. A single headline finding number + structured breakdown placed where Phase 10 and later phases can discover it (milestone evidence registry).

**Not in scope:** code changes to Phase-147 itself (that's the external project's follow-up work — recommendations land in DEVIATIONS.md there, not here).
</domain>

<decisions>
## Implementation Decisions

### Classification Taxonomy (D-01)
- **D-01:** Use a **4-bucket classification**: `real-bloat` / `nit` / `false-positive` / `integration-gap`. The fourth bucket exists because Phase 147's W1 (OwnerLookup orphaned from production data path) and W2 (SLA resolve_target_seconds orphaned) are integration concerns, not bloat. Forcing them into `real-bloat` would inflate Phase 10's bloat-trigger threshold with signal that is qualitatively different (orphan wiring vs. unnecessary code).
- **D-01a:** Classification is performed by a Sonnet sub-agent dispatched via Phase 9's plan. The agent reads the external review (`../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md`) and assigns each of the 10 findings (W1–W4, I1–I6) to one of the four buckets with a ≤20-word justification per assignment.
- **D-01b:** Headline "finding count" exported to Phase 10 = count of `real-bloat` + `integration-gap` buckets (i.e., findings that represent genuine code or integration problems, not hygiene). Nits and false-positives are tracked separately but do not drive Phase 10's hard-halt threshold.

### Output Format (D-02)
- **D-02:** Phase 9 emits **both** a headline integer AND a structured YAML table:
  - `headline_finding_count: N` — single int, matches the REQUIREMENTS "≥3 / 1–2 / 0 thresholds" language from the Q2 proposal.
  - `findings_by_bucket: { real_bloat: N, integration_gap: N, nit: N, false_positive: N, info: N }` — per-bucket breakdown for per-rule drill-down.
  - `findings_detail: [{ id: "W1", bucket: "integration-gap", title: "...", justification: "..." }, ...]` — full per-finding provenance.
- **D-02a:** YAML (not JSON). Matches the `gates.yaml` / `board-members.yaml` registry format landing in v1.2 and is human-readable in the registry directory.
- **D-02b:** Deliberately **NOT** adopting the "per-gate would-have-caught-N-findings" table — that inference is speculative because Phase-147's review was phase-level, and attributing phase-level findings back to per-dispatch gates is not reliably derivable. Per-gate impact analysis belongs in Phase 10's keep/kill deliberation, not here.

### Gate-Bypass Audit (D-03)
- **D-03:** Enumerate the **canonical 9 skipped gates** per `super-gsd/skills/sgsd-orchestrate/SKILL.md`:
  1. Haiku classifier (Step 2)
  2. Haiku context-selector (Step 4)
  3. ByteRover query injection (Step 5)
  4. INTENT injection (Step 5.5)
  5. Per-dispatch ATC (Step 9.5)
  6. Phase-level ATC (Step 6.5) — *NOTE: the retroactive review we're classifying IS this gate, fired 1 day late*
  7. MUDA waste audit (Step 6.55)
  8. sgsd-curate learnings (Step 10)
  9. Token-log JSONL (Step 11)
- **D-03a:** **Theoretical per-dispatch cost estimation** — read token budgets from `.planning/config.json` and `sgsd-orchestrate/SKILL.md`, multiply by Phase-147's **16 T-commits** (plus 1 phase-close commit). Produces reproducible numbers anchored to the framework spec. Do NOT re-simulate (cross-repo boundary + agent non-determinism make replay fragile); do NOT use free-form reasoned estimates (inconsistent across reviewers).
- **D-03b:** Per-gate audit row format: `{ gate: "...", step: N, per_dispatch_tokens: N, dispatches_bypassed: 16, total_bypass_cost: N, fired_retroactively: bool, verdict_pointer_to_phase_10: "..." }`. The last field is a one-line pointer to what Phase 10's keep/kill deliberation will need to resolve (e.g., "classifier: was the bypass defensible because all 16 T-commits were same-type linear tasks? Phase 10 to decide the skip-rule predicate.").

### Evidence Registry & External Versioning (D-04)
- **D-04:** Output materialises to **TWO locations**:
  1. **Phase working dir** — `.planning/phases/09-atc-147-evidence/` holds the live drafts + verification artifacts.
  2. **Milestone evidence registry** — `.planning/milestones/v1.2/evidence/147-review.md` is a stable pointer document with the classification table, gate-bypass audit summary, and the external commit SHA range (`ca5be16b..c41634c4` per the ATC review frontmatter). This is what Phase 10+ reads.
- **D-04a:** **Commit SHA pin** — the registry file MUST include the reviewed commit range so any future re-review (e.g., if Phase 147 Wave 2 lands and changes the code) can detect drift. Format: `external_repo_pin: { repo: "project-clarity-erp", commits: "ca5be16b..c41634c4", reviewed_at: "2026-04-20" }`.
- **D-04b:** Do **NOT** symlink to the external review (Windows path fragility + breaks if the operator moves the external repo). Pull and freeze the essential content into the registry doc.
- **D-04c:** The milestone evidence dir (`.planning/milestones/v1.2/evidence/`) does not exist yet — Phase 9's plan includes a task to create it AND to author `.planning/milestones/v1.2/INTENT.md` (closes the checkpoint's `INTENT_MISSING` deviation).

### Claude's Discretion
- Exact task breakdown in PLAN.md (how many plans, which tasks in each wave) is the planner's call.
- Whether to run the classification via a single sub-agent pass or split per-bucket (W-findings vs I-findings) is executor-driven.
- The Phase-9 verifier can re-parse the YAML and assert bucket counts match the finding-detail table as a mechanical check.

### Folded Todos
*None — no pending todos matched Phase 9 scope at context time.*
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### External Phase Being Audited (read-only)
- `../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md` — The retroactive ATC review. Contains all 10 findings (W1–W4, I1–I6), pass-rate grid, one-liner verdict. Primary input for D-01/D-02.
- `../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/SUMMARY.md` — Phase 147's own close summary. Useful for context on why gates were bypassed.
- `../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/DEVIATIONS.md` — The "operator handoff" framing that the ATC review flagged as hiding W1/W2 integration gaps. Background only.
- `../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/PLAN.md` — Phase 147's plan (2180 lines). Reference for token-cost denominator (16 T-commits). Do NOT read full; grep for T-task count.

### v1.2 Milestone Drivers
- `.planning/decisions/2026-04-21-sgsd-v2-retro.md` — RQ4 v1.2-B sequencing; establishes why Phase 9 is the evidence gate for Phase 10.
- `.planning/briefs/2026-04-21-orchestrator-contract.md` — Parent brief with the Q2 keep/kill proposal that defines the ≥3/1-2/0 threshold language. The headline count format in D-02 must match this threshold schema.
- `.planning/REQUIREMENTS.md` §ATC-EVIDENCE — ATC-147-01, -02, -03 success criteria.
- `.planning/ROADMAP.md` §"Phase 9: ATC-147-Evidence" — 4 numbered success criteria, one of which (criterion 4) explicitly references the ≥3/1-2/0 threshold.

### Framework Spec (for D-03 token-cost methodology)
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — Source of truth for the 9 gate steps, per-step token budgets (Step 2 classifier ~50, Step 4 context-selector ~100, Step 9.5 per-dispatch ATC ~300, Step 6.5 phase ATC ~600, Step 6.55 MUDA ~100, etc.), and exit conditions.
- `.planning/config.json` — Model routing table (`model_routing`), ATC config (`atc.*`), token-efficiency block (`token_efficiency.*`). All drive the theoretical cost multiplications.

### Prior Evidence Template (for D-04 registry format)
- `.planning/decisions/2026-04-21-sgsd-v2-retro.md` — Example of the lightweight `YYYY-MM-DD-slug.md` format sanctioned by D013. Registry pointer doc can follow this shape (frontmatter + sections + revert clause).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Prior CONTEXT.md files (Phases 01–08 shipped under v1.1, Phase 11 shipped under v1.2) — consistent structure to mimic. Phase 11 is the most recent template for an audit-adjacent phase.
- `.planning/phases/11-plan-schema-v2/11-ATC-REVIEW.md` — Another phase-level ATC review (ours, not external). Confirms the review-output YAML-frontmatter + findings-table format that Phase 9's classification output should mirror for consistency.
- `gsd-code-reviewer` agent — exists in `~/.claude/agents/` (per Phase 11). Could be reused if Phase 9's classification work is genuinely ATC-shaped; however Phase 9's job is lighter (classify existing findings, not re-find them), so a fresh narrow prompt to a Sonnet agent is likely cheaper.

### Established Patterns
- Phase-level outputs with `---` YAML frontmatter + `## Section` headers (used consistently across this project).
- Decision-note format `YYYY-MM-DD-slug.md` per D013 — applicable to the milestone evidence registry pointer doc.
- Cross-repo references use relative paths with `..` parent traversal. Works on Windows/WSL with forward slashes.

### Integration Points
- Phase 10 will read `.planning/milestones/v1.2/evidence/147-review.md` (D-04). Any schema change there requires a Phase 10 plan amendment.
- Phase 10's `super-gsd/registry/gates.yaml` will key thresholds against `headline_finding_count`. Phase 9's chosen integer semantics (real-bloat + integration-gap only) MUST be documented in the registry doc so Phase 10 doesn't accidentally re-count nits.
</code_context>

<specifics>
## Specific Ideas

- The ATC-147 review itself called out point 5 of its "Recommended follow-ups": *"the auto-mode skip was defensible because every finding here is cross-task (ATC #1 and #2 fail at integration boundaries between T5/T8/T9/T10) and per-dispatch ATC would NOT have caught these; only a phase-level review could."* — Phase 9's gate-bypass audit should quote/reference this conclusion when evaluating the per-dispatch-ATC gate's would-have-caught value (D-03b verdict_pointer field).
- Review header says `tests_passing: 51/51` and `production_lines: 769 across 14 files` — these are useful denominators for the audit narrative (bypass cost per shipped line, per shipped test).
- Audit should note that the phase-level ATC gate itself fired, just retroactively — so its token cost is NOT zero for Phase 147; it was deferred, not skipped.
</specifics>

<deferred>
## Deferred Ideas

- **Re-simulation of gates on Phase-147 commits** — considered for D-03 but ruled out as too fragile (cross-repo boundary + agent non-determinism). If Phase 10's deliberation concludes that theoretical estimates are insufficient, a separate phase can re-open this.
- **Per-gate would-have-caught-N-findings inference table** — speculative given phase-level review source; Phase 10's deliberation is the right place for per-gate impact analysis.
- **Automated propagation back into Phase 147 DEVIATIONS.md** — the ATC review recommended this for the external project; NOT Phase 9's scope (would require writing into a different repo).
- **Wave 2 / Wave 3 ATC reviews for Phase 147** — the ATC-147 review recommends mandating phase-level review at each Wave close. That's external project work, tracked there.

### Reviewed Todos (not folded)
*None — no pending todos surfaced at context-gathering time.*
</deferred>

---

*Phase: 09-atc-147-evidence*
*Context gathered: 2026-04-22*
