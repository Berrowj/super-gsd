# P146 Planning — author 146-01-PLAN-LOCKED.md (schema-v2)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

You are the planner. Author ONE plan file and nothing else. Write it to:
`.planning/milestones/v3.5/phases/146-session-governance-hooks/146-01-PLAN-LOCKED.md`
If the sandbox cannot write files, emit the COMPLETE file content on stdout
inside a single fenced block and say so — the orchestrator will persist it.

BUDGET: do NOT re-derive the research. Do NOT run self-tests. Do NOT explore
beyond the required reading. Produce the plan.

## Required reading (read these, in order)
1. `.planning/milestones/v3.5/phases/146-session-governance-hooks/CONTEXT.md`
2. `.planning/milestones/v3.5/phases/146-session-governance-hooks/146-RESEARCH.md`
   — treat its Q1–Q9 answers, file list, reuse inventory, task decomposition
   and verification commands as authoritative findings.
3. `.planning/milestones/v3.5/phases/146-session-governance-hooks/146-VTP-ENRICHMENT.md`
   — 4 planner directives at the bottom are binding.
4. `super-gsd/templates/plan-schema-v2.json` — the plan MUST validate.
5. `.planning/milestones/v3.5/phases/145-codex-profile-control/145-01-PLAN-LOCKED.md`
   — use as the SHAPE reference (frontmatter keys, task structure, tone).

## Source Audit (mandatory section in the plan)
Include a row per source: CONTEXT, RESEARCH, VTP-ENRICHMENT (status success,
2 relevant hits), plan-schema-v2, P145 plan. VTP is present — cite it, do not
write a VTP_STATUS unavailable row.

## Hard requirements for the plan

**Schema (SCHEMA-09/-10, DLB-07):** YAML frontmatter validating against
plan-schema-v2.json, INCLUDING `semantic_acceptance_criteria` with REAL-DATA
criteria (a plan whose ACs are only structural/grep-shaped cannot close).
Include `rollback_plan`. Every task needs id, hypothesis, files_touched, type.

**Board-binding constraints (from CONTEXT — violating any is a plan defect):**
- NO edit-seam blocking anywhere. PostToolUse gate is REPORT-ONLY.
- Every hook: narrow try/catch; unexpected error → exit 0 + logged failure row.
- Hooks must exit 0 in a non-SGSD repo (root-walk finds no `.planning/` → quiet 0).
- No hook may read `~/.claude/settings.json` env block (live API keys).
- Repo-local `.claude/settings.json` only — NEVER write to `~/.claude/settings.json`.
- Paths resolved at INSTALL time from the target repo; no hardcoded machine paths.
- Classifier: local node, NO LLM, <1s p95 (VTP: ms-level is the real bar).

**VTP directives (binding):** declarative registry-driven rule shape so the
P149 skill-routing.yaml swap is a one-line change; latency bench is a real
task with a recorded number; classifier ROUTES, never judges; AC-146c is
incomplete without a cockpit reader — keep that wiring in this phase.

**Decide these open questions explicitly in the plan (RESEARCH §7):**
- Canonical STATE frontmatter phase key (research notes STATE currently lacks
  `current_phase`; the frontmatter has `milestone:` + prose `status:`). Pick
  one and state how the resolver degrades when absent.
- `gate-evidence.jsonl` as a new stream vs extending `gate-value-log.jsonl`.
- Install-time absolute paths vs `${CLAUDE_PROJECT_DIR}`.
- Confirm the real mutation tool names in this harness before matching on them
  (do NOT assume `MultiEdit` exists).

## Task decomposition
Follow RESEARCH §5 (6 tasks) unless you have a concrete reason to differ —
state the reason if you do. Each task: independently verifiable, deterministic
Windows-safe verification command (no chmod reliance, no network), and traced
to an AC-146 letter.

## Deferred items to record in the plan (carried from P145, do NOT solve here)
DEFERRED-A selfTestCliGuard non-TTY forcing; DEFERRED-B 3-way CLI-default
drift guard; DEFERRED-C inert trust/hook resolver fields (→P148/P150);
DEVIATION-1 codex-exec finalize probe simplification;
DEVIATION-W codex-exec enforces the 5-line ATC contract on every `--step`
(research/spec-review dispatches exit 6 and dump multi-MB raw streams) —
CONSIDER folding this into the phase's "cheap fixes" task if it is genuinely
a few lines in `codex-exec.sh`; if not, record it as deferred.

Output: the plan file only.
