#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const SCHEMA_PATH = path.resolve(__dirname, '..', '..', 'schemas', 'cmb.schema.json');
const METRICS_PATH = path.resolve(ROOT_DIR, '.planning', 'metrics', 'mesh-validate.jsonl');

function usage() {
  return 'Usage: node cmb-validate.cjs [--help] <file.json> [<file.json> ...]';
}

function requireDependency(name) {
const candidates = [
  path.resolve(__dirname, '..', 'plan-schema', 'node_modules', name),
  path.resolve(__dirname, 'node_modules', name),
  name,
];

  const failures = [];
  for (const candidate of candidates) {
    try {
      const mod = require(candidate);
      return mod && mod.default ? mod.default : mod;
    } catch (error) {
      failures.push(`${candidate}: ${error.message}`);
    }
  }

  throw new Error(`Unable to load dependency "${name}". Tried: ${failures.join('; ')}`);
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function createAjv(schema) {
  const schemaUrl = typeof schema.$schema === 'string' ? schema.$schema : '';
  const ajvModule = schemaUrl.includes('2020-12') ? 'ajv/dist/2020' : 'ajv';
  const Ajv = requireDependency(ajvModule);
  const addFormats = requireDependency('ajv-formats');
  const addErrors = requireDependency('ajv-errors');

  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    verbose: true,
  });
  addFormats(ajv);
  addErrors(ajv);
  return ajv;
}

let cachedValidator;

function getValidator() {
  if (!cachedValidator) {
    const schema = readJsonFile(SCHEMA_PATH);
    cachedValidator = createAjv(schema).compile(schema);
  }
  return cachedValidator;
}

function flattenErrors(errors) {
  const flattened = [];

  function visit(error) {
    flattened.push(error);
    if (error && error.params && Array.isArray(error.params.errors)) {
      error.params.errors.forEach(visit);
    }
  }

  errors.forEach(visit);
  return flattened;
}

function schemaCodeFor(error) {
  const chunks = [
    error && error.message,
    error && error.schemaPath,
    error && error.instancePath,
    error && error.params ? JSON.stringify(error.params) : '',
  ].filter(Boolean);
  const text = chunks.join(' ');
  const direct = text.match(/SCHEMA-MML-\d+/);
  if (direct) {
    return direct[0];
  }

  const missing = error && error.params ? error.params.missingProperty : undefined;
  const instancePath = error && error.instancePath ? error.instancePath : '';
  const schemaPath = error && error.schemaPath ? error.schemaPath : '';

  if (missing === 'created_by' || instancePath.endsWith('/created_by') || schemaPath.includes('created_by')) {
    return 'SCHEMA-MML-02';
  }
  if (missing === 'cat7' || instancePath.endsWith('/cat7') || schemaPath.includes('cat7')) {
    return 'SCHEMA-MML-03';
  }
  return 'SCHEMA-MML-00';
}

function messageFor(error) {
  const where = error && error.instancePath ? error.instancePath : '/';
  const message = error && error.message ? error.message : `schema validation failed at ${where}`;
  return String(message)
    .replace(/\s*\(?SCHEMA-MML-\d+\)?\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatError(filePath, error) {
  const code = schemaCodeFor(error);
  const message = messageFor(error) || 'schema validation failed';
  return `[${filePath}] ${message} (${code})`;
}

function validateCmb(cmb) {
  const validate = getValidator();
  const valid = validate(cmb);
  return {
    valid,
    errors: valid ? [] : flattenErrors(validate.errors || []),
  };
}

function appendMetric(row) {
  fs.mkdirSync(path.dirname(METRICS_PATH), { recursive: true });
  fs.appendFileSync(METRICS_PATH, `${JSON.stringify(row)}\n`, 'utf8');
}

function validateFiles(files) {
  let filesInvalid = 0;
  let errorCount = 0;

  for (const filePath of files) {
    let parsed;
    try {
      parsed = readJsonFile(filePath);
    } catch (error) {
      filesInvalid += 1;
      errorCount += 1;
      console.error(formatError(filePath, {
        message: `invalid JSON: ${error.message}`,
        keyword: 'parse',
        instancePath: '/',
      }));
      continue;
    }

    const result = validateCmb(parsed);
    if (!result.valid) {
      filesInvalid += 1;
      errorCount += result.errors.length;
      result.errors.forEach((error) => console.error(formatError(filePath, error)));
    }
  }

  appendMetric({
    ts: new Date().toISOString(),
    files_checked: files.length,
    files_invalid: filesInvalid,
    errors: errorCount,
  });

  if (filesInvalid === 0) {
    console.error(`[cmb-validate] ${files.length} files VALID`);
    return 0;
  }
  return 1;
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help')) {
    console.error(usage());
    return 0;
  }

  if (argv.length === 0) {
    console.error(usage());
    return 2;
  }

  try {
    return validateFiles(argv);
  } catch (error) {
    console.error(`[cmb-validate] ERROR ${error.message}`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  ROOT_DIR,
  SCHEMA_PATH,
  METRICS_PATH,
  usage,
  getValidator,
  validateCmb,
  validateFiles,
  formatError,
};
