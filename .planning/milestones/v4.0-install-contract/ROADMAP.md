# v4.0-install-contract — Roadmap (seeded 2026-08-25)

Seeded from the operator's 2026-08-24 report that five cycles of SGSD work have not
reached the repositories they were built for. Awaits operator go.

## Phases

| Phase | Slug | Status | Depends on |
|-------|------|--------|------------|
| 168 | install-contract | [x] PASS-WITH-DEFERRED-1 @ 88207e0 | 167 |
| 169 | atomic-install-transaction | [ ] seeded | 168 |

## Success criteria

1. An install either places every artifact the manifest declares, or exits non-zero
   naming each missing artifact. No partial install reports success.
2. Every installed hook loads its dependencies in the target repository, proven by
   executing it there, not by checking that a file exists.
3. One command tells the operator whether a given repository is running current SGSD and
   names exactly what is behind.

## Why 168 is one phase and not three

The manifest, the propagation that honours it, and the smoke test that proves it are one
contract. Splitting them would let the manifest ship without enforcement, which is the
present failure.

## Status after P168

Criteria 1 and 2 MET: the manifest-declared closure is delivered or the install refuses
naming the missing artifact; every installed hook is executed at install time. Criterion 3
MET: the doctor names what a project is behind on, worktrees included. Deferred: a refusal
AFTER publication can leave partial state until P169's transaction lands.
