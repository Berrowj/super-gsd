# Phase 40 ATC Review

## Reviewers
- Provider: claude-sonnet-reviewer
- Provider: codex-cli-reviewer (gpt-5.5, xhigh)
- Tier: phase-level (dual-provider)
- Final verdict: pass (post-fix)

## Aggregate verdicts

| Provider | Pre-fix | CRIT | WARN | Post-fix |
|----------|---------|------|------|----------|
| Claude   | warn    | 0    | 2    | pass (1 false alarm + 1 accepted) |
| Codex    | warn    | 2    | 2    | pass (both CRITs fixed) |

## Findings (deduplicated)

### CRIT (2, fixed in-loop)

**C1 [Codex] -- milestone filter leaks legacy phases**
- File: `super-gsd/tools/phase-folder-audit/audit.cjs:351-371` (auditAllPhases)
- Pre-fix: `auditAllPhases(planningDir, { milestone: 'v1.8' })` returned 13 audits (8 legacy + 5 v1.8) instead of 5. `includeUnarchived` defaulted to true even when milestone was set, so legacy `.planning/phases/*` leaked into milestone-scoped audits. Returned rows also had `phase: undefined` and `milestone: undefined` (no path-segment annotation).
- Fix:
  - When `opts.milestone` is set, `includeUnarchived` defaults to false (caller can still explicitly opt-in via `{milestone, includeUnarchived: true}`).
  - Each row is annotated post-audit with `milestone` + `phase` derived from path segments (matching `<planningDir>/milestones/<MS>/phases/<NN-name>` structure).
- Verified: post-fix v1.8 audit returns exactly 5 phases (36-40) with `milestone:'v1.8'` and `phase:'NN-name'` correctly populated.

**C2 [Codex] -- SKILL.md ASCII gate fails**
- File: `super-gsd/skills/sgsd-complete-milestone/SKILL.md`
- Pre-fix: 27 non-ASCII bytes (em dashes U+2014) from pre-existing Phase 39 content (lines 97, 134, 222) and other prose. Phase 40 didn't add em dashes itself but the SKILL.md ASCII contract failed at the file level.
- Fix: bulk-replaced all U+2014 → `--` across the entire SKILL.md (cleanup of pre-existing emdashes, not just Phase 40 additions). Verified post-fix: 0 non-ASCII bytes.

### WARN (4 distinct, accepted/false-alarm)

**W1 [Claude] -- assertion 9 fs.mkdirSync without recursive:true**
- File: `audit.cjs:563-566`
- Claude flagged: `mkdirSync(path.join(tmp9PhasesA, '10-alpha'))` would throw ENOENT.
- FALSE ALARM -- actual code DOES use `{recursive: true}` on all 4 lines (Claude's static analysis was incorrect). Self-test 13/13 PASS confirms.

**W2 [Claude] -- divergent path resolution (process.cwd vs __dirname)**
- File: SKILL.md uses `process.cwd()`; audit.cjs internal CLI uses `__dirname`.
- ACCEPTED -- intentional Phase 39 W3 lesson pattern: orchestrator boundary uses `cwd()`, library defaults use `__dirname`. Documented as INFO; not a bug.

**W3 [Codex] -- constants/tests need hardening**
- INFO bundle covering: REQUIRED_FILES regex strictness; test fixtures could exercise edge cases (e.g., glob mismatches on PLAN.md naming variants).
- ACCEPTED -- canonical phase template is documented in RESEARCH §1.4; future v1.9 candidate to add fuzz-fixture if needed.

### NIT (0)

None.

## ATC checklist (post-fix)

| Step | Verdict |
|------|---------|
| 1 First Principles | PASS |
| 2 Delete | PASS |
| 3 Simplify | PASS (CRIT fixes net-reduce hazard surface) |
| 4 Validate | PASS (13/13 self-test + 8/8 fixtures + status-consistency v1.8 OK; v1.8 audit returns exactly 5) |
| 5 Anti-slop | 9/10 |

## Codex provider health

AVAILABLE throughout. 1 invocation, exit 0, JSONL row appended.

## Final verdict

**PASS** (post-fix). 0 unresolved CRIT, 0 unresolved WARN.

## One-liner

Phase 40 phase-folder audit: dual-provider review surfaced 2 CRITs (milestone filter leaked legacy phases; SKILL.md em-dash ASCII gate fail) + 4 WARNs (1 false alarm, 3 accepted); both CRITs fixed in-loop with milestone-scope hardening + path-segment annotation + bulk em-dash purge. v1.8 milestone now ready for sgsd-complete-milestone close.
