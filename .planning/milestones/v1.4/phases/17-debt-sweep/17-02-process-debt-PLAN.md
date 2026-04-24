---
schema_version: 2
phase: 17
plan: "17-02"
wave: 2
model: "sonnet"
expected_ATC_tier: "LITE"
depends_on: []
goal: "Backfill 15-01 + 15-03 SUMMARYs (CLEAN-03); create P5 retroactive SPEC/PLAN/SUMMARY (CLEAN-04); verify REQUIREMENTS.md archive alignment (CLEAN-05)"
tasks:
  - id: "T1"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - ".planning/milestones/v1.3/phases/15-codex-routed-gates/15-01-SUMMARY.md"
      - ".planning/milestones/v1.3/phases/15-codex-routed-gates/15-03-SUMMARY.md"
    input_contract: "15-02-SUMMARY.md as template (frontmatter keys: phase/plan/subsystem/tags/depends_on/provides/affects/tech_stack/key_files/decisions/metrics); git log output for plans 15-01 and 15-03"
    output_contract: "15-01-SUMMARY.md created (4 commits, per-dispatch-ATC switch-flip feature, status: complete); 15-03-SUMMARY.md created (2 commits, token-log schema feature, status: complete). Commit: docs(17-02/T1): CLEAN-03 backfill 15-01-SUMMARY.md and 15-03-SUMMARY.md"
    hypothesis: "Both missing plan SUMMARYs exist with frontmatter matching 15-02/15-04/15-05 template shape and accurate commit SHAs extracted from git log"
    falsifier: "ls .planning/milestones/v1.3/phases/15-codex-routed-gates/15-01-SUMMARY.md returns not found, OR frontmatter keys differ from 15-02-SUMMARY.md, OR commit SHAs listed do not appear in git log"
    stop_rule: "Both files exist; frontmatter key set matches 15-02-SUMMARY.md exactly; commit SHAs verified via git log --oneline"
    verification_cmd: "ls .planning/milestones/v1.3/phases/15-codex-routed-gates/15-01-SUMMARY.md .planning/milestones/v1.3/phases/15-codex-routed-gates/15-03-SUMMARY.md && echo PASS"
    known_deadends: []

  - id: "T2"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - ".planning/milestones/v1.3/phases/p5-codex-monitor/P5-SPEC.md"
      - ".planning/milestones/v1.3/phases/p5-codex-monitor/P5-PLAN.md"
      - ".planning/milestones/v1.3/phases/p5-codex-monitor/P5-SUMMARY.md"
    input_contract: "D-04 artifact list + commit c8b2d25 (git show --stat c8b2d25); 4 files shipped: codex-exec.sh write_live_state, merge-settings.js normalizeCommand, sgsd-codex-status.ps1 (new), sgsd-codex-monitor.ps1 (new)"
    output_contract: "Directory .planning/milestones/v1.3/phases/p5-codex-monitor/ created with 3 files. P5-SUMMARY.md frontmatter includes retroactive: true, planted_during: Phase-15-close-session, commit: c8b2d25. Commit: docs(17-02/T2): CLEAN-04 retroactive P5 codex-monitor SPEC + PLAN + SUMMARY under v1.3/phases/p5-codex-monitor"
    hypothesis: "P5 retroactive artifact directory exists with 3 files that faithfully document the 648-LOC codex-monitor feature shipped in commit c8b2d25 — including mandatory frontmatter fields"
    falsifier: "P5-SUMMARY.md missing retroactive: true OR planted_during field, OR git show c8b2d25 files do not match the files described in P5-PLAN.md"
    stop_rule: "All 3 files present; P5-SUMMARY.md has retroactive: true, planted_during: Phase-15-close-session, commit: c8b2d25; P5-PLAN.md lists all 4 files from c8b2d25"
    depends_on: []
    verification_cmd: "ls .planning/milestones/v1.3/phases/p5-codex-monitor/P5-SPEC.md .planning/milestones/v1.3/phases/p5-codex-monitor/P5-PLAN.md .planning/milestones/v1.3/phases/p5-codex-monitor/P5-SUMMARY.md && grep -q 'retroactive: true' .planning/milestones/v1.3/phases/p5-codex-monitor/P5-SUMMARY.md && echo PASS"
    known_deadends: []

  - id: "T3"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - ".planning/REQUIREMENTS.md"
    input_contract: ".planning/REQUIREMENTS.md current state; .planning/milestones/v1.2-REQUIREMENTS.md (archived at commit bda43ce); CLEAN-05 scope = verify archive consistency + confirm no dangling CLEAN-05 references in current REQUIREMENTS.md"
    output_contract: "Audit result documented in commit message. If REQUIREMENTS.md has dangling refs to CLEAN-05 or v1.2 items that should be in the archive: remove them. If consistent: zero diff, commit is docs-only note. Commit: docs(17-02/T3): CLEAN-05 verify REQUIREMENTS.md archive alignment — no dangling refs"
    hypothesis: "v1.2-REQUIREMENTS.md archive is consistent with current REQUIREMENTS.md — no orphan references or duplicate entries that would indicate a partial archive"
    falsifier: "grep finds CLEAN-05 references in .planning/REQUIREMENTS.md that duplicate archived content, OR v1.2 requirement IDs appear in current REQUIREMENTS.md without a cross-reference note"
    stop_rule: "Audit complete; any dangling refs removed; commit created (even zero-diff is valid outcome)"
    depends_on: []
    verification_cmd: "test -f .planning/milestones/v1.2-REQUIREMENTS.md && test -f .planning/milestones/v1.3-REQUIREMENTS.md && echo BOTH_ARCHIVES_EXIST && echo PASS"
    known_deadends: []
---

<objective>
Pure documentation backfill — no executable code changes. Three CLEAN items:

**T1 (CLEAN-03):** Create two missing plan SUMMARY files for Phase 15 plans 15-01 (per-dispatch-ATC switch flip, 4 commits) and 15-03 (token-log schema, 2 commits). Mirror the frontmatter key set from 15-02-SUMMARY.md exactly. Extract commit SHAs from `git log`.

**T2 (CLEAN-04):** Retroactively document the P5 Codex Monitor feature (commit c8b2d25, 648 LOC) under `.planning/milestones/v1.3/phases/p5-codex-monitor/` with SPEC + PLAN + SUMMARY. Mandatory frontmatter: `retroactive: true`, `planted_during: Phase-15-close-session`, `commit: c8b2d25`.

**T3 (CLEAN-05):** Verify `.planning/REQUIREMENTS.md` has no orphan references left over from the v1.2 archive operation (commit bda43ce). Zero-diff is an acceptable outcome.

Per D-06: per-dispatch ATC is LITE tier for 17-02 — docs-only dispatch skips per Step 9.5 filter. No Codex invocation for this plan.
</objective>

<context>
@.planning/milestones/v1.4/phases/17-debt-sweep/17-CONTEXT.md
@.planning/milestones/v1.4/phases/17-debt-sweep/17-RESEARCH.md

Read before T1: .planning/milestones/v1.3/phases/15-codex-routed-gates/15-02-SUMMARY.md (frontmatter template)
Read before T2: run `git show --stat c8b2d25` to confirm 4-file manifest
</context>

<tasks>

**T1 — CLEAN-03: Backfill 15-01-SUMMARY.md and 15-03-SUMMARY.md**

Files:
- `.planning/milestones/v1.3/phases/15-codex-routed-gates/15-01-SUMMARY.md`
- `.planning/milestones/v1.3/phases/15-codex-routed-gates/15-03-SUMMARY.md`

Steps:
1. Read `.planning/milestones/v1.3/phases/15-codex-routed-gates/15-02-SUMMARY.md` — extract exact frontmatter keys (phase, plan, subsystem, tags, depends_on, provides, affects, tech_stack, key_files, decisions, metrics).
2. Run `git log --oneline -- super-gsd/` to identify commits belonging to plan 15-01 (4 commits, per-dispatch-ATC switch-flip) and 15-03 (2 commits, token-log schema). Capture SHAs.
3. Create `15-01-SUMMARY.md`: frontmatter matching template; body describes the switch-flip feature (per-dispatch ATC enabled via codex_enabled + gates.yaml rows); status: complete; commits: list 4 SHAs.
4. Create `15-03-SUMMARY.md`: frontmatter matching template; body describes token-log schema addition; status: complete; commits: list 2 SHAs.

Commit: `docs(17-02/T1): CLEAN-03 backfill 15-01-SUMMARY.md and 15-03-SUMMARY.md`

---

**T2 — CLEAN-04: P5 Codex Monitor retroactive artifact**

Files:
- `.planning/milestones/v1.3/phases/p5-codex-monitor/P5-SPEC.md`
- `.planning/milestones/v1.3/phases/p5-codex-monitor/P5-PLAN.md`
- `.planning/milestones/v1.3/phases/p5-codex-monitor/P5-SUMMARY.md`

Steps:
1. `mkdir -p .planning/milestones/v1.3/phases/p5-codex-monitor/`
2. Run `git show --stat c8b2d25` — confirm 4 files: codex-exec.sh (+79), sgsd-codex-status.ps1 (new +308), merge-settings.js (+13), sgsd-codex-monitor.ps1 (new +261).
3. Create `P5-SPEC.md` — scope: live-state monitoring for Codex CLI invocations; rationale: no visibility into long-running codex-exec.sh calls; 4-file implementation; shipped without planning artifact.
4. Create `P5-PLAN.md` — as-if-planned task breakdown: write_live_state() in codex-exec.sh, normalizeCommand() helper in merge-settings.js, sgsd-codex-status.ps1 status reader, sgsd-codex-monitor.ps1 PS monitor.
5. Create `P5-SUMMARY.md` — mandatory frontmatter: `retroactive: true`, `planted_during: Phase-15-close-session`, `commit: c8b2d25`, `status: complete`. Body: 648 LOC, 4 files, commit c8b2d25.

Commit: `docs(17-02/T2): CLEAN-04 retroactive P5 codex-monitor SPEC + PLAN + SUMMARY under v1.3/phases/p5-codex-monitor`

---

**T3 — CLEAN-05: REQUIREMENTS.md archive verification**

Files: `.planning/REQUIREMENTS.md` (may produce zero diff)

Steps:
1. Confirm `.planning/milestones/v1.2-REQUIREMENTS.md` exists (committed at bda43ce).
2. Check `.planning/REQUIREMENTS.md` for any v1.2-era requirement IDs (ATC-EVIDENCE, GATE-POLICY, PLAN-SCHEMA, MACHINERY, GOVERNANCE) that appear without a cross-reference note.
3. If dangling refs found: remove or add cross-reference note pointing to archive file.
4. If consistent: no edit needed.

Commit: `docs(17-02/T3): CLEAN-05 verify REQUIREMENTS.md archive alignment — no dangling refs`
(commit even if zero diff — captures audit evidence in log)

</tasks>

<success_criteria>
- Both 15-01-SUMMARY.md and 15-03-SUMMARY.md exist with frontmatter key set matching 15-02-SUMMARY.md
- p5-codex-monitor/ directory contains P5-SPEC.md + P5-PLAN.md + P5-SUMMARY.md
- P5-SUMMARY.md has retroactive: true, planted_during: Phase-15-close-session, commit: c8b2d25
- .planning/milestones/v1.2-REQUIREMENTS.md exists (archive confirmed)
- 3 atomic docs commits with format docs(17-02/T{N}): ...
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.4/phases/17-debt-sweep/17-02-SUMMARY.md`
</output>
