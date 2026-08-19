# P155-T4b fix3 — close the remaining half of ONE finding. Two edits.

Fresh context. Do NOT commit. ATC re-check verified the partial-table half fixed and
the test-coupling warning closed. Exactly two deltas remain, at named lines:

1. `resolve.cjs:475-481` — a heading-only or empty ROADMAP (no rows) RETURNS before
   discovery runs. It must not. No-row tables are absent tables: fall through so
   discovery still runs and the scheme-aware comparator over ALL discovered phases
   selects the winner, same as the partial-table path at :495-500. No repair
   recommendation older than any discovered phase, ever.
2. `assert-state-resolver.cjs:215` — the heading-only/empty fixtures set STATE.md to
   the NEWEST phase, which masks older git-tier winners and backward repairs
   (:833-894). Set STATE to a STALE value (or omit it) in those fixtures, and add one
   assertion that a git tier carrying an OLDER phase id does not win over a newer
   discovered phase and produces no backwards repair.

Nothing else. Tier semantics, precedence, and the fix1/fix2 work stay verbatim.

Verify what the sandbox allows:
    node super-gsd/tests/propagation-readiness/assert-state-resolver.cjs --case all

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 100 words.
