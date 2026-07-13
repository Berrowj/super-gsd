# SGSD Frontier Architecture Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a source-backed HTML architecture audit that maps SGSD as operated today, tests whether its orchestration and skills are fully utilised, compares it with a clean-sheet frontier-model design, and ranks evidence-backed amendments.

**Architecture:** Three read-only audit lanes independently examine skills/routing, Codex execution/assurance, and state/operations. A fourth lane develops the clean-sheet counterfactual from objectives rather than SGSD component names. The primary agent reconciles all findings into an evidence index, synthesis, and self-contained HTML report with explicit observed/configured/documented/inferred/recommended labels.

**Tech Stack:** Markdown evidence artifacts, PowerShell and `rg` for read-only repository inspection, Git for scoped commits, static HTML with inline CSS and SVG, Node.js for structural checks, browser automation for visual smoke testing.

---

## File Structure

All created files are documentation-only artifacts under `.planning/analyses/`, which is exempt from the repository's active-plan requirement for source mutations.

- Existing design: `.planning/analyses/2026-07-13-sgsd-frontier-architecture-audit-design.md`
- Create: `.planning/analyses/2026-07-13-sgsd-frontier-architecture-evidence-index.md` — source census, evidence labels, exclusions, contradictions, and coverage totals.
- Create: `.planning/analyses/2026-07-13-sgsd-audit-skills-routing.md` — skill inventory, trigger precedence, intent routing, interactive/auto/triage/board traces.
- Create: `.planning/analyses/2026-07-13-sgsd-audit-execution-assurance.md` — Codex roles/profiles/context/sandbox and gate/repair/closure audit.
- Create: `.planning/analyses/2026-07-13-sgsd-audit-state-operations.md` — truth, memory, learning, cockpit, MCP, Warp, SSH/tmux, watchdog, and recovery audit.
- Create: `.planning/analyses/2026-07-13-sgsd-clean-sheet-architecture.md` — objective-first counterfactual architecture produced without preserving SGSD names or boundaries.
- Create: `.planning/analyses/2026-07-13-sgsd-frontier-architecture-synthesis.md` — reconciled capability matrix, scores, verdicts, ranked recommendations, risks, and proof tests.
- Create: `.planning/analyses/2026-07-13-sgsd-frontier-architecture-audit.html` — final self-contained visual report.

No existing SGSD source, registry, runtime state, gate, workflow, or configuration file is modified.

### Task 1: Freeze the Evidence Contract and Source Census

**Files:**
- Read: `.planning/analyses/2026-07-13-sgsd-frontier-architecture-audit-design.md`
- Create: `.planning/analyses/2026-07-13-sgsd-frontier-architecture-evidence-index.md`

- [ ] **Step 1: Confirm the evidence index does not already exist**

Run:

```powershell
Test-Path '.planning/analyses/2026-07-13-sgsd-frontier-architecture-evidence-index.md'
```

Expected: `False`.

- [ ] **Step 2: Enumerate candidate sources without reading generated caches or temporary files**

Run:

```powershell
rg --files AGENTS.md WARP.md CLAUDE.md .planning super-gsd .warp |
  rg -i '(SKILL\.md$|STATE\.md$|ROADMAP\.md$|INTENT\.md$|registry|orchestrat|triage|board|deliberat|codex|gate|muda|verif|checkpoint|memory|cockpit|warp-mcp|remote-tmux|watchdog|recovery)' |
  rg -v '(node_modules|fixtures|\.tmp$|design-pack/uploads|super-gsd/source/)'
```

Expected: paths spanning rules, skills, registries, scripts/tools, `.planning/` truth, metrics, cockpit/MCP, and remote operation.

- [ ] **Step 3: Create the evidence index with the frozen claim labels**

Create the file with these sections and exact table columns:

```markdown
# SGSD Frontier Architecture Evidence Index

## Authority Order
1. `.planning/` current truth and append-only ledgers
2. Executable scripts/tools and active registries
3. Tests proving executable behavior
4. Current contracts and operator documentation
5. Historical planning artifacts

## Claim Labels
| Label | Admission rule |
| --- | --- |
| OBSERVED | Current executable source, test, state, or ledger directly supports the claim. |
| CONFIGURED | Active configuration wires the capability, but sampled evidence does not prove use. |
| DOCUMENTED | Current prose asserts the behavior, but matching executable proof was not found. |
| INFERRED | Multiple sources support a reasoned conclusion that is not directly recorded. |
| RECOMMENDED | Proposed future behavior; never represented as present behavior. |

## Source Census
| ID | Domain | Path | Source kind | Freshness signal | Authority | Intended claim | Checked |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Contradictions
| ID | Claim A | Source A | Claim B | Source B | Authority decision | Audit consequence |
| --- | --- | --- | --- | --- | --- | --- |

## Explicit Exclusions
| Path or class | Reason excluded |
| --- | --- |

## Coverage Totals
```

- [ ] **Step 4: Populate the census before any recommendation is written**

Include, at minimum:

- `AGENTS.md`, `WARP.md`, `CLAUDE.md`.
- `.planning/STATE.md`, active milestone intent/roadmap artifacts that actually exist, checkpoint if present, memory roots, agent/resource registry, and relevant metrics ledgers.
- `super-gsd/skills/**/SKILL.md`, with explicit rows for orchestrate, triage, board/deliberation, planning, completion, recovery, audit, and update skills found on disk.
- `super-gsd/registry/{agents,gates,decisions,handover-contract-v2,command-envelope-v1,codex-profiles,cockpit-sources}.yaml` where present.
- Dispatch router, intent map, context packet, Codex Pro, gate, memory, cockpit, MCP, watchdog, recovery, Warp, and remote tmux implementations.
- Tests that directly verify material architecture contracts.

Record absent expected files as absence findings instead of inventing paths.
Assign sequential source IDs using `SRC-001`, `SRC-002`, and so on; the coverage check relies on this stable prefix.

- [ ] **Step 5: Record the known state/documentation contradiction**

Add a contradiction row for `AGENTS.md` identifying v3.2 as latest versus `.planning/STATE.md` identifying v3.4 as active. Rank `.planning/STATE.md` higher for runtime position while retaining the discrepancy as a governance finding.

- [ ] **Step 6: Validate the evidence-index structure**

Run:

```powershell
$f = '.planning/analyses/2026-07-13-sgsd-frontier-architecture-evidence-index.md'
$required = @('## Authority Order','## Claim Labels','## Source Census','## Contradictions','## Explicit Exclusions','## Coverage Totals')
$text = Get-Content -Raw $f
$missing = $required | Where-Object { $text -notmatch [regex]::Escape($_) }
if ($missing) { throw "Missing sections: $($missing -join ', ')" }
if (($text -split "`n" | Where-Object { $_ -match '^\| SRC-' }).Count -lt 25) { throw 'Source census has fewer than 25 material rows' }
'PASS evidence-index structure and minimum coverage'
```

Expected: `PASS evidence-index structure and minimum coverage`.

- [ ] **Step 7: Commit the evidence index only**

```powershell
git add -- '.planning/analyses/2026-07-13-sgsd-frontier-architecture-evidence-index.md'
git diff --cached --check
git commit -m 'docs: index SGSD architecture evidence'
```

Expected: one documentation file committed; unrelated worktree changes remain unstaged.

### Task 2: Audit Skills, Intent Routing, and Control-Plane Boundaries

**Files:**
- Read: evidence-index sources tagged `skills-routing`
- Create: `.planning/analyses/2026-07-13-sgsd-audit-skills-routing.md`

- [ ] **Step 1: List every installed SGSD skill and routing surface**

Run:

```powershell
rg --files super-gsd/skills super-gsd/source/super-gsd/skills .claude 2>$null |
  rg 'SKILL\.md$' |
  Sort-Object -Unique
rg -n -i 'triage|board|deliberat|orchestrat|planning intent|auto-invoke|dispatch rules|first match wins' CLAUDE.md super-gsd/skills super-gsd/registry
```

Expected: a discoverable inventory and the contracts that decide when skills run.

- [ ] **Step 2: Create the skill capability matrix**

Use these exact columns:

```markdown
| Capability | Skill/path | Natural-language trigger | Explicit command | Preconditions | Output | Mechanical consumer | Evidence of recent use | Overlap | Score | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

Every material skill receives a row. Use `CONFIGURED` or `DOCUMENTED` when recent execution proof is absent.

- [ ] **Step 3: Trace four control-plane journeys**

Add separate numbered traces for:

1. Interactive operator-led build without entering the auto loop.
2. Natural-language planning intent entering triage.
3. Strategic ambiguity escalating to board/deliberation.
4. Explicit autonomous orchestration.

For each node record trigger, owner, input, output, state mutation, evidence, failure path, and next consumer. Cite file paths beside every node.

- [ ] **Step 4: Test boundary clarity**

Answer with evidence:

- Can triage terminate without a mechanical continuation?
- Can board/deliberation and orchestration both claim the same intent?
- Is interactive SGSD a named first-class mode or merely Claude launched with a prompt?
- Does Claude ever duplicate research, planning, coding, or verification owned by Codex?
- Are skill results mechanically consumed or left as prose for operator memory?
- Are trigger precedence and fall-through behavior explicit?

- [ ] **Step 5: Score and assign preliminary verdicts**

Score 0–4 for outcome utility, trigger quality, boundary clarity, mechanical consumption, evidence strength, cost proportionality, failure recovery, and frontier leverage. Explain any score below 2 or above 3.

- [ ] **Step 6: Validate citations and trace coverage**

Run:

```powershell
$f = '.planning/analyses/2026-07-13-sgsd-audit-skills-routing.md'
$text = Get-Content -Raw $f
foreach ($term in @('Interactive operator-led','triage','board','autonomous','Mechanical consumer','Verdict')) {
  if ($text -notmatch [regex]::Escape($term)) { throw "Missing audit term: $term" }
}
if (($text -split "`n" | Where-Object { $_ -match '`[^`]+(?:\.md|\.yaml|\.cjs|\.ps1|\.sh)`' }).Count -lt 15) { throw 'Fewer than 15 cited source lines' }
'PASS skills-routing audit coverage'
```

Expected: `PASS skills-routing audit coverage`.

- [ ] **Step 7: Commit the lane report only**

```powershell
git add -- '.planning/analyses/2026-07-13-sgsd-audit-skills-routing.md'
git diff --cached --check
git commit -m 'docs: audit SGSD skills and routing'
```

### Task 3: Audit the Codex Execution and Assurance Fabric

**Files:**
- Read: evidence-index sources tagged `execution-assurance`
- Create: `.planning/analyses/2026-07-13-sgsd-audit-execution-assurance.md`

- [ ] **Step 1: Inventory execution roles, profiles, and boundaries**

Run:

```powershell
rg -n -i 'Codex GPT|codex-|role|profile|requires_worktree|sandbox|allowlist|token_budget|native_review|handover|context packet|route decision' CLAUDE.md super-gsd/registry super-gsd/tools super-gsd/scripts |
  Select-Object -First 600
```

Expected: evidence for research, planning, plan-check, readiness, execution, review, verification, context, routing, and isolation boundaries.

- [ ] **Step 2: Create the execution matrix**

```markdown
| Role/profile | Trigger | Model/reasoning | Context source | Write authority | Sandbox/worktree | Output contract | Review/gate | Failure/fallback | Evidence | Score | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

Do not equate a profile's configured isolation with proof that every dispatch uses it.

- [ ] **Step 3: Map the assurance chain**

Build a gate table from the active registry and orchestrator contract:

```markdown
| Gate | Fires when | Enforcement | Evidence path | Repair path | Downstream decision | Observed value signal | Cost signal | Overlap | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

Include per-dispatch ATC, phase ATC, verifier/semantic acceptance, MUDA/waste, edge guard, and release readiness when supported by current sources. Label legacy or missing gates accurately.

- [ ] **Step 4: Trace one successful dispatch and one repair loop**

Use current or recent ledger rows where available. If no suitable row exists, trace executable/configured flow and label it `CONFIGURED`; do not fabricate a run.

- [ ] **Step 5: Test the central execution claims**

Determine whether:

- Context packets are the only legal dispatch surface in practice.
- File allowlists, sandbox flags, and worktrees align across role/profile paths.
- Review independence is preserved.
- Fallback routes weaken model or safety guarantees.
- Gate outputs cause repairs, debt, or closure mechanically.
- Token/latency cost can be attributed to useful decisions.

- [ ] **Step 6: Validate coverage**

Run:

```powershell
$f = '.planning/analyses/2026-07-13-sgsd-audit-execution-assurance.md'
$text = Get-Content -Raw $f
foreach ($term in @('Role/profile','requires_worktree','per-dispatch ATC','phase ATC','verifier','MUDA','release readiness','repair loop')) {
  if ($text -notmatch [regex]::Escape($term)) { throw "Missing execution/gate term: $term" }
}
'PASS execution-assurance audit coverage'
```

- [ ] **Step 7: Commit the lane report only**

```powershell
git add -- '.planning/analyses/2026-07-13-sgsd-audit-execution-assurance.md'
git diff --cached --check
git commit -m 'docs: audit SGSD execution and assurance'
```

### Task 4: Audit State, Memory, Learning, and Operator Operations

**Files:**
- Read: evidence-index sources tagged `state-operations`
- Create: `.planning/analyses/2026-07-13-sgsd-audit-state-operations.md`

- [ ] **Step 1: Inventory truth, evidence, memory, and recovery surfaces**

Run:

```powershell
rg -n -i 'STATE\.md|checkpoint|last_activity|append-only|memory|recall|curate|CMB|context authority|VTP|cockpit|MCP|watchdog|recovery|remote|tmux|SSH|degrad' AGENTS.md WARP.md CLAUDE.md .planning/STATE.md super-gsd/docs super-gsd/registry super-gsd/tools super-gsd/scripts |
  Select-Object -First 800
```

- [ ] **Step 2: Create the state and operations matrix**

```markdown
| Surface | Authority | Producer | Consumer | Freshness rule | Mutation policy | Degraded behavior | Recovery role | Evidence | Score | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

- [ ] **Step 3: Trace interruption and remote-operation journeys**

Trace:

1. Normal checkpoint creation and resume.
2. Stale or contradictory state recovery.
3. Local Warp launch and cockpit visibility.
4. SSH/tmux launch, persistence, reconnect, and degraded cockpit behavior.
5. Optional VTP absence.
6. Memory observation becoming—or failing to become—future dispatch context.

- [ ] **Step 4: Test learning and observability claims**

Determine whether:

- There is one authoritative current-position resolver.
- State freshness is mechanically enforced or only documented.
- Metrics are append-only and consumed, rather than merely displayed.
- CMB/memory promotions protect authority boundaries.
- Harness-evolution findings alter future components safely.
- MCP/cockpit surfaces match the current state schema.
- Remote operation preserves the same control and evidence semantics as local operation.

- [ ] **Step 5: Validate coverage**

Run:

```powershell
$f = '.planning/analyses/2026-07-13-sgsd-audit-state-operations.md'
$text = Get-Content -Raw $f
foreach ($term in @('checkpoint','stale','Warp','SSH','tmux','VTP','memory','cockpit','MCP','watchdog')) {
  if ($text -notmatch [regex]::Escape($term)) { throw "Missing state/operations term: $term" }
}
'PASS state-operations audit coverage'
```

- [ ] **Step 6: Commit the lane report only**

```powershell
git add -- '.planning/analyses/2026-07-13-sgsd-audit-state-operations.md'
git diff --cached --check
git commit -m 'docs: audit SGSD state and operations'
```

### Task 5: Produce the Clean-Sheet Frontier Counterfactual

**Files:**
- Read: design specification sections 1–3 and 11 only
- Create: `.planning/analyses/2026-07-13-sgsd-clean-sheet-architecture.md`

- [ ] **Step 1: Isolate the counterfactual from SGSD component names**

Give the author only these objectives:

```markdown
- Convert operator intent into verified software outcomes.
- Route strategic ambiguity through proportionate multi-perspective reasoning.
- Separate model judgment from deterministic state transitions.
- Give executors minimal sufficient context and bounded authority.
- Make verification independent, evidence-bearing, and repairable.
- Survive interruption and remain understandable off-machine.
- Let learning change later decisions without promoting untrusted observations to authority.
- Optimise for outcome quality, operator leverage, token/latency proportionality, and recoverability.
```

Do not provide SGSD skill, gate, file, or phase names until the first architecture is complete.

- [ ] **Step 2: Define the clean-sheet components and interfaces**

For every component specify responsibility, input schema, output schema, authority, deterministic versus model-owned work, failure state, evidence emitted, and downstream consumer.

- [ ] **Step 3: Define operating modes and lifecycle**

Cover interactive operator-led work, bounded one-unit execution, autonomous progression, strategic deliberation, failure repair, and recovery. Do not create separate modes when a shared state machine with explicit policy is simpler.

- [ ] **Step 4: Define the minimum assurance and learning loops**

Justify every gate-like check by the decision it protects. Specify how outcome evidence changes routing, context, or component policy without self-authorising unsafe changes.

- [ ] **Step 5: Add a Mermaid-independent text diagram and interface table**

The Markdown must remain understandable without a renderer. Use an ASCII or indented flow plus a structured interface table.

- [ ] **Step 6: Run an anchoring scan**

Before adding the comparison appendix, run:

```powershell
$f = '.planning/analyses/2026-07-13-sgsd-clean-sheet-architecture.md'
$body = (Get-Content -Raw $f) -split '## Comparison Appendix', 2 | Select-Object -First 1
$forbidden = @('SGSD','triage','board','ATC','MUDA','STATE.md','Codex profile','phase artifact')
$hits = $forbidden | Where-Object { $body -match [regex]::Escape($_) }
if ($hits) { throw "Counterfactual anchored to current names before comparison: $($hits -join ', ')" }
'PASS clean-sheet anchoring boundary'
```

Expected: `PASS clean-sheet anchoring boundary`.

- [ ] **Step 7: Add the comparison appendix only after the anchoring check passes**

Map current SGSD concepts to the clean-sheet responsibilities and note fit, excess, gaps, and migration implications.

- [ ] **Step 8: Commit the counterfactual only**

```powershell
git add -- '.planning/analyses/2026-07-13-sgsd-clean-sheet-architecture.md'
git diff --cached --check
git commit -m 'docs: design clean-sheet frontier orchestration'
```

### Task 6: Reconcile Findings and Rank Amendments

**Files:**
- Read: evidence index, three lane reports, clean-sheet counterfactual
- Create: `.planning/analyses/2026-07-13-sgsd-frontier-architecture-synthesis.md`

- [ ] **Step 1: Build the reconciled capability table**

Use these columns:

```markdown
| Capability | Current responsibility | Evidence label | Utility | Trigger | Boundary | Consumption | Evidence | Cost | Recovery | Frontier leverage | Total/32 | Verdict | Target responsibility |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
```

Resolve cross-lane score differences in prose; do not silently average incompatible judgments.

- [ ] **Step 2: Build the contradiction and duplication register**

Include truth conflicts, skill overlaps, duplicated orchestration work, documented-only paths, unused outputs, gate overlap, and local/remote semantic divergence.

- [ ] **Step 3: Assign final verdicts**

Every material capability receives exactly one of `KEEP`, `STRENGTHEN`, `MERGE`, `REPLACE`, `AUTOMATE`, or `REMOVE`. A verdict without a cited finding is invalid.

- [ ] **Step 4: Rank recommendations**

For each recommendation include:

```markdown
| Rank | Amendment | Verdict basis | Expected outcome | Causal confidence | Complexity reduction | Safety/reversibility | Effort class | Dependencies | Risk | Proof test |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

Separate immediate operating changes, bounded architecture amendments, and milestone-scale redesigns.

- [ ] **Step 5: Write the headline verdict and highest-leverage change**

The verdict must answer whether SGSD's complexity earns its keep, where frontier-model leverage is being lost, and which one change should be tested first. It must not claim measured benefit where only expected benefit exists.

- [ ] **Step 6: Validate synthesis completeness**

Run:

```powershell
$f = '.planning/analyses/2026-07-13-sgsd-frontier-architecture-synthesis.md'
$text = Get-Content -Raw $f
foreach ($term in @('KEEP','STRENGTHEN','MERGE','REPLACE','AUTOMATE','REMOVE','Proof test','Headline verdict')) {
  if ($text -notmatch [regex]::Escape($term)) { throw "Missing synthesis term: $term" }
}
$recommendations = ($text -split "`n" | Where-Object { $_ -match '^\|\s*\d+\s*\|' }).Count
if ($recommendations -lt 5) { throw 'Fewer than five ranked recommendations' }
'PASS synthesis verdict and recommendation coverage'
```

- [ ] **Step 7: Commit the synthesis only**

```powershell
git add -- '.planning/analyses/2026-07-13-sgsd-frontier-architecture-synthesis.md'
git diff --cached --check
git commit -m 'docs: synthesise SGSD frontier audit'
```

### Task 7: Build the Self-Contained HTML Architecture Audit

**Files:**
- Read: all audit Markdown artifacts
- Create: `.planning/analyses/2026-07-13-sgsd-frontier-architecture-audit.html`

- [ ] **Step 1: Confirm the report is absent before creation**

Run:

```powershell
Test-Path '.planning/analyses/2026-07-13-sgsd-frontier-architecture-audit.html'
```

Expected: `False`.

- [ ] **Step 2: Create the semantic HTML shell**

Use this exact section order and IDs:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SGSD Frontier Architecture Audit</title>
  <style>
    :root {
      --paper: #f7f5ef; --panel: #ffffff; --ink: #17211f; --muted: #586562;
      --line: #d9dedb; --teal: #397b75; --blue: #5d86a0; --amber: #a47a38;
      --green: #2f7556; --red: #a45f58; --violet: #785a9c; --radius: 8px;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; color: var(--ink); background: var(--paper); font: 16px/1.55 "Segoe UI", Aptos, Arial, sans-serif; }
    a { color: var(--teal); }
    header, nav, main { width: min(1180px, calc(100% - 32px)); margin-inline: auto; }
    header { padding: 56px 0 28px; }
    nav { position: sticky; top: 0; z-index: 5; padding: 12px 0; background: color-mix(in srgb, var(--paper) 94%, transparent); border-bottom: 1px solid var(--line); }
    section { padding: 34px 0; scroll-margin-top: 64px; }
    h1 { max-width: 920px; font-size: clamp(2.1rem, 5vw, 4rem); line-height: 1.04; margin: 0 0 18px; }
    h2 { font-size: clamp(1.5rem, 3vw, 2.2rem); margin: 0 0 16px; }
    h3 { margin: 0 0 10px; }
    .panel { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 22px; }
    .grid-2, .grid-3 { display: grid; gap: 18px; }
    .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .diagram { overflow-x: auto; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; }
    svg { display: block; width: 100%; height: auto; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); }
    th, td { padding: 11px 12px; border: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { background: #edf2ef; }
    .table-wrap { overflow-x: auto; }
    .pill { display: inline-block; border: 1px solid currentColor; border-radius: 999px; padding: 3px 9px; font-size: .78rem; font-weight: 700; }
    .observed { color: var(--green); } .configured { color: var(--blue); }
    .documented { color: var(--amber); } .inferred { color: var(--violet); }
    .recommended { color: var(--red); }
  </style>
</head>
<body>
  <header id="verdict"></header>
  <nav aria-label="Report sections"></nav>
  <main>
    <section id="eli5"></section>
    <section id="observed-architecture"></section>
    <section id="mode-comparison"></section>
    <section id="capability-utilisation"></section>
    <section id="workflow-traces"></section>
    <section id="assurance-memory-recovery"></section>
    <section id="failure-modes"></section>
    <section id="clean-sheet"></section>
    <section id="delta"></section>
    <section id="verdicts"></section>
    <section id="roadmap"></section>
    <section id="sources"></section>
  </main>
</body>
</html>
```

Replace the CSS comment with complete inline CSS before saving the file. The saved report must contain no external stylesheet, font, script, or image dependency.

- [ ] **Step 3: Render the observed architecture and modes**

Add labelled inline SVG diagrams for:

1. Seven-layer observed architecture.
2. Interactive versus autonomous swimlanes with shared substrate.
3. Intent/skill routing including triage, board/deliberation, and orchestration.
4. Codex dispatch and assurance loop.
5. State/memory/evidence/recovery flow.

Every SVG includes a `<title>`, accessible text or `aria-label`, a legend, and source references adjacent to the diagram.

- [ ] **Step 4: Render the clean-sheet and delta views**

Add an inline SVG for the clean-sheet architecture and a current-versus-target mapping table. Keep `OBSERVED`, `INFERRED`, and `RECOMMENDED` visually distinct.

- [ ] **Step 5: Render dense audit tables**

Include the capability utilisation matrix, verdict table, contradiction register, and ranked roadmap. Preserve evidence labels and proof tests from the synthesis rather than summarising them away.

- [ ] **Step 6: Add the source ledger**

List every source used with path, source kind, authority, audit domain, and claims supported. Mark reasoning lenses separately from evidence.
Every ledger row and every material architecture node must carry a repository-relative `data-source="path/to/source"` attribute so the final path-existence check can verify the diagram's evidence links mechanically.

- [ ] **Step 7: Check responsive and print behavior in the CSS**

The CSS must include:

```css
@media (max-width: 760px) {
  .grid-2, .grid-3 { grid-template-columns: 1fr; }
  .table-wrap { overflow-x: auto; }
  svg { min-width: 720px; }
  .diagram { overflow-x: auto; }
}
@media print {
  nav { position: static; }
  .panel { break-inside: avoid; box-shadow: none; }
  a { color: inherit; }
}
```

- [ ] **Step 8: Run the static structure test**

Run:

```powershell
@'
const fs = require('fs');
const file = '.planning/analyses/2026-07-13-sgsd-frontier-architecture-audit.html';
const html = fs.readFileSync(file, 'utf8');
const ids = ['verdict','eli5','observed-architecture','mode-comparison','capability-utilisation','workflow-traces','assurance-memory-recovery','failure-modes','clean-sheet','delta','verdicts','roadmap','sources'];
const missing = ids.filter(id => !html.includes(`id="${id}"`));
const svgCount = (html.match(/<svg\b/g) || []).length;
const forbiddenExternal = /<(?:script|link)[^>]+(?:src|href)=["']https?:/i.test(html);
const labels = ['OBSERVED','CONFIGURED','DOCUMENTED','INFERRED','RECOMMENDED'].filter(label => html.includes(label));
if (missing.length || svgCount < 6 || forbiddenExternal || labels.length !== 5) {
  console.error(JSON.stringify({ missing, svgCount, forbiddenExternal, labels }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ sections: ids.length, svgCount, labels: labels.length, externalDependencies: 0 }));
'@ | node
```

Expected: JSON reporting 13 sections, at least 6 SVGs, 5 evidence labels, and 0 external dependencies.

- [ ] **Step 9: Commit the report only after Task 8 passes**

```powershell
git add -- '.planning/analyses/2026-07-13-sgsd-frontier-architecture-audit.html'
git diff --cached --check
git commit -m 'docs: publish SGSD frontier architecture audit'
```

### Task 8: Visual Smoke Test and Final Evidence Audit

**Files:**
- Read: final HTML and all supporting audit artifacts
- Modify only if validation finds defects: `.planning/analyses/2026-07-13-sgsd-frontier-architecture-audit.html`

- [ ] **Step 1: Start a local static server from the repository root**

Run in a persistent hidden process:

```powershell
$pidPath = '.planning/analyses/.sgsd-audit-http.pid'
$proc = Start-Process -FilePath 'python' -ArgumentList @('-m','http.server','8765','--bind','127.0.0.1') -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
Set-Content -LiteralPath $pidPath -Value $proc.Id
$proc.Id
```

Expected: a process ID. If `python` is unavailable, run `py -m http.server 8765 --bind 127.0.0.1` with the same hidden-process pattern.

- [ ] **Step 2: Open the report through browser automation**

Open:

```text
http://127.0.0.1:8765/.planning/analyses/2026-07-13-sgsd-frontier-architecture-audit.html
```

Verify the title, sticky navigation, headline verdict, diagrams, tables, mobile overflow behavior, and absence of console errors. Capture one desktop and one narrow-viewport screenshot for inspection; screenshots are temporary validation evidence and are not committed unless the operator requests them.

- [ ] **Step 3: Run the source-path existence check**

Run:

```powershell
@'
const fs = require('fs');
const html = fs.readFileSync('.planning/analyses/2026-07-13-sgsd-frontier-architecture-audit.html', 'utf8');
const paths = [...html.matchAll(/data-source="([^"]+)"/g)].map(m => m[1]);
const unique = [...new Set(paths)];
const missing = unique.filter(p => !fs.existsSync(p));
if (unique.length < 25 || missing.length) {
  console.error(JSON.stringify({ sourceCount: unique.length, missing }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ sourceCount: unique.length, missing: 0 }));
'@ | node
```

Expected: at least 25 unique source paths and `missing: 0`.

- [ ] **Step 4: Run the unfinished-marker and unsupported-certainty scan**

Run:

```powershell
$f = '.planning/analyses/2026-07-13-sgsd-frontier-architecture-audit.html'
$bad = @('T' + 'BD', 'T' + 'ODO', 'F' + 'IXME', 'lorem ipsum') -join '|'
if (Select-String -Path $f -Pattern $bad -CaseSensitive:$false) { throw 'Unfinished marker found' }
foreach ($phrase in @('guaranteed improvement','will reduce tokens','proves optimal')) {
  if (Select-String -Path $f -SimpleMatch $phrase -CaseSensitive:$false) { throw "Unsupported certainty: $phrase" }
}
'PASS unfinished-marker and certainty scan'
```

- [ ] **Step 5: Adversarially review the top five recommendations**

For each top-five recommendation answer:

- What observation supports it?
- What competing explanation exists?
- Could it weaken a gate or authority boundary?
- Is novelty bias favoring the clean-sheet design?
- What smallest reversible test would falsify the recommendation?

Revise confidence, rank, or wording when the challenge exposes weak causality.

- [ ] **Step 6: Re-run all report checks after any fix**

Repeat Task 7 Step 8 and Task 8 Steps 2–4. Expected: all pass with the final file.

- [ ] **Step 7: Commit validation fixes only if the HTML changed**

```powershell
git add -- '.planning/analyses/2026-07-13-sgsd-frontier-architecture-audit.html'
git diff --cached --check
git diff --cached --quiet; if ($LASTEXITCODE -ne 0) { git commit -m 'docs: validate SGSD frontier architecture audit' }
```

- [ ] **Step 8: Stop the static server**

```powershell
$pidPath = '.planning/analyses/.sgsd-audit-http.pid'
$serverPid = [int](Get-Content -Raw $pidPath)
Stop-Process -Id $serverPid
Remove-Item -LiteralPath $pidPath
```

Expected: the validation server exits; no SGSD runtime process is affected.

## Plan Self-Review Results

- **Spec coverage:** All 18 design sections map to Tasks 1–8. The current architecture, skill utilisation, six audit domains, representative traces, clean-sheet protocol, verdict taxonomy, ranking, HTML structure, uncertainty handling, and validation each have an explicit task.
- **Scope:** The work is one read-only architecture-audit deliverable. Supporting lane reports are evidence units, not independent product subsystems.
- **Type/name consistency:** Claim labels, verdict vocabulary, scoring dimensions, filenames, report IDs, and source attributes are consistent across tasks.
- **Repository safety:** All mutations are documentation-only under `.planning/analyses/`. Existing source and runtime state remain untouched.
