# P146 T146-02 fix — 1 CRITICAL (path escape) + 2 WARNINGS

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. File you may touch:
`super-gsd/scripts/merge-settings.js`. Nothing else.

## CRIT-1 (confirmed by live probe) — --repo-local-hooks writes anywhere
`--repo-local-hooks` trusts caller-supplied `overlayPath`, `targetPath` and
`repoRoot` (~line 426). `mergeSettingsFiles` then reads/writes that target
(~lines 292, 401) without enforcing `<repoRoot>/.claude/settings.json`, and can
copy a top-level `env` block if a home settings file is passed as overlay
(~line 356).

Reproduced host-side:
  node merge-settings.js --repo-local-hooks <overlay> /tmp/sgsd-escape-probe/settings.json $(pwd)
  → "3 hook-entries added", exit 0, file CREATED at that arbitrary path.
The same shape with a home settings path would write `~/.claude/settings.json`,
which is the phase's single hardest prohibition (that file holds LIVE API KEYS).
This is the same defect class already fixed in T146-01's evidence writer: a
writer that accepts any caller-supplied destination.

### Required fix
1. In the `--repo-local-hooks` path, DERIVE the target rather than trusting it:
   resolve `<repoRoot>/.claude/settings.json` yourself. If an explicit target
   argument is supplied, accept it ONLY if, after full normalization
   (path.resolve + case-normalization on Windows), it is EXACTLY that derived
   path. Otherwise refuse: print a clear error to stderr, write NOTHING, exit
   nonzero.
2. Refuse unconditionally — with a distinct message — if the resolved target is
   under the user's home `.claude` directory (compare against os.homedir()),
   even if a caller somehow constructed a matching repoRoot. Defence in depth.
3. Validate `repoRoot`: must be an existing directory. Reject relative or
   nonexistent roots rather than silently resolving against process.cwd().
4. NEVER copy a top-level `env` key from an overlay into a target, on any code
   path. Strip it and warn, or refuse the overlay outright — your choice, but
   state which in your report. Env must never propagate.
5. Keep the existing HOME-install code path used by other consumers working
   exactly as before. Do not change its behavior; only the repo-local path is
   being bounded.

## WARN-1 — dedupe key includes args, so stale entries duplicate
`hookLaunchKey` includes `args` (~line 59), so an entry with the same command
and matcher but STALE absolute args (repo moved / different worktree) is kept
and a NEW entry is appended (~line 389) — the settings file accumulates dead
hook entries pointing at old paths. Matcher comparison is also exact-string
(~line 71), so semantically identical reordered matchers miss.
Fix: for the repo-local hook path, dedupe by command + matcher (NOT args). When
a matching entry is found with different args, REPLACE its args with the
freshly derived absolute paths instead of appending a second entry. Normalize
matcher comparison so reordering (`Write|Edit` vs `Edit|Write`) is treated as
equal. Idempotency must still hold: two consecutive installs → no net change.

## WARN-2 — self-test never restores HOME/USERPROFILE
`--self-test-repo-local-hooks` overwrites `process.env.HOME` and
`process.env.USERPROFILE` (~line 242) and does not restore them in a `finally`
(~line 283). Low impact today (process exits), but it leaks redirected env to
any later same-process code. Fix: save and restore both in a `finally`.

## Extend the self-test with these NEW assertions (keep all existing ones)
- a target path OUTSIDE the repo root is REFUSED: nonzero exit, and NO file is
  created at that path;
- a target under a FIXTURE home `.claude` (temp dir, invented sentinel keys) is
  REFUSED and that fixture file is byte-identical afterwards;
- an overlay containing a top-level `env` block does NOT propagate any env key
  or value into the target;
- stale-args case: pre-seed the target with a same-command/same-matcher entry
  whose args point at an OLD path, run the install, then assert exactly ONE
  entry for that event and that its args are the NEW paths;
- reordered matcher (`Write|Edit` vs `Edit|Write`) is treated as already-present,
  not appended;
- HOME/USERPROFILE are restored to their original values after the self-test.

## Verify (report exact exit codes)
1. `node --check super-gsd/scripts/merge-settings.js`
2. `node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks`
3. Escape probe now refused:
   `node merge-settings.js --repo-local-hooks <overlay> <some temp path outside repo> <repoRoot>`
   → nonzero exit, no file created.
4. Legit path still works: derived `<repoRoot>/.claude/settings.json` install
   succeeds and is idempotent on a second run.
NEVER pass a real home settings path in any test. Use temp fixtures only.
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
