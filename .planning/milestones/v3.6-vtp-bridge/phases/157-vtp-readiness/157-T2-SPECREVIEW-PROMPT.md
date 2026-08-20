# P157-T2 spec-compliance review — raw artifacts, not executor claims

Read only. T2 changes UNCOMMITTED: `git diff` for the seven modified files, direct
read for new `super-gsd/tools/vtp-readiness/run.cjs`. Report `157-T2-REPORT.md` is
orchestrator-salvaged (wrapper timeout); trust the diff over any narrative.

Check against task P157-T2 in `157-01-PLAN-LOCKED.md` (rev 2), in order:
1. SECRETS/LEAKS: run.cjs JSON limited to trigger/aggregate/probe id/status/env_name/
   reason_code — no URL parts, socket errors, paths, or values. AMENDMENT-1: manual
   consult output and appended rows redact dispatch.cwd, rendered {project_dir}, raw
   spawn errors (implementation in orchestrator-hooks.cjs — a files_touched deviation,
   assess necessity, not just flag it).
2. Probes: freshness compares dist/cli.js vs newest regular src file, no symlink
   escapes, stale => WARN "reconnect MCP" never rebuild; Qdrant = presence + ONE
   bounded TCP connect, no HTTP; evidence store = presence + file/dir existence.
3. Both entrypoints real: Rule 0 carries the exact --trigger auto command before
   manifest classification; manual skill uses production on-demand consult with
   dispatch [0]/[1] semantics; agents consume PROBE LOG rows, no probe copies.
4. Boundary: vtp-services.yaml + registry.cjs (T1) unmodified; no gates.yaml change;
   no hook does network.
5. Scope: anything touched beyond the eight files above + orchestrator-hooks.cjs.

Output, contract lines first, then max 120 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
SPEC_VERDICT: pass | fix_required | blocked
REQUIRED_FIXES: none | <numbered>
```
