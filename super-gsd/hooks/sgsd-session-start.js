#!/usr/bin/env node
/**
 * Super GSD SessionStart hook — checkpoint resume briefing + handoff pairing
 *
 * On every new session:
 *   1. Detects ORCHESTRATOR-CHECKPOINT.md and injects resume briefing.
 *   2. Detects if this session is a handoff target (latest handoff-log.jsonl row
 *      has to_session_id: null within last 60s) and pairs it with current PID.
 *
 * Windows path fix (RESEARCH V5):
 *   Uses path.join(process.cwd(), ...) — avoids the /mnt/c/... path bug
 *   that occurs on native Windows Node when using Unix-path conversion helpers.
 *
 * Install in settings.json:
 * {
 *   "hooks": {
 *     "SessionStart": [{
 *       "hooks": [{ "type": "command", "command": "node super-gsd/hooks/sgsd-session-start.js", "timeout": 5 }]
 *     }]
 *   }
 * }
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// Path construction uses path.join(process.cwd(), ...) — safe on Windows Node.
// Avoid Unix-path conversion helpers: they produce /mnt/c/... paths that break native FS ops.
const CHECKPOINT_PATH  = path.join(process.cwd(), '.planning', 'ORCHESTRATOR-CHECKPOINT.md');
const STATE_PATH       = path.join(process.cwd(), '.planning', 'STATE.md');
const BRV_PATH         = path.join(process.cwd(), '.brv');
const HANDOFF_LOG_PATH = path.join(process.cwd(), '.planning', 'metrics', 'handoff-log.jsonl');

try {
  const parts = [];

  // ── 1. Checkpoint detection ───────────────────────────────────────────────
  if (fs.existsSync(CHECKPOINT_PATH)) {
    const checkpoint = fs.readFileSync(CHECKPOINT_PATH, 'utf8');
    const fmMatch = checkpoint.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      parts.push('CHECKPOINT DETECTED — Previous session was interrupted.');
      parts.push('Resume point: ' + fmMatch[1]);
      parts.push('Say "continue" or "go" to resume from checkpoint.');
    }
  }

  // ── 2. STATE.md briefing (only when no checkpoint) ───────────────────────
  if (fs.existsSync(STATE_PATH) && parts.length === 0) {
    const state = fs.readFileSync(STATE_PATH, 'utf8');
    const lines = state.split('\n').filter(function(l) { return l.trim(); }).slice(0, 5);
    if (lines.length > 0) {
      parts.push('GSD project detected. Current state:');
      parts.push(lines.join('\n'));
    }
  }

  // ── 3. ByteRover context ─────────────────────────────────────────────────
  if (fs.existsSync(BRV_PATH)) {
    parts.push('ByteRover context tree: active');
  }

  if (parts.length > 0) {
    console.log(parts.join('\n'));
  }
} catch (e) {
  // Silent fail — session start should never block
}

// ── HANDOFF-03: pair parent+child session IDs ─────────────────────────────
// If the latest handoff-log.jsonl row has to_session_id: null AND was written
// within the last 60 seconds, this session is the handoff target — update the
// row with the current PID to pair parent + child sessions.
try {
  if (fs.existsSync(HANDOFF_LOG_PATH)) {
    var rawLines = fs.readFileSync(HANDOFF_LOG_PATH, 'utf8').split('\n').filter(Boolean);
    if (rawLines.length > 0) {
      var lastRow;
      try { lastRow = JSON.parse(rawLines[rawLines.length - 1]); } catch (parseErr) {}
      // CRITICAL fix (Phase 20 ATC): require reason==='spawned' to avoid
      // false-pairing with refused/dry_run rows. Without this guard, any
      // unrelated claude session starting within 60s of a refused row
      // would incorrectly pair itself as a handoff target.
      if (lastRow && lastRow.to_session_id === null && lastRow.reason === 'spawned') {
        // Only pair if within 60-second spawn window
        var rowTs = lastRow.ts ? new Date(lastRow.ts).getTime() : 0;
        var nowMs  = Date.now();
        if (rowTs > 0 && (nowMs - rowTs) <= 60000) {
          lastRow.to_session_id = 'pid-' + process.pid;
          rawLines[rawLines.length - 1] = JSON.stringify(lastRow);
          fs.writeFileSync(HANDOFF_LOG_PATH, rawLines.join('\n') + '\n');
        }
      }
    }
  }
} catch (e) {
  // Non-fatal — session continues if pairing fails
}
