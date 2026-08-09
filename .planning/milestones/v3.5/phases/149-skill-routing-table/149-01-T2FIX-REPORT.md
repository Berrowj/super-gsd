FILES_CHANGED

- [skill-routing-registry.cjs]($HOME/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/cholla-racer/super-gsd/scripts/lib/skill-routing-registry.cjs) — fallback parity, P146 aliases, regex policy, self-tests.
- [skill-routing-malformed.yaml]($HOME/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/cholla-racer/super-gsd/tools/self-test/fixtures/skill-routing-malformed.yaml) — overlength and unsafe-regex fixtures.

VERIFICATION

- `node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test`
- Result: `12 pass, 0 fail`
- Fallback parity: 24/24 routes, no missing or extra keys.
- Malformed fixture correctly exits nonzero.

DEVIATIONS

- None.

BLOCKERS

- None.

SCRIPTS_CREATED

- None.

ONE_LINER

Closed all three warnings with fallback parity, `/sgsd-*` directive compatibility, and conservative regex validation.

STATUS

PASS
