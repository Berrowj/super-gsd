---
phase: "168"
slug: install-contract
milestone: v4.0-install-contract
status: PASS-WITH-DEFERRED-1
closed: 2026-08-25
closed_at: 88207e0
gates:
  plan_review: GO (rev 2)
  spec_t1: PASS
  spec_t2: PASS
  verifier: GOAL_MET YES, PASS
  phase_atc: FAIL, CRITICAL deferred to P169
  muda: WARN
  install_contract_suite: 5/5
  installer_guard: 13/13
deferred:
  - atomic multi-root install transaction (phase ATC CRITICAL; challenge-adjudicated; P169)
---

# P168 Install Contract

## What changed for the operator

An SGSD project install now delivers the modules its hooks require. A real
`install.sh --init-project` into an empty project delivers 17 hooks and 9
`scripts/lib` modules, with the dependency closure computed by lexing hook sources,
transitive requires, hook-to-hook edges and the witness composer/store included, and the
manifest generated from the same computation so the two cannot disagree. This closes the
five-cycle failure where hooks travelled and the code they require did not.

The install smoke now asserts loadability, executing every installed hook so a
MODULE_NOT_FOUND fails the install in front of the operator, naming the exact module,
with the real bounded error carried beside the reason code. A truncated smoke capture
cannot read as a clean policy decision.

`bash super-gsd/install.sh --doctor [--project-dir PATH]` is a strictly read-only
status command, byte-identity asserted, exit codes 0/10/2/1 each reachable and tested.
The worktree-blind freshness check is fixed: a git worktree now reports its real HEAD and
an actual comparison against GitHub master instead of "not a git repo".

## The one deferred item

A refused install can still leave published bytes when repair or Codex registration
refuses after publication. Three fix shapes failed against a genuine circular dependency
with P167's installed-witness validation, and the adversarial challenge rejected the
cheap rollback with evidence. The sound fix is a durable multi-root transaction, seeded
as P169 with the challenge's fault-injection and SIGKILL matrix as its spec. Until P169,
a FAILED install may need a re-run to converge; a SUCCESSFUL install is complete and
verified.

## Cost

~24 dispatches, two wholesale reverts, five in-phase defect escapes, three gate rounds on
spec and two on ATC. Six memories curated so the recurring classes are recallable:
mutate-then-refuse, error-laundering, executor over-reach, the auth-denied false
positive, the first-dispatch stop-rule.
