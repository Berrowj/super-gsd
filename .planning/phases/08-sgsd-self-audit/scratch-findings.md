# Scratch Findings — SGSD Self-Audit (Wave 1: Skills + Agents)

Appended by Wave 1 executor. Format: FINDING-N per RESEARCH.md section 3.

---

## FINDING-1 — Board agents dispatched by description, never by subagent_type
Area: agents
Severity: high
File: super-gsd/skills/sgsd-deliberate/SKILL.md:84
Evidence: "Agent(description: \"Architect analysis\", model: \"sonnet\", prompt: \"..."
Analysis: sgsd-deliberate dispatches all four board members using a bare description string ("Architect analysis", "Pragmatist analysis", etc.) with no `subagent_type` binding. Claude Code's agent resolution matches `subagent_type` against the installed agent's `name:` frontmatter field. Without `subagent_type`, the four installed board agent files (sgsd-board-architect.md, sgsd-board-contrarian.md, sgsd-board-moonshot.md, sgsd-board-pragmatist.md) are never definitively selected — Claude Code may pick any installed agent with a vaguely matching description or invent behavior. The board agents are installed but functionally unlinked from their dispatch site.
Fix (one line): Replace each `Agent(description: "...")` with `Agent(subagent_type: "sgsd-board-architect", ...)` etc. in sgsd-deliberate/SKILL.md.

---

## FINDING-2 — sgsd-ceo listed in dispatch-table.md but never invoked by sgsd-deliberate SKILL.md
Area: agents
Severity: high
File: super-gsd/workflows/dispatch-table.md:18
Evidence: "| 1 | Deliberation needed | classifier.deliberate == true | Suggest /sgsd-deliberate | sgsd-ceo | opus |"
File: super-gsd/skills/sgsd-deliberate/SKILL.md:84
Evidence: "Agent(description: \"Architect analysis\", model: \"sonnet\", ..."
Analysis: The dispatch-table documents that rule 1 (deliberation needed) routes to the `sgsd-ceo` agent (model: opus). In practice, sgsd-deliberate/SKILL.md implements the entire board deliberation inline — it spawns board members directly and synthesizes the memo itself; sgsd-ceo is never dispatched via `subagent_type: "sgsd-ceo"` anywhere in any skill. The sgsd-ceo agent is installed and has the correct workflow, but the invocation path documented in dispatch-table.md does not match the actual execution path in the skill. A user reading the dispatch-table expects /sgsd-deliberate to hand off to sgsd-ceo; instead it handles everything itself.
Fix (one line): Either update dispatch-table.md row 1 to reflect the inline execution path, or refactor sgsd-deliberate to dispatch `Agent(subagent_type: "sgsd-ceo", ...)` and remove the duplicated board orchestration logic.

---

## FINDING-3 — Agent name fields contain typo prefixes (ssgsd-* and sgsd-sgsd-*)
Area: agents
Severity: high
File: super-gsd/agents/sgsd-ceo.md:2
Evidence: "name: ssgsd-ceo"
File: super-gsd/agents/sgsd-board-architect.md:2
Evidence: "name: sgsd-sgsd-board-architect"
Analysis: The `name:` frontmatter field is the key Claude Code uses to resolve `subagent_type:` lookups. Five of seven sgsd agent files have mangled name values: sgsd-ceo.md has `name: ssgsd-ceo` (double-s prefix), all four board agent files have `name: sgsd-sgsd-board-*` (doubled prefix). sgsd-classifier.md has `name: ssgsd-classifier` and sgsd-context-selector.md has `name: ssgsd-context-selector`. Only the board agents and ceo are reached today via description-only dispatch (FINDING-1), but sgsd-classifier and sgsd-context-selector ARE dispatched via `subagent_type: "sgsd-classifier"` (orchestrate SKILL.md:94) and `subagent_type: "sgsd-context-selector"` (orchestrate SKILL.md:119). If Claude Code resolves subagent_type by exact name match, these two agents will silently fail to match and Claude will pick a fallback or fail. This is a critical routing breakage for the orchestrate loop.
Fix (one line): Correct all seven agent `name:` fields to remove the doubled prefix (e.g. `ssgsd-ceo` → `sgsd-ceo`, `sgsd-sgsd-board-architect` → `sgsd-board-architect`).

---

## FINDING-4 — gsd-list-phase-assumptions referenced in orchestrate SKILL.md:562 but not installed
Area: skills
Severity: high
File: super-gsd/skills/sgsd-orchestrate/SKILL.md:562
Evidence: "Enforced by: gsd-list-phase-assumptions + gsd-discuss-phase before planning."
Analysis: Line 562 of sgsd-orchestrate/SKILL.md documents that Karpathy Principle (1) "Think Before Coding" is enforced by the command `gsd-list-phase-assumptions`. Inspection of `~/.claude/commands/` confirms this command is not installed — the directory contains only the nine sgsd-* skill directories plus VTPidea.md. There is no `gsd-list-phase-assumptions` command or skill directory. The principle is documented as mechanically enforced, but the enforcement mechanism is absent. Users following the orchestrator loop in good faith will never trigger this gate.
Fix (one line): Either install gsd-list-phase-assumptions as a command/skill or update line 562 to remove the reference and describe the actual enforcement mechanism in place.

---

## FINDING-5 — VTPidea.md present in .claude/commands/ with no super-gsd source, no docs, no skill directory
Area: skills
Severity: low
File: super-gsd/skills/ (directory — no VTPidea entry)
Evidence: "ls ~/.claude/commands/ → VTPidea.md" (orphan — no super-gsd/skills/VTPidea/ directory)
Analysis: `.claude/commands/VTPidea.md` exists as a flat file (not a skill subdirectory) and implements a 9-stage VTP idea gate pipeline using an MCP tool (`vtp_idea_gate`). There is no corresponding source file in `super-gsd/skills/`, no mention in any super-gsd doc file (README.md, USER-GUIDE.md, SGSD-WORKSPACE-GUIDE.md), and no install pathway in install.sh. It was likely manually placed and is project-specific to the VTP project. As a framework-level installed command it is visible to any project using this .claude setup, creating potential confusion for non-VTP projects. SESSION-DEBRIEF.md confirms this is project-specific content.
Fix (one line): Move VTPidea.md to a project-specific location (e.g. the VTP project's .claude/commands/ directory) or document it explicitly as a project extension in super-gsd/README.md.

---

## FINDING-6 — sgsd-deliberate SKILL.md does not dispatch sgsd-ceo; workflow is fully inlined, creating duplicate logic with sgsd-ceo.md
Area: agents
Severity: medium
File: super-gsd/skills/sgsd-deliberate/SKILL.md:78
Evidence: "<step_3_round1> ## Step 3: Spawn Board Members (Round 1) Spawn 4 agents IN PARALLEL"
File: super-gsd/agents/sgsd-ceo.md:8
Evidence: "<workflow> 1. Read the brief ... 4. Spawn 4 board members IN PARALLEL with brief + role + relevant expertise"
Analysis: The board orchestration workflow is implemented twice: once inside sgsd-deliberate/SKILL.md (Steps 3-5) and once inside sgsd-ceo.md (the full <workflow> block). Both describe spawning 4 board members in parallel, running up to 3 rounds, and synthesizing a Decision Memo. Termination rules in sgsd-ceo.md (hard cap 3 rounds, no-movement detection, max_rounds brief field) are more detailed than those in sgsd-deliberate/SKILL.md. If /sgsd-deliberate is used it runs the simpler inline version and sgsd-ceo's richer termination logic is never applied. This is a maintenance hazard: any update to deliberation rules must be applied in two places.
Fix (one line): Remove the inline board orchestration from sgsd-deliberate/SKILL.md and replace Steps 3-5 with a single `Agent(subagent_type: "sgsd-ceo", ...)` dispatch.

---

# Scratch Findings — SGSD Self-Audit (Wave 2: Scripts + Tools)

Appended by Wave 2 executor.

---

## FINDING-7 — sgsd-dashboard.ps1 is a polling predecessor of sgsd-mission-control.ps1 with no .cmd wrapper or docs
Area: scripts
Severity: medium
File: super-gsd/scripts/sgsd-dashboard.ps1:1
Evidence: "# Super GSD Project Dashboard - Full Stats ... [int]$RefreshSec = 10"
File: super-gsd/scripts/sgsd-mission-control.ps1:4
Evidence: "# Reactive live dashboard. Uses FileSystemWatcher to redraw only when source files change. No polling flicker."
Analysis: Both scripts display milestone header, phase progress, session cost, and agent status — identical conceptual purpose. sgsd-dashboard.ps1 uses a polling loop (`Start-Sleep $RefreshSec`) while sgsd-mission-control.ps1 replaced it with a FileSystemWatcher (reactive, no flicker, per P3 workspace spec). sgsd-mission-control.ps1 is exposed as `sgsd1.cmd` in %APPDATA%\npm. sgsd-dashboard.ps1 has no .cmd wrapper, is not referenced in MONITORING-SETUP.md or SGSD-WORKSPACE-GUIDE.md, and is unreachable from any installed skill or wrapper. It is a dead predecessor that will cause confusion for any contributor looking at the scripts directory.
Fix (one line): Delete sgsd-dashboard.ps1 or add a comment header marking it as superseded by sgsd-mission-control.ps1; document the decision in MONITORING-SETUP.md.

---

## FINDING-8 — sgsd-agent-dashboard.ps1 and sgsd-agent-dashboard.sh have no .cmd wrapper and are absent from SGSD-WORKSPACE-GUIDE.md
Area: scripts
Severity: medium
File: super-gsd/scripts/sgsd-agent-dashboard.ps1:1
Evidence: "# Super GSD Agent Dashboard - Windows PowerShell ... Usage: .\gsd-agent-dashboard.ps1"
File: super-gsd/docs/MONITORING-SETUP.md:86
Evidence: "bash /path/to/super-gsd/scripts/sgsd-agent-dashboard.sh /path/to/project"
Analysis: MONITORING-SETUP.md describes sgsd-agent-dashboard as "Layer 3: Agent Dashboard (Separate Terminal)" and tells users to run `bash sgsd-agent-dashboard.sh` or `.\sgsd-agent-dashboard.ps1`. However, SGSD-WORKSPACE-GUIDE.md §6 defines only three dashboard slots (P3 sgsd1, P4 sgsd2, P5 sgsd3) and the Warp launch config uses only those three. There is no sgsd4.cmd wrapper for sgsd-agent-dashboard. The MONITORING-SETUP.md guide is inconsistent with the workspace guide: the former promotes agent-dashboard as the primary "Layer 3" view; the latter promotes mission-control (sgsd1) as the primary view with agent-dashboard omitted entirely from the workspace layout and installer.
Fix (one line): Reconcile MONITORING-SETUP.md Layer 3 description with the workspace guide — either create sgsd4.cmd and add a fourth pane to the Warp launch config, or update MONITORING-SETUP.md to mark agent-dashboard as superseded by sgsd-mission-control.

---

## FINDING-9 — sgsd-live-feed.ps1 and sgsd-thinking.ps1 are dead scripts: no .cmd wrapper, no skill caller, no docs entry
Area: scripts
Severity: medium
File: super-gsd/scripts/sgsd-live-feed.ps1:1
Evidence: "# Super GSD Live Activity Feed - Simple scrollable live tail"
File: super-gsd/scripts/sgsd-thinking.ps1:18
Evidence: "[string]$Project = \"project-clarity-erp\""
Analysis: Neither sgsd-live-feed.ps1 nor sgsd-thinking.ps1 appears in MONITORING-SETUP.md, SGSD-WORKSPACE-GUIDE.md, or any SKILL.md file (grep across super-gsd/skills confirms zero hits). Neither has a .cmd wrapper in %APPDATA%\npm. sgsd-thinking.ps1 is additionally project-specific: it hardcodes the project slug `project-clarity-erp` in its default parameter (line 18), making it non-generic and unusable for any other project without editing the script. These scripts are completely unreachable from any documented workflow.
Fix (one line): Delete both scripts or move sgsd-thinking.ps1 to the project-clarity-erp repo and document sgsd-live-feed.ps1 in MONITORING-SETUP.md with a .cmd wrapper if it is intended for use.

---

## FINDING-10 — phase-verifier.mjs hard-fails on missing config.browser_verify but planning-config-overlay.json omits the key (confirms G1)
Area: tools
Severity: critical
File: super-gsd/tools/phase-verifier/phase-verifier.mjs:101
Evidence: "if (!cfg.browser_verify) fail('config.json missing browser_verify block', 2);"
Analysis: phase-verifier.mjs exits with code 2 (BLOCKED) if `.planning/config.json` lacks a `browser_verify` block. The orchestrator treats exit 2 as a hard halt. The planning-config-overlay.json template (confirmed in research G1) does not include a `browser_verify` key. Any project that installs Super GSD and runs the orchestrator through the Step 6.6 frontend verify gate will receive an immediate BLOCKED exit before any browser action occurs. The SGSD-WORKSPACE-GUIDE.md §7 documents the required block but the installer does not inject it, so first-time users must manually add it. This is a critical runtime blocker for every new install.
Fix (one line): Add a `browser_verify` template block (with `enabled: false` as default) to super-gsd/config/planning-config-overlay.json so the installer seeds the key automatically.

---

## FINDING-11 — sgsd-narrative.ps1 (sgsd2) silently shows empty top panel when sgsd-activity-logger.js hook is absent (G4 consequence)
Area: scripts
Severity: high
File: super-gsd/scripts/sgsd-narrative.ps1:33
Evidence: "$ActivityLog = Join-Path $PlanningDir \"metrics\\activity-log.jsonl\""
Analysis: sgsd-narrative.ps1 reads `.planning/metrics/activity-log.jsonl` for its top-panel Haiku narrative. This file is written exclusively by sgsd-activity-logger.js. FINDING-4 (Wave 3 scope, pre-identified as G4) establishes that sgsd-activity-logger.js is not registered in settings-overlay.json. If the hook is absent, activity-log.jsonl is never written, and the sgsd2/P4 top panel shows only "No recent activity" indefinitely. The script does not warn the user that the underlying hook is absent — it silently falls back to empty state. A user following the SGSD-WORKSPACE-GUIDE.md will have sgsd2 running but never see the narrative panel populate.
Fix (one line): Add a sentinel check in sgsd-narrative.ps1 that prints a visible warning when activity-log.jsonl does not exist, explaining that the sgsd-activity-logger.js hook must be registered.

---

## FINDING-12 — phase-verifier.mjs is untested on Linux/macOS: README documents install path but tool has no platform guard or CI coverage
Area: tools
Severity: low
File: super-gsd/tools/phase-verifier/README.md:123
Evidence: "Linux/macOS: curl -fsSL https://raw.githubusercontent.com/gsd-build/gsd-browser/main/install.sh | bash"
File: super-gsd/tools/phase-verifier/phase-verifier.mjs:1
Evidence: "#!/usr/bin/env node"
Analysis: The README documents Linux/macOS installation of gsd-browser and implies phase-verifier.mjs runs on those platforms. The tool itself uses only Node.js built-ins (node:fs, node:path, node:child_process) so it should be portable. However, the tool contains no platform check, there is no CI workflow in the repository covering Linux/macOS execution, and no test fixtures exist under super-gsd/tools/phase-verifier/ beyond the single .mjs file and its README. The SGSD-WORKSPACE-GUIDE.md explicitly notes that dashboard scripts are PowerShell-only and suggests waiting for a "bash port" (§6), but does not flag the verifier as having the same limitation. The Linux/macOS status of phase-verifier.mjs is undeclared.
Fix (one line): Add a `## Platform support` section to phase-verifier README.md explicitly stating tested platforms (currently: Windows + WSL) and linking any future CI results.

---

# Scratch Findings — SGSD Self-Audit (Wave 3: Hooks + Config)

Appended by Wave 3 executor.

---

## FINDING-13 — sgsd-activity-logger.js and sgsd-statusline.js absent from settings-overlay.json (G4/G5 confirmed)
Area: hooks
Severity: high
File: super-gsd/config/settings-overlay.json:1
Evidence: (full file contains SessionStart + four PostToolUse entries — sgsd-activity-logger.js and sgsd-statusline.js are not present)
File: super-gsd/hooks/sgsd-activity-logger.js:14
Evidence: "Install in settings.json: { \"hooks\": { \"PreToolUse\": [{ \"matcher\": \"*\", \"hooks\": [...sgsd-activity-logger.js...] }] } }"
File: super-gsd/hooks/sgsd-statusline.js:14
Evidence: "Install: add to settings.json statusLine config: { \"statusLine\": { \"type\": \"command\", \"command\": \"node ~/.claude/hooks/gsd-super-statusline.js\" } }"
Analysis: settings-overlay.json registers five hooks: gsd-session-start.js (SessionStart), gsd-token-logger.js, gsd-stuck-detector.js, gsd-checkpoint-writer.js, gsd-context-monitor.js (all PostToolUse). The two sgsd-prefixed hooks — sgsd-activity-logger.js (PreToolUse/*) and sgsd-statusline.js (statusLine) — are completely absent from the overlay. A user who merges settings-overlay.json into their ~/.claude/settings.json, as instructed, will not have either hook active. sgsd-activity-logger.js is the sole writer of activity-log.jsonl (on which sgsd-narrative.ps1/sgsd2 depends per FINDING-11). sgsd-statusline.js is the sole source of the live compact status bar shown in MONITORING-SETUP.md. Both are silently dead after install.
Fix (one line): Add a PreToolUse entry for sgsd-activity-logger.js and a statusLine entry for sgsd-statusline.js to super-gsd/config/settings-overlay.json.

---

## FINDING-14 — sgsd-statusline.js install comment references wrong filename (gsd-super-statusline.js)
Area: hooks
Severity: medium
File: super-gsd/hooks/sgsd-statusline.js:18
Evidence: "\"command\": \"node ~/.claude/hooks/gsd-super-statusline.js\""
Analysis: The file on disk is named `sgsd-statusline.js`. install.sh copies all hooks/*.js to ~/.claude/hooks/ preserving their names (install.sh:117: `copy_file "$hook" "$HOOKS_DIR/$name"`), so the installed file will be `~/.claude/hooks/sgsd-statusline.js`. However, the install comment inside the file itself instructs the user to reference `gsd-super-statusline.js` — the wrong filename. A user following the in-file install instructions will register a command that points to a non-existent file, causing the statusline to silently fail (empty or error state). This is a self-defeating install instruction.
Fix (one line): Change line 18 of sgsd-statusline.js from `gsd-super-statusline.js` to `sgsd-statusline.js` to match the actual installed filename.

---

## FINDING-15 — Only 1 of 7 hook files has a gsd-hook-version header; no VERSION file exists in super-gsd/
Area: hooks
Severity: low
File: super-gsd/hooks/sgsd-statusline.js:3
Evidence: "// gsd-hook-version: super-gsd-1.0"
File: super-gsd/hooks/gsd-checkpoint-writer.js:1
Evidence: (no gsd-hook-version line in first 20 lines — same for gsd-context-monitor.js, gsd-session-start.js, gsd-stuck-detector.js, gsd-token-logger.js, sgsd-activity-logger.js)
Analysis: The Wave 3 audit spec requires every hook to carry a `// gsd-hook-version:` header matching the installed VERSION file. Only sgsd-statusline.js has this header. The remaining six hooks (gsd-checkpoint-writer.js, gsd-context-monitor.js, gsd-session-start.js, gsd-stuck-detector.js, gsd-token-logger.js, sgsd-activity-logger.js) have no version header at all. Additionally, no `super-gsd/VERSION` file exists — `ls super-gsd/` confirmed the file is absent — so even if headers were present there is no canonical version string to match against. Version skew between installed hooks and the source repo is undetectable.
Fix (one line): Create super-gsd/VERSION with an initial value (e.g. `1.0.0`) and add a `// gsd-hook-version: 1.0.0` header to all six remaining hook files.

---

## FINDING-16 — config.workflow.nyquist_validation referenced in sgsd-orchestrate SKILL.md:569 is absent from planning-config-overlay.json (G2 confirmed)
Area: config
Severity: high
File: super-gsd/skills/sgsd-orchestrate/SKILL.md:569
Evidence: "Enforced by: Nyquist validation gate (config.workflow.nyquist_validation)."
File: super-gsd/config/planning-config-overlay.json:3
Evidence: "\"workflow\": { \"mode\": \"yolo\", \"granularity\": \"standard\", \"skip_discuss\": false, \"research\": true, \"plan_check\": true, \"verifier\": true, \"auto_advance\": true, \"plan_format\": \"compressed_xml\", \"agent_report_max_words\": 300 }"
Analysis: The orchestrate SKILL.md documents that Karpathy Principle (4) "Goal-Driven Execution" is enforced by a Nyquist validation gate gated on `config.workflow.nyquist_validation`. The `workflow` block in planning-config-overlay.json has nine keys and does not include `nyquist_validation`. When install.sh copies planning-config-overlay.json to `.planning/config.json` (install.sh:237), all new projects will have a config.json that lacks this key. Any skill code that reads `config.workflow.nyquist_validation` will receive `undefined`, silently disabling the gate without any warning to the user.
Fix (one line): Add `"nyquist_validation": true` to the `workflow` block in super-gsd/config/planning-config-overlay.json.

---

## FINDING-17 — install.sh never merges settings-overlay.json into ~/.claude/settings.json; all five registered hooks are uninstalled on a fresh run
Area: hooks
Severity: critical
File: super-gsd/install.sh:110
Evidence: "Step 3/8: Installing hooks + query engine..." (copies *.js to ~/.claude/hooks/ but never touches settings.json)
File: super-gsd/config/settings-overlay.json:2
Evidence: "\"_comment\": \"Merge these into ~/.claude/settings.json to enable Super GSD hooks\""
Analysis: install.sh Step 3 copies all hook JS files to `~/.claude/hooks/` correctly. However, the installer never reads, merges, or writes `~/.claude/settings.json`. The settings-overlay.json comment acknowledges this is a manual step ("Merge these into ~/.claude/settings.json"), but no install step automates it and no post-install instruction in the terminal output directs the user to do so (the Step 3 log line says only "$HOOK_COUNT hooks + 1 query engine installed", implying completion). A user running `bash install.sh` with no prior knowledge will have hook files on disk but zero hooks active in Claude Code — gsd-session-start.js will never fire, gsd-token-logger.js will never fire, etc. This silently breaks the entire hook layer for every new install.
Fix (one line): Add a Step 3b to install.sh that either auto-merges settings-overlay.json into ~/.claude/settings.json using `node -e` jq-style JSON merge, or prints a mandatory post-install warning with the exact merge instruction.

---

## FINDING-18 — brv-curate-local.js installed only to ~/.claude/templates/overwatcher/, not to ~/.claude/hooks/; brv-curate bare command has no alias (G3 confirmed)
Area: config
Severity: critical
File: super-gsd/install.sh:132
Evidence: "for ow in \"$SCRIPT_DIR/overwatcher/\"*.js ... copy_file \"$ow\" \"$TEMPLATES_DIR/overwatcher/$name\""
File: super-gsd/workflows/orchestrate-loop.md:437
Evidence: "# Step 9: Curate Learnings (brv-curate-local.js)\nBRV_CURATE=\"$(find super-gsd/overwatcher ~/.claude/hooks -name brv-curate-local.js 2>/dev/null | head -1)\""
File: super-gsd/CLAUDE-OVERLAY.md:133
Evidence: "If SCRIPTS_CREATED → brv-curate to scripts/"
Analysis: CLAUDE-OVERLAY.md and all skill files reference `brv-curate` as a bare command. install.sh creates no alias for `brv-curate` anywhere — it installs only `brv-query-local.js` directly to `~/.claude/hooks/` (install.sh:121). `brv-curate-local.js` is copied to `~/.claude/templates/overwatcher/` (not hooks/), which is not on any execution PATH. The orchestrate-loop.md Step 9 works around this with a `find` fallback, but skills and CLAUDE-OVERLAY.md use the bare `brv-curate` form which will resolve only if the ByteRover CLI (`npm install -g byterover-cli`) is installed and its `brv curate` subcommand maps to the same interface — unconfirmed. The research open question 2 (whether brv-curate-local.js goes to hooks/) is now resolved: it does NOT. Every `brv-curate` bare call in skills and overlay is broken unless the user has the paid ByteRover CLI installed separately.
Fix (one line): Copy brv-curate-local.js to `$HOOKS_DIR/` alongside brv-query-local.js in install.sh Step 3, and add `alias brv-curate="node ~/.claude/hooks/brv-curate-local.js"` to the user's shell profile as part of the install summary.

**STATUS (2026-04-19): SUPERSEDED by DLB-01 (`.planning/decisions/DLB-01-memory-topology.md`).**
The stated fix would install the old `brv-query` / `brv-curate` interface that DLB-01 decided to replace. Instead shipped: `super-gsd/scripts/sgsd-recall.sh` + `sgsd-curate.sh` shell wrappers over `.brv/context-tree/` + `INDEX.md` catalogue. The broken pipe is resolved by replacement, not by repairing the deprecated interface. Legacy JS engines (`brv-query-local.js`, `brv-curate-local.js`) preserved in `super-gsd/overwatcher/` for future BM25 backing when the corpus earns it (DLB-01 tripwire: 40 files). Next action: rewire 8 `brv-query` / `brv-curate` call-sites in CLAUDE-OVERLAY.md + agent specs to the new wrappers (tracked separately).
