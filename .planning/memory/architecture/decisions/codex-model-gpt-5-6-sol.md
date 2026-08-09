---
title: codex model gpt 5 6 sol
tags: [codex, model-routing, config]
importance: 70
maturity: raw
created: 2026-08-08T12:56:06Z
---

Operator instruction 2026-08-08: Codex dispatches run gpt-5.6, and the ONLY
5.6-family id a ChatGPT-account codex accepts is `gpt-5.6-sol` (bare `gpt-5.6`
and `gpt-5.6-codex` both 400: "not supported when using Codex with a ChatGPT
account"). All 13 codex-profiles.yaml entries + config.json fallbacks pinned to
gpt-5.6-sol.

**How to apply:** model pins live in super-gsd/registry/codex-profiles.yaml
(cli_profiles group is what codex-exec.sh/codex-executor.sh resolve; change via
`sgsd-codex-control.sh set <profile> model <id>`). Probe validity cheaply with
`echo "say ok" | codex exec --model <id> --skip-git-repo-check -` — invalid ids
400 before burning quota. Wrapper --self-test expectation strings still
hardcode gpt-5.5 (codex-exec.sh:474, codex-executor.sh:119-120) until the
queued chore fix lands. SKILL/CLAUDE.md prose saying "gpt-5.5" is stale docs.
