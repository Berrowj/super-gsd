---
milestone: v3.2
generated_at: 2026-05-22T00:00:00Z
source_design: DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md
probe_duration_sec: 42
phases_scanned: 8
status: PARTIAL
first_stall_eta_min: n/a
summary: "P120–P123 and P125–P127 are GO. P124 is DEGRADED-PATH (VTP configured but live session reachability unverifiable at probe time; starter cockpit principles from 2026-05-22 research in DLB-12 cover the gap). plantuml/Java absent — DEGRADED-PATH only, svg-fallback-generator.cjs covers P122. plan-locked.schema.json is in super-gsd/schemas/ not super-gsd/templates/ — informational, not a blocker."
---

# Milestone Readiness — v3.2 Operator Comprehension System

> Pre-flight dependency audit. Generated 2026-05-22 before auto-mode execution.
> If this file is older than the latest phase change in the milestone, re-run `/gsd-readiness`.

## GO — Safe to run unattended

Phases whose probed dependencies are all green AND whose upstream phases are not blocked.

| Phase | Title | ETA | Notes |
|-------|-------|-----|-------|
| P120 | Shared Design System + 12-Rule Conformance Checklist | — | Node OK; gold-reference HTML present; book research doc present; foundation-only phase, no upstream deps |
| P121 | Chronicle data-model upgrade | — | Node OK; chronicle toolchain (build-context-pack.cjs, chronicle.schema.json) present; depends only on P120 (GO) |
| P122 | Chronicle renderer rebuild | — | Node OK; render-html.cjs + section templates present; svg-fallback-generator.cjs covers plantuml absence; DEGRADED-PATH for diagrams only |
| P123 | Chronicle validator lints + conformance | — | Node OK; validate-chronicle.cjs present; run-self-test.cjs confirmed executable (96+ self-test green in v3.1) |
| P125 | Cockpit alert grammar + North-Star ranking | — | Node OK; cockpit-sidecar.cjs + fog-score.cjs present; depends on P124 design spec output only |
| P126 | Cockpit answer-first surface | — | Node OK; cockpit-sidecar.cjs present; shared design system from P120; depends on P124 design spec |
| P127 | Cockpit integration + cross-surface conformance | — | Node OK; all upstream toolchain present; cross-surface test is pure Node |

## BLOCKED AT START — Fix these before running

None. No phase is hard-blocked.

## WILL BLOCK MID-RUN — Cascade blockers

None. No cascade blockers. P124 is DEGRADED-PATH, not BLOCKED — see below.

## DEGRADED-PATH — Phases with fallback coverage

### P124 — Cockpit research + design lock (VTP reachability unverified)

- **Dep:** VTP MCP (`vtp-kb` in `.mcp.json`) — configured and present in project MCP config.
- **Issue:** Live session VTP reachability could not be proven via a port/HTTP probe within the 60s probe budget. Marked DEGRADED-PATH per instructions.
- **Fallback:** The 2026-05-22 book research pass already retrieved the 5 cockpit-specific principles (preattentive single-focus, colour-sparingly, one North Star, information-overload-default, threshold-to-alert grammar) and they are documented in DLB-12 section "The six DLB-12 invariants" and in ROADMAP.md. P120 also encodes them in `design-rules.json` as the `cockpit` rule group. P124 research can proceed without a live VTP call if the MCP is unresponsive — the retrieved material is already local.
- **If VTP is live when P124 executes:** pull figure images c05f017, c07f034, c05f011 for the cockpit design spec (chart-redesign figures cited in ROADMAP.md).
- **Fix (if VTP unresponsive):** `codex-exec.sh` research prompt instructs Codex to use the pre-retrieved DLB-12 + `.planning/analyses/2026-05-22-chronicle-html-book-research.html` material directly. No human action needed — orchestrator handles this automatically.

### P122 — plantuml/Java absent (diagram rendering)

- **Dep:** `java` binary + `plantuml.jar` — Java not found on PATH (Windows or WSL); plantuml.jar not found anywhere in project.
- **Fallback:** `svg-fallback-generator.cjs` is present at `super-gsd/tools/chronicle/svg-fallback-generator.cjs` (confirmed). This was the DLB-11 R1 fallback and it carries forward. Inline-SVG diagrams will use the fallback generator; no human action needed.
- **If you want full plantuml:** Install JDK and place plantuml.jar in the project root or `super-gsd/tools/chronicle/`. This is optional — the fallback is production-quality.

## DEGRADED AUTO-RUN PATH

All 8 phases can run unattended. P124 degrades gracefully to pre-retrieved VTP material. P122 degrades gracefully via svg-fallback-generator.cjs.

- **Path:** P120 → P121 → P122 → P123 → P124 → P125 → P126 → P127
- **Total ETA:** Not estimated (no per-phase ETA in CONTEXT.md)
- **Stops at:** None — full run is viable
- **Command:** `/sgsd-orchestrate auto`

No explicit stop point. The orchestrator should run all 8 phases to completion. If VTP is unreachable when P124 executes, the orchestrator writes a VTP_STATUS=DEGRADED row and continues with pre-retrieved material per the auto-mode orchestration contract.

## PROBE LOG

| Time | Phase | Dep | Probe | Result |
|------|-------|-----|-------|--------|
| 2026-05-22T00:00Z | ALL | Node.js | `node --version` | PASS — v22.22.3 |
| 2026-05-22T00:00Z | ALL | Codex CLI | `codex --version` | PASS — codex-cli 0.1300.0 |
| 2026-05-22T00:00Z | ALL | codex-executor.sh | glob `super-gsd/scripts/codex-executor.sh` | PASS — present |
| 2026-05-22T00:00Z | ALL | codex-exec.sh | glob `super-gsd/scripts/codex-exec.sh` | PASS — present |
| 2026-05-22T00:00Z | ALL | codex-patch-executor.sh | glob `super-gsd/scripts/codex-patch-executor.sh` | PASS — present |
| 2026-05-22T00:00Z | ALL | plan-schema-v2.json | glob `super-gsd/templates/plan-schema-v2.json` | PASS — present |
| 2026-05-22T00:00Z | ALL | plan-locked.schema.json | glob `super-gsd/templates/plan-locked.schema.json` | INFO — not in templates/; found at `super-gsd/schemas/plan-locked.schema.json` (correct location) |
| 2026-05-22T00:00Z | P120 | gold-reference HTML | glob `super-gsd/tools/chronicle/templates/chronicle-gold-reference.html` | PASS — present |
| 2026-05-22T00:00Z | P120 | book research doc | glob `.planning/analyses/2026-05-22-chronicle-html-book-research.html` | PASS — present |
| 2026-05-22T00:00Z | P121-P123 | render-html.cjs | glob `super-gsd/tools/chronicle/render-html.cjs` | PASS — present |
| 2026-05-22T00:00Z | P121-P123 | validate-chronicle.cjs | glob `super-gsd/tools/chronicle/validate-chronicle.cjs` | PASS — present |
| 2026-05-22T00:00Z | P121-P123 | build-context-pack.cjs | glob `super-gsd/tools/chronicle/build-context-pack.cjs` | PASS — present |
| 2026-05-22T00:00Z | P121-P123 | run-self-test.cjs | glob `super-gsd/tools/chronicle/run-self-test.cjs` | PASS — present |
| 2026-05-22T00:00Z | P122 | svg-fallback-generator.cjs | glob `super-gsd/tools/chronicle/svg-fallback-generator.cjs` | PASS — present (plantuml fallback confirmed) |
| 2026-05-22T00:00Z | P122 | Java / plantuml.jar | `java -version` + `where java` + find plantuml.jar | FAIL — Java not on PATH; plantuml.jar not found; DEGRADED-PATH via svg-fallback-generator.cjs |
| 2026-05-22T00:00Z | P124 | VTP MCP | grep `.mcp.json` for vtp-kb | PASS — vtp-kb entry present in `.mcp.json` |
| 2026-05-22T00:00Z | P124 | VTP live reachability | not probed (HTTP endpoint unknown; probe budget constraint) | UNKNOWN — treated as DEGRADED-PATH; pre-retrieved material covers gap |
| 2026-05-22T00:00Z | P125-P127 | cockpit-sidecar.cjs | glob `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` | PASS — present |
| 2026-05-22T00:00Z | P125-P127 | fog-score.cjs | glob `super-gsd/tools/cockpit-sidecar/fog-score.cjs` | PASS — present |
| 2026-05-22T00:00Z | P121-P123 | chronicle self-test smoke | `node run-self-test.cjs` (exit 0 confirmed) | PASS — toolchain executable, SAC-P119 assertions green |

## Notes for the human

- No fixes required. All phases have a runnable path.
- P124 VTP: if `vtp-kb` MCP is active in the Claude session, the orchestrator will use it for figure retrieval. If it times out, auto-mode writes VTP_STATUS=DEGRADED and continues — no manual action.
- P122 plantuml: the svg-fallback-generator.cjs is production-quality. Installing Java/plantuml is optional and can be done between P121 and P122 if desired.
- `plan-locked.schema.json` lives at `super-gsd/schemas/plan-locked.schema.json` not `super-gsd/templates/`. This is the correct location; no action needed.
- After running fixes (if any), reply `continue` — the orchestrator re-probes and resumes.

## sgsd-curate suggestions

- **New pattern:** `plan-locked.schema.json` lives at `super-gsd/schemas/`, not `super-gsd/templates/`. Future readiness audits should probe `super-gsd/schemas/plan-locked.schema.json`. Suggest curating as a `pattern` entry: "Plan schema location — plan-locked.schema.json is in super-gsd/schemas/, not super-gsd/templates/".
- **New pattern:** VTP MCP liveness cannot be proven via a local port probe; presence in `.mcp.json` is the best available signal. Future audits should check `.mcp.json` for the `vtp-kb` key and mark DEGRADED-PATH if live session reachability is unverifiable, rather than BLOCKED.
