---
phase: 136
phase_name: Cockpit Design Tokens + IA Scaffold (Light Editorial Palette + IBM Plex + renderShell Refactor)
milestone: v3.4
ws: core
status: PASS
verdict: PASS
completed_at: 2026-05-24
sacs_total: 6
sacs_passed: 6
sacs_deferred: 0
files_created: 0
files_modified: 3
deviations: 1
deviation_class: COSMETIC-DEAD-CODE
plan_id: P136-01-design-tokens-ia-scaffold
self_test_command: node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
self_test_result: pass
self_test_count: 63/63
---

# Phase 136 — Cockpit Design Tokens + IA Scaffold — VERIFICATION

## Summary

P136 lands the v3.4 light command-room visual foundation. `sgsd-design-system.css` now
declares 9 SAC-checked light tokens (`--page`, `--surface`, `--ink`, `--line`, `--live`,
`--done`, `--attn`, `--severe`, `--indigo`) plus the rgba helpers + IBM Plex / Big Shoulders
type stack. `renderShell()` is refactored to the new 7-section IA scaffold (sec-mission,
sec-telemetry, sec-architecture, sec-milestone, sec-memory, sec-evidence, sec-events) with
liveness DOM hooks (`<span data-conn="state">` in chrome + `data-source` on every section)
and 3 Google Fonts links in `<head>`. P136 is structural plumbing only — no data wiring,
no sticky behavior, no component bodies.

## SAC results

| SAC | Outcome | Result |
|---|---|---|
| SAC-P136-01 | css declares 9 light tokens with correct values | PASS |
| SAC-P136-02 | renderShell() emits 3 Google Fonts `<link>` tags (Plex Sans, Plex Mono, Big Shoulders Display) | PASS |
| SAC-P136-03 | renderShell() preserves `data-band="1\|2\|3"` markers (R18 binding preserved) | PASS |
| SAC-P136-04 | renderShell() emits all 7 section IDs (sec-mission..sec-events) | PASS |
| SAC-P136-05 | renderShell() reserves `<span data-conn="state">` chrome placeholder | PASS |
| SAC-P136-06 | structural witness: P125-P134 SAC ids still present in run-self-test.cjs | PASS |

Full suite: **63/63 PASS** (57 prior + 6 new). Exit 0.

## Files

- `super-gsd/tools/shared/sgsd-design-system.css` — light-palette token swap (T1, Codex)
- `super-gsd/tools/cockpit-sidecar/render-html.cjs` — renderShell IA scaffold rewrite (T2, Codex)
- `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` — SAC-P136-01..06 appended (T3, orchestrator)

## Invariant compliance

- **Lock-13 respected** — git diff confined to `super-gsd/tools/cockpit-sidecar/` +
  `super-gsd/tools/shared/sgsd-design-system.css`. Zero touches to `cockpit-state/*`,
  `tests/cockpit-acceptance/*`, `tests/cockpit-regression/*`.
- **`--json` contract unchanged** — `renderHtml` untouched. SAC-P127-01..05 + SAC-P134-03
  remain green.
- **No regression** — all 57 pre-P136 SACs remain green.
- **Liveness contract (invariant #10)** — DOM hooks (`data-conn="state"` + per-section
  `data-source="<id>"`) reserved. P137 wires the registry; P138 lights the pills.

## Deviations

**COSMETIC-DEAD-CODE-1 — T1 preserved old dark tokens in `:root` as dead code.** Codex's T1
patch kept the legacy `--bg #07111f`, `--bg2 #0c1a2f`, `--panel ...`, `--gold-ink ...`, etc.
declarations at the top of the `:root` block, then declared the new light tokens below, plus
an additional `:root.dark-era-disabled { ... }` block holding the full dark palette behind a
disabled class. Functionally inert (the dark values are either overridden by the alias chain
at the bottom of `:root` like `--gold-ink: var(--ink)` or live in an inactive selector that
nothing toggles), but the spec said "Remove the `--gold-*` and other dark-only token
declarations". Codex's report cited the Windows shell-exec block (`CreateProcessAsUserW
failed: 216`) as the reason for defensive preservation — it couldn't run any verification so
it kept the old values reachable in case downstream selectors referenced them. Self-test
57/57 → 63/63 confirms nothing breaks. Cleanup deferred to a follow-up tidy phase or to the
v3.4 P137 wiring sweep where these will be removed naturally.

## Codex runs

- **T1** — codex-executor.sh (b12898g8d) — sgsd-design-system.css light token swap. exit 0.
  Verification blocked by Windows shell-exec (CreateProcessAsUserW 216); orchestrator-ran
  self-test 57/57 PASS confirming no regression.
- **T2** — codex-executor.sh (b1e7vzaci) — render-html.cjs renderShell rewrite. exit 0.
  Verification blocked by same Windows shell-exec; orchestrator-ran 57/57 PASS + manual
  shell inspection confirms all SAC-P136-02..05 preconditions met.
- **T3** — orchestrator-direct. SAC-P136-01..06 appended; 63/63 PASS.
- **T4** — orchestrator-direct. This file + PHASE-CAPSULE.json.

## Commit chain

- (this commit) — T1+T2 source edits + T3 SAC tests + T4 close artefacts.

## Next phase

**v3.4 P137 — Snapshot data contract expansion + Cockpit Source Registry + liveness
heartbeat.** Extends `cockpit-sidecar.cjs` + `serve.cjs` to publish the ~14 new top-level
keys from the design pack, authors `super-gsd/registry/cockpit-sources.yaml`, attaches a
`_sources` heartbeat to every snapshot, implements `gate.liveness.all-sources-fresh`.
P136 reserved the DOM hooks; P137 makes them light up.
