---
phase: "145"
slug: codex-profile-control
milestone: v3.5
status: PENDING
design_ref: ".planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md#p145"
---

# P145 Context — Codex Profile Registry + /sgsd-codex-control

## Goal

Codex dispatch configuration (sandbox, ephemeral, approval, model, effort)
moves from hardcoded literals in `codex-executor.sh:154-211` and
`codex-exec.sh:423,662` into `super-gsd/registry/codex-profiles.yaml`, with an
operator skill `/sgsd-codex-control` to inspect and change it.

## Profiles (from approved design)

- `executor`: workspace-write, non-ephemeral, full-auto, gpt-5.5/xhigh — used by codex-executor.sh
- `review`: read-only, ephemeral, gpt-5.5/xhigh — used by codex-exec.sh review/gate steps
- `triage`: read-only, **non-ephemeral**, gpt-5.5/xhigh — used by sgsd-triage Step 0.5 (P148 consumer)

## Constraints

- Wrapper refactor must be behaviour-preserving: with an untouched registry the
  emitted `codex exec` invocation is byte-identical to today's (AC-145a).
- `danger-full-access` and trust changes REQUIRE interactive confirmation; the
  skill hard-refuses without a TTY (AC-145c).
- Registry read must fail OPEN to today's defaults (missing/corrupt yaml →
  built-in fallback + loud log row), never brick dispatch.
- Respect codex-exec timeout-tier memory: explicit `--timeout` honoured
  (fixed 900bced); do not regress.
- Both Windows-cmd and native-Linux/WSL codex launch paths (CODEX_LAUNCHER) must
  resolve from the same registry.

## Acceptance criteria

AC-145 (a)(b)(c) from the design spec, plus: self-test asserts profile
resolution for all three profiles on both launcher paths.
