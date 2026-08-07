# P146 phase-verification gap fix — degraded paths must LOG, not just warn

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. Files you may touch:
`super-gsd/hooks/sgsd-intent-classifier.cjs`,
`super-gsd/hooks/sgsd-quality-gate.js`. Nothing else.

## GAP-1 (CRITICAL) — the phase's FIFTH silent-success instance
Board-binding rule: "Every hook: narrow try/catch, unexpected error → exit 0
**+ logged failure row**." Today the degraded paths only `safeWarn(...)` to
stderr and continue:
- `sgsd-intent-classifier.cjs` — registry read failure calls
  `safeWarn('registry_unavailable')` and falls back to EMPTY routes, so a
  planning prompt silently loses its `/sgsd-triage` directive with nothing in
  the evidence stream.
- `sgsd-quality-gate.js` — same pattern on outer unexpected errors and on
  evidence-append failure.

stderr in a hook is effectively invisible: nobody greps it, and the cockpit
cannot see it. So a permanently broken classifier looks identical to a session
with no planning prompts. This is the same class already fixed FOUR times this
phase (suppressed contract; registry resolved from wrong root; blind ledger
rendered healthy; uncounted spawn rows bypassing MAX_CHAIN_DEPTH).

### Required fix
On every degraded/unexpected path in BOTH hooks, append ONE envelope-v1 failure
row via the T146-01 writer, with a distinct reason code per failure kind
(e.g. `registry_unavailable`, `classifier_unexpected_error`,
`quality_gate_unexpected_error`, `evidence_append_failed`). Rules:
- keep the stderr breadcrumb as well (it aids interactive debugging);
- STILL exit 0, still never block, still never print a stack;
- the failure-row write must itself be guarded — if IT fails, fall back to the
  breadcrumb only and never throw (an error handler must not be able to throw);
- outside a validated SGSD root, write NOTHING (unchanged) — a non-SGSD repo
  must stay silent, so failure rows only apply once a root is resolved;
- do NOT reuse `missing_plan` or any existing signal for these.

## GAP-2 (WARNING) — registry is not the source of truth it claims to be
`session-governance-hooks.yaml` declares the quality-gate mutation tools, but
`sgsd-quality-gate.js` HARDCODES `Edit`, `Write`, `NotebookEdit`. The values
agree today, so nothing is broken — but the registry is decorative for this
hook, and a future edit to the YAML would silently not take effect. That is a
latent silent-success too.
Fix: have the quality gate CONSUME the registry section for its matcher, with
the hardcoded triple as an explicit fallback when the registry is unreadable
(and that fallback must emit the GAP-1 failure row). Resolve the registry from
`__dirname` — NOT from the target repo root (T146-04 shipped a CRITICAL by
resolving a `super-gsd/`-shipped resource from the target repo).
There is NO `MultiEdit` in this harness — do not introduce it.

## GAP-3 (WARNING) — semantic AC says the classifier RECORDS routing
The plan's semantic AC states the classifier "records only a routing decision".
Runtime classification currently only PRINTS directives; the ledger receives
bench rows only. Decide and implement the smaller correct option:
either (a) append a lightweight routing-decision row on a real classification
(NOT on every prompt if that would flood the ledger — state your reasoning and
any rate/dedupe choice), or (b) if you judge (a) to be genuine over-logging,
say so explicitly and state why the AC is satisfied without it. Do not silently
skip this — the phase verifier raised it.

## NOT in scope
The installer's global-settings write path (used by other consumers) stays as
it is — it was deliberately preserved when the repo-local path was added.

## Preserve (all currently pass on the host — must not regress)
- classifier corpus: 13/13 planning prompts route, 11/11 execution prompts do
  not; p95 ~0.02ms; 10k-char prompt ~102ms (no ReDoS);
- classifier: no LLM, no network, never blocks, non-SGSD silent + zero writes,
  empty/garbage/null stdin → exit 0 no stack, registry source is ONE named
  constant resolved from `__dirname` (keeps the P149 one-line swap);
- quality gate: Edit/Write/NotebookEdit only, unknown tool → no row, plan
  present → no row, non-SGSD → exit 0 + zero files, STATE without phase → no
  `missing_plan` row;
- bench still records `intent_classifier_bench` (iterations 200, p95_ms < 1000)
  and refuses a non-canonical `--record`;
- the T146-06 cockpit adapter must still surface a real `missing_plan` row.

## Verify (report exact exit codes)
1. `node --check` both files.
2. GAP-1: force a registry read failure (e.g. temporarily point the constant at
   a path that is a directory, or make the registry unreadable in a temp copy)
   → assert a failure row with the distinct reason code IS appended inside an
   SGSD fixture, exit 0, no stack; and that a NON-SGSD dir in the same
   condition writes NOTHING.
3. GAP-1: force an evidence-append failure (metrics as a FILE) → assert exit 0,
   no stack, breadcrumb present, no throw from the failure handler itself.
4. GAP-2: change the registry's tool list in a TEMP copy and assert the gate's
   matcher follows it; then make the registry unreadable and assert the
   Edit/Write/NotebookEdit fallback applies AND a failure row is written.
5. Whatever you implement for GAP-3, verify it.
6. Re-run the full preserve list above.
Build payloads with JSON.stringify — hand-written JSON with Windows paths
breaks on unescaped backslashes and silently yields an empty payload.
If your sandbox blocks node, say so in BLOCKERS and still report changes.

SURGICAL CONSTRAINT — every changed line must trace to GAP-1/2/3. Orphan edits
are DEVIATIONS: report, do not commit silently.

## Report contract (<300 words)
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none expected
ONE_LINER: substantive summary
