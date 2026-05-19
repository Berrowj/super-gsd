#!/usr/bin/env node
// Super GSD Enhanced Statusline
// gsd-hook-version: super-gsd-1.0
//
// Shows a compact live status line with:
//   model │ M1.7 P84/88 [███░░] 47% │ executing plan 84-02 │ tokens: 42K │ ctx: [██░░░] 35%
//
// Reads:
//   - .planning/STATE.md frontmatter (milestone, phase, progress)
//   - .planning/ROADMAP.md (total/completed phases)
//   - .planning/metrics/token-log.jsonl (session token sum)
//   - .planning/phases/{current}-*/  (latest PLAN.md being worked on)
//
// Install: add to settings.json statusLine config:
//   {
//     "statusLine": {
//       "type": "command",
//       "command": "node ~/.claude/hooks/sgsd-statusline.js"
//     }
//   }
// Fixed 2026-04-19 (FINDING-14): previously referenced gsd-super-statusline.js
// which doesn't exist — install.sh copies this file as sgsd-statusline.js
// so the pointer must match.

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Utils ───

function toUnixPath(p) {
  return String(p).replace(/^([A-Za-z]):\\/, (_, d) => `/mnt/${d.toLowerCase()}/`)
                   .replace(/\\/g, '/');
}

function readFrontmatter(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {};
    const data = {};
    for (const line of match[1].split(/\r?\n/)) {
      const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (pair) data[pair[1]] = pair[2].replace(/^["']|["']$/g, '');
    }
    return data;
  } catch {
    return {};
  }
}

function getMilestonePhaseStats(root, milestone) {
  if (!milestone) return null;
  const phasesDir = path.join(root, '.planning', 'milestones', milestone, 'phases');
  if (!fs.existsSync(phasesDir)) return null;
  let total = 0, completed = 0;
  let current = null;
  let entries;
  try { entries = fs.readdirSync(phasesDir, { withFileTypes: true }); } catch { return null; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    total++;
    const dir = path.join(phasesDir, entry.name);
    let files;
    try { files = fs.readdirSync(dir); } catch { continue; }
    const verifyFile = files.find(f => /VERIFICATION\.md$/i.test(f));
    let isPass = false;
    if (verifyFile) {
      const fm = readFrontmatter(path.join(dir, verifyFile));
      if (fm.status && /^PASS/.test(fm.status)) isPass = true;
    }
    if (isPass) {
      completed++;
    } else if (!current) {
      const m = entry.name.match(/^(\d+(?:\.\d+)?)-/);
      current = m ? m[1] : entry.name;
    }
  }
  return { total, completed, current };
}

function getCodexStatus(root) {
  const logPath = path.join(root, '.planning', 'metrics', 'codex-executor-log.jsonl');
  if (!fs.existsSync(logPath)) return null;
  try {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return null;
    const last = lines[lines.length - 1];
    const tsMatch = last.match(/"ts":"([^"]+)"/);
    const exitMatch = last.match(/"exit":(-?\d+)/);
    const modeMatch = last.match(/"mode":"([^"]+)"/);
    if (!tsMatch || !exitMatch) return null;
    const tsMs = Date.parse(tsMatch[1]);
    const ago = isNaN(tsMs) ? null : Math.max(0, Math.floor((Date.now() - tsMs) / 1000));
    return { exit: parseInt(exitMatch[1], 10), ago, mode: modeMatch ? modeMatch[1] : 'unknown' };
  } catch { return null; }
}

function formatAgo(seconds) {
  if (seconds == null) return '?';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function findProjectRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, '.planning'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function makeBar(pct, width = 8) {
  const filled = Math.round((pct / 100) * width);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
}

function colorByPct(text, pct, invert = false) {
  // invert=true: high is BAD (context usage). default: high is GOOD (progress)
  const effective = invert ? pct : 100 - pct;
  if (effective < 25) return `\x1b[32m${text}\x1b[0m`; // green
  if (effective < 50) return `\x1b[33m${text}\x1b[0m`; // yellow
  if (effective < 75) return `\x1b[38;5;208m${text}\x1b[0m`; // orange
  return `\x1b[31m${text}\x1b[0m`; // red
}

// ─── Read input ───

let input = '';
const stdinTimeout = setTimeout(() => {
  emit('');
  process.exit(0);
}, 3000);

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    render(data);
  } catch {
    emit('');
  }
});

// ─── Emit ───
function emit(s) { process.stdout.write(s); }

// ─── Render ───

function render(data) {
  const parts = [];

  // Model
  const model = data.model?.display_name || 'Claude';
  parts.push(`\x1b[2m${model}\x1b[0m`);

  // Project root + GSD state
  const root = findProjectRoot();
  if (!root) {
    parts.push(`\x1b[2m${path.basename(data.workspace?.current_dir || process.cwd())}\x1b[0m`);
    emit(parts.join(' \u2502 '));
    return;
  }

  // Read STATE.md
  const statePath = path.join(root, '.planning', 'STATE.md');
  const state = readFrontmatter(statePath);

  // Milestone + phase progress
  const milestone = state.milestone || 'v?';
  const phaseStats = getMilestonePhaseStats(root, milestone);
  if (phaseStats && phaseStats.total > 0) {
    const pct = Math.round((phaseStats.completed / phaseStats.total) * 100);
    const bar = makeBar(pct, 6);
    const currentTag = phaseStats.current ? ` P${phaseStats.current}` : '';
    const progressStr = `${milestone}${currentTag} ${phaseStats.completed}/${phaseStats.total} ${bar} ${pct}%`;
    parts.push(colorByPct(progressStr, pct));
  } else {
    parts.push(`\x1b[33m${milestone}\x1b[0m`);
  }

  // Codex status badge
  const codex = getCodexStatus(root);
  if (codex) {
    const color = codex.exit === 0 ? '\x1b[32m' : '\x1b[31m';
    const label = codex.exit === 0 ? 'codex:ok' : 'codex:fail';
    parts.push(`${color}${label}\x1b[0m \x1b[2m${formatAgo(codex.ago)}\x1b[0m`);
  }

  // Session total tokens
  const tokenStr = getSessionTokens(root);
  if (tokenStr) parts.push(`\x1b[2mΣ${tokenStr}\x1b[0m`);

  // Checkpoint indicator
  if (fs.existsSync(path.join(root, '.planning', 'ORCHESTRATOR-CHECKPOINT.md'))) {
    parts.push('\x1b[33m\u25A0 CHECKPOINT\x1b[0m');
  }

  // Context usage
  const remaining = data.context_window?.remaining_percentage;
  if (remaining != null) {
    const AUTO_COMPACT_BUFFER = 16.5;
    const usable = Math.max(0, ((remaining - AUTO_COMPACT_BUFFER) / (100 - AUTO_COMPACT_BUFFER)) * 100);
    const used = Math.max(0, Math.min(100, Math.round(100 - usable)));
    const bar = makeBar(used, 5);
    parts.push(colorByPct(`ctx ${bar} ${used}%`, used, true));
  }

  emit(parts.join(' \u2502 '));
}

// ─── Helpers for phase state ───

function findCurrentPhaseDir(root, currentPhase) {
  if (!currentPhase || currentPhase === '?') return null;
  const phasesRoot = path.join(root, '.planning', 'phases');
  if (!fs.existsSync(phasesRoot)) return null;
  try {
    const padded = String(currentPhase).padStart(2, '0');
    const entries = fs.readdirSync(phasesRoot);
    const match = entries.find(e => e.startsWith(padded + '-') || e.startsWith(String(currentPhase) + '-'));
    return match ? path.join(phasesRoot, match) : null;
  } catch {
    return null;
  }
}

function findPendingPlan(phaseDir, phaseNum) {
  try {
    const files = fs.readdirSync(phaseDir);
    const plans = files.filter(f => /-\d+-PLAN\.md$/.test(f)).sort();
    // Find first plan without matching SUMMARY
    for (const plan of plans) {
      const summary = plan.replace('PLAN', 'SUMMARY');
      if (!files.includes(summary)) {
        const match = plan.match(/(\d+)-(\d+)-PLAN\.md$/);
        if (match) return `${match[1]}-${match[2]}`;
      }
    }
    // All done — return last completed
    if (plans.length > 0) {
      const last = plans[plans.length - 1].match(/(\d+)-(\d+)-PLAN\.md$/);
      if (last) return `${last[1]}-${last[2]} done`;
    }
  } catch {}
  return null;
}

function getSessionTokens(root) {
  try {
    const logPath = path.join(root, '.planning', 'metrics', 'token-log.jsonl');
    if (!fs.existsSync(logPath)) return null;
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean).slice(-50);
    let total = 0;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        total += entry.total || 0;
      } catch {}
    }
    if (total === 0) return null;
    if (total < 1000) return `${total}`;
    if (total < 1000000) return `${Math.round(total / 1000)}K`;
    return `${(total / 1000000).toFixed(1)}M`;
  } catch {
    return null;
  }
}

function getLastAgent(root) {
  try {
    const logPath = path.join(root, '.planning', 'metrics', 'token-log.jsonl');
    if (!fs.existsSync(logPath)) return null;
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return null;

    // Last 3 entries: most recent agent activity
    const recent = lines.slice(-3);
    for (let i = recent.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(recent[i]);
        // Prefer entries with a real role name (not "unknown")
        if (entry.role || entry.description) {
          let role = entry.role || entry.description || 'agent';
          // Shorten common prefixes
          role = role.replace(/^gsd-/, '').replace(/^sgsd-/, '');
          // Truncate
          if (role.length > 22) role = role.substring(0, 22) + '…';
          return {
            role,
            model: (entry.model || 'unknown').toLowerCase(),
            total: entry.total || 0,
            ts: entry.ts
          };
        }
      } catch {}
    }
    return null;
  } catch {
    return null;
  }
}
