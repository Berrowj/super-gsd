# P146 T146-06 — cockpit + MCP reader for gate-evidence (AC-146c consumer half)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS TASK ONLY (T146-06 of 7). Verify before
reporting. Explicit DONE / DONE_WITH_CONCERNS / BLOCKED.

## Why this task exists
T146-05 PRODUCES `missing_plan` rows. Nothing reads them yet. VTP research for
this phase was explicit: a report-only gate whose evidence no one reads is an
unevaluated defence — AC-146c is not satisfied by logging alone. This task is
the consumer half.

## ⚠️ RECURRING DEFECTS IN THIS PHASE — all three have shipped as CRITICALs
1. **Writer accepts a caller-supplied destination** (T146-01; twice in T146-02,
   the second escaping a lexical check via an NTFS junction).
2. **Silent success** (T146-03: optional work suppressed mandatory output;
   T146-04: a `super-gsd/`-shipped resource resolved from the TARGET REPO root,
   so the hook silently did nothing in its actual deployment).
3. **Error handlers that can themselves throw.**
This task is READ-ONLY over the evidence stream, which removes #1 — but #2 and
#3 apply directly. See the hard constraints below.

## Files you may touch (nothing else)
- `super-gsd/tools/cockpit-state/adapter.cjs`
- `super-gsd/tools/warp-mcp/server.cjs`

## Output contract (locked plan)
Expose missing-plan gate-evidence rows through BOTH the cockpit adapter output
and the MCP reader output. This task READS
`.planning/metrics/gate-evidence.jsonl` (owned by T146-01) and **must not
create, append, or rewrite that stream.**

## Falsifier — the task FAILS if any holds
- the cockpit adapter cannot surface the row within one refresh;
- MCP output disagrees with the adapter;
- the reader WRITES to `gate-evidence.jsonl`;
- missing evidence degrades the WHOLE snapshot instead of only the governance
  signal.

That last one is the critical design constraint: if the ledger is absent,
unreadable, empty, or contains a corrupt line, the cockpit snapshot must still
render everything else normally, with only the governance signal showing as
empty/unavailable. A missing optional stream must never blank the dashboard.

## Hard constraints
- READ-ONLY on the evidence stream. No writes, no create-on-read, no
  rewrite-to-normalise. If the file does not exist, that is a normal empty state.
- Use the T146-01 reader (`readGateEvidenceRows`) rather than a private
  re-parse, and pass its bounded `limit` option — the ledger grows unboundedly
  and the cockpit must not read the whole file each refresh. State the limit
  you chose and why.
- Corrupt/partial JSON lines must be skipped individually, not abort the read.
- Adapter and MCP must agree: same source, same shape, same values. Do not
  compute the signal twice with two different code paths — derive once and
  reuse, or make the MCP call the adapter.
- Never throw upward from either surface; degrade to an empty governance
  signal with a non-stack breadcrumb.
- Windows-safe, Node built-ins only, no new dependencies.

## Required behavior matrix
- Fixture repo where the REAL T146-05 hook has emitted a `missing_plan` row →
  adapter `--json` output contains that row's `phase` and `file_path`, and the
  MCP snapshot response contains the SAME `phase` and `file_path`.
- Ledger ABSENT → adapter still returns a full valid snapshot (all other
  sections intact), governance signal empty; exit 0.
- Ledger present but EMPTY → same as absent.
- Ledger containing a corrupt line followed by a VALID `missing_plan` row →
  the valid row is still surfaced; no throw.
- Reader run twice → `gate-evidence.jsonl` byte-identical afterwards (proves
  read-only).

## Verify (report exact exit codes)
1. `node --check` both modified files.
2. Every row of the behavior matrix. For the first row, emit the evidence by
   actually running `super-gsd/hooks/sgsd-quality-gate.js` against a temp
   fixture (a real row, not a hand-written one) — the plan's stop_rule requires
   the row to come from the real hook.
3. Confirm existing adapter/MCP behavior is unchanged for repos with no
   governance evidence (no regression to other snapshot sections).
Build payloads with JSON.stringify — hand-written JSON containing Windows paths
breaks on unescaped backslashes and silently yields an empty payload.
If your sandbox blocks node, say so in BLOCKERS and still report changes.

SURGICAL CONSTRAINT — every changed line must trace to T146-06. These are large
shared files: touch ONLY what this task needs. Orphan edits are DEVIATIONS:
report, do not commit silently. Match existing style.

## Report contract (<300 words)
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none expected
ONE_LINER: substantive summary
