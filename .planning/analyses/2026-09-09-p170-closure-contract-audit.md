# P170 closure contract audit — 2026-09-09

Status: read-only source/artifact audit; no validator, gate, model review or acceptance was executed. This document records prospective reconciliation, not a phase PASS or activation authority. Paths below are repository-relative; plan basenames refer to `.planning/milestones/v4.1-token-economics-atlas/phases/170-atlas-capture-foundation/`.

## Minimum prospective reconciliation

1. Amend only the six schema-incomplete plans: `170-02-GLOBAL-PLAN.md:1`, `170-03-WORKER-PLAN.md:1`, `170-04-ROLLOUT-PLAN.md:1`, `170-05-LINUX-REPAIR-PLAN.md:1`, `170-06-NATIVE-ACCOUNTING-PLAN.md:1`, and `170-07-TRIAL-READINESS-PLAN.md:1`. Add schema version 2 and structured entries mirroring their existing prose tasks, not new source authority. Each task requires `id`, `agent`, `model`, nonempty `files_touched`, `input_contract`, `output_contract`, `hypothesis`, `falsifier`, and `stop_rule`. Add substantive SAC entries with `input`, `expected_outcome`, and an actual supported `verification_cmd`. Convert `170-05:9` scalar `depends_on` to an array. Contract: `super-gsd/templates/plan-schema-v2.json:6`, `:19`, `:45`, `:64`, `:81`.
2. Preserve original revisions, failed/blocked acceptance outcomes, unchecked historical attempts, reports and manifests. Date the reconciliation prospectively; distinguish historical implementation from subsequently verified acceptance. Link superseding evidence to exact retained 170-08 B0–B7 artifacts and 170-09 raw launch/native provenance only after these genuinely exist and pass their prescribed independent checks. Do not replace observed failures with booleans, invent historical dispatch identifiers, or manufacture completion dates. A failed historical run remains failed even if a later revision succeeds.
3. `170-01-PLAN-LOCKED.md:2`, `:69`, `:84` already has structured schema. Its SAC commands at `:72`, `:75`, `:78` are supported but select synthetic self-test suites (`super-gsd/tools/telemetry-atlas/run-self-test.cjs:14`, `:32`; temporary fixtures in `store.test.cjs:12`). Preserve these as implementation evidence. Prospectively reconcile real-behavior SAC claims with retained original acceptance bytes, recomputed hashes and existing contract/accounting checks. Merely asserting a summarized PASS is insufficient. The audit consumer requires real-data execution (`super-gsd/skills/sgsd-audit/SKILL.md:275`); a wrapper lacking a literal fixture path does not turn its internal fixtures into live evidence. The legacy fall-through at `:263` is not a reconciliation strategy.

The validator actually fails invalid frontmatter with exit 1 (`super-gsd/tools/plan-schema/validate.cjs:414`). Its `--mode load` is a telemetry context tag, not a read-only mode: success also appends `.planning/metrics/plan-errors.jsonl` (`:437`). Root owns any later validation.

## Discovery and missing evidence

The current workflow discovers `170-*-PLAN.md`, expects the matching basename with `PLAN.md` replaced by `SUMMARY.md`, then expects `170-VERIFICATION.md` (`super-gsd/workflows/dispatch-table.md:67`). Executor reports and `170-08-LINUX-COMPLETION-REPORT.md` do not satisfy those filenames. At inspection, matching per-plan summaries, `170-VERIFICATION.md`, `170-ATC-REVIEW.md`, phase `AUDIT.md`, phase `SUMMARY.md`, and `WASTE.md` were absent. Existing numbered 170-08 task ATC reports are not proof of a whole-phase ATC.

Author truthful per-plan summaries only from reconciled requirements and actual evidence; explicitly retain unresolved/deferred scope. The workflow glob excludes `170-01-PLAN-LOCKED.md`: include that exact file in the review input inventory rather than renaming/deleting it or silently omitting its requirements. Discovery differs between consumers: `super-gsd/scripts/lib/orchestrator-hooks.cjs:255` includes locked plans, but there it only derives phase type.

`super-gsd/tools/phase-close/check.cjs:184` resolves the milestone/phase folder, then requires exact `AUDIT.md` and `SUMMARY.md` (`:201`). With the inspected files, its first missing-artifact refusal would be `audit_missing`. Summary frontmatter requires matching phase/slug/milestone, a completion-shaped status, real closure date, nonempty commit hashes and a nonempty scalar gate mapping (`:133`). The checker does not prove those verdicts or parse the audit's substantive result. The executing routing consult invokes this shape contract before scheduling routes (`super-gsd/scripts/lib/orchestrator-hooks.cjs:969`). Placeholder PASS artifacts would therefore be a false proof, not a legitimate prerequisite repair.

## Scope boundaries that must survive reconciliation

- Windows remains required follow-up, not a Linux skip PASS (`170-04-ROLLOUT-PLAN.md:75`, `170-05-LINUX-REPAIR-PLAN.md:180`, `170-06-NATIVE-ACCOUNTING-PLAN.md:206`).
- Operator smoke of every launch mode after updating each machine remains unchecked (`170-02-GLOBAL-PLAN.md:65`). Linux acceptance cannot complete that as an all-machine claim.
- Capture-foundation exit requires a live calibration session producing content-free Claude request and quota-availability evidence with no extra model call. Worker transport/native-usage records alone do not establish both requirements (`.planning/analyses/2026-09-03-sgsd-token-economics-atlas-design.md:828`).
- The 24-hour denominator/resource soak belongs to correlation-spine exit, not the prerequisite for beginning P171 (`.planning/analyses/2026-09-03-sgsd-token-economics-atlas-design.md:833`).
- Two complete seven-day windows govern averages/recommendations, not immediate software implementation completion (`2026-09-03-sgsd-token-economics-atlas-design.md:807`). `170-08-LINUX-COMPLETION-PLAN.md:150` and `:288` retain these separate states.

## Existing sequence, not a new gate

Reconcile plans and evidence inventory; run existing schema validation; complete genuine Linux acceptance and task reviews; run the existing verifier and whole-phase ATC; obtain passing audit evidence and author the canonical phase summary; execute the existing phase-close routing consult, including registered MUDA eligibility and actual execution outcomes; only then use the existing state-write owner and dependency rules for P171. Do not reimplement gates, predeclare MUDA PASS, or activate P169/P171 through this document.

Existing ownership/order: `super-gsd/skills/sgsd-orchestrate/SKILL.md:1281`, `:1530`, `:1791`, `:1818`, `:1875`. Root must use the complete existing procedures and actual outputs; this audit is not their substitute.
