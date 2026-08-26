---
name: error-laundering-closed-vocabulary
description: Replacing a real exception with a constant reason code costs a full diagnosis cycle every time
metadata:
  type: anti-pattern
---

# Never replace an observed error with a constant

Three occurrences, each costing at least one diagnosis round trip.

1. P167 `safeFailureReason` in the live-capture harness admitted only
   `/^[a-z0-9_:.-]+$/i` and reported `harness_internal_error`. The real exception was
   masked; several fix rounds chased the wrong thing.
2. `moduleFailureDetail` in `hook-registration-preflight.cjs`. When output did not match
   `MODULE_NOT_FOUND|Cannot find module` it returned
   `{code:'HOOK_PROCESS_FAILED', request:null, path:null, message:'hook process exited non-zero'}`,
   discarding the bounded real message it already held.
3. The contract CLI emitting
   `{"ok":false,"reason":"hook_install_contract_failed","underlying_error":null}`. I could
   not tell why an install failed and had to call the module directly to obtain
   `EBUSY: resource busy or locked, read`.

4. The witness hook's `catch (_)` turned MODULE_NOT_FOUND into
   `project_runtime_unavailable`, and the loadability classifier then ACCEPTED that deny
   as a clean policy decision — so the install smoke passed over a runtime that could not
   load, and the doctor said 32/32 current. Laundering defeated a safety gate, not just a
   diagnosis. Fixed 0c66b6c: the deny carries the bounded real error, and a
   runtime-unavailable/module-resolution deny is a load FAILURE to the smoke.

The operator saw the same failure on a live Linux box as four generic codes
(`pretooluse_missing, direct_grant, upstream_missing, witness_repair_failed`) when the
truth was one unresolvable module path.

**How to apply.** Keep the closed reason code for control flow AND carry the underlying
error beside it: code, request, path, bounded one-line message, stack frames sanitised
rather than dumped. Widening the reason vocabulary is not the fix. A refusal that cannot
name what failed is not a diagnosis.

Related: [[blind-agent-root-cause-is-a-hypothesis]], [[silent-success-reports-health]].
