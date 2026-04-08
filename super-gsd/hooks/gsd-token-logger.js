#!/usr/bin/env node
/**
 * PostToolUse hook: Token usage estimator
 *
 * Fires after Agent tool calls. Estimates token usage from
 * tool input/output and appends to token-log.jsonl.
 *
 * Install in settings.json:
 * {
 *   "hooks": {
 *     "PostToolUse": [{
 *       "matcher": "Agent",
 *       "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/gsd-token-logger.js", "timeout": 3 }]
 *     }]
 *   }
 * }
 */

const fs = require('fs');
const path = require('path');

function toUnixPath(p) {
  return p.replace(/^([A-Za-z]):\\/, (_, d) => `/mnt/${d.toLowerCase()}/`)
           .replace(/\\/g, '/');
}

const LOG_FILE = path.join(toUnixPath(process.cwd()), '.planning', 'metrics', 'token-log.jsonl');

try {
  const input = JSON.parse(process.env.TOOL_INPUT || '{}');
  const output = process.env.TOOL_OUTPUT || '';

  // Estimate tokens: ~1.3 tokens per word
  const inputWords = (JSON.stringify(input).match(/\S+/g) || []).length;
  const outputWords = (output.match(/\S+/g) || []).length;
  const estInput = Math.round(inputWords * 1.3);
  const estOutput = Math.round(outputWords * 1.3);

  // Extract model from agent call if available
  const model = input.model || 'unknown';
  const description = input.description || 'unknown';

  const entry = {
    ts: new Date().toISOString(),
    tool: 'Agent',
    model,
    description,
    est_input: estInput,
    est_output: estOutput,
    total: estInput + estOutput
  };

  // Ensure directory exists
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
} catch (e) {
  // Silent fail — logging should never break the workflow
}
