---
phase: 80
phase_name: Warp Plan To SGSD Phase Scaffold
milestone: v2.5
created: 2026-04-29
status: in-progress
deviation_from_standard: code phase (FULL tier)
---

# Phase 80 -- Warp Plan To SGSD Phase Scaffold (CONTEXT)

## Goal

Implement `super-gsd/tools/warp-plan-converter/convert.cjs` that
takes a Warp Plan markdown export and produces draft SGSD milestone
folder + phase stubs. **NEVER mutates STATE.md or active milestone.**
Generated files are marked DRAFT and live under `.planning/analyses/`
(or a designated draft location) for operator review.

## Locked Scope (D80.1-D80.6)

- D80.1: Input format = Warp Plan markdown export with frontmatter
  (`title:`, `created:`) + sections beginning `## Phase N:` followed by
  bullet lists describing tasks.
- D80.2: Output = draft phase folders under
  `.planning/analyses/<ISO>-warp-plan-import/<draft-milestone>/phases/<NN>-<slug>/`
  with: `<NN>-CONTEXT.md` (DRAFT marker + Warp plan source quote),
  `<NN>-01-<slug>-PLAN.md` (DRAFT marker + task scaffolding),
  `<NN>-RESEARCH.md` (DRAFT TODO markers for Claude research).
- D80.3: Each generated file carries `status: draft` frontmatter and a
  prominent `<!-- DRAFT - operator review required before promoting to active -->` comment.
- D80.4: Converter does NOT touch `.planning/STATE.md`,
  `.planning/milestones/{active}/ROADMAP.md`, or any active milestone
  folder. Verified by selfTest.
- D80.5: Acceptance criteria prompts: each generated PLAN includes a
  prominent "## Acceptance (TODO)" section with checkbox bullets the
  operator fills in before activation.
- D80.6: Lock-13 + READ-ONLY-on-active-state + ASCII-only.

## Inputs

- `super-gsd/tools/upgrade-drift/check.cjs` — pattern source for Lock-13 / frozen vocab
- ROADMAP-AGENT.md standard phase artifact set (CONTEXT/PLAN/RESEARCH/VERIFICATION/ATC-REVIEW) — what to scaffold

## Outputs

- super-gsd/tools/warp-plan-converter/convert.cjs (NEW)
- super-gsd/tools/warp-plan-converter/run-self-test.cjs (NEW)
- super-gsd/tools/warp-plan-converter/fixtures/*.md (NEW; 2-3 fixture Warp plans)
- 5 Phase 80 standard artifacts

## Acceptance

1. `node super-gsd/tools/warp-plan-converter/run-self-test.cjs` exits 0.
2. Converting a fixture Warp plan produces draft folder under
   `.planning/analyses/<ISO>-warp-plan-import/...` with N phase
   directories + scaffold files.
3. STATE.md / active milestone unchanged after conversion (verified).
4. Each generated PLAN has TODO markers + Acceptance checkbox section.
5. Lock-13: bad input / corrupt markdown / missing target dir → degraded.
6. ASCII-only.
