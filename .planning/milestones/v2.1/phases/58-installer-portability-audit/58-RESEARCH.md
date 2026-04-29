---
phase: 58
name: Installer Portability Audit
milestone: v2.1
type: research
synthesized_at: 2026-04-29
synthesis_rule: "compressed-phase research per dispatch rule #1"
---

# Phase 58 Research - Installer Portability Audit

## 1. Goal (verbatim ROADMAP-AGENT.md:716)

Read-only probes + clean-room install test (fresh dir, captures every step
that requires manual intervention).

Locked decision: 58=B.

## 2. Background - what already exists

`super-gsd/install.sh` is the canonical installer (444 lines). It walks 9
steps: agents, skills, hooks, templates, workflows, config, scripts (global
fallback), ByteRover (optional, with API-free seeding + Day-0 curate
smoke-test), project init (optional via --init-project), and autonomous
permissions (claude config set).

What is missing is two-fold:

1. A **read-only audit** that fingerprints the local environment BEFORE
   running install.sh, so the operator (or Phase 59 wizard) knows exactly
   which dependencies are present, missing, or optional. Today the
   installer fails late: it errors when `node` is too old, when `npm`
   isn't on PATH, when `bash` is absent on Windows-only setups, or when
   `claude config` writes silently fail. A pre-flight audit catches all
   of those upfront.

2. A **clean-room install simulation** that runs the install motions in
   a `mktemp -d` tmpdir and times each step, tagging it auto/prompt/skip/
   error. This produces a friction log: the canonical evidence the wizard
   owner needs to plan the Phase 59 onboarding flow.

Phase 58 inherits the closed-vocab + Lock-13 + ASCII-only patterns from
Phases 51-57 verbatim. Phase 58 introduces NO new startup system; the
audit is a fingerprint, not a launcher.

## 3. Probe specification (>=9 probes, locked)

| # | Probe                       | Source enum                | Mandatory? | Notes |
| - | --------------------------- | -------------------------- | ---------- | ----- |
| 1 | `node_version`              | present / missing          | YES (>=20) | Floor enforced by NODE_FLOOR_MAJOR |
| 2 | `npm`                       | present / missing          | YES        | Win .cmd shim resolved via candidates+`where` fallback |
| 3 | `git`                       | present / missing          | YES        | `git --version` |
| 4 | `bash`                      | present / missing / opt    | YES on POSIX, optional on Win | Git Bash counts |
| 5 | `powershell`                | present / optional         | optional   | pwsh OR powershell.exe |
| 6 | `redis_optional`            | present / optional         | optional   | `redis-cli ping` -> PONG |
| 7 | `docker_optional`           | present / optional         | optional   | for docker-compose.redis.yml |
| 8 | `codex_cli_optional`        | present / optional         | optional   | for codex-exec.sh |
| 9 | `claude_cli_optional`       | present / optional         | optional   | for autonomous permissions |
| 10| `better_sqlite3_optional`   | present / optional         | optional   | resolve-only; no `require()` to avoid native bindings |
| 11| `planning_dir_present`      | present / missing          | evidence   | `.planning/` exists already |
| 12| `super_gsd_tree_present`    | present / missing          | evidence   | `super-gsd/install.sh` anchor |

Probe shape (Lock 11 byte-equality on closed-vocab fields):
```
{ name, ok:bool, version:string|null, source:'present'|'missing'|'optional',
  note:<REASON_NOTES entry> }
```

REASON_NOTES (closed vocab, frozen):
- `present_version_captured`
- `present_no_version_command`
- `missing_command_not_found`
- `optional_not_installed`
- `optional_module_missing`
- `mandatory_floor_unmet`
- `read_only_filesystem_probe`
- `probe_internal_error_degraded`

## 4. Public API surface (4 APIs, mirrors Phase 55/57 conventions)

- `runAudit({planningDir?, projectRoot?})` -> `{ok, schema_version, ts,
  probes:[...], summary:{...}, exit_code}`
- `getProbe(name, opts?)` -> single-probe accessor
- `selfTest()` -> `{ok, results:[...]}` with 8-12 assertions
- `_internals` bag for cross-task composition

All Lock-13 wrapped: any internal failure returns a degraded sentinel,
never throws.

## 5. Clean-room walk specification (9 steps)

| # | Step                                           | Outcome enum | Why |
| - | ---------------------------------------------- | ------------ | --- |
| 1 | mirror super-gsd tree (rsync or cp -R)         | auto         | snapshot working tree state |
| 2 | scaffold empty .planning/ skeleton             | auto         | --init-project equivalent |
| 3 | run installer-audit probes                     | auto         | Phase 58 self-fingerprint |
| 4 | install.sh --dry-run --skip-brv                | auto         | parse + plan walk; no mutation |
| 5 | byterover login                                | prompt       | OAuth flow, real install only |
| 6 | claude login                                   | prompt       | OAuth flow, real install only |
| 7 | restart Claude Code                            | prompt       | manual operator step |
| 8 | copy CLAUDE-OVERLAY.md -> tmpdir/CLAUDE.md     | auto         | --init-project step |
| 9 | post-install audit (mandatory floor met)       | auto         | green-bar exit |

Outcome enum: `auto` | `prompt` | `error` | `skip`. Per-step duration_ms
captured via `date +%s%3N`.

## 6. READ-ONLY invariant (audit.cjs)

audit.cjs makes ZERO file mutations. The self-test enforces this with
assertion A8: it scans audit.cjs source (excluding pure comment lines)
for any of:
- `fs.writeFileSync`
- `fs.appendFileSync`
- `fs.unlinkSync`
- `fs.mkdirSync`
- `fs.rmSync`
- `fs.rmdirSync`

Any match fails the assertion. Tokens are assembled at runtime from
substrings so the assertion text itself does not self-trigger.

## 7. Lock invariants

- **Lock 4**: Phase 41-57 byte-untouched. audit.cjs and clean-room.sh do
  NOT require() any Phase 41-57 module. The only Phase-41-57 file
  modified is sgsd-complete-milestone.cjs, and that is a surgical
  extension (v2.1 routing branch ADDED BEFORE the existing v1.9/v2.0
  no-op fallthrough; v1.9 + v2.0 paths preserved byte-equality).
- **Lock 11**: byte-equality on SOURCE_VALUES (3 entries) and
  REASON_NOTES (8 entries) closed-vocab enums. No regex on tool names.
  No fuzzy version match.
- **Lock 13**: every probe + public API try/catch wrapped. spawnSync
  failure -> degraded sentinel. require.resolve() failure -> degraded
  sentinel. Missing path -> source=missing. Never throws upward.
- **READ-ONLY**: audit.cjs zero filesystem mutation. clean-room.sh
  filesystem mutations confined to mktemp tmpdir; rm -rf cleanup trap
  on EXIT/INT/TERM with signature-prefix safety check.
- **ASCII-only**: first_nonascii_idx === -1 across audit.cjs,
  run-self-test.cjs, clean-room.sh, sgsd-complete-milestone.cjs delta.

## 8. Acceptance bar (verbatim 58-CONTEXT.md)

- Audit reports >=9 dependency probes -> 12 shipped (>=9 met)
- Clean-room test runs end-to-end on a temp dir; captures every prompt
  / manual step -> 9 steps; 6 auto + 3 prompt
- INSTALLER-AUDIT.md includes both probe results and clean-room
  friction log -> shipped this phase

## 9. Recommendations for Phase 59 (wizard)

The friction log identifies 3 prompt-tagged steps (5/6/7). Phase 59 should
surface each as a discrete checkpoint:

- **Step 5** (byterover login): expose a `--skip-brv` shortcut prominently
  AND offer a one-line `brv login` sub-command in the wizard.
- **Step 6** (claude login): detect `claude` CLI absence (Phase 58 probe
  `claude_cli_optional`) and either skip permission setup or guide the
  operator to `claude config set --global autoApprove ...` with the
  exact string.
- **Step 7** (restart Claude Code): print a copy-pasteable banner with
  clear instructions; this is unavoidable (skill loader is at startup).

Phase 58's audit + clean-room are evidence-only; Phase 59 owns the wizard
that consumes that evidence.
