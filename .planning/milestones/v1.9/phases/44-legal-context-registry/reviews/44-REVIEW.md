---
phase: 44
plan: 44-01
review_type: phase-level-ATC (Step 9, dual-provider)
date: 2026-04-27
verdict: PASS (after HIGH+MEDIUM fix)
---

# Phase 44 Phase-Level ATC Review — Dual Provider

## Reviewers

| Provider | Status | Verdict | Findings |
|----------|--------|---------|----------|
| Claude (sgsd-code-reviewer) | OK | REVISE → PASS post-fix | 1 HIGH (Phase 41 dependency-gate dead branch), 1 MEDIUM (PHASE43_CMD hardcoded), 3 LOW (cosmetic) |
| Codex (sgsd-codex-reviewer) | provider_unavailable | n/a | Phase 41/42/43 precedent: TIER_ANALYSIS=180s tier cap. Logged as provider_unavailable. |

## Claude review summary

```
REPORT_CONTRACT: code-reviewer-v1
ATC_TIER: FULL
STEP_1_FIRST_PRINCIPLES: JUSTIFIED
STEP_2_DELETE: 2 findings | ~4% reduction
STEP_3_SIMPLIFY: 1 finding | ΔComplexity neutral
STEP_4_ACCELERATE: 0 findings
STEP_5_AUTOMATE: 0 findings
STEP_6_VALIDATE: 7/7 (one PARTIAL on STATUS_KIND validation, low risk)
STEP_7_CHECKLIST: 8/10 → 10/10 post-fix
LOCK_13_NEVER_THROWS: SOUND
A4_HASH_IDEMPOTENCY: SOUND
A3_FOUR_OUTCOME_DISTINCTION: SOUND
READ_ONLY_INVARIANT: PASS
PHASE_41_42_43_IMPORT_BY_REFERENCE: PARTIAL → SOUND post-fix
NO_PREMATURE_DOWNSTREAM_IMPORT: YES
CLI_EXIT_CODES_LOCK_13: SOUND
MIRROR_FIDELITY: PARTIAL → PASS post-fix
```

## Findings + Resolution

### HIGH (resolved)

- **build.cjs:252** — `if (phase41 || true)` always-true guard silently bypassed the Phase 41 dependency check on Phase 43 require. Could mask a partial-import state at runtime.
  - **Fix**: commit `64bee5e` — removed spurious phase41 guard since Phase 43 (sibling tools/phase-capsule) loads independently of Phase 41 (sibling tools/token-attribution).

### MEDIUM (resolved)

- **build.cjs:582** — `PHASE43_CMD` hardcoded the literal `'writeCapsule'` string instead of dereferencing the Phase 43 module. Local-redefinition smell; would drift silently if Phase 43 renames its public API.
  - **Fix**: commit `64bee5e` — refactored to `phase43 && typeof phase43.writeCapsule === 'function' ? 'writeCapsule' : null` so the symbol is dereferenced from the imported module. Phase 43 doesn't export COMMAND_NAME (it writes JSON files, not envelope-v1 rows), so a literal-string mirror of Phase 41/42 isn't possible; this is the closest approximation.

### LOW (accepted)

- **check.cjs:110-114** — `malformed` key lookup returns `reason:'unknown_key'` instead of distinct `reason:'malformed_key'`. REASONS enum contains `'malformed_key'`. Cosmetic; current callers don't differentiate.
- **build.test.cjs:519** — secondary 13 `sourceMissingHandled` assertion is non-deterministic depending on whether Phase 41/42 production modules are present.
- **legal-keys.schema.json:7** — `additionalProperties: true` on root permits undeclared top-level keys. Tightening to `false` would catch typos at schema-validation time.

## Invariants

- **LOCK_13_NEVER_THROWS**: SOUND — All 8 named functions wrap internals in try/catch returning structured error objects. Adversarial inputs exercised in secondary 12.
- **A4_HASH_IDEMPOTENCY**: SOUND — `_registryContentHash` strips `generated_at` + `generated_by`; `_sortKeysDeep` produces deterministic key order. F2 asserts H1===H2 across delete+rebuild. Live verification: content_hash `b0a8024bc2b016eaca84da0d49c424f67c59c24f94ed64f8759c1d8ccc262c1d` stable across 4 consecutive `--build` runs (pre-fix and post-fix).
- **A3_FOUR_OUTCOME_DISTINCTION**: SOUND — validateOne returns 4 structurally distinct shapes (active / superseded-replaced / superseded-retired / unknown). Exercised in F3 + secondary 8.
- **READ_ONLY_INVARIANT**: PASS — no writeFile/appendFile against any of the 13 canonical sources. Only writes target legal-keys.json (+ tmp atomic) and 44-VERIFICATION.md. Secondary 11 fingerprints 19 sources across the full self-test run.
- **PHASE_41_42_43_IMPORT_BY_REFERENCE**: SOUND post-fix — ROLES, STATUSES, PROVIDERS, BLOAT_THRESHOLDS, COMMAND_NAME, ENVELOPE_VERSION (Phase 41); VERDICTS, ROUTE_REASONS (Phase 42); CAPSULE_FILE_KINDS (Phase 43) — all imported by reference; zero local redefinitions. PHASE43_CMD now dereferences the Phase 43 module symbolically.
- **NO_PREMATURE_DOWNSTREAM_IMPORT**: YES — no require() of Phase 45/49/50/51 modules.
- **CLI_EXIT_CODES_LOCK_13**: SOUND — `--self-test` exits 0/1; `--build` exits 0/1/2; `--check` exits 0 on valid AND invalid (informational, never halts auto-mode).
- **MIRROR_FIDELITY**: PASS post-fix — never-throws pattern, atomic write, mtime cache, frozen consts, fingerprint guard all faithfully mirror Phase 41/42/43.

## Live counts (canonical state at close)

| Category | Active | Superseded |
|----------|--------|------------|
| milestones | 9 | 1 |
| phases | 44 | — |
| gates | 13 | — |
| agents | 23 | — |
| artifacts | 5 | — |
| providers | 4 | — |
| statuses | 15 | — |
| phase_folders | 44 | — |
| commands | 13 | — |
| reason_codes | 31 | — |

## Backfill validation

44/44 PHASE-CAPSULE.json `downstream_contract.consumers[]` fields validate clean against legal-keys.json. Free-form "Phase NN" consumer references correctly skipped per design (Phase 45 owns normalize policy).

## Out-of-scope note

Verifier flagged token-attribution/{collect,report}.cjs has +203/-12 LOC unstaged from Phase 41 work that never got committed. NOT a Phase 44 deliverable. Operator decision before Phase 45 dispatch.

## Final Verdict

**PASS** (post-fix). Phase 44 deliverables hold all critical invariants. Claude HIGH + MEDIUM addressed; Codex provider_unavailable per established Phase 41/42/43 precedent. Commit chain: `a4f13eb` → `90bb6bf` → `8218280` → `3e7ed22` (verifier audit) → `64bee5e` (HIGH+MEDIUM fix). Cross-phase contracts ready: Phase 45 PACKET-03 wires validateReferences as packet admission boundary; Phase 49 GOV-02 consumes loadRegistry for memory-write admission; Phase 50 cockpit consumes for status-consistency rendering; Phase 51 BENCH-05 stale-registry/invalid-phase-ID failure injection scenarios.
