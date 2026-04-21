# Phase 11: Plan Schema v2 — Index

**Goal:** Canonical YAML-frontmatter plan schema at `super-gsd/templates/plan-schema-v2.json`
with enforced required/optional fields, v1 classifier fallback, self-healing planner fix-mode,
and sha256 boot-hash drift check.

**Requirements:** SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05

---

## Plans

| Plan | File | Wave | Depends On | Goal |
|------|------|------|------------|------|
| 11-01 | `11-01-schema-file.md` | 1 | — | Write `plan-schema-v2.json` JSON Schema draft-07 |
| 11-02 | `11-02-validator-cli.md` | 1 | — | Build `validate.cjs` CJS Node CLI + package.json |
| 11-03 | `11-03-self-healing-loop.md` | 2 | 11-01, 11-02 | Planner `--fix-schema` mode + orchestrator Rule 8.5 |
| 11-04 | `11-04-boot-hash-drift.md` | 2 | 11-01, 11-02 | sha256 drift check in config.json + orchestrator cold-start |
| 11-05 | `11-05-writing-plans-hook.md` | 2 | 11-01, 11-02 | `sgsd-write-plan` skill + orchestrator classifier skip-path |

---

## Parallelization Graph

```
Wave 1 (parallel):
  11-01 ── writes plan-schema-v2.json
  11-02 ── writes validate.cjs + package.json

Wave 2 (parallel, all depend on 11-01 + 11-02):
  11-03 ── self-healing loop (planner + orchestrator)
  11-04 ── boot-hash drift check (config.json + orchestrator)
  11-05 ── write-plan skill + classifier skip-path (orchestrator)
```

Wave 1 plans share zero file overlap — fully parallel.
Wave 2 plans modify overlapping files (sgsd-orchestrate/SKILL.md appears in 11-03, 11-04, and 11-05).
Executor must serialize 11-03, 11-04, 11-05 changes to SKILL.md or merge carefully.
Recommended execution order within Wave 2: 11-03 → 11-04 → 11-05 (each reads then patches SKILL.md).

---

## Goal-Backward Rationale

**Phase 11 success requires 5 observable truths:**

| ROADMAP Criterion | Plan(s) Delivering It |
|-------------------|-----------------------|
| SCHEMA-01: plan-schema-v2.json exists with schema_version:2 + tasks[] | 11-01 |
| SCHEMA-02: required task fields enforced at plan-load time | 11-01 (schema), 11-02 (validator), 11-03 (repair loop) |
| SCHEMA-03: optional fields with documented defaults | 11-01 (defaults in JSON Schema), 11-02 (parser derivation D-02) |
| SCHEMA-04: v1 plans route through Haiku classifier; v2 plans skip | 11-05 (orchestrator Step 2) |
| SCHEMA-05: writing-plans emits v2; schema pinned identically in both repos | 11-04 (hash pin), 11-05 (sgsd-write-plan skill) |

**Every CONTEXT decision is covered:**

| Decision | Plan |
|----------|------|
| D-01 expected_ATC_tier default LITE | 11-01, 11-02 |
| D-02 prior_errors_lookup tier-derived | 11-01 (schema), 11-02 (validator derivation) |
| D-03 skip_gates default [] | 11-01, 11-02 |
| D-04 lessons_path warn+continue | 11-02 (validator step) |
| D-05 depends_on/known_deadends/verification_cmd defaults | 11-01 |
| D-06 validate.cjs at super-gsd/tools/plan-schema/ | 11-02 |
| D-07 write-time + load-time validation | 11-02 (CLI modes), 11-05 (write-time via sgsd-write-plan) |
| D-08 dual error format (stderr + plan-errors.jsonl) | 11-02 |
| D-09 fix-schema preserves task.id/goal/files_touched | 11-03 |
| D-10 3-attempt cap + checkpoint | 11-03 |
| D-11 sibling .fix-attempt-K.md staging | 11-03 |
| D-12 sha256 boot-hash check | 11-04 |
| D-13 GSDedits canonical, writing-plans consumes | 11-05 (Option B: sgsd-write-plan skill) |
| D-14 drift warn + continue + readiness-log.jsonl | 11-04 |

---

## SCHEMA-05 Option Choice: Option B (Replacement Skill)

Three options from RESEARCH.md RQ-3:

- **Option A (overlay):** LLM-compliance only. validate.cjs cannot be called mechanically.
- **Option B (sgsd-write-plan replacement skill):** Git-controlled, calls validate.cjs explicitly before Write. Full mechanical enforcement. Operator uses `/sgsd-write-plan` for SGSD plan authoring.
- **Option C (PreToolUse hook):** Requires settings.json mutation. Global CLAUDE.md rule prohibits reading/writing settings.json after the 2026-04-21 key-exposure incident.

**Chosen: Option B.** Tightest enforcement; stays within git; no settings.json risk.

---

## Source Audit

| Source | Item | Covered By |
|--------|------|------------|
| GOAL | plan-schema-v2.json canonical YAML schema | 11-01 |
| GOAL | enforced required/optional fields | 11-01, 11-02 |
| GOAL | v1 classifier fallback | 11-05 |
| GOAL | self-healing planner fix-mode | 11-03 |
| GOAL | sha256 boot-hash drift check | 11-04 |
| SCHEMA-01 | schema_version:2 + tasks[] contract | 11-01 |
| SCHEMA-02 | 9 required task fields enforced at load-time | 11-01, 11-02, 11-03 |
| SCHEMA-03 | optional fields + defaults documented | 11-01, 11-02 |
| SCHEMA-04 | v1 → Haiku classifier; v2 → skip | 11-05 |
| SCHEMA-05 | writing-plans v2 + both repos pinned | 11-04, 11-05 |
| RQ-1 | ajv v8 + ajv-formats v3 + ajv-errors v3 | 11-02 |
| RQ-2 | phase-verifier pattern for validate.cjs | 11-02 |
| RQ-3 | SCHEMA-05 option selection (Option B) | 11-05 |
| RQ-4 | classifier skip-path insertion point | 11-05 |
| RQ-5 | planner --fix-schema mode pattern | 11-03 |
| RQ-6 | sha256 Node built-in, pitfall 4 (atomic hash write) | 11-04 |
| RQ-7 | plan-errors.jsonl JSONL shape | 11-02 |

No deferred items planned. No out-of-scope items included.
