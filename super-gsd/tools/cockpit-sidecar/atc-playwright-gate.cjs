#!/usr/bin/env node
'use strict';

// ATC Step 6 (Validate) — Playwright real-browser audit gate.
//
// Operator rule (2026-05-26): every phase that touches the cockpit UI (or any
// other localhost surface the operator builds) MUST run a real-browser audit
// before phase close, mirroring the existing browser-smoke (JSDOM) gate but
// catching the bugs JSDOM misses — real CSS layout, real EventSource timing,
// real console errors, real font/color resolution.
//
// Lineage: the existing browser-smoke.cjs gate caught 2026-05-24/25 incident
// (P136/P137/P138 shipped 79/79 source-grep PASS but cockpit was visually
// broken on open). This Playwright gate goes one level deeper — catches bugs
// that even JSDOM browser-smoke missed (SSE event-name mismatch P143.4,
// descender clipping, broadcast race, ARIA gaps).
//
// Usage:
//   node atc-playwright-gate.cjs --phase 143
//   node atc-playwright-gate.cjs --phase 143 --target http://127.0.0.1:7777
//   node atc-playwright-gate.cjs --phase 143 --force         # skip diff check
//   node atc-playwright-gate.cjs --phase 143 --since HEAD~3  # diff range
//
// Behavior:
//   1. Detect UI file changes vs --since (default HEAD~1 + working tree)
//   2. If no UI files changed and not --force → exit 0, verdict=SKIPPED-NO-UI
//   3. Otherwise spawn cockpit-server (or use --target) and run audit
//   4. Write verdict to .planning/runtime/cockpit-playwright-audit-<phase>-verdict.json
//   5. Print paste-ready PHASE-CAPSULE.json gates.playwright_audit JSON block
//   6. Exit 0 (PASS or SKIPPED) or 1 (FAIL)
//
// Wiring it in (after running):
//   Add to your phase's PHASE-CAPSULE.json under "gates":
//   "playwright_audit": { ...the JSON block this script prints... }

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

// File patterns that indicate UI surface changes. If a phase's diff touches
// ANY of these, the audit is mandatory.
const UI_FILE_PATTERNS = [
  /^super-gsd\/tools\/cockpit-sidecar\//,
  /^super-gsd\/tools\/shared\/.+\.(css|js)$/,
  /^super-gsd\/scripts\/sgsd-codex-monitor\.ps1$/,  // terminal cockpit surface
  /\.tsx?$/,
  /\.jsx?$/,
  /\.vue$/,
  /\.svelte$/,
  /\.html?$/,
  /\.css$/,
];

function parseArgs(argv) {
  const opts = {
    phase: null,
    target: null,
    since: 'HEAD~1',
    force: false,
    workspace: process.cwd(),
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--phase') opts.phase = argv[i += 1];
    else if (argv[i] === '--target') opts.target = argv[i += 1];
    else if (argv[i] === '--since') opts.since = argv[i += 1];
    else if (argv[i] === '--force') opts.force = true;
    else if (argv[i] === '--workspace') opts.workspace = argv[i += 1];
  }
  if (!opts.phase) {
    console.error('FATAL: --phase <id> is required');
    process.exit(2);
  }
  return opts;
}

function gitDiffFiles(since, workspace) {
  // Combine committed-since-base diff + uncommitted working-tree diff.
  // Both --name-only outputs deduplicated.
  const ranges = [
    ['git', ['diff', '--name-only', `${since}..HEAD`]],
    ['git', ['diff', '--name-only']],         // unstaged
    ['git', ['diff', '--name-only', '--staged']], // staged
  ];
  const set = new Set();
  for (const [cmd, args] of ranges) {
    try {
      const out = cp.execFileSync(cmd, args, { cwd: workspace, encoding: 'utf8' });
      for (const line of out.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed) set.add(trimmed);
      }
    } catch (_e) { /* range may not exist; skip */ }
  }
  return Array.from(set);
}

function isUiFile(filepath) {
  return UI_FILE_PATTERNS.some((re) => re.test(filepath));
}

function writeVerdictFile(workspace, phase, payload) {
  const runtimeDir = path.resolve(workspace, '.planning/runtime');
  if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });
  const outPath = path.join(runtimeDir, `cockpit-playwright-audit-${phase}-verdict.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  return outPath;
}

function emitCapsuleBlock(verdict, ref, total, fail, target) {
  // Paste-ready PHASE-CAPSULE.json gates.playwright_audit block.
  const block = {
    verdict,
    target,
    ref,
    total,
    fail,
    audit_at: new Date().toISOString(),
  };
  console.log('');
  console.log('--- paste this into PHASE-CAPSULE.json gates.playwright_audit ---');
  console.log(JSON.stringify(block, null, 2));
  console.log('--- end paste block ---');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  // Step A: UI file diff detection
  let uiFiles = [];
  if (!opts.force) {
    const allChanged = gitDiffFiles(opts.since, opts.workspace);
    uiFiles = allChanged.filter(isUiFile);
    if (uiFiles.length === 0) {
      const payload = {
        schema_version: 1,
        phase: opts.phase,
        verdict: 'SKIPPED-NO-UI-FILES',
        audit_at: new Date().toISOString(),
        rationale: `No UI-file changes detected since ${opts.since}. Audit skipped.`,
        diff_range: opts.since,
        diff_total: allChanged.length,
        ui_files: [],
      };
      const out = writeVerdictFile(opts.workspace, opts.phase, payload);
      console.log(`[atc-playwright-gate] verdict: SKIPPED-NO-UI-FILES (${allChanged.length} files changed, 0 UI)`);
      console.log(`[atc-playwright-gate] report: ${out}`);
      emitCapsuleBlock('SKIPPED-NO-UI-FILES', out, 0, 0, opts.target || 'http://127.0.0.1:7777');
      process.exit(0);
    }
    console.log(`[atc-playwright-gate] UI files changed (${uiFiles.length}): ${uiFiles.slice(0, 5).join(', ')}${uiFiles.length > 5 ? ` …+${uiFiles.length - 5}` : ''}`);
  } else {
    console.log('[atc-playwright-gate] --force: skipping diff check, running audit unconditionally');
  }

  // Step B: run the audit. If --target was given, use it; else spawn cockpit-server.
  const auditScript = path.resolve(__dirname, 'playwright-audit.cjs');
  const auditArgs = ['--phase', opts.phase, '--workspace', opts.workspace];
  if (opts.target) {
    auditArgs.push('--target', opts.target);
  } else {
    auditArgs.push('--spawn-server', '--port', '0');
  }
  console.log(`[atc-playwright-gate] running: node ${path.basename(auditScript)} ${auditArgs.join(' ')}`);

  const result = cp.spawnSync(process.execPath, [auditScript, ...auditArgs], {
    cwd: opts.workspace,
    stdio: 'inherit',
    timeout: 180000,
  });

  // Step C: read the audit's verdict file and emit capsule block
  const verdictPath = path.resolve(opts.workspace, `.planning/runtime/cockpit-playwright-audit-${opts.phase}-verdict.json`);
  let auditVerdict = 'FAIL';
  let total = 0;
  let fail = 0;
  let target = opts.target || 'http://127.0.0.1:7777';
  if (fs.existsSync(verdictPath)) {
    try {
      const json = JSON.parse(fs.readFileSync(verdictPath, 'utf8'));
      auditVerdict = json.verdict;
      total = json.total;
      fail = json.fail;
      target = json.target || target;
    } catch (e) {
      console.error(`[atc-playwright-gate] could not parse verdict file: ${e.message}`);
    }
  } else {
    console.error('[atc-playwright-gate] verdict file not written — audit may have crashed');
  }

  // Merge ui_files into the verdict file so the capsule reviewer can see
  // which changed paths triggered the gate.
  if (fs.existsSync(verdictPath) && uiFiles.length > 0) {
    try {
      const json = JSON.parse(fs.readFileSync(verdictPath, 'utf8'));
      json.ui_files_triggering = uiFiles;
      fs.writeFileSync(verdictPath, JSON.stringify(json, null, 2));
    } catch (_e) { /* non-fatal */ }
  }

  emitCapsuleBlock(auditVerdict, verdictPath, total, fail, target);

  // Exit code: 0 on PASS/SKIPPED, 1 on FAIL, 2 on script-level error.
  if (result.status !== 0 && result.status !== 1) {
    console.error(`[atc-playwright-gate] audit script exited with code ${result.status}`);
    process.exit(2);
  }
  process.exit(auditVerdict === 'PASS' || auditVerdict === 'SKIPPED-NO-UI-FILES' ? 0 : 1);
}

main();
