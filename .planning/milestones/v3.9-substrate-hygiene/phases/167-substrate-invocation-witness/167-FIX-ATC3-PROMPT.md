# The new pre-check resolves hook paths against the ambient HOME, not the target project

Two guard cases regressed with your last change. You could not run them (sandbox
denies spawnSync). The orchestrator ran all twelve unsandboxed. Results:

PASS: preflight-static, smoke-static, bundled-overlay-static, bundled-overlay-current,
deployed-hook-smoke, hook-distribution-all-types, hook-manifest-completeness,
brokered-substrate-capability, sgsd-update-clarity-shape, sgsd-update-clarity-recovery
FAIL: vendored-nine-hook, node-check-both-sites

## Exact observed output

`vendored-nine-hook` expected the refusal to name
`<tmp>\sgsd-registration-vendored-nine-XXXX\target project\super-gsd\hooks\sgsd-substrate-invocation-witness.cjs`

The refusal actually emitted:

    hook_registration_missing /tmp/sgsd-registration-vendored-nine-XXXX/target project/super-gsd/tools/codex-hooks/block-secret-leak.cjs [Codex/project-entry]
    hook_registration_missing <HOME>\super-gsd\hooks\sgsd-substrate-invocation-witness.cjs [PreToolUse/pre-tool-use-substrate-invocation-witness]
    hook_registration_missing <HOME>\super-gsd\hooks\sgsd-intent-classifier.cjs [UserPromptSubmit/user-prompt-intent-classifier]
    hook_registration_missing <HOME>\super-gsd\tools\codex-hooks\block-secret-leak.cjs [UserPromptSubmit/user-prompt-secret-leak-guard]
    hook_registration_missing <HOME>\super-gsd\hooks\sgsd-substrate-invocation-witness.cjs [PostToolUse/post-tool-use-substrate-invocation-witness]
    hook_registration_missing <HOME>\super-gsd\hooks\sgsd-quality-gate.js [PostToolUse/post-tool-use-quality-gate]

`node-check-both-sites` expected `<tmp>\...\target project\super-gsd\hooks\sgsd-quality-gate.js`
and got `<HOME>\super-gsd\hooks\sgsd-quality-gate.js`.

## The defect

The Codex-entry line resolves correctly against the fixture's target project. The
substrate pre-check lines do not: they resolve against the ambient home / SGSD root
instead of the project being installed into. Note the first line uses the temp project
root and the rest do not, in the SAME refusal block, which is how you can tell the two
detectors disagree about the destination.

Consequence on a real machine, not just in the fixture: the pre-check inspects and
reports the operator's own home tree rather than the target project, so it can refuse
for a file irrelevant to this install, or pass because the operator's home happens to
be complete while the target project is not. Derive the destination; never inherit it
from ambient state.

## What to fix

1. Make the substrate pre-check resolve every reported path from the SAME project root
   the rest of the install is acting on, exactly as the Codex-entry detector does.
2. Detection must stay shared with the repair path. Do not fork a second detector.
3. Keep the `hook_registration_missing <target> [<source>]` text exactly as-is.
4. Keep the ATC CRITICAL closed: no writer may execute on ANY entry point, including
   `install_global_assets`, before the combined refusal set is known.
5. Fixture paths contain SPACES ("target project"). Whatever you touch must survive it.

## Guard assertion accounting

Your last change removed 1 assertion line. State which one and why it was retired, or
restore it. No further removals without a per-assertion reason.

## Verification

Run what your sandbox permits and report exit codes; explicitly mark denied commands
as DENIED, never as passing. Always run: `bash -n super-gsd/install.sh` if permitted,
and `node --check` on every JS/CJS file you modify. The orchestrator will run all
twelve guard cases unsandboxed and will reject the change if any is red.

Standard block format, max 300 words.

## Design APPROVED — implement it now, do not ask again

You proposed this and it is approved. Autonomous mode: never stop to request approval,
implement and verify.

Approved design:

1. `mkContext(explicitProjectDir)` preserves `path.resolve(explicitProjectDir)` exactly.
   Planning-root discovery is retained ONLY when no destination is supplied. This is the
   root cause: an explicit destination was being overridden by an ancestor `.planning`
   walk-up, so the check inspected the ambient home tree instead of the target project.
2. Check and repair remain shared. No second detector.
3. Add deterministic ancestor-`.planning` coverage using the existing spaced fixture path,
   so a project nested under another project's `.planning` cannot silently retarget again.
4. Restore the retired copy-order assertion against the actual Codex copy call.
5. Refusal text and pre-writer ordering unchanged. The ATC CRITICAL stays closed: no
   writer executes on any entry point, `install_global_assets` included, before the
   combined refusal set is known.

Rejected alternatives, do not implement: installer-specific path flags; special-casing
vendored projects. Both add coupling and risk detector/repair drift.

Add a regression assertion that fails if an explicit destination is ever overridden by
walk-up discovery, so this cannot come back.

Verify and report as specified above. Do not ask any further questions.
