DONE_WITH_CONCERNS

Updated `super-gsd/skills/sgsd-triage/SKILL.md` only. Step 0 now routes through `node super-gsd/scripts/sgsd-triage-runtime.cjs --query-file ...`, adds Step 0.5 for `planning-triage` Codex gating, requires Claude A-D+rationale before reconciliation, and renders agreement/disagreement/single-model shapes with never-auto-fire language.

Installer sync: `install.sh` unchanged. Existing loop already copies `super-gsd/skills/*/SKILL.md` to `$COMMANDS_DIR/$name/SKILL.md` at lines 351/355. `bash -n install.sh` not run because installer was not touched.

Verification:
- Structural invariant command via `rg`/PowerShell: exit `0`
  - runtime invocation rc `0`
  - `planning-triage` rc `0`
  - rationale rc `0`
  - never-auto rc `0`
  - Step 0 `mcp__vtp-kb__` count `0`, invariant rc `0`
- `git diff --check -- super-gsd/skills/sgsd-triage/SKILL.md`: exit `0`
- Full 16-scenario suite loop: exit `1`; 13/16 passed. Failures: `codex-contract-json-schema` rc `1`, `codex-missing-single-model` rc `1`, `runtime-dispatch-reconciliation` rc `1`.
- Root cause evidence: Bash cannot start in this sandbox (`spawnSync bash EPERM`; Git Bash direct rc `256`, WSL/system32 Bash rc `1`). Runtime/tests were not edited.
