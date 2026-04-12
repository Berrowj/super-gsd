# Phase 8: SGSD Self-Audit — Research

**Researched:** 2026-04-11
**Domain:** Super GSD framework gap analysis — skills, agents, scripts, tools, hooks, config, docs
**Confidence:** HIGH (all findings based on direct filesystem inspection and grep verification)

---

## Summary

The Super GSD framework ships 9 skills, 7 sgsd-specific agents (+ 24 base GSD agents), 10 scripts (8
PowerShell, 2 bash), 1 tool package (phase-verifier), 7 hook files, 3 config files, and 3 doc files.
Direct inspection reveals three classes of gaps worth auditing: (1) config keys read by skills that are
absent from the shipped config overlay, (2) hook files present in `super-gsd/hooks/` that are not
registered in `settings-overlay.json`, and (3) script files present in `super-gsd/scripts/` with no
doc coverage or install pathway. The three recently-iterated dashboard scripts (sgsd-mission-control,
sgsd-narrative, sgsd-gate-verdict) are the highest-risk audit targets because they accumulate the most
session-to-session drift.

**Primary recommendation:** Executor should audit each scope area sequentially using direct file reads
and grep cross-reference, following the wave breakdown proposed below.

---

## 1. Inventory

### 1.1 Skills (`super-gsd/skills/`)

| Skill Dir | SKILL.md | Installed to `.claude/commands/` |
|-----------|----------|----------------------------------|
| sgsd-browser | yes | yes |
| sgsd-brv-setup | yes | yes |
| sgsd-deliberate | yes | yes |
| sgsd-orchestrate | yes | yes |
| sgsd-overwatcher | yes | yes |
| sgsd-pause | yes | yes |
| sgsd-resume | yes | yes |
| sgsd-token-audit | yes | yes |
| sgsd-transition | yes | yes |

**Count: 9 skills, all installed. No orphan skills found.**

Note: `.claude/commands/` also contains `VTPidea.md` — this file has no corresponding skill in
`super-gsd/skills/` and no references in any super-gsd doc. Flag for audit.

### 1.2 Agents (`super-gsd/agents/`)

| Agent File | Installed to `.claude/agents/` | Dispatched By |
|------------|-------------------------------|---------------|
| sgsd-board-architect.md | yes | sgsd-deliberate (inline prompt, no subagent_type) |
| sgsd-board-contrarian.md | yes | sgsd-deliberate (inline prompt, no subagent_type) |
| sgsd-board-moonshot.md | yes | sgsd-deliberate (inline prompt, no subagent_type) |
| sgsd-board-pragmatist.md | yes | sgsd-deliberate (inline prompt, no subagent_type) |
| sgsd-ceo.md | yes | dispatch-table.md (row 1) — not from deliberate SKILL.md |
| sgsd-classifier.md | yes | sgsd-orchestrate SKILL.md lines 94, 158 |
| sgsd-context-selector.md | yes | sgsd-orchestrate SKILL.md lines 119 |

**Count: 7 sgsd agents, all installed.**

Key finding: `sgsd-deliberate/SKILL.md` dispatches board members via inline `Agent(description: "Architect
analysis", ...)` with no `subagent_type` — the 4 board agent files are installed but never referenced
by their filename anywhere in skills. The `sgsd-ceo` agent is listed only in `workflows/dispatch-table.md`
row 1, not in `sgsd-deliberate/SKILL.md`. Executor must verify whether these agents are live or vestigial.

Also installed in `.claude/agents/`: 24 base GSD agents (gsd-executor, gsd-planner, etc.) — these are
owned by the base GSD framework, not super-gsd. They are dispatched by sgsd-orchestrate SKILL.md.

### 1.3 Scripts (`super-gsd/scripts/`)

| File | Lines | Platform | Documented | Install Path |
|------|-------|----------|------------|--------------|
| sgsd-mission-control.ps1 | 917 | PowerShell | yes (SGSD-WORKSPACE-GUIDE.md) | sgsd1.cmd (manual) |
| sgsd-narrative.ps1 | 510 | PowerShell | yes (SGSD-WORKSPACE-GUIDE.md) | sgsd2.cmd (manual) |
| sgsd-gate-verdict.ps1 | 851 | PowerShell | yes (SGSD-WORKSPACE-GUIDE.md) | sgsd3.cmd (manual) |
| sgsd-agent-dashboard.ps1 | 192 | PowerShell | yes (MONITORING-SETUP.md) | none (manual only) |
| sgsd-agent-dashboard.sh | 241 | bash | yes (MONITORING-SETUP.md) | none |
| sgsd-headless.ps1 | 146 | PowerShell | partial (MONITORING-SETUP.md) | none |
| sgsd-headless.sh | 185 | bash | partial (MONITORING-SETUP.md) | none |
| sgsd-dashboard.ps1 | 723 | PowerShell | NO | none |
| sgsd-live-feed.ps1 | 104 | PowerShell | NO | none |
| sgsd-thinking.ps1 | 139 | PowerShell | NO | none |

**Count: 10 scripts (8 ps1, 2 sh). Total lines: 4,008.**

`sgsd-dashboard.ps1`, `sgsd-live-feed.ps1`, and `sgsd-thinking.ps1` have zero mentions in any `.md`
file in `super-gsd/docs/` or `super-gsd/skills/`. They are not installed by `install.sh`.

### 1.4 Tools (`super-gsd/tools/`)

| Tool | Files | Version | Documented | Installed By |
|------|-------|---------|------------|--------------|
| phase-verifier | phase-verifier.mjs, package.json, README.md | 0.1.0 | yes (SGSD-WORKSPACE-GUIDE.md) | manual (.cmd wrapper) |

**Count: 1 tool (3 files). Not installed by `install.sh` — requires manual .cmd wrapper setup.**

### 1.5 Hooks (`super-gsd/hooks/`)

| File | In settings-overlay.json | Event | Matcher |
|------|--------------------------|-------|---------|
| gsd-checkpoint-writer.js | YES | PostToolUse | Bash |
| gsd-context-monitor.js | YES | PostToolUse | Agent|Read|Write|Edit|Bash |
| gsd-session-start.js | YES | SessionStart | (none) |
| gsd-stuck-detector.js | YES | PostToolUse | Bash|Edit|Write |
| gsd-token-logger.js | YES | PostToolUse | Agent |
| sgsd-activity-logger.js | NO | PostToolUse | (self-documents: Agent|Write|Edit|Bash) |
| sgsd-statusline.js | NO | (statusLine type) | n/a |

**Count: 7 hook files. 5 registered in settings-overlay, 2 not registered.**

`sgsd-activity-logger.js` is documented in `MONITORING-SETUP.md` (line 40) as needing manual addition
to settings.json — but `settings-overlay.json` does not include it. `sgsd-statusline.js` similarly
requires manual settings.json addition. Neither is installed automatically.

Also in `.claude/hooks/`: 12 additional hooks from the base GSD framework (enforce-bg-shell.js,
gsd-validate-commit.js, gsd-workflow-guard.js, etc.) that are not referenced anywhere in super-gsd
scripts, docs, or settings-overlay.json.

### 1.6 Config (`super-gsd/config/`)

| File | Keys | Read By |
|------|------|---------|
| model-routing.json | 5 top-level groups, 11 role definitions | sgsd-orchestrate SKILL.md line 55 (via `.planning/config.json`) |
| planning-config-overlay.json | workflow (9 keys), model_routing (9), token_efficiency (6), byterover (6), deliberation (6), git (3), atc (4) | sgsd-orchestrate, workflows, atc-gate.md |
| settings-overlay.json | hooks (5 hook registrations) | install.sh (referenced), USER-GUIDE.md |

**Config key audit: `config.browser_verify.*` is read extensively in sgsd-orchestrate SKILL.md (lines
242, 246, 257, 267, 541, 542) and tools/phase-verifier/README.md (line 23) — but this key group is
ABSENT from `planning-config-overlay.json`. Also: `config.workflow.nyquist_validation` is referenced
in sgsd-orchestrate SKILL.md line 569 but absent from planning-config-overlay.json.**

### 1.7 Docs (`super-gsd/docs/` + root)

| File | Lines | Scope |
|------|-------|-------|
| MONITORING-SETUP.md | ~170 | Dashboard setup guide |
| SESSION-DEBRIEF.md | ~170 | Session retrospective notes |
| SGSD-WORKSPACE-GUIDE.md | ~600 | Full workspace setup, sgsd1/2/3, phase-verifier |
| README.md | ~320 | Framework overview, install quickstart |
| USER-GUIDE.md | ~750 | End-to-end user guide |
| CLAUDE-OVERLAY.md | 259 | Drop-in CLAUDE.md for projects |
| USER-GUIDE.html | (compiled) | HTML version of USER-GUIDE.md |

**Count: 6 doc files (excluding compiled HTML). No `docs/audits/` directory exists yet.**

---

## 2. Cross-Reference Map

### Skills → Agents

| Skill | Agents Dispatched |
|-------|------------------|
| sgsd-orchestrate | sgsd-classifier (line 94), sgsd-context-selector (line 119), gsd-code-reviewer (line 176), gsd-phase-researcher, gsd-planner, gsd-plan-checker, gsd-executor, gsd-verifier (by name only, no subagent_type) |
| sgsd-deliberate | Board inline (no subagent_type binding); sgsd-ceo listed in dispatch-table.md only |
| sgsd-browser | none |
| sgsd-brv-setup | none |
| sgsd-pause | none |
| sgsd-resume | none |
| sgsd-token-audit | none |
| sgsd-transition | none |
| sgsd-overwatcher | none |

### Skills → Scripts/Tools

| Skill | Invokes |
|-------|---------|
| sgsd-orchestrate | phase-verifier (line 280, 287 — shell out via node) |
| All others | No script invocations found |

### Hooks → settings-overlay.json

See Section 1.5 table above. 5 of 7 hooks wired; sgsd-activity-logger and sgsd-statusline are not.

### Config Keys → Readers

| Config Key | Read By | Present in Overlay |
|------------|---------|-------------------|
| config.atc.enabled | sgsd-orchestrate line 149, workflows/atc-gate.md line 83 | YES |
| config.byterover.* | sgsd-orchestrate (implicit), CLAUDE-OVERLAY.md | YES |
| config.browser_verify.* | sgsd-orchestrate lines 242-267, 541-542; phase-verifier README | NO — missing key |
| config.workflow.nyquist_validation | sgsd-orchestrate line 569 | NO — missing key |
| config.deliberation.* | planning-config-overlay (defined), workflows/atc-gate.md | YES |

### BRV Command Aliases vs Reality

| Referenced As | Actual Command | Available as-is |
|---------------|---------------|-----------------|
| `brv-query` | `node ~/.claude/hooks/brv-query-local.js` OR `brv query` | NO — neither alias exists |
| `brv-curate` | `node ~/.claude/hooks/brv-curate-local.js` OR `brv curate` | NO — neither alias exists |

CLAUDE-OVERLAY.md line 255-256 and sgsd-orchestrate SKILL.md lines 44, 419-430 use `brv-query` and
`brv-curate` as bare commands. These are not on PATH. The `brv` CLI (ByteRover) has `brv query` and
`brv curate` subcommands — but that's a two-word command, not a single-word alias.

---

## 3. Audit Methodology

### Recommended Executor Workflow

**Read order per scope area:**
1. Read each source file (skills, agents, scripts, hooks)
2. Grep for names/references across all docs and other skills
3. Check installed counterparts in `.claude/`
4. Flag any reference that lacks an implementation, or implementation that lacks a reference

**Grep patterns for common gap types:**

```bash
# Features referenced but not implemented
grep -rn "config\.browser_verify\|nyquist_validation" super-gsd/ --include="*.md"

# Hooks not in settings-overlay
grep -n "command\|type" super-gsd/config/settings-overlay.json
grep -rn "Install in settings.json" super-gsd/hooks/

# Scripts not in docs
for f in super-gsd/scripts/*.ps1; do
  name=$(basename "$f")
  count=$(grep -rl "$name" super-gsd/docs/ | wc -l)
  echo "$name: $count doc references"
done

# Agents installed but never dispatched by subagent_type
grep -rn "subagent_type" super-gsd/skills/ super-gsd/workflows/
```

**Per-finding output format (executor must use exactly this):**

```
FINDING-{N}
Scope: [Skills|Agents|Scripts|Tools|Hooks|Config|Docs]
Severity: [critical|high|medium|low]
File: super-gsd/path/to/file.ext:NN
Evidence: "[quoted text from file]"
What's Missing: [one sentence]
Suggested Fix: [one sentence, no code]
```

---

## 4. Risk Hotspots

These are the highest-priority targets because they were heavily modified in the most recent sessions
and have the most surface area for inconsistency:

1. **sgsd-mission-control.ps1** (917 lines) — largest script, referenced in SGSD-WORKSPACE-GUIDE.md
   but not MONITORING-SETUP.md. Audit for: parameter drift vs. documented flags, data sources that
   may have been renamed.

2. **sgsd-narrative.ps1** (510 lines) — Haiku refresh is documented as `-HaikuRefreshSec 300` in
   sgsd2.cmd but the skill docs don't describe this param. Audit for: undocumented parameters,
   dependency on activity-log paths that may have changed.

3. **sgsd-gate-verdict.ps1** (851 lines) — references ATC, browser-verify, deferral ledger. Audit
   for: whether the `.planning/` paths it reads match what orchestrate actually writes, and whether
   `config.browser_verify.*` keys it expects are ever set.

4. **sgsd-orchestrate/SKILL.md** (574 lines) — the longest skill file. Audit for: all config key
   reads, all agent dispatches, all tool invocations — verify each has a concrete implementation.

5. **CLAUDE-OVERLAY.md** (259 lines) — the document users drop into their project. Any aspirational
   content here is user-facing breakage. Priority: verify every `brv-*` command reference.

---

## 5. Wave Breakdown Proposal

### Wave 1: Skills + Agents (highest user-facing risk)
- Read all 9 SKILL.md files
- Cross-reference every agent dispatch (`subagent_type`, `Agent(description:`, agent name mentions)
  against what's installed in `.claude/agents/`
- Cross-reference every skill against installed `.claude/commands/`
- Flag: sgsd-board-* agent wiring, sgsd-ceo dispatch path, VTPidea.md orphan
- Estimate: ~9 file reads, ~15 grep passes, 5-8 findings

### Wave 2: Scripts + Tools (undocumented surface area)
- Read header/param blocks of all 10 scripts
- Cross-reference each against docs (MONITORING-SETUP.md, SGSD-WORKSPACE-GUIDE.md)
- Read phase-verifier.mjs (key sections: input expectations, output format, platform assumptions)
- Flag: sgsd-dashboard.ps1 / sgsd-live-feed.ps1 / sgsd-thinking.ps1 (undocumented), phase-verifier
  Linux/macOS untested status, sgsd-agent-dashboard.ps1 overlap with sgsd-mission-control.ps1
- Estimate: ~13 file reads, 10 grep passes, 4-6 findings

### Wave 3: Hooks + Config (silent failures)
- Read all 7 hook files (header comments only, ~15 lines each)
- Cross-reference against settings-overlay.json registrations
- Read planning-config-overlay.json in full, cross-reference every key against skill/workflow reads
- Flag: sgsd-activity-logger not in overlay, sgsd-statusline not in overlay, browser_verify missing,
  nyquist_validation missing, brv-query/brv-curate command alias gap
- Estimate: ~10 file reads, 8 grep passes, 5-7 findings

### Wave 4: Docs + Assembly (stale references, dead links)
- Read README.md, USER-GUIDE.md, CLAUDE-OVERLAY.md (key sections)
- Grep for: renamed commands, removed features, mismatched path references
- Verify: gsd-discuss-phase / gsd-plan-phase / gsd-execute-phase referenced in USER-GUIDE.md line 363-365
  — these are base GSD commands, not sgsd commands; check if they're installed
- Verify: gsd-list-phase-assumptions referenced in sgsd-orchestrate SKILL.md line 562 — not installed
- Flag: brv-query/brv-curate in CLAUDE-OVERLAY.md as bare commands (confirmed gap), stale SESSION-DEBRIEF.md
  (project-specific content in framework docs)
- Estimate: ~6 file reads, 10 grep passes, 4-5 findings

### Wave 5: Assembly + Report Write
- Consolidate all findings into `docs/audits/2026-04-12-sgsd-gap-audit.md` with required 9 sections
- Deduplicate overlapping findings, assign final severity
- Write Recommendations section ranked by severity + effort
- Estimate: 1 file write, ~500-700 lines output

---

## 6. Effort Estimate

| Area | Files to Read | Grep Passes | Expected Findings |
|------|--------------|-------------|-------------------|
| Skills + Agents (W1) | ~9 | ~15 | 5-8 |
| Scripts + Tools (W2) | ~13 | ~10 | 4-6 |
| Hooks + Config (W3) | ~10 | ~8 | 5-7 |
| Docs (W4) | ~6 | ~10 | 4-5 |
| **Totals** | **~38** | **~43** | **18-26 findings** |

Report length estimate: 500-700 lines. Well above the 10-finding minimum.

High-confidence pre-identified gaps (executor will confirm with line numbers):

| # | Gap | Scope | Severity |
|---|-----|-------|---------|
| G1 | `config.browser_verify.*` read by skill + tool but absent from config overlay | Config | critical |
| G2 | `config.workflow.nyquist_validation` read by skill, absent from config overlay | Config | high |
| G3 | `brv-query` / `brv-curate` used as bare commands; not on PATH | Config/Docs | critical |
| G4 | `sgsd-activity-logger.js` not in settings-overlay despite being a shipped hook | Hooks | high |
| G5 | `sgsd-statusline.js` not in settings-overlay; manual-only | Hooks | medium |
| G6 | sgsd-dashboard.ps1, sgsd-live-feed.ps1, sgsd-thinking.ps1 — undocumented, uninstalled | Scripts | medium |
| G7 | Board agents (sgsd-board-*.md) installed but never dispatched by filename/subagent_type | Agents | high |
| G8 | sgsd-ceo.md listed in dispatch-table.md only; not invoked from sgsd-deliberate SKILL.md | Agents | high |
| G9 | VTPidea.md present in .claude/commands/ with no super-gsd source or docs | Agents | low |
| G10 | gsd-list-phase-assumptions referenced in sgsd-orchestrate SKILL.md:562, not installed | Skills | high |
| G11 | brv-curate-local.js not installed to ~/.claude/hooks/ by install.sh (only brv-query-local.js is) | Hooks | high |
| G12 | SESSION-DEBRIEF.md contains project-specific content (VTP references) in framework docs | Docs | low |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Board agents are never dispatched by subagent_type — sgsd-deliberate uses inline Agent() with description only | Section 2 | If Claude Code resolves Agent(description="Architect") to sgsd-board-architect.md automatically, G7/G8 are not gaps |
| A2 | `brv-query` and `brv-curate` are not on PATH on this machine — confirmed via `which` returning NOT_FOUND | Section 2 | Low risk — verified |
| A3 | gsd-list-phase-assumptions is not installed in .claude/commands — confirmed by directory listing | Section 6 | Low risk — verified |

---

## Open Questions

1. **Board agent dispatch mechanism** — Does Claude Code match `Agent(description: "Architect analysis")` to
   `sgsd-board-architect.md` via description-based fuzzy matching? If yes, G7 is not a gap.
   Recommendation: executor checks the installed board agent files for a `description:` frontmatter field
   that would match, to confirm.

2. **brv-curate-local.js install path** — `install.sh` line 121 installs `brv-query-local.js` to
   `~/.claude/hooks/` but does NOT install `brv-curate-local.js`. Line 132-136 copies it to
   `~/.claude/templates/overwatcher/`. Executor should verify whether workflows reference the templates
   path or the hooks path.

3. **sgsd-dashboard.ps1 vs sgsd-mission-control.ps1** — Both are "full stats" dashboards. Executor should
   read the first 30 lines of each to determine if sgsd-dashboard.ps1 is a predecessor (should be deleted)
   or a parallel variant (should be documented).

---

## Sources

All findings are [VERIFIED] via direct filesystem inspection using Glob, Bash ls, and Grep in this session.
No external sources required for this purely internal audit-prep research.

- `super-gsd/` directory tree — full inventory
- `super-gsd/config/settings-overlay.json` — hook registration cross-reference
- `super-gsd/config/planning-config-overlay.json` — config key inventory
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — agent dispatch and config key reads
- `super-gsd/skills/sgsd-deliberate/SKILL.md` — board agent dispatch pattern
- `~/.claude/hooks/` directory listing — installed hooks
- `~/.claude/commands/` directory listing — installed skills
- `~/.claude/agents/` directory listing — installed agents
- `super-gsd/install.sh` — install pathway verification
- `which brv-query`, `which brv-curate`, `brv --help` — command availability

---

## Metadata

**Confidence breakdown:**
- Inventory counts: HIGH — direct directory listings, no guessing
- Cross-reference map: HIGH — grep-verified, with line numbers
- Pre-identified gaps: HIGH for G1-G3, G10-G11 (grep-confirmed); MEDIUM for G7-G8 (pending executor disambiguation of Agent() dispatch mechanism)
- Wave breakdown: HIGH — based on actual file counts

**Research date:** 2026-04-11
**Valid until:** 2026-04-25 (framework files are stable; no external dependency)
