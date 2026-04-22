---
phase: 12-machinery
plan: 05
type: execute
wave: 1
depends_on: []
files_modified:
  - super-gsd/scripts/lib/edge-guard.cjs
  - super-gsd/scripts/lib/gates-registry.cjs
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
  - .planning/phases/12-machinery/plans/12-05-SUMMARY.md
autonomous: true
requirements:
  - ERG-01

# v2 schema self-referential frontmatter
schema_version: 2
expected_ATC_tier: LITE
skip_gates: []
tasks:
  - id: 12-05-01
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/edge-guard.cjs
    input_contract: |
      12-CONTEXT.md D-16 (WR-01) — narrow edge-guard.cjs:83 broad catch.
      Current code (confirmed via Read at lines 78-86):
      ```
      if (gateName && gatesYamlPath) {
        try {
          const gate = getGate(gateName, gatesYamlPath);
          if (gate && gate.escalation === 'halt') {
            escalation = 'halt';
          }
        } catch (_) {
          // gate not found or registry error — fall back to log-only (defensive)
        }
      }
      ```
      12-RESEARCH.md §Q5 — exact fix: discriminate via `err.message.startsWith("gate '")`
      (the `getGate` throw at gates-registry.cjs:62 always produces `gate '{name}' not in
      registry`). Non-matching errors rethrow so ENOENT / YAML parse errors surface.
      Citation from 10-ATC-REVIEW.md WR-01 (lines 56-72): discriminator is string-prefix,
      no new error class needed.
    output_contract: |
      `super-gsd/scripts/lib/edge-guard.cjs` at the catch block (currently line 83) now
      reads:
      ```
      } catch (err) {
        // Narrow: only swallow "gate name not in registry" — rethrow registry errors
        if (!err.message.startsWith("gate '")) throw err;
        // gate not found → fall back to log-only (registry may not have this name)
      }
      ```
      Measurable invariant: `grep -q "err.message.startsWith" super-gsd/scripts/lib/edge-guard.cjs` → exit 0.
      `getGate` is unchanged. No other edge-guard logic touched.
      Existing edge-guard self-test pattern (if present, research notes lines 126-263)
      still passes after the change — rethrow only affects the internal programming-error
      path that the current test suite doesn't exercise.
    hypothesis: |
      String-prefix discriminator is the minimum-churn fix that WR-01 explicitly proposed.
      No new error classes, no `GateNotFoundError` refactor (research §Q5: "LOW-value and
      high-churn — don't do it"). The `gate '...` prefix is the exact throw message from
      gates-registry.cjs:62 — verified via Read. ENOENT and js-yaml parse errors have
      distinct message prefixes so they'll now correctly surface.
    falsifier: |
      (a) `grep -q "err.message.startsWith" edge-guard.cjs` fails (fix didn't land).
      (b) Catch block still reads `catch (_)` with the old fallthrough comment (WR-01 unfixed).
      (c) Any existing edge-guard export or function signature changed (regression).
      (d) A `GateNotFoundError` class was introduced (over-engineering — research explicit
      guidance).
      (e) The rethrow branch is missing (the if condition only narrows, never throws —
      would defeat the whole fix).
    stop_rule: |
      `grep -q "err.message.startsWith" edge-guard.cjs` → exit 0; `grep -q "catch (_)" edge-guard.cjs`
      → exit 1 (broad catch pattern removed); file still parses (`node -c edge-guard.cjs` or
      syntax check).
    verification_cmd: |
      grep -q "err.message.startsWith" super-gsd/scripts/lib/edge-guard.cjs && ! grep -qE "catch\s*\(\s*_\s*\)\s*\{" super-gsd/scripts/lib/edge-guard.cjs && node -e "require('./super-gsd/scripts/lib/edge-guard.cjs');console.log('PASS')"
    verification_gates:
      - "grep err.message.startsWith edge-guard.cjs → exit 0 (narrow-catch present)"
      - "! grep broad-catch pattern edge-guard.cjs → exit 0 (old code removed)"
      - "module still loads via require → exit 0 (no syntax break)"

  - id: 12-05-02
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/gates-registry.cjs
    input_contract: |
      12-CONTEXT.md D-17 (WR-02) — add JSDoc block above `let _cache = null` (currently
      line 23) warning that the cache is a process singleton.
      12-RESEARCH.md §Q6 — exact insertion text:
      ```
      /**
       * WARNING — module-level cache is a PROCESS SINGLETON.
       * Tests MUST call resetCache() in afterEach() to avoid pollution.
       * Long-running processes that hot-swap gates.yaml MUST call resetCache()
       * after the file mtime changes (or after a SIGHUP equivalent).
       */
      let _cache = null; // { all: Gate[], byName: Record<string,Gate> }
      ```
      Existing style (confirmed via Read): the file already uses multi-line `/** */` JSDoc
      at lines 3-17 and 25-31 — the new block matches that convention.
    output_contract: |
      `super-gsd/scripts/lib/gates-registry.cjs` now has a JSDoc block (starting `/**`,
      ending `*/`) IMMEDIATELY ABOVE the `let _cache = null` declaration. The block
      contains the phrase `PROCESS SINGLETON` (capitalized per research guidance) and
      references `resetCache()` as the mitigation.
      Measurable invariants:
      - `grep -q "PROCESS SINGLETON" gates-registry.cjs` → exit 0
      - `grep -q "resetCache" gates-registry.cjs` still exits 0 (existing + new mention)
      - `let _cache` declaration unchanged
      - No existing functions modified; no new exports added
    hypothesis: |
      JSDoc-only fix with the exact text from research §Q6. Zero runtime impact. The
      `PROCESS SINGLETON` phrase is the measurable-green marker for Phase 12 verify.mjs
      invariant 10 (added in plan 12-04).
    falsifier: |
      (a) `grep -q "PROCESS SINGLETON" gates-registry.cjs` fails — JSDoc didn't land.
      (b) JSDoc block placed in the wrong location (not directly above `let _cache`).
      (c) `let _cache = null` declaration accidentally removed or changed.
      (d) Any export signature changed (loadGates/getGate/shouldFire/resetCache).
      (e) Module no longer parses via `require()`.
    stop_rule: |
      `grep -q "PROCESS SINGLETON" gates-registry.cjs` exit 0; `grep -q "let _cache = null"`
      exit 0; `node -e "require('./super-gsd/scripts/lib/gates-registry.cjs')"` exits 0.
    verification_cmd: |
      grep -q "PROCESS SINGLETON" super-gsd/scripts/lib/gates-registry.cjs && grep -q "let _cache = null" super-gsd/scripts/lib/gates-registry.cjs && node -e "const r=require('./super-gsd/scripts/lib/gates-registry.cjs');if(!r.loadGates||!r.getGate||!r.shouldFire||!r.resetCache){console.error('FAIL exports');process.exit(1);}console.log('PASS');"
    verification_gates:
      - "grep PROCESS SINGLETON gates-registry.cjs → exit 0 (JSDoc present)"
      - "grep let _cache = null → exit 0 (declaration preserved)"
      - "module loads + all 4 exports preserved → exit 0"

  - id: 12-05-03
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
      - .planning/phases/12-machinery/plans/12-05-SUMMARY.md
    input_contract: |
      12-CONTEXT.md D-18 (WR-03) — extend `code_files_changed_count` in SKILL.md Step 9.2
      filter to include `super-gsd/skills/*/SKILL.md` as code.
      Current filter (confirmed via Read at lines 729-734):
      ```
      code_files_changed_count: filesChanged.filter(f =>
        !f.endsWith('.md') && !f.startsWith('.planning/')
      ).length,
      ```
      12-RESEARCH.md §Q7 — exact fix:
      ```
      code_files_changed_count: filesChanged.filter(f => {
        if (f.startsWith('.planning/')) return false;
        if (/^super-gsd\/skills\/[^/]+\/SKILL\.md$/.test(f)) return true;
        if (f.endsWith('.md')) return false;
        return true;
      }).length,
      ```
      The regex `^super-gsd/skills/[^/]+/SKILL\.md$` pins to exactly the skill-file pattern
      (not other .md files under the subtree). Cross-platform: git diff paths use
      forward-slash on all hosts.
      Produce 12-05-SUMMARY.md at plan close.
    output_contract: |
      `super-gsd/skills/sgsd-orchestrate/SKILL.md` at Step 9.2 (lines 729-734 area) now
      implements the narrow filter per §Q7. The filter body is multi-statement (explicit
      returns) rather than the old one-liner. All other fields in the dispatch-context
      object (files_changed_count, diff_lines) unchanged.
      Measurable invariants:
      - `grep -q "super-gsd/skills" SKILL.md` → exit 0 (filter regex present inline)
      - `grep -q "code_files_changed_count" SKILL.md` → exit 0 (context-field name intact)
      - `grep -q "SKILL\.md" SKILL.md` → exit 0 (regex literal present — distinct from
        ambient self-mentions via the backslash)
      `.planning/phases/12-machinery/plans/12-05-SUMMARY.md` records ERG-01 closure:
      WR-01 (edge-guard narrow catch) + WR-02 (gates-registry JSDoc) + WR-03 (SKILL.md
      filter) all landed. Commit SHAs + handoff note "Wave 1 parallel plan 12-05 complete;
      plans 12-01 and 12-06 also in Wave 1."
    hypothesis: |
      The regex `^super-gsd/skills/[^/]+/SKILL\.md$` matches ONLY the skill-file pattern
      (one directory deep under super-gsd/skills/, exactly named SKILL.md). Other .md
      files (READMEs, plan summaries) remain excluded. Cross-platform safe because git
      diff emits forward-slash paths universally (research §Q7 verified). The narrow
      filter means a SKILL.md-only commit now correctly triggers per-dispatch ATC.
    falsifier: |
      (a) Filter excludes SKILL.md (e.g., filter body unchanged or only excludes
      `.planning/` — would leave WR-03 unfixed).
      (b) Filter INCLUDES all .md files (over-correction — plan summaries / READMEs
      would wrongly count as code).
      (c) Regex uses substring match (`.includes('super-gsd/skills/')`) instead of the
      anchored pattern — would false-positive on any .md file in the skill subtree.
      (d) `code_files_changed_count` field removed or renamed (breaks dispatch context).
      (e) 12-05-SUMMARY.md absent or doesn't record all 3 ERG-01 fixes.
    stop_rule: |
      Three greppable markers present in SKILL.md; filter is multi-statement (not
      one-liner); SUMMARY records all 3 ERG-01 fix landings.
    verification_cmd: |
      grep -q "super-gsd/skills" super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q "code_files_changed_count" super-gsd/skills/sgsd-orchestrate/SKILL.md && test -f .planning/phases/12-machinery/plans/12-05-SUMMARY.md && grep -q "WR-01" .planning/phases/12-machinery/plans/12-05-SUMMARY.md && grep -q "WR-02" .planning/phases/12-machinery/plans/12-05-SUMMARY.md && grep -q "WR-03" .planning/phases/12-machinery/plans/12-05-SUMMARY.md
    verification_gates:
      - "grep super-gsd/skills SKILL.md → exit 0 (regex present)"
      - "grep code_files_changed_count SKILL.md → exit 0 (field preserved)"
      - "12-05-SUMMARY.md exists → exit 0"
      - "SUMMARY records all 3 WR fixes (WR-01, WR-02, WR-03) → grep exit 0"
    depends_on: [12-05-01, 12-05-02]

must_haves:
  truths:
    - "`super-gsd/scripts/lib/edge-guard.cjs` catch block (prev line 83) now narrow-filters via `err.message.startsWith(\"gate '\")`; non-matching errors rethrow so ENOENT/parse bugs surface (WR-01 / D-16)"
    - "`super-gsd/scripts/lib/gates-registry.cjs` has a JSDoc block immediately above `let _cache = null` containing `PROCESS SINGLETON` and referencing `resetCache()` (WR-02 / D-17)"
    - "`super-gsd/skills/sgsd-orchestrate/SKILL.md` Step 9.2 filter for `code_files_changed_count` now includes `super-gsd/skills/*/SKILL.md` via the anchored regex (WR-03 / D-18)"
    - "All 3 changes preserve existing exports, function signatures, and field names (no downstream contract drift)"
    - "Module loads still pass: `require('./edge-guard.cjs')`, `require('./gates-registry.cjs')` both succeed"
    - "`gates-registry.cjs` still exports `{loadGates, getGate, shouldFire, resetCache}` (all 4)"
    - "12-05-SUMMARY.md records all 3 ERG-01 fixes (WR-01, WR-02, WR-03) and notes Wave 1 parallel peers (12-01, 12-06)"
  artifacts:
    - path: "super-gsd/scripts/lib/edge-guard.cjs"
      provides: "WR-01 fix — narrow catch with string-prefix discriminator; rethrows non-gate-not-found errors"
      contains: "catch (err) block with `if (!err.message.startsWith(\"gate '\")) throw err;`"
    - path: "super-gsd/scripts/lib/gates-registry.cjs"
      provides: "WR-02 fix — JSDoc warning about PROCESS SINGLETON cache and resetCache() mitigation"
      contains: "multi-line /** */ JSDoc block directly above `let _cache = null` containing `PROCESS SINGLETON` phrase"
    - path: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      provides: "WR-03 fix — code_files_changed_count filter narrowed so skill-SKILL.md files count as code"
      contains: "multi-statement filter with anchored regex `^super-gsd/skills/[^/]+/SKILL\\.md$`"
    - path: ".planning/phases/12-machinery/plans/12-05-SUMMARY.md"
      provides: "Plan close: ERG-01 3-warning closure + commit SHAs + Wave 1 peer note"
      contains: "sections ERG-01 Fixes (WR-01/02/03), Artifacts, Commit SHAs, Wave 1 Peers"
  key_links:
    - from: "super-gsd/scripts/lib/edge-guard.cjs"
      to: "super-gsd/scripts/lib/gates-registry.cjs"
      via: "catch block discriminates on `gate '...` prefix thrown at gates-registry.cjs:62"
      pattern: "err.message.startsWith\\(\"gate '\"\\)"
    - from: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      to: "per-dispatch-ATC gate (gates.yaml)"
      via: "code_files_changed_count feeds the ATC trigger clause; SKILL.md-only commits now fire ATC"
      pattern: "code_files_changed_count"
---

# Plan 12-05: ERG-01 Phase 10 ATC Warnings (WR-01/02/03)

## Objective

Close the three ATC warnings from Phase 10's review (10-ATC-REVIEW.md): narrow the
edge-guard catch block (WR-01), document the gates-registry cache as a process singleton
(WR-02), and extend the SKILL.md dispatch-context filter so SKILL.md commits count as
code (WR-03). Pure surgical edits — all three fixes are cited verbatim in 12-RESEARCH.md
§Q5/Q6/Q7 with file:line anchors.

Purpose: Satisfies **ERG-01** per D-16..D-18. Wave 1 of phase 12 — parallel with plans
12-01 and 12-06 (verified disjoint file sets per 12-RESEARCH.md §Recommended Plan
Decomposition: 12-01 edits SKILL.md Step 2, this plan edits Step 9.2, 12-06 touches no
SKILL.md).

Output: 3 existing files edited + 1 SUMMARY. Wave 1 — no dependencies.

## Tasks

Task breakdown follows 12-VALIDATION.md (3 tasks: 12-05-01, 12-05-02, 12-05-03).

### 12-05-01 — WR-01 narrow edge-guard catch (D-16)

Edit `super-gsd/scripts/lib/edge-guard.cjs` at line 83 to replace the broad `catch (_)`
with `catch (err) { if (!err.message.startsWith("gate '")) throw err; }` per
12-RESEARCH.md §Q5. Preserves log-only default for "gate not in registry" but surfaces
ENOENT / YAML parse errors that were silently swallowed.

### 12-05-02 — WR-02 gates-registry JSDoc (D-17)

Insert the JSDoc block from 12-RESEARCH.md §Q6 directly above `let _cache = null`
(currently line 23) in `super-gsd/scripts/lib/gates-registry.cjs`. Block contains the
capitalized phrase `PROCESS SINGLETON` and references `resetCache()` as the mitigation.
Style matches existing JSDoc at lines 3-17 and 25-31.

### 12-05-03 — WR-03 SKILL.md skill-file-as-code filter (D-18) + SUMMARY

Replace the one-liner filter in SKILL.md Step 9.2 (`code_files_changed_count`, lines
729-734) with the multi-statement version from 12-RESEARCH.md §Q7. Anchored regex
`^super-gsd/skills/[^/]+/SKILL\.md$` captures only the skill-file pattern. Produce
12-05-SUMMARY.md recording all 3 ERG-01 fix landings.

## Verification Gates (Wave close)

1. `grep -q "err.message.startsWith" edge-guard.cjs` → exit 0 (WR-01 landed)
2. `! grep -qE "catch\\s*\\(\\s*_\\s*\\)\\s*\\{" edge-guard.cjs` → exit 0 (broad catch removed)
3. `node -e "require('./super-gsd/scripts/lib/edge-guard.cjs')"` → exit 0 (still loads)
4. `grep -q "PROCESS SINGLETON" gates-registry.cjs` → exit 0 (WR-02 landed)
5. `grep -q "let _cache = null" gates-registry.cjs` → exit 0 (declaration preserved)
6. `node -e "require('./super-gsd/scripts/lib/gates-registry.cjs')"` + all 4 exports present → exit 0
7. `grep -q "super-gsd/skills" SKILL.md` → exit 0 (WR-03 regex present)
8. `grep -q "code_files_changed_count" SKILL.md` → exit 0 (field preserved)
9. `test -f 12-05-SUMMARY.md` + records all 3 WR fixes → exit 0

## Success Criteria

- All 3 WR fixes landed with exact text from research §Q5/Q6/Q7.
- No exports, function signatures, or field names changed (regression-free).
- Both `.cjs` modules still require-loadable.
- 12-05-SUMMARY.md records all 3 fixes + commit SHAs + Wave 1 peer references.

## Output

`12-05-SUMMARY.md` with sections: ERG-01 Fixes (bullet per WR-XX with file:line before/
after), Artifacts (3 edited files + SUMMARY), Commit SHAs (one per 12-05-0N task),
Wave 1 Peers (note that 12-01 and 12-06 also landed in Wave 1 parallel).
