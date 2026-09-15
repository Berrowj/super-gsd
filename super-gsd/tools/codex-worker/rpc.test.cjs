'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const childProcess = require('node:child_process');
const rpcPath = require.resolve('./rpc.cjs');

function fakeChild() {
  const child = new EventEmitter();
  child.pid = 0;
  child.stdout = new EventEmitter(); child.stdout.setEncoding = () => {};
  child.stderr = new EventEmitter(); child.stderr.setEncoding = () => {};
  child.stdin = new EventEmitter(); child.stdin.writes = []; child.stdin.write = line => { child.stdin.writes.push(line); return true; };
  child.kill = () => { child.killed = true; };
  return child;
}

function startRpc() {
  const originalLoad = Module._load;
  let child;
  Module._load = function(request, parent, isMain) {
    if (request === 'node:child_process') return { ...childProcess, spawn: () => (child = fakeChild()) };
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[rpcPath];
  let rpcModule;
  try { rpcModule = require(rpcPath); } finally { Module._load = originalLoad; }
  const rpc = new rpcModule.Rpc('local-fake-app-server', []);
  return { rpc, child, ...rpcModule };
}

function nativeEvent(text) {
  return JSON.stringify({ method: 'item/completed', params: { threadId: 'thread', turnId: 'turn',
    item: { type: 'agentMessage', id: 'item', phase: 'final_answer', text } } }) + '\n';
}

const afterMessages = () => new Promise(resolve => setImmediate(resolve));

test('accepts the observed-size native completion event under a finite inbound limit', async () => {
  const { rpc, child, MAX_INBOUND_FRAME_BYTES } = startRpc();
  const observedBytes = 2284876;
  const empty = nativeEvent('');
  const frame = nativeEvent('x'.repeat(observedBytes - Buffer.byteLength(empty)));
  const seen = []; let fault;
  rpc.on('message', message => seen.push(message)); rpc.on('fault', error => { fault = error; });
  assert.equal(Buffer.byteLength(frame), observedBytes);
  assert.ok(Buffer.byteLength(frame) < MAX_INBOUND_FRAME_BYTES);
  child.stdout.emit('data', frame);
  await afterMessages();
  assert.equal(fault, undefined); assert.equal(rpc.closed, false); assert.equal(seen.length, 1);
});

test('drains individually valid newline frames before applying the partial-frame bound', async () => {
  const { rpc, child, MAX_OUTBOUND_FRAME_BYTES } = startRpc();
  const first = nativeEvent('x'.repeat(600 * 1024)), second = nativeEvent('y'.repeat(600 * 1024));
  const aggregate = first + second, seen = []; let fault;
  rpc.on('message', message => seen.push(message)); rpc.on('fault', error => { fault = error; });
  assert.ok(Buffer.byteLength(first) < MAX_OUTBOUND_FRAME_BYTES);
  assert.ok(Buffer.byteLength(second) < MAX_OUTBOUND_FRAME_BYTES);
  assert.ok(Buffer.byteLength(aggregate) > MAX_OUTBOUND_FRAME_BYTES);
  child.stdout.emit('data', aggregate);
  await afterMessages();
  assert.equal(fault, undefined); assert.equal(rpc.closed, false); assert.equal(seen.length, 2); assert.equal(rpc.buffer, '');
});

test('rejects an oversized incomplete partial frame and rejects oversized outbound sends', () => {
  const { rpc, child, MAX_INBOUND_FRAME_BYTES, MAX_OUTBOUND_FRAME_BYTES } = startRpc();
  let fault;
  rpc.on('fault', error => { fault = error; });
  const partial = 'x'.repeat(MAX_INBOUND_FRAME_BYTES + 1);
  child.stdout.emit('data', partial);
  assert.equal(Buffer.byteLength(partial), MAX_INBOUND_FRAME_BYTES + 1);
  assert.equal(fault?.message, 'app_server_frame_limit'); assert.equal(rpc.pending.size, 0);
  const outbound = startRpc();
  const message = { params: { text: 'x'.repeat(MAX_OUTBOUND_FRAME_BYTES) } };
  const line = JSON.stringify(message) + '\n';
  assert.ok(Buffer.byteLength(line) > MAX_OUTBOUND_FRAME_BYTES);
  assert.throws(() => outbound.rpc.send(message), /app_server_frame_limit/);
  assert.deepEqual(outbound.child.stdin.writes, []);
});

test('measures incomplete multibyte UTF-8 data by bytes, not UTF-16 code units', () => {
  const { rpc, child, MAX_INBOUND_FRAME_BYTES } = startRpc();
  const partial = '€'.repeat(Math.ceil((MAX_INBOUND_FRAME_BYTES + 1) / Buffer.byteLength('€')));
  let fault;
  rpc.on('fault', error => { fault = error; }); child.stdout.emit('data', partial);
  assert.ok(partial.length < MAX_INBOUND_FRAME_BYTES);
  assert.ok(Buffer.byteLength(partial) > MAX_INBOUND_FRAME_BYTES);
  assert.equal(fault?.message, 'app_server_frame_limit');
});

test('rejects invalid JSON without emitting a message', async () => {
  const { rpc, child } = startRpc();
  const seen = []; let fault;
  rpc.on('message', message => seen.push(message)); rpc.on('fault', error => { fault = error; });
  child.stdout.emit('data', '{not json}\n'); await afterMessages();
  assert.equal(fault?.message, 'app_server_invalid_json'); assert.deepEqual(seen, []);
});

test('retains request timeout, classified remote errors, and pending cleanup', async () => {
  const timeout = startRpc();
  await assert.rejects(timeout.rpc.request('deadline', {}, 5), /app_server_timeout:deadline/);
  assert.equal(timeout.rpc.pending.size, 0);

  const rejected = startRpc();
  const pending = rejected.rpc.request('initialize', {}, 1000);
  const sent = JSON.parse(rejected.child.stdin.writes[0]);
  rejected.child.stdout.emit('data', JSON.stringify({ id: sent.id, error: { message: 'authentication required PRIVATE_DIAGNOSTIC' } }) + '\n');
  await assert.rejects(pending, error => error.message === 'worker_authentication_required' && error.remoteRejected === true);
  assert.equal(rejected.rpc.pending.size, 0);

  const failed = startRpc();
  const waiting = failed.rpc.request('pending', {}, 1000);
  failed.child.stdout.emit('data', 'x'.repeat(failed.MAX_INBOUND_FRAME_BYTES + 1));
  await assert.rejects(waiting, /app_server_frame_limit/);
  assert.equal(failed.rpc.pending.size, 0);
});
