---
schema: plan-schema-v2
status: PLAN-LOCKED
plan_id: P127-01-cockpit-cross-surface-conformance
phase_id: 127-cockpit-cross-surface-conformance
phase_number: 127
milestone: v3.2
workstream: WS-B
title: Cockpit Integration + Cross-Surface Conformance
created_by: SGSD Orchestrator (Codex planning dispatch blocked by Windows read failure CreateProcessAsUserW 216; plan is a mechanical translation of LOCKED 124-COCKPIT-DESIGN-SPEC.md D5 + 127-CONTEXT.md — no design judgement; all code authored by the Codex executor)
created_at: 2026-05-22
locked: true
---

# P127-01 Cockpit Integration + Cross-Surface Conformance PLAN

## Scope

Make DLB-12 drift-risk 1 (chronicle/cockpit visual divergence) machine-checked. Fix `renderHtml` so the cockpit `--html` snapshot passes the P120 conformance checker R04, then wire `checkConformance` over both surfaces in the cockpit self-test. Final WS-B / final v3.2 phase.

## Authoritative Inputs

- `.planning/milestones/v3.2/phases/127-cockpit-cross-surface-conformance/127-CONTEXT.md`
- `.planning/milestones/v3.2/phases/124-cockpit-research-design/124-COCKPIT-DESIGN-SPEC.md` (D5)
- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` (`renderHtml`, line ~340)
- `super-gsd/tools/cockpit-sidecar/run-self-test.cjs`
- `super-gsd/tools/shared/conformance-check.cjs` (`checkConformance(html, surface)` — consumed as-is)
- `super-gsd/tools/chronicle/templates/chronicle-gold-reference.html` (the chronicle surface)

## Binding Invariants

- Lock-13 untouched: changes confined to `super-gsd/tools/cockpit-sidecar/`.
- `conformance-check.cjs` + `design-rules.json` consumed as-is — not modified.
- No regression: SAC-P125-01..06 + SAC-P126-01..07 stay green; P127 appends only.
- `renderHtml` change is minimal — mark the DO-NEXT element so R04 detects it; no layout redesign.
- `renderText` / `renderBrief` / `--json` behaviour unchanged.

## File Operations

| Operation | Path | Purpose |
| --- | --- | --- |
| MODIFY | `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` | In `renderHtml`, change the DO-NEXT `<p>` class from `do-next` to `do-next recommended-action` so `conformance-check.cjs` R04 detects exactly one recommended action. |
| MODIFY | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` | PURE APPEND of SAC-P127-01..05; SAC-P125 + SAC-P126 entries untouched. |

## Tasks

### P127-T1: renderHtml conformance fix

- In `renderHtml`, the DO-NEXT line currently emits `<p class="do-next">▸ DO NEXT: ...`. Change the class to `class="do-next recommended-action"`. Nothing else in `renderHtml` changes.

Acceptance: `checkConformance(renderHtml(out), 'cockpit')` reports R04 PASS and `summary.binding_fail === 0`. Covered by SAC-P127-01, SAC-P127-02.

### P127-T2: cross-surface conformance self-test

- PURE APPEND SAC-P127-01..05 to the `tests` array in `run-self-test.cjs` (before the closing `];`). Do not modify the SAC-P125/SAC-P126 entries.
- Assertions exercise `checkConformance` (required from `../shared/conformance-check.cjs`) against `sidecar.renderHtml(out)` for the cockpit surface and the chronicle gold-reference file for the chronicle surface.

Acceptance: `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` exits 0 with SAC-P125-01..06 + SAC-P126-01..07 + SAC-P127-01..05 all PASS.

## Semantic Acceptance Criteria

| ID | Input | Expected outcome | Verification Command |
| --- | --- | --- | --- |
| SAC-P127-01 | `renderHtml(out)` passed to `checkConformance(html,'cockpit')` | `summary.binding_fail === 0` — every binding cockpit rule passes | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P127-01` |
| SAC-P127-02 | the cockpit `--html` R04 result | R04 status is PASS — exactly one recommended action detected | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P127-02` |
| SAC-P127-03 | chronicle gold-reference HTML passed to `checkConformance(html,'chronicle')` | `summary.binding_fail === 0` — the chronicle surface is conformant | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P127-03` |
| SAC-P127-04 | cross-surface — both chronicle and cockpit HTML | both surfaces return `binding_fail === 0` in one assertion | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P127-04` |
| SAC-P127-05 | full cockpit self-test | SAC-P125-01..06 + SAC-P126-01..07 + SAC-P127 additions all pass — zero regression | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` |

## Phase Verification

```
node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
```

Expected: exit 0; 18/18 SACs PASS (SAC-P125-01..06 + SAC-P126-01..07 + SAC-P127-01..05); only the 2 declared files changed.

## Out Of Scope

- Modifying `conformance-check.cjs` or `design-rules.json`.
- Any change to `north-star.cjs` / `alert-grammar.cjs` / `fog-score.cjs` / `renderText` / `renderBrief` / `--json`.
- Anything outside `super-gsd/tools/cockpit-sidecar/`.
