FILES_CHANGED: `sgsd-vtp-pending.js`; `settings-overlay.json`.

VERIFICATION: PASS — Node syntax, overlay JSON/unique registration, source-policy scan, exact depth output, silent fail-open cases, and ledger byte preservation.

DEVIATIONS: None. Test, installer, and merge-settings files untouched; no commit created.

BLOCKERS: None. Installer-backed green remains for the orchestrator as instructed.

ONE_LINER: Count-only VTP SessionStart hook implemented and registered, ready for full green.
