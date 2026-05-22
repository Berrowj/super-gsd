---
phase: 126
phase_name: Cockpit Answer-First Surface
milestone: v3.2
ws: B
created: 2026-05-22
status: queued-planning
implementation_status: not-started
source: DLB-12.5 — Operator Comprehension System; WS-B phase 3
predecessor: v3.2 P125 PASS (north-star.cjs + alert-grammar.cjs shipped, 6/6 self-test)
implements: 124-COCKPIT-DESIGN-SPEC.md D4 (answer-first surface layout)
---

# Phase 126 — Cockpit Answer-First Surface

> Evolves `cockpit-sidecar.cjs` from a flat 14-line dump into a glanceable answer-first cockpit: a North-Star banner, one recommended action, exactly one preattentive alert, and a demoted supporting block. Wires in the P125 modules.

## Goal

After P126, `cockpit-sidecar.cjs --text` renders the D4 answer-first block — North Star first, one DO-NEXT action, one alert (`+N more`), supporting detail demoted. A `--brief` mode prints only the top three lines. A `--html` snapshot renders the same content against the P120 shared design system. The existing `--json` keys stay byte-stable; `north_star` + `alerts` are added as additive keys.

## Binding invariants (from DLB-12 + 124-COCKPIT-DESIGN-SPEC.md D4/D6)

1. **Lock-13 untouched.** Changes are confined to `super-gsd/tools/cockpit-sidecar/`. Zero touches to `cockpit-state/*`, `tests/cockpit-acceptance/*`, `tests/cockpit-regression/*`.
2. **`--json` existing keys frozen.** Every key the current `--json` output emits keeps its name, position and meaning. `north_star` and `alerts` are added as NEW top-level keys — additive, backward-compatible. No existing consumer breaks.
3. **Answer-first (R01).** `renderText()` leads with the North Star; supporting state is demoted, never deleted (R07).
4. **One recommended action (R04).** Exactly one DO-NEXT line.
5. **Preattentive single-focus + colour sparingly (C1/C2).** Exactly one alert is shown; `+N more` counts the rest. In `--text`, only the North-Star line and the alert line carry ANSI colour; everything else is monochrome. Colour must degrade gracefully when stdout is not a TTY (no raw escape codes in piped output).
6. **Projection, not opinion (invariant 5).** Every rendered value is a deterministic function of ledger state via the P125 modules. No new judgement layer.
7. **Deterministic + offline.** No new dependency, no network, no CDN. The `--html` snapshot inlines the shared stylesheet (offline-survivable, DLB-11 carry-forward).

## What ships

### `cockpit-sidecar.cjs` (modify)
- `require('./north-star.cjs')` + `require('./alert-grammar.cjs')`; compute `north_star` and `alerts` from the existing assembled signal/output object.
- Add `north_star` + `alerts` to the `--json` output object (additive).
- Replace `renderText()` with the D4 answer-first block:
  ```
  ┌─ NORTH STAR ──────────────────────┐
  │ {north_star.message}              │
  ├────────────────────────────────────┤
  │ ▸ DO NEXT: {recommended action}    │
  │ ⚠ {top alert}            (+N more) │   (omit the ⚠ line when no alert)
  ├────────────────────────────────────┤
  │ {milestone}/{phase} · {progress}   │
  │ gate {x} · fog {tier} · {N} disp.  │
  │ latest chronicle: {path}           │
  └────────────────────────────────────┘
  ```
- Add `--brief`: prints only the North-Star line, the DO-NEXT line, and the alert line (≤ 4 lines).
- Add `--html`: writes/echoes a self-contained HTML snapshot that inlines `super-gsd/tools/shared/sgsd-design-system.css` and renders the same answer-first content with the shared design system's `[role="operator-decision"]` / `.callout` / `details` classes.
- The DO-NEXT action is a render-layer deterministic map from `north_star.code`: `BLOCKED`→"resolve the binding gate before close"; `CHRONICLE_FAILED`→"fix the chronicle citation, re-validate"; `NEEDS_OPERATOR`→"operator decision required — see blockers"; `HEAVY_PHASE`→"read the must-read chronicle sections"; `ON_TRACK`→"continue — advance to the next phase".

### `run-self-test.cjs` (extend — pure append)
Append SAC-P126-01..NN: North Star appears first in `--text`; exactly one alert line (+N more) when multiple fire; `--brief` ≤ 4 lines; `--json` retains all prior keys AND adds `north_star`+`alerts`; `--html` output contains the shared-design-system marker and no external URL; non-TTY output carries no raw ANSI escape codes.

## Semantic acceptance criteria (target — 126-01 PLAN declares verbatim)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P126-01
    input: "cockpit-sidecar --text on a fixture with binding_gate RED"
    expected_outcome: "the first non-border line of output is the North Star and reads BLOCKED"
  - id: SAC-P126-02
    input: "cockpit-sidecar --text on a fixture where 3 alerts fire"
    expected_outcome: "exactly one alert line is rendered, annotated (+2 more)"
  - id: SAC-P126-03
    input: "cockpit-sidecar --brief on any fixture"
    expected_outcome: "output is at most 4 lines — North Star, DO NEXT, one alert"
  - id: SAC-P126-04
    input: "cockpit-sidecar --json on a fixture"
    expected_outcome: "every pre-P126 key is still present and unchanged; north_star and alerts keys are added"
  - id: SAC-P126-05
    input: "cockpit-sidecar --html on a fixture"
    expected_outcome: "self-contained HTML containing the shared-design-system marker, zero external http(s) URLs"
  - id: SAC-P126-06
    input: "cockpit-sidecar --text piped (stdout not a TTY)"
    expected_outcome: "output contains no raw ANSI escape sequences"
  - id: SAC-P126-07
    input: "full cockpit-sidecar self-test"
    expected_outcome: "SAC-P125-01..06 still pass + SAC-P126 additions — zero regression"
```

## Out of scope

- Cross-surface conformance test + `conformance-check.cjs` cockpit wiring — P127.
- Changing `north-star.cjs` / `alert-grammar.cjs` logic (D2/D3 frozen by P125) or `fog-score.cjs`.
- Renaming or removing any existing `--json` key.

## Cross-references

- `124-COCKPIT-DESIGN-SPEC.md` — D4 layout, D6 invariant compliance
- `super-gsd/tools/cockpit-sidecar/{north-star,alert-grammar}.cjs` — P125 modules wired here
- `super-gsd/tools/shared/sgsd-design-system.css` — the P120 stylesheet the `--html` snapshot inlines
- `.planning/decisions/DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md` — design lock
