#!/usr/bin/env node
/* eslint-disable */
// ============================================================================
// Super GSD · merge-settings.js
// ============================================================================
// Idempotent merge of super-gsd/config/settings-overlay.json into the user's
// ~/.claude/settings.json. Invoked by install.sh Step 3b.
//
// Fix for FINDING-17 (Phase 8 self-audit, severity: CRITICAL):
//   install.sh copied hook .js files to ~/.claude/hooks/ but NEVER merged the
//   overlay into settings.json, so every hook was installed-but-dormant. A
//   fresh install had zero hooks active — gsd-session-start, gsd-token-logger,
//   gsd-stuck-detector, gsd-checkpoint-writer, gsd-context-monitor all silent.
//
// Merge strategy:
//   - Deep-merge hooks object: for each event (SessionStart, PostToolUse, ...)
//     append overlay entries to user's array.
//   - Idempotent: entries matched by command string + matcher + type. If an
//     identical entry already exists, skip. Running the installer twice does
//     not produce duplicate hook registrations.
//   - Preserves every existing user entry; only ADDS.
//   - Skips the _comment key from the overlay.
//   - Atomic write: settings.json.tmp + rename.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function usage() {
    console.error('Usage: merge-settings.js <overlay.json> <target.json>');
    console.error('  Idempotently merges the overlay\'s `hooks` block into the target.');
    process.exit(2);
}

if (process.argv.length < 4) usage();
const overlayPath = process.argv[2];
const targetPath = process.argv[3];

function readJsonOrEmpty(p) {
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
    if (!raw.trim()) return {};
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.error(`ERROR: ${p} is not valid JSON: ${e.message}`);
        process.exit(3);
    }
}

function isSameEntry(a, b) {
    // An entry has: { matcher?, hooks: [{ type, command, timeout? }, ...] }
    // Match if their matchers are equal AND they share a command string.
    if ((a.matcher || '') !== (b.matcher || '')) return false;
    const cmdsA = (a.hooks || []).map(h => h.command).filter(Boolean);
    const cmdsB = (b.hooks || []).map(h => h.command).filter(Boolean);
    if (cmdsA.length !== cmdsB.length) return false;
    for (const c of cmdsA) {
        if (!cmdsB.includes(c)) return false;
    }
    return true;
}

const overlay = readJsonOrEmpty(overlayPath);
const target = readJsonOrEmpty(targetPath);

if (!overlay.hooks || typeof overlay.hooks !== 'object') {
    console.error(`ERROR: ${overlayPath} has no "hooks" object. Nothing to merge.`);
    process.exit(4);
}

if (!target.hooks || typeof target.hooks !== 'object') {
    target.hooks = {};
}

let added = 0;
let skipped = 0;

for (const event of Object.keys(overlay.hooks)) {
    if (event === '_comment') continue;
    const overlayEntries = overlay.hooks[event] || [];
    if (!Array.isArray(overlayEntries)) continue;
    if (!Array.isArray(target.hooks[event])) target.hooks[event] = [];

    for (const entry of overlayEntries) {
        const dup = target.hooks[event].find(existing => isSameEntry(existing, entry));
        if (dup) {
            skipped++;
            continue;
        }
        target.hooks[event].push(entry);
        added++;
    }
}

// Atomic write
const tmpPath = targetPath + '.tmp';
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(tmpPath, JSON.stringify(target, null, 2) + '\n', 'utf8');
fs.renameSync(tmpPath, targetPath);

console.log(`[merge-settings] ${added} added, ${skipped} already-present → ${targetPath}`);
