---
title: silent success reports health
tags: [reliability, observability, p145, p146, recurring]
importance: 70
maturity: raw
created: 2026-08-06T23:29:30Z
---

# Anti-Pattern: Silent Success (the system reports health while doing nothing)

**The dominant defect class across v3.5 P145-P146.** Four CRITICALs, all
different code, all the same shape: the happy-path signal is emitted while the
actual work did not happen.

## Instances
1. **P145 `codex-exec.sh`** — report write failed, wrapper still printed
   `OK — written (0B)`, logged `report_bytes` untruthfully, exit 0. Every SGSD
   gate consumes these reports, so a downstream gate could read a stale file
   believing it succeeded. Fixed with a dedicated exit 9.
2. **P146 T146-03 `sgsd-session-start.js`** — optional checkpoint/memory
   briefing ran BEFORE the `console.log` that emits the governance contract. Any
   filesystem hiccup suppressed the entire contract while exiting 0. AC-146a
   silently defeated.
3. **P146 T146-04 `sgsd-intent-classifier.cjs`** — the registry (shipped inside
   `super-gsd/`) was resolved from the TARGET REPO root, so in any repo lacking
   `super-gsd/` the classifier emitted nothing and exited 0. That is exactly how
   the hooks are deployed. The plan's own acceptance command failed as written.
4. **P146 T146-06 cockpit adapter** — the never-throw ledger reader returns `[]`
   on an unreadable file, so the dashboard rendered
   `missing_plan_count:0, breadcrumb:null` — identical to a healthy repo.
   "Monitoring is blind" displayed as "no problems found".

## The rules
- **Mandatory output first.** Compose and emit the required result BEFORE any
  optional enrichment. Guard each optional section individually so its failure
  degrades only itself.
- **Resources shipped inside `super-gsd/` resolve from `__dirname`**, never from
  the target repo root. Only use the target root for gating (are we in an SGSD
  repo?) and for evidence destinations.
- **Never-throw must not mean never-report.** A swallowed error still needs a
  NON-STACK breadcrumb. Distinguish `ok` / `empty` / `unavailable` explicitly —
  empty and blind are opposite conclusions on any operator surface.
- **Error handlers must be incapable of throwing** (a catch block that calls a
  writer can itself throw and escape).
- Exit 0 must mean the work happened. If it did not, say so with a distinct code.

## Detection
Simulate the ENVIRONMENT failing mid-flow, not just bad input: metrics dir as a
file, checkpoint as a directory, STATE.md as a directory, corrupt frontmatter.
Input-shaped tests (empty/garbage/null stdin) will not find this class.
