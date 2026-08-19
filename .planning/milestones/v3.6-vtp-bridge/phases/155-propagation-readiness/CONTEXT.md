---
phase: "155"
slug: propagation-readiness
milestone: v3.6-vtp-bridge
status: PENDING
depends_on: ["153", "154"]
governing_decision: .planning/decisions/2026-08-19-canonical-work-identity-MEMO.md
scope_locked_by: operator
scope_locked_at: 2026-08-19
---

# P155 Context — Propagation Readiness

## Goal

One coherent push to origin that devcp instances can consume via `sgsd-update` and
receive: working hooks (classifier AND guard), the five blind-resolver fixes the board
prioritised, the resolver-to-orchestrator wiring, and the VTP services contract. This
phase is the gate in front of that push. Nothing pushes until it closes.

## Why this phase exists

Three findings converged on 2026-08-19:

1. The board killed the canonicalisation milestone and ruled the real defect is a
   shipped-default layout split plus four resolvers blind to the entire SGSD era
   (memo: `.planning/decisions/2026-08-19-canonical-work-identity-MEMO.md`).
2. The P153 hook work is live in this repo but the secret-leak guard exists only in
   `claude-ups-overlay.json`, which nothing in `install.sh` merges. Devcp would
   receive the classifier but not the guard.
3. The operator supplied the definitive VTP wiring contract (servers, backing
   services, canonical data paths, single-writer rule), which currently lives in a
   chat message and nowhere durable.

## Verified evidence

- `super-gsd/install.sh:572` runs `mkdir -p "$PROJECT_DIR/.planning/phases"` on every
  install — the divergent layout is the shipped default.
- `super-gsd/install.sh:467` merges `config/repo-settings-overlay.json`, which carries
  the classifier entry (`user-prompt-intent-classifier`) but NOT the guard.
- Blind resolvers, all confirmed against source: `sgsd-conformance-check.sh:61` exits 3
  without the legacy root; `sgsd-agent-dashboard.sh:208`, `sgsd-distill-milestone.sh:101`,
  `phase-verifier.mjs:157` resolve phase dirs under `.planning/phases/` only, so they
  have been silently blind to phases 09-153. The dual-root pattern exists at
  `phase-folder-audit/audit.cjs:4`.
- `state-resolver/resolve.cjs` (7 evidence tiers, `projection_stale`) is called by 3 of
  63 consumers; the orchestrator is not one of them.
- The triage directive fired on two automated task-notification turns (2026-08-19),
  which are not operator prompts — a P149 route predicate false positive.
- VTP: `dist/cli.js` rebuilt 2026-08-19 16:24; live MCP child predates it (stale-child
  class, see memory `feedback_stale_mcp_process_diagnosis`). Pending ledger holds 3.

## Scope — six tasks

### T1 — One overlay, one merge path
Add the `user-prompt-secret-leak-guard` UserPromptSubmit entry to
`config/repo-settings-overlay.json`; delete `config/claude-ups-overlay.json`; update the
P153 test suite references (`assert-registration.cjs` reads the overlay path) so 11/11
ACs stay green against the unified overlay. Re-run the merge here so this repo matches
what devcp will get.

### T2 — Stop shipping the divergent layout
`install.sh:572`: stop creating `.planning/phases/` on fresh installs. Existing projects
keep their legacy tree untouched (MSOV-P-08: deletion is a protocol; archiving is out of
scope per the memo).

### T3 — Dual-root the four blind resolvers
Rewire `sgsd-conformance-check.sh`, `sgsd-agent-dashboard.sh`,
`sgsd-distill-milestone.sh`, `phase-verifier.mjs` using the copyable pattern from
`phase-folder-audit/audit.cjs`. Each must find phases under BOTH roots and must not
hard-fail when the legacy root is absent. Semantic AC per tool: point it at a
milestone-tree phase (e.g. 153) and it must resolve; delete nothing.

### T4 — Wire the orchestrator to the state resolver
Per the board memo this lands FIRST in priority: `sgsd-orchestrate`'s READ STATE step
consumes `resolveEffectiveState()` and surfaces `projection_stale` loudly instead of
trusting STATE.md frontmatter. Also add the namespace-prefix field for cross-instance
IDs (M038 / v30-06.8) to the resolver output — a field, not a registry.

### T5 — VTP services contract, durable
`super-gsd/registry/vtp-services.yaml`: server registrations (standardise on `vtp-kb`),
backing services with env NAMES only (`QDRANT_URL`, `VTP_EMBED_PYTHON`,
`VTP_EVIDENCE_STORE_URL`, `CLARITY_MONGO_URI`, `CLARITY_MONGO_DB`, `CLARITY_ES_URL`),
canonical-vs-mirror data paths under `~/.vtp/`, pins (Qdrant client 1.18.0,
sentence-transformers never-upgrade), single-writer rule (`~/.vtp/ingest.lock`).
Plus: readiness gate gains dist-vs-src freshness probe (warn = reconnect MCP, not
rebuild), Qdrant reachability, evidence-store presence. SessionStart hook surfaces
pending-ledger depth. NEVER read or write secret values — names only.

### T6 — Notification false-positive fix
The P149/P146 route predicates must not match automated task-notification turns.
Falsifier both ways: a genuine operator planning prompt still fires; a task-notification
turn does not.

## Exit criteria (push gate)

- All six tasks verified, P153-suite still 11/11 green against the unified overlay.
- P153's gap plan resolved or explicitly deferred by the operator in writing.
- PII check per recorded rule: fetch + rebase onto origin/master, zero reversions, zero
  added PII lines, fast-forward only, never force.
- THEN one push. Devcp update instructions written to the phase SUMMARY.

## Boundaries

- No canonical registry, no alias map, no renumbering (board memo, dead ends).
- No archiving of legacy `.planning/phases/` trees in existing projects.
- No new automatic MCP invocations (P154's arg-shape defect is still open).
- No new work-tier taxonomy; coverage/tiering work is a later phase reusing ATC tiers.
- Claude orchestrates; Codex gpt-5.6-sol authors all source.
