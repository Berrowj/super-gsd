---
phase: 43
phase_name: Phase Capsule Contract
milestone: v1.9
researched: 2026-04-27
domain: Phase capsule schema + writer + backfill + phase-close integration
confidence: HIGH
controlling_principle: Canonical = .planning + git. Capsule = projection.
mirror_template: Phase 41 report.cjs (envelope-v1 emitter shape) + Phase 40 audit.cjs (read-only walker)
upstream: Phase 41 (commit-attribution provenance), Phase 36 (envelope-v1 lib pattern), audit:424-517 (capsule design source)
downstream: Phase 45 PACKET-03 (capsule-first packet build), Phase 46 INDEX-02 (FTS over capsules), Phase 51 BENCH-04 (researcher token reduction proof)
---

# Phase 43 - Phase Capsule Contract - Research

## 1. Goal Restatement + Acceptance Mapping

Phase 43 makes completed phases consumable WITHOUT re-scanning folders. It
defines `PHASE-CAPSULE.json`, ships `phase-capsule/write.cjs`, wires capsule
write at phase-close, and backfills 17 capsules covering v1.6 (5) + v1.7 (5)
+ v1.8 (5) + v1.9-already-shipped (P41, P42 = 2). Phase 43 itself emits its
own capsule at close.

**Mass-discuss row 43 lock (verbatim, line 238):** "Compress prior-phase
context; canonical = .planning + git, capsule = projection". The capsule is
NEVER source of truth; deleting all PHASE-CAPSULE.json files and rebuilding
from `.planning + git` MUST yield byte-equivalent (or hash-equivalent)
output. If the rebuild is non-deterministic, the capsule has accreted truth
the canonical streams cannot regenerate -- an architectural defect.

### 1.1 ROADMAP sec.43 acceptance (lines 96-112, verbatim)

| # | Acceptance | Phase 43 binding |
|---|------------|------------------|
| A1 | capsules include goal, status, evidence, files, decisions, debt, downstream contract, source commits, source hashes | sec.4 schema (12 fields locked) |
| A2 | critical bypass entries remain linked raw, not summarized away | sec.6 raw-link policy + sec.10 self-test fixture #4 |
| A3 | deleting generated capsules and rebuilding yields equivalent content hashes | sec.5 hash + idempotency design + sec.10 self-test fixture #2 (binding regression) |

### 1.2 CAP-01..05 binding (REQUIREMENTS.md:113-119, verbatim)

| ID | Description | Phase 43 binding |
|----|-------------|------------------|
| CAP-01 | Define `PHASE-CAPSULE.json` schema | sec.4 (18 fields, 1 schema_version, frozen consts) |
| CAP-02 | Implement `super-gsd/tools/phase-capsule/write.cjs` | sec.8 layout + sec.9 public API |
| CAP-03 | Wire capsule writing into phase close | sec.9 sgsd-orchestrate Step 6.6.i.X wire-in |
| CAP-04 | Backfill capsules for at least v1.6-v1.8 + active milestone | sec.9 backfill plan (17 capsules) |
| CAP-05 | Provenance: source files, commits, hashes, status, evidence, debt, downstream contract, critical bypass refs | sec.4 schema covers all 7 |

### 1.3 Design lock 5 + 6 (REQUIREMENTS.md:40-50, controlling rules)

> Lock 5: "Phase close writes a phase capsule before downstream phases consume it."
> Lock 6: "Critical outputs bypass compression: CRIT, stack trace, stderr,
>         failed test, verifier fail, edge-guard miss, security/privacy issue,
>         destructive-operation warning, behaviorally proven provider outage."

Phase 43 IMPLEMENTS lock 5. Lock 6 binds sec.6: capsule MUST link bypass
entries raw via verbatim passthrough into `crit-backlog.jsonl`, not
paraphrase them.

---

## 2. Existing Surface Inventory

### 2.1 Universal phase folder content (Phase 40 audit ground truth)

Source: `super-gsd/tools/phase-folder-audit/audit.cjs:55-70` verbatim.

| Kind | Status | File pattern | Universal across v1.6-v1.9 |
|------|--------|--------------|----------------------------|
| context | REQUIRED | `{NN}-CONTEXT.md` | YES (15/15 sampled phases) |
| research | REQUIRED | `{NN}-RESEARCH.md` | YES (15/15) |
| plan | REQUIRED | `{NN}-*-PLAN.md` (>= 1) | YES (15/15) |
| verification | REQUIRED | `{NN}-VERIFICATION.md` | YES (15/15) |
| atc-review | RECOMMENDED | `{NN}-ATC-REVIEW.md` | YES for v1.6/v1.7/v1.8; SUPERSEDED in v1.9 by `reviews/{NN}-REVIEW.md` |
| commit-reviews | RECOMMENDED | `commit-reviews.jsonl` | YES for v1.6/v1.7/v1.8; ABSENT in v1.9 |
| codex-review | RECOMMENDED | `{NN}-codex-review.md` | YES for v1.7/v1.8; ABSENT in v1.6 + v1.9 |
| waste | RECOMMENDED | `WASTE.md` | RARE (1 of 15) |

**v1.6/v1.7/v1.8 vs v1.9 shape drift (CRITICAL):** v1.9 phases emit
reviews under `reviews/` subdirectory; pre-v1.9 phases emit
`{NN}-ATC-REVIEW.md` in phase root. Capsule writer MUST handle both
shapes. `gates.atc_review.path` resolves: `reviews/{NN}-REVIEW.md` >
`{NN}-ATC-REVIEW.md` > null.

### 2.2 Canonical streams the capsule cites by reference

| Stream | Owned by | Capsule field | Citation form |
|--------|----------|---------------|---------------|
| `crit-backlog.jsonl` | `lib/crit-backlog.cjs` | `bypass_refs[]` | `{stream, id, summary_passthrough, evidence_path}` |
| `agent-token-spend.jsonl` | Phase 41 | `token_cost{}` | `{evidence_event_id, role, total_tokens}` |
| `gate-value-log.jsonl` | Phase 36 | `gates.phase_level_atc_runs[]` | `{run_id, outcome}` |
| `review-ledger.jsonl` | Phase 34 | `gates.review_verdict{}` | `{run_id, verdict}` |
| `codex-log.jsonl` | `codex-exec.sh` | `gates.codex_runs[]` | `{run_id, exit, fallback_triggered}` |
| Git commits scoped to phase dir | git | `source_commits[]` | `{sha, subject, ts}` |

**Read-only invariant:** writer NEVER appends to any of the above. Owned
writes are PHASE-CAPSULE.json + PHASE-INDEX.jsonl only.

### 2.3 Existing patterns to mirror

| Pattern | Source | Phase 43 use |
|---------|--------|--------------|
| Read-only walker + closed-enum verdict | `audit.cjs:1-400` | YES (mirror walker structure) |
| `auditAllPhases` discovery (milestone filter) | `audit.cjs:351-395` | YES (verbatim borrow) |
| `__dirname`-anchored fingerprint guard | `gate-value-log.cjs:358-360` | YES (5 streams + 3 phase folders) |
| `--self-test` 13 assertions | Phase 41 mirror | YES (4 fixtures + 9 secondary) |
| Idempotent backfill | `report.cjs::backfillFromMetrics` | YES (rebuild = equivalent hash) |
| Frozen const enums + `Object.freeze` | gate-value-log.cjs:60-110 | YES (SCHEMA_VERSION, STATUS_VOCAB, BYPASS_KIND_VOCAB) |

### 2.4 Tool location decision

**LOCKED: `super-gsd/tools/phase-capsule/write.cjs`** (REQUIREMENTS:114
verbatim). Sibling test `write.test.cjs` mirrors Phase 40 audit/audit.test
pair. NOT a `scripts/lib/*-log.cjs` because no real-time append emitter
exists -- capsule is generated at phase close once and rebuilt-from-canonical
on demand.

---

## 3. Audit-Driven Evidence -- Why Capsules Now

### 3.1 The Phase 40 case study (audit:139-204)

Phase 40 researcher consumed 122,437 tokens. Source list named 12 prior
phase folders (v1.5 P21, v1.6 P26+P28, v1.7 P31+P35, v1.8 P39, plus 3
SKILL.md sections, ROADMAP, requirements, mass-discuss). Cache-read share:
98.3%. Researcher was rediscovering facts that should have been pre-compiled.

After Phase 43 ships, the same researcher reads 12 capsules at ~3-4k
tokens each = 36-48k total instead of 122k = 60-70% reduction on this
single phase. Phase 51 BENCH-04 must prove >= 50% reduction across the
representative set; Phase 40 alone meets the bar.

### 3.2 The 17-row backfill inventory (verified by direct ls)

| Milestone | Phases | Count | v1.7+ codex-review.md | v1.9 reviews/ subdir |
|-----------|--------|------:|:---------------------:|:--------------------:|
| v1.6 | 26, 27, 28, 29, 30 | 5 | NO | NO |
| v1.7 | 31, 32, 33, 34, 35 | 5 | YES | NO |
| v1.8 | 36, 37, 38, 39, 40 | 5 | YES | NO |
| v1.9 (shipped) | 41, 42 | 2 | NO | YES |

### 3.3 Token-density target

| Phase folder | Avg LOC across 6 files | Capsule target | Compression |
|--------------|------------------------:|----------------|-------------|
| v1.7/P32 (heavy) | 2,319 | ~250 LOC JSON | ~9% |
| v1.8/P40 (typical) | 1,912 | ~250 LOC JSON | ~13% |
| v1.6/P26 (lean) | ~1,200 | ~200 LOC JSON | ~17% |

Raw v1.8/P40 122k tokens of ambient context becomes ~3-4k tokens of capsule.
Lock 4 ("Agents consume role-specific context packets, not raw milestone
history") requires this density.

---

## 4. Schema Design (Q1, Q2, Q3 Locked)

### 4.1 Q1 -- 17 required + 1 optional fields, anchored to consumers

LOCKED: 17 required + 1 optional (`token_cost`). Each field MUST have a
named downstream consumer (Phase 36 "schema-without-consumer" rule).

| # | Field | Type | Req | Consumer | Purpose |
|---|-------|------|:---:|----------|---------|
| 1 | `schema_version` | int | Y | All readers | Forward-compat (Q2) |
| 2 | `milestone` | string | Y | Phase 45 PACKET-03 (filter), Phase 46 INDEX-02 (column) | Routing key |
| 3 | `phase` | string | Y | Phase 45/46 | Routing key |
| 4 | `phase_name` | string | Y | Phase 45/50 (display) | Human label |
| 5 | `status` | enum | Y | Phase 45 (skip non-PASS), Phase 46 (filter) | `PASS` / `PASS-WITH-DEFERRED-N` / `FAIL` / `UNKNOWN` |
| 6 | `goal` | string | Y | Phase 45 (packet body), Phase 46 (FTS) | One-sentence summary from CONTEXT.md |
| 7 | `outputs[]` | array | Y | Phase 45 (allowlist), Phase 46 (exports column) | Files + contracts shipped |
| 8 | `files[]` | array | Y | Phase 45 (file allowlist), Phase 46 (file_path index) | All file paths touched in phase commits |
| 9 | `decisions[]` | array | Y | Phase 45 (`# Locked Decisions`), Phase 49 GOV-04 | Verbatim from CONTEXT/RESEARCH/mass-discuss |
| 10 | `debt{}` | object | Y | Phase 45 (skip non-relevant), Phase 50 cockpit | crit-backlog deltas; counts only |
| 11 | `downstream_contract{}` | object | Y | Phase 45 (forward-contract injection), Phase 47 routing | What future phases must respect |
| 12 | `bypass_refs[]` | array | Y (may be empty) | Phase 51 BENCH-05, Phase 49 governance | Lock 6 raw-link list |
| 13 | `source_commits[]` | array | Y | Phase 46 (commit column), Phase 51 (rebuild test) | Git SHAs that built this phase |
| 14 | `source_hashes{}` | object | Y | A3 idempotency check; Phase 46 source_hash column | sha256 of inputs at write-time |
| 15 | `gates{}` | object | Y | Phase 50 cockpit; Phase 51 BENCH-05 (provider outage) | atc_review + verifier + codex outcomes |
| 16 | `token_cost{}` | object \| null | OPTIONAL | Phase 41 backfilled rows | Ledger pointer, not numbers |
| 17 | `created_at` | string | Y | Phase 49 governance staleness | ISO-8601 |
| 18 | `created_by` | string | Y | Provenance | `"phase-capsule/write.cjs@<gitsha>"` |

**Audit fields dropped/folded** (audit:436-489 vs Phase 43 final):
- DROP `why_it_matters`: subjective; would require LLM judgment.
- FOLD `tests_run` into `outputs[].tests_run` (per-output, not per-phase).
- FOLD `reusable_patterns` into `decisions[]` (a reusable pattern IS a locked decision).
- FOLD `future_constraints` into `downstream_contract.constraints[]`.

### 4.2 Q2 -- Schema versioning

**LOCKED: integer `schema_version` field (top of object).**

Forward-compat rule: bumping `schema_version` requires either (a) a new
required field or (b) a closed-enum value drop. Adding optional fields
or relaxing types stays at v1. Phase 49 GOV-03 lifecycle fields
(`confidence`, `last_validated`, `supersedes`, `superseded_by`,
`allowed_consumers`, `clearance_requires`, `deprecation_reason`) are
optional v1 extensions; do NOT bump schema_version.

`schema_url` REJECTED: adds indirection without protecting any consumer.
JSON Schema lives at `super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json`.
Single source.

### 4.3 Q3 -- File location

**LOCKED: per-phase, in the phase folder.**

`.planning/milestones/{ms}/phases/{NN-name}/PHASE-CAPSULE.json`

| Property | Per-phase | Aggregated |
|----------|-----------|------------|
| Git diff per change | YES (only the phase's capsule diffs) | NO (noisy diff) |
| Backfill atomicity | Each capsule independent write | Single write touches all 17 |
| Phase folder cohesion (Phase 40 audit principle) | YES | NO |

**Aggregated milestone-level index DOES exist** as projection alongside
per-phase capsules: `.planning/milestones/{ms}/PHASE-INDEX.jsonl` (one
row per phase). INDEX is for fast scan; CAPSULE is for detail. Phase 46
SQLite indexes both.

### 4.4 Canonical capsule example (v1.8/P40)

```json
{
  "schema_version": 1,
  "milestone": "v1.8",
  "phase": "40",
  "phase_name": "Phase Folder Audit",
  "status": "PASS",
  "goal": "Add a soft-warn auditor walking all phase folders and wire it into milestone close.",
  "outputs": [
    {
      "kind": "tool",
      "path": "super-gsd/tools/phase-folder-audit/audit.cjs",
      "exports": ["auditFolder", "auditAllPhases", "renderTable"],
      "contract": "auditAllPhases(planningDir, opts) returns AuditRow[]; closed-enum verdict in {compliant, partial, non-compliant}",
      "tests_run": ["node super-gsd/tools/phase-folder-audit/audit.cjs --self-test"]
    }
  ],
  "files": [
    "super-gsd/tools/phase-folder-audit/audit.cjs",
    "super-gsd/tools/phase-folder-audit/audit.test.cjs",
    "super-gsd/skills/sgsd-complete-milestone/SKILL.md",
    ".planning/milestones/v1.8/phase-folder-audit.md"
  ],
  "decisions": [
    {"id": "40=B", "source": ".planning/discussions/2026-04-26-mass-discuss.md:234", "text": "Soft-warn auditor only. NO folder modification. NO blocking. Operator discretion on remediation."},
    {"id": "AUDIT-04-readonly", "source": ".../40-RESEARCH.md:Q4", "text": "Read-only invariant: NEVER write/append/unlink/rename against any phase-folder path."}
  ],
  "debt": {"critical_added": 0, "warnings_added": 0, "edge_guard_miss_added": 0, "deferred_added": 0, "carried_forward_total": 10},
  "downstream_contract": {
    "consumers": ["sgsd-complete-milestone Step 4.6"],
    "constraints": [
      "Do not add a second phase folder schema without updating audit.cjs.",
      "Read-only invariant: never mutate phase folders from any tool that imports auditAllPhases."
    ],
    "extension_points": ["audit.cjs may add new RECOMMENDED_FILES kinds without bumping schema."]
  },
  "bypass_refs": [],
  "source_commits": [
    {"sha": "f3560ac0245dedba3a9e3c6adf20b7e6ac1cdf3a", "subject": "research(40): phase folder audit -- 4 required + 4 recommended canonical skeleton", "ts": "2026-04-27T..."},
    {"sha": "6b14536fb6635e0746fdbdd61ca945b6cc3569d7", "subject": "context(40): phase folder audit -- 40=B locked, 3-deliverable scope", "ts": "..."},
    {"sha": "89f7b8737d7d89fdac30017fd5f41883ff34ecf3", "subject": "plan(40-01): phase folder audit -- final v1.8 phase, 3 atomic deliverables", "ts": "..."},
    {"sha": "3747a63ffb91c2b1eb6a136b019ce0d417338fbe", "subject": "fix(40): clear dual-provider phase ATC findings -- 2 CRIT + 4 WARN in-loop", "ts": "..."}
  ],
  "source_hashes": {
    "context": {"path": ".../40-CONTEXT.md", "sha256": "<hex64>"},
    "research": {"path": ".../40-RESEARCH.md", "sha256": "<hex64>"},
    "plan": [{"path": ".../40-01-phase-folder-audit-PLAN.md", "sha256": "<hex64>"}],
    "verification": {"path": ".../40-VERIFICATION.md", "sha256": "<hex64>"},
    "atc_review": {"path": ".../40-ATC-REVIEW.md", "sha256": "<hex64>"}
  },
  "gates": {
    "verifier": {"verdict": "PASS", "ref": ".../40-VERIFICATION.md"},
    "atc_review": {"path": ".../40-ATC-REVIEW.md", "verdict": "pass (post-fix)", "crit_count": 2, "warn_count": 4},
    "phase_level_atc_runs": [{"run_id": "<from gate-value-log.jsonl>", "outcome": "pass"}],
    "codex_runs": [{"run_id": "<from codex-log.jsonl>", "exit": 0, "fallback_triggered": false}]
  },
  "token_cost": {"researcher": {"role": "researcher", "total_tokens": 122437, "evidence_event_id": "agent:....:..."}, "planner": null, "executor": null, "reviewer": null},
  "created_at": "2026-04-27T19:00:00.000Z",
  "created_by": "super-gsd/tools/phase-capsule/write.cjs@<gitsha>"
}
```

### 4.5 Why NOT envelope-v1

Phase 41/42 wrap rows in envelope-v1 because they emit one *event* per
write and chain them in JSONL. Capsule is a *document* (one per phase,
overwritten on rebuild). envelope-v1 fields like `command`, `reason_codes`,
`next_action`, `risk`, `duration_ms`, `run_id` do not map onto a phase
summary.

Capsule schema is its own contract level (phase-summary), parallel to
the 5 existing contracts (code-reviewer-v1, review-providers-v1,
handover-contract-v2, plan-schema-v2, command-envelope-v1). The schema
file `additionalProperties: false` (capsule is closed-shape, unlike
envelope-v1's `additionalProperties: true`). Validation happens at
write time inside `_validateCapsule(obj)`.

---

## 5. Hash + Idempotency Design (A3 binding)

### 5.1 source_hashes shape

```json
{
  "context": {"path": "...", "sha256": "<hex64>"},
  "research": {"path": "...", "sha256": "<hex64>"},
  "plan": [{"path": "...", "sha256": "..."}],
  "verification": {"path": "...", "sha256": "..."},
  "atc_review": {"path": "...", "sha256": "..."}
}
```

Rules: sha256 of file bytes (no normalization); missing file = field
is null (preserves structure for diff); v1.9 phases use
`reviews/{NN}-REVIEW.md` -- field carries whichever exists.

### 5.2 Composite "capsule content hash" (A3 anchor)

NOT a field of the capsule (would be circular). A3's binding test
computes content hash over canonical JSON serialization with sorted keys
and `created_at` + `created_by` stripped:

```javascript
function _capsuleContentHash(capsuleObj) {
  const stripped = {...capsuleObj};
  delete stripped.created_at;
  delete stripped.created_by;
  const json = JSON.stringify(stripped, Object.keys(stripped).sort());
  return crypto.createHash('sha256').update(json).digest('hex');
}
```

A3 self-test fixture #2: build capsule -> H1; delete capsule; rebuild
-> H2; assert H1 === H2.

### 5.3 Determinism rules

| Source of non-determinism | Mitigation |
|---------------------------|------------|
| `fs.readdirSync` order | `.sort()` before iterating |
| Git commit order | `git log --format='%H||%s||%cI' --reverse -- <phase_dir>` |
| JSON key order | `JSON.stringify(obj, Object.keys(obj).sort())` for hash |
| `outputs[]` array order | sorted by `path` ascending |
| `files[]` array order | sorted ascending + deduplicated |
| `bypass_refs[]` array order | sorted by `id` (timestamp-prefixed -> deterministic) |
| `source_commits[]` order | as `git log --reverse` returns (oldest first) |

If rebuild produces different content hash, EITHER a canonical input
file was edited (capsule legitimately differs) OR the writer has a
non-determinism bug -- F2 catches the latter.

### 5.4 Idempotent backfill

Backfill mode (`write.cjs --backfill --milestone v1.6 ...`) re-reads
canonical sources; if existing capsule's content hash matches, SKIP the
write (preserve mtime). If differs, OVERWRITE. Mirrors
`backfillFromMetrics(opts.dryRun)` walk + dedup pattern.

---

## 6. Critical Bypass Linkage (Lock 6 binding, A2)

### 6.1 The non-negotiable rule

ROADMAP line 110 verbatim: "critical bypass entries remain linked raw,
not summarized away."

`bypass_refs[]` entry shape:

```json
{
  "stream": "crit-backlog.jsonl",
  "id": "2026-04-27T00-07-22-122Z-589f",
  "kind": "verifier_fail",
  "summary_passthrough": "live Codex auth unavailable; per-dispatch ATC for commit 34eb8c2 used Claude only",
  "evidence_path": ".planning/milestones/v1.6/phases/28-mission-control-layout/commit-reviews.jsonl",
  "tagged_for_milestone": "next-debt-milestone"
}
```

Three fields are VERBATIM copies from the source row: `id`, `summary`
(renamed `summary_passthrough` to signal "this text was NOT generated
by the capsule writer"), and `evidence_path`. The capsule writer NEVER
paraphrases, abbreviates, or summarizes.

### 6.2 Pointers, not copies

For ANY future packet builder (Phase 45) consuming this capsule:

| Need | How |
|------|-----|
| Full original bypass body | Read `crit-backlog.jsonl` row at `id`. NEVER read `summary_passthrough` instead. |
| Just the count | Read capsule's `debt.critical_added`. |
| Stack trace / stderr / failed test detail | Follow `evidence_path` to raw artifact. |

Three identity fields disambiguate the row in case crit-backlog.jsonl
gets re-numbered or re-archived.

### 6.3 Extraction logic

```javascript
function _gatherBypassRefs(milestone, phase, planningDir) {
  const path = require('path').join(planningDir, 'metrics', 'crit-backlog.jsonl');
  const lines = fs.readFileSync(path, 'utf8').split('\n').filter(Boolean);
  const refs = [];
  for (const line of lines) {
    let row;
    try { row = JSON.parse(line); } catch (_e) { continue; }
    if (row.milestone !== milestone) continue;
    if (String(row.phase) !== String(phase)) continue;
    refs.push({
      stream: 'crit-backlog.jsonl',
      id: row.id,
      kind: row.kind,
      summary_passthrough: row.summary,
      evidence_path: row.evidence_path,
      tagged_for_milestone: row.tagged_for_milestone || null,
    });
  }
  refs.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return refs;
}
```

### 6.4 Self-test binding (fixture #4)

Seed crit-backlog.jsonl with 3 rows for milestone X / phase Y; assert
`bypass_refs.length === 3`; each `summary_passthrough` byte-equal to
source `summary` (no truncation, no rewrite). Test asserts writer
NEVER calls `string.replace()` on these fields. F4 is the LOCK 6
regression test.

---

## 7. Decisions / Debt / Downstream Contract Extraction

### 7.1 Decisions extraction (Q6)

**LOCKED: verbatim copies, never LLM-distilled.**

Source priority for `decisions[]`:

1. CONTEXT.md frontmatter `discuss_decisions: [N]` -> mass-discuss.md
   row N text verbatim.
2. CONTEXT.md `## Locked decision` section body verbatim.
3. RESEARCH.md `## Open Derivation Calls -- LOCKED` table rows verbatim.

Capsule writer NEVER rewrites `text`. Preserves CR/LF, trailing
whitespace, unicode (deterministic for hash; ASCII coercion is a
separate concern from Phase 40 ASCII gate which governs source files).

### 7.2 Debt extraction (Q7)

**LOCKED: counts only; bypass row text lives in bypass_refs.**

```json
{
  "debt": {
    "critical_added": <crit-backlog count for this phase>,
    "warnings_added": <WARN count from VERIFICATION.md unresolved_count + ATC-REVIEW.md WARN section>,
    "edge_guard_miss_added": <edge-guard-log.jsonl count>,
    "deferred_added": <crit-backlog rows tagged next-debt-milestone>,
    "carried_forward_total": <crit-backlog open count at phase close>
  }
}
```

If both VERIFICATION.md and ATC-REVIEW.md are absent or unparseable,
`warnings_added` = null.

### 7.3 Downstream contract extraction (Q8)

**LOCKED: extract from RESEARCH.md `## Cross-Phase Contract` + CONTEXT.md
`unblocks:` frontmatter; verbatim copy.**

| Field | Source |
|-------|--------|
| `consumers[]` | CONTEXT.md `unblocks:` + RESEARCH.md "Phase N PACKET-XX" / "consumes" / "forward contract" references |
| `constraints[]` | RESEARCH.md cross-phase prose + audit:474-476 `future_constraints` pattern |
| `extension_points[]` | RESEARCH.md "may extend" / "may add" / "extension protocol" prose -- copied verbatim with file:line |

Older v1.6 phases without `## Cross-Phase Contract`: extract from
`unblocks:` only. Fields default to `[]`.

### 7.4 Why verbatim, not distilled

Audit:256-266 names six exact questions a researcher needs (what
changed, what contract, what files canonical, what tests prove it,
what defects remain, what future phases respect). A summary-distilled
capsule risks omitting nuance. Phase 51 BENCH-04's "zero evidence loss"
test FAILS if a material decision is missing; verbatim minimizes risk.
~200 LOC of verbatim decisions = ~1.5k tokens, fits Phase 45 packet's
20k researcher budget.

---

## 8. Source Commits Field (Q9)

### 8.1 Embed at write-time vs query-on-demand

**LOCKED: EMBED at write-time (projection rule).**

Capsule is a projection per Lock 5 + mass-discuss row 43. Canonical
record is git itself; capsule embeds snapshot of git log scoped to
phase folder. Embedding gives:

- Fast read (no `git log` shell at packet-build time)
- Deterministic (commit list at write time is fixed; if changes,
  rebuild diverges and hash differs -- A3 catches)
- Phase 51 benchmark can compare capsules without git access

If git history is rewritten (force-push, rebase) AFTER capsule write,
embedded SHAs become orphan. Acceptable: master is protected (global
rule); rebuild re-derives from current git; idempotent rebuild
(sec.5.4) refreshes embedded commits.

### 8.2 Extraction logic

```javascript
function _gatherSourceCommits(phaseDir, gitRoot) {
  const cmd = `git log --pretty=format:'%H||%s||%cI' --reverse -- "${phaseDir}"`;
  const out = require('child_process').execSync(cmd, { cwd: gitRoot, encoding: 'utf8' });
  return out.split('\n').filter(Boolean).map(line => {
    const [sha, subject, ts] = line.split('||');
    return { sha, subject, ts };
  });
}
```

`||` separator: subjects contain colons, dashes, parens. Conventional in
git pretty-format parsing.

### 8.3 Scope by phase folder

`git log -- <phase_dir>` catches ALL commits modifying files in the
phase folder, regardless of message format. Scoping by `--grep '({NN}-'`
would miss milestone-close fix-ups + 0-prefix commits in v1.6.

If a commit modifies multiple phase folders (typically only
milestone-close), the same SHA appears in multiple capsules' `source_commits`.
Correct: each phase's capsule cites every commit that materially
touched its folder.

---

## 9. Backfill Plan + Phase-Close Integration (Q10, Q11)

### 9.1 Backfill scope (CAP-04)

| Milestone | Phases | Capsule count |
|-----------|--------|--------------:|
| v1.6 | 26-30 | 5 |
| v1.7 | 31-35 | 5 |
| v1.8 | 36-40 | 5 |
| v1.9 (shipped) | 41, 42 | 2 |
| Phase 43 itself | 43 | 1 |
| Total at Phase 43 close | | **18** |

### 9.2 Backfill order

LOCKED: chronological (v1.6 -> v1.7 -> v1.8 -> v1.9). Matches git
history; avoids forward refs.

```bash
node super-gsd/tools/phase-capsule/write.cjs --backfill --milestone v1.6
node super-gsd/tools/phase-capsule/write.cjs --backfill --milestone v1.7
node super-gsd/tools/phase-capsule/write.cjs --backfill --milestone v1.8
node super-gsd/tools/phase-capsule/write.cjs --backfill --milestone v1.9
# OR single shot:
node super-gsd/tools/phase-capsule/write.cjs --backfill --all
```

### 9.3 Phase-close integration (CAP-03, forward-flow)

Hook point: `super-gsd/skills/sgsd-orchestrate/SKILL.md` Step 6.6.i
(line 1179: "Mark phase complete, advance to next phase"). New
sub-step 6.6.i.X inserts BEFORE the advance:

```javascript
const path = require('path');
const { writeCapsule } = require(
  path.join(process.cwd(), 'super-gsd', 'tools', 'phase-capsule', 'write.cjs')
);
const planningDir = path.join(process.cwd(), '.planning');
const result = writeCapsule(planningDir, {
  milestone: '{{version}}',
  phase: '{{phase}}',
  phaseDir: '{{phase_dir}}',
});
// result: { ok: true, path: ".../PHASE-CAPSULE.json", content_hash: "..." }
//      or { ok: false, reason: "..." } -- never throws.
// On failure: append to .planning/metrics/context-complaints.jsonl (Phase 49 surface)
// and continue. Capsule failure does NOT block phase advance (autonomy lock).
```

Why phase-close, not milestone-close: Lock 5 says "Phase close writes
a phase capsule before downstream phases consume it". Phase 45 packet
builder consumes capsules during dispatch; if waits until milestone
close, the FIRST phase of the next milestone has no capsule for the
prior phase.

This is the FIRST hook into sgsd-orchestrate Step 6.6.i. Phase 42
deferred per-phase wiring as too risky; Phase 43 must be careful.
Mitigation: `writeCapsule` never throws; on failure returns
`{ok:false}` and orchestrator continues.

### 9.4 Sgsd-complete-milestone wire-in (backfill safety net)

SECOND hook at sgsd-complete-milestone Step 4.7 (between Step 4.6
phase-folder-audit and Step 5 cross-phase). For milestone-close-time
backfill (catches phases that closed before Phase 43 shipped).
Idempotent: rebuild with matching content hash skips write.

```javascript
const { writeAllCapsulesForMilestone } = require(
  path.join(process.cwd(), 'super-gsd', 'tools', 'phase-capsule', 'write.cjs')
);
const result = writeAllCapsulesForMilestone(planningDir, '{{version}}');
// Result: { written: N, skipped: M, errors: [] }
```

### 9.5 Failure modes

| Failure | Behavior |
|---------|----------|
| CONTEXT.md missing | fields default to `null`/empty arrays; status from VERIFICATION.md if present, else `"UNKNOWN"` |
| VERIFICATION.md missing | status = `"IN_PROGRESS"`; gates.verifier = null; debt counts = null |
| Git not available | source_commits = []; `created_by` notes "git unavailable"; capsule still writes |
| crit-backlog.jsonl missing | bypass_refs = []; debt counts = null |
| Phase folder name lacks `^\d{2}-` | NEVER write; return error (mirror Phase 40 non-compliant) |
| File hash unreadable | source_hashes[kind] = null |

Writer NEVER throws upward. Mirror Phase 36 / 40 / 41 / 42 contract.

---

## 10. Self-Test Design (4 binding fixtures + 9 secondary = 13 assertions)

### 10.1 Fixture summary

| F | Setup | Expected | Acceptance |
|---|-------|----------|-----------|
| F1 write/read | Synthetic phase folder with all 8 files; call writeCapsule | PHASE-CAPSULE.json valid against schema; `_validateCapsule` returns true; all 18 fields present | A1 |
| F2 rebuild equivalence | F1 setup; write -> H1; delete capsule; rewrite -> H2 | H1 === H2 (modulo created_at/created_by stripped) | **A3 BINDING** |
| F3 missing-file graceful | Phase folder with only `{NN}-CONTEXT.md` | writeCapsule succeeds; status="UNKNOWN"; missing fields are null/empty arrays; NEVER throws | autonomy lock 13 |
| F4 critical-bypass preserved | Seed crit-backlog.jsonl with 3 rows for milestone X / phase Y; writeCapsule for Y | bypass_refs.length === 3; each `summary_passthrough` byte-equal to source `summary`; sorted by `id` | **A2 BINDING (Lock 6)** |

### 10.2 Secondary assertions

| # | Assertion |
|---|-----------|
| 5 | `schema_version === 1`; field is integer; capsule is closed-shape (additionalProperties:false in schema) |
| 6 | `outputs[]` sorted by path ascending; `files[]` sorted ascending + deduplicated |
| 7 | `decisions[]` text field is verbatim from source (no string.replace, no trim) -- assert byte-for-byte against fixture source |
| 8 | `source_commits[]` ordered by `git log --reverse` (oldest first); each entry has sha (40 hex), subject (string), ts (ISO-8601) |
| 9 | `source_hashes` 5 keys (context, research, plan[], verification, atc_review); each value is `{path, sha256}` or null; sha256 is 64 hex chars |
| 10 | v1.9 phase folder shape: writer detects `reviews/{NN}-REVIEW.md`, sets `gates.atc_review.path` accordingly; v1.6/v1.7/v1.8 shape uses `{NN}-ATC-REVIEW.md` |
| 11 | Read-only invariant: `--self-test` does not modify any file outside tmpdir; fingerprint guard over 5 streams + 3 sample real phase folders, before/after |
| 12 | writeCapsule never throws upward; bad inputs return `{ok:false, reason:...}`; assertions catch every public-API call in try/catch |
| 13 | PHASE-INDEX.jsonl row appended per writeCapsule; row shape `{milestone, phase, phase_name, status, capsule_path, content_hash, created_at}`; existing rows for same (milestone, phase) replaced in place (idempotent) |

### 10.3 Fingerprint guard mirroring Phase 41 sec.7.1

```javascript
const realStreams = [
  path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'agent-token-spend.jsonl'),
  path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'crit-backlog.jsonl'),
  path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'gate-value-log.jsonl'),
  path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'review-ledger.jsonl'),
  path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'codex-log.jsonl'),
];
const realPhaseDirs = [
  path.resolve(__dirname, '..', '..', '..', '.planning', 'milestones', 'v1.6', 'phases', '26-cockpit-question-contract'),
  path.resolve(__dirname, '..', '..', '..', '.planning', 'milestones', 'v1.8', 'phases', '40-phase-folder-audit'),
  path.resolve(__dirname, '..', '..', '..', '.planning', 'milestones', 'v1.9', 'phases', '41-baseline-token-attribution'),
];
// Phase 32 W3 + Phase 36 W2 + Phase 39 W3 + Phase 40 AUDIT-04 lessons applied.
```

---

## 11. Hard Stop Conditions

Halt is reserved for `SGSD-HANDOVER.md:79-86` (4 conditions). Phase 43
NEVER halts:

- `writeCapsule` returns `{ok:false}` on any failure; orchestrator continues.
- Backfill failures append to `context-complaints.jsonl` (Phase 49 surface).
- Schema validation failure: log to stderr, return false; NEVER write a corrupted capsule.

**Phase 43 NEVER does:**
- Modify phase folder content (READ-ONLY against everything except own PHASE-CAPSULE.json output).
- Append to canonical streams (agent-token-spend, crit-backlog, gate-value-log, review-ledger, codex-log, route-decisions).
- Summarize or paraphrase critical bypass entries (Lock 6 binding).
- Block phase-advance on capsule write failure.
- Call any LLM (writer is purely deterministic local extraction).

**Phase 43 ALWAYS does on phase close:**
- Attempt capsule write at Step 6.6.i.X; log result; advance phase regardless.
- Attempt PHASE-INDEX.jsonl append (idempotent: replace existing (milestone, phase) row in place).
- On `--backfill`: same behavior; skip writes when content hash unchanged.

---

## 12. Read-Only Invariant Against Canonical Streams + Phase Folders

### 12.1 Streams Phase 43 MUST NOT write to

| Stream | Owner | Phase 43 op |
|--------|-------|-------------|
| `agent-token-spend.jsonl` | Phase 41 | READ for token_cost extraction |
| `crit-backlog.jsonl` | `lib/crit-backlog.cjs` | READ for bypass_refs extraction |
| `gate-value-log.jsonl` | Phase 36 | READ for gates.phase_level_atc_runs[] |
| `review-ledger.jsonl` | Phase 34 | READ for gates.atc_review fallback |
| `codex-log.jsonl` | `codex-exec.sh` | READ for gates.codex_runs[] |
| `route-decisions.jsonl` | Phase 32 | NOT read (out of scope for capsule v1) |
| `gates.yaml`, `STATE.md` | registry / orchestrator | NOT touched |

### 12.2 Phase folders Phase 43 MUST NOT modify

Capsule writer NEVER edits CONTEXT.md, RESEARCH.md, PLAN.md,
VERIFICATION.md, ATC-REVIEW.md, codex-review.md, commit-reviews.jsonl,
or v1.9-shape `reviews/{NN}-REVIEW.md`. Read-only against ALL.

The ONLY write Phase 43 performs in a phase folder: create or overwrite
`PHASE-CAPSULE.json`.

Phase 40 audit's `RECOMMENDED_FILES` list does NOT include
PHASE-CAPSULE.json (intentional decoupling -- backfill in flight does
not invalidate Phase 40 verdict). A future hardening phase may add it.

### 12.3 Phase 43 OWNS exclusively

| Path | Op |
|------|-----|
| `super-gsd/tools/phase-capsule/write.cjs` | own source |
| `super-gsd/tools/phase-capsule/write.test.cjs` | own test |
| `super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json` | own schema |
| `.../phases/{NN-name}/PHASE-CAPSULE.json` | overwrite-on-rebuild (idempotent) |
| `.../milestones/{ms}/PHASE-INDEX.jsonl` | append-or-replace by (milestone, phase) (idempotent) |
| `super-gsd/skills/sgsd-orchestrate/SKILL.md` (Step 6.6.i.X edit) | EDIT (~20 LOC) |
| `super-gsd/skills/sgsd-complete-milestone/SKILL.md` (Step 4.7 edit) | EDIT (~20 LOC) |

Self-test assertion 11 binds the read-only invariant via fingerprint guard.

---

## 13. Open Derivation Calls -- LOCKED

| Q | Status | Lock |
|---|--------|------|
| Q1 schema fields required vs optional | LOCKED | 17 required + 1 optional (token_cost); each anchored to a downstream consumer |
| Q2 schema versioning | LOCKED | integer schema_version; bump only on breaking change |
| Q3 file location | LOCKED | per-phase: `phases/{NN-name}/PHASE-CAPSULE.json`; aggregated PHASE-INDEX.jsonl alongside |
| Q4 source_hashes shape | LOCKED | per-file-kind sha256; null when missing; v1.9 reviews/ vs v1.8 ATC-REVIEW.md handled by atc_review field |
| Q5 critical bypass linkage | LOCKED | bypass_refs[] holds verbatim {id, summary_passthrough, evidence_path}; NEVER paraphrased |
| Q6 decisions extraction | LOCKED | verbatim from CONTEXT.md / RESEARCH.md / mass-discuss.md; never distilled |
| Q7 debt extraction | LOCKED | counts only in debt{}; row text lives in bypass_refs[] |
| Q8 downstream contract extraction | LOCKED | from RESEARCH.md ## Cross-Phase Contract + CONTEXT.md unblocks: |
| Q9 source_commits embed-vs-query | LOCKED | embed at write time; rebuild refreshes; projection rule |
| Q10 backfill scope | LOCKED | 17 capsules across v1.6-v1.9 + Phase 43 itself; chronological order |
| Q11 phase-close integration | LOCKED | Step 6.6.i.X in sgsd-orchestrate (forward-flow) + Step 4.7 in sgsd-complete-milestone (backfill safety net); both idempotent; capsule failure NEVER blocks phase advance |

**Status: zero open derivations. Phase 43 is plan-ready.**

---

## 14. Cross-Phase Contract

### 14.1 Phase 43 -> Phase 45 (PACKET-03) forward contract

Capsule shape IS the API. Phase 45 packet builder reads:

```typescript
interface PhaseCapsule {
  schema_version: 1;
  milestone: string;            // packet routing key
  phase: string;
  phase_name: string;
  status: 'PASS' | 'PASS-WITH-DEFERRED-N' | 'FAIL' | 'UNKNOWN' | 'IN_PROGRESS';
  goal: string;                 // packet's "Current Phase" body source
  outputs: PhaseOutput[];       // packet's "Files You May Read" allowlist
  files: string[];              // full file allowlist
  decisions: Decision[];        // packet's "Locked Decisions" body
  debt: DebtCounts;             // skip rule: skip phase if unresolved CRIT
  downstream_contract: {        // packet's forward-contract injection
    consumers: string[];
    constraints: string[];
    extension_points: string[];
  };
  bypass_refs: BypassRef[];     // packet must include raw if Phase 51 BENCH-05 bypass scenario
  source_commits: GitCommit[];
  source_hashes: SourceHashes;  // packet validates hashes match current files (else flag stale)
  gates: GateOutcomes;
  token_cost: TokenCostRefs | null;
  created_at: string;
  created_by: string;
}
```

### 14.2 Phase 43 -> Phase 46 (INDEX-02) forward contract

Phase 46 SQLite FTS index columns:

```sql
CREATE TABLE phase_capsules (
  milestone TEXT NOT NULL,
  phase TEXT NOT NULL,
  phase_name TEXT,
  status TEXT,
  goal TEXT,             -- FTS indexed
  decisions_text TEXT,   -- concatenated decisions[].text for FTS
  outputs_text TEXT,     -- concatenated outputs[].path for FTS
  capsule_path TEXT,     -- relative path to PHASE-CAPSULE.json
  content_hash TEXT,     -- _capsuleContentHash; rebuild verifier
  created_at TEXT,
  PRIMARY KEY (milestone, phase)
);
```

INDEX-04 acceptance ("deleting the database and rebuilding produces the
same indexed document count and hashes") is downstream-validated by
A3's binding test on the capsule layer.

### 14.3 Phase 43 -> Phase 51 (BENCH-04, BENCH-05) forward contract

- BENCH-04: "Researcher token reduction >= 50%" -- measure researcher
  spend with packet built from capsules vs raw folder reads.
- BENCH-05: "missing capsule" failure injection requires capsule
  deletion + degrade path. Capsule absence MUST be graceful-degraded by
  Phase 45 packet builder (capsule rebuild fallback or raw-folder
  fallback with logged complaint).

---

## 15. Single Plan Recommendation

### 15.1 File count

| Path | Status | Lines |
|------|--------|------:|
| `super-gsd/tools/phase-capsule/write.cjs` | NEW | ~600 |
| `super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json` | NEW | ~150 |
| `super-gsd/tools/phase-capsule/write.test.cjs` | NEW | ~200 |
| `super-gsd/skills/sgsd-orchestrate/SKILL.md` | EDIT (Step 6.6.i.X) | +20 |
| `super-gsd/skills/sgsd-complete-milestone/SKILL.md` | EDIT (Step 4.7) | +20 |
| `.../phases/*/PHASE-CAPSULE.json` | NEW (generated; 17 files) | ~250 LOC each |
| `.../milestones/*/PHASE-INDEX.jsonl` | NEW (generated; 4 files) | ~5 rows each |

**Hand-written total: ~990 lines.** Generated content (~4,270 LOC across
17 capsules + 4 indexes) is derived from canonical sources.

### 15.2 Plan task structure (single 43-01-PLAN.md)

```text
T1.  Skeleton: frozen consts (SCHEMA_VERSION, STATUS_VOCAB, BYPASS_KIND_VOCAB)
     + helper imports (path, fs, crypto, child_process)
T2.  PHASE-CAPSULE.schema.json: 18-field JSON Schema (additionalProperties:false)
T3.  Private extractors:
       _readContextDecisions(contextPath, massDiscussPath)
       _readResearchOpenDerivations(researchPath)
       _readVerificationDebt(verificationPath, atcReviewPath)
       _readDownstreamContract(researchPath, contextPath)
       _gatherBypassRefs(milestone, phase, planningDir)
       _gatherSourceCommits(phaseDir, gitRoot)
       _gatherSourceHashes(phaseDir)     // 5 file kinds
       _gatherGates(milestone, phase, planningDir)  // 3 streams
       _gatherTokenCost(milestone, phase, planningDir) // agent-token-spend
T4.  _validateCapsule(obj): JSON Schema validation; closed-enum status check
T5.  _capsuleContentHash(obj): canonical JSON, key-sorted, created_at/by stripped
T6.  Public API:
       writeCapsule(planningDir, {milestone, phase, phaseDir}) -> result
       writeAllCapsulesForMilestone(planningDir, milestone) -> result
       readCapsule(planningDir, milestone, phase) -> capsuleObj | null
       capsulePath(planningDir, milestone, phase) -> string
       backfillFromCanonical(planningDir, opts) -> result
T7.  PHASE-INDEX.jsonl writer: append-or-replace by (milestone, phase)
T8.  CLI argv: --self-test, --backfill [--milestone V] [--all],
     --phase NN --milestone V (single phase rebuild), --dry-run
T9.  Self-test scaffold: 4 fixtures + 9 secondary = 13 assertions +
     __dirname fingerprint guard over 5 streams + 3 phase folders
T10. SKILL.md Step 6.6.i.X (sgsd-orchestrate); Step 4.7 (sgsd-complete-milestone)
T11. Backfill execution: --backfill --milestone v1.6, v1.7, v1.8, v1.9
     (17 capsules total); each verified schema-valid + A3 hash-stable
T12. Verifier acceptance: CAP-01..05 + ROADMAP sec.43 A1-A3 green
```

T1-T9 mechanical. T10 mirrors Step 4.5/4.6/4.7 known pattern. T11-T12
integration tests.

### 15.3 Risks (with mitigations)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Bypass `summary` accidentally trimmed/normalized | High (Lock 6 binding regression) | F4 self-test asserts byte-for-byte equality |
| Capsule writes break phase-advance on first failure | Critical | Step 6.6.i.X writeCapsule never throws; logs to context-complaints, continues |
| Idempotent rebuild non-deterministic | High (A3 binding regression) | F2 self-test: write -> delete -> rewrite -> hash equal; canonicalize JSON keys + sort arrays + strip created_at/by |
| Schema drift v1.6/v1.7/v1.8 vs v1.9 reviews/ subdir | High | Assertion 10: writer detects both shapes |
| Source_commits orphan SHAs after force-push | Low (master protected) | Idempotent rebuild refreshes |
| Capsule grows beyond 250 LOC for v1.7/P32-class phases | Medium | Pointers (bypass_refs, source_commits, source_hashes, token_cost.evidence_event_id) not copies; 250 target, 400 acceptable |
| Phase 51 BENCH-04 fails to prove >= 50% reduction | Medium | ~3-4k tokens per capsule vs ~30-50k tokens per raw folder = 8-12x compression headroom |
| Critical bypass row archive breaks bypass_refs | Low | Archive should preserve rows; if vanishes, capsule rebuild emits null `summary_passthrough` and logs complaint |
| Phase 40 audit flags PHASE-CAPSULE.json absence | Low | Phase 40 RECOMMENDED_FILES does NOT include capsule (intentional decoupling) |

### 15.4 Pattern summary

Phase 43 establishes the **phase-summary contract level** -- the 6th SGSD
contract level (after code-reviewer-v1, review-providers-v1,
handover-contract-v2, plan-schema-v2, command-envelope-v1):

```text
canonical writer:    super-gsd/scripts/lib/*-log.cjs       (Phase 32, 34, 36, 41)
canonical reporter:  super-gsd/tools/<stream>/report.cjs   (Phase 41)
canonical checker:   super-gsd/tools/<gate>/check.cjs      (Phase 42)
canonical auditor:   super-gsd/tools/<aspect>/audit.cjs    (Phase 40)
canonical writer:    super-gsd/tools/phase-capsule/write.cjs (Phase 43 -- new)
```

A focused executor with `audit.cjs` + `report.cjs` + `gate-value-log.cjs`
in context can produce the finished writer in ONE pass.

### 15.5 Estimated effort

Single executor dispatch. Mirror discipline: walker structure + frozen
consts + envelope-pattern self-test. Novel work: 9 extractors, schema
file, PHASE-INDEX append-or-replace, dual-shape v1.6-v1.8 vs v1.9
review file detection, content hash canonicalization. T1-T9 + schema
~700 LOC in one pass. T10 SKILL edits = 2 small wire-ins. T11 backfill
= `--backfill --all` ~30s; verify 17 capsules. T12 verifier = schema
validation + binding A3 hash test.

---

## Sources

### Primary (HIGH confidence)

- `.planning/milestones/v1.9/REQUIREMENTS.md:40-50` (design locks 5, 6 verbatim)
- `.planning/milestones/v1.9/REQUIREMENTS.md:113-119` (CAP-01..05 verbatim)
- `.planning/milestones/v1.9/ROADMAP.md:96-112` (Phase 43 deliverables + acceptance)
- `.planning/milestones/v1.9/SGSD-HANDOVER.md:79-101` (4 hard-stops + Implementation Rules)
- `.planning/milestones/v1.9/EXISTING-SURFACE-AUDIT.md:21-60`, `124-144` (existing surfaces / no-duplicate)
- `.planning/discussions/2026-04-26-mass-discuss.md:238` (mass-discuss row 43 locked decision)
- `.planning/analyses/2026-04-27-agent-context-bloat-audit.md:306-318` (root cause 3: missing capsule)
- `.planning/analyses/2026-04-27-agent-context-bloat-audit.md:424-517` (capsule design source; 12-field draft)
- `.planning/analyses/2026-04-27-agent-context-bloat-audit.md:680-727` (Stage 2 Phase Capsule Writer concrete plan)
- `.planning/analyses/2026-04-27-agent-context-bloat-audit.md:805-836` (P40 before/after expected savings)
- `.planning/milestones/v1.9/phases/41-baseline-token-attribution/41-RESEARCH.md` (mirror template; envelope-v1 emitter pattern)
- `.planning/milestones/v1.9/phases/42-token-budget-admission/42-RESEARCH.md` (just-shipped precedent: Q1-Q10 lock pattern, 4-fixture self-test)
- `super-gsd/tools/phase-folder-audit/audit.cjs:55-70` (REQUIRED + RECOMMENDED file list verbatim)
- `super-gsd/tools/phase-folder-audit/audit.cjs:351-395` (auditAllPhases discovery pattern)
- `super-gsd/tools/phase-folder-audit/audit.cjs:218-250` (fingerprint guard pattern)
- `super-gsd/tools/token-attribution/report.cjs:1-100` (envelope-v1 lib pattern + frozen consts)
- `super-gsd/scripts/lib/gate-value-log.cjs:344-545` (self-test scaffold mirror)
- `super-gsd/scripts/lib/crit-backlog.cjs` + `.planning/metrics/crit-backlog.jsonl` (26 rows; schema verified by direct read of first 3)
- `super-gsd/templates/command-envelope-v1.json` (envelope-v1 contract; capsule explicitly NOT envelope-v1)
- `super-gsd/skills/sgsd-orchestrate/SKILL.md:1170-1209` (Step 6.6.i + 6.7 phase-close hook)
- `super-gsd/skills/sgsd-complete-milestone/SKILL.md` (Step 4.5/4.6 wire-in template; mirror for Step 4.7)
- `.planning/milestones/v1.8/SUMMARY.md` (milestone-level summary shape; informs but does NOT replace per-phase capsule)
- Direct phase-folder inventory: `wc -l` on 6 files in v1.7/P32 (2319 LOC), v1.8/P40 (1912 LOC)
- Direct git history: `git log --pretty=format:'%H %s' --reverse -- .../v1.8/phases/40-phase-folder-audit/` (5 phase-scoped commits)
- Direct phase-shape comparison: v1.6/v1.7/v1.8 = `{NN}-ATC-REVIEW.md`; v1.9 = `reviews/{NN}-REVIEW.md`
- Direct schema inspection: head of crit-backlog.jsonl confirms id/kind/phase/milestone/summary/evidence_path/tagged_for_milestone fields

### Secondary (MEDIUM confidence)

None. Every claim anchored to a file:line ref or verified shell command.

### Tertiary (LOW confidence)

- 250 LOC capsule target estimate -- derived from 18 fields x ~14 LOC per
  populated field; may overshoot for v1.7/P32-class phases; mitigation
  is pointers-not-copies design (sec.4.1, sec.15.3 risk row 6).

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Schema design (18 fields) | HIGH | Each field anchored to a downstream consumer; audit:436-489 12-field draft extended with verified consumer-need analysis |
| Schema versioning | HIGH | Integer schema_version; rule mirrors registry_version pattern (Phase 38 envelope-v1 1.0.0->1.0.1 precedent) |
| File location | HIGH | Per-phase rooted in git diff cohesion + Phase 40 "phase folder is the unit" principle |
| Hash + idempotency | HIGH | Canonical JSON serialization + array sort + key sort + strip operational metadata; A3 binding test catches non-determinism |
| Bypass linkage | HIGH | Verbatim passthrough is mechanically simple; F4 binding test asserts byte-equality |
| Decisions/debt/contract extraction | HIGH | Source priority locked; verbatim copy avoids LLM judgment |
| Source commits | HIGH | git log scoped to phase folder is deterministic; --reverse stabilizes order |
| Backfill scope | HIGH | 17 capsules verified via direct ls; chronological order avoids forward refs |
| Phase-close integration | MEDIUM-HIGH | Step 6.6.i.X is a NEW orchestrator hook (Phase 42 deferred per-phase wiring); writeCapsule never throws, never blocks advance |
| Self-test design | HIGH | 4 fixtures map 1:1 to 4 acceptance criteria (A1, A2, A3 + autonomy); 9 secondary mirror Phase 41 + Phase 42 patterns |
| Read-only invariant | HIGH | Fingerprint guard binds; 5 streams + 3 phase folders; mirrors Phase 36/40/41/42 pattern verbatim |
| Cross-phase contract (Phase 45/46/51) | HIGH | Capsule shape is the API; A1 schema_version path covers schema evolution |

---

## Project Constraints (from CLAUDE.md / SGSD design locks)

- Permissions: never ask for confirmation; auto mode owns dispatch.
- Commit discipline: `feat(43-01): {one-liner}`; commit after every unit; stage specific files by name.
- Mirror Phase 40 walker + Phase 41 emitter + Phase 42 read-only check 1:1 where applicable.
- Atomic writes: `fs.writeFileSync` for PHASE-CAPSULE.json (overwrite-on-rebuild); `fs.appendFileSync` for PHASE-INDEX.jsonl with in-place row replacement via read-modify-write tmpfile-rename for idempotency.
- Stderr-only error logging; writer never throws upward.
- ASCII-only RESEARCH.md (verified -- 0 non-ASCII bytes).
- Redis NOT canonical (lock 1); `.planning` JSONL + git remain source of truth (lock 2); capsules are PROJECTIONS (lock 3 + lock 5 + mass-discuss row 43).
- **Capsule = projection. Canonical = .planning + git** -- mass-discuss row 43, the controlling correctness rule.
- Critical bypass (lock 6): bypass_refs[] preserves verbatim. Phase 43 NEVER summarizes a critical bypass entry away.
- Autonomy continues (lock 13): capsule write failure NEVER halts phase advance.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 45 PACKET-03 will accept the 18-field capsule shape verbatim as packet input contract | sec.14.1 | If Phase 45 needs additional fields, capsule schema_version bumps to 2; v1 capsules continue to be readable; backward-compat path locked at sec.4.2 |
| A2 | `git log --reverse -- <phase_dir>` produces stable commit ordering across rebuilds | sec.5.3, sec.8.2 | Force-push or rebase on main breaks idempotency; mitigation: master is protected per global rules; rebuild refreshes |
| A3 | crit-backlog.jsonl row archive operations preserve row content (do not mutate `summary` field) | sec.6.3 | If rows are abbreviated during archive, bypass_refs.summary_passthrough drifts from source; mitigation: capsule rebuild reads CURRENT row, hash test detects drift |
| A4 | sgsd-orchestrate Step 6.6.i.X placement does not collide with future SKILL.md edits in v2.0+ | sec.9.3 | Future steps may renumber; mitigation: wire-in is referenced by NAME (writeCapsule import) not by ordinal position |
| A5 | Capsule density of ~3-4k tokens per phase will satisfy Phase 51 BENCH-04 >= 50% reduction target | sec.3.3, sec.15.3 | If Phase 51 measures higher overhead, capsule design has accreted text -- A3 hash test surfaces this; mitigation is pointer-not-copy design |

All other claims VERIFIED via direct file inspection or CITED from
REQUIREMENTS / ROADMAP / SGSD-HANDOVER / Phase 40 audit / Phase 41/42
RESEARCH / mass-discuss / bloat-audit.

---

## Metadata

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (30 days; stable -- canonical streams locked,
phase folder shape locked at v1.9 transition, schema design has zero
open derivations)

**Confidence breakdown:**
- Standard stack: HIGH (template = Phase 40 audit walker + Phase 41
  envelope-v1 lib + Phase 42 read-only check; all v1.8/v1.9 in-tree)
- Architecture: HIGH (capsule contract = 6th SGSD contract level; mass-discuss
  row 43 + Locks 5+6 are binding rules)
- Pitfalls: HIGH (Phase 32 W3 + Phase 36 W2 + Phase 39 W3 + Phase 40
  AUDIT-04 + Phase 41 sec.7.1 + Phase 42 lock-13 lessons all applied)
- Hash + idempotency: HIGH (canonical JSON serialization + key-sorted array
  + strip operational metadata; A3 binding self-test catches non-determinism)
- Bypass linkage: HIGH (verbatim passthrough; F4 binding self-test enforces)
- Cross-phase contracts: HIGH (Phase 45/46/51 each anchor to specific
  capsule fields; A1 schema_version path covers schema evolution)

**Single recommendation locked:** ONE plan, ONE write.cjs (~600 LOC),
ONE schema (~150 LOC), ONE write.test.cjs (~200 LOC), TWO SKILL.md
edits (~40 LOC), FIVE public APIs (writeCapsule,
writeAllCapsulesForMilestone, readCapsule, capsulePath,
backfillFromCanonical), THIRTEEN self-test assertions (4 named fixtures
binding A1+A2+A3+autonomy + 9 secondary), EIGHTEEN capsule fields.
Mirror Phase 40 walker + Phase 41 emitter + Phase 42 check patterns.
SIXTH SGSD contract level (phase-summary). Backfill 17 capsules across
v1.6-v1.9. Two phase-close hooks: forward-flow (Step 6.6.i.X) +
backfill-safety-net (Step 4.7). Capsule = projection. Canonical =
.planning + git. Total ~990 lines hand-written + 17 generated capsules.
