# Original v1.9 Knowledge + Memory Governance — Phases 41-45

**SUPERSEDED 2026-04-27** — replaced by SGSD-Research as new v1.9.
Verbatim extract from `.planning/ROADMAP-AGENT.md` lines 456-540 prior
to supersession. See `README.md` in this directory for supersession
rationale and coverage analysis.

---

## Milestone v1.9 — Knowledge Relevance + Memory Governance

**Phases**: 41, 42, 43, 44, 45
**Audit warning**: VTP integration already exists. v1.9 generalizes — does
not rewrite vtp-enrichment-gate.cjs.
**Dependencies**: 41 → {42 ∥ 43 ∥ 44 ∥ 45}
**Locked decisions**: 41=C (full discussion), 42=C, 43=A, 44=A, 45=B

### Phase 41 — Knowledge Provider Registry + Fallback Chain

**Goal**: `knowledge-providers.yaml` registry + dispatch shim
(`getProvider(name).query(q)`) + fallback chain.
**Locked**: 41.1–41.3
**Inputs**: vtp-enrichment-gate.cjs, sgsd-memory tree, sgsd-recall.sh,
config.json knowledge block
**Outputs**:
- New: `super-gsd/registry/knowledge-providers.yaml`
- New: `super-gsd/scripts/lib/knowledge-provider-shim.cjs` (with fallback chain logic + `fallback: false` opt-out)
- Edit: at least one consumer (vtp-enrichment-gate.cjs OR sgsd-recall.sh) to route through shim
- 41-* artifacts
**Acceptance**:
- Shim resolves `vtp-mcp` to existing VTP path; resolves `sgsd-memory` to existing recall path
- Test: `getProvider('vtp-mcp').query('test', { simulateUnavailable: true })` falls through to `sgsd-memory`
- Test: `getProvider('vtp-mcp', { fallback: false }).query(q)` does NOT fall through
- Test: `noisy_hit` triggers narrow-query retry once before fallback

### Phase 42 — Relevance Scoring + Citation Theater Detector

**Goal**: Citation row schema (relevance + decision_impact). Filter for
planner. Detector flags when actionable_ratio < 0.3 across ≥5 rows.
**Locked**: 42=C
**Outputs**:
- Edit: VTP enrichment artifacts to include `relevance` + `decision_impact` per citation row
- New: `super-gsd/scripts/lib/citation-relevance.cjs` (filter + theater detector)
- Edit: planner brv overlay to use `filterCitations()`
- 42-* artifacts
**Acceptance**:
- Theater detector returns `theater: true` on a fixture with 5 rows / 1 actionable
- Filter excludes `decision_impact: non_actionable` rows by default

### Phase 43 — Typed Retrieval Failure Modes

**Goal**: 7-mode taxonomy (`empty_hit`, `noisy_hit`, `stale_hit`,
`missing_corpus`, `provider_unavailable`, `query_too_broad`, `privacy_blocked`)
+ route table. Wire into shim from Phase 41.
**Locked**: 43=A
**Outputs**:
- New: `super-gsd/templates/retrieval-failure-modes.json` (7-mode + route table)
- Edit: knowledge-provider-shim.cjs (Phase 41) to classify failures using this schema
- 43-* artifacts
**Acceptance**:
- Schema parses; route table has 7 mode→route entries
- Shim invokes correct route on each simulated failure mode (test fixture)

### Phase 44 — Memory Provenance + Retention

**Goal**: Provenance schema for new memory writes (source, confidence,
privacy, expiry, retention, related_phase, promotion_reason). Old entries
grandfathered.
**Locked**: 44=A
**Outputs**:
- New: `super-gsd/templates/memory-provenance-v1.json`
- Edit: `sgsd-curate.sh` to enforce schema on new writes (reject/warn if missing required fields)
- 44-* artifacts
**Acceptance**:
- New memory entry written by `sgsd-curate.sh` includes all required fields
- Old entries (pre-v1.9) load without errors despite missing fields

### Phase 45 — Public Fallback Corpus Policy

**Goal**: Discovery-only by default; cached summaries with operator
approval per source; `licence:` + `expires:` mandatory in cache entries.
**Locked**: 45=B
**Outputs**:
- New: `super-gsd/docs/PUBLIC-FALLBACK-CORPUS-POLICY.md`
- Edit: `sgsd-configure.ps1` to capture per-source approval + licence
- Edit: knowledge-providers.yaml `public-fallback` row schema
- 45-* artifacts
**Acceptance**:
- Cache entries without `licence:` are rejected
- New cache write requires `approved_at` operator confirmation flag
- Discovery-only mode surfaces URL without auto-fetching
