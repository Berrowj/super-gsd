---
phase: 09-atc-147-evidence
researched: 2026-04-22
domain: retroactive-ATC evidence + gate-bypass audit (DOCS/EVIDENCE phase — no code)
confidence: HIGH
researcher: gsd-phase-researcher (sonnet)
---

# Phase 9: ATC-147-Evidence — Research

## Summary

Phase 9 is an EVIDENCE phase, not a code phase. It converts the external `project-clarity-erp` Phase-147 retroactive ATC review (10 findings, 16 T-commits + 1 phase-close) into three consumable artefacts: (1) a 4-bucket classification with a headline integer Phase 10 can threshold against, (2) a 9-gate bypass audit with theoretical token-costs multiplied by 16 dispatches, (3) a milestone evidence registry at `.planning/milestones/v1.2/evidence/147-review.md` with an external SHA pin.

All four locked decisions (D-01 through D-04) resolve the methodology; research filled in the mechanical gaps. The 16-T-commit denominator for D-03 is verified (`## Task N:` header grep across external PLAN.md → 16 matches, matching SUMMARY.md's T1→T16 table). Per-step token budgets are verified against `sgsd-orchestrate/SKILL.md` lines 36-44, 246-247, 424-425, 466, 594, 615-632, 731 — the concrete table lives in §Per-Gate Token Budget below. The 4-bucket classification maps cleanly to all 10 findings with zero judgement-calls required; one reviewer-note (the ATC review's own follow-up §5 paragraph) resolves what would otherwise be the W1/W2-as-bloat-vs-integration ambiguity.

Verification is mechanical — `validate.cjs` already carries `js-yaml` v4 at `super-gsd/tools/plan-schema/node_modules/js-yaml`, and its loader pattern (`gray-matter` + `js-yaml`) is reusable for the verifier's YAML-reparse check (D-02a chose YAML to match the `gates.yaml`/`board-members.yaml` registry format landing in v1.2).

**Primary recommendation:** Structure the plan as **two short plans** — (1) classification + registry authoring (generates the YAML artefact + 147-review.md pointer doc + INTENT.md), (2) gate-bypass audit (the 9-row token-cost table). Classification is a single Sonnet sub-agent pass with a narrow prompt (~400 tokens input); no need to reuse `gsd-code-reviewer` because we're classifying, not re-finding. Verifier = tiny Node/bash script that re-parses the YAML with `js-yaml`, asserts `headline == real_bloat + integration_gap` and `len(findings_detail) == 10`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: 4-bucket classification.** Taxonomy: `real-bloat` / `nit` / `false-positive` / `integration-gap`. Performed by a Sonnet sub-agent that reads the external review and assigns each of 10 findings (W1-W4, I1-I6) to one bucket with a ≤20-word justification.

**D-01a:** Classification is done by a dedicated Sonnet pass (not `gsd-code-reviewer` reused). The agent receives the external review content inline; it does not re-read the Phase-147 code.

**D-01b:** Headline `finding_count` exported to Phase 10 = `real-bloat + integration-gap` ONLY (hygiene-only findings and false-positives do not drive Phase 10 thresholds).

**D-02: Both headline int AND structured YAML table** keyed `findings_by_bucket` + `findings_detail` with full per-finding provenance.

**D-02a:** Output format is YAML, matching `gates.yaml` / `board-members.yaml` registry precedent.

**D-02b:** NO per-gate would-have-caught-N-findings inference — speculative because source review is phase-level.

**D-03: Theoretical per-dispatch token cost × 16 T-commits** (plus 1 phase-close). Source: `sgsd-orchestrate/SKILL.md` per-step budgets + `.planning/config.json` model routing. No re-simulation. No free-form reasoning.

**D-03b:** Per-gate row shape: `{ gate, step, per_dispatch_tokens, dispatches_bypassed, total_bypass_cost, fired_retroactively, verdict_pointer_to_phase_10 }`.

**D-04: Two output locations.**
1. Phase working dir `.planning/phases/09-atc-147-evidence/` — live drafts + verification.
2. Milestone evidence registry `.planning/milestones/v1.2/evidence/147-review.md` — stable pointer doc Phase 10+ reads. Includes external SHA pin `ca5be16b..c41634c4`.

**D-04c:** Phase 9's plan must ALSO create `.planning/milestones/v1.2/INTENT.md` (closes `INTENT_MISSING` deviation).

### Claude's Discretion

- Exact task breakdown in PLAN.md (wave count, task IDs).
- Single classification pass vs. split per-bucket — executor's call.
- Verifier implementation — likely mechanical YAML reparse + count-assertion.

### Deferred Ideas (OUT OF SCOPE)

- Re-simulation of gates on Phase-147 commits (cross-repo + non-determinism fragile).
- Per-gate would-have-caught-N-findings inference table (belongs in Phase 10 deliberation).
- Automated propagation into external project DEVIATIONS.md (cross-repo write).
- Wave 2 / Wave 3 ATC reviews (external project's work).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ATC-147-01 | Finding count with each finding classified real-bloat vs nit vs false-positive | D-01 4-bucket taxonomy + §Classification Mapping below assigns all 10 findings unambiguously |
| ATC-147-02 | ATC review output lives at `.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md` in external project + cross-linked from this milestone's evidence registry | Verified: external file exists at that path with frontmatter `commits_reviewed: ca5be16b..c41634c4`. Registry pointer doc per D-04 at `.planning/milestones/v1.2/evidence/147-review.md` |
| ATC-147-03 | Gate-bypass audit captures the 9 skipped gate categories with token-cost estimates | §Per-Gate Token Budget below extracts all 9 per-step budgets from SKILL.md — concrete denominators ready for multiplication by 16 |

## Project Constraints (from CLAUDE.md)

The project CLAUDE.md (Super GSD root) defines the orchestrator contract. Constraints that bind Phase 9:

- **Permissions:** sub-agents dispatched in auto mode must NEVER ask for approval (`mode: "auto"` on every spawn).
- **Commit discipline:** atomic commits per unit, `feat({phase}-{plan}): {one-liner}`, named files only, never `git add -A`.
- **Report format:** 300-word max structured report with FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER.
- **Karpathy principles** (Golden Rule 15): think-before-coding + simplicity-first + surgical-changes + goal-driven — all enforced by existing gates.
- **State reads:** frontmatter-only (`offset 0, limit 30`). Do not load full files in loop.
- **Doc-only phase:** Phase 9 touches only `.md` and `.yaml` files; per-dispatch ATC at SKILL.md Step 9.5 skips doc-only dispatches (`at least one file in FILES_CHANGED is CODE, not *.md, not .planning/`). So Phase 9 itself pays ZERO per-dispatch-ATC cost on its own execution — the whole phase is about *other* dispatches.

## Architectural Responsibility Map

Phase 9 is a single-tier DOCS phase. No multi-tier concerns.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Classification of external findings | Planning / evidence | — | Pure read + categorize pass; no code, no runtime, no storage. Sonnet sub-agent dispatch. |
| Token-cost estimation | Planning / evidence | — | Arithmetic over SKILL.md declared budgets × 16. No execution. |
| Evidence registry authoring | Planning / docs | — | Markdown + YAML file authoring. Same tier as decision notes. |
| INTENT.md authoring | Planning / docs | — | Closes a deviation logged in checkpoint; milestone-level doc. |
| Verifier (YAML reparse) | Tools / validation | — | Reuses existing `js-yaml` at `super-gsd/tools/plan-schema/node_modules/`. Node script or bash one-liner. |

## Standard Stack

This is a docs/evidence phase — no new libraries to install. Existing repo tools suffice.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| js-yaml | 4.x | Parse the YAML output during verification | [VERIFIED: `super-gsd/tools/plan-schema/package-lock.json` + `validate.cjs:166` `const yamlPath = path.resolve(__dirname, 'node_modules', 'js-yaml')`] Already pinned in repo; `validate.cjs` loads it via `require(yamlPath)`. No new install. |
| gray-matter | bundled | Parse YAML frontmatter in markdown | [VERIFIED: same location as js-yaml, `validate.cjs` line ~165 `require(matterPath)`] Optional — only if the registry pointer doc uses frontmatter (recommended per D013 format). |
| Sonnet (via Agent) | — | Classification sub-agent | [VERIFIED: `.planning/config.json` line 40 `"planner": "sonnet"`] Standard planner/executor tier. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sonnet classification sub-agent | `gsd-code-reviewer` agent | [VERIFIED: `super-gsd/agents/` directory listing] `gsd-code-reviewer` exists but does *finding* work (running ATC checks on a diff). Phase 9 classifies existing findings — a strictly narrower task. Reusing the reviewer pays for unused prompt surface. Fresh narrow Sonnet prompt is cheaper and clearer. |
| YAML output | JSON output | [CITED: `.planning/phases/09-atc-147-evidence/09-CONTEXT.md` D-02a] YAML matches v1.2 registry precedent (`gates.yaml`, `board-members.yaml`). JSON would require Phase 10 to translate. |
| Symlink to external review | File copy + SHA pin | [CITED: 09-CONTEXT.md D-04b] Windows path fragility + breaks if external repo moves. Copy-and-freeze is the deterministic choice. |

## Runtime State Inventory

Phase 9 is a greenfield docs/evidence phase. No renames, no refactoring, no migration. Skipped intentionally — no stored data, no live-service config, no OS registrations, no secrets, no installed packages affected by this phase's output.

## Per-Gate Token Budget (Research Question 1 — CONCRETE TABLE)

Direct extraction from `super-gsd/skills/sgsd-orchestrate/SKILL.md`. Each row cites the source line in SKILL.md for verifiability. This table IS the input to D-03 arithmetic.

| # | Gate Name | Step # in SKILL.md | Declared Per-Dispatch Budget (tokens) | Source |
|---|-----------|-------------------|---------------------------------------|--------|
| 1 | Haiku classifier | Step 2 (lines 148-186) | **~50** | [VERIFIED: SKILL.md line 38 `Classify (Haiku): ~50 tokens`] |
| 2 | Haiku context-selector | Step 4 (lines 197-210) | **~100** | [VERIFIED: SKILL.md line 39 `Query context (sgsd-recall): ~100 tokens`] |
| 3 | ByteRover query injection | Step 5 (lines 212-216) | **~200 per query**, cap at **~1000** per dispatch (config `byterover.max_context_tokens: 1000` + `max_queries_per_dispatch: 3`) | [VERIFIED: SKILL.md line 213 `~200 tokens each`; config.json lines 61-62] |
| 4 | INTENT.md injection | Step 5.5 (lines 217-247) | **~30** per dispatch (`outcome_delivered` ≤120 chars) | [VERIFIED: SKILL.md line 246 `~30 tokens`] |
| 5 | Per-dispatch ATC | Step 9.5 (lines 686-734) | **~300** per FULL-tier dispatch (250 review + 50 JSONL append). SKIP/LITE pay zero. | [VERIFIED: SKILL.md line 731 `Token budget per dispatch: ~300 tokens`] |
| 6 | Phase-level ATC | Step 6.5 (lines 361-425) | **~600** PER PHASE (not per dispatch): 50 classify + 550 review | [VERIFIED: SKILL.md line 424 `Token budget per phase ATC: ~600 tokens (50 classify + 550 review)`] |
| 7 | MUDA waste audit | Step 6.55 (lines 427-466) | **~100** PER PHASE (not per dispatch) | [VERIFIED: SKILL.md line 466 `Token budget per MUDA audit: ~100 tokens`] |
| 8 | sgsd-curate learnings | Step 10 (lines 735-738) | **~50** per dispatch | [VERIFIED: SKILL.md line 44 `Curate learning (sgsd-curate): ~50 tokens`] |
| 9 | Token-log JSONL | Step 11 (lines 740-743) | **~10** per dispatch (append-only JSONL row, near-zero) | [ASSUMED] SKILL.md does not declare an explicit number for Step 11 (state-update block at line 43 aggregates ~150 tokens covering STATE + commit + log). 10-token estimate is conservative based on brief's "near-zero cost" framing. |

**Key observation for the planner:** gates 1/2/4/5/8/9 are **per-dispatch** and multiply by 16 (T-commits). Gates 6/7 are **per-phase** and multiply by 1. Gate 3 is per-dispatch but bounded by the `max_queries_per_dispatch: 3` × `200` = 600-token ceiling. The phase-bypass-audit arithmetic table in the plan must partition these two classes clearly or it will overstate gates 6/7 by 16×.

**Worked denominator math (D-03 theoretical cost, 16 T-commits):**

| # | Gate | Class | Per-Unit | Multiplier | Total Bypass Cost (tokens) |
|---|------|-------|----------|------------|----------------------------|
| 1 | classifier | per-dispatch | 50 | ×16 | 800 |
| 2 | context-selector | per-dispatch | 100 | ×16 | 1,600 |
| 3 | ByteRover queries | per-dispatch | ~600 (3 queries × 200 cap) | ×16 | ~9,600 |
| 4 | INTENT injection | per-dispatch | 30 | ×16 | 480 |
| 5 | Per-dispatch ATC | per-dispatch (FULL only) | 300 | ×16 (if all FULL) | 4,800 |
| 6 | Phase-level ATC | per-phase | 600 | ×1 | 600 — but note `fired_retroactively: true` (deferred, not skipped — cost WAS paid, just late) |
| 7 | MUDA audit | per-phase | 100 | ×1 | 100 |
| 8 | sgsd-curate | per-dispatch | 50 | ×16 | 800 |
| 9 | token-log | per-dispatch | ~10 | ×16 | ~160 |
| — | **TOTAL bypassed** | — | — | — | **~18,940 tokens** (assuming all 16 dispatches would have hit FULL tier — upper bound) |

The **lower bound** is ~9,340 tokens (if per-dispatch ATC fired at LITE/SKIP on most dispatches — LITE is ~0 token from SKILL.md line 42, SKIP is 0). The planner should document both bounds.

**Gate 6 special case (flagged per D-03b `fired_retroactively`):** the retroactive ATC review WE ARE CLASSIFYING *is* this gate — fired 1 day late. Its token cost is not zero; it was deferred. The verdict_pointer for Phase 10 should read: *"Phase-level ATC cost was paid, just at phase+1 boundary. Keep/kill question is about the SCHEDULING (inline vs deferred), not the existence."*

## Existing YAML Parsing Capacity (Research Question 2)

**Question:** Does any existing code mechanically parse YAML for registry/manifest purposes?

**Answer:** **YES.** `super-gsd/tools/plan-schema/validate.cjs` is a production Node tool that parses YAML frontmatter of plan files using `js-yaml` v4 via `gray-matter`. Key facts:
- [VERIFIED: `validate.cjs:166` + `package-lock.json`] `js-yaml` is pinned in `super-gsd/tools/plan-schema/node_modules/`.
- [VERIFIED: `validate.cjs:172`] Parser is loaded via `require(yamlPath)` — resilient to missing peer installs.
- [VERIFIED: `validate.cjs:185`] Has duplicate-key handling (js-yaml v4 throws; code dedups in raw YAML). Relevant if the verifier needs to defend against malformed input.

**Recommendation for the planner (verifier implementation):** Phase 9's verifier can be a ~30-line Node script co-located at `.planning/phases/09-atc-147-evidence/verify.mjs` OR a bash one-liner using `node -e`. It:
1. `require('js-yaml')` from the existing `super-gsd/tools/plan-schema/node_modules/` path.
2. Read the emitted `147-classification.yaml` (or whatever D-02 file is named).
3. Assert `findings_detail.length === 10`.
4. Assert `headline_finding_count === findings_by_bucket.real_bloat + findings_by_bucket.integration_gap`.
5. Assert `findings_by_bucket.real_bloat + .integration_gap + .nit + .false_positive + .info === 10`.
6. Exit 0 / 1 with a one-line message.

This is purely mechanical — does NOT need another Sonnet dispatch. Saves the verifier-gate token budget.

## Dispatch Counting Semantics (Research Question 3)

**Question:** How does the sgsd-orchestrate loop count "per-dispatch" events?

**Answer:** The loop iterates per-LOOP (SKILL.md line 133 `REPEAT:`). Each loop iteration does ONE `Agent(...)` call at Step 8 (SKILL.md line 636). So **"per-dispatch" = one Agent spawn = one sub-agent invocation**.

**Relationship to T-commits:** In Phase 147 the TDD pattern was one T-task → one failing test → implement → pass → one atomic commit → next task. That yielded 16 T-commits (verified: `## Task N:` header grep on external PLAN.md returns 16; SUMMARY.md T1→T16 table matches SHAs `ca5be16b`…`34aff59f`).

**Critical nuance for the planner:** the orchestrator's *loop iteration* is not 1:1 with T-tasks. Each T-task could in principle span multiple loop iterations (e.g., one for the failing-test write, one for the implementation, one for the pass-verify). In practice the gsd-executor agent is prompted to do the whole T-task in a single dispatch (one Agent call writes test → implementation → verification → commit). The 16-commit log confirms 16 dispatches for 16 T-tasks in the Phase 147 case.

**Conclusion:** "16 T-commits" is a VALID denominator for per-dispatch costs because Phase 147's executor pattern was 1 dispatch = 1 T-task = 1 commit. The planner SHOULD footnote this in the audit table: *"16 dispatches assumed equal to 16 T-commits on the evidence of Phase 147's 1:1 commit-per-task discipline (per SUMMARY.md). If future retrospective is on a phase with multi-dispatch tasks, the multiplier changes."*

Phase-close commits (gate 6 fired retroactively at `c41634c4`) are **NOT** dispatches in the per-dispatch sense — they are phase-level events and correctly attribute to `per-phase × 1`.

## Cross-Repo Reference Patterns (Research Question 4)

**Question:** What patterns exist for cross-repo references?

**Answer:** [VERIFIED: grep for `../project-clarity-erp` in `.planning/`] There ARE prior examples:
- `.planning/phases/11-plan-schema-v2/plans/11-02-validator-cli.md` — references `../project-clarity-erp`
- `.planning/phases/02-memory-layer/02-01-PLAN.md` — references `../project-clarity-erp`
- `.planning/briefs/2026-04-21-orchestrator-contract.md` — references `../project-clarity-erp`
- `.planning/metrics/activity-log.jsonl` — activity log references
- 09-CONTEXT.md itself — references `../project-clarity-erp`

**Pattern:** all use **relative paths with `..` parent traversal** (forward slashes, works on Windows+WSL). None symlink. The canonical-refs block in CONTEXT.md is the cleanest example.

**Recommendation:** The milestone evidence registry doc at `.planning/milestones/v1.2/evidence/147-review.md` should use the same relative-path pattern + SHA pin (D-04a). Frontmatter structure:

```yaml
---
type: milestone-evidence
milestone: v1.2
external_repo_pin:
  repo: project-clarity-erp
  commits: ca5be16b..c41634c4
  reviewed_at: 2026-04-20
  review_path: ../../../../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md
phase_source: 09-atc-147-evidence
---
```

This format pairs with D013's `YYYY-MM-DD-slug.md` shape from the retro decision note (verified against `.planning/decisions/2026-04-21-sgsd-v2-retro.md`).

## Prior Evidence Directory Template (Research Question 5)

**Question:** Does `.planning/milestones/v1.X/evidence/` exist in archived v1.1 as a template?

**Answer:** **NO.** [VERIFIED: `ls .planning/milestones/v1.1/` returns `DISTILL-OUTPUT.json`, `DISTILL-PROMPT.txt`, `DISTILL-REQUEST.md`.] There is no `evidence/` subdirectory in v1.1; v1.1 only has the trajectory-distillation artefacts.

**Consequence:** Phase 9 creates the `evidence/` pattern. No prior template constrains the shape.

**Recommendation:** Use the decision-note format (D013, `YYYY-MM-DD-slug.md` with frontmatter + sections + revert clause) as the shape. The registry pointer doc at `.planning/milestones/v1.2/evidence/147-review.md` should have:
- Frontmatter with `external_repo_pin` (structure above)
- `## Summary` (1 paragraph, classification table headline)
- `## Classification` (inline copy of the YAML `findings_detail` table — for read-without-tools discoverability)
- `## Gate-Bypass Audit` (inline copy of the 9-row cost table)
- `## Revert Clause` (what would force re-opening the audit — e.g., Wave 2 landing in external repo with new SHA range)

## Classification Sub-Agent Design (Research Question 6)

**Question:** Is a fresh narrow Sonnet prompt cheaper than reusing `gsd-code-reviewer`?

**Answer:** **YES — fresh narrow prompt.** [VERIFIED via `super-gsd/agents/` listing] `gsd-code-reviewer` agent exists but its role is running ATC 7-step checks on a *diff* — it *produces* findings. Phase 9's job is *classify* findings that already exist.

Comparison:
- **Reusing `gsd-code-reviewer`:** Loads its full ATC-7-step prompt skeleton (~1500+ tokens) + 10-point anti-slop checklist. Most of this is irrelevant for classification. Risk: the agent re-runs the review on the source code path (cross-repo, slow, confounding).
- **Fresh narrow Sonnet prompt:** ~400-token prompt. Input: the 10 finding narratives (inline copied from external review — the verified 120 lines). Output: YAML with 10 `{id, bucket, justification}` rows. No code access. Bounded.

**Prompt shape recommendation (for the plan):**
```
You are a finding classifier. You receive 10 ATC findings from a retroactive phase-level
review. Assign each to exactly one of these buckets: real-bloat, nit, false-positive,
integration-gap. Return YAML:
  findings_detail:
    - id: W1
      bucket: integration-gap
      title: "..."
      justification: "≤20 words."

Bucket definitions:
- real-bloat: unnecessary code/abstractions that would be deleted by a senior engineer
  (unused imports, duplicated functions, "just in case" code, YAGNI violations).
- integration-gap: code that is correct in isolation but orphaned from the production
  data path (built-but-not-wired, schema-but-not-called).
- nit: style, formatting, or deprecation warnings that don't affect correctness or cost.
- false-positive: finding that is not a real issue on inspection (e.g., Phase-2-gated
  stubs, spec-required schema fields).

FINDINGS:
{inline paste of W1-W4, I1-I6 narratives from 147-ATC-REVIEW.md}
```

## Classification Edge Cases (Research Question 7 — KEY INPUT FOR PLANNER)

**Question:** Does each of W1-W4, I1-I6 map unambiguously to one of the 4 buckets?

**Answer:** **YES, all 10 map cleanly.** The ATC review's own follow-up text (section 5, lines 117-118 of the external review) preemptively resolves the would-have-been-hardest call — it explicitly frames W1/W2 as integration concerns, not bloat.

**Recommended mapping** (the classifier sub-agent should return this; listing here so the planner can verify post-dispatch):

| ID | Title (short) | Bucket | Rationale |
|----|--------------|--------|-----------|
| **W1** | OwnerLookup orphaned from production data path | `integration-gap` | External review §1 follow-up: "orphan wiring vs. unnecessary code" — explicit integration framing. Tests prove it works, nothing proves it's used. |
| **W2** | `resolve_target_seconds` never called; all SLAs default to 0 | `integration-gap` | Same semantic class as W1. Cross-task gap between T5/T8/T9/T10. Spec §10 says "Fixed IS in scope"; wiring is missing, not the logic. |
| **W3** | Two unused imports | `real-bloat` | ATC point 2 (dead imports) — the textbook bloat class. Delete the lines, done. |
| **W4** | Canonical YAML path duplicated across 3 files | `real-bloat` | ATC point 4 (less code). Not hygiene, not integration — straight DRY violation. |
| **I1** | `paused=` parameter never non-default | `false-positive` | Explicitly justified as Phase-2 hook per spec §6.1. Schema-stub, not bloat. The review itself labels it "Acceptable". |
| **I2** | Pydantic model fields with no downstream reader (5 fields) | `false-positive` | Review says "spec §6 schema expects them" — Wave 2 / audit-metadata consumers. If they were true bloat, Wave 2 couldn't exist. |
| **I3** | `model_dump()` + post-dump value overwrite | `nit` | Idiomatic simplification (1-line). Works correctly. Classic nit. |
| **I4** | 5-min boundary doesn't zero seconds | `nit` | 1-line fix, no functional regression (overlaps tolerated by `$gt`). |
| **I5** | `datetime.utcnow()` deprecated | `nit` | Explicit "Non-blocking; will raise DeprecationWarning" — the dictionary definition of a deprecation nit. |
| **I6** | `@flow` wrapper not directly tested | `nit` | Marginal coverage gap on ~8 lines of wiring. Review itself says "marginal". |

**Resulting headline (per D-01b, real-bloat + integration-gap ONLY):** **4 findings.**
- real-bloat: W3, W4 → 2
- integration-gap: W1, W2 → 2
- Sum: **4**
- Nit: I3, I4, I5, I6 → 4
- False-positive: I1, I2 → 2
- Info (meta bucket): 0 (using the 4-bucket decision)

**Threshold bucket per parent-brief's Q2 proposal (≥3 / 1-2 / 0):** **4 is in the ≥3 bracket → per-dispatch ATC + phase-level ATC are LOAD-BEARING under the original Q2 framing.** Phase 10 deliberation consumes this verdict. Flag this explicitly in the registry doc.

**Edge-case sanity check the planner should call out:**
- W3 and W4 are tiny (2 imports + 1 duplicated path). A purist reading might argue they're "nit-scale bloat" not "real-bloat." However the ATC 10-point anti-slop checklist treats **any** dead import / dead code as a point-2 failure regardless of size, and the review's own pass-rate grid logs both as ❌ FAIL not ⚠ WARN. This matches the spirit of D-01: Phase 10's thresholds are counting *actionable* issues, and both W3/W4 require a line delete or path extraction — actionable. Keep them `real-bloat`.
- I2 could conceivably go `integration-gap` (unused fields awaiting Wave 2 consumers, like W1). Difference: W1's `OwnerLookup` is an entire module orphaned; I2 is schema-field-level. The review's own language separates them by severity level (W vs I). Respecting the source review's severity classification, I2 stays `false-positive`.

If the classifier sub-agent returns a different mapping than the table above, the verifier should still accept it (classification is agent-driven per D-01a) — but flag any divergence >2 rows for operator review.

## Architecture Patterns

### Pattern 1: Single-pass classification with narrow prompt

**What:** One `Agent(subagent_type: "gsd-planner" OR a one-off Sonnet, model: "sonnet", mode: "auto", prompt: "{narrow classifier prompt with 10 findings inline}")` → returns YAML with 10 rows.

**When to use:** When the classification task is well-bounded (10 items, 4 fixed buckets, no ambiguity after edge-case research). Not when the agent must judge whether additional evidence is needed.

**Example prompt shape:** see §Research Question 6 above.

### Pattern 2: Mechanical verifier (no sub-agent)

**What:** A ~30-line Node script or bash one-liner that `require('js-yaml')`, reads the emitted YAML, and asserts invariants.

**When to use:** Whenever the verification is arithmetic over structured data. Saves a verifier-dispatch.

**Example:**
```javascript
#!/usr/bin/env node
const yaml = require('../../../super-gsd/tools/plan-schema/node_modules/js-yaml');
const fs = require('fs');
const doc = yaml.load(fs.readFileSync('147-classification.yaml', 'utf8'));
const buckets = doc.findings_by_bucket;
const headline = doc.headline_finding_count;
const detail = doc.findings_detail;
const checks = [
  [detail.length === 10, 'findings_detail length'],
  [headline === buckets.real_bloat + buckets.integration_gap, 'headline matches R+I buckets'],
  [Object.values(buckets).reduce((a,b)=>a+b, 0) === 10, 'bucket sum = 10'],
];
const failed = checks.filter(([ok]) => !ok);
if (failed.length) { failed.forEach(([,msg]) => console.error('FAIL:', msg)); process.exit(1); }
console.log('PASS: all 3 invariants hold'); process.exit(0);
```

### Pattern 3: Registry pointer doc with frontmatter + SHA pin

**What:** Markdown file with YAML frontmatter declaring `external_repo_pin: { repo, commits, reviewed_at }` + body containing inline classification and bypass-audit tables.

**When to use:** Whenever cross-repo evidence needs a stable consumption point. Follows D013 `YYYY-MM-DD-slug.md` shape.

### Anti-Patterns to Avoid

- **Symlinking to external repo:** Windows path fragility + breaks if operator moves `project-clarity-erp`. Ruled out by D-04b.
- **Re-simulating gates:** Cross-repo boundary + agent non-determinism make replays unreliable. Ruled out by D-03.
- **Per-gate would-have-caught-N inference:** Speculative from phase-level source. Belongs in Phase 10 deliberation, not here. Ruled out by D-02b.
- **Reusing `gsd-code-reviewer` for classification:** Wrong role. The reviewer *finds*; we *classify*. Wrong prompt surface area.
- **Writing into external repo:** Recommendations for Phase 147 DEVIATIONS.md are the external project's work — we do NOT automate cross-repo writes. Explicitly deferred.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parser | Custom regex or `split(':')` loop | `js-yaml` from `super-gsd/tools/plan-schema/node_modules/` | Already in repo, production-tested in `validate.cjs`. Handles duplicate keys, multiline, comments. |
| Frontmatter reader | Manual `---\n...\n---` parsing | `gray-matter` (same location as js-yaml) | Already a dep. Even if the registry pointer doc doesn't NEED it, reuse keeps the tooling consistent. |
| Cross-repo reference resolver | Scripted path computation | Relative path `..` + SHA pin | Established pattern across 5 existing `.planning/` files. |
| Classification judge | A second reviewer dispatch to agree/disagree | Single Sonnet pass + planner's visual inspection of the output YAML | Dual-reviewer adds ~1000 tokens for a 4-bucket 10-row call that the edge-case research already resolved. |

**Key insight:** Phase 9 is almost entirely composition over existing artefacts — the external review is done, the taxonomy is locked, the budgets are declared in SKILL.md. The phase should feel MECHANICAL: fetch, classify, tabulate, commit. Where it feels judgement-heavy, reach back to locked decisions in CONTEXT.md.

## Common Pitfalls

### Pitfall 1: Confusing "per-dispatch" with "per-phase" in the cost table

**What goes wrong:** Planner multiplies phase-level ATC (Step 6.5, 600 tokens) by 16 dispatches → inflates bypass cost by 16×, reporting ~9,600 tokens for a gate that only fires once per phase.

**Why it happens:** SKILL.md declares two gate classes with the same narrative style, and `16 T-commits` looks like a universal multiplier at first glance.

**How to avoid:** Explicitly partition the 9 gates into "per-dispatch" vs "per-phase" in the audit table. See the §Per-Gate Token Budget worked math above.

**Warning signs:** A total-bypass-cost number above ~20k tokens. Real upper bound (all gates, 16 dispatches, FULL tier) is ~19k. Anything bigger means something got multiplied twice.

### Pitfall 2: Forgetting that gate 6 (phase-level ATC) fired retroactively

**What goes wrong:** The audit table reports gate 6's token cost as "bypassed" when in reality it was paid late (the ATC review we're classifying IS that gate output).

**Why it happens:** The narrative in the parent brief says "9 gates skipped." It's linguistically easier to treat all 9 uniformly.

**How to avoid:** Gate 6 row MUST carry `fired_retroactively: true` (per D-03b). Its verdict_pointer should say "cost was deferred, not skipped. Phase 10 decides inline-vs-deferred, not keep-vs-kill."

**Warning signs:** Planner writes "9 gates fully bypassed, N tokens saved" without noting the retroactive nuance. Re-read D-03b.

### Pitfall 3: Tokenizing ByteRover queries wrong

**What goes wrong:** Gate 3 (ByteRover) is bounded by config (`max_queries_per_dispatch: 3`, `max_context_tokens: 1000`). Multiplying 3 × 200 = 600 is correct per dispatch, but planner might write 200 × 16 = 3,200 and miss the query-count factor.

**How to avoid:** Audit row should say `per_dispatch_tokens: "up to 600 (3 queries × 200 each, capped at 1000 per config)"`. NOT just `200`.

**Warning signs:** Gate 3 total comes out to ~3,200 instead of ~9,600.

### Pitfall 4: Phase 9's own execution vs. the 16 Phase-147 dispatches

**What goes wrong:** Planner conflates cost-estimates for running Phase 9 itself with the bypass-cost of Phase-147's 16 dispatches.

**How to avoid:** Phase 9 is a docs phase. The audit is ABOUT Phase 147's 16 dispatches. Phase 9's own sub-agent dispatches (classification, registry authoring) are separate and cheap (~2,000 tokens total expected for the whole phase).

**Warning signs:** The audit table includes Phase 9's own sub-agent counts.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Verifier script + validate.cjs pattern | [VERIFIED in prior phases] ✓ | (unspecified; validate.cjs runs on node 18+) | — |
| js-yaml | YAML parse in verifier | [VERIFIED: `super-gsd/tools/plan-schema/node_modules/js-yaml`] ✓ | 4.x | bash `python3 -c "import yaml; ..."` if python3 available |
| gray-matter | Frontmatter parse (optional for pointer doc) | [VERIFIED: same node_modules] ✓ | bundled | Manual frontmatter extraction |
| External repo `project-clarity-erp` at `../project-clarity-erp/` | D-04 SHA pin + inline copy | [VERIFIED: `ls` returns 147-ATC-REVIEW.md at stated path] ✓ | commits `ca5be16b..c41634c4` present | None — hard dep |
| `.planning/milestones/v1.2/` directory | D-04 output target | ✗ (must be created by Phase 9 plan) | — | Plan must include `mkdir -p .planning/milestones/v1.2/evidence` as a task |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None critical — the v1.2 milestone dir creation is an expected deliverable, not a blocker.

## Validation Architecture

Config: `.planning/config.json` → `workflow.nyquist_validation: true` → this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js + shell (no pytest/jest — this is a docs phase) |
| Config file | none (inline script) |
| Quick run command | `node .planning/phases/09-atc-147-evidence/verify.mjs` (or `bash .planning/phases/09-atc-147-evidence/verify.sh`) |
| Full suite command | same as quick — one-script phase |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ATC-147-01 | All 10 findings present + classified + buckets sum to 10 | integration (YAML reparse) | `node .planning/phases/09-atc-147-evidence/verify.mjs` | ❌ Wave 0 — create verify.mjs |
| ATC-147-01 | Headline int matches `real_bloat + integration_gap` | integration (assertion) | same script | ❌ Wave 0 |
| ATC-147-02 | External review path exists + SHA pin matches frontmatter | smoke | `test -f ../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md && grep "ca5be16b..c41634c4" .planning/milestones/v1.2/evidence/147-review.md` | ❌ Wave 0 — bash one-liner in verify.sh |
| ATC-147-02 | Registry pointer doc exists at declared path | smoke | `test -f .planning/milestones/v1.2/evidence/147-review.md` | ❌ Wave 0 |
| ATC-147-03 | Gate-bypass audit has 9 rows + each has all 7 fields (D-03b row shape) | integration (YAML reparse) | same verify.mjs extended | ❌ Wave 0 |
| ATC-147-03 | Audit math: per-dispatch × 16 vs per-phase × 1 correctly partitioned | integration (arithmetic) | verify.mjs asserts `gates_per_phase = [6,7]` and total_bypass_cost recomputes | ❌ Wave 0 |
| D-04c side-deliverable | `.planning/milestones/v1.2/INTENT.md` exists with `outcome_delivered` frontmatter | smoke | `test -f .planning/milestones/v1.2/INTENT.md && grep -q "^outcome_delivered:" .planning/milestones/v1.2/INTENT.md` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `bash .planning/phases/09-atc-147-evidence/verify.sh` (fast — pure filesystem + YAML ops, <2 seconds expected).
- **Per wave merge:** same.
- **Phase gate:** Same verifier green before `/gsd-verify-work`. Per D-03b the `fired_retroactively: true` assertion on gate 6 is a hard check (otherwise the cost-accounting is wrong).

### Wave 0 Gaps

- [ ] `.planning/phases/09-atc-147-evidence/verify.mjs` — Node script asserting the 6 invariants above. ~60 lines.
- [ ] `.planning/phases/09-atc-147-evidence/verify.sh` — Bash wrapper that also checks external review path + INTENT.md existence.
- [ ] `.planning/milestones/v1.2/` directory creation (trivial `mkdir -p`).
- [ ] `.planning/milestones/v1.2/INTENT.md` — authored with `outcome_delivered:` describing v1.2 Evidence-First Sharpening outcome.
- [ ] `.planning/milestones/v1.2/evidence/147-review.md` — registry pointer doc per D-04.
- [ ] Output YAML file (name TBD by planner — recommended `09-classification.yaml` or `147-classification.yaml`) in the phase dir.

**Framework install:** none needed. Uses existing `js-yaml` at `super-gsd/tools/plan-schema/node_modules/`.

## Security Domain

Config: `.planning/config.json` → `security_enforcement: true` + `security_asvs_level: 1`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface; docs-only phase |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No runtime access controls |
| V5 Input Validation | yes (trivial) | YAML parse via `js-yaml` (production-tested, no custom regex) — covers malformed input |
| V6 Cryptography | no | No crypto operations |
| V7 Error Handling | yes (trivial) | Verifier exits 0/1 with clear messages; no stack leaks |
| V12 API & Files | yes | Relative paths only; no arbitrary path traversal (paths are hard-coded) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed YAML causing parser crash | DoS | `js-yaml.load` with try/catch in verify.mjs; exit with error message rather than throw |
| Cross-repo path injection (e.g., external repo moved, relative path resolves unexpectedly) | Tampering | SHA pin in frontmatter is the evidence anchor; verifier asserts the pin matches the external review's own frontmatter (`grep "commits_reviewed: ca5be16b..c41634c4" ../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md`). If the pin drifts, verify fails fast. |
| Stale external review (Wave 2 lands, SHA range changes) | Information-disclosure-like | Revert clause in registry pointer doc tells Phase 10+ when to re-open the audit. |

Phase 9 has negligible true security surface — it's write-once evidence in the project's own `.planning/` tree, consumed by downstream plans in the same repo. ASVS Level 1 is easily met by the mechanical verifier + SHA pin pattern above.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Token-log Step 11 costs ~10 tokens per dispatch (SKILL.md doesn't explicitly quantify) | §Per-Gate Token Budget row 9 | Low — even at 50 tokens/dispatch the gate-9 total changes from 160 → 800, which is <5% of the total bypass cost. Flag for operator to confirm against actual JSONL size if precision matters. |
| A2 | Phase 147's 1 dispatch = 1 T-task = 1 commit pattern holds uniformly | §Dispatch Counting Semantics | Low — verified against SUMMARY.md's T1→T16 table and the external SHA range. If the pattern broke on a sub-task, the denominator would shift by ±1–2 dispatches. Worth a footnote in the audit. |
| A3 | External review's own follow-up text (§5) is authoritative for W1/W2-as-integration-gap framing | §Classification Edge Cases | Very low — the review reviewer explicitly classifies these as cross-task integration concerns. If Phase 10 disagrees, they can re-classify, but that's their call, not Phase 9's. |

If the planner or verifier encounters values that deviate from A1-A3, flag them in DEVIATIONS rather than silently accepting — these are the hot-spots of the audit.

## Open Questions (RESOLVED)

*All three resolved by planner decisions landed in `plans/09-01/02/03-*.md` and verified by gsd-plan-checker (2026-04-22). Kept here as provenance.*

1. **Phase 9's own ATC tier.** → **RESOLVED: `expected_ATC_tier: LITE`** declared in all three plan frontmatters per the schema v2 contract. Schema v2's classifier-skip (SCHEMA-04) handles the dispatch accordingly.
   - What we knew: this is a docs phase (.md + .yaml), 2-3 small plans.
   - What was unclear: whether the orchestrator's own `sgsd-classifier` returns `lite` or `skip` on a pure-docs phase without a LINES estimate.

2. **Output YAML filename.** → **RESOLVED: `09-classification.yaml`** (plan 09-01) and `09-gate-bypass.yaml` (plan 09-02), both phase-prefixed to match `09-CONTEXT.md` / `09-RESEARCH.md` convention.

3. **Registry pointer inline vs reference.** → **RESOLVED: INLINE markdown tables** in `.planning/milestones/v1.2/evidence/147-review.md` (plan 09-03 task 2). Canonical YAML stays at phase dir. Phase 10 can parse either; the markdown is for operator readability.

## Sources

### Primary (HIGH confidence)

- `.planning/phases/09-atc-147-evidence/09-CONTEXT.md` — locked decisions D-01..D-04, canonical refs, folded discretion items. [Read in full.]
- `.planning/REQUIREMENTS.md` §ATC-EVIDENCE — ATC-147-01, -02, -03 success criteria.
- `.planning/STATE.md` frontmatter — confirms Phase 11 closed, Phase 9 unblocked.
- `.planning/config.json` — model routing, ATC config, nyquist_validation + security_enforcement both true.
- `../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md` — full 10-finding review with frontmatter SHA range `ca5be16b..c41634c4`. [Read in full.]
- `../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/SUMMARY.md` — T1→T16 commit table confirming 16 dispatches. [Partial read, lines 1-50.]
- `../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/PLAN.md` — 16 `## Task N:` headers verified via `grep -c`. [Header-count grep + top 80 lines.]
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — per-step token budgets extracted (lines 36-44, 246, 424, 466, 594, 615-632, 731, 845, 857). [Read in full.]
- `.planning/briefs/2026-04-21-orchestrator-contract.md` — Q2 keep/kill proposal with ≥3/1-2/0 threshold language. [Read in full.]
- `.planning/decisions/2026-04-21-sgsd-v2-retro.md` — D013 lightweight decision-note format precedent. [Read in full.]
- `super-gsd/tools/plan-schema/validate.cjs` — verified js-yaml + gray-matter pattern available in repo (lines 166-185). [Partial read + grep.]
- `super-gsd/agents/sgsd-classifier.md` — confirms Haiku classifier tiers (skip/lite/full/gate) and role boundaries. [Lines 1-60.]

### Secondary (MEDIUM confidence)

- Cross-repo reference pattern — 5 existing `.planning/` files using `../project-clarity-erp` relative paths; no symlinks found.
- v1.1 milestone directory contents — verified via `ls`; only DISTILL-* artefacts, no prior `evidence/` template.

### Tertiary (LOW confidence)

- None. All findings in this research have at least one verified source.

## Metadata

**Confidence breakdown:**

- Standard Stack: **HIGH** — all tools already in repo, versions pinned, pattern precedent in `validate.cjs`.
- Architecture: **HIGH** — single-tier docs phase, no runtime surface, patterns are inherited from D013 decision-note shape and CONTEXT.md-locked decisions.
- Per-Gate Token Budget: **HIGH** — 8 of 9 gates directly verified against SKILL.md line numbers; 1 (token-log Step 11) is ASSUMED conservative (A1).
- Classification Mapping: **HIGH** — external review's own follow-up resolves the ambiguous case (W1/W2 framing); all 10 rows have unambiguous bucket assignments.
- Pitfalls: **HIGH** — derived from CONTEXT.md decision footnotes + the two-class (per-dispatch vs per-phase) structure in SKILL.md.
- Validation Architecture: **HIGH** — verifier is mechanical (YAML reparse + arithmetic); no new dependencies, uses existing js-yaml install.

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days — stable domain; the external review is frozen by SHA range; SKILL.md budgets are stable within v1.2).
