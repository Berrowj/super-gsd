'use strict';

// ============================================================================
// rd-memo-schema — validation for R&D Board seat memos (contract rd-memo-v1)
// ============================================================================
// Sibling to deliberation-schema.cjs. Same validate()/retry-once contract so
// the /rd-board skill can treat Anthropic (Agent) and OpenAI (codex-exec)
// seats identically after parse.
//
// Implements R&D Board Treaty v0.3 — super-gsd/docs/RD-BOARD-TREATY.md:
//   §13.2      required memo fields incl. predeclared prediction
//   §4.5 r16   prediction is falsifiable and scored against outcome
//   §6.1       bibliography exclusion — citations-of-citations are not evidence
//   §10        superlative bar — unearned novelty language returned unread
//   §13.5.1    blind ballot — memos must not name other seats or show tallies
// ============================================================================

const path = require('path');

const yamlLibPath = path.resolve(__dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml');
const yaml = require(yamlLibPath);

const REQUIRED_FIELDS = Object.freeze([
  'verdict',
  'confidence',
  'observations_cited',
  'inferences',
  'strongest_uncertainty',
  'reversing_evidence',
  'case_against_self',
  'prediction',
  'rationale',
]);

const LIST_FIELDS = Object.freeze([
  'observations_cited',
  'inferences',
  'reversing_evidence',
]);

// Treaty §13.6
const VERDICT_VALUES = Object.freeze([
  'ADVANCE',
  'ADVANCE_WITH_CONDITIONS',
  'NO_SLOT',
  'RESEARCH_ONLY',
  'PARK_UNTIL_TRIGGER',
  'REJECT_EVIDENCE',
  'REJECT_FIT',
  'REJECT_COMPLEXITY',
  'REJECT_RISK',
  'ROLL_BACK',
  'ADOPT',
  'RETIRE',
]);

// Treaty §8 — Cartographer additionally carries a placement mode.
const PLACEMENT_MODES = Object.freeze([
  'DELETE', 'REPLACE', 'AUGMENT', 'COMPOSE', 'OBSERVE',
  'NEW_PRIMITIVE', 'RESEARCH_ONLY', 'NO_SLOT', 'REJECT',
]);

// Treaty §10 — superlative bar. Memos using these are returned unread.
const SUPERLATIVE_PATTERN =
  /\b(first[- ]ever|seminal|breakthrough|state[- ]of[- ]the[- ]art|revolutionary|paradigm[- ]shift(?:ing)?|unprecedented|game[- ]chang(?:er|ing))\b/i;

// Treaty §13.5.1 — no seat may reference another seat or a running tally.
const SEAT_NAME_PATTERN =
  /\b(cartographer|experimentalist|contrarian|moonshot|rd-board-[a-z]+)\b/i;
const TALLY_PATTERN =
  /\b(\d\s*(?:of|out of|-)\s*\d\s*(?:seats?|members?|votes?|agree)|majority|unanimous|consensus so far|other (?:seats?|members?) (?:said|think|argue))\b/i;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function scanText(parsed) {
  // Walk every string value so violations can't hide in nested lists.
  const out = [];
  const walk = (node) => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') Object.values(node).forEach(walk);
  };
  walk(parsed);
  return out;
}

/**
 * Validate one seat memo.
 *
 * @param {string} yamlBody     raw YAML emitted by the seat
 * @param {object} [opts]
 * @param {boolean} [opts.requirePlacementMode]  true for the Cartographer seat
 * @param {boolean} [opts.enforceBlindBallot]    default true (§13.5.1)
 * @returns {{valid: boolean, errors: string[], parsed?: object}}
 */
function validate(yamlBody, opts = {}) {
  const {
    requirePlacementMode = false,
    enforceBlindBallot = true,
  } = opts;

  let parsed;
  try {
    parsed = yaml.load(yamlBody);
  } catch (error) {
    return { valid: false, errors: [`YAML parse error: ${error.message}`] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, errors: ['root must be a map'] };
  }

  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(parsed, field)) {
      errors.push(`${field}: missing`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(parsed, 'verdict')
      && !VERDICT_VALUES.includes(parsed.verdict)) {
    errors.push(`verdict: invalid value '${parsed.verdict}' (see treaty §13.6)`);
  }

  if (Object.prototype.hasOwnProperty.call(parsed, 'confidence')) {
    const ok = Number.isInteger(parsed.confidence)
      && parsed.confidence >= 1 && parsed.confidence <= 5;
    if (!ok) errors.push('confidence: must be integer 1-5');
  }

  for (const field of LIST_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(parsed, field) && !Array.isArray(parsed[field])) {
      errors.push(`${field}: must be a list`);
    }
  }

  // §2 invariant 1 — an agent claim must never silently become an observation.
  // An ADVANCE-family verdict with zero cited observations is exactly that.
  if (Array.isArray(parsed.observations_cited)
      && parsed.observations_cited.length === 0
      && typeof parsed.verdict === 'string'
      && parsed.verdict.startsWith('ADVANCE')) {
    errors.push('observations_cited: empty — cannot ADVANCE on inference alone (§2 invariant 1)');
  }

  // §4.5 r16 — the prediction must be falsifiable, not a restatement.
  if (Object.prototype.hasOwnProperty.call(parsed, 'prediction')) {
    const p = parsed.prediction;
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      errors.push('prediction: must be a map with gate_outcome and basis');
    } else {
      if (!isNonEmptyString(p.gate_outcome)) {
        errors.push('prediction.gate_outcome: missing or empty');
      } else if (!VERDICT_VALUES.includes(p.gate_outcome)) {
        errors.push(`prediction.gate_outcome: invalid value '${p.gate_outcome}'`);
      }
      if (!isNonEmptyString(p.basis)) errors.push('prediction.basis: missing or empty');
    }
  }

  if (requirePlacementMode) {
    if (!Object.prototype.hasOwnProperty.call(parsed, 'placement_mode')) {
      errors.push('placement_mode: missing (required for the Cartographer seat)');
    } else if (!PLACEMENT_MODES.includes(parsed.placement_mode)) {
      errors.push(`placement_mode: invalid value '${parsed.placement_mode}' (see treaty §8)`);
    }
  }

  for (const field of ['strongest_uncertainty', 'case_against_self', 'rationale']) {
    if (Object.prototype.hasOwnProperty.call(parsed, field) && !isNonEmptyString(parsed[field])) {
      errors.push(`${field}: must be a non-empty string`);
    }
  }

  const texts = scanText(parsed);

  // §10 superlative bar.
  for (const text of texts) {
    const hit = text.match(SUPERLATIVE_PATTERN);
    if (hit) {
      errors.push(`superlative bar (§10): unearned novelty language '${hit[0]}' — rewrite without it`);
      break;
    }
  }

  // §13.5.1 blind ballot.
  if (enforceBlindBallot) {
    for (const text of texts) {
      const seatHit = text.match(SEAT_NAME_PATTERN);
      if (seatHit) {
        errors.push(`blind ballot (§13.5.1): memo references seat '${seatHit[0]}' — use FINDING-n instead`);
        break;
      }
    }
    for (const text of texts) {
      const tallyHit = text.match(TALLY_PATTERN);
      if (tallyHit) {
        errors.push(`blind ballot (§13.5.1): memo references a tally/majority ('${tallyHit[0]}')`);
        break;
      }
    }
  }

  if (errors.length) return { valid: false, errors };
  return { valid: true, errors: [], parsed };
}

/**
 * Semantic divergence across first-pass memos (§4.5 r13).
 *
 * Deliberately cheap and deterministic: mean pairwise Jaccard distance over
 * content-word sets, plus a verdict-spread term. This is a *floor detector*,
 * not a similarity metric — it exists to catch four memos that agree before
 * debate has happened. Calibrate the floor from the acceptance run (§21 #6);
 * do not guess a value into the registry.
 *
 * @param {object[]} memos parsed memos
 * @returns {{score: number, verdict_spread: number, pairs: number}}
 */
const STOPWORDS = new Set(
  ('the a an and or but if then than that this these those is are was were be been being of to in on ' +
   'for with as by at from it its into over under not no nor so such can could may might will would ' +
   'should must do does did done have has had we our they their there here when what which who whom')
    .split(' ')
);

function contentWords(memo) {
  const bag = new Set();
  for (const text of scanText(memo)) {
    for (const raw of text.toLowerCase().split(/[^a-z0-9_-]+/)) {
      if (raw.length > 2 && !STOPWORDS.has(raw)) bag.add(raw);
    }
  }
  return bag;
}

function jaccardDistance(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : 1 - intersection / union;
}

function divergence(memos) {
  if (!Array.isArray(memos) || memos.length < 2) {
    return { score: 0, verdict_spread: 0, pairs: 0 };
  }
  const bags = memos.map(contentWords);
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < bags.length; i += 1) {
    for (let j = i + 1; j < bags.length; j += 1) {
      total += jaccardDistance(bags[i], bags[j]);
      pairs += 1;
    }
  }
  const distinctVerdicts = new Set(memos.map((m) => m && m.verdict).filter(Boolean));
  return {
    score: pairs === 0 ? 0 : total / pairs,
    verdict_spread: distinctVerdicts.size,
    pairs,
  };
}

/**
 * §4.5 r13 gate. Returns void_round when first-pass memos converged early.
 * A null floor means "not yet calibrated" — never void on an uncalibrated floor.
 */
function checkDiversityFloor(memos, floor) {
  const result = divergence(memos);
  if (floor === null || floor === undefined) {
    return { ...result, floor, void_round: false, reason: 'floor not calibrated (§21 #6)' };
  }
  const belowFloor = result.score < floor;
  return {
    ...result,
    floor,
    void_round: belowFloor,
    reason: belowFloor
      ? `divergence ${result.score.toFixed(3)} below floor ${floor} — round void, re-run in isolated subgroups`
      : 'divergence above floor',
  };
}

module.exports = {
  validate,
  divergence,
  checkDiversityFloor,
  REQUIRED_FIELDS,
  VERDICT_VALUES,
  PLACEMENT_MODES,
};
