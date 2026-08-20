'use strict';

// ============================================================================
// SGSD - skill-routing registry loader (P149-T2)
// ============================================================================
// Owns js-yaml loading, schema validation, prompt-time adaptation, scheduled
// route lookup, compiled fallback, runtime degradation logging, and CLI probes.
// Runtime catches malformed registries and falls back; self-test is strict.
// ============================================================================

const fs = require('fs');
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');

const { logGateEvidence } = require('./gate-evidence-log.cjs');
const { findSgsdRoot, readState } = require('./sgsd-state.cjs');

const DEFAULT_REGISTRY_PATH = path.resolve(__dirname, '..', '..', 'registry', 'skill-routing.yaml');
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_SGSD_ROOT = path.join(DEFAULT_REPO_ROOT, 'super-gsd');
const YAML_LIB_PATH = path.resolve(__dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml');
const GATES_YAML_PATH = path.join(DEFAULT_SGSD_ROOT, 'registry', 'gates.yaml');

const VALID_MOMENTS = Object.freeze(['prompt-time', 'phase-close', 'milestone-close', 'weekly', 'on-demand']);
const VALID_MODES = Object.freeze(['manual', 'semi', 'auto']);
const VALID_AVAILABILITY = Object.freeze([
  'canonical',
  'alias',
  'manual-only',
  'external-if-installed',
  'omitted',
]);
const VALID_MCP_PROMPT_SURFACES = Object.freeze(['/vtp-implementation-pack']);

const DEGRADED_SIGNAL = 'skill_routing_registry_degraded';
const SKILL_ROUTING_EVENT = 'skill-routing';
const FALLBACK_SOURCE = 'compiled_fallback';
const MAX_REGEX_PATTERN_LENGTH = 200;
const SAFE_SLASH_TARGET_RE = /^\/[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/;
const ALLOWED_DISPATCH_LAUNCHERS = Object.freeze(['node', 'bash']);
const P146_DIRECTIVE_ALIASES = Object.freeze({
  'gsd-code-review': 'sgsd-code-review',
  'gsd-code-review-fix': 'sgsd-code-review-fix',
});

let _cache = new Map();
let _gateProducerCache = null;

function fb(skill, moment, modes, signatures, extra) {
  return Object.assign({ skill, signatures, moment, modes }, extra || {});
}

function processDispatch(command, args, verdictExits, timeoutMs) {
  return {
    command,
    args,
    timeout_ms: timeoutMs || 120000,
    success_exits: [0],
    verdict_exits: verdictExits || [],
  };
}

const COMPILED_FALLBACK_ROWS = Object.freeze([
  fb('sgsd-muda-audit', 'prompt-time', ['manual', 'semi', 'auto'], {
    phrases: ['muda', 'waste', 'retrospective', 'retro', 'what went wrong', 'conformance drift'],
    regexes: ['\\b(?:muda|waste|wasted|wasting)\\b', '\\b(?:retrospective|retro)\\b.{0,160}\\b(?:waste|drift|missed|wrong)\\b'],
  }, { availability: 'canonical' }),
  fb('sgsd-muda-audit', 'phase-close', ['semi', 'auto'], {
    event_names: ['phase-close'],
  }, {
    availability: 'canonical',
    gate_ref: 'MUDA-waste-audit',
    cooldown: { policy: 'gate-controlled', scope: 'phase' },
    dispatch: processDispatch('bash', [
      '{sgsd_root}/scripts/sgsd-muda-audit.sh', '{phase}', '--project',
      '{project_dir}', '{dry_run_flag}',
    ], [1, 2]),
  }),
  fb('sgsd-token-audit', 'prompt-time', ['manual', 'semi', 'auto'], {
    phrases: ['token spend', 'token budget', 'token burn', 'context cost', 'token waste'],
    regexes: ['\\btokens?\\b.{0,160}\\b(?:spend|spent|burn|budget|cost|waste)\\b', '\\b(?:spend|spent|burn|budget|cost|waste)\\b.{0,160}\\btokens?\\b'],
  }, { availability: 'canonical' }),
  fb('sgsd-token-audit', 'milestone-close', ['semi', 'auto'], {
    event_names: ['milestone-close'],
  }, {
    availability: 'canonical',
    cooldown: { policy: 'sgsd-complete-milestone-owned', scope: 'milestone' },
    dispatch: processDispatch('node', [
      '{sgsd_root}/tools/token-waste/check.cjs', '--check', '--milestone',
      '{milestone}', '--json',
    ]),
  }),
  fb('sgsd-distill', 'milestone-close', ['semi', 'auto'], {
    event_names: ['milestone-close'],
    phrases: ['distill milestone', 'trajectory distill', 'summarize learnings'],
  }, {
    availability: 'canonical',
    cooldown: { policy: 'once-per-milestone', scope: 'milestone' },
    dispatch: processDispatch('bash', [
      '{sgsd_root}/scripts/sgsd-distill-milestone.sh', '{milestone}',
      '--exclude-phase-type', 'self-audit', '--root', '{project_dir}',
    ]),
  }),
  fb('sgsd-sepl', 'prompt-time', ['manual', 'semi', 'auto'], {
    phrases: ['major proposal', 'architecture tradeoff', 'architecture trade-off', 'strategic tradeoff', 'strategic trade-off', 'sets precedent'],
    regexes: ['\\b(?:architecture|system|governance)\\b.{0,120}\\b(?:tradeoffs?|trade-offs?|decision|proposal)\\b', '\\bshould\\s+we\\b.{0,160}\\b(?:choose|adopt|standardize|centralize|decentralize|replace)\\b'],
  }, { availability: 'canonical' }),
  fb('sgsd-sepl', 'on-demand', ['manual', 'semi', 'auto'], {
    phrases: ['sgsd-sepl', 'sepl', 'deliberate', 'deliberate decision'],
  }, { availability: 'canonical' }),
  fb('sgsd-overwatcher', 'phase-close', ['auto'], {
    event_names: ['phase-close'],
  }, {
    availability: 'canonical',
    cooldown: { policy: 'once-per-phase', scope: 'phase' },
    dispatch: processDispatch('node', [
      '{sgsd_root}/overwatcher/overwatcher-launcher.js',
    ]),
  }),
  fb('sgsd-readiness', 'prompt-time', ['manual', 'semi', 'auto'], {
    phrases: ['readiness', 'release readiness', 'health check', 'sgsd-health', 'gsd-health'],
    regexes: ['\\b(?:ready|readiness|health)\\b.{0,120}\\b(?:ship|release|close|phase|milestone)\\b'],
  }, { aliases: ['sgsd-health', 'gsd-health'], availability: 'canonical' }),
  fb('sgsd-readiness', 'on-demand', ['manual', 'semi', 'auto'], {
    phrases: ['readiness', 'release readiness', 'health check', 'sgsd-readiness', 'sgsd-health', 'gsd-health'],
  }, {
    aliases: ['sgsd-health', 'gsd-health'],
    availability: 'canonical',
    dispatch: processDispatch('node', [
      '{sgsd_root}/tools/vtp-readiness/run.cjs', '--trigger', '{mode}',
      '--project-dir', '{project_dir}',
    ], [1], 5000),
  }),
  fb('sgsd-readiness', 'phase-close', ['auto'], {
    event_names: ['phase-close', 'auto-mode-readiness'],
  }, {
    availability: 'canonical',
    cooldown: { policy: 'route-policy', scope: 'phase' },
    dispatch: processDispatch('node', [
      '{sgsd_root}/tools/release-readiness/score.cjs', '--milestone',
      '{milestone}', '--planning-dir', '{planning_dir}',
    ], [1]),
  }),
  fb('sgsd-audit', 'phase-close', ['semi', 'auto'], {
    event_names: ['phase-close'],
  }, {
    availability: 'canonical',
    cooldown: { policy: 'once-per-phase', scope: 'phase' },
    dispatch: processDispatch('node', [
      '{sgsd_root}/tools/phase-folder-audit/audit.cjs', '--json', '--milestone',
      '{milestone}', '--planning-dir', '{planning_dir}',
    ]),
  }),
  fb('sgsd-audit', 'milestone-close', ['semi', 'auto'], {
    event_names: ['milestone-close'],
  }, {
    availability: 'canonical',
    cooldown: { policy: 'sgsd-complete-milestone-owned', scope: 'milestone' },
    dispatch: processDispatch('node', [
      '{sgsd_root}/tools/phase-folder-audit/audit.cjs', '--json', '--milestone',
      '{milestone}', '--planning-dir', '{planning_dir}',
    ]),
  }),
  fb('sgsd-memory-hygiene', 'prompt-time', ['manual', 'semi', 'auto'], {
    phrases: ['sgsd-memory', 'sgsd-memory-hygiene', 'sgsd-recall', 'recall memory', 'memory recall'],
    regexes: ['\\b(?:recall|remember|memory)\\b.{0,120}\\b(?:context|decision|precedent|learning)\\b'],
  }, { aliases: ['sgsd-recall'], availability: 'canonical', gate_ref: 'sgsd-recall-queries' }),
  fb('sgsd-memory-hygiene', 'phase-close', ['semi', 'auto'], {
    event_names: ['phase-close'],
    phrases: ['sgsd-curate', 'curate memory', 'curate learnings', 'memory hygiene'],
  }, {
    aliases: ['sgsd-curate'],
    availability: 'canonical',
    gate_ref: 'sgsd-curate-learnings',
    cooldown: { policy: 'gate-controlled', scope: 'phase' },
  }),
  fb('sgsd-vtp-advise', 'prompt-time', ['manual', 'semi', 'auto'], {
    phrases: ['vtp advise', 'vtp context', 'vtp enrichment', 'private kb', 'knowledge bank'],
    regexes: ['\\bvtp\\b.{0,120}\\b(?:advise|context|enrich|knowledge|kb)\\b', '\\b(?:private\\s+kb|knowledge\\s+bank)\\b'],
  }, { availability: 'canonical' }),
  fb('sgsd-vtp-advise', 'on-demand', ['manual', 'semi', 'auto'], {
    phrases: ['sgsd-vtp-advise', 'vtp advise', 'advise from vtp', 'check vtp'],
  }, { availability: 'canonical' }),
  fb('gsd-cleanup', 'on-demand', ['manual'], {
    phrases: ['gsd-cleanup', 'cleanup gsd', 'clean up gsd', 'cleanup workspace'],
  }, { availability: 'omitted', skip_reason: 'legacy_unregistered' }),
  fb('gsd-code-review', 'prompt-time', ['manual', 'semi'], {
    phrases: ['gsd-code-review', 'code review', 'review my code', 'review this change'],
    regexes: ['\\bcode\\s+review\\b', '\\breview\\b.{0,120}\\b(?:diff|change|commit|code)\\b'],
  }, { availability: 'external-if-installed' }),
  fb('gsd-code-review', 'on-demand', ['manual', 'semi'], {
    phrases: ['gsd-code-review', 'run code review', 'external code review'],
  }, { availability: 'external-if-installed' }),
  fb('gsd-code-review-fix', 'prompt-time', ['manual'], {
    phrases: ['gsd-code-review-fix', 'fix review findings', 'apply code review fixes', 'address review comments'],
    regexes: ['\\bfix\\b.{0,120}\\b(?:review|findings|comments)\\b'],
  }, { availability: 'manual-only' }),
  fb('gsd-code-review-fix', 'on-demand', ['manual'], {
    phrases: ['gsd-code-review-fix', 'fix review findings', 'apply code review fixes'],
  }, { availability: 'manual-only' }),
  fb('sgsd-audit', 'prompt-time', ['manual', 'semi', 'auto'], {
    phrases: ['gsd-verify-work', 'verify work', 'verify this work', 'run verification', 'atc flow'],
    regexes: ['\\bverify\\b.{0,120}\\b(?:work|change|phase|implementation)\\b'],
  }, { aliases: ['gsd-verify-work'], availability: 'alias', gate_ref: 'phase-level-ATC' }),
  fb('sgsd-audit', 'on-demand', ['manual'], {
    phrases: ['gsd-secure-phase', 'secure phase', 'security phase', 'phase security review'],
  }, { aliases: ['gsd-secure-phase'], availability: 'alias' }),
  fb('create-quote', 'prompt-time', ['manual', 'semi', 'auto'], {
    regexes: [
      '^\\s*(?:please\\s+)?(?:create|draft|prepare|build|make|generate)\\b(?=[^\\r\\n]{0,180}\\b(?:sap|jcl)\\b)(?=[^\\r\\n]{0,180}\\bquotes?\\b)',
      '^\\s*(?:please\\s+)?(?:create|draft|prepare|build|make|generate)\\b(?=[^\\r\\n]{0,180}\\bquotes?\\b)(?=[^\\r\\n]{0,180}\\b(?:artifact|document|proposal)\\b)',
    ],
  }, { id: 'create-quote-prompt', availability: 'external-if-installed' }),
  fb('vtp-implementation-pack', 'prompt-time', ['manual', 'semi', 'auto'], {
    regexes: [
      '^\\s*(?:please\\s+)?(?:import|convert|turn|transform)\\b(?=[^\\r\\n]{0,180}\\b(?:meeting|transcript|recording)\\b)(?=[^\\r\\n]{0,180}\\b(?:implementation\\s+pack|actions?|action\\s+items?)\\b)',
    ],
  }, {
    id: 'vtp-implementation-pack-meeting-import',
    availability: 'external-if-installed',
  }),
  fb('vtp-implementation-pack', 'prompt-time', ['manual', 'semi', 'auto'], {
    regexes: [
      '^\\s*(?:please\\s+)?export\\b(?=[^\\r\\n]{0,180}\\b(?:meeting|transcript|recording)\\b)(?=[^\\r\\n]{0,180}\\b(?:implementation\\s+pack|actions?|action\\s+items?)\\b)',
    ],
  }, {
    id: 'vtp-implementation-pack-meeting-export',
    availability: 'external-if-installed',
    mcp_surface: '/vtp-implementation-pack',
  }),
  fb('jcl-procurement-report', 'prompt-time', ['manual', 'semi', 'auto'], {
    regexes: [
      '^\\s*(?:please\\s+)?(?:create|draft|prepare|generate|show|check|summari[sz]e)\\b(?=[^\\r\\n]{0,120}\\bjcl\\b)(?=[^\\r\\n]{0,120}\\bprocurement\\b)(?=[^\\r\\n]{0,120}\\b(?:status|report|orders?)\\b)',
    ],
  }, { id: 'jcl-procurement-report-prompt', availability: 'external-if-installed' }),
  fb('vtp-html-explainer', 'prompt-time', ['manual', 'semi', 'auto'], {
    regexes: [
      '^\\s*(?![^\\r\\n]{0,120}\\b(?:diagram|flowchart)\\b)(?:please\\s+)?(?:create|build|make|generate)\\b[^\\r\\n]{0,120}\\b(?:html\\s+explainer|interactive\\s+walkthrough)\\b',
    ],
  }, { id: 'vtp-html-explainer-prompt', availability: 'external-if-installed' }),
  fb('diagram-design', 'prompt-time', ['manual', 'semi', 'auto'], {
    regexes: [
      '^\\s*(?![^\\r\\n]{0,120}\\b(?:html\\s+explainer|interactive\\s+walkthrough)\\b)(?:please\\s+)?(?:create|draw|design|make|generate)\\b[^\\r\\n]{0,120}\\b(?:standalone\\s+diagram|flowchart|sequence\\s+diagram)\\b',
    ],
  }, { id: 'diagram-design-prompt', availability: 'external-if-installed' }),
]);

function _clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function _safeWarn(message) {
  try {
    process.stderr.write('[SGSD] skill-routing-registry ' + String(message || 'degraded') + '\n');
  } catch {
    // Stderr must never become the failure path.
  }
}

function _yaml() {
  return require(YAML_LIB_PATH);
}

function _registryPathFromOpts(opts) {
  const o = opts || {};
  return path.resolve(String(o.registryPath || o.registry || DEFAULT_REGISTRY_PATH));
}

function _repoRootFromOpts(opts) {
  const o = opts || {};
  const start = o.planningDir || o.root || process.cwd();
  return findSgsdRoot(start) || DEFAULT_REPO_ROOT;
}

function _displayPath(root, filePath) {
  try {
    const abs = path.resolve(String(filePath));
    const rel = path.relative(path.resolve(root), abs);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return rel.replace(/\\/g, '/');
    return abs.replace(/\\/g, '/');
  } catch {
    return String(filePath || '').replace(/\\/g, '/');
  }
}

function _stringList(value, label, issues) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    issues.push(label + ' must be an array of strings');
    return [];
  }
  const out = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (typeof item !== 'string' || !item.trim()) {
      issues.push(label + '[' + i + '] must be a non-empty string');
    } else if (!out.includes(item.trim())) {
      out.push(item.trim());
    }
  }
  return out;
}

function _optionalString(value, label, issues) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !value.trim()) {
    issues.push(label + ' must be a non-empty string when present');
    return null;
  }
  return value.trim();
}

function _hasUnsafeRepeatedGroup(pattern) {
  return /\((?:\\.|[^()])*(?:[+*]|\{\d+(?:,\d*)?\}|\|)(?:\\.|[^()])*\)(?:[+*]|\{\d+(?:,\d*)?\})/.test(pattern);
}

function _validateRegexes(regexes, label, issues) {
  for (const pattern of regexes) {
    if (pattern.length > MAX_REGEX_PATTERN_LENGTH) {
      issues.push(label + ' regex exceeds maximum pattern length of ' + MAX_REGEX_PATTERN_LENGTH + ': ' + pattern.length);
      continue;
    }
    if (_hasUnsafeRepeatedGroup(pattern)) {
      issues.push(label + ' regex contains unsafe repeated group: ' + pattern);
      continue;
    }
    try {
      new RegExp(pattern, 'i');
    } catch (e) {
      issues.push(label + ' regex invalid: ' + pattern + ' (' + e.message + ')');
    }
  }
}

function _normalizeSignatures(value, label, issues) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issues.push(label + '.signatures must be an object');
    return { phrases: [], regexes: [], event_names: [] };
  }
  const phrases = _stringList(value.phrases, label + '.signatures.phrases', issues);
  const regexes = _stringList(value.regexes, label + '.signatures.regexes', issues);
  const eventNames = _stringList(value.event_names, label + '.signatures.event_names', issues);
  _validateRegexes(regexes, label + '.signatures', issues);
  if (phrases.length + regexes.length + eventNames.length === 0) {
    issues.push(label + '.signatures must include phrases, regexes, or event_names');
  }
  return { phrases, regexes, event_names: eventNames };
}

function _normalizeModes(value, label, issues) {
  const modes = _stringList(value, label + '.modes', issues);
  const out = [];
  for (const mode of modes) {
    if (!VALID_MODES.includes(mode)) issues.push(label + '.modes contains invalid mode: ' + mode);
    else if (!out.includes(mode)) out.push(mode);
  }
  if (out.length === 0) issues.push(label + '.modes must include at least one of ' + VALID_MODES.join(', '));
  return out;
}

function _normalizeCooldown(value, label, issues) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    issues.push(label + '.cooldown must be an object when present');
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'predicate')) {
    issues.push(label + '.cooldown.predicate is forbidden; use gate_ref or a named route policy');
  }
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    if (typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean' && item !== null) {
      issues.push(label + '.cooldown.' + key + ' must be scalar');
    } else {
      out[key] = item;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function _normalizeExitCodes(value, label, issues, requireNonEmpty) {
  if (!Array.isArray(value)) {
    issues.push(label + ' must be an array of integer exit codes');
    return [];
  }
  const out = [];
  for (let i = 0; i < value.length; i += 1) {
    const code = value[i];
    if (!Number.isInteger(code) || code < 0 || code > 255) {
      issues.push(label + '[' + i + '] must be an integer from 0 to 255');
    } else if (out.includes(code)) {
      issues.push(label + ' must not contain duplicate exit codes: ' + code);
    } else {
      out.push(code);
    }
  }
  if (requireNonEmpty && out.length === 0) {
    issues.push(label + ' must include at least one exit code');
  }
  return out;
}

function _validateDispatchTarget(command, args, label, issues) {
  if (!command || !ALLOWED_DISPATCH_LAUNCHERS.includes(command)) {
    issues.push(label + '.dispatch.command must name an allowed process launcher: '
      + ALLOWED_DISPATCH_LAUNCHERS.join(', '));
  }
  if (!Array.isArray(args) || args.length === 0) {
    issues.push(label + '.dispatch target must be the first argument');
    return;
  }

  const rawTarget = args[0];
  const renderedTarget = rawTarget.split('{sgsd_root}').join(DEFAULT_SGSD_ROOT);
  if (/{[a-z_]+}/i.test(renderedTarget)) {
    issues.push(label + '.dispatch target contains an unresolved token: ' + rawTarget);
    return;
  }
  const targetPath = path.isAbsolute(renderedTarget)
    ? path.resolve(renderedTarget)
    : path.resolve(DEFAULT_REPO_ROOT, renderedTarget);
  const repoRoot = fs.realpathSync(DEFAULT_REPO_ROOT);
  let realTarget;
  try {
    realTarget = fs.realpathSync(targetPath);
  } catch {
    issues.push(label + '.dispatch target must resolve to an existing file inside the repository: '
      + rawTarget);
    return;
  }
  const relative = path.relative(repoRoot, realTarget);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    issues.push(label + '.dispatch target must resolve inside the repository: ' + rawTarget);
    return;
  }
  if (!fs.statSync(realTarget).isFile()) {
    issues.push(label + '.dispatch target must resolve to an existing file inside the repository: '
      + rawTarget);
  }
}

function _registeredGateProducers() {
  if (_gateProducerCache) return _gateProducerCache;
  const parsed = _yaml().load(fs.readFileSync(GATES_YAML_PATH, 'utf8'));
  const rows = parsed && Array.isArray(parsed.gates) ? parsed.gates : [];
  const producers = new Map();
  for (const gate of rows) {
    if (!gate || typeof gate.name !== 'string') continue;
    if (typeof gate.script !== 'string' || !gate.script.trim()) {
      producers.set(gate.name, null);
      continue;
    }
    const producerPath = path.resolve(DEFAULT_REPO_ROOT, gate.script);
    producers.set(gate.name, fs.existsSync(producerPath)
      ? fs.realpathSync(producerPath)
      : producerPath);
  }
  _gateProducerCache = producers;
  return producers;
}

function _dispatchProducerPath(dispatch) {
  if (!dispatch || !Array.isArray(dispatch.args) || !dispatch.args[0]) return null;
  const rendered = dispatch.args[0].split('{sgsd_root}').join(DEFAULT_SGSD_ROOT);
  if (/{[a-z_]+}/i.test(rendered)) return null;
  const candidate = path.isAbsolute(rendered)
    ? path.resolve(rendered)
    : path.resolve(DEFAULT_REPO_ROOT, rendered);
  try {
    return fs.realpathSync(candidate);
  } catch {
    return candidate;
  }
}

function gateProducerValidation(route) {
  if (!route || !route.gate_ref || !route.dispatch) {
    return { ok: true, gate_outcome_eligible: false, reason: 'no_gate_dispatch_claim' };
  }
  const producers = _registeredGateProducers();
  if (!producers.has(route.gate_ref)) {
    return {
      ok: false,
      gate_outcome_eligible: false,
      reason: 'gate_ref_not_registered:' + route.gate_ref,
    };
  }
  const expected = producers.get(route.gate_ref);
  const actual = _dispatchProducerPath(route.dispatch);
  if (!expected) {
    return {
      ok: false,
      gate_outcome_eligible: false,
      reason: 'gate_has_no_registered_process_producer:' + route.gate_ref,
    };
  }
  const matches = process.platform === 'win32'
    ? String(expected).toLowerCase() === String(actual).toLowerCase()
    : expected === actual;
  return {
    ok: matches,
    gate_outcome_eligible: matches,
    reason: matches
      ? 'registered_gate_producer'
      : 'dispatch_not_registered_gate_producer:' + route.gate_ref,
    expected_producer: expected,
    actual_producer: actual,
  };
}

function _normalizeDispatch(value, label, issues) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    issues.push(label + '.dispatch must be an object when present');
    return null;
  }
  const command = _optionalString(value.command, label + '.dispatch.command', issues);
  const args = _stringList(value.args, label + '.dispatch.args', issues);
  const timeoutMs = value.timeout_ms === undefined ? 120000 : Number(value.timeout_ms);
  const successExits = _normalizeExitCodes(
    value.success_exits, label + '.dispatch.success_exits', issues, true);
  const verdictExits = _normalizeExitCodes(
    value.verdict_exits, label + '.dispatch.verdict_exits', issues, false);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300000) {
    issues.push(label + '.dispatch.timeout_ms must be an integer from 1 to 300000');
  }
  const overlapping = successExits.filter((code) => verdictExits.includes(code));
  if (overlapping.length > 0) {
    issues.push(label + '.dispatch.success_exits and verdict_exits must not overlap: '
      + overlapping.join(', '));
  }
  _validateDispatchTarget(command, args, label, issues);
  return command && Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 300000
    ? {
      command,
      args,
      timeout_ms: timeoutMs,
      success_exits: successExits,
      verdict_exits: verdictExits,
    }
    : null;
}

function _normalizeRoute(row, index, sourceTag) {
  const issues = [];
  const label = 'routes[' + index + ']';
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { route: null, issues: [label + ' must be an object'] };
  }

  const skill = _optionalString(row.skill, label + '.skill', issues);
  const signatures = _normalizeSignatures(row.signatures, label, issues);
  const moment = _optionalString(row.moment, label + '.moment', issues);
  if (moment && !VALID_MOMENTS.includes(moment)) issues.push(label + '.moment invalid: ' + moment);
  const modes = _normalizeModes(row.modes, label, issues);
  const aliases = _stringList(row.aliases, label + '.aliases', issues);
  const availability = row.availability === undefined || row.availability === null
    ? 'canonical'
    : _optionalString(row.availability, label + '.availability', issues);
  if (availability && !VALID_AVAILABILITY.includes(availability)) {
    issues.push(label + '.availability invalid: ' + availability);
  }
  const gateRef = _optionalString(row.gate_ref, label + '.gate_ref', issues);
  const skipReason = _optionalString(row.skip_reason, label + '.skip_reason', issues);
  const notes = _optionalString(row.notes, label + '.notes', issues);
  const cooldown = _normalizeCooldown(row.cooldown, label, issues);
  const dispatch = _normalizeDispatch(row.dispatch, label, issues);
  const explicitId = _optionalString(row.id, label + '.id', issues);
  const mcpSurface = _optionalString(row.mcp_surface, label + '.mcp_surface', issues);
  if (mcpSurface && !VALID_MCP_PROMPT_SURFACES.includes(mcpSurface)) {
    issues.push(label + '.mcp_surface invalid: ' + mcpSurface);
  }

  if (availability === 'omitted' && !skipReason) {
    issues.push(label + '.skip_reason required when availability is omitted');
  }
  if (availability !== 'omitted' && moment !== 'prompt-time'
      && moment !== 'on-demand' && !dispatch && !gateRef) {
    issues.push(label + '.dispatch required for scheduled routes');
  }
  const producer = gateProducerValidation({ gate_ref: gateRef, dispatch });
  if (!producer.ok) {
    issues.push(label + '.dispatch must be the gate_ref registered producer: '
      + producer.reason);
  }

  if (issues.length > 0) return { route: null, issues };
  const id = explicitId || skill + ':' + moment + ':' + String(index + 1).padStart(2, '0');
  return {
    route: {
      id,
      skill,
      aliases,
      signatures,
      moment,
      modes,
      availability,
      gate_ref: gateRef,
      cooldown,
      dispatch,
      skip_reason: skipReason,
      notes,
      mcp_surface: mcpSurface,
      source: sourceTag,
      index,
    },
    issues: [],
  };
}

function _schemaError(issues) {
  const err = new Error('skill-routing-registry schema invalid: ' + issues.slice(0, 12).join('; '));
  err.code = 'SKILL_ROUTING_SCHEMA_INVALID';
  err.reasonCode = 'skill_routing_registry_malformed';
  err.issues = issues.slice();
  return err;
}

function _normalizeDocument(doc, sourceTag, registryPath) {
  const issues = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    issues.push('registry document must be an object with top-level routes array');
  }
  const rows = doc && Array.isArray(doc.routes) ? doc.routes : null;
  if (!rows) issues.push('top-level routes array missing');
  if (rows && rows.length === 0) issues.push('top-level routes array must not be empty');

  const routes = [];
  if (rows) {
    for (let i = 0; i < rows.length; i += 1) {
      const result = _normalizeRoute(rows[i], i, sourceTag);
      if (result.issues.length > 0) issues.push(...result.issues);
      if (result.route) routes.push(result.route);
    }
  }

  if (issues.length > 0) throw _schemaError(issues);

  const bySkill = {};
  for (const route of routes) {
    if (!bySkill[route.skill]) bySkill[route.skill] = [];
    bySkill[route.skill].push(route);
  }

  return {
    source: sourceTag,
    registry_path: registryPath || null,
    degraded: sourceTag === FALLBACK_SOURCE,
    degradation_reason: null,
    degradation_logged: false,
    routes,
    bySkill,
    validation: {
      route_count: routes.length,
      prompt_time_count: routes.filter((r) => r.moment === 'prompt-time').length,
      scheduled_count: routes.filter((r) => r.moment !== 'prompt-time' && r.moment !== 'on-demand').length,
    },
  };
}

function compiledFallbackRegistry() {
  return _normalizeDocument({ routes: _clone(COMPILED_FALLBACK_ROWS) }, FALLBACK_SOURCE, 'compiled:fallback');
}

function _errorReasonCode(error) {
  if (!error) return 'skill_routing_registry_unavailable';
  if (error.code === 'ENOENT') return 'skill_routing_registry_missing';
  if (error.code === 'SKILL_ROUTING_SCHEMA_INVALID') return 'skill_routing_registry_malformed';
  if (error.name === 'YAMLException') return 'skill_routing_registry_yaml_parse_failed';
  return 'skill_routing_registry_unavailable';
}

function _runtimeDegradationMessage(error) {
  const message = error && error.message ? error.message : String(error || 'unknown error');
  return message.length > 500 ? message.slice(0, 497) + '...' : message;
}

function _logRuntimeDegradation(error, opts, registryPath, durationMs) {
  const o = opts || {};
  if (o.logDegradation === false) return false;
  const root = _repoRootFromOpts(o);
  const state = readState(root) || {};
  const reasonCode = _errorReasonCode(error);
  const row = logGateEvidence(root, {
    signal: DEGRADED_SIGNAL,
    status: 'warn',
    reason_codes: [reasonCode],
    artifacts: [{ kind: 'registry', path: _displayPath(root, registryPath) }],
    evidence: [],
    next_action: 'Inspect skill-routing.yaml; runtime used compiled fallback routes.',
    risk: 'medium',
    duration_ms: Math.max(0, Math.round(durationMs || 0)),
    phase: state.phase || null,
    milestone: state.milestone || null,
    event: SKILL_ROUTING_EVENT,
    decision: 'fallback',
    source: FALLBACK_SOURCE,
    requested_moment: o.moment || (o.runtimeContext && o.runtimeContext.moment) || null,
    requested_mode: o.mode || (o.runtimeContext && o.runtimeContext.mode) || null,
    registry_path: _displayPath(root, registryPath),
    error_message: _runtimeDegradationMessage(error),
  });
  if (!row) _safeWarn('degradation_evidence_append_failed');
  return Boolean(row);
}

function _loadStrict(registryPath) {
  const yaml = _yaml();
  const parsed = yaml.load(fs.readFileSync(registryPath, 'utf8'));
  return _normalizeDocument(parsed, 'yaml', registryPath);
}

function loadSkillRoutingRegistry(opts) {
  const o = opts || {};
  const registryPath = _registryPathFromOpts(o);
  const started = performance.now();
  const cacheKey = registryPath;

  try {
    if (!o.noCache && _cache.has(cacheKey)) return _clone(_cache.get(cacheKey));
    const registry = _loadStrict(registryPath);
    if (!o.noCache) _cache.set(cacheKey, _clone(registry));
    return registry;
  } catch (error) {
    if (!o.runtime) throw error;
    _safeWarn(_errorReasonCode(error) + ': using compiled fallback');
    const fallback = compiledFallbackRegistry();
    fallback.degraded = true;
    fallback.degradation_reason = _errorReasonCode(error);
    fallback.degradation_message = _runtimeDegradationMessage(error);
    fallback.registry_path = registryPath;
    fallback.degradation_logged = _logRuntimeDegradation(error, o, registryPath, performance.now() - started);
    return fallback;
  }
}

function _registryFromInput(input, opts) {
  if (input && Array.isArray(input.routes)) return input;
  if (Array.isArray(input)) return { routes: input };
  return loadSkillRoutingRegistry(opts || {});
}

function _modeMatches(route, mode) {
  return !mode || route.modes.includes(mode);
}

function _routeAvailable(route) {
  return route && route.availability !== 'omitted';
}

function _directiveTarget(route) {
  return P146_DIRECTIVE_ALIASES[route.skill] || route.skill;
}

function _safeSlashTargetName(value) {
  const directive = typeof value === 'string' ? value : '';
  return SAFE_SLASH_TARGET_RE.test(directive) ? directive.slice(1) : null;
}

function isSafeSkillTarget(value) {
  return Boolean(_safeSlashTargetName(value));
}

function _entryPointIsFile(candidate) {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function _projectRootForResolution(root) {
  if (!root) return findSgsdRoot(process.cwd()) || DEFAULT_REPO_ROOT;
  const requested = path.resolve(String(root));
  return findSgsdRoot(requested) || requested;
}

function _entryPointCandidates(target, opts) {
  const o = opts || {};
  const projectRoot = _projectRootForResolution(o.root);
  const homeRoot = path.resolve(String(o.homeRoot || os.homedir()));
  return Array.from(new Set([
    path.join(DEFAULT_REPO_ROOT, 'super-gsd', 'skills', target, 'SKILL.md'),
    path.join(projectRoot, 'super-gsd', 'skills', target, 'SKILL.md'),
    path.join(projectRoot, '.claude', 'skills', target, 'SKILL.md'),
    path.join(projectRoot, '.claude', 'commands', target + '.md'),
    path.join(projectRoot, '.claude', 'commands', target, 'SKILL.md'),
    path.join(projectRoot, '.agents', 'skills', target, 'SKILL.md'),
    path.join(projectRoot, '.codex', 'skills', target, 'SKILL.md'),
    path.join(homeRoot, '.claude', 'skills', target, 'SKILL.md'),
    path.join(homeRoot, '.claude', 'commands', target + '.md'),
    path.join(homeRoot, '.claude', 'commands', target, 'SKILL.md'),
    path.join(homeRoot, '.agents', 'skills', target, 'SKILL.md'),
    path.join(homeRoot, '.codex', 'skills', target, 'SKILL.md'),
  ]));
}

function resolveSkillTarget(slashTarget, opts) {
  const o = opts || {};
  const target = _safeSlashTargetName(slashTarget);
  if (!target) return { available: false, reason: 'unsafe_skill_target', target: null };
  const exists = _entryPointCandidates(target, o).some(_entryPointIsFile);
  return {
    available: exists,
    reason: exists ? 'skill_entrypoint_exists' : 'skill_entrypoint_not_found',
    target,
  };
}

function _promptAvailability(route, opts) {
  const availability = route && route.availability || 'canonical';
  if (availability === 'omitted') {
    return {
      available: false,
      reason: route.skip_reason || 'route_omitted',
      target: _directiveTarget(route),
    };
  }
  const target = _directiveTarget(route);
  const resolved = resolveSkillTarget(_directiveFor(route, target), opts);
  if (!resolved.target) return resolved;
  if (resolved.available) return { available: true, reason: 'entrypoint_exists', target };
  if (availability === 'external-if-installed') {
    return { available: false, reason: 'external_entrypoint_not_installed', target };
  }
  if (availability === 'manual-only') {
    return { available: false, reason: 'manual_only_entrypoint_absent', target };
  }
  if (availability === 'alias') {
    return { available: false, reason: 'alias_entrypoint_absent', target };
  }
  return { available: false, reason: 'canonical_entrypoint_absent', target };
}

function _directiveFor(route, target) {
  return '/' + (target || _directiveTarget(route));
}

function toPromptGovernanceRoutes(input, opts) {
  const o = opts || {};
  const registry = _registryFromInput(input, o);
  const mode = o.mode || null;
  const rows = Array.isArray(registry.routes) ? registry.routes : [];
  const out = [];
  for (const route of rows) {
    if (route.moment !== 'prompt-time' || !_modeMatches(route, mode)) continue;
    if (route.signatures.phrases.length + route.signatures.regexes.length === 0) continue;
    const availability = o.deferAvailability === true
      ? (() => {
        if (route.availability === 'omitted') return _promptAvailability(route, o);
        const target = _safeSlashTargetName(_directiveFor(route));
        return target
          ? { available: true, reason: 'availability_deferred', target }
          : { available: false, reason: 'unsafe_skill_target', target: null };
      })()
      : _promptAvailability(route, o);
    if (!availability.available) {
      if (typeof o.onUnavailable === 'function') {
        o.onUnavailable(route, availability.reason, availability.target);
      }
      continue;
    }
    out.push({
      id: route.id,
      trigger: {
        phrases: route.signatures.phrases.slice(),
        regexes: route.signatures.regexes.slice(),
      },
      predicate: {},
      enforcement: {
        kind: 'suggestion',
        directive: _directiveFor(route, availability.target),
      },
      skill: route.skill,
      aliases: route.aliases.slice(),
      availability: route.availability,
      mcp_surface: route.mcp_surface,
      gate_ref: route.gate_ref,
      source: route.source,
    });
  }
  return out;
}

function getScheduledRoutes(moment, mode, opts) {
  const registry = opts && opts.registry ? opts.registry : loadSkillRoutingRegistry(opts || {});
  const requestedMoment = moment || (opts && opts.moment) || null;
  const requestedMode = mode || (opts && opts.mode) || null;
  const rows = Array.isArray(registry.routes) ? registry.routes : [];
  return rows
    .filter((route) => (!requestedMoment || route.moment === requestedMoment) && _modeMatches(route, requestedMode) && _routeAvailable(route))
    .map((route) => _clone(route));
}

function resetCache() {
  _cache = new Map();
}

function _fingerprint(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return { exists: true, mtime: stat.mtimeMs, size: stat.size };
  } catch {
    return { exists: false, mtime: 0, size: 0 };
  }
}

function _sameFingerprint(a, b) {
  return a.exists === b.exists && a.mtime === b.mtime && a.size === b.size;
}

function _routingParityProjection(routes) {
  return routes.map((route) => ({
    id: route.id,
    skill: route.skill,
    aliases: route.aliases,
    signatures: route.signatures,
    moment: route.moment,
    modes: route.modes,
    availability: route.availability,
    mcp_surface: route.mcp_surface,
    cooldown: route.cooldown,
    gate_ref: route.gate_ref,
    dispatch: route.dispatch,
    skip_reason: route.skip_reason,
  }));
}

function selfTest(opts) {
  const o = opts || {};
  const registryPath = _registryPathFromOpts(o);
  const root = _repoRootFromOpts(o);
  const gateEvidencePath = path.join(root, '.planning', 'metrics', 'gate-evidence.jsonl');
  const before = _fingerprint(gateEvidencePath);
  let pass = 0;
  let fail = 0;
  const failures = [];
  const assert = (name, condition, detail) => {
    if (condition) pass += 1;
    else {
      fail += 1;
      failures.push({ name, detail: detail || '' });
    }
  };

  let registry = null;
  try {
    resetCache();
    registry = loadSkillRoutingRegistry({ registryPath, noCache: true });
  } catch (error) {
    console.error('skill-routing-registry self-test: 0 pass, 1 fail');
    console.error('  FAIL: registry schema validation -- ' + error.message);
    return 1;
  }

  assert('1. registry loads from yaml source', registry.source === 'yaml' && registry.degraded === false);
  assert('2. registry has normalized routes', Array.isArray(registry.routes) && registry.routes.length >= 20,
    'route_count=' + (registry.routes && registry.routes.length));
  assert('3. every route has required normalized fields', registry.routes.every((route) => (
    route.id && route.skill && route.signatures && route.moment && route.modes && route.availability
  )));
  assert('4. prompt adapter emits P146-compatible trigger/predicate/enforcement rows', (() => {
    const routes = toPromptGovernanceRoutes(registry, { mode: 'manual' });
    return routes.length > 0
      && routes.every((route) => route.trigger && route.predicate && route.enforcement && route.enforcement.kind === 'suggestion')
      && routes.some((route) => route.enforcement.directive === '/sgsd-token-audit');
  })());
  assert('5. scheduled query filters moment+mode', (() => {
    const phaseAuto = getScheduledRoutes('phase-close', 'auto', { registry });
    const phaseManual = getScheduledRoutes('phase-close', 'manual', { registry });
    return phaseAuto.some((route) => route.skill === 'sgsd-overwatcher')
      && phaseAuto.some((route) => route.skill === 'sgsd-audit')
      && !phaseManual.some((route) => route.skill === 'sgsd-overwatcher');
  })());
  assert('6. compiled fallback preserves prompt token route', (() => {
    const fallback = compiledFallbackRegistry();
    return fallback.source === FALLBACK_SOURCE
      && toPromptGovernanceRoutes(fallback, { mode: 'manual' }).some((route) => route.enforcement.directive === '/sgsd-token-audit');
  })());
  assert('7. compiled fallback preserves phase-close scheduled routes', (() => {
    const fallback = compiledFallbackRegistry();
    const routes = getScheduledRoutes('phase-close', 'auto', { registry: fallback });
    return routes.some((route) => route.skill === 'sgsd-audit') && routes.some((route) => route.skill === 'sgsd-overwatcher');
  })());
  assert('8. schema validation does not modify gate-evidence ledger', _sameFingerprint(before, _fingerprint(gateEvidencePath)));
  assert('9. compiled fallback matches yaml routing control fields deeply', (() => {
    const fallback = compiledFallbackRegistry();
    return JSON.stringify(_routingParityProjection(fallback.routes))
      === JSON.stringify(_routingParityProjection(registry.routes));
  })(), 'yaml/fallback mismatch in id, signatures, availability, or routing controls');
  assert('9a. dispatch-only fallback drift is detected by deep parity projection', (() => {
    if (typeof _routingParityProjection !== 'function') return false;
    const fallback = compiledFallbackRegistry();
    const drifted = _clone(fallback.routes);
    const scheduled = drifted.find((route) => route.dispatch);
    if (!scheduled) return false;
    scheduled.dispatch.command = 'echo';
    return JSON.stringify(_routingParityProjection(drifted))
      !== JSON.stringify(_routingParityProjection(fallback.routes));
  })(), 'dispatch command drift was invisible to deep parity');
  assert('10. prompt adapter emits only installed safe P146-compatible directives', (() => {
    const routes = toPromptGovernanceRoutes(registry, { mode: 'manual', root });
    const directiveBySkill = Object.fromEntries(routes.map((route) => [route.skill, route.enforcement.directive]));
    return routes.every((route) => isSafeSkillTarget(route.enforcement.directive))
      && directiveBySkill['gsd-code-review'] === undefined
      && directiveBySkill['gsd-code-review-fix'] === undefined;
  })());
  assert('10a. unavailable canonical, external, and manual-only suggestions are skipped with reasons', (() => {
    const unavailable = [];
    const routes = toPromptGovernanceRoutes(registry, {
      mode: 'manual',
      root,
      onUnavailable: (route, reason) => unavailable.push({ skill: route.skill, reason }),
    });
    const directives = new Set(routes.map((route) => route.enforcement.directive));
    return !directives.has('/sgsd-memory-hygiene')
      && !directives.has('/sgsd-code-review')
      && !directives.has('/sgsd-code-review-fix')
      && unavailable.some((item) => item.skill === 'sgsd-memory-hygiene'
        && item.reason === 'canonical_entrypoint_absent')
      && unavailable.some((item) => item.skill === 'gsd-code-review'
        && item.reason === 'external_entrypoint_not_installed')
      && unavailable.some((item) => item.skill === 'gsd-code-review-fix'
        && item.reason === 'manual_only_entrypoint_absent');
  })(), 'availability metadata did not suppress a nonexistent prompt entry point');

  let malformedFixtureError = null;
  try {
    _loadStrict(path.resolve(__dirname, '..', '..', 'tools', 'self-test', 'fixtures', 'skill-routing-malformed.yaml'));
  } catch (error) {
    malformedFixtureError = error;
  }
  const malformedIssues = malformedFixtureError && Array.isArray(malformedFixtureError.issues)
    ? malformedFixtureError.issues
    : [];
  assert('11. malformed fixture rejects regexes over the maximum pattern length',
    malformedIssues.some((issue) => issue.includes('regex exceeds maximum pattern length')));
  assert('12. malformed fixture rejects unsafe repeated regex groups',
    malformedIssues.some((issue) => issue.includes('regex contains unsafe repeated group')));

  const dispatchIssues = (mutate) => {
    const rows = _clone(COMPILED_FALLBACK_ROWS);
    const scheduled = rows.find((route) => route.dispatch);
    mutate(scheduled.dispatch);
    try {
      _normalizeDocument({ routes: rows }, 'self-test', 'self-test:dispatch');
      return [];
    } catch (error) {
      return error && Array.isArray(error.issues) ? error.issues : [];
    }
  };
  assert('13. scheduled dispatches carry explicit normalized exit policies and real repo targets', (() => {
    const repoRoot = fs.realpathSync(DEFAULT_REPO_ROOT);
    return registry.routes.filter((route) => route.dispatch).every((route) => {
      const target = route.dispatch.args[0].replace('{sgsd_root}', path.join(DEFAULT_REPO_ROOT, 'super-gsd'));
      const realTarget = fs.realpathSync(path.resolve(target));
      const relative = path.relative(repoRoot, realTarget);
      return Array.isArray(route.dispatch.success_exits)
        && route.dispatch.success_exits.every(Number.isInteger)
        && Array.isArray(route.dispatch.verdict_exits)
        && route.dispatch.verdict_exits.every(Number.isInteger)
        && relative && !relative.startsWith('..') && !path.isAbsolute(relative)
        && fs.statSync(realTarget).isFile();
    });
  })(), 'scheduled dispatch policy or real target validation missing');
  assert('14. scheduled dispatch rejects no-op launcher and invalid targets', (() => {
    const echoIssues = dispatchIssues((dispatch) => { dispatch.command = 'echo'; });
    const missingIssues = dispatchIssues((dispatch) => {
      dispatch.args[0] = '{sgsd_root}/scripts/does-not-exist.sh';
    });
    const outsideIssues = dispatchIssues((dispatch) => { dispatch.args[0] = process.execPath; });
    return echoIssues.some((issue) => issue.includes('allowed process launcher'))
      && missingIssues.some((issue) => issue.includes('target must resolve to an existing file'))
      && outsideIssues.some((issue) => issue.includes('target must resolve inside the repository'));
  })(), 'echo, missing target, or out-of-repo target was accepted');
  assert('15. scheduled dispatch rejects non-integer and overlapping exit policies', (() => {
    const issues = dispatchIssues((dispatch) => {
      dispatch.success_exits = [0, 1.5];
      dispatch.verdict_exits = [0, 1];
    });
    return issues.some((issue) => issue.includes('success_exits'))
      && issues.some((issue) => issue.includes('must not overlap'));
  })(), 'invalid or overlapping exit policy was accepted');
  assert('16. gate_ref dispatch must be the gate registered producer', (() => {
    const issues = dispatchIssues((dispatch) => {
      dispatch.command = 'node';
      dispatch.args[0] = '{sgsd_root}/tools/phase-folder-audit/audit.cjs';
    });
    return issues.some((issue) => issue.includes('registered producer'));
  })(), 'forged MUDA gate producer was accepted');

  console.log('skill-routing-registry self-test: ' + pass + ' pass, ' + fail + ' fail');
  if (fail > 0) {
    for (const item of failures) {
      console.error('  FAIL: ' + item.name + (item.detail ? ' -- ' + item.detail : ''));
    }
    return 1;
  }
  return 0;
}

function _parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function _printUsage() {
  console.log('Usage:');
  console.log('  node skill-routing-registry.cjs --self-test [--registry <path>]');
  console.log('  node skill-routing-registry.cjs --runtime-probe --registry <path> --moment <moment> --mode <mode>');
  console.log('');
  console.log('MOMENTS: ' + VALID_MOMENTS.join(', '));
  console.log('MODES:   ' + VALID_MODES.join(', '));
}

function runtimeProbe(args) {
  const moment = args.moment || 'prompt-time';
  const mode = args.mode || 'manual';
  const registryPath = args.registry || DEFAULT_REGISTRY_PATH;
  const registry = loadSkillRoutingRegistry({
    registryPath,
    runtime: true,
    moment,
    mode,
    runtimeContext: { moment, mode },
  });
  const suggestionSkips = [];
  const promptRoutes = toPromptGovernanceRoutes(registry, {
    mode,
    onUnavailable: (route, reason, target) => suggestionSkips.push({
      route_id: route.id,
      skill: route.skill,
      availability: route.availability,
      target,
      reason,
    }),
  });
  const matchingRows = moment === 'prompt-time'
    ? registry.routes.filter((route) => route.moment === 'prompt-time' && _modeMatches(route, mode) && _routeAvailable(route))
    : getScheduledRoutes(moment, mode, { registry });
  const result = {
    ok: true,
    source: registry.source,
    degraded: Boolean(registry.degraded),
    degradation_reason: registry.degradation_reason || null,
    degradation_logged: Boolean(registry.degradation_logged),
    moment,
    mode,
    route_count: registry.routes.length,
    matching_route_count: matchingRows.length,
    prompt_route_count: promptRoutes.length,
    skills: matchingRows.map((route) => route.skill),
    directives: promptRoutes.map((route) => route.enforcement.directive),
    suggestion_skips: suggestionSkips,
  };
  console.log(JSON.stringify(result, null, 2));
  return 0;
}

if (require.main === module) {
  try {
    const args = _parseArgs(process.argv.slice(2));
    if (args['self-test']) {
      process.exit(selfTest({ registryPath: args.registry }));
    }
    if (args['runtime-probe']) {
      process.exit(runtimeProbe(args));
    }
    _printUsage();
    process.exit(0);
  } catch (error) {
    console.error('skill-routing-registry CLI error: ' + (error && error.message ? error.message : String(error)));
    process.exit(2);
  }
}

module.exports = {
  loadSkillRoutingRegistry,
  toPromptGovernanceRoutes,
  isSafeSkillTarget,
  resolveSkillTarget,
  getScheduledRoutes,
  compiledFallbackRegistry,
  resetCache,
  selfTest,
  runtimeProbe,
  gateProducerValidation,
  DEFAULT_REGISTRY_PATH,
  VALID_MOMENTS,
  VALID_MODES,
  VALID_AVAILABILITY,
  DEGRADED_SIGNAL,
  SKILL_ROUTING_EVENT,
  FALLBACK_SOURCE,
};
