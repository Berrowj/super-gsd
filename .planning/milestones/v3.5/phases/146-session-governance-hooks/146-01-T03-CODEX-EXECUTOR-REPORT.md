DONE

FILES_CHANGED: `super-gsd/hooks/sgsd-session-start.js` (modified)

VERIFICATION:
`node --check super-gsd/hooks/sgsd-session-start.js` → exit 0 ✓
`temp SGSD STATE milestone=v3.5 current_phase=873; assert Governance Contract/ATC/v3.5/873` → exit 0 ✓
`non-SGSD temp cwd; assert exit 0 and empty stdout` → exit 0 ✓
`SGSD temp STATE without phase; assert contract emitted and exactly one state_phase_missing row` → exit 0 ✓
`malformed + empty stdin; assert exit 0 and no stack trace` → exit 0 ✓

DEVIATIONS: none

BLOCKERS: none

SCRIPTS_CREATED: none

ONE_LINER: SessionStart now derives SGSD root from `payload.cwd`, emits the governance contract with resolver-read milestone/phase, stays quiet outside SGSD roots, and preserves bounded handoff pairing.
