# P162 Audit — evidence gate record

Audited 2026-08-21 at phase close, orchestrator-verified.

- Plan GO-WITH-CHANGES round 1 (traceability only), AMENDMENT-1, validate exit 0.
- T1 (bc58e6f): discovery/cache/roll-up, 4/4 named cases.
- T2 (af9d836): status derivation with the five product filters as contractual
  fixtures + precedence case; 10/10.
- T3 (7998b25): read-only HTTP service, verbatim snapshots, healthz, wrapper,
  operator doc; suite 215/215.
- Close review: BLOCKED, 3 CRITICAL (stale-attention persistence, tick pile-up,
  bind proof) + artifacts field mismatch — all four fixed in ONE round
  (8410974); suite 229/229 passed, 1 loud skip.
- The single skip is honest: real_default_bind on 127.0.0.1:7777 skips loudly
  because the Voice-Text-Plan cockpit-sidecar legitimately holds 7777 on this
  box (PID-verified). Recorded as an operator decision (default-port collision
  with SGSD's own sidecar).
- Adapter baseline untouched: cockpit-state self-test 19/19, git-clean.

Verification commands of record (2026-08-21):

    node super-gsd/tools/fleet-cockpit/run-self-test.cjs   # 229/229, 1 skipped
    node super-gsd/tools/cockpit-state/run-self-test.cjs   # 19/19
