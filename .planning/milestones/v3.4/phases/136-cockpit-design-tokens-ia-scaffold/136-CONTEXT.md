---
phase: 136
phase_name: Cockpit Design Tokens + IA Scaffold (Light Editorial Palette + IBM Plex + renderShell Refactor)
milestone: v3.4
ws: core
status: PENDING
created_at: 2026-05-24
predecessor: v3.3/P135 (closed PASS-WITH-DEFERRED — design pack at .planning/milestones/v3.4/design-pack/)
successor: v3.4/P137 (snapshot data contract + Cockpit Source Registry + liveness heartbeat)
---

# Phase 136 — Cockpit Design Tokens + IA Scaffold — CONTEXT

## Goal

Land the v3.4 light command-room visual foundation and re-skeleton `renderShell()` to emit the
new IA scaffold (chrome → command strip → ScanBar → sec-nav → main sections → bottom drawer).
P136 is structural plumbing only: tokens + shell DOM + type loading. No live data wiring.
P137 brings the data contract; P138 wires the sticky behavior + SSE keep-alive.

This is implementation Priority 1 + 2 from `HANDOFF-PROMPT.md` (commit 6fea42f).

## Authoritative inputs

- **`.planning/milestones/v3.4/INTENT.md`** — 10 binding invariants (palette / type / 5-sec
  test / progressive disclosure / orthogonal connectors / memory typing / alarms / domain
  language / stage-keyed gates / **liveness contract**).
- **`.planning/milestones/v3.4/design-pack/Cockpit.html`** (1791 lines) — canonical working
  prototype. Every visual treatment + token value matches here.
- **`.planning/milestones/v3.4/design-pack/DESIGN-THESIS.md`** — design rationale + 8-section
  success checklist + token table.
- **`.planning/milestones/v3.4/design-pack/HANDOFF-PROMPT.md`** — 9 non-negotiables + IA
  table + implementation priority order. P136 = Priority 1 + 2.
- **`super-gsd/tools/cockpit-sidecar/render-html.cjs`** — current renderShell + renderHtml
  (extracted in v3.3/P132). The shell skeleton is what gets refactored.
- **`super-gsd/tools/shared/sgsd-design-system.css`** — current dark-mode design tokens.
  Tokens get replaced; rule file stays (rules-as-data is invariant).

## Binding invariants from v3.4 INTENT (apply to every P136 task)

1. **Light command-room palette only.** `--page #F6F7F4`, `--surface #FFFFFF`, `--ink #151A1E`,
   `--line #D6DBD2`. Semantic colour only — no purple/blue gradients, no glassmorphism, no
   decorative gradients. State colors: `--live #006D77`, `--done #2F7D5C`, `--attn #B7791F`,
   `--severe #B42318`, `--crit #B42318`, `--indigo #515E9C`.
2. **Typography stack:** IBM Plex Sans (body), IBM Plex Mono (data/numbers — tabular
   numerals), Big Shoulders Display 900 (section headers + mission phase ID). NO Inter,
   Roboto, or system-ui as primary type.
3. **Lock-13:** changes confined to `super-gsd/tools/cockpit-sidecar/` +
   `super-gsd/tools/shared/sgsd-design-system.css`. Zero touches to `cockpit-state/*`,
   `tests/cockpit-acceptance/*`, `tests/cockpit-regression/*`.
4. **--json contract preserved.** P136 does not add snapshot keys (P137 does that).
5. **No regression.** Current 57/57 self-test must remain green.
6. **Liveness contract (invariant #10):** P136 does not implement the source registry yet
   (P137), but the rendered shell MUST reserve DOM hooks for the staleness pills + reconnect
   badge so P138 can light them up without re-rendering the shell. Specifically the chrome
   line must include a `<span data-conn="state">` placeholder and the sec-nav must include
   `data-source` attributes per section.

## Scope

**In:**
- Refactor `sgsd-design-system.css` from dark tokens to the v3.4 light palette per the
  prototype (`.planning/milestones/v3.4/design-pack/Cockpit.html` `:root` block).
- Add IBM Plex Sans + IBM Plex Mono + Big Shoulders Display 900 font loading via Google Fonts
  link tags in `renderShell()` (or via the design-system CSS @import). Decision: link tags in
  shell — keeps CSS import-free and lets P138 prefetch them.
- Rebuild `renderShell()` to emit the chrome → command → ScanBar → sec-nav → main sections →
  bottom drawer skeleton with empty section containers + data-band placeholders + section
  IDs matching the IA table (`mission`, `telemetry`, `architecture`, `milestone`, `memory`,
  `evidence`, `events`).
- Reserve DOM hooks for liveness: `<span data-conn="state">` in chrome + `data-source` on
  each section root.
- Update SAC tests: existing `data-band="1|2|3"` markers stay (R18 binding); new section IDs
  must be addressable.

**Out:**
- Live data wiring (P137 + P138).
- Component implementation (P139-P142).
- SSE keep-alive + reconnect logic (P138).
- Source registry YAML (P137).
- Conformance promotion for the new IA (P143).

## Implementation decisions (locked)

- **Token file:** keep single file `sgsd-design-system.css` — operator decision per design-
  pack consolidation. Versioned in-place; no `-v2` suffix.
- **Font loading:** `<link rel="preconnect">` + `<link rel="stylesheet">` to fonts.googleapis
  in `renderShell()` head. NOT `@import` from CSS (blocks render).
- **Dark variant:** deleted from the prod path; preserved in the design pack
  (`Cockpit Dark.html`). v3.5+ may revive.
- **Section IDs (locked):** `sec-mission`, `sec-telemetry`, `sec-architecture`, `sec-milestone`,
  `sec-memory`, `sec-evidence`, `sec-events` — these become the `localStorage` keys for the
  collapsible state per HANDOFF-PROMPT.md (e.g. `sgsd-sec-mission`).
- **No band placeholder removal:** `data-band="1|2|3"` markers stay in the shell to keep R18
  green. The new sec-nav is layered on top of the band structure.

## Open questions

- None blocking. Operator approved milestone + liveness contract 2026-05-24.

## Semantic Acceptance Criteria (locked — must appear verbatim in PLAN-LOCKED YAML)

```
- id: SAC-P136-01
  input: "read sgsd-design-system.css"
  expected_outcome: "css contains --page: #F6F7F4, --surface: #FFFFFF, --ink: #151A1E, --line: #D6DBD2, --live: #006D77, --done: #2F7D5C, --attn: #B7791F, --severe: #B42318, --indigo: #515E9C as :root tokens"

- id: SAC-P136-02
  input: "renderShell() output"
  expected_outcome: "html string includes <link href* fonts.googleapis with IBM+Plex+Sans + IBM+Plex+Mono + Big+Shoulders+Display"

- id: SAC-P136-03
  input: "renderShell() output"
  expected_outcome: "html string includes data-band=\"1\", data-band=\"2\", data-band=\"3\" (R18 binding preserved)"

- id: SAC-P136-04
  input: "renderShell() output"
  expected_outcome: "html string includes id=\"sec-mission\", id=\"sec-telemetry\", id=\"sec-architecture\", id=\"sec-milestone\", id=\"sec-memory\", id=\"sec-evidence\", id=\"sec-events\""

- id: SAC-P136-05
  input: "renderShell() output"
  expected_outcome: "html string includes <span data-conn=\"state\""

- id: SAC-P136-06
  input: "full self-test suite"
  expected_outcome: "57 prior + 6 new = 63/63 PASS; zero regression on P125-P134 SACs"
```

## Files

- **MODIFY** `super-gsd/tools/shared/sgsd-design-system.css` — replace dark tokens with light
  palette; preserve rules-as-data shape (no token name renames that break upstream selectors).
- **MODIFY** `super-gsd/tools/cockpit-sidecar/render-html.cjs` — `renderShell()` rewrite to
  the new IA scaffold. `renderHtml()` is unchanged in P136 (data contract is P137).
- **EXTEND** `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` — append SAC-P136-01..06.

## Tasks

- **T1** — Token swap in `sgsd-design-system.css` (light palette + type stack).
- **T2** — `renderShell()` rewrite to new IA scaffold (chrome + command + ScanBar + sec-nav
  + main sections + bottom drawer) + font links + liveness DOM hooks.
- **T3** — Append SAC-P136-01..06 to `run-self-test.cjs`.
- **T4** — Phase-close artefacts (VERIFICATION + PHASE-CAPSULE).

## Provider routing

Codex GPT-5.5/xhigh for T1 + T2 (source-changing). Orchestrator-author T3 if Codex bails
again on test-only work. T4 orchestrator.

## Liveness contract recap

P136 does not yet implement freshness checks but MUST not block them. Concretely:
- Shell reserves `<span data-conn="state">` in chrome (P138 lights it up with the SSE
  connection state).
- Every section root carries `data-source="<source-id>"` so P138 can attach staleness pills
  without re-rendering.
- No section is rendered with hard-coded `data-source` content yet — those resolve via the
  Cockpit Source Registry in P137.
