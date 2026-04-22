---
phase: 13-governance
plan: 05
type: execute
wave: 1
depends_on: []
files_modified:
  - super-gsd/skills/sgsd-complete-milestone/SKILL.md
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
  - .planning/phases/13-governance/plans/13-05-01-vtp-probe.md
  - .planning/phases/13-governance/plans/13-05-SUMMARY.md
autonomous: true
requirements:
  - GOV-05
  - D-16
  - D-18a
  - D-18b

schema_version: 2
expected_ATC_tier: FULL
skip_gates: []
tasks:
  - id: 13-05-01
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/phases/13-governance/plans/13-05-01-vtp-probe.md
    input_contract: |
      13-RESEARCH.md §Q5 (VTP classification API unknown — `vtp_ingest_research` exists but
      call-shape not yet observed in activity log; ToolSearch is the safe read-only discovery path).
      13-CONTEXT.md D-18b three-tier fallback ladder:
        tier-1: native Milestone classification exists
        tier-2: arbitrary string classifications accepted → "Milestone (SGSD v2)" + gap memo
        tier-3: fixed enum only → best-fit existing type + `sgsd_type: milestone` metadata + gap memo urgency HIGH
      Research-recommended spike: call ToolSearch({query: "select:mcp__vtp-kb__vtp_ingest_research",
      max_results: 1}) to retrieve parameter schema. ToolSearch is READ-ONLY discovery;
      does not call the tool. Safe from any planning/research context.
      Spike-first pattern mirrors Phase 12 plan 12-02-00 spike (evidence before implementation).
    output_contract: |
      `.planning/phases/13-governance/plans/13-05-01-vtp-probe.md` exists with sections:
      - "## Spike Design" — exact ToolSearch query used
      - "## Observed Schema" — tool's parameter list (title, body, classification?, type?, category?, tags?)
      - "## Tier Verdict" — exactly one of: `TIER-1 (native)`, `TIER-2 (arbitrary string)`, `TIER-3 (fixed enum)`
      - "## Impact on 13-05-03/05" — which schema fields the skill PUBLISH step must use
      No skill file is modified. No ingest call is made. This is pure discovery.
      If ToolSearch returns no schema detail (e.g., only tool name), default verdict to
      `TIER-2 (arbitrary string)` per research §Q5 default and document the uncertainty.
    hypothesis: |
      Per research §Q5, the D-18b fallback ladder is robust to any answer — but resolving
      the tier up-front lets task 13-05-03 write the correct PUBLISH step body rather than
      emitting all three branches as dead code paths. Even a `TIER-2 default` verdict is
      actionable: skill ships tier-2 path as primary, tier-1 as fallback-up, tier-3 as
      fallback-down. The probe costs ~60s, removes a class of integration surprise.
    falsifier: |
      (a) Spike doc absent → executor proceeds blind to tier; risks shipping a skill whose
      primary path is a dead branch.
      (b) Verdict cell contains text other than one of the three tier strings.
      (c) Spike modifies SKILL.md (scope creep — discovery only).
      (d) ToolSearch is actually called as vtp_ingest_research (live side effect before skill ready).
    stop_rule: |
      Spike doc exists, verdict is one of TIER-1|TIER-2|TIER-3, Observed Schema section
      populated with at least the tool's parameter list (or documented "schema not exposed —
      defaulting to TIER-2").
    verification_cmd: |
      test -f .planning/phases/13-governance/plans/13-05-01-vtp-probe.md && \
      grep -qE "TIER-1|TIER-2|TIER-3" .planning/phases/13-governance/plans/13-05-01-vtp-probe.md && \
      grep -q "Observed Schema" .planning/phases/13-governance/plans/13-05-01-vtp-probe.md
    verification_gates:
      - "spike doc exists → exit 0"
      - "verdict is TIER-1|2|3 → exit 0"
      - "Observed Schema section present → exit 0"

  - id: 13-05-02
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-complete-milestone/SKILL.md
    input_contract: |
      13-CONTEXT.md D-16 install location (repo-tracked per <policy_guard> clarification:
      `super-gsd/skills/sgsd-complete-milestone/SKILL.md` — NOT user-local. Phase 12 installer
      already patches gsd-tools KNOWN_TOP_LEVEL).
      13-RESEARCH.md §Q7 recommended 8-step skill structure + YAML frontmatter shape:
        name: sgsd-complete-milestone
        description: 1-line idempotent-close + auto-trigger notice
        argument-hint: "<version>"
        allowed-tools: [Read, Write, Bash, Glob, Grep, Agent, mcp__vtp-kb__vtp_search,
                        mcp__vtp-kb__vtp_list_research, mcp__vtp-kb__vtp_ingest_research]
      Mirror sgsd-orchestrate frontmatter style.
      This task creates SCAFFOLDING only — frontmatter + 8 placeholder step headers.
      Bodies filled in 13-05-03. Splitting keeps context per-task <25%.
    output_contract: |
      `super-gsd/skills/sgsd-complete-milestone/SKILL.md` exists with:
      - Valid YAML frontmatter with name, description, argument-hint, allowed-tools (all 9 tools above)
      - `<objective>` block stating idempotent close + D-18a auto-trigger context + uses `{{version}}` templating
      - 8 step XML blocks (initially empty placeholders):
        `<step_0_precondition>` through `<step_8_state_bump>`
      - Each step has its `## Step N: {Name}` header inside the XML block so grep can count them
      Total file size at this task end: ~60 lines (frontmatter + skeleton). Bodies arrive in 13-05-03.
      File is committable and parseable even while bodies are stubbed — this is intentional for
      the verify.mjs invariant 11 (skill file exists + frontmatter correct).
    hypothesis: |
      Scaffolding-first keeps the task surface tight. Frontmatter shape is the single highest-risk
      mechanical artifact (invariant 11 greps for name, allowed-tools, mcp__vtp-kb__vtp_ingest_research).
      Getting it right in isolation before populating 8 step bodies (~220 more lines in 13-05-03)
      prevents a reviewer having to untangle frontmatter bugs from body bugs at ATC.
    falsifier: |
      (a) Frontmatter missing `name: sgsd-complete-milestone` (invariant 11 fails).
      (b) `allowed-tools` missing `mcp__vtp-kb__vtp_ingest_research` (invariant 11 fails).
      (c) Fewer than 8 step XML tags (grep -c '<step_' < 8; invariant 16 fails).
      (d) Step XML tag names drift from the research-recommended `step_0_precondition`..`step_8_state_bump`
      (invariant 16 greps these exact tag names).
      (e) File committed to user-local `~/.claude/skills/` instead of repo-tracked `super-gsd/skills/`
      (violates D-16 per <policy_guard> clarification).
    stop_rule: |
      File exists at `super-gsd/skills/sgsd-complete-milestone/SKILL.md`, frontmatter parses as YAML,
      `grep -c "<step_[0-9]_" SKILL.md` returns 9 (step_0 through step_8 = 9 tags with underscore-prefix-digit),
      and `grep -q "mcp__vtp-kb__vtp_ingest_research" SKILL.md` returns 0 (present).
    verification_cmd: |
      test -f super-gsd/skills/sgsd-complete-milestone/SKILL.md && \
      grep -q "^name: sgsd-complete-milestone" super-gsd/skills/sgsd-complete-milestone/SKILL.md && \
      grep -q "mcp__vtp-kb__vtp_ingest_research" super-gsd/skills/sgsd-complete-milestone/SKILL.md && \
      test "$(grep -cE '<step_[0-8]_' super-gsd/skills/sgsd-complete-milestone/SKILL.md)" -ge 9
    verification_gates:
      - "SKILL.md exists at repo-tracked path → exit 0"
      - "name: sgsd-complete-milestone present → exit 0"
      - "mcp__vtp-kb__vtp_ingest_research in allowed-tools → exit 0"
      - "9 step XML tags (step_0..step_8) present → count >= 9"
    depends_on: [13-05-01]

  - id: 13-05-03
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-complete-milestone/SKILL.md
    input_contract: |
      13-CONTEXT.md D-16 items 1-5 + 7-8 (precondition, GOV-05 audit, MUDA recurrence,
      cross-phase check, summary gen, archive, STATE bump — NOT step 6 VTP; that ships in 13-05-05).
      13-RESEARCH.md §Q7 step-body pseudo-code (8 steps enumerated):
        Step 0 — precondition (ROADMAP.md all [x], schema_version:2 precondition, idempotency early-exit)
        Step 1 — GOV-05 scoring audit → `.planning/metrics/deliberation-outcomes.jsonl` (8 fields per D-09)
        Step 2 — MUDA recurrence: `bash super-gsd/scripts/sgsd-muda-recurrence.sh --milestone {{version}} --kill-check`
        Step 3 — Edge-guard drift audit: group `.planning/metrics/edge-guard-log.jsonl` by gate name, flag >3 skips
        Step 4 — Cross-phase integration check: dispatch gsd-integration-checker
        Step 5 — SUMMARY.md generation: Shipped, Evidence, Rules Learned, Frontmatter vtp_*
        Step 7 — Archive: mv phases → milestones/{{version}}/phases/, invalidate classifier-cache
        Step 8 — STATE bump: next milestone OR milestone_status: complete, commit
      GOV-05 schema (D-09) — JSONL row fields locked:
        ts, milestone, dlb_id, q1_impl_hours_actual, rework_fired, falsifier_fired,
        revisions_needed, confidence_weighted_sum, raw_vote, reflection_captured (added per D-15)
      Integration with SGSD 2.0 stack (D-17): read gates.yaml state, v2 schema precondition,
      Phase 12 classifier-cache invalidation, Phase 12 checkpoint seed, Phase 10 edge-guard.
    output_contract: |
      `super-gsd/skills/sgsd-complete-milestone/SKILL.md` has populated bodies for steps 0, 1, 2, 3,
      4, 5, 7, 8 (everything EXCEPT step 6 VTP which ships in 13-05-05). Each step body:
      - Concrete bash/Node commands or pseudo-code
      - File path write targets from D-18 output contract: SUMMARY.md, deliberation-outcomes.jsonl,
        muda-recurrence.md, gate-drift-audit.md, phases/, vtp-research-id.txt (written in step 6 later)
      - Step 0 includes the `v1_legacy: true` permission path per D-17 (milestone plans MUST have
        `schema_version: 2` OR `v1_legacy: true` frontmatter flag)
      - Step 0 includes idempotency check: if `.planning/milestones/{{version}}/SUMMARY.md` exists, exit 0 PASS
      - Step 1 explicitly writes all 10 D-09 JSONL fields (including `reflection_captured` D-15)
      File grows to ~200 lines (scaffolding ~60 + 7 step bodies ~140).
      Step 6 remains a stub `TODO: VTP bidirectional in 13-05-05` so the file still parses.
    hypothesis: |
      Populating 7 non-VTP steps in one task keeps context bounded (~30% budget) while leaving
      the single riskiest step (VTP 3-tier logic) isolated in its own task (13-05-05) where the
      tier-verdict from 13-05-01 is the sole input. Splitting by risk — not by line count — keeps
      the 3-tier complexity isolated for future ATC review rather than buried in a 200-line diff.
    falsifier: |
      (a) Step 0 missing the `[x]` precondition check (skill would run mid-milestone and corrupt state).
      (b) Step 0 missing idempotency early-exit (re-running on closed milestone would re-archive).
      (c) Step 1 JSONL schema missing any of the 10 D-09/D-15 fields — GOV-05 contract violation.
      (d) Step 2 doesn't invoke `sgsd-muda-recurrence.sh` with `--kill-check` flag per D-16 item 3.
      (e) Step 7 archive path is not `.planning/milestones/{{version}}/phases/` (D-18 output contract).
      (f) Step 8 doesn't commit with the message format from research §Q7 step 8.
    stop_rule: |
      All 8 step XML blocks contain body content (non-empty between opening and closing tags for
      0,1,2,3,4,5,7,8 — step 6 still a stub TODO). File grep for D-16/D-17 anchor strings:
      `ROADMAP.md`, `deliberation-outcomes.jsonl`, `sgsd-muda-recurrence.sh`, `edge-guard-log.jsonl`,
      `gsd-integration-checker`, `.planning/milestones/`, `classifier-cache`, `v1_legacy`.
    verification_cmd: |
      grep -q "ROADMAP.md" super-gsd/skills/sgsd-complete-milestone/SKILL.md && \
      grep -q "deliberation-outcomes.jsonl" super-gsd/skills/sgsd-complete-milestone/SKILL.md && \
      grep -q "sgsd-muda-recurrence.sh" super-gsd/skills/sgsd-complete-milestone/SKILL.md && \
      grep -q "edge-guard-log.jsonl" super-gsd/skills/sgsd-complete-milestone/SKILL.md && \
      grep -q "gsd-integration-checker" super-gsd/skills/sgsd-complete-milestone/SKILL.md && \
      grep -q "v1_legacy" super-gsd/skills/sgsd-complete-milestone/SKILL.md && \
      grep -q "reflection_captured" super-gsd/skills/sgsd-complete-milestone/SKILL.md
    verification_gates:
      - "ROADMAP precondition anchor → exit 0"
      - "deliberation-outcomes.jsonl anchor → exit 0"
      - "sgsd-muda-recurrence.sh invocation → exit 0"
      - "edge-guard-log.jsonl reference → exit 0"
      - "gsd-integration-checker dispatch → exit 0"
      - "v1_legacy flag accepted (D-17) → exit 0"
      - "reflection_captured field (D-15) → exit 0"
    depends_on: [13-05-02]

  - id: 13-05-04
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
    input_contract: |
      13-CONTEXT.md D-18a (auto-trigger after Rule 6.g marks last phase complete).
      13-RESEARCH.md §Q6 insertion point: after sgsd-orchestrate/SKILL.md line 677
      (`i. Mark phase complete, advance to next phase.`). Add new `Step 6.7: MILESTONE COMPLETE
      AUTO-TRIGGER (GOV / D-18a)` with the 3-step logic:
        a. Read .planning/ROADMAP.md (full — milestone-close is rare)
        b. Extract phase list for active milestone (STATE.md frontmatter milestone field)
        c. Check: all milestone phases have [x]?
           NO  → Continue to next loop iteration
           YES → Agent(subagent_type: sgsd-complete-milestone, mode: "bypassPermissions",
                       prompt: {milestone: "{version}", auto_trigger: true})
      Skill is idempotent per D-18a — re-entry during resume is safe.
      Invariant 12 from 13-RESEARCH.md §Q9: sgsd-orchestrate/SKILL.md must contain substring
      "all milestone phases" OR "Step 6.7" header marker.
    output_contract: |
      `super-gsd/skills/sgsd-orchestrate/SKILL.md` has a new Step 6.7 block inserted AFTER the
      current line 677 ("Mark phase complete, advance to next phase.") and BEFORE the current
      step "7. COMPOSE PROMPT" (which starts at line 694).
      Block structure:
        ```
        6.7. MILESTONE COMPLETE AUTO-TRIGGER (GOV-13 / D-18a)

        After Step 6.6.i marks a phase complete:

          a. Read .planning/ROADMAP.md (full — milestone-close is a rare event).
          b. Extract phase list for active milestone (STATE.md milestone: frontmatter field).
          c. Check: do all milestone phases show [x] in ROADMAP.md?
             NO  → Continue loop (next iteration of <loop>).
             YES → Auto-dispatch (no operator prompt):
               TaskCreate({content: "Close milestone {version}",
                           activeForm: "sgsd-complete-milestone — auto-trigger",
                           status: "in_progress"})
               Agent(subagent_type: "sgsd-complete-milestone", mode: "bypassPermissions",
                     prompt: {milestone: "{version from STATE.md}", auto_trigger: true})
               Skill is idempotent — PASS if already archived.
               TaskUpdate(taskId, status: "completed")
               On BLOCKER in skill report → halt loop. On success → exit loop per Rule 6.9.
        ```
      No other orchestrator logic modified. Step numbering: 6.6, 6.7 (NEW), 7.
      File grows by ~25 lines.
    hypothesis: |
      Single-site insertion at the phase-complete boundary is the lowest-risk way to add
      auto-trigger — existing logic flow is untouched, the new block reads ROADMAP.md only
      when a phase just finished (rare, cheap), and the dispatch is idempotent so resume
      scenarios don't duplicate milestone closure. Step 6.7 number slots cleanly between
      6.6 and 7 without renumbering.
    falsifier: |
      (a) Insertion is NOT after line 677 (e.g., before 6.6 which would run before browser verify).
      (b) Step 6.7 header missing the `D-18a` marker (invariant 12 greps "all milestone phases").
      (c) Auto-dispatch uses a different subagent_type than `sgsd-complete-milestone`.
      (d) Mode is not `bypassPermissions` (would require operator prompt — violates "no operator prompt").
      (e) Renumbered existing steps (must preserve 6.6.a-i and step 7 numbering).
      (f) Dispatch happens unconditionally without the "all milestone phases [x]" check.
    stop_rule: |
      `grep -n "Step 6.7\|6.7\." super-gsd/skills/sgsd-orchestrate/SKILL.md` finds a Step 6.7 line,
      `grep -q "all milestone phases" super-gsd/skills/sgsd-orchestrate/SKILL.md` succeeds,
      `grep -q "sgsd-complete-milestone" super-gsd/skills/sgsd-orchestrate/SKILL.md` succeeds.
    verification_cmd: |
      grep -q "6.7" super-gsd/skills/sgsd-orchestrate/SKILL.md && \
      grep -q "all milestone phases" super-gsd/skills/sgsd-orchestrate/SKILL.md && \
      grep -q "sgsd-complete-milestone" super-gsd/skills/sgsd-orchestrate/SKILL.md && \
      grep -q "bypassPermissions" super-gsd/skills/sgsd-orchestrate/SKILL.md
    verification_gates:
      - "Step 6.7 marker present → exit 0"
      - "'all milestone phases' anchor (invariant 12) → exit 0"
      - "sgsd-complete-milestone dispatch reference → exit 0"
      - "bypassPermissions mode on dispatch → exit 0"
    depends_on: [13-05-02]

  - id: 13-05-05
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-complete-milestone/SKILL.md
    input_contract: |
      13-CONTEXT.md D-16 item 6 (VTP bidirectional) + D-18b three-tier fallback ladder.
      Tier verdict FROM 13-05-01 spike (`.planning/phases/13-governance/plans/13-05-01-vtp-probe.md`)
      determines which branch is PRIMARY; other tiers are fallback.
      Step 6 body per research §Q7:
        6a. INGEST — mcp__vtp-kb__vtp_search({query: "milestone {{version}} SGSD"}),
            mcp__vtp-kb__vtp_list_research({type: "Milestone"}) — tolerate filter unsupported.
            Prepend 2-3 results as `## Context Pulled From VTP` footer in SUMMARY.md.
        6b. PUBLISH — three-tier ladder:
            tier-1: mcp__vtp-kb__vtp_ingest_research({title, body, classification: "Milestone",
                                                      tags: ["sgsd", "milestone_{{version}}"]})
              on schema error → tier-2
            tier-2: classification: "Milestone (SGSD v2)" + write VTP-CLASSIFICATION-GAP.md
              on schema error → tier-3
            tier-3: classification: {best-fit existing} + metadata.sgsd_type: "milestone"
                    + write VTP-CLASSIFICATION-GAP.md urgency HIGH
            All tiers write returned ID to `.planning/milestones/{{version}}/vtp-research-id.txt`
            All tiers update SUMMARY.md frontmatter: `vtp_classification_used`, `vtp_research_id`
      VTP-CLASSIFICATION-GAP.md template content: enumerate exactly which VTP API change
      would move SGSD to tier-1.
      Invariant 13 from 13-RESEARCH.md §Q9: grep for `tier-1`, `tier-2`, `tier-3` OR all three
      phrases `classification: "Milestone"`, `classification: "Milestone (SGSD v2)"`, `sgsd_type: milestone`.
    output_contract: |
      `super-gsd/skills/sgsd-complete-milestone/SKILL.md` Step 6 body fully populated with:
      - 6a INGEST block: both VTP search calls with untyped fallback path
      - 6b PUBLISH block with tier-1/tier-2/tier-3 branches EXPLICITLY LABELED (literal strings
        `tier-1`, `tier-2`, `tier-3` OR the three classification strings above)
      - VTP-CLASSIFICATION-GAP.md template inlined or referenced (content enumerating VTP API gap)
      - `vtp_research_id.txt` write path
      - SUMMARY.md frontmatter update: `vtp_classification_used`, `vtp_research_id`
      - The tier-1/tier-2/tier-3 PRIMARY path matches the spike verdict from 13-05-01; the
        other two tiers are documented fallbacks
      Step 6 TODO stub from 13-05-03 replaced. File grows to ~260-280 lines final.
      Sub-artifact: `VTP-CLASSIFICATION-GAP.md` template body CAN live inline as a HEREDOC in
      the skill (simpler) OR as a sibling template file — skill chooses the HEREDOC per
      research §Q5 "gap-memo template belongs in plan 13-05 as a Task action".
    hypothesis: |
      Isolating VTP 3-tier logic in its own task (rather than bundling with 13-05-03 step bodies)
      means the tier-verdict from 13-05-01 maps 1:1 to this task's primary branch. The three
      tier-labels are verifiable via a single grep invariant (inv 13) — no branch-specific
      verification needed. VTP-CLASSIFICATION-GAP.md as inline HEREDOC avoids a second file
      creation and keeps the gap template versioned with the skill that emits it.
    falsifier: |
      (a) Step 6 body missing one of the three tier labels (invariant 13 fails via grep).
      (b) PRIMARY tier branch in Step 6 contradicts 13-05-01 spike verdict (e.g., spike said
      TIER-2 but code does tier-1 first with no fallback-up documented).
      (c) No VTP-CLASSIFICATION-GAP.md reference when spike verdict ∈ {TIER-2, TIER-3} (D-18b
      says "always ship gap memo when not tier-1").
      (d) `vtp_research_id.txt` write path missing (D-18 output contract violation).
      (e) SUMMARY.md frontmatter fields `vtp_classification_used` + `vtp_research_id` not
      updated — round-tripping breaks.
      (f) tier-3 label present but no `sgsd_type: milestone` metadata tag (D-18b tier-3 shape).
    stop_rule: |
      Step 6 XML block is non-empty, contains `tier-1`/`tier-2`/`tier-3` OR the three
      classification strings. File contains `VTP-CLASSIFICATION-GAP.md`, `vtp-research-id.txt`,
      `vtp_classification_used`, `sgsd_type: milestone`, `vtp_search`, `vtp_list_research`,
      `vtp_ingest_research` at minimum.
    verification_cmd: |
      grep -q "tier-1\|classification: \"Milestone\"" super-gsd/skills/sgsd-complete-milestone/SKILL.md && \
      grep -q "tier-2\|classification: \"Milestone (SGSD v2)\"" super-gsd/skills/sgsd-complete-milestone/SKILL.md && \
      grep -q "tier-3\|sgsd_type: milestone" super-gsd/skills/sgsd-complete-milestone/SKILL.md && \
      grep -q "VTP-CLASSIFICATION-GAP.md" super-gsd/skills/sgsd-complete-milestone/SKILL.md && \
      grep -q "vtp-research-id.txt" super-gsd/skills/sgsd-complete-milestone/SKILL.md && \
      grep -q "vtp_classification_used" super-gsd/skills/sgsd-complete-milestone/SKILL.md && \
      grep -q "vtp_list_research" super-gsd/skills/sgsd-complete-milestone/SKILL.md && \
      grep -q "vtp_ingest_research" super-gsd/skills/sgsd-complete-milestone/SKILL.md
    verification_gates:
      - "tier-1 OR classification: 'Milestone' → exit 0"
      - "tier-2 OR classification: 'Milestone (SGSD v2)' → exit 0"
      - "tier-3 OR sgsd_type: milestone → exit 0"
      - "VTP-CLASSIFICATION-GAP.md gap-memo referenced → exit 0"
      - "vtp-research-id.txt write path present → exit 0"
      - "vtp_classification_used frontmatter key → exit 0"
      - "vtp_list_research + vtp_ingest_research MCP calls present → exit 0"
    depends_on: [13-05-03]

must_haves:
  truths:
    - "VTP tier verdict captured in `.planning/phases/13-governance/plans/13-05-01-vtp-probe.md` (one of TIER-1/TIER-2/TIER-3)"
    - "`super-gsd/skills/sgsd-complete-milestone/SKILL.md` exists with `name: sgsd-complete-milestone` frontmatter (D-16 repo-tracked path)"
    - "allowed-tools includes mcp__vtp-kb__vtp_search, vtp_list_research, vtp_ingest_research (D-16 item 6)"
    - "8 step XML blocks present: step_0_precondition through step_8_state_bump"
    - "Step 0 precondition: ROADMAP.md all [x] check + schema_version:2/v1_legacy gate + idempotency early-exit"
    - "Step 1 GOV-05 audit writes all 10 D-09 JSONL fields including reflection_captured (D-15)"
    - "Step 2 invokes sgsd-muda-recurrence.sh with --kill-check"
    - "Step 3 groups edge-guard-log.jsonl by gate, flags >3 skips"
    - "Step 4 dispatches gsd-integration-checker"
    - "Step 5 writes .planning/milestones/{{version}}/SUMMARY.md with Shipped/Evidence/Rules Learned/VTP frontmatter"
    - "Step 6 VTP bidirectional: ingest (search + list_research) + publish 3-tier ladder with explicit tier labels"
    - "Step 6 writes VTP-CLASSIFICATION-GAP.md when primary tier is TIER-2 or TIER-3"
    - "Step 7 archives phases to .planning/milestones/{{version}}/phases/ and invalidates classifier-cache"
    - "Step 8 bumps STATE.md milestone and commits"
    - "sgsd-orchestrate/SKILL.md contains Step 6.7 auto-trigger block referencing 'all milestone phases' and 'sgsd-complete-milestone' in bypassPermissions mode (D-18a)"
  artifacts:
    - path: ".planning/phases/13-governance/plans/13-05-01-vtp-probe.md"
      provides: "Tier verdict spike result; drives 13-05-05 primary branch selection"
      contains: "## Spike Design, ## Observed Schema, ## Tier Verdict (TIER-1|TIER-2|TIER-3), ## Impact on 13-05-03/05"
    - path: "super-gsd/skills/sgsd-complete-milestone/SKILL.md"
      provides: "Milestone-close orchestration skill with bidirectional VTP + GOV-05 + MUDA + edge-guard + cross-phase integration"
      contains: "frontmatter (name, argument-hint, allowed-tools), <objective>, <step_0_precondition>..<step_8_state_bump>, 3-tier VTP branches, VTP-CLASSIFICATION-GAP.md template"
      min_lines: 240
    - path: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      provides: "Updated orchestrator with Step 6.7 auto-trigger"
      contains: "Step 6.7 block after line 677; 'all milestone phases' check; bypassPermissions dispatch to sgsd-complete-milestone"
  key_links:
    - from: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      to: "super-gsd/skills/sgsd-complete-milestone/SKILL.md"
      via: "Agent(subagent_type: 'sgsd-complete-milestone', mode: 'bypassPermissions')"
      pattern: "sgsd-complete-milestone"
    - from: "super-gsd/skills/sgsd-complete-milestone/SKILL.md"
      to: ".planning/metrics/deliberation-outcomes.jsonl"
      via: "Step 1 append-write with 10-field D-09/D-15 row"
      pattern: "deliberation-outcomes\\.jsonl"
    - from: "super-gsd/skills/sgsd-complete-milestone/SKILL.md"
      to: "super-gsd/templates/decision-memo.md"
      via: "Step 1 audit greps `## Post-Synthesis Reflection` per D-15"
      pattern: "Post-Synthesis Reflection"
    - from: "super-gsd/skills/sgsd-complete-milestone/SKILL.md"
      to: "mcp__vtp-kb__vtp_ingest_research"
      via: "Step 6b publish call with tier-1/2/3 classification"
      pattern: "vtp_ingest_research"
---

# Plan 13-05: sgsd-complete-milestone Skill + VTP Bidirectional + Orchestrator Auto-Trigger

## Objective

Ship the new `sgsd-complete-milestone` skill (repo-tracked at `super-gsd/skills/`) that closes
a milestone via: precondition check (ROADMAP all [x], v2 schema/v1_legacy gate, idempotency),
GOV-05 deliberation-outcomes audit, MUDA recurrence check, edge-guard drift audit, cross-phase
integration check, SUMMARY.md generation, VTP bidirectional (ingest enrichment + publish with
D-18b 3-tier classification fallback), phase archive, and STATE.md bump. Also insert the
D-18a auto-trigger into `sgsd-orchestrate/SKILL.md` Step 6.7 so the orchestrator auto-dispatches
this skill when all milestone phases hit [x].

Purpose: Satisfies **GOV-05** (deliberation-outcomes.jsonl audit per D-09..D-11), **D-16**
(new repo-tracked skill with 8-step workflow), **D-18a** (orchestrator auto-trigger, no
operator prompt), **D-18b** (VTP 3-tier classification resilience), and integrates the full
SGSD 2.0 stack per **D-17** (v2 schema, gates.yaml, classifier-cache, checkpoint template,
edge-guard log).

Output: 3 primary files — `super-gsd/skills/sgsd-complete-milestone/SKILL.md` (new, ~260
lines), `super-gsd/skills/sgsd-orchestrate/SKILL.md` (edited, +25 lines Step 6.7), and
`.planning/phases/13-governance/plans/13-05-01-vtp-probe.md` (spike).

Wave 1 — parallel with plan 13-04 (zero file overlap: 13-04 edits `templates/decision-memo.md`;
13-05 creates `skills/sgsd-complete-milestone/` directory + edits `skills/sgsd-orchestrate/`).

## Tasks

Task breakdown follows 13-VALIDATION.md tasks 13-05-01 through 13-05-05. All contracts,
hypotheses, falsifiers, stop rules live in the frontmatter above — canonical executor contract.

### 13-05-01 — VTP Classification Probe (Spike-First)

Call `ToolSearch({query: "select:mcp__vtp-kb__vtp_ingest_research", max_results: 1})` to
retrieve the tool's parameter schema. Write `13-05-01-vtp-probe.md` with the observed schema
and a TIER-1/2/3 verdict per D-18b. Spike-first pattern mirrors Phase 12 plan 12-02-00 —
evidence before implementation. No skill code written in this task.

### 13-05-02 — Skill Scaffolding

Create `super-gsd/skills/sgsd-complete-milestone/SKILL.md` with frontmatter (name,
argument-hint, allowed-tools including all three VTP MCP tools), `<objective>` block
referencing idempotency + D-18a auto-trigger, and 8 step XML scaffold tags
(`<step_0_precondition>` through `<step_8_state_bump>`) with step headers but empty bodies.
~60 lines. File parses cleanly and satisfies invariants 11 and 16.

### 13-05-03 — Step Bodies (7 non-VTP steps)

Populate step bodies for 0, 1, 2, 3, 4, 5, 7, 8 per research §Q7 pseudo-code. Step 6 stays
TODO (isolated to 13-05-05 where VTP tier-logic lands cleanly). Step 1 writes the full D-09
10-field JSONL row including `reflection_captured` (D-15). Step 0 includes the `v1_legacy: true`
permission path (D-17) and idempotency early-exit. File grows to ~200 lines.

### 13-05-04 — Orchestrator Step 6.7 Auto-Trigger

Insert Step 6.7 block after line 677 (phase-complete mark) in `sgsd-orchestrate/SKILL.md`.
Block reads ROADMAP.md, checks all milestone phases [x], dispatches
`Agent(subagent_type: 'sgsd-complete-milestone', mode: 'bypassPermissions')`. Skill is
idempotent so resume-safe. ~25 new lines; no renumbering of existing 6.6 / 7 steps.

### 13-05-05 — VTP Step 6 (3-tier Ladder)

Populate Step 6 with ingest (search + list_research untyped fallback) + publish 3-tier
branches. Primary branch matches 13-05-01 verdict. Tier labels literal (`tier-1`, `tier-2`,
`tier-3` OR the three classification strings). Inline `VTP-CLASSIFICATION-GAP.md` HEREDOC
when primary tier is not TIER-1. Write `vtp-research-id.txt` and update SUMMARY.md
frontmatter (`vtp_classification_used`, `vtp_research_id`). File final size ~260-280 lines.

## Verification Gates (Wave close)

Run in sequence:

1. Spike doc exists with TIER verdict → `grep -qE "TIER-1|TIER-2|TIER-3" 13-05-01-vtp-probe.md` exit 0
2. Skill frontmatter correct → `grep -q "^name: sgsd-complete-milestone" SKILL.md` exit 0
3. All 9 step XML tags present (`step_0` through `step_8`) → `grep -cE '<step_[0-8]_' >= 9`
4. 7 non-VTP step anchors present (ROADMAP, deliberation-outcomes.jsonl, sgsd-muda-recurrence.sh,
   edge-guard-log.jsonl, gsd-integration-checker, v1_legacy, reflection_captured) → all grep exit 0
5. Orchestrator Step 6.7 anchors present ("6.7", "all milestone phases", "sgsd-complete-milestone",
   "bypassPermissions") → all grep exit 0
6. VTP Step 6 tier labels + gap-memo anchors → all 7 greps exit 0

## Success Criteria

- Spike file exists with a TIER verdict (TIER-1, TIER-2, or TIER-3).
- `sgsd-complete-milestone/SKILL.md` exists with valid frontmatter and 8 populated step bodies.
- `sgsd-orchestrate/SKILL.md` contains Step 6.7 auto-trigger with bypassPermissions dispatch.
- Invariants 11, 12, 13, 16 in Phase 13 verify.mjs go GREEN after 13-05 commits land.
- All 5 tasks' verification_cmds exit 0.

## Output

After completion, create `.planning/phases/13-governance/plans/13-05-SUMMARY.md` summarising:
- 5 tasks, 3 files modified
- VTP tier verdict from 13-05-01 and which tier became the primary publish branch
- Skill total LOC; orchestrator Step 6.7 line range
- Note which of verify.mjs invariants 11, 12, 13, 16 turn green after this plan commits
- 5 commit SHAs (one per task)
