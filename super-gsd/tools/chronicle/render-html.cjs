#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SHARED_CSS_PATH = path.join(ROOT, 'super-gsd', 'tools', 'shared', 'sgsd-design-system.css');
const CHRONICLE_CSS_PATH = path.join(__dirname, 'templates', 'style.css');

const SECTION_ORDER = [
  'decision',
  'why',
  'changed',
  'evidence',
  'decisions',
  'disclosure',
  'diagrams',
  'risks',
  'next',
  'fog',
  'appendix'
];

const SECTION_TITLES = {
  decision: 'Operator Decision',
  why: 'Why This Matters',
  changed: 'What Changed',
  evidence: 'Evidence',
  decisions: 'Key Decisions',
  disclosure: 'Agent Autonomy Disclosure',
  diagrams: 'Diagrams',
  risks: 'Risks And Rollback',
  next: 'Next Action',
  fog: 'Fog And Learning',
  appendix: 'Appendix'
};

const SECTION_ROLES = {
  decision: 'operator-decision',
  why: 'why-scqa',
  changed: 'eli5',
  evidence: 'evidence',
  decisions: 'key-decisions',
  disclosure: 'agent-autonomy-disclosure',
  diagrams: 'diagrams',
  risks: 'risks-rollback',
  next: 'next-action',
  fog: 'fog-learning',
  appendix: 'appendix'
};

const METRIC_KEYS = [
  ['confidence', 'Confidence'],
  ['evidence', 'Evidence'],
  ['reversibility', 'Reversibility'],
  ['operator_load', 'Operator Load'],
  ['blast_radius', 'Blast Radius']
];

const DENOMINATOR_KEYS = [
  ['agent_actions', 'Agent Actions'],
  ['operator_actions', 'Operator Actions'],
  ['gate_checks', 'Gate Checks'],
  ['external_dependencies', 'External Dependencies'],
  ['unknowns', 'Unknowns']
];

function readFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sanitizeCss(css) {
  return String(css)
    .replace(/@import\s+[^;]+;/gi, '')
    .replace(/@font-face\s*{[\s\S]*?}/gi, '')
    .replace(/url\(\s*["']?https?:\/\/[^)]*\)/gi, 'none')
    .replace(/https?:\/\/[^\s"'<>)]*/gi, '');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function hasValue(value) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

function missing(slot) {
  return `<span class="missing-evidence" data-slot="${escapeAttr(slot)}">MISSING_EVIDENCE</span>`;
}

function slot(value, slotName) {
  if (!hasValue(value)) {
    return missing(slotName);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return escapeHtml(value);
  }
  if (Array.isArray(value)) {
    return escapeHtml(value.join(', '));
  }
  if (typeof value === 'object') {
    return escapeHtml(stableJson(value));
  }
  return escapeHtml(value);
}

function getPath(object, keyPath) {
  if (!object || !keyPath) {
    return undefined;
  }
  return String(keyPath).split('.').reduce((current, key) => {
    if (current === null || current === undefined) {
      return undefined;
    }
    return current[key];
  }, object);
}

function pick(context, paths, fallback) {
  for (const keyPath of paths) {
    const value = getPath(context, keyPath);
    if (hasValue(value)) {
      return value;
    }
  }
  return fallback;
}

function sectionData(context, id) {
  const direct = pick(context, [
    `sections.${id}`,
    `section_slots.${id}`,
    `chronicle.sections.${id}`,
    id
  ], {});
  if (direct && typeof direct === 'object' && !Array.isArray(direct) && direct.data) {
    return direct.data;
  }
  const fromArray = Array.isArray(context.sections)
    ? context.sections.find((section) => section && (section.id === id || section.signifier_role === SECTION_ROLES[id]))
    : null;
  return fromArray || (direct && typeof direct === 'object' ? direct : {});
}

function sectionSignal(context, id) {
  const arraySection = Array.isArray(context.sections)
    ? context.sections.find((section) => section && (section.id === id || section.signifier_role === SECTION_ROLES[id]))
    : null;
  const value = pick(context, [
    `sections.${id}.signal`,
    `section_slots.${id}.signal`,
    `chronicle.sections.${id}.signal`,
    `signals.${id}`,
    `section_signals.${id}`,
    `${id}.signal`
  ], arraySection && arraySection.signal ? arraySection.signal : 'high');
  return String(value || 'high').toLowerCase();
}

function toArray(value) {
  if (!hasValue(value)) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}

function titleize(value) {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function clampPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  if (parsed <= 1 && parsed >= 0) {
    return Math.round(parsed * 100);
  }
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function sanitizeInlineSvg(svg, title, takeaway) {
  if (!hasValue(svg) || !String(svg).includes('<svg')) {
    return fallbackSvg(title, takeaway);
  }
  return String(svg)
    .replace(/\r\n/g, '\n')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\sxmlns(?::[a-z]+)?\s*=\s*"https?:\/\/[^"]*"/gi, '')
    .replace(/\sxmlns(?::[a-z]+)?\s*=\s*'https?:\/\/[^']*'/gi, '')
    .replace(/\s(?:href|src|xlink:href)\s*=\s*"https?:\/\/[^"]*"/gi, '')
    .replace(/\s(?:href|src|xlink:href)\s*=\s*'https?:\/\/[^']*'/gi, '')
    .replace(/https?:\/\/[^\s"'<>)]*/gi, '');
}

function fallbackSvg(title, takeaway) {
  const safeTitle = escapeHtml(hasValue(title) ? title : 'Diagram');
  const safeTakeaway = escapeHtml(hasValue(takeaway) ? takeaway : 'Evidence structure remains available without PlantUML.');
  return [
    '<svg class="diagram-svg fallback" viewBox="0 0 720 280" role="img" aria-label="Diagram fallback">',
    '<rect width="720" height="280" rx="18" fill="currentColor" opacity="0.06"/>',
    '<rect x="44" y="48" width="632" height="184" rx="14" fill="none" stroke="currentColor" opacity="0.34"/>',
    `<text x="72" y="112" font-size="26" font-family="system-ui, sans-serif" fill="currentColor">${safeTitle}</text>`,
    `<text x="72" y="158" font-size="18" font-family="system-ui, sans-serif" fill="currentColor">${safeTakeaway}</text>`,
    '<path d="M72 196 H648" stroke="currentColor" opacity="0.26" stroke-width="3"/>',
    '</svg>'
  ].join('');
}

function renderList(items, slotName) {
  const list = toArray(items);
  if (list.length === 0) {
    return `<p>${missing(slotName)}</p>`;
  }
  return `<ul>${list.map((item, index) => `<li>${renderInlineValue(item, `${slotName}.${index}`)}</li>`).join('')}</ul>`;
}

function renderInlineValue(value, slotName) {
  if (!hasValue(value)) {
    return missing(slotName);
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const label = pick(value, ['title', 'label', 'name', 'summary', 'claim', 'decision', 'risk', 'action'], '');
    if (hasValue(label)) {
      return slot(label, slotName);
    }
  }
  return slot(value, slotName);
}

function renderHero(context) {
  const title = pick(context, ['title', 'chronicle.title', 'meta.title', 'project.name'], 'SGSD Chronicle');
  const subtitle = pick(context, ['subtitle', 'summary', 'meta.summary', 'big_idea', 'operator_decision.big_idea'], '');
  const milestone = pick(context, ['milestone', 'meta.milestone', 'active_milestone'], '');
  const phase = pick(context, ['phase', 'meta.phase', 'active_phase'], '');
  const plan = pick(context, ['plan', 'meta.plan', 'active_plan'], '');
  return [
    '<header class="chronicle-hero" role="banner">',
    '<div class="hero-copy">',
    '<p class="eyebrow">SGSD Chronicle</p>',
    `<h1>${slot(title, 'title')}</h1>`,
    `<p class="hero-lede">${slot(subtitle, 'subtitle')}</p>`,
    '<dl class="hero-meta">',
    `<div><dt>Milestone</dt><dd>${slot(milestone, 'meta.milestone')}</dd></div>`,
    `<div><dt>Phase</dt><dd>${slot(phase, 'meta.phase')}</dd></div>`,
    `<div><dt>Plan</dt><dd>${slot(plan, 'meta.plan')}</dd></div>`,
    '</dl>',
    '</div>',
    '</header>'
  ].join('\n');
}

function renderNav() {
  const links = SECTION_ORDER.map((id) => `<a href="#${id}">${escapeHtml(SECTION_TITLES[id])}</a>`).join('\n');
  return [
    '<nav class="chronicle-nav" aria-label="Chronicle sections">',
    '<a class="brand" href="#decision">Chronicle</a>',
    '<div class="nav-links">',
    links,
    '</div>',
    '</nav>'
  ].join('\n');
}

function renderSection(context, id, body) {
  const signal = sectionSignal(context, id);
  const sectionBody = signal === 'low'
    ? `<details class="signal-low"><summary>Low signal: expand section evidence</summary>\n${body}\n</details>`
    : body;
  return [
    `<section id="${id}" role="${SECTION_ROLES[id]}" data-signal="${escapeAttr(signal)}">`,
    `<p class="section-kicker"><span class="ix">${String(SECTION_ORDER.indexOf(id) + 1).padStart(2, '0')}</span> ${escapeHtml(SECTION_ROLES[id])}</p>`,
    `<h2>${escapeHtml(SECTION_TITLES[id])}</h2>`,
    sectionBody,
    '</section>'
  ].join('\n');
}

function normalizeMetrics(context, decision) {
  const source = pick({ context, decision }, [
    'decision.metrics',
    'context.metrics',
    'context.operator_metrics',
    'context.chronicle.metrics'
  ], {});
  if (Array.isArray(source)) {
    return source.slice(0, 5).map((item, index) => {
      if (typeof item === 'object') {
        return {
          label: pick(item, ['label', 'name', 'metric'], METRIC_KEYS[index][1]),
          value: pick(item, ['value', 'score', 'status'], '')
        };
      }
      return { label: METRIC_KEYS[index][1], value: item };
    });
  }
  const metrics = METRIC_KEYS.map(([key, label]) => ({
    label,
    value: source && typeof source === 'object' ? source[key] : undefined
  }));
  return metrics;
}

function renderDecision(context) {
  const decision = Object.assign({}, sectionData(context, 'decision'), pick(context, ['operator_decision', 'decision'], {}));
  const verdict = pick({ context, decision }, ['decision.verdict', 'context.verdict'], '');
  const bigIdea = pick({ context, decision }, ['decision.big_idea', 'context.big_idea', 'context.summary'], '');
  const primaryAction = pick({ context, decision }, [
    'context.next.primary_action',
    'context.next_action.primary_action',
    'decision.primary_action',
    'decision.next.primary_action'
  ], '');
  const metrics = normalizeMetrics(context, decision);
  const metricStrip = metrics.map((metric, index) => [
    `<div class="metric" data-instance="operator-decision metric ${index + 1}">`,
    `<dt>${slot(metric.label, `metrics.${index}.label`)}</dt>`,
    `<dd>${slot(metric.value, `metrics.${index}.value`)}</dd>`,
    '<small class="telling-instance">Telling instance: operator decision panel.</small>',
    '</div>'
  ].join('')).join('\n');
  return [
    '<div class="decision">',
    '<div class="decision-top">',
    '<div class="verdict-cell">',
    `<div class="verdict-badge">${slot(verdict, 'operator_decision.verdict')}</div>`,
    `<p class="big-idea">${slot(bigIdea, 'operator_decision.big_idea')}</p>`,
    '</div>',
    '<div class="next-cell">',
    '<span class="label">Do this next</span>',
    `<div class="recommended-action primary-action" data-role="recommended-action"><span>Primary action</span><strong>${slot(primaryAction, 'next.primary_action')}</strong></div>`,
    '</div>',
    '</div>',
    '<dl class="metric-strip">',
    metricStrip,
    '</dl>'
    ,'</div>'
  ].join('\n');
}

function renderWhy(context) {
  const why = Object.assign({}, sectionData(context, 'why'), pick(context, ['why', 'why_section', 'scqa'], {}));
  const rows = [
    ['Situation', pick(why, ['situation', 's'], '')],
    ['Complication', pick(why, ['complication', 'c'], '')],
    ['Question', pick(why, ['question', 'q'], '')]
  ];
  return [
    '<div class="scqa scqa-grid">',
    rows.map(([label, value]) => [
      '<article class="scqa-card">',
      `<h3>${escapeHtml(label)}</h3>`,
      `<p>${slot(value, `why.${label.toLowerCase()}`)}</p>`,
      '</article>'
    ].join('\n')).join('\n'),
    '</div>'
  ].join('\n');
}

function renderChanged(context) {
  const changed = Object.assign({}, sectionData(context, 'changed'), pick(context, ['eli5', 'changed', 'what_changed'], {}));
  const summary = pick(changed, ['summary', 'headline', 'explanation'], '');
  const bullets = pick(changed, ['bullets', 'changes', 'points'], []);
  const impact = pick(changed, ['impact', 'why_it_matters', 'so_what'], '');
  return [
    `<div class="eli5"><p class="plain-answer">${slot(summary, 'eli5.summary')}</p>`,
    renderList(bullets, 'eli5.bullets'),
    `<p class="so-what"><strong>So what:</strong> ${slot(impact, 'eli5.impact')}</p></div>`
  ].join('\n');
}

function renderEvidence(context) {
  const evidence = Object.assign({}, sectionData(context, 'evidence'), pick(context, ['evidence', 'evidence_pack'], {}));
  const observations = pick(evidence, ['observations', 'observer_notes'], []);
  const claims = toArray(pick(evidence, ['claims'], []));
  const verdicts = toArray(pick(evidence, ['evidence_verdicts', 'verdicts'], []));
  const decisions = pick(evidence, ['decisions', 'decision_evidence'], []);
  const renderedClaims = claims.length === 0
    ? `<p>${missing('evidence.claims')}</p>`
    : claims.map((claim, index) => {
      const summary = typeof claim === 'object' ? pick(claim, ['claim', 'summary', 'title'], '') : claim;
      const support = typeof claim === 'object' ? pick(claim, ['support', 'evidence', 'source'], '') : '';
      const counter = typeof claim === 'object' ? pick(claim, ['counter', 'counter_evidence', 'risk'], '') : '';
      const verdict = typeof claim === 'object' ? pick(claim, ['verdict', 'status'], '') : '';
      return [
        '<article class="claim">',
        `<h3>${slot(summary, `evidence.claims.${index}.claim`)}</h3>`,
        '<details class="evidence">',
        '<summary>Evidence details</summary>',
        `<p><strong>Support:</strong> ${slot(support, `evidence.claims.${index}.support`)}</p>`,
        `<p><strong>Counter:</strong> ${slot(counter, `evidence.claims.${index}.counter`)}</p>`,
        `<p><strong>Verdict:</strong> ${slot(verdict, `evidence.claims.${index}.verdict`)}</p>`,
        '</details>',
        '</article>'
      ].join('\n');
    }).join('\n');
  const renderedVerdicts = verdicts.length === 0
    ? `<p>${missing('evidence.evidence_verdicts')}</p>`
    : `<ul>${verdicts.map((item, index) => `<li>${renderInlineValue(item, `evidence.evidence_verdicts.${index}`)}</li>`).join('')}</ul>`;
  return [
    '<div class="evidence-grid">',
    '<article><h3>Observations</h3>',
    renderList(observations, 'evidence.observations'),
    '</article>',
    '<article><h3>Claims</h3>',
    renderedClaims,
    '</article>',
    '<article><h3>Evidence Verdicts</h3>',
    renderedVerdicts,
    '</article>',
    '<article><h3>Decisions</h3>',
    renderList(decisions, 'evidence.decisions'),
    '</article>',
    '</div>'
  ].join('\n');
}

function renderDecisions(context) {
  const section = sectionData(context, 'decisions');
  const decisions = toArray(pick({ context, section }, [
    'section.items',
    'section.decisions',
    'context.key_decisions',
    'context.decisions',
    'context.evidence.decisions'
  ], []));
  if (decisions.length === 0) {
    return `<p>${missing('decisions.items')}</p>`;
  }
  const rows = decisions.map((item, index) => {
    const decision = typeof item === 'object' ? pick(item, ['decision', 'title', 'summary'], '') : item;
    const owner = typeof item === 'object' ? pick(item, ['owner', 'operator', 'by'], '') : '';
    const status = typeof item === 'object' ? pick(item, ['status', 'state', 'verdict'], '') : '';
    const evidence = typeof item === 'object' ? pick(item, ['evidence', 'source', 'why'], '') : '';
    return [
      '<tr>',
      `<td>${slot(decision, `decisions.${index}.decision`)}</td>`,
      `<td>${slot(owner, `decisions.${index}.owner`)}</td>`,
      `<td>${slot(status, `decisions.${index}.status`)}</td>`,
      `<td>${slot(evidence, `decisions.${index}.evidence`)}</td>`,
      '</tr>'
    ].join('');
  }).join('\n');
  return [
    '<div class="table-wrap">',
    '<table>',
    '<thead><tr><th>Decision</th><th>Owner</th><th>Status</th><th>Evidence</th></tr></thead>',
    `<tbody>${rows}</tbody>`,
    '</table>',
    '</div>'
  ].join('\n');
}

function normalizeDenominatorGroups(context) {
  const disclosure = pick(context, ['disclosure', 'agent_autonomy_disclosure'], {});
  const panel = pick({ context, disclosure }, [
    'disclosure.denominator',
    'disclosure.denominators',
    'disclosure.denominator_panel',
    'context.denominator',
    'context.denominators'
  ], {});
  if (Array.isArray(panel)) {
    return panel.slice(0, 5).map((group, index) => ({
      label: typeof group === 'object' ? pick(group, ['label', 'title', 'name'], DENOMINATOR_KEYS[index][1]) : DENOMINATOR_KEYS[index][1],
      items: typeof group === 'object' ? pick(group, ['items', 'values', 'entries'], []) : group
    }));
  }
  const keys = panel && typeof panel === 'object' ? Object.keys(panel) : [];
  const groups = keys.slice(0, 5).map((key) => ({
    label: titleize(key),
    items: panel[key]
  }));
  while (groups.length < 5) {
    const [key, label] = DENOMINATOR_KEYS[groups.length];
    groups.push({ label, items: panel && typeof panel === 'object' ? panel[key] : [] });
  }
  return groups;
}

function renderDisclosure(context) {
  const disclosure = Object.assign({}, sectionData(context, 'disclosure'), pick(context, ['disclosure', 'agent_autonomy_disclosure'], {}));
  const summary = pick(disclosure, ['summary', 'agent_autonomy', 'autonomy', 'disclosure'], '');
  const groups = normalizeDenominatorGroups(context);
  return [
    `<p class="plain-answer">${slot(summary, 'disclosure.agent_autonomy')}</p>`,
    '<div class="denominator-panel">',
    groups.map((group, index) => [
      '<article class="denominator-group">',
      `<h3>${slot(group.label, `disclosure.denominator.${index}.label`)}</h3>`,
      renderList(group.items, `disclosure.denominator.${index}.items`),
      '</article>'
    ].join('\n')).join('\n'),
    '</div>'
  ].join('\n');
}

function renderDiagrams(context) {
  const section = sectionData(context, 'diagrams');
  const diagrams = toArray(pick({ context, section }, [
    'section.items',
    'section.diagrams',
    'context.diagrams',
    'context.diagram_set'
  ], []));
  if (diagrams.length === 0) {
    return `<p>${missing('diagrams.items')}</p>`;
  }
  return diagrams.map((diagram, index) => {
    const title = typeof diagram === 'object' ? pick(diagram, ['title', 'name'], '') : `Diagram ${index + 1}`;
    const takeaway = typeof diagram === 'object' ? pick(diagram, ['takeaway', 'so_what', 'caption'], '') : '';
    const svg = typeof diagram === 'object' ? pick(diagram, ['svg', 'inline_svg', 'rendered_svg'], '') : '';
    const puml = typeof diagram === 'object' ? pick(diagram, ['puml', 'plantuml', 'source', 'puml_source'], '') : '';
    return [
      '<figure class="diagram">',
      `<h3>${slot(title, `diagrams.${index}.title`)}</h3>`,
      '<div class="svgwrap">',
      sanitizeInlineSvg(svg, title, takeaway),
      '</div>',
      `<figcaption>${slot(takeaway, `diagrams.${index}.takeaway`)}</figcaption>`,
      '<details class="puml-source">',
      '<summary>PUML source</summary>',
      `<pre><code>${slot(puml, `diagrams.${index}.puml`)}</code></pre>`,
      '</details>',
      '</figure>'
    ].join('\n');
  }).join('\n');
}

function renderRisks(context) {
  const section = sectionData(context, 'risks');
  const risks = toArray(pick({ context, section }, ['section.items', 'section.risks', 'context.risks', 'context.rollback.risks'], []));
  if (risks.length === 0) {
    return `<p>${missing('risks.items')}</p>`;
  }
  const rows = risks.map((risk, index) => {
    const name = typeof risk === 'object' ? pick(risk, ['risk', 'name', 'summary'], '') : risk;
    const trigger = typeof risk === 'object' ? pick(risk, ['trigger', 'condition', 'watch'], '') : '';
    const rollback = typeof risk === 'object' ? pick(risk, ['rollback', 'mitigation', 'fallback'], '') : '';
    const owner = typeof risk === 'object' ? pick(risk, ['owner', 'operator'], '') : '';
    return [
      '<tr>',
      `<td>${slot(name, `risks.${index}.risk`)}</td>`,
      `<td>${slot(trigger, `risks.${index}.trigger`)}</td>`,
      `<td>${slot(rollback, `risks.${index}.rollback`)}</td>`,
      `<td>${slot(owner, `risks.${index}.owner`)}</td>`,
      '</tr>'
    ].join('');
  }).join('\n');
  return [
    '<div class="table-wrap">',
    '<table>',
    '<thead><tr><th>Risk</th><th>Trigger</th><th>Rollback</th><th>Owner</th></tr></thead>',
    `<tbody>${rows}</tbody>`,
    '</table>',
    '</div>'
  ].join('\n');
}

function renderNext(context) {
  const next = Object.assign({}, sectionData(context, 'next'), pick(context, ['next', 'next_action'], {}));
  const primary = pick(next, ['primary_action', 'primary', 'action'], '');
  const owner = pick(next, ['owner', 'operator'], '');
  const alternatives = pick(next, ['alternatives', 'fallbacks', 'secondary_actions'], []);
  return [
    '<div class="callout good">',
    '<span>Recommended path</span>',
    `<strong>${slot(primary, 'next.primary_action')}</strong>`,
    `<small>${slot(owner, 'next.owner')}</small>`,
    '</div>',
    '<details class="alternatives">',
    '<summary>Alternatives</summary>',
    renderList(alternatives, 'next.alternatives'),
    '</details>'
  ].join('\n');
}

function renderFog(context) {
  const fog = Object.assign({}, sectionData(context, 'fog'), pick(context, ['fog', 'fog_gauge'], {}));
  const score = pick(fog, ['score', 'percentage', 'value'], '');
  const level = pick(fog, ['level', 'label', 'status'], '');
  const dominantSignal = pick(fog, ['dominant_signal', 'signal', 'dominant'], '');
  const learning = pick(fog, ['cross_milestone_learning', 'learning', 'lesson'], '');
  const percent = clampPercent(score);
  return [
    `<div class="fog-gauge" data-score="${escapeAttr(hasValue(score) ? score : '')}" data-level="${escapeAttr(hasValue(level) ? level : '')}">`,
    `<span style="width:${percent}%"></span>`,
    '</div>',
    `<p class="fog-label">${slot(level, 'fog.level')} (${slot(score, 'fog.score')})</p>`,
    `<p class="dominant-signal">${slot(dominantSignal, 'fog.dominant_signal')}</p>`,
    `<p class="cross-milestone"><strong>Cross-milestone learning:</strong> ${slot(learning, 'fog.cross_milestone_learning')}</p>`
  ].join('\n');
}

function renderAppendix(context) {
  const appendix = Object.assign({}, sectionData(context, 'appendix'), pick(context, ['appendix'], {}));
  const raw = pick({ context, appendix }, [
    'appendix.raw_evidence',
    'appendix.raw',
    'context.raw_evidence',
    'context.evidence.raw',
    'context.evidence.raw_evidence'
  ], []);
  return [
    '<details class="raw-evidence">',
    '<summary>Raw evidence</summary>',
    renderList(raw, 'appendix.raw_evidence'),
    '</details>'
  ].join('\n');
}

function renderChronicleHtml(context) {
  const sharedCss = sanitizeCss(readFileIfPresent(SHARED_CSS_PATH));
  const chronicleCss = sanitizeCss(readFileIfPresent(CHRONICLE_CSS_PATH));
  const sections = {
    decision: renderDecision(context),
    why: renderWhy(context),
    changed: renderChanged(context),
    evidence: renderEvidence(context),
    decisions: renderDecisions(context),
    disclosure: renderDisclosure(context),
    diagrams: renderDiagrams(context),
    risks: renderRisks(context),
    next: renderNext(context),
    fog: renderFog(context),
    appendix: renderAppendix(context)
  };
  const renderedSections = SECTION_ORDER.map((id) => renderSection(context, id, sections[id])).join('\n\n');
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${slot(pick(context, ['title', 'chronicle.title', 'meta.title'], 'SGSD Chronicle'), 'title')}</title>`,
    '<style>',
    sharedCss.trim(),
    chronicleCss.trim(),
    '</style>',
    '</head>',
    '<body class="chronicle">',
    renderNav(),
    renderHero(context),
    '<main class="chronicle-main">',
    renderedSections,
    '</main>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

function renderFile(inputPath, outputPath) {
  const context = readJson(inputPath);
  const html = renderChronicleHtml(context);
  if (outputPath) {
    fs.writeFileSync(outputPath, html, 'utf8');
  } else {
    process.stdout.write(html);
  }
  return html;
}

function main(argv) {
  const [, , inputPath, outputPath] = argv;
  if (!inputPath) {
    process.stderr.write('Usage: node render-html.cjs <CHRONICLE-CONTEXT.json> [output.html]\n');
    process.exitCode = 1;
    return;
  }
  renderFile(path.resolve(inputPath), outputPath ? path.resolve(outputPath) : undefined);
}

if (require.main === module) {
  main(process.argv);
}

module.exports = {
  SECTION_ORDER,
  SECTION_ROLES,
  renderChronicleHtml,
  renderFile
};
