#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const storageLocal = require('./storage-local.cjs');
const storageVtp = require('./storage-vtp.cjs');

const EXIT = {
  BUNDLE_INVALID: 1,
  VERDICT_REFUSED: 2,
  LOCAL_WRITE_FAILED: 3,
  VTP_UNAVAILABLE: 4,
  USAGE: 5,
};

class PublishError extends Error {
  constructor(exitCode, message) {
    super(message);
    this.exitCode = exitCode;
  }
}

function usage() {
  return [
    'Usage: node super-gsd/tools/chronicle/publish.cjs --bundle <path> [--storage-target vtp|local|auto]',
    '       [--vtp-mcp-url <url>] [--local-root .planning/chronicles]',
    '       [--index-ledger .planning/chronicles/INDEX.jsonl] [--force]',
  ].join('\n');
}

function parseArgs(argv) {
  const opts = {
    storageTarget: 'auto',
    localRoot: path.join('.planning', 'chronicles'),
    indexLedger: path.join('.planning', 'chronicles', 'INDEX.jsonl'),
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--force') {
      opts.force = true;
      continue;
    }

    const takesValue = new Set([
      '--bundle',
      '--storage-target',
      '--vtp-mcp-url',
      '--local-root',
      '--index-ledger',
    ]);
    if (!takesValue.has(arg)) {
      throw new PublishError(EXIT.USAGE, `${usage()}\nUnknown argument: ${arg}`);
    }
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) {
      throw new PublishError(EXIT.USAGE, `${usage()}\nMissing value for ${arg}`);
    }
    const value = argv[i + 1];
    i += 1;

    if (arg === '--bundle') opts.bundle = value;
    if (arg === '--storage-target') opts.storageTarget = value;
    if (arg === '--vtp-mcp-url') opts.vtpMcpUrl = value;
    if (arg === '--local-root') opts.localRoot = value;
    if (arg === '--index-ledger') opts.indexLedger = value;
  }

  if (!opts.bundle) {
    throw new PublishError(EXIT.USAGE, `${usage()}\nMissing required --bundle`);
  }
  if (!['auto', 'local', 'vtp'].includes(opts.storageTarget)) {
    throw new PublishError(EXIT.USAGE, `${usage()}\nInvalid --storage-target: ${opts.storageTarget}`);
  }

  return opts;
}

const { requireDependency: requirePlanSchemaModule } = require('./lib/require-dep.cjs');

function loadJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new PublishError(EXIT.BUNDLE_INVALID, `${label} invalid JSON: ${error.message}`);
  }
}

function addSchema(ajv, schema, key) {
  try {
    ajv.addSchema(schema, key);
  } catch (_error) {
    // Duplicate schema keys are harmless for this validator setup.
  }
}

function buildAjv(schemaDir, excludedSchemaPath) {
  const Ajv = requirePlanSchemaModule('ajv');
  const ajvErrors = requirePlanSchemaModule('ajv-errors');
  const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
  ajvErrors(ajv);

  if (fs.existsSync(schemaDir)) {
    for (const entry of fs.readdirSync(schemaDir)) {
      if (!entry.endsWith('.json')) continue;
      const schemaPath = path.join(schemaDir, entry);
      if (path.resolve(schemaPath) === path.resolve(excludedSchemaPath)) continue;
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      addSchema(ajv, schema, entry);
      addSchema(ajv, schema, `./${entry}`);
      if (schema.$id) {
        addSchema(ajv, schema, schema.$id);
      }
    }
  }

  return ajv;
}

function formatAjvErrors(errors = []) {
  return errors
    .map((error) => {
      const location = error.instancePath || '/';
      return `${location} ${error.message}`;
    })
    .join('; ');
}

function validateWithSchema(data, schemaPath, label) {
  const schemaDir = path.dirname(schemaPath);
  let schema;
  let validate;
  try {
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    validate = buildAjv(schemaDir, schemaPath).compile(schema);
  } catch (error) {
    throw new PublishError(EXIT.BUNDLE_INVALID, `${label} schema setup failed: ${error.message}`);
  }

  if (!validate(data)) {
    throw new PublishError(EXIT.BUNDLE_INVALID, `${label} schema invalid: ${formatAjvErrors(validate.errors)}`);
  }
}

function validateBundleShape(bundle) {
  const required = [
    'milestone_id',
    'phase_id',
    'chronicle_type',
    'chronicle_context',
    'chronicle_html',
    'manifest',
    'validator_verdict',
  ];
  const missing = required.filter((key) => !Object.prototype.hasOwnProperty.call(bundle, key));
  if (missing.length > 0) {
    throw new PublishError(EXIT.BUNDLE_INVALID, `bundle missing required field(s): ${missing.join(', ')}`);
  }
  if (!['phase', 'milestone'].includes(bundle.chronicle_type)) {
    throw new PublishError(EXIT.BUNDLE_INVALID, `bundle chronicle_type invalid: ${bundle.chronicle_type}`);
  }
  if (!bundle.chronicle_context || typeof bundle.chronicle_context !== 'object' || Array.isArray(bundle.chronicle_context)) {
    throw new PublishError(EXIT.BUNDLE_INVALID, 'bundle chronicle_context must be an object');
  }
  if (typeof bundle.chronicle_html !== 'string' || bundle.chronicle_html.length === 0) {
    throw new PublishError(EXIT.BUNDLE_INVALID, 'bundle chronicle_html must be a non-empty string');
  }
  if (!bundle.manifest || typeof bundle.manifest !== 'object' || Array.isArray(bundle.manifest)) {
    throw new PublishError(EXIT.BUNDLE_INVALID, 'bundle manifest must be an object');
  }
}

function validateBundle(bundle, opts) {
  validateBundleShape(bundle);

  const schemaRoot = path.join(__dirname, '..', '..', 'schemas');
  validateWithSchema(bundle.chronicle_context, path.join(schemaRoot, 'chronicle.schema.json'), 'chronicle_context');
  validateWithSchema(bundle.manifest, path.join(schemaRoot, 'chronicle-manifest.schema.json'), 'manifest');

  if (bundle.validator_verdict !== 'REPORT_GROUNDED') {
    if (!opts.force) {
      throw new PublishError(
        EXIT.VERDICT_REFUSED,
        `validator_verdict must be REPORT_GROUNDED, got ${bundle.validator_verdict}`,
      );
    }
    console.error(`FORCE: publishing bundle with validator_verdict=${bundle.validator_verdict}`);
  }
}

function readExistingIndexRow(indexLedger, contentHash) {
  if (!fs.existsSync(indexLedger)) {
    return null;
  }
  const lines = fs.readFileSync(indexLedger, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      if (row.content_hash === contentHash && row.location && row.storage_target) {
        return row;
      }
    } catch (_error) {
      // Ignore unrelated malformed historical rows; validation belongs at write time.
    }
  }
  return null;
}

function sizeBytesFor(bundle, contentHash) {
  return Buffer.byteLength(
    [
      storageLocal.canonicalJson(bundle.chronicle_context, 0),
      bundle.chronicle_html,
      storageLocal.canonicalJson(bundle.manifest, 0),
      contentHash,
    ].join(''),
    'utf8',
  );
}

function appendIndexRow(indexLedger, row) {
  fs.mkdirSync(path.dirname(indexLedger), { recursive: true });
  fs.appendFileSync(indexLedger, `${JSON.stringify(row)}\n`, 'utf8');
}

async function chooseTarget(opts) {
  if (opts.storageTarget === 'local') {
    return 'local';
  }

  const probeResult = await Promise.resolve(storageVtp.probe(opts.vtpMcpUrl));
  if (opts.storageTarget === 'vtp') {
    if (!probeResult.available) {
      throw new PublishError(EXIT.VTP_UNAVAILABLE, probeResult.reason || 'vtp_unavailable');
    }
    return 'vtp';
  }

  return probeResult.available ? 'vtp' : 'local';
}

async function publishBundle(bundle, opts) {
  const contentHash = storageLocal.contentHashFor(bundle);
  const existing = readExistingIndexRow(opts.indexLedger, contentHash);
  if (existing) {
    return {
      target: existing.storage_target,
      location: existing.location,
      contentHash,
      idempotent: true,
    };
  }

  const target = await chooseTarget(opts);
  let result;
  if (target === 'local') {
    try {
      result = storageLocal.publish(bundle, {
        localRoot: opts.localRoot,
        contentHash,
      });
    } catch (error) {
      throw new PublishError(EXIT.LOCAL_WRITE_FAILED, `local write failed: ${error.message}`);
    }
  } else {
    result = await storageVtp.upsert(bundle, {
      vtpMcpUrl: opts.vtpMcpUrl,
      contentHash,
    });
  }

  const row = {
    ts: new Date().toISOString(),
    milestone_id: String(bundle.milestone_id),
    phase_id: String(bundle.phase_id),
    chronicle_type: bundle.chronicle_type,
    storage_target: target,
    location: result.location,
    size_bytes: sizeBytesFor(bundle, contentHash),
    validator_verdict: bundle.validator_verdict,
    content_hash: contentHash,
    published_by: 'publish.cjs',
  };
  appendIndexRow(opts.indexLedger, row);

  return {
    target,
    location: result.location,
    contentHash,
    idempotent: false,
  };
}

async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  const bundle = loadJson(opts.bundle, 'bundle');
  validateBundle(bundle, opts);
  const result = await publishBundle(bundle, opts);
  process.stdout.write(`PUBLISHED ${result.target} ${result.location}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    const exitCode = error instanceof PublishError ? error.exitCode : EXIT.BUNDLE_INVALID;
    process.stderr.write(`${error.message}\n`);
    process.exitCode = exitCode;
  });
}

module.exports = {
  EXIT,
  PublishError,
  main,
  parseArgs,
  publishBundle,
  readExistingIndexRow,
  validateBundle,
};
