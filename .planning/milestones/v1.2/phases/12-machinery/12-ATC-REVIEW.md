---
phase: 12-machinery
reviewed: 2026-04-22T00:00:00Z
tier: FULL
depth: deep
files_reviewed: 10
files_reviewed_list:
  - super-gsd/scripts/lib/classifier-cache.cjs
  - super-gsd/scripts/lib/dispatch-planner.cjs
  - super-gsd/scripts/lib/context-gauge.cjs
  - super-gsd/scripts/lib/edge-guard.cjs
  - super-gsd/scripts/lib/gates-registry.cjs
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
  - super-gsd/templates/checkpoint.md
  - super-gsd/scripts/patch-gsd-tools-known-keys.sh
  - .planning/config.json
  - .planning/phases/12-machinery/verify.mjs
anti_slop_per_module:
  classifier-cache.cjs: 9/10
  dispatch-planner.cjs: 9/10
  context-gauge.cjs: 10/10
  patch-gsd-tools-known-keys.sh: 7/10
  average: 8.75/10
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
verdict: warn
---

# Phase 12: Machinery — ATC Code Review

**Reviewed:** 2026-04-22
**Tier:** FULL
**Depth:** deep (cross-module coherence + spec-vs-impl)
**Files Reviewed:** 10
**Status:** WARN — no critical issues; 2 warnings logged; phase may proceed

---

## Summary

Six plans delivered four MACH + two ERG improvements across four new/modified lib modules, one installer script, SKILL.md, checkpoint template, config.json, and a 14-invariant verifier. All 13 hard invariants in `verify.mjs` exit 0. Cross-module contracts (classifier-cache ↔ SKILL.md Step 2, dispatch-planner ↔ SKILL.md Rule 6.e, context-gauge as declared opt-in fallback) are coherent. WR-01/02/03 fixes are surgical and match the invariant surface. Commit discipline is clean across all 24 phase commits (specific-file staging, consistent `feat/fix/docs({phase}-{plan}):` messages, no `git add -A`). Two warnings are logged below; neither blocks phase close.

---

## Warnings

### WR-A: Installer script missing interactive confirmation step (spec deviation D-19 step 4)

**File:** `super-gsd/scripts/patch-gsd-tools-known-keys.sh`
**Lines:** 14-48 (argument parsing block) and 149-188 (RESULT dispatch block)

**Issue:** D-19 specifies that without `-y`, the script should "produce a diff, ask operator to confirm" before applying the patch. The implementation skips the interactive confirmation entirely — the `--dry-run` and `-y/--yes` flags are present, but there is no confirmation prompt on a plain invocation. Running the script without flags against an unpatched `core.cjs` applies the patch immediately.

The risk is mitigated: `.bak` is written before mutation (line 144), `--dry-run` exists for inspection, and `core.cjs` is in a separate git repo where the operator controls commit. However, the missing confirm-step means the `-y` flag's documented role ("Skip confirmation prompt") is misleading — there is no prompt to skip.

**Fix:** Either add a `read -rp "Apply patch? [y/N] "` confirmation guard before the `node "$TMPSCRIPT"` call (when `DRY_RUN=false && AUTO_YES=false`), or update the help text to accurately state "patch is applied immediately unless `--dry-run` is set" and update D-19 accordingly.

---

### WR-B: WR-01 narrowing discriminates on error message prefix, not `Error.code`

**File:** `super-gsd/scripts/lib/edge-guard.cjs`
**Line:** 85

**Issue:** D-16 specifies the fix as distinguishing `Error.code === 'ENOENT'` (gate not in registry). The actual implementation uses `err.message.startsWith("gate '")`, catching on the throw message from `getGate`. The distinction matters because `Error.code` is a Node I/O convention (file-system errors) whereas `getGate` throws a plain `Error` with no `.code` property — so the spec description was imprecise about the mechanism.

The implementation is _more_ precise than the spec (it catches only the known throw from `getGate("name not found")` and rethrows everything else), but there is a fragility: if `gates-registry.cjs` changes the throw message format, the discriminator silently falls through to `throw err` rather than catching the "gate not found" case, breaking the log-only fallback. No current bug, but the match is brittle.

**Fix:** Use a custom error subclass or error property (e.g., `err.code === 'GATE_NOT_FOUND'`) in `getGate`, and match on that in `edge-guard`'s catch. This couples the contract explicitly rather than relying on message-string prefix matching. Alternatively, document the coupling in both files so future maintainers know to keep the strings in sync.

---

## Info

### IN-01: context-gauge.cjs is unreferenced in SKILL.md (declared opt-in for future versions)

**File:** `super-gsd/scripts/lib/context-gauge.cjs`

**Issue:** The module header correctly documents itself as a "mechanical fallback path" for "future orchestrator versions" and notes the primary trigger is self-report (Option A). It is exported but not required anywhere in the current SKILL.md or any other script in scope. This is intentional per the 12-RESEARCH §Risk 1 decision — but the module has no callers today.

**Observation:** Per anti-slop point 1 (every new function has a caller), this is technically a violation. However, the design intent is explicit and documented. No action required at phase close, but a follow-up plan should wire context-gauge into SKILL.md Step 9 or 11 (the token-log step) before v1.2 milestone close, or delete it if the mechanical path is abandoned.

---

### IN-02: verify.mjs Invariant 11 and 7 are string-presence checks, not behavioral assertions

**File:** `.planning/phases/12-machinery/verify.mjs`
**Lines:** 261-275 (Inv 11), 176-190 (Inv 7)

**Issue:** Invariants 7 and 11 assert that specific strings (`85%`, `emergency_halt`, `CHECKPOINT_EMERGENCY`, `skills\\/[^/]+\\/SKILL`) are present in SKILL.md. These confirm text was not accidentally deleted but do not verify the logic is wired correctly. A malformed regex or a copy-paste to the wrong predicate would pass both invariants. This is an inherent limitation of testing pseudo-code prose via static string checks.

**Observation:** This is the best mechanically testable surface available for SKILL.md. No actionable fix — noted for milestone-close awareness that Invariants 7 and 11 are presence-gates, not execution gates.

---

## Anti-Slop Pass Results

| Module | Score | Notes |
|--------|-------|-------|
| `classifier-cache.cjs` | 9/10 | `plan_schema_version: 2` is a magic number; scoped and documented, minor |
| `dispatch-planner.cjs` | 9/10 | `hasInternalConflict` unexported helper — justified, used inline |
| `context-gauge.cjs` | 10/10 | Pure, zero deps, all exports justified |
| `patch-gsd-tools-known-keys.sh` | 7/10 | Missing interactive confirm per D-19; misleading `-y` help text |
| **Average** | **8.75/10** | Above FULL-tier threshold (≥7.5) |

---

## Cross-Module Coherence Verdict

**PASS.** classifier-cache is correctly integrated as a require comment (pseudo-code) in SKILL.md Step 2 v1-path. dispatch-planner is wired into SKILL.md Rule 6.e wave-loop. context-gauge is intentionally unintegrated (opt-in future path, per module header). No hidden coupling. Error propagation from edge-guard → gates-registry is consistent. The `gates.shouldFire` call chain in SKILL.md maps cleanly to the registry's `getGate → evalPredicate` flow. MACH-04 `verifier_adversarial_rate` gate reads `config.atc.enabled` + random check — consistent with Phase 10 kill-switch convention.

---

## CLAUDE.md Compliance

**PASS.** 24 commits reviewed via `git log --oneline bd49eb1..HEAD`. All commits stage specific named files. No `git add -A` or `git add .` pattern. No secrets or credentials in any reviewed file. Commit messages follow prescribed `feat/fix/docs({phase}-{plan}):` convention throughout.

---

## Verdict

Phase 12 delivers coherent, well-bounded machinery across all six plans. No critical issues found. Two warnings are logged: the installer script silently applies without confirmation (WR-A, mitigated by `.bak`) and the WR-01 narrow catch relies on a fragile message-prefix match rather than a typed error contract (WR-B). Neither requires rework before phase close. The 8.75/10 average anti-slop score is above threshold.

**Recommendation: mark phase complete.** Address WR-B (typed error in getGate) and WR-A (confirm prompt or updated help text) in the next ergonomics sweep or Phase 13 ERG block.

---

_Reviewed: 2026-04-22_
_Reviewer: Claude (gsd-code-reviewer, ATC FULL tier)_
_Depth: deep (cross-module + spec-vs-impl)_
