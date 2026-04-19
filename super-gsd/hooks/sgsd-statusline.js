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

function readFrontmatter(filePath, limit = 40) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').slice(0, limit);
    const match = lines.join('\n').match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};
    const fm = {};
    for (const line of match[1].split('\n')) {
      const kv = line.match(/^(\w[\w_-]*)\s*:\s*(.*)$/);
      if (kv) {
        let val = kv[2].trim().replace(/^["']|["']$/g, '');
        // Try parse as number or bool
        if (/^\d+$/.test(val)) val = parseInt(val);
        else if (val === 'true') val = true;
        else if (val === 'false') val = false;
        fm[kv[1]] = val;
      }
    }
    return fm;
  } catch {
    return {};
  }
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

  // Read ROADMAP for progress count
  let completed = 0;
  let total = 0;
  try {
    const roadmap = fs.readFileSync(path.join(root, '.planning', 'ROADMAP.md'), 'utf8');
    const matches = roadmap.match(/^\- \[/gm);
    total = matches ? matches.length : 0;
    const doneMatches = roadmap.match(/^\- \[x\]/gm);
    completed = doneMatches ? doneMatches.length : 0;
  } catch {}

  // Milestone + phase progress
  const milestone = state.milestone || 'v?';
  const currentPhase = state.current_phase || '?';
  if (total > 0) {
    const pct = Math.round((completed / total) * 100);
    const bar = makeBar(pct, 6);
    const progressStr = `${milestone} P${currentPhase}/${total} ${bar} ${pct}%`;
    parts.push(colorByPct(progressStr, pct));
  } else {
    parts.push(`\x1b[33m${milestone}\x1b[0m`);
  }

  // Current agent activity (agent-level, not phase-level)
  const lastAgent = getLastAgent(root);
  if (lastAgent) {
    // Color by model: opus=purple, sonnet=blue, haiku=cyan
    const modelColor = lastAgent.model === 'opus' ? '\x1b[35m' :
                        lastAgent.model === 'sonnet' ? '\x1b[34m' :
                        lastAgent.model === 'haiku' ? '\x1b[36m' : '\x1b[37m';
    const agentStr = `${modelColor}${lastAgent.role}\x1b[0m \x1b[2m[${lastAgent.model}]\x1b[0m`;
    parts.push(agentStr);

    // Show agent's token cost if >0
    if (lastAgent.total > 0) {
      const t = lastAgent.total < 1000 ? `${lastAgent.total}` :
                lastAgent.total < 1000000 ? `${Math.round(lastAgent.total/1000)}K` :
                `${(lastAgent.total/1000000).toFixed(1)}M`;
      parts.push(`\x1b[33m${t}\x1b[0m`);
    }
  } else {
    // Fallback to phase state
    const phaseState = state.status || state.phase_state || '';
    const currentPlanDir = findCurrentPhaseDir(root, currentPhase);
    if (currentPlanDir) {
      const pendingPlan = findPendingPlan(currentPlanDir, currentPhase);
      if (pendingPlan) {
        parts.push(`\x1b[36m${phaseState || 'exec'} ${pendingPlan}\x1b[0m`);
      }
    }
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
