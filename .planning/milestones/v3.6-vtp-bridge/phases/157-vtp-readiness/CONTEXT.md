---
phase: "157"
slug: vtp-readiness
milestone: v3.6-vtp-bridge
status: ACTIVE
depends_on: ["155"]
carved_from: "155"
governing_decision: .planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-PLANREVIEW-REPORT.md
opened: 2026-08-20
---

# P157 Context — VTP Readiness (T5 carve-out)

## Goal

Make the VTP service topology a durable, probeable contract so unattended runs find
degraded paths in minutes, not hours. Today the topology lives in operator messages
and session memory; nothing probes it at readiness time.

## Scope

### T1 — super-gsd/registry/vtp-services.yaml
Server registrations standardised on `vtp-kb`; backing services by env NAMES ONLY
(`QDRANT_URL`, `VTP_EMBED_PYTHON`, `VTP_EVIDENCE_STORE_URL`, `CLARITY_MONGO_URI`,
`CLARITY_MONGO_DB`, `CLARITY_ES_URL`) — NEVER values, never defaults that embed hosts;
canonical-vs-mirror data paths under `~/.vtp/` (canonical KB_DIR ~/.vtp/, kb-data
mirrors); pins recorded as facts (Qdrant JS client 1.18.0; sentence-transformers/torch
NEVER-upgrade note; bge-base-en-v1.5 embedder); single-writer rule
(`~/.vtp/ingest.lock`); ingest pipeline pointer (config/ingest-manifest.yaml).

### T2 — three readiness probes, wired into BOTH surfaces (review change 7)
1. dist-vs-src freshness: MCP server dist/cli.js older than src => WARN "reconnect
   MCP" (a stale long-lived child, P148 lesson), never "rebuild".
2. Qdrant reachability: env-name-driven URL probe, existence+connect only.
3. Evidence-store presence: file/dir existence for VTP_EVIDENCE_STORE_URL sqlite.
Probes must run through the AUTOMATIC Rule 0 milestone-readiness path AND the manual
readiness invocation — the falsifier exercises both entrypoints, not the checker
functions alone (review change 7 verbatim).

### T3 — SessionStart pending-ledger depth
The SessionStart hook surfaces pending-ledger depth (count only, text-free) so an
operator sees VTP backlog at session open. Registration through the existing
settings-overlay merge path (P155 pattern), activation-through-merged-settings tested.

## Boundaries

- NEVER read, print, or copy secret VALUES; env NAMES and existence checks only
  (global CLAUDE.md secrets rule is absolute).
- No liveness probing inside hooks (hooks get registration/cheap reads only); network
  probes belong to readiness dispatches.
- No new MCP tools wired; no VTP source changes (VTP is a separate repo).
- Claude orchestrates; Codex gpt-5.6-sol authors all source; every task revertable;
  real-data SACs (DLB-07/SCHEMA-09).

## Evidence available to the planner

- Operator topology message recorded 2026-08-19 (servers vtp-kb/jcl-internal/
  jcl-products/qmd; Qdrant via tunnel; client pinned; sqlite WAL evidence store;
  Mongo/ES on SSH host; ingest.lock single-writer; dist/cli.js staleness discovered
  live).
- `super-gsd/registry/` house style for YAML registries; existing readiness scripts
  under sgsd-milestone-readiness / sgsd-phase-readiness agents and Rule 0 wiring in
  sgsd-orchestrate SKILL.
- P155 SessionStart hook + settings-overlay registration pattern and its
  activation-through-merged-settings test shape.
