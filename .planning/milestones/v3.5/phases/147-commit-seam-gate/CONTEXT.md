---
phase: "147"
slug: commit-seam-gate
milestone: v3.5
status: PENDING
design_ref: ".planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md#p147"
depends_on: ["146"]
---

# P147 Context — Commit-Seam Gate (warn → earned block)

## Goal

The eventual blocking control lives at the commit seam (board architect's third
design): `super-gsd/hooks/sgsd-commit-gate.cjs` as installer-managed git
pre-commit hook. One invocation per commit, full `git diff --cached` evidence,
failure mode "commit refused, files intact" — never "cannot touch source".

## Behaviour

- **Warn mode (ships enabled):** source-touching commit without phase evidence
  (PLAN-LOCKED + ATC/AUDIT artifacts for active phase) → loud governance warning
  + shadow row in `.planning/metrics/commit-gate-shadow.jsonl`.
- **Block mode (earned only):** activates ONLY when
  `sgsd-commit-gate.cjs --shadow-report` shows the board falsifier met:
  ≥200 real payloads across GSDedits AND devcp, false-block rate <5% against
  each repo's actual artifact naming. Activation is an explicit operator step
  informed by the report — never silent.
- **Sentinel:** `.sgsd-gate-off` skips block and logs that it did.

## Constraints (board-binding)

- Artifact predicates must match REAL naming per repo ({NN}-*-PLAN-LOCKED.md
  here; devcp's own convention discovered, not assumed — the original plan's
  PLAN.md/AUDIT.md predicate was false-positive on day one).
- Rollback path must not pass through the gate itself (board: self-locking
  rollback). Uninstall = remove hook file; documented.
- Hook must exit 0 in non-SGSD repos and on internal error (fail open, loudly).

## Acceptance criteria

AC-147 (a)(b)(c)(d) from the design spec.
