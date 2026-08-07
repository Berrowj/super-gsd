# P146 gap fix 2 — a corrupt-but-parseable registry silently disables routing

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. File you may touch:
`super-gsd/hooks/sgsd-intent-classifier.cjs`. Nothing else.

## The defect (reproduced)
`readRegistry` (~183-191) logs `registry_unavailable` ONLY when
`fs.readFileSync` throws. But `parseRegistryYaml` NEVER throws — it returns
`{ routes: [] }` for arbitrary garbage:

    parseRegistryYaml("{{{ not yaml \x00\n")  ->  {"routes":[]}
    parseRegistryYaml("")                      ->  {"routes":[]}

So a registry that is present and readable but CORRUPT parses to zero routes,
the catch never fires, no failure row is appended, no breadcrumb is emitted —
and every planning prompt silently loses its `/sgsd-triage` directive. The hook
exits 0 looking perfectly healthy.

This is the SIXTH instance of this phase's "silent success" class, and it
survives the fix that was just made for the fifth. Fixing the throw path
without the parse-to-empty path leaves the more likely failure mode wide open:
a corrupt file is far more probable than an unreadable one.

## Required fix
Treat "registry produced no usable routes" as a degraded state, not a normal
one, and distinguish the cases with separate reason codes:
- file read threw            → `registry_unavailable`  (existing behavior, keep)
- file exists, NON-ZERO size, but yields ZERO routes → NEW distinct reason code
  (e.g. `registry_unparsed`) + failure row + breadcrumb
- file genuinely absent, or zero-length → decide whether that is degraded or a
  legitimate empty state, and say which you chose and why in your report.
Rules (unchanged from the phase's board-binding constraints):
- still exit 0, never block, never print a stack;
- the failure-row write must itself be guarded — it must not be able to throw;
- OUTSIDE a validated SGSD root, write NOTHING (a non-SGSD repo stays silent
  even when degraded);
- keep the stderr breadcrumb in addition to the row.

Consider whether `parseRegistryYaml` should itself signal "this input was not
plausibly a registry" (e.g. return null vs an empty route list) so callers can
tell corrupt from legitimately-empty. If you change its return contract, update
BOTH callers and say so — `sgsd-quality-gate.js` also consumes it but is OUT of
scope for edits here, so do not break its call signature.

## Preserve (22-check suite currently passes except the one this fixes)
- recall 13/13 and precision 11/11 on the classifier corpus;
- registry read-failure still logs `registry_unavailable` with a row;
- evidence-append failure → exit 0, no stack, handler cannot throw;
- non-SGSD → exit 0, empty stdout, ZERO files written, even when degraded;
- bench records `intent_classifier_bench` (iterations 200, p95_ms < 1000) and
  refuses a non-canonical `--record`;
- no LLM, no network; never emits `decision`/`continue:false`;
- empty/garbage/null stdin → exit 0, no stack;
- registry source remains ONE named constant resolved from `__dirname`
  (preserves the P149 one-line swap).

## Verify (report exact exit codes)
1. `node --check super-gsd/hooks/sgsd-intent-classifier.cjs`
2. Corrupt-but-parseable registry (write `{{{ not yaml` into a TEMP COPY —
   restore the real file afterwards) → planning prompt still exits 0, emits no
   stack, AND appends the new distinct reason row inside an SGSD fixture.
3. Same corrupt condition in a NON-SGSD dir → ZERO files written.
4. Unreadable registry (path is a directory) → still `registry_unavailable`.
5. Full preserve list above, including the 13/11 corpus.
Build payloads with JSON.stringify. RESTORE the real registry file before you
finish — it is shared with the quality gate.

SURGICAL CONSTRAINT — every changed line must trace to this finding. Orphan
edits are DEVIATIONS: report, do not commit silently.

## Report contract (<300 words)
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none expected
ONE_LINER: substantive summary
