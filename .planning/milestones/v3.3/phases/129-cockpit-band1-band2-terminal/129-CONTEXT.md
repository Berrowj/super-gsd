---
phase: 129
phase_name: Cockpit Bands 1+2 Terminal Layout
milestone: v3.3
ws: core
created: 2026-05-24
status: queued-planning
implementation_status: not-started
source: v3.3 INTENT.md + .planning/plans/2026-05-24-cockpit-v3.3-implementation.md (P129 scoped summary)
predecessor: P128 PASS @ 5c520da (stage-pipeline data model; 27/27 self-test)
implements: brief lines 143-160 (P129 scoped summary); plan principles P5+P7+P17 (Tufte sparklines + Krug one-loud + Primer 5-tier)
unlocks: [P130 (Band 3 layers below Bands 1+2), P132 (localhost-live consumes the same band renderers)]
---

# Phase 129 — Cockpit Bands 1+2 Terminal Layout

> Rebuild `renderText()` and `renderBrief()` in `cockpit-sidecar.cjs` to emit the 3-band terminal layout from the v3.3 brief. Band 1 = governing thought (North Star + DO NEXT + one alert, already shipped in v3.2 R04). Band 2 = MECE supporting points (stage pipeline strip + cause+ETA + unlocks + blocked-by + sparkline trend strip). Band 3 layout comes in P130; this phase ships Bands 1+2 only and demotes the existing supporting block to "deprecated, replaced by Band 2".

## Goal

After P129, `cockpit-sidecar.cjs --text` output renders the new 3-band terminal layout (Band 1 + Band 2 visible; Band 3 deferred to P130). New `sparkline.cjs` module exports `renderAnsi(values, opts)` (terminal Unicode block characters) and `renderSvg(values, opts)` (inline SVG for HTML surfaces). Existing `alert-grammar.cjs` extended with `palette_tier` field on each alert per Primer 5-tier mapping. `--brief` mode preserves its ≤4-line discipline (Sullivan ≤10-words rule). All v3.2 SACs remain green; new SAC-P129-01..06 cover the new behaviour.

## Binding invariants (from v3.3 INTENT.md + DLB-12)

1. **Deterministic, no agent judgement.** Band rendering is a pure function of the `cockpit-sidecar.cjs --json` output. No LLM.
2. **Lock-13 untouched.** All changes under `super-gsd/tools/cockpit-sidecar/`. Zero touches to `cockpit-state/*` or test-suite directories.
3. **`--json` contract still additive.** P129 does not change the JSON shape; it only adds rendering. Alert `palette_tier` is an additive JSON key (each alert in `alerts.all[]` gains it; v3.2 keys preserved).
4. **One loud line per band.** Krug visual hierarchy + v3.2 R04 — exactly one element per band carries colour/bold; rest demoted to monochrome supporting.
5. **`--brief` ≤ 4 lines.** Sullivan-grounded; already in v3.2; preserve.
6. **Primer 5-tier palette.** alert.palette_tier ∈ {`accent`, `success`, `attention`, `severe`, `danger`, `done`}. No more than 5 colour codes total across the surface.

## What ships

### `super-gsd/tools/cockpit-sidecar/sparkline.cjs` (new)

`renderAnsi(values, opts)` — input is a number array (last N samples); output is a width-bounded string of Unicode block characters (`▁▂▃▄▅▆▇█`). Width default 16. `opts.color` (optional) adds an ANSI colour code from the Primer palette.

`renderSvg(values, opts)` — input is the same array; output is an inline SVG `<svg>` string with a polyline path. Used by `renderHtml` (P132) and the chronicle. Width default 110px height 24px.

Both functions: pure, no side effects, handle empty/null input gracefully.

### `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` (modified)

`renderText(output, opts)` rewritten to emit:

```
┌─ NORTH STAR ──────────────────────────────────────────────────────────┐
│ {north_star.message}                                                   │  ← Band 1 loud line (cyan + bold)
├────────────────────────────────────────────────────────────────────────┤
│ ▸ DO NEXT: {recommendedAction(north_star.code)}                        │  ← Band 1 action
│ {alert symbol} {alert.signal}                          (+N more)       │  ← Band 1 alert (palette-coloured)
├────────────────────────────────────────────────────────────────────────┤
│ {stage pipeline strip} discuss ✓  research ✓  vtp ✓  plan ⏳  exec  verify  │  ← Band 2 pipeline
│ WHY RUNNING  {stage.owner} · cause: {derived} · ETA: ~{computed}m      │  ← Band 2 cause+ETA
│ UNLOCKS      {derived from roadmap}                                    │  ← Band 2 unlocks
│ BLOCKED-BY   {stage_pipeline.blocker || 'nothing'}                     │  ← Band 2 blockers
│                                                                        │
│ fog        {N}   {sparkline}   {trend chip}                            │  ← Band 2 trend strip
│ dispatches {N}   {sparkline}   {trend chip}                            │
│ tokens     {N}   {sparkline}   {trend chip}                            │
└────────────────────────────────────────────────────────────────────────┘
```

`renderBrief(output, opts)` — North Star line + DO NEXT + (optional) one alert. ≤4 lines.

### `super-gsd/tools/cockpit-sidecar/alert-grammar.cjs` (modified, additive)

Add `palette_tier` to each alert in `evaluateAlerts()` output via a deterministic mapping table:
- `binding_gate_status == RED` → `danger`
- validator verdict NOT GROUNDED → `danger`
- `fog_score > 70` sustained → `severe`
- `dispatch_count > 12` → `attention`
- stale warnings → `attention`
- default → `accent`

### `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (extended, pure append)

SAC-P129-01..06 appended.

## Semantic acceptance criteria

```yaml
semantic_acceptance_criteria:
  - id: SAC-P129-01
    input: "cockpit-sidecar --text against a synthesized green-state output (north_star.code=ON_TRACK, stage_pipeline present, fog=10, no alerts)"
    expected_outcome: "rendered text contains 3 visually-distinct horizontal-line section boundaries (Band 1 header, Band 1/2 separator, Band 2/footer); each band heading present"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P129-01"
  - id: SAC-P129-02
    input: "renderText output with one alert and color enabled"
    expected_outcome: "exactly one ANSI bold sequence in Band 1 (North Star line) — no other line carries bold; DO NEXT line is colour-emphasized but not bold; alert line is palette-coloured per tier"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P129-02"
  - id: SAC-P129-03
    input: "renderText output for an output with stage_pipeline.active_index=2 (plan active), all earlier stages done"
    expected_outcome: "stage pipeline strip renders 5 cells with ✓ on done stages, ⏳ on active stage at index 2, no indicator on pending stages 3-4"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P129-03"
  - id: SAC-P129-04
    input: "renderText output with signals.fog_score=38, signals.dispatch_count=7, signals.token_spend=2400000"
    expected_outcome: "Band 2 trend strip renders 3 lines (fog, dispatches, tokens) with inline Unicode-block sparkline ≤16 chars each + a current value column"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P129-04"
  - id: SAC-P129-05
    input: "renderBrief output for any state"
    expected_outcome: "output line count ≤4; line 1 is north_star.message; line 2 starts with 'DO NEXT:'; if line 3 exists it is an alert; no Band 2 content"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P129-05"
  - id: SAC-P129-06
    input: "evaluateAlerts({binding_gate_status:'RED', fog_score:{score:85}, signals:{dispatch_count:15}}) — multiple alert candidates"
    expected_outcome: "every alert in result.all carries a palette_tier field from {accent, success, attention, severe, danger, done}; top alert's tier matches its signal type per the locked mapping"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P129-06"
```

## Files touched

| Operation | Path | Purpose |
|---|---|---|
| CREATE | `super-gsd/tools/cockpit-sidecar/sparkline.cjs` | renderAnsi + renderSvg exports |
| MODIFY | `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` | rewrite renderText for 3-band layout; preserve renderBrief ≤4-line discipline |
| MODIFY | `super-gsd/tools/cockpit-sidecar/alert-grammar.cjs` | additive palette_tier field on each alert |
| EXTEND | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` | append SAC-P129-01..06 (pure append) |
| CREATE | `129-VERIFICATION.md` | phase-close artefact (post-T1..T3 green) |
| CREATE | `PHASE-CAPSULE.json` | SGSD phase capsule |

## Out of scope

- No Band 3 layout (P130).
- No localhost server (P132).
- No PowerShell monitor changes (P133).
- No conformance gate changes (P134).

## Source references

- v3.3 INTENT.md (entry phase 2 of v3.3)
- Plan: `.planning/plans/2026-05-24-cockpit-v3.3-implementation.md` (P129 scoped summary, lines after P128 section)
- Brief: `.planning/briefs/2026-05-24-cockpit-v3.3-assessment.md` (principles P5+P7+P17 applied here)
- Predecessor: `.planning/milestones/v3.3/phases/128-cockpit-data-model/` (PASS @ 5c520da; stage_pipeline JSON contract)
- Tufte sparklines: `wiki/research/tufte-visual-display-data-density.md::Sparklines` (VTP-substrate)
- Krug one-loud: `wiki/research/krug-dont-make-me-think.md` (VTP-substrate)
- GitHub Primer 5-tier: `wiki/research/github-primer-design-system.md::Functional colour tiers (5-way)` (VTP-substrate)
