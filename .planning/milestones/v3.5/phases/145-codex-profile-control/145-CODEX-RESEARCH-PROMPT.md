<intent milestone="v3.5">
Governance as runtime mechanism in all session modes; absence of evidence must be loud.
</intent>

# Research task — P145: Codex Profile Registry + /sgsd-codex-control

You are the phase researcher for SGSD phase 145. READ-ONLY. Produce a research
report that a planner can turn into an executable plan. Do not write code.

## Goal being researched

Move Codex dispatch config (sandbox, ephemeral, approval, model, effort) from
hardcoded literals into `super-gsd/registry/codex-profiles.yaml` with three
profiles (executor: workspace-write/full-auto/non-ephemeral; review:
read-only/ephemeral; triage: read-only/NON-ephemeral), refactor both wrappers
to resolve flags from the registry (behaviour-preserving: byte-identical codex
invocations for untouched registry), and add a `/sgsd-codex-control` skill
(show / set / per-dispatch --profile override) that hard-refuses
`danger-full-access` without interactive TTY confirmation.

## Questions to answer (cite file:line evidence)

1. Exact current flag construction in `super-gsd/scripts/codex-executor.sh`
   (~lines 154-211) and `super-gsd/scripts/codex-exec.sh` (~lines 423, 662):
   every codex CLI flag, both CODEX_LAUNCHER paths (cmd vs native), and where
   model/effort come from (config.json keys, env, defaults).
2. What YAML parsing already exists in-repo with zero new deps
   (e.g. `super-gsd/scripts/lib/gates-registry.cjs` — how does it parse
   gates.yaml? Can the same approach/lib be reused for codex-profiles.yaml,
   or is a bash-side parser needed since the wrappers are bash?).
3. Simplest behaviour-preserving resolution mechanism for BASH wrappers:
   options (a) node helper printing KEY=VALUE lines the wrapper `eval`s or
   reads, (b) pure-bash yaml grep, (c) generated .env-style sidecar. Recommend
   one with failure modes (missing/corrupt yaml MUST fail open to today's
   built-in defaults + loud log row).
4. How `codex exec` flags map to profiles: `--full-auto` vs `--sandbox
   read-only` vs `--ephemeral` vs danger modes — verify against codex-cli
   0.146.0 help (run `codex exec --help` if sandbox permits; else cite repo
   usage).
5. Where existing skills live and their SKILL.md structure so
   `/sgsd-codex-control` matches house conventions
   (`super-gsd/skills/*/SKILL.md` + installer sync to `~/.claude/commands/`).
6. TTY detection in bash for the danger guard (`[ -t 0 ]` semantics under
   Claude-Code-spawned bash, Warp, and ssh) — what does "interactive" reliably
   mean here; safest refusal predicate.
7. Existing self-test harness pattern to follow (house `--self-test` CLI style,
   e.g. vtp-context-composer.cjs) and where milestone self-tests register.
8. Which callers besides the two wrappers hardcode sandbox/model flags
   (grep for `--full-auto`, `--sandbox`, `gpt-5.5` under super-gsd/) — the
   full blast-radius list for the refactor.

## Constraints (binding)

- Zero new runtime dependencies (fs/path/os only for node parts).
- Behaviour-preserving default: untouched registry → byte-identical invocations.
- Fail OPEN on registry problems, loud log row to .planning/metrics/.
- Respect explicit `--timeout` handling fixed in 900bced; do not regress.
- `danger-full-access` + trust changes: interactive confirmation only.

## Report contract — write EXACTLY this structure

FINDINGS: numbered answers to Q1-Q8 with file:line citations
RECOMMENDED_APPROACH: one paragraph + file-touch list
RISKS: top 3 with mitigations
DEVIATIONS: none | list
ONE_LINER: substantive summary
Max 600 words.
