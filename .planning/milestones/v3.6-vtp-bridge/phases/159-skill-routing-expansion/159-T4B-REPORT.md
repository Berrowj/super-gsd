FILES_CHANGED: Six planned files: two registries, classifier, registry loader, demand ledger, and routing-expansion assertions.

VERIFICATION: Static only—4× `node --check`; 2× YAML parse; classifier/registry/ledger module load; `git diff --check`; exact six-file scope; named checks for lazy T4 dependencies, unavailable shadow suppression, early return, matched lineage, and human-quote evidence. All passed.

DEVIATIONS: Suites intentionally not run. No commit. No runtime-pass claim.

BLOCKERS: None.

ONE_LINER: T4 unavailable paths suppress extra shadows, human quotes emit one matched T4 decision, and lazy imports preserve T1 non-SGSD stdin behavior.
