#!/usr/bin/env node
'use strict';
// Iterative visual validator: spawn serve.cjs, fetch shell + snapshot + client.js,
// render in JSDOM, then run a battery of structural+visual assertions against the
// design-pack reference. Emits FAIL lines for the next fix iteration.
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { JSDOM } = require(path.join(__dirname, '..', '..', 'super-gsd', 'tools', 'plan-schema', 'node_modules', 'jsdom'));

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

    const dom = new JSDOM(shell, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://127.0.0.1:' + port + '/' });
    const win = dom.window;
    win.fetch = function () { return Promise.resolve({ ok: true, status: 200, json: function() { return Promise.resolve(snap); }, text: function() { return Promise.resolve(snapJson); } }); };
    win.EventSource = function () {
      var self = this;
      setTimeout(function () {
        if (typeof self.onopen === 'function') self.onopen({});
        if (typeof self.onmessage === 'function') self.onmessage({ data: snapJson });
      }, 0);
      this.close = function () {};
    };
    win.eval(clientJs);
    win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
    await new Promise(r => setTimeout(r, 500));

    const doc = win.document;
    const fails = [];
    const pass = [];
    function check(name, cond, detail) {
      if (cond) pass.push(name);
      else fails.push(name + ' :: ' + (detail || ''));
    }

    // Chrome
    check('chrome present', doc.querySelector('.chrome') != null);
    check('chrome shows phase', /v\d+\.\d+.*P\d+/.test((doc.querySelector('.chrome') || {}).textContent || ''));
    const connSpan = doc.querySelector('[data-conn="state"]');
    check('SSE LIVE badge', /SSE LIVE/.test(connSpan ? connSpan.textContent : ''));

    // Command strip
    check('command strip present', doc.querySelector('.command, .command-strip') != null);
    check('cmd-obj cell', doc.querySelector('.cmd-cell.cmd-obj') != null);
    check('cmd-next cell', doc.querySelector('.cmd-cell.cmd-next') != null);
    check('cmd-owner cell', doc.querySelector('.cmd-cell.cmd-owner') != null);
    check('cmd-risk cell', doc.querySelector('.cmd-cell.cmd-risk') != null);

    // ScanBar
    check('scanbar present', doc.querySelector('.scanbar') != null);
    const scanCells = doc.querySelectorAll('.scan-cell');
    check('scanbar has 6 cells', scanCells.length === 6, 'got ' + scanCells.length);

    // sec-nav
    check('sec-nav present', doc.querySelector('.sec-nav') != null || doc.querySelector('[data-region="sec-nav"]') != null);
    const navLinks = doc.querySelectorAll('.sec-nav-link');
    check('sec-nav has 7 links', navLinks.length === 7, 'got ' + navLinks.length);

    // sec-mission body
    const secMission = doc.getElementById('sec-mission');
    check('sec-mission has content', secMission && secMission.innerHTML.length > 100);
    check('mission-card present', doc.querySelector('.mission-card') != null);
    check('mc-head present', doc.querySelector('.mc-head') != null);
    const mcId = doc.querySelector('.mc-id');
    check('mc-id non-empty', mcId && mcId.textContent.trim() !== '' && mcId.textContent.trim() !== '—');
    const mcTitle = doc.querySelector('.mc-title');
    check('mc-title non-empty', mcTitle && mcTitle.textContent.trim() !== '');
    const mcObj = doc.querySelector('.mc-objective');
    check('mc-objective non-empty', mcObj && mcObj.textContent.trim() !== '' && mcObj.textContent.trim() !== 'no objective');
    check('mc-body present', doc.querySelector('.mc-body') != null);
    check('runway present', doc.querySelector('.runway') != null);
    check('runway-rail present', doc.querySelector('.runway-rail') != null);
    check('runway-track present', doc.querySelector('.runway-track') != null);
    const stops = doc.querySelectorAll('.stop');
    check('runway has 5 stops', stops.length === 5, 'got ' + stops.length);
    check('agents present', doc.querySelector('.agents') != null);
    const lanes = doc.querySelectorAll('.agent-lane');
    check('agents has 2 lanes', lanes.length === 2, 'got ' + lanes.length);
    check('handoff present', doc.querySelector('.handoff') != null);

    // sec-telemetry body
    const secTel = doc.getElementById('sec-telemetry');
    check('sec-telemetry has content', secTel && secTel.innerHTML.length > 100);
    check('telem container present', doc.querySelector('.telem') != null);
    const cells = doc.querySelectorAll('.telem-cell');
    check('telem has 5 cells', cells.length === 5, 'got ' + cells.length);
    const sparks = doc.querySelectorAll('.telem-spark');
    check('telem has 5 sparklines', sparks.length === 5, 'got ' + sparks.length);

    // Data sanity
    check('snap.milestone present', !!snap.milestone);
    check('snap.phase present', snap.phase != null);
    check('snap.mission.phase_id non-empty', !!(snap.mission && snap.mission.phase_id));
    check('snap.mission.phase_title non-empty', !!(snap.mission && snap.mission.phase_title));
    check('snap.mission.objective non-empty', !!(snap.mission && snap.mission.objective));
    check('snap.pipeline.stages.length === 5', !!(snap.pipeline && snap.pipeline.stages && snap.pipeline.stages.length === 5));
    check('snap.telemetry.fog present', !!(snap.telemetry && snap.telemetry.fog));
    check('snap._sources.mission tier', !!(snap._sources && snap._sources.mission && snap._sources.mission.tier));

    console.log('=== VISUAL VALIDATE ===');
    console.log('PASS:', pass.length);
    console.log('FAIL:', fails.length);
    for (const f of fails) console.log('  X', f);
    fs.writeFileSync('.planning/runtime/cockpit-rendered.html', dom.serialize());
    console.log('rendered DOM saved: .planning/runtime/cockpit-rendered.html');
    process.exit(fails.length === 0 ? 0 : 1);
  } finally {
    try { child.kill('SIGTERM'); } catch(_){}
  }
}
main().catch(function (e) { console.error(e); process.exit(2); });
