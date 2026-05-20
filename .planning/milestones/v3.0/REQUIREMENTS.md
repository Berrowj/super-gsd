# v3.0 SGSD-PRO — REQUIREMENTS

Source: synthesised from `.planning/proposals/2026-05-20-sgsd-pro-mode-codex-context-authority-plan.md` + DLB-08 + DLB-07 carry-forward. Each requirement maps to one or more phases (see `ROADMAP.md`).

Naming: `REQ-{family}-{NN}` where family ∈ { MML (Mesh Memory Lite), CPM (Codex Pro Mode), CTX (Context Authority), POL (Cross-cutting Policy) }.

---

## Family REQ-POL — Cross-cutting Policy (binding across every phase)

**REQ-POL-01** — Observation / claim / decision separation is binding.
SGSD must never treat a claim CMB as an observation CMB. CMB schema (P106) enforces this by `created_by` role validation and `type` enum.

**REQ-POL-02** — SGSD remains the central control plane.
Mission, phase boundaries, allowed_files, write authority, promotion, commit, rollback, real operator escalation are SGSD-owned. Mesh peers may deliberate; SGSD decides.

**REQ-POL-03** — Mesh-shaped memory, central-shaped runtime.
No concurrent autonomous mesh in MVP. Logical peers, sequential execution. Honesty framing for all docs.

**REQ-POL-04** — Hard carve-outs for operator escalation.
Production / SAP / Mongo / Qdrant destructive writes always escalate to real operator regardless of pseudo-op confidence. Credential or security issues always escalate. Milestone scope change always escalates. Commercial/legal/policy implications always escalate. Pseudo-op confidence < 0.70 always escalates. P109 escalation gate enforces.

**REQ-POL-05** — No Pi-harness dependency.
At any layer. Anthropic OAuth ToS forbids it. Operator-level constraint.

**REQ-POL-06** — No sym-mesh-channel dependency in critical path.
Optional experiment branch only. Anthropic plugin propagation still resolving.

**REQ-POL-07** — Every v3.0 PLAN.md validates against plan-schema-v2.
SCHEMA-09 / SCHEMA-10 (from P97.5) reject plans without `semantic_acceptance_criteria`. v3.0 eats its own dog food.

**REQ-POL-08** — No executor-authored CMBs in MVP.
Codex executor's report contract is unchanged. SGSD wrapper observes facts and emits `execution_receipt` CMBs. v3.1+ may revisit.

---

## Family REQ-MML — Mesh Memory Lite (DLB-08; phases 106-109)

**REQ-MML-01** — Seven typed CMB classes, no more, no fewer in MVP.
`execution_receipt` (obs) · `review_finding` (claim) · `evidence_verdict` (claim-with-authority) · `decision_recommendation` (decision) · `operator_precedent` (decision, highest authority) · `context_anchor` (projection of YAML/MD canonical source) · `promotion_decision` (decision, terminal).

**REQ-MML-02** — CAT7 envelope is universal.
Every CMB has `cat7: { focus, issue, intent, motivation, commitment, perspective, mood }`. Fixed seven fields; richness in field text; mood field carries optional `valence`/`arousal` floats.

**REQ-MML-03** — Canonical payload hash excludes `created_at`.
`content_hash = sha256(JSON.stringify({ type, created_by, role, milestone_id, phase_id, cat7, body, lineage.parents, authority_level, evidence_refs }))` with sorted keys. Changing `created_at` does NOT change content_hash (echo detection by content). Changing any field in the hash list DOES change content_hash.

**REQ-MML-04** — Lineage as parents + ancestors of content_hash keys.
Every remixed/derived CMB carries `lineage.parents` (direct provenance) and `lineage.ancestors` (transitive closure). Maximum ancestor depth bounded at 50 (matches MMP §15.2 bound).

**REQ-MML-05** — Echo detection is O(1) ancestor-set intersection.
`echoDetected(cin) ↔ ancestors(cin) ∩ Kself ≠ ∅` where `Kself` is the receiver's own produced CMB key set. Detection result is itself recorded as a flag on the receiving CMB; not silently dropped.

**REQ-MML-06** — Write-time filtering invariant (remix).
When a CMB is admitted, the receiver persists a new CMB expressing its own role-filtered understanding with `lineage.parents` pointing to the source. Each role's persisted memory contains only its own remixes; raw peer CMBs are addressable by content_hash across the mesh but not duplicated locally.

**REQ-MML-07** — Four admission states.
Per-claim evaluation result is one of: `REDUNDANT` / `ALIGNED` / `GUARDED` / `REJECTED`. Map to SGSD gate behaviour: ALIGNED verified CRIT → block; GUARDED CRIT → dispute lane; REJECTED CRIT → `PASS_WITH_REFUTED_REVIEW`; REDUNDANT → no action.

**REQ-MML-08** — Evidence validator is Tier 0 + Tier 1 only in MVP.
Tier 0 deterministic: file exists, line exists, grep match, test passed, schema validates. Tier 1 structured heuristic: claim type, severity, changed-file overlap, lineage to prior finding. Tier 2 LLM judge is reserved for pseudo_operator only. Tier 3 embedding/SVAF is v3.1+ work.

**REQ-MML-09** — `execution_receipt` CMBs are SGSD-emitted from observable facts.
Required fields: `commit_before`, `commit_after`, `changed_files`, `tests_run[].command`, `tests_run[].result`, `tests_run[].count`, `report_path`, `report_hash` (sha256 of executor's report text), `acceptance_criteria_touched`. `created_by` must be `sgsd` or `sgsd-wrapper`; agent roles are rejected.

**REQ-MML-10** — `review_finding` CMBs carry structured evidence references.
Required fields: `severity` (CRIT|WARN|INFO), `claim` (text), `current_commit` (git rev), `file_path` (optional but recommended), `line_start` / `line_end` (optional), `quoted_excerpt` (optional), `violated_invariant`, `reproducer_command` (optional), `confidence` (0-1). Without `file_path` + line refs the claim defaults to `UNVERIFIED` admission state.

**REQ-MML-11** — `evidence_verdict` CMBs classify each finding.
For every `review_finding`, validator produces `evidence_verdict` with `evidence_status ∈ { VERIFIED_CRIT, REFUTED_CRIT, STALE_CRIT, UNVERIFIED_CRIT, GUARDED_CRIT }` + `refuting_evidence[]` (file:line refs that contradict, if any) + `tests_refuting[]` (test names if tests prove claim wrong). Lineage parent = the review_finding's content_hash.

**REQ-MML-12** — Promotion gate honours admission state.
`promotion_decision` may be `PASS` only if no `evidence_verdict` row has `evidence_status = VERIFIED_CRIT`. Status `REFUTED_CRIT` does not block; status `STALE_CRIT` does not block; status `UNVERIFIED_CRIT` blocks unless explicitly routed through dispute lane and operator-approved.

**REQ-MML-13** — `decision_recommendation` CMBs include authority + confidence + carve-out check.
Required fields: `recommendation` (text), `authority_level` (1-3), `confidence` (0-1), `real_operator_required` (bool), `context_pack_id`, `evidence_refs[]`, `carve_outs_triggered[]` (which hard carve-outs from REQ-POL-04 fired, if any). If any carve-out fired, `real_operator_required` is forced true regardless of confidence.

**REQ-MML-14** — `operator_precedent` CMBs are highest authority.
Real operator decisions persist as operator_precedent CMBs with `authority_level: "highest"`. Subsequent pseudo-operator recommendations may cite them as evidence. Precedents may be superseded by later precedents (lineage parent reference); never silently overwritten.

**REQ-MML-15** — `context_anchor` CMBs are projections, not authority.
Required fields: `canonical_source_path`, `canonical_source_hash` (sha256 of source file), `projection_summary` (text). Body must match what the canonical source actually says at the recorded hash. If `canonical_source_hash` no longer matches the file's current sha256, the anchor is `stale` and must be re-projected before use.

**REQ-MML-16** — Reliability ledger append on every refuted CRIT.
`.planning/metrics/atc-reviewer-reliability.jsonl` gets one row per `REFUTED_CRIT` outcome, with reviewer profile + claim type + refuting evidence. Quarantine policy: same reviewer profile producing same-class refuted CRIT twice in one milestone → flag for review (no auto-disable).

---

## Family REQ-CPM — Codex Pro Mode (DLB-09; phases 110-111)

**REQ-CPM-01** — Ten typed Codex profiles.
`codex.readonly.audit` · `codex.plan` · `codex.goal` · `codex.execute.bounded` · `codex.execute.patch` · `codex.review.native` · `codex.review.swarm` · `codex.cockpit.brief` · `codex.app_lab` · `codex.cloud_lab`. Each profile declares its sandbox, approval mode, allowed_write_roots, max_changed_files, native_review_required, hooks_required.

**REQ-CPM-02** — Stoplight routing before any write permission.
GREEN (bounded executor) · AMBER (goal lane or app-lab) · RED (no execution; route to board/operator). Criteria per SGSD-PRO §4.2.

**REQ-CPM-03** — Native Codex review as first-class gate.
Native review runs BEFORE SGSD ATC for source-changing work. Native review emits `review_finding` CMBs (from REQ-MML-10). ATC then runs on top.

**REQ-CPM-04** — PLAN-LOCKED.md as the formal lock.
No source mutation without PLAN-LOCKED.md. PLAN-LOCKED.md must include: objective, non-goals, allowed_files, forbidden_files, invariants, acceptance_commands, rollback_plan, expected_artifacts, risk_rating, goal_lane_eligibility, operator_checkpoints.

**REQ-CPM-05** — Codex hooks for deterministic safety rails.
`.codex/hooks.json` with: `block-forbidden-write`, `block-secret-leak`, `enforce-allowed-files`, `validate-stop-contract`, `log-tool-event`. Mandatory for `codex.execute.*` and `codex.goal` profiles.

**REQ-CPM-06** — Goal lane is opt-in, never default.
`/goal` only enabled with: durable bounded objective + explicit validation commands + explicit stop conditions + allowed_roots + risk_rating ≤ medium + temp_worktree available + checkpoint/report output required. AMBER stoplight pathway only.

---

## Family REQ-CTX — Context Authority (DLB-10; phase 112)

**REQ-CTX-01** — Per-milestone context capsule.
Every milestone gains: `MILESTONE-CONTEXT.yaml` · `PERSONA-MATRIX.yaml` · `DOMAIN-ONTOLOGY.yaml` · `LEXICON.yaml` · `SOURCE-OF-TRUTH.yaml` · `NON-GOALS.yaml`. Stored under `.planning/milestones/{milestone}/context/`.

**REQ-CTX-02** — Canonical truth in YAML, projection in CMB.
The YAML/MD files are canonical. `context_anchor` CMBs (REQ-MML-15) project them into the mesh for retrieval by pseudo-operator. `canonical_source_hash` keeps projections in sync with source.

**REQ-CTX-03** — Persona matrix expresses role-anchor priors.
Per-persona `cares_about` / `does_not_want` / `search_bias.include` / `search_bias.suppress` fields. These become role-anchor priors for pseudo_operator's Tier 2 LLM judge — NOT learned weights, hand-coded priors that operator may tune.

**REQ-CTX-04** — Operator escalation requires context pack.
Escalation gate (REQ-MML-13 + carve-out checks) blocks operator escalation unless: context pack ID is present + pseudo-operator recommendation was produced + reason real operator is required is explicit + choices array is populated with consequences. Emergency override available for security/credential/production scenarios only.

**REQ-CTX-05** — Decision precedents append-only.
Real operator decisions persist as `operator_precedent` CMBs (REQ-MML-14). `.planning/memory/DECISION-PRECEDENTS.jsonl` is the persistent index. Precedents may be superseded by later precedents; never silently overwritten.

---

## Coverage Matrix

| Phase | Requirements satisfied |
|---:|---|
| 106 | REQ-MML-01, -02, -03 (schema only; no implementation) + REQ-POL-01, -07 |
| 107 | REQ-MML-09, -10 + REQ-POL-08 |
| 108 | REQ-MML-04, -05, -07, -08, -11, -12, -16 + REQ-POL-04 (carve-outs surfaced) |
| 109 | REQ-MML-06, -13, -14 + REQ-POL-04 (carve-outs enforced) |
| 110 | REQ-CPM-01, -02, -03 |
| 111 | REQ-CPM-04, -05, -06 |
| 112 | REQ-CTX-01, -02, -03, -04, -05 + REQ-MML-15 |

Cross-cutting REQ-POL-01 through REQ-POL-08 are binding on every phase.
