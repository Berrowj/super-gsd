---
phase: "147"
artifact: RESEARCH
provider: openai-codex (gpt-5.5/xhigh)
wrapper_exit: 6 (contract-vocab mismatch — codex-exec enforces the 5-line ATC
  contract on every --step; research body is valid. 354KB raw stream discarded.)
---

**1. AC-147 Verbatim**
> **AC-147:** (a) warn rows accumulate on real commits in both repos; (b)  
> `--shadow-report` computes the falsifier verdict mechanically; (c) block mode  
> cannot activate before the falsifier passes; (d) sentinel bypass is logged.

Source: `.planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md:101-103`.

**2. Q1-Q9**
Q1. Git hook install: this checkout is a linked worktree: `.git:1` points to `$HOME/GSDedits/.git/worktrees/cholla-racer`, and `git rev-parse --git-path hooks/pre-commit` resolves to the common dir `$HOME/GSDedits/.git/hooks/pre-commit`. `core.hooksPath` is unset. Installer should ask Git for the hook path, honor existing `core.hooksPath`, and not silently set it. Default hook install here is shared across worktrees. On Windows, install a POSIX `#!/bin/sh` trampoline that calls `node "<repo>/super-gsd/hooks/sgsd-commit-gate.cjs"`; do not rely on executing `.cjs` directly. Existing hook policy: create if absent, refresh SGSD marked block if present, refuse or explicitly chain/backup unmarked hooks. Rollback must be “remove hook file,” per `.planning/.../CONTEXT.md:36-38`.

Q2. Use staged-only Git evidence:
`git diff --cached --name-status -z --find-renames --find-copies --`
for NUL-safe path/status parsing, and stream-hash:
`git diff --cached --binary --full-index --no-ext-diff --no-color --`
for complete staged evidence. Renames/copies have old+new paths; deletes still count by old path; binary diff should be hashed, not embedded in JSON. Cost is O(staged diff bytes), acceptable at commit seam per board rationale `.planning/decisions/2026-08-02-always-on-gate-substrate.md:125-128`.

Q3. “Source-touching”: any staged A/C/M/R/D/T path in runtime/config surfaces: `super-gsd/**`, `.agents/**`, `.codex/**`, `.warp/workflows/**`, `custom-gsd-extract/**`, `package*.json`, plus code/config extensions outside `.planning/**`. Exclude `.planning/**`, `.planning/metrics/**`, `docs/**`, root `README.md`, report-only Markdown outside runtime dirs. Risks: docs under `super-gsd/**` may warn; governance config commits are intentionally source; excluding `.planning/**` may miss malicious executable payloads placed there.

Q4. GSDedits predicate: use `readState()` frontmatter only and `findPlanLockedFiles(root, state.phase, state.milestone)`. Helpers already implement real containment and milestone scope: `sgsd-state.cjs:76-98`, `:162-184`, `:194-198`, `:244-262`. Current canonical state still says `current_phase: "146"` (`.planning/STATE.md:3-7`), and the helper finds `.planning/milestones/v3.5/phases/146-session-governance-hooks/146-01-PLAN-LOCKED.md`. P147 is only `PENDING` in context (`CONTEXT.md:2-6`). Actual GSDedits assurance naming is `*-ATC-REVIEW.md` / `*-ATC-REVIEW2.md`; P146 examples are `146-ATC-REVIEW.md` and `146-ATC-REVIEW2.md`. Bare `PLAN.md` / `AUDIT.md` is known false here (`decisions/...gate-substrate.md:54-59`).

Q5. devcp is not reachable inside the permitted workspace; only references exist. Safe design: discover conventions at runtime from repo-local `.planning` history/config, record `artifact_convention_status`, and never hardcode devcp. If unknown, warn/skip with `convention_unknown`; block mode must not activate for that repo.

Q6. `--shadow-report` reads `.planning/metrics/commit-gate-shadow.jsonl` from GSDedits and devcp. It must compute: total real payloads, per-repo payload counts, source-touching count, would-warn/would-block counts, false-block count/rate against discovered actual artifact names, malformed/skipped rows, sentinel skips, internal-error rows, and final falsifier verdict. Gate needs rows with `repo_id`, `commit_candidate`, `diff_sha256`, `staged_paths`, `artifact_predicate_version`, discovered plan/assurance paths, `would_block`, and `false_block_basis`.

Q7. Self-lock risks: blocking commit that removes/modifies the hook; blocking sentinel add/remove; Node missing causing shell failure; existing hook chain exits before SGSD; `core.hooksPath` config rollback; writer path escape/symlink failure; internal exception fail-close. Mitigate with sentinel checked before block and logged, shell wrapper exits 0 if Node missing, narrow try/catch exit 0 (`DESIGN.md:175-179`), uninstall by deleting hook file outside Git, and shadow writer using `resolveContainedPath`.

Q8. Non-SGSD/error behavior: if no SGSD root, print loud stderr and exit 0, with no arbitrary repo writes. If SGSD root exists, append a shadow row under `.planning/metrics/commit-gate-shadow.jsonl` with distinct reason code. P146 quality gate already models loud warning plus degraded evidence (`sgsd-quality-gate.js:29-62`, `:184-193`).

Q9. Risks: `--no-verify` bypasses hooks; some IDE/GUI clients may bypass or hide stderr; commits can stage huge diffs/binaries; hook path in this worktree is common, so install scope may surprise. DEFERRED-F is mostly closed for staged commits regardless of Bash redirection, but not for unstaged/uncommitted files. DEFERRED-G should stay a separate low-risk task unless the planner explicitly wants SessionStart token trim; P146 flags it as content/UX, not correctness (`146-ATC-GAP-PLAN.md:60-66`).

**3. Files**
- `super-gsd/hooks/sgsd-commit-gate.cjs` — hook CLI, diff parser, warn/block/sentinel/report modes.
- `super-gsd/scripts/lib/commit-gate-shadow-log.cjs` — contained append/read/report helpers for shadow JSONL.
- `super-gsd/scripts/lib/sgsd-artifact-conventions.cjs` — repo-specific artifact discovery/evaluation.
- `super-gsd/scripts/install-commit-gate.cjs` — idempotent Git hook installer/uninstaller.
- `super-gsd/install.sh` — wire installer/update/dry-run messaging.
- `super-gsd/tests/commit-gate/run-self-test.cjs` — temp-repo deterministic coverage.

**4. Reuse**
Reuse `findSgsdRoot`, `readState`, `findPlanLockedFiles`, `resolveContainedPath` from `sgsd-state.cjs`; reuse envelope/degradation shape and tail-read pattern from `gate-evidence-log.cjs:159-177`, `:234-258`; mirror P146 `safeWarn`/degraded rows from `sgsd-quality-gate.js`.

**5. Tasks + Verification**
1. Artifact discovery: `node super-gsd/tests/commit-gate/run-self-test.cjs --case artifact-conventions`
2. Shadow ledger containment: `node super-gsd/tests/commit-gate/run-self-test.cjs --case shadow-ledger`
3. Diff/source/sentinel gate: `node super-gsd/tests/commit-gate/run-self-test.cjs --case diff-source-sentinel`
4. Shadow report falsifier: `node super-gsd/tests/commit-gate/run-self-test.cjs --case shadow-report`
5. Installer idempotency/worktree hooks: `node super-gsd/scripts/install-commit-gate.cjs --self-test`
6. Whole feature: `node super-gsd/tests/commit-gate/run-self-test.cjs`

**6. Open Decisions**
Repoint `STATE.md` to P147 before dogfooding; choose existing-hook policy; define exact GSDedits assurance predicate (`ATC-REVIEW*` only vs `VERIFICATION` too); choose explicit block-mode activation storage; decide whether DEFERRED-G belongs in P147 or a follow-on.

No files modified and no tests run.

