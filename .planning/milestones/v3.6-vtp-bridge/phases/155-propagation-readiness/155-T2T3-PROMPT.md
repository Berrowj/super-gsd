# P155-T2-T3 — Atomic installer + dual-root compatibility transition (GATE tier)

You are the implementer for ONE task. Fresh context, this task only. You CANNOT spawn
`claude` (EPERM). Nothing here needs it. Do NOT commit — the orchestrator commits, and
atomicity is enforced at that commit.

## Read first

- Task P155-T2-T3 in `.planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-01-PLAN-LOCKED.md` — your verbatim contract, including falsifier and stop rule.
- The defect sites: `super-gsd/install.sh:572` (`mkdir -p .planning/phases`),
  `super-gsd/scripts/sgsd-conformance-check.sh:61` (hard exit 3 without legacy root),
  `super-gsd/scripts/sgsd-agent-dashboard.sh:208`, `super-gsd/scripts/sgsd-distill-milestone.sh:101`,
  `super-gsd/tools/phase-verifier/phase-verifier.mjs:157` (all single-root),
  `super-gsd/tools/phase-folder-audit/audit.cjs:167` (`/^\d{2}-/` — the integer-only bug, verified),
  `super-gsd/tools/state-resolver/resolve.cjs:329,349,356` (integer model — but see BOUNDARY below).

## Deliverables

1. **`super-gsd/scripts/lib/phase-name.cjs`** — the SOLE parser and discovery boundary.
   - Parses integer `NN`, decimal `NN.N`, and `vNN-NN[.N]` opaque tokens, with and
     without `-<slug>` suffixes. Returns `{token, scheme, slug, dir}` shapes; ordering
     is a stable comparator over schemes, never arithmetic.
   - Discovery scans the active milestone `phases/` dir AND optional flat
     `.planning/phases/`; either missing root is EMPTY, never an error; results
     deduplicated by `fs.realpathSync` canonical keys; deterministic order.
   - Module exports for Node callers + a JSON CLI (`--list`, `--parse <name>`) for the
     shell consumers.
2. **Route every named consumer through it**: `audit.cjs` (replace the `/^\d{2}-/`),
   the four production consumers, and every phase-NAME lookup in `resolve.cjs`. No
   consumer keeps a private phase-name regex. Shell scripts call the JSON CLI.
3. **`install.sh`**: remove ONLY the fresh creation of `.planning/phases` (line ~572).
   Preserve milestone setup and never touch existing trees.
4. **Tests**: `super-gsd/tests/propagation-readiness/assert-install-layout.cjs`
   (--case all: real install.sh into an isolated HOME/project fixture — fresh install
   creates NO legacy root; a project with an existing legacy tree keeps it byte-identical),
   `assert-dual-root-resolvers.cjs` (--tool all --case full-matrix: each of the four
   consumers plus audit.cjs against milestone-root-only, flat-root-only, both-roots,
   neither-root, v/decimal/integer names, realpath duplicates, mutation sentinels
   proving fixtures stay byte-identical), and extend `audit.test.cjs` for the new parser.

## BOUNDARY — do not cross into T4b

T4b (next task) owns the resolver's EVIDENCE-TIER semantics: checkpoint/pulse/activity/
git parsing, confidence, abstention, backwards-re-sync prevention. In THIS task you only
replace resolve.cjs's phase-NAME parsing and folder discovery with phase-name.cjs calls,
preserving its current tier behaviour bit-for-bit where names are integers. If a
v-scheme name now parses where it previously fell through, that is the intended gain;
do not otherwise change tier logic, confidence values, or repair recommendations.

## Hard constraints

- Atomicity: consumer safety and the installer change are ONE change set. Your work is
  reviewed as a single diff; do not stage partial states.
- NEVER read, print or log any settings env block.
- No identity registry, no alias map, no renumbering, no archiving of existing trees.
- Surgical; every changed line traces to this task. Node .cjs + minimal shell edits only.

## Verification to run before reporting (all three must exit 0)

    node super-gsd/tests/propagation-readiness/assert-install-layout.cjs --case all
    node super-gsd/tools/phase-folder-audit/audit.cjs --self-test
    node super-gsd/tests/propagation-readiness/assert-dual-root-resolvers.cjs --tool all --case full-matrix

## Report format, exactly this, max 250 words, no preamble

```
FILES_CHANGED: path (created|modified|deleted)
VERIFICATION: `cmd` exit N pass|fail
DEVIATIONS: [constraint] description | none
BLOCKERS: description | none
ONE_LINER: substantive summary
```
