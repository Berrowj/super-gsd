# Phase 21: VTP Enrichment Gates — Research

**Researched:** 2026-04-24
**Domain:** Cross-cutting gate integration — VTP MCP, orchestrator dispatch, deliberation board
**Confidence:** HIGH (all sources are in-repo code and locked CONTEXT.md decisions)

<user_constraints>
## User Constraints (from 21-CONTEXT.md D-01..D-07 — DO NOT REOPEN)

- D-01: 5-tool cascade; tools 1+2 always, 3+4+5 only if hits > 0
- D-02: Seed = CONTEXT domain + REQ-IDs AC + RESEARCH.md, 800-token cap
- D-03: Max 5 queries per gate (~5k tokens total)
- D-04: VTP-ENRICHMENT.md artifact shape (YAML frontmatter + 4 body sections)
- D-05: Audit tier-batching — CRITICAL=per-finding, WARN=batched, PASS=skip
- D-06: sgsd-board-researcher model = sonnet
- D-07: config.vtp_enrichment absent = DISABLED (backward-compat, opt-in)

**Deferred (OUT OF SCOPE):** challenger mode, multi-library, write-side publish, cross-phase diff, query caching
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VTPE-01 | Research→Planning enrichment gate | Insert Step 6.b.5 in orchestrator SKILL.md |
| VTPE-02 | Audit workflow cross-reference (3 surfaces) | Shared `vtpCrossRef()` in sibling module |
| VTPE-03 | Milestone-close library cross-reference | Extend sgsd-complete-milestone Step 7 (not duplicate) |
| VTPE-04 | Design-policy config locks | Add `vtp_enrichment` block; append `"researcher"` to board array |
| VTPE-05 | Empty-hit artifact discipline | status field live (81b66e9); write on zero hits, block only on api_error |
| VTPE-06 | sgsd-board-researcher 5th deliberation voice | New agent + sgsd-ceo Step 4 + config board append |
</phase_requirements>

---

## Standard Stack

Existing SGSD assets Phase 21 CONSUMES — no new libraries:

| Asset | File | Phase 21 Role |
|-------|------|---------------|
| `callVtp(tool, args)` | `super-gsd/scripts/lib/vtp-context-composer.cjs` | All MCP calls flow through this; timing + routing-log row + error shape handling |
| `gates.shouldFire()` | `super-gsd/scripts/lib/gates-registry.cjs` | Predicate check for new `vtp-enrichment` gate row |
| `gates.yaml` | `super-gsd/registry/gates.yaml` | schema_version 2.1.0 — add one gate row |
| `sgsd-board-architect.md` | `super-gsd/agents/sgsd-board-architect.md` | Direct copy scaffold for `sgsd-board-researcher.md` |
| `sgsd-ceo.md` | `super-gsd/agents/sgsd-ceo.md` | Update Step 4 spawn count + `<synthesis_rules>` + `<token_budget>` |
| sgsd-orchestrate SKILL.md | `super-gsd/skills/sgsd-orchestrate/SKILL.md` | Insert Step 6.b.5 between Steps 6.b and 6.c |
| sgsd-complete-milestone SKILL.md | `super-gsd/skills/sgsd-complete-milestone/SKILL.md` | Extend Step 7 read-side citation output only |

**D-01 MCP tools (existing, no installs):** `vtp_search`, `vtp_search_substrate`, `vtp_search_research`, `vtp_route_and_retrieve`, `vtp_advise_service_enrichment`

---

## Architecture Patterns

### System Data Flow

```
RESEARCH.md written
    |
    v
Step 6.b.5 — gates.shouldFire('vtp-enrichment') + config.vtp_enrichment.enabled?
    |
    +-[disabled/absent]----> pass to Step 6.c (planner) unchanged
    |
    +-[enabled]-----------> build 800-token seed (CONTEXT + REQ-IDs + RESEARCH)
                                |
                           run vtp_search + vtp_search_substrate (always)
                                |
                         total_hits == 0?
                        /               \
                  [yes]                 [no: run tools 3+4+5]
                    |                       |
              write empty-hit        write enriched
              VTP-ENRICHMENT.md      VTP-ENRICHMENT.md
                        \               /
                    artifact exists check
                         |
                   api_error? --YES--> BLOCKER (Exit #3)
                         |
                        NO: Step 6.c (gsd-planner) receives RESEARCH.md + VTP-ENRICHMENT.md
```

### Pattern 1: Orchestrator Gate Insertion (VTPE-01)

**Insert as Step 6.b.5** in sgsd-orchestrate SKILL.md, after Step 6.b fires and RESEARCH.md is confirmed written, before Step 6.c (planner dispatch). The SKILL.md Step 6 section uses lettered sub-rules (a/b/c/d/e/f/g/h) — insert between b and c.

```
6.b.5 VTP ENRICHMENT GATE (VTPE-01)
  if (config.vtp_enrichment && config.vtp_enrichment.enabled) {
    const seed = buildEnrichmentSeed(contextMd, requirementsMd, researchMd, 800);
    // Dispatch sgsd-vtp-enrichment as sub-agent (MCP tools need agent runtime scope)
    result = await Agent({ subagent_type: 'sgsd-vtp-enrichment', model: 'sonnet',
                           prompt: { seed, phaseDir, phase, config: config.vtp_enrichment } });
    if (result.status === 'api_error') {
      EMIT BLOCKER: "VTP API error: {result.reason}"; EXIT loop
    }
    // empty_hit or success: VTP-ENRICHMENT.md written, continue
  }
  // absent config: skip silently (D-07)
```

**Planner prompt composition:** After gate fires, gsd-planner dispatch MUST include `VTP-ENRICHMENT.md` in `<files_to_read>`. This is a separate change to the orchestrator's planner prompt composition.

### Pattern 2: Sibling Module vs. Extension (VTPE-01 + VTPE-02)

**Use a NEW sibling: `super-gsd/scripts/lib/vtp-enrichment-gate.cjs`**

Rationale: `vtp-context-composer.cjs` has a stable 6-export contract (`compose`, `project`, `isFastPathEligible`, `callVtp`, `TIERS`, `resetCache`). Adding gate-orchestration to it mixes responsibilities and forces all callers to upgrade. Sibling module `require('./vtp-context-composer.cjs')._internal` to access `callVtp` — no duplication.

Exports: `{ run, vtpCrossRef }` — same `--self-test` CLI pattern as composer.

### Pattern 3: Audit Cross-Ref (VTPE-02)

**Recommendation: shared `vtpCrossRef(text, tier, opts)` exported from `vtp-enrichment-gate.cjs`**, called from each of the 3 audit skills as a trailing step before writing the output artifact. Add `## Library Cross-Reference` section to each audit artifact.

DRY rationale: 3 audit skills, identical logic, same tier-batching rules (D-05). A helper export prevents copy-paste drift across 3 files.

### Pattern 4: Milestone-Close Extension (VTPE-03)

`sgsd-complete-milestone` Step 7 already queries VTP and folds into Connections section. **Extend Step 7 write-side only** — add book/paper title + section ref + confidence to the Connections table row. Zero new queries; zero new steps. The existing Step 7 query already runs.

### Pattern 5: Board 4→5 Extension (VTPE-06)

Minimal changes to `sgsd-ceo.md`:
- Step 4: `Spawn 4 board members` → `Spawn board members (config.deliberation.board)` — config-driven, defensive guard `if (board.includes('researcher'))`
- `<synthesis_rules>`: add `Weight Researcher on library precedent`
- `<token_budget>`: update x4→x5 line and total; per D-06 adds ~2k tokens/round

`config.json` change: `deliberation.board` append `"researcher"` — this single toggle activates the 5th voice. Current value confirmed: `["architect","pragmatist","contrarian","moonshot"]`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| VTP MCP timing + error handling | Custom fetch wrapper | `callVtp()` from composer — has self-test, routing-log, error shapes |
| Query too-short guard | Regex | Composer pre-guard already enforces rawQuery.length >= 3 |
| Gate predicate evaluation | Ad-hoc config check | `gates.shouldFire('vtp-enrichment', ctx, GATES_YAML_PATH)` — already cached at cold-start |
| Config file mutation | `head`/`cat`/`echo` | Node read-mutate-write (`feedback_never_head_settings` — head exposes env block secrets) |
| Board agent structure | New agent from scratch | Copy `sgsd-board-architect.md` — identical 5-section scaffold, YAML output contract |
| MCP retry loops | Internal backoff | api_error → blocker → human restarts MCP (thundering-herd risk per HiveMind doc:5a50cc9b459e) |

---

## Common Pitfalls

### Pitfall 1: Artifact Theater
Gate writes VTP-ENRICHMENT.md but planner prompt doesn't include it — library knowledge silently discarded.
**Prevention:** Plan 21-01 task MUST also patch planner dispatch to add VTP-ENRICHMENT.md to `<files_to_read>`. Verification: `grep -q 'VTP-ENRICHMENT' custom-gsd-extract/claude-agents/gsd-planner.md`.

### Pitfall 2: Empty-Hit vs. API Error Confusion
Both look like "no content returned" but have opposite orchestrator behaviors.
**Prevention:** `vtp-enrichment-gate.cjs` distinguishes: `api_error` = `callVtp({ok:false})` → BLOCKER; `empty_hit` = `callVtp({ok:true})` with `evidence_hit_count === 0` → write artifact, continue. The routing-log `status` field (shipped commit 81b66e9) already models `zero_hits` vs `failure`.

### Pitfall 3: Board Vote-Math Breaks at N=5
sgsd-ceo synthesis rules hardcode 4-member patterns ("3+ agree", "Split 2-2", "All 4 agree").
**Prevention:** Update `<synthesis_rules>` to use N from `config.deliberation.board.length`. Majority = ceil(N/2)+1. Verify: after shipping VTPE-06, deliberation log must show 5 positions emitted.

### Pitfall 4: Audit Cross-Ref Token Explosion
Per-finding VTP calls on every finding → 20 findings = 20 VTP calls per audit run.
**Prevention:** D-05 tier-batching is mandatory in `vtpCrossRef()` — CRITICAL = per-finding (typically 0-2), WARN = single batched call, PASS = no call. Enforce at the helper level, not caller-side.

---

## Code Examples

### gates.yaml new row

```yaml
  - name: vtp-enrichment
    category: process-hygiene
    step: 6.15
    enforcement_mode: soft-warn  # api_error escalates to hard-halt via orchestrator code
    trigger:
      - field: research_phase_complete
        op: eq
        value: true
      - field: vtp_enrichment_enabled
        op: eq
        value: true
    evidence_emitted:
      - .planning/milestones/{version}/phases/{NN}-*/{NN}-VTP-ENRICHMENT.md
    escalation: block_on_api_error
    source_dlb: VTPE-01
    state: active
    version: 2.1
```

### VTP-ENRICHMENT.md minimum schema (D-04 + VTPE-05)

```markdown
---
phase: 21
query_count: 2
total_hits: 0
duration_ms: 847
empty_hit: true
vtp_status: empty_hit    # success | empty_hit | api_error
generated_at: 2026-04-24T17:23:00Z
seed_summary: "VTP enrichment gates orchestrator integration"
---
# VTP Library Enrichment — Phase 21
## Library Hits
| Source | Title | Section | Relevance | Citation |
|---|---|---|---|---|
| (none) | — | — | — | — |
## Gaps the library surfaces
- No library coverage found for this topic.
## Alternative framings from library
- (none found)
## Empty-Hit Rationale
Topic: "VTP enrichment gates orchestrator integration"
Reasoning: "Library does not cover SGSD-specific gate patterns. Absence is informative — no conflicting precedent."
```

**Minimum required fields for downstream existence check:**
`empty_hit`, `total_hits`, `vtp_status` in frontmatter; `## Empty-Hit Rationale` section when `empty_hit: true`.

### sgsd-board-researcher.md key differentiators (from sgsd-board-architect.md scaffold)

```markdown
---
name: sgsd-board-researcher
description: Library Researcher board member. Queries VTP during deliberation to confirm or challenge with book/paper precedent. Spawned by sgsd-ceo.
tools: Read, Grep, Glob, mcp__vtp-kb__vtp_search, mcp__vtp-kb__vtp_search_substrate, mcp__vtp-kb__vtp_search_research, mcp__vtp-kb__vtp_route_and_retrieve
model: sonnet
---
```

YAML output block additions (append to standard board schema):
```yaml
library_coverage: confirmed | adjacent | absent
citations:
  - doc_id: "doc:XXXXX"
    title: "Book or Paper Title"
    section: "Chapter or section reference"
    relevance: "how this citation applies"
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Gate dispatched as sub-agent (not inline Node require) so MCP tools are in runtime scope | Architecture Patterns | Inline CJS cannot inject mcpInvoke → gate always returns `no_mcp_invoke` silently |
| A2 | sgsd-ceo synthesis vote-math is prose-only (no structured parsing) | Pattern 5 | Structured N=4 parsing would break deliberation memo format at N=5 |

---

## Sources

### Primary (HIGH — in-repo verified)
- `vtp-context-composer.cjs` full source — 6 exports, `callVtp` contract, `_internal.writeRoutingLogRow`, status field confirmed
- `gates.yaml` full source — schema_version 2.1.0, row shape confirmed
- `sgsd-ceo.md` full source — board spawn Step 4, `config.deliberation.board` array, token budget, synthesis rules
- `sgsd-board-architect.md` + `sgsd-board-contrarian.md` — 5-section scaffold, YAML output contract confirmed identical
- `sgsd-orchestrate/SKILL.md` Steps 6.b/6.c — insertion point for Step 6.b.5 confirmed
- `sgsd-complete-milestone/SKILL.md` Steps 6+7 — Step 7 read-side extension target confirmed
- `sgsd-vtp-advise/SKILL.md` — standalone VTP advisor pattern (sub-agent dispatch with MCP tools)
- `.planning/config.json` — `deliberation.board` confirmed `["architect","pragmatist","contrarian","moonshot"]`; `vtp_enrichment` key ABSENT
- `16-01/02/03-SUMMARY.md` — Phase 16 Wave A/B/C deliverables confirmed; reuse seams identified
- `21-CONTEXT.md` D-01..D-07 — all 7 locked; no alternatives investigated
