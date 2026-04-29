# SGSD Scheduled Audit Design (v2.7 Phase 93)

Cron schedules for the Phase 91 cloud-safe audits running in the
Phase 92 Oz environment. Spec only — schedules are NOT created
automatically. Operator opts in by configuring Warp Oz from this catalog.

## 4 Candidate Schedules

### SA-01: Weekly Warp Docs/Roadmap Scan (CS-02)

```
schedule: "0 9 * * 1"         # Monday 09:00 UTC
audit: CS-02 (public repo issue scan)
expected_runtime: < 5 min
expected_output: PR drafted at .planning/analyses/<ISO>-warp-upstream-watch.md
review: operator reviews PR; merges OR rejects within 1 week
disable: pause/delete the Oz schedule via Warp Oz UI
cost_warning: 1 credit per run; ~52 credits/year
```

### SA-02: Weekly SGSD Docs Drift Audit (CS-01)

```
schedule: "0 10 * * 1"        # Monday 10:00 UTC (after SA-01)
audit: CS-01 (docs drift audit)
expected_runtime: < 5 min
expected_output: PR at .planning/analyses/<ISO>-docs-drift-report.md
review: operator merges if drift is real; rejects if false-positive
disable: pause/delete via Warp Oz UI
cost_warning: 1 credit per run; ~52 credits/year
```

### SA-03: Nightly Clean-Install Self-Test (CS-03)

```
schedule: "0 2 * * *"          # Daily 02:00 UTC
audit: CS-03 (clean-install audit in Linux container)
expected_runtime: < 10 min (container cold-start + install)
expected_output: PR at .planning/analyses/<ISO>-cross-platform-install-report.md
review: operator merges if cross-platform issues surface; rejects if expected
disable: pause/delete via Warp Oz UI
cost_warning: 1 credit per run; ~365 credits/year (highest cost; consider every-other-day if budget tight)
```

### SA-04: Monthly Warp Open-Source Roadmap Watch (CS-02 deeper)

```
schedule: "0 8 1 * *"          # 1st of month 08:00 UTC
audit: CS-02 (deeper scan with multiple Warp issues + ACP/CLI/tmux/wrapper-detection threads)
expected_runtime: < 15 min
expected_output: PR at .planning/analyses/<ISO>-warp-roadmap-deep-watch.md
review: feeds into Phase 96 upstream issue/spec pack candidates
disable: pause/delete via Warp Oz UI
cost_warning: 1 credit per run; ~12 credits/year
```

### SA-05 (optional): Weekly Repo Health Audit (CS-05)

```
schedule: "0 11 * * 1"         # Monday 11:00 UTC (after SA-01/SA-02)
audit: CS-05 (repo health: missing artifacts / broken cross-refs / linkrot)
expected_runtime: < 3 min
expected_output: PR at .planning/analyses/<ISO>-repo-health-audit.md
review: usually merges (auto-fixes via PR); rejects if scope drift
disable: pause/delete via Warp Oz UI
cost_warning: 1 credit per run; ~52 credits/year
```

## NOT Scheduled (operator-led only)

Per Phase 91 CU-01..CU-06 + Phase 90 controlled-action exclusion:

- Local SGSD auto-mode runs (CU-04)
- Controlled actions (CU-05; Phase 90 server)
- VTP enrichment (CU-01)
- Redis live cockpit (CU-02)
- Windows boot validation (CU-03)
- STATE.md mutations (CU-06)

These NEVER appear on a Warp Oz schedule.

## Cost Aggregate (if all 5 SA-* schedules enabled)

| Schedule | Frequency | Credits/year |
|---|---|--:|
| SA-01 | weekly | 52 |
| SA-02 | weekly | 52 |
| SA-03 | nightly | 365 |
| SA-04 | monthly | 12 |
| SA-05 | weekly | 52 |
| **Total** | | **533** |

Operator may pick any subset. Recommended starter: SA-01 + SA-02 (~104/year low-cost smoke).

## Schedule Prompt Template

Each schedule's Warp Oz job prompt (operator pastes into Warp Oz scheduler):

```text
Run the {audit-id} audit per super-gsd/docs/SGSD-CLOUD-SAFE-SKILLS.md
{cs-class} contract.

1. Clone the GSDedits repo to /workspace/GSDedits.
2. Run: cd /workspace/GSDedits; npm install --omit=dev.
3. Run the audit script per the cloud-safe skills doc.
4. Open a PR with the audit report at the path specified.
5. Tag the PR with `cloud-audit:{audit-id}`.
6. Exit 0 on success; exit 1 on audit failure (still opens PR with failure context).

Reference: super-gsd/docs/SGSD-OZ-ENVIRONMENT-SPEC.md (Phase 92 environment shape).
Reference: super-gsd/docs/SGSD-CLOUD-SAFE-SKILLS.md (Phase 91 cloud-safe taxonomy).

Forbidden:
- Do NOT mutate STATE.md or .planning/metrics/* (operator-owned).
- Do NOT call any controlled-action MCP tool (Phase 90; cloud has no operator approval).
- Do NOT include API keys (env vars audited).
```

## Disable / Stop Instructions

For each scheduled job:

1. Open Warp Oz UI.
2. Find the scheduled job by name (e.g., "SA-01 SGSD Weekly Warp Roadmap Scan").
3. Click pause (preserves config) OR delete (removes entirely).
4. Confirm via dry-run: trigger manually once, verify expected exit + PR shape.

If a schedule starts producing FALSE POSITIVES:
1. Pause it immediately.
2. File a CRIT-BACKLOG row tagging the audit-id.
3. Address in a follow-up phase OR delete the schedule.

## Forward References

- Phase 96 — Upstream Issue/Spec Pack consumes SA-01 + SA-04 outputs.
- Phase 97 — Release gate verifies cloud-safe inventory + scheduled audit catalog.

## Hard Boundary (carries from Phase 91)

When in doubt, do NOT schedule. Default to operator-led local audit.
Cloud schedules are convenience; never necessity. Disabling all 5
SA-* leaves SGSD fully functional locally.
