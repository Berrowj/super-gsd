# Phase 17: Debt Sweep — Research

**Researched:** 2026-04-24
**Domain:** Internal code cleanup validation — no external research required
**Confidence:** HIGH (all claims verified against live code and git history this session)

---

## Validation Results

**CLEAN-01 — providers-registry.cjs JSDoc + dead branch**
PASS. Lines 17-19 still reference `reviewer_agent` in JSDoc (`falls back to config.default_provider, returns provider record or null if the gate is not reviewer-shaped (no reviewer_agent field)`). Lines 137-138 also say `reviewer_agent` in the `resolveReviewerProvider` JSDoc step 2. Lines 157-158 contain the dead-code `||` fallback (`const name = gate.reviewer_provider || loadReviewProvidersConfig(...).default_provider`) — unreachable because line 155 already guards `if (!gate || !gate.reviewer_provider) return null`. Dead branch confirmed.

**CLEAN-02 — sgsd-muda-audit.sh WASTE.md display sync**
PASS. `compose_waste_md` at line 177 generates a Probe Results table with only 3 rows (`haiku_fails`, `narrative_age_sec`, `git_spawn_pct`). The summary sentence at lines 193-199 counts `fail_count` + `warn_count` from those 3 probes. Line 386 emits a 4th WASTE.md row (qualitative overproduction) but the summary sentence and `warn_count`/`fail_count` accumulation at lines 170-173 do NOT include the 4th or 5th probes — confirming the display inconsistency is live and unfixed.

**CLEAN-03 — 15-01 and 15-03 SUMMARYs absent**
PASS. Glob confirms only `15-02-SUMMARY.md`, `15-04-SUMMARY.md`, `15-05-SUMMARY.md` exist. `15-01-SUMMARY.md` and `15-03-SUMMARY.md` are absent.

**CLEAN-04 — P5 artifact (commit c8b2d25)**
PASS. `git show --stat c8b2d25` confirms: 4 files changed, 648 insertions — codex-exec.sh (+79), sgsd-codex-status.ps1 (new, +308), merge-settings.js (+13), sgsd-codex-monitor.ps1 (new, +261). No `.planning/` artifact directory for P5 exists.

**CLEAN-05 — v1.2-REQUIREMENTS.md archive**
PASS. `Test-Path .planning/milestones/v1.2-REQUIREMENTS.md` returns True. Archive is in place from commit bda43ce.

**CLEAN-06 — v1.2 tag target commit**
PASS. `git log --oneline e74a763~1 -1` returns `0191168 chore(roadmap): add Phase 16 VTP Enrichment to v1.3 staging` — exact commit CONTEXT.md names. `git tag -l v1.2` returns empty — tag not yet created.

**CLEAN-07 — config.json codex_timeout_seconds + codex-exec.sh --step + SKILL.md shellDispatch sites**
PASS. `config.json review_providers.codex_timeout_seconds: 180` confirmed (no `codex_timeout_tiers` block yet — additive write needed). `codex-exec.sh` has `--step` flag at line 73, `STEP_TAG` variable, and passes it into JSONL. SKILL.md has exactly 3 `shellDispatch(` call sites consuming codex-exec.sh (lines 492/495, 907/910, 1030).

---

## Gaps Found

None. All 7 CLEAN items match CONTEXT.md claims exactly. No drift detected since 2026-04-24 gather.

One clarification for planner: CLEAN-02 has a 4th qualitative probe row emitted (line 386) but the `warn_count`/`fail_count` loop at lines 170-173 only iterates over `$HAIKU_V $NARR_V $GIT_V` — the fix must also add `$QUAL_V` (or equivalent) and `$INVT_V` to the accumulation loop and summary sentence. The table has 3 hardcoded rows; the 4th is emitted separately. The fix is non-trivial (not just a string change) — planner should budget a read of lines 155-215 before writing the 17-01 task.

---

## Planner Guidance

- **17-01 sequencing:** Read sgsd-muda-audit.sh lines 155-215 before writing CLEAN-02 task. The summary accumulation loop (`for v in "$HAIKU_V" "$NARR_V" "$GIT_V"`) and the hardcoded 3-row table must both be extended — two distinct edit sites, not one.
- **17-01 commit messages:** Reference WR-01 and WR-02 directly (from 15-ATC-REVIEW.md) in the providers-registry.cjs commit so the finding trace is explicit.
- **17-02 P5 artifact location:** D-04 specifies `.planning/milestones/v1.3/phases/p5-codex-monitor/` — confirm this directory does not exist before creating (it doesn't; verified by file absence).
- **17-02 SUMMARY template:** 15-02-SUMMARY.md frontmatter has: `phase/plan/subsystem/tags/depends_on/provides/affects/tech_stack/key_files/decisions/metrics`. 15-01 and 15-03 SUMMARYs must match this exact key set. Extract commit SHAs from git log for those 2 plans before writing tasks.
- **17-03 SKILL.md edit serializes last:** 17-03 touches SKILL.md (3 shellDispatch sites add `--timeout-tier` arg). No other wave touches SKILL.md, so no conflict risk — but plan the codex-exec.sh tier-resolver edit as T1 and SKILL.md call-site updates as T2 within 17-03 to keep atomic-commit discipline.
- **17-03 config.json write:** `codex_timeout_tiers` is additive inside `review_providers` — existing `codex_timeout_seconds: 180` stays. Write the block atomically (read → mutate → write via Node script, per feedback_never_head_settings rule).
- **17-03 git tag:** Use `git tag -a v1.2 0191168 -m "..."` — annotated, not lightweight. v1.1 tag is reference for annotation style.
- **CLEAN-04 P5-SUMMARY.md frontmatter:** Must include `retroactive: true`, `planted_during: Phase-15-close-session`, `commit: c8b2d25` per D-04. Treat as mandatory fields, not optional.

---

## Per-Item Commit Hints

| CLEAN | Plan | Suggested commit format |
|-------|------|------------------------|
| CLEAN-01 | 17-01/T1 | `fix(17-01/T1): CLEAN-01 refresh providers-registry JSDoc + delete dead fallback branch (WR-01/WR-02)` |
| CLEAN-02 | 17-01/T2 | `fix(17-01/T2): CLEAN-02 extend WASTE.md summary accumulation to 5 probes (extra_processing + inventory)` |
| CLEAN-03 | 17-02/T1 | `docs(17-02/T1): CLEAN-03 backfill 15-01-SUMMARY.md and 15-03-SUMMARY.md` |
| CLEAN-04 | 17-02/T2 | `docs(17-02/T2): CLEAN-04 retroactive P5 codex-monitor SPEC + PLAN + SUMMARY under v1.3/phases/p5-codex-monitor` |
| CLEAN-05 | 17-02/T3 | `docs(17-02/T3): CLEAN-05 verify REQUIREMENTS.md archive alignment — no dangling refs` |
| CLEAN-06 | 17-03/T1 | `docs(17-03/T1): CLEAN-06 v1.2 retroactive close — MILESTONES.md Shipped entry + ROADMAP.md collapse + git tag v1.2 at 0191168` |
| CLEAN-07 | 17-03/T2 | `feat(17-03/T2): CLEAN-07 codex_timeout_tiers block in config.json + tier resolver in codex-exec.sh + SKILL.md call-site --timeout-tier args` |
