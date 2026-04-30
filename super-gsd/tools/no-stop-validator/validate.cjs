// SGSD No-Stop Validator -- Phase 105.5 (post-v2.9 reliability layer).
// Static + watchdog checks that catch the orchestrator's most common
// premature-stop patterns BEFORE they happen, and detect mid-run stalls.
//
// Lock-13: never throws across public API.
//
// Two modes:
//   1. STATIC: scan sgsd-orchestrate SKILL.md and CLAUDE.md to confirm
//      "3 valid exits" rule is present and forbidden phrases are absent.
//   2. WATCHDOG: read orchestrator-pulse.jsonl; flag if no pulse for
//      stall_seconds AND STATE.md still shows in-progress work.

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_PROJECT = path.resolve(__dirname, '..', '..', '..');
const SKILL_REL = path.join('super-gsd', 'skills', 'sgsd-orchestrate', 'SKILL.md');
const CLAUDE_MD_REL = 'CLAUDE.md';
const PULSE_REL = path.join('.planning', 'metrics', 'orchestrator-pulse.jsonl');
const STATE_REL = path.join('.planning', 'STATE.md');

// The only valid exit reasons. Frozen.
const VALID_EXITS = Object.freeze([
  'all-phases-complete',
  'hard-blocker',
  'user-stop'
]);

// Phrases that, if present in skill text, indicate a forbidden self-stop.
// "Don't pause for context" rule etc. We assert these patterns are NOT
// presented as legitimate exits.
const FORBIDDEN_AS_EXIT_TRIGGERS = Object.freeze([
  'context too high',
  'context percentage',
  'pause for operator review',
  'cumulative deviations',
  'token budget exceeded'
]);

// Phrases that MUST appear in skill text describing exit policy.
const REQUIRED_PHRASES = Object.freeze([
  'all phases complete',
  'hard blocker',
  'user'
]);

function readSafe(absPath) {
  try {
    if (!fs.existsSync(absPath)) return null;
    return fs.readFileSync(absPath, 'utf8');
  } catch (e) { return null; }
}

function findPulseAndStateAges(projectDir) {
  const pulsePath = path.join(projectDir, PULSE_REL);
  const statePath = path.join(projectDir, STATE_REL);
  let lastPulseTs = null;
  try {
    if (fs.existsSync(pulsePath)) {
      const src = fs.readFileSync(pulsePath, 'utf8');
      const lines = src.split(/\r?\n/).filter(function (l) { return l.length > 0; });
      // Walk backwards for the most recent valid line.
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const obj = JSON.parse(lines[i]);
          if (obj && obj.ts) { lastPulseTs = obj.ts; break; }
        } catch (e) { /* skip malformed */ }
      }
    }
  } catch (e) { /* tolerate */ }

  let stateMtimeMs = null;
  try {
    if (fs.existsSync(statePath)) {
      stateMtimeMs = fs.statSync(statePath).mtimeMs;
    }
  } catch (e) { /* tolerate */ }

  return { lastPulseTs: lastPulseTs, stateMtimeMs: stateMtimeMs };
}

// PUBLIC API -- Lock-13: never throws.

function staticValidate(opts) {
  try {
    opts = opts || {};
    const projectDir = opts.projectDir || DEFAULT_PROJECT;
    const errors = [];
    const findings = [];

    const skillSrc = readSafe(path.join(projectDir, SKILL_REL));
    if (!skillSrc) {
      errors.push('skill_md_not_found:' + SKILL_REL);
    } else {
      // Required phrases must appear (case-insensitive).
      const lower = skillSrc.toLowerCase();
      for (const req of REQUIRED_PHRASES) {
        if (lower.indexOf(req) === -1) {
          errors.push('skill_missing_phrase:' + req);
        }
      }
      // Forbidden phrases must NOT be presented as legitimate exit triggers.
      // We check that each forbidden phrase, if present at all, is in a NOT
      // context (NOT a stop reason / never an exit / etc.).
      for (const forb of FORBIDDEN_AS_EXIT_TRIGGERS) {
        const idx = lower.indexOf(forb);
        if (idx !== -1) {
          // Check the surrounding 80 chars for negation cue.
          const window = skillSrc.substring(Math.max(0, idx - 80),
            Math.min(skillSrc.length, idx + forb.length + 80)).toLowerCase();
          const hasNegation = window.indexOf('not ') !== -1 ||
            window.indexOf('never') !== -1 ||
            window.indexOf("won't") !== -1 ||
            window.indexOf("isn't") !== -1 ||
            window.indexOf('cannot') !== -1 ||
            window.indexOf("can't") !== -1;
          if (!hasNegation) {
            findings.push({
              kind: 'forbidden_exit_trigger_without_negation',
              phrase: forb,
              context: window.substring(0, 160)
            });
          }
        }
      }
    }

    const claudeSrc = readSafe(path.join(projectDir, CLAUDE_MD_REL));
    if (!claudeSrc) {
      errors.push('claude_md_not_found:' + CLAUDE_MD_REL);
    } else {
      // CLAUDE.md should mention the 3 valid exits or reference orchestrate skill.
      const claudeLower = claudeSrc.toLowerCase();
      const has3Exits = claudeLower.indexOf('3 valid exits') !== -1 ||
        claudeLower.indexOf('only 3 valid exits') !== -1 ||
        claudeLower.indexOf('three valid exits') !== -1;
      const hasOrchestrateRef = claudeLower.indexOf('sgsd-orchestrate') !== -1 ||
        claudeLower.indexOf('orchestrate') !== -1;
      if (!has3Exits && !hasOrchestrateRef) {
        findings.push({
          kind: 'claude_md_missing_exit_policy_reference',
          phrase: '3 valid exits or sgsd-orchestrate reference'
        });
      }
    }

    return {
      ok: errors.length === 0,
      errors: errors,
      findings: findings,
      valid_exits: VALID_EXITS.slice(),
      forbidden_phrases: FORBIDDEN_AS_EXIT_TRIGGERS.slice()
    };
  } catch (e) {
    return { ok: false,
      errors: ['static_validate_failed: ' + (e && e.message || e)],
      findings: [], valid_exits: [], forbidden_phrases: [] };
  }
}

function watchdogCheck(opts) {
  try {
    opts = opts || {};
    const projectDir = opts.projectDir || DEFAULT_PROJECT;
    const stallSeconds = typeof opts.stallSeconds === 'number'
      ? opts.stallSeconds : 600;  // 10 minutes default
    const nowMs = typeof opts.nowMs === 'number' ? opts.nowMs : Date.now();

    const ages = findPulseAndStateAges(projectDir);
    if (!ages.lastPulseTs) {
      return {
        ok: true,
        stalled: false,
        reason: 'no_pulse_log_yet',
        last_pulse_ts: null,
        seconds_since_pulse: null
      };
    }

    const lastMs = Date.parse(ages.lastPulseTs);
    if (isNaN(lastMs)) {
      return { ok: false, stalled: false,
        reason: 'pulse_ts_unparseable:' + ages.lastPulseTs };
    }
    const secondsSince = Math.floor((nowMs - lastMs) / 1000);

    // If state.md hasn't been touched in a long time AND pulse stalled,
    // it's a real stall, not just a rest between runs.
    let stateLikelyIdle = true;
    if (ages.stateMtimeMs !== null) {
      const stateAgeSec = Math.floor((nowMs - ages.stateMtimeMs) / 1000);
      // If STATE.md was just modified, work is in progress; pulse delay
      // for a few minutes is normal between iterations.
      if (stateAgeSec < 300) stateLikelyIdle = false;
    }

    const stalled = secondsSince >= stallSeconds && stateLikelyIdle;

    return {
      ok: true,
      stalled: stalled,
      reason: stalled ? 'pulse_silent_and_state_idle' : 'pulse_recent_or_state_active',
      last_pulse_ts: ages.lastPulseTs,
      seconds_since_pulse: secondsSince,
      stall_threshold_seconds: stallSeconds,
      state_md_mtime_ms: ages.stateMtimeMs
    };
  } catch (e) {
    return { ok: false, stalled: false,
      reason: 'watchdog_failed: ' + (e && e.message || e) };
  }
}

module.exports = {
  staticValidate: staticValidate,
  watchdogCheck: watchdogCheck,
  VALID_EXITS: VALID_EXITS,
  FORBIDDEN_AS_EXIT_TRIGGERS: FORBIDDEN_AS_EXIT_TRIGGERS,
  REQUIRED_PHRASES: REQUIRED_PHRASES,
  DEFAULT_PROJECT: DEFAULT_PROJECT
};

// CLI entry
if (require.main === module) {
  const argv = process.argv.slice(2);
  let mode = 'static';
  let stallSec = 600;
  let projectDir = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--watchdog') mode = 'watchdog';
    else if (argv[i] === '--static') mode = 'static';
    else if (argv[i] === '--stall-seconds') stallSec = parseInt(argv[++i], 10);
    else if (argv[i] === '--project') projectDir = argv[++i];
  }
  const opts = { projectDir: projectDir || undefined, stallSeconds: stallSec };
  const r = mode === 'watchdog' ? watchdogCheck(opts) : staticValidate(opts);
  console.log(JSON.stringify(r, null, 2));
  if (mode === 'watchdog') {
    process.exit(r.stalled ? 1 : 0);
  }
  process.exit(r.ok && (!r.findings || r.findings.length === 0) ? 0 : 1);
}
