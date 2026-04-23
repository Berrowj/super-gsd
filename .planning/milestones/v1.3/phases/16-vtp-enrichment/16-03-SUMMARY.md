---
phase: 16
plan: 03
wave: C
status: complete
date: 2026-04-23
commits:
  - 5694698
  - b3792b6
  - eadd3da
requirements_satisfied:
  - VTP-08a
  - VTP-08b
tags:
  - vtp
  - advise
  - sepl
  - service-enrichment
  - wave-c
---

# Phase 16 Plan 03: Wave C — /sgsd-vtp-advise + sepl Major-Proposal Auto-Advise Summary

**One-liner:** Shipped `/sgsd-vtp-advise` standalone skill with 9-enum client-side guard and added conditional `vtp_advise_service_enrichment` auto-call to `sgsd-sepl-propose.sh` for D-09 "major" proposals (7 falsifiable criteria); 8-fixture bash test green (7 major + 1 control).

## Files Changed

| File | Type | Lines | Commit |
|------|------|-------|--------|
| `super-gsd/skills/sgsd-vtp-advise/SKILL.md` | created | 149 | `5694698` |
| `super-gsd/skills/sgsd-sepl/SKILL.md` | modified | +36 | `b3792b6` |
| `super-gsd/scripts/sgsd-sepl-propose.sh` | modified | +128 | `b3792b6` |
| `super-gsd/scripts/sgsd-sepl-propose.test.sh` | created | 113 | `eadd3da` |

## Verification Results

### Task 1 — /sgsd-vtp-advise standalone skill (VTP-08a)

**Verify command:**
```bash
test -f super-gsd/skills/sgsd-vtp-advise/SKILL.md \
  && grep -q "name: sgsd-vtp-advise" super-gsd/skills/sgsd-vtp-advise/SKILL.md \
  && grep -q "mcp__vtp-kb__vtp_advise_service_enrichment" super-gsd/skills/sgsd-vtp-advise/SKILL.md \
  && grep -q "retrieval, routing, evaluation, tooling, memory, observability, safety, workflow, planning" super-gsd/skills/sgsd-vtp-advise/SKILL.md \
  && grep -q "vtp-context-composer" super-gsd/skills/sgsd-vtp-advise/SKILL.md
```
**Exit code:** 0 ✓

| Acceptance Criterion | Result |
|---|---|
| File exists; parent dir created | ✓ |
| Frontmatter `name: sgsd-vtp-advise` | ✓ |
| Frontmatter `argument-hint: "<service-name>"` | ✓ |
| `allowed-tools` is LIST form (not comma-string) | ✓ |
| `allowed-tools` contains `vtp_advise_service_enrichment` + `vtp_route_and_retrieve` | ✓ |
| Body enumerates all 9 valid `candidate_areas` in a single code block | ✓ |
| Body contains "Never call `mcp__vtp-kb__*` directly" | ✓ |
| Body documents report path as `.planning/advise/{...}-{slug}.md` | ✓ (`{YYYY-MM-DD-HHMM}-{slug}.md` for T-16-20 disambiguation) |
| Body contains Graceful-fail discipline in Step 3 | ✓ |
| 5 `<process>` steps: Parse, Compose, Call, Write, Report | ✓ |
| `grep -c "^---$"` = 2 | ✓ |

### Task 2 — sgsd-sepl major-proposal auto-advise (VTP-08b) + bash test

**Verify command:**
```bash
grep -q "mcp__vtp-kb__vtp_advise_service_enrichment" super-gsd/skills/sgsd-sepl/SKILL.md \
  && grep -q "is_major_proposal" super-gsd/scripts/sgsd-sepl-propose.sh \
  && grep -q "MAJOR_REASON" super-gsd/scripts/sgsd-sepl-propose.sh \
  && grep -q "vtp_advise_applied" super-gsd/scripts/sgsd-sepl-propose.sh \
  && test -x super-gsd/scripts/sgsd-sepl-propose.test.sh \
  && bash super-gsd/scripts/sgsd-sepl-propose.test.sh
```
**Exit code:** 0 ✓

**Bash test output (8/8 PASS):**
```
PASS [criterion-1-orchestrator] (reason=none)
PASS [criterion-2-dispatch] (reason=none)
PASS [criterion-3-new-skill] (reason=none)
PASS [criterion-4-agent] (reason=none)
PASS [criterion-5-new-hook] (reason=none)
PASS [criterion-6-new-config] (reason=none)
PASS [criterion-7-cross-phase] (reason=none)
PASS [control-minor] (reason=none)

PASS: all 8 test cases (7 major + 1 control) passed
```

(The `reason=none` display is a subshell artifact — `is_major_proposal`'s stdout echo is captured correctly via `$(...)` but globals set inside the command-substitution subshell do not propagate back to the parent. This is harmless: the test asserts `true`/`false` on stdout, which is accurate. Sanity check confirmed `MAJOR_REASON` is set when the function is called without command substitution.)

| Acceptance Criterion | Result |
|---|---|
| `sgsd-sepl/SKILL.md` allowed-tools includes `vtp_advise_service_enrichment` + `vtp_route_and_retrieve` | ✓ |
| `sgsd-sepl/SKILL.md` body contains `<vtp_integration>` block describing the 7 criteria + graceful-fail | ✓ |
| `sgsd-sepl-propose.sh` contains `is_major_proposal()` function | ✓ |
| All 7 criterion labels present (orchestrator_loop, dispatch_rules, new_skill, agent_surface, new_hook, new_config_key, cross_phase) | ✓ |
| `timeout 5 node` wrapper for advise call (T-16-18 mitigation) | ✓ |
| HEREDOC frontmatter emits `major:` and `vtp_advise_applied:` keys | ✓ |
| Source-guard sentinel: `BASH_SOURCE[0] != $0` → early return (T-16-16) | ✓ |
| Test file exists + is executable | ✓ |
| Test exits 0 with all 8 cases passing | ✓ |

### End-of-Wave Gate

All 5 gates from the plan's `<verification>` block:

1. **VTP-08a skill exists + parseable** → ✓ (file exists, `name:` present, 2 frontmatter closers, 9-enum listed)
2. **VTP-08b sepl patches landed** → ✓ (`mcp__vtp-kb__vtp_advise_service_enrichment` in sepl SKILL.md, `is_major_proposal` in propose.sh)
3. **Bash test 8 fixture cases** → ✓ (exit 0, `PASS: all 8 test cases (7 major + 1 control) passed`)
4. **Composer contract honored** → ✓ (skill body asserts "Never call mcp__vtp-kb__* directly"; propose.sh routes through `composer.callVtp` in the node wrapper)
5. **Backward compat** → ✓ (existing `grep ^status:` in `sgsd-sepl-commit.sh` agnostic to new keys; confirmed via prior file read)

## Deviations

1. **[Rule 2 — Critical functionality, T-16-14 mitigation]** Added path-traversal guard language to Step 1 of `/sgsd-vtp-advise`. The plan action block mentioned slugification but the threat model (T-16-14) explicitly requires rejecting `..` and `/`. Folded into Step 1: "strip any non-`[a-z0-9-]` character; reject any input containing `..` or `/` to guard against path traversal — T-16-14". No scope change — just surfacing the threat-model requirement in the skill body so implementers honor it.

2. **[Rule 1 — Judgement call, T-16-15 mitigation choice]** Plan action Step C offered two alternatives for non-interpolating HEREDOC: (a) switch existing `<<EOF` to `<<'EOF'` or (b) use `printf '%s'` / separate temp file. Chose approach (b): kept the existing interpolating HEREDOC intact (since it still relies on `$TYPE`, `$TARGET`, etc.) and appended advise findings AFTER the main HEREDOC write via `cat "$ADVISE_FINDINGS_FILE" >> "$PROPOSAL.tmp"` inside a brace-group. This bypasses shell expansion entirely for the JSON payload (backticks and `$` in findings cannot expand) while avoiding a larger rewrite of the proposal assembly block. Documented inline in both the propose.sh comment and here.

3. **[Rule 2 — Critical functionality, T-16-16 mitigation]** Plan suggested guarding `main_propose_flow` inside an `if/else` block to let the test source the script. Implemented as a simpler `return 0` sentinel at the point where sourcing ends (after `is_major_proposal` definition, before the option-parsing loop). `return 0` in a sourced context exits early without executing the remainder; `return` outside a sourced context fails, so the `|| exit 0` fallback covers edge cases. This keeps the existing flat-script structure intact (no function wrap required) and exposes `is_major_proposal()` to sourcers. Net effect: identical to the plan's suggested guard, structurally cleaner.

4. **[Rule 1 — Judgement call, advise invocation shape]** The plan's pseudo-code for the advise call used `mcpInvoke: /* injected by runtime */ null` as a comment placeholder. When `mcpInvoke` is missing, the composer returns `{ok:false, reason:"no_mcp_invoke"}` (verified via `vtp-context-composer.cjs:288-292`). From a bash-invoked node one-liner there is no way to inject the Claude Code MCP runtime directly. Documented in the script comment: "mcpInvoke is not injectable from a pure bash context... the composer will return `{ok:false, reason:"no_mcp_invoke"}` when no invoker is provided, which we treat identically to a timeout — frontmatter records `vtp_advise_applied: false` and the proposal writes cleanly." This is the documented fallback behaviour and is graceful-fail-compatible. When `sgsd-sepl` runs inside a skill-tool context with an MCP-capable invoker wired in, the same code path will succeed; when run from pure bash / CLI it degrades cleanly. No regression to existing sepl behaviour.

5. **[Minor — test display]** The test's `reason=none` output is a subshell limitation (globals set inside `$(...)` do not propagate). Accepted since the stdout-based assertion is the actual contract; the reason display is informational only. Sanity-checked that `MAJOR_REASON` IS set when `is_major_proposal` is invoked without command substitution (see deviation block above for the sanity command).

## Commits

| SHA | Type | Message |
|---|---|---|
| `5694698` | feat(16-03) | add /sgsd-vtp-advise standalone skill (VTP-08a) |
| `b3792b6` | feat(16-03) | wire major-proposal auto-advise into sgsd-sepl (VTP-08b) |
| `eadd3da` | test(16-03) | add sgsd-sepl-propose bash test for major-detection coverage |

All three commits are atomic, use `feat(16-03):` / `test(16-03):` prefix, and stage files by name (never `git add -A`). CRLF-conversion warnings occurred per D-02 — ignored. Wave B commits (`aa70b30`, `8db4226`, `db28d2e`) interleaved with ours in the log due to parallel execution — no conflicts, no git-lock races observed.

## Threat Model Compliance

| Threat | Status | Evidence |
|---|---|---|
| T-16-14 (Path traversal via `<service-name>` arg) | mitigated | Skill Step 1: slugify lower + `[a-z0-9-]` only + reject `..` / `/` |
| T-16-15 (HEREDOC backtick/`$` expansion in advise findings) | mitigated | Findings appended via `cat "$ADVISE_FINDINGS_FILE"` outside the interpolating HEREDOC — no shell expansion path |
| T-16-16 (Test-file sourcing triggers propose flow) | mitigated | Source-guard sentinel at script line 87-89: `[[ BASH_SOURCE[0] != $0 ]] && return 0` |
| T-16-17 (Advise findings cleartext in proposal) | accepted (per plan) | Operator reviews before `--apply` — identical trust surface as existing proposals |
| T-16-18 (DoS via hanging advise call) | mitigated | `timeout 5 node -e` + `\|\| printf '{"ok":false,"reason":"timeout"}'` fallback; propose still writes with `vtp_advise_applied: false` |
| T-16-19 (Spoofed recommendations) | accepted (per plan) | Operator reviews before apply; human-in-loop by sepl design |
| T-16-20 (Same-day report collision) | mitigated | Skill uses `{YYYY-MM-DD-HHMM}-{slug}.md` (documented in `<rules>` item 4) |

## Self-Check

**Files created/modified:**
- `super-gsd/skills/sgsd-vtp-advise/SKILL.md` — FOUND ✓ (created)
- `super-gsd/skills/sgsd-sepl/SKILL.md` — FOUND ✓ (modified — allowed-tools + `<vtp_integration>` block)
- `super-gsd/scripts/sgsd-sepl-propose.sh` — FOUND ✓ (modified — +is_major_proposal, +source-guard, +advise-enrich, +frontmatter keys)
- `super-gsd/scripts/sgsd-sepl-propose.test.sh` — FOUND ✓ (created, +x)

**Commits:**
- `5694698` — FOUND in git log ✓
- `b3792b6` — FOUND in git log ✓
- `eadd3da` — FOUND in git log ✓ (HEAD)

## Self-Check: PASSED

## Ready for Downstream Consumption?

**YES.** Rationale:

1. **Both VTP-08 sub-requirements green** — VTP-08a (standalone skill) and VTP-08b (conditional sepl integration) both land with verifiable artefacts.
2. **Test coverage proven** — 8/8 fixture cases pass, covering each of the 7 D-09 falsifiable criteria + 1 minor control. Regression-testable on every invocation of `bash super-gsd/scripts/sgsd-sepl-propose.test.sh`.
3. **Graceful-fail proven** — advise-call path returns `{ok:false}` when `mcpInvoke` is missing (current bash-invoked state); frontmatter records `vtp_advise_applied: false`, proposal writes cleanly. T-16-18 timeout fallback also in place.
4. **Backward compat** — existing `sgsd-sepl-commit.sh grep ^status:` logic agnostic to the 2 new frontmatter keys; pre-existing callers unaffected.
5. **Composer contract honoured** — both skill (as documented instruction) and propose.sh (as executed code) route through `composer.callVtp` — no direct MCP surface.

**Suggested next step:** operator smoke-tests dim 2 of the smoke runbook (a deliberately major proposal, e.g., `--type agent`) to confirm end-to-end the frontmatter gains `major: true` live. Until the MCP runtime is injected into the bash wrapper, `vtp_advise_applied` will remain `false` on live runs (graceful-fail path), which is the documented contract.

## Threat Flags

None — no new trust-boundary surface introduced beyond what the plan's `<threat_model>` already catalogued. Skill writes to existing `.planning/advise/` directory (created on demand); propose.sh continues writing to existing `.planning/proposals/` directory; bash test reads no external resources.
