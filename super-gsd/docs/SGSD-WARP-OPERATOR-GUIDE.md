# SGSD Warp Operator Guide

How to drive SGSD from Warp on Windows, end-to-end, from blank session to autonomous run to safe off-machine monitoring. Separates **Warp UX** (operator surface) from **SGSD execution truth** (`.planning/` files).

> Audience: solo operator (Jack) on Windows 11 + Warp + Claude Code + Codex. Pairs with `WARP.md` (rules) and `AGENTS.md` (tool-neutral all-agent contract). For the deep orchestrator contract, see `CLAUDE.md`. For the workflow catalogue, see `super-gsd/docs/SGSD-WARP-WORKFLOWS.md`.

## What Warp Adds Over Plain PowerShell

PowerShell is the baseline runtime — SGSD must remain runnable in it (operator brief Rule 4 / AGENTS.md hard rule "preserve sg topology"). Warp is the **premium operator shell**.

| Concern | Plain PowerShell | Warp |
|---|---|---|
| Run SGSD commands | `sg`, `sgsd`, `sgsd-setup` work | Same -- profile-loaded; plus searchable via Workflow Search |
| Find a command | Memorise / search shell history | Type "SGSD:" or any keyword (start, auto, cockpit, token, recovery, gates, watchdog, codex, blocked, status); Warp surfaces by intent |
| Understand state | `Get-Content .planning\STATE.md -TotalCount 30 -Encoding UTF8` | Workflow `SGSD: Status` does the same; or ask Warp Agent "What's the current SGSD phase?" (uses Codebase Context) |
| Inspect changes | `git diff` | Warp Code Review panel — visual diffs, comments, attachable to Warp Agent |
| Monitor a long run | Tail logs; `Ctrl+R` history | Cockpit panes + Warp Session Sharing for off-machine view |
| Triage a stuck run | Read JSONL ledgers manually | `SGSD: Watchdog Status` + `SGSD: Recovery Packet` workflows; or ask Warp Agent for explanation |
| Diagnose setup | Trial-and-error | `SGSD: Warp Doctor` (16 read-only probes covering env / profile / workflows / files / launch config / CLI resolvers) |

## Daily Start

```
Open Warp -> tab in C:\Users\jack.berrow\GSDedits
Run workflow:  SGSD: Start          (or just type 'sg')
```

Expected behaviour:

1. SGSD cockpit opens in **a separate Windows Terminal window** (3 panes: SGSD1 mission control + SGSD2 narrative + SGSD3 codex/gates).
2. Claude Code starts in the **current Warp tab** (do not close this tab — it's Claude's session).
3. Warp's third-party CLI agent utility bar appears around Claude Code (voice / image / file / diff controls). If it doesn't appear, run `M2`/`M3` from `.planning/milestones/v2.2/MANUAL-CHECKS.md`.

You're now operator-ready. Type into Claude Code's prompt: `status`, `next`, or any prompt.

### Quick Look-Around

```
SGSD: Status                  -- where are we (frontmatter top 30 lines)
SGSD: Current Phase Artifacts -- what files does the active phase have
SGSD: Token Summary           -- where are tokens going
SGSD: Watchdog Status         -- is autopilot alive
```

## Full Auto Run

```
Run workflow:  SGSD: Full Preflight   (one-time pre-run sanity check)
Type into Claude:  go                  (or use SGSD: Auto Mode workflow)
```

Auto mode loops until one of three exit conditions fires (CLAUDE.md):

1. All phases complete.
2. Hard blocker requiring human input or runtime cannot continue.
3. You say `stop` / `pause`.

**Context percentage is NOT an exit condition.** Memory feedback `feedback_no_context_pauses.md` is explicit: never pause autonomous loop on context pressure. The 3 valid exits are the only valid exits.

### Watching A Long Auto Run

- Cockpit windows show live phase / agent / Codex / gate / token state.
- `SGSD: Watchdog Status` once a minute or so to confirm pulse.
- `SGSD: Codex Status` if you suspect a stale Codex.
- `git log --oneline -10` to see commit cadence.

### When To Step In

- Cockpit shows BLOCKED.
- `autopilot-watchdog.json` reports stall > 30 min.
- Claude Code prints "BLOCKED" or "operator confirmation required".

Otherwise: leave it alone. The framework's controlling principle is **"Autonomy continues; evidence tells the truth."** Deviations are logged honestly in `{NN}-VERIFICATION.md` DEVIATIONS sections; gates downgrade phase status (PASS-WITH-DEFERRED-N or CANDIDATE-WITH-DEBT) rather than halt.

## Recovery

If SGSD appears stuck:

```
1. Run:  SGSD: Watchdog Status
2. Run:  SGSD: Recovery Packet
3. Read .planning/ORCHESTRATOR-CHECKPOINT.md (if present)
4. Ask Warp Agent: "Use the SGSD MCP to explain why we're stuck"   (v2.3+)
                   or  "Read .planning/STATE.md and the latest phase
                        VERIFICATION.md and tell me the resume command"
5. Resume:  /sgsd-orchestrate go
```

Recovery packet has 4 blocks: current position / watchdog state / expected next unlock / resume command. Block 4 is the **safe** resume command — use it verbatim. Don't invent your own.

If the recovery packet says "no checkpoint -- ROADMAP COMPLETE" but you remember work being in flight: it's lying via stale STATE.md. Re-read STATE.md frontmatter directly to confirm.

## Gate Triage

When a gate fails or warns:

```
1. Run:  SGSD: Gate Status
2. Read the latest {NN}-ATC-REVIEW.md or {NN}-VERIFICATION.md row
3. Ask Warp Agent: "Explain the latest gate failure -- use the
                    artifact path I'll attach" + drag the .md file in
4. Decide: in-loop fix (re-dispatch executor with fix) OR backlog
   (CRIT-BACKLOG.md) OR design adjustment (next-phase plan)
```

**Don't bypass gates.** AGENTS.md hard rule 2 forbids re-implementing gate logic; same applies to bypassing it. If a gate fails, the failure is real. Either fix the underlying issue or honestly downgrade the phase status.

## Code Review

When SGSD ships file changes:

```
1. Open Warp Code Review panel (Cmd+Shift+R / equivalent)
2. Inspect the diff visually
3. Add inline comments where you disagree with a choice
4. Submit the comment batch to Warp Agent (or Claude Code) for response
5. Re-run the relevant phase plan if changes needed
6. Otherwise: commit accepts the diff
```

Warp Code Review is a **human review surface**. It does NOT replace SGSD's mechanical gates (ATC, verifier, MUDA, release-readiness). The mechanical gates produce evidence; Warp Code Review surfaces that evidence to your eyes.

## Remote Monitoring

```
Run workflow:  SGSD: Remote Monitor Packet
Capture the 4-block output
Verify nothing private is in it (paths / tokens / private KB content)
Open Warp Session Sharing
Share to phone / second machine
Walk away
```

While remote: cockpit + Claude tab visible via Warp Session Sharing's web viewer. Share view shows live agent activity + tool use + thinking indicators.

**Sharing risks** (operator brief):

- Scrollback can leak credentials or private paths.
- Drive workflows / saved env vars are visible in Warp Drive panes.
- VTP / private KB content may surface in Codebase Context replies.

Mitigation: `SGSD: Remote Monitor Packet` is designed to be share-safe (4 short blocks). Stop the share when you're back at the desk.

## Safe Sharing Checklist

Before opening Warp Session Sharing:

```
[ ] No .env / secrets file recently opened in any Warp tab
[ ] No `Get-Content settings.json` in scrollback (env block leaks keys)
[ ] No VTP MCP queries returning private body content visible
[ ] No git diff with personal/internal text in current Code Review
[ ] No private repo names in cockpit or Drive workflows
[ ] Token summary rows don't expose API key fragments (they shouldn't, but check)
[ ] You actually want this person watching THIS session
```

## VTP / Private KB Optionality

VTP / private knowledge bank is **optional** (operator brief Rule 6 / AGENTS.md hard rule 3 / README.md preamble). Many SGSD installs lack it. The integration must:

- Never hard-fail when VTP is absent.
- Degrade gracefully via Phase 48 (`selective VTP bridge`) — MCP failures land in `vtp-bridge-failures.jsonl`, not in research conclusions.
- Never include VTP-private paths in shared sessions or MCP responses (when v2.3 ships).

If you're sharing this guide with someone whose install lacks VTP: everything in this document still works. The "ask Warp Agent" examples that mention VTP gracefully fall back to Codebase Context.

## Plain PowerShell Fallback

When Warp is broken / unavailable:

```powershell
# Manual cockpit boot
. $PROFILE
sgsd

# Manual Claude session
claude --dangerously-skip-permissions

# Manual status check
Get-Content .planning\STATE.md -TotalCount 30 -Encoding UTF8

# Manual recovery
if (Test-Path .planning\ORCHESTRATOR-CHECKPOINT.md) {
    Get-Content .planning\ORCHESTRATOR-CHECKPOINT.md -Encoding UTF8
}

# Manual token summary
node super-gsd/tools/token-attribution/collect.cjs --write --all --agent-spend --summary --current

# Manual workflow lint
node super-gsd/tools/warp-workflow-lint/lint.cjs --project C:\Users\jack.berrow\GSDedits

# Manual setup health check
node super-gsd/tools/warp-doctor/check.cjs --project C:\Users\jack.berrow\GSDedits
```

Everything in `super-gsd/tools/*` and `super-gsd/scripts/*` is designed to work in plain PowerShell without Warp. Warp adds discoverability and operator UX; it does NOT add capability.

## What To Ask Warp Agent

Read-only state queries — Warp Agent is your friend here:

```
"Read .planning/STATE.md frontmatter and summarise."
"What phase is SGSD on right now?"
"What are the 5 most recent commits?"
"Read the latest .planning/milestones/v2.2/phases/{NN}-*/{NN}-VERIFICATION.md and summarise."
"Use the SGSD MCP to explain the current gate status."   (v2.3+)
"Compare this WASTE.md to the previous milestone's WASTE.md."
"Read AGENTS.md and tell me the 5 hard rules."
"Read SGSD-WARP-WORKFLOWS.md and recommend which workflow to run for X."
```

Design / planning queries — Warp Agent helps but does NOT decide:

```
"What should I plan for the next milestone? Read the analyses/ directory."
"Critique this PLAN.md — what's missing?"
"What's the operator brief Rule 14 about?"
```

## What NOT To Ask Warp Agent To Override

These are SGSD execution-truth concerns; Warp Agent must NOT mutate them:

```
DO NOT: "Update .planning/STATE.md to mark phase 70 PASS"
        (orchestrator owns STATE.md; Warp Agent must read, never write)

DO NOT: "Commit the staged changes for me"
        (commits happen at phase close inside the orchestrator loop;
         out-of-band commits corrupt audit trail)

DO NOT: "Skip the ATC review for this phase"
        (gates are mechanical; bypass = correctness violation)

DO NOT: "Move the phase 65 .md files to phase 66"
        (phase artifacts are append-only history; never relocate)

DO NOT: "Delete the failing test"
        (test failures are evidence; they go into CRIT-BACKLOG, not /dev/null)

DO NOT: "Run sgsd-complete-milestone for me"
        (milestone close is gate-protected; let the orchestrator trigger it)
```

These are AGENTS.md hard rules (1, 2, 5) and operator brief Rules (1, 2, 9, 10) projected onto Warp Agent's behaviour.

## Common Operator Mistakes

1. **Closing the Claude tab mid-run**. Restart with `sg` from the same project dir; Claude resumes from the last checkpoint.
2. **Editing .planning/STATE.md by hand**. Use `/sgsd-orchestrate go` instead — STATE.md is orchestrator-owned. Manual edits cause cockpit drift like the operator just diagnosed in this auto-run (Phase 63 close required STATE.md repointing).
3. **Sharing a session with credentials in scrollback**. Always run `SGSD: Remote Monitor Packet` first; verify the 4 blocks; only then share.
4. **Bypassing M1-M5 manual checks**. UI-bound facts cannot be terminal-derived. The doctor flags them as MANUAL-CHECK-REQUIRED for a reason.
5. **Asking Warp Agent for current SGSD state but trusting its hallucinations**. If Warp Agent's claims contradict `.planning/STATE.md`, trust STATE.md. (v2.3 MCP eliminates this gap.)

## Reference Paths On This Machine

| Path | What |
|---|---|
| `C:\Users\jack.berrow\GSDedits` | Project root (this checkout) |
| `C:\Users\jack.berrow\AppData\Local\Programs\Warp\Warp.exe` | Warp install |
| `C:\Users\jack.berrow\.warp\launch_configurations\` | Warp launch configs (currently empty -- M4) |
| `C:\Users\jack.berrow\AppData\Roaming\npm\claude.ps1` | Claude Code CLI |
| `C:\Users\jack.berrow\AppData\Roaming\npm\codex.ps1` | Codex CLI |
| `~\OneDrive - John Cullen Lighting\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1` | PowerShell profile (defines `sg`, `sgsd`, `sgsd-setup`) |
| `.planning/STATE.md` | Active state (frontmatter cockpit-readable) |
| `.planning/milestones/{milestone}/ROADMAP.md` | Active milestone roadmap |
| `.planning/ORCHESTRATOR-CHECKPOINT.md` | Recovery point (when present) |
| `.planning/metrics/*.jsonl` | Append-only evidence ledgers |
| `super-gsd/tools/warp-doctor/check.cjs` | Phase 67 -- 16-probe setup health |
| `super-gsd/tools/warp-workflow-lint/lint.cjs` | Phase 64 -- 13-workflow YAML lint |
| `super-gsd/docs/SGSD-WARP-WORKFLOWS.md` | Phase 64 -- operator-facing workflow index |
| `.planning/milestones/v2.2/WARP-SMOKE.md` | Phase 63 -- evidence matrix (what's terminal-proven vs UI-bound) |
| `.planning/milestones/v2.2/MANUAL-CHECKS.md` | Phase 63 -- 5 UI-bound checks the operator performs |

## Related

- `WARP.md` -- Warp-specific operator instructions (commands + rules + integration direction).
- `AGENTS.md` -- Tool-neutral all-agent contract (truth locations, rule hierarchy, hard rules).
- `CLAUDE.md` -- Claude Code orchestrator contract (loop, dispatch, exit conditions, model routing, checkpoint protocol).
- `super-gsd/docs/SGSD-WARP-WORKFLOWS.md` -- 13-workflow catalogue.
- `.planning/milestones/v2.2/WARP-SMOKE.md` + `MANUAL-CHECKS.md` -- Phase 63 evidence + operator checklist.
- `.planning/analyses/2026-04-29-warp-ecosystem-atlas.md` -- Deep Warp feature map.
- `.planning/analyses/2026-04-29-sgsd-warp-convergence-audit.md` -- Division of responsibility (Warp UX vs SGSD truth vs MCP bridge).

## Operator Routine TL;DR

```
Daily Start:
  sg           (or workflow: SGSD: Start)
  Then trust the cockpit windows + Claude tab.

Daily Check:
  SGSD: Status   ->   SGSD: Watchdog Status   ->   SGSD: Token Summary

Daily Recovery:
  SGSD: Recovery Packet   ->   /sgsd-orchestrate go

Daily Diagnose:
  SGSD: Warp Doctor   ->   fix anything MISSING

Off-machine:
  SGSD: Remote Monitor Packet   ->   verify share-safe   ->   Warp Session Sharing
```

That's the daily operator loop. Everything else is a tool you reach for when this loop hits an edge case.
