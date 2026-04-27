# Phase 35 ATC Review

## Reviewers
- Provider: claude-sonnet-reviewer (sgsd-code-reviewer)
- Provider: codex-cli-reviewer (gpt-5.5, xhigh) -- see `35-codex-review.md`
- Tier: phase-level (dual-provider per v1.7 readiness GO)
- Final verdict: pass (post-fix)

## Aggregate verdicts

| Provider | Pre-fix | CRIT | WARN | Anti-slop pre | Post-fix |
|----------|---------|------|------|---------------|----------|
| Claude   | warn    | 0    | 5    | 8/10          | pass     |
| Codex    | warn    | 0    | 2    | 9/10          | pass     |

## Findings (deduplicated; 7 distinct)

### CRIT (0)

None.

### WARN (5 fixed in-loop, 1 informational, 1 out-of-scope)

**W1 [Claude] -- _extractBanner returns "!/usr/bin/env node" for .js shebang files**
- File: `super-gsd/tools/system-map/generate.cjs:178-205` (pre-fix)
- Form-A regex `/^(?:#!.*\r?\n)?(?:'use strict';\r?\n)?((?:\s*(?:#|\/\/)[^\r\n]*\r?\n)+)/`
  used optional shebang strip. When the .js file had `/* eslint-disable */`
  before the comment block, the inner pattern (only matches `#` or `//`
  comments, not `/*`) failed -- regex backtracked, treating the shebang
  as a `#`-comment line. The body processor stripped the `#`+optional space
  prefix, leaving `!/usr/bin/env node`.
- Fix: pre-strip shebang line explicitly (non-optional when present);
  separately skip an optional `/* ... */` block (e.g.
  `/* eslint-disable */`); then run comment-block regex on the cleaned src.
- Verified: `_extractBanner(sgsd-ctx.js source)` now returns the real
  banner: "sgsd-ctx -- report current Claude Code session context usage as JSON".

**W2 [Claude] -- 3 scripts emit '?????...?' as purpose string**
- Files: `sgsd-agent-dashboard.sh`, `sgsd-headless.sh`, `sgsd-headless.ps1`
  used U+2501 BOX DRAWINGS HEAVY HORIZONTAL `━` as banner rule lines. Pre-fix,
  the rule-line filter `/^[=\-_]{3,}$/` only matched ASCII separators, so
  the box-drawing rule passed as banner content; `_asciiFold` then mapped
  each `━` to `?`.
- Fix: extended `_ASCII_FOLD` table to map U+2500..U+2593 (box drawings +
  block elements) to ASCII equivalents (`-`, `|`, `+`, `#`, `.`, `:`).
  Extended rule-line filter regex to also match runs of box-drawing chars.
- Verified: post-fix grep for `?????` in SYSTEM-MAP.json returns 0 matches.

**W3 [Claude] -- _scalarFromYaml regex escape gap**
- File: `super-gsd/tools/system-map/generate.cjs:336` (pre-fix)
- Pre-fix escape pattern `[.*+?^${}()|[\\]\\\\]` had `[` inside a character
  class without proper escaping (the inner `[` was unescaped). Latent
  breakage if any future key contained `[`.
- Fix: rewrote escape pattern to `[.*+?^${}()|[\]\\]` with proper meta-char
  escape set. Inline comment naming the latent breakage.

**W4 [Claude] -- 933 LOC vs 650 estimate (43% overshoot)**
- INFORMATIONAL only. No functional impact. The growth was driven by:
  - 16 -> 18 self-test assertions (post-Codex W2 fix added 2 regression assertions)
  - _safeLoadYaml + _scalarFromYaml fallback for handover-contract-v2.yaml
    strict-YAML failure (executor deviation, justified)
  - _asciiFold growth for box-drawing chars (Claude W2 fix)
- NO FIX -- v1.8 plan-discipline candidate to improve LOC estimation accuracy.

**W5 [Claude] -- phase-level-ATC gate has repair_command:null in registry**
- File: `super-gsd/registry/gates.yaml` (Phase 33 registry, NOT Phase 35 generator)
- The generator faithfully reflects the registry state. The registry data
  itself has only 2 gates carrying repair_command (per Phase 33 A2 demotion);
  phase-level-ATC isn't one of them.
- OUT OF SCOPE -- registry data gap, not generator bug. Phase 33 A2
  demotion was correct (the underlying scripts didn't have --self-test/
  --dry-run flags). NO FIX.

**W1 [Codex] -- public/operator failure handling could leak throws**
- File: `super-gsd/tools/system-map/generate.cjs:953-975` (pre-fix CLI dispatch)
- modeGenerate/modeCheck wrapped compose() internally. selfTest didn't.
  Top-level CLI dispatch had no try/catch boundary -- any future internal
  throw from compose / render / read* helpers would surface as an
  unhandled rejection.
- Fix: wrapped CLI dispatch in top-level try/catch with operator-friendly
  error message + SGSD_DEBUG=1 opt-in stack trace + exit code 4 for
  operator-boundary failure.

**W2 [Codex] -- banner fixes lack regression self-tests**
- File: same generate.cjs `selfTest()` function
- Claude W1+W2 fixes (banner false-positive + box-drawing rule filter)
  shipped with no explicit regression assertions. A future refactor could
  silently regress them.
- Fix: added assertions 16 + 17:
  - 16: shebang + /* block + comment line yields the real comment line
    (NOT "!/usr/bin/env node")
  - 17: shebang + box-drawing rule + real banner + box-drawing rule yields
    the real banner (NOT a fold-of-rule-chars)
- Self-test count: 16 -> 18.

### NIT (0)

None.

## ATC checklist (post-fix)

### 7-Step LITE/FULL (code phase)

| Step | Verdict | Notes |
|------|---------|-------|
| 1 First Principles | PASS | Final v1.7 phase ships a deterministic catalog generator superseding 3 stale ARCHITECTURE.md sections; minimal new surface; vendored js-yaml only. |
| 2 Delete | PASS | Single-file architecture; 12 known dead-ends fenced; no bloat. |
| 3 Simplify | PASS | All 5 fix-loop findings net-reduce complexity (banner extractor more correct, vocab fold more complete, regex escape correct, operator boundary tightened, regression assertions added). |
| 4 Validate | PASS | self-test 18/18 PASS; --generate produces both artifacts; --check clean on freshly-generated; MAP-01..04 all verified; status-consistency milestone v1.7: OK. |
| 5 Anti-slop | 9.5/10 (combined) | Both providers' findings closed in-loop except 1 informational (LOC overshoot, no fix needed) and 1 out-of-scope (registry data gap). |

**Combined anti-slop score (post-fix): ~9.5/10.**

## Codex provider health (run-time evidence)

- `provider-health/check.cjs --provider codex --behavioral` -> AVAILABLE.
- 1 invocation; success at 600s budget.
- exit 0, duration 521190ms (~8.7 min), report_bytes 274, JSONL row at
  `2026-04-27T11:03:28Z`.
- NO "Codex unavailable" backlog row required.

## Status-consistency check (gate)

```
node super-gsd/tools/status-consistency/check.cjs --milestone v1.7
-> status-consistency milestone v1.7: OK
```

## Final verdict

**PASS** (post-fix). 0 unresolved CRIT, 0 unresolved WARN. 1
informational (LOC overshoot) + 1 out-of-scope (registry data gap)
documented but require no Phase 35 action.

**v1.7 milestone status: ALL 5 PHASES COMPLETE PASS.** Ready for
`sgsd-complete-milestone v1.7`.

## One-liner

Phase 35 generated system map shipped: deterministic catalog generator
emitting .planning/SYSTEM-MAP.{json,md} from 6 registries + 21 SKILL.md
frontmatter + 40 scripts + 21 libs; dual-provider review surfaced 0 CRIT
+ 7 distinct WARNs (5 Claude + 2 Codex); 5 fixed in-loop, 1 informational,
1 out-of-scope; self-test grew 16->18 with banner regression assertions;
combined anti-slop ~9.5/10. v1.7 milestone now ready for close.
