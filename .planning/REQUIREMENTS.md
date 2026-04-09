# Requirements — v1.0 Ship Super GSD Framework

## Orchestrator Engine

- [ ] **ORCH-01**: Orchestrator can read STATE.md frontmatter and determine next dispatch action via first-match rule table
- [ ] **ORCH-02**: Orchestrator dispatches sub-agents with correct model (Opus/Sonnet/Haiku) from config-driven routing table
- [ ] **ORCH-03**: Orchestrator processes structured agent reports (<300 words: FILES_CHANGED, VERIFICATION, DEVIATIONS, BLOCKERS, SCRIPTS_CREATED, ONE_LINER)
- [ ] **ORCH-04**: Orchestrator chains tool calls on every response — text-only only for the 4 valid exit conditions
- [ ] **ORCH-05**: Orchestrator writes ORCHESTRATOR-CHECKPOINT.md at >70% context with exact resume point
- [ ] **ORCH-06**: Orchestrator resumes from checkpoint on next session without user re-briefing
- [ ] **ORCH-07**: Orchestrator logs token usage per unit to .planning/metrics/token-log.jsonl after every dispatch
- [x] **ORCH-08**: User can run `/gsd-token-audit` to see usage breakdown by model, role, and phase
- [ ] **ORCH-09**: Orchestrator commits atomically per unit — never batches, never skips, never amends
- [x] **ORCH-10**: Orchestrator handles `@file:` IPC prefix from gsd-tools.cjs without silent failure

## Memory Layer

- [x] **MEM-01**: Local BM25 query engine returns ranked results from .brv/context-tree/ in <100ms with no API key
- [x] **MEM-02**: Orchestrator queries ByteRover before each dispatch and injects relevant decisions/patterns/scripts into agent prompt
- [x] **MEM-03**: Orchestrator curates new scripts into .brv/context-tree/scripts/ after processing agent reports with SCRIPTS_CREATED
- [ ] **MEM-04**: Agents can find and reuse existing utilities — orchestrator injects "EXISTING: path — import, do not recreate" when match found
- [x] **MEM-05**: Context tree files use YAML frontmatter with importance, maturity, tags, keywords for scoring

## Quality Gates

- [ ] **QA-01**: ATC gate classifies every commit as skip/lite/full/gate using Haiku before commit
- [ ] **QA-02**: LITE tier runs delete + simplify checks (~200 tokens); FULL tier runs 7-step + 10-point checklist (~500 tokens)
- [ ] **QA-03**: GATE tier suggests /gsd-deliberate before proceeding on architecture/API changes
- [ ] **QA-04**: Stuck detector hook warns agent after 3+ repeated tool calls on same file/command
- [ ] **QA-05**: Complexity floor: files_changed > 3 OR diff_lines > 100 escalates classification regardless of Haiku output

## Strategic Deliberation

- [ ] **DLB-01**: User can run `/gsd-deliberate new` to create a structured brief and run CEO/Board debate
- [ ] **DLB-02**: CEO spawns 4 board members (Architect, Pragmatist, Contrarian, Moonshot) in parallel on Sonnet
- [ ] **DLB-03**: CEO evaluates positions and runs optional Round 2 with all positions visible for rebuttals
- [ ] **DLB-04**: CEO writes Decision Memo to .planning/decisions/ with board stances, tensions, trade-offs, next actions
- [ ] **DLB-05**: Deliberation gate (Haiku) scores decisions before triggering — skips for per-phase work, triggers for 3+ phase impact

## Monitoring & Visualization

- [ ] **VIS-01**: Overwatcher scans .planning/ and renders interactive HTML signal map with phase grid, collision detection, dependency graph
- [ ] **VIS-02**: Signal map shows phase progress, plan status, file collision warnings, and decision log
- [ ] **VIS-03**: Mission Control dashboard spec exists for tmux-based monitoring (read-only, 10s refresh)

## Migration & Installation

- [ ] **INST-01**: `bash install.sh --init-project` installs all agents, skills, hooks, templates, config, seeds ByteRover, and initializes .planning/ in one command
- [ ] **INST-02**: Install works on Windows WSL2, macOS, and Linux without modification
- [ ] **INST-03**: Install does not require any API keys — everything runs via Claude Code Max plan OAuth
- [ ] **INST-04**: CLAUDE-OVERLAY.md teaches Claude Code the full orchestrator loop when dropped into project CLAUDE.md
- [ ] **TRANS-01**: `/gsd-transition` migrates decisions, knowledge, requirements from .gsd/ (Pi/GSD 2.0) into .planning/ + .brv/context-tree/

## Cross-Cutting

- [ ] **SAFE-01**: All hooks normalize Windows/Unix paths at entry point — no silent failures from mixed path formats
- [ ] **SAFE-02**: Checkpoint writes use atomic pattern (write .tmp, rename) — no corruption on interrupted writes
- [x] **SAFE-03**: Patches to GSD 1.0 core files use `// SUPER-GSD-START/END` markers for idempotent upgrades
- [ ] **SAFE-04**: Context accumulation capped — max 5 reports in active context, completed compressed to one-liners
- [ ] **SAFE-05**: Sub-agent report format enforced — 300 word max, structured sections, efficiency header injected

## Traceability

| REQ | Phase | Status |
|-----|-------|--------|
| ORCH-01 | Phase 3 | Pending |
| ORCH-02 | Phase 3 | Pending |
| ORCH-03 | Phase 3 | Pending |
| ORCH-04 | Phase 3 | Pending |
| ORCH-05 | Phase 3 | Pending |
| ORCH-06 | Phase 3 | Pending |
| ORCH-07 | Phase 1 | Pending |
| ORCH-08 | Phase 1 | Complete |
| ORCH-09 | Phase 3 | Pending |
| ORCH-10 | Phase 1 | Complete |
| MEM-01 | Phase 2 | Complete |
| MEM-02 | Phase 2 | Complete |
| MEM-03 | Phase 2 | Complete |
| MEM-04 | Phase 2 | Pending |
| MEM-05 | Phase 2 | Complete |
| QA-01 | Phase 4 | Pending |
| QA-02 | Phase 4 | Pending |
| QA-03 | Phase 4 | Pending |
| QA-04 | Phase 4 | Pending |
| QA-05 | Phase 4 | Pending |
| DLB-01 | Phase 5 | Pending |
| DLB-02 | Phase 5 | Pending |
| DLB-03 | Phase 5 | Pending |
| DLB-04 | Phase 5 | Pending |
| DLB-05 | Phase 5 | Pending |
| VIS-01 | Phase 6 | Pending |
| VIS-02 | Phase 6 | Pending |
| VIS-03 | Phase 6 | Pending |
| INST-01 | Phase 7 | Pending |
| INST-02 | Phase 7 | Pending |
| INST-03 | Phase 7 | Pending |
| INST-04 | Phase 7 | Pending |
| TRANS-01 | Phase 7 | Pending |
| SAFE-01 | Phase 1 | Pending |
| SAFE-02 | Phase 1 | Pending |
| SAFE-03 | Phase 1 | Complete |
| SAFE-04 | Phase 3 | Pending |
| SAFE-05 | Phase 3 | Pending |

## Out of Scope

- GUI code editor (Cursor-style) — wrong layer, Super GSD is a CLI framework
- Cloud execution environment — opaque, expensive, lock-in
- Custom vector database — BM25 sufficient, no evidence it isn't
- Background daemon process — event-driven via hooks is correct
- API key management — Max plan OAuth only
- Live-reload Overwatcher server — static HTML generation sufficient for v1.0
