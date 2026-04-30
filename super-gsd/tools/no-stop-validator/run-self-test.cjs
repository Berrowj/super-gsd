// Self-test for no-stop validator -- Phase 105.5.
// Asserts: VALID_EXITS frozen, forbidden phrases without negation flagged,
// required phrases enforcement, watchdog stall detection, Lock-13 no-throw,
// ASCII source, public API stable.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const v = require('./validate.cjs');

const results = [];
function pass(n, d) { results.push({ ok: true }); console.log('PASS ' + n + (d ? '  (' + d + ')' : '')); }
function fail(n, d) { results.push({ ok: false }); console.log('FAIL ' + n + '  (' + d + ')'); }
function check(n, c, d) { if (c) pass(n, d); else fail(n, d); }

function tmpProject(label) {
  const root = path.join(os.tmpdir(), 'sgsd-nostop-' + label + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6));
  fs.mkdirSync(path.join(root, '.planning', 'metrics'), { recursive: true });
  fs.mkdirSync(path.join(root, 'super-gsd', 'skills', 'sgsd-orchestrate'), { recursive: true });
  return root;
}
function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* ignore */ } }

function writeSkill(root, content) {
  fs.writeFileSync(
    path.join(root, 'super-gsd', 'skills', 'sgsd-orchestrate', 'SKILL.md'),
    content, 'utf8');
}
function writeClaude(root, content) {
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), content, 'utf8');
}

// ------------------------------------------------------------
// A1 -- VALID_EXITS frozen, 3 entries
// ------------------------------------------------------------
check('A1_valid_exits_frozen_3',
  Object.isFrozen(v.VALID_EXITS) && v.VALID_EXITS.length === 3,
  'frozen=' + Object.isFrozen(v.VALID_EXITS) + ' len=' + v.VALID_EXITS.length);

// ------------------------------------------------------------
// A2 -- VALID_EXITS contains the canonical 3 reasons
// ------------------------------------------------------------
const expectedExits = ['all-phases-complete', 'hard-blocker', 'user-stop'];
const allPresent = expectedExits.every(function (e) {
  return v.VALID_EXITS.indexOf(e) !== -1;
});
check('A2_valid_exits_canonical', allPresent,
  'exits=' + v.VALID_EXITS.join(','));

// ------------------------------------------------------------
// A3 -- FORBIDDEN_AS_EXIT_TRIGGERS frozen, >= 4 entries
// ------------------------------------------------------------
check('A3_forbidden_frozen_min4',
  Object.isFrozen(v.FORBIDDEN_AS_EXIT_TRIGGERS) &&
  v.FORBIDDEN_AS_EXIT_TRIGGERS.length >= 4,
  'frozen=' + Object.isFrozen(v.FORBIDDEN_AS_EXIT_TRIGGERS) +
  ' len=' + v.FORBIDDEN_AS_EXIT_TRIGGERS.length);

// ------------------------------------------------------------
// A4 -- staticValidate detects missing skill file
// ------------------------------------------------------------
const t4 = tmpProject('missing-skill');
writeClaude(t4, 'CLAUDE.md content');
const r4 = v.staticValidate({ projectDir: t4 });
check('A4_missing_skill_detected',
  r4.ok === false &&
  r4.errors.some(function (x) { return x.indexOf('skill_md_not_found') !== -1; }),
  'errs=' + r4.errors.join('|'));
rmrf(t4);

// ------------------------------------------------------------
// A5 -- staticValidate detects missing required phrase
// ------------------------------------------------------------
const t5 = tmpProject('missing-phrase');
writeSkill(t5, '# Skill\n\nNo exit policy mentioned.\n');
writeClaude(t5, 'CLAUDE.md');
const r5 = v.staticValidate({ projectDir: t5 });
check('A5_missing_phrase_detected',
  r5.ok === false &&
  r5.errors.some(function (x) { return x.indexOf('skill_missing_phrase') !== -1; }),
  'errs=' + r5.errors.join('|'));
rmrf(t5);

// ------------------------------------------------------------
// A6 -- staticValidate flags forbidden phrase without negation
// ------------------------------------------------------------
const t6 = tmpProject('forbidden-positive');
writeSkill(t6, '# Skill\n\n' +
  'When all phases complete, exit. When hard blocker, exit. When user stop, exit.\n' +
  'Also exit on context too high.\n');  // forbidden phrase WITHOUT negation
writeClaude(t6, 'sgsd-orchestrate ref');
const r6 = v.staticValidate({ projectDir: t6 });
check('A6_forbidden_without_negation_flagged',
  r6.findings.some(function (x) {
    return x.kind === 'forbidden_exit_trigger_without_negation' &&
      x.phrase === 'context too high';
  }),
  'findings=' + r6.findings.map(function (x) { return x.kind + ':' + x.phrase; }).join(','));
rmrf(t6);

// ------------------------------------------------------------
// A7 -- staticValidate accepts forbidden phrase WITH negation
// ------------------------------------------------------------
const t7 = tmpProject('forbidden-negated');
writeSkill(t7, '# Skill\n\n' +
  'When all phases complete, exit. When hard blocker, exit. When user stop, exit.\n' +
  'Context too high is NOT a valid exit reason. Never stop on this.\n');
writeClaude(t7, 'sgsd-orchestrate ref');
const r7 = v.staticValidate({ projectDir: t7 });
const flagged7 = r7.findings.filter(function (x) {
  return x.kind === 'forbidden_exit_trigger_without_negation' &&
    x.phrase === 'context too high';
});
check('A7_forbidden_with_negation_accepted',
  flagged7.length === 0,
  'flagged=' + flagged7.length);
rmrf(t7);

// ------------------------------------------------------------
// A8 -- staticValidate against the live repo passes
// ------------------------------------------------------------
const r8 = v.staticValidate();  // uses DEFAULT_PROJECT
check('A8_live_repo_passes',
  r8.ok === true && r8.errors.length === 0,
  'ok=' + r8.ok + ' errs=' + r8.errors.length + ' findings=' + r8.findings.length);

// ------------------------------------------------------------
// A9 -- watchdogCheck: no pulse log yet
// ------------------------------------------------------------
const t9 = tmpProject('no-pulse');
const w9 = v.watchdogCheck({ projectDir: t9 });
check('A9_no_pulse_log_no_stall',
  w9.ok === true && w9.stalled === false &&
  w9.reason === 'no_pulse_log_yet',
  'reason=' + w9.reason);
rmrf(t9);

// ------------------------------------------------------------
// A10 -- watchdogCheck: recent pulse, no stall
// ------------------------------------------------------------
const t10 = tmpProject('recent-pulse');
fs.writeFileSync(path.join(t10, '.planning', 'metrics', 'orchestrator-pulse.jsonl'),
  JSON.stringify({ ts: new Date().toISOString(), iteration: 1 }) + '\n', 'utf8');
const w10 = v.watchdogCheck({ projectDir: t10, stallSeconds: 60 });
check('A10_recent_pulse_no_stall',
  w10.ok === true && w10.stalled === false &&
  w10.seconds_since_pulse < 60,
  'sec_since=' + w10.seconds_since_pulse);
rmrf(t10);

// ------------------------------------------------------------
// A11 -- watchdogCheck: old pulse + idle state -> stalled
// ------------------------------------------------------------
const t11 = tmpProject('stalled');
const oldTs = new Date(Date.now() - 30 * 60 * 1000).toISOString();  // 30 min ago
fs.writeFileSync(path.join(t11, '.planning', 'metrics', 'orchestrator-pulse.jsonl'),
  JSON.stringify({ ts: oldTs, iteration: 1 }) + '\n', 'utf8');
// State.md mtime backdated by setting a 30-min-old file
const statePath11 = path.join(t11, '.planning', 'STATE.md');
fs.writeFileSync(statePath11, '---\nmilestone: v2.x\n---\n', 'utf8');
const oldMs11 = Date.now() - 30 * 60 * 1000;
fs.utimesSync(statePath11, oldMs11 / 1000, oldMs11 / 1000);
const w11 = v.watchdogCheck({ projectDir: t11, stallSeconds: 600 });
check('A11_old_pulse_idle_state_stalled',
  w11.ok === true && w11.stalled === true,
  'stalled=' + w11.stalled + ' sec_since=' + w11.seconds_since_pulse);
rmrf(t11);

// ------------------------------------------------------------
// A12 -- watchdogCheck: old pulse but state recently active -> NOT stalled
// (just an inter-iteration gap)
// ------------------------------------------------------------
const t12 = tmpProject('inter-iter');
const oldTs12 = new Date(Date.now() - 30 * 60 * 1000).toISOString();
fs.writeFileSync(path.join(t12, '.planning', 'metrics', 'orchestrator-pulse.jsonl'),
  JSON.stringify({ ts: oldTs12, iteration: 1 }) + '\n', 'utf8');
fs.writeFileSync(path.join(t12, '.planning', 'STATE.md'),
  'state', 'utf8'); // just-written state
const w12 = v.watchdogCheck({ projectDir: t12, stallSeconds: 600 });
check('A12_old_pulse_active_state_not_stalled',
  w12.ok === true && w12.stalled === false,
  'stalled=' + w12.stalled);
rmrf(t12);

// ------------------------------------------------------------
// A13 -- Lock-13 no-throw on null inputs
// ------------------------------------------------------------
let threw = false;
try {
  v.staticValidate(null);
  v.watchdogCheck(null);
} catch (e) { threw = true; }
check('A13_lock13_no_throw', !threw, 'threw=' + threw);

// ------------------------------------------------------------
// A14 -- ASCII-only source (validate.cjs)
// ------------------------------------------------------------
const vSrc = fs.readFileSync(path.join(__dirname, 'validate.cjs'), 'utf8');
let nonAsciiV = -1;
for (let i = 0; i < vSrc.length; i++) {
  if (vSrc.charCodeAt(i) > 127) { nonAsciiV = i; break; }
}
check('A14_validate_ascii_only', nonAsciiV === -1, 'idx=' + nonAsciiV);

// ------------------------------------------------------------
// A15 -- ASCII-only source (this self-test)
// ------------------------------------------------------------
const stSrc = fs.readFileSync(__filename, 'utf8');
let nonAsciiSt = -1;
for (let i = 0; i < stSrc.length; i++) {
  if (stSrc.charCodeAt(i) > 127) { nonAsciiSt = i; break; }
}
check('A15_self_test_ascii_only', nonAsciiSt === -1, 'idx=' + nonAsciiSt);

// ------------------------------------------------------------
// A16 -- public API surface stable
// ------------------------------------------------------------
const expected = ['staticValidate', 'watchdogCheck', 'VALID_EXITS',
  'FORBIDDEN_AS_EXIT_TRIGGERS', 'REQUIRED_PHRASES', 'DEFAULT_PROJECT'];
const apiMissing = expected.find(function (k) { return !(k in v); });
check('A16_public_api_stable', apiMissing === undefined, 'missing=' + apiMissing);

// ------------------------------------------------------------
// FOOTER
// ------------------------------------------------------------
const passed = results.filter(function (x) { return x.ok; }).length;
const total = results.length;
console.log('---');
console.log('no-stop-validator-self-test: ' + passed + '/' + total + ' passed');
if (passed !== total) process.exit(1);
