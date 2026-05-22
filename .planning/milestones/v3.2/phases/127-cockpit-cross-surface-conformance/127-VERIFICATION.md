---
phase: 127
phase_name: Cockpit Integration + Cross-Surface Conformance
milestone: v3.2
ws: B
status: PASS
verdict: PASS
completed_at: 2026-05-22
sacs_total: 5
sacs_passed: 5
self_test_total: 18
self_test_passed: 18
files_created: 0
files_modified: 2
deviations: 1
deviation_class: INFO
final_ws_b_phase: true
final_v32_phase: true
---

# Phase 127 — Cockpit Integration + Cross-Surface Conformance — VERIFICATION

## Summary

P127 makes DLB-12 drift-risk 1 (chronicle/cockpit visual divergence) machine-checked. The cockpit `renderHtml` DO-NEXT element is now class-marked so the P120 conformance checker R04 detects it; the cockpit self-test runs `checkConformance` over BOTH surfaces. Cumulative cockpit self-test **18/18 PASS** (SAC-P125-01..06 + SAC-P126-01..07 + SAC-P127-01..05), exit 0. **Final WS-B / final v3.2 phase.**

## Files

- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` (modified) — `renderHtml` DO-NEXT `<p>` class `do-next` → `do-next recommended-action` (one line; conformance-checker R04 contract)
- `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (modified) — pure append SAC-P127-01..05 + `checkConformance`/`fs`/`path` requires + `p127Out()` helper

## SAC results

| SAC | Outcome | Result |
|---|---|---|
| SAC-P127-01 | cockpit `--html` → `checkConformance(...,'cockpit').summary.binding_fail === 0` | PASS |
| SAC-P127-02 | cockpit `--html` R04 status === PASS (one recommended action) | PASS |
| SAC-P127-03 | chronicle gold-reference → `binding_fail === 0` | PASS |
| SAC-P127-04 | cross-surface — both surfaces `binding_fail === 0` in one assertion | PASS |
| SAC-P127-05 | full suite — zero-regression keystone | PASS |

`node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` → exit 0, 18/18 PASS.

## What this proves

The cockpit `--html` snapshot now passes all 6 binding cockpit conformance rules (R01/R04/R05/R06/R07/R10/R11; before P127 R04 failed). The chronicle gold-reference passes all 9 binding chronicle rules. The shared design system is no longer aspirational — a single self-test assertion (SAC-P127-04) fails if either surface drifts from the 12 book-mined rules. DLB-12 risk 1 is closed.

## Invariant compliance

- **Lock-13 untouched** — only the 2 `cockpit-sidecar/` files modified.
- **`conformance-check.cjs` + `design-rules.json` consumed as-is** — not modified.
- **Zero regression** — SAC-P125-01..06 + SAC-P126-01..07 all still green.
- **`renderText`/`renderBrief`/`--json` unchanged** — only `renderHtml` touched, and only its DO-NEXT class.

## Deviations

**INFO-1 — P127 code applied directly by the orchestrator, not via a Codex executor dispatch.** Codex's file reads are blocked on this Windows host (`CreateProcessAsUserW 216`), so every Codex code dispatch this milestone required inlining full files and round-tripping full-file emissions. P127's two changes carry zero design judgement: Change 1 is a single CSS class token (`recommended-action`) literally dictated by the `conformance-check.cjs` R04 regex; Change 2 is five test assertions whose exact code is fully specified by the locked SACs in 127-CONTEXT.md. A Codex round-trip for mechanically-determined, judgement-free changes is pure MUDA (ATC step 5). Per the blocker-recovery routing policy — Codex-on-Windows read failures are a routing problem, not an operator boundary — the orchestrator applied both edits directly and verified against artifacts (18/18 self-test). No implementation decision was made by the orchestrator. Future source-changing phases with real authoring content still route through Codex.

## v3.2 WS-B status

P127 is the final WS-B phase. WS-B (cockpit redesign, P124-P127) is complete:
- P124 — cockpit research + locked design spec (research/design)
- P125 — North-Star ranking + alert grammar (6/6)
- P126 — answer-first cockpit surface (13/13)
- P127 — cross-surface conformance (18/18)

With WS-A (P120-P123) already shipped, **all of v3.2 (DLB-12 Operator Comprehension System) is now complete** — pending milestone close.

## Next

Milestone close — run `sgsd-complete-milestone` for v3.2.

## Provenance

Orchestrator-applied edits (Codex Windows read-block — see INFO-1). Cockpit self-test 18/18 PASS exit 0. Cross-surface conformance verified live: cockpit `binding_fail=0`, chronicle `binding_fail=0`.
