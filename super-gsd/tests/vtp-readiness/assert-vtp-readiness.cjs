#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const registryPath = path.join(repoRoot, 'super-gsd', 'registry', 'vtp-services.yaml');
const loaderPath = path.join(repoRoot, 'super-gsd', 'tools', 'vtp-readiness', 'registry.cjs');
const requested = argument('--case') || 'all';
const supportedCases = ['registry-contract'];

let passed = 0;
let total = 0;
const failures = [];

function argument(flag) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? null : process.argv[index + 1];
}

function check(name, condition, detail = '') {
  total += 1;
  if (condition) {
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
    return;
  }
  failures.push(`${name}${detail ? `: ${detail}` : ''}`);
  process.stdout.write(`FAIL ${name}${detail ? ` (${detail})` : ''}\n`);
}

function equal(name, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    check(name, true);
  } catch (_error) {
    check(name, false, 'values differ');
  }
}

function replaceOnce(source, expected, replacement) {
  const index = source.indexOf(expected);
  assert.notStrictEqual(index, -1, `fixture seam missing: ${expected}`);
  assert.strictEqual(source.indexOf(expected, index + expected.length), -1,
    `fixture seam is not unique: ${expected}`);
  return source.slice(0, index) + replacement + source.slice(index + expected.length);
}

function captureLoad(loadRegistry, options) {
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  let stdout = '';
  let stderr = '';
  process.stdout.write = function captureStdout(chunk) {
    stdout += String(chunk);
    return true;
  };
  process.stderr.write = function captureStderr(chunk) {
    stderr += String(chunk);
    return true;
  };
  try {
    return { value: loadRegistry(options), stdout, stderr };
  } catch (error) {
    return { error, stdout, stderr };
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
  }
}

function rejectedSurface(error) {
  if (!error) return '';
  return [error.name, error.code, error.message, JSON.stringify(error)]
    .filter(Boolean).join(' ');
}

function withEnvironment(overrides, callback) {
  const prior = new Map();
  for (const [name, value] of Object.entries(overrides)) {
    prior.set(name, {
      present: Object.prototype.hasOwnProperty.call(process.env, name),
      value: process.env[name],
    });
    process.env[name] = value;
  }
  try {
    return callback();
  } finally {
    for (const [name, saved] of prior) {
      if (saved.present) process.env[name] = saved.value;
      else delete process.env[name];
    }
  }
}

function expectRejected(loadRegistry, tempDir, productionSource, fixture) {
  const badPath = path.join(tempDir, `${fixture.label}.yaml`);
  const badSource = fixture.mutate(productionSource);
  fs.writeFileSync(badPath, badSource, 'utf8');
  const result = captureLoad(loadRegistry, {
    registryPath: badPath,
    homeDir: path.join(tempDir, 'fake-home'),
  });
  const surface = rejectedSurface(result.error) + result.stdout + result.stderr;
  check(`${fixture.label} is rejected with stable reason code`,
    Boolean(result.error) && result.error.code === fixture.reason,
    result.error ? 'reason mismatch' : 'registry was accepted');
  check(`${fixture.label} does not echo rejected value`, !surface.includes(fixture.sentinel));
}

function registryContract() {
  const missing = [registryPath, loaderPath].filter((file) => !fs.existsSync(file));
  if (missing.length) {
    check('VTP registry and loader exist', false,
      missing.map((file) => path.relative(repoRoot, file)).join(', '));
    return;
  }

  const { loadRegistry } = require(loaderPath);
  check('loader exports loadRegistry', typeof loadRegistry === 'function');
  const pinnedYamlLoaded = Object.keys(require.cache).some((file) =>
    /plan-schema[\\/]node_modules[\\/]js-yaml[\\/]/.test(file));
  check('loader uses the pinned plan-schema js-yaml', pinnedYamlLoaded);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtp-registry-contract-'));
  try {
    const fakeHome = path.join(tempDir, 'fake-home');
    fs.mkdirSync(fakeHome, { recursive: true });
    const environmentNames = [
      'QDRANT_URL',
      'VTP_EMBED_PYTHON',
      'VTP_EVIDENCE_STORE_URL',
      'CLARITY_MONGO_URI',
      'CLARITY_MONGO_DB',
      'CLARITY_ES_URL',
    ];
    const fakeEnvironment = Object.fromEntries(environmentNames.map((name, index) => [
      name, ['SENTINEL', 'ENV', String(index)].join('_'),
    ]));
    const loadedResult = withEnvironment(fakeEnvironment,
      () => captureLoad(loadRegistry, { registryPath, homeDir: fakeHome }));
    check('production registry loads', !loadedResult.error);
    check('production registry load is silent',
      loadedResult.stdout === '' && loadedResult.stderr === '');
    if (loadedResult.error) return;

    const registry = loadedResult.value;
    const loadedSurface = JSON.stringify(registry) + loadedResult.stdout + loadedResult.stderr;
    check('environment values remain outside the loaded registry',
      !Object.values(fakeEnvironment).some((value) => loadedSurface.includes(value)));
    equal('schema version is locked', registry.schema_version, 1);
    equal('server topology is locked', registry.servers, {
      canonical: 'vtp-kb',
      adjacent: ['jcl-internal', 'jcl-products', 'qmd'],
    });
    equal('environment-name allowlist is locked', registry.environment_names, environmentNames);
    equal('pins are locked', registry.pins, {
      qdrant_js: '1.18.0',
      embedder: 'bge-base-en-v1.5',
      'sentence-transformers/torch': 'NEVER-upgrade',
    });
    equal('single-writer semantics are locked', registry.single_writer, {
      scope: 'ingest',
      max_writers: 1,
      lock_path: path.join(fakeHome, '.vtp', 'ingest.lock'),
    });
    equal('local paths are home-expanded', registry.paths, {
      vtp_root: path.join(fakeHome, 'Voice-Text-Plan'),
      source_dir: path.join(fakeHome, 'Voice-Text-Plan', 'src'),
      cli_entry: path.join(fakeHome, 'Voice-Text-Plan', 'dist', 'cli.js'),
      canonical_kb_dir: path.join(fakeHome, '.vtp'),
      mirror_only_kb_dir: path.join(fakeHome, 'Voice-Text-Plan', 'kb-data'),
      pending_ledger: path.join(fakeHome, '.vtp', 'pending-ledger.jsonl'),
      ingest_lock: path.join(fakeHome, '.vtp', 'ingest.lock'),
      ingest_manifest: path.join(fakeHome, 'Voice-Text-Plan', 'config', 'ingest-manifest.yaml'),
    });

    const productionSource = fs.readFileSync(registryPath, 'utf8');
    const sentinels = {
      value: ['SENTINEL', 'VALUE', 'CARRY'].join('_'),
      default: ['SENTINEL', 'DEFAULT', 'CARRY'].join('_'),
      url: ['SENTINEL', 'URL', 'CARRY'].join('_'),
      uri: ['SENTINEL', 'URI', 'CARRY'].join('_'),
      hostField: ['SENTINEL', 'HOST', 'FIELD'].join('_'),
      endpoint: ['SENTINEL', 'ENDPOINT', 'CARRY'].join('_'),
      credential: ['SENTINEL', 'CREDENTIAL', 'CARRY'].join('_'),
      host: ['sentinel-host', 'example', 'invalid'].join('.'),
      duplicate: ['SENTINEL', 'DUPLICATE'].join('_'),
      server: ['SENTINEL', 'SERVER'].join('_'),
      path: ['~', 'SENTINEL_PATH', 'pending-ledger.jsonl'].join('/'),
      pin: ['SENTINEL', 'PIN'].join('_'),
      writer: ['SENTINEL', 'WRITER'].join('_'),
    };
    const forbiddenFieldFixtures = [
      ['value-carrying field', 'value', sentinels.value],
      ['default field', 'default', sentinels.default],
      ['URL field', 'url', sentinels.url],
      ['URI field', 'uri', sentinels.uri],
      ['host field', 'host', sentinels.hostField],
      ['endpoint field', 'endpoint', sentinels.endpoint],
      ['credential field', 'credential', sentinels.credential],
    ].map(([label, field, sentinel]) => ({
      label,
      reason: 'registry_forbidden_field',
      sentinel,
      mutate: (source) => `${source}\noperator_data:\n  ${field}: ${sentinel}\n`,
    }));
    const fixtures = forbiddenFieldFixtures.concat([
      {
        label: 'embedded host scalar',
        reason: 'registry_embedded_host',
        sentinel: sentinels.host,
        mutate: (source) => `${source}\noperator_note: ${sentinels.host}\n`,
      },
      {
        label: 'duplicate key',
        reason: 'registry_duplicate_key',
        sentinel: sentinels.duplicate,
        mutate: (source) => replaceOnce(source, 'schema_version: 1',
          `schema_version: 1\nschema_version: ${sentinels.duplicate}`),
      },
      {
        label: 'renamed canonical server',
        reason: 'registry_server_mismatch',
        sentinel: sentinels.server,
        mutate: (source) => replaceOnce(source, '  canonical: vtp-kb',
          `  canonical: ${sentinels.server}`),
      },
      {
        label: 'omitted environment name',
        reason: 'registry_environment_names_mismatch',
        sentinel: 'CLARITY_ES_URL',
        mutate: (source) => replaceOnce(source, '  - CLARITY_ES_URL\n', ''),
      },
      {
        label: 'changed locked path',
        reason: 'registry_path_mismatch',
        sentinel: sentinels.path,
        mutate: (source) => replaceOnce(source,
          '  pending_ledger: ~/.vtp/pending-ledger.jsonl',
          `  pending_ledger: ${sentinels.path}`),
      },
      {
        label: 'wrong pin fact',
        reason: 'registry_pin_mismatch',
        sentinel: sentinels.pin,
        mutate: (source) => replaceOnce(source, '  qdrant_js: 1.18.0',
          `  qdrant_js: ${sentinels.pin}`),
      },
      {
        label: 'broken single-writer semantics',
        reason: 'registry_single_writer_mismatch',
        sentinel: sentinels.writer,
        mutate: (source) => replaceOnce(source, '  max_writers: 1',
          `  max_writers: ${sentinels.writer}`),
      },
    ]);
    for (const fixture of fixtures) {
      expectRejected(loadRegistry, tempDir, productionSource, fixture);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (requested !== 'all' && !supportedCases.includes(requested)) {
  process.stderr.write(`Usage: ${path.basename(__filename)} --case all|${supportedCases.join('|')}\n`);
  process.exit(2);
}

if (requested === 'all' || requested === 'registry-contract') registryContract();

process.stdout.write('---\n');
process.stdout.write(`vtp_readiness: ${passed}/${total} assertions passed\n`);
if (failures.length) {
  for (const failure of failures) process.stderr.write(`FAIL ${failure}\n`);
  process.exit(1);
}
