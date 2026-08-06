FINDINGS: 3
CRITICAL: 1
WARNINGS: 2
PASS_RATE: 2/5
ONE_LINER: Gate fail: guard path is structural, but codex-exec can report success without writing evidence.
FINDINGS_DETAIL: [CRITICAL] [validate] super-gsd/scripts/codex-exec.sh:831 swallows report write failure by returning 0 bytes, and super-gsd/scripts/codex-exec.sh:1097 proceeds to success/OK, violating the wrapper contract that exit 0 means report written.
FINDINGS_DETAIL: [WARN] [simplify] CLI defaults are duplicated across registry, resolver builtins, and shell fallback: super-gsd/registry/codex-profiles.yaml:122, super-gsd/tools/codex-pro/profile-resolver.cjs:75, super-gsd/scripts/lib/codex-profile-shell.sh:65. Shell fallback drift is not structurally tied to the registry.
FINDINGS_DETAIL: [WARN] [delete] Resolver exposes mutable trust/hook fields at super-gsd/tools/codex-pro/profile-resolver.cjs:63, but resolver output only exports model/reasoning/sandbox/ephemeral/approval at super-gsd/tools/codex-pro/profile-resolver.cjs:417, leaving guarded but operationally inert profile surface.
