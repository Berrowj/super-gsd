---
name: codex-executor-auth-denied-false-positive
description: codex-executor.sh greps stderr for "auth" and kills healthy dispatches whose prompt echoes that substring
metadata:
  type: errors
---

# codex-executor kills good runs on an "auth" substring

`super-gsd/scripts/codex-executor.sh:374` greps the child's stderr for `auth` and reports
`codex-executor: auth-denied`. Codex echoes the prompt into stderr, so ANY prompt
containing that substring can trigger it.

Observed twice. Most recently 2026-08-25 in P168: a dispatch was killed after ~4 minutes
with `codex-executor: auth-denied` having already written 124 lines into `install.sh`,
leaving the change half-applied. The partial state then produced a cascade of confusing
downstream failures that took several rounds to unwind.

Symptoms: wrapper exits early, report file empty or missing, source files modified but
incomplete, `auth-denied` in the wrapper log.

**How to apply.**

- When a dispatch dies unusually fast, check the wrapper log for `auth-denied` BEFORE
  diagnosing the code. It is a wrapper artefact, not a real credential problem.
- Treat the working tree as half-applied: check syntax and re-run the deliverable's own
  smoke before building on it.
- Avoid the substring in prompt text where practical.
- The real fix is to anchor that grep to actual credential-failure lines rather than a
  bare substring.

Related: [[codex-exec-set-e-silent-report-loss]], [[dont-rebuild-the-world-to-fix-an-ordering-bug]].
