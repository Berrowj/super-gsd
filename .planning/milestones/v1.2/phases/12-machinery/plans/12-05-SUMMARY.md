---
phase: 12-machinery
plan: "05"
subsystem: erg-warnings
tags: [erg, atc, bug-fix, jsdoc, filter]
dependency_graph:
  requires: []
  provides: [ERG-01]
  affects:
    - super-gsd/scripts/lib/edge-guard.cjs
    - super-gsd/scripts/lib/gates-registry.cjs
    - super-gsd/skills/sgsd-orchestrate/SKILL.md
tech_stack:
  added: []
  patterns:
    - string-prefix error discriminator in catch blocks
    - PROCESS SINGLETON JSDoc pattern for module-level caches
    - anchored regex filter for SKILL.md files as code
key_files:
  modified:
    - super-gsd/scripts/lib/edge-guard.cjs
    - super-gsd/scripts/lib/gates-registry.cjs
    - super-gsd/skills/sgsd-orchestrate/SKILL.md
  created:
    - .planning/phases/12-machinery/plans/12-05-SUMMARY.md
decisions:
  - "WR-01: string-prefix discriminator chosen over GateNotFoundError class (research Q5: low-value high-churn refactor avoided)"
  - "WR-02: JSDoc-only fix — zero runtime impact, PROCESS SINGLETON phrase is the measurable-green marker"
  - "WR-03: anchored regex ^super-gsd/skills/[^/]+/SKILL\\.md$ over substring match to avoid false-positives on other .md files in skill subtree"
metrics:
  duration: "< 10 minutes"
  completed: "2026-04-22"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
  files_created: 1
---

# Phase 12 Plan 05: ERG-01 Phase 10 ATC Warnings (WR-01/02/03) Summary

**One-liner:** Three surgical fixes closing Phase 10 ATC warnings — narrow catch discriminator, singleton JSDoc, and SKILL.md skill-file filter.

## ERG-01 Fixes

### WR-01 — edge-guard.cjs broad catch narrowed (D-16)

**File:** `super-gsd/scripts/lib/edge-guard.cjs` (line 83)

**Before:**
```javascript
} catch (_) {
  // gate not found or registry error — fall back to log-only (defensive)
}
```

**After:**
```javascript
} catch (err) {
  // Narrow: only swallow "gate name not in registry" — rethrow registry errors
  if (!err.message.startsWith("gate '")) throw err;
  // gate not found → fall back to log-only (registry may not have this name)
}
```

**Commit:** `5bbbda1`

ENOENT and YAML parse errors now surface instead of being silently swallowed. The string-prefix `"gate '"` matches exactly the throw message at `gates-registry.cjs:62`.

---

### WR-02 — gates-registry.cjs PROCESS SINGLETON JSDoc (D-17)

**File:** `super-gsd/scripts/lib/gates-registry.cjs` (above line 23)

**Before:** `let _cache = null; // { all: Gate[], byName: Record<string,Gate> }`

**After:** JSDoc block inserted directly above the declaration:
```javascript
/**
 * WARNING — module-level cache is a PROCESS SINGLETON.
 * Tests MUST call resetCache() in afterEach() to avoid pollution.
 * Long-running processes that hot-swap gates.yaml MUST call resetCache()
 * after the file mtime changes (or after a SIGHUP equivalent).
 */
let _cache = null; // { all: Gate[], byName: Record<string,Gate> }
```

**Commit:** `177d114`

Zero runtime impact. `PROCESS SINGLETON` phrase is the measurable-green marker for Phase 12 verify.mjs invariant 10.

---

### WR-03 — SKILL.md code_files_changed_count filter extended (D-18)

**File:** `super-gsd/skills/sgsd-orchestrate/SKILL.md` (Step 9.2, lines 744-749)

**Before:**
```javascript
code_files_changed_count: filesChanged.filter(f =>
  !f.endsWith('.md') && !f.startsWith('.planning/')
).length,
```

**After:**
```javascript
code_files_changed_count: filesChanged.filter(f => {
  if (f.startsWith('.planning/')) return false;
  if (/^super-gsd\/skills\/[^/]+\/SKILL\.md$/.test(f)) return true;
  if (f.endsWith('.md')) return false;
  return true;
}).length,
```

**Commit:** `bb4269b`

Anchored regex pins to exactly the skill-file pattern (one directory deep, exactly `SKILL.md`). Other `.md` files (READMEs, plan summaries) remain excluded. SKILL.md-only commits now correctly trigger per-dispatch ATC.

---

## Artifacts

| File | Status | Provides |
|------|--------|---------|
| `super-gsd/scripts/lib/edge-guard.cjs` | modified | WR-01 fix — narrow catch with string-prefix discriminator |
| `super-gsd/scripts/lib/gates-registry.cjs` | modified | WR-02 fix — PROCESS SINGLETON JSDoc above `_cache` |
| `super-gsd/skills/sgsd-orchestrate/SKILL.md` | modified | WR-03 fix — skill-SKILL.md files count as code |
| `.planning/phases/12-machinery/plans/12-05-SUMMARY.md` | created | Plan close record |

## Commit SHAs

| Task | Commit | Description |
|------|--------|-------------|
| 12-05-01 | `5bbbda1` | WR-01 narrow edge-guard catch |
| 12-05-02 | `177d114` | WR-02 PROCESS SINGLETON JSDoc |
| 12-05-03 | `bb4269b` | WR-03 SKILL.md filter |

## Wave 1 Peers

This plan (12-05) executed as part of Wave 1 of Phase 12, parallel with:
- **Plan 12-01** — edited SKILL.md Step 2 section (disjoint from Step 9.2 touched here)
- **Plan 12-06** — touches no SKILL.md (verified disjoint file sets per 12-RESEARCH.md)

All three Wave 1 plans operate on disjoint file sets; no merge conflicts expected.

## Deviations from Plan

None — plan executed exactly as written. All three fixes match verbatim text from research §Q5/Q6/Q7.

Note: The `catch (_)` pattern at lines 156, 251, 255 of `edge-guard.cjs` were intentionally left unchanged — they are in the self-test function's best-effort cleanup code, not in production logic. WR-01 targeted only the production catch at line 83.

## Self-Check: PASSED

- `super-gsd/scripts/lib/edge-guard.cjs` — modified, `5bbbda1` verified
- `super-gsd/scripts/lib/gates-registry.cjs` — modified, `177d114` verified
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — modified, `bb4269b` verified
- `.planning/phases/12-machinery/plans/12-05-SUMMARY.md` — created (this file)
