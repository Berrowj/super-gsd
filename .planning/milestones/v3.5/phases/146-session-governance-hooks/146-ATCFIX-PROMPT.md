# P146 phase-ATC fix — make containment and degradation STRUCTURAL, not patched

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. Files you may touch:
`super-gsd/scripts/lib/sgsd-state.cjs`, `super-gsd/scripts/lib/gate-evidence-log.cjs`,
`super-gsd/hooks/sgsd-intent-classifier.cjs`, `super-gsd/hooks/sgsd-quality-gate.js`,
`super-gsd/tools/cockpit-state/adapter.cjs`. Nothing else.

The phase-level ATC verdict was: "the hooks work as PATCHES, but root/write
validation and registry/ledger degradation are not STRUCTURALLY solved." That
is the point of this dispatch. Do not add a fifth site-specific patch — unify
the contract.

## CRIT-1 — one containment contract, used by every writer
Today: `sgsd-session-start.js` does realpath checks; `findSgsdRoot` accepts
`.planning` via `statSync`; `logGateEvidence` derives
`.planning/metrics/gate-evidence.jsonl` with no symlink/realpath containment;
the classifier and quality gate call the weaker path. Four separate hardenings,
no shared guarantee.

Required: ONE exported containment helper in `sgsd-state.cjs` — e.g.
`resolveContainedPath(root, relativeSubpath)` — that:
- realpaths the root and the nearest existing ancestor of the target;
- verifies the resolved target is inside the realpathed root;
- refuses symlink/junction escapes;
- returns null (never throws) when containment fails.
Then make `logGateEvidence` (and any other writer in these files) obtain its
destination ONLY through that helper. `findSgsdRoot` must apply the same
realpath standard rather than a bare `statSync`.
Behavior must not change for legitimate repos. This is the FIFTH instance of
"writer accepts a caller-supplied destination" in this phase — the fix is to
remove the possibility, not to guard one more call site.

## CRIT-3 — registry degradation at ROUTE level (7th silent-success instance)
The previous fix caught zero-route-COUNT. But the hand parser accepts any `id`,
and malformed trigger/enforcement shapes are silently coerced to empty lists or
skipped directives. A registry with several structurally-plausible routes whose
triggers are all invalid therefore yields zero matches and NO degraded row —
prompt governance silently off with a healthy-looking hook.

Required: validate route SHAPE when parsing (a usable route needs an id, at
least one non-empty trigger phrase/regex, and an enforcement with a
`/sgsd-`-prefixed directive of a known kind). Count usable vs total. Treat
"routes present but ZERO usable" — and any route dropped for being malformed —
as degraded, with a distinct reason code (e.g. `registry_routes_invalid`),
emitting a failure row via the existing writer. Keep `registry_unparsed`,
`registry_empty`, `registry_unavailable` semantics intact.

## WARN-1 — ledger silently drops malformed lines
`readGateEvidenceRows` skips unparseable JSONL lines and the adapter only
detects the all-or-nothing case, so a partially corrupt or tampered ledger
reads as healthy while evidence vanishes. Required: count skipped lines, return
that count alongside the rows (without breaking existing callers), and have the
cockpit governance section surface a non-zero skipped count as a degraded
state with a breadcrumb — reusing the existing `ok`/`empty`/`unavailable`
vocabulary rather than inventing a parallel one.

## WARN-2 — plan detection ignores milestone scope (correctness bug)
`sgsd-quality-gate.js` reads `state.milestone` but calls
`findPlanLockedFiles(root, state.phase)`, and that helper searches ALL
milestones. A stale same-numbered PLAN-LOCKED from a previous milestone
suppresses missing-plan evidence for the ACTIVE milestone. Required: scope the
lookup to the active milestone when one is known, while still supporting the
flat `.planning/phases/` layout. Do not break T146-06's retraction behavior,
which depends on this lookup.

## Explicitly NOT in scope
Do NOT add `MultiEdit` anywhere. It does not exist in this harness (verified:
the orchestrator session's own tool set is Edit/Write/NotebookEdit; research Q1
documents the 2.1.222 payloads without it; the only repo references are
historical file snapshots), and the locked plan names including it as an
explicit falsifier. The phase-ATC finding that asked for it is rejected.

## Preserve (all pass on the host today — must not regress)
classifier recall 13/13 + precision 11/11, p95 ~0.02ms, 10k prompt ~102ms;
degraded rows for unavailable/unparsed/empty registry; evidence-append failure
cannot throw from inside the handler; non-SGSD → exit 0, empty stdout, ZERO
files written, even when degraded; quality gate Edit/Write/NotebookEdit only,
unknown tool → no row, plan present → no row, STATE without phase → no
missing_plan row; bench iterations 200 with p95_ms < 1000 and non-canonical
`--record` refused; adapter surfaces a real missing_plan row, distinguishes
ok/empty/unavailable, scopes to active phase, dedupes, and RETRACTS when a plan
appears; adapter stays READ-ONLY on the ledger; adapter `--self-test` 19/19;
no LLM, no network, never blocks.

## Verify (report exact exit codes)
1. `node --check` every file you touch.
2. CRIT-1: a symlinked/junctioned `.planning` (or metrics dir) must refuse the
   write — assert ZERO files created at the escape destination and no `.tmp`
   left behind; legitimate repos still write. If link creation needs elevation,
   detect and SKIP that assertion with a printed reason rather than failing.
3. CRIT-3: a registry whose routes are present but structurally invalid →
   degraded row with the new reason code, exit 0, no stack. Restore the real
   registry afterwards — it is shared with the quality gate.
4. WARN-1: a ledger with some corrupt lines → adapter reports a degraded state
   with a breadcrumb rather than a clean bill of health.
5. WARN-2: two milestones each containing a phase `146` directory, only the
   NON-active one holding a PLAN-LOCKED → the gate MUST still emit
   missing_plan for the active milestone.
6. Full preserve list above, including adapter `--self-test`.
Build payloads with JSON.stringify — hand-written JSON with Windows paths
breaks on unescaped backslashes and silently yields an empty payload.
If your sandbox blocks node/bash, say so in BLOCKERS and still report changes;
note that adapter self-test A7/A10 failures are known sandbox artifacts that
pass 19/19 on the host.

SURGICAL CONSTRAINT — every changed line must trace to CRIT-1, CRIT-3, WARN-1
or WARN-2. Orphan edits are DEVIATIONS: report, do not commit silently.

## Report contract (<300 words)
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none expected
ONE_LINER: substantive summary
