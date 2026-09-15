# 173-01 prerequisite repair plan amendment

Owner: `pm-automation.harness.20260915`
Candidate bindings preserved before this amendment: HEAD
`3718b109cee8d4604b8602aa6a2b9e84e226c1f3`; candidate `rpc.cjs`
`032ffd8828a8a8a63e58db1a36636ae8f18088e95b2e4ac8cfce5c460f9545fe`;
candidate `rpc.test.cjs`
`a6326111742bfe0c91ba3e9906dc2a9ecde820bd14d69f066e831deefe455a52`;
installed RPC `de2bff6323cbcac43b041a08c4564c719232a231c7df55e3cdde2ba8b1b763b4`.

## Baseline, history, and hypothesis

The isolated install suite currently fails 0/2 before exercising the framing
candidate:

1. `install.test.cjs:66` expects 30 YAML routes while the strict runtime
   loader reports 31.
2. Its fresh-source fake npm attempts to copy an untracked,
   absent `node_modules/.package-lock.json`, so bootstrap stops after invoking
   the expected `npm ci --ignore-scripts --no-audit --no-fund` command.

The 31-route value is historical, not inferred from the failing result.
Commit `b4653c58dcac38d2135df78dd445dd86809757a2` (2026-09-14,
`feat(skills): add /think`) added one valid canonical prompt-time `think`
route to the prior 30-route YAML registry. Commit
`b1dc0cc96bae636b9a84f7b0a47af8e4a9621937` repaired and repositioned that
route's regexes without adding/removing a route. Current strict loader output
is `{ routes: 31, source: "yaml" }`.

The tracked canonical `tools/plan-schema/package.json` and lockfile v3 agree
on exactly six direct dependencies: `ajv`, `ajv-errors`, `ajv-formats`,
`gray-matter`, `js-yaml`, and `jsdom`. A node-internal hidden lockfile is not
a tracked input and is absent. The fake npm fixture must instead validate the
fresh copied canonical manifest/lock relationship and its finite seeded
dependency subset against lock entries before copying fixture packages.

Falsifiers that block source mutation or commit:

- history shows the 31st route was invalid, removed, or never loaded from YAML;
- current strict loader does not produce exactly 31 routes and one canonical
  prompt-time `think` route;
- manifest root dependencies do not exactly equal lock root dependencies, the
  lock is not v3, or a finite seeded package lacks a matching lock entry/version;
- the changed install suite drops a real bootstrap, closure, source-isolation,
  failure-atomicity, or installed-runtime assertion.

## Bounded implementation

Only `super-gsd/tests/codex-worker/install.test.cjs` changes beyond existing
Phase 173 evidence. Keep the existing isolated real install, fixture npm call,
installed closure byte comparisons, fresh-source isolation, failure path, and
no-prepublish assertion.

1. Strengthen the pre-install registry probe to assert the literal historical
   contract `{ routes: 31, source: "yaml", prompt_time_think_routes: 1 }`.
   Update the same suite's post-install strict YAML and compiled-fallback route
   counts from 30 to the historically verified 31, and its prompt-adapted count
   from 16 to 17. This remains non-tautological: no expected value is derived
   from the live route count; all values witness the added `think` route through
   source, installed, adapted, and fallback paths.
2. In the fake npm executable, read `package.json` and `package-lock.json`
   from its fresh working directory; require lockfile v3 and exact root
   dependency equality. For the finite existing seed list needed by the
   isolated fixture, require a lock package entry and a source fixture package
   version matching the canonical lock before copying it. Remove the reference
   to absent `node_modules/.package-lock.json`; do not create a replacement.
3. Pass no new package manager settings, install no shared dependencies, and
   preserve fake `npm ci` argument/cwd/global-prepublication capture.

## Regression matrix and boundaries

Run `install.test.cjs`; registry loader/self-test; plan-schema validation;
profile resolver; launch; RPC; worker; fake wrapper self-test; syntax; and
`git diff --check`. The test must prove the canonical manifest/lock input and
both success/failure bootstrap paths. It must not read credentials, use a
network/package install, modify registry/manifests/node_modules/install scripts
or wrapper/config/model routing, or persist dependency payloads in evidence.

## Review, rollback, and non-goals

Before source mutation, exactly one Terra/xhigh independent plan check must
first dry-run and prove the worktree `rpc.cjs` candidate (not installed RPC)
is the review transport. A nonzero, malformed, infrastructure, or finding
result stops this attempt with no repeat. After green local evidence, exactly
one Spec and one ATC review follow sequentially under the same rules.

Rollback is a single candidate commit revert followed by Root's normal checked
update; Root alone backs up and installs `/opt/clarity`. Non-goals: changing
route policy/count, repairing package manifests/locks or dependencies,
changing bootstrap/install behavior, altering RPC behavior, pushing, deploying,
or bypassing a gate.
