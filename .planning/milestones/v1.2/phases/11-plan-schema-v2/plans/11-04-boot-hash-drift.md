---
phase: 11-plan-schema-v2
plan: 04
type: execute
wave: 2
depends_on:
  - "11-01"
  - "11-02"
files_modified:
  - .planning/config.json
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
autonomous: true
requirements:
  - SCHEMA-05

# v2 plan self-referential frontmatter
schema_version: 2
tasks:
  - id: t1
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/config.json
    input_contract: D-12, RESEARCH RQ-6, plan-schema-v2.json must exist (plan 01)
    output_contract: config.json gains workflow.schema_v2_hash field with correct sha256 of plan-schema-v2.json
    hypothesis: atomic hash write alongside schema creation prevents the stale-hash pitfall documented in RQ-6
    falsifier: sha256 computed from config.json does not match actual file hash at session start
    stop_rule: node -e crypto verification confirms hash matches; no drift warning fires on fresh session
  - id: t2
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
    input_contract: D-12, D-14, RESEARCH RQ-6, readiness-log.jsonl format from RQ-7
    output_contract: orchestrator cold-start gains sha256 drift check; warn + continue path emits to readiness-log.jsonl
    hypothesis: inserting drift check into existing config.json read step (Step 3) is minimal diff and non-breaking
    falsifier: orchestrator halts on drift instead of warning and continuing (D-14 non-blocking requirement)
    stop_rule: drift detection present; emit structured log row; loop continues; no halt
expected_ATC_tier: LITE
skip_gates: []
depends_on:
  - "11-01"
  - "11-02"
known_deadends:
  - "Do not use md5 or crc32 — sha256 required per D-12"
  - "Do not halt on drift — warn + continue per D-14"
  - "Do not add new npm dependency for hashing — use Node built-in crypto per RQ-6"
verification_cmd: null
lessons_path: null

must_haves:
  truths:
    - "config.json has workflow.schema_v2_hash field containing sha256 of plan-schema-v2.json"
    - "Orchestrator cold-start computes sha256 of plan-schema-v2.json and compares to config value"
    - "On drift: warn to console + append readiness-log.jsonl row; loop continues (non-blocking)"
    - "On match: no output; loop continues normally"
  artifacts:
    - path: ".planning/config.json"
      provides: "workflow.schema_v2_hash field"
      contains: "schema_v2_hash"
    - path: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      provides: "Boot-time hash drift check in cold-start"
      contains: "schema_v2_hash"
  key_links:
    - from: "sgsd-orchestrate cold-start"
      to: ".planning/metrics/readiness-log.jsonl"
      via: "node crypto.createHash + fs.appendFileSync on drift"
      pattern: "schema_pin_drift"
    - from: ".planning/config.json workflow.schema_v2_hash"
      to: "super-gsd/templates/plan-schema-v2.json"
      via: "sha256 comparison at cold-start"
      pattern: "schema_v2_hash"
---

<goal>
Wire boot-time sha256 drift detection for plan-schema-v2.json.

Purpose: Detects when the schema file drifts from the pinned hash without blocking the session. Implements D-12 (pin mechanism) and D-14 (non-blocking warn + log).
Output: config.json gains schema_v2_hash; orchestrator cold-start gains drift check using Node built-in crypto.
</goal>

<context>
@.planning/phases/11-plan-schema-v2/11-CONTEXT.md
@.planning/phases/11-plan-schema-v2/11-RESEARCH.md
@.planning/config.json
@super-gsd/skills/sgsd-orchestrate/SKILL.md
</context>

<interfaces>
<!-- Node built-in crypto — no new dependency (RQ-6) -->
const crypto = require('crypto');
const fs = require('fs');
const actual = crypto.createHash('sha256')
  .update(fs.readFileSync('super-gsd/templates/plan-schema-v2.json'))
  .digest('hex');
const expected = config.workflow.schema_v2_hash;
if (actual !== expected) {
  console.warn(`[SGSD] schema_pin_drift: expected ${expected.slice(0,8)}... actual ${actual.slice(0,8)}...`);
  fs.appendFileSync('.planning/metrics/readiness-log.jsonl',
    JSON.stringify({
      ts: new Date().toISOString(),
      type: 'schema_pin_drift',
      expected_hash: expected,
      actual_hash: actual
    }) + '\n'
  );
  // DO NOT halt — D-14: warn + continue
}

<!-- readiness-log.jsonl row shape (D-14) -->
{ "ts": "ISO-8601", "type": "schema_pin_drift", "expected_hash": "abc...", "actual_hash": "def..." }

<!-- Initial hash computation for config.json (pitfall from RQ-6) -->
Compute hash IMMEDIATELY after plan 01 writes plan-schema-v2.json:
  node -e "const c=require('crypto'),f=require('fs');
    console.log(c.createHash('sha256').update(f.readFileSync('super-gsd/templates/plan-schema-v2.json')).digest('hex'))"
Then insert that value into config.json workflow.schema_v2_hash atomically in the same commit.
This prevents the stale-hash pitfall (RQ-6 Pitfall 4).
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Compute initial hash and insert into config.json</name>
  <files>.planning/config.json</files>
  <action>
Read .planning/config.json first (required before Write).

Compute sha256 of super-gsd/templates/plan-schema-v2.json using Node built-in crypto:
  node -e "const c=require('crypto'),f=require('fs'); console.log(c.createHash('sha256').update(f.readFileSync('super-gsd/templates/plan-schema-v2.json')).digest('hex'))"

Add the resulting hex string as a new field in config.json under the "workflow" object:
  "schema_v2_hash": "<computed hex string>"

This MUST be done AFTER plan 01 (11-01) has written plan-schema-v2.json.
The hash and the schema file must match at the moment of commit (RQ-6 Pitfall 4).

Also optionally add "plan_fix_retry_cap": 3 under "workflow" to expose the D-10 retry cap
as a tunable config value (the hardcoded default is 3; config key is optional per D-10).

Write the updated config.json. Commit in the same commit as plan-schema-v2.json if possible,
or as a standalone commit: chore(11): insert schema_v2_hash into config.json
  </action>
  <verify>
    <automated>node -e "const c=require('./.planning/config.json'); console.log('schema_v2_hash present:', !!c.workflow.schema_v2_hash); process.exit(c.workflow.schema_v2_hash ? 0 : 1)"</automated>
  </verify>
  <done>
- config.json has workflow.schema_v2_hash field with 64-char hex sha256 value
- Hash matches actual sha256 of super-gsd/templates/plan-schema-v2.json at commit time
- No drift warning fires on fresh session start after plan is committed
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add drift check to orchestrator cold-start</name>
  <files>super-gsd/skills/sgsd-orchestrate/SKILL.md</files>
  <action>
Read sgsd-orchestrate/SKILL.md in full.

Locate the cold-start sequence — specifically the step where config.json is read (Step 3 or
equivalent). Insert the boot-time hash check IMMEDIATELY AFTER config.json is loaded,
BEFORE entering the main dispatch loop.

Add a prose block (or code block if the orchestrator uses bash blocks) containing the drift check:

```
// Boot-time schema drift check (D-12)
const crypto = require('crypto');
const actual = crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(projectDir, 'super-gsd/templates/plan-schema-v2.json')))
  .digest('hex');
const expected = config.workflow.schema_v2_hash;
if (expected && actual !== expected) {
  console.warn('[SGSD] schema_pin_drift detected — schema file differs from pinned hash');
  console.warn(`  expected: ${expected.slice(0,16)}...`);
  console.warn(`  actual:   ${actual.slice(0,16)}...`);
  fs.appendFileSync(
    path.join(projectDir, '.planning/metrics/readiness-log.jsonl'),
    JSON.stringify({
      ts: new Date().toISOString(),
      type: 'schema_pin_drift',
      expected_hash: expected,
      actual_hash: actual
    }) + '\n'
  );
  // D-14: NON-BLOCKING — loop continues after warning
} else if (!expected) {
  console.warn('[SGSD] workflow.schema_v2_hash not set in config.json — drift detection disabled');
}
```

If config.json does not have schema_v2_hash yet (first run before plan 04 executes),
the guard `if (expected && ...)` ensures the check is a no-op rather than a crash.

Do NOT add any halt or exit after the drift warning. D-14 is explicit: warn + continue.
Do NOT change any other cold-start behavior.

After inserting the drift check, also update CLAUDE-OVERLAY.md (if it exists in super-gsd/)
to document that session-start drift warnings are expected behavior. If CLAUDE-OVERLAY.md
does not exist, skip this step (do not create it for Phase 11 scope).
  </action>
  <verify>
    <automated>grep -n "schema_pin_drift\|schema_v2_hash" "C:/Users/user/GSDedits/super-gsd/skills/sgsd-orchestrate/SKILL.md" | head -10</automated>
  </verify>
  <done>
- Orchestrator cold-start contains sha256 drift check using Node built-in crypto
- Drift path: console warn + readiness-log.jsonl append + continue (non-blocking per D-14)
- No-op guard when schema_v2_hash absent from config.json
- No changes to existing cold-start steps beyond drift check insertion
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| filesystem → sha256 computation | Schema file could be replaced between check and use |
| readiness-log.jsonl → operator | Drift events visible to operator; confirm this is intended |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-09 | Tampering | plan-schema-v2.json post-hash replacement | mitigate | D-12 detects drift at every session start; operator is notified via readiness-log + console warn |
| T-11-10 | Repudiation | drift events in readiness-log.jsonl | accept | Append-only log provides audit trail with timestamp |
| T-11-11 | Denial of Service | readiness-log.jsonl write failure | accept | Warn-path only; if log write fails, warning still emitted to console; loop continues |
</threat_model>

<verification>
node -e "const c=require('./.planning/config.json'); const {createHash}=require('crypto'); const {readFileSync}=require('fs'); const actual=createHash('sha256').update(readFileSync('super-gsd/templates/plan-schema-v2.json')).digest('hex'); console.log(actual===c.workflow.schema_v2_hash ? 'HASH MATCH OK' : 'HASH MISMATCH'); process.exit(actual===c.workflow.schema_v2_hash ? 0 : 1)"
</verification>

<success_criteria>
- config.json workflow.schema_v2_hash contains valid sha256 matching plan-schema-v2.json at commit
- Orchestrator SKILL.md contains boot-time drift check using Node crypto (no new dep)
- Drift path: warn + readiness-log.jsonl append + continue (D-14 non-blocking)
- No drift warning fires on a fresh session with unmodified schema
- readiness-log.jsonl row shape matches D-14: { ts, type: schema_pin_drift, expected_hash, actual_hash }
</success_criteria>

<output>
After completion, create .planning/phases/11-plan-schema-v2/plans/11-04-SUMMARY.md
</output>
