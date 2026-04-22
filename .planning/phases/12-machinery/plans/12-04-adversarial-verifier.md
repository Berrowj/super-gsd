---
phase: 12-machinery
plan: 04
type: execute
wave: 4
depends_on:
  - 12-03
files_modified:
  - .planning/config.json
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
  - .planning/phases/12-machinery/verify.mjs
  - .planning/phases/12-machinery/plans/12-04-SUMMARY.md
autonomous: true
requirements:
  - MACH-04

# v2 schema self-referential frontmatter
schema_version: 2
expected_ATC_tier: LITE
skip_gates: []
tasks:
  - id: 12-04-01
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/config.json
      - .planning/phases/12-machinery/plans/12-04-01-verifier-contract-check.md
    input_contract: |
      12-CONTEXT.md D-14 — `config.atc.verifier_adversarial_rate: 0.2` is the default
      sampling rate. Placement: inside the existing `atc` block at `.planning/config.json`
      (lines 68-77 per research). Adjacent to `enabled` and `tier_thresholds`. Tunable;
      set 0 to disable; set 1 to force challenger on every pass.
      12-RESEARCH.md §Open Question 1 (A2 assumption) — `STATUS: PASS-WITH-GAPS` vocabulary
      may not yet exist in the gsd-verifier agent contract. Research recommendation: plan
      12-04's first task spends 30 seconds reading the gsd-verifier agent file (likely at
      `super-gsd/agents/gsd-verifier/*` or an equivalent skill path — confirmed via Glob
      during task execution) to verify or extend the STATUS vocabulary to include
      {PASS, PASS-WITH-DEVIATIONS, PASS-WITH-GAPS, FAIL}. If absent, the task adds PASS-WITH-GAPS
      to the agent's output contract (one-line edit).
      12-RESEARCH.md §Open Question 2 — challenger should gate on
      `config.atc.enabled && Math.random() < config.atc.verifier_adversarial_rate` (matches
      Step 9.5 dual-gate pattern). Recorded as part of the contract-check note.
      This task writes a contract-check note at
      `.planning/phases/12-machinery/plans/12-04-01-verifier-contract-check.md` capturing:
      (a) path to gsd-verifier agent file, (b) current STATUS vocabulary (before edit),
      (c) whether PASS-WITH-GAPS was added or already present, (d) dual-gate decision
      carried forward to 12-04-02.
    output_contract: |
      `.planning/config.json` contains `config.atc.verifier_adversarial_rate: 0.2` as a
      numeric value. JSON parses cleanly. All other existing atc-block fields preserved
      (`enabled`, `tier_thresholds`, etc per research lines 68-77).
      `.planning/phases/12-machinery/plans/12-04-01-verifier-contract-check.md` exists with
      four sections: Agent File Path, Pre-edit STATUS Vocab, Post-edit STATUS Vocab (or
      "no edit needed — already present"), Dual-gate Decision.
      Optional: if the gsd-verifier agent file was edited to add PASS-WITH-GAPS, that edit
      lands here too. In that case files_touched expands to include the agent file path
      discovered at runtime (executor reports it in the ONE_LINER). If the vocab was
      already present, no agent file edit occurs.
    hypothesis: |
      Research §Open Question 1 flagged A2 as the only unverified assumption. Resolving it
      as the FIRST task of 12-04 (before SKILL.md integration) ensures the challenger
      integration at 12-04-02 has a known verdict vocabulary to parse. The config.json
      edit is mechanical — single numeric field added to an existing block — zero-risk.
    falsifier: |
      (a) `config.atc.verifier_adversarial_rate` absent or non-numeric.
      (b) Value outside [0, 1] range (tuning-sanity invariant).
      (c) Other atc-block fields regressed (enabled / tier_thresholds deleted).
      (d) config.json fails to parse as JSON after edit.
      (e) Contract-check note absent or missing any of the 4 required sections.
      (f) Note claims PASS-WITH-GAPS was added but the agent file was not modified
      (fabrication — executor must report actual edit).
    stop_rule: |
      config.json parses; `verifier_adversarial_rate` present as numeric in [0,1]; other
      atc fields preserved; contract-check note exists with all 4 sections.
    verification_cmd: |
      node -e "const c=JSON.parse(require('fs').readFileSync('.planning/config.json','utf8'));if(!c.atc||typeof c.atc.verifier_adversarial_rate!=='number'){console.error('FAIL field');process.exit(1);}const r=c.atc.verifier_adversarial_rate;if(r<0||r>1){console.error('FAIL range',r);process.exit(2);}if(typeof c.atc.enabled==='undefined'){console.error('FAIL enabled preserved');process.exit(3);}console.log('PASS');" && test -f .planning/phases/12-machinery/plans/12-04-01-verifier-contract-check.md && grep -q "STATUS" .planning/phases/12-machinery/plans/12-04-01-verifier-contract-check.md
    verification_gates:
      - "config.json parses + verifier_adversarial_rate numeric in [0,1] → exit 0"
      - "atc.enabled preserved (not accidentally deleted) → exit 0"
      - "contract-check note exists with STATUS section → exit 0"

  - id: 12-04-02
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
    input_contract: |
      12-CONTEXT.md D-13 — same gsd-verifier agent, contrarian prompt header. Injected as
      Step 9.6 (immediately after Step 9.5 per-dispatch ATC) when step 6.f completed
      (verifier dispatched) AND verifier STATUS in {PASS, PASS-WITH-DEVIATIONS} AND
      `config.atc.enabled && Math.random() < config.atc.verifier_adversarial_rate`.
      12-CONTEXT.md D-13a — contrarian prompt header MUST be injected VERBATIM. The header
      starts "ADVERSARIAL CHALLENGER PASS — the primary verifier returned PASS. You are
      challenging that verdict..." and ends with "...invariants that are mechanically true
      but semantically vacuous."
      12-CONTEXT.md D-13b — challenger verdict semantics:
      - PASS (agrees) → log `verifier_adversarial_agreement: true` to token-log.jsonl
      - PASS-WITH-GAPS (concerns) → promote phase verdict to PASS-WITH-GAPS; append
        challenger findings to {NN}-VERIFICATION.md as `## Adversarial Challenge` section
      - FAIL (flip) → auto mode: log VERIFIER_ADVERSARIAL_FLIP CRITICAL in DEVIATIONS +
        continue (never auto-block); interactive mode: STOP blocker.
      12-RESEARCH.md §Q4 — exact placement: new Step 9.6 after Step 9.5 (lines 745-795).
      Prompt composition matches DLB-03 intent-injection precedent (SKILL.md:241-274 style).
      12-RESEARCH.md §Open Question 2 — gate on BOTH `config.atc.enabled` AND
      `Math.random() < config.atc.verifier_adversarial_rate` (dual-gate matches Step 9.5).
    output_contract: |
      `super-gsd/skills/sgsd-orchestrate/SKILL.md` gains a new "Step 9.6 ADVERSARIAL
      VERIFIER CHALLENGER PASS" section immediately after Step 9.5. Section contains:
      - Fires-when clause referencing the three conditions (Step 6.f completed + STATUS
        in {PASS, PASS-WITH-DEVIATIONS} + dual-gate on config.atc.enabled +
        Math.random() < verifier_adversarial_rate)
      - Verbatim D-13a contrarian prompt header in a code fence (grep must find the
        literal phrase "ADVERSARIAL CHALLENGER PASS")
      - Prose for the 3 verdict-handling branches (PASS / PASS-WITH-GAPS / FAIL) per D-13b
      - Prompt composition pattern mirroring DLB-03 intent-injection
      Measurable greppable markers:
      - `grep -q "ADVERSARIAL CHALLENGER PASS" SKILL.md` → exit 0 (the exact contrarian header)
      - `grep -q "verifier_adversarial_rate" SKILL.md` → exit 0 (config gate referenced)
      - `grep -q "9.6" SKILL.md` → exit 0 (new step numbered)
      - `grep -q "PASS-WITH-GAPS" SKILL.md` → exit 0 (D-13b verdict vocabulary present)
      - `grep -q "VERIFIER_ADVERSARIAL_FLIP" SKILL.md` → exit 0 (DEVIATIONS key present)
    hypothesis: |
      Injecting a new Step 9.6 after Step 9.5 (which is the existing per-dispatch ATC) is
      the DLB-03-style structural injection pattern — minimal prose surface, verbatim
      contrarian header, explicit branching on STATUS. The dual-gate on
      config.atc.enabled + Math.random() matches Step 9.5's existing kill-switch
      convention (research §Open Question 2). Per D-14a, expected firing rate across a
      5-phase milestone at 0.2 = ~1 challenger invocation — low runtime cost, high signal.
    falsifier: |
      (a) Any of the 5 greppable markers absent.
      (b) Step 9.6 placed BEFORE Step 9.5 (breaks ordering — challenger must follow primary).
      (c) Contrarian prompt header text is paraphrased instead of verbatim (D-13a violation).
      (d) Missing branch for FAIL verdict (D-13b requires auto-mode log-continue + interactive-mode-stop).
      (e) Dual-gate missing — challenger fires even when `config.atc.enabled === false`
      (inconsistent with Step 9.5 pattern; §Open Question 2 violation).
      (f) Challenger written as a DIFFERENT agent type (must reuse gsd-verifier per D-13).
    stop_rule: |
      All 5 greppable markers present in SKILL.md; Step 9.6 is textually AFTER Step 9.5;
      contrarian header appears verbatim inside a code fence; 3 verdict-handling branches
      all described.
    verification_cmd: |
      grep -q "ADVERSARIAL CHALLENGER PASS" super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q "verifier_adversarial_rate" super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q "9.6" super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q "PASS-WITH-GAPS" super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q "VERIFIER_ADVERSARIAL_FLIP" super-gsd/skills/sgsd-orchestrate/SKILL.md
    verification_gates:
      - "grep ADVERSARIAL CHALLENGER PASS SKILL.md → exit 0 (verbatim header present)"
      - "grep verifier_adversarial_rate SKILL.md → exit 0 (config gate referenced)"
      - "grep 9.6 SKILL.md → exit 0 (new step numbered)"
      - "grep PASS-WITH-GAPS SKILL.md → exit 0 (D-13b verdict)"
      - "grep VERIFIER_ADVERSARIAL_FLIP SKILL.md → exit 0 (DEVIATIONS key)"
    depends_on: [12-04-01]

  - id: 12-04-03
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/phases/12-machinery/verify.mjs
      - .planning/phases/12-machinery/plans/12-04-SUMMARY.md
    input_contract: |
      12-CONTEXT.md D-24 — Phase 12 ships `.planning/phases/12-machinery/verify.mjs` with
      ≥8 invariants. After plans 12-01..12-03, invariants 1-7 are already in the file. This
      task appends the remaining MACH-04 + ERG + final invariants per 12-RESEARCH.md §Q9:
      - Invariant 8 (MACH-04): JSON.parse config.json → assert `atc.verifier_adversarial_rate`
        numeric in [0, 1]; ALSO grep SKILL.md for the contrarian header marker (D-13a) so
        config+integration are both green.
      - Invariant 9 (WR-01): grep `super-gsd/scripts/lib/edge-guard.cjs` for the narrow
        catch discriminator `err.message.startsWith("gate '")` (expected green after plan 12-05).
      - Invariant 10 (WR-02): grep `super-gsd/scripts/lib/gates-registry.cjs` lines 1-30
        for `PROCESS SINGLETON` (expected green after plan 12-05).
      - Invariant 11 (WR-03): grep SKILL.md for the regex `super-gsd/skills/[^/]+/SKILL\.md`
        used in the code_files_changed_count filter (expected green after plan 12-05).
      - Invariant 12 (ERG-02): `fs.existsSync` + `fs.accessSync X_OK` + `execSync('bash -n ...')`
        against `super-gsd/scripts/patch-gsd-tools-known-keys.sh` (expected green after plan 12-06).
      - Invariant 13 (ERG-02 idempotency): execSync the patch script twice on a fixture
        core.cjs copy; assert exit 0 both times; assert hash-equal after second run.
      - Invariant 14 (SOFT-WARN, D-04): grep `.planning/metrics/token-log.jsonl` for
        `classifier-skip`; exit 0 regardless (soft), but print WARN if count == 0 (research
        §Q9 note: proof-by-usage, expected red until a v1 plan executes post-integration).
      Per 12-RESEARCH.md §Q9 invariants 9-13 become green after plans 12-05 and 12-06
      commit their artefacts. This task authors invariants 8-14 immediately so Phase 12's
      own verify.mjs is complete. Inv 9-13 WILL be green by the time Phase 12 closes because
      plans 12-05 and 12-06 are Wave 1 (already landed before this Wave 4 plan runs).
      Also produce 12-04-SUMMARY.md.
    output_contract: |
      `.planning/phases/12-machinery/verify.mjs` now contains 14 numbered invariants:
      1-7 authored across plans 12-01/02/03; 8-14 added here. Exit code matches invariant
      number on fail (Phase 10 convention). Invariant 14 is SOFT-WARN: exits 0 even at
      count 0; prints WARN message. All 13 hard invariants (1-13) must exit 0.
      `grep -cE 'Invariant ([89]|1[0-4])\b' verify.mjs` returns 7 (invariants 8-14).
      `node verify.mjs` exits 0 on committed artefacts.
      `.planning/phases/12-machinery/plans/12-04-SUMMARY.md` records:
      - MACH-04 landing: config.atc.verifier_adversarial_rate = 0.2; SKILL.md Step 9.6
      - Invariants 8-14 added to verify.mjs
      - Final Phase-12 verify state: invariants 1-13 green; invariant 14 soft-warn
      - Phase 12 close criteria met
      - Commit SHAs
    hypothesis: |
      Consolidating invariants 8-14 in the final plan (12-04) matches Phase 10 D-16b intent
      (Wave 2 = integrator; phase-close signal is verifier green). Because plans 12-05 and
      12-06 already landed in Wave 1, invariants 9-13 are green the moment this task commits.
      Invariant 14 as SOFT-WARN avoids fake-green on the classifier-skip accounting signal
      (research §Q9 note).
    falsifier: |
      (a) `grep -cE 'Invariant ([89]|1[0-4])\b'` != 7 — missing an invariant.
      (b) `node verify.mjs` exits non-zero on committed artefacts (some hard invariant fails).
      (c) Invariant 14 exits non-zero on count 0 (should be soft-warn per D-04 decision).
      (d) Exit codes don't match invariant numbers (break convention).
      (e) Phase 12 SUMMARY omits final verify state or Phase-12-close criteria.
    stop_rule: |
      verify.mjs has 14 numbered invariants; exit 0 on commit; SUMMARY records final state
      + close criteria + commit SHAs.
    verification_cmd: |
      test $(grep -cE 'Invariant ([89]|1[0-4])\b' .planning/phases/12-machinery/verify.mjs) -ge 7 && node .planning/phases/12-machinery/verify.mjs && test -f .planning/phases/12-machinery/plans/12-04-SUMMARY.md && grep -q "Phase 12 close" .planning/phases/12-machinery/plans/12-04-SUMMARY.md
    verification_gates:
      - "verify.mjs contains Invariant 8-14 markers → count >= 7"
      - "node verify.mjs → exit 0 (invariants 1-13 hard green; 14 soft-warn)"
      - "12-04-SUMMARY.md records Phase 12 close → grep exit 0"
    depends_on: [12-04-02]

must_haves:
  truths:
    - "`.planning/config.json` has `atc.verifier_adversarial_rate: 0.2` as numeric in [0, 1]; other atc-block fields (enabled, tier_thresholds) preserved"
    - "gsd-verifier agent STATUS vocabulary includes `PASS-WITH-GAPS` (confirmed or added by 12-04-01 contract-check)"
    - "SKILL.md has a new Step 9.6 ADVERSARIAL VERIFIER CHALLENGER PASS block placed textually AFTER Step 9.5"
    - "Contrarian prompt header from D-13a is present VERBATIM inside a code fence (grep for literal `ADVERSARIAL CHALLENGER PASS` returns >= 1)"
    - "SKILL.md references dual-gate `config.atc.enabled && Math.random() < config.atc.verifier_adversarial_rate` (Open Question 2 decision)"
    - "SKILL.md documents all 3 verdict-handling branches: PASS (agreement log), PASS-WITH-GAPS (promote + append), FAIL (auto log-continue / interactive stop)"
    - "SKILL.md contains greppable markers: ADVERSARIAL CHALLENGER PASS, verifier_adversarial_rate, 9.6, PASS-WITH-GAPS, VERIFIER_ADVERSARIAL_FLIP"
    - "Phase-12 verify.mjs gains invariants 8 (MACH-04 config+SKILL.md), 9 (WR-01), 10 (WR-02), 11 (WR-03), 12 (patch script exists+syntax-parses), 13 (idempotency), 14 (SOFT-WARN D-04 classifier-skip count)"
    - "`node .planning/phases/12-machinery/verify.mjs` exits 0 with 13 hard invariants green + invariant 14 soft-warn"
    - "12-04-SUMMARY.md records Phase 12 close criteria and handoff — milestone v1.2 now 80% complete (4/5 phases)"
  artifacts:
    - path: ".planning/config.json"
      provides: "MACH-04 sampling rate config — 0.2 default, tunable to disable (0) or force (1)"
      contains: "atc.verifier_adversarial_rate: 0.2 (other atc fields preserved: enabled, tier_thresholds, etc)"
    - path: ".planning/phases/12-machinery/plans/12-04-01-verifier-contract-check.md"
      provides: "A2 assumption resolution — records current STATUS vocabulary + PASS-WITH-GAPS addition (if needed) + dual-gate decision"
      contains: "sections Agent File Path, Pre-edit STATUS Vocab, Post-edit STATUS Vocab, Dual-gate Decision"
    - path: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      provides: "New Step 9.6 — contrarian challenger after Step 9.5; gated on config.atc.enabled + verifier_adversarial_rate roll"
      contains: "greppable markers ADVERSARIAL CHALLENGER PASS (verbatim), verifier_adversarial_rate, 9.6, PASS-WITH-GAPS, VERIFIER_ADVERSARIAL_FLIP"
    - path: ".planning/phases/12-machinery/verify.mjs"
      provides: "Final Phase-12 verifier — invariants 1-14 (13 hard + 1 soft-warn per research §Q9)"
      contains: "Invariants 8 (MACH-04), 9 (WR-01 narrow-catch), 10 (WR-02 JSDoc), 11 (WR-03 SKILL-as-code regex), 12 (patch script), 13 (idempotency), 14 (soft-warn D-04 count)"
    - path: ".planning/phases/12-machinery/plans/12-04-SUMMARY.md"
      provides: "Phase 12 close: final verify state + milestone progress + handoff"
      contains: "sections MACH-04 Landing, Invariants 8-14 added, Final Verify State, Phase 12 Close Criteria, Commit SHAs"
  key_links:
    - from: ".planning/config.json"
      to: "super-gsd/skills/sgsd-orchestrate/SKILL.md Step 9.6"
      via: "config.atc.verifier_adversarial_rate + config.atc.enabled dual-gate"
      pattern: "verifier_adversarial_rate"
    - from: "super-gsd/skills/sgsd-orchestrate/SKILL.md Step 9.6"
      to: "gsd-verifier agent (contrarian prompt injection)"
      via: "Prompt composition: D-13a verbatim header + primary verifier prompt"
      pattern: "ADVERSARIAL CHALLENGER PASS"
    - from: ".planning/phases/12-machinery/verify.mjs"
      to: "All Phase 12 artefacts (invariants 1-14)"
      via: "require/grep across super-gsd/scripts/lib/*.cjs + templates/checkpoint.md + SKILL.md + config.json + patch script"
      pattern: "verify\\.mjs"
---

# Plan 12-04: Adversarial Verifier Sampling (MACH-04)

## Objective

Add MACH-04's 20%-sampled contrarian challenger pass. Config knob lands in
`.planning/config.json`; integration lands as new SKILL.md Step 9.6 (after per-dispatch ATC
at Step 9.5); Phase 12 `verify.mjs` gains the final 7 invariants (8-14) to consolidate the
complete verifier into a single ≥13-hard-invariant file.

Purpose: Satisfies **MACH-04** per D-13..D-15. Also consolidates verify.mjs to cover plans
12-05 and 12-06 artefacts (Wave 1, already landed). Wave 4 — serialized last per D-23
because MACH-04 integrates after MACH-03's `dispatches_summary.by_outcome.warn` schema
(research §Recommended Plan Decomposition ordering).

Output: 1 config edit + 1 SKILL.md new section + 1 contract-check note + verify.mjs
completion (inv 8-14) + 1 SUMMARY. Wave 4 — depends on 12-03.

## Tasks

Task breakdown follows 12-VALIDATION.md (3 tasks: 12-04-01, 12-04-02, 12-04-03).

### 12-04-01 — config.json + gsd-verifier STATUS vocab check (A2)

Resolve 12-RESEARCH.md §Open Question 1 (A2 assumption): read the gsd-verifier agent file
to confirm STATUS vocabulary includes `PASS-WITH-GAPS`. If absent, add it (one-line edit).
Add `verifier_adversarial_rate: 0.2` to `.planning/config.json` inside the existing atc
block. Record the contract-check result in
`.planning/phases/12-machinery/plans/12-04-01-verifier-contract-check.md` with the
dual-gate decision carried forward (§Open Question 2: gate on
`config.atc.enabled && Math.random() < config.atc.verifier_adversarial_rate`).

### 12-04-02 — SKILL.md Step 9.6 ADVERSARIAL CHALLENGER PASS

Author new Step 9.6 immediately after Step 9.5 per 12-RESEARCH.md §Q4 recipe. Inject the
D-13a contrarian prompt header VERBATIM inside a code fence (must grep literally).
Document all three D-13b verdict branches (PASS agreement, PASS-WITH-GAPS promotion, FAIL
auto-log-continue / interactive-stop). Reference the dual-gate explicitly. Matches
DLB-03-style structural injection pattern (precedent at SKILL.md:241-274).

### 12-04-03 — verify.mjs invariants 8-14 + Phase 12 SUMMARY

Append invariants 8 (MACH-04 config+SKILL.md marker), 9 (WR-01 narrow catch), 10 (WR-02
JSDoc), 11 (WR-03 skill-file-as-code regex), 12 (patch script exists + syntax-parses),
13 (idempotency — run patch script twice on fixture, hash-equal), 14 (SOFT-WARN: D-04
classifier-skip count, exit 0 regardless). All 13 hard invariants green on commit (plans
12-05 and 12-06 already landed in Wave 1, so invariants 9-13 artefacts exist). Invariant
14 is soft-warn per research §Q9 (expected-red until a v1 plan exercises the classifier-
skip path post-integration).

Produce 12-04-SUMMARY.md recording: MACH-04 landing, invariants 8-14 added, final verify
state (1-13 green + 14 soft-warn), Phase 12 close criteria met, commit SHAs.

## Verification Gates (Wave close / Phase close)

1. `node -e` config.json check → verifier_adversarial_rate numeric in [0,1] + atc.enabled preserved → exit 0
2. Contract-check note exists with STATUS section → exit 0
3. `grep -q "ADVERSARIAL CHALLENGER PASS" SKILL.md` → exit 0 (verbatim header)
4. `grep -q "verifier_adversarial_rate" SKILL.md` → exit 0
5. `grep -q "9.6" SKILL.md` → exit 0
6. `grep -q "PASS-WITH-GAPS" SKILL.md` → exit 0
7. `grep -q "VERIFIER_ADVERSARIAL_FLIP" SKILL.md` → exit 0
8. `grep -cE 'Invariant ([89]|1[0-4])\b' verify.mjs` ≥ 7
9. `node .planning/phases/12-machinery/verify.mjs` → exit 0 (invariants 1-13 hard green; 14 soft-warn)
10. 12-04-SUMMARY.md records Phase 12 close → grep exit 0

## Success Criteria

- All 3 task `verification_cmd`s exit 0.
- config.json valid + adversarial rate correctly ranged.
- SKILL.md Step 9.6 contains all 5 greppable markers + verbatim D-13a header.
- Phase-12 verify.mjs runs green (1-13 hard + 14 soft-warn).
- Phase 12 closes: 4 MACH reqs green + 3 ERG warnings closed + 1 installer shipped + ≥8
  invariants green.

## Output

`12-04-SUMMARY.md` records: MACH-04 landing verifier, Invariants 8-14 added, Final verify
state (1-13 hard green + 14 soft-warn), Phase 12 close criteria met (all 4 MACH reqs +
ERG-01/02 per wave schedule), Commit SHAs, Handoff — milestone v1.2 now 80% complete
(4/5 phases).

Per research §Risk 5: the challenger at 0.2 rate may NOT fire during Phase 12's own
verifier dispatch. That's expected. verify.mjs invariant 8 only checks config+SKILL.md
presence. "Fired at least once" is a milestone-close concern — future Phase 13 dashboard
can audit via `grep -r "Adversarial Challenge" .planning/phases/*/`.
