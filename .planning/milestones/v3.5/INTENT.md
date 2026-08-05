---
milestone: v3.5
name: Always-On Orchestration
status: ACTIVE
opened: 2026-08-05
design_spec: .planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md
governing_decision: .planning/decisions/2026-08-02-always-on-gate-substrate.md
phases: ["144", "145", "146", "147", "148", "149", "150"]
provider_lock: "Claude orchestrates; Codex gpt-5.5/xhigh authors all SGSD orchestration source code."
---

# v3.5 Intent — Always-On Orchestration

## Core value

SGSD's governance must be a **runtime mechanism, not prose**. ATC gates, MUDA,
phase discipline, triage, and skill routing fire in every session type — manual,
semi-automatic, full-auto, and `sg`-shortcut launches — with evidence logged
loudly when they don't. Codex dispatch configuration becomes operator-controllable.
The whole substrate propagates to every SGSD install (local + devcp).

**Design principle:** absence of evidence must be loud.
**Board constraints (2026-08-02 memo, binding):** no blocking at the edit seam;
report-only first; eventual blocking at the commit seam only after the shadow
falsifier passes (≥200 payloads across GSDedits + devcp, <5% false-block);
Codex hook trust granted interactively by the operator; never global-machine
hooks on day one.

## Phases

- **P144 Chronicle host-shell boundary** — context-handover pack automation.
  Reference instance hand-written 2026-08-02; automation remains. NOTE: the
  Binding ACs in its HANDOVER.md predate the board memo and are superseded by
  the design spec (no edit-seam blocking).
- **P145 Codex profile registry + /sgsd-codex-control** — profiles yaml, wrapper
  refactor, control skill with danger-guardrails.
- **P146 Session governance hooks** — SessionStart contract injection,
  UserPromptSubmit intent classifier (triage auto-fire + skill suggestions),
  report-only quality gate, board cheap fixes (unbundled set).
- **P147 Commit-seam gate** — warn mode + shadow ledger + mechanical falsifier
  report; block mode only when earned.
- **P148 Cross-model triage** — Codex xhigh second-opinion verdict (triage
  profile), VTP null-reflection fallback, disagreement surfacing.
- **P149 Skill-routing table** — one intent-signature → skill map consumed by
  classifier (prompt-time) and orchestrate loop (scheduled moments).
- **P150 Propagation + trust + runbook** — push origin, local installer re-run,
  devcp /sgsd-update, interactive Codex hook-trust ceremony on both machines,
  PROPAGATION.md live-update-vs-reboot runbook.

## Exit criteria

1. An `sg`-launched manual session demonstrably carries the governance contract
   and auto-fires triage on a planning-shaped prompt (AC-146a/b, AC-148a).
2. Gate-evidence and commit-gate-shadow ledgers accumulate rows from real work
   in both repos (AC-146c, AC-147a).
3. `/sgsd-codex-control` round-trips a profile change into a real dispatch
   (AC-145b).
4. devcp HEAD matches pushed origin HEAD; post-update smoke green on both
   machines; hook trust verified by probe (AC-150a-c).

## Out of scope (recorded follow-ons)

- sgsd-orchestrate SKILL.md excision (board item 6) — separate decision.
- Commit-seam block-mode activation — automatic on falsifier pass, no phase.
- v3.4 P142/P143 (cockpit alarm/rationale drawers + close) — parked, reopen
  after v3.5 or on operator call.
