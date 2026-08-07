# P147 phase-verify gap fix — earned block must be UNFORGEABLE + falsifier non-vacuous

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. Files:
`super-gsd/hooks/sgsd-commit-gate.cjs`,
`super-gsd/scripts/lib/commit-gate-shadow-report.cjs`,
`super-gsd/scripts/lib/sgsd-artifact-conventions.cjs`,
`super-gsd/tests/commit-gate/assert-real-commit-gate.cjs`. Nothing else.

## GAP-1 (CRITICAL) — mode-file trust bypasses earned activation
`--activate-block` recomputes and refuses correctly, but `readCommitGateMode`
(~274-277) treats ANY readable JSON with `mode:"block"` as active. A manually
created `.planning/config/commit-gate-mode.json` therefore activates blocking
with no falsifier, no activation row — AC-147c defeated at the read seam.
### Fix
Make activation UNFORGEABLE by the read path:
- at activation, write the mode file with an embedded activation record:
  `activated_at`, `report_summary` (payload counts + rates + verdict), and an
  integrity digest (e.g. sha256 over a canonical serialization of the record
  plus a fixed context string). No secrets available, so this is
  tamper-EVIDENT, not tamper-proof — that is acceptable and must be stated in
  a comment: the goal is that no bare `{mode:"block"}` and no casually edited
  file passes validation.
- `readCommitGateMode` validates shape + digest; ANY invalid/bare/edited mode
  file → treated as warn mode + a distinct degraded row
  (`mode_file_invalid`) + loud stderr. Never block on an invalid mode file.

## GAP-2 (CRITICAL) — falsifier is vacuous for a zero-evidence repo
The ≥200 threshold is GLOBAL and rates on zero source samples read as 0%.
A devcp with zero source-touching rows passes. Mechanically true,
semantically empty — this milestone's signature defect.
### Fix
Per REQUIRED repo: require a minimum real-payload floor (choose and state;
suggest ≥50) AND `source_touching_count > 0`. A repo below floor →
`insufficient_repo_payloads_<repo>`; zero source samples →
`no_source_evidence_<repo>`. Keep the global ≥200 and per-repo <5% rules.

## GAP-3 — block decision must require its evidence row to have PERSISTED
In block mode the hook returns exit 10 even when `appendShadowRow` failed.
Board rule: internal errors exit 0 loudly. A block whose evidence write
failed IS an internal error.
### Fix
Return the block exit ONLY when the shadow row for that decision persisted
(appendShadowRow returned a row). Writer refused/failed → degrade to warn
(exit 0), loud stderr naming both the would-block verdict AND the write
failure, plus a degraded row attempt with distinct reason code.

## GAP-4 — `_stateLooksLikeGsdedits` misclassifies devcp
Any repo containing `super-gsd/` + v-style state is treated as GSDedits
BEFORE generic discovery. devcp CONTAINS super-gsd/ (it is the propagation
target), so the one repo runtime discovery exists for would skip it.
### Fix
Tighten: prefer repo-local artifact EVIDENCE (actual {NN}-*-PLAN-LOCKED.md +
*-ATC-REVIEW*.md files found by the milestone-scoped helper) over directory
presence. The heuristic may remain only as a LAST resort after evidence-based
discovery, and when it fires it must be visible in the convention result
(e.g. `convention_basis: "heuristic"` vs `"artifact_evidence"`) so report
consumers can see which repos were classified by guess.

## Also (from verifier DEVIATIONS)
The plan SAC text says `staged_paths[0].path` but the row contract stores
staged_paths as strings with per-path records in `path_evidence`. Do NOT
change the row contract; add/adjust a test assertion that documents the
actual contract (path_evidence carries the objects).

## Preserve — all 18 scenarios pass host-side today; they must still pass
(sandbox may block git spawn EPERM — say so; orchestrator re-runs host-side).
Falsifier boundary behavior for the already-proven cases must not regress:
199→fail, 240@4.2% known-conv→PASS (with per-repo floors now satisfied in
that fixture — update the fixture seeding if needed to keep it a TRUE pass),
5.8% one repo→fail, unknown-conv→fail.

## Verify (report exact exit codes)
1. `node --check` all touched files.
2. GAP-1: bare `{"mode":"block"}` planted → hook stays in WARN mode, degraded
   `mode_file_invalid` row, loud stderr; a genuine `--activate-block`-written
   file → block honored; the same file with one digit edited → warn + invalid.
3. GAP-2: 240 rows all in GSDedits, devcp present with 0 source rows →
   verdict FAIL with `no_source_evidence_devcp`; balanced fixture → PASS.
4. GAP-3: force appendShadowRow failure (metrics as file) in an
   earned-block fixture → `git commit`/hook exits 0 (warn), loud stderr names
   the suppressed block.
5. GAP-4: a devcp-shaped fixture CONTAINING super-gsd/ but with its own
   distinct .planning artifacts → convention derived from artifact evidence,
   basis field says so; heuristic-only case still works but is labeled.
6. Full 18-scenario suite.
SURGICAL CONSTRAINT. JSON.stringify. <300-word report.
