'use strict';

// ============================================================================
// SGSD - REPAIR-COMMAND-CHECKER
// ============================================================================
// Phase 33 (REPAIR-01..04). Validates `repair_command:` strings in
// gates.yaml against the DISCUSS 26.3 4-AND safety predicate:
//
//   deterministic AND safe AND local AND auth-free
//
// Implementation: 4 frozen regex deny-lists. Any match in any list = the
// command violates that predicate. ANY violation = command rejected.
//
// Public API never throws upward (mirrors super-gsd/scripts/lib/route-ledger.cjs
// LOCKED design from 32-RESEARCH section 9.3). Internal helpers throw on
// closed-enum violations; the public-API try/catch wraps every call and
// returns a structured {ok, violations} result instead.
//
// Integration: super-gsd/scripts/lib/gates-registry.cjs:53 calls
// validateRepairCommands(parsed) at LOAD time. On {ok:false}, gates-registry
// throws -- a poisoned registry halts orchestrator startup.
//
// Reason codes (from super-gsd/registry/command-envelope-v1.yaml:204-212):
//   repair_instruction_only       -- gate ships text only
//   repair_command_eligible       -- gate ships command and 4-AND passes
//   repair_command_rejected_by_4and -- gate ships command and 4-AND fails
// ============================================================================

const fs   = require('fs');
const path = require('path');

// ----------------------------------------------------------------------------
// Frozen closed enum: the 4 AND clauses. Ordering matters for stable output.
// ----------------------------------------------------------------------------
const PREDICATES = Object.freeze(['deterministic', 'safe', 'local', 'auth-free']);

// ----------------------------------------------------------------------------
// 4-AND DENY-LISTS (per RESEARCH section 4, all 4 sub-sections verbatim).
// Any regex match in ANY list flags that predicate as failed.
// ----------------------------------------------------------------------------
const DETERMINISTIC_DENYLIST = [
  /\$\(date[^)]*\)/i,             // $(date), $(date +%s)
  /\$RANDOM\b/,                    // $RANDOM
  /Date\.now\(\)/,                 // Date.now()
  /Math\.random\(\)/,              // Math.random()
  /\bcurl\b/i,                     // curl (network = non-deterministic)
  /\bwget\b/i,                     // wget
  /\bgh\b\s+(?!auth\s+status)/,    // gh hits remote (gh auth status exempt; A3)
  /\bopenssl\s+rand\b/,            // openssl rand
  /\/dev\/u?random\b/,             // /dev/random, /dev/urandom
  /--seed=\$\(/,                   // dynamic seed
  /\bdate\s+\+/,                   // date +<format>
];

const SAFE_DENYLIST = [
  /\brm\s+-r?f\b/,                 // rm -rf, rm -f
  /\brm\s+-f?r\b/,                 // rm -fr
  /\bDROP\s+TABLE\b/i,             // SQL DROP
  /\bDELETE\s+FROM\b/i,            // SQL DELETE
  /\bTRUNCATE\b/i,
  /\bgit\s+push\b/i,               // including --force (DISCUSS verbatim)
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-f/i,
  /\b--force\b/i,                  // generic --force flag (DISCUSS verbatim)
  /\b-f\s+\//,                     // -f against absolute root path
  /\s>\s*\//,                      // redirect to absolute path
  /\s>>\s*\//,                     // append-redirect to absolute path
  /\bsudo\b/,                      // sudo escalates outside tree
  /\bchmod\s+(?:777|\+x\s+\/)/,    // chmod 777, chmod +x against /
  /\bdd\s+if=/,                    // dd commands
  /\bmkfs\b/,                      // mkfs
  /\b:\(\)\s*\{\s*:\|/,            // fork bomb
  /\bnpm\s+install\b/,             // npm install mutates node_modules outside tree-control
];

const LOCAL_DENYLIST = [
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bssh\b/i,
  /\bscp\b/i,
  /\brsync\s+[^\s]+:/,             // rsync host:path = remote
  /\bkubectl\b/i,
  /\bdocker\s+(push|pull|run\s+--network)/i,
  /\bgh\b\s+(?!auth\s+status)/,    // gh almost always remote
  /\baws\b\s+(?!sts\s+get-caller-identity)/i,
  /\bhttps?:\/\//i,                // any URL literal
  /:\/\/[^\s\/]+/,                 // generic protocol://host
  /\bnetcat\b|\bnc\s+-/,           // netcat probes
  /\bping\b/i,                     // ICMP
  /\bnpm\s+(install|publish|adduser)/,
  /\bpip\s+(install|upload)/,
];

const AUTH_FREE_DENYLIST = [
  /\$OPENAI_API_KEY/,
  /\$CODEX_API_KEY/,
  /\$ANTHROPIC_API_KEY/,
  /\$GH_TOKEN\b/,
  /\$GITHUB_TOKEN/,
  /\$AWS_(ACCESS_KEY|SECRET)/,
  /\bgh\s+auth\b/,                 // gh auth login/logout/refresh
  /\baws\s+sts\b/,
  /\bkubectl\s+(--token|--kubeconfig=\/)/,
  /\bvault\s+(login|read)\b/i,
  /\boauth\b/i,
  /\bbasic\s+auth\b/i,
  /\b--header\s+["']?Authorization/i,
  /\b-H\s+["']?Authorization/i,
];

const DENYLISTS = Object.freeze({
  deterministic: DETERMINISTIC_DENYLIST,
  safe: SAFE_DENYLIST,
  local: LOCAL_DENYLIST,
  auth_free: AUTH_FREE_DENYLIST,
});

// Map auth_free key <-> 'auth-free' predicate name.
const PREDICATE_KEY = Object.freeze({
  deterministic: 'deterministic',
  safe: 'safe',
  local: 'local',
  auth_free: 'auth-free',
});

// ----------------------------------------------------------------------------
// validateOneCommand(cmdString) -> {ok, failed_predicates, matches}
// ----------------------------------------------------------------------------
function validateOneCommand(cmd) {
  if (typeof cmd !== 'string') {
    throw new Error('repair-command-checker: command must be a string');
  }
  const failed = [];
  const matches = [];
  for (const key of Object.keys(DENYLISTS)) {
    const list = DENYLISTS[key];
    for (const rx of list) {
      const m = cmd.match(rx);
      if (m) {
        const pred = PREDICATE_KEY[key];
        if (!failed.includes(pred)) failed.push(pred);
        matches.push({ predicate: pred, pattern: rx.source, match: m[0] });
      }
    }
  }
  return { ok: failed.length === 0, failed_predicates: failed, matches };
}

// ----------------------------------------------------------------------------
// validateRepairCommands(parsedYaml) -> {ok, total_commands_checked, total_violations, violations}
// ----------------------------------------------------------------------------
function validateRepairCommands(parsedYaml) {
  if (!parsedYaml || !Array.isArray(parsedYaml.gates)) {
    return { ok: true, total_commands_checked: 0, total_violations: 0, violations: [] };
  }
  const violations = [];
  let checked = 0;
  for (const g of parsedYaml.gates) {
    if (!g || typeof g.repair_command !== 'string' || !g.repair_command.trim()) continue;
    checked++;
    const r = validateOneCommand(g.repair_command);
    if (!r.ok) {
      violations.push({
        gate: g.name || '<unnamed>',
        command: g.repair_command,
        failed_predicates: r.failed_predicates,
        matches: r.matches,
        message:
          `gate '${g.name || '<unnamed>'}' repair_command failed 4-AND predicate(s): ` +
          `${r.failed_predicates.join(', ')} (matched: ` +
          `${r.matches.map((m) => `'${m.match}'`).join(', ')})`,
      });
    }
  }
  return {
    ok: violations.length === 0,
    total_commands_checked: checked,
    total_violations: violations.length,
    violations,
  };
}

// ----------------------------------------------------------------------------
// validateGatesYaml(yamlPath) -> read+parse+validate. Convenience.
// ----------------------------------------------------------------------------
function validateGatesYaml(yamlPath) {
  const yamlLibPath = path.resolve(
    __dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml'
  );
  const yaml = require(yamlLibPath);
  const raw = fs.readFileSync(yamlPath, 'utf8');
  const parsed = yaml.load(raw);
  return validateRepairCommands(parsed);
}

// ----------------------------------------------------------------------------
// assertEveryBlockingGateHasInstruction(parsed) -> {ok, missing}
// "blocking" = enforcement_mode is hard-halt OR amortized OR
// (soft-warn with escalation: block_on_api_error). REPAIR-01 strict reading.
// ----------------------------------------------------------------------------
function assertEveryBlockingGateHasInstruction(parsedYaml) {
  if (!parsedYaml || !Array.isArray(parsedYaml.gates)) {
    return { ok: true, missing: [] };
  }
  const missing = [];
  for (const g of parsedYaml.gates) {
    if (!g) continue;
    const blocking =
      g.enforcement_mode === 'hard-halt' ||
      g.enforcement_mode === 'amortized' ||
      (g.enforcement_mode === 'soft-warn' && g.escalation === 'block_on_api_error');
    if (!blocking) continue;
    if (typeof g.repair_instruction !== 'string' || !g.repair_instruction.trim()) {
      missing.push(g.name || '<unnamed>');
    }
  }
  return { ok: missing.length === 0, missing };
}

// ----------------------------------------------------------------------------
// repairInstructionForBacklogRow(row, gatesYamlPath) -> string
// Mission Strip Q4 helper. Returns the gate's repair_instruction or ''.
// Public API never throws upward; on lookup failure returns ''.
// ----------------------------------------------------------------------------
function repairInstructionForBacklogRow(row, gatesYamlPath) {
  try {
    if (!row || typeof row !== 'object') return '';
    let gateName = null;
    if (typeof row.gate === 'string') gateName = row.gate;
    if (!gateName && typeof row.evidence_path === 'string') {
      const m = row.evidence_path.match(/gate=([A-Za-z0-9_-]+)/);
      if (m) gateName = m[1];
      else if (/commit-reviews\.jsonl$/.test(row.evidence_path)) gateName = 'per-dispatch-ATC';
      else if (/ATC-REVIEW\.md$/.test(row.evidence_path)) gateName = 'phase-level-ATC';
      else if (/WASTE\.md$/.test(row.evidence_path)) gateName = 'MUDA-waste-audit';
    }
    if (!gateName) return '';
    const yamlLibPath = path.resolve(
      __dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml'
    );
    const yaml = require(yamlLibPath);
    const raw = fs.readFileSync(gatesYamlPath, 'utf8');
    const parsed = yaml.load(raw);
    const gates = (parsed && Array.isArray(parsed.gates)) ? parsed.gates : [];
    const g = gates.find((x) => x && x.name === gateName);
    if (!g || typeof g.repair_instruction !== 'string') return '';
    return g.repair_instruction;
  } catch (e) {
    console.warn('[SGSD] repair-command-checker repairInstructionForBacklogRow failed:', e.message);
    return '';
  }
}

// ----------------------------------------------------------------------------
// unresolvedRepairsForMilestone(planningDir, milestone, gatesYamlPath)
// Used by sgsd-complete-milestone Step 6. Joins crit-backlog rows for the
// milestone to gates.yaml repair_instruction. Public API; never throws.
// ----------------------------------------------------------------------------
function unresolvedRepairsForMilestone(planningDir, milestone, gatesYamlPath) {
  try {
    const cb = require('./crit-backlog.cjs');
    const rows = (typeof cb.rowsForMilestone === 'function')
      ? cb.rowsForMilestone(planningDir, milestone)
      : [];
    const out = [];
    for (const r of rows) {
      if (r && r.kind === 'cleared') continue;
      const text = repairInstructionForBacklogRow(r, gatesYamlPath);
      out.push({
        backlog_id: r.id || null,
        gate: r.gate || null,
        summary: (r.summary || '').slice(0, 120),
        repair_instruction: text || '',
      });
    }
    return out;
  } catch (e) {
    console.warn('[SGSD] repair-command-checker unresolvedRepairsForMilestone failed:', e.message);
    return [];
  }
}

// ----------------------------------------------------------------------------
// --self-test (14 assertions + fingerprint guard).
// ----------------------------------------------------------------------------
function selfTest() {
  let pass = 0, fail = 0;
  const failures = [];
  const assert = (name, cond, detail) => {
    if (cond) { pass++; }
    else { fail++; failures.push({ name, detail: detail || '' }); }
  };

  // Fingerprint guard: canonical gates.yaml mtime/size unchanged.
  // Anchor to __dirname (lib lives at <repo>/super-gsd/scripts/lib/...; canonical
  // gates.yaml at <repo>/super-gsd/registry/gates.yaml -- 2 dirs up + registry).
  const realGates = path.resolve(__dirname, '..', '..', 'registry', 'gates.yaml');
  const realExistedBefore = fs.existsSync(realGates);
  const realMtimeBefore = realExistedBefore ? fs.statSync(realGates).mtimeMs : 0;
  const realSizeBefore = realExistedBefore ? fs.statSync(realGates).size : 0;

  // 1. PREDICATES is exactly the 4-AND set.
  assert('1. PREDICATES is frozen [deterministic, safe, local, auth-free]',
    Array.isArray(PREDICATES) && PREDICATES.length === 4 &&
    PREDICATES[0] === 'deterministic' && PREDICATES[1] === 'safe' &&
    PREDICATES[2] === 'local' && PREDICATES[3] === 'auth-free' &&
    Object.isFrozen(PREDICATES));

  // 2. DENYLISTS has 4 keys, each non-empty array of RegExp.
  assert('2. DENYLISTS has 4 keys each non-empty RegExp[]',
    DENYLISTS && Object.keys(DENYLISTS).length === 4 &&
    Object.keys(DENYLISTS).every((k) =>
      Array.isArray(DENYLISTS[k]) && DENYLISTS[k].length > 0 &&
      DENYLISTS[k].every((r) => r instanceof RegExp)));

  // 3. Positive control: ROADMAP-locked accept fixture.
  const r3 = validateOneCommand('node super-gsd/tools/system-map/generate.cjs');
  assert('3. node ./tools/system-map/generate.cjs accepted',
    r3.ok === true && r3.failed_predicates.length === 0,
    JSON.stringify(r3));

  // 4. Negative control: ROADMAP-locked reject fixture.
  const r4 = validateOneCommand('rm -rf /');
  assert('4. rm -rf / rejected; failed_predicates includes safe',
    r4.ok === false && r4.failed_predicates.includes('safe'),
    JSON.stringify(r4));

  // 5. Network reject (curl).
  const r5 = validateOneCommand('curl https://example.com/x');
  assert('5. curl rejected; failed_predicates includes local',
    r5.ok === false && r5.failed_predicates.includes('local'),
    JSON.stringify(r5));

  // 6. Auth reject.
  const r6 = validateOneCommand('gh auth login');
  assert('6. gh auth login rejected; failed_predicates includes auth-free',
    r6.ok === false && r6.failed_predicates.includes('auth-free'),
    JSON.stringify(r6));

  // 7. Compound reject: npm install --force => safe (--force, npm install) + local (npm install).
  const r7 = validateOneCommand('npm install --force');
  assert('7. npm install --force rejected; failed_predicates includes safe AND local',
    r7.ok === false && r7.failed_predicates.includes('safe') && r7.failed_predicates.includes('local'),
    JSON.stringify(r7));

  // 8. Non-determinism reject.
  const r8 = validateOneCommand('date +%s');
  assert('8. date +%s rejected; failed_predicates includes deterministic',
    r8.ok === false && r8.failed_predicates.includes('deterministic'),
    JSON.stringify(r8));

  // 9. validateRepairCommands single-violation shape.
  const r9 = validateRepairCommands({ gates: [{ name: 'g1', repair_command: 'rm -rf /' }] });
  assert('9. validateRepairCommands fixture: 1 violation, gate=g1',
    r9.ok === false && r9.total_violations === 1 &&
    r9.violations[0].gate === 'g1' &&
    r9.violations[0].failed_predicates.includes('safe'),
    JSON.stringify(r9));

  // 10. No command = no check.
  const r10 = validateRepairCommands({ gates: [{ name: 'g1' }] });
  assert('10. gate without repair_command -> ok:true, 0 checked',
    r10.ok === true && r10.total_commands_checked === 0,
    JSON.stringify(r10));

  // 11. Instruction-only is fine (no command means no validation).
  const r11 = validateRepairCommands({ gates: [{ name: 'g1', repair_instruction: 'fix it' }] });
  assert('11. instruction-only gate ok',
    r11.ok === true && r11.total_violations === 0,
    JSON.stringify(r11));

  // 12. assertEveryBlockingGateHasInstruction missing case.
  const r12 = assertEveryBlockingGateHasInstruction({
    gates: [{ name: 'g1', enforcement_mode: 'hard-halt' }],
  });
  assert('12. blocking gate w/o instruction -> ok:false, missing:[g1]',
    r12.ok === false && r12.missing.length === 1 && r12.missing[0] === 'g1',
    JSON.stringify(r12));

  // 13. assertEveryBlockingGateHasInstruction satisfied case.
  const r13 = assertEveryBlockingGateHasInstruction({
    gates: [{ name: 'g1', enforcement_mode: 'hard-halt', repair_instruction: 'do x' }],
  });
  assert('13. blocking gate w/ instruction -> ok:true',
    r13.ok === true && r13.missing.length === 0,
    JSON.stringify(r13));

  // 14. Live check: canonical gates.yaml passes its own validator.
  let r14 = null;
  try { r14 = validateGatesYaml(realGates); } catch (e) { r14 = { ok: false, error: e.message }; }
  assert('14. canonical gates.yaml passes validateRepairCommands',
    r14 && r14.ok === true,
    JSON.stringify(r14));

  // Fingerprint guard (post-test): canonical gates.yaml untouched.
  const realExistedAfter = fs.existsSync(realGates);
  const realMtimeAfter = realExistedAfter ? fs.statSync(realGates).mtimeMs : 0;
  const realSizeAfter = realExistedAfter ? fs.statSync(realGates).size : 0;
  const fingerprintOk =
    realExistedBefore === realExistedAfter &&
    realMtimeBefore === realMtimeAfter &&
    realSizeBefore === realSizeAfter;
  if (!fingerprintOk) {
    fail++;
    failures.push({
      name: 'FINGERPRINT GUARD: canonical gates.yaml untouched',
      detail: `existed before=${realExistedBefore} after=${realExistedAfter}; mtimeBefore=${realMtimeBefore} mtimeAfter=${realMtimeAfter}; sizeBefore=${realSizeBefore} sizeAfter=${realSizeAfter}`,
    });
  }

  console.log(`repair-command-checker self-test: ${pass} pass, ${fail} fail`);
  if (fail > 0) {
    for (const f of failures) console.error(`  FAIL: ${f.name}${f.detail ? ' -- ' + f.detail : ''}`);
    return 1;
  }
  return 0;
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === '--self-test') process.exit(selfTest());
  if (cmd === '--validate') {
    const target = path.resolve(
      __dirname, '..', '..', 'registry', 'gates.yaml'
    );
    let res;
    try { res = validateGatesYaml(target); }
    catch (e) { console.error('[SGSD] --validate read/parse failed:', e.message); process.exit(1); }
    if (!res.ok) {
      console.error('[SGSD] --validate FAILED:');
      for (const v of res.violations) console.error(`  ${v.message}`);
      process.exit(1);
    }
    console.log(`[SGSD] --validate PASS: ${res.total_commands_checked} commands checked, 0 violations.`);
    process.exit(0);
  }
  if (cmd === '--validate-file') {
    const target = process.argv[3];
    if (!target) { console.error('Usage: --validate-file <path>'); process.exit(2); }
    const res = validateGatesYaml(target);
    if (!res.ok) {
      for (const v of res.violations) console.error(v.message);
      process.exit(1);
    }
    console.log(`PASS: ${res.total_commands_checked} commands checked.`);
    process.exit(0);
  }
  console.log('Usage:');
  console.log('  node repair-command-checker.cjs --self-test');
  console.log('  node repair-command-checker.cjs --validate');
  console.log('  node repair-command-checker.cjs --validate-file <path>');
  console.log('PREDICATES =', JSON.stringify(PREDICATES));
  process.exit(0);
}

module.exports = {
  PREDICATES,
  DENYLISTS,
  validateOneCommand,
  validateRepairCommands,
  validateGatesYaml,
  assertEveryBlockingGateHasInstruction,
  repairInstructionForBacklogRow,
  unresolvedRepairsForMilestone,
  selfTest,
};
