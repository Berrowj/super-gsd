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
