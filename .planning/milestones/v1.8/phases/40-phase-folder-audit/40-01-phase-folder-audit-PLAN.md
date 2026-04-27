---
schema_version: 2
phase: 40
plan: 01
title: Phase Folder Perfection Contract
milestone: v1.8
type: execute
wave: 1
depends_on: [39]
files_modified:
  - super-gsd/tools/phase-folder-audit/audit.cjs
  - super-gsd/tools/phase-folder-audit/audit.test.cjs
  - super-gsd/skills/sgsd-complete-milestone/SKILL.md
autonomous: true
atc_tier: FULL
locked_decisions:
  - "40=B (mass-discuss:217): required + recommended file checks; NO content schema; soft-warn ONLY; NO folder modification"
requirements:
  - AUDIT-01
  - AUDIT-02
  - AUDIT-03
  - AUDIT-04
  - AUDIT-05
research_ref: ".planning/milestones/v1.8/phases/40-phase-folder-audit/40-RESEARCH.md"
context_ref: ".planning/milestones/v1.8/phases/40-phase-folder-audit/40-CONTEXT.md"
mirror_template: "super-gsd/tools/gate-keep-kill/rubric.cjs (Phase 39 1:1 architectural template)"
controlling_principle: "Autonomy continues; evidence tells the truth."
must_haves:
  truths:
    - "Operator can run `node super-gsd/tools/phase-folder-audit/audit.cjs --self-test` and see 12+ assertions pass exit 0"
    - "Operator can run `node super-gsd/tools/phase-folder-audit/audit.cjs --render --milestone v1.8` and see a markdown verdict table on stdout, exit 0"
    - "Running --render NEVER mutates any phase folder (fingerprint guard binding for AUDIT-04)"
    - "sgsd-complete-milestone Step 4.6 invokes auditAllPhases at milestone close and writes phase-folder-audit.md (AUDIT-05 grep binding)"
    - "Every phase folder gets a verdict in the closed enum {compliant, partial, non-compliant} (AUDIT-02 binding)"
    - "Soft-warn semantics enforced: render exits 0 even when verdicts include non-compliant rows (AUDIT-03 binding)"
  artifacts:
    - path: "super-gsd/tools/phase-folder-audit/audit.cjs"
      provides: "auditFolder, auditAllPhases, renderTable + 3 frozen constants"
      min_lines: 600
    - path: "super-gsd/tools/phase-folder-audit/audit.test.cjs"
      provides: "deterministic local fixture suite (4 fixtures: compliant/partial/non-compliant/empty)"
      min_lines: 100
    - path: "super-gsd/skills/sgsd-complete-milestone/SKILL.md"
      provides: "Step 4.6 wire-in (between Step 4.5 and Step 5) + Step 6 SUMMARY.md subsection extension"
      contains: "auditAllPhases"
  key_links:
    - from: "super-gsd/skills/sgsd-complete-milestone/SKILL.md Step 4.6"
      to: "super-gsd/tools/phase-folder-audit/audit.cjs"
      via: "require(path.join(process.cwd(), 'super-gsd', 'tools', 'phase-folder-audit', 'audit.cjs'))"
      pattern: "auditAllPhases"
    - from: "super-gsd/skills/sgsd-complete-milestone/SKILL.md Step 6"
      to: ".planning/milestones/{{version}}/phase-folder-audit.md"
      via: "fs.readFileSync of audit output"
      pattern: "phase-folder-audit\\.md"
    - from: "audit.cjs --self-test"
      to: ".planning/milestones/v1.7/phases/31-canonical-envelope/ + 35-generated-system-map/ + v1.6/phases/26-cockpit-question-contract/"
      via: "_fingerprintDir before/after deep-equal guard"
      pattern: "_fingerprintDir"
---

<objective>
Final v1.8 phase. Ship a soft-warn-only phase folder auditor that walks every
`.planning/milestones/{*}/phases/{*}/` directory, classifies each as
compliant / partial / non-compliant against the 4-required + 4-recommended
canonical file template, and is wired into `sgsd-complete-milestone` Step 4.6
so milestone close emits `.planning/milestones/{{version}}/phase-folder-audit.md`.

Architectural mirror: 1:1 with Phase 39 (`super-gsd/tools/gate-keep-kill/rubric.cjs`).
Same banner discipline, same frozen-constants pattern, same
`__dirname`-anchored path resolution, same `--self-test` fingerprint guard,
same try/catch failure contract (never throws upward).

Locked decision 40=B (mass-discuss line 217): required + recommended file
checks; NO content schema; soft-warn ONLY; the auditor NEVER mutates any
phase folder. AUDIT-04 is the load-bearing safety contract; the self-test
fingerprint guard binds it at runtime.

Purpose: catches incomplete deliverables across the SGSD planning corpus
without becoming auditor-creep. Reports the verdict; operator decides
remediation. Evidence tells the truth.

Output:
- `super-gsd/tools/phase-folder-audit/audit.cjs` (NEW, ~600-700 LOC)
- `super-gsd/tools/phase-folder-audit/audit.test.cjs` (NEW, ~120 LOC)
- `super-gsd/skills/sgsd-complete-milestone/SKILL.md` (EDIT, ~30 line Step 4.6 insertion + ~10 line Step 6 subsection)

Three atomic commits, ASCII-only, zero new dependencies.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP-AGENT.md
@.planning/milestones/v1.8/REQUIREMENTS.md
@.planning/milestones/v1.8/phases/40-phase-folder-audit/40-CONTEXT.md
@.planning/milestones/v1.8/phases/40-phase-folder-audit/40-RESEARCH.md
@super-gsd/tools/gate-keep-kill/rubric.cjs
@super-gsd/skills/sgsd-complete-milestone/SKILL.md

<interfaces>
<!-- Phase 39 mirror source (rubric.cjs). Executor implements audit.cjs by mirroring this 1:1. -->

From super-gsd/tools/gate-keep-kill/rubric.cjs (architectural template):
- Banner block: 1-42 (purpose, source-of-truth citation, failure contract,
  controlling correctness rule, lock citation, acceptance bindings,
  fingerprint guard list, zero-deps lock).
- Frozen constants: 49-76 (VERDICTS = Object.freeze([...]) + KEEP_THRESHOLDS
  + REASONS).
- Private helpers: 82-184 (`_readGatesYaml`, `_parseGatesYaml`,
  `_filterReviewRowsForGate`, `_computePassRate`, `_computeNotes`).
- Public pure function: 204-308 (`classifyGate` -- mirror as `auditFolder`).
- Public composer: 320-384 (`runRubric` -- mirror as `auditAllPhases`).
- Public renderer: 402-428 (`renderTable` -- name preserved 1:1).
- Self-test: 433-614 (14 assertions + tmpdir + fingerprint guard).
- CLI main: 619-652 (--self-test / --render / --json / --help).
- module.exports: 654-663 (3 functions + 3 frozen constants).

From super-gsd/skills/sgsd-complete-milestone/SKILL.md:
- Lines 96-135: `<step_4_5_gate_keep_kill_rubric>` block (Phase 39 wire-in
  precedent; copy structure verbatim with name swaps).
- Line 137: `<step_5_cross_phase_check>` opening (Step 4.6 inserts BETWEEN
  these two markers).
- Lines 185-202: Step 6 Gate Keep/Kill subsection (Phase 39 SUMMARY.md
  embed precedent; mirror 1:1 with name swaps).

Frozen constants for audit.cjs (RESEARCH sec 1.4 verbatim):
```javascript
const VERDICTS = Object.freeze(['compliant', 'partial', 'non-compliant']);
const REQUIRED_FILES = Object.freeze([
  { kind: 'context',      matcher: { type: 'exact', name: '{NN}-CONTEXT.md' } },
  { kind: 'research',     matcher: { type: 'exact', name: '{NN}-RESEARCH.md' } },
  { kind: 'plan',         matcher: { type: 'glob',  pattern: '{NN}-*-PLAN.md', minCount: 1 } },
  { kind: 'verification', matcher: { type: 'exact', name: '{NN}-VERIFICATION.md' } },
]);
const RECOMMENDED_FILES = Object.freeze([
  { kind: 'atc-review',     matcher: { type: 'exact', name: '{NN}-ATC-REVIEW.md' } },
  { kind: 'commit-reviews', matcher: { type: 'exact', name: 'commit-reviews.jsonl' } },
  { kind: 'codex-review',   matcher: { type: 'exact', name: '{NN}-codex-review.md' } },
  { kind: 'waste',          matcher: { type: 'exact', name: 'WASTE.md' } },
]);
```

Closed-enum bucket logic (RESEARCH sec 2.1, pure function, no I/O):
```javascript
function categorize(required_missing, recommended_missing) {
  if (required_missing.length > 0) return 'non-compliant';
  if (recommended_missing.length > 0) return 'partial';
  return 'compliant';
}
```

Phase number derivation (RESEARCH Q1 lock): `^(\d{2})-` regex on folder
basename's leading numeric prefix. Non-matching folders skipped from
auditAllPhases discovery; auditFolder direct-call returns
phase_num=null verdict='non-compliant'.

Discovery rule (RESEARCH sec 4.2): walk
`<planningDir>/milestones/<v>/phases/<NN-name>/`. ALSO walk
`<planningDir>/phases/<NN-name>/` if exists (un-archived working dir,
`includeUnarchived` defaults true). Filter to `^\d{2}-` basenames.
Return sorted by full path codepoint order (deterministic).

Fingerprint guard targets (RESEARCH sec 6.2 exact paths):
- `<repoRoot>/.planning/milestones/v1.7/phases/31-canonical-envelope/`
- `<repoRoot>/.planning/milestones/v1.7/phases/35-generated-system-map/`
- `<repoRoot>/.planning/milestones/v1.6/phases/26-cockpit-question-contract/`
where `repoRoot = path.resolve(__dirname, '..', '..', '..')` because
audit.cjs lives at `<repo>/super-gsd/tools/phase-folder-audit/audit.cjs`
(3 dirs up to repo root).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 (A1): Build audit.cjs library + 12-assertion self-test (mirror Phase 39 1:1)</name>
  <files>super-gsd/tools/phase-folder-audit/audit.cjs</files>
  <behavior>
    Implements Phase 40 AUDIT-01..05 via the architectural mirror of
    super-gsd/tools/gate-keep-kill/rubric.cjs (Phase 39).

    Self-test must pass these 12 assertions in tmpdir + 1 fingerprint
    assertion = 13 total (covers AUDIT-01..04 binding):

    1. VERDICTS is Object.freeze, length 3, equals
       ['compliant','partial','non-compliant']; mutation throws.
    2. REQUIRED_FILES Object.freeze, length 4, kinds match RESEARCH 1.4
       (context, research, plan, verification).
    3. RECOMMENDED_FILES Object.freeze, length 4, kinds match RESEARCH 1.4
       (atc-review, commit-reviews, codex-review, waste).
    4. auditFolder over a fully-compliant tmpdir fixture (all 4 required +
       all 4 recommended files written) returns verdict='compliant',
       required_missing=[], recommended_missing=[], phase_num='40'.
    5. auditFolder over a fixture missing {NN}-CONTEXT.md returns
       verdict='non-compliant', required_missing=['40-CONTEXT.md'].
    6. auditFolder over a fixture with all 4 required but 0 recommended
       returns verdict='partial', recommended_missing has length 4.
    7. auditFolder over a no-leading-digit folder name (e.g. 'README')
       returns phase_num=null verdict='non-compliant' (per RESEARCH Q1).
    8. auditAllPhases over a tmpdir with 3 synthetic phase folders returns
       3 audits in deterministic codepoint sort order (by full path).
    9. auditAllPhases over a tmpdir with phases under TWO milestones
       respects opts.milestone filter (returns only the requested
       milestone's phase folders).
    10. renderTable over 3-row fixture returns markdown containing
        the locked column header, 3 phase rows, and the soft-warn footer
        '> Soft-warn only.' literal.
    11. renderTable([]) returns the exact literal
        '(no phase folders found for this milestone)' (RESEARCH Q12, NOT
        a thrown exception).
    12. auditFolder over a fixture with TWO matching {NN}-*-PLAN.md files
        (e.g. 40-01-PLAN.md AND 40-02-PLAN.md) returns verdict='compliant'
        (multi-PLAN allowed per RESEARCH 1.2 minCount=1, not maxCount=1).
    13. Fingerprint guard: capture _fingerprintDir(target) BEFORE the 12
        prior assertions for the 3 sample real phase folders. After the
        block, recompute and deep-equal-compare. ANY mtime/size/childset
        delta fails the assertion with detail
        'phase folder X mutated by audit run' -- this is the AUDIT-04
        binding. Skip-on-absent allowed (shallow clone) per RESEARCH
        sec 7.3.

    Output line: 'phase-folder-audit self-test: N pass, M fail'.
    Exit 0 = all pass; exit 1 = any fail.
  </behavior>
  <action>
Write `super-gsd/tools/phase-folder-audit/audit.cjs`. Mirror Phase 39
rubric.cjs file-structure 1:1. Target ~600-700 LOC. ASCII-only.

Section layout (RESEARCH sec 3.2 verbatim):

1. **Banner block** (RESEARCH sec 3.3 verbatim, ~25 lines, ASCII-only):
   ```
   // ============================================================================
   // SGSD - PHASE-FOLDER AUDIT (Phase 40 -- AUDIT-01..05)
   // ============================================================================
   // Walks .planning/milestones/{*}/phases/{*}/ AND .planning/phases/{*}/.
   // Verdict closed-enum: { compliant, partial, non-compliant }.
   //
   // Source: 40-RESEARCH.md sec 11 (LOCKED Q1-Q13) + 40-01-PLAN.md.
   //
   // Failure contract (mirrored from rubric.cjs:11-13 verbatim):
   //   "this script NEVER throws upward at the orchestrator boundary"
   // All public APIs (auditFolder, auditAllPhases, renderTable) wrap
   // internals in try/catch; on error stderr-warn + return falsey
   // (null, [], '(audit render error)').
   //
   // Locked decision 40=B (mass-discuss line 217 verbatim):
   //   "required + recommended file checks; no content schema --
   //    content validation is auditor-creep"
   // Soft-warn ONLY. The auditor NEVER mutates any phase folder.
   //
   // Read-only invariant (AUDIT-04, load-bearing safety contract):
   //   NEVER fs.write*/fs.append*/fs.unlink*/fs.rename*/fs.rmdir*/
   //   fs.copyFile*/fs.mkdir* against any phase-folder path.
   //   ONLY fs.write* permitted: tmpdir fixture writes during --self-test
   //   (matching fs.mkdtempSync output).
   //   Self-test fingerprint guards 3 sample real phase folders before/after.
   //
   // Acceptance bindings:
   //   AUDIT-01: auditAllPhases walks .planning/milestones/{*}/phases/{*}/
   //             AND .planning/phases/{*}/ (un-archived working dir).
   //   AUDIT-02: every folder gets verdict in
   //             {compliant, partial, non-compliant}.
   //   AUDIT-03: --render exits 0 even when partial/non-compliant rows
   //             present; per-phase missing-file list rendered.
   //   AUDIT-04: self-test fingerprint guard (assertion 13) binds runtime.
   //   AUDIT-05: SKILL.md Step 4.6 grep for `auditAllPhases` returns >= 1.
   //
   // Mirror discipline (RESEARCH sec 10): 1:1 with Phase 35 system-map.cjs +
   // Phase 39 rubric.cjs. Same path-resolution pattern (__dirname-anchored,
   // NEVER process.cwd() default; Phase 36 W2 lesson + Phase 39 W2 lesson).
   //
   // Zero external dependencies. Node built-ins only (fs / path / os).
   // ASCII-only (Phase 39 W4 lesson: no em dashes, no smart quotes).
   // ============================================================================
   ```

2. **Imports**: `const fs = require('fs'); const path = require('path');
   const os = require('os');` -- nothing else (zero deps).

3. **FROZEN CONSTANTS** (RESEARCH sec 1.4 verbatim):
   ```javascript
   const VERDICTS = Object.freeze(['compliant', 'partial', 'non-compliant']);
   const REQUIRED_FILES = Object.freeze([
     { kind: 'context',      matcher: { type: 'exact', name: '{NN}-CONTEXT.md' } },
     { kind: 'research',     matcher: { type: 'exact', name: '{NN}-RESEARCH.md' } },
     { kind: 'plan',         matcher: { type: 'glob',  pattern: '{NN}-*-PLAN.md', minCount: 1 } },
     { kind: 'verification', matcher: { type: 'exact', name: '{NN}-VERIFICATION.md' } },
   ]);
   const RECOMMENDED_FILES = Object.freeze([
     { kind: 'atc-review',     matcher: { type: 'exact', name: '{NN}-ATC-REVIEW.md' } },
     { kind: 'commit-reviews', matcher: { type: 'exact', name: 'commit-reviews.jsonl' } },
     { kind: 'codex-review',   matcher: { type: 'exact', name: '{NN}-codex-review.md' } },
     { kind: 'waste',          matcher: { type: 'exact', name: 'WASTE.md' } },
   ]);
   ```

4. **Private helpers**:
   - `_phaseNumberFromFolderName(name)`: returns 2-digit string from
     `^(\d{2})-` regex match, or `null`. Pure.
   - `_expandMatcher(matcher, phaseNum)`: takes a frozen matcher and the
     2-digit phase number; returns either a literal basename (for
     `type:'exact'`) or a regex (for `type:'glob'`). Replaces `{NN}` with
     the phase number; converts `*` glob to `.*` regex segment for glob
     matchers; escapes other regex metachars in literal portions.
   - `_checkFile(folderEntries, matcher, phaseNum)`: returns
     `{ present: bool, basenames: string[] }`. For `type:'exact'`, returns
     present iff basename in folderEntries. For `type:'glob'` with
     `minCount`, returns present iff count of matches in folderEntries
     >= minCount; basenames lists matches.
   - `_listPhaseFolders(planningDir, opts)`: discovery helper.
     - Build candidate list: walks `<planningDir>/milestones/<v>/phases/`
       across all milestone subdirs (or just `opts.milestone` if set),
       AND `<planningDir>/phases/` if `includeUnarchived` (default true)
       and the dir exists.
     - For each candidate parent, `fs.readdirSync` to enumerate children;
       `fs.statSync` to filter to directories; basename regex filter
       `^\d{2}-`.
     - Returns array of absolute paths sorted by full path codepoint order.
     - Try/catch on every fs call; on error return [] (never throws).
   - `_fingerprintDir(dir)` (RESEARCH sec 6.2 verbatim):
     ```javascript
     function _fingerprintDir(dir) {
       if (!fs.existsSync(dir)) return { exists: false };
       return {
         exists: true,
         children: fs.readdirSync(dir).sort().map(name => {
           const p = path.join(dir, name);
           const st = fs.statSync(p);
           return { name, mtime: st.mtimeMs, size: st.size, isDir: st.isDirectory() };
         }),
       };
     }
     ```

5. **Public function `auditFolder(phaseDir)`** (RESEARCH sec 4.1):
   - Wrap entire body in try/catch; on error log via console.warn and
     return null.
   - Resolve `phaseDir` to absolute path via `path.resolve(phaseDir)`.
   - Compute `folderName = path.basename(phaseDir)`.
   - Compute `phaseNum = _phaseNumberFromFolderName(folderName)`.
   - If folder does not exist, return shape with all required missing
     and verdict='non-compliant'.
   - Read directory entries via `fs.readdirSync(phaseDir)` (NEVER
     readFileSync on phase content -- 40=B forbids).
   - For each entry in REQUIRED_FILES: call `_checkFile`. Collect
     present-basenames into `required_present`; failures into
     `required_missing` (using `_expandMatcher`'s expanded basename for
     readable rendering, e.g. '40-CONTEXT.md').
   - Same for RECOMMENDED_FILES.
   - Compute `verdict` via the closed-enum bucket logic
     (RESEARCH sec 2.1):
     `if (required_missing.length) return 'non-compliant';
      if (recommended_missing.length) return 'partial';
      return 'compliant';`
   - Return:
     ```javascript
     { phase_dir: phaseDir, phase_num: phaseNum, folder_name: folderName,
       verdict, required_present, required_missing,
       recommended_present, recommended_missing }
     ```
   - When `phaseNum === null`, force verdict='non-compliant' and use
     literal pattern strings (e.g. '{NN}-CONTEXT.md') in missing arrays.

6. **Public function `auditAllPhases(planningDir, opts)`** (RESEARCH sec 4.2):
   - Wrap body in try/catch; on error log + return [].
   - Defaults: `opts = opts || {}`; `includeUnarchived = opts.includeUnarchived !== false`
     (default true).
   - Resolve `planningDir` to absolute path via `path.resolve(planningDir)`.
   - Call `_listPhaseFolders(planningDir, { milestone: opts.milestone, includeUnarchived })`.
   - Map each folder path through `auditFolder`. Filter out null.
   - Return resulting array (already sorted by `_listPhaseFolders`).

7. **Public function `renderTable(audits)`** (RESEARCH sec 4.3):
   - Wrap body in try/catch; on error return `'(audit render error)'`.
   - If `!Array.isArray(audits) || audits.length === 0` return literal
     `'(no phase folders found for this milestone)\n'` (RESEARCH Q12).
   - Build markdown:
     - Summary table with verdict counts (compliant / partial / non-compliant).
     - Per-phase verdict table with locked column order:
       `| phase | folder | verdict | required missing | recommended missing |`
     - Verdict cell: `**non-compliant**` (bold), plain `compliant`,
       `*partial*` (italic) -- mirrors rubric.cjs:410-413.
     - Missing cells: comma-joined basenames or `--` literal when empty.
     - Footer: `> Soft-warn only. Locked: 40=B. Auditor never modifies phase folders.`

8. **Self-test (`selfTest()` function)** (RESEARCH sec 7, ~150 LOC):
   Implements all 13 assertions per the Behavior block. Mirror Phase 39
   rubric.cjs:433-614 line-by-line:
   - Capture canonical fingerprint BEFORE any work. Anchor:
     `const repoRoot = path.resolve(__dirname, '..', '..', '..');`
     audit.cjs lives at `<repo>/super-gsd/tools/phase-folder-audit/audit.cjs`,
     so 3 dirs up = repo root.
   - Sample folders array (RESEARCH sec 6.2 exact paths):
     ```javascript
     const samplePhaseFolders = [
       path.join(repoRoot, '.planning', 'milestones', 'v1.7', 'phases', '31-canonical-envelope'),
       path.join(repoRoot, '.planning', 'milestones', 'v1.7', 'phases', '35-generated-system-map'),
       path.join(repoRoot, '.planning', 'milestones', 'v1.6', 'phases', '26-cockpit-question-contract'),
     ];
     const before = samplePhaseFolders.map(_fingerprintDir);
     ```
   - `tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-'))` for fixtures.
   - Build fixtures inside `tmp` for assertions 4-9 + 12 by `fs.mkdirSync`
     + `fs.writeFileSync` of empty 'placeholder' content
     (writes are tmpdir-only, never touch any phase folder).
   - Run all 12 logical assertions; collect pass/fail with optional
     `detail` on failure.
   - Recompute `after = samplePhaseFolders.map(_fingerprintDir);` and
     deep-equal-compare each entry. Skip-on-absent: when
     `before[i].exists === false && after[i].exists === false`, treat as
     ok and emit warn `live fixture <X> absent; skipping`.
   - Cleanup in `finally{}`:
     `fs.rmSync(tmp, { recursive: true, force: true });`
   - Print `phase-folder-audit self-test: N pass, M fail`.
   - Print failure detail lines on stderr when fail count > 0.
   - Return exit code (0 / 1).

9. **CLI main block**:
   ```javascript
   if (require.main === module) {
     const cmd = process.argv[2];
     if (cmd === '--self-test') process.exit(selfTest());
     if (cmd === '--render' || cmd === '--json') {
       // Phase 36 W2 + Phase 39 W2 lesson:
       // NEVER process.cwd() default -- silent wrong-tree trap.
       // audit.cjs at <repo>/super-gsd/tools/phase-folder-audit/audit.cjs;
       // canonical .planning at <repo>/.planning (3 dirs up).
       const idx = process.argv.indexOf('--planning-dir');
       const planningDir = (idx > 0 && process.argv[idx + 1])
         ? path.resolve(process.argv[idx + 1])
         : path.resolve(__dirname, '..', '..', '..', '.planning');
       const mIdx = process.argv.indexOf('--milestone');
       const opts = {};
       if (mIdx > 0 && process.argv[mIdx + 1]) opts.milestone = process.argv[mIdx + 1];
       const audits = auditAllPhases(planningDir, opts);
       if (cmd === '--render') console.log(renderTable(audits));
       else console.log(JSON.stringify(audits, null, 2));
       process.exit(0);  // AUDIT-03: exit 0 ALWAYS on render, never block.
     }
     // --help fallthrough
     console.log('Usage:');
     console.log('  node audit.cjs --self-test');
     console.log('  node audit.cjs --render [--milestone <v>] [--planning-dir <p>]');
     console.log('  node audit.cjs --json   [--milestone <v>] [--planning-dir <p>]');
     console.log('  Or require() and call auditFolder / auditAllPhases / renderTable');
     console.log('  VERDICTS =', JSON.stringify(VERDICTS));
     process.exit(0);
   }
   ```

10. **module.exports** (6 names, RESEARCH sec 4.4):
    ```javascript
    module.exports = {
      auditFolder, auditAllPhases, renderTable,
      VERDICTS, REQUIRED_FILES, RECOMMENDED_FILES,
    };
    ```

**Banned patterns** (verifier-checked grep, AUDIT-04 binding):
- ZERO `fs.writeFile` outside the `selfTest()` function body (the only
  legitimate writes are to `tmp = fs.mkdtempSync(...)` paths).
- ZERO `fs.appendFile` / `fs.unlink` / `fs.rename` / `fs.rmdir` /
  `fs.copyFile` ANYWHERE in the file outside selfTest cleanup
  `fs.rmSync(tmp, ...)`.
- ZERO `fs.readFileSync` against phase-folder paths (40=B forbids content
  inspection); only directory listings (`fs.readdirSync`) and stat
  (`fs.statSync` / `fs.existsSync`).
- ZERO non-ASCII bytes (Phase 39 W4 lesson: no em dashes, smart quotes,
  non-breaking spaces). Banner uses '--' (two ASCII hyphens), not the unicode em dash (U+2014).
- NO `process.cwd()` default for `planningDir`. Always `__dirname`-anchored
  (Phase 36 W2 + Phase 39 W2 lessons).
- NO new package dependencies. Node built-ins only.

**Mirror self-check** (plan-checker greps, RESEARCH sec 10.3):
- `path.resolve(__dirname` >= 2 occurrences.
- `Object.freeze(` >= 3 occurrences.
- `fs.mkdtempSync` exactly 1 (in selfTest).
- `try {` and `catch ` each >= 4 (auditFolder, auditAllPhases,
  renderTable, _listPhaseFolders).
- `module.exports = {` block exposes 6 names.

**ATC tier**: FULL (~600-700 LOC + new file).
  </action>
  <verify>
    <automated>node super-gsd/tools/phase-folder-audit/audit.cjs --self-test</automated>
    Expected stdout last line: `phase-folder-audit self-test: 13 pass, 0 fail`.
    Expected exit code: 0.

    Additional spot greps the verifier MUST run:
    - `grep -c "Object.freeze" super-gsd/tools/phase-folder-audit/audit.cjs` -> >= 3.
    - `grep -c "path.resolve(__dirname" super-gsd/tools/phase-folder-audit/audit.cjs` -> >= 2.
    - `grep -c "fs.mkdtempSync" super-gsd/tools/phase-folder-audit/audit.cjs` -> exactly 1.
    - `grep -c "process.cwd" super-gsd/tools/phase-folder-audit/audit.cjs` -> 0.
    - ASCII-only check via Node:
      ```
      node -e "
      const buf = require('fs').readFileSync('super-gsd/tools/phase-folder-audit/audit.cjs');
      let n = 0; for (let i = 0; i < buf.length; i++) if (buf[i] > 127) n++;
      if (n > 0) { console.error('FAIL non-ASCII:', n); process.exit(1); }
      console.log('PASS ASCII-only');
      "
      ```
  </verify>
  <done>
    - File `super-gsd/tools/phase-folder-audit/audit.cjs` exists, ~600-700 LOC.
    - `node audit.cjs --self-test` -> `13 pass, 0 fail`, exit 0.
    - All 5 mirror-self-check greps pass.
    - Zero non-ASCII bytes.
    - `git status` shows ONLY this file as added; no phase folder mutations.
    - Atomic commit created: `feat(40-01): audit.cjs lib + 12-assertion self-test`.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2 (A2): Wire auditAllPhases into sgsd-complete-milestone Step 4.6 + Step 6 SUMMARY embed</name>
  <files>super-gsd/skills/sgsd-complete-milestone/SKILL.md</files>
  <action>
Edit `super-gsd/skills/sgsd-complete-milestone/SKILL.md`. Two insertions,
both mirroring the Phase 39 wire-in pattern (lines 96-135 + 185-202)
verbatim with name swaps. ASCII-only (no em dashes anywhere; reuse the
plain '--' or just nothing where the existing Step 4.5 has em dashes is
not relevant -- match existing style of THIS file at the insertion sites).

**Insertion #1 (Step 4.6 block, AUDIT-05 binding)**:

Locate line 135 in current SKILL.md: `</step_4_5_gate_keep_kill_rubric>`.
Locate line 137: `<step_5_cross_phase_check>`.
Insert the following block on line 136 (between them), so file structure
becomes ...4.5 close, 4.6 open, 4.6 body, 4.6 close, 5 open...:

```markdown
<step_4_6_phase_folder_audit>
## Step 4.6: Phase Folder Audit (Phase 40 -- AUDIT-01..05)

Walk every phase folder for milestone {{version}} and emit a soft-warn-only
audit recording required + recommended file presence. Per lock 40=B:
records the verdict table; operator decides whether to backfill missing
files. Read-only -- the auditor NEVER mutates any phase folder.

```javascript
// Phase 40 wire-in: anchor planningDir to process.cwd() at the
// orchestrator-skill boundary (mirrors Step 4.5 Phase 39 ATC W3 fix;
// Phase 36 W2 + Phase 39 W2 lessons: NEVER bare relative '.planning').
const path = require('path');
const fs   = require('fs');
const { auditAllPhases, renderTable } = require(
  path.join(process.cwd(), 'super-gsd', 'tools', 'phase-folder-audit', 'audit.cjs')
);
const planningDir = path.join(process.cwd(), '.planning');
const audits = auditAllPhases(planningDir, { milestone: '{{version}}' });
const md     = renderTable(audits);
fs.writeFileSync(
  path.join(planningDir, 'milestones', '{{version}}', 'phase-folder-audit.md'),
  '# Phase Folder Audit (milestone {{version}})\n\n' +
  '> Soft-warn only. Locked decision 40=B: required + recommended\n' +
  '> file checks; no content schema; no folder modification.\n\n' +
  md + '\n', 'utf8');
```

Per lock 40=B: this step ONLY produces the verdict table. The script
NEVER mutates any phase folder. Self-test fingerprint guard
(audit.cjs assertion 13) binds the read-only invariant.

Defer-on-empty: if `auditAllPhases` returns `[]`, the rendered table reads
`(no phase folders found for this milestone)` and Step 6 references that
file as-is. Soft-warn semantics never block close.
</step_4_6_phase_folder_audit>
```

(Use the literal triple-backtick fences shown above; mirror the Phase 39
Step 4.5 markdown formatting verbatim.)

**Insertion #2 (Step 6 SUMMARY.md subsection, RESEARCH sec 5.3)**:

Locate the existing line in Step 6 (around current line 198):
`{{contents of .planning/milestones/{{version}}/gate-keep-kill.md}}`
followed by closing block markers. After that subsection ends and BEFORE
the next subsection (`<step_7_vtp_bidirectional>` on the original line 205
of the current file, which becomes line ~210 after Insertion #1 shifts
content down by ~30 lines), append a new subsection:

```markdown
### Phase Folder Audit subsection (Phase 40 -- AUDIT-05)

Append to SUMMARY.md a new subsection AFTER `## Gate Keep/Kill Rubric` and
BEFORE the existing `## Connections` section. Source: read the file
`.planning/milestones/{{version}}/phase-folder-audit.md` produced by
Step 4.6; embed its contents inline:

```markdown
## Phase Folder Audit (milestone {{version}})

> Soft-warn only. Per lock 40=B.

{{contents of .planning/milestones/{{version}}/phase-folder-audit.md}}
```

If `.planning/milestones/{{version}}/phase-folder-audit.md` does not exist
(Step 4.6 failed), write the literal line:
`(phase-folder audit unavailable -- see audit-skipped log)`.
```

(Place this subsection inside the existing `<step_6_summary>...</step_6_summary>`
block, AFTER the existing `### Gate Keep/Kill Rubric subsection` and BEFORE
the closing `</step_6_summary>` tag.)

**ASCII-only**: every '--' MUST be two ASCII hyphens. NO em dashes (no
unicode `U+2014 em dash`), no smart quotes, no non-breaking spaces. The existing Step 4.5
text DOES contain em dashes -- DO NOT introduce any new em dashes in the
Step 4.6 / Step 6 phase-folder text.

**Wire-in citation discipline** (verifier-friendly greps, AUDIT-05 binding):
- `grep -n "auditAllPhases" super-gsd/skills/sgsd-complete-milestone/SKILL.md` -> >= 1.
- `grep -n "phase-folder-audit.md" super-gsd/skills/sgsd-complete-milestone/SKILL.md` -> >= 2 (Step 4.6 write + Step 6 read).
- `grep -n "<step_4_6_phase_folder_audit>" super-gsd/skills/sgsd-complete-milestone/SKILL.md` -> exactly 1 (open tag).
- `grep -n "</step_4_6_phase_folder_audit>" super-gsd/skills/sgsd-complete-milestone/SKILL.md` -> exactly 1 (close tag).
- `grep -n "Phase Folder Audit (milestone" super-gsd/skills/sgsd-complete-milestone/SKILL.md` -> >= 1.

**Banned patterns**:
- NO `process.cwd()` removed (the wire-in MUST use it -- Phase 36 W2 +
  Phase 39 W2 lessons exemplify the orchestrator-skill boundary pattern).
  Conversely, NO bare relative path strings like `'.planning'` without
  `path.join(process.cwd(), '.planning')` wrapper.
- NO modification of Step 4.5 block, Step 5 block, Step 6 frontmatter,
  Step 7+ blocks beyond the two surgical insertions.
- NO modification of the existing `## Gate Keep/Kill Rubric subsection`
  in Step 6 -- the new Phase Folder Audit subsection sits AFTER it.

**Sanity check after edit**: SKILL.md file size should grow by ~40-50
lines. Existing `<step_4_5_gate_keep_kill_rubric>` and
`<step_5_cross_phase_check>` tags are still present and correctly nested.
  </action>
  <verify>
    <automated>grep -q "auditAllPhases" super-gsd/skills/sgsd-complete-milestone/SKILL.md && echo "PASS AUDIT-05"</automated>
    Expected stdout: `PASS AUDIT-05`.

    Additional verifier greps:
    - `grep -c "phase-folder-audit.md" super-gsd/skills/sgsd-complete-milestone/SKILL.md` -> >= 2.
    - `grep -c "<step_4_6_phase_folder_audit>" super-gsd/skills/sgsd-complete-milestone/SKILL.md` -> 1.
    - `grep -c "</step_4_6_phase_folder_audit>" super-gsd/skills/sgsd-complete-milestone/SKILL.md` -> 1.
    - `grep -n "<step_4_5_gate_keep_kill_rubric>" super-gsd/skills/sgsd-complete-milestone/SKILL.md` -> still present, intact.
    - `grep -n "<step_5_cross_phase_check>" super-gsd/skills/sgsd-complete-milestone/SKILL.md` -> still present, intact, AFTER `</step_4_6_phase_folder_audit>`.
    - Smoke E2E: `node super-gsd/tools/phase-folder-audit/audit.cjs --render --milestone v1.8` -> exit 0, prints markdown with v1.8 phase folders (36-40); also confirm afterward that `git status` shows ONLY the new `.planning/milestones/v1.8/phase-folder-audit.md` (if Task 2 wire-in is invoked) and ZERO modifications inside any phase folder (AUDIT-04 runtime binding).
  </verify>
  <done>
    - SKILL.md grew by ~40-50 lines, structurally intact.
    - All 5 grep greps pass.
    - Smoke E2E: `node audit.cjs --render --milestone v1.8` exits 0
      (AUDIT-03), produces markdown table on stdout including all 5
      v1.8 phase folders.
    - `git status` shows zero modifications inside any phase folder
      (AUDIT-04 runtime binding -- the auditor itself only reads).
    - Atomic commit created:
      `feat(40-01): wire auditAllPhases into sgsd-complete-milestone Step 4.6 + SUMMARY embed`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3 (A3): Deterministic local fallback test (4 fixtures)</name>
  <files>super-gsd/tools/phase-folder-audit/audit.test.cjs</files>
  <behavior>
    Standalone test runner exercising the production library
    (`audit.cjs`) against 4 fixtures it builds in tmpdir:

    Fixture A (compliant): all 4 required + all 4 recommended files present.
      Expected: verdict='compliant', required_missing=[], recommended_missing=[].

    Fixture B (partial): all 4 required present, 0 recommended present
      (or some subset). Expected: verdict='partial',
      required_missing=[], recommended_missing.length > 0.

    Fixture C (non-compliant): {NN}-CONTEXT.md missing; all others present.
      Expected: verdict='non-compliant', required_missing includes
      '{phaseNum}-CONTEXT.md'.

    Fixture D (empty): a directory with `^\d{2}-` name but ZERO files inside.
      Expected: verdict='non-compliant', required_missing.length === 4.

    All 4 fixtures created via fs.mkdtempSync + fs.mkdirSync +
    fs.writeFileSync of empty placeholder content. Cleanup via
    fs.rmSync(tmp, { recursive: true, force: true }) in finally{}.

    Output: 'audit fixture suite: N pass, M fail'.
    Exit 0 = all pass; exit 1 = any fail.

    Test does NOT touch any real phase folder. All fs writes scoped to
    tmpdir (verified by recording tmp prefix and asserting all
    fs.writeFileSync calls' first arg starts with tmp).
  </behavior>
  <action>
Write `super-gsd/tools/phase-folder-audit/audit.test.cjs`. ~120 LOC.
ASCII-only.

Structure:

```javascript
// SGSD - PHASE-FOLDER AUDIT TEST FIXTURES (Phase 40 -- A3 deliverable)
// Deterministic local fallback test. Exercises production library
// (super-gsd/tools/phase-folder-audit/audit.cjs) against 4 fixtures.
// Mirrors the per-tool test pattern established in Phase 35/39.
// All file writes scoped to fs.mkdtempSync output. Read-only against
// any real phase folder (AUDIT-04 invariant).

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const { auditFolder, auditAllPhases, renderTable, VERDICTS } =
  require(path.join(__dirname, 'audit.cjs'));

let pass = 0, fail = 0;
const failures = [];
const assert = (name, cond, detail) => {
  if (cond) { pass++; }
  else { fail++; failures.push({ name, detail: detail || '' }); }
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-fixtures-'));
try {
  // Helper: build a fixture phase folder under tmp/<milestoneDir>/<phaseDir>.
  function buildFixture(milestone, phaseFolderName, files) {
    const phaseDir = path.join(tmp, 'milestones', milestone, 'phases', phaseFolderName);
    fs.mkdirSync(phaseDir, { recursive: true });
    for (const f of files) {
      fs.writeFileSync(path.join(phaseDir, f), '', 'utf8');
    }
    return phaseDir;
  }

  // Fixture A: compliant (4 required + 4 recommended).
  const dirA = buildFixture('v1.9', '50-fixture-a', [
    '50-CONTEXT.md', '50-RESEARCH.md', '50-01-fixture-a-PLAN.md', '50-VERIFICATION.md',
    '50-ATC-REVIEW.md', 'commit-reviews.jsonl', '50-codex-review.md', 'WASTE.md',
  ]);
  const resA = auditFolder(dirA);
  assert('A. compliant fixture -> verdict=compliant',
    resA && resA.verdict === 'compliant'
      && resA.required_missing.length === 0
      && resA.recommended_missing.length === 0);

  // Fixture B: partial (4 required, 0 recommended).
  const dirB = buildFixture('v1.9', '51-fixture-b', [
    '51-CONTEXT.md', '51-RESEARCH.md', '51-01-fixture-b-PLAN.md', '51-VERIFICATION.md',
  ]);
  const resB = auditFolder(dirB);
  assert('B. partial fixture -> verdict=partial; recommended_missing has 4',
    resB && resB.verdict === 'partial'
      && resB.required_missing.length === 0
      && resB.recommended_missing.length === 4);

  // Fixture C: non-compliant (missing 52-CONTEXT.md).
  const dirC = buildFixture('v1.9', '52-fixture-c', [
    '52-RESEARCH.md', '52-01-fixture-c-PLAN.md', '52-VERIFICATION.md',
    '52-ATC-REVIEW.md', 'commit-reviews.jsonl', '52-codex-review.md', 'WASTE.md',
  ]);
  const resC = auditFolder(dirC);
  assert('C. non-compliant fixture -> verdict=non-compliant; CONTEXT in missing',
    resC && resC.verdict === 'non-compliant'
      && resC.required_missing.indexOf('52-CONTEXT.md') >= 0);

  // Fixture D: empty (folder exists, zero files inside).
  const dirD = buildFixture('v1.9', '53-fixture-d', []);
  const resD = auditFolder(dirD);
  assert('D. empty fixture -> verdict=non-compliant; required_missing.length=4',
    resD && resD.verdict === 'non-compliant'
      && resD.required_missing.length === 4);

  // Discovery: auditAllPhases over tmp's planning dir returns 4 audits
  // (one per fixture; sorted by codepoint).
  const all = auditAllPhases(tmp, { milestone: 'v1.9' });
  assert('E. auditAllPhases discovery -> 4 audits returned',
    Array.isArray(all) && all.length === 4);

  // Render: renderTable on the 4-row result returns a markdown string
  // including the soft-warn footer literal.
  const md = renderTable(all);
  assert('F. renderTable on 4-fixture set -> contains soft-warn footer',
    typeof md === 'string' && md.indexOf('Soft-warn only.') >= 0);

  // Verdict closed-enum: every verdict produced is in VERDICTS.
  assert('G. all verdicts in closed enum',
    all.every((r) => VERDICTS.indexOf(r.verdict) >= 0));

  // Empty render literal:
  assert('H. renderTable([]) returns the no-folders-found literal',
    renderTable([]).indexOf('(no phase folders found for this milestone)') >= 0);

} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`audit fixture suite: ${pass} pass, ${fail} fail`);
if (fail > 0) {
  for (const f of failures) console.error(`  FAIL: ${f.name}${f.detail ? ' -- ' + f.detail : ''}`);
  process.exit(1);
}
process.exit(0);
```

**Banned patterns**:
- NO `fs.writeFile*` outside the `tmp` subtree (assert all writes use
  `path.join(tmp, ...)`).
- NO `fs.rmSync` outside the `finally` cleanup.
- NO non-ASCII bytes.
- NO modification of any path under `.planning/`. Test runs entirely in
  `os.tmpdir()`.

**Verification doctrine**: this test doubles as a deterministic local
fallback proof that `audit.cjs` works without ANY live planning data.
The Phase 40 `--self-test` covers structural correctness; this test
covers behavioral end-to-end correctness with explicit fixtures.
  </action>
  <verify>
    <automated>node super-gsd/tools/phase-folder-audit/audit.test.cjs</automated>
    Expected stdout last line: `audit fixture suite: 8 pass, 0 fail`.
    Expected exit code: 0.

    ASCII-only check:
    ```
    node -e "
    const fs = require('fs');
    const buf1 = fs.readFileSync('super-gsd/tools/phase-folder-audit/audit.cjs');
    const buf2 = fs.readFileSync('super-gsd/tools/phase-folder-audit/audit.test.cjs');
    let n = 0;
    for (const b of [buf1, buf2]) for (let i = 0; i < b.length; i++) if (b[i] > 127) n++;
    if (n > 0) { console.error('FAIL non-ASCII:', n); process.exit(1); }
    console.log('PASS ASCII-only');
    "
    ```
    Expected: `PASS ASCII-only`, exit 0.

    Final guard: after running the test, `git status` MUST show ZERO
    changes anywhere under `.planning/` (the test writes only to
    `os.tmpdir()` -- AUDIT-04 holds).
  </verify>
  <done>
    - File `super-gsd/tools/phase-folder-audit/audit.test.cjs` exists, ~120 LOC.
    - `node audit.test.cjs` -> `audit fixture suite: 8 pass, 0 fail`, exit 0.
    - ASCII-only check passes for both audit.cjs and audit.test.cjs.
    - `git status` clean under `.planning/`.
    - Atomic commit created:
      `test(40-01): deterministic local fallback for audit (4 fixtures)`.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| auditor -> phase folders | Read-only invariant: auditor reads dir listings + stat info; MUST NEVER write/append/unlink/rename inside any phase folder. AUDIT-04 binding. |
| SKILL.md Step 4.6 -> audit.cjs | orchestrator-skill boundary; planningDir resolved via `path.join(process.cwd(), '.planning')`, never bare relative. |
| audit.cjs --self-test -> tmpdir | Self-test writes synthetic fixtures inside `fs.mkdtempSync` output; NEVER outside tmp. |
| audit.cjs --render -> stdout | CLI exits 0 ALWAYS on render (AUDIT-03 soft-warn invariant); no path for non-zero exit on compliance verdict. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-40-01 | Tampering | audit.cjs against phase folders | mitigate | Static code review for `fs.write*/append*/unlink*/rename*/rmdir*/copy*/mkdir*` outside `selfTest()` body; runtime fingerprint guard (assertion 13) deep-equal-compares 3 sample real phase folder fingerprints before/after self-test. ANY divergence fails self-test exit 1. |
| T-40-02 | Tampering | audit.test.cjs against real .planning/ tree | mitigate | Test scoped entirely to `fs.mkdtempSync(os.tmpdir())`; no production paths read or written. Verifier confirms `git status` clean under `.planning/` after `node audit.test.cjs`. |
| T-40-03 | Information Disclosure | reading phase-folder file contents | mitigate | 40=B forbids content schema; auditor uses ONLY `fs.readdirSync` + `fs.statSync` + `fs.existsSync` -- NEVER `fs.readFileSync` against phase content. Static greppable. |
| T-40-04 | Denial of Service | misclassifying corpus as non-compliant blocks close | mitigate | Soft-warn ONLY (40=B + AUDIT-03). CLI `--render` ALWAYS exits 0 regardless of verdict mix. SKILL.md Step 4.6 writes the audit and continues; `<step_5_cross_phase_check>` runs unconditionally next. |
| T-40-05 | Tampering | path traversal via planningDir CLI arg | mitigate | `path.resolve(arg)` normalizes; downstream consumers (`_listPhaseFolders`) only read directory listings (no file content), so traversal returns unrelated folder listings -- harmless. Default planningDir is `__dirname`-anchored (NEVER process.cwd()) per Phase 36 W2 + Phase 39 W2 lessons; bare relative `.planning` strings forbidden. |
| T-40-06 | Repudiation | audit.cjs silently swallowing errors -> false-compliant rows | mitigate | All catch blocks `console.warn('[SGSD] audit ...failed:', e.message)` (mirroring rubric.cjs:104). Errors loud on stderr; verdict shape is null on auditFolder failure (skipped from auditAllPhases output, never silently false-compliant). |
| T-40-07 | Spoofing | malicious phase folder name (e.g. shell injection) | accept | Phase folder basenames matched only against `^\d{2}-` regex; extracted phase number is 2 digits. NO shell exec, NO eval -- audit.cjs uses zero subprocess calls. Threat surface = 0. |
| T-40-08 | Elevation of Privilege | audit.cjs running as root mutating state | accept | Same disposition as Phase 39 rubric.cjs: tool runs in user-mode; AUDIT-04 holds at filesystem-call level (no fs.write* against phase folders) regardless of privilege. Read-only invariant is the load-bearing contract; user-mode is operational practice. |
</threat_model>

<verification>
End-to-end verification commands (verifier dispatches in this exact order):

```bash
# 1. Library structural correctness (AUDIT-01..04 binding via assertions).
node super-gsd/tools/phase-folder-audit/audit.cjs --self-test
# Expect: 'phase-folder-audit self-test: 13 pass, 0 fail', exit 0.

# 2. Fixture suite (deterministic local fallback, AUDIT-02 + AUDIT-03 binding).
node super-gsd/tools/phase-folder-audit/audit.test.cjs
# Expect: 'audit fixture suite: 8 pass, 0 fail', exit 0.

# 3. SKILL.md wire-in (AUDIT-05 binding).
grep -q 'auditAllPhases' super-gsd/skills/sgsd-complete-milestone/SKILL.md && echo "PASS AUDIT-05"
# Expect: 'PASS AUDIT-05'.

# 4. SKILL.md citation discipline (RESEARCH sec 5.4).
test "$(grep -c 'phase-folder-audit.md' super-gsd/skills/sgsd-complete-milestone/SKILL.md)" -ge 2 && echo "PASS phase-folder-audit.md cited >= 2"
test "$(grep -c '<step_4_6_phase_folder_audit>' super-gsd/skills/sgsd-complete-milestone/SKILL.md)" -eq 1 && echo "PASS Step 4.6 open tag"
test "$(grep -c '</step_4_6_phase_folder_audit>' super-gsd/skills/sgsd-complete-milestone/SKILL.md)" -eq 1 && echo "PASS Step 4.6 close tag"

# 5. ASCII-only invariant (Phase 39 W4 lesson).
node -e "
const fs = require('fs');
const buf1 = fs.readFileSync('super-gsd/tools/phase-folder-audit/audit.cjs');
const buf2 = fs.readFileSync('super-gsd/tools/phase-folder-audit/audit.test.cjs');
let n = 0;
for (const b of [buf1, buf2]) for (let i = 0; i < b.length; i++) if (b[i] > 127) n++;
if (n > 0) { console.error('FAIL non-ASCII:', n); process.exit(1); }
console.log('PASS ASCII-only');
"
# Expect: 'PASS ASCII-only', exit 0.

# 6. Smoke E2E render against live v1.8 corpus (AUDIT-01 + AUDIT-02 + AUDIT-03 binding).
node super-gsd/tools/phase-folder-audit/audit.cjs --render --milestone v1.8
# Expect: exit 0 even if some rows are partial / non-compliant.
# Expect: stdout markdown contains rows for v1.8 phases 36-40.

# 7. AUDIT-04 runtime check (read-only invariant).
git status --porcelain | grep -E '^\.planning/milestones/v1\.[0-9]+/phases/' && \
  echo "FAIL phase folder mutated" || echo "PASS AUDIT-04 runtime"
# Expect: 'PASS AUDIT-04 runtime'.

# 8. Banned-fs-call static scan against audit.cjs (AUDIT-04 source-level).
node -e "
const src = require('fs').readFileSync('super-gsd/tools/phase-folder-audit/audit.cjs','utf8');
const banned = ['fs.appendFile','fs.unlink','fs.rename','fs.rmdir','fs.copyFile'];
const found = banned.filter(b => src.indexOf(b) >= 0);
if (found.length) { console.error('FAIL banned fs calls:', found.join(',')); process.exit(1); }
console.log('PASS no banned fs calls in audit.cjs');
"

# 9. process.cwd() not used as default in audit.cjs (Phase 36 W2 + Phase 39 W2 lessons).
test "$(grep -c 'process.cwd' super-gsd/tools/phase-folder-audit/audit.cjs)" -eq 0 && echo "PASS no process.cwd in audit.cjs"
```

All 9 verification gates MUST pass. Any failure -> verifier returns FAIL,
gap-closure plan dispatched.
</verification>

<success_criteria>
Phase 40 ships when:

- [ ] **AUDIT-01**: `auditAllPhases` walks all `.planning/milestones/{*}/phases/{*}/` directories AND `.planning/phases/{*}/` (un-archived working dir). Verified by self-test assertion 8 + smoke E2E render against live v1.8.
- [ ] **AUDIT-02**: every phase folder gets verdict in closed enum `{compliant, partial, non-compliant}`. Verified by self-test assertions 4-7, 11-12 + fixture suite assertion G.
- [ ] **AUDIT-03**: soft-warn semantics enforced -- `--render` exits 0 even when verdicts include non-compliant rows; per-phase missing-file lists rendered. Verified by self-test assertions 5-6 + smoke E2E exit code + fixture suite assertion F.
- [ ] **AUDIT-04**: read-only invariant holds. `audit.cjs` source contains ZERO banned fs writes outside selfTest; runtime fingerprint guard (assertion 13) deep-equal-compares 3 sample real phase folders before/after; `git status` clean under `.planning/` after every test invocation.
- [ ] **AUDIT-05**: SKILL.md grep for `auditAllPhases` returns >= 1 (Step 4.6 wire-in present); grep for `phase-folder-audit.md` returns >= 2 (Step 4.6 write + Step 6 read).
- [ ] All 13 self-test assertions pass exit 0.
- [ ] All 8 fixture suite assertions pass exit 0.
- [ ] ASCII-only across both .cjs files (zero bytes > 127).
- [ ] Smoke E2E `node audit.cjs --render --milestone v1.8` produces markdown table for v1.8 phase folders 36-40, exit 0, zero phase folder mutations.
- [ ] 3 atomic commits created with messages exactly matching the commit plan below.
- [ ] No new package dependencies introduced (Node built-ins only).
- [ ] Architectural mirror with Phase 39 rubric.cjs verified via 5-grep self-check (RESEARCH sec 10.3).

Commit plan (3 atomic, RESEARCH sec 12.1 verbatim):
1. `feat(40-01): audit.cjs lib + 12-assertion self-test`
2. `feat(40-01): wire auditAllPhases into sgsd-complete-milestone Step 4.6 + SUMMARY embed`
3. `test(40-01): deterministic local fallback for audit (4 fixtures)`

Each commit is independently green: `node audit.cjs --self-test` exits 0
after commit 1; SKILL.md greps pass after commit 2;
`node audit.test.cjs` exits 0 after commit 3.

Phase exit: PASS expected. v1.8 milestone ready for `sgsd-complete-milestone`
immediately after Phase 40 PASS.
</success_criteria>

<output>
After completion, create
`.planning/milestones/v1.8/phases/40-phase-folder-audit/40-01-SUMMARY.md`
following the standard SUMMARY.md template:

- frontmatter: `phase: 40`, `plan: 01`, `status: PASS`, `requirements: [AUDIT-01,AUDIT-02,AUDIT-03,AUDIT-04,AUDIT-05]`, `commits: [<sha1>, <sha2>, <sha3>]`.
- shipped artifacts: `super-gsd/tools/phase-folder-audit/audit.cjs`, `super-gsd/tools/phase-folder-audit/audit.test.cjs`, `super-gsd/skills/sgsd-complete-milestone/SKILL.md` (edited).
- evidence produced: `audit.cjs --self-test` 13 pass; `audit.test.cjs` 8 pass; `audit.cjs --render --milestone v1.8` exit 0 with markdown table.
- rules learned: any new lessons surfaced during execution (e.g. tmpdir cleanup edge cases, fingerprint-guard skip-on-absent triggered, etc.).
- v1.8 milestone close handover: list the 5 v1.8 phase deliverables (gate-value-log, muda-deletion-candidates, sampling-decider, gate-keep-kill rubric, phase-folder-audit) plus 2 reason_codes appended to envelope-v1, plus 2 SKILL.md wire-ins (Step 4.5 + Step 4.6).
- next-action seed: dispatch `sgsd-complete-milestone` for v1.8 once Phase 40 verifier returns PASS.
</output>
