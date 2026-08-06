# Step 9.5 ATC (RE-REVIEW) — P146 T146-02 after CRIT + 2 WARN fix

Re-review ONLY. You MUST read the file below (use whatever read command your
environment provides — reading is required). Do NOT run self-tests,
benchmarks, node, or bash. Do NOT read any other file. Emit the 5 contract
lines FIRST, then FINDINGS_DETAIL, then stop.

## File
- super-gsd/scripts/merge-settings.js (modified)

## Your prior findings — confirm CLOSED or still OPEN with line evidence
CRIT-1  `--repo-local-hooks` trusted caller-supplied overlayPath/targetPath/
        repoRoot; mergeSettingsFiles read+wrote that target without enforcing
        `<repo>/.claude/settings.json`, so a bad invocation could write
        arbitrary paths incl. `~/.claude/settings.json`, and could copy a
        top-level `env` block from an overlay.
WARN-1  hookLaunchKey included `args`, so a same-command/same-matcher entry
        with STALE absolute args was kept and a duplicate appended; matcher
        compared by exact string so reordered matchers missed.
WARN-2  self-test overwrote process.env.HOME/USERPROFILE without restoring
        them in a `finally`.

## Orchestrator adversarial host verification (already run — do not re-run)
target outside repo root → exit 4, NO file created.
target under home `.claude` with os.homedir() redirected to the fixture →
  exit 4, message "repo-local target under user home .claude is forbidden",
  fixture byte-identical.
overlay containing a top-level `env` block → no env key or value appears in
  the written target.
legit derived target → installs, and a second run is byte-identical (idempotent).
pre-seeded stale entry (same command+matcher, OLD absolute args) → exactly ONE
  entry afterwards, old path gone, args refreshed.
operator's real ~/.claude/settings.json md5 unchanged across the whole run.

## Also check for regressions introduced by this fix
- Does the pre-existing HOME-install path used by OTHER consumers still behave
  exactly as before (it must not have been bounded/broken by this change)?
- Is the env strip applied on every write path, including any fallback/error
  branch — or only the happy path?
- Can the matcher normalization collapse two genuinely DIFFERENT matchers into
  one (over-merging), e.g. differing whitespace vs differing tool sets?
- Does refusing exit 4 leave any partially-written file or temp artifact?
- Any new throw path, unbounded loop, or silent swallow?

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <summary>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)
