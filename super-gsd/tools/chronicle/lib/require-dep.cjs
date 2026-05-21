'use strict';

const path = require('path');

const CHRONICLE_DIR = path.resolve(__dirname, '..');

function buildCandidatePaths(name, repoRoot) {
  const fromTool = [
    path.resolve(CHRONICLE_DIR, '..', 'plan-schema', 'node_modules', name),
    path.resolve(CHRONICLE_DIR, 'node_modules', name),
  ];
  const fromRepo = repoRoot
    ? [
        path.join(repoRoot, 'super-gsd', 'tools', 'plan-schema', 'node_modules', name),
        path.join(repoRoot, 'super-gsd', 'node_modules', name),
        path.join(repoRoot, 'node_modules', name),
      ]
    : [];
  return [...fromTool, ...fromRepo, name];
}

function requireDependency(name, opts = {}) {
  const { repoRoot, strict = true } = opts;
  const candidates = buildCandidatePaths(name, repoRoot);
  const failures = [];
  for (const candidate of candidates) {
    try {
      const mod = require(candidate);
      return mod && mod.default ? mod.default : mod;
    } catch (error) {
      failures.push(`${candidate}: ${error.message}`);
    }
  }
  if (strict) {
    throw new Error(`Unable to load dependency "${name}". Tried: ${failures.join('; ')}`);
  }
  return null;
}

module.exports = {
  requireDependency,
  buildCandidatePaths,
};
