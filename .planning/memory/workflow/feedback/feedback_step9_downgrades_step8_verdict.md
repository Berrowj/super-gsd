---
name: Step 9 phase-level ATC can downgrade Step 8 verifier verdict
description: After gsd-verifier writes PASS to VERIFICATION.md (Step 8), the phase-level ATC at Step 9 may raise findings or surface provider_unavailable. The orchestrator MUST update VERIFICATION.md status retroactively before committing phase close — Step 8's verdict alone is insufficient.
type: feedback
discovered: 2026-04-26
discovered_during: Phase 26 close (v1.6)
---

# Pattern: Step 9 phase-level ATC can downgrade Step 8 verifier verdict

**Why:** Step 8 (gsd-verifier) checks goal-backward goal achievement.
Step 9 (phase-level ATC) is adversarial peer review — it can find issues
the verifier didn't surface, or it can surface provider_unavailable when
Codex/Claude side fails. Either path may push the phase status from
`PASS` to `PASS-WITH-DEFERRED-N` or `CANDIDATE-WITH-DEBT`.

**How to apply:**

1. Order matters: dispatch Step 8 verifier first; Step 9 phase-level ATC second.
2. After Step 9 completes, ALWAYS re-evaluate Step 8's status string against:
   - Step 9 reviewer findings (CRIT/WARN — fix in-loop or backlog)
   - Step 9 provider availability (Codex unavail → backlog row → status downgrade)
   - CRIT-BACKLOG.md content for this phase
3. Update VERIFICATION.md frontmatter status BEFORE committing phase close.
4. Run `node super-gsd/tools/status-consistency/check.cjs --phase NN --milestone vX.Y` as the gate. Must exit 0.

**Concretely from Phase 26 (v1.6):**

- Step 8 verifier wrote `status: PASS` (verifier was honest given inputs at the time).
- Step 9 phase-level ATC raised W1 (fixed in-loop, no backlog row) AND surfaced Codex `provider_unavailable` (1 backlog row).
- Status updated retroactively from `PASS` → `PASS-WITH-DEFERRED-1`.
- Status-consistency check then passed (F2 rule: claimed N matches actual non-edge_guard count).
- Without this update, F1 rule would have failed (PASS + non-empty backlog = inconsistency).

**What NOT to do:** treat Step 8's verdict as final. The dual-provider review
contract (Codex + Claude) means Step 9 has independent authority to surface
issues Step 8 missed.
