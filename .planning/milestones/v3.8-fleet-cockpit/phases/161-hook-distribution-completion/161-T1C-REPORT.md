FILES_CHANGED: `hook-registration-preflight.cjs`; P160 guard test. `install.sh` reviewed, no T1C delta.

VERIFICATION (static): Node syntax ×2; preflight-static, smoke-static, bundled-overlay-static; diff check — PASS.

DEVIATIONS: No safe contract-neutral `install.sh` hotspot found. No commit.

BLOCKERS: Sandbox denies Git Bash (EPERM); full timing and three integration cases require orchestrator verification.

ONE_LINER: Smoke now runs four-wide, Node-direct/Bash-for-shell, preserving timeouts and exact named failures; installer fixture timeout is 150s.
