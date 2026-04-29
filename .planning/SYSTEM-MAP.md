# SGSD System Map

> AUTO-GENERATED -- do not hand-edit. Edit the underlying registries
> in `super-gsd/registry/` then re-run:
> `node super-gsd/tools/system-map/generate.cjs --generate`

Schema version: 1
Generated at: 2026-04-27T11:25:04.528Z
Generator: super-gsd/tools/system-map/generate.cjs

## Contents

- [Agents](#agents) (8)
- [Gates](#gates) (13)
- [Review providers](#review-providers) (2)
- [Board](#board) (5 members)
- [Contracts](#contracts) (5)
- [Skills](#skills) (21)
- [Scripts](#scripts) (40)
- [Libs](#libs) (21)

## Agents

| Name | Cat | Model | Expertise | Picks-when | State |
|------|-----|-------|-----------|------------|-------|
| sgsd-exec-backend | C | sonnet | super-gsd/expertise/sgsd-exec-backend.md | files_touched match backend globs (*.py, *.go, *.ts server, *.rb, *.java) min... | active |
| sgsd-exec-config | C | sonnet | super-gsd/expertise/sgsd-exec-config.md | files_touched are config-shaped (Dockerfile, *.yaml/yml, docker-compose, .env... | active |
| sgsd-exec-docs | C | sonnet | super-gsd/expertise/sgsd-exec-docs.md | files_touched are all *.md | active |
| sgsd-exec-fix | C | sonnet | super-gsd/expertise/sgsd-exec-fix.md | task is bug-fix (reproduce -> failing test -> fix -> verify) | active |
| sgsd-exec-integration | C | sonnet | super-gsd/expertise/sgsd-exec-integra... | task is connecting pre-built parts (no new business logic, wiring only) | active |
| sgsd-exec-refactor | C | sonnet | super-gsd/expertise/sgsd-exec-refacto... | task is zero-behavior-change structural change | active |
| sgsd-exec-test | C | sonnet | super-gsd/expertise/sgsd-exec-test.md | task goal is test-writing as primary artifact (files_touched all *_test.*/*.s... | active |
| sgsd-exec-ui | C | sonnet | super-gsd/expertise/sgsd-exec-ui.md | files_touched match *.tsx/*.jsx/*.vue/*.svelte/*.css/*.scss | active |

## Gates

| Name | Category | Step | Mode | Reviewer | Repair? | State |
|------|----------|------|------|----------|---------|-------|
| MUDA-waste-audit | process-hygiene | 6.55 | soft-warn |  | yes | active |
| classifier-haiku | process-hygiene | 2 | soft-warn | haiku | yes | active |
| context-selector-haiku | process-hygiene | 4 | soft-warn | haiku | yes | active |
| intent-injection | process-hygiene | 5.5 | soft-warn |  | yes | active |
| per-dispatch-ATC | code-quality | 9.5 | hard-halt | sgsd-code-reviewer | yes | active |
| phase-level-ATC | code-quality | 6.5 | amortized | sgsd-code-reviewer | yes | active |
| qualitative-waste-audit | process-hygiene | 6.55 | soft-warn | codex-cli-reviewer | yes | active |
| sgsd-curate-learnings | process-hygiene | 10 | soft-warn |  | yes | active |
| sgsd-recall-queries | process-hygiene | 5 | soft-warn |  | yes | active |
| token-log | process-hygiene | 11 | soft-warn |  | yes | active |
| verifier-detail-vs-summary | verify-completeness | 0 | soft-warn |  | yes | active |
| verifier-row-arithmetic | verify-completeness | 0 | soft-warn |  | yes | active |
| vtp-enrichment | process-hygiene | 6.15 | soft-warn |  | yes | active |

## Review providers

| Name | Invocation | Target | Auth | Timeout | State |
|------|------------|--------|------|---------|-------|
| claude-sonnet-reviewer | agent | sgsd-code-reviewer | claude-max-oauth | 60 | active |
| codex-cli-reviewer | shell |  | codex-pro-oauth | 30 | active |

## Board

| Member | Role | Model | Perspective |
|--------|------|-------|-------------|
| sgsd-board-architect | Technical Architect | sonnet | feasibility,system design,tech debt,implementation risk |
| sgsd-board-contrarian | Contrarian Challenger | sonnet | challenges consensus,finds blind spots,stress-tests assumptions |
| sgsd-board-moonshot | Moonshot Visionary | sonnet | challenges incremental thinking,proposes 10x alternatives,prevents scope timi... |
| sgsd-board-pragmatist | Execution Pragmatist | sonnet | execution risk,timeline reality,resource constraints,what actually ships |
| sgsd-ceo | CEO (synthesizer / orchestrator) | opus | meta |

Escalation policy:

- Default minimal board: ["sgsd-board-architect","sgsd-board-contrarian"]
- Escalate-add: [{"add":"sgsd-board-pragmatist","trigger_prose":"any(m.role=='Contrarian' AND m.position=='OPPOSE' AND m.confidence>=4)","when":{"any":[{"over":"members","where":{"role":"Contrarian","position":"OP...
- Always-present: ["sgsd-ceo"]

## Contracts

| Name | Level | Path | Version |
|------|-------|------|---------|
| code-reviewer-v1 | reviewer-report | super-gsd/registry/review-providers.yaml | 1 |
| command-envelope-v1 | command-output | super-gsd/registry/command-envelope-v1.yaml | 1.0.0 |
| handover-contract-v2 | agent-dispatch | super-gsd/registry/handover-contract-v2.yaml | 2 |
| plan-schema-v2 | plan-frontmatter | super-gsd/templates/plan-schema-v2.json | 2 |
| review-providers-v1 | provider-registry | super-gsd/registry/review-providers.yaml | 1.0.0 |

## Skills

| Name | Description | Allowed tools |
|------|-------------|---------------|
| sgsd-backfill | Bring an existing super-gsd project up to current DLB-04 scaffolding. Creates... | Read, Bash |
| sgsd-browser | Browser automation for frontend debugging, UI verification, visual testing, a... | Read, Write, Bash, Glob, Grep, Agent |
| sgsd-brv-setup | Initialize ByteRover context tree for Super GSD. Seeds domain knowledge, conf... | Read, Write, Bash, Glob, Grep |
| sgsd-complete-milestone | Idempotent milestone-close workflow for SGSD v2. Audits governance, summarize... | Read, Write, Bash, Glob, Grep, Agent, mcp__vtp-kb__vtp_search, mcp__vtp-kb__v... |
| sgsd-deliberate | CEO/Board strategic deliberation. Multi-agent adversarial debate on structure... | Read, Write, Glob, Grep, Bash, Agent |
| sgsd-distill | Trajectory distillation -- extract abstract reusable principles from a closed ... | Read, Write, Bash, Agent |
| sgsd-memory-migrate | Consolidate Claude Code auto-memory + legacy .brv/context-tree/ into .plannin... | Read, Bash |
| sgsd-muda-audit | Run the MUDA (8-waste) watchdog probes on a phase. DLB-02. Captures haiku-fai... | Read, Bash |
| sgsd-orchestrate | Token-efficient autonomous orchestrator. Lean state machine: read-classify-di... | Read, Write, Edit, Glob, Grep, Bash, Agent, TaskCreate, TaskUpdate |
| sgsd-overlay-refresh | Sync a project's CLAUDE.md with canonical super-gsd/CLAUDE-OVERLAY.md. Uses H... | Read, Bash |
| sgsd-overwatcher | Signal map visualization. Scans .planning/ architecture, detects collisions/d... | Read, Write, Bash, Glob, Grep |
| sgsd-pause | Write checkpoint and stop the autonomous loop. Replaces /gsd-pause-work for S... | Read, Write, Bash |
| sgsd-readiness | Run the milestone pre-flight readiness audit on demand. Produces MILESTONE-RE... | Read, Write, Bash, Grep, Glob, Agent |
| sgsd-resume | Resume from checkpoint with full context restoration. Replaces /gsd-resume-wo... | Read, Write, Bash, Glob, Grep, Agent |
| sgsd-sepl | Operator-gated resource-grain improvement loop -- propose, review, commit. DLB... | Read, Write, Bash, mcp__vtp-kb__vtp_advise_service_enrichment, mcp__vtp-kb__v... |
| sgsd-token-audit | Analyze token usage, detect inefficiencies, suggest optimizations. Reads toke... | Read, Write, Glob, Grep, Bash |
| sgsd-transition | Migrate from GSD 2.0 (Pi harness) to Super GSD. One-time import of decisions,... | Read, Write, Edit, Glob, Grep, Bash |
| sgsd-triage | Planning-mode router. Detects when operator is figuring something out, invoke... | Read, Write, Bash, Skill, AskUserQuestion, mcp__vtp-kb__vtp_route_and_retriev... |
| sgsd-update | Pull latest super-gsd from origin/master and re-run the installer. Thin wrapp... | Read, Bash |
| sgsd-vtp-advise | Standalone VTP service-enrichment advisor. Operator-invoked ad-hoc for conser... | Read, Write, Bash, mcp__vtp-kb__vtp_advise_service_enrichment, mcp__vtp-kb__v... |
| sgsd-write-plan | SGSD-native plan-authoring skill. Replaces superpowers:writing-plans for SGSD... | Read, Write, Bash |

## Scripts

| Path | Purpose | Lines |
|------|---------|-------|
| super-gsd/scripts/Install-SgsdShortcut.ps1 | Super GSD - Install sgsd shortcut | 354 |
| super-gsd/scripts/codex-exec.sh | codex-exec -- bash wrapper around `codex exec` for Phase 14 provider substrate | 724 |
| super-gsd/scripts/merge-settings.js | Super GSD * merge-settings.js | 126 |
| super-gsd/scripts/patch-gsd-tools-known-keys.sh | ERG-02 -- Patch KNOWN_TOP_LEVEL in gsd-tools core.cjs so SGSD v2 config keys | 220 |
| super-gsd/scripts/sgsd-agent-dashboard.ps1 | Super GSD Agent Dashboard - Windows PowerShell | 192 |
| super-gsd/scripts/sgsd-agent-dashboard.sh | Super GSD Agent Dashboard | 241 |
| super-gsd/scripts/sgsd-boot.ps1 | Super GSD - Boot Command | 933 |
| super-gsd/scripts/sgsd-boot.sh | Super GSD * Boot Command (bash fallback) | 177 |
| super-gsd/scripts/sgsd-codex-monitor.ps1 | Super GSD - P5 - Codex Monitor | 849 |
| super-gsd/scripts/sgsd-configure.ps1 | Super GSD - Project Knowledge Setup | 173 |
| super-gsd/scripts/sgsd-conformance-check.sh | sgsd-conformance-check -- DLB-05 Wave B | 146 |
| super-gsd/scripts/sgsd-ctx.js | sgsd-ctx -- report current Claude Code session context usage as JSON | 153 |
| super-gsd/scripts/sgsd-ctx.sh | sgsd-ctx -- shell wrapper around sgsd-ctx.js | 21 |
| super-gsd/scripts/sgsd-curate.sh | sgsd-curate -- write a new entry to the SGSD context tree and update INDEX.md | 261 |
| super-gsd/scripts/sgsd-dashboard-host.ps1 | Super GSD - Dashboard Pane Host | 68 |
| super-gsd/scripts/sgsd-dashboard.ps1 | Super GSD Project Dashboard - Full Stats | 770 |
| super-gsd/scripts/sgsd-distill-milestone.sh | sgsd-distill-milestone -- trajectory distillation with triple hallucination gate | 462 |
| super-gsd/scripts/sgsd-gate-verdict.ps1 | Super GSD * P5 * Gate Verdict Board | 1412 |
| super-gsd/scripts/sgsd-headless.ps1 | Super GSD Headless Runner - Windows PowerShell | 146 |
| super-gsd/scripts/sgsd-headless.sh | Super GSD Headless Runner | 185 |
| super-gsd/scripts/sgsd-intent-check.sh | sgsd-intent-check -- milestone-close signal for DLB-03 intent continuity | 239 |
| super-gsd/scripts/sgsd-live-feed.ps1 | Super GSD Live Activity Feed - Simple scrollable live tail | 153 |
| super-gsd/scripts/sgsd-memory-migrate.ps1 | Super GSD - Memory Consolidation Migration | 429 |
| super-gsd/scripts/sgsd-mission-control.ps1 | Super GSD * P3 * Mission Control | 1999 |
| super-gsd/scripts/sgsd-muda-audit.sh | sgsd-muda-audit -- per-phase waste audit that writes WASTE.md + curates findings | 503 |
| super-gsd/scripts/sgsd-muda-probe.sh | sgsd-muda-probe -- lightweight waste watchdogs (DLB-02 Day 2 probes) | 263 |
| super-gsd/scripts/sgsd-muda-recurrence.sh | sgsd-muda-recurrence -- kill-condition instrumentation for the MUDA skill | 377 |
| super-gsd/scripts/sgsd-narrative.ps1 | Super GSD * P4 * Narrative + Ctrl+O Stream (v5) | 877 |
| super-gsd/scripts/sgsd-overlay-refresh.ps1 | sgsd-overlay-refresh.ps1 - DLB-06 follow-up | 163 |
| super-gsd/scripts/sgsd-overlay-refresh.sh | sgsd-overlay-refresh.sh -- bash mirror of sgsd-overlay-refresh.ps1 | 173 |
| super-gsd/scripts/sgsd-recall.sh | sgsd-recall -- retrieve matching entries from the SGSD context tree | 172 |
| super-gsd/scripts/sgsd-registry-sync.sh | sgsd-registry-sync -- materialise the Agents resource-registry manifest | 139 |
| super-gsd/scripts/sgsd-sepl-commit.sh | sgsd-sepl-commit -- apply (or reject) a resource-grain proposal | 179 |
| super-gsd/scripts/sgsd-sepl-propose.sh | sgsd-sepl-propose -- draft a resource-grain improvement proposal | 321 |
| super-gsd/scripts/sgsd-sepl-propose.test.sh | sgsd-sepl-propose.test.sh -- Unit test for is_major_proposal() detection. | 113 |
| super-gsd/scripts/sgsd-statusline.ps1 | sgsd-statusline.ps1 -- SGSD v2 custom statusline (R-Q8c) | 241 |
| super-gsd/scripts/sgsd-stop-handoff.sh | sgsd-stop-handoff.sh -- Claude Code Stop hook for autonomous session handoff | 527 |
| super-gsd/scripts/sgsd-thinking.ps1 | Super GSD Thinking Feed | 139 |
| super-gsd/scripts/sgsd-update.ps1 | sgsd-update.ps1 -- DLB-06 Wave A (PowerShell mirror of sgsd-update.sh) | 101 |
| super-gsd/scripts/sgsd-update.sh | sgsd-update -- DLB-06 Wave A | 112 |

## Libs

| Path | Purpose | Lines |
|------|---------|-------|
| super-gsd/scripts/lib/board-registry.cjs | (no banner) | 56 |
| super-gsd/scripts/lib/classifier-cache.cjs | (no banner) | 90 |
| super-gsd/scripts/lib/context-gauge.cjs | (no banner) | 52 |
| super-gsd/scripts/lib/crit-backlog.cjs | SGSD - CRIT-BACKLOG canonical writer/reader/renderer | 263 |
| super-gsd/scripts/lib/deliberation-schema.cjs | (no banner) | 65 |
| super-gsd/scripts/lib/dispatch-planner.cjs | (no banner) | 131 |
| super-gsd/scripts/lib/edge-guard.cjs | (no banner) | 265 |
| super-gsd/scripts/lib/gates-registry.cjs | (no banner) | 117 |
| super-gsd/scripts/lib/predicate-eval.cjs | (no banner) | 96 |
| super-gsd/scripts/lib/providers-registry.cjs | (no banner) | 175 |
| super-gsd/scripts/lib/repair-command-checker.cjs | SGSD - REPAIR-COMMAND-CHECKER | 484 |
| super-gsd/scripts/lib/review-ledger.cjs | SGSD - REVIEW-LEDGER canonical writer for ATC commit-review rows | 703 |
| super-gsd/scripts/lib/route-ledger.cjs | SGSD - ROUTE-LEDGER canonical writer for routing decisions | 443 |
| super-gsd/scripts/lib/sgsd-codex-status.ps1 | Super GSD * Shared Codex reviewer status helpers | 698 |
| super-gsd/scripts/lib/sgsd-mission-strip.ps1 | Super GSD - Mission Strip (Cockpit 2.0 - Phase 28) | 430 |
| super-gsd/scripts/lib/sgsd-render-cache.ps1 | Super GSD * Dashboard render cache library | 171 |
| super-gsd/scripts/lib/sgsd-substrate-status.ps1 | Super GSD * DLB-04 Substrate Status Helper | 207 |
| super-gsd/scripts/lib/vote-predicate.cjs | (no banner) | 87 |
| super-gsd/scripts/lib/vote-synthesis.cjs | (no banner) | 33 |
| super-gsd/scripts/lib/vtp-context-composer.cjs | (no banner) | 602 |
| super-gsd/scripts/lib/vtp-enrichment-gate.cjs | (no banner) | 886 |

