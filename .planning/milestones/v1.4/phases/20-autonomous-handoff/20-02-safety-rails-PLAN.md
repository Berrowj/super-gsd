---
schema_version: 2
phase: 20
plan: "20-02"
wave: 2
model: "sonnet"
expected_ATC_tier: "FULL"
depends_on: ["20-01"]
autonomous: true
requirements: ["HANDOFF-02"]
files_modified:
  - super-gsd/scripts/sgsd-stop-handoff.sh
  - .planning/config.json

goal: >
  Harden sgsd-stop-handoff.sh with production-ready safety rails: cooldown timer,
  max chain depth enforcement, operator-abort file detection, and /gsd-discuss-phase
  guard. Add the config.json handoff block so operators can tune all parameters.
  Validate via simulated chain_depth=5 dry-run refusal.

tasks:
  - id: "T1"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - "super-gsd/scripts/sgsd-stop-handoff.sh"
      - ".planning/config.json"
    input_contract: >
      20-01 delivered sgsd-stop-handoff.sh with stub pre-condition checks
      and --dry-run flag. Script passes bash -n. Stop hook wired in settings-overlay.json.
      .planning/config.json exists with review_providers block from Phase 17 (confirmed V6).
      Pre-condition order per RESEARCH planner guidance: enabled -> emergency_halt ->
      discuss-phase guard -> operator-abort (cheapest first) -> chain-depth -> cooldown.
    output_contract: >
      sgsd-stop-handoff.sh: all 6 pre-conditions fully implemented with production logic.
      Cooldown reads last row ts from handoff-log.jsonl via tail+node pipeline.
      Chain depth reads chain_depth field from ORCHESTRATOR-CHECKPOINT.md frontmatter
      (grep -m1) with fallback to 0 if absent. Operator-abort: test -f .planning/STOP-HANDOFF.
      discuss-phase: grep -m1 phase_state, compare to "discussing".
      All refused paths log a handoff-log.jsonl row with refused: "<reason>" field.
      .planning/config.json: handoff block added additively (existing keys preserved).
      All keys optional with defaults in script (so pre-existing installs without
      config.json still work).
    hypothesis: >
      Implementing all 6 pre-conditions in sgsd-stop-handoff.sh with bash primitives
      (grep/awk/date/node for JSON only) and documenting them in config.json will
      prevent runaway chains, respect operator-abort, and exclude discuss-phase sessions
      without any runtime dependency beyond bash + node.
    falsifier: >
      bash sgsd-stop-handoff.sh --dry-run with simulated chain_depth=5 checkpoint
      exits non-zero, OR does NOT write a refused:max_chain_depth row to handoff-log.jsonl,
      OR node -e "require('./.planning/config.json').handoff" returns null/undefined,
      OR config.json fails JSON parse after modification.
    stop_rule: >
      bash sgsd-stop-handoff.sh --dry-run with chain_depth=5 checkpoint writes
      refused:max_chain_depth row to handoff-log.jsonl AND exits 0 AND
      node -e "require('./.planning/config.json').handoff" returns non-null object.
    verification_cmd: "bash -n super-gsd/scripts/sgsd-stop-handoff.sh && node -e \"const h=require('./.planning/config.json').handoff;if(!h)throw new Error('handoff block missing');console.log('handoff block OK',JSON.stringify(h))\""
    known_deadends:
      - "Do NOT use jq for JSON parsing — may not be available on all operator machines; use node"
      - "Do NOT use uuidgen for from_session_id — may be absent on Windows/WSL (RESEARCH V2); use $$ PID"
      - "Do NOT implement chain-depth reset logic here — Phase 20 defers operator-driven reset detection to handoff-log.jsonl lineage heuristic in 20-03"
---

<objective>
Harden sgsd-stop-handoff.sh with all 6 HANDOFF-02 safety rails and add the
config.json handoff block for operator-tunable parameters.

Purpose: Prevent runaway autonomous chains (max depth), respect operator-abort
signal (STOP-HANDOFF file), enforce cooldown between spawns, and exclude
interactive discuss-phase sessions from handoff.

Output: sgsd-stop-handoff.sh (modified — rails complete), .planning/config.json
(handoff block added additively), 1 atomic commit.
</objective>

<execution_context>
@C:\Users\user\.claude\get-shit-done\workflows\execute-plan.md
</execution_context>

<context>
@C:\Users\user\GSDedits\.planning\milestones\v1.4\phases\20-autonomous-handoff\20-CONTEXT.md
@C:\Users\user\GSDedits\.planning\milestones\v1.4\phases\20-autonomous-handoff\20-RESEARCH.md

<interfaces>
<!-- Contracts from 20-01 output. No codebase exploration needed. -->

sgsd-stop-handoff.sh skeleton from 20-01 — key sections to verify complete:

  PRE-CONDITION 1 (enabled): reads config.json handoff.enabled via node; exits 0 if false
  PRE-CONDITION 2 (emergency_halt): grep -m1 "^emergency_halt:" CHECKPOINT | awk '{print $2}'
  PRE-CONDITION 3 (discuss-phase): grep -m1 "^phase_state:" CHECKPOINT; compare to "discussing"
  PRE-CONDITION 4a (abort-file): test -f "$ABORT_FILE" where ABORT_FILE=".planning/STOP-HANDOFF"
  PRE-CONDITION 4b (chain-depth): grep -m1 "^chain_depth:" CHECKPOINT, compare to MAX_CHAIN_DEPTH
  PRE-CONDITION 4c (cooldown): tail -1 handoff-log.jsonl -> node parse ts -> compare to MIN_COOLDOWN

  _log_row() helper: appends JSON row. Signature: _log_row "$reason" "$chain_depth" "$extra_json"
  Extra json examples: ",\"refused\":\"max_chain_depth\""  ",\"elapsed_s\":$ELAPSED"

.planning/config.json existing block (Phase 17, confirmed V6):
  { "review_providers": { ... } }
  Handoff block must be added additively — do NOT remove or overwrite review_providers.

config.json handoff block to add (D-04):
  "handoff": {
    "enabled": false,
    "min_cooldown_seconds": 30,
    "max_chain_depth": 5,
    "operator_abort_file": ".planning/STOP-HANDOFF",
    "spawn_command": "claude",
    "spawn_args": ["--print", "--dangerously-skip-permissions", "/sgsd-orchestrate go"],
    "log_path": ".planning/metrics/handoff-log.jsonl"
  }
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>T1: HANDOFF-02 — safety rails (cooldown + depth + abort + discuss-phase guard) + config.json block</name>
  <files>super-gsd/scripts/sgsd-stop-handoff.sh, .planning/config.json</files>
  <action>
Read the current content of super-gsd/scripts/sgsd-stop-handoff.sh from 20-01.
Verify all 6 pre-conditions are correctly implemented — if any are stub/incomplete,
fill them in with the production logic below.

PRE-CONDITION IMPLEMENTATION REFERENCE (fill in any gaps):

1. ENABLED check (already in 20-01 — verify reads config.json handoff.enabled via node):
   ```bash
   if [[ "$ENABLED" != "true" ]]; then exit 0; fi
   ```

2. EMERGENCY_HALT check (already in 20-01 — verify grep/awk pattern):
   ```bash
   EMERGENCY_HALT=$(grep -m1 "^emergency_halt:" "$CHECKPOINT" | awk '{print $2}' | tr -d '[:space:]')
   if [[ "$EMERGENCY_HALT" != "true" ]]; then exit 0; fi
   ```

3. DISCUSS-PHASE guard (already in 20-01 — verify comparison):
   ```bash
   PHASE_STATE=$(grep -m1 "^phase_state:" "$CHECKPOINT" | awk '{print $2}' | tr -d '[:space:]"')
   if [[ "$PHASE_STATE" == "discussing" ]]; then
     _log_row "refused" 0 ",\"refused\":\"discuss_phase_interactive\""
     exit 0
   fi
   ```

4a. ABORT-FILE (already in 20-01 — verify uses $ABORT_FILE variable not hardcoded path):
    ```bash
    if [[ -f "$ABORT_FILE" ]]; then
      _log_row "refused" 0 ",\"refused\":\"operator_abort\""
      exit 0
    fi
    ```

4b. CHAIN-DEPTH — verify production logic:
    ```bash
    CHAIN_DEPTH=$(grep -m1 "^chain_depth:" "$CHECKPOINT" | awk '{print $2}' | tr -d '[:space:]' 2>/dev/null || echo "0")
    [[ -z "$CHAIN_DEPTH" || ! "$CHAIN_DEPTH" =~ ^[0-9]+$ ]] && CHAIN_DEPTH=0
    if (( CHAIN_DEPTH >= MAX_CHAIN_DEPTH )); then
      _log_row "refused" "$CHAIN_DEPTH" ",\"refused\":\"max_chain_depth\""
      exit 0
    fi
    ```

4c. COOLDOWN — verify production logic with node JSON parse for ts:
    ```bash
    if [[ -f "$LOG_PATH" ]]; then
      LAST_TS=$(tail -1 "$LOG_PATH" | node -e \
        "try{const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(r.ts||'')}catch(e){process.stdout.write('')}" 2>/dev/null || echo "")
      if [[ -n "$LAST_TS" ]]; then
        NOW_EPOCH=$(date +%s)
        LAST_EPOCH=$(date -d "$LAST_TS" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$LAST_TS" +%s 2>/dev/null || echo "0")
        ELAPSED=$(( NOW_EPOCH - LAST_EPOCH ))
        if (( ELAPSED < MIN_COOLDOWN )); then
          _log_row "refused" "$CHAIN_DEPTH" ",\"refused\":\"cooldown\",\"elapsed_s\":$ELAPSED"
          exit 0
        fi
      fi
    fi
    ```
    Note: date -d works on Linux/WSL; date -j fallback for macOS. Both covered.

After verifying/completing all pre-conditions in the script, run bash -n to confirm
no syntax errors before proceeding.

Then add the handoff block to .planning/config.json using Node read-mutate-write:

```javascript
const fs = require('fs');
const path = require('path');
const filePath = path.join(process.cwd(), '.planning/config.json');
const cfg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
if (!cfg.handoff) {
  cfg.handoff = {
    "enabled": false,
    "min_cooldown_seconds": 30,
    "max_chain_depth": 5,
    "operator_abort_file": ".planning/STOP-HANDOFF",
    "spawn_command": "claude",
    "spawn_args": ["--print", "--dangerously-skip-permissions", "/sgsd-orchestrate go"],
    "log_path": ".planning/metrics/handoff-log.jsonl"
  };
  fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2) + '\n');
  console.log('handoff block added');
} else {
  console.log('handoff block already present — skipped');
}
```

Run: node -e "<above code>"

Simulate chain_depth=5 refusal test (dry-run validation):
```bash
mkdir -p .planning
printf -- '---\nemergency_halt: true\nphase_state: executing\nchain_depth: 5\nnext_unit: "test"\n---\n' > .planning/ORCHESTRATOR-CHECKPOINT.md
# Temporarily set enabled=true in config to reach depth check:
node -e "const fs=require('fs');const p='.planning/config.json';const c=JSON.parse(fs.readFileSync(p,'utf8'));c.handoff.enabled=true;fs.writeFileSync(p,JSON.stringify(c,null,2)+'\n')"
bash super-gsd/scripts/sgsd-stop-handoff.sh --dry-run
# Verify refused:max_chain_depth row in log:
tail -1 .planning/metrics/handoff-log.jsonl
# Restore enabled: false
node -e "const fs=require('fs');const p='.planning/config.json';const c=JSON.parse(fs.readFileSync(p,'utf8'));c.handoff.enabled=false;fs.writeFileSync(p,JSON.stringify(c,null,2)+'\n')"
```

Commit: `feat(20-02/T1): HANDOFF-02 safety rails (cooldown + depth + abort + discuss-phase guard) + config block`
  </action>
  <verify>
    <automated>bash -n super-gsd/scripts/sgsd-stop-handoff.sh && node -e "const h=require('./.planning/config.json').handoff;if(!h)throw new Error('handoff block missing');if(h.enabled!==false)throw new Error('enabled must default to false');console.log('OK')"</automated>
  </verify>
  <done>
    bash -n exits 0.
    Simulated chain_depth=5 dry-run writes refused:max_chain_depth row to handoff-log.jsonl.
    .planning/config.json parses as valid JSON with handoff block present.
    handoff.enabled is false (safety default maintained).
    All 6 pre-conditions reachable in script logic (grep for each condition label confirms).
    review_providers block still present in config.json (additive write preserved existing keys).
    1 atomic commit: feat(20-02/T1): HANDOFF-02 safety rails...
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| FS -> bash script | handoff-log.jsonl last-row read; malformed JSON must not crash cooldown check |
| bash script -> node | node -e snippets parse untrusted file content; wrapped in try/catch |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-02-01 | DoS | Infinite handoff chain (depth not enforced) | mitigate | chain_depth >= MAX_CHAIN_DEPTH -> refused:max_chain_depth + exit 0 |
| T-20-02-02 | DoS | Cooldown bypass (clock skew) | accept | date +%s is wall-clock; skew on local single machine negligible |
| T-20-02-03 | Tampering | STOP-HANDOFF file planted by malicious process | accept | Operator-controlled local FS only; touching file is intentional abort signal |
| T-20-02-04 | Repudiation | No audit trail for refused handoffs | mitigate | All refused paths write to handoff-log.jsonl with refused: field |
</threat_model>

<verification>
```bash
# Syntax check
bash -n super-gsd/scripts/sgsd-stop-handoff.sh

# config.json has handoff block
node -e "const h=require('./.planning/config.json').handoff;console.log(JSON.stringify(h,null,2))"

# Verify review_providers still present (additive write test)
node -e "const c=require('./.planning/config.json');if(!c.review_providers)throw new Error('review_providers removed!');console.log('review_providers preserved')"

# Simulate chain_depth=5 refusal (enabled: true temporarily for test)
printf -- '---\nemergency_halt: true\nphase_state: executing\nchain_depth: 5\nnext_unit: "test"\n---\n' > .planning/ORCHESTRATOR-CHECKPOINT.md
node -e "const fs=require('fs');const p='.planning/config.json';const c=JSON.parse(fs.readFileSync(p,'utf8'));c.handoff.enabled=true;fs.writeFileSync(p,JSON.stringify(c,null,2)+'\n')"
bash super-gsd/scripts/sgsd-stop-handoff.sh --dry-run
tail -1 .planning/metrics/handoff-log.jsonl | node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));if(r.refused!=='max_chain_depth')throw new Error('wrong refusal:'+r.refused);console.log('refused:max_chain_depth OK')"
node -e "const fs=require('fs');const p='.planning/config.json';const c=JSON.parse(fs.readFileSync(p,'utf8'));c.handoff.enabled=false;fs.writeFileSync(p,JSON.stringify(c,null,2)+'\n')"
```
</verification>

<success_criteria>
- bash -n exits 0 (no syntax errors in hardened script)
- Simulated chain_depth=5 refuses to spawn and logs refused:max_chain_depth row
- .planning/config.json has handoff block with enabled: false default
- All pre-existing config.json keys (review_providers) preserved (additive write)
- All 6 pre-conditions present in script (grep each sentinel confirms)
- 1 atomic commit: feat(20-02/T1): HANDOFF-02 safety rails...
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.4/phases/20-autonomous-handoff/20-02-SUMMARY.md`
with fields: FILES_CHANGED, VERIFICATION results, DEVIATIONS, ONE_LINER.
</output>
