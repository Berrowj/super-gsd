'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createInterface } = require('node:readline');
const { test } = require('node:test');

test('VTP proxy survives bearer rotation and preserves JSON-RPC responses', { timeout: 20000 }, async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vtp-proxy-test-'));
  const tokenFile = path.join(temp, 'bearer');
  let expectedToken = 'fixture-token-before-rotation';
  fs.writeFileSync(tokenFile, expectedToken);
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const message = JSON.parse(body);
    requests.push({ message, session: req.headers['mcp-session-id'] });
    if (req.headers.authorization !== 'Bearer ' + expectedToken) {
      res.writeHead(401).end();
      return;
    }
    const response = { jsonrpc: '2.0', id: message.id, result: { ok: true } };
    if (message.method === 'initialize') {
      res.setHeader('Mcp-Session-Id', 'fixture-session');
    }
    if (message.method === 'tools/call') {
      res.setHeader('Content-Type', 'text/event-stream');
      const event = 'event: message\r\ndata: ' + JSON.stringify(response) + '\r\n\r\n';
      res.write(event.slice(0, 35));
      res.end(event.slice(35));
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(response));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const child = spawn(process.execPath, [
    path.resolve(__dirname, '../../scripts/devcp/vtp-stdio-proxy.mjs'),
  ], {
    env: {
      ...process.env,
      VTP_BEARER_FILE: tokenFile,
      VTP_MCP_URL: 'http://127.0.0.1:' + server.address().port + '/mcp',
      VTP_PROXY_WARM_TOOL: '',
      VTP_PROXY_TIMEOUT_MS: '3000',
    },
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const childClosed = once(child, 'close');
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const lines = createInterface({ input: child.stdout });
  const pending = new Map();
  lines.on('line', (line) => {
    const response = JSON.parse(line);
    const callback = pending.get(response.id);
    if (callback) {
      pending.delete(response.id);
      callback.resolve(response);
    }
  });
  child.on('exit', (code) => {
    for (const callback of pending.values()) {
      callback.reject(new Error('Proxy exited ' + code + ': ' + stderr));
    }
    pending.clear();
  });
  function exchange(id, method, raw) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('No response for request ' + id));
      }, 5000);
      pending.set(id, {
        resolve: (response) => { clearTimeout(timer); resolve(response); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
      child.stdin.write((raw || JSON.stringify({ jsonrpc: '2.0', id, method })) + '\n');
    });
  }
  try {
    assert.deepEqual((await exchange(1, 'initialize')).result, { ok: true });
    assert.deepEqual((await exchange(2, 'tools/list')).result, { ok: true });
    assert.equal(requests.at(-1).session, 'fixture-session');
    expectedToken = 'fixture-token-after-rotation';
    fs.writeFileSync(tokenFile, expectedToken);
    assert.deepEqual((await exchange(3, 'tools/list')).result, { ok: true });

    fs.writeFileSync(tokenFile, 'fixture-stale-token');
    const rejected = await exchange(4, 'tools/list');
    assert.equal(rejected.error.code, -32001);
    assert.match(rejected.error.message, /upstream_401_bearer_rejected/);
    fs.writeFileSync(tokenFile, expectedToken);
    assert.deepEqual((await exchange(5, 'tools/list')).result, { ok: true });

    assert.deepEqual((await exchange(6, 'tools/call')).result, { ok: true });
    assert.equal((await exchange(null, null, '{malformed')).error.code, -32700);
    assert.equal(requests.length, 6);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await childClosed;
    lines.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

async function sessionFixture(t, options = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vtp-session-test-'));
  const tokenFile = path.join(temp, 'bearer');
  fs.writeFileSync(tokenFile, 'fixture-token');
  const state = {
    session: null, initialized: false, handshakes: 0, notifications: 0,
    requests: [], executed: [], responses: [], rejectHandshake: false,
  };
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const message = JSON.parse(body);
    const session = req.headers['mcp-session-id'];
    state.requests.push({ message, session });
    const reply = (status, payload) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    };
    if (message.method === 'initialize') {
      state.handshakes++;
      if (state.rejectHandshake) return reply(503, { error: 'fixture unavailable' });
      assert.equal(session, undefined, 'new initialization must not send an expired ID');
      state.session = 'fixture-session-' + state.handshakes;
      state.initialized = false;
      res.setHeader('Mcp-Session-Id', state.session);
      const response = { jsonrpc: '2.0', id: message.id, result: {
        protocolVersion: '2024-11-05', capabilities: {},
        serverInfo: { name: 'fixture', version: '1' },
      } };
      if (options.sseInitialize) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write('event: message\ndata: ' + JSON.stringify(response) + '\n\n');
        const timer = setTimeout(() => res.end(), 250);
        res.on('close', () => clearTimeout(timer));
        return;
      }
      return reply(200, response);
    }
    if (!session || session !== state.session
        || (options.alwaysExpired && message.method !== 'notifications/initialized')) {
      // Let one old-session rejection arrive after another call has recovered.
      if (message.id === 'delayed') await new Promise((resolve) => setTimeout(resolve, 80));
      return reply(400, { jsonrpc: '2.0', id: null, error: {
        code: -32000, message: 'Bad Request: no valid MCP session',
      } });
    }
    if (message.method === 'notifications/initialized') {
      state.notifications++;
      state.initialized = true;
      return res.writeHead(202).end();
    }
    if (!state.initialized) return reply(400, { error: 'initialize notification missing' });
    if (message.method === 'fixture/http400') return reply(400, { error: { code: -32000, message: 'Invalid arguments' } });
    if (message.method === 'fixture/http401') return reply(401, {});
    if (message.method === 'fixture/http404') return reply(404, { error: 'Route missing' });
    if (message.method === 'fixture/disconnect') {
      state.executed.push(message.id);
      return req.socket.destroy();
    }
    if (message.method === 'fixture/timeout') {
      state.executed.push(message.id);
      return;
    }
    state.executed.push(message.id);
    return reply(200, { jsonrpc: '2.0', id: message.id, result: { ok: true } });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const child = spawn(process.execPath, [path.resolve(__dirname, '../../scripts/devcp/vtp-stdio-proxy.mjs')], {
    env: { ...process.env, VTP_BEARER_FILE: tokenFile,
      VTP_MCP_URL: 'http://127.0.0.1:' + server.address().port + '/mcp',
      VTP_PROXY_WARM_TOOL: '', VTP_PROXY_TIMEOUT_MS: '500' },
    windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const closed = once(child, 'close');
  const lines = createInterface({ input: child.stdout });
  const pending = new Map();
  lines.on('line', (line) => {
    const response = JSON.parse(line);
    state.responses.push(response);
    pending.get(response.id)?.(response);
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await closed;
    lines.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  function exchange(id, method, params = {}) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('No response: ' + id)); }, 4000);
      pending.set(id, (response) => { clearTimeout(timer); pending.delete(id); resolve(response); });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  assert.ok((await exchange('init', 'initialize', {
    protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'fixture-client', version: '1' },
  })).result);
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  // A response to a following request establishes that the initial notification arrived.
  if (!options.alwaysExpired) assert.ok((await exchange('ready', 'tools/list')).result);
  return { state, exchange };
}

test('VTP proxy reconnects once for concurrent expired calls without duplicate execution or handshake output', { timeout: 10000 }, async (t) => {
  const { state, exchange } = await sessionFixture(t);
  state.session = 'server-restarted';
  const responses = await Promise.all(['first', 'second', 'delayed'].map((id) => exchange(id, 'tools/call')));
  for (const response of responses) assert.deepEqual(response.result, { ok: true });
  assert.equal(state.handshakes, 2);
  assert.equal(state.notifications, 2);
  assert.deepEqual(state.executed.sort(), ['ready', 'first', 'second', 'delayed'].sort());
  assert.deepEqual(state.responses.map((response) => response.id).sort(), ['init', 'ready', 'first', 'second', 'delayed'].sort());
  assert.deepEqual(state.requests.filter(({ message }) => message.method === 'initialize').map(({ message }) => message.params), [
    { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'fixture-client', version: '1' } },
    { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'fixture-client', version: '1' } },
  ]);
});

test('VTP proxy never replays unrelated HTTP errors or requests with uncertain execution', { timeout: 10000 }, async (t) => {
  const { state, exchange } = await sessionFixture(t);
  for (const failure of ['http400', 'http401', 'http404', 'disconnect', 'timeout']) {
    const before = state.requests.length;
    const response = await exchange(failure, 'fixture/' + failure);
    assert.equal(response.error.code, -32001, failure);
    assert.equal(state.requests.length, before + 1, failure + ' must not be retried');
  }
  assert.equal(state.handshakes, 1);
  assert.deepEqual(state.executed, ['ready', 'disconnect', 'timeout']);
});

test('VTP proxy bounds a failed reconnect and can recover on a later request', { timeout: 10000 }, async (t) => {
  const { state, exchange } = await sessionFixture(t);
  state.session = 'server-restarted';
  state.rejectHandshake = true;
  const failed = await exchange('failed', 'tools/call');
  assert.match(failed.error.message, /upstream_http_503/);
  assert.equal(state.handshakes, 2);
  assert.deepEqual(state.executed, ['ready']);
  state.rejectHandshake = false;
  assert.deepEqual((await exchange('later', 'tools/call')).result, { ok: true });
  assert.equal(state.handshakes, 3);
  assert.deepEqual(state.executed, ['ready', 'later']);
});

test('VTP proxy stops after one reconnect if the new session is rejected too', { timeout: 10000 }, async (t) => {
  const { state, exchange } = await sessionFixture(t, { alwaysExpired: true });
  const result = await exchange('still-expired', 'tools/call');
  assert.match(result.error.message, /upstream_http_400/);
  assert.equal(state.handshakes, 2);
  assert.equal(state.notifications, 2);
  assert.equal(state.requests.filter(({ message }) => message.id === 'still-expired').length, 2);
  assert.deepEqual(state.executed, []);
});

test('VTP proxy accepts SSE initialization before the stream closes, including reconnect', { timeout: 10000 }, async (t) => {
  const { state, exchange } = await sessionFixture(t, { sseInitialize: true });
  state.session = 'server-restarted';
  assert.deepEqual((await exchange('after-restart', 'tools/call')).result, { ok: true });
  assert.equal(state.handshakes, 2);
  assert.equal(state.notifications, 2);
  assert.deepEqual(state.executed, ['ready', 'after-restart']);
});
