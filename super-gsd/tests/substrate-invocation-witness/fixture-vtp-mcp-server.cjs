#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { substratePayloadDigest } = require('../../scripts/lib/vtp-context-composer.cjs');

const SERVER_NAME = 'vtp-kb';
const SERVER_VERSION = '1.0.0';
const TOOL_NAME = 'vtp_search_substrate';
const OVERSIZED_HIT_CHARS = 16001;
const RETAINED_HIT_CHARS = 16000;
const FIXTURE_SCHEMA_VERSION = 1;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function payloadDigest(payload) {
  return substratePayloadDigest(payload);
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..'
    && !relative.startsWith('..' + path.sep)
    && !path.isAbsolute(relative));
}

function realContainedPath(tempDir, candidate, kind) {
  if (typeof tempDir !== 'string' || !tempDir || typeof candidate !== 'string' || !candidate) {
    throw new Error('fixture_' + kind + '_path_missing');
  }
  const realTemp = fs.realpathSync.native(path.resolve(tempDir));
  const resolved = path.resolve(candidate);
  const inspected = fs.existsSync(resolved)
    ? fs.realpathSync.native(resolved)
    : path.join(fs.realpathSync.native(path.dirname(resolved)), path.basename(resolved));
  if (!isContained(realTemp, inspected)) throw new Error('fixture_' + kind + '_outside_temp');
  return inspected;
}

function validateExpectation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('fixture_expectation_invalid');
  }
  if (typeof value.scenario !== 'string' || !/^[a-z0-9_.-]{1,80}$/i.test(value.scenario)) {
    throw new Error('fixture_expectation_scenario_invalid');
  }
  if (!value.payload || typeof value.payload !== 'object' || Array.isArray(value.payload)) {
    throw new Error('fixture_expectation_payload_invalid');
  }
  if (typeof value.payload_sha256 !== 'string'
      || value.payload_sha256 !== payloadDigest(value.payload)) {
    throw new Error('fixture_expectation_digest_invalid');
  }
  if (typeof value.raw_response_marker !== 'string'
      || value.raw_response_marker.length < 8
      || value.raw_response_marker.length > 160) {
    throw new Error('fixture_raw_marker_invalid');
  }
  if (typeof value.discarded_tail_marker !== 'string'
      || value.discarded_tail_marker.length !== 1) {
    throw new Error('fixture_tail_marker_invalid');
  }
  return value;
}

function loadConfiguration(env = process.env) {
  const tempDir = realContainedPath(env.P167_FIXTURE_TEMP_DIR, env.P167_FIXTURE_TEMP_DIR, 'temp');
  const logPath = realContainedPath(tempDir, env.P167_FIXTURE_LOG, 'log');
  const expectationsPath = realContainedPath(
    tempDir,
    env.P167_FIXTURE_EXPECTATIONS,
    'expectations',
  );
  let source;
  try {
    source = JSON.parse(fs.readFileSync(expectationsPath, 'utf8'));
  } catch (_) {
    throw new Error('fixture_expectations_invalid');
  }
  if (!source || source.schema_version !== FIXTURE_SCHEMA_VERSION
      || !Array.isArray(source.expectations) || source.expectations.length === 0) {
    throw new Error('fixture_expectations_invalid');
  }
  const expectations = source.expectations.map(validateExpectation);
  const seen = new Set();
  const markers = new Set();
  for (const expectation of expectations) {
    if (seen.has(expectation.payload_sha256)) throw new Error('fixture_expectation_duplicate');
    seen.add(expectation.payload_sha256);
    if (expectation.raw_response_marker.includes(expectation.discarded_tail_marker)
        || markers.has(expectation.raw_response_marker)
        || markers.has(expectation.discarded_tail_marker)) {
      throw new Error('fixture_marker_duplicate');
    }
    markers.add(expectation.raw_response_marker);
    markers.add(expectation.discarded_tail_marker);
  }
  return { tempDir, logPath, expectationsPath, expectations };
}

function makeOversizedText(rawMarker, tailMarker) {
  const prefix = rawMarker + ':';
  if (prefix.length >= RETAINED_HIT_CHARS) throw new Error('fixture_raw_marker_too_long');
  const text = prefix + 'x'.repeat(RETAINED_HIT_CHARS - prefix.length) + tailMarker;
  if (text.length !== OVERSIZED_HIT_CHARS) throw new Error('fixture_oversized_text_invalid');
  return text;
}

function buildDomainResult(expectation) {
  return {
    ok: true,
    fixture: SERVER_NAME,
    scenario: expectation.scenario,
    hits: [
      {
        doc_id: 'fixture:ordinary:' + expectation.scenario,
        text: 'ordinary fixture hit for ' + expectation.scenario,
      },
      {
        doc_id: 'fixture:oversized:' + expectation.scenario,
        text: makeOversizedText(
          expectation.raw_response_marker,
          expectation.discarded_tail_marker,
        ),
      },
    ],
  };
}

function buildToolResult(expectation) {
  const domain = buildDomainResult(expectation);
  return { content: [{ type: 'text', text: JSON.stringify(domain) }] };
}

function requestIdDigest(message) {
  return Object.prototype.hasOwnProperty.call(message || {}, 'id')
    ? sha256(Buffer.from(JSON.stringify(message.id), 'utf8'))
    : null;
}

function appendObservation(config, message, details = {}) {
  const row = {
    schema_version: FIXTURE_SCHEMA_VERSION,
    event: message.method,
    request_id_sha256: requestIdDigest(message),
    ...details,
  };
  fs.appendFileSync(config.logPath, JSON.stringify(row) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
  if (process.platform !== 'win32') fs.chmodSync(config.logPath, 0o600);
  return row;
}

function toolDefinition() {
  return {
    name: TOOL_NAME,
    description: 'Deterministic P167 substrate invocation witness fixture',
    inputSchema: { type: 'object', additionalProperties: true },
  };
}

function errorResponse(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function handleMessage(config, message) {
  const id = message && Object.prototype.hasOwnProperty.call(message, 'id') ? message.id : null;
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return errorResponse(id, -32600, 'fixture_invalid_request');
  }
  if (message.method === 'initialize') {
    appendObservation(config, message, { traffic_class: 'lifecycle' });
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: message.params && typeof message.params.protocolVersion === 'string'
          ? message.params.protocolVersion
          : '2024-11-05',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      },
    };
  }
  if (message.method === 'notifications/initialized') {
    appendObservation(config, message, { traffic_class: 'lifecycle' });
    return null;
  }
  if (message.method === 'tools/list') {
    appendObservation(config, message, { traffic_class: 'discovery' });
    return { jsonrpc: '2.0', id, result: { tools: [toolDefinition()] } };
  }
  if (message.method === 'ping') {
    appendObservation(config, message, { traffic_class: 'lifecycle' });
    return { jsonrpc: '2.0', id, result: {} };
  }
  if (message.method === 'tools/call') {
    const params = message.params && typeof message.params === 'object' ? message.params : {};
    const payload = params.arguments;
    const digest = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payloadDigest(payload)
      : null;
    const expectation = config.expectations.find((item) => item.payload_sha256 === digest);
    const accepted = Boolean(params.name === TOOL_NAME
      && expectation
      && JSON.stringify(expectation.payload) === JSON.stringify(payload));
    appendObservation(config, message, {
      traffic_class: 'invocation',
      tool_name: typeof params.name === 'string' ? params.name : null,
      payload_sha256: digest,
      payload_keys: payload && typeof payload === 'object' && !Array.isArray(payload)
        ? Object.keys(payload).sort()
        : [],
      payload_json_characters: payload && typeof payload === 'object' && !Array.isArray(payload)
        ? JSON.stringify(payload).length
        : 0,
      expectation: expectation ? expectation.scenario : null,
      accepted,
    });
    if (params.name !== TOOL_NAME) return errorResponse(id, -32601, 'fixture_tool_unknown');
    if (!accepted) return errorResponse(id, -32602, 'fixture_payload_unexpected');
    return { jsonrpc: '2.0', id, result: buildToolResult(expectation) };
  }
  appendObservation(config, message, { traffic_class: 'other' });
  if (!Object.prototype.hasOwnProperty.call(message, 'id')) return null;
  return errorResponse(id, -32601, 'fixture_method_unknown');
}

function createLineRouter(config, writeMessage) {
  function route(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch (_) {
      writeMessage(errorResponse(null, -32700, 'fixture_parse_error'));
      return;
    }
    const response = handleMessage(config, message);
    if (response) writeMessage(response);
  }
  return { route };
}

function runStdio(env = process.env) {
  let config;
  try {
    config = loadConfiguration(env);
  } catch (error) {
    process.stderr.write((error && error.message) || 'fixture_start_failed');
    process.stderr.write('\n');
    return 2;
  }
  const router = createLineRouter(
    config,
    (message) => process.stdout.write(JSON.stringify(message) + '\n'),
  );
  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    for (;;) {
      const newline = buffer.indexOf('\n');
      if (newline === -1) break;
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) router.route(line);
    }
  });
  process.stdin.on('end', () => {
    const line = buffer.trim();
    if (line) router.route(line);
  });
  return 0;
}

module.exports = {
  FIXTURE_SCHEMA_VERSION,
  OVERSIZED_HIT_CHARS,
  RETAINED_HIT_CHARS,
  SERVER_NAME,
  TOOL_NAME,
  buildDomainResult,
  buildToolResult,
  createLineRouter,
  handleMessage,
  loadConfiguration,
  makeOversizedText,
  payloadDigest,
};

if (require.main === module) process.exitCode = runStdio(process.env);
