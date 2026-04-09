#!/usr/bin/env node
/**
 * PostToolUse hook: Stuck detection
 *
 * QA-04 COMPLIANCE: Warns agent after 3+ repeated tool calls on same file/command.
 *
 * Spec (QA-04): "Stuck detector hook warns agent after 3+ repeated tool calls
 * on the same file or command."
 *
 * Implementation:
 * - Tracks last 10 tool calls via tmp file (gsd-tool-history.json)
 * - Key = "ToolName:file_path" or "ToolName:command_prefix"
 * - Fires warning to stdout (Claude Code sees this as hook feedback) after 3+ repeats
 * - Resets history after warning to prevent spam
 * - Uses toUnixPath() for cross-platform path normalization (SAFE-01)
 *
 * Install in settings.json:
 * {
 *   "hooks": {
 *     "PostToolUse": [{
 *       "matcher": "Bash|Edit|Write",
 *       "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/gsd-stuck-detector.js", "timeout": 3 }]
 *     }]
 *   }
 * }
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function toUnixPath(p) {
  return p.replace(/^([A-Za-z]):\\/, (_, d) => `/mnt/${d.toLowerCase()}/`)
           .replace(/\\/g, '/');
}

const HISTORY_FILE = path.join(os.tmpdir(), 'gsd-tool-history.json');
const MAX_HISTORY = 10;
const REPEAT_THRESHOLD = 3;

try {
  const toolName = process.env.TOOL_NAME || '';
  const toolInput = process.env.TOOL_INPUT || '';

  // Load history
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try { history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch {}
  }

  // Extract key identifier
  let key = toolName;
  try {
    const input = JSON.parse(toolInput);
    if (input.file_path) key = `${toolName}:${toUnixPath(input.file_path)}`;
    else if (input.command) key = `${toolName}:${input.command.substring(0, 80)}`;
  } catch {}

  // Add to history
  history.push({ key, ts: Date.now() });
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);

  // Save history
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history));

  // Check for repeats
  const counts = {};
  for (const entry of history) {
    counts[entry.key] = (counts[entry.key] || 0) + 1;
  }

  for (const [action, count] of Object.entries(counts)) {
    if (count >= REPEAT_THRESHOLD) {
      // Output warning — Claude Code will see this as hook feedback
      console.log(`WARNING: "${action}" repeated ${count} times in last ${MAX_HISTORY} tool calls. You may be stuck. Stop, re-read the error, try a fundamentally different approach.`);

      // Reset history to avoid spamming
      fs.writeFileSync(HISTORY_FILE, '[]');
      break;
    }
  }
} catch (e) {
  // Silent fail
}
