# SGSD Oz Environment Spec (v2.7 Phase 92)

Defines the Warp Oz cloud environment shape an operator would configure
to run the cloud-safe SGSD tasks (CS-01..CS-05) from Phase 91. Spec only;
this phase does NOT create cloud environments — that's operator-led when
they decide to opt in.

## Environment Profile: `sgsd-cloud-audit-v1`

```yaml
name: sgsd-cloud-audit-v1
purpose: Run SGSD-adjacent read-only audits (CS-01..CS-05 from Phase 91 cloud-safe skills)

base_image: node:20-alpine
# Alpine because audits are read-only / docs-emitting; no Windows-specific tooling needed.

repositories:
  - name: GSDedits
    url: https://github.com/<owner>/GSDedits.git    # operator's GitHub fork/upstream
    branch: master
    depth: 1                                        # shallow clone; cloud audits don't need deep history

setup_commands:
  - apk add --no-cache git curl jq                  # minimal toolchain
  - cd /workspace/GSDedits
  - npm install --omit=dev                          # SGSD has near-zero deps; this is fast
  - node super-gsd/tools/state-resolver/resolve.cjs --json  # warm-cache the resolver

runtime_config:
  node_version: 20.x
  npm_version: 10.x
  powershell_available: false                       # Linux container; no PowerShell
  vtp_enabled: false                                # CS-01..CS-05 are PUBLIC by definition
  redis_enabled: false                              # No live cockpit needed in cloud
  codex_enabled: false                              # No Codex auth in cloud; runs are pure-Node

allowed_secrets:
  - GITHUB_TOKEN                                    # for opening PRs (CS-04 / CS-02)

forbidden_secrets:
  - WARP_API_KEY                                    # never needed for read-only audits
  - ANTHROPIC_API_KEY                               # never needed; Claude not invoked from cloud
  - OPENAI_API_KEY                                  # never needed; Codex not invoked from cloud
  - VTP_*                                           # private KB credentials never go to cloud
```

## Why these knobs

### Base image: `node:20-alpine`

- Pure-Node SGSD audit tools have no native deps.
- Alpine is small (~50MB) — fast cold-start for scheduled jobs.
- Linux means no Windows-specific tooling; matches the CU-03 boundary
  (Windows boot validation is local-only).

### `npm install --omit=dev`

- SGSD has minimal runtime deps. `dev` deps not needed for audits.
- Faster install + smaller container.

### `powershell_available: false`

- Audits are pure-Node. No PowerShell scripts (which are Windows-specific).
- Phase 67 warp-doctor probes 2-4 (sg/sgsd/sgsd-setup_command_defined_in_profile)
  return `NOT-APPLICABLE` on non-Windows hosts — so they degrade cleanly here.

### `vtp_enabled: false`

- CS-01..CS-05 are PUBLIC by definition (Phase 91 contract).
- VTP / private KB stays on operator's local machine (CU-01).

### `redis_enabled: false`

- Cloud audits don't need a live cockpit. Phase 52 Redis adapter is local-only.
- The audit produces a markdown PR; that's the entire output.

### `codex_enabled: false`

- Phase 90 controlled-action server requires operator approval flow.
- Cloud has no operator presence; default-deny would trigger every time.
- Cloud audits are read-only; they don't need to call Codex.

### `forbidden_secrets`

- Cloud agents must NOT have access to API keys / private KB credentials.
- Operator-machine secrets stay on the operator machine.

## Allowed Audits (per Phase 91)

| Audit | Cloud-safe class | Schedule | Output |
|---|---|---|---|
| Docs drift audit | CS-01 | weekly | `.planning/analyses/<ISO>-docs-drift-report.md` PR |
| Public repo issue scan | CS-02 | weekly | `.planning/analyses/<ISO>-warp-upstream-watch.md` PR |
| Clean-install audit | CS-03 | monthly | `.planning/analyses/<ISO>-cross-platform-install-report.md` PR |
| Scheduled doc-refresh PR | CS-04 | nightly | GitHub PR draft |
| Repo health audit | CS-05 | weekly | `.planning/analyses/<ISO>-repo-health-audit.md` PR |

Each audit is read-only; output is a PR draft for operator review.

## What This Spec Does NOT Authorize

Following Phase 91 default-local discipline:

- No write to STATE.md (operator-owned).
- No mutation of `.planning/metrics/*.jsonl` (append-only audit trail).
- No invocation of controlled actions (Phase 90 — operator approval needed).
- No Codex / Claude API calls (no auth in cloud).
- No VTP queries (private KB stays local).

## Operator Flow (when opting in)

1. Operator creates Oz environment from this spec via Warp UI / CLI.
2. Operator schedules audit cadence (weekly / monthly / nightly).
3. Audit runs in cloud; opens PR back to repo.
4. Operator reviews PR locally; merges OR rejects.
5. Operator can revoke environment any time; no live state at risk.

## Environment Lifecycle

- **Provisioning**: per-run (ephemeral) — fresh container each schedule.
- **Persistence**: zero. Cloud runs do not retain state between runs.
- **Audit trail**: GitHub PR history is the only record.
- **Failure recovery**: if a run fails, the next scheduled run is the recovery — no rollback needed.

## Spec Validation

Anyone deploying this spec must verify:

- Container starts within 60s of trigger.
- `npm install` completes in <30s on warm cache.
- Audit produces PR draft within 5 min for typical scenario.
- Forbidden secrets are NOT present in container env (verified via `printenv | grep -E "(KEY|TOKEN)"`).

## Forward References

- Phase 93 — Scheduled Audit Design picks which CS-* run on what cron via this env.
- Phase 96 — Upstream Issue/Spec Pack uses CS-02 audit cadence (weekly).
- Phase 97 — Release gate verification covers cloud-safe inventory (no implementation in cloud yet; spec-only ship).

## Hard Boundary

The first time the cloud env is exercised, ANY divergence from Phase 91
default-local discipline is a regression. Cloud audits never write to
local state, never expose secrets, never invoke controlled actions.
This spec is the contract; deviation requires a successor phase + operator
deliberation.
