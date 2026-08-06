# P146 T146-01 — shared state resolver + gate-evidence envelope writer

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer contract: fresh context, THIS TASK ONLY (T146-01 of 7), verify
before reporting, self-review, explicit DONE / DONE_WITH_CONCERNS / BLOCKED.
Do not start T146-02..07. Do not run other phases' self-tests.

## Files you may touch (nothing else)
- `super-gsd/scripts/lib/sgsd-state.cjs`      (CREATE — this task OWNS it)
- `super-gsd/scripts/lib/gate-evidence-log.cjs` (CREATE — this task OWNS it)
- `.planning/STATE.md`                         (add one frontmatter key)
- `.planning/metrics/gate-evidence.jsonl`      (may be created by the writer)

## Output contract (from the locked plan)
Add shared SGSD-root / STATE-frontmatter / active-phase / PLAN-LOCKED-glob
resolution plus a gate-evidence envelope writer. Add `current_phase: "146"` to
`.planning/STATE.md` frontmatter if absent, so this phase has canonical
frontmatter data. T146-01 OWNS creation of both libs and the evidence stream;
later tasks only consume the helpers and append envelope-v1 rows.

## Input contract
Canonical STATE frontmatter phase key is `current_phase`. Keep any legacy
`phase` key as READ-ONLY compatibility. NEVER parse the prose `status:` line
for a phase number — that is the exact bug being removed (see
`super-gsd/tools/autopilot-watchdog/check.cjs:119-130` for the prose regex this
replaces; do NOT modify that file in this task).

## Required API surface (the plan's verification depends on these exact names)
`sgsd-state.cjs` must export at least:
- `findSgsdRoot(startDir)` → absolute repo root containing `.planning/`, walking
  up from startDir; returns null (never throws) when there is no SGSD ancestor.
- `readState(root)` → object with at least `{ milestone, phase, phaseSource }`;
  returns null when absent/unreadable. `phaseSource` is a closed vocabulary:
  `"current_phase"` | `"legacy_phase"` | `"status_prose"` | `"absent"`.
  Because prose parsing is forbidden, `readState` must NEVER return
  `phaseSource === "status_prose"` — that value exists only so callers can
  assert its absence (the plan's verification exits 2 if it is ever returned).
- a PLAN-LOCKED glob helper resolving real `{NN}-*-PLAN-LOCKED.md` files for a
  given phase under both layouts: `.planning/phases/` and
  `.planning/milestones/*/phases/`.

`gate-evidence-log.cjs` must export a never-throw append writer for
`.planning/metrics/gate-evidence.jsonl` using envelope-v1 shape. Mirror the
existing pattern in `super-gsd/scripts/lib/gate-value-log.cjs` (read it; reuse
its schema/never-throw conventions rather than inventing a new shape). On any
internal error it returns a falsey/`{ok:false}` result — it must never throw
upward and never block a caller.

## Hard constraints (board-binding; violating any is a defect)
- Never throw upward. Non-SGSD repo → quiet no-op, callers can exit 0.
- No hook/lib may read `~/.claude/settings.json` (it holds live API keys).
- No hardcoded machine paths. Resolve from the passed-in cwd/root.
- Windows-safe: no chmod reliance, no POSIX-only assumptions, no network.
- Zero new runtime dependencies (Node built-ins only).

## Reuse, do not reimplement
Read first and follow local conventions:
- `super-gsd/scripts/lib/gate-value-log.cjs` (envelope + never-throw writer)
- `super-gsd/hooks/sgsd-activity-logger.js:72-91` (`readActivePhase` — the
  inline parser this task generalizes)

## Verify (run these; all must pass before you report DONE)
1. `node --check super-gsd/scripts/lib/sgsd-state.cjs`
2. `node --check super-gsd/scripts/lib/gate-evidence-log.cjs`
3. Resolver reads real STATE: root found, `milestone === "v3.5"`, and
   `phaseSource !== "status_prose"`.
4. Non-SGSD behavior: `findSgsdRoot` on an OS temp dir returns null and does
   not throw.
5. Writer appends a row to a TEMP path without throwing, and the row parses as
   JSON.
If your sandbox cannot run bash/node, say so explicitly in BLOCKERS and still
report exactly what you changed — the orchestrator will verify host-side.

SURGICAL CONSTRAINT — every changed line must trace to T146-01. Orphan edits
(unrelated refactors, comment tweaks, formatting passes) are DEVIATIONS: report
them, do not commit them silently. Match existing code style. If you notice
pre-existing dead code, mention it in DEVIATIONS — do NOT delete it. Remove only
imports/variables/functions that YOUR changes made unused.

## Report contract (<300 words)
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: path | purpose | interface | none
ONE_LINER: substantive summary
