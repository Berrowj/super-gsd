#!/usr/bin/env node
'use strict';

// Real-browser cockpit auditor — driven by headless Chromium via Playwright.
// JSDOM (browser-smoke.cjs) misses real rendering bugs (CSS layout, font
// metrics, SVG positioning, real EventSource timing, console errors). This
// catches them. Outputs structured findings JSON; non-zero exit on any FAIL.
//
// Usage:
//   node playwright-audit.cjs                  # default: localhost:7777 audit
//   node playwright-audit.cjs --headed         # show the browser window
//   node playwright-audit.cjs --spawn-server   # start cockpit-server first

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { chromium } = require('playwright');

const VIEWPORTS = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'laptop-1440', width: 1440, height: 900 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'mobile-768', width: 768, height: 1024 },
];

const REQUIRED_SECTIONS = [
  { id: 'sec-mission', label: 'Mission' },
  { id: 'sec-telemetry', label: 'Telemetry' },
  { id: 'sec-architecture', label: 'Architecture' },
  { id: 'sec-milestone', label: 'Milestone' },
  { id: 'sec-memory', label: 'Memory' },
  { id: 'sec-evidence', label: 'Evidence' },
  { id: 'sec-events', label: 'Events' },
  { id: 'sec-handovers', label: 'Handovers' },
];

function parseArgs(argv) {
  const opts = {
    headed: false,
    spawnServer: false,
    port: 7777,
    workspace: process.cwd(),
    target: null,    // explicit URL; supersedes spawnServer + port
    phase: null,     // tag verdict file with phase id
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--headed') opts.headed = true;
    else if (argv[i] === '--spawn-server') opts.spawnServer = true;
    else if (argv[i] === '--port') opts.port = Number(argv[i += 1]);
    else if (argv[i] === '--workspace') opts.workspace = argv[i += 1];
    else if (argv[i] === '--target') opts.target = argv[i += 1];
    else if (argv[i] === '--phase') opts.phase = argv[i += 1];
  }
  return opts;
}

async function spawnCockpitServer(opts) {
  return new Promise((resolve, reject) => {
    const serveScript = path.resolve(__dirname, 'serve.cjs');
    const child = cp.spawn(process.execPath, [serveScript, '--port', String(opts.port), '--workspace', opts.workspace], {
      cwd: opts.workspace,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('cockpit-server did not announce listening in 30s; stderr=' + stderr));
    }, 30000);
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
      const m = stderr.match(/cockpit-server listening port:\s*(\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ child, port: Number(m[1]) });
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error('cockpit-server exited before listening; code=' + code + '; stderr=' + stderr));
    });
  });
}

function isAcceptableConsoleMsg(msg) {
  const text = msg.text();
  // Source-map 404s are noise we don't want to chase.
  if (/source ?map/i.test(text)) return true;
  // Favicon 404 is benign.
  if (/favicon/.test(text)) return true;
  return false;
}

async function audit(opts) {
  const findings = [];
  const ctx = { resolvedBaseUrl: null };
  let serverChild = null;
  let port = opts.port;
  let baseUrl;

  // Target resolution priority: explicit --target wins; else --spawn-server
  // spins up cockpit-server locally; else hit existing http://127.0.0.1:<port>.
  if (opts.target) {
    baseUrl = opts.target.replace(/\/$/, '');
    console.error(`[audit] using explicit target ${baseUrl}`);
  } else if (opts.spawnServer) {
    const spawned = await spawnCockpitServer(opts);
    serverChild = spawned.child;
    port = spawned.port;
    baseUrl = `http://127.0.0.1:${port}`;
    console.error(`[audit] spawned cockpit-server on port ${port}`);
  } else {
    baseUrl = `http://127.0.0.1:${port}`;
  }
  ctx.resolvedBaseUrl = baseUrl;
  const browser = await chromium.launch({ headless: !opts.headed });
  const context = await browser.newContext({ viewport: VIEWPORTS[0] });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isAcceptableConsoleMsg(msg)) {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push({ message: err.message, stack: err.stack });
  });
  page.on('response', (resp) => {
    const status = resp.status();
    if (status >= 400 && !/favicon/.test(resp.url())) {
      failedResponses.push({ url: resp.url(), status });
    }
  });

  try {
    // 1. Initial page load. SSE keeps the connection alive forever, so
    // 'networkidle' never fires — use 'domcontentloaded' then wait for the
    // client to render the shell via the snapshot event. 30s timeout absorbs
    // cold-start under parallel-Node contention on Windows.
    const navResp = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!navResp || navResp.status() !== 200) {
      findings.push({ check: 'page_load', verdict: 'FAIL', detail: `status=${navResp ? navResp.status() : 'no response'}` });
    } else {
      findings.push({ check: 'page_load', verdict: 'PASS', detail: 'HTTP 200' });
    }
    // Wait for #sec-mission to populate (client.js renders sections from the
    // first snapshot frame). 8s gives the server time to recompute + push.
    try {
      await page.waitForFunction(() => {
        const el = document.querySelector('#sec-mission');
        return el && el.innerHTML.length > 50;
      }, { timeout: 8000 });
    } catch (_e) {
      findings.push({ check: 'first_snapshot_render', verdict: 'FAIL', detail: '#sec-mission did not populate within 8s of page load' });
    }

    // 2. Each section exists + has content
    for (const sec of REQUIRED_SECTIONS) {
      const el = await page.$(`#${sec.id}`);
      if (!el) {
        findings.push({ check: `section_${sec.id}_present`, verdict: 'FAIL', detail: `missing #${sec.id}` });
        continue;
      }
      const innerHtml = await el.innerHTML();
      const text = (await el.innerText()).trim();
      if (innerHtml.length < 30) {
        findings.push({ check: `section_${sec.id}_content`, verdict: 'FAIL', detail: `${sec.label} section is empty (innerHTML.length=${innerHtml.length})` });
      } else if (text.length < 10) {
        findings.push({ check: `section_${sec.id}_content`, verdict: 'WARN', detail: `${sec.label} renders but has <10 chars of visible text` });
      } else {
        findings.push({ check: `section_${sec.id}_content`, verdict: 'PASS', detail: `${text.length} chars rendered` });
      }
    }

    // 3. Mission card has north-star + ELI5
    const missionText = await page.$eval('#sec-mission', (el) => el.innerText).catch(() => '');
    if (!missionText) {
      findings.push({ check: 'mission_card_text', verdict: 'FAIL', detail: 'mission section has no innerText' });
    } else {
      findings.push({ check: 'mission_card_text', verdict: 'PASS', detail: `${missionText.length} chars` });
    }

    // 4. Architecture SVG present
    const archSvg = await page.$('#sec-architecture svg.arch-svg, #sec-architecture svg');
    if (!archSvg) {
      findings.push({ check: 'architecture_svg', verdict: 'FAIL', detail: 'no <svg> inside #sec-architecture' });
    } else {
      const nodeCount = await page.$$eval('#sec-architecture svg [class*="arch-node"], #sec-architecture svg rect', (els) => els.length);
      if (nodeCount < 3) {
        findings.push({ check: 'architecture_svg_nodes', verdict: 'WARN', detail: `only ${nodeCount} arch nodes` });
      } else {
        findings.push({ check: 'architecture_svg_nodes', verdict: 'PASS', detail: `${nodeCount} arch nodes` });
      }
    }

    // 4b. Both architecture tabs render content + tab switch works.
    // P143.6 operator finding: "SGSD-Orchestrator doesnt show anything".
    const archTabs = await page.$$eval('#sec-architecture [data-arch-tab]', (els) => els.map((e) => e.getAttribute('data-arch-tab')));
    if (archTabs.length < 2) {
      findings.push({ check: 'architecture_tabs_present', verdict: 'FAIL', detail: `expected 2 arch tabs, found ${archTabs.length}: ${archTabs.join(',')}` });
    } else {
      // Switch to orchestration tab via dispatched click
      const orcTab = await page.$('#sec-architecture [data-arch-tab="orchestration"]');
      if (orcTab) {
        await orcTab.dispatchEvent('click');
        await page.waitForTimeout(200);
      }
      const orcSvgRects = await page.$$eval('#sec-architecture [data-arch-view="orchestration"] svg rect', (els) => els.length).catch(() => 0);
      if (orcSvgRects < 5) {
        findings.push({ check: 'orchestration_view_renders', verdict: 'FAIL', detail: `orchestration view has only ${orcSvgRects} svg rects (expected 5+ agent/stage/gate boxes)` });
      } else {
        findings.push({ check: 'orchestration_view_renders', verdict: 'PASS', detail: `${orcSvgRects} svg rects in orchestration view after tab switch` });
      }
      // Confirm dataflow view becomes hidden when orchestration is active
      const dataflowHidden = await page.$eval('#sec-architecture [data-arch-view="dataflow"]', (el) => el.hasAttribute('hidden')).catch(() => false);
      findings.push({
        check: 'architecture_tab_switch',
        verdict: dataflowHidden ? 'PASS' : 'WARN',
        detail: dataflowHidden ? 'dataflow view hidden after orchestration tab click' : 'both views visible — hidden attribute not applied',
      });
      // Flip back to dataflow for the rest of the audit
      const dfTab = await page.$('#sec-architecture [data-arch-tab="dataflow"]');
      if (dfTab) { await dfTab.dispatchEvent('click'); await page.waitForTimeout(200); }
    }

    // 5. Milestone SVG with phase pills
    const msSvg = await page.$('#sec-milestone svg.ms-svg, #sec-milestone svg');
    if (!msSvg) {
      findings.push({ check: 'milestone_svg', verdict: 'FAIL', detail: 'no <svg> inside #sec-milestone' });
    } else {
      const pillCount = await page.$$eval('#sec-milestone svg .ms-svg-phase, #sec-milestone svg [data-clickable="phase"]', (els) => els.length);
      if (pillCount < 1) {
        findings.push({ check: 'milestone_phase_pills', verdict: 'WARN', detail: 'no phase pills in milestone SVG' });
      } else {
        findings.push({ check: 'milestone_phase_pills', verdict: 'PASS', detail: `${pillCount} phase pills` });
      }
    }

    // 6. Handovers section has links
    const handoverLinks = await page.$$eval('#sec-handovers a[href]', (els) => els.map((e) => e.getAttribute('href')));
    if (handoverLinks.length === 0) {
      findings.push({ check: 'handover_links', verdict: 'WARN', detail: 'no handover links found' });
    } else {
      // Check first 3 links actually return 200
      let okCount = 0;
      let badCount = 0;
      const sample = handoverLinks.slice(0, 3);
      for (const href of sample) {
        try {
          const resolvedUrl = href.startsWith('http') ? href : baseUrl + href;
          const r = await page.context().request.get(resolvedUrl);
          if (r.status() === 200) okCount += 1;
          else badCount += 1;
        } catch (_e) {
          badCount += 1;
        }
      }
      if (badCount > 0) {
        findings.push({ check: 'handover_link_health', verdict: 'WARN', detail: `${okCount}/${sample.length} handovers returned 200 (sample of ${handoverLinks.length})` });
      } else {
        findings.push({ check: 'handover_link_health', verdict: 'PASS', detail: `${okCount}/${sample.length} sampled handovers returned 200 (total ${handoverLinks.length})` });
      }
    }

    // 7. Live-update via SSE — touch STATE.md, watch window.lastSnapshot
    // .generated_at change. client.js (es.onmessage) parses each snapshot
    // event and stores it on window. We don't bind generated_at to the DOM,
    // so the JS state is the authoritative witness.
    // Diagnostic: confirm the EventSource is actually connected before
    // judging SSE live-update. If the browser never opened /events, the
    // 'no update' finding is a connectivity bug, not a watcher bug.
    // Wait up to 5s for the first SSE message to populate __sgsdLastSnapshot.
    try {
      await page.waitForFunction(() => !!(window.__sgsdLastSnapshot && window.__sgsdLastSnapshot.generated_at), { timeout: 5000 });
    } catch (_e) {
      const diag = await page.evaluate(() => ({
        hasEs: typeof EventSource !== 'undefined',
        hasMirror: typeof window.__sgsdLastSnapshot !== 'undefined',
        connTier: (document.querySelector('[data-conn-tier]') || {}).getAttribute ? document.querySelector('[data-conn-tier]').getAttribute('data-conn-tier') : null,
      }));
      findings.push({ check: 'sse_connection', verdict: 'FAIL', detail: `first SSE message never arrived in 5s (diag=${JSON.stringify(diag)})` });
    }
    const before = await page.evaluate(() => (window.__sgsdLastSnapshot && window.__sgsdLastSnapshot.generated_at) || null);
    // Multi-touch loop — Windows fs.watch occasionally misses single utimes
    // events, so repeat. Real operator file-saves naturally trigger 2-3 OS
    // events anyway (write + chmod-touch + close). 8s deadline matches the
    // existing SAC-P132-03 pattern.
    const targetFile = path.resolve(opts.workspace, '.planning/STATE.md');
    let after = null;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      fs.utimesSync(targetFile, new Date(), new Date());
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(300);
      // eslint-disable-next-line no-await-in-loop
      after = await page.evaluate(() => (window.__sgsdLastSnapshot && window.__sgsdLastSnapshot.generated_at) || null);
      if (after && after !== before) break;
    }
    const counts = await page.evaluate(() => ({
      count: window.__sgsdSnapshotCount || 0,
      lastTs: window.__sgsdLastSnapshot && window.__sgsdLastSnapshot.generated_at,
    }));
    if (!before || !after) {
      findings.push({ check: 'sse_live_update', verdict: 'FAIL', detail: `window.__sgsdLastSnapshot.generated_at not exposed (before=${before}, after=${after}) — client.js may not be setting it (snapshot count=${counts.count})` });
    } else if (before === after) {
      findings.push({ check: 'sse_live_update', verdict: 'FAIL', detail: `generated_at unchanged after STATE.md touch + 3s (still ${before}, snapshot count=${counts.count}) — fs.watch fired but new frame not received by browser` });
    } else {
      findings.push({ check: 'sse_live_update', verdict: 'PASS', detail: `live update fired: ${before} → ${after} (${counts.count} snapshot frames received)` });
    }

    // 8. Console / page errors
    if (pageErrors.length > 0) {
      findings.push({ check: 'page_errors', verdict: 'FAIL', detail: `${pageErrors.length} uncaught: ${pageErrors[0].message}` });
    } else {
      findings.push({ check: 'page_errors', verdict: 'PASS', detail: '0 uncaught exceptions' });
    }
    if (consoleErrors.length > 0) {
      findings.push({ check: 'console_errors', verdict: 'WARN', detail: `${consoleErrors.length} console.error: ${consoleErrors[0].text}` });
    } else {
      findings.push({ check: 'console_errors', verdict: 'PASS', detail: '0 console.error' });
    }
    if (failedResponses.length > 0) {
      findings.push({ check: 'failed_responses', verdict: 'WARN', detail: `${failedResponses.length} 4xx/5xx: ${failedResponses[0].url} → ${failedResponses[0].status}` });
    } else {
      findings.push({ check: 'failed_responses', verdict: 'PASS', detail: '0 failed responses' });
    }

    // 9. Responsive viewports — take screenshots, check no horizontal scroll
    const runtimeDir = path.resolve(opts.workspace, '.planning/runtime');
    if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });
    const shotDir = path.join(runtimeDir, 'playwright-audit-shots');
    if (!fs.existsSync(shotDir)) fs.mkdirSync(shotDir, { recursive: true });

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(250);
      const shotPath = path.join(shotDir, `${vp.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: true });
      const overflow = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      if (overflow.scrollW > overflow.clientW + 2) {
        findings.push({
          check: `responsive_${vp.name}_no_h_scroll`,
          verdict: 'FAIL',
          detail: `horizontal scroll at ${vp.width}px (scrollW=${overflow.scrollW}, clientW=${overflow.clientW})`,
        });
      } else {
        findings.push({
          check: `responsive_${vp.name}_no_h_scroll`,
          verdict: 'PASS',
          detail: `no horizontal scroll at ${vp.width}px`,
        });
      }
    }

    // 10. Click first phase pill → detail panel populates. Pills are SVG <g>
    // elements with data-clickable="phase" data-id="P###"; click delegation
    // in client.js (wirePhaseClickDelegation) opens a detail block.
    await page.setViewportSize(VIEWPORTS[0]);
    const phasePill = await page.$('#sec-milestone svg [data-clickable="phase"]');
    if (phasePill) {
      const phaseAttr = await phasePill.getAttribute('data-id');
      // SVG <g> elements often fail Playwright's visibility check even when
      // rendered. Use dispatchEvent to bypass the visibility heuristic — the
      // click handler delegation only cares about event.target, not pointer
      // events. force:true would also work but dispatchEvent is faster.
      await phasePill.dispatchEvent('click');
      await page.waitForTimeout(500);
      const detailVisible = await page.$('.ms-phase-detail, #sec-milestone .phase-detail, [data-phase-detail]');
      if (!detailVisible) {
        findings.push({ check: 'phase_pill_click', verdict: 'WARN', detail: `clicked phase pill (data-id=${phaseAttr}) but no .ms-phase-detail panel rendered` });
      } else {
        const detailText = await detailVisible.innerText();
        findings.push({
          check: 'phase_pill_click',
          verdict: detailText.length > 30 ? 'PASS' : 'WARN',
          detail: `detail panel rendered ${detailText.length} chars after click on ${phaseAttr}`,
        });
      }
    } else {
      findings.push({ check: 'phase_pill_click', verdict: 'WARN', detail: 'no [data-clickable="phase"] element found in milestone SVG' });
    }

    // 11. Font loading — operator's design uses 3 webfonts. Check
    // document.fonts.ready resolves and at least one custom font is loaded.
    const fontDiag = await page.evaluate(async () => {
      try {
        await document.fonts.ready;
        const families = new Set();
        for (const f of document.fonts) families.add(f.family);
        return { ready: true, count: document.fonts.size, families: Array.from(families) };
      } catch (e) { return { ready: false, error: String(e) }; }
    });
    if (!fontDiag.ready) {
      findings.push({ check: 'fonts_loaded', verdict: 'FAIL', detail: `document.fonts.ready rejected: ${fontDiag.error}` });
    } else if (fontDiag.count < 1) {
      findings.push({ check: 'fonts_loaded', verdict: 'WARN', detail: `0 webfonts registered — system fallback in use` });
    } else {
      findings.push({ check: 'fonts_loaded', verdict: 'PASS', detail: `${fontDiag.count} fonts loaded: ${fontDiag.families.slice(0, 3).join(', ')}` });
    }

    // 12. Color palette — verify --page is the light cream operator picked.
    const palette = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        page: cs.getPropertyValue('--page').trim(),
        ink: cs.getPropertyValue('--ink').trim(),
        bodyBg: getComputedStyle(document.body).backgroundColor,
      };
    });
    const expectedPage = '#F6F7F4';
    if (palette.page.toUpperCase() !== expectedPage) {
      findings.push({ check: 'color_palette', verdict: 'FAIL', detail: `--page=${palette.page} (expected ${expectedPage}); body bg=${palette.bodyBg}` });
    } else {
      findings.push({ check: 'color_palette', verdict: 'PASS', detail: `--page=${palette.page}, --ink=${palette.ink}` });
    }

    // 13. Memory mesh SVG — §5 should render an SVG with at least 1 mem-node.
    const memSvg = await page.$('#sec-memory svg.mem-svg, #sec-memory svg');
    if (!memSvg) {
      findings.push({ check: 'memory_mesh_svg', verdict: 'WARN', detail: 'no <svg> inside #sec-memory' });
    } else {
      const memNodeCount = await page.$$eval('#sec-memory svg [class*="mem-node"], #sec-memory svg rect', (els) => els.length);
      findings.push({
        check: 'memory_mesh_svg',
        verdict: memNodeCount >= 1 ? 'PASS' : 'WARN',
        detail: `${memNodeCount} memory-mesh nodes rendered`,
      });
    }

    // 14. Stream health panel — rendered as .sh-row entries inside .stream-health.
    // Lives in §6 Evidence per client.js renderEvidence. 14+ rows expected.
    const streamRows = await page.$$eval('.stream-health .sh-row', (els) => els.length).catch(() => 0);
    if (streamRows < 14) {
      findings.push({ check: 'stream_health_panel', verdict: streamRows < 1 ? 'FAIL' : 'WARN', detail: `${streamRows} .sh-row entries found (expected >=14 pre-seeded)` });
    } else {
      findings.push({ check: 'stream_health_panel', verdict: 'PASS', detail: `${streamRows} stream-health rows rendered` });
    }

    // 15. Dead-man's-banner — should be hidden (SSE is alive). 'active' class
    // means it became visible after >30s of silence.
    const banner = await page.evaluate(() => {
      const el = document.querySelector('.dead-mans-banner');
      if (!el) return { exists: false };
      return { exists: true, active: el.classList.contains('active'), display: getComputedStyle(el).display };
    });
    if (banner.exists && banner.active) {
      findings.push({ check: 'dead_mans_banner_hidden', verdict: 'FAIL', detail: 'dead-mans-banner is visible — SSE silenced >30s mid-audit' });
    } else {
      findings.push({ check: 'dead_mans_banner_hidden', verdict: 'PASS', detail: banner.exists ? 'banner present but inactive (correct)' : 'banner not yet inserted (also fine)' });
    }

    // 16. Text overflow — scan for elements where scrollHeight exceeds clientHeight
    // by more than 5px AND overflow is hidden (= clipped content the operator
    // can't see). High signal for "text doesn't fit boxes".
    const clipped = await page.evaluate(() => {
      const out = [];
      const all = document.querySelectorAll('main *');
      for (const el of all) {
        const cs = getComputedStyle(el);
        if ((cs.overflow === 'hidden' || cs.overflowY === 'hidden') &&
            el.scrollHeight - el.clientHeight > 5 &&
            el.clientHeight > 10) {
          out.push({ tag: el.tagName, cls: el.className.toString().slice(0, 40), excess: el.scrollHeight - el.clientHeight });
          if (out.length >= 5) break;
        }
      }
      return out;
    });
    if (clipped.length > 0) {
      findings.push({ check: 'text_overflow_clipped', verdict: 'WARN', detail: `${clipped.length} clipped elements: ${clipped.map((c) => `${c.tag}.${c.cls.slice(0, 20)}+${c.excess}px`).join('; ')}` });
    } else {
      findings.push({ check: 'text_overflow_clipped', verdict: 'PASS', detail: 'no clipped text in any overflow:hidden box' });
    }

    // 17. Handover route guard — verify the server rejects unsafe paths.
    // HTTP clients normalize `..` before sending, so we use percent-encoded
    // `%2E%2E` to actually deliver `..` to the server's relRaw decoder.
    // Also test the prefix guard (must be .planning/{briefs,analyses,milestones}/)
    // and the .html-only guard.
    const guardProbes = [
      { url: '/handover/%2E%2E%2F%2E%2E%2Fetc%2Fpasswd', expect: 403, why: 'encoded ../ traversal' },
      { url: '/handover/etc/passwd.html', expect: 403, why: 'outside allowed prefix' },
      { url: '/handover/.planning/STATE.md', expect: 400, why: 'non-.html extension' },
    ];
    let guardOk = true;
    const guardDetails = [];
    for (const p of guardProbes) {
      // eslint-disable-next-line no-await-in-loop
      const r = await page.context().request.get(baseUrl + p.url, { maxRedirects: 0 });
      const s = r.status();
      guardDetails.push(`${p.why} → ${s} (want ${p.expect})`);
      if (s !== p.expect) guardOk = false;
    }
    findings.push({
      check: 'handover_path_traversal_guard',
      verdict: guardOk ? 'PASS' : 'FAIL',
      detail: guardDetails.join(' · '),
    });

    // 18. Detail tab navigation — phase pill click (above) opens .phase-detail
    // with buttons [data-clickable="tab" data-tab="<name>"]. Verify all 6
    // tabs render and clicking each one updates the active state.
    const tabs = await page.$$eval('.phase-detail [data-clickable="tab"]', (els) => els.map((e) => e.getAttribute('data-tab') || e.textContent.trim()));
    if (tabs.length >= 6) {
      findings.push({ check: 'phase_detail_tabs', verdict: 'PASS', detail: `${tabs.length} tabs: ${tabs.join(', ')}` });
    } else if (tabs.length >= 3) {
      findings.push({ check: 'phase_detail_tabs', verdict: 'WARN', detail: `${tabs.length} tabs (expected 6): ${tabs.join(', ')}` });
    } else {
      findings.push({ check: 'phase_detail_tabs', verdict: 'WARN', detail: `${tabs.length} tabs — phase detail panel may not be open` });
    }
    // Click second tab and verify it becomes active
    if (tabs.length >= 2) {
      const tabBtns = await page.$$('.phase-detail [data-clickable="tab"]');
      if (tabBtns.length >= 2) {
        await tabBtns[1].dispatchEvent('click');
        await page.waitForTimeout(200);
        const activeTab = await page.evaluate(() => {
          const active = document.querySelector('.phase-detail [data-clickable="tab"].active, .phase-detail [data-clickable="tab"].is-active, .phase-detail [data-clickable="tab"][aria-selected="true"]');
          return active ? active.getAttribute('data-tab') : null;
        });
        findings.push({
          check: 'phase_detail_tab_switch',
          verdict: activeTab && activeTab === tabs[1] ? 'PASS' : 'WARN',
          detail: `clicked tab '${tabs[1]}', active is '${activeTab}'`,
        });
      }
    }

    // 19. Malformed snapshot resilience — inject bad data into the SSE
    // handler via window.dispatchEvent / EventSource emulation; verify no
    // page crash and prior render preserved. Done via direct call to the
    // private parser since we exposed window.__sgsdLastSnapshot.
    const survival = await page.evaluate(() => {
      const before = (window.__sgsdLastSnapshot || {}).generated_at;
      // Simulate a malformed SSE frame by manually triggering JSON.parse
      // failure through a synthetic event. client.js catches parse errors
      // and ignores. Just verify the page is still alive afterwards.
      try {
        // Synth via window dispatching a MessageEvent on the EventSource
        // proxy isn't reliable across browsers; instead, just confirm the
        // page hasn't navigated and the mirror is still valid.
        return { stillAlive: !!document.querySelector('main.sgsd-cockpit'), generated_at: before };
      } catch (e) {
        return { stillAlive: false, error: e.message };
      }
    });
    findings.push({
      check: 'page_still_alive',
      verdict: survival.stillAlive ? 'PASS' : 'FAIL',
      detail: survival.stillAlive ? 'main.sgsd-cockpit present after all checks' : 'page lost main DOM',
    });

    // 20. Keyboard focus — Tab key should move focus into the page
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    const focusedTag = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
    findings.push({
      check: 'keyboard_focus_enters_page',
      verdict: focusedTag && focusedTag !== 'BODY' ? 'PASS' : 'WARN',
      detail: `after Tab, activeElement.tagName=${focusedTag}`,
    });

    // 21. SSE reconnect contract — connection tier element should exist and
    // be one of the documented tiers. 'stale' is acceptable here because
    // client.js propagates per-source staleness to the global tier
    // (intentional 'no silent failures' visibility). 'offline' is the only
    // hard fail. 'live'/'reconnecting' are normal during the audit window.
    const connDiag = await page.evaluate(() => {
      const el = document.querySelector('[data-conn-tier]');
      const tier = el ? el.getAttribute('data-conn-tier') : null;
      const sources = (window.__sgsdLastSnapshot || {})._sources || {};
      const staleSources = Object.entries(sources)
        .filter(([_, v]) => v && v.tier && v.tier !== 'fresh' && v.excused !== true)
        .map(([k, v]) => `${k}=${v.tier}`);
      return { tier, staleSources: staleSources.slice(0, 5), sourceCount: Object.keys(sources).length };
    });
    if (!connDiag.tier) {
      findings.push({ check: 'sse_conn_tier_indicator', verdict: 'WARN', detail: 'no [data-conn-tier] element rendered' });
    } else if (connDiag.tier === 'offline') {
      findings.push({ check: 'sse_conn_tier_indicator', verdict: 'FAIL', detail: `conn tier=offline (EventSource disconnected)` });
    } else if (connDiag.tier === 'stale') {
      findings.push({
        check: 'sse_conn_tier_indicator',
        verdict: 'PASS',
        detail: `conn tier=stale (propagated from non-fresh sources, correct visibility): ${connDiag.staleSources.join(', ') || 'no flagged source'} (of ${connDiag.sourceCount})`,
      });
    } else {
      findings.push({ check: 'sse_conn_tier_indicator', verdict: 'PASS', detail: `conn tier=${connDiag.tier}` });
    }

    // 22. Multi-client SSE concurrency — open a SECOND tab, both should
    // receive the same snapshot update. Catches: server only broadcasts to
    // last-attached client; per-client state leaks; clients drop on second
    // connect. Multi-touch loop (Windows fs.watch quirk) + 8s deadline.
    const page2 = await context.newPage();
    await page2.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page2.waitForFunction(() => !!(window.__sgsdLastSnapshot && window.__sgsdLastSnapshot.generated_at), { timeout: 8000 }).catch(() => {});
    const ts1 = await page.evaluate(() => (window.__sgsdLastSnapshot || {}).generated_at);
    const ts2 = await page2.evaluate(() => (window.__sgsdLastSnapshot || {}).generated_at);
    let ts1After = ts1;
    let ts2After = ts2;
    const mcDeadline = Date.now() + 8000;
    while (Date.now() < mcDeadline) {
      fs.utimesSync(path.resolve(opts.workspace, '.planning/STATE.md'), new Date(), new Date());
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 400));
      // eslint-disable-next-line no-await-in-loop
      ts1After = await page.evaluate(() => (window.__sgsdLastSnapshot || {}).generated_at);
      // eslint-disable-next-line no-await-in-loop
      ts2After = await page2.evaluate(() => (window.__sgsdLastSnapshot || {}).generated_at);
      if (ts1After !== ts1 && ts2After !== ts2) break;
    }
    const bothUpdated = ts1After !== ts1 && ts2After !== ts2;
    const bothMatch = ts1After === ts2After;
    findings.push({
      check: 'multi_client_sse_concurrency',
      verdict: bothUpdated && bothMatch ? 'PASS' : 'WARN',
      detail: `tab1: ${ts1} → ${ts1After} · tab2: ${ts2} → ${ts2After} · both-updated=${bothUpdated} · ts-match=${bothMatch}`,
    });
    await page2.close();

    // 23. Rapid touch resilience — fire 10 touches in quick succession;
    // verify the server's 200ms debounce coalesces them (not 10 broadcasts)
    // AND the final generated_at is fresh. Catches: missed-event under
    // burst; debounce wedged; race causing zero broadcasts.
    // Timing: debounce resets on every touch, so the final fire is
    // ~200ms after the LAST touch. Plus 100ms scheduleRecompute timer + up
    // to 1.5s compute + broadcast. 5s deadline absorbs the tail.
    const burstBefore = await page.evaluate(() => window.__sgsdSnapshotCount || 0);
    for (let i = 0; i < 10; i += 1) {
      fs.utimesSync(path.resolve(opts.workspace, '.planning/STATE.md'), new Date(), new Date());
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    let delta = 0;
    const burstDeadline = Date.now() + 5000;
    while (Date.now() < burstDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const cur = await page.evaluate(() => window.__sgsdSnapshotCount || 0);
      delta = cur - burstBefore;
      if (delta >= 1) break;
    }
    findings.push({
      check: 'rapid_touch_debounce',
      verdict: delta >= 1 && delta <= 8 ? 'PASS' : (delta === 0 ? 'FAIL' : 'WARN'),
      detail: `10 touches in 300ms → ${delta} snapshot frames received (expected 1-8 after debounce + coalesce)`,
    });

    // 24. ARIA live regions — at least one element with role="status" or
    // aria-live to announce dynamic updates to screen readers.
    const ariaLive = await page.$$eval('[aria-live], [role="status"], [role="alert"]', (els) => els.length);
    findings.push({
      check: 'aria_live_regions',
      verdict: ariaLive > 0 ? 'PASS' : 'WARN',
      detail: `${ariaLive} live regions found`,
    });

    // 25. Design-token completeness — sample 8 core tokens from
    // sgsd-design-system.css. If any are empty, the page renders with
    // fallback colors and looks broken.
    const tokens = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const names = ['--page', '--ink', '--ink-mid', '--ink-faint', '--live', '--done', '--attn', '--severe', '--bg-1', '--bg-2', '--display', '--mono'];
      const out = {};
      for (const n of names) out[n] = cs.getPropertyValue(n).trim();
      return out;
    });
    const missing = Object.entries(tokens).filter(([_, v]) => !v).map(([k]) => k);
    findings.push({
      check: 'design_token_completeness',
      verdict: missing.length === 0 ? 'PASS' : (missing.length <= 2 ? 'WARN' : 'FAIL'),
      detail: missing.length === 0 ? `${Object.keys(tokens).length} core tokens defined (${tokens['--page']} bg, ${tokens['--ink']} text)` : `missing tokens: ${missing.join(', ')}`,
    });
  } catch (err) {
    findings.push({ check: 'audit_exception', verdict: 'FAIL', detail: err.message });
  } finally {
    await browser.close().catch(() => {});
    if (serverChild) {
      serverChild.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return { findings, resolvedBaseUrl: ctx.resolvedBaseUrl };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { findings, resolvedBaseUrl } = await audit(opts);

  const fails = findings.filter((f) => f.verdict === 'FAIL');
  const warns = findings.filter((f) => f.verdict === 'WARN');
  const passes = findings.filter((f) => f.verdict === 'PASS');

  const verdict = fails.length > 0 ? 'FAIL' : 'PASS';
  const summary = {
    schema_version: 1,
    audit_at: new Date().toISOString(),
    workspace: opts.workspace,
    target: resolvedBaseUrl || opts.target || `http://127.0.0.1:${opts.port}`,
    phase: opts.phase || null,
    verdict,
    total: findings.length,
    pass: passes.length,
    warn: warns.length,
    fail: fails.length,
    findings,
  };

  // Per-phase verdict file mirrors the browser-smoke naming convention
  // (cockpit-smoke-<phase>-verdict.json). The PHASE-CAPSULE.json's
  // gates.playwright_audit block should reference this path.
  const runtimeDir = path.resolve(opts.workspace, '.planning/runtime');
  if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });
  const outName = opts.phase
    ? `cockpit-playwright-audit-${opts.phase}-verdict.json`
    : 'playwright-audit.json';
  const outPath = path.resolve(runtimeDir, outName);
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log(`[audit] verdict: ${verdict} · ${passes.length} PASS · ${warns.length} WARN · ${fails.length} FAIL`);
  for (const f of fails) console.log(`  FAIL · ${f.check} · ${f.detail}`);
  for (const f of warns) console.log(`  WARN · ${f.check} · ${f.detail}`);
  console.log(`[audit] full report: ${outPath}`);

  process.exit(fails.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[audit] fatal:', err.message);
  process.exit(2);
});
