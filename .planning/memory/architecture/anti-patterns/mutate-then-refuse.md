---
name: mutate-then-refuse
description: Any check that can reject must run before the first write; this recurred four times across P167-P168
metadata:
  type: anti-pattern
---

# Refuse before writing, and mean it literally

Four occurrences in two milestones, same shape every time: code decides it will refuse,
but only after it has already written something it does not roll back.

1. `install.sh` (fixed 2c237ef). `install_global_assets` ran
   `repair_substrate_capability` before missing Codex entry sources were known, so a
   combined `--install-global --init-project` provisioned a witness key, copied runtime
   files, merged `.claude/settings.json` and wrote broker grants, then refused.
2. `repairClaudeSubstrateWitness` (fixed b2a1435). `installSubstrateRuntime`,
   `provisionWitnessKey` and `removeGlobalWitnessRegistrations` all ran before
   `smokeRepoHookOverlay`, which throws. A real Linux install exited 5 leaving a key
   behind and zero registrations.
3. The P168 PLAN. Caught at plan review before any code: it published project files and
   then ran the fallible final-target smoke.
4. P168 T1. Spec review found the dispatcher publishing project bytes at install.sh:1195
   before global/init/update dispatch, with `ensure_gsd_base`, the update preflight,
   settings, npm, repair and Codex registration all able to reject afterwards. The guard
   had been updated to ASSERT the wrong ordering.

5. P168 phase ATC, after two gates had called it closed. `install.sh:1292` published, then
   dispatched paths running rejection-capable `repair_substrate_capability` and
   `register_codex_hooks` (`:1014-1015`, `:1110-1111`), and `audit.cjs:1456` published
   before witness/capability repair at `:1484-1492`. The guard "asserted" the ordering by
   forbidding only functions whose NAME contained "precheck", which is why a
   spec-compliance review passed it twice.

**A name-based assertion is not an ordering assertion.** Enumerate the functions that can
reject and require each to precede the first write, so a newly added rejecting function
fails the guard rather than slipping behind the naming convention.

**Rollback is not a substitute.** A smoked hook can touch state outside the tree being
rolled back.

**How to apply.** Before approving any install/repair/publish change, ask: what is the
first destination write, and can anything after it reject? Assert the ordering in a test
so reintroduction fails loudly. When a reviewer says "move the checks", move the CHECKS,
not the writes: see [[dont-rebuild-the-world-to-fix-an-ordering-bug]].

Related: [[writer-accepts-caller-destination]], [[silent-success-reports-health]].
