#!/usr/bin/env node
/**
 * Overwatcher Launcher — Super GSD Edition
 *
 * Standalone script that:
 * 1. Reads .planning/ via planning-reader.js → GraphModel
 * 2. Runs analysis detectors (reused from Pi overwatcher)
 * 3. Infers architecture (reused from Pi overwatcher)
 * 4. Assembles multi-tab HTML (reused from Pi overwatcher)
 * 5. Writes signal-map.html
 * 6. Optionally starts HTTP server for live viewing
 *
 * Usage:
 *   node overwatcher-launcher.js [--serve] [--port 3333] [--open]
 *
 * Dependencies:
 *   The analysis, architecture, and renderer modules from the Pi overwatcher
 *   must be copied to ./lib/ (they have no Pi dependency).
 */

const fs = require('fs');
const path = require('path');
const { readPlanningDirectory } = require('./planning-reader');

// ─── Config ───

const args = process.argv.slice(2);
const SERVE = args.includes('--serve');
const OPEN = args.includes('--open');
const PORT_IDX = args.indexOf('--port');
const PORT = PORT_IDX >= 0 ? parseInt(args[PORT_IDX + 1]) : 3333;
const PROJECT_ROOT = process.cwd();
const OUTPUT_DIR = path.join(PROJECT_ROOT, '.planning', 'overwatcher');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'signal-map.html');

// ─── Check for reusable Pi overwatcher modules ───

const PI_OVERWATCHER = path.join(
  process.env.HOME || process.env.USERPROFILE || '',
  '.gsd', 'extensions', 'overwatcher', 'lib'
);

let analyseModule = null;
let inferModule = null;
let renderModule = null;

try {
  if (fs.existsSync(path.join(PI_OVERWATCHER, 'analysis', 'index.js'))) {
    analyseModule = require(path.join(PI_OVERWATCHER, 'analysis', 'index.js'));
    // Skip Pi renderer — GraphModel shapes differ. Use basic renderer.
    // inferModule = require(path.join(PI_OVERWATCHER, 'architecture', 'inference-engine.js'));
    // renderModule = require(path.join(PI_OVERWATCHER, 'renderer', 'multi-tab-assembler.js'));
    console.log('[overwatcher] Using Pi analysis + basic renderer');
  }
} catch (e) {
  console.log('[overwatcher] Pi modules not found, using basic renderer');
}

// ─── Basic HTML Renderer (fallback if Pi modules unavailable) ───

function basicRender(graph) {
  const phases = Object.values(graph.nodes).filter(n => n.type === 'phase');
  const plans = Object.values(graph.nodes).filter(n => n.type === 'plan');
  const files = Object.values(graph.nodes).filter(n => n.type === 'file');
  const decisions = Object.values(graph.nodes).filter(n => n.type === 'decision');

  const completedPhases = phases.filter(p => p.status === 'complete').length;
  const completedPlans = plans.filter(p => p.status === 'complete').length;

  // Detect potential collisions (files written by multiple plans)
  const fileWriters = {};
  for (const edge of graph.edges) {
    if (edge.type === 'writes_to') {
      if (!fileWriters[edge.target]) fileWriters[edge.target] = [];
      fileWriters[edge.target].push(edge.source);
    }
  }
  const collisions = Object.entries(fileWriters)
    .filter(([_, writers]) => writers.length > 1)
    .map(([file, writers]) => ({ file: file.replace('file:', ''), writers }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Super GSD Signal Map</title>
<style>
  :root { --bg:#0d1117; --surface:#161b22; --border:#30363d; --text:#e6edf3;
    --muted:#8b949e; --accent:#58a6ff; --green:#3fb950; --orange:#d29922;
    --red:#f85149; --purple:#bc8cff; --mono:'JetBrains Mono',Consolas,monospace;
    --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:var(--sans); background:var(--bg); color:var(--text); padding:2rem; }
  h1 { font-size:2rem; margin-bottom:0.5rem; color:var(--accent); }
  h2 { font-size:1.3rem; margin:2rem 0 0.5rem; border-bottom:1px solid var(--border); padding-bottom:0.3rem; }
  .stats { display:flex; gap:1rem; flex-wrap:wrap; margin:1rem 0; }
  .stat { background:var(--surface); border:1px solid var(--border); border-radius:8px;
    padding:1rem; min-width:140px; text-align:center; }
  .stat .num { font-size:2rem; font-weight:800; font-family:var(--mono); }
  .stat .label { font-size:0.8rem; color:var(--muted); margin-top:0.3rem; }
  .stat.green .num { color:var(--green); }
  .stat.orange .num { color:var(--orange); }
  .stat.red .num { color:var(--red); }
  .stat.purple .num { color:var(--purple); }
  .phase-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:0.75rem; }
  .phase { background:var(--surface); border:1px solid var(--border); border-radius:8px;
    padding:0.75rem 1rem; font-size:0.85rem; border-left:3px solid var(--border); }
  .phase.complete { border-left-color:var(--green); opacity:0.7; }
  .phase.pending { border-left-color:var(--orange); }
  .phase.active { border-left-color:var(--accent); }
  .phase .name { font-weight:600; }
  .phase .meta { color:var(--muted); font-size:0.75rem; margin-top:0.3rem; }
  .collision { background:var(--surface); border:1px solid var(--red); border-radius:8px;
    padding:0.75rem 1rem; margin-bottom:0.5rem; }
  .collision .file { font-family:var(--mono); color:var(--red); font-size:0.85rem; }
  .collision .writers { color:var(--muted); font-size:0.8rem; }
  table { width:100%; border-collapse:collapse; font-size:0.85rem; margin:0.5rem 0; }
  th { text-align:left; padding:0.5rem; background:var(--surface); border:1px solid var(--border);
    color:var(--muted); font-size:0.75rem; text-transform:uppercase; }
  td { padding:0.5rem; border:1px solid var(--border); }
  .gen { text-align:center; color:var(--muted); font-size:0.75rem; margin-top:3rem;
    padding-top:1rem; border-top:1px solid var(--border); }
</style>
</head>
<body>
<h1>Super GSD Signal Map</h1>
<p style="color:var(--muted);margin-bottom:1.5rem;">Generated: ${graph.summary.generatedAt}</p>

<div class="stats">
  <div class="stat green"><div class="num">${completedPhases}/${phases.length}</div><div class="label">Phases</div></div>
  <div class="stat purple"><div class="num">${completedPlans}/${plans.length}</div><div class="label">Plans</div></div>
  <div class="stat orange"><div class="num">${files.length}</div><div class="label">Files Tracked</div></div>
  <div class="stat red"><div class="num">${collisions.length}</div><div class="label">Collisions</div></div>
  <div class="stat"><div class="num">${decisions.length}</div><div class="label">Decisions</div></div>
</div>

<h2>Phases</h2>
<div class="phase-grid">
${phases.sort((a,b) => (a.metadata.number||0)-(b.metadata.number||0)).map(p => {
  const planCount = plans.filter(pl => pl.metadata.phase === p.metadata.number).length;
  const donePlans = plans.filter(pl => pl.metadata.phase === p.metadata.number && pl.status === 'complete').length;
  return `<div class="phase ${p.status}">
  <div class="name">${p.label}</div>
  <div class="meta">${donePlans}/${planCount} plans | ${p.status}</div>
</div>`;
}).join('\n')}
</div>

${collisions.length > 0 ? `
<h2>Collisions (${collisions.length})</h2>
${collisions.map(c => `<div class="collision">
  <div class="file">${c.file}</div>
  <div class="writers">Written by: ${c.writers.join(', ')}</div>
</div>`).join('\n')}
` : ''}

<h2>Dependency Graph</h2>
<table>
<thead><tr><th>Plan</th><th>Depends On</th><th>Wave</th><th>Status</th></tr></thead>
<tbody>
${plans.filter(p => p.metadata.depends_on && Array.isArray(p.metadata.depends_on) && p.metadata.depends_on.length > 0).map(p =>
  `<tr><td>${p.label}</td><td>${Array.isArray(p.metadata.depends_on) ? p.metadata.depends_on.join(', ') : String(p.metadata.depends_on)}</td><td>${p.metadata.wave || '-'}</td><td>${p.status}</td></tr>`
).join('\n')}
</tbody>
</table>

${decisions.length > 0 ? `
<h2>Decisions</h2>
<table>
<thead><tr><th>Decision</th><th>Date</th><th>Vote</th></tr></thead>
<tbody>
${decisions.map(d => `<tr><td>${d.label}</td><td>${d.metadata.date||'-'}</td><td>${d.metadata.vote||'-'}</td></tr>`).join('\n')}
</tbody>
</table>
` : ''}

<div class="gen">Super GSD Signal Map | ${graph.summary.totalNodes} nodes | ${graph.summary.totalEdges} edges</div>
</body></html>`;
}

// ─── Main ───

async function main() {
  console.log('[overwatcher] Scanning .planning/ ...');

  // 1. Read project
  const graph = readPlanningDirectory({ projectRoot: PROJECT_ROOT });
  console.log(`[overwatcher] Found ${graph.summary.totalNodes} nodes, ${graph.summary.totalEdges} edges`);

  // 2. Analyse (if Pi modules available)
  let analysis = null;
  let arch = null;
  if (analyseModule) {
    try {
      analysis = analyseModule.analyse(graph);
      console.log(`[overwatcher] Analysis: ${analysis.summary.totalIssues} issues found`);
    } catch (e) {
      console.warn(`[overwatcher] Analysis failed: ${e.message}`);
    }
  }

  // 3. Render
  let html;
  if (renderModule && arch) {
    html = renderModule.assembleMultiTabPage(graph, arch, { analysis });
    console.log('[overwatcher] Rendered with Pi multi-tab assembler');
  } else {
    html = basicRender(graph);
    console.log('[overwatcher] Rendered with basic renderer');
  }

  // 4. Write output
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, html);
  console.log(`[overwatcher] Signal map written to ${OUTPUT_FILE}`);

  // 5. Serve (optional)
  if (SERVE) {
    const http = require('http');
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      // Re-read on each request for live updates
      res.end(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    });
    server.listen(PORT, () => {
      console.log(`[overwatcher] Server running at http://localhost:${PORT}`);
      if (OPEN) {
        const { exec } = require('child_process');
        const cmd = process.platform === 'win32' ? 'start' :
                    process.platform === 'darwin' ? 'open' : 'xdg-open';
        exec(`${cmd} http://localhost:${PORT}`);
      }
    });
  }
}

main().catch(e => {
  console.error(`[overwatcher] Error: ${e.message}`);
  process.exit(1);
});
