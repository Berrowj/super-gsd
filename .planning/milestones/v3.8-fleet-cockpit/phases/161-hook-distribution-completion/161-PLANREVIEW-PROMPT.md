# P161 plan review — single round, ATC + MUDA

Read only. Plan: `.planning/milestones/v3.8-fleet-cockpit/phases/161-hook-distribution-completion/161-01-PLAN-LOCKED.md`,
CONTEXT.md and HANDOVER.md section 13 beside it, `super-gsd/install.sh`,
`super-gsd/config/settings-overlay.json`, `super-gsd/scripts/sgsd-update.sh`,
the P160 guard suite.

Checks, in order of importance:
1. Does T3's SAC exercise the REAL sgsd-update path against the Clarity-shaped
   fixture (stale sgsd_managed entries at a systemd-only dir), requiring exit 0
   with global coverage live and .super-gsd-version advanced? A unit test of the
   copy loop alone is the named-insufficient AC.
2. Does anything weaken the P160 guard to make update pass? Any such change is
   CRITICAL — distribution catches up to the guard, never the reverse.
3. Is T2's completeness check manifest-vs-overlay (explicit shipped-hook
   manifest with intentionally-unregistered reasons allowed), not
   glob-inference? Does registering the five hooks respect existing native
   surfaces (statusLine, git pre-commit) rather than double-registering?
4. Red-first honest for each task; edits-first sandbox division stated.
5. MUDA: 3 tasks right-sized; every task revertable; P160 suite green in
   verification_cmds.

Output, contract lines first, then max 200 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
VERDICT: GO | GO-WITH-CHANGES | NOGO
REQUIRED_CHANGES: none | <numbered>
```
