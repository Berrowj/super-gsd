#!/usr/bin/env node
'use strict';
// P142.8 — Responsive cockpit audit. Renders the cockpit at 4 viewport widths
// via JSDOM, inspects for overflow / clipping / asymmetric boxes, and reports
// findings. Output is structured FAIL lines for the next fix iteration.
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { JSDOM } = require(path.join(__dirname, '..', '..', 'super-gsd', 'tools', 'plan-schema', 'node_modules', 'jsdom'));

const VIEWPORTS = [
  { name: 'narrow',  width: 480,  height: 800 },
  { name: 'tablet',  width: 800,  height: 1024 },
  { name: 'laptop',  width: 1280, height: 800 },
  { name: 'ultra',   width: 1920, height: 1200 },
];

function ephemeralPort() {
  return new Promise((res, rej) => {
    const s = net.createServer(); s.unref();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}
function get(port, p) {
  return new Promise((res, rej) => {
    const req = http.get({ host: '127.0.0.1', port, path: p, timeout: 4000 }, r => {
      const c = []; r.on('data', x => c.push(x));
      r.on('end', () => res({ status: r.statusCode, body: Buffer.concat(c).toString('utf8') }));
    });
    req.on('error', rej); req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}
async function waitHealthy(port, deadlineMs) {
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    try { const r = await get(port, '/snapshot'); if (r.status === 200) return true; } catch(_){}
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

async function renderAtViewport(shell, snapJson, clientJs, snap, port, viewport) {
  const dom = new JSDOM(shell, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'http://127.0.0.1:' + port + '/',
  });
  const win = dom.window;
  // Set viewport
  Object.defineProperty(win, 'innerWidth', { value: viewport.width, configurable: true });
  Object.defineProperty(win, 'innerHeight', { value: viewport.height, configurable: true });
  Object.defineProperty(win.document.documentElement, 'clientWidth', { value: viewport.width, configurable: true });
  Object.defineProperty(win.document.documentElement, 'clientHeight', { value: viewport.height, configurable: true });
  win.fetch = function () { return Promise.resolve({ ok: true, json: () => Promise.resolve(snap), text: () => Promise.resolve(snapJson) }); };
  win.EventSource = function () {
    const self = this;
    setTimeout(function () {
      if (typeof self.onopen === 'function') self.onopen({});
      if (typeof self.onmessage === 'function') self.onmessage({ data: snapJson });
    }, 0);
    this.close = function () {};
  };
  win.eval(clientJs);
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
  await new Promise(function (r) { setTimeout(r, 700); });
  return { dom, win };
}

function inspectViewport(dom, viewport) {
  const findings = [];
  const doc = dom.window.document;
  // Find any element with class="*" that has potentially-overflowing children
  // JSDOM doesn't fully layout, so we approximate by checking:
  // - Number of grid columns × min-width vs viewport width (forced overflow)
  // - Text content length × char width vs container width
  // - Hardcoded SVG min-width vs viewport

  // SVG hardcoded widths
  const svgs = doc.querySelectorAll('svg.arch-svg, svg.mem-svg, svg.ms-svg');
  svgs.forEach(function (svg) {
    const vb = svg.getAttribute('viewBox') || '';
    const cls = svg.getAttribute('class') || '';
    // Check CSS rule for min-width via inline css read of the inline <style>
    const styleText = doc.querySelector('style') ? doc.querySelector('style').textContent : '';
    const minWidthMatch = styleText.match(new RegExp('\\\\.' + cls.replace(/\\s+.*/, '') + '[^}]*min-width:\\s*(\\d+)px', 'i'));
    const minW = minWidthMatch ? parseInt(minWidthMatch[1], 10) : null;
    if (minW && minW > viewport.width) {
      findings.push(`[${viewport.name} ${viewport.width}px] SVG .${cls} has min-width:${minW}px > viewport — horizontal scroll`);
    }
  });

  // Grids with explicit repeat(N, 1fr) that overflow narrow viewports.
  // Skip grids that have a @media override at a smaller breakpoint —
  // those are intentionally responsive.
  const styleText = doc.querySelector('style') ? doc.querySelector('style').textContent : '';
  const gridRules = [...styleText.matchAll(/\.([\w-]+)\s*\{[^}]*grid-template-columns:\s*repeat\((\d+),\s*1fr\)/g)];
  for (const [, cls, nStr] of gridRules) {
    const n = parseInt(nStr, 10);
    const els = doc.querySelectorAll('.' + cls);
    if (!els.length) continue;
    // Skip if there's a @media rule that overrides this class at a smaller breakpoint
    const hasResponsiveOverride = new RegExp('@media[^{]*\\(max-width:\\s*(?:600|900|1100)px\\)[\\s\\S]*?\\.' + cls + '[^{}]*\\{[^}]*grid-template-columns', 'i').test(styleText);
    if (hasResponsiveOverride) continue;
    const minRequired = n * 150;
    if (minRequired > viewport.width && viewport.width < 900) {
      findings.push(`[${viewport.name} ${viewport.width}px] .${cls} grid (${n} cols × 150px min) requires ~${minRequired}px > viewport — cells will crush (no @media override)`);
    }
  }

  // Long text in narrow containers — only flag if overflow-wrap NOT applied.
  // We approximate by checking if the class has overflow-wrap:anywhere in CSS.
  const fixedWidthBoxes = ['.mc-id-block', '.mc-title-block', '.stage-cell', '.ev-stage', '.telem-cell', '.evidence-card', '.memory-card', '.ms-cell', '.ms-phase', '.scan-cell', '.cmd-cell'];
  fixedWidthBoxes.forEach(function (sel) {
    const cls = sel.slice(1);
    // Check whether overflow-wrap or word-break is declared on this class
    // or any descendant text-class. Approximate by searching the stylesheet.
    const hasOverflowGuard = new RegExp('(?:^|,|\\s)\\.' + cls + '(?:[\\s,{]|$)[^}]*overflow-wrap|overflow:\\s*hidden', 'i').test(styleText) ||
                              styleText.indexOf(cls + ',') !== -1 && /overflow-wrap:\s*anywhere/.test(styleText);
    if (hasOverflowGuard) return; // covered
    doc.querySelectorAll(sel).forEach(function (el, i) {
      const text = el.textContent.trim();
      if (text.length > 120 && viewport.width < 900) {
        findings.push(`[${viewport.name} ${viewport.width}px] ${sel}[${i}] has ${text.length} chars (no overflow guard in CSS)`);
      }
    });
  });

  // Asymmetry: only flag genuinely asymmetric grids. .ms-phase and .ev-stage
  // children vary by tier/status class, but the prefix is consistent — that's
  // by design. So count CLASS PREFIXES (first space-separated token) only.
  const gridContainers = ['.telem', '.runway-stops', '.ev-stages', '.evidence-cards', '.milestone-phases'];
  gridContainers.forEach(function (sel) {
    const els = doc.querySelectorAll(sel);
    els.forEach(function (el, i) {
      const kids = el.children.length;
      if (kids === 0) return;
      const tags = [].slice.call(el.children).map(function (c) {
        const firstClass = ((c.className || '').split(/\s+/)[0]) || '';
        return c.tagName + ':' + firstClass;
      });
      const uniqueTags = [...new Set(tags)];
      // Allow ≤2 tag types (e.g. card + arrow). Flag only when >2 different
      // structural shapes appear in the same grid.
      if (uniqueTags.length > 2) {
        findings.push(`[${viewport.name} ${viewport.width}px] ${sel}[${i}] has ${uniqueTags.length} structurally-different children: ${uniqueTags.join(' | ')}`);
      }
    });
  });

  return findings;
}

async function main() {
  const port = await ephemeralPort();
  const workspace = process.cwd();
  const child = spawn(process.execPath, ['super-gsd/tools/cockpit-sidecar/serve.cjs', '--port', String(port), '--workspace', workspace], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const healthy = await waitHealthy(port, 20000);
    if (!healthy) { console.log('FAIL server_unhealthy'); process.exit(1); }
    const shell = (await get(port, '/')).body;
    const snapJson = (await get(port, '/snapshot')).body;
    const clientJs = (await get(port, '/client.js')).body;
    const snap = JSON.parse(snapJson);

    const allFindings = [];
    for (const v of VIEWPORTS) {
      const { dom } = await renderAtViewport(shell, snapJson, clientJs, snap, port, v);
      const findings = inspectViewport(dom, v);
      console.log('=== ' + v.name + ' (' + v.width + '×' + v.height + ') ===');
      if (findings.length === 0) {
        console.log('  ✓ no responsive issues found');
      } else {
        findings.forEach(function (f) { console.log('  ✗ ' + f); allFindings.push(f); });
      }
    }
    fs.writeFileSync('.planning/runtime/responsive-audit-findings.json', JSON.stringify({ findings: allFindings, viewports: VIEWPORTS }, null, 2));
    console.log('\nTotal findings: ' + allFindings.length);
    console.log('Saved to .planning/runtime/responsive-audit-findings.json');
    process.exit(allFindings.length === 0 ? 0 : 1);
  } finally {
    try { child.kill('SIGTERM'); } catch(_){}
  }
}
main().catch(function (e) { console.error(e); process.exit(2); });
