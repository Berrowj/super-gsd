# RB3: one expected-array in generated-transitive-manifest is hand-written. One file, one diff.

Your fixture builder now (correctly) folds the declared-root closure into every generated
source tree. The synthetic case's expected list was not derived, so it fails:

    + actual - expected
      [
    +   'schemas/vtp-mcp-input-schemas.v2.json',
        'scripts/lib/cycle-a.cjs', ... synthetic files ...
    +   'scripts/lib/decision-state.cjs',
    +   'scripts/lib/phase-name.cjs',
    +   'tools/state-resolver/resolve.cjs'
      ]
    at assert-install-contract.cjs:197

Fix per the standing rule (no hand-maintained lists): compute the expected set as the
synthetic fixture's own files UNION the declared-root closure taken from the SAME
authority the builder uses (hook-install-contract's computation/declared list), sorted
identically. The case must still fail if the synthetic lexer cases (cycle, extensionless,
directory, package, transitive, data.json) are mishandled — that is what it proves; the
declared-root portion is environment, not the subject.

Everything else in the suite passes; touch only this case's expectation derivation.
Report: lines changed, max 60 words.
