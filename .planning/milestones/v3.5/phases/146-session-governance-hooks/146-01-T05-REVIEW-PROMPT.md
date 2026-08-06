# Combined Spec (9.4) + ATC (9.5) — P146 T146-05 PostToolUse quality gate

You MUST read the two files below (use whatever read command your environment
provides — reading is required). Do NOT run self-tests, node, or bash. Do NOT
read any other file. Emit the 5 contract lines FIRST, then FINDINGS_DETAIL,
then stop.

## Files
- super-gsd/hooks/sgsd-quality-gate.js (created)
- super-gsd/registry/session-governance-hooks.yaml (T146-05 appended a section;
  T146-04 owns the file)

## PART A — spec compliance
output_contract: report-only PostToolUse gate that resolves active phase from
STATE frontmatter, checks real `{NN}-*-PLAN-LOCKED.md` naming, appends
missing-plan evidence rows. Register ONLY Edit/Write/NotebookEdit. Unknown tool
→ no row, exit 0, never block. Append only to the T146-01-owned ledger.

falsifier — FAILS if: blocks or exits nonzero on edits; logs no row for a
missing active-phase plan; matches unconfirmed mutation tools; emits a row for
an unknown tool name; or includes MultiEdit.

## PART B — ATC through this phase's THREE recurring defects
1. **Writer accepts a caller-supplied destination** (CRITICAL in T146-01, twice
   in T146-02 — the second escaped lexical checks via an NTFS junction). Trace
   every write. Is the ledger derived from `payload.cwd` via the T146-01
   helpers with no caller-controlled path? Could a crafted `cwd` (traversal,
   symlink, junction, UNC) land a write outside a validated SGSD root?
2. **Silent success** (CRITICAL in T146-03 and T146-04). Does this hook read
   anything shipped inside `super-gsd/` (e.g. the registry) using the TARGET
   REPO root rather than `__dirname`? That is exactly how T146-04 silently
   no-opped in every repo lacking super-gsd/. If it reads the registry at all,
   check the resolution base. Are there paths where it returns quietly while
   the observation simply never happens?
3. **Error handlers that can themselves throw.** Are catch blocks and the
   evidence-write calls inside them guarded?

Also check:
4. PLAN-LOCKED matching: does it use the shared T146-01 glob helper (which
   handles BOTH `.planning/phases/` and `.planning/milestones/*/phases/`), or a
   private reimplementation that would miss the milestone-nested layout this
   repo actually uses? A gate that reports "missing plan" for every phase in a
   milestone-nested repo is a false-positive generator.
5. Reason fidelity: is the STATE-without-phase case genuinely distinct from
   missing_plan (the T146-03 review flagged exactly this collapse)?
6. Registry append hygiene: did it restructure/delete T146-04's routes, or
   reintroduce the inert fields T146-04 just removed (schema_version,
   registry_version, owner_phase, intent, predicate.match, kind: none)?
7. Anti-slop: dead exports, unused options, speculative branches.

## Verified by the orchestrator already (27/27 — do NOT re-run)
Edit with no plan → exactly ONE missing_plan row whose phase=999, file_path
contains edited.js, tool_name="Edit", envelope_version=1, exit 0, no block.
Unknown tool → no new row. Write and NotebookEdit both produce rows. Plan
PRESENT → no row. MultiEdit → no row and absent from source. Non-SGSD cwd →
exit 0, empty stdout, ZERO files written. STATE without phase → exit 0 and NO
missing_plan row. empty/garbage/null stdin → exit 0, no stack. T146-04
classifier still routes planning and ignores execution after the registry append.

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <SPEC_VERDICT pass|fix_required|blocked + ATC summary>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)
