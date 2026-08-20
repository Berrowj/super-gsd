'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const YAML_LIB_PATH = path.resolve(
  __dirname, '..', 'plan-schema', 'node_modules', 'js-yaml');
const yaml = require(YAML_LIB_PATH);
const DEFAULT_REGISTRY_PATH = path.resolve(
  __dirname, '..', '..', 'registry', 'vtp-services.yaml');

const EXPECTED = Object.freeze({
  schema_version: 1,
  servers: Object.freeze({
    canonical: 'vtp-kb',
    adjacent: Object.freeze(['jcl-internal', 'jcl-products', 'qmd']),
  }),
  environment_names: Object.freeze([
    'QDRANT_URL',
    'VTP_EMBED_PYTHON',
    'VTP_EVIDENCE_STORE_URL',
    'CLARITY_MONGO_URI',
    'CLARITY_MONGO_DB',
    'CLARITY_ES_URL',
  ]),
  paths: Object.freeze({
    vtp_root: '~/Voice-Text-Plan/',
    source_dir: 'src/',
    cli_entry: 'dist/cli.js',
    canonical_kb_dir: '~/.vtp/',
    mirror_only_kb_dir: '~/Voice-Text-Plan/kb-data/',
    pending_ledger: '~/.vtp/pending-ledger.jsonl',
    ingest_lock: '~/.vtp/ingest.lock',
    ingest_manifest: 'config/ingest-manifest.yaml',
  }),
  pins: Object.freeze({
    qdrant_js: '1.18.0',
    embedder: 'bge-base-en-v1.5',
    'sentence-transformers/torch': 'NEVER-upgrade',
  }),
  single_writer: Object.freeze({
    scope: 'ingest',
    max_writers: 1,
    lock_path: '~/.vtp/ingest.lock',
  }),
});

const TOP_LEVEL_KEYS = Object.freeze([
  'schema_version',
  'servers',
  'environment_names',
  'paths',
  'pins',
  'single_writer',
]);
const FORBIDDEN_FIELD_TOKENS = new Set([
  'value', 'values',
  'default', 'defaults',
  'url', 'urls',
  'uri', 'uris',
  'host', 'hosts', 'hostname', 'hostnames',
  'endpoint', 'endpoints',
  'credential', 'credentials',
]);

class VtpRegistryError extends Error {
  constructor(code) {
    super(`VTP services registry rejected: ${code}`);
    this.name = 'VtpRegistryError';
    this.code = code;
  }
}

function reject(code) {
  throw new VtpRegistryError(code);
}

function isMapping(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fieldTokens(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function containsEmbeddedHost(value) {
  if (typeof value !== 'string') return false;
  const scalar = value.trim();
  if (!scalar) return false;
  if (/\b[a-z][a-z0-9+.-]*:\/\/\S+/i.test(scalar)) return true;
  if (/(?:^|\s)(?:localhost)(?::\d+)?(?:$|\s)/i.test(scalar)) return true;
  if (/(?:^|\s)(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:$|\s)/.test(scalar)) return true;
  return /(?:^|\s)(?:[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}(?::\d+)?(?:$|\s)/i
    .test(scalar);
}

function rejectUnsafeContent(node) {
  if (Array.isArray(node)) {
    for (const item of node) rejectUnsafeContent(item);
    return;
  }
  if (isMapping(node)) {
    for (const [key, value] of Object.entries(node)) {
      if (fieldTokens(key).some((token) => FORBIDDEN_FIELD_TOKENS.has(token))) {
        reject('registry_forbidden_field');
      }
      rejectUnsafeContent(value);
    }
    return;
  }
  if (containsEmbeddedHost(node)) reject('registry_embedded_host');
}

function sameKeys(actual, expected) {
  if (!isMapping(actual)) return false;
  const keys = Object.keys(actual).sort();
  const required = expected.slice().sort();
  return keys.length === required.length
    && keys.every((key, index) => key === required[index]);
}

function sameArray(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function sameMapping(actual, expected) {
  const keys = Object.keys(expected);
  return sameKeys(actual, keys)
    && keys.every((key) => actual[key] === expected[key]);
}

function validateRegistry(registry) {
  if (!sameKeys(registry, TOP_LEVEL_KEYS)) reject('registry_shape_mismatch');
  if (registry.schema_version !== EXPECTED.schema_version) {
    reject('registry_schema_mismatch');
  }
  if (!sameKeys(registry.servers, ['canonical', 'adjacent'])
      || registry.servers.canonical !== EXPECTED.servers.canonical
      || !sameArray(registry.servers.adjacent, EXPECTED.servers.adjacent)) {
    reject('registry_server_mismatch');
  }
  if (!sameArray(registry.environment_names, EXPECTED.environment_names)) {
    reject('registry_environment_names_mismatch');
  }
  if (!sameMapping(registry.paths, EXPECTED.paths)) reject('registry_path_mismatch');
  if (!sameMapping(registry.pins, EXPECTED.pins)) reject('registry_pin_mismatch');
  if (!sameMapping(registry.single_writer, EXPECTED.single_writer)) {
    reject('registry_single_writer_mismatch');
  }
}

function parseRegistry(source) {
  try {
    const parsed = yaml.load(source, { schema: yaml.JSON_SCHEMA });
    if (!isMapping(parsed)) reject('registry_shape_mismatch');
    return parsed;
  } catch (error) {
    if (error instanceof VtpRegistryError) throw error;
    if (error && error.name === 'YAMLException') {
      const reason = /duplicated mapping key/i.test(String(error.reason || error.message || ''))
        ? 'registry_duplicate_key'
        : 'registry_yaml_malformed';
      reject(reason);
    }
    reject('registry_parse_failed');
  }
}

function readRegistry(registryPath) {
  try {
    const stat = fs.statSync(registryPath);
    if (!stat.isFile()) reject('registry_read_failed');
    return fs.readFileSync(registryPath, 'utf8');
  } catch (error) {
    if (error instanceof VtpRegistryError) throw error;
    reject('registry_read_failed');
  }
}

function expandHome(rawPath, homeDir) {
  const relative = rawPath.slice(2).split('/').filter(Boolean);
  return path.resolve(homeDir, ...relative);
}

function expandPaths(rawPaths, homeDir) {
  const vtpRoot = expandHome(rawPaths.vtp_root, homeDir);
  return {
    vtp_root: vtpRoot,
    source_dir: path.resolve(vtpRoot, ...rawPaths.source_dir.split('/').filter(Boolean)),
    cli_entry: path.resolve(vtpRoot, ...rawPaths.cli_entry.split('/').filter(Boolean)),
    canonical_kb_dir: expandHome(rawPaths.canonical_kb_dir, homeDir),
    mirror_only_kb_dir: expandHome(rawPaths.mirror_only_kb_dir, homeDir),
    pending_ledger: expandHome(rawPaths.pending_ledger, homeDir),
    ingest_lock: expandHome(rawPaths.ingest_lock, homeDir),
    ingest_manifest: path.resolve(
      vtpRoot, ...rawPaths.ingest_manifest.split('/').filter(Boolean)),
  };
}

function loadRegistry(options = {}) {
  if (!isMapping(options)) reject('registry_options_invalid');
  const registryPath = options.registryPath === undefined
    ? DEFAULT_REGISTRY_PATH
    : options.registryPath;
  const homeDir = options.homeDir === undefined ? os.homedir() : options.homeDir;
  if (typeof registryPath !== 'string' || !registryPath.trim()) {
    reject('registry_path_invalid');
  }
  if (typeof homeDir !== 'string' || !homeDir.trim()) reject('registry_home_invalid');

  const source = readRegistry(path.resolve(registryPath));
  const registry = parseRegistry(source);
  rejectUnsafeContent(registry);
  validateRegistry(registry);
  const paths = expandPaths(registry.paths, path.resolve(homeDir));
  return {
    schema_version: registry.schema_version,
    servers: {
      canonical: registry.servers.canonical,
      adjacent: registry.servers.adjacent.slice(),
    },
    environment_names: registry.environment_names.slice(),
    paths,
    pins: { ...registry.pins },
    single_writer: {
      scope: registry.single_writer.scope,
      max_writers: registry.single_writer.max_writers,
      lock_path: paths.ingest_lock,
    },
  };
}

module.exports = {
  loadRegistry,
  DEFAULT_REGISTRY_PATH,
  VtpRegistryError,
};
