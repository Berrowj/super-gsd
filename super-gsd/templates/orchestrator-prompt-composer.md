# Orchestrator Prompt Composition Guide

How the orchestrator builds Codex-first prompts with SGSD memory context.

## Composition Steps

### 1. Classify From Plan Evidence

Use plan frontmatter, cached classifier sidecars, and local deterministic checks.
Do not spawn Haiku/Sonnet for classification on a fresh clone.

Expected classifier shape:

```json
{
  "complexity": "trivial|simple|standard|complex",
  "model": "codex|opus",
  "atc_tier": "light|full",
  "deliberate": false,
  "reason": "brief evidence-based rationale"
}
```

### 2. Select Context

Derive context from the active plan, relevant files, and recent SGSD state.

Expected context shape:

```json
{
  "sgsd_recall_queries": ["scripts provider health", "memory migration"],
  "file_reads": ["relative/path.ext"],
  "error_rules": [],
  "scripts_to_check": ["provider health check"]
}
```

### 3. Execute SGSD Memory Queries

For each `sgsd_recall_query`:

```bash
super-gsd/scripts/sgsd-recall.sh "{query_string}" --limit 3
```

Collect results at roughly 200 tokens each. Prefer `.planning/memory/`; the
recall script may use read-only legacy fallback for unmigrated BRV projects.

For each `scripts_to_check` entry:

```bash
super-gsd/scripts/sgsd-recall.sh "scripts {purpose}" --type script --limit 2 --paths-only
```

Format matches as:

```text
EXISTING: {path} - {80-char purpose}
```

Skip empty matches. Do not inject empty placeholder blocks.

### 4. Read Minimal Files

For each file read:

```text
Read(file_path, offset=0, limit=50)
```

Read only the required region, not full files by default.

### 5. Compose Final Prompt

Executor template:

```text
{compressed_plan_xml}

{executor_overlay with placeholders filled:
  EXISTING_SCRIPTS = one "EXISTING: {path} - {80-char purpose}" per match, or "none"
  RELEVANT_DECISIONS = sgsd-recall decision results
  RELEVANT_PATTERNS = sgsd-recall pattern results
  ERROR_RULES = sgsd-recall error rule results
}

<files_to_read>
{file_reads from context selector}
</files_to_read>
```

Planner template:

```text
Phase {N}: {goal}
Requirements: {requirement IDs}
Success criteria: {from ROADMAP}

{planner_overlay with placeholders filled}

{CONTEXT.md key sections if they exist}
```

Verifier template:

```text
Phase {N}: {goal}
Plans executed: {list}
Must-haves: {from ROADMAP success criteria}

{verifier_overlay}
```

### 6. Dispatch

Codex owns research, planning, source-changing execution, verification, ATC,
MUDA, and plan checks. Sonnet/Haiku are legacy-disabled and must not be used as
fresh-clone fallbacks.

```text
codex-exec.sh --role "{role}" --plan "{plan_id}" --reasoning xhigh
```

### 7. Process Report

Parse structured report:

- FILES_CHANGED -> track for commit
- VERIFICATION -> validate all passed
- DEVIATIONS -> log for phase summary
- BLOCKERS -> exit only if no local/degraded/Codex path remains
- SCRIPTS_CREATED -> curate to SGSD memory scripts/
- ONE_LINER -> commit message
- CURATE_* -> curate discoveries to SGSD memory

### Token Budget Check

Estimate total tokens:

- Plan XML: count words * 1.3
- Overlay: ~80 tokens
- SGSD memory results: ~200 per query * N queries
- file_reads: sum of lines * ~2 tokens/line

Target: under 1,500 prompt tokens. If over budget, trim file reads first, then
recall results. Never trim the plan below its required success criteria.
