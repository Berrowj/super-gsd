# 173-01 prerequisite repair local evidence

Owner: `pm-automation.harness.20260915`
Current status: **VERIFIED — isolated canonical-lock plan-schema proof is 5/5.**
Scope: evidence-only refresh for the immutable ATC R1 finding; no candidate source,
shared dependency tree, user npm state, or `/opt` content changed.

## Preserved baseline history

Before the authorized private setup, direct execution in this worktree was **0/5**:
`tools/plan-schema/node_modules` lacked the exact local AJV dependency closure.
That was an environment precondition, not a validator failure. The earlier
`0/5 BLOCKED` wording is retained here solely as baseline history; it is not the
current result. ATC R1's immutable report remains
`ab95f1c5a33b85772cd98ea48551ca8066db8560f6f0b622f15392bfa51f11b8`.

## Canonical inputs and dependency contract

| Input | SHA-256 |
| --- | --- |
| `tools/plan-schema/package.json` | `77988d93f570ef7da99cdda25ea3dd1d3cae5b20162b809470d2d164c02055d7` |
| `tools/plan-schema/package-lock.json` | `e64491257bf2df2c24f1ab593fc8f5ca971456ae8ffd5867b101841f3cfbeafe` |
| `tools/plan-schema/validate.cjs` | `c5047c2702c2f165a6fd93878ab586b90c378e69fc0717b77d7239159149b3d1` |
| `tools/plan-schema/validate.test.cjs` | `259589c614fb243d74ab774ba9c05e26af0ed035035ae3847321ff4f839d79b5` |
| `templates/plan-schema-v2.json` | `336cd06838c30d6125348536d66390c2e8f5e42f772ef6f79aab77a14ae75fdd` |
| Phase 97.5 valid-plan fixture | `658e818680414e22d18a1ddc5bcdbbfc6d517cdae764b4ac2260f4b6c278d249` |

The tracked manifest has no scripts; its lockfile is v3. Its six direct
dependencies exactly equal the root lock dependencies. Inspection found no
`preinstall`, `install`, or `postinstall` script in any lock entry.

## Fresh private execution and cleanup receipt

A task-owned root `/tmp/sgsd-phase173-plan-schema-r1.1QlMPr` was created with
mode `0700`. Only the six hashed canonical inputs above and the validator
fixtures were copied. Its private `HOME` and `npm_config_cache` were both
under that root. From the copied
`super-gsd/tools/plan-schema` directory, this exact command ran:

```text
HOME=/tmp/sgsd-phase173-plan-schema-r1.1QlMPr/home \
npm_config_cache=/tmp/sgsd-phase173-plan-schema-r1.1QlMPr/npm-cache \
npm_config_update_notifier=false \
npm ci --ignore-scripts --no-audit --no-fund --loglevel=error
```

It installed **57 locked packages** (`package-lock.json` has 58
`packages` entries including the root package), then ran:

```text
node /tmp/sgsd-phase173-plan-schema-r1.1QlMPr/super-gsd/tools/plan-schema/validate.test.cjs
```

Result: **5 passed, 0 failed**, exit 0. The test-created private telemetry file
was 1,567 bytes. The exact checked cleanup receipt is
`{"cleanup_target":"/tmp/sgsd-phase173-plan-schema-r1.1QlMPr","removed":true}`;
the root no longer exists. Raw bounded setup/test/cleanup output:
[`173-01-PLAN-SCHEMA-ISOLATED-STDOUT.txt`](173-01-PLAN-SCHEMA-ISOLATED-STDOUT.txt)
(SHA-256 `f8452ce86190242e543346a58a69ce540c80a8a2f62ecaf86d35c27c63f0aae8`,
290 bytes).

Toolchain: Node `v24.15.0`; npm `11.12.1`. No registry, lockfile,
`node_modules` in this worktree, global cache, user configuration, or runtime
installation was changed.

## Related prerequisite repair retained

The candidate `install.test.cjs` remains 2/2 green. History establishes that
`b4653c58` added the valid `/think` route, changing the verified contract
from 30 to 31 routes; `b1dc0cc9` only repaired/repositioned its regexes. The
fake npm fixture now derives from the tracked canonical manifest/lock and
retains non-tautological assertions for the 31-route contract and one
prompt-time `think` route.
