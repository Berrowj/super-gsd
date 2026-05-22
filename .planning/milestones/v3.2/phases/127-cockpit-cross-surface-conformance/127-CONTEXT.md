---
phase: 127
phase_name: Cockpit Integration + Cross-Surface Conformance
milestone: v3.2
ws: B
created: 2026-05-22
status: queued-planning
implementation_status: not-started
source: DLB-12.5 — Operator Comprehension System; WS-B phase 4 (final WS-B + final v3.2 phase)
predecessor: v3.2 P126 PASS (answer-first cockpit surface, 13/13 self-test)
implements: 124-COCKPIT-DESIGN-SPEC.md D5 (cross-surface conformance)
---

# Phase 127 — Cockpit Integration + Cross-Surface Conformance

> Final WS-B / final v3.2 phase. Makes the divergence drift-risk (DLB-12 risk 1) machine-checked: the cockpit `--html` snapshot is gated by the P120 conformance checker, and a cross-surface self-test asserts BOTH the chronicle and the cockpit obey the shared 12 rules.

## Goal

After P127, the cockpit `--html` snapshot passes `conformance-check.cjs --surface cockpit` with zero binding failures, and the cockpit self-test includes a cross-surface assertion proving the chronicle gold-reference and the cockpit snapshot both satisfy their shared binding rules. v3.2 WS-B is then complete.

## Why a fix is needed first

A probe of the current cockpit `--html` against `checkConformance(html, 'cockpit')` returns `binding_fail: 1` — **R04 fails**: the renderer's DO-NEXT action element is not marked, so `recommendedActionCount` finds 0 recommended actions. P127 must fix `renderHtml` so the DO-NEXT element carries `class="recommended-action"`, then wire the gate.

## Binding invariants (from DLB-12 + 124-COCKPIT-DESIGN-SPEC.md D5/D6)

1. **Lock-13 untouched.** Changes confined to `super-gsd/tools/cockpit-sidecar/`. Zero touches to `cockpit-state/*`, `tests/cockpit-acceptance/*`, `tests/cockpit-regression/*`.
2. **Conformance is the gate, not a new opinion.** `conformance-check.cjs` (P120) is consumed as-is; P127 does not re-implement or modify the checker or `design-rules.json`.
3. **No regression.** SAC-P125-01..06 + SAC-P126-01..07 stay green; P127 appends only.
4. **`renderHtml` change is minimal.** The only behaviour change is marking the DO-NEXT element so R04 detects it — no layout redesign.
5. **`--json`/`--text`/`--brief` unchanged.** P127 touches only `renderHtml` + the self-test.

## What ships

### `cockpit-sidecar.cjs` (modify — `renderHtml` only)
Mark the DO-NEXT action element in the `renderHtml` output with `class="recommended-action"` (the class `conformance-check.cjs` R04 recognises). No other render change.

### `run-self-test.cjs` (modify — pure append)
Append SAC-P127-01..NN:
- The cockpit `--html` snapshot passes `checkConformance(html,'cockpit')` with `summary.binding_fail === 0`.
- Cross-surface: the chronicle gold-reference (`super-gsd/tools/chronicle/templates/chronicle-gold-reference.html`) passes `checkConformance(html,'chronicle')` with `binding_fail === 0`, AND the cockpit snapshot passes `'cockpit'` — both surfaces conformant in one assertion.
- Zero-regression keystone: full suite green.

## Semantic acceptance criteria (target — 127-01 PLAN declares verbatim)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P127-01
    input: "cockpit-sidecar --html output passed to checkConformance(html,'cockpit')"
    expected_outcome: "summary.binding_fail === 0 — every binding cockpit rule passes, R04 included"
  - id: SAC-P127-02
    input: "the DO-NEXT element of the cockpit --html"
    expected_outcome: "it carries class=recommended-action and conformance R04 reports exactly one recommended action"
  - id: SAC-P127-03
    input: "chronicle gold-reference HTML passed to checkConformance(html,'chronicle')"
    expected_outcome: "summary.binding_fail === 0 — the chronicle surface is conformant"
  - id: SAC-P127-04
    input: "cross-surface check — both chronicle and cockpit HTML"
    expected_outcome: "both surfaces return binding_fail === 0 in a single assertion (DLB-12 risk-1 drift is machine-checked)"
  - id: SAC-P127-05
    input: "full cockpit self-test"
    expected_outcome: "SAC-P125-01..06 + SAC-P126-01..07 + SAC-P127 additions all pass — zero regression"
```

## Out of scope

- Modifying `conformance-check.cjs` or `design-rules.json` (P120 artifacts, consumed as-is).
- Any change to `north-star.cjs` / `alert-grammar.cjs` / `fog-score.cjs`.
- `renderText` / `renderBrief` / `--json` behaviour.
- Promoting the cockpit conformance check to a runtime hard-gate inside `cockpit-sidecar.cjs` itself — the gate lives in the self-test.

## Cross-references

- `124-COCKPIT-DESIGN-SPEC.md` — D5 cross-surface conformance
- `super-gsd/tools/shared/conformance-check.cjs` — the P120 checker (`checkConformance(html, surface)`)
- `super-gsd/tools/chronicle/templates/chronicle-gold-reference.html` — the chronicle surface in the cross-surface test
- `.planning/decisions/DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md` — design lock; risk 1 (visual-system divergence)
