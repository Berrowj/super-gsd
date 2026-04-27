---
phase: 40
title: Phase Folder Perfection Contract
milestone: v1.8
locked: 40=B
researched: 2026-04-27
researcher: gsd-phase-researcher (sonnet)
controlling_principle: "Autonomy continues; evidence tells the truth."
status: research-complete
---

# Phase 40 -- Phase Folder Perfection Contract -- RESEARCH

> Auditor walks all phase folders. Required + recommended file checks.
> Soft-warn (not block). Read-only. Wired into
> `sgsd-complete-milestone/SKILL.md` at close.
>
> **Locked**: 40=B (mass-discuss line 217: "required + recommended file
> checks; no content schema -- content validation is auditor-creep").

---

## User Constraints (from REQUIREMENTS.md + 2026-04-26-mass-discuss)

### Locked Decisions
- **40=B**: required + recommended file checks; **NO content schema**
  (mass-discuss:217).
- **AUDIT-01..05**: walks all phase folders; categorizes
  `compliant | partial | non-compliant`; soft-warn ONLY (does NOT block);
  per-phase missing-file list; does NOT modify any folder; wired into
  `sgsd-complete-milestone/SKILL.md` at close.
- **Hard stop**: if auditor modifies any folder (REQUIREMENTS.md:82).

### Claude's Discretion
- Glob shape for plan files; render format of missing-file list; whether to
  count `commit-reviews.jsonl` line-count (informational); v1.5 legacy skeleton
  handling.

### Deferred Ideas (OUT OF SCOPE)
- Content validation / frontmatter schema (40=B forbids).
- Auto-repair / scaffold-missing (violates AUDIT-04).
- Cross-phase consistency (already in `tools/status-consistency/check.cjs`).
- Backfilling missing files in archived milestones.
- Dependency graph between phase artifacts.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDIT-01 | Walks all phase folders | sec 1 + sec 4 (`auditAllPhases`) |
| AUDIT-02 | Categorizes compliant / partial / non-compliant | sec 2 |
| AUDIT-03 | Soft-warn (not block); per-phase missing-file list | sec 4 + sec 5 |
| AUDIT-04 | Does NOT modify any phase folder | sec 6 (RO + fingerprint) |
| AUDIT-05 | Wired into `sgsd-complete-milestone/SKILL.md` at close | sec 5 (Step 4.6) |

---

## 1. Required + Recommended File Template

### 1.1 Empirical sample (8 phase folders inspected)

| File | 26 (v1.6) | 27 | 28 | 29 | 30 | 31 (v1.7) | 32 | 33 | 34 | 35 | 36 (v1.8) | 37 | 39 |
|------|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `NN-CONTEXT.md` | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES |
| `NN-RESEARCH.md` | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES |
| `NN-PP-*-PLAN.md` (>=1) | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES |
| `NN-VERIFICATION.md` | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES |
| `NN-ATC-REVIEW.md` | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES |
| `commit-reviews.jsonl` | YES | YES | YES | YES | YES | YES | YES | YES | YES | YES | NO | NO | NO |
| `NN-codex-review.md` | -- | -- | -- | -- | -- | YES | YES | YES | YES | YES | YES | YES | YES |
| `WASTE.md` | -- | -- | YES | YES | YES | -- | -- | -- | -- | -- | -- | -- | -- |
| `NN-claude-review.md` | -- | -- | -- | -- | -- | YES | -- | -- | -- | -- | -- | -- | -- |
| `NN-PATTERNS.md` | -- | -- | YES | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |

(Phases 36/37/39 mid-flight at research time -- VERIFICATION.md exists for
PASS phases only; commit-reviews.jsonl rolls in once per-dispatch ATC fires.)

Source paths cited:
- `.planning/milestones/v1.7/phases/31-canonical-envelope/` (8 files)
- `.planning/milestones/v1.6/phases/26-cockpit-question-contract/` (6 files)
- `.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/` -- **different
  skeleton**: `21-PP-SUMMARY.md` per plan, `21-PLAN-INDEX.md`. Codex not yet
  wired in v1.5.

### 1.2 Frozen REQUIRED list (4 entries)

| Pattern | Match | Notes |
|---------|-------|-------|
| `{NN}-CONTEXT.md` | exact | universal v1.6+ |
| `{NN}-RESEARCH.md` | exact | universal v1.6+ |
| `{NN}-{PP}-*-PLAN.md` | glob (>=1) | `PP` = 2-digit plan id |
| `{NN}-VERIFICATION.md` | exact | universal v1.6+ when PASS |

Phase 40's bar is **structural presence only**. An empty `40-VERIFICATION.md`
satisfies the auditor exactly as much as a 500-line one does. (40=B lock.)

### 1.3 Frozen RECOMMENDED list (4 entries)

| Pattern | Why recommended |
|---------|-----------------|
| `{NN}-ATC-REVIEW.md` | phase-level ATC produced output (v1.6+ universal) |
| `commit-reviews.jsonl` | per-dispatch ATC fired >=1 time (v1.6+ universal) |
| `{NN}-codex-review.md` | Codex reviewer dispatched (v1.7+ universal) |
| `WASTE.md` | MUDA audit fired |

NOT in RECOMMENDED (auditor-creep avoidance): `codex-review-prompt.txt`
(supporting-by-construction), `{NN}-claude-review.md` (one-off Phase 31),
`{NN}-PATTERNS.md` (one-off Phase 28), v1.5-legacy `{NN}-PP-SUMMARY.md` /
`{NN}-PLAN-INDEX.md`.

### 1.4 Frozen constants in audit.cjs

```javascript
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

`{NN}` is the 2-digit phase number from the folder basename's leading
numeric prefix.

---

## 2. Three Categories (AUDIT-02)

### 2.1 Bucket rules (frozen enum + first-match-wins)

| Verdict | Definition |
|---------|------------|
| `compliant` | ALL required present AND ALL recommended present |
| `partial` | ALL required present AND >=1 recommended missing |
| `non-compliant` | >=1 required missing |

```javascript
function categorize(required_missing, recommended_missing) {
  if (required_missing.length > 0) return 'non-compliant';
  if (recommended_missing.length > 0) return 'partial';
  return 'compliant';
}
```

Pure function, no I/O. Mirrors `classifyGate` in `gate-keep-kill/rubric.cjs:204-308`.

### 2.2 Soft-warn semantics (AUDIT-03)

Auditor NEVER returns non-zero exit for partial / non-compliant verdicts on
`--render`. Verdicts are data; SKILL.md wire-in writes them to
`phase-folder-audit.md`. Run continues. Honors controlling principle "evidence
tells the truth".

CLI exit code 1 reserved for `--self-test` assertion failure (mirrors
rubric.cjs:608-614). NEVER for compliance verdicts.

---

## 3. Tool Location + Structure

### 3.1 Path: `super-gsd/tools/phase-folder-audit/audit.cjs`

(ROADMAP-AGENT.md:446 confirms.) Mirrors Phase 35 (`tools/system-map/generate.cjs`)
and Phase 39 (`tools/gate-keep-kill/rubric.cjs`) -- one tool dir per auditor,
single .cjs entry, **zero deps** (Node built-ins only: `fs`, `path`, `os`).
Lock inherited from rubric.cjs:39-41.

### 3.2 File structure (locked sections, mirrors Phase 39 1:1)

```
1. Banner block (purpose, locked refs, fingerprint contract, deps)
2. FROZEN CONSTANTS: VERDICTS, REQUIRED_FILES, RECOMMENDED_FILES
3. Private helpers: _phaseNumberFromFolderName, _expandMatcher, _checkFile,
                    _listPhaseFolders, _fingerprintDir
4. Public functions: auditFolder, auditAllPhases, renderTable
5. Self-test (13 assertions in tmpdir + fingerprint guard)
6. CLI main: --self-test | --render | --json | --help
7. module.exports = { auditFolder, auditAllPhases, renderTable,
                      VERDICTS, REQUIRED_FILES, RECOMMENDED_FILES }
```

### 3.3 Banner template (ASCII-only; cite RESEARCH lines + acceptance bindings)

```
// SGSD - PHASE-FOLDER AUDIT (Phase 40 -- AUDIT-01..05)
// Walks .planning/milestones/{*}/phases/{*}/ AND .planning/phases/{*}/.
// Verdict closed-enum: { compliant, partial, non-compliant }.
// Locked: 40=B (mass-discuss:217). Soft-warn ONLY. NO content schema.
// Failure contract (mirrored rubric.cjs:11-13): never throws upward.
// Read-only invariant (AUDIT-04): NEVER fs.write*/append*/unlink* on phase
// folders. Self-test fingerprint-guards 3+ sample folders before/after.
// Acceptance bindings:
//   AUDIT-01: auditAllPhases walks .planning/milestones/{*}/phases/{*}.
//   AUDIT-02: every folder gets verdict in {compliant,partial,non-compliant}.
//   AUDIT-03: render exits 0 even when partial/non-compliant.
//   AUDIT-04: self-test fingerprint guard (sec 6.2).
//   AUDIT-05: SKILL.md Step 4.6 grep for `auditAllPhases` returns >= 1.
// Zero external deps. Node built-ins only.
```

---

## 4. Public API Design

### 4.1 `auditFolder(phaseDir) -> FolderAudit | null`

```typescript
type FolderAudit = {
  phase_dir: string;             // absolute input path
  phase_num: string | null;      // 2-digit or null if undetermined
  folder_name: string;           // basename
  verdict: 'compliant' | 'partial' | 'non-compliant';
  required_present: string[];    // basenames
  required_missing: string[];    // expanded basenames
  recommended_present: string[];
  recommended_missing: string[];
};
```

Pure inspection of directory listing (`fs.readdirSync` + `fs.statSync` only;
NEVER `fs.readFileSync` on phase-folder content). Wraps body try/catch
returning `null` on error.

### 4.2 `auditAllPhases(planningDir, opts) -> FolderAudit[]`

```typescript
opts: {
  milestone?: string;            // e.g. 'v1.8'; if absent, all milestones
  includeUnarchived?: boolean;   // default true; also walks .planning/phases/
};
```

Discovery rule:
- Walk `<planningDir>/milestones/<v>/phases/<NN-name>/`.
- ALSO walk `<planningDir>/phases/<NN-name>/` if exists (un-archived working dir).
- Filter to entries matching `^\d{2}-` regex on basename.
- Returns sorted by full path codepoint order (deterministic).
- Empty array on any error (never throws).

### 4.3 `renderTable(audits) -> string`

Output shape:

```markdown
# Phase Folder Audit (milestone <v> | <ts>)

## Summary
| verdict | count |
|---|---|
| compliant | N |
| partial | N |
| non-compliant | N |

## Per-phase verdicts
| phase | folder | verdict | required missing | recommended missing |
|-------|--------|---------|------------------|---------------------|
| 40 | 40-phase-folder-audit | partial | -- | WASTE.md |

> Soft-warn only. Locked: 40=B. Auditor never modifies phase folders.
```

Render rules (mirror rubric.cjs:410-413): verdict `**bold**` for
non-compliant, plain for compliant, `*italic*` for partial. Missing cells:
comma-joined or `--`. Wraps try/catch returning `'(audit render error)'`.

### 4.4 Frozen constants exported

```javascript
const VERDICTS = Object.freeze(['compliant', 'partial', 'non-compliant']);
module.exports = {
  auditFolder, auditAllPhases, renderTable,
  VERDICTS, REQUIRED_FILES, RECOMMENDED_FILES,
};
```

### 4.5 CLI surface

```
node audit.cjs --self-test
node audit.cjs --render [--milestone <v>] [--planning-dir <p>]
node audit.cjs --json   [--milestone <v>] [--planning-dir <p>]
node audit.cjs --help
```

Default planning-dir: `__dirname` walked 3 dirs up + `.planning` (mirrors
rubric.cjs:625-631; Phase 36 W2 lesson: NEVER `process.cwd()` default).

CLI exits 0 except `--self-test` on assertion failure. **No `--check` mode**:
phase folders evolve continuously, so the analog of `--check` is the run
itself fired at milestone close. (Deliberate departure from system-map.cjs.)

---

## 5. Wire-in Target -- `sgsd-complete-milestone/SKILL.md`

### 5.1 Insertion point

Insert `<step_4_6_phase_folder_audit>` block **between** line 135
(`</step_4_5_gate_keep_kill_rubric>`) and line 137 (`<step_5_cross_phase_check>`).
Numbering 4.6 parallels Phase 39's Step 4.5: both are pre-summary read-only
audits whose outputs Step 6 embeds into SUMMARY.md.

### 5.2 Step 4.6 markup (drop-in template)

```markdown
<step_4_6_phase_folder_audit>
## Step 4.6: Phase Folder Audit (Phase 40 -- AUDIT-01..05)

Walk every phase folder for milestone {{version}} and emit a soft-warn-only
audit recording required + recommended file presence. Per lock 40=B:
records the verdict table; operator decides whether to backfill missing
files. Read-only.

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

Per lock 40=B: this step ONLY produces the verdict table. The script
NEVER mutates any phase folder. Self-test fingerprint guard enforces.

Defer-on-empty: if `auditAllPhases` returns `[]`, the rendered table reads
`(no phase folders found for this milestone)` and Step 6 references that
file as-is. Soft-warn semantics never block close.
</step_4_6_phase_folder_audit>
```

### 5.3 SUMMARY.md subsection (Step 6 extension)

Append after `## Gate Keep/Kill Rubric` (SKILL.md line 198), before
`## Connections`:

```markdown
## Phase Folder Audit (milestone {{version}})
> Soft-warn only. Per lock 40=B.
{{contents of .planning/milestones/{{version}}/phase-folder-audit.md}}
```

If the file does not exist (Step 4.6 failed):
`(phase-folder audit unavailable -- see audit-skipped log)`.

### 5.4 Wire-in citation discipline (verifier-friendly greps)

- `grep -n "auditAllPhases" super-gsd/skills/sgsd-complete-milestone/SKILL.md`
  MUST return >=1.
- `grep -n "phase-folder-audit.md" super-gsd/skills/sgsd-complete-milestone/SKILL.md`
  MUST return >=2 (Step 4.6 write + Step 6 read).

Mirrors rubric.cjs:30 (RUBRIC-04 binding).

---

## 6. No-Modification Invariant (AUDIT-04)

### 6.1 Static enforcement (review-time)

audit.cjs source MUST NOT contain any of these scoped to phase-folder paths:
- `fs.writeFile`, `fs.writeFileSync`, `fs.appendFile`, `fs.appendFileSync`
- `fs.unlink`, `fs.unlinkSync`, `fs.rename`, `fs.renameSync`
- `fs.rmdir`, `fs.rmdirSync`, `fs.copyFile`, `fs.copyFileSync`
- `fs.mkdir`, `fs.mkdirSync` against phase-folder paths

ONLY `fs.write*` permitted: tmpdir fixture writes during `--self-test`
(matching `fs.mkdtempSync(...)` output). ONLY read calls used:
`fs.existsSync`, `fs.statSync`, `fs.readdirSync`. NEVER `fs.readFileSync`
on phase-folder content (40=B forbids content inspection).

Plan-checker / ATC review verifies this lock.

### 6.2 Runtime enforcement (self-test fingerprint guard)

Mirroring rubric.cjs:441-453 + 587-602:

```javascript
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const samplePhaseFolders = [
  path.join(repoRoot, '.planning', 'milestones', 'v1.7', 'phases', '31-canonical-envelope'),
  path.join(repoRoot, '.planning', 'milestones', 'v1.7', 'phases', '35-generated-system-map'),
  path.join(repoRoot, '.planning', 'milestones', 'v1.6', 'phases', '26-cockpit-question-contract'),
];
const before = samplePhaseFolders.map(_fingerprintDir);
// ... 12 assertions execute ...
const after  = samplePhaseFolders.map(_fingerprintDir);
// Deep-equal before/after per folder; any difference -> assertion fail.
```

Helper:

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

If ANY mtime / size / child-set diverges, self-test fails with detail
`phase folder X mutated by audit run`. This is the binding runtime test
for AUDIT-04.

---

## 7. --self-test Scaffold (13 assertions)

Mirrors rubric.cjs:431-614 1:1.

| # | Assertion | Tests |
|---|-----------|-------|
| 1 | `VERDICTS` frozen, length 3, equals `['compliant','partial','non-compliant']` | constant lock |
| 2 | `REQUIRED_FILES` frozen, length 4, kinds match sec 1.4 | constant lock |
| 3 | `RECOMMENDED_FILES` frozen, length 4, kinds match sec 1.4 | constant lock |
| 4 | `auditFolder(<fully-compliant fixture>)` -> verdict='compliant', empty missing arrays | bucket R3 |
| 5 | `auditFolder(<missing CONTEXT.md fixture>)` -> 'non-compliant', required_missing=['NN-CONTEXT.md'] | bucket R1 |
| 6 | `auditFolder(<all-required-no-recommended fixture>)` -> 'partial', recommended_missing=4 names | bucket R2 |
| 7 | `auditFolder(<no-leading-digit folder>)` -> null OR phase_num=null verdict='non-compliant' | discovery filter |
| 8 | `auditAllPhases(<tmpdir, 3 fixtures>)` -> 3 audits in deterministic codepoint order | discovery |
| 9 | `auditAllPhases(<tmpdir>, { milestone: 'v1.8' })` filters to milestone | filter |
| 10 | `renderTable(<3 audits>)` -> markdown with header + summary table + 3 rows + soft-warn footer | render |
| 11 | `renderTable([])` -> 'no phase folders found' literal (not crash) | empty case |
| 12 | Fingerprint guard: 3 sample real phase folder fingerprints unchanged across all 11 prior assertions | AUDIT-04 |
| 13 | `auditFolder(<fixture with TWO PLAN files>)` -> verdict='compliant' (multi-PLAN allowed) | glob match |

Tmpdir cleanup: `fs.rmSync(tmp, { recursive: true, force: true })` in `finally{}`.
Live fingerprint targets (26/31/35) chosen for stability: all PASS-closed,
archived, mtime git-controlled. If absent (shallow clone), assertion 12
prints warn `live fixture <X> absent; skipping` and treats absent-before ==
absent-after = ok.

Exit code: 0 = all pass; 1 = any assertion fail. Stdout:
`phase-folder-audit self-test: 13 pass, 0 fail`.

---

## 8. Live-or-Local Fallback Design

### 8.1 Modes

| Mode | Trigger | planningDir |
|------|---------|-------------|
| Live | `--render` from operator OR Step 4.6 wire-in | default `<repo>/.planning` (anchored to `__dirname`) |
| Local | `--self-test` | tmpdir with synthetic phase folders |
| Override | both modes accept `--planning-dir <path>` | parity with rubric.cjs:628-635 |

### 8.2 No live data dependency

Unlike Phase 39 (which needs gate-value-log + review-ledger populated),
Phase 40 has NO data prerequisites beyond directory listings. Runs cleanly
on a fresh checkout the moment any phase folder exists.

Defer-on-empty applies in only one case: zero phase folders discovered for
the milestone -- `auditAllPhases` returns `[]`, `renderTable([])` returns
literal `(no phase folders found for this milestone)`. Matches soft-warn
philosophy: "found nothing" is reported, not failure.

---

## 9. Schema-without-Consumer Satisfaction

40=B forbids content-schema validation, but the auditor IS a schema (over the
directory). Schema-without-consumer rule (system-map.cjs:36-41) requires
>=3 production callers.

| # | Caller | Role |
|---|--------|------|
| 1 | `sgsd-complete-milestone/SKILL.md` Step 4.6 | PRIMARY: writes `phase-folder-audit.md` |
| 2 | `audit.cjs --self-test` | STRUCTURAL: 13 assertions exercise both APIs |
| 3 | `SUMMARY.md` Step 6 read | INDIRECT: embeds audit output inline at milestone close |

Future caller (v2.1 Phase 53): hello-world walkthrough may optionally call
`auditFolder(<phaseDir>)`. Out of scope for v1.8.

---

## 10. Architectural Mirror Discipline (1:1 with Phase 35 / 39)

### 10.1 Mirror table

| Discipline | Phase 35 (system-map) | Phase 39 (rubric) | Phase 40 (audit) |
|------------|----------------------|-------------------|------------------|
| Tool dir | `tools/system-map/` | `tools/gate-keep-kill/` | `tools/phase-folder-audit/` |
| Entry | `generate.cjs` | `rubric.cjs` | `audit.cjs` |
| External deps | js-yaml (vendored) | none | none |
| Frozen constants | SCHEMA_VERSION + names | VERDICTS, KEEP_THRESHOLDS, REASONS | VERDICTS, REQUIRED_FILES, RECOMMENDED_FILES |
| Pure inner | `compose(map)` | `classifyGate(...)` | `auditFolder(phaseDir)` |
| Composer | `compose()` | `runRubric(planningDir,opts)` | `auditAllPhases(planningDir,opts)` |
| Renderer | `renderJson` + `renderMd` | `renderTable` | `renderTable` |
| Self-test | 15 assertions + fingerprint | 14 assertions + fingerprint | 13 assertions + fingerprint |
| Fingerprint | 4 canonical files | 4 canonical files | 3 canonical phase folders |
| CLI flags | `--generate / --check / --self-test` | `--self-test / --render / --json` | `--self-test / --render / --json / --help` |
| `__dirname` anchor | yes (line 64) | yes (line 444) | yes (sec 4.5 + 6.2) |
| Failure contract | never throws upward | never throws upward | never throws upward |

### 10.2 Three justified deviations

1. **No `--check` mode.** No committed canonical output to drift-check;
   audit fires fresh at milestone close.
2. **Fingerprint targets are folders, not files.** AUDIT-04 lives at
   directory level. `_fingerprintDir` enumerates direct children + mtime/size.
3. **Live fingerprint may skip-on-absent.** Sample folders 26/31/35 can be
   missing in shallow clone; sec 7.3 spells out skip rule.

### 10.3 Mirror self-check (for plan-checker)

- `path.resolve(__dirname` >= 2 occurrences.
- `Object.freeze(` >= 3 occurrences.
- `fs.mkdtempSync` exactly 1 (in selfTest).
- `try {` and `catch ` each >= 4 (auditFolder, auditAllPhases, renderTable,
  internal helpers).
- `module.exports` exposes 6 names.

---

## 11. Open Derivation Calls + Locked Recommendations

All open questions LOCKED per "target: lock all" directive.

| # | Question | Locked Answer |
|---|----------|---------------|
| Q1 | Phase number derivation | Leading 2-digit prefix `^(\d{2})-` from folder basename. Non-matching folders skipped (auditAllPhases) or returned with `phase_num=null` verdict='non-compliant' (auditFolder direct call). |
| Q2 | Walk archived AND working dirs? | Both. `opts.includeUnarchived` defaults `true`. Pre-archive: working `.planning/phases/`. Post-archive: milestone subdir. (Mirrors lifecycle in SKILL.md Step 8.) |
| Q3 | Re-run scenario behavior | Overwrite. `--render` always writes fresh. Idempotency is SKILL.md Step 0's job. |
| Q4 | Empty `commit-reviews.jsonl` | Counted as PRESENT. No content read. (40=B.) |
| Q5 | v1.5-legacy multi-SUMMARY skeleton | NO special-case. v1.5 phases report `partial` or `non-compliant`. Soft-warn = informational. Auditor-creep avoidance. |
| Q6 | `{NN}-claude-review.md` recommended? | NO. One-off Phase 31 artifact. |
| Q7 | `{NN}-PATTERNS.md` recommended? | NO. One-off Phase 28 artifact. |
| Q8 | Surface phase folders with content but no plan files? | YES. Returns `non-compliant`, required_missing lists all 3+ missing files. |
| Q9 | Render sort order | Phase-number sort (codepoint of folder basename). Deterministic + intuitive. |
| Q10 | Output file location | `.planning/milestones/{{version}}/phase-folder-audit.md` (mirrors `gate-keep-kill.md` location, SKILL.md:119). |
| Q11 | SUMMARY.md subsection name | `## Phase Folder Audit (milestone {{version}})` (mirrors `## Gate Keep/Kill Rubric ...`). |
| Q12 | Empty audits array render | Literal `(no phase folders found for this milestone)`. |
| Q13 | `--strict` mode that exits non-zero on non-compliant? | NO. AUDIT-03 forbids blocking. Only `--self-test` exits 1, only on assertion failure. |

---

## 12. Single Plan Recommendation

### 12.1 Plan: `40-01-phase-folder-audit-PLAN.md`

Single deterministic plan with 4 waves:

| Wave | Task | Verification |
|------|------|--------------|
| 0 | Create `super-gsd/tools/phase-folder-audit/` dir | `ls` shows dir |
| 1 | Write `audit.cjs` per sec 3-4 + 6-7 (~600-700 LOC, mirror Phase 39 1:1) | `node audit.cjs --self-test` exit 0; 13 assertions pass |
| 2 | Edit SKILL.md: insert Step 4.6 (sec 5.2) + extend Step 6 (sec 5.3) | greps in sec 5.4 return required line counts |
| 3 | Smoke E2E: run `node audit.cjs --render --milestone v1.8` | `.planning/milestones/v1.8/phase-folder-audit.md` exists; `git status` shows phase folders 36-39 unchanged |
| 4 | Phase commit: `feat(40-01): {one-liner}` | atomic single commit |

### 12.2 Why one plan?

- Tool + wire-in fit comfortably (mirror with Phase 39's
  `39-01-gate-keep-kill-PLAN.md` is direct).
- Zero deps (no install task).
- No data pre-population (unlike Phase 36 which seeded gate-value-log).
- Final v1.8 phase: clean ship -> v1.8 SHIPPED.

### 12.3 Risks + mitigations

| Risk | Mitigation |
|------|------------|
| AUDIT-04 breach via accidental write | Self-test fingerprint guard (sec 6.2 + assertion 12); ATC checks for forbidden write calls (sec 6.1) |
| Traverses unwanted dirs (e.g., `decisions/`) | `^\d{2}-` regex filter on basenames |
| v1.5 phases over-report non-compliant | Acceptable per Q5 (soft-warn = informational) |
| Cross-platform path issues | `path.join` exclusively; no string concat |
| Self-test mutates real folders | tmpdir for synthetic + fingerprint guard for live |
| Duplicate phase numbers across milestones | Each milestone has separate phases/; rows are per-folder, not per-phase-num |

### 12.4 Acceptance signals (verifier handoff)

- **AUDIT-01**: `--render` walks all 5 v1.8 phase folders + v1.5/v1.6/v1.7
  if no `--milestone` flag.
- **AUDIT-02**: every output row has verdict in `{compliant, partial, non-compliant}`.
- **AUDIT-03**: CLI exits 0 even with non-compliant rows; output includes
  per-phase missing-file list per sec 4.3.
- **AUDIT-04**: self-test fingerprint guard exit 0; OR `git status` after
  `--render` shows ONLY `phase-folder-audit.md` changed (outside any phase folder).
- **AUDIT-05**: SKILL.md greps in sec 5.4.

All five deterministic, fast (<5s each), scriptable.

---

## Sources

### Primary (HIGH confidence)
- `.planning/milestones/v1.7/phases/31-canonical-envelope/` -- 8-file v1.7 sample
- `.planning/milestones/v1.7/phases/35-generated-system-map/` -- closest mirror
- `.planning/milestones/v1.6/phases/26-cockpit-question-contract/` -- 6-file v1.6 sample
- `.planning/milestones/v1.8/phases/39-gate-keep-kill/` -- direct architectural template
- `super-gsd/tools/gate-keep-kill/rubric.cjs:1-664` -- Phase 39 mirror source
- `super-gsd/tools/system-map/generate.cjs:1-1005` -- Phase 35 mirror source
- `super-gsd/skills/sgsd-complete-milestone/SKILL.md:96-203` -- Steps 4.5, 5, 6 wire-in
- `.planning/milestones/v1.8/REQUIREMENTS.md:48-54` -- AUDIT-01..05 verbatim
- `.planning/discussions/2026-04-26-mass-discuss.md:217` -- 40=B lock verbatim
- `.planning/ROADMAP-AGENT.md:440-452` -- Phase 40 block

### Secondary (MEDIUM confidence)
- `.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/` -- legacy
  multi-SUMMARY pattern (Q5 derivation)
- `.planning/milestones/v1.6/phases/28-mission-control-layout/` -- 28-PATTERNS.md
  one-off (rejected from RECOMMENDED)

### Tertiary (LOW confidence)
None. Every claim grounded in the cited file:line spans.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | All claims verified against cited file:line spans. | -- | -- |

The Assumptions Log is empty: every architectural claim was verified by
inspecting canonical sample phase folders OR direct mirror tool sources
(rubric.cjs, generate.cjs) OR locked decision documents (REQUIREMENTS.md,
mass-discuss.md, ROADMAP-AGENT.md).

---

## Metadata

**Confidence breakdown:** HIGH across all sections.
- File template (sec 1): 8 phase folders directly inspected.
- Bucket rules (sec 2): closed enum mirrors rubric.cjs verdict pattern.
- Public API (sec 4): mirrors rubric.cjs / system-map.cjs API shape 1:1.
- Wire-in (sec 5): exact line numbers cited in SKILL.md.
- No-modification (sec 6): structural enforcement (fingerprint guard).
- Self-test (sec 7): 13 assertions parallel rubric.cjs's 14 1:1.
- Mirror discipline (sec 10): side-by-side comparison table.

**Research date:** 2026-04-27
**Valid until:** 2026-05-04 (one week; phase folder skeleton stable since v1.6).

---

> **Final lock**: this RESEARCH.md commits to ONE plan
> (`40-01-phase-folder-audit-PLAN.md`) producing TWO file changes:
>   1. `super-gsd/tools/phase-folder-audit/audit.cjs` (new)
>   2. `super-gsd/skills/sgsd-complete-milestone/SKILL.md` (edit)
> All AUDIT-01..05 acceptance bindings deterministic and verifier-friendly.
> Soft-warn-only contract honored at every layer.
> Architectural mirror with Phase 35 + Phase 39 enforced via section 10
> grep-able self-check rules.
