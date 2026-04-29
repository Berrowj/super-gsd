# SGSD Cloud-Safe Skills (v2.7 Phase 91)

What SGSD-adjacent work can run safely in Warp Oz / cloud environments,
and what cannot. Cloud agents lack local state (no .planning/, no
private VTP, no Redis, no Windows-resident services). v2.7 Phase 91 is
the contract for which SGSD work is cloud-portable.

## Cloud-Safe Tasks (eligible for Oz scheduled / cloud-triggered runs)

### CS-01: Docs Drift Audit

**Purpose**: scan repo docs against current Warp upstream documentation
(public web pages); report drift.

**Inputs**: repo clone (committed state only), public Warp docs URLs.

**Outputs**: `.planning/analyses/<ISO>-docs-drift-report.md` (PR draft).

**Why cloud-safe**: read-only scan; no local state needed; output is a
markdown PR.

### CS-02: Public Repo Issue Scan

**Purpose**: scan https://github.com/warpdotdev/warp issues #7326 (ACP)
+ #9233 (May-Jun roadmap) for Warp-side updates relevant to v2.8 ACP work.

**Inputs**: public GitHub issue URLs (no auth needed).

**Outputs**: `.planning/analyses/<ISO>-warp-upstream-watch.md` (PR draft).

**Why cloud-safe**: pure web fetch; no local state.

### CS-03: Clean-Install Audit (Linux container)

**Purpose**: spin up clean Linux container, clone repo, run installer,
report friction (paths assumed Windows? Missing Linux compat?).

**Inputs**: repo clone + Docker image (`node:20-alpine` or similar).

**Outputs**: `.planning/analyses/<ISO>-cross-platform-install-report.md`.

**Why cloud-safe**: container is ephemeral; no Windows-specific state needed.

### CS-04: Scheduled Public-Doc Refresh PR

**Purpose**: nightly job opens PR refreshing any docs that reference
specific Warp version numbers / external URLs.

**Inputs**: repo clone, current public Warp docs.

**Outputs**: GitHub PR draft (operator reviews before merge).

**Why cloud-safe**: doc-only; PR is reviewable.

### CS-05: Read-Only Repository Health Audit

**Purpose**: scan committed state for missing artifacts / broken
cross-references / linkrot. Phase 83 asset-validator (already shipped)
is a precursor; cloud version runs scheduled.

**Inputs**: repo clone.

**Outputs**: `.planning/analyses/<ISO>-repo-health-audit.md`.

**Why cloud-safe**: read-only; output is markdown.

## UNSAFE for Cloud (must run on operator's local machine only)

### CU-01: Local VTP Enrichment

**Why unsafe**: VTP / private knowledge bank lives on operator's
machine; cloud agent has no access. Phase 48 selective-bridge is
operator-environment-specific.

### CU-02: Local Redis Live Cockpit

**Why unsafe**: Phase 52 Redis adapter uses local docker-compose Redis;
cloud has no Redis instance with operator's working state.

### CU-03: Local Windows Boot Validation

**Why unsafe**: sg / sgsd functions live in Windows PowerShell profile;
cloud Linux container can't invoke them. Phase 67 warp-doctor probes
2-4 (sg/sgsd/sgsd-setup_command_defined_in_profile) require Windows host.

### CU-04: Full SGSD Auto-Mode With Local State

**Why unsafe**: orchestrator needs `.planning/STATE.md` history,
`.planning/metrics/*.jsonl` ledgers, `.planning/ORCHESTRATOR-CHECKPOINT.md`
recovery point. Cloud copy is point-in-time; live state changes can't
sync back without commit-and-push, breaking auto-mode's atomic-commit
guarantee.

### CU-05: Controlled Actions (Phase 90)

**Why unsafe**: Phase 90 controlled-action server requires operator
approval flow. Cloud has no operator presence; default-deny would
trigger every time. Approve-via-chat-API is a v2.7+ extension that
needs separate design (NOT in scope).

### CU-06: STATE.md Mutations

**Why unsafe**: STATE.md is operator-owned; cloud would race against
local edits. Phase 80 warp-plan-converter outputs to .planning/analyses/
which is safe.

## Cloud Skill File Format

Skills under `.agents/skills/<cloud-safe-skill-name>/SKILL.md` follow
the standard Phase 79 frontmatter shape, plus a new field:

```markdown
---
name: sgsd-cloud-docs-drift-audit
description: |
  Scan repo docs against current Warp upstream docs; report drift.
  Cloud-safe; no local state required.
cloud_safe: true
cloud_classification: CS-01
---
```

`cloud_safe: true` plus `cloud_classification` are the operator-facing
markers. `cloud_classification` references the catalog above.

Phase 91 enumerates the 5 cloud-safe categories; future phases ship the
actual skill files when the operator opts into cloud automation.

## Decision Matrix

| Task | Local-only? | Cloud-eligible? | Why |
|---|:-:|:-:|---|
| docs drift audit | yes | YES | read-only / markdown output |
| public repo scan | yes | YES | public web fetch |
| clean-install audit | yes | YES | ephemeral container |
| scheduled doc-refresh PR | yes | YES | reviewable PR |
| repo health audit | yes | YES | read-only |
| VTP enrichment | YES | no | local KB |
| Redis live cockpit | YES | no | local Docker |
| Windows boot validation | YES | no | Windows-specific |
| Full auto-mode | YES | no | local state |
| Controlled actions | YES | no | operator approval |
| STATE.md mutations | YES | no | operator-owned |

## Forward references

- Phase 92: Oz environment spec — defines the environment for CS-01..CS-05.
- Phase 93: Scheduled audit design — picks which CS-* run on what cron.
- Phase 96: Warp upstream issue/spec pack — uses CS-02 (public repo scan).
- Phase 97: SGSD release gate — final v2.7 close + verification of cloud skills inventory.

## Hard rule

When in doubt, mark UNSAFE. AGENTS.md hard rule 4 ("preserve sg topology") + hard rule 1 ("read state from .planning/, not scrollback") imply local-only operation by default. Cloud-eligibility requires explicit justification per task.
