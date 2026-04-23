#!/usr/bin/env node
// @sgsd/phase-14 verify — codex-cli-provider-substrate invariants.
//
// Six invariants per CONTEXT D-23:
//   1. super-gsd/scripts/codex-exec.sh exists, chmod +x, bash -n exits 0.
//   2. super-gsd/registry/review-providers.yaml parses; both providers state:active.
//   3. super-gsd/registry/gates.yaml rows per-dispatch-ATC and phase-level-ATC
//      both carry reviewer_provider: claude-sonnet-reviewer.
//   4. super-gsd/agents/sgsd-codex-reviewer.md + sgsd-code-reviewer.md both
//      exist with the required frontmatter keys (P3 sibling-assertion).
//   5. .planning/config.json has review_providers.codex_enabled === false.
//   6. node super-gsd/tools/provider-contract/contract-check.mjs exits 0 on
//      committed fixtures. Soft-fail: if a .MISSING sentinel is present (D-17),
//      log WARN and still PASS (Phase 14 success does not require both CLIs).
//
// Exit 0 = PROVEN; exit <n> = invariant n failed (matches phase-13 pattern).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repoRoot = process.cwd();

const yamlLibPath = path.resolve(repoRoot, 'super-gsd/tools/plan-schema/node_modules/js-yaml');
const yaml = require(yamlLibPath);

const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(repoRoot, rel));
const fail = (n, msg) => {
  console.error(`FAIL inv${n}: ${msg}`);
  process.exit(n);
};
const warn = (msg) => console.error(`WARN: ${msg}`);

function parseFrontmatter(rel) {
  const src = read(rel);
  const match = src.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`missing frontmatter in ${rel}`);
  return yaml.load(match[1]);
}

// ── Invariant 1: codex-exec.sh exists + is executable + parses ──────────────
try {
  const rel = 'super-gsd/scripts/codex-exec.sh';
  if (!exists(rel)) throw new Error(`${rel} missing`);
  const abs = path.join(repoRoot, rel);
  const stat = fs.statSync(abs);
  // On Windows, the executable bit isn't meaningful — presence of the file is
  // what git records via `chmod +x` (mode 100755 vs 100644). Read from git.
  const gitMode = execSync(`git ls-files -s "${rel}"`, { encoding: 'utf8', cwd: repoRoot }).split(/\s+/)[0];
  if (gitMode !== '100755') throw new Error(`${rel} not committed with +x (git mode ${gitMode})`);
  const parse = spawnSync('bash', ['-n', abs], { encoding: 'utf8' });
  if (parse.status !== 0) throw new Error(`bash -n failed: ${parse.stderr}`);
} catch (error) {
  fail(1, error.message);
}

// ── Invariant 2: review-providers.yaml parses; both providers state:active ──
try {
  const doc = yaml.load(read('super-gsd/registry/review-providers.yaml'));
  if (!doc || !Array.isArray(doc.providers)) throw new Error('providers list missing');
  const names = doc.providers.map((p) => p.name);
  if (!names.includes('claude-sonnet-reviewer')) throw new Error('claude-sonnet-reviewer missing');
  if (!names.includes('codex-cli-reviewer'))     throw new Error('codex-cli-reviewer missing');
  for (const p of doc.providers) {
    if (p.state !== 'active') throw new Error(`${p.name} state=${p.state}, expected active`);
    if (p.report_contract !== 'code-reviewer-v1') throw new Error(`${p.name} report_contract=${p.report_contract}, expected code-reviewer-v1`);
  }
} catch (error) {
  fail(2, error.message);
}

// ── Invariant 3: gates.yaml rows carry reviewer_provider ────────────────────
try {
  const doc = yaml.load(read('super-gsd/registry/gates.yaml'));
  const byName = Object.fromEntries(doc.gates.map((g) => [g.name, g]));
  for (const name of ['per-dispatch-ATC', 'phase-level-ATC']) {
    const g = byName[name];
    if (!g) throw new Error(`gate row ${name} missing`);
    if (g.reviewer_provider !== 'claude-sonnet-reviewer') {
      throw new Error(`gate ${name} reviewer_provider=${g.reviewer_provider}, expected claude-sonnet-reviewer`);
    }
  }
} catch (error) {
  fail(3, error.message);
}

// ── Invariant 4: both reviewer agent stubs exist with required frontmatter ──
try {
  const required = ['name', 'invocation', 'report_contract'];
  for (const rel of [
    'super-gsd/agents/sgsd-codex-reviewer.md',
    'super-gsd/agents/sgsd-code-reviewer.md',
  ]) {
    if (!exists(rel)) throw new Error(`${rel} missing`);
    const fm = parseFrontmatter(rel);
    for (const key of required) {
      if (!(key in fm)) throw new Error(`${rel} frontmatter missing ${key}`);
    }
    if (fm.report_contract !== 'code-reviewer-v1') {
      throw new Error(`${rel} report_contract=${fm.report_contract}, expected code-reviewer-v1`);
    }
  }
  // Invocation-type split (P3 + CONTEXT D-12a)
  const codex = parseFrontmatter('super-gsd/agents/sgsd-codex-reviewer.md');
  const claude = parseFrontmatter('super-gsd/agents/sgsd-code-reviewer.md');
  if (codex.invocation !== 'shell') throw new Error(`codex reviewer invocation=${codex.invocation}, expected shell`);
  if (claude.invocation !== 'agent') throw new Error(`claude reviewer invocation=${claude.invocation}, expected agent`);
} catch (error) {
  fail(4, error.message);
}

// ── Invariant 5: .planning/config.json review_providers.codex_enabled=false ─
try {
  const cfg = JSON.parse(read('.planning/config.json'));
  if (!cfg.review_providers) throw new Error('review_providers block missing');
  if (cfg.review_providers.codex_enabled !== false) {
    throw new Error(`codex_enabled=${cfg.review_providers.codex_enabled}, expected false`);
  }
  if (cfg.review_providers.default_provider !== 'claude-sonnet-reviewer') {
    throw new Error(`default_provider=${cfg.review_providers.default_provider}, expected claude-sonnet-reviewer`);
  }
} catch (error) {
  fail(5, error.message);
}

// ── Invariant 6: contract-check.mjs exits 0 on committed fixtures (or WARN on .MISSING sentinel) ──
try {
  const claudeReport = 'super-gsd/tools/provider-contract/fixtures/claude-report.txt';
  const codexReport = 'super-gsd/tools/provider-contract/fixtures/codex-report.txt';
  const claudeSentinel = exists(`${claudeReport}.MISSING`);
  const codexSentinel = exists(`${codexReport}.MISSING`);

  if (claudeSentinel || codexSentinel) {
    warn(`invariant 6 soft-fail (D-17): ${claudeSentinel ? 'claude' : ''}${claudeSentinel && codexSentinel ? '+' : ''}${codexSentinel ? 'codex' : ''} .MISSING sentinel present — accepting PASS per D-17`);
  } else {
    const harness = path.join(repoRoot, 'super-gsd/tools/provider-contract/contract-check.mjs');
    if (!exists('super-gsd/tools/provider-contract/contract-check.mjs')) {
      throw new Error('contract-check.mjs missing');
    }
    const run = spawnSync('node', [harness], { encoding: 'utf8', cwd: repoRoot });
    if (run.status !== 0) {
      throw new Error(`contract-check.mjs exited ${run.status}; stderr: ${(run.stderr || '').slice(0, 300)}`);
    }
  }
} catch (error) {
  fail(6, error.message);
}

console.log('PASS Phase 14 (6/6 invariants green)');
process.exit(0);
