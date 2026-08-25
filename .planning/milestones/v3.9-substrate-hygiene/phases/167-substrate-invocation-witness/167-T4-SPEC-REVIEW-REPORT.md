FINDINGS: 3
CRITICAL: 1
WARNINGS: 2
PASS_RATE: 7/8
ONE_LINER: Same-project enforcement is fail-closed, but a user-scoped broker can authorize an unguarded second project using another project's readiness.
VERDICT: FAIL
REQUIRED_CHANGES:

1. CRITICAL: `audit.cjs` binds every broker definition, including user scope, to
   the installing project, while grant-bearing agents are global. In project B, a
   user broker bound to guarded project A checks A's hooks; B's absent hooks are
   never consulted, so `tools/list` exposes substrate and `tools/call` forwards.
   Prompt acceptance fails only afterward, which is the original defect. Make
   broker authority invocation-project-bound and add a user-only-upstream,
   two-project denial test.
2. `isBrokerDefinition` checks command and args but ignores extra `env`, `cwd`,
   `type`, URL, or header fields. Such broker drift audits as current. Require an
   exact or allowlisted definition and add mutation tests.
3. With mixed valid-stdio and unsupported direct scopes, `audit.cjs:638-642`
   deletes every direct definition before archiving any. Preserve supported
   originals privately or roll back while remaining raw-free.

Same-project refusal is real: audit exits 2; mandatory installer repair failures
return nonzero; broker listing filters the tool and forced calls return `isError`
before upstream forwarding. Grant ordering, four-agent withdrawal, managed-ID
dedupe and idempotence, module exports, ordered basename check, 31-occurrence
P166 inventory (five before, five after), seven-file scope, frozen blobs, and the
honesty bound all pass. Local static checks passed; fixture and Bash runs
reproduced sandbox `EPERM`.

<!-- Reviewed cumulative T4 diff 386d027 to a5e1f97. Salvaged from
     codex-live-output.txt. 263,328 tokens. -->
