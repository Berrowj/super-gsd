# P153 Deviations and process findings

Recorded by the orchestrator during phase close. These are process defects found
while running the phase, not implementation defects in the phase's deliverables.

## D1 Codex review dispatches logged exit 6, report contract violation

`.planning/metrics/codex-log.jsonl` records every P153 plan review with exit 6, and
`.planning/metrics/narrative.md` records `codex_fallback: parse_failure` for
plan-review-2 and plan-review-3.

Cause: `codex-exec.sh` validates reviewer output against a fixed five-field contract
(`FINDINGS:`, `CRITICAL:`, `WARNINGS:`, `PASS_RATE:`, `ONE_LINER:`). The orchestrator's
review prompts asked for task-specific formats instead (`VERDICT:`, `CHANGE_1:`,
`PROBE_SOUND:`, `SPEC_VERDICT:` and so on). The content was produced and was usable,
and the orchestrator read it from the report file and acted on it, but the wrapper
classified each run as a contract violation and fell back.

Consequence: the evidence trail says the reviews failed while the phase narrative said
they succeeded. Anyone auditing this phase from telemetry alone would reach the opposite
conclusion from the orchestrator's summaries. The orchestrator did not surface this
disagreement at the time, which it should have.

Repair options, not yet chosen:
  a. Conform orchestrator review prompts to the five-field contract.
  b. Extend `codex-exec.sh` with a declared alternate contract per `--step`.
  c. Pass an explicit `--contract` value where a bespoke format is intended.

## D2 Phase-close consult renders Windows paths that sgsd-muda-audit.sh cannot parse

`orchestrator-hooks.cjs --skill-routing-consult --execute` rendered the MUDA dispatch
with a Windows-style `--project` argument:

    --project C:\Users\jack.berrow\...\luminaria-hogback

MUDA then exited 4 with:

    parse error: Bad escaped character in JSON at position 15 (line 1 column 16)

The consult classified that as `execution_failed`, which per contract blocks phase close.

Run directly with a POSIX path, the same script exits 2, which is a declared
`verdict_exit`, and writes WASTE.md normally:

    bash super-gsd/scripts/sgsd-muda-audit.sh 153 --project "$(pwd)"
    exit 2, WASTE.md written, 0 WARN, 1 FAIL

So MUDA is healthy and the failure is a path-format defect in the dispatch rendering.
Unescaped Windows backslashes inside JSON is the same class of bug that broke two
orchestrator one-liners earlier in this session.

True MUDA classification for P153: `executed_with_findings`, which maps to gate outcome
`warn` and does not block close.

## D3 MUDA finding, narrative_age_sec FAIL

    narrative_age_sec  FAIL  10685s  threshold fail>3600  waste class waiting

`narrative.md` is written by `codex-exec.sh append_narrative_event` at `codex_started`.
Its last row is 13:57Z, so roughly three hours of active work produced no narrative
event, because every dispatch in that window went through `codex-executor.sh`, which
does not write narrative events.

`sgsd-narrative.ps1` is an interactive viewer, not a generator. Running it switches to
the alternate screen buffer and exits without touching the file, confirmed: age went
10685s to 10783s across the attempt.

So the waste signal is accurate and the gap is structural: the executor path has no
narrative writer. Not repaired in this phase.

## D4 Two consecutive executor dispatches were killed externally

T2c was stopped twice with no report and no file changes. The orchestrator verified a
clean tree both times and held after the second rather than retrying a third time. Work
resumed on operator instruction. No partial state entered the tree.
