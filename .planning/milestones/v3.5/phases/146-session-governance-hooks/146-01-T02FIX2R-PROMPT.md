# P146 T146-02 fix round 2 (RESUME) — tests are RED, implement to make them GREEN

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. Files you may touch:
`super-gsd/scripts/merge-settings.js`,
`super-gsd/config/repo-settings-overlay.json`. Nothing else.

## Current state — read this carefully before editing
A previous dispatch was interrupted. It already wrote the TEST side of this
fix into `--self-test-repo-local-hooks`; it did NOT write the implementation.
Right now:
  `node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks`
  → exit 1, failing on: "symlink/junction repo-local .claude target was accepted"
`realpath` appears ONLY in a self-test message check (~line 396), never in the
validation logic. `repo-settings-overlay.json` has NO ownership marker.

Existing RED assertions you must make GREEN (do not weaken or delete them):
- ~388-398 symlink/junction escape: refuses, clear message mentioning
  symlink/junction/realpath, escape destination NOT written, no `.tmp`
  artifact left behind. (There is already a SKIP path if link creation needs
  elevation — keep it.)
- ~439 an UNMARKED user hook on PostToolUse is preserved.
- ~441 marked SGSD entries identified by `sgsd_managed === true` and
  `sgsd_hook_id === 'post-tool-use-quality-gate'`.
- ~447 every SGSD-emitted entry carries `sgsd_managed: true` and a string
  `sgsd_hook_id`.
The tests define the contract. Implement to satisfy them exactly.

## Implement — CRIT-1 symlink/junction bypass
Validation is currently LEXICAL only (`path.resolve`/`path.join`, ~151-171),
and the write is `targetPath + '.tmp'` then rename (~567-570). A junctioned or
symlinked `repoRoot`/`.claude` passes the derived-target check while the write
lands outside the repo — including `~/.claude`, which holds LIVE API KEYS.
Required:
1. Validate on REAL paths: `fs.realpathSync` the repoRoot, the `.claude` dir,
   and the target's parent. Target/`.claude` may not exist yet — walk up to the
   nearest EXISTING ancestor, realpath that, and verify the intended target
   still resolves inside the realpath'd repo root.
2. Re-validate immediately BEFORE the rename, not only before the write, so a
   directory swapped mid-operation is caught. Keep the temp file inside the
   validated `.claude` dir and unlink it if post-validation fails (the test
   asserts no `.tmp` is left behind).
3. Refuse with an explicit stderr message containing "symlink", "junction", or
   "realpath"; exit nonzero; leave no partial file.
4. Preserve every round-1 guard: exact derived-target match, home-`.claude`
   refusal via os.homedir(), env strip on EVERY write path.

## Implement — WARN-1 dedupe over-merge
Round 1 dropped ALL args from the repo-local dedupe key, so an operator's own
`command:"node"` hook with an overlapping matcher is silently REPLACED. That is
user-data loss.
Required:
- Add the ownership marker to the entries this installer emits: `sgsd_managed:
  true` plus a stable `sgsd_hook_id` per event (the tests expect
  `post-tool-use-quality-gate` for PostToolUse; choose equally descriptive ids
  for SessionStart and UserPromptSubmit and state them in your report). Put the
  marker in `repo-settings-overlay.json` and carry it through to the written
  settings.
- Refresh/replace ONLY marked entries. An UNMARKED entry with the same
  command+matcher must be preserved byte-identical, with the SGSD entry added
  alongside.
- Still idempotent: repeat installs add no duplicate SGSD entries.
- A MARKED entry with stale args is still refreshed in place (round-1 behavior
  must survive).
If the harness rejects unknown keys inside a hook object, fall back to
identifying SGSD entries by args[0] resolving under
`<repoRoot>/super-gsd/hooks/` — and say so explicitly in your report.

## Verify (report exact exit codes)
1. `node --check super-gsd/scripts/merge-settings.js`
2. `node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks`
   → MUST be exit 0 with every assertion passing (or the symlink one printing
   its SKIP reason if links need elevation).
3. legit derived target installs and a second run is byte-identical.
NEVER pass a real home settings path in any test. Temp fixtures only.
If your sandbox blocks node, say so in BLOCKERS and still report changes.

SURGICAL CONSTRAINT — every changed line must trace to a finding above. Do not
weaken, skip, or delete an existing assertion to make the suite pass. Orphan
edits are DEVIATIONS: report, do not commit silently.

## Report contract (<300 words)
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none expected
ONE_LINER: substantive summary
