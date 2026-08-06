---
phase: "146"
artifact: RESEARCH
provider: openai-codex (gpt-5.5/xhigh)
dispatched: 2026-08-06 --step phase-research --timeout-tier custom:900
wrapper_exit: 6 (contract-vocab mismatch — codex-exec enforces the 5-line ATC
  contract on every --step, including research; report body itself is valid.
  Raw 2.6MB stream discarded; body extracted verbatim below. See DEVIATION-W.)
sandbox_note: Codex sandbox could not write files, so it returned the report
  inline on stdout rather than to --report-out.
---

I stayed read-only. There was no report path provided and the sandbox cannot write files, so the implementation-ready report is below.

**1. AC-146**
> **AC-146:** (a) an `sg`-launched manual session shows the governance contract in its first response with zero operator action; (b) a planning-shaped prompt in a manual session produces a visible `/sgsd-triage` directive; (c) a source edit with no PLAN for the active phase produces a gate-evidence row and a cockpit signal within one refresh; (d) all hooks exit 0 in a non-SGSD repo.

Source: `.planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md:83-87`.

**2. Q1-Q9**
Q1. Local Claude Code is `2.1.222`. Schema is `"hooks": { Event: [{ matcher?, hooks: [{ type:"command", command, args?, timeout? }] }] }`; repo-local scope is `.claude/settings.json` (`code.claude.com/docs/en/hooks` lines 390-401). Inputs arrive as JSON on stdin with common `session_id`, `transcript_path`, `cwd`, `hook_event_name` (`lines 769-781`). `SessionStart` adds `source`/optional `model` (`lines 1055-1073`); stdout or `hookSpecificOutput.additionalContext` becomes first-turn context (`lines 1080-1097`). `UserPromptSubmit` adds `prompt` (`lines 1245-1256`), stdout/JSON context is injected (`lines 1261-1266`), and `decision:"block"` blocks (`lines 1269-1273`). `PostToolUse` gets `tool_name`, `tool_input`, `tool_response`, `duration_ms` (`lines 1773-1797`). Report-only is achievable: exit 0, omit `decision`, omit `continue:false`; exit 2 blocks UserPromptSubmit but cannot undo PostToolUse (`lines 813-831`, `839-858`).

Q2. This worktree has no `.claude/settings.json`, so current active repo-local hook latency is 0. Existing overlay registers `SessionStart` old `gsd-session-start.js`, no `UserPromptSubmit`, and five `PostToolUse` entries (`super-gsd/config/settings-overlay.json:7-82`). Hooks run in parallel, so latent wall cap is the slowest matching timeout, not sum (`hooks-guide` lines 510, 553-577): SessionStart 5s, PostToolUse up to 3s, Stop 60s. Collision risk: overlay uses old `gsd-session-start.js` while newer `sgsd-session-start.js` has handoff pairing (`super-gsd/hooks/sgsd-session-start.js:14-21`, `72-99`).

Q3. Existing phase parser is inline, not reusable: `readActivePhase(root)` uses `SGSD_ACTIVE_PHASE`, then STATE frontmatter `current_phase|phase` (`super-gsd/hooks/sgsd-activity-logger.js:72-91`). Watchdog currently falls through to prose regex `status.match(/\bPhase\s+([0-9]+)\b/i)` and progress-row regex `phase_([0-9]+)` (`super-gsd/tools/autopilot-watchdog/check.cjs:119-130`). Extract shared `sgsd-state.cjs` and call that instead.

Q4. Latch is set by deriving `CHAIN_DEPTH=PREV_CHAIN_DEPTH+1` from last spawned row only (`super-gsd/scripts/sgsd-stop-handoff.sh:448-523`). Refused rows do not reset because parser filters only `reason === 'spawned'` (`:485-500`). Minimal fix: if the latest valid row is `reason:"refused"`, set previous depth to 0 before calculating chain depth. Board evidence confirms refused depth 5 latched since `2026-04-24T15:55:17Z` (`.planning/analyses/2026-08-02-always-on-gates-and-context-handover-PLAN.md:228`).

Q5. Classifier: single Node script, stdin JSON, lowercase prompt, fixed phrase/regex lexicon from `sgsd-triage` trigger block (`super-gsd/skills/sgsd-triage/SKILL.md:16-29`) and CLAUDE overlay (`super-gsd/CLAUDE-OVERLAY.md:112-129`). “Neglected-skill signature” means deterministic prompt patterns that imply an SGSD skill should have fired, e.g. token spend -> `/sgsd-token-audit`, waste/retro -> `/sgsd-muda-audit`, strategic tradeoff -> `/sgsd-deliberate`. P149’s missing `super-gsd/registry/skill-routing.yaml` becomes the data source later (`DESIGN.md:131-143`); for P146 embed `DEFAULT_SIGNATURES` and make registry read the only swap.

Q6. `.planning/metrics/gate-evidence.jsonl` does not exist. Existing consumers read `gate-value-log.jsonl` and `review-ledger.jsonl`, not gate-evidence (`super-gsd/tools/cockpit-state/adapter.cjs:935-954`, `super-gsd/tools/warp-mcp/server.cjs:1485-1533`). Row shape should reuse envelope-v1: required fields plus extensions, following `gate-value-log.cjs` schema and never-throw writer (`super-gsd/scripts/lib/gate-value-log.cjs:19-41`, `257-277`). Add cockpit consumer wiring or AC-146c will log but not signal.

Q7. Current installer is global: copies hooks to `~/.claude/hooks` and merges `settings-overlay.json` into `~/.claude/settings.json` (`super-gsd/install.sh:348-372`). Merge is additive/idempotent by command+matcher and preserves existing keys (`super-gsd/scripts/merge-settings.js:15-27`, `190-217`). P146 must add a repo-local merge path targeting `<repo>/.claude/settings.json`, never home settings, using `args` or install-time absolute target paths.

Q8. `gsd-atc-slice-gate.js` is not present in `super-gsd/hooks` and grep only finds planning notes, not source registration. Dead knobs: `token_efficiency.checkpoint_threshold_percent`, `token_efficiency.context_warning_percent`, `hooks.context_warnings`; board explicitly says delete/deprecate them (`2026-08-02...PLAN.md:232`). Fresh grep found declarations in config/overlays plus historical planning, no runtime readers.

Q9. Risks: hook stacking on every prompt/tool; non-SGSD repo must root-walk and exit 0; Windows quoting argues for `command:"node", args:[...]`; hook `cwd` may differ, so root walk from `payload.cwd || process.cwd()`; STATE currently lacks `current_phase` frontmatter, so parser may return null unless STATE writer is fixed (`.planning/STATE.md:1-13`).

**3. Files**
Create `super-gsd/scripts/lib/sgsd-state.cjs` shared root/STATE/PLAN-LOCKED resolver.  
Create `super-gsd/scripts/lib/gate-evidence-log.cjs` envelope writer for `gate-evidence.jsonl`.  
Modify `super-gsd/hooks/sgsd-session-start.js` for governance contract injection.  
Create `super-gsd/hooks/sgsd-intent-classifier.cjs`.  
Create `super-gsd/hooks/sgsd-quality-gate.js`.  
Modify installer/settings overlay for repo-local `.claude/settings.json`.  
Modify `sgsd-stop-handoff.sh`, `autopilot-watchdog/check.cjs`, config dead knobs.

**4. Reuse**
Reuse `gate-value-log.cjs` envelope pattern; extract `readActivePhase` from `sgsd-activity-logger.js`; reuse root walk patterns from `sgsd-heartbeat.js`; use `merge-settings.js` idempotency logic, but target project settings.

**5. Tasks**
1. Shared state + ledger helpers.  
2. Repo-local installer hook wiring.  
3. SessionStart contract injection.  
4. UserPromptSubmit classifier + latency bench.  
5. PostToolUse quality gate + cockpit consumer.  
6. Cheap fixes cleanup.

**6. Verification**
`node --check super-gsd/scripts/lib/sgsd-state.cjs super-gsd/hooks/sgsd-intent-classifier.cjs super-gsd/hooks/sgsd-quality-gate.js`  
`powershell -NoProfile -Command "1..200 | % { '{\"hook_event_name\":\"UserPromptSubmit\",\"prompt\":\"How should we plan this?\"}' | node super-gsd/hooks/sgsd-intent-classifier.cjs > $null }"`  
`node -e "require('./super-gsd/scripts/lib/gate-evidence-log.cjs')"`  
`powershell -NoProfile -Command "Select-String -Path .claude/settings.json -Pattern 'UserPromptSubmit','SessionStart','PostToolUse'"`  
`bash -n super-gsd/scripts/sgsd-stop-handoff.sh`  
`rg "checkpoint_threshold_percent|context_warning_percent|context_warnings" .planning super-gsd`

**7. Open Decisions**
STATE frontmatter needs a canonical `current_phase` key. Decide whether `gate-evidence.jsonl` is new canonical stream or `gate-value-log` extension. Decide install-time absolute paths vs `${CLAUDE_PROJECT_DIR}`. Verify actual mutation tool names in this harness before including `MultiEdit`.

