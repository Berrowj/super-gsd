#!/usr/bin/env node
/* eslint-disable */
// ============================================================================
// sgsd-ctx — report current Claude Code session context usage as JSON
// ============================================================================
// Observability-only context gauge. The orchestrator must not checkpoint or stop
// because of context percentage; runtime compaction plus external state handles
// context management. Claude (the model) can't see its own token count, but the
// harness writes every assistant response's `usage`
// block to `~/.claude/projects/<encoded-cwd>/<session>.jsonl`. This script
// parses the latest assistant usage and emits:
//
//   { "tokens": 145000, "max": 1000000, "pct": 15, "model": "claude-opus-4-7[1m]", "session": "abc.jsonl" }
//
// Usage:
//   node sgsd-ctx.js                    → JSON to stdout
//   node sgsd-ctx.js --project /path    → override auto-detected project
//   node sgsd-ctx.js --pct              → print just the integer percent
//   node sgsd-ctx.js --threshold 70     → exit 2 for warning integrations only
//
// Ports the logic from super-gsd/scripts/sgsd-mission-control.ps1:Get-SessionStats.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function encodeProjectPath(p) {
    // Match Claude Code's session-dir encoding:
    //   C:\Users\user\GSDedits  →  C--Users-user-GSDedits
    // Colon, backslash, forward-slash, and dot all become dashes.
    // Trailing separators stripped first so tab-completion artefacts don't fuzz.
    const stripped = p.replace(/[\\\/]+$/, '');
    return stripped.replace(/[:\\\/.]/g, '-');
}

function maxForModel(model, observedTokens) {
    // The Claude Code session JSONL records message.model WITHOUT the 1M suffix
    // (e.g. "claude-opus-4-7" even when the session is running on claude-opus-4-7[1m]).
    // The only reliable signal that a 1M variant is live is observing a usage
    // block whose input+cache total exceeds the 200k cap of the standard model.
    // Also honour SGSD_CTX_MAX env override for explicit control.
    if (process.env.SGSD_CTX_MAX) {
        const n = parseInt(process.env.SGSD_CTX_MAX, 10);
        if (Number.isFinite(n) && n > 0) return n;
    }
    if (!model) return 200000;
    if (/\[1m\]|-1m/.test(model)) return 1000000;
    // Inference: if observed tokens already exceed 200k, the session must be
    // on a 1M-context variant regardless of what the model string says.
    if (observedTokens && observedTokens > 200000) return 1000000;
    if (/opus|sonnet|haiku/i.test(model)) return 200000;
    return 200000;
}

function latestSessionJsonl(projectDir) {
    const encoded = encodeProjectPath(projectDir);
    const sessionsDir = path.join(os.homedir(), '.claude', 'projects', encoded);
    if (!fs.existsSync(sessionsDir)) return null;
    const entries = fs.readdirSync(sessionsDir)
        .filter(n => n.endsWith('.jsonl'))
        .map(n => {
            const full = path.join(sessionsDir, n);
            try { return { name: n, full, mtime: fs.statSync(full).mtimeMs }; }
            catch { return null; }
        })
        .filter(Boolean)
        .sort((a, b) => b.mtime - a.mtime);
    return entries[0] || null;
}

function tailLines(filePath, n) {
    // Read the last ~256 KB and pick the last n non-empty lines. Avoids
    // loading multi-MB session files for a quick usage probe.
    const stat = fs.statSync(filePath);
    const budget = Math.min(stat.size, 256 * 1024);
    const fd = fs.openSync(filePath, 'r');
    try {
        const buf = Buffer.alloc(budget);
        fs.readSync(fd, buf, 0, budget, stat.size - budget);
        const lines = buf.toString('utf8').split(/\r?\n/).filter(Boolean);
        return lines.slice(-n);
    } finally {
        fs.closeSync(fd);
    }
}

function parseUsage(projectDir) {
    const result = {
        tokens: 0,
        max: 200000,
        pct: 0,
        model: 'unknown',
        session: null
    };
    const session = latestSessionJsonl(projectDir);
    if (!session) return result;
    result.session = session.name;

    const lines = tailLines(session.full, 40);
    for (const line of lines) {
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }
        if (entry.type !== 'assistant' || !entry.message) continue;
        const usage = entry.message.usage;
        const model = entry.message.model;
        if (usage) {
            const total = (usage.input_tokens || 0)
                       + (usage.cache_read_input_tokens || 0)
                       + (usage.cache_creation_input_tokens || 0);
            if (total > result.tokens) result.tokens = total;
        }
        if (model && typeof model === 'string') result.model = model;
    }

    result.max = maxForModel(result.model, result.tokens);
    if (result.tokens > 0 && result.max > 0) {
        result.pct = Math.round((result.tokens / result.max) * 100);
    }
    return result;
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let projectDir = process.cwd();
let pctOnly = false;
let threshold = null;

for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--project' || a === '-p')      projectDir = args[++i];
    else if (a === '--pct')                   pctOnly = true;
    else if (a === '--threshold' || a === '-t') threshold = parseInt(args[++i], 10);
    else if (a === '--help' || a === '-h') {
        console.log('Usage: sgsd-ctx [--project PATH] [--pct] [--threshold N]');
        process.exit(0);
    }
}

const usage = parseUsage(projectDir);

if (pctOnly) {
    process.stdout.write(String(usage.pct) + '\n');
} else {
    process.stdout.write(JSON.stringify(usage) + '\n');
}

if (threshold !== null && Number.isFinite(threshold)) {
    if (usage.pct > threshold) process.exit(2);
    process.exit(0);
}
