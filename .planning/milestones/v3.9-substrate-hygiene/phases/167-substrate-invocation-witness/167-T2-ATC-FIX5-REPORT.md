FILES_CHANGED: `super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs` (modified)  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs` -> exit 0  
DEVIATIONS: Optional duplicate replay cleanup skipped to prioritize the main fix, as permitted  
BLOCKERS: none  
ONE_LINER: The fixture junctions its plan-schema `node_modules` to the real dependency tree, allowing the composer to resolve Ajv locally.
