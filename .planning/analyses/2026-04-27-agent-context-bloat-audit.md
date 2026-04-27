---
title: SGSD Agent Context Bloat Audit
created: 2026-04-27
status: draft-for-implementation
scope:
  repo: C:/Users/jack.berrow/GSDedits
  primary_focus: gsd-phase-researcher token bloat
  sampled_milestones: [v1.8, v1.9]
  sampled_phases: [36, 37, 38, 39, 40, 41]
evidence_sources:
  - .planning/metrics/token-attribution.jsonl
  - .planning/metrics/activity-log.jsonl
  - .planning/config.json
  - .planning/milestones/v1.8/phases/
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
  - super-gsd/tools/token-attribution/collect.cjs
  - VTP KB service-enrichment advice, 2026-04-27
---

# SGSD Agent Context Bloat Audit

## Executive Conclusion

The researcher agent is genuinely bloated, but the largest waste is not the
visible `RESEARCH.md` output. The largest waste is hidden inherited context.

In the sampled v1.8 phases, `gsd-phase-researcher` spent 122k-223k tokens per
phase, with 98 percent plus of that spend recorded as `cache_read_input_tokens`.
For Phase 40, it used only 8 reads and 12 shell commands, wrote a 519-line
research file, and still consumed 122,437 tokens. That is not because Phase 40
needed 122k tokens of thinking. It is because the agent was launched inside a
large accumulated SGSD session and paid to carry context it did not need.

Current live evidence makes the problem wider than the researcher agent: at
v1.9/P41, four orchestrator turns used 1,244,893 tokens without any sub-agent
calls. Of that, 1,220,293 tokens were cache reads. The main loop itself is now
expensive.

Redis can help, but it is not the root fix. Redis only helps if SGSD first
switches from "agent receives broad session context and scans files" to "agent
receives a small compiled context packet". Without that, Redis becomes one more
memory store and may increase bloat.

The fix should be:

1. Create compact phase close capsules.
2. Build bounded context packets from capsules, file summaries, and explicit
   phase goals.
3. Dispatch cheap/repetitive roles in isolated context, not inherited context.
4. Use Redis/Valkey or SQLite as a fast index/cache, never as the canonical
   source of truth.
5. Add hard token gates and token-waste rows to the existing metrics system.
6. Route bounded review/checking work to Codex first; keep Claude for ambiguous
   synthesis and execution judgment.

## Evidence Gathered

Commands run during this audit:

```powershell
node super-gsd/tools/token-attribution/collect.cjs --project . --summary --current
node super-gsd/tools/token-attribution/collect.cjs --project . --summary --all
Select-String -Path super-gsd\skills\sgsd-orchestrate\SKILL.md -Pattern "..."
Get-Content .planning\config.json -Raw
Get-ChildItem .planning\milestones\v1.8\phases -Recurse -File -Filter '*RESEARCH.md'
Get-ChildItem .planning\milestones\v1.8\phases -Recurse -File -Filter '*PLAN.md'
```

VTP KB was also queried for conservative service-enrichment advice against the
observed SGSD behavior. The relevant VTP principles were:

- Partition private execution state from public/coordination state.
- Gate retrieval and escalation; do not communicate or retrieve by default.
- Use compact structured prompts for planners/executors.
- Preserve memory provenance and avoid over-collection.

Those points line up with the local evidence: SGSD currently has too much
ambient context and not enough bounded role-specific context.

## Live Token Ledger Summary

From `.planning/metrics/token-attribution.jsonl` using
`super-gsd/tools/token-attribution/collect.cjs --summary --all`:

```text
event_count:                     11,173
agent_calls:                        292
agent_total_tokens:          20,389,020

assistant turns:                 10,881
assistant total tokens:   3,839,327,646
assistant context tokens: 3,822,843,530
assistant cache read:     3,701,953,714
assistant output tokens:     16,484,116
```

Interpretation:

- Sub-agents are expensive: 20.4M tokens total.
- The main Claude session is far more expensive in aggregate: 3.84B recorded
  tokens, almost all context/cache read.
- Output is not the main driver. Context carried forward is the driver.

Current live scope at scan time:

```text
scope: v1.9 / phase 41
events in current summary: 4
assistant total tokens: 1,244,893
assistant cache read:   1,220,293
agent calls: 0
```

That means the orchestrator can burn about 1.2M cache-read tokens in a few
turns even before dispatching a researcher, planner, executor, or verifier.

## Where Tokens Are Going By Agent

Top agent totals from the attribution ledger:

| Agent | Calls | Total tokens | Avg tokens | Avg duration | Current offload read |
| --- | ---: | ---: | ---: | ---: | --- |
| `gsd-executor` | 69 | 5,086,443 | 73,717 | 7.6 min | Medium Codex candidate |
| `gsd-phase-researcher` | 30 | 3,710,540 | 123,685 | 8.4 min | Medium Codex candidate if bounded |
| `gsd-planner` | 36 | 3,573,072 | 99,252 | 6.8 min | Medium Codex candidate if bounded |
| `gsd-plan-checker` | 30 | 2,602,400 | 86,747 | 4.1 min | High Codex candidate |
| `gsd-verifier` | 22 | 1,534,986 | 69,772 | 4.4 min | High Codex candidate |
| `sgsd-code-reviewer` | 18 | 780,342 | 43,352 | 1.7 min | High Codex candidate |

This says three things:

1. Researcher is the most expensive non-execution role by average call.
2. Planner is nearly as expensive and likely has the same context problem.
3. Plan-checker, verifier, and reviewer are strong offload candidates because
   they are bounded checking tasks with explicit acceptance contracts.

## v1.8 Researcher Case Study

Sampled v1.8 phase researcher calls:

| Phase | Total | Cache read | Output | Tools | Reads | Search | Shell | Lines added |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 36 | 171,175 | 169,326 | 1,186 | 31 | 19 | 5 | 5 | 1,522 |
| 37 | 223,305 | 221,331 | 1,080 | 37 | 20 | 0 | 14 | 2,597 |
| 38 | 214,031 | 211,645 | 2,116 | 45 | 23 | 11 | 9 | 1,806 |
| 39 | 214,301 | 211,844 | 1,521 | 44 | 19 | 5 | 16 | 2,313 |
| 40 | 122,437 | 120,416 | 1,378 | 22 | 8 | 0 | 12 | 1,623 |

Cache-read share:

| Phase | Cache-read share |
| ---: | ---: |
| 36 | 98.9 percent |
| 37 | 99.1 percent |
| 38 | 98.9 percent |
| 39 | 98.9 percent |
| 40 | 98.3 percent |

This is the key proof point. The researcher did not spend most tokens on new
output or reading files. It spent them carrying existing context.

## What The Researcher Actually Read

The clearest sample is Phase 40. The researcher did not use VTP or MCP. It used
local repo scans and local files.

Direct files read during the Phase 40 researcher window:

- `.planning/milestones/v1.8/REQUIREMENTS.md`
- `.planning/discussions/2026-04-26-mass-discuss.md`
- `super-gsd/skills/sgsd-complete-milestone/SKILL.md`
- `.planning/ROADMAP-AGENT.md`, around the Phase 40 block
- `super-gsd/tools/gate-keep-kill/rubric.cjs`
- `super-gsd/tools/system-map/generate.cjs`, first section
- `super-gsd/tools/system-map/generate.cjs`, second section
- `.planning/milestones/v1.8/phases/40-phase-folder-audit/40-RESEARCH.md`
  after writing

Shell/list/grep activity during the same researcher run:

- Listed the Phase 40 folder.
- Grepped `ROADMAP-AGENT.md` for the Phase 40 block.
- Listed prior phase folders under v1.7 and v1.6.
- Grepped `system-map/generate.cjs` for self-test and fingerprint behavior.
- Grepped `sgsd-complete-milestone/SKILL.md` for milestone-close steps.
- Wrote `40-RESEARCH.md`.
- Checked line count and ASCII safety.

The resulting Phase 40 source list named many prior folders and files:

- v1.7 phase 31
- v1.7 phase 35
- v1.6 phase 26
- v1.8 phase 39
- v1.5 phase 21
- v1.6 phase 28
- `gate-keep-kill/rubric.cjs`
- `system-map/generate.cjs`
- `sgsd-complete-milestone/SKILL.md`
- v1.8 requirements
- mass discussion
- roadmap agent

This was local archaeology. It was not VTP-driven research.

## VTP Status

The SGSD config currently contains:

```json
"vtp_enrichment": {
  "enabled": false,
  "challenger_mode": false,
  "granularity": "tier-based",
  "empty_hit_policy": "continue",
  "max_queries_per_gate": 5,
  "query_seed_max_tokens": 800
}
```

The workflow section has `triage_vtp_enrichment: true`, but the actual
`vtp_enrichment.enabled` flag is false. That means the ordinary phase flow will
skip VTP enrichment. This matches the sampled researcher evidence.

The orchestrator skill has a VTP path, but it is gated:

- Step 3.7 probes VTP only when config enables it.
- Step 6.b dispatches `gsd-phase-researcher`.
- Step 6.b.5 dispatches `sgsd-vtp-enrichment` only if enabled and healthy.

So the answer to "is the researcher using MCP VTP?" is: not in the sampled
v1.8 researcher runs. It is reading local files and phase folders.

## Artifact Bloat

v1.8 phase research files:

| Phase | Research lines |
| ---: | ---: |
| 36 | 564 |
| 37 | 571 |
| 38 | 643 |
| 39 | 536 |
| 40 | 519 |

v1.8 phase plan files:

| Phase | Plan lines |
| ---: | ---: |
| 36 | 1,212 |
| 37 | 714 |
| 38 | 1,394 |
| 39 | 842 |
| 40 | 867 |

These files are too long to be used as default future context. They are useful
as audit artifacts, but bad as working memory. If later phases read these files
directly, every phase inherits hundreds or thousands of lines of historical
detail when it only needs a few facts:

- What changed?
- What contract was introduced?
- What files are canonical?
- What tests prove it?
- What defects remain?
- What future phases must respect?

## Why This Happens

### Root Cause 1: Inherited Session Context

The researcher prompt may be short, but the agent call appears to inherit the
large active Claude session context. The evidence is the token shape:

```text
Phase 40 researcher:
total tokens:      122,437
cache read:        120,416
output:              1,378
local file reads:         8
```

This is not proportional to the actual work. It is proportional to inherited
context size.

### Root Cause 2: Context Contract Exists, But Is Not Enforced

The orchestrator skill already says the right things:

```text
DO NOT read full files. DO NOT load ROADMAP.md every loop.
Frontmatter and sgsd-recall results are your context.
```

It also says:

```text
After 5 reports in active context, compress older reports to ONE_LINERs.
Never hold full report text for more than 2 completed iterations.
```

But the measured behavior shows this is not enforced by runtime mechanics.
Rules in a markdown skill are not enough. SGSD needs a mechanical context gate
that builds and logs the exact packet sent to the agent.

### Root Cause 3: Phase Close Does Not Produce A Compact Capsule

Each phase closes with rich docs, reviews, plan files, and verification files.
That is good for auditability. It is bad for retrieval if every future phase
has to rediscover the important facts from raw folders.

The missing artifact is a compact phase capsule:

```text
Phase N closed. Here are the 12 facts future phases need.
```

Without that, the next researcher scans old phase folders.

### Root Cause 4: Researcher Is Doing Too Much

The researcher is currently acting as:

- context finder
- source scanner
- historian
- systems analyst
- requirements reconciler
- artifact writer

Those are separable jobs. Most should be deterministic retrieval and indexing,
not LLM reading.

### Root Cause 5: VTP Is Separate From Normal Research

VTP enrichment exists, but it is a separate gated step and is currently
disabled. Normal phase research does not use VTP as its primary retrieval
substrate. So the researcher falls back to repo scans.

## What Redis Would Actually Help With

Redis will not reduce token use by existing. It reduces token use only if SGSD
uses it to avoid sending broad context to the model.

Redis can help with:

- fast lookup of phase capsules
- live cockpit state
- token counters by agent, phase, milestone, and role
- cached context packets
- file hash to summary mappings
- VTP query result cache
- "what changed since last phase" lookups
- streams of agent events for audit and live UI

Redis does not help with:

- a sub-agent that receives the full session anyway
- long markdown reports being passed as context
- vague prompts that ask the model to "go research"
- missing sign-off capsules
- using memory as a second source of truth

Recommended rule:

```text
Git/JSONL files remain canonical.
Redis/Valkey is an ephemeral acceleration layer.
SQLite FTS is the durable local index.
Context packets are the only model input contract.
```

## Redis/Valkey Key Design

If SGSD adds Redis or Valkey, use it for live lookup and counters:

```text
sgsd:phase:v1.8:40:capsule
  hash: phase, milestone, status, goal, outputs_json, tests_json,
        debt_json, source_hash, created_at

sgsd:context:v1.9:P41:researcher
  string: exact compiled prompt packet
  ttl: 24h

sgsd:file-summary:<sha256>
  hash: path, sha256, summary, exports_json, tags_json, token_estimate

sgsd:tokens:agent
  sorted set: member=agent_type, score=total_tokens

sgsd:tokens:phase
  sorted set: member=v1.8/P40/gsd-phase-researcher, score=122437

sgsd:events
  stream: agent_start, agent_done, codex_review, gate_fire, gate_skip

sgsd:vtp:<query_hash>
  string/json: compact VTP result bundle
  ttl: 7d
```

Do not store secrets. Do not store full Claude transcripts by default. Do not
make Redis the only copy of anything that matters.

## Better Than Redis For Some Parts

Redis is not the only answer.

| Need | Best fit | Why |
| --- | --- | --- |
| Durable local search over phase capsules | SQLite FTS5 | No server, source-controlled schema, excellent enough for local repo search |
| Live cockpit counters and active agent state | Redis/Valkey | Low latency, streams, sorted sets, easy TTL |
| Large analytical audit over tokens | DuckDB or SQLite | Better for aggregates than Redis |
| Semantic retrieval over many summaries | Qdrant/Chroma/LanceDB | Only if keyword/capsule retrieval fails |
| Canonical audit trail | JSONL in git/worktree | Append-only, inspectable, diffable |

Suggested default:

1. Start with JSONL canonical plus SQLite FTS.
2. Add Redis/Valkey only for cockpit/live caches and token counters.
3. Add vector search only after capsules prove keyword retrieval is insufficient.

## Phase Close Capsule Design

Add this at every phase close:

```text
.planning/milestones/{milestone}/phases/{phase-name}/PHASE-CAPSULE.json
.planning/milestones/{milestone}/phases/{phase-name}/PHASE-CAPSULE.md
.planning/milestones/{milestone}/PHASE-INDEX.jsonl
```

`PHASE-CAPSULE.json` should be compact and machine-readable:

```json
{
  "schema_version": 1,
  "milestone": "v1.8",
  "phase": 40,
  "phase_name": "Phase Folder Audit",
  "status": "PASS",
  "goal": "Add a canonical phase-folder audit and wire it into milestone close.",
  "why_it_matters": "Future phases can validate folder shape without manual archaeology.",
  "outputs": [
    {
      "kind": "tool",
      "path": "super-gsd/tools/phase-folder-audit/audit.cjs",
      "contract": "auditAllPhases(root, options) returns pass/fail rows"
    }
  ],
  "files_changed": [
    "super-gsd/tools/phase-folder-audit/audit.cjs",
    "super-gsd/skills/sgsd-complete-milestone/SKILL.md"
  ],
  "tests_run": [
    "node super-gsd/tools/phase-folder-audit/audit.cjs --self-test"
  ],
  "gates": {
    "claude_atc": "PASS",
    "codex_atc": "PASS",
    "verifier": "PASS"
  },
  "debt": {
    "critical": 0,
    "warnings": 0,
    "edge_guard_miss": 0,
    "deferred": 0
  },
  "reusable_patterns": [
    "Audit tool exposes library API and CLI self-test.",
    "Milestone close embeds deterministic local check."
  ],
  "future_constraints": [
    "Do not add a second phase folder schema without updating audit.cjs."
  ],
  "source_hashes": [
    {
      "path": "super-gsd/tools/phase-folder-audit/audit.cjs",
      "sha256": "..."
    }
  ],
  "token_cost": {
    "researcher": 122437,
    "planner": null,
    "executor": null,
    "reviewer": null
  }
}
```

`PHASE-CAPSULE.md` should be for humans:

```markdown
# Phase 40 Capsule

Goal: Add a canonical phase-folder audit and wire it into milestone close.
Result: PASS.
Main output: phase-folder-audit/audit.cjs plus milestone close integration.
Future phases need to know: use auditAllPhases; do not rescan phase folders manually.
Debt: none.
```

`PHASE-INDEX.jsonl` is one row per phase:

```json
{"milestone":"v1.8","phase":40,"status":"PASS","capsule":"phases/40-phase-folder-audit/PHASE-CAPSULE.json","tags":["audit","milestone-close","folder-contract"],"exports":["auditAllPhases"],"debt":0}
```

Future researcher flow:

1. Read `PHASE-INDEX.jsonl`.
2. Select only matching capsules.
3. Read at most 3 capsules.
4. Read raw files only if capsule source hash is stale or capsule says raw file is required.

This replaces "scan old phase folders" with "read compact signed facts".

## Context Packet Design

Every sub-agent should receive an explicit context packet written to disk before
dispatch:

```text
.planning/metrics/context-packets/{timestamp}-{role}-v1.9-P41.md
```

Packet shape:

```markdown
---
schema_version: 1
milestone: v1.9
phase: 41
role: gsd-phase-researcher
max_input_tokens: 20000
source_count: 6
source_hash: ...
---

# Mission
One sentence.

# Current Phase
Goal in one sentence.
Acceptance in 3-5 bullets.

# Locked Decisions
Only decisions relevant to this phase.

# Prior Capsules
3-8 short capsule excerpts.

# Files You May Read
Allowlist with reason per file.

# Output Contract
Max 120 lines. Must include findings, risks, and next-plan inputs.
```

Hard rule:

```text
If the packet is over budget, the orchestrator must compact it before dispatch.
The agent must not receive broad session context as a substitute for the packet.
```

## Role-Specific Budget Policy

Set budgets by role, not by hope:

| Role | Default max | Notes |
| --- | ---: | --- |
| `gsd-phase-researcher`, local audit phase | 20k | Skip entirely if capsules are enough |
| `gsd-phase-researcher`, novel architecture phase | 60k | VTP allowed if enabled |
| `gsd-planner`, mechanical phase | 30k | Use capsule plus current goal |
| `gsd-planner`, novel phase | 50k | Output max 300 lines |
| `gsd-plan-checker` | 20k | Codex primary candidate |
| `gsd-verifier` | 25k | Codex primary candidate |
| `sgsd-code-reviewer` | 30k | Codex primary candidate |
| `gsd-executor` | 80k | Keep Claude unless patch is deterministic and scoped |

Waste detector:

```text
if cache_read_input_tokens > 50000 and output_tokens < 5000:
  write token_waste row:
    kind: inherited_context_over_budget
    role: agent_type
    phase: phase
    cache_read: N
    output: N
    required_action: isolated_dispatch_or_context_packet
```

For the sampled v1.8 researcher rows, every one of P36-P40 would fire this
waste detector.

## Researcher Skip And Downshift Rules

The researcher should not run by default on every phase.

Skip researcher when all are true:

- phase has a clear goal in requirements or roadmap
- phase is local/mechanical audit or wiring
- prior phase capsules identify the relevant surface
- no external/domain knowledge is needed

Downshift researcher to deterministic local scan when:

- it only needs file inventory
- it only needs exported symbol lookup
- it only needs existing contract lookup

Use VTP researcher when:

- phase introduces a policy, architecture, or evaluation concept
- phase requires cross-domain reasoning
- phase asks "how should SGSD decide" rather than "wire this known contract"

Use Codex instead of Claude researcher when:

- all sources are local files
- output contract is factual and bounded
- expected work is summarize/diff/classify, not ambiguous design judgment

## Codex Offload Strategy

Codex proved high value in v1.8 reviews. It caught CRITs that Claude-only
review missed or underweighted.

Observed v1.8 review value:

| Phase | Claude ATC | Codex ATC | Why it matters |
| ---: | --- | --- | --- |
| 36 | 1 CRIT, 4 WARN | 2 CRIT, 3 WARN | Codex caught stale status and signal corruption issues |
| 37 | 0 CRIT, 5 WARN | 1 CRIT, 2 WARN | Codex flagged a literal NUL/source integrity issue |
| 38 | 1 CRIT, 4 WARN | 2 CRIT, 1 WARN | Codex caught v2/cache risk path failures |
| 39 | 0 CRIT, 4 WARN | 1 CRIT, 4 WARN | Codex caught milestone-window edge-guard bug |

This suggests:

- Keep Codex in review/checking.
- Expand Codex to plan-checker/verifier for bounded contracts.
- Do not blindly move executor to Codex; use it for deterministic local patches
  only when the write set is tight.
- Trial Codex researcher on local-only phases using context packets and compare
  token/cost/outcome.

## File Summary Cache

Add a content-addressed summary cache:

```text
.planning/context-cache/file-summaries.jsonl
```

Row shape:

```json
{
  "schema_version": 1,
  "path": "super-gsd/tools/system-map/generate.cjs",
  "sha256": "...",
  "mtime": "2026-04-27T...",
  "summary": "Generates deterministic system map and fingerprint.",
  "exports": ["generateSystemMap", "selfTest"],
  "relevant_phases": ["35", "40"],
  "token_estimate": 280,
  "created_by": "context-summarizer"
}
```

When the hash matches, the researcher gets the summary, not the full file.
When the hash changes, SGSD regenerates the summary.

## Concrete Implementation Plan

### Stage 1: Token Guard

Add a guard to `super-gsd/tools/token-attribution/collect.cjs` or a sibling
`token-waste/check.cjs`:

- reads `token-attribution.jsonl`
- flags role calls over budget
- flags cache-read dominated calls
- writes `.planning/metrics/token-waste.jsonl`
- returns non-zero only in audit mode, not auto mode

Acceptance:

```powershell
node super-gsd/tools/token-waste/check.cjs --self-test
node super-gsd/tools/token-waste/check.cjs --phase 40
```

### Stage 2: Phase Capsule Writer

Create:

```text
super-gsd/tools/phase-capsule/write.cjs
```

It should ingest:

- `STATE.md`
- phase `*-VERIFICATION.md`
- `*-ATC-REVIEW.md`
- `commit-reviews.jsonl`
- `token-attribution.jsonl`
- git diff/file list for the phase commits

It should write:

- `PHASE-CAPSULE.json`
- `PHASE-CAPSULE.md`
- milestone `PHASE-INDEX.jsonl`

Acceptance:

```powershell
node super-gsd/tools/phase-capsule/write.cjs --phase 40 --dry-run
node super-gsd/tools/phase-capsule/write.cjs --self-test
```

### Stage 3: Context Packet Builder

Create:

```text
super-gsd/tools/context-packet/build.cjs
```

Inputs:

- role
- milestone
- phase
- phase goal
- relevant capsules
- file summary rows
- optional VTP evidence bundle

Outputs:

- a packet markdown file
- packet metadata row in `.planning/metrics/context-packets.jsonl`
- estimated token count

Hard acceptance:

```text
Research packet for local audit phase <= 20k tokens.
Planner packet for mechanical phase <= 30k tokens.
Every packet logs source paths and source hashes.
```

### Stage 4: Isolated Dispatch

Change sub-agent dispatch so cheap/bounded roles can run outside the inherited
session context:

```text
claude --print --dangerously-skip-permissions -p "@context-packet.md"
codex exec --prompt-file context-packet.md
```

Use isolated dispatch first for:

- `gsd-plan-checker`
- `gsd-verifier`
- `sgsd-code-reviewer`
- local-only `gsd-phase-researcher`

Keep ordinary Claude agent dispatch for:

- ambiguous design decisions
- high-risk executor work
- tasks requiring strong continuity with current operator conversation

### Stage 5: Redis/SQLite Index

Start with SQLite FTS:

```text
.planning/context-cache/context.db
```

Tables:

- `phase_capsules`
- `file_summaries`
- `token_costs`
- `agent_events`

Then add Redis/Valkey only if cockpit/live performance needs it:

- active agent state
- token counters
- recent event streams
- cached context packets

## What P40 Would Look Like After The Fix

Current P40 researcher:

```text
122,437 tokens
120,416 cache-read tokens
8 file reads
12 shell calls
519-line RESEARCH.md
```

Target P40 researcher:

```text
0 tokens if skipped by capsule rules
or <= 20,000 tokens if context packet required
context packet includes:
  - v1.8 requirements excerpt
  - Phase 35 capsule
  - Phase 39 capsule
  - summary of system-map/generate.cjs
  - summary of sgsd-complete-milestone Step 4/5
output <= 120 lines
```

Expected saving for P40 alone:

```text
102k-122k tokens saved depending on skip vs bounded packet.
```

Expected saving across v1.8 P36-P40 researcher calls:

```text
Current researcher spend: 945,249 tokens
Target at 20k each:       100,000 tokens
Likely saving:            ~845,000 tokens
```

That is just researcher. Similar savings likely exist in planner/checker.

## Sign-Off Structure To Prevent Re-Scanning

Every phase close should produce these five artifacts:

```text
PHASE-CAPSULE.json       machine-readable compact truth
PHASE-CAPSULE.md         human-readable short truth
PHASE-INDEX.jsonl        milestone-level lookup row
TOKEN-COST.json          per-agent cost row for this phase
SOURCE-SUMMARY.jsonl     changed-file summaries keyed by sha256
```

The close gate should reject missing capsules. It should not reject open debt in
auto mode, but it should clearly mark status.

Suggested close order:

1. Run verification.
2. Run ATC/Codex review.
3. Write or update backlog rows.
4. Write token-cost row.
5. Write file summaries for changed files.
6. Write phase capsule.
7. Append milestone phase index row.
8. Run status consistency.

Future phases should read the capsule/index first. Raw files are fallback only.

## Cockpit Implication

The cockpit should show this as a first-class metric:

```text
TOKEN WASTE
Researcher P40: 122k total / 120k inherited / 1.4k output
Action: next researcher must use packet or skip
```

The cockpit should also show:

- current context packet size
- last agent token spend
- top spend by role this milestone
- token waste rows open
- whether current role is using VTP, capsule, Redis/SQLite, or raw scan

This answers the operator question: "what is it spending tokens on?"

## Risks And Non-Goals

Do not solve this by blindly turning on more memory.

Risks:

- Redis becomes a second truth source.
- Semantic/vector memory retrieves irrelevant old decisions.
- Long summaries become a new form of bloat.
- Agents trust stale cached summaries without source hashes.
- Auto mode blocks on cache service availability.

Controls:

- canonical truth stays in git/jsonl
- Redis and SQLite are rebuildable
- every summary has source hash
- context packets are logged
- agents disclose context source mix
- auto mode degrades if cache is unavailable

## Acceptance Criteria

This problem is not fixed until these are true:

1. Every sub-agent call logs exact token usage by agent, phase, role, and
   cache-read share.
2. Every phase close writes a phase capsule.
3. Every researcher/planner/checker/verifier receives a logged context packet.
4. Local-audit researcher calls stay below 20k tokens or are skipped.
5. Any agent call with cache-read over 50k and output under 5k writes a
   token-waste row.
6. Normal phase research declares whether it used VTP, capsules, local raw
   files, Redis/SQLite, or public fallback.
7. Future phases can answer "what did Phase N ship?" from a capsule without
   reading raw phase folders.
8. Cockpit displays agent token spend and token waste in the operator view.

## Recommendation

Do not start with Redis. Start with the phase capsule and context packet
contracts, because those directly reduce what gets sent to models.

Then add SQLite FTS for durable local retrieval over capsules and file
summaries.

Then add Redis/Valkey for live cockpit state, counters, and packet caches if
the UI or live loop needs it.

The SpaceX-style pruning target is:

```text
Every phase artifact must either:
  - be canonical source of truth,
  - be a compact future-facing capsule,
  - be a rebuildable cache,
  - or be deletion/pruning eligible.
```

The current researcher pattern fails that bar because it repeatedly consumes
historical artifacts that were not shaped for reuse.

