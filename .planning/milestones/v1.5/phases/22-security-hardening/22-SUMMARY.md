---
phase: 22
milestone: v1.5
status: complete
date: 2026-04-25
plans_shipped: 2
tasks_shipped: 4
commits: ~13
sec_items_delivered: 2
codex_invocations: 8
critical_raised: 9
critical_cleared: 9
warnings_total: 7
warnings_accepted: 7
verifier_verdict: passed
phase_atc_verdict: pass (after 7-round fix cycle)
muda_status: ran — 1 WARN inventory (non-blocking)
tags:
  - milestone:v1.5
  - category:SEC
  - dogfood:longest-codex-cycle-yet
  - sec01:lstat-walk-strict-validator
  - sec02:flock-guard-shipped
---

# Phase 22 — Security Hardening Complete

## What shipped

Hardened `super-gsd/scripts/sgsd-stop-handoff.sh` against (SEC-01) symlink redirection of audit-write paths and (SEC-02) concurrent-write races on `handoff-log.jsonl`.

**2 SEC items delivered across 2 plans, 4 tasks, ~13 commits.**

### 22-01 SEC-01 symlink-attack hardening

Defense-in-depth, layered:

1. **`canonicalize_path`** helper resolves symlinks via `readlink -f`/`realpath` with fallback chain; sets `_CANON_RESOLVED` audit flag.
2. **`_path_has_no_symlink_components` + `_assert_no_symlink_components`** — Node lstat-walk strict path validator runs BEFORE canonicalization on every raw handoff path (PLANNING_DIR/CONFIG_FILE/LOG_DIR/LOG_PATH/LOG_LOCK/CHECKPOINT/ABORT_FILE). Walks every existing path component from filesystem root to leaf, lstat each, refuses on any symlink. Bash-only fallback when Node unavailable.
3. **`_assert_contained`** — case-prefix containment check on canonicalized paths against `PLANNING_DIR_CANONICAL`. Refusals are stderr-only; no audit path is safe once containment fails.
4. **`O_NOFOLLOW`** on the audit-row append (final-component refusal).
5. **Refusal logging is stderr-only** — when path trust is compromised, every `.planning/`-derived audit path is already untrusted, so we log the refusal to stderr (ephemeral, no attack surface) and exit 0. Successful audit rows use raw revalidated paths through the secure append helper.

### 22-02 SEC-02 concurrent-write guard

`flock -x -w 5` exclusive lock around `handoff-log.lock`, then write through the secure Node O_APPEND/O_NOFOLLOW helper. `lock_fallback:true` audit field emitted when flock unavailable or times out (Node fallback). Unsafe unlocked echo path removed — when secure append is unavailable, refuse rather than corrupt.

## Phase-level ATC 7-round Codex review (longest fix cycle yet)

| Round | Event | Outcome |
|---|---|---|
| 1 | Phase-level ATC initial | Multiple CRIT — containment missing |
| 2 | CRIT-fix `d177eb0` | SEC-01 containment + SEC-02 flock fall-through |
| 3 | CRIT-fix `5652f70` | SEC-01 O_NOFOLLOW + SEC-02 lock_fallback relabel |
| 4 | CRIT-fix `428a6f5` | SEC-01 also canonicalize+contain LOG_DIR |
| 5 | CRIT-fix `f7f6581` | SEC-01 refusal audit writes to canonical PLANNING_DIR |
| 6 | CRIT-fix `f9bcc18` | SEC-01 round-5 lstat-walk strict path validator |
| 7 | CRIT-fix `9fd11f3` + `c2300f7` + `1d16693` | Stderr-only refusals + raw revalidated paths through secure helper → **0 CRIT + 0 WARN PASS** |

**Halt-on-CRIT escalation proved out 7 times** — each round Codex 5.5 + xhigh found genuinely narrower attack surfaces:
- R1 → R2: containment → O_NOFOLLOW final-component
- R3 → R4: LOG_DIR canonicalization → audit-write target redirect
- R5 → R6: lstat-walk on raw paths → ordering + intermediate-component coverage
- R7 (operator-driven fix): stderr-only refusal + secure-helper-only audit appends → clean review

Round 7 verdict: `FINDINGS: 0 / CRITICAL: 0 / WARNINGS: 0 / PASS_RATE: 100`. ONE_LINER: "Round 7 closes the audited CRIT paths: compromised symlink/containment refusals are stderr-only and successful audit rows use raw revalidated paths through the secure append helper."

## Verification verdict

`22-VERIFICATION.md` → PASS: 2/2 SEC must-haves verified (4/4 supporting truths). REQUIREMENTS.md SEC-01..02 all `[x]`.

## Phase ATC verdict (Step 6.5)

Pass after 7-round CRIT-fix cycle. 0 residual CRIT. 0 residual WARN.

## MUDA (Step 6.55) — ran

5 mechanical probes — 4 PASS + 1 WARN (`inventory`: 1 stale scratch artifact >3d, non-blocking per DLB-02). Aggregation working end-to-end.

## Codex dogfood evidence (Phase 22)

| # | Plan | Scope | Tier | Duration | Verdict |
|---|---|---|---|---|---|
| 1 | 22-01 | initial | analysis (180s) | ~120s | CRIT(s) — containment |
| 2 | 22 phase-level R1 | full diff | review (120s) | ~127s | CRITs |
| 3 | 22 phase-level R2 | fix diff | analysis | ~141s | CRITs |
| 4 | 22 phase-level R3 | fix diff | analysis | ~119s | CRITs |
| 5 | 22 phase-level R4 | fix diff | review | ~127s | CRITs |
| 6 | 22 phase-level R5 | fix diff | review | ~140s | 2C + 0W |
| 7 | 22 phase-level R6 | fix diff | custom:480 | 293.4s | **2C + 0W (operator surface)** |
| 8 | 22 phase-level R7 | fix diff (operator-shipped) | custom:480 | — | **0C + 0W PASS** |

**8 Codex invocations, ~1100s+ Phase 22 wall-clock, all 9 CRITs ultimately cleared.**

This is the longest fix cycle in v1.5 to date — security review at xhigh reasoning surfaces genuinely deep attack surfaces (refusal-path redirects, intermediate-component lstat coverage, audit-helper trust boundary). Operator-driven Round 7 fix demonstrates the human-in-loop escape valve is working: when auto-fix-on-CRIT exhausts the 3-attempt cap (we extended to 5 with "fix harder", then 6 with surface-to-operator), the operator can take over and ship the genuine architectural fix (stderr-only refusals).

## Operator decisions captured

Round 5 operator directive: **"fix harder"** — chose Node lstat-walk over `accept-and-disable`, validating the auto-advance-but-not-blindly posture established in Phase 21.

Round 6 operator directive: **"continue; do not choose accept-and-disable"** — operator manually shipped the structural Round 7 fix (commits `9fd11f3`/`c2300f7`/`1d16693`), demonstrating the right escalation pattern: orchestrator surfaces past the cap, operator architect-fixes the design, autonomous loop resumes.

## Commit range

Phase 22 plan-22-01 (`4b382a1`) → Round 7 clean review (`1d16693`) — 13+ commits across plans + 7 CRIT-fix rounds + phase artifacts.

## Next

Phase 23 — MUDA Calibration. 4 REQs (MUDAC-01..04). 3 of 4 are conceptually pre-shipped via the Codex MUDA work in v1.4 (commit `b2773a8`); Phase 23 will verify coverage + close any gaps. 2 plans planned.
