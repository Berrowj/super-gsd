# v4.2 Agent Harness — Roadmap

The operator ordered this milestone on 2026-09-14 from the SGSD harness build
plan at `.planning/briefs/2026-09-14-harness-programme/2026-09-14-sgsd-harness-build-plan.md`.
Phase numbering continues from v4.1; each S item becomes one phase.

| Phase | Slug | Item | Status | Depends on |
| --- | --- | --- | --- | --- |
| 173 | delivery-evidence | S1 | pending, recommended first | — |
| 174 | falsifiable-gates | S3 | pending | — |
| 175 | deployed-version-proof | S2 | pending | 173; Clarity C7 service and job details |
| 176 | measurable-requirements | S4 | pending | 174 |
| 177 | independent-verification | S5 | pending | 173, 176 |
| 178 | gate-accuracy-and-cost | S6 | pending | 173, 174; coordinate with v4.1 phases 171 and 172 |
| 179 | harness-change-evidence | S7 | pending | 173, 178 |

v4.1 Token Economics Atlas is parked with phase 170 at plan 170-15 and phases
171 and 172 pending. Nothing in this milestone closes or absorbs them. Phase 169
remains parked as before.

## Phase 173: delivery-evidence (S1)

Goal: SGSD waits on the exact owned worker process, detects dead or silent
workers within the configured bound, and keeps process outcome, report
validity, observed delivery and independent verification separate.

Acceptance: isolated tests cover a dead worker with no exit file, an empty or
malformed report, a nonzero exit with useful artifacts, another worker still
alive, legitimate long-running work and a retained continuation. Required
invalid or missing evidence never satisfies completion. The normal caller
consumes the new observation and the wait returns within the configured bound
plus one observation interval.

First targets: `super-gsd/tools/codex-worker/run.cjs`, `control.cjs`,
`worker.test.cjs`; `super-gsd/scripts/codex-executor.sh` only where still used.

## Phase 174: falsifiable-gates (S3)

Goal: a green check means the requirement was exercised. Gate registration
carries the behaviour ruled out, the evidence required and known-good and
known-bad cases.

Acceptance: known-broken and known-good cases produce opposite results through
the production gate caller; missing required coverage cannot turn green; model
approval cannot clear a mechanical failure. Clarity C3 and C5 checks plug in
without moving business expectations into SGSD.

## Phase 175: deployed-version-proof (S2)

Goal: a read-only deployed-state check compares the intended revision with
each required running service, and existing `clarity-cp` job protection covers
every normal deploy entry point.

Acceptance: an old container with a new checkout, an unreachable image
identity and one mismatched service cannot produce a verified deployment. A
disposable registered job blocks a conflicting operation through the real
deploy entry point; an unrelated service is not blocked. `clarity-cp
verify-deployed` is not advertised before it exists.

## Phase 176: measurable-requirements (S4)

Goal: every criterion has an executable observable, protected contracts need a
reviewed amendment, exploratory work carries an experiment card, and
project-owned rules load only for the owning project.

Acceptance: a criterion with no executable observable fails; a protected
change without its amendment fails; a Clarity task receives its relevant
case; a non-Clarity task loads none of the SAP material. Existing valid plans
stay compatible or receive a reviewed migration.

## Phase 177: independent-verification (S5)

Goal: verification is separated from the author's explanation, failures
produce a located diagnosis, and retries are bounded and require a changed
approach.

Acceptance: a confidently incorrect executor report cannot influence a
withheld-report verification run; an unlocated diagnosis is rejected; a
repeated unchanged retry stops at its bound; CoVe does not synthesise missing
live evidence.

## Phase 178: gate-accuracy-and-cost (S6)

Goal: false alarms, missed faults and total cost are measured from existing
gate and review ledgers joined to Atlas run identity, with denominators shown.

Acceptance: a small labelled corpus reproduces both rates exactly; repeated
ingestion does not duplicate spend or outcomes; incomplete capture is shown;
policy stays unchanged until its normal review authorises a change.

## Phase 179: harness-change-evidence (S7)

Goal: improvements that help are kept with their evidence, using the existing
component registry and change manifest.

Acceptance: one harness change is traceable from prediction to invocation to
observed result; protected material cannot enter the editable set; evaluation
failure leaves original evidence intact; a rollback recommendation names the
bounded change only.

## Reuse proof, every phase

Each shared feature runs against Clarity and against a fixture repository with
no SAP, VTP or Clarity installation. Project roots, evidence paths, services
and commands are configured, never hard-coded to devcp or the operator's home
directory. Installation goes through the normal SGSD update path and the
production caller is shown to consume the evidence.
