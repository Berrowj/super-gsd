---
phase: 35
title: Generated System Map
type: code (generator) + 1 docs deprecation edit
created: 2026-04-27
discuss_decisions: [35=B]
unblocks: []
mode: gsd-discuss-phase --auto
---

# Phase 35 - Generated System Map (CONTEXT)

## Goal

Deterministic catalog generator that consumes the SGSD registries
(agents.yaml, gates.yaml, review-providers.yaml, board-members.yaml,
command-envelope-v1.yaml) plus frontmatter from `super-gsd/skills/*/
SKILL.md` and headers from `super-gsd/scripts/*` to produce
`.planning/SYSTEM-MAP.json` (machine-readable) and `SYSTEM-MAP.md`
(rendered). Replaces stale hand-maintained sections in
`super-gsd/docs/ARCHITECTURE.md` (§6 file layout, §7 model routing,
§8 data-flow shortlist) with deprecation notes pointing readers to
the generated artifacts.

## Locked decision (DISCUSS 35=B)

**Registries + frontmatter only** -- NO dependency graph in v1.7.
Phase 35 is a CATALOG generator, not a topology analyzer. The
deferral preserves scope; a graph could be a v1.8+ phase if needed.

## What the planner must produce

ONE plan: `35-01-generated-system-map-PLAN.md` with the following
deliverables:

1. **Generator** at `super-gsd/tools/system-map/generate.cjs`
   (~650 LOC):
   - Header citing RESEARCH §10 + §11
   - Reads (in deterministic order):
     - `super-gsd/registry/agents.yaml`
     - `super-gsd/registry/gates.yaml` (now with repair_instruction +
       2 repair_command from Phase 33)
     - `super-gsd/registry/review-providers.yaml`
     - `super-gsd/registry/board-members.yaml`
     - `super-gsd/registry/command-envelope-v1.yaml` (Phase 31)
     - All `super-gsd/skills/*/SKILL.md` frontmatter (`---...---`)
     - All `super-gsd/scripts/*.{sh,cjs,ps1,js}` headers (top-of-file
       comment block)
   - Emits:
     - `.planning/SYSTEM-MAP.json` (sorted keys, only `generated_at`
       varies)
     - `.planning/SYSTEM-MAP.md` (rendered tables for agents / gates /
       providers / board / contracts / scripts; ASCII-only)
   - Sections in JSON output:
     - `agents` (sorted by name)
     - `gates` (sorted by name; includes repair_instruction +
       repair_command per Phase 33)
     - `providers` (sorted by name)
     - `board_members` (sorted by name)
     - `contracts` (5 levels: handover-contract-v2, code-reviewer-v1,
       review-providers-v1, plan-schema-v2, command-envelope-v1)
     - `ledgers` (canonical JSONL streams: review-ledger,
       route-decisions, crit-backlog, codex-log, etc.)
     - `skills` (sorted by name)
     - `scripts` (sorted by path)
     - `generated_at` (ISO timestamp; the ONLY non-deterministic field)
   - Public exports: `generate(opts)`, `loadInputs(rootDir)`,
     `renderMarkdown(map)`, `stableStringify(value)`
   - All public APIs wrapped in try/catch (mirrors Phase 32-34 locked
     design)
   - Anchors fingerprint guard to `__dirname` (Phase 32 W3 lesson)
   - --self-test mode running 12+ assertions in tmpdir

2. **Output artifacts** (committed to git):
   - `.planning/SYSTEM-MAP.json`
   - `.planning/SYSTEM-MAP.md`

3. **CLI modes** (per RESEARCH §5):
   - `--generate` (default): write SYSTEM-MAP.json + SYSTEM-MAP.md
   - `--check`: read existing maps, regenerate in-memory, compare;
     exit 1 if drift (modulo `generated_at`); supports `--fix` to
     overwrite
   - `--self-test`: run assertions

4. **Deprecation note** in `super-gsd/docs/ARCHITECTURE.md` lines
   198-263 (§6 file layout, §7 model routing, §8 data-flow). Replace
   the hand-maintained tables with a deprecation block citing
   `.planning/SYSTEM-MAP.md` as the canonical source. Preserve other
   sections.

5. **Live-or-local fallback** (Patch 4): `--generate` produces
   identical output on every run modulo `generated_at`; --self-test
   exercises generation against fixture inputs in tmpdir; --check
   drift guard runs deterministically against committed artifacts.

## Acceptance (MAP-01..04, runnable)

- **MAP-01**: `node super-gsd/tools/system-map/generate.cjs --generate`
  reads all 5 registries + skills/* frontmatter + scripts/* headers
  without errors.
- **MAP-02**: After --generate, both `.planning/SYSTEM-MAP.json` and
  `.planning/SYSTEM-MAP.md` exist + parse cleanly (`node -e
  "require('.planning/SYSTEM-MAP.json')"` exits 0;
  `.md` is valid markdown).
- **MAP-03**: Run --generate twice; diff the outputs (modulo
  `generated_at`). Should be byte-identical.
- **MAP-04**: ARCHITECTURE.md §6/§7/§8 contain deprecation note; grep
  for "DEPRECATED -- see .planning/SYSTEM-MAP" returns >=1 hit.

## Open derivation calls

NONE -- all 18 calls locked in 35-RESEARCH.md §11. Notable locks:
- 35=B (registries + frontmatter, no graph) -- LOCKED via mass-discuss
- Output paths: `.planning/SYSTEM-MAP.{json,md}` (NOT `super-gsd/`
  itself, to avoid confusing generator+output co-location)
- Sort order: alphabetical-codepoint comparator (deterministic across
  locales)
- No git-rev embedding (would break determinism)
- Generated artifacts committed to git (operator can diff
  human-edits vs --check output)

## Standard workflow

Phase 35 is code (1 new generator + 1 docs edit + 2 generated artifacts).
Standard workflow runs full:
- Step 1 (pattern-mapper): SKIPPED -- research mapped pattern
  from route-ledger.cjs / repair-command-checker.cjs / review-ledger.cjs
- Step 7 (MUDA): RUNS (~930 LOC threshold met)
- Step 9 (phase-level ATC): RUNS dual-provider per readiness GO

## Status taxonomy at close (anticipated)

PASS expected. All 4 prior v1.7 phases closed PASS with anti-slop
9.5-10/10 across both providers. Phase 35 mirrors the same lib
architecture, so similar quality bar expected.

## Kill / defer conditions

- Defer if --check drift guard turns out to be over-tight (e.g., a
  legitimate manual edit triggers false-positive drift) -- relax to
  warn-only in v1.8+ if observed
- Hard stop if generator emits non-deterministic output -- determinism
  is the load-bearing contract
- Hard stop if MAP-04 deprecation note overwrites load-bearing
  ARCHITECTURE.md content; only the 3 stale catalog sections (§6/§7/
  §8) get replaced

## v1.7 milestone close

After Phase 35 ships, the v1.7 milestone is ready for
`sgsd-complete-milestone`. Total v1.7 deliverables:
- envelope-v1 (Phase 31, 5th contract anchor)
- route-ledger.cjs (Phase 32, codex_route boundary wired)
- repair-command-checker.cjs + 13 repair_instructions + 2 repair_commands
  (Phase 33)
- review-ledger.cjs + canonical aggregation + --kill-check
  (Phase 34, closes v1.5 empty-baseline gap)
- system-map generator + SYSTEM-MAP.{json,md} + ARCHITECTURE.md
  deprecation (Phase 35)

Backlog rolled forward from v1.6: 10 items (all phase_atc carryover).
v1.7 itself adds 0 new debt rows (all CRIT/WARN findings fixed in-loop
across all 5 phases).
