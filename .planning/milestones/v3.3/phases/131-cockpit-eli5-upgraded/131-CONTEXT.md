---
phase: 131
phase_name: Cockpit ELI5 Upgraded
milestone: v3.3
ws: core
created: 2026-05-24
status: queued-planning
implementation_status: not-started
source: v3.3 plan P131 scoped summary + brief principles P13/P14/P15 (Munroe + Duarte + Sullivan)
predecessor: P130 PASS (rationale layer; eli5 field exists in JSON)
unlocks: [P132 (localhost-live cockpit uses upgraded ELI5), P134 (conformance covers Munroe lint binding)]
---

# Phase 131 — Cockpit ELI5 Upgraded

> Apply Munroe's common-words constraint to the existing Haiku-narrated ELI5 panel in `sgsd-codex-monitor.ps1`. Add Duarte's what-is / what-could-be / S.T.A.R. / call-to-action arc structure to the narrator prompt. Mechanical lint enforces the plain-words discipline post-generation.

## Goal

After P131, `eli5-common-words.txt` ships ~1500 common words (Munroe's ten-hundred + SGSD additions). `eli5-lint.cjs` mechanically checks any ELI5 text against the allowlist with inline-gloss tolerance. The `Get-LocalClaudeEli5` PowerShell prompt asks for the 4-beat Duarte arc explicitly. 4 new SAC tests.

## Binding invariants

1. **Mechanical lint** — no LLM in the lint path; pure regex/word-list.
2. **Allowlist drives lint** — out-of-list words must be glossed inline (parens or dash); otherwise flagged.
3. **Lock-13 untouched** — work limited to `super-gsd/tools/cockpit-sidecar/` (new files) + `super-gsd/scripts/sgsd-codex-monitor.ps1` (existing).
4. **Backward compatible** — existing ELI5 narration still works if the new arc structure isn't honoured (lint is informational at this phase; binding only at P134).

## What ships

### `super-gsd/tools/cockpit-sidecar/eli5-common-words.txt` (new)

Plain text file, one word per line, lowercase. ~1500 entries. Sources: Munroe's ten-hundred (the canonical list of the 1000 most common English words from Thing Explainer) + ~500 SGSD-specific additions: `phase`, `commit`, `verify`, `stage`, `cockpit`, `pipeline`, `chronicle`, `milestone`, `dispatch`, `executor`, `verify`, `done`, `pending`, `active`, `blocked`, `agent`, `task`, `plan`, etc.

### `super-gsd/tools/cockpit-sidecar/eli5-lint.cjs` (new)

Exports `lintEli5(text, opts)` returning `{ok, violations, total_words, out_of_list_count}`. Each `violation` is `{word, line_number, glossed: false}`. Words considered "glossed" if followed by `(...)` or `—` description within the next 20 characters. opts.maxViolations (default 5): if violations.length > maxViolations, `ok = false`.

### `super-gsd/scripts/sgsd-codex-monitor.ps1` (modified)

Extend the `Get-LocalClaudeEli5` Haiku prompt with Duarte 4-beat arc instructions: `What is now` → `What could be` → `S.T.A.R. moment` → `Call to action`. After generation, invoke `eli5-lint.cjs` via Node child-process; on violations > 5, re-prompt with the violation list inline (or accept with INFO-level note — binding gate only at P134).

### `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (extended, pure append)

SAC-P131-01..04 appended.

## Semantic acceptance criteria

```yaml
semantic_acceptance_criteria:
  - id: SAC-P131-01
    input: "lintEli5('Everything looks fine right now. We are ready for the next step.')"
    expected_outcome: "returns ok:true (or very few violations); all words are common"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P131-01"
  - id: SAC-P131-02
    input: "lintEli5('The SAC schema mandates idempotent invariants under concurrent dispatch.')"
    expected_outcome: "returns ok:false; violations contain at least ['SAC','schema','mandates','idempotent','invariants','concurrent']"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P131-02"
  - id: SAC-P131-03
    input: "lintEli5('The orchestrator (the part that picks what to do next) is waiting.')"
    expected_outcome: "returns ok:true OR fewer violations than the same sentence without parens — inline-gloss recognition works (orchestrator is followed by (the part...))"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P131-03"
  - id: SAC-P131-04
    input: "sgsd-codex-monitor.ps1 Get-LocalClaudeEli5 prompt text grepped for Duarte arc markers"
    expected_outcome: "the prompt source contains the 4 beat labels ('What is now', 'What could be', 'S.T.A.R.' or similar, 'Call to action' or 'DO NEXT' equivalent)"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P131-04"
```

## Files touched

| Operation | Path |
|---|---|
| CREATE | `super-gsd/tools/cockpit-sidecar/eli5-common-words.txt` (T1) |
| CREATE | `super-gsd/tools/cockpit-sidecar/eli5-lint.cjs` (T2) |
| MODIFY | `super-gsd/scripts/sgsd-codex-monitor.ps1` (Get-LocalClaudeEli5 prompt extension) (T3) |
| EXTEND | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (T4) |
| CREATE | `131-VERIFICATION.md`, `PHASE-CAPSULE.json` (T5) |

## Out of scope

- No localhost server (P132).
- No PowerShell monitor keep/kill migration (P133).
- No conformance gate promotion (P134) — Munroe-lint binding deferred until P134.
- No full re-write of the PS Get-LocalClaudeEli5 function (just prompt extension + lint hook).

## Source references

- v3.3 INTENT.md (entry phase 4)
- Plan P131 scoped summary
- Munroe — Thing Explainer (canonical knowledge of the ten-hundred list)
- Duarte — Resonate (4-beat arc)
- Sullivan — Simply Said (audience-first, plain prose)
- v3.2 R11 (no un-glossed jargon)
