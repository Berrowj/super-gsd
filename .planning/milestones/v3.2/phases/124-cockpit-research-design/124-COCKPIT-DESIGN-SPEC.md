---
phase: 124
artifact: COCKPIT-DESIGN-SPEC
milestone: v3.2
ws: B
created: 2026-05-22
status: LOCKED
implements_against: 124-RESEARCH.md
governs: P125 (alert grammar + North-Star ranking), P126 (answer-first surface), P127 (cross-surface conformance)
---

# Phase 124 — Cockpit Design Spec (LOCKED)

> The locked spec WS-B implements. Every choice cites a 124-RESEARCH.md row or is flagged `[un-grounded]`.

## D1 — Form factor: terminal-primary, HTML-snapshot-secondary

The live cockpit surface is a **compact answer-first terminal render** (`cockpit-sidecar.cjs --text`). It is what the operator watches in a Windows Terminal pane during a run. An optional **`--html` snapshot** consumes the P120 shared design system (`sgsd-design-system.css`) for archival and sharing. The `--json` output is unchanged — machine consumers keep a byte-stable contract.

- Grounded: terminal-primary — the operator already runs the cockpit live in a terminal pane (124-RESEARCH §5; Mission Control setup).
- Grounded: the `--html` snapshot is where invariant 1 (one shared design system) is literally satisfied — it `<link>`s / inlines `sgsd-design-system.css`.
- The terminal render cannot use CSS; it honours the *principles* of the 12 rules via layout + sparing ANSI colour.

## D2 — North-Star ranking (P125 implements)

The cockpit computes **exactly one North Star** — the single most important thing right now — via a deterministic priority cascade. First match wins (Made to Stick `::0018` "you can't have five North Stars"; `::0021` forced prioritization):

| Rank | Condition | North Star |
|---:|---|---|
| 1 | `binding_gate_status == RED` | `BLOCKED — phase close gated: {reason}` |
| 2 | latest validator verdict ∈ {UNGROUNDED, BROKEN_CITATION, CONTAMINATED} | `CHRONICLE FAILED — {verdict}` |
| 3 | a hard blocker / `requires_operator_review` is open | `NEEDS OPERATOR — {what}` |
| 4 | `fog_score.tier == high` | `HEAVY PHASE — read {must_read_sections}` |
| 5 | otherwise | `ON TRACK — {milestone}/{phase}, {progress}` |

Deterministic, no agent judgement. The North Star is the one element allowed to be loud (124-RESEARCH §5).

## D3 — Alert grammar (P125 implements)

Every alert is `{signal, threshold, duration, channel}` (Designing ML Systems `ch08::0025`). The cockpit **ranks then gates**: it evaluates all candidate alerts, then surfaces **exactly one** — the top-ranked — and shows the rest only as a count (`+N more`). This is the alert-fatigue countermeasure (`ch08::0022`).

Seed alert table (P125 finalizes thresholds):

| Signal | Threshold | Duration | Channel |
|---|---|---|---|
| `binding_gate_status` | `== RED` | instant | terminal banner + push |
| `fog_score.score` | `> 70` | sustained ≥ 1 phase | terminal banner |
| `validator verdict` | not GROUNDED | instant | terminal banner + push |
| `dispatch_count` | `> 12` in phase | instant | terminal line |
| stale `warnings[]` | any non-benign | instant | terminal line |

Benign warnings (e.g. `executor_log_unavailable`) never raise an alert — they are filtered before ranking.

## D4 — Answer-first surface layout (P126 implements)

`renderText()` is replaced. The flat 14-line dump becomes a ranked, answer-first block:

```
┌─ NORTH STAR ──────────────────────────────┐   ← the one loud line (colour)
│ {D2 North Star}                            │
├────────────────────────────────────────────┤
│ ▸ DO NEXT: {one recommended action}        │   ← R04 — exactly one action
│ ⚠ {one alert}                  (+N more)   │   ← D3 — exactly one alert (colour)
├────────────────────────────────────────────┤
│ {milestone}/{phase} · {progress}           │   ← supporting, demoted, monochrome
│ gate {GREEN} · fog {tier} · {N} dispatches │
│ latest chronicle: {path}                   │
└────────────────────────────────────────────┘
```

Rules honoured: R01 lead with the decision (North Star first); R04 one recommended action; C1 preattentive single-focus (only the North Star + alert carry colour); C2 colour sparingly (Storytelling with Data `::0109`); C4 the cockpit does the active looking — it ranks, the operator does not scan (Back of the Napkin `::0030`); R11 no un-glossed jargon in any operator-facing line. The supporting block is demoted, never deleted (R07).

`--brief` prints only the North Star + the one action + the one alert (≤ 4 lines) — Simply Said `::0002` "fewer than 10 words".

## D5 — Cross-surface conformance (P127 implements)

The `--html` snapshot must pass `conformance-check.cjs --surface cockpit` (P120 checker, cockpit group C1-C5). P127 adds a cross-surface self-test asserting **both** the chronicle renderer and the cockpit snapshot satisfy the shared rules — the divergence drift-risk (DLB-12 risk 1) becomes machine-checked.

## D6 — Invariant compliance

- Invariant 3 (Lock-13): all changes are inside `super-gsd/tools/cockpit-sidecar/`. Zero touches to `cockpit-state/*`, `tests/cockpit-acceptance/*`, `tests/cockpit-regression/*`. Confirmed: the current sidecar `require`s only `./fog-score.cjs`.
- Invariant 5 (projection, not opinion): the cockpit reads live ledger state read-only; the North Star + alerts are deterministic functions of that state, never an agent opinion.
- The `--json` contract is frozen — only the human render + a new ranking/alert layer are added.

## File preview (P125-P127 — not binding, planner refines)

| Phase | Files |
|---|---|
| P125 | `cockpit-sidecar/north-star.cjs` (new), `cockpit-sidecar/alert-grammar.cjs` (new), self-test |
| P126 | `cockpit-sidecar.cjs` (evolve `renderText`, add `--brief`), `--html` renderer |
| P127 | cross-surface self-test, `conformance-check.cjs` cockpit wiring |
