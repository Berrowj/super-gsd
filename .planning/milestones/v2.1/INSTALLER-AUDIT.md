---
milestone: v2.1
phase: 58
name: Installer Portability Audit
generated_at: 2026-04-29
generator: super-gsd/tools/installer-audit/audit.cjs --run + clean-room.sh
schema_version: 1
---

# v2.1 Installer Portability Audit

This document is the canonical Phase 58 deliverable. It captures (1) the
read-only dependency probe results from `audit.cjs --run` and (2) the
clean-room install friction log from `clean-room.sh`. Phase 59 (the
new-project wizard) consumes both as input.

## 1. Probe results (12 probes; >=9 acceptance bar met)

Live run timestamp: `2026-04-29T03:05:14.672Z`

| #  | Probe                       | Source   | Version                                                              | Note                            |
| -- | --------------------------- | -------- | -------------------------------------------------------------------- | ------------------------------- |
| 1  | `node_version`              | present  | v22.22.2                                                             | present_version_captured        |
| 2  | `npm`                       | present  | C:\Program Files\nodejs\npm                                          | present_no_version_command      |
| 3  | `git`                       | present  | git version 2.50.1.windows.1                                         | present_version_captured        |
| 4  | `bash`                      | present  | GNU bash, version 5.2.37(1)-release (x86_64-pc-msys)                 | present_version_captured        |
| 5  | `powershell`                | present  | 5.1.26100.8115                                                       | present_version_captured        |
| 6  | `redis_optional`            | optional | null                                                                 | optional_not_installed          |
| 7  | `docker_optional`           | present  | Docker version 29.4.0, build 9d7ad9f                                 | present_version_captured        |
| 8  | `codex_cli_optional`        | optional | null                                                                 | optional_not_installed          |
| 9  | `claude_cli_optional`       | optional | null                                                                 | optional_not_installed          |
| 10 | `better_sqlite3_optional`   | present  | C:\Users\user\GSDedits\node_modules\better-sqlite3\lib\index.js | present_no_version_command      |
| 11 | `planning_dir_present`      | present  | C:\Users\user\GSDedits\.planning                              | read_only_filesystem_probe      |
| 12 | `super_gsd_tree_present`    | present  | C:\Users\user\GSDedits\super-gsd                              | read_only_filesystem_probe      |

**Summary:** total=12, present=9, missing=0, optional=3,
`mandatory_floor_met=true` (all of {node_version, npm, git} present and
node>=20).

**Re-runnable:**
```
node super-gsd/tools/installer-audit/audit.cjs --run
```

Exit 0 when mandatory floor met; exit 1 otherwise.

## 2. Clean-room friction log

Live run timestamp: `2026-04-29T03:05:24Z` -> `2026-04-29T03:05:48Z`
(24s wall-clock).

```
============================================================
clean-room install walk
  repo_root  = /c/Users/user/GSDedits
  tmpdir     = /c/Users/USER~1/AppData/Local/Temp/sgsd-cleanroom-bw7v2u
  dry_run    = false
  keep_tmp   = false
  ts_started = 2026-04-29T03:05:24Z
============================================================
STEP 01 | 12177ms | auto   | mirror super-gsd tree (cp -R)
STEP 02 |   448ms | auto   | scaffold empty .planning/ skeleton
STEP 03 |  5317ms | auto   | run installer-audit probes
STEP 04 |  3179ms | auto   | install.sh --dry-run (no mutation)
STEP 05 |    89ms | prompt | byterover login (interactive prompt expected)
STEP 06 |    82ms | prompt | claude login (interactive prompt expected)
STEP 07 |    86ms | prompt | restart Claude Code to pick up skills/hooks/permissions
STEP 08 |   142ms | auto   | copy CLAUDE-OVERLAY.md to project CLAUDE.md (tmpdir-only)
STEP 09 |   969ms | auto   | post-install audit (mandatory floor met expected)
============================================================
clean-room walk completed
  steps      = 9
  exit_code  = 0
  ts_finished= 2026-04-29T03:05:48Z
============================================================
```

### Friction breakdown

| Tag    | Count | Steps | Total time |
| ------ | ----- | ----- | ---------- |
| auto   | 6     | 1, 2, 3, 4, 8, 9 | 22232ms |
| prompt | 3     | 5, 6, 7          | 257ms (sentinel-only) |
| skip   | 0     | -                | - |
| error  | 0     | -                | - |

The 3 `prompt` steps are the canonical manual-intervention points the
clean-room walk captures: ByteRover OAuth, Claude OAuth, and the manual
"restart Claude Code" instruction. Sentinel-only timings (~80-90ms each)
indicate the clean-room walks past them with `true` placeholder commands;
in a real install these are the human-in-the-loop checkpoints.

**Re-runnable:**
```
bash super-gsd/tools/installer-audit/clean-room.sh
```

Flags: `--dry-run` (plan-only), `--keep-tmp` (debug; leaves tmpdir),
`--repo-root <path>` (override).

## 3. Recommendations for Phase 59 (new-project wizard)

The friction log identifies exactly 3 prompt-tagged steps. Phase 59 should
surface each as a discrete checkpoint, not a silent-fail:

### 3a. STEP 05 - ByteRover login

- **Today:** `install.sh` runs `brv vc init` and `brv connectors install`
  inside Step 7/8; if `brv` CLI is absent OR the operator is not logged
  in, the install proceeds with an empty context tree.
- **Phase 59 wizard:** detect `brv` CLI presence (audit probe candidate
  for v2.1: extend PROBE_NAMES with `brv_cli_optional` if Phase 59
  needs it). If absent, surface `--skip-brv` as the recommended path.
  If present, ALWAYS prompt for `brv login` before starting Step 7.

### 3b. STEP 06 - Claude CLI login

- **Today:** `install.sh` Step 9 calls
  `claude config set --global autoApprove ...`. If `claude` CLI is
  absent (probe `claude_cli_optional` returns missing), the install
  prints "claude CLI not found" and continues without setting
  permissions.
- **Phase 59 wizard:** consume probe `claude_cli_optional`. If missing,
  print the exact one-line `npm install -g @anthropic-ai/claude-cli`
  hint, OR (better) skip the permission setup with a clearly visible
  banner explaining how to set permissions later.

### 3c. STEP 07 - Restart Claude Code

- **Today:** `install.sh` final summary instructs the operator to
  "Restart Claude Code (picks up new skills + hooks + permissions)".
  This is unavoidable: the skill/hook loader runs at Claude Code
  startup.
- **Phase 59 wizard:** print a copy-pasteable banner with the exact
  text. Optionally: detect whether Claude Code is currently running
  (process probe) and add a kill-and-restart hint.

### 3d. Coverage gap (Phase 60 demo project)

The clean-room walk does NOT exercise the `--init-project` flow
end-to-end. Phase 60 (example-project demo) should cover:
- `--init-project` flag actually scaffolding `.planning/` correctly
- CLAUDE-OVERLAY.md producing a runnable CLAUDE.md
- The first `/sgsd-orchestrate go` round-trip in the freshly initialized
  project

### 3e. AUDIT WARNING from ROADMAP-AGENT.md (compliance)

ROADMAP-AGENT.md notes for Phase 58: "harden existing installer + setup;
do NOT create a second startup system." Phase 58 complies fully:
- audit.cjs is a READ-ONLY fingerprinter (zero filesystem mutation).
- clean-room.sh is a SIMULATOR (mutations confined to mktemp tmpdir).
- The v2.1 first-gate in `sgsd-complete-milestone.cjs` is a milestone-
  close pre-check, not an installer.
- No new "second startup system" was introduced. Phase 59 will harden
  the existing `install.sh` flow with a wizard, not replace it.

## 4. Phase 58 invariants (Lock 4 / 11 / 13 + READ-ONLY + ASCII-only)

| # | Invariant                                                     | Verification                                              |
| - | ------------------------------------------------------------- | --------------------------------------------------------- |
| 1 | Lock 4: Phase 41-57 trees byte-untouched                      | `git diff --quiet super-gsd/tools/{context-bench,context-cache,failure-injection,chaos-restart,provider-circuit,scenario-suite,release-readiness}` |
| 2 | Lock 4: sgsd-complete-milestone.cjs surgical extension only   | v1.9 + v2.0 paths preserved byte-equality up to existing insertion points; v2.1 branch added BEFORE the no-op fallthrough |
| 3 | Lock 11: byte-equality on closed-vocab enums                  | SOURCE_VALUES + REASON_NOTES frozen; no regex on tool names |
| 4 | Lock 13: every probe + public API try/catch wrapped           | self-test A3 + A4 (bad name + non-string -> degraded sentinel; never throws) |
| 5 | READ-ONLY (audit.cjs): zero fs mutation primitives reachable  | self-test A8 scans code-only source for fs.write/append/unlink/mkdir/rm/rmdir tokens |
| 6 | ASCII-only across audit.cjs + run-self-test.cjs + clean-room.sh + sgsd-complete-milestone.cjs delta | self-test A7 first_nonascii_idx === -1 |
| 7 | clean-room.sh confines mutation to mktemp tmpdir              | rm -rf cleanup gated on signature-prefix check (*/sgsd-cleanroom-*) |

## 5. Replay (one-line for Phase 59 ingestion)

```bash
node super-gsd/tools/installer-audit/audit.cjs --self-test \
  && node super-gsd/tools/installer-audit/audit.cjs --run \
  && bash super-gsd/tools/installer-audit/clean-room.sh
```

All three exit 0 when the local environment meets the v2.1 first-gate
floor. Phase 59 wizard treats this script as the green-bar precondition.
