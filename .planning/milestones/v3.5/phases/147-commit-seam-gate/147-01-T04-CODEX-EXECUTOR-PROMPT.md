# P147 T147-04 — --shadow-report + explicit --activate-block (mechanical promotion)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS TASK ONLY (T147-04 of 5). Verify before
reporting. Explicit DONE / DONE_WITH_CONCERNS / BLOCKED.

## SMALL PRE-FIX (same file you extend; do this FIRST)
The T147-03 test banner regex is wrong at
`super-gsd/tests/commit-gate/assert-real-commit-gate.cjs:894` and `:931`:
`/SGSD commit gate warning/i` cannot match the real banner
`[SGSD] commit gate warning: ...` (the bracket breaks it). Line 931's
`doesNotMatch` negative control is therefore VACUOUS today. Fix both to match
the real banner (e.g. `/\[SGSD\] commit gate warning/i`) so `hook-warn-unbacked`
and `hook-warn-sentinel-failopen` pass against the REAL hook output and the
docs-only negative control regains meaning. Do NOT change the hook's banner.

## ⚠️ THE TWO DEFECT CLASSES — 13 CRITICALs across P146+P147
1. Containment: derive the ROOT independently of the target. The mode file
   `.planning/config/commit-gate-mode.json` is written ONLY via
   `resolveContainedPath(root, '.planning/config/commit-gate-mode.json')`
   where root came from `findSgsdRoot`. Reads of shadow ledgers use T147-02's
   bounded `readShadowRows`.
2. Silent success: a report over missing/empty/corrupt ledgers must SAY so
   (distinct reason codes, skipped counts) — never render as "0 payloads, no
   problems". An unreadable ledger and a clean one are opposite conclusions.

## Files you may touch
- `super-gsd/scripts/lib/commit-gate-shadow-report.cjs` (CREATE — owns report math)
- `super-gsd/hooks/sgsd-commit-gate.cjs` (EXTEND: wire --shadow-report,
  --activate-block, and mode-file reading; do NOT weaken warn/fail-open paths)
- `.planning/config/commit-gate-mode.json` (created only by explicit activation)
- `super-gsd/tests/commit-gate/assert-real-commit-gate.cjs` (EXTEND + the pre-fix)

## Output contract (locked plan)
`--shadow-report` computes, per repo and total: real payloads, source-touching
counts, would-warn/would-block counts, false-block counts and rates (per-path
evidence vs the repo's ACTUAL artifact naming — this is why rows carry
per-path records), malformed/skipped rows, sentinel skips, internal-error
rows, and the FINAL FALSIFIER VERDICT: pass requires ≥200 real payloads
ACROSS GSDedits AND devcp AND false-block rate <5% per repo AND no
convention_unknown repo in scope. `--activate-block`:
- REFUSES unless the report verdict passes (recompute at activation time —
  never trust a stale report);
- REFUSES for any repo with unknown convention;
- writes the mode file with who/when/report-summary embedded;
- is NEVER a side effect of reporting; reporting is read-only.
Deactivation (back to warn) must always be allowed and logged.

## Falsifier guards (from the plan)
Block activation before a passing report; activation as a reporting side
effect; a passing verdict computed from degraded/missing ledgers; false-block
rate computed without per-path evidence.

## Verify (report exact exit codes)
1. `node --check` all touched files.
2. Regex pre-fix: `hook-warn-unbacked` + `hook-warn-sentinel-failopen`
   scenarios now assert against the REAL banner (run them if your sandbox
   allows git; else say so — orchestrator re-runs host-side).
3. Report math on a SYNTHESIZED ledger pair (write rows via the REAL
   appendShadowRow into two fixture repos): counts, rates, verdict correct;
   a fixture with 199 payloads → verdict FAIL; 200+ with 4.9% → PASS; 5.1% →
   FAIL. Corrupt lines → counted, verdict cannot pass if ledger unreadable.
4. --activate-block on failing verdict → refuses, mode file NOT created.
   On passing verdict → mode file created inside the root with embedded
   summary. Reporting alone NEVER creates it.
5. Deactivation works and is logged.
6. All existing scenarios still pass.
SURGICAL CONSTRAINT. JSON.stringify. <300-word report contract as usual.
