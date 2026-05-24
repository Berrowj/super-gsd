---
schema_version: 2
schema: plan-schema-v2
status: PLAN-LOCKED
plan_id: P131-01-eli5-upgraded
phase_id: 131-cockpit-eli5-upgraded
phase_number: 131
milestone: v3.3
workstream: core
title: Cockpit ELI5 Upgraded — Munroe lint + Duarte arc
created_by: sgsd-write-plan (operator + Claude Opus 4.7)
created_at: 2026-05-24
locked: true
expected_ATC_tier: LITE
skip_gates: []
depends_on:
  - P130-01-band3-rationale
tasks:
  - id: P131-T1
    agent: sgsd-exec-docs
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/eli5-common-words.txt
    input_contract: |-
      Reads 131-CONTEXT.md "What ships / eli5-common-words.txt" section.
      No source dependencies — this is a plain text data file.
    output_contract: |-
      Creates super-gsd/tools/cockpit-sidecar/eli5-common-words.txt, one
      lowercase word per line, ~1500 entries. Must include: Munroe's
      ten-hundred (the canonical 1000 most common English words used in
      Thing Explainer; you may approximate from your training corpus —
      include all of: the, of, and, a, to, in, is, you, that, it, he, was,
      for, on, are, as, with, his, they, I, at, be, this, have, from, or,
      one, had, by, word, but, not, what, all, were, we, when, your, can,
      said, there, use, an, each, which, she, do, how, their, if, will,
      up, other, about, out, many, then, them, these, so, some, her, would,
      make, like, him, into, time, has, look, two, more, write, go, see,
      number, no, way, could, people, my, than, first, water, been, call,
      who, oil, its, now, find, long, down, day, did, get, come, made, may,
      part — and many more) PLUS SGSD-specific words: phase, stage, commit,
      verify, plan, research, dispatch, executor, agent, task, cockpit,
      pipeline, chronicle, milestone, codex, claude, build, ship, gate,
      blocker, alert, signal, north, star, brief, context, summary, evidence,
      done, pending, active, sgsd, super, repo, file, code.
    hypothesis: |-
      A 1500-word list is sufficient for SGSD's ELI5 surface because the
      operator-facing narration vocabulary is narrow (status + decisions +
      a small set of named SGSD concepts). Exact ten-hundred fidelity is
      secondary to having a reasonable bar enforceable by the lint.
    falsifier: |-
      If a typical Haiku-generated ELI5 line emits >50% out-of-list words,
      the list is too restrictive. Mitigation: tune by reviewing 5 real
      ELI5 outputs and adding any reasonably common technical words missed.
    stop_rule: |-
      File exists. Word count between 1200 and 2500 (rough sanity).
      Contains all SGSD-specific terms listed above.

  - id: P131-T2
    agent: sgsd-exec-backend
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/eli5-lint.cjs
    input_contract: |-
      Reads 131-CONTEXT.md "What ships / eli5-lint.cjs" section + SAC-P131-01/02/03.
      Reads (loads at module init) the eli5-common-words.txt from T1.
    output_contract: |-
      Creates super-gsd/tools/cockpit-sidecar/eli5-lint.cjs exporting
      lintEli5(text, opts) returning {ok, violations, total_words,
      out_of_list_count}.
      Process:
        - Load eli5-common-words.txt once at module init (cache as Set).
        - Tokenize text into words: split on /\s+/, strip punctuation
          (/[^a-zA-Z\-']/g), lowercase. Skip empty tokens.
        - For each word: if in the Set, skip; else check if followed (within
          next 20 characters in the original text) by '(...)' or ' — ...' —
          mark glossed:true; else glossed:false.
        - Compute out_of_list_count = count of non-glossed violations.
        - violations = array of {word, line_number, glossed} for ALL out-of-list
          tokens (glossed and non-glossed) up to a reasonable limit (100).
        - ok = out_of_list_count <= (opts.maxViolations || 5).
      Pure: read the words file ONCE at module load.
    hypothesis: |-
      Splitting on whitespace + stripping punctuation is sufficient
      tokenization for English prose. Inline-gloss recognition via
      "next 20 chars contains ( or —" is a simple heuristic that catches
      the common patterns ('term (gloss)' and 'term — gloss').
    falsifier: |-
      Edge cases: a word like 'don't' tokenizes oddly; a glossed term where
      the gloss starts >20 chars away (after a comma clause) won't be
      recognized. Mitigation: 20 chars is a tunable; document but don't
      over-engineer.
    stop_rule: |-
      Module loads without error; lintEli5 is a function; SAC-P131-01
      returns ok:true on benign input; SAC-P131-02 returns ok:false with
      jargon detected; SAC-P131-03 inline-gloss case returns reasonably
      (either ok:true or strictly fewer violations than no-gloss baseline).

  - id: P131-T3
    agent: sgsd-exec-backend
    model: codex
    files_touched:
      - super-gsd/scripts/sgsd-codex-monitor.ps1
    input_contract: |-
      Reads existing sgsd-codex-monitor.ps1 (2446 lines). Locates the
      Get-LocalClaudeEli5 function (line ~1590). Reads 131-CONTEXT.md
      "What ships / sgsd-codex-monitor.ps1" section.
    output_contract: |-
      MODIFY sgsd-codex-monitor.ps1: in the Get-LocalClaudeEli5 function
      (or its prompt-building helper), extend the Haiku narration prompt
      to ask explicitly for a 4-beat Duarte arc structure:
        - Line 1: 'What is now' (current state in plain words)
        - Line 2: 'What could be' (next state after this phase unlocks)
        - Line 3: a S.T.A.R. moment (the key concrete fact / surprise)
        - Line 4: 'Call to action' (one DO NEXT instruction)
      Also constrain the prompt: 'use common words; gloss any technical
      term inline with parens or a dash.'
      Do NOT yet wire eli5-lint.cjs as a hard gate (post-gen invocation
      via node child-process). Lint binding deferred to P134.
      Zero functional changes to other panels.
    hypothesis: |-
      The existing Haiku prompt builder is a single PowerShell here-string
      or variable; extending it with the arc structure is a localized
      edit. Lint hook can be added later as an informational pass.
    falsifier: |-
      If Get-LocalClaudeEli5 calls a different prompt-construction path
      we haven't located, the edit may miss the right point.
      Mitigation: the prompt string is grep-discoverable via 'ELI5' or
      'Haiku narrator' in the PS file.
    stop_rule: |-
      Grep `^.*('What is now'|'What could be'|'S\.T\.A\.R\.'|'Call to action')` in the modified ps1 returns ≥3 matches (the 4 beats; S.T.A.R. may be phrased differently). SAC-P131-04 passes.

  - id: P131-T4
    agent: sgsd-exec-test
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/run-self-test.cjs
    input_contract: |-
      Reads existing run-self-test.cjs (post-P130; 38/38 SACs green).
      Reads 131-CONTEXT.md SAC block.
    output_contract: |-
      EXTEND run-self-test.cjs (pure append). Add SAC-P131-01..04 after
      SAC-P130-05. Each test:
        SAC-P131-01: lintEli5 on benign all-common-words text → ok:true.
        SAC-P131-02: lintEli5 on jargon-heavy text → ok:false; violations
          contain ≥4 of the jargon words.
        SAC-P131-03: lintEli5 on 'orchestrator (...)' inline-gloss → fewer
          violations than same text without parens; OR ok:true outright.
        SAC-P131-04: grep sgsd-codex-monitor.ps1 source for arc beat labels.
    hypothesis: |-
      Pure-append discipline preserves existing 38 SACs.
    falsifier: |-
      Test pollution introduced.
    stop_rule: |-
      Full self-test: 42/42 PASS exit 0.

  - id: P131-T5
    agent: sgsd-exec-docs
    model: codex
    files_touched:
      - .planning/milestones/v3.3/phases/131-cockpit-eli5-upgraded/131-VERIFICATION.md
      - .planning/milestones/v3.3/phases/131-cockpit-eli5-upgraded/PHASE-CAPSULE.json
    input_contract: |-
      Green self-test + git log. Mirror P130 VERIFICATION/CAPSULE shape.
    output_contract: |-
      VERIFICATION verdict=PASS, 4/4 SACs; CAPSULE with SHA-256 hashes.
    hypothesis: |-
      Deterministic projection.
    falsifier: |-
      Self-test not green.
    stop_rule: |-
      Both files exist; verdict=PASS; valid JSON.
    depends_on:
      - P131-T1
      - P131-T2
      - P131-T3
      - P131-T4
semantic_acceptance_criteria:
  - id: SAC-P131-01
    input: "lintEli5('Everything looks fine right now. We are ready for the next step.')"
    expected_outcome: "returns ok:true; out_of_list_count is 0 or <=2"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P131-01"
  - id: SAC-P131-02
    input: "lintEli5('The SAC schema mandates idempotent invariants under concurrent dispatch.')"
    expected_outcome: "returns ok:false; out_of_list_count >= 4; violations include at minimum 4 of: SAC, schema, mandates, idempotent, invariants, concurrent"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P131-02"
  - id: SAC-P131-03
    input: "lintEli5('The orchestrator (the part that picks what to do next) is waiting.') vs same text without the parenthetical"
    expected_outcome: "inline-gloss text has strictly fewer non-glossed violations than the bare text; recognizes 'orchestrator' as glossed when followed by parens within 20 chars"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P131-03"
  - id: SAC-P131-04
    input: "grep the modified sgsd-codex-monitor.ps1 prompt source for arc-beat labels"
    expected_outcome: "the file contains at least 3 of the arc beat phrases (What is now, What could be, S.T.A.R., Call to action — or close variants)"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P131-04"
---

# P131-01 Cockpit ELI5 Upgraded PLAN

## Scope

Apply Munroe + Duarte to the existing PS-side ELI5 narrator. Ship the common-words allowlist + mechanical lint module + extended Haiku prompt. No localhost cockpit work (P132). No conformance binding (P134).

## Authoritative Inputs

131-CONTEXT.md, 130-VERIFICATION.md (baseline 38/38), sgsd-codex-monitor.ps1 (existing PS monitor), DLB-11 chronicle-grounded common-words rationale.

## Binding Invariants

Per 131-CONTEXT.md. 4 invariants.

## File Operations

| Operation | Path |
|---|---|
| CREATE | eli5-common-words.txt (T1) |
| CREATE | eli5-lint.cjs (T2) |
| MODIFY | sgsd-codex-monitor.ps1 (T3) |
| EXTEND | run-self-test.cjs (T4) |
| CREATE | 131-VERIFICATION.md + PHASE-CAPSULE.json (T5) |

## Tasks

5 tasks; full contracts in frontmatter.

## Phase Verification

`node run-self-test.cjs` → exit 0; 42/42 PASS (38 pre + 4 SAC-P131).

## Out of Scope

Per 131-CONTEXT.md.

## References

131-CONTEXT.md, Munroe canonical knowledge, Duarte canonical knowledge.
