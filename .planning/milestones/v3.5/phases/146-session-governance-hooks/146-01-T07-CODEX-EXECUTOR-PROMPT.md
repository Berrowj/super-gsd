# P146 T146-07 — cheap-fixes cleanup + two deferred items (FINAL task of the phase)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS TASK ONLY (T146-07 of 7, the last).
Verify before reporting. Explicit DONE / DONE_WITH_CONCERNS / BLOCKED.

## ⚠️ THIS PHASE'S RECURRING DEFECTS (all shipped as CRITICALs — do not add a fourth)
1. **Writer accepts a caller-supplied destination** (T146-01; twice in T146-02,
   the second escaping lexical checks via an NTFS junction).
2. **Silent success** (T146-03 optional work suppressed mandatory output;
   T146-04 a `super-gsd/`-shipped resource resolved from the TARGET REPO root;
   T146-06 a blind ledger rendered as a clean bill of health).
3. **Error handlers that can themselves throw.**

## Files you may touch
- `super-gsd/scripts/sgsd-stop-handoff.sh`
- `super-gsd/tools/autopilot-watchdog/check.cjs`
- `super-gsd/config/settings-overlay.json`  (cleanup ONLY)
- `super-gsd/scripts/lib/gate-evidence-log.cjs`  (DEFERRED-E only, see below)
- `super-gsd/hooks/sgsd-session-start.js`        (DEFERRED-D only, see below)

## A. Locked cleanup list (from the plan's output_contract)
1. **Handoff latch reset.** `sgsd-stop-handoff.sh` derives `CHAIN_DEPTH` from
   the last SPAWNED row only (~448-523), filtering `reason === 'spawned'`
   (~485-500). A `refused` row therefore never resets the chain — board
   evidence shows refused depth 5 latched since 2026-04-24T15:55:17Z. Fix: when
   the LATEST valid row is `reason: "refused"`, treat previous depth as 0
   before computing chain depth.
2. **Watchdog phase resolution.** `autopilot-watchdog/check.cjs` (~119-130)
   falls back to prose regex `status.match(/\bPhase\s+([0-9]+)\b/i)` and
   `phase_([0-9]+)`. Replace with the shared T146-01 helper
   (`super-gsd/scripts/lib/sgsd-state.cjs` → `readState`), which reads
   `current_phase` frontmatter and NEVER prose-parses. Keep a graceful path when
   the helper returns null. Provide `--self-test-phase-resolution` (the plan's
   verification calls exactly this) asserting frontmatter is used and prose is not.
3. **Unregister dead `gsd-atc-slice-gate.js`** references wherever they are
   still registered in live config.
4. **Delete dead config knobs** proven to have zero runtime readers:
   `token_efficiency.checkpoint_threshold_percent`,
   `token_efficiency.context_warning_percent`, `hooks.context_warnings`.
   Grep before deleting; if any DOES have a reader, keep it and say so.
   `settings-overlay.json` edits are cleanup-only and **must not rewrite the
   T146-02 repo-local hook entries or the `sgsd_managed` markers.**

## B. DEFERRED-D (carried from T146-03 review)
`sgsd-session-start.js`: the outer fail-open guard swallows any error raised
BEFORE context resolution (`resolveContext`/`readState`, ~240-243); the catch
(~255-257) only comments and returns. The distinct failure rows added by the
earlier fix exist only AFTER state is read (~247, ~253). Consequence: a hook
broken at startup looks healthy forever.
Fix: emit a NON-STACK stderr breadcrumb from the outer guard (and an evidence
row once a root is known). Must NOT print a stack trace, must NOT exit nonzero,
must NOT suppress the governance contract.

## C. DEFERRED-E (carried from T146-06 review)
`gate-evidence-log.cjs` `readGateEvidenceRows` accepts a `limit` but read-time
tailing is unproven — it may read and parse the WHOLE ledger before slicing.
The ledger grows unboundedly and the cockpit reads it every refresh.
Fix: make the bound real (tail-read, or a bounded reverse scan) so cost is
proportional to `limit`, not to file size. Preserve exact current semantics:
never throws, returns most-recent-first-or-last exactly as today (state which),
same row shape, and the T146-06 adapter must keep passing.

## Hard constraints
- Do NOT touch `codex-exec.sh` / DEVIATION-W — research did not prove it is a
  small isolated fix, and the plan explicitly excludes it from this task.
- Do NOT restructure `session-governance-hooks.yaml` (T146-04/05 own it).
- Windows-safe, Node built-ins only, no new dependencies.

## Verify (report exact exit codes)
1. `bash -n super-gsd/scripts/sgsd-stop-handoff.sh`
2. `node super-gsd/tools/autopilot-watchdog/check.cjs --self-test-phase-resolution`
3. `node --check` every JS/CJS file you touched.
4. Handoff latch: construct a fixture whose latest valid row is `refused` and
   assert chain depth resets to 0; and one whose latest row is `spawned` and
   assert existing behavior is unchanged.
5. DEFERRED-D: force a pre-context failure and assert a non-stack stderr
   breadcrumb appears, exit is 0, and the governance contract STILL emits.
6. DEFERRED-E: build a ledger with ~5000 rows, assert `readGateEvidenceRows`
   with `limit: 100` returns 100 rows and report the timing; assert the T146-06
   adapter still surfaces a real row correctly.
7. Regression: `node super-gsd/tools/cockpit-state/adapter.cjs --self-test`
   must still report 19/19 (it does today on the host — if your sandbox shows
   A7/A10 failures those are sandbox artifacts, say so and continue).
8. Confirm `grep -c sgsd_managed super-gsd/config/settings-overlay.json` is
   unchanged by your cleanup.
If your sandbox blocks bash/node, say so in BLOCKERS and still report changes.

SURGICAL CONSTRAINT — every changed line must trace to A, B, or C above. Orphan
edits are DEVIATIONS: report, do not commit silently. Match existing style.

## Report contract (<300 words)
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: path | purpose | interface | none
ONE_LINER: substantive summary
