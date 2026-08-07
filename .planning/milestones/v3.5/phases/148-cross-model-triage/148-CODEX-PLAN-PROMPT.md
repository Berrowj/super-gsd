# P148 Planning — author 148-01-PLAN-LOCKED.md (schema-v2)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

Author ONE plan file to
`.planning/milestones/v3.5/phases/148-cross-model-triage/148-01-PLAN-LOCKED.md`.
If the sandbox cannot write, emit the COMPLETE file in ONE fenced ```markdown
block. Output the plan ONLY. Do NOT re-derive research or run self-tests.

## Required reading
1. CONTEXT.md + 148-RESEARCH.md (Q1-Q9 authoritative) + 148-VTP-ENRICHMENT.md
   (rationale-mandatory directive is BINDING) — all in this phase dir
2. super-gsd/templates/plan-schema-v2.json (must validate)
3. .planning/milestones/v3.5/phases/147-commit-seam-gate/147-01-PLAN-LOCKED.md
   (SHAPE reference — P147's plan went GO first pass; follow its rigor)

## Source Audit: one row per source incl. VTP (success, low-yield 1 hit).

## Hard requirements
Schema-v2 VALID with real-data semantic_acceptance_criteria + rollback_plan.

**ANTI-STUB (the standing bar):** every AC drives a REAL entrypoint against a
CONSTRUCTED fixture with values only a real read could produce + negative
controls. For this phase specifically:
- AC-148a: a real planning-shaped invocation must produce a Codex verdict row
  in `.planning/metrics/vtp-routing-log.jsonl` — with Codex FAKEABLE via the
  fixture (a stub codex binary on PATH returning a canned verdict, like the
  codex-exec self-test's SGSD_FAKE_CODEX_MODE precedent) so the test does not
  burn a real dispatch;
- AC-148b: FORCE null-reflection (fixture VTP response with reflection:null)
  → fallback runs + degradation row with the exact predicate reason;
- AC-148c: codex binary absent/failing → single-model completion + degradation
  row, operator never blocked;
- AC-148d: seeded disagreement (canned verdict path ≠ fixture classification)
  → BOTH verdicts surfaced WITH rationale on all three lines (VTP directive:
  a path letter without a why is a contract violation).

**Design decisions RESEARCH already made — bake them in, do not re-open:**
- `--contract triage-verdict-v1` extending codex-exec's contract vocab
  (rd-memo-v1 precedent at codex-exec.sh:1055); wrapper extracts ONE JSON
  object + schema-validates; consumer REVALIDATES (never trust shape);
- dispatch: `--profile triage --timeout-tier custom:300` (never bare --step);
- new `super-gsd/scripts/sgsd-triage-runtime.cjs` helper owns STATE read,
  containment, VTP fallback, prompt build, dispatch, validation, evidence
  rows; SKILL.md owns prose order + operator UX;
- new `super-gsd/scripts/lib/triage-verdict-schema.cjs` for the shared schema;
- VTP fallback predicate: route ok AND (reflection===null OR hits<2) →
  direct vtp_search_substrate + degradation row;
- Codex gating: only planning-gated triage invocations (P146 route), not
  trivial/execution prompts.

**Carry-forwards (16 CRITICALs, two classes):** containment roots derived
independently (resolveContainedPath); every degraded path a reason-coded
envelope row via logGateEvidence; shipped resources from __dirname; malformed
external output (Codex verdict!) degrades observably, never silently.

**Prompt-injection note (RESEARCH Q9):** the operator's raw query goes INTO
the Codex prompt. The runtime must frame it as data (fenced/JSON-embedded),
instruct Codex to treat it as content not instructions, and the verdict
consumer must enforce the closed path vocabulary regardless of prompt content.

## Tasks: follow RESEARCH §5 (5 tasks) unless concretely better; serial
depends_on chain; owning task per shared file; deterministic Windows-safe
verification per task. Record carried-forward: DEFERRED-G, DEVIATION-W
(NOTE: triage-verdict-v1 CLOSES DEVIATION-W for the triage dispatch class —
say so; research/verify steps remain affected and stay deferred).

Output: the plan file only.
