from __future__ import annotations

import json
import os
import sqlite3
import subprocess
from pathlib import Path

from clarity_cp.__main__ import main
from clarity_cp.config import load_config
from clarity_cp.gitutil import admin_dir, common_dir
from clarity_cp.registry import Registry

from conftest import CONTROL_PLANE, add_commit, add_trusted_remote, make_repo, run_git


def call_cli(capsys, *args: str) -> tuple[int, str, str]:
    exit_code = main(list(args))
    captured = capsys.readouterr()
    return exit_code, captured.out, captured.err


def make_trusted_canonical(paths: dict[str, Path]) -> str:
    sha = make_repo(paths["canonical"])
    add_trusted_remote(paths["canonical"], paths["canonical"].parent / "github.git")
    return sha


def test_claim_succeeds_and_writes_registry_and_manifest(isolated_clarity_config, capsys):
    repo = isolated_clarity_config["canonical"]
    make_repo(repo)

    exit_code, output, _ = call_cli(capsys, "claim", str(repo), "--session", "alpha", "--actor", "alice")

    assert exit_code == 0
    assert "CLAIMED" in output and "session" not in output.lower()
    db = sqlite3.connect(isolated_clarity_config["state"] / "state.db")
    db.row_factory = sqlite3.Row
    row = db.execute("SELECT * FROM worktree_lease").fetchone()
    assert row["owner_session"] == "alpha"
    assert row["owner_actor"] == "alice"
    manifest = admin_dir(repo) / "clarity-owner.json"
    data = json.loads(manifest.read_text(encoding="utf-8"))
    assert data["worktree"] == str(repo.resolve())
    assert data["session"] == "alpha"
    assert data["lease_token"] == row["lease_token"]


def test_second_session_claim_on_live_lease_is_refused_with_exit_3(isolated_clarity_config, capsys):
    repo = isolated_clarity_config["canonical"]
    make_repo(repo)
    assert call_cli(capsys, "claim", str(repo), "--session", "alpha")[0] == 0

    exit_code, output, _ = call_cli(capsys, "claim", str(repo), "--session", "beta")

    assert exit_code == 3
    assert "owned by session alpha" in output
    with sqlite3.connect(isolated_clarity_config["state"] / "state.db") as db:
        assert db.execute("SELECT owner_session FROM worktree_lease").fetchone()[0] == "alpha"
        assert db.execute("SELECT COUNT(*) FROM event").fetchone()[0] == 1


def test_guard_refuses_non_owner_write_but_allows_read(isolated_clarity_config, capsys):
    repo = isolated_clarity_config["canonical"]
    make_repo(repo)
    assert call_cli(capsys, "claim", str(repo), "--session", "alpha")[0] == 0

    write_exit, write_output, _ = call_cli(
        capsys, "guard", str(repo), "--session", "beta", "--mode", "write"
    )
    read_exit, read_output, _ = call_cli(
        capsys, "guard", str(repo), "--session", "beta", "--mode", "read"
    )

    assert write_exit == 3
    assert "owned by session alpha" in write_output
    assert read_exit == 0
    assert "ALLOW read" in read_output


def test_takeover_rotates_token_and_names_both_owners_in_event(isolated_clarity_config, capsys):
    repo = isolated_clarity_config["canonical"]
    make_repo(repo)
    assert call_cli(
        capsys, "claim", str(repo), "--session", "alpha", "--actor", "alice"
    )[0] == 0
    db_path = isolated_clarity_config["state"] / "state.db"
    with sqlite3.connect(db_path) as db:
        first_token = db.execute("SELECT lease_token FROM worktree_lease").fetchone()[0]

    exit_code, output, _ = call_cli(
        capsys,
        "claim",
        str(repo),
        "--session",
        "beta",
        "--actor",
        "bob",
        "--takeover",
    )

    assert exit_code == 0 and "CLAIMED" in output
    with sqlite3.connect(db_path) as db:
        db.row_factory = sqlite3.Row
        row = db.execute("SELECT * FROM worktree_lease").fetchone()
        event = db.execute("SELECT * FROM event WHERE kind='lease_takeover'").fetchone()
    assert row["owner_session"] == "beta"
    assert row["lease_token"] != first_token
    detail = json.loads(event["detail"])
    assert detail["previous_owner"] == "alpha"
    assert detail["previous_actor"] == "alice"
    assert detail["new_owner"] == "beta"
    assert detail["new_actor"] == "bob"
    assert "previous_pid" in detail


def test_expired_lease_is_stale_and_does_not_block_new_claim(isolated_clarity_config, capsys):
    repo = isolated_clarity_config["canonical"]
    make_repo(repo)
    assert call_cli(capsys, "claim", str(repo), "--session", "alpha")[0] == 0
    db_path = isolated_clarity_config["state"] / "state.db"
    with sqlite3.connect(db_path) as db:
        db.execute(
            "UPDATE worktree_lease SET expires_at='2000-01-01T00:00:00Z', heartbeat_at='2000-01-01T00:00:00Z'"
        )

    status_exit, status_output, _ = call_cli(capsys, "status", "--json")
    status = json.loads(status_output)
    claim_exit, claim_output, _ = call_cli(capsys, "claim", str(repo), "--session", "beta")

    assert status_exit == 0
    assert status["stale_count"] == 1
    assert status["leases"][0]["status"] == "stale"
    assert claim_exit == 0
    assert "beta" in claim_output


def test_release_clears_registry_lease_and_manifest(isolated_clarity_config, capsys):
    repo = isolated_clarity_config["canonical"]
    make_repo(repo)
    assert call_cli(capsys, "claim", str(repo), "--session", "alpha")[0] == 0
    manifest = admin_dir(repo) / "clarity-owner.json"
    assert manifest.is_file()

    exit_code, output, _ = call_cli(capsys, "release", str(repo), "--session", "alpha")

    assert exit_code == 0 and "RELEASED" in output
    assert not manifest.exists()
    with sqlite3.connect(isolated_clarity_config["state"] / "state.db") as db:
        assert db.execute("SELECT COUNT(*) FROM worktree_lease").fetchone()[0] == 0
        assert db.execute("SELECT kind FROM event ORDER BY id DESC LIMIT 1").fetchone()[0] == "lease_released"


def test_anchors_distinguishes_canonical_and_foreign_worktrees(isolated_clarity_config, capsys):
    canonical = isolated_clarity_config["canonical"]
    foreign = canonical.parent / "foreign"
    base = isolated_clarity_config["worktrees"]
    make_repo(canonical)
    make_repo(foreign)
    base.mkdir()
    canonical_wt = base / "canonical-wt"
    foreign_wt = base / "foreign-wt"
    run_git(canonical, "worktree", "add", "-b", "canonical-work", str(canonical_wt))
    run_git(foreign, "worktree", "add", "-b", "foreign-work", str(foreign_wt))

    exit_code, output, _ = call_cli(capsys, "anchors", "--json")
    result = json.loads(output)

    assert exit_code == 0
    by_name = {Path(row["path"]).name: row for row in result["worktrees"]}
    assert by_name["canonical-wt"]["anchored_canonically"] is True
    assert by_name["foreign-wt"]["anchored_canonically"] is False
    assert by_name["canonical-wt"]["common_dir"] == str(common_dir(canonical))
    assert result["split_brain_count"] == 1


def test_deploy_preflight_refuses_local_only_sha_with_exit_3(isolated_clarity_config, capsys):
    make_trusted_canonical(isolated_clarity_config)
    local_sha = add_commit(isolated_clarity_config["canonical"], "local.txt", "not pushed\n")

    exit_code, output, _ = call_cli(
        capsys, "deploy", "preflight", "--expected-sha", local_sha
    )

    assert exit_code == 3
    assert "exists only locally" in output
    assert "fresh clone would not receive it" in output
    assert not (isolated_clarity_config["state"] / "state.db").exists()


def test_deploy_preflight_accepts_trusted_sha_and_records_intent(isolated_clarity_config, capsys):
    trusted_sha = make_trusted_canonical(isolated_clarity_config)

    exit_code, output, _ = call_cli(
        capsys, "deploy", "preflight", "--expected-sha", trusted_sha
    )

    assert exit_code == 0
    assert f"PREFLIGHT PASS: {trusted_sha}" in output
    assert "intent_id=" in output and "state=planned" in output
    with sqlite3.connect(isolated_clarity_config["state"] / "state.db") as db:
        row = db.execute("SELECT expected_sha, state, services FROM deploy_intent").fetchone()
        event_count = db.execute("SELECT COUNT(*) FROM event").fetchone()[0]
    assert row[0] == trusted_sha and row[1] == "planned"
    assert json.loads(row[2]) == ["clarity-python-api", "clarity-api-background", "frontend"]
    assert event_count == 1


def test_deploy_preflight_refuses_running_target_job_and_names_cost(isolated_clarity_config, capsys):
    trusted_sha = make_trusted_canonical(isolated_clarity_config)
    assert call_cli(
        capsys,
        "jobs",
        "register",
        "--id",
        "backfill-11h",
        "--kind",
        "backfill",
        "--service",
        "clarity-python-api",
        "--interrupt-cost",
        "11 hours lost",
    )[0] == 0

    exit_code, output, _ = call_cli(
        capsys, "deploy", "preflight", "--expected-sha", trusted_sha
    )

    assert exit_code == 4
    assert "backfill-11h" in output
    assert "11 hours lost" in output
    assert "clarity-python-api" in output
    assert "would be destroyed" in output


def test_deploy_preflight_allow_interrupt_proceeds_and_records_event(isolated_clarity_config, capsys):
    trusted_sha = make_trusted_canonical(isolated_clarity_config)
    assert call_cli(
        capsys,
        "jobs",
        "register",
        "--id",
        "backfill-11h",
        "--kind",
        "backfill",
        "--service",
        "clarity-python-api",
        "--interrupt-cost",
        "11 hours lost",
    )[0] == 0

    exit_code, output, _ = call_cli(
        capsys,
        "deploy",
        "preflight",
        "--expected-sha",
        trusted_sha,
        "--allow-interrupt",
    )

    assert exit_code == 0
    assert "ALLOW-INTERRUPT" in output and "backfill-11h" in output
    with sqlite3.connect(isolated_clarity_config["state"] / "state.db") as db:
        row = db.execute(
            "SELECT kind, detail FROM event WHERE kind='deploy_preflight_interrupt_allowed'"
        ).fetchone()
        intent_count = db.execute("SELECT COUNT(*) FROM deploy_intent").fetchone()[0]
    assert row is not None and "backfill-11h" in row[1]
    assert intent_count == 1


def test_deploy_preflight_reports_noop_for_last_passing_sha(isolated_clarity_config, capsys):
    trusted_sha = make_trusted_canonical(isolated_clarity_config)
    log = isolated_clarity_config["deploy"] / ".planning/metrics/deploy-log.jsonl"
    log.parent.mkdir(parents=True)
    log.write_text(
        "not json\n"
        + json.dumps({"sha": "deadbeef", "result": "fail"})
        + "\n"
        + json.dumps({"sha": trusted_sha, "result": "pass"})
        + "\n",
        encoding="utf-8",
    )

    exit_code, output, _ = call_cli(
        capsys, "deploy", "preflight", "--expected-sha", trusted_sha
    )

    assert exit_code == 0
    assert f"NO-OP: {trusted_sha} is already the last successfully deployed commit" in output
    assert "PREFLIGHT PASS" in output


def test_jobs_list_marks_old_heartbeat_stale_without_finishing_job(isolated_clarity_config, capsys):
    assert call_cli(
        capsys,
        "jobs",
        "register",
        "--id",
        "old-job",
        "--kind",
        "backfill",
        "--service",
        "frontend",
    )[0] == 0
    db_path = isolated_clarity_config["state"] / "state.db"
    with sqlite3.connect(db_path) as db:
        db.execute("UPDATE job SET heartbeat_at='2000-01-01T00:00:00Z' WHERE job_id='old-job'")

    exit_code, output, _ = call_cli(capsys, "jobs", "list", "--json")
    result = json.loads(output)

    assert exit_code == 0
    assert result["stale_count"] == 1
    assert result["jobs"][0]["status"] == "stale"
    assert result["jobs"][0]["state"] == "running"
    with sqlite3.connect(db_path) as db:
        assert db.execute("SELECT state FROM job WHERE job_id='old-job'").fetchone()[0] == "running"


def test_registry_survives_two_interleaved_writers(isolated_clarity_config):
    config = load_config()
    with Registry(config) as first, Registry(config) as second:
        first.register_job(
            job_id="writer-one",
            kind="test",
            service=None,
            session="one",
            pid=None,
            resumable=False,
            checkpoint=None,
            interrupt_cost=None,
        )
        second.register_job(
            job_id="writer-two",
            kind="test",
            service=None,
            session="two",
            pid=None,
            resumable=False,
            checkpoint=None,
            interrupt_cost=None,
        )
        assert {row["job_id"] for row in first.jobs()} == {"writer-one", "writer-two"}
        assert first.db.execute("PRAGMA journal_mode").fetchone()[0].lower() == "wal"
        assert second.db.execute("PRAGMA busy_timeout").fetchone()[0] == 5000


def test_pre_merge_hook_blocks_noff_but_fast_forward_succeeds(isolated_clarity_config):
    repo = isolated_clarity_config["deploy"]
    make_repo(repo)
    environment = os.environ.copy()
    installer = subprocess.run(
        ["bash", str(CONTROL_PLANE / "install-deploy-hooks.sh")],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=environment,
        check=False,
    )
    assert installer.returncode == 0, installer.stderr
    hook = repo / ".git/hooks/pre-merge-commit"
    assert hook.is_file() and os.access(hook, os.X_OK)

    run_git(repo, "checkout", "-b", "feature")
    feature_sha = add_commit(repo, "feature.txt", "feature\n")
    run_git(repo, "checkout", "main")
    blocked = run_git(repo, "merge", "--no-ff", "feature", check=False, env=environment)
    if (repo / ".git/MERGE_HEAD").exists():
        run_git(repo, "merge", "--abort")
    fast_forward = run_git(repo, "merge", "--ff-only", "feature", check=False, env=environment)

    assert blocked.returncode != 0
    assert "BLOCKED by DLB-15" in blocked.stdout + blocked.stderr
    assert fast_forward.returncode == 0, fast_forward.stdout + fast_forward.stderr
    assert run_git(repo, "rev-parse", "HEAD").stdout.strip() == feature_sha


def test_doctor_json_is_parseable_and_nonzero_for_missing_hook(isolated_clarity_config, capsys, monkeypatch):
    deploy_repo = isolated_clarity_config["deploy"]
    make_repo(deploy_repo)
    add_trusted_remote(deploy_repo, deploy_repo.parent / "doctor-github.git")
    monkeypatch.setenv("CLARITY_CP_CANONICAL_REPO", str(deploy_repo))
    pre_commit = deploy_repo / ".git/hooks/pre-commit"
    pre_commit.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
    pre_commit.chmod(0o755)
    state_dir = isolated_clarity_config["state"]

    exit_code, output, error = call_cli(capsys, "doctor", "--json")
    result = json.loads(output)

    assert error == ""
    assert exit_code == 2
    assert result["exit_code"] == 2
    hooks = next(check for check in result["checks"] if check["name"] == "deploy_hooks")
    assert hooks["status"] == "error"
    assert "pre-merge-commit" in hooks["message"]
    assert not state_dir.exists(), "read-only doctor must not create the state directory"
