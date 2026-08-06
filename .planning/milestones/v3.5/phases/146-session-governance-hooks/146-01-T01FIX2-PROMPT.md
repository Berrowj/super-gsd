# P146 T146-01 CRIT-1 tightening — require STATE.md, not just a .planning dir

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. File you may touch:
`super-gsd/scripts/lib/gate-evidence-log.cjs`. Nothing else.

## Defect (re-review CRIT-1, reproduced by live probe)
The previous fix root-bounded writes to a `.planning` directory, but a
`.planning` directory ALONE is not proof of an SGSD repo. `_planningDir()`
returns early for a direct `.planning` input (~line 55) and for a
repo-root/direct-child `.planning` (~lines 58-59) BEFORE the `_hasStateFile`
guard, which is currently applied only on the ancestor-walk path (~line 66).

Reproduced host-side, both input forms wrote a real ledger file:
  mkdir <tmp>/.planning   (no STATE.md)
  logGateEvidence("<tmp>/.planning", {...}) → status ok, file created
  logGateEvidence("<tmp>",            {...}) → file created
Board-binding AC-146d requires that a non-SGSD repo produce NO SGSD metrics.
An unrelated tool's `.planning` folder must not become a write target.

## Fix
Apply the SAME `_hasStateFile` (STATE.md presence) requirement to EVERY
resolution path — direct `.planning` input, repo-root/direct-child, and
ancestor walk. No path may return a writable ledger dir unless that
`.planning` actually contains `STATE.md`. When the guard fails, no-op exactly
as the non-SGSD case already does: create nothing, return the same falsey
no-op value, never throw.

Keep every currently-passing behavior intact:
- real repo (this worktree) still writes rows;
- non-SGSD dir still creates nothing and returns null;
- bounded read, BOM parsing, exports unchanged;
- never-throw preserved on garbage input.

State the accepted-input contract in a short comment above the resolver:
which inputs are valid (repo root containing .planning/STATE.md, or the
.planning dir itself containing STATE.md) and what happens otherwise.

## Verify (report exact exit codes)
1. `node --check super-gsd/scripts/lib/gate-evidence-log.cjs`
2. `<tmp>/.planning` WITHOUT STATE.md → no file created anywhere under tmp,
   no-op return, no throw. Test BOTH input forms (the `.planning` dir itself
   AND its parent).
3. `<tmp>/.planning` WITH a STATE.md → row appended and parses as
   envelope-v1.
4. This real repo → row still appends to .planning/metrics/gate-evidence.jsonl
   (write to a temp copy if you prefer not to touch the live ledger).
5. Bounded read still honors `limit`.
If your sandbox cannot run node, say so in BLOCKERS and still report changes.

SURGICAL CONSTRAINT — every changed line must trace to this finding. Orphan
edits are DEVIATIONS: report, do not commit silently. Match existing style.

## Report contract (<300 words)
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none expected
ONE_LINER: substantive summary
