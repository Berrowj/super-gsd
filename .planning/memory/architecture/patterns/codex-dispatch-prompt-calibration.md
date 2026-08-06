---
title: codex dispatch prompt calibration
tags: [codex, dispatch, prompting, p145, p146]
importance: 70
maturity: raw
created: 2026-08-06T23:30:20Z
---

# Pattern: Codex Dispatch Prompt Calibration

Empirical findings from ~40 Codex dispatches across v3.5 P145-P146.

## Too loose → timeout by exploration
Three dispatches burned their full budget wandering the repo (one phase-ATC
review read unrelated registry contracts for 360s and produced nothing). A
research dispatch returned 2.6MB of raw stream around 8KB of content.

## Too tight → refusal
"Read ONLY these files; do NOT run any command" caused a reviewer to return
BLOCKED — correctly, because Codex reads files VIA commands in its sandbox. The
instruction forbade the very thing being asked for.

## The calibrated shape
```
You MUST read the files below (use whatever read command your environment
provides — reading is required). Do NOT run self-tests, benchmarks, or node
execution. Do NOT read any other file. Emit the 5 contract lines FIRST, then
detail, then stop.
```
Name the files explicitly. Forbid execution, not reading. Demand the contract
lines first so a partial run still yields a usable verdict.

## Full-file regeneration drifts; block replacement does not
Asking for a REVISED plan produced a regression: the planner dropped `tasks`
and `semantic_acceptance_criteria` entirely (schema INVALID), renamed
frontmatter keys, and INVENTED new text for the carried-forward deferred items.
Re-asking for only the two YAML blocks that needed to change — with the current
versions inlined verbatim — produced a clean, valid result first try.
→ **Bound the output surface to what must change; inline the current version.**

## Supply the anti-footgun inline
After losing time to unescaped Windows paths in hand-written JSON, adding one
line to each prompt ("build payloads with JSON.stringify — hand-written JSON
with Windows paths breaks on unescaped backslashes") prevented recurrence.

## Front-load known recurring defects
Citing prior CRITICALs by task and defect class at the TOP of the executor
prompt preceded the phase's first zero-finding review (T146-05). Cheaper than
letting review rediscover the same class a fourth time.
See [[writer-accepts-caller-destination]] and [[silent-success-reports-health]].

## Salvage, do not re-pay
- Timeout with work already complete → reconstruct the report from the raw diff
  and host runs; label it reconstructed. Do not re-dispatch.
- Killed mid-flight having written tests but not implementation → re-dispatch as
  "make these red assertions green", quoting them by line, with an explicit
  instruction not to weaken or delete any to pass.
