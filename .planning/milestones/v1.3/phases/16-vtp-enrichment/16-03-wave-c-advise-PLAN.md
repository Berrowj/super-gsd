---
phase: 16-vtp-enrichment
plan: 03
type: execute
wave: C
depends_on:
  - 16-01
files_modified:
  - C:\Users\jack.berrow\GSDedits\super-gsd\skills\sgsd-vtp-advise\SKILL.md
  - C:\Users\jack.berrow\GSDedits\super-gsd\skills\sgsd-sepl\SKILL.md
  - C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-sepl-propose.sh
  - C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-sepl-propose.test.sh
autonomous: true
requirements:
  - VTP-08a
  - VTP-08b
tags:
  - vtp
  - advise
  - sepl
  - service-enrichment
must_haves:
  truths:
    - "A new /sgsd-vtp-advise skill exists, operator-invokable with a <service-name> argument"
    - "sgsd-vtp-advise validates candidate_areas against the 9-enum before the MCP call (client-side guard)"
    - "sgsd-vtp-advise writes a report to .planning/advise/{YYYY-MM-DD}-{slug}.md on success"
    - "sgsd-sepl-propose.sh contains an is_major_proposal() function scanning for all 7 D-09 criteria"
    - "Major proposals auto-call vtp_advise_service_enrichment and append findings to proposal body"
    - "Minor proposals skip advise entirely — no network call, no added latency"
    - "sgsd-sepl-propose.test.sh has 7 major-fixture cases + 1 minor-control; all detected correctly"
    - "Proposal frontmatter extended with major: bool + vtp_advise_applied: bool (backward-compat with existing grep ^status: logic)"
  artifacts:
    - path: "super-gsd/skills/sgsd-vtp-advise/SKILL.md"
      provides: "Standalone /sgsd-vtp-advise slash command with 4-step process"
      contains: "allowed-tools"
      exports: ["name: sgsd-vtp-advise"]
    - path: "super-gsd/skills/sgsd-sepl/SKILL.md"
      provides: "Updated frontmatter + body note on major-proposal auto-advise branch"
      contains: "mcp__vtp-kb__vtp_advise_service_enrichment"
    - path: "super-gsd/scripts/sgsd-sepl-propose.sh"
      provides: "is_major_proposal() function + conditional advise-enrich before HEREDOC write"
      contains: "is_major_proposal"
    - path: "super-gsd/scripts/sgsd-sepl-propose.test.sh"
      provides: "Bash unit test for major-detection with 7 fixture cases + 1 control"
      contains: "is_major_proposal"
  key_links:
    - from: "super-gsd/skills/sgsd-vtp-advise/SKILL.md"
      to: "super-gsd/scripts/lib/vtp-context-composer.cjs"
      via: "composer.callVtp('vtp_advise_service_enrichment', args)"
      pattern: "vtp-context-composer.*callVtp"
    - from: "super-gsd/scripts/sgsd-sepl-propose.sh"
      to: "super-gsd/scripts/lib/vtp-context-composer.cjs"
      via: "Bash-invoked node one-liner on major=true branch"
      pattern: "is_major_proposal"
    - from: "super-gsd/scripts/sgsd-sepl-propose.sh"
      to: ".planning/proposals/{slug}.md"
      via: "Advise findings appended to proposal body BEFORE HEREDOC write"
      pattern: "vtp_advise_applied"
---

<objective>
Wave C integrates VTP's `vtp_advise_service_enrichment` tool across two surfaces per D-09:
- **VTP-08a:** Standalone `/sgsd-vtp-advise` skill — operator-invoked ad-hoc for "should we evolve X?" grounding.
- **VTP-08b:** Conditional `/sgsd-sepl` integration — auto-calls advise ONLY for "major" proposals (falsifiable criteria from D-09), appends findings to the proposal body. Minor proposals skip advise to avoid noise.

The D-09 "major" criteria are falsifiable — proposal qualifies if it touches any of: orchestrator loop, dispatch rules, skill surface (new), agent surface (new or frontmatter change), new hook, new `workflow.*`/`preferences.*` config key, or cross-phase pattern. Detection is file-pattern + frontmatter scan, NOT a judgment call.

Wave C unblocker was verified LIVE in-session 2026-04-23 — `mcp__vtp-kb__vtp_advise_service_enrichment` is available via ToolSearch.

Purpose: satisfies D-09 (two integration surfaces, falsifiable major-criteria), VTP-08a (standalone skill), VTP-08b (conditional sepl integration).

Output: 1 new skill file + 1 sepl skill patch + 1 sepl propose-script patch + 1 sepl test file. Proposal frontmatter gains 2 new backward-compatible keys.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:\Users\jack.berrow\GSDedits\.planning\STATE.md
@C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-CONTEXT.md
@C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-RESEARCH.md
@C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-PATTERNS.md
@C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-01-SUMMARY.md

<interfaces>
<!-- Verbatim contracts extracted from RESEARCH.md + PATTERNS.md — executor uses these directly -->

**`vtp_advise_service_enrichment` input schema (RESEARCH.md §VTP MCP Tool Surface row 10, service-enrichment.ts:17-67):**
```
{
  service_name: string,
  service_summary: string(min 20),
  pain_points: string[](min 1),
  candidate_areas: ENUM[](min 1),   // STRICT — see 9-enum below
  constraints: string[],
  avoid?: string[],
  max_recommendations?: number(1-8),
  strictness?: "conservative" | "balanced" | "aggressive"
}
```

**9-enum for `candidate_areas` (service-enrichment.ts:23-33 — Zod rejects any other value):**
`retrieval`, `routing`, `evaluation`, `tooling`, `memory`, `observability`, `safety`, `workflow`, `planning`

**Response shape:**
```
{
  query,
  evidence_hits[],
  recommendations[{recommendation_id, area, title, summary, apply_only_if, minimal_change, expected_difference, bloat_risk, implementation_cost, confidence, evidence[]}],
  skipped_opportunities[{area, reason}]
}
```

**sgsd-vtp-advise frontmatter (synthesized from sgsd-complete-milestone + sgsd-muda-audit analogs):**
```yaml
---
name: sgsd-vtp-advise
description: "Standalone VTP service-enrichment advisor. Operator-invoked ad-hoc for conservative proposal-grounding ('should we evolve X?'). Writes report to .planning/advise/{YYYY-MM-DD}-{slug}.md. Always calls advise via super-gsd/scripts/lib/vtp-context-composer.cjs — never direct MCP."
argument-hint: "<service-name>"
allowed-tools:
  - Read
  - Write
  - Bash
  - mcp__vtp-kb__vtp_advise_service_enrichment
  - mcp__vtp-kb__vtp_route_and_retrieve
---
```

**sgsd-sepl frontmatter patch (current vs target):**

Current (sgsd-sepl/SKILL.md:4-7):
```yaml
allowed-tools:
  - Read
  - Write
  - Bash
```

Target:
```yaml
allowed-tools:
  - Read
  - Write
  - Bash
  - mcp__vtp-kb__vtp_advise_service_enrichment
  - mcp__vtp-kb__vtp_route_and_retrieve
```

**D-09 "major" criteria → detection table (RESEARCH.md §sepl Major-Proposal Detection Feasibility):**

| Criterion | Detectable from | Implementation |
|-----------|-----------------|----------------|
| 1 — Orchestrator loop | `$TARGET` | `grep -E "^super-gsd/skills/sgsd-orchestrate/\|ORCHESTRATOR-CHECKPOINT"` |
| 2 — Dispatch rules | `$TARGET` | `grep -E "CLAUDE-OVERLAY\.md"` |
| 3 — New skill file | `$TARGET` + existence check | `[[ "$TYPE" == "skill" ]] && [[ ! -f "$TARGET" ]]` |
| 4 — Agent surface | `$TARGET` + `$TYPE` | `[[ "$TYPE" == "agent" ]]` — any agent-typed proposal qualifies |
| 5 — New hook | `$TARGET` | `grep -E "^super-gsd/hooks/"` + existence check |
| 6 — New workflow/preferences key | `$BODY` | `grep -E "^\s*(workflow\|preferences)\." body.tmp` |
| 7 — Cross-phase pattern | `$BODY` | heuristic: scan body for distinct `phase` references; if ≥2 distinct phase numbers → cross-phase |

**Existing sepl proposal frontmatter (sgsd-sepl-propose.sh:131-141 — currently 7 fields):**
```yaml
---
type: sepl-proposal
resource_type: $TYPE
target_path: $TARGET
slug: $SLUG
proposed_at: $TS
status: pending
description: $DESCRIPTION
rationale: $RATIONALE
---
```

**Target sepl frontmatter (extended with 2 backward-compat keys):**
```yaml
---
type: sepl-proposal
resource_type: $TYPE
target_path: $TARGET
slug: $SLUG
proposed_at: $TS
status: pending
major: $MAJOR                  # NEW — written by is_major_proposal scan
vtp_advise_applied: $APPLIED   # NEW — written when advise findings appended
description: $DESCRIPTION
rationale: $RATIONALE
---
```

Backward compat: `sgsd-sepl-commit.sh` uses `grep ^status:` — agnostic to additional keys.

**Sepl placement (RESEARCH.md §sepl feasibility recommendation — approach 1):**
- `is_major_proposal()` runs BEFORE the HEREDOC write at line 131.
- If major → invoke `vtp_advise_service_enrichment` via composer (5s timeout).
- If advise succeeds → APPEND findings into proposal body before write.
- If advise fails/timeouts → fall through to approach 2: write `major: true, vtp_advise_applied: false` and continue. A future `sgsd-sepl-advise-enrich.sh` post-hook could retry (deferred to a follow-on phase).

**Proposal directory (Risk 5 in RESEARCH.md):** `.planning/proposals/` may not exist on a fresh repo. sepl-propose already does `mkdir -p` at line 181 — preserve this when patching.

**Report path for /sgsd-vtp-advise:** `.planning/advise/{YYYY-MM-DD}-{slug}.md`. Directory may not exist — skill MUST `mkdir -p` before write.

**Risk 7 (HEREDOC interpolation):** `sgsd-sepl-propose.sh:131` uses `read -r -d '' CONTENT <<EOF` which interpolates `$DESCRIPTION` and `$RATIONALE`. When appending advise findings, write them to a temp file with `printf '%s' "$FINDINGS" > "$TMPFILE"` and reference the temp file in the HEREDOC via `$(cat "$TMPFILE")` — or use a separate heredoc delimiter that doesn't interpolate (`<<'EOF'` vs `<<EOF`). Backticks and `$` in advise findings must NOT expand.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create /sgsd-vtp-advise standalone skill (VTP-08a)</name>
  <files>C:\Users\jack.berrow\GSDedits\super-gsd\skills\sgsd-vtp-advise\SKILL.md</files>
  <read_first>
    - C:\Users\jack.berrow\GSDedits\super-gsd\skills\sgsd-complete-milestone\SKILL.md (full file — VTP-tool frontmatter + tiered VTP call pattern + SUMMARY.md output shape)
    - C:\Users\jack.berrow\GSDedits\super-gsd\skills\sgsd-muda-audit\SKILL.md (first 40 lines — standalone-skill `<objective>` + `<process>` body shape)
    - C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-PATTERNS.md (§sgsd-vtp-advise section)
    - C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-RESEARCH.md (§VTP MCP Tool Surface row 10 + Risk 4 on 9-enum)
  </read_first>
  <action>
Create `super-gsd/skills/sgsd-vtp-advise/SKILL.md` — a new standalone skill. The parent directory `super-gsd/skills/sgsd-vtp-advise/` does NOT exist yet — first create it via Bash `mkdir -p`, then write the file.

**File contents (verbatim structure — adjust description prose only):**

```markdown
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

1. Parse the `<service-name>` argument. Slugify (`lowercase`, spaces → `-`) for the report filename.
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
2. Capture the `standalone`-tier slice for downstream MCP call. (standalone tier is defined in TIERS frozen constant — see composer module.)

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

Write the full report to `.planning/advise/{YYYY-MM-DD}-{slug}.md`. First `mkdir -p .planning/advise/` — directory may not exist.

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

Echo `"Advise report written to .planning/advise/{YYYY-MM-DD}-{slug}.md"` and exit 0.

</process>

<rules>
1. **Never call `mcp__vtp-kb__*` directly.** Always via `super-gsd/scripts/lib/vtp-context-composer.cjs#callVtp`.
2. **Validate `candidate_areas` client-side.** Do NOT rely on server-side Zod — friendly error beats opaque MCP rejection.
3. **Graceful-fail.** MCP unavailable → log reason, exit non-zero, do NOT write a partial report.
4. **No report mutation.** `.planning/advise/` is append-only — never overwrite a prior report (use timestamp in filename to disambiguate same-day re-runs: `{YYYY-MM-DD-HHMM}-{slug}.md`).
5. **Conservative default strictness** — SGSD biases toward bloat avoidance. Match the default strictness to that bias.
</rules>
```

**Commit:** `feat(16-03): add /sgsd-vtp-advise standalone skill (VTP-08a)`
  </action>
  <verify>
    <automated>test -f "C:/Users/jack.berrow/GSDedits/super-gsd/skills/sgsd-vtp-advise/SKILL.md" &amp;&amp; grep -q "name: sgsd-vtp-advise" "C:/Users/jack.berrow/GSDedits/super-gsd/skills/sgsd-vtp-advise/SKILL.md" &amp;&amp; grep -q "mcp__vtp-kb__vtp_advise_service_enrichment" "C:/Users/jack.berrow/GSDedits/super-gsd/skills/sgsd-vtp-advise/SKILL.md" &amp;&amp; grep -q "retrieval, routing, evaluation, tooling, memory, observability, safety, workflow, planning" "C:/Users/jack.berrow/GSDedits/super-gsd/skills/sgsd-vtp-advise/SKILL.md" &amp;&amp; grep -q "vtp-context-composer" "C:/Users/jack.berrow/GSDedits/super-gsd/skills/sgsd-vtp-advise/SKILL.md"</automated>
  </verify>
  <acceptance_criteria>
    - File `super-gsd/skills/sgsd-vtp-advise/SKILL.md` exists (parent directory created).
    - Frontmatter `name: sgsd-vtp-advise`, `argument-hint: "<service-name>"`, `allowed-tools:` list form (NOT comma string).
    - `allowed-tools:` includes `mcp__vtp-kb__vtp_advise_service_enrichment` AND `mcp__vtp-kb__vtp_route_and_retrieve`.
    - Body enumerates all 9 valid `candidate_areas` in a single code block / list.
    - Body contains phrase "Never call `mcp__vtp-kb__*` directly" (composer contract assertion).
    - Body documents report path as `.planning/advise/{YYYY-MM-DD}-{slug}.md`.
    - Body contains Graceful-fail discipline (step 3 of `<process>`).
    - 5 top-level `<process>` steps exist: Parse, Compose, Call, Write, Report.
    - Frontmatter closes correctly — `grep -c "^---$" file` returns exactly 2.
  </acceptance_criteria>
  <done>New skill file exists with correct frontmatter shape (list form, not comma string), 9-enum validation documented, composer contract enforced.</done>
</task>

<task type="auto">
  <name>Task 2: Extend sgsd-sepl with major-proposal auto-advise (VTP-08b) + ship bash test</name>
  <files>
    C:\Users\jack.berrow\GSDedits\super-gsd\skills\sgsd-sepl\SKILL.md
    C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-sepl-propose.sh
    C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-sepl-propose.test.sh
  </files>
  <read_first>
    - C:\Users\jack.berrow\GSDedits\super-gsd\skills\sgsd-sepl\SKILL.md (full file — current allowed-tools + body structure)
    - C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-sepl-propose.sh (full file — especially lines 131-181 where HEREDOC + mkdir live)
    - C:\Users\jack.berrow\GSDedits\super-gsd\scripts\sgsd-sepl-commit.sh (first 50 lines — confirm `grep ^status:` agnostic to extra keys)
    - C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-RESEARCH.md (§sepl Major-Proposal Detection Feasibility + §Risk 5 + §Risk 7)
    - C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-PATTERNS.md (§sgsd-sepl SKILL.md section)
  </read_first>
  <action>
**File 1: `super-gsd/skills/sgsd-sepl/SKILL.md` — extend allowed-tools + document branch**

**Step A (frontmatter patch):** Replace the 3-line `allowed-tools:` block at lines 4-7:
```yaml
allowed-tools:
  - Read
  - Write
  - Bash
```
with:
```yaml
allowed-tools:
  - Read
  - Write
  - Bash
  - mcp__vtp-kb__vtp_advise_service_enrichment
  - mcp__vtp-kb__vtp_route_and_retrieve
```

**Step B (in-body patch):** Find the `<objective>` closing tag and the first narrative paragraph describing the 3-branch flow ("Draft a new proposal" / "List pending" / "Apply or reject"). Immediately AFTER that 3-branch list, insert:

```markdown

<vtp_integration>
## Major-Proposal Auto-Advise (Phase 16 — VTP-08b)

When drafting a new proposal, `sgsd-sepl-propose.sh` scans the target + body against the D-09 falsifiable major-proposal criteria. If ANY criterion fires, the script invokes `mcp__vtp-kb__vtp_advise_service_enrichment` via `super-gsd/scripts/lib/vtp-context-composer.cjs#callVtp` (5s timeout) and appends the resulting recommendations + skipped-opportunities into the proposal body BEFORE the proposal file is written.

**Minor proposals skip advise entirely** — no network call, no added latency, no appended findings. This preserves sub-agent throughput for small-grain tweaks.

**D-09 "major" criteria (falsifiable — file-pattern + frontmatter scan, not judgment):**

1. Touches orchestrator loop (`sgsd-orchestrate/*` or `ORCHESTRATOR-CHECKPOINT`)
2. Touches dispatch rules (`CLAUDE-OVERLAY.md`)
3. Creates a new skill file (type=skill + target does not exist)
4. Any agent-typed proposal (type=agent)
5. Creates a new hook (under `super-gsd/hooks/`)
6. Adds a new `workflow.*` or `preferences.*` config key
7. Cross-phase pattern (body mentions ≥2 distinct phase numbers)

**Proposal frontmatter extension (backward-compatible):**

```yaml
major: true|false              # set by is_major_proposal scan
vtp_advise_applied: true|false # set when advise findings appended
```

Existing `grep ^status:` logic in `sgsd-sepl-commit.sh` is agnostic to additional keys.

**Graceful-fail:** if `callVtp` returns `{ok:false}` or times out after 5s:
- Proposal still writes successfully.
- `major: true, vtp_advise_applied: false` is recorded.
- A future `sgsd-sepl-advise-enrich.sh` post-hook could retry (deferred to a follow-on phase).

Test coverage: `super-gsd/scripts/sgsd-sepl-propose.test.sh` covers all 7 major criteria + 1 minor control.
</vtp_integration>
```

**File 2: `super-gsd/scripts/sgsd-sepl-propose.sh` — add is_major_proposal() + advise-enrich**

Read the full file. Identify the line where the HEREDOC `read -r -d '' CONTENT <<EOF` begins (per RESEARCH.md: line 131) and the line where `mkdir -p` for `.planning/proposals/` runs (per RESEARCH.md: line 181).

**Step A (add is_major_proposal function):** Add the following bash function near the top of the script, AFTER the existing argument parsing but BEFORE the HEREDOC write:

```bash
# --------------------------------------------------------------------------
# is_major_proposal() — D-09 falsifiable major-criteria scan.
# Globals: TYPE, TARGET, BODY_FILE (path to temp file with full proposal body)
# Returns: echoes "true" or "false" to stdout; sets global MAJOR_REASON on "true".
# --------------------------------------------------------------------------
is_major_proposal() {
  local reason=""

  # Criterion 1: orchestrator loop
  if echo "$TARGET" | grep -qE "^super-gsd/skills/sgsd-orchestrate/|ORCHESTRATOR-CHECKPOINT"; then
    reason="orchestrator_loop"
  # Criterion 2: dispatch rules
  elif echo "$TARGET" | grep -qE "CLAUDE-OVERLAY\.md"; then
    reason="dispatch_rules"
  # Criterion 3: new skill file
  elif [[ "$TYPE" == "skill" ]] && [[ ! -f "$TARGET" ]]; then
    reason="new_skill"
  # Criterion 4: any agent-typed proposal
  elif [[ "$TYPE" == "agent" ]]; then
    reason="agent_surface"
  # Criterion 5: new hook
  elif echo "$TARGET" | grep -qE "^super-gsd/hooks/" && [[ ! -f "$TARGET" ]]; then
    reason="new_hook"
  # Criterion 6: new workflow.* or preferences.* config key
  elif [[ -f "$BODY_FILE" ]] && grep -qE "^\s*(workflow|preferences)\." "$BODY_FILE"; then
    reason="new_config_key"
  # Criterion 7: cross-phase pattern — body mentions ≥2 distinct phase numbers
  elif [[ -f "$BODY_FILE" ]]; then
    local phases
    phases=$(grep -oE "[Pp]hase ?[0-9]+" "$BODY_FILE" | sort -u | wc -l)
    if [[ "$phases" -ge 2 ]]; then
      reason="cross_phase"
    fi
  fi

  if [[ -n "$reason" ]]; then
    MAJOR_REASON="$reason"
    echo "true"
  else
    echo "false"
  fi
}
```

**Step B (wire is_major_proposal into the propose flow):** BEFORE the HEREDOC write, call `is_major_proposal` and conditionally invoke advise:

```bash
# Write body to temp file for scanning
BODY_FILE=$(mktemp)
printf '%s\n' "$DESCRIPTION" "$RATIONALE" > "$BODY_FILE"

MAJOR=$(is_major_proposal)
VTP_APPLIED="false"
ADVISE_FINDINGS=""

if [[ "$MAJOR" == "true" ]]; then
  echo "[sgsd-sepl] Proposal classified as major (reason: $MAJOR_REASON). Calling vtp_advise_service_enrichment..."
  # 5s timeout advise call via composer
  ADVISE_OUT=$(timeout 5 node -e "
    const c = require('$PROJECT_ROOT/super-gsd/scripts/lib/vtp-context-composer.cjs');
    const ctx = c.compose({milestone: process.env.SGSD_MILESTONE, phase: process.env.SGSD_PHASE});
    const slice = c.project(ctx, 'standalone');
    c.callVtp('vtp_advise_service_enrichment', {
      payload: {
        service_name: '$SLUG',
        service_summary: '$DESCRIPTION',
        pain_points: ['$MAJOR_REASON proposal needs grounding'],
        candidate_areas: ['workflow'],
        strictness: 'conservative'
      },
      mcpInvoke: /* injected by runtime */ null,
      projectDir: '$PROJECT_ROOT',
      skillOrAgent: 'sgsd-sepl',
      tier: 'standalone',
      rawQuery: '$DESCRIPTION'
    }).then(r => console.log(JSON.stringify(r)));
  " 2>/dev/null || echo '{\"ok\":false,\"reason\":\"timeout\"}')

  # Parse ok field — if true, extract recommendations summary
  if echo "$ADVISE_OUT" | grep -q '"ok":true'; then
    VTP_APPLIED="true"
    ADVISE_FINDINGS=$(printf '\n\n## VTP Advise Findings (auto-enriched)\n\n%s\n' "$ADVISE_OUT")
  fi
fi

rm -f "$BODY_FILE"
```

**Step C (extend HEREDOC frontmatter):** Modify the existing HEREDOC (around line 131) to add `major:` and `vtp_advise_applied:` keys BETWEEN `status: pending` and `description:`. Per RESEARCH.md Risk 7, if findings contain backticks or `$`, write via a non-interpolating heredoc or `printf '%s'` — see existing HEREDOC; if it uses `<<EOF` (interpolating), switch to `<<'EOF'` and inject variables via concat, OR write the full content with `printf`.

Target HEREDOC output:
```yaml
---
type: sepl-proposal
resource_type: $TYPE
target_path: $TARGET
slug: $SLUG
proposed_at: $TS
status: pending
major: $MAJOR
vtp_advise_applied: $VTP_APPLIED
description: $DESCRIPTION
rationale: $RATIONALE
---

[body]

$ADVISE_FINDINGS
```

(Keep the existing `mkdir -p .planning/proposals/` — Risk 5 — as-is.)

**File 3: `super-gsd/scripts/sgsd-sepl-propose.test.sh` — NEW bash test for major-detection**

Create a new bash test file that sources the `is_major_proposal` function from the patched `sgsd-sepl-propose.sh` (or inlines a test-only version if sourcing is awkward) and exercises 7 fixture cases + 1 control.

**File contents:**

```bash
#!/usr/bin/env bash
# sgsd-sepl-propose.test.sh — Unit test for is_major_proposal() detection.
# Covers all 7 D-09 major criteria + 1 minor control.
# Exits 0 PASS / 1 FAIL.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROPOSE_SCRIPT="$SCRIPT_DIR/sgsd-sepl-propose.sh"

if [[ ! -f "$PROPOSE_SCRIPT" ]]; then
  echo "FAIL: propose script not found at $PROPOSE_SCRIPT"
  exit 1
fi

# Source only the function — propose script must guard against side-effects when sourced
# (add `return 0 if ${BASH_SOURCE[0]} != $0` sentinel if needed).
# shellcheck source=/dev/null
source "$PROPOSE_SCRIPT" 2>/dev/null || {
  echo "NOTE: full-script source failed — using function extract"
}

FAILURES=0

assert_major() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL [$label]: expected '$expected', got '$actual'"
    FAILURES=$((FAILURES + 1))
  else
    echo "PASS [$label]"
  fi
}

# Temp body file for criteria 6 + 7 tests
BODY_FILE=$(mktemp)
trap 'rm -f "$BODY_FILE"' EXIT

# --- Fixture 1: orchestrator loop ---
TYPE="skill"
TARGET="super-gsd/skills/sgsd-orchestrate/SKILL.md"
printf '' > "$BODY_FILE"
assert_major "criterion-1-orchestrator" "true" "$(is_major_proposal)"

# --- Fixture 2: dispatch rules ---
TARGET="CLAUDE-OVERLAY.md"
assert_major "criterion-2-dispatch" "true" "$(is_major_proposal)"

# --- Fixture 3: new skill file ---
TYPE="skill"
TARGET="super-gsd/skills/sgsd-newthing/SKILL.md"  # does not exist
assert_major "criterion-3-new-skill" "true" "$(is_major_proposal)"

# --- Fixture 4: any agent-typed proposal ---
TYPE="agent"
TARGET="custom-gsd-extract/claude-agents/gsd-newagent.md"
assert_major "criterion-4-agent" "true" "$(is_major_proposal)"

# --- Fixture 5: new hook ---
TYPE="hook"
TARGET="super-gsd/hooks/my-new-hook.sh"  # does not exist
assert_major "criterion-5-new-hook" "true" "$(is_major_proposal)"

# --- Fixture 6: new workflow.* config key ---
TYPE="config"
TARGET=".planning/config.json"
printf '%s\n' "workflow.new_key: true" > "$BODY_FILE"
assert_major "criterion-6-new-config" "true" "$(is_major_proposal)"

# --- Fixture 7: cross-phase body reference ---
TYPE="doc"
TARGET="docs/something.md"
printf '%s\n' "This touches Phase 14 and Phase 15 and Phase 16" > "$BODY_FILE"
assert_major "criterion-7-cross-phase" "true" "$(is_major_proposal)"

# --- Control: minor script tweak (should NOT trigger any criterion) ---
TYPE="script"
TARGET="super-gsd/scripts/some-existing-script.sh"
printf '%s\n' "small inline tweak to existing echo statement" > "$BODY_FILE"
assert_major "control-minor" "false" "$(is_major_proposal)"

if [[ "$FAILURES" -gt 0 ]]; then
  echo ""
  echo "FAIL: $FAILURES test case(s) failed"
  exit 1
fi

echo ""
echo "PASS: all 8 test cases (7 major + 1 control) passed"
exit 0
```

Ensure the test file is executable: `chmod +x super-gsd/scripts/sgsd-sepl-propose.test.sh`.

**Note on sourcing:** `sgsd-sepl-propose.sh` may execute logic when sourced. If sourcing causes side-effects, add a sentinel at the top of `sgsd-sepl-propose.sh`:
```bash
# Guard against side-effects when sourced (e.g. by sgsd-sepl-propose.test.sh)
if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  # sourced — expose functions only, no auto-execution
  :
else
  # executed — run propose flow
  main_propose_flow "$@"
fi
```
(Wrap the existing script's top-level execution in an `if` guard AND expose the main flow as a function `main_propose_flow()`. This preserves existing CLI behavior.)

**Commits:**
- `feat(16-03): wire major-proposal auto-advise into sgsd-sepl (VTP-08b)`
- `test(16-03): add sgsd-sepl-propose bash test for major-detection coverage`
  </action>
  <verify>
    <automated>grep -q "mcp__vtp-kb__vtp_advise_service_enrichment" "C:/Users/jack.berrow/GSDedits/super-gsd/skills/sgsd-sepl/SKILL.md" &amp;&amp; grep -q "is_major_proposal" "C:/Users/jack.berrow/GSDedits/super-gsd/scripts/sgsd-sepl-propose.sh" &amp;&amp; grep -q "MAJOR_REASON" "C:/Users/jack.berrow/GSDedits/super-gsd/scripts/sgsd-sepl-propose.sh" &amp;&amp; grep -q "vtp_advise_applied" "C:/Users/jack.berrow/GSDedits/super-gsd/scripts/sgsd-sepl-propose.sh" &amp;&amp; test -x "C:/Users/jack.berrow/GSDedits/super-gsd/scripts/sgsd-sepl-propose.test.sh" &amp;&amp; bash "C:/Users/jack.berrow/GSDedits/super-gsd/scripts/sgsd-sepl-propose.test.sh"</automated>
  </verify>
  <acceptance_criteria>
    - `super-gsd/skills/sgsd-sepl/SKILL.md` allowed-tools contains `mcp__vtp-kb__vtp_advise_service_enrichment` AND `mcp__vtp-kb__vtp_route_and_retrieve`.
    - `super-gsd/skills/sgsd-sepl/SKILL.md` body contains `<vtp_integration>` block describing the 7 major criteria + graceful-fail + backward-compat note.
    - `super-gsd/scripts/sgsd-sepl-propose.sh` contains a `is_major_proposal()` function.
    - `sgsd-sepl-propose.sh` contains all 7 criteria (grep `orchestrator_loop`, `dispatch_rules`, `new_skill`, `agent_surface`, `new_hook`, `new_config_key`, `cross_phase`).
    - `sgsd-sepl-propose.sh` calls `timeout 5 node` for the advise wrapper (5s timeout per RESEARCH.md recommendation).
    - HEREDOC frontmatter now emits `major:` and `vtp_advise_applied:` keys (grep both present).
    - `super-gsd/scripts/sgsd-sepl-propose.test.sh` exists + is executable.
    - Running `bash super-gsd/scripts/sgsd-sepl-propose.test.sh` exits 0 with all 8 cases passing.
  </acceptance_criteria>
  <done>sepl skill frontmatter extended, propose.sh has major-detection + advise-enrich wiring, 8-case bash test passes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Operator input → skill args | Arbitrary `<service-name>` string (slugified before filesystem use) |
| VTP advise response → proposal body | Response text flows into markdown file; could contain backticks or `$` interpolation triggers |
| Bash script sourcing (test → propose) | Sourcing propose.sh could trigger top-level execution if not guarded |
| MCP call timeout | `timeout 5 node` — kernel-level SIGTERM; partial writes possible mid-call |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-16-14 | Tampering | Path traversal via `<service-name>` argument in /sgsd-vtp-advise | mitigate | Slugify strictly: `lowercase`, replace non-`[a-z0-9-]` with `-`. Reject `..` or `/`. Reference: existing memory rule `v1.1-domain-validation-regex.md`. |
| T-16-15 | Tampering | VTP advise response containing `$VAR` or backticks interpolated during HEREDOC write | mitigate | Use `<<'EOF'` (non-interpolating heredoc) OR write body via `printf '%s'` to a temp file + concatenate. Document in Task 2 action Step C. |
| T-16-16 | Elevation-of-privilege | Test file sources propose.sh — could trigger propose flow with test-fixture env | mitigate | Add sentinel guard in propose.sh: execute main flow only when `${BASH_SOURCE[0]} == $0`. Expose `is_major_proposal` and `main_propose_flow` as named functions. |
| T-16-17 | Info-disclosure | Proposal file writes advise findings in cleartext — may include VTP doc content | accept | Same trust level as existing `.planning/proposals/` content. Operator reviews before `/sgsd-sepl apply`. No new surface. |
| T-16-18 | DoS | Advise call could hang > 5s and block propose throughput | mitigate | `timeout 5 node` — SIGTERM kills child. Propose still writes with `vtp_advise_applied: false`. Fallback guaranteed. |
| T-16-19 | Spoofing | Advise response spoofed recommendations mislead operator | accept | Operator reviews proposal body before applying. Human-in-loop by sepl design (D-04 Wave B). |
| T-16-20 | Tampering | `/sgsd-vtp-advise` writes to `.planning/advise/{date}-{slug}.md` — collision on same-day re-run | mitigate | Use `{YYYY-MM-DD-HHMM}-{slug}.md` filename format to disambiguate (noted in `<rules>` item 4 of skill body). |
</threat_model>

<verification>
End-of-wave gate:

```bash
# VTP-08a: /sgsd-vtp-advise skill exists + is parseable
test -f super-gsd/skills/sgsd-vtp-advise/SKILL.md
grep -q "^name: sgsd-vtp-advise" super-gsd/skills/sgsd-vtp-advise/SKILL.md
[[ $(grep -c "^---$" super-gsd/skills/sgsd-vtp-advise/SKILL.md) -eq 2 ]]
grep -q "retrieval, routing, evaluation, tooling, memory, observability, safety, workflow, planning" super-gsd/skills/sgsd-vtp-advise/SKILL.md

# VTP-08b: sepl patches landed
grep -q "mcp__vtp-kb__vtp_advise_service_enrichment" super-gsd/skills/sgsd-sepl/SKILL.md
grep -q "is_major_proposal" super-gsd/scripts/sgsd-sepl-propose.sh

# Bash test covers all 7 major criteria + 1 minor control
bash super-gsd/scripts/sgsd-sepl-propose.test.sh   # → exit 0 + "PASS: all 8 test cases"
```

Manual smoke (optional after Wave C merge, per RESEARCH.md §Validation Architecture dimensions 7 + 8):
- Invoke `/sgsd-vtp-advise sgsd-triage` — verify `.planning/advise/{today}-sgsd-triage.md` written with `recommendations` + `skipped_opportunities` sections.
- Run `sgsd-sepl-propose.sh` on a deliberately major proposal (e.g., `type: agent`) — verify proposal file has `major: true` and `vtp_advise_applied:` populated.
</verification>

<success_criteria>
Wave C is complete when:
1. `super-gsd/skills/sgsd-vtp-advise/SKILL.md` exists with list-form `allowed-tools:` frontmatter including `vtp_advise_service_enrichment`.
2. Skill body enumerates all 9 `candidate_areas` + validates client-side before MCP call (Risk 4 mitigation).
3. Skill body contains "Never call `mcp__vtp-kb__*` directly" composer-contract assertion.
4. `sgsd-sepl/SKILL.md` frontmatter extended with 2 VTP tools.
5. `sgsd-sepl/SKILL.md` body contains `<vtp_integration>` block documenting the 7 D-09 major criteria + graceful-fail.
6. `sgsd-sepl-propose.sh` contains `is_major_proposal()` function scanning all 7 criteria.
7. `sgsd-sepl-propose.sh` HEREDOC emits `major:` + `vtp_advise_applied:` frontmatter keys.
8. `sgsd-sepl-propose.sh` has a sentinel source-guard so `propose.test.sh` can safely source it.
9. `sgsd-sepl-propose.test.sh` exists, is executable, and exits 0 with all 8 cases (7 major fixtures + 1 minor control) passing.
10. 3 atomic commits landed, one per task boundary, using `feat(16-03):` / `test(16-03):` prefix.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.3/phases/16-vtp-enrichment/16-03-SUMMARY.md` capturing:
- files_changed list
- verification commands and their outputs
- bash test output (all 8 cases)
- any deviations from plan
- one-liner summary for the orchestrator
</output>
