---
phase: 134
phase_name: Cockpit Conformance Promotion (R13-R18 binding + cockpit-html + monitor surfaces)
milestone: v3.3
ws: core
status: PASS
verdict: PASS
completed_at: 2026-05-24
sacs_total: 4
sacs_passed: 4
sacs_deferred: 0
files_created: 0
files_modified: 3
deviations: 1
deviation_class: ORCHESTRATOR-AUTHORED-TESTS
plan_id: P134-01-conformance-promotion
self_test_command: node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
self_test_result: pass
self_test_count: 57/57
---

# Phase 134 — Cockpit Conformance Promotion — VERIFICATION

## Summary

P134 promotes the v3.3 band-grammar from advisory to binding by adding rules R13-R18 to
`super-gsd/tools/shared/design-rules.json`, wiring matching checker functions in
`super-gsd/tools/shared/conformance-check.cjs`, registering two new surfaces (`cockpit-html`,
`monitor`), and locking the new contract behind 4 SAC tests.

## SAC results

| SAC | Outcome | Result |
|---|---|---|
| SAC-P134-01 | design-rules.json contains R13..R18 | PASS |
| SAC-P134-02 | conformance-check.cjs declares `function checkR13`..`function checkR18` | PASS |
| SAC-P134-03 | Synthetic cockpit-html fixture (5 stages + 3 bands + northstar) passes `checkConformance(html,'cockpit-html')` with binding_fail===0 | PASS |
| SAC-P134-04 | sgsd-codex-monitor.ps1 text passes through `checkConformance(text,'monitor')` returning `{summary:{binding_fail:number}}` without throwing | PASS |

Full suite: **57/57 PASS** (53 pre-P134 + 4 new). Exit 0.

## Files

- `super-gsd/tools/shared/design-rules.json` — R13-R18 appended (commit 1b2c974, T1)
- `super-gsd/tools/shared/conformance-check.cjs` — checkR13..checkR18 + R16 fail-safe + cockpit-html/monitor surfaces (commit 25c2e5d, T2)
- `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` — SAC-P134-01..04 appended + `designRules` require (T3, this commit)

## Invariant compliance

- **Lock-13 untouched** — changes confined to `super-gsd/tools/shared/` + `super-gsd/tools/cockpit-sidecar/run-self-test.cjs`. Zero touches to `cockpit-state/*`, `tests/cockpit-acceptance/*`, `tests/cockpit-regression/*`.
- **--json contract preserved** — no snapshot shape changes.
- **No regression** — all 53 pre-P134 SACs remain green.

## Deviations

**ORCHESTRATOR-AUTHORED-TESTS-1** — T3 was dispatched twice via Codex; first run via `codex-executor.sh`
emitted an empty `FILES_CHANGED` (CreateProcessAsUserW block on Windows) and the patch-mode
re-dispatch via `codex-patch-executor.sh` returned an empty PATCH block citing a `review` skill
conflict (Codex picked up read-only review framing and refused to author code). Orchestrator
authored the 4 SAC tests directly, consistent with the prior orchestrator-authored fixes
(SAC-P128-01, SAC-P129-05, SAC-P126-01 layout filter, SAC-P132-05 SIGTERM relax, R16 fail-safe).
SAC-P134-03 fixture is synthetic rather than `renderHtml(fixture)` because `renderHtml()` emits
data injected at runtime via SSE/client.js, not at static render time — `renderShell()` carries
the band placeholders and `client.js` injects stage cells. A synthetic HTML fixture matching
the rule contract proves the surface wiring without coupling the gate test to client.js
rendering, which is its own gate (SAC-P132-*).

## Commit chain

- 1b2c974 — T1: design-rules.json R13-R18
- 25c2e5d — T2: conformance-check.cjs check functions + surfaces
- (this commit) — T3+T4: SAC tests + phase close

## Next phase

P135 (visual polish) closed PASS-WITH-DEFERRED 2026-05-24; v3.3 milestone advances to close.
v3.4 INTENT.md is authored (commit 6fea42f) and ready for P136 scaffold.
