# P147 PHASE-ATC RE-REVIEW — confirm CRIT-1 closed

You MUST read the files below (reading is required). Do NOT run anything.
Emit the 5 contract lines FIRST.

## Files
- super-gsd/scripts/install-commit-gate.cjs (trampoline generation)
- super-gsd/hooks/sgsd-commit-gate.cjs (runtime target-root consumption)

## Prior CRIT-1 — confirm CLOSED or OPEN with line evidence
Trampoline hardcoded install-time SGSD_REPO_ROOT + cd, so sibling-worktree
commits were judged against the installing worktree with misattributed
evidence rows.
Fix claims: trampoline derives target root at runtime via
`git rev-parse --show-toplevel`, fails open loudly when absent, passes
SGSD_COMMIT_GATE_TARGET_ROOT; the node hook resolves its SGSD root from that.

## Host evidence (do NOT re-run)
21/21 scenarios incl. NEW installer-linked-worktree-target-root (install once
from main, commit unbacked source in a SIBLING SGSD worktree → warn row lands
in the SIBLING ledger, not the main's) and large-diff-truncated-hash
(multi-MB staged file → bounded streamed hash, diff_hash_truncated_32mb).

## Regression checks
- Can SGSD_COMMIT_GATE_TARGET_ROOT be abused (attacker-set env at commit
  time) to redirect evidence to an arbitrary root? Note appendShadowRow's own
  containment still applies — judge whether that suffices.
- Does the refresh path update OLD-shape SGSD-marked hooks idempotently?
- Prior WARN (buffering) genuinely closed by streaming+cap?

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <summary>
FINDINGS_DETAIL: [severity] [dimension] <description>
