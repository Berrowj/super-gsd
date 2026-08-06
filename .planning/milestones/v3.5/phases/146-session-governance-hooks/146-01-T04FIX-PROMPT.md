# P146 T146-04 fix — registry resolved from the WRONG root (silent no-op)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. File you may touch:
`super-gsd/hooks/sgsd-intent-classifier.cjs`. Nothing else.

## CRITICAL — the plan's own acceptance command FAILS today
`registryPath(root)` joins `REGISTRY_RELATIVE_PATH` onto the SGSD root derived
from `payload.cwd`. So the registry is only found when the TARGET repo itself
contains `super-gsd/registry/session-governance-hooks.yaml`.

Reproduced with the plan's exact acceptance fixture (a temp repo containing
ONLY `.planning/STATE.md`, no `super-gsd/`):
    stdout = ""   stderr = "[SGSD] sgsd-intent-classifier registry_unavailable"
    → the plan's `if ($posText -notmatch "/sgsd-triage") { exit 1 }` FAILS.

Why this matters beyond the test: T146-02 installs these hooks into a repo's
`.claude/settings.json` using ABSOLUTE paths to THIS checkout's
`super-gsd/hooks/`. The whole point of the phase is governance in every
session, including sessions in OTHER repos. In any such repo the classifier
finds no registry, emits nothing, and exits 0 — AC-146b silently dead in
exactly the deployment it was built for. This is the phase's recurring
**silent success** hazard (cf. T146-03's optional-enrichment suppression and
P145's `OK — written (0B)`).

## Required fix
1. Resolve the registry relative to the HOOK'S OWN location (`__dirname`), not
   the target repo root. The registry ships alongside the hook inside
   `super-gsd/`, so `path.resolve(__dirname, '..', 'registry',
   'session-governance-hooks.yaml')` (or equivalent) is the correct source.
   Keep it a SINGLE named constant so the P149 `skill-routing.yaml` swap stays
   a one-line change — that requirement still holds; say which line in your report.
2. Keep `payload.cwd` → `findSgsdRoot` for what it is genuinely for: deciding
   whether we are inside an SGSD repo at all (silence + no writes outside one),
   and deriving the evidence-ledger destination. Do NOT use it for the registry.
3. If BOTH lookups are wanted, prefer the hook-relative registry and fall back
   to a repo-local one only if it exists — but the hook-relative path must be
   authoritative so a foreign repo still routes correctly.
4. Preserve the "outside an SGSD repo → exit 0, empty stdout, write nothing"
   behavior exactly. A foreign repo that IS an SGSD repo must now route; a
   directory that is NOT an SGSD repo must still stay silent.
5. `registry_unavailable` must remain a stderr breadcrumb (never a stack, never
   nonzero exit) — but it must no longer be the normal case.

## Regression checks to add to your verification
- PLAN FIXTURE: temp repo containing ONLY `.planning/STATE.md` (no `super-gsd/`),
  payload cwd = that temp repo, prompt "Can you plan the next phase and write
  the implementation plan?" → stdout CONTAINS `/sgsd-triage`, exit 0.
- Same fixture, prompt "Please read README.md and report the first heading."
  → stdout does NOT contain `/sgsd-triage`, exit 0.
- Non-SGSD dir (no `.planning` at all) → exit 0, EMPTY stdout, zero files written.
- Bench still records `intent_classifier_bench` with numeric `p95_ms` < 1000
  and `iterations` 200, and still refuses to write outside a validated SGSD root.
- empty / garbage / null stdin → exit 0, no stack trace.

## Verify (report exact exit codes)
1. `node --check super-gsd/hooks/sgsd-intent-classifier.cjs`
2. Every regression check above.
3. Quote the single registry-source line in your report.
NOTE: when testing by hand, build the payload with JSON.stringify — hand-written
JSON containing Windows paths breaks on unescaped backslashes and silently
yields an empty payload (this cost the orchestrator a false diagnosis).
If your sandbox blocks node, say so in BLOCKERS and still report changes.

SURGICAL CONSTRAINT — every changed line must trace to this finding. Orphan
edits are DEVIATIONS: report, do not commit silently. Match existing style.

## Report contract (<300 words)
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none expected
ONE_LINER: substantive summary
