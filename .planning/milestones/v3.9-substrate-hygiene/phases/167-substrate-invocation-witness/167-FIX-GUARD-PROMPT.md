# P167 regression fix — installer-registration-guard, 5 cases red

## Established facts, do not re-derive

Five guard cases PASS at commit 44e7861 (P161) and FAIL at HEAD 879aa4c.
P167 introduced the regression. Run each case as:

  node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case <name>

Red: smoke-static, vendored-nine-hook, node-check-both-sites,
sgsd-update-clarity-shape, sgsd-update-clarity-recovery
Green, must stay green: preflight-static, bundled-overlay-static,
bundled-overlay-current, deployed-hook-smoke, hook-distribution-all-types,
hook-manifest-completeness, brokered-substrate-capability

Observed failure text:

1. smoke-static, line ~1396: `assert.equal(payload.hook_event_name, descriptor.event)`
   actual 'PreToolUse', expected 'PostToolUse'. The witness hook registers on BOTH
   PreToolUse and PostToolUse. The smoke descriptor set almost certainly now yields
   two descriptors for one scriptPath, and `calls.find(c => c.args[0] === descriptor.scriptPath)`
   matches the FIRST call for that path, so the PostToolUse descriptor is compared
   against the PreToolUse spawn.
2. vendored-nine-hook: "refusal did not name .../sgsd-substrate-invocation-witness.cjs";
   the refusal instead named .../super-gsd/tools/codex-hooks/block-secret-leak.cjs.
3. node-check-both-sites: "refusal did not name .../sgsd-quality-gate.js" with an EMPTY
   refusal body, i.e. no refusal was produced at all.
4/5. sgsd-update-clarity-shape and -recovery: `ENOENT lstat
   '<tmp>/upstream seed/super-gsd/hooks/sgsd-substrate-invocation-witness.cjs'`.
   The fixture upstream seed does not contain the witness hook the manifest now requires.

## Your job

Diagnose each of the five from the actual code and make all twelve cases green.

## Hard constraints

- Fix the ROOT CAUSE. If the guard's expectation is now wrong because the witness hook
  legitimately registers two events, fix the guard to key descriptors by
  (scriptPath, event) rather than scriptPath alone. If instead production registration
  or the manifest/seed is genuinely incomplete, fix production. Decide per case with
  evidence, and state which side you changed and why in the report.
- NEVER weaken a case to make it pass. Deleting an assertion, loosening an equality to a
  substring, try/catching a failure, or skipping a case is an automatic reject.
- Do not touch the P167 witness contract: PreToolUse stays fail-closed, PostToolUse returns
  a bounded `substrate_witness_rewrite_failed` object and NEVER passes the raw result
  through, and the store accepts only `rewritten` rows.
- Surgical diff. Only the files in the allowlist. No refactoring of adjacent code.
- Paths in these fixtures deliberately contain SPACES ("target project", "upstream seed").
  Any path handling you touch must survive that.
- If you edit any hook file, the two `sgsd_source_sha256` pins in
  super-gsd/config/repo-settings-overlay.json must be recomputed. State the new digest.

## Verification you must run and report verbatim

- All 12 guard cases, each with its exit code.
- node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs  (expect 38/38)
- node super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs (expect 4/4)
- node super-gsd/tools/feature-propagation/audit.cjs --self-test (expect 15/15)
- node --check on every file you modified

If your sandbox denies spawnSync or mkdtemp, say so explicitly per command and do not
report that command as passing. The orchestrator will re-run spawn-bound suites unsandboxed.

Report in the standard block format. Max 300 words.
