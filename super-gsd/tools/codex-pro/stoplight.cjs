#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const profileResolver = require('./profile-resolver.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const METRICS_PATH = path.resolve(REPO_ROOT, '.planning', 'metrics', 'pro-mode-stoplight.jsonl');

function usage() {
  return [
    'Usage:',
    '  node stoplight.cjs [--help] [--classify <json>] [--self-test-green] [--self-test-amber] [--self-test-red]',
    '',
    'Classifies a Codex Pro Mode dispatch context as GREEN, AMBER, or RED.',
  ].join('\n');
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function contextHash(context) {
  return crypto.createHash('sha256').update(stableStringify(context)).digest('hex').slice(0, 16);
}

function normalizeAllowedFilesCount(context) {
  if (typeof context.allowed_files_count === 'number') return context.allowed_files_count;
  if (Array.isArray(context.allowed_files)) return context.allowed_files.length;
  return 0;
}

function guidanceFor(verdict, context) {
  if (verdict === 'GREEN') {
    return profileResolver.resolveProfile({ phase_type: 'execute', risk: context.risk || 'low', allowed_files: context.allowed_files || [] });
  }
  if (verdict === 'AMBER') {
    return profileResolver.resolveProfile({ phase_type: context.environment ? 'lab' : 'goal', environment: context.environment });
  }
  return {
    profile: 'escalation_gate',
    route: 'board_or_operator',
  };
}

function classify(context) {
  const ctx = context && typeof context === 'object' ? context : {};
  const allowedFilesCount = normalizeAllowedFilesCount(ctx);
  const reasons = [];
  const redReasons = [];
  const greenFailures = [];

  if (ctx.locked_plan !== true) redReasons.push('locked_plan must be true');
  if (ctx.acceptance_command === undefined) redReasons.push('acceptance_command is required');
  if (ctx.risk === 'high') redReasons.push('risk is high');
  if (ctx.ambiguity === 'high') redReasons.push('ambiguity is high');
  if (ctx.production_writes === true) redReasons.push('production writes are not allowed');
  if (ctx.secrets_required === true) redReasons.push('secrets are required');
  if (ctx.destructive === true) redReasons.push('destructive action requested');

  if (redReasons.length > 0) {
    return {
      verdict: 'RED',
      allow_execution: false,
      route: 'escalation_gate',
      profile: guidanceFor('RED', ctx).profile,
      reasons: redReasons,
      context_hash: contextHash(ctx),
    };
  }

  if (ctx.locked_plan !== true) greenFailures.push('locked_plan must be true');
  if (allowedFilesCount > 12) greenFailures.push(`allowed_files_count ${allowedFilesCount} exceeds 12`);
  if (ctx.acceptance_command === undefined || ctx.acceptance_command === '') greenFailures.push('acceptance_command must be non-empty');
  if (!['low', 'medium'].includes(ctx.risk)) greenFailures.push('risk must be low or medium');
  if (ctx.production_writes === true) greenFailures.push('production writes are not allowed');
  if (ctx.secrets_required === true) greenFailures.push('secrets are required');

  if (greenFailures.length === 0) {
    reasons.push('locked plan, bounded files, acceptance command, non-high risk, no production writes, no secrets');
    const guidance = guidanceFor('GREEN', ctx);
    return {
      verdict: 'GREEN',
      allow_execution: true,
      profile: guidance.profile,
      reasons,
      context_hash: contextHash(ctx),
    };
  }

  reasons.push(...greenFailures);
  reasons.push('goal lane appropriate: require temporary worktree and human or board review before apply');
  const guidance = guidanceFor('AMBER', ctx);
  return {
    verdict: 'AMBER',
    allow_execution: true,
    route: 'goal_or_lab_lane',
    profile: guidance.profile,
    reasons,
    context_hash: contextHash(ctx),
  };
}

function appendMetric(verdict) {
  fs.mkdirSync(path.dirname(METRICS_PATH), { recursive: true });
  const row = {
    ts: new Date().toISOString(),
    verdict: verdict.verdict,
    allow_execution: verdict.allow_execution,
    profile: verdict.profile,
    reasons: verdict.reasons,
    context_hash: verdict.context_hash,
  };
  fs.appendFileSync(METRICS_PATH, `${JSON.stringify(row)}\n`, 'utf8');
}

function classifyAndRecord(context) {
  profileResolver.loadRegistry();
  const verdict = classify(context);
  appendMetric(verdict);
  return verdict;
}

function parseJsonContext(raw) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON context: ${error.message}`);
  }
}

function expectSelfTest(name, context, expectedVerdict) {
  const verdict = classifyAndRecord(context);
  if (verdict.verdict !== expectedVerdict) {
    throw new Error(`${name} expected ${expectedVerdict}, got ${verdict.verdict}: ${verdict.reasons.join('; ')}`);
  }
  process.stdout.write(`[stoplight] ${name} passed (${verdict.verdict})\n`);
}

function main(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv.includes('--help')) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }

  const classifyIndex = argv.indexOf('--classify');
  if (classifyIndex !== -1) {
    const raw = argv[classifyIndex + 1];
    if (raw === undefined) {
      throw new Error('--classify requires a JSON context argument');
    }
    const verdict = classifyAndRecord(parseJsonContext(raw));
    process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
    return 0;
  }

  if (argv.includes('--self-test-green')) {
    expectSelfTest('self-test-green', {
      locked_plan: true,
      allowed_files_count: 2,
      acceptance_command: 'npm test',
      risk: 'low',
      production_writes: false,
      secrets_required: false,
    }, 'GREEN');
    return 0;
  }

  if (argv.includes('--self-test-amber')) {
    expectSelfTest('self-test-amber', {
      locked_plan: true,
      allowed_files_count: 18,
      acceptance_command: 'npm test',
      risk: 'medium',
      production_writes: false,
      secrets_required: false,
      phase_type: 'goal',
    }, 'AMBER');
    return 0;
  }

  if (argv.includes('--self-test-red')) {
    expectSelfTest('self-test-red', {
      locked_plan: true,
      allowed_files_count: 1,
      acceptance_command: 'node smoke.js',
      risk: 'medium',
      production_writes: true,
      secrets_required: false,
    }, 'RED');
    return 0;
  }

  throw new Error(`Unknown arguments: ${argv.join(' ')}`);
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`[stoplight] ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  METRICS_PATH,
  classify,
  classifyAndRecord,
  contextHash,
};
