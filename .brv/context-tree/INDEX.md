# SGSD Context Tree Index

<!--
Tier: orchestrator-global · Scope: all-projects
Retrieval: super-gsd/scripts/sgsd-recall.sh "query terms"
Curation:  super-gsd/scripts/sgsd-curate.sh --type pattern --slug ... --summary "..."

This index is grep-friendly: one row per .md file under .brv/context-tree/,
ordered by directory. Summaries are ≤80 chars so a Haiku classifier can scan
the whole corpus in <2k tokens. DON'T paste file bodies here — sgsd-recall
reads them on demand.

When adding a file: update this index atomically via sgsd-curate.sh. If you
edit an existing file's topic, update the corresponding row here in the same
commit. Stale rows are the failure mode this index is meant to prevent.

Schema: | type | slug | path | summary |
-->

## patterns

| type | slug | path | summary |
|------|------|------|---------|
| pattern | orchestrator-patterns | patterns/orchestrator-patterns.md | Lean state machine: read state → classify → dispatch → process → commit → loop |
| pattern | cold-start-runbook | patterns/cold-start-runbook.md | Step-by-step session restart: cold-start (no checkpoint) vs warm-resume paths |
| pattern | commit-discipline | patterns/commit-discipline.md | Atomic commits after every unit — never batch, never skip, never amend |
| pattern | model-routing-rules | patterns/model-routing-rules.md | When to use Opus vs Sonnet vs Haiku for orchestrator/classifier/executor roles |
| pattern | script-registry-patterns | patterns/script-registry-patterns.md | Query before creating new utilities — reuse existing scripts from context-tree |
| pattern | token-efficiency-expertise | patterns/token-efficiency-expertise.md | Prompt compression, frontmatter-only reads, 300-word agent reports |

## anti-patterns

| type | slug | path | summary |
|------|------|------|---------|
| anti-pattern | premature-stopping | anti-patterns/anti-patterns-premature-stopping.md | Auto loop must never pause between phases — only 4 valid exit conditions |

## decisions

| type | slug | path | summary |
|------|------|------|---------|
| decision | pi-death-migration | decisions/pi-death-migration.md | PI harness retirement decision — why Super GSD replaced it |
| decision | rejected-ideas | decisions/rejected-ideas.md | Features evaluated and explicitly rejected (backroom channels, graph engine, etc.) |

## expertise

| type | slug | path | summary |
|------|------|------|---------|
| expertise | cross-domain-validation | expertise/cross-domain-validation.md | Research from other domains that validates SGSD architecture choices |
| expertise | deliberation-expertise | expertise/deliberation-expertise.md | CEO/Board deliberation patterns — when to spawn, how to synthesize |
| expertise | gsd-workflow-expertise | expertise/gsd-workflow-expertise.md | Core GSD workflow semantics — milestones, phases, plans, verification |

## scripts

| type | slug | path | summary |
|------|------|------|---------|
| script | brv-query-local | scripts/nodejs/brv-query-local.md | Local BM25 query engine over context-tree (superseded by sgsd-recall; DLB-01) |
| script | brv-curate-local | scripts/nodejs/brv-curate-local.md | Local curate writer (superseded by sgsd-curate.sh; DLB-01) |

## test fixtures

| type | slug | path | summary |
|------|------|------|---------|
| test | test-entry | patterns/test/test-entry.md | Smoke-test entry — skip in production retrieval |
| test | smoke-test-entry | scripts/nodejs/smoke-test-entry.md | Smoke-test entry — skip in production retrieval |
| test | test | scripts/test/test.md | Smoke-test entry — skip in production retrieval |
