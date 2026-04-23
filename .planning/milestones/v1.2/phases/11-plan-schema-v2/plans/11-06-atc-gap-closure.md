---
phase: 11-plan-schema-v2
plan: 06
type: execute
wave: 3
depends_on:
  - "11-01"
  - "11-02"
  - "11-03"
  - "11-05"
files_modified:
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
  - super-gsd/skills/sgsd-write-plan/SKILL.md
  - super-gsd/tools/plan-schema/validate.cjs
  - custom-gsd-extract/claude-agents/gsd-planner.md
autonomous: true
gap_closure: true
requirements:
  - SCHEMA-02
  - SCHEMA-05

must_haves:
  truths:
    - "Rule 8.5 locked_fields extraction references task.hypothesis (the schema field), not task.goal (undefined)"
    - "validate.cjs dead variables removed; fixture probes unchanged (exit 0 good-plan, exit 1 bad-plan)"
    - "sgsd-write-plan Step 4 uses deterministic Write-tool draft path, not mktemp"
    - "ANCHOR comment in orchestrate SKILL.md no longer contains Phase 11 planning-history footnote"
  artifacts:
    - path: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      provides: "WR-01 field rename + IN-01 comment trim"
      contains: "task.hypothesis"
    - path: "super-gsd/tools/plan-schema/validate.cjs"
      provides: "WR-02+03 dead code removed, WR-04 comment added"
    - path: "super-gsd/skills/sgsd-write-plan/SKILL.md"
      provides: "WR-05 deterministic draft path"
      contains: ".sgsd-draft-plan.md"
    - path: "custom-gsd-extract/claude-agents/gsd-planner.md"
      provides: "WR-01 mirror updated"
      contains: "task.hypothesis"
  key_links:
    - from: "sgsd-orchestrate/SKILL.md locked_fields block"
      to: "plan-schema-v2.json task.hypothesis field"
      via: "field name alignment"
      pattern: "locked_fields.*hypothesis"

# v2 plan self-referential frontmatter
schema_version: 2
tasks:
  - id: t1
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
      - custom-gsd-extract/claude-agents/gsd-planner.md
    input_contract: >
      WR-01 finding: `task.goal` referenced in locked_fields extraction block
      (sgsd-orchestrate/SKILL.md line ~290) and in gsd-planner.md fix_schema_mode
      section (lines 843, 848, 854, 870, 871) but `goal` is not a defined field
      in plan-schema-v2.json. The canonical field name is `hypothesis`.
    output_contract: >
      Both files updated so all references to `task.goal` / `locked_fields.goal`
      in the schema-fix retry context read `task.hypothesis` /
      `locked_fields.hypothesis`. No other lines changed. Mirror note present in
      task notes (see below).
    hypothesis: >
      Field-name drift between `goal` (never in schema) and `hypothesis` (defined
      in schema) prevents Rule 8.5 locked-field enforcement from extracting the
      correct field, causing silent data loss on schema-fix retry cycles.
    falsifier: >
      After edit, grep finds any occurrence of `task.goal` or `locked_fields.goal`
      in the schema-fix retry sections of either file; OR `hypothesis` is missing
      from those same sections.
    stop_rule: >
      Zero matches for `goal` in the locked_fields block of sgsd-orchestrate
      SKILL.md (lines 285-292 approx); zero matches for `task.goal` in
      gsd-planner.md fix_schema_mode section (lines 843-875 approx).
    expected_ATC_tier: LITE
    depends_on: []
    known_deadends: []
    verification_cmd: >
      grep -n "task\.goal\|locked_fields\.goal" super-gsd/skills/sgsd-orchestrate/SKILL.md | grep -v "hypothesis" &&
      echo "FAIL: goal drift remains in orchestrate" || echo "PASS: orchestrate clean";
      grep -n "task\.goal\|locked_fields\.goal" custom-gsd-extract/claude-agents/gsd-planner.md &&
      echo "FAIL: goal drift remains in planner" || echo "PASS: planner clean"

  - id: t2
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/plan-schema/validate.cjs
    input_contract: >
      WR-02: `keyOccurrences` Map (line 199), `count` local var (line 207),
      `totalOccurrences` (lines 210) in deduplicateTopLevelKeys — all computed,
      never read after assignment. Algorithm output is determined solely by
      `seen.get(key) === i` comparison on the pre-built `seen` Map.
      WR-03: `let field = null` block (lines 315-320) inside the `errorMessage`
      branch of formatErrors — `field` is assigned but never referenced; the
      branch uses only `e.message` and `taskIndex`.
      WR-04: `addFormats(ajv)` at line 148 loads all ajv-formats validators;
      plan-schema-v2.json has zero `format` keywords. Disposition: retain but
      add inline documentation comment.
    output_contract: >
      validate.cjs with: (a) dead vars in deduplicateTopLevelKeys removed (~5
      lines deleted), (b) dead `field` block in errorMessage branch removed (~6
      lines deleted), (c) single-line comment added after `addFormats(ajv)` call
      documenting forward-compat intent. Functional behaviour identical — all
      existing tests still pass (exit 0 for good-plan.md, exit 1 for bad-plan.md).
    hypothesis: >
      Dead variables and the dead field-extraction block add noise that masks
      future bugs; removing them makes the algorithm's actual logic (seen.get
      index comparison) self-evident without any behavioural change.
    falsifier: >
      After edit: `node validate.cjs --plan-file fixtures/good-plan.md --mode load`
      exits non-zero; OR `node validate.cjs --plan-file fixtures/bad-plan.md
      --mode load` exits 0; OR `keyOccurrences` / `totalOccurrences` / the dead
      `field` block still appear in the file.
    stop_rule: >
      Grep confirms keyOccurrences absent; dead field block absent; addFormats
      comment present; both fixture probes return correct exit codes.
    expected_ATC_tier: LITE
    depends_on: []
    known_deadends: []
    verification_cmd: >
      cd super-gsd/tools/plan-schema &&
      node validate.cjs --plan-file ../../../.planning/phases/11-plan-schema-v2/fixtures/good-plan.md --project-dir ../../.. --mode load &&
      echo "good-plan PASS" &&
      node validate.cjs --plan-file ../../../.planning/phases/11-plan-schema-v2/fixtures/bad-plan.md --project-dir ../../.. --mode load;
      [ $? -eq 1 ] && echo "bad-plan PASS (exit 1 as expected)" || echo "FAIL bad-plan should exit 1"

  - id: t3
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-write-plan/SKILL.md
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
    input_contract: >
      WR-05: sgsd-write-plan SKILL.md Step 4 (lines 129-137) uses `mktemp` +
      heredoc to create a temp draft. `mktemp` path is /tmp/ which may not exist
      or behave correctly under Windows/WSL without explicit WSL context; the
      heredoc `cat >` form is also brittle when plan content contains special
      characters. The Write tool approach (deterministic path, no shell quoting
      issues) is more reliable.
      IN-01: ANCHOR comment at sgsd-orchestrate/SKILL.md line 260 references
      Phase 11 planning history ("Plans 11-04 and 11-05 add sections AFTER this
      anchor") — this is a planning artifact, not runtime behaviour; remove it.
    output_contract: >
      sgsd-write-plan SKILL.md Step 4 rewritten to: (1) write draft to
      deterministic path `.planning/.sgsd-draft-plan.md` via the Write tool,
      (2) run validate.cjs against that path, (3) delete the draft file after
      validation (pass or fail). Heredoc + mktemp removed.
      sgsd-orchestrate SKILL.md line 260: ANCHOR comment text trimmed to remove
      Phase 11 history footnote (keep the ANCHOR marker label itself if it aids
      navigation, remove only the parenthetical planning-history note).
    hypothesis: >
      Replacing mktemp+heredoc with a Write-tool draft eliminates shell quoting
      hazards and /tmp availability assumptions; the deterministic path also makes
      the draft file easy to inspect on failure.
    falsifier: >
      After edit: Step 4 in sgsd-write-plan still references `mktemp` OR the
      deterministic draft path `.planning/.sgsd-draft-plan.md` is absent from
      the instructions; OR the ANCHOR comment still contains the parenthetical
      "Plans 11-04 and 11-05" text.
    stop_rule: >
      Grep confirms `mktemp` absent from sgsd-write-plan SKILL.md Step 4;
      `.sgsd-draft-plan.md` present in Step 4 instructions; ANCHOR comment
      in orchestrate SKILL.md no longer contains "11-04 and 11-05" text.
    expected_ATC_tier: LITE
    depends_on: []
    known_deadends: []
    verification_cmd: >
      grep -n "mktemp" super-gsd/skills/sgsd-write-plan/SKILL.md && echo "FAIL: mktemp still present" || echo "PASS: mktemp removed";
      grep -n "sgsd-draft-plan" super-gsd/skills/sgsd-write-plan/SKILL.md && echo "PASS: draft path present" || echo "FAIL: draft path missing";
      grep -n "11-04 and 11-05" super-gsd/skills/sgsd-orchestrate/SKILL.md && echo "FAIL: planning-history note remains" || echo "PASS: note removed"
---

<objective>
Close 5 ATC warnings (WR-01..05) and 1 informational finding (IN-01) from the
Phase 11 PASS-WITH-DEVIATIONS verdict. All fixes are surgical — no new features,
no scope expansion.

**Single-plan justification:** All 6 items are LITE tier. The three tasks share
review context (validate.cjs + the two SKILL.md files already in context from
reading WR-01..05). Separating WR-01 from the rest would create an orphan plan
with no ordering benefit — none of WR-02..05/IN-01 depend on WR-01 completing
first. One plan, three tasks, zero cross-task dependencies, all parallel-eligible
within the plan.

**Cross-repo note for t1 (WR-01):** `custom-gsd-extract/claude-agents/gsd-planner.md`
is a MIRROR of `~/.claude/agents/gsd-planner.md`. Editing the mirror does NOT
update the live runtime file. After t1 completes, the operator must manually sync:
  cp custom-gsd-extract/claude-agents/gsd-planner.md ~/.claude/agents/gsd-planner.md
This sync step is the operator's responsibility and is NOT automated by this plan.
The executor should add a visible note at the end of the task output as a reminder.

Purpose: Eliminate field-name drift that would corrupt Rule 8.5 locked-field
enforcement (WR-01, highest priority), remove 11 lines of dead code in the
validator (WR-02 + WR-03), document the addFormats forward-compat intent (WR-04),
harden the write-plan draft step for Windows operators (WR-05), and trim a
planning-history comment from the orchestrator (IN-01).

Output:
- super-gsd/skills/sgsd-orchestrate/SKILL.md (WR-01 rename, IN-01 comment trim)
- super-gsd/tools/plan-schema/validate.cjs (WR-02 + WR-03 dead code, WR-04 comment)
- super-gsd/skills/sgsd-write-plan/SKILL.md (WR-05 draft path fix)
- custom-gsd-extract/claude-agents/gsd-planner.md (WR-01 rename — mirror only)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/11-plan-schema-v2/11-VERIFICATION.md
@.planning/phases/11-plan-schema-v2/plans/11-05-SUMMARY.md
</context>

<tasks>

<task type="auto" id="t1">
  <name>Task 1 (WR-01): Rename `goal` to `hypothesis` in Rule 8.5 locked-fields extraction</name>
  <files>
    super-gsd/skills/sgsd-orchestrate/SKILL.md
    custom-gsd-extract/claude-agents/gsd-planner.md
  </files>
  <action>
    **sgsd-orchestrate/SKILL.md — locked_fields block (approx lines 285-292):**

    Locate the `locked_fields = {` block inside Step 6.2 SCHEMA-FIX RETRY LOOP.
    Change:
      `goal:         tasks[*].goal  (verbatim from original),`
    To:
      `hypothesis:   tasks[*].hypothesis  (verbatim from original),`

    No other changes to this file in this task (the ANCHOR comment and other
    edits are handled in t3).

    **custom-gsd-extract/claude-agents/gsd-planner.md — fix_schema_mode section:**

    This file is the MIRROR of ~/.claude/agents/gsd-planner.md. Edit the mirror.
    Locate the fix_schema_mode section (approx lines 825-895).

    Change every occurrence of `task.goal` and `locked_fields.goal` within that
    section to `task.hypothesis` and `locked_fields.hypothesis` respectively.
    Affected lines (approximate — verify by reading before editing):
      - Line 843: `locked_fields` input table row — `goal` column to `hypothesis`
      - Line 848: LOCKED CONSTRAINT header text — "task.goal" to "task.hypothesis"
      - Line 854: constraint body — "task.goal" to "task.hypothesis"
      - Line 870: self-check item — "task.goal" to "task.hypothesis"
      - Line 871: self-check item — "locked_fields.goal" to "locked_fields.hypothesis"

    After editing, confirm no remaining `task.goal` or `locked_fields.goal`
    references exist within the fix_schema_mode section.

    **Sync reminder (add to task output, not to files):**
    "OPERATOR ACTION REQUIRED: sync mirror to runtime location:
     cp custom-gsd-extract/claude-agents/gsd-planner.md ~/.claude/agents/gsd-planner.md"

    Do NOT edit ~/.claude/agents/gsd-planner.md directly — only the mirror.
  </action>
  <verify>
    grep -n "task\.goal\|locked_fields\.goal" super-gsd/skills/sgsd-orchestrate/SKILL.md
    grep -n "task\.goal\|locked_fields\.goal" custom-gsd-extract/claude-agents/gsd-planner.md
    # Expected: zero matches in both files for the old field name within schema-fix context
  </verify>
  <done>
    Zero occurrences of `task.goal` or `locked_fields.goal` remain in the Rule 8.5
    locked-fields extraction block in sgsd-orchestrate/SKILL.md.
    Zero occurrences of `task.goal` or `locked_fields.goal` remain in the
    fix_schema_mode section of the mirror gsd-planner.md.
    `hypothesis` appears in both locations as the canonical field name.
  </done>
</task>

<task type="auto" id="t2">
  <name>Task 2 (WR-02 + WR-03 + WR-04): Remove dead vars in validate.cjs; add addFormats comment</name>
  <files>
    super-gsd/tools/plan-schema/validate.cjs
  </files>
  <action>
    Read validate.cjs in full before editing (file is ~459 lines).

    **WR-02 — deduplicateTopLevelKeys dead vars (approx lines 199, 207-210):**

    In the `deduplicateTopLevelKeys` function, remove these 5 dead lines:
      Line ~199: `const keyOccurrences = new Map(); // key -> count of how many times we've seen it`
      Lines ~207-210:
        `const count = (keyOccurrences.get(key) || 0) + 1;`
        `keyOccurrences.set(key, count);`
        `// Count total occurrences of this key across the whole document`
        `const totalOccurrences = [...seen.entries()].filter(([k]) => k === key).length;`

    The algorithm only uses `seen.get(key) === i` for its keep/skip decision.
    The `seen` Map and `skipUntilNextTopKey` logic are NOT dead — do not touch them.

    **WR-03 — formatErrors errorMessage branch dead field block (approx lines 313-321):**

    In the `formatErrors` function, inside the `if (e.keyword === 'errorMessage')` branch,
    remove the dead field-extraction block (7 lines total including the comment):
      `// Extract missing field name from the nested sub-error if available`
      `let field = null;`
      `const subErrors = (e.params && e.params.errors) || [];`
      `for (const sub of subErrors) {`
      `  if (sub.keyword === 'required' && sub.params && sub.params.missingProperty) {`
      `    field = sub.params.missingProperty;`
      `    break;`
      `  }`
      `}`

    `field` is never read after this block in the `errorMessage` branch.

    **WR-04 — addFormats forward-compat comment (line ~148):**

    Change:
      `addFormats(ajv);`
    To:
      `addFormats(ajv); // no format keywords in v1 schema — retained for v2 additions`

    Confirm the function logic is intact after editing by checking that
    `seen.get(key) === i` remains the branch condition in deduplicateTopLevelKeys.
  </action>
  <verify>
    cd super-gsd/tools/plan-schema && node validate.cjs --plan-file ../../../.planning/phases/11-plan-schema-v2/fixtures/good-plan.md --project-dir ../../.. --mode load
    # Expect: exit 0 + "VALID"
    cd super-gsd/tools/plan-schema && node validate.cjs --plan-file ../../../.planning/phases/11-plan-schema-v2/fixtures/bad-plan.md --project-dir ../../.. --mode load
    # Expect: exit 1 + D-08 error lines
    grep -n "keyOccurrences\|totalOccurrences" super-gsd/tools/plan-schema/validate.cjs
    # Expect: zero matches
  </verify>
  <done>
    validate.cjs passes both fixture probes unchanged (exit 0 good-plan, exit 1 bad-plan).
    `keyOccurrences`, `count = (keyOccurrences...`, `totalOccurrences`, and the dead
    `let field = null` block in the errorMessage branch are absent from the file.
    `addFormats(ajv)` line has the forward-compat comment.
  </done>
</task>

<task type="auto" id="t3">
  <name>Task 3 (WR-05 + IN-01): Replace mktemp+heredoc in sgsd-write-plan; trim ANCHOR comment</name>
  <files>
    super-gsd/skills/sgsd-write-plan/SKILL.md
    super-gsd/skills/sgsd-orchestrate/SKILL.md
  </files>
  <action>
    **WR-05 — sgsd-write-plan/SKILL.md Step 4 (approx lines 128-140):**

    Replace the entire mktemp + heredoc block. Current block to remove:
      TMP_PLAN=$(mktemp /tmp/sgsd-plan-draft-XXXXXX.md)
      cat > "$TMP_PLAN" << 'PLAN_EOF'
      [paste full plan content here]
      PLAN_EOF
      node super-gsd/tools/plan-schema/validate.cjs \
        --plan-file "$TMP_PLAN" \
        --project-dir . \
        --mode write
      EXIT_CODE=$?

    Replace the bash block content with these instructions (keep the surrounding
    Step 4 header and the exit-code table that follows — only replace the bash
    draft-creation block):

      Write the full plan content to: .planning/.sgsd-draft-plan.md
      (Use the Write tool — avoids shell quoting hazards and /tmp path
      assumptions that break on Windows/WSL without explicit context.)

      Then run validate.cjs against the draft:
        node super-gsd/tools/plan-schema/validate.cjs \
          --plan-file .planning/.sgsd-draft-plan.md \
          --project-dir . \
          --mode write

      After validation completes (exit 0 or exit 1), delete the draft:
        rm .planning/.sgsd-draft-plan.md

      EXIT_CODE=$?

    Keep the exit-code handling table (lines ~142-148) unchanged.

    **IN-01 — sgsd-orchestrate/SKILL.md line ~260 ANCHOR comment:**

    Locate this line:
      <!-- ANCHOR: RULE-8.5 — schema-fix dispatch branch. Plans 11-04 and 11-05 add sections AFTER this anchor. -->

    Replace with:
      <!-- ANCHOR: RULE-8.5 — schema-fix dispatch branch -->

    This retains the ANCHOR label for grep/navigation and removes the stale
    planning-history reference.
  </action>
  <verify>
    grep -n "mktemp" super-gsd/skills/sgsd-write-plan/SKILL.md
    # Expect: zero matches
    grep -n "sgsd-draft-plan" super-gsd/skills/sgsd-write-plan/SKILL.md
    # Expect: 1+ matches (the new draft path)
    grep -n "11-04 and 11-05" super-gsd/skills/sgsd-orchestrate/SKILL.md
    # Expect: zero matches
    grep -n "ANCHOR: RULE-8.5" super-gsd/skills/sgsd-orchestrate/SKILL.md
    # Expect: 1 match (trimmed version retained)
  </verify>
  <done>
    sgsd-write-plan/SKILL.md Step 4 references `.planning/.sgsd-draft-plan.md`
    via Write tool; no `mktemp` references remain.
    sgsd-orchestrate/SKILL.md ANCHOR comment retains RULE-8.5 label but no longer
    contains the "Plans 11-04 and 11-05" history note.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| editor to SKILL.md files | Executor edits SKILL.md files that are runtime agent instructions — incorrect edits corrupt agent behaviour |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-06-01 | Tampering | sgsd-orchestrate/SKILL.md locked_fields block | mitigate | Verify via grep after edit that `task.hypothesis` is present and `task.goal` is absent in the renamed section |
| T-11-06-02 | Tampering | validate.cjs deduplicateTopLevelKeys | mitigate | Run both fixture probes (exit 0 + exit 1) after dead-code removal to confirm algorithm unchanged |
| T-11-06-03 | Denial of Service | sgsd-write-plan draft path `.planning/.sgsd-draft-plan.md` | accept | Deterministic path can be left behind on crash; no sensitive data, easy to delete manually |
</threat_model>

<verification>
After all three tasks complete:

1. WR-01 closed:
   grep -n "task\.goal\|locked_fields\.goal" super-gsd/skills/sgsd-orchestrate/SKILL.md
   # zero matches in locked_fields block
   grep -n "task\.goal\|locked_fields\.goal" custom-gsd-extract/claude-agents/gsd-planner.md
   # zero matches in fix_schema_mode section

2. WR-02 + WR-03 closed:
   grep -n "keyOccurrences\|totalOccurrences" super-gsd/tools/plan-schema/validate.cjs
   # zero matches

3. WR-04 documented:
   grep -n "addFormats" super-gsd/tools/plan-schema/validate.cjs
   # line with trailing comment present

4. Validator still functional:
   cd super-gsd/tools/plan-schema && node validate.cjs --plan-file ../../../.planning/phases/11-plan-schema-v2/fixtures/good-plan.md --project-dir ../../.. --mode load
   # exit 0
   cd super-gsd/tools/plan-schema && node validate.cjs --plan-file ../../../.planning/phases/11-plan-schema-v2/fixtures/bad-plan.md --project-dir ../../.. --mode load
   # exit 1

5. WR-05 closed:
   grep -n "mktemp" super-gsd/skills/sgsd-write-plan/SKILL.md
   # zero matches

6. IN-01 closed:
   grep -n "11-04 and 11-05" super-gsd/skills/sgsd-orchestrate/SKILL.md
   # zero matches
</verification>

<success_criteria>
- All 5 WR warnings and 1 IN finding confirmed closed by grep + probe commands
- validate.cjs functional behaviour identical to pre-edit (fixture probes unchanged)
- Operator reminded to sync mirror to ~/.claude/agents/gsd-planner.md (WR-01)
- No speculative additions — every line changed traces to a WR or IN finding
</success_criteria>

<output>
After completion, create `.planning/phases/11-plan-schema-v2/plans/11-06-SUMMARY.md`
</output>
