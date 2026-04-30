# SGSD Warp Prompts Pack

7 reusable prompt templates for Warp Agent. Copy/paste into Warp Agent
input or save into Warp Drive Prompts. Each template declares whether
it's **read-only** (just describes/explains) or **may suggest edits**
(returns recommendations the operator approves before applying).

> All prompts assume the SGSD MCP server is configured per
> `super-gsd/docs/SGSD-WARP-MCP-SETUP.md`. Tools referenced are from the
> 14-tool contract at `super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md`.

---

## P1: Current Status Explainer

**Mode**: read-only

**Prompt**:

```
Use the SGSD MCP to explain the current state in one paragraph for an
operator who just walked back to their desk. Call:

1. sgsd_current_state — milestone, phase, last_activity
2. sgsd_watchdog_status — alive/stale/absent + last pulse age
3. sgsd_token_spend (scope=current) — totals

Format the answer as 4-5 sentences, no bullets. Cite specific numbers
from the MCP envelope. Don't invent anything not returned by the tools.
```

---

## P2: Gate Triage

**Mode**: read-only (may RECOMMEND fixes; never applies them)

**Prompt**:

```
A gate failed or warned. Walk me through it without bypassing.

1. Call sgsd_gate_status — find the gate with verdict in {warn, fail}.
2. Read the gate's evidence_path file (typically {NN}-ATC-REVIEW.md).
3. Tell me:
   - Which gate, which phase, what verdict.
   - The top 1-2 critical findings (verbatim quote from evidence).
   - Recommended next step: in-loop fix / accept-and-backlog / design-adjustment.
   - Why (2 sentences citing evidence).

Cite AGENTS.md hard rule 2: "Don't duplicate SGSD gates." Recommend
fixing or downgrading status — NEVER bypassing.
```

---

## P3: Token Waste Triage

**Mode**: read-only (may RECOMMEND compression; never applies)

**Prompt**:

```
Investigate token spend for the active milestone.

1. Call sgsd_token_spend (scope=current, group_by=role) — top consumers per role.
2. Call sgsd_token_spend (scope=current, group_by=phase) — per-phase distribution.
3. Call sgsd_token_spend (scope=current, group_by=provider) — Claude vs Codex split.
4. Compare against Phase 42 BUDGETS (see super-gsd/registry/budgets.yaml or
   the orchestrator skill's BUDGETS section).
5. Flag anomalies (>2x budget, cache-read ratio <40%, provider skew).
6. Recommend compression target: tighten X prompts / migrate Y to Z provider /
   scope-trim research.

Output a short report. Don't apply anything.
```

---

## P4: Phase Plan Critic

**Mode**: read-only

**Prompt**:

```
Critique a phase plan I'm about to execute.

I'll attach a {NN}-01-...-PLAN.md file. Read it carefully. Tell me:

1. Is the goal clearly stated?
2. Are tasks decomposed enough that an executor can ship without ambiguity?
3. What's the surgical-constraint scope? Any drift risk?
4. Are acceptance criteria mechanically verifiable?
5. What's missing? (e.g., self-test, READ-ONLY invariant, ASCII-only,
   Lock-13 wraps, frozen-vocab declarations)
6. Top 3 risks and mitigation suggestions.

Don't rewrite the plan — just critique it. Cite SGSD pattern precedent
(upgrade-drift / warp-doctor / etc.) where relevant.
```

---

## P5: Cockpit UX Critic

**Mode**: read-only

**Prompt**:

```
Review the cockpit snapshot for completeness and operator-friendliness.

1. Call sgsd_cockpit_snapshot.
2. Verify all 10 sections present (now / objective / unlock / blockers /
   agents / codex / gates / tokens / artifacts / resume_command).
3. For each section, evaluate:
   - Does it answer the corresponding operator question (Phase 73 model)?
   - Is the data actionable or just informational?
   - Any empty sections that should NOT be empty given current state?
4. Suggest UX improvements: section ordering / data formatting /
   what-to-add-next.

Read-only — no recommendations get applied.
```

---

## P6: Remote Monitoring Summary

**Mode**: read-only (may RECOMMEND share-safe redactions)

**Prompt**:

```
I'm about to share this Warp session for remote monitoring. Help me
prep a share-safe packet.

1. Call sgsd_recovery_packet.
2. Verify the 4 blocks (current_position / watchdog_state / next_unlock /
   resume_command).
3. Scan for share-unsafe content:
   - env_secrets / bearer_tokens / api_keys / redis_urls / private_kb_paths /
     unc_paths / onedrive_paths (the 7 redaction categories from Phase 68
     contract).
4. Tell me:
   - Is the packet share-safe as-is?
   - If not, which fields to redact before sharing.
   - What scrollback to clear before opening Warp Session Sharing.

Cite the safe-share checklist from SGSD-WARP-OPERATOR-GUIDE.md.
```

---

## P7: Release Readiness Explainer

**Mode**: read-only

**Prompt**:

```
Pre-flight a milestone close.

1. Call sgsd_current_state — get active milestone.
2. Call sgsd_milestone_status (milestone={active}) — phases / completion.
3. Call sgsd_gate_status — verify all latest gates in {pass, warn} (no fail).
4. Run release-readiness score (read-only): node super-gsd/tools/release-readiness/score.cjs --milestone {active}
5. Read .planning/metrics/crit-backlog.jsonl — count rows tagged to active
   milestone. edge_guard_miss = hard blocker.
6. Tell me:
   - Score (0-100) + color (GREEN/AMBER/RED).
   - Phases-with-debt (PASS-WITH-DEFERRED-N).
   - Hard blockers (edge_guard_miss count).
   - Recommended action: ready-to-ship / fix-edge-guard-first / accept-debt-and-ship-with-N.

DO NOT trigger sgsd-complete-milestone yourself. Just report readiness.
```

---

## How to use these prompts

**Direct copy-paste**:
1. Open Warp Agent input.
2. Copy a prompt block (just the ` ``` ` content between the rules).
3. Paste into Warp Agent.
4. (For P4) Drag the relevant file into the prompt as attached context.

**Save to Warp Drive Prompts**:
1. `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows) → "Add Prompt".
   (Plain `Ctrl+P` on Windows is paste-last, not the palette.)
2. Paste the prompt body.
3. Name it `SGSD: <P1 name>` etc.
4. Searchable in Command Search via the same `SGSD:` prefix as workflows.

## Mode legend

- **read-only**: Never modifies state, files, or git history. Only reads via MCP / file inspection.
- **may suggest edits**: Returns recommendations for operator to manually apply. Still doesn't modify anything itself.

No prompt in this pack auto-modifies. Per AGENTS.md hard rule 5 (no source mutations without an active phase plan), modifications happen through phase work, not Warp Agent prompts.

## Related

- `super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md` — full daily-life guide.
- `super-gsd/docs/SGSD-WARP-WORKFLOWS.md` — 13 Warp workflows (programmatic counterparts).
- `super-gsd/docs/SGSD-WARP-NOTEBOOK.md` — runnable command blocks (Phase 81).
- `super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md` — 14 MCP tools.
- `.agents/skills/sgsd-*` — 7 SGSD skills (Phase 79).
- `AGENTS.md` — tool-neutral hard rules.
