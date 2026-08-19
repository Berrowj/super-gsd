#!/usr/bin/env node
// @sgsd/phase-verifier — framework-level phase browser verifier.
//
// Why this exists: the orchestrator cannot trust prose reports from sub-agents
// ("audit passed", "page renders cleanly"). Every audit report must cite
// evidence files committed to the repo that the orchestrator can independently
// stat. This tool produces those files and a strict verdict.
//
// What it does, per phase:
//   1. Parses .planning/ROADMAP.md to locate the phase, its success criteria,
//      and the URLs/endpoints it ships.
//   2. For each audited URL (from config.browser_verify.routes):
//        a. Drives gsd-browser (via CDP) to navigate the URL.
//        b. Polls the DOM for [data-loaded="true"] or [data-empty-reason="..."]
//           on the page root. Times out after load_timeout_ms → LOAD_TIMEOUT.
//        c. Counts DOM rows via [data-row] selector, falls back to <tr>.
//        d. Captures screenshot → evidence/screenshots/{slug}.png
//        e. Captures network HAR → evidence/{slug}.har
//        f. Captures console errors → evidence/{slug}.console.log
//        g. Fetches the backing API endpoint directly → evidence/{slug}.api.json
//        h. Asserts api status == 200 AND rows >= min_rows OR data_empty_reason set.
//   3. Writes {resolved-phase-dir}/{token}-BROWSER-REVIEW.md with per-route table.
//   4. Exit 0 = PROVEN, 1 = UNPROVEN, 2 = BLOCKED (tool precondition / backend down).
//
// HARD rules:
//   - No screenshot is taken before data-loaded or data-empty-reason appears.
//   - No curl-only audit is reported as a pass.
//   - No empty response body is reported as a pass without data-empty-reason.
//   - No route is PROVEN unless every evidence file exists and passes shape checks.

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join, basename, dirname } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import phaseName from '../../scripts/lib/phase-name.cjs';

const { findPhase, isDiscoveryError, parsePhaseName, phaseTokensEqual } = phaseName;

const __filename = fileURLToPath(import.meta.url);

// ──────────────────────────────────────────────────────────────────────────────
// CLI args
// ──────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { projectDir: process.cwd(), phase: null, sessionId: 'sgsd-verify' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project-dir') out.projectDir = resolve(argv[++i]);
    else if (a === '--phase') out.phase = argv[++i];
    else if (a === '--session') out.sessionId = argv[++i];
    else if (a === '--help' || a === '-h') {
      printUsage();
      process.exit(0);
    }
  }
  if (!out.phase) {
    fail('Missing --phase. Usage: phase-verifier --project-dir PATH --phase TOKEN', 2);
  }
  return out;
}

function printUsage() {
  console.log(`
phase-verifier — Super GSD phase browser verifier

Usage:
  phase-verifier --project-dir PATH --phase TOKEN [--session ID]

Options:
  --project-dir PATH   Project root (contains .planning/). Default: cwd.
  --phase TOKEN        Phase token (required), e.g. 89, 97.5, or v30-07.
  --session ID         gsd-browser CDP session id. Default: sgsd-verify.

Exit codes:
  0  PROVEN   — every audited route passed every check
  1  UNPROVEN — one or more routes failed a check; see BROWSER-REVIEW.md
  2  BLOCKED  — tool missing, backend unreachable, or config invalid
`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Logging helpers — stderr for progress, stdout reserved for machine output
// ──────────────────────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};
const log  = (msg) => console.error(`${C.cyan}[verify]${C.reset} ${msg}`);
const ok   = (msg) => console.error(`${C.green}  ✓${C.reset} ${msg}`);
const warn = (msg) => console.error(`${C.yellow}  !${C.reset} ${msg}`);
const err  = (msg) => console.error(`${C.red}  ✗${C.reset} ${msg}`);
function fail(msg, code = 1) { err(msg); process.exit(code); }

// ──────────────────────────────────────────────────────────────────────────────
// Config loading
// ──────────────────────────────────────────────────────────────────────────────

function loadConfig(projectDir) {
  const path = join(projectDir, '.planning', 'config.json');
  if (!existsSync(path)) fail(`config.json not found at ${path}`, 2);
  const cfg = JSON.parse(readFileSync(path, 'utf8'));
  if (!cfg.browser_verify) fail('config.json missing browser_verify block', 2);
  if (!cfg.browser_verify.enabled) fail('browser_verify.enabled is false in config.json', 2);
  return cfg.browser_verify;
}

// ──────────────────────────────────────────────────────────────────────────────
// ROADMAP parser — extracts phase success criteria + URL mentions
// ──────────────────────────────────────────────────────────────────────────────

function parseRoadmap(projectDir, phaseArg) {
  const path = join(projectDir, '.planning', 'ROADMAP.md');
  if (!existsSync(path)) {
    warn(`ROADMAP.md not found at ${path} — proceeding without phase criteria trace`);
    return { phaseTitle: `Phase ${phaseArg}`, criteria: [], urls: [], endpoints: [] };
  }
  const content = readFileSync(path, 'utf8');
  const phaseQuery = parsePhaseName(String(phaseArg));
  const roadmapLines = content.split(/\r?\n/);
  let headingTitle = null;
  let bodyLines = [];
  for (let index = 0; index < roadmapLines.length; index++) {
    const line = roadmapLines[index];
    if (!line.startsWith('### Phase ')) continue;
    const remainder = line.slice('### Phase '.length);
    const colon = remainder.indexOf(': ');
    const dot = remainder.indexOf('. ');
    const separator = colon < 0 ? dot : dot < 0 ? colon : Math.min(colon, dot);
    if (separator < 0) continue;
    const candidate = parsePhaseName(remainder.slice(0, separator));
    if (!candidate || !phaseQuery || !phaseTokensEqual(candidate, phaseQuery)) continue;
    headingTitle = remainder.slice(separator + 2);
    for (let bodyIndex = index + 1; bodyIndex < roadmapLines.length; bodyIndex++) {
      const bodyLine = roadmapLines[bodyIndex];
      if (bodyLine.startsWith('### Phase ') || bodyLine.startsWith('## ')) break;
      bodyLines.push(bodyLine);
    }
    break;
  }
  if (headingTitle === null) {
    warn(`Phase ${phaseArg} not found in ROADMAP.md — trace will be incomplete`);
    return { phaseTitle: `Phase ${phaseArg}`, criteria: [], urls: [], endpoints: [] };
  }
  const phaseTitle = `Phase ${phaseArg}: ${headingTitle.trim().replace(/\s*✅.*$/, '').replace(/\s*🔄.*$/, '')}`;
  const body = bodyLines.join('\n');

  // Extract success criteria — block starts at "**Success Criteria:**" and ends
  // at the next blank-line paragraph or "**Known" / "**Plans" / "### ".
  const critMatch = body.match(/\*\*Success Criteria:?\*\*\s*\n([\s\S]*?)(?:\n\n\*\*|\n### |\Z)/);
  const criteria = [];
  if (critMatch) {
    const lines = critMatch[1].split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*\d+\.\s+(.+?)(?:\s*[✅❌⚠️].*)?$/);
      if (m) criteria.push(m[1].trim());
    }
  }

  // URL extraction — find /api/... endpoints and page paths like /stock-value
  const urlRegex = /(?:https?:\/\/[^\s`'")\]]+|(?<![a-zA-Z0-9])\/[a-z][\w\/\-.]*)/g;
  const foundUrls = new Set();
  const foundEndpoints = new Set();
  for (const match of body.matchAll(urlRegex)) {
    const u = match[0];
    if (u.startsWith('/api/')) foundEndpoints.add(u.split(/\s|`/)[0]);
    else if (u.startsWith('/') && !u.includes('.')) foundUrls.add(u.split(/\s|`/)[0]);
  }
  return {
    phaseTitle,
    criteria,
    urls: Array.from(foundUrls),
    endpoints: Array.from(foundEndpoints),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Phase dir resolution through the shared dual-root boundary.
// ──────────────────────────────────────────────────────────────────────────────

function resolvePhaseDir(projectDir, phaseArg) {
  const phase = findPhase(projectDir, String(phaseArg));
  if (isDiscoveryError(phase)) throw new Error(phase.reason);
  return phase ? phase.dir : null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tool precondition (Gate 1)
// ──────────────────────────────────────────────────────────────────────────────

function pickBrowserTool() {
  // Returns { cmd, args: [], label } or null.
  // On Windows we need shell:true so spawnSync resolves .cmd/.bat via PATHEXT.
  // Without this, the wrapper at %APPDATA%\npm\gsd-browser.cmd is invisible to
  // Node even though `where.exe gsd-browser` finds it — which caused every
  // Windows sgsd-orchestrate phase to silently halt on Gate 1.
  const IS_WIN = process.platform === 'win32';
  const candidates = [
    { cmd: 'gsd-browser', args: ['--help'], label: 'gsd-browser' },
  ];
  for (const c of candidates) {
    const r = spawnSync(c.cmd, c.args, { stdio: 'ignore', shell: IS_WIN });
    if (r.status === 0) return { cmd: c.cmd, label: c.label };
  }
  return null;
}

function checkToolFallbackDeclaration(phaseDir, approvedFallbacks) {
  const path = join(phaseDir, 'TOOL-FALLBACK.md');
  if (!existsSync(path)) return null;
  const content = readFileSync(path, 'utf8');
  const m = content.match(/^substitute:\s*([\w-]+)/mi);
  if (!m) return null;
  const declared = m[1];
  if (!approvedFallbacks.includes(declared)) return { declared, approved: false };
  return { declared, approved: true };
}

// ──────────────────────────────────────────────────────────────────────────────
// Backend liveness precheck (Gate 4)
// ──────────────────────────────────────────────────────────────────────────────

async function checkBackendEndpoints(baseUrl, endpoints) {
  const results = [];
  for (const ep of endpoints) {
    const url = ep.startsWith('http') ? ep : `${baseUrl.replace(/\/$/, '')}${ep}`;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      const r = await fetch(url, { signal: controller.signal });
      clearTimeout(t);
      results.push({ url, status: r.status, ok: r.status >= 200 && r.status < 400 });
    } catch (e) {
      results.push({ url, status: 0, ok: false, error: e.message });
    }
  }
  return results;
}

// ──────────────────────────────────────────────────────────────────────────────
// gsd-browser driver wrappers
// ──────────────────────────────────────────────────────────────────────────────

function gsdBrowser(session, args, opts = {}) {
  // spawnSync with stdin inheritance disabled so it cannot hang on input.
  // shell:true on Windows resolves the .cmd wrapper via PATHEXT (see pickBrowserTool).
  const IS_WIN = process.platform === 'win32';
  const r = spawnSync('gsd-browser', ['--session', session, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: opts.timeout ?? 30000,
    shell: IS_WIN,
  });
  return {
    status: r.status,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

async function navigateAndWaitForDataLoaded(session, url, timeoutMs) {
  const nav = gsdBrowser(session, ['navigate', url]);
  if (nav.status !== 0) {
    return { ok: false, reason: 'NAVIGATE_FAILED', detail: nav.stderr.slice(0, 200) };
  }
  const deadline = Date.now() + timeoutMs;
  let lastAttr = null;
  while (Date.now() < deadline) {
    const ev = gsdBrowser(session, [
      'eval',
      `document.documentElement.getAttribute('data-loaded') || document.body.getAttribute('data-loaded') || 'null'`,
    ]);
    if (ev.status === 0) {
      const val = (ev.stdout || '').trim().replace(/^"|"$/g, '');
      lastAttr = val;
      if (val === 'true') return { ok: true, waited_for: 'data-loaded=true' };
    }
    const ev2 = gsdBrowser(session, [
      'eval',
      `document.documentElement.getAttribute('data-empty-reason') || document.body.getAttribute('data-empty-reason') || 'null'`,
    ]);
    if (ev2.status === 0) {
      const val2 = (ev2.stdout || '').trim().replace(/^"|"$/g, '');
      if (val2 && val2 !== 'null') {
        return { ok: true, waited_for: `data-empty-reason=${val2}`, empty: true, reason: val2 };
      }
    }
    await sleep(500);
  }
  return { ok: false, reason: 'LOAD_TIMEOUT', lastAttr };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function countDomRows(session) {
  const ev = gsdBrowser(session, [
    'eval',
    `(function(){
       const rows = document.querySelectorAll('[data-row]');
       if (rows.length > 0) return rows.length;
       return document.querySelectorAll('tbody tr').length;
     })()`,
  ]);
  if (ev.status !== 0) return 0;
  const n = parseInt((ev.stdout || '0').trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function captureScreenshot(session, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  const r = gsdBrowser(session, ['screenshot', '--output', outPath]);
  return r.status === 0 && existsSync(outPath);
}

function captureNetworkHar(session, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  const r = gsdBrowser(session, ['network', '--format', 'har']);
  if (r.status !== 0) return false;
  writeFileSync(outPath, r.stdout || '{}', 'utf8');
  return true;
}

function captureConsoleErrors(session, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  const r = gsdBrowser(session, ['console', '--level', 'error']);
  writeFileSync(outPath, r.stdout || '', 'utf8');
  return r.status === 0;
}

async function captureApiJson(baseUrl, endpoint, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl.replace(/\/$/, '')}${endpoint}`;
  try {
    const r = await fetch(url);
    const body = await r.text();
    writeFileSync(outPath, body, 'utf8');
    let rows = 0;
    try {
      const parsed = JSON.parse(body);
      if (Array.isArray(parsed)) rows = parsed.length;
      else if (parsed && Array.isArray(parsed.items)) rows = parsed.items.length;
      else if (parsed && Array.isArray(parsed.data)) rows = parsed.data.length;
      else if (parsed && typeof parsed === 'object') rows = 1;
    } catch { rows = 0; }
    return { status: r.status, rows, ok: r.ok };
  } catch (e) {
    return { status: 0, rows: 0, ok: false, error: e.message };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Evidence manifest verification (Gate 2)
// ──────────────────────────────────────────────────────────────────────────────

function verifyEvidence(artifact, minRows, allowEmpty) {
  const problems = [];
  if (!existsSync(artifact.screenshot)) problems.push('screenshot missing');
  else if (statSync(artifact.screenshot).size < 5000) problems.push(`screenshot too small (${statSync(artifact.screenshot).size} bytes — likely a blank or error page)`);
  if (!existsSync(artifact.har)) problems.push('HAR missing');
  if (!existsSync(artifact.console)) problems.push('console log missing');
  if (!existsSync(artifact.apiJson)) problems.push('api.json missing');
  else {
    try {
      const parsed = JSON.parse(readFileSync(artifact.apiJson, 'utf8'));
      const rows = Array.isArray(parsed) ? parsed.length
        : (parsed?.items?.length ?? parsed?.data?.length ?? (parsed ? 1 : 0));
      if (rows < minRows && !allowEmpty) {
        problems.push(`api.json has ${rows} rows, required ${minRows}`);
      }
    } catch { problems.push('api.json not valid JSON'); }
  }
  return problems;
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-route verification loop
// ──────────────────────────────────────────────────────────────────────────────

function slugForRoute(route) {
  return route.replace(/^\//, '').replace(/\//g, '_').replace(/[^a-zA-Z0-9_-]/g, '_') || 'root';
}

async function verifyRoute(route, bv, phaseDir, session, roadmap) {
  const slug = slugForRoute(route);
  const fullUrl = `${bv.base_url.replace(/\/$/, '')}${route}`;
  const evDir = join(phaseDir, 'evidence');
  const shotDir = join(phaseDir, 'screenshots');
  mkdirSync(evDir, { recursive: true });
  mkdirSync(shotDir, { recursive: true });

  const artifact = {
    screenshot: join(shotDir, `${slug}.png`),
    har:        join(evDir, `${slug}.har`),
    console:    join(evDir, `${slug}.console.log`),
    apiJson:    join(evDir, `${slug}.api.json`),
  };

  // Find the matching ROADMAP criterion for trace
  const matchingCriterion = roadmap.criteria.find((c) => c.includes(route) || c.toLowerCase().includes(slug));

  log(`Verifying ${fullUrl}`);
  const wait = await navigateAndWaitForDataLoaded(session, fullUrl, bv.load_timeout_ms ?? 15000);
  if (!wait.ok) {
    // Still capture whatever we can for forensics
    captureScreenshot(session, artifact.screenshot);
    captureNetworkHar(session, artifact.har);
    captureConsoleErrors(session, artifact.console);
    err(`${route} → ${wait.reason} (lastAttr=${wait.lastAttr ?? 'n/a'})`);
    return {
      route, slug, fullUrl, artifact,
      waited_for: null,
      load_result: wait.reason,
      dom_rows: 0,
      api_status: 0, api_rows: 0,
      verdict: wait.reason,
      matchingCriterion: matchingCriterion ?? null,
    };
  }

  const domRows = countDomRows(session);
  const shotOk = captureScreenshot(session, artifact.screenshot);
  const harOk  = captureNetworkHar(session, artifact.har);
  const conOk  = captureConsoleErrors(session, artifact.console);

  // Pick the first endpoint from roadmap that "belongs" to this route (best-effort)
  const candidateEndpoint = roadmap.endpoints.find((e) => e.toLowerCase().includes(slug.toLowerCase())) || roadmap.endpoints[0] || null;
  let apiResult = { status: 0, rows: 0, ok: false };
  if (candidateEndpoint) {
    apiResult = await captureApiJson(bv.base_url, candidateEndpoint, artifact.apiJson);
  } else {
    writeFileSync(artifact.apiJson, JSON.stringify({ note: 'No backing endpoint resolved from ROADMAP' }), 'utf8');
  }

  const minRows = bv.min_rows_per_route ?? 1;
  const isEmptyOk = wait.empty === true;
  const evProblems = verifyEvidence(artifact, minRows, isEmptyOk);

  let verdict = 'PROVEN';
  const failReasons = [];
  if (apiResult.status && apiResult.status !== 200) { verdict = 'NETWORK_ERROR'; failReasons.push(`api ${apiResult.status}`); }
  if (domRows < minRows && !isEmptyOk) { verdict = 'UNPROVEN'; failReasons.push(`DOM rows ${domRows} < ${minRows}`); }
  if (evProblems.length > 0) { verdict = 'UNPROVEN'; failReasons.push(...evProblems); }

  if (verdict === 'PROVEN') ok(`${route} → PROVEN (${domRows} DOM rows, api ${apiResult.status}/${apiResult.rows})`);
  else err(`${route} → ${verdict}: ${failReasons.join('; ')}`);

  return {
    route, slug, fullUrl, artifact,
    waited_for: wait.waited_for,
    load_result: 'LOADED',
    dom_rows: domRows,
    api_status: apiResult.status,
    api_rows: apiResult.rows,
    verdict,
    failReasons,
    matchingCriterion: matchingCriterion ?? null,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Report writer
// ──────────────────────────────────────────────────────────────────────────────

function writeReport(phaseDir, phase, roadmap, bv, results) {
  const path = join(phaseDir, `${phase}-BROWSER-REVIEW.md`);
  const overall = results.every((r) => r.verdict === 'PROVEN') ? 'PROVEN' : 'UNPROVEN';
  const ts = new Date().toISOString();
  const lines = [];
  lines.push(`# Phase ${phase} Browser Verify — ${overall}`);
  lines.push('');
  lines.push(`**Generated:** ${ts}`);
  lines.push(`**Phase:** ${roadmap.phaseTitle}`);
  lines.push(`**Base URL:** ${bv.base_url}`);
  lines.push(`**Routes audited:** ${results.length}`);
  lines.push(`**Overall verdict:** \`${overall}\``);
  lines.push('');
  lines.push('## Per-route results');
  lines.push('');
  lines.push('| Route | Verdict | Waited for | DOM rows | API status/rows | Screenshot | Criterion trace |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of results) {
    const scRel = r.artifact.screenshot ? basename(r.artifact.screenshot) : '-';
    const crit = r.matchingCriterion ? `\`${r.matchingCriterion.slice(0, 80)}\`` : '⚠️ UNTRACEABLE';
    lines.push(`| \`${r.route}\` | **${r.verdict}** | ${r.waited_for ?? '-'} | ${r.dom_rows} | ${r.api_status}/${r.api_rows} | \`screenshots/${scRel}\` | ${crit} |`);
  }
  lines.push('');
  const failed = results.filter((r) => r.verdict !== 'PROVEN');
  if (failed.length > 0) {
    lines.push('## Failures');
    lines.push('');
    for (const f of failed) {
      lines.push(`### ${f.route} — ${f.verdict}`);
      if (f.failReasons && f.failReasons.length) {
        for (const reason of f.failReasons) lines.push(`- ${reason}`);
      }
      lines.push(`- Evidence: \`evidence/${f.slug}.har\`, \`evidence/${f.slug}.console.log\`, \`evidence/${f.slug}.api.json\``);
      lines.push('');
    }
  }
  lines.push('## Evidence manifest');
  lines.push('');
  for (const r of results) {
    lines.push(`- \`screenshots/${basename(r.artifact.screenshot)}\``);
    lines.push(`- \`evidence/${basename(r.artifact.har)}\``);
    lines.push(`- \`evidence/${basename(r.artifact.console)}\``);
    lines.push(`- \`evidence/${basename(r.artifact.apiJson)}\``);
  }
  lines.push('');
  lines.push('## ROADMAP success criteria');
  lines.push('');
  if (roadmap.criteria.length === 0) {
    lines.push('_No success criteria parsed from ROADMAP.md_');
  } else {
    for (let i = 0; i < roadmap.criteria.length; i++) {
      lines.push(`${i + 1}. ${roadmap.criteria[i]}`);
    }
  }
  writeFileSync(path, lines.join('\n'), 'utf8');
  log(`Report: ${path}`);
  return { path, overall };
}

// ──────────────────────────────────────────────────────────────────────────────
// Deferral ledger append
// ──────────────────────────────────────────────────────────────────────────────

function appendDeferralLedger(projectDir, phase, reason) {
  const path = join(projectDir, '.planning', 'DEFERRAL-LEDGER.md');
  const ts = new Date().toISOString();
  const line = `- [ ] **Phase ${phase}** (${ts}) — ${reason}`;
  if (!existsSync(path)) {
    writeFileSync(path, `# Deferral Ledger\n\nEntries older than 3 phases auto-reopen.\n\n${line}\n`, 'utf8');
  } else {
    const content = readFileSync(path, 'utf8');
    writeFileSync(path, content.replace(/\n*$/, `\n${line}\n`), 'utf8');
  }
  warn(`Appended to DEFERRAL-LEDGER.md: ${reason}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

(async function main() {
  const args = parseArgs(process.argv);
  log(`Phase ${args.phase} verifier starting in ${args.projectDir}`);

  const bv = loadConfig(args.projectDir);
  const roadmap = parseRoadmap(args.projectDir, args.phase);
  const phaseDir = resolvePhaseDir(args.projectDir, args.phase);
  if (!phaseDir) fail(`Phase directory not found for ${args.phase}`, 2);
  log(`Phase dir: ${phaseDir}`);
  log(`Roadmap criteria: ${roadmap.criteria.length}  URLs: ${roadmap.urls.length}  endpoints: ${roadmap.endpoints.length}`);

  // Gate 1 — tool precondition
  let tool = pickBrowserTool();
  if (!tool) {
    const declared = checkToolFallbackDeclaration(phaseDir, bv.approved_fallbacks ?? []);
    if (!declared || !declared.approved) {
      fail(`Gate 1: gsd-browser unavailable and no approved TOOL-FALLBACK.md declared. HALTED.`, 2);
    }
    warn(`Gate 1: gsd-browser missing; TOOL-FALLBACK.md declares "${declared.declared}" — this driver is not yet implemented in phase-verifier.mjs. HALTING.`);
    process.exit(2);
  }
  ok(`Gate 1: ${tool.label} available`);

  // Gate 4 — backend liveness + declared endpoints
  const endpoints = [
    ...(bv.required_endpoints ?? []),
    ...roadmap.endpoints,
  ];
  if (endpoints.length > 0) {
    const liveness = await checkBackendEndpoints(bv.base_url, endpoints);
    const failed = liveness.filter((l) => !l.ok);
    if (failed.length > 0) {
      const path = join(phaseDir, 'BACKEND-NOT-READY.md');
      const md = [
        `# Phase ${args.phase} — Backend not ready`,
        '',
        `Timestamp: ${new Date().toISOString()}`,
        '',
        '| Endpoint | Status | Error |',
        '|---|---|---|',
        ...liveness.map((l) => `| \`${l.url}\` | ${l.status} | ${l.error ?? '-'} |`),
      ].join('\n');
      writeFileSync(path, md, 'utf8');
      fail(`Gate 4: ${failed.length}/${liveness.length} endpoints failing — wrote BACKEND-NOT-READY.md`, 2);
    }
    ok(`Gate 4: ${liveness.length} endpoints reachable`);
  } else {
    warn('Gate 4: no endpoints to precheck (no required_endpoints and ROADMAP had none)');
  }

  // Base URL reachable
  try {
    const r = await fetch(bv.base_url, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) fail(`Gate 4: base_url ${bv.base_url} returned ${r.status}`, 2);
    ok(`Gate 4: base_url ${bv.base_url} reachable (${r.status})`);
  } catch (e) {
    fail(`Gate 4: base_url ${bv.base_url} unreachable — ${e.message}`, 2);
  }

  // Per-route verification
  const routes = bv.routes ?? ['/'];
  const results = [];
  for (const route of routes) {
    const result = await verifyRoute(route, bv, phaseDir, args.sessionId, roadmap);
    results.push(result);
  }

  // Write report
  const report = writeReport(phaseDir, args.phase, roadmap, bv, results);

  if (report.overall === 'PROVEN') {
    ok(`Phase ${args.phase} PROVEN — all ${results.length} routes passed`);
    process.exit(0);
  } else {
    const unprovenCount = results.filter((r) => r.verdict !== 'PROVEN').length;
    err(`Phase ${args.phase} UNPROVEN — ${unprovenCount}/${results.length} routes failed`);
    if (bv.block_on_failure_auto_mode === false) {
      appendDeferralLedger(args.projectDir, args.phase, `Browser verify UNPROVEN: ${unprovenCount}/${results.length} routes. See ${basename(report.path)}`);
    }
    process.exit(1);
  }
})().catch((e) => {
  err(`Uncaught: ${e.stack ?? e.message}`);
  process.exit(2);
});
