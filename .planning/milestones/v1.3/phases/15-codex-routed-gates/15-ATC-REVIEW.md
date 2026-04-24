---
phase: 15-codex-routed-gates
run_at: 2026-04-24T00:00:00Z
provider: claude-sonnet-reviewer
tier: full
critical_count: 0
warning_count: 4
duration_ms: 0
fallback_triggered: false
---

# Phase 15 ATC Review — Codex-Routed Gates + Qualitative MUDA Probe

**Reviewed:** 2026-04-24
**Depth:** full (FULL tier, 5 plans, 1230 insertions across 11 files)
**Files Reviewed:** 11 (gates.yaml, providers-registry.cjs, predicate-eval.cjs, codex-exec.sh, sgsd-muda-audit.sh, sgsd-orchestrate/SKILL.md, sgsd-token-audit/SKILL.md, sgsd-complete-milestone/SKILL.md, merge-settings.js, sgsd-codex-monitor.ps1, lib/sgsd-codex-status.ps1)
**Plans:** 15-01, 15-02, 15-03, 15-04, 15-05 + P5 independent
**Status:** PASS-WITH-WARNINGS

---

## ATC 7-Step Gate

### Step 1 — First Principles

Phase goal: "flip the Codex switch." All 6 CODEX deliverables map to stated goal. P5 (codex-live monitor) is adjacent infrastructure, not goal-drift, but lacks a planning artifact. The core scope discipline holds: no third providers, no per-project overrides, no sgsd-code-reviewer.md refactor, no Codex on classifier or primary verifier. Non-goal list from CONTEXT D-27 is fully honoured.

### Step 2 — Delete

No material deletion opportunity exists. The provider-dispatch branch (SKILL.md Steps 6.5/9.5) is the required replacement for hardcoded Agent() calls. P5's sgsd-codex-monitor.ps1 (261 lines) and sgsd-codex-status.ps1 (308 lines) are new files with no equivalent prior code to delete against.

### Step 3 — Simplify

ΔComplexity is positive but justified. The provider-dispatch branch adds one conditional layer at Steps 6.5 and 9.5. Steps 6.5 and 9.5 are structurally identical — the duplication is intentional (different gate names, different evidence paths). No extraction opportunity without coupling the two gates.

### Step 4 — Accelerate

Wave model (W1 parallel 15-02+15-03, W2 solo 15-01, W3 solo 15-04, W4 solo 15-05) is correct given the SKILL.md serialization constraint. No parallelism left on the table.

### Step 5 — Automate

verify.mjs provides 9 mechanically-verifiable invariants. No manual check could be automated further at this scope.

### Step 6 — Validate

7-point validation: (1) goal achieved 6/6 CODEX deliverables, (2) verify.mjs 9/9 PASS confirmed in commit 35180c3, (3) W-1/W-2/W-4 ATC warnings from 14 addressed, (4) WR-01/WR-02 hotfixes landed in 65781ce + d695624, (5) wave DAG has no cycles, (6) VTP evidence consumed (3 doc-IDs), (7) config.json kill thresholds present. **Four warnings remain open — detailed below.**

### Step 7 — Checklist

1. Every new function/gate has a caller — PASS (resolveReviewerProvider called from Steps 6.5 and 9.5; qualitative-waste-audit gate evaluated by shouldFire; --milestone-close-check called from sgsd-complete-milestone Step 3)
2. Every import is used — PASS
3. Every parameter is read — WARNING: `loadReviewProvidersConfig(opts.configPath).default_provider` at providers-registry.cjs:158 is unreachable (see WR-02)
4. Could this be less code? — No
5. Abstractions justified? — PASS (provider-dispatch is a 2-site abstraction: Steps 6.5 and 9.5)
6. Existing code reused? — PASS (codex-exec.sh extended, not duplicated)
7. Mass-delete test — P5 monitor files pass (live-state is a new surface; no prior equivalent)
8. ΔComplexity — Positive but within scope. Fallback branching at Steps 6.5/9.5/9.6 adds cyclomatic complexity of ~3 per gate. Justified.
9. "Just in case" additions — WR-04: the `invocation_type` path in Step 9.6 is dead code (see WR-03)
10. Single-thing-per-commit — PASS across 13 commits. P5 commit (c8b2d25) is coherent but lacks planning artifact (IN-02).

---

## Summary

Phase 15 delivered all 6 CODEX requirements. The Karpathy-principle check is clean: the phase did exactly "flip the Codex switch" plus its five declared additions. D-27 non-goals are fully honoured. Cross-plan consistency is largely sound — naming is consistent (snake_case YAML, camelCase JS, kebab-case CLI), no helper duplication, config.json grew by exactly the keys with declared consumers.

**Two carry-over warnings from 14-ATC-REVIEW remain unresolved** (WR-01 stale JSDoc, WR-02 dead code branch). A new critical-class-adjacent bug was introduced by 15-04: `invocation_type` typo in Step 9.6 (WR-03) — the exact W-3 anti-pattern the plans set out to prevent. In Steps 6.5/9.5 it was prevented; in Step 9.6 it was not. This causes the adversarial challenger to silently bypass shell-dispatch and fall to the agent branch, meaning Codex is never actually invoked for adversarial challenger even when the gate fires. Two informational items cover the missing SUMMARY files and the P5 planning gap.

**Verdict: PASS-WITH-WARNINGS.** The functional core (CODEX-07 through CODEX-12) is wired correctly and verify.mjs passes. WR-03 is the highest-priority fix before the milestone-close Codex kill check, because without it the adversarial challenger never produces Codex `adversarial_verifier` rows, which means `claude_tokens_saved_by_codex` will under-report and `critical_count_delta` will have zero Codex adversarial contribution. The kill threshold may fire incorrectly.

---

## Warnings

### WR-01: Stale JSDoc in resolveReviewerProvider (carry-over from 14-ATC-REVIEW — NOT fixed)

**File:** `super-gsd/scripts/lib/providers-registry.cjs:17-19` and `providers-registry.cjs:137-138`
**Issue:** The W-1 fix (commit 6ea114d) changed the predicate from `!gate.reviewer_agent === undefined` to `!gate.reviewer_provider`, but two JSDoc blocks still describe the old behaviour:
- Module header (line 19): "returns provider record or null if the gate is not reviewer-shaped (no reviewer_agent field)"
- Function-level JSDoc (lines 137-138): "2. If the gate has no `reviewer_agent` field at all, return null (gate is not reviewer-shaped — e.g. process-hygiene gates)."
Both still reference `reviewer_agent` as the discriminator field when the actual predicate now checks `reviewer_provider`.
**Fix:**
```javascript
// Line 19 (module header):
//       if the gate is not reviewer-shaped (no reviewer_provider field).

// Lines 137-138 (function-level JSDoc):
// 2. If the gate has no `reviewer_provider` field, return null
//    (gate is not reviewer-shaped — e.g. process-hygiene, haiku-agent gates).
```

### WR-02: Dead code branch — unreachable default_provider fallback (carry-over from 14-ATC-REVIEW — NOT fixed)

**File:** `super-gsd/scripts/lib/providers-registry.cjs:157-158`
**Issue:** The guard at line 155 (`if (!gate || !gate.reviewer_provider) return null`) means that if execution reaches line 157, `gate.reviewer_provider` is guaranteed to be truthy. The `|| loadReviewProvidersConfig(opts.configPath).default_provider` on line 158 is therefore dead code — it can never be evaluated. This is a logic error: the intent was to fall back to the config default provider when a gate doesn't declare one, but the early-return at line 155 now takes that path instead, returning null rather than the default. If a future gate is added that is reviewer-shaped but omits `reviewer_provider`, it will get null instead of the config default.
**Fix:**
```javascript
// Option A — remove dead fallback (current null-return IS the intended fallback):
const name = gate.reviewer_provider;
return getProvider(name, opts.yamlPath);

// Option B — if default_provider fallback is intended for reviewer-shaped gates
// that don't declare a specific provider, change the guard:
if (!gate) return null;
if (!gate.reviewer_provider && !gate.reviewer_agent) return null;  // non-reviewer gate
const name = gate.reviewer_provider
  || loadReviewProvidersConfig(opts.configPath).default_provider;
return getProvider(name, opts.yamlPath);
```
Option A matches the current observable behaviour. Option B restores the original design intent.

### WR-03: `invocation_type` typo in Step 9.6 adversarial challenger — W-3 pattern introduced by 15-04 (new finding)

**File:** `super-gsd/skills/sgsd-orchestrate/SKILL.md:1027` and `SKILL.md:1060`
**Issue:** Steps 6.5 and 9.5 correctly reference `effective.invocation` (matching the YAML field name `invocation:` in review-providers.yaml). Step 9.6 (15-04's CODEX-11 implementation) uses `challengerProvider.invocation_type` at both lines 1027 and 1060. The field `invocation_type` does not exist on provider records — `review-providers.yaml` uses `invocation:`. This means `challengerProvider.invocation_type === 'shell'` always evaluates to `false`, the `else` branch fires instead, and `Agent()` is called with `challengerProvider.agent_subagent_type` which is `undefined` for `codex-cli-reviewer` (a shell-type provider). The adversarial challenger silently degrades to an Agent() call with an undefined subagent_type rather than dispatching to Codex via codex-exec.sh. The W-3 anti-pattern was explicitly listed in 15-01 T2 as "never use invocation_type", and verify.mjs inv4 scopes its typo-check to Steps 6.5 and 9.5 only — Step 9.6 was not covered by the invariant check.
**Impact:** `adversarial_verifier` rows in token-log.jsonl will have `provider: undefined` or `provider: 'claude'` instead of `provider: 'openai-codex'`. `claude_tokens_saved_by_codex` will under-report. The kill condition (CODEX-12) may fire incorrectly on insufficient Codex adversarial data.
**Fix:**
```javascript
// SKILL.md line 1027 — change:
if (challengerProvider.invocation_type === 'shell') {
// to:
if (challengerProvider.invocation === 'shell') {

// SKILL.md line 1060 — change:
model: challengerProvider.invocation_type === 'shell' ? 'codex' : (challengerProvider.agent_model || 'sonnet')
// to:
model: challengerProvider.invocation === 'shell' ? 'codex' : (challengerProvider.agent_model || 'sonnet')
```
Also add Step 9.6 to verify.mjs inv7 scope (currently only checks string presence, not field name correctness).

### WR-04: CODEX_QUAL_ENABLED bash logic — WARNING-1 from 15-CHECK.md — partially fixed

**File:** `super-gsd/scripts/sgsd-muda-audit.sh:316`
**Issue:** The 15-CHECK.md WARNING-1 identified a dead-code bug in the CODEX_QUAL_ENABLED guard. The fix applied (commit implementing `${CODEX_QUAL_ENABLED+x}`) addresses the case where the variable is unset, allowing config.json to be read. However, if the caller explicitly exports `CODEX_QUAL_ENABLED=false` (e.g., a CI environment variable), the `+x` guard correctly skips the config read and honours the caller's explicit `false`. This is intentional per the fix comment at line 315. The remaining concern is that `COMMITS_IN_PHASE` (used at line 321 for DIFF_LINES calculation) defaults to 1 if not set — a phase with more than 1 commit will under-count diff lines and may not meet the 200-line threshold, causing the probe to silently skip even when the actual phase diff is large. This is a separate, lower-severity logic gap from the original WARNING-1.
**Fix:** Document the `COMMITS_IN_PHASE` dependency in the script's usage comment (lines 17-30), or provide a `--commits N` flag that the orchestrator can pass from `git rev-list --count {first_commit}..HEAD`.

---

## Info

### IN-01: Missing 15-01-SUMMARY.md and 15-03-SUMMARY.md

**File:** `.planning/milestones/v1.3/phases/15-codex-routed-gates/`
**Issue:** Plans 15-01 and 15-03 have no SUMMARY.md files. 15-02, 15-04, and 15-05 all have summaries. The VERIFICATION.md explicitly calls this out at lines 103-104. Both plans were completed via code commits only, with no `docs({phase})` commit writing a summary artifact. This creates an incomplete evidence trail for the milestone-close cross-phase integration check.
**Fix:** Write `15-01-SUMMARY.md` and `15-03-SUMMARY.md` covering: deliverable (CODEX-07 / CODEX-10), files touched, ATC warnings resolved, and acceptance criteria met.

### IN-02: P5 commit (c8b2d25) ships 580 lines with no planning artifact

**File:** `super-gsd/scripts/sgsd-codex-monitor.ps1`, `super-gsd/scripts/lib/sgsd-codex-status.ps1`
**Issue:** Commit c8b2d25 landed codex-live status monitor + hook-dedup normalizer (580 lines, 4 files) outside the Phase 15 plan chain. The commit message itself calls out "A proper .planning artifact for P5 should be backfilled before any subsequent iteration." This is a commit-discipline gap per the "every commit does ONE thing" criterion: the P5 work is coherent but lacks a plan-id in the commit message prefix (uses `super-gsd/P5` rather than a phase-scoped identifier) and has no corresponding PLAN.md, making it invisible to the conformance-drift probe and the phase-level ATC gate trigger.
**Fix:** Backfill a `P5-PLAN.md` (or equivalent stub) in `.planning/milestones/v1.3/phases/` before milestone close. Tag the commit in commit-reviews.jsonl.

---

## Cross-Plan Consistency Findings

**Naming consistency:** PASS. YAML fields snake_case (reviewer_provider, codex_enabled, kill_critical_count_delta), JS camelCase (resolveReviewerProvider, codexEnabled), CLI kebab-case (--milestone-close-check, --probe codex). No cross-convention violations found.

**Duplicate helpers:** PASS. Provider lookup is exclusively in providers-registry.cjs. No duplicate lookup logic across plans.

**Config.json growth discipline:** PASS. Phase 15 added 5 keys: `codex_enabled`, `codex_qualitative_waste_enabled`, `kill_critical_count_delta`, `kill_claude_tokens_saved` (15-01/T3), plus `verifier_adversarial_rate` (existing from Phase 12). Each key has exactly one consumer: `codex_enabled` → Step 6.5/9.5/9.6 fallback guard; `codex_qualitative_waste_enabled` → sgsd-muda-audit.sh CODEX_QUAL_ENABLED; kill thresholds → sgsd-token-audit --milestone-close-check.

**SKILL.md cross-references:** No broken internal references found. Step 9.2's mechanical_muda_verdict comment correctly states it is "populated after MUDA-waste-audit gate fires at step 6.55." Step 9.6 references to step 9.5 kill-switch convention are consistent.

**gates.yaml schema drift:** PASS. The `qualitative-waste-audit` row uses the same column order and field naming as all other rows. The `reviewer_provider` field absent from `MUDA-waste-audit` (which uses `script:` instead) is consistent with the YAML design — reviewer-shaped gates use `reviewer_provider`, script-shaped gates use `script:`.

**Test coverage of CODEX deliverables:**
- CODEX-07: inv1 (gates.yaml ATC rows), inv4 (SKILL.md Steps 6.5/9.5 resolveReviewerProvider + shellDispatch) — covered
- CODEX-08: inv3 (muda-audit.sh invokes codex-exec.sh) — covered
- CODEX-09: inv2 (qualitative-waste-audit gate row exists) — covered
- CODEX-10: inv5 (Step 11 schema), inv6 (sgsd-token-audit tile) — covered
- CODEX-11: inv7 (Step 9.6 challenger uses non-primary-vendor) — PARTIALLY COVERED: inv7 checks string presence (`adversarial_verifier`, `VERIFIER_ADVERSARIAL_SKIP`, `codex-cli-reviewer`) but does NOT check for the `invocation_type` typo (WR-03). The typo passes inv7.
- CODEX-12: inv8 (sgsd-complete-milestone --milestone-close-check), inv9 (dry-run JSON format) — covered

**Fallback semantics consistency:** PASS. Three surfaces, consistent semantics:
- Steps 6.5/9.5: Codex error → single-retry to Claude (logs GATE_PROVIDER_FALLBACK); both fail → hard blocker (GATE_PROVIDER_DOUBLE_FAIL)
- Step 9.6: Codex unavailable → skip entirely, no same-vendor fallback (VERIFIER_ADVERSARIAL_SKIP). Intentional divergence per CONTEXT D-17a (cross-vendor signal; same-vendor fallback defeats purpose)
- sgsd-token-audit --milestone-close-check: codex_enabled=false → skip step (not a fallback scenario)

The three semantics are documented consistently and the divergence is justified. No unintentional inconsistency.

---

_Reviewed: 2026-04-24_
_Reviewer: Claude (gsd-code-reviewer) — phase-level ATC full tier_
_Depth: full (cross-plan consistency + standard per-file analysis)_
