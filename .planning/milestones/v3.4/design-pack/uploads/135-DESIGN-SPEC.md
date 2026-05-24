# SGSD Cockpit v3.3 — HTML Layout Design Spec

> Output of `ui-ux-pro-max:design` against query: `developer tool monitoring real-time terminal dark cockpit dashboard`. Synthesized with the operator's existing brief HTML explainer as visual reference.

## Design system summary (from ui-ux-pro-max)

- **Product type:** Developer Tool / IDE → Dashboard Style: **Real-Time Monitor + Terminal**
- **Primary style:** Dark Mode (OLED) + Minimalism
- **Secondary patterns:** Flat Design + **Bento Box Grid** ← top-level layout pattern
- **Typography:** Fira Code (mono) + Fira Sans (sans) — perfect for code/data/dashboards
- **Effects:** minimal text-shadow glow on loud line; 150-300ms transitions; visible focus rings; high contrast
- **Avoid:** light-mode default; slow rendering; emoji as structural icons; placeholder-only labels

## Chart pattern (for the trend strip)

`ui-ux-pro-max` chart query returned **Bullet Chart** (AAA accessibility, fits ≥3 KPIs in a grid, all values always visible as text) as best fit for our use case. Better than line sparklines because we don't yet have historical samples — bullet chart shows *current value + qualitative range + threshold* without needing time-series data. Color guidance: qualitative ranges `#FFCDD2 / #FFF9C4 / #C8E6C9` (bad / ok / good).

Use bullet chart for fog/dispatches/tokens **instead of** line sparklines for v3.3. (Revisit if/when serve.cjs accumulates historical samples in memory — P136+.)

## Top-level layout: Bento Box Grid

```
┌───────────────────────────────────────────────────────────────────┐
│  BAND 1 · GOVERNING THOUGHT          (full width, gold-bordered)  │
└───────────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────────┐
│  BAND 2 · MECE SUPPORTING                                          │
│  ┌─ stage-pipeline (full width inside band) ─────────────────┐    │
│  │  research ✓   vtp ✓   plan ⏳   execute   verify          │    │
│  └────────────────────────────────────────────────────────────┘    │
│  ┌─ context-rows (left) ──────┐  ┌─ trend-strip (right) ────┐    │
│  │  WHY RUNNING               │  │  fog        [bullet]      │    │
│  │  UNLOCKS                   │  │  dispatches [bullet]      │    │
│  │  BLOCKED-BY                │  │  tokens     [bullet]      │    │
│  └────────────────────────────┘  └───────────────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────────┐
│  BAND 3 · RATIONALE          (collapsible; hidden when empty)     │
│  ┌──────────────────────┬──────────────────────────────────┐      │
│  │ WHY THIS PHASE       │ CONTEXT                          │      │
│  │ ─ text ─             │ ─ text ─                         │      │
│  ├──────────────────────┼──────────────────────────────────┤      │
│  │ ELI5                 │ WHAT IS / WHAT COULD BE          │      │
│  │ ─ Haiku 4-beat ─     │ ─ Duarte beats ─                 │      │
│  └──────────────────────┴──────────────────────────────────┘      │
│  EVIDENCE TRAIL                                                   │
│  ─ <code>file paths + commit SHAs</code> ─                        │
└───────────────────────────────────────────────────────────────────┘
```

CSS Grid at top level. Within Band 2, nested 2-column grid (context-rows | trend-strip). Within Band 3, 2-column grid for rationale fields + full-width EVIDENCE TRAIL row.

## HTML structure (renderShell + client.js band fragments)

### renderShell scaffold (Node-side, served at GET /)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SGSD Cockpit</title>
  <!-- @font-face Fira Code + Fira Sans inlined or Google Fonts link with preload -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Fira+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    /* INLINED sgsd-design-system.css */
    /* + cockpit-specific block: bento grid, stage cells, bullet bars, palette tiers */
  </style>
</head>
<body>
  <main class="cockpit-bento" role="main" aria-label="SGSD live cockpit">
    <section data-band="1" class="band band-1" aria-label="Governing thought">
      <!-- client.js fills this on /snapshot + /events -->
      <div class="band-loading">Connecting to /events…</div>
    </section>
    <section data-band="2" class="band band-2" aria-label="Supporting state">
      <div class="band-loading"></div>
    </section>
    <section data-band="3" class="band band-3 band-collapsed" aria-label="Rationale (drill-in)" hidden>
      <div class="band-loading"></div>
    </section>
  </main>
  <script src="/client.js" defer></script>
</body>
</html>
```

### Band 1 fragment (client.js fills this)

```html
<header class="band-header">
  <span class="band-eyebrow">Band 1 · Governing Thought</span>
  <time class="band-tick" datetime="2026-05-24T18:30:00Z">live · 18:30:12</time>
</header>

<p class="northstar" data-rank="5" data-code="ON_TRACK">
  <span class="northstar-glyph" aria-hidden="true">★</span>
  <strong class="northstar-message">ON TRACK — v3.3/P135, plan ⏳</strong>
</p>

<p class="do-next">
  <span class="do-next-arrow" aria-hidden="true">▸</span>
  <span class="do-next-label">DO NEXT</span>
  <span class="do-next-text">continue — advance to the next phase</span>
</p>

<aside class="alert palette-tier-attention" role="status" data-others="0">
  <span class="alert-icon" aria-hidden="true">⚠</span>
  <span class="alert-signal">dispatch_count</span>
  <span class="alert-detail">15 (over 12)</span>
  <span class="alert-more chip">+0 more</span>
</aside>
```

CSS rules (in <style> block, scoped):
- `.band-1`: gold-bordered (`border-left: 6px solid var(--gold)`), gradient (`linear-gradient(135deg, rgba(185,138,47,0.12), var(--paper-raised))`).
- `.northstar-message`: `font-size: clamp(1.4rem, 2.6vw, 2rem); font-weight: 800; text-shadow: 0 0 12px rgba(103,232,249,0.35);` — Tufte one-loud-line + minimal glow per OLED style.
- `.do-next`: gold-soft, weight 700, ~1rem.
- `.alert.palette-tier-{accent|success|attention|severe|danger|done}`: each tier maps to a CSS variable (`--tier-attention: var(--amber)`, etc.); alert has tier-coloured left border + soft tint background + chip.

### Band 2 fragment

```html
<header class="band-header">
  <span class="band-eyebrow">Band 2 · Supporting</span>
</header>

<!-- Stage pipeline strip -->
<ol class="pipeline" role="list" aria-label="Phase stages">
  <li class="stage stage-done" data-stage="research" data-status="done">
    <div class="stage-name">research <span class="stage-marker">✓</span></div>
    <div class="stage-owner">codex/xhigh</div>
    <div class="stage-sla">30m</div>
  </li>
  <li class="stage stage-done" data-stage="vtp-enrich" data-status="done">
    <div class="stage-name">vtp ✓</div>
    <div class="stage-owner">vtp-enrich</div>
    <div class="stage-sla">5m</div>
  </li>
  <li class="stage stage-active" data-stage="plan" data-status="active">
    <div class="stage-name">plan <span class="stage-marker" aria-label="in progress">⏳</span></div>
    <div class="stage-owner">codex/xhigh</div>
    <div class="stage-sla">20m · 4m elapsed</div>
  </li>
  <li class="stage stage-pending" data-stage="execute" data-status="pending">
    <div class="stage-name">execute</div>
    <div class="stage-owner">codex/xhigh</div>
    <div class="stage-sla">90m</div>
  </li>
  <li class="stage stage-pending" data-stage="verify" data-status="pending">
    <div class="stage-name">verify</div>
    <div class="stage-owner">codex/xhigh</div>
    <div class="stage-sla">15m</div>
  </li>
</ol>

<!-- Two-column grid: context rows | trend bullets -->
<div class="band-2-cols">
  <dl class="context-rows">
    <div class="row"><dt>WHY RUNNING</dt><dd>codex planning · cause: SAC drift · ETA: ~3m</dd></div>
    <div class="row"><dt>UNLOCKS</dt><dd>P136 (next phase)</dd></div>
    <div class="row"><dt>BLOCKED-BY</dt><dd class="status-ok">nothing</dd></div>
  </dl>

  <!-- Trend strip — bullet charts (current value + qual range) -->
  <div class="trend-strip" role="group" aria-label="Live metrics">
    <div class="bullet-row" data-metric="fog">
      <span class="bullet-label">fog</span>
      <span class="bullet-value tabular">38</span>
      <svg class="bullet-bar" viewBox="0 0 100 12" width="100" height="12" aria-hidden="true">
        <rect width="40" height="12" fill="#C8E6C9"/>             <!-- good range 0-40 -->
        <rect x="40" width="30" height="12" fill="#FFF9C4"/>      <!-- ok range 40-70 -->
        <rect x="70" width="30" height="12" fill="#FFCDD2"/>      <!-- bad range 70-100 -->
        <rect width="38" height="12" fill="var(--gold)"/>          <!-- current value bar -->
        <rect x="50" width="1" height="12" fill="#000"/>          <!-- target marker -->
      </svg>
      <span class="bullet-tier chip">low</span>
    </div>
    <div class="bullet-row" data-metric="dispatches">
      <span class="bullet-label">dispatches</span>
      <span class="bullet-value tabular">7</span>
      <svg class="bullet-bar" viewBox="0 0 100 12" width="100" height="12" aria-hidden="true">
        <!-- similar 3-tier bullet -->
      </svg>
      <span class="bullet-tier chip">steady</span>
    </div>
    <div class="bullet-row" data-metric="tokens">
      <span class="bullet-label">tokens</span>
      <span class="bullet-value tabular">2.4M</span>
      <svg class="bullet-bar" viewBox="0 0 100 12" width="100" height="12" aria-hidden="true"><!-- ... --></svg>
      <span class="bullet-tier chip palette-tier-attention">climbing</span>
    </div>
  </div>
</div>
```

CSS rules:
- `.pipeline`: `display: flex; gap: 0;` (cells touch) `border: 1px solid var(--line); border-radius: var(--radius);` overflow hidden; each `.stage` is `flex:1; padding: var(--space-3); text-align:center; border-right: 1px solid var(--line);` last-child no border.
- `.stage-done`: `background: var(--green-soft); color: var(--green);`
- `.stage-active`: `background: var(--amber-soft); color: var(--amber); box-shadow: inset 0 -2px 0 var(--amber);` — bottom border emphasis to draw eye.
- `.stage-pending`: dim, monochrome.
- `.stage-blocked`: `background: var(--red-soft); color: var(--red);`
- `.band-2-cols`: `display: grid; grid-template-columns: 1.2fr 1fr; gap: var(--space-5);` collapses to single column under 700px.
- `.context-rows .row`: `display: grid; grid-template-columns: 10rem 1fr; gap: var(--space-3); font-size: 0.92rem;` ; `dt` is `color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; font-size: 0.78rem;`; `dd` is normal text. `.status-ok` is `color: var(--green); font-weight: 700;`.
- `.bullet-row`: `display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-2);`.
- `.bullet-bar`: width 100px; height 12px; sits inline with label + value + tier chip.
- `.tabular`: `font-variant-numeric: tabular-nums; font-family: var(--mono);` — values align column-wise across the 3 rows (Tufte tabular figures).

### Band 3 fragment (collapsed when no rationale)

```html
<header class="band-header">
  <span class="band-eyebrow">Band 3 · Rationale</span>
  <button class="band-toggle" aria-expanded="true" aria-controls="band-3-content">collapse</button>
</header>

<div id="band-3-content" class="rationale-grid">
  <article class="rationale-card" data-field="why_this_phase">
    <h3>WHY THIS PHASE</h3>
    <p>P135 ships visual polish to bring the live cockpit up to the brief HTML quality. After P132 shipped the localhost server with minimal text rendering, operator feedback identified the gap.</p>
  </article>
  <article class="rationale-card" data-field="context">
    <h3>CONTEXT</h3>
    <p>v3.3 has 6 phases closed (P128–P133). P134-T1/T2 done; T3/T4 paused for P135. Self-test 53/53 prior to this phase.</p>
  </article>
  <article class="rationale-card" data-field="eli5">
    <h3>ELI5</h3>
    <p><strong>What is now:</strong> the live page shows almost nothing. <strong>What could be:</strong> it shows everything at a glance — stage progress, what's blocked, why it matters. <strong>S.T.A.R.:</strong> a bento layout with one loud line, a 5-cell pipeline strip, three little bullet bars for fog/dispatches/tokens, and a rich rationale layer. <strong>Call to action:</strong> open localhost:7777 after P135 closes.</p>
  </article>
  <article class="rationale-card" data-field="what_is">
    <h3>WHAT IS</h3>
    <p>Minimal client.js. Plain text bands. No sparklines. Placeholder rationale.</p>
  </article>
  <article class="rationale-card" data-field="what_could_be">
    <h3>WHAT COULD BE</h3>
    <p>Bento grid with bullet charts, status-coloured pipeline cells, real rationale paragraphs, and SSE-pushed updates within 200ms of any ledger change.</p>
  </article>
  <article class="rationale-card rationale-evidence" data-field="evidence_trail">
    <h3>EVIDENCE TRAIL</h3>
    <p>
      <code>.planning/briefs/2026-05-24-cockpit-v3.3-assessment.html</code> (gold reference) ·
      <code>super-gsd/tools/cockpit-sidecar/client.js</code> (target) ·
      <code>super-gsd/tools/shared/sgsd-design-system.css</code> (tokens)
    </p>
  </article>
</div>
```

CSS rules:
- `.rationale-grid`: `display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);` collapses to 1 column under 800px.
- `.rationale-card`: `border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper-raised); padding: var(--space-4);` — bento card pattern.
- `.rationale-card h3`: `font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gold-soft); margin-bottom: var(--space-2); font-weight: 800;`
- `.rationale-evidence`: `grid-column: 1 / -1;` — spans full width since evidence is a list.
- `.band-collapsed`: when present on the section, the entire band is `display: none;` (used when snapshot.rationale absent).

## DOM-diff strategy

The cockpit emits an SSE event per snapshot change. Client.js receives the JSON and:

1. Computes the HTML fragment for each band (`renderBand1`, `renderBand2`, `renderBand3`) using template literals.
2. Compares against the per-band cached last fragment (`lastHtml[1|2|3]`).
3. If changed, replaces the band element's `innerHTML` with the new fragment. The parent `<section data-band="N">` stays — only its children swap.
4. For Band 3: if `snapshot.rationale` is null/missing, set `band-3` to `hidden=true` and skip render; otherwise un-hide.

This avoids re-rendering the entire page on every SSE event. The per-band swap is fast (~1ms in vanilla JS).

## Accessibility checklist (from ui-ux-pro-max QC)

- [x] WCAG AA contrast (dark mode pair designed against this colour palette; Fira Sans + design tokens meet 4.5:1 for body text on `var(--bg)`)
- [x] Reduced motion: no animations by default; transitions ≤200ms; `@media (prefers-reduced-motion: reduce)` disables the do-next arrow micro-animation
- [x] Stage cells: status conveyed by colour + ✓/⏳/🛑 marker (not colour alone — WCAG SC 1.4.1)
- [x] Bullet chart values always visible as text (Tufte tabular figures); chart is `aria-hidden="true"` because the text label + value carry the data
- [x] Band 3 toggle has `aria-expanded` + `aria-controls`
- [x] Live region announcement for alert: `<aside role="status">` for non-critical, would be `role="alert"` for severe/danger tier
- [x] Focus rings: 2-4px visible on `:focus-visible` for the band-toggle button

## What to feed Codex

This file (135-DESIGN-SPEC.md) is the input for P135's implementation tasks. Each Codex prompt should reference:
- Specific section of this spec (band fragment / CSS rules)
- The cited design-system CSS variables to use
- The gold-reference HTML at `.planning/briefs/2026-05-24-cockpit-v3.3-assessment.html` for visual comparison

## Anti-patterns to avoid (from ui-ux-pro-max)

- ❌ Emojis as structural icons → use Heroicons/Lucide inline SVG (already in our brief HTML)
- ❌ Slow rendering → keep client.js DOM diff per-band, not full repaint
- ❌ Light mode default → we're OLED-dark already ✓
- ❌ Touch targets <44pt → band-toggle button must be ≥44pt
- ❌ Mixing filled and outline icon styles → use one consistent set
- ❌ Layout-shifting press states → use opacity/colour transitions, not transform on size

## Open questions

1. **Font self-host vs Google Fonts CDN?** Google Fonts CDN is the simplest path but adds a network hop. For a fully offline-survivable localhost cockpit, self-host Fira via `@font-face`. **Recommendation:** Google Fonts CDN for v3.3 (fast to ship); self-host in P136+ if offline matters.

2. **Should bullet charts include sparklines once historical data exists?** Not yet — bullet alone is cleaner. When serve.cjs accumulates 60-300s of samples (per ui-ux-pro-max real-time streaming guidance), revisit and add an inline mini-sparkline overlay to the bullet bar.

3. **Band 3 toggle: persist collapsed state?** Use `localStorage.getItem('sgsd-band3-collapsed')` for operator preference. Defer to P136+.
