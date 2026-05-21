---
phase: 117
phase_name: Chronicle Storage Adapter (VTP-first / local-fallback)
milestone: v3.1
created: 2026-05-21
status: queued-planning-only
implementation_status: not-started
source: DLB-11.5 — Operator Chronicle Layer; fifth phase
predecessor: v3.1 P116 PASS @ 0553a00 (chronicle validator binding gate shipped)
---

# Phase 117 — Chronicle Storage Adapter (VTP-first / local-fallback)

> Routes validated chronicle outputs to durable storage. VTP-MCP first if available; local-only fallback always safe. Per DLB-11 R5: stores CMB references by-ID, never full bodies (mesh ledger remains single source of truth). Index ledger enables future retrieval (P119 roadmap miner).

## Goal

Ship `publish.cjs` + storage logic + index ledger format + self-test extension. After this phase, a validated chronicle from P115 (rendered HTML) + P114 (CONTEXT.json) + manifest (P113 schema) can be PUBLISHED — landing in VTP-MCP if available, or in `.planning/chronicles/{milestone}/P{NN}/` otherwise — with an entry appended to `.planning/chronicles/INDEX.jsonl` for future retrieval.

## Binding invariants (from DLB-11 R5 + storage routing rules)

1. **VTP-first / local-fallback (NEVER blocks).** Probe VTP-MCP availability; if reachable, upsert; otherwise route to local. Chronicle publication is NEVER blocked on VTP availability. Local is always safe.
2. **CMB references stored by-ID, never full bodies.** The chronicle JSON / manifest stored MUST NOT replicate mesh ledger CMB bodies. Mesh ledger (`.planning/mesh/memory/cmbs.jsonl`) remains canonical truth.
3. **Index ledger is append-only.** `.planning/chronicles/INDEX.jsonl` accumulates one row per publication: `{ts, milestone_id, phase_id, chronicle_type, storage_target, location, size_bytes, validator_verdict, content_hash}`. Append-only; never rewritten in place.
4. **Atomic local writes.** Use tmp+rename pattern (write to `<path>.tmp`, then rename). Mirrors mesh-memory writer pattern.
5. **content_hash for de-duplication.** Each published chronicle gets a SHA-256 content hash computed over the canonical JSON form (sorted keys, no timestamps in body). Publishing the same chronicle twice is idempotent — second publish detects via index lookup and skips.

## Files this phase will create

| Path | Op |
|---|---|
| `super-gsd/tools/chronicle/publish.cjs` | create — main publisher (~250-400 LOC) |
| `super-gsd/tools/chronicle/storage-vtp.cjs` | create — VTP-MCP adapter (~100-150 LOC; probes availability, attempts upsert) |
| `super-gsd/tools/chronicle/storage-local.cjs` | create — local file-tree writer (~100-150 LOC) |
| `super-gsd/tools/chronicle/run-self-test.cjs` | modify — extend with SAC-P117-01..NN assertions |
| `super-gsd/tools/chronicle/fixtures/sample-publish-bundle.json` | create — input bundle: chronicle context + html + manifest |

5 file ops (4 new + 1 modify).

## publish.cjs contract

### Invocation
```
node super-gsd/tools/chronicle/publish.cjs \
  --bundle <path-to-publish-bundle.json> \
  [--storage-target vtp|local|auto] \
  [--vtp-mcp-url <url>] \
  [--local-root .planning/chronicles] \
  [--index-ledger .planning/chronicles/INDEX.jsonl]
```

`--storage-target auto` (default): probe VTP-MCP; route to local if probe fails.

### Bundle shape

```json
{
  "milestone_id": "v3.1",
  "phase_id": "117",
  "chronicle_type": "phase",
  "chronicle_context": { /* CHRONICLE-CONTEXT.json */ },
  "chronicle_html": "<!doctype html>...",
  "manifest": { /* chronicle-manifest.json */ },
  "validator_verdict": "REPORT_GROUNDED"
}
```

The bundle MUST already be validator-green (publish refuses ungrounded bundles unless `--force` is passed; even then logs deviation).

### Pipeline
1. Parse bundle; compute content_hash via canonical JSON
2. Probe index ledger for content_hash collision → if hit, return existing location (idempotent)
3. Determine storage target (probe VTP if auto; route to local on failure)
4. VTP path: invoke VTP-MCP upsert (placeholder for now — emit `VTP_TARGET_AVAILABLE: false` with reason if MCP not configured)
5. Local path: write `.planning/chronicles/{milestone}/P{phase}/chronicle-context.json` + `chronicle.html` + `manifest.json` (atomic tmp+rename); store content_hash alongside
6. Append index row: `{ts, milestone_id, phase_id, chronicle_type, storage_target, location, size_bytes, validator_verdict, content_hash}`
7. Print summary on stdout: `PUBLISHED <storage_target> <location>`

### Exit codes
- 0 — published successfully
- 1 — bundle invalid (failed schema validation against chronicle.schema.json or chronicle-manifest.schema.json)
- 2 — validator_verdict != REPORT_GROUNDED (refused; use --force to bypass)
- 3 — local write failed
- 4 — VTP target requested explicitly but unavailable (without auto-fallback)
- 5 — usage error

### Determinism
- content_hash same across runs for same bundle
- index ledger rows include UTC ISO timestamps (rotation-friendly)
- Local file content byte-identical across re-publishes

## VTP adapter contract (storage-vtp.cjs)

Exports:
- `probe(url?) → { available: boolean, reason?: string }` — best-effort: TCP/HTTP reachability check (5s timeout)
- `upsert(bundle, opts) → { ok, location, content_hash, vtp_id? }` — placeholder until VTP MCP wiring is finalised

For P117: VTP wiring is a STUB. The probe returns `{ available: false, reason: 'vtp_mcp_routing_not_yet_wired' }` by default. Operator can override via env var `SGSD_VTP_MCP_URL` to test the upsert code path. Real VTP wiring will land later (out of v3.1 scope).

This is documented as INFO deviation — P117 still ships the routing logic so when VTP wiring lands, only the stub needs replacing.

## Local adapter contract (storage-local.cjs)

Exports:
- `publish(bundle, opts) → { ok, location, paths: {context, html, manifest, content_hash} }`
- Writes 4 files atomically (tmp+rename):
  - `.planning/chronicles/{milestone}/P{phase}/chronicle-context.json`
  - `.planning/chronicles/{milestone}/P{phase}/chronicle.html`
  - `.planning/chronicles/{milestone}/P{phase}/manifest.json`
  - `.planning/chronicles/{milestone}/P{phase}/content-hash.txt`

Phase folder created if absent (`mkdir -p` equivalent).

## Index ledger format (`.planning/chronicles/INDEX.jsonl`)

One JSON object per line:
```json
{
  "ts": "2026-05-21T15:30:00.000Z",
  "milestone_id": "v3.1",
  "phase_id": "117",
  "chronicle_type": "phase",
  "storage_target": "local",
  "location": ".planning/chronicles/v3.1/P117/",
  "size_bytes": 12345,
  "validator_verdict": "REPORT_GROUNDED",
  "content_hash": "sha256-...",
  "published_by": "publish.cjs"
}
```

Index is append-only. Consumers (P119 roadmap miner, future cockpit) tail it for fast lookup.

## Semantic acceptance criteria (target — 117-01 PLAN declares verbatim)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P117-01
    input: "valid bundle (REPORT_GROUNDED) + --storage-target local"
    expected_outcome: "publishes to .planning/chronicles/<milestone>/P<phase>/; writes 4 files; appends index row"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-01"

  - id: SAC-P117-02
    input: "same valid bundle twice"
    expected_outcome: "second publish detects content_hash collision in index; returns existing location; no new index row"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-02"

  - id: SAC-P117-03
    input: "bundle with validator_verdict: REPORT_UNGROUNDED"
    expected_outcome: "publish refuses (exit 2); no files written; no index row"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-03"

  - id: SAC-P117-04
    input: "--storage-target auto + VTP unavailable"
    expected_outcome: "falls back to local with explicit reason logged in index row"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-04"

  - id: SAC-P117-05
    input: "--storage-target vtp explicit + VTP unavailable + no --force-local"
    expected_outcome: "publish fails (exit 4); no local fallback; reason in stderr"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-05"

  - id: SAC-P117-06
    input: "bundle with citation: cmb-from-mesh-ledger"
    expected_outcome: "published chronicle context contains string ID 'cmb-from-mesh-ledger', NOT a full CMB body object"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-06"

  - id: SAC-P117-07
    input: "bundle with schema-invalid context"
    expected_outcome: "publish refuses (exit 1); reason cites CHRONICLE-NN error code"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-07"

  - id: SAC-P117-08
    input: "publish.cjs + valid bundle → check .planning/chronicles/INDEX.jsonl after"
    expected_outcome: "index ledger has exactly one new row with all required fields"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-08"

  - id: SAC-P117-09
    input: "two different bundles for same phase"
    expected_outcome: "each gets its own content_hash; both index rows present; later publish doesn't overwrite earlier files (separate hash-derived subpath OR explicit re-publish suffix)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-09"

  - id: SAC-P117-10
    input: "publish run with deliberately-empty local directory"
    expected_outcome: "publish creates .planning/chronicles/<milestone>/P<phase>/ directory tree as needed"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-10"

  - id: SAC-P117-11
    input: "full self-test"
    expected_outcome: "all assertions green (10 SAC-P117 + 56 prior P114+P115+P116 + STRUCT)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"
```

11 SACs. Self-test adds STRUCT for: tmp+rename atomicity, content_hash determinism, index row schema validation.

## Out of scope

- Cockpit integration (P118)
- Milestone-level chronicle + roadmap miner (P119)
- Real VTP-MCP upsert wiring (deferred; stub in place)
- Modifying P113-P116 substrate
- Dogfood publishing v3.1 phase chronicles (will fire at P119 milestone close)

## Cross-references

- `.planning/decisions/DLB-11-CHRONICLE-LAYER.md` — R5 by-reference + storage routing
- `.planning/milestones/v3.1/ROADMAP.md` — Non-Negotiable Rule 12 (CMB by-reference storage)
- `.planning/milestones/v3.1/MILESTONE-READINESS.md` — P117 DEGRADED-PATH for VTP-MCP (always safe via local fallback)
- `super-gsd/tools/chronicle/validate-chronicle.cjs` (P116) — must run green before publish
- `super-gsd/tools/mesh-memory/cmb-hash.cjs` (v3.0) — pattern reference for canonical hashing
- `super-gsd/tools/mesh-memory/execution-receipt.cjs` (v3.0) — pattern reference for atomic tmp+rename
