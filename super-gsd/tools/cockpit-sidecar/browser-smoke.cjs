#!/usr/bin/env node
'use strict';

// ============================================================================
// browser-smoke.cjs — mechanical liveness probe for the cockpit.
//
// MISSION: NEVER let a UI phase claim PASS without proving the cockpit
// actually boots, serves, and emits SSE frames in a real browser-style HTTP
// session. Source-grep SACs proved their own failure mode on 2026-05-24 when
// P136/P137/P138 shipped a visually-broken cockpit through a 79/79 self-test.
//
// WHAT THIS GATE DOES (binding contract):
//   1. Spawn `serve.cjs --port <ephemeral>` in a child process.
//   2. Poll /snapshot for HTTP 200 (server-healthy).
//   3. GET /            → HTML response, must start with <!doctype html>,
//                         must contain the v3.4 chrome class names, must
//                         resolve --page to #F6F7F4.
//   4. GET /client.js   → must parse as JavaScript without syntax error.
//   5. GET /snapshot    → must be valid JSON.
//   6. Hold open /events for 18s → must receive at least one ': keep-alive'
//      line within 16s (proves 15s ping contract).
//   7. Save the rendered HTML to .planning/runtime/cockpit-smoke-<phase>.html
//      so a human can open it directly to verify visually.
//   8. Tear down the server cleanly.
//
// USAGE:
//   node browser-smoke.cjs --phase 138 [--workspace .] [--timeout-sec 25]
//
// EXIT:
//   0 = all checks PASS (gate green; phase close permitted)
//   1 = any check FAIL (gate red; phase MUST NOT close)
//   2 = test infrastructure failure (couldn't even start server)
// ============================================================================

const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function parseArgs(argv) {
  const out = { phase: null, workspace: process.cwd(), timeoutSec: 25 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--phase') out.phase = argv[++i];
    else if (a === '--workspace') out.workspace = argv[++i];
    else if (a === '--timeout-sec') out.timeoutSec = parseInt(argv[++i], 10);
  }
  if (!out.phase) {
    console.error('FATAL: --phase required (e.g. --phase 138)');
    process.exit(2);
  }
  return out;
}

function getEphemeralPort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

function httpGet(port, urlPath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: urlPath, timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('timeout', () => req.destroy(new Error('http timeout')));
    req.on('error', reject);
  });
}

async function waitForHealthy(port, deadlineMs) {
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    try {
      const r = await httpGet(port, '/snapshot', 1500);
      if (r.statusCode === 200) return true;
    } catch (_e) { /* not ready yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function streamEvents(port, holdMs) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/events', timeout: holdMs + 5000 });
    const lines = [];
    let keepalives = 0;
    let firstKeepaliveMs = null;
    const startedAt = Date.now();
    req.on('response', (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        const fragments = chunk.split(/\r?\n/);
        for (const frag of fragments) {
          if (frag.startsWith(': keep-alive')) {
            keepalives += 1;
            if (firstKeepaliveMs == null) firstKeepaliveMs = Date.now() - startedAt;
          }
          if (frag) lines.push(frag.slice(0, 200));
        }
      });
    });
    req.on('error', () => { /* tolerated; reflected in results */ });
    setTimeout(() => {
      try { req.destroy(); } catch (_e) { /* ignore */ }
      resolve({ keepalives, firstKeepaliveMs, sampleLines: lines.slice(0, 8) });
    }, holdMs);
  });
}

function classifyJsParse(source) {
  try {
    // Function constructor catches syntax errors without executing the IIFE body.
    new Function(source);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e && e.message ? e.message : e) };
  }
}

async function run() {
  const args = parseArgs(process.argv);
  const workspace = path.resolve(args.workspace);
  const serveScript = path.join(workspace, 'super-gsd', 'tools', 'cockpit-sidecar', 'serve.cjs');
  const runtimeDir = path.join(workspace, '.planning', 'runtime');
  if (!fs.existsSync(serveScript)) {
    console.error(`FATAL: serve.cjs not found at ${serveScript}`);
    process.exit(2);
  }
  if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });

  const port = await getEphemeralPort();
  console.log(`[smoke] ephemeral port ${port}`);

  // P143.3: 'smoke-only' tells serve.cjs to skip pidfile (browser-smoke is
  // ephemeral and doesn't read it) AND fall back to legacy fixed-path
  // watchers (skip recursive .planning/ watch). Tests in run-self-test.cjs
  // set COCKPIT_SMOKE=test so they keep the pidfile but still skip recursive.
  const env = Object.assign({}, process.env, { COCKPIT_SMOKE: 'smoke-only' });
  const child = spawn(process.execPath, [serveScript, '--port', String(port), '--workspace', workspace], {
    cwd: workspace,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const childOut = [];
  const childErr = [];
  child.stdout.on('data', (d) => childOut.push(d.toString()));
  child.stderr.on('data', (d) => childErr.push(d.toString()));

  const results = {
    phase: args.phase,
    port,
    timestamp: new Date().toISOString(),
    checks: {},
    verdict: 'PENDING',
  };

  const cleanup = () => {
    try { child.kill('SIGTERM'); } catch (_e) { /* ignore */ }
    setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (_e) { /* ignore */ }
    }, 1000).unref();
  };

  try {
    const healthy = await waitForHealthy(port, args.timeoutSec * 1000);
    results.checks.server_healthy = healthy
      ? { ok: true, detail: 'server responded HTTP 200 on /snapshot' }
      : { ok: false, detail: 'server never returned HTTP 200 in ' + args.timeoutSec + 's', stderr: childErr.join('').slice(-500) };
    if (!healthy) throw new Error('server_unhealthy');

    const root = await httpGet(port, '/', 5000);
    results.checks.root_html_status = { ok: root.statusCode === 200, detail: `HTTP ${root.statusCode}` };
    results.checks.root_html_doctype = { ok: root.body.toLowerCase().startsWith('<!doctype html>'), detail: root.body.slice(0, 40) };
    results.checks.root_html_chrome_class = { ok: root.body.includes('class="chrome"'), detail: 'expected class="chrome" header' };
    results.checks.root_html_scanbar = { ok: root.body.includes('class="scanbar"') || root.body.includes('data-region="scanbar"'), detail: 'expected scanbar region' };
    results.checks.root_html_data_conn = { ok: root.body.includes('data-conn="state"'), detail: 'expected data-conn="state" placeholder' };
    results.checks.root_html_seven_sections = (function () {
      const ids = ['sec-mission','sec-telemetry','sec-architecture','sec-milestone','sec-memory','sec-evidence','sec-events'];
      const missing = ids.filter((id) => !root.body.includes(`id="${id}"`));
      return missing.length === 0
        ? { ok: true, detail: 'all 7 sections present' }
        : { ok: false, detail: 'missing sections: ' + missing.join(',') };
    })();
    results.checks.root_html_font_links = (function () {
      const wanted = ['IBM+Plex+Sans', 'IBM+Plex+Mono', 'Big+Shoulders+Display'];
      const missing = wanted.filter((f) => !root.body.includes(f));
      return missing.length === 0
        ? { ok: true, detail: 'all 3 font links present' }
        : { ok: false, detail: 'missing fonts: ' + missing.join(',') };
    })();
    results.checks.root_html_inline_light_palette = { ok: root.body.includes('--page: #F6F7F4'), detail: 'inline style must declare --page: #F6F7F4' };
    results.checks.root_html_no_dark_gradient = { ok: !/body\s*\{[\s\S]{1,400}linear-gradient\([\s\S]{1,200}#08101c/.test(root.body), detail: 'body must NOT carry dark navy gradient #08101c' };

    const clientJs = await httpGet(port, '/client.js', 5000);
    results.checks.client_js_status = { ok: clientJs.statusCode === 200, detail: `HTTP ${clientJs.statusCode}` };
    results.checks.client_js_parses = classifyJsParse(clientJs.body);
    results.checks.client_js_connstate = { ok: clientJs.body.includes('connState'), detail: 'client.js must contain connState reconnect module' };
    results.checks.client_js_renderers = (function () {
      const wanted = ['renderChrome', 'renderCommandStrip', 'renderScanBar', 'renderSecNav'];
      const missing = wanted.filter((fn) => !clientJs.body.includes(`function ${fn}`));
      return missing.length === 0
        ? { ok: true, detail: 'all 4 chrome renderers present' }
        : { ok: false, detail: 'missing: ' + missing.join(',') };
    })();

    const snapshot = await httpGet(port, '/snapshot', 5000);
    results.checks.snapshot_status = { ok: snapshot.statusCode === 200, detail: `HTTP ${snapshot.statusCode}` };
    results.checks.snapshot_json = (function () {
      try {
        const obj = JSON.parse(snapshot.body);
        return { ok: typeof obj === 'object' && obj !== null, detail: `keys: ${Object.keys(obj).length}` };
      } catch (e) {
        return { ok: false, detail: 'snapshot is not valid JSON: ' + String(e && e.message ? e.message : e) };
      }
    })();

    console.log('[smoke] holding /events open for 20s to count keep-alive pings...');
    const evt = await streamEvents(port, 20000);
    results.checks.sse_keepalive_count = { ok: evt.keepalives >= 1, detail: `${evt.keepalives} keep-alive line(s) in 20s window` };
    results.checks.sse_first_keepalive_in_18s = {
      // P143.2: bumped 16000→18000 after recursive fs.watch added — event loop
      // can lag heartbeat by ~1-2s under live-watch load. 18s still well under
      // the 30s 'SSE silence = dead' threshold the cockpit uses.
      ok: evt.firstKeepaliveMs != null && evt.firstKeepaliveMs <= 18000,
      detail: evt.firstKeepaliveMs != null ? `first keep-alive at +${evt.firstKeepaliveMs}ms` : 'no keep-alive in 20s window',
    };
    results.sse_sample_lines = evt.sampleLines;

    const htmlArtifact = path.join(runtimeDir, `cockpit-smoke-${args.phase}.html`);
    fs.writeFileSync(htmlArtifact, root.body, 'utf8');
    results.html_artifact = htmlArtifact;
    console.log(`[smoke] saved rendered HTML for human inspection: ${htmlArtifact}`);
  } catch (e) {
    if (!results.checks.fatal) {
      results.checks.fatal = { ok: false, detail: 'smoke run threw: ' + String(e && e.message ? e.message : e) };
    }
  } finally {
    cleanup();
  }

  results.verdict = Object.values(results.checks).every((c) => c.ok) ? 'PASS' : 'FAIL';
  const summary = Object.entries(results.checks).map(([k, v]) => `${v.ok ? '✓' : '✗'} ${k}: ${v.detail}`);

  const verdictPath = path.join(path.dirname(results.html_artifact || path.join(runtimeDir, 'placeholder')), `cockpit-smoke-${args.phase}-verdict.json`);
  fs.writeFileSync(verdictPath, JSON.stringify(results, null, 2), 'utf8');

  console.log(`\n[smoke] phase ${args.phase} verdict: ${results.verdict}`);
  for (const line of summary) console.log('  ' + line);
  console.log(`\n[smoke] verdict written to ${verdictPath}`);

  process.exit(results.verdict === 'PASS' ? 0 : 1);
}

run().catch((e) => {
  console.error('[smoke] FATAL:', e);
  process.exit(2);
});
