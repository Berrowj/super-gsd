# P148 T148-01 — triage runtime scaffold + VTP null-reflection fallback

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS TASK ONLY (T148-01 of 5). Verify before
reporting. DONE / DONE_WITH_CONCERNS / BLOCKED.

## ⚠️ 16 CRITICALs across P145-P147, two classes — do not add the 17th
1. **Containment:** derive roots INDEPENDENTLY of targets (the T147-01 lesson:
   `resolveContainedPath(dirname(x), basename(x))` is circular and proves
   nothing). All writes (VTP-EVIDENCE.md, routing-log rows, evidence rows) go
   through `resolveContainedPath(root, rel)` with root from
   `findSgsdRoot`/STATE presence. The plan's input_contract explicitly bans
   `path.resolve(projectDir, ...)` for metrics paths.
2. **Silent success:** the fallback predicate firing, the fallback itself
   failing, a route error — each is a DISTINCT reason-coded envelope row via
   `logGateEvidence` + non-stack breadcrumb. A triage that lost VTP evidence
   must never look like one that had none to lose.

## Files (T148-01 owns the first and third; composer is a bounded update)
- super-gsd/scripts/sgsd-triage-runtime.cjs      (CREATE — CLI + module API)
- super-gsd/scripts/lib/vtp-context-composer.cjs (UPDATE — contained,
  fixture-readable routing-log writes ONLY; do not restructure)
- super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs (CREATE —
  fixture runner, mirroring super-gsd/tests/commit-gate's scenario style)

## Output contract (locked plan)
Runtime helper with a real CLI entrypoint + module API for the VTP phase:
reads STATE frontmatter (readState — never prose), composes/projects triage
context, invokes the initial VTP route through the composer's `callVtp(...)`,
applies the EXACT fallback predicate — route ok AND (reflection === null OR
evidence_hit_count < 2) — invokes ONE direct-search fallback when required,
writes VTP-EVIDENCE.md through contained paths, appends reason-coded
degradation envelopes. The composer's routing-log writes become contained +
fixture-readable (injectable log root for tests).

## Falsifier — FAILS if any holds
Null-reflection route does not trigger direct search; a healthy 2-hit route
DOES trigger fallback (over-firing); a route FAILURE does not produce its own
distinct degradation row; writes escape containment; VTP tools are called
directly from skill prose.

## Fixture reality (this task has no live VTP in tests)
The test runner must inject canned VTP responses (an injectable transport on
the composer/runtime seam — e.g. a module-level test hook or env-pointed
fixture file, mirroring how commit-gate tests fake codex via PATH). Scenarios:
1. healthy route (reflection present, hits>=2) → NO fallback, evidence written;
2. reflection:null → fallback fires, degradation row with exact predicate
   reason, direct-search results used;
3. hits<2 (reflection present) → fallback fires with its own reason variant;
4. route throws/errors → fallback attempted + route_failed row;
5. fallback ALSO fails → triage continues evidence-less with BOTH rows, exit 0;
6. non-SGSD cwd → silent exit 0, zero writes.

## Verify (report exact exit codes)
1. node --check all three files.
2. All six scenarios above via the fixture runner.
3. Composer routing-log rows land inside the fixture root (not the repo).
JSON.stringify for payloads. SURGICAL CONSTRAINT. <300-word report.
