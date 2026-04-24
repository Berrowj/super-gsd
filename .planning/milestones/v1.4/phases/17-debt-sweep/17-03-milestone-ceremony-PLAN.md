---
schema_version: 2
phase: 17
plan: "17-03"
wave: 3
model: "sonnet"
expected_ATC_tier: "FULL"
depends_on: ["17-01"]
goal: "Retroactively close v1.2 milestone (MILESTONES.md Shipped entry + ROADMAP.md collapse + git tag at 0191168) and wire codex_timeout workload tiers into codex-exec.sh + config.json + SKILL.md call sites"
tasks:
  - id: "T1"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - ".planning/MILESTONES.md"
      - ".planning/ROADMAP.md"
      - ".planning/milestones/v1.2-ROADMAP.md"
    input_contract: "D-02 tag target commit 0191168; .planning/MILESTONES.md §'v1.2 Evidence-First Sharpening' current state; .planning/ROADMAP.md Phases 9-13 entries (the content to archive + collapse)"
    output_contract: "MILESTONES.md v1.2 entry converted from Active to Shipped (date: 2026-04-24); .planning/milestones/v1.2-ROADMAP.md created — archive document populated from current ROADMAP.md Phase-9-through-13 content + MILESTONES.md v1.2 narrative; ROADMAP.md Phases 9-13 collapsed into <details> block after archive is written. Commit: docs(17-03/T1): CLEAN-06 v1.2 retroactive close — MILESTONES.md Shipped + v1.2-ROADMAP.md archive + ROADMAP.md collapse"
    hypothesis: "v1.2 milestone record is formally closed: archive file exists as authoritative record of Phases 9-13, MILESTONES.md reflects Shipped status, and the live ROADMAP.md is visually collapsed without content loss"
    falsifier: "ls .planning/milestones/v1.2-ROADMAP.md returns not found, OR MILESTONES.md still shows v1.2 Active, OR ROADMAP.md Phases 9-13 remain expanded (no <details> block)"
    stop_rule: ".planning/milestones/v1.2-ROADMAP.md exists with Phases 9-13 content; MILESTONES.md v1.2 status: Shipped; ROADMAP.md has <details> wrapping Phases 9-13; single commit with all three changes"
    verification_cmd: "test -f .planning/milestones/v1.2-ROADMAP.md && grep -q 'Shipped' .planning/MILESTONES.md && grep -q '<details>' .planning/ROADMAP.md && echo PASS"
    known_deadends: []

  - id: "T2"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - ".planning/MILESTONES.md"
    input_contract: "D-02: tag target commit 0191168; v1.1 annotated tag as style reference; .planning/MILESTONES.md v1.2 Shipped entry (written by T1) — read to compose tag annotation citing Phases 9-13 deliverables"
    output_contract: "Annotated git tag v1.2 at commit 0191168. Annotation cites Phases 9-13 deliverables drawn from MILESTONES.md. No new file diff — tag is the artifact. Commit: docs(17-03/T2): CLEAN-06 git tag v1.2 at 0191168 — v1.2 Evidence-First Sharpening boundary"
    hypothesis: "v1.2 annotated tag exists at commit 0191168 and MILESTONES.md Shipped status is confirmed"
    falsifier: "git tag -l v1.2 returns empty, OR git rev-list -n1 v1.2 does not resolve to the same commit as 0191168"
    stop_rule: "git tag -l v1.2 returns v1.2; git rev-list -n1 v1.2 matches git rev-parse 0191168"
    depends_on: ["T1"]
    verification_cmd: "git tag -l v1.2 | grep -q v1.2 && git rev-list -n1 v1.2 | grep -q $(git rev-parse 0191168) && echo PASS"
    known_deadends: []

  - id: "T3"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - "super-gsd/scripts/codex-exec.sh"
    input_contract: "D-03 precedence chain (custom:N > --timeout-tier flag > step-name map > codex_timeout_seconds fallback); existing --step flag at line 73 + STEP_TAG variable; step-name map from D-03: smoke/self-test→default(60), per-dispatch-ATC/phase-level-ATC/adversarial→review(120), muda-qualitative/qualitative-*→analysis(180)"
    output_contract: "codex-exec.sh accepts --timeout-tier {default|review|analysis|custom:N} flag; resolves timeout via D-03 precedence chain; emits stderr warning for unmapped step names; existing --step plumbing untouched. Commit: feat(17-03/T3): CLEAN-07 add --timeout-tier flag + step-name map to codex-exec.sh"
    hypothesis: "codex-exec.sh resolves timeout via D-03 precedence (explicit --timeout-tier overrides step-name map; unmatched steps warn and use default 60s)"
    falsifier: "bash -n super-gsd/scripts/codex-exec.sh fails, OR passing --timeout-tier review does not override the step-name default, OR unmatched step produces no stderr warning"
    stop_rule: "bash -n super-gsd/scripts/codex-exec.sh exits 0; --timeout-tier flag parsed; step-name map present; stderr warning emitted for unmapped step names"
    depends_on: []
    verification_cmd: "bash -n super-gsd/scripts/codex-exec.sh && grep -q 'timeout.tier' super-gsd/scripts/codex-exec.sh && echo PASS"
    known_deadends: []

  - id: "T4"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - ".planning/config.json"
    input_contract: "D-03 config shape: additive codex_timeout_tiers block inside review_providers; existing codex_timeout_seconds: 180 stays as backward-compat fallback; target: {default: 60, review: 120, analysis: 180}"
    output_contract: ".planning/config.json review_providers block gains codex_timeout_tiers: {default: 60, review: 120, analysis: 180}; existing codex_timeout_seconds: 180 unchanged. Write via Node script (read→mutate→write, never print values to stdout). Commit: feat(17-03/T4): CLEAN-07 add codex_timeout_tiers block to config.json"
    hypothesis: "config.json review_providers now contains codex_timeout_tiers with 3 named tiers — codex-exec.sh can resolve tier values at runtime"
    falsifier: "node require check for codex_timeout_tiers exits 1, OR codex_timeout_seconds: 180 is absent after write"
    stop_rule: "node -e require check exits 0; codex_timeout_seconds still present; codex_timeout_tiers has keys default/review/analysis"
    depends_on: ["T3"]
    verification_cmd: "node -e \"const c=require('./.planning/config.json'); const t=c.review_providers.codex_timeout_tiers; process.exit((t&&t.default&&t.review&&t.analysis&&c.review_providers.codex_timeout_seconds)?0:1)\" && echo PASS"
    known_deadends: ["Do not use head/cat/echo to read or write config.json — use Node read+mutate+write per feedback_never_head_settings rule"]

  - id: "T5"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - "super-gsd/config/SKILL.md"
    input_contract: "RESEARCH.md CLEAN-07: SKILL.md has exactly 3 shellDispatch call sites consuming codex-exec.sh at lines 492/495, 907/910, 1030. Locate file via: find super-gsd -name 'SKILL.md'. Step 6.5 and 9.5 → --timeout-tier review; Step 9.6 (adversarial) → --timeout-tier review (adversarial maps to review tier per D-03)"
    output_contract: "All 3 shellDispatch call sites in SKILL.md pass --timeout-tier {tier} to codex-exec.sh. Commit: feat(17-03/T5): CLEAN-07 add --timeout-tier args to SKILL.md shellDispatch call sites (3 sites)"
    hypothesis: "All 3 SKILL.md shellDispatch call sites that invoke codex-exec.sh now pass --timeout-tier, enabling the tier resolver added in T3 to select the correct timeout"
    falsifier: "grep -c 'timeout-tier' SKILL.md returns less than 3, OR any call site still omits the --timeout-tier arg"
    stop_rule: "grep -c 'timeout-tier' SKILL.md returns exactly 3; all 3 sites pass appropriate tier"
    depends_on: ["T3"]
    verification_cmd: "SKILL=$(find super-gsd -name 'SKILL.md' | head -1); [ -n \"$SKILL\" ] && grep -c 'timeout-tier' \"$SKILL\" | grep -q '^3$' && echo PASS"
    known_deadends: []

  - id: "T6"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - "super-gsd/scripts/sgsd-muda-audit.sh"
    input_contract: "CLEAN-07 consumer: sgsd-muda-audit.sh qualitative-probe call site to codex-exec.sh; D-03 step-name map: muda-qualitative→analysis (180s)"
    output_contract: "sgsd-muda-audit.sh qualitative-probe call site passes --timeout-tier analysis to codex-exec.sh. Commit: feat(17-03/T6): CLEAN-07 pass --timeout-tier analysis at sgsd-muda-audit qualitative-probe call site"
    hypothesis: "sgsd-muda-audit.sh qualitative probe now requests analysis-tier timeout (180s), resolving the first live Codex invocation exit 5 caused by the 60s default"
    falsifier: "grep on sgsd-muda-audit.sh qualitative call site shows no --timeout-tier analysis arg, OR bash -n fails"
    stop_rule: "grep finds --timeout-tier analysis near the qualitative-probe call; bash -n exits 0"
    depends_on: ["T3"]
    verification_cmd: "grep -q 'timeout-tier.*analysis' super-gsd/scripts/sgsd-muda-audit.sh && bash -n super-gsd/scripts/sgsd-muda-audit.sh && echo PASS"
    known_deadends: []
---

<objective>
Two distinct workstreams combined in wave 3:

**CLEAN-06 (T1, T2):** Retroactively close milestone v1.2. Convert MILESTONES.md entry from Active to Shipped, collapse Phases 9-13 in ROADMAP.md to a `<details>` block, then create annotated git tag `v1.2` pointing at commit `0191168` (last commit before any v1.3 content, per D-02). Tag annotation cites Phase 9-13 deliverables from MILESTONES.md.

**CLEAN-07 (T3, T4, T5, T6):** Wire codex_timeout workload tiers per D-03 precedence. T3 adds the `--timeout-tier` flag and step-name resolver to codex-exec.sh. T4 adds the `codex_timeout_tiers` config block additively to config.json (existing `codex_timeout_seconds: 180` stays as fallback). T5 updates the 3 SKILL.md shellDispatch call sites. T6 updates the sgsd-muda-audit.sh qualitative-probe call site.

Serialization: T3 before T5 and T6 (shell contract in place before callers updated). T1 before T2 (MILESTONES.md Shipped content needed for tag annotation).
</objective>

<context>
@.planning/milestones/v1.4/phases/17-debt-sweep/17-CONTEXT.md
@.planning/milestones/v1.4/phases/17-debt-sweep/17-RESEARCH.md

Read before T1: .planning/MILESTONES.md §v1.2; .planning/ROADMAP.md Phases 9-13
Read before T3: super-gsd/scripts/codex-exec.sh lines 60-100 (--step flag plumbing)
Read before T5: locate SKILL.md via `find super-gsd -name 'SKILL.md'`; read lines 485-500, 900-915, 1025-1035
</context>

<tasks>

**T1 — CLEAN-06: MILESTONES.md + ROADMAP.md**

Files: `.planning/MILESTONES.md`, `.planning/ROADMAP.md`

1. Open `.planning/MILESTONES.md`, find §"v1.2 Evidence-First Sharpening". Change status from Active to Shipped. Add shipped date: 2026-04-24. Retain accomplishments list intact.
2. Open `.planning/ROADMAP.md`. Find Phases 9-13 entries. Wrap them in a `<details><summary>v1.2 Phases (shipped)</summary>...</details>` block. Do not delete content — collapse only.

Commit: `docs(17-03/T1): CLEAN-06 v1.2 retroactive close — MILESTONES.md Shipped entry + ROADMAP.md collapse`

---

**T2 — CLEAN-06: git tag v1.2**

No new file created. MILESTONES.md listed in files_touched because T2 reads it to compose tag annotation.

1. Verify boundary: `git log --oneline e74a763~1 -1` must return `0191168`.
2. Check style reference: `git show v1.1` if that tag exists.
3. Read MILESTONES.md v1.2 accomplishments list (written by T1).
4. Create annotated tag: `git tag -a v1.2 0191168 -m "v1.2 Evidence-First Sharpening — Phases 9-13 complete. [cite accomplishments from MILESTONES.md]. See .planning/MILESTONES.md for full record."`

Commit: `docs(17-03/T2): CLEAN-06 git tag v1.2 at 0191168 — v1.2 Evidence-First Sharpening boundary`

---

**T3 — CLEAN-07: codex-exec.sh tier resolver**

File: `super-gsd/scripts/codex-exec.sh`

Read lines 60-100 to locate --step argument parsing block. Then add:

1. New `--timeout-tier {default|review|analysis|custom:N}` flag parser (after --step parsing).
2. Step-name mapping (resolve_timeout function or inline case statement):
   - `smoke|self-test` → `default` (60s)
   - `per-dispatch-ATC|phase-level-ATC|adversarial` → `review` (120s)
   - `muda-qualitative|qualitative-*` → `analysis` (180s)
   - unmatched → `default` (60s) + `echo "step '$STEP_TAG' has no tier mapping, using default" >&2`
3. Precedence resolution (D-03 order):
   - `--timeout-tier custom:N` → TIMEOUT=N
   - `--timeout-tier {named}` → TIMEOUT from tier value
   - STEP_TAG set → TIMEOUT from step-name map
   - fallback → TIMEOUT from `codex_timeout_seconds` config (current behaviour)
4. Replace hardcoded/config-read timeout in the codex exec invocation with `$TIMEOUT`.

Commit: `feat(17-03/T3): CLEAN-07 add --timeout-tier flag + step-name map to codex-exec.sh`

---

**T4 — CLEAN-07: config.json codex_timeout_tiers**

File: `.planning/config.json`

Write via Node script only (read → mutate → write, never print file contents):
```js
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('.planning/config.json', 'utf8'));
cfg.review_providers.codex_timeout_tiers = { default: 60, review: 120, analysis: 180 };
fs.writeFileSync('.planning/config.json', JSON.stringify(cfg, null, 2));
```

Verify existing `codex_timeout_seconds: 180` is still present after write (do not print it — check via node exit code only).

Commit: `feat(17-03/T4): CLEAN-07 add codex_timeout_tiers block to config.json`

---

**T5 — CLEAN-07: SKILL.md shellDispatch call sites (3 sites)**

File: SKILL.md — locate with `find super-gsd -name 'SKILL.md'` (verify correct path; `super-gsd/config/SKILL.md` is the expected location per project conventions).

Read lines 485-500, 900-915, 1025-1035 to find the 3 shellDispatch calls to codex-exec.sh. Add `--timeout-tier review` to each:

- Step 6.5 (per-dispatch ATC): add `--timeout-tier review`
- Step 9.5 (phase-level ATC): add `--timeout-tier review`
- Step 9.6 (adversarial challenger): add `--timeout-tier review` (adversarial→review per D-03)

Surgical arg insertion only — do not reformat surrounding lines.

Commit: `feat(17-03/T5): CLEAN-07 add --timeout-tier args to SKILL.md shellDispatch call sites (3 sites)`

---

**T6 — CLEAN-07: sgsd-muda-audit.sh qualitative-probe call site**

File: `super-gsd/scripts/sgsd-muda-audit.sh`

Locate the qualitative-probe call to codex-exec.sh. Add `--timeout-tier analysis`.

This resolves the root cause of the first live Codex invocation exit 5 (timeout at 60s on a 35KB qualitative prompt — D-03 maps muda-qualitative to analysis tier = 180s).

Commit: `feat(17-03/T6): CLEAN-07 pass --timeout-tier analysis at sgsd-muda-audit qualitative-probe call site`

</tasks>

<success_criteria>
- MILESTONES.md v1.2 entry shows Shipped status
- ROADMAP.md Phases 9-13 wrapped in `<details>` block
- `git tag -l v1.2` returns v1.2; `git rev-list -n1 v1.2` resolves to the same SHA as 0191168
- `bash -n super-gsd/scripts/codex-exec.sh` exits 0; --timeout-tier flag and step-name map present
- config.json has codex_timeout_tiers: {default: 60, review: 120, analysis: 180}; codex_timeout_seconds: 180 still present
- SKILL.md has `--timeout-tier` in all 3 shellDispatch call sites (`grep -c 'timeout-tier'` returns 3)
- `grep -q 'timeout-tier.*analysis' super-gsd/scripts/sgsd-muda-audit.sh` exits 0
- 6 atomic commits with format docs/feat(17-03/T{N}): ...
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.4/phases/17-debt-sweep/17-03-SUMMARY.md`
</output>
