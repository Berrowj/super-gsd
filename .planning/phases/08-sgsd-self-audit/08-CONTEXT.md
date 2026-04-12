# Phase 8 · SGSD Self-Audit — Discussion Context

**Status:** ready for discussion
**Created:** 2026-04-12
**Depends on:** Phase 7 (Integration and Installation)
**Requirements:** AUDIT-01, AUDIT-02, AUDIT-03

---

## Goal

Produce a structured gap audit of the Super GSD framework so we know exactly what's shipping, what's referenced but missing, what's duplicated, and what's undocumented — before we invest in new features. Output is a single audit report committed to `docs/audits/2026-04-12-sgsd-gap-audit.md`.

This phase is **DOCS ONLY**. No framework code changes are permitted; the Karpathy Surgical constraint (added to every executor dispatch at Step 7) should catch and flag any code edit attempts as DEVIATIONS.

## Background — why now

After the recent workspace dashboard work (sgsd1/sgsd2/sgsd3 + phase-verifier + Karpathy integration), the framework has accumulated enough surface area that we no longer have a reliable picture of:

- Which skills are fully wired end-to-end vs. described in a SKILL.md but never invoked
- Which config.json settings are actually read by any script vs. purely aspirational
- How much duplication exists between `super-gsd/scripts/` (PowerShell dashboards) and `super-gsd/tools/` (Node.js CLI tools)
- Which hooks (in `~/.claude/hooks/`) are still wired in settings.json vs. orphaned from earlier versions
- Which pieces of `CLAUDE-OVERLAY.md` have implemented enforcement mechanisms vs. aspirational prose

An audit phase catches this before we layer more features on top of a shaky foundation.

## Scope — what the audit MUST cover

1. **Skills** (`super-gsd/skills/*/SKILL.md`) — every skill file, cross-reference against `~/.claude/commands/`
2. **Agents** (`super-gsd/agents/*.md`) — every agent, cross-reference against `~/.claude/agents/`, and identify which are actually dispatched by some skill
3. **Scripts** (`super-gsd/scripts/*.ps1` + `.sh`) — each script's inputs, outputs, and caller. Flag anything unreachable.
4. **Tools** (`super-gsd/tools/*/`) — phase-verifier and any siblings, cross-reference against invocations from skills
5. **Hooks** (`~/.claude/hooks/gsd-*`) — each hook, cross-reference against `settings.json` matchers
6. **Config** (`super-gsd/config/` + `.planning/config.json` template) — every key that any script reads, every key referenced in docs
7. **Docs** (`super-gsd/docs/` + `super-gsd/README.md` + `super-gsd/USER-GUIDE.md` + `CLAUDE-OVERLAY.md`) — dead links, stale references to features that were renamed or removed

## Non-goals

- **Not fixing anything.** This phase identifies gaps. A follow-up Phase 9 (if warranted) closes them.
- **Not auditing ByteRover seed content.** Out of scope — brv seed audit is its own concern.
- **Not auditing `.planning/`.** That's per-project state, not framework code.
- **Not auditing the mockups.** The HTML mockups in `.superpowers/mockups/` are design artifacts, not shipping code.

## Deliverable format — `docs/audits/2026-04-12-sgsd-gap-audit.md`

Required sections (in order):
1. **Summary** — overall health, top 5 findings, critical count
2. **Skills Audit** — table: SKILL.md name · wired (Y/N) · invoked by · notes
3. **Agents Audit** — table: agent name · called by · orphan (Y/N) · notes
4. **Scripts Audit** — table: script · input sources · output · caller · dead code?
5. **Tools Audit** — table: tool · invocation path · known callers
6. **Hooks Audit** — table: hook file · settings.json match · version header · status
7. **Config Audit** — table: key · default · read by · written by · doc'd?
8. **Docs Audit** — list: dead links, stale refs, missing sections
9. **Recommendations** — ranked list of fixes with severity + effort estimate

Every finding must include:
- **File path and line number** (or range)
- **Severity**: critical · high · medium · low
- **Evidence**: what you saw (quote) + what's missing
- **Suggested fix** (one line, no code)

Minimum 10 findings for the audit to be considered complete.

## Open questions (for the discussion step)

**Q1.** Should the audit also include the three dashboard scripts we just built (sgsd1/sgsd2/sgsd3) or leave those out because they were built this week and are known state? *Recommendation: include them — no exceptions, otherwise we're auditing a partial picture.*

**Q2.** Should the audit include the phase-verifier tool? It's been tested on Windows (Gate 1 shell:true fix) but has no Linux/macOS test run yet. *Recommendation: include and explicitly note the untested platforms.*

**Q3.** Should the audit cross-reference against ByteRover seed content to check if scripts mentioned there actually exist? *Recommendation: no — out of scope, defer to a separate brv-seed audit.*

**Q4.** What's the severity bar for a finding to be "critical"? *Recommendation: CRITICAL = user-facing behaviour is broken or documented incorrectly (e.g. SKILL.md describes a command that doesn't exist, or config key that would silently no-op). HIGH = internal coherence broken (e.g. script duplication causing confusion). MEDIUM = stale docs. LOW = cosmetic.*

## Success criteria (copied verbatim from ROADMAP.md Phase 8)

1. `docs/audits/2026-04-12-sgsd-gap-audit.md` exists with the 9 required sections
2. Report contains at least 10 specific findings, each with file path + line number + severity
3. Every "feature referenced but not implemented" finding cites the exact file and line where the reference appears AND proves the implementation is missing
4. Every "duplicate/conflict" finding shows both instances side-by-side
5. No files outside `docs/audits/` and `.planning/phases/08-*/` are modified during this phase
6. ATC review of the audit report finds zero critical CLAUDE.md rule violations

## Ready-to-dispatch signal

All four discussion questions have recommended defaults in this file. The orchestrator can either:
- **(A)** skip `/gsd-discuss-phase` interactively, adopt the recommendations inline, and jump straight to `gsd-phase-researcher`
- **(B)** run `/gsd-discuss-phase --auto` for formal confirmation

Either path produces a RESEARCH.md next, then a PLAN.md with the wave breakdown chosen by the planner.
