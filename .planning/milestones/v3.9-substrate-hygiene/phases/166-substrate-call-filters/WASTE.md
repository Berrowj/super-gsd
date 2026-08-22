# P166 MUDA audit

Fires because the phase changed 11 files and 3,000-plus diff lines, well over
the files_changed>=4 OR diff_lines>=100 threshold.

## Mechanical probes

| Waste | Probe | Value | Verdict |
|---|---|---|---|
| Overproduction | files touched vs plan files_touched | 11 vs 11 | PASS |
| Overproduction | scope creep beyond the plan | none | PASS |
| Inventory | uncommitted source at phase close | 0 | PASS |
| Transport | git spawn rate, commits in phase | 12 (7 source, 5 docs) | PASS |
| Waiting | STATE.md narrative age at close | 114223s | FAIL |
| Extra processing | duplicate test executions | found and removed, 121 lines | CLOSED |
| Defects | review rounds needed | 6 fix rounds across 5 review gates | see below |

## Waiting, FAIL

STATE.md `last_updated` was 2026-08-21T12:15:00Z at phase close, 114223
seconds stale. This is the fourth recorded instance of this exact waste in this
project; memory already holds `waste-waiting-p08-narrative-stale`,
`waste-waiting-p153-narrative-age-sec`, and
`waste-waiting-p154-narrative-age-sec`. The phase-close STATE.md write in this
commit chain resets it, which is the same remedy applied the previous three
times and has not prevented recurrence.

The pattern is structural, not incidental: STATE.md is written at phase close
and nowhere else, so its age always equals the phase duration. A phase that runs
a full day is guaranteed to fail this probe. Either the probe should measure
something else, or STATE.md should be touched at each unit boundary. Recorded
rather than fixed here, because changing the probe or the write cadence is
outside P166's scope.

## Defects, six fix rounds

Not waste in the MUDA sense, but worth recording honestly. Each fix round was
triggered by an independent review finding a real defect, and every finding was
confirmed by a falsification probe before the fix and after it:

1. T1 caller-coverage red on two unclassified declaration strings.
2. T1 spec review, 2 CRITICAL: prompt transport unmediated, coverage fail-open
   inside known files.
3. T1 spec review round 2, 1 CRITICAL: recordless api_error bypass.
4. T1 per-dispatch ATC: malformed literal, dead residue, node_modules scanning.
5. T2 spec review and ATC, 1 CRITICAL and 1 warning: packet cap weakened, note
   matcher over-attaching.
6. Phase ATC: false revert contract, duplicate executions, stale comments.

The cost of six rounds bought findings that a single-pass review would have
shipped. Rounds 2, 3 and 5 each closed a path by which an unfiltered call or an
uncosted payload could still get through, which is the entire point of the
phase.

## No BLOCKED rows

No external dependency, no waiting on a service, no rework from a wrong
assumption about the codebase.
