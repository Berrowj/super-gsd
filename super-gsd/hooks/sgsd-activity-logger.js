#!/usr/bin/env node
/**
 * Super GSD Activity Logger — PreToolUse hook
 *
 * Logs EVERY tool call to .planning/metrics/activity-log.jsonl so the
 * dashboard can show live agent activity. This is the "thinking out loud"
 * view — you see every Read/Write/Bash/Edit as it happens.
 *
 * Log format (one line per tool call):
 *   {"ts":"ISO","tool":"Read","target":"file.md","agent":"gsd-executor","phase":87}
 *
 * Install in settings.json:
 *   {
 *     "hooks": {
 *       "PreToolUse": [{
 *         "matcher": "*",
 *         "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/sgsd-activity-logger.js", "timeout": 2 }]
 *       }]
 *     }
 *   }
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function toUnixPath(p) {
  return String(p).replace(/^([A-Za-z]):\\/, (_, d) => `/mnt/${d.toLowerCase()}/`)
                   .replace(/\\/g, '/');
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

function truncate(s, max = 100) {
  if (!s) return '';
  s = String(s).replace(/\n/g, ' ').trim();
  return s.length > max ? s.substring(0, max) + '…' : s;
}

try {
  const root = findProjectRoot();
  if (!root) process.exit(0);

  const logPath = path.join(toUnixPath(root), '.planning', 'metrics', 'activity-log.jsonl');

  // Make sure directory exists
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Parse tool input from env
  const toolName = process.env.TOOL_NAME || 'unknown';
  let toolInput = {};
  try {
    toolInput = JSON.parse(process.env.TOOL_INPUT || '{}');
  } catch {}

  // Extract a meaningful "target" — what the tool is doing
  let target = '';
  switch (toolName) {
    case 'Read':
      target = toolInput.file_path || '';
      if (toolInput.offset || toolInput.limit) {
        target += ` [${toolInput.offset || 0}:${toolInput.limit || '∞'}]`;
      }
      break;
    case 'Write':
      target = toolInput.file_path || '';
      break;
    case 'Edit':
      target = toolInput.file_path || '';
      break;
    case 'Bash':
      target = truncate(toolInput.command, 80);
      break;
    case 'Glob':
      target = toolInput.pattern || '';
      break;
    case 'Grep':
      target = `"${truncate(toolInput.pattern, 40)}" in ${toolInput.path || '.'}`;
      break;
    case 'Agent':
      target = `${toolInput.subagent_type || 'agent'}: ${truncate(toolInput.description || toolInput.prompt, 60)}`;
      break;
    case 'WebFetch':
      target = toolInput.url || '';
      break;
    case 'TaskCreate':
    case 'TaskUpdate':
      target = truncate(toolInput.activeForm || toolInput.content, 80);
      break;
    default:
      target = truncate(JSON.stringify(toolInput), 80);
  }

  // Try to detect current phase from STATE.md (best effort — single file read)
  let phase = '';
  try {
    const stateContent = fs.readFileSync(path.join(root, '.planning', 'STATE.md'), 'utf8');
    const match = stateContent.match(/current_phase:\s*(\S+)/);
    if (match) phase = match[1];
  } catch {}

  // Write log entry
  const entry = {
    ts: new Date().toISOString(),
    tool: toolName,
    target: truncate(target, 120),
    phase: phase || null
  };

  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');

  // Rotate if file exceeds 10MB (keep last 5MB)
  try {
    const stat = fs.statSync(logPath);
    if (stat.size > 10 * 1024 * 1024) {
      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.trim().split('\n');
      const keep = lines.slice(-5000);
      fs.writeFileSync(logPath, keep.join('\n') + '\n');
    }
  } catch {}
} catch (e) {
  // Silent fail — logging must never block tool execution
}
