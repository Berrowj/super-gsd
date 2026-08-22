---
milestone: v3.9-substrate-hygiene
generated_at: 2026-08-22T15:42:08Z
generated_by: orchestrator-local-probe
status: GO
phases_probed: ["166"]
---

# v3.9 milestone readiness — GO

Probed locally (deterministic, no Codex dispatch): P166 is Node-only. Its plan
states every verification command is Node-only and none invokes claude, so the
external dependency surface is the Node runtime, the vendored Ajv, the eleven
files T1 touches, and the frozen P154 evidence.

## Phase 166 — substrate-call-filters: GO

| Dependency | Probe | Result |
|---|---|---|
| Node runtime | `node -v` | v22.23.1 |
| Ajv (v2 schema compile) | `require('ajv')` | 8.18.0 |
| 10 existing T1 files | file existence | all present |
| v2 schema + policy suite | must be absent pre-T1 | both absent, as planned |
| P154 frozen evidence | file existence | present, 40456 B |

## Pre-T1 regression baseline — 9/9 green

Captured immediately before the first executor dispatch so any later red is
attributable to T1 rather than pre-existing drift.

```
assert-mcp-arg-contract --case emitted-args                  exit 0
assert-mcp-arg-contract --case real-evidence                 exit 0
assert-real-triage-runtime staged-vtp-null-reflection-fallback exit 0
assert-real-triage-runtime vtp-fallback-contained-degradation   exit 0
assert-real-triage-runtime staged-vtp-oversized-response        exit 0
vtp-bridge/classify.cjs --self-test                          exit 0
vtp-context-composer.cjs --self-test                         exit 0
vtp-enrichment-gate.cjs --self-test                          exit 0
kb-triage-shadow/assert-shadow.cjs                           exit 0
```

## No BLOCKED / WILL-BLOCK rows

No service, container, VPN, credential, or network dependency exists in this
phase. There is no degraded path to record because there is nothing external
to degrade.
