# P148 Research — Cross-Model Triage (Codex second opinion + VTP fallback)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

Read-only phase researcher. Implementation-ready report. Do NOT write code.
You MUST read the files listed (reading is required); do NOT run
self-tests/benchmarks.

## Phase goal (CONTEXT.md)
`sgsd-triage` becomes two-model and self-healing:
1. Step 0 hardening: `vtp_route_and_retrieve` returning `reflection: null` OR
   <2 evidence hits → mechanical fallback to direct `vtp_search_substrate`
   with the raw query + a degradation row. (Null-reflection observed 3×
   2026-08-02→04; the router once rewrote a design question into "markdown
   patterns for <active_file>".)
2. Step 0.5 Codex verdict: classifier-gated dispatch via the P145 `triage`
   profile (read-only sandbox, non-ephemeral) with prompt = operator raw query
   + triage tier slice + VTP evidence framing + STATE frontmatter → structured
   `{path: A|B|C|D, risk_flags, missed_context, recommended_skills}`.
   Dispatch via codex-exec `--timeout-tier custom:300` (never bare --step —
   the 60s-cap trap).
3. Reconciliation: Claude's own classification vs Codex verdict; disagreement
   → BOTH surfaced with a recommendation, never silently resolved.
4. Auto-fire: the P146 UserPromptSubmit directive already routes planning
   prompts to /sgsd-triage in every session type.
Constraint: Codex failure/timeout → single-model triage + degradation row;
never blocks the operator.

## Carry-forwards (16 CRITICALs across P145-P147 in two classes)
- Writers derive containment ROOTS independently of targets
  (resolveContainedPath in sgsd-state.cjs); degradation is always a distinct
  reason-coded ROW (gate-evidence-log/envelope-v1), never bare stderr.
- Shipped resources resolve from __dirname, target repos from cwd/root.
- P145 built the codex profile registry: `triage` profile exists
  (read-only sandbox, non-ephemeral, no --full-auto). Verify its exact
  resolved flags via codex-profiles.yaml + profile-resolver.cjs.

## Read
- .planning/milestones/v3.5/phases/148-cross-model-triage/CONTEXT.md
- .planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md (#p148 +
  AC-148 verbatim)
- super-gsd/skills/sgsd-triage/SKILL.md (current triage flow — where do Steps
  0 / 0.5 / reconciliation slot in?)
- super-gsd/registry/codex-profiles.yaml + super-gsd/tools/codex-pro/profile-resolver.cjs
  (triage profile resolved flags)
- super-gsd/scripts/codex-exec.sh (dispatch surface: --profile triage,
  --timeout-tier custom:N, report contract enforcement — note DEVIATION-W:
  the 5-line ATC contract is enforced per --step; how should a TRIAGE verdict
  contract avoid exit-6 raw-stream dumps?)
- super-gsd/scripts/lib/sgsd-state.cjs + gate-evidence-log.cjs (reuse surface)
- .planning/metrics/vtp-health.jsonl tail (observed VTP degradation shapes)

## Questions
Q1. AC-148 verbatim + where each letter is provable.
Q2. Current sgsd-triage flow: exact steps, where VTP is called, where the
    tier classification happens, what artifact it writes. Cite lines.
Q3. The null-reflection failure: what does vtp_route_and_retrieve return
    exactly; what is the mechanical detection predicate; where does the
    fallback slot in; what row shape logs the degradation?
Q4. Codex triage dispatch: exact codex-exec invocation (profile, tier,
    contract). How does the wrapper's report-contract enforcement interact
    with a JSON verdict — new --contract vocab, or parse-from-stdout like the
    verifier? Recommend the least-invasive option given DEVIATION-W.
Q5. The verdict schema {path, risk_flags, missed_context, recommended_skills}:
    validation at the consuming end (never trust Codex output shape), and the
    degradation row when malformed.
Q6. Reconciliation UX: triage is INTERACTIVE (operator present). What exact
    output shape surfaces both verdicts on disagreement? Where is agreement
    logged (evidence row)?
Q7. Classifier gating: which triage invocations get the Codex second opinion
    (all? only planning-tier? cost budget)? CONTEXT says classifier-gated —
    find the intended gate.
Q8. Skill-file mechanics: sgsd-triage is a SKILL.md consumed by Claude — the
    two-model logic must live in instructions + a helper script Codex/Claude
    can run. What is the right split (SKILL.md prose vs .cjs helper)?
Q9. Risks: double-dispatch cost per triage, Codex latency in interactive flow
    (operator waiting!), profile drift, prompt-injection via operator query
    into the Codex dispatch.

## Report format (cite file:line; ≤1200 words)
1. AC-148 verbatim  2. Q1-Q9  3. Files to create/modify  4. Reuse inventory
5. Task decomposition (3-5 tasks)  6. Per-task verification commands
7. Open decisions for the planner
