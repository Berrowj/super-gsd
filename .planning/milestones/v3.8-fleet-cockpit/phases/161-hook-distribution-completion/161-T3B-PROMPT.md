# P161-T3B — finish T3: warn-downgrade must be conditional on live global coverage

Files ONLY: super-gsd/scripts/lib/hook-registration-preflight.cjs (and
install.sh only if the condition threading requires it) plus the guard test if
its fixture needs a wiring correction — do NOT weaken the assertion. Edits-first;
no spawns; do NOT commit.

Orchestrator ran the suite: 10/11 green; `--case sgsd-update-clarity-recovery`
fails at its negative control:
"dead managed project rows without live global coverage did not refuse"

The contract (T3 prompt, verbatim): a stale project-local sgsd_managed entry is
downgraded to a named per-path WARN ONLY when global coverage for the SAME hook
is live (globally registered AND its deployed script exists/resolves); without
live global coverage it must still REFUSE. Your current downgrade fires
unconditionally. Implement the coverage check (read the global settings the
same install produced; reuse the preflight's own existence/resolve helpers) and
keep the positive path (dead rows + live coverage => WARN, exit 0, rows
untouched) exactly as the passing assertions expect.

Report: FILES_CHANGED / VERIFICATION (static) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 100 words.
