# P147 T147-03 — the commit hook itself (warn mode + sentinel + fail-open)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS TASK ONLY (T147-03 of 5). Verify before
reporting. Explicit DONE / DONE_WITH_CONCERNS / BLOCKED.

## ⚠️ THE TWO DEFECT CLASSES — 13 CRITICALs so far across P146+P147
1. **Destination/containment.** The invariant: derive the containment ROOT
   independently of the target. All ledger writes go through T147-02's
   `appendShadowRow(root, row)` — the hook NEVER computes a ledger path
   itself. Root comes from `findSgsdRoot(process.cwd())` only.
2. **Silent success.** Every degraded path (git spawn fails, diff unparsable,
   convention unknown, evidence writer refuses) → distinct reason-coded
   degraded ROW where a root exists + non-stack stderr breadcrumb, exit 0.
   The hook must NEVER look healthy while doing nothing.

## Files you may touch
- `super-gsd/hooks/sgsd-commit-gate.cjs` (CREATE — this task owns it)
- `super-gsd/tests/commit-gate/assert-real-commit-gate.cjs` (EXTEND; keep all
  existing scenarios passing)

## Output contract (locked plan)
The real hook entrypoint, WARN MODE ONLY in this task:
- staged diff via `git diff --cached --name-status -z --find-renames
  --find-copies --` (NUL-safe; renames/copies carry old+new paths — evaluate
  the NEW path, count the old as context; deletes count by old path);
- binary content NEVER embedded — `git diff --cached --binary` stream is
  sha256-hashed for `diff_sha256`;
- per-path evaluation via T147-01's `evaluatePaths`; convention via
  `discoverConvention` (unknown → warn/skip row with reason, NEVER block);
- sentinel: `.sgsd-gate-off` at repo root → skip with a row listing the EXACT
  waived paths (VTP directive);
- warn output: loud, human-readable stderr summary naming the unbacked paths +
  ONE shadow row per commit attempt with per-path evidence;
- exit codes: 0 for warn/skip/non-SGSD/internal-error. Code 10 is RESERVED for
  earned block (T147-05) — this task defines the constant and the single
  decision point but warn mode NEVER returns it.

## Falsifier — task FAILS if any holds
Hook reads unstaged files as evidence; blocks in warn mode; fails closed on
git/internal errors; omits sentinel waived paths; or cannot assert staged path
and hash values from real shadow rows.

## Layering honesty (VTP directive)
`--no-verify` and some GUI clients bypass pre-commit hooks entirely. The hook's
stderr banner and any docs text must describe it as ONE governance layer —
never claim complete coverage.

## Verify (report exact exit codes) — stop_rule made executable
1. `node --check` the hook.
2. REAL temp git repo (T147-01 fixture runner), source file staged, no plan
   evidence → hook exits 0, warns on stderr naming the path, appends ONE
   shadow row whose staged_paths + path_evidence match the real staged file
   and whose diff_sha256 matches an independently computed hash.
3. Docs-only staged commit → exit 0, NO warn row (or a not-source row —
   follow the plan; state which).
4. Sentinel present → exit 0, skip row with the exact waived paths.
5. Injected failure (e.g. git binary shadowed with a failing stub in PATH, or
   run outside a git work tree) → exit 0, degraded row where root exists,
   breadcrumb, no stack.
6. Non-SGSD repo → exit 0, nothing written anywhere.
7. All existing scenarios still pass (sandbox may block git spawn — EPERM —
   say so; orchestrator re-runs host-side).
Windows-safe. JSON.stringify for payloads. SURGICAL CONSTRAINT as always.

## Report contract (<300 words)
FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER
