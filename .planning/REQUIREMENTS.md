# Milestone v1.4 Requirements — Clean Close + Codex Visibility

**Source:** Post-v1.3 carry-over tech debt + operator directive 2026-04-24: "cleanup and sweep all debt, close clean, Codex fully operational with tasks given to it, mission control shows everything it's doing."

**Strategic frame:** v1.3 shipped the multimodal-review substrate + switch-flip + first live Codex invocation. v1.4 closes the loop — sweeps accumulated tech debt, hardens the Codex path to full operational reliability on real task loads, and wires Codex activity into the mission-control visibility surfaces so operator has line-of-sight on every invocation.

No net-new feature scope. This is a sharpening milestone.

---

## v1 Requirements (v1.4 scope — 14 requirements across 3 categories)

### CLEAN (Phase 17 — Debt Sweep)

- [ ] **CLEAN-01**: `super-gsd/scripts/lib/providers-registry.cjs` JSDoc refresh — replace stale `reviewer_agent` shape-discriminator references at lines 17-19 and 137-138 with `reviewer_provider`; delete dead default fallback branch at lines 157-158 (unreachable after W-1 predicate narrowing).
- [ ] **CLEAN-02**: `super-gsd/scripts/sgsd-muda-audit.sh` WASTE.md summary-row generation in sync with raw JSON. Table must display all 5 probes (mechanical 3 + extra_processing + inventory) and the summary sentence must reflect actual verdict distribution (no silent FAIL suppression).
- [ ] **CLEAN-03**: Backfill `.planning/milestones/v1.3/phases/15-codex-routed-gates/15-01-SUMMARY.md` and `15-03-SUMMARY.md` following the pattern established by 15-02, 15-04, 15-05 SUMMARY files.
- [ ] **CLEAN-04**: Retroactive `.planning` artifact for P5 Codex Monitor (commit c8b2d25, 648 LOC) — SPEC.md declaring the feature's scope + PLAN.md documenting the 4 files (codex-exec.sh write_live_state, merge-settings normalizeCommand, sgsd-codex-status.ps1, sgsd-codex-monitor.ps1) as if the feature had been planned. Filed under `super-gsd/P5-codex-monitor/` or equivalent plan directory.
- [ ] **CLEAN-05**: REQUIREMENTS.md hygiene — current `.planning/REQUIREMENTS.md` (now v1.4) is fresh. Verify `.planning/milestones/v1.2-REQUIREMENTS.md` archive exists (archived at v1.4 start), `.planning/milestones/v1.3-REQUIREMENTS.md` exists (already shipped), and no traceability-table references dangle across archives.
- [ ] **CLEAN-06**: v1.2 retroactive milestone close — create `.planning/milestones/v1.2-ROADMAP.md` archive (from current ROADMAP.md Phase-9-through-13 content + MILESTONES.md v1.2 entry narrative), append formal v1.2 Shipped entry to MILESTONES.md (currently still shows "Active"), create `git tag v1.2` pointing at the last v1.2 commit (last commit before Phase 14's first commit), update ROADMAP.md to collapse v1.2 phases into `<details>` block.
- [ ] **CLEAN-07**: codex_timeout_seconds workload tiers in `.planning/config.json` — introduce `review_providers.codex_timeout_tiers: { default: 60, review: 120, analysis: 180 }` structure (additive, existing `codex_timeout_seconds: 180` stays as override/base). SKILL.md Steps 6.5/9.5/9.6 + sgsd-muda-audit.sh qualitative probe read the tier based on invocation step.

### CXOPS (Phase 18 — Codex Hardening)

- [ ] **CXOPS-01**: `super-gsd/scripts/codex-exec.sh` `--self-test` flag — invoked without a real review task, it probes (a) `codex` CLI on PATH, (b) auth (OAuth + quota readable), (c) timeout math (computes effective timeout from tier + workload), (d) emits a known-good contract response. Exits 0 on pass, non-zero on any probe failure. Callable from `sgsd-readiness` milestone pre-flight.
- [ ] **CXOPS-02**: Runtime contract validator hook in orchestrator — after `codex-exec.sh` returns exit 0 but before consuming report, parse FINDINGS/CRITICAL/WARNINGS/PASS_RATE/ONE_LINER fields. On parse failure: treat as provider error, trigger the existing `GATE_PROVIDER_FALLBACK` single-retry path targeting `claude-sonnet-reviewer`, log fallback reason as `parse_failure` (distinct from `timeout`, `auth`, `generic`).
- [ ] **CXOPS-03**: Dogfood proof — execute at least one v1.4 phase end-to-end with `codex_enabled: true` + new SKILL.md wiring active. Observe `.planning/phases/{N}/commit-reviews.jsonl` contains at least one Step 9.5 per-dispatch ATC row with `provider: openai-codex` and valid FINDINGS contract. Documented as evidence artifact.
- [ ] **CXOPS-04**: Same phase's Step 6.5 phase-level ATC observably routes to Codex — produces `.planning/phases/{N}/{N}-ATC-REVIEW.md` authored by Codex with `provider: openai-codex` stamp in commit-reviews.jsonl and/or the review markdown frontmatter.

### MC (Phase 19 — Mission Control Visibility)

- [ ] **MC-01**: `super-gsd/scripts/sgsd-mission-control.ps1` — add Codex tile sourcing from `.planning/metrics/codex-live.json` (current state: idle/running/timeout/error/contract-violation) + `.planning/metrics/codex-log.jsonl` (last 5 invocations summary: step, duration, exit, provider-fallback y/n). Tile refreshes on invocation lifecycle events. Consumes `super-gsd/scripts/lib/sgsd-codex-status.ps1` helper (already installed, currently unused outside P5 monitor).
- [ ] **MC-02**: `super-gsd/scripts/sgsd-statusline.ps1` — Codex state indicator segment: shows `⚙ codex:idle`, `⚙ codex:running [N]s`, `⚙ codex:timeout`, `⚙ codex:error`, `⚙ codex:fallback`. Color-coded. Updates on every status poll cycle.
- [ ] **MC-03**: `super-gsd/scripts/sgsd-narrative.ps1` — capture Codex events into `.planning/metrics/narrative.md`: entries for codex_started, codex_completed, codex_timeout, codex_fallback. Populates the existing narrative.md `latest` + `lastfail` fields.
- [ ] **MC-04**: `super-gsd/scripts/sgsd-live-feed.ps1` — extend to tail `.planning/metrics/codex-log.jsonl` in real-time alongside `activity-log.jsonl`. Codex rows rendered distinctly (color or prefix) so operator can eyeball reviewer activity during autonomous runs.
- [ ] **MC-05**: `super-gsd/scripts/sgsd-dashboard.ps1` — Multimodal Review Offload tile sourcing live from `.planning/metrics/codex-log.jsonl` (not SKILL.md spec). Computes `claude_tokens_saved_by_codex`, `codex_invocations_this_milestone`, `fallback_rate`, `avg_codex_duration_ms`. Integrates with existing CODEX-10 token accounting — does NOT duplicate.

---

## Future Requirements (deferred post-v1.4)

- **Third-provider support** (Gemini, local models via the provider-indirection substrate). Registry supports shape; requires a second vendor authorization path + a second code-reviewer-v1-compliant wrapper script.
- **Per-project provider overrides** (allow repo-level override of default_provider without editing global config).
- **Codex-on-classifier** (Haiku tier routing to Codex). Explicitly scoped out of v1.3 and stays out unless evidence says otherwise.
- **CODEX-12 kill-condition first-firing evidence** — after 2-3 real milestones with Codex active, observe whether kill thresholds fire correctly.

## Out of Scope (v1.4)

- New feature capabilities unrelated to Codex/MC/debt sweep.
- Refactoring the existing sgsd-code-reviewer agent (explicit scope discipline from v1.3 carried forward).
- Codex routing for executor/researcher/planner/verifier dispatches (not review-shaped, wrong fit).
- UI/frontend surfaces outside PowerShell-based mission-control scripts.

---

## Traceability (filled by roadmap)

| REQ-ID     | Description                                      | Phase | Status   |
|------------|--------------------------------------------------|-------|----------|
| CLEAN-01   | providers-registry.cjs JSDoc + dead branch       | 17    | —        |
| CLEAN-02   | sgsd-muda-audit.sh WASTE.md display sync         | 17    | —        |
| CLEAN-03   | Backfill 15-01-SUMMARY.md + 15-03-SUMMARY.md     | 17    | —        |
| CLEAN-04   | P5 Codex Monitor retroactive .planning artifact  | 17    | —        |
| CLEAN-05   | REQUIREMENTS.md hygiene + archive alignment      | 17    | —        |
| CLEAN-06   | v1.2 retroactive milestone close + tag           | 17    | —        |
| CLEAN-07   | codex_timeout_seconds workload tiers             | 17    | —        |
| CXOPS-01   | codex-exec.sh --self-test flag                   | 18    | —        |
| CXOPS-02   | Runtime contract validator + parse_failure fallback | 18 | —        |
| CXOPS-03   | Dogfood per-dispatch ATC via Codex               | 18    | —        |
| CXOPS-04   | Dogfood phase-level ATC via Codex                | 18    | —        |
| MC-01      | mission-control Codex tile                       | 19    | —        |
| MC-02      | statusline Codex indicator                       | 19    | —        |
| MC-03      | narrative.md Codex event capture                 | 19    | —        |
| MC-04      | live-feed tails codex-log.jsonl                  | 19    | —        |
| MC-05      | dashboard Multimodal Review Offload tile         | 19    | —        |
