---
milestone: v4.0-install-contract
status: SEEDED
seeded: 2026-08-25
core_value: An SGSD install either lands completely in the target repository or refuses and says exactly what is missing.
---

# v4.0 Install Contract

## Why this exists

The operator's report, 2026-08-24, in their words:

> "I've used the SGSD forward slash update command and then it just fails and nothing
> that we've done inside this repository is actually being pushed and working inside the
> places and other repos that I need them to. The same goes for the localhost 7777 and
> also the multi-SGSD fleet controller because none of that is working either. They're
> all miles stale, even though the cache is sitting at 19 seconds."

This is the fifth cycle of substantial SGSD work that did not reach the repositories it
was built for. The work is not the problem. The delivery is.

## The core invariant

An install either lands completely or refuses with the exact list of what is missing.
There is no third outcome. Today there is: a partial install that reports success.

## What the evidence already shows

`super-gsd/config/hook-manifest.json` has 22 entries and **zero** of them declare module
dependencies. Five hooks need sibling modules that the manifest never mentions:

| Hook | Requires |
| --- | --- |
| `sgsd-intent-classifier.cjs` | `sgsd-state.cjs`, `gate-evidence-log.cjs`, `skill-routing-registry.cjs`, `vtp-readiness/registry.cjs`, `demand-baseline-ledger.cjs` |
| `sgsd-commit-gate.cjs` | `sgsd-state.cjs`, `sgsd-artifact-conventions.cjs`, `commit-gate-shadow-log.cjs`, `commit-gate-shadow-report.cjs` |
| `sgsd-quality-gate.js` | `sgsd-state.cjs`, `gate-evidence-log.cjs`, and the `sgsd-intent-classifier.cjs` hook itself |
| `sgsd-session-start.js` | `sgsd-state.cjs`, `gate-evidence-log.cjs` |
| `sgsd-substrate-invocation-witness.cjs` | resolves the composer and witness store from the project root at runtime |

A hook file can therefore be copied, registered in `settings.json`, and reported as
installed, while the modules it requires never travelled. It then fails at first fire,
in the target repository, long after the installer said success. This is the same class
as the devcp `UserPromptSubmit` `loader:1479` failure already diagnosed: module
resolution, not hook logic.

P167 closed the mutate-then-refuse hole for one path and proved five installer guard
cases had been red since P161 with nothing running them. The install surface is
under-tested relative to how much depends on it.

## What v4.0 must deliver

1. A declared install manifest that names every artifact an install must place: hooks,
   their transitive module dependencies, settings registrations, skills, agents,
   commands, and the paths each goes to for each surface (`~/.claude`, project
   `.claude`, project `.mcp.json`, Codex entries).
2. Propagation that honours the manifest and cannot report success on a partial result.
3. A smoke test that executes every installed hook in the target repository and fails
   the install if any cannot load its dependencies.
4. A staleness check that tells the operator, in one command, whether a given repository
   is running current SGSD and names precisely what is behind.

## Out of scope

Rewriting the hooks themselves. Changing what any hook does. This milestone is about
delivery, not behaviour.

## Open questions for research

- Why does `/sgsd-update` report failure? Reproduce it against a real second repository
  before designing anything.
- Is the canonical `GSDedits` master still behind this branch, and does that alone
  explain "nothing we do here reaches other repos"?
- The fleet cockpit is per-repository, so each repository needs its own instance. Is the
  operator's expectation of one controller across repositories a missing feature or a
  misconfiguration?
- Localhost 7777 collides with the VTP cockpit-sidecar. The default port decision is
  still open with the operator.
