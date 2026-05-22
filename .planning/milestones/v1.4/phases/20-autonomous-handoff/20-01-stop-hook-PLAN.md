---
schema_version: 2
phase: 20
plan: "20-01"
wave: 1
model: "sonnet"
expected_ATC_tier: "FULL"
depends_on: []
autonomous: true
requirements: ["HANDOFF-01"]
files_modified:
  - super-gsd/scripts/sgsd-stop-handoff.sh
  - super-gsd/config/settings-overlay.json

goal: >
  Create sgsd-stop-handoff.sh and wire it as a Claude Code Stop hook in
  settings-overlay.json. Script defaults to disabled (handoff.enabled: false).
  --dry-run flag exercises all pre-conditions + would-spawn logging without
  invoking claude CLI. No real auto-spawn occurs during development.

tasks:
  - id: "T1"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - "super-gsd/scripts/sgsd-stop-handoff.sh"
      - "super-gsd/config/settings-overlay.json"
    input_contract: >
      ORCHESTRATOR-CHECKPOINT.md exists at .planning/ORCHESTRATOR-CHECKPOINT.md with
      YAML frontmatter containing emergency_halt (bool), phase_state (string),
      next_unit (string), chain_depth (int, optional). Confirmed present in Phase 17
      halt commit 1936afb. settings-overlay.json has hooks.SessionStart + hooks.PreToolUse
      + hooks.PostToolUse blocks — Stop key is absent (confirmed by inspection). Install
      target is ~/.claude/super-gsd/scripts/sgsd-stop-handoff.sh (installer wires this
      in Install-SgsdShortcut.ps1 / install.sh per D-07).
    output_contract: >
      super-gsd/scripts/sgsd-stop-handoff.sh: executable bash script with shebang
      #!/usr/bin/env bash. Implements 4 pre-conditions in this order:
      (1) enabled check, (2) emergency_halt check, (3) operator-abort file check,
      (4) cooldown + chain-depth. --dry-run flag logs "would-spawn" row to
      handoff-log.jsonl and exits 0 without invoking claude. Real spawn uses
      (claude --print --dangerously-skip-permissions "/sgsd-orchestrate go" >/dev/null 2>&1 &) &
      settings-overlay.json: gains hooks.Stop array with one entry:
      { "matcher": "*", "hooks": [{ "type": "command",
        "command": "bash ~/.claude/super-gsd/scripts/sgsd-stop-handoff.sh",
        "timeout": 60 }] }
    hypothesis: >
      A bash Stop hook that checks emergency_halt before spawning — and defaults to
      enabled: false — will let the operator safely develop and test without
      accidental auto-spawns, while the --dry-run path validates all logic paths.
    falsifier: >
      bash -n sgsd-stop-handoff.sh returns non-zero (syntax error), OR
      bash sgsd-stop-handoff.sh --dry-run exits non-zero when no checkpoint exists,
      OR settings-overlay.json fails JSON parse after modification,
      OR the Stop hook key is absent from settings-overlay.json after modification.
    stop_rule: >
      bash -n super-gsd/scripts/sgsd-stop-handoff.sh exits 0 AND
      bash super-gsd/scripts/sgsd-stop-handoff.sh --dry-run exits 0 AND
      node -e "JSON.parse(require('fs').readFileSync('super-gsd/config/settings-overlay.json','utf8')).hooks.Stop" exits 0.
    verification_cmd: "bash -n super-gsd/scripts/sgsd-stop-handoff.sh && bash super-gsd/scripts/sgsd-stop-handoff.sh --dry-run && node -e \"JSON.parse(require('fs').readFileSync('super-gsd/config/settings-overlay.json','utf8')).hooks.Stop && console.log('Stop hook present')\""
    known_deadends:
      - "Do NOT use claude --non-interactive — flag does not exist in Claude Code CLI"
      - "Do NOT omit --dangerously-skip-permissions — spawned session hangs on permissions prompt (RESEARCH V2)"
      - "Do NOT use single & background — must be (cmd &) & double-background to avoid Stop hook 60s timeout"
      - "Do NOT use CLAUDE_SESSION_ID — not propagated to hook subprocesses (RESEARCH V2)"
---

<objective>
Create the sgsd-stop-handoff.sh Stop hook script and wire it into
settings-overlay.json. The script is the entry point for autonomous session
handoff: it runs on every Claude Code session stop, checks pre-conditions,
and either spawns a fresh session or exits silently.

Purpose: Enable unattended multi-session autonomous runs by automating the
manual "/clear + /sgsd-orchestrate go" operator step.

Output: sgsd-stop-handoff.sh (new), settings-overlay.json (Stop hook added),
1 atomic commit.
</objective>

<execution_context>
@C:\Users\user\.claude\get-shit-done\workflows\execute-plan.md
</execution_context>

<context>
@C:\Users\user\GSDedits\.planning\milestones\v1.4\phases\20-autonomous-handoff\20-CONTEXT.md
@C:\Users\user\GSDedits\.planning\milestones\v1.4\phases\20-autonomous-handoff\20-RESEARCH.md

<interfaces>
<!-- Contracts the executor needs. No codebase exploration required. -->

ORCHESTRATOR-CHECKPOINT.md YAML frontmatter fields (confirmed Phase 17 commit 1936afb):
  emergency_halt: true|false
  phase_state: "discussing"|"planning"|"executing"|"verifying"
  next_unit: "<string>"
  chain_depth: <int>   # optional — may be absent in older checkpoints

config.json handoff block shape (D-04, keys optional):
  {
    "handoff": {
      "enabled": false,          # DEFAULT: false (safety)
      "min_cooldown_seconds": 30,
      "max_chain_depth": 5,
      "operator_abort_file": ".planning/STOP-HANDOFF",
      "spawn_command": "claude",
      "spawn_args": ["--print", "--dangerously-skip-permissions", "/sgsd-orchestrate go"],
      "log_path": ".planning/metrics/handoff-log.jsonl"
    }
  }

handoff-log.jsonl row shape (D-05):
  { "ts": "<ISO>", "from_session_id": "<PID|$$>", "to_session_id": null,
    "reason": "spawned|refused|dry_run", "chain_depth": <int>,
    "cumulative_runtime_s": <int>, "refused": "<reason>",
    "spawn_exit": <int>, "checkpoint_path": "<path>" }

settings-overlay.json existing hooks (do not remove):
  hooks.SessionStart[0].hooks[0].command = "node ~/.claude/hooks/gsd-session-start.js"
  hooks.PreToolUse[0].matcher = "*", command = "node ~/.claude/hooks/sgsd-activity-logger.js"
  hooks.PostToolUse[0..3] — heartbeat, token-logger, stuck-detector, checkpoint-writer, context-monitor

Stop hook to add (append to hooks object — do NOT overwrite existing keys):
  "Stop": [{
    "matcher": "*",
    "hooks": [{"type": "command",
               "command": "bash ~/.claude/super-gsd/scripts/sgsd-stop-handoff.sh",
               "timeout": 60}]
  }]
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>T1: HANDOFF-01 — sgsd-stop-handoff.sh + Stop hook wiring (disabled by default)</name>
  <files>super-gsd/scripts/sgsd-stop-handoff.sh, super-gsd/config/settings-overlay.json</files>
  <action>
Create super-gsd/scripts/sgsd-stop-handoff.sh with the following exact structure.
ASCII-only strings throughout (Phase 17 lesson: no UTF-8 glyphs in bash scripts).

```bash
#!/usr/bin/env bash
# sgsd-stop-handoff.sh — Claude Code Stop hook for autonomous session handoff
# Fires on every session stop. Spawns fresh claude session if checkpoint signals
# emergency_halt and all safety pre-conditions pass.
# Usage: sgsd-stop-handoff.sh [--dry-run]
set -euo pipefail

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

# Resolve project root (cwd when Stop hook fires is the project directory)
PROJECT_DIR="$(pwd)"
PLANNING_DIR="$PROJECT_DIR/.planning"
CONFIG_FILE="$PLANNING_DIR/config.json"
CHECKPOINT="$PLANNING_DIR/ORCHESTRATOR-CHECKPOINT.md"
LOG_PATH="$PLANNING_DIR/metrics/handoff-log.jsonl"

# --- Read config (all optional; defaults apply if block absent) ---
ENABLED=false
MIN_COOLDOWN=30
MAX_CHAIN_DEPTH=5
ABORT_FILE="$PLANNING_DIR/STOP-HANDOFF"
SPAWN_CMD="claude"
SPAWN_ARGS="--print --dangerously-skip-permissions /sgsd-orchestrate go"

if [[ -f "$CONFIG_FILE" ]]; then
  _enabled=$(node -e "try{const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8'));console.log(c.handoff&&c.handoff.enabled!=null?c.handoff.enabled:false)}catch(e){console.log(false)}" 2>/dev/null || echo "false")
  ENABLED="$_enabled"
  _cool=$(node -e "try{const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8'));console.log(c.handoff&&c.handoff.min_cooldown_seconds!=null?c.handoff.min_cooldown_seconds:30)}catch(e){console.log(30)}" 2>/dev/null || echo "30")
  MIN_COOLDOWN="$_cool"
  _depth=$(node -e "try{const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8'));console.log(c.handoff&&c.handoff.max_chain_depth!=null?c.handoff.max_chain_depth:5)}catch(e){console.log(5)}" 2>/dev/null || echo "5")
  MAX_CHAIN_DEPTH="$_depth"
fi

# --- Helper: append JSON row to handoff-log.jsonl ---
_log_row() {
  local reason="$1" chain_depth="$2" extra="${3:-}"
  local ts from_session
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  from_session="pid-$$"  # CLAUDE_SESSION_ID not propagated to hooks (RESEARCH V2)
  mkdir -p "$PLANNING_DIR/metrics"
  local row
  row="{\"ts\":\"$ts\",\"from_session_id\":\"$from_session\",\"to_session_id\":null,\"reason\":\"$reason\",\"chain_depth\":$chain_depth,\"cumulative_runtime_s\":0,\"checkpoint_path\":\"$CHECKPOINT\"${extra}}"
  echo "$row" >> "$LOG_PATH"
}

# --- PRE-CONDITION 1: enabled check ---
if [[ "$ENABLED" != "true" ]]; then
  # Silent exit — disabled is the default state, no log noise
  exit 0
fi

# --- PRE-CONDITION 2: checkpoint must exist with emergency_halt: true ---
if [[ ! -f "$CHECKPOINT" ]]; then
  exit 0
fi

EMERGENCY_HALT=$(grep -m1 "^emergency_halt:" "$CHECKPOINT" | awk '{print $2}' | tr -d '[:space:]')
if [[ "$EMERGENCY_HALT" != "true" ]]; then
  exit 0
fi

# --- PRE-CONDITION 3: /gsd-discuss-phase guard ---
PHASE_STATE=$(grep -m1 "^phase_state:" "$CHECKPOINT" | awk '{print $2}' | tr -d '[:space:]"')
if [[ "$PHASE_STATE" == "discussing" ]]; then
  _log_row "refused" 0 ",\"refused\":\"discuss_phase_interactive\""
  exit 0
fi

# --- PRE-CONDITION 4a: operator-abort file (cheapest check first) ---
if [[ -f "$ABORT_FILE" ]]; then
  _log_row "refused" 0 ",\"refused\":\"operator_abort\""
  exit 0
fi

# --- PRE-CONDITION 4b: chain depth ---
CHAIN_DEPTH=$(grep -m1 "^chain_depth:" "$CHECKPOINT" | awk '{print $2}' | tr -d '[:space:]' || echo "0")
[[ -z "$CHAIN_DEPTH" || ! "$CHAIN_DEPTH" =~ ^[0-9]+$ ]] && CHAIN_DEPTH=0
if (( CHAIN_DEPTH >= MAX_CHAIN_DEPTH )); then
  _log_row "refused" "$CHAIN_DEPTH" ",\"refused\":\"max_chain_depth\""
  exit 0
fi

# --- PRE-CONDITION 4c: cooldown ---
if [[ -f "$LOG_PATH" ]]; then
  LAST_TS=$(tail -1 "$LOG_PATH" | node -e "try{const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(r.ts||'')}catch(e){console.log('')}" 2>/dev/null || echo "")
  if [[ -n "$LAST_TS" ]]; then
    NOW_EPOCH=$(date +%s)
    LAST_EPOCH=$(date -d "$LAST_TS" +%s 2>/dev/null || echo "0")
    ELAPSED=$(( NOW_EPOCH - LAST_EPOCH ))
    if (( ELAPSED < MIN_COOLDOWN )); then
      _log_row "refused" "$CHAIN_DEPTH" ",\"refused\":\"cooldown\",\"elapsed_s\":$ELAPSED"
      exit 0
    fi
  fi
fi

# --- DRY RUN path ---
if (( DRY_RUN )); then
  _log_row "dry_run" "$CHAIN_DEPTH" ",\"would_spawn\":\"$SPAWN_CMD $SPAWN_ARGS\""
  echo "[sgsd-stop-handoff] DRY RUN: would spawn: $SPAWN_CMD $SPAWN_ARGS" >&2
  exit 0
fi

# --- SPAWN (fire-and-forget; double-background to avoid 60s Stop hook timeout) ---
_log_row "spawned" "$CHAIN_DEPTH" ""
(eval "$SPAWN_CMD $SPAWN_ARGS" >/dev/null 2>&1 &) &
exit 0
```

After creating the script, make it executable:
  chmod +x super-gsd/scripts/sgsd-stop-handoff.sh

Then update settings-overlay.json to add the Stop hook. Use Node read-mutate-write
(never cat/echo/head — per workflow/feedback/feedback_never_head_settings.md):

```javascript
// Node snippet to add Stop hook
const fs = require('fs');
const path = require('path');
const filePath = path.join(process.cwd(), 'super-gsd/config/settings-overlay.json');
const cfg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
if (!cfg.hooks.Stop) {
  cfg.hooks.Stop = [{
    "matcher": "*",
    "hooks": [{"type": "command",
               "command": "bash ~/.claude/super-gsd/scripts/sgsd-stop-handoff.sh",
               "timeout": 60}]
  }];
  fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2) + '\n');
  console.log('Stop hook added');
} else {
  console.log('Stop hook already present — skipped');
}
```

Run this via: node -e "<above code>"

Commit: `feat(20-01/T1): HANDOFF-01 sgsd-stop-handoff.sh + Stop hook wiring (disabled by default)`
  </action>
  <verify>
    <automated>bash -n super-gsd/scripts/sgsd-stop-handoff.sh && bash super-gsd/scripts/sgsd-stop-handoff.sh --dry-run && node -e "const c=JSON.parse(require('fs').readFileSync('super-gsd/config/settings-overlay.json','utf8'));if(!c.hooks.Stop)throw new Error('Stop hook missing');console.log('OK')"</automated>
  </verify>
  <done>
    bash -n exits 0 (no syntax errors).
    --dry-run exits 0 even when .planning/ORCHESTRATOR-CHECKPOINT.md does not exist
    (pre-condition 2 catches missing checkpoint and exits 0 silently).
    settings-overlay.json has hooks.Stop array with timeout: 60.
    JSON.parse of settings-overlay.json succeeds (no trailing commas, valid JSON).
    handoff.enabled defaults to false — no real spawn can occur until operator opts in.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Stop hook subprocess -> FS | Hook reads .planning/ files as untrusted input; malformed files must not crash hook |
| Stop hook -> claude CLI | Spawn is fire-and-forget; spawn failure must not cascade to current session Stop flow |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-01-01 | Tampering | ORCHESTRATOR-CHECKPOINT.md frontmatter | mitigate | grep -m1 extracts single field; no eval of checkpoint content |
| T-20-01-02 | DoS | Stop hook timeout (60s hard cap) | mitigate | Double-background spawn (cmd &) & exits hook immediately; no wait |
| T-20-01-03 | Elevation | --dangerously-skip-permissions in spawn | accept | Required for headless auto mode; spawn only fires when enabled: true + emergency_halt: true |
| T-20-01-04 | Info Disclosure | handoff-log.jsonl exposes PID as session id | accept | PID is local operator machine only; no PII; weakens lineage but satisfies HANDOFF-03 |
</threat_model>

<verification>
```bash
# Syntax check
bash -n super-gsd/scripts/sgsd-stop-handoff.sh

# Dry-run (no checkpoint present — should exit 0 silently)
bash super-gsd/scripts/sgsd-stop-handoff.sh --dry-run

# Dry-run with simulated emergency_halt checkpoint
mkdir -p .planning
printf -- '---\nemergency_halt: true\nphase_state: executing\nchain_depth: 1\nnext_unit: "test"\n---\n' > .planning/ORCHESTRATOR-CHECKPOINT.md
# NOTE: enabled defaults to false — should still exit 0 (pre-condition 1 refuses)
bash super-gsd/scripts/sgsd-stop-handoff.sh --dry-run

# Verify Stop hook in settings-overlay.json
node -e "const c=JSON.parse(require('fs').readFileSync('super-gsd/config/settings-overlay.json','utf8'));console.log(JSON.stringify(c.hooks.Stop,null,2))"
```
</verification>

<success_criteria>
- sgsd-stop-handoff.sh passes bash -n (no syntax errors)
- --dry-run exits 0 in all pre-condition paths (disabled / no checkpoint / discuss-phase / abort-file / depth / cooldown)
- settings-overlay.json valid JSON with hooks.Stop entry, timeout: 60
- Script is executable (chmod +x applied)
- Default config: enabled: false — no real spawn possible until operator opts in
- 1 atomic commit: feat(20-01/T1): HANDOFF-01 sgsd-stop-handoff.sh + Stop hook wiring (disabled by default)
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.4/phases/20-autonomous-handoff/20-01-SUMMARY.md`
with fields: FILES_CHANGED, VERIFICATION results, DEVIATIONS, ONE_LINER.
</output>
