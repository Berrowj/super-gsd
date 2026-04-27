---
title: Agent-Readable Roadmap — v1.6 → v2.1
created: 2026-04-26
controlling_principle: Autonomy continues; evidence tells the truth.
discuss_artifact: .planning/discussions/2026-04-26-mass-discuss.md
backlog: .planning/CRIT-BACKLOG.md
mission_packet: .planning/milestones/CLAUDE-AUTO-HANDOVER-FULL-ROADMAP.md
status: ready-for-execution
operator: jack.berrow
---

# Agent Roadmap — v1.6 → v2.1

This is the orchestrator's contract for the full-roadmap autopilot run.
Every phase's required dispatches, kill conditions, movement detectors, and
runnable acceptance commands are encoded inline. Locked discussion decisions
live in `.planning/discussions/2026-04-26-mass-discuss.md` — read it
verbatim before the first dispatch in each phase.

---

## Controlling Principle

> **Autonomy continues; evidence tells the truth.**

The orchestrator never halts on ATC CRIT, verifier FAIL, or edge-guard miss.
After the retry budget is exhausted, the issue lands in `CRIT-BACKLOG.md`,
the phase/milestone status is degraded honestly (`PASS-WITH-DEFERRED-N` or
`CANDIDATE-WITH-DEBT`), and execution moves on. Only the 5 hard-stop
conditions in the discuss artifact halt autonomy.

---

## Standard Phase Workflow

Every phase below uses this 10-step workflow unless the phase entry
explicitly calls out a deviation.

| Step | Dispatch / action | Output | Required? |
|------|-------------------|--------|-----------|
| 1 | `gsd-pattern-mapper` | `PATTERNS.md` (per phase) | code phases only |
| 2 | `gsd-phase-researcher` | `{NN}-RESEARCH.md` | yes |
| 3 | `gsd-discuss-phase --auto` (consumes DISCUSS.md) | `{NN}-CONTEXT.md` | yes |
| 4 | `gsd-planner` | `{NN}-{plan-id}-PLAN.md` (≥1 plan) | yes |
| 5 | `gsd-plan-checker` | goal-backward review report (inline) | yes |
| 6 | `gsd-executor` (per-task; per-dispatch ATC fires on code commits) | task commits + `commit-reviews.jsonl` | yes |
| 7 | `sgsd-muda-audit` (if trigger predicate met) | `{NN}-WASTE.md` | conditional |
| 8 | `gsd-verifier` | `{NN}-VERIFICATION.md` | yes |
| 9 | phase-level-ATC (codex + claude reviewers, dual-provider contract v1.5) | `{NN}-ATC-REVIEW.md` | yes |
| 10 | `sgsd-curate` | memory writes to `.planning/memory/**` | conditional |

**Per-dispatch ATC** (Step 6 sub-loop): when an executor commit changes code
files and classifier `atc_tier ∈ {full, gate}`, both Codex and Claude
reviewers review the diff. CRIT findings → 3 fix attempts → backlog
(per relaxed bar).

**Movement detector** (every phase): the orchestrator must produce ≥1 commit
between any two consecutive Step 6 dispatches. If 30 minutes elapse with no
commit AND no active sub-agent, halt with checkpoint (counts as a hard stop:
"runtime cannot continue").

**Status assignment at phase close**:
- `PASS` if zero rows in `CRIT-BACKLOG.md` tag this phase
- `PASS-WITH-DEFERRED-N` if N rows tagged this phase, none `kind=edge_guard_miss`
- `CANDIDATE-WITH-DEBT` if ≥1 row tagged this phase has `kind=edge_guard_miss`

**Standard acceptance** (runnable, every phase):
```bash
# 1. All required artifacts exist
test -f .planning/milestones/{ms}/phases/{NN-*}/{NN}-CONTEXT.md
test -f .planning/milestones/{ms}/phases/{NN-*}/{NN}-RESEARCH.md
test -f .planning/milestones/{ms}/phases/{NN-*}/{NN}-VERIFICATION.md
test -f .planning/milestones/{ms}/phases/{NN-*}/{NN}-ATC-REVIEW.md
ls .planning/milestones/{ms}/phases/{NN-*}/{NN}-*-PLAN.md | wc -l  # must be ≥1

# 2. Verification status acceptable (PASS, PASS-WITH-DEFERRED-N, or CANDIDATE-WITH-DEBT)
grep -E "^status: (PASS|PASS-WITH-DEFERRED-[0-9]+|CANDIDATE-WITH-DEBT)$" {NN}-VERIFICATION.md

# 3. Both reviewer reports present in ATC review
grep -q "claude-sonnet-reviewer" {NN}-ATC-REVIEW.md
grep -q "codex-cli-reviewer" {NN}-ATC-REVIEW.md

# 4. Audit log row written
node -e "
  const rows = require('fs').readFileSync('.planning/metrics/audit-log.jsonl','utf8')
    .split(/\\r?\\n/).filter(Boolean).map(JSON.parse);
  const hit = rows.some(r => String(r.phase) === '{NN}');
  process.exit(hit ? 0 : 1);
"

# 5. Status-consistency check (status string matches CRIT-BACKLOG content)
#    Required after every phase close + every milestone close.
node super-gsd/tools/status-consistency/check.cjs --phase {NN} --milestone {ms}
# Exit 0 = consistent. Exit 1 = inconsistent (status overstates clean ship).
# A failure here is a hard correctness violation: orchestrator MUST update
# the VERIFICATION.md status to match backlog reality before proceeding —
# this is the one place where "fix in-loop" remains unconditional, because
# lying status defeats the entire degraded-mode contract.
```

If any of (1)-(4) fails: the phase is not closeable — orchestrator either
re-dispatches the missing step or appends to `CRIT-BACKLOG.md` if all retries
are exhausted.

If (5) fails: the orchestrator MUST update the VERIFICATION.md status string
to match backlog reality and re-run the check. (5) is not subject to
3-then-defer; it's a status-evidence-consistency assertion. Fix is mechanical:
append the missing backlog row, OR change the status string to the correct
taxonomy member.

### Live-or-Local Acceptance Rule (Patch 4)

Any acceptance line marked **"Live: ..."** requires either:
- the live action (e.g., real Codex dispatch), OR
- a deterministic local-fallback that exercises the **production caller path**
  (the same code that orchestrator invokes), against a fixture, with provider
  responses faked at the I/O boundary only.

Mock predicates that bypass the production caller are forbidden (this was the
v2.0 Phase 53 failure mode — was Phase 46 prior to the 2026-04-27 renumber;
see Patch 1 below).

If the live action is unreachable (Codex auth missing, network down, MCP off):
the phase records this as a `provider_unavailable` reason on the route-decision
ledger row, runs the local fallback, and continues. Status downgrade applies
if the fallback cannot fully exercise the path; the row in CRIT-BACKLOG marks
the live verification as `kind: verifier_fail` with `summary: "live action
unreachable; fallback used"`.

---

## Hard Stops (the only halts)

1. Credentials / API tokens / passwords required
2. Destructive operation outside this repo
3. Privacy / security judgment required from operator
4. Filesystem / runtime cannot continue
5. Operator approval explicitly required (e.g., publishing a public source)

Anything else: backlog + degrade + continue.

---

# Milestones

## Milestone v1.6 — Cockpit 2.0 + Startup Verification

**Phases**: 26, 27, 28, 29, 30
**Audit warning**: cockpit scripts (`sgsd-mission-control.ps1`,
`sgsd-narrative.ps1`, `sgsd-codex-monitor.ps1`, `sgsd-boot.ps1`,
`sgsd-dashboard-host.ps1`) already exist. Mission Strip lib is the delta.
Boot stays as verification, not new build.
**Dependencies**: 26 → 27 → {28 ∥ 29} → 30
**Locked decisions**: 26.1–26.3, 27.1–27.2, 28.1–28.2, 29.1–29.2, 30.1
(see DISCUSS.md)

### Phase 26 — Operator Question Contract

**Goal**: Define the eight operator questions the cockpit must answer, with
closed status vocabulary, freshness boundaries (no gap), and repair-path
discipline (text + optional safe `repair_command`).
**Locked**: 26.1, 26.2, 26.3
**Inputs**: COCKPIT-2.0-SCOPE.md, VIO-ROADMAP-ENRICHMENT.md,
HANDBOOK-FUTURE-IMPLEMENTATION-AUDIT.md, current
sgsd-mission-control.ps1
**Deviations from standard**: docs-only phase — Step 1 (pattern-mapper) and
Step 7 (MUDA) skipped. Step 6 executor produces docs only (no code commits;
no per-dispatch ATC fires).
**Outputs expected**:
- 26-RESEARCH.md (operator questions ↔ existing pane mapping)
- 26-CONTEXT.md (consumes DISCUSS 26.1-26.3)
- 26-01-operator-question-contract-PLAN.md
- 26-VERIFICATION.md
- 26-ATC-REVIEW.md (phase-level — docs review)
**Acceptance** (in addition to standard):
- `26-CONTEXT.md` lists 8 questions, each with: source, freshness rule,
  empty-state string, repair_instruction (and optional repair_command if
  applicable + safety-checker output)
- Status vocabulary documented as 8 closed states with no `unavailable` /
  `stale` collapse

### Phase 27 — Data Source + Objective Tree Audit

**Goal**: Map each operator question to existing telemetry source. Confirm
"no new cockpit-state file" decision. Encode orchestrator-side `phase`
stamping requirement into PLAN (touched in Phase 28's executor or as a
dedicated mini-task).
**Locked**: 27.1, 27.2
**Inputs**: 26-CONTEXT.md, all `.planning/metrics/*` schemas,
`super-gsd/registry/handover-contract-v2.yaml`
**Deviations**: docs-mostly. Phase 28 will pick up the tiny code change
implied by 27.2 (orchestrator stamps `phase` into activity-log).
**Outputs expected**:
- 27-RESEARCH.md (data source matrix)
- 27-CONTEXT.md
- 27-01-cockpit-data-contract-PLAN.md (objective tree schema, derived;
  stable IDs for 8 node types)
- 27-VERIFICATION.md
- 27-ATC-REVIEW.md
**Acceptance**:
- Data-source matrix names a concrete existing log/file for every Q1–Q8
- No new state file proposed
- Objective tree schema documents IDs for milestone, phase, objective,
  agent, gate, artifact, blocker, codex_run

### Phase 28 — Mission Control 2.0 Layout

**Goal**: Land Mission Strip lib (`super-gsd/scripts/lib/sgsd-mission-strip.ps1`).
Wire into `sgsd-mission-control.ps1` (top, replaces 1-line header). Implement
27.2 phase stamping in orchestrator activity-logger hook.
**Locked**: 28.1, 28.2 + 27.2 implementation
**Inputs**: 26-CONTEXT.md, 27-CONTEXT.md, current sgsd-mission-control.ps1,
sgsd-activity-logger.js hook
**Deviations**: full standard workflow. Code phase. MUDA trigger likely fires
(diff_lines ≥ 100 + phase_type in {code}). Per-dispatch ATC fires.
**Outputs expected**:
- New: `super-gsd/scripts/lib/sgsd-mission-strip.ps1`
- Edit: `super-gsd/scripts/sgsd-mission-control.ps1` (~15 lines)
- Edit: `super-gsd/scripts/sgsd-activity-logger.js` or hook (phase stamping)
- 28-01-mission-control-layout-PLAN.md
- 28-WASTE.md
- 28-VERIFICATION.md
- 28-ATC-REVIEW.md (codex + claude both review the .ps1)
**Acceptance** (in addition to standard):
- `powershell.exe ... [PSParser]::Tokenize(... 'sgsd-mission-strip.ps1' ...)` returns 0 errors
- Smoke test: `Render-MissionStrip` outputs ≥6 lines with the locked vocabulary
- Live verification: run `sgsd-mission-control.ps1` for 10 seconds, confirm strip renders at top
- New activity-log row contains non-null `phase` field

### Phase 29 — Agent + Codex Visibility Lanes

**Goal**: Codex 1h freshness rule applied. Agents-used line populated from
activity-log Task dispatches grouped by current phase. Q5/Q6 lanes wired
into Mission Strip.
**Locked**: 29.1, 29.2
**Inputs**: 28-VERIFICATION.md, current sgsd-codex-status.ps1, codex-live.json fixture
**Deviations**: full standard workflow.
**Outputs expected**:
- Edit: `super-gsd/scripts/lib/sgsd-mission-strip.ps1` (+ codex stale rule, agents lane)
- 29-RESEARCH.md, 29-CONTEXT.md, 29-01-agent-codex-lanes-PLAN.md
- 29-WASTE.md (if predicate met)
- 29-VERIFICATION.md, 29-ATC-REVIEW.md
**Acceptance**:
- Codex pane demotes a stale `codex-live.json` (mtime > 1h) to `idle` regardless of file's `state` field
- Agents pane lists only agents whose latest dispatch target path resolves to current phase folder
- Status vocabulary maps Codex `running/timeout/idle` → cockpit `running/timed-out/idle` correctly

### Phase 30 — Startup Verification + Cockpit Acceptance

**Goal**: Run all 8 acceptance scenarios from COCKPIT-2.0-SCOPE; produce
fixture-based evidence for the 3 hard scenarios (codex-timeout, forced-restart,
codex-warned). Verify `sgsd-boot.ps1 -NoOpen` timing. Update README + startup
guide pointers.
**Locked**: 30.1
**Inputs**: 28-VERIFICATION.md, 29-VERIFICATION.md, COCKPIT-2.0-SCOPE.md (acceptance section)
**Deviations**: verification-heavy. Step 4 plan is the acceptance matrix
(8 rows × {scenario, evidence-mode (live | fixture), evidence-path}).
**Outputs expected**:
- 30-RESEARCH.md (boot script flag inventory)
- 30-CONTEXT.md, 30-01-startup-and-cockpit-acceptance-PLAN.md
- `super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md` (8 scenario results, evidence paths)
- README quick-start linkage to startup guide (additive only)
- 30-VERIFICATION.md, 30-ATC-REVIEW.md
**Acceptance**:
- All 8 scenarios produce evidence (live or fixture); none deferred
- `sgsd-boot.ps1 -NoOpen` wall-time captured (single measurement)
- README contains a working `sg` daily-command block linked to the startup guide

---

## Milestone v1.7 — Stable Command Contracts + Route Intelligence

**Phases**: 31, 32, 33, 34, 35
**Audit warning**: 4 contracts exist (`code-reviewer-v1`, `review-providers-v1`,
`handover-contract-v2`, `plan-schema-v2`). v1.7 adds a fifth at the
**command-output** level. Must not collide with the others.
**Dependencies**: 31 → {32, 33, 34} → 35
**Locked decisions**: 31=A, 32=A, 33=C (under 26.3 safety constraints), 34=C, 35=B

### Phase 31 — Canonical Command Envelope

**Goal**: JSON schema for command-output envelope. Registry of which commands
emit. Reconcile (not collide) with the 4 existing contracts.
**Locked**: 31=A
**Inputs**: 4 existing contract files; existing JSONL streams
**Outputs**:
- `super-gsd/templates/command-envelope-v1.json` (JSON Schema)
- `super-gsd/registry/command-envelope-v1.yaml` (registry of emitting commands)
- 31-RESEARCH.md (4-contract reconciliation matrix), 31-CONTEXT.md, 31-01-PLAN.md
- 31-VERIFICATION.md, 31-ATC-REVIEW.md
**Acceptance** (additional):
- JSON Schema validates with `node -e "require('./command-envelope-v1.json')"`
- Reconciliation matrix names which abstraction level each contract owns
- ≥3 existing JSONL streams documented as envelope-shape-compatible candidates

### Phase 32 — Route Decision Ledger

**Goal**: Append-only `.planning/metrics/route-decisions.jsonl`. Writer
module + 6 boundary types. **Wire into ≥1 real orchestrator boundary.**
Schema-without-consumer rule: this phase MUST land at least one production
caller, not just the lib.
**Locked**: 32=A (boundary-only)
**Inputs**: existing orchestrator SKILL.md, sgsd-orchestrate flow
**Outputs**:
- `super-gsd/scripts/lib/route-ledger.cjs` (writer + self-test)
- Edit `super-gsd/skills/sgsd-orchestrate/SKILL.md` to call
  `logRouteDecision()` at ≥1 boundary (recommend: `codex_route` decision in Step 6.b/9.5)
- 32-RESEARCH.md, 32-CONTEXT.md, 32-01-PLAN.md, 32-WASTE.md, 32-VERIFICATION.md, 32-ATC-REVIEW.md
**Acceptance**:
- `node super-gsd/scripts/lib/route-ledger.cjs --self-test` exits 0
- Live-or-local: dispatching one Codex review (or running the local-fallback test
  that calls `logRouteDecision()` via the same orchestrator path) produces a row
  in `route-decisions.jsonl` with `boundary=codex_route` and non-empty `reason_codes`.
  Provider-unavailable triggers fallback, status degrades, run continues.

### Phase 33 — Repair Instruction Contract

**Goal**: `repair_instruction:` (text) mandatory on all 13 gates;
`repair_command:` optional, allowed only under 26.3 safety constraints.
Build the schema-load checker that rejects offending commands.
**Locked**: 33=C (under 26.3)
**Inputs**: gates.yaml; 26.3 safety predicate list
**Outputs**:
- Edit `super-gsd/registry/gates.yaml` (+13 `repair_instruction:` lines; optional `repair_command:` per gate where safe-deterministic)
- New: `super-gsd/scripts/lib/repair-command-checker.cjs` (validates gates.yaml at load; rejects on disallowed predicates)
- 33-RESEARCH.md, 33-CONTEXT.md, 33-01-PLAN.md, 33-VERIFICATION.md, 33-ATC-REVIEW.md
**Acceptance**:
- `node super-gsd/scripts/lib/repair-command-checker.cjs --validate` returns 0 errors against current gates.yaml
- `grep -c "repair_instruction:" gates.yaml` ≥ 13 (all gates have text)
- Test fixture with `repair_command: "rm -rf /"` is rejected by the checker
- Test fixture with `repair_command: "node super-gsd/tools/system-map/generate.cjs"` is accepted

### Phase 34 — Canonical Review Ledger

**Goal**: Aggregator over per-phase `commit-reviews.jsonl` (closes v1.5
empty-baseline gap) + real-time writer for new reviews going forward.
**Wire writer into `codex-exec.sh` and Claude reviewer agent.**
**Locked**: 34=C (aggregator + writer)
**Inputs**: per-phase commit-reviews.jsonl files; codex-log.jsonl;
codex-exec.sh; sgsd-code-reviewer.md
**Outputs**:
- New: `super-gsd/tools/review-ledger/aggregate.cjs` (with --kill-check flag)
- New: `super-gsd/scripts/lib/review-ledger-writer.cjs` (real-time append)
- Edit: `super-gsd/scripts/codex-exec.sh` to call writer on every review completion
- Edit: `super-gsd/agents/sgsd-code-reviewer.md` to invoke writer
- `.planning/metrics/review-ledger.jsonl` (initial backfill)
- 34-RESEARCH.md, 34-CONTEXT.md, 34-01-PLAN.md, 34-VERIFICATION.md, 34-ATC-REVIEW.md
**Acceptance**:
- `node aggregate.cjs` produces ≥1 row from existing v1.2/v1.4/v1.5 commit-reviews.jsonl
- `node aggregate.cjs --kill-check` returns `baseline_ok` (exit 0)
- Live-or-local: dispatching a Codex review (or running the local-fallback that
  invokes `review-ledger-writer.cjs` via the same code path codex-exec.sh uses
  on completion) appends a row to `review-ledger.jsonl` via the writer (not
  just the aggregator backfill). Provider-unavailable → fallback → continue.

### Phase 35 — Generated System Map

**Goal**: Deterministic catalog generator (registries + frontmatter).
Snapshot diff confirms determinism.
**Locked**: 35=B
**Inputs**: agents.yaml, gates.yaml, review-providers.yaml, board-members.yaml,
skills/*/SKILL.md, scripts/* headers
**Outputs**:
- New: `super-gsd/tools/system-map/generate.cjs`
- New: `super-gsd/docs/SYSTEM-MAP.json`, `super-gsd/docs/SYSTEM-MAP.md`
- 35-RESEARCH.md, 35-CONTEXT.md, 35-01-PLAN.md, 35-VERIFICATION.md, 35-ATC-REVIEW.md
**Acceptance**:
- Two consecutive runs produce byte-identical output (modulo `generated_at` field)
- Catalog includes ≥4 sections: agents, gates, providers, skills

---

## Milestone v1.8 — Gate Fitness + MUDA Pruning

**Phases**: 36, 37, 38, 39, 40
**Audit warning**: MUDA already has probes, logs, retirement signal.
v1.8 adds value metrics + keep/kill table on top. **Do NOT rebuild MUDA.**
**Dependencies**: 36 → {37 ∥ 38 ∥ 39} → 40
**Locked decisions**: 36=B, 37=A, 38=C (full discussion), 39=B, 40=B

### Phase 36 — Gate Value Telemetry

**Goal**: `gate-value-log.jsonl` writer + summarizer. **Wire into orchestrator
gate-fire points (≥1 production caller).**
**Locked**: 36=B (outcome + retroactive fields, no cost)
**Outputs**:
- New: `super-gsd/scripts/lib/gate-value-log.cjs`
- Edit: orchestrator SKILL.md to call `logGateValue()` on phase-level-ATC + per-dispatch-ATC fires
- 36-* artifacts
**Acceptance**:
- Live-or-local: phase-level-ATC fire (or local-fallback invoking
  `gate-value-log.cjs` via the same code path the gate-fire decision uses)
  appends row with `outcome ∈ {pass,warn,block,skip}`. Provider-unavailable
  → fallback → continue.
- `--summary` aggregates by gate

### Phase 37 — MUDA Deletion Candidates

**Goal**: WASTE.md template extension with deletion-candidate section.
3 heuristics (low_value, recurring, skip_drift) feed it.
**Locked**: 37=A
**Outputs**:
- New: `super-gsd/scripts/lib/muda-deletion-candidates.cjs`
- Edit: `super-gsd/scripts/sgsd-muda-audit.sh` (or add post-hook) to invoke after WASTE.md write
- 37-* artifacts
**Acceptance**:
- Running on current repo state produces a "## Deletion Candidates" section in the next WASTE.md
- Each candidate row has `kind`, target, evidence, risk, rollback fields

### Phase 38 — Risk-Tiered Gate Sampling

**Goal**: Gate × work intersection. 3 work-risk tiers. Classifier with 4
primary + 1 secondary inputs. Force/skip overrides require reason.
**Locked**: 38.1–38.5
**Inputs**: gates.yaml, sgsd-classifier.md, gate-value-log.jsonl (for fitness history)
**Outputs**:
- Edit: `gates.yaml` (+ `gate_sampling_tier:` per row)
- Edit: `sgsd-classifier.md` to compute work_risk + emit it in classifier output
- Edit: `sgsd-orchestrate/SKILL.md` to apply intersection matrix at gate-fire decision
- New: `super-gsd/scripts/lib/sampling-decider.cjs` (matrix logic + reason logger)
- 38-* artifacts
**Acceptance**:
- `gates.yaml` has `gate_sampling_tier:` on all 13 gates
- `--force-gates X --override-reason "..."` logged to route-decisions.jsonl with `boundary=gate_override`
- `--force-gates X` without `--override-reason` returns exit 1 with error message
- Classifier output includes `work_risk: low|medium|high` field

### Phase 39 — Gate Keep/Kill Review

**Goal**: Mechanical rubric script reading review-ledger + gate-value-log +
edge-guard-log. Manual override at milestone close.
**Locked**: 39=B
**Outputs**:
- New: `super-gsd/tools/gate-keep-kill/rubric.cjs`
- Edit: `sgsd-complete-milestone/SKILL.md` to invoke at milestone close (consume + present output)
- 39-* artifacts
**Acceptance**:
- Running rubric produces table with all 13 gates classified `keep | kill | defer`
- Defer-on-empty (gate-value-log empty) is explicit, not "kill by default"

### Phase 40 — Phase Folder Perfection Contract

**Goal**: Auditor walks all phase folders. Required + recommended file
checks. Soft-warn (not block).
**Locked**: 40=B
**Outputs**:
- New: `super-gsd/tools/phase-folder-audit/audit.cjs`
- Edit: `sgsd-complete-milestone/SKILL.md` to invoke + report at close
- 40-* artifacts
**Acceptance**:
- Auditor categorizes each phase folder as compliant / partial / non-compliant
- Output includes per-phase missing-file list
- Does not modify any phase folder

---

## Milestone v1.9 — SGSD-Research (Context Compression, Token Governance, And Research Routing)

**Phases**: 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52
**Audit warning**: existing VTP integration must be preserved (Phase 48
selective bridge gates calls; does NOT rewrite vtp-enrichment-gate.cjs).
**Source analyses**:
- `.planning/analyses/2026-04-27-agent-context-bloat-audit.md`
- `.planning/analyses/2026-04-27-agent-context-bloat-vtp-crosscheck.md`
**Supersedes**: prior v1.9 (Knowledge + Memory Governance) — archived at
`.planning/archive/superseded/v1.9-knowledge-memory-governance/` for
mining; absorbed via capsules (43), legal registry (44), context packets
(45), selective VTP routing (48), memory governance lifecycle (49).
**Dependencies**: see `.planning/milestones/v1.9/REQUIREMENTS.md`
"Dependencies" block — 9-edge graph rooted at 41 with 51 (benchmark) and
52 (Redis adapter) as the two terminal nodes.
**Locked decisions**: see milestone-local lock notes; no interactive
discuss-phase required (all 12 phases auto-defaulted at slotting).

### Phase 41 — Baseline Token Attribution

**Goal**: Establish a truthful token-spend baseline.
`agent-token-spend.jsonl` schema + bloat report identifying top
researcher/planner/executor/verifier consumers by role, phase, provider,
model, cache-read ratio, and useful findings.
**Inputs**: SGSD metrics streams, current session logs, audit findings
**Outputs**:
- New: `.planning/metrics/agent-token-spend.jsonl`
- New: `super-gsd/tools/token-attribution/report.cjs`
- New: `.planning/milestones/v1.9/baseline-token-spend.md`
- 41-* artifacts
**Acceptance**: see `.planning/milestones/v1.9/REQUIREMENTS.md` BASELINE
lane (BASE-01..04).

### Phase 42 — Token Budget Admission

**Goal**: Stop token bloat from being invisible. Per-role budgets +
cache-read-ratio flag + phase/milestone close integration as
warning/degrade gate (not autonomy stop).
**Outputs**:
- New: `super-gsd/tools/token-waste/check.cjs`
- 42-* artifacts
**Acceptance**: see REQUIREMENTS.md BUDGET lane (BUDGET-01..05).

### Phase 43 — Phase Capsule Contract

**Goal**: `PHASE-CAPSULE.json` schema + write tool + phase-close wire-in
+ backfill capsules for v1.6-v1.8. Capsules carry source files, commits,
hashes, status, evidence, debt, downstream contract, critical bypass.
**Outputs**:
- New: `super-gsd/tools/phase-capsule/write.cjs` + schema
- 43-* artifacts (incl. backfilled capsules under
  `.planning/milestones/v1.{6,7,8}/phases/*/PHASE-CAPSULE.json`)
**Acceptance**: see REQUIREMENTS.md CAPSULE lane (CAP-01..05).

### Phase 44 — Legal Context Registry

**Goal**: `legal-keys.json` registry rejecting invented references
(milestone IDs, phase IDs, gate IDs, agent IDs, artifact IDs, providers,
status vocab). Validator wired into packet builder + status-consistency.
**Outputs**:
- New: `super-gsd/tools/context-registry/{build,check}.cjs`
- New: `super-gsd/tools/context-registry/legal-keys.json`
- 44-* artifacts
**Acceptance**: see REQUIREMENTS.md REGISTRY lane (REG-01..05).

### Phase 45 — Context Packet Builder

**Goal**: Replace raw inherited context with role-specific packets
(researcher/planner/executor/verifier/reviewer/cockpit modes). Pulls
from capsules + registry + active debt + evidence + critical bypass
records before raw files. Per-role token budget enforcement.
**Outputs**:
- New: `super-gsd/tools/context-packet/build.cjs`
- New: `.planning/metrics/context-complaints.jsonl`
- 45-* artifacts
**Acceptance**: see REQUIREMENTS.md PACKET lane (PACKET-01..06).

### Phase 46 — SQLite Context Index

**Goal**: Rebuildable SQLite FTS projection over capsules, decisions,
gate definitions, file summaries. SQLite as projection ONLY; canonical
data stays in `.planning` and git.
**Outputs**:
- New: `super-gsd/tools/context-cache/{rebuild,query}.cjs`
- 46-* artifacts
**Acceptance**: see REQUIREMENTS.md INDEX lane (INDEX-01..05).

### Phase 47 — Dispatch Routing Substitution

**Goal**: Provider substitution policy routing deterministic
extraction to local scripts; bounded review to Codex; synthesis to
Claude; uncertainty to VTP. Substitution decisions logged to
route-decisions.jsonl with reason + token expectation + fallback.
**Outputs**:
- Edit: orchestrator routing logic (Phase 32 route-ledger boundary
  extension)
- 47-* artifacts
**Acceptance**: see REQUIREMENTS.md ROUTING lane (ROUTE-01..05).

### Phase 48 — Selective VTP Bridge

**Goal**: Route-gated VTP only for research-paper / book / prior-project /
architecture-challenge query types. MCP failures captured separately
from research conclusions. Source-backed evidence packets.
**Outputs**:
- New: selective VTP route classifier + evidence packet writer
- 48-* artifacts
**Acceptance**: see REQUIREMENTS.md VTP lane (VTPR-01..05).

### Phase 49 — Memory Governance Lifecycle

**Goal**: Context complaint log + memory write admission + lifecycle
fields (confidence, last_validated, supersedes, superseded_by,
allowed_consumers, clearance_requires, deprecation_reason) +
promotion/demotion/revocation rules.
**Outputs**:
- Edit: `sgsd-curate.sh` admission checks
- New: `.planning/metrics/context-complaints.jsonl` (paired with Phase 45)
- 49-* artifacts
**Acceptance**: see REQUIREMENTS.md GOVERNANCE lane (GOV-01..05).

### Phase 50 — Cockpit Research Dashboard

**Goal**: Cockpit projection redesign around current milestone, current
phase, active agents, agent token spend, context source mix, evidence,
blockers. Remove duplicated NOW/Codex content from wrong panes.
**Outputs**:
- Edit: cockpit projection (sgsd-mission-control + Mission Strip)
- 50-* artifacts
**Acceptance**: see REQUIREMENTS.md COCKPIT lane (COCKPIT-01..05).

### Phase 51 — Context Stress Benchmark

**Goal**: Blind scenario suite + before/after token comparison + failure
injection (missing capsule, stale registry, invalid phase ID, deleted
SQLite DB, Redis flush, VTP unavailable, Codex unavailable, critical
bypass). **Acceptance bar: ≥50% researcher token reduction with zero
required evidence loss.**
**Outputs**:
- New: `super-gsd/tools/context-bench/` harness + scenarios
- 51-* artifacts
**Acceptance**: see REQUIREMENTS.md BENCHMARK lane (BENCH-01..05).

### Phase 52 — Redis Live Cache Adapter

**Goal**: Optional disposable Redis projection for live cockpit state /
hot packets / provider canary cache. **Redis is NEVER canonical.**
FLUSHDB safety test; degraded-mode runs with SQLite/local files only.
**Outputs**:
- New: `super-gsd/tools/context-cache/redis-adapter.cjs` (optional)
- 52-* artifacts
**Acceptance**: see REQUIREMENTS.md REDIS lane (REDIS-01..05).

---

## Milestone v2.0 — SpaceX-Style Failure Injection

**Phases**: 53, 54, 55, 56, 57
**Renumbered 2026-04-27**: was 46-50; shifted +7 by SGSD-Research promotion to v1.9.
**Audit warning**: harness pieces exist. **Compose** existing tools; do not
duplicate. Mock-predicate scenarios are forbidden — every scenario MUST
invoke a real tool against a deliberately-broken fixture.
**Dependencies**: 53 → {54 ∥ 55 ∥ 56} → 57
**Locked decisions**: 53=C (was 46=C), 54=C (was 47=C), 55=B (was 48=B), 56=B (was 49=B), 57=B (was 50=B)

### Phase 53 — Gate Failure-Injection Harness

**Goal**: 10 scenarios. Each invokes a real SGSD tool against a fixture in
a temp/container directory. No mock predicates.
**Locked**: 53=C (real tool + container isolation)
**Outputs**:
- New: `super-gsd/tools/failure-injection/harness.cjs`
- New: `super-gsd/tools/failure-injection/fixtures/` (10 fixture dirs)
- 53-* artifacts
**Acceptance** (Patch 1 — strict, no ">=9/10" weasel-room):
- Each scenario actually executes the tool it targets (mock predicates forbidden;
  verify by adding logging that records the tool invocation in
  `.planning/metrics/failure-injection-log.jsonl` per run)
- Fixtures live in `super-gsd/tools/failure-injection/fixtures/{scenario-id}/`
- Scenarios run in temp dirs (isolated from live `.planning/`)
- **Harness must run all 10 scenarios. 10/10 required for `PASS`.**
- **9/10 or lower may continue auto mode only as `PASS-WITH-DEFERRED-N`** (each
  failed scenario logged to `CRIT-BACKLOG.md` with `kind=verifier_fail`,
  `summary` quoting the scenario id and observed-vs-expected).
- **A failed scenario whose root cause is structural (a real-tool fixture that
  exposes a missing emit) is logged as `kind=edge_guard_miss` instead, which
  forces `CANDIDATE-WITH-DEBT` per the edge-guard rule.**
- **v2.0 cannot be `SHIPPED` clean unless the harness is 10/10.** Milestone
  close runs the harness as a precondition; anything less than 10/10 forces
  `SHIPPED-WITH-DEBT-N` or `CANDIDATE`.
- `release-readiness/score.cjs` reads the harness's last-run JSONL output
  deterministically; the `scenarios` bucket is `pass / total * 15` rounded.

### Phase 54 — Restart + Handoff Chaos Tests

**Goal**: Mid-phase kill simulation at 5 named points + manifest-shape tests
on ORCHESTRATOR-CHECKPOINT.md.
**Locked**: 54=C (both)
**Outputs**:
- New: `super-gsd/tools/chaos-restart/` (kill-points + manifest validators)
- 54-* artifacts
**Acceptance**:
- Kill at each of 5 points (mid-research / mid-plan / mid-execute / mid-verify / mid-close), then resume from checkpoint, asserts the phase reaches close
- Manifest validator rejects checkpoint with missing required field (e.g. `next_action`)

### Phase 55 — Provider Backpressure + Timeout Circuits

**Goal**: Existing timeout-tier hardening + circuit breaker (N consecutive
provider failures → switch provider for milestone).
**Locked**: 55=B
**Outputs**:
- Edit: `super-gsd/scripts/codex-exec.sh` (or wrapper) for circuit breaker logic
- New: `super-gsd/scripts/lib/provider-circuit.cjs`
- 55-* artifacts
**Acceptance**:
- Test fixture: 3 consecutive Codex failures auto-switch to Claude reviewer for milestone
- Circuit state persisted in `.planning/metrics/provider-circuit.json` with reset rule

### Phase 56 — Scenario-Based Acceptance Suite

**Goal**: 6 happy + 4 adversarial scenarios.
**Locked**: 56=B
**Outputs**:
- New: `super-gsd/tools/scenario-suite/` with 10 scenario specs
- Each scenario has fixture + expected outcomes
- 56-* artifacts
**Acceptance**:
- 10 scenarios runnable; each produces evidence file + asserted gate outcome
- 4 adversarial: poisoned PLAN.md, race-condition writes, malformed checkpoint, mid-write SIGKILL

### Phase 57 — Release Readiness Score (gating)

**Goal**: 8-bucket score (0-100). **Gates milestone close**: cannot
`SHIPPED` until ≥70 AND zero `edge_guard_miss` rows in CRIT-BACKLOG.md.
**Locked**: 57=B
**Outputs**:
- New: `super-gsd/tools/release-readiness/score.cjs`
- Edit: `sgsd-complete-milestone/SKILL.md` to invoke at close + enforce gate
- 57-* artifacts
**Acceptance**:
- Score < 70 returns exit 1; milestone close refuses `SHIPPED` (writes `CANDIDATE` or `SHIPPED-WITH-DEBT-N`)
- Edge_guard_miss row in CRIT-BACKLOG.md → score returns RED regardless of bucket totals (hard precondition)

---

## Milestone v2.1 — Distribution + New-User Onboarding

**Phases**: 58, 59, 60, 61, 62
**Renumbered 2026-04-27**: was 51-55; shifted +7 by SGSD-Research promotion to v1.9.
**Audit warning**: harden existing installer + setup; do NOT create a second
startup system.
**Dependencies**: 58 → 59 → 60 → 61 → 62
**Locked decisions**: 58=B (was 51=B), 59=C (was 52=C), 60=B (was 53=B), 61=C (was 54=C), 62=A (was 55=A)

### Phase 58 — Installer Portability Audit (with clean-room test)

**Goal**: Read-only probes + clean-room install test (fresh dir, captures
every step that requires manual intervention).
**Locked**: 58=B
**Outputs**:
- New: `super-gsd/tools/installer-audit/audit.cjs`
- New: `super-gsd/tools/installer-audit/clean-room.sh` (creates tmp dir, runs install, captures friction)
- 58-* artifacts
**Acceptance**:
- Audit reports ≥9 dependency probes
- Clean-room test runs end-to-end on a temp dir; captures every prompt / manual step
- Output `INSTALLER-AUDIT.md` includes both probe results and clean-room friction log

### Phase 59 — New Project Wizard (extending sgsd-configure)

**Goal**: sgsd-configure handles knowledge/memory; new wizard handles
project-level (cockpit panes, default boot mode). Must not replace either.
**Locked**: 59=C
**Outputs**:
- Edit: `super-gsd/scripts/sgsd-configure.ps1` (add reference to project wizard)
- New: `super-gsd/scripts/sgsd-new-project-wizard.cjs` (project-level only)
- 59-* artifacts
**Acceptance**:
- Wizard non-destructively writes config (deep-merge, doesn't clobber existing keys)
- Re-running on same project produces same config (idempotent)

### Phase 60 — Example Project + Demo

**Goal**: Scaffolded `examples/hello-world/` runnable directory + walkthrough doc.
**Locked**: 60=B
**Outputs**:
- New: `examples/hello-world/PROJECT.md`, `ROADMAP.md`, `.planning/STATE.md` skeleton
- New: `super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md`
- 60-* artifacts
**Acceptance**:
- Demo runs `node super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults` from `examples/hello-world` and produces working config
- Walkthrough doc tested end-to-end (every command in the doc succeeds)

### Phase 61 — Public Docs Refresh

**Goal**: README quick-start + VTP-optional callouts + "What This Repo Is For"
preamble distinguishing operator-build (this repo) vs end-user-install.
**Locked**: 61=C
**Outputs**:
- Edit: `README.md` (preamble + VTP-optional everywhere + linked startup guide)
- 61-* artifacts
**Acceptance**:
- `grep -i "vtp" README.md` shows zero "required" or "must" — only "optional"
- Quick-start `sg` command block tested live
- Preamble paragraph distinguishes the two audiences explicitly

### Phase 62 — Migration + Upgrade Safety

**Goal**: Drift checker (8 probes) reports v1.5→v2.1 markers without
modifying files.
**Locked**: 62=A
**Outputs**:
- New: `super-gsd/tools/upgrade-drift/check.cjs`
- New: `super-gsd/docs/UPGRADE-DRIFT.md`
- 62-* artifacts
**Acceptance**:
- Probe count ≥ 8
- Read-only (no file modifications confirmed by checking git status before/after run)
- Includes migration-notes section enumerating v1.5→v2.1 deltas

---

# End-of-Run Acceptance

The orchestrator marks the full-roadmap autopilot run "complete" when:

1. All 30 phases reach close with status ∈ {`PASS`, `PASS-WITH-DEFERRED-N`, `CANDIDATE-WITH-DEBT`}
2. Every milestone status ∈ {`SHIPPED`, `SHIPPED-WITH-DEBT-N`, `CANDIDATE`}
3. `release-readiness/score.cjs` runs with current state and returns its honest score (RED is acceptable as the run-end score; that's evidence)
4. `CRIT-BACKLOG.md` has been written + referenced in every applicable phase/milestone status
5. `STATE.md` reflects: each milestone status, each phase status, total backlog count, and `roadmap_run.completed: 2026-04-26` (or actual date)
6. `ROADMAP.md` reflects each milestone's final status

The run is **never** marked `SHIPPED` if any milestone is `CANDIDATE`.
The run is **never** marked clean-success if `CRIT-BACKLOG.md` has any rows.

This document is consumed by every phase. The orchestrator reads:
1. This file (`ROADMAP-AGENT.md`) at session start
2. The locked DISCUSS file before each phase's Step 3 dispatch
3. STATE.md frontmatter to find the active phase
4. CRIT-BACKLOG.md to surface known debt at every milestone close

When in doubt: **Autonomy continues; evidence tells the truth.**
