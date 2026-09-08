# codex-exec.sh — Codex CLI provider wrapper

Bash report wrapper around the SGSD two-way Codex App Server adapter.
Ships the prompt through stdin to a bounded, retained worker turn, parses the required
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

The default `review` profile resolves to model `gpt-5.6-sol`, reasoning `xhigh`,
sandbox `danger-full-access`, retained sessions, and approval `never`. The
`codex.review.native` profile name is accepted as an alias for `review`.
All shipped CLI profiles use the same OS access and approval policy. The resolved model and
reasoning effort are written to `.planning/metrics/codex-log.jsonl` and
`.planning/metrics/codex-live.json`.

If the resolver, Node runtime, registry load, YAML parse, registry validation,
or requested profile lookup fails, dispatch fails open to built-in defaults and
appends a `codex-profile-resolution-log.jsonl` row under
`.planning/metrics/`. Shell-level resolver failures are logged with
`source:"shell-builtin"` and `reason:"resolver_unavailable"`; resolver-handled
fallbacks include `registry_missing`, `registry_corrupt`, `invalid_registry`,
and `unknown_profile`.
When launched from WSL Bash, the wrapper uses native Linux Node and Codex.
A Windows shim or forced `cmd` launcher fails explicitly with exit 3; it cannot
silently replace the two-way bridge. Native Windows callers can use the Node
adapter directly. The source and both installed runtime layouts contain the
complete worker dependency closure.

## Deliberation board transport

`lib/board-dispatch.cjs` prepares a fresh output directory and an explicit Bash
command for each external seat. Run it from the canonical source runtime on
global installations, not the flat installed helper tree (the source tree owns
its YAML dependencies and registry). `/sgsd-deliberate` documents that lookup.

The `board-position-v1` contract uses the existing ten-field deliberation YAML
validator and requires the advisory role `codex.readonly.audit`, full OS access
and approval `never`. The historical profile name does not provide an OS
read-only boundary: board workers must not edit source or bypass SGSD gates. It carries the active milestone into the existing provider circuit,
whose state is bound to the dispatched project. Output is accepted only from
the current attempt. Exit **6** permits the workflow's one malformed-output retry
with the same model; exit **8** means host validator/gate unavailable and is not
a reason to retry a paid call. Circuit-open **7**, timeout, auth, unsupported
model or report persistence failures leave the board incomplete. There is no
automatic model substitution or authentication change.

Seat model IDs are distinct from display labels: Astra Max is `gpt-6-astra` with
`--reasoning max`; Luna Max is `gpt-5.6-luna` with `--reasoning max`. Fable seats
remain Claude `Agent()` dispatches. Researcher's requested "Atlas" is unresolved
and explicitly blocked, not relabelled `gpt-5.6-sol`.

Each real invocation attaches an independent Atlas telemetry run; only telemetry
`-c` settings are added, with prompt logging disabled. Missing or opted-out
telemetry does not block the model call and disables its native exporter.
The two-way channel is separate from Atlas: each adapter owns one App Server
connection and a private project worker mailbox. Questions, replies and steering
stay in `.planning/worker-sessions/`; raw events and conversation content do not
enter Atlas. The report validator runs only after successful turn completion.

Launch the wrapper in the background, then follow `tools/codex-worker/README.md`
(or the installed `sgsd-workers` skill) to poll `control.cjs status`, reply to
an exact worker/request, inspect the command receipt, steer the active turn or
stop it. Do not block the supervising unit while its worker awaits input.
`--owner` / `SGSD_WORKER_OWNER` identifies the supervising unit; phase, plan and
step flags also populate worker metadata. The role is derived from the wrapper
contract. Explicit `SGSD_WORKER_RESUME_ID` resumes a recorded thread; no `--last`
or automatic one-shot fallback is used.

If a background handle is lost, inspect that worker's `wrapper-result.json`.
It records `worker_id`, `project`, `wrapper_attempt_id`, `exit_code`,
`report_path`, `sha256` and `bytes`. Accept recovery only when the worker identity
matches, the receipt has exit 0 and the current report matches its hash and size.
A missing receipt or a completed core turn alone cannot prove wrapper success.
Each explicitly requested timeout escalation gets its own worker and receipt.

## Usage

```
codex-exec.sh --prompt-file <path> --report-out <path>
              [--timeout N] [--dry-run] [--project <path>]
              [--phase N] [--plan NN-PP] [--step LABEL] [--profile NAME]
              [--model NAME] [--reasoning EFFORT] [--owner UNIT]
```

| Flag            | Req?     | Purpose                                                                 |
| --------------- | -------- | ----------------------------------------------------------------------- |
| `--prompt-file` | required | Path to prompt file (read by the worker adapter from stdin)                  |
| `--report-out`  | required | Destination for parsed report; required summary fields plus any `FINDINGS_DETAIL:` rows; written atomically via `tmp+mv` |
| `--timeout`     | optional | Seconds (default from `.planning/config.json` → `review_providers.codex_timeout_seconds`, fallback 30) |
| `--dry-run`     | optional | Print resolved command + auth status + config; return 0 without calling `codex` |
| `--project`     | optional | `--cd` target for codex; default = repo root via `.planning/` walk-up   |
| `--phase`       | optional | JSONL and worker metadata tag (null when absent)                                       |
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
| 3    | Worker runtime unavailable, missing native CLI, or unsupported interop                                          |
| 4    | Auth denied — `OPENAI_API_KEY` set in env (refuse-to-run), OR codex stderr matched `/auth\|401\|unauthori[sz]ed/i` |
| 5    | Timeout — bounded worker adapter returned 124                                   |
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

## Worker transport

The wrapper keeps its public `--prompt-file` / `--report-out` contract. Its
internal invocation is an argument array equivalent to:

```bash
node "$SGSD/tools/codex-worker/run.cjs" --project "$PROJECT" \
  --model "$CODEX_MODEL" --reasoning "$CODEX_REASONING_EFFORT" \
  --timeout "$TIMEOUT" --owner "$SGSD_WORKER_OWNER" --role reviewer \
  --sandbox danger-full-access --ask-for-approval never < "$PROMPT_FILE"
```

App Server command overrides are `SGSD_CODEX_APP_SERVER_COMMAND` and the JSON
prefix argv `SGSD_CODEX_APP_SERVER_ARGS`; `SGSD_CODEX_COMMAND` is also respected.
Only final completed-turn text reaches stdout; failed/interrupted/timed-out turns
remain nonzero. The adapter owns the deadline, interruption and process cleanup.

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
`CONFIRM SGSD CODEX PROFILE <profile> <field> <value>`. The guarded mutation confirmation remains required even though shipped SGSD
worker profiles now use full access. Global Codex settings are not changed.
