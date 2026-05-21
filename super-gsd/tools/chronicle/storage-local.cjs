#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableValue(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function canonicalJson(value, spaces = 2) {
  return JSON.stringify(stableValue(value), null, spaces);
}

function contentHashFor(bundle) {
  const payload = {
    chronicle_context: bundle.chronicle_context,
    chronicle_html: bundle.chronicle_html,
    manifest: bundle.manifest,
  };
  return crypto.createHash('sha256').update(canonicalJson(payload, 0), 'utf8').digest('hex');
}

function atomicWrite(filePath, content) {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function publish(bundle, opts = {}) {
  const localRoot = opts.localRoot || path.join('.planning', 'chronicles');
  const contentHash = opts.content_hash || opts.contentHash || contentHashFor(bundle);
  const phaseDir = path.join(localRoot, String(bundle.milestone_id), `P${String(bundle.phase_id)}`);

  fs.mkdirSync(phaseDir, { recursive: true });

  const paths = {
    context: path.join(phaseDir, 'chronicle-context.json'),
    html: path.join(phaseDir, 'chronicle.html'),
    manifest: path.join(phaseDir, 'manifest.json'),
    content_hash: path.join(phaseDir, 'content-hash.txt'),
  };

  atomicWrite(paths.context, `${canonicalJson(bundle.chronicle_context, 2)}\n`);
  atomicWrite(paths.html, bundle.chronicle_html);
  atomicWrite(paths.manifest, `${canonicalJson(bundle.manifest, 2)}\n`);
  atomicWrite(paths.content_hash, `${contentHash}\n`);

  return {
    ok: true,
    location: phaseDir,
    paths,
    content_hash: contentHash,
  };
}

module.exports = {
  atomicWrite,
  canonicalJson,
  contentHashFor,
  publish,
  stableValue,
};
