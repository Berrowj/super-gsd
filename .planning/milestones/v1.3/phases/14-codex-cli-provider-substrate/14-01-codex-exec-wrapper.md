---
plan_id: 14-01
phase: 14
wave: 1
depends_on: []
deliverable: super-gsd/scripts/codex-exec.sh — bash wrapper for `codex exec` with OAuth hygiene, GNU-timeout, report-contract parse, JSONL provenance
estimate_tokens: ~700
estimate_commits: 2
---

# Plan 14-01: codex-exec.sh wrapper

## Scope

Ships the one shell primitive Phase 14 needs: a cross-platform bash wrapper around
`codex exec` that takes a prompt file, pipes it on stdin, wraps the call in GNU
`timeout`, parses the 5-field `code-reviewer-v1` contract from stdout, writes the
parsed report atomically, and appends a single provenance row to
`.planning/metrics/codex-log.jsonl`. OAuth-only per D-02/D-02a — wrapper refuses
to run if `OPENAI_API_KEY` is set, and defensively `unset`s it either way.

## Deviation from D-01 (P4 — must be surfaced at plan review)

D-01 specified "`--prompt-file`" as the Codex CLI invocation shape. RESEARCH §1a
verified against [developers.openai.com/codex/cli/reference](https://developers.openai.com/codex/cli/reference):
**no `--prompt-file` flag exists on `codex exec`**. Codex accepts prompts only as
a positional arg or via stdin (`-`). This plan uses **stdin pipe** as the
invocation shape:

```
cat "$PROMPT_FILE" | codex exec --sandbox read-only --ephemeral --skip-git-repo-check -
```

The wrapper **keeps its own `--prompt-file` flag** as the external contract — the
orchestrator and contract-check harness still hand the wrapper a file path. Only
the internal transport to `codex exec` changes. This is a documentation-level
deviation (D-01's mental model was wrong; D-01's acceptance criteria still pass).
The D-01a exit-code table, D-01b timeout config, D-01c JSONL schema, and D-04a
path translation all remain as locked.

## Tasks

T1. **Author `super-gsd/scripts/codex-exec.sh`**
  - Files: `super-gsd/scripts/codex-exec.sh` (new, `chmod +x`)
  - Closest analog: `super-gsd/scripts/sgsd-muda-audit.sh:50-311` (arg-parse + root-detect + dry-run + atomic-write + JSONL-append)
  - Reuse scripts: root-detection walk-up from `sgsd-curate.sh:101-126`; arg-parse template `sgsd-curate.sh:42-57`; atomic write `sgsd-muda-audit.sh:225-229`; JSONL append `sgsd-muda-audit.sh:304-308`; `--dry-run` `sgsd-muda-audit.sh:216-223`; `wslpath -u` translation already in `sgsd-curate.sh`
  - Net-new work:
    1. **Auth hygiene gate (D-02a)**: `if [[ -n "$OPENAI_API_KEY" ]]; then echo "ERR: codex-exec is OAuth-only per D006; unset OPENAI_API_KEY" >&2; exit 4; fi` then `unset OPENAI_API_KEY` defensively.
    2. **Flag set**: `--prompt-file <path>` (required), `--timeout <sec>` (optional; defaults from `config.review_providers.codex_timeout_seconds`, 30s fallback), `--report-out <path>` (required), `--dry-run` (optional), `--project <path>` (optional; derived from root-walk if omitted).
    3. **Path translation (D-04a)**: If `--project` input starts with `C:\` or `/mnt/c/`, run through `wslpath -u` (idempotent on POSIX). Pass result to `codex exec --cd <path>`.
    4. **Invocation**: `timeout "${TIMEOUT_SECONDS}s" bash -c 'cat "$0" | codex exec --sandbox read-only --ephemeral --skip-git-repo-check --cd "$1" -' "$PROMPT_FILE" "$PROJECT"` capturing stdout to `$STDOUT_TMP` and stderr to `$STDERR_TMP`. Capture exit in `$RC`.
    5. **Exit remap (D-01a)**: `RC=124` → wrapper exit 5 (timeout); `RC != 0` AND stderr matches `/auth|401|unauthori[sz]ed/i` → exit 4; `RC != 0` otherwise → exit 1 (generic codex failure, with first 200B of stderr captured to codex-log debug field); `RC = 0` but parse fails → exit 6; `which codex` empty at startup → exit 3.
    6. **Report parse (D-03)**: awk pipeline extracting the 5 fields (`FINDINGS:`, `CRITICAL:`, `WARNINGS:`, `PASS_RATE:`, `ONE_LINER:`) from `$STDOUT_TMP`. All 5 must be present or exit 6. Write parsed block atomically via tmp+mv to `--report-out`.
    7. **JSONL provenance (D-01c)**: single `printf` line to `.planning/metrics/codex-log.jsonl` with fields `{ts, phase, plan, step, exit, duration_ms, prompt_bytes, report_bytes, timeout_hit, fallback_triggered:false, stderr_preview}`. `fallback_triggered` is always `false` from the wrapper (D-01c — set by orchestrator later).
    8. **Dry-run**: prints resolved command line + auth status + parse preview without executing `codex exec`; returns exit 0.
  - Verification:
    - `bash -n super-gsd/scripts/codex-exec.sh` exits 0 (syntax).
    - `shellcheck super-gsd/scripts/codex-exec.sh` reports no errors (warnings OK for known sgsd-family patterns).
    - `super-gsd/scripts/codex-exec.sh --dry-run --prompt-file fixtures/toy-prompt.txt --report-out /tmp/out.txt` echoes the resolved command and exits 0.
    - `OPENAI_API_KEY=x super-gsd/scripts/codex-exec.sh --prompt-file fixtures/toy-prompt.txt --report-out /tmp/out.txt` exits **4** with the D-02a refusal message on stderr.

T2. **Sidecar `super-gsd/scripts/codex-exec.README.md`**
  - Files: `super-gsd/scripts/codex-exec.README.md` (new, ~40 lines)
  - Closest analog: `super-gsd/scripts/sgsd-muda-audit.README.md` (if exists) or inline header comments in `sgsd-curate.sh:1-40`
  - Reuse scripts: none — doc file
  - Content: flag reference, exit-code table (3=no-cli, 4=auth-denied, 5=timeout, 6=report-contract-violation, 1=generic, 0=success), the P4 deviation note (stdin-pipe not `--prompt-file` on codex itself), OAuth-hygiene rationale, examples (dry-run + real invocation).
  - Verification: file exists, markdown parses, exit-code table matches T1's exit-code table exactly (spot-check manually).

## Acceptance criteria

A1. `super-gsd/scripts/codex-exec.sh` exists and is executable (`chmod +x` set); `bash -n` parses it with exit 0. **(covers D-23 invariant 1)**
A2. Exit codes 3, 4, 5, 6 are exercised by the script's control flow and documented in the sidecar README — one branch per exit. **(covers D-01a)**
A3. Wrapper refuses to run when `OPENAI_API_KEY` is set in the environment; exits 4 with the D-02a refusal message on stderr. **(covers D-02/D-02a)**
A4. Wrapper invokes `codex exec` via **stdin pipe** (`cat "$file" | codex exec ... -`), NOT via a `--prompt-file` flag on codex (which does not exist). Deviation from D-01 is documented in the sidecar README. **(covers P4; supersedes literal D-01)**
A5. On success, one JSONL row is appended to `.planning/metrics/codex-log.jsonl` with all 11 fields from D-01c present and well-typed. **(covers D-01c)**
A6. Timeout: `timeout ${SECS}s codex exec ...` wrapping exists; exit 124 is remapped to wrapper exit 5. **(covers D-01b)**
A7. `--report-out` write uses atomic tmp+mv from `sgsd-muda-audit.sh:225-229` pattern. **(covers S6 shared pattern)**
A8. `--project` / `--cd` path handling translates Windows-style paths via `wslpath -u`, idempotent on POSIX inputs. **(covers D-04a)**

## Non-goals

- **No PowerShell-native `codex-exec.ps1`** — deferred post-v1.3 per D-24. WSL-only on Windows.
- **No consumer wiring** — no `sgsd-orchestrate/SKILL.md` edits, no `gates.yaml` row routes to this wrapper. That's Phase 15 per D-11/D-11a.
- **No registry integration** — the wrapper is a freestanding shell script; registry integration lives in plan 14-02.
- **No VTP consumption** — per D-24, wrapper does not read `VTP-EVIDENCE.md`. Phase 15 discuss decides.
- **No `--output-last-message -o` path** — start with stdout capture only (RESEARCH §4 item 2); upgrade path reserved if buffer issues surface.
- **No live `codex exec` invocation in the verifier** — Phase 14 `verify.mjs` runs `bash -n` + dry-run only. Contract-check harness (14-04) exercises the real path, with the dual-CLI-absent exit-2 soft-fail escape hatch (D-17).

## Evidence lineage

- CONTEXT decisions covered: **D-01 (w/ P4 deviation), D-01a, D-01b, D-01c, D-02, D-02a, D-03, D-04, D-04a**
- RESEARCH findings consumed: **§1a (stdin pipe, no `--prompt-file`), §1b (OAuth hygiene + issue #15151), §1c (exit 124 from GNU timeout), §1d (WSL path recommendation), §2a (shell-wrapper precedent), §5 14-01**
- PATTERNS analogs reused: **sgsd-muda-audit.sh:50-311 (whole wrapper shape), sgsd-curate.sh:42-57 (arg-parse), sgsd-curate.sh:101-126 (root-detection), S6 (atomic write), S7 (JSONL append)**
- VTP evidence: BYPASSED (Phase 14 VTP-agnostic per D-11/D-24)
