# Your previous dispatch hit its timeout mid-implementation. Finish it. Three exact defects.

Do not redesign. Do not restart. The reordering you did in install.sh is correct and
verified present:

    482: precheck_installation_refusals
    483: ensure_gsd_base
    911/1020: precheck_installation_refusals before init/update writers
    1021: preflight_existing_repo_local_hooks
    1276/1277: precheck then publish_project_install_contract

All four touched files parse. Keep that ordering.

## Defect 1 — apply receives the prepared object and resolves it as a path

Reproduced by the orchestrator:

    prepareProjectInstall(...)  ->  OK, returns keys: candidateRoot, descriptorPath, report, rows
    applyPreparedProjectInstall(prep)  ->  THROWS

    The "paths[0]" argument must be of type string. Received an instance of Object
      at Object.resolve (node:path:214:9)
      at Object.applyPreparedProjectInstall (hook-install-contract.cjs:768:25)

Line 768 passes the prepared object where a string path is expected. Reconcile the
signature: either destructure what apply needs from the prepared object, or make apply
accept the object explicitly. Whichever you choose, `prepareProjectInstall` ->
`applyPreparedProjectInstall` must compose without the caller reshaping anything, and
`applyProjectInstall` must still work.

Consequence today: a real `install.sh --init-project` exits 2 and delivers NOTHING.
`inspectProjectInstall` reports 32 of 32 required files missing. This is a total
regression of the phase's deliverable, so treat it as the first priority.

## Defect 2 — a source-text marker is being called as a function

`assert-installer-registration-guard.cjs:1511`:

    const preparedJournal = installContract.indexOf(writeJournal('prepared'), rollbackSnapshot);

`writeJournal` is not defined in the test; it is a function inside
`hook-install-contract.cjs`. Every sibling line on 1507-1512 passes a source-text STRING
literal to `indexOf`. This one is missing its quotes. It throws
`ReferenceError: writeJournal is not defined` and takes the whole guard suite down at
`smoke-static`.

Fix it to search for the literal source text, matching the style of the surrounding lines.
Do not delete the assertion.

## Defect 3 — the contract CLI still launders its own failure

A failing install prints exactly:

    {"ok":false,"reason":"hook_install_contract_failed","underlying_error":null}

`underlying_error` is null when a real exception exists. The spec review already raised
this as MEDIUM and it has now cost three separate diagnosis cycles in this project,
including this one: I could not tell why the install failed and had to call the module
directly to obtain the real message.

Fix: `hook_install_contract_failed` must carry the underlying error with the same bounded
structure used elsewhere (code, request where applicable, path where applicable, bounded
one-line message, stack frames sanitised not dumped). A refusal that cannot say what went
wrong is not a diagnosis.

## Constraints

- Never weaken a test. Do not delete assertions to get green.
- Keep refuse-before-write literal; do not undo the ordering.
- P167 witness contract untouchable.
- Fixture paths contain SPACES.

## Verify

- node super-gsd/tests/install-contract/assert-install-contract.cjs (3/3)
- installer-registration-guard --all (13/13)
- bash -n super-gsd/install.sh, node --check on every file modified

Sandbox denials: mark DENIED, never report as passing. The orchestrator re-runs
unsandboxed. Do not ask approval. Prioritise Defect 1.

Standard block format, max 250 words.
