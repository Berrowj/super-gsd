#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const CHRONICLE_DIR = __dirname;
const REPO_ROOT = path.resolve(CHRONICLE_DIR, '..', '..', '..');
const DEFAULT_PLANNING_ROOT = '.planning';
const DEFAULT_PHASE_GLOB = 'P*';
const DEFAULT_DENOMINATOR_KEYS = [
  'scope_excluded',
  'carve_outs_not_fired',
  'alternatives_rejected',
  'assumptions_made',
  'gates_skipped'
];
const SECTION_KEYS = [
  'observations',
  'claims',
  'evidence_verdicts',
  'decisions',
  'denominators',
  'synthesis',
  'autonomy_disclosure'
];

function usage() {
  return [
    'Usage:',
    '  node super-gsd/tools/chronicle/milestone-chronicle.cjs --milestone <id> --out <path>',
    '    [--planning-root .planning] [--phase-glob "P*"] [--include-v3.0-retro]'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    planningRoot: DEFAULT_PLANNING_ROOT,
    phaseGlob: DEFAULT_PHASE_GLOB,
    includeV30Retro: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--milestone') {
      args.milestone = argv[++i];
    } else if (token === '--out') {
      args.out = argv[++i];
    } else if (token === '--planning-root') {
      args.planningRoot = argv[++i];
    } else if (token === '--phase-glob') {
      args.phaseGlob = argv[++i];
    } else if (token === '--include-v3.0-retro') {
      args.includeV30Retro = true;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else {
      args.unknown = token;
    }
  }

  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readTextIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

function listDirectories(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function globToRegex(pattern) {
  let body = '';
  for (const ch of pattern) {
    if (ch === '*') {
      body += '.*';
    } else if (ch === '?') {
      body += '.';
    } else {
      body += ch.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  return new RegExp(`^${body}$`, 'i');
}

function phaseNumberFromName(name) {
  const match = String(name).match(/P?(\d+)/i);
  return match ? match[1] : name;
}

function phaseIdFromName(name) {
  const number = phaseNumberFromName(name);
  return /^P/i.test(String(number)) ? number.toUpperCase() : `P${number}`;
}

function phaseMatches(name, phaseGlob) {
  const direct = globToRegex(phaseGlob).test(name);
  const phaseId = phaseIdFromName(name);
  return direct || globToRegex(phaseGlob).test(phaseId);
}

function isClosedPhase(phaseRoot) {
  const verification = readTextIfExists(path.join(phaseRoot, 'VERIFICATION.md'));
  if (!verification.trim()) {
    return false;
  }
  return /\b(PASS|COMPLETE|CLOSED)\b/i.test(verification);
}

function emptyDenominators(keys = DEFAULT_DENOMINATOR_KEYS) {
  return keys.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});
}

function emptySections(denominatorKeys = DEFAULT_DENOMINATOR_KEYS) {
  return {
    observations: [],
    claims: [],
    evidence_verdicts: [],
    decisions: [],
    denominators: emptyDenominators(denominatorKeys),
    synthesis: [],
    autonomy_disclosure: []
  };
}

function uniqueStable(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const key = typeof value === 'string' ? `s:${value}` : `j:${JSON.stringify(value)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(value);
  }
  return out;
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null || value === '') {
    return [];
  }
  return [value];
}

function sourcePath(filePath) {
  const relative = path.relative(REPO_ROOT, path.resolve(filePath));
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join('/');
  }
  return String(filePath).split(path.sep).join('/');
}

function sectionNode(signifierRole, id, heading, body, citations = []) {
  const node = {
    id: String(id),
    heading: String(heading),
    signifier_role: signifierRole,
    body: String(body || '(no source text available)')
  };
  if (citations.length) node.citations = citations.map(String);
  return node;
}

function mergeArrayLike(target, value) {
  target.push(...asArray(value));
}

function mergeDenominators(target, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return;
  }
  for (const [key, items] of Object.entries(value)) {
    if (!DEFAULT_DENOMINATOR_KEYS.includes(key)) continue;
    if (!Array.isArray(target[key])) {
      target[key] = [];
    }
    target[key].push(...asArray(items));
  }
}

function denominatorSectionNodes(denominators) {
  return DEFAULT_DENOMINATOR_KEYS.map((key, index) => sectionNode(
    'denominators',
    `milestone-denominators-${index + 1}`,
    key,
    denominators[key].length ? denominators[key].join('; ') : `No ${key} denominator entries were present in source phases.`,
    [`denominator:${key}`]
  ));
}

function normalizeSectionItem(bucket, item, index, phaseTag) {
  if (item && typeof item === 'object' && item.id && item.heading && item.signifier_role && item.body) {
    return item;
  }
  const text = item && typeof item === 'object'
    ? (item.body || item.text || item.excerpt || JSON.stringify(item))
    : String(item || `${bucket} entry`);
  const citations = item && typeof item === 'object'
    ? asArray(item.citations || item.sources || item.source_file_paths).filter(Boolean)
    : [];
  return sectionNode(bucket, `${phaseTag}-${bucket}-${index + 1}`, `${phaseTag} ${bucket.replace(/_/g, ' ')}`, text, citations);
}

function normalizeDenominators(value, keys = DEFAULT_DENOMINATOR_KEYS) {
  const result = emptyDenominators(keys);
  mergeDenominators(result, value);
  for (const [key, items] of Object.entries(result)) {
    result[key] = uniqueStable(asArray(items));
  }
  return result;
}

function extractTitleFromMarkdown(markdown, fallback) {
  const heading = markdown.split(/\r?\n/).find((line) => /^#\s+/.test(line));
  return heading ? heading.replace(/^#\s+/, '').trim() : fallback;
}

function constructContextFromPhase({ milestone, phaseDir, phaseRoot }) {
  const phaseId = phaseIdFromName(phaseDir);
  const contextText = readTextIfExists(path.join(phaseRoot, 'CONTEXT.md'));
  const researchText = readTextIfExists(path.join(phaseRoot, 'RESEARCH.md'));
  const planText = readTextIfExists(path.join(phaseRoot, 'PLAN.md'));
  const verificationText = readTextIfExists(path.join(phaseRoot, 'VERIFICATION.md'));
  const atcText = readTextIfExists(path.join(phaseRoot, 'ATC.md'));
  const title = extractTitleFromMarkdown(
    contextText || planText || verificationText,
    `Chronicle Context: ${milestone} ${phaseId}`
  );

  return {
    chronicle_version: '1.0',
    chronicle_type: 'phase',
    id: `chronicle-${milestone}-${phaseId}`,
    title,
    generated_at: '1970-01-01T00:00:00.000Z',
    source: {
      milestone_id: milestone,
      phase_id: phaseId,
      source_file_paths: [`${sourcePath(path.join(phaseRoot, 'CONTEXT.md'))}`]
    },
    sections: {
      observations: [
        sectionNode('observations', `${phaseId}-observation`, `${phaseId} context`, contextText.trim() || `Phase ${phaseId} context was synthesized from planning files.`, [`${phaseDir}/CONTEXT.md`])
      ],
      claims: researchText.trim()
        ? [sectionNode('claims', `${phaseId}-claim`, `${phaseId} research`, researchText.trim(), [`${phaseDir}/RESEARCH.md`])]
        : [],
      evidence_verdicts: verificationText.trim()
        ? [sectionNode('evidence_verdicts', `${phaseId}-verification`, `${phaseId} verification`, verificationText.trim(), [`${phaseDir}/VERIFICATION.md`])]
        : [],
      decisions: atcText.trim()
        ? [sectionNode('decisions', `${phaseId}-decision`, `${phaseId} decision`, atcText.trim(), [`${phaseDir}/ATC.md`])]
        : [],
      denominators: [],
      synthesis: planText.trim()
        ? [sectionNode('synthesis', `${phaseId}-synthesis`, `${phaseId} plan`, planText.trim(), [`${phaseDir}/PLAN.md`])]
        : [],
      autonomy_disclosure: [
        sectionNode('autonomy_disclosure', `${phaseId}-autonomy`, `${phaseId} autonomy disclosure`, 'Context synthesized locally because no published chronicle-context.json was found.', [phaseDir])
      ]
    },
    diagrams: [],
    assets: [],
    denominators: {
      scope_excluded: [],
      carve_outs_not_fired: [],
      alternatives_rejected: [],
      assumptions_made: ['phase context synthesized from planning files'],
      gates_skipped: []
    }
  };
}

function findPublishedContext({ planningRoot, milestone, phaseDir }) {
  const phaseId = phaseIdFromName(phaseDir);
  const file = path.join(planningRoot, 'chronicles', milestone, phaseId, 'chronicle-context.json');
  return fs.existsSync(file) ? file : null;
}

function collectPhaseContexts({ planningRoot, milestone, phaseGlob }) {
  const phasesRoot = path.join(planningRoot, 'milestones', milestone, 'phases');
  const phaseDirs = listDirectories(phasesRoot)
    .filter((name) => phaseMatches(name, phaseGlob))
    .map((name) => ({ name, root: path.join(phasesRoot, name) }))
    .filter((phase) => findPublishedContext({ planningRoot, milestone, phaseDir: phase.name }) || isClosedPhase(phase.root));

  return phaseDirs.map((phase) => {
    const published = findPublishedContext({ planningRoot, milestone, phaseDir: phase.name });
    if (published) {
      return readJson(published);
    }
    return constructContextFromPhase({
      milestone,
      phaseDir: phase.name,
      phaseRoot: phase.root
    });
  });
}

function collectV30RetroContexts({ planningRoot, includeV30Retro }) {
  if (!includeV30Retro) {
    return [];
  }
  const roots = [
    path.join(planningRoot, 'chronicles', 'v3.0'),
    path.join(planningRoot, 'chronicles', 'v3.0-retro'),
    path.join(planningRoot, 'chronicles', 'v3.0-retrospective')
  ];
  const contexts = [];
  for (const root of roots) {
    for (const dir of listDirectories(root)) {
      const file = path.join(root, dir, 'chronicle-context.json');
      if (fs.existsSync(file)) {
        contexts.push(readJson(file));
      }
    }
  }
  return contexts;
}

function stableGeneratedAt(contexts) {
  const timestamps = contexts
    .map((context) => context && context.generated_at)
    .filter(Boolean)
    .sort();
  return timestamps.length ? timestamps[timestamps.length - 1] : '1970-01-01T00:00:00.000Z';
}

function rollUpMilestoneContext({ milestone, phaseContexts }) {
  const sections = emptySections();
  const denominators = emptyDenominators();

  for (const context of phaseContexts) {
    const source = context && context.source ? context.source : {};
    const sourceTag = source.phase_id || context.id || 'unknown-phase';
    const contextSections = context.sections || {};
    for (const key of SECTION_KEYS) {
      if (key === 'denominators') {
        mergeDenominators(sections.denominators, contextSections.denominators);
      } else {
        mergeArrayLike(
          sections[key],
          asArray(contextSections[key]).map((item, index) => normalizeSectionItem(key, item, index, sourceTag))
        );
      }
    }
    mergeDenominators(denominators, context.denominators);
    mergeDenominators(denominators, contextSections.denominators);
    mergeArrayLike(sections.observations, []);
    if (!contextSections.observations && context.id) {
      sections.observations.push(sectionNode(
        'observations',
        `${context.id}-source`,
        `${sourceTag} source`,
        `Included phase chronicle context ${context.id}.`,
        [sourceTag]
      ));
    }
  }

  for (const key of Object.keys(sections)) {
    if (key === 'denominators') {
      sections.denominators = normalizeDenominators(sections.denominators);
    } else {
      sections[key] = uniqueStable(sections[key]);
    }
  }

  const normalizedDenominators = normalizeDenominators(denominators);
  sections.denominators = denominatorSectionNodes(normalizedDenominators);
  const sourceFilePaths = uniqueStable(phaseContexts.flatMap((context) => asArray(context && context.source && context.source.source_file_paths)));

  return {
    chronicle_version: '1.0',
    chronicle_type: 'milestone',
    id: `chronicle-${milestone}-milestone`,
    title: `Milestone Chronicle: ${milestone}`,
    generated_at: stableGeneratedAt(phaseContexts),
    source: {
      milestone_id: milestone,
      phase_id: 'milestone',
      source_file_paths: sourceFilePaths.length ? sourceFilePaths : [`.planning/milestones/${milestone}/SUMMARY.md`]
    },
    sections,
    diagrams: [],
    assets: [],
    denominators: normalizedDenominators,
    denominators_empty_reason: DEFAULT_DENOMINATOR_KEYS.some((key) => normalizedDenominators[key].length === 0)
      ? 'some denominator sub-arrays were empty in source phase contexts'
      : undefined
  };
}

const { requireDependency: requireDep } = require('./lib/require-dep.cjs');

function resolveAjv() {
  return requireDep('ajv', { repoRoot: REPO_ROOT });
}

function tryApplyAjvErrors(ajv) {
  const plugin = requireDep('ajv-errors', { repoRoot: REPO_ROOT, strict: false });
  if (plugin) plugin(ajv);
}

function schemaPath() {
  return path.join(REPO_ROOT, 'super-gsd', 'schemas', 'chronicle.schema.json');
}

function validateChronicleContext(context) {
  const schemaFile = schemaPath();
  const Ajv = resolveAjv();
  const ajv = new Ajv({ allErrors: true, strict: false });
  tryApplyAjvErrors(ajv);
  const validate = ajv.compile(readJson(schemaFile));
  const ok = validate(context);
  return {
    ok,
    errors: ok ? [] : (validate.errors || [])
  };
}

function writeAtomic(file, payload) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, payload);
  fs.renameSync(tmp, file);
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }
  if (args.unknown || !args.milestone || !args.out) {
    console.error(usage());
    return 4;
  }

  const planningRoot = path.resolve(args.planningRoot);
  const contexts = [
    ...collectPhaseContexts({
      planningRoot,
      milestone: args.milestone,
      phaseGlob: args.phaseGlob
    }),
    ...collectV30RetroContexts({
      planningRoot,
      includeV30Retro: args.includeV30Retro
    })
  ];

  if (!contexts.length) {
    console.error(`No closed phases found for milestone ${args.milestone}`);
    return 1;
  }

  const milestoneContext = rollUpMilestoneContext({
    milestone: args.milestone,
    phaseContexts: contexts
  });
  const validation = validateChronicleContext(milestoneContext);
  if (!validation.ok) {
    console.error(JSON.stringify(validation.errors, null, 2));
    return 2;
  }

  try {
    writeAtomic(path.resolve(args.out), `${JSON.stringify(milestoneContext, null, 2)}\n`);
    return 0;
  } catch (error) {
    console.error(error && error.stack ? error.stack : String(error));
    return 3;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  collectPhaseContexts,
  constructContextFromPhase,
  rollUpMilestoneContext,
  validateChronicleContext,
  main
};
