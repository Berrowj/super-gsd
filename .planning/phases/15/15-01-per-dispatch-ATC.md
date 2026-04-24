# Phase 15 Plan 01 — Per-Dispatch ATC Review

**Plan:** 15-01 (switch-flip)
**Tier:** full
**Reviewed:** 2026-04-24T02:30:00Z
**Depth:** standard (cross-file, 3 commits: T1/T2/T3)
**Reviewer:** claude-sonnet-reviewer (via per-dispatch ATC gate, self-review of 15-01)

---

## Summary

Three commits (T1/T2/T3) ship the CODEX-07 provider-dispatch switch-flip. The core mechanics are
correct: W-1 predicate semantics are sound, fallback is single-retry and non-cascading, W-4
validation fires before JSONL append, and registry_version bump is correct at 2.1.0. Two warnings
were found — one stale JSDoc that actively misleads readers about the discriminator field, and one
unreachable code branch created by the T1 predicate change. One info item covers new config keys
with no current callers.

---

## FINDINGS

### WR-01: Stale JSDoc — resolveReviewerProvider discriminator description

**File:** `super-gsd/scripts/lib/providers-registry.cjs:19` and `:138-140`
**Severity:** Warning
**Issue:** JSDoc at line 19 says "if the gate is not reviewer-shaped (no `reviewer_agent` field)".
JSDoc at lines 138-140 says "2. If the gate has no `reviewer_agent` field at all, return null".
After T1, the actual discriminator is `reviewer_provider`, not `reviewer_agent`. A reader tracing
`resolveReviewerProvider` in a future incident will use the wrong mental model — particularly
dangerous because haiku-agent gates DO have `reviewer_agent` set, so the old description would
imply they'd be dispatched to a code reviewer.

**Fix:**
```js
// Line 19 — update module-level JSDoc:
//   "if the gate is not reviewer-shaped (no reviewer_provider field)"

// Lines 138-140 — replace:
//   "2. If the gate has no `reviewer_agent` field at all, return null"
// with:
//   "2. If the gate has no `reviewer_provider` field, return null
//       (gate is not reviewer-shaped — e.g. haiku-agent gates, process-hygiene gates)."
```

---

### WR-02: Dead code — default_provider fallback branch is unreachable post-T1

**File:** `super-gsd/scripts/lib/providers-registry.cjs:157-158`
**Severity:** Warning
**Issue:** After T1's predicate change, `gate.reviewer_provider` is guaranteed non-falsy at line
157 (all falsy cases returned `null` at line 155). The `|| loadReviewProvidersConfig(...).default_provider`
branch is therefore unreachable dead code. This matters because:
1. It loads and caches config unnecessarily on first call (minor, but observable).
2. It creates a false impression that the default_provider config key still governs per-gate
   resolution — it does not. Any gate without `reviewer_provider` now routes to null (skip),
   not to `default_provider`.

**Fix:**
```js
// providers-registry.cjs line 157-159 — replace:
const name = gate.reviewer_provider
    || loadReviewProvidersConfig(opts.configPath).default_provider;
return getProvider(name, opts.yamlPath);

// with (single line, dead branch removed):
return getProvider(gate.reviewer_provider, opts.yamlPath);
```

---

## INFO

### IN-01: New config keys with no current callers

**File:** `.planning/config.json:92-94`
**Severity:** Info
**Issue:** `kill_critical_count_delta: 5` and `kill_claude_tokens_saved: 50000` and
`codex_qualitative_waste_enabled: true` are added to the `review_providers` block. No code in
the reviewed scope reads these keys. They appear to be reserved for a CODEX-10 kill-switch metric.
YAGNI risk is low (config keys are cheap), but per anti-slop rule 9 these are "just in case"
additions with no current caller.

**Fix:** If these are pre-declared for an imminent CODEX-10 plan, add a comment citing the plan.
Otherwise defer to the CODEX-10 plan commit. No blocker.

---

## Critical Issues

None.

---

## Verification: Critical Checks

| Check | Result | Evidence |
|---|---|---|
| Fallback retry is single (non-cascading) | PASS | SKILL.md Steps 6.5+9.5: one `await Agent()` call in the `dispatchResult.exit !== 0` branch; no loop, no recursion |
| fallback_max_retries: 1 respected | PASS | config.json line 91; SKILL.md has no retry loop — single Agent() invocation |
| Fallback fires only on codex-exec.sh exit != 0 | PASS | Guarded by `dispatchResult.exit !== 0` |
| Fallback target is `claude-sonnet-reviewer` | PASS | `getProvider(effective.fallback_to)`; `fallback_to: claude-sonnet-reviewer` in review-providers.yaml:57 |
| Fallback logged to audit trail | PASS | `logDeviation(GATE_PROVIDER_FALLBACK...)` + JSONL `provider: 'claude-via-fallback'` tag in appendReviewEvidence |
| W-1: gate with no reviewer_provider → null | PASS | `!gate.reviewer_provider` = `!undefined` = true → return null |
| W-1: gate.reviewer_provider = "codex-cli-reviewer" → resolves | PASS | Predicate false → getProvider("codex-cli-reviewer") → codex entry |
| W-1: gate.reviewer_provider = "claude-sonnet-reviewer" → resolves | PASS | Predicate false → getProvider("claude-sonnet-reviewer") → claude entry |
| W-1: gate.reviewer_provider set, not in registry → hard error | PASS | getProvider() throws "unknown provider '...' not in review-providers registry" |
| W-4: --phase non-numeric rejects before JSONL append | PASS | Lines 80-84: validation runs before required-flags check (line 87) and before any append_jsonl call |
| W-4: exits non-zero | PASS | exit 1 |
| W-4: error to stderr | PASS | `echo "ERR: ..." >&2` |
| registry_version 2.0.0 → 2.1.0 | PASS | gates.yaml line 15; +0.1.0 for backward-compatible reviewer_provider field addition |
| codex_enabled: true is live | PASS | config.json line 87; SKILL.md effective-conditional correctly routes to codex-cli-reviewer |
| No orphan config keys (breaking) | PASS | All keys in review_providers block are consumed or clearly reserved (IN-01) |

---

## Verdict

**WARN** — 0 critical, 2 warnings, 1 info. Safe to ship. WR-01 (stale JSDoc) and WR-02 (dead code
branch) should be resolved in a follow-on cleanup commit before 15-02 ATC review. Neither blocks
the switch-flip from being live.

---

_Reviewed: 2026-04-24T02:30:00Z_
_Reviewer: Claude (sgsd-code-reviewer, claude-sonnet-reviewer)_
_Depth: standard (cross-file)_
_Phase: 15 / Plan: 01_
