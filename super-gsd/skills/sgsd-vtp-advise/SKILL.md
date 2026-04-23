---
name: sgsd-vtp-advise
description: "Standalone VTP service-enrichment advisor. Operator-invoked ad-hoc for conservative proposal-grounding ('should we evolve X?'). Writes report to .planning/advise/{YYYY-MM-DD}-{slug}.md. Always calls advise via super-gsd/scripts/lib/vtp-context-composer.cjs — never direct MCP. Phase 16 VTP-08a."
argument-hint: "<service-name>"
allowed-tools:
  - Read
  - Write
  - Bash
  - mcp__vtp-kb__vtp_advise_service_enrichment
  - mcp__vtp-kb__vtp_route_and_retrieve
---

<trigger>

**Invoke when** the operator types `/sgsd-vtp-advise <service-name>` or explicitly asks "should we evolve {service}?" / "what's the next grounded improvement for {service}?" / "advise me on {service}".

**Do NOT invoke when:**
- Operator is describing a specific code change to ship immediately (route to `/sgsd-sepl` instead — which auto-calls advise for major proposals per VTP-08b).
- The question is about implementation mechanics, not evolution direction.
- No service name is provided (prompt operator for one first).

</trigger>

<objective>
Ground an evolution proposal in VTP's substrate + research corpus using the `vtp_advise_service_enrichment` tool. Returns conservative, bloat-flagging, evidence-backed recommendations. Operator reviews the report and decides whether to promote any recommendation into an sgsd-sepl proposal or DLB deliberation.
</objective>

<process>

## Step 1: Parse + validate inputs

1. Parse the `<service-name>` argument. Slugify (`lowercase`, spaces → `-`, strip any non-`[a-z0-9-]` character; reject any input containing `..` or `/` to guard against path traversal — T-16-14). Use the slug for the report filename.
2. Ask the operator (via AskUserQuestion if available, else Bash prompt) for:
   - `service_summary` (≥20 chars — tool requires min 20)
   - `pain_points[]` (at least 1; comma-separated input)
   - `candidate_areas[]` (at least 1; MUST be a subset of the 9-enum below)
   - `constraints[]` (optional)
   - `avoid[]` (optional)
   - `max_recommendations` (optional, 1-8, defaults to 5)
   - `strictness` (optional: `conservative` | `balanced` | `aggressive`; defaults to `conservative` for SGSD)

**9-enum for candidate_areas (strict — Zod rejects any other value):**

```
retrieval, routing, evaluation, tooling, memory, observability, safety, workflow, planning
```

**Client-side validation (critical — Risk 4):** before calling the tool, check every entry in `candidate_areas` is a member of the 9-enum. On mismatch, reject with a friendly error: `"candidate_areas contains invalid entry '<X>'. Valid options: retrieval, routing, evaluation, tooling, memory, observability, safety, workflow, planning"`. Do NOT invoke the MCP tool — let the operator correct the input.

## Step 2: Compose context

1. Invoke `node super-gsd/scripts/lib/vtp-context-composer.cjs` via Bash one-liner:
   ```bash
   node -e "const c = require('./super-gsd/scripts/lib/vtp-context-composer.cjs'); const ctx = c.compose({milestone, phase, plan, active_file, blockers, explicit_constraints, recent_turns, recent_errors}); const slice = c.project(ctx, 'standalone'); console.log(JSON.stringify(slice));"
   ```
2. Capture the `standalone`-tier slice for downstream MCP call. (standalone tier is defined in the TIERS frozen constant — fields: `repo`, `current_task`, `explicit_constraints`.)

## Step 3: Call advise

Invoke `mcp__vtp-kb__vtp_advise_service_enrichment` via the composer's `callVtp` wrapper. The composer times the call with `Date.now()` brackets and logs a row to `.planning/metrics/vtp-routing-log.jsonl` with `tier:"standalone"` and `skill_or_agent:"sgsd-vtp-advise"`.

Payload shape:
```
{
  service_name: <slug>,
  service_summary: <from Step 1>,
  pain_points: <from Step 1>,
  candidate_areas: <validated 9-enum subset>,
  constraints: <from Step 1 or []>,
  avoid: <from Step 1 or undefined>,
  max_recommendations: <from Step 1 or 5>,
  strictness: <from Step 1 or "conservative">
}
```

Response fields: `{query, evidence_hits[], recommendations[], skipped_opportunities[]}`.

**Graceful-fail:** if `callVtp` returns `{ok:false}`, print the failure reason, note that the routing-log row already captured the elapsed_ms and failure_reason, and exit with code 1. Do NOT write a partial report.

## Step 4: Write report

Write the full report to `.planning/advise/{YYYY-MM-DD-HHMM}-{slug}.md`. First `mkdir -p .planning/advise/` — directory may not exist. Using the `HHMM` suffix disambiguates same-day re-runs (T-16-20).

Report template (mirror `sgsd-complete-milestone`'s SUMMARY.md layout for consistency):

```markdown
# VTP Advise: {service_name}

**Generated:** {ISO timestamp}
**Strictness:** {strictness}
**Elapsed:** {elapsed_ms}ms

## Inputs

- **service_summary:** {service_summary}
- **pain_points:** {bulleted list}
- **candidate_areas:** {comma-separated}
- **constraints:** {bulleted list or "none"}
- **avoid:** {bulleted list or "none"}

## Query

{response.query}

## Evidence Hits

{bulleted list from response.evidence_hits — doc_id + score + snippet; max 10 rows}

## Recommendations (N = {count})

For each recommendation in response.recommendations[]:

### {N}. {title} — area: {area}

- **recommendation_id:** {recommendation_id}
- **summary:** {summary}
- **apply_only_if:** {apply_only_if}
- **minimal_change:** {minimal_change}
- **expected_difference:** {expected_difference}
- **bloat_risk:** {bloat_risk} | **implementation_cost:** {implementation_cost} | **confidence:** {confidence}
- **evidence:**
  {bulleted list of evidence items}

## Skipped Opportunities

For each entry in response.skipped_opportunities[]:

- **{area}** — {reason}

## Operator Next Steps

- Promote a recommendation to an sgsd-sepl proposal: `/sgsd-sepl <description>` citing `recommendation_id: <id>` in the rationale.
- Escalate to deliberation: `/sgsd-deliberate <question>` if a recommendation implies an architecture-grain decision.
- Ignore + archive: this file is append-only evidence; leave it in place for future cross-reference.
```

## Step 5: Report path to operator

Echo `"Advise report written to .planning/advise/{YYYY-MM-DD-HHMM}-{slug}.md"` and exit 0.

</process>

<rules>
1. **Never call `mcp__vtp-kb__*` directly.** Always via `super-gsd/scripts/lib/vtp-context-composer.cjs#callVtp`.
2. **Validate `candidate_areas` client-side.** Do NOT rely on server-side Zod — friendly error beats opaque MCP rejection.
3. **Graceful-fail.** MCP unavailable → log reason, exit non-zero, do NOT write a partial report.
4. **No report mutation.** `.planning/advise/` is append-only — never overwrite a prior report (use `{YYYY-MM-DD-HHMM}-{slug}.md` filename format to disambiguate same-day re-runs).
5. **Conservative default strictness** — SGSD biases toward bloat avoidance. Match the default strictness to that bias.
</rules>
