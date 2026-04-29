---
phase: 92
phase_name: Oz Environment Spec
milestone: v2.7
created: 2026-04-29
status: in-progress
deviation_from_standard: docs phase
---

# Phase 92 -- CONTEXT

Spec the Warp Oz cloud environment for running Phase 91 cloud-safe audits.
Pure docs; this phase does NOT provision cloud envs — that's operator-led.

## Locked Scope

- D92.1: SGSD-OZ-ENVIRONMENT-SPEC.md authored.
- D92.2: Environment profile `sgsd-cloud-audit-v1` defined (base image / repos / setup / runtime config / allowed/forbidden secrets).
- D92.3: Each runtime knob justified (why Alpine, why no PowerShell, why no VTP, etc.).
- D92.4: Allowed audits matrix maps to Phase 91 CS-01..CS-05.
- D92.5: Operator flow + env lifecycle + spec validation criteria documented.
- D92.6: Hard boundary explicit: divergence from Phase 91 default-local = regression.

## Outputs
- super-gsd/docs/SGSD-OZ-ENVIRONMENT-SPEC.md
- 5 Phase 92 standard artifacts

## Acceptance
1. Environment profile complete.
2. 6 runtime knobs justified.
3. 5-audit matrix references Phase 91 CS-01..CS-05.
4. Forbidden secrets explicit.
5. Forward refs to Phase 93/96/97.
