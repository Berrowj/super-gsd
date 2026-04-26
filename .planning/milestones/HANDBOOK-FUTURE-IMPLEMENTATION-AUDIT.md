---
status: audit
created: 2026-04-26
source_roadmap: .planning/milestones/HANDBOOK-FUTURE-ROADMAP.md
purpose: Prevent duplicate implementation by mapping proposed handbook-derived phases against current SGSD code and docs.
activation_rule: Run this audit before promoting any proposed milestone from HANDBOOK-FUTURE-ROADMAP.md.
---

# SGSD Future Roadmap Implementation Audit

## Bottom Line

Yes, a full audit is worth doing before any milestone promotion.

The proposed roadmap contains several ideas that are already implemented or
partially implemented in the current codebase. The safest next move is not to
blindly build the proposal. It is to promote each milestone through an
audit-first pass:

1. identify existing primitives,
2. keep or formalize what already works,
3. extend only the missing contract,
4. delete duplicate proposal scope,
5. add tests where current behavior is real but not mechanically proven.

## Status Legend

| Status | Meaning |
|---|---|
| Implemented | Current code/docs already provide the core behavior. Future work should verify and document, not rebuild. |
| Partial | There is a real substrate, but the proposed contract is broader than current implementation. |
| Missing | Search found no live implementation beyond proposal docs. |
| Duplicate-risk | The proposed work would likely duplicate current code unless it is narrowed first. |

## Current Implementation Evidence

### Boot, Setup, And Cockpit

- `super-gsd/scripts/Install-SgsdShortcut.ps1` defines `sg`, `sgsd`,
  `sgsd-setup`, `sgsd-refresh`, and `SGSD-Cockpit`.
- `super-gsd/scripts/Install-SgsdShortcut.ps1` makes `sg` start the cockpit and
  then run Claude in the current terminal, with `-Go`, `-NoCockpit`,
  `-NoClaude`, and `-FullPreflight`.
- `super-gsd/scripts/sgsd-boot.ps1` supports `-SkipPreflight`, `-NoOpen`,
  `-Claude`, `-Go`, and `-Greet`.
- `super-gsd/scripts/sgsd-boot.ps1` checks private knowledge bank paths from
  `.planning/config.json#knowledge` and only falls back to `.mcp.json` VTP
  discovery.
- `super-gsd/scripts/sgsd-configure.ps1` writes `knowledge.private_root`,
  `knowledge.memory_root`, `knowledge.fallback_corpus`, and discovery-only
  public source metadata.
- `super-gsd/scripts/sgsd-dashboard-host.ps1` shows a visible dashboard failure
  screen instead of allowing a crashed pane to look like a normal prompt.
- `super-gsd/docs/SGSD-BOOT-STARTUP-GUIDE.md` already documents the daily
  startup model, fast/full preflight, knowledge tiers, and cockpit failure
  behavior.

Audit consequence: v1.6 should be renamed or framed as "Cockpit 2.0 and startup
verification," not "build boot behavior from scratch." The boot/setup behavior
is now mostly evidence to verify. The new missing surface is the cockpit
operator model.

### Cockpit Signal Surface

- `super-gsd/scripts/sgsd-mission-control.ps1` already shows milestone progress,
  phase progression, waves/tasks, blockers, SGSD-V2 pulse, Codex line, cost,
  agents, commits, and MCP state.
- `super-gsd/scripts/sgsd-narrative.ps1` already provides a cached narrative,
  live tool stream, current Claude session JSONL aggregation, and Codex
  timeline rows.
- `super-gsd/scripts/sgsd-codex-monitor.ps1` already summarizes Codex state,
  verdict labels, prompt/report fields, operator brief, and review progress.

Audit consequence: Cockpit 2.0 should not add raw telemetry first. It should
reorganize existing signal around operator questions: model activity, current
objective, unlock, blocker, agents used, Codex state, evidence, and next action.

### Contracts, Ledgers, And Review Providers

- `super-gsd/registry/review-providers.yaml` defines review providers and a
  `code-reviewer-v1` report contract.
- `super-gsd/scripts/lib/providers-registry.cjs` loads provider rows and
  `.planning/config.json#review_providers`, resolves gate reviewer providers,
  and supports fallback provider routing.
- `super-gsd/scripts/codex-exec.sh` parses the 5-field reviewer contract,
  writes reports atomically, and appends provenance rows to
  `.planning/metrics/codex-log.jsonl`.
- `super-gsd/tools/provider-contract/contract-check.mjs` compares Claude and
  Codex reports against the provider contract.
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` contains
  `validateContract(...)`, `parseFindingsDetail(...)`, provider fallback,
  timeout tiers, and `FINDINGS_DETAIL` instructions.
- `super-gsd/registry/handover-contract-v2.yaml` already gives agent handover
  contracts and expected outputs.
- `.planning/milestones/v1.5/SUMMARY.md` explicitly records the remaining gap:
  Codex review rounds are not fully captured in one canonical
  `commit-reviews.jsonl` source.

Audit consequence: v1.7 should extend existing contract machinery. It should
not invent an unrelated command-envelope system without reconciling
`code-reviewer-v1`, handover-contract-v2, plan-schema-v2, and current JSONL
telemetry.

### Gates, MUDA, And Fitness Signals

- `super-gsd/registry/gates.yaml` already defines gates, enforcement modes,
  cadence concepts, triggers, emitted evidence, and reviewer providers.
- `super-gsd/scripts/lib/edge-guard.cjs` writes
  `.planning/metrics/edge-guard-log.jsonl` and can return `ok`, `logged`, or
  `halt` based on missing emitted artifacts and gate escalation.
- `super-gsd/skills/sgsd-complete-milestone/SKILL.md` already runs MUDA
  recurrence and gate-drift audit during milestone close.
- `super-gsd/scripts/sgsd-muda-audit.sh` writes `WASTE.md`, curates findings,
  emits `muda-log.jsonl`, and records thresholds/evidence.
- `super-gsd/scripts/sgsd-muda-probe.sh` already has mechanical probes for
  defects, waiting, motion, extra-processing, and inventory, with config-driven
  inventory thresholds.
- `super-gsd/scripts/sgsd-muda-recurrence.sh` implements a kill-condition signal:
  if no waste class recurs across two consecutive milestones, the MUDA skill is
  flagged for retirement.
- `.planning/config.json` already has `atc.verifier_adversarial_rate`,
  `review_providers.codex_timeout_tiers`, and `muda.inventory_thresholds`.

Audit consequence: v1.8 should not create MUDA from scratch. It should add
missing "gate value" metrics and a keep/kill/merge/sample table on top of the
existing MUDA and edge-guard substrates.

### VTP, Knowledge, And Memory

- `super-gsd/scripts/lib/vtp-enrichment-gate.cjs` implements a research to
  planning VTP enrichment gate and writes `VTP-ENRICHMENT.md` artifacts.
- `vtp-enrichment-gate.cjs` distinguishes `success`, `empty_hit`, and
  `api_error`, writes `empty_hit` and `vtp_status` frontmatter, and includes
  tests for those paths.
- `sgsd-orchestrate/SKILL.md` records VTP health into
  `.planning/metrics/vtp-health.jsonl`.
- `super-gsd/skills/sgsd-vtp-advise/SKILL.md` provides a standalone VTP
  service-enrichment advisor for conservative proposal grounding.
- `super-gsd/scripts/sgsd-memory-migrate.ps1` migrates older memory locations
  into `.planning/memory` and can create a junction for Claude auto-memory.
- `super-gsd/docs/SGSD-BOOT-STARTUP-GUIDE.md` already documents VTP as optional
  and describes private KB, SGSD memory, and public fallback tiers.

Audit consequence: v1.9 should not build "VTP integration." It should build the
missing general knowledge-provider contract, decision-impact scoring, richer
retrieval failure taxonomy, and memory provenance/retention fields.

### Failure, Restart, And Readiness

- `super-gsd/tools/provider-contract/contract-check.mjs` has provider contract
  fixtures and parser comparison.
- `super-gsd/tools/phase-verifier/phase-verifier.mjs` provides a browser route
  verification tool that writes `BROWSER-REVIEW.md`, checks evidence, and
  appends to a deferral ledger.
- `super-gsd/scripts/lib/edge-guard.cjs` has a self-test that writes and reads
  JSONL rows in a temp project.
- `sgsd-orchestrate/SKILL.md` already has checkpoint/resume concepts and schema
  repair cap behavior.
- `super-gsd/skills/sgsd-readiness/SKILL.md` writes readiness rows to
  `.planning/metrics/readiness-log.jsonl`.
- `.planning/config.json#handoff` and `super-gsd/scripts/sgsd-stop-handoff.sh`
  provide autonomous handoff controls, but handoff is currently disabled in
  config.

Audit consequence: v2.0 should integrate existing tests into a named failure
injection suite. It should not duplicate the provider contract harness,
phase-verifier, or edge-guard self-test.

### Installer, Docs, And Migration

- `Install-SgsdShortcut.ps1` installs profile functions and includes fallback
  path behavior.
- `sgsd-configure.ps1` is a focused knowledge/memory setup wizard, not a full
  new-project wizard.
- `SGSD-BOOT-STARTUP-GUIDE.md` exists, but `README.md` does not currently link
  to it based on the audit search.
- `sgsd-memory-migrate.ps1` exists for memory consolidation, but there is no
  general upgrade drift report for profiles, dashboard names, config schema,
  generated docs, and stale gates.

Audit consequence: v2.1 should reuse the installer and setup scripts. It should
add clean-machine audit, README integration, example project, and broad upgrade
safety rather than writing another boot/setup system.

## Phase-By-Phase Audit Matrix

| Phase | Proposed work | Current status | Existing evidence | Recommendation before implementation |
|---:|---|---|---|---|
| 26 | Cockpit Operator Question Contract | Partial | mission control, narrative, Codex monitor already answer some questions separately | Define eight operator questions, owner lanes, freshness, empty states, and repair paths. |
| 27 | Cockpit Data Source And Objective Tree Audit | Partial | state files, phase folders, metrics JSONL, Claude session JSONL, Codex logs | Reuse existing logs first; add `cockpit-state.json` only for unanswered questions. |
| 28 | Mission Control 2.0 Layout | Partial | mission control already has progress, blockers, agents, gates, cost, MCP | Reorder around objective, unlock, blocker, next action, and freshness. Do not duplicate narrative/Codex panes. |
| 29 | Agent And Codex Visibility Lanes | Partial | narrative tool stream, agent rows, Codex monitor and codex-log | Normalize agent/Codex states and link to artifacts/reports. |
| 30 | Startup Verification And Cockpit Acceptance | Partial | boot aliases, startup guide, dashboard host, knowledge config | Verify startup commands and run cockpit acceptance scenarios; fix only observed failures. |
| 31 | Canonical Command Envelope | Partial / duplicate-risk | reviewer contract, handover contract, plan schema, Codex contract parser | Design envelope by reconciling existing contracts first. |
| 32 | Route Decision Ledger | Missing | no live `route-decisions.jsonl` hits outside proposal docs | Build only after deciding which route choices matter. |
| 33 | Repair Instruction Contract | Partial | schema repair path, browser gate repair language, blocker handling | Add universal `repair_instruction` field only for blocking gates. |
| 34 | Canonical Review Ledger | Partial / known gap | `codex-log.jsonl`, per-phase `commit-reviews.jsonl`, v1.5 SUMMARY gap | Consolidate existing review sources. Do not create another parallel log. |
| 35 | Generated System Map | Partial | `resource-registry/agents.jsonl`, manual handbook catalogs | Generate from registries/frontmatter. Replace manual tables later. |
| 36 | Gate Value Telemetry | Partial | `edge-guard-log.jsonl`, `muda-log.jsonl`, Codex logs | Add value metrics: caught defect, repair time, false-positive signal. |
| 37 | MUDA Deletion Candidates | Partial | `sgsd-muda-recurrence.sh` retirement signal | Extend WASTE.md with delete/merge/sample candidates. |
| 38 | Risk-Tiered Gate Sampling | Partial | ATC tiers, gate triggers, adversarial rate | Generalize sampling decisions and log them. |
| 39 | Gate Keep/Kill Review | Partial | MUDA recurrence, Codex kill-check, gate-drift audit | Create one milestone close keep/kill table fed by existing logs. |
| 40 | Phase Folder Perfection Contract | Partial | many phase folders, phase verifier, plan schema | Add checklist/audit; avoid changing historical folders blindly. |
| 41 | Knowledge Provider Registry | Partial / duplicate-risk | review provider registry exists; knowledge config exists | Do not reuse review-provider registry blindly. Add knowledge-provider schema only if config fields are insufficient. |
| 42 | Relevance Scoring And Citation Theater Prevention | Partial | VTP hits include relevance/citation table | Add decision-impact and non-actionable labels. |
| 43 | Typed Retrieval Failure Modes | Partial | `empty_hit` and `api_error` exist | Extend taxonomy to noisy, stale, too broad, privacy blocked, missing corpus. |
| 44 | Memory Provenance And Retention | Partial | memory migration and `.planning/memory` structure | Add provenance/retention schema for new writes only. |
| 45 | Public Fallback Corpus Policy | Partial | `sgsd-configure.ps1` public sources, startup guide | Add enforcement and copyright/licensing guardrails. |
| 46 | Gate Failure-Injection Harness | Partial | contract-check fixtures, edge-guard self-test, VTP gate tests | Wrap existing tests into named harness before adding new cases. |
| 47 | Restart And Handoff Chaos Tests | Partial | checkpoint/resume specs, handoff config/scripts | Add chaos tests around existing restart and handoff surfaces. |
| 48 | Provider Backpressure And Timeout Circuits | Partial | Codex timeout tiers and fallback | Add global provider budget/circuit only if recurring failures justify it. |
| 49 | Scenario-Based Acceptance Suite | Partial | phase-verifier route checks | Define SGSD workflow scenarios; reuse phase-verifier where UI applies. |
| 50 | Release Readiness Score | Partial | readiness skill/log, gate drift, MUDA recurrence | Compose score from existing logs. Do not create new raw telemetry first. |
| 51 | Installer Portability Audit | Partial | installer writes profile functions | Add clean-profile test and dependency report. |
| 52 | New Project Wizard | Partial | `sgsd-configure.ps1` covers knowledge/memory only | Extend or wrap configure; avoid a second wizard unless scope expands. |
| 53 | Example Project And Demo Script | Missing | no live example project found | Build a tiny demo project after contracts stabilize. |
| 54 | Public Docs Refresh | Partial | startup guide exists, README link absent | Link and rewrite README quick start. |
| 55 | Migration And Upgrade Safety | Partial | `sgsd-memory-migrate.ps1`, update scripts | Add drift report for profile functions, config schema, dashboards, gates, docs. |

## Duplicate-Risk Hotspots

1. **v1.6 boot commands** - already mostly implemented. Keep them as
   verification and docs linking inside Cockpit 2.0, not new scripting.
2. **v1.7 command envelope** - multiple contracts already exist. Any new schema
   must reconcile current contracts instead of creating a fifth one.
3. **v1.8 MUDA pruning** - MUDA already has probes, logs, and a retirement
   signal. Add value metrics and candidate tables, not a new audit tool.
4. **v1.9 knowledge provider registry** - review-provider registry exists, but
   it is not the same as a knowledge-provider registry. Reuse patterns, not the
   object directly.
5. **v2.0 failure harness** - pieces already exist. The useful work is one
   orchestrated harness and scenario list.
6. **v2.1 setup wizard** - `sgsd-configure.ps1` already handles knowledge and
   memory. Extend it carefully or wrap it.

## Recommended Roadmap Changes

Before promotion:

- Add an "Audit Existing Surface" step to every milestone.
- Mark v1.6 as "Cockpit 2.0 plus startup verification."
- Mark v1.7 as "contract consolidation" rather than greenfield envelope work.
- Mark v1.8 as "value metrics and pruning on existing MUDA."
- Mark v1.9 as "generalize VTP into optional knowledge providers."
- Mark v2.0 as "compose failure harness from existing tests, then add gaps."
- Mark v2.1 as "distribution hardening on current installer/setup."

## Promotion Gate

For any milestone promoted from the handbook roadmap, Claude should first create:

```text
.planning/milestones/{version}/EXISTING-SURFACE-AUDIT.md
```

That audit must include:

- existing files,
- existing logs/artifacts,
- duplicate-risk calls,
- what to keep,
- what to extend,
- what to delete from scope,
- final phase names after deduplication.

Only then should the milestone create `REQUIREMENTS.md` and phase plans.
