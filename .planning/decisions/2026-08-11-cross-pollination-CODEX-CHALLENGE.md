codex-exec: report contract violation

--- codex stdout ---
CHALLENGE_VERDICT: memo-unsafe
SURVIVING_OBJECTIONS: GREEN proves availability, not demand, routing quality, or acceptable SGSD cost; the probe wrongly applies “zero writes” to feedback, whose purpose is writing; Step 6.b.5 has no enforced timeout and can stack triage with its five-tool cascade, the per-dispatch bridge, and planner MCP calls; fire-and-forget dual writes lack atomic correlation, idempotency, reconciliation, and correction semantics; RED is instrumentation, not deletion, and its “override” has no route to override; automatic phase-close taste labels cannot prove actual use, while strict v1 cannot represent general artefacts.
BINDING_ADDITIONS: Make logging-only baseline followed by triage shadow-mode the mandatory sequence for both probe outcomes; predeclare eligible queries and record inadequacy before triage, including denominator, latency, tokens, call count, and quality delta; block automatic route-following on gold-set human approval; define mutual exclusion and one total VTP call budget across triage/cascade/bridge/planner; implement real cancellation; use a durable idempotent decision_id/triage_id outbox with replay deduplication, pending/reconciled states, and superseding corrections, counting only unique reconciled pairs; test feedback writes in isolation and require reasons for modify/reject; defer automatic taste feedback until stable artefact IDs, v2, and end-to-end usage provenance exist; activate a milestone and approved PLAN before source edits.
ONE_LINER: The fork confuses capability with earned demand—RED is the baseline that must precede GREEN, while the proposed GREEN path currently adds an unvalidated multi-call critical path and corruptible evidence stream.

--- codex stderr ---
OpenAI Codex v0.146.0
--------
workdir: C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019fee31-d301-7220-9262-44560832fbd9
--------
user
# CODEX CHALLENGE — SGSD Board Decision Memo (cross-pollination Phase 0)

You are a SEPARATE Codex reviewer challenging the SGSD board's decision before it executes (per the blocker/decision recovery contract: board memo must survive an independent Codex challenge). Be adversarial. Your job is to find the flaw the board missed, not to ratify.

Challenge specifically:
1. Is the CONDITIONAL-GO fork sound, or does it smuggle a build past a real OPPOSE? The Contrarian voted OPPOSE-UNLESS — is the 'unless' genuinely satisfied by a tool-resolves probe, or does the deeper objection (SGSD manufacturing VTP's demand evidence at SGSD cost) survive even a GREEN probe?
2. Is 'extend Step 6.b.5' actually safe, or does bolting an advisory vtp_triage call into the pre-planning enrichment cascade create a hidden critical-path or a double-enrichment (triage route + existing 5-tool cascade both firing)?
3. Is the versioned-ledger + fire-and-forget condition sufficient, or is there a data-integrity or replay hazard in append-only advisory ledgers the board glossed?
4. Is the RED-fork fallback (logging-only) actually distinct from the GREEN branch's skill 1, or is the board proposing to build essentially the same thing either way — meaning the precondition doesn't actually gate anything?
5. Anything the board should have killed outright.

Report contract (exact lines):
CHALLENGE_VERDICT: memo-sound | memo-needs-revision | memo-unsafe
SURVIVING_OBJECTIONS: none | <list the objections that survive the board's reasoning>
BINDING_ADDITIONS: none | <conditions the board must add before executing>
ONE_LINER: <summary>

## Board Decision Memo
---
decision: cross-pollination-engine Phase-0 (SGSD side)
date: 2026-08-11
board: sgsd-ceo synthesis of Architect + Pragmatist + Contrarian
vote: 2 SUPPORT-WITH-CONDITIONS + 1 OPPOSE-UNLESS (all conf 4)
verdict: CONDITIONAL GO — the "unless" and the "conditions" are the same gate
status: PENDING CODEX CHALLENGE
---

# Decision Memo — SGSD↔VTP Cross-Pollination Phase 0

## Verdict
CONDITIONAL GO. The 2-1 split is not a real disagreement: the Contrarian's
OPPOSE-UNLESS is satisfied by the exact precondition the other two seats made
binding. Frame the precondition as a FORK and all three positions merge.

## The unanimous binding precondition (the fork)
No skill code — none — until a LIVE probe in a fresh session/MCP child confirms
`vtp_triage` and `vtp_triage_feedback` resolve AND honour contract:
execution.performed=false, zero writes, reason-required-on-reject. This tool
absence is the harness-vs-production seam that recurred 6x in v3.5; it is a hard
gate, not a warning. (Probe requires a session restart — operator-owned; the
current MCP child predates vtp-triage-v2 per VTP health = healthy but tool absent.)

## The fork
- **Probe GREEN** (tools resolve + honour contract) → BUILD Phase 0 as one
  Codex-executable phase: skill 1 sgsd-triage-first (extend Step 6.b.5, reuse
  its D-08 degraded/timeout path and cached vtp_available; never inline-blocking),
  skill 2 sgsd-taste-feedback (phase-close hook). Architect + Pragmatist path.
- **Probe RED** (tools genuinely unshipped, not stale-child) → fall back to the
  Contrarian's deletion: logging-only extension of Step 6.b.5 — closed-vocab
  override-reason field + route-decisions.jsonl row, NO vtp_triage call — run
  4 weeks, revisit when VTP ships the tools. No skill built on a phantom.

## Binding conditions on the GREEN branch
1. Ledger schema ships with explicit `schema_version` + nullable `artefact_kind`
   → Phase-B v2 records land additively, zero rewrite. (Architect)
2. All triage calls inherit Step 6.b.5's bounded-timeout degraded path; all
   feedback writes are fire-and-forget append-only to
   .planning/metrics/triage-advisory/ — triage absence/latency NEVER blocks a
   dispatch or phase close. (Architect)
3. Override/reject reason is a REQUIRED closed-vocab field, or the 4-week/
   20-query demand falsifier self-corrupts into rubber-stamping. (all 3 seats)
4. skill 1 is a question-formulation wrapper INSIDE the existing cascade — no
   second gate object, no second health check. (Architect + anti-slop, handover:69)
5. Skills 3-4 CONTRACT-STUB ONLY — zero code against unbuilt VTP Phase A/B.
   (all 3 seats)

## Adopted falsifiers (verbatim from handover)
- 4-week demand test: <20 truthfully-recorded inadequate-path queries → Phase C
  does not proceed on schedule.
- 90-day check (after v2 records): <20 decisions, acceptance ~100% or <10%, or
  problems mostly singletons → halt and reassess.
- gold-set human approval (triage-gold-set.v1.json) stays OPEN; not a Phase-0
  build blocker but not to be closed around.

## Zero-VTP-dependency work sanctioned to start NOW (Pragmatist's safe parallel)
The route-decisions.jsonl + taste-ledger schema design (schema_version,
artefact_kind reserved, closed-vocab reason enum) has NO VTP dependency and may
be drafted while the surface is being verified. This is the only sanctioned
pre-probe build.

## Contrarian's standing caution (recorded, honoured)
SGSD is partly manufacturing VTP's demand evidence. Mitigation: the closed-vocab
required reason (condition 3) makes the demand signal falsifiable, not fabricated;
and the RED fork ensures no skill is built until the surface — and via the 4-week
test, the demand — is earned.

## Source handover
---
doc: sgsd-handover
milestone: cross-pollination-engine
status: QUEUED (Phase 0 active immediately)
date: 2026-08-11
audience: SGSD orchestrator + skill authors (Codex-executed)
governing_inputs:
  - INTENT.md (binding phase plan)
  - BOARD-MEMO.md (3 SUPPORT / 1 OPPOSE, binding sequencing + falsifiers)
  - qmd-docs/meetings/vtp-briefing.md doc:3c53fd7b19f9 Stage 3 (prior design)
consumes_from_vtp:
  - vtp_triage (LIVE, shipped in vtp-triage-v2)
  - vtp_triage_feedback (LIVE, advisory feedback ledger v1)
  - vtp_route_and_retrieve / vtp_search_substrate (LIVE)
  - vtp_cross_pollinate (Phase A, not yet built)
  - problem ledger problems.json (Phase B, not yet built)
---

# SGSD ↔ VTP Communication Infrastructure — Handover

## Why this handover exists

SGSD currently talks to VTP through ONE surface: the pre-planning
enrichment gate (Step 6.b.5, keyword-cascade search). The cross-
pollination milestone gives VTP a triage door, an advisory cluster
tool, a problem ledger, and a taste ledger. This document specifies the
four SGSD skills that consume those surfaces, so SGSD can build the
bridge on its side. The bridge is bidirectional and each half solves
the other's hardest open problem:

- SGSD gets better-routed, cluster-informed, precedent-backed context
  for research, planning, and blocker recovery.
- VTP gets the ORGANIC DEMAND EVIDENCE its Phase 0 gate requires
  (contrarian falsifier: 20+ real cross-idea/problem queries in 4
  weeks). SGSD's dozens of daily dispatch questions are that stream.

## What exists today (build against these, do not wait)

| Surface | Status | Contract |
|---|---|---|
| `vtp_triage` | LIVE | Input: question + optional context. Output: compiled advisory route (archetype, tool plan, BLOCKING_AMBIGUITY first), `execution.performed=false`, zero writes. Classifier-only authority: the caller follows or overrides. |
| `vtp_triage_feedback` | LIVE | Records accept/modify/reject + reason code against a triage_id. Reason REQUIRED for rejected/modified. Ledger confined to `.planning/metrics/triage-advisory/`. |
| VTP enrichment gate | LIVE | Step 6.b.5 in sgsd-orchestrate; 5-tool cascade; enrich-only. |
| Blocker-recovery loop | LIVE | Board + Codex challenge path in sgsd-orchestrate. |

## What is coming (gate skill activation on these)

| Surface | Phase | Gate before SGSD may call it |
|---|---|---|
| `vtp_cross_pollinate` | A | retrieval-quality SHIPPED + benchmark re-frozen. Advisory: ≤8 clustered idea IDs + rationale codes, zero writes, store-untouched digests. |
| `problems.json` ledger | B | Built under cove-claim-integrity. Stable problem IDs, evidence-store embedded, linked to claims/commitments/ideas. External problem = SAME SHAPE as internal. |
| Feedback record v2 | B | Adds `artefact_kind` so ledger rows can label cross-pollination artefacts. NOT a coercion of strict v1 — new schema version. |
| Synthesis write-back | C | CoVe SHIPPED + demand proven + named human gate on every write. |

## The four skills to design

### 1. sgsd-triage-first — BUILDABLE NOW (Phase 0 instrument)

- **Trigger:** before every research, planning, or blocker dispatch
  that formulates a question against the KB.
- **Calls:** `vtp_triage(question, context)` → treat compiled route as
  ADVISORY. Follow it, or override it.
- **Records:** every decision via `vtp_triage_feedback` (accepted /
  modified / rejected + reason code) and a
  `route-decisions.jsonl` row with `boundary='vtp_triage_advisory'`.
- **Why:** SGSD's query volume IS the organic usage stream Phase 0
  needs. The loop gets better retrieval; VTP gets demand evidence.
- **Anti-slop constraint:** this wraps the EXISTING enrichment gate's
  question formulation — extend Step 6.b.5, do not add a parallel gate.

### 2. sgsd-taste-feedback — BUILDABLE NOW (Phase 0 instrument)

- **Trigger:** phase close (hook into sgsd-complete-phase / Step 6.6).
- **Does:** logs which VTP-injected context (enrichment hits, triage
  routes, later clusters/matches) was actually USED in shipped work:
  accepted / modified / unused + reason, keyed by proposal/artefact ID.
- **Writes:** v1 feedback ledger now; migrate to v2 records (with
  `artefact_kind`) when Phase B ships them.
- **Why:** the taste ledger is the defensible asset (board: "the
  matcher is commodity; the labelled preference ledger is not").
  Machine-cadence labels, human-auditable.

### 3. sgsd-problem-match — GATED ON PHASE B

- **Trigger:** when a blocker brief is written
  (`{phaseDir}/{N}-BLOCKER-RECOVERY-BRIEF.md`), BEFORE any board
  convenes.
- **Calls:** problem-ledger lookup (lexical identity + semantic
  candidates): has this failure shape been solved before, in-repo or in
  an ingested precedent? Attach matches to the brief.
- **Writes back:** every RESOLVED blocker back-fills the ledger as a
  problem + solution pair (stage-then-merge, never direct writes).
- **Why:** boards stop re-deriving known solutions; SGSD becomes both
  consumer and contributor of the compounding precedent library.

### 4. sgsd-cross-pollinate-plan — GATED ON PHASE A

- **Trigger:** phase-planning time (before gsd-planner dispatch).
- **Calls:** `vtp_cross_pollinate(phase_goal)` → which enriched ideas,
  prior milestone lessons, and book principles cluster around this
  work? Inject the cluster WITH CITATIONS into the planner prompt.
- **Why:** upgrades the enrichment gate from keyword search to cluster
  reasoning — plans start from the KB's combined position, not one
  lucky hit.
- **Constraint:** advisory only; the planner may discard the cluster.
  Every injection gets a taste-feedback row at phase close (skill 2).

## Build order for SGSD

1. **Now:** sgsd-triage-first + sgsd-taste-feedback (both surfaces are
   live; zero VTP-side work needed). These two ARE Phase 0.
2. **After retrieval-quality ships + Phase A lands:**
   sgsd-cross-pollinate-plan.
3. **After cove-claim-integrity + Phase B lands:** sgsd-problem-match.

## Hard constraints (board-recorded, do not relitigate)

- All new tools are ADVISORY: `execution.performed=false`, zero writes,
  caller decides. Never bypass a named human gate on idea-development
  writes (stage-then-merge; direct writes to idea-developments.json are
  a known clobber hazard).
- Synthesis artefacts carry generation-depth ≤1 (gate-enforced) and
  land UNCONSOLIDATED; promotion only on corroboration.
- Similarity is not transferability: no skill may treat cosine
  proximity as an applicability test; analogy needs the METHOD sources
  (TRIZ, Gentner structure-mapping) ingested in Phase B.
- Precision over volume: five right firings a week beat two hundred
  noisy ones. Emission stays gated by the taste ledger.
- Dead-ends: standalone engine module; board-debate as validation;
  full gsd-graph unpark; fine-tuning on the ledger; autonomous sweeps
  without a precision gate; accretion without corrective feedback.

## Kill-switches and falsifiers SGSD must respect

- Contrarian's demand test: if 4 weeks of sgsd-triage-first usage does
  NOT produce 20+ queries where existing paths were recorded
  inadequate, Phase C does not proceed on schedule.
- Moonshot's 90-day check (after v2 records exist): <20 ledger
  decisions, acceptance ~100% or <10%, or problems mostly singletons →
  halt and reassess the whole loop.
- Operator item still open: gold-set human approval
  (`src/contracts/fixtures/triage-gold-set.v1.json`).

codex
I’m treating this as an adversarial, read-only memo review. I’ll first load the required skill guidance, then verify the memo’s claims against `.planning/` and the actual Step 6.b.5 / ledger contracts before issuing only the four required lines.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw 'C:\\Users\\jack.berrow\\.codex\\skills\\using-superpowers\\SKILL.md'" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
 succeeded in 1042ms:
---
name: using-superpowers
description: Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## Instruction Priority

Superpowers skills override default system prompt behavior, but **user instructions always take precedence**:

1. **User's explicit instructions** (CLAUDE.md, GEMINI.md, AGENTS.md, direct requests) ƒ?" highest priority
2. **Superpowers skills** ƒ?" override default system behavior where they conflict
3. **Default system prompt** ƒ?" lowest priority

If CLAUDE.md, GEMINI.md, or AGENTS.md says "don't use TDD" and a skill says "always use TDD," follow the user's instructions. The user is in control.

## How to Access Skills

**In Claude Code:** Use the `Skill` tool. When you invoke a skill, its content is loaded and presented to youƒ?"follow it directly. Never use the Read tool on skill files.

**In Copilot CLI:** Use the `skill` tool. Skills are auto-discovered from installed plugins. The `skill` tool works the same as Claude Code's `Skill` tool.

**In Gemini CLI:** Skills activate via the `activate_skill` tool. Gemini loads skill metadata at session start and activates the full content on demand.

**In other environments:** Check your platform's documentation for how skills are loaded.

## Platform Adaptation

Skills use Claude Code tool names. Non-CC platforms: see `references/copilot-tools.md` (Copilot CLI), `references/codex-tools.md` (Codex) for tool equivalents. Gemini CLI users get the tool mapping loaded automatically via GEMINI.md.

# Using Skills

## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means that you should invoke the skill to check. If an invoked skill turns out to be wrong for the situation, you don't need to use it.

```dot
digraph skill_flow {
    "User message received" [shape=doublecircle];
    "About to EnterPlanMode?" [shape=doublecircle];
    "Already brainstormed?" [shape=diamond];
    "Invoke brainstorming skill" [shape=box];
    "Might any skill apply?" [shape=diamond];
    "Invoke Skill tool" [shape=box];
    "Announce: 'Using [skill] to [purpose]'" [shape=box];
    "Has checklist?" [shape=diamond];
    "Create TodoWrite todo per item" [shape=box];
    "Follow skill exactly" [shape=box];
    "Respond (including clarifications)" [shape=doublecircle];

    "About to EnterPlanMode?" -> "Already brainstormed?";
    "Already brainstormed?" -> "Invoke brainstorming skill" [label="no"];
    "Already brainstormed?" -> "Might any skill apply?" [label="yes"];
    "Invoke brainstorming skill" -> "Might any skill apply?";

    "User message received" -> "Might any skill apply?";
    "Might any skill apply?" -> "Invoke Skill tool" [label="yes, even 1%"];
    "Might any skill apply?" -> "Respond (including clarifications)" [label="definitely not"];
    "Invoke Skill tool" -> "Announce: 'Using [skill] to [purpose]'";
    "Announce: 'Using [skill] to [purpose]'" -> "Has checklist?";
    "Has checklist?" -> "Create TodoWrite todo per item" [label="yes"];
    "Has checklist?" -> "Follow skill exactly" [label="no"];
    "Create TodoWrite todo per item" -> "Follow skill exactly";
}
```

## Red Flags

These thoughts mean STOPƒ?"you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ƒ%ÿ using the skill. Invoke it. |

## Skill Priority

When multiple skills could apply, use this order:

1. **Process skills first** (brainstorming, debugging) - these determine HOW to approach the task
2. **Implementation skills second** (frontend-design, mcp-builder) - these guide execution

"Let's build X" ƒÅ' brainstorming first, then implementation skills.
"Fix this bug" ƒÅ' debugging first, then domain-specific skills.

## Skill Types

**Rigid** (TDD, debugging): Follow exactly. Don't adapt away discipline.

**Flexible** (patterns): Adapt principles to context.

The skill itself tells you which.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.

C:\Users\jack.berrow\OneDrive - John Cullen Lighting\Documents\WindowsPowerShell\profile.ps1 : Cannot dot-source this 
command because it was defined in a different language mode. To invoke this command without importing its contents, 
omit the '.' operator.
At line:1 char:1
+ . 'C:\Users\jack.berrow\OneDrive - John Cullen Lighting\Documents\Win ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [profile.ps1], NotSupportedException
    + FullyQualifiedErrorId : DotSourceNotSupported,profile.ps1
 
C:\Users\jack.berrow\OneDrive - John Cullen Lighting\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1 : 
Cannot dot-source this command because it was defined in a different language mode. To invoke this command without 
importing its contents, omit the '.' operator.
At line:1 char:1
+ . 'C:\Users\jack.berrow\OneDrive - John Cullen Lighting\Documents\Win ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [Microsoft.PowerShell_profile.ps1], NotSupportedException
    + FullyQualifiedErrorId : DotSourceNotSupported,Microsoft.PowerShell_profile.ps1
 

codex
I’m using the required `using-superpowers` guidance to keep the review evidence-led and read-only. No more specialized skill matches this board-memo challenge, so I’m checking the repository contracts directly rather than treating the memo’s descriptions as facts.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command 'rg --files .planning super-gsd | rg "(cross-poll|BOARD-MEMO|INTENT|sgsd-orchestrate|route-decisions|triage-advisory|taste|feedback|registry|Step|orchestrat)"' in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "Get-Content -Raw '.planning\\STATE.md'" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "rg -n -S \"Step 6\\.b\\.5|6\\.b\\.5|vtp_triage|vtp_triage_feedback|route-decisions|triage-advisory|fire-and-forget|taste-ledger|inadequate-path|inadequate\" .planning super-gsd .warp 2>"'$null' in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
 succeeded in 634ms:
---
gsd_state_version: 1.0
milestone: v3.5
current_phase: "150"
milestone_name: Always-On Orchestration ƒ?" governance as runtime mechanism in all session modes
milestone_status: "v3.5 SHIPPED-WITH-DEFERRED-1 2026-08-10 ƒ?" Always-On Orchestration COMPLETE. 7/7 phases closed; substrate published to origin/master (c0aff22->4f2f916) + installed locally under operator authorization; local trust guard proven; T150-07 devcp propagation deferred (live sessions). Milestone SUMMARY written. No next milestone declared ƒ?" awaiting operator."
status: "v3.5 ACTIVE 2026-08-06 ƒ?" P145 codex-profile-control CLOSED PASS-WITH-DEFERRED-4 @ c1596f7 (profile registry + /sgsd-codex-control + 4 CRIT security fixes total: 2 per-dispatch-ATC pre-commit, GAP-1 verifier env-var TTY bypass, phase-ATC silent report-write; self-tests 21/21 + Probes 1-7 + parity + control all PASS; deferred: A selfTestCliGuard non-TTY forcing, B 3-way CLI-default drift guard, C inert trust/hook fieldsƒÅ'P148/P150, DEVIATION-1 finalize probe simplification). Next: P148 cross-model triage. v3.4 PARKED at P142/P143 (cockpit alarm+rationale drawers, close) ƒ?" reopen after v3.5 or on operator call. v3.4 P999 pink-elephant visual smoke also parked."
stopped_at: 2026-04-29 ƒ?" Phase 63 closed PASS-WITH-DEFERRED-5 @ b5b46a8 (Warp Capability Smoke Test; 7 artifacts under .planning/milestones/v2.2/; 13-row evidence matrix in WARP-SMOKE.md; 5 operator UI manual checks M1-M5 pending in MANUAL-CHECKS.md; sg-launched-Claude topology proven empirically ƒ?" this Claude session itself is the evidence; ~/.warp/launch_configurations/ exists but empty; .warp/workflows lint 4/5 with sgsd-token-current.yaml missing arguments block forwarded to Phase 64; .warpindexingignore missing forwarded to Phase 65 or new ignore-pack phase; tmux not native on Windows; Warp install at ~/AppData/Local/Programs/Warp/Warp.exe; previous roadmap v1.6-v2.1 ROADMAP COMPLETE 2026-04-29 preserved in previous_roadmap block ƒ?" all 30 phases (26-62) shipped across 6 milestones (v1.6 SHIPPED-WITH-DEBT-10, v1.7-v2.1 SHIPPED clean)).
last_updated: "2026-08-05T00:00:00Z"
last_activity: "2026-05-20 v3.0 SGSD-PRO ACTIVATED ƒ?" operator issued /sgsd-orchestrate auto. Milestone opened at scaffold commit 52c687a (INTENT + ROADMAP + REQUIREMENTS + DLB-08 design lock + P106 CONTEXT + master proposal + infographic ingested). Auto-loop dispatched Codex to author 106-01 PLAN-LOCKED.md against plan-schema-v2 SCHEMA-09 (must include semantic_acceptance_criteria per DLB-07). Mission: lineaged role-filtered cognitive memory underneath SGSD's central control plane. Seven CMB types (execution_receipt observation / review_finding claim / evidence_verdict claim-with-authority / decision_recommendation decision / operator_precedent highest / context_anchor projection / promotion_decision terminal). Four MVP exit fixtures (A false-CRIT refuted / B context-aware pseudo-op / C lineage chain / D production-mutation forces escalation). Stale autopilot-watchdog checkpoint pointing at v2.9/P95 deleted on entry (was generated by watchdog after 1569 min inactivity on closed milestone; misleading)."
legacy_activity_v2_9_resync: "2026-05-18 v2.9 RE-SYNC + P97.5 LANDED + ALL-PHASES-CLOSED ƒ?" STATE.md progress block was wildly stale (showed phase_98 ACTIVE, 99-105 PENDING) while SUMMARY.md @ 8fb3b09 already documented all 8 phases closed. This session inserted P97.5 Semantic Verification Gate (commit chain 34520c0 ƒÅ' 9901568 ƒÅ' 2fa3bbc ƒÅ' 6e66ad0) carrying DLB-07 (Clarity-incident-driven post-mortem) and mechanical schema enforcement of semantic_acceptance_criteria via SCHEMA-09/-10. v2.9 now 9 phases (97.5 + 98-105), all PASS / PASS-WITH-DEFERRED-2. Per sgsd-complete-milestone skill idempotency: SUMMARY.md exists ƒÅ' skill is no-op; remaining work is the STATE.md re-sync flagged in SUMMARY.md \"Critical Gaps #1\". Open items roll forward: warp-mcp 15th tool (DEFERRED-1), cockpit 12th section (DEFERRED-2), 18-plan SAC backfill or skip_gates per 97.5-BACKFILL.md, M1-M5 manual UI checks, Phase 95 ACP re-entry pending Warp #7326, v2.6 SHIPPED-clean operator decision."
legacy_activity_v2_9_activation: "2026-04-30T00:00Z v2.9 ACTIVATION ƒ?" operator activated Agentic Harness Evolution roadmap. v2.8 closed at 2466ff1 (Phase 97 release gate; 149/149 self-tests; 22/25 readiness; READY-WITH-DEFERRED). Entering v2.9 P98 Harness Component Substrate (registry + catalog.cjs + ƒ%¾15-assertion self-test + SGSD-HARNESS-EVOLUTION.md). v2.9 pre-designed in CLAUDE-HANDOVER.md / ROADMAP.md / REQUIREMENTS.md / VTP-AHE-EVIDENCE.md. Mission: turn SGSD from hand-improved orchestrator into observability-driven harness with closed AHE loop (component ƒÅ' evidence ƒÅ' predicted edit ƒÅ' measured next-run outcome ƒÅ' keep/revert/pivot). Phases 98-105 scoped: 98 component substrate, 99 trajectory evidence corpus, 100 change manifest prediction ledger, 101 attribution+rollback gate, 102 harness evolution runner, 103 component ablation+interference, 104 transfer+OOD benchmark, 105 release gate+cockpit integration. Non-negotiable: protected oracle/verifier/model-config/budget never edited by evolution loop. STATE.md surgical repoint only ƒ?" operator owns canonical legacy frontmatter re-sync (SUMMARY.md gap #1)."
legacy_activity_v2_6: "2026-04-29T21:25Z RE-SYNC ƒ?" STATE.md was stale (mtime 20:07; latest pulse 21:19; 5 commits since 81-85). Operator override at Phase 85 close flagged: STATE.md staleness + Codex unavailability + context-packet builder dormant + token burn ~21.5M (orchestrator alone ~18M; root context ~775k tokens/turn). Phase 86 PAUSED to address 7-point token-control list + 3 Phase-85 deferrals. Auto-run completed 19/19 phases this session (63-83) plus 84+85; current commits b5b46a8 / d35e92a / eb252f3 / c0201af / 018028e / 5ae2ba0 / 3b2186f / f5fe11a / 4e2b19c / 8dbb9cb / 31907c2 / 0211b0c / dcd039b / 0905cbf / ebfaf7c / 11bb6bb / 2ab84d7 / 6f50232 / 1baf708 / 6021fbb / ad5948d / 72e0d6b / 5914be6 / 6ba04f8 / 22aedd5 / a6b83c8 / bd54eb3 / 5a74bda / 8eb7de8 / e69271e / 7256a76 / 350e101 / 19e544e / 2e8ce85 / 8bad3ad / 347c56a. Original Phase 63 close text preserved in v2_2 progress block below; full per-phase progress in v2_3-v2_6 blocks below. v2.2 milestone scaffolded; 7 artifacts under .planning/milestones/v2.2/ (WARP-SMOKE.md + MANUAL-CHECKS.md + 5 standard phase artifacts CONTEXT/PLAN/RESEARCH/VERIFICATION/ATC-REVIEW). Evidence matrix records 5 PASS rows (Q2/Q3/Q4/Q7/Q8: sg/sgsd/sgsd-setup interactive resolution + sg-keeps-Claude-in-current-tab topology + launch config dir empty), 1 PARTIAL (Q12: 4/5 workflow YAML lint OK; sgsd-token-current.yaml missing arguments block ƒ?" Phase 64 input), 1 DOCS-CONFIRMED (Q11: WSL/SSH disables Codebase Context per Warp docs), 5 MANUAL-CHECK-REQUIRED (Q1/Q5/Q6/Q9/Q10: workflow searchability + claude/sg utility-bar detection + launch-config active-window behavior + Codebase Context state ƒ?" operator verifies in Warp UI per MANUAL-CHECKS.md M1-M5). Forwarded to Phase 64+: workflow pack completion (Q12+Q1), AGENTS.md (Phase 65), .warpindexingignore (Phase 65 or new ignore-pack phase), warp-doctor probes (Phase 67), launch-config templates must NOT assume active-window (Phase 78), upstream issue tracking at https://github.com/warpdotdev/warp issues #7326 ACP and #9233 May-Jun 2026 roadmap (Phase 96). No source-file mutations; git diff confined to .planning/milestones/v2.2/. Previous roadmap v1.6-v2.1 SHIPPED 2026-04-29 ƒ?" see previous_roadmap block."
progress:
  v3_5:
    total_phases: 7
    completed_phases: 3
    completed_plans: 3
    percent: 100
    phase_145: "PASS-WITH-DEFERRED-4 ƒo" 2026-08-06 @ c1596f7 (Codex Profile Control; verifier GAP-1 + phase-ATC CRIT-1 both fixed+regression-guarded; MUDA mechanical PASS 0/0; deferred A/B/C + DEVIATION-1)"
    phase_146: "PASS-WITH-DEFERRED-3 ƒo" 2026-08-07 @ a36e1ea (Session Governance Hooks; 7 tasks; 11 CRIT found+closed across per-dispatch/verify/phase-ATC incl. 5x writer-accepts-destination and 7x silent-success; phase-ATC re-review 4/4 CLOSED ƒ?" containment now ONE contract via resolveContainedPath; MUDA 0/0; hooks LIVE in repo; deferred F/G + DEVIATION-W)"
    phase_147: "PASS ƒo" 2026-08-07 (Commit-Seam Gate; 5 tasks + 3 fix rounds; 21/21 real-git scenarios; earned-block falsifier proven both directions incl. convention_unknown + per-repo floors; tamper-evident activation; cross-worktree misattribution CRIT closed at re-review 0/0; MUDA 0/0; DEFERRED-F absorbed at commit seam; hooks live on devcp via source-checkout pattern, warn rows accumulating)"
    phase_148: "PASS ƒo" 2026-08-08 @ 768c6a0 (Cross-Model Triage; staged MCP transport end-to-end after 3-dispatch ATC-fix chain ƒ?" runtime decides, Claude transports; 36/36 scenarios; spec 6/6; phase-ATC re-review 10/10; MUDA 0/0 prior + degraded re-run logged; seam anti-pattern curated after 4th instance)"
    phase_149: "PASS ƒo" 2026-08-08 (Skill-Routing Table; 24-route registry + loader 18/18 + classifier AC-149b + phase-close consult AC-149c with derive-dont-default gate inputs, forged-gate rejection, executable dispatches; 3 verifier rounds + phase-ATC FAIL-GATE all closed, re-review 8/8; MUDA 0/0 mech + qualitative degraded; A1 pre-existing documented)"
    phase_150: "PASS-WITH-DEFERRED-1 ƒo" 2026-08-10 @ c0aff22+ (Propagation+Trust+Runbook; T150-01..04 built 72/0/1 battery; T150-05 PUBLISHED origin 7fb47eb->c0aff22 + local install under operator auth; T150-06 trust guard proven 3 ways; T150-07 devcp DEFERRED ƒ?" live sessions; 4 review rounds/13 CRIT closed; PII 0 tracked; .gitattributes eol pins)"
  v3_0:
    total_phases: 7
    completed_phases: 7
    completed_plans: 7
    percent: 100
    phase_106: "PASS ƒo" 2026-05-20 @ 390ef1a (Mesh CMB Schema; DLB-08.1; 14/14)"
    phase_107: "PASS ƒo" 2026-05-20 @ c45c24c (cmb-validate + cmb-hash + writers; DLB-08.2+.3; 20/20)"
    phase_108: "PASS ƒo" 2026-05-20 @ cf03b53 (lineage + evidence-validator + echo-detector + sgsd-audit wire-in; DLB-08.4+.5; 49/49)"
    phase_109: "PASS ƒo" 2026-05-20 (escalation_gate + pseudo_operator_peer; DLB-08.6+.7; 102/102; Fixture D PROVED; DLB-08 LAYER COMPLETE)"
    phase_110: "PASS ƒo" 2026-05-20 (Codex Pro Mode profile-resolver + stoplight + native-review-runner; DLB-09.1; 15/15)"
    phase_111: "PASS ƒo" 2026-05-20 (PLAN-LOCKED schema + validator + .codex/hooks.json + 5 hooks; DLB-09.2; 15/15)"
    phase_112: "PASS ƒo" 2026-05-21 (Context Authority capsule ƒ?" 6 templates + writer + composer + v3.0 dogfood instances; DLB-10.1; 17/17; FINAL v3.0 phase)"
  v2_9:
    total_phases: 9
    completed_phases: 9
    completed_plans: 9
    percent: 100
    phase_97_5: "PASS ƒo" 2026-05-18 @ 6e66ad0 (Semantic Verification Gate; DLB-07 + plan-schema-v2 enforces semantic_acceptance_criteria via SCHEMA-09/-10; 5/5 fixture tests green; 97.5-BACKFILL.md surfaces 18 plans needing backfill or skip_gates)"
    phase_98: "PASS ƒo" @ a4f8539 (Harness Component Substrate; 35-row registry across 14 frozen classes incl. 5 protected; Lock-13 catalog.cjs; 21/21 self-test)"
    phase_99: "PASS ƒo" @ 6f7a478 (Trajectory Evidence Corpus; distill.cjs 7 JSONL surfaces ƒÅ' OVERVIEW ƒ%Ï4KB + INDEX; 11 frozen root-cause labels; 18/18 self-test)"
    phase_100: "PASS ƒo" @ eba47ba (Change Manifest Prediction Ledger; MANIFEST.schema.json 14 required fields incl. predicted_fixes ƒ%¾1 + predicted_regressions; append-only JSONL; 21/21 self-test)"
    phase_101: "PASS ƒo" @ d1066a4 (Attribution And Rollback Gate; attribute.cjs 6-verdict closed vocab; fix + regression metrics independent; structured rollback recommendation; v2.9 close-gate added; 18/18 self-test)"
    phase_102: "PASS ƒo" @ 827d9bc (Harness Evolution Runner; run.cjs 4 modes dry-run/proposal/apply/attribute; protected-oracle boundary; 17/17 self-test)"
    phase_103: "PASS ƒo" @ 5122d95 (Component Ablation And Interference; ablate.cjs tmpdir isolation; 3 frozen interference rules duplicate/redundant/inversion; requires_transfer_eval=true; 18/18 self-test)"
    phase_104: "PASS ƒo" @ f6d3073 (Transfer And OOD Benchmark; evaluate.cjs frozen-before-run rule; 3 critical-regression rules; 8 transfer axes; 18/18 self-test)"
    phase_105: "PASS-WITH-DEFERRED-2 ƒo" @ 8fb3b09 (Release Gate And Cockpit Integration; v2.9 close gate extended with AHE-EVAL-03/05; SUMMARY.md + SGSD-HARNESS-EVOLUTION.md ship; DEFERRED-1 warp-mcp 15th tool / DEFERRED-2 cockpit-state 12th section ƒ?" both lock-13 frozen-array updates)"
  v2_8:
    total_phases: 4
    completed_phases: 4
    completed_plans: 4
    percent: 100
    phase_94: "PASS ƒo" 2026-04-29 @ 649898d (ACP Mapping Spec; 7 concepts + 11-row event mapping)"
    phase_95: "SKIPPED-WAITING-FOR-UPSTREAM ƒo" 2026-04-29 @ 9bbcdf8 (ACP Adapter Spike; Warp #7326 open)"
    phase_96: "PASS ƒo" 2026-04-29 @ cfff32a (Warp Upstream Pack; telemetry-panel target picked 19/20; draft-only)"
    phase_97: "PASS ƒo" 2026-04-29 @ 2466ff1 (Release Gate; 149/149 self-tests; 22/25 readiness; SUMMARY.md ships v2.2-v2.8 retrospective)"
  v2_6:
    total_phases: 5
    completed_phases: 3
    completed_plans: 3
    percent: 40
    phase_84: "1/1 plan complete ƒ?" PASS ƒo" 2026-04-29 @ 2e8ce85 (Code Review Integration Guide + SGSD: Open Review Artifacts workflow; 2-layer review model documented; 15/15 workflow lint)"
    phase_85: "1/1 plan complete ƒ?" PASS-WITH-DEFERRED-3 ƒo" 2026-04-29 @ 8bad3ad+347c56a (Recovery Packet Upgrade; 1818 bytes ƒ%Ï4KB; why_stopped + artifact_links + roadmap-complete branch; 44/44 self-test; DEFERRED-1 STATE.md staleness contagion + DEFERRED-2 Codex unavailable Phase 84/85 + DEFERRED-3 context-packet-log.jsonl 24h+ stale ƒ?" Phase 86 must address)"
    phase_86: "PAUSED on operator override ƒ?" Token Control + Staleness Reconciliation. 7-point list (token-control repair / cockpit + recovery staleness probes / token-waste+context-packet wire-in / 200k+500k context warnings / fresh-session resume packets / context-bench full-mode rerun or unproven mark / v2.6 debt record) + 3 Phase-85 deferrals. Originally 'Remote Monitor Packet' but most of that work shipped via Phase 64 workflow + Phase 79 skill"
    phase_87: "PENDING ƒ?" Watchdog And Attention Alerts (originally; may re-scope after Phase 86)"
    phase_88: "PENDING ƒ?" End-To-End Warp Operator Drill"
  v2_5:
    total_phases: 5
    completed_phases: 5
    completed_plans: 5
    percent: 100
    phase_79: "PASS ƒo" 2026-04-29 @ 5a74bda (7 SGSD Warp skills under .agents/skills/; read-only by design)"
    phase_80: "PASS ƒo" 2026-04-29 @ 8eb7de8+e69271e (Warp Plan converter; 4 public APIs Lock-13; 17/17 self-test; READ-ONLY on STATE.md verified mechanically; 9 phase files generated under .planning/analyses/ live test)"
    phase_81: "PASS ƒo" 2026-04-29 @ 7256a76 (SGSD Warp Operator Notebook; 10 runnable PowerShell blocks)"
    phase_82: "PASS ƒo" 2026-04-29 @ 350e101 (7 Warp Agent prompts; mode declared per prompt; none auto-modify)"
    phase_83: "PASS ƒo" 2026-04-29 @ 19e544e (asset cross-index; 47 paths cited 0 missing; validator 5/5 self-test)"
  v2_4:
    total_phases: 6
    completed_phases: 6
    completed_plans: 6
    percent: 100
    phase_73: "PASS ƒo" 2026-04-29 @ 6021fbb (12 operator questions mapped to MCP tools; 16 event types frozen for Phase 74)"
    phase_74: "PASS ƒo" 2026-04-29 @ ad5948d (ORCHESTRATOR-LIVE.jsonl contract + writer helper; 9/9 self-test; Lock-13)"
    phase_75: "PASS ƒo" 2026-04-29 @ 72e0d6b+5914be6 (writer integration; --emit CLI + READ-ONLY reader 12/12 self-test + SKILL.md wire-in section)"
    phase_76: "PASS ƒo" 2026-04-29 @ 6ba04f8+22aedd5 (cockpit-state adapter; 10-section snapshot; 4 fixtures; MCP tool 12 unification; warp-mcp 42/42 regression PASS)"
    phase_77: "PASS ƒo" 2026-04-29 @ a6b83c8 (cockpit render helper; PSParser 0 errors; existing 3 cockpit panes UNTOUCHED ƒ?" operator parallel work preserved)"
    phase_78: "PASS ƒo" 2026-04-29 @ bd54eb3 (Warp launch config templates ƒ?" operator-workspace + cockpit-only + README; M4 caveat documented)"
  v2_3:
    total_phases: 5
    completed_phases: 5
    completed_plans: 5
    percent: 100
    phase_68: "PASS ƒo" 2026-04-29 @ 31907c2 (SGSD MCP read-only contract; 14 tools; ERROR_CODES len=11; REDACTION_CATEGORIES len=7)"
    phase_69: "PASS ƒo" 2026-04-29 @ 0211b0c+dcd039b (MCP server skeleton; JSON-RPC 2.0 stdio; 14 tool stubs; 15/15 self-test)"
    phase_70: "PASS ƒo" 2026-04-29 @ 0905cbf+ebfaf7c (5 core status tools ƒ?" current_state/current_phase/milestone_status/watchdog/recovery_packet; 21/21 self-test; 10 fixture pairs)"
    phase_71: "PASS ƒo" 2026-04-29 @ 11bb6bb+2ab84d7 (9 operational tools ƒ?" gate/agent/codex/token/context-bench/commits/cockpit-snapshot/artifact-links/warp-doctor; 30/30 self-test; 28 fixture pairs; live hash-match against git log -1)"
    phase_72: "PASS ƒo" 2026-04-29 @ 6f50232+1baf708 (MCP redaction 7 categories wired into all 14 tools; ERROR_CODES extended len=13; warp-doctor probe 15 upgraded; SGSD-WARP-MCP-SETUP.md; sgsd-mcp-self-test workflow)"
  v2_2:
    total_phases: 5
    completed_phases: 5
    completed_plans: 5
    percent: 100
    phase_63: "1/1 plan complete ƒ?" PASS-WITH-DEFERRED-5 ƒo" 2026-04-29 @ b5b46a8 (Warp Capability Smoke Test; 5 deferred rows are operator UI manual checks M1-M5 tracked in .planning/milestones/v2.2/MANUAL-CHECKS.md, NOT edge_guard_miss and NOT in CRIT-BACKLOG; 7 artifacts: WARP-SMOKE.md + MANUAL-CHECKS.md at milestone root, CONTEXT/PLAN/RESEARCH/VERIFICATION/ATC-REVIEW under phases/63-warp-capability-smoke/; sg-launched-Claude topology proven empirically ƒ?" this Claude session is the in-process witness)"
    phase_64: "1/1 plan complete ƒ?" PASS ƒo" 2026-04-29 @ 5ae2ba0 (Workflow Pack Completion; 8 new yamls + 1 fix sgsd-token-current; lint tool warp-workflow-lint/lint.cjs READ-ONLY ASCII-only 7/7 self-test PASS; live --run 13/13 valid + 10/10 search terms exit 0; SGSD-WARP-WORKFLOWS.md docs index 13-row table + 3 routines; orchestrator-author DEVIATION cumulative 3rd; 'partially blocked on M1' relabeled per operator Rule 15 ƒ?" workflow YAMLs ship correctly regardless of UI verification)"
    phase_65: "1/1 plan complete ƒ?" PASS ƒo" 2026-04-29 @ c0201af (Agent Rules Context Pack; AGENTS.md NEW 46 lines / 2972 bytes / ratio 0.290 of CLAUDE.md under 30% target; WARP.md additive +21 lines Rule Hierarchy section; 5 hard rules established: read-state-from-.planning / don't-duplicate-gates / VTP-optional / preserve-sg-topology / no-source-mutations-without-plan; orchestrator-author DEVIATION 1st; compactness 2-pass)"
    phase_66: "1/1 plan complete ƒ?" PASS ƒo" 2026-04-29 @ 3b2186f (SGSD Warp Operator Guide; super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md ~280 lines covering 12 roadmap-required sections + TL;DR routine + 14 concrete Windows paths + 6/6 cross-phase references verified; orchestrator-author DEVIATION 4th; 'partially blocked on M1' relabeled per Rule 15)"
    phase_67: "1/1 plan complete ƒ?" PASS ƒo" 2026-04-29 @ 018028e (Warp Doctor Probe Design; super-gsd/tools/warp-doctor/check.cjs 16 probes + 4 public APIs Lock-13-wrapped + 15/15 self-test PASS; READ-ONLY invariant verified mechanically via git status before/after live --run; ASCII-only; mirrors Phase 62 upgrade-drift pattern; orchestrator-author DEVIATION 2nd; live --run on this checkout: 13 PASS / 1 MISSING [.warpindexingignore confirms Phase 63 finding E.1] / 1 MANUAL-CHECK / 1 NOT-APPLICABLE / 0 DEGRADED exit 1)"
  v1_7:
    total_phases: 5
    completed_phases: 5
    completed_plans: 5
    percent: 100
    phase_31: "1/1 plan complete ƒ?" PASS ƒo" 2026-04-27 (CRIT+WARN fixed in-loop, anti-slop 10/10)"
    phase_32: "1/1 plan complete ƒ?" PASS ƒo" 2026-04-27 (2 CRIT + 5 WARN fixed in-loop; 1 deferred design-locked; combined anti-slop 9.5/10)"
    phase_33: "1/1 plan complete ƒ?" PASS ƒo" 2026-04-27 (2 CRIT + 5 WARN fixed in-loop; 8 new bypass patterns; 0 regressions; combined anti-slop ~9.5/10)"
    phase_34: "1/1 plan complete ƒ?" PASS ƒo" 2026-04-27 (2 CRIT + 5 WARN fixed in-loop; v1.5 empty-baseline gap closed; combined anti-slop ~9.5/10)"
    phase_35: "1/1 plan complete ƒ?" PASS ƒo" 2026-04-27 (0 CRIT + 7 WARN; 5 in-loop, 1 info, 1 out-of-scope; deterministic catalog generator; combined anti-slop ~9.5/10)"
  v1_6_summary:
    total_phases: 5
    completed_phases: 5
    percent: 100
    phase_26: "PASS ƒo" 2026-04-26"
    phase_27: "PASS ƒo" 2026-04-26"
    phase_28: "PASS-WITH-DEFERRED-5 ƒo" 2026-04-26"
    phase_29: "PASS-WITH-DEFERRED-3 ƒo" 2026-04-27"
    phase_30: "PASS-WITH-DEFERRED-2 ƒo" 2026-04-27"
backlog:
  total_unresolved: 10
  by_kind:
    verifier_fail: 0
    phase_atc: 10
    edge_guard_miss: 0
  by_phase:
    "26": 0
    "27": 0
    "28": 5
    "29": 3
    "30": 2
    "31": 0
    "32": 0
    "33": 0
    "34": 0
    "35": 0
  cleared_post_rerun: 8
v1_6_complete:
  shipped: 2026-04-27
  status: SHIPPED-WITH-DEBT-10
  initial_backlog: 18
  cleared_post_rerun: 8
  remaining_unresolved: 10
  phases: 5
  plans: 8
v1_7_complete:
  shipped: 2026-04-27
  status: SHIPPED
  initial_backlog: 0
  cleared_in_loop: 16
  remaining_unresolved: 0
  phases: 5
  plans: 5
  combined_anti_slop_estimated: "~9.5/10"
  controlling_principle_held: "Autonomy continues; evidence tells the truth"
  v1_5_empty_baseline_gap: "CLOSED at Phase 34"
  summary: .planning/milestones/v1.7/SUMMARY.md
v1_8_complete:
  shipped: 2026-04-27
  status: SHIPPED
  initial_backlog: 0
  cleared_in_loop: 22
  accepted: 2
  false_alarm: 1
  remaining_unresolved: 0
  phases: 5
  plans: 5
  combined_anti_slop_estimated: "~9/10"
  controlling_principle_held: "Autonomy continues; evidence tells the truth"
  summary: .planning/milestones/v1.8/SUMMARY.md
  generated_artifacts:
    - .planning/milestones/v1.8/gate-keep-kill.md (Phase 39 rubric)
    - .planning/milestones/v1.8/phase-folder-audit.md (Phase 40 audit)
checkpoint: .planning/ORCHESTRATOR-CHECKPOINT.md (no checkpoint open; Phase 63 closed PASS-WITH-DEFERRED-5)
previous_roadmap:
  scope: v1.6 ƒÅ' v2.1 (phases 26-62)
  status: ROADMAP COMPLETE 2026-04-29
  shipped_milestones: "v1.6 SHIPPED-WITH-DEBT-10 @ d510e32, v1.7 SHIPPED @ 5690c38, v1.8 SHIPPED, v1.9 SHIPPED, v2.0 SHIPPED (release-readiness 97 GREEN), v2.1 SHIPPED (final milestone of prior roadmap)"
  controlling_contract: .planning/ROADMAP-AGENT.md
  locked_decisions: .planning/discussions/2026-04-26-mass-discuss.md
  total_phases_shipped: 30
  total_milestones_shipped: 6
  started: 2026-04-26
  completed: 2026-04-29
  history_blocks: "Per-phase history retained inline below in roadmap_run sub-blocks (v2_1_progress / v2_0_progress / v2_0_complete / v2_1_complete / v1_9_progress / v1_9_open_debt / v1_9_supersedes_archive / v1_9_milestone_codename / v1_9_vtp_delta_active / v1_8_progress / milestones_shipped). Top-level v1_6_complete / v1_7_complete / v1_8_complete blocks above are also history. progress.v1_7 and progress.v1_6_summary above hold per-phase status snapshots. backlog block above holds residual v1.6 phase_atc=10 unresolved (cockpit may continue to display this; it is historical debt, not active blocker for v2.2)."
  notes: "Active roadmap (v2.2-v2.8 SGSD Warp Integration) operates against .planning/milestones/warp-integration/ROADMAP.md per .planning/milestones/warp-integration/CLAUDE-HANDOVER.md."
roadmap_run:
  mode: operator-led (Phase 63 closed; awaiting operator instruction or M1-M5 manual-check completion before next dispatch)
  scope: v2.2 ƒÅ' v2.8 (SGSD Warp Integration; phases 63-97; Phase 63 closed; Phases 64-67 ready to dispatch)
  controlling_contract: .planning/milestones/warp-integration/ROADMAP.md
  controlling_handover: .planning/milestones/warp-integration/CLAUDE-HANDOVER.md
  locked_decisions: "Phase 63 D63.1-D63.5 in 63-CONTEXT.md; no roadmap-wide DISCUSS file authored (per-phase decisions go in each {NN}-CONTEXT.md per the lighter-weight per-phase contract used in v2.2-v2.8)"
  backlog_canonical: .planning/metrics/crit-backlog.jsonl (carries v1.6-v2.1 history; v2.2 has zero rows so far)
  started: 2026-04-29
  current_milestone: v2.2
  current_phase: complete
  current_phase_name: "v2.2 ALL-PHASES-CLOSED ƒ?" 5/5 phases done (63 PASS-WITH-DEFERRED-5 + 64 PASS + 65 PASS + 66 PASS + 67 PASS); awaiting operator decision on M1-M5 + sgsd-complete-milestone trigger"
  current_phase_status: ALL-PHASES-CLOSED
  current_phase_close_commit: 3b2186f
  v2_2_phase_close_commits:
    phase_63: b5b46a8
    phase_64: 5ae2ba0
    phase_65: c0201af
    phase_66: 3b2186f
    phase_67: 018028e
  next_dispatch_candidates:
    - "M1-M5 operator UI manual checks (.planning/milestones/v2.2/MANUAL-CHECKS.md + .planning/todos/pending/2026-04-29-warp-m{1,2,3,4,5}-*.md) ƒ?" operator-only, blocks v2.2 SHIPPED-clean status"
    - "sgsd-complete-milestone v2.2 (option a: trigger now for SHIPPED-WITH-DEFERRED-5 ƒ?" M1-M5 still pending; option b: do M1-M5 first then trigger for SHIPPED clean)"
    - "v2.3 Phase 68 ƒ?" SGSD MCP Contract (the central unlock per operator brief; UNBLOCKED ƒ?" does not depend on M1-M5)"
    - "Operator review: 4-deviation orchestrator-authoring count this auto-run; rebalance dispatch policy for v2.3 MCP work (substantial code, ~600 lines, clearly warrants Sonnet dispatch)"
  prior_roadmap_run_completed: 2026-04-29 (v1.6 ƒÅ' v2.1; see top-level previous_roadmap block above)
  prior_milestone_shipped: v2.1 SHIPPED 2026-04-29 (FINAL milestone of prior roadmap; was v2.0 SHIPPED 2026-04-29)
  v2_1_progress:
    phase_62: "PASS @ b3dcadf+3612c27 (9/9 verifier must-haves, v2.1 fifth-gate green (upgrade-drift check; 12/12 self-test PASS + 11 probes >= 8 floor + read_only_invariant assertion PASS + git status before/after --run identical), 4 public APIs Lock-13 wrapped (runDrift/getProbe/selfTest + _internals), 11 frozen PROBE_NAMES (>=8; schema_version_2_plans/agent_token_spend_ledger/context_packet_tree/sqlite_context_index_tree/dispatch_router_tree/memory_governance_tree/redis_adapter_present/failure_injection_tree/release_readiness_present/installer_audit_tree/new_project_wizard_present) + frozen VERSION_TAGS len=4 (v1.2/v1.9/v2.0/v2.1) + frozen REASON_NOTES len=8 closed-vocab + frozen MIGRATION_NOTES 7 milestone keys (v1.5_baseline/v1.6_cockpit/v1.7_command_contracts/v1.8_gate_fitness/v1.9_research/v2_0_failure_injection/v2_1_distribution) + SCHEMA_VERSION=1, candidate-paths array per probe (FIRST present wins; deterministic missing fallback to last candidate's reason), live --run reports 11/11 PRESENT in this checkout (v1.2:1+v1.9:6+v2.0:2+v2.1:2; sqlite_context_index_tree resolves to context-cache fallback), READ-ONLY invariant A8 enforces zero fs.writeFileSync/appendFileSync/unlinkSync/mkdirSync/rmSync/rmdirSync in code-only scan (hasWrite=false), operationally verified git status --short before/after --run identical (diff empty), run-self-test.cjs thin spawnSync shell delegates correctly mirroring Phase 58/59 convention, sgsd-complete-milestone.cjs surgical fifth-gate extension (+141 insertions 0 deletions) preserves v1.9 dual-gate + v2.0 sept-gate + Phase 58/59/60/61 v2.1 first/second/third/fourth-gate paths byte-equality up to insertion point at line 597 (post-fourth-gate green stdout, pre-existing process.exit(0)), 5 stderr tags closed-vocab (upgrade_drift_unavailable/upgrade_drift_self_test_threw/upgrade_drift_self_test_failed/upgrade_drift_read_only_invariant_failed/upgrade_drift_probe_count_below_floor), Lock 4 verified Phase 41-61 byte-untouched (zero require of upstream Phase 41-61 modules; check.cjs uses fs.existsSync + fs.statSync only), Lock 11 closed-vocab indexOf membership on PROBE_NAMES + VERSION_TAGS + REASON_NOTES + 'read_only_invariant' assertion name (no regex/fuzzy), Lock 13 try/catch wraps every probe + every public API + bad-input probes (selfTest A3/A4 verify; bad name + non-string both return degraded sentinel without throwing), ASCII-only first_nonascii_idx=-1 across all 4 changed files (check.cjs + run-self-test.cjs + UPGRADE-DRIFT.md + sgsd-complete-milestone.cjs post-insert), UPGRADE-DRIFT.md ships probe table + per-milestone deltas + 6-step migration recipe + CLI usage, --milestone v1.9 + --milestone v2.0 + --milestone v2.1 all exit 0 verified (no regression on prior gates), Plan validates VALID load-mode against plan-schema-v2.json, MUDA waste audit GREEN 0/7 categories triggered, FINAL gate of v1.6->v2.1 roadmap; once exits 0 the entire roadmap is complete, 2 atomic commits b3dcadf(check.cjs+UPGRADE-DRIFT.md+run-self-test.cjs)+3612c27(fifth-gate wire) + close commit pending)"
    phase_61: "PASS @ f776c54+c93c8fe (9/9 verifier must-haves, v2.1 fourth-gate green (docs-refresh check; closed-vocab grep on README.md vtp_required_count=0 vtp_any_count=3 vtp_total=3 all marked optional with Phase 48 selective-VTP-bridge + Phase 52 redis-adapter rationale anchors), README surgical extension +78/-1 (1 deletion is em-dash to '--' swap on a NEW line I authored; pre-existing baseline em-dashes on lines 22-352 byte-untouched per Lock 4) ships preamble 'What This Repo Is For' (operator-build vs end-user-install explicit two-bullet block + cross-link routing), Quick Start step 5 with sg/sgsd shortcut block + Install-SgsdShortcut.ps1 + sgsd-boot.sh --skip-preflight bash fallback (live-tested exit 0 raw stdout captured 61-VERIFICATION.md), SGSD3 cockpit panel callout marks VTP/MCP projection optional with empty-state sentinel + Lock 13 graceful degrade, new Optional Add-Ons section ships VTP/MCP bridge + Redis live cache + Codex panel all marked optional with default-without paths (ByteRover local; in-memory context-bench Phase 51; dashboard renders without Codex), new Operator Build Workflow section inlines milestone-close gates v1.9/v2.0/v2.1 + example fixture exercise + installer-audit selfTest + wizard selfTest, sgsd-complete-milestone.cjs surgical fourth-gate extension (+99 insertions 0 deletions; in-proc fs.readFileSync + line-by-line regex /vtp[^\\n]*(required|must)/i; portable across PowerShell/cmd.exe/bash without depending on platform grep semantics), Lock 4 Phase 41-60 + sgsd-cockpit-shell.cjs git-diff-quiet (bytes 1-478 of post-Phase-60 milestone script byte-equality preserved), Lock 11 closed-vocab regex on 'required'/'must' no fuzzy matching, Lock 13 README-missing path emits SKIPPED sentinel + green-with-skip exit 0 (statically verified lines 499-516 post-insertion), ASCII-only first_nonascii_idx=-1 across milestone script + 5 phase artifacts (61-RESEARCH/61-01-PLAN/61-VERIFICATION/WASTE/commit-reviews.jsonl), 2 stderr tags closed-vocab (docs_refresh_self_test_failed:docs_refresh_readme_read_failed/docs_refresh_grep_threw + 1 success-path warning docs_refresh_vtp_required_present), --milestone v1.9 + --milestone v2.0 + --milestone v2.1 all exit 0 verified (no regression on prior gates), Plan validates VALID load-mode against plan-schema-v2.json, MUDA waste audit GREEN 0/7 categories triggered, sg quick-start command block tested live (sgsd-boot.sh --skip-preflight exit 0; SGSD1/SGSD2/SGSD3 launch lines printed), 2 atomic commits f776c54(README)+c93c8fe(fourth-gate) + close commit pending)"
    phase_60: "PASS @ 8e6c0e9+ef1fb50+cea47bb+49dd449 (11/11 verifier must-haves, v2.1 third-gate green (example-walkthrough self-test against examples/hello-world fixture; wizard --defaults exit 0 + idempotent + sha256 fe16729a... canonical match; observation-only fixture restore), 3-file fixture scaffold (PROJECT.md 78L + ROADMAP.md 60L + .planning/STATE.md 33L), EXAMPLE-DEMO-WALKTHROUGH.md 250L 11 documented steps each tested end-to-end (exit 0 expected output match), sgsd-complete-milestone.cjs surgical third-gate extension (+179 insertions 0 deletions) preserves v1.9/v2.0/v2.1 first+second-gate paths byte-equality up to insertion point, Lock 4/11/13 + ASCII-only verified, --milestone v1.9 + v2.0 + v2.1 all exit 0 (no regression))"
    phase_59: "PASS @ b61a7f4+dbf6de2+86cf0b8+39f0df6 (12/12 verifier must-haves, 13/13 self-test PASS green sub-1s, v2.1 second-gate green (new-project-wizard selfTest deep-merge non-clobber + idempotent + Lock 13), 5 public APIs Lock-13 wrapped (runWizard/deepMergeConfig/validateProjectConfig/selfTest + _internals), 7 frozen PANEL_KINDS mirror Phase 50 cockpit-shell.cjs:47-55 byte-equality (token/source_mix/active_agent/codex/intent/governance/budget) + frozen BOOT_MODES len=3 (auto/manual/observe) + frozen VALIDATION_CODES len=7 closed-vocab + SCHEMA_VERSION=1, deterministic key-sort serializer + trailing newline normalization gives idempotent re-run sha256 match (fe16729a... pre/post 2nd run; idempotent_skip=true; written=false), non-clobber on existing config preserves all custom keys (workflow.custom_user_field/workflow.auto_advance=false/workflow.mode=yolo/model_routing.* all preserved with clobbered_keys=[]), --defaults flag writes project block (cockpit_panel_kinds + default_boot_mode=auto + operator_preferences) without prompts, sgsd-new-project-wizard-self-test.cjs thin spawnSync shell delegates correctly mirroring Phase 58 run-self-test.cjs convention, sgsd-configure.ps1 surgical extension (+25 lines 0 deletions) adds scope-boundary comment near top + post-write discoverability hook at end PRESERVING knowledge-block logic lines 20-183 byte-equality (suggestion-only never auto-spawn), sgsd-complete-milestone.cjs surgical second-gate extension (+58 insertions 0 deletions) preserves v1.9 dual-gate + v2.0 sept-gate + v2.1 first-gate (Phase 58) paths byte-equality up to insertion point inside milestone==='v2.1' block between first-gate green message and process.exit(0), 3 stderr tags closed-vocab (wizard_self_test_failed:wizard_spawn_failed/wizard_self_test_threw/wizard_self_test_exit_nonzero), Lock 4 verified Phase 41-58 trees + sgsd-cockpit-shell.cjs git-diff-quiet (PANEL_KINDS mirrored never imported), Lock 11 byte-equality on existing keys (deep-merge strictly additive; existing wins on scalar/array conflict; clobbered_keys===[] always), Lock 13 try/catch wraps every public API + 3 verified degraded sentinel paths (missing project dir exit_code=2 / missing required arg exit_code=1 / non-object existing reason=existing_not_object), ASCII-only first_nonascii_idx=-1 across all 4 changed files (selfTest A11 enforces wizard.cjs; node inline loop verifies .ps1 + complete-milestone.cjs + self-test runner), 13 self-test assertions PASS (panel_kinds_frozen_7/boot_modes_frozen_3/deep_merge_non_clobber/deep_merge_idempotent/serialize_stable_idempotent/run_wizard_missing_dir_degraded/run_wizard_missing_arg_degraded/deep_merge_non_object_degraded/validate_accepts_complete_block/validate_rejects_bad_boot_mode/validate_rejects_missing_block/ascii_only_source/validation_codes_frozen_vocab), MUDA waste audit GREEN 0/7 categories triggered, --milestone v1.9 + --milestone v2.0 + --milestone v2.1 all exit 0 verified (no regression), Plan validates VALID load-mode against plan-schema-v2.json, 4 atomic commits b61a7f4(wizard)->dbf6de2(configure+self-test runner)->86cf0b8(second-gate)->39f0df6(artifacts) + close commit pending)"
    phase_58: "PASS @ 35c9a56+9291eb5 (10/10 verifier must-haves, 12/12 self-test PASS green sub-1s, v2.1 first-gate green (installer-audit selfTest + runAudit() summary check + mandatory_floor_met=true), 4 public APIs Lock-13 wrapped (runAudit/getProbe/selfTest + _internals), 12 frozen PROBE_NAMES (>=9; node_version/npm/git/bash/powershell/redis_optional/docker_optional/codex_cli_optional/claude_cli_optional/better_sqlite3_optional/planning_dir_present/super_gsd_tree_present) + frozen SOURCE_VALUES len=3 (present/missing/optional) + frozen REASON_NOTES len=8 closed-vocab + frozen MANDATORY_PROBES len=3 (node_version/npm/git) + NODE_FLOOR_MAJOR=20 + SCHEMA_VERSION=1, live --run reports 12 probes (9 present + 0 missing + 3 optional + mandatory_floor_met=true) on workstation, clean-room.sh exits 0 with 9 install-walk steps logged in friction format (6 auto + 3 prompt: byterover/claude/restart) over ~24s wall-clock, mktemp tmpdir + signature-prefix rm-rf safety + EXIT/INT/TERM cleanup trap, READ-ONLY invariant A8 enforces zero fs mutation primitives in code-only scan (hasWrite=false), run-self-test.cjs thin shell delegates correctly via spawnSync, sgsd-complete-milestone.cjs surgical first-gate extension (+101 insertions 0 deletions) preserves v1.9 dual-gate + v2.0 sept-gate paths byte-equality up to existing insertion points, v2.1 close path independent of v2.0 evidence buckets (different scope: distribution+onboarding not failure injection), 3 stderr tags closed-vocab (installer_audit_unavailable/installer_audit_self_test_failed/installer_audit_mandatory_floor_unmet), Lock 4 verified Phase 41-57 trees git-diff-quiet (audit.cjs + clean-room.sh + run-self-test.cjs + sgsd-complete-milestone.cjs are the only Phase-58 changes), Lock 11 byte-equality on closed-vocab SOURCE_VALUES + REASON_NOTES no regex/fuzzy, Lock 13 try/catch wraps every probe + public API + bad-input probes (selfTest A3/A4 verify), ASCII-only first_nonascii_idx=-1 across all 4 changed files, INSTALLER-AUDIT.md ships probe table + clean-room friction log + Phase 59 wizard recommendations, ROADMAP-AGENT AUDIT WARNING honored (read-only fingerprint not second startup system), Plan validates VALID load-mode against plan-schema-v2.json, v1.9 dual-gate + v2.0 sept-gate green no regression)"
  v2_0_progress:
    phase_53: "PASS @ 5680d14 (10/10 verifier must-haves, 24/24 self-test, 10/10 run-all in 5.4s, v2.0 triple-gate green 33+26+24+10, F1-F16 frozen byte-untouched, Lock 4/11/13 + Pitfalls 1/2/4/10 verified)"
    phase_54: "PASS @ f80a17f (10/10 verifier must-haves, 18/18 self-test PASS green sub-30s, 5/5 run-all PASS chaos_pass, v2.0 quad-gate green 33+26+24+10+18, real subprocess kill via spawnSync timeout=200ms SIGTERM observed across all 5 kill points mid-research/mid-plan/mid-execute/mid-verify/mid-close, manifest validator 6/6 missing-field cases rejected next_unit/controlling_principle/mode/emergency_halt/session/created + 1/1 manifest_valid happy path, 11-stream PHASE_54_GUARDED_STREAMS fingerprint byte-equal pre/post run-all, KILL_POINTS frozen 5-entry ordered + FAIL_INJ_REASON_CODES frozen 14-entry (>=11) + REQUIRED_FIELDS frozen 6-entry ordered, 8 public APIs Lock-13 wrapped (runAll/runChaosScenario/validateManifest/selfTest/aggregateResults/appendLogRow + dual-exposed _internals), Lock 4 verified Phase 41-53 trees + cockpit-shell git-diff-quiet, Lock 11 byte-equality on closed-vocab no regex/fuzzy, Lock 13 never throws upward, ASCII-only across all 4 changed files, envelope-v1 row in chaos-restart-log.jsonl, sgsd-complete-milestone.cjs surgical extension preserves v1.9 dual-gate + Phase 53 triple-gate path byte-equality up to insertion point, MUDA waste audit 0 WARN 0 FAIL exit 0, Plan validates VALID load-mode against plan-schema-v2.json)"
    phase_55: "PASS @ a0eb0cc (8/8 verifier must-haves, 12/12 self-test PASS green sub-5s, v2.0 quint-gate green 33+26+24+10+18+12=123 assertions across 6 spawns, 6 public APIs Lock-13 wrapped (getCircuitState/recordProviderResult/shouldFallback/resetCircuit/getDefaultFallback/selfTest), N=3 consecutive-failure threshold env-overridable via SGSD_CIRCUIT_FAILURE_THRESHOLD, single-success reset rule encoded as A2, atomic tmp+rename writes verified A5, missing-state-file degrades to ok-sentinel A4, per-milestone isolation A9, byte-equality DEFAULT_FALLBACK codex->claude case-sensitive A8, end-to-end open-circuit fixture + bash codex-exec.sh --milestone v2.0 exits 7 (caller routes to Claude), --milestone none baseline path codex runs normally exit 0, schema_version 1 persisted, Lock 4 verified Phase 41-54 byte-untouched except 2 surgical extensions (codex-exec.sh + sgsd-complete-milestone.cjs preserved up to insertion points), Lock 11 byte-equality no fuzzy match, Lock 13 never throws upward + bash probe failures degrade to no-fallback, ASCII-only A7 first_nonascii_idx=-1, MUDA waste audit 5 probes PASS exit 0, Plan validates VALID load-mode against plan-schema-v2.json, sgsd-complete-milestone surgical extension preserves v1.9 dual-gate + Phase 53 triple-gate + Phase 54 quad-gate paths byte-equality up to insertion point, 4 atomic commits 9f99e02->cdc0a30->a0eb0cc + final close commit pending)"
    phase_56: "PASS @ 5be6409 (7/7 verifier must-haves, 21/21 self-test PASS green + 10/10 --run-all PASS sub-90s, v2.0 sext-gate green 33+26+24+10+18+12+21+10=154 assertions across 7 spawns, 8 public APIs Lock-13 wrapped (runAll/runScenario/validateScenarioOutcome/selfTest/aggregateResults/appendLogRow + dual-exposed _internals + 4 frozen surfaces SCENARIOS/REASON_CODES/OUTCOMES/PHASE_56_GUARDED_STREAMS), 10 closed-vocab scenarios (6 happy SH1-SH6 + 4 adversarial SA1-SA4), JSON-Schema draft-07 SCENARIOS.schema.json round-trip valid for all 10 entries, 11-stream PHASE_56_GUARDED_STREAMS canonical fingerprint byte-equal pre/post --run-all (cross_run_drift=0), real spawnSync subprocess boundary across all 10 scenarios, tmpdir container isolation, validateScenarioOutcome oracle byte-equality on OUTCOMES enum, adversarial scenarios PASS when under-test tool REJECTS malformed input, 4 fixture files + 6 README-only fixture dirs, run-self-test.cjs thin shell dual-pass green, sgsd-complete-milestone.cjs surgical extension preserves prior gate paths byte-equality, Lock 4 verified Phase 41-55 trees + sgsd-cockpit-shell.cjs git-diff-quiet, Lock 11 byte-equality + set-membership only, Lock 13 never throws upward across 6 APIs x 7 bad-input probes, ASCII-only first_nonascii_idx=-1, MUDA waste audit 5 probes PASS exit 0, Plan validates VALID, 2 in-loop fixes during build)"
    phase_57: "PASS @ 24ca109+0a8e611 (8/8 verifier must-haves, 15/15 self-test PASS green sub-1s, v2.0 sept-gate green 33+26+24+10+18+8+~21+10+score=97 across 8 spawns, 6 public APIs Lock-13 wrapped (computeScore/getBucketScore/hasEdgeGuardMiss/getColor/selfTest + _internals), 8 frozen BUCKET_NAMES (scenarios/chaos_restart/provider_circuit/scenario_suite/token_governance/memory_governance/routing_quality/lock_invariants) + frozen MAX_POINTS map (15+10+10+15+15+10+10+15=100) + frozen REASON_CODES (10-entry vocab) + frozen COLORS (3-entry GREEN/AMBER/RED), color thresholds GREEN>=70 / AMBER 50-69 / RED<50 + edge_guard_miss override forces RED+score=0+exit=1 mechanically demonstrated by selfTest assertion 5 + standalone --planning-dir <fixture> invocation, live --milestone v2.0 score=97/100 GREEN exit 0, 3 fixture cases (score-70-clean/score-69-amber/score-with-edge-guard-miss), run-self-test.cjs thin shell delegates correctly, sgsd-complete-milestone.cjs surgical sept-gate extension (+112 insertions 0 deletions) preserves v1.9 dual-gate + Phase 53/54/55/56 paths byte-equality up to insertion point + disambiguation via in-proc computeScore() emits precise stderr tag (milestone_close_blocked:edge_guard_miss_present vs milestone_close_blocked:release_score_below_threshold), Lock 4 verified release-readiness/ + sgsd-complete-milestone.cjs are the only Phase-57 changes (1 out-of-scope pre-existing collect.cjs diff logged as deferred D1), Lock 11 byte-equality on verdict/kind closed-vocab no regex/fuzzy, Lock 13 try/catch wraps every public API + bad-input probes, ASCII-only first_nonascii_idx=-1 across all 6 changed files, MUDA waste audit PASS exit 0, Plan validates VALID load-mode against plan-schema-v2.json, v1.9 dual-gate green no regression)"
  v2_0_complete:
    shipped: 2026-04-29
    status: SHIPPED
    initial_backlog: 0
    cleared_in_loop: 6
    accepted: 0
    false_alarm: 0
    remaining_unresolved: 0
    phases: 5
    plans: 5
    sept_gate: green
    release_readiness_score: 97
    release_readiness_color: GREEN
    edge_guard_miss_count: 0
    summary: .planning/milestones/v2.0/SUMMARY.md
    generated_artifacts:
      - .planning/metrics/failure-injection-log.jsonl (Phase 53 - 1500+ envelope-v1 rows)
      - .planning/metrics/chaos-restart-log.jsonl (Phase 54 - aggregate per --run-all)
      - .planning/metrics/provider-circuit.json (Phase 55 - schema_version 1)
      - .planning/metrics/scenario-suite-log.jsonl (Phase 56 - per-scenario envelope-v1)
      - super-gsd/tools/release-readiness/score.cjs (Phase 57 - 8-bucket scorer)
      - super-gsd/tools/release-readiness/run-self-test.cjs (Phase 57 - thin shell)
      - super-gsd/tools/release-readiness/fixtures/score-with-edge-guard-miss/crit-backlog.jsonl (Phase 57 - synthetic)
      - super-gsd/scripts/sgsd-complete-milestone.cjs (Phase 53-57 - sept-gate extension)
  v2_1_complete:
    shipped: 2026-04-29
    status: SHIPPED
    initial_backlog: 0
    cleared_in_loop: 0
    accepted: 0
    false_alarm: 0
    remaining_unresolved: 0
    phases: 5
    plans: 5
    quint_gate: green
    final_milestone_of_roadmap: true
    summary: .planning/milestones/v2.1/SUMMARY.md
    generated_artifacts:
      - super-gsd/tools/installer-audit/audit.cjs (Phase 58 - 12 probes + 4 public APIs)
      - super-gsd/tools/installer-audit/clean-room.sh (Phase 58 - 9-step install walk)
      - super-gsd/tools/installer-audit/run-self-test.cjs (Phase 58 - thin shell)
      - super-gsd/scripts/sgsd-new-project-wizard.cjs (Phase 59 - 5 public APIs + deep-merge non-clobber + idempotent)
      - super-gsd/scripts/sgsd-new-project-wizard-self-test.cjs (Phase 59 - thin spawnSync shell)
      - super-gsd/scripts/sgsd-configure.ps1 (Phase 59 - surgical extension; +25 lines 0 deletions)
      - examples/hello-world/PROJECT.md (Phase 60 - 78L)
      - examples/hello-world/ROADMAP.md (Phase 60 - 60L)
      - examples/hello-world/.planning/STATE.md (Phase 60 - 33L skeleton)
      - super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md (Phase 60 - 250L; 11 documented steps)
      - README.md (Phase 61 - +78/-1 surgical extension)
      - super-gsd/tools/upgrade-drift/check.cjs (Phase 62 - 11 probes + 12 self-test + 4 public APIs Lock-13 wrapped)
      - super-gsd/tools/upgrade-drift/run-self-test.cjs (Phase 62 - thin shell)
      - super-gsd/docs/UPGRADE-DRIFT.md (Phase 62 - probe table + per-milestone deltas + migration recipe)
      - super-gsd/scripts/sgsd-complete-milestone.cjs (Phase 58-62 - extended to v2.1 quint-gate)
  v1_9_milestone_codename: SGSD-Research
  v1_9_vtp_delta_active: ".planning/milestones/v1.9/VTP-RESEARCH-DELTA.md (commit 2d8ea5a) ƒ?" forward-only addendum applies to Phases 45+, 49, 51, 52. Phases 41-44 LOCKED."
  v1_9_progress:
    phase_41: "PASS @ ef90751 (1 MEDIUM Claude REVISE-fix in-loop: BLOAT_THRESHOLDS 8->4 keys per CONTEXT spec; Codex provider_unavailable timeout 180s tier; 11,294 row ledger; baseline-token-spend.md 7 sections; LOCK 6 honored 96.3% orchestrator)"
    phase_42: "PASS @ 3124362 (1 MEDIUM Claude in-loop: VERDICTS 4->5 entry add 'error' sentinel for Phase 50 enum-contract; Codex provider_unavailable; 15/15 self-test; live --check verdict=degraded status=warn lock-13 holds; check.cjs imports Phase 41 lib by reference; budgets.yaml + sgsd-complete-milestone Step 4.7 wired)"
    phase_43: "PASS @ dca3af1 (1 MEDIUM Claude in-loop: warnings_added counter dialect fix at write.cjs:360-365; 4 LOW accepted; Codex provider_unavailable; 13/13 self-test; F2 hash-idempotency + F3 never-throws + F4 verbatim-bypass all green; 44 capsules backfilled v1.2-v1.9 + 8 PHASE-INDEX.jsonl; sgsd-orchestrate Step 6.6.i.X + sgsd-complete-milestone Step 4.7-bis wired)"
    phase_44: "PASS @ 64bee5e (1 HIGH + 1 MEDIUM Claude in-loop: phase41 dependency-gate dead-branch removal + PHASE43_CMD symbolic deref; 3 LOW accepted; Codex provider_unavailable; 13/13 self-test; F1-F4 binding fixtures green; legal-keys.json 8 ROADMAP categories + 2 derived from 13 canonical sources; content_hash b0a8024bc... stable across 4 runs; 44/44 PHASE-CAPSULE.json consumers[] validate clean)"
    phase_45: "PASS @ f49dc32 (1 HIGH + 2 MEDIUM Claude in-loop: VTP step-7 silent stub trap simplified + step-2 8-step contract documented + em-dash regression fixed same commit; 3 LOW accepted; Codex provider_unavailable; intent-map 10/10 + context-packet 14/14 self-test; F2-F11 binding fixtures green; VTP delta absorbed forward-only; 6-role packets buildable; REASON_VOCAB 13-entry frozen no semantic-only; COMPRESSION_LEVELS 5-entry frozen; depthCap=2 P41-bloat fix; sgsd-orchestrate Step 7.5 + sgsd-complete-milestone Step 4.7-ter wired)"
    phase_46: "PASS @ 095e668 (Claude PASS verdict + 1 MEDIUM cleanup in-loop: dead ternary at rebuild.cjs:340 collapsed; 2 LOW accepted; Codex provider_unavailable; 15/15 self-test; F1-F8 + S9-S13 + ASCII binding fixtures green; manifest_hash d764fb5c... A3-idempotent across delete+rebuild; 145 docs indexed (capsule:44, decision:32, file_summary:56, gate_definition:13); better-sqlite3@^12.9.0 in dependencies; *.db .gitignored; Phase 49 GOV-02 owns step-6 wire-in)"
    phase_47: "PASS @ 8c701a2 (1 HIGH + 2 MEDIUM Claude in-loop: ROUTE_DECISION_REASONS enum gap closed 17->18 entries adding 'context_pressure_high' + header doc count fix; 1 LOW accepted; Codex provider_unavailable; dispatch-router 15/15 + route-ledger 14/14 self-test; F1-F8 binding fixtures green; A4 VTP 3-entry whitelist mechanically enforced; Lock 11 no-semantic-similarity routeInput; KAIROS context-pressure bias active; Phase 41 PROVIDERS + Phase 42 BUDGETS + Phase 32 logRouteDecision imported BY REFERENCE; route-ledger BOUNDARIES extended 7->8 with 'dispatch_route'; sgsd-orchestrate Step 6.d.6 wire emits envelope per Agent dispatch)"
    phase_48: "PASS @ ad8583c (1 CRITICAL + 1 HIGH + 2 MEDIUM Claude in-loop: ok=true-on-empty bug fixed (would have leaked null context as success) + _callVtpToolShim rename clarifying timeout-not-enforced contract; 2 MEDIUM + 2 LOW accepted; Codex provider_unavailable; classify 11/11 + route-ledger 15/15 + dispatch-router 15/15 self-test = 41/41 across all 3 modules; F1-F10 + assertion 11 defense-in-depth; A3 MCP failures separated to vtp-bridge-failures.jsonl; A4 5000-token cap + mandatory provenance; Phase 47 VTP_WHITELIST imported BY REFERENCE; route-ledger BOUNDARIES extended 8->9 with 'vtp_bridge'; Phase 45 context-packet/build.cjs UNCHANGED; sgsd-orchestrate Step d.7 consumer wire)"
    phase_49: "PASS @ 3b31275 (Claude PASS + 1 MEDIUM cleanup in-loop: chain-depth off-by-one corrected ƒ?" _resolveSupersededChain depth=1 -> depth=0 making cap=5 match REPLACED_BY_CHAIN_DEPTH_CAP constant; F7b fixture extended A->F to A->G to overshoot corrected 5-cap boundary; 1 HIGH-labeled coverage gap + 1 MEDIUM milestone filter + 2 LOW accepted; Codex provider_unavailable; lifecycle 29/29 + write 16/16 + build 15/15 self-test = 60/60 across 3 modules; 6 governance APIs (admit/promote/demote/revoke/revalidate/processComplaints) + 3 helpers; A1 4-level promotion + A4 admission gate + A5 privileged-write envelope all SOUND; Lock 11 structural-only thresholds + Lock 13 never-throws SOUND; Phase 41-48 imports BY REFERENCE; T2 PHASE-CAPSULE schema additive 10 fields; T3 idempotent backfill 44/44 capsules; T4 build.cjs:702-703 lazy try/catch wire preserves Phase 45 self-test invariant; 4 NEW canonical streams memory-{promotions,demotions,revocations,revalidations}.jsonl owned; sgsd-orchestrate Step 6.6.i.Y + sgsd-complete-milestone Step 4.7-quater wired)"
    phase_50: "PASS @ ae6d151 (verifier PASS 0-deviations 0-blockers; phase-level Claude ATC FULL tier verdict=warn 0-CRITICAL 0-HIGH 1-MEDIUM-fixed-in-loop 3-LOW-accepted; Codex provider_unavailable; cockpit-shell.cjs --self-test 8/8 PASS PANEL_KINDS-frozen + CONTEXT_SOURCE_MIX_KEYS-frozen + Phase-41/42/49-by-reference + 8-key-snapshot + canonical-stream-fingerprint-stable; M1 in-loop: compact-path A2 panel was passing duplicate -Active/-History + empty -ToolStream ƒ?" full-render data-prep mirrored at line ~1885 so 1366x768 laptop viewport now sees real history roster + Get-LastMcpSummary tool stream; SGSD 6 atomic commits + 4 operator parallel commits preserved (e2d07af 0c1baf2 5db05d7 42d8ea3); Phase 41/42/45/49 tool trees git-diff-quiet (untouched); Lock 11 grep-clean; Lock 13 never-throws; read-only invariant grep-clean writeFile/appendFile; single-pane Codex one-liner block removed at 1845 comment; 40-row compact threshold confirmed line 1495; MUDA waste audit all probes PASS exit 0)"
    phase_51: "PASS @ e4e4e67 (verifier PASS 9/9 must-haves 0-deviations 0-blockers; phase-level Claude ATC FULL tier verdict=pass 0-CRITICAL 0-HIGH 1-MEDIUM-fixed-in-loop 3-LOW-deferred; Codex provider_unavailable; harness 33/33 self-test PASS sub-60s covering 18 RESEARCH-locked semantic assertions; 7 atomic task commits + 4 in-loop fixups + 1 NUL-byte ASCII fix = 11 commits total; falsifiable proof bar measurable: median pct_reduction (Pitfall-2 sort+midpoint not mean) AND evidence_retention deterministic Lock-11 byte-equality on (kind,ref) tuples AND verdict-tree handles all 4 states PASS/PASS-WITH-DEFERRED-N/'ledger-only ƒ?" incomplete'/FAIL; 6 baseline scenarios S1-S6 anchored to real ledger source_event_ids (S2 baseline 171,175 tokens matches audit:142 anchor 150k+); 16 failure-injection fixtures F1-F16 + F17 Phase 52 stub with snapshot/inject/observe/restore protocol + anti-pollution canonical fingerprint guard across 5 streams (added crit-backlog.jsonl in T4-fixup); hybrid replay --mode=full path mirrors sgsd-blind-live-controller.mjs:104-138 anti-cheat boundary verbatim with $1.5M token ceiling + claude-CLI-absent soft-downgrade to ledger-only + bench-post-{scenario_id}-{ts} unforgeable run_id witness (Phase 47 schema-correct: substring match on run_id field NOT scenario_id); milestone-close gate wired SKILL.md Step 0 ƒÅ' super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9 ƒÅ' harness.selfTest() with stderr tags milestone_close_blocked:context_bench_unavailable / context_bench_self_test_failed (Lock 13 try/catch wraps; never silent advance); Phase 41/42/43/44/45/46/47/48/49 tool trees + sgsd-cockpit-shell.cjs git-diff-quiet (Lock 4 verified); MUDA waste audit all probes PASS exit 0; F10 prompt-injection uses {SECRET_PLACEHOLDER_X} literal only ƒ?" no AKIA/sk-/ghp_ payload (CLAUDE.md absolute rule); 5-W plan-check findings W1-W5 all addressed surgically before executor: W1 run_id substring witness W2 ledger-only docs W3 legacy useful_findings imputation W4 deterministic post_artifacts source W5 SKILL.md+cjs wire; M1 phase-ATC fix in-loop: harness.replayScenario/injectFailure exported stubs rewired to delegate to real T5/T4 implementations)"
    phase_52: "PASS @ df72a5a (verifier PASSED-WITH-DEVIATIONS 13/13 must-haves 9/9 commit verdicts 7/7 REDIS-LOCKS-VERIFIED 0-blockers; phase-level Claude ATC FULL tier verdict=pass 0-CRITICAL 0-HIGH 0-MEDIUM 4-LOW-deferred; Codex provider_unavailable; redis-adapter --self-test 26/26 PASS sub-1s; 7 atomic task commits + 2 in-loop fixups (T1 CRIT _emitProjectionLog T5-deferral stub + W1 validated_thought added to FORBIDDEN_KINDS size=8; T6 W1 injectFailure F17 unreachable-via-public-API fixed by removing skipped:true wrapper) = 9 commits total; 8 public APIs Lock-13-wrapped (isAvailable/getHotPacket/putHotPacket/getSemanticCache/putSemanticCache/publishEvent/readEvents/invalidateBySourceHash) all return degraded sentinel never throw; 7 REDIS-LOCKS mechanically enforced: LOCK-01 ALLOWED_KINDS(9)+FORBIDDEN_KINDS(8) projection-only allowlist+denylist + LOCK-02 _revalidateAndMaybeDelete source-hash invalidation on every read + LOCK-03 _composeSemanticKey 5-component sha256 byte-equality (intent_id_normalized:role:phase:milestone:JSON.stringify(policy):sorted_hashes) + LOCK-04 every SET has EX TTL_BY_KIND every XADD has MAXLEN ~1000 + LOCK-05 _testHook_simulateFlushAndPoison 4-step protocol proves canonical truth survives FLUSHDB + LOCK-06 degraded-OK at module-missing/url-absent/env-disabled/connect-fail/op-timeout/internal-error + LOCK-07 poisoned-key defense at parse+schema+source-hash stages on read AND write; F17 surgically activated in Phase 51 failure-injectors.cjs lines 271-279 + 891-900 ONLY (F1-F16 frozen 16-entry array byte-untouched 81-263; node -e INJECTION_FIXTURES.length=16 + Object.isFrozen=true; lazy require pattern Pitfall 6 inside _F17.inject() body) F17 reason codes: source_hash_drift + poisoned_unparseable + redis_flushdb_recovered_via_sqlite (Q3 resolved 3); F17 inject strategy: BOTH poison-key AND FLUSHDB sequential (Q4 resolved); dual-gate v1.9 milestone-close wired sgsd-complete-milestone.cjs (context-bench 33/33 first then redis-adapter 26/26 second; stderr tags milestone_close_blocked:redis_adapter_unavailable + redis_adapter_self_test_failed; Lock 13 try/catch never silent advance); docker-compose.redis.yml redis:7-alpine ephemeral no-volumes dev convenience; .planning/metrics/redis-projection-log.jsonl envelope-v1 git-tracked 289+ rows from self-test runs; Pitfall 1 _redactRedisUrl regex `:[^@:/]*@` -> `:***@` verifier-confirmed 0 unredacted creds in log; ASCII-only verified across all 6 changed files; Phase 41-50 + sgsd-cockpit-shell.cjs + Phase 51 non-F17 files git-diff-quiet (Lock 4 verified); MUDA waste audit all probes PASS exit 0)"
  v1_9_open_debt:
    phase_50_low: "L1 selfTest sevenKeysOK label says 7-keys but asserts 8 (cosmetic) + L2 Substitute-TsTokens fixture mutation pattern fragile under mid-run restart (low probability, temp-dir copied so safe at runtime) + L3 run-acceptance-fixtures.ps1 line 4 stale 'Phase 30 T1' header comment ƒ?" all deferred to v1.9 milestone-close polish per phase 41-49 LOW-accepted precedent"
    phase_51_low: "L1 postRows always passed [] in _runBenchImpl line 339 (cache_read_ratio_after + useful_findings_per_token_after silently null in --mode=full runs until postRows is keyed per-scenario) + L2 _printSelfTestResults in sgsd-complete-milestone.cjs duplicates 15 lines from harness.cjs _printSelfTest (refactor candidate) + L3 _sumUsefulFindingsPerToken returns 0.0 not null when tokens-present-but-findings-zero (W3 spec divergence; non-breaking) ƒ?" all deferred to v1.9 milestone-close polish per phase 41-50 LOW-accepted precedent"
    phase_52_low: "L1 _getClient() never assigns _client non-null ƒ?" all live Redis paths dead at runtime pending T2 createClient wiring (intentional per plan; documented in code; runtime degrades correctly via _disabledReason) + L2 INJECT_REASON_CODES retains orphaned entry bench_fixture_skipped:phase_52_redis_adapter_not_shipped (T6-fixup removed emitting guard; closed-enum so no behavioral impact) + L3 docker-compose.redis.yml line 25 says '24 assertions' actual is 26 (doc count drift) + L4 sgsd-complete-milestone.cjs lines 161-176 require redis-adapter.cjs + validates selfTest export but never invokes in-process (gate runs via spawnSync; the require is dead) ƒ?" all deferred to next-milestone polish per phase 41-51 LOW-accepted precedent; Phase 52 verifier PASSED-WITH-DEVIATIONS treats these as design-documented not blockers"
  v1_9_supersedes_archive: .planning/archive/superseded/v1.9-knowledge-memory-governance/
  v1_8_progress:
    phase_36: "PASS @ d6c402f"
    phase_37: "PASS @ 9f9759d"
    phase_38: "PASS @ f265d64"
    phase_39: "PASS @ 3d9c37e"
    phase_40: "PASS @ 3747a63 (2 CRIT + 4 WARN; 2 in-loop, 1 false alarm, 1 accepted; combined anti-slop ~9/10)"
  milestones_shipped: ["v1.6 SHIPPED-WITH-DEBT-10 @ d510e32", "v1.7 SHIPPED @ 5690c38", "v1.8 SHIPPED @ <pending>", "v1.9 SHIPPED @ <pending>", "v2.0 SHIPPED @ <pending>"]
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-21)

**Core value:** Ship an autonomous framework that any Claude Code Max plan user can install with one command and immediately start building software
**Current focus:** v2.2 ƒ?" Phase 63 closed PASS-WITH-DEFERRED-5 @ b5b46a8 (Warp Capability Smoke Test). 5 operator UI manual checks (M1-M5) pending in `.planning/milestones/v2.2/MANUAL-CHECKS.md`. Phase 64-67 ready to dispatch (64 + 66 partially blocked on M1; 65 + 67 unblocked).

## Current Position

Roadmap: v2.2 ƒÅ' v2.8 SGSD Warp Integration (phases 63-97). Prior roadmap v1.6 ƒÅ' v2.1 SHIPPED 2026-04-29 (see frontmatter `previous_roadmap` block).
Milestone: v2.2 ƒ?" Warp Discovery And Operator Baseline (5 phases: 63 ƒo" closed, 64-67 ready to dispatch).
Phase: 63 ƒo" closed PASS-WITH-DEFERRED-5 (5 deferred rows are operator UI manual checks, NOT edge_guard_miss; tracked in MANUAL-CHECKS.md not CRIT-BACKLOG).
Plan: 63-01 ƒo" Warp Capability Evidence Collection (13/13 tasks complete).
Status: Phase 63 done ƒ?" operator must complete M1-M5 in Warp UI before Phase 64 can dispatch unblocked. Phase 65 and Phase 67 can dispatch immediately.
Last activity: 2026-04-29 ƒ?" Phase 63 closed @ b5b46a8 (7 artifacts under .planning/milestones/v2.2/; sg-launched-Claude topology proven empirically; ~/.warp/launch_configurations/ exists empty; .warp/workflows lint 4/5; .warpindexingignore missing forwarded to Phase 65).

Progress: [ƒ-^ƒ-^ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'] 20% (1/5 v2.2 phases complete)
Roadmap progress: [ƒ-^ƒ-^ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'ƒ-'] 1/35 (1/5 v2.2 + 0/5 v2.3 + 0/6 v2.4 + 0/5 v2.5 + 0/5 v2.6 + 0/5 v2.7 + 0/4 v2.8)

## Accumulated Context

### Decisions (from v1.1 ƒ?" retained)

- D001: Opus orchestrates, Sonnet executes, Haiku classifies
- D002: Compressed XML plans (~800 tokens vs ~2,000 prose)
- D003: Structured 300-word agent reports
- D004: JSONL token logging
- D005: Frontmatter-only reads + brv-query-local
- D006: No API keys ƒ?" Max plan OAuth only
- D007 (DLB-01): Git-native filesystem memory tier, no MCP, 40-file tripwire
- D008 (DLB-02): MUDA write-path only with kill condition
- D009 (DLB-03): Structural intent injection + cascade rule + coverage kill check
- D010 (DLB-04): Scoped Agents manifest + operator-gated SEPL + trajectory-hypothesis distillation
- D011 (retro): FLOOR gate operates per-brief; cascade does not trigger re-inheritance
- D012 (retro): AGP-P-02 resource-protocol scope is a floor, not a ceiling
- D013 (retro): Lightweight decision-note format `YYYY-MM-DD-slug.md` sits alongside `DLB-NN`
- D014 (20-03): sgsd-session-start.js created as new sgsd-prefixed hook; path.join(process.cwd(),...) throughout ƒ?" no toUnixPath
- D015 (20-03): cumulative_runtime_s moved from _log_row base template to extra param ƒ?" avoids duplicate JSON keys on spawned rows
- D016 (20-03): --MilestoneCloseCheck inserted before __sgsd_fail in sgsd-gate-verdict.ps1 ƒ?" exits 0 without requiring valid ProjectDir
- D017 (21-04): sgsd-board-researcher model=sonnet consistent with all 4 existing board members; board.includes guard in sgsd-ceo ensures backward compat; vote-math expressed as >N/2 (majority) ƒ?" survives any board.length
- D018 (22-01): canonicalize_path uses module-scope _CANON_RESOLVED flag (not subshell exit-code) to track fallback ƒ?" avoids variable-leak across subshells; helper placed after _detect_root() so it's defined before path vars are set

### Open Dependencies (v2.2 scoping-time)

- **Phase 63** (Warp Capability Smoke Test) ƒ?" ƒo. CLOSED PASS-WITH-DEFERRED-5 @ b5b46a8. 7 artifacts under .planning/milestones/v2.2/. Forwarded inputs to Phase 64+: workflow pack defect (sgsd-token-current.yaml missing arguments block), missing .warpindexingignore, warp-doctor probe set, launch-config active-window caveat, GitHub upstream tracking URL.
- **Phase 64** (Workflow Pack Completion) ƒ?" partially blocked on operator manual check **M1** (Warp Command Search discoverability of workflow pack). Phase 63 forwarded the sgsd-token-current.yaml `arguments:`-block defect as a known input. 8 missing workflows enumerated in roadmap.
- **Phase 65** (Agent Rules Context Pack) ƒ?" UNBLOCKED. Author AGENTS.md (tool-neutral), tighten WARP.md (operator-facing), establish rule hierarchy AGENTS.md = all-agent / WARP.md = Warp daily / CLAUDE.md = Claude Code orchestrator contract.
- **Phase 66** (SGSD Warp Operator Guide) ƒ?" partially blocked on operator manual check **M1**. Guide assumes workflows are searchable.
- **Phase 67** (Warp Doctor Probe Design) ƒ?" UNBLOCKED. Phase 63 audit produced the canonical probe set (env scan + command resolution + launch config dir + workflow lint + .warpindexingignore presence).

### Pending Todos

- **M1-M5** (operator UI manual checks) ƒ?" see `.planning/milestones/v2.2/MANUAL-CHECKS.md`. Operator records results back into `.planning/milestones/v2.2/WARP-SMOKE.md` rows Q1, Q5, Q6, Q9, Q10.
- Decide next dispatch: Phase 64 (waits on M1), Phase 65 (immediate), or Phase 67 (immediate). Roadmap order is 63 ƒÅ' 64 ƒÅ' 65 ƒÅ' 66 ƒÅ' 67; operator may reorder around the M1 blocker.
- After v2.2 close: dispatch v2.3 Phase 68 ƒ?" SGSD MCP Contract (read-only). Per operator brief: "If only one milestone ships, ship the read-only SGSD MCP bridge."
- Track upstream Warp issues at https://github.com/warpdotdev/warp ƒ?" #7326 (ACP) and #9233 (May-Jun 2026 roadmap incl. Warp CLI / tmux control mode / wrapper command detection). Surfaced in Phase 96.

### Blockers/Concerns

- **No active hard blockers.** Phase 63 closed cleanly; v2.2 dispatch path is operator-led.
- **Soft blocker M1**: Phase 64 design assumes Warp Command Search surfaces the 5 existing workflows. If M1 fails, file upstream issue and forward to Phase 96.
- **Carried debt**: 10 phase_atc rows in CRIT-BACKLOG from v1.6 (frontmatter `backlog:` block). Tagged to phases 28/29/30 ƒ?" not active blockers for v2.2; cockpit may continue to display this historical debt.
- **Note**: 4 modified telemetry ledgers in working tree (.planning/metrics/{activity-log.jsonl, narrative.md, token-attribution.jsonl, token-waste-status.jsonl}) are ambient cockpit churn, unrelated to Phase 63. Will commit separately as `chore(metrics): cockpit telemetry churn` if needed.

## Session Continuity

Last session: 2026-04-29T19:00:00.000Z
Stopped at: Phase 63 closed PASS-WITH-DEFERRED-5 @ b5b46a8 ƒ?" operator pending on M1-M5 manual UI checks; Phase 65/67 dispatchable immediately if operator chooses to advance.
Resume file: .planning/milestones/v2.2/phases/63-warp-capability-smoke/63-VERIFICATION.md (Phase 63 close evidence) + .planning/milestones/v2.2/MANUAL-CHECKS.md (operator UI checklist)
Active roadmap contract: .planning/milestones/warp-integration/ROADMAP.md
Active roadmap handover: .planning/milestones/warp-integration/CLAUDE-HANDOVER.md
Previous roadmap (history): .planning/ROADMAP-AGENT.md (v1.6 ƒÅ' v2.1 SHIPPED)


 succeeded in 742ms:
.planning\analyses\2026-04-27-agent-context-bloat-audit.md:229:- Step 6.b.5 dispatches `sgsd-vtp-enrichment` only if enabled and healthy.
.warp\workflows\sgsd-route-recent.yaml:2:description: Show the last 10 double-agent execution_route decisions — provider chosen, why, fallback used, compiled-private-context state. Reads .planning/metrics/route-decisions.jsonl. Search terms include route, codex, claude, executor, why, context, compiled, decision.
.warp\workflows\sgsd-route-recent.yaml:3:command: 'cd "{{project_dir}}"; if (Test-Path .planning\metrics\route-decisions.jsonl) { Get-Content .planning\metrics\route-decisions.jsonl -Tail 10 -Encoding UTF8 | ForEach-Object { try { $r=($_ | ConvertFrom-Json); if ($r.boundary -eq "execution_route") { [pscustomobject]@{ ts=$r.ts; phase=$r.phase; provider=$r.decision.chosen_provider; primary=$r.decision.primary_provider; compiled=$r.decision.private_context_compiled; tests=$r.decision.tests_passed; why=($r.reason_codes -join ",") } } } catch { } } | Format-Table -AutoSize } else { Write-Host "No route-decisions.jsonl yet -- no double-agent routes logged." }'
.planning\briefs\2026-04-30-claude-handover-double-agent-routing-and-codex-blue.md:58:  -> route-decisions.jsonl gets an execution_route row
.planning\briefs\2026-04-30-claude-handover-double-agent-routing-and-codex-blue.md:214:Each route writes one `.planning/metrics/route-decisions.jsonl` row with:
.planning\briefs\2026-08-11-cross-pollination-ANALYSIS.md:14:   gate (Step 6.b.5) so every research/planning/blocker question first calls
.planning\briefs\2026-08-11-cross-pollination-ANALYSIS.md:15:   vtp_triage, treats the route as advisory, records accept/modify/reject via
.planning\briefs\2026-08-11-cross-pollination-ANALYSIS.md:16:   vtp_triage_feedback + a route-decisions.jsonl row.
.planning\briefs\2026-08-11-cross-pollination-ANALYSIS.md:27:  demand evidence VTP's Phase-0 gate requires (20+ inadequate-path queries in
.planning\briefs\2026-08-11-cross-pollination-ANALYSIS.md:36:- vtp_triage and vtp_triage_feedback are declared LIVE, but they DO NOT appear
.planning\briefs\2026-08-11-cross-pollination-ANALYSIS.md:41:  milestone. PRECONDITION: restart the session/MCP child, confirm vtp_triage +
.planning\briefs\2026-08-11-cross-pollination-ANALYSIS.md:42:  vtp_triage_feedback resolve and honour their contracts (execution.performed=
.planning\briefs\2026-08-11-cross-pollination-ANALYSIS.md:51:  if 'existing path inadequate' is recorded truthfully, not rubber-stamped.
.planning\briefs\2026-08-11-cross-pollination-ANALYSIS.md:59:precondition above, with: (a) skill 1 as an extension of Step 6.b.5 not a new
.planning\briefs\2026-08-11-cross-pollination-handover.md:12:  - vtp_triage (LIVE, shipped in vtp-triage-v2)
.planning\briefs\2026-08-11-cross-pollination-handover.md:13:  - vtp_triage_feedback (LIVE, advisory feedback ledger v1)
.planning\briefs\2026-08-11-cross-pollination-handover.md:24:enrichment gate (Step 6.b.5, keyword-cascade search). The cross-
.planning\briefs\2026-08-11-cross-pollination-handover.md:41:| `vtp_triage` | LIVE | Input: question + optional context. Output: compiled advisory route (archetype, tool plan, BLOCKING_AMBIGUITY first), `execution.performed=false`, zero writes. Classifier-only authority: the caller follows or overrides. |
.planning\briefs\2026-08-11-cross-pollination-handover.md:42:| `vtp_triage_feedback` | LIVE | Records accept/modify/reject + reason code against a triage_id. Reason REQUIRED for rejected/modified. Ledger confined to `.planning/metrics/triage-advisory/`. |
.planning\briefs\2026-08-11-cross-pollination-handover.md:43:| VTP enrichment gate | LIVE | Step 6.b.5 in sgsd-orchestrate; 5-tool cascade; enrich-only. |
.planning\briefs\2026-08-11-cross-pollination-handover.md:61:- **Calls:** `vtp_triage(question, context)` → treat compiled route as
.planning\briefs\2026-08-11-cross-pollination-handover.md:63:- **Records:** every decision via `vtp_triage_feedback` (accepted /
.planning\briefs\2026-08-11-cross-pollination-handover.md:65:  `route-decisions.jsonl` row with `boundary='vtp_triage_advisory'`.
.planning\briefs\2026-08-11-cross-pollination-handover.md:69:  question formulation — extend Step 6.b.5, do not add a parallel gate.
.planning\briefs\2026-08-11-cross-pollination-handover.md:137:  inadequate, Phase C does not proceed on schedule.
super-gsd\agents\sgsd-vtp-enrichment.md:3:description: VTP library enrichment gate sub-agent (VTPE-01). Fires at orchestrator Step 6.b.5 between gsd-phase-researcher and gsd-planner. Queries VTP via 5-tool cascade with 3-source phase seed (CONTEXT + REQ-IDs + RESEARCH), writes {NN}-VTP-ENRICHMENT.md artifact per D-04 shape. Never challenges plans — enrich-only (Q2=B).
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:7:2. Is 'extend Step 6.b.5' actually safe, or does bolting an advisory vtp_triage call into the pre-planning enrichment cascade create a hidden critical-path or a double-enrichment (triage route + existing 5-tool cascade both firing)?
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:8:3. Is the versioned-ledger + fire-and-forget condition sufficient, or is there a data-integrity or replay hazard in append-only advisory ledgers the board glossed?
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:37:`vtp_triage` and `vtp_triage_feedback` resolve AND honour contract:
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:45:  Codex-executable phase: skill 1 sgsd-triage-first (extend Step 6.b.5, reuse
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:49:  Contrarian's deletion: logging-only extension of Step 6.b.5 — closed-vocab
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:50:  override-reason field + route-decisions.jsonl row, NO vtp_triage call — run
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:56:2. All triage calls inherit Step 6.b.5's bounded-timeout degraded path; all
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:57:   feedback writes are fire-and-forget append-only to
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:58:   .planning/metrics/triage-advisory/ — triage absence/latency NEVER blocks a
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:68:- 4-week demand test: <20 truthfully-recorded inadequate-path queries → Phase C
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:76:The route-decisions.jsonl + taste-ledger schema design (schema_version,
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:99:  - vtp_triage (LIVE, shipped in vtp-triage-v2)
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:100:  - vtp_triage_feedback (LIVE, advisory feedback ledger v1)
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:111:enrichment gate (Step 6.b.5, keyword-cascade search). The cross-
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:128:| `vtp_triage` | LIVE | Input: question + optional context. Output: compiled advisory route (archetype, tool plan, BLOCKING_AMBIGUITY first), `execution.performed=false`, zero writes. Classifier-only authority: the caller follows or overrides. |
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:129:| `vtp_triage_feedback` | LIVE | Records accept/modify/reject + reason code against a triage_id. Reason REQUIRED for rejected/modified. Ledger confined to `.planning/metrics/triage-advisory/`. |
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:130:| VTP enrichment gate | LIVE | Step 6.b.5 in sgsd-orchestrate; 5-tool cascade; enrich-only. |
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:148:- **Calls:** `vtp_triage(question, context)` → treat compiled route as
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:150:- **Records:** every decision via `vtp_triage_feedback` (accepted /
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:152:  `route-decisions.jsonl` row with `boundary='vtp_triage_advisory'`.
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:156:  question formulation — extend Step 6.b.5, do not add a parallel gate.
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:224:  inadequate, Phase C does not proceed on schedule.
.planning\decisions\2026-08-11-cross-pollination-BOARD-MEMO.md:19:`vtp_triage` and `vtp_triage_feedback` resolve AND honour contract:
.planning\decisions\2026-08-11-cross-pollination-BOARD-MEMO.md:27:  Codex-executable phase: skill 1 sgsd-triage-first (extend Step 6.b.5, reuse
.planning\decisions\2026-08-11-cross-pollination-BOARD-MEMO.md:31:  Contrarian's deletion: logging-only extension of Step 6.b.5 — closed-vocab
.planning\decisions\2026-08-11-cross-pollination-BOARD-MEMO.md:32:  override-reason field + route-decisions.jsonl row, NO vtp_triage call — run
.planning\decisions\2026-08-11-cross-pollination-BOARD-MEMO.md:38:2. All triage calls inherit Step 6.b.5's bounded-timeout degraded path; all
.planning\decisions\2026-08-11-cross-pollination-BOARD-MEMO.md:39:   feedback writes are fire-and-forget append-only to
.planning\decisions\2026-08-11-cross-pollination-BOARD-MEMO.md:40:   .planning/metrics/triage-advisory/ — triage absence/latency NEVER blocks a
.planning\decisions\2026-08-11-cross-pollination-BOARD-MEMO.md:50:- 4-week demand test: <20 truthfully-recorded inadequate-path queries → Phase C
.planning\decisions\2026-08-11-cross-pollination-BOARD-MEMO.md:58:The route-decisions.jsonl + taste-ledger schema design (schema_version,
super-gsd\scripts\lib\orchestrator-hooks.cjs:134:  // Lock 13: emit failures are fire-and-forget. Use spawnSync so the
super-gsd\scripts\lib\route-ledger.cjs:4:// Source of truth: .planning/metrics/route-decisions.jsonl (machine-readable)
super-gsd\scripts\lib\route-ledger.cjs:97:  return path.join(planningDir, 'metrics', 'route-decisions.jsonl');
super-gsd\scripts\lib\route-ledger.cjs:321:  // <repo>/.planning/metrics/route-decisions.jsonl (3 dirs up + .planning).
super-gsd\scripts\lib\route-ledger.cjs:322:  const realLedger = path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'route-decisions.jsonl');
super-gsd\scripts\lib\route-ledger.cjs:424:    // 12. Self-test never touches canonical .planning/metrics/route-decisions.jsonl.
super-gsd\docs\SGSD-WARP-CUSTOMIZATION.md:54:| `SGSD Codex Watch` | 3-pane: codex-status + route-decisions + shell | Watch double-agent executor |
super-gsd\docs\SGSD-WARP-CUSTOMIZATION.md:155:function sgsd-route  { Get-Content C:\Users\user\GSDedits\.planning\metrics\route-decisions.jsonl -Tail 10 -Encoding UTF8 }
super-gsd\scripts\sgsd-mission-control.ps1:170:        foreach ($name in @("agent-token-spend.jsonl","token-waste-status.jsonl","context-packet-log.jsonl","route-decisions.jsonl")) {
super-gsd\scripts\sgsd-mission-control.ps1:1642:    $s = $s -replace '`\.planning/metrics/route-decisions\.jsonl`', 'route decision log'
super-gsd\scripts\sgsd-narrative.ps1:588:    $routePath = Join-Path $PlanningDir "metrics\route-decisions.jsonl"
super-gsd\scripts\lib\sampling-decider.cjs:30://      logs route-decisions.jsonl with boundary='gate_override' (SAMPLE-04+05)
super-gsd\scripts\lib\sampling-decider.cjs:248:  // canonical route-decisions.jsonl at <repo>/.planning/metrics/route-decisions.jsonl
super-gsd\scripts\lib\sampling-decider.cjs:251:  const routeLedger = path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'route-decisions.jsonl');
super-gsd\scripts\lib\sampling-decider.cjs:429:    // Bonus fingerprint guard: canonical gates.yaml + route-decisions.jsonl untouched.
super-gsd\scripts\lib\sampling-decider.cjs:447:      failures.push({ name: 'BONUS. canonical route-decisions.jsonl fingerprint preserved',
super-gsd\scripts\lib\sampling-decider.test.cjs:110:const ledger = path.join(planningDir, 'metrics', 'route-decisions.jsonl');
super-gsd\scripts\lib\sampling-decider.test.cjs:116:assert('4. --force-gates appends route-decisions.jsonl row with boundary=gate_override',
super-gsd\scripts\lib\sgsd-cockpit-shell.cjs:155:    const rows = _readJsonl(path.join(planningDir, 'metrics', 'route-decisions.jsonl'))
super-gsd\scripts\lib\sgsd-cockpit-shell.cjs:346:    path.join(planningDir, 'metrics', 'route-decisions.jsonl')
super-gsd\docs\templates\warp-launch-configs\sgsd-codex-watch.yaml:7:#   - Middle: route-decisions tail (provider chosen, why, compiled-context state)
super-gsd\docs\templates\warp-launch-configs\sgsd-codex-watch.yaml:33:                  powershell -NoExit -NoProfile -ExecutionPolicy Bypass -Command "& 'C:\Users\user\GSDedits\super-gsd\scripts\sgsd-profile-extensions.ps1'; Write-Host 'route-decisions tail (last 10 execution_route rows):' -ForegroundColor Blue; Get-Content .planning\metrics\route-decisions.jsonl -Tail 10 -Encoding UTF8 2>$null"
super-gsd\registry\command-envelope-v1.yaml:153:        description: "Operator-issued --force-gates / --skip-gates with --override-reason; logged to route-decisions.jsonl boundary=gate_override (Phase 38 SAMPLE-04)."
super-gsd\scripts\sgsd-profile-extensions.ps1:115:    $routePath = Join-Path $root '.planning\metrics\route-decisions.jsonl'
super-gsd\scripts\sgsd-profile-extensions.ps1:237:    $p = Join-Path $global:__SgsdRepoRoot '.planning\metrics\route-decisions.jsonl'
super-gsd\scripts\sgsd-profile-extensions.ps1:238:    if (Test-Path $p) { Get-Content $p -Tail 10 -Encoding UTF8 } else { Write-Host 'no route-decisions.jsonl yet' -ForegroundColor Yellow }
super-gsd\scripts\sgsd-stop-handoff.sh:569:# --- SPAWN: fire-and-forget double-background ---
.planning\ROADMAP-AGENT.md:298:**Goal**: Append-only `.planning/metrics/route-decisions.jsonl`. Writer
.planning\ROADMAP-AGENT.md:313:  in `route-decisions.jsonl` with `boundary=codex_route` and non-empty `reason_codes`.
.planning\ROADMAP-AGENT.md:424:- `--force-gates X --override-reason "..."` logged to route-decisions.jsonl with `boundary=gate_override`
.planning\ROADMAP-AGENT.md:549:route-decisions.jsonl with reason + token expectation + fallback.
.planning\resource-registry\agents.jsonl:22:{"id":"sgsd-vtp-enrichment","path":"super-gsd/agents/sgsd-vtp-enrichment.md","sha":"5f8f3b2c276c7802387f51f4cf372f9535196a5d","mtime":1778663765,"model":"sonnet","tools":"Read, Grep, Glob, Bash, Write, mcp__vtp-kb__vtp_search, mcp__vtp-kb__vtp_search_substrate, mcp__vtp-kb__vtp_search_research, mcp__vtp-kb__vtp_route_and_retrieve, mcp__vtp-kb__vtp_advise_service_enrichment, mcp__vtp-kb__vtp_health_structured, mcp__vtp-kb__vtp_get_document","description":"VTP library enrichment gate sub-agent (VTPE-01). Fires at orchestrator Step 6.b.5 between gsd-phase-researcher and gsd-planner. Queries VTP via 5-tool cascade with 3-source phase seed (CONTEXT + REQ-IDs + RESEARCH), writes {NN}-VTP-ENRICHMENT.md artifact per D-04 shape. Never challenges plans — enrich-only (Q2=B).","status":"legacy-disabled"}
super-gsd\tools\failure-injection\SCENARIOS.schema.json:87:                "route-decisions.jsonl",
super-gsd\skills\sgsd-orchestrate\SKILL.md:93:   closed-vocab recovery row to `.planning/metrics/route-decisions.jsonl`, and
super-gsd\skills\sgsd-orchestrate\SKILL.md:274:     // --override-reason="..."; logged to route-decisions.jsonl with
super-gsd\skills\sgsd-orchestrate\SKILL.md:288:     // Log one route-decisions.jsonl row per override (locked Q6).
super-gsd\skills\sgsd-orchestrate\SKILL.md:356:     // All Step 6.b.5 gate checks read this cached value before dispatching.
super-gsd\skills\sgsd-orchestrate\SKILL.md:750:     b.5 VTP ENRICHMENT GATE (Step 6.b.5) — Phase has RESEARCH.md AND config.vtp_enrichment.enabled is true →
super-gsd\skills\sgsd-orchestrate\SKILL.md:872:        row to route-decisions.jsonl with boundary='dispatch_route'.
super-gsd\skills\sgsd-orchestrate\SKILL.md:989:          // The bridge ALREADY appended one row to route-decisions.jsonl
super-gsd\skills\sgsd-orchestrate\SKILL.md:1018:          route-decisions.jsonl (boundary='vtp_bridge', status='fail'|'timeout'). The
super-gsd\skills\sgsd-orchestrate\SKILL.md:1028:        COEXISTENCE with sgsd-vtp-enrichment (Step 6.b.5). The two are distinct and both
super-gsd\skills\sgsd-orchestrate\SKILL.md:1030:        - Step 6.b.5 (sgsd-vtp-enrichment): per-PHASE enrichment between researcher and
super-gsd\skills\sgsd-orchestrate\SKILL.md:1040:          route-decisions.jsonl rows where boundary='vtp_bridge', and may promote recurring
super-gsd\skills\sgsd-orchestrate\SKILL.md:2582:do NOT crash the run (event-emit is fire-and-forget; legacy ledgers remain
super-gsd\tools\failure-injection\scenarios.json:23:        "route-decisions.jsonl",
super-gsd\tools\failure-injection\scenarios.json:68:        "route-decisions.jsonl",
super-gsd\tools\failure-injection\scenarios.json:92:        "route-decisions.jsonl"
super-gsd\tools\failure-injection\scenarios.json:199:        "route-decisions.jsonl"
super-gsd\tools\failure-injection\harness.cjs:251:  'route-decisions.jsonl',
super-gsd\tools\failure-injection\harness.cjs:344:  'route-decisions.jsonl',
super-gsd\tools\failure-injection\harness.cjs:2018://   tmpdir/.planning/metrics/route-decisions.jsonl, each terminated by
super-gsd\tools\failure-injection\harness.cjs:2054:    var ledgerDst = path.join(metricsDir, 'route-decisions.jsonl');
super-gsd\tools\chaos-restart\harness.cjs:122:  'route-decisions.jsonl',
super-gsd\tools\failure-injection\fixtures\route-ledger-truncated-stream\README.md:11:  tmpdir/.planning/metrics/route-decisions.jsonl
super-gsd\tools\failure-injection\fixtures\route-ledger-truncated-stream\README.md:55:- canonical_byte_equal === true (route-decisions.jsonl in tmpdir was
super-gsd\tools\dispatch-router\route.cjs:668:    path.join(repoRoot, '.planning', 'metrics', 'route-decisions.jsonl'),
super-gsd\tools\double-agent-executor\task-capsule.schema.json:49:      "description": "Phase 100 cross-link to harness-change-manifest entry. Optional. When set, route-decisions evidence array adds a harness_change_manifest ref."
super-gsd\tools\double-agent-executor\scorecard.cjs:5:// Reads route-decisions.jsonl execution_route rows and reports provider usage,
super-gsd\tools\double-agent-executor\README.md:78:`.planning/metrics/route-decisions.jsonl`. The row includes:
super-gsd\tools\context-bench\BENCHMARK-REPORT.template.md:41:The anti-cheat boundary asserts that the workspace handed to the post-mode dispatch is clean of all 6 forbidden anti-cheat strings (`benchmark`, `score_weight`, `expected_failure`, `oracle`, `anti_cheat_signal`, `this_is_a_test`) and 3 secret-prefix paranoia tokens (`AKIA`, `sk-`, `ghp_`) before the dispatch is permitted. The post-dispatch witness row in `.planning/metrics/route-decisions.jsonl` (run_id prefix `bench-post-{scenario_id}-`) is the unforgeable proof that the dispatch was real.
super-gsd\tools\context-bench\BENCHMARK-REPORT.template.md:53:- Route decisions: `.planning/metrics/route-decisions.jsonl` (Phase 47, bench witnesses)
super-gsd\tools\context-bench\harness.cjs:74://     context-complaints, route-decisions) byte-identical.
super-gsd\tools\context-bench\harness.cjs:1276:  // baseline contract (route-decisions.jsonl on this snapshot is absent;
super-gsd\tools\context-bench\harness.cjs:1604:  // would burn tokens and pollute route-decisions.jsonl, so we exercise
super-gsd\tools\memory-governance\lifecycle.cjs:1379:    path.join(planningRoot, 'metrics', 'route-decisions.jsonl'),
super-gsd\tools\context-bench\failure-injectors.cjs:18://                 route-decisions.jsonl, crit-backlog.jsonl) drift by zero
super-gsd\tools\context-bench\failure-injectors.cjs:145:    evidence_path: '.planning/metrics/route-decisions.jsonl',
super-gsd\tools\context-bench\failure-injectors.cjs:154:    evidence_path: '.planning/metrics/route-decisions.jsonl',
super-gsd\tools\context-bench\failure-injectors.cjs:311:  'route-decisions.jsonl',
super-gsd\tools\context-bench\replay.cjs:22://     route-decisions.jsonl with run_id `bench-post-${scenario_id}-${ts}`
super-gsd\tools\context-bench\replay.cjs:33://             row to route-decisions.jsonl via fs.appendFileSync (with a
super-gsd\tools\context-bench\replay.cjs:356:// witness via the route-decisions.jsonl row (see _writeWitnessRow). Here
super-gsd\tools\context-bench\replay.cjs:397:// .planning/metrics/route-decisions.jsonl. The row's run_id is
super-gsd\tools\context-bench\replay.cjs:416:    const file = path.join(dir, 'route-decisions.jsonl');
super-gsd\tools\context-bench\replay.cjs:442:// _hasWitnessRow: read route-decisions.jsonl tail and assert at least one
super-gsd\tools\context-bench\replay.cjs:449:    const file = path.join(planningDir, 'metrics', 'route-decisions.jsonl');
super-gsd\tools\context-bench\replay.cjs:570://                   witness row in route-decisions.jsonl.
super-gsd\tools\context-bench\replay.cjs:785:    // the bench run by the route-decisions witness (Step 6); the token
super-gsd\tools\context-bench\replay.cjs:807:    // Step 6 write witness row to route-decisions.jsonl. The run_id is
super-gsd\tools\feature-propagation\audit.cjs:613:    'route-decisions.jsonl',
super-gsd\tools\context-bench\scenarios\S1-v17-P32.json:12:    "goal": "Land an append-only .planning/metrics/route-decisions.jsonl ledger plus dispatch-router emitter so every routing decision is observable.",
super-gsd\tools\harness-evidence\distill.cjs:35:  'route-decisions.jsonl',
super-gsd\tools\scenario-suite\harness.cjs:147:  'route-decisions.jsonl',
super-gsd\tools\vtp-bridge\classify.cjs:17://   Phase 32 logRouteDecision -> route-decisions.jsonl. Phase 45 source
super-gsd\tools\vtp-bridge\classify.cjs:131:// route-decisions.jsonl decision.reason_codes.
super-gsd\tools\vtp-bridge\classify.cjs:711:  const routeDecPath = path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'route-decisions.jsonl');
super-gsd\tools\vtp-bridge\classify.cjs:948:        throw new Error('route-decisions.jsonl CHANGED');
.planning\milestones\HANDBOOK-FUTURE-IMPLEMENTATION-AUDIT.md:195:| 32 | Route Decision Ledger | Missing | no live `route-decisions.jsonl` hits outside proposal docs | Build only after deciding which route choices matter. |
.planning\milestones\HANDBOOK-FUTURE-ROADMAP.md:490:- New `.planning/metrics/route-decisions.jsonl`.
.planning\discussions\2026-04-26-mass-discuss.md:188:| **38.5 Force/skip override** | `--force-gates` and `--skip-gates` both require `--override-reason="..."`. Reason logged to `route-decisions.jsonl` with `boundary=gate_override`. Override without reason is rejected. |
.planning\milestones\v1.5\SUMMARY.md:45:- VTPE-01 research→planning boundary gate — `vtp-enrichment-gate.cjs` + `gates.yaml` row + SKILL.md Step 6.b.5 + `gsd-planner.md` files_to_read (artifact-theater prevention)
.planning\milestones\v1.4\phases\20-autonomous-handoff\20-RESEARCH.md:64:- **60s timeout is the Claude Code hard cap for Stop hooks.** The spawn itself must be fire-and-forget (background `&`) — do NOT wait for the child session to complete inside the Stop hook. Log spawn PID, exit 0.
.planning\milestones\v1.4\phases\20-autonomous-handoff\20-01-SUMMARY.md:12:  patterns: ["double-background fire-and-forget spawn", "node read-mutate-write config", "pid-$$ session fallback"]
.planning\milestones\v1.4\phases\20-autonomous-handoff\20-01-stop-hook-PLAN.md:246:# --- SPAWN (fire-and-forget; double-background to avoid 60s Stop hook timeout) ---
.planning\milestones\v1.4\phases\20-autonomous-handoff\20-01-stop-hook-PLAN.md:303:| Stop hook -> claude CLI | Spawn is fire-and-forget; spawn failure must not cascade to current session Stop flow |
.planning\milestones\v1.7\REQUIREMENTS.md:27:- [ ] **ROUTE-01** `.planning/metrics/route-decisions.jsonl` writer module with --self-test
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-VERIFICATION.md:25:| 1 | VTPE-01: vtp-enrichment-gate.cjs exists, self-tests pass, wired into orchestrator SKILL.md Step 6.b.5, planner reads VTP-ENRICHMENT.md | VERIFIED | File exists; `--self-test` exits 0 (18/18 tests); `grep '6.b.5' SKILL.md` hits; `grep 'VTP-ENRICHMENT' gsd-planner.md` hits; `grep 'vtp-enrichment' gates.yaml` hits |
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-VERIFICATION.md:42:| `super-gsd/skills/sgsd-orchestrate/SKILL.md` | Step 6.b.5 inserted between researcher and planner dispatch | VERIFIED | Literal `6.b.5` present |
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-VERIFICATION.md:57:| sgsd-orchestrate SKILL.md Step 6.b.5 | vtp-enrichment-gate.cjs | orchestrator dispatch | WIRED | Step 6.b.5 inserted; gate returns sub_agent_spec for dispatch |
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-VERIFICATION.md:86:| VTPE-01 | 21-01 | Research→Planning boundary enrichment gate | SATISFIED | gate.cjs + gates.yaml row + SKILL.md 6.b.5 + planner files_to_read |
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-SUMMARY.md:36:- `super-gsd/skills/sgsd-orchestrate/SKILL.md` Step 6.b.5 insertion
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-SUMMARY.md:48:- Degraded-mode bypass at Step 6.b.5 when vtp_available=false
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-RESEARCH.md:26:| VTPE-01 | Research→Planning enrichment gate | Insert Step 6.b.5 in orchestrator SKILL.md |
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-RESEARCH.md:47:| sgsd-orchestrate SKILL.md | `super-gsd/skills/sgsd-orchestrate/SKILL.md` | Insert Step 6.b.5 between Steps 6.b and 6.c |
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-RESEARCH.md:62:Step 6.b.5 — gates.shouldFire('vtp-enrichment') + config.vtp_enrichment.enabled?
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-RESEARCH.md:86:**Insert as Step 6.b.5** in sgsd-orchestrate SKILL.md, after Step 6.b fires and RESEARCH.md is confirmed written, before Step 6.c (planner dispatch). The SKILL.md Step 6 section uses lettered sub-rules (a/b/c/d/e/f/g/h) — insert between b and c.
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-RESEARCH.md:89:6.b.5 VTP ENRICHMENT GATE (VTPE-01)
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-RESEARCH.md:260:- `sgsd-orchestrate/SKILL.md` Steps 6.b/6.c — insertion point for Step 6.b.5 confirmed
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-PLAN-INDEX.md:27:| 21-01 | 21-01-gate-orchestrator-PLAN.md | VTPE-01 | T1+T2+T3 | — | vtp-enrichment-gate.cjs, gates.yaml row, SKILL.md Step 6.b.5, gsd-planner files_to_read |
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-PLAN-INDEX.md:65:| RESEARCH A1 | Gate as sub-agent (MCP tool scope) | 21-01-T3 | COVERED (Step 6.b.5 dispatches sub-agent) |
.planning\milestones\v2.4\phases\75-live-event-writer-integration\75-RESEARCH.md:14:- Phase 47 route-decisions JSONL ledger emit pattern
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-CONTEXT.md:160:- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — contains Step 6.b (research dispatch) + Step 6.c (planner dispatch). VTPE-01 inserts new gate BETWEEN them as Step 6.b.5 or similar.
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-ATC-REVIEW.md:52:1. **Sub-agent dispatch missing**: Step 6.b.5 gate invocation in SKILL.md may reference an agent type (e.g. `sgsd-vtp-enrichment`) that doesn't exist as an agent file — reproduces 21-01 per-dispatch "missing agent" finding.
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-ATC-REVIEW.md:78:1. **`fix now`** — investigate the 2 CRITs (likely in vtp-enrichment-gate.cjs dispatch pattern + SKILL.md Step 6.b.5 agent name), ship surgical fix commits, re-run phase-level ATC until CRIT=0
.planning\milestones\v1.7\phases\35-generated-system-map\35-RESEARCH.md:284:  **Partially stale**: misses `route-decisions.jsonl` (Phase 32),
.planning\milestones\v1.7\phases\35-generated-system-map\35-CONTEXT.md:63:       route-decisions, crit-backlog, codex-log, etc.)
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-03-SUMMARY.md:56:Extended `sgsd-orchestrate/SKILL.md` Step 3 with new sub-step 3.7: when `config.vtp_enrichment.enabled === true`, ping VTP once at session start, cache result as `vtp_available`. Appends to `.planning/metrics/vtp-health.jsonl` per boot. Updated Step 6.b.5 to read `vtp_available` before dispatching `sgsd-vtp-enrichment`: if `false`, skip gate silently, log deviation, continue to Step 6.c (D-08 degraded mode). Non-blocking: when `enabled=false`, probe is skipped entirely.
.planning\milestones\v1.7\phases\35-generated-system-map\35-01-generated-system-map-PLAN.md:78:from Phase 31, route-decisions ledger from Phase 32, repair fields from Phase
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-03-config-empty-hit-PLAN.md:90:      Step 6.b.5 reads cached vtp_available before dispatching sgsd-vtp-enrichment sub-agent:
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-03-config-empty-hit-PLAN.md:93:      Caching VTP health at cold-start (Step 3) and checking it in Step 6.b.5 prevents
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-03-config-empty-hit-PLAN.md:98:      the degraded mode path in Step 6.b.5 is absent (not checking vtp_available cache before
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-03-config-empty-hit-PLAN.md:125:- super-gsd/skills/sgsd-orchestrate/SKILL.md (Step 3 cold-start + Step 6.b.5 from 21-01)
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-SUMMARY.md:15:    - sgsd-orchestrate Step 6.b.5 (VTP enrichment gate dispatch)
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-SUMMARY.md:50:VTPE-01 end-to-end: vtp-enrichment-gate.cjs sibling module + gates.yaml vtp-enrichment row (step 6.15) + sgsd-orchestrate Step 6.b.5 + gsd-planner VTP-ENRICHMENT.md consumption (artifact-theater prevention live).
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-SUMMARY.md:58:| T3 | Step 6.b.5 + planner files_to_read | af9dccd | sgsd-orchestrate/SKILL.md, gsd-planner.md (modified) |
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-SUMMARY.md:84:### T3: Step 6.b.5 + planner files_to_read (artifact-theater prevention)
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-SUMMARY.md:88:(a) `sgsd-orchestrate/SKILL.md`: Step 6.b.5 inserted between Steps 6.b (researcher dispatch) and 6.c (planner dispatch). Covers all three escalation paths: api_error=BLOCKER+EXIT, empty_hit=write+continue, success=write+continue. Config absent/disabled=skip silently (D-07).
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-SUMMARY.md:102:**2. [Rule 1 - Bug] Step 6.b.5 label not matching stop_rule grep pattern**
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-SUMMARY.md:104:- Issue: Initial insertion used `b.5 Phase has...` (sub-rule notation without explicit `6.b.5` string); `grep -q '6.b.5'` stop_rule failed.
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-SUMMARY.md:105:- Fix: Updated label to `b.5 VTP ENRICHMENT GATE (Step 6.b.5)` so the literal string `6.b.5` appears in the file.
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-SUMMARY.md:122:| T3 SKILL.md | `s.includes('6.b.5')` | PASS |
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-SUMMARY.md:140:- `super-gsd/skills/sgsd-orchestrate/SKILL.md` Step 6.b.5: FOUND
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-gate-orchestrator-PLAN.md:77:      (planner dispatch) — insertion point for Step 6.b.5 confirmed (21-RESEARCH.md §Primary Sources);
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-gate-orchestrator-PLAN.md:78:      21-RESEARCH.md §Pattern 1 (verbatim Step 6.b.5 pseudocode block);
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-gate-orchestrator-PLAN.md:83:      sgsd-orchestrate/SKILL.md: new Step 6.b.5 inserted between Steps 6.b and 6.c.
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-gate-orchestrator-PLAN.md:84:      Step 6.b.5 checks config.vtp_enrichment.enabled; if true dispatches sgsd-vtp-enrichment
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-gate-orchestrator-PLAN.md:91:      Inserting Step 6.b.5 in the orchestrate SKILL.md and patching planner prompt composition
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-gate-orchestrator-PLAN.md:95:      grep -q '6.b.5' super-gsd/skills/sgsd-orchestrate/SKILL.md exits non-zero, OR
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-gate-orchestrator-PLAN.md:99:      grep -q '6.b.5' super-gsd/skills/sgsd-orchestrate/SKILL.md exits 0 AND
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-gate-orchestrator-PLAN.md:101:    verification_cmd: "grep -q '6.b.5' super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q 'VTP-ENRICHMENT' custom-gsd-extract/claude-agents/gsd-planner.md && echo PASS"
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-gate-orchestrator-PLAN.md:109:Step 6.b.5 into the orchestrator SKILL.md with artifact-theater prevention in gsd-planner prompt.
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-gate-orchestrator-PLAN.md:138:grep -q '6.b.5' super-gsd/skills/sgsd-orchestrate/SKILL.md
.planning\milestones\v1.7\EXISTING-SURFACE-AUDIT.md:51:| 32 | `route-decisions.jsonl` + lib (NEW metric stream, boundary-only) | existing JSONL streams |
.planning\milestones\v2.1\phases\61-public-docs-refresh\61-RESEARCH.md:62:  (NOT mixed into route-decisions.jsonl).
.planning\milestones\v2.1\phases\61-public-docs-refresh\61-01-public-docs-refresh-PLAN.md:38:    falsifier: If a first-time reader cannot tell from the first 30 lines of README which audience they belong to, the preamble is inadequate.
.planning\milestones\v2.4\phases\74-orchestrator-live-event-contract\74-RESEARCH.md:14:- Phase 47 route-decisions.jsonl — JSONL append-only pattern source
.planning\milestones\v1.9\CONTEXT-BENCH-RESULTS.md:68:The anti-cheat boundary asserts that the workspace handed to the post-mode dispatch is clean of all 6 forbidden anti-cheat strings (`benchmark`, `score_weight`, `expected_failure`, `oracle`, `anti_cheat_signal`, `this_is_a_test`) and 3 secret-prefix paranoia tokens (`AKIA`, `sk-`, `ghp_`) before the dispatch is permitted. The post-dispatch witness row in `.planning/metrics/route-decisions.jsonl` (run_id prefix `bench-post-{scenario_id}-`) is the unforgeable proof that the dispatch was real.
.planning\milestones\v1.9\CONTEXT-BENCH-RESULTS.md:80:- Route decisions: `.planning/metrics/route-decisions.jsonl` (Phase 47, bench witnesses)
.planning\milestones\v1.7\phases\32-route-decision-ledger\PHASE-CAPSULE.json:7:  "goal": "Land an append-only `.planning/metrics/route-decisions.jsonl` ledger plus",
.planning\milestones\v1.9\SUMMARY.md:46:Phase 51 ships the harness that proves the milestone actually delivered. Verdict tree handles all 4 states (PASS / PASS-WITH-DEFERRED-N / 'ledger-only — incomplete' / FAIL). Median (not mean — Pitfall 2) aggregator across 6 baseline scenarios. Evidence retention via Lock-11 byte-equality on (kind, ref) tuples. Anti-cheat: workspace-clean assertion + unforgeable bench-post-{scenario_id}-{ts} run_id witness in route-decisions.jsonl. claude-CLI-absent path soft-downgrades to 'ledger-only — incomplete' — never silently passes the 50% bar.
.planning\milestones\v1.9\SUMMARY.md:83:- `.planning/metrics/route-decisions.jsonl` (Phase 47)
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-VERIFICATION.md:16:> Land an append-only `.planning/metrics/route-decisions.jsonl` ledger plus a writer module (`route-ledger.cjs`) that every orchestrator routing decision can log to. Phase 32 SHIPS one production caller (codex_route boundary) -- the 5 remaining boundary types are pre-declared in the schema but wired later (no schema-without-consumer violation: codex_route IS the consumer).
.planning\milestones\v1.8\REQUIREMENTS.md:38:- [ ] **SAMPLE-04** `--force-gates X --override-reason "..."` logs to route-decisions.jsonl with `boundary=gate_override`
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-RESEARCH.md:14:- **ROUTE-01:** `.planning/metrics/route-decisions.jsonl` writer module with `--self-test`.
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-RESEARCH.md:38:- A renderer for `route-decisions.jsonl` (no `.md` view in v1.7).
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-RESEARCH.md:90:| Append-only persistence | Filesystem JSONL (`.planning/metrics/route-decisions.jsonl`) | Same contract as crit-backlog.jsonl, edge-guard-log.jsonl, codex-log.jsonl |
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-RESEARCH.md:193:4. Phase 34 review-ledger reads envelope rows; route-decisions feed it with no adapter.
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-RESEARCH.md:244:| `next_action` | optional | envelope-v1 | usually null for route-decisions |
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-RESEARCH.md:315:    `fs.existsSync('.planning/metrics/route-decisions.jsonl')` unchanged at end (capture
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-RESEARCH.md:326:produces a row in `route-decisions.jsonl` with `boundary=codex_route` and non-empty
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-RESEARCH.md:519:row written. Acceptable — route-decisions is observability, not consensus. A missed log is
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-RESEARCH.md:549:| 9.5 | Renderer (`route-decisions.md`)? | **No** | Feeds cockpit + Phase 34, not operator directly |
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-RESEARCH.md:556:| 9.12 | JSONL location? | **`.planning/metrics/route-decisions.jsonl`** | Per ROUTE-01 verbatim |
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-RESEARCH.md:745:| crit-backlog as the only structured stream | envelope-v1 wraps multiple streams | Phase 31 | route-decisions inherits the contract |
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-RESEARCH.md:746:| route-decisions filename only in DISCUSS Phase 38 (`gate_override`) | route-decisions defined in Phase 32 | THIS phase | First time the file is canonical |
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-RESEARCH.md:747:| `codex-log.jsonl` as only routing-decision evidence | `route-decisions.jsonl` is canonical route-decision stream; `codex-log.jsonl` keeps recording shell-wrapper telemetry | THIS phase | Cockpit reads route-decisions for routing signal; codex-log for shell-runtime signal |
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-ATC-REVIEW.md:45:- Fix: anchored to `__dirname` instead. Lib lives at `<repo>/super-gsd/scripts/lib/route-ledger.cjs`; canonical at `<repo>/.planning/metrics/route-decisions.jsonl`; 3-dirs-up + .planning resolves consistently regardless of invocation cwd.
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-CONTEXT.md:15:Land an append-only `.planning/metrics/route-decisions.jsonl` ledger plus
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-CONTEXT.md:71:     route-decisions.jsonl row matches the expected envelope shape
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-01-route-ledger-PLAN.md:28:    - "self-test isolated to os.tmpdir() -- never touches canonical .planning/metrics/route-decisions.jsonl"
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-01-route-ledger-PLAN.md:41:`.planning/metrics/route-decisions.jsonl` stream + a writer module
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-01-route-ledger-PLAN.md:141:      - Self-test never touches canonical .planning/metrics/route-decisions.jsonl
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-01-route-ledger-PLAN.md:186:// Source of truth: .planning/metrics/route-decisions.jsonl (machine-readable)
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-01-route-ledger-PLAN.md:257:  return path.join(planningDir, 'metrics', 'route-decisions.jsonl');
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-01-route-ledger-PLAN.md:440:  const realLedger = path.join(process.cwd(), '.planning', 'metrics', 'route-decisions.jsonl');
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-01-route-ledger-PLAN.md:542:    // 12. Self-test never touches canonical .planning/metrics/route-decisions.jsonl.
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-01-route-ledger-PLAN.md:847:5. Do NOT add a renderer (route-decisions.md). 32-RESEARCH.md 9.5
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-01-route-ledger-PLAN.md:911:logCodexRoute and writes a real route-decisions.jsonl row with
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-01-route-ledger-PLAN.md:959:| route-ledger.cjs -> filesystem | fs.appendFileSync to .planning/metrics/route-decisions.jsonl |
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-01-route-ledger-PLAN.md:960:| route-decisions.jsonl -> downstream consumers | Phase 34 review-ledger / cockpit will tail-read; Phase 32 does not consume |
.planning\milestones\v1.7\phases\32-route-decision-ledger\32-01-route-ledger-PLAN.md:973:| T-32-08 | Spoofing | Forged route-decisions.jsonl row from outside the orchestrator | accept | local-FS attacker could write directly; out of scope for in-process telemetry; downstream consumers (Phase 34) handle integrity |
.planning\milestones\v1.8\MILESTONE-READINESS.md:81:| 2026-04-27T11:30:17Z | 36/38/39 | route-decisions.jsonl missing (non-blocking) | `test -f .planning/metrics/route-decisions.jsonl` → not found; route-ledger.cjs auto-creates via mkdirSync+appendFileSync at first write (verified in source) | INFO |
.planning\milestones\v1.8\MILESTONE-READINESS.md:117:- `route-decisions.jsonl` is missing but is not a blocker: `route-ledger.cjs` line 180 calls `mkdirSync({recursive:true})` + `appendFileSync` on first write. Phase 38 (sampling-decider) will auto-create it when it logs the first gate_override boundary.
.planning\milestones\v2.0\phases\57-release-readiness-score\57-CONTEXT.md:38:7. **routing_quality** (10 pts) — Phase 47 route-decisions.jsonl: hit rate + provider success
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\PHASE-CAPSULE.json:94:      "text": "\nVerbatim from `.planning/discussions/2026-04-26-mass-discuss.md:181-187`:\n- 38.1: 3 work-risk tiers (low/medium/high)\n- 38.2: 4 primary classifier inputs (diff_lines, files_touched_count,\n  phase_type, phase_includes_security_review)\n- 38.3: 1 secondary classifier input (gate_fitness_history; reads Phase 36)\n- 38.4: 13 gates each get gate_sampling_tier in {always, sampled-rate-50,\n  low-risk-skip}\n- 38.5: --force-gates X requires --override-reason \"...\"; logged to\n  route-decisions.jsonl with boundary=gate_override\n"
.planning\milestones\v2.0\phases\56-scenario-based-acceptance-suite\56-RESEARCH.md:84:context-complaints.jsonl, route-decisions.jsonl, crit-backlog.jsonl,
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\codex-review-prompt.txt:22:- SAMPLE-04: --force-gates X --override-reason "..." logs to route-decisions.jsonl boundary=gate_override (test fixture verified)
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\codex-review-prompt.txt:37:5. --force-gates CLI exits 1 without --override-reason; logs route-decisions.jsonl with boundary=gate_override on success
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-VERIFICATION.md:34:| SAMPLE-04 | PASS | fallback test fixture 4 confirms route-decisions.jsonl row with boundary='gate_override' |
.planning\milestones\v1.7\phases\31-canonical-envelope\31-RESEARCH.md:165:| `deliberation-outcomes` | `.planning/metrics/deliberation-outcomes.jsonl` | (deliberation outputs) | n/a | likely envelope-shape after Phase 32 route-decisions stabilizes vocabulary | candidate post-v1.7 |
.planning\milestones\v1.7\phases\31-canonical-envelope\31-RESEARCH.md:361:| Initial `reason_codes` set under-covers Phase 32 route-decisions or Phase 34 review-ledger needs | Defer — extend registry in those phases without envelope schema bump |
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-RESEARCH.md:24:SAMPLE-05). Override reasons land in `route-decisions.jsonl` via the Phase
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-RESEARCH.md:69:  `route-decisions.jsonl` with `boundary=gate_override`. Override
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-RESEARCH.md:111:| 38.5 | `--force-gates` and `--skip-gates` both require `--override-reason="..."`; logged to `route-decisions.jsonl` with `boundary=gate_override`; reason-less override rejected (exit 1) |
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-RESEARCH.md:421:"Phase 38 (sampling-decider) will auto-create [route-decisions.jsonl]
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-RESEARCH.md:558:`.planning/metrics/route-decisions.jsonl` BEFORE any work; create
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-RESEARCH.md:599:`.planning/metrics/route-decisions.jsonl` mtime + size unchanged.
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-RESEARCH.md:731:  `.planning/metrics/route-decisions.jsonl` untouched by self-test.
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-RESEARCH.md:764:- `.planning/milestones/v1.8/MILESTONE-READINESS.md:117` -- "Phase 38 will auto-create route-decisions.jsonl when it logs the first gate_override boundary"
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-CONTEXT.md:19:override-reason and log to route-decisions.jsonl with boundary=gate_override.
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-CONTEXT.md:31:  route-decisions.jsonl with boundary=gate_override
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-CONTEXT.md:84:  route-decisions.jsonl with boundary='gate_override'; --self-test
.planning\milestones\v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:993:     context-bench-runs, route-decisions) are git-tracked.
.planning\milestones\v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:1190:provider call) but the route-decisions.jsonl ledger is STILL written.
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:26:    stop_rule: "self-test 17/17 PASS; --force-gates X without reason exits 1; with reason logs route-decisions.jsonl row with boundary=gate_override."
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:61:`route-decisions.jsonl` via the Phase 32 route-ledger; this requires
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:232:    - --self-test runs all 17 assertions in tmpdir; canonical gates.yaml + route-decisions.jsonl mtime/size unchanged after run
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:437:   `.planning/metrics/route-decisions.jsonl` BEFORE any work; anchor
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:467:   - canonical `.planning/metrics/route-decisions.jsonl` mtime + size unchanged
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:519:    `.planning/metrics/route-decisions.jsonl` mtime/size unchanged.
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:728:    - --force-gates X --override-reason "...": logs route-decisions.jsonl row with boundary='gate_override'
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:748:     // --override-reason="..."; logged to route-decisions.jsonl with
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:761:     // Log one route-decisions.jsonl row per override (locked Q6).
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:962:    and 3.7. Each override gate logs one route-decisions.jsonl row with
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:1096:        description: "Operator-issued --force-gates / --skip-gates with --override-reason; logged to route-decisions.jsonl boundary=gate_override (Phase 38 SAMPLE-04)."
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:1134:    - Test simulates --force-gates with --override-reason via spawnSync; asserts route-decisions.jsonl row appended in tmpdir with boundary='gate_override'
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:1269:const ledger = path.join(planningDir, 'metrics', 'route-decisions.jsonl');
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:1275:assert('4. --force-gates appends route-decisions.jsonl row with boundary=gate_override',
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:1429:| T-38-03 | Repudiation | gate_override action without audit trail | mitigate | Every override logs to route-decisions.jsonl with boundary='gate_override', reason_codes=['gate_force_override_with_reason'], decision={gate, action, reason}; reason is mandatory (SAMPLE-05 hard rejection) |
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:1432:| T-38-06 | Elevation of Privilege | --force-gates bypasses CRIT gate | mitigate | Override is logged with mandatory reason; auditor (Phase 39 rubric) can detect operator-issued overrides via reason_codes=['gate_force_override_with_reason']; route-decisions.jsonl is append-only |
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:1521:   `.planning/metrics/route-decisions.jsonl` with
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:1535:   `.planning/metrics/route-decisions.jsonl` mtime/size unchanged.
.planning\milestones\v1.8\phases\38-risk-tiered-gate-sampling\38-01-risk-tiered-gate-sampling-PLAN.md:1568:  .planning/metrics/route-decisions.jsonl (auto-created on first
.planning\milestones\v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:111:      provides: "Append-only observability stream (envelope-v1 schema); one row per degraded event, rejection, invalidation, or self-test execution; mirrors Phase 41 envelope-v1 + ext fields. Q5 resolved git-TRACK (mirrors token-attribution/route-decisions discipline)."
.planning\milestones\v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:461:        - _testHook_simulateFlushAndPoison writes to canonical streams (agent-token-spend, route-decisions, context-bench-runs, etc.) - REDIS-LOCK-01 hard-stop.
.planning\milestones\v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:569:            - F1: when SGSD_REDIS_URL set + Redis reachable, run _testHook_simulateFlushAndPoison; assert post-flush getHotPacket returns reason='miss' AND .planning/metrics/redis-projection-log.jsonl gains rows containing all 3 expected_reason_codes from F17 contract; canonical .planning/ files (agent-token-spend.jsonl, context-packet-log.jsonl, route-decisions.jsonl, context-complaints.jsonl) byte-untouched (sha256 fingerprint pre/post equal). Soft-skip with reason='redis_not_available_soft_skip' when no Redis.
.planning\milestones\v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:755:- **Q5 (redis-projection-log.jsonl git-tracked?):** Resolved YES (Q5 RESEARCH-recommended TRACK). Mirrors token-attribution + route-decisions discipline (envelope-v1, append-only, useful in git history for debugging). Different from heartbeat.jsonl (gitignored) which emits per-second; projection log emits per-degradation only. The first row written by self-test is committed alongside the adapter for evidence symmetry.
.planning\milestones\v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:840:- [ ] Anti-pollution: canonical streams (agent-token-spend, context-packet-log, context-complaints, route-decisions, context-bench-runs) sha256+mtime+size identical pre/post `run-redis-self-test.cjs` invocation.
.planning\milestones\v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:856:6. Anti-pollution: redis-adapter writes ONLY to redis-projection-log.jsonl; canonical streams (agent-token-spend, context-packet-log, route-decisions, context-bench-runs, context-complaints) byte-untouched across self-test runs (sha256 fingerprint identical pre/post).
.planning\milestones\v1.8\phases\36-gate-value-telemetry\36-CONTEXT.md:112:  is gate-FITNESS data, route-decisions is gate-OUTPUT data).
.planning\milestones\v1.8\phases\39-gate-keep-kill\39-RESEARCH.md:512:| `__dirname` fingerprint guard | YES | YES | YES (W2 fix) | YES (gates.yaml + route-decisions.jsonl) | YES (4 canonicals) |
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-VERIFICATION.md:17:    - "Anti-cheat boundary: workspace clean of forbidden strings; route-decisions.jsonl run_id witness 'bench-post-{scenario_id}-' proves real dispatch"
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-VERIFICATION.md:33:The harness genuinely measures the falsifiable proof bar. `scoring.cjs::aggregateGate` computes the **median** (not mean — Pitfall 2 fix) `pct_reduction` across S1-S6 and gates PASS at `median >= 0.5 AND every retention == 1.0 AND every injection gate fired AND zero ledger-only scenarios`. `evidence_retention` is computed deterministically via byte-equality set-membership over the (kind, ref) tuple (Lock 11): `|expected ∩ post_artifacts| / |expected|`. The verdict tree routes correctly across all four states — verified by self-test 16 (PASS), 17 (evidence-dominance FAIL), `t6_ledger_only_verdict_when_tokens_after_null`, and `t6_pass_with_deferred_requires_injection_success`. The hybrid replay engine reads tokens_before from the existing 11,294-row Phase 41 ledger via `tokenAttr.summarize()` (import-by-reference, no fork), and produces tokens_after via real `claude --print` dispatch with anti-cheat boundary. The unforgeable witness is the `bench-post-{scenario_id}-{ts}` `run_id` substring match in `route-decisions.jsonl`. When claude CLI is absent, the harness gracefully degrades to ledger-only — incomplete, never silently passing the 50% bar. Falsifiable proof bar: MEASURABLE.
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-VERIFICATION.md:107:| replay.cjs | dispatch-router/route.cjs | route-decisions.jsonl run_id substring | WIRED (replay.cjs:413, 444) |
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:68:The single most important architectural insight from upstream contracts is this: **all five required upstream measurement signals already exist as canonical streams**. Phase 41 `summarize()` returns role+phase token totals with cache_read_ratio + useful_findings_per_100k. Phase 42 `runCheck()` returns budget verdicts. Phase 45 emits `context-packet-log.jsonl` with frozen 7-key `context_source_mix`. Phase 47 emits `route-decisions.jsonl` rows with 18-entry `ROUTE_DECISION_REASONS` enum (including `context_pressure_high`). Phase 49 emits `memory-{promotions,demotions,revocations,revalidations}.jsonl` plus `context-complaints.jsonl`. Phase 51 does **not** invent any new signals — it cross-correlates these existing streams against expected-evidence oracles per scenario. This means the harness is a **read-only consumer with a scoring oracle**, not a measurement-instrumentation phase.
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:83:| Read `route-decisions.jsonl` for `context_pressure_high` and degraded paths | Local Node script | Phase 47 emits | `ROUTE_DECISION_REASONS` 18-entry enum is the truth source |
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:331:| **F6** | VTP unavailable | Set env `SGSD_VTP_FORCE_OFFLINE=1` for S6 (architecture-challenge route) | Phase 47 router emits `provider_vtp_unavailable` route reason; falls back to claude per `routes.yaml:vtp_bridge` fallback_chain | `route-decisions.jsonl` row.decision.fallback_used = 'claude'; reason_codes contains `provider_vtp_unavailable` |
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:544:| Routing was orchestrator-internal | Phase 47 `route-decisions.jsonl` with 18-entry `ROUTE_DECISION_REASONS` enum + 9-entry `BOUNDARIES` | Phase 47 | Every routing decision is auditable + reverse-replayable |
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:714:| 18 | Canonical fingerprint guard: 4 source streams (`agent-token-spend.jsonl`, `context-packet-log.jsonl`, `context-complaints.jsonl`, `route-decisions.jsonl`) untouched by self-test | Mirror Phase 41 self-test 14 |
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:823:| `route-decisions.jsonl` | F6/F7 route-fallback verification | likely ✓ (writer ships at route-ledger.cjs) | v1.9 | F6/F7 soft-skip if absent |
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:956:- Existence of `route-decisions.jsonl` writer wire-in for F6/F7 (assumption); needs Wave 0 probe
.planning\milestones\v1.9\EXISTING-SURFACE-AUDIT.md:30:- `route-decisions.jsonl`
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-PLAN-CHECK.md:47:- NOTE: Self-test 11 (canonical fingerprint guard) lists 4 streams. route-decisions.jsonl does NOT yet exist on disk; when F1-F16 self-test runs, the fingerprint of a missing file is well-defined (sha256 of empty bytes / mtime=0). T4 should explicitly document the stream-doesnt-yet-exist baseline, otherwise self-test 11 may FAIL deterministically on first run.
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-PLAN-CHECK.md:53:- WARNING 1 (W1): Test 18 asserts route-decisions.jsonl gains rows with matching scenario_id. Phase 47 route.cjs row shape (verified by direct grep) does NOT include a scenario_id field; only run_id is the identifier. Recommendation: Test 18 must match by run_id_prefix=bench-post-{scenario_id}- substring (the unforgeable witness per T5 step 4), not by a literal scenario_id field. Otherwise this assertion will fail at execution.
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-PLAN-CHECK.md:93:- Test 18 (real-dispatch witness) is the correct anti-stub mechanism; asserts route-decisions.jsonl gains rows during --mode=full.
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-PLAN-CHECK.md:95:- claude CLI absent -> ledger-only -> no Sonnet dispatch -> route-decisions.jsonl also gains 0 rows. Test 18 must distinguish 0-rows-because-no-dispatch (ledger-only) from 0-rows-because-stubbed (a bug). Recommendation: Test 18 conditional on mode_used == full AND claudeBinary != null.
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-PLAN-CHECK.md:108:| super-gsd/tools/dispatch-router/route.cjs | T4, T5 | route-decisions row shape | exists, but does NOT include scenario_id field (W1) |
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-PLAN-CHECK.md:113:| .planning/metrics/route-decisions.jsonl | T5 (Test 18) | dispatch witness | does NOT yet exist on disk -> Phase 47 has not written first row, or writer not wired |
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-PLAN-CHECK.md:186:Test 18 asserts route-decisions.jsonl gains rows with matching scenario_id. Phase 47 does not write a scenario_id field. Fix: Match by run_id_prefix=bench-post-{scenario_id}- substring (the actual unforgeable witness). Update T5 output_contract step 5 to use run_id substring match.
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-PLAN-CHECK.md:203:When route-decisions.jsonl does not exist on disk yet, the canonical fingerprint guard (Test 11/18) must define the before hash as the fingerprint of an empty/absent file. Document this explicitly in T4.
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-ATC-REVIEW.md:93:| Run_id witness unforgeable | PASS — bench-post-{scenario_id}-{tsMillis} in route-decisions.jsonl |
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:61:    - "All 16 failure-injection fixtures (F1-F16) execute snapshot/inject/observe/restore in that order; canonical streams (agent-token-spend.jsonl, context-packet-log.jsonl, context-complaints.jsonl, route-decisions.jsonl, crit-backlog.jsonl) have identical mtime+size+sha256 before and after the full F1-F16 run (anti-pollution self-test 11)."
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:63:    - "Anti-cheat boundary holds: workspace asserted clean of strings 'benchmark', 'score_weight', 'expected_failure', 'oracle', 'anti_cheat_signal' before each post-Sonnet dispatch; Sonnet receives a normal task prompt; route-decisions.jsonl entries with run_id matching prefix 'bench-post-{scenario_id}-' prove the dispatch was real (anti-cheat self-test 4 + anti-cheat assertion 18)."
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:182:      pattern: "route-decisions\\.jsonl|routeDispatch"
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:368:          * F6 VTP unavailable: env SGSD_VTP_FORCE_OFFLINE=1 for S6; verify route-decisions.jsonl row.fallback_used='claude' + reason 'provider_vtp_unavailable'.
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:383:        - Test 11: All 16 injectors have working restore(); after running F1-F16 (snapshot+inject+restore each), agent-token-spend.jsonl/context-packet-log.jsonl/context-complaints.jsonl/route-decisions.jsonl mtime+size+sha256 unchanged (anti-pollution). Stream-doesnt-yet-exist baseline: when route-decisions.jsonl is absent on disk, the canonical fingerprint is well-defined as sha256(empty bytes) + mtime=0 + size=0; restore() must preserve that absent-file state.
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:399:        - Self-test 11 detects any drift in agent-token-spend.jsonl/context-packet-log.jsonl/context-complaints.jsonl/route-decisions.jsonl (anti-pollution failure).
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:416:        - super-gsd/tools/dispatch-router/route.cjs (route-decisions.jsonl row shape; row.run_id is the only identifier - NO scenario_id field)
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:425:          * Step 3 spawn `claude --print --dangerously-skip-permissions -p "<normal task prompt>"` mirroring blind-live-controller.mjs:104-138 verbatim. Prompt is a NORMAL task ("Research Phase {N} of {milestone} SGSD"), NEVER mentions benchmark/score/test/evaluation (Pitfall 6). The spawn uses run_id = `bench-post-${scenario.scenario_id}-${ts}` so the unforgeable witness lives in route-decisions.jsonl row.run_id (Phase 47 route.cjs writes run_id, NOT scenario_id - verified at route.cjs:77-130).
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:428:          * Step 6 verify dispatch was real: read .planning/metrics/route-decisions.jsonl tail and assert at least one row exists where row.run_id starts with the prefix `bench-post-${scenario.scenario_id}-` (substring match on run_id, NOT a scenario_id field - Phase 47 does not write scenario_id; row.run_id is the only identifier). Conditional: this assertion runs only when mode_used === 'full' AND claudeBinary != null; in --mode=ledger-only it is skipped (zero rows expected).
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:434:        - Test 18 (anti-cheat real-dispatch): when --mode=full runs (mode_used==='full' AND claudeBinary != null), route-decisions.jsonl gains >=1 row whose row.run_id starts with prefix `bench-post-${scenario.scenario_id}-`. Match is by run_id substring (the unforgeable witness Phase 47 actually writes), NOT by a scenario_id field (route.cjs does not emit scenario_id). If --mode=full ran but zero matching-prefix rows exist, the test FAILS (proves the dispatch was stubbed, not real). If mode_used==='ledger-only' the assertion is skipped (zero matching rows is expected).
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:439:      The hybrid replay (Lock R5) is the only way to prove "post-milestone researcher token spend < 50% of baseline" because (a) baseline ledger is real evidence already on disk (no rerun needed), (b) post-run REQUIRES real Sonnet inference against the new packet path - fixtures cannot prove a NEW model run produces fewer tokens than an OLD model run, (c) injection assertions (T4) are deterministic and fixture-driven so they don't need Sonnet. Anti-cheat boundary mirrors sgsd-blind-live-controller.mjs verbatim because that pattern already shipped and self-tested - inventing a new boundary risks introducing leaks. Token ceiling at 1.5M caps Sonnet cost (6 runs * ~50k each * 5x safety margin); claude CLI absence soft-downgrades to ledger-only because Phase 51 must emit a partial report rather than fail outright (Lock 13 + ASSUMPTION A2). Real-dispatch assertion (Test 18) is the ONLY way to prove the replay isn't being stubbed away - route-decisions.jsonl row.run_id substring match on prefix `bench-post-${scenario_id}-` is the unforgeable witness (Phase 47 route.cjs writes run_id but NOT a scenario_id field; matching by run_id substring is the schema-correct check). post_artifacts[] population from packet.metadata.consumed_capsule_decisions + packet.bypass_refs + packet.metadata.consumed_atc_findings is the deterministic, byte-equality-checkable source the T6 evidence_retention oracle requires; without this explicit population step the oracle defaults to 0.0 and every scenario hard-fails for the wrong reason.
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:446:        - --mode=full successfully runs but route-decisions.jsonl gains 0 rows whose run_id starts with prefix `bench-post-${scenario.scenario_id}-` (the dispatch was stubbed, not real - assertion 18 must catch this; the witness is run_id substring, NOT a scenario_id field).
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:447:        - Test 18 is implemented to look for a `scenario_id` field on route-decisions.jsonl rows (Phase 47 route.cjs does NOT write scenario_id; this would be a schema-mismatch bug that hard-fails every full-mode run for the wrong reason).
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:565:        - Final self-test assertion 18 (canonical fingerprint guard) covers all 4 source streams: agent-token-spend.jsonl, context-packet-log.jsonl, context-complaints.jsonl, route-decisions.jsonl (mirrors Phase 41 self-test 14).
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:662:// route-decisions.jsonl row shape (verified at route.cjs:77-130):
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:755:| Canonical streams not polluted by injection | RESEARCH §3.2; Pitfall 5 | T4 falsifier: self-test 11 hashes 4 source streams pre/post run; restore() must succeed for every F1-F16. Stream-doesnt-yet-exist baseline (route-decisions.jsonl absent on disk): canonical fingerprint = sha256(empty) + mtime=0 + size=0; restore() preserves absent state. |
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:802:- [ ] Test 18 (real-dispatch witness) when --mode=full ran: route-decisions.jsonl gains >=1 row whose row.run_id starts with prefix `bench-post-${scenario_id}-` (W1 fix; matches by run_id substring, NOT a scenario_id field which Phase 47 does not emit).
.planning\milestones\v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:818:7. Anti-cheat: workspace clean of forbidden strings before each Sonnet dispatch (Test 4); route-decisions.jsonl proves the dispatch was real, not stubbed - row.run_id substring match on prefix `bench-post-${scenario_id}-` (Test 18 real-dispatch; W1 fix).
.planning\milestones\v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:128:review-ledger (Phase 34), route-decisions (Phase 32 -- template only).
.planning\milestones\v1.9\phases\43-phase-capsule-contract\43-RESEARCH.md:698:- Append to canonical streams (agent-token-spend, crit-backlog, gate-value-log, review-ledger, codex-log, route-decisions).
.planning\milestones\v1.9\phases\43-phase-capsule-contract\43-RESEARCH.md:721:| `route-decisions.jsonl` | Phase 32 | NOT read (out of scope for capsule v1) |
.planning\milestones\v1.9\phases\42-token-budget-admission\42-RESEARCH.md:600:| `route-decisions.jsonl` | Phase 32 / Phase 47 future writer |
.planning\milestones\v1.9\phases\50-cockpit-research-dashboard\50-RESEARCH.md:129:│  .planning/metrics/route-decisions.jsonl ───────┤  Phase 47        │
.planning\milestones\v1.9\phases\50-cockpit-research-dashboard\50-RESEARCH.md:519:1. **Do we need a separate "dispatch-routing" sub-line in A1 (Phase 47 route-decisions.jsonl)?**
.planning\milestones\v1.9\phases\50-cockpit-research-dashboard\50-RESEARCH.md:521:   - What's unclear: Whether route-decisions deserves its own line or rolls into the source-mix display.
.planning\milestones\v1.9\phases\42-token-budget-admission\42-01-token-budget-admission-PLAN.md:483:   No `require('../route-decisions/...')`, no
.planning\milestones\v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:487:   The 6th stream `.planning/metrics/route-decisions.jsonl` (Phase 32) is
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-RESEARCH.md:142:| 3 | `dispatch-router-vtp-whitelist-violation` | `super-gsd/tools/dispatch-router/route.cjs` | Pass `uncertainty_type='deterministic_extraction'` and force `route_hint='vtp'` (synthetic input through `routeDispatch()`) | `spawnSync('node', [require.resolve('../dispatch-router/route.cjs'), '--route', JSON.stringify({uncertainty_type:'deterministic_extraction', route_hint:'vtp'})], {cwd:tmpdir})` | `provider_vtp_unavailable` OR `matched_uncertainty_type` (whitelist enforced; vtp NOT in routing table for non-whitelisted) [VERIFIED: route.cjs:175-179 VTP_WHITELIST] | `route-decisions.jsonl` (live), `crit-backlog.jsonl` (live) byte-equal pre/post |
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-RESEARCH.md:143:| 4 | `vtp-bridge-unavailable` | `super-gsd/tools/vtp-bridge/classify.cjs` | Set env `SGSD_VTP_FORCE_OFFLINE=1` for subprocess only | `spawnSync('node', [require.resolve('../vtp-bridge/classify.cjs'), '--bridge', '--uncertainty-type', 'architecture_challenge', '--query', 'fixture'], {cwd:tmpdir, env:{...process.env, SGSD_VTP_FORCE_OFFLINE:'1'}})` | `provider_vtp_unavailable` [VERIFIED: route.cjs:119; F6 fixture precedent at failure-injectors.cjs:144] | `route-decisions.jsonl` byte-equal; vtp-bridge-failures.jsonl row appended only in tmpdir mirror |
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-RESEARCH.md:148:| 9 | `route-ledger-truncated-stream` | `super-gsd/scripts/lib/route-ledger.cjs` | Append a partial-line write to tmpdir mirror of `route-decisions.jsonl` (e.g., `{"ts":"x","run_id":` without closing brace + newline) | `spawnSync('node', ['-e', 'const r=require("../../scripts/lib/route-ledger.cjs"); console.log(JSON.stringify(r.readRows ? r.readRows() : []))'], {cwd:tmpdir})` | `tail_skipped_partial_line` (inferred from `_readRows` JSON.parse-in-try pattern at memory-governance/lifecycle.cjs:188-200) OR row-count delta = 1 less than line-count, with all valid rows preserved | `route-decisions.jsonl` (live) byte-equal pre/post; tmpdir mirror's tail-skip is the entire test |
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-RESEARCH.md:167:    "route-decisions.jsonl",
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-RESEARCH.md:362:  'route-decisions.jsonl',
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-RESEARCH.md:461:**Pass criteria:** subprocess exit 0; route-decisions row in tmpdir mirror has `reason_codes` containing `provider_vtp_unavailable` AND `decision.fallback_used = 'claude'`.
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-RESEARCH.md:525:**Inject:** Append partial-line write to tmpdir mirror's `route-decisions.jsonl` (e.g., `{"ts":"x","run_id":` without closing brace). The reader uses `_readRows`-style line-by-line parse with try/catch per row.
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-RESEARCH.md:527:**Real-tool invocation:** `spawnSync('node', ['-e', 'const fs=require("fs"); const txt=fs.readFileSync(process.argv[1],"utf8"); const lines=txt.split("\\n"); let n=0; for(const l of lines){ if(!l) continue; try{ JSON.parse(l); n++; }catch(_){} } console.log(n)', tmpdir+'/.planning/metrics/route-decisions.jsonl'], {cwd:tmpdir})`.
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-RESEARCH.md:533:**Pass criteria:** subprocess exit 0 AND parsed-row-count = (lines-1) AND live `route-decisions.jsonl` byte-equal pre/post.
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-RESEARCH.md:627:  'route-decisions.jsonl',
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-RESEARCH.md:649:- `route-decisions.jsonl` <- scenarios 3, 4, 9
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-RESEARCH.md:662:  'route-decisions.jsonl',
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-CONTEXT.md:37:- Anti-pollution canonical fingerprint guard (5 streams: agent-token-spend, context-packet-log, context-complaints, route-decisions, crit-backlog)
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-CONTEXT.md:69:9. `route-ledger-truncated-stream` — partial-line write to route-decisions.jsonl; expect tail-skip + canonical preservation
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-01-gate-failure-injection-harness-PLAN.md:144:      provides: "Scenario 9 fixture: 5-10 valid envelope-v1 route-decisions rows + a partial-line tail (truncated mid-JSON, no closing brace, no newline). Harness seeds tmpdir mirror with valid rows then appends partial-line.txt."
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-01-gate-failure-injection-harness-PLAN.md:182:      via: "spawnSync with env overrides {SGSD_VTP_FORCE_OFFLINE:'1'}; expects route-decisions row with reason_codes ⊇ ['provider_vtp_unavailable'] AND fallback_used:'claude'."
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-01-gate-failure-injection-harness-PLAN.md:207:      via: "spawnSync via node -e wrapper that reads tmpdir mirror's route-decisions.jsonl line-by-line with try/catch JSON.parse (mirrors lifecycle.cjs:188-200 _readRows pattern); reports row-count delta = lines-1; live route-decisions.jsonl byte-untouched."
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-01-gate-failure-injection-harness-PLAN.md:208:      pattern: "spawnSync.*route-ledger|route-decisions\\.jsonl"
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-01-gate-failure-injection-harness-PLAN.md:463:          - observe: read tmpdir/.planning/metrics/route-decisions.jsonl; expect row.reason_codes ⊇ ['provider_vtp_unavailable'] AND row.fallback_used==='claude'.
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-01-gate-failure-injection-harness-PLAN.md:534:        * fixtures/route-ledger-truncated-stream/README.md (1-paragraph; expected: row-count delta = lines-1 with valid rows preserved; live route-decisions.jsonl byte-untouched).
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-01-gate-failure-injection-harness-PLAN.md:550:          - inject: copy valid-rows.jsonl to tmpdir/.planning/metrics/route-decisions.jsonl + append partial-line.txt content (NO trailing newline added).
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-01-gate-failure-injection-harness-PLAN.md:551:          - spawn: _spawnTool with node -e wrapper: `const fs=require('fs');const txt=fs.readFileSync(process.argv[1],'utf8');const lines=txt.split('\\n');let n=0;for(const l of lines){if(!l)continue;try{JSON.parse(l);n++;}catch(_){}};console.log(n)` argv: tmpdir route-decisions.jsonl path.
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-01-gate-failure-injection-harness-PLAN.md:553:          - verdict: PASS if exit_code===0 AND parsed-row-count === 5 AND canonical_state_preserved (live route-decisions.jsonl byte-equal).
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-01-gate-failure-injection-harness-PLAN.md:564:        * Test 19: scenario 9 returns verdict='PASS' with parsed-row-count === valid_row_count (5); live route-decisions.jsonl byte-equal pre/post.
.planning\milestones\v2.0\phases\53-gate-failure-injection-harness\53-01-gate-failure-injection-harness-PLAN.md:813:  'context-complaints.jsonl', 'route-decisions.jsonl', 'crit-backlog.jsonl',
.planning\milestones\v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:59:    - "Phase 49 is READ-ONLY against 9 v1.9 canonical metric streams (token-attribution, codex-log, agent-token-spend, activity-log, token-log, token-waste-status, crit-backlog, route-decisions, vtp-bridge-failures); READ-ONLY against Phase 41-48 .cjs source files; READ-ONLY against canonical phase-folder content (CONTEXT/RESEARCH/PLAN/VERIFICATION/ATC-REVIEW/reviews); F10 fixture fingerprint-asserts no drift on 30+ paths"
.planning\milestones\v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:811:    token-waste-status, crit-backlog, route-decisions, vtp-bridge-failures);
.planning\milestones\v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:1129:     token-waste-status.jsonl, crit-backlog.jsonl, route-decisions.jsonl,
.planning\milestones\v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:1518:    crit-backlog,route-decisions,vtp-bridge-failures}.jsonl` -> exit 0.
.planning\milestones\v1.9\phases\49-memory-governance-lifecycle\49-RESEARCH.md:11:Phase 49 ships the **memory governance kernel** that gates every durable memory-write in SGSD. v1.9 has built every input it consumes: Phase 43 owns the capsule schema and frozen `STATUS_VOCAB` + `BYPASS_KIND_VOCAB`; Phase 44 owns `validateOne(key,'phases')` for legal-key admission; Phase 45 owns `_assertValidatedThoughtProvenance({source_refs, root_source_hashes})` plus `.planning/metrics/context-complaints.jsonl` envelope-v1 (34 rows already emitted by Phases 43/45/46); Phase 46 owns the SQLite read-side `query()` with per-row registry filter; Phase 47 emits route-decisions with `boundary='dispatch_route'`; Phase 48 emits evidence packets with mandatory `source_refs[] + root_source_hashes[]` already shaped for promotion. Phase 49 is the **gate + lifecycle ledger + repair loop**, not new infrastructure.
.planning\milestones\v1.9\phases\49-memory-governance-lifecycle\49-RESEARCH.md:17:Critical to the no-canonical-replacement rule: Phase 49 owns **4 NEW canonical streams** (`memory-promotions.jsonl`, `memory-demotions.jsonl`, `memory-revocations.jsonl`, `memory-revalidations.jsonl`) plus **lifecycle field edits on existing PHASE-CAPSULE.json files** (additive — schema extended, no existing field renamed). Phase 49 is **READ-ONLY** against the 9 v1.9 canonical metric streams (token-attribution, codex-log, agent-token-spend, activity-log, token-log, token-waste-status, crit-backlog, route-decisions, vtp-bridge-failures), Phases 41-48 source files, and canonical phase-folder content.
.planning\milestones\v1.9\phases\49-memory-governance-lifecycle\49-RESEARCH.md:287:  crit-backlog.jsonl       route-decisions.jsonl    vtp-bridge-failures.jsonl
.planning\milestones\v1.9\phases\49-memory-governance-lifecycle\49-RESEARCH.md:1099:- 9 canonical metric streams: agent-token-spend.jsonl, token-attribution.jsonl, codex-log.jsonl, activity-log.jsonl, token-log.jsonl, token-waste-status.jsonl, crit-backlog.jsonl, route-decisions.jsonl, vtp-bridge-failures.jsonl
.planning\milestones\v1.9\phases\49-memory-governance-lifecycle\49-RESEARCH.md:1249:- Envelope-v1 ledger row shape: verified in route-decisions.jsonl (25511 rows), context-complaints.jsonl (34 rows), agent-token-spend.jsonl (sample)
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\reviews\47-REVIEW.md:74:**PASS** (post-fix). Phase 47 deliverables hold all critical invariants. Claude HIGH + MEDIUM addressed in-loop; Codex provider_unavailable per established precedent. Commit chain: `6f50d86` (route.cjs + routes.yaml + 15-assertion self-test) → `10334a7` (route-ledger BOUNDARIES 7→8) → `32a651b` (SKILL.md wire) → `1b33dec` (verifier audit) → `8c701a2` (HIGH+MEDIUM fix). Cross-phase contracts ready: Phase 48 will refine VTP packet assembly under the 3-entry whitelist; Phase 50 cockpit consumes route-decisions.jsonl with closed-enum reason validation; Phase 51 BENCH consumes for utility_per_token measurement.
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:11:Phase 47 adds the **router** that decides which executor (local-script | codex | claude | vtp) handles a given dispatch. v1.9 has built every upstream surface this router consumes: Phase 41 emits ROUTE_REASONS (R1-R5), Phase 42 emits route_hints[] in token-waste-status.jsonl, Phase 45 packet builder reserves an `opts.route_hint` slot at step 7, and Phase 32 already owns the `route-decisions.jsonl` ledger with a `BOUNDARIES` enum that includes `executor_choice`. All Phase 47 has to do is wire those signals into a deterministic decision function and log the verdict.
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:13:This is **not** a new ledger. The EXISTING-SURFACE-AUDIT (line 139) bans "another route-decision ledger." Phase 47 extends `route-decisions.jsonl` by introducing a new closed-enum boundary value (`dispatch_route`) and pushes envelope-v1 rows through the existing `route-ledger.cjs::logRouteDecision` API. The router itself ships as a new module `super-gsd/tools/dispatch-router/route.cjs` that is **separate from** `gates-registry.cjs::resolveReviewerProvider` because that function is narrowly scoped to gates with a `reviewer_provider` field; Phase 47 covers general dispatch (research, planning, execution, verification, AND review).
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:15:**Primary recommendation:** Ship `super-gsd/tools/dispatch-router/route.cjs` exporting `routeDispatch({task_kind, uncertainty_type, file_count, line_count, current_role_token_spend, codex_health, vtp_health})` -> `{provider, reason, fallback_chain, structural_signals, context_pressure}`. Frozen 6-entry `UNCERTAINTY_TYPES` enum drives the primary mapping. Health probes via `provider-health/check.cjs --provider codex --behavioral` (existing) and `vtp-health.jsonl` last-row read (existing Phase 32 surface). Log every decision to `route-decisions.jsonl` with `boundary='dispatch_route'`. Self-test fixtures: 8 cases covering 4 happy paths + codex fallback + vtp fallback + structural-precedence + context-pressure-override.
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:72:- Cockpit display of router state (Phase 50 COCKPIT-04 reads `route-decisions.jsonl` rows tagged `boundary='dispatch_route'`).
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:73:- `utility_per_token` scoring (Phase 51 BENCH-07 consumes `route-decisions.jsonl`).
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:107:| Decision ledger emit | route-ledger.cjs::logRouteDecision (EXISTING) | route-decisions.jsonl (EXISTING file) | EXISTING-SURFACE-AUDIT:139 forbids second ledger |
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:121:| `route-ledger.cjs` | super-gsd/scripts/lib/route-ledger.cjs | Append envelope-v1 rows to route-decisions.jsonl | Phase 32 owner; LOCK 13 binding (never throws); already imports STATUSES, BOUNDARIES |
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:142:| New `route-decisions-v2.jsonl` ledger | Extend `route-decisions.jsonl` with new boundary `dispatch_route` | EXISTING-SURFACE-AUDIT:139 explicitly forbids second ledger | extend chosen |
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:240:            route-decisions.jsonl
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:380:- **Inventing a second route ledger.** EXISTING-SURFACE-AUDIT:139. Use `route-decisions.jsonl` and add `dispatch_route` to BOUNDARIES.
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:413:**Warning signs:** route-decisions.jsonl shows long runs of `provider_codex_unavailable` with no codex-log self-test rows in between.
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:420:**Warning signs:** route-decisions.jsonl shows VTP routes for uncertainty_type='synthesis_judgment' or 'deterministic_extraction'.
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:427:**Warning signs:** Phase 41 R1 hint count keeps incrementing while route-decisions.jsonl shows claude routes for the same role+phase.
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:434:**Warning signs:** Phase 42 token-waste-status.jsonl shows degraded verdicts immediately after a route-decisions row chose claude despite high pressure.
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:441:**Warning signs:** route-decisions.jsonl rows with `status='fail'` and no follow-up dispatch_route within 5 minutes.
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:448:**Warning signs:** Two route-decisions rows for the same dispatch with conflicting provider values.
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:658:| Stored data | None — Phase 47 introduces no new persistent stores. route-decisions.jsonl is a Phase 32 stream (append-only). | none |
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:695:| `route-decisions.jsonl` boundary set frozen at 7 | Extended to 8 with `dispatch_route` | Phase 47 (this) | Preserves single-ledger contract (EXISTING-SURFACE-AUDIT:139) |
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:727:| Read-only invariant | self-test never touches canonical route-decisions.jsonl, codex-log.jsonl, vtp-health.jsonl, token-waste-status.jsonl | fingerprint guard | same | ❌ Wave 0 |
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:769:| Information disclosure via decision logging | I | route-decisions.jsonl decision payload contains task_kind/uncertainty_type/structural_signals — no credentials, no sensitive content. Bound: never log raw prompt content. |
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:797:| Decision row | .planning/metrics/route-decisions.jsonl | `route-ledger.cjs::logRouteDecision({boundary:'dispatch_route', ...})` | every routing decision logged |
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:1166:**Question:** What does the route-decisions row look like for `boundary='dispatch_route'`?
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:1298:| `--route` CLI mode | runs routeDispatch + writes route-decisions row | Wrapper around the JSON.stringify and process.stdout.write; never crashes the loop |
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:1312:- `.planning/metrics/route-decisions.jsonl` — additive (append-only via existing route-ledger.cjs)
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:1390:- `route-decisions.jsonl` filtered on `boundary='dispatch_route'`
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:1397:- `route-decisions.jsonl` rows for `utility_per_token` calculation:
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:1469:11. ✅ Decision ledger (§11) — boundary='dispatch_route' on existing route-decisions.jsonl
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:1471:13. ✅ Read-only invariant (§13) — only writes route-decisions.jsonl + 3-line edit to route-ledger.cjs
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:1486:- **EXISTING-SURFACE-AUDIT.md:139** — "Do not create another route-decision ledger." Phase 47 extends `route-decisions.jsonl` via boundary expansion, never creates a sibling ledger.
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-VERIFICATION.md:28:| A3 | MCP failures logged separately | VERIFIED | `_logVtpBridgeFailure` writes to `.planning/metrics/vtp-bridge-failures.jsonl` (separate from `route-decisions.jsonl`); file absent only because no failure has occurred yet (lazy-create) |
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:11:Phase 48 ships the **bridge** that consumes Phase 47's `{provider:'vtp'}` decision and actually CALLS one of the VTP MCP tools, returning a compact, source-backed evidence packet to the caller. v1.9 has built every input this bridge needs: Phase 47 already emits the route decision (with frozen 3-entry `VTP_WHITELIST`), Phase 45 step 7 reserves an `opts.route_hint.use_vtp` slot in `context-packet/build.cjs:707`, Phase 32 owns the route-decisions ledger with `BOUNDARIES` already extended to 8 entries (Phase 47 added `dispatch_route`), and the `mcp__vtp-kb__*` MCP tool family is the operational substrate. Phase 48 is the **wiring + classifier + failure-isolator**, not a new infrastructure layer.
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:78:- Cockpit display of VTP bridge state (Phase 50 reads `vtp-bridge-failures.jsonl` + `route-decisions.jsonl rows where boundary='vtp_bridge'`).
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:115:| Append vtp_bridge route decision row | route-ledger.cjs::logRouteDecision (EXISTING) | route-decisions.jsonl (EXISTING file) | EXISTING-SURFACE-AUDIT:139 — extend boundary, not ledger |
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:123:**The `sgsd-vtp-enrichment` agent at `super-gsd/agents/sgsd-vtp-enrichment.md` is a SEPARATE concern.** That agent fires at Step 6.b.5 between gsd-phase-researcher and gsd-planner for OPTIONAL enrichment of phase RESEARCH.md (gated by `config.vtp_enrichment.enabled`). Phase 48's bridge is the GENERAL-PURPOSE selective VTP caller used during dispatch routing. Both coexist; Phase 48 does not replace the enrichment agent. The enrichment agent runs the 5-tool cascade for a different purpose (broad VTP enrichment of researcher findings); Phase 48 runs ONE targeted tool call per dispatch (selective).
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:133:| `route-ledger.cjs` | super-gsd/scripts/lib/route-ledger.cjs | Append envelope-v1 rows to route-decisions.jsonl with `boundary='vtp_bridge'` | Phase 32 owner; Phase 47 already extended to 8 boundaries; LOCK 13 binding (never throws) |
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:174:| New `vtp-bridge-failures.jsonl` | Append failures to `route-decisions.jsonl` with `status='fail'` | Already done (Phase 48 emits both rows) — but route-decisions is a DECISION ledger; bridge call FAILURES need their own row with tool/error_type/error_message detail | BOTH chosen (decision row + failure row; differentiated by `command` field) |
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:300:                │ route-decisions.jsonl via        │
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:496:// Source: dispatch-router/route.cjs internal pattern (route-decisions emission)
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:532:- **Inventing a second route ledger.** EXISTING-SURFACE-AUDIT:139. Use route-decisions.jsonl with `boundary='vtp_bridge'`. (`vtp-bridge-failures.jsonl` is a NEW failure stream, not a route ledger.)
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:581:**Warning signs:** route-decisions.jsonl rows with `boundary='vtp_bridge'` AND `decision.uncertainty_type` not in `['architecture_challenge','prior_memory_lookup','book_lookup']`.
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:902:   - What we know: Phase 50 reads `route-decisions.jsonl` (rows where `boundary='vtp_bridge'`) and the new `vtp-bridge-failures.jsonl`. Both stay simple.
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:1010:- `super-gsd/skills/sgsd-orchestrate/SKILL.md:473-498` — Step 6.b.5 sgsd-vtp-enrichment dispatch (separate from Phase 48 bridge)
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:1044:- `.planning/metrics/route-decisions.jsonl` rows where `boundary='vtp_bridge'` — successful bridge calls
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:1063:- `route-decisions.jsonl` rows where `boundary='vtp_bridge'` → success rate, average packet size
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:1100:| F10 | Read-only invariant: snapshot `.planning/metrics/codex-log.jsonl`, `route-decisions.jsonl` size+mtime BEFORE self-test; assert UNCHANGED after self-test (only `vtp-bridge-failures.jsonl` in tmpdir written, never canonical streams) | Lock 4 read-only |
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-01-dispatch-routing-substitution-PLAN.md:88:Phase 47 ships THE ROUTER: a single deterministic decision function that decides which executor (local-script | codex | claude | vtp) handles a given dispatch. v1.9 has built every input the router consumes (Phase 41 PROVIDERS + ROUTE_REASONS, Phase 42 BUDGETS + route_hints[], Phase 32 route-decisions.jsonl + envelope-v1, Phase 14 codex-log.jsonl self-test rows + providers-registry). All Phase 47 has to do is wire those signals into one frozen-enum decision function, log every decision via the EXISTING route-ledger surface (NEW boundary value `dispatch_route`, NOT a new ledger), and add a single SKILL.md wire so the orchestrator consults the router before any Agent dispatch.
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-01-dispatch-routing-substitution-PLAN.md:243:    - 12 Read-only fingerprint guard: capture mtime+size of all 8 canonical paths BEFORE self-test (route-decisions.jsonl, codex-log.jsonl, vtp-health.jsonl, token-waste-status.jsonl, agent-token-spend.jsonl, token-attribution.jsonl, super-gsd/tools/token-waste/budgets.yaml, super-gsd/registry/review-providers.yaml). After self-test, assert UNCHANGED. Anchor paths via __dirname-relative resolve so the guard works from any cwd. (Mirror pattern: route-ledger.cjs:306, token-waste/check.cjs:1203-1226.)
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-01-dispatch-routing-substitution-PLAN.md:432:    409-415. The new assertion 14 must NOT touch the canonical .planning/metrics/route-decisions.jsonl
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-01-dispatch-routing-substitution-PLAN.md:573:      and writes a single envelope row to route-decisions.jsonl with boundary='dispatch_route'."
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-01-dispatch-routing-substitution-PLAN.md:640:| router -> route-decisions.jsonl | router NEVER writes directly. Caller (orchestrator) emits via existing route-ledger.cjs::logRouteDecision public API after routeDispatch returns. |
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-01-dispatch-routing-substitution-PLAN.md:648:| T-47-02 | T (Tampering) | tampered codex-log.jsonl rows (spoof healthy) | mitigate | Router treats log row as evidence with TTL (30 min); does NOT trust as authoritative re-probe. Re-probe is codex-exec.sh --self-test owned by codex provenance (Phase 14). Tamper window bounded by TTL + cockpit visibility of route-decisions rows. |
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-01-dispatch-routing-substitution-PLAN.md:650:| T-47-04 | I (Information disclosure) | route-decisions.jsonl decision payload | mitigate | Decision payload contains task_kind, uncertainty_type, structural_signals, context_pressure, health -- NO credentials, NO raw prompt content. Bound: structural_signals fields are integers; context_pressure fields are role+spend ratios. (Audit: router never logs input.role values that could carry user-content; role is a closed enum.) |
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-01-dispatch-routing-substitution-PLAN.md:693:- `git diff --quiet -- .planning/metrics/agent-token-spend.jsonl .planning/metrics/token-attribution.jsonl .planning/metrics/codex-log.jsonl .planning/metrics/token-waste-status.jsonl .planning/metrics/vtp-health.jsonl .planning/metrics/route-decisions.jsonl super-gsd/registry/review-providers.yaml super-gsd/tools/token-waste/budgets.yaml super-gsd/scripts/lib/providers-registry.cjs super-gsd/scripts/lib/gates-registry.cjs super-gsd/tools/token-waste/check.cjs super-gsd/tools/token-attribution/report.cjs` -> exit 0 (no drift).
.planning\milestones\v1.9\phases\47-dispatch-routing-substitution\47-01-dispatch-routing-substitution-PLAN.md:722:13. EXISTING-SURFACE-AUDIT:139 honored: zero new ledgers; only the closed-enum BOUNDARIES extension and the existing route-decisions.jsonl additive append.
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:43:    - "every bridge call also emits ONE envelope-v1 row to route-decisions.jsonl with boundary='vtp_bridge' via Phase 32 logRouteDecision (no new ledger; EXISTING-SURFACE-AUDIT:139)"
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:278:| CONTEXT D-implicit (depends_on:[45,47], unblocks:[49,51]) | 48-CONTEXT.md L5-6 | T1 imports Phase 47 by reference; T3 wires forward-only contracts to 49/51 (failure-log + route-decisions consumer) | T1, T3 |
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:279:| Forward contract -- Phase 49 reads vtp-bridge-failures.jsonl + route-decisions.jsonl boundary='vtp_bridge' | 48-RESEARCH.md L1042-1050 | T1 produces both streams; no Phase 49 coupling beyond shape | T1 |
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:371:    Assertion 10 (F10 -- read-only canonical streams invariant): snapshot size+mtime of `.planning/metrics/codex-log.jsonl`, `.planning/metrics/route-decisions.jsonl`, `.planning/metrics/vtp-health.jsonl` BEFORE self-test; run self-test (which uses fixture-scoped tmpdir for vtp-bridge-failures.jsonl); assert all three canonical streams UNCHANGED.
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:409:       evidence_packet.reason_codes and route-decisions decision.reason_codes:
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:503:       `.planning/metrics/route-decisions.jsonl`, `.planning/metrics/vtp-health.jsonl`.
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:556:     - Confirm `.planning/metrics/codex-log.jsonl`, `route-decisions.jsonl`,
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:591:    `metrics/route-decisions.jsonl` (already its pattern); canonical .planning
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:624:          const lines = fs.readFileSync(path.join(tmpDir, 'metrics', 'route-decisions.jsonl'), 'utf8').trim().split('\n');
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:730:   BEFORE the Agent dispatch call. Format (mirror existing Step 6.b.5
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:783:     `.planning/metrics/route-decisions.jsonl` (boundary='vtp_bridge',
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:792:   **Coexistence with `sgsd-vtp-enrichment` agent (Step 6.b.5).** The two are
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:794:   - Step 6.b.5 (sgsd-vtp-enrichment): per-PHASE enrichment between researcher
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:859:| selectiveVTPCall -> Phase 32 logRouteDecision -> route-decisions.jsonl | Append-only via existing trusted ledger surface; envelope-v1 schema enforced; closed-enum boundary |
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:869:| T-48-04 | Repudiation | Bridge call succeeds but no record of evidence provenance for later audit | mitigate | Every success/failure call emits TWO canonical rows: (a) `vtp-bridge-failures.jsonl` row on failure ONLY, (b) `route-decisions.jsonl` envelope-v1 row on EVERY call (success and failure). Both include `run_id`, `ts`, `phase`, `milestone`, `decision.{tool, uncertainty_type, result_count, body_token_estimate, error_logged_at}`. |
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:875:| T-48-10 | Information Disclosure | Self-test inadvertently writes to canonical `.planning/metrics/route-decisions.jsonl` or `vtp-bridge-failures.jsonl` during CI runs, polluting production telemetry | mitigate | All self-test writes use `fs.mkdtempSync(os.tmpdir(), 'vtp-bridge-')` for isolated tmpdir. Self-test F10 fingerprints (size+mtime) of `.planning/metrics/codex-log.jsonl`, `route-decisions.jsonl`, `vtp-health.jsonl` BEFORE and AFTER self-test and asserts UNCHANGED. F7 does the same for `super-gsd/tools/context-packet/build.cjs`, `super-gsd/tools/dispatch-router/route.cjs`, `super-gsd/scripts/lib/route-ledger.cjs`. |
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:980:8. Canonical `.planning/metrics/{codex-log,route-decisions,vtp-health}.jsonl`
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:1015:    `route-decisions.jsonl` rows where `boundary='vtp_bridge'`); no `require()`
.planning\milestones\v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:1027:  route-decisions.jsonl boundary='vtp_bridge' decision shape).
.planning\milestones\v2.9\ROADMAP.md:36:- `.planning/metrics/route-decisions.jsonl`
.planning\milestones\v2.9\REQUIREMENTS.md:20:- **AHE-EXP-04**: Existing logs must be reused where possible: activity-log, orchestrator-pulse, context-packet-log, route-decisions, token-attribution, failure-injection-log, controlled-actions-log, and blind live run reports.
.planning\milestones\v2.9\MILESTONE-READINESS.md:77:| 12 | `route-decisions.jsonl` readable | READABLE |
.planning\milestones\v2.9\phases\99-trajectory-evidence-corpus\99-VERIFICATION.md:31:Route logged: route-decisions.jsonl row, chosen_provider=claude,
.planning\milestones\v2.9\phases\99-trajectory-evidence-corpus\99-RESEARCH.md:17:  - .planning/metrics/route-decisions.jsonl
.planning\milestones\v2.9\phases\99-trajectory-evidence-corpus\99-CONTEXT.md:42:- `.planning/metrics/route-decisions.jsonl`
.planning\milestones\v2.9\phases\103-component-ablation-interference\103-VERIFICATION.md:41:Route logged: route-decisions.jsonl row, chosen_provider=claude,
.planning\milestones\v2.9\phases\105-release-gate-cockpit-integration\105-VERIFICATION.md:41:Route logged: route-decisions.jsonl row, chosen_provider=claude,
.planning\milestones\v3.5\phases\148-cross-model-triage\148-01-PLAN-RAW.md:1246:gate: Step 6.b.5
.planning\milestones\v3.5\phases\148-cross-model-triage\148-VTP-ENRICHMENT.md:4:gate: Step 6.b.5
.planning\milestones\v3.5\phases\145-codex-profile-control\145-01-PLAN-LOCKED.md:187:      Fix observed 2026-08-05 route-decisions row codex_report_write_lost: codex-exec.sh reached codex-review END exit=0 but died during post-run parse before REPORT_OUT and codex-log.jsonl writes.
.planning\milestones\v2.9\phases\102-harness-evolution-runner\102-VERIFICATION.md:46:Route logged: route-decisions.jsonl row, chosen_provider=claude,
.planning\milestones\v3.5\phases\146-session-governance-hooks\146-01-PLAN-REV2-RAW.md:1915:// Source of truth: .planning/metrics/route-decisions.jsonl (machine-readable)
.planning\milestones\v3.5\phases\146-session-governance-hooks\146-01-PLAN-REV2-RAW.md:2008:  return path.join(planningDir, 'metrics', 'route-decisions.jsonl');
.planning\milestones\v3.5\phases\145-codex-profile-control\145-01-SPEC-REVIEW.md:38:consecutive background-task kills (route-decisions row logged).
.planning\milestones\v2.9\phases\104-transfer-ood-benchmark\104-VERIFICATION.md:40:Route logged: route-decisions.jsonl row, chosen_provider=claude,
.planning\milestones\v2.9\phases\98-harness-component-substrate\98-VERIFICATION.md:32:Route logged: route-decisions.jsonl row, chosen_provider=claude,
.planning\milestones\v2.9\phases\101-attribution-rollback-gate\101-VERIFICATION.md:33:Route logged: route-decisions.jsonl row, chosen_provider=claude,
.planning\milestones\v3.5\phases\146-session-governance-hooks\146-01-PLAN-RAW.md:932:gate: Step 6.b.5
.planning\milestones\v3.5\phases\146-session-governance-hooks\146-01-PLAN-RAW.md:1385:      Fix observed 2026-08-05 route-decisions row codex_report_write_lost: codex-exec.sh reached codex-review END exit=0 but died during post-run parse before REPORT_OUT and codex-log.jsonl writes.
.planning\milestones\v3.5\phases\145-codex-profile-control\145-CODEX-PLAN-PROMPT.md:44:4. **Wrapper defect fix (observed 2026-08-05, route-decisions row
.planning\milestones\v2.9\phases\100-change-manifest-prediction-ledger\100-VERIFICATION.md:33:Route logged: route-decisions.jsonl row, chosen_provider=claude, reason=private_knowledge_required.
.planning\milestones\v2.9\phases\100-change-manifest-prediction-ledger\100-RESEARCH.md:58:- route-decisions row evidence array gets a second item:
.planning\milestones\v3.5\phases\147-commit-seam-gate\147-01-PLAN-RAW.md:1216:gate: Step 6.b.5
.planning\milestones\v3.5\phases\147-commit-seam-gate\147-01-PLAN-RAW.md:3810:super-gsd\tools\context-bench\BENCHMARK-REPORT.template.md:The anti-cheat boundary asserts that the workspace handed to the post-mode dispatch is clean of all 6 forbidden anti-cheat strings (`benchmark`, `score_weight`, `expected_failure`, `oracle`, `anti_cheat_signal`, `this_is_a_test`) and 3 secret-prefix paranoia tokens (`AKIA`, `sk-`, `ghp_`) before the dispatch is permitted. The post-dispatch witness row in `.planning/metrics/route-decisions.jsonl` (run_id prefix `bench-post-{scenario_id}-`) is the unforgeable proof that the dispatch was real.
.planning\milestones\v3.5\phases\147-commit-seam-gate\147-VTP-ENRICHMENT.md:4:gate: Step 6.b.5
.planning\milestones\v3.5\phases\146-session-governance-hooks\146-VTP-ENRICHMENT.md:4:gate: Step 6.b.5

 succeeded in 1022ms:
super-gsd\workflows\orchestrate-loop.md
super-gsd\templates\orchestrator-prompt-composer.md
super-gsd\scripts\lib\board-registry.test.cjs
super-gsd\scripts\lib\board-registry.cjs
super-gsd\registry\skill-routing.yaml
super-gsd\registry\session-governance-hooks.yaml
super-gsd\registry\review-providers.yaml
super-gsd\registry\rd-board-members.yaml
super-gsd\registry\hooks.yaml
super-gsd\registry\harness-components.yaml
super-gsd\registry\handover-contract-v2.yaml
super-gsd\registry\gates.yaml
super-gsd\registry\decisions.yaml
super-gsd\registry\command-envelope-v1.yaml
super-gsd\registry\codex-profiles.yaml
super-gsd\registry\cockpit-sources.yaml
super-gsd\registry\board-members.yaml
super-gsd\registry\agents.yaml
super-gsd\skills\sgsd-orchestrate\SKILL.md
super-gsd\scripts\sgsd-registry-sync.test.sh
super-gsd\scripts\sgsd-registry-sync.sh
super-gsd\scripts\lib\skill-routing-registry.cjs
super-gsd\scripts\lib\providers-registry.cjs
super-gsd\scripts\lib\orchestrator-live-writer.cjs
super-gsd\scripts\lib\orchestrator-live-reader.cjs
super-gsd\scripts\lib\orchestrator-hooks.cjs
super-gsd\scripts\lib\gates-registry.cjs
.planning\resource-registry\agents.jsonl
super-gsd\tools\context-registry\legal-keys.schema.json
super-gsd\tools\context-registry\legal-keys.json
super-gsd\tools\context-registry\check.cjs
super-gsd\tools\context-registry\build.test.cjs
super-gsd\tools\context-registry\build.cjs
super-gsd\tools\warp-mcp\fixtures\sgsd_watchdog_status\_synthetic_planning_alive\metrics\orchestrator-pulse.jsonl
.planning\briefs\2026-08-11-cross-pollination-handover.md
.planning\briefs\2026-08-11-cross-pollination-ANALYSIS.md
.planning\briefs\2026-08-04-orchestration-always-on-VTP-EVIDENCE.md
.planning\briefs\2026-04-21-orchestrator-contract.md
.planning\phases\03-orchestrator-engine\03-VERIFICATION.md
.planning\phases\03-orchestrator-engine\03-CONTEXT.md
.planning\phases\03-orchestrator-engine\03-03-SUMMARY.md
.planning\phases\03-orchestrator-engine\03-03-PLAN.md
.planning\phases\03-orchestrator-engine\03-02-SUMMARY.md
.planning\phases\03-orchestrator-engine\03-02-PLAN.md
.planning\phases\03-orchestrator-engine\03-01-SUMMARY.md
.planning\phases\03-orchestrator-engine\03-01-PLAN.md
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md
.planning\decisions\2026-08-11-cross-pollination-BOARD-MEMO.md
.planning\analyses\2026-08-05-always-on-orchestration-DESIGN.md
.planning\milestones\v1.3\phases\14-codex-cli-provider-substrate\14-02-provider-registry.md
.planning\memory\feedback_no_pii_in_repo.md
.planning\memory\workflow\feedback\feedback_narrate_between_tool_calls.md
.planning\memory\workflow\feedback\feedback_missing_context_auto_default.md
.planning\memory\workflow\feedback\feedback_browser_smoke_mandatory.md
.planning\memory\workflow\feedback\feedback_auto_fix_on_critical.md
.planning\memory\workflow\feedback\feedback_auto_fire_triage.md
.planning\memory\workflow\feedback\feedback_auto_advance_phase_stages.md
.planning\memory\workflow\feedback\feedback_auto_accept_recommendations.md
.planning\memory\workflow\feedback\feedback_vtp_search_layer_routing.md
.planning\memory\workflow\feedback\feedback_vtp_enriched_dispatch.md
.planning\memory\workflow\feedback\feedback_step9_downgrades_step8_verdict.md
.planning\memory\workflow\feedback\feedback_stale_mcp_process_diagnosis.md
.planning\memory\workflow\feedback\feedback_sgsd_rename_rule.md
.planning\memory\workflow\feedback\feedback_run_commands_directly.md
.planning\memory\workflow\feedback\feedback_playwright_atc_gate.md
.planning\memory\workflow\feedback\feedback_orphaned_dispatch_no_wait.md
.planning\memory\workflow\feedback\feedback_no_context_pauses.md
.planning\memory\workflow\feedback\feedback_never_head_settings.md
.planning\milestones\v1.2\phases\13-governance\plans\13-01-board-registry.md
.planning\milestones\v1.2\INTENT.md
.planning\memory\architecture\patterns\script-registry-patterns.md
.planning\memory\architecture\patterns\orchestrator-verification-discipline.md
.planning\memory\architecture\patterns\orchestrator-patterns.md
.planning\milestones\v1.2\phases\09-atc-147-evidence\plans\09-03-registry-and-intent.md
.planning\milestones\v3.5\INTENT.md
.planning\milestones\v1.5\phases\21-vtp-enrichment-gates\21-01-gate-orchestrator-PLAN.md
.planning\milestones\v2.4\phases\74-orchestrator-live-event-contract\74-VERIFICATION.md
.planning\milestones\v2.4\phases\74-orchestrator-live-event-contract\74-RESEARCH.md
.planning\milestones\v2.4\phases\74-orchestrator-live-event-contract\74-CONTEXT.md
.planning\milestones\v2.4\phases\74-orchestrator-live-event-contract\74-ATC-REVIEW.md
.planning\milestones\v2.4\phases\74-orchestrator-live-event-contract\74-01-event-contract-PLAN.md
.planning\milestones\v2.6\phases\87-live-orchestrator-context-packet-enforcement\87-VERIFICATION.md
.planning\milestones\v2.6\phases\87-live-orchestrator-context-packet-enforcement\87-RESEARCH.md
.planning\milestones\v2.6\phases\87-live-orchestrator-context-packet-enforcement\87-CONTEXT.md
.planning\milestones\v2.6\phases\87-live-orchestrator-context-packet-enforcement\87-ATC-REVIEW.md
.planning\milestones\v2.6\phases\87-live-orchestrator-context-packet-enforcement\87-01-live-wire-in-PLAN.md
.planning\milestones\v3.0\INTENT.md
.planning\milestones\v3.4\INTENT.md
.planning\milestones\v3.4\phases\137-cockpit-data-contract-source-registry-liveness\PHASE-CAPSULE.json
.planning\milestones\v3.4\phases\137-cockpit-data-contract-source-registry-liveness\137-VERIFICATION.md
.planning\milestones\v3.4\phases\137-cockpit-data-contract-source-registry-liveness\137-CONTEXT.md
.planning\milestones\v3.4\phases\137-cockpit-data-contract-source-registry-liveness\137-01-data-contract-source-registry-liveness-PLAN-LOCKED.md
.planning\milestones\v2.9\phases\98-harness-component-substrate\98-01-component-registry-PLAN.md
.planning\milestones\v3.2\INTENT.md
.planning\milestones\v3.1\INTENT.md
.planning\milestones\v3.3\INTENT.md
.planning\milestones\v1.9\phases\44-legal-context-registry\44-CONTEXT.md
.planning\milestones\v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md
.planning\milestones\v1.9\phases\44-legal-context-registry\44-RESEARCH.md
.planning\milestones\v1.9\phases\44-legal-context-registry\44-VERIFICATION-AUDIT.md
.planning\milestones\v1.9\phases\44-legal-context-registry\44-VERIFICATION.md
.planning\milestones\v1.9\phases\44-legal-context-registry\PHASE-CAPSULE.json
.planning\milestones\v1.9\phases\44-legal-context-registry\reviews\44-REVIEW.md

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command 'rg --files | rg -i "cross-poll|board-memo|handover|triage-first|taste-feedback|vtp-triage|triage-advisory"' in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
 succeeded in 847ms:
SGSD-2.0-HANDOVER.html
super-gsd\registry\handover-contract-v2.yaml

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "Get-Content -Raw 'super-gsd\\agents\\sgsd-vtp-enrichment.md'" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "Get-Content -Raw 'super-gsd\\registry\\handover-contract-v2.yaml'" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command '$p='"'super-gsd\\skills\\sgsd-orchestrate\\SKILL.md'; "'$lines=Get-Content $p; $matches=Select-String -Path $p -Pattern '"'6\\.b\\.5|6\\.6|vtp_available|vtp-enrichment|five|cascade' -CaseSensitive:"'$false; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m.LineNumber)]"; $lines[$s..$e]}' in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command '$p='"'super-gsd\\scripts\\lib\\route-ledger.cjs'; "'$lines=Get-Content $p; $matches=Select-String -Path $p -Pattern '"'BOUNDARIES|schema_version|logRouteDecision|append|envelope' -CaseSensitive:"'$false; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m.LineNumber)]"; $lines[$s..$e]}' in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
 succeeded in 748ms:
# ============================================================================
# SGSD v2 Handover Contract
# ============================================================================
# Every sgsd-* agent conforms to this contract. Agents declare version in
# their frontmatter (handover_contract: v2). Edge-guard enforces emits.
#
# Source: SGSD-v2-MIGRATION-MANIFEST.md ¶õ3
# Research grounding: HCC-P-10 (prompts as contracts), AGP-P-02 (versioned
# resources), ASS-P-06 (seed specialists with proven base methods),
# SEV-P-02 (prioritize by confidence), MET-P-06 (Intuition + Why principled),
# MET-P-08 (falsifier + stop_rule), HCC-P-04 (known_deadends), LLMS-P-07
# (explicit handoffs).
# ============================================================================

contract_version: 2
created: 2026-04-21
supersedes: v1-free-form-prose

# ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?
# INPUT ƒ?" what every agent is given on dispatch
# ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?
input:
  brief:
    phase: integer                 # e.g. 148
    plan: integer                  # e.g. 1 (within phase)
    milestone: string              # e.g. "v1.2"
    goal: string                   # one-line from ROADMAP.md

  task:                            # per-task block from v2 PLAN.md
    id: string                     # e.g. "T3"
    agent: string                  # this agent's slug (sgsd-exec-backend)
    model: string                  # codex | opus
    files_touched: [string]        # absolute or repo-rel paths
    depends_on: [string]           # other task ids
    input_contract: object         # per-agent-category expected inputs
    output_contract: object        # per-agent-category required outputs
    hypothesis: string             # MET-P-08 ƒ?" what we expect to be true
    falsifier: string              # MET-P-08 ƒ?" what would prove us wrong
    stop_rule: string              # MET-P-08 ƒ?" when to abandon vs iterate
    minimal_test: string           # MET-P-08 ƒ?" smallest thing that validates
    known_deadends: [string]       # HCC-P-04 ƒ?" paths already ruled out
    expertise_ref: string          # pointer to super-gsd/expertise/{name}.md

  context:
    sgsd_recall_queries: [string]  # executed pre-dispatch
    sgsd_recall_results: [object]  # results (capped by token budget)
    intent: string                 # DLB-03 injection (from INTENT.md)
    prior_errors: [string]         # looked up per task (sgsd-recall error-rules)
    surgical_constraint: string    # MANDATORY header (Karpathy principle)

  constraints:
    token_budget: integer          # hard ceiling for this dispatch
    time_budget_sec: integer       # wall-clock ceiling
    escape_hatches: [string]       # conditions under which agent may deviate

# ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?
# OUTPUT ƒ?" what every agent must return
# ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?
output:
  report:                          # 6-section structured report (existing format)
    FILES_CHANGED:
      type: array
      items: "path (created|modified|deleted)"
    VERIFICATION:
      type: array
      items: "cmd ƒÅ' exit N ƒo"|ƒo-"
    DEVIATIONS:
      type: array
      items: string                # [Rule N] description, or "none"
    BLOCKERS:
      type: array
      items: string                # description, or "none"
    SCRIPTS_CREATED:
      type: array
      items: "path | purpose | interface"  # or "none"
    ONE_LINER:
      type: string
      max_chars: 120

  # NEW v2 fields (research-sharpened)
  confidence: integer              # 1-5 (SEV-P-02) ƒ?" self-rated certainty
  rationale: string                # max 300 words, structured reasoning
  intuition: string                # MET-P-06 ƒ?" why this is plausible
  why_principled: string           # MET-P-06 ƒ?" grounded in what heuristic/evidence
  evidence_cited: [string]         # brief-section | DLB-ref | research-slug | file:line
  emits: [string]                  # log files / artifacts this dispatch wrote
  word_count: integer              # for the 300-word guard

# ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?
# EMITS ƒ?" observable signals every agent fires (edge-guard enforced)
# ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?
# Each agent declares its emits in frontmatter AND in registry/agents.yaml.
# Orchestrator edge-guard (R-Q4) blocks Step N ƒÅ' N+1 if declared emits missing.
emits_catalog:
  - path: .planning/metrics/heartbeat.jsonl
    source: PostToolUse hook (sgsd-heartbeat.js)
    fires: every tool completion
  - path: .planning/metrics/activity-log.jsonl
    source: PreToolUse hook (sgsd-activity-logger.js)
    fires: every tool call start
  - path: .planning/metrics/orchestrator-pulse.jsonl
    source: orchestrator step entry
    fires: every loop tick (even during deliberation)
  - path: .planning/metrics/token-log.jsonl
    source: post-dispatch orchestrator write
    fires: after each sub-agent report processed
  - path: .planning/phases/{N}/commit-reviews.jsonl
    source: per-dispatch ATC (Step 9.5)
    fires: when atc_tier ƒ^^ {full, gate} AND files_changed contains code
  - path: .planning/memory/architecture/patterns/
    source: sgsd-curate
    fires: when DEVIATIONS surfaces new pattern
  - path: .planning/memory/architecture/anti-patterns/
    source: sgsd-curate
    fires: when new failure discovered
  - path: .planning/phases/{N}/WASTE.md
    source: sgsd-muda-audit.sh
    fires: on phase close (if gate triggers)
  - path: .planning/phases/{N}/DEVIATIONS.md
    source: orchestrator accumulates
    fires: per-dispatch

# ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?
# EXPERTISE ƒ?" every agent points to a static expertise file
# ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?
# ASS-P-05: discovered archetypes vs predefined roles.
# PI Framework: expertise distinct from memory (static patterns vs dynamic recall).
expertise_discipline:
  location: super-gsd/expertise/
  one_file_per: agent
  required_sections:
    - seeded_methods              # base operators this agent extends (CoT, ReAct, etc.)
    - failure_modes               # known ways this agent fails, with indicators
    - output_quality_bar          # what "good" looks like for this agent's output
    - known_pitfalls              # things this agent must NOT do
    - reference_patterns          # exemplar outputs to pattern-match against
  update_policy:
    - author: operator-proposed via sgsd-sepl; reviewed before commit
    - never_auto: SEPL may propose edits; operator approves. No autonomous expertise rewrites.

# ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?
# VALIDATION ƒ?" boot preflight checks every agent against this contract
# ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?
validation:
  preflight_checks:
    - agent_file_exists: super-gsd/agents/{name}.md OR .claude/agents/{name}.md
    - expertise_file_exists: super-gsd/expertise/{name}.md
    - registry_entry_exists: super-gsd/registry/agents.yaml
    - frontmatter_declares_contract: handover_contract: v2
    - emits_declared: non-empty emits list
    - model_declared: one of [codex, opus]
  failure_modes:
    - missing_expertise: BLOCKER (boot FAIL)
    - missing_registry_entry: BLOCKER (boot FAIL)
    - mismatched_contract_version: WARN
    - undeclared_emits: WARN (edge-guard will fire at runtime)


 succeeded in 765ms:
---
name: sgsd-vtp-enrichment
description: VTP library enrichment gate sub-agent (VTPE-01). Fires at orchestrator Step 6.b.5 between gsd-phase-researcher and gsd-planner. Queries VTP via 5-tool cascade with 3-source phase seed (CONTEXT + REQ-IDs + RESEARCH), writes {NN}-VTP-ENRICHMENT.md artifact per D-04 shape. Never challenges plans ƒ?" enrich-only (Q2=B).
tools: Read, Grep, Glob, Bash, Write, mcp__vtp-kb__vtp_search, mcp__vtp-kb__vtp_search_substrate, mcp__vtp-kb__vtp_search_research, mcp__vtp-kb__vtp_route_and_retrieve, mcp__vtp-kb__vtp_advise_service_enrichment, mcp__vtp-kb__vtp_health_structured, mcp__vtp-kb__vtp_get_document
model: sonnet
status: legacy-disabled
---

<role>
You are the VTP Enrichment Gate sub-agent. You fire once per phase, after the researcher produces RESEARCH.md and before the planner drafts PLAN.md. Your one job: consult the operator's curated knowledge library (VTP ƒ?" 54 books, 74 research artifacts, 48 meetings) for relevant precedent, then write a structured artifact the downstream planner must read.
</role>

<temperament>
Mechanical. Disciplined. No speculation. Every claim cites a library source (doc-ID + section/page). If the library has no coverage for a topic, say so explicitly in an Empty-Hit Rationale section ƒ?" zero hits is a valid result, not a failure. Do NOT propose alternatives to Claude's research ƒ?" operator locked Q2=B enrich-only. You ADD context, you do NOT challenge.
</temperament>

<dispatch_contract>
Orchestrator invokes you with a sub-agent spec produced by `vtp-enrichment-gate.cjs` ƒÅ' `composeSubAgentSpec(opts)`. The spec fields returned (authoritative ƒ?" match module source):
- `sub_agent_type` ƒ?" always `'sgsd-vtp-enrichment'` (you)
- `model` ƒ?" always `'sonnet'`
- `seed` ƒ?" pre-composed 800-token 3-source query string (CONTEXT domain + REQ-IDs AC + RESEARCH findings, truncated to QUERY_SEED_MAX_TOKENS)
- `tools` ƒ?" ordered VTP_TOOLS array (the 5-tool cascade per D-01)
- `cascade_rule` ƒ?" policy string: "tools 1+2 always; tools 3+4+5 only if hits > 0 from tools 1+2 (D-01); cap 5 queries (D-03)"
- `artifact_filename` ƒ?" phase-prefixed name (e.g. `'21-VTP-ENRICHMENT.md'`) produced by `buildArtifactFilename(phase)`
- `phaseDir` ƒ?" absolute path to the phase directory (e.g. `.planning/milestones/v1.5/phases/21-vtp-enrichment-gates`)
- `phase` ƒ?" phase number string (e.g. `'21'`)

You run the cascade using the `seed` string and `tools` array, then invoke `run({projectDir, phaseDir, phase, enrichmentResult: {...}})` from `super-gsd/scripts/lib/vtp-enrichment-gate.cjs` to write the artifact. `projectDir` is resolved from your own process.cwd() (not in the spec). The module handles frontmatter + artifact shape + 3-path (success/empty_hit/api_error) discipline. Your job is producing the structured `enrichmentResult` object.
</dispatch_contract>

<reasoning>
For each phase you enrich, run this reasoning chain:

1. Call `vtp_health_structured` once ƒ?" if checks fail, return `{ok: false, status: 'api_error', error_message}` immediately. Orchestrator halts.
2. Call `vtp_search` with the query_seed (D-01 tool 1/5). Capture hits.
3. Call `vtp_search_substrate` with the same seed (D-01 tool 2/5). Capture hits. Substrate is book/paper content ƒ?" the operator's investment.
4. IF hits from steps 2-3 are zero ƒÅ' short-circuit. Skip tools 3-5 to save tokens. Return `{ok: true, total_hits: 0, status: 'empty_hit', hits: [], gaps: [<topic descriptors>], alt_framings: [], rationale: "no library coverage for {topic}"}`.
5. IF hits are non-zero ƒÅ' run `vtp_search_research` (tool 3/5), `vtp_route_and_retrieve` (tool 4/5), `vtp_advise_service_enrichment` (tool 5/5). Aggregate hits by relevance.
6. Synthesize into three sections:
   - **Library Hits** ƒ?" table of {source, title, section, relevance, citation} rows
   - **Gaps** ƒ?" what the library does NOT cover for this phase that it probably should
   - **Alternative Framings** ƒ?" how library sources frame the problem differently from our CONTEXT.md (descriptive only, NOT prescriptive ƒ?" Q2=B locked)
</reasoning>

<heuristics>
- Every claim has a citation (doc-ID format, e.g. `doc:abc123def456`). No bare assertions.
- Empty-hit is a valid result. Treat it like a clean compiler pass ƒ?" informative, not failing.
- Never propose plan alternatives. Enrich-only.
- Tier-based batching only applies in audit cross-ref contexts (VTPE-02), NOT here. The enrichment gate runs one pass per phase.
- If VTP health is degraded (vtp_available=false per D-08), orchestrator already skipped you. You only run when vtp_available=true.
- Short-circuit on zero hits from tools 1+2 ƒ?" saves ~60% of token budget on phases the library doesn't cover.
- Keep the artifact under 200 lines ƒ?" it augments RESEARCH.md, not replaces it.
</heuristics>

<output_format>
Return the `enrichmentResult` object as structured data (not prose). The lib module writes the artifact ƒ?" you produce the data.

```js
{
  ok: true,                    // false only on VTP API error
  status: 'success',           // 'success' | 'empty_hit' | 'api_error'
  phase: '21',
  query_count: 5,              // how many VTP tools actually called
  total_hits: 12,
  duration_ms: 8450,
  hits: [
    { source: 'book', title: 'X Y Z', section: 'Ch.3', relevance: 'high', citation: 'doc:abc...' },
    ...
  ],
  gaps: ['topic Alpha', 'topic Beta'],    // string descriptors
  alt_framings: ['Framing A: ...', ...],  // prose bullets
  rationale: ''                // only populated if status='empty_hit'
}
```

Then call `require('super-gsd/scripts/lib/vtp-enrichment-gate').run({projectDir, phaseDir, phase, enrichmentResult})` ƒ?" returns `{status, artifact_path}`.

Report back to orchestrator:
- `status: success` ƒÅ' planner dispatch proceeds (orchestrator Step 6.c)
- `status: empty_hit` ƒÅ' planner dispatch proceeds (empty-hit is autonomous-continue per Q3=A)
- `status: api_error` ƒÅ' orchestrator HALTS (checkpoint + exit loop)
</output_format>


 succeeded in 1450ms:
[319]
---
[323]
---
[331]
---
[334]
---
[336]
---
[345]
---
[351]
---
[355]
---
[356]
---
[361]
---
[363]
---
[750]
---
[751]
---
[752]
---
[754]
---
[758]
---
[760]
---
[761]
---
[763]
---
[764]
---
[792]
---
[797]
---
[803]
---
[819]
---
[1028]
---
[1030]
---
[1031]
---
[1122]
---
[1490]
---
[1499]
---
[1633]
---
[1656]
---
[1661]
---
[1672]
---
[1693]
---
[1700]
---
[1715]
---
[1720]
---
[1733]
---
[1791]
---
[1820]
---
[2925]
---
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+28); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 

 succeeded in 1751ms:
[7]
// ============================================================================
[9]
// ============================================================================
[12]
// ============================================================================
[13]
// ============================================================================
[19]
// ============================================================================
[21]
// ============================================================================
[23]
// ============================================================================
[32]
// ============================================================================
[42]
// ============================================================================
[46]
// ============================================================================
[47]
// ============================================================================
[61]
// ============================================================================
[62]
// ============================================================================
[65]
// ============================================================================
[66]
// ============================================================================
[69]
// ============================================================================
[70]
// ============================================================================
[75]
// ============================================================================
[88]
// ============================================================================
[93]
// ============================================================================
[94]
// ============================================================================
[100]
// ============================================================================
[108]
// ============================================================================
[114]
// ============================================================================
[119]
// ============================================================================
[121]
// ============================================================================
[140]
// ============================================================================
[153]
// ============================================================================
[159]
// ============================================================================
[160]
// ============================================================================
[161]
// ============================================================================
[163]
// ============================================================================
[164]
// ============================================================================
[165]
// ============================================================================
[168]
// ============================================================================
[170]
// ============================================================================
[171]
// ============================================================================
[172]
// ============================================================================
[174]
// ============================================================================
[176]
// ============================================================================
[195]
// ============================================================================
[196]
// ============================================================================
[199]
// ============================================================================
[203]
// ============================================================================
[220]
// ============================================================================
[222]
// ============================================================================
[224]
// ============================================================================
[227]
// ============================================================================
[232]
// ============================================================================
[273]
// ============================================================================
[291]
// ============================================================================
[330]
// ============================================================================
[331]
// ============================================================================
[332]
// ============================================================================
[342]
// ============================================================================
[343]
// ============================================================================
[344]
// ============================================================================
[353]
// ============================================================================
[355]
// ============================================================================
[371]
// ============================================================================
[377]
// ============================================================================
[382]
// ============================================================================
[391]
// ============================================================================
[392]
// ============================================================================
[397]
// ============================================================================
[401]
// ============================================================================
[402]
// ============================================================================
[407]
// ============================================================================
[410]
// ============================================================================
[411]
// ============================================================================
[412]
// ============================================================================
[416]
// ============================================================================
[433]
// ============================================================================
[434]
// ============================================================================
[452]
// ============================================================================
[453]
// ============================================================================
[479]
// ============================================================================
[504]
// ============================================================================
[543]
// ============================================================================
[544]
// ============================================================================
[549]
// ============================================================================
[552]
// ============================================================================
[555]
// ============================================================================
[557]
// ============================================================================
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:218
+ ... se; foreach($m in $matches){$s=[Math]::Max(0,$m.LineNumber-8);$e=[Mat ...
+                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 
Cannot invoke method. Method invocation is supported only on core types in this language mode.
At line:2 char:252
+ ... ineNumber-8);$e=[Math]::Min($lines.Length-1,$m.LineNumber+30); "[$($m ...
+                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : MethodInvocationNotSupportedInConstrainedLanguage
 

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "rg -n -C 4 -S \"Step 6\\.b\\.5|Step 6\\.6|D-08|vtp_available|sgsd-vtp-enrichment\" super-gsd/skills/sgsd-orchestrate/SKILL.md; rg -n -C 3 -S \"BOUNDARIES|schema_version|logRouteDecision|appendFile|append\" super-gsd/scripts/lib/route-ledger.cjs; rg -n -C 3 -S \"cascade|tool|timeout|degrad|write|5-tool|five\" super-gsd/agents/sgsd-vtp-enrichment.md" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
 succeeded in 579ms:
313-       }
314-     }
315-     ```
316-
317:3.7. VTP HEALTH PROBE (D-08 — one-time cold-start ping, cached for session)
318-     Immediately after step 3.6, if config.vtp_enrichment.enabled is true,
319:     ping VTP once to establish session health. Cache result as vtp_available.
320-
321-     ```javascript
322:     // vtp_health cold-start probe (D-08)
323:     let vtp_available = false; // default: assume unavailable (safe degraded mode)
324-     if (config.vtp_enrichment && config.vtp_enrichment.enabled === true) {
325-       try {
326-         // Minimal health ping using vtp_search with a 1-result seed
327-         // Actual call happens in agent runtime scope via mcp__vtp-kb__vtp_search
328-         // In orchestrator scope: use gates.shouldFire to decide, then log result
329-         const healthResult = await callVtpHealthProbe(); // see note below
330-         if (healthResult && healthResult.ok !== false) {
331:           vtp_available = true;
332-         }
333-       } catch (_) {
334:         vtp_available = false;
335-       }
336:       const healthState = vtp_available ? 'healthy' : 'degraded';
337-       const vtp_health_cached = healthState;
338-       console.log(`[SGSD] vtp_health: ${healthState}`);
339-
340-       // Append health row to .planning/metrics/vtp-health.jsonl
341-       const fs = require('fs');
342-       fs.appendFileSync('.planning/metrics/vtp-health.jsonl',
343-         JSON.stringify({
344-           ts: new Date().toISOString(),
345:           vtp_available,
346-           vtp_health_cached: healthState,
347-           source: 'cold_start_probe',
348-         }) + '\n'
349-       );
350-
351:       if (!vtp_available) {
352:         console.warn('[SGSD] VTP health check failed -- enrichment gates will run continue-without-artifact mode (D-08 degraded)');
353-       }
354-     }
355:     // vtp_available is now cached for this session.
356:     // All Step 6.b.5 gate checks read this cached value before dispatching.
357-     ```
358-
359-     Implementation note: callVtpHealthProbe() is a thin wrapper that calls
360-     mcp__vtp-kb__vtp_search with seed "health check" and max_results=1.
361:     If the tool is unreachable or returns ok=false, vtp_available stays false.
362-     Non-blocking: if vtp_enrichment.enabled is false (default), probe is skipped
363:     entirely and vtp_available=false (gate never fires anyway per D-07).
364-
365-4. Determine position: which phase, which plan, what state
366-
367-When capturing gsd-tools output into a variable, always apply the @file: IPC guard:
--
746-        `--step phase-research --timeout-tier analysis --phase {N}
747-        --plan research --project {PROJECT_DIR}`. Claude may compose the
748-        bounded prompt and normalize the report, but must not do the research
749-        itself in auto mode.
750:     b.5 VTP ENRICHMENT GATE (Step 6.b.5) — Phase has RESEARCH.md AND config.vtp_enrichment.enabled is true →
751:         D-08 DEGRADED-MODE CHECK (read cached vtp_available from Step 3.7):
752:           if vtp_available === false:
753:             // VTP health check failed at cold-start — skip gate silently (D-08)
754:             log deviation: "VTP enrichment gate skipped (degraded mode: vtp_available=false)"
755-             append to .planning/metrics/vtp-health.jsonl:
756-               {"ts":"{ISO}","phase":N,"plan":P,"event":"gate_skipped","reason":"vtp_degraded"}
757-             continue directly to Step 6.c (no sub-agent dispatch, no artifact required)
758:           // else vtp_available === true: proceed normally below
759-          run optional VTP enrichment through configured MCP/Codex synthesis. Gate
760-         precondition: gates.shouldFire('vtp-enrichment', ctx).
761-         Sub-agent calls vtp-enrichment-gate.cjs composeSubAgentSpec() to
762-         build 800-token 3-source seed (CONTEXT domain + REQ-IDs AC +
--
793-            2. `.planning/metrics/vtp-health.jsonl` has a current-phase
794-               `gate_skipped` / `vtp_degraded` row; or
795-            3. the operator explicitly says to bypass VTP for this phase.
796-        - If (1) is false and (2)/(3) are false, dispatch
797:          `sgsd-vtp-enrichment` now before planner. This applies even when
798-          RESEARCH.md already existed before this SGSD session or the operator
799-          asked for a fresh planner after rejecting prior drafts.
800-        - Add a `<required_reading>` block to the planner prompt containing:
801-            * CONTEXT.md
--
1024-        {ok:false, reason_codes:['not_routed_to_vtp']} with NO MCP call and NO failure-log
1025-        row (refused != failure). selectiveVTPCall imports route.VTP_WHITELIST BY REFERENCE
1026-        (no copy; identity-checked in the bridge self-test assertion 11).
1027-
1028:        COEXISTENCE with sgsd-vtp-enrichment (Step 6.b.5). The two are distinct and both
1029-        ship in v1.9:
1030:        - Step 6.b.5 (sgsd-vtp-enrichment): per-PHASE enrichment between researcher and
1031-          planner. Runs the 5-tool VTP cascade for broad enrichment of RESEARCH.md.
1032-        - Step d.7 (Phase 48 bridge -- selectiveVTPCall): per-DISPATCH selective single-shot
1033-          call. Fires on routeDispatch decision, returns one evidence_packet for the
1034-          context-packet builder.
--
1118-        waves are intentionally flattened because Codex CLI sessions need exclusive workspace
1119-        write access. The DAG ordering remains advisory and prevents file-conflict bugs under
1120-        serial execution.
1121-     f. All plans executed → dispatch Codex verifier
1122:     g. Verification passed → PHASE ATC GATE (Step 6.5) → FRONTEND VERIFY GATE (Step 6.6) → mark complete
1123-     h. Verification failed → dispatch Codex planner --gaps (GPT-5.5 / xhigh)
1124-
1125-  <!-- ANCHOR: RULE-8.5 — schema-fix dispatch branch -->
1126-  6.2. PLAN LOAD-TIME VALIDATION (Rule 8.5 — schema-fix dispatch)
--
1486-     `--phase-type`; no separate gate-value producer is required. Do not copy
1487-     the gate thresholds into this skill.
1488-
1489-     Do NOT invoke the MUDA script in Step 6.55. The phase-close routing consult
1490:     in Step 6.6.i is the SINGLE execution point. It consumes the named
1491-     `gate_ref`, renders the registered dispatch, runs it once when fired, and
1492-     appends the gate-value outcome plus scheduling and execution evidence rows.
1493-
1494-     MUDA exits 1 and 2 are verdict findings, not process failures. The later
--
1657-            ```
1658-
1659-            HARD RULES for this gate -- no exceptions:
1660-
1661:            R1. writeCapsule outcome NEVER blocks the Step 6.6.i consult.
1662-                Lock 13 binds.
1663-            R2. Capsule write failure surfaces in the next milestone-close's
1664-                token-waste / phase-folder-audit narrative (Phase 49 reads
1665-                context-complaints.jsonl); operator-discoverable but
--
1696-            (defensive bound).
1697-
1698-            ```javascript
1699-            // Phase 49 wire-in: anchor planningDir to process.cwd() at the
1700:            // orchestrator-skill boundary (mirrors Step 6.6.i.X capsule write
1701-            // pattern at write.cjs require above).
1702-            const path = require('path');
1703-            const { processComplaints } = require(
1704-              path.join(process.cwd(), 'super-gsd', 'tools', 'memory-governance', 'lifecycle.cjs')
--
1716-            ```
1717-
1718-            HARD RULES for this gate -- no exceptions:
1719-
1720:            G1. processComplaints outcome NEVER blocks the Step 6.6.i consult.
1721-                Lock 13 binds.
1722-            G2. Repair actions are SCHEDULED via .planning/metrics/repair-queue.jsonl
1723-                envelope-v1 rows; the orchestrator picks up the queue on the
1724-                NEXT phase loop iteration (or via explicit
--
1787-          does not block completion; only `execution_failed` requires repair.
1788-
1789-  6.7. MILESTONE COMPLETE AUTO-TRIGGER (GOV-13 / D-18a)
1790-
1791:       After Step 6.6.j marks a phase complete:
1792-
1793-         a. Read `.planning/ROADMAP.md` in full. Milestone close is rare.
1794-         b. Extract the active milestone from `.planning/STATE.md`.
1795-         c. Check: do all milestone phases show [x] in ROADMAP.md?
--
2515-      the source of truth for memory-hygiene/curation scheduling. Runtime
2516-      phase-close routing is resolved by:
2517-        `node super-gsd/scripts/lib/orchestrator-hooks.cjs --skill-routing-consult --phase N`
2518-      The block below retains only the existing gate and curation mechanics.
2519:      // Gate check (Phase 10 D-08): sgsd-curate-learnings fires when new pattern, script, or error
2520-      if (gates.shouldFire('sgsd-curate-learnings', ctx, GATES_YAML_PATH)) {
2521-      If DEVIATIONS contains new patterns → sgsd-curate to patterns/
2522-      If SCRIPTS_CREATED non-empty → sgsd-curate to scripts/{category}
2523-      If new error discovered → sgsd-curate to error-rules/
--
2921-    returns to Opus/xhigh planner revision. Never execute a plan set that has
2922-    not passed this final plan review unless the operator explicitly bypasses it.
2923-15. FRONTEND BROWSER VERIFY GATE: After Step 6.5 (ATC), BEFORE marking phase
2924-    complete — IF the phase diff touched any frontend file matching
2925:    config.browser_verify.frontend_globs, run Step 6.6 which dispatches
2926-    browser verification tooling to verify every route in config.browser_verify.routes
2927-    against the live dev server. Catches broken pages, console errors, network
2928-    failures, and a11y regressions that unit tests and ATC miss.
2929-    Writes .planning/phases/{NN}-*/{NN}-BROWSER-REVIEW.md with screenshots.
10-//
11-// Phase 32 (32=A) ships ONE wire-in: `codex_route` at sgsd-orchestrate
12-// SKILL.md Step 9.5 (line 1236). The other 5 boundaries are pre-declared
13:// in BOUNDARIES but DEFERRED to v1.8+ -- see Section 1 of
14-// .planning/milestones/v1.7/phases/32-route-decision-ledger/32-RESEARCH.md
15-// for exact wire-in targets.
16-//
--
18-//   {
19-//     envelope_version: 1,
20-//     ts:               ISO-8601,
21://     command:          "logRouteDecision",
22-//     status:           ok|warn|fail|skipped|timeout|blocked,
23-//     reason_codes:     string[]   (envelope-v1 vocab; empty array allowed),
24-//     artifacts:        {kind,path}[],
--
29-//     run_id:           "YYYY-MM-DDTHH:MM:SS.sssZ-XXXX" (4hex),
30-//     phase:            string|null,
31-//     milestone:        string|null,
32://     boundary:         one of BOUNDARIES,    (Phase 32 extension)
33-//     decision:         object                 (Phase 32 extension; free-form)
34-//   }
35-//
--
39-//
40-// Concurrency: orchestrator is single-threaded; per-dispatch-ATC fires
41-// sequentially after parallel waves serialize at SKILL.md:467-471. No
42:// locking required. fs.appendFileSync is atomic at row boundary on POSIX
43-// and on Windows for sub-block writes (rows are well under 4KB).
44-//
45-// Failure contract: this writer NEVER throws upward at the orchestrator
46:// boundary. Closed-enum violations raise inside appendRow but the public
47:// helper logRouteDecision wraps every call in try/catch; on error it
48-// console.warns to stderr and returns false. Section 8 of 32-RESEARCH.md
49-// codifies this: "evidence may falter; autonomy must not."
50-// ============================================================================
--
72-// (local-script | codex | claude) with task-capsule, token, fallback, and
73-// acceptance-test evidence. This extends the existing ledger instead of
74-// creating a second routing stream.
75:const BOUNDARIES = Object.freeze([
76-  'milestone_promotion',
77-  'phase_dispatch_first',
78-  'executor_choice',
--
90-  'ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked',
91-]);
92-
93:const COMMAND_NAME = 'logRouteDecision';
94-const ENVELOPE_VERSION = 1;
95-
96-function jsonlPath(planningDir) {
--
111-  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}$/;
112-
113-// Internal: validate + normalize a row. Throws on closed-enum violation.
114:// Caller responsible for catching (logRouteDecision wraps).
115-function _normalize(row) {
116-  if (!row || typeof row !== 'object') {
117-    throw new Error('route-ledger: row must be an object');
118-  }
119:  if (!row.boundary || !BOUNDARIES.includes(row.boundary)) {
120-    throw new Error(
121:      `route-ledger: boundary must be one of ${BOUNDARIES.join(', ')}; got '${row.boundary}'`
122-    );
123-  }
124-  if (!row.status || !STATUSES.includes(row.status)) {
--
192-  }
193-}
194-
195:// Low-level append. Throws on validation; caller wraps.
196:function appendRow(planningDir, row) {
197-  if (!planningDir) throw new Error('route-ledger: planningDir required');
198-  const enriched = _normalize(row);
199-  _assertEnvelopeV1(enriched);
200-  const p = jsonlPath(planningDir);
201-  const dir = path.dirname(p);
202-  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
203:  fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8');
204-  return enriched;
205-}
206-
--
217-    .filter(Boolean);
218-}
219-
220:// Public API. NEVER throws upward. Returns true on append, false on error.
221-// Stderr-only error logging (32-RESEARCH.md 9.4 LOCKED).
222:function logRouteDecision(planningDir, args) {
223-  try {
224:    appendRow(planningDir, args || {});
225-    return true;
226-  } catch (e) {
227:    console.warn('[SGSD] route-ledger logRouteDecision failed:', e.message);
228-    return false;
229-  }
230-}
--
288-      plan: plan || null,
289-    };
290-
291:    return appendRow(planningDir, {
292-      boundary: 'codex_route',
293-      status,
294-      phase: phase ?? null,
--
327-  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-'));
328-  try {
329-    // 1. Module exports + frozen constants. Double-agent executor: 10 entries.
330:    assert('1. BOUNDARIES is array of 10',
331:      Array.isArray(BOUNDARIES) && BOUNDARIES.length === 10);
332-    assert('2. STATUSES is array of 6 envelope-v1 states',
333-      Array.isArray(STATUSES) && STATUSES.length === 6 &&
334-      STATUSES.includes('ok') && STATUSES.includes('warn') &&
--
341-
342-    // 4. Append + read shape: envelope-v1 + Phase 32 extension fields.
343-    // 'review_report' is an EVIDENCE kind per envelope-v1.json:53 (cite, not write).
344:    const r1 = appendRow(tmp, {
345-      boundary: 'codex_route', status: 'ok',
346-      phase: '32', milestone: 'v1.7',
347-      reason_codes: ['review_unanimous_pass'],
--
350-      decision: { from: 'codex-cli-reviewer', to: null, fallback_triggered: false },
351-    });
352-    const rows = readRows(tmp);
353:    assert('4. single append produces one envelope-shaped row',
354-      rows.length === 1 &&
355-      rows[0].envelope_version === 1 &&
356-      rows[0].command === COMMAND_NAME &&
--
368-
369-    // 5. Invalid boundary throws.
370-    let threwBoundary = false;
371:    try { appendRow(tmp, { boundary: 'banana', status: 'ok' }); }
372-    catch (e) { threwBoundary = /boundary must be one of/.test(e.message); }
373-    assert('5. invalid boundary throws with helpful message', threwBoundary);
374-
375-    // 6. Invalid status throws.
376-    let threwStatus = false;
377:    try { appendRow(tmp, { boundary: 'codex_route', status: 'maybe' }); }
378-    catch (e) { threwStatus = /status must be one of/.test(e.message); }
379-    assert('6. invalid status throws with helpful message', threwStatus);
380-
381-    // 7. Empty reason_codes permitted (array, not null).
382:    appendRow(tmp, {
383-      boundary: 'codex_route', status: 'ok',
384-      phase: '32', milestone: 'v1.7',
385-    });
--
389-      rows7[1].reason_codes.length === 0);
390-
391-    // 8. Append-only (no truncation).
392:    appendRow(tmp, {
393-      boundary: 'codex_route', status: 'warn',
394-      phase: '32', milestone: 'v1.7',
395-      reason_codes: ['codex_fallback_triggered'],
396-    });
397:    assert('8. two further appends -> three rows; never truncated',
398-      readRows(tmp).length === 3);
399-
400-    // 9. Defensive parse: malformed line skipped.
401:    fs.appendFileSync(jsonlPath(tmp), '{not-json\n', 'utf8');
402:    appendRow(tmp, {
403-      boundary: 'codex_route', status: 'ok',
404-      phase: '32', milestone: 'v1.7',
405-    });
406-    const rowsDef = readRows(tmp);
407:    assert('9. malformed line skipped; subsequent valid append readable',
408-      rowsDef.length === 4);
409-
410:    // 10. logRouteDecision wraps + never throws upward.
411:    const wrappedFalse = logRouteDecision(tmp, { boundary: 'banana', status: 'ok' });
412:    const wrappedTrue = logRouteDecision(tmp, {
413-      boundary: 'codex_route', status: 'ok',
414-      phase: '32', milestone: 'v1.7',
415-    });
416:    assert('10. logRouteDecision returns false on validation failure (no throw upward)',
417-      wrappedFalse === false && wrappedTrue === true);
418-
419-    // 11. 100 rapid generateRunId() calls produce 100 unique values.
--
431-      realSizeBefore === realSizeAfter);
432-
433-    // 13. Phase 38: gate_override boundary accepts envelope-shaped row.
434:    const r13 = appendRow(tmp, {
435-      boundary: 'gate_override', status: 'ok',
436-      phase: '38', milestone: 'v1.8',
437-      reason_codes: ['gate_force_override_with_reason'],
--
450-    void r13;
451-
452-    // 14. Phase 47: dispatch_route boundary accepts envelope-shaped Phase 47 decision.
453:    const r14 = appendRow(tmp, {
454-      boundary: 'dispatch_route', status: 'ok',
455-      phase: '47', milestone: 'v1.9',
456-      reason_codes: ['matched_uncertainty_type'],
--
476-    void r14;
477-
478-    // 15. Phase 48: vtp_bridge boundary smoke (mirror assertion 14 for new VTP route).
479:    const r15 = appendRow(tmp, {
480-      boundary: 'vtp_bridge', status: 'ok',
481-      phase: '48', milestone: 'v1.9',
482-      reason_codes: ['vtp_call_succeeded'],
--
501-    void r15;
502-
503-    // 16. Double-agent executor: execution_route boundary smoke.
504:    const r16 = appendRow(tmp, {
505-      boundary: 'execution_route', status: 'ok',
506-      phase: '63', milestone: 'v2.2',
507-      reason_codes: ['codex_primary_bounded_task'],
--
540-  const cmd = process.argv[2];
541-  if (cmd === '--self-test') process.exit(selfTest());
542-  console.log('Usage: node route-ledger.cjs --self-test');
543:  console.log('  Or require() and call logRouteDecision / logCodexRoute / appendRow / readRows');
544:  console.log('  BOUNDARIES =', JSON.stringify(BOUNDARIES));
545-  process.exit(0);
546-}
547-
548-module.exports = {
549:  BOUNDARIES,
550-  STATUSES,
551-  COMMAND_NAME,
552-  ENVELOPE_VERSION,
553-  jsonlPath,
554-  generateRunId,
555:  appendRow,
556-  readRows,
557:  logRouteDecision,
558-  logCodexRoute,
559-};
1----
2-name: sgsd-vtp-enrichment
3:description: VTP library enrichment gate sub-agent (VTPE-01). Fires at orchestrator Step 6.b.5 between gsd-phase-researcher and gsd-planner. Queries VTP via 5-tool cascade with 3-source phase seed (CONTEXT + REQ-IDs + RESEARCH), writes {NN}-VTP-ENRICHMENT.md artifact per D-04 shape. Never challenges plans — enrich-only (Q2=B).
4:tools: Read, Grep, Glob, Bash, Write, mcp__vtp-kb__vtp_search, mcp__vtp-kb__vtp_search_substrate, mcp__vtp-kb__vtp_search_research, mcp__vtp-kb__vtp_route_and_retrieve, mcp__vtp-kb__vtp_advise_service_enrichment, mcp__vtp-kb__vtp_health_structured, mcp__vtp-kb__vtp_get_document
5-model: sonnet
6-status: legacy-disabled
7----
8-
9-<role>
10:You are the VTP Enrichment Gate sub-agent. You fire once per phase, after the researcher produces RESEARCH.md and before the planner drafts PLAN.md. Your one job: consult the operator's curated knowledge library (VTP — 54 books, 74 research artifacts, 48 meetings) for relevant precedent, then write a structured artifact the downstream planner must read.
11-</role>
12-
13-<temperament>
--
19-- `sub_agent_type` — always `'sgsd-vtp-enrichment'` (you)
20-- `model` — always `'sonnet'`
21-- `seed` — pre-composed 800-token 3-source query string (CONTEXT domain + REQ-IDs AC + RESEARCH findings, truncated to QUERY_SEED_MAX_TOKENS)
22:- `tools` — ordered VTP_TOOLS array (the 5-tool cascade per D-01)
23:- `cascade_rule` — policy string: "tools 1+2 always; tools 3+4+5 only if hits > 0 from tools 1+2 (D-01); cap 5 queries (D-03)"
24-- `artifact_filename` — phase-prefixed name (e.g. `'21-VTP-ENRICHMENT.md'`) produced by `buildArtifactFilename(phase)`
25-- `phaseDir` — absolute path to the phase directory (e.g. `.planning/milestones/v1.5/phases/21-vtp-enrichment-gates`)
26-- `phase` — phase number string (e.g. `'21'`)
27-
28:You run the cascade using the `seed` string and `tools` array, then invoke `run({projectDir, phaseDir, phase, enrichmentResult: {...}})` from `super-gsd/scripts/lib/vtp-enrichment-gate.cjs` to write the artifact. `projectDir` is resolved from your own process.cwd() (not in the spec). The module handles frontmatter + artifact shape + 3-path (success/empty_hit/api_error) discipline. Your job is producing the structured `enrichmentResult` object.
29-</dispatch_contract>
30-
31-<reasoning>
32-For each phase you enrich, run this reasoning chain:
33-
34-1. Call `vtp_health_structured` once — if checks fail, return `{ok: false, status: 'api_error', error_message}` immediately. Orchestrator halts.
35:2. Call `vtp_search` with the query_seed (D-01 tool 1/5). Capture hits.
36:3. Call `vtp_search_substrate` with the same seed (D-01 tool 2/5). Capture hits. Substrate is book/paper content — the operator's investment.
37:4. IF hits from steps 2-3 are zero → short-circuit. Skip tools 3-5 to save tokens. Return `{ok: true, total_hits: 0, status: 'empty_hit', hits: [], gaps: [<topic descriptors>], alt_framings: [], rationale: "no library coverage for {topic}"}`.
38:5. IF hits are non-zero → run `vtp_search_research` (tool 3/5), `vtp_route_and_retrieve` (tool 4/5), `vtp_advise_service_enrichment` (tool 5/5). Aggregate hits by relevance.
39-6. Synthesize into three sections:
40-   - **Library Hits** — table of {source, title, section, relevance, citation} rows
41-   - **Gaps** — what the library does NOT cover for this phase that it probably should
--
47-- Empty-hit is a valid result. Treat it like a clean compiler pass — informative, not failing.
48-- Never propose plan alternatives. Enrich-only.
49-- Tier-based batching only applies in audit cross-ref contexts (VTPE-02), NOT here. The enrichment gate runs one pass per phase.
50:- If VTP health is degraded (vtp_available=false per D-08), orchestrator already skipped you. You only run when vtp_available=true.
51:- Short-circuit on zero hits from tools 1+2 — saves ~60% of token budget on phases the library doesn't cover.
52-- Keep the artifact under 200 lines — it augments RESEARCH.md, not replaces it.
53-</heuristics>
54-
55-<output_format>
56:Return the `enrichmentResult` object as structured data (not prose). The lib module writes the artifact — you produce the data.
57-
58-```js
59-{
60-  ok: true,                    // false only on VTP API error
61-  status: 'success',           // 'success' | 'empty_hit' | 'api_error'
62-  phase: '21',
63:  query_count: 5,              // how many VTP tools actually called
64-  total_hits: 12,
65-  duration_ms: 8450,
66-  hits: [

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "Get-Content 'super-gsd\\skills\\sgsd-orchestrate\\SKILL.md' | Select-Object -Skip 740 -First 90" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "Get-Content 'super-gsd\\scripts\\lib\\route-ledger.cjs' | Select-Object -Skip 65 -First 180" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "Get-Content 'super-gsd\\skills\\sgsd-orchestrate\\SKILL.md' | Select-Object -Skip 1008 -First 52" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "Get-Content 'super-gsd\\scripts\\lib\\vtp-enrichment-gate.cjs' | Select-Object -First 280" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
 succeeded in 966ms:
        MUST NOT inject the failure into the Agent prompt as if it were research evidence.
        Instead:
        - Pass `_vtp_packets: []` (empty array) into the context-packet builder.
        - Surface vtp_evidence_packet.error_logged_at in the dispatch summary line of the
          Agent prompt as a status note: `"VTP bridge attempted (uncertainty_type=X);
          failed; see {error_logged_at}"`. The Agent treats this as a bridge-status note,
          NOT a research conclusion.
        - The bridge has already written one row to vtp-bridge-failures.jsonl (with
          {tool, error_type in FAILURE_KINDS, error_message, retry_at}) and one row to
          route-decisions.jsonl (boundary='vtp_bridge', status='fail'|'timeout'). The
          orchestrator does NOT duplicate this logging.

        WHITELIST behavior. When decision.provider !== 'vtp' the orchestrator does NOT call
        the bridge. Phase 47 has already gated the route. Defense-in-depth: if the bridge
        is accidentally invoked with a non-whitelist uncertainty_type it returns
        {ok:false, reason_codes:['not_routed_to_vtp']} with NO MCP call and NO failure-log
        row (refused != failure). selectiveVTPCall imports route.VTP_WHITELIST BY REFERENCE
        (no copy; identity-checked in the bridge self-test assertion 11).

        COEXISTENCE with sgsd-vtp-enrichment (Step 6.b.5). The two are distinct and both
        ship in v1.9:
        - Step 6.b.5 (sgsd-vtp-enrichment): per-PHASE enrichment between researcher and
          planner. Runs the 5-tool VTP cascade for broad enrichment of RESEARCH.md.
        - Step d.7 (Phase 48 bridge -- selectiveVTPCall): per-DISPATCH selective single-shot
          call. Fires on routeDispatch decision, returns one evidence_packet for the
          context-packet builder.
        Both call into the same MCP tool family; both coexist; Phase 48 does NOT replace
        the enrichment agent.

        FORWARD CONTRACTS (shape only -- no require() of unwritten code):
        - Phase 49 governance (GOV-04..GOV-08) reads vtp-bridge-failures.jsonl + the
          route-decisions.jsonl rows where boundary='vtp_bridge', and may promote recurring
          successful packets to validated_thoughts and demote tools whose failure rate
          exceeds threshold. Phase 48 ships the data; Phase 49 owns the promotion logic.
        - Phase 50 cockpit (COCKPIT-04) reads the tail of both streams for the source-mix
          display.
        - Phase 51 BENCH (BENCH-05..BENCH-07) reuses the Phase 48 self-test fixtures
          (vtp_unavailable, mcp_timeout, bad_provenance, compactness) for the
          utility-per-token measurement.

     e. Phase has checked plans, pending tasks ƒÅ' run PLAN LOAD-TIME VALIDATION (Step 6.2) then dispatch per MACH-02 wave plan:

        // Require dispatch-planner at orchestrator startup (zero runtime deps)
        const dispatchPlanner = require('super-gsd/scripts/lib/dispatch-planner.cjs');

        const waves = dispatchPlanner.buildDispatchPlan(plan);

        // CODEX EXECUTOR HARD LOCK.
        // The operator's SGSD runtime is Codex-executor locked: Claude
        // orchestrates only. Flatten every executor wave and run it serially
        // through codex-executor.sh. Do not consult executor_provider for an
        // opt-out and do not use the Claude executor agent as fallback.

 succeeded in 984ms:
        - Interactive / `next` mode ƒÅ' suggest /gsd-discuss-phase.
     b. Phase needs RESEARCH.md ƒÅ' dispatch Codex research (GPT-5.5 / xhigh)
        via `super-gsd/scripts/codex-exec.sh`.
        Write the prompt to `{phaseDir}/{phaseNum}-CODEX-RESEARCH-PROMPT.md`
        and the report to `{phaseDir}/{phaseNum}-RESEARCH.md`. Invoke:
        `--step phase-research --timeout-tier analysis --phase {N}
        --plan research --project {PROJECT_DIR}`. Claude may compose the
        bounded prompt and normalize the report, but must not do the research
        itself in auto mode.
     b.5 VTP ENRICHMENT GATE (Step 6.b.5) ƒ?" Phase has RESEARCH.md AND config.vtp_enrichment.enabled is true ƒÅ'
         D-08 DEGRADED-MODE CHECK (read cached vtp_available from Step 3.7):
           if vtp_available === false:
             // VTP health check failed at cold-start ƒ?" skip gate silently (D-08)
             log deviation: "VTP enrichment gate skipped (degraded mode: vtp_available=false)"
             append to .planning/metrics/vtp-health.jsonl:
               {"ts":"{ISO}","phase":N,"plan":P,"event":"gate_skipped","reason":"vtp_degraded"}
             continue directly to Step 6.c (no sub-agent dispatch, no artifact required)
           // else vtp_available === true: proceed normally below
          run optional VTP enrichment through configured MCP/Codex synthesis. Gate
         precondition: gates.shouldFire('vtp-enrichment', ctx).
         Sub-agent calls vtp-enrichment-gate.cjs composeSubAgentSpec() to
         build 800-token 3-source seed (CONTEXT domain + REQ-IDs AC +
         RESEARCH.md per D-02), runs 5-tool VTP cascade (D-01: tools 1+2
         always; tools 3+4+5 only if hits > 0), writes VTP-ENRICHMENT.md
         per D-04 shape to phaseDir (VTPE-05: always write, even on zero
         hits). Escalation:
           on status=api_error  ƒÅ' write VTP_STATUS degraded row, run Blocker
                                   Recovery Hard Loop if the phase cannot
                                   safely continue without VTP; otherwise
                                   continue to Step 6.c
           on status=empty_hit  ƒÅ' artifact written with empty_hit:true +
                                   rationale; continue to Step 6.c
           on status=success    ƒÅ' artifact written with hits; continue to
                                   Step 6.c
         If config.vtp_enrichment absent or enabled=false: skip silently,
         pass directly to Step 6.c (D-07 backward-compat; no artifact
         required on pre-Phase-21 projects).
     c. Phase needs PLAN.md ƒÅ' enforce planner preflight, then dispatch Codex planner (GPT-5.5 / xhigh)
        PLANNER MODEL LOCK:
        - Planning is a Codex-owned surface in fresh-clone/default SGSD.
          Dispatch through `super-gsd/scripts/codex-exec.sh` with model
          GPT-5.5 and reasoning effort xhigh.
        - If any classifier, router, old prompt, or checkpoint says
          `gsd-planner [sonnet]` or `gsd-planner [opus]`, treat it as stale
          for this surface and route through Codex.
        - This applies to fresh planning, re-planning, gap planning, and
          schema-fix planning.
        PLANNER PREFLIGHT (load-bearing; do not skip on fresh re-dispatch):
        - Read `.planning/config.json`.
        - If `vtp_enrichment.enabled === true`, the planner MUST NOT be
          dispatched until one of these is true:
            1. `{phaseDir}/{phaseNum}-VTP-ENRICHMENT.md` exists; or
            2. `.planning/metrics/vtp-health.jsonl` has a current-phase
               `gate_skipped` / `vtp_degraded` row; or
            3. the operator explicitly says to bypass VTP for this phase.
        - If (1) is false and (2)/(3) are false, dispatch
          `sgsd-vtp-enrichment` now before planner. This applies even when
          RESEARCH.md already existed before this SGSD session or the operator
          asked for a fresh planner after rejecting prior drafts.
        - Add a `<required_reading>` block to the planner prompt containing:
            * CONTEXT.md
            * RESEARCH.md
            * `{phaseNum}-VTP-ENRICHMENT.md` when present
            * REQUIREMENTS.md / CLAUDE.md as usual
        - If VTP was degraded or bypassed, include a literal planner prompt line:
          `VTP_STATUS: unavailable_or_bypassed; reason=<closed reason>; do not
          invent VTP findings.`
        - The planner's Source Audit must include VTP as a source row when a
          VTP artifact exists, or a VTP_STATUS row when it does not.
        - The planner itself must enrich the plan set with VTP/private-KB
          context: read the VTP artifact and, when MCP tools are exposed to
          the planner, call at least one `mcp__vtp-kb__*` tool for
          prior-memory/project/book/architecture uncertainty. If no call is
          possible, it must write a DEVIATION in its report and in the plan
          source audit; silent omission is not allowed.
     d. Phase has plans, needs plan-check ƒÅ' dispatch Codex plan-check
        PLAN-CHECK PREFLIGHT:
        - If `vtp_enrichment.enabled === true`, the checker must verify the
          current phase has either `{phaseNum}-VTP-ENRICHMENT.md` or a current
          degraded/bypass reason. If neither exists, return NOGO with blocker
          `vtp_enrichment_missing_before_planning`.
        - If the artifact exists, verify the plans reference it in their source
          audit or read-list. Missing VTP evidence in every plan is NOGO.
     d.1 PLAN FINALIZATION GATE (Codex ATC + MUDA before execution)
        Precondition: plan-check returned GO.
        Before committing plans or dispatching any executor wave, run a final
        Codex review over the plan set:
        - Build a prompt containing CONTEXT.md, RESEARCH.md, VTP artifact or
          VTP_STATUS, all PLAN.md files, and the plan-check result.
        - Ask Codex GPT-5.5/xhigh to apply:

 succeeded in 1015ms:
// (additionalProperties:true at registry/command-envelope-v1.yaml:260).
// Phase 48 (VTPR-01..06): added 'vtp_bridge' for selective VTP MCP bridge calls
// (uncertainty_type -> MCP tool dispatch via super-gsd/tools/vtp-bridge/classify.cjs).
// Same closed-enum extension pattern as Phase 47 'dispatch_route'. envelope-v1
// contract unchanged (additionalProperties:true at registry/command-envelope-v1.yaml:260).
// Double-agent executor: added 'execution_route' for primary executor routing
// (local-script | codex | claude) with task-capsule, token, fallback, and
// acceptance-test evidence. This extends the existing ledger instead of
// creating a second routing stream.
const BOUNDARIES = Object.freeze([
  'milestone_promotion',
  'phase_dispatch_first',
  'executor_choice',
  'gate_skip',
  'codex_route',
  'handoff_decision',
  'gate_override',
  'dispatch_route',
  'vtp_bridge',
  'execution_route',
]);

// envelope-v1 status enum (command-envelope-v1.json status.enum). Frozen.
const STATUSES = Object.freeze([
  'ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked',
]);

const COMMAND_NAME = 'logRouteDecision';
const ENVELOPE_VERSION = 1;

function jsonlPath(planningDir) {
  return path.join(planningDir, 'metrics', 'route-decisions.jsonl');
}

// run_id pattern matches envelope-v1.json: ISO ts + 4 hex chars.
// Example: 2026-04-27T11:32:01.123Z-a1b2
function generateRunId() {
  const ts = new Date().toISOString();          // ISO-8601, includes ms.
  const rand = crypto.randomBytes(2).toString('hex'); // 4 hex chars.
  return `${ts}-${rand}`;
}

// Validate envelope-v1 run_id pattern. Used only by self-test; production
// path always passes a generated id.
const RUN_ID_REGEX =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}$/;

// Internal: validate + normalize a row. Throws on closed-enum violation.
// Caller responsible for catching (logRouteDecision wraps).
function _normalize(row) {
  if (!row || typeof row !== 'object') {
    throw new Error('route-ledger: row must be an object');
  }
  if (!row.boundary || !BOUNDARIES.includes(row.boundary)) {
    throw new Error(
      `route-ledger: boundary must be one of ${BOUNDARIES.join(', ')}; got '${row.boundary}'`
    );
  }
  if (!row.status || !STATUSES.includes(row.status)) {
    throw new Error(
      `route-ledger: status must be one of ${STATUSES.join(', ')}; got '${row.status}'`
    );
  }
  if (row.reason_codes !== undefined && !Array.isArray(row.reason_codes)) {
    throw new Error('route-ledger: reason_codes must be an array (or omitted)');
  }
  if (row.artifacts !== undefined && !Array.isArray(row.artifacts)) {
    throw new Error('route-ledger: artifacts must be an array (or omitted)');
  }
  if (row.evidence !== undefined && !Array.isArray(row.evidence)) {
    throw new Error('route-ledger: evidence must be an array (or omitted)');
  }

  return {
    envelope_version: ENVELOPE_VERSION,
    ts: row.ts || new Date().toISOString(),
    command: COMMAND_NAME,
    status: row.status,
    reason_codes: Array.isArray(row.reason_codes) ? row.reason_codes.slice() : [],
    artifacts: Array.isArray(row.artifacts) ? row.artifacts.slice() : [],
    evidence: Array.isArray(row.evidence) ? row.evidence.slice() : [],
    next_action: row.next_action ?? null,
    risk: row.risk ?? null,
    duration_ms: typeof row.duration_ms === 'number' ? row.duration_ms : null,
    run_id: row.run_id || generateRunId(),
    phase: row.phase ?? null,
    milestone: row.milestone ?? null,
    // Phase 32 extension fields (additionalProperties: true in envelope-v1):
    boundary: row.boundary,
    decision: row.decision || {},
  };
}

// Manual envelope-v1 schema check (no ajv dep). Asserts every emitted row
// has the 13 required envelope-v1 fields with the correct types and that
// evidence/artifacts inner shapes match the envelope schema. Throws on
// violation -- the public-API try/catch wraps it (writer never throws upward).
function _assertEnvelopeV1(row) {
  // Required-field presence check (envelope-v1.json:7).
  const required = ['envelope_version','ts','command','status','reason_codes',
    'artifacts','evidence','next_action','risk','duration_ms','run_id','phase','milestone'];
  for (const k of required) {
    if (!(k in row)) throw new Error(`route-ledger: emitted row missing required envelope-v1 field '${k}'`);
  }
  // envelope_version is const 1.
  if (row.envelope_version !== 1) {
    throw new Error(`route-ledger: envelope_version must be 1 (got ${row.envelope_version})`);
  }
  // run_id pattern (envelope-v1.json:78).
  if (!RUN_ID_REGEX.test(row.run_id)) {
    throw new Error(`route-ledger: run_id violates envelope-v1 pattern (got '${row.run_id}')`);
  }
  // duration_ms is integer | null with min 0.
  if (row.duration_ms !== null && (!Number.isInteger(row.duration_ms) || row.duration_ms < 0)) {
    throw new Error(`route-ledger: duration_ms must be non-negative integer or null (got ${row.duration_ms})`);
  }
  // evidence items shape: {kind, ref}. artifacts items shape: {kind, path}.
  for (const e of row.evidence) {
    if (!e || typeof e.kind !== 'string' || !e.kind || typeof e.ref !== 'string' || !e.ref) {
      throw new Error(`route-ledger: evidence item must be {kind:string, ref:string} (got ${JSON.stringify(e)})`);
    }
  }
  for (const a of row.artifacts) {
    if (!a || typeof a.kind !== 'string' || !a.kind || typeof a.path !== 'string' || !a.path) {
      throw new Error(`route-ledger: artifacts item must be {kind:string, path:string} (got ${JSON.stringify(a)})`);
    }
  }
}

// Low-level append. Throws on validation; caller wraps.
function appendRow(planningDir, row) {
  if (!planningDir) throw new Error('route-ledger: planningDir required');
  const enriched = _normalize(row);
  _assertEnvelopeV1(enriched);
  const p = jsonlPath(planningDir);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8');
  return enriched;
}

// Defensive read: skip malformed lines (mirror crit-backlog.cjs:120-122).
function readRows(planningDir) {
  const p = jsonlPath(planningDir);
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, 'utf8');
  if (!text.trim()) return [];
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

// Public API. NEVER throws upward. Returns true on append, false on error.
// Stderr-only error logging (32-RESEARCH.md 9.4 LOCKED).
function logRouteDecision(planningDir, args) {
  try {
    appendRow(planningDir, args || {});
    return true;
  } catch (e) {
    console.warn('[SGSD] route-ledger logRouteDecision failed:', e.message);
    return false;
  }
}

// codex_route helper: maps Step 9.5 dispatch state -> envelope row.
// Imported by both the orchestrator (SKILL.md:1236) and the local fallback
// test (route-ledger.test.cjs). Single source of truth for status/code mapping.
function logCodexRoute(planningDir, ctx) {
  try {
    const {
      phase, milestone, plan,
      dispatchResult,
      effectiveProviderName,   // 'codex-cli-reviewer' (the gate-resolved name)
      fallbackProviderName,    // 'openai-codex' | 'claude-via-fallback'
      fallbackTriggered,
      fallbackReason,          // 'parse_failure' | null
      reportPath,              // perDispatchReportPath() | null
    } = ctx || {};

 succeeded in 1021ms:
'use strict';

/**
 * vtp-enrichment-gate.cjs ƒ?" VTP enrichment gate for the research->planning boundary.
 *
 * Exports: { run(opts), vtpCrossRef(text, tier, opts) }
 *
 * run(opts) ƒ?" builds 800-token seed (CONTEXT domain + REQ-IDs AC + RESEARCH.md per D-02),
 *   composes sub-agent spec for the 5-tool VTP cascade (D-01), writes VTP-ENRICHMENT.md
 *   per D-04 shape, returns {status, artifact_path}.
 *   status values: 'success' | 'empty_hit' | 'api_error'
 *
 * vtpCrossRef(text, tier, opts) ƒ?" tier-based batching stub per D-05:
 *   CRITICAL findings: per-finding deep query spec
 *   WARN findings: batched end-of-audit query spec
 *   PASS findings: no-op, returns {citations:[]}
 *
 * Contract (per VTPE-01 + D-07): this module does NOT directly call mcp__vtp-kb__* tools.
 * MCP tools require agent runtime scope (Assumption A1). Instead, run() returns a
 * sub_agent_spec that the calling orchestrator dispatches; the sub-agent invokes callVtp()
 * from vtp-context-composer.cjs in MCP scope.
 *
 * D-07: config.vtp_enrichment absent or enabled=false -> all gates disabled. run() returns
 *   {status:'disabled', artifact_path:null} immediately when disabled.
 *
 * Zero external runtime deps beyond Node builtins + vtp-context-composer.cjs.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// CRIT-fix: VTPE-01 REQ specifies `{NN}-VTP-ENRICHMENT.md` (phase-prefixed),
// matching project convention (CONTEXT, RESEARCH, VERIFICATION, ATC-REVIEW all
// use {NN}- prefix). Use buildArtifactFilename(phase) everywhere ƒ?" do NOT
// reintroduce the unprefixed const.
const ARTIFACT_FILENAME_GENERIC = 'VTP-ENRICHMENT.md';
function buildArtifactFilename(phase) {
  const p = String(phase || '').trim();
  if (/^\d+$/.test(p)) return `${p}-${ARTIFACT_FILENAME_GENERIC}`;  // phase-prefixed
  return ARTIFACT_FILENAME_GENERIC;  // fallback when phase unknown (stub/test)
}
const CONFIG_PATH         = '.planning/config.json';
const QUERY_SEED_MAX_TOKENS = 800;
// Rough chars-per-token for truncation (conservative estimate)
const CHARS_PER_TOKEN     = 4;
const SEED_MAX_CHARS      = QUERY_SEED_MAX_TOKENS * CHARS_PER_TOKEN;

// D-01: 5-tool cascade names (for sub-agent spec composition)
const VTP_TOOLS = [
  'mcp__vtp-kb__vtp_search',
  'mcp__vtp-kb__vtp_search_substrate',
  'mcp__vtp-kb__vtp_search_research',
  'mcp__vtp-kb__vtp_route_and_retrieve',
  'mcp__vtp-kb__vtp_advise_service_enrichment',
];

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

/**
 * Read config.vtp_enrichment block. Returns null if absent or enabled=false.
 * D-07: absent config = DISABLED (no behavioral drift on pre-Phase-21 projects).
 *
 * @param {string} projectDir
 * @returns {{enabled:boolean, max_queries_per_gate:number, query_seed_max_tokens:number, empty_hit_policy:string}|null}
 */
function readVtpEnrichmentConfig(projectDir) {
  const configPath = path.resolve(projectDir, CONFIG_PATH);
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(raw);
    if (!cfg || !cfg.vtp_enrichment) return null;
    const vtpCfg = cfg.vtp_enrichment;
    if (vtpCfg.enabled !== true) return null;
    return {
      enabled: true,
      max_queries_per_gate: vtpCfg.max_queries_per_gate || 5,
      query_seed_max_tokens: vtpCfg.query_seed_max_tokens || QUERY_SEED_MAX_TOKENS,
      empty_hit_policy: vtpCfg.empty_hit_policy || 'continue',
      granularity: vtpCfg.granularity || 'tier-based',
      audit_tier_batching: vtpCfg.audit_tier_batching || {
        critical: 'per-finding',
        warn: 'batched',
        pass: 'skip',
      },
    };
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Seed construction (D-02)
// ---------------------------------------------------------------------------

/**
 * Build query seed from 3 sources (D-02):
 * 1. CONTEXT.md <domain> block
 * 2. REQ-IDs acceptance criteria lines from REQUIREMENTS.md
 * 3. RESEARCH.md findings text
 *
 * Concatenated, truncated to SEED_MAX_CHARS (approx 800 tokens).
 *
 * @param {{phaseDir:string, projectDir:string, phaseContext?:string, requirements?:string, researchFindings?:string}} opts
 * @returns {string}
 */
function buildQuerySeed(opts) {
  const { phaseDir, projectDir, phaseContext, requirements, researchFindings } = opts || {};

  const parts = [];

  // Source 1: provided phaseContext or read from CONTEXT.md
  if (phaseContext && typeof phaseContext === 'string') {
    parts.push(phaseContext.trim());
  } else if (phaseDir) {
    try {
      const files = fs.readdirSync(phaseDir).filter(f => f.endsWith('-CONTEXT.md'));
      if (files.length > 0) {
        const raw = fs.readFileSync(path.join(phaseDir, files[0]), 'utf8');
        // Extract <domain> block if present
        const domainMatch = raw.match(/<domain>([\s\S]*?)<\/domain>/);
        parts.push(domainMatch ? domainMatch[1].trim() : raw.slice(0, 1000).trim());
      }
    } catch (_) { /* ignore ƒ?" phaseDir may not exist in test */ }
  }

  // Source 2: provided requirements or read from REQUIREMENTS.md
  if (requirements && typeof requirements === 'string') {
    parts.push(requirements.trim());
  } else if (projectDir) {
    try {
      const reqPath = path.join(projectDir, '.planning', 'REQUIREMENTS.md');
      const raw = fs.readFileSync(reqPath, 'utf8');
      // Extract VTPE-* lines as proxy for relevant AC
      const lines = raw.split('\n').filter(l => /VTPE-\d+/.test(l));
      if (lines.length > 0) parts.push(lines.slice(0, 20).join('\n').trim());
    } catch (_) { /* ignore */ }
  }

  // Source 3: provided researchFindings or read from RESEARCH.md
  if (researchFindings && typeof researchFindings === 'string') {
    parts.push(researchFindings.trim());
  } else if (phaseDir) {
    try {
      const files = fs.readdirSync(phaseDir).filter(f => f.endsWith('-RESEARCH.md'));
      if (files.length > 0) {
        const raw = fs.readFileSync(path.join(phaseDir, files[0]), 'utf8');
        parts.push(raw.slice(0, 2000).trim());
      }
    } catch (_) { /* ignore */ }
  }

  const combined = parts.join('\n\n---\n\n');
  return combined.length > SEED_MAX_CHARS ? combined.slice(0, SEED_MAX_CHARS) : combined;
}

// ---------------------------------------------------------------------------
// Artifact write (D-04)
// ---------------------------------------------------------------------------

/**
 * Write VTP-ENRICHMENT.md per D-04 shape to phaseDir.
 * VTPE-05 discipline: ALWAYS writes -- even on empty_hit or api_error.
 *
 * vtp_status field values:
 *   'success'   -> normal hit path (hits > 0)
 *   'empty_hit' -> ok=true but zero hits; empty_hit:true in frontmatter
 *   'api_error' -> ok=false; writes stub so artifact existence check passes;
 *                  orchestrator reads vtp_status and halts (blocker)
 *
 * @param {{phaseDir:string, enrichmentResult:Object, vtpStatus?:string}} opts
 * @returns {string} absolute path to written file
 */
function writeEnrichmentArtifact({ phaseDir, enrichmentResult, vtpStatus }) {
  if (!phaseDir) throw new Error('vtp-enrichment-gate: phaseDir required for writeEnrichmentArtifact');
  const res = enrichmentResult || {};
  const phase      = res.phase || 'unknown';
  const hits       = Array.isArray(res.hits) ? res.hits : [];
  const totalHits  = res.total_hits != null ? res.total_hits : hits.length;
  const queryCount = res.query_count || 0;
  const durationMs = res.duration_ms || 0;
  const generatedAt = new Date().toISOString();

  // Determine canonical vtp_status from explicit arg or enrichmentResult fields
  let status = vtpStatus;
  if (!status) {
    if (res.ok === false) {
      status = 'api_error';
    } else if (totalHits === 0) {
      status = 'empty_hit';
    } else {
      status = 'success';
    }
  }
  const isEmptyHit = status === 'empty_hit';
  const isApiError = status === 'api_error';

  const frontmatter = [
    '---',
    `phase: ${phase}`,
    `query_count: ${queryCount}`,
    `total_hits: ${isApiError ? 0 : totalHits}`,
    `duration_ms: ${durationMs}`,
    `empty_hit: ${isEmptyHit}`,
    `vtp_status: ${status}`,
    `generated_at: ${generatedAt}`,
    '---',
    '',
  ].join('\n');

  // api_error: write minimal stub + error block so artifact always exists (VTPE-05)
  if (isApiError) {
    const errorMsg = res.error_message || res.error || 'VTP MCP call failed';
    const body = [
      frontmatter,
      `# VTP Library Enrichment -- Phase ${phase}\n\n`,
      '## API Error\n',
      `Error: ${errorMsg}\n\n`,
      '> ORCHESTRATOR EXIT-BLOCK: vtp_status=api_error signals HALT.\n',
      '> Human must resolve VTP MCP connectivity before this gate can succeed.\n',
    ].join('');
    const artifactPath = path.resolve(phaseDir, buildArtifactFilename(phase));
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(artifactPath, body, 'utf8');
    return artifactPath;
  }

  // Library Hits table (success and empty_hit paths)
  let hitsTable = '## Library Hits\n';
  hitsTable += '| Source | Title | Section | Relevance | Citation |\n';
  hitsTable += '|---|---|---|---|---|\n';
  if (hits.length > 0) {
    for (const h of hits) {
      const source   = (h.source   || '').replace(/\|/g, '/');
      const title    = (h.title    || '').replace(/\|/g, '/');
      const section  = (h.section  || '').replace(/\|/g, '/');
      const relevance = (h.relevance || '').replace(/\|/g, '/');
      const citation = (h.citation || h.doc_id || '').replace(/\|/g, '/');
      hitsTable += `| ${source} | ${title} | ${section} | ${relevance} | ${citation} |\n`;
    }
  } else {
    hitsTable += '| ƒ?" | ƒ?" | ƒ?" | ƒ?" | ƒ?" |\n';
  }

  const gaps = Array.isArray(res.gaps) ? res.gaps : [];
  const gapsSection = [
    '## Gaps the library surfaces',
    gaps.length > 0 ? gaps.map(g => `- ${g}`).join('\n') : '- (none identified)',
    '',
  ].join('\n');

  const framings = Array.isArray(res.alt_framings) ? res.alt_framings : [];
  const framingsSection = [
    '## Alternative framings from library',
    framings.length > 0 ? framings.map(f => `- ${f}`).join('\n') : '- (none identified)',
    '',
  ].join('\n');

  let emptyHitSection = '';
  if (isEmptyHit) {
    const seedSummary = res.seed_summary || '(not provided)';
    const rationale   = res.empty_hit_rationale || 'Library has no coverage for this topic.';
    emptyHitSection = [
      '## Empty-Hit Rationale',
      `Topic: "${seedSummary}"`,
      `Reasoning: "${rationale}"`,
      '',
    ].join('\n');
  }

  const title = `# VTP Library Enrichment -- Phase ${phase}\n\n`;
  const body = [
    frontmatter,

codex
The first material contradiction is already visible: Step 6.b.5 is not a neutral wrapper point. It is a load-bearing planner preflight that runs a phase-level five-tool cascade, while the orchestrator also has a distinct per-dispatch VTP bridge and instructs planners to make an additional MCP call. Adding “triage before every dispatch” has no specified mutual-exclusion rule, so GREEN can produce stacked enrichment rather than substitution. I’m now checking the replay/idempotency and demand-falsifier semantics.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "rg -n -S \"timeout|Abort|Promise\\.race|idempot|dedup|replay|correlation|decision_id|triage_id|fire-and-forget|fire and forget|append-only|appendFileSync|writeFileSync|legacy-disabled\" super-gsd/scripts/lib/vtp-enrichment-gate.cjs super-gsd/scripts/lib/vtp-context-composer.cjs super-gsd/skills/sgsd-orchestrate/SKILL.md super-gsd/scripts/lib/route-ledger.cjs super-gsd/agents/sgsd-vtp-enrichment.md .planning/milestones/v1.5 .planning/milestones/v1.9 2>"'$null' in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "Get-Content -Raw '.planning\\config.json'" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "git status --short; git log -1 --oneline; rg -n -S \"No next milestone declared|awaiting operator|cross-pollination-engine|v3\\.5 SHIPPED\" .planning/STATE.md .planning/MILESTONES.md .planning/milestones/*/ROADMAP.md 2>"'$null' in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "rg -n -S \"route-decisions\\.jsonl|no new ledger|append-only|idempot|dedup|replay|run_id|correlation\" .planning/milestones/v1.7/phases/32-route-decision-ledger .planning/milestones/v1.9/phases/48-selective-vtp-bridge 2>"'$null' in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
 succeeded in 1764ms:
{
  "atc": {
    "classify_model": "codex",
    "complexity_floor_files": 3,
    "complexity_floor_lines": 100,
    "enabled": true,
    "full_threshold_files": 4,
    "lite_threshold_files": 3,
    "lite_threshold_lines": 50,
    "skip_threshold_lines": 10,
    "verifier_adversarial_rate": 0.2
  },
  "browser_verify": {
    "approved_fallbacks": [
      "puppeteer"
    ],
    "base_url": "http://localhost:3000",
    "block_on_failure_auto_mode": false,
    "deferral_ledger_auto_reopen_after_phases": 3,
    "enabled": true,
    "fail_on_console_errors": true,
    "fail_on_network_errors": true,
    "frontend_globs": [
      "**/*.html",
      "**/*.tsx",
      "**/*.jsx",
      "**/*.vue",
      "**/*.svelte",
      "**/*.astro",
      "**/*.css",
      "**/*.scss",
      "src/**/*.ts",
      "frontend/**",
      "web/**",
      "ui/**",
      "pages/**",
      "components/**"
    ],
    "load_timeout_ms": 15000,
    "min_rows_per_route": 1,
    "required_endpoints": [],
    "routes": [
      "/"
    ]
  },
  "deliberation": {
    "auto_gate": true,
    "board": [
      "architect",
      "pragmatist",
      "contrarian",
      "moonshot",
      "researcher"
    ],
    "enabled": true,
    "gate_model": "codex",
    "max_rounds": 2,
    "trigger_phases_affected": 3
  },
  "git": {
    "atomic_commits": true,
    "branching_strategy": "none",
    "commit_docs": true
  },
  "handoff": {
    "enabled": true,
    "log_path": ".planning/metrics/handoff-log.jsonl",
    "max_chain_depth": 5,
    "min_cooldown_seconds": 30,
    "operator_abort_file": ".planning/STOP-HANDOFF",
    "recover_unexpected_auto_stop": true,
    "spawn_args": [
      "--print",
      "--dangerously-skip-permissions",
      "/sgsd-orchestrate go"
    ],
    "spawn_command": "claude",
    "unexpected_stop_max_pulse_age_seconds": 900
  },
  "hooks": {
    "context_warnings": true
  },
  "knowledge": {
    "fallback_corpus": "sgsd-bundled-research",
    "memory_root": ".planning/memory",
    "notes": "Private knowledge stays optional. SGSD memory is project-local by default. Public sources are discovery targets, not blindly ingested content.",
    "private_root": null,
    "public_sources": [
      {
        "description": "Local SGSD docs, briefs, decisions, milestones, and seeded project memory.",
        "enabled": true,
        "id": "sgsd-bundled-research",
        "mode": "local",
        "roots": [
          "README.md",
          "super-gsd/docs",
          ".planning/briefs",
          ".planning/decisions",
          ".planning/memory"
        ]
      },
      {
        "description": "Open computer-science research discovery; use metadata/abstracts first, PDFs only when licensing and relevance are clear.",
        "enabled": false,
        "id": "arxiv-cs",
        "mode": "online",
        "url": "https://arxiv.org/"
      },
      {
        "description": "Google SRE books for reliability, incident response, toil, SLOs, and operational design.",
        "enabled": false,
        "id": "google-sre",
        "mode": "online",
        "url": "https://sre.google/books/"
      },
      {
        "description": "NASA systems engineering handbook for lifecycle, verification, validation, and gate discipline.",
        "enabled": false,
        "id": "nasa-systems-engineering",
        "mode": "online",
        "url": "https://www.nasa.gov/reference/systems-engineering-handbook/"
      },
      {
        "description": "Microsoft REST API guidelines for public API design and governance.",
        "enabled": false,
        "id": "microsoft-api-guidelines",
        "mode": "online",
        "url": "https://github.com/microsoft/api-guidelines"
      },
      {
        "description": "Architecture of Open Source Applications case studies for real system structure.",
        "enabled": false,
        "id": "aosa",
        "mode": "online",
        "url": "https://aosabook.org/en/"
      }
    ],
    "version": 1
  },
  "model_profile": "quality",
  "model_routing": {
    "classifier": "codex",
    "code_reviewer": "codex",
    "context_selector": "codex",
    "executor": "codex",
    "orchestrator": "opus",
    "plan_checker": "codex",
    "planner": "codex",
    "researcher": "codex",
    "verifier": "codex"
  },
  "muda": {
    "inventory_thresholds": {
      "_doc": "MUDAC-02: linear-scale inventory probe thresholds. Final threshold = base * count of dirs in .planning/milestones/. Defaults match codebase fallbacks; absent config block produces identical behaviour.",
      "fail_per_milestone": 5,
      "warn_per_milestone": 2
    }
  },
  "overwatcher": {
    "auto_scan": true,
    "serve": false
  },
  "parallelization": {
    "enabled": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2,
    "plan_level": true,
    "skip_checkpoints": true,
    "task_level": false
  },
  "project": {
    "cockpit_panel_kinds": [
      "token",
      "source_mix",
      "active_agent",
      "codex",
      "intent",
      "governance",
      "budget"
    ],
    "configured_by": "sgsd-new-project-wizard",
    "configured_schema": "v1",
    "default_boot_mode": "auto",
    "operator_preferences": {
      "confirm_destructive": true,
      "verbose_logging": false
    },
    "schema_version": 1
  },
  "review_providers": {
    "codex_cli_path": "auto-detect",
    "codex_enabled": true,
    "executor_provider": "codex",
    "codex_executor_model": "gpt-5.6-sol",
    "codex_executor_reasoning_effort": "xhigh",
    "codex_model": "gpt-5.6-sol",
    "codex_qualitative_waste_enabled": true,
    "codex_reasoning_effort": "xhigh",
    "codex_timeout_seconds": 180,
    "codex_timeout_tiers": {
      "analysis": 180,
      "default": 60,
      "review": 120
    },
    "default_provider": "codex-cli-reviewer",
    "fallback_max_retries": 0,
    "fallback_on_error": false,
    "kill_claude_tokens_saved": 50000,
    "kill_critical_count_delta": 5
  },
  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  },
  "token_efficiency": {
    "checkpoint_threshold_percent": 100000,
    "context_injection": "sgsd_recall",
    "context_warning_percent": 70,
    "log_usage": true,
    "max_prompt_tokens": 1500,
    "max_report_words": 300,
    "state_read": "frontmatter_only"
  },
  "vtp_enrichment": {
    "audit_tier_batching": {
      "critical": "per-finding",
      "pass": "skip",
      "warn": "batched"
    },
    "challenger_mode": false,
    "empty_hit_policy": "continue",
    "enabled": true,
    "granularity": "tier-based",
    "max_queries_per_gate": 5,
    "query_seed_max_tokens": 800
  },
  "workflow": {
    "agent_report_max_words": 300,
    "auto_advance": true,
    "discuss_mode": "discuss",
    "granularity": "standard",
    "mode": "yolo",
    "nyquist_validation": true,
    "plan_check": true,
    "plan_fix_retry_cap": 3,
    "plan_format": "compressed_xml",
    "research": true,
    "research_before_questions": false,
    "schema_v2_hash": "5867692da13edf8939bc4ab898768e9c5e9938716f4754d4583eaa2f7d0d5631",
    "security_asvs_level": 1,
    "security_block_on": "high",
    "security_enforcement": true,
    "skip_discuss": false,
    "triage_vtp_enrichment": true,
    "verifier": true,
    "planner_model": "codex",
    "planner_reasoning_effort": "xhigh",
    "plan_final_codex_review": true,
    "plan_final_muda_review": true,
    "auto_continue_until_roadmap_complete": true,
    "planning_pipeline_enforced": true
  }
}


 succeeded in 1779ms:
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-VERIFICATION.md:28:| A3 | MCP failures logged separately | VERIFIED | `_logVtpBridgeFailure` writes to `.planning/metrics/vtp-bridge-failures.jsonl` (separate from `route-decisions.jsonl`); file absent only because no failure has occurred yet (lazy-create) |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:43:    - "every bridge call also emits ONE envelope-v1 row to route-decisions.jsonl with boundary='vtp_bridge' via Phase 32 logRouteDecision (no new ledger; EXISTING-SURFACE-AUDIT:139)"
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:279:| Forward contract -- Phase 49 reads vtp-bridge-failures.jsonl + route-decisions.jsonl boundary='vtp_bridge' | 48-RESEARCH.md L1042-1050 | T1 produces both streams; no Phase 49 coupling beyond shape | T1 |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:371:    Assertion 10 (F10 -- read-only canonical streams invariant): snapshot size+mtime of `.planning/metrics/codex-log.jsonl`, `.planning/metrics/route-decisions.jsonl`, `.planning/metrics/vtp-health.jsonl` BEFORE self-test; run self-test (which uses fixture-scoped tmpdir for vtp-bridge-failures.jsonl); assert all three canonical streams UNCHANGED.
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:503:       `.planning/metrics/route-decisions.jsonl`, `.planning/metrics/vtp-health.jsonl`.
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:556:     - Confirm `.planning/metrics/codex-log.jsonl`, `route-decisions.jsonl`,
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:591:    `metrics/route-decisions.jsonl` (already its pattern); canonical .planning
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:624:          const lines = fs.readFileSync(path.join(tmpDir, 'metrics', 'route-decisions.jsonl'), 'utf8').trim().split('\n');
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:783:     `.planning/metrics/route-decisions.jsonl` (boundary='vtp_bridge',
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:858:| selectiveVTPCall -> .planning/metrics/vtp-bridge-failures.jsonl | Append-only canonical stream; no read-back execution path; row content includes raw error_message but NEVER injected back into evidence_packet.results[] |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:859:| selectiveVTPCall -> Phase 32 logRouteDecision -> route-decisions.jsonl | Append-only via existing trusted ledger surface; envelope-v1 schema enforced; closed-enum boundary |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:869:| T-48-04 | Repudiation | Bridge call succeeds but no record of evidence provenance for later audit | mitigate | Every success/failure call emits TWO canonical rows: (a) `vtp-bridge-failures.jsonl` row on failure ONLY, (b) `route-decisions.jsonl` envelope-v1 row on EVERY call (success and failure). Both include `run_id`, `ts`, `phase`, `milestone`, `decision.{tool, uncertainty_type, result_count, body_token_estimate, error_logged_at}`. |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:875:| T-48-10 | Information Disclosure | Self-test inadvertently writes to canonical `.planning/metrics/route-decisions.jsonl` or `vtp-bridge-failures.jsonl` during CI runs, polluting production telemetry | mitigate | All self-test writes use `fs.mkdtempSync(os.tmpdir(), 'vtp-bridge-')` for isolated tmpdir. Self-test F10 fingerprints (size+mtime) of `.planning/metrics/codex-log.jsonl`, `route-decisions.jsonl`, `vtp-health.jsonl` BEFORE and AFTER self-test and asserts UNCHANGED. F7 does the same for `super-gsd/tools/context-packet/build.cjs`, `super-gsd/tools/dispatch-router/route.cjs`, `super-gsd/scripts/lib/route-ledger.cjs`. |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:1015:    `route-decisions.jsonl` rows where `boundary='vtp_bridge'`); no `require()`
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:1027:  route-decisions.jsonl boundary='vtp_bridge' decision shape).
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:13:Critical to A3 (MCP failure separation): Phase 48 introduces a NEW append-only canonical stream `.planning/metrics/vtp-bridge-failures.jsonl` whose entire purpose is to keep VTP MCP error/timeout/auth-fail rows visually and structurally distinguishable from the evidence packet path. When the MCP fails, the bridge returns an empty `results[]` packet plus an `error_logged_at` reference; it does NOT inject the error message into the packet body where downstream consumers might mistake it for a research conclusion. This is the same pattern Phase 14 codex-log uses (self-test rows live alongside dispatch rows but in distinct vocabularies).
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:78:- Cockpit display of VTP bridge state (Phase 50 reads `vtp-bridge-failures.jsonl` + `route-decisions.jsonl rows where boundary='vtp_bridge'`).
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:115:| Append vtp_bridge route decision row | route-ledger.cjs::logRouteDecision (EXISTING) | route-decisions.jsonl (EXISTING file) | EXISTING-SURFACE-AUDIT:139 — extend boundary, not ledger |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:133:| `route-ledger.cjs` | super-gsd/scripts/lib/route-ledger.cjs | Append envelope-v1 rows to route-decisions.jsonl with `boundary='vtp_bridge'` | Phase 32 owner; Phase 47 already extended to 8 boundaries; LOCK 13 binding (never throws) |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:150:| `.planning/metrics/vtp-bridge-failures.jsonl` | Append-only canonical stream for MCP failures (NEW) | `vtp-health.jsonl` shape (Phase 32 surface) |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:174:| New `vtp-bridge-failures.jsonl` | Append failures to `route-decisions.jsonl` with `status='fail'` | Already done (Phase 48 emits both rows) — but route-decisions is a DECISION ledger; bridge call FAILURES need their own row with tool/error_type/error_message detail | BOTH chosen (decision row + failure row; differentiated by `command` field) |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:300:                │ route-decisions.jsonl via        │
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:455:      run_id: _generateRunId(),                  // mirror route-ledger generateRunId
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:532:- **Inventing a second route ledger.** EXISTING-SURFACE-AUDIT:139. Use route-decisions.jsonl with `boundary='vtp_bridge'`. (`vtp-bridge-failures.jsonl` is a NEW failure stream, not a route ledger.)
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:550:| run_id generation | A new formatter | `route-ledger.cjs::generateRunId` (existing) | envelope-v1 conformance |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:581:**Warning signs:** route-decisions.jsonl rows with `boundary='vtp_bridge'` AND `decision.uncertainty_type` not in `['architecture_challenge','prior_memory_lookup','book_lookup']`.
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:902:   - What we know: Phase 50 reads `route-decisions.jsonl` (rows where `boundary='vtp_bridge'`) and the new `vtp-bridge-failures.jsonl`. Both stay simple.
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:1034:- **Every new projection gets a rebuild test** — Followed: `vtp-bridge-failures.jsonl` is append-only canonical (NOT a projection — primary stream).
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:1044:- `.planning/metrics/route-decisions.jsonl` rows where `boundary='vtp_bridge'` — successful bridge calls
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:1063:- `route-decisions.jsonl` rows where `boundary='vtp_bridge'` → success rate, average packet size
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:1100:| F10 | Read-only invariant: snapshot `.planning/metrics/codex-log.jsonl`, `route-decisions.jsonl` size+mtime BEFORE self-test; assert UNCHANGED after self-test (only `vtp-bridge-failures.jsonl` in tmpdir written, never canonical streams) | Lock 4 read-only |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:16:## Findings (deduplicated)
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:28:- Belt-and-braces fix added: `_assertEnvelopeV1(enriched)` step in `appendRow` (route-ledger.cjs) now does manual schema validation (13 required fields present, envelope_version === 1, run_id pattern match, duration_ms type, evidence/artifacts inner shape). Closes Codex's WARN-1 ("validation is shallow") at the same time.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:45:- Fix: anchored to `__dirname` instead. Lib lives at `<repo>/super-gsd/scripts/lib/route-ledger.cjs`; canonical at `<repo>/.planning/metrics/route-decisions.jsonl`; 3-dirs-up + .planning resolves consistently regardless of invocation cwd.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:49:- Fix: added `_assertEnvelopeV1(enriched)` step in `appendRow`. Manual schema validation without adding ajv dep. Checks: 13 required fields present, envelope_version === 1, run_id pattern match, duration_ms type+range, evidence items have {kind, ref}, artifacts items have {kind, path}. Throws on violation; public-API try/catch still preserves never-throws-upward contract.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:68:| 2 Delete | PASS | Deduplicated wire-in (removed orphan post-branch copy after C1 fix). |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:28:    - "self-test isolated to os.tmpdir() -- never touches canonical .planning/metrics/route-decisions.jsonl"
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:40:Phase 32 lands the Route Decision Ledger: an append-only
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:41:`.planning/metrics/route-decisions.jsonl` stream + a writer module
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:83:- required: [envelope_version, ts, command, status, reason_codes, artifacts, evidence, next_action, risk, duration_ms, run_id, phase, milestone]
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:86:- run_id pattern: ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}$
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:133:        run_id matching the envelope-v1 regex, command === 'logRouteDecision'.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:141:      - Self-test never touches canonical .planning/metrics/route-decisions.jsonl
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:186:// Source of truth: .planning/metrics/route-decisions.jsonl (machine-readable)
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:189:// Append-only. Every row is a valid command-envelope-v1 row PLUS
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:211://     run_id:           "YYYY-MM-DDTHH:MM:SS.sssZ-XXXX" (4hex),
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:257:  return path.join(planningDir, 'metrics', 'route-decisions.jsonl');
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:260:// run_id pattern matches envelope-v1.json: ISO ts + 4 hex chars.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:268:// Validate envelope-v1 run_id pattern. Used only by self-test; production
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:270:const RUN_ID_REGEX =
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:310:    run_id: row.run_id || generateRunId(),
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:440:  const realLedger = path.join(process.cwd(), '.planning', 'metrics', 'route-decisions.jsonl');
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:476:      RUN_ID_REGEX.test(rows[0].run_id) &&
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:509:    // 8. Append-only (no truncation).
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:542:    // 12. Self-test never touches canonical .planning/metrics/route-decisions.jsonl.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:892:      run_id matching envelope-v1 regex, command === 'logRouteDecision'
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:911:logCodexRoute and writes a real route-decisions.jsonl row with
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:959:| route-ledger.cjs -> filesystem | fs.appendFileSync to .planning/metrics/route-decisions.jsonl |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:960:| route-decisions.jsonl -> downstream consumers | Phase 34 review-ledger / cockpit will tail-read; Phase 32 does not consume |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:973:| T-32-08 | Spoofing | Forged route-decisions.jsonl row from outside the orchestrator | accept | local-FS attacker could write directly; out of scope for in-process telemetry; downstream consumers (Phase 34) handle integrity |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:981:V6 Cryptography: minor -- crypto.randomBytes(2) for run_id; no key
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:1037:    run_id matches envelope-v1 pattern
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:15:Land an append-only `.planning/metrics/route-decisions.jsonl` ledger plus
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:36:   - `logRouteDecision({boundary, decision, reason_codes, evidence, phase, milestone, duration_ms, run_id?})` exported function
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:38:     `{envelope_version: 1, ts, command: "logRouteDecision", status, run_id, boundary, decision, reason_codes, artifacts, evidence, next_action, risk, duration_ms, phase, milestone}`
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:49:     6. run_id auto-generated when absent (matches envelope-v1 regex)
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:71:     route-decisions.jsonl row matches the expected envelope shape
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:100:- 9.5 random hex run_id pattern (LOCKED)
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-VERIFICATION.md:16:> Land an append-only `.planning/metrics/route-decisions.jsonl` ledger plus a writer module (`route-ledger.cjs`) that every orchestrator routing decision can log to. Phase 32 SHIPS one production caller (codex_route boundary) -- the 5 remaining boundary types are pre-declared in the schema but wired later (no schema-without-consumer violation: codex_route IS the consumer).
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-VERIFICATION.md:46:| **ROUTE-04** | Each row contains required envelope-v1 fields + extension fields; evidence[] uses `{kind, ref}` | Runtime emission test confirms all 13 envelope-v1 required fields present (envelope_version=1, ts, command='logRouteDecision', status, reason_codes, artifacts, evidence, next_action, risk, duration_ms, run_id, phase, milestone) PLUS 2 extension fields (boundary, decision). Evidence shape verified `[{"kind":"review_report","ref":"x.md"}]` -- uses `ref` per Phase 31 contract, not `path`. d1fefc1 BLOCKER fix landed (executor honored it: lib line 218-220 emits evidence with `ref`, lib line 238 `artifacts: []`). | PASS |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-VERIFICATION.md:73:| All 13 envelope-v1 required fields present in emitted rows | Runtime verification: envelope_version=1, ts (ISO-8601 string), command='logRouteDecision', status (envelope-v1 enum), reason_codes (array), artifacts (array), evidence (array), next_action (null default), risk (null default), duration_ms (null default), run_id (matches envelope-v1 regex), phase (string), milestone (string). All 13 present. | PASS |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-VERIFICATION.md:76:| run_id matches envelope-v1 pattern `^[0-9]{4}-[0-9]{2}-...Z-[a-f0-9]{4}$` | Runtime sample: `2026-04-27T08:20:12.009Z-3451`. Self-test assertion 4 + 11 verify uniqueness over 100 calls. | PASS |
.planning/milestones/v1.7/phases/32-route-decision-ledger\codex-review-prompt.txt:27:1. Lib correctness (run_id regex actually matches envelope-v1 pattern; BOUNDARIES frozen; STATUSES enum aligned with envelope-v1 6-state; try/catch wrap means writer never throws upward)
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:14:- **ROUTE-01:** `.planning/metrics/route-decisions.jsonl` writer module with `--self-test`.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:38:- A renderer for `route-decisions.jsonl` (no `.md` view in v1.7).
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:59:Phase 32 lands a tiny append-only writer (`super-gsd/scripts/lib/route-ledger.cjs`)
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:90:| Append-only persistence | Filesystem JSONL (`.planning/metrics/route-decisions.jsonl`) | Same contract as crit-backlog.jsonl, edge-guard-log.jsonl, codex-log.jsonl |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:213:  "run_id": "rd-2026-04-27T11-32-01-123Z-a1b2",
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:239:| `run_id` | auto | envelope-v1 | `rd-{ts-with-dashes}-{4hex}` mirroring `crit-backlog.cjs:34-38` |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:299:   ISO-shaped `ts`, non-empty `run_id`.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:309:8. **Append-only**: two appends produce two rows; file never truncated.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:313:11. **Run_id uniqueness on rapid succession**: 100 appends -> 100 distinct `run_id`s.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:315:    `fs.existsSync('.planning/metrics/route-decisions.jsonl')` unchanged at end (capture
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:326:produces a row in `route-decisions.jsonl` with `boundary=codex_route` and non-empty
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:378:**6.1 Append-only, never mutate.** `fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8')`
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:401:**6.6 Generated id (`run_id`).** `crit-backlog.cjs:34-38`:
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:556:| 9.12 | JSONL location? | **`.planning/metrics/route-decisions.jsonl`** | Per ROUTE-01 verbatim |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:579:| Node `crypto` | Node 20+ | randomBytes for run_id | [VERIFIED: crit-backlog.cjs:27] |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:590:**Pattern 1: JSONL append + render** (`crit-backlog.cjs:107-113`) — append-only structured streams.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:724:| V6 Cryptography | yes (minor) | `crypto.randomBytes(2)` for run_id; no key material |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:747:| `codex-log.jsonl` as only routing-decision evidence | `route-decisions.jsonl` is canonical route-decision stream; `codex-log.jsonl` keeps recording shell-wrapper telemetry | THIS phase | Cockpit reads route-decisions for routing signal; codex-log for shell-runtime signal |
.planning/milestones/v1.7/phases/32-route-decision-ledger\PHASE-CAPSULE.json:7:  "goal": "Land an append-only `.planning/metrics/route-decisions.jsonl` ledger plus",
.planning/milestones/v1.7/phases/32-route-decision-ledger\PHASE-CAPSULE.json:177:        "run_id": "2026-04-27T08:23:24Z",
.planning/milestones/v1.7/phases/32-route-decision-ledger\PHASE-CAPSULE.json:183:      "run_id": "2026-04-27T11:19:55.689Z-01d6",

 succeeded in 1825ms:
super-gsd/agents/sgsd-vtp-enrichment.md:6:status: legacy-disabled
super-gsd/scripts/lib/vtp-context-composer.cjs:256:  fs.appendFileSync(logPath, JSON.stringify(row) + '\n');
super-gsd/scripts/lib/vtp-context-composer.cjs:332:    // Narrow-catch: swallow VTP/MCP/timeout shape errors; rethrow unknown.
super-gsd/scripts/lib/vtp-context-composer.cjs:333:    if (!/^(vtp_|mcp_|timeout)/.test(msg)) throw err;
super-gsd/scripts/lib/vtp-context-composer.cjs:334:    const status = /^timeout/.test(msg) || /timeout/.test(msg)
super-gsd/scripts/lib/vtp-context-composer.cjs:335:      ? 'timeout'
super-gsd/scripts/lib/vtp-context-composer.cjs:383:  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '---\nmilestone: "self-test"\ncurrent_phase: "16"\n---\n', 'utf8');
super-gsd/scripts/lib/vtp-context-composer.cjs:524:      // Test 7: callVtp failure path (vtp_timeout) returns {ok:false} + logs row
super-gsd/scripts/lib/vtp-context-composer.cjs:532:          mcpInvoke: async () => { throw new Error('vtp_timeout: exceeded budget'); },
super-gsd/scripts/lib/vtp-context-composer.cjs:535:        if (passed && !/^vtp_timeout/.test(r7.reason)) fail(`Test7: reason should start vtp_timeout, got '${r7.reason}'`);
super-gsd/scripts/lib/vtp-context-composer.cjs:542:          if (last.failure_reason !== 'vtp_timeout: exceeded budget') {
super-gsd/scripts/lib/vtp-enrichment-gate.cjs:231:    fs.writeFileSync(artifactPath, body, 'utf8');
super-gsd/scripts/lib/vtp-enrichment-gate.cjs:291:  fs.writeFileSync(artifactPath, body, 'utf8');
super-gsd/scripts/lib/vtp-enrichment-gate.cjs:617:        fs.writeFileSync(
super-gsd/scripts/lib/vtp-enrichment-gate.cjs:651:        fs.writeFileSync(
super-gsd/scripts/lib/vtp-enrichment-gate.cjs:829:          error_message: 'MCP connection timeout',
super-gsd/scripts/lib/vtp-enrichment-gate.cjs:837:          if (passed && !content17.includes('MCP connection timeout')) fail('Test17: error_message missing');
super-gsd/scripts/lib/route-ledger.cjs:22://     status:           ok|warn|fail|skipped|timeout|blocked,
super-gsd/scripts/lib/route-ledger.cjs:42:// locking required. fs.appendFileSync is atomic at row boundary on POSIX
super-gsd/scripts/lib/route-ledger.cjs:90:  'ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked',
super-gsd/scripts/lib/route-ledger.cjs:203:  fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8');
super-gsd/scripts/lib/route-ledger.cjs:259:    } else if (dr.exit === 5 || dr.timeout_hit === true) {
super-gsd/scripts/lib/route-ledger.cjs:260:      status = 'timeout';
super-gsd/scripts/lib/route-ledger.cjs:261:      reasonCodes.push('codex_timeout');
super-gsd/scripts/lib/route-ledger.cjs:287:      timeout_hit: !!dr.timeout_hit,
super-gsd/scripts/lib/route-ledger.cjs:336:      STATUSES.includes('timeout') && STATUSES.includes('blocked'));
super-gsd/scripts/lib/route-ledger.cjs:401:    fs.appendFileSync(jsonlPath(tmp), '{not-json\n', 'utf8');
super-gsd/skills/sgsd-orchestrate/SKILL.md:219:         fs.appendFileSync(logPath,
super-gsd/skills/sgsd-orchestrate/SKILL.md:342:       fs.appendFileSync('.planning/metrics/vtp-health.jsonl',
super-gsd/skills/sgsd-orchestrate/SKILL.md:746:        `--step phase-research --timeout-tier analysis --phase {N}
super-gsd/skills/sgsd-orchestrate/SKILL.md:837:          `--step plan-final-review --timeout-tier analysis --phase {N}
super-gsd/skills/sgsd-orchestrate/SKILL.md:1018:          route-decisions.jsonl (boundary='vtp_bridge', status='fail'|'timeout'). The
super-gsd/skills/sgsd-orchestrate/SKILL.md:1046:          (vtp_unavailable, mcp_timeout, bad_provenance, compactness) for the
super-gsd/skills/sgsd-orchestrate/SKILL.md:1384:              timeout: effective.timeout_seconds || config.review_providers.codex_timeout_seconds,
super-gsd/skills/sgsd-orchestrate/SKILL.md:1388:              timeoutTier: 'analysis',  // D-05 #3: phase-level-ATC -> analysis tier (90s, not review 120s)
super-gsd/skills/sgsd-orchestrate/SKILL.md:1389:              retryOnTimeoutEscalate: true,  // D-05 #5: auto-escalate once to analysis on timeout
super-gsd/skills/sgsd-orchestrate/SKILL.md:1395:              const providerFailureReason = (dispatchResult.timeout_hit || dispatchResult.exit === 5)
super-gsd/skills/sgsd-orchestrate/SKILL.md:1396:                ? 'codex_timeout'
super-gsd/skills/sgsd-orchestrate/SKILL.md:1398:              // Do not write "Codex unavailable" for timeout. Auth/availability and
super-gsd/skills/sgsd-orchestrate/SKILL.md:1586:              load_timeout_ms from config
super-gsd/skills/sgsd-orchestrate/SKILL.md:1811:              The skill is idempotent. If the milestone is already archived, it returns PASS.
super-gsd/skills/sgsd-orchestrate/SKILL.md:2211:            timeout: effective.timeout_seconds || config.review_providers.codex_timeout_seconds,
super-gsd/skills/sgsd-orchestrate/SKILL.md:2215:            timeoutTier: 'analysis',  // D-05 #3: phase-level-ATC -> analysis tier (90s, not review 120s)
super-gsd/skills/sgsd-orchestrate/SKILL.md:2221:            const providerFailureReason = (dispatchResult.timeout_hit || dispatchResult.exit === 5)
super-gsd/skills/sgsd-orchestrate/SKILL.md:2222:              ? 'codex_timeout'
super-gsd/skills/sgsd-orchestrate/SKILL.md:2224:            // Do not write "Codex unavailable" for timeout. Auth/availability and
super-gsd/skills/sgsd-orchestrate/SKILL.md:2261:              dispatchResult,                                             // exit, timeout_hit (in scope)
super-gsd/skills/sgsd-orchestrate/SKILL.md:2439:                  timeout: challengerProvider.timeout_seconds || config.review_providers.codex_timeout_seconds,
super-gsd/skills/sgsd-orchestrate/SKILL.md:2443:                  timeoutTier: 'review'  // --timeout-tier review (D-03: adversarial → review tier = 120s)
super-gsd/skills/sgsd-orchestrate/SKILL.md:2453:                  const providerFailureReason = (dispatchResult.timeout_hit || dispatchResult.exit === 5)
super-gsd/skills/sgsd-orchestrate/SKILL.md:2454:                    ? 'codex_timeout'
super-gsd/skills/sgsd-orchestrate/SKILL.md:2582:do NOT crash the run (event-emit is fire-and-forget; legacy ledgers remain
.planning/milestones/v1.9\EXISTING-SURFACE-AUDIT.md:109:   The cross-check saw schema validation failure and timeout. VTP failures must
.planning/milestones/v1.9\MILESTONE-READINESS.md:35:| 48 | Selective VTP Bridge | ~60m | Upstream: 45+47 (both GO). VTP MCP not confirmed available in this session — but phase is designed for degraded mode: "Defer VTP automation if MCP returns schema/timeouts without reliable fallback." DEGRADED-OK. |
.planning/milestones/v1.9\REQUIREMENTS.md:321:- Defer VTP automation if MCP returns schema/timeouts without reliable fallback.
.planning/milestones/v1.9\ROADMAP.md:229:- MCP validation/timeouts are logged separately from conclusions;
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-CONTEXT.md:69:   - Backfilled from token-attribution.jsonl (11,173 source rows; idempotent
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-CONTEXT.md:70:     via `agent_id + ts` dedup tuple)
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-CONTEXT.md:89:  source rows available); idempotent re-run yields byte-identical output
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-VERIFICATION.md:12:GOAL_ACHIEVED: YES — ledger (11,294 rows) + bloat report (7 H2 sections, 5 R-rules, all 3 audit markers) emitted by a read-only mirror of Phase 36; orchestrator self-spend included; idempotent backfill confirmed.
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-VERIFICATION.md:23:READ_ONLY_INVARIANT: PASS — `grep` confirms zero `appendFileSync/writeFileSync` calls in production code paths target `.planning/metrics/{codex-log,token-log,activity-log,muda-log}.jsonl`. Two `writeFileSync` matches at lines 871/876 are inside `--self-test` only and write to OS-tmpdir test fixtures, never to canonical streams. Production writes target only `agent-token-spend.jsonl` (line 279) and `baseline-token-spend.md` (line 738).
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-VERIFICATION.md:45:ONE_LINER: Phase 41 ships a faithful Phase-36-mirror token-attribution tool that produces an envelope-v1-conformant 11,294-row ledger plus a substantive bloat report exposing the 1.24M-token v1.9/P41 orchestrator signature; idempotent, read-only, self-test green, all 5 substitution rules and 3 audit markers honored.
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:21:    stop_rule: "self-test 14/14 PASS; --backfill produces >=10000 rows; --backfill idempotent (byte-identical re-run); --report produces baseline-token-spend.md with top-consumer + outlier + substitution-candidate sections."
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:31:    - "Idempotent dedup via (agent_id + ts) tuple per RESEARCH 3"
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:104:status:           ok|warn|fail|skipped|timeout|blocked
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:120:const STATUSES = Object.freeze(['ok','warn','fail','skipped','timeout','blocked']);
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:173: "timeout_hit":true,"fallback_triggered":false,"stderr_preview":"..."}
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:178:From super-gsd/tools/token-attribution/collect.cjs:99-106 (idempotency):
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:189:Phase 41 reuses this pattern with `evidence[0].ref` (synthetic dedup
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:290:        'timeout','blocked'])  (envelope-v1 6-state enum)
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:312:      - Atomic append via fs.appendFileSync to
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:330:        * status from deriveStatus(exit, timeout_hit, fallback_triggered):
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:332:          timeout_hit -> timeout with ['codex_timeout','tokens_estimated'];
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:339:      - IDEMPOTENT: dedup keyed on
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:464://     status:           ok|warn|fail|skipped|timeout|blocked,
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:467://     evidence:         {kind,ref}[],         // synthetic source-row dedup ref
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:516:  'ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked',
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:571:function deriveCodexStatus(exit, timeoutHit, fallbackTriggered) {
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:572:  if (timeoutHit)        return { status: 'timeout', codes: ['codex_timeout', 'tokens_estimated'] };
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:710:  fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8');
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:747:// Idempotency: dedup keyed on evidence[0].ref.
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:781:        if (seen.has(built._dedupRef)) { out.rowsSkipped++; continue; }
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:782:        seen.add(built._dedupRef);
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:784:          delete built._dedupRef;
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:799:// Returns row + _dedupRef sentinel or null if source row is unusable.
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:821:      const dedupRef = `attribution:${raw.event_id}`;
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:826:        evidence: [{ kind: 'token_attribution_row', ref: dedupRef }],
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:834:        _dedupRef: dedupRef,
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:850:      const dedupRef = `attribution:${raw.event_id}`;
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:855:        evidence: [{ kind: 'token_attribution_row', ref: dedupRef }],
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:862:        _dedupRef: dedupRef,
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:869:    const stat = deriveCodexStatus(raw.exit, raw.timeout_hit, raw.fallback_triggered);
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:885:    const dedupRef = `codex:${raw.ts}:${raw.phase}:${raw.step}`;
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:890:      evidence: [{ kind: 'codex_log_row', ref: dedupRef }],
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:898:      _dedupRef: dedupRef,
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:917:    const dedupRef = `legacy:${raw.ts}:${raw.phase || ''}:${raw.tool || ''}`;
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:922:      evidence: [{ kind: 'token_log_row', ref: dedupRef }],
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:929:      _dedupRef: dedupRef,
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:1170:      fs.writeFileSync(out, md, 'utf8');
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:1217:      ['ok','warn','fail','skipped','timeout','blocked'].every((s) => STATUSES.includes(s)));
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:1278:      fs.appendFileSync(ledgerPath(tmp10), '{not-json\n', 'utf8');
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:1292:      fs.writeFileSync(tA, [
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:1303:      fs.writeFileSync(path.join(srcDir, 'codex-log.jsonl'),
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:1306:          timeout_hit:false, fallback_triggered:false}) + '\n');
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:1308:      fs.writeFileSync(path.join(srcDir, 'token-log.jsonl'), [
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:1324:      assert('11b. backfillFromMetrics idempotent on re-run',
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:1523:   (byte-identical). If diff differs: STOP; dedup is broken; rewind T1.
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:1578:diff -q .planning/metrics/agent-token-spend.jsonl /tmp/ats-snapshot-2.jsonl && echo "PASS idempotent" || (echo "FAIL idempotent"; exit 1)
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:1599:idempotency + canonical untouched.
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:1788:# === BASE-02 idempotency ===
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:1792:  && echo "PASS idempotent" \
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:1793:  || (echo "FAIL idempotent"; exit 1)
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-01-baseline-token-attribution-PLAN.md:1837:      byte-identical output (BASE-02 idempotency).
.planning/milestones/v1.9\phases\41-baseline-token-attribution\reviews\41-REVIEW.md:16:| Codex (sgsd-codex-reviewer) | provider_unavailable | n/a (timeout 180s) | Tier resolver capped phase-level-ATC at TIER_ANALYSIS=180s; gpt-5.5 xhigh exceeded budget. Logged at `.planning/metrics/codex-log.jsonl` exit=5, `.planning/metrics/codex-timeout-observability.jsonl` row appended. Per established v1.7+v1.8 degradation pattern, single-provider verdict is authoritative when one provider is unavailable. |
.planning/milestones/v1.9\phases\41-baseline-token-attribution\reviews\41-REVIEW.md:50:- **IDEMPOTENCY**: PASS — re-backfill produces 0 appends when source streams unchanged; 1 append observed when live SGSD heartbeat added 1 new orchestrator self-spend row to token-attribution.jsonl mid-test (correct behavior — dedup skipped 11,308 known event_ids).
.planning/milestones/v1.9\phases\41-baseline-token-attribution\reviews\41-REVIEW.md:51:- **MIRROR_FIDELITY**: PASS post-fix — 4x Object.freeze, 7 _normalize/_assertEnvelopeV1 sites, never-throws-upward, __dirname-anchored 3-up fingerprint guard, 15/15 self-test assertions match Phase 36 pattern (1 added: 11b idempotency sub-assertion).
.planning/milestones/v1.9\phases\41-baseline-token-attribution\reviews\41-REVIEW.md:63:**PASS** (post-fix). Phase 41 deliverables hold all critical invariants; Claude REVISE-finding addressed; Codex timeout logged as provider_unavailable per established degradation pattern. Commit chain: `7386a7d` (lib) -> `373e9c1` (ledger) -> `d1f72cd` (report) -> `ef90751` (fix). Cross-phase contracts ready: Phase 42 BUDGET-01 imports `summarize()`, Phase 47 ROUTE-02 reads R1-R5 candidates, Phase 51 BENCH-01 uses baseline as "before" measurement for >=50% reduction acceptance.
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-03-dashboard-telemetry-PLAN.md:5:plan_name: Dashboard math + timeout observability (INSTR-02 + INSTR-03)
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-03-dashboard-telemetry-PLAN.md:38:      Adding `codex-timeout-observability.jsonl` row emit at the timeout
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-03-dashboard-telemetry-PLAN.md:39:      branch in codex-exec.sh gives the dashboard observable timeout-rate-
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-03-dashboard-telemetry-PLAN.md:47:         `.planning/metrics/codex-timeout-observability.jsonl`:
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-03-dashboard-telemetry-PLAN.md:50:      2. Compute tier_actual_via_retry: when --retry-on-timeout-escalate
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-03-dashboard-telemetry-PLAN.md:54:         the emit never breaks the timeout path.
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-03-dashboard-telemetry-PLAN.md:60:      - cmd: grep -c "codex-timeout-observability.jsonl" super-gsd/scripts/codex-exec.sh
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-03-dashboard-telemetry-PLAN.md:64:# 25-03 — Dashboard math + timeout observability
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-03-dashboard-telemetry-PLAN.md:76:## INSTR-03 — timeout observability metric
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-03-dashboard-telemetry-PLAN.md:78:New `.planning/metrics/codex-timeout-observability.jsonl` written at every
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-03-dashboard-telemetry-PLAN.md:79:RC=124 timeout event. Dashboard tile "timeout rate by tier" can now report
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-03-dashboard-telemetry-PLAN.md:86:Low — both changes are append-only and degrade gracefully (mkdir -p,
.planning/milestones/v1.5\SUMMARY.md:39:Elevate the VTP knowledge library from passive MCP server into an active enrichment gate fired on every research / planning / audit / deliberation boundary; close v1.4's acknowledged Phase 20 security surfaces (symlink + concurrent-write); calibrate MUDA inventory thresholds for multi-milestone projects; formally adopt the richer-output contract Codex began emitting spontaneously in v1.4; land v1.4's Phase 17/18 carryover WARNs; wire the edge-guard transition layer + dashboard math audit + timeout observability.
.planning/milestones/v1.5\SUMMARY.md:81:- INSTR-03 codex timeout observability — `codex-timeout-observability.jsonl` row emitted at RC=124, includes `tier_actual_via_retry` distinguishing timeout-then-retry from timeout-then-exit.
.planning/milestones/v1.5\SUMMARY.md:119:5. **Codex 5.5 + xhigh is genuinely slower than 5.0** — 3 of 5 Phase 21 invocations hit timeout on initial tier and needed `custom:300+` escalation. The quality boost (deeper attack-surface coverage in Phase 22) is real; the cost is real. v1.4's `codex_timeout` workload tiers absorbed this cleanly — no operator intervention required for tier escalation.
.planning/milestones/v1.5\SUMMARY.md:166:- **Prior milestone: v1.4 Clean Close + Codex Visibility + Autonomous Handoff** (shipped 2026-04-24) — established Codex CLI provider substrate harness + 5 mission-control visibility surfaces + autonomous handoff. v1.5 consumes that substrate (Codex 5.5 + xhigh pinning, narrative + statusline + dashboard tiles all live during this milestone) and extends it (FINDINGS_DETAIL formalization, edge-guard wiring, timeout observability).
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-VERIFICATION.md:19:| A3 | Hash idempotency | PASS | `node ... --backfill --all` at steady state returns `written=0, skipped=44, errors=1` (the 1 error is `phase_capsule_backfill_milestone_missing` for non-existent `v1.1/phases` — benign complaint). Re-runs produce identical content_hash. |
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-VERIFICATION.md:50:| F2 rebuild equivalence (H1===H2) | 1504-1517 | A3 hash idempotency |
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-RESEARCH.md:37:| A3 | deleting generated capsules and rebuilding yields equivalent content hashes | sec.5 hash + idempotency design + sec.10 self-test fixture #2 (binding regression) |
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-RESEARCH.md:179:| 14 | `source_hashes{}` | object | Y | A3 idempotency check; Phase 46 source_hash column | sha256 of inputs at write-time |
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-RESEARCH.md:349:| `files[]` array order | sorted ascending + deduplicated |
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-RESEARCH.md:362:`backfillFromMetrics(opts.dryRun)` walk + dedup pattern.
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-RESEARCH.md:519:rule); rebuild re-derives from current git; idempotent rebuild
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-RESEARCH.md:658:| 6 | `outputs[]` sorted by path ascending; `files[]` sorted ascending + deduplicated |
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-RESEARCH.md:665:| 13 | PHASE-INDEX.jsonl row appended per writeCapsule; row shape `{milestone, phase, phase_name, status, capsule_path, content_hash, created_at}`; existing rows for same (milestone, phase) replaced in place (idempotent) |
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-RESEARCH.md:705:- Attempt PHASE-INDEX.jsonl append (idempotent: replace existing (milestone, phase) row in place).
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-RESEARCH.md:744:| `.../phases/{NN-name}/PHASE-CAPSULE.json` | overwrite-on-rebuild (idempotent) |
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-RESEARCH.md:745:| `.../milestones/{ms}/PHASE-INDEX.jsonl` | append-or-replace by (milestone, phase) (idempotent) |
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-RESEARCH.md:767:| Q11 phase-close integration | LOCKED | Step 6.6.i.X in sgsd-orchestrate (forward-flow) + Step 4.7 in sgsd-complete-milestone (backfill safety net); both idempotent; capsule failure NEVER blocks phase advance |
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-RESEARCH.md:989:| Hash + idempotency | HIGH | Canonical JSON serialization + array sort + key sort + strip operational metadata; A3 binding test catches non-determinism |
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-RESEARCH.md:1006:- Atomic writes: `fs.writeFileSync` for PHASE-CAPSULE.json (overwrite-on-rebuild); `fs.appendFileSync` for PHASE-INDEX.jsonl with in-place row replacement via read-modify-write tmpfile-rename for idempotency.
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-RESEARCH.md:1021:| A2 | `git log --reverse -- <phase_dir>` produces stable commit ordering across rebuilds | sec.5.3, sec.8.2 | Force-push or rebase on main breaks idempotency; mitigation: master is protected per global rules; rebuild refreshes |
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-RESEARCH.md:1046:- Hash + idempotency: HIGH (canonical JSON serialization + key-sorted array
.planning/milestones/v1.9\phases\45-context-packet-builder\45-RESEARCH.md:23:Plus three append-only canonical streams Phase 45 owns:
.planning/milestones/v1.9\phases\45-context-packet-builder\45-RESEARCH.md:211:  status: 'ok' | 'warn' | 'fail' | 'skipped' | 'timeout' | 'blocked';
.planning/milestones/v1.9\phases\45-context-packet-builder\45-RESEARCH.md:345:**Ledger row** appended per compile. Rebuilding from ledger reproduces the cache (Phase 43 idempotency precedent).
.planning/milestones/v1.9\phases\45-context-packet-builder\45-RESEARCH.md:410:| Intent map ledger | `.planning/metrics/intent-map.jsonl` | append-only, canonical | Phase 45 |
.planning/milestones/v1.9\phases\45-context-packet-builder\45-RESEARCH.md:443:  status: 'ok' | 'warn' | 'fail' | 'skipped' | 'timeout' | 'blocked';
.planning/milestones/v1.9\phases\45-context-packet-builder\45-RESEARCH.md:720:### 6.5 Build sequence is deterministic + idempotent
.planning/milestones/v1.9\phases\45-context-packet-builder\45-RESEARCH.md:722:Same `(intent_ref, role, opts)` -> same `packet_id` -> same `packet_body` (assuming substrate hasn't changed, mirrored by Phase 43 capsule content_hash idempotency).
.planning/milestones/v1.9\phases\45-context-packet-builder\45-RESEARCH.md:1023:Phase 49 reads complaints in append-only mode. Phase 45 NEVER rewrites or compacts the complaints.jsonl. If a row is malformed JSON, Phase 49 skips (defensive read pattern, mirrors Phase 41 _readRows:293-313).
.planning/milestones/v1.9\phases\45-context-packet-builder\45-RESEARCH.md:1345:- `.planning/metrics/intent-map.jsonl` (NEW, append-only)
.planning/milestones/v1.9\phases\45-context-packet-builder\45-RESEARCH.md:1346:- `.planning/metrics/context-packet-log.jsonl` (NEW, append-only)
.planning/milestones/v1.9\phases\45-context-packet-builder\45-RESEARCH.md:1347:- `.planning/metrics/context-complaints.jsonl` (EXISTS, append-only -- Phase 45 adds rows; never rewrites Phase 43 rows)
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:52:    hypothesis: "Replacing the Wave-1 stub of intent-map/build.cjs with the full 10-field compiler (~700 LOC; compileIntentMap(rawOperatorPhrase, opts) public API) implementing RAW->INTENT->MEANING->ASSUMPTIONS->AMBIGUITIES->CLARIFY->CANONICAL->RELATIONSHIPS->CONTEXT_POLICY->ACTION pipeline with closed-vocab REASON_VOCAB enforcement, prompt-injection defense (Lock 12: source-file body text NEVER populates RAW/INTENT/MEANING/CANONICAL), CLARIFY gate (PACKET-09: only fires when material ambiguity AND no prior context resolves; auto mode logs assumption + proceeds), tier-based weight assignment (REASON_VOCAB 13-entry closed enum; semantic-only candidates demoted to ambiguities[]), intent_id = sha256(raw + ts_window_60s_truncation) cache key (Phase 43 idempotency precedent), .planning/cache/intent-map/{intent_id}.json cache write + .planning/metrics/intent-map.jsonl envelope-v1 ledger append, plus the matching check.cjs (~300 LOC validate-only read-side with manual JSON validation against schema) and the full Wave-1 test scaffold expanded to bind F1+F4 + 4 secondary intent-map assertions (10 total intent-map self-test assertions per RESEARCH 13.1-13.2), produces a never-throws-upward compiler whose every public API is wrapped in try/catch returning falsey sentinels on error and which writes ONLY to .planning/metrics/intent-map.jsonl + .planning/cache/intent-map/* + (on degraded path) .planning/metrics/context-complaints.jsonl (intentMapComplaint command, status=warn never blocked per Lock 13)."
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:54:    stop_rule: "node super-gsd/tools/intent-map/build.cjs --self-test exits 0 with literal 'intent-map self-test: 10 pass, 0 fail' covering F1 (intent map happy path: 6 sub-assertions per RESEARCH 13.1) + F4 (prompt-injection defense: 5 sub-assertions per RESEARCH 13.1) + 4 secondary (REASON_VOCAB 14 frozen + does-not-contain semantic_similarity_only; empty phrase -> no_op never throws; cache rebuild idempotency; canonical-stream fingerprint invariant); .planning/metrics/intent-map.jsonl exists and has at least one envelope-v1 row carrying reason_codes=['intent_compiled_clean']; .planning/cache/intent-map/{intent_id}.json round-trips (delete cache + recompile -> same content_hash modulo ts); intentMapComplaint envelope-v1 emitted on prompt-injection fixture and on auto-mode material-ambiguity fixture (status='warn' never 'blocked' per Lock 13); Phase 41 imports verified at module top: const {summarize, ROLES, BLOAT_THRESHOLDS, ledgerPath} = require('../token-attribution/report.cjs'); Phase 42 imports verified: const {BUDGETS, VERDICTS, ROUTE_REASONS} = require('../token-waste/check.cjs'); Phase 43 imports verified: const {readCapsule, STATUS_VOCAB, BYPASS_KIND_VOCAB, CAPSULE_FILE_KINDS} = require('../phase-capsule/write.cjs'); Phase 44 imports verified: const {validateReferences, validateOne, loadRegistry, REASONS} = require('../context-registry/check.cjs'); _normalize + _assertIntentMapSchema trio enforces closed-shape per Phase 43 _assertCapsuleSchema precedent; all public APIs (compileIntentMap, readIntentMap, appendIntentMapRow, validate) wrap internals in try/catch and return falsey sentinels never throw; CLI exit codes: --self-test pass=0/fail=1, bad-invocation=2 (Phase 42 sec 8.5 mirror); git diff --quiet on 13 canonical streams + super-gsd/tools/{token-attribution,token-waste,phase-capsule,context-registry}/ + 8 phase-folder content patterns after run."
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:106:    - "packet_id = sha256(intent_ref + role + content_hash_of_canonical_packet_body).slice(0,16) cache key; idempotent: same (intent_ref, role, opts) -> same packet_id -> same packet_body assuming substrate unchanged (Phase 43 capsule content_hash precedent)"
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:127:    - "Read-only against ALL 13 canonical streams + 8 phase-folder content patterns + Phase 41-44 owned configs (super-gsd/tools/{token-attribution,token-waste,phase-capsule,context-registry}/ source files); ONLY owned writes: super-gsd/tools/intent-map/{build,check,build.test}.cjs + super-gsd/tools/intent-map/intent-map.schema.json + super-gsd/tools/context-packet/{build,build.test}.cjs + super-gsd/tools/context-packet/PACKET.schema.json + .planning/metrics/intent-map.jsonl (NEW, append-only) + .planning/metrics/context-packet-log.jsonl (NEW, append-only) + .planning/metrics/context-complaints.jsonl (EXISTS, append-only -- Phase 45 adds intentMapComplaint + contextPacketComplaint rows; NEVER rewrites Phase 43 phaseCapsuleComplaint rows) + .planning/cache/intent-map/{intent_id}.json (gitignored, rebuildable) + super-gsd/skills/sgsd-orchestrate/SKILL.md (EDIT, additive Step 7.5 only) + super-gsd/skills/sgsd-complete-milestone/SKILL.md (EDIT, additive Step 4.7-ter only) + 45-VERIFICATION.md"
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:129:    - "Atomic write to .planning/metrics/{intent-map,context-packet-log}.jsonl via append-only fs.appendFileSync (envelope-v1 row + newline; mirrors Phase 41 ledger writer + Phase 42 token-waste-status writer; NEVER rewrites; NEVER compacts); atomic write to .planning/cache/intent-map/{intent_id}.json via tmpfile-rename (fs.writeFileSync to <path>.tmp + fs.renameSync to <path>; preserves prior cache on partial failure; mirrors Phase 43 PHASE-INDEX.jsonl atomic-replace + Phase 44 legal-keys.json atomic-replace pattern)"
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:176:    - super-gsd/tools/intent-map/build.cjs (NEW; ~700 LOC; 10-field compiler with closed REASON_VOCAB; Phase 41/42/43/44 const imports BY REFERENCE; mirrors Phase 41 envelope-v1 emitter + Phase 42 closed-flag CLI + Phase 43 content-hash idempotency + Phase 44 manual JSON validation)
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:185:    - .planning/metrics/intent-map.jsonl (INIT empty; append-only envelope-v1 ledger; PACKET-00 owned)
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:186:    - .planning/metrics/context-packet-log.jsonl (INIT empty; append-only envelope-v1 ledger; PACKET-05 owned)
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:260:      mitigation: "All emitter rows are envelope-v1 + extension fields (additionalProperties:true; mirrors Phase 41/42/43); rows include ts (ISO8601) + run_id + intent_id/packet_id (sha256-truncated); append-only NEVER rewritten; defensive read pattern (malformed row -> _readRows skips, continues; Phase 41 _readRows:293-313 mirror); Phase 49 GOV-04 consumes complaints as first-class evidence (Lock 9)."
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:275:      mitigation: "Self-test fingerprint guard captures mtime+size+exists of all 13 streams + 8 phase-folder content patterns BEFORE selfTest; runs in tmpdir; captures AFTER; asserts byte-equivalent; secondary assertion 13 binds; ONLY owned writes are .planning/metrics/intent-map.jsonl + .planning/metrics/context-packet-log.jsonl (NEW append-only) + .planning/metrics/context-complaints.jsonl (additive only -- NEVER rewrites Phase 43 rows) + .planning/cache/intent-map/* (gitignored) + super-gsd/tools/{intent-map,context-packet}/* (source-controlled) + 2 SKILL.md additive edits + 45-VERIFICATION.md."
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:345:  - "Wave 2: intent-map/build.cjs full compiler ships with 10 self-test assertions including F1 + F4 + 4 secondary; .planning/metrics/intent-map.jsonl exists with at least one envelope-v1 row; cache rebuild idempotency proven; all public APIs never throw upward; Phase 41/42/43/44 imports round-trip"
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:376:Plus three append-only canonical streams Phase 45 owns:
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:431:  STATUSES,         // 6-entry: ['ok','warn','fail','skipped','timeout','blocked']
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:590:    - `readIntentMap(intent_id, opts)` -- read cache or replay from ledger.
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:620:    Cache: `.planning/cache/intent-map/{intent_id}.json` (gitignored, rebuildable). Ledger: `.planning/metrics/intent-map.jsonl` (canonical, append-only). Compile-once-per-operator-turn semantics per RESEARCH 4.3.
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:632:    Cache rebuild idempotency: delete `.planning/cache/intent-map/`; `node -e "const m = require('./super-gsd/tools/intent-map/build.cjs'); const r1 = m.compileIntentMap('test phrase', {planningDir:'.planning'}); const r2 = m.compileIntentMap('test phrase', {planningDir:'.planning'}); console.log(r1.intent_id === r2.intent_id ? 'OK' : 'FAIL')"` -&gt; OK (within ts_window).
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:644:  <done>Wave-2 atomic commit `feat(45-01): intent-map/build.cjs -- RAW->CANONICAL 10-field compiler` lands; intent-map/build.cjs (~700 LOC) + check.cjs (~300 LOC) + build.test.cjs expanded to 10-pass; F1 + F4 + 4 secondary all pass; .planning/metrics/intent-map.jsonl ledger emits envelope-v1 rows; cache rebuild idempotent; empty phrase graceful; Lock 11 + Lock 12 + Lock 13 mechanically embodied; ASCII-only.</done>
.planning/milestones/v1.9\phases\45-context-packet-builder\45-01-context-packet-builder-PLAN.md:676:    - `readPacket(packet_id, opts)` -- replay from .planning/metrics/context-packet-log.jsonl.
.planning/milestones/v1.9\phases\43-phase-capsule-contract\reviews\43-REVIEW.md:46:  - **Fix**: commit `8d902d6` — simplified to `Math.max(wAnchors, wHeads)` with broadened wHeads regex (case-insensitive, matches `### WARN N:`, `### WARN-N`, `### WARN N` dialects). 15 capsules rewritten with corrected counts (mostly v1.6 phases). Re-runs converge: 15 → 8 (settling) → 0 (idempotent fixed point).
.planning/milestones/v1.9\phases\44-legal-context-registry\44-VERIFICATION-AUDIT.md:23:| A4 | Hash idempotent | PASS | `content_hash=b0a8024bc2b016eaca84da0d49c424f67c59c24f94ed64f8759c1d8ccc262c1d` stable across two `--build` runs (canonical sort + stripped `generated_at`) |
.planning/milestones/v1.9\phases\44-legal-context-registry\44-VERIFICATION-AUDIT.md:47:Legal context registry library + JSON + 13-source build + 4-outcome validator land green; 13/13 self-test, 44/44 capsules valid, content-hash idempotent, never-throws confirmed; A5 read-only invariant intact for Phase-44 commits — verdict PASS.
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:77:| Envelope statuses | 6 | `command-envelope-v1.json:25` (ok, warn, fail, skipped, timeout, blocked) |
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:171:| reason_codes | string | `"codex_timeout"` | command-envelope-v1.yaml reason_codes |
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:231:    "envelope": ["ok", "warn", "fail", "skipped", "timeout", "blocked"],
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:255:      {"id": "codex_timeout", "group": "provider_runtime"},
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:319:  // Step 3: agents (union of yaml + jsonl, dedup by id, status:active filter)
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:341:  // Step 8: source_hashes (sha256 each source for A3 idempotency)
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:348:### 4.3 Source-hash idempotency
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:551:### 7.1 Build idempotency rule
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:641:Mirror Phase 41 sec.7 (14 assertions), Phase 42 sec.7 (15 assertions), Phase 43 sec.10 (13 assertions). Settle on 13 to match Phase 43 (the closest analog: read-only walker + content-hash idempotency + closed-shape JSON schema).
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:648:| F2 rebuild equivalence | F1 setup; build -> H1; delete legal-keys.json; rebuild -> H2 | H1 === H2 (modulo generated_at/by stripped) | **A3 BINDING (idempotency)** |
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:652:F1 -> A1; F2 -> A3 (idempotency); F3 -> A3 (visibility); F4 -> A2.
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:828:| Q7 idempotency + read-only | LOCKED | content_hash strips generated_at/by, includes source_hashes; F2 binding test; fingerprint guard over 19 sources; mirror Phase 43 sec.5.2 verbatim |
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:955:- `.planning/milestones/v1.9/phases/43-phase-capsule-contract/43-RESEARCH.md` (mirror template: STATUS_VOCAB, BypassRef, content_hash idempotency, fingerprint guard)
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:1000:| Self-test design (13 assertions) | HIGH | 4 fixtures map 1:1 to 4 acceptance criteria (A1, A2, A3 idempotency, A3 visibility); 9 secondary mirror Phase 41/42/43 |
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:1009:- Mirror Phase 35 system-map walker + Phase 41 emitter consts + Phase 42 read-only check + Phase 43 content-hash idempotency 1:1 where applicable.
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:1010:- Atomic writes: `fs.writeFileSync` for legal-keys.json (overwrite-on-rebuild via tmpfile-rename).
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:1045:- Standard stack: HIGH (template = Phase 35 system-map walker + Phase 41 frozen-const emitter + Phase 42 read-only check + Phase 43 content-hash idempotency; all v1.7-v1.9 in-tree)
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:1048:- Hash + idempotency: HIGH (canonical JSON serialization + key-sorted array + strip operational metadata; F2 binding self-test catches non-determinism; mirror Phase 43 sec.5.2 verbatim)
.planning/milestones/v1.9\phases\44-legal-context-registry\44-RESEARCH.md:1053:**Single recommendation locked:** ONE plan, TWO modules under `super-gsd/tools/context-registry/` (`build.cjs` ~550 LOC + `check.cjs` ~250 LOC), ONE generated artifact (legal-keys.json ~600-1000 LOC), ONE test file (~180 LOC), THREE public APIs in build.cjs (`build`, `loadRegistry`, `registryPath`), FIVE public APIs in check.cjs (`validateReferences`, `validateOne`, `isLegal`, `loadRegistry`, `registryPath`), THIRTEEN self-test assertions (4 named fixtures binding A1+A2+A3-idempotency+A3-visibility + 9 secondary), TEN top-level registry keys (5 metadata + 8 categories + 2 derived: commands, reason_codes), THIRTEEN canonical sources walked, EIGHTEEN PROVIDERS verbatim from Phase 41 (4), STATUSES x 3 vocabs (envelope 6, capsule 5, agent 4 = 15), GATES (13 from gates.yaml verbatim), AGENTS (~23 from agents.jsonl status:active union with agents.yaml metadata). Mirror Phase 35 walker + Phase 41/42 const-import + Phase 43 content-hash. SEVENTH SGSD contract level (legal-references). NO new architectural surface. Phase 45 forward contract locked: `validateReferences(packet)` is the admission boundary. Total ~980 lines hand-written + ~700 LOC generated registry.
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:12:tags: [phase-capsule, projection, idempotent-rebuild, lock-5, lock-6, lock-13, sgsd-research]
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:19:    hypothesis: "A read-only writer with frozen const enums + 9 deterministic extractors + canonical-JSON content hash + envelope-style never-throws-upward contract produces a per-phase PHASE-CAPSULE.json that satisfies A1 (18 fields), A2 (verbatim bypass), A3 (idempotent rebuild) without mutating any canonical phase-folder file or canonical metric stream."
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:49:    stop_rule: "17 PHASE-CAPSULE.json files exist + 4 PHASE-INDEX.jsonl files exist; each capsule's _validateCapsule returns true; idempotent rebuild (delete + rebuild) yields identical content hash for every capsule (A3 binding at scale); read-only diff against canonical streams + every backfilled phase folder (excluding the new PHASE-CAPSULE.json) is empty."
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:78:    - "PHASE-INDEX.jsonl uses append-or-replace-by-(milestone,phase) semantics via tmpfile-rename (atomic) to preserve idempotency; row shape is {milestone, phase, phase_name, status, capsule_path, content_hash, created_at}"
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:91:    - 43-RESEARCH.md (1062 lines; 11 LOCKED derivation calls; sec 4 schema; sec 5 hash + idempotency; sec 6 critical bypass linkage; sec 9 backfill + integration; sec 10 self-test design; sec 15 single-plan recommendation 12-task structure)
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:175:    PHASE-INDEX.jsonl idempotent).
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:232:const STATUSES         = Object.freeze(['ok','warn','fail','skipped','timeout','blocked']);
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:246://   - Capsule is a JSON DOCUMENT (overwrite-on-rebuild), not a JSONL ROW (append-only).
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:247://     _writeCapsuleInternal uses fs.writeFileSync (overwrite), NOT fs.appendFileSync.
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:408:| files[] order             | sort + dedup |
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:495:   make A3 (idempotent rebuild yields equivalent content hashes)
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:694:      - Header docblock cites: 43-RESEARCH.md sections 4 (schema), 5 (hash + idempotency), 6 (critical bypass), 7 (decisions/debt/contract), 8 (source commits), 9 (backfill + integration), 10 (self-test), 12 (read-only invariant), 14 (cross-phase contract), 15 (single plan recommendation); REQUIREMENTS.md:40-50 (Locks 5+6 verbatim); REQUIREMENTS.md:113-119 (CAP-01..05); mass-discuss row 43 (controlling correctness rule). NO mention of `gate` / `keep` / `kill` / `token-waste` / `token-attribution` (Phase 41/42/39 leakage forbidden per RESEARCH sec 15.3 risk row 1).
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:775:            sorted ascending; deduplicated
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:805:            via child_process.execSync (timeout: 5000ms; encoding: 'utf8';
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:905:            fs.writeFileSync(tmp, JSON.stringify(capsuleObj, null, 2) + '\n', 'utf8')
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:928:                        sorted ascending; deduplicated>,
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:974:    BEHAVIOR 8: PHASE-INDEX.jsonl append-or-replace (atomic; idempotent)
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:1075:        13. PHASE-INDEX.jsonl idempotent: write capsule for (v1.test, 99)
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:1142:  fs.appendFileSync row      -> fs.writeFileSync document (overwrite)
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:1168:    idempotency), 6 (critical bypass), 7 (decisions/debt/contract), 8
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:1204:  L381-L420 : _appendOrReplaceIndexRow (PHASE-INDEX.jsonl idempotent writer)
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:1286:node -e "const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');const {writeCapsule}=require('./super-gsd/tools/phase-capsule/write.cjs');const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pc-f2-'));const phaseDir=path.join(tmp,'milestones','v1.test','phases','99-fixture');fs.mkdirSync(phaseDir,{recursive:true});fs.writeFileSync(path.join(phaseDir,'99-CONTEXT.md'),'---\nphase: 99\n---\nGoal: F2 binding test.\n');fs.writeFileSync(path.join(phaseDir,'99-RESEARCH.md'),'## Open Derivation Calls -- LOCKED\n');fs.writeFileSync(path.join(phaseDir,'99-01-PLAN.md'),'plan');fs.writeFileSync(path.join(phaseDir,'99-VERIFICATION.md'),'verdict: PASS');const r1=writeCapsule(tmp,{milestone:'v1.test',phase:'99',phaseDir});if(!r1.ok){console.error('FAIL r1',r1);process.exit(1)} const H1=r1.content_hash;fs.unlinkSync(r1.path);const r2=writeCapsule(tmp,{milestone:'v1.test',phase:'99',phaseDir});if(!r2.ok){console.error('FAIL r2',r2);process.exit(1)} const H2=r2.content_hash;if(H1!==H2){console.error('FAIL F2 BINDING A3 H1!==H2',H1,H2);process.exit(1)} console.log('PASS F2 BINDING A3 H1===H2='+H1)"
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:1287:node -e "const fs=require('fs'),path=require('path'),os=require('os');const {writeCapsule}=require('./super-gsd/tools/phase-capsule/write.cjs');const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pc-f4-'));const phaseDir=path.join(tmp,'milestones','v1.test','phases','99-fixture');fs.mkdirSync(phaseDir,{recursive:true});fs.mkdirSync(path.join(tmp,'metrics'),{recursive:true});fs.writeFileSync(path.join(phaseDir,'99-CONTEXT.md'),'---\nphase: 99\n---\nGoal: F4 binding test.\n');fs.writeFileSync(path.join(phaseDir,'99-RESEARCH.md'),'res');fs.writeFileSync(path.join(phaseDir,'99-01-PLAN.md'),'plan');fs.writeFileSync(path.join(phaseDir,'99-VERIFICATION.md'),'verdict: PASS');const summaries=['Codex auth unavailable; per-dispatch ATC for commit 34eb8c2 used Claude only.','Edge-guard miss: provider==null detected; behaviorally proven outage 2026-04-27.','Stack trace: SyntaxError at line 42; details preserved verbatim with punctuation.'];const rows=summaries.map((s,i)=>JSON.stringify({id:'2026-04-27T0'+i+'-00-00-000Z-aaa'+i,kind:'verifier_fail',phase:'99',plan:'phase-level',milestone:'v1.test',attempts_made:1,summary:s,evidence_path:'.planning/x',last_diff_sha:null,tagged_for_milestone:'next-debt-milestone',added_at:'2026-04-27T0'+i+':00:00.000Z',resolved_at:null,resolved_by:null}));fs.writeFileSync(path.join(tmp,'metrics','crit-backlog.jsonl'),rows.join('\n')+'\n');const r=writeCapsule(tmp,{milestone:'v1.test',phase:'99',phaseDir});if(!r.ok){console.error('FAIL writeCapsule',r);process.exit(1)} const cap=JSON.parse(fs.readFileSync(r.path,'utf8'));if(cap.bypass_refs.length!==3){console.error('FAIL bypass_refs.length',cap.bypass_refs.length);process.exit(1)} for(let i=0;i<3;i++){if(cap.bypass_refs[i].summary_passthrough!==summaries[i]){console.error('FAIL summary mutated',i,'\nsrc=',JSON.stringify(summaries[i]),'\ngot=',JSON.stringify(cap.bypass_refs[i].summary_passthrough));process.exit(1)}} console.log('PASS F4 BINDING A2/LOCK 6 verbatim 3/3')"
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:1377:   (idempotent).
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:1410:node -e "const log=require('fs').readFileSync('/tmp/sgsd-pc-rerun.log','utf8');if(!/written=0/.test(log)){console.error('FAIL non-idempotent rebuild',log);process.exit(1)} console.log('PASS A3 idempotent rebuild (written=0)')"
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:1900:# === ROADMAP A3 idempotent rebuild (BINDING) ===
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:1904:if (!/written=0/.test(log)) { console.error('FAIL non-idempotent rebuild', log); process.exit(1) }
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:1905:console.log('PASS ROADMAP A3 idempotent rebuild (written=0 on second run)');
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:2032:echo 'A3: deleting + rebuilding yields equivalent content hashes (idempotent) - GREEN'
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:2058:- A3 idempotent rebuild PROVEN at scale: re-running --backfill --all
.planning/milestones/v1.9\phases\43-phase-capsule-contract\43-01-phase-capsule-contract-PLAN.md:2088:  - A3 idempotent rebuild proven (written=0 on second --backfill --all)
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:38:    stop_rule: "super-gsd/tools/context-registry/legal-keys.json exists; _validateRegistry returns true; counts table green: milestones.active >= 8, phases.active >= 40, gates.active === 13, agents.active >= 8, providers.active === 4, statuses.envelope === 6, statuses.capsule === 5, statuses.agent === 4, reason_codes.active >= 30, phase_folders.active >= 40, milestones.superseded.length === 1 (v1.9-knowledge-memory-governance), phase_folders.malformed.length >= 1 (v1.3/p5-codex-monitor); idempotent rebuild (delete + rebuild) yields identical content_hash; git diff --quiet on 13 canonical sources after run."
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:76:    - "A3 binding (ROADMAP:129): TWO self-test fixtures bind A3 -- F2 idempotency (build->H1; delete legal-keys.json; rebuild->H2; H1===H2 modulo generated_at/by stripped) AND F3 visibility (validateReferences on packet referencing 1 active + 1 superseded-with-replacement + 1 unknown returns {valid:false, invalid_keys:[{key:superseded, reason:'superseded_key', suggested:replaced_by},{key:unknown, reason:'unknown_key'}]}, active key NOT in invalid_keys)"
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:77:    - "Self-test 13 assertions: 4 named fixtures (F1 happy A1, F2 rebuild A3-idempotency, F3 superseded A3-visibility, F4 invalid A2) + 9 secondary covering schema closed-shape, sort order, empty packet, validateOne 4 outcomes, malformed legal-keys.json -> registry_malformed reason, source_hashes hex64, fingerprint invariant, never-throws, CLI exit codes (mirror Phase 43 sec.10 size; Phase 41 14 + Phase 42 15)"
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:85:    - "command-envelope-v1.json envelope_status enum (6 values: ok, warn, fail, skipped, timeout, blocked) is read DIRECTLY from the JSON template's $.properties.status.enum; never duplicated"
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:92:    - "Atomic write to legal-keys.json via tmpfile-rename (fs.writeFileSync to <path>.tmp + fs.renameSync to <path>); preserves previous registry on partial failure; mirrors Phase 43 PHASE-INDEX.jsonl atomic-replace pattern"
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:95:    - super-gsd/tools/context-registry/build.cjs (NEW; ~550 LOC; mirrors Phase 35 system-map walker + Phase 41 report.cjs frozen-const emitter + Phase 42 check.cjs read-only invariant + Phase 43 write.cjs content-hash idempotency)
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:102:    - 44-RESEARCH.md (1054 lines; 11 LOCKED derivation calls; sec 1 acceptance mapping; sec 3 schema design; sec 4 build sources mapping; sec 5 stale/superseded representation; sec 6 build+check API; sec 7 idempotency+read-only invariant; sec 8 self-test design; sec 9 cross-phase contract; sec 10 hard stop conditions; sec 12 single-plan recommendation 11-task structure)
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:213:  'ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked',
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:296:      "enum": ["ok", "warn", "fail", "skipped", "timeout", "blocked"]
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:327:  - code: codex_timeout
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:419:    F2 (rebuild equivalence; A3 idempotency binding):
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:510:function _mergeAgents(yamlAgents, jsonlAgents) { /* union by .id, dedup, status:active filter */ }
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:790:    - All 4 fixtures (F1 A1, F2 A3-idempotency, F3 A3-visibility, F4 A2) PASS
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:819:- statuses.envelope: 6 (ok, warn, fail, skipped, timeout, blocked)
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:828:Verify second run yields identical content_hash (A3 idempotency at scale beyond synthetic F2):
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:856:    <idempotency>node super-gsd/tools/context-registry/build.cjs --build 2>&1 | grep -oE 'content_hash=[a-f0-9]{64}' > /tmp/h1 && node super-gsd/tools/context-registry/build.cjs --build 2>&1 | grep -oE 'content_hash=[a-f0-9]{64}' > /tmp/h2 && diff -q /tmp/h1 /tmp/h2</idempotency>
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:1013:- VERIFY: F2 self-test fixture asserts H1 === H2 idempotency
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:1022:- REG-05: self-test covers valid (F1), invalid (F4), stale (F2 idempotency), and superseded (F3 visibility)
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:1037:- Task 2 verify.idempotency: live --build twice, content_hash equal
.planning/milestones/v1.9\phases\44-legal-context-registry\44-01-legal-context-registry-PLAN.md:1060:   - F2 (A3 idempotency): H1 === H2 across rebuild
.planning/milestones/v1.9\phases\42-token-budget-admission\42-RESEARCH.md:238:fs.writeFileSync(
.planning/milestones/v1.9\phases\42-token-budget-admission\42-RESEARCH.md:252:in series; Step 4.7 inherits the existing infrastructure (idempotency,
.planning/milestones/v1.9\phases\42-token-budget-admission\42-RESEARCH.md:303:append-only to a NEW stream.**
.planning/milestones/v1.9\phases\42-token-budget-admission\42-RESEARCH.md:310:append-only) + `.planning/milestones/{id}/token-waste.md` (overwritten per
.planning/milestones/v1.9\phases\42-token-budget-admission\42-RESEARCH.md:311:Step 4.7 run; outer skill idempotency via Step 0 SUMMARY.md exists -> exit
.planning/milestones/v1.9\phases\42-token-budget-admission\42-RESEARCH.md:316:consumers read "latest by scope" via `ts` ordering -- no dedup needed.
.planning/milestones/v1.9\phases\42-token-budget-admission\42-RESEARCH.md:608:| `token-waste-status.jsonl` | append-only envelope-v1 |
.planning/milestones/v1.9\phases\42-token-budget-admission\42-RESEARCH.md:630:| Q9 idempotency + read-only | LOCKED | 6 input streams + 1 config; 1 status JSONL + 1 md |
.planning/milestones/v1.9\phases\42-token-budget-admission\42-RESEARCH.md:768:- Atomic writes: `fs.appendFileSync` for status JSONL; `fs.writeFileSync`
.planning/milestones/v1.9\phases\42-token-budget-admission\42-01-token-budget-admission-PLAN.md:32:    - "Read-only against ALL 5 canonical streams (agent-token-spend.jsonl, token-attribution.jsonl, codex-log.jsonl, token-log.jsonl, activity-log.jsonl) AND read-only against budgets.yaml; only owned writes are token-waste-status.jsonl (append-only) and milestones/{id}/token-waste.md (overwrite-per-run)"
.planning/milestones/v1.9\phases\42-token-budget-admission\42-01-token-budget-admission-PLAN.md:151:  STATUSES,          // Object.freeze(['ok','warn','fail','skipped','timeout','blocked'])
.planning/milestones/v1.9\phases\42-token-budget-admission\42-01-token-budget-admission-PLAN.md:186:const STATUSES = Object.freeze(['ok','warn','fail','skipped','timeout','blocked']);
.planning/milestones/v1.9\phases\42-token-budget-admission\42-01-token-budget-admission-PLAN.md:209:  fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8');
.planning/milestones/v1.9\phases\42-token-budget-admission\42-01-token-budget-admission-PLAN.md:243:fs.writeFileSync(
.planning/milestones/v1.9\phases\42-token-budget-admission\42-01-token-budget-admission-PLAN.md:256:status:           ok|warn|fail|skipped|timeout|blocked  (Phase 42 NEVER emits 'blocked')
.planning/milestones/v1.9\phases\42-token-budget-admission\42-01-token-budget-admission-PLAN.md:475:     - .planning/metrics/token-waste-status.jsonl   (Phase 42 OWNED; append-only)
.planning/milestones/v1.9\phases\42-token-budget-admission\42-01-token-budget-admission-PLAN.md:790:      - Atomic append via fs.appendFileSync to
.planning/milestones/v1.9\phases\42-token-budget-admission\42-01-token-budget-admission-PLAN.md:1181:   fs.writeFileSync(
.planning/milestones/v1.9\phases\42-token-budget-admission\42-01-token-budget-admission-PLAN.md:1209:   reads "latest by scope" via `ts` ordering; no dedup needed.
.planning/milestones/v1.9\phases\42-token-budget-admission\42-01-token-budget-admission-PLAN.md:1366:- Re-running --check appends exactly 1 new row (idempotent in the
.planning/milestones/v1.9\phases\42-token-budget-admission\42-01-token-budget-admission-PLAN.md:1441:  budgets.yaml. Owned writes: token-waste-status.jsonl (append-only) +
.planning/milestones/v1.9\phases\42-token-budget-admission\42-01-token-budget-admission-PLAN.md:1564:fs.writeFileSync(path.join(tmp,'metrics','agent-token-spend.jsonl'), JSON.stringify(f3)+'\\n');
.planning/milestones/v1.9\phases\42-token-budget-admission\42-01-token-budget-admission-PLAN.md:1593:fs.writeFileSync(path.join(tmp,'metrics','agent-token-spend.jsonl'), JSON.stringify(f4)+'\\n');
.planning/milestones/v1.9\phases\42-token-budget-admission\42-01-token-budget-admission-PLAN.md:1720:| T-42-03 | Tampering | token-waste-status.jsonl tail-injection | accept | File is append-only owned by Phase 42; envelope-v1 _normalize + _assertEnvelopeV1 reject malformed rows on append; downstream consumers (Phase 50 cockpit) read-only via JSONL parse with malformed-line skip. |
.planning/milestones/v1.9\SUMMARY.md:30:| 51 | Context Stress Benchmark | context-bench/{harness,replay,scoring,failure-injectors}.cjs (4 modules / 33 assertions) + 6 baseline fixtures S1-S6 + 16-fixture failure injection F1-F16 + 18 RESEARCH-locked semantic floor + sgsd-complete-milestone wire | verdict=pass 0-CRITICAL 0-HIGH 1-MEDIUM-fixed-in-loop 3-LOW (M1: harness.replayScenario/injectFailure exported stubs rewired to real T5/T4 implementations) |
.planning/milestones/v1.5\VTP-PROCESS-AUDIT.md:23:SGSD already has the right high-level process shape: small agents, explicit gates, append-only artifacts, verifier pressure, MUDA pressure, token pressure, and phase-level governance. The main weakness is not a lack of gates. The main weakness is that several gates are not yet fully load-bearing: some signals are produced but not consumed, some critical findings are logged but allowed to pass, some telemetry misses early exits, and some planned enrichment could become expensive ritual unless it is thresholded.
.planning/milestones/v1.5\VTP-PROCESS-AUDIT.md:61:Phase 21 depends on knowing whether VTP enrichment was useful, empty, disabled, noisy, or broken. Missing preflight telemetry makes it impossible to distinguish "VTP found nothing" from "VTP was never called." WLS and Stateless Decision Memory both point to append-only event logs as the source of truth, not summary claims.
.planning/milestones/v1.5\VTP-PROCESS-AUDIT.md:66:- Use explicit statuses: `success`, `zero_hits`, `query_rejected`, `mcp_unavailable`, `mcp_error`, `disabled`, `timeout`.
.planning/milestones/v1.5\VTP-PROCESS-AUDIT.md:237:- Add a process fitness dashboard sourced from append-only edge-guard and metrics logs.
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\reviews\48-REVIEW.md:15:| Claude (sgsd-code-reviewer) | OK | REVISE → PASS post-fix | 1 CRITICAL (ok:true on empty), 1 HIGH (timeout not enforced), 2 MEDIUM (cosmetic), 2 LOW |
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\reviews\48-REVIEW.md:27:- **classify.cjs:502** — `_callVtpToolWithTimeout` was named after Promise.race pattern but body was synchronous; 30s `per_query_timeout_ms` config plumbed through but never enforced. Production MCP calls could block indefinitely.
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\reviews\48-REVIEW.md:28:  - **Fix**: commit `ad8583c` — renamed to `_callVtpToolShim` with explicit contract documenting that BRIDGE does NOT enforce timeout — orchestrator owns it via shim wrapper. Routes.yaml budget remains for orchestrator consumption.
.planning/milestones/v1.9\phases\47-dispatch-routing-substitution\47-01-dispatch-routing-substitution-PLAN.md:172:const STATUSES = Object.freeze(['ok','warn','fail','skipped','timeout','blocked']);
.planning/milestones/v1.9\phases\47-dispatch-routing-substitution\47-01-dispatch-routing-substitution-PLAN.md:198: "self_test_probes":{"path":true,"auth":true,"timeout":true,"contract":true},
.planning/milestones/v1.9\phases\47-dispatch-routing-substitution\47-01-dispatch-routing-substitution-PLAN.md:282:    - Else require r.exit===0 AND probes.{path,auth,timeout,contract} all true. If pass -> {healthy:true, reason:'self_test_pass', age_ms:age}. Else {healthy:false, reason:'self_test_probe_failed', probes:r.self_test_probes}.
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:63:| BASE-02 | Backfill rows from available metrics + session logs | Section 3 (4-stream walk, idempotent, scope locked) |
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:76:  `event_id` (dedup key), `ts`, `source: "claude-session-jsonl"`,
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:106:  `timeout_hit`, `fallback_triggered`, `stderr_preview`.
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:125:audit-log, codex-live, codex-timeout-observability, crit-backlog,
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:148:status:           ok|warn|fail|skipped|timeout|blocked
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:215:  'ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked',
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:245:| codex-log.jsonl, exit==5 (timeout) | `timeout` | `['codex_timeout', 'tokens_estimated']` |
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:269:     - status from deriveStatus(exit, timeout_hit, fallback_triggered)
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:275:     dedup pattern protects idempotency
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:314:| ALL token-attribution.jsonl rows | Already canonical, exact, idempotent | 11,173 |
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:501:  backfillFromMetrics,    // walk source streams, idempotent
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:518:  - atomic: fs.appendFileSync to <planningDir>/metrics/agent-token-spend.jsonl
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:521:  - opts: { dryRun, sourceStreams, dedupe }
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:563:9.  three appends -> three rows; never truncated (append-only)
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:648:| Atomic append | fs.appendFileSync | fs.appendFileSync | fs.appendFileSync |
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:737:| Backfill non-idempotent on re-run | High | LOCK 9 reuses collect.cjs pattern; assertion 9 verifies append-only |
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:785:  schema + dedup pattern)
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:808:| Backfill strategy | HIGH | All source schemas inspected directly; idempotency proven in collect.cjs |
.planning/milestones/v1.9\phases\41-baseline-token-attribution\41-RESEARCH.md:822:- Atomic writes via fs.appendFileSync (each row well under 4KB).
.planning/milestones/v1.5\phases\23-muda-calibration\23-RESEARCH.md:115:node -e 'var c=JSON.parse(require("fs").readFileSync(".planning/config.json")); c.muda={inventory_thresholds:{warn_per_milestone:1,fail_per_milestone:3}}; require("fs").writeFileSync(".planning/config.json", JSON.stringify(c, null, 2))'
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:13:Critical to A3 (MCP failure separation): Phase 48 introduces a NEW append-only canonical stream `.planning/metrics/vtp-bridge-failures.jsonl` whose entire purpose is to keep VTP MCP error/timeout/auth-fail rows visually and structurally distinguishable from the evidence packet path. When the MCP fails, the bridge returns an empty `results[]` packet plus an `error_logged_at` reference; it does NOT inject the error message into the packet body where downstream consumers might mistake it for a research conclusion. This is the same pattern Phase 14 codex-log uses (self-test rows live alongside dispatch rows but in distinct vocabularies).
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:36:- A3: MCP validation/timeouts are logged separately from conclusions
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:162:  per_query_timeout_ms: 30000
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:163:  retry_on_timeout: false           # bridge does NOT retry; failure -> log + return empty
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:176:| Sync MCP call per dispatch | Always async with timeout (per_query_timeout_ms=30000) | VTP MCP can take 60+ seconds per Phase 14 cross-check; sync would block orchestrator loop | timeout chosen |
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:177:| Wrap MCP calls in fresh Promise.race | Use orchestrator's existing MCP timeout (Step 3.7 pattern) | The Step 3.7 timeout fires once at session start; per-call timeout is a different contract | NEW timeout chosen (per-call) |
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:262:        │      with per_query_timeout_ms   │
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:263:        │      AbortController             │
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:268:   [MCP success]            [MCP timeout / error / auth-fail]
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:277:   │     each with       │   │    status:'fail'|'timeout', │
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:303:                │  status:'ok'|'fail'|'timeout',   │
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:361:  'vtp_call_timeout',
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:445:      status: payload.status,                   // 'fail' | 'timeout' | 'auth_failed'
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:449:      error_type: payload.error_type,           // 'mcp_unreachable' | 'mcp_timeout'
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:459:    fs.appendFileSync(p, JSON.stringify(row) + '\n', 'utf8');
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:487:    reason_codes: ['vtp_call_timeout'],          // or other failure code
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:503:      : (packet.reason_codes.includes('vtp_call_timeout') ? 'timeout' : 'fail');
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:531:- **Throwing on MCP timeout.** Lock 13 + Phase 32 contract. Always log + return sentinel packet with `ok:false`.
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:537:- **Treating an empty results[] as a failure.** A successful VTP call that returns zero hits is `{ok:true, results:[], reason_codes:['vtp_call_returned_empty']}`. Failure (`ok:false`) is reserved for MCP timeout/error/unhealthy.
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:553:| Per-call timeout | New timeout helper | `Promise.race([_callVtpTool(...), _timeoutAfter(ms)])` (Node 18+ native) | Standard pattern; no new dep |
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:571:**What goes wrong:** MCP times out at 30s. Bridge appends to results[] a row like `{title:"VTP Error", excerpt:"timeout after 30000ms"}`. Downstream consumer (Phase 45 packet builder) treats it as a research conclusion.
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:574:**Warning signs:** Phase 45 context-packet entries containing the literal string "timeout" or "MCP error" in the body text.
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:592:**What goes wrong:** vtp-health.jsonl tail says `vtp_available: false`. Bridge calls MCP anyway, gets timeout, logs failure, returns empty packet. Each call wastes 30s.
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:594:**How to avoid:** Step 1 of `selectiveVTPCall` reads vtp-health.jsonl tail (mirror Phase 47 `_vtpHealthFromLog` route.cjs:262-293). If unhealthy, return `{ok:false, reason:'vtp_unavailable'}` immediately — no MCP call, no timeout. Single failure row written referencing the health-probe state. Self-test fixture F6 binds.
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:595:**Warning signs:** vtp-bridge-failures.jsonl shows runs of timeout rows ALL within seconds of each other and no vtp-health.jsonl `vtp_available:true` row in between.
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:753:  // Gate 3: dispatch the actual MCP call with timeout.
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:755:  const timeout_ms = (input.routes_yaml && input.routes_yaml.vtp_bridge
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:756:                       && input.routes_yaml.vtp_bridge.per_query_timeout_ms)
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:767:      timeout_ms,
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:775:    const error_type = mcp_error.message.startsWith('TIMEOUT_') ? 'mcp_timeout'
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:780:      status: error_type === 'mcp_timeout' ? 'timeout' : 'fail',
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:787:      reason_codes: [error_type === 'mcp_timeout' ? 'vtp_call_timeout' : 'vtp_call_validation_failed'],
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:869:| A3 | `per_query_timeout_ms=30000` (30s) per VTP MCP call is appropriate | §3.1 routes.yaml extension | Phase 14 cross-check observed `vtp_research_gate` timeouts at 120s and validation failures at 55s ([CITED: 2026-04-27-agent-context-bloat-vtp-crosscheck.md:46-48]). 30s may be too aggressive for some tools. **[ASSUMED]** but BACKED by Phase 14 evidence that long-running tools should be excluded from Phase 48's selective bridge anyway. RECOMMENDATION: bridge does NOT include `vtp_research_gate` in TOOL_MAP — only the fast tools. |
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:875:**[ASSUMED] entries to confirm with operator at planning time:** A1 (wiki_search vs substrate fallback), A2 (max_tokens cap), A3 (timeout), A5 (substrate vs research for architecture).
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:1011:- `.planning/analyses/2026-04-27-agent-context-bloat-vtp-crosscheck.md:34-69` — VTP MCP tool family validation, book storage as wiki_page, validation/timeout failure modes
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:1034:- **Every new projection gets a rebuild test** — Followed: `vtp-bridge-failures.jsonl` is append-only canonical (NOT a projection — primary stream).
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:1055:- **MCP timeout** (BENCH-05 extension): inject `_force_vtp_tool_response: { __error: 'TIMEOUT_30s' }`; assert empty results[] and timeout failure row.
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-RESEARCH.md:1092:| F2 | Inject MCP error `TIMEOUT_30000ms` → packet `ok:false`, `results:[]`, NO error text in body, vtp-bridge-failures.jsonl row appears with `error_type='mcp_timeout'`, `error_message` contains injected text | A3, VTPR-03 |
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\21-03-config-empty-hit-PLAN.md:88:      if probe fails (timeout/error) -> cache vtp_available=false, log warning
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\21-03-config-empty-hit-PLAN.md:132:  fs.writeFileSync('.planning/config.json', JSON.stringify(cfg, null, 2))
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:40:    - "MCP failures (timeout, auth, validation, unreachable, internal) append a row to .planning/metrics/vtp-bridge-failures.jsonl and NEVER appear inside evidence_packet.results[] (A3, VTPR-03)"
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:70:      provides: "NEW top-level vtp_bridge: section with evidence_packet_max_tokens (5000 default), per_query_timeout_ms (30000 default), retry_on_timeout (false). Phase 47 'table:' section UNTOUCHED."
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:89:      via: "fs.appendFileSync envelope-v1 row on every MCP failure (timeout/auth/validation/unreachable/internal). Stream is NEW canonical (additive per EXISTING-SURFACE-AUDIT:38)."
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:126:high-confidence corpus evidence. MCP timeouts and auth failures must be first-class
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:189:// {evidence_packet_max_tokens:5000, per_query_timeout_ms:30000, retry_on_timeout:false}.
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:211://   'timeout' -- MCP timeout
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:280:| Forward contract -- Phase 51 BENCH fixtures (vtp_unavailable, mcp_timeout, bad_provenance, compactness) | 48-RESEARCH.md L1052-1057 | T1 self-test F1/F2/F3/F6/F8 cover same shapes; Phase 51 reuses fixtures | T1 |
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:332:      -> packet.reason_codes includes 'vtp_call_timeout'
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:334:      -> JSON.stringify(packet) does NOT contain the substrings 'TIMEOUT' or 'timeout after'
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:335:      -> tail row in vtp-bridge-failures.jsonl has command:'vtpBridgeFailure', error_type:'mcp_timeout', error_message contains 'TIMEOUT_30000ms'
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:411:         'vtp_call_timeout',
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:421:         'mcp_timeout',
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:438:     - _callVtpToolWithTimeout(toolName, args, timeoutMs, _force_response)
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:440:                                              // wraps actual call in Promise.race timeout helper
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:596:    bridge reads `vtp_bridge.evidence_packet_max_tokens`, `vtp_bridge.per_query_timeout_ms`,
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:597:    `vtp_bridge.retry_on_timeout` via the same `loadRoutes()` helper Phase 47 uses
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:660:        # Per-call MCP timeout. Bridge does NOT retry on timeout; failure
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:663:        per_query_timeout_ms: 30000
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:666:        retry_on_timeout: false
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:784:     status='fail'|'timeout'). No additional logging required from the
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:811:     fixtures (vtp_unavailable, mcp_timeout, bad_provenance, compactness)
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:870:| T-48-05 | Information Disclosure | MCP error message leaks server-side state (file paths, internal IDs) into evidence_packet.results[] where Agent reflects it back to user | mitigate | Structural separation (A3 binding): failure path returns `results:[]` ALWAYS. Error text lives ONLY in `vtp-bridge-failures.jsonl`. Self-test F2 scans `JSON.stringify(packet)` for any error-token substrings (e.g. 'TIMEOUT', 'timeout after') and asserts NONE present. |
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:871:| T-48-06 | Denial of Service | Caller sends a 100KB query string causing MCP to OOM or block bridge for 30s with no caller-side cap | mitigate | `_validateInput` enforces `query.length <= 10000` (rejects with descriptive message). Per-call timeout `per_query_timeout_ms = 30000` (configurable in routes.yaml) bounded by `Promise.race` with AbortController. Bridge does NOT retry; one failed attempt = one failure row + empty packet. |
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:899:# F2 mcp_timeout -> failure-log + empty packet (assertion 2; A3 binding)
.planning/milestones/v1.9\phases\48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:967:   `per_query_timeout_ms: 30000`, `retry_on_timeout: false`. Existing `table:`
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-SUMMARY.md:20:  - dogfood:timeout-observability-shipped
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-SUMMARY.md:40:### Plan 25-03 — INSTR-02 + INSTR-03 dashboard + timeout
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-SUMMARY.md:42:- **INSTR-03**: `codex-timeout-observability.jsonl` row emitted at RC=124 timeout branch. Includes `tier_actual_via_retry` distinguishing timeout-then-retry from timeout-then-exit.
.planning/milestones/v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:126:| `codex-exec.sh --self-test --skip-network` | super-gsd/scripts/codex-exec.sh | Cheap codex binary+auth+timeout+contract probe | Phase 14 owner; appends self-test row to codex-log.jsonl |
.planning/milestones/v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:307:        if (probes.path && probes.auth && probes.timeout && probes.contract) {
.planning/milestones/v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:658:| Stored data | None — Phase 47 introduces no new persistent stores. route-decisions.jsonl is a Phase 32 stream (append-only). | none |
.planning/milestones/v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:789:| Codex health | .planning/metrics/codex-log.jsonl rows where `step:"self-test"` | tail-walk; check `self_test_probes:{path,auth,timeout,contract}` all true; max_age 30min | gate codex routes |
.planning/milestones/v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:969: "self_test_probes":{"path":true,"auth":true,"timeout":true,"contract":true},
.planning/milestones/v1.9\phases\47-dispatch-routing-substitution\47-RESEARCH.md:1312:- `.planning/metrics/route-decisions.jsonl` — additive (append-only via existing route-ledger.cjs)
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-VERIFICATION.md:28:| 8  | INSTR-03: timeout observability emit at RC=124 branch in codex-exec.sh       | VERIFIED | codex-exec.sh — RC=124 branch appends row to .planning/metrics/codex-timeout-observability.jsonl |
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-VERIFICATION.md:29:| 9  | INSTR-03: tier_actual_via_retry field distinguishes retry-escalation         | VERIFIED | codex-exec.sh — when --retry-on-timeout-escalate set + step=phase-level-ATC, label is "tier->analysis(retry)" |
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-VERIFICATION.md:41:| `super-gsd/scripts/codex-exec.sh`              | VERIFIED — timeout observability emit |
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-CONTEXT.md:17:- **INSTR-02..03** (Plan 25-03) — dashboard offload math audit + timeout observability metric.
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-CONTEXT.md:29:- **INSTR-03** timeout observability — new `.planning/metrics/codex-timeout-observability.jsonl` row per timeout event (ts, tier_requested, tier_actual_via_retry, duration_ms, exit_code). Dashboard tile surfaces "timeout rate by tier".
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-CONTEXT.md:43:- `super-gsd/scripts/codex-exec.sh` (INSTR-03 timeout-observability emit)
.planning/milestones/v1.5\phases\25-carryover-telemetry\25-CONTEXT.md:44:- `.planning/metrics/codex-timeout-observability.jsonl` (INSTR-03 new file — created on first emit)
.planning/milestones/v1.9\phases\46-sqlite-context-index\reviews\46-REVIEW.md:78:A3 idempotency: rm db && rebuild → byte-identical manifest_hash ✓
.planning/milestones/v1.9\phases\50-cockpit-research-dashboard\50-01-cockpit-research-dashboard-PLAN.md:121:Purpose: stop handing broad raw context to operators. Phase 50 is a wiring/refactor problem - every aggregation, parser, and renderer it needs is either (a) already present in sgsd-mission-control.ps1's lib, or (b) shipped by Phases 41/42/45/49 as a public API. The risk is duplication, not new work. RESEARCH section "Don't Hand-Roll" lists 11 helpers to consume by reference instead of re-implementing. The acceptance criteria translate to: relocate, dedupe, add 3 new pane libs that are thin readers over public APIs, plus a Node bridge that calls all v1.9 APIs in one shot.
.planning/milestones/v1.9\phases\50-cockpit-research-dashboard\50-RESEARCH.md:52:Phase 50 is a **render layer over already-shipped data**. Phases 41-49 produced canonical streams, public-API helpers (`summarize()`, `runCheck()`, `getMemoryGovernanceSnapshot()`), and JSONL append-only logs. Phase 50 reads those, projects them into 4 panes (left-top + right + Codex + bottom-strip), and never writes back. The existing cockpit is `super-gsd/scripts/sgsd-mission-control.ps1` (1,999 lines) plus 4 lib files (1,506 lines). Phase 50 **extends** this surface — it does not replace it.
.planning/milestones/v1.9\phases\50-cockpit-research-dashboard\50-RESEARCH.md:305:**Key insight:** Phase 50 is **almost entirely** a wiring problem. Every aggregation, parser, and renderer it needs is either (a) already in `sgsd-mission-control.ps1`'s lib, or (b) shipped by Phases 41/42/45/49 as a public API. The risk is duplication (re-implementing what's already there), not new work. The acceptance criteria translate to: relocate, dedupe, add 3 new pane libs that are thin readers over public APIs.
.planning/milestones/v1.9\phases\46-sqlite-context-index\46-VERIFICATION.md:22:| A3 | Hash-idempotent rebuild | PASS | H1=H2=`d764fb5c656873659c611809292def373e6fcc2851cd7f67af5086e6beab69f0` after `--rebuild` |
.planning/milestones/v1.9\phases\46-sqlite-context-index\46-VERIFICATION.md:53:  by hash-idempotent rebuild
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:53:    - "lifecycle backfill (one-shot, idempotent) populates 44 existing PHASE-CAPSULE.json with safe defaults: compression_level='phase_capsule', promoted_at=cap.created_at, allowed_consumers=['*'], revocation_path='super-gsd/tools/memory-governance/lifecycle.cjs#revoke'; capsules whose compression_level!=null are SKIPPED (Pitfall 2 idempotency)"
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:126:      via: "fs.appendFileSync envelope-v1 row on every successful promote() call; NEW canonical stream owned by Phase 49"
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:130:      via: "fs.appendFileSync envelope-v1 row on every successful demote() call; NEW canonical stream"
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:134:      via: "fs.appendFileSync envelope-v1 row on every successful revoke() call; NEW canonical stream"
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:138:      via: "fs.appendFileSync envelope-v1 row on every drift-detected revalidate() call; NEW canonical stream"
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:142:      via: "fs.appendFileSync envelope-v1 row on processComplaints repair-action scheduling; orchestrator-pickup queue (Phase 49 schedules, orchestrator dispatches Phase 45 packet rebuild via existing wire)"
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:146:      via: "fs.writeFileSync (atomic tmp+rename) of {since_ts: <max ts processed>}; processComplaints reads on entry, writes on exit; monotonic advance prevents repair-loop (Pitfall 6)"
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:206:populates 44 existing PHASE-CAPSULE.json with safe defaults (idempotent;
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:591:| RESEARCH sec 13: lifecycle backfill (one-shot, idempotent, 44 capsules) | 49-RESEARCH.md L1150-1167 | T3 calls backfillLifecycleFields via CLI; T1 implements the function; F11 idempotency fixture | T1, T3 |
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:597:| RESEARCH Pitfall 2: idempotency on backfill | 49-RESEARCH.md L495-503 | T1 backfillLifecycleFields skips capsules with compression_level!=null; F11 fixture binds | T1, T3 |
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:615:| Trap 6: do NOT mutate existing PHASE-CAPSULE.json files outside the lifecycle-field-extension edit | plan brief | T3 calls backfillLifecycleFields ONCE; per-file edits route through Phase 43 writeCapsule (atomic); idempotent re-run no-op | T3 |
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:768:    F11  lifecycle backfill idempotency:
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:899:     fs.appendFileSync(filePath, JSON.stringify(row)+'\n', 'utf8').
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:1066:        - If cap.compression_level != null -> skip (idempotency; Pitfall 2).
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:1136: 11. backfillLifecycleFields MUST be idempotent (skip non-null compression_level).
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:1423:  <name>Task 3: Backfill lifecycle fields on 44 existing PHASE-CAPSULE.json files (idempotent)</name>
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:1450:    - Re-running the backfill is a NO-OP (idempotent). The CLI prints
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:1473:      - If cap.compression_level != null -> skip (idempotency; Pitfall 2).
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:1529:  git commit -m "feat(49-01): backfill lifecycle fields on 44 existing capsules (idempotent)"
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:1534:     unconditionally, idempotency breaks.
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:1544:     tmp+rename) -- NEVER direct fs.writeFileSync from this task.
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:1554:    defaults; promoted_at preserves cap.created_at; archive/ skipped; idempotent
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:1984:- T3: 44/44 PHASE-CAPSULE.json have compression_level=='phase_capsule'; idempotent re-run is no-op; Phase 41-48 sources + 9 read-only canonical streams unchanged
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:1998:- F11 backfill idempotency passes
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:2011:3. All 44 existing PHASE-CAPSULE.json files have lifecycle fields populated with safe defaults; promoted_at preserves cap.created_at; archive/ skipped; idempotent re-run is no-op (Task 3)
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-01-memory-governance-lifecycle-PLAN.md:2027:- Backfill: 44/44 capsules updated; idempotent re-run no-op count
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-PLAN-CHECK.md:49:### T5 (hybrid replay --mode=full) - WARN-LEVEL
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-PLAN-CHECK.md:61:- WARNING 4 (W4 - CRITICAL): evidence_retention oracle reads postArtifacts and checks expected_evidence membership. T5 replayScenario returns post_artifacts but does NOT specify population. Without a deterministic source, evidence_retention defaults to 0.0 and every scenario hard-fails for the WRONG reason. SIMPLEST FIX: post_artifacts = [...packet.metadata.consumed_capsule_decisions, ...packet.bypass_refs, ...packet.metadata.consumed_atc_findings]. This is fully deterministic, byte-equality-checkable, Lock-11-compliant. Most important amendment.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-PLAN-CHECK.md:92:### d. Does T5 hybrid replay produce REAL token data, or could stubbed dispatch slip through? - REAL (with W1 fix)
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-PLAN-CHECK.md:168:- T2: replay.cjs (disjoint)
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-PLAN-CHECK.md:171:- T5: replay.cjs (extends T2 stub) + harness.cjs (replay wiring region only)
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-PLAN-CHECK.md:195:T5 replayScenario returns post_artifacts but does not specify population. T6 scoreScenario consumes it. Without a deterministic population step, evidence_retention defaults to 0.0 and every scenario hard-fails - for the wrong reason. Fix (recommended): T5 output_contract specifies post_artifacts = [...packet.metadata.consumed_capsule_decisions, ...packet.bypass_refs, ...packet.metadata.consumed_atc_findings]. Fully deterministic, byte-equality-checkable, Lock-11-compliant. Single most important amendment.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-PLAN-CHECK.md:227:The plan respects Lock 4 (Phase 41-50 byte-untouched), Lock 11 (no semantic similarity), and Lock 13 (never-throws-upward). The 18-assertion self-test is well-shaped and ~60-second runtime is plausible. The hybrid replay anti-cheat boundary mirror to sgsd-blind-live-controller.mjs is the right architectural decision. Token budget (~815k) is well below the v1.9/P41 baseline single turn (1.24M), proving the bench is self-funding under its own headline claim.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-ATC-REVIEW.md:16:16 files, 6053 lines, 11 commits (cc1b41b^..HEAD). New files: harness.cjs (2203L), replay.cjs (946L), scoring.cjs (815L), failure-injectors.cjs (1050L), SCENARIO.schema.json (200L), BENCHMARK-REPORT.template.md (53L), S1-S6 fixtures + SCHEMA.md (519L), run-self-test.cjs (52L). Modified: sgsd-complete-milestone.cjs (147L), SKILL.md (1 bullet appended).
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-ATC-REVIEW.md:61:- **M1**: Exported `harness.replayScenario` (line 237) delegates to `_replayScenarioImpl` (line 522), the T1-era skeleton stub that always returns `mode_used='ledger-only'` / `tokens_after=null`. Same for `harness.injectFailure` → `_injectFailureImpl`. Production `runBench` is correct (calls `replay.replayScenario` directly via `_runBenchImpl`), but the exported public API permanently stubs out for any external caller. **FIXED in-loop**: rewired `_replayScenarioImpl` and `_injectFailureImpl` to delegate to the real `replay.replayScenario` and `_injectors.injectFailure` modules.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-ATC-REVIEW.md:75:| Lock 4 (upstream byte-untouched, import-by-ref) | PASS | git diff --quiet on 9 upstream tool trees exit 0 (verifier confirmed); tokenAttr.summarize at replay.cjs:214; _phase45.buildPacket at replay.cjs:690 |
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-ATC-REVIEW.md:78:| Lock 13 (try/catch on all public APIs; no upward throws) | PASS | harness lines 228/238/250/261/271; replay.replayScenario line 588; scoring scoreScenario/aggregateGate/renderReport wrapped; failure-injectors.injectFailure wrapped; sgsd-complete-milestone outer+inner catch; assertWorkspaceClean intentional throw is documented Lock 13 contract exception |
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-ATC-REVIEW.md:113:One MEDIUM finding (harness.replayScenario/injectFailure exported stubs) **fixed in-loop** by delegating to real implementations. Three LOW findings deferred to milestone close.
.planning/milestones/v1.9\phases\46-sqlite-context-index\46-RESEARCH.md:9:mirror_template: Phase 41 token-attribution/report.cjs (envelope-v1 emitter + ROLES + ledgerPath + COMMAND_NAME), Phase 42 token-waste/check.cjs (read-only verdict producer + closed-flag CLI + never-throws-upward), Phase 43 phase-capsule/write.cjs (canonical-source walker + sha256 hashing + idempotent rebuild + SCHEMA_VERSION + Lock 13), Phase 44 context-registry/check.cjs (validateReferences boundary + 4-outcome reasons + Lock 13 falsey-sentinel), Phase 45 context-packet/build.cjs (8-step build sequence step 6 = local index snippets contract; current `_index_snippets: []` stub at build.cjs:703).
.planning/milestones/v1.9\phases\46-sqlite-context-index\46-RESEARCH.md:34:| A3 | "deleting the DB and rebuilding preserves document count and hash manifest" | §5 hash manifest design + §6 `--drop-and-rebuild` orchestrator + §11 F2 idempotent-rebuild fixture (deep-equal manifest) |
.planning/milestones/v1.9\phases\46-sqlite-context-index\46-RESEARCH.md:69:| Stateless Decision Memory / DDIA | "Append-only truth plus rebuildable projections beats hidden mutable memory for auditability." | §1.3 Lock 3 binding; §5 manifest design; §11 F2 idempotency fixture. Phase 46 IS the canonical example of this lesson in v1.9. |
.planning/milestones/v1.9\phases\46-sqlite-context-index\46-RESEARCH.md:120:- `.planning/metrics/context-complaints.jsonl` (Phase 43+45 append-only; Phase 46 may APPEND a `contextIndexComplaint` row on rebuild error — §6.5)
.planning/milestones/v1.9\phases\46-sqlite-context-index\46-RESEARCH.md:306:Each capsule produces **1 document row** (the capsule as a whole). Decisions inside capsules are NOT separately indexed via this walker; the §4.3.2 decisions walker handles mass-discuss decisions only. (Capsule decisions reach the index via the capsule body field; see §4.3.5 dedup rule.)
.planning/milestones/v1.9\phases\46-sqlite-context-index\46-RESEARCH.md:799:- F2 idempotent rebuild fixture proves this end-to-end: source_hash is in the manifest, manifest is byte-equivalent across rebuilds → source_hash is non-null and stable.
.planning/milestones/v1.9\phases\46-sqlite-context-index\46-RESEARCH.md:968:  - Modify one indexed source: `fs.writeFileSync(somePath, oldContent + 'extra')`
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-VERIFICATION.md:11:**Goal:** 6 governance APIs + lifecycle field schema extension + idempotent backfill
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-VERIFICATION.md:19:capsules backfilled idempotently, build.cjs:712-724 wires Phase 45 step 6 via
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-VERIFICATION.md:67:fields on PHASE-CAPSULE schema with idempotent backfill (44/44 capsules,
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:12:  - super-gsd/tools/context-bench/replay.cjs
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:45:  - hybrid-replay
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:65:    - "Lock 11 holds: harness scenario selection, evidence oracle, and relationship validation use ONLY set-membership and byte-equality (no embedding, cosine, levenshtein, regex-fuzzy, or semantic_similarity_only signal anywhere in scoring.cjs or replay.cjs)."
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:66:    - "Lock 13 holds: all 5 public APIs (runBench, replayScenario, injectFailure, scoreScenario, renderReport) wrap internals in try/catch and return a falsey/degraded-verdict sentinel on error; no path throws upward; --mode=ledger-only succeeds even when claude CLI is absent."
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:70:      provides: "Entry point + CLI for the context stress benchmark; orchestrates baseline-read, scenario replay, injection, scoring, report render. Lock 13 wrapped public APIs."
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:101:    - path: "super-gsd/tools/context-bench/replay.cjs"
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:102:      provides: "Hybrid replay engine: ledger-only mode reads Phase 41 baseline; full mode dispatches real Sonnet for S1..S6 with anti-cheat boundary"
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:104:        - "replayScenario({scenario, mode, planningDir, fixtureDir, claudeBinary}) -> {tokens_after, post_artifacts[], scenario_run_id}"
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:179:    - from: "super-gsd/tools/context-bench/replay.cjs"
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:184:    - from: "super-gsd/tools/context-bench/replay.cjs"
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:234:      Bootstrap self-test (3-5 assertions): SCENARIOS frozen, INJECTION_FIXTURES frozen, BENCH_REASON_CODES frozen + >=10 entries, public-API names exist (runBench/replayScenario/injectFailure/scoreScenario/renderReport even if stubbed), Lock 13 wrapper present (try/catch on every public API).
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:237:      A canonical skeleton + scenario schema must land first because every subsequent task (T2 ledger reader, T3 fixture authoring, T4 injectors, T5 replay, T6 reporter, T7 self-test+gate) depends on the frozen public-API surface. Locking SCENARIOS/INJECTION_FIXTURES/BENCH_REASON_CODES via Object.freeze + a 3-5 assertion bootstrap self-test prevents downstream drift; mirrors Phase 41/45/49 skeleton-first pattern that shipped cleanly. Lock 11 (no semantic similarity) and Lock 13 (never throws upward) are documented at file-top so executors of later tasks cannot accidentally introduce embeddings, cosine, or unguarded throws.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:253:      - super-gsd/tools/context-bench/replay.cjs
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:261:        - super-gsd/tools/context-bench/harness.cjs (T1 skeleton; replay.cjs wires into runBench)
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:266:        - super-gsd/tools/context-bench/replay.cjs containing:
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:269:          * `replayScenario({scenario, mode, planningDir, fixtureDir, claudeBinary})` STUB returning `{tokens_after: null, post_artifacts: [], scenario_run_id: null, mode_used: 'ledger-only'}` for now (T5 fills `--mode=full` Sonnet path).
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:277:          * Test: replayScenario stub returns mode_used='ledger-only' when claudeBinary is null.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:279:      Baseline ledger reading must happen in its own task because (a) Lock R5 binds to ledger-only as default mode (Q2 recommendation), (b) Phase 41 summarize() is a frozen self-tested aggregator that this phase MUST consume by reference (Lock 4), (c) audit:142 gives a concrete crosscheck (S2 baseline >=150k tokens) that catches drift early, and (d) splitting baseline reader from injection (T4) and post-run (T5) keeps each task <=30% context. Reusing summarize() guarantees mechanical comparability with post-run numbers because both sides go through the same dedup/filter logic.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:282:        - replay.cjs forks or reimplements summarize (any local sum-of-token_breakdown.total_tokens loop is a Lock 4 violation).
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:409:      - super-gsd/tools/context-bench/replay.cjs
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:417:        - .planning/metrics/agent-token-spend.jsonl (Phase 41 collect.cjs writes post rows automatically; replay just tags run_id)
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:418:        - 51-RESEARCH.md §2.3 (cost ceiling + replay flow), §2.5 (anti-cheat boundary)
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:421:      Extends super-gsd/tools/context-bench/replay.cjs:
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:422:        - Implements `replayScenario({scenario, mode, planningDir, fixtureDir, claudeBinary})` --mode=full path:
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:435:        - Test (replay mode-downgrade): claudeBinary=null returns mode_used='ledger-only' with bench_fixture_skipped:claude_cli_unavailable reason and partial-report flag.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:437:        - Test (post_artifacts source): when buildPacket emits a known fixture packet, replayScenario returns post_artifacts that is element-wise byte-equal to the concatenation of packet.metadata.consumed_capsule_decisions + packet.bypass_refs + packet.metadata.consumed_atc_findings (no reordering, no dedupe, no transform).
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:439:      The hybrid replay (Lock R5) is the only way to prove "post-milestone researcher token spend < 50% of baseline" because (a) baseline ledger is real evidence already on disk (no rerun needed), (b) post-run REQUIRES real Sonnet inference against the new packet path - fixtures cannot prove a NEW model run produces fewer tokens than an OLD model run, (c) injection assertions (T4) are deterministic and fixture-driven so they don't need Sonnet. Anti-cheat boundary mirrors sgsd-blind-live-controller.mjs verbatim because that pattern already shipped and self-tested - inventing a new boundary risks introducing leaks. Token ceiling at 1.5M caps Sonnet cost (6 runs * ~50k each * 5x safety margin); claude CLI absence soft-downgrades to ledger-only because Phase 51 must emit a partial report rather than fail outright (Lock 13 + ASSUMPTION A2). Real-dispatch assertion (Test 18) is the ONLY way to prove the replay isn't being stubbed away - route-decisions.jsonl row.run_id substring match on prefix `bench-post-${scenario_id}-` is the unforgeable witness (Phase 47 route.cjs writes run_id but NOT a scenario_id field; matching by run_id substring is the schema-correct check). post_artifacts[] population from packet.metadata.consumed_capsule_decisions + packet.bypass_refs + packet.metadata.consumed_atc_findings is the deterministic, byte-equality-checkable source the T6 evidence_retention oracle requires; without this explicit population step the oracle defaults to 0.0 and every scenario hard-fails for the wrong reason.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:449:        - replay.cjs forks buildPacket or routeDispatch instead of import-by-reference (Lock 4).
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:450:        - replayScenario returns post_artifacts[] populated from any source OTHER than packet.metadata.consumed_capsule_decisions + packet.bypass_refs + packet.metadata.consumed_atc_findings (any local heuristic, regex, or hand-curated list violates Lock 4 + Lock 11 and breaks the T6 oracle's byte-equality contract).
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:451:        - In --mode=ledger-only, replayScenario returns post_artifacts as anything other than [] (the deterministic absent-source baseline; non-empty would inject phantom evidence into the oracle).
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:453:      `node super-gsd/tools/context-bench/harness.cjs --self-test` exits 0 with all bootstrap + T2 + T3 + T4 + T5 assertions PASS (running ~17-18 of 18). `--mode=full --milestone=v1.9 --dry-run` succeeds (computes packet shapes without spawning claude). Atomic commit `feat(51-01): hybrid replay + claude CLI dispatch + anti-cheat boundary mirror + 1.5M token ceiling + deterministic post_artifacts population`.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:474:      Inputs from prior tasks: 6 scenarios (T3), 16 injection results (T4), replay outputs (T5), baseline reader (T2).
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:475:      post_artifacts[] contract from T5: scoreScenario consumes postArtifacts as a verbatim array produced by replayScenario as post_artifacts = [...packet.metadata.consumed_capsule_decisions, ...packet.bypass_refs, ...packet.metadata.consumed_atc_findings]. The oracle treats this array as a set of opaque IDs; matching is byte-equality only (Lock 11). In --mode=ledger-only post_artifacts is [] by deterministic contract; the oracle must NOT default to 0.0 in that case - it must short-circuit to the 'ledger-only — incomplete' verdict path documented below.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:503:        - For each scenario S: call replayScenario, then scoreScenario, then append envelope-v1 row to .planning/metrics/context-bench-runs.jsonl.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:566:        - All 5 public APIs (runBench, replayScenario, injectFailure, scoreScenario, renderReport) export from harness top-level and each is try/catch wrapped (Lock 13).
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:590:Purpose: Phases 41-50 ship machinery; Phase 51 measures whether the machinery delivered the headline claim. The phase is a tool, not a feature. It lives at super-gsd/tools/context-bench/, ships a deterministic harness + a hybrid (ledger+Sonnet) replay engine + 14 canonical scenario fixtures (6 baseline + the 16 fixture catalog overlays them) + one canonical report at .planning/milestones/v1.9/CONTEXT-BENCH-RESULTS.md. Lock 4 (import-by-reference) is the dominant constraint: Phase 41/43/44/45/47/49 are CONSUMED, never reimplemented, never byte-modified. Lock 11 (no semantic similarity) and Lock 13 (never throws upward) extend verbatim across all 5 public APIs.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:592:Output: 14 NEW files (1 harness CJS, 1 replay CJS, 1 scoring CJS, 1 failure-injectors CJS, 1 schema MD, 1 schema JSON, 1 report template, 6 scenario fixtures, 1 self-test entry, 1 milestone-close cjs wrapper), 1 EDITED SKILL.md (sgsd-complete-milestone Step 0 wire; one bullet), 2 CANONICAL outputs (CONTEXT-BENCH-RESULTS.md + context-bench-runs.jsonl). 7 atomic commits, ASCII-only on every written file, read-only invariant on Phase 41-50 trees, 18-assertion self-test green in <60 seconds, anti-cheat boundary mirrored verbatim from sgsd-blind-live-controller.mjs.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:730:- Q1 (hybrid replay budget cap): TOKEN CEILING = 1,500,000 across 6 post-Sonnet runs (T5 falsifier). Abort behavior: harness emits verdict=DEGRADED + reason `bench_token_ceiling_exceeded`; renders partial report; never throws.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:736:- Q5 (fixtures git-tracked vs operator-local): SHIP IN GIT (super-gsd/tools/context-bench/scenarios/) for reproducibility. At runtime, replay.cjs COPIES fixtures to operator-local path (%LOCALAPPDATA%/sgsd-bench/decks or ~/.local/share/sgsd-bench/decks) before each scenario, then asserts workspace cleanliness. Mirrors sgsd-blind-live-controller.mjs --prepare-only pattern.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:750:| Lock 13 | REQUIREMENTS.md:68-69 | All 5 public APIs (runBench, replayScenario, injectFailure, scoreScenario, renderReport) wrap internals in try/catch and return falsey/degraded sentinels on error. T7 milestone-close cjs wrapper also Lock 13 wrapped (missing harness => stderr `milestone_close_blocked:context_bench_unavailable` + exit 1, never silent advance). |
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:765:  T2 [baseline ledger reader]             -> replay.cjs (depends_on T1)
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:770:  T5 [hybrid replay --mode=full]          -> replay.cjs (extends T2 stub), harness.cjs (touch only replay wiring)
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:777:Wave 2 files_touched are disjoint EXCEPT for harness.cjs, which each task edits in a different region (SCENARIOS const for T3, INJECTION_FIXTURES const for T4, replay wiring for T5). The executor MUST coordinate harness.cjs edits sequentially or use task-local diff scopes; T6 and T7 coordinate the final harness.cjs consolidation.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:786:  - super-gsd/tools/context-bench/{harness.cjs, replay.cjs, scoring.cjs, failure-injectors.cjs, SCENARIO.schema.json, BENCHMARK-REPORT.template.md, scenarios/SCHEMA.md, run-self-test.cjs}
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-01-context-stress-benchmark-PLAN.md:801:- [ ] Lock 13 audit: every public API (runBench, replayScenario, injectFailure, scoreScenario, renderReport) is wrapped in try/catch (grep on each function name + body for try{).
.planning/milestones/v1.9\phases\46-sqlite-context-index\46-01-sqlite-context-index-PLAN.md:393:    - F2 (idempotent rebuild): exists, throws "PENDING T2"
.planning/milestones/v1.9\phases\46-sqlite-context-index\46-01-sqlite-context-index-PLAN.md:665:          - fs.writeFileSync(tmpPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
.planning/milestones/v1.9\phases\46-sqlite-context-index\46-01-sqlite-context-index-PLAN.md:689:    - F2 (idempotent rebuild: delete db, rebuild, manifest deep-equal)
.planning/milestones/v1.9\phases\46-sqlite-context-index\46-01-sqlite-context-index-PLAN.md:718:       Append-only via fs.appendFileSync to
.planning/milestones/v1.9\phases\46-sqlite-context-index\46-01-sqlite-context-index-PLAN.md:1114:         fs.writeFileSync(tmpScript, `
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-VERIFICATION.md:20:    - "Lock 13 holds: all 5 public APIs (runBench, replayScenario, injectFailure, scoreScenario, renderReport) try/catch wrapped"
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-VERIFICATION.md:33:The harness genuinely measures the falsifiable proof bar. `scoring.cjs::aggregateGate` computes the **median** (not mean — Pitfall 2 fix) `pct_reduction` across S1-S6 and gates PASS at `median >= 0.5 AND every retention == 1.0 AND every injection gate fired AND zero ledger-only scenarios`. `evidence_retention` is computed deterministically via byte-equality set-membership over the (kind, ref) tuple (Lock 11): `|expected ∩ post_artifacts| / |expected|`. The verdict tree routes correctly across all four states — verified by self-test 16 (PASS), 17 (evidence-dominance FAIL), `t6_ledger_only_verdict_when_tokens_after_null`, and `t6_pass_with_deferred_requires_injection_success`. The hybrid replay engine reads tokens_before from the existing 11,294-row Phase 41 ledger via `tokenAttr.summarize()` (import-by-reference, no fork), and produces tokens_after via real `claude --print` dispatch with anti-cheat boundary. The unforgeable witness is the `bench-post-{scenario_id}-{ts}` `run_id` substring match in `route-decisions.jsonl`. When claude CLI is absent, the harness gracefully degrades to ledger-only — incomplete, never silently passing the 50% bar. Falsifiable proof bar: MEASURABLE.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-VERIFICATION.md:41:| 3 | All 6 baseline scenarios read tokens_before from Phase 41 ledger via summarize() | VERIFIED | `t2_summarize_is_live_function` PASS (typeof=function arity=2); `t2_baseline_reader_callable_and_shape` tokens=171175; `t3_source_event_ids_resolve_in_ledger` all 6 resolved; `replay.cjs:214` calls `tokenAttr.summarize(...)` |
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-VERIFICATION.md:44:| 6 | Anti-cheat boundary holds; run_id witness validates real dispatch | VERIFIED | `t5_assert_workspace_clean_rejects_6_plus_3_secret all 9 cases rejected`; `t5_real_dispatch_witness_run_id_substring run_id=bench-post-S1-v17-P32-1777399678985`; `replay.cjs:413 const runId = 'bench-post-' + scenario.scenario_id + '-' + tsMillis` |
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-VERIFICATION.md:46:| 8 | Lock 11: no embedding/cosine/levenshtein/fuzzy in scoring or replay | VERIFIED | grep finds only NEGATIVE-CONTEXT mentions in comments declaring NO such usage (`scoring.cjs:34`, `replay.cjs:43`); set-membership oracle in `_scoreScenarioImpl` |
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-VERIFICATION.md:57:| 3 | c03bcf7 | T2 | Baseline ledger reader + workspace-clean guard | PASS — `readBaselineFromLedger` calls `tokenAttr.summarize` (replay.cjs:214); `assertWorkspaceClean` rejects 6 forbidden + 3 secret-prefix strings; Lock 4 import-by-reference held |
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-VERIFICATION.md:61:| 7 | e70719d | T5 | Hybrid replay + claude CLI dispatch + anti-cheat boundary mirror + 1.5M ceiling | PASS — `replay.cjs::_spawnClaudeRun` mirrors blind-live-controller; run_id 'bench-post-{scenario_id}-{ts}'; token ceiling 1500000; ledger-only soft-downgrade; deterministic post_artifacts from packet.metadata.consumed_capsule_decisions+bypass_refs+consumed_atc_findings |
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-VERIFICATION.md:86:| `super-gsd/tools/context-bench/replay.cjs` | 946 | VERIFIED | readBaselineFromLedger (line 195) calls `tokenAttr.summarize` (line 214), assertWorkspaceClean rejects 6+3 strings, claude CLI mirror (line 512), run_id witness (line 413), 1.5M token ceiling, soft-downgrade |
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-VERIFICATION.md:103:| harness.cjs | token-attribution/report.cjs | `tokenAttr.summarize(...)` | WIRED (replay.cjs:214) |
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-VERIFICATION.md:104:| harness.cjs | context-packet/build.cjs | `buildPacket(...)` | WIRED (per replay.cjs anti-cheat boundary) |
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-VERIFICATION.md:107:| replay.cjs | dispatch-router/route.cjs | route-decisions.jsonl run_id substring | WIRED (replay.cjs:413, 444) |
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-VERIFICATION.md:108:| replay.cjs | harness-benchmark/sgsd-blind-live-controller.mjs | `claude --print --dangerously-skip-permissions` pattern mirror | WIRED (replay.cjs:512+) |
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-VERIFICATION.md:120:| BENCH-02 | Compare pre-milestone and post-milestone token spend | SATISFIED | replay.cjs reads Phase 41 ledger for tokens_before; --mode=full Sonnet dispatch produces tokens_after |
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-RESEARCH.md:309:**When to use:** ALL durable writes that produce artifacts intended for future SGSD memory consumption (capsules, validated_thoughts, reusable_rules, guardrails). Does NOT gate raw-evidence writes (those are append-only logs and the source of all promotions).
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-RESEARCH.md:463:| Atomic JSONL append | Custom file lock, `flock()`, write-ahead log | `fs.appendFileSync(p, JSON.stringify(row)+'\n', 'utf8')` mirroring Phase 45 `_appendRow` at `build.cjs:181` | POSIX append is atomic for < PIPE_BUF (4096 bytes); envelope rows are << 4096 |
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-RESEARCH.md:464:| Atomic JSON file rewrite (capsule lifecycle field edit) | Direct `fs.writeFileSync` | `fs.writeFileSync(tmp, ...) + fs.renameSync(tmp, target)` mirroring Phase 43 `_writeCapsuleInternal` at `write.cjs:1010` | tmp+rename is atomic on POSIX + Windows NTFS; survives crash mid-write |
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-RESEARCH.md:501:**How to avoid:** Backfill checks `if (cap.promoted_at != null) skip` per field. Only fields whose current value is `null` get defaults. Phase 49 `backfillLifecycleFields()` is idempotent: 1st run sets defaults, 2nd run is a no-op. Self-test fixture F10 binds this regression.
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-RESEARCH.md:503:**Warning signs:** Diffing PHASE-CAPSULE.json across two backfill runs shows `promoted_at` changed — backfill is non-idempotent.
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-RESEARCH.md:519:**Why it happens:** `fs.appendFileSync` is atomic only for < PIPE_BUF (4096 bytes) AND only on POSIX. Windows NTFS has different atomicity guarantees.
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-RESEARCH.md:733:| "Memory" stored as raw chat transcripts in ByteRover-style stores | Compression-level lifecycle (raw → capsule → thought → rule → guardrail) with mandatory provenance | VTP delta 2026-04-27 | Phase 49 implements; raw-text memory becomes append-only evidence; promoted artifacts MUST carry provenance |
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-RESEARCH.md:1143:| F11 | lifecycle backfill — 44 capsules updated; idempotent on re-run | Pitfall 2 |
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\49-RESEARCH.md:1274:- Lifecycle backfill: HIGH — 44-capsule count verified; idempotency rule clear
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\reviews\49-REVIEW.md:63:44/44 PHASE-CAPSULE.json files have lifecycle fields (idempotent)
.planning/milestones/v1.9\phases\49-memory-governance-lifecycle\reviews\49-REVIEW.md:69:T3 backfill idempotent (re-run skipped:44 errors:0)
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:70:The hardest decision is **replay strategy** (real Sonnet vs fixtures). Real Sonnet runs are expensive, drift between runs, and depend on provider availability — but they are the only way to genuinely prove "post-milestone" spend matches reality. Recorded fixtures are reproducible and cheap but can become stale and won't catch new bloat regressions. **Recommendation: HYBRID** — baseline numbers from Phase 41 ledger (already 11,294 rows of real evidence), post numbers from a small fixed set of *real* Sonnet runs against the locked scenario deck, and per-failure-injection assertions verified against fixtures (because the question there is "did the gate fire?", not "what did the model produce?"). This bounds total Sonnet cost to ~6 baseline-equivalent runs ≤ 1.5M tokens, while still giving real-world numbers.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:74:**Primary recommendation:** Build `super-gsd/tools/context-bench/` with three files (harness.cjs, scenarios.json, failure-injectors.cjs) + 14 scenario fixtures + one canonical report writer. Mirror `sgsd-blind-live-controller.mjs` for the anti-cheat boundary (§3.5). Hard-bind to Phase 41 `summarize()` for token attribution — never recompute. Hard-bind to Phase 49 governance signals (`context-complaints.jsonl` + memory revocation streams) for evidence-loss detection. Emit one canonical CSV row per scenario + one markdown report. Self-test 18 assertions covering: scenario shape, fixture replay determinism, injection mechanics, scoring oracle, anti-cheat boundary, and the 50% gate. Lock 11 (no semantic similarity) and Lock 13 (never throws) extend verbatim.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:98:- **`.planning` JSONL + git commits remain source of truth** (Lock 2). Benchmark results write to `.planning/milestones/v1.9/CONTEXT-BENCH-RESULTS.md` (canonical) + `.planning/metrics/context-bench-runs.jsonl` (canonical, append-only). Never to Redis as primary storage.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:172:The deck adds **8 failure-injection scenarios (F1-F16, deduplicated by mechanic — see §7 below)** layered onto S1-S6. Total fixture file count: **14** (6 baseline + 8 injection — injections share scenarios but inject different faults).
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:201:├── replay.cjs                        # hybrid replay (Phase 41 ledger + live Sonnet)
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:260:**Lock R5 (replay strategy):**
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:262:> Baseline numbers are read from `.planning/metrics/agent-token-spend.jsonl` (the existing 11,294-row Phase 41 ledger — REAL evidence, no replay cost). Post numbers come from a small fixed set of REAL Sonnet runs against the same scenarios, dispatched via the existing orchestrator path with the v1.9 packet builder enabled. Per-injection assertions (F1-F16) are verified against fixtures (the question is "did the gate fire?" — fixtures are sufficient and deterministic).
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:302:This guarantees mechanical comparability between baseline and post numbers — same aggregator, same dedup logic, same enum vocab. Phase 41 self-test asserts the aggregator's correctness; Phase 51 inherits that correctness without re-asserting.
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:544:| Routing was orchestrator-internal | Phase 47 `route-decisions.jsonl` with 18-entry `ROUTE_DECISION_REASONS` enum + 9-entry `BOUNDARIES` | Phase 47 | Every routing decision is auditable + reverse-replayable |
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:631:      fs.writeFileSync(capsulePath, before, 'utf8');
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:685:| `super-gsd/tools/context-bench/replay.cjs` | Hybrid replay (ledger-only + full Sonnet modes) |
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:725:| **Lock 13** | REQUIREMENTS.md:68-69 | All 5 public APIs (`runBench`, `replayScenario`, `injectFailure`, `scoreScenario`, `renderReport`) wrap internals in try/catch and return falsey sentinel on error. Never throws upward. |
.planning/milestones/v1.9\phases\51-context-stress-benchmark\51-RESEARCH.md:860:- Wave 3: replay.cjs (`--mode=full` path) + post-Sonnet run + report rendering
.planning/milestones/v1.9\phases\51-context-stress-benchmark\commit-reviews.jsonl:2:{"ts":"2026-04-28T16:40:25.828Z","plan":"51-01","task":"T2","tier":"FULL","verdict":"pass","critical":0,"warning":1,"one_liner":"All 5 T2 contract items verified, Lock 4/11/13 hold; 1 YAGNI field _t5_pending in replayScenario stub deferred","provider":"claude-sonnet","commit":"c03bcf7","gate":"per-dispatch-ATC"}
.planning/milestones/v1.9\phases\51-context-stress-benchmark\commit-reviews.jsonl:6:{"ts":"2026-04-28T17:26:57.321Z","plan":"51-01","task":"T5","tier":"FULL","verdict":"pass","critical":0,"warning":2,"one_liner":"T5 contract satisfied; Lock 4/11/13 verified; 2 LOW robustness warnings (ISO-ts precision + bench_replay boundary comment-only) deferred","provider":"claude-sonnet","commit":"e70719d","gate":"per-dispatch-ATC"}
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-ATC-REVIEW.md:33:| 4 Accelerate | PASS | 50ms Promise.race on all Redis ops; XADD MAXLEN ~ for O(1) trim; SCAN iterator (not blocking KEYS) |
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-ATC-REVIEW.md:98:| P4 | 50ms connection pool timeout | PASS — REDIS_COMMAND_TIMEOUT_MS=50 Promise.race on all client ops |
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-ATC-REVIEW.md:106:The degraded-OK contract (REDIS-LOCK-06) is the strongest feature: all 8 public APIs return documented sentinel objects under every failure condition (module missing, URL absent, env-disabled, connect failed, op timeout, internal error) and none throw. Self-test proves this mechanically without a running Redis server.
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-CONTEXT.md:39:- TTL and deduplication to prevent unbounded memory growth.
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-CONTEXT.md:69:- Redis timeout: continue with SQLite/local files and log timeout metadata.
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:67:      provides: "Single-file Redis adapter exposing 8 Lock-13-wrapped public APIs over an optional redis@5.12.1 client; read-side revalidation by source_hashes; allowlist/denylist on key kinds; namespace prefix sgsd:v19:; SCAN-based invalidation; XADD with TRIM for streams; 50ms command timeout race; credential-redacted projection log emission."
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:127:      via: "fs.appendFileSync inside _emitProjectionLog; envelope-v1 row per degraded/rejected/invalidated event"
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:137:      via: "Top-level `try { _redis = require('redis') } catch { _redis = null }`; lazy connection via createClient with socket.connectTimeout=5000 + reconnectStrategy + commandOptions.timeout=50"
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:174:          * `const REDIS_REASON_CODES = Object.freeze([...])` >=12 entries: redis_module_missing, redis_disabled_no_url, redis_disabled_by_env, redis_connect_failed, redis_op_timeout, miss, hit, source_hash_drift, poisoned_unparseable, schema_invalid, forbidden_kind, unknown_kind, redis_flushdb_recovered_via_sqlite, internal_error.
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:177:          * `_getClient()` async helper with createClient({url, socket:{connectTimeout:5000, reconnectStrategy: exp+jitter}, commandOptions:{timeout:50}}) per RESEARCH Pattern 1.
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:179:          * `_emitProjectionLog(row, opts)` helper: appendFileSync to .planning/metrics/redis-projection-log.jsonl with envelope-v1 row.
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:286:          * `Promise.race([c.get(key), setTimeout(50ms reject 'op_timeout')])` per RESEARCH §"Pitfall 4" + Pattern 1 (50ms command-timeout race).
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:349:        - .planning/milestones/v1.9/phases/52-redis-live-cache-adapter/52-REDIS-GUIDE-DELTA.md REDIS-LOCK-04 (TTL on every key OR stream retention; dedup by content_hash)
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:367:              * Compute content_hash = _sha256OfString(JSON.stringify(event.payload)) for dedup discipline.
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:421:          * `Promise.race([c.ping(), setTimeout(50ms reject 'ping_timeout')])`.
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:428:          * fs.appendFileSync(target, JSON.stringify(redactedRow) + '\n', 'utf8').
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:443:          * G2: drive `_emitProjectionLog({ command:'test', status:'degraded', reason:'isAvailable_threw', detail:'connect failed: redis://user:secret@host:6379 timeout'}, {projectDir})`; read tail of redis-projection-log.jsonl; assert no occurrence of `:secret@` AND no match of regex `://[^:]+:[^@]+@`.
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:647:  fs.appendFileSync(jsonlPath, JSON.stringify(envelope) + '\n', 'utf8');
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:730:  commandOptions: { timeout: 50 }
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:755:- **Q5 (redis-projection-log.jsonl git-tracked?):** Resolved YES (Q5 RESEARCH-recommended TRACK). Mirrors token-attribution + route-decisions discipline (envelope-v1, append-only, useful in git history for debugging). Different from heartbeat.jsonl (gitignored) which emits per-second; projection log emits per-degradation only. The first row written by self-test is committed alongside the adapter for evidence symmetry.
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:769:| REDIS-LOCK-06 | 52-REDIS-GUIDE-DELTA.md | Degraded-OK; Redis down/timeout/auth-fail/module-missing all return sentinel; SQLite/local files always serve. T7 A1+A2+A3+G1 enforce. |
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-01-redis-live-cache-adapter-PLAN.md:860:10. REDIS-LOCK-01..07 hold: projection-only (no canonical writes), source-hash invalidation (every read revalidates), intent-scoped semantic cache (5-component byte-equality), TTL+dedup (every key has EX or stream retention), safe FLUSHDB (post-flush canonical files untouched), degraded-OK (Redis down/timeout/auth-fail all return sentinel + SQLite serves), poisoned-key defense (rejected + deleted + logged).
.planning/milestones/v1.5\phases\22-security-hardening\22-CODEX-PROMPT-R6.md:26:5. **SEC-02 flock branch** — Lock acquisition checks exit code, falls through to Node `appendFileSync` with `lock_fallback:true` audit field on timeout. Verify no silent-corruption surface remains.
.planning/milestones/v1.5\phases\22-security-hardening\22-02-flock-concurrent-write-PLAN.md:24:      (3) elif node available: node -e appendFileSync fallback (no lock_fallback field needed
.planning/milestones/v1.5\phases\22-security-hardening\22-02-flock-concurrent-write-PLAN.md:25:      — Node appendFileSync is atomic on POSIX for small writes);
.planning/milestones/v1.5\phases\22-security-hardening\22-02-flock-concurrent-write-PLAN.md:74:    # Fallback: Node fs.appendFileSync (atomic for small POSIX writes)
.planning/milestones/v1.5\phases\22-security-hardening\22-02-flock-concurrent-write-PLAN.md:75:    node -e "require('fs').appendFileSync('$LOG_PATH', process.argv[1]+String.fromCharCode(10))" "$row" 2>/dev/null \
.planning/milestones/v1.5\phases\22-security-hardening\22-02-SUMMARY.md:38:1. **flock path (preferred):** `exec {LOG_FD}>>"$LOG_LOCK_RAW"` opens a sibling lock fd; `flock -x -w 5 $LOG_FD` acquires an exclusive 5-second-timeout lock; the row is then written via the secure append helper. `flock -u $LOG_FD` releases; `exec {LOG_FD}>&-` closes. A bash >= 4.1 version guard (`BASH_VERSINFO`) gates this path since `exec {var}>>` automatic fd allocation requires bash 4.1+.
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\21-03-SUMMARY.md:82:None. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. `vtp-health.jsonl` is an append-only local metrics file; no external surface added.
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-PLAN-CHECK.md:134:All 8 public APIs are wrapped in try/catch and return falsey/degraded sentinels on any error. When Redis is absent (no module, no URL, DISABLED=1, connect timeout, ping timeout, command timeout), the sentinel surface fires and the caller falls through to Phase 46 SQLite + .planning/ files. The system continues; only the speed layer degrades. Self-test G1 drives every API with bogus inputs and asserts no exception escapes.
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-PLAN-CHECK.md:164:| REDIS-LOCK-04 (TTL + dedup) | Every put has EX from TTL_BY_KIND; streams use TRIM MAXLEN tilde 1000; content_hash dedup | T3, T4 | B3, F2, F3 | **VERIFIED** -- TTL discipline + stream retention |
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-PLAN-CHECK.md:194:The T1 output_contract describes _getClient() as caching _client and returning the cached client when _client.isOpen. If a client transitions to a closed/errored state mid-run (e.g., Redis restart), the cached _client may stay non-null but no longer accept commands; the next c.ping() or c.get() would surface the error via the 50ms timeout race and degrade. This is correct behavior, but worth a one-line clarification in the T1 stop rule that after a connection error, subsequent calls degrade via timeout race; explicit reconnect is handled by socket.reconnectStrategy.
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-REDIS-GUIDE-DELTA.md:80:Redis down, Redis timeout, Redis auth missing, and Redis missing module support
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:81:- Redis timeout -> continue with SQLite/local files + log timeout metadata
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:95:invalidation, intent-scoped semantic cache, TTL+dedup, safe FLUSHDB,
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:189:| Live event stream (cockpit progress, agent retry, canary) | Redis Streams (when available) | `.planning/metrics/*.jsonl` (Phase 41 envelope-v1) | Streams give sub-second cockpit refresh; JSONL is durable + append-only. |
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:200:| `redis` (node-redis) | `5.12.1` (2026-04-14) | Official Node.js client maintained by Redis Inc. | Recommended by Redis vendor; modern API; supports `socket.connectTimeout`, `commandOptions.timeout`, custom `reconnectStrategy`, `xAdd`/`xRange`/`xLen` for streams, `EXPIRE`/`TTL` for hot keys. [VERIFIED: `npm view redis version` -> 5.12.1; `npm view redis time` shows 5.12.0 published 2026-04-14, 5.12.1 hotfix same day] [CITED: Context7 `/redis/node-redis`, sections "Basic Connection", "Set Command Timeout", "Custom Reconnect Strategy", "Manage Redis Streams"] |
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:206:| `crypto` (Node stdlib) | n/a | sha256 of value bytes for content-hash dedup; sha256 of canonical refs for invalidation lookup keys | Every key write computes value hash for `content_hash` dedup field; every read recomputes source_hashes against canonical state. |
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:207:| `fs` (Node stdlib) | n/a | append-only `redis-projection-log.jsonl` writer | Lock 13 complaint emission pattern from Phase 46 rebuild.cjs:222-234 reused. |
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:252:|  - URL parse    |      |  - kind allowlist   |      |  - dedup by        |
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:253:|  - 50ms timeout |      |  - source_hash      |      |    content_hash    |
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:266:        v (on error / timeout / no client / disabled)            v
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:372:      commandOptions: { timeout: 50 }
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:387:    const ping = await Promise.race([
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:389:      new Promise(function (_r, rj) { setTimeout(function () { rj(new Error('ping_timeout')); }, 50); })
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:420:    const raw = await Promise.race([
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:422:      new Promise(function (_r, rj) { setTimeout(function () { rj(new Error('op_timeout')); }, 50); })
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:461:length. Use deduplication-by-content-hash before issuing XADD.
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:579:  observability, append-only, mirrors Phase 41 envelope-v1 schema).
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:586:| Reconnect with backoff | Custom retry loop | `socket.reconnectStrategy` callback | Built-in exponential + jitter; handles socket timeout differentiation. |
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:624:**What goes wrong:** A timeout error message includes the connection URL
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:714:**How to avoid:** (Option A) Single client + Promise.race timeout on
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:715:every command (50ms default) - if the queue blocks, the timeout fires
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:722:`getHotPacket` consistently returns `reason: 'op_timeout'` under load.
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:723:Mitigation: drop to fallback path on timeout - canonical state ALWAYS
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:910:| Ad-hoc retry loops | `socket.reconnectStrategy` callback | node-redis v4+ | Built-in handles socket-timeout differentiation, exponential + jitter. |
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:935:| A9 | 50ms command timeout is tight enough to never block but loose enough to land most hot-cache reads | Pitfall 4 / Pattern 1 | MEDIUM. If actual Redis latency exceeds 50ms in a deployment, all calls degrade. Mitigation: env-tunable `SGSD_REDIS_TIMEOUT_MS`. |
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:996:     log is small (one row per degraded event), append-only, and useful
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:1020:- **Redis server unreachable:** same effect via `_getClient()` timeout
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:1132:| Connection-pool DoS | Denial of service | 50ms command timeout; degraded sentinel; SQLite fallback always serves |
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:1134:| Stale-hit replay (TTL-expired data still served) | Tampering | TTL on every key; source-hash revalidation backstop |
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-RESEARCH.md:1271:| Connection pool exhaustion | 50ms command timeout + degraded sentinel + SQLite always serves. | LOCK 13 |
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\52-VERIFICATION.md:122:| REDIS-LOCK-04 (TTL + dedup) | Every `client.set` uses `{ EX: ttl }` from TTL_BY_KIND; `client.xAdd` uses `TRIM { strategy:'MAXLEN', strategyModifier:'~', threshold: STREAM_MAXLEN_APPROX(=1000) }` | `redis-adapter.cjs:957, 1157, 1246-1250` | B3, F1 | VERIFIED |
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\21-ATC-REVIEW.md:7:invocation: "shellDispatch via codex-exec.sh --timeout-tier custom:480"
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\21-ATC-REVIEW.md:28:Duration 406.4s via `--timeout-tier custom:480` (two prior timeouts: analysis 180s + custom:300s). xhigh reasoning under load is slow.
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\21-ATC-REVIEW.md:60:| 21-01 per-dispatch | 3-commit + SUMMARY | 252.5s custom:300 (after analysis timeout) | 2C+2W |
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\21-ATC-REVIEW.md:62:| 21-03 per-dispatch | 296-line diff | 180s timeout → skipped | — |
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\21-ATC-REVIEW.md:65:Cumulative Phase 21 Codex wall-clock: ~920s. 2 of 4 runs hit timeout with xhigh reasoning (Codex 5.5 + reasoning_effort=xhigh is genuinely slower than 5.4 + none on equivalent scope — real cost of quality boost).
.planning/milestones/v1.9\phases\52-redis-live-cache-adapter\commit-reviews.jsonl:1:{"ts":"2026-04-28T19:35:59.539Z","plan":"52-01","task":"T1","tier":"FULL","verdict":"fail","critical":1,"warning":4,"one_liner":"T1 skeleton meets 9/11 contract; fs.appendFileSync in _emitProjectionLog breaks T5-deferral invariant; W1 validated_thought missing from FORBIDDEN_KINDS; W4 source field absent from isAvailable; fixing in-loop","provider":"claude-sonnet","commit":"10555db","gate":"per-dispatch-ATC"}
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\21-CONTEXT.md:201:- **VTP errors ≠ empty hits**: VTP API error (MCP server down, timeout, auth fail) → HARD BLOCK (operator intervention). Zero hits → AUTONOMOUS continue with empty-hit artifact. The distinction matters for Q3=A discipline.
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\21-SUMMARY.md:84:| 1 | 21-01 | 4-commit diff | custom:300 (after analysis timeout) | 252.5s | 2C + 2W |
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\21-SUMMARY.md:86:| 3 | 21-03 | 4-commit diff | skipped (timeout) | — | — |
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\21-SUMMARY.md:87:| 4 | 21 phase-level initial | phase summary | custom:480 (after 2 timeouts) | 406.4s | 2C + 3W HALT |
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\21-SUMMARY.md:88:| 5 | 21 phase-level re-review | fix commit | custom:540 (after 300 timeout) | 182.4s | **0C + 1W PASS** |
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\21-SUMMARY.md:92:Codex 5.5 + xhigh reasoning is genuinely slower — 3 of 5 runs hit timeout on initial tier, needed custom: escalation. Real cost of the quality boost.
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\commit-reviews.jsonl:1:{"ts":"2026-04-24T19:33:31.939Z","plan":"21-01","tier":"full","verdict":"critical","critical":2,"warning":2,"pass_rate":"2/6","one_liner":"Blocked: missing agent plus ctx, status, and path mismatches.","provider":"openai-codex","model":"gpt-5.5","reasoning_effort":"xhigh","duration_ms":252460,"timeout_escalated":true,"note":"Rule 13 auto-bypass — per-dispatch-ATC is log-only; phase-level at close will HALT if unresolved. 21-02..04 executors may implicitly address some items."}
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\commit-reviews.jsonl:3:{"ts":"2026-04-24T19:56:14.372Z","plan":"21-03","tier":"full","verdict":"skipped","critical":0,"warning":0,"one_liner":"Per-dispatch ATC skipped — analysis-tier timeout on 296-line diff; phase-level ATC at close will re-catch.","provider":"openai-codex","model":"gpt-5.5","reasoning_effort":"xhigh","timeout":true,"note":"Auto-advance time-budget; phase-level ATC (halt-on-CRIT) will enforce at Phase 21 close"}
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\PHASE-CAPSULE.json:128:      "subject": "atc(21-03): per-dispatch ATC skipped \u2014 analysis-tier timeout, phase-level will re-catch",
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\21-VERIFICATION.md:108:**commit-reviews.jsonl records:** 21-01 CRIT (2 criticals, one-liner: "Blocked: missing agent plus ctx, status, and path mismatches"), 21-02 WARN (4 warnings), 21-03 skipped (timeout).
.planning/milestones/v1.5\phases\21-vtp-enrichment-gates\21-VERIFICATION.md:116:- 21-03 skipped (timeout) — phase-level ATC at close will re-run. Not a verification blocker.

2026-08-11T00:23:32.756835Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 2.2 seconds
Output:
?? .planning/briefs/2026-08-11-cross-pollination-ANALYSIS.md
?? .planning/briefs/2026-08-11-cross-pollination-handover.md
?? .planning/decisions/2026-08-11-cross-pollination-BOARD-MEMO.md
?? .planning/decisions/2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md
?? reports/sgsd/2026-08-10-sgsd-board-diagram.html
?? reports/sgsd/2026-08-10-sgsd-v3-5-complete-guide.html
5ad0440 docs(memory): 6th seam instance — trust-probe global-vs-project ledger routing
.planning/STATE.md:6:milestone_status: "v3.5 SHIPPED-WITH-DEFERRED-1 2026-08-10 — Always-On Orchestration COMPLETE. 7/7 phases closed; substrate published to origin/master (c0aff22->4f2f916) + installed locally under operator authorization; local trust guard proven; T150-07 devcp propagation deferred (live sessions). Milestone SUMMARY written. No next milestone declared — awaiting operator."
.planning/STATE.md:199:  mode: operator-led (Phase 63 closed; awaiting operator instruction or M1-M5 manual-check completion before next dispatch)
.planning/STATE.md:208:  current_phase_name: "v2.2 ALL-PHASES-CLOSED — 5/5 phases done (63 PASS-WITH-DEFERRED-5 + 64 PASS + 65 PASS + 66 PASS + 67 PASS); awaiting operator decision on M1-M5 + sgsd-complete-milestone trigger"

 exited 1 in 2183ms:
?? .planning/briefs/2026-08-11-cross-pollination-ANALYSIS.md
?? .planning/briefs/2026-08-11-cross-pollination-handover.md
?? .planning/decisions/2026-08-11-cross-pollination-BOARD-MEMO.md
?? .planning/decisions/2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md
?? reports/sgsd/2026-08-10-sgsd-board-diagram.html
?? reports/sgsd/2026-08-10-sgsd-v3-5-complete-guide.html
5ad0440 docs(memory): 6th seam instance — trust-probe global-vs-project ledger routing
.planning/STATE.md:6:milestone_status: "v3.5 SHIPPED-WITH-DEFERRED-1 2026-08-10 — Always-On Orchestration COMPLETE. 7/7 phases closed; substrate published to origin/master (c0aff22->4f2f916) + installed locally under operator authorization; local trust guard proven; T150-07 devcp propagation deferred (live sessions). Milestone SUMMARY written. No next milestone declared — awaiting operator."
.planning/STATE.md:199:  mode: operator-led (Phase 63 closed; awaiting operator instruction or M1-M5 manual-check completion before next dispatch)
.planning/STATE.md:208:  current_phase_name: "v2.2 ALL-PHASES-CLOSED — 5/5 phases done (63 PASS-WITH-DEFERRED-5 + 64 PASS + 65 PASS + 66 PASS + 67 PASS); awaiting operator decision on M1-M5 + sgsd-complete-milestone trigger"

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "Get-Content -Raw '.planning\\briefs\\2026-08-11-cross-pollination-ANALYSIS.md'" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "Get-Content -Raw '.planning\\decisions\\2026-08-11-cross-pollination-BOARD-MEMO.md'" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "Get-Content -Raw '.planning\\briefs\\2026-08-11-cross-pollination-handover.md'" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "Get-Content -Raw '.planning\\decisions\\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md'" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
 succeeded in 898ms:
---
brief: cross-pollination-engine (SGSD side)
date: 2026-08-11
source: 2026-08-11-cross-pollination-handover.md (VTP-authored, BOARD-MEMO 3 SUPPORT/1 OPPOSE)
analyst: SGSD orchestrator
status: FOR SGSD BOARD REVIEW
---

# Analysis ƒ?" SGSDƒÅ"VTP Cross-Pollination Handover

## What it asks SGSD to build
A bidirectional bridge to VTP's new communication surfaces, as four skills:
1. sgsd-triage-first (Phase 0, buildable now) ƒ?" wrap the EXISTING enrichment
   gate (Step 6.b.5) so every research/planning/blocker question first calls
   vtp_triage, treats the route as advisory, records accept/modify/reject via
   vtp_triage_feedback + a route-decisions.jsonl row.
2. sgsd-taste-feedback (Phase 0, buildable now) ƒ?" at phase close, log which
   VTP-injected context was actually USED in shipped work (accepted/modified/
   unused + reason), keyed by artefact ID. This ledger is the defensible asset.
3. sgsd-cross-pollinate-plan (GATED on VTP Phase A) ƒ?" cluster-informed planner
   injection with citations.
4. sgsd-problem-match (GATED on VTP Phase B) ƒ?" blocker-brief precedent lookup +
   resolved-blocker back-fill of the problem ledger.

## Strategic fit (strong)
- The bridge is mutually load-bearing: SGSD's dispatch volume IS the organic
  demand evidence VTP's Phase-0 gate requires (20+ inadequate-path queries in
  4 weeks). We already produce dozens of KB questions/day.
- Skills 1-2 extend existing SGSD machinery (enrichment gate, phase close),
  not new parallel gates ƒ?" aligns with the always-on-runtime direction v3.5
  just shipped, and with the anti-slop 'extend, don't duplicate' rule.
- The taste ledger (skill 2) is genuinely the compounding asset: labelled
  preference data VTP cannot buy. Machine-cadence, human-auditable.

## THE load-bearing risk (must resolve before any build)
- vtp_triage and vtp_triage_feedback are declared LIVE, but they DO NOT appear
  in this session's vtp-kb MCP toolset (only the older route/plan/idea tools
  resolve). VTP server is healthy (91 books/90 research/88 meetings) ƒ?" so the
  most likely cause is a STALE MCP CHILD predating vtp-triage-v2, not a missing
  ship. This is the exact harness-vs-production seam that recurred 6x this
  milestone. PRECONDITION: restart the session/MCP child, confirm vtp_triage +
  vtp_triage_feedback resolve and honour their contracts (execution.performed=
  false, zero writes, reason required on reject), BEFORE writing skill code.

## Secondary risks
- Write-path safety: skill 4 back-fills a problem ledger and skill involves
  stage-then-merge; direct writes to idea-developments.json are a named clobber
  hazard. All Phase-0 work is advisory/zero-write, so this is deferred with
  Phase B ƒ?" but the skill contracts must bake in the human gate now.
- Demand-evidence honesty: the 4-week 20-query falsifier only means something
  if 'existing path inadequate' is recorded truthfully, not rubber-stamped.
  sgsd-triage-first must make the override reason a required, closed-vocab field.
- Scope creep: only skills 1-2 are in scope now. 3-4 are gated on VTP Phase A/B
  which are NOT built. Board must hold the line: build 1-2, stub the contracts
  for 3-4, do not pre-build against unbuilt surfaces.

## Recommended SGSD position (for the board to accept/amend/reject)
BUILD Phase 0 (skills 1-2) as one small milestone, GATED on the MCP-surface
precondition above, with: (a) skill 1 as an extension of Step 6.b.5 not a new
gate; (b) closed-vocab override reasons; (c) skill 2's ledger schema v1 now,
v2-ready; (d) skills 3-4 contract-stubbed only. Falsifiers per handover adopted
verbatim (4-week demand test; 90-day check; gold-set human approval stays open).


 succeeded in 886ms:
---
doc: sgsd-handover
milestone: cross-pollination-engine
status: QUEUED (Phase 0 active immediately)
date: 2026-08-11
audience: SGSD orchestrator + skill authors (Codex-executed)
governing_inputs:
  - INTENT.md (binding phase plan)
  - BOARD-MEMO.md (3 SUPPORT / 1 OPPOSE, binding sequencing + falsifiers)
  - qmd-docs/meetings/vtp-briefing.md doc:3c53fd7b19f9 Stage 3 (prior design)
consumes_from_vtp:
  - vtp_triage (LIVE, shipped in vtp-triage-v2)
  - vtp_triage_feedback (LIVE, advisory feedback ledger v1)
  - vtp_route_and_retrieve / vtp_search_substrate (LIVE)
  - vtp_cross_pollinate (Phase A, not yet built)
  - problem ledger problems.json (Phase B, not yet built)
---

# SGSD ѓЕ" VTP Communication Infrastructure ѓ?" Handover

## Why this handover exists

SGSD currently talks to VTP through ONE surface: the pre-planning
enrichment gate (Step 6.b.5, keyword-cascade search). The cross-
pollination milestone gives VTP a triage door, an advisory cluster
tool, a problem ledger, and a taste ledger. This document specifies the
four SGSD skills that consume those surfaces, so SGSD can build the
bridge on its side. The bridge is bidirectional and each half solves
the other's hardest open problem:

- SGSD gets better-routed, cluster-informed, precedent-backed context
  for research, planning, and blocker recovery.
- VTP gets the ORGANIC DEMAND EVIDENCE its Phase 0 gate requires
  (contrarian falsifier: 20+ real cross-idea/problem queries in 4
  weeks). SGSD's dozens of daily dispatch questions are that stream.

## What exists today (build against these, do not wait)

| Surface | Status | Contract |
|---|---|---|
| `vtp_triage` | LIVE | Input: question + optional context. Output: compiled advisory route (archetype, tool plan, BLOCKING_AMBIGUITY first), `execution.performed=false`, zero writes. Classifier-only authority: the caller follows or overrides. |
| `vtp_triage_feedback` | LIVE | Records accept/modify/reject + reason code against a triage_id. Reason REQUIRED for rejected/modified. Ledger confined to `.planning/metrics/triage-advisory/`. |
| VTP enrichment gate | LIVE | Step 6.b.5 in sgsd-orchestrate; 5-tool cascade; enrich-only. |
| Blocker-recovery loop | LIVE | Board + Codex challenge path in sgsd-orchestrate. |

## What is coming (gate skill activation on these)

| Surface | Phase | Gate before SGSD may call it |
|---|---|---|
| `vtp_cross_pollinate` | A | retrieval-quality SHIPPED + benchmark re-frozen. Advisory: ѓ%П8 clustered idea IDs + rationale codes, zero writes, store-untouched digests. |
| `problems.json` ledger | B | Built under cove-claim-integrity. Stable problem IDs, evidence-store embedded, linked to claims/commitments/ideas. External problem = SAME SHAPE as internal. |
| Feedback record v2 | B | Adds `artefact_kind` so ledger rows can label cross-pollination artefacts. NOT a coercion of strict v1 ѓ?" new schema version. |
| Synthesis write-back | C | CoVe SHIPPED + demand proven + named human gate on every write. |

## The four skills to design

### 1. sgsd-triage-first ѓ?" BUILDABLE NOW (Phase 0 instrument)

- **Trigger:** before every research, planning, or blocker dispatch
  that formulates a question against the KB.
- **Calls:** `vtp_triage(question, context)` ѓЕ' treat compiled route as
  ADVISORY. Follow it, or override it.
- **Records:** every decision via `vtp_triage_feedback` (accepted /
  modified / rejected + reason code) and a
  `route-decisions.jsonl` row with `boundary='vtp_triage_advisory'`.
- **Why:** SGSD's query volume IS the organic usage stream Phase 0
  needs. The loop gets better retrieval; VTP gets demand evidence.
- **Anti-slop constraint:** this wraps the EXISTING enrichment gate's
  question formulation ѓ?" extend Step 6.b.5, do not add a parallel gate.

### 2. sgsd-taste-feedback ѓ?" BUILDABLE NOW (Phase 0 instrument)

- **Trigger:** phase close (hook into sgsd-complete-phase / Step 6.6).
- **Does:** logs which VTP-injected context (enrichment hits, triage
  routes, later clusters/matches) was actually USED in shipped work:
  accepted / modified / unused + reason, keyed by proposal/artefact ID.
- **Writes:** v1 feedback ledger now; migrate to v2 records (with
  `artefact_kind`) when Phase B ships them.
- **Why:** the taste ledger is the defensible asset (board: "the
  matcher is commodity; the labelled preference ledger is not").
  Machine-cadence labels, human-auditable.

### 3. sgsd-problem-match ѓ?" GATED ON PHASE B

- **Trigger:** when a blocker brief is written
  (`{phaseDir}/{N}-BLOCKER-RECOVERY-BRIEF.md`), BEFORE any board
  convenes.
- **Calls:** problem-ledger lookup (lexical identity + semantic
  candidates): has this failure shape been solved before, in-repo or in
  an ingested precedent? Attach matches to the brief.
- **Writes back:** every RESOLVED blocker back-fills the ledger as a
  problem + solution pair (stage-then-merge, never direct writes).
- **Why:** boards stop re-deriving known solutions; SGSD becomes both
  consumer and contributor of the compounding precedent library.

### 4. sgsd-cross-pollinate-plan ѓ?" GATED ON PHASE A

- **Trigger:** phase-planning time (before gsd-planner dispatch).
- **Calls:** `vtp_cross_pollinate(phase_goal)` ѓЕ' which enriched ideas,
  prior milestone lessons, and book principles cluster around this
  work? Inject the cluster WITH CITATIONS into the planner prompt.
- **Why:** upgrades the enrichment gate from keyword search to cluster
  reasoning ѓ?" plans start from the KB's combined position, not one
  lucky hit.
- **Constraint:** advisory only; the planner may discard the cluster.
  Every injection gets a taste-feedback row at phase close (skill 2).

## Build order for SGSD

1. **Now:** sgsd-triage-first + sgsd-taste-feedback (both surfaces are
   live; zero VTP-side work needed). These two ARE Phase 0.
2. **After retrieval-quality ships + Phase A lands:**
   sgsd-cross-pollinate-plan.
3. **After cove-claim-integrity + Phase B lands:** sgsd-problem-match.

## Hard constraints (board-recorded, do not relitigate)

- All new tools are ADVISORY: `execution.performed=false`, zero writes,
  caller decides. Never bypass a named human gate on idea-development
  writes (stage-then-merge; direct writes to idea-developments.json are
  a known clobber hazard).
- Synthesis artefacts carry generation-depth ѓ%П1 (gate-enforced) and
  land UNCONSOLIDATED; promotion only on corroboration.
- Similarity is not transferability: no skill may treat cosine
  proximity as an applicability test; analogy needs the METHOD sources
  (TRIZ, Gentner structure-mapping) ingested in Phase B.
- Precision over volume: five right firings a week beat two hundred
  noisy ones. Emission stays gated by the taste ledger.
- Dead-ends: standalone engine module; board-debate as validation;
  full gsd-graph unpark; fine-tuning on the ledger; autonomous sweeps
  without a precision gate; accretion without corrective feedback.

## Kill-switches and falsifiers SGSD must respect

- Contrarian's demand test: if 4 weeks of sgsd-triage-first usage does
  NOT produce 20+ queries where existing paths were recorded
  inadequate, Phase C does not proceed on schedule.
- Moonshot's 90-day check (after v2 records exist): <20 ledger
  decisions, acceptance ~100% or <10%, or problems mostly singletons ѓЕ'
  halt and reassess the whole loop.
- Operator item still open: gold-set human approval
  (`src/contracts/fixtures/triage-gold-set.v1.json`).


 succeeded in 923ms:
---
decision: cross-pollination-engine Phase-0 (SGSD side)
date: 2026-08-11
board: sgsd-ceo synthesis of Architect + Pragmatist + Contrarian
vote: 2 SUPPORT-WITH-CONDITIONS + 1 OPPOSE-UNLESS (all conf 4)
verdict: CONDITIONAL GO ѓ?" the "unless" and the "conditions" are the same gate
status: PENDING CODEX CHALLENGE
---

# Decision Memo ѓ?" SGSDѓЕ"VTP Cross-Pollination Phase 0

## Verdict
CONDITIONAL GO. The 2-1 split is not a real disagreement: the Contrarian's
OPPOSE-UNLESS is satisfied by the exact precondition the other two seats made
binding. Frame the precondition as a FORK and all three positions merge.

## The unanimous binding precondition (the fork)
No skill code ѓ?" none ѓ?" until a LIVE probe in a fresh session/MCP child confirms
`vtp_triage` and `vtp_triage_feedback` resolve AND honour contract:
execution.performed=false, zero writes, reason-required-on-reject. This tool
absence is the harness-vs-production seam that recurred 6x in v3.5; it is a hard
gate, not a warning. (Probe requires a session restart ѓ?" operator-owned; the
current MCP child predates vtp-triage-v2 per VTP health = healthy but tool absent.)

## The fork
- **Probe GREEN** (tools resolve + honour contract) ѓЕ' BUILD Phase 0 as one
  Codex-executable phase: skill 1 sgsd-triage-first (extend Step 6.b.5, reuse
  its D-08 degraded/timeout path and cached vtp_available; never inline-blocking),
  skill 2 sgsd-taste-feedback (phase-close hook). Architect + Pragmatist path.
- **Probe RED** (tools genuinely unshipped, not stale-child) ѓЕ' fall back to the
  Contrarian's deletion: logging-only extension of Step 6.b.5 ѓ?" closed-vocab
  override-reason field + route-decisions.jsonl row, NO vtp_triage call ѓ?" run
  4 weeks, revisit when VTP ships the tools. No skill built on a phantom.

## Binding conditions on the GREEN branch
1. Ledger schema ships with explicit `schema_version` + nullable `artefact_kind`
   ѓЕ' Phase-B v2 records land additively, zero rewrite. (Architect)
2. All triage calls inherit Step 6.b.5's bounded-timeout degraded path; all
   feedback writes are fire-and-forget append-only to
   .planning/metrics/triage-advisory/ ѓ?" triage absence/latency NEVER blocks a
   dispatch or phase close. (Architect)
3. Override/reject reason is a REQUIRED closed-vocab field, or the 4-week/
   20-query demand falsifier self-corrupts into rubber-stamping. (all 3 seats)
4. skill 1 is a question-formulation wrapper INSIDE the existing cascade ѓ?" no
   second gate object, no second health check. (Architect + anti-slop, handover:69)
5. Skills 3-4 CONTRACT-STUB ONLY ѓ?" zero code against unbuilt VTP Phase A/B.
   (all 3 seats)

## Adopted falsifiers (verbatim from handover)
- 4-week demand test: <20 truthfully-recorded inadequate-path queries ѓЕ' Phase C
  does not proceed on schedule.
- 90-day check (after v2 records): <20 decisions, acceptance ~100% or <10%, or
  problems mostly singletons ѓЕ' halt and reassess.
- gold-set human approval (triage-gold-set.v1.json) stays OPEN; not a Phase-0
  build blocker but not to be closed around.

## Zero-VTP-dependency work sanctioned to start NOW (Pragmatist's safe parallel)
The route-decisions.jsonl + taste-ledger schema design (schema_version,
artefact_kind reserved, closed-vocab reason enum) has NO VTP dependency and may
be drafted while the surface is being verified. This is the only sanctioned
pre-probe build.

## Contrarian's standing caution (recorded, honoured)
SGSD is partly manufacturing VTP's demand evidence. Mitigation: the closed-vocab
required reason (condition 3) makes the demand signal falsifiable, not fabricated;
and the RED fork ensures no skill is built until the surface ѓ?" and via the 4-week
test, the demand ѓ?" is earned.


 succeeded in 902ms:
# CODEX CHALLENGE ѓ?" SGSD Board Decision Memo (cross-pollination Phase 0)

You are a SEPARATE Codex reviewer challenging the SGSD board's decision before it executes (per the blocker/decision recovery contract: board memo must survive an independent Codex challenge). Be adversarial. Your job is to find the flaw the board missed, not to ratify.

Challenge specifically:
1. Is the CONDITIONAL-GO fork sound, or does it smuggle a build past a real OPPOSE? The Contrarian voted OPPOSE-UNLESS ѓ?" is the 'unless' genuinely satisfied by a tool-resolves probe, or does the deeper objection (SGSD manufacturing VTP's demand evidence at SGSD cost) survive even a GREEN probe?
2. Is 'extend Step 6.b.5' actually safe, or does bolting an advisory vtp_triage call into the pre-planning enrichment cascade create a hidden critical-path or a double-enrichment (triage route + existing 5-tool cascade both firing)?
3. Is the versioned-ledger + fire-and-forget condition sufficient, or is there a data-integrity or replay hazard in append-only advisory ledgers the board glossed?
4. Is the RED-fork fallback (logging-only) actually distinct from the GREEN branch's skill 1, or is the board proposing to build essentially the same thing either way ѓ?" meaning the precondition doesn't actually gate anything?
5. Anything the board should have killed outright.

Report contract (exact lines):
CHALLENGE_VERDICT: memo-sound | memo-needs-revision | memo-unsafe
SURVIVING_OBJECTIONS: none | <list the objections that survive the board's reasoning>
BINDING_ADDITIONS: none | <conditions the board must add before executing>
ONE_LINER: <summary>

## Board Decision Memo
---
decision: cross-pollination-engine Phase-0 (SGSD side)
date: 2026-08-11
board: sgsd-ceo synthesis of Architect + Pragmatist + Contrarian
vote: 2 SUPPORT-WITH-CONDITIONS + 1 OPPOSE-UNLESS (all conf 4)
verdict: CONDITIONAL GO ѓ?" the "unless" and the "conditions" are the same gate
status: PENDING CODEX CHALLENGE
---

# Decision Memo ѓ?" SGSDѓЕ"VTP Cross-Pollination Phase 0

## Verdict
CONDITIONAL GO. The 2-1 split is not a real disagreement: the Contrarian's
OPPOSE-UNLESS is satisfied by the exact precondition the other two seats made
binding. Frame the precondition as a FORK and all three positions merge.

## The unanimous binding precondition (the fork)
No skill code ѓ?" none ѓ?" until a LIVE probe in a fresh session/MCP child confirms
`vtp_triage` and `vtp_triage_feedback` resolve AND honour contract:
execution.performed=false, zero writes, reason-required-on-reject. This tool
absence is the harness-vs-production seam that recurred 6x in v3.5; it is a hard
gate, not a warning. (Probe requires a session restart ѓ?" operator-owned; the
current MCP child predates vtp-triage-v2 per VTP health = healthy but tool absent.)

## The fork
- **Probe GREEN** (tools resolve + honour contract) ѓЕ' BUILD Phase 0 as one
  Codex-executable phase: skill 1 sgsd-triage-first (extend Step 6.b.5, reuse
  its D-08 degraded/timeout path and cached vtp_available; never inline-blocking),
  skill 2 sgsd-taste-feedback (phase-close hook). Architect + Pragmatist path.
- **Probe RED** (tools genuinely unshipped, not stale-child) ѓЕ' fall back to the
  Contrarian's deletion: logging-only extension of Step 6.b.5 ѓ?" closed-vocab
  override-reason field + route-decisions.jsonl row, NO vtp_triage call ѓ?" run
  4 weeks, revisit when VTP ships the tools. No skill built on a phantom.

## Binding conditions on the GREEN branch
1. Ledger schema ships with explicit `schema_version` + nullable `artefact_kind`
   ѓЕ' Phase-B v2 records land additively, zero rewrite. (Architect)
2. All triage calls inherit Step 6.b.5's bounded-timeout degraded path; all
   feedback writes are fire-and-forget append-only to
   .planning/metrics/triage-advisory/ ѓ?" triage absence/latency NEVER blocks a
   dispatch or phase close. (Architect)
3. Override/reject reason is a REQUIRED closed-vocab field, or the 4-week/
   20-query demand falsifier self-corrupts into rubber-stamping. (all 3 seats)
4. skill 1 is a question-formulation wrapper INSIDE the existing cascade ѓ?" no
   second gate object, no second health check. (Architect + anti-slop, handover:69)
5. Skills 3-4 CONTRACT-STUB ONLY ѓ?" zero code against unbuilt VTP Phase A/B.
   (all 3 seats)

## Adopted falsifiers (verbatim from handover)
- 4-week demand test: <20 truthfully-recorded inadequate-path queries ѓЕ' Phase C
  does not proceed on schedule.
- 90-day check (after v2 records): <20 decisions, acceptance ~100% or <10%, or
  problems mostly singletons ѓЕ' halt and reassess.
- gold-set human approval (triage-gold-set.v1.json) stays OPEN; not a Phase-0
  build blocker but not to be closed around.

## Zero-VTP-dependency work sanctioned to start NOW (Pragmatist's safe parallel)
The route-decisions.jsonl + taste-ledger schema design (schema_version,
artefact_kind reserved, closed-vocab reason enum) has NO VTP dependency and may
be drafted while the surface is being verified. This is the only sanctioned
pre-probe build.

## Contrarian's standing caution (recorded, honoured)
SGSD is partly manufacturing VTP's demand evidence. Mitigation: the closed-vocab
required reason (condition 3) makes the demand signal falsifiable, not fabricated;
and the RED fork ensures no skill is built until the surface ѓ?" and via the 4-week
test, the demand ѓ?" is earned.

## Source handover
---
doc: sgsd-handover
milestone: cross-pollination-engine
status: QUEUED (Phase 0 active immediately)
date: 2026-08-11
audience: SGSD orchestrator + skill authors (Codex-executed)
governing_inputs:
  - INTENT.md (binding phase plan)
  - BOARD-MEMO.md (3 SUPPORT / 1 OPPOSE, binding sequencing + falsifiers)
  - qmd-docs/meetings/vtp-briefing.md doc:3c53fd7b19f9 Stage 3 (prior design)
consumes_from_vtp:
  - vtp_triage (LIVE, shipped in vtp-triage-v2)
  - vtp_triage_feedback (LIVE, advisory feedback ledger v1)
  - vtp_route_and_retrieve / vtp_search_substrate (LIVE)
  - vtp_cross_pollinate (Phase A, not yet built)
  - problem ledger problems.json (Phase B, not yet built)
---

# SGSD ѓЕ" VTP Communication Infrastructure ѓ?" Handover

## Why this handover exists

SGSD currently talks to VTP through ONE surface: the pre-planning
enrichment gate (Step 6.b.5, keyword-cascade search). The cross-
pollination milestone gives VTP a triage door, an advisory cluster
tool, a problem ledger, and a taste ledger. This document specifies the
four SGSD skills that consume those surfaces, so SGSD can build the
bridge on its side. The bridge is bidirectional and each half solves
the other's hardest open problem:

- SGSD gets better-routed, cluster-informed, precedent-backed context
  for research, planning, and blocker recovery.
- VTP gets the ORGANIC DEMAND EVIDENCE its Phase 0 gate requires
  (contrarian falsifier: 20+ real cross-idea/problem queries in 4
  weeks). SGSD's dozens of daily dispatch questions are that stream.

## What exists today (build against these, do not wait)

| Surface | Status | Contract |
|---|---|---|
| `vtp_triage` | LIVE | Input: question + optional context. Output: compiled advisory route (archetype, tool plan, BLOCKING_AMBIGUITY first), `execution.performed=false`, zero writes. Classifier-only authority: the caller follows or overrides. |
| `vtp_triage_feedback` | LIVE | Records accept/modify/reject + reason code against a triage_id. Reason REQUIRED for rejected/modified. Ledger confined to `.planning/metrics/triage-advisory/`. |
| VTP enrichment gate | LIVE | Step 6.b.5 in sgsd-orchestrate; 5-tool cascade; enrich-only. |
| Blocker-recovery loop | LIVE | Board + Codex challenge path in sgsd-orchestrate. |

## What is coming (gate skill activation on these)

| Surface | Phase | Gate before SGSD may call it |
|---|---|---|
| `vtp_cross_pollinate` | A | retrieval-quality SHIPPED + benchmark re-frozen. Advisory: ѓ%П8 clustered idea IDs + rationale codes, zero writes, store-untouched digests. |
| `problems.json` ledger | B | Built under cove-claim-integrity. Stable problem IDs, evidence-store embedded, linked to claims/commitments/ideas. External problem = SAME SHAPE as internal. |
| Feedback record v2 | B | Adds `artefact_kind` so ledger rows can label cross-pollination artefacts. NOT a coercion of strict v1 ѓ?" new schema version. |
| Synthesis write-back | C | CoVe SHIPPED + demand proven + named human gate on every write. |

## The four skills to design

### 1. sgsd-triage-first ѓ?" BUILDABLE NOW (Phase 0 instrument)

- **Trigger:** before every research, planning, or blocker dispatch
  that formulates a question against the KB.
- **Calls:** `vtp_triage(question, context)` ѓЕ' treat compiled route as
  ADVISORY. Follow it, or override it.
- **Records:** every decision via `vtp_triage_feedback` (accepted /
  modified / rejected + reason code) and a
  `route-decisions.jsonl` row with `boundary='vtp_triage_advisory'`.
- **Why:** SGSD's query volume IS the organic usage stream Phase 0
  needs. The loop gets better retrieval; VTP gets demand evidence.
- **Anti-slop constraint:** this wraps the EXISTING enrichment gate's
  question formulation ѓ?" extend Step 6.b.5, do not add a parallel gate.

### 2. sgsd-taste-feedback ѓ?" BUILDABLE NOW (Phase 0 instrument)

- **Trigger:** phase close (hook into sgsd-complete-phase / Step 6.6).
- **Does:** logs which VTP-injected context (enrichment hits, triage
  routes, later clusters/matches) was actually USED in shipped work:
  accepted / modified / unused + reason, keyed by proposal/artefact ID.
- **Writes:** v1 feedback ledger now; migrate to v2 records (with
  `artefact_kind`) when Phase B ships them.
- **Why:** the taste ledger is the defensible asset (board: "the
  matcher is commodity; the labelled preference ledger is not").
  Machine-cadence labels, human-auditable.

### 3. sgsd-problem-match ѓ?" GATED ON PHASE B

- **Trigger:** when a blocker brief is written
  (`{phaseDir}/{N}-BLOCKER-RECOVERY-BRIEF.md`), BEFORE any board
  convenes.
- **Calls:** problem-ledger lookup (lexical identity + semantic
  candidates): has this failure shape been solved before, in-repo or in
  an ingested precedent? Attach matches to the brief.
- **Writes back:** every RESOLVED blocker back-fills the ledger as a
  problem + solution pair (stage-then-merge, never direct writes).
- **Why:** boards stop re-deriving known solutions; SGSD becomes both
  consumer and contributor of the compounding precedent library.

### 4. sgsd-cross-pollinate-plan ѓ?" GATED ON PHASE A

- **Trigger:** phase-planning time (before gsd-planner dispatch).
- **Calls:** `vtp_cross_pollinate(phase_goal)` ѓЕ' which enriched ideas,
  prior milestone lessons, and book principles cluster around this
  work? Inject the cluster WITH CITATIONS into the planner prompt.
- **Why:** upgrades the enrichment gate from keyword search to cluster
  reasoning ѓ?" plans start from the KB's combined position, not one
  lucky hit.
- **Constraint:** advisory only; the planner may discard the cluster.
  Every injection gets a taste-feedback row at phase close (skill 2).

## Build order for SGSD

1. **Now:** sgsd-triage-first + sgsd-taste-feedback (both surfaces are
   live; zero VTP-side work needed). These two ARE Phase 0.
2. **After retrieval-quality ships + Phase A lands:**
   sgsd-cross-pollinate-plan.
3. **After cove-claim-integrity + Phase B lands:** sgsd-problem-match.

## Hard constraints (board-recorded, do not relitigate)

- All new tools are ADVISORY: `execution.performed=false`, zero writes,
  caller decides. Never bypass a named human gate on idea-development
  writes (stage-then-merge; direct writes to idea-developments.json are
  a known clobber hazard).
- Synthesis artefacts carry generation-depth ѓ%П1 (gate-enforced) and
  land UNCONSOLIDATED; promotion only on corroboration.
- Similarity is not transferability: no skill may treat cosine
  proximity as an applicability test; analogy needs the METHOD sources
  (TRIZ, Gentner structure-mapping) ingested in Phase B.
- Precision over volume: five right firings a week beat two hundred
  noisy ones. Emission stays gated by the taste ledger.
- Dead-ends: standalone engine module; board-debate as validation;
  full gsd-graph unpark; fine-tuning on the ledger; autonomous sweeps
  without a precision gate; accretion without corrective feedback.

## Kill-switches and falsifiers SGSD must respect

- Contrarian's demand test: if 4 weeks of sgsd-triage-first usage does
  NOT produce 20+ queries where existing paths were recorded
  inadequate, Phase C does not proceed on schedule.
- Moonshot's 90-day check (after v2 records exist): <20 ledger
  decisions, acceptance ~100% or <10%, or problems mostly singletons ѓЕ'
  halt and reassess the whole loop.
- Operator item still open: gold-set human approval
  (`src/contracts/fixtures/triage-gold-set.v1.json`).


exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "Get-Content -Raw '.planning\\config.json'" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command 'rg -n -S "idempot|dedup|replay|correlation|run_id|append-only|atomic|concurr|dual|partial" .planning/milestones/v1.7/phases/32-route-decision-ledger .planning/milestones/v1.9/phases/48-selective-vtp-bridge' in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "rg -n -S \"timeout|Abort|Promise\\.race|idempot|dedup|replay|correlation|decision_id|triage_id|fire-and-forget|fire and forget|legacy-disabled\" super-gsd/scripts/lib/vtp-enrichment-gate.cjs super-gsd/scripts/lib/vtp-context-composer.cjs super-gsd/skills/sgsd-orchestrate/SKILL.md super-gsd/scripts/lib/route-ledger.cjs super-gsd/agents/sgsd-vtp-enrichment.md" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command 'rg -n -S "vtp_triage_advisory|schema_version|artefact_kind|inadequate|accepted|modified|rejected|unused|taste" .planning/briefs/2026-08-11-cross-pollination-* .planning/decisions/2026-08-11-cross-pollination-* 2>$null' in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
 succeeded in 1065ms:
{
  "atc": {
    "classify_model": "codex",
    "complexity_floor_files": 3,
    "complexity_floor_lines": 100,
    "enabled": true,
    "full_threshold_files": 4,
    "lite_threshold_files": 3,
    "lite_threshold_lines": 50,
    "skip_threshold_lines": 10,
    "verifier_adversarial_rate": 0.2
  },
  "browser_verify": {
    "approved_fallbacks": [
      "puppeteer"
    ],
    "base_url": "http://localhost:3000",
    "block_on_failure_auto_mode": false,
    "deferral_ledger_auto_reopen_after_phases": 3,
    "enabled": true,
    "fail_on_console_errors": true,
    "fail_on_network_errors": true,
    "frontend_globs": [
      "**/*.html",
      "**/*.tsx",
      "**/*.jsx",
      "**/*.vue",
      "**/*.svelte",
      "**/*.astro",
      "**/*.css",
      "**/*.scss",
      "src/**/*.ts",
      "frontend/**",
      "web/**",
      "ui/**",
      "pages/**",
      "components/**"
    ],
    "load_timeout_ms": 15000,
    "min_rows_per_route": 1,
    "required_endpoints": [],
    "routes": [
      "/"
    ]
  },
  "deliberation": {
    "auto_gate": true,
    "board": [
      "architect",
      "pragmatist",
      "contrarian",
      "moonshot",
      "researcher"
    ],
    "enabled": true,
    "gate_model": "codex",
    "max_rounds": 2,
    "trigger_phases_affected": 3
  },
  "git": {
    "atomic_commits": true,
    "branching_strategy": "none",
    "commit_docs": true
  },
  "handoff": {
    "enabled": true,
    "log_path": ".planning/metrics/handoff-log.jsonl",
    "max_chain_depth": 5,
    "min_cooldown_seconds": 30,
    "operator_abort_file": ".planning/STOP-HANDOFF",
    "recover_unexpected_auto_stop": true,
    "spawn_args": [
      "--print",
      "--dangerously-skip-permissions",
      "/sgsd-orchestrate go"
    ],
    "spawn_command": "claude",
    "unexpected_stop_max_pulse_age_seconds": 900
  },
  "hooks": {
    "context_warnings": true
  },
  "knowledge": {
    "fallback_corpus": "sgsd-bundled-research",
    "memory_root": ".planning/memory",
    "notes": "Private knowledge stays optional. SGSD memory is project-local by default. Public sources are discovery targets, not blindly ingested content.",
    "private_root": null,
    "public_sources": [
      {
        "description": "Local SGSD docs, briefs, decisions, milestones, and seeded project memory.",
        "enabled": true,
        "id": "sgsd-bundled-research",
        "mode": "local",
        "roots": [
          "README.md",
          "super-gsd/docs",
          ".planning/briefs",
          ".planning/decisions",
          ".planning/memory"
        ]
      },
      {
        "description": "Open computer-science research discovery; use metadata/abstracts first, PDFs only when licensing and relevance are clear.",
        "enabled": false,
        "id": "arxiv-cs",
        "mode": "online",
        "url": "https://arxiv.org/"
      },
      {
        "description": "Google SRE books for reliability, incident response, toil, SLOs, and operational design.",
        "enabled": false,
        "id": "google-sre",
        "mode": "online",
        "url": "https://sre.google/books/"
      },
      {
        "description": "NASA systems engineering handbook for lifecycle, verification, validation, and gate discipline.",
        "enabled": false,
        "id": "nasa-systems-engineering",
        "mode": "online",
        "url": "https://www.nasa.gov/reference/systems-engineering-handbook/"
      },
      {
        "description": "Microsoft REST API guidelines for public API design and governance.",
        "enabled": false,
        "id": "microsoft-api-guidelines",
        "mode": "online",
        "url": "https://github.com/microsoft/api-guidelines"
      },
      {
        "description": "Architecture of Open Source Applications case studies for real system structure.",
        "enabled": false,
        "id": "aosa",
        "mode": "online",
        "url": "https://aosabook.org/en/"
      }
    ],
    "version": 1
  },
  "model_profile": "quality",
  "model_routing": {
    "classifier": "codex",
    "code_reviewer": "codex",
    "context_selector": "codex",
    "executor": "codex",
    "orchestrator": "opus",
    "plan_checker": "codex",
    "planner": "codex",
    "researcher": "codex",
    "verifier": "codex"
  },
  "muda": {
    "inventory_thresholds": {
      "_doc": "MUDAC-02: linear-scale inventory probe thresholds. Final threshold = base * count of dirs in .planning/milestones/. Defaults match codebase fallbacks; absent config block produces identical behaviour.",
      "fail_per_milestone": 5,
      "warn_per_milestone": 2
    }
  },
  "overwatcher": {
    "auto_scan": true,
    "serve": false
  },
  "parallelization": {
    "enabled": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2,
    "plan_level": true,
    "skip_checkpoints": true,
    "task_level": false
  },
  "project": {
    "cockpit_panel_kinds": [
      "token",
      "source_mix",
      "active_agent",
      "codex",
      "intent",
      "governance",
      "budget"
    ],
    "configured_by": "sgsd-new-project-wizard",
    "configured_schema": "v1",
    "default_boot_mode": "auto",
    "operator_preferences": {
      "confirm_destructive": true,
      "verbose_logging": false
    },
    "schema_version": 1
  },
  "review_providers": {
    "codex_cli_path": "auto-detect",
    "codex_enabled": true,
    "executor_provider": "codex",
    "codex_executor_model": "gpt-5.6-sol",
    "codex_executor_reasoning_effort": "xhigh",
    "codex_model": "gpt-5.6-sol",
    "codex_qualitative_waste_enabled": true,
    "codex_reasoning_effort": "xhigh",
    "codex_timeout_seconds": 180,
    "codex_timeout_tiers": {
      "analysis": 180,
      "default": 60,
      "review": 120
    },
    "default_provider": "codex-cli-reviewer",
    "fallback_max_retries": 0,
    "fallback_on_error": false,
    "kill_claude_tokens_saved": 50000,
    "kill_critical_count_delta": 5
  },
  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  },
  "token_efficiency": {
    "checkpoint_threshold_percent": 100000,
    "context_injection": "sgsd_recall",
    "context_warning_percent": 70,
    "log_usage": true,
    "max_prompt_tokens": 1500,
    "max_report_words": 300,
    "state_read": "frontmatter_only"
  },
  "vtp_enrichment": {
    "audit_tier_batching": {
      "critical": "per-finding",
      "pass": "skip",
      "warn": "batched"
    },
    "challenger_mode": false,
    "empty_hit_policy": "continue",
    "enabled": true,
    "granularity": "tier-based",
    "max_queries_per_gate": 5,
    "query_seed_max_tokens": 800
  },
  "workflow": {
    "agent_report_max_words": 300,
    "auto_advance": true,
    "discuss_mode": "discuss",
    "granularity": "standard",
    "mode": "yolo",
    "nyquist_validation": true,
    "plan_check": true,
    "plan_fix_retry_cap": 3,
    "plan_format": "compressed_xml",
    "research": true,
    "research_before_questions": false,
    "schema_v2_hash": "5867692da13edf8939bc4ab898768e9c5e9938716f4754d4583eaa2f7d0d5631",
    "security_asvs_level": 1,
    "security_block_on": "high",
    "security_enforcement": true,
    "skip_discuss": false,
    "triage_vtp_enrichment": true,
    "verifier": true,
    "planner_model": "codex",
    "planner_reasoning_effort": "xhigh",
    "plan_final_codex_review": true,
    "plan_final_muda_review": true,
    "auto_continue_until_roadmap_complete": true,
    "planning_pipeline_enforced": true
  }
}


 succeeded in 1076ms:
super-gsd/scripts/lib/vtp-context-composer.cjs:332:    // Narrow-catch: swallow VTP/MCP/timeout shape errors; rethrow unknown.
super-gsd/scripts/lib/vtp-context-composer.cjs:333:    if (!/^(vtp_|mcp_|timeout)/.test(msg)) throw err;
super-gsd/scripts/lib/vtp-context-composer.cjs:334:    const status = /^timeout/.test(msg) || /timeout/.test(msg)
super-gsd/scripts/lib/vtp-context-composer.cjs:335:      ? 'timeout'
super-gsd/scripts/lib/vtp-context-composer.cjs:524:      // Test 7: callVtp failure path (vtp_timeout) returns {ok:false} + logs row
super-gsd/scripts/lib/vtp-context-composer.cjs:532:          mcpInvoke: async () => { throw new Error('vtp_timeout: exceeded budget'); },
super-gsd/scripts/lib/vtp-context-composer.cjs:535:        if (passed && !/^vtp_timeout/.test(r7.reason)) fail(`Test7: reason should start vtp_timeout, got '${r7.reason}'`);
super-gsd/scripts/lib/vtp-context-composer.cjs:542:          if (last.failure_reason !== 'vtp_timeout: exceeded budget') {
super-gsd/agents/sgsd-vtp-enrichment.md:6:status: legacy-disabled
super-gsd/scripts/lib/route-ledger.cjs:22://     status:           ok|warn|fail|skipped|timeout|blocked,
super-gsd/scripts/lib/route-ledger.cjs:90:  'ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked',
super-gsd/scripts/lib/route-ledger.cjs:259:    } else if (dr.exit === 5 || dr.timeout_hit === true) {
super-gsd/scripts/lib/route-ledger.cjs:260:      status = 'timeout';
super-gsd/scripts/lib/route-ledger.cjs:261:      reasonCodes.push('codex_timeout');
super-gsd/scripts/lib/route-ledger.cjs:287:      timeout_hit: !!dr.timeout_hit,
super-gsd/scripts/lib/route-ledger.cjs:336:      STATUSES.includes('timeout') && STATUSES.includes('blocked'));
super-gsd/skills/sgsd-orchestrate/SKILL.md:746:        `--step phase-research --timeout-tier analysis --phase {N}
super-gsd/skills/sgsd-orchestrate/SKILL.md:837:          `--step plan-final-review --timeout-tier analysis --phase {N}
super-gsd/skills/sgsd-orchestrate/SKILL.md:1018:          route-decisions.jsonl (boundary='vtp_bridge', status='fail'|'timeout'). The
super-gsd/skills/sgsd-orchestrate/SKILL.md:1046:          (vtp_unavailable, mcp_timeout, bad_provenance, compactness) for the
super-gsd/skills/sgsd-orchestrate/SKILL.md:1384:              timeout: effective.timeout_seconds || config.review_providers.codex_timeout_seconds,
super-gsd/skills/sgsd-orchestrate/SKILL.md:1388:              timeoutTier: 'analysis',  // D-05 #3: phase-level-ATC -> analysis tier (90s, not review 120s)
super-gsd/skills/sgsd-orchestrate/SKILL.md:1389:              retryOnTimeoutEscalate: true,  // D-05 #5: auto-escalate once to analysis on timeout
super-gsd/skills/sgsd-orchestrate/SKILL.md:1395:              const providerFailureReason = (dispatchResult.timeout_hit || dispatchResult.exit === 5)
super-gsd/skills/sgsd-orchestrate/SKILL.md:1396:                ? 'codex_timeout'
super-gsd/skills/sgsd-orchestrate/SKILL.md:1398:              // Do not write "Codex unavailable" for timeout. Auth/availability and
super-gsd/skills/sgsd-orchestrate/SKILL.md:1586:              load_timeout_ms from config
super-gsd/skills/sgsd-orchestrate/SKILL.md:1811:              The skill is idempotent. If the milestone is already archived, it returns PASS.
super-gsd/skills/sgsd-orchestrate/SKILL.md:2211:            timeout: effective.timeout_seconds || config.review_providers.codex_timeout_seconds,
super-gsd/skills/sgsd-orchestrate/SKILL.md:2215:            timeoutTier: 'analysis',  // D-05 #3: phase-level-ATC -> analysis tier (90s, not review 120s)
super-gsd/skills/sgsd-orchestrate/SKILL.md:2221:            const providerFailureReason = (dispatchResult.timeout_hit || dispatchResult.exit === 5)
super-gsd/skills/sgsd-orchestrate/SKILL.md:2222:              ? 'codex_timeout'
super-gsd/skills/sgsd-orchestrate/SKILL.md:2224:            // Do not write "Codex unavailable" for timeout. Auth/availability and
super-gsd/skills/sgsd-orchestrate/SKILL.md:2261:              dispatchResult,                                             // exit, timeout_hit (in scope)
super-gsd/skills/sgsd-orchestrate/SKILL.md:2439:                  timeout: challengerProvider.timeout_seconds || config.review_providers.codex_timeout_seconds,
super-gsd/skills/sgsd-orchestrate/SKILL.md:2443:                  timeoutTier: 'review'  // --timeout-tier review (D-03: adversarial → review tier = 120s)
super-gsd/skills/sgsd-orchestrate/SKILL.md:2453:                  const providerFailureReason = (dispatchResult.timeout_hit || dispatchResult.exit === 5)
super-gsd/skills/sgsd-orchestrate/SKILL.md:2454:                    ? 'codex_timeout'
super-gsd/skills/sgsd-orchestrate/SKILL.md:2582:do NOT crash the run (event-emit is fire-and-forget; legacy ledgers remain
super-gsd/scripts/lib/vtp-enrichment-gate.cjs:829:          error_message: 'MCP connection timeout',
super-gsd/scripts/lib/vtp-enrichment-gate.cjs:837:          if (passed && !content17.includes('MCP connection timeout')) fail('Test17: error_message missing');

 succeeded in 1100ms:
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:302:**Audit verdict:** ALL in-scope items COVERED across 3 atomic commits (T1, T2, T3). All out-of-scope items DEFERRED to correct downstream owners per RESEARCH Section 13. Zero unplanned items. No phase split required.
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:573:    - Atomic commit: `feat(48-01): vtp-bridge/classify.cjs + VTP_TOOL_MAP + 10-assertion self-test`.
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:694:    - Atomic commit: `feat(48-01): extend route-ledger BOUNDARIES 8->9 with 'vtp_bridge'`.
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:844:    - Atomic commit: `feat(48-01): wire selectiveVTPCall consumer into orchestrator Step 6.X`.
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:858:| selectiveVTPCall -> .planning/metrics/vtp-bridge-failures.jsonl | Append-only canonical stream; no read-back execution path; row content includes raw error_message but NEVER injected back into evidence_packet.results[] |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:859:| selectiveVTPCall -> Phase 32 logRouteDecision -> route-decisions.jsonl | Append-only via existing trusted ledger surface; envelope-v1 schema enforced; closed-enum boundary |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:869:| T-48-04 | Repudiation | Bridge call succeeds but no record of evidence provenance for later audit | mitigate | Every success/failure call emits TWO canonical rows: (a) `vtp-bridge-failures.jsonl` row on failure ONLY, (b) `route-decisions.jsonl` envelope-v1 row on EVERY call (success and failure). Both include `run_id`, `ts`, `phase`, `milestone`, `decision.{tool, uncertainty_type, result_count, body_token_estimate, error_logged_at}`. |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:985:9. Three atomic commits in this exact order:
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:1023:- Files created/modified across the 3 atomic commits.
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:13:Critical to A3 (MCP failure separation): Phase 48 introduces a NEW append-only canonical stream `.planning/metrics/vtp-bridge-failures.jsonl` whose entire purpose is to keep VTP MCP error/timeout/auth-fail rows visually and structurally distinguishable from the evidence packet path. When the MCP fails, the bridge returns an empty `results[]` packet plus an `error_logged_at` reference; it does NOT inject the error message into the packet body where downstream consumers might mistake it for a research conclusion. This is the same pattern Phase 14 codex-log uses (self-test rows live alongside dispatch rows but in distinct vocabularies).
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:150:| `.planning/metrics/vtp-bridge-failures.jsonl` | Append-only canonical stream for MCP failures (NEW) | `vtp-health.jsonl` shape (Phase 32 surface) |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:455:      run_id: _generateRunId(),                  // mirror route-ledger generateRunId
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:550:| run_id generation | A new formatter | `route-ledger.cjs::generateRunId` (existing) | envelope-v1 conformance |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:1034:- **Every new projection gets a rebuild test** — Followed: `vtp-bridge-failures.jsonl` is append-only canonical (NOT a projection — primary stream).
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:6:- Tier: phase-level (dual-provider per v1.7 readiness GO)
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:16:## Findings (deduplicated)
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:27:- Tied to C1: when `dispatchResult` was undefined at the wire-in call site, `logCodexRoute` would receive `dispatchResult: undefined`, and the lib would emit a row with `decision.exit = null, decision.timeout_hit = false` -- partially valid but not capturing the actual dispatch outcome. With C1 fixed, every emitted row now has the full dispatch context.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:28:- Belt-and-braces fix added: `_assertEnvelopeV1(enriched)` step in `appendRow` (route-ledger.cjs) now does manual schema validation (13 required fields present, envelope_version === 1, run_id pattern match, duration_ms type, evidence/artifacts inner shape). Closes Codex's WARN-1 ("validation is shallow") at the same time.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:49:- Fix: added `_assertEnvelopeV1(enriched)` step in `appendRow`. Manual schema validation without adding ajv dep. Checks: 13 required fields present, envelope_version === 1, run_id pattern match, duration_ms type+range, evidence items have {kind, ref}, artifacts items have {kind, path}. Throws on violation; public-API try/catch still preserves never-throws-upward contract.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:68:| 2 Delete | PASS | Deduplicated wire-in (removed orphan post-branch copy after C1 fix). |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:95:Phase 32 route-ledger lib + codex_route wire-in + fallback test land cleanly; dual-provider review surfaced 2 CRITs (out-of-scope dispatchResult / linked envelope conformance) + 5 WARNs (plan drift / wire scope / cwd / shallow validation / broad catch); 6 findings fixed in-loop in 1 attempt each, 1 deferred design-locked (W5: writer never throws upward per CONTEXT.md lock). Combined anti-slop 9.5/10.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:15:Land an append-only `.planning/metrics/route-decisions.jsonl` ledger plus
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:33:ONE plan: `32-01-route-ledger-PLAN.md` with three atomic deliverables:
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:36:   - `logRouteDecision({boundary, decision, reason_codes, evidence, phase, milestone, duration_ms, run_id?})` exported function
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:38:     `{envelope_version: 1, ts, command: "logRouteDecision", status, run_id, boundary, decision, reason_codes, artifacts, evidence, next_action, risk, duration_ms, phase, milestone}`
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:39:   - JSONL atomic append using `fs.appendFileSync` (single-line, single
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:49:     6. run_id auto-generated when absent (matches envelope-v1 regex)
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:100:- 9.5 random hex run_id pattern (LOCKED)
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:119:- Step 9 (phase-level ATC): RUNS dual-provider per readiness GO
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:124:"Codex unavailable" deferrals. Real WARNs from dual-provider review
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:40:Phase 32 lands the Route Decision Ledger: an append-only
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:55:fallback test (~376 lines additive, zero deletions) across 3 atomic
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:83:- required: [envelope_version, ts, command, status, reason_codes, artifacts, evidence, next_action, risk, duration_ms, run_id, phase, milestone]
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:86:- run_id pattern: ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}$
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:118:  <name>T1: Land route-ledger.cjs lib + codex_route wire-in + local fallback test (atomic commits x3)</name>
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:133:        run_id matching the envelope-v1 regex, command === 'logRouteDecision'.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:189:// Append-only. Every row is a valid command-envelope-v1 row PLUS
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:211://     run_id:           "YYYY-MM-DDTHH:MM:SS.sssZ-XXXX" (4hex),
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:221:// Concurrency: orchestrator is single-threaded; per-dispatch-ATC fires
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:223:// locking required. fs.appendFileSync is atomic at row boundary on POSIX
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:260:// run_id pattern matches envelope-v1.json: ISO ts + 4 hex chars.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:268:// Validate envelope-v1 run_id pattern. Used only by self-test; production
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:270:const RUN_ID_REGEX =
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:310:    run_id: row.run_id || generateRunId(),
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:476:      RUN_ID_REGEX.test(rows[0].run_id) &&
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:509:    // 8. Append-only (no truncation).
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:835:3. Do NOT introduce concurrent-append locking, mutexes, or lock files.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:838:   waves serialize at SKILL.md:467-471. fs.appendFileSync is atomic at
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:871:10. Do NOT amend commits. Three atomic commits in order. If a verifier
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:892:      run_id matching envelope-v1 regex, command === 'logRouteDecision'
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:894:    - 3 atomic commits with correct conventional-commit messages.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:904:do not add concurrent locking, new reason_codes, renderer, or new deps;
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:972:| T-32-07 | Repudiation | Missing row when writer throws | accept | route-ledger is observability, not consensus; missed row is soft fault; orchestrator continues; cockpit may show partial signal until next dispatch |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:981:V6 Cryptography: minor -- crypto.randomBytes(2) for run_id; no key
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:1037:    run_id matches envelope-v1 pattern
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:1063:- 3 atomic commits, no amendments, no batched stages.
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\reviews\48-REVIEW.md:4:review_type: phase-level-ATC (Step 9, dual-provider)
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\reviews\48-REVIEW.md:9:# Phase 48 Phase-Level ATC Review — Dual Provider
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-VERIFICATION.md:8:re_verification_reason: "Phase-level ATC dual-provider review surfaced 2 CRITs (out-of-scope dispatchResult / envelope conformance) + 5 WARNs (plan drift / wire scope / cwd / shallow validation / broad catch); 6 fixed in-loop, 1 deferred design-locked (W5: writer never throws upward per CONTEXT.md lock). Combined anti-slop 9.5/10."
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-VERIFICATION.md:16:> Land an append-only `.planning/metrics/route-decisions.jsonl` ledger plus a writer module (`route-ledger.cjs`) that every orchestrator routing decision can log to. Phase 32 SHIPS one production caller (codex_route boundary) -- the 5 remaining boundary types are pre-declared in the schema but wired later (no schema-without-consumer violation: codex_route IS the consumer).
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-VERIFICATION.md:46:| **ROUTE-04** | Each row contains required envelope-v1 fields + extension fields; evidence[] uses `{kind, ref}` | Runtime emission test confirms all 13 envelope-v1 required fields present (envelope_version=1, ts, command='logRouteDecision', status, reason_codes, artifacts, evidence, next_action, risk, duration_ms, run_id, phase, milestone) PLUS 2 extension fields (boundary, decision). Evidence shape verified `[{"kind":"review_report","ref":"x.md"}]` -- uses `ref` per Phase 31 contract, not `path`. d1fefc1 BLOCKER fix landed (executor honored it: lib line 218-220 emits evidence with `ref`, lib line 238 `artifacts: []`). | PASS |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-VERIFICATION.md:73:| All 13 envelope-v1 required fields present in emitted rows | Runtime verification: envelope_version=1, ts (ISO-8601 string), command='logRouteDecision', status (envelope-v1 enum), reason_codes (array), artifacts (array), evidence (array), next_action (null default), risk (null default), duration_ms (null default), run_id (matches envelope-v1 regex), phase (string), milestone (string). All 13 present. | PASS |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-VERIFICATION.md:76:| run_id matches envelope-v1 pattern `^[0-9]{4}-[0-9]{2}-...Z-[a-f0-9]{4}$` | Runtime sample: `2026-04-27T08:20:12.009Z-3451`. Self-test assertion 4 + 11 verify uniqueness over 100 calls. | PASS |
.planning/milestones/v1.7/phases/32-route-decision-ledger\PHASE-CAPSULE.json:7:  "goal": "Land an append-only `.planning/metrics/route-decisions.jsonl` ledger plus",
.planning/milestones/v1.7/phases/32-route-decision-ledger\PHASE-CAPSULE.json:177:        "run_id": "2026-04-27T08:23:24Z",
.planning/milestones/v1.7/phases/32-route-decision-ledger\PHASE-CAPSULE.json:183:      "run_id": "2026-04-27T11:19:55.689Z-01d6",
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:59:Phase 32 lands a tiny append-only writer (`super-gsd/scripts/lib/route-ledger.cjs`)
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:90:| Append-only persistence | Filesystem JSONL (`.planning/metrics/route-decisions.jsonl`) | Same contract as crit-backlog.jsonl, edge-guard-log.jsonl, codex-log.jsonl |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:213:  "run_id": "rd-2026-04-27T11-32-01-123Z-a1b2",
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:239:| `run_id` | auto | envelope-v1 | `rd-{ts-with-dashes}-{4hex}` mirroring `crit-backlog.cjs:34-38` |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:299:   ISO-shaped `ts`, non-empty `run_id`.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:309:8. **Append-only**: two appends produce two rows; file never truncated.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:310:9. **Atomic append survives malformed line**: pre-write malformed line, then append; `readRows`
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:313:11. **Run_id uniqueness on rapid succession**: 100 appends -> 100 distinct `run_id`s.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:378:**6.1 Append-only, never mutate.** `fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8')`
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:382:**6.2 Atomic write via single appendFileSync.** OS-atomic on POSIX; on Windows uses CreateFile
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:383:`FILE_APPEND_DATA` which is atomic for sub-block writes. Each row is well under 4KB.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:384:Concurrency: orchestrator is single-threaded; per-dispatch-ATC fires sequentially after
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:401:**6.6 Generated id (`run_id`).** `crit-backlog.cjs:34-38`:
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:530:2. `appendFileSync` is atomic at row boundary. No partial-row writes architecturally.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:554:| 9.10 | Atomic write via tmp+rename vs appendFileSync? | **appendFileSync** | crit-backlog uses it; same atomicity guarantees on Windows + POSIX for sub-block writes |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:579:| Node `crypto` | Node 20+ | randomBytes for run_id | [VERIFIED: crit-backlog.cjs:27] |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:590:**Pattern 1: JSONL append + render** (`crit-backlog.cjs:107-113`) — append-only structured streams.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:620:| JSONL writer | Custom `fs.write` + offsets | `fs.appendFileSync` (atomic at row boundary) |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:623:| Concurrency control | Mutex / lock file | None — single-threaded loop; sequential per-dispatch-ATC at SKILL.md:467-471 |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:724:| V6 Cryptography | yes (minor) | `crypto.randomBytes(2)` for run_id; no key material |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:767:- **Atomic commits per unit.** Phase 32 plan splits: lib commit, SKILL.md wire-in commit,
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:785:| A2 | `appendFileSync` atomic at row boundaries on Windows for sub-block writes | 6.2 | LOW — same assumption crit-backlog/edge-guard rely on |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:786:| A3 | Single-threaded orchestrator means no concurrent appends | 6.2 | LOW — parallel waves serialize per-dispatch-ATC at SKILL.md:467-471 |
.planning/milestones/v1.7/phases/32-route-decision-ledger\codex-review-prompt.txt:27:1. Lib correctness (run_id regex actually matches envelope-v1 pattern; BOUNDARIES frozen; STATUSES enum aligned with envelope-v1 6-state; try/catch wrap means writer never throws upward)

2026-08-11T00:24:03.761435Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 1.1 seconds
Output:

 exited 1 in 1077ms:
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "Get-Content -Raw '.planning\\config.json'" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
 succeeded in 620ms:
{
  "atc": {
    "classify_model": "codex",
    "complexity_floor_files": 3,
    "complexity_floor_lines": 100,
    "enabled": true,
    "full_threshold_files": 4,
    "lite_threshold_files": 3,
    "lite_threshold_lines": 50,
    "skip_threshold_lines": 10,
    "verifier_adversarial_rate": 0.2
  },
  "browser_verify": {
    "approved_fallbacks": [
      "puppeteer"
    ],
    "base_url": "http://localhost:3000",
    "block_on_failure_auto_mode": false,
    "deferral_ledger_auto_reopen_after_phases": 3,
    "enabled": true,
    "fail_on_console_errors": true,
    "fail_on_network_errors": true,
    "frontend_globs": [
      "**/*.html",
      "**/*.tsx",
      "**/*.jsx",
      "**/*.vue",
      "**/*.svelte",
      "**/*.astro",
      "**/*.css",
      "**/*.scss",
      "src/**/*.ts",
      "frontend/**",
      "web/**",
      "ui/**",
      "pages/**",
      "components/**"
    ],
    "load_timeout_ms": 15000,
    "min_rows_per_route": 1,
    "required_endpoints": [],
    "routes": [
      "/"
    ]
  },
  "deliberation": {
    "auto_gate": true,
    "board": [
      "architect",
      "pragmatist",
      "contrarian",
      "moonshot",
      "researcher"
    ],
    "enabled": true,
    "gate_model": "codex",
    "max_rounds": 2,
    "trigger_phases_affected": 3
  },
  "git": {
    "atomic_commits": true,
    "branching_strategy": "none",
    "commit_docs": true
  },
  "handoff": {
    "enabled": true,
    "log_path": ".planning/metrics/handoff-log.jsonl",
    "max_chain_depth": 5,
    "min_cooldown_seconds": 30,
    "operator_abort_file": ".planning/STOP-HANDOFF",
    "recover_unexpected_auto_stop": true,
    "spawn_args": [
      "--print",
      "--dangerously-skip-permissions",
      "/sgsd-orchestrate go"
    ],
    "spawn_command": "claude",
    "unexpected_stop_max_pulse_age_seconds": 900
  },
  "hooks": {
    "context_warnings": true
  },
  "knowledge": {
    "fallback_corpus": "sgsd-bundled-research",
    "memory_root": ".planning/memory",
    "notes": "Private knowledge stays optional. SGSD memory is project-local by default. Public sources are discovery targets, not blindly ingested content.",
    "private_root": null,
    "public_sources": [
      {
        "description": "Local SGSD docs, briefs, decisions, milestones, and seeded project memory.",
        "enabled": true,
        "id": "sgsd-bundled-research",
        "mode": "local",
        "roots": [
          "README.md",
          "super-gsd/docs",
          ".planning/briefs",
          ".planning/decisions",
          ".planning/memory"
        ]
      },
      {
        "description": "Open computer-science research discovery; use metadata/abstracts first, PDFs only when licensing and relevance are clear.",
        "enabled": false,
        "id": "arxiv-cs",
        "mode": "online",
        "url": "https://arxiv.org/"
      },
      {
        "description": "Google SRE books for reliability, incident response, toil, SLOs, and operational design.",
        "enabled": false,
        "id": "google-sre",
        "mode": "online",
        "url": "https://sre.google/books/"
      },
      {
        "description": "NASA systems engineering handbook for lifecycle, verification, validation, and gate discipline.",
        "enabled": false,
        "id": "nasa-systems-engineering",
        "mode": "online",
        "url": "https://www.nasa.gov/reference/systems-engineering-handbook/"
      },
      {
        "description": "Microsoft REST API guidelines for public API design and governance.",
        "enabled": false,
        "id": "microsoft-api-guidelines",
        "mode": "online",
        "url": "https://github.com/microsoft/api-guidelines"
      },
      {
        "description": "Architecture of Open Source Applications case studies for real system structure.",
        "enabled": false,
        "id": "aosa",
        "mode": "online",
        "url": "https://aosabook.org/en/"
      }
    ],
    "version": 1
  },
  "model_profile": "quality",
  "model_routing": {
    "classifier": "codex",
    "code_reviewer": "codex",
    "context_selector": "codex",
    "executor": "codex",
    "orchestrator": "opus",
    "plan_checker": "codex",
    "planner": "codex",
    "researcher": "codex",
    "verifier": "codex"
  },
  "muda": {
    "inventory_thresholds": {
      "_doc": "MUDAC-02: linear-scale inventory probe thresholds. Final threshold = base * count of dirs in .planning/milestones/. Defaults match codebase fallbacks; absent config block produces identical behaviour.",
      "fail_per_milestone": 5,
      "warn_per_milestone": 2
    }
  },
  "overwatcher": {
    "auto_scan": true,
    "serve": false
  },
  "parallelization": {
    "enabled": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2,
    "plan_level": true,
    "skip_checkpoints": true,
    "task_level": false
  },
  "project": {
    "cockpit_panel_kinds": [
      "token",
      "source_mix",
      "active_agent",
      "codex",
      "intent",
      "governance",
      "budget"
    ],
    "configured_by": "sgsd-new-project-wizard",
    "configured_schema": "v1",
    "default_boot_mode": "auto",
    "operator_preferences": {
      "confirm_destructive": true,
      "verbose_logging": false
    },
    "schema_version": 1
  },
  "review_providers": {
    "codex_cli_path": "auto-detect",
    "codex_enabled": true,
    "executor_provider": "codex",
    "codex_executor_model": "gpt-5.6-sol",
    "codex_executor_reasoning_effort": "xhigh",
    "codex_model": "gpt-5.6-sol",
    "codex_qualitative_waste_enabled": true,
    "codex_reasoning_effort": "xhigh",
    "codex_timeout_seconds": 180,
    "codex_timeout_tiers": {
      "analysis": 180,
      "default": 60,
      "review": 120
    },
    "default_provider": "codex-cli-reviewer",
    "fallback_max_retries": 0,
    "fallback_on_error": false,
    "kill_claude_tokens_saved": 50000,
    "kill_critical_count_delta": 5
  },
  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  },
  "token_efficiency": {
    "checkpoint_threshold_percent": 100000,
    "context_injection": "sgsd_recall",
    "context_warning_percent": 70,
    "log_usage": true,
    "max_prompt_tokens": 1500,
    "max_report_words": 300,
    "state_read": "frontmatter_only"
  },
  "vtp_enrichment": {
    "audit_tier_batching": {
      "critical": "per-finding",
      "pass": "skip",
      "warn": "batched"
    },
    "challenger_mode": false,
    "empty_hit_policy": "continue",
    "enabled": true,
    "granularity": "tier-based",
    "max_queries_per_gate": 5,
    "query_seed_max_tokens": 800
  },
  "workflow": {
    "agent_report_max_words": 300,
    "auto_advance": true,
    "discuss_mode": "discuss",
    "granularity": "standard",
    "mode": "yolo",
    "nyquist_validation": true,
    "plan_check": true,
    "plan_fix_retry_cap": 3,
    "plan_format": "compressed_xml",
    "research": true,
    "research_before_questions": false,
    "schema_v2_hash": "5867692da13edf8939bc4ab898768e9c5e9938716f4754d4583eaa2f7d0d5631",
    "security_asvs_level": 1,
    "security_block_on": "high",
    "security_enforcement": true,
    "skip_discuss": false,
    "triage_vtp_enrichment": true,
    "verifier": true,
    "planner_model": "codex",
    "planner_reasoning_effort": "xhigh",
    "plan_final_codex_review": true,
    "plan_final_muda_review": true,
    "auto_continue_until_roadmap_complete": true,
    "planning_pipeline_enforced": true
  }
}


exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "rg -n -S \"timeout|Abort|Promise\\.race|idempot|dedup|replay|correlation|decision_id|triage_id|fire-and-forget|fire and forget|legacy-disabled\" super-gsd/scripts/lib/vtp-enrichment-gate.cjs super-gsd/scripts/lib/vtp-context-composer.cjs super-gsd/skills/sgsd-orchestrate/SKILL.md super-gsd/scripts/lib/route-ledger.cjs super-gsd/agents/sgsd-vtp-enrichment.md; if ("'$LASTEXITCODE -eq 1) { exit 0 }' in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
 succeeded in 655ms:
super-gsd/agents/sgsd-vtp-enrichment.md:6:status: legacy-disabled
super-gsd/scripts/lib/route-ledger.cjs:22://     status:           ok|warn|fail|skipped|timeout|blocked,
super-gsd/scripts/lib/route-ledger.cjs:90:  'ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked',
super-gsd/scripts/lib/route-ledger.cjs:259:    } else if (dr.exit === 5 || dr.timeout_hit === true) {
super-gsd/scripts/lib/route-ledger.cjs:260:      status = 'timeout';
super-gsd/scripts/lib/route-ledger.cjs:261:      reasonCodes.push('codex_timeout');
super-gsd/scripts/lib/route-ledger.cjs:287:      timeout_hit: !!dr.timeout_hit,
super-gsd/scripts/lib/route-ledger.cjs:336:      STATUSES.includes('timeout') && STATUSES.includes('blocked'));
super-gsd/skills/sgsd-orchestrate/SKILL.md:746:        `--step phase-research --timeout-tier analysis --phase {N}
super-gsd/skills/sgsd-orchestrate/SKILL.md:837:          `--step plan-final-review --timeout-tier analysis --phase {N}
super-gsd/skills/sgsd-orchestrate/SKILL.md:1018:          route-decisions.jsonl (boundary='vtp_bridge', status='fail'|'timeout'). The
super-gsd/skills/sgsd-orchestrate/SKILL.md:1046:          (vtp_unavailable, mcp_timeout, bad_provenance, compactness) for the
super-gsd/skills/sgsd-orchestrate/SKILL.md:1384:              timeout: effective.timeout_seconds || config.review_providers.codex_timeout_seconds,
super-gsd/skills/sgsd-orchestrate/SKILL.md:1388:              timeoutTier: 'analysis',  // D-05 #3: phase-level-ATC -> analysis tier (90s, not review 120s)
super-gsd/skills/sgsd-orchestrate/SKILL.md:1389:              retryOnTimeoutEscalate: true,  // D-05 #5: auto-escalate once to analysis on timeout
super-gsd/skills/sgsd-orchestrate/SKILL.md:1395:              const providerFailureReason = (dispatchResult.timeout_hit || dispatchResult.exit === 5)
super-gsd/skills/sgsd-orchestrate/SKILL.md:1396:                ? 'codex_timeout'
super-gsd/skills/sgsd-orchestrate/SKILL.md:1398:              // Do not write "Codex unavailable" for timeout. Auth/availability and
super-gsd/skills/sgsd-orchestrate/SKILL.md:1586:              load_timeout_ms from config
super-gsd/skills/sgsd-orchestrate/SKILL.md:1811:              The skill is idempotent. If the milestone is already archived, it returns PASS.
super-gsd/skills/sgsd-orchestrate/SKILL.md:2211:            timeout: effective.timeout_seconds || config.review_providers.codex_timeout_seconds,
super-gsd/skills/sgsd-orchestrate/SKILL.md:2215:            timeoutTier: 'analysis',  // D-05 #3: phase-level-ATC -> analysis tier (90s, not review 120s)
super-gsd/skills/sgsd-orchestrate/SKILL.md:2221:            const providerFailureReason = (dispatchResult.timeout_hit || dispatchResult.exit === 5)
super-gsd/skills/sgsd-orchestrate/SKILL.md:2222:              ? 'codex_timeout'
super-gsd/skills/sgsd-orchestrate/SKILL.md:2224:            // Do not write "Codex unavailable" for timeout. Auth/availability and
super-gsd/skills/sgsd-orchestrate/SKILL.md:2261:              dispatchResult,                                             // exit, timeout_hit (in scope)
super-gsd/skills/sgsd-orchestrate/SKILL.md:2439:                  timeout: challengerProvider.timeout_seconds || config.review_providers.codex_timeout_seconds,
super-gsd/skills/sgsd-orchestrate/SKILL.md:2443:                  timeoutTier: 'review'  // --timeout-tier review (D-03: adversarial → review tier = 120s)
super-gsd/skills/sgsd-orchestrate/SKILL.md:2453:                  const providerFailureReason = (dispatchResult.timeout_hit || dispatchResult.exit === 5)
super-gsd/skills/sgsd-orchestrate/SKILL.md:2454:                    ? 'codex_timeout'
super-gsd/skills/sgsd-orchestrate/SKILL.md:2582:do NOT crash the run (event-emit is fire-and-forget; legacy ledgers remain
super-gsd/scripts/lib/vtp-enrichment-gate.cjs:829:          error_message: 'MCP connection timeout',
super-gsd/scripts/lib/vtp-enrichment-gate.cjs:837:          if (passed && !content17.includes('MCP connection timeout')) fail('Test17: error_message missing');
super-gsd/scripts/lib/vtp-context-composer.cjs:332:    // Narrow-catch: swallow VTP/MCP/timeout shape errors; rethrow unknown.
super-gsd/scripts/lib/vtp-context-composer.cjs:333:    if (!/^(vtp_|mcp_|timeout)/.test(msg)) throw err;
super-gsd/scripts/lib/vtp-context-composer.cjs:334:    const status = /^timeout/.test(msg) || /timeout/.test(msg)
super-gsd/scripts/lib/vtp-context-composer.cjs:335:      ? 'timeout'
super-gsd/scripts/lib/vtp-context-composer.cjs:524:      // Test 7: callVtp failure path (vtp_timeout) returns {ok:false} + logs row
super-gsd/scripts/lib/vtp-context-composer.cjs:532:          mcpInvoke: async () => { throw new Error('vtp_timeout: exceeded budget'); },
super-gsd/scripts/lib/vtp-context-composer.cjs:535:        if (passed && !/^vtp_timeout/.test(r7.reason)) fail(`Test7: reason should start vtp_timeout, got '${r7.reason}'`);
super-gsd/scripts/lib/vtp-context-composer.cjs:542:          if (last.failure_reason !== 'vtp_timeout: exceeded budget') {

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "Get-Content 'super-gsd\\scripts\\lib\\vtp-context-composer.cjs' | Select-Object -Skip 260 -First 100; Get-Content 'super-gsd\\scripts\\lib\\vtp-enrichment-gate.cjs' | Select-Object -Skip 740 -First 120" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
 succeeded in 1053ms:
 * Date.now()-bracketed VTP MCP wrapper. Single measurement point for elapsed_ms
 * (per E-03 ƒ?" VTP tools do not return this natively). Writes a routing-log row
 * on BOTH success AND failure paths (threat T-16-08 mitigation).
 *
 * The actual MCP dispatch is caller-injected via args.mcpInvoke(tool, payload)
 * ƒ?" this keeps the composer testable and decouples the wrapper from the caller's
 * tool-invocation mechanism. Skills use their own Bash/Agent-tool invocation to
 * actually call mcp__vtp-kb__*; the composer's job is framing + measurement +
 * logging.
 *
 * @param {string} tool - canonical MCP tool name (e.g. 'mcp__vtp-kb__vtp_route_and_retrieve')
 * @param {Object} args
 * @param {Function} [args.mcpInvoke] - async (tool, payload) => response
 * @param {Object}   [args.payload]
 * @param {string}   args.projectDir
 * @param {string}   args.skillOrAgent
 * @param {string}   args.tier
 * @param {string}   args.rawQuery
 * @returns {Promise<{ok:boolean, response?:Object, elapsed_ms:number, reason?:string}>}
 */
async function callVtp(tool, args) {
  const t0 = Date.now();
  const a = args || {};
  const rawQuery     = a.rawQuery     || '';
  const projectDir   = a.projectDir   || process.cwd();
  const skillOrAgent = a.skillOrAgent || 'unknown';
  const tier         = a.tier         || 'standalone';
  const logRoot      = a.logRoot      || projectDir;

  // Pre-guard: VTP schema requires raw_query.min(3) (intent-routing.ts:299).
  if (!rawQuery || typeof rawQuery !== 'string' || rawQuery.length < 3) {
    writeRoutingLogRow({
      projectDir,
      logRoot,
      skillOrAgent,
      tier,
      rawQuery,
      response: null,
      elapsed_ms: 0,
      failureReason: 'query_too_short',
      status: 'query_rejected',
    });
    return { ok: false, reason: 'query_too_short', elapsed_ms: 0 };
  }

  if (typeof a.mcpInvoke !== 'function') {
    // No injected invoker ƒ?" return a structured failure rather than throwing.
    // Lets test fixtures and dry-runs exercise the code path cleanly.
    const elapsed_ms = Date.now() - t0;
    writeRoutingLogRow({
      projectDir,
      logRoot,
      skillOrAgent,
      tier,
      rawQuery,
      response: null,
      elapsed_ms,
      failureReason: 'no_mcp_invoke',
      status: 'mcp_unavailable',
    });
    return { ok: false, reason: 'no_mcp_invoke', elapsed_ms };
  }

  try {
    const response   = await a.mcpInvoke(tool, a.payload);
    const elapsed_ms = Date.now() - t0;
    writeRoutingLogRow({ projectDir, logRoot, skillOrAgent, tier, rawQuery, response, elapsed_ms });
    return { ok: true, response, elapsed_ms };
  } catch (err) {
    const elapsed_ms = Date.now() - t0;
    const msg = (err && err.message) ? err.message : String(err);
    // Narrow-catch: swallow VTP/MCP/timeout shape errors; rethrow unknown.
    if (!/^(vtp_|mcp_|timeout)/.test(msg)) throw err;
    const status = /^timeout/.test(msg) || /timeout/.test(msg)
      ? 'timeout'
      : /^mcp_/.test(msg)
        ? 'mcp_error'
        : 'vtp_error';
    writeRoutingLogRow({ projectDir, logRoot, skillOrAgent, tier, rawQuery, response: null, elapsed_ms, failureReason: msg, status });
    return { ok: false, reason: msg, elapsed_ms };
  }
}

/**
 * Clear the in-memory cache. Test-only helper.
 */
function resetCache() {
  _cache = null;
}

module.exports = { compose, project, isFastPathEligible, callVtp, TIERS, resetCache };

// Non-exported helpers kept on the function table for self-test access only
// (not part of the public contract).
module.exports._internal = {
  readConfigToggle,
  sanitizeRecentCommands,
  writeRoutingLogRow,
  extractRowFields,
  FAST_PATH_TIMEOUT_MS,
        const r10 = readEnrichmentArtifact({ phaseDir: emptyPhaseDir });
        if (r10 !== null) fail('Test10: should return null when artifact absent');
      } finally {
        try { fs.rmSync(emptyPhaseDir, { recursive: true, force: true }); } catch (_) {}
      }
    }

    // -----------------------------------------------------------------
    // Test 11: vtpCrossReference exported and callable (VTPE-02 long-form alias)
    // -----------------------------------------------------------------
    if (passed) {
      if (typeof module.exports.vtpCrossReference !== 'function') fail('Test11: vtpCrossReference is not a function');
    }

    // -----------------------------------------------------------------
    // Test 12: vtpCrossReference PASS -> {skipped:true} (D-05 no-op)
    // -----------------------------------------------------------------
    if (passed) {
      const r12 = vtpCrossReference('no issue', 'PASS');
      if (r12.skipped !== true) fail('Test12: PASS tier should return {skipped:true}');
    }

    // -----------------------------------------------------------------
    // Test 13: vtpCrossReference WARN -> {batched_citations:[], batch_pending:true}
    // -----------------------------------------------------------------
    if (passed) {
      const r13 = vtpCrossReference('warn finding', 'WARN');
      if (!Array.isArray(r13.batched_citations)) fail('Test13: WARN should have batched_citations array');
      if (passed && r13.batch_pending !== true) fail('Test13: WARN should set batch_pending:true');
      if (passed && (!r13.query_spec || r13.query_spec.mode !== 'batched-warn')) fail('Test13: WARN query_spec.mode mismatch');
    }

    // -----------------------------------------------------------------
    // Test 14: vtpCrossReference CRITICAL -> {citations:[], confidence:0, query_spec}
    // -----------------------------------------------------------------
    if (passed) {
      const r14 = vtpCrossReference('critical finding', 'CRITICAL', { fileContext: 'src/foo.cjs:10' });
      if (!Array.isArray(r14.citations)) fail('Test14: CRITICAL should have citations array');
      if (passed && typeof r14.confidence !== 'number') fail('Test14: CRITICAL should have numeric confidence');
      if (passed && (!r14.query_spec || r14.query_spec.mode !== 'per-finding-critical')) fail('Test14: CRITICAL query_spec.mode mismatch');
    }

    // -----------------------------------------------------------------
    // Test 15: vtpCrossReference unknown tier -> {skipped:true} (guard)
    // -----------------------------------------------------------------
    if (passed) {
      const r15 = vtpCrossReference('text', 'UNKNOWN');
      if (r15.skipped !== true) fail('Test15: unknown tier should be treated as PASS guard');
    }

    // -----------------------------------------------------------------
    // Test 16: VTPE-05 empty_hit path ƒ?" artifact written with empty_hit:true + rationale
    // -----------------------------------------------------------------
    if (passed) {
      const phaseTmp16 = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-gate-eh-'));
      try {
        const emptyResult = {
          phase: '21-empty',
          query_count: 2,
          total_hits: 0,
          duration_ms: 30,
          hits: [],
          seed_summary: 'VTP enrichment gate empty-hit test',
          empty_hit_rationale: 'No coverage found for this topic.',
        };
        const writePath16 = writeEnrichmentArtifact({ phaseDir: phaseTmp16, enrichmentResult: emptyResult });
        if (!fs.existsSync(writePath16)) fail('Test16: empty_hit artifact not written');
        if (passed) {
          const content16 = fs.readFileSync(writePath16, 'utf8');
          if (!content16.includes('empty_hit: true')) fail('Test16: empty_hit:true missing from frontmatter');
          if (passed && !content16.includes('vtp_status: empty_hit')) fail('Test16: vtp_status:empty_hit missing');
          if (passed && !content16.includes('## Empty-Hit Rationale')) fail('Test16: Empty-Hit Rationale section missing');
          if (passed && !content16.includes('No coverage found for this topic.')) fail('Test16: rationale text missing');
        }
      } finally {
        try { fs.rmSync(phaseTmp16, { recursive: true, force: true }); } catch (_) {}
      }
    }

    // -----------------------------------------------------------------
    // Test 17: VTPE-05 api_error path ƒ?" artifact written as stub with exit-block signal
    // -----------------------------------------------------------------
    if (passed) {
      const phaseTmp17 = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-gate-ae-'));
      try {
        const errorResult = {
          phase: '21-error',
          ok: false,
          error_message: 'MCP connection timeout',
        };
        const writePath17 = writeEnrichmentArtifact({ phaseDir: phaseTmp17, enrichmentResult: errorResult });
        if (!fs.existsSync(writePath17)) fail('Test17: api_error artifact not written');
        if (passed) {
          const content17 = fs.readFileSync(writePath17, 'utf8');
          if (!content17.includes('vtp_status: api_error')) fail('Test17: vtp_status:api_error missing');
          if (passed && !content17.includes('## API Error')) fail('Test17: API Error section missing');
          if (passed && !content17.includes('MCP connection timeout')) fail('Test17: error_message missing');
          if (passed && !content17.includes('EXIT-BLOCK')) fail('Test17: EXIT-BLOCK signal missing');
        }
      } finally {
        try { fs.rmSync(phaseTmp17, { recursive: true, force: true }); } catch (_) {}
      }
    }

    // -----------------------------------------------------------------
    // Test 18: VTPE-05 success path via enrichmentResult injection ƒ?" vtp_status:success
    // -----------------------------------------------------------------
    if (passed) {
      const phaseTmp18 = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-gate-sc-'));
      try {
        const successResult = {
          phase: '21-success',
          query_count: 3,
          total_hits: 2,
          duration_ms: 120,
          hits: [{ source: 'book', title: 'DDIA', section: 'Ch4', relevance: 'high', citation: 'ddia:042' }],
          gaps: ['caching gap'],
          alt_framings: ['event-driven alternative'],
        };
        const writePath18 = writeEnrichmentArtifact({ phaseDir: phaseTmp18, enrichmentResult: successResult });

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "rg -n -C 6 -S \"FAST_PATH_TIMEOUT_MS|Promise\\.race|setTimeout\" super-gsd/scripts/lib/vtp-context-composer.cjs" in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
 succeeded in 707ms:
38-  assumptions: { fields: ['repo', 'current_task', 'recent_turns', 'recent_errors'] },
39-  standalone:  { fields: ['repo', 'current_task', 'explicit_constraints'] },
40-});
41-
42-const ROUTING_LOG_PATH     = path.join('.planning', 'metrics', 'vtp-routing-log.jsonl');
43-const CONFIG_PATH          = '.planning/config.json';
44:const FAST_PATH_TIMEOUT_MS = 3000;
45-const BUDGET_EXCEEDED      = -1;
46-
47-// Env-var / secret pattern filters (CLAUDE.md security rule + threat T-16-03).
48-// Any recent_commands entry matching either regex is stripped before returning ctx.
49-const SECRET_KV_RE  = /[A-Z_]+=/;
50-const SECRET_KEY_RE = /[A-Z][A-Z_]+_KEY/;
--
354-// (not part of the public contract).
355-module.exports._internal = {
356-  readConfigToggle,
357-  sanitizeRecentCommands,
358-  writeRoutingLogRow,
359-  extractRowFields,
360:  FAST_PATH_TIMEOUT_MS,
361-  BUDGET_EXCEEDED,
362-};
363-
364-// ---------------------------------------------------------------------------
365-// --self-test CLI
366-// Mirrors edge-guard.cjs:128-265 shape. Writes to a temp dir so the real

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command 'rg -n -S "idempot|dedup|replay|correlation|run_id|append-only|atomic|concurr|dual|partial" .planning/milestones/v1.7/phases/32-route-decision-ledger .planning/milestones/v1.9/phases/48-selective-vtp-bridge; if ($LASTEXITCODE -eq 1) { exit 0 }' in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
 succeeded in 1637ms:
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:6:- Tier: phase-level (dual-provider per v1.7 readiness GO)
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:16:## Findings (deduplicated)
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:27:- Tied to C1: when `dispatchResult` was undefined at the wire-in call site, `logCodexRoute` would receive `dispatchResult: undefined`, and the lib would emit a row with `decision.exit = null, decision.timeout_hit = false` -- partially valid but not capturing the actual dispatch outcome. With C1 fixed, every emitted row now has the full dispatch context.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:28:- Belt-and-braces fix added: `_assertEnvelopeV1(enriched)` step in `appendRow` (route-ledger.cjs) now does manual schema validation (13 required fields present, envelope_version === 1, run_id pattern match, duration_ms type, evidence/artifacts inner shape). Closes Codex's WARN-1 ("validation is shallow") at the same time.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:49:- Fix: added `_assertEnvelopeV1(enriched)` step in `appendRow`. Manual schema validation without adding ajv dep. Checks: 13 required fields present, envelope_version === 1, run_id pattern match, duration_ms type+range, evidence items have {kind, ref}, artifacts items have {kind, path}. Throws on violation; public-API try/catch still preserves never-throws-upward contract.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:68:| 2 Delete | PASS | Deduplicated wire-in (removed orphan post-branch copy after C1 fix). |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-ATC-REVIEW.md:95:Phase 32 route-ledger lib + codex_route wire-in + fallback test land cleanly; dual-provider review surfaced 2 CRITs (out-of-scope dispatchResult / linked envelope conformance) + 5 WARNs (plan drift / wire scope / cwd / shallow validation / broad catch); 6 findings fixed in-loop in 1 attempt each, 1 deferred design-locked (W5: writer never throws upward per CONTEXT.md lock). Combined anti-slop 9.5/10.
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:13:Critical to A3 (MCP failure separation): Phase 48 introduces a NEW append-only canonical stream `.planning/metrics/vtp-bridge-failures.jsonl` whose entire purpose is to keep VTP MCP error/timeout/auth-fail rows visually and structurally distinguishable from the evidence packet path. When the MCP fails, the bridge returns an empty `results[]` packet plus an `error_logged_at` reference; it does NOT inject the error message into the packet body where downstream consumers might mistake it for a research conclusion. This is the same pattern Phase 14 codex-log uses (self-test rows live alongside dispatch rows but in distinct vocabularies).
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:150:| `.planning/metrics/vtp-bridge-failures.jsonl` | Append-only canonical stream for MCP failures (NEW) | `vtp-health.jsonl` shape (Phase 32 surface) |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:455:      run_id: _generateRunId(),                  // mirror route-ledger generateRunId
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:550:| run_id generation | A new formatter | `route-ledger.cjs::generateRunId` (existing) | envelope-v1 conformance |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-RESEARCH.md:1034:- **Every new projection gets a rebuild test** — Followed: `vtp-bridge-failures.jsonl` is append-only canonical (NOT a projection — primary stream).
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\reviews\48-REVIEW.md:4:review_type: phase-level-ATC (Step 9, dual-provider)
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\reviews\48-REVIEW.md:9:# Phase 48 Phase-Level ATC Review — Dual Provider
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:302:**Audit verdict:** ALL in-scope items COVERED across 3 atomic commits (T1, T2, T3). All out-of-scope items DEFERRED to correct downstream owners per RESEARCH Section 13. Zero unplanned items. No phase split required.
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:573:    - Atomic commit: `feat(48-01): vtp-bridge/classify.cjs + VTP_TOOL_MAP + 10-assertion self-test`.
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:694:    - Atomic commit: `feat(48-01): extend route-ledger BOUNDARIES 8->9 with 'vtp_bridge'`.
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:844:    - Atomic commit: `feat(48-01): wire selectiveVTPCall consumer into orchestrator Step 6.X`.
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:858:| selectiveVTPCall -> .planning/metrics/vtp-bridge-failures.jsonl | Append-only canonical stream; no read-back execution path; row content includes raw error_message but NEVER injected back into evidence_packet.results[] |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:859:| selectiveVTPCall -> Phase 32 logRouteDecision -> route-decisions.jsonl | Append-only via existing trusted ledger surface; envelope-v1 schema enforced; closed-enum boundary |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:869:| T-48-04 | Repudiation | Bridge call succeeds but no record of evidence provenance for later audit | mitigate | Every success/failure call emits TWO canonical rows: (a) `vtp-bridge-failures.jsonl` row on failure ONLY, (b) `route-decisions.jsonl` envelope-v1 row on EVERY call (success and failure). Both include `run_id`, `ts`, `phase`, `milestone`, `decision.{tool, uncertainty_type, result_count, body_token_estimate, error_logged_at}`. |
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:985:9. Three atomic commits in this exact order:
.planning/milestones/v1.9/phases/48-selective-vtp-bridge\48-01-selective-vtp-bridge-PLAN.md:1023:- Files created/modified across the 3 atomic commits.
.planning/milestones/v1.7/phases/32-route-decision-ledger\PHASE-CAPSULE.json:7:  "goal": "Land an append-only `.planning/metrics/route-decisions.jsonl` ledger plus",
.planning/milestones/v1.7/phases/32-route-decision-ledger\PHASE-CAPSULE.json:177:        "run_id": "2026-04-27T08:23:24Z",
.planning/milestones/v1.7/phases/32-route-decision-ledger\PHASE-CAPSULE.json:183:      "run_id": "2026-04-27T11:19:55.689Z-01d6",
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:59:Phase 32 lands a tiny append-only writer (`super-gsd/scripts/lib/route-ledger.cjs`)
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:90:| Append-only persistence | Filesystem JSONL (`.planning/metrics/route-decisions.jsonl`) | Same contract as crit-backlog.jsonl, edge-guard-log.jsonl, codex-log.jsonl |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:213:  "run_id": "rd-2026-04-27T11-32-01-123Z-a1b2",
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:239:| `run_id` | auto | envelope-v1 | `rd-{ts-with-dashes}-{4hex}` mirroring `crit-backlog.cjs:34-38` |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:299:   ISO-shaped `ts`, non-empty `run_id`.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:309:8. **Append-only**: two appends produce two rows; file never truncated.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:310:9. **Atomic append survives malformed line**: pre-write malformed line, then append; `readRows`
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:313:11. **Run_id uniqueness on rapid succession**: 100 appends -> 100 distinct `run_id`s.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:378:**6.1 Append-only, never mutate.** `fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8')`
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:382:**6.2 Atomic write via single appendFileSync.** OS-atomic on POSIX; on Windows uses CreateFile
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:383:`FILE_APPEND_DATA` which is atomic for sub-block writes. Each row is well under 4KB.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:384:Concurrency: orchestrator is single-threaded; per-dispatch-ATC fires sequentially after
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:401:**6.6 Generated id (`run_id`).** `crit-backlog.cjs:34-38`:
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:530:2. `appendFileSync` is atomic at row boundary. No partial-row writes architecturally.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:554:| 9.10 | Atomic write via tmp+rename vs appendFileSync? | **appendFileSync** | crit-backlog uses it; same atomicity guarantees on Windows + POSIX for sub-block writes |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:579:| Node `crypto` | Node 20+ | randomBytes for run_id | [VERIFIED: crit-backlog.cjs:27] |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:590:**Pattern 1: JSONL append + render** (`crit-backlog.cjs:107-113`) — append-only structured streams.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:620:| JSONL writer | Custom `fs.write` + offsets | `fs.appendFileSync` (atomic at row boundary) |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:623:| Concurrency control | Mutex / lock file | None — single-threaded loop; sequential per-dispatch-ATC at SKILL.md:467-471 |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:724:| V6 Cryptography | yes (minor) | `crypto.randomBytes(2)` for run_id; no key material |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:767:- **Atomic commits per unit.** Phase 32 plan splits: lib commit, SKILL.md wire-in commit,
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:785:| A2 | `appendFileSync` atomic at row boundaries on Windows for sub-block writes | 6.2 | LOW — same assumption crit-backlog/edge-guard rely on |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-RESEARCH.md:786:| A3 | Single-threaded orchestrator means no concurrent appends | 6.2 | LOW — parallel waves serialize per-dispatch-ATC at SKILL.md:467-471 |
.planning/milestones/v1.7/phases/32-route-decision-ledger\codex-review-prompt.txt:27:1. Lib correctness (run_id regex actually matches envelope-v1 pattern; BOUNDARIES frozen; STATUSES enum aligned with envelope-v1 6-state; try/catch wrap means writer never throws upward)
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:40:Phase 32 lands the Route Decision Ledger: an append-only
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:55:fallback test (~376 lines additive, zero deletions) across 3 atomic
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:83:- required: [envelope_version, ts, command, status, reason_codes, artifacts, evidence, next_action, risk, duration_ms, run_id, phase, milestone]
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:86:- run_id pattern: ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}$
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:118:  <name>T1: Land route-ledger.cjs lib + codex_route wire-in + local fallback test (atomic commits x3)</name>
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:133:        run_id matching the envelope-v1 regex, command === 'logRouteDecision'.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:189:// Append-only. Every row is a valid command-envelope-v1 row PLUS
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:211://     run_id:           "YYYY-MM-DDTHH:MM:SS.sssZ-XXXX" (4hex),
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:221:// Concurrency: orchestrator is single-threaded; per-dispatch-ATC fires
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:223:// locking required. fs.appendFileSync is atomic at row boundary on POSIX
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:260:// run_id pattern matches envelope-v1.json: ISO ts + 4 hex chars.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:268:// Validate envelope-v1 run_id pattern. Used only by self-test; production
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:270:const RUN_ID_REGEX =
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:310:    run_id: row.run_id || generateRunId(),
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:476:      RUN_ID_REGEX.test(rows[0].run_id) &&
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:509:    // 8. Append-only (no truncation).
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:835:3. Do NOT introduce concurrent-append locking, mutexes, or lock files.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:838:   waves serialize at SKILL.md:467-471. fs.appendFileSync is atomic at
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:871:10. Do NOT amend commits. Three atomic commits in order. If a verifier
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:892:      run_id matching envelope-v1 regex, command === 'logRouteDecision'
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:894:    - 3 atomic commits with correct conventional-commit messages.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:904:do not add concurrent locking, new reason_codes, renderer, or new deps;
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:972:| T-32-07 | Repudiation | Missing row when writer throws | accept | route-ledger is observability, not consensus; missed row is soft fault; orchestrator continues; cockpit may show partial signal until next dispatch |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:981:V6 Cryptography: minor -- crypto.randomBytes(2) for run_id; no key
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:1037:    run_id matches envelope-v1 pattern
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-01-route-ledger-PLAN.md:1063:- 3 atomic commits, no amendments, no batched stages.
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:15:Land an append-only `.planning/metrics/route-decisions.jsonl` ledger plus
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:33:ONE plan: `32-01-route-ledger-PLAN.md` with three atomic deliverables:
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:36:   - `logRouteDecision({boundary, decision, reason_codes, evidence, phase, milestone, duration_ms, run_id?})` exported function
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:38:     `{envelope_version: 1, ts, command: "logRouteDecision", status, run_id, boundary, decision, reason_codes, artifacts, evidence, next_action, risk, duration_ms, phase, milestone}`
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:39:   - JSONL atomic append using `fs.appendFileSync` (single-line, single
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:49:     6. run_id auto-generated when absent (matches envelope-v1 regex)
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:100:- 9.5 random hex run_id pattern (LOCKED)
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:119:- Step 9 (phase-level ATC): RUNS dual-provider per readiness GO
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-CONTEXT.md:124:"Codex unavailable" deferrals. Real WARNs from dual-provider review
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-VERIFICATION.md:8:re_verification_reason: "Phase-level ATC dual-provider review surfaced 2 CRITs (out-of-scope dispatchResult / envelope conformance) + 5 WARNs (plan drift / wire scope / cwd / shallow validation / broad catch); 6 fixed in-loop, 1 deferred design-locked (W5: writer never throws upward per CONTEXT.md lock). Combined anti-slop 9.5/10."
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-VERIFICATION.md:16:> Land an append-only `.planning/metrics/route-decisions.jsonl` ledger plus a writer module (`route-ledger.cjs`) that every orchestrator routing decision can log to. Phase 32 SHIPS one production caller (codex_route boundary) -- the 5 remaining boundary types are pre-declared in the schema but wired later (no schema-without-consumer violation: codex_route IS the consumer).
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-VERIFICATION.md:46:| **ROUTE-04** | Each row contains required envelope-v1 fields + extension fields; evidence[] uses `{kind, ref}` | Runtime emission test confirms all 13 envelope-v1 required fields present (envelope_version=1, ts, command='logRouteDecision', status, reason_codes, artifacts, evidence, next_action, risk, duration_ms, run_id, phase, milestone) PLUS 2 extension fields (boundary, decision). Evidence shape verified `[{"kind":"review_report","ref":"x.md"}]` -- uses `ref` per Phase 31 contract, not `path`. d1fefc1 BLOCKER fix landed (executor honored it: lib line 218-220 emits evidence with `ref`, lib line 238 `artifacts: []`). | PASS |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-VERIFICATION.md:73:| All 13 envelope-v1 required fields present in emitted rows | Runtime verification: envelope_version=1, ts (ISO-8601 string), command='logRouteDecision', status (envelope-v1 enum), reason_codes (array), artifacts (array), evidence (array), next_action (null default), risk (null default), duration_ms (null default), run_id (matches envelope-v1 regex), phase (string), milestone (string). All 13 present. | PASS |
.planning/milestones/v1.7/phases/32-route-decision-ledger\32-VERIFICATION.md:76:| run_id matches envelope-v1 pattern `^[0-9]{4}-[0-9]{2}-...Z-[a-f0-9]{4}$` | Runtime sample: `2026-04-27T08:20:12.009Z-3451`. Self-test assertion 4 + 11 verify uniqueness over 100 calls. | PASS |

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command 'rg --files .planning | rg -i "cross-pollination|cross_pollination"; rg -n -S "vtp_triage_advisory" super-gsd .planning; if ($LASTEXITCODE -eq 1) { exit 0 }' in C:\Users\jack.berrow\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
 succeeded in 946ms:
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md
.planning\decisions\2026-08-11-cross-pollination-BOARD-MEMO.md
.planning\briefs\2026-08-11-cross-pollination-handover.md
.planning\briefs\2026-08-11-cross-pollination-ANALYSIS.md
.planning\briefs\2026-08-11-cross-pollination-handover.md:65:  `route-decisions.jsonl` row with `boundary='vtp_triage_advisory'`.
.planning\decisions\2026-08-11-cross-pollination-CODEX-CHALLENGE-PROMPT.md:152:  `route-decisions.jsonl` row with `boundary='vtp_triage_advisory'`.

codex
CHALLENGE_VERDICT: memo-unsafe
SURVIVING_OBJECTIONS: GREEN proves availability, not demand, routing quality, or acceptable SGSD cost; the probe wrongly applies “zero writes” to feedback, whose purpose is writing; Step 6.b.5 has no enforced timeout and can stack triage with its five-tool cascade, the per-dispatch bridge, and planner MCP calls; fire-and-forget dual writes lack atomic correlation, idempotency, reconciliation, and correction semantics; RED is instrumentation, not deletion, and its “override” has no route to override; automatic phase-close taste labels cannot prove actual use, while strict v1 cannot represent general artefacts.
BINDING_ADDITIONS: Make logging-only baseline followed by triage shadow-mode the mandatory sequence for both probe outcomes; predeclare eligible queries and record inadequacy before triage, including denominator, latency, tokens, call count, and quality delta; block automatic route-following on gold-set human approval; define mutual exclusion and one total VTP call budget across triage/cascade/bridge/planner; implement real cancellation; use a durable idempotent decision_id/triage_id outbox with replay deduplication, pending/reconciled states, and superseding corrections, counting only unique reconciled pairs; test feedback writes in isolation and require reasons for modify/reject; defer automatic taste feedback until stable artefact IDs, v2, and end-to-end usage provenance exist; activate a milestone and approved PLAN before source edits.
ONE_LINER: The fork confuses capability with earned demand—RED is the baseline that must precede GREEN, while the proposed GREEN path currently adds an unvalidated multi-call critical path and corruptible evidence stream.
tokens used
104,769
