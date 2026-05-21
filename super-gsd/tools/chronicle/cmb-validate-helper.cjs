#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const TOOL_DIR = __dirname;
const SUPER_GSD_ROOT = path.resolve(TOOL_DIR, '..', '..');
const SCHEMA_DIR = path.join(SUPER_GSD_ROOT, 'schemas');

const SCHEMA_ALIASES = {
  chronicle: 'chronicle.schema.json',
  'chronicle-context': 'chronicle.schema.json',
  manifest: 'chronicle-manifest.schema.json',
  cmb: 'cmb.schema.json',
};

function requireDependency(name) {
  const candidates = [
    path.resolve(TOOL_DIR, '..', 'plan-schema', 'node_modules', name),
    path.resolve(TOOL_DIR, 'node_modules', name),
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

function usage() {
  return [
    'Usage: node super-gsd/tools/chronicle/cmb-validate-helper.cjs --schema <name> --fixture <path>',
    'Schema names: chronicle, chronicle-context, manifest, cmb',
  ].join('\n');
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--schema' || token === '--fixture') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) return null;
      args[token.slice(2)] = value;
      index += 1;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else {
      return null;
    }
  }
  return args;
}

function loadJson(filePath, missingCode, parseCode, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      error.exitCode = missingCode;
      error.message = `${label} file not found: ${filePath}`;
    }
    throw error;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    error.exitCode = parseCode;
    error.message = `${label} JSON parse failure: ${filePath}: ${error.message}`;
    throw error;
  }
}

function addLocalSchemas(ajv) {
  if (!fs.existsSync(SCHEMA_DIR)) return;
  for (const entry of fs.readdirSync(SCHEMA_DIR).sort()) {
    if (!entry.endsWith('.schema.json')) continue;
    const schemaPath = path.join(SCHEMA_DIR, entry);
    const schema = loadJson(schemaPath, 5, 5, 'schema');
    try {
      ajv.addSchema(schema, entry);
    } catch (error) {
      if (!String(error.message || '').includes('already exists')) throw error;
    }
  }
}

function createAjv() {
  const Ajv = requireDependency('ajv');
  const addErrors = requireDependency('ajv-errors');
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    verbose: true,
    validateFormats: false,
  });
  addErrors(ajv);
  addLocalSchemas(ajv);
  return ajv;
}

function flattenErrors(errors) {
  const flattened = [];
  function visit(error) {
    flattened.push(error);
    if (error && error.params && Array.isArray(error.params.errors)) {
      error.params.errors.forEach(visit);
    }
  }
  (errors || []).forEach(visit);
  return flattened;
}

function formatErrors(errors) {
  const seen = new Set();
  const messages = [];
  for (const error of flattenErrors(errors)) {
    const at = error.instancePath || '/';
    const message = error.message || `${error.keyword} validation failed`;
    const line = `${at} ${message}`.trim();
    if (!seen.has(line)) {
      seen.add(line);
      messages.push(line);
    }
  }
  return messages.join('\n');
}

function validateFixture(schemaName, fixturePath) {
  const schemaFile = SCHEMA_ALIASES[schemaName];
  if (!schemaFile) {
    const error = new Error(`unknown schema name: ${schemaName}`);
    error.exitCode = 2;
    throw error;
  }

  const schemaPath = path.join(SCHEMA_DIR, schemaFile);
  const schema = loadJson(schemaPath, 5, 5, 'schema');
  const fixture = loadJson(path.resolve(fixturePath), 3, 4, 'fixture');
  const ajv = createAjv();
  const validate = ajv.getSchema(schema.$id) || ajv.getSchema(schemaFile) || ajv.compile(schema);
  const valid = validate(fixture);
  return {
    valid,
    errors: valid ? [] : validate.errors || [],
  };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args || args.help || !args.schema || !args.fixture) {
    console.error(usage());
    return args && args.help ? 0 : 2;
  }

  try {
    const result = validateFixture(args.schema, args.fixture);
    if (!result.valid) {
      const formatted = formatErrors(result.errors);
      if (formatted) console.error(formatted);
      console.error(`VALIDATION FAILED: ${flattenErrors(result.errors).length} errors`);
      return 1;
    }
    return 0;
  } catch (error) {
    console.error(error.message);
    return error.exitCode || 5;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  SCHEMA_ALIASES,
  formatErrors,
  main,
  parseArgs,
  validateFixture,
};
