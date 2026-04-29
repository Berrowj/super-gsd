---
phase: 61
name: Public Docs Refresh
milestone: v2.1
type: research
researched_at: 2026-04-29
researcher: gsd-executor (compressed-phase dispatch)
---

# Phase 61 Research - Public Docs Refresh

## Goal

Surgical README.md extension that:

1. PREPENDS a "What This Repo Is For" preamble distinguishing
   operator-build (this repo; you, the SGSD developer / operator)
   from end-user-install (someone using SGSD on their own
   project) so first-time readers route themselves to the right
   path immediately.
2. SWEEPS VTP mentions: every appearance is marked optional with
   a rationale. Phase 48 selective-VTP-bridge ships VTP as a
   route-gated whitelist (4 entries; 3 active + 1 reserved) and
   Phase 52 redis-adapter ships VTP-free as the canonical
   context-cache path, so the "VTP is optional" framing is the
   accurate one. The acceptance grep is closed-vocab on
   'required' / 'must' (Lock 11).
3. ADDS a Quick Start step 5 with the live `sg` shortcut block
   (Install-SgsdShortcut.ps1 + sgsd / sg flag matrix) plus the
   bash fallback (sgsd-boot.sh --skip-preflight). Both code
   blocks were tested live on 2026-04-29; raw stdout captures
   live in 61-VERIFICATION.md.
4. LINKS the Phase 60 EXAMPLE-DEMO-WALKTHROUGH.md (11 steps,
   every command tested live) and the existing
   SGSD-BOOT-STARTUP-GUIDE.md from inside the Quick Start block
   so an operator can self-bootstrap without external context.

## Locked Decision: 61=C

Surgical extension only - preamble + VTP-optional sweep + sg
quick-start. No new sub-page documents. No HTML rebuild. The
existing USER-GUIDE.html and ARCHITECTURE.html files are NOT
touched (Lock 4: out-of-scope for Phase 61). The acceptance is
README.md-bounded and the milestone-close gate's closed-vocab
grep is README.md-bounded.

## Prior Art Surveyed

### Phase 48 selective-VTP-bridge (rationale anchor for "VTP is optional")

`super-gsd/tools/vtp-bridge/route.cjs` and the verified
observable truths (.planning/milestones/v1.9/phases/
48-selective-vtp-bridge/48-VERIFICATION.md):

- A1: Local-impl phases NEVER call VTP. The bridge returns
  `{ok:false, reason_codes:['not_routed_to_vtp']}` for any
  uncertainty_type not in the whitelist. No MCP call attempted.
- A2: 4-entry frozen VTP_TOOL_MAP (3 active + 1 reserved):
  architecture_challenge, book_lookup, prior_memory_lookup,
  research_external_validation. Object.isFrozen=true.
- A3: MCP failures logged separately to vtp-bridge-failures.jsonl
  (NOT mixed into route-decisions.jsonl).
- A4: Packets compact (5000-token cap) + source-backed (mandatory
  source_refs).

This means the framework BUILDS WITHOUT VTP. VTP is opt-in for
research / book / prior-project / architecture-challenge
phases that need external validation. Local implementation
phases ALWAYS resolve via ByteRover.

### Phase 52 redis-live-cache-adapter (rationale anchor for "VTP-free canonical path")

The redis-adapter ships VTP-free as the canonical context-cache
path. The v1.9 dual-gate verifies adapter selfTest exit 0 with
26/26 assertions including the F1/F16 frozen post-T6 invariant
and the lazy-require-isolated F17 path - none of which depend on
VTP being live.

### Phase 58/59/60 v2.1 gate insertions (Lock 4 anchor)

The v2.1 first-gate (Phase 58 installer-audit), second-gate
(Phase 59 wizard), and third-gate (Phase 60 example-walkthrough)
are all surgical insertions inside the milestone==='v2.1'
branch of sgsd-complete-milestone.cjs. Phase 61 follows the
same pattern: the fourth-gate (docs-refresh) inserts between
the third-gate green emission (post-Phase-60 byte 478) and the
original process.exit(0) at byte 479. Bytes 1-478 are
byte-equality preserved.

### Phase 60 EXAMPLE-DEMO-WALKTHROUGH.md (cross-link target)

`super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md` ships 11 steps
covering verify / first-run / inspect / re-run / sha256 /
dry-run / self-test / orchestrate-degraded / cleanup /
milestone-close. Every step was tested end-to-end on 2026-04-29.
Phase 61 adds a single inline link in Quick Start step 5; no
content edit on the walkthrough itself.

### Existing SGSD-BOOT-STARTUP-GUIDE.md

Pre-existing operator-facing doc in super-gsd/docs/. Phase 61
links it inline from Quick Start step 5 so the `sg` flag matrix
is one click away.

## Architecture

```
README.md (SURGICAL extension; preserve existing content)
  PREPEND
    ## What This Repo Is For
      operator-build vs end-user-install paragraph + cross-link
      to Operator Build Workflow

  EXTEND Quick Start
    ### 5. (Optional) Install the `sg` shortcut
      powershell Install-SgsdShortcut.ps1 + sg/sgsd flag block
      bash fallback sgsd-boot.sh --skip-preflight (live-tested)
      link EXAMPLE-DEMO-WALKTHROUGH.md
      link SGSD-BOOT-STARTUP-GUIDE.md

  EXTEND Starting the Cockpit
    SGSD3 dashboard description: VTP/MCP projection panel
      marked optional + Phase 48 / Phase 52 rationale

  ADD Optional Add-Ons section (between Cockpit and Built With)
    table: VTP/MCP bridge | Redis live cache | Codex panel
    each marked optional + when-to-enable + default-without

  ADD Operator Build Workflow section
    milestone-close gates (v1.9 / v2.0 / v2.1)
    example fixture exercise
    installer-audit + wizard self-tests

super-gsd/scripts/sgsd-complete-milestone.cjs (SURGICAL +99)
  v2.1 fourth-gate insertion at byte 479 (between Phase 60
  third-gate green emission and original process.exit(0));
  closed-vocab regex on README.md for vtp.*required|must;
  Lock 13 README-missing path emits SKIPPED sentinel + exit 0;
  bytes 1-478 byte-untouched.
```

## Lock invariants honored

- **Lock 4**: Phase 41-60 trees byte-untouched. README.md edit
  is +78 / -1 (the -1 is one em-dash to ASCII swap on a NEW
  line I authored). sgsd-complete-milestone.cjs edit is +99 / 0.
  All other Phase 41-60 source unchanged.
- **Lock 11**: Closed-vocab grep. The fourth-gate regex is
  `/vtp[^\n]*(required|must)/i` - no fuzzy matching, no
  semantic interpretation. The acceptance grep is identical:
  `grep -ic 'vtp.*required\|vtp.*must' README.md` returns 0.
- **Lock 13**: README missing -> docs-gate emits SKIPPED
  sentinel + exits 0. Lock 13 was statically verified by
  inspection of the post-insertion code (lines 480-505 of the
  post-Phase-61 file); future negative-path testing can
  spawnSync the gate against a tmpdir as `__dirname` substitute.
- **ASCII-only**: All NEW lines authored by Phase 61 have
  first_nonascii_idx=-1. Pre-existing baseline content (e.g.,
  inline em-dashes carried over from v1.0 README, the
  box-drawing diagram in How The Loop Works, the cent sign in
  Three Brains table) is byte-untouched per Lock 4.

## Files touched

| File                                                   | Lines | Direction |
| ------------------------------------------------------ | ----- | --------- |
| README.md (delta)                                      | +78/-1| SURGICAL  |
| super-gsd/scripts/sgsd-complete-milestone.cjs (delta)  | +99/0 | SURGICAL  |
| .planning/milestones/v2.1/phases/61-*/                 | -     | NEW       |

## Idempotency + observation-only properties

The fourth-gate is observation-only: it reads README.md
(fs.readFileSync, no write), runs the regex (in-proc), and
writes a status line to stdout. README.md is never mutated by
the gate. Repeated invocations of `--milestone v2.1` produce
identical observable output.

## Lock 13 / docs-gate-degrades-gracefully

If `README.md` is absent at repo root (partial checkout, sparse
clone, manual delete), the gate emits a SKIPPED sentinel and
exits 0. Rationale: the absence of the README is a
checkout-shape problem, not a milestone-close problem; the gate
exists to catch VTP-vocab regressions in the public docs, and
if the README is missing there is no public-docs surface to
regress against.

The skipped path is observable in stdout:

```
milestone_close_gate: v2.1 docs-refresh check SKIPPED
  (README.md not present at repo root; partial checkout
   suspected; degrading to third-gate only per Lock 13)
milestone_close_gate: v2.1 fourth-gate (docs-refresh)
  green-with-skip
```

Operators on full checkouts always exercise the full
quad-gate; operators on sparse clones get a degraded-OK signal.
