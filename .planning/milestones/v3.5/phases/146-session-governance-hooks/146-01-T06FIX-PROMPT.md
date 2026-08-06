# P146 T146-06 fix — 1 CRITICAL (silent success) + 1 WARNING (stale signal)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. File you may touch:
`super-gsd/tools/cockpit-state/adapter.cjs`. Nothing else.
(`super-gsd/scripts/lib/gate-evidence-log.cjs` is owned by T146-01 and is OUT
of scope for this task — see the deferred note at the bottom.)

## CRIT-1 — unreadable ledger is indistinguishable from "no problems"
`adapter.cjs:944-968` breadcrumbs only three cases: module missing, non-array
return, or a thrown reader. If `readGateEvidenceRows` internally converts an
unreadable / corrupt / partially-written ledger into `[]` (it is a never-throw
reader, so it does), governance emits
`{"missing_plan":[], "missing_plan_count":0, "breadcrumb":null}` —
byte-identical to a genuinely healthy repo.

On a dashboard those are OPPOSITE conclusions: "no governance problems" versus
"governance monitoring is broken". Reporting the second as the first is this
phase's recurring **silent success** defect (CRITICAL in T146-03 and T146-04),
and here it lands on the operator-facing surface.

### Required fix
Distinguish the three states explicitly in the governance section:
  - `ok`        — ledger read successfully (0 or more rows);
  - `empty`     — ledger genuinely absent / zero-length (a NORMAL state, not an error);
  - `unavailable` — ledger exists but could not be read or parsed as expected.
Determine `unavailable` from evidence the adapter can gather ITSELF without
changing the T146-01 reader: e.g. the ledger path exists and has non-zero size,
yet the reader returned zero rows; or `fs.statSync` succeeds but the entry is
not a regular file; or a read probe throws. Populate `breadcrumb` with a short
NON-STACK reason string on `unavailable`, and never throw.
A consumer must be able to tell "clean" from "blind" from the payload alone.

## WARN-1 — stale rows become permanent false alarms
`adapter.cjs:949-964` surfaces raw recent `missing_plan` history with no
active-phase scoping, no dedupe, and no retraction. Rows accumulate forever, so
once a phase is flagged it stays flagged even after its PLAN-LOCKED file
exists. A cockpit tile that cries wolf gets ignored, and an ignored governance
surface is worth less than none — which defeats AC-146c.

### Required fix
Scope the surfaced signal to CURRENT state:
  - restrict to the ACTIVE phase from STATE frontmatter (use the T146-01
    resolver the adapter already has access to);
  - dedupe by (phase, file_path) so one file edited ten times is one signal;
  - RETRACT: if a matching `{NN}-*-PLAN-LOCKED.md` now exists for that phase,
    do not surface the row at all (use the shared PLAN-LOCKED glob helper —
    do not reimplement the lookup; it must handle BOTH `.planning/phases/` and
    `.planning/milestones/*/phases/` layouts).
Keep the raw count available if useful (e.g. `historic_count`), but the primary
`missing_plan` list must mean "currently true".

## WARN-2 — bounded read is unproven (clamp only; do NOT fix the reader here)
`limit: 100` is passed to the external reader but the adapter does not clamp
what comes back. Defensively clamp the returned array to the limit in the
adapter so a reader regression cannot flood the snapshot. True read-time
tailing belongs in the T146-01 reader and is OUT of scope for this task —
the orchestrator is recording it as a deferred item for T146-07.

## Preserve (17/17 currently pass — must not regress)
- a row emitted by the REAL T146-05 hook surfaces with correct phase and
  file_path when that phase has NO plan;
- MCP continues to inherit the identical signal via existing adapter
  delegation (do NOT add a second read path in the MCP server);
- ledger ABSENT or EMPTY → exit 0, FULL snapshot, other sections intact;
- corrupt line followed by a valid row → the valid row still surfaces;
- adapter remains strictly READ-ONLY: `gate-evidence.jsonl` byte-identical
  after repeated runs (no create-on-read, no rewrite-to-normalise);
- non-SGSD cwd → no stack trace;
- never throws upward from the adapter.

## Verify (report exact exit codes)
1. `node --check super-gsd/tools/cockpit-state/adapter.cjs`
2. Every preserve item above.
3. NEW: ledger present with non-zero size but unreadable-as-expected →
   governance state is `unavailable` with a populated non-stack breadcrumb,
   NOT `count:0 / breadcrumb:null`.
4. NEW: retraction — emit a real missing_plan row via the T146-05 hook, then
   create a matching `{NN}-*-PLAN-LOCKED.md` for that phase, re-run the
   adapter, and assert the row is NO LONGER surfaced.
5. NEW: dedupe — same (phase, file_path) edited three times → ONE entry.
6. NEW: rows for a NON-active phase are not surfaced.
Build any JSON payloads with JSON.stringify (hand-written JSON with Windows
paths breaks on unescaped backslashes).
If your sandbox blocks node, say so in BLOCKERS and still report changes.

SURGICAL CONSTRAINT — every changed line must trace to a finding above. This is
a large shared file: touch only the governance section. Orphan edits are
DEVIATIONS: report, do not commit silently.

## Report contract (<300 words)
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none expected
ONE_LINER: substantive summary
