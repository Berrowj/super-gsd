---
phase: 135
phase_name: Cockpit Visual Polish — Match Brief HTML Quality
milestone: v3.3
ws: core
created: 2026-05-24
status: queued-planning
implementation_status: not-started
source: 2026-05-24 operator screenshot reaction ("lol this is it? No tables, no graphics, nothing?????")
predecessor: P134 (T1+T2 done, T3+T4 paused)
unlocks: v3.3 milestone close
---

# Phase 135 — Cockpit Visual Polish

> **Operator-feedback-driven repair phase.** The live localhost cockpit shipped in P132 with minimal text rendering — sparklines absent, stage cells text-only, rationale placeholders (`no context found`). The brief HTML explainer at `.planning/briefs/2026-05-24-cockpit-v3.3-assessment.html` is the gold-reference visual quality. P135 lifts client.js up to that bar.

## Goal

After P135:
- `client.js` renders band content with the design-system CSS classes (`.decision`, `.band`, `.band-1/2/3`, `.northstar`, `.do-next`, `.alert`, `.chip`, `.stage`, `.sparkline-row`, `.row`, etc.).
- Band 2 stage pipeline is a horizontal strip of 5 cells, each with a status-coloured background (done=green / active=amber / pending=neutral / blocked=red) and ✓/⏳/🛑 markers.
- Band 2 trend strip renders inline-SVG sparklines via `require('./sparkline.cjs').renderSvg` — three rows: fog / dispatches / tokens.
- Band 3 rationale renders the 6 fields as labeled paragraphs with the design system's `.row` layout (not raw text).
- `attachRationale` resolves cascade paths correctly when STATE.md frontmatter is current (advance STATE.md to v3.3 P135 active).
- `renderShell` emits scaffolding that supports the new band-render style (proper inner divs / aria labels).
- The cockpit RE-RENDERED matches the brief HTML quality at 80%+ visual fidelity.
- 4 new SAC tests.

## Binding invariants

1. **Lock-13 untouched** — work limited to `super-gsd/tools/cockpit-sidecar/` + `.planning/STATE.md` (frontmatter advance only).
2. **No external dependencies** — vanilla JS + Node built-ins only.
3. **--json contract preserved** — output JSON shape unchanged; only the rendering improves.
4. **Visual reference is the brief HTML explainer** — `.planning/briefs/2026-05-24-cockpit-v3.3-assessment.html` is the gold-reference; use it as the visual quality bar.

## What ships

### `super-gsd/tools/cockpit-sidecar/client.js` (rewritten)

Replace the minimal text rendering with rich design-system-class rendering. Each band's render function emits proper HTML structure:

**Band 1:**
```html
<div class="band-label">Band 1 · Governing Thought</div>
<div class="northstar">{north_star.message}</div>
<div class="do-next">▸ DO NEXT: {recommended-action}</div>
<div class="alert palette-{tier}"><span>⚠ {signal}</span> <span class="chip">+N more</span></div>
```

**Band 2:**
```html
<div class="band-label">Band 2 · Supporting</div>
<div class="pipeline">
  <div class="stage stage-done"><div class="stage-name">research ✓</div><div class="stage-owner">codex/xhigh</div></div>
  <div class="stage stage-active"><div class="stage-name">plan ⏳</div>...</div>
  ...
</div>
<div class="row"><span class="row-key">WHY RUNNING</span><span class="row-val">{cause + ETA}</span></div>
<div class="row"><span class="row-key">UNLOCKS</span><span class="row-val">{from roadmap or '—'}</span></div>
<div class="row"><span class="row-key">BLOCKED-BY</span><span class="row-val">{stage_pipeline.blocker || 'nothing'}</span></div>
<div class="trend-strip">
  <div class="sparkline-row"><span class="label">fog</span><span class="value">{val}</span>{inline SVG sparkline}<span class="chip">{tier}</span></div>
  <div class="sparkline-row"><span class="label">dispatches</span>{val}{svg}{chip}</div>
  <div class="sparkline-row"><span class="label">tokens</span>{val}{svg}{chip}</div>
</div>
```

For sparklines: client.js can't `require()` sparkline.cjs (browser context). Either:
  - inline a small ANSI→SVG converter (vanilla JS),
  - OR fetch from a new server endpoint `/sparkline?values=...`,
  - OR have the server include rendered SVG strings in the snapshot JSON (preferred — server-side render).

**Preferred**: extend `serve.cjs` to compute and attach `snapshot.sparklines.{fog|dispatches|tokens} = <svg>...</svg>` strings (using sparkline.renderSvg) so client.js just outputs them.

**Band 3:**
```html
<div class="band-label">Band 3 · Rationale</div>
<div class="row"><span class="row-key">WHY THIS PHASE</span><span class="row-val">{why_this_phase}</span></div>
<div class="row"><span class="row-key">CONTEXT</span><span class="row-val">{context}</span></div>
<div class="row"><span class="row-key">ELI5</span><span class="row-val">{eli5}</span></div>
<div class="row"><span class="row-key">WHAT IS</span><span class="row-val">{what_is}</span></div>
<div class="row"><span class="row-key">WHAT COULD BE</span><span class="row-val">{what_could_be}</span></div>
<div class="row"><span class="row-key">EVIDENCE TRAIL</span><span class="row-val"><code>{evidence_trail}</code></span></div>
```

### `super-gsd/tools/cockpit-sidecar/render-html.cjs` (modified)

renderShell — add CSS classes to the three `<section>` placeholders matching the band-N convention. Also add a small block of cockpit-specific styles (sparklines, stage cells, palette tiers) to the inline `<style>` section. Don't bloat — just enough to support what client.js emits.

### `super-gsd/tools/cockpit-sidecar/serve.cjs` (modified, additive)

Attach pre-rendered sparkline SVG strings to the snapshot before broadcasting:
```js
snapshot.sparklines = {
  fog: sparklineSvg([snapshot.fog_score?.score || 0], { color: '#facc15' }),
  dispatches: sparklineSvg([snapshot.signals?.dispatch_count || 0], { color: '#60a5fa' }),
  tokens: sparklineSvg([snapshot.signals?.token_spend || 0], { color: '#c084fc' }),
};
```

Real historical samples deferred — single-value sparkline is fine until P136+.

### `.planning/STATE.md` (frontmatter advance)

Advance the frontmatter to reflect v3.3 P135 active. Update:
- `milestone: v3.3` (was v3.2)
- `milestone_name`, `milestone_status`, `status` updated
- Add `phase_slug: 135-cockpit-visual-polish` so `attachRationale`'s path derivation finds the right phase directory.

### `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` (small fix)

Look at `attachRationale` path-derivation. Verify `last_summary_md` is resolved from the previous phase (e.g. 134's SUMMARY if present, else 132's VERIFICATION) — the current implementation probably leaves it null.

### `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (extended, pure append)

SAC-P135-01..04 appended.

## Semantic acceptance criteria

```yaml
semantic_acceptance_criteria:
  - id: SAC-P135-01
    input: "node super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs --json"
    expected_outcome: "output.rationale fields populated from REAL cascade (context contains real text from a summary; why_this_phase contains real text from CONTEXT.md; evidence_trail lists actual file paths) — NOT '(no X found)' placeholders. Requires STATE.md to be advanced to v3.3 active."
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P135-01"
  - id: SAC-P135-02
    input: "client.js source"
    expected_outcome: "contains class strings for design-system CSS: 'pipeline', 'stage', 'sparkline-row', 'row', 'band-label', 'northstar', 'do-next'. At minimum 5 of these present."
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P135-02"
  - id: SAC-P135-03
    input: "GET /snapshot from running server"
    expected_outcome: "snapshot.sparklines is an object with fog, dispatches, tokens — each a string starting with '<svg'"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P135-03"
  - id: SAC-P135-04
    input: "renderShell() output"
    expected_outcome: "contains design-system band classes (band-1, band-2, band-3) on the section elements; inline style block contains rules for .stage, .sparkline-row (or at least references the design-system tokens)"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P135-04"
```

## Files touched

| Operation | Path |
|---|---|
| MODIFY | `.planning/STATE.md` (frontmatter — advance to v3.3 P135 active) (T1) |
| MODIFY | `super-gsd/tools/cockpit-sidecar/render-html.cjs` — renderShell class tweaks (T2) |
| REWRITE | `super-gsd/tools/cockpit-sidecar/client.js` — full visual rewrite (T3) |
| MODIFY | `super-gsd/tools/cockpit-sidecar/serve.cjs` — attach snapshot.sparklines (T4) |
| MODIFY | `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` — fix attachRationale path resolution (T5) |
| EXTEND | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` — SAC-P135-01..04 (T6) |
| CREATE | `135-VERIFICATION.md` + `PHASE-CAPSULE.json` (T7) |

## Out of scope

- Real historical sparkline data (1-value sparklines OK for v3.3; defer to P136+).
- New band features beyond fixing the rendering.
- P134-T3/T4 are still pending (resume after P135).

## Source references

- Brief HTML explainer: `.planning/briefs/2026-05-24-cockpit-v3.3-assessment.html` (gold visual reference)
- Brief markdown: `.planning/briefs/2026-05-24-cockpit-v3.3-assessment.md`
- v3.2 design system: `super-gsd/tools/shared/sgsd-design-system.css`
- Sparkline module: `super-gsd/tools/cockpit-sidecar/sparkline.cjs` (renderSvg)
- Rationale module: `super-gsd/tools/cockpit-sidecar/rationale.cjs` (path resolution)
