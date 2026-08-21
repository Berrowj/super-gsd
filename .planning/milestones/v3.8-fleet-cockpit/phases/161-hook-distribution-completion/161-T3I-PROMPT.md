# P161-T3I — the scope principle: validate ONLY sgsd-owned rows, never operator rows

Files: hook-registration-preflight.cjs (+ guard test only for genuinely wrong
fixture assumptions). Edits-first; no spawns; do NOT commit.

## Live failure after T3H

hook_registration_launch_invalid <unresolved> [SessionStart/SessionStart[0].hooks[0]]
The failing entry is an OPERATOR-OWNED row (the case's sentinelSettings baseline
simulating pre-existing operator hooks). The enumerator now validates rows SGSD
does not own.

## The principle to implement (this ends the seam class)

SGSD's preflight/enumeration validates EXACTLY the rows SGSD owns and nothing
else:
- overlay-derived rows it is about to write (installer path), and
- rows marked sgsd_managed === true (project-managed path), and
- for COVERAGE lookup: only global rows whose identity matches a manifest hook
  (unparseable/foreign global rows are simply non-coverage, silently).
Operator rows — anything unmarked/unmatched, any shape — are never enumerated,
never validated, never smoked, never mentioned. Preservation of them is
asserted by byte-equality, not by parsing them.

Audit EVERY enumeration entry point against this rule in one pass (installer
global site, repo-local site, project-managed preflight, coverage lookup,
smoke-set construction). Re-run T3H's full static walk INCLUDING a
sentinelSettings-style operator row in every settings object it feeds, plus an
operator row of pathological shape (garbage command) that must be ignored
everywhere.

Report: FILES_CHANGED / VERIFICATION (full walk incl. operator-row matrix) /
DEVIATIONS / BLOCKERS / ONE_LINER, max 150 words.
