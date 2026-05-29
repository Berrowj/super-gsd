# SGSD Cockpit v3.3 — Design Package for Claude Design

> Self-contained brief for an external design tool (Claude Design). Take this + the attached reference HTML files and produce an interactive HTML+CSS prototype I can lift into the live cockpit's client-side rendering.

## TL;DR — What we're designing

A **live developer-tool dashboard at `localhost:7777`** showing real-time state of an autonomous orchestration framework (SGSD — Super GSD). The dashboard streams data via Server-Sent Events from a Node http server; a browser-side client diff-updates the DOM as snapshots arrive every ~1-2 seconds. Operator watches the dashboard during 30-minute to 4-hour autonomous code-development runs.

**Surface category:** Developer Tool / IDE dashboard with Real-Time Monitoring panels. Dark-mode-OLED native. Information-dense but disciplined (Tufte data-ink, Krug one-loud-line, Knaflic declutter). Comparable references: Vercel deploy dashboard, GitHub Actions live workflow run, Datadog incident timeline.

## Design system — already exists, mostly use as-is

### Tokens (paste into Claude Design as CSS custom properties)

```css
:root {
  /* Backgrounds */
  --bg: #07111f;
  --bg2: #0c1a2f;
  --panel: rgba(255,255,255,0.065);    /* raised surface */
  --panel2: rgba(255,255,255,0.10);    /* tint surface */

  /* Ink */
  --ink: #f3f7ff;
  --ink-strong: #ffffff;
  --ink-muted: #aebbd0;
  --ink-soft: #7f8ca0;

  /* Lines */
  --line: rgba(255,255,255,0.16);
  --line-strong: rgba(255,255,255,0.26);

  /* Brand */
  --gold: #b98a2f;
  --gold-strong: #91661d;
  --gold-soft: #f2dfb8;

  /* Semantic palette — Primer 5-tier */
  --cyan: #67e8f9;        /* accent */
  --blue: #60a5fa;
  --violet: #c084fc;
  --green: #86efac;       /* success */
  --amber: #facc15;       /* attention */
  --red: #fb7185;         /* danger */

  /* Soft tints (background only) */
  --green-soft: rgba(134,239,172,0.16);
  --blue-soft: rgba(96,165,250,0.14);
  --violet-soft: rgba(192,132,252,0.14);
  --amber-soft: rgba(250,204,21,0.14);
  --red-soft: rgba(251,113,133,0.16);

  /* Bullet-chart range backgrounds */
  --bullet-good: #C8E6C9;
  --bullet-ok: #FFF9C4;
  --bullet-bad: #FFCDD2;

  /* Geometry */
  --radius-sm: 4px;
  --radius: 8px;
  --radius-lg: 12px;
  --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem;
  --space-4: 1rem;    --space-5: 1.25rem; --space-6: 1.5rem;
  --space-8: 2rem;    --space-10: 2.5rem;
  --measure: 74rem;

  /* Type stack — recommended (dev-tool dashboard) */
  --sans: 'Fira Sans', ui-sans-serif, system-ui, sans-serif;
  --mono: 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace;

  /* Shadows */
  --shadow: 0 1px 2px rgba(0,0,0,0.18), 0 10px 30px rgba(0,0,0,0.22);

  color-scheme: dark;
}

/* Body gradient — radial cyan + violet blobs on dark */
body {
  background:
    radial-gradient(circle at 10% 0%, rgba(103,232,249,0.14), transparent 36%),
    radial-gradient(circle at 84% 6%, rgba(192,132,252,0.12), transparent 32%),
    linear-gradient(145deg, var(--bg), var(--bg2) 48%, #08101c);
}
```

### Type system (Google Fonts)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Fira+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

Hierarchy:
- Display (North Star line): Fira Sans 800, `clamp(1.4rem, 2.6vw, 2rem)`, slight cyan text-shadow glow (one-loud-line)
- Body: Fira Sans 400, 0.92-1rem
- Eyebrows / labels: Fira Sans 800, 0.7-0.78rem, uppercase, letter-spacing 0.06-0.12em, gold-soft
- Mono / tabular: Fira Code 500-700 for code, file paths, numbers (always tabular-nums for vertical alignment)

## Style decision (from ui-ux-pro-max)

Query: `developer tool monitoring real-time terminal dark cockpit dashboard`

| Dimension | Recommendation |
|---|---|
| Product type match | Developer Tool / IDE |
| Primary style | **Dark Mode (OLED) + Minimalism** |
| Secondary patterns | Flat Design + **Bento Box Grid** |
| Landing pattern | Minimal & Direct + Documentation |
| Dashboard style | **Real-Time Monitor + Terminal** |
| Color palette focus | Dark syntax theme colors + Blue focus |
| Key effects | Minimal glow (text-shadow), dark-to-light transitions, low white emission, high readability, visible focus |
| Anti-patterns | Light mode default, slow rendering, emoji as icons |

## Chart pattern (from ui-ux-pro-max)

Query: `real-time dashboard live data sparkline metric monitoring`

For the trend strip in Band 2 (fog / dispatches / tokens), the recommended pattern is **Bullet Chart** (not line sparkline) because we don't yet have historical samples:

| Decision | Bullet Chart wins |
|---|---|
| Accessibility grade | AAA (vs B for streaming area) |
| Data volume required | Works with current value alone |
| Compact in a grid | 3-10 KPIs side-by-side natively |
| Color guidance | Qual ranges `#FFCDD2 / #FFF9C4 / #C8E6C9` (bad/ok/good) + target marker |
| Fallback | All values always visible as text (Tufte tabular figures) |

Once `serve.cjs` accumulates 60-300s of historical samples (P136+), revisit and consider adding a streaming-line sparkline overlay on the bullet bar.

## 17 cited design principles (the contract)

These were derived from VTP-substrate book research + canonical knowledge of the 9 named books (Minto / Heath / Roam / Munroe / Duarte / Sullivan / Knaflic / Brooks / Norman / Krug / Cockburn / Tufte / GitHub Primer + operator's own JCL pattern). Each principle maps to a specific cockpit decision.

| # | Principle | Source | Cockpit decision |
|---|---|---|---|
| P1 | Sharp-edged 100% stages | Brooks Mythical Man-Month | Stage pipeline: ✓ done / ⏳ active / ⏸ pending / 🛑 blocked. No "60% done" |
| P2 | Cause + ETA on every >1s op | Norman Design of Everyday Things | Every long-running task shows cause + ETA, not just elapsed |
| P3 | 5-stage pipeline with SLA + owner + blocker | Operator JCL Project Clarity Suite | research → vtp-enrich → plan → execute → verify |
| P4 | Data-ink ratio | Tufte | Every pixel justifies itself; ruthless declutter |
| P5 | Bullet charts / sparklines at zero space cost | Tufte | Inline trend indicators, ~12px tall |
| P6 | Macro + micro both legible | Tufte | Step-back: pattern reads. Lean-in: each value reads |
| P7 | One loud line per band | Krug | Exactly one element per band carries colour/bold |
| P8 | 3-layer cognition (visceral → behavioral → reflective) | Norman | Band 1 / Band 2 / Band 3 map exactly |
| P9 | Main success scenario + named extensions | Cockburn | Happy path stages + named extension events |
| P10 | Minto SCQA + governing thought + MECE | Minto | North Star = governing thought; Band 2 = MECE supporting points |
| P11 | SUCCES test on WHY panels | Heath | Simple / Unexpected / Concrete / Credible / Stories |
| P12 | 6×6 visual frame mapping | Roam | Each data type uses its native visual: stage→flowchart, metric→bullet, why→text |
| P13 | Common-words constraint on ELI5 | Munroe | Munroe ten-hundred allowlist enforced |
| P14 | What-is / what-could-be arc beat | Duarte | Rationale shows oscillating beats |
| P15 | Audience-first ≤10 words per top line | Sullivan | North Star ≤10 words |
| P16 | Declutter-then-highlight | Knaflic | Kill the noise; highlight one thing |
| P17 | Primer 5-tier functional colour | GitHub Primer | accent / success / attention / severe / danger / done — ≤5 colours total |

## 3-band information architecture

```
┌────────────────────────────────────────────────────────────────┐
│  BAND 1 · GOVERNING THOUGHT     (visceral, always loud)        │
│  ─ NORTH STAR (one loud line, ≤10 words)                       │
│  ─ DO NEXT (one recommended action)                            │
│  ─ ⚠ ONE ALERT (tier-coloured) + (+N more) count               │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│  BAND 2 · MECE SUPPORTING       (behavioral, scannable)        │
│  ─ Stage pipeline strip (5 cells: research / vtp / plan /      │
│      execute / verify) with status colours + ✓/⏳/🛑 markers   │
│  ─ Context rows (WHY RUNNING · UNLOCKS · BLOCKED-BY)           │
│  ─ Trend strip (3 bullet charts: fog · dispatches · tokens)    │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│  BAND 3 · RATIONALE              (reflective, drill-in)        │
│  ─ 2-col rationale-card grid:                                  │
│      WHY THIS PHASE · CONTEXT · ELI5 · WHAT IS · WHAT COULD BE │
│  ─ Full-width EVIDENCE TRAIL (file paths + commit SHAs)        │
└────────────────────────────────────────────────────────────────┘
```

Layout pattern: **Bento Box Grid** (CSS Grid at top level: 3 rows. Nested CSS Grid inside Band 2 and Band 3 for sub-columns).

Band 3 is **collapsible** (toggle button) and **hidden by default** when `snapshot.rationale` is null/missing.

## Sample data — the snapshot JSON shape

This is what the server pushes via SSE. Client receives one per event. Build the HTML from this.

```json
{
  "milestone": "v3.3",
  "phase": "135",
  "generated_at": "2026-05-24T18:30:12Z",
  "north_star": {
    "rank": 5,
    "code": "ON_TRACK",
    "message": "ON TRACK — v3.3/P135, plan ⏳"
  },
  "alerts": {
    "top": { "signal": "dispatch_count", "channel": "terminal", "detail": 15, "palette_tier": "attention" },
    "others_count": 1,
    "all": [ /* ... */ ]
  },
  "stage_pipeline": {
    "stages": [
      { "name": "research", "owner": "codex/xhigh", "sla_minutes": 30, "status": "done" },
      { "name": "vtp-enrich", "owner": "vtp-enrich", "sla_minutes": 5, "status": "done" },
      { "name": "plan", "owner": "codex/xhigh", "sla_minutes": 20, "status": "active" },
      { "name": "execute", "owner": "codex/xhigh", "sla_minutes": 90, "status": "pending" },
      { "name": "verify", "owner": "codex/xhigh", "sla_minutes": 15, "status": "pending" }
    ],
    "active_index": 2,
    "blocker": null
  },
  "fog_score": { "score": 38, "tier": "low" },
  "signals": {
    "dispatch_count": 7,
    "token_spend": 2400000,
    "files_changed": 4,
    "review_loops": 0,
    "minutes_since_operator_decision": 12
  },
  "rationale": {
    "why_this_phase": "P135 ships visual polish to bring the live cockpit up to the brief HTML quality...",
    "context": "v3.3 has 6 phases closed (P128–P133). Self-test 53/53 prior...",
    "eli5": "What is now: the live page shows almost nothing. What could be: ...",
    "what_is": "Minimal client.js. Plain text bands.",
    "what_could_be": "Bento grid with bullet charts, status-coloured pipeline cells...",
    "evidence_trail": ".planning/briefs/...html · super-gsd/tools/cockpit-sidecar/client.js · sgsd-design-system.css"
  },
  "warnings": ["..."],
  "recent_chronicles": []
}
```

## Status enum mappings

### Stage status → cell style
| status | bg | text colour | marker |
|---|---|---|---|
| `done` | `var(--green-soft)` | `var(--green)` | ✓ |
| `active` | `var(--amber-soft)` | `var(--amber)` + bottom-inset shadow | ⏳ |
| `pending` | transparent | `var(--ink-soft)` | — |
| `blocked` | `var(--red-soft)` | `var(--red)` | 🛑 |

### Alert palette_tier → border/bg colour
| palette_tier | border-left | background tint |
|---|---|---|
| `accent` | `var(--cyan)` | `rgba(103,232,249,0.10)` |
| `success` | `var(--green)` | `var(--green-soft)` |
| `attention` | `var(--amber)` | `var(--amber-soft)` |
| `severe` | `var(--violet)` | `var(--violet-soft)` |
| `danger` | `var(--red)` | `var(--red-soft)` |
| `done` | `var(--green)` | `var(--green-soft)` + opacity 0.7 |

### Bullet chart trend chip
- fog_score → low/mid/high (green-soft / amber-soft / red-soft)
- dispatches → steady/rising/climbing (neutral / amber / red)
- tokens → climbing/steady/relaxed (amber / neutral / green)

## Layout constraints

1. **Responsive:** works at 1100px desktop AND 700px (the narrower split in Windows Terminal pane). Band 2's 2-col layout collapses to 1 col under 760px; Band 3's 2-col rationale grid collapses under 800px.

2. **DOM-diff friendly:** each `<section data-band="N">` is the swap target. Client.js does `element.innerHTML = newHtml` per band when content changes. The parent section stays — only children swap. Don't put DOM state (event listeners, timers) inside the band content; keep all stateful JS in the shell.

3. **Accessibility (target AA, aim AAA):**
   - Stage cells: status conveyed by colour + marker (not colour alone) — WCAG SC 1.4.1
   - Bullet charts: numeric value always visible as text; SVG bar is `aria-hidden`
   - Live-region announcements: alert is `role="status"` (or `role="alert"` if tier is severe/danger)
   - Band 3 toggle: `aria-expanded` + `aria-controls`
   - Focus rings: visible 2-4px on `:focus-visible`
   - `@media (prefers-reduced-motion: reduce)` zeroes transitions

4. **Offline-survivable preferred:** Google Fonts CDN is OK for v3.3 but the brief calls for "no external CDN" eventually. Self-hosted Fira Code/Sans in P136+. Don't add other CDN deps.

5. **No emoji as structural icons** — use SVG (Heroicons, Lucide) inline. Status markers (✓, ⏳, 🛑) are text-based but used as inline glyphs, which is allowed by ui-ux-pro-max guidance.

6. **No animations beyond 150-300ms transitions** (per Material/HIG). The cockpit is for focused operator monitoring; no playful flourishes.

## What I want Claude Design to produce

1. **HTML + CSS prototype** — a single self-contained file (or split CSS+HTML+JS files) implementing the 3-band cockpit at the visual quality of the brief HTML explainer (reference file #3 below). The static `135-MOCKUP.html` I built is the starting point; iterate on it.

2. **Variations to explore (creative suggestions welcome):**
   - Alternative Band 1 layouts: stacked vs horizontal alignment of North Star + DO NEXT + alert
   - Pipeline strip variations: tabs / segmented / connected-arrow vs the current flex cells
   - Trend strip variations: bullet chart vs gauge vs combined sparkline + bullet
   - Band 3 disclosure: collapsible vs tabs vs persistent

3. **Click-through interactions:**
   - Band 3 collapse/expand toggle
   - Stage cell hover → tooltip with owner + SLA + time-in-stage
   - Bullet bar hover → tooltip with current value + target + range
   - Alert click → reveals all alerts in a list (`others_count` expansion)

4. **What I'll do with it:** lift the HTML + CSS into `super-gsd/tools/cockpit-sidecar/render-html.cjs renderShell()` + `super-gsd/tools/cockpit-sidecar/client.js` band-render functions. The CSS should reuse my existing design tokens (so the prototype's CSS can be inlined into renderShell's `<style>` block without conflict).

## Reference files (attaching alongside this brief)

1. **`135-DESIGN-SPEC.md`** — formal HTML structure spec with class names, comments, semantic markup contract
2. **`135-MOCKUP.html`** — static mockup of the design above (open in browser to see what I'm describing)
3. **`2026-05-24-cockpit-v3.3-assessment.html`** — the original 700-line brief HTML explainer (the gold-reference visual quality)
4. **`sgsd-design-system.css`** — the existing design tokens (what's already in production)
5. **The mockup HTML I generated last turn** — has working bullet charts, status-coloured pipeline cells, full rationale grid; treat it as v0 of what Claude Design improves

## Open questions for the designer

1. Are bullet charts the right call vs gauges or progress bars for fog/dispatches/tokens?
2. Should the active stage in the pipeline be visually larger (emphasized) rather than just colour-different?
3. Is gold-bordered Band 1 the right "loud" treatment, or would a coloured top edge / glow / inner-shadow read better?
4. How should "loading" / "no snapshot yet" state look for each band before the first SSE event arrives?
5. Should there be a global "connected to /events" indicator (e.g. green dot in the corner)? Operator wants to know if the live stream is alive.

## Constraints summary

- **Stack:** vanilla JS + CSS only. No frameworks. No build step.
- **Bundle target:** renderShell HTML inline-styles + client.js separate file, both served by serve.cjs.
- **DOM-diff target:** swap `<section data-band="N">` innerHTML on snapshot change. No re-render of the whole document.
- **Latency budget:** band re-render ≤ 5ms client-side. Server SSE push ≤ 200ms after fs.watch event.

---

That's the complete package. Open the mockup HTML, the design spec, and the brief HTML explainer side-by-side. Build me a polished interactive prototype.
