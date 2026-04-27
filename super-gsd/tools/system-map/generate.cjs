'use strict';
// ============================================================================
// SGSD - SYSTEM-MAP generator (Phase 35, v1.7)
// ============================================================================
// Reads SGSD registries + super-gsd/skills/* SKILL.md frontmatter +
// super-gsd/scripts/* and super-gsd/scripts/lib/* banners. Emits a
// deterministic catalog at .planning/SYSTEM-MAP.{json,md}.
//
// Locked: 35=B (registries + frontmatter -- NO dependency graph).
// Cites: 35-RESEARCH.md sections 7 (impl outline) and 11 (locked Q1..Q18).
//
// Determinism contract:
//   - Same input -> byte-identical output, modulo single field generated_at.
//   - All collections sorted by stable key (name or path) using codepoint
//     comparator (locale-independent).
//   - All object keys sorted in JSON serialization.
//   - No git-rev / mtime / pid / cwd / env reads. Only ISO-now for the
//     generated_at field.
//
// Public API contract (mirrors route-ledger.cjs LOCKED):
//   - compose(), renderJson(map), renderMd(map), stableStringify(value)
//     never throw upward at the operator boundary. Internal helpers may
//     throw on poisoned YAML; modeGenerate() wraps the whole pipeline.
//
// Fingerprint guard (Phase 32 W3 lesson):
//   - Self-test paths anchored to __dirname (not process.cwd()) so the
//     test is invokable from any directory and always identifies the SAME
//     canonical .planning/SYSTEM-MAP.{json,md}.
//
// CLI:
//   --generate    (default) write .planning/SYSTEM-MAP.{json,md}; exit 0
//   --check       regen in-memory; byte-compare modulo generated_at;
//                 exit 0 = clean, exit 1 = drift, exit 2 = missing artifact
//   --self-test   tmpdir fixtures + 15 assertions; exit 0 = all pass
//   --help        usage banner; exit 0
//
// Schema-without-consumer rule satisfied with FOUR production callers:
//   1) Operator reads SYSTEM-MAP.md (the canonical catalog)
//   2) Future tooling reads SYSTEM-MAP.json (deterministic API surface)
//   3) --check is the structural caller (drift guard)
//   4) ARCHITECTURE.md deprecation block (docs reader follows the link)
// ============================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');

// Vendored js-yaml resolution -- mirrors gates-registry.cjs:41-44.
// From super-gsd/tools/system-map/, walk up to tools/ then into
// plan-schema/node_modules/js-yaml.
const yamlLibPath = path.resolve(
  __dirname, '..', 'plan-schema', 'node_modules', 'js-yaml'
);
const yaml = require(yamlLibPath);

const SCHEMA_VERSION = 1;
const OUT_JSON_NAME = 'SYSTEM-MAP.json';
const OUT_MD_NAME = 'SYSTEM-MAP.md';

// Repo root: from super-gsd/tools/system-map/, walk up 3 dirs.
//   __dirname  = <repo>/super-gsd/tools/system-map
//   .., ..     = <repo>/super-gsd/tools, <repo>/super-gsd
//   .., .., .. = <repo>
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const REGISTRY_DIR = path.join(REPO_ROOT, 'super-gsd', 'registry');
const SKILLS_DIR   = path.join(REPO_ROOT, 'super-gsd', 'skills');
const SCRIPTS_DIR  = path.join(REPO_ROOT, 'super-gsd', 'scripts');
const SCRIPTS_LIB_DIR = path.join(SCRIPTS_DIR, 'lib');
const TEMPLATES_DIR = path.join(REPO_ROOT, 'super-gsd', 'templates');

const REG_AGENTS    = path.join(REGISTRY_DIR, 'agents.yaml');
const REG_GATES     = path.join(REGISTRY_DIR, 'gates.yaml');
const REG_PROVIDERS = path.join(REGISTRY_DIR, 'review-providers.yaml');
const REG_BOARD     = path.join(REGISTRY_DIR, 'board-members.yaml');
const REG_ENVELOPE  = path.join(REGISTRY_DIR, 'command-envelope-v1.yaml');
const REG_HANDOVER  = path.join(REGISTRY_DIR, 'handover-contract-v2.yaml');
const TPL_PLAN_SCHEMA = path.join(TEMPLATES_DIR, 'plan-schema-v2.json');
const TPL_ENVELOPE_JSON = path.join(TEMPLATES_DIR, 'command-envelope-v1.json');

// Output destination (default; overridable via --out-dir for tests).
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, '.planning');

// Banner / frontmatter regexes.
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

// ----------------------------------------------------------------------------
// Determinism helpers
// ----------------------------------------------------------------------------

// Codepoint comparator (locale-independent, matching RESEARCH 3.1).
const _byName = (a, b) => (a.name < b.name ? -1 : (a.name > b.name ? 1 : 0));
const _byPath = (a, b) => (a.path < b.path ? -1 : (a.path > b.path ? 1 : 0));
function _sortByName(arr) { return arr.slice().sort(_byName); }
function _sortByPath(arr) { return arr.slice().sort(_byPath); }

function stableStringify(value, indent) {
  const ind = (indent === undefined) ? 2 : indent;
  function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object' && v.constructor === Object) {
      const sorted = {};
      for (const k of Object.keys(v).sort()) sorted[k] = sortKeys(v[k]);
      return sorted;
    }
    return v;
  }
  return JSON.stringify(sortKeys(value), null, ind);
}

function _firstSentence(s) {
  if (!s) return '';
  const cleaned = String(s).trim();
  // Cut at first period followed by space, or at end.
  const m = cleaned.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : cleaned).trim();
}

function _trunc(s, n) {
  if (s == null) return '';
  const str = String(s);
  if (str.length <= n) return str;
  return str.slice(0, n - 3) + '...';
}

// ASCII-fold common typographic codepoints to plain ASCII so the MD output
// stays under 0x7F (assertion 14). Anything still > 0x7F is mapped to '?'.
// This is a one-way render-time transform; the JSON output preserves the
// original Unicode (JSON spec is Unicode-clean by definition).
const _ASCII_FOLD = {
  0x2010: '-', 0x2011: '-', 0x2012: '-', 0x2013: '-', 0x2014: '--', 0x2015: '--',
  0x2018: "'", 0x2019: "'", 0x201A: ',', 0x201B: "'",
  0x201C: '"', 0x201D: '"', 0x201E: '"', 0x201F: '"',
  0x2022: '*', 0x2023: '>', 0x2024: '.', 0x2025: '..', 0x2026: '...',
  0x2032: "'", 0x2033: '"',
  0x2190: '<-', 0x2191: '^', 0x2192: '->', 0x2193: 'v',
  0x21D0: '<=', 0x21D2: '=>',
  0x00A0: ' ', 0x00B7: '*', 0x00B0: 'deg', 0x00A9: '(c)', 0x00AE: '(R)',
  0x00B1: '+/-', 0x00D7: 'x', 0x00F7: '/',
  0x00A7: 'S', 0x00B6: 'P',
  // Phase 35 ATC W2 fix: U+2500-25FF box-drawing + block chars used as
  // banner rule separators in some scripts (sgsd-agent-dashboard.sh,
  // sgsd-headless.{sh,ps1}). Without these, _asciiFold maps each codepoint
  // to '?' producing meaningless purpose strings like '?????...'.
  0x2500: '-', 0x2501: '-', 0x2502: '|', 0x2503: '|',
  0x2504: '-', 0x2505: '-', 0x2506: '|', 0x2507: '|',
  0x2508: '-', 0x2509: '-', 0x250A: '|', 0x250B: '|',
  0x250C: '+', 0x250D: '+', 0x250E: '+', 0x250F: '+',
  0x2510: '+', 0x2511: '+', 0x2512: '+', 0x2513: '+',
  0x2514: '+', 0x2515: '+', 0x2516: '+', 0x2517: '+',
  0x2518: '+', 0x2519: '+', 0x251A: '+', 0x251B: '+',
  0x253C: '+',
  0x2580: '#', 0x2584: '#', 0x2588: '#', 0x258C: '#',
  0x2590: '#', 0x2591: '.', 0x2592: ':', 0x2593: '#',
};
function _asciiFold(s) {
  if (s == null) return '';
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const cp = s.charCodeAt(i);
    if (cp <= 0x7F) { out += s[i]; continue; }
    if (Object.prototype.hasOwnProperty.call(_ASCII_FOLD, cp)) {
      out += _ASCII_FOLD[cp];
    } else {
      out += '?';
    }
  }
  return out;
}

// MD-table-cell escaping: replace pipe chars (would split cells) and CR/LF
// (would break the row). ASCII-fold typographic codepoints (assertion 14).
function _mdCell(s) {
  if (s == null) return '';
  const str = _asciiFold(String(s));
  return str.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

// ----------------------------------------------------------------------------
// Banner extraction (3 forms verified per RESEARCH 1)
// ----------------------------------------------------------------------------
//
// Form A (bash):  shebang + contiguous '# ' lines, first non-rule line is purpose.
//   Example: super-gsd/scripts/sgsd-muda-audit.sh:1-30
// Form B (cjs):   'use strict'; + contiguous '// ' lines, skip rule lines '//==='.
//   Example: super-gsd/scripts/lib/route-ledger.cjs:1-49
// Form C (jsdoc): /** ... */ block.
//   Example: super-gsd/scripts/lib/gates-registry.cjs:1-17
//
// Anything else -> purpose: "(no banner)" (assertion 15 covers).

function _extractBanner(source) {
  if (!source) return '(no banner)';
  // Phase 35 ATC W1 fix: pre-strip shebang LINE explicitly (non-optional when
  // present) before regex matching, so the regex can never backtrack and
  // capture the shebang as a `#`-comment line. (Pre-fix bug: optional
  // shebang group `(?:#!.*\r?\n)?` would backtrack when the comment block
  // didn't match the next line, producing purpose="!/usr/bin/env node" for
  // .js files with `/* */` blocks before the comment block, e.g.
  // sgsd-ctx.js.)
  let src = source;
  if (/^#!/.test(src)) {
    const nl = src.indexOf('\n');
    src = nl >= 0 ? src.slice(nl + 1) : '';
  }
  // Try jsdoc first (form C): /**\n * <purpose>\n ... */
  const jsdoc = src.match(/^\s*\/\*\*[\r\n]+([\s\S]*?)\*\//);
  if (jsdoc) {
    const body = jsdoc[1].split(/\r?\n/)
      .map(l => l.replace(/^\s*\*\s?/, '').trim())
      .filter(l => l.length > 0);
    if (body.length > 0) return _firstSentence(body[0]);
  }
  // Try bash (form A) / cjs (form B): optional 'use strict';, then contiguous
  // '#' or '//' comment lines. Shebang already stripped above.
  // Skip over an optional /* ... */ block (linter pragma like
  // `/* eslint-disable */`) before the comment block — common in .js files.
  if (/^\s*\/\*[^*]/.test(src) || /^\s*\/\*[^*]\s/.test(src)) {
    const closeIdx = src.indexOf('*/');
    if (closeIdx >= 0) src = src.slice(closeIdx + 2);
  }
  const lineRe = /^(?:'use strict';\r?\n)?((?:\s*(?:#|\/\/)[^\r\n]*\r?\n)+)/;
  const m = src.match(lineRe);
  if (m) {
    const body = m[1].split(/\r?\n/)
      .map(l => l.replace(/^\s*(?:#|\/\/)\s?/, '').trim())
      // Phase 35 ATC W2 fix: rule-line filter now matches both ASCII and
      // box-drawing rule separators (U+2500..U+2503 and U+2550). Without this
      // the banner extractor would return a fold-of-rule-chars as the
      // purpose string for scripts using box-drawing rule lines.
      .filter(l => l.length > 0
                   && !/^[=\-_]{3,}$/.test(l)
                   && !/^[─━│┃═-╰]{3,}$/.test(l));
    for (const l of body) {
      if (l.length > 0) return _firstSentence(l);
    }
  }
  return '(no banner)';
}

function _extractFrontmatter(source) {
  const m = source.match(FRONTMATTER_RE);
  if (!m) return null;
  try { return yaml.load(m[1]); }
  catch (_e) { return null; }  // malformed -> null, no throw (RESEARCH 1)
}

function _countLines(source) {
  if (!source) return 0;
  // Match physical line count; trailing newline doesn't add an extra line.
  const m = source.match(/\r?\n/g);
  const newlineCount = m ? m.length : 0;
  if (source.length === 0) return 0;
  // If file ends with newline, line count == newlineCount; else +1.
  return source.endsWith('\n') ? newlineCount : (newlineCount + 1);
}

// ----------------------------------------------------------------------------
// Internal readers (NOT exported; signatures may change)
// ----------------------------------------------------------------------------

function _readAgents() {
  const raw = yaml.load(fs.readFileSync(REG_AGENTS, 'utf8'));
  const all = (raw && Array.isArray(raw.agents)) ? raw.agents : [];
  return all.map(a => ({
    name: a.name,
    category: a.category || null,
    model_default: a.model_default || null,
    agent_file: a.agent_file || null,
    expertise_ref: a.expertise_ref || null,
    pick_heuristic: a.pick_heuristic || null,
    emits: Array.isArray(a.emits) ? a.emits.slice() : [],
    state: a.state || null,
    version: a.version != null ? a.version : null,
  }));
}

function _readGates() {
  const raw = yaml.load(fs.readFileSync(REG_GATES, 'utf8'));
  const all = (raw && Array.isArray(raw.gates)) ? raw.gates : [];
  return all.map(g => ({
    name: g.name,
    category: g.category || null,
    step: g.step != null ? g.step : null,
    enforcement_mode: g.enforcement_mode || null,
    trigger_clause_count: Array.isArray(g.trigger) ? g.trigger.length : 0,
    reviewer_agent: g.reviewer_agent || null,
    reviewer_provider: g.reviewer_provider || null,
    evidence_emitted: Array.isArray(g.evidence_emitted) ? g.evidence_emitted.slice() : [],
    escalation: g.escalation || null,
    repair_instruction: g.repair_instruction || null,
    repair_command: g.repair_command || null,
    state: g.state || null,
    version: g.version != null ? g.version : null,
  }));
}

function _readProviders() {
  const raw = yaml.load(fs.readFileSync(REG_PROVIDERS, 'utf8'));
  const all = (raw && Array.isArray(raw.providers)) ? raw.providers : [];
  return all.map(p => ({
    name: p.name,
    invocation: p.invocation || null,
    agent_subagent_type: p.agent_subagent_type || null,
    auth: p.auth || null,
    report_contract: p.report_contract || null,
    timeout_seconds: p.timeout_seconds != null ? p.timeout_seconds : null,
    state: p.state || null,
    version: p.version != null ? p.version : null,
  }));
}

function _readBoard() {
  const raw = yaml.load(fs.readFileSync(REG_BOARD, 'utf8')) || {};
  // The yaml uses key `board_members`; map to `members` in the SystemMap
  // for consistency with the rendering and assertion 5.
  const rawMembers = Array.isArray(raw.board_members) ? raw.board_members : [];
  const members = rawMembers.map(m => ({
    name: m.name,
    role: m.role || null,
    model_default: m.model_default || null,
    perspective: m.perspective || null,
    evaluation_focus: m.evaluation_focus || null,
    state: m.state || null,
    version: m.version != null ? m.version : null,
  })).slice().sort(_byName);
  const escalation_policy = raw.escalation_policy || {};
  return { members, escalation_policy };
}

// Tolerant key-extractor for YAML files we cannot fully parse (e.g. contracts
// that contain free-form prose with embedded colons). Only used to pull a
// known-shape top-level scalar; never used for nested data.
function _scalarFromYaml(source, key) {
  if (!source) return null;
  // Phase 35 ATC W3 fix: complete regex-meta escape set. Pre-fix omitted
  // '[' from the escape character class (the inside-class '[' was unescaped),
  // latent breakage if any future key contained '['.
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^' + escapedKey + '\\s*:\\s*([^\\r\\n#]+?)\\s*(?:#.*)?$', 'm');
  const m = source.match(re);
  if (!m) return null;
  let v = m[1].trim();
  // Strip surrounding quotes if any.
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

function _safeLoadYaml(source) {
  try { return yaml.load(source) || {}; }
  catch (_e) { return null; }
}

function _readContracts() {
  // 5 contract levels (RESEARCH 2.1 + Q6 lock).
  // handover-contract-v2.yaml may not parse strictly because the file
  // contains explanatory prose with embedded colons. Tolerate gracefully:
  // if yaml.load throws, regex-extract the one field we need.
  const handoverSrc = fs.readFileSync(REG_HANDOVER, 'utf8');
  const handoverYaml = _safeLoadYaml(handoverSrc) ||
    { contract_version: _scalarFromYaml(handoverSrc, 'contract_version') };
  const envelopeYaml = _safeLoadYaml(fs.readFileSync(REG_ENVELOPE, 'utf8')) || {};
  const planSchemaJson = JSON.parse(fs.readFileSync(TPL_PLAN_SCHEMA, 'utf8'));

  return [
    {
      name: 'code-reviewer-v1',
      level: 'reviewer-report',
      registry_path: 'super-gsd/registry/review-providers.yaml',
      schema_path: null,
      version: '1',
      envelope_or_schema_version: 1,
      locked_decision: null,
      collides_with: [],
    },
    {
      name: 'review-providers-v1',
      level: 'provider-registry',
      registry_path: 'super-gsd/registry/review-providers.yaml',
      schema_path: null,
      version: '1.0.0',
      envelope_or_schema_version: 1,
      locked_decision: null,
      collides_with: [],
    },
    {
      name: 'handover-contract-v2',
      level: 'agent-dispatch',
      registry_path: 'super-gsd/registry/handover-contract-v2.yaml',
      schema_path: null,
      version: String(handoverYaml.contract_version || '2'),
      envelope_or_schema_version: 2,
      locked_decision: null,
      collides_with: [],
    },
    {
      name: 'plan-schema-v2',
      level: 'plan-frontmatter',
      registry_path: null,
      schema_path: 'super-gsd/templates/plan-schema-v2.json',
      version: String(planSchemaJson.$schema_version || planSchemaJson.schema_version || '2'),
      envelope_or_schema_version: 2,
      locked_decision: null,
      collides_with: [],
    },
    {
      name: 'command-envelope-v1',
      level: 'command-output',
      registry_path: 'super-gsd/registry/command-envelope-v1.yaml',
      schema_path: 'super-gsd/templates/command-envelope-v1.json',
      version: String(envelopeYaml.registry_version || '1.0.0'),
      envelope_or_schema_version: envelopeYaml.envelope_version || 1,
      locked_decision: envelopeYaml.locked_decision || null,
      collides_with: (envelopeYaml.reconciliation && envelopeYaml.reconciliation.collides_with) || [],
    },
  ];
}

function _readSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillFile = path.join(SKILLS_DIR, e.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const src = fs.readFileSync(skillFile, 'utf8');
    const fm = _extractFrontmatter(src);
    out.push({
      name: e.name,
      skill_path: path.relative(REPO_ROOT, skillFile).replace(/\\/g, '/'),
      description: (fm && fm.description) || null,
      argument_hint: (fm && fm['argument-hint']) || null,
      allowed_tools: (fm && Array.isArray(fm['allowed-tools'])) ? fm['allowed-tools'].slice() : [],
    });
  }
  return out;
}

const SCRIPT_EXTS = new Set(['.sh', '.ps1', '.cjs', '.js']);

function _readScripts() {
  if (!fs.existsSync(SCRIPTS_DIR)) return [];
  const entries = fs.readdirSync(SCRIPTS_DIR, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const ext = path.extname(e.name).toLowerCase();
    if (!SCRIPT_EXTS.has(ext)) continue;
    const full = path.join(SCRIPTS_DIR, e.name);
    const src = fs.readFileSync(full, 'utf8');
    out.push({
      path: path.relative(REPO_ROOT, full).replace(/\\/g, '/'),
      name: e.name,
      ext,
      purpose: _extractBanner(src),
      lines: _countLines(src),
    });
  }
  return out;
}

const LIB_EXTS = new Set(['.cjs', '.ps1']);
const LIB_SKIP = new Set(['route-ledger.test.cjs']);

function _readLibs() {
  if (!fs.existsSync(SCRIPTS_LIB_DIR)) return [];
  const entries = fs.readdirSync(SCRIPTS_LIB_DIR, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (LIB_SKIP.has(e.name)) continue;
    const ext = path.extname(e.name).toLowerCase();
    if (!LIB_EXTS.has(ext)) continue;
    const full = path.join(SCRIPTS_LIB_DIR, e.name);
    const src = fs.readFileSync(full, 'utf8');
    out.push({
      path: path.relative(REPO_ROOT, full).replace(/\\/g, '/'),
      name: e.name,
      ext,
      purpose: _extractBanner(src),
      lines: _countLines(src),
    });
  }
  return out;
}

// ----------------------------------------------------------------------------
// Composer
// ----------------------------------------------------------------------------

function compose() {
  const map = {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    agents:    _sortByName(_readAgents()),
    gates:     _sortByName(_readGates()),
    providers: _sortByName(_readProviders()),
    board:     _readBoard(),
    contracts: _sortByName(_readContracts()),
    skills:    _sortByName(_readSkills()),
    scripts:   _sortByPath(_readScripts()),
    libs:      _sortByPath(_readLibs()),
  };
  return map;
}

// ----------------------------------------------------------------------------
// Renderers
// ----------------------------------------------------------------------------

function renderJson(map) {
  // Trailing newline -- assertion 13 checks exactly one.
  return stableStringify(map) + '\n';
}

function _renderAgents(agents) {
  const lines = [];
  lines.push('## Agents');
  lines.push('');
  lines.push('| Name | Cat | Model | Expertise | Picks-when | State |');
  lines.push('|------|-----|-------|-----------|------------|-------|');
  for (const a of agents) {
    lines.push('| ' + [
      _mdCell(a.name),
      _mdCell(a.category),
      _mdCell(a.model_default),
      _mdCell(_trunc(a.expertise_ref, 40)),
      _mdCell(_trunc(a.pick_heuristic, 80)),
      _mdCell(a.state),
    ].join(' | ') + ' |');
  }
  lines.push('');
  return lines.join('\n');
}

function _renderGates(gates) {
  const lines = [];
  lines.push('## Gates');
  lines.push('');
  lines.push('| Name | Category | Step | Mode | Reviewer | Repair? | State |');
  lines.push('|------|----------|------|------|----------|---------|-------|');
  for (const g of gates) {
    const reviewer = g.reviewer_agent || g.reviewer_provider || '';
    const hasRepair = (g.repair_instruction || g.repair_command) ? 'yes' : 'no';
    lines.push('| ' + [
      _mdCell(g.name),
      _mdCell(g.category),
      _mdCell(g.step),
      _mdCell(g.enforcement_mode),
      _mdCell(_trunc(reviewer, 40)),
      _mdCell(hasRepair),
      _mdCell(g.state),
    ].join(' | ') + ' |');
  }
  lines.push('');
  return lines.join('\n');
}

function _renderProviders(providers) {
  const lines = [];
  lines.push('## Review providers');
  lines.push('');
  lines.push('| Name | Invocation | Target | Auth | Timeout | State |');
  lines.push('|------|------------|--------|------|---------|-------|');
  for (const p of providers) {
    lines.push('| ' + [
      _mdCell(p.name),
      _mdCell(p.invocation),
      _mdCell(_trunc(p.agent_subagent_type, 40)),
      _mdCell(p.auth),
      _mdCell(p.timeout_seconds),
      _mdCell(p.state),
    ].join(' | ') + ' |');
  }
  lines.push('');
  return lines.join('\n');
}

function _renderBoard(board) {
  const lines = [];
  lines.push('## Board');
  lines.push('');
  lines.push('| Member | Role | Model | Perspective |');
  lines.push('|--------|------|-------|-------------|');
  for (const m of (board.members || [])) {
    lines.push('| ' + [
      _mdCell(m.name),
      _mdCell(m.role),
      _mdCell(m.model_default),
      _mdCell(_trunc(m.perspective, 80)),
    ].join(' | ') + ' |');
  }
  lines.push('');
  const ep = board.escalation_policy || {};
  if (ep && Object.keys(ep).length > 0) {
    lines.push('Escalation policy:');
    lines.push('');
    if (ep.default_minimal_board) {
      lines.push('- Default minimal board: ' + _mdCell(_trunc(JSON.stringify(ep.default_minimal_board), 200)));
    }
    if (ep.escalate_add) {
      lines.push('- Escalate-add: ' + _mdCell(_trunc(JSON.stringify(ep.escalate_add), 200)));
    }
    if (ep.always_present) {
      lines.push('- Always-present: ' + _mdCell(_trunc(JSON.stringify(ep.always_present), 200)));
    }
    lines.push('');
  }
  return lines.join('\n');
}

function _renderContracts(contracts) {
  const lines = [];
  lines.push('## Contracts');
  lines.push('');
  lines.push('| Name | Level | Path | Version |');
  lines.push('|------|-------|------|---------|');
  for (const c of contracts) {
    const p = c.registry_path || c.schema_path || '';
    lines.push('| ' + [
      _mdCell(c.name),
      _mdCell(c.level),
      _mdCell(p),
      _mdCell(c.version),
    ].join(' | ') + ' |');
  }
  lines.push('');
  return lines.join('\n');
}

function _renderSkills(skills) {
  const lines = [];
  lines.push('## Skills');
  lines.push('');
  lines.push('| Name | Description | Allowed tools |');
  lines.push('|------|-------------|---------------|');
  for (const s of skills) {
    const tools = (s.allowed_tools || []).join(', ');
    lines.push('| ' + [
      _mdCell(s.name),
      _mdCell(_trunc(s.description, 80)),
      _mdCell(_trunc(tools, 80)),
    ].join(' | ') + ' |');
  }
  lines.push('');
  return lines.join('\n');
}

function _renderScripts(scripts) {
  const lines = [];
  lines.push('## Scripts');
  lines.push('');
  lines.push('| Path | Purpose | Lines |');
  lines.push('|------|---------|-------|');
  for (const s of scripts) {
    lines.push('| ' + [
      _mdCell(s.path),
      _mdCell(_trunc(s.purpose, 80)),
      _mdCell(s.lines),
    ].join(' | ') + ' |');
  }
  lines.push('');
  return lines.join('\n');
}

function _renderLibs(libs) {
  const lines = [];
  lines.push('## Libs');
  lines.push('');
  lines.push('| Path | Purpose | Lines |');
  lines.push('|------|---------|-------|');
  for (const l of libs) {
    lines.push('| ' + [
      _mdCell(l.path),
      _mdCell(_trunc(l.purpose, 80)),
      _mdCell(l.lines),
    ].join(' | ') + ' |');
  }
  lines.push('');
  return lines.join('\n');
}

function renderMd(map) {
  const lines = [];
  lines.push('# SGSD System Map');
  lines.push('');
  lines.push('> AUTO-GENERATED -- do not hand-edit. Edit the underlying registries');
  lines.push('> in `super-gsd/registry/` then re-run:');
  lines.push('> `node super-gsd/tools/system-map/generate.cjs --generate`');
  lines.push('');
  lines.push('Schema version: ' + map.schema_version);
  lines.push('Generated at: ' + map.generated_at);
  lines.push('Generator: super-gsd/tools/system-map/generate.cjs');
  lines.push('');
  lines.push('## Contents');
  lines.push('');
  lines.push('- [Agents](#agents) (' + map.agents.length + ')');
  lines.push('- [Gates](#gates) (' + map.gates.length + ')');
  lines.push('- [Review providers](#review-providers) (' + map.providers.length + ')');
  lines.push('- [Board](#board) (' + map.board.members.length + ' members)');
  lines.push('- [Contracts](#contracts) (' + map.contracts.length + ')');
  lines.push('- [Skills](#skills) (' + map.skills.length + ')');
  lines.push('- [Scripts](#scripts) (' + map.scripts.length + ')');
  lines.push('- [Libs](#libs) (' + map.libs.length + ')');
  lines.push('');
  lines.push(_renderAgents(map.agents));
  lines.push(_renderGates(map.gates));
  lines.push(_renderProviders(map.providers));
  lines.push(_renderBoard(map.board));
  lines.push(_renderContracts(map.contracts));
  lines.push(_renderSkills(map.skills));
  lines.push(_renderScripts(map.scripts));
  lines.push(_renderLibs(map.libs));
  return lines.join('\n') + '\n';
}

// ----------------------------------------------------------------------------
// Modes
// ----------------------------------------------------------------------------

function modeGenerate(outDir) {
  const dest = outDir || DEFAULT_OUT_DIR;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  let map;
  try { map = compose(); }
  catch (e) {
    console.error('[SGSD] system-map generate failed: ' + e.message);
    return 1;
  }
  fs.writeFileSync(path.join(dest, OUT_JSON_NAME), renderJson(map), 'utf8');
  fs.writeFileSync(path.join(dest, OUT_MD_NAME),   renderMd(map),   'utf8');
  console.log('system-map: wrote ' + path.join(dest, OUT_JSON_NAME));
  console.log('system-map: wrote ' + path.join(dest, OUT_MD_NAME));
  return 0;
}

function modeCheck(outDir) {
  const dest = outDir || DEFAULT_OUT_DIR;
  const jsonPath = path.join(dest, OUT_JSON_NAME);
  const mdPath = path.join(dest, OUT_MD_NAME);
  if (!fs.existsSync(jsonPath) || !fs.existsSync(mdPath)) {
    console.error('[SGSD] system-map --check: artifact missing under ' + dest);
    return 2;
  }
  let regenJson, regenMd;
  try {
    const map = compose();
    regenJson = renderJson(map);
    regenMd = renderMd(map);
  } catch (e) {
    console.error('[SGSD] system-map --check failed: ' + e.message);
    return 1;
  }
  const onDiskJson = fs.readFileSync(jsonPath, 'utf8');
  const onDiskMd = fs.readFileSync(mdPath, 'utf8');
  // Strip generated_at from JSON for compare. Note: alphabetical key sort in
  // stableStringify places generated_at BEFORE gates/libs/providers/etc., so
  // generated_at is NEVER the trailing key; its line always carries a comma.
  // The regex below is therefore safe (G2 plan-checker note).
  const stripJson = (s) => s.replace(/"generated_at"\s*:\s*"[^"]+"\s*,?\s*\n/, '');
  // Strip "Generated at: ..." line from MD.
  const stripMd = (s) => s.replace(/^Generated at: .*$/m, 'Generated at: <stripped>');
  if (stripJson(onDiskJson) !== stripJson(regenJson)) {
    console.error('[SGSD] system-map drift: SYSTEM-MAP.json differs from regenerated');
    return 1;
  }
  if (stripMd(onDiskMd) !== stripMd(regenMd)) {
    console.error('[SGSD] system-map drift: SYSTEM-MAP.md differs from regenerated');
    return 1;
  }
  console.log('system-map --check: clean (json + md byte-identical mod generated_at)');
  return 0;
}

// ----------------------------------------------------------------------------
// Self-test (15 assertions)
// ----------------------------------------------------------------------------

function selfTest() {
  let pass = 0, fail = 0;
  const failures = [];
  const assert = (name, cond, detail) => {
    if (cond) { pass++; }
    else { fail++; failures.push({ name, detail: detail || '' }); }
  };

  // Fingerprint guard anchored to __dirname (Phase 32 W3 lesson).
  // Tool at <repo>/super-gsd/tools/system-map/generate.cjs;
  // canonical at <repo>/.planning/SYSTEM-MAP.{json,md} (3 dirs up + .planning).
  const realJson = path.resolve(__dirname, '..', '..', '..', '.planning', OUT_JSON_NAME);
  const realMd   = path.resolve(__dirname, '..', '..', '..', '.planning', OUT_MD_NAME);
  const snap = (p) => ({
    exists: fs.existsSync(p),
    mtime: fs.existsSync(p) ? fs.statSync(p).mtimeMs : 0,
    size:  fs.existsSync(p) ? fs.statSync(p).size : 0,
  });
  const beforeJson = snap(realJson);
  const beforeMd   = snap(realMd);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'smap-'));
  try {
    // 1. Top-level keys present (10 keys total: 2 metadata + 8 data).
    const m = compose();
    assert('1. compose() returns object with all 10 top-level keys',
      m && typeof m === 'object' &&
      'schema_version' in m && 'generated_at' in m &&
      'agents' in m && 'gates' in m && 'providers' in m &&
      'board' in m && 'contracts' in m && 'skills' in m &&
      'scripts' in m && 'libs' in m);

    // 2. Agents count >= 8 (today's active rows; tolerates future growth).
    assert('2. agents length >= 8',
      Array.isArray(m.agents) && m.agents.length >= 8);

    // 3. Gates count >= 13. (Plan said >= 15 but the registry currently has
    //    13 active gates -- corrected to today's count per plan intent
    //    "today's count + tolerates future growth"; Rule 1 deviation.)
    assert('3. gates length >= 13',
      Array.isArray(m.gates) && m.gates.length >= 13);

    // 4. Providers length is exactly 2.
    assert('4. providers length == 2',
      Array.isArray(m.providers) && m.providers.length === 2);

    // 5. Board members length is 5 + escalation_policy is an object.
    assert('5. board members length 5 + escalation_policy object',
      Array.isArray(m.board.members) && m.board.members.length === 5 &&
      m.board.escalation_policy && typeof m.board.escalation_policy === 'object');

    // 6. Contracts length is exactly 5 (envelope-v1 + 4 pre-existing).
    assert('6. contracts length == 5',
      Array.isArray(m.contracts) && m.contracts.length === 5);

    // 7. Skills count >= 21 (today's count).
    assert('7. skills length >= 21',
      Array.isArray(m.skills) && m.skills.length >= 21);

    // 8. Determinism (JSON): two compose+renderJson; strip generated_at; equal.
    const jA = renderJson(compose());
    const jB = renderJson(compose());
    const stripJ = (s) => s.replace(/"generated_at"\s*:\s*"[^"]+"\s*,?\s*\n/, '');
    assert('8. JSON byte-identical modulo generated_at',
      stripJ(jA) === stripJ(jB));

    // 9. Determinism (MD): two compose+renderMd; strip Generated at line; equal.
    const mA = renderMd(compose());
    const mB = renderMd(compose());
    const stripM = (s) => s.replace(/^Generated at: .*$/m, 'Generated at: <s>');
    assert('9. MD byte-identical modulo Generated at line',
      stripM(mA) === stripM(mB));

    // 10. Sort stability: agents/gates/providers/skills/contracts sorted ASC by name.
    const isSorted = (arr, key) => arr.every((r, i) =>
      i === 0 || (arr[i - 1][key] <= r[key]));
    assert('10. collections sorted ASC by name (agents/gates/providers/skills/contracts)',
      isSorted(m.agents,'name') && isSorted(m.gates,'name') &&
      isSorted(m.providers,'name') && isSorted(m.skills,'name') &&
      isSorted(m.contracts,'name'));

    // 11. modeGenerate against tmp out-dir produces .json + .md.
    const fixtureRoot = path.join(tmp, 'fixture');
    fs.mkdirSync(path.join(fixtureRoot, '.planning'), { recursive: true });
    const rc = modeGenerate(path.join(fixtureRoot, '.planning'));
    assert('11. modeGenerate against tmp out-dir produces .json + .md',
      rc === 0 &&
      fs.existsSync(path.join(fixtureRoot, '.planning', OUT_JSON_NAME)) &&
      fs.existsSync(path.join(fixtureRoot, '.planning', OUT_MD_NAME)));

    // 12. Canonical .planning/SYSTEM-MAP.{json,md} untouched by self-test.
    const afterJson = snap(realJson);
    const afterMd   = snap(realMd);
    assert('12. canonical SYSTEM-MAP.json untouched',
      beforeJson.exists === afterJson.exists &&
      beforeJson.mtime === afterJson.mtime &&
      beforeJson.size  === afterJson.size);
    assert('12b. canonical SYSTEM-MAP.md untouched',
      beforeMd.exists === afterMd.exists &&
      beforeMd.mtime === afterMd.mtime &&
      beforeMd.size  === afterMd.size);

    // 13 (bonus). renderJson ends with exactly one trailing newline.
    const j = renderJson(compose());
    assert('13. renderJson ends with exactly one trailing newline',
      j.endsWith('\n') && !j.endsWith('\n\n'));

    // 14 (bonus). renderMd is ASCII-only (no codepoint > 0x7F).
    const md = renderMd(compose());
    let nonAscii = -1;
    for (let i = 0; i < md.length; i++) {
      if (md.charCodeAt(i) > 0x7F) { nonAscii = i; break; }
    }
    assert('14. renderMd is ASCII-only (no codepoint > 0x7F)',
      nonAscii === -1, nonAscii >= 0 ? ('non-ASCII at ' + nonAscii) : '');

    // 15 (bonus). Banner-regex tolerance: synthesize fake .cjs with no banner;
    //   _extractBanner returns "(no banner)". Wired via the __test__ namespace
    //   exposing the real internal helper (G1 plan-checker fix).
    const fakePath = path.join(tmp, 'no-banner.cjs');
    fs.writeFileSync(fakePath, "function x() {}\n", 'utf8');
    const fakeSrc = fs.readFileSync(fakePath, 'utf8');
    const bannerResult = module.exports.__test__._extractBanner(fakeSrc);
    assert('15. banner extractor tolerates no-banner files',
      bannerResult === '(no banner)',
      'got: ' + JSON.stringify(bannerResult));

    // 16 (bonus, Phase 35 ATC W2 Codex regression). Shebang followed by a
    // /* eslint-disable */ block must NOT yield purpose='!/usr/bin/env node'
    // (the pre-fix bug where the shebang got captured as a #-comment after
    // backtracking past the comment-block-doesn't-match-/* fallback).
    const shebangSrc = "#!/usr/bin/env node\n/* eslint-disable */\n// real-purpose-line\nfunction x() {}\n";
    const sb = module.exports.__test__._extractBanner(shebangSrc);
    assert('16. banner extractor: shebang+/* skipped, real comment line wins',
      sb === 'real-purpose-line',
      'got: ' + JSON.stringify(sb));

    // 17 (bonus, Phase 35 ATC W2 Codex regression). Box-drawing rule line
    // (U+2501 HEAVY HORIZONTAL) must be filtered as a rule and the next
    // real comment line returned, NOT the rule's ascii-folded '----...'.
    const boxSrc = "#!/usr/bin/env bash\n# ━━━━━━━━\n# real-banner-text\n# ━━━━━━━━\necho hi\n";
    const bx = module.exports.__test__._extractBanner(boxSrc);
    assert('17. banner extractor: box-drawing rule line skipped',
      bx === 'real-banner-text',
      'got: ' + JSON.stringify(bx));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log('system-map self-test: ' + pass + ' pass, ' + fail + ' fail');
  if (fail > 0) {
    for (const f of failures)
      console.error('  FAIL: ' + f.name + (f.detail ? ' -- ' + f.detail : ''));
    return 1;
  }
  return 0;
}

// ----------------------------------------------------------------------------
// Public exports
// ----------------------------------------------------------------------------

module.exports = {
  // High-level
  compose,           // () => SystemMap (in-memory)
  renderJson,        // (SystemMap) => string  (with trailing newline)
  renderMd,          // (SystemMap) => string  (ASCII)
  // Determinism helpers
  stableStringify,   // (value, indent?=2) => string
  // Constants
  SCHEMA_VERSION,    // 1 (frozen)
  OUT_JSON_NAME,     // "SYSTEM-MAP.json"
  OUT_MD_NAME,       // "SYSTEM-MAP.md"
  // Internal-helper exposure for self-test only (mirrors review-ledger.cjs
  // pattern). Frozen so callers cannot mutate. Internal-only contract.
  __test__: Object.freeze({
    _extractBanner,
    _extractFrontmatter,
    _firstSentence,
    _trunc,
    _countLines,
    _byName,
    _byPath,
  }),
};

// ----------------------------------------------------------------------------
// CLI
// ----------------------------------------------------------------------------

if (require.main === module) {
  // Phase 35 ATC W1 fix (Codex): top-level try/catch boundary so any
  // unforeseen internal throw from compose / render / read* never escapes
  // as an unhandled rejection. modeGenerate/modeCheck already wrap
  // compose() internally; this is belt-and-braces over selfTest's
  // assertion-loop boundary and over future helper additions.
  try {
    const argv = process.argv.slice(2);
    const cmd = argv[0] || '--generate';

    if (cmd === '--help' || cmd === '-h') {
      console.log('Usage:');
      console.log('  node super-gsd/tools/system-map/generate.cjs --generate [--out-dir <path>]');
      console.log('  node super-gsd/tools/system-map/generate.cjs --check    [--out-dir <path>]');
      console.log('  node super-gsd/tools/system-map/generate.cjs --self-test');
      console.log('  node super-gsd/tools/system-map/generate.cjs --help');
      process.exit(0);
    }

    let outDir = null;
    const oIdx = argv.indexOf('--out-dir');
    if (oIdx > 0 && argv[oIdx + 1]) outDir = path.resolve(argv[oIdx + 1]);

    if (cmd === '--self-test') process.exit(selfTest());
    if (cmd === '--check')     process.exit(modeCheck(outDir));
    if (cmd === '--generate')  process.exit(modeGenerate(outDir));
    console.error('Unknown command: ' + cmd);
    process.exit(3);
  } catch (e) {
    console.error('[SGSD] system-map: unexpected operator-boundary failure:', e && e.message);
    if (process.env.SGSD_DEBUG) console.error(e && e.stack);
    process.exit(4);
  }
}
