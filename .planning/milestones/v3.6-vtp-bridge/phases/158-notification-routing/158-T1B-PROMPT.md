# P158-T1B — implement the origin gate (red already run by orchestrator)

You are the implementer. Fresh context. Node works; no `claude` spawning. Do NOT
commit. Single file: `super-gsd/hooks/sgsd-intent-classifier.cjs`.

The contractual red ALREADY RAN unsandboxed (.planning/tmp/158-t1-red.log): the
three-direction fixtures you (prior dispatch) added fail pre-gate — the automated
turn evaluates routes and writes no skip row. Implement now per task P158-T1 in
158-01-PLAN-LOCKED.md:

- Structural origin gate at the payload level, BEFORE any route evaluation, using
  the envelope markers the fixtures encode (never phrase blacklists — direction 3
  requires an operator prompt QUOTING notification text to still fire).
- On automated turn: write ONE text-free `automated_turn_skip` ledger row
  (markers/counters only) and exit silently with zero route evaluations.
- Preserve every existing selfTest case and the no_match written-row discipline.

Verify what the sandbox allows (node --check at minimum); the orchestrator runs
the full self-test unsandboxed after you.

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 120 words.
