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
