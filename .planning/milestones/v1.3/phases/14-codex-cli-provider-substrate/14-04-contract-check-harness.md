---
plan_id: 14-04
phase: 14
wave: 3
depends_on: ["14-01", "14-02", "14-03"]
deliverable: contract-check.mjs pure parser-comparator + toy-diff.patch fixture + make-fixtures.sh one-shot + Phase 14 verify.mjs invariant wiring
estimate_tokens: ~750
estimate_commits: 3
---

# Plan 14-04: contract-check harness + fixtures + verify invariant

## Scope

Ships the mechanical harness that proves both reviewer providers emit the
`code-reviewer-v1` contract cleanly. Per P2, the harness is a **pure
parser-comparator** — it does NOT dispatch Claude via `Agent()` or shell out to
`codex-exec.sh` from inside the binary. It takes TWO pre-captured report files
from disk, parses each against the 5-field contract, emits a JSON divergence
summary on stdout.

Also ships:

- `super-gsd/tools/provider-contract/fixtures/toy-diff.patch` — the ground-truth
  patch per D-14a (1 bug + 1 YAGNI + 1 nit; expected verdict `CRITICAL: 1,
  WARNINGS: 2`).
- `super-gsd/tools/provider-contract/make-fixtures.sh` — a one-shot capture
  script (operator or CI runs it once) that dispatches Claude via an Agent()
  slash-command OR uses a committed canned report, and runs Codex via
  `codex-exec.sh`, writing the two report files to `fixtures/`. The committed
  fixture reports become the stable input to `contract-check.mjs` so the
  harness runs deterministically without credentials.
- Phase 14's `verify.mjs` invariant that runs `contract-check.mjs` against the
  committed fixture reports and asserts exit 0 (with the dual-CLI-absent
  exit-2 soft-fail escape hatch from D-17).

## Deviation from CONTEXT (P2 — must be surfaced at plan review)

### P2 — Pure parser, not dispatcher-parser hybrid

**D-14/D-15** describes the harness as dispatching Claude via `Agent()` AND
Codex via `codex-exec.sh` from inside one binary. RESEARCH §3 R-2 proved this
impossible in practice: `Agent()` is only available inside a running Claude
Code session, not from a plain `node contract-check.mjs` invocation. The
harness *can* shell out to `codex-exec.sh`, but cannot dispatch Claude.

This plan ships the **pure-parser** shape (RESEARCH §5 14-04 Shape A):

```
node contract-check.mjs --claude-report <path> --codex-report <path>
```

Both reports are produced **outside the harness** and committed as fixtures.
The `make-fixtures.sh` one-shot handles capture — operator runs it once at
Phase-14 setup time (or whenever fixtures need refreshing), the capture walks
both providers against the toy diff, and commits the resulting report files.
`contract-check.mjs` then runs without credentials against the committed
fixtures.

This inverts D-15 steps 1-2 (capture happens *before* the harness, not inside
it). D-15's steps 3-5 (parse both against schema, assert structure, emit JSON
summary) are preserved verbatim. D-15a's "divergence is informational, not
assertive" rule also preserved — harness asserts both **parsed**, not that
findings match. D-17's dual-CLI-absent exit-2 soft-fail stays intact and moves
into `make-fixtures.sh` (harness itself no longer calls CLIs, so it can't fail
on their absence).

## Tasks

T1. **Author `super-gsd/tools/provider-contract/fixtures/toy-diff.patch`**
  - Files: `super-gsd/tools/provider-contract/fixtures/toy-diff.patch` (new)
  - Closest analog: *none* — first fixture under `super-gsd/tools/*/fixtures/` (PATTERNS D1 precedent-setter)
  - Reuse scripts: none
  - Content per D-14a: git-format patch containing:
    1. **Obvious bug**: off-by-one in a for-loop (e.g., `for (let i = 0; i <= arr.length; i++)` iterating one too far).
    2. **YAGNI**: an unused helper function (e.g., `function formatTimestamp(x) { ... }` that no caller references).
    3. **Nit**: trailing whitespace on a line.
  - Expected reviewer verdict per D-14a: `CRITICAL: 1, WARNINGS: 2`.
  - Verification: `git apply --check super-gsd/tools/provider-contract/fixtures/toy-diff.patch` exits 0 against a dummy staging repo (fixture must be apply-able; content is the ground truth both reviewers score against).

T2. **Author `super-gsd/tools/provider-contract/make-fixtures.sh`**
  - Files: `super-gsd/tools/provider-contract/make-fixtures.sh` (new, ~80 lines, `chmod +x`)
  - Closest analog: `super-gsd/scripts/sgsd-muda-audit.sh:50-311` shell wrapper shape (simpler — this is a one-shot capture, not a probe+curate loop)
  - Reuse scripts: `super-gsd/scripts/codex-exec.sh` (from plan 14-01); auth-hygiene gate from same; root-detection from `sgsd-curate.sh:101-126`
  - Flow:
    1. **Capture Codex report**: `super-gsd/scripts/codex-exec.sh --prompt-file <composed-prompt> --report-out fixtures/codex-report.txt --timeout 60`. The composed prompt bundles the reviewer instructions + the toy-diff.patch content.
    2. **Capture Claude report**: Option A — check for a committed `fixtures/claude-report.txt` and skip if present (canned-report path). Option B — if operator invokes with `--capture-claude`, emit a shell message instructing the operator to run the `sgsd-code-reviewer` agent from inside a Claude Code session and paste the output into `fixtures/claude-report.txt` (manual capture path).
    3. **D-17 soft-fail**: if Codex CLI absent, write `fixtures/codex-report.txt.MISSING` sentinel and exit 2 with diagnostic; if Claude can't be captured, write `fixtures/claude-report.txt.MISSING` sentinel and exit 2. Harness `contract-check.mjs` detects the sentinel and propagates exit 2.
  - Verification:
    - `bash -n super-gsd/tools/provider-contract/make-fixtures.sh` exits 0.
    - `make-fixtures.sh --dry-run` echoes the two capture commands and exits 0 without executing.
    - On a fully-provisioned machine, `make-fixtures.sh` produces both `fixtures/claude-report.txt` and `fixtures/codex-report.txt` with all 5 contract fields present.

T3. **Author `super-gsd/tools/provider-contract/contract-check.mjs` + commit starter fixture reports**
  - Files:
    - `super-gsd/tools/provider-contract/contract-check.mjs` (new, ~150 lines)
    - `super-gsd/tools/provider-contract/fixtures/claude-report.txt` (new — canned well-formed report matching D-14a expected verdict)
    - `super-gsd/tools/provider-contract/fixtures/codex-report.txt` (new — canned well-formed report matching D-14a expected verdict, different ONE_LINER to exercise the divergence summary path)
  - Closest analog: `super-gsd/tools/phase-verifier/phase-verifier.mjs:1-91` (shebang, ESM imports, `parseArgs`, log helpers, exit codes)
  - Reuse scripts: verbatim header block from phase-verifier.mjs lines 31-91; three-way exit vocabulary (S2); stderr-for-progress / stdout-for-machine-output (S3)
  - API:
    - CLI: `node contract-check.mjs --claude-report <path> --codex-report <path> [--schema <version>]`. `--schema` defaults to `code-reviewer-v1`.
    - Parser: hardcodes the 5 field names (`FINDINGS`, `CRITICAL`, `WARNINGS`, `PASS_RATE`, `ONE_LINER`) per RESEARCH §2f — the only authoritative source is `sgsd-orchestrate/SKILL.md:488`, no importable schema exists.
    - Validation: each report must contain all 5 fields; `CRITICAL:` and `WARNINGS:` must parse as counts; `PASS_RATE:` must parse as a percentage; total word count ≤ 300.
    - Output: JSON on stdout matching D-15 shape `{"claude":{"parsed":bool,"critical":N,"warnings":N,"one_liner":"..."},"codex":{...},"divergence":{"both_parsed":bool,"critical_match":bool,"warnings_match":bool}}`. Progress/diag on stderr.
    - Exit codes per D-14: `0` = both valid + compatible (both parsed cleanly, both advertise `code-reviewer-v1`); `1` = divergence (at least one failed to parse, or field counts diverge structurally); `2` = tool error (missing fixture file, unreadable, `.MISSING` sentinel present per T2 soft-fail).
  - Canned reports (the two `fixtures/*-report.txt` files): both contain all 5 fields, both report `CRITICAL: 1, WARNINGS: 2` per D-14a. ONE_LINER strings differ — that's D-15a's "divergence is informational, not assertive" proof-case.
  - Verification:
    - `node super-gsd/tools/provider-contract/contract-check.mjs --claude-report fixtures/claude-report.txt --codex-report fixtures/codex-report.txt` exits 0 with a JSON summary containing `both_parsed: true`.
    - Breaking a field in one report (e.g., deleting the `CRITICAL:` line) re-runs the harness → exit 1 with diagnostic on stderr identifying the missing field.
    - Missing `fixtures/claude-report.txt` → exit 2 with "tool error: fixture not found" diag.
    - `.MISSING` sentinel present → exit 2 (inherits soft-fail from T2).

T4. **Wire Phase 14 `verify.mjs` invariant for contract-check**
  - Files: `.planning/milestones/v1.3/phases/14-codex-cli-provider-substrate/verify.mjs` (new OR extended — depends on milestone-level scaffolding. Check for existing Phase 14 verify.mjs; create if absent, following Phase 12/13 pattern)
  - Closest analog: `super-gsd/tools/phase-verifier/phase-verifier.mjs:1-91` AND any prior-milestone `verify.mjs` at `.planning/milestones/v1.2/phases/*/verify.mjs`
  - Reuse scripts: phase-verifier log helpers; three-way exit vocabulary
  - Invariants wired (D-23 — all 6):
    1. `super-gsd/scripts/codex-exec.sh` exists, `chmod +x`, `bash -n` exits 0.
    2. `super-gsd/registry/review-providers.yaml` exists, parses, both providers `state: active`.
    3. `super-gsd/registry/gates.yaml` rows `per-dispatch-ATC` AND `phase-level-ATC` both have `reviewer_provider: claude-sonnet-reviewer`.
    4. `super-gsd/agents/sgsd-codex-reviewer.md` exists with required frontmatter keys. *(Also checks `sgsd-code-reviewer.md` exists per P3 resolution — sibling assertion.)*
    5. `.planning/config.json` has `review_providers.codex_enabled === false`.
    6. `node super-gsd/tools/provider-contract/contract-check.mjs --claude-report ... --codex-report ...` exits 0 on the committed fixtures. **Soft-fail**: if either fixture has the `.MISSING` sentinel (dual-CLI-absent environment per D-17), invariant passes with WARN — Phase 14 success does not require both CLIs to be locally available.
  - Verification:
    - `node .planning/milestones/v1.3/phases/14-codex-cli-provider-substrate/verify.mjs` exits 0 on a fully-provisioned machine (all 6 invariants PROVEN).
    - Deliberately break invariant 3 (remove `reviewer_provider:` from one gate row) → verify.mjs exits 1 with diagnostic naming the failing invariant.
    - On a Codex-absent machine with `codex-report.txt.MISSING` sentinel present, verify.mjs exits 0 with WARN on invariant 6 (D-17 soft-fail honoured).

## Acceptance criteria

A1. `super-gsd/tools/provider-contract/contract-check.mjs` exists, is Node ESM, hand-rolls argv parsing (no framework), uses stderr for progress and stdout for the JSON summary. **(covers D-14 structural, P2)**
A2. The harness is **pure parser** — it does NOT call `Agent()` internally and does NOT shell out to `codex-exec.sh`. Both reports are taken as `--{claude,codex}-report <path>` args. **(covers P2; supersedes literal D-15 steps 1-2)**
A3. The 5-field `code-reviewer-v1` contract (FINDINGS, CRITICAL, WARNINGS, PASS_RATE, ONE_LINER) is hardcoded inline in the harness per RESEARCH §2f. **(covers D-13, D-14)**
A4. Exit codes: `0` both-parsed-and-compatible, `1` divergence, `2` tool-error. `.MISSING` sentinel propagates exit 2 (D-17 soft-fail). **(covers D-14, D-17)**
A5. JSON summary on stdout matches the D-15 shape exactly: `{"claude":{...},"codex":{...},"divergence":{"both_parsed":bool,"critical_match":bool,"warnings_match":bool}}`. **(covers D-15, D-15a — divergence is informational)**
A6. `super-gsd/tools/provider-contract/fixtures/toy-diff.patch` exists, is git-apply-able, contains 1 bug + 1 YAGNI + 1 nit per D-14a. **(covers D-14a)**
A7. `super-gsd/tools/provider-contract/make-fixtures.sh` exists, is executable, honours D-17 soft-fail by writing `.MISSING` sentinel files when a CLI is absent. **(covers P2 capture-path; D-17)**
A8. `fixtures/claude-report.txt` and `fixtures/codex-report.txt` are committed canned reports, both report `CRITICAL: 1, WARNINGS: 2`, both parse cleanly through the harness. **(enables D-23 invariant 6)**
A9. Phase 14 `verify.mjs` runs all 6 D-23 invariants and the contract-check run exits 0 on the committed fixtures. **(covers D-23 invariant 6 AND wires invariants 1-5 from plans 14-01..14-03)**

## Non-goals

- **No live Agent() dispatch from inside the harness** — per P2/R-2, impossible. Phase 15 may revisit with a skill-based shape that runs inside Claude Code.
- **No cross-provider finding-equality assertion** — D-15a: divergence is informational. Harness asserts parse-structure compatibility only.
- **No additional invariants beyond the 6 in D-23** — planner does not add surprise invariants.
- **No CI integration** — Phase 14 ships the harness; automated CI hook-up is out of scope.
- **No schema versioning tool** — `code-reviewer-v1` is a label; `code-reviewer-v2` (hypothetical) would require the harness to accept `--schema` as a dispatch key and dispatch to per-schema parsers. v1 only for Phase 14.
- **No fixture auto-regeneration on drift** — `make-fixtures.sh` is operator-triggered, not automatic. Re-runs are intentional.

## Evidence lineage

- CONTEXT decisions covered: **D-14, D-14a, D-15 (w/ P2 deviation — steps 1-2 moved outside harness), D-15a, D-16, D-17, D-23 (all 6 invariants)**
- RESEARCH findings consumed: **§2d (phase-verifier.mjs shape), §2f (inline contract declaration site, naming-drift flag), §3 R-2 (Agent() unavailable from plain node — load-bearing for P2), §5 14-04**
- PATTERNS analogs reused: **phase-verifier.mjs:1-91 (tool shape), no prior `fixtures/` (D1 precedent-setter), S2 (three-way exit), S3 (stderr/stdout split)**
- VTP evidence: BYPASSED (Phase 14 VTP-agnostic per D-11/D-24)
