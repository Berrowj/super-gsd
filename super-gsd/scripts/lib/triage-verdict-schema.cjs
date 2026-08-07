'use strict';

// ============================================================================
// triage-verdict-schema -- shared validation for contract triage-verdict-v1
// ============================================================================
// Bounds are intentionally small enough to prevent provider output from hiding
// payloads in strings, but large enough for a useful triage rationale:
//   - stdout envelope: 1 MiB
//   - each string field/item: 4096 chars
//   - each string array: 50 items
// ============================================================================

const fs = require('fs');

const CONTRACT = 'triage-verdict-v1';
const VALID_PATHS = Object.freeze(['A', 'B', 'C', 'D']);
const REQUIRED_FIELDS = Object.freeze([
  'path',
  'rationale',
  'risk_flags',
  'missed_context',
  'recommended_skills',
]);
const ARRAY_FIELDS = Object.freeze(['risk_flags', 'missed_context', 'recommended_skills']);
const MAX_STDOUT_CHARS = 1024 * 1024;
const MAX_STRING_CHARS = 4096;
const MAX_ARRAY_ITEMS = 50;
const EXECUTABLE_PAYLOAD_PATTERN = /(^|\n)\s*(?:#!|rm\s+-rf\b|del\s+\/[fqsa]\b|curl\b[^\n|]*\|\s*(?:sh|bash)\b|wget\b[^\n|]*\|\s*(?:sh|bash)\b|powershell\b|pwsh\b|cmd(?:\.exe)?\b|bash\s+-c\b|node\s+-e\b|python(?:3)?\s+-c\b|Invoke-Expression\b|Start-Process\b|Set-ExecutionPolicy\b|<script\b|javascript:)/i;

function invalid(errors) {
  return { valid: false, errors: errors.map((error) => String(error)), value: null };
}

function valid(value) {
  return { valid: true, errors: [], value };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isWhitespaceOrFenceNoise(text) {
  return text
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim().length === 0;
}

function surroundingTextHasExecutablePayload(text) {
  if (isWhitespaceOrFenceNoise(text)) return false;
  return EXECUTABLE_PAYLOAD_PATTERN.test(text);
}

function candidateFrom(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const ch = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
      if (depth < 0) {
        return null;
      }
    }
  }

  return null;
}

function extractJsonObjects(text) {
  const objects = [];
  const parseErrors = [];

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '{') continue;
    const candidate = candidateFrom(text, index);
    if (!candidate) continue;

    try {
      const value = JSON.parse(candidate);
      if (isPlainObject(value)) {
        objects.push({ start: index, end: index + candidate.length, text: candidate, value });
      }
    } catch (error) {
      parseErrors.push(error.message);
    }

    index += candidate.length - 1;
  }

  return { objects, parseErrors };
}

function validateEnvelope(text) {
  const errors = [];

  if (typeof text !== 'string') {
    return invalid(['input: must be a string or object']);
  }
  if (text.length > MAX_STDOUT_CHARS) {
    errors.push(`stdout: too long (max ${MAX_STDOUT_CHARS} chars)`);
  }

  const { objects, parseErrors } = extractJsonObjects(text);
  if (objects.length !== 1) {
    if (objects.length === 0 && parseErrors.length > 0) {
      errors.push(`JSON parse error: ${parseErrors[0]}`);
    } else {
      errors.push(`stdout: expected exactly one JSON object, found ${objects.length}`);
    }
    return invalid(errors);
  }

  const [object] = objects;
  const surroundingText = `${text.slice(0, object.start)}\n${text.slice(object.end)}`;
  if (surroundingTextHasExecutablePayload(surroundingText)) {
    errors.push('stdout: executable-looking payload outside JSON object');
  }

  const objectResult = validateObject(object.value);
  if (!objectResult.valid) errors.push(...objectResult.errors);
  if (errors.length > 0) return invalid(errors);
  return objectResult;
}

function validateString(field, value, options = {}) {
  const { required = true } = options;
  const errors = [];

  if (value === undefined) {
    if (required) errors.push(`${field}: missing`);
    return errors;
  }
  if (typeof value !== 'string') {
    errors.push(`${field}: must be a string`);
    return errors;
  }
  if (value.length > MAX_STRING_CHARS) {
    errors.push(`${field}: too long (max ${MAX_STRING_CHARS} chars)`);
  }
  if (value.includes('\u0000')) {
    errors.push(`${field}: must not contain NUL bytes`);
  }
  if (required && value.trim().length === 0) {
    errors.push(`${field}: must be a non-empty string`);
  }

  return errors;
}

function validateStringArray(field, value) {
  const errors = [];

  if (value === undefined) {
    errors.push(`${field}: missing`);
    return errors;
  }
  if (!Array.isArray(value)) {
    errors.push(`${field}: must be an array`);
    return errors;
  }
  if (value.length > MAX_ARRAY_ITEMS) {
    errors.push(`${field}: too many items (max ${MAX_ARRAY_ITEMS})`);
  }

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (typeof item !== 'string') {
      errors.push(`${field}[${index}]: must be a string`);
      continue;
    }
    if (item.length > MAX_STRING_CHARS) {
      errors.push(`${field}[${index}]: too long (max ${MAX_STRING_CHARS} chars)`);
    }
    if (item.includes('\u0000')) {
      errors.push(`${field}[${index}]: must not contain NUL bytes`);
    }
    if (item.trim().length === 0) {
      errors.push(`${field}[${index}]: must be a non-empty string`);
    }
  }

  return errors;
}

function canonicalize(value) {
  return {
    path: value.path,
    rationale: value.rationale.trim(),
    risk_flags: value.risk_flags.map((item) => item.trim()),
    missed_context: value.missed_context.map((item) => item.trim()),
    recommended_skills: value.recommended_skills.map((item) => item.trim()),
  };
}

function validateObject(value) {
  const errors = [];

  if (!isPlainObject(value)) {
    return invalid(['root: must be a JSON object']);
  }

  const allowed = new Set(REQUIRED_FIELDS);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`root: unknown field '${key}'`);
  }

  for (const field of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) errors.push(`${field}: missing`);
  }

  if (Object.prototype.hasOwnProperty.call(value, 'path')) {
    if (typeof value.path !== 'string') {
      errors.push('path: must be a string');
    } else if (!VALID_PATHS.includes(value.path)) {
      errors.push(`path: invalid value '${value.path}' (expected A, B, C, or D)`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(value, 'rationale')) {
    errors.push(...validateString('rationale', value.rationale));
  }

  for (const field of ARRAY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(value, field)) {
      errors.push(...validateStringArray(field, value[field]));
    }
  }

  if (errors.length > 0) return invalid(errors);
  return valid(canonicalize(value));
}

function validate(input) {
  try {
    if (typeof input === 'string') return validateEnvelope(input);
    return validateObject(input);
  } catch (error) {
    return invalid([`validator internal error: ${error.message}`]);
  }
}

function main() {
  let body = '';
  try {
    body = fs.readFileSync(0, 'utf8');
  } catch (error) {
    process.stderr.write(`input: could not read stdin: ${error.message}\n`);
    process.exitCode = 6;
    return;
  }

  const result = validate(body);
  if (result.valid) {
    process.stdout.write(`${JSON.stringify(result.value)}\n`);
    process.exitCode = 0;
    return;
  }

  process.stderr.write(`${result.errors.join('; ')}\n`);
  process.exitCode = 6;
}

if (require.main === module) main();

module.exports = {
  CONTRACT,
  VALID_PATHS,
  REQUIRED_FIELDS,
  ARRAY_FIELDS,
  MAX_STDOUT_CHARS,
  MAX_STRING_CHARS,
  MAX_ARRAY_ITEMS,
  validate,
  validateObject,
};
