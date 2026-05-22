# SGSD -> Warp Upstream Proposal: Long-Running Local Orchestrator Telemetry Panel

> Status: DRAFT (not submitted upstream).
> Authored: Phase 96, v2.8, 2026-04-29.
> Operator owns timing of upstream submission.

## Problem

Warp ships world-class panels for AI sessions and short-lived shell commands.
It does not yet have a first-class panel for long-running LOCAL orchestrators
that:

- Live for hours/days across many sub-agent dispatches.
- Stream structured telemetry as JSONL events.
- Need operator-visible status without dominating the terminal.

SGSD is one such orchestrator (Claude Code + sub-agents + ATC + verifier loop).
Other local-agent stacks (Aider, gptme, Continue, custom Codex wrappers) face
the same gap. Operators currently bolt their own dashboards (separate Windows
Terminal panes, tmux mission-control) because Warp has no native surface.

## Motivation

Three concrete pains:

1. **Silent stalls** -- Long-running orchestrators can hang for hours without
   visible signal. SGSD's 4-04-29 incident (6h silent stall) is the canonical
   example. Pulse heartbeats exist but no Warp surface renders them.
2. **Stale state contagion** -- Orchestrator state files (STATE.md,
   activity-log.jsonl, pulse) drift relative to live work; without a panel,
   operator sees commit log instead of effective state.
3. **Hands-off auto runs** -- Operators want to set work going overnight and
   trust they will see drift / errors / gates the next morning. Today this
   requires custom tooling per orchestrator.

A native Warp panel that ingests a documented JSONL contract would let any
local agent ship "operator visibility for free" by emitting the contract.

## Proposed surface (sketch)

### Ingestion contract

Warp watches a configured JSONL file (per workspace) and renders rows as
status chips. Required fields:

```jsonc
{
  "ts": "2026-04-29T23:22:04Z",       // ISO 8601 UTC
  "kind": "phase|task|gate|error|pulse|note",
  "title": "short string",            // <80 chars
  "status": "running|passed|failed|warned|deferred|skipped",
  "phase": "v2.8/96",                 // optional, agent-defined
  "details": "optional longer string"
}
```

Chip colors driven by `status`:
- running -> blue
- passed -> green
- warned -> amber
- failed -> red
- deferred / skipped -> grey

### Panel layout

- Top strip: most-recent 5 chips (newest left).
- Sticky chip: any `kind: "gate"` row not yet `passed`.
- Stall warning: red border if no `kind: "pulse"` row in last 5 minutes
  (configurable).
- Click chip -> open `details` in side panel.

### Configuration

Per-workspace `.warp/orchestrator-panel.yaml`:

```yaml
ingestion_path: .planning/metrics/orchestrator-pulse.jsonl
pulse_kind: pulse
stall_warning_seconds: 300
muted_kinds: []
```

### Permission model (optional v2)

Adopt SGSD's Phase 89 4-tier permission model for any future "act on this
chip" affordance (e.g., click-to-cancel running task). Tiers: read /
read-write-bounded / read-write-broad / privileged.

## Fallback

When the panel is absent (older Warp builds, non-Warp terminals), local
agents must remain fully functional. SGSD already does this via:

- `.planning/metrics/orchestrator-pulse.jsonl` (file-based, terminal-agnostic).
- Mission-control tmux pane (Linux/WSL).
- Recovery packet on stall (auto-emits to STDOUT).

Warp panel is additive UX, never required for correctness.

## Non-goals

- NOT a session-replay tool (Warp already has session replay).
- NOT a chat-history surface (Warp already has AI block history).
- NOT a build-status panel (existing CI panels solve this).
- NOT a process tree explorer (htop / Activity Monitor do this).
- NOT cloud-orchestrator visibility (this is for LOCAL orchestrators).

## Why "long-running local" specifically

The gap is not telemetry in general -- it is **long-running local agents
that live longer than a single AI session and emit structured events**.
Warp's existing AI panels assume short turns and shared cloud state. Local
orchestrators run hour-scale work with operator-private context, on the
operator's machine, against operator-only state files.

## Why this generalizes beyond SGSD

Three other local-agent stacks could adopt the contract immediately:

- Aider (file-edit agent loops) -> emits `task` rows per edit attempt.
- gptme (general agent CLI) -> emits `phase` rows per major step.
- Continue (IDE agent) -> emits `gate` rows for human-approval prompts.

The contract is intentionally tiny (6 required fields) to reduce adoption
friction.

## Reference implementation

SGSD's Phase 74 already ships a working JSONL emitter
(`super-gsd/scripts/lib/orchestrator-live-writer.cjs`) and Phase 75 ships the
read-only parser. The 16 SGSD event types compress cleanly to the 6 `kind`
values above. We are willing to upstream a sample emitter as a jumping-off
point if Warp accepts the contract.

## Status & timing

- Draft authored Phase 96, v2.8, 2026-04-29.
- Operator decides whether/when/how to submit (issue, RFC, direct contact).
- This file ships in-tree as authoring artifact only. No GitHub issue opened.

## Footer

Source: SGSD Warp Integration roadmap, Phase 96.
Contact: the SGSD operator.
