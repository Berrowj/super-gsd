RESULT: IMPLEMENTED

Changed exactly two tracked files:

- `assert-install-contract.cjs`: added project `package.json` preinstall sentinel, sentinel-absence assertion, empty-actions assertion, and retained byte-identity checks.
- `hook-install-contract.cjs`: refusal JSON now exposes `actions: []`; removed two orphan exports.

PASS:

- `node --check` both files
- `git diff --check`
- Export-absence probe
- Refusal JSON probe: status 2, actions 0
- Exactly two tracked files modified

DENIED:

- FIRST/LAST real install
- Targeted refusal case
- Full install-contract
- Guard `--all`

All were blocked by sandbox `spawnSync bash EPERM`; none are reported as passing. Before denial, generated-manifest passed and guard’s first three static cases passed.
