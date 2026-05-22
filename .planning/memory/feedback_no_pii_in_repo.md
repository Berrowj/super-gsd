---
name: no-pii-in-repo
description: "Operator wants zero personal-identifying info in the GSDedits/super-gsd repo; git identity is the generic \"operator\""
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8e9f7709-24fa-4ab9-a7d3-685a306de8b0
---

The operator does not want to be doxxed through this repository. On 2026-05-22
they directed a full de-identification of the `super-gsd` repo (GitHub
`github.com/Berrowj/super-gsd`).

**Rule:** never write the operator's real name or personal email into any
tracked file, commit message, or commit identity. The de-identified git
identity for this repo is `operator <operator@users.noreply.github.com>` —
all 1045 historical commits were rewritten to it and `git config user.name/
user.email` are set to it locally.

**Why:** the operator is preparing the repo for sharing ("README for everyone",
"npm install for everyone") and explicitly said "i do not want to be DOXX".

**How to apply:**
- Commit as `operator`; never re-introduce the real name/email.
- Runtime telemetry that carries machine-local paths (`.planning/metrics/`,
  `.planning/mesh/`, `.planning/cache/`, `.mcp.json`) is gitignored — keep it
  that way; do not re-add those to version control.
- If new files would embed `C:\Users\<realname>\...` paths, genericise to
  `C:\Users\user\...` or use env vars before committing.
- The real home path still appears in this machine's filesystem and in the
  Claude projects directory name — that is local-only and out of repo scope.
