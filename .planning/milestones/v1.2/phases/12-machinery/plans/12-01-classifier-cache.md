---
phase: 12-machinery
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - super-gsd/scripts/lib/classifier-cache.cjs
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
  - .planning/phases/12-machinery/verify.mjs
  - .planning/phases/12-machinery/plans/12-01-SUMMARY.md
autonomous: true
requirements:
  - MACH-01

# v2 schema self-referential frontmatter
schema_version: 2
expected_ATC_tier: LITE
skip_gates: []
tasks:
  - id: 12-01-01
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/classifier-cache.cjs
    input_contract: |
      12-CONTEXT.md D-01..D-04 (per-plan cached verdict, sidecar path
      `.planning/phases/{phase_dir}/plans/{NN-PP}.classifier.json`, mtime-stale check,
      v1-plan fallback).
      12-RESEARCH.md §Q1 — recommended ~60 LOC CJS module with exports
      `{readCache, writeCache, clearCache, sidecarFor}`. Sidecar body shape:
      `{classified_at, verdict: {complexity, model, atc_tier, deliberate, reason}, plan_schema_version}`.
      Reference existing module style: `super-gsd/scripts/lib/gates-registry.cjs` (JSDoc + CJS exports).
      Path-derivation rule: extract leading `NN-PP` id from plan filename basename; fall back
      to basename if no match (defensive).
    output_contract: |
      `super-gsd/scripts/lib/classifier-cache.cjs` exists as a CJS module that exports
      exactly `{readCache, writeCache, clearCache, sidecarFor}` (other helpers private).
      Zero runtime deps beyond `fs` and `path`. ~60 LOC total including JSDoc.
      `sidecarFor(planFile)` → absolute path to `<dir>/<NN-PP>.classifier.json`.
      `readCache(planFile)` → verdict object | null. Returns null when sidecar absent,
      when sidecar JSON is malformed (try/catch around JSON.parse), OR when
      `planFile.mtimeMs > sidecar.mtimeMs` (stale, per D-03).
      `writeCache(planFile, verdict)` → writes `{classified_at: ISO, verdict, plan_schema_version}`
      to sidecar; returns sidecar path.
      `clearCache(planFile)` → removes sidecar if present (idempotent — no throw on missing).
    hypothesis: |
      A ~60-LOC pure-fs module keyed on the plan's NN-PP id matches the Phase 10/11 plans/
      layout (verified via Glob) and gives the orchestrator a zero-dep O(1) cache lookup.
      mtime-based staleness is the standard Node.js filesystem pattern and requires no
      version-counter coordination. Malformed-JSON → cache-miss preserves forward-compat.
    falsifier: |
      (a) `require('./classifier-cache.cjs')` fails to resolve one of the four exports.
      (b) Writing a sidecar then reading it back returns null (round-trip broken).
      (c) Touching the plan file after writing the sidecar (mtime bump) does NOT cause
      readCache to return null (staleness check broken — D-03 violation).
      (d) Malformed JSON in sidecar causes readCache to throw instead of returning null
      (should treat as cache-miss per V5 security pattern from research).
      (e) clearCache throws when sidecar already absent (must be idempotent).
      (f) Introduces any runtime dep (`require('js-yaml')`, etc — module must stay pure-fs).
    stop_rule: |
      File exists; inline node smoke test exercises all four exports against a /tmp fixture
      plan file — writeCache round-trips through readCache; mtime bump on plan invalidates
      readCache (returns null); malformed sidecar returns null; clearCache idempotent.
    verification_cmd: |
      node -e "const fs=require('fs');const path=require('path');const os=require('os');const d=fs.mkdtempSync(path.join(os.tmpdir(),'cc-'));const plans=path.join(d,'plans');fs.mkdirSync(plans);const pf=path.join(plans,'10-01-foo.md');fs.writeFileSync(pf,'plan content');const c=require('./super-gsd/scripts/lib/classifier-cache.cjs');if(!c.readCache||!c.writeCache||!c.clearCache||!c.sidecarFor){console.error('FAIL exports');process.exit(1);}const v={complexity:'medium',model:'sonnet',atc_tier:'LITE',deliberate:false,reason:'test'};c.writeCache(pf,v);const side=c.sidecarFor(pf);if(!fs.existsSync(side)){console.error('FAIL write');process.exit(2);}const got=c.readCache(pf);if(!got||got.complexity!=='medium'){console.error('FAIL roundtrip');process.exit(3);}fs.writeFileSync(side,'{not json');if(c.readCache(pf)!==null){console.error('FAIL malformed');process.exit(4);}c.writeCache(pf,v);const later=Date.now()/1000+10;fs.utimesSync(pf,later,later);if(c.readCache(pf)!==null){console.error('FAIL stale');process.exit(5);}c.clearCache(pf);c.clearCache(pf);if(fs.existsSync(side)){console.error('FAIL clear');process.exit(6);}console.log('PASS');"
    verification_gates:
      - "node -e ... classifier-cache smoke → exit 0 (exports + roundtrip + malformed + stale + idempotent-clear)"

  - id: 12-01-02
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/phases/12-machinery/verify.mjs
    input_contract: |
      12-VALIDATION.md §Per-Task Verification Map (invariants #1 and #2 for MACH-01).
      12-RESEARCH.md §Q9 (copy the Phase 10 verify.mjs ESM/createRequire/fail(N,msg) pattern).
      Invariant 1: `require('super-gsd/scripts/lib/classifier-cache.cjs')` exports the four
      functions; `typeof === 'function'` check on each.
      Invariant 2: writeCache round-trip — invoke writeCache on a tmpdir fixture plan,
      read the sidecar back via JSON.parse, assert shape
      `{classified_at: string, verdict: {complexity, model, atc_tier, deliberate, reason}, plan_schema_version: number}`.
      Exit-code convention: exit N for failing invariant N (Phase 10 pattern).
    output_contract: |
      `.planning/phases/12-machinery/verify.mjs` ESM Node script is authored containing at
      minimum invariants 1 and 2 (scoped to MACH-01). Uses the `fail(n, msg)` helper pattern
      from `.planning/phases/10-gate-policy/verify.mjs`. Exit 0 when both pass; exit 1 or 2
      on the matching fail. File is ESM (import syntax) and uses `createRequire` for CJS deps.
      Subsequent plans (12-02..12-06) will APPEND invariants 3..14 — plan 12-01 authors the
      scaffold + invariants 1-2 only so the file is committable now with the module shipped.
    hypothesis: |
      Authoring verify.mjs alongside the module it validates is the Phase 10 pattern
      (10-01-04 authored verify.mjs in Wave 1). Downstream plans 12-02..12-06 append
      their own invariants to the same file. Starting with invariants 1-2 green ensures
      every subsequent commit gates against the classifier-cache contract.
    falsifier: |
      (a) `.planning/phases/12-machinery/verify.mjs` missing or non-ESM (no `import` statements).
      (b) File has fewer than 2 numbered invariants (`grep -cE 'Invariant [12]\\b'` < 2).
      (c) Running `node verify.mjs` on committed classifier-cache.cjs exits non-zero
      (means module + verifier contract disagree).
      (d) Exit code does NOT match invariant number on induced failure (break Phase 10 convention).
    stop_rule: |
      `test -f .planning/phases/12-machinery/verify.mjs` true; `node .planning/phases/12-machinery/verify.mjs`
      exits 0 against the 12-01-01 committed module. `grep -cE 'Invariant [12]\\b' verify.mjs` == 2.
    verification_cmd: |
      test -f .planning/phases/12-machinery/verify.mjs && test $(grep -cE 'Invariant [12]\b' .planning/phases/12-machinery/verify.mjs) -ge 2 && node .planning/phases/12-machinery/verify.mjs
    verification_gates:
      - "verify.mjs file exists → exit 0"
      - "Invariant 1 + 2 markers present → count >= 2"
      - "node verify.mjs → exit 0 (MACH-01 contract green)"
    depends_on: [12-01-01]

  - id: 12-01-03
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
    input_contract: |
      12-CONTEXT.md D-01c (v1 plan fallback — MACH-01 only wraps the v1 path at SKILL.md:188-203).
      12-CONTEXT.md D-04 (log cache-hit events to `.planning/metrics/token-log.jsonl` with
      `role: classifier-skip`).
      12-RESEARCH.md §Q1 "Integration edit at SKILL.md Step 2" — wrap the existing
      FIRST/THEN/AFTER Haiku dispatch block (lines 190-202) with a cached-read branch;
      on cache miss, dispatch Haiku as before then write the cache; on cache hit, skip
      the dispatch entirely and emit a token-log row with role=classifier-skip.
      Preserve the v2 synthesis path (lines 166-186) UNTOUCHED — it's already free.
    output_contract: |
      `super-gsd/skills/sgsd-orchestrate/SKILL.md` Step 2 block (v1-plan branch around
      lines 188-203) now shows the pattern: `const cached = classifierCache.readCache(planFilePath);
      if (cached) { classifier_result = cached; [log classifier-skip row] } else { [existing
      Haiku dispatch]; classifierCache.writeCache(planFilePath, classifier_result); }`.
      The token-log row written on cache-hit includes `role: "classifier-skip"` per D-04.
      Measurable invariants:
      - `grep -q "classifier-cache" super-gsd/skills/sgsd-orchestrate/SKILL.md` → exit 0
      - `grep -q "classifier-skip" super-gsd/skills/sgsd-orchestrate/SKILL.md` → exit 0
      - `grep -q "readCache" super-gsd/skills/sgsd-orchestrate/SKILL.md` → exit 0
      - v2-synthesis block (identifying text from lines 166-186) is unchanged
    hypothesis: |
      Wrapping ONLY the v1-path with a cache hit/miss branch keeps the v2 SCHEMA-04 fast-path
      untouched (already zero-cost) and applies MACH-01's savings to the scenario the
      requirement targets: plans with multiple tasks that currently dispatch Haiku per-task.
      The greppable markers (`classifier-cache`, `classifier-skip`, `readCache`) become the
      integration-landing signal checked by verify.mjs in plan 12-04 final invariants.
    falsifier: |
      (a) SKILL.md no longer contains the v2 synthesis block at original lines 166-186
      (accidental regression).
      (b) `grep` for any of `classifier-cache` / `classifier-skip` / `readCache` returns
      zero matches (integration didn't land).
      (c) Cache-write occurs inside the cache-HIT branch (writes stale/duplicate sidecar).
      (d) Cache-hit branch dispatches the classifier agent anyway (savings never materialize).
      (e) The token-log row emitted on cache-hit omits `role: "classifier-skip"` (D-04
      accounting invariant #14 becomes unobservable).
    stop_rule: |
      All three greppable markers present in SKILL.md; v2 synthesis block intact (compare
      via pre/post grep for a canonical phrase from lines 166-186); narrative prose still
      readable (no broken code fences).
    verification_cmd: |
      grep -q "classifier-cache" super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q "classifier-skip" super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q "readCache" super-gsd/skills/sgsd-orchestrate/SKILL.md
    verification_gates:
      - "grep classifier-cache SKILL.md → exit 0 (module referenced)"
      - "grep classifier-skip SKILL.md → exit 0 (role string for token-log)"
      - "grep readCache SKILL.md → exit 0 (integration call site present)"
    depends_on: [12-01-01]

  - id: 12-01-04
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/phases/12-machinery/plans/12-01-SUMMARY.md
    input_contract: |
      12-CONTEXT.md D-04 soft invariant — `token-log.jsonl` cache-hit count > 0 for v1 plans
      with ≥2 tasks. 12-RESEARCH.md §Q9 invariant #14 notes this is an EXPECTED-RED proof-
      by-usage signal. 12-VALIDATION.md §Per-Task Verification Map row 12-01-04 marks this
      as "soft-warn" (exit 0 even at count 0; note status in SUMMARY).
      This task performs NO code mutations. It produces the plan-close SUMMARY and records
      the current state of `.planning/metrics/token-log.jsonl` classifier-skip row count.
    output_contract: |
      `.planning/phases/12-machinery/plans/12-01-SUMMARY.md` is written with sections:
      - "## Artifacts" listing the 3 files created by 12-01-01..03 (paths + LOC).
      - "## Wave 0 Soft-Invariant (D-04)" recording
        `grep -c '"role": "classifier-skip"' .planning/metrics/token-log.jsonl || echo 0`
        result. Expected 0 at phase-12 plan-01 close (no v1 plan has yet executed post-
        integration). Marked as EXPECTED-RED per research Risk 5 / §Q9 #14.
      - "## Commit SHAs" one per 12-01-0N task commit.
      - "## Next" — plan 12-02 picks up Wave 2 (dispatch-planner).
      No code mutation; this is pure documentation.
    hypothesis: |
      Recording the D-04 soft-invariant's current value at plan-close makes the
      EXPECTED-RED state visible and audit-friendly without creating a fake-green. A
      future milestone-close tool can compare counts to verify MACH-01 actually fired
      at least once in production (Phase 13 dashboard territory per §Q9 note).
    falsifier: |
      (a) SUMMARY.md omits the D-04 soft-invariant value section.
      (b) SUMMARY.md claims count > 0 without evidence (fabrication).
      (c) Task attempts any mutation of SKILL.md, classifier-cache.cjs, or verify.mjs
      (scope creep beyond pure documentation).
    stop_rule: |
      `test -f .planning/phases/12-machinery/plans/12-01-SUMMARY.md` true; file contains
      the four sections (Artifacts, Wave 0 Soft-Invariant, Commit SHAs, Next).
    verification_cmd: |
      test -f .planning/phases/12-machinery/plans/12-01-SUMMARY.md && grep -q "D-04" .planning/phases/12-machinery/plans/12-01-SUMMARY.md && grep -q "classifier-skip" .planning/phases/12-machinery/plans/12-01-SUMMARY.md
    verification_gates:
      - "SUMMARY.md exists → exit 0"
      - "D-04 section referenced → grep exit 0"
      - "classifier-skip row status recorded → grep exit 0"
    depends_on: [12-01-02, 12-01-03]

must_haves:
  truths:
    - "`classifier-cache.cjs` exports `{readCache, writeCache, clearCache, sidecarFor}` as pure-fs CJS (zero npm deps)"
    - "readCache returns null on (a) absent sidecar, (b) malformed JSON, (c) plan mtime > sidecar mtime (D-03 staleness)"
    - "writeCache round-trip persists `{classified_at, verdict, plan_schema_version}` and readback returns the verdict field"
    - "clearCache is idempotent (no throw when sidecar absent)"
    - "SKILL.md Step 2 v1-plan branch now wraps the Haiku dispatch with cache read/write; v2 synthesis path (lines 166-186) is UNTOUCHED"
    - "SKILL.md contains the three integration markers: `classifier-cache`, `classifier-skip`, `readCache`"
    - "`.planning/phases/12-machinery/verify.mjs` exists as ESM with invariants 1 + 2 (MACH-01 scope); exit 0 after 12-01-01 commits"
    - "Plan close: `.planning/phases/12-machinery/plans/12-01-SUMMARY.md` records the D-04 soft-invariant current value (expected 0)"
  artifacts:
    - path: "super-gsd/scripts/lib/classifier-cache.cjs"
      provides: "Per-plan verdict sidecar cache (MACH-01) — mtime-invalidated, JSON body `{classified_at, verdict, plan_schema_version}`"
      contains: "readCache, writeCache, clearCache, sidecarFor; module.exports = { readCache, writeCache, clearCache, sidecarFor }"
    - path: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      provides: "Integration: Step 2 v1-path wraps Haiku dispatch with classifier-cache read/write + classifier-skip token-log row"
      contains: "greppable markers `classifier-cache`, `classifier-skip`, `readCache` all present; v2 synthesis block unchanged"
    - path: ".planning/phases/12-machinery/verify.mjs"
      provides: "Phase-12 mechanical verifier — scaffold + invariants 1 (exports typeof) + 2 (writeCache schema round-trip)"
      contains: "ESM imports, createRequire, fail(n,msg) helper, Invariant 1 and Invariant 2 numbered blocks"
    - path: ".planning/phases/12-machinery/plans/12-01-SUMMARY.md"
      provides: "Plan close: artifacts + D-04 soft-invariant current value + commit SHAs"
      contains: "sections Artifacts, Wave 0 Soft-Invariant (D-04), Commit SHAs, Next"
  key_links:
    - from: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      to: "super-gsd/scripts/lib/classifier-cache.cjs"
      via: "import / require at Step 2 v1-path wrap"
      pattern: "classifier-cache"
    - from: ".planning/phases/12-machinery/verify.mjs"
      to: "super-gsd/scripts/lib/classifier-cache.cjs"
      via: "createRequire + require for invariants 1 and 2"
      pattern: "classifier-cache\\.cjs"
    - from: ".planning/metrics/token-log.jsonl"
      to: "MACH-01 cache-hit accounting"
      via: "role: classifier-skip row written inside the cache-HIT branch"
      pattern: "classifier-skip"
---

# Plan 12-01: Classifier Cache (MACH-01)

## Objective

Ship the per-plan classifier-verdict sidecar cache that lets the orchestrator skip the
Haiku classifier on the 2nd..Nth task of a v1 plan. Module lives at
`super-gsd/scripts/lib/classifier-cache.cjs`; integration lands in SKILL.md Step 2 v1-path;
Phase 12's own `verify.mjs` is stood up here (scaffold + invariants 1-2) so every downstream
plan gates against a green MACH-01 contract.

Purpose: Satisfies **MACH-01** — per-plan cached verdict (Q6a-iii) per D-01. Foundation for
all Phase-12 cache-accounting soft-invariants (D-04).

Output: 3 code-bearing files + 1 SUMMARY. Wave 1 — parallel with plans 12-05 and 12-06
(zero file overlap per D-23a: 12-05 edits different SKILL.md section; 12-06 touches no
SKILL.md).

## Tasks

Task breakdown follows 12-VALIDATION.md (4 tasks: 12-01-01..12-01-04). All contracts
live in the frontmatter above — that is the canonical executor input.

### 12-01-01 — `classifier-cache.cjs` module

Build the ~60-LOC pure-fs module per 12-RESEARCH.md §Q1. Four exports:
`{readCache, writeCache, clearCache, sidecarFor}`. Sidecar body schema:
`{classified_at, verdict, plan_schema_version}`. Staleness: `planFile.mtimeMs > sidecar.mtimeMs`.
Malformed JSON → cache-miss (try/catch around JSON.parse, per V5 security pattern).
`clearCache` is idempotent.

### 12-01-02 — Phase-12 `verify.mjs` scaffold + invariants 1-2

Mirror `.planning/phases/10-gate-policy/verify.mjs` (ESM, createRequire, fail(N,msg)).
Scope to MACH-01: Invariant 1 asserts the four exports via `typeof === 'function'`;
Invariant 2 round-trips `writeCache → JSON.parse(readFile) → assert shape`. Exit-code
convention matches Phase 10 (exit N = failing invariant N). Later plans 12-02..12-06
APPEND invariants 3..14 to the same file.

### 12-01-03 — SKILL.md Step 2 v1-path integration

Wrap the existing FIRST/THEN/AFTER Haiku-dispatch block (current lines 188-203) with a
cached-read branch per §Q1 integration recipe. Cache-hit → `classifier_result = cached`
and write a `role: "classifier-skip"` token-log row (D-04). Cache-miss → dispatch Haiku
as before then `classifierCache.writeCache(planFilePath, classifier_result)`. Leave the
v2 synthesis path (lines 166-186) UNTOUCHED — it's already zero-cost.

### 12-01-04 — SUMMARY + D-04 soft-invariant capture

Pure documentation task. Produce `12-01-SUMMARY.md` with sections: Artifacts, Wave 0
Soft-Invariant (D-04 current count), Commit SHAs, Next. The D-04 count is EXPECTED-RED
(zero) at plan-01 close per §Q9 #14 — recording it here establishes the baseline so a
future milestone-close audit (Phase 13 dashboard) can prove MACH-01 actually fired.

## Verification Gates (Wave close)

1. classifier-cache smoke `node -e "..."` (exports + roundtrip + malformed + stale + idempotent-clear) → PASS
2. `.planning/phases/12-machinery/verify.mjs` exists with Invariant 1 + 2 markers → count ≥ 2
3. `node .planning/phases/12-machinery/verify.mjs` → exit 0
4. `grep -q "classifier-cache" super-gsd/skills/sgsd-orchestrate/SKILL.md` → exit 0
5. `grep -q "classifier-skip" super-gsd/skills/sgsd-orchestrate/SKILL.md` → exit 0
6. `grep -q "readCache" super-gsd/skills/sgsd-orchestrate/SKILL.md` → exit 0
7. `test -f .planning/phases/12-machinery/plans/12-01-SUMMARY.md` AND contains D-04 reference → exit 0

## Success Criteria

- All 4 files exist at paths declared in `files_modified`.
- All 4 task `verification_cmd`s exit 0.
- `classifier-cache.cjs` passes the smoke test on all 6 failure modes (exports / roundtrip /
  malformed / stale / idempotent-clear / write-side-effect).
- Phase-12 `verify.mjs` runs green on the MACH-01 contract (invariants 1 + 2).
- SKILL.md Step 2 v1-path integration markers all present; v2 synthesis block intact.

## Output

After completion, create `.planning/phases/12-machinery/plans/12-01-SUMMARY.md` as
declared in 12-01-04. SUMMARY references:
- 3 committed artefacts (classifier-cache.cjs, SKILL.md edit, verify.mjs scaffold)
- D-04 soft-invariant current count (expected 0; recorded verbatim)
- Commit SHAs (one per 12-01-0N task)
- Handoff to plan 12-02 (Wave 2: dispatch-planner).
