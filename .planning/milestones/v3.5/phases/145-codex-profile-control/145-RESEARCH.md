---
phase: "145"
artifact: RESEARCH
authored_by: codex gpt-5.5/xhigh (exit=0, 478s, 2026-08-05T18:05Z)
provenance: salvaged from .planning/metrics/codex-live-output.txt lines 7988-8012 — codex-exec.sh completed the run but never wrote --report-out (silent wrapper defect, logged as deviation; fix folded into P145 scope since both wrappers are being refactored)
---

FINDINGS:
1. `codex-executor.sh` pins `CODEX_MODEL=gpt-5.5` and `CODEX_REASONING_EFFORT=xhigh`, explicitly not config-driven (`super-gsd/scripts/codex-executor.sh:115-120`; `super-gsd/docs/CODEX-EXECUTOR.md:100-104`). It chooses direct `codex` unless WSL only sees `/mnt/*` shim, then `cmd.exe /c codex` with Windows `--cd` (`super-gsd/scripts/codex-executor.sh:127-144`). Exact flags: `exec --full-auto --model "$1" -c model_reasoning_effort="$2" --skip-git-repo-check --cd "$3" -`, both cmd and native (`super-gsd/scripts/codex-executor.sh:154-155`, `super-gsd/scripts/codex-executor.sh:203-212`).
2. `codex-exec.sh` defaults `gpt-5.5/xhigh`, reads `.planning/config.json.review_providers.codex_model/codex_reasoning_effort`, then CLI `--model/--reasoning` overrides win (`super-gsd/scripts/codex-exec.sh:185-215`; `.planning/config.json:190-200`). Launcher is direct vs `cmd.exe` similarly (`super-gsd/scripts/codex-exec.sh:224-239`). Exact review flags: `exec --model "$4" -c model_reasoning_effort="$5" --sandbox read-only --ephemeral --skip-git-repo-check --cd "$1" -` in self-test, dry-run preview, and real run (`super-gsd/scripts/codex-exec.sh:423-424`, `super-gsd/scripts/codex-exec.sh:547`, `super-gsd/scripts/codex-exec.sh:662-663`). Preserve explicit timeout precedence (`super-gsd/scripts/codex-exec.sh:503-517`).
3. YAML exists via vendored `js-yaml`: gates loader resolves `tools/plan-schema/node_modules/js-yaml` and `yaml.load`s gates (`super-gsd/scripts/lib/gates-registry.cjs:14-16`, `super-gsd/scripts/lib/gates-registry.cjs:41-47`). Codex Pro already parses `codex-profiles.yaml` similarly (`super-gsd/tools/codex-pro/profile-resolver.cjs:7-27`, `super-gsd/tools/codex-pro/profile-resolver.cjs:57-64`). No bash grep parser.
4. Local `codex-cli 0.146.0` help verifies `--sandbox read-only|workspace-write|danger-full-access`, dangerous bypass flags, `--ephemeral`, `--cd`, `--skip-git-repo-check`; `--full-auto` is accepted but hidden. Therefore emit today’s `--full-auto` byte-identically for executor, not normalized flags. Repo docs map `--full-auto` to workspace-write (`super-gsd/docs/CODEX-EXECUTOR.md:19-23`).
5. Skills are `super-gsd/skills/<name>/SKILL.md` with YAML frontmatter and process sections (`super-gsd/skills/sgsd-readiness/SKILL.md:1-11`, `super-gsd/skills/sgsd-readiness/SKILL.md:24-31`). Installer copies every skill to `~/.claude/commands/<name>/SKILL.md` (`super-gsd/install.sh:38-42`, `super-gsd/install.sh:338-342`).
6. Existing Bash TTY predicate is `[ -t 0 ]` (`super-gsd/scripts/sgsd-distill-milestone.sh:205-208`); repo notes `/dev/tty` fails from PowerShell-invoked bash, so read stdin directly (`super-gsd/scripts/sgsd-distill-milestone.sh:349-353`). Safest danger predicate: require `[ -t 0 ] && [ -t 1 ]` and exact typed confirmation; otherwise refuse.
7. Self-test convention: `--self-test` block, temp dir, PASS/FAIL exit (`super-gsd/scripts/lib/vtp-context-composer.cjs:358-363`, `super-gsd/scripts/lib/vtp-context-composer.cjs:594-599`). P145 requires profile resolution tests for all three profiles/launchers (`.planning/milestones/v3.5/phases/145-codex-profile-control/CONTEXT.md:37-40`).
8. Blast radius beyond two wrappers: `codex-patch-executor.sh` direct Codex flags (`super-gsd/scripts/codex-patch-executor.sh:72-76`, `super-gsd/scripts/codex-patch-executor.sh:216-224`), `double-agent-executor` (`super-gsd/tools/double-agent-executor/run.cjs:622-630`), `provider-health` (`super-gsd/tools/provider-health/check.cjs:111-114`), `codex-rerun` (`super-gsd/tools/codex-rerun/rerun-missing-reviews.cjs:142-145`), RD board per-seat overrides (`super-gsd/skills/rd-board/SKILL.md:121-128`), plus display/test constants in codex-status and feature-propagation (`super-gsd/scripts/lib/sgsd-codex-status.ps1:53-57`, `super-gsd/tools/feature-propagation/audit.cjs:31-32`).

RECOMMENDED_APPROACH:
Use a Node resolver helper that prints sanitized `KEY=VALUE` lines and have Bash read them with `while IFS='=' read`, not `eval` (existing pattern: `super-gsd/scripts/codex-exec.sh:204-208`). On missing/corrupt registry, print built-in defaults matching today’s exact flag fragments and append a loud `.planning/metrics/codex-profile-resolution-log.jsonl` fallback row. File-touch list: `super-gsd/registry/codex-profiles.yaml`, new resolver under `super-gsd/scripts/lib/`, both wrappers, `super-gsd/skills/sgsd-codex-control/SKILL.md`, self-test runner, docs/status constants as needed.

RISKS:
1. Hidden `--full-auto` removal: mitigate by self-test comparing dry-run command strings.
2. YAML parse drift: mitigate with strict schema plus fail-open fallback row.
3. Unsafe danger/trust edit: mitigate with `[ -t 0 ] && [ -t 1 ]` and exact phrase confirmation.

DEVIATIONS:
none

ONE_LINER:
P145 should bind existing Codex launchers to a registry-backed flag-fragment resolver, preserving today’s exact commands by default while making registry failure and dangerous overrides loud.

============================================================
