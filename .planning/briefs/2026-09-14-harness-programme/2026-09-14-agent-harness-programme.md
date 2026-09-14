---
type: brief
date: 2026-09-14
slug: agent-harness-programme
domain: agent-orchestration / harness-engineering / clarity-platform / vtp-knowledge
status: ready-for-deliberation
sources: VTP library (24 thinking and design books ingested 2026-09-13, 20 agent and harness papers), Agentic Engineering at Scale (O'Reilly early release), SGSD registries, Clarity error register and failure-class memory
findings_dir: .planning/briefs/2026-09-14-agent-harness-programme/
---

# Brief: Agent Harness Programme for Clarity

## Situation

Clarity is built largely by coding agents under SGSD: Claude orchestrates, Codex executors write code, and a registry of 34 harness components in 14 classes, a gates registry, 14 hooks and the `clarity-cp` control plane govern the loop (Plan, Dispatch, Work, Verify, Deploy, Observe). Almost all of that machinery acts before generation. It supplies context and constraints (Guides and Guards in Chris Ford's taxonomy from *Agentic Engineering at Scale*) and very little of it reads the world back afterwards (Sensors and Checks).

The recorded incidents are all feedback failures. Codex exit codes 4, 8, 127 and 5 and zero-byte reports have been logged against fully delivered work, and a waiter watching for an exit file a dead runner could never write cost 8.5 hours overnight (FC1, FC7). An unauthenticated MCP server on :3020 was recorded as fixed for three days while the fix sat on a branch the containers never compose from (FC2, FC3). A visual parity gate stayed green on a frozen fixture while real meetings rendered as overlapping labels (FC4). An 11-hour backfill was destroyed twice by a redeploy (FC10). The Clarity error register carries the same shape at the data layer: five of nine bugs in one overnight session were silent 200s with empty data (ERR-0022 an invalid `$select` field returns `{"value":[]}`, ERR-0031 a missing Postgres table returns an empty array, ERR-0024 a Service Layer PATCH on nested collections silently no-ops, ERR-0025 two independent sync writers wipe `DocumentSpecialLines` every 60 seconds).

On 2026-09-13 the VTP library grew by 24 books on how people think (metacognition, critical and probabilistic thinking, dialectical and analogical thinking, first principles, design thinking, coaching) and 20 papers on agent harnesses and mechanisms (Meta-Harness, Continual Harness, Prime Agent, AHE, Harness Handbook, Shift-Up, LLM-judge-not-oracle, SWE-Gate, Reflexion, Self-Refine, MemGPT, DSPy, GEPA, Darwin Gödel Machine, Voyager, Recursive LMs, InterCode, ReAct, CoT, WebGPT). Six research passes over that material produced 60 findings, each tied to principle ids, an evidence grade and a `vtp_query` for further mapping. They are the appendices of this brief.

## Stakes

Getting this right turns the loop from one that trusts self-reports into one that measures delivery: every dispatch verified on disk and in the running container, every gate carrying its own false-pass and false-fail rates, every dynamic business quantity refusing to be a stored scalar, and every harness edit shipped as a falsifiable prediction. The cost of the recorded incidents so far is measured in days (3 days of a believed-fixed security hole, 8.5 hours in one wedge, an 11-hour job lost twice) and in trust: a fixture-green gate that hides an unreadable page teaches the operator to stop believing green.

Getting it wrong means adding more Guides and Guards, which is the reflex. Continual Harness measured 335 scaffolding routines created, 53 ever invoked and 14 ever successful; RAMP found 73.8 percent of committed AI configuration files are never modified again. A harness that grows on the feedforward side while the feedback side stays empty spends tokens on context that decays at half a window (AES-P-07) and changes no outcome (FOM-P-03: a control that changes no prediction is not a control).

Timing: the sensing floor (HS-01, HS-02, HS-17) is cheap, touches only the dispatch wrapper, `clarity-cp` and the data probes, and pays back on the next unattended run. The specification changes (HS-03, HS-07) alter `plan-schema-v2.json` and the idea gate and are GATE tier under SGSD's own table.

## Constraints

- SGSD is the only orchestration loop; every harness attaches to an existing station and an existing component. No second control plane, no new dashboard, no generic agent memory (the R&D board test applies: does an existing engine already do 80 percent of this).
- `clarity-cp` is the deploy authority and the live stack composes from `~/clarity-deploy` on devcp, not from the repository. Any deploy-side sensor reads the container, never the diff.
- The CoVe verifier never reads live SAP, Mongo or Clarity (operator decision 2026-08-12). Sensors that read live state are separate components with their own read paths.
- Canonical stores are `~/.vtp` (meetings, graph, ledgers, idea developments) with `kb-data` as a generated mirror; a mirror-only write is a silent no-op today (FC6). Any harness that writes state writes to the canonical path.
- Premium-model work (enrichment, review, diagnosis) runs as in-session subagents, not standalone scripts (Max OAuth returns 429 to standalone Sonnet and Opus calls). Codex executors cannot run vitest under the current spawn rules; test gates run from the orchestrator.
- Frozen contracts (`src/contracts/*`, the CoVe enums, MCP tool schemas) may only widen through an explicit amendment record.
- Communication rules apply to generated artefacts: no emoji, no em dashes, headings summarise their content.
- The taxonomy is fixed vocabulary for this programme: Guide (descriptive, feedforward), Guard (normative, feedforward), Sensor (descriptive, feedback), Check (normative, feedback), Hybrid (a named pair across quadrants).

## Key Questions

1. **Sensing first or specification first.** The evidence for sensing (MH-05, MH-06, LD-03, LA-06, MA-01) is measured and the recorded incidents are all sensing failures; the evidence for decision specs (MH-02, AES-P-02) is argued. Should phases 1 and 2 ship HS-01, HS-02, HS-17, HS-05 and HS-06 before any plan-schema change, or does HS-03 belong in phase 1 because it changes what every later sensor measures against?
2. **Where the verifier boundary sits.** MA-01 and LB-01 require the judge to be a separate dispatch that never sees the executor's report; LA-06 requires the self-check to run in a fresh window. Given Codex cannot run vitest and the orchestrator must, is the judge a Codex dispatch given only criteria plus diff, a Claude subagent, or the orchestrator itself, and what does each cost per phase?
3. **Dynamic-quantity register scope.** HS-07 can be enforced at plan and idea-gate level only (a `derived_from` expression per numeric field) or pushed into the EF Core and Mongo schemas (model, window, spread, origin token per registered field). Which level for phase 1, and which quantities are registered first (lead times, prices, hours, capacity, coverage days)?
4. **Interlock scope and override policy.** HS-09 intercepts destructive commands against post-acceptance artefacts (`docker compose down -v`, `rm -rf`, redeploy over a registered job). Which command classes, which override token, and does the override require a second party (LD-08: every named owner needs a distinct action)?
5. **Shared versus Clarity-local.** Which harnesses live in `super-gsd` (dispatch wrapper, gate ordering, calibration store, harness manifest) and which in `project-clarity-erp` (SAP semantics guides, data-path silence sensors, route presence checks, the design persona)? The registry class vocabulary in `harness-components.yaml` has 14 classes; do Sensors need a class of their own?
6. **Gate measurement and labelling.** MA-02 and LA-01 need every gate to report false-pass and false-fail rates from labelled overturns. Who labels an overturn (operator, verifier dispatch, both), where does the label live (`gate-evidence.jsonl`), and what is the auto-accept threshold policy while the history is short?
7. **The deletion probe.** LA-05 and LB-06 say a control that changes no outcome is struck. Which existing controls fail the probe today (MCP_API_KEY is one), and is the probe run once as an audit or scheduled?

## Additional Context

- Prior page: `reports/architecture/2026-09-14-clarity-agent-harness-map.md` in Voice-Text-Plan (the ten-harness map this brief expands).
- Findings (raw record, keep whole, MH-09): `.planning/briefs/2026-09-14-agent-harness-programme/lens-A.md` (metacognition and coaching, LA-01 to LA-09), `lens-B1.md` (critical, probabilistic, problem solving, first principles, LB-01 to LB-09), `lens-B2.md` (dialectical, analogical, philosophy, LD-01 to LD-08), `lens-C.md` (design thinking, emotion, scaffolds, data-science agent, LC-01 to LC-08), `mech-D1.md` (harness engineering, MH-01 to MH-14), `mech-D2.md` (agent mechanisms, MA-01 to MA-12).
- SGSD components referenced: `super-gsd/registry/harness-components.yaml`, `gates.yaml`, `hooks.yaml`, `codex-profiles.yaml`, `super-gsd/scripts/codex-executor.sh`, `super-gsd/templates/plan-schema-v2.json`, `super-gsd/control-plane/` (clarity-cp), `.planning/metrics/gate-evidence.jsonl`, `.planning/metrics/codex-log.jsonl`.
- Clarity references: `.planning/knowledge/data/anti-patterns.md` (ERR register), `.planning/knowledge/data/how-to-add-a-pipeline-stage.md` (RecordCountReconciler, P9 provenance, sequential SAP reads), `.planning/ANNOYING-FIXES.md` (AF-001), `.planning/RETROSPECTIVE.md` (recurring issues), `.planning/tools/browser-audit/`.
- Memory entries: Codex exit codes lie, waiter exit-file hole, Clarity deploy stranding, Clarity MCP no auth, parity fixture blind spot, static-for-dynamic gate, CoVe milestone state, idea-dev two-copy trap, JCL kit zero-price margin.
- Related decisions: DLB-03 (phase close gate), DLB-15 (commits to project-clarity-erp cannot reach containers), DELIBERATION-FLOOR (DLB-06).

## Termination

phases_affected: 6
max_rounds: 3
max_tokens: 120000
max_minutes: 20
q1_impl_hours: 12
q1_revertable: true
gate_score: pending

<!-- phases_affected counts the five build phases in Appendix F plus the registry change in Q5.
     q1_impl_hours is the phase-1 sensing floor (HS-01, HS-02, HS-17) only; the programme as a
     whole exceeds the DELIBERATION-FLOOR and must be deliberated. -->

---

# Appendix A. Orchestrator instructions: how SGSD consumes this brief and uses VTP

1. Run `/sgsd-deliberate` on this brief. The board answers the seven Key Questions and produces the Decision Memo (`super-gsd/templates/decision-memo.md`). The Researcher seat must ground every stance in the findings files, not in this summary, and must cite finding ids (LA-, LB-, LD-, LC-, MH-, MA-) and principle ids.
2. Every finding carries a `vtp_query` line. Researchers and the `sgsd-vtp-enrichment` sub-agent (orchestrator step 6.b.5) extend the mapping by running those queries and the ones in Appendix E, using:
   - `vtp_search_book_passages(query, principles=[...])` for a book principle (the `principles` filter is a keyword payload on Qdrant `book_passages`; all 84 books are tagged),
   - `vtp_search_research_passages(query)` for a paper (`research_passages`, 116 papers),
   - `vtp_route_and_retrieve(question)` when the subject is mixed, then targeted calls,
   - `vtp_get_document(path)` to read a `wiki/books/<slug>.enrichment.json` or `.profile.json` whole (the `frameworks` and `tensions` arrays are the richest material),
   - `vtp_advise_service_enrichment` before proposing any change to an existing SGSD component.
   Books and papers are lenses. They are never authority for live SAP, Mongo or Clarity state; a claim about live state needs a probe.
3. When planning a phase (`/gsd-plan-phase`), every task that implements a harness cites its HS id and at least one finding id, and its acceptance criteria are the ones listed under that HS in Appendix E, each with its `verifiable_by` observable. A criterion with no observable is not admissible (MA-02).
4. Extension rule for the mapping: a new harness proposal is admissible only with (a) the quadrant it fills, (b) the failure class or ERR entry it addresses, (c) the component it extends, (d) what it rules out (LD-04), and (e) the deletion account, what happens when it is removed (LA-05). Proposals that add a Guide where a Sensor is missing are returned.
5. Keep this brief and the findings files whole. Summaries of the record score worse than the record (MH-09: full traces 50.0, scores plus summaries 34.6). Add new findings as new files in the findings directory with the same schema; do not rewrite existing ones.

# Appendix B. Thinking lenses from the VTP library and what each changes about harness design

Each lens family is a way of thinking drawn from the 2026-09-13 books; the right column is the design move it forces. Ids point into the findings files.

| Lens family (books) | The way of thinking | What it changes about harnesses | Findings |
|---|---|---|---|
| Metacognition (Foundations of Metacognition; Metacognition: Process, Function and Use; Social Metacognition; Metacognition in Language Learning; Nakamura and Lau) | Monitoring and control are separate channels; confidence tracks consensus and fluency, not correctness; calibration is a slow outer loop over a fast inner one | The calibration store lives outside the run it scores; agreement is never the sole acceptance signal; a pre-filled plausible value destroys the honest report of not knowing; origin is stamped at production; a saturated run cannot self-monitor; prohibitions rebound, re-presenting the clean input does not | LA-01 to LA-09 |
| Critical and probabilistic thinking (Your Deceptive Mind; Critical Thinking Skills; Don't Be Stupid; Probabilistic Thinking; Why Can't You Just Give Me The Number; Problem Solving; First Principles Thinking) | Blind the measurer; fix criteria before evidence; base rates decide what a positive means; a quantity is a distribution and its model, not a scalar; constraints are physical, economic or conventional; anchoring is corrected from outside | The verifier is never shown the executor's report; acceptance criteria and frozen enums are hashed at plan lock; gates declare prevalence and share-real; dynamic quantities carry a model, a window and a spread or are not stored; parallel waves close on the joint outcome; an outside watcher owns wall-clock and spend ceilings | LB-01 to LB-09 |
| Dialectical, analogical and philosophical thinking (Dialectical Thinking; Necessary Unity of Opposites; Harris; Analogical Thinking; Fatal Strategies; Thinking Machines) | Triage what observation would settle a dispute; refute from the opponent's own rule; no loop takes feedback from something that cannot refuse; the account decides and the running system is evidence; corroboration is varied interlocking evidence; an analogy carries one property and declares what it does not claim; size a control by the harm it can instantiate | Defender DEFENCE block plus challenger check per FULL or GATE dispatch; gates declare what they rule out and must fail once before admission; the inverted-category second pass with a fixed pass count; transfer cards for borrowed patterns; findings stored as events with a moment and witnessed by a second surface; destructive controls require a flag and read a job lock | LD-01 to LD-08 |
| Design thinking, emotion and scaffolds (Design Thinking for Engineering; For Dummies; Playbook; Interdisciplinary Design Thinking; Designing for Emotion; Navigating the Common Core; Data Science Super Agent) | A prototype answers one named question with its falsifier fixed first; vertical and horizontal fidelity answer different questions; calibrate the observer before observing; every scaffold states how it comes off; matched Yes and No pairs teach a boundary a definition cannot; describe and refuse before estimating | Prototype cards for spikes; the visual gate declares its axis and a vertical gate runs on live records; expectation records before diagnostic probes; removal signals on every CLAUDE.md entry; SAP data boundaries taught as matched pairs; dataset cards per read model; a design persona with ground rules for user-facing text | LC-01 to LC-08 |

Two cross-cutting positions the lenses converge on, and which the papers then measure:

- **The self-report is a claim, never the check.** Metacognition (LA-06), critical thinking (LB-01), dialectics (LD-03) and the papers (MA-01, MH-05, MH-06) all arrive at the same structure: acceptance reads an artefact the runner did not author.
- **A gate proves something only where it can fail.** Harris on corroboration (LD-05), Perner on necessity (LA-05), Nakamura and Lau on the absent confusable class (LA-02) and Meta-Harness on saturated benchmarks (MH-10) agree that a fixture-green gate has measured a frequency, not a connection.

# Appendix C. Harness archetypes by Clarity subject, with the hybrids

Rows are the Clarity subject areas; columns are the four quadrants. Each cell names the archetype and the findings that justify it. Hybrids follow the table.

| Subject | Guide | Guard | Sensor | Check |
|---|---|---|---|---|
| SAP-DATA | base-rate cards (LB-03), matched Yes/No pairs (LC-06), dataset cards per object family (LC-08), quote-before-claim (MA-10) | dynamic-quantity register (LB-04, MA-11), origin token required for semantic claims (LA-04), method-named-first (LB-09) | silent-empty and PATCH no-op sensors from the ERR register (HS-17), read-after-write witness (LD-07) | acceptance set built from cases where the plausible reading is wrong (LA-02), leakage audit on model-ready tables (LC-08) |
| UI-RELAY | design persona with ground rules (LC-07), record-class coverage list (LC-02) | vertical axis declared per gate (LC-02), two variants for preference questions (LC-01) | coverage record naming instantiated classes (LA-02) | live-record layout and semantics assertions (H6), contrast budget audit (LC-07), NOT-EXERCISED verdict (LA-02) |
| INTEGRATION | constraint table classing physical, economic, conventional (LB-06) | constraint suite quoted in the dispatch contract (MH-03), one writable store with the mirror generated (MA-06) | route presence and topic presence checks on every new endpoint (ERR-0001, 0002, 0006, 0024, 0025), diff-driven locator invalidation (MH-11) | joint success of functional and constraint suites (MH-03) |
| DEPLOY-INFRA | deployed-path re-presented at write time, not prohibited (LA-07) | publish-state interlock with job lock (MH-08, LD-08), propose and apply split (H5) | deployed-state sensor: compose config files, ports, container SHA (H2, MH-13) | completion counted only against the deployed artefact (MH-13), gate self-test with a real record (MA-03) |
| ORCHESTRATION | precedent surfaced structurally by VTP enrichment (LB-09), one worked decomposition example (MA-12) | decision specs before generation (MH-02), criteria hash at plan lock (LB-02), `verifiable_by` per criterion (MA-02), fan-out and spend ceilings (MA-12), halt authority declared (MA-08) | delivery-truth sensor and invalid-result envelope (MH-05, MH-06), calibration store (LA-01), invocation counters per artefact (MH-12), predicted-versus-observed durations per wave (LB-05) | blinded three-seat verification (MA-01, LB-01), mechanical veto over model approval in cost order (MH-04, MA-09), harness manifest attribution (MH-07), inverted-category second pass (LD-05) |
| KNOWLEDGE | transfer cards for borrowed patterns (LD-06), removal signals on scaffolds (LC-05), gaps register (MH-11) | findings stored as events with a moment (LD-07), canonical store writable, mirror read-only (MA-06) | consumer counts per generated artefact stream (LD-07), avoidance sensor after FC warnings (LA-09) | how-come deficit listed before a retrieved fact is cited (LD-07), reflection capped and terminating in a decision (LA-09) |
| SECURITY | distinct-action per named owner (LD-08) | halt and spawn permissions as data (MA-08) | scheduled deletion probe against every live control (LA-05) | necessity, directionality, exclusivity applied at gate design (LA-05) |
| REPORTING | artefact register annotated inline (LC-07), numerator and denominator persisted, rate derived at render (LB-03) | threshold committed only with a basis and a sensitivity run (LC-08) | base alongside every rendered percentage (LC-08) | cited reports reviewed harder, not lighter (MA-10) |

Hybrids (pairs that work only together):

- **HY-1 Calibration store plus auto-accept threshold** (LA-01): an orchestrator-owned store bins executor verdicts by stated level against realised gate outcomes; the auto-accept threshold is set from realised frequency; a stated level with no history routes to a human read.
- **HY-2 Coverage record plus NOT-EXERCISED** (LA-02): the fixture loader records which failure classes it instantiated; a gate whose target class never arose reports NOT-EXERCISED, never PASS.
- **HY-3 Origin token plus generated-origin rejection** (LA-04): every written field carries `sap-query | file-read | mcp-tool | retrieved-passage | generated`; a dynamic quantity or SAP claim tagged `generated` fails the gate.
- **HY-4 Probabilistic guard plus static-for-dynamic check** (LB-04): writes to registered dynamic fields need model, window and spread; the idea gate fails any surviving scalar and records "it is a starting point" as a rejected defence.
- **HY-5 Defender guide plus challenger check** (LD-02): the executor writes a DEFENCE block (the single rule, the cases claimed) before code; the challenger's only admissible output is a case the defender's own rule cannot cover plus the dimension the defence cannot measure; an accepted finding must name the arrangement it changes.
- **HY-6 SAP-DATA matched pairs plus UI-RELAY classification** (LC-06): surfaces rendering margin, price or payment figures classify against the pair set before emitting a variance or warning.
- **HY-7 Artefact register plus inline annotation** (LC-07, LB-03): kit children at zero with consumed cost still counted, unallocated on-account payments; any surface rendering an affected figure annotates it or does not ship.
- **HY-8 Vertical gate plus record-class list** (LC-02): the vertical UI gate samples the SAP data taxonomy (kit parent, kit child at zero, credit note, unallocated payment) rather than one convenient row.

# Appendix D. Mechanism catalogue from the agentic-engineering book and the harness papers

Evidence grade is what the source offers, not the strength of the recommendation. Stage is where it attaches in the SGSD loop.

| Id | Mechanism | Stage | Evidence | Addresses |
|---|---|---|---|---|
| MH-01 | Audit the harness for the empty quadrant; each phase names a Guard for its riskiest subject | Plan | argued | FC9, FC5, FC3 |
| MH-02 | Decision specs: the executor pins arbitrary choices before generating; a literal with no entry fails the diff scan | Plan, Dispatch | argued | FC5, FC9, FC8 |
| MH-03 | Constraint suite separate from the functional suite; constraint text in the dispatch contract raised compliance 10.2 to 25.6 points; 221 of 644 passing repairs failed constraints | Plan, Verify | measured | FC1, FC8, FC9, FC4 |
| MH-04 | Mechanical rejection outranks model approval; gates ordered by cost (free, cheap, expensive) | Verify | measured | FC1, FC3, FC9 |
| MH-05 | Invalid, missing or empty result is its own outcome class, never a default | Verify, Observe | measured | FC1, FC7 |
| MH-06 | Progress read from the environment, not the transcript (842 identical payloads over 1,003 turns went unnoticed by introspection) | Work, Observe | measured | FC7, FC1 |
| MH-07 | Every harness edit ships a manifest with predicted fixes and at-risk tasks; next-round attribution reverts per file (pass@1 69.7 to 77.0 over ten rounds) | Observe, Plan | measured | FC9, FC1 |
| MH-08 | Execution-time interlock protecting post-acceptance artefacts, with an override token that leaves a trace | Work, Deploy | measured | FC10, FC2, FC1 |
| MH-09 | Keep the raw record queryable; full traces 50.0 against summaries 34.6 | Observe, Plan | measured | FC1, FC6 |
| MH-10 | Cheap validity smoke before the expensive suite; gate corpus built from current failures | Dispatch, Verify | argued, measured | FC4, FC1 |
| MH-11 | Documentation as locator revalidated against source; invalidation driven by the diff including the deployed checkout | Observe, Plan, Deploy | measured, narrow | FC2, FC6, FC9 |
| MH-12 | Invocation counters per artefact; capability floor on who may edit the harness | Observe | measured | FC9, FC6 |
| MH-13 | Count only production-qualified changes; charge the whole dispatch tree to the root | Observe, Deploy | argued | FC2, FC1 |
| MH-14 | Executable acceptance criteria before implementation; raw gate output fed back as the next dispatch's context | Plan, Work | anecdotal to measured | FC1, FC4, FC9 |
| MA-01 | Three seats: doer, judge, diagnoser as separate dispatches (judge removed: 52 against a 60 baseline) | Verify, Observe | measured | FC1 |
| MA-02 | Report false-pass and false-fail separately; no criterion the harness cannot observe (16.3 percent wrong passes scored below baseline, 1.4 percent set a best) | Plan, Verify | measured | FC1, FC4 |
| MA-03 | Grade the changed system state; self-test the gate with known-good and known-bad real records; scorer outside the executor's reach | Verify, Deploy | measured | FC1, FC2, FC4, FC9 |
| MA-04 | Critique names file, line and action; 61 percent of failed refinements were wrong diagnoses | Work, Verify | measured | FC1, FC8 |
| MA-05 | Keep the archive of attempts and the best round, not the champion and the last commit | Plan, Work, Observe | measured | none |
| MA-06 | One writable store, a generated mirror, loud missing-key failures | Work, Observe | measured | FC6 |
| MA-07 | Continuation as an explicit bit; warn before reclaiming context; supervision reads the trace on an interval | Dispatch, Observe | measured, argued | FC7, FC1 |
| MA-08 | Halt and spawn authority declared as data; stateless reviewer | Dispatch, Verify | anecdotal | FC3, FC7, FC10 |
| MA-09 | Viability gate before quality gate; staged evaluation budget | Dispatch, Verify | measured | FC1, FC10 |
| MA-10 | Interleave commitment with evidence; quote before claim (fabrication 56 percent of ungrounded failures, 0 percent of grounded) | Work, Verify, Observe | measured | FC8, FC1 |
| MA-11 | The acceptance check is the specification; dynamic quantities routed to exact computation; price every added tool | Plan, Verify | measured | FC5, FC9 |
| MA-12 | Pass handles not copies; delegate in code; bound the per-step trace; cap the fan-out | Plan, Dispatch, Work | measured | none |

# Appendix E. Harness build specifications

Each specification is phase-ready: use case, where it attaches, how it helps, implementation, acceptance criteria with observables, cost, dependencies, and the VTP queries the planner runs to extend it. Costs are relative effort to a working first version.

## HS-01 Delivery-truth sensor and result envelope

- **Use case:** every Codex dispatch under SGSD, especially unattended chains, and every detached runner.
- **Where:** Work to Verify; `super-gsd/scripts/codex-executor.sh` dispatch wrapper, `sgsd-quality-gate`, the until-loop waiters. ORCHESTRATION.
- **Helps:** FC1 and FC7. Exit codes and reports become claims; the disk and the process table become the check (LD-03, LA-06, LB-01, MH-05, MH-06, MA-07).
- **Implementation:**
  1. After every dispatch, run `git status --porcelain -- <owned paths>`, read mtimes of the plan's owned files, and grep for the change the prompt demanded; write `{claim: exit_code, report_bytes}` and `{observed: files_changed, matches}` as two separate fields in `.planning/metrics/codex-log.jsonl`.
  2. Classify the outcome as `delivered`, `partial`, `failed` or `invalid_result` (zero-byte report, unparseable JSON, absent exit file, exit code with no report). `invalid_result` is never coerced to pass or fail.
  3. The waiter exits on exit-file-present OR process-gone (`tasklist //FI "IMAGENAME eq codex.exe"`); process-gone with no exit file is classified, not awaited.
  4. A watchdog samples an environment-side progress signal (new commits, mtimes under owned paths, row counts) on an interval and halts a dispatch whose signal is flat while turns accrue; a repeated-identical-payload detector fails the run.
- **Acceptance criteria:** (a) a dispatch that returns exit 127 with all owned files written is recorded `delivered`, `verifiable_by: replay of the 01-01 dashboard-redesign case from codex-log`; (b) a zero-byte report is recorded `invalid_result`, never `failed`, `verifiable_by: injected zero-byte report in a test dispatch`; (c) a killed runner with no exit file returns control within one watchdog interval, `verifiable_by: kill codex.exe mid-run and time the waiter`; (d) divergence rate between claim and observed is a column in the metrics, `verifiable_by: jq over codex-log.jsonl`.
- **Cost:** low. **Depends on:** nothing.
- **VTP queries:** `vtp_search_research_passages(query="parser silently substituted default score invalid evaluator output")`, `vtp_search_book_passages(query="study time tracked repetition while judgements of learning stayed flat", principles=["MPFU-P-01","FOM-P-07"])`, `vtp_search_book_passages(query="sculptor learns from clay that resists introspection reports nothing", principles=["DIAL-P-10"])`.

## HS-02 Deployed-state sensor and qualified-change accounting

- **Use case:** any phase whose product must run on devcp; any debrief that says fixed.
- **Where:** Deploy to Observe; `super-gsd/control-plane/clarity_cp/` (the post-deploy half of preflight), `.planning/metrics/`. DEPLOY-INFRA, SECURITY.
- **Helps:** FC2 and FC3. A fix is fixed when the container says so (MH-13, MH-11, H2, LB-06).
- **Implementation:**
  1. `clarity-cp verify-deployed --expected-sha SHA --services "..."` reads on devcp: `docker ps` ports, the compose `config_files` label, the image or checkout SHA per service, and `ss -tln` for the MCP bindings; it diffs against the expected SHA and the declared port policy and emits one JSON object.
  2. Phase completion in `.planning/metrics/` is recorded only when `verify-deployed` returns match; a merged commit alone records `committed`, not `complete`.
  3. Per phase, aggregate tokens, wall clock, retries and human-review minutes across every dispatch the phase spawned (root accounting).
  4. Path assertions in CLAUDE.md, STATE.md and the memory index get a fingerprint check resolved against the current tree and the deployed checkout; stale entries are frozen and listed in a gaps register.
- **Acceptance criteria:** (a) a commit on a branch absent from `~/clarity-deploy` cannot reach `complete`, `verifiable_by: run verify-deployed against a known-stranded SHA`; (b) an unauthenticated port shows in the report as a binding, not as a key status, `verifiable_by: report on :3020 and :4004`; (c) the deployed SHA per service is in the phase debrief, `verifiable_by: grep the debrief`.
- **Cost:** low. **Depends on:** HS-01 for the metrics schema.
- **VTP queries:** `vtp_search_research_passages(query="production qualified change total lifecycle cost verification tax")`, `vtp_search_research_passages(query="documentation locator revalidated against source diff driven invalidation")`, `vtp_search_book_passages(query="constraint classification physical economic conventional historical test who benefits", principles=["FPT-P-02"])`.

## HS-03 Decision specs and executable constraints in the plan

- **Use case:** any phase introducing constants, thresholds, enum members, defaults or schema; any frozen contract.
- **Where:** Plan to Dispatch to Verify; `super-gsd/templates/plan-schema-v2.json`, `validate.cjs`, PLAN-LOCKED, the Codex dispatch contract. ORCHESTRATION, SAP-DATA, INTEGRATION.
- **Helps:** FC9, FC5, FC8 (MH-02, MH-03, MH-14, LB-02, LB-07, MA-02, MA-11, AES-P-02, AES-P-03).
- **Implementation:**
  1. PLAN.md gains `constraints:` (error semantics, schema preservation, compatibility, idempotence, ordering, resource lifecycle) and `premises:` (each classed established fact, assumption or value judgement with an evidence locator; an unevidenced premise about SAP semantics or deploy topology blocks the plan).
  2. Every acceptance criterion carries `verifiable_by:` naming the command or artefact that decides it; `validate.cjs` rejects a criterion without one.
  3. At PLAN-LOCKED the criteria and any frozen enum set are hashed; the phase-close gate compares hashes and a mismatch requires an amendment record naming the contradiction that forced it (LD-04).
  4. The Codex contract quotes the constraint text verbatim and requires `DECISIONS.json` (choice, options, decision, reason, spec it derives from) before any file write; a numeric literal in the diff with no entry fails the diff scan.
  5. The constraint suite runs on a clean checkout with executor edits to test files discarded, scored separately from the functional suite; joint success is the reported metric.
- **Acceptance criteria:** (a) a plan with a criterion lacking `verifiable_by` fails `validate.cjs`; (b) widening a frozen enum without an amendment record fails phase close, `verifiable_by: replay the CoVe phase-03 SELF_CORROBORATION widening`; (c) a diff introducing `lead_time_days = 14` with no decision entry fails the scan; (d) `gate-evidence.jsonl` carries functional and constraint verdicts as two fields.
- **Cost:** medium (GATE tier: schema change). **Depends on:** HS-05 for the gate admission rule.
- **VTP queries:** `vtp_search_book_passages(query="decision specs pin arbitrary choices before generation", principles=["AES-P-02"])`, `vtp_search_research_passages(query="functionally passing repairs violate review constraints hidden failure rate")`, `vtp_search_book_passages(query="commit in writing to what would change your mind before data arrives", principles=["YDM-P-11"])`, `vtp_search_book_passages(query="valid argument from false premises audit form and inputs separately", principles=["CTS-P-03"])`.

## HS-04 Three-seat verification: blinded judge, located diagnosis, stateless reviewer

- **Use case:** every phase close; every retry.
- **Where:** Verify to Observe to the next Dispatch; new dispatch contracts `verify-v1` and `diagnose-v1` beside `structured-json-v1`. ORCHESTRATION.
- **Helps:** FC1, FC8 (MA-01, MA-04, MA-08, LB-01, LA-08, H8, RFX-P-01, RFX-P-04).
- **Implementation:**
  1. The verifier dispatch receives only the acceptance criteria and `git diff` (never the executor's report, transcript or exit code) and returns PASS or FAIL plus the diagnostic text of any failing check.
  2. On FAIL, a diagnoser dispatch reads the verdict plus the trajectory and writes one `retry_lesson` line naming the step at fault and the alternative; the retry prompt prepends it and nothing else (Reflexion). Retries are capped and each retry must differ in approach or stop.
  3. Review output is rejected unless it names file, line and action; generic review is a non-answer. Each proposed fix is logged against whether it landed (MA-04).
  4. The reviewer is barred from quality verdicts outside the pre-agreed evidence contract; findings outside it go to a channel that does not gate the phase (LA-08).
  5. Self-checks elicited above a context-utilisation threshold are discarded; the self-check runs as a fresh dispatch against the artefacts (LA-06).
- **Acceptance criteria:** (a) the verifier prompt contains no executor report content, `verifiable_by: prompt log`; (b) a retry without a `retry_lesson` is refused by the dispatcher; (c) a review finding with no file and line is rejected by the contract validator; (d) mislocated-fix rate is computable from the metrics.
- **Cost:** medium. **Depends on:** HS-01 (envelope), HS-03 (criteria with observables).
- **VTP queries:** `vtp_search_research_passages(query="separate actor evaluator and self-reflection roles ablation retry loop stopping test")`, `vtp_search_research_passages(query="located actionable critique beats generic feedback diagnosis dominates refinement failure")`, `vtp_search_book_passages(query="requested observable uninterpreted data praise moves standard outside the performer", principles=["CCRS-P-04","CCRS-P-05"])`.

## HS-05 Gate admission rule, self-test and NOT-EXERCISED verdict

- **Use case:** any new or modified gate: parity, depth probe, golden-query suite, schema check, smoke.
- **Where:** Verify; `super-gsd/registry/gates.yaml`, gate scripts, the fixture loaders. ORCHESTRATION, UI-RELAY, SAP-DATA.
- **Helps:** FC4, FC1, FC3 (LD-04, LA-02, LA-05, MA-03, MH-04).
- **Implementation:**
  1. Every gate script declares in its file the one behaviour it rules out and its deletion account (what changes if the gate is removed); a gate whose account predicts the same outcomes is refused (LA-05).
  2. Admission requires a `gate-selftest` step: one known-good real current record must PASS and one deliberately broken copy must FAIL before the gate enters the loop; a gate green for a long run with no overturn re-runs the self-test.
  3. The fixture loader writes a coverage record naming the failure classes it instantiated; a gate whose target class never arose emits NOT-EXERCISED, never PASS (LA-02).
  4. Gate scoring logic lives outside the tree the executor may write to, and the executor is not told how it is scored (MA-03).
  5. Mechanical gates run first and their rejection is final; a model reviewer's approval is recorded as advisory and cannot clear a mechanical rejection (MH-04).
- **Acceptance criteria:** (a) a gate without a rules-out statement fails registry validation; (b) the parity gate on the Eva fixture reports NOT-EXERCISED for the overlapping-label class, `verifiable_by: run the parity suite with the coverage record enabled`; (c) a broken copy of a real meeting fails the live smoke; (d) a mechanical rejection with a reviewer approval records as rejected.
- **Cost:** low to medium. **Depends on:** nothing.
- **VTP queries:** `vtp_search_book_passages(query="correctness stated apart from implementation nothing is a malfunction", principles=["TMPCS-P-04","FTD-P-02"])`, `vtp_search_book_passages(query="necessity directionality exclusivity could ordinary mechanisms produce this", principles=["FOM-P-03"])`, `vtp_search_research_passages(query="reward from file system diff gold command dummy submission validating scorer")`.

## HS-06 Live-record vertical gate and adversarial corpus

- **Use case:** UI-RELAY phases rendering business state; REPORTING surfaces; document-chain traversal.
- **Where:** Verify; `.planning/tools/browser-audit/`, the parity suite, the record-class list. UI-RELAY, SAP-DATA+UI-RELAY.
- **Helps:** FC4, FC8 (H6, LC-02, MH-10, LD-05, HY-8, HY-6, HY-7).
- **Implementation:**
  1. Each visual gate declares its axis (horizontal: structure without function; vertical: one path in full detail); a horizontal gate may not emit claims about how real records render.
  2. At least one vertical gate per UI-RELAY phase runs against live records drawn from the read model, stratified across the SAP data taxonomy (kit parent, kit child at zero, credit note, unallocated on-account payment, long decision text, dense timestamp clusters) at three widths.
  3. Layout assertions: no two label boxes intersect, none leaves its section, no edge crosses a node except at its endpoints. Semantics assertions: a relay never shows AWAITING PAYMENT when on-account payments cover the open amount; any figure the artefact register covers carries its annotation inline.
  4. The gate corpus is rebuilt each phase from records that currently render badly and held beside the frozen fixture, not instead of it (MH-10).
  5. After a pass, one inverted-category second pass with a fixed count (re-read the page as a record somebody must act on; re-read rows as a document chain).
- **Acceptance criteria:** (a) meeting `96ff3f55-6b85-4f41-a8fd-64267743a147` at 1280, 1440 and 1920 passes the label assertions, `verifiable_by: browser-audit run`; (b) AF-001 renders "paid on account, awaiting allocation", `verifiable_by: relay map for DN 140051823`; (c) the gate report lists the record classes covered.
- **Cost:** low to medium. **Depends on:** HS-05 (admission), HS-08 (artefact register).
- **VTP queries:** `vtp_search_book_passages(query="vertical prototyping full detail one path horizontal structure without functionality", principles=["DTE-P-06","DTE-P-09"])`, `vtp_search_research_passages(query="lightweight validation before expensive benchmark evaluation set from baseline failures")`, `vtp_search_book_passages(query="corroboration interlocking varied evidence not repetition second pass inverted categories", principles=["NUO-P-03","FTD-P-04"])`.

## HS-07 Dynamic-quantity register with origin tokens

- **Use case:** lead times, prices, hours, capacity, coverage days, discount limits: anywhere a moving quantity could be stored as a scalar; the idea gate; extraction schemas; form defaults.
- **Where:** Plan and Verify first (idea gate, plan schema); Work and INTEGRATION second (EF Core, Mongo read models). SAP-DATA, REPORTING, KNOWLEDGE.
- **Helps:** FC5, FC8, FC6 (LB-04, LA-03, LA-04, LD-07, MA-11, HY-3, HY-4, static-for-dynamic gate rule).
- **Implementation:**
  1. A register `.planning/harness/dynamic-quantities.yaml` lists registered quantities with their computation or source (SAP query, supplier feed, observation window).
  2. Any numeric field in an idea, plan or schema that names a registered quantity must carry `derived_from` (an expression or a live call) or `{model, window, spread}`; a bare literal fails the gate and "it is a starting point" is recorded as a rejected defence.
  3. Every written field carries an origin token (`sap-query | file-read | mcp-tool | retrieved-passage | generated`) emitted by the producing step; a dynamic quantity or SAP semantic claim tagged `generated` is rejected; a time marker records external arrival so a stale read is distinguishable from a fresh one.
  4. Extraction schemas and form defaults leave registered quantities empty rather than seeded with an example or last-known value (LA-03); an emitted value with no retrieval event in the same dispatch is rejected.
  5. Composed ranges must state whether inputs are independent; a range built by summing low ends or high ends is rejected (LB-04).
  6. Read paths emit staleness and spread alongside the value; reports persist numerator and denominator and derive rates at render (LB-03).
- **Acceptance criteria:** (a) the falsified idea "auto-populate required dates from stored supplier lead times" fails the gate, `verifiable_by: replay through vtp-develop-ideas Stage 3`; (b) a field tagged `generated` for a lead time fails, `verifiable_by: unit test on the gate`; (c) the honest-empty rate per field is a metric and a template change that lowers it is flagged.
- **Cost:** medium (GATE tier at schema level). **Depends on:** HS-03.
- **VTP queries:** `vtp_search_book_passages(query="probability measures your information not the object model versus empirical estimate", principles=["PTPP-P-01","PTPP-P-03"])`, `vtp_search_book_passages(query="partial exposure task children wrongly claim to know total ignorance correct", principles=["FOM-P-06"])`, `vtp_search_research_passages(query="efference copy and time marker mark origin at production not reconstruct later")`, `vtp_search_research_passages(query="metric becomes specification external calculator exact component")`.

## HS-08 SAP semantics guides: base-rate cards, matched pairs, dataset cards, artefact register

- **Use case:** any dispatch touching invoice lines, kit BOMs, on-account payments, margin semantics, document chains; any report rendering an affected figure.
- **Where:** Dispatch (context packet) and Verify (classification check); `context-packet` tool, `.planning/sap-schema/`, `.planning/knowledge/data/`. SAP-DATA, REPORTING, UI-RELAY.
- **Helps:** FC8, FC5, FC4 (H7, LB-03, LC-06, LC-08, LC-07, MA-10, LB-09, LA-09).
- **Implementation:**
  1. Base-rate cards per anomaly class: how often a zero price, an unallocated on-account payment or a negative monthly margin is legitimate, as counts out of a stated total, never as a rate alone.
  2. Matched Yes and No pairs per known boundary (kit child invoicing at zero: Yes; a genuinely mispriced zero line: No; unallocated on-account payment: Yes; mis-keyed allocation: No), differing in one respect; before an agent may file or fix a data defect it names the Yes example the case resembles, and a case matching no pair escalates to a person.
  3. Dataset cards per Mongo read model and SAP object family: row unit, source process per column, known quality issues, the cannot-support list.
  4. The artefact register (kit children at zero with consumed cost counted; unallocated on-account payments; date-only `UpdateDate` watermarks) feeds the UI check in HS-06: any affected figure is annotated inline or does not ship.
  5. Quote before claim: executor trajectories carry `observed:` lines quoting the actual query result beside any `claim:` line about data semantics; a claim with no adjacent observation fails the gate.
  6. Every failure-class warning ships with its permitted use, and the avoidance rate on the flagged construct is measured alongside the error rate (LA-09).
  7. Cards are injected only when a task touches the objects they cover (progressive disclosure, AES-P-07); each entry carries a removal signal and a named watcher (LC-05).
- **Acceptance criteria:** (a) a dispatch on margin logic receives the kit-child pair and the base-rate card, `verifiable_by: context-packet output`; (b) a `claim:` about `IncomingPayments` with no `observed:` quote fails verification; (c) the artefact register is the single source the margin report annotations read.
- **Cost:** low. **Depends on:** nothing (HS-06 consumes it).
- **VTP queries:** `vtp_search_book_passages(query="natural frequencies counts out of stated total preserve the base rate", principles=["PTPP-P-05","YDM-P-06"])`, `vtp_search_book_passages(query="concept attainment yes and no examples teach where the boundary falls", principles=["NCC-P-05","NCC-P-04"])`, `vtp_search_book_passages(query="inspect the dataset before predicting never report a rate without its base", principles=["DSSA-P-04","DSSA-P-06"])`, `vtp_search_research_passages(query="interleaving thought and observation hallucination zero percent grounded quoting evidence")`.

## HS-09 Publish-state interlock and propose-apply split for live systems

- **Use case:** backfills, migrations, container recreation, redeploys, SAP writes, Mongo mutations, secret rotation.
- **Where:** Work and Deploy; `clarity-cp` (jobs, guard, deploy intents), the devcp shell and compose wrappers. DEPLOY-INFRA, INTEGRATION, SECURITY.
- **Helps:** FC10, FC2, FC3 (MH-08, LD-08, MA-08, H5, PROCT-P-02).
- **Implementation:**
  1. Once a backfill, migration or acceptance check reports success, its output paths, tables and volumes are registered protected from the acceptance command itself (no separate list); `docker compose down -v`, `rm -rf`, resets and redeploys against protected targets are intercepted before execution and returned as a targeted error.
  2. An explicit override token downgrades the block to a warning, forces a revalidation pass, and its presence in the trace is the evidence the guard engaged; routine overrides are a metric.
  3. Agents emit intents for SAP writes, Mongo mutations and secret rotation; a deterministic applier executes them after preflight (`clarity-cp deploy preflight` pattern extended to mutation kinds), reading the job lock long-running jobs register.
  4. Every party named as answerable for a control has a distinct action; a key nothing reads is struck (MCP_API_KEY), which leaves the port binding visible as the real control.
  5. `may_spawn` and `may_halt` are declared per dispatch profile in `codex-profiles.yaml` and enforced by the wrapper; fan-out carries a sub-call and spend ceiling (MA-12).
- **Acceptance criteria:** (a) `docker compose down -v` against a registered running backfill is refused without the token, `verifiable_by: rehearsal on devcp with a dummy job`; (b) the override token appears in the trace when used; (c) a SAP PATCH issued outside the applier is refused; (d) each dispatch profile has a halt owner.
- **Cost:** medium. **Depends on:** HS-02 (deployed-state reads).
- **VTP queries:** `vtp_search_research_passages(query="publish state guard shell tool protects acceptance outputs destructive command interception override token")`, `vtp_search_book_passages(query="total prevention must arm itself with the harm limited responsibility diffused power", principles=["FS-P-06","FS-P-07","NUO-P-08"])`, `vtp_search_research_passages(query="agent tuple halt permissions subset inheritance stateless oracle agent")`.

## HS-10 Calibration store, two-rate gates and cost-ordered evaluation

- **Use case:** any gate or executor verdict that decides whether the next phase starts without a human read.
- **Where:** Verify and Observe; `.planning/metrics/gate-evidence.jsonl`, the dispatch wrapper, `gates.yaml` ordering. ORCHESTRATION.
- **Helps:** FC1, FC4 (LA-01, MA-02, MH-04, MA-09, LB-03, HY-1).
- **Implementation:**
  1. An orchestrator-owned calibration store bins every executor verdict by stated level against the realised gate outcome; discrimination and bias are two separate numbers per subject area; the auto-accept threshold is set from realised frequency, and a level with no history routes to a human read.
  2. Every gate reports two numbers: how often it passed a phase later overturned, how often it failed a phase that was fine; operator overturns are logged with direction.
  3. Gates run in cost order: viability probe (tree builds, executor can still edit), three-case smoke, unit suite, live checkpoint; the chain aborts at the first failure; per-tier cost and kill rate are logged so the ordering is defended by price.
  4. Any blocking probe declares prevalence, false-positive rate and share-real; a gate whose share-real falls below the agreed floor advises rather than blocks.
- **Acceptance criteria:** (a) `gate-evidence.jsonl` rows carry `stated_level`, `realised`, `tier`, `tier_cost`; (b) an overturn is recordable from the CLI with a direction; (c) the parity gate's share-real is computed after ten runs.
- **Cost:** low to medium. **Depends on:** HS-01, HS-05.
- **VTP queries:** `vtp_search_book_passages(query="control accumulator stores confidence discrepancy and shifts the decision threshold", principles=["FOM-P-04","MPFU-P-05"])`, `vtp_search_research_passages(query="false pass rate versus false fail rate self written tests halting early")`, `vtp_search_research_passages(query="mechanical rejection overrides LLM approval deterministic guardrail layers ordered by cost")`, `vtp_search_research_passages(query="staged evaluation functionality screen minibatch before full selection")`.

## HS-11 Harness manifest, invocation telemetry and scaffold removal signals

- **Use case:** every change to CLAUDE.md, AGENTS.md, a gate script, an agent definition, a Codex profile or a context pack.
- **Where:** Observe feeding Plan; `.planning/harness/harness-manifest.jsonl`, `.planning/metrics/`. ORCHESTRATION, KNOWLEDGE.
- **Helps:** FC9, FC6 (MH-07, MH-12, LC-05, LA-09, LA-07, RAMP-P-04).
- **Implementation:**
  1. A harness edit ships a manifest entry (evidence, root cause, edit, predicted fixes, at-risk tasks) written before the next run; the next phase close intersects predictions with observed deltas and auto-reverts the single file behind an edit whose predicted fixes did not appear; regressions are caught by a held-fixed suite, not by the prediction field.
  2. An invocation event is logged whenever a skill, agent definition, gate script or memory file is read or run; an artefact with no invocations across N phases is a deletion candidate at milestone close; self-editing of the harness is restricted to the orchestrating tier.
  3. Every instruction-file entry and context-pack item carries a removal signal and a named watcher at introduction; acceptance criteria may not be lowered to obtain a green (the permitted move is enriching the run-up).
  4. Rules are written as the canonical path re-presented at the moment of the write, never as a prohibition (LA-07); a rebound probe checks the next unrelated decision after any prohibition.
  5. A single-component swap-in measurement runs when three or more harness edits ship together, because components interfere non-additively.
- **Acceptance criteria:** (a) a CLAUDE.md commit without a manifest entry fails the commit gate; (b) invocation counts per artefact are listed in the milestone debrief; (c) the manifest's fix-precision and regression-precision are computed per round.
- **Cost:** medium. **Depends on:** HS-01 (metrics), HS-10.
- **VTP queries:** `vtp_search_research_passages(query="change manifest predicted fixes at risk regressions next round attribution rollback file granularity")`, `vtp_search_research_passages(query="routines created never invoked inherited configuration invocation fraction capability floor")`, `vtp_search_book_passages(query="scaffold with removal signal simplify the run-up not the target", principles=["NCC-P-02","NCC-P-01"])`, `vtp_search_book_passages(query="suppression instruction rebound versus re-present clean information before judgement", principles=["SMC-P-06","SMC-P-07"])`.

## HS-12 Canonical-store guard and locator revalidation

- **Use case:** every write where a mirror exists (`~/.vtp` against `kb-data`, Postgres against a Mongo read model); every plan that reads documentation for file locations.
- **Where:** Work and Observe; `merge-idea-staging.cjs` and siblings, `src/kb/store`, `sync-mirrors`, the memory index. KNOWLEDGE, INTEGRATION, DEPLOY-INFRA.
- **Helps:** FC6, FC2 (MA-06, MH-11, LD-07, LA-04, LA-07).
- **Implementation:**
  1. Exactly one store is writable; the mirror is generated under a read-only guard and a write to it fails loudly.
  2. A write is not a result until a different process has read it back from the canonical store by a path that differs from the writing path (the witness).
  3. Values reused across steps are read by key from the store, never carried in the narrative, so a missing value raises instead of drifting.
  4. Raw run records and distilled lessons live in different stores (phase directory versus `.planning/memory/`).
  5. Path assertions in documentation resolve against the tree before use; unresolved entries are frozen and listed in a gaps register; invalidation is driven by the diff, including the deployed checkout.
- **Acceptance criteria:** (a) a mirror-only upsert raises, `verifiable_by: replay the merge-idea-staging kb-data-only case`; (b) a plan citing a stale path is returned with the frozen entry named; (c) read-back after every canonical write is logged.
- **Cost:** low to medium. **Depends on:** nothing.
- **VTP queries:** `vtp_search_research_passages(query="recall storage versus archival storage two write paths searching wrong tier returns nothing")`, `vtp_search_book_passages(query="findings as events carrying their moment witnessing inscription", principles=["ANA-P-12","ANA-P-09"])`.

## HS-13 Adversarial pair review: DEFENCE block, challenger check, antinomy triage

- **Use case:** FULL and GATE dispatches: SAP semantics, frozen contracts, deploy paths, four or more files; any two-seat disagreement.
- **Where:** Dispatch (DEFENCE) and Verify (challenger); per-dispatch ATC, `commit-reviews.jsonl`, the rd-board and sgsd-board seats. ORCHESTRATION, SAP-DATA, INTEGRATION.
- **Helps:** FC1, FC4, FC9, FC8 (LD-01, LD-02, LD-06, LB-08, HY-5).
- **Implementation:**
  1. The executor writes a DEFENCE block before touching code: the single rule the change must satisfy and the cases it claims to cover.
  2. The challenger dispatch's only admissible output is a case drawn from the defender's own rule that the rule cannot cover, plus the dimension the defence cannot measure; findings argued from the challenger's own standards are rejected unread; an accepted finding must name the arrangement it changes (a gate, a template, a constraint, a hook).
  3. Before a board round opens, the moderator records the arbitrating observation (a SAP query, a count, a probe, a test) and marks it available, expensive or impossible; available closes the debate by running the probe; impossible yields a stated policy plus an explicit "question dropped" note.
  4. A reversal counter on architecture, schema and routing decisions surfaces in the decision record before a new round.
  5. Borrowed patterns carry a transfer card (source, target, the one property carried, properties not claimed, the condition under which the transfer stops holding); multi-seat disagreements are carried into the decision as stated limits, not averaged.
  6. A reviewer whose findings cluster as indifferent or anxious is flagged for the opposite correction (LD-02).
- **Acceptance criteria:** (a) a FULL dispatch without a DEFENCE block is refused; (b) a challenger finding that names no arrangement is closed as rhetoric and not counted; (c) the decision record shows the arbitrating observation and its availability class.
- **Cost:** medium. **Depends on:** HS-04 (contracts).
- **VTP queries:** `vtp_search_book_passages(query="refute the opponent from their own answer contradiction by their own lights", principles=["DIAL-P-04","NUO-P-04","NUO-P-05"])`, `vtp_search_book_passages(query="antinomy thesis antithesis no observation can arbitrate how far ought we proceed", principles=["DIAL-P-07","DIAL-P-08"])`, `vtp_search_book_passages(query="analogy holds similarity short of identity name properties not claimed plural analogues", principles=["ANA-P-01","ANA-P-02","ANA-P-10"])`.

## HS-14 Prototype cards, expectation records and problem statements

- **Use case:** spikes, probes, exploratory tasks, diagnostic dispatches, phase briefs originating from requests, meetings or tickets.
- **Where:** Plan and Dispatch; the spike and sketch skills, CONTEXT.md, phase briefs. ORCHESTRATION, KNOWLEDGE, SAP-DATA.
- **Helps:** FC1, FC4, FC8, FC5 (LC-01, LC-03, LC-04, LB-07, LB-09).
- **Implementation:**
  1. No exploratory dispatch without a prototype card: the single question, the pass or fail condition, the fate (discard or evolve); at phase close, a pass condition committed with or after the artefact it judges is rejected.
  2. Preference questions (UI, reporting layout) dispatch two developed variants, never one refined favourite; neither may be a straw man.
  3. A diagnostic dispatch commits an expectation record before running any probe; a result matching the expectation exactly requires a second probe by an independent route before acceptance; the delta between expectation and observation is logged so an agent that is never surprised becomes visible.
  4. Phase briefs open with the four-part problem statement (situation, consequence, decision, gap) with every clause citing an observation; a goal whose wording carries its own means ("by adding a column", "via MassTransit") is returned.
  5. A phase that produced nothing surprising closes with the stage-shortcut audit naming the earliest skipped stage and marking everything downstream untrusted.
  6. Fix-class dispatches name the method reached for first and why it fits this problem rather than the last one (LB-09).
- **Acceptance criteria:** (a) a spike task without a card fails plan validation; (b) an expectation record precedes the first probe in the trajectory, `verifiable_by: trajectory timestamps`; (c) a goal containing a means phrase is flagged by the brief linter.
- **Cost:** low. **Depends on:** HS-03 (schema fields).
- **VTP queries:** `vtp_search_book_passages(query="prototype answers one named question pass or fail condition fixed before building", principles=["DTP-P-05","DTE-P-05"])`, `vtp_search_book_passages(query="record expectations before observing observation errors halo primacy attribution", principles=["DTFD-P-06","DTP-P-04"])`, `vtp_search_book_passages(query="problem statement with the means removed need as verb surprising insight", principles=["DTFD-P-01","DTE-P-02"])`.

## HS-15 Change-class router and brown-edge fences

- **Use case:** every dispatch classification; MCP tool schemas, EF entities, MassTransit contracts.
- **Where:** Plan and Dispatch; `sgsd-classifier`, `harness-components.yaml` protected classes, per-dispatch ATC. ORCHESTRATION, INTEGRATION.
- **Helps:** FC9 (H4, H10, AES-P-09, AES-P-10, AHE-P-03, MA-12).
- **Implementation:**
  1. The classifier scores each change on four axes (local or distributed, mechanical or interpretive, replace or patch, imperative or declarative); mechanical changes route to codemods and language servers, never to model authoring.
  2. MCP tool schemas, EF entities and message contracts are registered as protected components; interiors are free, edge changes need GATE-tier ATC and human approval.
  3. Corpus sweeps receive a manifest path and a scratch directory, not inlined content; sub-dispatches report path plus size; each fan-out carries `max_subcalls` and a token ceiling; one worked decomposition example is shown in the planning prompt.
- **Acceptance criteria:** (a) a rename across 40 files is dispatched to a codemod, `verifiable_by: classifier output`; (b) a change to an MCP tool schema without a GATE review fails the commit gate; (c) a sweep dispatch without ceilings is refused.
- **Cost:** medium. **Depends on:** HS-03 for the protected-contract hash.
- **VTP queries:** `vtp_search_book_passages(query="classify a change on four axes locality mechanical interpretive replace patch", principles=["AES-P-09"])`, `vtp_search_book_passages(query="stable brown edges around a disposable green interior contracts data shapes", principles=["AES-P-10"])`, `vtp_search_research_passages(query="prompt as variable programmatic delegation bounded trace unbounded fan out cost ceiling")`.

## HS-16 Raw-record retention and the archive of attempts

- **Use case:** any planning or diagnosis pass over past phases; any phase that has failed more than once.
- **Where:** Observe feeding Plan; `.planning/metrics/*.jsonl`, Codex transcripts, `narrative.md`, tagged attempt branches. ORCHESTRATION, KNOWLEDGE.
- **Helps:** FC1, FC6 (MH-09, MA-05, LD-07).
- **Implementation:**
  1. Full traces are the primary record with a consistent, parseable layout; the planner is given grep and read over the directory; `narrative.md` links into the record and never replaces it.
  2. Failed attempts are kept as tagged branches with their gate scores in a small index; a retry names the best-scoring prior attempt as its base; parents are sampled by score over surviving children so an under-tried approach still gets drawn.
  3. When a phase produces several candidate commits, each is scored and the highest scorer is kept, not the last iteration.
  4. Every generated artefact stream (metrics, narrative, reports, enrichment) is measured by consumer count, not volume; a producer with zero consumers is deleted rather than analysed.
- **Acceptance criteria:** (a) a retry prompt names its base attempt and score; (b) consumer counts per stream appear in the milestone debrief; (c) the planner's grep over the record is logged as an invocation.
- **Cost:** low. **Depends on:** HS-11 (invocation telemetry).
- **VTP queries:** `vtp_search_research_passages(query="raw execution traces beat summaries ablation queryable filesystem")`, `vtp_search_research_passages(query="archive of viable variants beats hill climbing stepping stones pareto candidate selection")`.

## HS-17 Data-path silence sensors and route presence checks

- **Use case:** every SAP OData query, every Service Layer PATCH, every new endpoint, every Kafka consumer, every sync job with more than one writer.
- **Where:** Work and Verify; the SAP adapter, `IncrementalSyncService`, the Ocelot route table, `kafka-init`, `RecordCountReconciler`. INTEGRATION, SAP-DATA.
- **Helps:** the ERR register's silent-success class (ERR-0022, ERR-0031, ERR-0024, ERR-0025, ERR-0001, ERR-0002, ERR-0006, ERR-0024 and ERR-0025 gateway routing), FC8, FC6 (LD-07 witnessing, MH-05, MA-10).
- **Implementation:**
  1. `$select` and `$expand` field names are validated against the OData metadata before the query runs; an empty result whose field set was never validated is classified `invalid_result`, not "no data" (ERR-0022, ERR-0018).
  2. A Postgres or Mongo query returning empty against a table or collection that does not exist is a failure, not an empty array (ERR-0031).
  3. Every Service Layer PATCH is followed by a read-back of the patched collection by a different path; a no-op read-back is a failure (ERR-0024).
  4. Two writers to the same document field require a registered ownership lease (the `clarity-cp` lease pattern applied to sync jobs); the second writer is refused (ERR-0025).
  5. Every new endpoint requires both Ocelot routes and a matching `*Endpoints.cs` before the phase closes; every consumer topic must exist in `kafka-init` (ERR-0001, ERR-0002, ERR-0006); both are mechanical checks in the phase gate.
  6. Watermarks use wall-clock `sync_ts`, never date-only fields (phase 145-03.1).
- **Acceptance criteria:** (a) a `$select` with `U_QuoteType` (invalid) raises before the request, `verifiable_by: unit test against metadata`; (b) a PATCH to `DocumentSpecialLines` on the test company returns `invalid_result` when the read-back is unchanged; (c) a new endpoint without an Ocelot route fails the phase gate.
- **Cost:** low to medium. **Depends on:** HS-01 (result classes).
- **VTP queries:** `vtp_search_book_passages(query="findings as events witnessed by a second surface read back differs from writing path", principles=["ANA-P-09"])`, `vtp_search_research_passages(query="silent no-op empty response treated as success invalid result class")`.

# Appendix F. Phase sketch, non-goals and open questions

Proposed sequence (each phase is one `/gsd-plan-phase` unit; the board may reorder per Key Question 1):

1. **Sensing floor:** HS-01, HS-02, HS-17. Everything later measures against these.
2. **Gate integrity:** HS-05, HS-06, HS-10.
3. **Specification:** HS-03, HS-07, HS-04 (GATE tier: plan schema and idea gate change).
4. **Knowledge guides and stores:** HS-08, HS-12, HS-16.
5. **Governance and review:** HS-09, HS-11, HS-13, HS-14, HS-15.
6. **Registry:** add a Sensor class (or classes) to `harness-components.yaml` and register every shipped harness with its rules-out statement and deletion account (Key Question 5).

Non-goals: a second control plane; a dashboard; a generic agent memory; self-editing harnesses below the orchestrating tier (MH-12); any harness that reads live SAP or Mongo from inside the CoVe verifier.

Open questions the findings do not settle (evidence gaps to record, not to guess): the recurrence frequency of each failure class (the sensors will supply it); whether `browser-audit` can already assert layout (sets HS-06 cost); where the carrying cost of the attempt archive overtakes its value (MA-05 has no figure); how to separate a correct oscillation from a frame problem in the reversal counter (LD-01); the stopping rule for the inverted-category pass (fixed in advance at one, LD-05).

Provenance note: 60 findings from six Opus research passes over enrichment JSON, profile JSON and bounded reads of the source markdown; every principle id resolves to `wiki/books/*.enrichment.json` or `wiki/research/*.enrichment.json`; evidence grades are the sources' own. Books and papers are lenses; live Clarity and SAP state needs a probe.
