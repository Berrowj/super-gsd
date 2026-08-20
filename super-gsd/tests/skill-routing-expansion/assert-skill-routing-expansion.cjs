#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const CLASSIFIER = path.join(ROOT, 'super-gsd', 'hooks', 'sgsd-intent-classifier.cjs');
const REGISTRY = path.join(ROOT, 'super-gsd', 'scripts', 'lib', 'skill-routing-registry.cjs');
const DESCRIPTION_LINT = path.join(
  ROOT, 'super-gsd', 'tools', 'skill-description-lint', 'lint.cjs',
);
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
const T4_CONFIG_SENTINELS = Object.freeze([
  'sentinel-p159-non-runnable-command',
  'sentinel-p159-config-arg',
  'sentinel-p159-config-value',
]);
const T4_ROUTE_MATRIX = Object.freeze([
  Object.freeze({
    routeId: 'vtp-search-substrate-shadow',
    surface: 'vtp_search_substrate',
    action: 'would_route_vtp_search_substrate',
    prompt: 'Search this paper content for the cited evidence',
    tier: 'shadow',
  }),
  Object.freeze({
    routeId: 'vtp-wiki-search-shadow',
    surface: 'wiki_search',
    action: 'would_route_wiki_search',
    prompt: 'Search the wiki for this project analysis',
    tier: 'shadow',
  }),
  Object.freeze({
    routeId: 'vtp-route-and-retrieve-shadow',
    surface: 'vtp_route_and_retrieve',
    action: 'would_route_vtp_route_and_retrieve',
    prompt: 'Route and retrieve this end-to-end knowledge intent',
    tier: 'shadow',
  }),
  Object.freeze({
    routeId: 'vtp-implementation-pack-meeting-export',
    surface: '/vtp-implementation-pack',
    action: '/vtp-implementation-pack',
    prompt: 'Export this meeting transcript to an implementation pack',
    tier: 'suggestion',
  }),
  Object.freeze({
    routeId: 'vtp-triage-advisory-shadow',
    surface: 'vtp_triage',
    action: 'would_route_vtp_triage_advisory',
    prompt: 'Assess the triage verdict for this retrieval decision',
    tier: 'shadow',
  }),
]);

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

function runClassifier(value, payload, args, classifierPath, options) {
  const env = { ...process.env, HOME: value.home, USERPROFILE: value.home };
  const guard = options && options.denyLiveness
    ? path.join(value.base, 'deny-hook-liveness.cjs') : null;
  if (guard) writeFile(guard, 'const M=require(`module`),o=M._load,b=new Set([`net`,`http`,`https`,`dns`,`child_process`]);M._load=function(r,...a){const n=String(r).replace(/^node:/,``);if(b.has(n))throw Error(`forbidden:`+n);return o.call(this,r,...a)};global.fetch=()=>{throw Error(`forbidden:fetch`)};');
  if (guard) env.NODE_OPTIONS = [env.NODE_OPTIONS, '--require=' + guard]
    .filter(Boolean).join(' ');
  const child = spawnSync(process.execPath, [classifierPath || CLASSIFIER, ...(args || [])], {
    cwd: value.project,
    env,
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
  const demandFile = path.join(
    value.project, '.planning', 'metrics', 'triage-advisory', 'demand-baseline.jsonl',
  );
  const denominatorFile = path.join(
    value.project, '.planning', 'metrics', 'triage-advisory', 'denominator.json',
  );
  return {
    status: child.status,
    stdout: child.stdout || '',
    evidence: readJsonl(evidenceFile),
    evidenceText: fs.existsSync(evidenceFile) ? fs.readFileSync(evidenceFile, 'utf8') : '',
    shadow: readJsonl(shadowFile),
    shadowText: fs.existsSync(shadowFile) ? fs.readFileSync(shadowFile, 'utf8') : '',
    demand: readJsonl(demandFile),
    demandText: fs.existsSync(demandFile) ? fs.readFileSync(demandFile, 'utf8') : '',
    denominator: fs.existsSync(denominatorFile)
      ? JSON.parse(fs.readFileSync(denominatorFile, 'utf8')) : null,
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
    path.join('scripts', 'lib', 'demand-baseline-ledger.cjs'),
    path.join('scripts', 'sgsd-distill-milestone.sh'),
    path.join('scripts', 'sgsd-muda-audit.sh'),
    path.join('overwatcher', 'overwatcher-launcher.js'),
    path.join('tools', 'token-waste', 'check.cjs'),
    path.join('tools', 'vtp-readiness', 'run.cjs'),
    path.join('tools', 'vtp-readiness', 'registry.cjs'),
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
    for (const name of [
      'gates.yaml', 'skill-routing.yaml', 'session-governance-hooks.yaml', 'vtp-services.yaml',
    ]) {
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
    fs.copyFileSync(
      path.join(ROOT, 'super-gsd', 'registry', 'vtp-services.yaml'),
      path.join(registryDir, 'vtp-services.yaml'),
    );
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

function t4ShadowRows(result) {
  const ids = new Set(T4_ROUTE_MATRIX.filter((row) => row.tier === 'shadow')
    .map((row) => row.routeId));
  return result.shadow.filter((row) => (
    Array.isArray(row.matched_signature_ids)
      && row.matched_signature_ids.some((id) => ids.has(id))
  ));
}

function t4DecisionRows(result, routeId) {
  return result.evidence.filter((row) => (
    row.signal === 'intent_routing_decision'
      && Array.isArray(row.route_ids) && row.route_ids.includes(routeId)
  ));
}

function writeMcpFixture(value, kind) {
  if (kind === 'missing') return;
  if (kind === 'malformed') {
    writeFile(path.join(value.project, '.mcp.json'), '{');
    return;
  }
  const { loadRegistry } = require(path.join(
    ROOT, 'super-gsd', 'tools', 'vtp-readiness', 'registry.cjs',
  ));
  const canonical = loadRegistry().servers.canonical;
  const serverName = kind === 'registered' ? canonical : 'sentinel-p159-other-server';
  writeFile(path.join(value.project, '.mcp.json'), JSON.stringify({
    mcpServers: {
      [serverName]: {
        command: T4_CONFIG_SENTINELS[0],
        args: [T4_CONFIG_SENTINELS[1]],
        env: { SENTINEL_P159_CONFIG: T4_CONFIG_SENTINELS[2] },
      },
    },
  }));
}

function vtpFixtureRun(route, configKind, includeRows, payloadOverride) {
  return withFixture((value) => {
    const classifierPath = copyClassifierInstance(value, includeRows);
    writeMcpFixture(value, configKind);
    const payload = payloadOverride || humanPayload(route.prompt);
    return runClassifier(value, payload, [], classifierPath, { denyLiveness: true });
  });
}

function t4ForbiddenEvidence(result) {
  const forbiddenKeys = new Set([
    'prompt', 'text', 'query', 'note', 'entity', 'entities', 'path', 'error',
    'command_value', 'args', 'url', 'host', 'task_id', 'tool_use_id', 'session_id',
  ]);
  return hasForbiddenKey(result.evidence, forbiddenKeys)
    || hasForbiddenKey(result.shadow, forbiddenKeys)
    || hasForbiddenKey(result.demand, forbiddenKeys)
    || T4_CONFIG_SENTINELS.some((sentinel) => (
      result.evidenceText.includes(sentinel)
        || result.shadowText.includes(sentinel) || result.demandText.includes(sentinel)
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

function vtpToolFamilyRegisteredCase() {
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

  for (const route of T4_ROUTE_MATRIX) {
    const result = vtpFixtureRun(route, 'registered', true);
    const shadows = t4ShadowRows(result);
    const decisions = t4DecisionRows(result, route.routeId);
    const lineage = route.tier === 'shadow' ? shadows[0] : decisions[0];
    check(route.routeId + ' registered broken command exits zero under no-liveness guard',
      result.status === 0, 'status=' + result.status);
    check(route.routeId + ' maps to the recorded tier and surface',
      route.tier === 'shadow'
        ? result.stdout === '' && shadows.length === 1
          && shadows[0].surface_id === route.surface
          && shadows[0].soft_path_action === route.action
        : JSON.stringify(emittedSuggestions(result))
            === JSON.stringify(['/vtp-implementation-pack'])
          && decisions.length === 1 && decisions[0].surface_id === route.surface,
      JSON.stringify({ stdout: result.stdout, shadows, decisions }));
    check(route.routeId + ' records one text-free demand row with shared lineage',
      Boolean(lineage) && result.demand.length === 1
        && result.demand[0].decision_id === lineage.decision_id
        && result.demand[0].artefact_kind === route.surface
        && result.demand[0].adequate === false
        && result.demand[0].reason === 'no_enrichment_attempted'
        && result.demand[0].vtp_call_count === 0
        && !Object.hasOwn(result.demand[0], 'query')
        && !Object.hasOwn(result.demand[0], 'note'),
      JSON.stringify({ lineage, demand: result.demand }));
    check(route.routeId + ' evidence never discloses prompt or config sentinels',
      !t4ForbiddenEvidence(result),
      result.evidenceText + result.shadowText + result.demandText);
    const red = vtpFixtureRun(route, 'registered', false);
    check(route.routeId + ' internal rows-absent red has no T4 fire or demand',
      t4ShadowRows(red).length === 0
        && t4DecisionRows(red, route.routeId).length === 0
        && red.demand.length === 0
        && !emittedSuggestions(red).includes('/vtp-implementation-pack'),
      JSON.stringify(red));
  }

  withFixture((value) => {
    const classifierPath = copyClassifierInstance(value, true);
    writeMcpFixture(value, 'registered');
    const route = T4_ROUTE_MATRIX[0];
    const first = runClassifier(
      value, humanPayload(route.prompt), [], classifierPath, { denyLiveness: true },
    );
    const replay = runClassifier(
      value, humanPayload(route.prompt), [], classifierPath, { denyLiveness: true },
    );
    check('replay keeps one demand row and one denominator unit',
      first.demand.length === 1 && replay.demand.length === 1
        && replay.denominator && replay.denominator.denominator === 1,
      JSON.stringify({ first: first.demand, replay: replay.demand }));
  });

  console.log('skill-routing-expansion vtp-tool-family-registered: '
    + pass + ' pass, ' + fail + ' fail');
  for (const failure of failures) console.error('  FAIL: ' + failure);
  return fail === 0 ? 0 : 1;
}

function vtpToolFamilyUnavailableOriginGateCase() {
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

  for (const route of T4_ROUTE_MATRIX) {
    const result = vtpFixtureRun(route, 'missing', true);
    const unavailable = result.evidence.filter((row) => (
      row.decision === 'mcp_server_unregistered'
    ));
    check(route.routeId + ' unavailable is silent with one fixed row only',
      result.status === 0 && result.stdout === ''
        && result.shadow.length === 0 && result.demand.length === 0
        && result.evidence.length === 1 && unavailable.length === 1
        && unavailable[0].route_id === route.routeId
        && unavailable[0].surface_id === route.surface
        && unavailable[0].reason_codes[0] === 'mcp_server_unregistered',
      JSON.stringify(result));
    check(route.routeId + ' unavailable evidence leaks no prompt/config text',
      !t4ForbiddenEvidence(result), result.evidenceText);
    const red = vtpFixtureRun(route, 'missing', false);
    check(route.routeId + ' unavailable rows-absent red has no T4 row',
      !red.evidence.some((row) => row.decision === 'mcp_server_unregistered')
        && red.demand.length === 0 && t4ShadowRows(red).length === 0,
      JSON.stringify(red));
  }

  for (const configKind of ['malformed', 'canonical-name-absent']) {
    const route = T4_ROUTE_MATRIX[0];
    const result = vtpFixtureRun(route, configKind, true);
    check(configKind + ' config is the same silent unregistered decision',
      result.stdout === '' && result.shadow.length === 0 && result.demand.length === 0
        && result.evidence.length === 1
        && result.evidence[0].decision === 'mcp_server_unregistered'
        && result.evidence[0].route_id === route.routeId
        && !t4ForbiddenEvidence(result),
      JSON.stringify(result));
  }

  const envelope = [
    '<task-notification>',
    '  <summary>' + T4_ROUTE_MATRIX.map((route) => route.prompt).join(' | ')
      + ' | Create a SAP quote artifact | reconcile the SAP vendor record</summary>',
    '</task-notification>',
  ].join('\n');
  const quotedRoute = T4_ROUTE_MATRIX[0];
  const quoted = vtpFixtureRun(
    quotedRoute,
    'registered',
    true,
    humanPayload(quotedRoute.prompt + '\nQuoted payload:\n' + envelope),
  );
  const quotedDecisions = quoted.evidence.filter((row) => (
    row.signal === 'intent_routing_decision'
  ));
  check('human-quoted task notification remains routable',
    t4ShadowRows(quoted).length === 1 && quoted.demand.length === 1
      && quotedDecisions.length === 1 && quotedDecisions[0].decision === 'matched'
      && !quoted.evidence.some((row) => row.decision === 'automated_turn_skip'),
    JSON.stringify(quoted));
  const automated = vtpFixtureRun(T4_ROUTE_MATRIX[0], 'registered', true, {
    hook_event_name: 'UserPromptSubmit',
    origin: { kind: 'task-notification' },
    promptSource: 'system',
    mode: 'manual',
    prompt: envelope,
  });
  const skipRows = automated.evidence.filter((row) => row.decision === 'automated_turn_skip');
  check('automated T2/T4 envelope stops before route, MCP, shadow, or demand work',
    automated.status === 0 && automated.stdout === ''
      && automated.evidence.length === 1 && skipRows.length === 1
      && skipRows[0].route_evaluation_count === 0
      && skipRows[0].shadow_evaluation_count === 0
      && automated.shadow.length === 0 && automated.demand.length === 0,
    JSON.stringify(automated));

  console.log('skill-routing-expansion vtp-tool-family-unavailable-origin-gate: '
    + pass + ' pass, ' + fail + ' fail');
  for (const failure of failures) console.error('  FAIL: ' + failure);
  return fail === 0 ? 0 : 1;
}

function descriptionLintCase() {
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
  const capture = () => {
    const chunks = [];
    return {
      stream: { write: (chunk) => chunks.push(String(chunk)) },
      text: () => chunks.join(''),
    };
  };

  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-p159-description-lint-'));
  const mixed = path.join(base, 'mixed');
  const clean = path.join(base, 'clean');
  try {
    writeFile(path.join(mixed, 'compliant', 'SKILL.md'), [
      '---',
      'name: compliant',
      'description: >-',
      '  Use when preparing a governed SAP quote from customer or schedule inputs.',
      '  Prefer the ERP resolver for record reconciliation; do not use this skill for',
      '  general product lookup. Build a dry-run first and require explicit operator',
      '  approval before any live write.',
      '---',
      '',
    ].join('\n'));
    writeFile(path.join(mixed, 'missing', 'SKILL.md'), [
      '---',
      'name: missing',
      '---',
      '',
    ].join('\n'));
    writeFile(path.join(mixed, 'one-noun', 'SKILL.md'), [
      '---',
      'name: one-noun',
      'description: Quotes.',
      '---',
      '',
    ].join('\n'));
    writeFile(path.join(mixed, 'duplicate', 'SKILL.md'), [
      '---',
      'name: duplicate',
      'description: first secret-description-sentinel',
      'description: second secret-description-sentinel',
      '---',
      '',
    ].join('\n'));
    writeFile(
      path.join(clean, 'compliant', 'SKILL.md'),
      fs.readFileSync(path.join(mixed, 'compliant', 'SKILL.md'), 'utf8'),
    );

    const lint = require(DESCRIPTION_LINT);
    const mixedOut = capture();
    const mixedErr = capture();
    const findingsExit = lint.run(
      ['--skills-dir', mixed, '--json'],
      { stdout: mixedOut.stream, stderr: mixedErr.stream },
    );
    const report = JSON.parse(mixedOut.text());
    check('fixture findings exit 1', findingsExit === 1, `exit=${findingsExit}`);
    check('fixture findings write no stderr', mixedErr.text() === '', mixedErr.text());
    check(
      'violations have stable relative paths and reason codes',
      JSON.stringify(report.findings) === JSON.stringify([
        { file: 'duplicate/SKILL.md', reason_code: 'frontmatter_malformed' },
        { file: 'missing/SKILL.md', reason_code: 'description_missing' },
        { file: 'one-noun/SKILL.md', reason_code: 'description_one_noun' },
      ]),
      JSON.stringify(report.findings),
    );
    check(
      'compliant fixture is not flagged',
      !report.findings.some((finding) => finding.file === 'compliant/SKILL.md'),
      JSON.stringify(report.findings),
    );
    check(
      'malformed frontmatter output does not echo description content',
      !mixedOut.text().includes('secret-description-sentinel'),
      mixedOut.text(),
    );

    const cleanOut = capture();
    const cleanErr = capture();
    const cleanExit = lint.run(
      ['--skills-dir', clean, '--json'],
      { stdout: cleanOut.stream, stderr: cleanErr.stream },
    );
    check('compliant-only fixture exits 0', cleanExit === 0, `exit=${cleanExit}`);
    check(
      'compliant-only fixture has no findings',
      JSON.parse(cleanOut.text()).findings.length === 0 && cleanErr.text() === '',
      cleanOut.text() + cleanErr.text(),
    );

    const errorOut = capture();
    const errorErr = capture();
    const errorExit = lint.run(
      ['--skills-dir', path.join(base, 'absent')],
      { stdout: errorOut.stream, stderr: errorErr.stream },
    );
    check('invalid skills directory exits 2', errorExit === 2, `exit=${errorExit}`);
    check(
      'invalid input reports only a stable reason code',
      errorOut.text() === '' && errorErr.text() === 'skill-description-lint: skills_dir_missing\n',
      errorOut.text() + errorErr.text(),
    );
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }

  console.log(
    'skill-routing-expansion description-lint: ' + pass + ' pass, ' + fail + ' fail',
  );
  for (const failure of failures) console.error('  FAIL: ' + failure);
  return fail === 0 ? 0 : 1;
}

function main() {
  const requestedCase = argument('--case');
  if (![
    'availability-guard',
    'erp-vtp-skill-family',
    'description-lint',
    'vtp-tool-family-registered',
    'vtp-tool-family-unavailable-origin-gate',
  ].includes(requestedCase)) {
    console.error(
      'Usage: node assert-skill-routing-expansion.cjs '
        + '--case <availability-guard|erp-vtp-skill-family|description-lint|'
        + 'vtp-tool-family-registered|vtp-tool-family-unavailable-origin-gate>',
    );
    process.exit(2);
  }
  try {
    if (requestedCase === 'availability-guard') process.exit(availabilityGuardCase());
    if (requestedCase === 'erp-vtp-skill-family') process.exit(erpVtpSkillFamilyCase());
    if (requestedCase === 'vtp-tool-family-registered') {
      process.exit(vtpToolFamilyRegisteredCase());
    }
    if (requestedCase === 'vtp-tool-family-unavailable-origin-gate') {
      process.exit(vtpToolFamilyUnavailableOriginGateCase());
    }
    process.exit(descriptionLintCase());
  } catch (error) {
    console.error(
      'skill-routing-expansion ' + requestedCase + ': unexpected error -- ' + error.message,
    );
    process.exit(1);
  }
}

if (require.main === module) main();
