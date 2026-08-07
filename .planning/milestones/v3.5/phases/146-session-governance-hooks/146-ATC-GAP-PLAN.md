# P146 Phase-ATC Gap Plan — GATE_AUTO_HALT

phase_atc: 146-ATC-REVIEW.md (openai-codex gpt-5.5/xhigh)
verdict: FINDINGS 6 / CRITICAL 3 / WARNINGS 3 / PASS_RATE 4/10
one_liner: "hooks work as patches, but root/write validation and registry/ledger
degradation are not structurally solved"

The reviewer answered the question posed to it — is the code structurally
immune to this phase's two recurring defect classes, or merely patched at each
discovered site? Answer: **patched**. That is the finding that matters.

## CRIT-1 — root/write containment is not ONE contract (5th instance of defect class 1) → FIX
`sgsd-session-start.js` added realpath checks, but `findSgsdRoot`
(`sgsd-state.cjs`) accepts `.planning` via `statSync`, and `logGateEvidence`
derives `.planning/metrics/gate-evidence.jsonl` without no-symlink/realpath
containment. The intent classifier and quality gate both call the weaker
resolver path. Each site was hardened when found; the CONTRACT was never
unified. Fix: one containment helper in `sgsd-state.cjs`, used by every writer.

## CRIT-2 — "quality gate does not fire for MultiEdit" → **REJECTED, with evidence**
There is NO `MultiEdit` tool in this harness. Evidence:
1. This orchestrator session's own available tool set is `Edit`, `Write`,
   `NotebookEdit` — no `MultiEdit`. The session IS the harness.
2. Research Q1 documented Claude Code `2.1.222` PostToolUse payloads and never
   lists it; research Q9 explicitly said "verify actual mutation tool names in
   this harness before including MultiEdit".
3. Repo-wide references to `MultiEdit` exist ONLY under
   `~/.claude/file-history/` (historical file snapshots), never in live config.
4. The locked plan names it as an explicit FALSIFIER: the task fails if it
   "includes MultiEdit".
Implementing this finding would introduce a matcher for a non-existent tool AND
violate the plan. Rejected.
Residual worth noting: source can also be mutated via `Bash` redirection, which
PostToolUse Edit/Write/NotebookEdit matching will not see. Matching `Bash` on
every command would be prohibitively noisy; recorded as a known coverage
boundary of AC-146c, not a defect. → DEFERRED-F (revisit in P147 commit-seam
gate, which observes the commit rather than the edit).

## CRIT-3 — corrupt-but-parseable registry, at ROUTE level (7th silent-success) → FIX
The gap-fix closed zero-route-COUNT. But the hand parser accepts any `id`, and
invalid trigger/enforcement shapes are silently coerced to empty lists or
skipped directives. So a registry with N structurally-valid-looking routes whose
triggers are all malformed yields zero matches and NO degraded row — prompt
governance silently off. Fix: validate route SHAPE, and treat
"routes present but none usable" as degraded with a distinct reason code.

## WARN-1 — ledger silently drops malformed JSONL lines → FIX
`gate-evidence-log.cjs` skips unparseable lines; the adapter only detects the
all-or-nothing case. A partially corrupt or tampered ledger reads as healthy
while evidence disappears. Fix: count skipped lines and surface a non-zero
skipped count as a degraded signal.

## WARN-2 — active-phase plan detection ignores milestone scope → FIX
The quality gate reads `state.milestone` but calls
`findPlanLockedFiles(root, state.phase)`, and the helper searches ALL
milestones. A stale same-numbered PLAN-LOCKED in a previous milestone therefore
suppresses missing-plan evidence for the active one. Genuine correctness bug.
Fix: scope the lookup to the active milestone.

## WARN-3 — SessionStart contract bloat on every session → DEFERRED-G
The injected block plus raw checkpoint frontmatter is prepended to the first
turn of EVERY session in the repo, forever. Reviewer recommends trimming to
active state + terse gate pointers, with the tier/gate tables moved to a
referenced artifact. Real always-on token cost, but it is a content/UX decision
rather than a correctness defect, and trimming it wrongly would weaken the
governance contract this phase exists to deliver. → P147.

## Deferred ledger after this phase
- DEFERRED-F: Bash-redirection source mutations invisible to PostToolUse (→P147)
- DEFERRED-G: SessionStart contract trim / move tables to referenced artifact (→P147)
- DEVIATION-W (carried from P145): codex-exec enforces the 5-line ATC contract
  on every --step, so research/verify/spec dispatches exit 6 and dump
  multi-MB raw streams that the orchestrator extracts by hand.
