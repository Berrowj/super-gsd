# P146 T146-03 fix — 2 CRITICAL (never-throw + contract suppression) + 1 WARNING

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. File you may touch:
`super-gsd/hooks/sgsd-session-start.js`. Nothing else.

Structure confirmed at source: `main()` line 198; `resolveContext(payload)`
line 200 and `readState(ctx.root)` line 203 both OUTSIDE any try;
`logStatePhaseMissing()` called from catch blocks at lines 208 and 216;
`emitGovernanceContext()` line 162 with its `console.log` at line 166.

## CRIT-1 — never-throw is not actually guaranteed
`main()` has no top-level guard. `resolveContext` can propagate from
`findSgsdRoot`; `readState` is unguarded; and the catch blocks themselves call
`logStatePhaseMissing()` unguarded, so `logGateEvidence()` throwing INSIDE an
error handler escapes with a stack trace and a nonzero exit. A SessionStart
hook that exits nonzero with a stack is exactly what the board-binding
constraint forbids.
Fix: wrap the ENTIRE body of `main()` in a top-level try/catch that guarantees
exit 0 and no stack trace on stdout/stderr. Additionally guard every
`logStatePhaseMissing()` / evidence-write call site (including those inside
catch blocks) so a failing writer can never propagate. Error handlers must be
incapable of throwing.

## CRIT-2 — optional enrichment can suppress the governance contract
`emitGovernanceContext()` performs optional checkpoint/memory briefing BEFORE
`console.log()` at line 166. If checkpoint read or parse hits an unexpected
filesystem error (EACCES, EBUSY, corrupt JSON, huge file), the contract is
never emitted and the session gets NO governance context — silently defeating
AC-146a.
Fix: make the governance contract emission unconditional and FIRST. Build and
print the mandatory sections (ATC tier table, gate table, mode-confirmation
note, active milestone/phase) before attempting any optional enrichment. Each
optional section (checkpoint, memory briefing, handoff pairing) must be
individually wrapped so its failure degrades only that section — never the
contract. Preferred shape: compose mandatory text → emit → then append optional
sections best-effort. If the harness requires a single stdout write, build the
mandatory string first, then guard each optional append independently so a
throw cannot discard already-composed mandatory content.

## WARN-1 — misleading evidence rows
Failure catch paths reuse the `state_phase_missing` row shape for
`session_start_governance_failed` and `session_start_handoff_pairing_failed`.
With a genuinely missing phase PLUS a later handoff failure, the ledger gets
duplicate/misleading missing-phase evidence.
Fix: emit a distinct reason_code per failure kind. `state_phase_missing` must
mean exactly that and nothing else. Keep the row shape envelope-v1 via the
T146-01 writer — do not invent a second writer.

## Preserve (must not regress — 21/21 host checks currently pass)
- fixture repo (milestone v9.9 / current_phase 873) → contract contains v9.9
  and 873 and contains NEITHER this repo's v3.5 NOR 146;
- non-SGSD cwd → exit 0, EMPTY stdout, zero files written;
- SGSD repo whose STATE lacks a phase → exit 0, contract still emitted,
  exactly ONE state_phase_missing row;
- empty / garbage / null stdin → exit 0, no stack trace;
- nonexistent cwd → exit 0;
- never emits `decision` or `continue:false`; never blocks;
- never reads/logs ~/.claude/settings.json or any env value;
- pre-existing handoff-pairing behavior still works.

## Add these regression checks to your verification
- simulate an optional-enrichment failure (e.g. point the checkpoint path at a
  DIRECTORY instead of a file, or at unreadable/corrupt JSON) and assert the
  governance contract is STILL emitted and exit is 0;
- simulate an evidence-writer failure inside a catch path (e.g. make the
  metrics dir a file so append fails) and assert exit 0 with no stack trace;
- assert a handoff-pairing failure does NOT append a `state_phase_missing` row.

## Verify (report exact exit codes)
1. `node --check super-gsd/hooks/sgsd-session-start.js`
2. All six preserve-cases above.
3. The three new regression checks above.
If your sandbox blocks node, say so in BLOCKERS and still report changes.

SURGICAL CONSTRAINT — every changed line must trace to a finding above. Do not
weaken or delete existing behavior to make a check pass. Orphan edits are
DEVIATIONS: report, do not commit silently.

## Report contract (<300 words)
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none expected
ONE_LINER: substantive summary
