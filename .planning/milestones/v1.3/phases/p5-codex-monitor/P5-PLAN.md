# P5 Codex Monitor — Plan (Retroactive)

**Milestone:** v1.3
**Filed:** retroactive (planted during Phase 15 close session)
**Commit:** c8b2d25
**Status:** complete

> This is a retroactive plan document. The feature shipped as a single atomic commit
> outside the Phase 15 plan chain. Tasks below represent the logical breakdown as if
> it had been formally planned.

## Tasks

### P5-T1: write_live_state() in codex-exec.sh

**File:** `super-gsd/scripts/codex-exec.sh`

Emit `codex-live.json` at 6 lifecycle states: running, timeout, auth-denied, error, contract-violation, ok. Implementation:

- New `write_live_state(state, detail)` helper using `json_escape()` to produce valid JSON
- `json_escape()` factored out of the existing stderr_preview inline awk and reused across all emission sites
- `PROMPT_BYTES` counter added to capture prompt size in the live state
- Emits to `.planning/metrics/codex-live.json` (path resolved relative to `GSD_PROJ_ROOT`)
- No change to codex invocation itself; existing exit codes (0,1,3,4,5,6) unchanged

**Lines added:** +79

---

### P5-T2: normalizeCommand() in merge-settings.js

**File:** `super-gsd/scripts/merge-settings.js`

New `normalizeCommand(cmd)` helper fed into `isSameEntry()` so hook deduplication survives quote/path/whitespace variance. Prevents duplicate hook registration when the Codex monitor installs its own hooks with slightly different quoting. Narrow change; existing API unchanged.

**Lines added:** +13

---

### P5-T3: sgsd-codex-status.ps1 — shared status reader

**File:** `super-gsd/scripts/lib/sgsd-codex-status.ps1` (new)

Shared `Get-SgsdCodexStatus` PowerShell function reading:
- `super-gsd/config/config.json` (codex_enabled, timeout config)
- `.planning/metrics/codex-live.json` (current lifecycle state)
- `.planning/metrics/codex-log.jsonl` (last N invocations)
- `.planning/metrics/activity-log.jsonl` (activity feed)
- `super-gsd/registry/gates.yaml` (reviewer_provider config)

Consumed by `sgsd-mission-control`, `sgsd-narrative`, and the new `sgsd-codex-monitor`. Centralises state-reading so each consumer does not independently parse these files.

**Lines added:** +308 (new file)

---

### P5-T4: sgsd-codex-monitor.ps1 — heartbeat dashboard

**File:** `super-gsd/scripts/sgsd-codex-monitor.ps1` (new)

PowerShell heartbeat dashboard with configurable poll interval (default 30s). Drives the `codex-live.json` reader via `Get-SgsdCodexStatus`. Displays current Codex lifecycle state, last invocation summary, and recent activity. Standalone runnable without Mission Control.

**Lines added:** +261 (new file)

---

## Verification

```bash
bash -n super-gsd/scripts/codex-exec.sh    # exit 0
node --check super-gsd/scripts/merge-settings.js    # exit 0
# PSParser tokenize both .ps1 files (clean)
```

All 4 validations passed at commit time (documented in c8b2d25 commit message).
