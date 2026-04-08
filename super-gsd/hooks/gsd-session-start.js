#!/usr/bin/env node
/**
 * SessionStart hook: Checkpoint detection + auto-resume briefing
 *
 * On every new session, checks for ORCHESTRATOR-CHECKPOINT.md.
 * If found, injects a resume briefing into the conversation.
 *
 * Install in settings.json:
 * {
 *   "hooks": {
 *     "SessionStart": [{
 *       "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/gsd-session-start.js", "timeout": 5 }]
 *     }]
 *   }
 * }
 */

const fs = require('fs');
const path = require('path');

const CHECKPOINT_PATH = path.join(process.cwd(), '.planning', 'ORCHESTRATOR-CHECKPOINT.md');
const STATE_PATH = path.join(process.cwd(), '.planning', 'STATE.md');

try {
  const parts = [];

  // Check for checkpoint
  if (fs.existsSync(CHECKPOINT_PATH)) {
    const checkpoint = fs.readFileSync(CHECKPOINT_PATH, 'utf8');

    // Extract frontmatter
    const fmMatch = checkpoint.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const fm = fmMatch[1];
      parts.push('CHECKPOINT DETECTED — Previous session was interrupted.');
      parts.push(`Resume point: ${fm}`);
      parts.push('Say "continue" or "go" to resume from checkpoint.');
    }
  }

  // Check for STATE.md
  if (fs.existsSync(STATE_PATH)) {
    const state = fs.readFileSync(STATE_PATH, 'utf8');
    // Extract first 5 meaningful lines (skip blank lines)
    const lines = state.split('\n').filter(l => l.trim()).slice(0, 5);
    if (lines.length > 0 && !parts.length) {
      parts.push('GSD project detected. Current state:');
      parts.push(lines.join('\n'));
    }
  }

  // Check for ByteRover
  const brvPath = path.join(process.cwd(), '.brv');
  if (fs.existsSync(brvPath)) {
    parts.push('ByteRover context tree: active');
  }

  if (parts.length > 0) {
    console.log(parts.join('\n'));
  }
} catch (e) {
  // Silent fail — session start should never block
}
