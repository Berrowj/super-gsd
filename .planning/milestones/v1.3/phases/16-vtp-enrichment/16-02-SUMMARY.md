---
phase: 16-vtp-enrichment
plan: 02
wave: B
subsystem: core-gsd-agents
tags: [vtp, agents, frontmatter, tool-access, wave-b]
requirements: [VTP-02, VTP-03, VTP-06, VTP-07]
dependency_graph:
  requires: [16-01]
  provides:
    - "gsd-phase-researcher can call VTP research-tier tools via composer.callVtp"
    - "gsd-planner can call VTP plan-tier tools via composer.callVtp"
    - "gsd-codebase-mapper can call VTP substrate-filter via composer.callVtp"
    - "gsd-assumptions-analyzer can call VTP wiki-contradiction tools via composer.callVtp"
  affects:
    - custom-gsd-extract/claude-agents/gsd-phase-researcher.md
    - custom-gsd-extract/claude-agents/gsd-planner.md
    - custom-gsd-extract/claude-agents/gsd-codebase-mapper.md
    - custom-gsd-extract/claude-agents/gsd-assumptions-analyzer.md
tech-stack:
  added: []
  patterns:
    - "VTP tool-access frontmatter: append canonical `mcp__vtp-kb__*` names to agents' comma-string `tools:` line (single-line, NOT YAML list)"
    - "VTP body integration: `<vtp_integration>` block inserted directly after `</role>` tag containing composer-wrapper assertion, VTP-EVIDENCE.md prelude-read directive, tier-specific tool selection table, graceful-fail clause"
key-files:
  created: []
  modified:
    - custom-gsd-extract/claude-agents/gsd-phase-researcher.md
    - custom-gsd-extract/claude-agents/gsd-planner.md
    - custom-gsd-extract/claude-agents/gsd-codebase-mapper.md
    - custom-gsd-extract/claude-agents/gsd-assumptions-analyzer.md
decisions:
  - "Force-added (`git add -f`) the 4 patched agent files because `custom-gsd-extract/` is gitignored as Genesis-wave reference dumps. Plan D-03 explicitly targets these files as the in-place patch surface, so honoured plan intent and overrode gitignore on these 4 specific files only. Rest of `custom-gsd-extract/` (atc, claude-md-files, claude-settings, claude-skills) remains ignored. Documented as Rule 3 deviation."
  - "Did NOT enforce plan's original `grep -c \"^---$\" == 2` check on gsd-planner.md: that file has 6 body-content `---` horizontal-rule separators that pre-existed the patch (lines 431, 446, 789, 793 in the committed version are pre-existing, unrelated to this patch). Frontmatter IS properly bounded by lines 1+12. Treated as observational note rather than deviation."
metrics:
  duration_seconds: 900
  tasks_completed: 2
  commits: 4
  files_changed: 4
  completed_date: 2026-04-23
---

# Phase 16 Plan 02: Wave B — Core GSD Agent VTP Patches Summary

**One-liner:** Four core GSD agents (`gsd-phase-researcher`, `gsd-planner`, `gsd-codebase-mapper`, `gsd-assumptions-analyzer`) now declare tier-appropriate VTP MCP tools in their frontmatter and carry a WHEN-to-call-VTP paragraph that routes every invocation through the Wave-A composer's `callVtp` wrapper — satisfying VTP-02/03/06/07 without any `sgsd-*` promotion (D-03).

## What was delivered

- **VTP-02 (`gsd-phase-researcher`):** appended 4 research-tier VTP tools to `tools:` line (`vtp_search_research`, `vtp_get_research`, `vtp_research_gate`, `vtp_route_and_retrieve`); inserted `<vtp_integration>` body block with composer-wrapper contract, VTP-EVIDENCE.md prelude read, tier-specific tool-selection table, and the cost-gate for `vtp_research_gate` (regex + prior `too_generic` precondition — prevents the operator-guide anti-pattern of defaulting to the expensive gate).
- **VTP-03 (`gsd-planner`):** appended 3 plan-tier VTP tools (`vtp_route_and_retrieve`, `vtp_search_substrate`, `vtp_get_evidence_bundle`); inserted `<vtp_integration>` block with architecture-mode framing, fast-path note citing D-07 (substrate bypasses routing overhead), inline doc-ID citation contract so the executor can re-query at execute-time.
- **VTP-06 (`gsd-codebase-mapper`, re-targeted per E-01):** appended `vtp_search_substrate` (single tool); inserted `<vtp_integration>` block with parallel-lookup integration pattern (VTP substrate + in-repo Grep run together, in-repo wins on conflict), plus the explicit E-01 re-targeting note documenting that this is the replacement for the missing `gsd-pattern-mapper.md`.
- **VTP-07 (`gsd-assumptions-analyzer`):** appended 2 wiki tools (`wiki_find_contradictions`, `wiki_search`); inserted `<vtp_integration>` block with assumption-stressing integration pattern (`vtp_stress_test: passed | unavailable` annotation) that feeds downstream plan-checker traceability.

Every `<vtp_integration>` block contains the four mandatory invariants from the plan's acceptance criteria:
1. "Never call `mcp__vtp-kb__*` tools directly" assertion
2. "composer wrapper" reference to `super-gsd/scripts/lib/vtp-context-composer.cjs#callVtp`
3. "Read VTP-EVIDENCE.md first" directive
4. "Graceful-fail" clause ("if callVtp returns {ok:false}, proceed without VTP")

## Verification

**Task 1 verify** (`gsd-phase-researcher` + `gsd-planner`):
```
grep -q "mcp__vtp-kb__vtp_search_research" gsd-phase-researcher.md && \
grep -q "mcp__vtp-kb__vtp_get_research" gsd-phase-researcher.md && \
grep -q "mcp__vtp-kb__vtp_research_gate" gsd-phase-researcher.md && \
grep -q "vtp-context-composer" gsd-phase-researcher.md && \
grep -q "mcp__vtp-kb__vtp_route_and_retrieve" gsd-planner.md && \
grep -q "mcp__vtp-kb__vtp_search_substrate" gsd-planner.md && \
grep -q "vtp-context-composer" gsd-planner.md
→ exit 0 ✓
```

**Task 2 verify** (`gsd-codebase-mapper` + `gsd-assumptions-analyzer`):
```
grep -q "mcp__vtp-kb__vtp_search_substrate" gsd-codebase-mapper.md && \
grep -q "vtp-context-composer" gsd-codebase-mapper.md && \
grep -q "per E-01" gsd-codebase-mapper.md && \
grep -q "mcp__vtp-kb__wiki_find_contradictions" gsd-assumptions-analyzer.md && \
grep -q "mcp__vtp-kb__wiki_search" gsd-assumptions-analyzer.md && \
grep -q "vtp-context-composer" gsd-assumptions-analyzer.md
→ exit 0 ✓
```

**End-of-wave gate** (all 4 agents):
```
for agent in gsd-phase-researcher gsd-planner gsd-codebase-mapper gsd-assumptions-analyzer; do
  grep -E "^tools:.*mcp__vtp-kb__" → match
  grep -q "vtp-context-composer"   → match
  grep -qi "graceful-fail"         → match
  grep -c "^tools: " == 1          → true
done
→ END_OF_WAVE_GATE: PASS ✓
```

## Commits (atomic, one per agent)

| # | Commit SHA | Agent | Requirement |
|---|------------|-------|-------------|
| 1 | `885a4ac` | `gsd-phase-researcher.md` | VTP-02 |
| 2 | `aa70b30` | `gsd-planner.md` | VTP-03 |
| 3 | `8db4226` | `gsd-codebase-mapper.md` | VTP-06 (per E-01) |
| 4 | `db28d2e` | `gsd-assumptions-analyzer.md` | VTP-07 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 – Blocking] `custom-gsd-extract/` is gitignored; force-added 4 patched files**
- **Found during:** Task 1, first commit attempt (gsd-phase-researcher.md)
- **Issue:** `git add` rejected the patched file because `.gitignore:27` ignores the entire `custom-gsd-extract/` directory ("Genesis-wave 2026-04-08 reference dumps; live equivalents now maintained under super-gsd/ and .claude/skills/"). But the plan (16-02 objective + CONTEXT.md D-03) explicitly targets this exact path as the "vendored local fork" patch surface, and the 4 target files do NOT have live equivalents inside `super-gsd/agents/` (which contains only `sgsd-*` agents). The only other copy is at the global `~/.claude/agents/` — out of scope per D-03.
- **Fix:** Used `git add -f` to override the gitignore on each of the 4 specific agent files (only those 4 — the rest of `custom-gsd-extract/` remains ignored). Each now tracked in git under its original plan-specified path. No `.gitignore` edit needed.
- **Why auto-fix rather than Rule 4 architectural ask:** The plan's intent was unambiguous (in-place patch in `custom-gsd-extract/claude-agents/`). The gitignore rule reflects a stale belief about where the live agents live; resolving it by force-adding the specific patched files respects the plan author's authority and does NOT globally un-ignore anything else. CLAUDE.md auto-mode directive: "If in doubt: DO IT, don't ask."
- **Files modified:** 4 agent files force-added + .gitignore left untouched
- **Commits:** 885a4ac, aa70b30, 8db4226, db28d2e (all used `-f`)

### Observational Notes (not deviations)

- **`gsd-planner.md` has 6 `---` lines, not 2.** The plan's end-of-wave verification template assumes `grep -c "^---$" == 2`. The file has 6 — but 4 of those (lines 431, 446, 789, 793) are pre-existing body-content horizontal-rule separators inside prose sections, unrelated to frontmatter. Frontmatter is properly bounded by lines 1 + 12 (my `<vtp_integration>` insertion did NOT add any `---` lines). YAML parses cleanly. Not a regression; the planner's verification template was slightly over-strict for this specific file.

- **CRLF line-ending warnings on every commit.** All 4 commits emitted `warning: LF will be replaced by CRLF the next time Git touches it`. Expected on Windows with default `core.autocrlf=true`. Does not break anything; the files read correctly in both forms. Matches the CRLF-normalization pattern already documented for `sgsd-triage` SKILL.md (D-02 in CONTEXT.md).

## Threat Model Check

Applied Rule 2 (auto-add critical functionality) pre-commit to verify T-16-09 through T-16-13 mitigations are honoured in the patches:

| Threat | Mitigation State |
|--------|------------------|
| T-16-09 (tampering: malformed frontmatter) | All 4 files: `tools:` line count = 1, YAML parses, role block intact ✓ |
| T-16-10 (tampering: shell-interp of raw_query) | WHEN paragraphs cite composer's `callVtp(tool, args)` helper (structured args, not shell strings) — contract lives in Wave-A composer ✓ |
| T-16-11 (info-disclosure: logged operator prose) | Inherited from composer's `recent_commands` sanitizer (Wave A); agent patches do not bypass ✓ |
| T-16-12 (DoS: unbounded `vtp_research_gate`) | `gsd-phase-researcher` WHEN paragraph contains explicit keyword regex + prior `too_generic` gate — directly mitigates ✓ |
| T-16-13 (spoofing: fake contradictions) | `gsd-assumptions-analyzer` WHEN paragraph requires citing contradicting `doc_id` in output, making claims operator-verifiable ✓ |

No new threat surface introduced — every patch is tool-access + prose, no new code paths.

## Known Stubs

None. All 4 agent bodies have complete `<vtp_integration>` blocks with all 4 mandatory invariants (composer-direct-call prohibition, VTP-EVIDENCE.md prelude-read, tool-selection table, graceful-fail). No placeholders, no TODOs, no "wired later" language.

## Self-Check: PASSED

**Files verified to exist:**
- FOUND: custom-gsd-extract/claude-agents/gsd-phase-researcher.md
- FOUND: custom-gsd-extract/claude-agents/gsd-planner.md
- FOUND: custom-gsd-extract/claude-agents/gsd-codebase-mapper.md
- FOUND: custom-gsd-extract/claude-agents/gsd-assumptions-analyzer.md

**Commits verified in git log:**
- FOUND: 885a4ac (feat(16-02): gsd-phase-researcher VTP-02)
- FOUND: aa70b30 (feat(16-02): gsd-planner VTP-03)
- FOUND: 8db4226 (feat(16-02): gsd-codebase-mapper VTP-06 per E-01)
- FOUND: db28d2e (feat(16-02): gsd-assumptions-analyzer VTP-07)

**Acceptance-criterion coverage:**
- ✓ All 4 agents have VTP tools appended to `tools:` comma-string
- ✓ All 4 agents have `<vtp_integration>` body block after `</role>`
- ✓ All 4 blocks contain: composer-wrapper assertion, VTP-EVIDENCE.md directive, tool selection, graceful-fail
- ✓ `gsd-codebase-mapper.md` contains E-01 re-targeting note
- ✓ `gsd-phase-researcher.md` contains `vtp_research_gate` cost-gate (keyword regex + prior `too_generic` precondition)
- ✓ 4 atomic commits with `feat(16-02): ...` prefix
- ✓ No frontmatter corruption (tools line count = 1 for all 4; YAML parses cleanly for all 4)
