# RB4: the empty-tree case pins module counts as literals. Derive them. One file, one diff.

    AssertionError: real install did not deliver all 9 scripts/lib modules
    11 !== 9      (assert-install-contract.cjs:475)

The closure legitimately grew (decision-state.cjs, phase-name.cjs). Any literal
count in this suite is the hand-list trap again: derive expected hook and module counts
(and any file lists) from `computeHookDependencyGraph` / the generated manifest at
runtime, so closure growth updates expectations automatically while a DELIVERY failure
(delivered < computed) still fails. Check the whole file for other literal counts (17
hooks, 32 rows, etc.) and derive them the same way in this pass.

Report: assertions changed, max 60 words.

## RETRY — your previous diff did not apply (context mismatch at :559). Fresh read-pack.

The literal counts live at assert-install-contract.cjs:472-477 exactly as:

    assert.equal(report.requiredFiles.filter(
      (row) => row.relative_path.startsWith('hooks/'),
    ).length, 17, 'real install did not deliver all 17 hook files');
    assert.equal(report.requiredFiles.filter(
      (row) => row.relative_path.startsWith('scripts/lib/'),
    ).length, 9, 'real install did not deliver all 9 scripts/lib modules');

Anchor your hunks on THIS content. Derive both counts (and any other literal row counts
you find in the file) from the generated manifest / computeHookDependencyGraph at
runtime. Keep messages informative (include the derived expected number).
