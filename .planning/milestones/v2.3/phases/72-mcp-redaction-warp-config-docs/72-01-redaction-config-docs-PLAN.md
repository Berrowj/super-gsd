---
plan_id: 72-01
phase: 72
title: MCP redaction + Warp config + setup docs + workflow + warp-doctor probe upgrade
type: code+docs (FULL tier)
created: 2026-04-29
status: ready-for-execution
schema_version: 1
expected_ATC_tier: full
model: sonnet
files_touched:
  - super-gsd/tools/warp-mcp/server.cjs
  - super-gsd/tools/warp-mcp/fixtures/_redaction/
  - super-gsd/tools/warp-doctor/check.cjs
  - super-gsd/docs/SGSD-WARP-MCP-SETUP.md
  - .warp/workflows/sgsd-mcp-self-test.yaml
---

# Plan 72-01 -- MCP Redaction + Warp Config + Setup Docs

## Tasks

| # | Task | Acceptance |
|--:|---|---|
| 1 | Implement `_applyRedactions(text)` + 7 frozen REDACTION_CATEGORIES | Each category has documented regex + replacement; helper returns `{redacted: string, applied: string[]}` |
| 2 | Wire `_applyRedactions` into 9 tools (5, 7, 8, 9, 10, 11, 12, 13, 14) | Each tool that passes through user content/paths/commits runs redaction over output before envelope finalization |
| 3 | Populate `_redactions_applied` with categories that fired | Closed vocab; audit-friendly; no raw values |
| 4 | Extend ERROR_CODES to len=13: add `subprocess_failed` + `subprocess_timeout` | Frozen; selfTest A2 updated; tool 10/14 use new codes |
| 5 | Ship 7 redaction fixture pairs under `_redaction/` per category | each input has the trigger pattern; expected has `<REDACTED:category>` and `_redactions_applied: ["<category>"]` |
| 6 | Add selfTest A31-A37 (one per redaction category) + A38 (Lock-13 on `_applyRedactions` never throws) | 37+/37+ PASS |
| 7 | Author SGSD-WARP-MCP-SETUP.md | Sections: Overview / Install / Warp MCP Config / Verify / Troubleshooting / VTP-optional / Forward to v2.4 |
| 8 | Author `.warp/workflows/sgsd-mcp-self-test.yaml` | Validates via warp-workflow-lint Phase 64 (5 required keys + project_dir default) |
| 9 | Upgrade Phase 67 warp-doctor probe 15 (mcp_config_present) | Real check: scan `~/.warp/` for MCP config containing SGSD entry; PASS/MISSING |
| 10 | Add Phase 67 selfTest assertion for upgraded probe 15 | A16 (existing) confirmed still works; new assertion verifies real-check behaviour |
| 11 | Run all self-tests | warp-mcp 37+/37+ PASS; warp-doctor 16+/16+ PASS; warp-workflow-lint 7/7 PASS |
| 12 | Run live stdio probes for tools that gain redaction | _redactions_applied populated correctly when input contains trigger; no leakage of raw values |
| 13 | Verify READ-ONLY invariant via git status before/after | byte-identical |
| 14 | Atomic commit | feat(p72-01): MCP redaction + Warp config + setup docs |

## Redaction implementation pattern

```js
const REDACTION_CATEGORIES = Object.freeze([
  'env_secrets', 'bearer_tokens', 'redis_urls', 'api_keys_inline',
  'private_kb_paths', 'unc_paths', 'onedrive_paths'
]);

const REDACTION_RULES = {
  env_secrets: {
    pattern: /([A-Z_]+_(?:KEY|TOKEN|SECRET|PASSWORD|API_KEY))\s*=\s*\S+/g,
    replace: '$1=<REDACTED:env>'
  },
  bearer_tokens: {
    pattern: /Bearer\s+[A-Za-z0-9_.-]+/g,
    replace: 'Bearer <REDACTED:bearer>'
  },
  redis_urls: {
    pattern: /redis:\/\/[^@\s]+@([^/\s]+)/g,
    replace: 'redis://<REDACTED:creds>@$1'
  },
  api_keys_inline: {
    pattern: /\b(sk-[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16}|ghp_[A-Za-z0-9]{36})\b/g,
    replace: '<REDACTED:apikey>'
  },
  private_kb_paths: {
    pattern: /\.brv[\\/]private[\\/][^\s'"]+/g,
    replace: '<REDACTED:private_kb>'
  },
  unc_paths: {
    pattern: /\\\\[^\\\s]+\\[^\s'"]+/g,
    replace: '<REDACTED:unc>'
  },
  onedrive_paths: {
    pattern: /OneDrive - [A-Za-z0-9 .,_-]+/g,
    replace: '<REDACTED:onedrive_org>'
  }
};

function _applyRedactions(text) {
  if (typeof text !== 'string') return { redacted: text, applied: [] };
  let result = text;
  const applied = [];
  for (const cat of REDACTION_CATEGORIES) {
    const before = result;
    result = result.replace(REDACTION_RULES[cat].pattern, REDACTION_RULES[cat].replace);
    if (result !== before) applied.push(cat);
  }
  return { redacted: result, applied };
}
```

For nested objects, walk recursively; collect union of `applied` across
all string values.

## Wiring into tools

Modify the per-tool envelope finalizer:

```js
function _finalizeEnvelope(env) {
  // Recursively redact all string values in env.data
  const { redacted, applied } = _redactObject(env.data);
  return {
    ...env,
    data: redacted,
    _redactions_applied: applied
  };
}
```

Where `_redactObject(obj)` walks recursively, calling `_applyRedactions`
on every string value, accumulating applied categories.

Tools 5, 7, 8, 9, 10, 11, 12, 13, 14 call `_finalizeEnvelope(env)` before
return; tools 1, 2, 3, 4, 6 don't need redaction (their outputs are
SGSD-internal scalars with no user content).

Actually for v2.3 ship simplicity, run redaction on ALL 14 tools. Cost
is negligible (regex over <50KB strings); noise floor is zero (no
matches → no `_redactions_applied`); future-proofs against any tool
inadvertently leaking via path concatenation.

## Surgical Constraint

Touch redaction wiring + ERROR_CODES extension. Don't refactor existing
tool implementations. Don't add new public APIs. Don't introduce deps.

## Out of scope

- Write-capable controlled actions (v2.7 Phase 89+).
- ACP adapter (v2.8 Phase 94+).
