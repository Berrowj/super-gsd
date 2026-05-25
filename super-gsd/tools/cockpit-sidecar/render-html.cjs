const fs = require('fs');
const path = require('path');

// P139.5: re-read design-system CSS on every renderShell() call so live edits
// show up on the next browser reload without restarting serve.cjs. Operator
// 2026-05-25 lost ~30 minutes diagnosing a "broken cockpit" that was really
// just stale CSS cached at module load. Cost: one ~25kB sync read per render.
const DESIGN_SYSTEM_CSS_PATH = path.join(__dirname, '..', 'shared', 'sgsd-design-system.css');
function loadDesignSystemCss() {
  try { return fs.readFileSync(DESIGN_SYSTEM_CSS_PATH, 'utf8'); } catch (_e) { return ''; }
}
let designSystemCss = loadDesignSystemCss();

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function valueOr(value, fallback) {
  return value === undefined || value === null || value === '' ? fallback : value;
}

function latestChroniclePath(output) {
  const latest = output.latest_chronicle;
  return latest && latest.location ? latest.location : 'none';
}

function northStarLine(output) {
  const northStar = output.north_star || {};
  const code = northStar.code || 'UNKNOWN';
  const message = northStar.message || 'review cockpit state';
  return `NORTH STAR [${code}]: ${message}`;
}

function alertLine(output) {
  const alerts = output.alerts || {};
  if (!alerts.top) return null;
  const more = alerts.others_count > 0 ? `  (+${alerts.others_count} more)` : '';
  return `⚠ ${alerts.top.signal}${more}`;
}

function recommendedAction(code) {
  switch (code) {
    case 'BLOCKED':
      return 'resolve the binding gate before close';
    case 'CHRONICLE_FAILED':
      return 'fix the chronicle citation, re-validate';
    case 'NEEDS_OPERATOR':
      return 'operator decision required — see blockers';
    case 'HEAVY_PHASE':
      return 'read the must-read chronicle sections';
    case 'ON_TRACK':
      return 'continue — advance to the next phase';
    default:
      return 'review cockpit state';
  }
}

function renderHtml(output) {
  const alert = alertLine(output);
  const alertHtml = alert ? `    <div class="callout" role="alert">${escapeHtml(alert)}</div>\n` : '';
  const fog = output.fog_score || {};
  const signals = output.signals || {};

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <title>SGSD Cockpit</title>',
    '  <style>',
    designSystemCss,
    '  </style>',
    '</head>',
    '<body>',
    '  <main class="sgsd-cockpit">',
    '    <section role="operator-decision" class="operator-decision">',
    `      <p class="eyebrow">${escapeHtml(northStarLine(output))}</p>`,
    `      <p class="do-next recommended-action">▸ DO NEXT: ${escapeHtml(recommendedAction(output.north_star && output.north_star.code))}</p>`,
    '    </section>',
    alertHtml.trimEnd(),
    '    <details class="supporting-block">',
    '      <summary>Supporting state</summary>',
    '      <dl>',
    `        <dt>Scope</dt><dd>${escapeHtml(output.milestone || 'null')}/${escapeHtml(output.phase || 'null')}</dd>`,
    `        <dt>Gate</dt><dd>${escapeHtml(output.binding_gate_status || 'null')}</dd>`,
    `        <dt>Fog</dt><dd>${escapeHtml(valueOr(fog.tier, 'n/a'))} / ${escapeHtml(valueOr(fog.score, 'n/a'))}</dd>`,
    `        <dt>Dispatches</dt><dd>${escapeHtml(valueOr(signals.dispatch_count, 'n/a'))}</dd>`,
    `        <dt>Latest chronicle</dt><dd>${escapeHtml(latestChroniclePath(output))}</dd>`,
    '      </dl>',
    '    </details>',
    '  </main>',
    '</body>',
    '</html>'
  ].filter((line) => line !== '').join('\n');
}

function renderShell(opts) {
  void opts;
  // P139.5: re-read CSS on every call so live edits to sgsd-design-system.css
  // show up without restarting serve.cjs.
  designSystemCss = loadDesignSystemCss();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SGSD Cockpit · Mission Control</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&family=Big+Shoulders+Display:wght@500;700;800;900&display=swap">
<style>
${designSystemCss}
</style>
</head>
<body>
<main class="sgsd-cockpit">

  <header class="chrome" data-region="chrome">
    <span class="crumb"><b data-source="host">localhost:7777</b></span>
    <span class="div">·</span>
    <span class="crumb"><b>cockpit</b></span>
    <span class="div">·</span>
    <span class="crumb"><b data-source="build">v3.4</b></span>
    <span class="div">·</span>
    <span class="crumb chrome-phase" data-source="phase">no active phase</span>
    <span class="spacer"></span>
    <span class="sse" data-conn="state-wrap"><span class="dot"></span><span data-conn="state">SSE PENDING</span></span>
    <span class="kbd">
      hotkeys
      <kbd>A</kbd><span>approve</span>
      <kbd>P</kbd><span>pause</span>
      <kbd>O</kbd><span>open</span>
      <kbd>Esc</kbd><span>abort</span>
    </span>
  </header>

  <section class="command" data-region="command" data-source="command" aria-label="Command strip"></section>

  <section class="scanbar" data-region="scanbar" data-source="scanbar"
           aria-label="ScanBar — 5 second answer panel"></section>

  <nav class="sec-nav" data-region="sec-nav" aria-label="Section navigation"></nav>

  <section id="sec-mission"      data-source="mission"      data-band="1"   class="ia-section band band-1"  aria-label="Mission"></section>
  <section id="sec-telemetry"    data-source="telemetry"    data-band="2"   class="ia-section band band-2"  aria-label="Telemetry"></section>
  <section id="sec-architecture" data-source="architecture" data-band="3"   class="ia-section band band-3"  aria-label="Architecture" style="display:none"></section>
  <section id="sec-milestone"    data-source="milestone"                    class="ia-section"              aria-label="Milestone"></section>
  <section id="sec-memory"       data-source="memory"                       class="ia-section"              aria-label="Memory"></section>
  <section id="sec-evidence"     data-source="evidence"                     class="ia-section"              aria-label="Evidence"></section>
  <section id="sec-events"       data-source="events"                       class="ia-section"              aria-label="Events"></section>

  <aside class="bottom-drawer" data-region="bottom" data-source="bottom"></aside>

</main>
<script src="/client.js" defer></script>
</body>
</html>`;
}

module.exports = {
  renderHtml,
  renderShell,
  escapeHtml,
};
