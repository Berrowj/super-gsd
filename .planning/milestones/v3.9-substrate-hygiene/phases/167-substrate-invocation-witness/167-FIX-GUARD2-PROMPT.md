# Replace the unsafe deferred install refusal with a non-mutating pre-check

An adversarial review returned UNSAFE on the change currently in the working tree.
You are fixing that. Do not re-litigate the verdict.

## What is wrong right now

`distribute_project_hooks` sets `CODEX_HOOK_DISTRIBUTION_INCOMPLETE=true` instead of
exiting, and the exit was moved to the top of `register_codex_hooks`. Both call sites
(`init_local_project` ~895-897, `update_existing` ~993-995) run
`repair_substrate_capability` BETWEEN those two points, and that repair is mutating.
Cited writes on the deferred path:

- installSubstrateRuntime -> copyFile (audit.cjs:572, audit.cjs:846)
- provisionWitnessKey -> fs.writeFileSync (substrate-invocation-witness-store.cjs:116,124)
- mergeSettingsFiles writes+renames project .claude/settings.json (merge-settings.js:604, 759-767)
- atomicPrivateJson / saveChangedScopeDocuments write .mcp.json or
  .claude/settings.local.json (audit.cjs:667, 796, 804); with --install-global it can
  also rewrite ~/.claude/settings.json and global agents (audit.cjs:596, 919)

So an install that is going to refuse now persists capability state first, with no
rollback, leaving Codex hooks unregistered. That must not ship.

## What to build instead

Keep the legitimate goal: the installer must name EVERY missing registration in one
run, not just the first. Achieve it WITHOUT deferring past the mutating repair.

Required shape:

1. Before `repair_substrate_capability` is allowed to run, gather the COMPLETE refusal
   set: the Codex hook-entry misses already collected in `distribute_project_hooks`,
   PLUS the substrate/witness-hook registration completeness result obtained from a
   NON-MUTATING check.
2. The non-mutating check must not copy files, provision a witness key, merge settings,
   write grants, or touch ~/.claude. If `audit.cjs` has no read-only mode that reports
   the same missing-registration set, add one (a flag such as `--check` /
   `--no-repair`) that shares the detection code with the repair path so the two can
   never disagree. Detection shared, mutation not.
3. Print every refusal line, then `exit 1`, BEFORE `repair_substrate_capability`.
4. Only when the combined refusal set is empty may repair and registration proceed.
5. Remove `CODEX_HOOK_DISTRIBUTION_INCOMPLETE` and the exit at the top of
   `register_codex_hooks`, or reset the variable so no value can leak between the
   init and update call sites in a single invocation.

## Hard constraints

- Refusal message text and the `hook_registration_missing <target> [<source>]` format
  must stay exactly as they are; guard cases match on them.
- Do not weaken any guard case to make this pass. No deleted assertions, no substring
  loosening, no try/catch swallowing, no skips.
- Do not touch the P167 witness contract: PreToolUse fail-closed, PostToolUse returns a
  bounded `substrate_witness_rewrite_failed` object and never passes the raw result
  through, store accepts only `rewritten` rows.
- Fixture paths contain SPACES ("target project", "upstream seed"). Any path handling
  you touch must survive that.
- Surgical diff, allowlisted files only.
- If you modify a hook file, recompute both `sgsd_source_sha256` pins in
  super-gsd/config/repo-settings-overlay.json and state the digest. Current pin:
  5640a8ed92467cde81c80b95b747f3dd55285c2bdc338e26dc1c353db1fc1642

## Verification to run and report verbatim

- All 12 guard cases with exit codes (all must be green; the currently green ten must
  stay green).
- assert-hook-contract.cjs (38/38), assert-prompt-contracts.cjs (4/4),
  audit.cjs --self-test (15/15)
- bash -n super-gsd/install.sh, and node --check on every .cjs/.js you modified

State explicitly, in one line, that no mutating call can now execute between the
refusal being known and the process exiting.

If your sandbox denies spawnSync/mkdtemp/git, say so per command; do not report a
denied command as passing. Report in the standard block format, max 300 words.
