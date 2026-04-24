# Phase 20: Autonomous Session Handoff — Context

**Gathered:** 2026-04-24 (inline from REQUIREMENTS.md + Phase 17/18/19 accumulated insights)
**Status:** Ready for research
**Milestone:** v1.4 — Clean Close + Codex Visibility + Autonomous Handoff (FINAL PHASE)

<domain>
## Phase Boundary

Close the operator-intervention gap. Today an emergency_halt checkpoint requires a human to start a fresh `claude` session. Phase 20 makes that automatic: Stop hook reads checkpoint, spawns fresh session with `/sgsd-orchestrate go`, loop resumes at `next_unit` — zero operator involvement between halt and resume.

**Design invariant:** `/gsd-discuss-phase` remains interactive; handoff never fires from a discuss-phase dispatch. Everything else (research, plan, plan-check, execute, verify, ATC, MUDA, browser-verify, phase-close, milestone audit, milestone close) becomes cross-session autonomous.

**3 items in scope (REQUIREMENTS.md HANDOFF-01..03):**
- HANDOFF-01: Claude Code Stop hook `sgsd-stop-handoff.sh` — reads checkpoint, spawns fresh claude
- HANDOFF-02: Safety rails — cooldown, max-chain-depth, operator-abort file, error handling
- HANDOFF-03: Telemetry + MC integration — handoff-log.jsonl, chain-depth tile, milestone-close stats

**Phase 19 deferral signals that matter here:**
- Narrative race conditions — will surface under multi-session chaining (two codex-exec runs writing concurrently to narrative.md). Phase 20 is the FIRST real test.
- Retry path edge cases — the timeout-escalate retry could interact with handoff triggers if an agent dies mid-retry.

**Non-goals:**
- Custom session-id generation scheme (use Claude CLI's own session id)
- Remote/cloud handoff (local process spawn only)
- Replacing emergency halt — handoff OPTS IN to resume, doesn't change halt semantics
- Handoff for non-auto-mode halts (operator-directed pause is respected)

</domain>

<decisions>
## Implementation Decisions (locked inline)

### D-01: 3 plans, strict serialization
- **20-01 Stop hook script** (FULL tier, 1 task): HANDOFF-01 `sgsd-stop-handoff.sh` + Claude Code settings Stop hook wiring in settings-overlay.json
- **20-02 Safety rails** (FULL tier, 1 task): HANDOFF-02 cooldown + max-chain-depth + operator-abort + config.json.handoff block + installer integration
- **20-03 Telemetry + MC integration** (FULL tier, 1 task): HANDOFF-03 handoff-log.jsonl append + MC chain-depth tile extension + sgsd-token-audit --milestone-close-check

Strict serial: 20-01 → 20-02 → 20-03. Can't safety-rail before script exists; can't telemetry-wire before both script + rails work.

### D-02: Stop hook script details (HANDOFF-01)
`super-gsd/scripts/sgsd-stop-handoff.sh`:
- Reads `.planning/ORCHESTRATOR-CHECKPOINT.md` frontmatter
- Pre-condition: `emergency_halt: true` → otherwise exit 0 (nothing to do)
- Pre-condition: `.planning/STOP-HANDOFF` file absent → otherwise exit 0 (operator abort respected)
- Pre-condition: cooldown elapsed (default 30s since last handoff, readable from `.planning/metrics/handoff-log.jsonl` tail)
- Pre-condition: chain-depth not exceeded (default 5, chain-depth read from checkpoint or handoff-log lineage)
- Spawn: `claude --print "/sgsd-orchestrate go"` (or equivalent non-interactive form — tool research will confirm exact CLI)
- Timeout: spawn command has short timeout (60s) — if claude doesn't accept the prompt in that window, log error + exit non-zero
- Log: append to handoff-log.jsonl with spawn outcome

Invocation: Claude Code's Stop hook (via settings-overlay.json) fires when the current session's orchestrator-loop writes a terminating text-only response after emergency_halt. Exit code 0 means "allow normal stop"; we ALWAYS exit 0 since the new session has already been spawned — no need to block current session's death.

### D-03: Safety rails details (HANDOFF-02)

**Cooldown (min_cooldown_seconds):** 30s default. Enforced by reading the last handoff-log.jsonl row and comparing `(now - ts) >= cooldown`. Applies cross-chain: first handoff in a milestone has no prior row → cooldown not enforced.

**Max chain depth (max_chain_depth):** 5 default. Chain depth is the count of consecutive handoffs WITHOUT operator intervention. Reset semantics:
- Operator-driven sgsd-orchestrate invocation → depth resets to 0
- Any handoff spawn → depth++
- depth >= max → handoff refuses to spawn; writes log row with `refused: "max_chain_depth"`

**Operator-abort file (`.planning/STOP-HANDOFF`):** touching this file stops all in-flight + future handoffs. Presence alone is enough (empty file OK). Removing the file re-enables handoff. Audit-logged to handoff-log.jsonl when detected.

**Error handling:** failed spawn logs to stderr + handoff-log.jsonl + exits 0 (do not cascade errors into the current session's Stop flow). No infinite-retry — one attempt per halt.

**/gsd-discuss-phase exclusion:** checkpoint's `phase_state` field. If the dying session was in discuss-phase mode (emergency_halt emitted during discuss), handoff REFUSES to spawn and logs `refused: "discuss_phase_interactive"`. Operator must resume manually.

### D-04: Config shape (additive to config.json)
```json
{
  "handoff": {
    "enabled": true,
    "min_cooldown_seconds": 30,
    "max_chain_depth": 5,
    "operator_abort_file": ".planning/STOP-HANDOFF",
    "spawn_command": "claude",
    "spawn_args": ["--print", "/sgsd-orchestrate go"],
    "log_path": ".planning/metrics/handoff-log.jsonl"
  }
}
```

All keys optional (defaults in sgsd-stop-handoff.sh if config block absent). `enabled: false` disables handoff entirely.

### D-05: handoff-log.jsonl schema
Per HANDOFF-03 REQ: `{ts, from_session_id, to_session_id, reason, chain_depth, cumulative_runtime_s}`. Plus optional:
- `refused: "<reason>"` when handoff doesn't spawn (operator_abort / cooldown / max_depth / discuss_phase_interactive / disabled / spawn_failed)
- `spawn_exit: <int>` when spawn attempted
- `checkpoint_path: "<path>"` for audit

from/to session_id pulled from `CLAUDE_SESSION_ID` env var (Claude Code sets this; if absent, use `$$` as PID fallback). to_session_id is null at log-write time (child hasn't started); a DIFFERENT row gets written when the child starts via `sgsd-session-start.js` hook (already installed) with `from_session_id: <parent>, to_session_id: <child>`.

### D-06: MC tile extension (HANDOFF-03)
`super-gsd/scripts/sgsd-mission-control.ps1` gains second Codex-adjacent tile `SGSD-Handoff-Tile`:
- Chain depth: current depth from latest handoff-log row
- Cumulative autonomous runtime: sum of runtimes across chain
- Last handoff outcome: spawned / refused_cooldown / refused_max_depth / refused_abort / failed
- Guard: if handoff_enabled=false, tile shows `handoff: disabled` greyed out

### D-07: Installer wiring
`super-gsd/install.sh` (or Install-SgsdShortcut.ps1 for Windows) needs:
- Copy `sgsd-stop-handoff.sh` to `~/.claude/super-gsd/scripts/`
- Add Stop hook to `~/.claude/settings.json` if not present:
  ```json
  {
    "hooks": {
      "Stop": [{
        "matcher": "*",
        "hooks": [{"type": "command", "command": "bash ~/.claude/super-gsd/scripts/sgsd-stop-handoff.sh", "timeout": 60}]
      }]
    }
  }
  ```
- Idempotent — don't duplicate existing Stop hook

### D-08: Test strategy (safety-first)
No auto-spawn happens during dev/test. Add `--dry-run` flag to sgsd-stop-handoff.sh that walks all pre-conditions + would-spawn log line WITHOUT invoking claude CLI. CI / self-test uses --dry-run.

Integration test: manually force an emergency_halt checkpoint, invoke sgsd-stop-handoff.sh --dry-run, confirm log row + would-spawn args match expected.

### Claude's Discretion
- Exact Claude CLI flags for non-interactive spawn (`--print` vs `--non-interactive` vs raw CLI — research will confirm)
- Cooldown measurement (wall-clock vs cumulative session time)
- MC tile position in mission-control pane (below Codex tile vs side-by-side)
- Chain-depth reset triggers (operator-driven session start detection)

</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` §HANDOFF-01..03 — AC verbatim
- `.planning/ROADMAP.md` §"Phase 20" — phase structure + design invariant

### Source files in scope
- `super-gsd/scripts/sgsd-stop-handoff.sh` — NEW (HANDOFF-01)
- `super-gsd/config/settings-overlay.json` — Stop hook wire-up (HANDOFF-01)
- `.planning/config.json` — handoff block (HANDOFF-02)
- `super-gsd/scripts/sgsd-mission-control.ps1` — SGSD-Handoff-Tile (HANDOFF-03)
- `super-gsd/scripts/lib/sgsd-codex-status.ps1` OR new `sgsd-handoff-status.ps1` — helper functions for MC tile (HANDOFF-03)
- `super-gsd/install.sh` — idempotent Stop hook wiring (installer integration)

### Session tracking
- `CLAUDE_SESSION_ID` env var (Claude Code CLI) — session id source
- `sgsd-session-start.js` hook — already installed, fires on every session start; Phase 20 extends to record to-session_id

### Telemetry consumers (already-existing surfaces)
- `super-gsd/scripts/sgsd-token-audit.ps1` OR equivalent — gets `--milestone-close-check` extension
- `super-gsd/scripts/sgsd-mission-control.ps1` — MC-01 tile from Phase 19 (coexists with new Handoff tile)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Claude Code Stop hook convention — same pattern as sgsd-activity-logger PreToolUse. Fire-and-forget, short timeout, exit 0 always.
- `sgsd-session-start.js` already fires on session start — Phase 20 extends to write the to_session_id row.
- Existing ORCHESTRATOR-CHECKPOINT.md schema has `emergency_halt: true|false` + `phase_state` (discussing|planning|executing|verifying) — perfect for the handoff decision.
- codex-exec.sh shows the bash idiom for reading config.json via Node (used by D-04 handoff config shape).

### Established Patterns
- Atomic commits: `feat(20-NN/TX): HANDOFF-NN ...`
- Node read-mutate-write for config/metrics (no cat/head/echo)
- ASCII-only shell strings (Phase 17 UTF-8 lesson)
- Dry-run flags for test safety (D-08)

### Integration Points
- `settings-overlay.json` gains Stop hook entry — installer copies to `~/.claude/settings.json`
- `config.json.handoff` block — read by sgsd-stop-handoff.sh; optional so pre-existing installs work
- MC-01 tile from Phase 19 stays; Handoff tile sits adjacent — they share nothing except the mission-control pane

</code_context>

<specifics>
## Specific Ideas

- **This is the FINAL phase of v1.4.** After it ships, rule 6.7 milestone-complete auto-trigger fires (per SKILL.md). v1.4 closes with all 17 REQ-IDs delivered.
- Narrative race conditions (Phase 19 deferred) will surface HERE — Phase 20's multi-session chaining is the first time two codex-exec instances could run concurrently. If narrative.md writes race, a handoff smoke test would catch it.
- **Safety-first in execution:** no real auto-spawn during Phase 20 development. Use `--dry-run` exclusively until Phase 20 is merged + operator gives explicit go-ahead to enable handoff in config.
- Stop hook timeout is tricky: Claude Code default stop-hook timeout is 60s; spawn must complete quickly (< 30s for safety margin).
- Chain depth should count handoffs WITHIN an unattended run — not lifetime. Reset triggered by operator interaction signal (detected how? — research TODO).

</specifics>

<deferred>
## Deferred Ideas

- Multi-process coordination (two parallel chains) — single-chain only
- Remote/cloud handoff (local spawn only)
- Custom session-id generation — use CLAUDE_SESSION_ID
- Cross-machine handoff — out of scope
- Retry on spawn failure — one-shot per halt
- Handoff for non-emergency halts — only fires on emergency_halt: true

</deferred>

---

*Phase: 20-autonomous-handoff*
*Milestone: v1.4 Clean Close + Codex Visibility + Autonomous Handoff*
*Context gathered: 2026-04-24 (inline — no discuss-phase run per design invariant)*
*FINAL PHASE: after close, milestone v1.4 → rule 6.7 auto-close*
