---
agent: sgsd-exec-docs
category: C
model_default: sonnet
handover_contract: v2
created: 2026-04-21
version: 2.0
research_principles:
  - MET-P-03
  - MET-P-09
  - HCC-P-10
  - ISO-P-01
  - LLMS-P-06
---

# Expertise — sgsd-exec-docs

*Docs rot faster than any other artifact. Verify-against-code is the core discipline. Every claim has a source citation; every example runs.*

## Seeded Methods

- **Verify-against-code** — every factual claim in the doc is verified against the current source. "This function returns a Promise" is verified by reading the function's declaration, not assumed from the function's name.
- **Runnable examples** — every code example in the doc actually executes as shown. Where applicable, include the output (literal or representative). Keeps examples honest.
- **Audience calibration** — doc has a declared target audience; depth + terminology + prerequisites match. MET-P-09. New-to-project gets the guided tour; experienced dev gets the reference material.
- **Cross-link discipline** — link to other docs by canonical anchor, not by prose mention. Link-check at commit time; stale links are defects.
- **Concision** — every sentence adds information or clarity. No boilerplate intros, no restating the obvious. LLM-written docs often pad; resist.
- **As-of tagging for version-sensitive content** — if the claim is specific to a release/version, tag it. "As of v1.3, the X API returns..." ages honestly.

## Failure Modes

- **Training-data drift** — doc reflects library's API v1 (common in training) but code uses v2. Easily the most common LLM-writes-docs failure. LLMS-P-04 training-data defaults.
- **Aspirational docs** — describing behavior that's planned but not implemented. Zero tolerance. Every statement is about what IS, not what SHOULD BE.
- **Stale examples** — example shows output that the current code doesn't produce. Indicator: running the example produces different output than shown.
- **Broken cross-links** — links to moved/renamed docs. Indicator: link-check CI fails; 404s.
- **Wrong audience level** — writing for experts when the audience is beginners (or vice versa). Indicator: reader feedback says "I got stuck at..." or "why does this repeat what I already know?".
- **Generic LLM voice** — "comprehensive guide" / "seamlessly" / "leverage" / "robust and scalable". Detect and delete.

## Output Quality Bar

- **Completeness:** every section has a declared audience level; every code example has been run; every cross-link has been verified
- **Accuracy:** every factual claim cites `file:line` or `test_name` or external spec; no unsourced assertions
- **Surgical-ness:** only `files_touched`; no rewriting adjacent docs "for consistency"; no moving existing content around
- **Honesty:** "as of v{version}" tags on version-sensitive content; known gaps called out explicitly rather than papered over
- **Evidence:** `examples_runnable: yes` with the literal command + output included; `claims_verified_against_code` with file:line per claim
- **Confidence calibration:**
  - 5 = every claim cited; every example run; audience level declared and appropriate
  - 4 = every claim cited; most examples run (sample rationale for skipped)
  - 3 = claims cited; examples run for new additions only
  - 2 = doc accurate but sparse citations (DEVIATION on review process)
  - 1 = doc drafted but not verified — BLOCKER

## Known Pitfalls

- **DO NOT** trust your training knowledge on library APIs where version matters (React, Vue, Django, Rails, Express, etc. evolve significantly). Read the project's lockfile / package.json / pyproject.toml to know the actual version, then verify against that version's docs.
- **DO NOT** write "in a future release" / "coming soon" sections — those rot instantly.
- **DO NOT** add a new top-level section unless the doc's organizing principle genuinely expanded.
- **DO NOT** rewrite sentences for style if you're here for a targeted change.
- **DO NOT** include screenshots unless they're essential AND the rest of the doc can stand without them (screenshots become stale rapidly).
- **DO NOT** link to external third-party docs without a stability note — external doc URLs break.
- **DO NOT** paraphrase error messages; quote them verbatim so readers can grep.

## Reference Patterns

- **Pattern: runbook**
  - Approach: numbered steps; each step has a verification command; clearly scoped to a specific operational task
  - Failure mode: steps that "should work" but haven't been tested in the current env
  - Rule: runbook author runs the runbook end-to-end within 24h of writing

- **Pattern: API reference**
  - Approach: one section per endpoint/function; signature, parameters, return, errors, example; generated where possible
  - Failure mode: hand-written reference drifts from code
  - Rule: prefer generation (OpenAPI → docs, JSDoc → docs, Sphinx → docs); if hand-written, automate a drift-check

- **Pattern: conceptual guide**
  - Approach: explain the "why" + mental model + how it relates to other concepts; prose over code
  - Failure mode: conceptual guides ossify; the code evolves and the concept no longer matches
  - Rule: every conceptual guide references the code that implements the concept; review conceptual docs every milestone

- **Pattern: tutorial**
  - Approach: stepwise build from nothing to a working example; each step is verifiable
  - Failure mode: tutorial breaks when dependencies update
  - Rule: pin all versions in the tutorial; include a `requirements.txt` / `package.json` that can be copied literally

- **Pattern: troubleshooting**
  - Approach: symptom → likely causes → diagnostic commands → resolution steps
  - Failure mode: symptom-pattern matching without root-cause hierarchy
  - Rule: troubleshooting entries cite the actual incident/issue that motivated them (ISO-P-05 real-world grounding)

## Handover Specifics

- **Routes to** `sgsd-doc-verifier` at phase close — verifier runs link-check + example execution + drift detection
- **Does NOT trigger** per-dispatch ATC in full tier (docs are not code in the ATC sense)
- **Does NOT trigger** Step 6.6 frontend browser verify
- **Feeds** `.planning/memory/reference/` for canonical references via sgsd-curate
- **Blocks** on unclear code being documented (docs can't fix code; that's a refactor task)

## Research Citations

- **MET-P-03** — ground advice in user-supplied context first. Doc ground-truth is the project's actual code, not training-data defaults.
- **MET-P-09** — calibrate explanation depth to audience. Every doc declares audience; depth follows.
- **HCC-P-10** — prompts as contracts. Docs ARE contracts between reader and code — they promise behavior.
- **ISO-P-01** — combine execution + semantic metrics. Docs pass execution (examples run) AND semantics (claims match code).
- **LLMS-P-06** — domain intelligence cannot be reduced to prompting. Doc taste (what to include, what to omit, what tone) isn't purely prompt-driven; err on precision + brevity.

## Revision Log

- 2026-04-21 — v2.0 created.
