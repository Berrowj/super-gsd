# SCHEMA-FIX (--fix-schema attempt 2/3) — SAC shape only

The plan below fails ONLY SCHEMA-10: every semantic_acceptance_criteria entry must be an object with keys: id, input, expected_outcome, verification_cmd. Reshape every SAC entry into that shape — 'input' = the real data/fixture the probe runs against, 'expected_outcome' = observable pass condition, 'verification_cmd' = a runnable command. Derive them from each entry's existing probe/pass content; keep everything else in the file byte-identical. Reference SAC shape from the passing 148 plan is shown at the end. Emit ONLY the full corrected plan to stdout. Budget ~2 minutes; do not browse the repo.

## Plan to fix
---
schema_version: 2
phase: 149
plan: "149-01"
title: "Skill-Routing Table"
model: codex
expected_ATC_tier: GATE
prior_errors_lookup: true
slug: "skill-routing-table"
milestone: "v3.5"
status: "PLANNED"
depends_on:
  - "146"
skip_gates: []
lessons_path: null
design_ref: ".planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md#p149"
intent: "SGSD governance must be a runtime mechanism, not prose: gates, MUDA, triage, and skill routing fire in every session type with evidence logged loudly when they do not."
execution_mode: "serial-codex"
adapter_decision: "adapter-in-loader"
lock_status: locked
locked_at: "2026-08-08T00:00:00+01:00"
locked_by: "codex-phase-planner"
risk_rating: high
rollback_plan: >
  Rollback removes the P149 skill-routing runtime without deleting historical evidence. Delete
  `super-gsd/registry/skill-routing.yaml`, delete
  `super-gsd/scripts/lib/skill-routing-registry.cjs`, delete the malformed registry fixture, revert
  P149 edits to `super-gsd/hooks/sgsd-intent-classifier.cjs`,
  `super-gsd/hooks/sgsd-quality-gate.js`, `super-gsd/scripts/lib/orchestrator-hooks.cjs`,
  `super-gsd/registry/session-governance-hooks.yaml`, and
  `super-gsd/skills/sgsd-orchestrate/SKILL.md`. Leave
  `.planning/metrics/gate-evidence.jsonl` append-only; if rollback evidence is needed, append a new
  reason-coded envelope row rather than editing prior rows.
allowed_files:
  - ".planning/milestones/v3.5/phases/149-skill-routing-table/149-01-PLAN-LOCKED.md"
  - ".planning/metrics/gate-evidence.jsonl"
  - ".planning/metrics/codex-log.jsonl"
  - ".planning/metrics/codex-live.json"
  - ".planning/metrics/codex-live-output.txt"
  - "super-gsd/registry/skill-routing.yaml"
  - "super-gsd/scripts/lib/skill-routing-registry.cjs"
  - "super-gsd/tools/self-test/fixtures/skill-routing-malformed.yaml"
  - "super-gsd/hooks/sgsd-intent-classifier.cjs"
  - "super-gsd/hooks/sgsd-quality-gate.js"
  - "super-gsd/registry/session-governance-hooks.yaml"
  - "super-gsd/scripts/lib/orchestrator-hooks.cjs"
  - "super-gsd/skills/sgsd-orchestrate/SKILL.md"
forbidden_files:
  - "super-gsd/registry/gates.yaml"
  - ".planning/STATE.md"
  - ".planning/milestones/v3.5/ROADMAP.md"
  - ".claude/**"
  - "~/.claude/**"
  - "devcp/**"
invariants:
  - "P149 keeps `skill-routing.yaml` as the single human-maintained routing metadata source after the loader exists."
  - "The adapter decision is adapter-in-loader: classifier and orchestrator callers consume normalized helper output instead of parsing a second registry shape."
  - "Do not copy `gates.yaml` predicates into `skill-routing.yaml`; gate-owned eligibility is represented only by references such as `gate_ref`."
  - "Self-test behavior fails malformed routing tables; runtime behavior falls back to compiled embedded routes and logs degradation evidence loudly."
  - "Malformed runtime fallback does not throw upward during a live session."
  - "Every degraded path writes a reason-coded row to `.planning/metrics/gate-evidence.jsonl`; degraded paths never rely on stderr alone."
  - "P146 manual-session suggestions consume prompt-time rows from `skill-routing.yaml` through the loader adapter."
  - "Auto-mode phase-close consult runs after phase completion and before Step 6.7 milestone completion."
  - "Every applicable scheduled route appends a fired or skipped evidence row with skill, moment, mode, phase, decision, and reason."
  - "Mutating skills such as `gsd-code-review-fix` are never scheduled automatically."
  - "Legacy aliases remain aliases or explicit omitted rows; P149 does not create new first-class SGSD skills for health or cleanup aliases."
  - "Runtime helper resources shipped with SGSD are resolved from the SGSD root or module-local paths, not from ambient cwd."
anti_stub_policy:
  - "No acceptance scenario may pass by checking only hardcoded stdout unrelated to the real registry table."
  - "The schema self-test parses the real `super-gsd/registry/skill-routing.yaml` with `js-yaml`."
  - "The malformed fixture is a real YAML file and must fail self-test."
  - "Manual classifier probes use real prompt strings and the real loader adapter."
  - "Runtime fallback is verified by forcing the malformed fixture through the loader override."
  - "Phase-close verification appends or tails real `.planning/metrics/gate-evidence.jsonl` rows for `event=skill-routing`."
source_audit:
  - source: "CONTEXT"
    path: ".planning/milestones/v3.5/phases/149-skill-routing-table/CONTEXT.md"
    status: success
    relevant_hits: 4
    citations:
      - "Defines P149 goal, table shape, constraints, neglected inventory, malformed-table behavior, and AC scope."
  - source: "RESEARCH"
    path: ".planning/milestones/v3.5/phases/149-skill-routing-table/149-RESEARCH.md"
    status: success
    relevant_hits: 24
    citations:
      - "Supplies cited findings, live-code seams, risks, recommended task shape, and known mismatch between P146 parser shape and P149 table shape."
  - source: "VTP"
    path: "VTP ide-ce7c-002"
    status: success
    relevant_hits: 1
    citations:
      - "Supports the design lineage: central process-input routing to the right GSD skill."
  - source: "Design spec AC-149"
    path: ".planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md#p149"
    status: success
    relevant_hits: 3
    citations:
      - "Acceptance criteria: schema self-test, manual visible suggestion, auto phase-close fired/skipped logging."
  - source: "plan-schema-v2"
    path: "super-gsd/templates/plan-schema-v2.json"
    status: success
    relevant_hits: 2
    citations:
      - "Requires `schema_version`, `tasks`, and `semantic_acceptance_criteria`."
      - "Each task must declare id, agent, model, files_touched, input_contract, output_contract, hypothesis, falsifier, and stop_rule."
design_decisions:
  - decision: "adapter_decision"
    value: "adapter-in-loader"
  - decision: "registry_source"
    value: >
      `super-gsd/registry/skill-routing.yaml` is the single runtime source of truth for neglected SGSD skill routing.
  - decision: "loader_boundary"
    value: >
      `super-gsd/scripts/lib/skill-routing-registry.cjs` owns YAML loading, schema validation, prompt-time adaptation, scheduled-route lookup,
      compiled fallback, runtime degradation logging, and CLI probes.
  - decision: "manual_session_integration"
    value: >
      P146 manual-session suggestions consume prompt-time rows from `skill-routing.yaml` through `toPromptGovernanceRoutes()`.
  - decision: "phase_close_integration"
    value: >
      The orchestrator scheduled consult runs after “Mark phase complete, advance to next phase” and before Step 6.7 milestone completion.
tasks:
  - id: "P149-T1"
    type: "registry"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/registry/skill-routing.yaml"
    input_contract: >
      Implement only the registry table using the Registry Content Contract and Inventory Decisions. Do not edit classifier or orchestrator code in this task.
    output_contract: >
      `super-gsd/registry/skill-routing.yaml` exists with a single top-level routing array that covers the required inventory decisions without duplicating gate predicates.
    hypothesis: "A single per-skill routing table can cover neglected skill inventory and legacy alias decisions without duplicating gate predicates."
    falsifier: >
      Any required inventory item is absent, any route row lacks skill/signatures/moment/modes, or any cooldown copies a predicate instead of referencing a gate name or route policy.
    stop_rule: >
      Stop after the registry table exists and the verification command reports row count plus inventory coverage; do not edit classifier, orchestrator, or docs in this task.
    verification:
      commands:
        - >-
          node -e "const fs=require('fs'); const yaml=require('js-yaml'); const doc=yaml.load(fs.readFileSync('super-gsd/registry/skill-routing.yaml','utf8')); const rows=doc.routes||doc.skills; if(!Array.isArray(rows)) throw new Error('routes array missing'); for(const [i,r] of rows.entries()){ for(const k of ['skill','signatures','moment','modes']) if(r[k]===undefined) throw new Error(i+': missing '+k); if(r.cooldown&&r.cooldown.predicate) throw new Error(i+': predicate duplication forbidden'); } console.log('skill-routing rows='+rows.length);"
  - id: "P149-T2"
    type: "loader-schema-fallback"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/scripts/lib/skill-routing-registry.cjs"
      - "super-gsd/tools/self-test/fixtures/skill-routing-malformed.yaml"
    input_contract: >
      Implement only the js-yaml loader/helper module and malformed fixture. Reuse `js-yaml`; do not wire classifier or orchestrator callers in this task.
    output_contract: >
      The helper exports normalized loading, prompt adapter, scheduled-route query, compiled fallback, and CLI probes; malformed self-test fails while runtime probe falls back and logs degradation.
    hypothesis: "A js-yaml loader can validate the runtime table in self-test, adapt it for callers, and fall back loudly at runtime when malformed."
    falsifier: >
      Malformed registry self-test exits zero, runtime probe throws upward, fallback routes are unavailable, or registry degradation is not written to gate evidence.
    stop_rule: >
      Stop after the loader self-test, malformed self-test, and malformed runtime probe commands demonstrate the expected self-test failure and runtime fallback behavior.
    verification:
      commands:
        - "node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test"
        - "node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test --registry super-gsd/tools/self-test/fixtures/skill-routing-malformed.yaml"
        - "node super-gsd/scripts/lib/skill-routing-registry.cjs --runtime-probe --registry super-gsd/tools/self-test/fixtures/skill-routing-malformed.yaml --moment prompt-time --mode manual"
  - id: "P149-T3"
    type: "classifier-adapter"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/hooks/sgsd-intent-classifier.cjs"
      - "super-gsd/hooks/sgsd-quality-gate.js"
      - "super-gsd/registry/session-governance-hooks.yaml"
    input_contract: >
      Wire P146 manual-session routing to the loader adapter and reduce `session-governance-hooks.yaml` to compatibility metadata or pointer text as needed.
    output_contract: >
      Manual classifier prompts consume prompt-time rows from `skill-routing.yaml` through the loader adapter and produce visible suggestions without a second maintained lexicon.
    hypothesis: "P146 manual-session suggestions can consume prompt-time rows from skill-routing.yaml through the loader adapter without preserving a second maintained lexicon."
    falsifier: >
      Manual prompt probes fail to produce visible suggestions for the named skills, or normal runtime still depends on `session-governance-hooks.yaml` as the maintained lexicon.
    stop_rule: >
      Stop after the three manual prompt verification commands produce visible suggestions from `skill-routing.yaml` and malformed-table fallback still preserves the token-audit route.
    verification:
      commands:
        - >-
          node super-gsd/hooks/sgsd-intent-classifier.cjs --mode manual --prompt "please run a token waste audit before this closes"
        - >-
          node super-gsd/hooks/sgsd-intent-classifier.cjs --mode manual --prompt "this looks like MUDA and needs a waste audit"
        - >-
          node super-gsd/hooks/sgsd-intent-classifier.cjs --mode manual --prompt "use VTP advice for this architecture proposal"
  - id: "P149-T4"
    type: "orchestrator-phase-close"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/scripts/lib/orchestrator-hooks.cjs"
      - "super-gsd/scripts/lib/skill-routing-registry.cjs"
    input_contract: >
      Add the orchestrator scheduled consult API using loader-provided scheduled rows. Place the phase-close seam after phase completion and before Step 6.7 milestone completion.
    output_contract: >
      Phase-close dry run enumerates applicable scheduled routes and appends gate-evidence envelope rows for fired and skipped decisions with concrete reasons.
    hypothesis: "Auto-mode phase close can consult scheduled routing rows after phase completion and before milestone-close logic, logging fired/skipped decisions for every applicable skill."
    falsifier: >
      The phase-close hook omits applicable rows, reads copied predicates from `gates.yaml`, runs after milestone-close logic, or fails to append fired/skipped evidence rows.
    stop_rule: >
      Stop after the phase-close dry-run command and gate-evidence ledger tail show scheduled skill-routing rows with skill, moment, mode, phase, decision, and reason.
    verification:
      commands:
        - >-
          node super-gsd/scripts/lib/orchestrator-hooks.cjs skill-routing --moment phase-close --mode auto --phase 149 --files-changed 4 --diff-lines 100 --dry-run
        - >-
          Select-String -Path ".planning/metrics/gate-evidence.jsonl" -Pattern '"event":"skill-routing"' | Select-Object -Last 10
  - id: "P149-T5"
    type: "orchestrate-doc-runtime-reference"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/skills/sgsd-orchestrate/SKILL.md"
    input_contract: >
      Edit only `super-gsd/skills/sgsd-orchestrate/SKILL.md`; replace hardcoded routing prose with references to `skill-routing.yaml` and the orchestrator hook.
    output_contract: >
      The orchestrate skill preserves operator-readable guidance while making runtime routing a table/helper decision and documents the phase-close consult before Step 6.7.
    hypothesis: "Replacing hardcoded routing prose with references to the registry prevents policy drift while preserving operator-readable workflow instructions."
    falsifier: >
      The orchestrate skill still contains prose-only routing trigger rules, omits the registry/helper reference, or fails to document the phase-close consult placement.
    stop_rule: >
      Stop after the two Select-String verification commands find registry/helper references and the Step 6.7 or phase-close placement.
    verification:
      commands:
        - >-
          Select-String -Path "super-gsd/skills/sgsd-orchestrate/SKILL.md" -Pattern "skill-routing.yaml|skill-routing"
        - >-
          Select-String -Path "super-gsd/skills/sgsd-orchestrate/SKILL.md" -Pattern "Step 6.7|phase-close"
  - id: "P149-T6"
    type: "acceptance-verification"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/scripts/lib/skill-routing-registry.cjs"
      - "super-gsd/hooks/sgsd-intent-classifier.cjs"
      - "super-gsd/scripts/lib/orchestrator-hooks.cjs"
      - ".planning/metrics/gate-evidence.jsonl"
    input_contract: >
      Run AC-149 verification end to end against real repo data after P149-T1 through P149-T5 are complete.
    output_contract: >
      Verification proves schema self-test passes the real table and fails malformed fixture, manual prompt suggestions are visible, and auto phase-close logs fired/skipped evidence.
    hypothesis: "AC-149 is satisfied only when schema validation, manual prompt suggestion, and auto phase-close fired/skipped evidence all pass against real repo data."
    falsifier: >
      Any AC-149 verification command fails, manual prompt suggestion is absent, auto phase-close evidence is absent, or malformed runtime degradation is not observable.
    stop_rule: >
      Stop after all AC-149 verification commands pass and the final gate-evidence tail shows manual/auto skill-routing and malformed-runtime degradation evidence.
    verification:
      commands:
        - "node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test"
        - >-
          node super-gsd/hooks/sgsd-intent-classifier.cjs --mode manual --prompt "run code review and verify work before close"
        - >-
          node super-gsd/scripts/lib/orchestrator-hooks.cjs skill-routing --moment phase-close --mode auto --phase 149 --files-changed 4 --diff-lines 100
        - >-
          Select-String -Path ".planning/metrics/gate-evidence.jsonl" -Pattern '"event":"skill-routing"' | Select-Object -Last 20
semantic_acceptance_criteria:
  - task_id: "P149-T1"
    id: "SCHEMA-09"
    probe: "Parse the real registry YAML and validate required fields on every route row."
    pass: "All rows contain skill, signatures, moment, modes; cooldowns reference gate names or route policy only."
  - task_id: "P149-T1"
    id: "DLB-07"
    probe: "Coverage check against the real neglected inventory named in P149 CONTEXT."
    pass: "Every inventory item is either a canonical route or an explicit alias/omit decision in the table."
  - task_id: "P149-T2"
    id: "SCHEMA-09"
    probe: "Self-test against malformed fixture."
    pass: "Malformed registry exits non-zero in self-test."
  - task_id: "P149-T2"
    id: "DLB-07"
    probe: "Runtime probe against the same malformed fixture."
    pass: "Runtime does not throw upward; it returns compiled fallback routes and emits a gate-evidence degradation row."
  - task_id: "P149-T3"
    id: "SCHEMA-09"
    probe: "Manual classifier probes use real prompt strings mapped by skill-routing.yaml."
    pass: "Visible suggestions are produced for sgsd-token-audit, sgsd-muda-audit, and sgsd-vtp-advise."
  - task_id: "P149-T3"
    id: "DLB-07"
    probe: "Force malformed table via loader override and run the token-audit prompt."
    pass: "Fallback still suggests the compiled token route and logs registry degradation to gate-evidence."
  - task_id: "P149-T4"
    id: "SCHEMA-09"
    probe: "Phase-close scheduled consult uses real registry rows with moment=phase-close and mode=auto."
    pass: "The hook enumerates all applicable scheduled rows and never reads predicates copied from gates.yaml."
  - task_id: "P149-T4"
    id: "DLB-07"
    probe: "Gate-evidence ledger tail after phase-close probe."
    pass: "Every scheduled skill has a fired or skipped row with skill, moment, mode, phase, decision, and reason."
  - task_id: "P149-T5"
    id: "SCHEMA-09"
    probe: "Read the real orchestrate skill sections named in research findings 11 and 13."
    pass: "Routing decisions point to skill-routing.yaml/helper instead of prose-only trigger rules."
  - task_id: "P149-T5"
    id: "DLB-07"
    probe: "Confirm the phase-close seam is documented."
    pass: "The consult is placed after mark-phase-complete/advance-next-phase and before Step 6.7 milestone completion."
  - task_id: "P149-T6"
    id: "SCHEMA-09"
    probe: "Run the schema self-test on the real table."
    pass: "Self-test exits 0 for skill-routing.yaml and exits non-zero for the malformed fixture."
  - task_id: "P149-T6"
    id: "DLB-07"
    probe: "Run manual and auto probes, then inspect gate-evidence.jsonl."
    pass: "Manual prompt yields visible suggestion; auto phase-close logs fired/skipped rows; malformed runtime logs degradation."
---

# P149 Plan — Skill-Routing Table

## Goal

Create `super-gsd/registry/skill-routing.yaml` as the single runtime source of truth for neglected SGSD skill routing, then wire it into P146 manual-session suggestions and auto-mode phase-close scheduling with gate-evidence rows for fired, skipped, and degraded decisions.

## Architecture

Use `skill-routing.yaml` for human-maintained routing metadata. Add `super-gsd/scripts/lib/skill-routing-registry.cjs` as the only parser/validator/adapter: it loads YAML with `js-yaml`, schema-validates for self-test, adapts prompt-time rows into P146’s existing route shape, and exposes scheduled rows for orchestrator phase-close hooks.

Runtime behavior differs from self-test behavior deliberately: self-test fails malformed tables; runtime falls back to a compiled embedded lexicon and logs degradation through the existing gate-evidence command-envelope writer. This preserves sessions while making the failure loud.

## Adapter Decision

Choose adapter-in-loader, not a classifier parser extension. P149’s desired table is per-skill routing metadata, while P146 currently expects `routes[].trigger/predicate/enforcement`; changing every classifier call site to understand two registry shapes would create dual semantics. The loader should own the adaptation: `loadSkillRoutingRegistry()` returns normalized route rows, `toPromptGovernanceRoutes()` emits P146-compatible prompt-time routes, and `getScheduledRoutes(moment, mode)` serves the orchestrator. That keeps `skill-routing.yaml` as the one maintained source after P149 and confines fallback/degradation logic to one module.

## Registry Content Contract

The table should use a single top-level array, preferably `routes`, where each row is one `skill + moment` decision. Repeating a skill across moments is allowed.

Required row fields:

- `skill`: canonical skill name to invoke or suggest.
- `signatures`: prompt regexes/phrases and/or event names.
- `moment`: one of `prompt-time`, `phase-close`, `milestone-close`, `weekly`, `on-demand`.
- `modes`: any of `manual`, `semi`, `auto`.
- `cooldown`: optional policy object.

Allowed optional fields:

- `aliases`: legacy names or operator-entered names covered by the row.
- `availability`: `canonical`, `alias`, `manual-only`, `external-if-installed`, or `omitted`.
- `gate_ref`: gate registry name when eligibility belongs to `gates.yaml`.
- `skip_reason`: fixed reason for omitted/unavailable legacy rows.
- `notes`: operator-facing explanation.

Do not copy `gates.yaml` predicates into this file. For MUDA and memory gates, encode only a gate reference such as `gate_ref: muda-audit` or `gate_ref: memory-curate`; the runtime helper consults existing gate/gate-adjacent mechanisms or records `skipped` with `gate_ref_not_triggered`.

## Inventory Decisions

Minimum table coverage must include these decisions:

- `sgsd-muda-audit`: prompt-time suggestion plus phase-close scheduled route; phase-close eligibility references `muda-audit` gate, no threshold duplication.
- `sgsd-token-audit`: prompt-time suggestion plus milestone-close route; milestone behavior remains owned by `sgsd-complete-milestone`.
- `sgsd-distill`: milestone-close route with once-per-milestone cooldown.
- `sgsd-sepl`: prompt-time/on-demand route for major proposals and architecture tradeoffs.
- `sgsd-overwatcher`: phase-close auto route with once-per-phase cooldown.
- `sgsd-readiness`: prompt-time/on-demand route and auto-mode readiness route reference.
- `sgsd-audit`: phase-close route and milestone-close route; milestone-close can remain blocking where existing audit policy says so.
- `sgsd-memory hygiene`: route as canonical `sgsd-memory-hygiene` or paired aliases `sgsd-recall` and `sgsd-curate`; use gate references for recall/curate discipline rather than copied predicates.
- `sgsd-vtp-advise`: prompt-time/on-demand route; graceful-fail behavior remains in the skill.
- `sgsd-health` and `gsd-health`: alias to `sgsd-readiness`; do not create a new health skill.
- `gsd-cleanup`: omit from auto scheduling; manual/on-demand suggestion only if a first-class command exists, otherwise `availability: omitted` with `skip_reason: legacy_unregistered`.
- `gsd-code-review`: prompt-time/on-demand route as `external-if-installed`; phase-close governance remains `sgsd-audit`.
- `gsd-code-review-fix`: prompt-time/on-demand only; never scheduled automatically because it mutates code.
- `gsd-verify-work`: alias to existing SGSD verification/ATC flow; prompt-time suggestion may preserve the legacy name.
- `gsd-secure-phase`: alias to existing security/edge-guard governance if registered; otherwise manual/on-demand omitted row with explicit skip reason.

## Serial Execution Prompts

### P149-T1

Implement only the registry table. Create `super-gsd/registry/skill-routing.yaml` with the required schema and inventory decisions above. Do not edit classifier or orchestrator code in this task. Verify with the frontmatter command and report row count plus inventory coverage.

### P149-T2

Implement only `super-gsd/scripts/lib/skill-routing-registry.cjs` and the malformed fixture. Reuse `js-yaml`. Export normalized loading, prompt adapter, scheduled-route query, compiled fallback, and CLI probes. Self-test must fail malformed YAML; runtime probe must fall back and log degradation.

### P149-T3

Wire P146 manual-session routing to the loader adapter. Remove normal runtime dependence on `session-governance-hooks.yaml`; keep that file only as deprecated compatibility metadata or pointer text if needed. Verify real prompts produce visible suggestions from `skill-routing.yaml`.

### P149-T4

Add the orchestrator scheduled consult API. The phase-close seam is after “Mark phase complete, advance to next phase” and before Step 6.7 milestone completion. For each applicable scheduled route, append a gate-evidence envelope row with `event=skill-routing`, `decision=fired|skipped`, and a concrete reason.

### P149-T5

Edit `super-gsd/skills/sgsd-orchestrate/SKILL.md` only. Replace routing prose cited by research with references to `skill-routing.yaml` and the orchestrator hook. Keep operator guidance, but make runtime routing a table/helper decision.

### P149-T6

Run AC-149 verification end to end. Prove: schema self-test passes real table and fails malformed fixture; manual prompt matching a neglected-skill signature yields visible suggestion; auto phase-close consult logs fired/skipped rows to `.planning/metrics/gate-evidence.jsonl`.

## Acceptance Mapping

AC-149a is covered by P149-T2 and P149-T6: schema check in self-test validates the real table and rejects malformed fixtures.

AC-149b is covered by P149-T3 and P149-T6: manual prompt probes for token audit, MUDA, VTP, code review, and verify-work return visible suggestions from the new table.

AC-149c is covered by P149-T4 and P149-T6: auto phase-close consults scheduled rows after phase completion and before Step 6.7, then logs fired/skipped evidence rows.

## Source Audit

| Source | Use |
|---|---|
| CONTEXT.md | Defines P149 goal, table shape, constraints, neglected inventory, malformed-table behavior, and AC scope. |
| RESEARCH.md | Supplies 24 cited findings, live-code seams, risks, recommended task shape, and known mismatch between P146 parser shape and P149 table shape. |
| VTP ide-ce7c-002 | Supports the design lineage: central process-input routing to the right GSD skill. |
| Design spec AC-149 | Acceptance criteria: schema self-test, manual visible suggestion, auto phase-close fired/skipped logging. |


## Reference SAC shape (from 148-01-PLAN-LOCKED.md)
      - "Requires `schema_version`, `tasks`, and `semantic_acceptance_criteria`."
      - "Each task must declare id, agent, model, files_touched, input_contract, output_contract, hypothesis, falsifier, and stop_rule."
  - source: "P147 locked plan"
    path: ".planning/milestones/v3.5/phases/147-commit-seam-gate/147-01-PLAN-LOCKED.md"
    status: success
    relevant_hits: 4
    citations:
      - "Use locked schema-v2 shape with rollback, allowed files, forbidden files, invariants, source audit, semantic ACs, acceptance commands, and serial task contracts."
      - "Carry forward contained writer destinations through `resolveContainedPath`."
--
semantic_acceptance_criteria:
  - id: "AC-148a"
    input: >
      A constructed temporary SGSD repo with `.planning/STATE.md` frontmatter `milestone: v3.5`, `current_phase: "148"`, a real phase directory,
      operator query file containing `How should fixture-meridian-721 become a runtime-governed planning route?`, healthy VTP route evidence with
      selected query `fixture-selected-query-meridian-721`, and a fake `codex` binary first on PATH returning a canned valid
      `triage-verdict-v1` verdict `{"path":"B","risk_flags":["fixture-risk-latency-721"],"missed_context":["fixture-doc-721-alpha"],"recommended_skills":["sgsd-roadmap-planner"]}`.
      Negative control uses the same repo and fake Codex but invokes the runtime with trigger source `execution`.
    expected_outcome: >
