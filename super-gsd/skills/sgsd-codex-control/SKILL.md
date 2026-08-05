---
name: sgsd-codex-control
description: "Inspect and update SGSD Codex CLI dispatch profiles in super-gsd/registry/codex-profiles.yaml. Use when the operator asks to show Codex runtime posture, set executor/review/triage profile fields, or choose a per-dispatch --profile."
allowed-tools:
  - Bash
  - Read
---

<objective>
Provide operator control for SGSD Codex CLI profiles without hand-editing YAML.
The registry source is `super-gsd/registry/codex-profiles.yaml` under
`cli_profiles:`.
</objective>

<commands>
Show current CLI profiles:

```bash
bash super-gsd/scripts/sgsd-codex-control.sh show
```

Set an unguarded field:

```bash
bash super-gsd/scripts/sgsd-codex-control.sh set triage ephemeral true
bash super-gsd/scripts/sgsd-codex-control.sh set triage ephemeral false
```

Use a profile for one review dispatch:

```bash
bash super-gsd/scripts/codex-exec.sh --profile triage --prompt-file <path> --report-out <path>
```

Executor wrapper default profile is `executor`; review wrapper default profile
is `review`. CLI `--profile` overrides `SGSD_CODEX_PROFILE`, which overrides
the wrapper default. `codex.review.native` is accepted as an alias for `review`.
</commands>

<guardrails>
`sandbox=danger-full-access` and trust or approval fields are guarded. The
command refuses non-interactive attempts. In an interactive terminal, type the
exact phrase printed by the command:

```text
CONFIRM SGSD CODEX PROFILE <profile> <field> <value>
```

The confirmation requires both stdin and stdout to be TTYs.
</guardrails>

<evidence>
Registry load, parse, validation, show, set, and refusal outcomes write to:

```text
.planning/metrics/codex-profile-resolution-log.jsonl
```

Missing or corrupt registry resolution fails open to built-in defaults and logs
a fallback row. Absence of that evidence is a defect.
</evidence>