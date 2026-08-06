# P146 T146-05 — PostToolUse quality gate (REPORT-ONLY producer)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS TASK ONLY (T146-05 of 7). Verify before
reporting. Explicit DONE / DONE_WITH_CONCERNS / BLOCKED.

## ⚠️ THREE RECURRING DEFECTS ALREADY SHIPPED IN THIS PHASE — do not repeat
1. **Writer accepts a caller-supplied destination.** CRITICAL in T146-01 and
   TWICE in T146-02 (the second escaped a lexical check via an NTFS junction).
   DERIVE the ledger from `payload.cwd` through the T146-01 helpers. Never
   write to a handed-in path. Outside a validated SGSD root: write NOTHING,
   exit 0, silent.
2. **Silent success.** CRITICAL in T146-03 (optional work before the mandatory
   emit suppressed everything) and in T146-04 (registry resolved from the wrong
   root, so the hook silently did nothing in exactly its target deployment).
   Anything shipped inside `super-gsd/` that this hook needs must resolve from
   `__dirname`, NOT from the target repo root. Mandatory work happens first;
   every optional step is individually guarded; a swallowed error still leaves
   a NON-STACK stderr breadcrumb.
3. **Error handlers that can themselves throw.** Wrap them.

## Files you may touch
- `super-gsd/hooks/sgsd-quality-gate.js`             (CREATE)
- `super-gsd/registry/session-governance-hooks.yaml` (APPEND your section only —
  T146-04 OWNS this file; do not restructure or delete its routes)
- `.planning/metrics/gate-evidence.jsonl`            (append only, via T146-01 writer)

## Output contract (locked plan)
A REPORT-ONLY PostToolUse quality gate that resolves the active phase from
STATE frontmatter, checks real `{NN}-*-PLAN-LOCKED.md` naming, and appends
missing-plan evidence rows. Register ONLY `Edit`, `Write`, `NotebookEdit` in
the registry. Unknown tool name → no row, exit 0, never block. Append only to
the T146-01-owned ledger.

## Input contract
The confirmed PostToolUse file-mutation matcher for THIS harness is exactly
`Edit`, `Write`, `NotebookEdit`. **There is NO `MultiEdit` in this harness** —
including it is an explicit falsifier. Per RESEARCH Q1 the payload carries
`tool_name`, `tool_input`, `tool_response`, `duration_ms`, plus the common
`cwd` / `session_id` / `hook_event_name`.

## Falsifier — the task FAILS if any holds
The hook blocks or exits nonzero on edits; logs no row when the active phase
has no PLAN; matches unconfirmed mutation tools; emits a row for an unknown
tool name; or includes MultiEdit.

## BOARD-BINDING: report-only, no edit-seam blocking
Never emit `decision`, never `continue:false`, never exit nonzero on a normal
PostToolUse. This gate OBSERVES; it does not stop work. Per RESEARCH Q1 a
PostToolUse exit-2 cannot undo the edit anyway — blocking here would be pure
friction with no protection.

## Evidence row requirements
When the active phase has NO matching `{NN}-*-PLAN-LOCKED.md`, append ONE
envelope-v1 row via the T146-01 writer with:
- a `missing_plan` signal;
- the resolved `phase` (from STATE frontmatter — never prose parsing);
- the edited `file_path` from `tool_input`;
- the `tool_name`.
The plan's acceptance asserts those field VALUES match the fixture, so they
must be real, not placeholders. When a PLAN does exist for the active phase,
append NO missing_plan row.

## Required behavior matrix
- SGSD fixture repo, active phase with NO plan, `tool_name: "Edit"` →
  exactly ONE missing_plan row whose phase/file_path/tool_name match; exit 0.
- Same fixture, `tool_name: "UnconfirmedMutator"` → NO row, exit 0, ledger
  line-count unchanged.
- Same fixture but a real `{NN}-*-PLAN-LOCKED.md` present for the active
  phase → NO missing_plan row, exit 0.
- `Write` and `NotebookEdit` behave like `Edit`.
- Non-SGSD cwd → exit 0, empty stdout, ZERO files written anywhere.
- STATE lacking a phase → exit 0, no crash (decide and state whether that
  warrants its own distinct reason code — do NOT reuse missing_plan for it).
- empty / garbage / null stdin → exit 0, no stack trace.

## Registry
Append a `postToolUse`-shaped section using the SAME trigger/predicate/
enforcement shape T146-04 established, listing exactly the three tool names.
Do not reintroduce the inert fields T146-04 just deleted
(`schema_version`, `registry_version`, `owner_phase`, `intent`,
`predicate.match`, `kind: none`).

## Verify (report exact exit codes)
1. `node --check super-gsd/hooks/sgsd-quality-gate.js`
2. Every row of the behavior matrix above.
3. Confirm the T146-04 classifier still passes its corpus after your registry
   append (run its planning/execution pair — your section must not break it).
Build payloads with JSON.stringify — hand-written JSON containing Windows
paths breaks on unescaped backslashes and silently yields an empty payload.
If your sandbox blocks node, say so in BLOCKERS and still report changes.

SURGICAL CONSTRAINT — every changed line must trace to T146-05. Orphan edits
are DEVIATIONS: report, do not commit silently. Match existing style.

## Report contract (<300 words)
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: path | purpose | interface | none
ONE_LINER: substantive summary
