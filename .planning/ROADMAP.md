# Roadmap: Super GSD Framework

## Overview

Ship the Super GSD orchestrator as a production-ready framework. Build order follows dependency chain: token tracking and path safety first (everything depends on it), then memory layer (orchestrator needs it), then the orchestrator engine itself, then quality gates and deliberation (which layer on top of orchestrator), then monitoring, and finally integration testing with the install script.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Token Foundation and Hook Wiring** - Token logging, audit tooling, IPC handling, and cross-cutting safety patterns (completed 2026-04-08)
- [x] **Phase 2: Memory Layer** - Local BM25 query engine and ByteRover context-tree integration (completed 2026-04-09)
- [x] **Phase 3: Orchestrator Engine** - Dispatch loop, model routing, checkpoint survival, agent reports, and atomic commits (completed 2026-04-09)
- [ ] **Phase 4: ATC Quality Gates** - Haiku-based commit classification with tiered review and stuck detection
- [ ] **Phase 5: Strategic Deliberation** - CEO/Board multi-agent debate system for architecture decisions
- [x] **Phase 6: Overwatcher and Monitoring** - Signal map visualization and Mission Control dashboard spec (completed 2026-04-08)
- [ ] **Phase 7: Integration and Installation** - One-command install, overlay teaching doc, and GSD 2.0 migration tool
- [ ] **Phase 8: SGSD Self-Audit** - Survey the framework codebase, produce a gap report covering features referenced but not implemented, settings referenced but not wired, duplicate/conflicting scripts, and missing docs

## Phase Details

### Phase 1: Token Foundation and Hook Wiring
**Goal**: Every dispatch logs token usage, hooks handle cross-platform paths safely, and the foundation patterns (atomic writes, patch markers) are proven before anything builds on them
**Depends on**: Nothing (first phase)
**Requirements**: ORCH-07, ORCH-08, ORCH-10, SAFE-01, SAFE-02, SAFE-03
**Success Criteria** (what must be TRUE):
  1. After any agent dispatch, a JSONL entry appears in .planning/metrics/token-log.jsonl with model, role, and token count
  2. User can run `/gsd-token-audit` and see a formatted breakdown of token usage by model, role, and phase
  3. Hooks receiving Windows backslash paths produce correct Unix paths without silent failure
  4. Interrupted checkpoint writes never leave corrupted files (atomic .tmp + rename pattern verified)
  5. GSD 1.0 core file patches use SUPER-GSD-START/END markers and can be applied idempotently
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Harden all 5 hooks with toUnixPath + atomic writes, wire into settings.json
- [x] 01-02-PLAN.md — SUPER-GSD marker patches to GSD 1.0 core files, @file: IPC guard, token audit validation

### Phase 2: Memory Layer
**Goal**: Orchestrator can query local context before dispatching agents and curate new knowledge after, with zero API keys
**Depends on**: Phase 1
**Requirements**: MEM-01, MEM-02, MEM-03, MEM-04, MEM-05
**Success Criteria** (what must be TRUE):
  1. Running a BM25 query against .brv/context-tree/ returns ranked results in under 100ms with no external API
  2. Before each agent dispatch, orchestrator injects relevant decisions/patterns/scripts from context-tree into the agent prompt
  3. When an agent report contains SCRIPTS_CREATED, the orchestrator curates the new script into .brv/context-tree/scripts/
  4. When a BM25 match finds an existing utility, the agent receives "EXISTING: path -- import, do not recreate" in its prompt
  5. Context tree files have YAML frontmatter with importance, maturity, tags, and keywords fields used in scoring
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Build brv-curate-local.js + wire BM25 query and curation into orchestrate-loop.md Steps 4 and 9
- [x] 02-02-PLAN.md — Wire script registry + EXISTING: format into prompt-composer and executor overlay, end-to-end smoke test

### Phase 3: Orchestrator Engine
**Goal**: The autonomous dispatch loop runs end-to-end: reads state, selects model, dispatches agent, processes report, commits atomically, and survives context exhaustion
**Depends on**: Phase 2
**Requirements**: ORCH-01, ORCH-02, ORCH-03, ORCH-04, ORCH-05, ORCH-06, ORCH-09, SAFE-04, SAFE-05
**Success Criteria** (what must be TRUE):
  1. Orchestrator reads STATE.md frontmatter and dispatches the correct next action without user intervention
  2. Each agent dispatch uses the correct model (Opus/Sonnet/Haiku) as specified in config-driven routing table
  3. Agent reports follow the structured format (FILES_CHANGED, VERIFICATION, DEVIATIONS, BLOCKERS, SCRIPTS_CREATED, ONE_LINER) and are capped at 300 words
  4. Orchestrator chains tool calls on every response and only emits text-only for the 4 valid exit conditions
  5. At >70% context usage, orchestrator writes ORCHESTRATOR-CHECKPOINT.md and resumes from it in the next session without user re-briefing
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Wire dispatch conditions to gsd-tools, model routing from config.json, report processing + atomic commit rule
- [x] 03-02-PLAN.md — Context cap enforcement (SAFE-04), report format validation (SAFE-05), checkpoint write/resume cycle
- [x] 03-03-PLAN.md — End-to-end dry-run: Phase 4 context generated, dispatch trace validated, Phase 3 VERIFICATION.md written

### Phase 4: ATC Quality Gates
**Goal**: Every commit is automatically classified and reviewed at the appropriate depth, with stuck agents detected early
**Depends on**: Phase 3
**Requirements**: QA-01, QA-02, QA-03, QA-04, QA-05
**Success Criteria** (what must be TRUE):
  1. Before every commit, Haiku classifies the change as skip/lite/full/gate based on diff size and file count
  2. LITE commits run delete + simplify checks (~200 tokens); FULL commits run the 7-step pipeline + 10-point checklist (~500 tokens)
  3. GATE-classified changes prompt the user to run /gsd-deliberate before proceeding
  4. When an agent makes 3+ repeated tool calls on the same file or command, a warning is injected into the agent context
  5. Changes with files_changed > 3 OR diff_lines > 100 escalate classification regardless of Haiku output
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Wire ATC gate into orchestrate-loop.md Step 8.5, complexity floor logic, classifier tier_prompts
- [x] 04-02-PLAN.md — Validate stuck detector, update gsd-orchestrate SKILL.md, add GATE deliberation block

### Phase 5: Strategic Deliberation
**Goal**: Users can trigger structured multi-agent debates for architecture decisions, with automatic gating that prevents trivial triggers
**Depends on**: Phase 3
**Requirements**: DLB-01, DLB-02, DLB-03, DLB-04, DLB-05
**Success Criteria** (what must be TRUE):
  1. User runs `/gsd-deliberate new` and a structured brief is created, followed by a CEO/Board debate
  2. Four board members (Architect, Pragmatist, Contrarian, Moonshot) run in parallel on Sonnet and produce distinct positions
  3. CEO evaluates positions and optionally runs Round 2 with all positions visible for rebuttals
  4. A Decision Memo is written to .planning/decisions/ with board stances, tensions, trade-offs, and next actions
  5. Haiku-based deliberation gate scores decisions and only triggers for changes affecting 3+ phases
**Plans**: 2

Plans:
- [x] 05-01-PLAN.md — 3-round hard cap + no-movement detection in CEO agent, Haiku phase-impact gate wired as Step 0 in gsd-deliberate skill
- [x] 05-02-PLAN.md — End-to-end flow validation: test brief, CEO prompt trace, memo format check, board agent compatibility

### Phase 6: Overwatcher and Monitoring
**Goal**: Users can visualize project health via an interactive signal map and have a spec for live dashboard monitoring
**Depends on**: Phase 3
**Requirements**: VIS-01, VIS-02, VIS-03
**Success Criteria** (what must be TRUE):
  1. Overwatcher scans .planning/ and renders an interactive HTML signal map with phase grid, collision detection, and dependency graph
  2. Signal map displays phase progress, plan status, file collision warnings, and decision log
  3. Mission Control dashboard spec exists for tmux-based read-only monitoring with 10-second refresh
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 06-01: TBD

### Phase 7: Integration and Installation
**Goal**: Any Claude Code Max plan user can install Super GSD with one command and start building immediately, including migration from GSD 2.0
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6
**Requirements**: INST-01, INST-02, INST-03, INST-04, TRANS-01
**Success Criteria** (what must be TRUE):
  1. Running `bash install.sh --init-project` installs all agents, skills, hooks, templates, config, seeds ByteRover, and initializes .planning/ in one command
  2. Install completes without modification on Windows WSL2, macOS, and Linux
  3. Install requires zero API keys -- everything runs via Claude Code Max plan OAuth
  4. CLAUDE-OVERLAY.md dropped into a project CLAUDE.md teaches Claude Code the full orchestrator loop
  5. Running `/gsd-transition` migrates decisions, knowledge, and requirements from .gsd/ into .planning/ + .brv/context-tree/
**Plans**: 2

Plans:
- [x] 07-01-PLAN.md — Validate install.sh dry-run, portability, API-key audit, CLAUDE-OVERLAY completeness
- [x] 07-02-PLAN.md — Validate gsd-transition skill paths, add NOT_FOUND guard, create VERIFICATION.md

### Phase 8: SGSD Self-Audit
**Goal**: Produce a structured gap audit of the Super GSD framework. Identify features referenced in SKILL.md / CLAUDE-OVERLAY.md but not actually implemented, config settings referenced in code but not documented, duplicate or conflicting scripts across `super-gsd/scripts/` and `super-gsd/tools/`, and missing documentation. Output is a single audit report at `docs/audits/2026-04-12-sgsd-gap-audit.md`. Docs-only — no framework code changes allowed in this phase.
**Depends on**: Phase 7
**Requirements**: AUDIT-01 (produces structured gap report), AUDIT-02 (covers skills/agents/scripts/tools/hooks), AUDIT-03 (≥10 specific findings with file:line references)
**Success Criteria** (what must be TRUE):
  1. `docs/audits/2026-04-12-sgsd-gap-audit.md` exists with sections: Summary, Skills Audit, Agents Audit, Scripts Audit, Tools Audit, Hooks Audit, Config Audit, Docs Audit, Recommendations
  2. Report contains at least 10 specific findings, each with file path + line number + severity (critical/high/medium/low)
  3. Every "feature referenced but not implemented" finding cites the exact file and line where the reference appears AND proves the implementation is missing
  4. Every "duplicate/conflict" finding shows both instances side-by-side
  5. No files outside `docs/audits/` and `.planning/phases/08-*/` are modified during this phase (Karpathy Surgical constraint — audit phase is DOCS ONLY)
  6. ATC review of the audit report finds zero critical CLAUDE.md rule violations
**Plans**: TBD (planner decides the wave breakdown)


**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7
(Note: Phases 4, 5, 6 can execute in parallel after Phase 3; Phase 7 depends on all)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Token Foundation and Hook Wiring | 2/2 | Complete   | 2026-04-08 |
| 2. Memory Layer | 2/2 | Complete   | 2026-04-09 |
| 3. Orchestrator Engine | 3/3 | Complete   | 2026-04-09 |
| 4. ATC Quality Gates | 2/2 | Complete   | 2026-04-08 |
| 5. Strategic Deliberation | 2/2 | Complete   | 2026-04-08 |
| 6. Overwatcher and Monitoring | 1/1 | Complete   | 2026-04-08 |
| 7. Integration and Installation | 2/2 | Complete | 2026-04-08 |
