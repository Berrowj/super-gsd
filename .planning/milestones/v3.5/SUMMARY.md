---
milestone: v3.5
name: Always-On Orchestration
status: SHIPPED-WITH-DEFERRED-1
opened: 2026-08-05
closed: 2026-08-10
phases: ["144", "145", "146", "147", "148", "149", "150"]
provider_health_at_close: codex AVAILABLE (behavioral canary exit 0)
vtp_classification_used: gap-tier-3
vtp_connections_library_backed: false
vtp_research_id: reserved
---

# v3.5 — Always-On Orchestration — Milestone Summary

## Core value delivered

SGSD's governance is now a **runtime mechanism, not prose**. Gates, MUDA,
triage, and skill routing fire across every session type, with evidence logged
loudly when they don't; Codex dispatch is operator-controllable; and the whole
substrate propagates to SGSD installs. Delivered end-to-end except the devcp
runtime switch, deferred because devcp is actively running live sessions.

## Shipped phases

- **P144** Handover pack — reference instance of sgsd-handover-pack/v1.
- **P145** Codex Profile Control — per-dispatch model/reasoning/sandbox profiles
  (`codex-profiles.yaml` + `/sgsd-codex-control`). PASS-WITH-DEFERRED-4.
- **P146** Session Governance Hooks — always-on classifier/quality gates across
  manual/semi/auto/`sg` launches. PASS-WITH-DEFERRED-3.
- **P147** Commit-Seam Gate — earned-block commit gate, tamper-evident, 21/21
  real-git scenarios. PASS.
- **P148** Cross-Model Triage — staged MCP transport (runtime decides, Claude
  transports); 36/36; closed a FAIL-GATE across 3 fix dispatches. PASS.
- **P149** Skill-Routing Table — one registry maps intent→skill, consumed by
  classifier + phase-close consult with mechanical gate-trigger evaluation;
  survived 3 verifier rounds + an ATC FAIL-GATE (forged-gate-evidence CRIT).
  PASS.
- **P150** Propagation + Trust + Runbook — updater guards, installable codex
  hooks, runtime provenance, PROPAGATION.md + snapshot/restart helpers;
  **published to origin/master (7fb47eb→c0aff22) and installed locally under
  operator authorization**; local trust guard proven 3 ways; devcp deferred.
  PASS-WITH-DEFERRED-1.

## Evidence produced

- 6 propagation test suites (72 pass / 0 fail / 1 documented symlink skip on
  operator host): sgsd-update-contract (24), codex-hooks-install (10),
  runtime-provenance (5), runbook-contract (13), global-snapshot-contract (10),
  restart-evidence-contract (10).
- Live publication: origin/master advanced 7fb47eb → c0aff22 → 4f2f916.
- T150-05/06 execution records; T150-07 deferred record with full devcp state.
- 7 phase capsules; gate-keep-kill rubric (13 gates); token-waste ok.

## Rules learned (curated)

- Harness-vs-production seam bit 5×: verify every hop of the production
  invocation chain supplies what the mechanism needs — derive-don't-default.
- Codex model is `gpt-5.6-sol` (bare `gpt-5.6`/`-codex` 400 on ChatGPT accounts).
- CRLF was committed into the repo; `.gitattributes` now pins eol per type.
- Two orchestrators sharing one canonical worktree is the no-parallel-writers
  hazard — surfaced live during the ceremony; workspace-locking backlogged.

## Governance findings

- No MUDA recurrence kill-condition triggered.
- Gate keep/kill: 13 gates evaluated, cold-start defers dominate (expected).
- Phase-folder audit: soft-warn only, non-blocking.
- Provider health at close: Codex AVAILABLE — clean close, no debt tag.

## Deferred (carried to follow-up, not next-milestone debt)

- **T150-07 devcp propagation** — devcp actively running live SGSD/Clarity
  sessions at close; guarded update + restart-evidence + interactive trust
  grant to run when devcp is free. Substrate fully supports it (`/sgsd-update`
  + operator trust grant). See `phases/150-.../150-T150-07-DEFERRED.md`.

## Backlog seeded this milestone

- Dispatch progress-contract standardization (operator-mandated; wrapper-enforced).
- Session workspace locking (from live ceremony collision).
- Trust-probe ledger-routing fidelity (from T150-06).

## Unresolved Repairs (milestone v3.5)

(no unresolved repairs for this milestone)

## Gate Keep/Kill Rubric (milestone v3.5)

> Mechanical recommendation. Operator judgment for any `kill` row. See
> `gate-keep-kill.md` — cold-start defers dominate (correct first-close state).

## Phase Folder Audit (milestone v3.5)

> Soft-warn only. See `phase-folder-audit.md`.

## Token Waste (milestone v3.5)

> verdict: ok. See `token-waste.md`.

## Connections

### Connections (library-backed)

(no library hits for this milestone — VTP returned empty)

## Next-milestone seed

v3.6 candidate: the three seeded backlog items become the substrate-hardening
opener (dispatch progress-contract + workspace locking + probe fidelity),
followed by completing the deferred devcp propagation as its first operational
proof.
