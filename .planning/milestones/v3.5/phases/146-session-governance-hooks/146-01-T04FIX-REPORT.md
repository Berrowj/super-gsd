FILES_CHANGED: `super-gsd/hooks/sgsd-intent-classifier.cjs` (modified)

VERIFICATION:  
`node --check super-gsd/hooks/sgsd-intent-classifier.cjs` → exit 0 ✓  
`same temp SGSD fixture: planning prompt routes, README prompt does not` → exit 0 ✓  
`non-SGSD temp dir: empty stdout, zero files written` → exit 0 ✓  
`bench temp SGSD fixture + outside-record refusal` → exit 0 ✓ (`p95_ms=0.044`, `iterations=200`)  
`empty / garbage / null stdin no stack trace` → exit 0 ✓

REGISTRY_SOURCE_LINE: `super-gsd/hooks/sgsd-intent-classifier.cjs:20 const REGISTRY_SOURCE_PATH = path.resolve(__dirname, '..', 'registry', 'session-governance-hooks.yaml');`

DEVIATIONS: none

BLOCKERS: none

SCRIPTS_CREATED: none

ONE_LINER: Classifier now uses the hook-shipped registry as authoritative while keeping `payload.cwd` for SGSD-root gating and evidence destination only.
