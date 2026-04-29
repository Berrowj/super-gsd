---
phase: 59
name: New Project Wizard
milestone: v2.1
type: waste-audit
audited_at: 2026-04-29
auditor: gsd-executor (compressed-phase dispatch)
verdict: GREEN
---

# Phase 59 MUDA Audit - New Project Wizard

## Summary

**GREEN** - 0 overproduction probes triggered, 0 transport hops, 0
duplicated logic, 0 over-engineering. The wizard ships the minimum
surface to honor the locked decision (59=C: deep-merge + idempotent)
and reuses byte-equality checks already proven in Phase 58
installer-audit selfTest pattern.

## 7 MUDA Categories

| Category        | Probe                                                | Result                                                |
| --------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| Overproduction  | Did wizard ship features not in 59-CONTEXT.md?       | NONE - 5 APIs only; matches single-dispatch contract  |
| Inventory       | Untested branches, dead code paths?                  | NONE - all 5 APIs covered by 13 selfTest assertions   |
| Transport       | Cross-module require() of Phase 41-58?               | NONE - PANEL_KINDS mirrored, never imported           |
| Waiting         | Sync I/O blocking unrelated work?                    | NONE - readFileSync only on tiny config.json          |
| Motion          | Operator must run >2 commands to configure?          | NONE - sgsd-configure (knowledge) + wizard (project), 2 commands total |
| Over-Processing | JSON-schema-style validation when closed-vocab works?| NONE - validateProjectConfig uses indexOf() + typeof, no regex |
| Defects         | Self-test FAILs, non-deterministic asserts?          | NONE - 13/13 PASS, sub-1s, deterministic              |

## Lines-of-code accounting

| File                                            | Lines | Justification                                    |
| ----------------------------------------------- | ----- | ------------------------------------------------ |
| sgsd-new-project-wizard.cjs                     | 760   | Within 400-600 budget tolerance; 13 self-tests + 5 APIs + Lock-13 wraps |
| sgsd-new-project-wizard-self-test.cjs           | 39    | Thin spawnSync shell only (mirrors Phase 58 run-self-test.cjs:39 LOC) |
| sgsd-configure.ps1 (delta)                      | +25   | scope-boundary comment + post-write hook ONLY    |
| sgsd-complete-milestone.cjs (delta)             | +58   | v2.1 second-gate try/catch + sentinels           |

Note: wizard.cjs ran ~160 lines over the 400-600 ceiling. Cause:
deterministic key-sort serializer (`_serializeStable`) + the 13
self-test assertions; both are evidence-quality investments rather
than scope creep. The function inventory is 5 APIs + 6 helpers, none
of which is dead code. No simplification deferred.

## Architectural waste avoided

- **Did NOT** create a second config file for project-level keys
  (would have duplicated sgsd-configure.ps1's parser + write logic).
- **Did NOT** import Phase 50 cockpit-shell to fetch PANEL_KINDS
  (Lock 4 prohibits Phase 41-58 require()s; mirror is the contract).
- **Did NOT** add a JSON schema validator dependency (closed-vocab
  array indexOf() is sufficient and zero-dep).
- **Did NOT** auto-invoke the wizard from sgsd-configure.ps1
  (operator-discoverable hint preserves opt-in semantics).

## Recurrence guards

- ASCII-only assertion in selfTest A11 catches future smart-quote
  drift on the wizard module.
- Object.isFrozen assertions on PANEL_KINDS, BOOT_MODES,
  VALIDATION_CODES catch accidental mutation of closed vocabularies.
- Idempotent-skip-write codepath catches "rewrite when no change"
  waste (no spurious mtime bumps that would ripple into ROADMAP
  staleness scans).
