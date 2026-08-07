# P146 T146-07b — delete dead config knobs (completes T146-07 item A4)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY.

## Why this is a separate dispatch
The previous T146-07 dispatch correctly reported a BLOCKER: the dead knobs live
in files that were outside the file list it was given. That was an ORCHESTRATOR
PROMPT ERROR — the locked plan's `files_touched` for T146-07 includes
`super-gsd/config/**/*.json`, which covers both files below. The executor was
right to refuse rather than reach outside its stated scope.

## Files you may touch (nothing else)
- `super-gsd/config/model-routing.json`
- `super-gsd/config/planning-config-overlay.json`

## Task (locked plan item A4)
Delete these dead config knobs:
- `token_efficiency.checkpoint_threshold_percent`
- `token_efficiency.context_warning_percent`
- `hooks.context_warnings`  (already absent — confirm and report)

The plan's falsifier fails this task if "dead config knobs remain under
super-gsd runtime config".

## Evidence they are dead (orchestrator-verified — confirm before deleting)
A repo-wide grep across `*.cjs`, `*.js`, `*.yaml`, `*.json` found these keys
ONLY as declarations in the two files above — zero runtime readers.
Re-verify yourself before deleting. **If ANY key turns out to have a real
reader, KEEP it and say so in your report** — do not delete something load-bearing
to satisfy a checklist.

## Constraints
- Delete only those keys. Leave every other key, ordering, and formatting
  intact. Preserve each file's existing indentation and trailing-newline style.
- If removing a key empties its parent object, decide whether to keep the empty
  parent (safer for consumers doing `config.token_efficiency.x`) or remove it,
  and state which you chose and why.
- Both files must remain valid JSON.

## Verify (report exact exit codes)
1. Both files parse: `node -e "require('./super-gsd/config/model-routing.json')"`
   and the same for `planning-config-overlay.json`.
2. Re-grep the three key names across `super-gsd` excluding `*.md` — expect no
   remaining declarations (planning/markdown references are fine and expected).
3. Confirm no other key was removed: diff should show ONLY the intended deletions.

SURGICAL CONSTRAINT — every changed line must trace to A4. Orphan edits are
DEVIATIONS: report, do not commit silently.

## Report contract (<300 words)
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none expected
ONE_LINER: substantive summary
