#!/usr/bin/env node
/**
 * PostToolUse hook: Context usage monitor + timeout tracker
 *
 * Monitors context window usage and elapsed time.
 * Injects warnings at thresholds to prevent context death.
 * Also tracks elapsed time per phase for timeout warnings.
 *
 * Install in settings.json:
 * {
 *   "hooks": {
 *     "PostToolUse": [{
 *       "matcher": "Agent|Read|Write|Edit|Bash",
 *       "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/gsd-context-monitor.js", "timeout": 3 }]
 *     }]
 *   }
 * }
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const TIMER_FILE = path.join(os.tmpdir(), 'gsd-phase-timer.json');
const CHECKPOINT_WARNED = path.join(os.tmpdir(), 'gsd-checkpoint-warned');

try {
  // Track phase timing
  let timer = { start: Date.now(), tool_calls: 0 };
  if (fs.existsSync(TIMER_FILE)) {
    try { timer = JSON.parse(fs.readFileSync(TIMER_FILE, 'utf8')); } catch {}
  }

  timer.tool_calls = (timer.tool_calls || 0) + 1;
  const elapsed = Math.floor((Date.now() - timer.start) / 1000 / 60); // minutes

  fs.writeFileSync(TIMER_FILE, JSON.stringify(timer));

  const warnings = [];

  // Time-based warnings
  if (elapsed >= 35 && timer.tool_calls % 5 === 0) {
    warnings.push('TIMEOUT WARNING (35min): STOP new work. Commit everything, write summary, finish this unit.');
  } else if (elapsed >= 25 && timer.tool_calls % 10 === 0) {
    warnings.push('TIME WARNING (25min): Start wrapping up. Commit working code, write partial summary if needed.');
  } else if (elapsed >= 15 && timer.tool_calls % 20 === 0) {
    warnings.push(`TIME NOTE (${elapsed}min elapsed): Ensure you're making progress.`);
  }

  // Context usage check (approximate via tool call count)
  // Rough heuristic: >80 tool calls in a session likely means >70% context
  if (timer.tool_calls > 80 && !fs.existsSync(CHECKPOINT_WARNED)) {
    warnings.push('CONTEXT WARNING: High tool call count. Consider writing checkpoint if context is filling.');
    fs.writeFileSync(CHECKPOINT_WARNED, Date.now().toString());
  }

  if (warnings.length > 0) {
    console.log(warnings.join('\n'));
  }
} catch (e) {
  // Silent fail
}
