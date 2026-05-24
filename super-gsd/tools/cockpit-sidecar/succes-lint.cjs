'use strict';

const ARTEFACT_RE = /\b[\w./\\-]+\.(md|cjs|js|json|ts|py|sh|html|css)\b/i;
const COMMIT_SHA_RE = /\b[0-9a-f]{7,}\b/;
const PHASE_RE = /\bP\d{2,3}\b/;
const PHASE_WORD_RE = /\bphase \d+\b/i;

function lintWhy(text) {
  const value = typeof text === 'string' ? text : '';
  const violations = [];

  if (!ARTEFACT_RE.test(value) && !COMMIT_SHA_RE.test(value)) {
    violations.push('missing concrete artefact reference');
  }

  if (!PHASE_RE.test(value) && !PHASE_WORD_RE.test(value)) {
    violations.push('missing phase reference');
  }

  const count = value.split(/\s+/).filter(Boolean).length;
  if (count > 60) {
    violations.push(`over 60 words (${count})`);
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

module.exports = {
  lintWhy,
};
