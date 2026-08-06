# Step 9.5 Per-Dispatch ATC — P146 T146-01 (shared state resolver + evidence writer)

ATC review: 7-step (esp. delete / simplify / anti-slop) + logic/security, on
the two NEW files below. Spec compliance already passed. HARD BUDGET: read
ONLY the three files named; do NOT run any command; do NOT explore the repo;
emit the 5 contract lines FIRST, then FINDINGS_DETAIL, then stop.

## Files
- super-gsd/scripts/lib/sgsd-state.cjs      (new, 188 lines)
- super-gsd/scripts/lib/gate-evidence-log.cjs (new, 194 lines)
- super-gsd/scripts/lib/gate-value-log.cjs  (existing convention being mirrored
  — read ONLY to judge duplication vs reuse)

## Context
These are foundation helpers consumed by 6 downstream tasks (hooks for
SessionStart / UserPromptSubmit / PostToolUse, a registry, a cockpit reader,
and a watchdog repoint). They must never throw upward and must no-op quietly
outside an SGSD repo.

## ATC focus
1. Anti-slop 1/3/5/9: any exported function, option, or parameter with no
   current or planned caller? Any "just in case" surface? Name it.
2. Anti-slop 6 + delete: how much of gate-evidence-log.cjs duplicates
   gate-value-log.cjs? Should it wrap/extend rather than parallel it? Give a
   concrete verdict — this is the main deletion opportunity.
3. Never-throw discipline: is EVERY public entrypoint wrapped? Any path where
   a malformed STATE file, unreadable dir, symlink loop, or huge file could
   throw or hang?
4. Correctness of frontmatter parsing: quoted vs unquoted values, CRLF, BOM,
   duplicate keys, `---` inside body, missing closing fence.
5. Path handling: Windows separators, UNC paths, walk-up termination at drive
   root (no infinite loop), and case-sensitivity assumptions.
6. Security: any read of ~/.claude/settings.json or other credential-bearing
   paths; any unbounded write; any user-controlled path used unsanitized.

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <summary>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)
