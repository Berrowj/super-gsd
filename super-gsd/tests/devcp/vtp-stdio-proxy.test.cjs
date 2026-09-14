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
