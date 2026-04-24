# Phase 17: Debt Sweep — Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Milestone:** v1.4 — Clean Close + Codex Visibility

<domain>
## Phase Boundary

Close v1.3's tail by sweeping the 7 carry-over tech debt items + formally retroactive-closing v1.2 + formalizing codex_timeout workload tiers. No net-new feature scope. Every change is either (a) a concrete bug fix with a filed finding, (b) a missing documentation artifact that predates the fix, or (c) a planned-but-unshipped cleanup step that should have closed v1.3 but didn't.

**7 items in scope (per REQUIREMENTS.md CLEAN-01..07):**
- CLEAN-01: providers-registry.cjs JSDoc refresh + dead-code branch delete
- CLEAN-02: sgsd-muda-audit.sh WASTE.md display sync (table reflects raw JSON)
- CLEAN-03: Backfill 15-01-SUMMARY.md + 15-03-SUMMARY.md
- CLEAN-04: P5 Codex Monitor retroactive .planning artifact (commit c8b2d25)
- CLEAN-05: REQUIREMENTS.md hygiene (v1.2 archive already done 2026-04-24 at v1.4 start; verify + finalize)
- CLEAN-06: v1.2 retroactive milestone close (archive files + MILESTONES.md entry + `git tag v1.2`)
- CLEAN-07: codex_timeout_seconds workload tiers (default/review/analysis)

**Non-goals (explicitly not in Phase 17 scope):**
- New feature capabilities
- Refactoring sgsd-code-reviewer agent (scope-disciplined out of v1.3, stays out)
- Codex routing extensions (Gemini, per-project overrides, classifier tier) — deferred
- Wiring Codex into mission-control (that's Phase 19 / MC category)
- Runtime contract validator or dogfood proof (that's Phase 18 / CXOPS)

</domain>

<decisions>
## Implementation Decisions

### D-01: Wave grouping by category (3 plans)
Per Gray Area 1 Option A. Plans split by work type for clean review scope:

- **17-01 Code debt** — CLEAN-01 (providers-registry) + CLEAN-02 (WASTE.md display). Pure bug fixes in two adjacent .cjs/.sh files. No SKILL.md touches.
- **17-02 Process debt** — CLEAN-03 (backfill 2 SUMMARYs) + CLEAN-04 (P5 retroactive artifact) + CLEAN-05 (REQUIREMENTS.md hygiene finalization). Pure .md backfill work — no executable code changes. Per-dispatch ATC will skip (docs-only dispatch per SKILL.md Step 9.5 filter).
- **17-03 Milestone ceremony** — CLEAN-06 (v1.2 retro close + tag) + CLEAN-07 (codex_timeout tiers). Ships config.json + new archive files + git tag. Touches SKILL.md (codex_timeout tier resolution logic) so it serializes after 17-01.

**Wave execution order:** 17-01 → 17-02 → 17-03. Serialize 17-03 after 17-01 because both may touch codex-exec.sh. 17-02 is independent but keep in the middle slot for commit ordering clarity.

### D-02: CLEAN-06 v1.2 tag target is commit `0191168`
Per Gray Area 2 Option A. The last commit before any v1.3 work began was `0191168 chore(roadmap): add Phase 16 VTP Enrichment to v1.3 staging`. The commit immediately after (`e74a763 feat(16): seed Phase 16 VTP Enrichment CONTEXT.md`) is v1.3's first content commit. Tagging `0191168` gives v1.2 a clean boundary without inventing empty commits.

**Verification:** `git log --oneline e74a763~1 -1` → `0191168`. Use `git tag -a v1.2 0191168 -m "..."`.

### D-03: CLEAN-07 tier selection uses step-name fallback + explicit --timeout-tier override
Per Gray Area 3 Option C. Both mechanisms, explicit wins:

- **Step-name fallback (default behaviour)**: codex-exec.sh reads the existing `--step` arg and maps:
  - `smoke` / `self-test` → `default` (60s)
  - `per-dispatch-ATC` / `phase-level-ATC` / `adversarial` → `review` (120s)
  - `muda-qualitative` / `qualitative-*` → `analysis` (180s)
  - anything unmatched → `default` (60s) with stderr warning `step '<name>' has no tier mapping, using default`
- **Explicit override**: new `--timeout-tier {default|review|analysis|custom:N}` flag. When present, overrides step-name mapping. `custom:N` takes a numeric seconds value for one-off adjustments.

**Config shape** (additive, existing `codex_timeout_seconds: 180` stays as a backward-compat fallback):
```json
"review_providers": {
  "codex_enabled": true,
  "codex_timeout_seconds": 180,
  "codex_timeout_tiers": {
    "default": 60,
    "review": 120,
    "analysis": 180
  },
  ...
}
```

codex-exec.sh precedence when resolving timeout:
1. `--timeout-tier custom:N` → N seconds
2. `--timeout-tier {default|review|analysis}` → `codex_timeout_tiers[tier]`
3. step-name mapping → tier → `codex_timeout_tiers[tier]`
4. fallback → `codex_timeout_seconds` (current behaviour)

### D-04: P5 artifact location (CLEAN-04)
Place retroactive SPEC + PLAN under `.planning/milestones/v1.3/phases/p5-codex-monitor/` alongside other v1.3 phase artifacts. Frontmatter declares `retroactive: true`, `planted_during: Phase-15-close-session`, and references commit `c8b2d25` as the shipped artifact. Do NOT renumber Phase 16 or create fake sequential numbering — P5 is a side-feature, not a roadmap phase.

**Files to create:**
- `.planning/milestones/v1.3/phases/p5-codex-monitor/P5-SPEC.md` — scope + rationale + files list
- `.planning/milestones/v1.3/phases/p5-codex-monitor/P5-PLAN.md` — the 4-file task breakdown as-if-planned (codex-exec.sh write_live_state, merge-settings normalizeCommand, sgsd-codex-status.ps1, sgsd-codex-monitor.ps1)
- `.planning/milestones/v1.3/phases/p5-codex-monitor/P5-SUMMARY.md` — close record pointing at c8b2d25

### D-05: CLEAN-03 SUMMARY backfill follows 15-02/15-04/15-05 template
The 3 existing plan SUMMARYs in `.planning/milestones/v1.3/phases/15-codex-routed-gates/` establish the frontmatter shape (phase/plan/wave/status/date/commits/requirements_satisfied/tags). 15-01 (4 commits, switch-flip) and 15-03 (2 commits, token-log schema) must mirror the same structure. Extract commit SHAs + one-liners from git log.

### D-06: Per-dispatch ATC policy for Phase 17
Per tier classification pending Phase 17 classifier dispatch, but anticipate: 17-01 is likely FULL tier (code change in 2 files), 17-02 is LITE or skipped (docs-only), 17-03 is FULL tier (config.json + SKILL.md + new files). Per-dispatch ATC on code-touching plans will route to Codex now that codex_enabled is live — **this is the first real orchestrator-path dogfood of the CXOPS-03 requirement, ahead of Phase 18**. Capture the result; it retroactively satisfies CXOPS-03's evidence requirement if it lands clean.

### Claude's Discretion
- Exact wording of v1.2 tag annotation message (cite phases 9-13, reference MILESTONES.md for accomplishments)
- Exact JSDoc rewrite prose in CLEAN-01 providers-registry.cjs
- Exact UI of P5-SPEC.md (follow super-gsd phase-artifact conventions used elsewhere)
- Whether to also delete `.planning/milestones/v1.3-v1.3-MILESTONE-AUDIT.md` (typo double-prefix suggestion from workflow — we already used the correct `v1.3-MILESTONE-AUDIT.md`, so no action needed)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` — v1.4 requirements (CLEAN-01..07 + CXOPS-01..04 + MC-01..05); Phase 17 owns CLEAN-01..07
- `.planning/ROADMAP.md` §"### 🚧 v1.4 Clean Close + Codex Visibility" — phase structure + dependencies
- `.planning/milestones/v1.3-MILESTONE-AUDIT.md` §"tech_debt" — authoritative list of 7 carry-over items with file:line evidence

### v1.3 context (source of the debt)
- `.planning/milestones/v1.3-ROADMAP.md` §"Milestone Summary — Technical Debt Incurred" — item-by-item rationale
- `.planning/milestones/v1.3/phases/15-codex-routed-gates/15-ATC-REVIEW.md` §WR-01/WR-02 — concrete findings the debt items resolve
- `.planning/milestones/v1.3/phases/15-codex-routed-gates/15-01-per-dispatch-ATC.md` + `15-02-per-dispatch-ATC.md` — same findings from per-dispatch ATCs
- `.planning/milestones/v1.3/phases/15-codex-routed-gates/15-VERIFICATION.md` §"advisory only" deviations — WR-01 + WR-02 explicit "NOT fixed" notes

### Source files in scope
- `super-gsd/scripts/lib/providers-registry.cjs` — CLEAN-01 target (lines 17-19, 137-138 JSDoc + lines 157-158 dead branch)
- `super-gsd/scripts/sgsd-muda-audit.sh` — CLEAN-02 target (WASTE.md summary-row generation logic, probe loop)
- `super-gsd/scripts/codex-exec.sh` — CLEAN-07 target (timeout tier resolution logic)
- `.planning/config.json` — CLEAN-07 target (`review_providers.codex_timeout_tiers` additive block)
- `.planning/milestones/v1.3/phases/15-codex-routed-gates/15-02-SUMMARY.md` + `15-04-SUMMARY.md` + `15-05-SUMMARY.md` — CLEAN-03 templates to match

### Milestone-close surfaces
- `.planning/MILESTONES.md` §"v1.2 Evidence-First Sharpening (Active)" — CLEAN-06 target (convert to Shipped entry)
- `.planning/ROADMAP.md` — CLEAN-06 target (collapse Phases 9-13 into `<details>`)
- Commit `0191168` — CLEAN-06 tag target (`git tag -a v1.2 0191168 -m "..."`)
- `.planning/milestones/v1.2-REQUIREMENTS.md` — already archived 2026-04-24 at v1.4 start (commit `bda43ce`); CLEAN-05 verifies this is consistent

### P5 Codex Monitor (CLEAN-04)
- Commit `c8b2d25` — the shipped P5 feature (648 LOC, 4 files)
- `super-gsd/scripts/codex-exec.sh` lines that added `write_live_state()` — actual code reference
- `super-gsd/scripts/lib/sgsd-codex-status.ps1` + `super-gsd/scripts/sgsd-codex-monitor.ps1` — the 2 new files
- `super-gsd/scripts/merge-settings.js` — normalizeCommand() helper addition

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Existing plan SUMMARY template:** 15-02-SUMMARY.md, 15-04-SUMMARY.md, 15-05-SUMMARY.md all follow a consistent frontmatter shape. CLEAN-03 copies this pattern.
- **Existing phase artifact structure:** super-gsd follows `{NN}-SPEC.md` / `{NN}-PLAN.md` / `{NN}-SUMMARY.md` convention — CLEAN-04's P5 artifacts match this shape.
- **codex-exec.sh already reads --step arg:** The step parameter is already plumbed through to the JSONL writer (step field in codex-log.jsonl rows). CLEAN-07 reuses this path — no new arg plumbing required for the step-name mapping.
- **providers-registry.cjs has a consistent module pattern:** shipping fixes to JSDoc and dead code is a 10-line surgical edit, not a refactor.

### Established Patterns
- **Atomic commit per task:** every task ships as one commit with `feat(17-NN/TX): ...` or `fix(17-NN/TX): ...`. Never batch.
- **SKILL.md serialization:** Phase 17-03 touches SKILL.md for codex_timeout tier logic — serialize after other SKILL.md touches in the same wave (none in 17-01 or 17-02).
- **git tag annotation:** v1.1 tag exists as reference (annotated with delivery + accomplishments). v1.2 tag follows same shape.

### Integration Points
- **CLEAN-07 consumers:** sgsd-muda-audit.sh qualitative probe, SKILL.md Steps 6.5/9.5/9.6 — all call codex-exec.sh via shellDispatch. After CLEAN-07, they should pass `--timeout-tier analysis` / `--timeout-tier review` / leave default respectively. Code changes needed in: (a) codex-exec.sh tier resolver, (b) SKILL.md shellDispatch call sites (3 places), (c) sgsd-muda-audit.sh qualitative-probe call site (1 place).
- **CLEAN-06 callers of `sgsd-complete-milestone` step numbers:** verified during v1.3's Phase 15/15-05 execution — 0 stale cross-refs. Re-verify during Phase 17 close via same grep pattern.
- **P5 retroactive artifact has zero runtime callers** — pure documentation backfill. Does not affect any executable path.

</code_context>

<specifics>
## Specific Ideas

- Operator explicitly wants this milestone to **close clean** — zero carry-over into v1.5. Phase-close verifier MUST confirm zero open CLEAN items + all 7 item REQ-IDs marked complete in REQUIREMENTS.md traceability table.
- The v1.3 ATC reviewer explicitly flagged WR-01 + WR-02 as "NOT fixed, carry-over from Phase 14 still open" in the phase-level ATC report. Phase 17-01 should reference those finding IDs directly in commit messages so the trace is obvious.
- Per the v1.3 session's dogfood instincts: if Phase 17-01 or 17-03 triggers per-dispatch ATC, let it route through the new Codex path. Do not disable or bypass. This captures evidence for CXOPS-03 "ahead of schedule."

</specifics>

<deferred>
## Deferred Ideas

- **Phase 18 CXOPS-02 contract validator** — if Phase 17's Codex ATC invocations surface parse failures, note them but don't build the validator in Phase 17. That's Phase 18's scope.
- **MC tiles for Phase 17 activity** — no mission-control visualization work in Phase 17 even if debt items touch mission-control scripts (they don't). That's Phase 19.
- **Third-provider support** (Gemini, local) — not this milestone.
- **Per-project provider override** — not this milestone.
- **Codex on classifier/executor/primary verifier** — explicitly scoped out, stays out.

</deferred>

---

*Phase: 17-debt-sweep*
*Milestone: v1.4 Clean Close + Codex Visibility*
*Context gathered: 2026-04-24*
