---
type: design-decision
date: 2026-05-20
trigger: Clarity ERP v22-13c Plan 01 incident 2026-05-18 (ATC v4 false CRIT) + Pi2Pi/MMP analysis 2026-05-20
board: none (synthesis decision after operator review of Pi2Pi transcript + MMP paper; not a board deliberation)
predecessor: DLB-07 (semantic vs structural verification)
host_milestone: v3.0 SGSD-PRO
decision: "Add lineaged role-filtered cognitive memory underneath SGSD's existing control plane. Steal the invariants of Pi2Pi (operational pattern) and Mesh Memory Protocol (formal protocol); copy neither implementation. Mesh-shaped memory, central-shaped runtime. Seven typed CMB classes. No Pi/sym-mesh dependencies. No executor-authored CMBs in MVP."
---

# DLB-08: Mesh Memory Lite

## The incident this decision exists to fix

On 2026-05-18 the Clarity ERP project surfaced an ATC v4 reviewer failure on v22-13c Plan 01: the review returned CRIT against file:line evidence that refuted the claim. Re-running ATC produced the same CRIT. The standard SGSD policy "if ATC v4 still has CRIT, hard stop" treated a reviewer false positive as code convergence failure. The Plan was correct; the reviewer was hallucinating.

DLB-07 (2026-05-18) shipped the schema-level mechanical enforcement of semantic acceptance criteria, and sgsd-audit@v2 Layer 4 added phase-close enforcement. But two structural issues remained:

1. **A reviewer claim with no evidence-validation step ever becomes a blocking gate verdict.** ATC v4's CRIT was the gate result, not the input to a verification step.
2. **The board/triage layer escalates to operator because it lacks milestone context.** When the board cannot resolve a dispute, it points to the operator — usually because milestone WHY, persona priority, source-of-truth rules, and prior decision precedents were not carried from one agent to the next.

DLB-08 addresses both, plus the deeper pattern they share: **SGSD agents have no persistent role-filtered memory of what they understood, why they accepted it, where it came from, and whether it was original, echoed, disputed, or rejected.**

## Sources that informed this decision

Two external sources were analysed in depth on 2026-05-20:

- **Pi2Pi (Indie Dev Dan, YouTube 2026-05-20, 34:51 transcript)** — peer-to-peer agent communication primitive: 4 tools (list-agents, send-command, await-response, poll-message) × 2 implementations (single-device `comms` + cross-device `comms-net` Bun server). Operational pattern; demonstrates validator-on-top + focused-context-window + primitive-over-composition.
- **Mesh Memory Protocol (Hongwei Xu, arXiv 2604.19540, April 2026)** — formal protocol naming three problems (P1 per-field admission, P2 signal-level lineage, P3 write-time-filtered memory) and specifying four primitives (CAT7 schema, SVAF gate, lineage DAG, remix invariant) that solve them jointly.

Pi2Pi is the operational shape. MMP is the formal protocol underneath. Both intersect heavily with SGSD-PRO's existing scope (`.planning/proposals/2026-05-20-sgsd-pro-mode-codex-context-authority-plan.md`).

## The decision

**SGSD-PRO adopts a Mesh Memory Lite layer underneath the existing control plane.** Seven typed CMB classes. CAT7 envelope wrapping (not replacing) the domain context. Lineage DAG for provenance + O(1) echo detection. Write-time-filtered remix memory per role. SGSD remains the central control plane — mission, gates, promotion, real-operator escalation.

### The seven CMB types (locked vocabulary)

| Type | Class | Emitter | Authority | Purpose |
|---|---|---|---|---|
| `execution_receipt` | observation | SGSD wrapper | high (derived from facts) | What actually changed and what checks actually ran |
| `review_finding` | claim | ATC / Codex reviewer / board reviewer | medium/low (until validated) | A claim about risk, correctness, missing coverage, or policy breach |
| `evidence_verdict` | claim-with-authority | evidence_validator role | high for deterministic file/test claims; medium for semantic | Classify a review_finding as VERIFIED, REFUTED, STALE, UNVERIFIED, or GUARDED |
| `decision_recommendation` | decision | pseudo_operator role | bounded by authority_level + confidence + carve-out check | What SGSD should do given evidence + milestone context + policy |
| `operator_precedent` | decision | real operator | highest (unless superseded) | Make Jack's decisions reusable |
| `context_anchor` | projection | context-authority subsystem | high, but canonical source remains the YAML/MD file | Make YAML/MD context searchable/remixable while preserving canonical truth |
| `promotion_decision` | decision (terminal) | SGSD | high (records state transition) | PASS, FAIL_VERIFIED, PASS_WITH_REFUTED_REVIEW, NEEDS_OPERATOR |

**The binding invariant:** SGSD must never treat a claim CMB as an observation CMB. Claims need validation; observations are derived from facts. Conflating the two is the failure mode this decision is designed to prevent.

### The four invariants stolen from Pi2Pi / MMP

1. **CAT7 envelope** (from MMP §3.1). Every CMB has a fixed 7-field cognitive header: `focus`, `issue`, `intent`, `motivation`, `commitment`, `perspective`, `mood`. Universal across domains; richness in field text. The envelope does NOT replace the domain ontology — `MILESTONE-CONTEXT.yaml`, `PERSONA-MATRIX.yaml`, `LEXICON.yaml` remain canonical; CAT7 fields cite those anchors via `context_anchor` CMBs.
2. **Per-field admission gate** (from MMP §3.2). For every incoming claim, the receiver evaluates each field against its own role-anchor priors and classifies into one of four states: `REDUNDANT` / `ALIGNED` / `GUARDED` / `REJECTED`. In MVP this is rule-driven (Tier 0 deterministic + Tier 1 heuristic); embedding-backed SVAF (Tier 3) is v3.1+ work.
3. **Lineage DAG** (from MMP §3.3). Every derived/remixed CMB carries `lineage.parents` (direct provenance) and `lineage.ancestors` (transitive closure of content-hash keys). Three uses from one mechanism: provenance walking, O(1) echo detection via ancestor-set intersection against the receiver's own produced keys, and retention based on demonstrated downstream value rather than age.
4. **Write-time filtering invariant (remix)** (from MMP §3.4). When a CMB is admitted, the receiver does NOT persist the raw incoming CMB; it produces a new CMB expressing its own role-filtered understanding with lineage back to the source. Each role's memory contains only its own remixes. Recall is relevant by construction, not by retrieval tuning.

### The operational shape stolen from Pi2Pi

- **Validator-on-top pattern** (Pi2Pi 00:24:31). Primary agent does work; validator agent double-checks every claim and completion statement. In SGSD this maps to: reviewer makes claim → evidence_validator validates claim → pseudo_operator decides what to do with validated claims.
- **Focused context > mega-agent** (Pi2Pi 00:14:35). Each role peer has narrow context — `atc_schema_lean`, `evidence_validator`, `pseudo_operator`, `persona_sales`, `persona_procurement`, etc. — instead of one mega-agent holding everything.
- **Primitive over composition** (Pi2Pi 00:30:13). Ship "just an agent" as the atom; compose orchestrator/p2p/message-queue/agent-chain on top. SGSD's Codex executor + reviewers are the atoms; mesh-memory operations compose around them.
- **Information-hierarchy / flat-cognition argument** (Pi2Pi 00:08:32). Best ideas live at the bottom; flat structures let them surface. In SGSD this is adopted at the COGNITION layer only — peers deliberate as equals. GOVERNANCE remains central: SGSD owns gates and promotion.

## Drift Risks (binding watchlist; re-checked at every v3.0 phase close)

Eight failure modes that will erode this decision if not actively guarded against:

1. **Treating CMBs as generic chat messages** instead of typed cognitive memory with provenance.
2. **Letting executors author CMBs in MVP.** Out of scope. SGSD wrapper observes facts and emits `execution_receipt` CMBs on the executor's behalf. v3.1+ may revisit.
3. **Treating reviewer claims as observations.** Claim CMBs ≠ observation CMBs. The schema must enforce this via `created_by` role validation.
4. **Letting CAT7 replace the domain ontology** instead of wrapping it. CAT7 fields cite YAML anchors; they must not invent new authority terms.
5. **Allowing pseudo-operator to bypass hard operator carve-outs** under high confidence. Production / SAP / Mongo / Qdrant mutation always escalates regardless of confidence. Security/credential/policy-change always escalates. Below 0.70 confidence always escalates.
6. **Adding embeddings before deterministic evidence validation works.** Tier 0 (file/line/test/grep) and Tier 1 (heuristic) must demonstrate value before Tier 3 (embedding) is considered.
7. **Turning Mesh Memory Lite into a concurrent autonomous agent mesh.** Logical peers; sequential execution. Honest framing prevents claims we cannot back.
8. **Pulling in Pi / sym-mesh-channel dependencies** before local SGSD memory works. Both are optional experiment branches only. Pi is forbidden by operator constraint (Anthropic OAuth ToS). sym-mesh-channel propagation through Anthropic registry is still resolving (github.com/anthropics/claude-plugins-official/issues/1512 as of 2026-04-21).

## Hard carve-outs for operator escalation

These conditions force `real_operator_required: true` regardless of pseudo_operator confidence:

- Production mutation (any write to SAP, Mongo, Qdrant, Elasticsearch, customer-visible DB)
- Credential or security issue (any key/token/credential reference; any auth-bypass concern)
- Milestone scope change (introducing or removing a milestone-level commitment)
- Commercial / legal / policy implication
- Pseudo-operator confidence < 0.70 (regardless of context quality)
- Decision is destructive / not easily reversible

Pseudo-operator may decide autonomously (recommend auto-continue) only if ALL of the following are true:
- confidence ≥ 0.80
- authority_level within `allowed_for_decision_type`
- no production mutation
- no security/credential implication
- no milestone scope change
- no commercial/legal/policy implication
- decision is reversible or low-risk

Between 0.70 and 0.80 confidence, the board may decide with explicit rationale recorded. Above 0.80 (and all carve-outs clear), pseudo-operator may recommend auto-continue.

## MVP success tests (the four green fixtures)

DLB-08 has succeeded when these four fixtures all run green:

- **Fixture A (false-CRIT refutation):** ATC v22-13c-style false CRIT is refuted by evidence_validator against current HEAD and routes to `PASS_WITH_REFUTED_REVIEW` without waking the real operator.
- **Fixture B (context-aware pseudo-op):** Context-aware `decision_recommendation` CMB produced by pseudo_operator before any operator escalation; cites milestone context anchors + decision precedents.
- **Fixture C (lineage chain end-to-end):** Full lineage chain visible: `execution_receipt` → `review_finding` → `evidence_verdict` → `decision_recommendation` → `promotion_decision`.
- **Fixture D (restraint proof):** Production / SAP / Mongo / Qdrant destructive write scenario forces real operator escalation despite pseudo-op confidence ≥ 0.80. The duty officer knows when to pick up the red phone.

Fixture A is the load-bearing bug we are fixing. Fixture C is the existence proof of the layer. Fixture B is the operator-escalation reduction proof. Fixture D is the safety case — autonomy without restraint is unsafe.

## What this decision explicitly does NOT do

- It does not replace the YAML / MD canonical context (MILESTONE-CONTEXT.yaml etc. remain authoritative).
- It does not introduce a concurrent autonomous agent mesh (logical peers; sequential runtime).
- It does not author CMBs from executor outputs (executor contract unchanged; SGSD emits receipts on its behalf).
- It does not import Pi / sym-mesh / any third-party mesh transport into the critical path.
- It does not adopt full neural SVAF (Tier 3) in MVP; deterministic + heuristic only.
- It does not change how Codex is dispatched today (Codex Pro Mode lanes are DLB-09 work, separate decision).
- It does not give pseudo-operator authority over production mutation under any confidence level.

## Implementation sequence

DLB-08 spans four phases of v3.0:

- **P106** (this scaffold): CMB schema + canonical payload hashing + 7-class vocabulary + fixture contract.
- **P107**: SGSD-emitted execution_receipt + reviewer review_finding writer.
- **P108**: evidence_validator (Tier 0+1) + lineage DAG + echo detector. Wires into sgsd-audit@v2 Layer 4 as a CMB consumer.
- **P109**: pseudo_operator_peer (Tier 2 LLM judge) + escalation_gate with hard carve-outs.

After P109, fixtures A-D should all be runnable.

## Cross-references

- `.planning/milestones/v3.0/INTENT.md` — milestone strategic rationale
- `.planning/milestones/v3.0/ROADMAP.md` — phase mapping
- `.planning/milestones/v3.0/REQUIREMENTS.md` — REQ-MML / REQ-POL / REQ-CPM / REQ-CTX traceability
- `.planning/milestones/v3.0/phases/106-mesh-cmb-schema/106-CONTEXT.md` — schema contract (next)
- `.planning/decisions/DLB-07-semantic-vs-structural-verification.md` — predecessor; established evidence-backed-review principle
- `.planning/proposals/2026-05-20-sgsd-pro-mode-codex-context-authority-plan.md` — master SGSD-PRO proposal
- Pi2Pi meeting `81e85fd0-33c8-478d-924e-20e616440e81` (VTP) — operational pattern source
- `wiki/research/mesh-memory-protocol.md` (VTP, arXiv 2604.19540) — formal protocol source
- `super-gsd/skills/sgsd-audit/SKILL.md` — sgsd-audit@v2 (Layer 4 consumer of evidence_verdict CMBs from P108)
- `super-gsd/templates/plan-schema-v2.json` — v3.0 plans must validate against this per SCHEMA-09
