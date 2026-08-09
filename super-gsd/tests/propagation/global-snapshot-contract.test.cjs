#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "../../..");
const helper = path.join(root, "super-gsd", "scripts", "sgsd-global-snapshot.sh");
const installer = path.join(root, "super-gsd", "install.sh");
const expectedTargets = Object.freeze([
  ".claude/agents",
  ".claude/commands",
  ".claude/hooks",
  ".claude/settings.json",
  ".claude/get-shit-done/templates/super-gsd",
  ".claude/get-shit-done/workflows",
  ".claude/get-shit-done/config/model-routing.json",
  ".claude/super-gsd/scripts",
  ".local/bin/sgsd",
]);

function text(filePath) {
  assert.equal(fs.existsSync(filePath), true, `required artifact is missing: ${path.relative(root, filePath)}`);
  return fs.readFileSync(filePath, "utf8");
}

function bashAvailability() {
  for (const name of process.platform === "win32" ? ["bash.exe", "bash"] : ["bash"]) {
    const result = spawnSync(name, ["-lc", "printf SGSD_BASH_READY"], { encoding: "utf8" });
    if (result.status === 0 && result.stdout === "SGSD_BASH_READY") return name;
  }
  return null;
}

function sha(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function manifest(home) {
  const rows = [];
  function walk(fullPath, relativePath) {
    const stat = fs.lstatSync(fullPath);
    const type = stat.isSymbolicLink() ? "symlink" : stat.isDirectory() ? "directory" : "file";
    rows.push({
      path: relativePath.replaceAll(path.sep, "/"), type, mode: stat.mode & 0o7777,
      link: type === "symlink" ? fs.readlinkSync(fullPath) : null,
      sha256: type === "file" ? sha(fullPath) : null,
    });
    if (type === "directory") {
      for (const name of fs.readdirSync(fullPath).sort()) walk(path.join(fullPath, name), path.join(relativePath, name));
    }
  }
  for (const target of expectedTargets) {
    const fullPath = path.join(home, ...target.split("/"));
    try { walk(fullPath, target); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      rows.push({ path: target, type: "absent", mode: null, link: null, sha256: null });
    }
  }
  return rows;
}

function write(filePath, contents, mode = 0o644) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
  fs.chmodSync(filePath, mode);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: "utf8", ...options });
}

test("snapshot helper owns and checks the exact current install-global target list", () => {
  const installText = text(installer);
  const helperText = text(helper);
  for (const target of expectedTargets) {
    assert.match(helperText, new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `helper target missing: ${target}`);
  }
  assert.match(helperText, /contract mismatch/i);
  assert.match(helperText, /install\.sh/);
  assert.match(helperText, /create.*verify.*restore/s);
  for (const evidence of [
    /AGENTS_DIR="\$CLAUDE_DIR\/agents"/, /COMMANDS_DIR="\$CLAUDE_DIR\/commands"/,
    /HOOKS_DIR="\$CLAUDE_DIR\/hooks"/, /SETTINGS_FILE="\$CLAUDE_DIR\/settings\.json"/,
    /TEMPLATES_DIR="\$GSD_DIR\/templates\/super-gsd"/, /"\$GSD_DIR\/workflows/,
    /"\$GSD_DIR\/config\/model-routing\.json"/, /GLOBAL_SCRIPTS_DIR="\$CLAUDE_DIR\/super-gsd\/scripts"/,
    /"\$LOCAL_BIN_DIR\/sgsd"/,
  ]) assert.match(installText, evidence);
});

test("snapshot helper has bounded validation and non-destructive restore guards", () => {
  const source = text(helper);
  for (const token of [
    "--home", "--output-dir", "--snapshot-dir", "--failed-candidate-dir",
    "manifest-before.jsonl", "manifest-after.jsonl", "archive.tar", "failed-candidate",
  ]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /readlink|realpath/);
  assert.match(source, /archive.*(?:exist|readable)|(?:exist|readable).*archive/is);
  assert.match(source, /unknown.*mutation|mutation.*unknown/is);
  assert.match(source, /get-shit-done.*(?:pre-existing|bootstrap)|(?:pre-existing|bootstrap).*get-shit-done/is);
  assert.match(source, /archive\.sha256/);
  assert.match(source, /archive.*membership|membership.*archive/is);
  assert.match(source, /pre-install.*subset|subset.*pre-install/is);
  assert.match(source, /extra.*byte|byte.*extra/is);
  assert.doesNotMatch(source, /rm\s+-rf\s+['"]?\$(?:HOME|home)/);
});

test("snapshot round trip preserves exact pre-install manifest and quarantines candidate", { timeout: 120_000 }, (t) => {
  const bash = bashAvailability();
  if (!bash) return t.skip("bash is unavailable or blocked by the managed runner");
  text(helper);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sgsd-snapshot-contract-"));
  const home = path.join(temp, "home");
  const snapshot = path.join(temp, "reconciliation");
  const failed = path.join(temp, "failed-candidate");
  fs.mkdirSync(home, { recursive: true });
  const fixtures = {
    ".claude/agents/custom-agent.md": "legacy agent\n",
    ".claude/commands/custom-command/SKILL.md": "custom command\n",
    ".claude/hooks/custom-hook.js": "custom hook\n",
    ".claude/settings.json": "{\"custom\":true}\n",
    ".claude/get-shit-done/templates/super-gsd/custom-template.md": "custom template\n",
    ".claude/get-shit-done/workflows/custom-workflow.md": "custom workflow\n",
    ".claude/get-shit-done/config/model-routing.json": "{\"model\":\"legacy\"}\n",
    ".claude/super-gsd/scripts/custom-extra.sh": "#!/bin/sh\necho extra\n",
    ".claude/super-gsd/scripts/lib/custom-extra.cjs": "module.exports = 43;\n",
    ".local/bin/sgsd": "#!/bin/sh\necho legacy\n",
    ".claude/commands/sgsd-brv-setup/legacy.txt": "legacy BRV command\n",
    ".claude/hooks/brv-query-local.js": "legacy BRV hook\n",
    ".claude/hooks/brv-curate-local.js": "legacy BRV hook 2\n",
    ".claude/get-shit-done/templates/super-gsd/brv-seed/seed.txt": "legacy BRV seed\n",
    ".claude/get-shit-done/templates/super-gsd/executor-brv-overlay.xml": "legacy\n",
    ".claude/get-shit-done/templates/super-gsd/planner-brv-overlay.xml": "legacy\n",
    ".claude/get-shit-done/templates/super-gsd/verifier-brv-overlay.xml": "legacy\n",
    ".claude/get-shit-done/templates/super-gsd/overwatcher/brv-query-local.js": "legacy\n",
    ".claude/get-shit-done/templates/super-gsd/overwatcher/brv-curate-local.js": "legacy\n",
  };
  for (const [relative, contents] of Object.entries(fixtures)) {
    write(path.join(home, ...relative.split("/")), contents,
      relative.endsWith(".sh") || relative === ".local/bin/sgsd" ? 0o755 : 0o640);
  }
  write(path.join(home, ".claude/super-gsd/source/super-gsd/scripts/canonical.sh"), "#!/bin/sh\n", 0o755);
  write(path.join(home, ".claude/super-gsd/scripts/canonical.sh"), "#!/bin/sh\n", 0o755);
  let symlinkFixtureCreated = true;
  try {
    fs.symlinkSync("custom-extra.sh", path.join(home, ".claude/super-gsd/scripts/custom-link"));
  } catch (error) {
    if (error.code !== "EPERM") throw error;
    symlinkFixtureCreated = false;
    t.diagnostic("symlink-specific assertions skipped: host does not permit symlink creation");
  }

  const before = manifest(home);
  if (symlinkFixtureCreated) {
    const beforeLink = before.find((row) => row.path === ".claude/super-gsd/scripts/custom-link");
    assert.deepEqual(
      { type: beforeLink?.type, link: beforeLink?.link },
      { type: "symlink", link: "custom-extra.sh" },
      "capable hosts must retain symlink coverage",
    );
  }
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const created = run(bash, [helper, "create", "--home", home, "--output-dir", snapshot], { env });
  assert.equal(created.status, 0, `create failed\nstdout=${created.stdout}\nstderr=${created.stderr}`);
  const installed = run(bash, [installer, "--install-global"], { cwd: root, env });
  assert.equal(installed.status, 0, `actual installer failed\nstdout=${installed.stdout}\nstderr=${installed.stderr}`);
  const verified = run(bash, [helper, "verify", "--home", home, "--snapshot-dir", snapshot], { env });
  assert.equal(verified.status, 0, `verify failed\nstdout=${verified.stdout}\nstderr=${verified.stderr}`);

  fs.unlinkSync(path.join(home, ".claude/super-gsd/scripts/custom-extra.sh"));
  const missingExtra = run(bash, [helper, "verify", "--home", home, "--snapshot-dir", snapshot], { env });
  assert.notEqual(missingExtra.status, 0, "verify must reject a silently lost pre-install scripts extra");
  for (const target of expectedTargets) {
    const full = path.join(home, ...target.split("/"));
    if (fs.existsSync(full) && fs.lstatSync(full).isDirectory()) write(path.join(full, "candidate-added.txt"), `candidate ${target}\n`);
    else write(full, `candidate ${target}\n`, 0o600);
  }
  const restored = run(bash, [helper, "restore", "--home", home, "--snapshot-dir", snapshot, "--failed-candidate-dir", failed], { env });
  assert.equal(restored.status, 0, `restore failed\nstdout=${restored.stdout}\nstderr=${restored.stderr}`);
  const restoredManifest = manifest(home);
  assert.deepEqual(restoredManifest, before, "restore must reproduce exact pre-install type/path/mode/link/SHA");
  if (symlinkFixtureCreated) {
    const restoredLink = restoredManifest.find((row) => row.path === ".claude/super-gsd/scripts/custom-link");
    assert.deepEqual(
      { type: restoredLink?.type, link: restoredLink?.link },
      { type: "symlink", link: "custom-extra.sh" },
      "restore must preserve the symlink fixture on capable hosts",
    );
  }
  assert.equal(fs.existsSync(path.join(snapshot, "archive.tar")), true, "original archive must remain readable");
  assert.ok(fs.readdirSync(failed).length > 0, "failed candidate must remain readable and non-empty");
});

test("restore keeps a target that was absent before install absent", { timeout: 30_000 }, (t) => {
  const bash = bashAvailability();
  if (!bash) return t.skip("bash is unavailable or blocked by the managed runner");
  text(helper);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sgsd-snapshot-absent-"));
  const home = path.join(temp, "home");
  const snapshot = path.join(temp, "snapshot");
  const failed = path.join(temp, "failed");
  fs.mkdirSync(path.join(home, ".claude/get-shit-done"), { recursive: true });
  fs.mkdirSync(path.join(home, ".claude/super-gsd/source/super-gsd/scripts"), { recursive: true });
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  assert.equal(run(bash, [helper, "create", "--home", home, "--output-dir", snapshot], { env }).status, 0);
  write(path.join(home, ".local/bin/sgsd"), "candidate\n", 0o755);
  assert.equal(run(bash, [helper, "restore", "--home", home, "--snapshot-dir", snapshot, "--failed-candidate-dir", failed], { env }).status, 0);
  assert.equal(fs.existsSync(path.join(home, ".local/bin/sgsd")), false);
  assert.equal(fs.existsSync(path.join(failed, "targets/.local/bin/sgsd")), true);
});

test("unsafe homes and an installer contract mismatch fail closed", { timeout: 30_000 }, (t) => {
  const bash = bashAvailability();
  if (!bash) return t.skip("bash is unavailable or blocked by the managed runner");
  text(helper);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sgsd-snapshot-guards-"));
  const home = path.join(temp, "home");
  fs.mkdirSync(home, { recursive: true });
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  for (const unsafe of ["", "/", "~", path.join(temp, "other-home")]) {
    const outDir = path.join(temp, `out-${Math.random()}`);
    const result = run(bash, ["-c", `"$0" create --home '${unsafe}' --output-dir "$1"`, helper, outDir], { env });
    assert.notEqual(result.status, 0, `unsafe home must fail: ${JSON.stringify(unsafe)}`);
  }
  const fixtureRoot = path.join(temp, "fixture", "super-gsd");
  fs.mkdirSync(path.join(fixtureRoot, "scripts"), { recursive: true });
  fs.copyFileSync(helper, path.join(fixtureRoot, "scripts", "sgsd-global-snapshot.sh"));
  fs.writeFileSync(path.join(fixtureRoot, "install.sh"), fs.readFileSync(installer, "utf8").replaceAll("$LOCAL_BIN_DIR/sgsd", "$LOCAL_BIN_DIR/renamed"));
  const mismatch = run(bash, [path.join(fixtureRoot, "scripts", "sgsd-global-snapshot.sh"), "create", "--home", home, "--output-dir", path.join(temp, "mismatch")], { env });
  assert.notEqual(mismatch.status, 0, "helper must fail when install.sh mutation targets differ");
  assert.match(`${mismatch.stdout}\n${mismatch.stderr}`, /contract mismatch/i);
});

test("unknown installer mutation targets fail the snapshot contract", { timeout: 30_000 }, (t) => {
  const bash = bashAvailability();
  if (!bash) return t.skip("bash is unavailable or blocked by the managed runner");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sgsd-snapshot-unknown-target-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const fixtureRoot = path.join(temp, "fixture", "super-gsd");
  const fixtureHelper = path.join(fixtureRoot, "scripts", "sgsd-global-snapshot.sh");
  const fixtureInstaller = path.join(fixtureRoot, "install.sh");
  const home = path.join(temp, "home");
  fs.mkdirSync(path.join(home, ".claude", "get-shit-done"), { recursive: true });
  write(fixtureHelper, text(helper), 0o755);
  const originalInstaller = text(installer);
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const mutationLines = [
    'copy_file "$SCRIPT_DIR/AGENTS.md" "/tmp/unknown-global-target"',
    'chmod +x "$GLOBAL_SCRIPTS_DIR/sgsd" /tmp/unknown-global-target',
    'if touch /tmp/unknown-global-target; then :; fi',
    'if [ -e <(touch /tmp/unknown-global-target) ]; then\n    echo ""\n  fi',
    'if [ -e "$GSD_DIR" ] > /tmp/unknown-global-target; then\n    echo ""\n  fi',
  ];
  for (const [index, mutationLine] of mutationLines.entries()) {
    const outputDir = path.join(temp, `snapshot-${index}`);
    const changedInstaller = originalInstaller.replace(
      '  log "Global install complete. Launcher installed at $LOCAL_BIN_DIR/sgsd."',
      [`  ${mutationLine}`, '  log "Global install complete. Launcher installed at $LOCAL_BIN_DIR/sgsd."'].join("\n"),
    );
    assert.notEqual(changedInstaller, originalInstaller, "fixture must add an unknown mutation target");
    write(fixtureInstaller, changedInstaller, 0o755);

    const result = run(bash, [fixtureHelper, "create", "--home", home, "--output-dir", outputDir], { env });

    assert.notEqual(result.status, 0, `unknown mutation must fail closed: ${mutationLine}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /contract mismatch.*unknown.*mutation|unknown.*mutation.*contract mismatch/is);
    assert.equal(fs.existsSync(outputDir), false, "contract rejection must precede snapshot creation");
  }
});

test("create fails closed before bootstrap when get-shit-done is absent", { timeout: 30_000 }, (t) => {
  const bash = bashAvailability();
  if (!bash) return t.skip("bash is unavailable or blocked by the managed runner");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sgsd-snapshot-bootstrap-guard-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, "home");
  const outputDir = path.join(temp, "snapshot");
  fs.mkdirSync(home, { recursive: true });
  const env = { ...process.env, HOME: home, USERPROFILE: home };

  const result = run(bash, [helper, "create", "--home", home, "--output-dir", outputDir], { env });

  assert.notEqual(result.status, 0, "create must not permit the external get-shit-done bootstrap boundary");
  assert.match(`${result.stdout}\n${result.stderr}`, /get-shit-done.*(?:pre-existing|bootstrap)|(?:pre-existing|bootstrap).*get-shit-done/is);
  assert.equal(fs.existsSync(outputDir), false, "bootstrap guard must precede snapshot creation");
});

test("restore rejects a symlinked failed-candidate directory before live-target mutation", { timeout: 30_000 }, (t) => {
  const bash = bashAvailability();
  if (!bash) return t.skip("bash is unavailable or blocked by the managed runner");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sgsd-snapshot-symlink-guard-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, "home");
  const snapshot = path.join(temp, "snapshot");
  const liveScripts = path.join(home, ".claude", "super-gsd", "scripts");
  const failedLink = path.join(temp, "failed-link");
  fs.mkdirSync(path.join(home, ".claude", "get-shit-done"), { recursive: true });
  fs.mkdirSync(liveScripts, { recursive: true });
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const created = run(bash, [helper, "create", "--home", home, "--output-dir", snapshot], { env });
  assert.equal(created.status, 0, `create failed\nstdout=${created.stdout}\nstderr=${created.stderr}`);
  try {
    fs.symlinkSync(liveScripts, failedLink, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (error.code === "EPERM") return t.skip("host does not permit the symlink fixture");
    throw error;
  }

  const result = run(bash, [helper, "restore", "--home", home, "--snapshot-dir", snapshot,
    "--failed-candidate-dir", failedLink], { env });

  assert.notEqual(result.status, 0, "resolved failed-candidate path inside a live target must fail closed");
  assert.deepEqual(fs.readdirSync(liveScripts), [], "rejection must happen before creating quarantine paths in the live target");
});

test("restore rejects an archive with out-of-bound membership before extraction", { timeout: 30_000 }, (t) => {
  const bash = bashAvailability();
  if (!bash) return t.skip("bash is unavailable or blocked by the managed runner");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sgsd-snapshot-tampered-archive-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, "home");
  const snapshot = path.join(temp, "snapshot");
  const failed = path.join(temp, "failed");
  const payload = path.join(temp, "payload");
  fs.mkdirSync(path.join(home, ".claude", "get-shit-done"), { recursive: true });
  write(path.join(home, ".claude", "agents", "original.md"), "original\n");
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const created = run(bash, [helper, "create", "--home", home, "--output-dir", snapshot], { env });
  assert.equal(created.status, 0, `create failed\nstdout=${created.stdout}\nstderr=${created.stderr}`);
  write(path.join(payload, "payload.txt"), "must not escape snapshot targets\n");
  const archive = path.join(snapshot, "archive.tar");
  const tampered = run(bash, ["-c",
    'tar --force-local -rf "$1" -C "$2" --transform="s#^payload.txt\\$#.ssh/authorized_keys#" -- payload.txt',
    "sgsd-tamper", archive, payload], { env });
  assert.equal(tampered.status, 0, `could not build tampered archive fixture\nstdout=${tampered.stdout}\nstderr=${tampered.stderr}`);
  write(path.join(snapshot, "archive.sha256"), `${sha(archive)}  archive.tar\n`);

  const result = run(bash, [helper, "restore", "--home", home, "--snapshot-dir", snapshot,
    "--failed-candidate-dir", failed], { env });

  assert.notEqual(result.status, 0, "tampered archive must fail closed");
  assert.match(`${result.stdout}\n${result.stderr}`, /archive membership|outside the snapshot target prefixes/i,
    "fixture must reach membership validation after its digest is refreshed");
  assert.equal(fs.existsSync(path.join(home, ".ssh", "authorized_keys")), false,
    "archive validation must precede extraction into home");
});
