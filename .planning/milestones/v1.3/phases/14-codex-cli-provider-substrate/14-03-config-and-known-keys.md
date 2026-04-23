---
plan_id: 14-03
phase: 14
wave: 1
depends_on: []
deliverable: .planning/config.json review_providers block + patch-gsd-tools-known-keys.sh KNOWN_TOP_LEVEL extension
estimate_tokens: ~500
estimate_commits: 2
---

# Plan 14-03: config.json block + gsd-tools known-keys patch

## Scope

Two disjoint-but-coupled edits that land the Phase-14 config surface:

1. Add a top-level `review_providers` block to `.planning/config.json` per D-18,
   matching the shape of the existing `atc:` block (line 69-79). Six keys, all
   scalars, all defaults set to "Phase-14-ships-dark" values
   (`codex_enabled: false`, `default_provider: claude-sonnet-reviewer`).
2. Extend the Phase-12 `patch-gsd-tools-known-keys.sh` script by appending
   `'review_providers'` to its `NEW_KEYS` array (line 87) and the post-verify
   `need` array (line 200), then re-run it on the operator machine. Idempotency
   guards in the script (lines 108-116) handle safe re-runs.

No sibling patch script. No new utility. Per PATTERNS recommendation
(§ `patch-gsd-tools-known-keys.sh` hint) this is the MUDA-waste-avoidance path.

## Tasks

T1. **Edit `.planning/config.json` — add `review_providers` block**
  - Files: `.planning/config.json` (modify)
  - Closest analog: `.planning/config.json:69-79` (`atc:` block)
  - Reuse scripts: none — direct JSON edit
  - Insertion point: **after** the `atc:` block (line 79), **before** the
    `browser_verify:` block. Matches existing config.json ordering convention
    (workflow → safety → hooks → parallelization → routing → efficiency →
    deliberation → git → **atc → review_providers** → browser_verify → overwatcher).
  - Block content per D-18:
    ```json
    "review_providers": {
      "default_provider": "claude-sonnet-reviewer",
      "codex_enabled": false,
      "codex_cli_path": "auto-detect",
      "codex_timeout_seconds": 30,
      "fallback_on_error": true,
      "fallback_max_retries": 1
    }
    ```
  - Verification:
    - `node -e "const c=require('./.planning/config.json'); if (c.review_providers.codex_enabled!==false) process.exit(1); if (c.review_providers.default_provider!=='claude-sonnet-reviewer') process.exit(1); if (c.review_providers.codex_timeout_seconds!==30) process.exit(1);"` exits 0.
    - `python -m json.tool .planning/config.json > /dev/null` exits 0 (JSON validity).
    - `grep -c 'review_providers' .planning/config.json` reports at least 1.

T2. **Extend `patch-gsd-tools-known-keys.sh` + execute on operator machine**
  - Files: `super-gsd/scripts/patch-gsd-tools-known-keys.sh` (modify — 3 lines)
  - Closest analog: *self* — Phase 12 D-13b precedent, script is designed exactly for this re-use
  - Reuse scripts: the script itself (operator re-runs it)
  - Edit sites (exact):
    1. Line 87 (`NEW_KEYS=(...)`) — append `'review_providers'` to the array.
       Current: `NEW_KEYS=(safety model_routing token_efficiency deliberation atc browser_verify overwatcher)`.
       After: `NEW_KEYS=(safety model_routing token_efficiency deliberation atc browser_verify overwatcher review_providers)`.
    2. Line ~157 (error-message key list in the "not-yet-patched" branch) — append `review_providers` to the human-readable list (cosmetic; keeps the operator-visible diag list honest).
    3. Line ~200 (post-patch verification `need` array) — append `'review_providers'` so the post-patch assert confirms **8 keys** present instead of 7.
  - Execution: operator (or orchestrator, with bypassPermissions) runs
    `bash super-gsd/scripts/patch-gsd-tools-known-keys.sh`. Idempotency check
    (lines 108-116) detects the 7 previously-patched keys, skips them, adds
    only `review_providers`. Post-verify block at lines 192-215 confirms 8 keys.
  - Verification:
    - `grep "'review_providers'" super-gsd/scripts/patch-gsd-tools-known-keys.sh` reports at least 2 matches (NEW_KEYS + need arrays).
    - After script execution: `grep -c "'review_providers'" ~/.claude/get-shit-done/bin/lib/core.cjs` reports 1 (the key is now in KNOWN_TOP_LEVEL).
    - Script exits 0 on re-run (idempotent — nothing to add after first patch).
    - **Guard case**: if the script reports exit 2 (`ANCHOR_NOT_FOUND`), upstream gsd-tools has drifted; this is a BLOCKER, not a Phase 14 bug. Surface to operator with the diagnostic line from the script output.

## Acceptance criteria

A1. `.planning/config.json` has a top-level `review_providers` block with all 6 keys from D-18: `default_provider: "claude-sonnet-reviewer"`, `codex_enabled: false`, `codex_cli_path: "auto-detect"`, `codex_timeout_seconds: 30`, `fallback_on_error: true`, `fallback_max_retries: 1`. **(covers D-23 invariant 5 — `codex_enabled === false` is specifically the "ships dark" guarantee)**
A2. `.planning/config.json` is still valid JSON after the edit (JSON.parse succeeds); existing keys are untouched. **(covers D-18a, D-18b, D-18c — all values as specified)**
A3. `patch-gsd-tools-known-keys.sh` has `review_providers` appended to `NEW_KEYS` (line 87) AND to the post-verify `need` array (line ~200). The one-line change is committed separately from the execution result. **(covers D-19)**
A4. After the script runs, `~/.claude/get-shit-done/bin/lib/core.cjs` contains `'review_providers'` in the `KNOWN_TOP_LEVEL` Set. **(covers D-19 — stated effect)**
A5. Script is idempotent: second run exits 0 with no further changes. **(inherits from Phase 12 precedent)**
A6. **No new sibling patch script created** — Phase 14 reuses the existing script per PATTERNS "REUSE existing script — do NOT create a new patch utility" hint. **(MUDA-waste-avoidance)**

## Non-goals

- **No edit to `sgsd-orchestrate/SKILL.md`** — cold-start Step 3.6 read of the new config block is wired by plan 14-02's `loadReviewProvidersConfig()` call, not by a SKILL.md edit (per D-11/D-11a no SKILL.md edits in Phase 14).
- **No runtime mutation path** — config values are read once at cold-start and cached. Any runtime change requires a fresh orchestrator session (D-20).
- **No config-write UX** — operator hand-edits `.planning/config.json` to flip `codex_enabled: true` in Phase 15. No skill, no CLI flag.
- **No per-project override** — `.planning/review-providers.override.yaml` is post-v1.3 per D-24.
- **No sibling script `patch-gsd-tools-known-keys-14.sh`** — explicitly rejected per PATTERNS hint (MUDA waste).

## Evidence lineage

- CONTEXT decisions covered: **D-18, D-18a, D-18b, D-18c, D-19, D-20**
- RESEARCH findings consumed: **§2e (script reuse, anchor-guard, idempotency), §3 R-3 (loader consumer wiring — delegated to 14-02), §5 14-03**
- PATTERNS analogs reused: **.planning/config.json:69-79 (atc: block shape), patch-gsd-tools-known-keys.sh (self — Phase 12 precedent)**
- VTP evidence: BYPASSED (Phase 14 VTP-agnostic per D-11/D-24)
