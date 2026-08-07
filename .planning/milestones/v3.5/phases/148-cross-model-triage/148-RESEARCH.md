---
phase: "148"
artifact: RESEARCH
provider: openai-codex (gpt-5.5/xhigh)
wrapper_exit: 6 (contract-vocab mismatch; body valid — 1.1MB raw stream discarded)
---

**1. AC-148 Verbatim**
“AC-148: (a) planning-shaped prompt → triage fires with a Codex verdict row in `.planning/metrics/vtp-routing-log.jsonl`; (b) forced VTP null-reflection → fallback search runs and is logged; (c) Codex-unavailable → triage completes single-model with a logged degradation; (d) a seeded disagreement fixture surfaces both verdicts to the operator.” `.planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md:123`

**2. Q1-Q9**
Q1. Current proof points: P146 planning auto-fire is in design and hook registry (`DESIGN.md:67`, `session-governance-hooks.yaml:9`). P148 requirements for fallback, Codex verdict, reconciliation, and failure fallthrough are explicit (`DESIGN.md:109`, `DESIGN.md:113`, `DESIGN.md:116`, `CONTEXT.md:37`). Verdict rows/reconciliation are not implemented yet.

Q2. Current `sgsd-triage`: trigger/exclusions at `SKILL.md:16` and `SKILL.md:23`; Step 0 VTP enrichment at `SKILL.md:41`; calls composer, projects triage tier, then chooses substrate fast-path or route-and-retrieve at `SKILL.md:46-49`; parses response and writes `VTP-EVIDENCE.md` at `SKILL.md:51-52`; Step 1 brainstorm `SKILL.md:89`; Step 2 plan `SKILL.md:97`; Step 3 classifies A/B/C/D `SKILL.md:105`; Step 4 emits operator report `SKILL.md:174`.

Q3. `vtp_route_and_retrieve` returns `{context_summary, project_intent_state, routing_weights, query_frame, decision_matrix, expanded_queries[], retrieval_plan{...}, evidence{hits[], entities[], documents[]}, reflection|null}` `.planning/milestones/v1.3/phases/16-vtp-enrichment/16-RESEARCH.md:53`. Detection predicate: initial route call ok AND `(response.reflection === null OR evidence_hit_count < 2)` per `CONTEXT.md:21`. Slot fallback immediately after Step 0 route call, before Step 0 parse/write. Existing row fields are `event/status/tier/.../reflection_verdict/evidence_hit_count/top_doc_id/elapsed_ms` in `vtp-context-composer.cjs:232`; degradation should also append envelope-v1 via `logGateEvidence` (`gate-evidence-log.cjs:111`, `gate-evidence-log.cjs:170`). Tail evidence: `vtp-health.jsonl:1` only shows success; actual null-reflection shape is in `vtp-routing-log.jsonl:1`.

Q4. Invocation:
```bash
bash super-gsd/scripts/codex-exec.sh --profile triage --timeout-tier custom:300 --contract triage-verdict-v1 --prompt-file "$prompt" --report-out "$report" --project "$ROOT" --phase 148 --plan 148-01 --step triage-verdict
```
`triage` resolves to `gpt-5.5/xhigh/read-only/non-ephemeral/never` (`codex-profiles.yaml:137`, `profile-resolver.cjs:90`, `profile-resolver.cjs:417`). Wrapper profiles become `--sandbox read-only` without `--ephemeral` (`codex-exec.sh:686`). Add new `--contract triage-verdict-v1`; do not use default parser, which requires five review lines and exits 6 on JSON (`codex-exec.sh:203`, `codex-exec.sh:1044`, `codex-exec.sh:1137`). Existing `rd-memo-v1` proves contract vocab extension is local precedent (`codex-exec.sh:1055`).

Q5. Validate Codex output twice: wrapper contract extracts one JSON object and schema-validates; consuming helper revalidates. Required: object, `path` in A/B/C/D, arrays for `risk_flags`, `missed_context`, `recommended_skills`, bounded strings, no execution of recommendations. Malformed → single-model triage plus `triage_codex_degraded` envelope row with `reason_codes:["codex_verdict_malformed"]`.

Q6. Disagreement UX:
```text
TRIAGE: ...
Claude classification: Path B — ...
Codex verdict: Path A — risks: ...; missed_context: ...; skills: ...
Recommendation: ...
Operator decision required: accept Claude path, accept Codex path, or keep discussing? (y/N)
```
Agreement logs `triage_reconciliation` with `reason_codes:["codex_claude_agree"]`; disagreement logs `codex_claude_disagree`. Never auto-fire; current skill already says operator decides (`SKILL.md:189`).

Q7. Intended gate is P146 `planning-triage`: lexical route emits `/sgsd-triage` (`session-governance-hooks.yaml:9`, `session-governance-hooks.yaml:38`; classifier emits directives/logs at `sgsd-intent-classifier.cjs:401`). No cost budget found; run Codex for planning-gated triage, not trivial/direct/execution prompts.

Q8. Split: `SKILL.md` owns prose order, operator UX, and fallback discipline. New `.cjs` helper owns STATE read, containment, VTP fallback, prompt construction, Codex dispatch, schema validation, and evidence rows. This avoids ad hoc Claude logic while using current Bash allowance (`SKILL.md:4`).

Q9. Risks: doubled gpt-5.5/xhigh cost, up-to-300s interactive latency, profile drift, and prompt injection. Mitigate with P146 gate, compact prompt, resolver checks, structured JSON prompt/report files, schema validation, and no automatic skill execution.

**3. Files To Create/Modify**
Modify `super-gsd/skills/sgsd-triage/SKILL.md`, `super-gsd/scripts/codex-exec.sh`, `super-gsd/scripts/lib/vtp-context-composer.cjs`. Create `super-gsd/scripts/sgsd-triage-runtime.cjs` and `super-gsd/scripts/lib/triage-verdict-schema.cjs`.

**4. Reuse Inventory**
Reuse `callVtp/project/compose`, `resolveContainedPath/readState`, `logGateEvidence`, `codex-exec --profile/--timeout-tier`, P146 classifier registry, and `rd-memo-v1` contract pattern.

**5. Task Decomposition**
1. Harden VTP fallback and degradation rows.
2. Add `triage-verdict-v1` contract and schema.
3. Add triage runtime helper for Codex dispatch and reconciliation.
4. Update skill prose and installer sync.
5. Add fixtures for null-reflection, Codex unavailable, malformed verdict, disagreement.

**6. Verification Commands**
Do not run now. Planner should use:
```bash
node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test
node super-gsd/scripts/lib/triage-verdict-schema.cjs --self-test
bash super-gsd/scripts/codex-exec.sh --self-test --skip-network
node super-gsd/scripts/sgsd-triage-runtime.cjs --self-test
node super-gsd/tools/codex-pro/profile-resolver.cjs --resolve-cli triage
```

**7. Open Decisions**
Should AC-148(a)’s Codex verdict row really live in `vtp-routing-log.jsonl`, or should success/reconciliation be envelope-v1 in `gate-evidence.jsonl` with VTP-only rows left untouched? Also decide whether explicit manual `/sgsd-triage` always gets Codex, and where prompt/report artifacts live.

