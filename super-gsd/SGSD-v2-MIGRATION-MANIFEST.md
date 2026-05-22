---
type: migration-manifest
version: SGSD-v2
created: 2026-04-21
status: draft — awaiting brief deliberation on 2026-04-21-orchestrator-contract.md
companion_brief: .planning/briefs/2026-04-21-orchestrator-contract.md
research_corpus:
  papers: 9
  principles_cited: 56+
  paper_slugs:
    - autogenesis-self-evolving-agent-protocol (AGP)
    - automated-stateful-specialization-for-adaptive-agent-systems (ASS)
    - skill-rag-failure-state-aware-retrieval-augmentation-via-hidden-state-probing-an (SKR)
    - metis-mentoring-engine-for-thoughtful-inquiry-solutions (MET)
    - why-llms-arent-scientists-yet-lessons-from-four-autonomous-research-attempts (LLMS)
    - 2601.10402v5-ml-master-2-hcc (HCC)
    - the-sequential-edge-inverse-entropy-voting-beats-parallel-self-consistency-at-ma (SEV)
    - think-just-enough-sequence-level-entropy-as-a-confidence-signal-for-llm-reasonin (TJE)
    - iso-bench-can-coding-agents-optimize-real-world-inference-workloads (ISO)
dlb_refs:
  - DLB-01-memory-topology
  - DLB-02-muda-learning-loop
  - DLB-03-intent-continuity
  - DLB-04-self-evolving-substrate
  - DLB-05-vtp-audit-sharpening
  - DLB-06-central-distribution
  - DELIBERATION-FLOOR
---

# SGSD v2 Migration Manifest

## 0. Why This Document Exists

The deliberation brief at `.planning/briefs/2026-04-21-orchestrator-contract.md` contains the *decisions* to be made (Q1–Q7). This manifest is the *implementation spec* — the concrete per-agent, per-skill, per-registry work that follows from those decisions, captured so nothing falls through the cracks.

The brief is the board's input. This manifest is the builder's checklist.

Scope is every SGSD surface: orchestrator skill, deliberate skill, board members, sub-agents, hooks, dashboards, statusline, registries, handover contracts. Every one of the 35+ agents gets a documentation and runtime upgrade grounded in the 9-paper research corpus.

---

## 1. Naming Migration — gsd-* → sgsd-*

### 1.0 The Rename Rule (operator directive 2026-04-21)

**The `sgsd-` prefix signals active upgrade, not mere affiliation.** It may be applied ONLY when:

1. The agent has been actively enriched with v2 handover contract + dedicated expertise file + research-paper principle citations, OR
2. The agent is genuinely new (created from scratch, e.g. the 8 `sgsd-exec-*` specialists).

No blanket rename. `gsd-*` agents stay `gsd-*` until their upgrade lands — the rename is part of the upgrade commit, not a precursor to it. GSD-1 agents that SGSD never upgrades stay `gsd-*` indefinitely; they're still dispatchable, just not SGSD-v2 contract compliant.

See memory file `feedback_sgsd_rename_rule.md` for full rationale.

### 1.1 Aspirational rename table (target state, NOT Phase B mass rename)

The table below represents the *eventual* state after each agent is upgraded in Phase G. It is NOT a Phase B checklist. Each entry's rename lands inside its own Phase G upgrade commit, bundled with v2 contract + expertise file creation.

Current state: the orchestrator skill is named `sgsd-orchestrate` but it delegates to `gsd-executor`, `gsd-planner`, `gsd-verifier`, etc. — plain-GSD-1 agents inherited when super-gsd was forked. Only a handful of SGSD-specific agents exist: `sgsd-classifier`, `sgsd-context-selector`, and the board members (`sgsd-board-*`, `sgsd-ceo`).

| Current name | New name | Notes |
|---|---|---|
| `gsd-executor` | `sgsd-executor` | Kept as the generic fallback executor |
| `gsd-planner` | `sgsd-planner` | |
| `gsd-plan-checker` | `sgsd-plan-checker` | |
| `gsd-verifier` | `sgsd-verifier` | Gets R-Q6d adversarial sampling option |
| `gsd-phase-researcher` | `sgsd-phase-researcher` | |
| `gsd-code-reviewer` | `sgsd-code-reviewer` | |
| `gsd-code-fixer` | `sgsd-code-fixer` | |
| `gsd-debugger` | `sgsd-debugger` | |
| `gsd-debug-session-manager` | `sgsd-debug-session-manager` | |
| `gsd-codebase-mapper` | `sgsd-codebase-mapper` | |
| `gsd-ai-researcher` | `sgsd-ai-researcher` | |
| `gsd-domain-researcher` | `sgsd-domain-researcher` | |
| `gsd-advisor-researcher` | `sgsd-advisor-researcher` | |
| `gsd-project-researcher` | `sgsd-project-researcher` | |
| `gsd-research-synthesizer` | `sgsd-research-synthesizer` | |
| `gsd-assumptions-analyzer` | `sgsd-assumptions-analyzer` | |
| `gsd-pattern-mapper` | `sgsd-pattern-mapper` | |
| `gsd-intel-updater` | `sgsd-intel-updater` | |
| `gsd-integration-checker` | `sgsd-integration-checker` | |
| `gsd-nyquist-auditor` | `sgsd-nyquist-auditor` | |
| `gsd-doc-verifier` | `sgsd-doc-verifier` | |
| `gsd-doc-writer` | `sgsd-doc-writer` | |
| `gsd-eval-auditor` | `sgsd-eval-auditor` | |
| `gsd-eval-planner` | `sgsd-eval-planner` | |
| `gsd-framework-selector` | `sgsd-framework-selector` | |
| `gsd-roadmapper` | `sgsd-roadmapper` | |
| `gsd-security-auditor` | `sgsd-security-auditor` | |
| `gsd-ui-auditor` | `sgsd-ui-auditor` | |
| `gsd-ui-checker` | `sgsd-ui-checker` | |
| `gsd-ui-researcher` | `sgsd-ui-researcher` | |
| `gsd-user-profiler` | `sgsd-user-profiler` | |

### 1.2 New specialized executors (replaces all-flavors-in-one `gsd-executor`)

Per R-Q8 from the brief — orange agent tag should signal work type at a glance.

| New agent | Picks when | Seeded expertise |
|---|---|---|
| `sgsd-exec-backend` | `.py`/`.go`/`.ts` routes/models/services | API contract + ORM + error-surface hygiene |
| `sgsd-exec-ui` | `.tsx`/`.vue`/`.svelte`/`.css` | Component purity + a11y + design-system adherence |
| `sgsd-exec-test` | `*_test.*`/`*.spec.*` (primary artifact) | AAA pattern + coverage boundaries + fixture isolation |
| `sgsd-exec-refactor` | zero-behavior-change edits | ΔComplexity ≤ 0 + surgical-constraint + invariant preservation |
| `sgsd-exec-fix` | bug fixes, reproduce-first | Failing-test-first + minimal-diff + regression guard |
| `sgsd-exec-config` | CI/Docker/env/infra | Idempotence + revert-safety + staged rollout |
| `sgsd-exec-docs` | `.md` only | Concision + verify-against-code + cross-link discipline |
| `sgsd-exec-integration` | wiring pre-built parts | Contract-matching + boundary tests + error propagation |

`sgsd-executor` remains as the fallback when no heuristic matches (or when the plan explicitly specifies the generic executor).

### 1.3 Board taxonomy cleanup

Current names have accidental double-prefix (`sgsd-sgsd-board-*`, `ssgsd-ceo`). Normalize to single-prefix:

| Current | New |
|---|---|
| `sgsd-sgsd-board-architect` | `sgsd-board-architect` |
| `sgsd-sgsd-board-pragmatist` | `sgsd-board-pragmatist` |
| `sgsd-sgsd-board-contrarian` | `sgsd-board-contrarian` |
| `sgsd-sgsd-board-moonshot` | `sgsd-board-moonshot` |
| `ssgsd-ceo` | `sgsd-ceo` |
| `ssgsd-classifier` | `sgsd-classifier` |
| `ssgsd-context-selector` | `sgsd-context-selector` |

---

## 2. Agent Inventory by Category

Categories group agents by workflow stage. Each category has shared expertise patterns and a standard handover contract. Research-principle mapping is at the category level; each agent within a category inherits + extends.

### 2.1 Category A — Orchestration (drives the loop)

**Agents:** `sgsd-orchestrate` (skill), `sgsd-classifier`, `sgsd-context-selector`

**Research principles applied:**
- **HCC-P-01** (L1/L2/L3 memory tiers) — orchestrator operates across implicit tiers; make explicit in decisions.yaml
- **HCC-P-02** (lifecycle-event-governed transitions) — checkpoint triggers move from context metrics to explicit lifecycle/runtime events (`user stop`, `hard blocker`, `runtime cannot continue`)
- **HCC-P-05** (decouple model selection by task tier, amortize infrequent) — Opus-CEO fires once per decision, Sonnet per dispatch, Haiku per classification
- **HCC-P-08** (shape context-growth curve) — dashboards plot growth, not snapshots
- **HCC-P-10** (prompts as contracts) — sub-agent dispatch prompts become versioned resources
- **TJE-P-01** (entropy-based early stopping on reasoning models) — R-Q6a entropy-gated classifier skip
- **SEV-P-01** (sequential beats parallel at matched compute) — R-Q6b dispatch-mode detection
- **LLMS-P-03** (systems declare success before verifying) — R-Q4 edge-guard; R-Q6d verifier sampling
- **LLMS-P-05** (implementation drift under execution pressure) — R-Q4 edge-guard on Step transitions
- **LLMS-P-07** (map workflows to explicit handoffs) — decisions.yaml emits/expects contract
- **AGP-P-01** (decouple evolution mechanism from targets) — sgsd-sepl as evolution engine for orchestrator resources

### 2.2 Category B — Planning (produces PLAN.md, RESEARCH.md, CONTEXT.md)

**Agents:** `sgsd-planner`, `sgsd-plan-checker`, `sgsd-phase-researcher`, `sgsd-pattern-mapper`, `sgsd-assumptions-analyzer`, `sgsd-ai-researcher`, `sgsd-domain-researcher`, `sgsd-advisor-researcher`, `sgsd-project-researcher`, `sgsd-research-synthesizer`

**Research principles applied:**
- **MET-P-01** (route guidance by workflow stage) — different planners for different stages (research → spec → plan → check)
- **MET-P-04** (collect intake context before prescribing) — `sgsd-assumptions-analyzer` already fits this; strengthen
- **MET-P-08** (falsifiable experiment cards) — every PLAN.md task gets `hypothesis`, `falsifier`, `stop_rule` fields (R-Q3)
- **MET-P-11** (rubric scoring) — `sgsd-plan-checker` scores plans against a multidimensional rubric
- **HCC-P-04** (explicit dead-end labelling) — plans capture `known_deadends:` (R-Q3)
- **HCC-P-10** (prompts as contracts) — planner output is structured, not prose
- **AGP-P-02** (first-class versioned resources) — plans carry `schema_version` (R-Q3)
- **ASS-P-01** (discover specializations before cultivating) — researcher agents produce archetype-level insights, not hand-specified answers
- **SKR-P-01** (diagnose capability gaps before augmentation) — `sgsd-phase-researcher` identifies what the team doesn't know before dispatching research

### 2.3 Category C — Execution (modifies code / artifacts)

**Agents:** `sgsd-executor` (fallback), `sgsd-exec-backend`, `sgsd-exec-ui`, `sgsd-exec-test`, `sgsd-exec-refactor`, `sgsd-exec-fix`, `sgsd-exec-config`, `sgsd-exec-docs`, `sgsd-exec-integration`

**Research principles applied:**
- **ASS-P-06** (seed specialists with proven base methods) — each `sgsd-exec-*` wraps the common executor substrate (TDD cycle, atomic commit, surgical constraint) and overlays role-specific expertise
- **ASS-P-03** (structured memory: pattern, approach, failure mode, rule) — execution outcomes written to `.planning/memory/architecture/patterns/` in this schema
- **ISO-P-01** (combine execution + semantic metrics) — per-dispatch ATC (R-Q2) uses both
- **ISO-P-03** (scaffolding ≥ model choice) — prompt composition is the lever; model choice is secondary
- **ISO-P-04** (test against correctness, not speed) — the surgical constraint header forces adherence
- **ISO-P-07** (contextual correctness > syntactic) — `sgsd-exec-fix` specifically trained on reproduce-first
- **HCC-P-10** (prompts as contracts) — each `sgsd-exec-*` has a strict input contract (task-block from v2 plan) and output contract (6-section structured report)
- **LLMS-P-05** (implementation drift under execution pressure) — mitigated by per-dispatch ATC + edge-guard (R-Q4)

### 2.4 Category D — Verification (confirms goal achievement)

**Agents:** `sgsd-verifier`, `sgsd-integration-checker`, `sgsd-nyquist-auditor`, `sgsd-doc-verifier`

**Research principles applied:**
- **LLMS-P-03** (systems declare success before verifying) — this category IS the antidote. Strengthen structural role.
- **LLMS-P-08** (peer review reveals blind spots) — R-Q6d: sampled adversarial verification (N% of pass verdicts get a contrarian challenger)
- **ISO-P-01** (combine execution + semantic metrics) — R-Q6d semantic-intent check: does diff serve phase goal, not just pass tests?
- **ISO-P-02** (separate diagnosis from execution) — verifier reports what passed, what failed, and *why* each belongs to the phase goal
- **MET-P-11** (rubric scoring) — verifier verdict is rubric-driven, not prose
- **SEV-P-02** (prioritize by confidence) — verifier attaches confidence to each verdict (R-Q7b)
- **HCC-P-04** (explicit dead-end labelling) — `sgsd-verifier` captures what was checked-and-rejected

### 2.5 Category E — Review / Audit (retrospective quality)

**Agents:** `sgsd-code-reviewer`, `sgsd-code-fixer`, `sgsd-security-auditor`, `sgsd-eval-auditor`, `sgsd-eval-planner`, `sgsd-ui-auditor`, `sgsd-ui-checker`, `sgsd-ui-researcher`

**Research principles applied:**
- **LLMS-P-08** (peer review reveals blind spots) — multi-agent review pattern; R-Q2c sub-question explores N=2 dual-reviewer
- **ISO-P-01** (combine execution + semantic metrics) — reviewers check both
- **ISO-P-08** (benchmark diversity prevents false confidence) — reviewers sample multiple files/commits, not one
- **HCC-P-07** (validate tier necessity via ablation) — `sgsd-code-reviewer` findings feed phase-147-style gate ablation test
- **ASS-P-04** (reflection cycles convert outcomes to rules) — reviewer findings auto-curated to `.planning/memory/architecture/anti-patterns/`
- **ASS-P-03** (structured memory format) — findings schema: `pattern, approach, failure_mode, rule`
- **SKR-P-02** (hidden-state probing) — `sgsd-eval-auditor` uses confidence-signal analysis of agent outputs for gate decisions

### 2.6 Category F — Debugging (live investigation)

**Agents:** `sgsd-debugger`, `sgsd-debug-session-manager`

**Research principles applied:**
- **LLMS-P-01** (diagnose failure modes before scaling) — debugger's core discipline
- **ISO-P-02** (separate diagnosis from execution) — `sgsd-debugger` reports diagnosis first, fix second, in separate sections
- **SKR-P-01** (diagnose capability gaps before augmentation) — debugger decides when to invoke MCP tools (browser, logs, db) vs reason internally
- **SKR-P-02** (hidden-state probing for intervention) — applied to debug session state: when is the session stuck?
- **HCC-P-02** (lifecycle-event-governed transitions) — debug sessions transition via explicit state (triage → hypothesize → test → fix → verify)
- **MET-P-06** (transparent reasoning with Intuition + Why principled) — every fix proposal ends with these two blocks

### 2.7 Category G — Codebase Analysis (maps existing state)

**Agents:** `sgsd-codebase-mapper`, `sgsd-intel-updater`

**Research principles applied:**
- **HCC-P-03** (threshold-based retrieval over top-k) — mapper returns N*confidence-above-δ matches, not fixed top-k
- **HCC-P-09** (semantic embedding as bridge between tiers) — mapper outputs embeddings + summaries, L3-compatible
- **HCC-P-11** (separate transient from strategic) — `sgsd-intel-updater` writes to strategic `.planning/intel/`, not transient logs
- **AGP-P-05** (protocol-level resource registration) — mapper output registers in resource-registry
- **ASS-P-08** (accumulate expertise without retraining) — intel accumulates across phases, becomes shared context

### 2.8 Category H — Meta / Governance (shape the project itself)

**Agents:** `sgsd-roadmapper`, `sgsd-doc-writer`, `sgsd-doc-verifier`, `sgsd-user-profiler`, `sgsd-framework-selector`

**Research principles applied:**
- **MET-P-01** (route guidance by workflow stage) — roadmapper tailors to project stage (new / mid-milestone / close)
- **MET-P-09** (calibrate explanation depth to audience) — `sgsd-user-profiler` feeds this: new-to-SGSD vs expert operator get different doc depth
- **MET-P-10** (work within stated constraints) — framework-selector honors constraints from brief
- **LLMS-P-06** (domain intelligence cannot be reduced to prompting) — honest limit flagged: roadmapper can't replace human taste on strategic direction
- **AGP-P-07** (explicit lifecycle management) — doc-writer distinguishes create/update/retire states
- **ASS-P-05** (discovered archetypes vs predefined roles) — user-profiler surfaces operator archetype from behavioral data rather than asking

### 2.9 Category I — Board / Deliberation (strategic decisions)

**Agents:** `sgsd-ceo`, `sgsd-board-architect`, `sgsd-board-pragmatist`, `sgsd-board-contrarian`, `sgsd-board-moonshot` (and any custom role per R-Q7d)

**Research principles applied:**
- **LLMS-P-08** (peer review reveals blind spots) — the entire point; the 4-member adversarial board IS this principle
- **ASS-P-05** (discovered archetypes vs predefined roles) — R-Q7d challenges the static 4-role set; long-term may evolve
- **ASS-P-07** (retain-then-escalate) — R-Q7a: start with 2 members, escalate to 4 only when tension surfaces
- **SEV-P-02** (prioritize by confidence, not consensus alone) — R-Q7b confidence-weighted vote synthesis
- **SEV-P-04** (iterative refinement compounds) — Round 2 pattern already does this
- **TJE-P-01** (entropy-based early stopping) — skip Round 2 when Round 1 is low-entropy (confident + consistent)
- **MET-P-02** (balance probing 30–50% with action 50–70%) — enforce on board member prompts
- **MET-P-06** (Intuition + Why principled blocks) — every board member response ends with these
- **MET-P-08** (falsifiable suggestions) — R-Q7c: every decision memo gets a `## Falsifier` section
- **MET-P-11** (rubric scoring) — CEO synthesis uses multidimensional rubric, not prose judgment
- **HCC-P-04** (explicit dead-end labelling) — R-Q7c: `## Dead Ends / Paths Ruled Out` section
- **HCC-P-10** (prompts as contracts) — R-Q7f: structured YAML responses, not prose
- **AGP-P-02/P-05** (first-class versioned resources + discovery) — R-Q7d: board members registered in `registry/board-members.yaml`
- **ISO-P-01** (combine execution + semantic metrics) — R-Q7e: post-implementation scoring loop closes the learning cycle

---

## 3. Unified Handover Contract

Every SGSD agent adopts this contract. Version-tracked under `super-gsd/registry/handover-contract-v2.yaml`. Agents declare conformance in their frontmatter.

### 3.1 Input contract (what the agent is given)

```yaml
input:
  brief:                         # context of the larger work
    phase: integer
    plan: integer
    milestone: string
    goal: string                 # from ROADMAP.md
  task:                          # specific unit of work (from v2 plan)
    id: string                   # e.g. T3
    agent: string                # this agent's slug
    model: string                # haiku | sonnet | opus
    files_touched: [string]
    depends_on: [string]
    input_contract: object       # per-agent expected inputs
    hypothesis: string           # MET-P-08
    falsifier: string            # MET-P-08
    stop_rule: string            # MET-P-08
    known_deadends: [string]     # HCC-P-04
    expertise_ref: string        # pointer to expertise file
  context:                       # retrieved knowledge
    brv_queries: [string]        # executed
    brv_results: [object]        # results
    intent: string               # DLB-03 injection
    prior_errors: [string]       # looked up per task
  constraints:
    surgical_constraint: string  # mandatory header
    token_budget: integer
    time_budget_sec: integer
```

### 3.2 Output contract (what the agent must return)

```yaml
output:
  report:                        # 6-section structured report
    FILES_CHANGED: [path (created|modified|deleted)]
    VERIFICATION: [cmd → exit N ✓|✗]
    DEVIATIONS: [string]         # [Rule N] description | none
    BLOCKERS: [string]           # description | none
    SCRIPTS_CREATED: [object]    # path | purpose | interface | none
    ONE_LINER: string            # max 120 chars
  confidence: integer            # 1-5 (SEV-P-02)
  rationale: string              # max 300 words
  intuition: string              # MET-P-06
  why_principled: string         # MET-P-06
  evidence_cited: [string]       # brief-section | DLB-ref | research-slug
  emits: [string]                # log files / artifacts written
  word_count: integer            # for the 300-word guard
```

### 3.3 Emits contract (what observable signals the agent fires)

Every agent declares — in its frontmatter and in `registry/decisions.yaml` — exactly which log files it writes:

```yaml
emits:
  - .planning/metrics/heartbeat.jsonl           # via PostToolUse hook
  - .planning/metrics/activity-log.jsonl        # via PreToolUse hook
  - .planning/metrics/orchestrator-pulse.jsonl  # via orchestrator Step entry
  - .planning/metrics/token-log.jsonl           # via post-dispatch log
  - .planning/phases/{N}/commit-reviews.jsonl   # if ATC tier > skip
  - .planning/memory/architecture/patterns/     # if new pattern discovered (sgsd-curate)
  - .planning/memory/architecture/anti-patterns/# if new failure discovered
  - .planning/phases/{N}/WASTE.md               # MUDA finding (if fires)
  - .planning/phases/{N}/DEVIATIONS.md          # accumulated per-dispatch
```

Edge-guard (R-Q4) enforces: transition Step N → N+1 is blocked until declared emits for Step N are present.

### 3.4 Expertise reference

Each agent points to a static expertise file separate from dynamic memory. ASS-P-05 + PI Framework meeting alignment.

```
super-gsd/expertise/
  sgsd-exec-backend.md
  sgsd-exec-ui.md
  sgsd-exec-test.md
  sgsd-exec-refactor.md
  sgsd-exec-fix.md
  sgsd-exec-config.md
  sgsd-exec-docs.md
  sgsd-exec-integration.md
  sgsd-executor.md                # fallback
  sgsd-planner.md
  sgsd-verifier.md
  sgsd-code-reviewer.md
  sgsd-debugger.md
  sgsd-board-architect.md
  sgsd-board-pragmatist.md
  sgsd-board-contrarian.md
  sgsd-board-moonshot.md
  sgsd-ceo.md
  ... (one per agent)
```

Each expertise file declares: `seeded_methods`, `failure_modes`, `output_quality_bar`, `known_pitfalls`, `reference_patterns`.

---

## 4. Resource Registry Integration (R-Q5 — Autogenesis substrate)

Four registries under `super-gsd/registry/`:

### 4.1 `agents.yaml`

```yaml
version: 2
agents:
  - name: sgsd-exec-backend
    category: C-execution
    model_default: sonnet
    expertise_ref: super-gsd/expertise/sgsd-exec-backend.md
    input_contract_ref: super-gsd/registry/handover-contract-v2.yaml#input
    output_contract_ref: super-gsd/registry/handover-contract-v2.yaml#output
    emits:
      - .planning/metrics/heartbeat.jsonl
      - .planning/metrics/activity-log.jsonl
      - .planning/phases/{N}/commit-reviews.jsonl
    state: active                 # draft | active | deprecated | retired
    version: 2.0
    supersedes: gsd-executor      # migration trace
    owner_dlb: DLB-04
    lifecycle_events:
      - {event: created, ts: 2026-04-21, note: "SGSD v2 migration"}
  # ... one entry per agent
```

### 4.2 `hooks.yaml`

```yaml
hooks:
  - name: sgsd-heartbeat
    event: PostToolUse
    script: ~/.claude/hooks/sgsd-heartbeat.js
    writes: .planning/metrics/heartbeat.jsonl
    reads: [tool_response payload]
    depends_on: [sgsd-activity-logger]
    failure_mode: silent
    dashboards_consuming: [SGSD1]
    state: pending-registration    # currently not installed (see install.sh gap)
    owner_dlb: DLB-04
```

### 4.3 `decisions.yaml`

```yaml
decisions:
  - step: 9.5
    name: per-dispatch-ATC
    rule_source: C:/Users/user/.claude/atc/07-CHECKLIST.md
    applies_when: tier in [FULL, GATE]
    skip_when: tier == SKIP
    enforcement_mode: hard-halt    # hard-halt | soft-warn | amortized (per R-Q2 three-tier)
    evidence_file: .planning/phases/{N}/commit-reviews.jsonl
    emits: [.planning/phases/{N}/commit-reviews.jsonl]
    expects: [FILES_CHANGED in prior step's report]
    source_dlb: DLB-02
```

### 4.4 `gates.yaml` + `board-members.yaml`

Parallel structure. `gates.yaml` separates gate enforcement from the decision-step that triggers them (R-Q5 refinement). `board-members.yaml` lets the board roster evolve via SEPL (R-Q7d).

---

## 5. Per-Category Upgrade Checklist

Standard work applied to every agent. Per-category specifics noted in Section 2.

- [ ] Rename file from `gsd-*` → `sgsd-*`
- [ ] Add `handover_contract: v2` to frontmatter
- [ ] Add `expertise_ref:` pointing to `super-gsd/expertise/{name}.md`
- [ ] Create expertise file with seeded_methods + failure_modes + output_quality_bar (ASS-P-06)
- [ ] Add `emits:` list to frontmatter (R-Q1 observability contract)
- [ ] Update prompt template to require structured output (HCC-P-10)
- [ ] Add `confidence:` field requirement to output (R-Q7b / SEV-P-02)
- [ ] Add `intuition:` + `why_principled:` requirement (MET-P-06)
- [ ] Register entry in `super-gsd/registry/agents.yaml`
- [ ] Update callers (orchestrator skill, other agents) to use new name
- [ ] Run smoke test: single-dispatch against known task, verify emits land
- [ ] Mark prior `gsd-*` agent as `state: deprecated` with `supersedes` link

---

## 6. Sequencing — The Mammoth Plan in Phases

Dependencies matter. Some work unblocks other work. Sequenced to minimize thrash and allow partial rollout.

### Phase A — Registry + Contract Scaffolding (~4h, FLOOR-executable)

Prerequisites: none. Decides: nothing. Opens: everything downstream.

- [ ] A1. Create `super-gsd/registry/` dir with 4 empty YAML stubs (agents, hooks, decisions, gates) + `board-members.yaml`
- [ ] A2. Create `super-gsd/registry/handover-contract-v2.yaml` with the Section 3 schemas
- [ ] A3. Create `super-gsd/expertise/` dir with a template expertise file
- [ ] A4. Add registry-integrity preflight to `sgsd-boot.ps1` (Section 7)
- [ ] A5. Commit as `feat(registry): scaffold SGSD v2 resource protocol`

### Phase B — DROPPED (per 2026-04-21 rename rule)

The original Phase B proposed a bulk `cp + sed` rename of 6+ inherited `gsd-*` agents to `sgsd-*` as a mechanical precursor to Phase G. That was wrong: the rename should happen *inside* each agent's Phase G upgrade commit, where the v2 contract + expertise + research grounding actually land. Renaming ahead of that dilutes the prefix's meaning.

What survives from the old Phase B:

- **Double-prefix cleanup** (R-Q8b): verify no `sgsd-sgsd-*` or `ssgsd-*` exist in actual filesystem (earlier scan confirmed they don't — was an Agent-tool-listing artifact, not a file-artifact). No action needed.
- **Per-agent rename** moves into Phase G (see below): one commit per agent, bundling `gsd-* → sgsd-*` rename + v2 contract adoption + expertise file creation + research-principle frontmatter.

No Phase B commit; the slot is reclaimed by Phase C (new specialists) advancing earlier.

### Phase C — New Specialized Executors (~2h, FLOOR-executable)

Prerequisites: Phase B. Decides: nothing. Opens: visibility upgrade (R-Q8 agent naming).

- [ ] C1. Create 8 new `sgsd-exec-*.md` agent files wrapping the common executor substrate
- [ ] C2. Write 8 expertise files with role-specific seeded methods
- [ ] C3. Update orchestrator dispatch heuristic (file-extension → sgsd-exec-*)
- [ ] C4. Register all 8 in `agents.yaml`
- [ ] C5. Smoke-test each on a representative task

### Phase D — Hook Wire-up (~1h, FLOOR-executable)

Prerequisites: Phase A. Decides: nothing. Opens: observability contract (R-Q1).

- [ ] D1. Register `sgsd-heartbeat.js` as PostToolUse in `~/.claude/settings.json`
- [ ] D2. De-dup `sgsd-activity-logger.js` duplicate registration
- [ ] D3. Create `orchestrator-pulse.jsonl` emit in orchestrator skill Step entry
- [ ] D4. Register all hooks in `hooks.yaml`
- [ ] D5. Verify via preflight: sgsd-boot reports all hooks registered + logs growing

### Phase E — Statusline + Dashboard (~2h, FLOOR-executable)

Prerequisites: Phase D (needs emits live). Decides: nothing. Opens: visibility UX (R-Q8 statusline).

- [ ] E1. Write `super-gsd/scripts/sgsd-statusline.ps1` per R-Q8 layout
- [ ] E2. Wire via `~/.claude/settings.json` statusLine field
- [ ] E3. Add SGSD-specific tile to SGSD1 mission-control (last heartbeat, last pulse, last gate)
- [ ] E4. Add growth-curve plot (HCC-P-08) to SGSD1

### Phase F — Deliberation Brief Outcome Wave (depends on board ruling)

Prerequisites: brief deliberated (`.planning/briefs/2026-04-21-orchestrator-contract.md`). Decides: Q1-Q7 outcomes. Opens: everything contract-shape-dependent.

- [ ] F1. Apply Q3 plan-schema v2 decision (schema format + required fields)
- [ ] F2. Apply Q2 gate enforcement policy (hard/soft/amortized per gate)
- [ ] F3. Apply Q4 edge-guard implementation (per decided form)
- [ ] F4. Apply Q5 resource protocol scope (which registries, which SEPL integration)
- [ ] F5. Apply Q6a-d orchestrator skill refinements (per decided option)
- [ ] F6. Apply Q7a-g deliberate skill refinements (per decided option)

### Phase G — Per-Agent Doc + Runtime Upgrade (~10h, after Phase F)

Prerequisites: Phase F complete. Decides: nothing new (follows F decisions). Opens: category sharpening landed.

- [ ] G1. Category A (Orchestration) — 3 agents
- [ ] G2. Category B (Planning) — 10 agents
- [ ] G3. Category C (Execution) — 9 agents (inc. the 8 new specialists)
- [ ] G4. Category D (Verification) — 4 agents
- [ ] G5. Category E (Review/Audit) — 8 agents
- [ ] G6. Category F (Debugging) — 2 agents
- [ ] G7. Category G (Codebase Analysis) — 2 agents
- [ ] G8. Category H (Meta/Governance) — 5 agents
- [ ] G9. Category I (Board) — 5 agents
- [ ] G10. Each agent commits as `docs(agents): upgrade {name} per SGSD-v2 handover contract`

### Phase H — Decommissioning (~1h, after Phase G)

Prerequisites: All new agents proven in production. Decides: nothing. Closes: the old taxonomy.

- [ ] H1. Mark all original `gsd-*` files as `state: retired` in registry
- [ ] H2. Move retired files to `super-gsd/archive/agents-v1/`
- [ ] H3. Remove dispatch references from orchestrator (fall-through to sgsd-executor if unknown agent)
- [ ] H4. Commit as `chore(agents): retire v1 taxonomy; sgsd-* canonical`

---

## 7. Preflight Integration (sgsd-boot additions)

Extend `sgsd-boot.ps1` PREFLIGHT with new checks (Phase A):

- [ ] Registry integrity — parse all 4 YAML registries, verify schemas valid
- [ ] Hook registration audit — cross-check `hooks.yaml` against `~/.claude/settings.json`
- [ ] Log-freshness smoke test — fire a no-op tool, verify activity-log.jsonl + heartbeat.jsonl grew
- [ ] Dashboard reachability ping — verify SGSD1/2/3 can read the logs they consume
- [ ] Agent registry sanity — every `sgsd-*` agent referenced by orchestrator exists in `agents.yaml`
- [ ] Expertise file existence — every `expertise_ref` in agents.yaml resolves to a real file
- [ ] Edge-guard self-test — transition N → N+1 with deliberately missing emits, verify the guard fires

Failure modes: all blocking (FAIL) except dashboard reachability (WARN).

---

## 8. Relationship to Deliberation Brief

The brief at `.planning/briefs/2026-04-21-orchestrator-contract.md` holds the decision questions. This manifest holds the implementation.

| Brief question | Unblocks manifest phase | FLOOR-executable without board? |
|---|---|---|
| R-Q1 observability | Phase D (hook wire-up) + Phase E (statusline) | Yes for scaffolding; heartbeat wire-up is mechanical |
| R-Q2 gate policy | Phase F2 (decides enforcement_mode per gate) | No — depends on phase-147 ATC finding count |
| R-Q3 plan schema | Phase F1 (decides schema format + required fields) | No — board-worthy (backward-compat strategy) |
| R-Q4 edge-guard | Phase F3 | No — board-worthy (registry vs commit-hook vs edge) |
| R-Q5 resource protocol | All of Phase A (but scope-refinement deferred) | Partially — scaffold now, extensions per board |
| R-Q6 orchestrator skill | Phase F5 | Mixed: R-Q6c under FLOOR; R-Q6a/b/d board-worthy |
| R-Q7 deliberate skill | Phase F6 | Mixed: R-Q7a/c/d/f/g under FLOOR; R-Q7b/e board-worthy |
| R-Q8 visibility UX | Phase C (specialized executors) + Phase E (statusline) | Yes — all under FLOOR |

**Minimum-viable sequence:** Phases A → B → C → D → E can all land BEFORE the board rules, since they're FLOOR-executable scaffolding. Phase F waits on board. Phase G picks up board decisions and applies them per-agent. Phase H retires old.

Estimated total impl time: **~23 hours** distributed across the phases. Sequential-critical path: A (4h) → B (3h) → Phase F decisions → G (10h) + H (1h). Non-critical Phase C/D/E can parallelize with F's deliberation-wait time.

---

## 9. Rollback Strategy

Each phase is revertable via `git revert` of its commits. Specific rollback considerations:

- **Phase A** — registry scaffolding is additive; rollback deletes empty files only
- **Phase B** — rename migration retains originals; rollback restores original dispatch names (revert + cleanup sgsd-* copies)
- **Phase C** — new specialized executors fall back to generic `sgsd-executor` on deletion
- **Phase D** — hook wire-up rollback via settings.json revert; residue in log files is harmless
- **Phase E** — statusline revert restores Claude Code default
- **Phase F** — board-decision-dependent; each sub-decision's rollback is noted in the deliberation memo's "Rollback" section
- **Phase G** — per-agent doc upgrades are trivially revertable (file edits only)
- **Phase H** — retirement uses state flags + archive move; rollback un-archives + flips state

No phase is one-way. The DELIBERATION-FLOOR's revertability requirement is preserved at every step.

---

## 10. Open Questions / Deferred to Board

These surfaced during manifest drafting and are genuine open decisions:

1. **Should inherited `gsd-*` agents be renamed or forked?**
   - Rename: single file, clean migration, breaks anyone still using GSD-1 names
   - Fork: `sgsd-*` alongside `gsd-*`, gradual migration, carries both forever
   - **Recommendation:** rename (Phase B). GSD-1 tooling doesn't touch `super-gsd/`, so no external breakage.

2. **Expertise file discovery — single directory or per-category subdirs?**
   - `super-gsd/expertise/*.md` (flat) vs `super-gsd/expertise/{category}/*.md` (nested)
   - **Recommendation:** flat — simpler discovery, category lives in filename prefix.

3. **Backward-compat window for v1 agents?**
   - Keep v1 agents active for N milestones before retiring?
   - **Recommendation:** 1 milestone. Phase G lands in v1.2, Phase H retires at v1.3 close.

4. **Registry owner — single file or distributed?**
   - One `agents.yaml` vs per-category files (`agents-executors.yaml`, `agents-board.yaml`)
   - **Recommendation:** single file. YAML anchors handle shared fragments. Section indexes for readability.

5. **Expertise evolution via SEPL — propose or auto-edit?**
   - SEPL can PROPOSE expertise edits; operator reviews. Should any be auto-applied?
   - **Recommendation:** never auto. Expertise = strategic layer, HCC-P-11 says keep it manual.

6. **Per-agent emits registry — declared in agent file or registry?**
   - Single source of truth: agent file vs `agents.yaml`?
   - **Recommendation:** registry is canonical, agent frontmatter mirrors for readability. Preflight checks sync.

---

## 11. Citations Summary

Every sharpening in this manifest traces to specific principle IDs in the 9-paper corpus (stored in `C:\Users\user\Voice-Text-Plan\wiki\research\*.enrichment.json`, junctioned to `C:\Users\user\GSDedits\wiki\research\`).

**Paper → principle IDs most cited here:**
- AGP (Autogenesis): P-01, P-02, P-03, P-04, P-05, P-07, P-08 (Section 4 registry, Section 2.1, 2.7, 2.9)
- ASS (Stateful Specialization): P-01, P-03, P-04, P-05, P-06, P-07, P-08 (Section 2.3, 2.5, 2.9)
- SKR (Skill-RAG): P-01, P-02 (Section 2.5, 2.6)
- MET (METIS): P-01, P-02, P-04, P-06, P-08, P-09, P-10, P-11 (Section 2.2, 2.8, 2.9)
- LLMS (Autonomous Research): P-01, P-03, P-05, P-06, P-07, P-08 (Section 2.1, 2.4, 2.6, 2.8, 2.9)
- HCC (Cognitive Caching): P-01, P-02, P-03, P-04, P-05, P-07, P-08, P-09, P-10, P-11 (Section 2.1, 2.7, 3, 5)
- SEV (Sequential Edge): P-01, P-02, P-04 (Section 2.1, 2.9)
- TJE (Think Just Enough): P-01 (Section 2.1, 2.9)
- ISO (ISO-Bench): P-01, P-02, P-03, P-04, P-07, P-08 (Section 2.3, 2.4, 2.5)

**DLB → integration points:**
- DLB-01 (memory topology): Section 3.4 expertise files, Section 4 registries
- DLB-02 (MUDA loop): Section 2.5 audit category + emits
- DLB-03 (intent continuity): Section 3.1 input contract intent field
- DLB-04 (self-evolving substrate): Section 4 registry + SEPL integration
- DLB-05 (VTP-audit sharpening): Section 2.9 board + deliberation budget
- DLB-06 (central distribution): Phase A-B rollout via sgsd-update
- DELIBERATION-FLOOR: Section 6 per-phase FLOOR-executability flags

---

## 12. What This Document Is Not

- Not a decision document — the brief is (this is its implementation companion)
- Not a code artifact — it does not contain agent file contents (those land in Phase G)
- Not a roadmap entry — it cross-cuts milestones (each phase commits against its own milestone)
- Not final — expected to evolve as the board rules Q1-Q7 and as implementation surfaces new findings

Iterate this document as Phase F decisions land. Update Section 6 sequencing when dependencies change. Log each phase's completion in a `status_log:` appendix (TBD).

---

**Next action on this manifest:** operator review, then kick off Phase A (registry scaffolding) as it's FLOOR-executable and unblocks everything downstream.
