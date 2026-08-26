# Field failure on Linux: the closure misses computed requires, runtime assets and spawn
# roots, and a laundered deny defeated the loadability smoke. Patch mode, ONE diff, 3 files.

## Evidence from a real Linux project (devcp), verified — do not re-derive

1. `vtp-context-composer.cjs:33`:
   `const Ajv = require(path.join(__dirname,'..','..','tools','plan-schema','node_modules','ajv'))`
   The project's `super-gsd/tools/` has no `plan-schema/`; manifest has ZERO plan-schema
   rows. On Linux: `MODULE_NOT_FOUND ... tools/plan-schema/node_modules/ajv`. (On Windows
   it was masked by a hoisted home-dir ajv.) Composer also reads
   `schemas/vtp-mcp-input-schemas.v2.json` at load (`:38`, `:92`) — also undelivered.
2. `sgsd-substrate-invocation-witness.cjs:269-270` wraps loadProjectRuntime in
   `try { } catch (_)`, discarding the real error; every substrate call becomes
   `substrate_witness_denied:project_runtime_unavailable`. Fail-closed (good) but
   undiagnosable, and:
3. The install smoke sent an MCP payload to the witness hook, got that deny, and the
   policy-decision classifier ACCEPTED it as a clean decision — so the install reported
   loadable hooks over a runtime that cannot load. The doctor likewise says 32/32 current.
4. `gsd-session-state.sh:17-33` spawns `scripts/lib/decision-state.cjs`, which requires
   `../../tools/state-resolver/resolve.cjs` — undelivered, so every session start logs
   `resolver unavailable ... loader:1479`.

## The work

**A. Closure (hook-install-contract.cjs).**
1. Extend symbolic reduction so the composer's `__dirname`-rooted `path.join` require
   resolves. When a resolved require lands inside a repo-vendored `node_modules`, deliver
   that PACKAGE'S closure: the resolved package root plus its transitive package
   dependencies resolved from the vendored directory. COMPUTED from resolution, no
   hardcoded package names, and never a whole-tree copy (the vendored tree is 29MB/2531
   files; the ajv closure is a small fraction).
2. Add ONE declared-roots list in this module (single authority, small, commented):
   runtime assets and spawn roots that lexing cannot see. Seed it with exactly:
   `schemas/vtp-mcp-input-schemas.v2.json` (asset) and `scripts/lib/decision-state.cjs`
   (spawn root, walk its require closure like any hook). Every declared root must exist
   at generation time or generation fails naming it. The manifest is generated from this
   as from everything else.

**B. Witness hook.** Keep fail-closed deny, but carry the underlying error: bounded
one-line message plus code (MODULE_NOT_FOUND etc.), sanitized, in the deny detail. Never
the raw result. NOTE: this file's bytes change, so the orchestrator will regenerate
sgsd_source_sha256 pins and the manifest afterwards — do not touch config files yourself.

**C. Loadability classifier (hook-registration-preflight.cjs).** A deny whose reason is
`project_runtime_unavailable` OR whose carried underlying error is a module-resolution
failure is a LOAD FAILURE, not a clean policy decision. The smoke must fail the install
naming the module. Genuine policy denies (payload rejected by a loaded runtime) remain
accepted.

## Constraints

Bounded diffs; no staging machinery; P167 contract otherwise untouchable (PreToolUse
stays fail-closed, PostToolUse bounded replacement, store rewritten-only). Never weaken
an assertion. Fixture paths contain SPACES.

Report: mechanism per file, and the computed ajv-closure package list you expect, max
200 words.
