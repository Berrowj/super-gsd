# DLB-05 — Round 2 Rebuttals

Brief: `.planning/briefs/2026-04-20-vtp-audit-sharpening.md`
Date: 2026-04-20

## Round 2 Summary — convergence on narrow synthesis with SPEC-NOW hybrid

| Agent | R1 | R2 Final | Movement |
|---|---|---|---|
| Architect | (1b, 2b, 3b, 4b) | (1b, 2b-converged, 3b-narrow, 4b-deferred) | Converged Q2 toward "single field in existing log" discipline; held 2-probe narrow; rejected retype-MUDA as DLB-02 violation pattern-matching |
| Pragmatist | (1b, 2c, 3a, 4c) | (1b, 2b, 3a-narrow-to-2, 4c-clarified) | Moved Q2c→2b after conceding regression risk was overcooked; narrowed Q3 from 5 guessed stubs to 2 concrete-signal probes; clarified 4c as "wait for v1.3 Gate 3 signal" |
| Contrarian | (1c, 2b-cond, 3c, 4c) | (1c, 2b no condition, 3c-spec-only, 4c) | Dropped Q2b's "single field" condition as "Contrarian-cosplay"; called retype-MUDA "(B) terminology trick"; named memory-tier dependency as prerequisite kill |
| Moonshot | (1a, 2b, 3-RETYPE, 4a) | (1b, 2b, 3-SPEC-NOW, 4b) | Largest shifts: 1a→1b (factual: DLB-03/04 both crossed 80k pre-synthesis); 4a→4b (no factual refutation); retype clarified to SPEC-NOW (spec-only, gate intact) |

## Architect — R2

FINAL POSITION: (1b, 2b-converged, 3b-narrow, 4b-deferred). Instrument cheaply, measure conformance in existing token log, ship 2 targeted probes, wait for v1.2 evidence before Q4.

WHERE YOU MOVED: Q2 converged with Contrarian's "single field in existing token log" — original want for its own log file is infra-for-infra, same mistake DLB-02 write-path-only rejected. If conformance signal can live as flag in `token-log.jsonl` (e.g., `atc_tier_applied: true|false`), that is strictly better than parallel log.

WHERE YOU HELD: Moonshot's retype-MUDA is rejected overreach. DLB-02 was explicit: "read path (classifier consults memory pre-dispatch) deferred until 2 milestones of real dispatch data exist." Moonshot's framing — "Process Mining's 7 anomaly patterns ARE the read-path algorithm" — is reframing, not unlock. It does not produce the 2 milestones of validated dispatch data DLB-02 mandated. Substitutes theoretical taxonomy for operational evidence. Structural injection in DLB-03 R2 was genuine unlock because it eliminated a class of mechanism entirely; retype-MUDA does the opposite — proposes richer mechanism while evidence floor for any mechanism hasn't been met. Pragmatist's 5-probe breadth is incoherent with (1b) evidence-collection stance. Contrarian's "4/4 converged, cap never fired" attack on (1b) defense: at ~30 min implementation cost, below threshold where evidence-before-machinery applies.

SYNTHESIS: No retype-MUDA synthesis candidate; it's DLB-02 violation dressed as architecture. Narrower synthesis available: (2b-converged) closes Q2 split; (3b-narrow, 2 probes) holds against Pragmatist's breadth; (1b) stays as cheap instrumentation.

ONE RESERVED OBJECTION: (2b-converged) adds conformance signal to token log, but nobody specified who reads it. A metric nobody queries is exact "write path nobody reads" anti-pattern that nearly killed DLB-02. Before this ships, token-audit skill must include explicit step that reads conformance flag and surfaces it.

## Pragmatist — R2

FINAL POSITION: (1b, 2b, 3a-narrow, 4c-clarified). Collect budget evidence for one milestone, ship 2 concrete MUDA probes not 5, accept metric-only conformance logging, reject Q4 on this signal meaning wait for the signal that is actually due.

COHERENCE DEFENSE: Architect's attack lands. Inconsistency was real but the fix is not "drop Q1b" — it's "narrow Q3a to match same evidence-first logic." Q1b collects soft-warn data for one milestone then decides whether to harden. Q3a now means: ship 2 probes with concrete measurable signals (Architect's extra-processing + inventory picks are better than my guessed 5) for one milestone, then calibrate thresholds against actual recurrence data. Both Q1 and Q3 now share same philosophy: one milestone of real data before commit to threshold or cap.

WHERE YOU MOVED: Q2 defer to Q2b. Architect right that metric-only conformance writing to conformance-log.jsonl does not touch 6.x dispatch chain. Could not identify concrete file/line where Q2b breaks phase 4 execution. Regression risk was overcooked for metric-only variant. Q3 narrowed from 5 stubs to 2 probes. Moonshot's retype-MUDA is FINDING-18-style risk — DLB-02 deferred read path for documented reasons and activating it without memory tier resolved is a half-built loop. Don't wire a read path to a dead store. Q4c clarified: not "never reopen" — "reopen at v1.3 when Gate 3 results are actually available."

MONDAY MORNING (revised): Still 30 min, tighter scope. Commit 1: budget-warn log in `token-log.jsonl` schema extension. Commit 2: 2 MUDA probe stubs (extra-processing + inventory) appended to existing `sgsd-muda-audit` skill. Commit 3: conformance-log.jsonl write stub in DEVIATIONS parser. Three commits, no new files, no new frameworks.

BLIND SPOTS: Have not read actual sgsd-muda-audit skill file — 2-probe estimate assumes additive stubs clean. If not, scope expands. Q2b requires knowing where DEVIATIONS is parsed in `super-gsd/` — file path unverified, real Monday-morning risk.

## Contrarian — R2

FINAL POSITION: (1c defer, 2b no condition, 3c spec-only / wire-when-evidence, 4c reject). Memory topology must resolve before any MUDA read-path decision is meaningful.

UNEXAMINED RISK: The retype-MUDA gambit carries a hidden dependency chain. Moonshot's "7 Process Mining patterns as DLB-02 read-path algorithms" only works if memory tier is live and populated. [Brief 2 makes this explicit — `brv-query` is a no-op, MCP doesn't exist, 12 curated files sit in a graveyard.] The read-path cannot consult memory that has no circulatory system. Activating the read-path spec now is specifying the algorithm for a pipe with no water in it.

KEY ARGUMENT: Moonshot's retype is (B) — terminology trick, not fair flank. DLB-02's explicit gate was "two milestones of recurrence data before activation." Calling the same pre-dispatch classifier query a "read-path algorithm spec" instead of "adding probes" doesn't reset that clock. Zero recurrence data still exists. The brief itself (MUDA, line 22) acknowledges "read-first means dispatch queries an empty store" — Moonshot's position is to activate exactly that empty-store query, dressed in Process Mining vocabulary. Sample-of-one fallacy wears different shirt; still same fallacy. On Q4: two research sources converging is not operational evidence. It is two literature sources agreeing with each other. On Q2b: withdraw the "single field in existing log" condition. It is Contrarian-cosplay. If metric is measurement-only and cheap, proliferation risk is negligible at two logs.

THE RETYPE-MUDA VERDICT: (B) — terminology trick. Same empty-store activation problem, DLB-02 gate still unmet, no recurrence data exists. Process Mining framing is relabeling of same pre-dispatch query Moonshot could not justify yesterday.

WHERE YOU MOVED: Q2b condition dropped — "single field in existing log" was over-engineering on a cheap metric. No real architectural risk at two logs.

WHERE YOU HELD HARDEST: Q4 (4c reject). Two independent literature sources are still literature. "Two sources converging" argument would justify activating any well-researched idea before it has been run once. That is exact failure mode continuous-distillation is supposed to prevent — loop hasn't run, nothing to distill.

KILL CONDITION FOR ANY SYNTHESIS: If memory topology is not resolved as prerequisite, any board convergence on MUDA write-path OR read-path becomes build decision layered on broken foundation. Moment implementation begins without a live retrieval tier, kill condition is met automatically — stop and resolve Brief 2 first.

## Moonshot — R2

FINAL POSITION: (1b, 2b, 3-SPEC-NOW, 4b). Soft-warn on budget, conformance metric, MUDA retype as spec-adoption not activation, defer Q4 honestly.

RETYPE-MUDA: SPEC-NOW. DLB-02's recurrence gate applies to the retype. The retype is Option A: adopt 7 Process Mining anomaly patterns as specification for which waste classes trigger the eventual read-path wiring, while leaving that wiring gated on DLB-02's 2-milestone rule. DLB-02 decision memo explicit — "read path deferred until 2 milestones of real dispatch data exist." Retype does not bypass this. What it does is name the algorithm that DLB-02 left unnamed: when read path activates, here are 7 pattern templates it queries against, not a guess-at-threshold per probe. Spec contribution, not gate violation.

WHERE YOU MOVED: Concede Q1 to (1b). Factual record decisive — DLB-03 crossed 80k in Round 1 before synthesizing, DLB-04 crossed 80k. Hard cap at 80k would have killed both successful deliberations mid-convergence. Not a research argument — a counter-example. Honest move is soft-warn with number calibrated to real data, not cap that contradicts four deliberations of evidence. Concede Q4 to (4b). Two-source convergence argument is research. I have no factual refutation analogous to DLB-04 "phases 1-7 are dispatch-heavy not install-audit" move. Deferring is the DLB-04 pattern I claimed credit for.

WHERE YOU HELD: (2b) conformance metric. Board is 4/4 here, nothing to defend. Retype as SPEC-NOW not ACTIVATE-NOW — this survives Contrarian's attack because spec contributes named algorithm to a gate that already exists, it does not open the gate early.

HONEST PATTERN CHECK: Mixed. Q1 had factual refutation (real deliberation token counts) I did not use in R1 — held (1a) on principle instead. Q4 was pattern-matching research throughout. The retype is the one genuinely structural move: fills gap DLB-02 explicitly left open — read-path query templates were never specified. Real contribution, not label swap.

## Convergence map

- **4/4 on Q2b metric-only conformance** (form: new `conformance-log.jsonl` file per CEO synthesis, with Architect's reader requirement as precondition)
- **3/4 on Q1b soft-warn** (Contrarian 1c defer overridden)
- **3/4 on Q3 narrow** (2 new probes: extra-processing + inventory) + **CEO synthesis adds Moonshot's SPEC-NOW** as documentation-only contribution (Process Mining 7 patterns as DLB-02 read-path spec, not activation)
- **4/4 on Q4 "not now"** (labels vary — 4b defer-until-v1.3 vs 4c reject — but practical effect identical)

CEO synthesis: **3-1 ADOPT** with Contrarian's dissent preserved on Q1 (cap never fired) and Q3 write-path expansion (no recurrence data). The retype-MUDA verdict split 2-2 in R2 (Architect + Contrarian reject; Moonshot SPEC-NOW refinement; Pragmatist silent) — resolved by the CEO toward a narrow spec-only contribution that Architect can tolerate as documentation-without-execution and Contrarian logs as a risk ("spec as Trojan horse") with mitigation (Architect veto on future early-activation PRs).
