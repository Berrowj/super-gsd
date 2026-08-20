# Clarity Control Plane (`clarity-cp`)

`clarity-cp` is the first, local safety plane for concurrent work on Project
Clarity ERP. It records worktree ownership leases, exposes split Git anchors,
tracks long-running jobs, and requires every deploy preflight to name a commit
that a fresh clone can actually receive. A successful preflight creates a
planned intent; it never builds or deploys anything.

Phase 1 prevents or makes visible the incidents that motivated it:

- **Two sessions shared one worktree:** a live lease now names the owning
  session, actor, PID, host, branch, and expiry. Write guards reject other
  sessions.
- **A deploy destroyed an 11-hour backfill twice:** registered jobs are
  intersected with the requested service blast radius before a deploy intent is
  accepted.
- **A stale ref rebuilt old code and printed `DEPLOY PASS`:** preflight requires
  the caller's expected SHA and reports a same-SHA no-op explicitly.
- **Ten deploy-checkout commits existed on no remote:** the SHA must be an
  ancestor of the configured trusted remote branch after a fetch.
- **Branches were invisible across two Git common directories:** `anchors` and
  `doctor` inspect every worktree independently and report foreign anchors.

## Requirements and invocation

The runtime is Python 3.10 and uses only the Python standard library. Run the
executable shim from this directory or put it on `PATH`:

```bash
control-plane/clarity-cp doctor
control-plane/clarity-cp status --json
```

Read-only commands do not create the state directory or database. The registry
is created lazily by the first successful mutating command.

## Commands

| Command | Purpose |
|---|---|
| `doctor [--json]` | Check canonical Git state, split anchors, deploy checkout and hooks, remotes, registry health, stale ownership/jobs, and SGSD script drift. |
| `anchors [--json]` | Report every immediate worktree under the configured base and its Git common directory. |
| `status [--json]` | List live and stale worktree leases. |
| `claim WORKTREE --session ID [--ttl SECONDS] [--takeover] [--actor NAME]` | Claim or explicitly take over a worktree; default TTL is 3600 seconds. |
| `release WORKTREE --session ID` | Release an owned worktree and remove its Git-admin manifest. |
| `heartbeat WORKTREE --session ID [--ttl SECONDS]` | Renew a live lease owned by the session. |
| `guard WORKTREE --session ID [--mode read\|write]` | Allow reads for any session; require the live owner for writes. |
| `jobs register --id ID --kind KIND [options]` | Register a long-running job, optional service, PID, checkpoint, and interruption cost. |
| `jobs list [--json]` | List jobs and mark running jobs stale after 30 minutes without changing their state. |
| `jobs finish --id ID [--state done\|failed]` | Mark a known job finished. |
| `deploy preflight --expected-sha SHA [--services "a b c"] [--allow-interrupt] [--json]` | Validate the expected remote-backed commit and service blast radius, then create a planned deploy intent. |

The default preflight services are `clarity-python-api`,
`clarity-api-background`, and `frontend`.

## Exit codes

| Code | Meaning |
|---:|---|
| `0` | OK |
| `1` | Usage or internal error |
| `2` | Referenced object does not exist, or `doctor` found an error |
| `3` | Ownership conflict, or commit is not on the trusted remote branch |
| `4` | Active jobs would be destroyed by the requested deploy |
| `5` | `doctor` completed with warnings and no errors |
| `6` | indeterminate: could not reach the trusted remote to verify provenance |

Commands supporting `--json` emit exactly one JSON object to standard output,
including on expected failures.

## Configuration

Values resolve in this order: environment variable, optional JSON config, then
default. The optional config file is
`$CLARITY_CP_STATE_DIR/config.json`; its keys are the setting names in the first
column.

| Setting / JSON key | Environment variable | Default |
|---|---|---|
| `canonical_repo` | `CLARITY_CP_CANONICAL_REPO` | `/opt/clarity/project-clarity-erp` |
| `deploy_checkout` | `CLARITY_CP_DEPLOY_CHECKOUT` | `/home/jackberrow/clarity-deploy` |
| `worktree_base` | `CLARITY_CP_WORKTREE_BASE` | `/home/jackberrow/.config/superpowers/worktrees/project-clarity-erp` |
| `trusted_remote` | `CLARITY_CP_TRUSTED_REMOTE` | `github` |
| `trusted_branch` | `CLARITY_CP_TRUSTED_BRANCH` | `main` |
| `state_dir` | `CLARITY_CP_STATE_DIR` | `$HOME/.local/state/clarity-control-plane` |
| `sgsd_deployed` | `CLARITY_CP_SGSD_DEPLOYED` | `/opt/clarity/super-gsd` |

The SQLite registry is `<state_dir>/state.db`. It uses WAL mode, foreign-key
enforcement, a five-second busy timeout, explicit transactions, and an
append-only audit-event table. The human-readable ownership mirror is
`<worktree git admin dir>/clarity-owner.json`, outside the worktree contents;
the registry remains authoritative.

## Deploy merge hook

Install the DLB-15 `pre-merge-commit` protection explicitly:

```bash
control-plane/install-deploy-hooks.sh --dry-run
control-plane/install-deploy-hooks.sh
```

The installer backs up an existing hook, copies the new hook, and makes it
executable. It is intentionally not run automatically. The hook blocks merge
commits made inside the deploy checkout unless `DEPLOY_OVERRIDE` is set.
Fast-forward merges create no commit and therefore do not invoke this hook.

## What this does NOT do yet

- No GitHub plane.
- No CI gates.
- No route-parity check.
- No capability sandboxing of executors.
- No automatic re-anchoring of the existing foreign worktrees.

It also does not deploy, kill processes, infer job completion, or modify,
move, prune, or delete worktrees.
