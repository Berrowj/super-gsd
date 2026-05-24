const fs = require('fs');
const path = require('path');

const designSystemCss = (() => {
  try { return fs.readFileSync(path.join(__dirname, '..', 'shared', 'sgsd-design-system.css'), 'utf8'); } catch (_e) { return ''; }
})();

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

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SGSD Cockpit</title>
<style>
${designSystemCss}
</style>
</head>
<body>
<main class="sgsd-cockpit">
<section data-band="1" class="band band-1" aria-label="Band 1"></section>
<section data-band="2" class="band band-2" aria-label="Band 2"></section>
<section data-band="3" class="band band-3" aria-label="Band 3" style="display:none"></section>
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
