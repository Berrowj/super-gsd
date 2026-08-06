# P146 T146-01 ATC fix — 1 CRITICAL + 3 WARNINGS

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY, verify before reporting,
explicit DONE / DONE_WITH_CONCERNS / BLOCKED. Files you may touch:
`super-gsd/scripts/lib/gate-evidence-log.cjs`,
`super-gsd/scripts/lib/sgsd-state.cjs`. Nothing else.

## CRIT-1 (confirmed by live probe) — writer escapes the SGSD root
`_planningDir()` falls back to returning any resolved input when no
`.planning` exists, so `logGateEvidence()` creates
`<arbitrary>/metrics/gate-evidence.jsonl` outside an SGSD repo and returns
`status: "ok"`.
Reproduced: `logGateEvidence(os.mkdtempSync(...), {...})` created
`<tmp>/metrics/gate-evidence.jsonl` and reported ok.
This breaks board-binding AC-146d: in a non-SGSD repo every hook must exit 0
AND write no SGSD metrics. All six downstream hook tasks call this writer.

Fix: resolve the ledger path ONLY inside a real SGSD root. Accept either a
`.planning` directory itself or a directory containing one (walk up if that is
the existing contract), and when no `.planning` ancestor exists, DO NOT create
anything — return a falsey/no-op result (keep never-throw). Distinguish
"no-op, not an SGSD repo" from "ok, row written" in the returned value so
callers and tests can tell them apart. Do not change behavior for real SGSD
roots: the current host verification must still pass unchanged.

## WARN-2 — unbounded ledger read
`readGateEvidenceRows()` reads and parses the entire ledger before filtering; a
large ledger can block or OOM despite the public try/catch. Add a bounded
read: a `limit`/tail option (default to a sane bound) so the cockpit/watchdog
consumers in T146-06 read only recent rows. Keep the existing signature
working for current callers.

## WARN-3 — frontmatter parsing gaps
`sgsd-state.cjs` misses BOM-prefixed `STATE.md` and silently last-wins on
duplicate keys. Strip a leading UTF-8 BOM before parsing. For duplicate keys,
keep last-win (do not change resolution semantics) but make it visible — e.g.
record the condition on the returned object so a caller can surface it. Do not
add a throw.

## WARN-4 — dead/ambiguous exported surface
`resolvePlanLockedFiles` and `findPlanLockedForPhase` are duplicate aliases.
Keep ONE name (pick the one the locked plan's downstream tasks will call and
say which in your report); delete the other alias.
DO NOT delete `PHASE_SOURCE.STATUS_PROSE`. It is deliberately unreachable: the
locked plan's verification asserts `phaseSource !== "status_prose"` and exits 2
if it ever appears, so the constant is the contract for "prose parsing has
returned". Add a one-line comment stating exactly that so a future reader does
not delete it as dead code.

## NOT in scope (do not attempt)
The ATC's other WARNING proposed extracting a shared envelope JSONL
writer/reader used by both `gate-evidence-log.cjs` and `gate-value-log.cjs`.
`gate-value-log.cjs` is OUTSIDE this task's allowed files and is consumed by
existing gates. Leave it alone; the orchestrator is recording that as a
deferred item.

## Verify (all must pass; report exact exit codes)
1. `node --check` both files.
2. Real repo unchanged: resolver still yields milestone `v3.5`, phase `146`,
   `phaseSource === "current_phase"`.
3. NON-SGSD probe now no-ops: calling `logGateEvidence` with an OS temp dir
   creates NO file anywhere under it and returns a non-ok/no-op result without
   throwing.
4. Real-root write still works: writing to a temp fixture that DOES contain a
   `.planning` dir appends a parseable envelope-v1 row.
5. Bounded read returns at most the requested limit.
6. A BOM-prefixed STATE.md fixture parses correctly.
If your sandbox cannot run node, say so in BLOCKERS and still report the
changes — the orchestrator verifies host-side.

SURGICAL CONSTRAINT — every changed line must trace to a finding above. Orphan
edits are DEVIATIONS: report, do not commit silently. Match existing style.
Remove only what YOUR change made unused.

## Report contract (<300 words)
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none expected
ONE_LINER: substantive summary
