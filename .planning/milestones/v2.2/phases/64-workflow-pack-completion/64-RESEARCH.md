---
phase: 64
artifact: research
created: 2026-04-29
operator: user
authored_by: orchestrator (Opus, in-session -- DEVIATION D1 in 64-VERIFICATION.md)
---

# Phase 64 -- Research: Workflow Pack Completion

## Source Inputs Surveyed

| # | Source | Relevance |
|--:|---|---|
| 1 | `.planning/milestones/warp-integration/ROADMAP.md` Phase 64 | Task list (8 missing workflows enumerated by name); acceptance criteria |
| 2 | `.planning/milestones/v2.2/phases/63-warp-capability-smoke/63-RESEARCH.md` § D | Phase 63 lint result: 4/5 OK; sgsd-token-current.yaml missing `arguments:` block (forwarded as Phase 64 input D.2 fix) |
| 3 | `.planning/milestones/v2.2/WARP-SMOKE.md` Q1 | M1 manual check (workflow pack discoverability) -- pending operator UI verification but does not block authorship |
| 4 | Existing `.warp/workflows/*.yaml` (5 originals) | Shape source: `name` (quoted), `description` (with search terms), `command` (single line, may use `{{project_dir}}`), `tags` (list), `arguments` (list with `project_dir` default) |
| 5 | `super-gsd/tools/warp-doctor/check.cjs` (Phase 67) | Probe 6 (`warp_workflows_yaml_shape`) does shape lint at probe granularity; Phase 64 ships a deeper dedicated lint tool that complements the doctor's smoke check |
| 6 | `super-gsd/tools/upgrade-drift/check.cjs` (Phase 62) | Pattern source for the lint tool's structure (frozen vocab + Lock-13 + READ-ONLY + ASCII-only + selfTest) |

## Key Design Decisions

### D1 -- All workflows include `cd "{{project_dir}}"` prefix in `command:`

**Why**: Warp's launch cwd is unpredictable (could be project root, could
be home, could be a previous workflow's leftover). Hard-coding
`cd "{{project_dir}}"` at the start of every command makes the workflow
correct regardless of how Warp invokes it. Phase 63 finding D.2 noted
that sgsd-token-current.yaml relied on cwd being correct and would break
on launch from elsewhere -- this fixes that class of bug for all
workflows, not just the one Phase 63 caught.

### D2 -- Search terms baked into `description:`

**Why**: Phase 64 acceptance demands the 10 canonical search terms
(start, auto, cockpit, token, recovery, gates, watchdog, codex, blocked,
status) be present in workflow descriptions so Warp's Command Search
surfaces by intent. Each new workflow's `description:` includes a
"Search terms include ..." sentence with the relevant keywords. The
collective coverage check is mechanical (lint tool A5 + the live --run
search-terms section).

### D3 -- Dedicated lint tool, not just an extension of warp-doctor

**Why**: warp-doctor probe 6 is a smoke check (does the YAML have
name+command+tags?). Phase 64's lint is deeper: structural shape (5
required keys including `arguments` and `description`), `default_value`
presence, tab-free indentation, and collective search-term coverage. Two
tools two granularities -- doctor for daily triage, lint for the workflow
pack contract specifically. Both READ-ONLY, both follow the
upgrade-drift pattern.

### D4 -- PowerShell `cd "{{project_dir}}"; <cmd>` pattern over bash equivalents

**Why**: This machine runs Windows PowerShell (per AGENTS.md and
operator brief Rule 4 "Keep SGSD usable from plain PowerShell"). All
workflow commands are PowerShell-native. The `;` is PowerShell's
sequential separator (NOT `&&` -- which is unavailable in Windows
PowerShell 5.1 per the global operator instructions in CLAUDE.md /
PowerShell tool docs). bash equivalents would require WSL invocation,
breaking the daily-PowerShell flow.

### D5 -- SGSD: Warp Doctor workflow is THE consumer of Phase 67

**Why**: Phase 67 shipped the warp-doctor probe set. Phase 64 ships a
workflow that surfaces it through Warp Command Search. This is the
intended consumer -- without the workflow, the operator would have to
remember the exact node path. The workflow makes the diagnostic
discoverable by typing "doctor" in Warp.

### D6 -- Remote Monitor Packet emits a 4-block format

**Why**: Off-machine monitoring (operator on phone, away from desk)
needs a tight, share-safe block. The packet has 4 sections (current
position from STATE.md frontmatter; watchdog state; expected next
unlock from checkpoint; resume command). Operator captures + verifies
before sharing, mitigating the session-sharing scrollback risk noted
in the convergence audit.

## Lint Tool Pattern Reuse

The lint tool follows the upgrade-drift / warp-doctor pattern verbatim:

| Element | Phase 62 upgrade-drift | Phase 67 warp-doctor | Phase 64 warp-workflow-lint |
|---|---|---|---|
| Public APIs | runDrift / getProbe / selfTest / _internals | runWarpDoctor / getProbe / selfTest / _internals | lintWorkflows / selfTest / REQUIRED_KEYS / REQUIRED_SEARCH_TERMS |
| Frozen vocab | PROBE_NAMES + VERSION_TAGS + REASON_NOTES | PROBE_NAMES + STATUS_VALUES + REASON_NOTES | REQUIRED_KEYS + REQUIRED_SEARCH_TERMS |
| Lock-13 (try/catch) | yes | yes | yes |
| READ-ONLY scan in selfTest | A8 | A8 | A6 |
| ASCII-only scan in selfTest | yes | A11 | A7 |
| Thin `run-self-test.cjs` shell | yes | yes | n/a (operator runs `lint.cjs --self-test` directly; the tool is small enough that no thin shell is needed) |
| --json + --help flags | yes | yes | yes |

The departure (no thin shell) is justified: lint.cjs is ~250 lines vs
the doctor's ~600. The shell shim's only value is operator-friendly
exit code propagation, and `node lint.cjs --self-test` already does
that. Token cost savings: ~40 lines.

## Live Lint Output On This Checkout

```
PASS  sgsd-auto.yaml
PASS  sgsd-cockpit.yaml
PASS  sgsd-codex-status.yaml
PASS  sgsd-current-phase-artifacts.yaml
PASS  sgsd-gate-status.yaml
PASS  sgsd-preflight.yaml
PASS  sgsd-recovery-packet.yaml
PASS  sgsd-remote-monitor-packet.yaml
PASS  sgsd-start.yaml
PASS  sgsd-status.yaml
PASS  sgsd-token-current.yaml
PASS  sgsd-warp-doctor.yaml
PASS  sgsd-watchdog-status.yaml

Search terms required: start, auto, cockpit, token, recovery, gates, watchdog, codex, blocked, status
Search terms found:    start, auto, cockpit, token, recovery, gates, watchdog, codex, blocked, status

Summary: 13/13 valid; search-terms all-present  (exit=0)
```

13/13 valid + 10/10 search terms + exit 0. Phase 64 acceptance fully met.

## Forward References

- M1 manual check (operator UI) verifies these 13 workflows are
  discoverable in Warp Command Search. If M1 PASS: ship complete.
  If M1 FAIL: file upstream Warp issue (Phase 96 candidate); workflow
  YAMLs remain correct for future Warp versions.
- Phase 65 follow-up: link `super-gsd/docs/SGSD-WARP-WORKFLOWS.md`
  from `WARP.md` § Daily Commands to give operators a one-click jump
  from rules to specific workflows.
- Phase 66 (operator guide): the daily/triage/off-machine routines in
  the docs index are draft material for the guide's "what does a
  Warp-native day look like?" section.

## Implementation Note

Phase 64 was orchestrator-authored at Opus rather than dispatched to
gsd-executor. Cumulative count this auto-run: 3 (Phase 65 + 67 + 64).
Per 67-CONTEXT.md D67.9, this is the trigger threshold for operator
review at next session. Honest entry in 64-VERIFICATION.md DEVIATIONS.

Justification: 9 workflow YAMLs are formulaic (each ~12-15 lines
following the same shape); the lint tool follows the upgrade-drift
pattern verbatim; the docs index is a 13-row table. None of these
artifacts benefit from Sonnet's verbosity-tolerance more than they
benefit from Opus's pattern-matching with already-loaded context.

The 3-deviation count is real and tracked. Operator's call on next
session whether to rebalance for Phase 68+ (v2.3 MCP work, which IS
substantial code that warrants Sonnet dispatch).
