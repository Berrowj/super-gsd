---
agent: sgsd-exec-config
category: C
model_default: sonnet
handover_contract: v2
created: 2026-04-21
version: 2.0
research_principles:
  - AGP-P-03
  - AGP-P-04
  - HCC-P-02
  - ISO-P-08
  - LLMS-P-05
  - ASS-P-07
---

# Expertise — sgsd-exec-config

*Config is state at a distance. Bad Dockerfile breaks everyone's local; bad CI breaks every PR. Idempotence + revert-safety + env-parity are non-negotiable.*

## Seeded Methods

- **Idempotent apply** — running the configuration twice produces the same state as running once. Declarative tools (Terraform, Helm, Ansible) have this built in; imperative scripts must enforce it manually.
- **Staged rollout** — dev → staging → prod, with verification between each stage. Never apply to prod from a PR that hasn't run through earlier envs. ASS-P-07 retain-then-escalate maps directly.
- **Explicit rollback command** — every config change ships with the exact command(s) to revert, beyond just `git revert` (because git revert doesn't undo state changes in external systems).
- **Env-parity checks** — same application behavior across dev, staging, prod by construction. Environment variables listed in a canonical location; secrets are env-managed not hardcoded; image tags pinned not :latest.
- **Characterize current state before changing** — `docker ps`, `kubectl get`, `terraform state list`, `gh api` — capture what's actually running before editing config that describes it. AGP-P-03 auditable lineage.
- **Secret hygiene** — secrets never in committed files, never in logs, never echo'd in CI. Use the platform's secret mechanism (GitHub Secrets, AWS Secrets Manager, Kubernetes Secrets) referenced by name.

## Failure Modes

- **Env-divergent behavior** — dev passes, prod fails. Root causes: pinned versions differ, env vars differ, volume mounts differ. ISO-P-08: test across diverse envs.
- **State-destroying rollback** — a rollback that deletes data (DB migration down, volume wipe). Rule: rollback ships with data-preservation strategy OR is explicitly flagged as data-loss-possible BLOCKER.
- **Hidden dependency chain** — editing workflow A breaks workflow B that shared a step. Mitigation: read adjacent configs before editing.
- **Silent-default activation** — adding a section without realizing the tool treats missing section as "apply default", which is non-trivially different. Test empty-section configs explicitly.
- **CI drift from local** — CI installs differently than local dev; what works locally fails in CI. Rule: local dev uses the same Dockerfile as CI uses for the build step.
- **Secret leakage** — echoing an env var containing a secret in a shell step; logging ingress IP addresses; storing AWS keys in state files. Absolute zero tolerance.

## Output Quality Bar

- **Completeness:** changes applied AND rollback tested AND env-matrix verified
- **Accuracy:** `idempotence_verified` = applied twice, output identical (second run is a no-op)
- **Surgical-ness:** only files in scope; no opportunistic "modernize to newer tool version"; no unused env vars introduced
- **Auditability:** every change has a commit message describing what, why, and rollback command
- **Evidence:** `env_matrix_results` shows verification in each target env (dev/staging/prod as applicable)
- **Confidence calibration:**
  - 5 = applied successfully in all target envs; rollback tested; idempotent
  - 4 = applied in all envs; rollback documented but not tested
  - 3 = applied in dev only; prod rollout pending operator
  - 2 = config written but verification incomplete
  - 1 = config written but failed to apply cleanly — BLOCKER

## Known Pitfalls

- **DO NOT** commit secrets or credentials, even "for the moment" or "just for the PR".
- **DO NOT** use `:latest` image tags in production configs; pin to specific versions.
- **DO NOT** introduce a new environment or region as part of another task — that's a separate scope.
- **DO NOT** remove "unused" config blocks without confirming nothing reads them (some consumers are silent).
- **DO NOT** bypass CI on the PR that modifies the CI config itself; changes must be verifiable.
- **DO NOT** add retry/timeout/health-check logic beyond what the task requires — infrastructure concerns have their own task type.
- **DO NOT** trust training-data defaults on tool versions (Docker syntax evolves, GitHub Actions deprecate features). Read the tool's current docs.

## Reference Patterns

- **Pattern: parameterized env per stage**
  - Approach: single config template + per-env values file(s); CI chooses the values file based on branch/env
  - Failure mode: env value drift (one env's values updated, others forgotten)
  - Rule: env values files live together; diff them at PR time

- **Pattern: staged rollout with health-gate**
  - Approach: deploy to dev → health-check → deploy to staging → health-check → deploy to prod
  - Failure mode: health-check too shallow; deploy proceeds despite broken app
  - Rule: health-check must test the thing this deploy changed, not just "200 OK on /"

- **Pattern: matrix CI**
  - Approach: run the test suite on every combination of (OS, version, lang-version) that's supported
  - Failure mode: matrix explosion; slow pipeline
  - Rule: matrix covers the support matrix + one "latest" speculative axis; nothing else

- **Pattern: Dockerfile with build + runtime stages**
  - Approach: multi-stage build; builder stage has compile tools; runtime stage has only runtime deps
  - Failure mode: leaking build artifacts into runtime image (bloat + attack surface)
  - Rule: runtime image ≤ 200MB for typical app; verify with `docker images`

## Handover Specifics

- **Routes to** `sgsd-verifier` at phase close — verifier confirms config actually produces intended state
- **May trigger** Step 6.6 frontend browser-verify if the config change affects the dev server (port change, env var change)
- **Does NOT** typically trigger per-dispatch ATC — config files are not "code" in the ATC sense; but structural review still applies
- **Feeds** `.planning/memory/reference/` with env/infra references via sgsd-curate
- **Blocks** on secret-rotation needs, state-destroying rollbacks, or untestable changes

## Research Citations

- **AGP-P-03** — closed-loop improvement with auditable lineage. Every config change has a trail: git commit + deploy record + rollback plan. Essential for ops forensics.
- **AGP-P-04** — versioning and rollback. Every change is a revertable step; state is preserved through version transitions.
- **HCC-P-02** — lifecycle events over metrics. Deploy/rollback are named events; not "when the Docker image changed" (metric).
- **ISO-P-08** — benchmark diversity prevents false confidence. Config tested in dev only = false confidence for prod.
- **LLMS-P-05** — implementation drift under execution pressure. Config drift is silent and expensive; surgical constraint is strict.
- **ASS-P-07** — retain-then-escalate. Small config change in dev first; escalate to prod only when verified.

## Revision Log

- 2026-04-21 — v2.0 created.
