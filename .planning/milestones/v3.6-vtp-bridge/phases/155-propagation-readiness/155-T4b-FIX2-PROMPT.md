# P155-T4b fix2 — partial-ROADMAP abstention + decouple test assertions

Fresh context. Do NOT commit. Two findings from ATC, exact lines verified:

1. CRITICAL. `phase-name.cjs:277,284-286` accepts heading-only ordering and silently
   drops discovered phases absent from a partial ROADMAP table; `resolve.cjs:496-546`
   can then emit stale folder evidence and a backwards re-sync. Required behaviour:
   when ANY discovered phase is absent from the parsed ROADMAP table, ROADMAP ordering
   is INCOMPLETE — the winner selection must ABSTAIN from table ordering for that root
   (fall back to the scheme-aware comparator over ALL discovered phases, never a
   listed-older-beats-unlisted-newer outcome), and no repair recommendation may point
   at a phase older than any discovered phase. Heading-only tables (no rows) count as
   absent tables. Add fixture cases: partial table missing the newest v-phase;
   heading-only table; empty ROADMAP — each must select the newest discovered phase or
   abstain to the next tier, and NEVER recommend a backwards re-sync.
2. WARNING. `assert-state-resolver.cjs:171-190` asserts against helper exports and
   intermediate arrays; the outcome assertions at 192-207 already cover the contract.
   Remove or loosen 171-190 to outcome-level so legitimate refactors do not fail.

Nothing else. Tier priorities/confidence/projection semantics stay untouched (the
revert from fix1 must survive verbatim).

Verify what the sandbox allows:
    node super-gsd/tests/propagation-readiness/assert-state-resolver.cjs --case all
    node super-gsd/tools/state-resolver/resolve.cjs --self-test

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 120 words.
