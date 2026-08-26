---
phase: "169"
slug: atomic-install-transaction
milestone: v4.0-install-contract
status: PENDING
seeded: 2026-08-25
synthesized_from: P168 phase-ATC CRITICAL, T3C dependency findings, blocker-recovery challenge REJECT
---

# P169 Atomic Install Transaction — context

## Why this phase exists

P168 delivered module delivery, the loadability smoke, honest diagnosis and the read-only
doctor, but its phase ATC holds an unresolved CRITICAL: rejection-capable repair and
registration run after publication writes project bytes. Three bounded fix rounds failed
for three different, now fully-mapped reasons, and the adversarial challenge REJECTED the
cheap fix. The remaining work is a design, not a patch.

## The circular dependency, established with citations

- P167's witness readiness validates the hook AS INSTALLED: `audit.cjs:1515` requires
  `auditClaudeSubstrateWitness(...).ready`; readiness hashes the PROJECT's witness file
  (`:858`) and reports `source_missing` pre-publication. So repair must FOLLOW
  publication.
- ATC's refuse-before-write requires repair to PRECEDE publication, because repair can
  refuse (`audit.cjs:797, 888-918, 935-937`; `install.sh:484-500, 904`).

## Why the cheap fixes are dead, do not retry them

- Checks-first (two rounds): the writers retain their own refusal paths; a manual guard
  inventory is evadable.
- Publication-last: breaks P167 readiness, verified.
- Publication-only rollback (Option A): REJECTED by challenge with evidence. The
  prepared/publishing/committed journal is process-memory only at HEAD
  (`hook-install-contract.cjs:728`). Post-publication writes span project settings,
  global settings, the shared witness key under user config, broker code, `.mcp.json`,
  `.claude/settings.local.json`, `~/.claude.json`, upstream manifest, global agent grant
  rewrites, and `.codex/hooks.json` replaced-before-verification with an unrestored
  `.bak` (`install-hooks.cjs:378`). Crash recovery is ambiguous: a next run cannot
  distinguish "committed, downstream incomplete" from "succeeded, cleanup crashed". The
  claimed smoke/policy distinction is false: `audit.cjs:888-918` writes documents before
  returning ok:false; update runs arbitrary npm lifecycle code before later refusals.

## The direction the challenge endorsed

Option B / full multi-root transaction: seal prospective bytes for every project and
profile artifact, publish exactly those digests under ONE durable journal, compare
installed bytes before deriving grants. P167 still attests the real installed witness;
digest equality proves it is the sealed candidate; mismatch withholds grants and triggers
recovery. Note what this is NOT: the reverted 1,458-line staged installer re-executed the
whole installer inside a copy and snapshotted whole user roots. The transaction journals
the enumerated artifact set, nothing else.

## The verification matrix, from the challenge, this is the spec

1. Fault injection after each write: broker copy, key provisioning, global-settings
   removal, project-settings merge.
2. Table-driven refusals: malformed, unsupported, missing, drift, and post-manifest
   document-write failure.
3. Forced Codex post-rename verification failure, `.bak` restoration asserted.
4. SIGKILL at every publication/downstream boundary, rerun, and compare project plus
   HOME/XDG plus external sentinels, across init, update, global and combined modes.

## Inherited constraints

P167 witness contract untouchable. Closure stays computed. Doctor stays read-only.
Real-install baseline: exit 0, 17 hooks, 9 modules, must hold at every commit.

## Field confirmation, 2026-08-26 (devcp, Linux)

The CRLF-canonical digest fix (54b54ff) closed the refusal end to end on the real
machine: `sgsd-update` exit 0, `witness_status: current`, `substrate_granted: true`,
`.super-gsd-version` pin written (d55123cf), doctor `Project install status: current`,
32/32 rows, exit 0. The five-cycle delivery failure that opened this milestone is
resolved and verified on a second platform.

## Minor carried into this phase's backlog: doctor freshness compares the wrong repo

On a project that vendors super-gsd but is its own git repository (Clarity), the doctor's
freshness line compares the PROJECT's HEAD against SGSD GitHub master and prints
"local repo differs" — meaningless for that layout and reads like a warning. The right
comparison for an explicit-project doctor is the canonical source clone HEAD (or the
project's `.super-gsd-version` pin) against master. Cosmetic, fold into this phase's
doctor touchpoints rather than a standalone dispatch.

## Closure blind spots, field-verified 2026-08-26 and fixed at 0c66b6c

A require-lexer has exactly three blind spots, and devcp hit all three at once:
computed requires (`path.join(__dirname,...)` into a vendored node_modules), runtime
assets (`fs.readFileSync` of a schema JSON at module load), and spawn roots (a shell hook
spawning `decision-state.cjs`). The fix: symbolic reduction follows the computed require
and delivers the resolved vendored package closure; one declared-roots list (in the
contract module, generation fails if a root is missing) covers assets and spawn roots,
whose require closures are then walked normally. Any future "hook works on the dev box,
dies in the field" report should be checked against these three categories first.

## Field confirmation 2 (devcp, 2026-08-26): live enforcement proven on Linux

At dd58adf: update exit 0, pin written, composer / decision-state /
skill-routing-registry / vtp-readiness all load from the delivered tree, no loader:1479.
The closure delivered ajv plus six vendored deps (argparse and js-yaml beyond my expected
four — computed, so the extra consumers were followed correctly).

First live proof of the whole enforcement chain on a second platform: a malformed
substrate call was denied pre-transport with the named reason
`substrate_witness_denied:invalid_v2_payload`; a conforming call was ALLOWED and spooled
an HMAC-signed `pre_allowed` witness row with payload/source/session digests and a
15-minute expiry. The PostToolUse rewrite remains unverified there only because the
upstream vtp-kb MCP returned HTTP 401 (its own auth; known Clarity-side SDK transport
regression needing an interactive /mcp reconnect per session). Once reconnected, one
conforming search closes the last link: capped result plus a `rewritten` row.

## Two minors from the report, backlog not dispatch

1. `tools/plan-schema/` is delivered as node_modules only; `validate.cjs`,
   `validate.test.cjs`, `package.json` and fixtures stay canonical-source-only. Nothing
   installed references them, but the `/sgsd-write-plan` skill documents calling
   `validate.cjs` mechanically; on machines where skills run against the project rather
   than the source clone that would 404. Decide deliberately: either the skill pins the
   canonical-source path, or `validate.cjs` joins the declared roots.
2. devcp's session banner reports `Phase: MISSING / Phase source: absent` for a
   milestone whose STATE names phase `v30-07` — the Clarity repo's own phase-token
   scheme, predates this work; a resolver tokenization question, not a delivery one.
