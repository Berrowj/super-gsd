#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

let failures = 0;

function assert(name, condition) {
  if (condition) {
    console.log(`ok - ${name}`);
  } else {
    failures++;
    console.error(`not ok - ${name}`);
  }
}

const claude = read('CLAUDE.md');
const skill = read('super-gsd/skills/sgsd-orchestrate/SKILL.md');
const workflow = read('super-gsd/workflows/orchestrate-loop.md');
const plan = read('.planning/milestones/v2.9/phases/98-harness-component-substrate/98-10-codex-sdd-executor-contract-PLAN.md');

assert('CLAUDE names spec-compliance as Codex-owned', /spec-compliance review/.test(claude));
assert('CLAUDE requires fresh SDD implementer executor runs', /fresh subagent-driven-development implementer run/.test(claude));
assert('CLAUDE forbids parallel Codex file writers', /no\s+parallel Codex file writers/.test(claude));

assert('orchestrate skill has mandatory spec-before-ATC section', /SPEC COMPLIANCE IS MANDATORY BEFORE ATC/.test(skill));
assert('orchestrate skill defines Step 9.4', /9\.4\. SPEC COMPLIANCE REVIEW/.test(skill));
assert('orchestrate skill defines SPEC_VERDICT contract', /SPEC_VERDICT: pass\|fix_required\|blocked/.test(skill));
assert('orchestrate skill requires raw artifacts over executor summary', /must not (?:accept|rely on) the executor's own summary/.test(skill));
assert('orchestrate skill runs ATC after Step 9.4', /Runs AFTER Step 9\.4 spec compliance passes/.test(skill));

assert('workflow has Step 8.4 spec review', /Step 8\.4: Spec Compliance Review/.test(workflow));
assert('workflow marks codex-executor as serial SDD mode', /serial SDD implementer mode/.test(workflow));
assert('plan captures VTP research inputs', /AHE:/.test(plan) && /Forage V2:/.test(plan) && /HiveMind:/.test(plan));

const stalePatterns = [
  /DISPATCH: gsd-plan-checker \(Sonnet\)/,
  /DISPATCH: gsd-verifier \(Sonnet\)/,
  /fall back to Claude only/,
  /Step 2: Classify \(Haiku\)/,
  /Step 3: Select Context \(Haiku\)/,
];

assert('fresh execution docs avoid stale Sonnet/Haiku dispatch wording',
  !stalePatterns.some(re => re.test(skill) || re.test(workflow) || re.test(claude)));

if (failures) {
  console.error(`codex-sdd-contract: ${failures} assertion(s) failed`);
  process.exit(1);
}

console.log('codex-sdd-contract: PASS');
