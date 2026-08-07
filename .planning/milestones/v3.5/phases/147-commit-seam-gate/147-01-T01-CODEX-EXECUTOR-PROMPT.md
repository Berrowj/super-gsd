# P147 T147-01 — artifact-convention evaluator + source predicate + real-git fixture runner

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS TASK ONLY (T147-01 of 5). Verify before
reporting. Explicit DONE / DONE_WITH_CONCERNS / BLOCKED.

## ⚠️ P146 SHIPPED 11 CRITICALs IN TWO CLASSES — do not make either a 12th
1. **Writer accepts a caller-supplied destination** (5 instances; ended with
   ONE contract). ANY path you write must be obtained via
   `resolveContainedPath(root, subpath)` from
   `super-gsd/scripts/lib/sgsd-state.cjs` (realpath + junction refusal, returns
   null, never throws). This includes test fixtures' cleanup paths.
2. **Silent success** (7 instances). "Could not determine" must be an OBSERVABLE
   state with a distinct reason code — never an empty result that reads as
   "all clear". A convention evaluator that cannot prove a repo's convention
   returns `convention_unknown`, never an empty-but-ok verdict.

## Files you may CREATE (this task owns both)
- `super-gsd/scripts/lib/sgsd-artifact-conventions.cjs`
- `super-gsd/tests/commit-gate/assert-real-commit-gate.cjs`

## Output contract (locked plan)
Create artifact convention discovery/evaluation and the real temp-git fixture
runner. GSDedits convention: `findPlanLockedFiles` (milestone-scoped, from
sgsd-state.cjs) plus active-phase `*-ATC-REVIEW*.md`. devcp (or any other
repo): convention is RUNTIME-DISCOVERED from the repo's own `.planning`
artifacts; when not provable return `convention_unknown`. Implement the
source-touching predicate and PER-PATH evaluation records (VTP directive:
per-path, not per-commit binary — a commit with 1/30 unbacked files is a
different signal from 30/30).

## Falsifier — task FAILS if any holds
Bare `PLAN.md` or `AUDIT.md` satisfies evidence (known FALSE predicate);
devcp naming is hardcoded; docs-only commits warn; or runtime/config source
paths fail to warn.

## Source-touching predicate (from the locked plan / RESEARCH Q3)
Warn-relevant: staged A/C/M/R/D/T paths under `super-gsd/**`, `.agents/**`,
`.codex/**`, `.warp/workflows/**`, `custom-gsd-extract/**`, `package*.json`,
plus code/config extensions outside `.planning/**`. Excluded: `.planning/**`,
`docs/**`, root `README.md`, and report-only markdown outside runtime dirs.
NOTE the deliberate tension: docs under `super-gsd/**` — the plan decided
these DO count as source (runtime dir wins). Honour the plan.

## API surface (later tasks depend on these exact names)
`sgsd-artifact-conventions.cjs` must export at least:
- `discoverConvention(root)` → { convention: "gsdedits" | "discovered" | "unknown",
    reason_code, evidence: [...] } — never throws;
- `evaluatePaths(root, stagedPaths, state)` → per-path records:
    [{ path, source_touching: bool, evidence_status: "backed"|"missing"|"not_source",
       matched_artifacts: [...] }] — never throws;
- `isSourceTouching(path)` → bool (pure, exported for tests).

`assert-real-commit-gate.cjs` is the REAL-GIT fixture runner the plan's
semantic ACs call: it must create a TEMP git repo (`git init`), write and
`git add` real files, and expose helpers later tasks reuse to run the actual
hook against real staged state. Windows-safe (core.autocrlf false in the
fixture; no chmod reliance). Fixture repos must be created under the OS temp
dir and cleaned up; any .planning it fabricates must include STATE.md
frontmatter so `readState` resolves.

## Reuse — do not reimplement
`readState` (frontmatter only — NEVER parse prose), `findPlanLockedFiles`
(milestone-scoped), `resolveContainedPath` — all from sgsd-state.cjs.
Envelope-v1 conventions from gate-evidence-log.cjs if you write any rows
(this task probably writes none — evaluation is pure; say so if true).

## Verify (report exact exit codes) — the stop_rule made executable
1. `node --check` both files.
2. Fixture: GSDedits-shaped temp repo (STATE current_phase + milestone, real
   `{NN}-01-PLAN-LOCKED.md` + `{NN}-ATC-REVIEW.md`) → staged source path
   evaluates "backed".
3. NEGATIVE: same fixture with bare `PLAN.md`/`AUDIT.md` instead → "missing"
   (the known-false predicate must NOT satisfy).
4. Source predicate positives: a path under super-gsd/, a `.cjs` outside
   .planning/ → source_touching true. Negatives: `.planning/STATE.md`,
   `docs/x.md`, root README.md → not_source.
5. devcp-unknown: a temp repo whose .planning exists but matches NO known
   convention → `convention_unknown` with a distinct reason code, never
   "backed", never a throw.
6. Per-path granularity: a staged set where exactly 1 of 3 source paths lacks
   evidence → exactly that path reports "missing", the others "backed".
Build any JSON with JSON.stringify (hand-written JSON with Windows paths
breaks on unescaped backslashes). If your sandbox blocks git/node, say so in
BLOCKERS and still report changes — the orchestrator verifies host-side.

SURGICAL CONSTRAINT — every changed line must trace to T147-01. Orphan edits
are DEVIATIONS: report, do not commit silently.

## Report contract (<300 words)
FILES_CHANGED: path (created)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: path | purpose | interface | none
ONE_LINER: substantive summary
