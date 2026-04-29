---
phase: 59
name: New Project Wizard
milestone: v2.1
type: research
researched_at: 2026-04-29
researcher: gsd-executor (compressed-phase dispatch)
---

# Phase 59 Research - New Project Wizard

## Goal

sgsd-configure handles knowledge/memory; new wizard handles project-level
(cockpit panes, default boot mode). Must not replace either.

## Locked Decision: 59=C

Deep-merge + idempotent additive wizard. Strict Lock 11 byte-equality on
existing keys (never overwrite, never coerce). Strict Lock 13 (degraded
sentinels for missing dir / malformed JSON / write fail).

## Prior Art Surveyed

### Phase 50 cockpit-shell (Lock 4 reference, MIRROR constraint)

`super-gsd/scripts/lib/sgsd-cockpit-shell.cjs:47-55` declares the canonical
`PANEL_KINDS` frozen array (7 entries: token, source_mix, active_agent,
codex, intent, governance, budget). The wizard mirrors this byte-equally
in `_internals.PANEL_KINDS`. Mirror NOT import: Lock 4 prohibits Phase 41-58
require() from new modules. If cockpit-shell ever changes the panel set,
both lists must be updated in lockstep.

### Phase 58 installer-audit (5-API surface convention)

`super-gsd/tools/installer-audit/audit.cjs` shipped the 4-API Lock-13 surface
(runAudit, getProbe, selfTest, _internals) with frozen closed-vocab arrays
(PROBE_NAMES, SOURCE_VALUES, REASON_NOTES, MANDATORY_PROBES) and 12
self-test assertions. Wizard mirrors this convention with 5 APIs (adds
deepMergeConfig and validateProjectConfig, drops the runtime probe shape).

### Phase 58 sgsd-complete-milestone v2.1 dispatch branch (Lock 4 anchor)

`sgsd-complete-milestone.cjs:159-244` is the v2.1 first-gate (installer-audit
selfTest + runAudit floor). Phase 59 extends ONLY the inside of the
`milestone === 'v2.1'` block, between the existing `milestone_close_gate:
v2.1 first-gate (installer-audit) green` line and the original
`process.exit(0)`. Lines 1-242 remain byte-equality preserved.

### sgsd-configure.ps1 ownership boundary

The existing PowerShell script (174 lines, knowledge block only) is the
authoritative writer of the `knowledge` config block. Phase 59 wizard owns
the `project` block. Both write to `.planning/config.json`. Both are
non-destructive: configure preserves prior `knowledge` block via
ConvertFrom-Json round-trip; wizard preserves all other keys via deep-merge.
The two never write the same key.

## Architecture

```
.planning/config.json  (single source of truth)
  +-- workflow         (existing; owned by gsd-tools / operator)
  +-- safety           (existing; owned by gsd-tools)
  +-- model_routing    (existing; owned by gsd-tools)
  +-- ...              (other operator/orchestrator keys)
  +-- knowledge        (owned by sgsd-configure.ps1)
  +-- project          (owned by sgsd-new-project-wizard.cjs) <-- NEW
       +-- schema_version: 1
       +-- cockpit_panel_kinds: [...PANEL_KINDS]
       +-- default_boot_mode: 'auto'
       +-- operator_preferences: {confirm_destructive, verbose_logging}
       +-- configured_by, configured_schema
```

## Idempotency Strategy

1. **Deep-merge** existing keys win byte-equality. Only paths NOT present
   in existing are copied from additions.
2. **Deterministic serialization**: keys sorted at every depth via custom
   `_serializeStable` walker. Same logical config -> same byte string.
3. **Trailing newline normalization**: every write ends with `\n`.
4. **Skip-write optimization**: if existingRaw === serialized, skip
   fs.writeFileSync (`written: false`, `idempotent_skip: true`).

## Self-Test Inventory (13 shipped)

1. `panel_kinds_frozen_7_entries` - mirror invariant (Phase 50 byte-equality)
2. `boot_modes_frozen_3_entries` - closed enum (auto, manual, observe)
3. `deep_merge_non_clobber` - existing wins on conflict (Lock 11)
4. `deep_merge_idempotent` - twice-merged result is byte-stable
5. `serialize_stable_idempotent` - key-order-independent serialization
6. `run_wizard_missing_dir_degraded` - Lock 13 (no throw, exit_code=2)
7. `run_wizard_missing_arg_degraded` - Lock 13 (no throw, exit_code=1)
8. `deep_merge_non_object_degraded` - Lock 13 (graceful degradation)
9. `validate_accepts_complete_block` - happy-path validation
10. `validate_rejects_bad_boot_mode` - closed-enum rejection
11. `validate_rejects_missing_block` - missing-key rejection
12. `ascii_only_source` - first_nonascii_idx === -1 on this very file
13. `validation_codes_frozen_vocab` - VALIDATION_CODES Object.isFrozen

## Verification Commands

```bash
# Unit
node super-gsd/scripts/sgsd-new-project-wizard.cjs --self-test
node super-gsd/scripts/sgsd-new-project-wizard-self-test.cjs

# Integration (gate)
node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1

# Idempotency (manual)
TMPDIR=$(mktemp -d) && mkdir -p "$TMPDIR/.planning"
node super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults --project-dir "$TMPDIR"
HASH1=$(sha256sum "$TMPDIR/.planning/config.json")
node super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults --project-dir "$TMPDIR"
HASH2=$(sha256sum "$TMPDIR/.planning/config.json")
[ "$HASH1" = "$HASH2" ]  # must succeed
```

## Open Questions Closed

Q: Should the wizard configure both knowledge AND project blocks?
A: NO. sgsd-configure.ps1 is authoritative for knowledge; the wizard is
   authoritative for project. Two complementary tools, byte-disjoint
   namespaces, no duplicated logic.

Q: How does the wizard handle a malformed config.json?
A: Lock 13 graceful degradation: parse failure -> treat existing as {} +
   set summary.existing_was_malformed=true. Operator sees the warning;
   the wizard still writes a valid config (which loses the malformed
   user content, but the alternative is throwing on already-broken state).

Q: What if the project dir is on a read-only filesystem?
A: Lock 13 graceful degradation: fs.writeFileSync throws -> caught by
   try/catch -> returns {ok:false, exit_code:4, summary.reason:write_failed}.
   Never propagates upward.
