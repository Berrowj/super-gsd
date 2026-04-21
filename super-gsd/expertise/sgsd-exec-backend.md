---
agent: sgsd-exec-backend
category: C  # Execution
model_default: sonnet
handover_contract: v2
created: 2026-04-21
version: 2.0
research_principles:
  - ISO-P-01
  - ISO-P-02
  - ISO-P-04
  - HCC-P-10
  - LLMS-P-05
  - MET-P-03
---

# Expertise — sgsd-exec-backend

*Static strategic layer for the backend executor. ASS-P-05 + PI Framework: expertise is distinct from dynamic memory. Never auto-edited; SEPL proposes, operator approves.*

## Seeded Methods

Base operators this agent specializes from. ASS-P-06.

- **Contract-first implementation** — before writing code, verify the contract (OpenAPI spec, type stubs, inbound/outbound schema). If no contract exists, write the test that defines the contract BEFORE writing the route handler. HCC-P-10 treats the contract as the authoritative artifact.
- **ORM discipline** — model changes require explicit migrations. Never silently add/rename columns. Never use raw SQL as a shortcut around a query ORM pattern the project has established. MET-P-03 grounds the idiom in the project's actual ORM conventions.
- **Error-surface hygiene** — every route declares its failure modes explicitly: 400 (validation), 401/403 (auth), 404 (not found), 409 (conflict), 422 (unprocessable), 500 (internal). No bare `try: ... except: pass`. Errors carry actionable messages + structured details, never leak internals (stack traces, SQL, secrets).
- **Idempotency** — POSTs that can safely be replayed declare so explicitly (idempotency key, natural upsert, or duplicate detection). ISO-P-04 counts idempotency failures as correctness failures.
- **Contract tests over unit tests** — for route handlers, the valuable test is the integration test that hits the route with realistic input and asserts the response contract. Unit-testing internal helpers is secondary.
- **Authentication at boundaries** — auth checks happen at the route middleware layer, not scattered in handlers. If a handler performs its own auth, that's a DEVIATION.

## Failure Modes

Known ways this agent fails + detection indicators. LLMS-P-01.

- **Shape drift without migration** — adding a field to an ORM model without a corresponding migration. Indicator: `files_changed` includes a model file but not a migration file. DEVIATION guard: if model changed, migration file MUST be touched or explicitly marked "no-migration-needed: because X".
- **Silent default values** — introducing a non-nullable column without a default breaks existing rows. Indicator: `Column(nullable=False)` without `server_default` or explicit backfill.
- **Auth-at-handler anti-pattern** — checking `if user.is_admin` inside the handler instead of at the middleware. Indicator: `grep -n "is_admin\|has_role" {handler_file}` finds multiple instances.
- **Over-specific ORM queries** — hard-coding column names in raw SQL when the ORM would generate them. Indicator: `execute(text("SELECT..."))` when the model supports `.query()`.
- **Premature N+1 "optimization"** — adding `select_related` / `joinedload` everywhere. Indicator: every query in the diff has eager-loading added; profile first.
- **Exception swallowing** — `except Exception: pass` or `catch (e)` with empty body. Zero-tolerance; always re-raise or handle explicitly.

## Output Quality Bar

- **Completeness:** every touched route has (a) happy-path test, (b) at least one error-path test, (c) auth check if protected
- **Accuracy:** `verification_cmds` MUST include a `curl` or `pytest`/`go test`/`npm test` invocation that exercises the route; orchestrator will re-run as evidence
- **Surgical-ness:** diff is scoped to `files_touched`. Migrations are co-located with model changes. No "while I'm here" formatting commits.
- **Evidence:** `evidence_cited` includes ROADMAP line + the endpoint spec (OpenAPI file path or inline YAML)
- **Confidence calibration:**
  - 5 = contract tests green + manual curl verified + auth path tested
  - 4 = contract tests green, no manual verification
  - 3 = tests green but contract ambiguity remains (flag in DEVIATIONS)
  - 2 = tests green under limited scenarios only
  - 1 = code runs but behavior uncertain — likely BLOCKER instead

## Known Pitfalls

HCC-P-04 dead-ends captured explicitly.

- **DO NOT** silently change HTTP status codes (e.g. 404 → 400) even if the new code is "more correct" — that's a contract break visible to all consumers.
- **DO NOT** add pagination to an endpoint that didn't have it — callers may iterate expecting full results. DEVIATION if the task implies pagination.
- **DO NOT** introduce caching layers (Redis, in-memory) unless the task explicitly calls for them. Cache-invalidation bugs are subtle and expensive.
- **DO NOT** log request bodies at INFO level (PII + credential leak risk). DEBUG only, and only with redaction.
- **DO NOT** perform cross-aggregate writes without transactions. Partial failures are silent data corruption.
- **DO NOT** defer to training-data defaults on ORM idiom (SQLAlchemy vs Django vs Prisma have significantly different patterns). Read the project's existing models first — LLMS-P-04 warns on training-data default traps.

## Reference Patterns

ASS-P-03 structured format: pattern / approach / failure mode / rule.

- **Pattern: paginated list endpoint**
  - Approach: query builder → `.limit().offset()` + total-count query; return `{items, total, page, per_page}`
  - Failure mode: N+1 on joined includes
  - Rule: if the list includes related objects, either eager-load at the query level OR document that the consumer accepts N+1 + caches

- **Pattern: idempotent POST with natural key**
  - Approach: check-then-insert inside a transaction with appropriate isolation, OR use `INSERT ... ON CONFLICT`
  - Failure mode: race between check and insert on insufficient isolation
  - Rule: use DB-native upsert when available; otherwise lock the natural key

- **Pattern: auth middleware + handler decorator**
  - Approach: middleware validates the session/token, injects `request.user`; handlers declare `@requires_permission("X")`
  - Failure mode: middleware ordering — auth must run before rate limit and logging
  - Rule: middleware order is declared in app init; never toggle per-route

- **Pattern: migration with data backfill**
  - Approach: (1) deploy migration adding nullable column, (2) backfill data in batches, (3) deploy migration setting non-null constraint
  - Failure mode: single-shot migration on large tables locks the DB
  - Rule: three-step migrations for `nullable: False` on >100k row tables

## Handover Specifics (back to sgsd-orchestrate)

How this agent's output integrates with the orchestrator's Step 9 processing:

- **Routes to** `sgsd-code-reviewer` for per-dispatch ATC (Step 9.5) if `classifier.atc_tier in [full, gate]` AND any file in `files_touched` is backend code
- **Routes to** `sgsd-verifier` at phase close for goal-backward check (can the operator call these endpoints and get expected responses?)
- **Triggers** Step 6.5 phase-level ATC with focus: "cross-handler consistency, shared util duplication, auth-check coverage across the phase's new routes"
- **Does NOT trigger** Step 6.6 (frontend browser verify) — that's `sgsd-exec-ui`'s gate
- **Feeds** `.planning/memory/architecture/patterns/` with new idiom via sgsd-curate if DEVIATIONS surfaces a reusable pattern
- **Blocks** on ambiguous contracts rather than inventing — LLMS-P-03 is a hard anti-pattern; propagate the BLOCKER up

## Research Citations

- **ISO-P-01** — combine execution + semantic metrics. Backend code must pass tests AND preserve contract intent. A route that returns 200 with wrong body shape has "passed execution" while failing semantics.
- **ISO-P-02** — separate diagnosis from execution. Read the contract BEFORE editing the handler. Diagnosis phase is mandatory.
- **ISO-P-04** — test against functional correctness, not speed. Don't optimize routes (caching, denormalization) before correctness is established.
- **HCC-P-10** — prompts as contracts. Applied here: the OpenAPI spec / type signature IS the contract that the implementation must honor.
- **LLMS-P-05** — implementation drift under execution pressure. Backend drift is silent (response shape changes) and expensive (consumer breakage). Strongest surgical constraint.
- **MET-P-03** — ground advice in user-supplied context first. The project's existing ORM patterns, auth middleware, and error handlers are the authority over training-data idioms.

## Revision Log

- 2026-04-21 — v2.0 created. Initial SGSD v2 specialist.
