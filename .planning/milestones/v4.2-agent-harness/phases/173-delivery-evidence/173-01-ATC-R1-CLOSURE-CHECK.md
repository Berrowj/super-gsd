# 173-01 ATC R1 mechanical finding-closure check

This check does not reinterpret the immutable R1 rejection. It verifies that
the two exact evidence defects named by R1 now have candidate-bound repair
artifacts before the one authorized same-finding continuation.

Command: the bounded Node check recorded against the current worktree reads
only the R1 report, the two repaired evidence files and their raw artifacts,
then SHA-256 checks the three candidate source/test files.

| Required condition | Result |
| --- | --- |
| R1 report preserved at SHA-256 `ab95f1c5a33b85772cd98ea48551ca8066db8560f6f0b622f15392bfa51f11b8` | true |
| Finding 1: current prerequisite evidence says verified 5/5, binds the canonical private result, and is not current-blocked | true |
| Finding 2: focused cleanup evidence binds TAP 3/3, raw output, child absence, and source hashes | true |
| Candidate source bindings remain exactly authorized | true |
| Both bounded raw artifacts match their recorded hashes and byte counts | true |

The checker returned exit 0. Its candidate values are `rpc.cjs`
`032ffd8828a8a8a63e58db1a36636ae8f18088e95b2e4ac8cfce5c460f9545fe`,
`rpc.test.cjs` `a6326111742bfe0c91ba3e9906dc2a9ecde820bd14d69f066e831deefe455a52`,
and `install.test.cjs` `a974beeb4ed7e72c4d06d2b952ec95153a85f6228a0ae71533ab8f70b2cf234f`.

This is only evidence-family closure, not an ATC PASS claim. The fresh
continuation report and matching wrapper receipt remain required.
