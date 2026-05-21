#!/usr/bin/env node
'use strict';

const http = require('http');
const https = require('https');

const { contentHashFor } = require('./storage-local.cjs');

function configuredUrl(url) {
  return url || process.env.SGSD_VTP_MCP_URL || '';
}

function request(url, opts = {}) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      resolve({ ok: false, reason: `invalid_url: ${error.message}` });
      return;
    }

    const transport = parsed.protocol === 'https:' ? https : http;
    const body = opts.body ? JSON.stringify(opts.body) : undefined;
    const req = transport.request(
      parsed,
      {
        method: opts.method || 'GET',
        timeout: opts.timeoutMs || 5000,
        headers: body
          ? {
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(body),
            }
          : undefined,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 500,
            statusCode: res.statusCode,
            body: text,
            headers: res.headers,
          });
        });
      },
    );

    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (error) => {
      resolve({ ok: false, reason: error.message });
    });
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function probe(url) {
  const targetUrl = configuredUrl(url);
  if (!targetUrl) {
    return { available: false, reason: 'vtp_mcp_routing_not_yet_wired' };
  }

  return request(targetUrl, { method: 'GET', timeoutMs: 5000 }).then((result) => {
    if (!result.ok) {
      return { available: false, reason: result.reason || `http_${result.statusCode}` };
    }
    return { available: true };
  });
}

async function upsert(bundle, opts = {}) {
  const targetUrl = configuredUrl(opts.url || opts.vtpMcpUrl);
  if (!targetUrl) {
    throw new Error('vtp_stub: real wiring deferred');
  }

  const contentHash = opts.content_hash || opts.contentHash || contentHashFor(bundle);
  const result = await request(targetUrl, {
    method: 'POST',
    timeoutMs: opts.timeoutMs || 5000,
    body: {
      bundle,
      content_hash: contentHash,
    },
  });

  if (!result.ok || result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error(result.reason || `vtp_upsert_failed: http_${result.statusCode}`);
  }

  let parsed = {};
  if (result.body) {
    try {
      parsed = JSON.parse(result.body);
    } catch (_error) {
      parsed = {};
    }
  }

  return {
    ok: true,
    location: parsed.location || parsed.url || targetUrl,
    content_hash: contentHash,
    vtp_id: parsed.vtp_id || parsed.id,
  };
}

module.exports = {
  probe,
  upsert,
};
