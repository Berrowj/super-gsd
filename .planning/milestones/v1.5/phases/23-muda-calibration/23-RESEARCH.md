---
phase: 23
phase_name: MUDA Calibration
milestone: v1.5
status: research_complete
date: 2026-04-25
mode: implementation
researched_via: fast-track (scope is single config-driven threshold change)
---

# Phase 23 — MUDA Calibration Research

## Standard Stack

- **bash 4+** for the probe script (no new dependency).
- **Node.js** for JSON config reads (already in use throughout sgsd-muda-* scripts).
- No new third-party libraries.

## Architecture Patterns

### Config-driven threshold pattern (existing, follow it)

The codebase already has multiple config-driven thresholds. Reference patterns:

- `super-gsd/scripts/codex-exec.sh:211-232` — Node-eval pattern for reading nested JSON config keys with hardcoded fallbacks. Sanitises numeric values via `${val%%[^0-9]*}` to keep only leading digits.
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — `sgsd-recall-queries` gate firing pattern reads config + falls back to defaults.

**Implementation pattern for MUDAC-02:**

```bash
# In sgsd-muda-probe.sh, after the inventory_count calculation (~line 196):
INVENTORY_WARN_BASE=2
INVENTORY_FAIL_BASE=5
if [[ -f "$ROOT/.planning/config.json" ]] && command -v node >/dev/null 2>&1; then
    cfg_thresholds="$(node -e '
        try {
            const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
            const t = j && j.muda && j.muda.inventory_thresholds;
            if (t) {
                if (Number.isFinite(t.warn_per_milestone)) process.stdout.write("WARN_BASE=" + Math.floor(t.warn_per_milestone) + "\n");
                if (Number.isFinite(t.fail_per_milestone)) process.stdout.write("FAIL_BASE=" + Math.floor(t.fail_per_milestone) + "\n");
            }
        } catch (e) {}
    ' "$ROOT/.planning/config.json" 2>/dev/null || true)"
    while IFS='=' read -r key val; do
        val="${val%%[^0-9]*}"
        case "$key" in
            WARN_BASE) [[ -n "$val" ]] && INVENTORY_WARN_BASE="$val" ;;
            FAIL_BASE) [[ -n "$val" ]] && INVENTORY_FAIL_BASE="$val" ;;
        esac
    done <<< "$cfg_thresholds"
fi

# Count active milestones
milestone_count=0
if [[ -d "$ROOT/.planning/milestones" ]]; then
    milestone_count=$(find "$ROOT/.planning/milestones" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
fi
[[ "$milestone_count" -lt 1 ]] && milestone_count=1  # divide-by-zero guard

inventory_warn_threshold=$((INVENTORY_WARN_BASE * milestone_count))
inventory_fail_threshold=$((INVENTORY_FAIL_BASE * milestone_count))

inventory_verdict="PASS"
[[ "$inventory_count" -gt "$inventory_warn_threshold" ]] && inventory_verdict="WARN"
[[ "$inventory_count" -gt "$inventory_fail_threshold" ]] && inventory_verdict="FAIL"

inventory_threshold_str="warn>${inventory_warn_threshold} fail>${inventory_fail_threshold} calibrated_per_milestone"
```

Then update the JSON emit (line 222) to use `$inventory_threshold_str` instead of hardcoded `"warn>0 fail>5 calibrated"`.

### Audit script pass-through

`sgsd-muda-audit.sh:191` references the same hardcoded string in its DESCRIPTION block. Update to read the threshold string FROM the probe JSON output rather than hardcoding it. Currently:

```bash
inventory: { threshold: "warn>0 fail>5 calibrated", waste_class: "inventory" }
```

Should become:

```bash
inventory: { threshold: <from-probe-JSON.threshold>, waste_class: "inventory" }
```

This keeps the source of truth in one place (the probe).

## Don't Hand-Roll

- Don't roll a YAML/TOML config parser — use Node JSON like every other script.
- Don't add a config validator framework — sanitise via `${val%%[^0-9]*}` like codex-exec.sh.
- Don't add a "milestone counter library" — `find -maxdepth 1 -mindepth 1 -type d | wc -l` is the standard.

## Common Pitfalls

1. **Divide-by-zero** when `.planning/milestones/` is empty (greenfield project). Guard: `[[ "$milestone_count" -lt 1 ]] && milestone_count=1`.
2. **Counting non-milestone dirs** — `find -maxdepth 1 -mindepth 1 -type d` will count any directory. If the user adds non-milestone subdirs to `.planning/milestones/` (rare), they'd inflate the count. Acceptable risk per "v1.5 is a stabilisation milestone" posture.
3. **Threshold string drift** between probe and audit — addressed by the pass-through pattern above.
4. **Config-malformed silent failure** — Node `try/catch` swallows errors but writes nothing; fallback defaults preserve current behaviour. Match codex-exec.sh pattern.
5. **Calibrated threshold confusion in WASTE.md** — when `inventory_count: 1` and threshold is `warn>4` (with milestone_count=2), users may expect WARN since "1 stale artifact" feels like waste. Mitigation: leave a comment in the threshold string (`calibrated_per_milestone`) that signals it scales.

## Code Examples

### Test (manual verification)

After shipping:

```bash
# Default behaviour (no config block)
bash super-gsd/scripts/sgsd-muda-probe.sh | grep inventory
# Expected: threshold reflects 2 * milestone_count = 4 (with 2 milestones); verdict reflects against 4

# Explicit config
node -e 'var c=JSON.parse(require("fs").readFileSync(".planning/config.json")); c.muda={inventory_thresholds:{warn_per_milestone:1,fail_per_milestone:3}}; require("fs").writeFileSync(".planning/config.json", JSON.stringify(c, null, 2))'
bash super-gsd/scripts/sgsd-muda-probe.sh | grep inventory
# Expected: threshold reflects 1 * milestone_count = 2

# Empty milestones (regression check)
mv .planning/milestones /tmp/saved-milestones
bash super-gsd/scripts/sgsd-muda-probe.sh | grep inventory
# Expected: threshold = 2 * 1 = 2 (divide-by-zero guard), verdict reflects against 2
mv /tmp/saved-milestones .planning/milestones
```

## Files to modify

- `super-gsd/scripts/sgsd-muda-probe.sh` — config read + milestone count + dynamic threshold (Plan 23-01)
- `super-gsd/scripts/sgsd-muda-audit.sh` — threshold pass-through from probe JSON (Plan 23-01)
- `.planning/config.json` — add `muda.inventory_thresholds` documentation block (Plan 23-01)
- `.planning/REQUIREMENTS.md` — mark MUDAC-01..04 `[x]` (Plan 23-02)
- `.planning/milestones/v1.5/phases/23-muda-calibration/23-VERIFICATION.md` — create (Plan 23-02)

## Verification approach

1. `bash super-gsd/scripts/sgsd-muda-probe.sh` reflects new threshold string in JSON.
2. `bash super-gsd/scripts/sgsd-muda-audit.sh 22` (re-runs Phase 22 audit) shows new threshold in WASTE.md and re-classifies the previous 1-stale-artifact WARN as PASS (now 1 ≤ warn_threshold=4).
3. Manual config-malformed test: temp-corrupt config, run probe, verify defaults are used.
