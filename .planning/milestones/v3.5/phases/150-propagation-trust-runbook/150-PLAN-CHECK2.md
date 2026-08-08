FINDINGS: 2
CRITICAL: 2
WARNINGS: 0
PASS_RATE: 2/4 ACs covered
ONE_LINER: C1, C3, C4, and W1-W4 are fixed, but AC-150d uses an invalid tmux server-PID field and T150-05 verifies new tooling from a local worktree it never advances.
FINDINGS_DETAIL: [FIXED C1] PowerShell-to-Bash escaping is corrected through single-quoted here-strings or named remote scripts with explicit arguments.
FINDINGS_DETAIL: [CRITICAL C2] The marker, absolute-path, process-identity, liveness, and MCP-provenance repairs are present, but AC-150d uses `#{session_pid}` at `150-01-PLAN-REV1.md:447`. tmux defines `#{pid}` as the server PID and has no `session_pid` format. Consequently, the comparison either fails against correctly recorded evidence or silently omits the required server PID. Replace it with `#{pid}` in evidence collection and live comparison. [Official tmux FORMATS table](https://man.openbsd.org/tmux#FORMATS)
FINDINGS_DETAIL: [FIXED C3] Both trust probes capture a pre-dispatch byte offset and UTC start, check Codex/SSH exit status, and parse only newly appended ledger bytes.
FINDINGS_DETAIL: [FIXED C4] All nine global installer targets are declared, snapshotted, restored, and covered by complete-manifest recovery tests, including absent-before targets and failed-candidate retention.
FINDINGS_DETAIL: [FIXED W1] Local installation, hook merge, audit, smoke, and self-test are ordered before publication, with explicit forward-only post-publication failure handling.
FINDINGS_DETAIL: [FIXED W2] The full pre-install path set is compared against the post-install manifest, and every pre-install extra regular file is checksum-verified.
FINDINGS_DETAIL: [FIXED W3] The devcp canonical-source origin guard precedes the preparation script’s fetch and merge.
FINDINGS_DETAIL: [FIXED W4] The Source Audit cites `150-VTP-ENRICHMENT.md:13-18` and `doc:daadab474432`.
FINDINGS_DETAIL: [CRITICAL C5] T150-05 switches into `C:\Users\jack.berrow\GSDedits` and runs the newly introduced `self-test.cjs` there before publication, while publication occurs through a detached worktree and no step advances that local master worktree to `$p150FeatureSha`. The new file therefore need not exist there, making the pre-publication gate and AC-150b local verification fail; local MCP provenance may also remain on the old source. Add a guarded, operator-coordinated fast-forward of that worktree before local installation/verification, or run the new tools from the feature source and explicitly fast-forward and SHA-verify the local canonical source before T150-06.
