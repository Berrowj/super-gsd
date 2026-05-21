'use strict';

const SIGNAL_WEIGHTS = Object.freeze({
  dispatch_count: 3,
  token_spend: 0.0001,
  files_changed: 0.5,
  review_loops: 5,
  disputed_claims_count: 10,
  stale_findings_count: 3,
  plan_revisions: 8,
  unresolved_risks_count: 6,
  minutes_since_operator_decision: 0.2,
  dependency_depth: 4
});

const LOW_MAX = 30;
const MEDIUM_MAX = 60;

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundContribution(value) {
  return Math.round(value * 10000) / 10000;
}

function tierForScore(score) {
  if (score <= LOW_MAX) {
    return 'low';
  }

  if (score <= MEDIUM_MAX) {
    return 'medium';
  }

  return 'high';
}

function addSection(sections, section) {
  if (!sections.includes(section)) {
    sections.push(section);
  }
}

function mustReadSections(tier, normalized) {
  const sections = [];

  if (tier === 'medium') {
    addSection(sections, 'summary');
    addSection(sections, 'decisions');
  }

  if (tier === 'high') {
    addSection(sections, 'summary');
    addSection(sections, 'decisions');
    addSection(sections, 'risks');
  }

  if (tier === 'high' || normalized.dispatch_count >= 8 || normalized.token_spend >= 100000) {
    addSection(sections, 'architecture');
    addSection(sections, 'file_impact');
  }

  if (normalized.disputed_claims_count > 0) {
    addSection(sections, 'claims');
    addSection(sections, 'evidence_verdicts');
  }

  if (normalized.plan_revisions > 0) {
    addSection(sections, 'decisions');
    addSection(sections, 'denominators');
  }

  return sections;
}

function computeFogScore(signals = {}) {
  const normalized = {};
  const breakdown = {};
  let rawScore = 0;

  for (const [signal, weight] of Object.entries(SIGNAL_WEIGHTS)) {
    const value = toNumber(signals[signal]);
    const contribution = value * weight;

    normalized[signal] = value;
    breakdown[signal] = roundContribution(contribution);
    rawScore += contribution;
  }

  const score = roundContribution(clamp(rawScore, 0, 100));
  const tier = tierForScore(score);

  return {
    score,
    tier,
    must_read_sections: mustReadSections(tier, normalized),
    breakdown
  };
}

module.exports = {
  computeFogScore,
  SIGNAL_WEIGHTS
};
