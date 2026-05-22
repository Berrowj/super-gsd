# Claude Handover - Compiled Context Codex Handoff

Use this brief to upgrade SGSD double-agent routing so Claude can remain
CEO/orchestrator/context-owner while Codex receives bounded coding tasks after
Claude compiles the relevant private SGSD context.

## Working Directory

```text
C:\Users\user\GSDedits
```

## Goal

Upgrade SGSD double-agent routing so this becomes possible:

```text
Claude understands the milestone/phase/private SGSD context.
Claude compiles only the relevant context into a bounded task capsule.
Codex executes the bounded implementation task.
Claude retains CEO/orchestrator/sign-off responsibility.
```

## Problem

The current double-agent executor treats:

```json
"requires_private_knowledge": true
```

as a hard Codex veto.

That is too conservative.

Codex can safely do implementation work if Claude has already compiled the
relevant private SGSD context into the task capsule.

The router needs to distinguish:

```text
private context required but not compiled
  -> Claude

private context required and compiled into capsule
  -> Codex may execute if bounded, tested, low/medium risk, and low ambiguity

high risk
  -> Claude for now, even if private context is compiled
```

## Relevant Files

- `super-gsd/tools/double-agent-executor/run.cjs`
- `super-gsd/tools/double-agent-executor/task-capsule.schema.json`
- `super-gsd/tools/double-agent-executor/README.md`
- `super-gsd/scripts/lib/sgsd-cockpit-shell.cjs`
- `super-gsd/scripts/sgsd-mission-control.ps1`
- `super-gsd/scripts/sgsd-narrative.ps1`
- `.planning/briefs/2026-04-30-claude-handover-double-agent-routing-and-codex-blue.md`

## Required Design

Add a structured `context_packet` field to task capsules:

```json
{
  "context_packet": {
    "compiled_by": "claude",
    "summary": "Short relevant context Codex needs.",
    "source_refs": [
      "relative/path/to/source.md",
      "relative/path/to/source.cjs"
    ],
    "private_context_compiled": true
  }
}
```

## Routing Rule

If:

```text
requires_private_knowledge === true
```

and:

```text
context_packet.private_context_compiled !== true
```

then Codex is vetoed with:

```text
private_context_not_compiled
```

If:

```text
requires_private_knowledge === true
```

and:

```text
context_packet.private_context_compiled === true
```

then do not apply the old private-knowledge Codex veto.

Keep all other vetoes:

- `high_risk_requires_claude`
- `high_ambiguity_requires_claude`
- `mechanical_acceptance_missing`
- `allowed_files_missing`
- `allowed_files_over_limit`
- `estimated_line_count_over_limit`
- `codex_provider_unhealthy`

High risk should still route to Claude for now. Do not relax high-risk in this
patch.

Private context compiled only removes the private-context veto.

## Implementation Tasks

### 1. Update Task-Capsule Schema

File:

```text
super-gsd/tools/double-agent-executor/task-capsule.schema.json
```

Add optional `context_packet` object:

- `compiled_by`: enum `["claude", "operator", "local-script"]`
- `summary`: string
- `source_refs`: array of relative path strings
- `private_context_compiled`: boolean

Keep `additionalProperties: true`.

### 2. Update Capsule Validation

File:

```text
super-gsd/tools/double-agent-executor/run.cjs
```

Validation requirements:

- `context_packet` is optional.
- If present, it must be an object.
- `compiled_by`, if present, must be one of `claude`, `operator`, `local-script`.
- `summary`, if present, must be a non-empty string.
- `source_refs`, if present, must be an array of safe relative paths using the
  same safety rules as `allowed_files`.
- `private_context_compiled`, if present, must be boolean.

Normalization:

- Preserve `context_packet`.
- Normalize `source_refs` with slash paths and `uniq`.
- Add helper:

```js
hasCompiledPrivateContext(capsule)
```

### 3. Update Weighted Matrix

File:

```text
super-gsd/tools/double-agent-executor/run.cjs
```

Current behavior likely has:

- Codex score penalty for `requires_private_knowledge`
- Claude score bonus for `requires_private_knowledge`
- Codex veto `private_knowledge_requires_claude`

Replace with:

If private knowledge is required and context is not compiled:

- Codex penalty remains.
- Claude bonus remains.
- Codex veto becomes `private_context_not_compiled`.

If private knowledge is required and context is compiled:

- no Codex private-context veto
- reduce or remove Codex private-knowledge penalty
- add Codex score evidence:

```text
compiled_private_context_available
```

- keep a small Claude score bonus if useful, but Codex can win when bounded and
  tested.

The route ledger should record these fields in `decision`:

- `context_packet_present`
- `private_context_compiled`
- `context_source_refs_count`

### 4. Update Self-Tests

File:

```text
super-gsd/tools/double-agent-executor/run.cjs
```

Add tests:

- Private knowledge without compiled context routes to Claude with
  `private_context_not_compiled`.
- Private knowledge with compiled context, low risk, low ambiguity, bounded
  files, tests present, and Codex healthy routes to Codex.
- High risk plus compiled private context still routes to Claude with
  `high_risk_requires_claude`.
- Invalid `context_packet.source_refs` path fails validation.
- Route ledger preserves `private_context_compiled: true`.

Expected self-test count will increase. Update assertions accordingly.

### 5. Update README

File:

```text
super-gsd/tools/double-agent-executor/README.md
```

Document:

- Claude compiles context; Codex executes bounded implementation.
- `requires_private_knowledge` no longer means "Claude forever."
- Codex is allowed when private context is compiled and all other constraints
  pass.
- Add an example capsule with `context_packet`.

### 6. Update Cockpit Reason Text

File:

```text
super-gsd/scripts/lib/sgsd-cockpit-shell.cjs
```

Add human-readable route reasons:

```text
private_context_not_compiled
  -> Claude fits: private SGSD context has not been compiled for Codex

compiled_private_context_available
  -> Codex fits: Claude compiled the needed SGSD context into the capsule
```

If route row exposes context-packet flags, cockpit can show it in `WHY` if easy.
Do not over-expand the UI.

### 7. Update Prior Handover Doc

File:

```text
.planning/briefs/2026-04-30-claude-handover-double-agent-routing-and-codex-blue.md
```

Add a section:

```text
Compiled Private Context Unlock
```

Explain:

- Claude remains CEO/orchestrator.
- Codex may implement when Claude compiles the SGSD context into the capsule.
- Never send Codex broad roadmap/state by default.
- Use `context_packet.summary` and `context_packet.source_refs`.

## Verification Commands

Run:

```powershell
cd "C:\Users\user\GSDedits"

node --check super-gsd/tools/double-agent-executor/run.cjs
node super-gsd/tools/double-agent-executor/run.cjs --self-test
node super-gsd/tools/double-agent-executor/scorecard.cjs --self-test
node super-gsd/scripts/lib/route-ledger.test.cjs
node super-gsd/scripts/lib/sgsd-cockpit-shell.cjs --self-test
node super-gsd/tests/cockpit-regression/check.cjs
```

PowerShell parser checks:

```powershell
$errs=$null
[System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw super-gsd/scripts/sgsd-narrative.ps1), [ref]$errs) > $null
if($errs -and $errs.Count){ $errs | ForEach-Object { $_.Message }; exit 1 } else { "narrative parse OK" }

$errs=$null
[System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw super-gsd/scripts/sgsd-mission-control.ps1), [ref]$errs) > $null
if($errs -and $errs.Count){ $errs | ForEach-Object { $_.Message }; exit 1 } else { "mission-control parse OK" }
```

## Acceptance Criteria

- Low-risk bounded code task with compiled private context routes to Codex.
- Same task without compiled context routes to Claude.
- High-risk compiled-context task still routes to Claude.
- Route ledger explains the distinction accurately.
- No broad context is sent to Codex by default.
- Existing cockpit/Codex colour work remains intact.

## Suggested Phase

```text
Phase 106 - Compiled Context Codex Handoff
```

Goal:

```text
Let Claude compile private SGSD context into bounded task capsules so Codex can
execute safe implementation work without receiving broad roadmap/state context.
```

## Handover Prompt

```text
Read this handover first:
C:\Users\user\GSDedits\.planning\briefs\2026-04-30-claude-handover-compiled-context-codex-handoff.md

Then implement the Compiled Context Codex Handoff patch. Keep the change scoped
to the double-agent executor, task-capsule schema, README, cockpit route reason
text, and the prior double-agent handover doc. Do not relax high-risk routing.
Codex may only be unlocked for private-context tasks when Claude has compiled
the relevant context into context_packet.private_context_compiled=true. Run all
verification commands from the brief and report the final self-test counts.
```
