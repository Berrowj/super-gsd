# Fixture parity for the new closure roots. Patch mode, ONE diff, the two packed test files.

Production now delivers three new things, all verified working in a real install
(exit 0; ajv package closure lands under tools/plan-schema/node_modules; schema JSON and
decision-state + state-resolver chain delivered; composer and decision-state LOAD from
the delivered tree):

1. computed vendored-package closure for `vtp-context-composer.cjs:33`'s
   `path.join(__dirname,...,'tools','plan-schema','node_modules','ajv')` require
   (packages: ajv, fast-deep-equal, fast-uri, json-schema-traverse, require-from-string);
2. a declared-roots list in hook-install-contract.cjs: asset
   `schemas/vtp-mcp-input-schemas.v2.json` and spawn root
   `scripts/lib/decision-state.cjs` (its require closure walked like a hook's);
3. generation fails naming any declared root missing at the SOURCE.

Two suites now fail because their trimmed fixture source trees predate this:

- install-contract: `Error: schemas/vtp-mcp-input-schemas.v2.json: declared root is
  missing` (thrown at generation inside the fixture).
- guard bundled-overlay-current: same, surfaced as hook_smoke_failed with the full
  structured underlying_error (which is the diagnosis working as designed).

Fix the FIXTURES, not production: fixture source-tree construction must include whatever
the closure computation requires — derive the file set FROM `computeHookDependencyGraph`
(its files/union/packages and the declared roots), never from a hand-maintained list.
Same rule as the earlier ajv fixture round: copy resolved package roots, no symlinks, no
whole node_modules trees, spaces-safe paths.

Do not weaken any assertion. Every currently-green case stays green; the two failing
cases and any sibling that builds a trimmed source tree must pass by actually containing
the computed set, so a future new root updates fixtures automatically.

Report: fixture builders touched, max 100 words.
