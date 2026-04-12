#!/usr/bin/env node
/**
 * Super GSD Heartbeat — PostToolUse hook
 *
 * Pairs with sgsd-activity-logger.js (PreToolUse). Together they give the
 * dashboard enough signal to distinguish three states:
 *   - IDLE     : last PreToolUse is old (no tools running)
 *   - RUNNING  : last PreToolUse is recent, no matching PostToolUse yet
 *   - HUNG     : last PreToolUse is old AND no PostToolUse after it — silent failure
 *
 * Log format (one line per completion) → .planning/metrics/heartbeat.jsonl:
 *   {"ts":"ISO","tool":"Bash","status":"complete","duration_ms":342}
 *
 * Install in settings.json:
 *   {
 *     "hooks": {
 *       "PostToolUse": [{
 *         "matcher": "*",
 *         "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/sgsd-heartbeat.js", "timeout": 2 }]
 *       }]
 *     }
 *   }
 */

const fs = require('fs');
const path = require('path');

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

let stdinBuf = '';
const stdinTimeout = setTimeout(() => process.exit(0), 2000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => stdinBuf += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  run(stdinBuf);
});

function run(stdinData) {
  try {
    const root = findProjectRoot();
    if (!root) process.exit(0);

    const logPath = path.join(root, '.planning', 'metrics', 'heartbeat.jsonl');
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let payload = {};
    try { payload = JSON.parse(stdinData || '{}'); } catch {}

    const toolName = payload.tool_name || 'unknown';
    const resp = payload.tool_response || {};

    // Best-effort status extraction
    let status = 'complete';
    if (resp && resp.is_error) status = 'error';
    if (payload.hook_event_name === 'PostToolUse' && resp && resp.error) status = 'error';

    // Best-effort size signal — an empty tool_response is the canary for the
    // "silent empty result" class of bugs the dashboard must flag.
    let bytes = 0;
    try {
      if (resp && typeof resp === 'object') bytes = JSON.stringify(resp).length;
      else if (typeof resp === 'string') bytes = resp.length;
    } catch {}

    const entry = {
      ts: new Date().toISOString(),
      tool: toolName,
      status,
      bytes,
      empty: bytes < 10
    };

    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');

    // Rotate if >5MB (keep last 2MB)
    try {
      const stat = fs.statSync(logPath);
      if (stat.size > 5 * 1024 * 1024) {
        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.trim().split('\n');
        fs.writeFileSync(logPath, lines.slice(-2000).join('\n') + '\n');
      }
    } catch {}
  } catch {
    // Silent fail — hooks must never block
  }
}
