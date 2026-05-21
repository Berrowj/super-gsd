#!/usr/bin/env node
'use strict';

const COLORS = {
  sage: 'var(--sage, var(--clarity-sage, #9bb89c))',
  terracotta: 'var(--terracotta, var(--clarity-terracotta, #c98265))',
  amber: 'var(--amber, var(--clarity-amber, #d9a441))',
  slate: 'var(--slate, var(--clarity-slate, #59616b))',
  ink: 'var(--ink, var(--clarity-ink, #1f2933))',
  paper: 'var(--paper, var(--clarity-paper, #fbfaf7))',
  line: 'var(--line, var(--clarity-line, #d8d3c8))',
  muted: 'var(--muted, var(--clarity-muted, #6b7280))'
};

const BAND_CLASSES = ['sage', 'terracotta', 'amber', 'slate'];

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cleanLabel(value, fallback = 'MISSING_EVIDENCE') {
  const text = String(value ?? '').trim();
  return text.length ? text.slice(0, 80) : fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeLabels(items, fallbackLabels) {
  const labels = asArray(items)
    .map((item) => {
      if (typeof item === 'string') return cleanLabel(item);
      return cleanLabel(item?.label || item?.name || item?.id || item?.path || item?.title);
    })
    .filter(Boolean);
  return labels.length ? labels : fallbackLabels;
}

function linesFor(label, maxChars = 26, maxLines = 2) {
  const words = cleanLabel(label).split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines.slice(0, maxLines);
}

function textBlock(label, x, y, width, options = {}) {
  const size = options.size || 12;
  const lineHeight = options.lineHeight || 15;
  const anchor = options.anchor || 'middle';
  const maxChars = Math.max(8, Math.floor(width / (size * 0.58)));
  const lines = linesFor(label, maxChars, options.maxLines || 2);
  return lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
      return `<text x="${x}" y="${y + dy}" text-anchor="${anchor}" class="label" font-size="${size}">${escapeXml(line)}</text>`;
    })
    .join('');
}

function baseSvg(width, height, title, body) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(title)}" viewBox="0 0 ${width} ${height}">`,
    '<style>',
    `:root{--sage:#9bb89c;--terracotta:#c98265;--amber:#d9a441;--slate:#59616b;--ink:#1f2933;--paper:#fbfaf7;--line:#d8d3c8;--muted:#6b7280;--clarity-sage:#9bb89c;--clarity-terracotta:#c98265;--clarity-amber:#d9a441;--clarity-slate:#59616b;--clarity-ink:#1f2933;--clarity-paper:#fbfaf7;--clarity-line:#d8d3c8;--clarity-muted:#6b7280}`,
    `.bg{fill:${COLORS.paper}}.panel{fill:#fffdf8;stroke:${COLORS.line};stroke-width:1.2}.sage{fill:${COLORS.sage}}.terracotta{fill:${COLORS.terracotta}}.amber{fill:${COLORS.amber}}.slate{fill:${COLORS.slate}}`,
    `.band{opacity:.28}.box{stroke:${COLORS.ink};stroke-opacity:.34;stroke-width:1}.label{fill:${COLORS.ink};font-family:Inter,Arial,sans-serif;font-weight:650}.small{fill:${COLORS.muted};font-family:Inter,Arial,sans-serif}.arrow{stroke:${COLORS.slate};stroke-width:2;fill:none;marker-end:url(#arrow)}.fallback{fill:${COLORS.muted};font-family:Inter,Arial,sans-serif;font-size:11px;letter-spacing:0}`,
    '</style>',
    '<defs><marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#59616b"/></marker></defs>',
    `<rect class="bg" x="0" y="0" width="${width}" height="${height}" rx="0"/>`,
    `<text class="fallback" x="${width - 16}" y="${height - 14}" text-anchor="end">fallback SVG</text>`,
    body,
    '</svg>'
  ].join('');
}

function architecture(dataSpec = {}) {
  const labels = normalizeLabels(dataSpec.architectureNodes || dataSpec.files, [
    'CHRONICLE-CONTEXT.json',
    'Template sections',
    'PUML diagrams',
    'Renderer',
    'Fallback SVG',
    'Self-test'
  ]);
  const width = 900;
  const height = 500;
  const cols = 3;
  const cardW = 230;
  const cardH = 76;
  const gapX = 45;
  const gapY = 44;
  const startX = 70;
  const startY = 92;
  const bands = BAND_CLASSES.map((cls, index) => {
    const bandH = height / 4;
    return `<rect class="${cls} band" x="0" y="${index * bandH}" width="${width}" height="${bandH}"/>`;
  }).join('');
  const boxes = labels.slice(0, 9).map((label, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    const cls = BAND_CLASSES[index % BAND_CLASSES.length];
    return [
      `<rect class="panel box" x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="8"/>`,
      `<rect class="${cls}" x="${x}" y="${y}" width="8" height="${cardH}" rx="4"/>`,
      textBlock(label, x + cardW / 2 + 4, y + 34, cardW - 32, { maxLines: 2 })
    ].join('');
  }).join('');
  const title = `<text x="40" y="44" class="label" font-size="20">Architecture</text><text x="40" y="66" class="small" font-size="12">Template inputs, renderer code, and emitted chronicle artifact</text>`;
  return baseSvg(width, height, 'architecture fallback diagram', bands + title + boxes);
}

function lineageDag(dataSpec = {}) {
  const nodes = normalizeLabels(dataSpec.lineageNodes, [
    'Observations',
    'Claims',
    'Evidence verdicts',
    'Promotion decisions',
    'Chronicle HTML'
  ]);
  const width = 900;
  const height = 390;
  const step = (width - 140) / Math.max(1, nodes.length - 1);
  const y = 195;
  const arrows = nodes.slice(0, -1).map((_, index) => {
    const x1 = 70 + index * step + 74;
    const x2 = 70 + (index + 1) * step - 74;
    return `<path class="arrow" d="M${x1},${y} C${x1 + 40},${y - 38} ${x2 - 40},${y - 38} ${x2},${y}"/>`;
  }).join('');
  const boxes = nodes.map((label, index) => {
    const x = 70 + index * step - 64;
    const cls = BAND_CLASSES[index % BAND_CLASSES.length];
    return [
      `<rect class="panel box" x="${x}" y="${y - 44}" width="128" height="88" rx="10"/>`,
      `<circle class="${cls}" cx="${x + 18}" cy="${y - 26}" r="7"/>`,
      textBlock(label, x + 64, y - 2, 106, { size: 11, maxLines: 3 })
    ].join('');
  }).join('');
  const title = `<text x="40" y="44" class="label" font-size="20">Lineage DAG</text><text x="40" y="66" class="small" font-size="12">Deterministic fallback topology from context signifiers</text>`;
  return baseSvg(width, height, 'lineage DAG fallback diagram', title + arrows + boxes);
}

function gateWaterfall(dataSpec = {}) {
  const gates = normalizeLabels(dataSpec.gates, ['Schema', 'Evidence', 'Self-contained', 'Golden parity', 'Ready']);
  const width = 620;
  const height = 520;
  const x = 150;
  const y0 = 86;
  const rowH = 58;
  const gap = 18;
  const rows = gates.slice(0, 7).map((gate, index) => {
    const y = y0 + index * (rowH + gap);
    const cls = BAND_CLASSES[index % BAND_CLASSES.length];
    const w = 300 + index * 18;
    return [
      `<rect class="${cls} box" x="${x}" y="${y}" width="${w}" height="${rowH}" rx="8" opacity=".78"/>`,
      `<text x="${x - 20}" y="${y + 36}" class="label" font-size="13" text-anchor="end">${index + 1}</text>`,
      textBlock(gate, x + w / 2, y + 35, w - 24, { size: 12, maxLines: 1 })
    ].join('');
  }).join('');
  const connectors = gates.slice(0, Math.min(6, gates.length - 1)).map((_, index) => {
    const y = y0 + index * (rowH + gap) + rowH;
    return `<path class="arrow" d="M${x + 150},${y + 3} L${x + 150},${y + gap - 3}"/>`;
  }).join('');
  const title = `<text x="40" y="44" class="label" font-size="20">Gate Waterfall</text><text x="40" y="66" class="small" font-size="12">Gate stages synthesized without PlantUML</text>`;
  return baseSvg(width, height, 'gate waterfall fallback diagram', title + connectors + rows);
}

function fileImpact(dataSpec = {}) {
  const partitions = dataSpec.fileImpact || {};
  const entries = Object.keys(partitions).sort().map((key) => ({
    key,
    labels: normalizeLabels(partitions[key], [`${key}: MISSING_EVIDENCE`])
  }));
  const fallback = [
    { key: 'source', labels: ['Renderer code'] },
    { key: 'test', labels: ['Self-test coverage'] },
    { key: 'fixture', labels: ['Golden fixture'] }
  ];
  const groups = entries.length ? entries : fallback;
  const width = 900;
  const height = 480;
  const colW = Math.floor((width - 100) / Math.min(4, groups.length));
  const groupsSvg = groups.slice(0, 4).map((group, index) => {
    const x = 50 + index * colW;
    const cls = BAND_CLASSES[index % BAND_CLASSES.length];
    const itemLines = group.labels.slice(0, 5).map((label, itemIndex) => {
      const y = 128 + itemIndex * 48;
      return [
        `<rect class="panel" x="${x + 14}" y="${y}" width="${colW - 32}" height="36" rx="6"/>`,
        textBlock(label, x + colW / 2, y + 23, colW - 54, { size: 10, maxLines: 1 })
      ].join('');
    }).join('');
    return [
      `<rect class="${cls} band" x="${x}" y="84" width="${colW - 16}" height="330" rx="10"/>`,
      `<text x="${x + 14}" y="111" class="label" font-size="14">${escapeXml(group.key)}</text>`,
      itemLines
    ].join('');
  }).join('');
  const title = `<text x="40" y="44" class="label" font-size="20">File Impact</text><text x="40" y="66" class="small" font-size="12">Changed assets partitioned by category</text>`;
  return baseSvg(width, height, 'file impact fallback diagram', title + groupsSvg);
}

function personaLanes(dataSpec = {}) {
  const personas = normalizeLabels(dataSpec.personas, ['Operator', 'Reviewer', 'Future maintainer', 'Autonomous agent']);
  const width = 900;
  const height = 470;
  const laneH = 76;
  const y0 = 86;
  const lanes = personas.slice(0, 5).map((persona, index) => {
    const y = y0 + index * laneH;
    const cls = BAND_CLASSES[index % BAND_CLASSES.length];
    return [
      `<rect class="panel" x="50" y="${y}" width="800" height="${laneH - 14}" rx="8"/>`,
      `<rect class="${cls}" x="50" y="${y}" width="145" height="${laneH - 14}" rx="8" opacity=".74"/>`,
      textBlock(persona, 122, y + 38, 118, { size: 12, maxLines: 2 }),
      `<path class="arrow" d="M220,${y + 31} L785,${y + 31}"/>`,
      `<circle class="${cls}" cx="470" cy="${y + 31}" r="11"/>`,
      `<text class="small" x="505" y="${y + 35}" font-size="12">impact captured in chronicle synthesis</text>`
    ].join('');
  }).join('');
  const title = `<text x="40" y="44" class="label" font-size="20">Persona Lanes</text><text x="40" y="66" class="small" font-size="12">Swimlanes for stakeholder impact</text>`;
  return baseSvg(width, height, 'persona lanes fallback diagram', title + lanes);
}

function timeline(dataSpec = {}) {
  const stages = normalizeLabels(dataSpec.timelineStages, ['Context', 'Evidence', 'Render', 'Verify', 'Ship']);
  const width = 900;
  const height = 360;
  const x0 = 70;
  const y = 170;
  const step = (width - 140) / Math.max(1, stages.length);
  const line = `<path class="arrow" d="M${x0},${y + 55} L${width - 70},${y + 55}"/>`;
  const cards = stages.slice(0, 7).map((stage, index) => {
    const x = x0 + index * step;
    const cls = BAND_CLASSES[index % BAND_CLASSES.length];
    return [
      `<rect class="${cls} box" x="${x}" y="${y - 46}" width="${Math.max(86, step - 18)}" height="76" rx="8" opacity=".82"/>`,
      textBlock(stage, x + Math.max(86, step - 18) / 2, y - 9, Math.max(72, step - 34), { size: 11, maxLines: 2 }),
      `<circle class="${cls}" cx="${x + Math.max(86, step - 18) / 2}" cy="${y + 55}" r="8"/>`
    ].join('');
  }).join('');
  const title = `<text x="40" y="44" class="label" font-size="20">Timeline</text><text x="40" y="66" class="small" font-size="12">Left-to-right rendering stages</text>`;
  return baseSvg(width, height, 'timeline fallback diagram', title + line + cards);
}

function generate(diagramName, dataSpec = {}) {
  const normalized = String(diagramName || '').replace(/\.puml$/i, '').toLowerCase();
  const generators = {
    architecture,
    'lineage-dag': lineageDag,
    'gate-waterfall': gateWaterfall,
    'file-impact': fileImpact,
    'persona-lanes': personaLanes,
    timeline
  };
  const generator = generators[normalized];
  if (!generator) {
    throw new Error(`Unknown fallback diagram: ${diagramName}`);
  }
  return generator(dataSpec);
}

module.exports = { generate };

if (require.main === module) {
  const name = process.argv[2] || 'architecture';
  process.stdout.write(generate(name, {}));
}
