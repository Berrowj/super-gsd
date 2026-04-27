---
phase: 44-legal-context-registry
verified: 2026-04-27T00:00:00Z
status: passed
score: 7/7 acceptance assertions verified
verifier: gsd-verifier (audit pass)
verdict: PASS
---

# Phase 44 Verifier Audit — Legal Context Registry

**Phase goal:** Generate + validate known milestone/phase/gate/agent/artifact/provider/status keys so packet builder (Phase 45) and cockpit consume a registry instead of trusting free-form references.

**Audit verdict:** PASS

## Acceptance assertions

| # | Assertion | Result | Evidence |
|---|-----------|--------|----------|
| A1 | 8 categories present + populated | PASS | After `--build`: milestones:9 phases:44 gates:13 agents:23 artifacts:5 providers:4 statuses:15 phase_folders:44 (+commands:13, reason_codes:31 bonus) |
| A2 | Invalid keys rejected | PASS | `validateOne('v9.9','milestones')` -> `valid:false reason:unknown_key` |
| A3 | Superseded keys explicit | PASS | `validateOne('v1.9-knowledge-memory-governance','milestones')` -> `valid:false reason:superseded_key` |
| A4 | Hash idempotent | PASS | `content_hash=b0a8024bc2b016eaca84da0d49c424f67c59c24f94ed64f8759c1d8ccc262c1d` stable across two `--build` runs (canonical sort + stripped `generated_at`) |
| A5 | Read-only on canonical sources | PASS | Phase 44 commits `a4f13eb`, `90bb6bf`, `8218280` touch ZERO bytes of `gates.yaml`/`agents.yaml`/`command-envelope-v1.yaml`/`PHASE-CAPSULE.schema.json`/`report.cjs`/`token-waste/check.cjs`/`phase-capsule/write.cjs`. Working-tree dirt on `report.cjs`+`collect.cjs` is unrelated Phase-41 in-progress work, NOT Phase-44 deliverables |
| A6 | Never throws | PASS | `validateReferences(null)`, `validateOne('garbage','invalid_category')`, `isLegal('totally_invented','phases')` all return `{valid:false}` without throw |
| A7 | 4 outcomes distinguished | PASS | active->valid:true; superseded->`reason:superseded_key`; unknown->`reason:unknown_key`; malformed registry->`reason:registry_missing\|registry_malformed` |

## Library invariants

- **Self-test:** `13 pass, 0 fail` (assertions 1-13 incl. read-only invariant on 19 canonical sources)
- **Import-by-reference:** ZERO local redefinitions of `ROLES`/`STATUSES`/`PROVIDERS`/`VERDICTS`/`ROUTE_REASONS`/`STATUS_VOCAB`/`BYPASS_KIND_VOCAB`/`CAPSULE_FILE_KINDS`/`BLOAT_THRESHOLDS` in build.cjs/check.cjs. All sourced via `require('../token-attribution/report.cjs')`, `require('../token-waste/check.cjs')`, `require('../phase-capsule/write.cjs')` — confirmed at build.cjs:57,65,254,581 and check.cjs:30
- **44 capsules validated:** `total_capsules:44 total_valid:44 total_invalid:0 total_invalid_keys:0` per executor's 44-VERIFICATION.md backfill
- **CLI contract:** `--check` exits 0 on both valid and invalid input (informational; enforcement at packet-builder boundary per design)

## Goal achievement

The registry exists, populates 8+2 categories from 13 canonical sources, distinguishes 4 outcomes (active / superseded-replaced / superseded-retired / unknown), refuses to throw on adversarial input, and produces a stable content_hash across runs. Packet builder (Phase 45) and cockpit can now consume `legal-keys.json` to reject invented references at the packet boundary — the v1.9 intent.

## Anti-patterns found

None within Phase 44 scope.

**Out-of-scope note:** `super-gsd/tools/token-attribution/{collect,report}.cjs` carry +203/-12 LOC of unstaged enrichment (adds `agent_id`, `source_file_kind`, `deriveRole`). These are NOT Phase-44 deliverables — last touched in Phase 41 and never committed. Operator should decide whether to commit, stash, or revert before Phase 45 begins.

## One-liner

Legal context registry library + JSON + 13-source build + 4-outcome validator land green; 13/13 self-test, 44/44 capsules valid, content-hash idempotent, never-throws confirmed; A5 read-only invariant intact for Phase-44 commits — verdict PASS.
