# P146 T146-03 — SessionStart governance contract injection

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS TASK ONLY (T146-03 of 7). Verify before
reporting. Explicit DONE / DONE_WITH_CONCERNS / BLOCKED.

## ⚠️ RECURRING DEFECT IN THIS PHASE — do not repeat it
Both prior tasks shipped a CRITICAL of the SAME class: **a writer that accepts
a caller-supplied destination instead of deriving and bounding one.**
- T146-01: evidence writer wrote to any directory handed to it.
- T146-02: installer wrote to any target path, incl. `~/.claude/settings.json`;
  then STILL escaped via a junctioned `.claude` because validation was lexical.
Rules for this task:
- DERIVE every path from the payload's `cwd` via the shared resolver. Never
  write to a path you were handed.
- Anything outside a validated SGSD root: write NOTHING, exit 0, stay silent.
- Never read, copy, log, or echo `~/.claude/settings.json` or any env value.

## Files you may touch
- `super-gsd/hooks/sgsd-session-start.js`  (modify — exists already)
- `.planning/metrics/gate-evidence.jsonl`  (append only, via the T146-01 writer)

## Output contract (locked plan)
SessionStart injects the governance contract containing: the ATC tier table,
the gate table, a mode-confirmation note (same gates in every mode; mode changes
WHO confirms, not WHAT runs), and the active milestone/phase read from the
repo at the payload's `cwd`. Non-SGSD cwd → quiet exit 0. Consume the shared
helpers owned by T146-01 (`super-gsd/scripts/lib/sgsd-state.cjs`,
`super-gsd/scripts/lib/gate-evidence-log.cjs`) — do NOT reimplement STATE
parsing or JSONL writing. Append ONLY `state_phase_missing` evidence rows, and
only when SGSD STATE frontmatter lacks a phase.

## Input contract
Per RESEARCH Q1: SessionStart receives JSON on stdin with `session_id`,
`transcript_path`, `cwd`, `hook_event_name`, plus `source`. Stdout (or
`hookSpecificOutput.additionalContext`) becomes first-turn context. Report-only:
exit 0, no `decision` field, never `continue:false`.

## Falsifier — the task FAILS if any holds
An sg-launched SessionStart payload produces no first-turn governance context;
or the output lacks active milestone/phase; or the hook blocks the session; or
it emits context in a non-SGSD directory.

## The plan's verification (must pass verbatim)
A temp repo whose `.planning/STATE.md` declares `milestone: v3.5` and
`current_phase: "873"`, fed a SessionStart payload with `cwd` = that temp repo,
must exit 0 and print output matching ALL of: `Governance Contract`, `ATC`,
`v3.5`, `873`. The 873 is the anti-stub check — it proves you READ the fixture
rather than hardcoding this repo's values. Do not hardcode `146` or `v3.5`
anywhere in the emitted contract; both must come from the resolver.

## Also required
- Non-SGSD cwd (OS temp dir, no `.planning`) → exit 0 AND empty stdout.
- Missing/unreadable STATE, or STATE without a phase → still exit 0, still emit
  the static contract sections, and append exactly one `state_phase_missing`
  evidence row (only when inside a real SGSD repo).
- Wrap everything in narrow try/catch: any unexpected error → exit 0 with a
  logged failure row, never a stack trace to the user, never a nonzero exit.
- Preserve whatever the existing hook already does (it currently handles
  handoff pairing) unless it directly conflicts — say so in DEVIATIONS if it does.
- Windows-safe. Node built-ins only. No new dependencies.

## Verify (report exact exit codes)
1. `node --check super-gsd/hooks/sgsd-session-start.js`
2. The plan verification above (temp fixture with phase 873).
3. Non-SGSD temp dir payload → exit 0, stdout empty.
4. SGSD fixture WITHOUT a phase in STATE → exit 0, contract still emitted, one
   `state_phase_missing` row appended.
5. Malformed/empty stdin → exit 0, no stack trace.
If your sandbox blocks node, say so in BLOCKERS and still report changes.

SURGICAL CONSTRAINT — every changed line must trace to T146-03. Orphan edits
are DEVIATIONS: report, do not commit silently. Match existing style. Remove
only what YOUR change made unused.

## Report contract (<300 words)
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: path | purpose | interface | none
ONE_LINER: substantive summary
