FILES_CHANGED: None.

VERIFICATION: Baseline command  
`node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario staged-vtp-healthy`  
failed before runtime execution: `spawnSync C:\Program Files\nodejs\node.exe EPERM`.

DEVIATIONS: None; I stopped before violating the locked contract.

BLOCKERS:

- The required post-fix fallback args are exactly `{query}`, but the mandated unchanged regression asserts `args.raw_query` and `args.fallback_reason` at lines 1436–1438. It must fail after the fix.
- This sandbox prohibits the nested Node process used by the staged-CLI tests, despite direct Node commands working.

ONE_LINER: P154-T1 needs a plan amendment permitting updates to `assert-real-triage-runtime.cjs` and a subprocess-capable executor—or revised verification mechanics—before the contractual red/green cycle can proceed.
