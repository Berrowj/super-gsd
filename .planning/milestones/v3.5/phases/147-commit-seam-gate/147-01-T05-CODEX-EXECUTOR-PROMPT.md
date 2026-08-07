# P147 T147-05 — installer + POSIX trampoline + rollback docs (FINAL task)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS TASK ONLY (T147-05 of 5, last). Verify
before reporting. Explicit DONE / DONE_WITH_CONCERNS / BLOCKED.

## ⚠️ THE TWO DEFECT CLASSES — 13 CRITICALs across P146+P147; do not add one
1. Containment: derive roots independently of targets. The installer's ONLY
   filesystem writes are (a) the hook file at the GIT-RESOLVED hooks path and
   (b) degraded rows via T147-02's appendShadowRow. The hooks path comes from
   `git rev-parse --git-path hooks/pre-commit` executed IN the target repo —
   never from a caller argument.
2. Silent success: every skip/refuse/degrade → distinct reason code + loud
   stderr; install/uninstall must print exactly what they did and where.

## Files you may touch
- `super-gsd/scripts/install-commit-gate.cjs` (CREATE)
- `super-gsd/install.sh` (wire install/uninstall/dry-run messaging)
- `super-gsd/docs/commit-gate.md` (CREATE — incl. rollback + one-layer honesty)
- `super-gsd/tests/commit-gate/assert-real-commit-gate.cjs` (EXTEND)
- the resolved `<hooks-dir>/pre-commit` (only when absent or SGSD-marked)

## Output contract (locked plan) — every clause is load-bearing
Idempotent installer/uninstaller that:
- asks GIT for the hook path (`git rev-parse --git-path hooks/pre-commit`),
  resolves it relative to the repo, honors an existing `core.hooksPath`, and
  NEVER sets core.hooksPath itself;
- WARNS LOUDLY when the resolved path is shared across linked worktrees (this
  checkout IS one — the hook lands in the COMMON git dir and applies to every
  worktree of GSDedits; the operator must know that);
- installs a POSIX `#!/bin/sh` trampoline (Windows git runs hooks via sh):
  finds node (PATH first; degrade gracefully), invokes
  `super-gsd/hooks/sgsd-commit-gate.cjs` with an ABSOLUTE repo-resolved path,
  maps hook exit 10 → git-blocking exit 1, maps ANY other nonzero bootstrap
  failure (node missing, script missing) → exit 0 with loud stderr + a
  bootstrap degraded row via the hook lib when possible;
- SGSD-marks its hook file (clear marker comment); refreshes ONLY SGSD-marked
  hooks; REFUSES an unmarked existing hook loudly, with NO backup-and-replace
  (decide message text; refusing is the plan's choice — respect it);
- uninstall = remove the SGSD-marked hook file, refusing to touch an unmarked
  one; MUST NOT invoke or pass through the gate itself (self-locking rollback
  is the board's named failure);
- `--dry-run` prints every action without writing.

## docs/commit-gate.md must state
warn vs earned-block lifecycle + the mechanical falsifier; the sentinel
`.sgsd-gate-off` (logged, with waived paths); rollback/uninstall (file
removal, never through the gate); the linked-worktree sharing behavior; and
the ONE-LAYER honesty paragraph (`--no-verify` and some GUI clients bypass
pre-commit hooks — this gate is a layer, not a guarantee).

## Verify (report exact exit codes)
1. `node --check super-gsd/scripts/install-commit-gate.cjs`; `bash -n
   super-gsd/install.sh` (sandbox may block bash — say so).
2. REAL temp git repo: install → hook file exists at the GIT-RESOLVED path,
   SGSD-marked, executable-shaped (`#!/bin/sh` first line); re-install →
   byte-identical (idempotent); uninstall → gone; uninstall again → clean
   no-op with message.
3. Unmarked pre-existing hook → install REFUSES loudly, file untouched;
   uninstall also refuses.
4. Trampoline behavior in a REAL temp repo: stage an unbacked source file,
   run `git commit` (not the hook directly) → commit SUCCEEDS (warn mode),
   stderr shows the banner, shadow row appended. With a stub `node` shadowed
   out of PATH → commit still succeeds, loud bootstrap degradation.
   Exit-10 mapping: temporarily force block decision (env or mode fixture from
   T147-04) → `git commit` FAILS with exit≠0, files intact, `git status` still
   shows staged.
5. Linked-worktree warning: in a repo with a linked worktree (create one with
   `git worktree add`), install prints the shared-path warning.
6. ALL existing scenarios still pass (sandbox git EPERM → say so; orchestrator
   re-runs host-side).
JSON.stringify for payloads. SURGICAL CONSTRAINT. <300-word report.
