FINDINGS: 2
CRITICAL: 1
WARNINGS: 1
PASS_RATE: 6/8
ONE_LINER: CRIT-1 remains open via canonical-path bypass; WARN-1 stale duplicate is fixed but over-broad; WARN-2 is closed by finally restore at lines 400-405.
FINDINGS_DETAIL: [CRITICAL] [path-boundary] CRIT-1 still OPEN: repo-local target validation is lexical only (`path.resolve`/`path.join` at lines 151-171) and the write uses `targetPath + '.tmp'` then rename at lines 567-570 without `realpath`/symlink validation, so a symlink/junctioned `repoRoot` or `.claude` directory can still write outside the repo, including home `.claude`, while passing the exact derived-target check.
FINDINGS_DETAIL: [WARNING] [dedupe-regression] WARN-1 stale-entry duplicate is CLOSED, but the fix over-merges: repo-local `hookLaunchKey(..., true)` drops all args at lines 59-67, `isSameEntry` dedupes by command plus normalized matcher at lines 69-83, and `refreshRepoLocalHookArgs` overwrites matched args at lines 492-506/551-558, so a genuinely different user `node` hook with the same matcher can be silently replaced instead of preserved.
