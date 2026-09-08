# SGSD Model Routing Switches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every SGSD dispatch section independently model-switchable, with Fable as the orchestrator default and Astral available wherever an operator selects it.

**Architecture:** Replace the current role-to-single-string routing with a validated model catalog plus per-role defaults and allowed model lists. Dispatch resolution will accept an explicit role override first, then the configured role default, while preserving the existing classifier precedence and fail-closed validation. The shipped overlay, project config, workflow documentation, and contract tests will use the same schema.

**Tech Stack:** JSON configuration, Markdown workflow contracts, Node.js/CommonJS tests, existing SGSD config/install propagation tooling.

---

### Task 1: Define the model catalog and role-switch schema

**Files:**
- Modify: `super-gsd/config/model-routing.json`
- Modify: `super-gsd/config/planning-config-overlay.json`
- Modify: `.planning/config.json`
- Test: `super-gsd/tests/model-routing/model-routing-contract.test.cjs`

- [ ] **Step 1: Write failing contract tests** for a catalog containing `fable`, `opus`, `codex`, and `astral`; every routing role must expose `default` and `allowed`; `orchestrator.default` must be `fable`; and an invalid default or disallowed override must fail validation.
- [ ] **Step 2: Run the focused contract test**

Run: `node --test super-gsd/tests/model-routing/model-routing-contract.test.cjs`

Expected: FAIL because the existing routing is a flat role-to-string map and has no Astral/Fable catalog.

- [ ] **Step 3: Implement the shared schema** with explicit provider/model identifiers and per-role `default`/`allowed` entries for orchestrator, deliberation, execution, and lightweight sections. Keep current Codex/Opus defaults for non-orchestrator roles unless a role is explicitly switched.
- [ ] **Step 4: Run the focused contract test**

Run: `node --test super-gsd/tests/model-routing/model-routing-contract.test.cjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add super-gsd/config/model-routing.json super-gsd/config/planning-config-overlay.json .planning/config.json super-gsd/tests/model-routing/model-routing-contract.test.cjs
git commit -m "feat: define switchable SGSD model routing"
```

### Task 2: Make dispatch resolution honor per-role switches

**Files:**
- Modify: `super-gsd/workflows/orchestrate-loop.md`
- Modify: `super-gsd/workflows/dispatch-table.md`
- Create: `super-gsd/scripts/lib/model-routing.cjs`
- Test: `super-gsd/tests/model-routing/model-routing-resolution.test.cjs`

- [ ] **Step 1: Write failing resolution tests** covering default resolution, explicit role override, classifier precedence, Astral selection for a non-orchestrator role, Fable orchestrator selection, and rejection of unknown/disallowed models.
- [ ] **Step 2: Run the focused resolution test**

Run: `node --test super-gsd/tests/model-routing/model-routing-resolution.test.cjs`

Expected: FAIL because no shared resolver exists.

- [ ] **Step 3: Implement `model-routing.cjs`** with `loadRouting`, `resolveModel({role, override, classifierModel})`, and `validateRouting`. Resolution order must be explicit override, classifier model, role default; every result must be checked against the role allowlist and catalog.
- [ ] **Step 4: Replace inline shell JSON lookups** in both workflow documents with the resolver contract and document `SGSD_MODEL_<ROLE>` override names without changing Claude/Agent argv topology.
- [ ] **Step 5: Run focused tests and syntax checks**

Run: `node --test super-gsd/tests/model-routing/model-routing-resolution.test.cjs && node --check super-gsd/scripts/lib/model-routing.cjs`

Expected: PASS with exit code 0.

- [ ] **Step 6: Commit**

```bash
git add super-gsd/scripts/lib/model-routing.cjs super-gsd/workflows/orchestrate-loop.md super-gsd/workflows/dispatch-table.md super-gsd/tests/model-routing/model-routing-resolution.test.cjs
git commit -m "feat: resolve per-role SGSD model overrides"
```

### Task 3: Propagate and document the switch contract

**Files:**
- Modify: `super-gsd/install.sh`
- Modify: `super-gsd/docs/SGSD-WORKSPACE-GUIDE.md`
- Modify: `super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md`
- Test: `super-gsd/tests/propagation/model-routing-propagation.test.cjs`

- [ ] **Step 1: Write a failing propagation test** proving the model-routing schema is copied to the installed global runtime and that a project overlay preserves the Fable default while retaining all role allowlists.
- [ ] **Step 2: Run the propagation test**

Run: `node --test super-gsd/tests/propagation/model-routing-propagation.test.cjs`

Expected: FAIL until installer/config propagation recognizes the new schema.

- [ ] **Step 3: Update installer merge/validation logic** to preserve the catalog and role switches transactionally, without overwriting operator-selected role defaults.
- [ ] **Step 4: Document examples** for switching orchestrator to Fable and selecting Astral for planner, executor, verifier, reviewer, or classifier independently.
- [ ] **Step 5: Run the propagation test and install-contract checks**

Run: `node --test super-gsd/tests/propagation/model-routing-propagation.test.cjs && node super-gsd/tests/install-contract/assert-install-contract.cjs --case empty-module-tree-real-install`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add super-gsd/install.sh super-gsd/docs/SGSD-WORKSPACE-GUIDE.md super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md super-gsd/tests/propagation/model-routing-propagation.test.cjs
git commit -m "docs: publish SGSD model switch controls"
```

### Task 4: Full verification and release evidence

**Files:**
- Modify: `.planning/milestones/v4.1-token-economics-atlas/phases/170-atlas-capture-foundation/170-01-EXECUTOR-REPORT.md`

- [ ] **Step 1: Run the full model-routing suite**

Run: `node --test super-gsd/tests/model-routing/*.test.cjs super-gsd/tests/propagation/model-routing-propagation.test.cjs`

Expected: all tests pass with zero skipped tests.

- [ ] **Step 2: Run repository checks**

Run: `git diff --check; node super-gsd/scripts/lib/hook-install-contract.cjs --check-manifest`

Expected: clean output and current manifest.

- [ ] **Step 3: Record exact test output and the Fable/Astral routing examples** in the executor report; do not claim milestone closure or bypass the existing MUDA/release gates.
- [ ] **Step 4: Commit the evidence**

```bash
git add .planning/milestones/v4.1-token-economics-atlas/phases/170-atlas-capture-foundation/170-01-EXECUTOR-REPORT.md
git commit -m "test: verify switchable SGSD model routing"
```

## Self-review

- Spec coverage: catalog, per-role defaults/allowlists, Fable orchestrator default, Astral availability, explicit overrides, classifier precedence, install propagation, documentation, and verification are covered by Tasks 1–4.
- Placeholder scan: no TBD/TODO steps; each implementation step identifies concrete files, commands, and expected outcomes.
- Protected boundaries: no gate definitions, telemetry privacy rules, or Claude/tmux topology are changed.
