# codex-exec.sh — Codex CLI provider wrapper

Bash wrapper around `codex exec` used by the Phase 14 review-provider substrate.
Ships prompt via **stdin pipe**, wraps with GNU `timeout`, parses the required
`code-reviewer-v1` summary fields, preserves additive `FINDINGS_DETAIL:` rows,
writes the report atomically, and appends one provenance row to
`.planning/metrics/codex-log.jsonl`.

## Codex runtime

The wrapper resolves the runtime posture for every SGSD Codex shell dispatch
through the P145 CLI profile path:

1. The requested profile is selected from `--profile`, then
   `SGSD_CODEX_PROFILE`, then the wrapper default `review`.
2. `super-gsd/scripts/lib/codex-profile-shell.sh` calls
   `node super-gsd/tools/codex-pro/profile-resolver.cjs --resolve-cli ...`.
3. The resolver reads `super-gsd/registry/codex-profiles.yaml` top-level
   `cli_profiles` and returns sanitized `KEY=VALUE` rows for the wrapper.
4. Config-backed `review_providers.codex_model` and
   `review_providers.codex_reasoning_effort` overrides may replace the
   profile model and reasoning effort.
5. Explicit `--model` and `--reasoning` CLI overrides apply last.

`review_providers.codex_model` and
`review_providers.codex_reasoning_effort` are override inputs, not the baseline
source for runtime posture. The baseline model, reasoning effort, sandbox,
ephemeral setting, and approval mode come from the resolved CLI profile;
`.planning/config.json` also backs timeout settings such as
`review_providers.codex_timeout_seconds` and
`review_providers.codex_timeout_tiers`.

The default `review` profile resolves to model `gpt-5.5`, reasoning `xhigh`,
sandbox `read-only`, ephemeral mode, and approval `never`. The
`codex.review.native` profile name is accepted as an alias for `review`; the
`triage` profile is read-only and non-ephemeral. The resolved model and
reasoning effort are written to `.planning/metrics/codex-log.jsonl` and
`.planning/metrics/codex-live.json`.

If the resolver, Node runtime, registry load, YAML parse, registry validation,
or requested profile lookup fails, dispatch fails open to built-in defaults and
appends a `codex-profile-resolution-log.jsonl` row under
`.planning/metrics/`. Shell-level resolver failures are logged with
`source:"shell-builtin"` and `reason:"resolver_unavailable"`; resolver-handled
fallbacks include `registry_missing`, `registry_corrupt`, `invalid_registry`,
and `unknown_profile`.
When launched from WSL Bash on Windows, the wrapper invokes `cmd.exe /c codex`
with a Windows `--cd` path so the npm Codex CLI uses the installed Windows Node
runtime instead of the Unix shim.

## Usage

```
codex-exec.sh --prompt-file <path> --report-out <path>
              [--timeout N] [--dry-run] [--project <path>]
              [--phase N] [--plan NN-PP] [--step LABEL] [--profile NAME]
              [--model NAME] [--reasoning EFFORT]
```

| Flag            | Req?     | Purpose                                                                 |
| --------------- | -------- | ----------------------------------------------------------------------- |
| `--prompt-file` | required | Path to prompt file (piped on stdin to `codex exec -`)                  |
| `--report-out`  | required | Destination for parsed report; required summary fields plus any `FINDINGS_DETAIL:` rows; written atomically via `tmp+mv` |
| `--timeout`     | optional | Seconds (default from `.planning/config.json` → `review_providers.codex_timeout_seconds`, fallback 30) |
| `--dry-run`     | optional | Print resolved command + auth status + config; return 0 without calling `codex` |
| `--project`     | optional | `--cd` target for codex; default = repo root via `.planning/` walk-up   |
| `--phase`       | optional | JSONL tag only (null when absent)                                       |
| `--plan`        | optional | JSONL tag only (e.g. `14-01`; null when absent)                         |
| `--step`        | optional | JSONL tag only (e.g. `6.5` / `9.5` / `9.6`; null when absent)           |
| `--profile`     | optional | CLI profile (`review`, `triage`, or `codex.review.native` alias)        |
| `--model`       | optional | Model override applied after `cli_profiles` and config-backed `review_providers.codex_model` resolution |
| `--reasoning`   | optional | Reasoning-effort override applied after `cli_profiles` and config-backed `review_providers.codex_reasoning_effort` resolution |

## Exit codes

| Code | Meaning                                                                |
| ---- | ---------------------------------------------------------------------- |
| 0    | Success — report parsed, written, JSONL row appended                   |
| 1    | Generic codex failure (non-zero RC, not auth, not timeout) + usage err |
| 3    | `codex` binary not on `$PATH`                                          |
| 4    | Auth denied — `OPENAI_API_KEY` set in env (refuse-to-run), OR codex stderr matched `/auth\|401\|unauthori[sz]ed/i` |
| 5    | Timeout — GNU `timeout` returned 124                                   |
| 6    | Report contract violation — one or more of `FINDINGS:`/`CRITICAL:`/`WARNINGS:`/`PASS_RATE:`/`ONE_LINER:` missing from codex stdout |

`FINDINGS_DETAIL:` is optional and repeatable. The wrapper preserves those rows
from the final contract block verbatim because file:line citations and concrete
repair notes live there. Extra detail rows must not affect exit code 6 as long
as the five required summary fields are present.

## OAuth hygiene (D-02 / D-02a)

codex-exec is **OAuth-only**. If `$OPENAI_API_KEY` is set in the environment,
the wrapper exits **4** and prints a refusal message on stderr — it does NOT
unset-then-run. Rationale: silently degrading the operator's expectation
("I set an API key, my invocations use it") corrupts auth provenance and
masks misconfigured callers. The codex binary resolves its OAuth token from
its own config (`~/.codex/config.json` / `$CODEX_HOME`).

## P4 deviation: stdin pipe, not `--prompt-file` on codex

D-01 mentioned `--prompt-file` as the Codex invocation shape. RESEARCH §1a
verified against `developers.openai.com/codex/cli/reference`: **no
`--prompt-file` flag exists on `codex exec`**. Codex accepts prompts only as
a positional arg or via stdin (`-`). This wrapper pipes on stdin:

```
cat "$PROMPT_FILE" | codex exec --model "$CODEX_MODEL" \
    -c "model_reasoning_effort=\"$CODEX_REASONING_EFFORT\"" \
    --sandbox read-only --ephemeral \
    --skip-git-repo-check --cd "$PROJECT" -
```

The wrapper **keeps its own `--prompt-file` flag as the external contract** —
only the internal transport to `codex exec` changes. D-01a/D-01b/D-01c/D-04a
all remain as locked.

## Examples

```bash
# Dry-run (no codex invocation; prints resolved command + auth status)
codex-exec.sh --dry-run \
  --prompt-file .planning/phases/14-*/prompt.txt \
  --report-out /tmp/report.txt

# Real invocation (OAuth token resolved by codex CLI itself)
codex-exec.sh \
  --prompt-file .planning/phases/14-codex-cli-provider-substrate/prompt.txt \
  --report-out .planning/phases/14-codex-cli-provider-substrate/CODEX-REPORT.md \
  --timeout 60 --phase 14 --plan 14-01 --step 6.5
```

## Operator control

Use `bash super-gsd/scripts/sgsd-codex-control.sh show` to inspect CLI
profiles and `set <profile> <field> <value>` to edit them. The guarded
`sandbox=danger-full-access` and trust/approval fields require an interactive
terminal plus exact confirmation:
`CONFIRM SGSD CODEX PROFILE <profile> <field> <value>`. Deferred hardcoded
callers remain out of scope for P145.
