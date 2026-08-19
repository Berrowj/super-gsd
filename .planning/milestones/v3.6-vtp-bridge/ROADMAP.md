# v3.6-vtp-bridge — Roadmap

Authored at P155 phase close (2026-08-20). The milestone predated the ROADMAP
requirement; its absence left the resolver's folder-ordering tier abstaining and
denied stale worktrees a corrective conflict signal (P155 phase-ATC warning).

## Phases

| Phase | Slug | Status | Depends on |
|-------|------|--------|------------|
| 151 | demand-baseline | [x] PASS 39/39 | — |
| 152 | kb-triage-shadow | [x] PASS @5e32325 | 151 |
| 153 | hook-transport-completion | [ ] OPEN — GATE_AUTO_HALT, gap plan | 149, 151, 152 |
| 154 | mcp-arg-contract | [ ] seeded | — |
| 155 | propagation-readiness | [ ] core complete, closing | 153, 154 |
| 156 | state-close-contract | [ ] seeded (carved from 155) | 155 |
| 157 | vtp-readiness | [ ] seeded (carved from 155) | 155 |
| 158 | notification-routing | [ ] seeded (carved from 155) | 155 |

## Success criteria

1. SGSD governance executes live on every instance (hooks registered AND activated).
2. Every phase-name consumer resolves all three historical schemes via one parser.
3. The decision path consumes resolver-derived truth with loud staleness evidence.
4. One coherent push propagates the above to devcp via sgsd-update.
