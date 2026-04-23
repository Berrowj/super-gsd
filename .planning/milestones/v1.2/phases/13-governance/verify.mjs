#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
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

function parseFrontmatter(rel) {
  const src = read(rel);
  const match = src.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`missing frontmatter in ${rel}`);
  return yaml.load(match[1]);
}

// Invariant 1: board-members.yaml parses as valid YAML
let boardDoc;
try {
  boardDoc = yaml.load(read('super-gsd/registry/board-members.yaml'));
} catch (error) {
  fail(1, error.message);
}

// Invariant 2: board version + active states
try {
  assert.equal(boardDoc.board_version, 'v2-runtime-resolved');
  assert.ok(boardDoc.board_members.every((member) => member.state === 'active'));
} catch (error) {
  fail(2, error.message);
}

// Invariant 3: escalation policy parses through vote-predicate
try {
  const { evalVotePredicate } = require(path.join(repoRoot, 'super-gsd/scripts/lib/vote-predicate.cjs'));
  assert.ok(Array.isArray(boardDoc.escalation_policy.default_minimal_board));
  assert.ok(boardDoc.escalation_policy.default_minimal_board.length >= 2);
  assert.ok(Array.isArray(boardDoc.escalation_policy.escalate_add));
  assert.ok(boardDoc.escalation_policy.escalate_add.length >= 1);
  for (const clause of boardDoc.escalation_policy.escalate_add) {
    evalVotePredicate(clause.when || clause.trigger, {
      members: [{ role: 'Contrarian', position: 'OPPOSE', confidence: 5 }],
      board: ['sgsd-board-architect', 'sgsd-board-contrarian'],
    });
  }
} catch (error) {
  fail(3, error.message);
}

// Invariant 4: board-registry exports
try {
  const mod = require(path.join(repoRoot, 'super-gsd/scripts/lib/board-registry.cjs'));
  for (const key of ['loadBoard', 'getMember', 'resolveRoster', 'resetCache']) {
    assert.equal(typeof mod[key], 'function');
  }
} catch (error) {
  fail(4, error.message);
}

// Invariant 5: resolveRoster minimal path
try {
  const reg = require(path.join(repoRoot, 'super-gsd/scripts/lib/board-registry.cjs'));
  reg.resetCache();
  const roster = new Set(reg.resolveRoster({}));
  assert.ok(roster.has('sgsd-board-architect'));
  assert.ok(roster.has('sgsd-board-contrarian'));
  assert.ok(roster.has('sgsd-ceo'));
} catch (error) {
  fail(5, error.message);
}

// Invariant 6: vote-synthesis main fixture
try {
  const { synthesize } = require(path.join(repoRoot, 'super-gsd/scripts/lib/vote-synthesis.cjs'));
  const result = synthesize([
    { role: 'Architect', position: 'SUPPORT', confidence: 3 },
    { role: 'Contrarian', position: 'OPPOSE', confidence: 2 },
    { role: 'Moonshot', position: 'OPPOSE', confidence: 3 },
    { role: 'Pragmatist', position: 'SUPPORT', confidence: 4 },
  ]);
  assert.equal(result.decision, 'SUPPORT');
  assert.equal(result.sum, 2);
  assert.equal(result.tiebreaker_applied, false);
} catch (error) {
  fail(6, error.message);
}

// Invariant 7: vote-synthesis tie fixture
try {
  const { synthesize } = require(path.join(repoRoot, 'super-gsd/scripts/lib/vote-synthesis.cjs'));
  const result = synthesize([
    { role: 'A', position: 'SUPPORT', confidence: 3 },
    { role: 'B', position: 'OPPOSE', confidence: 3 },
  ]);
  assert.equal(result.decision, 'TIE');
  assert.equal(result.tiebreaker_applied, true);
} catch (error) {
  fail(7, error.message);
}

// Invariant 8: deliberation schema validates good/bad fixtures
try {
  const { validate } = require(path.join(repoRoot, 'super-gsd/scripts/lib/deliberation-schema.cjs'));
  const good = validate(
    'position: SUPPORT\nconfidence: 3\nrisks_raised: [risk1]\nevidence_cited: [ev1]\nfalsifier: would prove wrong\nimplementation_concerns: [conc1]\nknown_deadends: [dead1]\nintuition: gut\nwhy_principled: principle\nrationale: because'
  );
  assert.equal(good.valid, true);
  const bad = validate(
    'position: SUPPORT\nconfidence: 3\nrisks_raised: [risk1]\nevidence_cited: [ev1]\nimplementation_concerns: [conc1]\nknown_deadends: [dead1]\nintuition: gut\nwhy_principled: principle\nrationale: because'
  );
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.some((error) => error.includes('falsifier')));
} catch (error) {
  fail(8, error.message);
}

// Invariant 9: all board agents contain 10 fields
try {
  const agentFiles = [
    'super-gsd/agents/sgsd-board-architect.md',
    'super-gsd/agents/sgsd-board-contrarian.md',
    'super-gsd/agents/sgsd-board-pragmatist.md',
    'super-gsd/agents/sgsd-board-moonshot.md',
  ];
  const fields = [
    'position',
    'confidence',
    'risks_raised',
    'evidence_cited',
    'falsifier',
    'implementation_concerns',
    'known_deadends',
    'intuition',
    'why_principled',
    'rationale',
  ];
  for (const file of agentFiles) {
    const src = read(file);
    for (const field of fields) assert.ok(src.includes(field), `${file} missing ${field}`);
  }
} catch (error) {
  fail(9, error.message);
}

// Invariant 10: decision memo template sections
try {
  const src = read('super-gsd/templates/decision-memo.md');
  for (const header of ['## Falsifier', '## Dead Ends / Paths Ruled Out', '## Post-Synthesis Reflection']) {
    assert.ok(src.includes(header), `missing ${header}`);
  }
} catch (error) {
  fail(10, error.message);
}

// Invariant 11: complete-milestone skill frontmatter
try {
  assert.ok(exists('super-gsd/skills/sgsd-complete-milestone/SKILL.md'));
  const src = read('super-gsd/skills/sgsd-complete-milestone/SKILL.md');
  assert.ok(src.includes('name: sgsd-complete-milestone'));
  assert.ok(src.includes('mcp__vtp-kb__vtp_ingest_research'));
} catch (error) {
  fail(11, error.message);
}

// Invariant 12: orchestrate auto-trigger marker
try {
  const src = read('super-gsd/skills/sgsd-orchestrate/SKILL.md');
  assert.ok(src.includes('all milestone phases') || src.includes('6.7. MILESTONE COMPLETE AUTO-TRIGGER'));
} catch (error) {
  fail(12, error.message);
}

// Invariant 13: complete-milestone tier labels
try {
  const src = read('super-gsd/skills/sgsd-complete-milestone/SKILL.md');
  assert.ok(src.includes('tier-1'));
  assert.ok(src.includes('tier-2'));
  assert.ok(src.includes('tier-3'));
} catch (error) {
  fail(13, error.message);
}

// Invariant 14: all DLB RESCORE files exist and parse
try {
  for (const id of ['01', '02', '03', '04', '05', '06']) {
    const rel = `.planning/decisions/DLB-${id}-RESCORE.md`;
    assert.ok(exists(rel), `missing ${rel}`);
    const fm = parseFrontmatter(rel);
    assert.ok(Object.prototype.hasOwnProperty.call(fm, 'original_vote'));
    assert.ok(Object.prototype.hasOwnProperty.call(fm, 'original_decision'));
    assert.ok(Object.prototype.hasOwnProperty.call(fm, 'rescored'));
    assert.ok(Object.prototype.hasOwnProperty.call(fm.rescored, 'signed_sum'));
    assert.ok(Object.prototype.hasOwnProperty.call(fm.rescored, 'new_decision'));
    assert.ok(Object.prototype.hasOwnProperty.call(fm, 'diverges_from_original'));
  }
} catch (error) {
  fail(14, error.message);
}

// Invariant 15: deliberate skill references all 3 modules
try {
  const src = read('super-gsd/skills/sgsd-deliberate/SKILL.md');
  for (const ref of ['board-registry', 'vote-synthesis', 'deliberation-schema']) {
    assert.ok(src.includes(ref), `missing ${ref}`);
  }
} catch (error) {
  fail(15, error.message);
}

// Invariant 16: complete-milestone step tags
try {
  const src = read('super-gsd/skills/sgsd-complete-milestone/SKILL.md');
  for (const tag of [
    '<step_0_precondition>',
    '<step_1_governance_audit>',
    '<step_2_muda_recurrence>',
    '<step_3_gate_drift>',
    '<step_4_cross_phase_check>',
    '<step_5_summary>',
    '<step_6_vtp_bidirectional>',
    '<step_7_archive>',
    '<step_8_state_bump>',
  ]) {
    assert.ok(src.includes(tag), `missing ${tag}`);
  }
} catch (error) {
  fail(16, error.message);
}

console.log('PASS Phase 13 (16/16 invariants green)');
process.exit(0);
