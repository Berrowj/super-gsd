#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const fallbackGenerator = require('./svg-fallback-generator.cjs');

const EXIT = {
  USAGE: 1,
  INVALID_CONTEXT: 4,
  CONTEXT_NOT_FOUND: 5,
  PUML_EXTERNAL_INCLUDE: 6,
  TEMPLATE_MISSING: 7,
  RENDER_ERROR: 8
};

const DIAGRAMS = [
  'architecture',
  'lineage-dag',
  'gate-waterfall',
  'file-impact',
  'persona-lanes',
  'timeline'
];

const SECTION_TEMPLATES = [
  'eli5',
  'remember-tomorrow',
  'risks',
  'persona-impact'
];

const ROLE_ORDER = [
  'observation',
  'claim',
  'evidence_verdict',
  'decision',
  'promotion_decision',
  'denominator',
  'autonomy_disclosure',
  'other'
];

function fail(code, message) {
  if (message) process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    templatesDir: path.join(__dirname, 'templates'),
    pumlJar: null,
    skipPumlRender: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--context') {
      args.context = argv[++index];
    } else if (arg === '--out') {
      args.out = argv[++index];
    } else if (arg === '--templates-dir') {
      args.templatesDir = argv[++index];
    } else if (arg === '--puml-jar') {
      args.pumlJar = argv[++index];
    } else if (arg === '--skip-puml-render') {
      args.skipPumlRender = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      fail(EXIT.USAGE, `Usage error: unknown argument ${arg}`);
    }
  }
  if (args.help) {
    process.stdout.write([
      'Usage: node super-gsd/tools/chronicle/render-html.cjs --context <CHRONICLE-CONTEXT.json> --out <phase-chronicle.html>',
      '       [--templates-dir super-gsd/tools/chronicle/templates] [--puml-jar <path>] [--skip-puml-render]',
      ''
    ].join('\n'));
    process.exit(0);
  }
  if (!args.context || !args.out) {
    fail(EXIT.USAGE, 'Usage error: --context and --out are required');
  }
  args.context = path.resolve(args.context);
  args.out = path.resolve(args.out);
  args.templatesDir = path.resolve(args.templatesDir);
  if (args.pumlJar) args.pumlJar = path.resolve(args.pumlJar);
  return args;
}

function readJson(filePath, missingCode) {
  if (!fs.existsSync(filePath)) fail(missingCode, `Context file not found: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(EXIT.INVALID_CONTEXT, `Context json invalid: ${error.message}`);
  }
}

function loadAjv() {
  const candidates = [
    path.join(__dirname, '..', 'plan-schema', 'node_modules', 'ajv'),
    path.join(__dirname, '..', '..', 'plan-schema', 'node_modules', 'ajv'),
    'ajv'
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  return null;
}

function validateContext(context) {
  const schemaPath = path.join(__dirname, '..', '..', 'schemas', 'chronicle.schema.json');
  if (!fs.existsSync(schemaPath)) return;
  const Ajv = loadAjv();
  if (!Ajv) {
    fail(EXIT.INVALID_CONTEXT, 'Context json invalid: AJV is unavailable for chronicle.schema.json validation');
  }
  try {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const AjvCtor = Ajv.default || Ajv;
    const ajv = new AjvCtor({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    if (!validate(context)) {
      const details = (validate.errors || []).map((item) => {
        const instancePath = item.instancePath || item.dataPath || '/';
        return `${instancePath} ${item.message}`;
      }).join('; ');
      fail(EXIT.INVALID_CONTEXT, `Context json invalid: ${details}`);
    }
  } catch (error) {
    fail(EXIT.INVALID_CONTEXT, `Context json invalid: ${error.message}`);
  }
}

function assertTemplates(templatesDir) {
  const expected = [
    path.join(templatesDir, 'style.css'),
    ...DIAGRAMS.map((name) => path.join(templatesDir, 'puml', `${name}.puml`)),
    ...SECTION_TEMPLATES.map((name) => path.join(templatesDir, 'sections', `${name}.md`))
  ];
  for (const filePath of expected) {
    if (!fs.existsSync(filePath)) {
      fail(EXIT.TEMPLATE_MISSING, `Template missing: ${path.relative(process.cwd(), filePath)}`);
    }
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function plain(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function shortJson(value, max = 220) {
  try {
    const text = JSON.stringify(value);
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
  } catch (error) {
    return String(value);
  }
}

function normalizeRole(value, hint = 'other') {
  const text = String(value || hint || 'other').toLowerCase().replace(/[-\s]+/g, '_');
  if (/promotion.*decision/.test(text)) return 'promotion_decision';
  if (/evidence.*verdict/.test(text) || text === 'verdict') return 'evidence_verdict';
  if (/autonomy.*disclosure/.test(text)) return 'autonomy_disclosure';
  if (/denominator/.test(text)) return 'denominator';
  if (/decision/.test(text)) return 'decision';
  if (/claim/.test(text)) return 'claim';
  if (/observ/.test(text)) return 'observation';
  return ROLE_ORDER.includes(text) ? text : 'other';
}

function confidenceValue(item) {
  const raw = item.confidence_score ?? item.confidenceScore ?? item.score ?? item.confidence;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const normalized = raw.toLowerCase();
    if (normalized === 'high') return 0.9;
    if (normalized === 'medium') return 0.6;
    if (normalized === 'low') return 0.3;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function itemText(item) {
  return plain(item.body)
    || plain(item.summary)
    || plain(item.excerpt)
    || plain(item.text)
    || plain(item.value)
    || plain(item.verdict)
    || plain(item.decision)
    || plain(item.description)
    || shortJson(item);
}

function normalizeItem(item, roleHint, fallbackId) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const role = normalizeRole(item.signifier_role || item.signifierRole || item.role || item.type || item.kind, roleHint);
  const id = plain(item.id)
    || plain(item.cmb_id)
    || plain(item.cmbId)
    || plain(item.key)
    || `${role}-${fallbackId}`;
  const title = plain(item.title)
    || plain(item.name)
    || plain(item.heading)
    || plain(item.label)
    || id;
  return {
    id,
    role,
    title,
    body: itemText(item),
    confidence: confidenceValue(item),
    raw: item
  };
}

function collectFromValue(value, roleHint, out, seen, idPrefix) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      const item = normalizeItem(entry, roleHint, `${idPrefix}-${index + 1}`);
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
      }
    });
    return;
  }
  if (typeof value === 'object') {
    if (Array.isArray(value.items)) collectFromValue(value.items, roleHint, out, seen, `${idPrefix}-items`);
    const direct = normalizeItem(value, roleHint, idPrefix);
    if (direct && (value.id || value.cmb_id || value.body || value.summary || value.text || value.title)) {
      if (!seen.has(direct.id)) {
        seen.add(direct.id);
        out.push(direct);
      }
      return;
    }
    Object.keys(value).sort().forEach((key, index) => {
      const child = value[key];
      if (child && typeof child === 'object') {
        const item = normalizeItem({ key, ...child }, roleHint, `${idPrefix}-${index + 1}`);
        if (item && !seen.has(item.id)) {
          seen.add(item.id);
          out.push(item);
        }
      }
    });
  }
}

function collectCmbs(context) {
  const out = [];
  const seen = new Set();
  const sections = context.sections && typeof context.sections === 'object' && !Array.isArray(context.sections)
    ? context.sections
    : {};
  const keyedCollections = [
    ['observations', 'observation'],
    ['claims', 'claim'],
    ['evidence_verdicts', 'evidence_verdict'],
    ['evidenceVerdicts', 'evidence_verdict'],
    ['decisions', 'decision'],
    ['promotion_decisions', 'promotion_decision'],
    ['promotionDecisions', 'promotion_decision'],
    ['denominators', 'denominator'],
    ['autonomy_disclosure', 'autonomy_disclosure'],
    ['autonomyDisclosure', 'autonomy_disclosure'],
    ['cmbs', 'other'],
    ['cmb', 'other'],
    ['signifiers', 'other'],
    ['entries', 'other'],
    ['records', 'other'],
    ['items', 'other']
  ];
  for (const [key, role] of keyedCollections) {
    collectFromValue(context[key], role, out, seen, key);
  }
  const sectionCollections = [
    ['observations', 'observation'],
    ['claims', 'claim'],
    ['evidence_verdicts', 'evidence_verdict'],
    ['decisions', 'decision'],
    ['denominators', 'denominator'],
    ['autonomy_disclosure', 'autonomy_disclosure']
  ];
  for (const [key, role] of sectionCollections) {
    collectFromValue(sections[key], role, out, seen, `sections-${key}`);
  }
  return out.sort(compareItems);
}

function compareItems(left, right) {
  const roleDelta = ROLE_ORDER.indexOf(left.role) - ROLE_ORDER.indexOf(right.role);
  if (roleDelta) return roleDelta;
  return left.id.localeCompare(right.id);
}

function groupItems(items) {
  const grouped = {};
  for (const role of ROLE_ORDER) grouped[role] = [];
  for (const item of items) {
    const role = grouped[item.role] ? item.role : 'other';
    grouped[role].push(item);
  }
  return grouped;
}

function objectEntries(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value).sort().map((key) => [key, value[key]]);
}

function assetPaths(context) {
  const paths = new Set();
  const assetEntries = Array.isArray(context.assets)
    ? context.assets.map((value) => ['', value])
    : objectEntries(context.assets);
  for (const [key, value] of assetEntries) {
    if (key) paths.add(key);
    if (typeof value === 'string') paths.add(value);
    if (value && typeof value === 'object') {
      for (const candidate of ['path', 'file', 'relpath', 'relative_path']) {
        if (value[candidate]) paths.add(String(value[candidate]));
      }
    }
  }
  const files = Array.isArray(context.files) ? context.files : [];
  files.forEach((entry) => {
    if (typeof entry === 'string') paths.add(entry);
    else if (entry?.path) paths.add(String(entry.path));
  });
  const sourcePaths = context.source && Array.isArray(context.source.source_file_paths)
    ? context.source.source_file_paths
    : [];
  sourcePaths.forEach((filePath) => paths.add(String(filePath)));
  const gitFiles = context.git && Array.isArray(context.git.files_changed)
    ? context.git.files_changed
    : [];
  gitFiles.forEach((filePath) => paths.add(String(filePath)));
  return Array.from(paths).filter(Boolean).sort();
}

function categorizeFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  if (/test|spec|fixture|golden/.test(normalized)) return 'test';
  if (/\.planning|roadmap|state|verification|context|plan/.test(normalized)) return 'planning';
  if (/\.md$|docs?\//.test(normalized)) return 'docs';
  if (/package\.json|yaml$|yml$|config|schema/.test(normalized)) return 'config';
  if (/\.(cjs|mjs|js|ts|tsx|jsx|css|html)$/.test(normalized)) return 'source';
  return 'other';
}

function buildFileImpact(paths) {
  const buckets = { source: [], test: [], planning: [], docs: [], config: [], other: [] };
  for (const filePath of paths) buckets[categorizeFile(filePath)].push(filePath);
  return Object.fromEntries(Object.entries(buckets).filter(([, values]) => values.length));
}

function extractPeople(context, items) {
  const names = new Set();
  const sources = [context.personas, context.persona_impact, context.personaImpact, context.stakeholders];
  for (const source of sources) {
    if (Array.isArray(source)) {
      source.forEach((entry) => names.add(typeof entry === 'string' ? entry : entry?.name || entry?.persona || entry?.id));
    } else if (source && typeof source === 'object') {
      Object.keys(source).forEach((key) => names.add(key));
    }
  }
  for (const item of items) {
    const persona = item.raw?.persona || item.raw?.stakeholder || item.raw?.audience;
    if (persona) names.add(String(persona));
  }
  return Array.from(names).filter(Boolean).sort();
}

function extractGates(context, items) {
  const gates = [];
  const sources = [context.gates, context.gate_results, context.gateResults, context.verification?.gates];
  sources.forEach((source) => {
    if (Array.isArray(source)) {
      source.forEach((gate) => gates.push(typeof gate === 'string' ? { label: gate } : gate));
    } else if (source && typeof source === 'object') {
      Object.keys(source).sort().forEach((key) => gates.push({ label: key, ...source[key] }));
    }
  });
  if (!gates.length) {
    items.filter((item) => item.role === 'evidence_verdict').slice(0, 6).forEach((item) => gates.push({ label: item.title || item.id }));
  }
  return gates.map((gate, index) => ({
    id: plain(gate.id) || plain(gate.name) || `gate-${index + 1}`,
    label: plain(gate.label) || plain(gate.name) || plain(gate.id) || `Gate ${index + 1}`,
    status: plain(gate.status) || plain(gate.result) || ''
  })).sort((left, right) => left.id.localeCompare(right.id));
}

function buildTimeline(context, items) {
  const raw = context.timeline || context.stages || context.phase_timeline || context.phaseTimeline;
  if (Array.isArray(raw) && raw.length) {
    return raw.map((stage, index) => ({
      id: plain(stage.id) || `stage-${index + 1}`,
      label: typeof stage === 'string' ? stage : plain(stage.label) || plain(stage.name) || plain(stage.title) || `Stage ${index + 1}`
    })).sort((left, right) => left.id.localeCompare(right.id));
  }
  const labels = ROLE_ORDER
    .filter((role) => role !== 'other')
    .map((role) => ({ id: role, label: role.replace(/_/g, ' ') }))
    .filter((stage) => items.some((item) => item.role === stage.id));
  return labels.length ? labels : [
    { id: 'context', label: 'Context' },
    { id: 'render', label: 'Render' },
    { id: 'verify', label: 'Verify' }
  ];
}

function buildDataSpec(context) {
  const items = collectCmbs(context);
  const grouped = groupItems(items);
  const files = assetPaths(context);
  const metadata = context.metadata || {};
  const phaseName = plain(metadata.phase_name) || plain(metadata.phaseName) || plain(metadata.phase) || plain(context.title) || plain(context.id) || 'MISSING_EVIDENCE';
  const fileImpact = buildFileImpact(files);
  const gates = extractGates(context, items);
  const personas = extractPeople(context, items);
  const timelineStages = buildTimeline(context, items);
  const assetCount = Array.isArray(context.assets)
    ? context.assets.length
    : objectEntries(context.assets).length;
  const gitFiles = context.git && Array.isArray(context.git.files_changed) ? context.git.files_changed : [];
  const changedFileCount = gitFiles.length;
  const lineageNodes = [
    ['observation', 'Observations'],
    ['claim', 'Claims'],
    ['evidence_verdict', 'Evidence verdicts'],
    ['promotion_decision', 'Promotion decisions'],
    ['decision', 'Decisions']
  ].filter(([role]) => grouped[role]?.length).map(([, label]) => label);
  return {
    context,
    metadata,
    phaseName,
    items,
    grouped,
    files,
    fileImpact,
    fileCount: changedFileCount || assetCount || files.length,
    architectureNodes: files.length ? files.slice(0, 9) : ['CHRONICLE-CONTEXT.json', 'templates/puml', 'templates/sections', 'render-html.cjs'],
    lineageNodes: lineageNodes.length ? lineageNodes : ['Context', 'Claims', 'Evidence', 'Decisions'],
    gates,
    personas,
    timelineStages
  };
}

function quotePuml(value) {
  return String(value ?? 'MISSING_EVIDENCE').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
}

function pumlAlias(value, prefix, index) {
  const base = String(value || `${prefix}_${index}`).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return `${prefix}_${base || index}`;
}

function pumlSlots(dataSpec) {
  const cmbNodes = dataSpec.items.slice(0, 18).map((item, index) => {
    const alias = pumlAlias(item.id, 'cmb', index + 1);
    return `rectangle "${quotePuml(item.id)}\\n${quotePuml(item.role)}" as ${alias}`;
  }).join('\n') || 'rectangle "MISSING_EVIDENCE" as cmb_missing';
  const cmbEdges = dataSpec.items.slice(0, 17).map((item, index) => {
    const left = pumlAlias(item.id, 'cmb', index + 1);
    const right = pumlAlias(dataSpec.items[index + 1]?.id, 'cmb', index + 2);
    return `${left} --> ${right}`;
  }).join('\n') || "' MISSING_EVIDENCE";
  const fileImpactPartition = Object.keys(dataSpec.fileImpact).sort().map((category) => {
    const files = dataSpec.fileImpact[category].slice(0, 8).map((filePath, index) => {
      return `  rectangle "${quotePuml(filePath)}" as ${pumlAlias(`${category}_${index}`, 'file', index + 1)}`;
    }).join('\n');
    return `package "${quotePuml(category)}" {\n${files || '  rectangle "MISSING_EVIDENCE"'}\n}`;
  }).join('\n') || 'package "MISSING_EVIDENCE" {}';
  const gateStages = dataSpec.gates.map((gate, index) => {
    return `rectangle "${quotePuml(gate.label)}\\n${quotePuml(gate.status || 'observed')}" as ${pumlAlias(gate.id, 'gate', index + 1)}`;
  }).join('\n') || 'rectangle "MISSING_EVIDENCE" as gate_missing';
  const personaLanes = dataSpec.personas.map((persona, index) => {
    return `|${quotePuml(persona)}|\n:Impact captured;`;
  }).join('\n') || '|MISSING_EVIDENCE|\n:Impact captured;';
  const timelineStages = dataSpec.timelineStages.map((stage) => `:${quotePuml(stage.label)};`).join('\n') || ':MISSING_EVIDENCE;';
  const architectureNodes = dataSpec.architectureNodes.slice(0, 9).map((label, index) => {
    return `component "${quotePuml(label)}" as ${pumlAlias(label, 'arch', index + 1)}`;
  }).join('\n') || 'component "MISSING_EVIDENCE" as arch_missing';
  const lineageNodes = dataSpec.lineageNodes.map((label, index) => {
    return `rectangle "${quotePuml(label)}" as ${pumlAlias(label, 'lineage', index + 1)}`;
  }).join('\n') || 'rectangle "MISSING_EVIDENCE" as lineage_missing';
  const lineageEdges = dataSpec.lineageNodes.slice(0, -1).map((label, index) => {
    const left = pumlAlias(label, 'lineage', index + 1);
    const right = pumlAlias(dataSpec.lineageNodes[index + 1], 'lineage', index + 2);
    return `${left} --> ${right}`;
  }).join('\n') || "' MISSING_EVIDENCE";
  return {
    phase_name: quotePuml(dataSpec.phaseName),
    cmb_nodes: cmbNodes,
    cmb_edges: cmbEdges,
    architecture_nodes: architectureNodes,
    architecture_edges: cmbEdges,
    lineage_nodes: lineageNodes,
    lineage_edges: lineageEdges,
    gate_stages: gateStages,
    file_impact_partition: fileImpactPartition,
    persona_lanes: personaLanes,
    timeline_stages: timelineStages
  };
}

function substitutePuml(source, slots) {
  return source.replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (match, slot) => {
    if (Object.prototype.hasOwnProperty.call(slots, slot)) return slots[slot];
    return `MISSING_EVIDENCE_${slot}`;
  });
}

function probePlantUmlJar(cliPath) {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const user = process.env.USER || process.env.USERNAME || '';
  const candidates = [
    cliPath,
    process.env.PLANTUML_JAR,
    home ? path.join(home, 'plantuml.jar') : null,
    'C:/tools/plantuml.jar',
    'C:/Program Files/PlantUML/plantuml.jar',
    user ? `C:/Users/${user}/plantuml.jar` : null
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function renderWithPlantUml(jarPath, pumlSource) {
  const result = spawnSync('java', ['-jar', jarPath, '-tsvg', '-pipe'], {
    input: pumlSource,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || `PlantUML exited ${result.status}`).trim());
  }
  const svg = result.stdout.trim();
  if (!/^<svg[\s>]/.test(svg)) throw new Error('PlantUML did not emit SVG');
  return svg;
}

function renderDiagram(name, pumlSource, dataSpec, plantUmlJar, skipPumlRender) {
  if (!skipPumlRender && plantUmlJar) {
    try {
      return { svg: renderWithPlantUml(plantUmlJar, pumlSource), mode: 'plantuml' };
    } catch (plantError) {
      try {
        return { svg: fallbackGenerator.generate(name, dataSpec), mode: 'fallback', warning: plantError.message };
      } catch (fallbackError) {
        throw new Error(`PlantUML failed (${plantError.message}) and fallback failed (${fallbackError.message})`);
      }
    }
  }
  try {
    return { svg: fallbackGenerator.generate(name, dataSpec), mode: 'fallback' };
  } catch (error) {
    throw new Error(`Fallback failed for ${name}: ${error.message}`);
  }
}

function readVerificationEli5(context, contextPath) {
  const candidates = [];
  const metadata = context.metadata || {};
  [
    metadata.verification_path,
    metadata.verificationPath,
    context.verification_path,
    context.verificationPath,
    context.verification?.path
  ].forEach((candidate) => {
    if (candidate) candidates.push(String(candidate));
  });
  for (const filePath of assetPaths(context)) {
    if (/verification\.md$/i.test(filePath)) candidates.push(filePath);
  }
  const roots = [process.cwd(), path.dirname(contextPath)];
  for (const candidate of candidates) {
    for (const root of roots) {
      const resolved = path.isAbsolute(candidate) ? candidate : path.resolve(root, candidate);
      if (!fs.existsSync(resolved)) continue;
      const text = fs.readFileSync(resolved, 'utf8');
      const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const source = frontmatter ? frontmatter[1] : text.slice(0, 2000);
      const eli5 = source.match(/^eli5:\s*(?:"([^"]+)"|'([^']+)'|(.+))$/mi);
      if (eli5) return plain(eli5[1] || eli5[2] || eli5[3]);
    }
  }
  return '';
}

function bestPromotionDecision(dataSpec) {
  const candidates = dataSpec.items
    .filter((item) => item.role === 'promotion_decision' || /promotion.*decision/i.test(`${item.title} ${item.body}`))
    .sort((left, right) => {
      const confidenceDelta = right.confidence - left.confidence;
      if (confidenceDelta) return confidenceDelta;
      return left.id.localeCompare(right.id);
    });
  return candidates[0] || null;
}

function firstText(items, fallback = '') {
  const item = items.find((entry) => plain(entry.body) || plain(entry.title));
  return item ? (plain(item.body) || plain(item.title)) : fallback;
}

function truncateText(text, max = 280) {
  const normalized = plain(text).replace(/\s+/g, ' ');
  return normalized.length > max ? `${normalized.slice(0, max - 3)}...` : normalized;
}

function joinedItemText(items, maxItems = 4) {
  return items
    .map((item) => truncateText(item.body || item.title, 120))
    .filter(Boolean)
    .slice(0, maxItems)
    .join('; ');
}

function citationText(items, fallback = '') {
  for (const item of items) {
    const citations = item && item.raw && Array.isArray(item.raw.citations) ? item.raw.citations : [];
    const clean = citations.map((citation) => plain(citation)).filter(Boolean);
    if (clean.length) return clean.join(', ');
    if (item && item.id) return item.id;
  }
  return fallback;
}

function buildSlotResolver(dataSpec, contextPath) {
  const context = dataSpec.context;
  const metadata = context.metadata || {};
  const promotion = bestPromotionDecision(dataSpec);
  const decisionItems = [
    ...(dataSpec.grouped.promotion_decision || []),
    ...(dataSpec.grouped.decision || [])
  ].sort(compareItems);
  const verdictItems = dataSpec.grouped.evidence_verdict || [];
  const observationItems = dataSpec.grouped.observation || [];
  const keyFiles = dataSpec.files.slice(0, 8).join(', ');
  const known = {
    phase_name: dataSpec.phaseName,
    milestone: plain(metadata.milestone) || plain(context.milestone),
    plan_id: plain(metadata.plan_id) || plain(metadata.planId) || plain(context.plan_id),
    file_count: String(dataSpec.fileCount || 0),
    key_files: keyFiles,
    key_decisions: joinedItemText(decisionItems, 3),
    risks_to_watch: joinedItemText(verdictItems, 3),
    open_risks: joinedItemText(verdictItems, 3),
    rollback_steps: plain(context.rollback_steps) || plain(metadata.rollback_steps),
    risk_evidence: citationText(verdictItems),
    personas: dataSpec.personas.join(', '),
    persona_changes: joinedItemText(observationItems, 3),
    persona_evidence: citationText(observationItems),
    eli5_one_liner: readVerificationEli5(context, contextPath),
    key_change_summary: promotion ? truncateText(promotion.body || promotion.title) : '',
    key_change_citation: promotion ? promotion.id : '',
    risk_summary: truncateText(firstText(dataSpec.grouped.evidence_verdicts || dataSpec.grouped.evidence_verdict || [])),
    persona_summary: dataSpec.personas.length ? dataSpec.personas.join(', ') : '',
    changed_files: dataSpec.files.slice(0, 12).join('\n'),
    decisions_summary: truncateText(firstText([...(dataSpec.grouped.promotion_decision || []), ...(dataSpec.grouped.decision || [])])),
    evidence_summary: truncateText(firstText(dataSpec.grouped.evidence_verdict || [])),
    claims_summary: truncateText(firstText(dataSpec.grouped.claim || [])),
    observations_summary: truncateText(firstText(dataSpec.grouped.observation || []))
  };
  return function resolveSlot(slot) {
    if (Object.prototype.hasOwnProperty.call(known, slot) && plain(known[slot])) return plain(known[slot]);
    if (Object.prototype.hasOwnProperty.call(metadata, slot) && plain(metadata[slot])) return plain(metadata[slot]);
    if (Object.prototype.hasOwnProperty.call(context, slot) && plain(context[slot])) return plain(context[slot]);
    const camel = slot.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (Object.prototype.hasOwnProperty.call(metadata, camel) && plain(metadata[camel])) return plain(metadata[camel]);
    if (Object.prototype.hasOwnProperty.call(context, camel) && plain(context[camel])) return plain(context[camel]);
    return '';
  };
}

function missingSpan(slot) {
  return `<span class="missing-evidence" data-slot="${escapeAttr(slot)}">MISSING_EVIDENCE</span>`;
}

function substituteMarkdown(template, resolveSlot) {
  return template.replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (match, slot) => {
    const value = resolveSlot(slot);
    return value ? escapeHtml(value) : `@@MISSING:${slot}@@`;
  });
}

function restoreMissingSpans(html) {
  return html.replace(/@@MISSING:([A-Za-z0-9_]+)@@/g, (match, slot) => missingSpan(slot));
}

function inlineMarkdown(text) {
  let escaped = text;
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return restoreMissingSpans(escaped);
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let paragraph = [];
  let list = [];
  function flushParagraph() {
    if (!paragraph.length) return;
    out.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  }
  function flushList() {
    if (!list.length) return;
    out.push('<ul>');
    list.forEach((item) => out.push(`<li>${inlineMarkdown(item)}</li>`));
    out.push('</ul>');
    list = [];
  }
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(4, heading[1].length + 1);
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  return out.join('\n');
}

function renderItems(title, items) {
  const safeTitle = escapeHtml(title);
  if (!items.length) {
    return `<h2>${safeTitle}</h2>\n<p>${missingSpan(title.toLowerCase().replace(/[^a-z0-9]+/g, '_'))}</p>`;
  }
  const rows = items.map((item) => {
    return [
      '<li>',
      `<strong>${escapeHtml(item.id)}</strong>`,
      `<span>${escapeHtml(truncateText(item.title, 100))}</span>`,
      item.body ? `<p>${escapeHtml(truncateText(item.body, 240))}</p>` : '',
      '</li>'
    ].join('');
  }).join('\n');
  return `<h2>${safeTitle}</h2>\n<ol class="cmb-list">\n${rows}\n</ol>`;
}

function renderSections(templatesDir, dataSpec, contextPath) {
  const resolveSlot = buildSlotResolver(dataSpec, contextPath);
  return SECTION_TEMPLATES.map((name) => {
    const filePath = path.join(templatesDir, 'sections', `${name}.md`);
    const raw = fs.readFileSync(filePath, 'utf8');
    const substituted = substituteMarkdown(raw, resolveSlot);
    return `<article class="synthesis-card" data-template="${escapeAttr(name)}">\n${markdownToHtml(substituted)}\n</article>`;
  }).join('\n');
}

function renderDiagrams(templatesDir, dataSpec, plantUmlJar, skipPumlRender) {
  const slots = pumlSlots(dataSpec);
  const figures = [];
  let usedFallback = false;
  for (const name of DIAGRAMS) {
    const fileName = `${name}.puml`;
    const filePath = path.join(templatesDir, 'puml', fileName);
    const source = fs.readFileSync(filePath, 'utf8');
    if (/^\s*!include\s+https?:\/\//im.test(source)) {
      fail(EXIT.PUML_EXTERNAL_INCLUDE, `REPORT_PUML_EXTERNAL_INCLUDE: ${fileName}`);
    }
    const substituted = substitutePuml(source, slots);
    let rendered;
    try {
      rendered = renderDiagram(name, substituted, dataSpec, plantUmlJar, skipPumlRender);
    } catch (error) {
      fail(EXIT.RENDER_ERROR, `Render error: ${error.message}`);
    }
    if (rendered.mode === 'fallback') usedFallback = true;
    figures.push([
      `<figure data-diagram="${escapeAttr(name)}" data-renderer="${escapeAttr(rendered.mode)}">`,
      `<figcaption>${escapeHtml(name.replace(/-/g, ' '))}</figcaption>`,
      rendered.svg,
      '<details><summary>PUML source</summary>',
      `<pre><code>${escapeHtml(substituted)}</code></pre>`,
      '</details>',
      '</figure>'
    ].join('\n'));
  }
  return { html: figures.join('\n'), usedFallback };
}

function renderMetadata(dataSpec, plantUmlJar, skipPumlRender) {
  const metadata = dataSpec.metadata;
  const rows = [
    ['Phase', dataSpec.phaseName],
    ['Milestone', metadata.milestone || dataSpec.context.milestone || 'MISSING_EVIDENCE'],
    ['Plan', metadata.plan_id || metadata.planId || dataSpec.context.plan_id || 'MISSING_EVIDENCE'],
    ['Files', String(dataSpec.fileCount || 0)],
    ['PlantUML', skipPumlRender ? 'skipped' : (plantUmlJar || 'fallback')]
  ];
  return [
    `<h1>${escapeHtml(dataSpec.phaseName)} Chronicle</h1>`,
    '<dl class="metadata-grid">',
    ...rows.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`),
    '</dl>'
  ].join('\n');
}

function fallbackBanner(usedFallback, plantUmlJar, skipPumlRender) {
  if (!usedFallback || plantUmlJar || skipPumlRender) return '';
  return '<div class="fallback-banner" role="note">PUML source available; rendered via fallback generator (plantuml.jar absent)</div>';
}

function selfContainedGuard(html) {
  const externalPattern = /<(script|link)\b[^>]*(?:src|href)\s*=|(?:src|href)\s*=\s*["'](?:https?:)?\/\//i;
  if (externalPattern.test(html)) {
    throw new Error('HTML failed self-contained guard');
  }
}

function composeHtml(styleCss, dataSpec, diagramResult, sectionsHtml, plantUmlJar, skipPumlRender) {
  const grouped = dataSpec.grouped;
  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(dataSpec.phaseName)} &mdash; Chronicle</title>`,
    '<style>',
    styleCss,
    '</style>',
    '</head>',
    '<body>',
    '<header>',
    renderMetadata(dataSpec, plantUmlJar, skipPumlRender),
    '</header>',
    `<section role="observations">${renderItems('Observations', grouped.observation || [])}</section>`,
    `<section role="claims">${renderItems('Claims', grouped.claim || [])}</section>`,
    `<section role="evidence_verdicts">${renderItems('Evidence verdicts', grouped.evidence_verdict || [])}</section>`,
    `<section role="decisions">${renderItems('Decisions', [...(grouped.promotion_decision || []), ...(grouped.decision || [])].sort(compareItems))}</section>`,
    `<section role="denominators">${renderItems('Denominators', grouped.denominator || [])}</section>`,
    `<section role="synthesis">\n${sectionsHtml}\n</section>`,
    `<section role="autonomy_disclosure">${renderItems('Autonomy disclosure', grouped.autonomy_disclosure || [])}</section>`,
    `<div class="diagrams" role="group" aria-label="Diagrams">\n<h2>Diagrams</h2>\n${diagramResult.html}\n</div>`,
    fallbackBanner(diagramResult.usedFallback, plantUmlJar, skipPumlRender),
    '</body>',
    '</html>',
    ''
  ].join('\n');
  selfContainedGuard(html);
  return html;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = readJson(args.context, EXIT.CONTEXT_NOT_FOUND);
  validateContext(context);
  assertTemplates(args.templatesDir);
  const styleCss = fs.readFileSync(path.join(args.templatesDir, 'style.css'), 'utf8');
  const dataSpec = buildDataSpec(context);
  const plantUmlJar = args.skipPumlRender ? null : probePlantUmlJar(args.pumlJar);
  const diagramResult = renderDiagrams(args.templatesDir, dataSpec, plantUmlJar, args.skipPumlRender);
  const sectionsHtml = renderSections(args.templatesDir, dataSpec, args.context);
  const html = composeHtml(styleCss, dataSpec, diagramResult, sectionsHtml, plantUmlJar, args.skipPumlRender);
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, html, 'utf8');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    fail(EXIT.RENDER_ERROR, `Render error: ${error.message}`);
  }
}

module.exports = {
  buildDataSpec,
  collectCmbs,
  composeHtml,
  parseArgs,
  renderDiagrams
};
