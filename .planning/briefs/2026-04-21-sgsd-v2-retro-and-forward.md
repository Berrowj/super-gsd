# Brief: SGSD v2 Retro + Forward — Post-Phase-E Deliberation

*(Child brief. Parent: `.planning/briefs/2026-04-21-orchestrator-contract.md` (37.7 KB, Q1-Q8). Parent remains undeliberated — no DLB-07 memo exists. This brief narrows the board to decisions that actually need judgment given what Phase A-E already shipped.)*

## Situation

Between 2026-04-21 12:30 and 15:00 UTC, five phases of the SGSD v2 governance contract landed as direct commits on master:

| Phase | Commit | Scope |
|-------|--------|-------|
| A | `d1ba19e` | Registry scaffold (8 YAML files) + 652-line migration manifest |
| B | — | No commit in log — either folded or pending |
| C | `68c0fa6` | 8 specialized `sgsd-exec-*` agents + expertise files (~1,713 lines) |
| D | `35d7d47` | Heartbeat + orchestrator-pulse wiring; activity-logger dedup |
| E1+E2 | `bd88204` | SGSD-v2 statusline (212 lines) |
| E3+E4 | `9fa44ac` | Mission-control SGSD-V2 tile + growth-curve sparkline |

No phase/milestone container was opened. No `/sgsd-deliberate` was invoked on the parent brief before execution. The work landed outside the GSD phase state machine (STATE.md shows `milestone_complete: v1.1` since 2026-04-19).

**Implementation-to-brief mapping** (what the parent's questions look like today):

| Parent Question | Status | Evidence |
|-----------------|--------|----------|
| Q1 heartbeat primitive | Partial — hooks wired, prober/classifier absent | Phase D |
| Q4 skip-drift enforcement | Partial — activity-log dedup only, edge-guard unbuilt | Phase D |
| Q5 resource protocol | Shipped at **8 registries** (brief asked for 3: hooks/decisions/gates) | Phase A |
| Q8a-d visibility + executor naming | Shipped end-to-end | Phase C, E1-E4 |
| Q2 gate policy (keep/kill/conditional) | Untouched — blocked on Phase 147 retroactive ATC evidence | — |
| Q3 plan schema v2 (YAML frontmatter + fields) | Untouched | — |
| Q6a-d orchestrator sharpenings | Untouched | — |
| Q7a-g deliberate-skill sharpenings | Untouched | — |

Parent brief's Termination declares `q1_impl_hours: 23, q1_revertable: false` — clearly over DELIBERATION-FLOOR. So the brief trips the FLOOR; but operator executed Phase A-E as if only the individual Q8 (FLOOR-executable) sub-questions trip.

## Stakes

**Retro stakes:** Phase A-E's implementations are already in master. If wrong, fixing is 5-commit revert + cascade through registries (effectively expensive, not catastrophic). Wrong shape *now* compounds through every future Q2/Q3/Q6/Q7 decision that builds on them.

**Governance stakes:** Five phases shipped without deliberation on a brief that self-declares `q1_revertable: false` is the exact pattern DLB-06's DELIBERATION-FLOOR was added to prevent. Either (a) the FLOOR was calibrated wrong (too permissive at "FLOOR-executable sub-question" grain), (b) the operator drifted around it, or (c) the brief's own split of FLOOR vs non-FLOOR sub-questions was a legitimate pre-authorization. Board must rule.

**Forward stakes:** Remaining Q2/Q3/Q6/Q7 cover ~10.5h of undeliberated work. Doing them all in one deliberation hits parent brief's `max_tokens: 200000` and exhausts board attention. Need prioritization and sequencing for v1.2, OR a split into contract-layer vs machinery-layer releases.

## Constraints

- **Do not re-deliberate Q2/Q3/Q6/Q7 substantively here.** Those are the parent brief's scope. This brief only (a) retros what shipped, (b) scopes+sequences what's left.
- **Retro of shipped phases is revertable in principle.** Git revert works; registry cascade is expensive. Treat as "keep unless board says stop."
- **Phase 147 retroactive ATC evidence status: unknown.** Parent brief's Constraint #2 stands — if absent, Q2-related sequencing stays provisional.
- **DLB-06 DELIBERATION-FLOOR applies to this brief too.** Est. `q1_impl_hours: 0` (retro+scope, no new build), `q1_revertable: true` — trips FLOOR on revertability alone. Board should verify this brief itself is legitimate to deliberate vs FLOOR-executable.
- **Parent brief's invariants cascade.** DLB-02 evidence-before-machinery, DLB-03 structural-over-theatrical, DLB-06 unattended-run-reliability all bind.

## Key Questions

### RQ1 — 8-executor partition (Phase C retro)

R-Q8a proposed 8 `sgsd-exec-*` agents. Phase C shipped exactly 8: `backend`, `ui`, `test`, `refactor`, `fix`, `config`, `docs`, `integration`. No adversarial challenge before shipping — research-grounded directly from parent brief.

**Options:**
- RQ1a: Keep 8 as-is (status quo).
- RQ1b: Collapse to 5 — fold `refactor`→`fix`, `integration`→`backend`. Rationale: lower registry surface, less expertise-file maintenance, likely <10% dispatch share for merged variants.
- RQ1c: Expand to 12 — split `fix`→{hotfix, systemic}, `config`→{ci, infra, env}. Rationale: finer-grained routing, better token targeting.

**Board question:** Does any current executor have (a) expected <10% dispatch share over the next milestone, or (b) >60% expertise-file overlap with another executor? If yes to either for ≥2 executors, consolidate. Otherwise keep.

### RQ2 — Resource protocol scope creep (Phase A retro)

R-Q5 proposed 3 registries (`hooks`, `decisions`, `gates`). Phase A shipped **8 files** under `super-gsd/registry/`:
- Registries (6): `agents.yaml`, `board-members.yaml`, `decisions.yaml`, `gates.yaml`, `handover-contract-v2.yaml`, `hooks.yaml`
- Scaffolding (2): `SGSD-v2-MIGRATION-MANIFEST.md`, `expertise/_template.md`

That's 2x the brief's registry scope. AGP-P-02 ("treat all system components as first-class versioned resources") principles the expansion — `board-members` and `agents` ARE resources. So the expansion is principled. But it's also unreviewed.

**Options:**
- RQ2a: Accept as principled execution within the AGP umbrella the brief authorized. Close with noted expansion in DLB-07.
- RQ2b: Flag as governance drift — registries beyond the brief's 3 need parent-brief amendment + DLB-07 re-pass before the 5 extras are considered authoritative.
- RQ2c: Keep all 6 registries but formally retire 2 that were under-justified (`handover-contract-v2`, `_template`) back to `super-gsd/templates/` where non-registered scaffolding lives.

**Board question:** Is R-Q5's "3 registries" a ceiling or an illustrative subset? AGP says "all components are resources" — that reads as a floor, not a ceiling. Rule one way.

### RQ3 — FLOOR-executable-inside-a-FLOOR-tripping-brief (process retro)

The core governance question. Parent brief's Termination: `q1_revertable: false`, `q1_impl_hours: 23` — trips FLOOR unambiguously. Operator executed Phase A-E (touching Q1/Q4/Q5/Q8) inline, citing that those sub-questions individually were FLOOR-executable per the brief.

**The defense:** parent brief explicitly said Q8a-d were FLOOR-executable (line 331: "All four sub-questions are FLOOR-executable (< 2h each, revertable). Listed here so the board is aware they exist; decide inline or delegate to operator.") And R-Q5 Phase A was explicitly scaffold-first (AGP-P-05 boot-time discovery) so the registries had to land before anything read them.

**The prosecution:** when a brief self-declares `q1_revertable: false`, its sub-questions inherit that non-revertability because they cascade. Q5 (3 registries) cascaded into 8 registries — now every future Q6/Q7 decision references registry state that wasn't board-approved. The per-sub-question FLOOR ruling is circumvented by cascade.

**Options:**
- RQ3a: Legitimate split. Brief-level FLOOR binds only non-FLOOR sub-questions. Precedent for future briefs.
- RQ3b: Circumvention. A brief that trips FLOOR at the brief level binds ALL sub-questions including FLOOR-executable ones. Operator should have deliberated parent brief before any Phase shipped. Parent brief needs retroactive DLB-07 synthesis covering Q1/Q4/Q5/Q8 as-shipped.
- RQ3c: Structural repair. Amend `DELIBERATION-FLOOR.md` to add "brief-level FLOOR override" rule — any brief declaring `q1_revertable: false` promotes all its sub-questions to board-required regardless of individual FLOOR scores.

**Board question:** Which reading preserves DLB-06's intent without making every two-line visibility change a 200k-token board event?

### RQ4 — v1.2 scope and sequencing (forward)

Assuming RQ1-RQ3 resolve without forcing a re-do, remaining parent-brief questions are Q2 (gate policy), Q3 (plan schema v2), Q6a-d (orchestrator sharpenings), Q7a-g (deliberate-skill sharpenings).

Cost estimates from parent brief: Q2 ~2h, Q3 ~3.5h, Q6 ~2h, Q7 ~3h = ~10.5h total.

**Sequencing options:**
- **v1.2-A: Schema-first.** Q3 schema v2 → Q6a (classifier skip becomes free) → Q6b (dispatch auto-detect from schema) → Q2 → Q7. Rationale: Q3 unblocks the most downstream wins.
- **v1.2-B: Evidence-first.** Pull Phase 147 retroactive ATC forward → Q2 gate policy → Q3 → Q6 → Q7. Rationale: can't decide gates without the evidence the parent brief flagged as blocking.
- **v1.2-C: Governance-first.** Q7 (deliberate-skill mechanisms — R-Q7b confidence weighting, R-Q7e scoring loop) → Q2 → Q3 → Q6. Rationale: R-Q7e scoring loop retrains the classifier that every other decision depends on; highest compound leverage.
- **v1.2-D: Two-release split.** Contract-layer v1.2.0 = Q2+Q3 (4 weeks, schema + gates). Machinery-layer v1.2.1 = Q6+Q7 (separate pass, decoupled). Reduces deliberation surface per release.

**Board question:** Which sequencing minimizes rework given the registry state that already shipped? Does any ordering force a re-do of Phase A/C/D/E registries?

## Termination

phases_affected: 3
max_rounds: 2
max_tokens: 120000
max_minutes: 20
q1_impl_hours: 0
q1_revertable: true
gate_score: pending

<!-- phases_affected=3: sgsd-orchestrate skill, sgsd-deliberate skill, super-gsd/registry/*.
     q1_impl_hours=0: this brief is retro+scope+sequencing; no new-build in Q1.
     q1_revertable=true: decisions are process/sequencing; reversible via memo amendment.
     Trips FLOOR on revertability only — board verdict legitimate. 2 rounds should suffice:
     Round 1 surfaces retro positions (RQ1/RQ2/RQ3) + forward options (RQ4).
     Round 2 synthesizes + handles RQ3 dissent (likely axis — Architect vs Contrarian
     on governance).
     max_tokens=120k (vs parent's 200k) reflects narrower scope.
-->
