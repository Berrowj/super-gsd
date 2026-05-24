'use strict';

const fs = require('fs');
const path = require('path');

const KINDS = {
  project_md: 'project',
  intent_md: 'intent',
  last_summary_md: 'summary',
  context_md: 'context',
};

function placeholder(kind) {
  return `(no ${kind} found)`;
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

function readInput(filePath, kind) {
  if (!filePath) {
    return {
      kind,
      filePath: null,
      content: '',
      ok: false,
    };
  }

  try {
    return {
      kind,
      filePath,
      content: normalizeText(fs.readFileSync(filePath, 'utf8')),
      ok: true,
    };
  } catch (_error) {
    return {
      kind,
      filePath,
      content: '',
      ok: false,
    };
  }
}

function splitDocument(content) {
  const text = normalizeText(content);
  if (!text.startsWith('---\n')) {
    return {
      frontmatter: {},
      body: text,
    };
  }

  const endMarker = text.indexOf('\n---', 4);
  if (endMarker === -1) {
    return {
      frontmatter: {},
      body: text,
    };
  }

  const frontmatterText = text.slice(4, endMarker).trim();
  const bodyStart = text.indexOf('\n', endMarker + 4);
  const body = bodyStart === -1 ? '' : text.slice(bodyStart + 1).trim();

  return {
    frontmatter: parseFrontmatter(frontmatterText),
    body,
  };
}

function parseFrontmatter(frontmatterText) {
  const values = {};

  frontmatterText.split('\n').forEach((line) => {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      return;
    }

    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
    values[key] = value;
  });

  return values;
}

function getSection(body, heading) {
  const text = normalizeText(body);
  if (!text) {
    return '';
  }

  const headingLine = `## ${heading}`;
  const start = text.indexOf(headingLine);
  if (start === -1) {
    return '';
  }

  const afterHeadingLine = text.indexOf('\n', start + headingLine.length);
  const sectionStart = afterHeadingLine === -1 ? text.length : afterHeadingLine + 1;
  const nextHeading = text.indexOf('\n## ', sectionStart);
  const sectionEnd = nextHeading === -1 ? text.length : nextHeading;

  return text.slice(sectionStart, sectionEnd).trim();
}

function firstParagraph(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return '';
  }

  const lines = normalized.split('\n');
  const paragraph = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (paragraph.length > 0) {
        break;
      }
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      if (paragraph.length > 0) {
        break;
      }
      continue;
    }

    paragraph.push(trimmed);
  }

  return paragraph.join(' ').trim();
}

function firstBodyParagraph(document) {
  return firstParagraph(document.body);
}

function resolvedRelative(filePath) {
  try {
    const absolute = path.resolve(filePath);
    return path.relative(process.cwd(), absolute) || path.basename(absolute);
  } catch (_error) {
    return filePath;
  }
}

function buildEvidenceTrail(inputs) {
  const cited = inputs
    .filter((input) => input.ok && input.filePath)
    .map((input) => resolvedRelative(input.filePath));

  if (cited.length > 0) {
    return cited.join(', ');
  }

  return `(no evidence files found; expected readable input such as .planning/STATE.md)`;
}

function computeRationale(args) {
  const options = args || {};
  const inputs = {
    project: readInput(options.project_md, KINDS.project_md),
    intent: readInput(options.intent_md, KINDS.intent_md),
    summary: readInput(options.last_summary_md, KINDS.last_summary_md),
    context: readInput(options.context_md, KINDS.context_md),
  };

  const intentDoc = splitDocument(inputs.intent.content);
  const summaryDoc = splitDocument(inputs.summary.content);
  const contextDoc = splitDocument(inputs.context.content);

  const summaryParagraph = inputs.summary.ok
    ? firstParagraph(getSection(summaryDoc.body, 'Summary'))
    : '';
  const goalParagraph = inputs.context.ok
    ? firstParagraph(getSection(contextDoc.body, 'Goal'))
    : '';
  const contextParagraph = inputs.context.ok ? firstBodyParagraph(contextDoc) : '';
  const intentWhy = inputs.intent.ok ? intentDoc.frontmatter.why : '';
  const intentOutcome = inputs.intent.ok ? intentDoc.frontmatter.outcome_delivered : '';
  const phaseName = inputs.context.ok ? contextDoc.frontmatter.phase_name : '';

  return {
    context:
      summaryParagraph ||
      goalParagraph ||
      contextParagraph ||
      placeholder(inputs.summary.ok ? inputs.context.kind : inputs.summary.kind),
    eli5: intentWhy || contextParagraph || placeholder(inputs.intent.ok ? inputs.context.kind : inputs.intent.kind),
    what_is: intentWhy ? `Now: ${intentWhy}` : placeholder(inputs.intent.kind),
    what_could_be: intentOutcome ? `Then: ${intentOutcome}` : placeholder(inputs.intent.kind),
    why_this_phase: goalParagraph || phaseName || placeholder(inputs.context.kind),
    evidence_trail: buildEvidenceTrail([
      inputs.project,
      inputs.intent,
      inputs.summary,
      inputs.context,
    ]),
  };
}

module.exports = {
  computeRationale,
};
