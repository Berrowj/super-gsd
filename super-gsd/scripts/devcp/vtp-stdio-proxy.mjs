#!/usr/bin/env node
// stdio <-> StreamableHTTP proxy for the laptop's VTP MCP server (:4101 via
// the ssh reverse tunnel). Replaces mcp-remote in the devcp bridge.
//
// Why not mcp-remote: it captures the bearer token into argv once at spawn.
// VTP tokens are per-tunnel-session (invalidated on every tunnel rebind), so
// any Claude Code session that outlives a rebind is stranded with permanent
// 401s until a manual /mcp reconnect. This proxy reads the token file on
// EVERY request, so a rotation between two tool calls just works. The token
// also never appears in the process list.
//
// Optional warm-up: set VTP_PROXY_WARM_TOOL (and VTP_PROXY_WARM_ARGS as JSON)
// to fire one silent tools/call after the client finishes initializing. Use a
// vector-backed tool so the embedding model loads before the first real
// query instead of eating a 120s+ cold start inside it.

import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';

const MCP_URL = new URL(process.env.VTP_MCP_URL || 'http://localhost:4101/mcp');
const TOKEN_FILE = process.env.VTP_BEARER_FILE || join(homedir(), '.vtp-bearer');
const REQUEST_TIMEOUT_MS = Number(process.env.VTP_PROXY_TIMEOUT_MS || 600000);

let sessionId = null;
let warmed = false;

const emit = (message) => process.stdout.write(JSON.stringify(message) + '\n');
const readToken = () => readFileSync(TOKEN_FILE, 'utf8').trim();

function post(message, { silent = false } = {}) {
  return new Promise((resolve, reject) => {
    let body;
    let headers;
    try {
      body = JSON.stringify(message);
      headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer ' + readToken(),
        'Content-Length': Buffer.byteLength(body),
      };
    } catch (error) {
      return reject(error);
    }
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;

    const req = httpRequest(
      {
        hostname: MCP_URL.hostname,
        port: MCP_URL.port,
        path: MCP_URL.pathname,
        method: 'POST',
        headers,
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        const sid = res.headers['mcp-session-id'];
        if (sid) sessionId = sid;
        if (res.statusCode === 401) {
          res.resume();
          return reject(new Error('upstream_401_bearer_rejected'));
        }
        if (res.statusCode >= 400) {
          res.resume();
          return reject(new Error('upstream_http_' + res.statusCode));
        }
        if (res.statusCode === 202 || res.statusCode === 204) {
          res.resume();
          return resolve();
        }
        res.setEncoding('utf8');
        const contentType = String(res.headers['content-type'] || '');
        if (contentType.includes('text/event-stream')) {
          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk;
            for (;;) {
              const boundary = buffer.search(/\r?\n\r?\n/);
              if (boundary === -1) break;
              const rawEvent = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, '');
              const data = rawEvent
                .split(/\r?\n/)
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.slice(5).trimStart())
                .join('\n');
              if (!data) continue;
              try {
                const parsed = JSON.parse(data);
                if (!silent) emit(parsed);
              } catch (_) {}
            }
          });
          res.on('end', resolve);
          res.on('error', reject);
        } else {
          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk;
          });
          res.on('end', () => {
            if (buffer.trim()) {
              try {
                const parsed = JSON.parse(buffer);
                if (!silent) emit(parsed);
              } catch (_) {}
            }
            resolve();
          });
          res.on('error', reject);
        }
      },
    );
    req.on('timeout', () => req.destroy(new Error('upstream_timeout')));
    req.on('error', reject);
    req.end(body);
  });
}

function scheduleWarmup() {
  const tool = process.env.VTP_PROXY_WARM_TOOL;
  if (!tool || warmed) return;
  warmed = true;
  let args = {};
  try {
    args = JSON.parse(process.env.VTP_PROXY_WARM_ARGS || '{}');
  } catch (_) {}
  const timer = setTimeout(() => {
    post(
      {
        jsonrpc: '2.0',
        id: 'vtp-proxy-warmup',
        method: 'tools/call',
        params: { name: tool, arguments: args },
      },
      { silent: true },
    ).catch(() => {});
  }, 2000);
  if (typeof timer.unref === 'function') timer.unref();
}

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch (_) {
    emit({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'vtp_proxy_parse_error' },
    });
    return;
  }
  if (message && message.method === 'notifications/initialized') scheduleWarmup();
  post(message).catch((error) => {
    if (message && Object.prototype.hasOwnProperty.call(message, 'id') && typeof message.method === 'string') {
      emit({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32001, message: 'vtp_proxy_upstream_failed: ' + error.message },
      });
    }
  });
});
rl.on('close', () => process.exit(0));
