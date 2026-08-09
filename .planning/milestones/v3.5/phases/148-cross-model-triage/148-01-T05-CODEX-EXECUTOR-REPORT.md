Implemented in [assert-real-triage-runtime.cjs]($HOME/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/cholla-racer/super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs).

Added the missing matrix coverage:
- `planning-codex-verdict-row`
- `codex-malformed-wrapper-degrades`
- `prompt-injection-closed-vocabulary`
- `all` runner, with 19 configured scenarios
- `ac-*` plan aliases for the locked plan commands

Also hardened Codex missing/failing and seeded disagreement with fixture-specific JSONL assertions and valid-mode controls using the fixture marker.

Verification:
- `node --check super-gsd\tests\triage-runtime\assert-real-triage-runtime.cjs` exit `0`
- `node super-gsd\tests\triage-runtime\assert-real-triage-runtime.cjs --scenario all` exit `1`

Full suite is blocked in this sandbox by `spawnSync bash EPERM`, failing at the existing wrapper schema scenario before reaching the new count output. Configured final count is `19`; orchestrator should rerun host-side where bash spawn is allowed.
