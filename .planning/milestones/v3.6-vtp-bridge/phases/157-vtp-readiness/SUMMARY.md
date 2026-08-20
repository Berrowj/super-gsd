---
phase: "157"
slug: vtp-readiness
milestone: v3.6-vtp-bridge
status: PASS-WITH-DEFERRED-4
closed: 2026-08-20
commits: ["2756fb2", "3f6610f", "dcc32d1", "94c8516", "b167ebd", "7b882b4"]
gates: {plan_review: "GO-WITH-CHANGES, AMENDMENT-1 applied", spec_reviews: "T1 scope-only, T2 fix_required then fixed, T3 in close review pass", close_review: "1 CRIT fixed, verdict then satisfied", verifier: "vtp suite 140/140 + P155 regressions 5/5 + hooks 18/19 pre-existing-A1"}
---

# P157 Summary — VTP Readiness

## What shipped

1. T1 — `super-gsd/registry/vtp-services.yaml` (names-only topology: six env NAMES,
   vtp-kb + jcl-internal/jcl-products/qmd, canonical ~/.vtp/ vs kb-data mirror,
   pins, ingest.lock single-writer) + strict loader rejecting value-carrying fields
   without echoing them. Red-then-green 39/39.
2. T2 — `super-gsd/tools/vtp-readiness/run.cjs`: dist-vs-src freshness (WARN
   "reconnect MCP", realpath-contained against symlink/junction ancestors), Qdrant
   bounded TCP, evidence-store presence; wired into automatic Rule 0 AND manual
   consult (review change 7); AMENDMENT-1 path redaction in manual output and every
   appended row.
3. T3 — SessionStart hook `sgsd-vtp-pending.js`: count-only pending-ledger depth,
   silent fail-open, no network/process imports; overlay-registered, real-installer
   activation proven (honest-red division of labour documented).
4. Close-fix — manual readiness consults VTP BEFORE the freshness short-circuit;
   three probe rows travel with fresh and stale manifests; full-sequence falsifier.

## Deferred (recorded, not relitigated)

1. UNC evidence-store targets may touch SMB/DNS on existence checks (close-review WARN).
2. Manual evidence row labels say "phase close" where readiness would be clearer.
3. Oversized transient close-review dump kept as evidence; trim on distill.
4. Pre-existing hooks self-test A1 (tokenWasteCheck(null) ok:true on HEAD).

## Downstream contract

Unattended runs probe VTP topology on both readiness surfaces in minutes; the
SessionStart hook surfaces backlog depth; P159 T4 layer-routing consumes
vtp-services.yaml server names.
