'use strict';

const path = require('path');

const yamlLibPath = path.resolve(__dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml');
const yaml = require(yamlLibPath);

const REQUIRED_FIELDS = Object.freeze([
  'position',
  'confidence',
  'risks_raised',
  'evidence_cited',
  'falsifier',
  'implementation_concerns',
  'known_deadends',
  'intuition',
  'why_principled',
  'rationale',
]);

const LIST_FIELDS = ['risks_raised', 'evidence_cited', 'implementation_concerns', 'known_deadends'];
const POSITION_VALUES = ['SUPPORT', 'OPPOSE', 'ABSTAIN'];

function validate(yamlBody) {
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

  if (Object.prototype.hasOwnProperty.call(parsed, 'position') && !POSITION_VALUES.includes(parsed.position)) {
    errors.push(`position: invalid value '${parsed.position}'`);
  }

  if (Object.prototype.hasOwnProperty.call(parsed, 'confidence')) {
    const validConfidence = Number.isInteger(parsed.confidence) && parsed.confidence >= 1 && parsed.confidence <= 5;
    if (!validConfidence) errors.push('confidence: must be integer 1-5');
  }

  for (const field of LIST_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(parsed, field) && !Array.isArray(parsed[field])) {
      errors.push(`${field}: must be an array`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed,
  };
}

module.exports = { validate, REQUIRED_FIELDS };
