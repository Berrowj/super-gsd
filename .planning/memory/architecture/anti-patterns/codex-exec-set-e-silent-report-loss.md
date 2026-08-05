---
title: codex exec set e silent report loss
tags: [codex, wrapper, silent-failure]
importance: 70
maturity: raw
created: 2026-08-05T18:29:55Z
---

codex-exec.sh dies silently when its post-run contract parse greps a report lacking code-reviewer-v1 fields: `set -e` is re-enabled after the codex run, grep no-match returns 1, the script exits between the "codex-review END" banner and the REPORT_OUT write — no report file, no codex-log.jsonl row, no stderr, pipeline-masked exit 0. Symptom: END exit=0 in codex-live-output.txt but REPORT_OUT missing. Workaround: instruct Codex to append the 5 contract lines (FINDINGS/CRITICAL/WARNINGS/PASS_RATE/ONE_LINER) to any non-review dispatch, and salvage full body from codex-live-output.txt. Permanent fix scheduled: v3.5 P145 task (guard parse with set +e, always write report + JSONL on every exit path).
