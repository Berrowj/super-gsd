SALVAGE RECORD (executor timed out at 1200s before reporting; implementation complete)

FILES_CHANGED: super-gsd/hooks/sgsd-intent-classifier.cjs (modified, +228); super-gsd/hooks/sgsd-quality-gate.js (modified, 1 line); super-gsd/registry/session-governance-hooks.yaml (suggestion lexicon removed)
VERIFICATION (orchestrator, host-side): classifier --self-test -> 8/8 incl. table-sourced assertions 4-6 + fallback 7-8; registry --self-test -> 12/12; manual probe 'token waste audit' -> /sgsd-token-audit + /sgsd-muda-audit visible suggestions; real table loads source=yaml routes=24
DEVIATIONS: chronicle fixture sample-sidecar-output.json polluted by runtime hook output during executor session (spawnSync git EPERM rows) — reverted by orchestrator, not committed
BLOCKERS: none
ONE_LINER: classifier consumes skill-routing table as single suggestion source with loud compiled fallback; AC-149b proven live
STATUS: DONE (salvaged)
