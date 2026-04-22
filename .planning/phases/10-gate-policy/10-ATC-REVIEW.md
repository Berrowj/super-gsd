---
phase: 10-gate-policy
reviewed: 2026-04-22T00:00:00Z
depth: full
tier: FULL
files_reviewed: 7
files_reviewed_list:
  - super-gsd/scripts/lib/predicate-eval.cjs
  - super-gsd/scripts/lib/gates-registry.cjs
  - super-gsd/scripts/lib/edge-guard.cjs
  - super-gsd/registry/gates.yaml
  - super-gsd/skills/sgsd-orchestrate/SKILL.md (gate call sites + Edge-Guard section)
  - .planning/phases/10-gate-policy/verify.mjs
  - .planning/phases/09-atc-147-evidence/verify.mjs
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
anti_slop_scores:
  predicate-eval.cjs: 10/10
  gates-registry.cjs: 10/10
  edge-guard.cjs: 9/10
  average: 9.67/10
cross_module_coherence: pass
recommendation: mark phase complete
---

# Phase 10: Gate Policy — ATC Review Report

**Reviewed:** 2026-04-22T00:00:00Z
**Depth:** FULL
**Tier:** FULL (3 new modules + live orchestrator wiring)
**Files Reviewed:** 7
**Status:** issues_found (warnings only — no blockers)

---

## Summary

Phase 10 ships three small, well-scoped modules (predicate-eval, gates-registry, edge-guard) plus 11-row gates.yaml and 9 call-site wires into SKILL.md. The ATC anti-slop pass rate is 9.67/10 averaged across the three modules — no orphan functions, no dead imports, no YAGNI additions. D-10c (unknown-field loud-throw), D-11c (step-11 token-log exemption), and D-12b (09-verify.mjs retrofit) are all correctly implemented. Cross-module contracts are coherent. The phase-10 → 09-verify circular-dep concern is structurally sound: invariant 7 in 10-verify.mjs calls 09-verify.mjs via execSync, not via import, so there is no module-level cycle.

Three warnings are logged below. None blocks phase completion.

---

## Critical Issues

None.

---

## Warnings

### WR-01: `edge-guard.cjs` silently swallows `getGate` errors — hides misconfigured gate names

**File:** `super-gsd/scripts/lib/edge-guard.cjs:83`
**Issue:** The `try/catch` around `getGate(gateName, gatesYamlPath)` swallows all errors and falls back to `log-only`. This means a typo in a `gateName` passed by the orchestrator (e.g., `'per-dispatch-atc'` vs `'per-dispatch-ATC'`) silently degrades to log-only rather than surfacing the misconfiguration. The intent was to be defensive against a missing registry, but the broad catch absorbs legitimate programming errors too.
**Fix:**
```javascript
// In recordTransition, replace the broad catch with a targeted one:
try {
  const gate = getGate(gateName, gatesYamlPath);
  if (gate && gate.escalation === 'halt') escalation = 'halt';
} catch (err) {
  // Only degrade on "gate not found" (known safe); re-throw everything else
  if (!err.message.startsWith("gate '")) throw err;
  // gate not found — fall back to log-only (registry absent or name mismatch)
}
```
Alternatively, separate registry-missing errors (ENOENT on the YAML path) from gate-name-not-found errors so each path is handled intentionally.

---

### WR-02: `gates-registry.cjs` cache is module-level global — cross-test pollution when `resetCache()` is not called between tests

**File:** `super-gsd/scripts/lib/gates-registry.cjs:23`
**Issue:** `let _cache = null` is module-level. When multiple test files `require('./gates-registry.cjs')` in the same Node.js process (e.g., a future test suite), cache state from a prior test that called `loadGates(pathA)` will be returned when a subsequent test calls `loadGates(pathB)`. The `resetCache()` export exists, but it requires callers to know to use it. The edge-guard self-test does call `resetCache()` correctly, but the contract is implicit.
**Fix:** Add a JSDoc note to `loadGates` explicitly warning that the cache is process-scoped and callers must call `resetCache()` between incompatible load paths. Or accept a `forceReload` boolean param. The current behaviour is safe for the production singleton use-case; this is only a test-harness risk.

---

### WR-03: `SKILL.md` Step 9.2 dispatch context assembles `code_files_changed_count` using `.md` extension check — misclassifies non-doc `.md` files (e.g., `AGENTS.md`, skill files)

**File:** `super-gsd/skills/sgsd-orchestrate/SKILL.md:731-733`
**Issue:** The filter `!f.endsWith('.md') && !f.startsWith('.planning/')` excludes all `.md` files from `code_files_changed_count`. SKILL.md, AGENTS.md, and command `.md` files are source code in this codebase (per CLAUDE.md scope notes). A commit that only modifies `super-gsd/skills/sgsd-orchestrate/SKILL.md` would produce `code_files_changed_count: 0`, causing the `per-dispatch-ATC` gate's `code_files_changed_count > 0` trigger clause to be false — the ATC review would not fire even though the changed file is functionally significant.
**Fix:** Narrow the exclusion to planning-only markdown: change the condition to `!f.startsWith('.planning/')` and add an explicit exclusion list for lock files / generated artefacts rather than excluding all `.md`. Alternatively, keep the current filter but document the known limitation as an accepted gap (skill-file changes are caught by the phase-level ATC gate at Step 6.5).

---

## Info

### IN-01: `predicate-eval.cjs` — `contains` op requires `actual` to be an array; no error thrown if `actual` is a non-array (silently returns false)

**File:** `super-gsd/scripts/lib/predicate-eval.cjs:90`
**Issue:** `case 'contains': return Array.isArray(actual) && actual.includes(value)` — when `actual` is not an array, this returns `false` silently rather than throwing. This is inconsistent with D-10c's loud-fail philosophy. No current gate row uses `contains` so this has zero impact, but it is a latent inconsistency.
**Fix:** Add an explicit check: `if (!Array.isArray(actual)) throw new Error(\`'contains' op requires array field '${field}', got ${typeof actual}\`);`

---

### IN-02: Commit range includes `docs(10): Phase 10 context` commit before CONTEXT.md was locked — 18 commits in Phase 10 range is correct but note `32d3c86` (serialize-waves fix) added after plan-check

**File:** git log (commit `32d3c86`)
**Issue:** The wave-serialization commit (`fix(10): serialize waves — 10-02 moves to Wave 2, 10-03 to Wave 3`) was added after plan-check PASS. This is a plan amendment applied post-check. The change was substantively correct (resolves an edge-guard dependency race) but it is a deviation from the expected "plan-check PASS → execute" sequence. No CLAUDE.md surgical constraint was violated; all commits stage specific files. This is a traceability note, not a policy breach.
**Fix:** None required. Document in the phase summary that the wave plan was amended post-check per plan-checker W-2 note.

---

## Anti-Slop Pass Detail

### `predicate-eval.cjs` — 10/10

1. Every function has a caller — evalPredicate (exported), evalClause (called by evalPredicate), getDottedField (called by evalClause), applyOp (called by evalClause). No orphans.
2. No dead imports.
3. All parameters read. `clause`, `ctx`, `dotPath`, `actual`, `op`, `value` all used.
4. 95 LOC is as small as the domain permits — no excess.
5. No unjustified abstractions (`evalClause` / `getDottedField` / `applyOp` are natural splits).
6. No duplication with existing code.
7. Nothing that a senior engineer would mass-delete.
8. ΔComplexity: new module, net zero on brownfield.
9. No YAGNI additions — `any:` clause for OR is used by MUDA gate immediately.
10. Does one thing: evaluates structured predicate clauses.

### `gates-registry.cjs` — 10/10

1. loadGates, getGate, shouldFire, resetCache — all exported, all have callers.
2. `fs`, `path`, `evalPredicate` — all used.
3. All params used.
4. 90 LOC. Cannot be made smaller.
5. Cache singleton is justified — O(1) repeat-call requirement stated in spec.
6. No duplication.
7. Nothing deletable.
8. ΔComplexity neutral.
9. No YAGNI.
10. Does one thing: registry load + gate lookup.

### `edge-guard.cjs` — 9/10

1. `recordTransition` exported, `runSelfTest` is called by CLI guard. No orphans.
2. `fs`, `os`, `path` all used. `_getGate` lazy-loaded as designed.
3. All params used.
4. ~200 LOC — somewhat heavy but split is justified: production path is ~70 LOC, self-test is the remainder.
5. Lazy `_getGate` wrapper is justified (avoids hard-fail in test context per comment).
6. No duplication.
7. Self-test is not deletable — it is the GATE-04 verification surface.
8. ΔComplexity neutral (new module).
9. **-1 point**: `fail()` + `passed` boolean pattern inside `runSelfTest` is slightly heavier than throwing on first failure — the early-abort via flag without breaking the try/catch introduces subtle control flow. Minor complexity smell.
10. Does one thing: records step transitions and provides a self-test harness.

---

## Cross-Module Coherence Verdict: PASS

| Link | Contract | Status |
|------|----------|--------|
| predicate-eval `evalPredicate(trigger[], ctx)` → called by gates-registry `shouldFire` | Clause shape: `{field, op, value}` + `{any:[...]}` | Coherent |
| gates-registry `shouldFire(name, ctx, path)` → called by SKILL.md 9 sites | Returns boolean; throws on missing gate | Coherent |
| edge-guard `recordTransition({...})` → called by SKILL.md Edge-Guard pattern | 11-field return row matches JSONL schema | Coherent |
| gates.yaml trigger fields → predicate-eval allowed fields (D-10c) | All 9 trigger rows reference only declared DISPATCH_CONTEXT_FIELDS | Coherent |
| 10-verify.mjs invariant 7 → execSync(`node 09-verify.mjs`) | Call is via child process (not import) — no circular module dep | Coherent |
| 09-verify.mjs invariants 8+9 → 09-gate-bypass.yaml / 09-classification.yaml | WR-01 arithmetic check + WR-02 bucket crosswalk both implemented | Coherent |

---

## D-XX vs Implementation Spot-Check

| Decision | Expected | Actual | Result |
|----------|----------|--------|--------|
| D-10c: unknown field throws loud | `getDottedField` throws `Error` with dotPath in message | Line 66: `throw new Error("dispatch context missing field '${dotPath}'...")` | PASS |
| D-11c: step-11 exempt from emit-check | `fromStep === 11` early-return before missing calc | Line 69: `if (fromStep === 11) return { status: 'ok', missing_emits: [] }` | PASS |
| D-11b: no git mutations | No `exec`, `execSync`, `spawn` in edge-guard.cjs (outside self-test) | Confirmed — only `fs.appendFileSync` and `fs.mkdirSync` | PASS |
| D-11a: per-gate halt opt-in | `gate.escalation === 'halt'` triggers halt status | Line 80: conditional on `gate.escalation === 'halt'` | PASS |
| D-05: per-dispatch-ATC trigger | `atc_tier in [full, gate] AND code_files_changed_count > 0` | gates.yaml row matches exactly; SKILL.md Step 9.5 has `config.atc.enabled &&` outer knob | PASS |
| D-09: token-log gate no trigger | `trigger: []` → always fires | gates.yaml row 11 has `trigger: []` | PASS |
| D-07: MUDA trigger uses `files_changed_count` (not `code_files_changed_count`) | `field: files_changed_count` | gates.yaml uses `files_changed_count`; CONTEXT.md D-07 also says `files_changed` — consistent | PASS |
| D-12a: verify-completeness gates trigger on `phase_has_verify_mjs` | Both rows: `trigger: [{field: phase_has_verify_mjs, op: eq, value: true}]` | Confirmed in gates.yaml lines 188-192 and 200-204 | PASS |
| D-15a: row ordering by category then step | code-quality (6.5, 9.5) → process-hygiene (2, 4, 5, 5.5, 6.55, 10, 11) → verify-completeness (0, 0) | Confirmed — categories grouped, steps ascending within category | PASS |

---

## gates.yaml Semantic Correctness

All 11 trigger clauses were evaluated against the D-01..D-09+D-12 specifications. No plausible-but-wrong predicates found. One structural note:

- `verifier-row-arithmetic` and `verifier-detail-vs-summary` both have `step: 0`. Step 0 is not a real orchestrator step — these are logical gates on verify.mjs correctness, not loop-step transitions. This is semantically correct (they operate at phase-close, not mid-loop) but the `step` field value is slightly misleading. The verify.mjs itself enforces these at phase-close via its own invariants. Not a defect.

---

## CLAUDE.md Surgical Constraint Audit (13 Phase 10 commits)

Reviewed commit messages: all 13 code commits stage specific files by name. Pattern `git add -A` or `git add .` not observed. Commit message format follows `feat({phase}-{plan}):` convention throughout. No `.env`-adjacent files committed. Constraint: honored.

---

## Verdict

Phase 10 code is correct, well-scoped, and coherent. The three new modules are tight implementations that faithfully translate D-01..D-17 into runnable code. The anti-slop average of 9.67/10 reflects genuine absence of bloat. Three warnings are logged: WR-01 (broad catch in edge-guard that hides misconfigured gate names) is the most actionable — it could cause silent policy degradation if a call-site typos a gate name. WR-02 and WR-03 are latent risks rather than current defects. None warrants blocking phase completion; WR-01 should be addressed in the next touching commit.

**Recommendation: mark phase complete.** WR-01 fix is appropriate as a follow-on item in the Phase 11 wave (or as a standalone SKIP-tier fix commit now), not as a blocking gate.

---

_Reviewed: 2026-04-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: full — FULL tier_
