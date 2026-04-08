#!/usr/bin/env node
/**
 * PostToolUse hook: Checkpoint writer
 *
 * After git commits during GSD execution, writes a lightweight
 * checkpoint file so sessions can resume after context reset.
 *
 * Install in settings.json:
 * {
 *   "hooks": {
 *     "PostToolUse": [{
 *       "matcher": "Bash",
 *       "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/gsd-checkpoint-writer.js", "timeout": 3 }]
 *     }]
 *   }
 * }
 */

const fs = require('fs');
const path = require('path');

const CHECKPOINT_FILE = path.join(process.cwd(), '.planning', 'ORCHESTRATOR-CHECKPOINT.json');

try {
  const command = process.env.TOOL_INPUT || '';

  // Only trigger on git commit commands
  if (!command.includes('git commit')) return;

  const output = process.env.TOOL_OUTPUT || '';

  // Extract commit hash from git output
  const hashMatch = output.match(/\[[\w-]+ ([a-f0-9]+)\]/);
  const hash = hashMatch ? hashMatch[1] : 'unknown';

  // Extract commit message
  const msgMatch = command.match(/-m\s+["']([^"']+)["']/);
  const message = msgMatch ? msgMatch[1] : 'unknown';

  // Read existing checkpoint or create new
  let checkpoint = { commits: [], last_updated: null };
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try { checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8')); } catch {}
  }

  checkpoint.commits.push({
    hash,
    message: message.substring(0, 120),
    ts: new Date().toISOString()
  });
  checkpoint.last_updated = new Date().toISOString();

  // Keep last 20 commits
  if (checkpoint.commits.length > 20) {
    checkpoint.commits = checkpoint.commits.slice(-20);
  }

  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
} catch (e) {
  // Silent fail
}
