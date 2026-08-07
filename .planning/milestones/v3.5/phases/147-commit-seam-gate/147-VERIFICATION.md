---
phase: "147"
artifact: VERIFICATION
provider: openai-codex (gpt-5.5/xhigh)
wrapper_exit: 6 (contract-vocab mismatch; body valid — raw stream discarded)
---

# P147 Verification — Commit-Seam Gate

## Verifier verdict (as returned)

status: gaps_found
goal_achieved: partial
evidence: AC-147a → super-gsd/hooks/sgsd-commit-gate.cjs:359,407-413 + super-gsd/scripts/lib/commit-gate-shadow-log.cjs:327-344 + super-gsd/scripts/lib/sgsd-artifact-conventions.cjs:409-430 → normal warn rows append and devcp can be runtime-discovered, but devcp proof can be vacuous; AC-147b → super-gsd/hooks/sgsd-commit-gate.cjs:515-518 + super-gsd/scripts/lib/commit-gate-shadow-report.cjs:356-368 → passed; AC-147c → super-gsd/hooks/sgsd-commit-gate.cjs:526-543 → activation CLI guarded, but readCommitGateMode at 274-277 trusts any `{mode:"block"}` file → gap; AC-147d → super-gsd/hooks/sgsd-commit-gate.cjs:328-345,397-401 → normal sentinel rows include waived_paths, but append failure can leave only stderr → caveat.
gaps: mode-file trust bypasses earned activation; falsifier does not require nonzero per-repo/source payloads, so devcp can be present without meaningful devcp warn history; appendShadowRow failure is ignored when returning block, so an internal writer failure can still block and fail to persist the row; devcp structural readiness depends on avoiding the `_stateLooksLikeGsdedits` super-gsd heuristic.
DEVIATIONS: devcp has no live rows yet by scope; .planning/STATE.md still current_phase 146; plan SAC says `staged_paths[0].path` but source row contract uses string arrays.
ONE_LINER: Exercised paths work, but the source does not yet prove earned block mode or devcp accumulation non-vacuously.

I did not run tests, git, node, bash, or benchmarks, per instruction.

**Key Findings**
1. **Earned block is not enforced at read time.** `--activate-block` correctly recomputes the report and refuses failures, but the hook later treats any readable JSON with `mode: "block"` as active. That means a manually created or staged `.planning/config/commit-gate-mode.json` can activate blocking without a passing falsifier or `mode_activated` row.

2. **The report can be semantically vacuous for devcp.** Required repos are checked by repo key, and the 200 payload threshold is global. There is no per-required-repo minimum and no `source_touching_count > 0` requirement. A repo with zero source samples gets a 0 false-block rate, which is mechanically true but not evidence.

3. **Writer failure is loud, but not decision-affecting.** Warn still prints after `appendRow()`, so the warn path is not silent. In block mode, though, the hook ignores whether the row actually persisted and can still return the earned-block exit. That conflicts with the board constraint that internal errors exit 0 loudly.

4. **devcp is mostly structurally ready, with one risky heuristic.** Generic repo-local discovery exists and unknown convention never blocks. The remaining GSDedits assumption is `_stateLooksLikeGsdedits()`: any repo with `super-gsd/` plus v-style state is treated as GSDedits before generic discovery.

**Self-Lock Audit**
Mitigated: Node missing fail-open, hook script missing fail-open, sentinel addition, pure sentinel removal, unmarked existing hook refusal, uninstall outside Git, non-SGSD exit 0, top-level internal catch exit 0.

Not fully mitigated: block mode can be enabled by a bare mode file, and append failure can still accompany a blocking decision.

## Orchestrator resolution (post-verification, all gaps CLOSED)

**GAP-1 mode-file trust — CLOSED.** Activation records now carry activated_at/
activated_by/report_summary + sha256 integrity digest; readCommitGateMode
validates shape+digest; bare `{mode:"block"}` and single-digit-tampered files
both degrade to warn with `mode_file_invalid` rows (proven by scenario: tamper
one digit of the payload count → warn, not block).

**GAP-2 vacuous devcp — CLOSED.** Per-required-repo payload floor +
`source_touching_count > 0` (`insufficient_repo_payloads_*`,
`no_source_evidence_*` reason codes); global ≥200 and per-repo <5% retained.

**GAP-3 block-without-persisted-row — CLOSED.** Block exit returns ONLY when
the decision’s shadow row persisted; writer failure degrades to warn with loud
stderr naming the suppressed block.

**GAP-4 devcp misclassification — CLOSED.** Artifact evidence outranks the
directory heuristic; `convention_basis` field distinguishes
`artifact_evidence` from `heuristic`.

Post-fix evidence: full suite 19/19 host-side (two activation scenarios
initially failed on a test-fixture bug the gap fix introduced — staging into a
non-git fixture — fixed at line 1254, gsd side now a real git fixture).

status: passed (post-fix)
goal_achieved: yes
gaps: none open
ONE_LINER: Earned block is now unforgeable-in-practice (tamper-evident), the
falsifier cannot pass vacuously, blocks require persisted evidence, and devcp
discovery is evidence-based; 19/19 scenarios.
