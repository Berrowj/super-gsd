# P146 T146-02 fix round 2 — CRIT-1 symlink bypass + dedupe over-merge

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. Files you may touch:
`super-gsd/scripts/merge-settings.js`,
`super-gsd/config/repo-settings-overlay.json`. Nothing else.

Round 1 closed the lexical escape and the env leak. Two findings remain.

## CRIT-1 (STILL OPEN) — symlink/junction bypass of the path boundary
Repo-local target validation is LEXICAL ONLY (`path.resolve`/`path.join`,
~lines 151-171), and the write is `targetPath + '.tmp'` then rename
(~lines 567-570) with no realpath/symlink validation. A symlinked or
NTFS-junctioned `repoRoot` or `.claude` directory therefore passes the exact
derived-target check while the actual write lands OUTSIDE the repo — including
`~/.claude`, which holds LIVE API KEYS. Junctions are common on Windows, so
this is reachable in practice, not theoretical.

### Required fix
1. Validate on REAL paths, not lexical ones. Resolve `fs.realpathSync` for
   `repoRoot`, for the `.claude` directory, and for the target's parent.
   Because the target (and possibly `.claude`) may not exist yet, walk up to
   the NEAREST EXISTING ancestor, realpath THAT, and verify the intended
   target still resolves inside the realpath'd repo root.
2. Re-validate immediately BEFORE the rename, not only before the write, so a
   directory swapped between check and rename is caught. Write the temp file
   inside the SAME validated `.claude` directory (never a global temp dir), and
   unlink it if post-validation fails.
3. Refuse if any component of the resolved chain is a symlink/junction that
   escapes the realpath'd repo root. Distinct, explicit stderr message; exit
   nonzero; leave NO partial file or temp artifact.
4. Keep the round-1 guards intact: exact derived-target match, home-`.claude`
   refusal via os.homedir(), env strip on EVERY write path.

## WARN-1 (regression from round 1) — dedupe now over-merges
`hookLaunchKey(..., true)` drops ALL args (~lines 59-67); `isSameEntry` matches
on command + normalized matcher (~lines 69-83); `refreshRepoLocalHookArgs`
overwrites matched args (~lines 492-506, 551-558). Consequence: an operator's
OWN hook — e.g. `command: "node"` on PostToolUse with matcher `Edit|Write` —
is silently REPLACED by an SGSD entry. That is user-data loss and worse than
the duplicate it was fixing.

### Required fix
Make SGSD ownership EXPLICIT rather than inferred. Add a stable marker to the
entries this installer emits (e.g. an `sgsd_managed: true` / `sgsd_hook_id`
field on the hook object in `repo-settings-overlay.json`, carried through to
the written settings — pick the shape that survives the harness's schema and
say which you chose and why in your report).
Then:
- refresh/replace ONLY entries carrying that marker;
- an unmarked entry with the same command+matcher must be PRESERVED untouched,
  and the SGSD entry added alongside it;
- still no duplicate SGSD entries across repeated installs (idempotent);
- a marked entry with stale args is still refreshed in place (round-1 behavior
  must survive).
If the harness rejects unknown keys inside a hook object, fall back to
identifying SGSD entries by args[0] resolving under `<repoRoot>/super-gsd/hooks/`
— and say so explicitly in your report.

## Extend the self-test (keep every existing assertion)
- symlink/junction escape: create a real symlink (or NTFS junction) whose
  `.claude` points outside the repo; assert the install REFUSES, writes
  nothing at the escape destination, and leaves no `.tmp` artifact. If the
  environment cannot create links without elevation, detect that and SKIP that
  single assertion with a printed reason — do NOT fail, and do NOT silently
  drop it.
- user-hook preservation: pre-seed the target with an UNMARKED
  `command:"node"` hook on PostToolUse with an overlapping matcher; run the
  install; assert that hook is still present, byte-identical, and that the
  SGSD entry was added alongside.
- marked-entry refresh: pre-seed a MARKED entry with stale args; assert it is
  refreshed in place with no duplicate.

## Verify (report exact exit codes)
1. `node --check super-gsd/scripts/merge-settings.js`
2. `node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks`
3. legit derived target still installs and is idempotent on a second run.
NEVER pass a real home settings path in any test. Temp fixtures only.
If your sandbox blocks node, say so in BLOCKERS and still report changes.

SURGICAL CONSTRAINT — every changed line must trace to a finding above. Orphan
edits are DEVIATIONS: report, do not commit silently. Match existing style.

## Report contract (<300 words)
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none expected
ONE_LINER: substantive summary
