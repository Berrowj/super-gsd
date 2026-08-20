#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const CLASSIFIER = path.join(ROOT, 'super-gsd', 'hooks', 'sgsd-intent-classifier.cjs');
const REGISTRY = path.join(ROOT, 'super-gsd', 'scripts', 'lib', 'skill-routing-registry.cjs');
const TARGET = 'sgsd-code-review';
const PROMPT = 'review my code sentinel-p159-availability';
const UNAVAILABLE_REASON = 'skill_entrypoint_not_found';
const FAMILY_SKILLS = Object.freeze([
  'create-quote',
  'erp-resolve',
  'clarity-engines',
  'vtp-implementation-pack',
  'jcl-procurement-report',
  'vtp-html-explainer',
  'diagram-design',
]);
const FAMILY_SUGGESTION_SKILLS = Object.freeze([
  'create-quote',
  'vtp-implementation-pack',
  'jcl-procurement-report',
  'vtp-html-explainer',
  'diagram-design',
]);
const FAMILY_SHADOW_IDS = Object.freeze(['erp-resolve-shadow', 'clarity-engines-shadow']);

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function writeFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

function hasForbiddenKey(value, forbidden) {
  if (Array.isArray(value)) return value.some((item) => hasForbiddenKey(item, forbidden));
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => (
    forbidden.has(key.toLowerCase()) || hasForbiddenKey(child, forbidden)
  ));
}

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-p159-availability-'));
  const project = path.join(base, 'project');
  const home = path.join(base, 'home');
  fs.mkdirSync(home, { recursive: true });
  writeFile(
    path.join(project, '.planning', 'STATE.md'),
    '---\nmilestone: fixture\ncurrent_phase: 159\n---\n',
  );
  return { base, project, home };
}

function withFixture(callback) {
  const value = fixture();
  try {
    return callback(value);
  } finally {
    fs.rmSync(value.base, { recursive: true, force: true });
  }
}

function runClassifier(value, payload, args, classifierPath) {
  const child = spawnSync(process.execPath, [classifierPath || CLASSIFIER, ...(args || [])], {
    cwd: value.project,
    env: { ...process.env, HOME: value.home, USERPROFILE: value.home },
    input: payload === null ? undefined : JSON.stringify({ ...payload, cwd: value.project }),
    encoding: 'utf8',
    timeout: 10000,
  });
  if (child.error) {
    const code = child.error.code ? ` (${child.error.code})` : '';
    throw new Error(`classifier child process failed${code}: ${child.error.message}`);
  }
  const evidenceFile = path.join(value.project, '.planning', 'metrics', 'gate-evidence.jsonl');
  const shadowFile = path.join(value.project, '.planning', 'metrics', 'kb-triage-shadow.jsonl');
  return {
    status: child.status,
    stdout: child.stdout || '',
    evidence: readJsonl(evidenceFile),
    evidenceText: fs.existsSync(evidenceFile) ? fs.readFileSync(evidenceFile, 'utf8') : '',
    shadow: readJsonl(shadowFile),
    shadowText: fs.existsSync(shadowFile) ? fs.readFileSync(shadowFile, 'utf8') : '',
  };
}

function humanPayload(prompt) {
  return {
    hook_event_name: 'UserPromptSubmit',
    origin: { kind: 'human' },
    promptSource: 'typed',
    mode: 'manual',
    prompt,
  };
}

function availabilityGuardCase() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  const check = (name, condition, detail) => {
    if (condition) pass += 1;
    else {
      fail += 1;
      failures.push(`${name}${detail ? ` -- ${detail}` : ''}`);
    }
  };

  const entrypointShapes = [
    ['global Claude skill', 'home', path.join('.claude', 'skills', TARGET, 'SKILL.md')],
    ['global Claude command file', 'home', path.join('.claude', 'commands', `${TARGET}.md`)],
    ['global Claude command skill', 'home', path.join('.claude', 'commands', TARGET, 'SKILL.md')],
    ['project Claude skill', 'project', path.join('.claude', 'skills', TARGET, 'SKILL.md')],
    ['project Claude command file', 'project', path.join('.claude', 'commands', `${TARGET}.md`)],
    ['project Claude command skill', 'project', path.join('.claude', 'commands', TARGET, 'SKILL.md')],
    ['global agents skill', 'home', path.join('.agents', 'skills', TARGET, 'SKILL.md')],
    ['global codex skill', 'home', path.join('.codex', 'skills', TARGET, 'SKILL.md')],
    ['project agents skill', 'project', path.join('.agents', 'skills', TARGET, 'SKILL.md')],
    ['project codex skill', 'project', path.join('.codex', 'skills', TARGET, 'SKILL.md')],
  ];

  for (const [label, scope, relative] of entrypointShapes) {
    withFixture((value) => {
      writeFile(path.join(value[scope], relative), '---\nname: fixture\n---\n');
      const result = runClassifier(value, humanPayload(PROMPT));
      const rows = result.evidence.filter((row) => row.signal === 'intent_routing_decision');
      check(`${label} exits zero`, result.status === 0, `status=${result.status}`);
      check(
        `${label} emits matched suggestion`,
        result.stdout === `SGSD skill suggestion: /${TARGET}\n`,
        `stdout=${JSON.stringify(result.stdout)}`,
      );
      check(
        `${label} records matched decision`,
        rows.length === 1 && rows[0].decision === 'matched'
          && rows[0].suggestions.includes(`/${TARGET}`),
        JSON.stringify(rows),
      );
    });
  }

  withFixture((value) => {
    const result = runClassifier(value, humanPayload(PROMPT));
    const rows = result.evidence.filter((row) => row.signal === 'intent_routing_decision');
    const row = rows[0] || {};
    const forbiddenKeys = new Set([
      'prompt', 'text', 'excerpt', 'path', 'command_content', 'args', 'url', 'error',
      'session_id', 'entity', 'query', 'checked_paths',
    ]);
    check('matched unavailable exits zero', result.status === 0, `status=${result.status}`);
    check('matched unavailable emits nothing', result.stdout === '', JSON.stringify(result.stdout));
    check(
      'matched unavailable writes exactly one skill_unavailable decision',
      rows.length === 1 && row.decision === 'skill_unavailable',
      JSON.stringify(rows),
    );
    check(
      'skill_unavailable has fixed markers and empty output arrays',
      row.route_id && String(row.route_id).startsWith('gsd-code-review:prompt-time:')
        && row.target_skill === TARGET
        && JSON.stringify(row.reason_codes) === JSON.stringify([UNAVAILABLE_REASON])
        && Array.isArray(row.directives) && row.directives.length === 0
        && Array.isArray(row.suggestions) && row.suggestions.length === 0
        && Array.isArray(row.artifacts) && row.artifacts.length === 0
        && Array.isArray(row.evidence) && row.evidence.length === 0,
      JSON.stringify(row),
    );
    check(
      'skill_unavailable row leaks no prompt, checked path, or text-bearing field',
      !result.evidenceText.includes(PROMPT)
        && !result.evidenceText.includes(value.project)
        && !result.evidenceText.includes(value.home)
        && !hasForbiddenKey(row, forbiddenKeys),
      result.evidenceText,
    );
  });

  withFixture((value) => {
    const result = runClassifier(value, humanPayload('ordinary unmatched input sentinel-p159'));
    const rows = result.evidence.filter((row) => row.signal === 'intent_routing_decision');
    check(
      'an unrelated absent target writes no skill_unavailable row',
      rows.length === 1 && rows[0].decision === 'no_match'
        && !rows.some((row) => row.decision === 'skill_unavailable'),
      JSON.stringify(rows),
    );
  });

  withFixture((value) => {
    const copiedFiles = [
      path.join('hooks', 'sgsd-intent-classifier.cjs'),
      path.join('scripts', 'lib', 'gate-evidence-log.cjs'),
      path.join('scripts', 'lib', 'sgsd-state.cjs'),
      path.join('scripts', 'lib', 'skill-routing-registry.cjs'),
      path.join('registry', 'session-governance-hooks.yaml'),
    ];
    for (const relative of copiedFiles) {
      const destination = path.join(value.project, 'super-gsd', relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(ROOT, 'super-gsd', relative), destination);
    }
    const yamlDestination = path.join(
      value.project, 'super-gsd', 'tools', 'plan-schema', 'node_modules', 'js-yaml',
    );
    fs.mkdirSync(path.dirname(yamlDestination), { recursive: true });
    fs.cpSync(
      path.join(ROOT, 'super-gsd', 'tools', 'plan-schema', 'node_modules', 'js-yaml'),
      yamlDestination,
      { recursive: true },
    );
    writeFile(path.join(value.project, 'super-gsd', 'registry', 'skill-routing.yaml'), [
      'routes:',
      '  - skill: create-quote',
      '    signatures:',
      '      phrases:',
      '        - create fixture quote',
      '    moment: prompt-time',
      '    modes:',
      '      - manual',
      '    availability: external-if-installed',
      '',
    ].join('\n'));
    writeFile(
      path.join(value.project, '.claude', 'skills', 'create-quote', 'SKILL.md'),
      '---\nname: create-quote\n---\n',
    );
    const instanceClassifier = path.join(
      value.project, 'super-gsd', 'hooks', 'sgsd-intent-classifier.cjs',
    );
    const result = runClassifier(
      value,
      humanPayload('create fixture quote'),
      [],
      instanceClassifier,
    );
    const rows = result.evidence.filter((row) => row.signal === 'intent_routing_decision');
    check('installed non-sgsd stdin target exits zero', result.status === 0, `status=${result.status}`);
    check(
      'installed non-sgsd slash target emits through production stdin',
      result.stdout === 'SGSD skill suggestion: /create-quote\n',
      JSON.stringify(result.stdout),
    );
    check(
      'installed non-sgsd stdin target records one matched decision',
      rows.length === 1 && rows[0].decision === 'matched'
        && rows[0].suggestions.length === 1
        && rows[0].suggestions[0] === '/create-quote',
      JSON.stringify(rows),
    );
  });

  const routingRegistry = require(REGISTRY);
  const classifier = require(CLASSIFIER);
  withFixture((value) => {
    const registry = { routes: [{
      id: 'create-quote:prompt-time:fixture',
      skill: 'create-quote',
      aliases: [],
      signatures: { phrases: ['create fixture quote'], regexes: [] },
      moment: 'prompt-time',
      modes: ['manual'],
      availability: 'external-if-installed',
      gate_ref: null,
      source: 'fixture',
    }] };
    const unavailable = [];
    const defaultRoutes = routingRegistry.toPromptGovernanceRoutes(registry, {
      mode: 'manual', root: value.project, homeRoot: value.home,
      onUnavailable: (route, reason) => unavailable.push([route.id, reason]),
    });
    const deferredRoutes = routingRegistry.toPromptGovernanceRoutes(registry, {
      mode: 'manual', root: value.project, homeRoot: value.home, deferAvailability: true,
    });
    check(
      'P149 adapter default filtering contract remains unchanged',
      defaultRoutes.length === 0 && unavailable.length === 1
        && unavailable[0][1] === 'external_entrypoint_not_installed',
      JSON.stringify({ defaultRoutes, unavailable }),
    );
    check(
      'classifier can defer adapter availability until after lexical matching',
      deferredRoutes.length === 1 && deferredRoutes[0].enforcement.directive === '/create-quote',
      JSON.stringify(deferredRoutes),
    );
  });

  check('registry exports the names-only resolver', typeof routingRegistry.resolveSkillTarget === 'function');
  if (typeof routingRegistry.resolveSkillTarget === 'function') {
    withFixture((value) => {
      writeFile(
        path.join(value.project, '.claude', 'skills', 'create-quote', 'SKILL.md'),
        '---\nname: create-quote\n---\n',
      );
      const resolved = routingRegistry.resolveSkillTarget('/create-quote', {
        root: value.project, homeRoot: value.home,
      });
      check(
        'resolver accepts an installed safe non-sgsd target by name only',
        resolved.available === true && resolved.target === 'create-quote',
        JSON.stringify(resolved),
      );
    });
    for (const unsafe of [
      '/../escape', '/two/levels', '/UPPER', '/under_score', '/dot.name', '/trailing-',
      ' /safe-target', '/safe-target ',
    ]) {
      const resolved = routingRegistry.resolveSkillTarget(unsafe, { root: ROOT });
      check(
        `resolver rejects unsafe slash syntax ${unsafe}`,
        resolved.available === false && resolved.reason === 'unsafe_skill_target',
        JSON.stringify(resolved),
      );
    }
  }

  check(
    'routeDirectives accepts safe non-sgsd targets',
    classifier.routeDirectives([{
      enforcement: { kind: 'suggestion', directive: '/create-quote' },
    }], 'suggestion').includes('/create-quote'),
  );
  check(
    'routeDirectives rejects unsafe slash targets',
    classifier.routeDirectives([
      { enforcement: { kind: 'suggestion', directive: '/../escape' } },
      { enforcement: { kind: 'suggestion', directive: '/two/levels' } },
      { enforcement: { kind: 'suggestion', directive: '/UPPER' } },
    ], 'suggestion').length === 0,
  );

  console.log(`skill-routing-expansion availability-guard: ${pass} pass, ${fail} fail`);
  for (const failure of failures) console.error(`  FAIL: ${failure}`);
  return fail === 0 ? 0 : 1;
}

function copyClassifierInstance(value, includeFamilyRows) {
  const copiedFiles = [
    path.join('hooks', 'sgsd-intent-classifier.cjs'),
    path.join('scripts', 'lib', 'gate-evidence-log.cjs'),
    path.join('scripts', 'lib', 'sgsd-state.cjs'),
    path.join('scripts', 'lib', 'skill-routing-registry.cjs'),
    path.join('scripts', 'sgsd-distill-milestone.sh'),
    path.join('scripts', 'sgsd-muda-audit.sh'),
    path.join('overwatcher', 'overwatcher-launcher.js'),
    path.join('tools', 'token-waste', 'check.cjs'),
    path.join('tools', 'vtp-readiness', 'run.cjs'),
    path.join('tools', 'release-readiness', 'score.cjs'),
    path.join('tools', 'phase-folder-audit', 'audit.cjs'),
  ];
  for (const relative of copiedFiles) {
    const destination = path.join(value.project, 'super-gsd', relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'super-gsd', relative), destination);
  }
  const yamlDestination = path.join(
    value.project, 'super-gsd', 'tools', 'plan-schema', 'node_modules', 'js-yaml',
  );
  fs.mkdirSync(path.dirname(yamlDestination), { recursive: true });
  fs.cpSync(
    path.join(ROOT, 'super-gsd', 'tools', 'plan-schema', 'node_modules', 'js-yaml'),
    yamlDestination,
    { recursive: true },
  );

  const registryDir = path.join(value.project, 'super-gsd', 'registry');
  fs.mkdirSync(registryDir, { recursive: true });
  if (includeFamilyRows) {
    for (const name of ['gates.yaml', 'skill-routing.yaml', 'session-governance-hooks.yaml']) {
      fs.copyFileSync(
        path.join(ROOT, 'super-gsd', 'registry', name),
        path.join(registryDir, name),
      );
    }
  } else {
    writeFile(path.join(registryDir, 'skill-routing.yaml'), [
      'routes:',
      '  - skill: sgsd-token-audit',
      '    signatures:',
      '      phrases:',
      '        - token spend',
      '    moment: prompt-time',
      '    modes:',
      '      - manual',
      '    availability: canonical',
      '',
    ].join('\n'));
    writeFile(path.join(registryDir, 'session-governance-hooks.yaml'), [
      'routes:',
      '  - id: planning-triage',
      '    trigger:',
      '      phrases:',
      '        - multiple valid approaches',
      '    predicate:',
      '      exclude_phrases:',
      '        - build this now',
      '    enforcement:',
      '      kind: directive',
      '      directive: /sgsd-triage',
      '',
    ].join('\n'));
  }
  for (const skill of FAMILY_SKILLS) {
    writeFile(
      path.join(value.project, '.claude', 'skills', skill, 'SKILL.md'),
      '---\nname: ' + skill + '\n---\n',
    );
  }
  fs.mkdirSync(path.join(value.project, '.planning', 'metrics'), { recursive: true });
  return path.join(value.project, 'super-gsd', 'hooks', 'sgsd-intent-classifier.cjs');
}

function familyFixtureRun(prompt, includeFamilyRows, omittedSkill) {
  return withFixture((value) => {
    const classifierPath = copyClassifierInstance(value, includeFamilyRows);
    if (omittedSkill) {
      fs.rmSync(
        path.join(value.project, '.claude', 'skills', omittedSkill),
        { recursive: true, force: true },
      );
    }
    return runClassifier(value, humanPayload(prompt), [], classifierPath);
  });
}

function emittedSuggestions(result) {
  return String(result.stdout || '').split(/\r?\n/).filter(Boolean).map((line) => (
    line.replace(/^SGSD skill suggestion:\s*/, '')
  ));
}

function familyShadowRows(result) {
  return result.shadow.filter((row) => (
    Array.isArray(row.matched_signature_ids)
      && row.matched_signature_ids.some((id) => FAMILY_SHADOW_IDS.includes(id))
  ));
}

function erpVtpSkillFamilyCase() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  const check = (name, condition, detail) => {
    if (condition) pass += 1;
    else {
      fail += 1;
      failures.push(name + (detail ? ' -- ' + detail : ''));
    }
  };

  const suggestionMatrix = [
    ['create-quote', 'Create a SAP quote artifact for this customer'],
    ['vtp-implementation-pack', 'Convert this meeting transcript into an implementation pack with actions'],
    ['jcl-procurement-report', 'Prepare a JCL procurement status report'],
    ['vtp-html-explainer', 'Create an HTML explainer for this architecture'],
    ['diagram-design', 'Draw a standalone sequence diagram for this flow'],
  ];
  for (const [skill, prompt] of suggestionMatrix) {
    const result = familyFixtureRun(prompt, true);
    const suggestions = emittedSuggestions(result);
    check(skill + ' positive exits zero', result.status === 0, 'status=' + result.status);
    check(
      skill + ' is the only emitted suggestion',
      JSON.stringify(suggestions) === JSON.stringify(['/' + skill]),
      JSON.stringify(suggestions),
    );
  }

  const shadowMatrix = [
    ['erp-resolve-shadow', 'would_route_erp_resolve', 'Fix - reconcile the SAP vendor record'],
    ['clarity-engines-shadow', 'would_route_clarity_engines', 'Build - compare the Clarity retrieval engine indexes'],
  ];
  for (const [routeId, action, prompt] of shadowMatrix) {
    const result = familyFixtureRun(prompt, true);
    const rows = familyShadowRows(result);
    check(routeId + ' positive exits zero', result.status === 0, 'status=' + result.status);
    check(routeId + ' remains shadow-only', result.stdout === '', JSON.stringify(result.stdout));
    check(
      routeId + ' writes one fixed-action row',
      rows.length === 1
        && JSON.stringify(rows[0].matched_signature_ids) === JSON.stringify([routeId])
        && rows[0].soft_path_action === action,
      JSON.stringify(rows),
    );
    check(
      routeId + ' shadow evidence is text-free',
      !result.shadowText.toLowerCase().includes(prompt.toLowerCase())
        && !hasForbiddenKey(rows[0], new Set(['prompt', 'text', 'query', 'entity', 'path', 'error'])),
      result.shadowText,
    );
  }

  const negativePrompts = [
    'quote record engine meeting report diagram',
    'build a quote',
    'fix the ERP customer record',
    'build the Clarity retrieval index',
    'convert a meeting',
    'JCL report',
    'make a diagram',
    'Create an HTML explainer with a standalone sequence diagram',
  ];
  for (const prompt of negativePrompts) {
    const result = familyFixtureRun(prompt, true);
    const suggestions = emittedSuggestions(result)
      .filter((item) => FAMILY_SUGGESTION_SKILLS.some((skill) => item === '/' + skill));
    check(
      'negative/boundary fixture produces no T2 fire: ' + prompt,
      suggestions.length === 0 && familyShadowRows(result).length === 0,
      JSON.stringify({ suggestions, shadow: familyShadowRows(result) }),
    );
  }

  for (const [skill, prompt] of suggestionMatrix) {
    const red = familyFixtureRun(prompt, false);
    check(
      'internal red registry without rows produces zero ' + skill + ' fires',
      emittedSuggestions(red).length === 0 && familyShadowRows(red).length === 0,
      JSON.stringify({ stdout: red.stdout, shadow: red.shadow }),
    );
  }
  for (const [routeId, , prompt] of shadowMatrix) {
    const red = familyFixtureRun(prompt, false);
    check(
      'internal red registry without rows produces zero ' + routeId + ' fires',
      emittedSuggestions(red).length === 0 && familyShadowRows(red).length === 0,
      JSON.stringify({ stdout: red.stdout, shadow: red.shadow }),
    );
  }

  const unavailable = familyFixtureRun(suggestionMatrix[0][1], true, 'create-quote');
  check(
    'matched unavailable family target emits no suggestion',
    !emittedSuggestions(unavailable).includes('/create-quote'),
    JSON.stringify(unavailable.stdout),
  );
  check(
    'matched unavailable family target records T1 evidence',
    unavailable.evidence.some((row) => row.decision === 'skill_unavailable'
      && row.target_skill === 'create-quote'),
    JSON.stringify(unavailable.evidence),
  );
  const unavailableShadow = familyFixtureRun(shadowMatrix[0][2], true, 'erp-resolve');
  check(
    'matched unavailable shadow target produces zero shadow fires',
    familyShadowRows(unavailableShadow).length === 0 && unavailableShadow.stdout === '',
    JSON.stringify({ stdout: unavailableShadow.stdout, shadow: unavailableShadow.shadow }),
  );

  const routingRegistry = require(REGISTRY);
  const yamlRegistry = routingRegistry.loadSkillRoutingRegistry({ noCache: true });
  const fallbackRegistry = routingRegistry.compiledFallbackRegistry();
  const project = (route) => ({
    id: route.id,
    skill: route.skill,
    signatures: route.signatures,
    moment: route.moment,
    modes: route.modes,
    availability: route.availability,
  });
  const isFamilySuggestion = (route) => (
    route.moment === 'prompt-time' && FAMILY_SUGGESTION_SKILLS.includes(route.skill)
  );
  check(
    'YAML and compiled fallback family rows are deeply equivalent',
    JSON.stringify(yamlRegistry.routes.filter(isFamilySuggestion).map(project))
      === JSON.stringify(fallbackRegistry.routes.filter(isFamilySuggestion).map(project)),
  );

  console.log(
    'skill-routing-expansion erp-vtp-skill-family: ' + pass + ' pass, ' + fail + ' fail',
  );
  for (const failure of failures) console.error('  FAIL: ' + failure);
  return fail === 0 ? 0 : 1;
}

function main() {
  const requestedCase = argument('--case');
  if (!['availability-guard', 'erp-vtp-skill-family'].includes(requestedCase)) {
    console.error(
      'Usage: node assert-skill-routing-expansion.cjs '
        + '--case <availability-guard|erp-vtp-skill-family>',
    );
    process.exit(2);
  }
  try {
    process.exit(requestedCase === 'availability-guard'
      ? availabilityGuardCase()
      : erpVtpSkillFamilyCase());
  } catch (error) {
    console.error(
      'skill-routing-expansion ' + requestedCase + ': unexpected error -- ' + error.message,
    );
    process.exit(1);
  }
}

if (require.main === module) main();
