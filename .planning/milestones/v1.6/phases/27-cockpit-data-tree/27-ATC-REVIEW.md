# Phase 27 ATC Review

## Reviewer
- Provider: claude-sonnet-reviewer
- Tier: phase-level
- Verdict: warn
- Critical: 0
- Warning: 2
- Pass rate: 9/10

## Findings (CRIT / WARN / NIT)

### CRIT: none

### WARN

**W1 — RESEARCH REQ-27-TREE node count (8) contradicts shipped PLAN (9)**

`27-RESEARCH.md` REQ-27-TREE declares 8 stable node-id formats; the locked
PLAN ships 9 (`unlock` promoted to first-class). Promotion is justified by
Phase 26 §Q3 obligation and locked in PLAN §Open Derivation Calls item 1.
RESEARCH requirements table is now a normative mismatch.

**Severity:** WARN (non-blocking; PLAN is authoritative)
**Remedy:** Annotate RESEARCH REQ-27-TREE row as "(superseded: 9 nodes —
see PLAN §Open Derivation Calls item 1)". **Applied in-loop.**

**W2 — RESEARCH §Phase 28 executor spec complex fallback silently dropped in PLAN**

RESEARCH includes a third stamper fallback (scan `progress.phase_NN` keys).
PLAN reference impl correctly simplifies to env-var → anchored-frontmatter
→ null. Simplification is the right call (the complex fallback reintroduces
the parsing surface area that caused the original bug) but the divergence
is unexplained — Phase 28 executors reading RESEARCH first encounter a
more complex spec than PLAN mandates.

**Severity:** WARN (non-blocking; PLAN authoritative; risk is over-implementation)
**Remedy:** Add 1-sentence note in PLAN §Stamping Spec rule 1.b explaining
the rejected complex fallback. **Applied in-loop.**

### NIT

**N1 — Artifact node ID format inconsistency (RESEARCH vs PLAN)**

RESEARCH example `R:v1.6:27:PLAN-01` vs PLAN example `R:v1.6:27:PLAN:01`. PLAN authoritative; cosmetic only.

**N2 — `codex-live.json.phase` lag pitfall absent from PLAN §Cockpit Derivation Rules**

RESEARCH Pitfall 3 documents Q6 must NOT use `codex-live.json.phase` for
phase scoping (it lags transitions). Pitfall is only in RESEARCH — Phase 28
executor reading only PLAN could introduce a stale-state bug. Recommend
copying the pitfall to PLAN derivation rules. NIT, not WARN, because
Phase 28 is supposed to read both files.

## ATC Checklist (LITE tier)

### 7-step compressed

| Step | Result | Notes |
|------|--------|-------|
| 1 First Principles | PASS | Phase 28 needs spec to patch sgsd-activity-logger.js |
| 2 Delete | PASS | New contract; deletion target N/A for net-new |
| 3 Simplify | PASS | Tabular matrix; numbered rules; paste-ready impl |
| 4 Validate | PASS | §Stamping Spec self-contained; broken code shown + reference impl + acceptance |
| 4b Phase 26 citation chain | PASS | "Cited, not redefined" |
| 5 Automate | N/A | Docs phase |
| 6 Gate (DISCUSS 27.1 honored) | PASS | cockpit-state.json appears only as prohibition (8 occurrences) |
| 7 Anti-slop 10-point | 9/10 | N2 imperfect (pitfall absent from PLAN) |

### 10-point anti-slop summary

9/10. The single fail is N2 (Pitfall 3 absent from PLAN derivation rules — inverse-YAGNI; missing safety knowledge in the authoritative spec).

## Codex Reviewer (degraded path)

Per MILESTONE-READINESS DEGRADED-PATH: codex-exec.sh --self-test exit 11
(auth FAIL). Codex side of dual-provider review **unreachable**. Per Patch
4 Live-or-Local rule: status downgrades, CRIT-BACKLOG row appended, run
continues.

- Provider: codex-cli-reviewer
- Status: provider_unavailable
- Backlog: `kind=verifier_fail`, `summary=live Codex auth unavailable; fallback used`

## One-liner

Phase 27 data contract is Phase-28-executable; 2 non-blocking WARNs (RESEARCH/PLAN node-count stale, complex fallback silently dropped) fixed in-loop with annotations. Codex unavailable per readiness; deferred.
