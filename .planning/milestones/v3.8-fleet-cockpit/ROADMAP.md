# v3.8-fleet-cockpit — Roadmap

Planned 2026-08-20 from the devcp fleet-cockpit handover. P164/P165 are
operator-gated: the loop STOPS after P163 for the handover's mandated
stop-and-evaluate.

## Phases

| Phase | Slug | Status | Depends on |
|-------|------|--------|------------|
| 161 | hook-distribution-completion | [x] PASS-WITH-DEFERRED-3 @44e7861 | — |
| 162 | fleet-service | [x] PASS-WITH-DEFERRED-2 @8410974 | 161 |
| 163 | fleet-page | [ ] seeded | 162 |
| 164 | omnigent-session-plane | [ ] gated (operator go required) | 163 |
| 165 | fleet-event-emission | [ ] gated (operator go required) | 163 |

## Success criteria

1. sgsd-update completes exit 0 on a project with the Clarity shape (P161).
2. /api/fleet rolls up every git-reported lane with a defensible status; one
   broken lane never blanks the fleet (P162).
3. The left rail is the product: attention-first sorting, no-data vs zero
   distinct, conflicts rendered side-by-side, usable on a phone (P163).
4. devcp load average rises <1.0 with the service running.
