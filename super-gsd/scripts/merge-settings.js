#!/usr/bin/env node
/* eslint-disable */
// ============================================================================
// Super GSD · merge-settings.js
// ============================================================================
// Idempotent merge of Claude settings overlays into global or repo-local
// settings.json targets. Invoked by install.sh.
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
const { preflightHookRegistrations } = require('./lib/hook-registration-preflight.cjs');

const SELF_TEST_REPO_LOCAL = '--self-test-repo-local-hooks';
const REPO_LOCAL_MODE = '--repo-local-hooks';

function usage() {
    console.error('Usage: merge-settings.js <overlay.json> <target.json>');
    console.error('       merge-settings.js --repo-local-hooks <overlay.json> <target.json> <repo-root>');
    console.error('       merge-settings.js --self-test-repo-local-hooks');
    console.error('  Idempotently merges the overlay\'s `hooks` block into the target.');
    process.exit(2);
}

function readJsonOrEmpty(p) {
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
    if (!raw.trim()) return {};
    try {
        return JSON.parse(raw);
    } catch (e) {
        const error = new Error(`${p} is not valid JSON: ${e.message}`);
        error.exitCode = 3;
        throw error;
    }
}

function hookLaunchKey(hook, ignoreArgs) {
    const command = normalizeCommand(hook && hook.command);
    if (!command) return '';
    if (ignoreArgs) return command;
    const args = hook && Array.isArray(hook.args)
        ? hook.args.map(arg => normalizeCommand(arg)).filter(Boolean)
        : [];
    return [command, ...args].join(' ');
}

function repoLocalHookId(entry) {
    if (!entry || entry.sgsd_managed !== true) return '';
    const id = String(entry.sgsd_hook_id || '').trim();
    return id ? id : '';
}

function isSameEntry(a, b, options) {
    const repoLocal = !!(options && options.repoLocal);
    if (repoLocal) {
        const idA = repoLocalHookId(a);
        const idB = repoLocalHookId(b);
        return !!idA && idA === idB;
    }
    const matcherSame = (a.matcher || '') === (b.matcher || '');
    if (!matcherSame) return false;
    const cmdsA = (a.hooks || []).map(hook => hookLaunchKey(hook, false)).filter(Boolean);
    const cmdsB = (b.hooks || []).map(hook => hookLaunchKey(hook, false)).filter(Boolean);
    if (cmdsA.length !== cmdsB.length) return false;
    for (const c of cmdsA) {
        if (!cmdsB.includes(c)) return false;
    }
    return true;
}

function comparePathKey(p) {
    const resolved = path.resolve(String(p || ''));
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function pathsEqual(a, b) {
    return comparePathKey(a) === comparePathKey(b);
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
        /(node|bash)\s+["']?(~|\$HOME|%USERPROFILE%)[\\/]\.claude[\\/]hooks[\\/]([^"'\s]+)["']?/gi,
        (_, interpreter, _homeToken, hookPath) => `${interpreter.toLowerCase()} "${home}/.claude/hooks/${String(hookPath).replace(/\\/g, '/')}"`
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

function isSubpath(root, candidate) {
    const rel = path.relative(comparePathKey(root), comparePathKey(candidate));
    return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function isHomeClaudePath(candidate) {
    const home = os.homedir();
    if (!home) return false;
    return isSubpath(path.join(home, '.claude'), candidate);
}

function nearestExistingAncestor(candidate) {
    let current = path.resolve(String(candidate || ''));
    for (;;) {
        try {
            fs.lstatSync(current);
            return current;
        } catch (e) {
            if (e && e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw e;
            const parent = path.dirname(current);
            if (parent === current) {
                throw new Error(`no existing ancestor for path: ${candidate}`);
            }
            current = parent;
        }
    }
}

function resolveViaNearestExistingAncestor(candidate) {
    const resolved = path.resolve(String(candidate || ''));
    const existing = nearestExistingAncestor(resolved);
    const realExisting = fs.realpathSync(existing);
    return {
        resolved,
        existing,
        realPath: path.resolve(realExisting, path.relative(existing, resolved))
    };
}

function existingPathChain(root, candidate) {
    const resolvedRoot = path.resolve(root);
    const resolvedCandidate = path.resolve(candidate);
    const chain = [resolvedRoot];
    const rel = path.relative(resolvedRoot, resolvedCandidate);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return chain;
    let current = resolvedRoot;
    for (const part of rel.split(/[\\/]+/).filter(Boolean)) {
        current = path.join(current, part);
        try {
            fs.lstatSync(current);
            chain.push(current);
        } catch (e) {
            if (e && e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw e;
            break;
        }
    }
    return chain;
}

function assertNoEscapingSymlinkChain(root, candidate, realRepoRoot) {
    for (const component of existingPathChain(root, candidate)) {
        const st = fs.lstatSync(component);
        if (!st.isSymbolicLink()) continue;
        const realComponent = fs.realpathSync(component);
        if (!isSubpath(realRepoRoot, realComponent)) {
            throw new Error(`repo-local target symlink/junction escapes realpath repo root: ${component} -> ${realComponent}`);
        }
    }
}

function validateRepoLocalTargetBoundary(repoLocal) {
    const realRepoRoot = fs.realpathSync(repoLocal.repoRoot);
    const claudeDir = path.dirname(repoLocal.targetPath);
    assertNoEscapingSymlinkChain(repoLocal.repoRoot, claudeDir, realRepoRoot);
    assertNoEscapingSymlinkChain(repoLocal.repoRoot, repoLocal.targetPath, realRepoRoot);

    const claudeReal = resolveViaNearestExistingAncestor(claudeDir).realPath;
    const parentReal = resolveViaNearestExistingAncestor(path.dirname(repoLocal.targetPath)).realPath;
    const targetReal = resolveViaNearestExistingAncestor(repoLocal.targetPath).realPath;
    for (const candidate of [claudeReal, parentReal, targetReal]) {
        if (!isSubpath(realRepoRoot, candidate)) {
            throw new Error(`repo-local target realpath escapes repo root: ${candidate} is outside ${realRepoRoot}`);
        }
    }
    if (isHomeClaudePath(targetReal)) {
        throw new Error(`repo-local target under user home .claude is forbidden: ${targetReal}`);
    }
}

function resolveRepoLocalTarget(targetPath, repoRoot) {
    const rawRoot = String(repoRoot || '');
    if (!path.isAbsolute(rawRoot)) {
        throw new Error(`repoRoot must be an absolute existing directory: ${rawRoot || '<empty>'}`);
    }
    const resolvedRepoRoot = path.resolve(rawRoot);
    let stat;
    try {
        stat = fs.statSync(resolvedRepoRoot);
    } catch (_e) {
        throw new Error(`repoRoot must be an existing directory: ${resolvedRepoRoot}`);
    }
    if (!stat.isDirectory()) {
        throw new Error(`repoRoot must be an existing directory: ${resolvedRepoRoot}`);
    }

    const resolvedTarget = path.resolve(String(targetPath || ''));
    if (isHomeClaudePath(resolvedTarget)) {
        throw new Error(`repo-local target under user home .claude is forbidden: ${resolvedTarget}`);
    }

    const derivedTarget = path.join(resolvedRepoRoot, '.claude', 'settings.json');
    if (!pathsEqual(resolvedTarget, derivedTarget)) {
        throw new Error(`repo-local target must be exactly ${derivedTarget}; refused ${resolvedTarget}`);
    }
    const repoLocal = { repoRoot: resolvedRepoRoot, targetPath: derivedTarget };
    validateRepoLocalTargetBoundary(repoLocal);
    return repoLocal;
}

function resolveRepoScriptArg(repoRoot, arg) {
    const root = path.resolve(repoRoot);
    const raw = String(arg || '');
    if (!raw.trim()) return raw;
    const resolved = path.resolve(root, raw);
    if (!isSubpath(root, resolved)) {
        throw new Error(`repo-local hook arg escapes target repo: ${raw}`);
    }
    return resolved;
}

function realizeRepoLocalHookArgs(value, repoRoot) {
    const root = path.resolve(repoRoot);
    if (Array.isArray(value)) return value.map(child => realizeRepoLocalHookArgs(child, root));
    if (!value || typeof value !== 'object') return value;
    const out = {};
    for (const [key, child] of Object.entries(value)) {
        out[key] = realizeRepoLocalHookArgs(child, root);
    }
    if (out.type === 'command' && out.command === 'node' && Array.isArray(out.args) && out.args.length > 0) {
        out.args = [resolveRepoScriptArg(root, out.args[0]), ...out.args.slice(1)];
    }
    return out;
}

function listFiles(root) {
    const out = [];
    function walk(dir) {
        if (!fs.existsSync(dir)) return;
        for (const name of fs.readdirSync(dir).sort()) {
            const p = path.join(dir, name);
            const st = fs.statSync(p);
            if (st.isDirectory()) {
                walk(p);
            } else if (st.isFile()) {
                out.push(path.relative(root, p).replace(/\\/g, '/'));
            }
        }
    }
    walk(root);
    return out;
}

function snapshotFiles(root) {
    const out = new Map();
    for (const rel of listFiles(root)) {
        out.set(rel, fs.readFileSync(path.join(root, rel), 'utf8'));
    }
    return out;
}

function changedFiles(before, after) {
    const keys = new Set([...before.keys(), ...after.keys()]);
    return [...keys].filter(key => before.get(key) !== after.get(key)).sort();
}

function assertSelfTest(condition, message) {
    if (!condition) throw new Error(message);
}

function matcherParts(value) {
    return String(value || '').split('|').map(part => part.trim()).filter(Boolean).sort();
}

function matcherKey(value) {
    return matcherParts(value).join('|');
}

function findHookEntriesByCommandMatcher(settings, event, command, matcher) {
    const entries = settings.hooks && Array.isArray(settings.hooks[event])
        ? settings.hooks[event]
        : [];
    const expectedCommand = normalizeCommand(command);
    const expectedMatcher = matcherKey(matcher);
    return entries.filter(entry => {
        if (matcherKey(entry.matcher) !== expectedMatcher) return false;
        return (entry.hooks || []).some(hook => normalizeCommand(hook && hook.command) === expectedCommand);
    });
}

function findRequiredHook(settings, event, relativeScript) {
    const root = settings.__selfTestTargetRoot;
    const expected = path.normalize(relativeScript);
    const entries = settings.hooks && Array.isArray(settings.hooks[event])
        ? settings.hooks[event]
        : [];
    const matches = [];
    for (const entry of entries) {
        for (const hook of entry.hooks || []) {
            if (hook.type !== 'command' || hook.command !== 'node') continue;
            if (!Array.isArray(hook.args) || hook.args.length < 1) continue;
            const resolved = path.resolve(hook.args[0]);
            if (!isSubpath(root, resolved)) continue;
            if (path.normalize(path.relative(root, resolved)) !== expected) continue;
            matches.push({ entry, hook });
        }
    }
    return matches;
}

function countRequiredHooks(settings, required) {
    let count = 0;
    for (const [event, rel] of Object.entries(required)) {
        count += findRequiredHook(settings, event, rel).length;
    }
    return count;
}

function runSelfTestRepoLocalHooks() {
    const originalHome = process.env.HOME;
    const originalUserprofile = process.env.USERPROFILE;
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-repo-hooks-'));
    try {
        const targetRepo = path.join(tempRoot, 'target repo with spaces');
        const targetSettings = path.join(targetRepo, '.claude', 'settings.json');
        const outsideTarget = path.join(tempRoot, 'outside-target', 'settings.json');
        const fixtureHome = path.join(tempRoot, 'fixture-home');
        const fixtureHomeSettings = path.join(fixtureHome, '.claude', 'settings.json');
        const sentinelKey = 'FAKE_SENTINEL_KEY';
        const sentinelValue = 't146-02-do-not-copy-me';
        const overlayPath = path.resolve(__dirname, '..', 'config', 'repo-settings-overlay.json');
        const envOverlayPath = path.join(tempRoot, 'overlay-with-env.json');
        const oldRepo = path.join(tempRoot, 'old-repo');
        const oldQualityGate = path.join(oldRepo, 'super-gsd', 'hooks', 'sgsd-quality-gate.js');
        const unmarkedUserEntry = {
            matcher: 'Write|Edit|NotebookEdit',
            hooks: [
                {
                    type: 'command',
                    command: 'node',
                    args: [oldQualityGate, '--operator-owned'],
                    timeout: 10,
                    user_setting: { keep: 'byte-identical' }
                }
            ]
        };
        const markedStaleEntry = {
            sgsd_managed: true,
            sgsd_hook_id: 'post-tool-use-quality-gate',
            matcher: 'Write|Edit|NotebookEdit',
            hooks: [
                {
                    type: 'command',
                    command: 'node',
                    args: [oldQualityGate, '--stale'],
                    timeout: 10
                }
            ]
        };
        const required = {
            SessionStart: path.join('super-gsd', 'hooks', 'sgsd-session-start.js'),
            UserPromptSubmit: path.join('super-gsd', 'hooks', 'sgsd-intent-classifier.cjs'),
            PostToolUse: path.join('super-gsd', 'hooks', 'sgsd-quality-gate.js')
        };
        const runRepoLocalCli = (overlay, target, repoRoot) => {
            const savedHome = process.env.HOME;
            const savedUserprofile = process.env.USERPROFILE;
            process.env.HOME = fixtureHome;
            process.env.USERPROFILE = fixtureHome;
            try {
                mergeSettingsFiles(overlay, target, repoRoot);
                return { status: 0, stderr: '' };
            } catch (e) {
                return { status: 4, stderr: e.message };
            } finally {
                restoreEnvVar('HOME', savedHome);
                restoreEnvVar('USERPROFILE', savedUserprofile);
            }
        };

        fs.mkdirSync(path.dirname(targetSettings), { recursive: true });
        fs.mkdirSync(path.dirname(fixtureHomeSettings), { recursive: true });
        fs.writeFileSync(fixtureHomeSettings, JSON.stringify({ env: { [sentinelKey]: sentinelValue } }, null, 2) + '\n', 'utf8');
        const overlayWithEnv = readJsonOrEmpty(overlayPath);
        overlayWithEnv.env = { [sentinelKey]: sentinelValue };
        fs.writeFileSync(envOverlayPath, JSON.stringify(overlayWithEnv, null, 2) + '\n', 'utf8');
        const preflightStubPaths = [
            path.join(targetRepo, 'super-gsd', 'hooks', 'sgsd-session-start.js'),
            path.join(targetRepo, 'super-gsd', 'hooks', 'sgsd-intent-classifier.cjs'),
            path.join(targetRepo, 'super-gsd', 'tools', 'codex-hooks', 'block-secret-leak.cjs'),
            path.join(targetRepo, 'super-gsd', 'hooks', 'sgsd-quality-gate.js')
        ];
        for (const stubPath of preflightStubPaths) {
            fs.mkdirSync(path.dirname(stubPath), { recursive: true });
            fs.writeFileSync(stubPath, "'use strict';\n", 'utf8');
        }
        fs.writeFileSync(targetSettings, JSON.stringify({
            unrelatedProjectKey: { survives: true },
            hooks: {
                PostToolUse: [
                    {
                        matcher: 'Write|Edit|NotebookEdit',
                        hooks: [
                            {
                                type: 'command',
                                command: 'node',
                                args: [oldQualityGate],
                                timeout: 10
                            }
                        ]
                    }
                ]
            }
        }, null, 2) + '\n', 'utf8');

        const beforeHome = fs.readFileSync(fixtureHomeSettings, 'utf8');
        const outsideRun = runRepoLocalCli(overlayPath, outsideTarget, targetRepo);
        assertSelfTest(outsideRun.status !== 0, 'outside repo-local target path was accepted');
        assertSelfTest(outsideRun.stderr.includes('must be exactly'), 'outside repo-local target refusal message was unclear');
        assertSelfTest(!fs.existsSync(outsideTarget), 'outside repo-local target path was created');

        const homeRun = runRepoLocalCli(overlayPath, fixtureHomeSettings, fixtureHome);
        assertSelfTest(homeRun.status !== 0, 'fixture home .claude target was accepted');
        assertSelfTest(homeRun.stderr.includes('home .claude'), 'fixture home .claude refusal message was unclear');
        assertSelfTest(fs.readFileSync(fixtureHomeSettings, 'utf8') === beforeHome, 'fixture home settings changed');

        const linkRepo = path.join(tempRoot, 'link-repo');
        const escapeClaude = path.join(tempRoot, 'escape-destination', '.claude');
        const linkClaude = path.join(linkRepo, '.claude');
        const linkTarget = path.join(linkClaude, 'settings.json');
        fs.mkdirSync(linkRepo, { recursive: true });
        fs.mkdirSync(escapeClaude, { recursive: true });
        let linkCreated = false;
        try {
            fs.symlinkSync(escapeClaude, linkClaude, process.platform === 'win32' ? 'junction' : 'dir');
            linkCreated = true;
        } catch (e) {
            console.log(`[merge-settings:self-test] SKIP symlink/junction escape assertion: ${e.code || e.message}`);
        }
        if (linkCreated) {
            const linkRun = runRepoLocalCli(overlayPath, linkTarget, linkRepo);
            assertSelfTest(linkRun.status !== 0, 'symlink/junction repo-local .claude target was accepted');
            assertSelfTest(linkRun.stderr.includes('symlink') || linkRun.stderr.includes('junction') || linkRun.stderr.includes('realpath'), 'symlink/junction refusal message was unclear');
            assertSelfTest(!fs.existsSync(path.join(escapeClaude, 'settings.json')), 'symlink/junction escape destination was written');
            assertSelfTest(!fs.existsSync(path.join(escapeClaude, 'settings.json.tmp')), 'symlink/junction escape temp artifact was left behind');
        }

        const before = snapshotFiles(tempRoot);
        process.env.HOME = fixtureHome;
        process.env.USERPROFILE = fixtureHome;

        fs.writeFileSync(targetSettings, JSON.stringify({
            unrelatedProjectKey: { survives: true },
            hooks: {
                PostToolUse: [
                    unmarkedUserEntry,
                    markedStaleEntry
                ]
            }
        }, null, 2) + '\n', 'utf8');

        mergeSettingsFiles(envOverlayPath, targetSettings, targetRepo);
        const firstText = fs.readFileSync(targetSettings, 'utf8');
        const firstSettings = JSON.parse(firstText);
        firstSettings.__selfTestTargetRoot = path.resolve(targetRepo);
        const firstCount = countRequiredHooks(firstSettings, required);

        mergeSettingsFiles(overlayPath, targetSettings, targetRepo);
        const secondText = fs.readFileSync(targetSettings, 'utf8');
        const secondSettings = JSON.parse(secondText);
        secondSettings.__selfTestTargetRoot = path.resolve(targetRepo);
        const secondCount = countRequiredHooks(secondSettings, required);

        const after = snapshotFiles(tempRoot);
        const changed = changedFiles(before, after);
        const targetRel = path.relative(tempRoot, targetSettings).replace(/\\/g, '/');

        assertSelfTest(changed.length === 1 && changed[0] === targetRel, 'repo-local install changed files outside target settings');
        assertSelfTest(!Object.prototype.hasOwnProperty.call(secondSettings, 'env'), 'overlay env key propagated into target settings');
        assertSelfTest(!secondText.includes(sentinelKey) && !secondText.includes(sentinelValue), 'fixture sentinel leaked into target settings');
        assertSelfTest(firstSettings.unrelatedProjectKey && firstSettings.unrelatedProjectKey.survives === true, 'unrelated target key was not preserved');
        assertSelfTest(firstCount === 3 && secondCount === firstCount && secondText === firstText, 'repo-local install is not idempotent');

        const postCommandMatches = findHookEntriesByCommandMatcher(secondSettings, 'PostToolUse', 'node', 'Edit|Write|NotebookEdit');
        assertSelfTest(postCommandMatches.length === 2, 'unmarked user hook was not preserved alongside SGSD hook');
        const preservedUserHook = postCommandMatches.find(entry => !entry.sgsd_managed);
        assertSelfTest(JSON.stringify(preservedUserHook) === JSON.stringify(unmarkedUserEntry), 'unmarked user hook was changed');
        const managedPostHooks = postCommandMatches.filter(entry => entry.sgsd_managed === true && entry.sgsd_hook_id === 'post-tool-use-quality-gate');
        assertSelfTest(managedPostHooks.length === 1, 'marked SGSD PostToolUse hook was duplicated or missing');

        for (const [event, rel] of Object.entries(required)) {
            const matches = findRequiredHook(secondSettings, event, rel);
            assertSelfTest(matches.length === 1, `${event} hook missing or duplicated`);
            assertSelfTest(matches[0].entry.sgsd_managed === true && typeof matches[0].entry.sgsd_hook_id === 'string', `${event} SGSD hook marker missing`);
            const hookPath = path.resolve(matches[0].hook.args[0]);
            assertSelfTest(isSubpath(path.resolve(targetRepo), hookPath), `${event} hook arg is outside target repo`);
        }

        const postMatches = findRequiredHook(secondSettings, 'PostToolUse', required.PostToolUse);
        const postMatcher = matcherParts(postMatches[0].entry.matcher);
        assertSelfTest(JSON.stringify(postMatcher) === JSON.stringify(['Edit', 'NotebookEdit', 'Write'].sort()), 'PostToolUse matcher set is wrong');
        assertSelfTest(!postMatcher.includes('MultiEdit'), 'PostToolUse matcher includes MultiEdit');

        console.log('[merge-settings:self-test] repo-local hook install PASS');
    } catch (e) {
        console.error(`[merge-settings:self-test] FAIL: ${e.message}`);
        process.exitCode = 1;
    } finally {
        restoreEnvVar('HOME', originalHome);
        restoreEnvVar('USERPROFILE', originalUserprofile);
        try {
            assertSelfTest(process.env.HOME === originalHome, 'HOME was not restored after repo-local self-test');
            assertSelfTest(process.env.USERPROFILE === originalUserprofile, 'USERPROFILE was not restored after repo-local self-test');
        } catch (e) {
            console.error(`[merge-settings:self-test] FAIL: ${e.message}`);
            process.exitCode = 1;
        }
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
}

function restoreEnvVar(name, value) {
    if (value === undefined) {
        delete process.env[name];
    } else {
        process.env[name] = value;
    }
}

function reconcileRepoLocalManagedIds(settings, overlay) {
    const expectedEvents = new Map();
    for (const [event, entries] of Object.entries((overlay && overlay.hooks) || {})) {
        for (const entry of entries || []) {
            const id = repoLocalHookId(entry);
            if (id) expectedEvents.set(id, event);
        }
    }
    let removed = 0;
    for (const [event, entries] of Object.entries((settings && settings.hooks) || {})) {
        if (!Array.isArray(entries)) continue;
        settings.hooks[event] = entries.filter((entry) => {
            const id = repoLocalHookId(entry);
            if (!id || !expectedEvents.has(id) || expectedEvents.get(id) === event) return true;
            removed++;
            return false;
        });
    }
    return removed;
}

function mergeSettingsFiles(overlayPath, targetPath, repoRoot, options = {}) {
    let repoLocal = null;
    if (repoRoot) {
        repoLocal = resolveRepoLocalTarget(targetPath, repoRoot);
        repoRoot = repoLocal.repoRoot;
        targetPath = repoLocal.targetPath;
    }
    const overlay = repoRoot
        ? realizeRepoLocalHookArgs(readJsonOrEmpty(overlayPath), repoRoot)
        : realizeCommands(readJsonOrEmpty(overlayPath));
    const managedHookIds = repoRoot && Array.isArray(options.managedHookIds)
        ? new Set(options.managedHookIds)
        : null;
    if (managedHookIds) {
        for (const [event, entries] of Object.entries(overlay.hooks || {})) {
            const selected = (entries || []).filter(entry => managedHookIds.has(repoLocalHookId(entry)));
            if (selected.length) overlay.hooks[event] = selected;
            else delete overlay.hooks[event];
        }
    }
    preflightHookRegistrations(overlay, options.preflightAdapters || {});
    const target = repoRoot
        ? readJsonOrEmpty(targetPath)
        : realizeCommands(readJsonOrEmpty(targetPath));

let added = 0;
let skipped = 0;
let setScalars = 0;
let upgraded = 0;
let deduped = 0;
let refreshed = 0;

function dedupeExistingHooks(settings, repoLocal, scopedIds) {
    if (!settings.hooks || typeof settings.hooks !== 'object') return 0;
    let removed = 0;
    for (const event of Object.keys(settings.hooks)) {
        const entries = settings.hooks[event];
        if (!Array.isArray(entries)) continue;
        const kept = [];
        for (const entry of entries) {
            if (scopedIds && !scopedIds.has(repoLocalHookId(entry))) {
                kept.push(entry);
                continue;
            }
            if (kept.find(existing => isSameEntry(existing, entry, { repoLocal }))) {
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

deduped += dedupeExistingHooks(target, !!repoRoot, managedHookIds);
if (repoRoot) deduped += reconcileRepoLocalManagedIds(target, overlay);

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

function refreshRepoLocalManagedEntry(existing, overlayEntry) {
    const before = JSON.stringify(existing);
    for (const key of Object.keys(existing)) {
        delete existing[key];
    }
    for (const [key, value] of Object.entries(overlayEntry)) {
        existing[key] = value;
    }
    return JSON.stringify(existing) !== before;
}

// ── Merge scalar/object top-level keys (statusLine, env, etc.) ──
// These are single-value keys, not arrays. Overlay overwrites target ONLY
// if target doesn't already have the key. That way a user who has tuned
// their statusLine config keeps their version on subsequent installs.
for (const key of Object.keys(overlay)) {
    if (key === '_comment' || key === 'hooks') continue;
    if (key === 'env') {
        console.error('[merge-settings] WARNING: top-level env key ignored from overlay');
        skipped++;
        continue;
    }
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
            const dup = target.hooks[event].find(existing => isSameEntry(existing, entry, { repoLocal: !!repoRoot }));
            if (dup) {
                if (repoRoot && refreshRepoLocalManagedEntry(dup, entry)) {
                    refreshed++;
                } else {
                    skipped++;
                }
                continue;
            }
            target.hooks[event].push(entry);
            added++;
        }
    }
}

// Atomic write
const targetDir = path.dirname(targetPath);
const tmpPath = path.join(targetDir, path.basename(targetPath) + '.tmp');
fs.mkdirSync(targetDir, { recursive: true });
if (repoLocal) validateRepoLocalTargetBoundary(repoLocal);
fs.writeFileSync(tmpPath, JSON.stringify(target, null, 2) + '\n', 'utf8');
try {
    if (repoLocal) validateRepoLocalTargetBoundary(repoLocal);
    fs.renameSync(tmpPath, targetPath);
} catch (e) {
    try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch (_unlinkError) {
        // Best-effort cleanup; preserve the boundary failure as the primary error.
    }
    throw e;
}

if (upgraded > 0) {
    console.log(`[merge-settings] ${upgraded} legacy hook-entries upgraded`);
}
if (deduped > 0) {
    console.log(`[merge-settings] ${deduped} duplicate hook-entries removed`);
}
if (refreshed > 0) {
    console.log(`[merge-settings] ${refreshed} repo-local hook-entries refreshed`);
}

console.log(`[merge-settings] ${added} hook-entries added, ${setScalars} top-level keys set, ${skipped} already-present -> ${targetPath}`);
}

function main() {
    if (process.argv[2] === SELF_TEST_REPO_LOCAL) {
        runSelfTestRepoLocalHooks();
        process.exit(process.exitCode || 0);
    }

    let overlayPath;
    let targetPath;
    let repoRoot = null;

    if (process.argv[2] === REPO_LOCAL_MODE) {
        if (process.argv.length < 6) usage();
        overlayPath = process.argv[3];
        targetPath = process.argv[4];
        repoRoot = process.argv[5];
    } else {
        if (process.argv.length < 4) usage();
        overlayPath = process.argv[2];
        targetPath = process.argv[3];
    }

    try {
        mergeSettingsFiles(overlayPath, targetPath, repoRoot);
    } catch (e) {
        console.error(`ERROR: ${e.message}`);
        process.exit(e.exitCode || 4);
    }
}

if (require.main === module) main();

module.exports = {
    mergeSettingsFiles,
};
