---
milestone: v3.1
generated_at: 2026-05-21T00:00:00Z
probe_duration_sec: 42
phases_scanned: 7
source_design: DLB-11-CHRONICLE-LAYER.md
status: PARTIAL
first_stall_eta_min: n/a
summary: "P113-P114 GO (Node+ajv+schemas all green). P115-P119 DEGRADED-PATH: java+plantuml.jar absent; DLB-11 R1 fallback (skip_gates: [puml-render]) routes P115 to svg-fallback-generator.cjs. No phase is hard-BLOCKED if operator opts into PUML fallback before P115 first executor dispatch."
---

# Milestone Readiness — v3.1 SGSD Chronicle Layer

> Pre-flight dependency audit run 2026-05-21. Generated before auto-mode execution.
> If this file is older than the latest phase change in the milestone, re-run readiness audit.
>
> Scope: P113-P119 (7 phases). Source design: DLB-11. Predecessor: v3.0 ALL-PHASES-CLOSED @ a19528a.

## GO — Safe to run unattended

Phases whose probed dependencies are all green AND whose upstream phases are not blocked.

| Phase | Title | ETA | Notes |
|-------|-------|-----|-------|
| P113 | Chronicle Schema + Manifest | ~2h | Schema + fixtures only. Node v22.22.3 + ajv v8.18.0 + ajv-errors v3.0.0 all present in super-gsd/tools/plan-schema/node_modules/. plan-schema-v2.json + plan-locked.schema.json + cmb.schema.json all valid JSON. Ships ZERO executable tools — cmb-validate-helper.cjs deferred to P114. Local close gate: all 16 files parse as valid JSON. |
| P114 | Context-Pack Builder | ~3h | Inherits all P113 GO deps. cmb-validate-helper.cjs ships here; SAC verification commands run at P114 close. Node + ajv confirmed present. Mesh ledger (.planning/mesh/memory/cmbs.jsonl) readable. Git evidence readable via git log. No PUML dependency. |

## PARTIAL — Degraded path available

Phases whose primary path has a missing dep but where DLB-11 specifies an explicit fallback that keeps execution runnable.

### P115 — HTML Renderer + PUML Diagrams

**Primary path:** `java -jar plantuml.jar -tsvg <file.puml>` invoked from render-html.cjs.

**Missing deps:**
- `java` binary: NOT FOUND in PATH (`java --version` exit 127)
- `plantuml.jar`: NOT FOUND at any of 6 probed paths:
  - `C:\Users\user\plantuml.jar` — absent
  - `C:\tools\plantuml.jar` — absent
  - `C:\Program Files\PlantUML\plantuml.jar` — absent
  - `C:\Program Files (x86)\PlantUML\plantuml.jar` — absent
  - `%USERPROFILE%\plantuml.jar` — absent
  - `C:\Users\user\Downloads\plantuml.jar` — absent

**DLB-11 R1 fallback (explicit, operator-authorized):** `skip_gates: ["puml-render"]` with `skip_reason:` routes the renderer to `super-gsd/tools/chronicle/svg-fallback-generator.cjs` (hand-coded SVG generator with visible "PUML source available; rendered via fallback generator" banner). This file does NOT yet exist — P115 ships it. P115 execution itself creates the fallback generator.

**Status: DEGRADED-PATH.** P115 is GO on its own executor dispatch because P115 ships the fallback generator. The operator must add `skip_gates: ["puml-render"]` to the P115 PLAN before the first executor dispatch. The PUML `.puml` source files are still authored and committed (DLB-11 R1 transparency invariant preserved); only the pre-render step is skipped.

**One-liner fix (preferred — install Java + plantuml.jar):**
```powershell
# Download plantuml.jar from https://plantuml.com/download
# Place at: C:\Users\user\plantuml.jar
# Install JDK: winget install Microsoft.OpenJDK.21
# Then remove skip_gates from P115 PLAN
```

**One-liner fix (fallback path — no Java required):**
```
# In P115 PLAN frontmatter, set:
# skip_gates: ["puml-render"]
# skip_reason: "plantuml.jar + java absent at P115 entry; svg-fallback-generator.cjs ships this phase"
```

### P116 — Chronicle Validator + Benchmark

**Status: DEGRADED-PATH.** Own deps (Node + ajv + P114 helper) are green. Benchmark fixtures (`super-gsd/tools/chronicle/benchmarks/good-*.json` x4, `bad-*.json` x4) are ABSENT — expected; P116 ships them. The ≥95% held-out precision gate depends on fixtures authored at P119; this is a future-binding dependency, not now-blocking. Throughput floor (<2s/chronicle) is a self-test assertion, not a pre-run dep.

**PUML cascade:** if P115 ran in fallback mode (no Java), P116 validator must skip `puml-render` gate checks OR accept fallback-SVG chronicles. This is handled by the same `skip_gates` mechanism. No separate action needed.

### P117 — Storage Adapter

**Status: DEGRADED-PATH.** VTP MCP is configured (`vtp_enrichment.triage_vtp_enrichment: true` in config.json) but live connectivity cannot be verified from this environment. Per DLB-11 Drift Risk #6 and R5: "Chronicle generation NEVER blocks on VTP availability. Local-first is always safe." Local fallback `.planning/chronicles/` is unconditionally available. P117 is GO as long as local filesystem is writable (confirmed: git working tree writable).

### P118 — Cockpit Integration

**Status: DEGRADED-PATH.** Inherits P117 PARTIAL (VTP optional). Cockpit v2.9 DEFERRED-2 (12th section) unresolved; P118 must work around or implement. No new external deps beyond P114-P117 substrate. Chronicle tools directory (`super-gsd/tools/chronicle/`) does not yet exist — expected; created progressively by P114-P117. No blocker.

### P119 — Milestone Chronicle + Roadmap Miner

**Status: DEGRADED-PATH.** Inherits all prior phases. Requires P116 benchmark fixtures for ≥95% held-out precision gate — P119 AUTHORS those fixtures and then runs the gate itself (circular self-test, same as v3.0 P109 Fixtures A/B/C/D pattern). No external pre-run dep. Optional v3.0 milestone retrospective is an operator decision at P119 entry; not a blocker.

## BLOCKED AT START

None. No phase has a hard-blocked dep with no fallback path. All blockers have either an explicit DLB-11 fallback or an expected-absent artifact (not created yet).

## DEGRADED AUTO-RUN PATH

Full 7-phase path is runnable with one operator action before P115.

- **Path:** P113 -> P114 -> P115* -> P116* -> P117* -> P118* -> P119*
- **`*` phases:** run in DEGRADED mode (PUML fallback; VTP optional)
- **Total ETA:** ~18-24h of executor wall-time across 7 phases
- **P113 + P114:** fully unattended, no prep
- **Stop point before P115:** operator must either (a) install Java + plantuml.jar, OR (b) add `skip_gates: ["puml-render"]` to P115 PLAN frontmatter
- **Command (P113-P114 clean segment):** `/sgsd-orchestrate auto`
- **Command (full degraded run after operator action):** `/sgsd-orchestrate auto`

If operator installs Java + plantuml.jar before P115 entry, all 7 phases run fully unattended with no degraded flags.

## PROBE LOG

| Time | Phase | Dep | Probe | Result |
|------|-------|-----|-------|--------|
| 2026-05-21T00:00Z | ALL | node | `node --version` | PASS — v22.22.3 |
| 2026-05-21T00:00Z | ALL | java | `java -version` | FAIL — command not found |
| 2026-05-21T00:00Z | ALL | codex | `command -v codex` | PASS — codex in PATH |
| 2026-05-21T00:00Z | ALL | codex-exec.sh | file presence | PASS — super-gsd/scripts/codex-exec.sh |
| 2026-05-21T00:00Z | ALL | codex-executor.sh | file presence | PASS — super-gsd/scripts/codex-executor.sh |
| 2026-05-21T00:00Z | ALL | codex-patch-executor.sh | file presence | PASS — super-gsd/scripts/codex-patch-executor.sh |
| 2026-05-21T00:00Z | P113-P116 | ajv | find node_modules/ajv/package.json | PASS — v8.18.0 in super-gsd/tools/plan-schema/node_modules/ |
| 2026-05-21T00:00Z | P113-P116 | ajv-errors | find node_modules/ajv-errors/package.json | PASS — v3.0.0 in super-gsd/tools/plan-schema/node_modules/ |
| 2026-05-21T00:00Z | P113 | plan-schema-v2.json | Read file + JSON parse check | PASS — valid JSON, draft-07 |
| 2026-05-21T00:00Z | P113 | plan-locked.schema.json | Read file + JSON parse check | PASS — valid JSON, in super-gsd/schemas/ |
| 2026-05-21T00:00Z | P113 | cmb.schema.json | Read file + JSON parse check | PASS — valid JSON, in super-gsd/schemas/ |
| 2026-05-21T00:00Z | P115 | plantuml.jar (path 1) | test -f C:\Users\user\plantuml.jar | FAIL — absent |
| 2026-05-21T00:00Z | P115 | plantuml.jar (path 2) | test -f C:\tools\plantuml.jar | FAIL — absent |
| 2026-05-21T00:00Z | P115 | plantuml.jar (path 3) | test -f C:\Program Files\PlantUML\plantuml.jar | FAIL — absent |
| 2026-05-21T00:00Z | P115 | plantuml.jar (path 4) | test -f C:\Program Files (x86)\PlantUML\plantuml.jar | FAIL — absent |
| 2026-05-21T00:00Z | P115 | plantuml.jar (path 5) | test -f %USERPROFILE%\plantuml.jar | FAIL — absent |
| 2026-05-21T00:00Z | P115 | plantuml.jar (path 6) | test -f C:\Users\user\Downloads\plantuml.jar | FAIL — absent |
| 2026-05-21T00:00Z | P115 | svg-fallback-generator.cjs | file presence | ABSENT — expected; P115 ships it |
| 2026-05-21T00:00Z | P116 | benchmark fixtures good-*.json | file presence | ABSENT — expected; P116 ships them |
| 2026-05-21T00:00Z | P116 | benchmark fixtures bad-*.json | file presence | ABSENT — expected; P116 ships them |
| 2026-05-21T00:00Z | P117 | VTP MCP connectivity | config.json vtp_enrichment block | DEGRADED — configured but connectivity not live-provable; local fallback unconditionally safe per DLB-11 |
| 2026-05-21T00:00Z | P113 | chronicle tools dir | file presence | ABSENT — expected; P114 creates it |
| 2026-05-21T00:00Z | ALL | git working tree | git status --short | PASS — no merge conflicts; modified files are metrics/planning logs only; v3.1 has 2 clean commits |
| 2026-05-21T00:00Z | ALL | P116 held-out precision | future-binding SAC | FUTURE-BINDING — P119 authors held-out fixtures; not now-blocking |

## Notes for the human

- P113 and P114 are fully GO. You can run `/sgsd-orchestrate auto` immediately and these will complete unattended.
- Before P115 first executor dispatch, choose one of:
  - **Option A (preferred):** Install Java + plantuml.jar: `winget install Microsoft.OpenJDK.21` then place `plantuml.jar` at `C:\Users\user\plantuml.jar`. The orchestrator will detect Java at P115 phase-readiness re-probe and remove the DEGRADED flag.
  - **Option B (fast):** Add `skip_gates: ["puml-render"]` + `skip_reason: "java+plantuml.jar absent; svg-fallback-generator.cjs ships this phase"` to the P115 PLAN frontmatter before first executor dispatch. PUML `.puml` source files are still authored and committed; only the pre-render is skipped.
- VTP storage is optional. Local fallback `.planning/chronicles/` is always safe. No action needed.
- Never paste API key values — use `secure_env_collect` for secrets.
- After installing Java+plantuml.jar, reply `continue` — the orchestrator re-probes at P115 phase-readiness and resumes with full PUML rendering.

## sgsd-curate suggestion

New dependency pattern discovered — not previously in .planning/memory/:

> **Pattern: Java runtime as optional milestone dep with explicit DLB fallback**
> The Java+plantuml.jar combo is an operator-installed binary dep (not npm, not bundled) that surfaces as DEGRADED-PATH rather than BLOCKED because the design decision (DLB-11 R1) includes a named fallback mode (`skip_gates: ["puml-render"]`). Future milestones with similar "operator-owned binary with explicit skip_gates fallback" patterns should be classified DEGRADED-PATH (not BLOCKED) in readiness audits. Probe command: `java -version 2>&1 && java -jar plantuml.jar -version 2>&1`.

Suggest curating as: `sgsd-curate --type pattern --slug java-plantuml-degraded-path-probe --summary "Java+plantuml.jar is DEGRADED-PATH not BLOCKED if DLB skip_gates fallback exists"`
