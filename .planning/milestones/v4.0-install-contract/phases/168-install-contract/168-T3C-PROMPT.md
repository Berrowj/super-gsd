# Round 3 on the same CRITICAL. The design decision is made for you: publication becomes the LAST write.

Two prior rounds failed differently. Round 1 moved checks earlier but left the writers
able to refuse after publication. Round 2 (mine) pre-checked policy but the ATC correctly
held that the repair functions retain their own refusal paths reachable post-publication
(`install.sh:484-500,904`; `audit.cjs:797,888-918,935-937`), and that a manually
maintained guard list is evadable. Do not repeat either shape. Do not rebuild the
installer; no staging modes, no self re-execution. Diffs proportionate to a REORDER.

## The design, decided — implement exactly this

Make `publish_project_install_contract` the FINAL destination write on every entry point,
and the transactional commit of the whole install:

    checks (all of them, candidate-based)  ->  repair writes  ->  codex registration
    ->  PUBLICATION (journaled, last)      ->  non-rejecting verification only

This is feasible, verified by the orchestrator before this dispatch:

- The repair merge does NOT need published project bytes: `repoHookSourcePath`
  (audit.cjs:607-626) already redirects project hook paths to the canonical source for
  its file checks.
- `register_codex_hooks` runs `$SCRIPT_DIR/tools/codex-hooks/install-hooks.cjs` from the
  canonical source and writes `.codex/hooks.json`; it does not read published bytes.

So the reorder is: on init/update/global-with-project paths, call
`repair_substrate_capability` and `register_codex_hooks` BEFORE
`publish_project_install_contract`, and in `runAudit` perform witness/capability repair
BEFORE `publishProjectHookInstall`. If either repair refuses, nothing has been published:
the project's `super-gsd/` tree is untouched. Their earlier writes (settings merge, key,
`.codex/hooks.json`) reference files that arrive at publication; that dangling window
exists only INSIDE a failed install and is closed by the publication commit in a
successful one — state this in a comment where the ordering is established.

If you find a genuine dependency that breaks this order, STOP and report it with the
exact line rather than inventing machinery around it.

## The guard, behaviour-based this time

Delete the manual inventory approach. Assert the DESIGN instead: locate
`publish_project_install_contract` in each entry-point body and assert it is the last
call capable of writing into the project tree, with only verification following; assert
`runAudit` publishes after both repairs. Then add the behavioural half: a fixture where
`repair_substrate_capability` is forced to fail (e.g. broker source removed) must leave
the project's `super-gsd/` tree byte-identical to before the install, proving no
publication happened before the refusal. That test catches any future rejecting step
placed before publication-last is violated, regardless of the function's name.

## MINORs, in the same pass

- Remove the in-process build/smoke/publish duplicate at
  `hook-install-contract.cjs:767-778`; only tests call it. Switch those tests to the CLI
  path (`:784-824`). One engine.
- Delete `.planning/.../168-ABANDONED-T3-REPAIR-SPLIT.patch`; commit 6c54b7b already
  records that history. Keep `168-ABANDONED-STAGED-INSTALLER.patch`.

## Constraints

- Never weaken or delete an assertion; the replaced ordering assertions must be stronger.
- P167 witness contract untouchable. Fixture paths contain SPACES.

## Verify

- Real install FIRST and LAST: exit 0, 17 hooks, 9 modules.
- Forced-repair-failure case: project tree byte-identical, non-zero exit.
- install-contract all cases; guard `--all` 13/13; `audit.cjs --self-test`;
  `bash -n install.sh`; `node --check` on files modified.

Sandbox denials: mark DENIED. Do not ask approval. Standard block, max 300 words.
