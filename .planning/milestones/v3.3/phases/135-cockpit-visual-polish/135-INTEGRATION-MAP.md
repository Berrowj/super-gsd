# Integration Map — Claude Design → Live Cockpit

> Where Claude Design's output plugs back into the running SGSD cockpit. Read this alongside the DESIGN-PACKAGE.md.

## Plug-in points at a glance

```
Claude Design produces:                   Lives in (live cockpit file):
─────────────────────────                 ──────────────────────────────────────
HTML scaffolding (head + body shell) →  render-html.cjs :: renderShell()
CSS rules (full stylesheet)         →  render-html.cjs :: renderShell()  (inside <style>)
JS client (DOM diff + render funcs) →  client.js                          (whole file replaced)
Sparkline / bullet SVG builder      →  sparkline.cjs                      (optional extension)

Server-side (DO NOT TOUCH except as noted):
─────────────────────────                 ──────────────────────────────────────
HTTP endpoints                      →  serve.cjs           (already wired; routes /, /client.js, /events, /snapshot)
Snapshot JSON shape                 →  cockpit-sidecar.cjs (already wired; pure-data; do not change shape)
Stage status logic                  →  stage-pipeline.cjs  (already wired)
Alert + palette_tier logic          →  alert-grammar.cjs   (already wired; palette_tier field on each alert)
Rationale cascade                   →  rationale.cjs       (already wired; 6 string fields)
```

## The contract — what Claude Design must NOT break

1. **Snapshot JSON shape is frozen.** Claude Design renders from this shape; do not propose changes to it. If a new field is needed, propose it as a deferred enhancement; we'll add server-side later.

2. **`<section data-band="N">` swap target.** The shell scaffold has three `<section>` elements with `data-band="1"`, `data-band="2"`, `data-band="3"`. Each section's `innerHTML` is replaced on snapshot change. The parent section attributes stay; only children swap. Don't put event listeners or stateful JS inside band content — keep stateful JS in client.js at module scope.

3. **SSE event format.** Server pushes `event: snapshot\ndata: <json>\n\n`. Client subscribes via `EventSource('/events')`; `onmessage` handler parses `event.data` as JSON.

4. **Initial load.** Client fetches `/snapshot` once on `DOMContentLoaded` and renders. Then opens EventSource for live updates.

5. **No external deps beyond Google Fonts.** No npm install, no CDN beyond `fonts.googleapis.com` (already in scaffold).

## File-by-file: what to read, what to change

### `super-gsd/tools/cockpit-sidecar/render-html.cjs` — MODIFY

Two functions:
- `renderHtml(output)` — produces a static HTML snapshot. **Don't touch** unless changing the chronicle/snapshot archive path; that's separate from the live cockpit.
- `renderShell(opts)` — **THIS IS WHERE CLAUDE DESIGN'S HTML + CSS GO.** Returns the initial page HTML the SPA loads. Inline `<style>` block holds the CSS. Body contains the `<section data-band="N">` placeholders.

Today's renderShell is minimal. Claude Design's job: replace its return value with:
- Full inlined CSS (design tokens + cockpit-specific bento + band styles)
- Three `<section data-band="N">` placeholders with initial loading state
- `<script src="/client.js" defer></script>` at end

### `super-gsd/tools/cockpit-sidecar/client.js` — REPLACE WHOLE FILE

This is the entire client-side JS. Claude Design's interactive prototype JS goes here. Must:
- On DOMContentLoaded: `fetch('/snapshot').then(r => r.json()).then(renderAll)`
- Open `new EventSource('/events')` and call `renderAll` on each `onmessage`
- `renderAll(snapshot)` calls `renderBand1(snapshot)`, `renderBand2(snapshot)`, `renderBand3(snapshot)`
- Each `renderBandN` returns an HTML string for that band; client diffs vs lastHtml[N] and only swaps when different
- Band 3: if `snapshot.rationale` is missing/null, hide the section (`element.hidden = true`); else show

### `super-gsd/tools/cockpit-sidecar/sparkline.cjs` — KEEP, MAYBE EXTEND

Already has `renderAnsi(values, opts)` for terminal + `renderSvg(values, opts)` for HTML.
If Claude Design wants a bullet-chart helper (instead of sparkline), add a `renderBulletSvg(value, opts)` function here. `opts` would carry: thresholds `[goodMax, okMax, badMax]`, target value (optional), current value, width/height, colour. Server (serve.cjs) calls this once per snapshot and attaches the rendered SVG strings to `snapshot.sparklines` so client just injects them as innerHTML.

### `super-gsd/tools/cockpit-sidecar/serve.cjs` — TOUCH ONLY THE attachSparklines BIT

Already serves all routes. The one part Claude Design might cause us to extend: the server should pre-render any chart SVGs and attach them to the snapshot before broadcasting. Example:
```js
function computeSnapshot() {
  const result = sidecar.run([]);
  const snapshot = JSON.parse(result.stdout);
  snapshot.sparklines = {
    fog: sparkline.renderBulletSvg(snapshot.fog_score?.score ?? 0, { thresholds: [40, 70, 100], target: 50, color: 'var(--cyan)' }),
    dispatches: sparkline.renderBulletSvg(snapshot.signals?.dispatch_count ?? 0, { thresholds: [5, 12, 20], target: 10, color: 'var(--blue)' }),
    tokens: sparkline.renderBulletSvg(snapshot.signals?.token_spend ?? 0, { thresholds: [1e6, 3e6, 6e6], target: 2e6, color: 'var(--violet)' }),
  };
  return snapshot;
}
```
This means client.js doesn't need to render SVG — it just injects `snapshot.sparklines.fog` etc. into the right slot.

### `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` — DON'T TOUCH

This is the data layer. It produces the snapshot JSON. Already wired with all the right hooks (stage_pipeline via attachStagePipeline; rationale via attachRationale; alerts with palette_tier via evaluateAlerts). The snapshot JSON shape documented in the design package matches what this file produces — don't propose changes.

### `super-gsd/tools/cockpit-sidecar/stage-pipeline.cjs` — DON'T TOUCH (read only)

Defines the 5 stages and computes status. Output goes into `snapshot.stage_pipeline.stages`. Read for context only.

### `super-gsd/tools/cockpit-sidecar/alert-grammar.cjs` — DON'T TOUCH (read only)

Computes alerts and attaches `palette_tier` to each. Read for the tier mapping logic. Output goes into `snapshot.alerts`.

### `super-gsd/tools/cockpit-sidecar/rationale.cjs` — DON'T TOUCH (read only)

Reads PROJECT.md + INTENT.md + last SUMMARY.md + active CONTEXT.md cascade. Returns a 6-key object. Output goes into `snapshot.rationale`.

## Concrete integration steps after Claude Design produces the prototype

1. **CSS** — copy the entire `<style>` block contents from Claude Design's HTML into `render-html.cjs renderShell()`'s `<style>` block. Replace what's there now.

2. **HTML scaffold** — copy the `<main>` and its children from Claude Design's HTML into `renderShell()`'s body. Keep `<script src="/client.js" defer></script>` before `</body>`.

3. **JS** — copy Claude Design's `<script>` JS into `client.js` (whole-file replace). If the prototype has functions split across `<script>` blocks, consolidate into a single IIFE.

4. **Sparkline server-side rendering** (if Claude Design uses bullet/sparkline):
   - Add `renderBulletSvg` (or whatever helper) to `sparkline.cjs`
   - In `serve.cjs`, extend `computeSnapshot()` to call it and attach to `snapshot.sparklines`
   - Client.js reads `snapshot.sparklines.fog` and injects as `innerHTML` of the right slot

5. **Test** —
   - `node super-gsd/tools/cockpit-sidecar/serve.cjs --port 7777`
   - Open `http://localhost:7777`
   - Verify all 3 bands render
   - Touch `.planning/STATE.md` and confirm bands update within 2s
   - Run `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` — must still be 53/53 PASS

6. **Add SAC tests** (P135-T6) — append SAC-P135-NN to run-self-test.cjs verifying:
   - renderShell contains design-system band classes + data-band placeholders
   - serve.cjs snapshot includes sparklines key (if added)
   - client.js source contains expected band-render functions
   - end-to-end live test: spawn server → GET / → assert HTML quality bars

7. **STATE.md frontmatter advance** — separately, advance `.planning/STATE.md` from `milestone: v3.2 / phase: null` to `milestone: v3.3 / phase: 135` so attachRationale's path derivation works and rationale fields populate from the real cascade.

## File inventory (what's attached)

| Path | Status | Role |
|---|---|---|
| `super-gsd/tools/cockpit-sidecar/render-html.cjs` | **MODIFY** (CSS + HTML scaffold replace) | renderShell() is the SPA's initial HTML |
| `super-gsd/tools/cockpit-sidecar/client.js` | **REPLACE** (whole file) | Browser-side JS that renders snapshot into bands |
| `super-gsd/tools/cockpit-sidecar/serve.cjs` | **EXTEND** (attachSparklines helper only) | Node http server + SSE + fs.watch (already works; just add chart pre-render hook) |
| `super-gsd/tools/cockpit-sidecar/sparkline.cjs` | **EXTEND** (add bullet helper) | Existing renderAnsi + renderSvg; add renderBulletSvg if using bullet charts |
| `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` | **READ ONLY** | Produces snapshot JSON; do not modify |
| `super-gsd/tools/cockpit-sidecar/stage-pipeline.cjs` | **READ ONLY** | 5-stage data model |
| `super-gsd/tools/cockpit-sidecar/alert-grammar.cjs` | **READ ONLY** | Alerts + palette_tier mapping |
| `super-gsd/tools/cockpit-sidecar/rationale.cjs` | **READ ONLY** | Cascade reader |
| `super-gsd/tools/shared/sgsd-design-system.css` | **READ ONLY** (tokens to reuse) | Design tokens — Claude Design uses these in CSS |
| `.planning/milestones/v3.3/phases/135-cockpit-visual-polish/135-MOCKUP.html` | **STARTING POINT** | v0 mockup; iterate on this |

## Snapshot JSON — live sample (what /snapshot returns right now)

```json
{
  "milestone": "v3.2",
  "phase": null,
  "generated_at": "2026-05-24T17:19:49Z",
  "latest_chronicle": null,
  "binding_gate_status": null,
  "fog_score": {
    "score": 100,
    "tier": "high",
    "must_read_sections": ["summary","decisions","risks","architecture","file_impact"]
  },
  "signals": {
    "dispatch_count": 2,
    "token_spend": 3486033059,
    "files_changed": 0,
    "review_loops": 0,
    "minutes_since_operator_decision": 0
  },
  "north_star": { "rank": 4, "code": "HEAVY_PHASE", "message": "HEAVY PHASE — read summary, decisions, risks, architecture, file_impact" },
  "alerts": { "top": { "signal": "warnings", "channel": "terminal", "detail": [...], "palette_tier": "attention" }, "others_count": 0, "all": [...] },
  "stage_pipeline": {
    "stages": [
      { "name": "research", "owner": "codex/xhigh", "sla_minutes": 30, "status": "pending" },
      { "name": "vtp-enrich", "owner": "vtp-enrich", "sla_minutes": 5, "status": "pending" },
      { "name": "plan", "owner": "codex/xhigh", "sla_minutes": 20, "status": "pending" },
      { "name": "execute", "owner": "codex/xhigh", "sla_minutes": 90, "status": "pending" },
      { "name": "verify", "owner": "codex/xhigh", "sla_minutes": 15, "status": "pending" }
    ],
    "active_index": 0,
    "blocker": null
  },
  "rationale": {
    "context": "(no summary found)",
    "eli5": "(no intent found)",
    "what_is": "Now: (no intent found)",
    "what_could_be": "Then: (no intent found)",
    "why_this_phase": "(no context found)",
    "evidence_trail": "(no evidence files found; expected readable input such as .planning/STATE.md)"
  },
  "warnings": [ "chronicle_index_unavailable: ..." ],
  "recent_chronicles": []
}
```

Note: rationale is currently empty because STATE.md hasn't been advanced to v3.3 yet (a separate P135 task fixes that). Claude Design should design for the FULL populated state — see the package's sample snapshot.

## When Claude Design is ready

Paste the prototype HTML+CSS+JS back into this conversation (or save to a file path I can read). I'll bind it back to the live cockpit per the integration steps above and ship P135.
