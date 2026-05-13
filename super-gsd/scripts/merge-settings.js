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
//   - Expands hook commands under ~/.claude/hooks to absolute paths before
//     writing settings.json. Claude Code may execute hook commands through cmd
//     on Windows, where "~" is not expanded and Node treats it as a literal
//     project-relative path.
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
    const cmdsA = (a.hooks || []).map(h => normalizeCommand(h.command)).filter(Boolean);
    const cmdsB = (b.hooks || []).map(h => normalizeCommand(h.command)).filter(Boolean);
    if (cmdsA.length !== cmdsB.length) return false;
    for (const c of cmdsA) {
        if (!cmdsB.includes(c)) return false;
    }
    return true;
}

function homeSlash() {
    return os.homedir().replace(/\\/g, '/').replace(/\/+$/, '');
}

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function realizeCommand(command) {
    const raw = String(command || '');
    const home = homeSlash();
    return raw.replace(
        /node\s+["']?(~|\$HOME|%USERPROFILE%)[\\/]\.claude[\\/]hooks[\\/]([^"'\s]+)["']?/gi,
        (_, _homeToken, hookPath) => `node "${home}/.claude/hooks/${String(hookPath).replace(/\\/g, '/')}"`
    );
}

function normalizeCommand(command) {
    const home = escapeRegex(homeSlash());
    return realizeCommand(command)
        .replace(/"/g, '')
        .replace(/\$HOME/g, '~')
        .replace(/%USERPROFILE%/gi, '~')
        .replace(/\\/g, '/')
        .replace(new RegExp(home, 'gi'), '~')
        .replace(/\s+/g, ' ')
        .trim();
}

function realizeCommands(value) {
    if (Array.isArray(value)) return value.map(realizeCommands);
    if (!value || typeof value !== 'object') return value;
    const out = {};
    for (const [key, child] of Object.entries(value)) {
        out[key] = key === 'command' && typeof child === 'string'
            ? realizeCommand(child)
            : realizeCommands(child);
    }
    return out;
}

const overlay = realizeCommands(readJsonOrEmpty(overlayPath));
const target = realizeCommands(readJsonOrEmpty(targetPath));

let added = 0;
let skipped = 0;
let setScalars = 0;
let upgraded = 0;
let deduped = 0;

function dedupeExistingHooks(settings) {
    if (!settings.hooks || typeof settings.hooks !== 'object') return 0;
    let removed = 0;
    for (const event of Object.keys(settings.hooks)) {
        const entries = settings.hooks[event];
        if (!Array.isArray(entries)) continue;
        const kept = [];
        for (const entry of entries) {
            if (kept.find(existing => isSameEntry(existing, entry))) {
                removed++;
                continue;
            }
            kept.push(entry);
        }
        settings.hooks[event] = kept;
    }
    return removed;
}

function isSgsdStatusLine(value) {
    const command = normalizeCommand(value && value.command);
    return command.includes('/.claude/hooks/sgsd-statusline.js') ||
        command.includes('sgsd-statusline.ps1');
}

function isSameStatusLine(a, b) {
    return normalizeCommand(a && a.command) === normalizeCommand(b && b.command);
}

deduped += dedupeExistingHooks(target);

function isStopHandoffLauncher(entry) {
    const cmds = (entry.hooks || []).map(h => normalizeCommand(h.command)).filter(Boolean);
    return cmds.length === 1 && cmds[0] === 'node ~/.claude/hooks/sgsd-stop-handoff.js';
}

function isLegacyStopHandoff(entry) {
    const cmds = (entry.hooks || []).map(h => normalizeCommand(h.command)).filter(Boolean);
    if (cmds.length !== 1) return false;
    const command = cmds[0];
    return command.includes('/.claude/super-gsd/scripts/sgsd-stop-handoff.sh') ||
        command.includes('~/.claude/super-gsd/scripts/sgsd-stop-handoff.sh');
}

function shouldUpgradeEntry(event, existing, overlayEntry) {
    if (event !== 'Stop') return false;
    if ((existing.matcher || '') !== (overlayEntry.matcher || '')) return false;
    return isStopHandoffLauncher(overlayEntry) && isLegacyStopHandoff(existing);
}

// ── Merge scalar/object top-level keys (statusLine, env, etc.) ──
// These are single-value keys, not arrays. Overlay overwrites target ONLY
// if target doesn't already have the key. That way a user who has tuned
// their statusLine config keeps their version on subsequent installs.
for (const key of Object.keys(overlay)) {
    if (key === '_comment' || key === 'hooks') continue;
    if (Object.prototype.hasOwnProperty.call(target, key)) {
        if (key === 'statusLine' && isSgsdStatusLine(target[key]) && !isSameStatusLine(target[key], overlay[key])) {
            target[key] = overlay[key];
            upgraded++;
            continue;
        }
        skipped++;
    } else {
        target[key] = overlay[key];
        setScalars++;
    }
}

// ── Merge hooks (array-typed per event) ──
if (overlay.hooks && typeof overlay.hooks === 'object') {
    if (!target.hooks || typeof target.hooks !== 'object') {
        target.hooks = {};
    }
    for (const event of Object.keys(overlay.hooks)) {
        if (event === '_comment') continue;
        const overlayEntries = overlay.hooks[event] || [];
        if (!Array.isArray(overlayEntries)) continue;
        if (!Array.isArray(target.hooks[event])) target.hooks[event] = [];

        for (const entry of overlayEntries) {
            const upgradeIndex = target.hooks[event].findIndex(existing => shouldUpgradeEntry(event, existing, entry));
            if (upgradeIndex >= 0) {
                target.hooks[event][upgradeIndex] = entry;
                upgraded++;
                continue;
            }
            const dup = target.hooks[event].find(existing => isSameEntry(existing, entry));
            if (dup) {
                skipped++;
                continue;
            }
            target.hooks[event].push(entry);
            added++;
        }
    }
}

// Atomic write
const tmpPath = targetPath + '.tmp';
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(tmpPath, JSON.stringify(target, null, 2) + '\n', 'utf8');
fs.renameSync(tmpPath, targetPath);

if (upgraded > 0) {
    console.log(`[merge-settings] ${upgraded} legacy hook-entries upgraded`);
}
if (deduped > 0) {
    console.log(`[merge-settings] ${deduped} duplicate hook-entries removed`);
}

console.log(`[merge-settings] ${added} hook-entries added, ${setScalars} top-level keys set, ${skipped} already-present → ${targetPath}`);
