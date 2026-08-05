# SGSD Codex Pro Mode

DLB-09.1 adds Codex Pro Mode lanes to SGSD. These tools do not replace
`super-gsd/scripts/codex-executor.sh` or `codex-exec.sh`; they provide the
typing, stoplight classification, and native-review CMB emission those wrappers
can consume in later orchestration wiring.

Codex Pro Mode sits on top of the DLB-08 mesh substrate. The native review lane
emits `review_finding` CMBs into `.planning/mesh/memory/cmbs.jsonl`, using the
same full schema shape as the existing mesh-memory review tools.

## Profiles

The static registry lives at `super-gsd/registry/codex-profiles.yaml` and has
two top-level maps:

- `profiles`: the original Codex Pro Mode profile registry. This map still
  defines exactly 10 profiles for DLB-09.1 dispatch classification.
- `cli_profiles`: the P145 CLI dispatch registry consumed by
  `codex-profile-shell.sh` and `profile-resolver.cjs` for wrapper defaults.

The 10 Codex Pro Mode profiles under `profiles` are:

- `codex.readonly.audit`: safest read-only fallback for audits and unknown work.
- `codex.plan`: read-only planning lane for single planning-file updates.
- `codex.goal`: broad goal execution with locked plan, worktree, hooks, and native review.
- `codex.execute.bounded`: low-risk bounded execution of up to 6 changed files.
- `codex.execute.patch`: read-pack patch fallback for locked-plan patch mode.
- `codex.review.native`: Codex native review lane.
- `codex.review.swarm`: read-only review swarm lane.
- `codex.cockpit.brief`: read-only cockpit/status brief lane.
- `codex.app_lab`: app lab lane with worktree, hooks, and native review.
- `codex.cloud_lab`: cloud lab lane with worktree, hooks, and native review.

## CLI dispatch profiles

The CLI dispatch profiles under `cli_profiles` are:

- `executor`: default for `codex-executor.sh`; model `gpt-5.5`, reasoning
  `xhigh`, workspace-write, non-ephemeral, approval `full-auto`, emitted as the
  byte-preserved `--full-auto` executor fragment.
- `review`: default for `codex-exec.sh`; model `gpt-5.5`, reasoning `xhigh`,
  read-only, ephemeral, approval `never`.
- `triage`: optional `codex-exec.sh --profile triage` lane; model `gpt-5.5`,
  reasoning `xhigh`, read-only, non-ephemeral, approval `never`.

`codex.review.native` aliases to the `review` CLI profile so existing native
review callers can keep their profile string. Wrapper resolution precedence is
`--profile` over `SGSD_CODEX_PROFILE` over each wrapper's default profile, then
`profile-resolver.cjs --resolve-cli` reads `cli_profiles` and
`codex-profile-shell.sh` applies the sanitized result to the wrapper. Config
`review_providers.*` model/reasoning overrides may layer on top of the resolved
profile, and explicit `--model` / `--reasoning` flags apply last. If the
resolver cannot load or validate the registry, or the requested CLI profile is
unknown, wrappers fail open to built-in defaults and append a fallback row to
`.planning/metrics/codex-profile-resolution-log.jsonl`.

## profile-resolver

```bash
node super-gsd/tools/codex-pro/profile-resolver.cjs --help
node super-gsd/tools/codex-pro/profile-resolver.cjs --list
node super-gsd/tools/codex-pro/profile-resolver.cjs --show-cli
node super-gsd/tools/codex-pro/profile-resolver.cjs --resolve-cli review
node super-gsd/tools/codex-pro/profile-resolver.cjs --resolve '{"phase_type":"execute","risk":"low","allowed_files":["src/x.ts"]}'
```

The resolver applies the DLB-09.1 ordered rule table and prints a JSON profile
envelope containing the selected Codex Pro profile name and registry settings.
For CLI profiles, `--resolve-cli` prints sanitized `KEY=VALUE` rows for Bash
wrappers, while `--show-cli` prints the current `cli_profiles` registry.

## stoplight

```bash
node super-gsd/tools/codex-pro/stoplight.cjs --help
node super-gsd/tools/codex-pro/stoplight.cjs --classify '{"locked_plan":true,"allowed_files_count":2,"acceptance_command":"npm test","risk":"low"}'
```

The stoplight classifies dispatches as `GREEN`, `AMBER`, or `RED`, prints the
verdict and reasons, and appends evidence rows to
`.planning/metrics/pro-mode-stoplight.jsonl` with `{ ts, verdict, reasons[],
context_hash }`.

## native-review-runner

```bash
node super-gsd/tools/codex-pro/native-review-runner.cjs --help
node super-gsd/tools/codex-pro/native-review-runner.cjs --phase 110 --diff-path path/to.diff --executor-receipt cmb-execution-receipt-key
```

Real invocations use the existing Codex executor wrapper with the
`codex.review.native` profile, convert findings into schema-valid
`review_finding` CMBs, append them to the mesh-memory ledger, and write
`CODEX-NATIVE-REVIEW.md` in the phase directory.

## Self-Test

```bash
node super-gsd/tools/codex-pro/run-self-test.cjs
```

The self-test performs 20 assertions across CLI help, profile resolution,
registry shape, stoplight verdicts and metrics, and native-review CMB emission.
On success it prints:

```text
[codex-pro self-test] 20/20 passed
```

Cross-reference: DLB-08 mesh substrate and the SGSD-PRO master proposal
(`.planning/proposals/2026-05-20-sgsd-pro-mode-codex-context-authority-plan.md`).
