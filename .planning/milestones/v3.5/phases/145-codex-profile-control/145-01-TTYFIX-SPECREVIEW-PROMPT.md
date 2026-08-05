# Step 9.4 Spec-Compliance Review — P145 GAP-1 TTYFIX dispatch

You are the SDD spec reviewer. Judge ONLY plan conformance of the diff below:
missing requirements, extra/unrequested scope, and whether verification
evidence maps to the spec. Do not review style/quality (ATC does that next).
Do not trust the executor's summary; judge the raw diff.

## The spec (fix dispatch prompt)
1. assertCliMutationGuard: remove env-var trust AND dead options.ttyOk; guard
   passes only on confirm===phrase && real stdin+stdout TTY.
2. sgsd-codex-control.sh:108: remove SGSD_CODEX_CONTROL_TTY_OK=1 prefix.
3. selfTestCliGuard: drop env save/delete/restore; ADD regression assertion:
   env var set + correct phrase + no TTY → still refuse, registry unchanged.
4. Remove other references made dead. Touch nothing else.

## Raw diff (uncommitted)
diff --git a/super-gsd/scripts/sgsd-codex-control.sh b/super-gsd/scripts/sgsd-codex-control.sh
index 45d9763..2a38876 100644
--- a/super-gsd/scripts/sgsd-codex-control.sh
+++ b/super-gsd/scripts/sgsd-codex-control.sh
@@ -105,7 +105,7 @@ run_set() {
     local profile="$1" field="$2" value="$3"
     require_confirmation_if_guarded "$profile" "$field" "$value" || return $?
     if [[ -n "$SGSD_CODEX_CONTROL_CONFIRM_PHRASE" ]]; then
-        SGSD_CODEX_CONTROL_TTY_OK=1 node "$RESOLVER" --set-cli "$profile" "$field" "$value" --confirm "$SGSD_CODEX_CONTROL_CONFIRM_PHRASE" --registry "$REGISTRY_PATH"
+        node "$RESOLVER" --set-cli "$profile" "$field" "$value" --confirm "$SGSD_CODEX_CONTROL_CONFIRM_PHRASE" --registry "$REGISTRY_PATH"
     else
         node "$RESOLVER" --set-cli "$profile" "$field" "$value" --registry "$REGISTRY_PATH"
     fi
diff --git a/super-gsd/tools/codex-pro/profile-resolver.cjs b/super-gsd/tools/codex-pro/profile-resolver.cjs
index 2155a24..d4ad317 100644
--- a/super-gsd/tools/codex-pro/profile-resolver.cjs
+++ b/super-gsd/tools/codex-pro/profile-resolver.cjs
@@ -503,10 +503,9 @@ function assertCliMutationGuard(profileName, field, rawValue, coercedValue, regi
   if (!isDangerousCliMutation(field, coercedValue)) return;
   const phrase = confirmationPhrase(profileName, field, rawValue);
   const confirm = String(options.confirm || '');
-  const ttyOverride = options.ttyOk === true || process.env.SGSD_CODEX_CONTROL_TTY_OK === '1';
   const hasTty = Boolean(process.stdin.isTTY && process.stdout.isTTY);
   const reason = confirm !== phrase ? 'confirmation_required' : 'non_tty_guarded_mutation';
-  if (confirm === phrase && (ttyOverride || hasTty)) return;
+  if (confirm === phrase && hasTty) return;
 
   appendProfileResolutionLog({
     action: 'set-cli',
@@ -706,23 +705,44 @@ function selfTestCliGuard() {
   const fixture = makeTempRegistry();
   const before = fingerprintFile(fixture.registryPath);
   const previousLogPath = process.env.SGSD_CODEX_PROFILE_LOG;
-  const previousTtyOk = process.env.SGSD_CODEX_CONTROL_TTY_OK;
   let refusalMessage = '';
+  let envBypassMessage = '';
   process.env.SGSD_CODEX_PROFILE_LOG = fixture.logPath;
-  delete process.env.SGSD_CODEX_CONTROL_TTY_OK;
   try {
-    main(['--set-cli', 'triage', 'sandbox', 'danger-full-access', '--registry', fixture.registryPath]);
-  } catch (error) {
-    refusalMessage = error.message;
+    try {
+      main(['--set-cli', 'triage', 'sandbox', 'danger-full-access', '--registry', fixture.registryPath]);
+    } catch (error) {
+      refusalMessage = error.message;
+    }
+    const after = fingerprintFile(fixture.registryPath);
+    expect(refusalMessage.includes('CONFIRM SGSD CODEX PROFILE triage sandbox danger-full-access'), 'non-TTY resolver --set-cli danger-full-access must refuse with exact confirmation phrase');
+    expect(after === before, 'refused resolver danger mutation must not alter registry');
+
+    const envBypassBefore = fingerprintFile(fixture.registryPath);
+    process.env.SGSD_CODEX_CONTROL_TTY_OK = '1';
+    try {
+      main([
+        '--set-cli',
+        'triage',
+        'sandbox',
+        'danger-full-access',
+        '--confirm',
+        confirmationPhrase('triage', 'sandbox', 'danger-full-access'),
+        '--registry',
+        fixture.registryPath,
+      ]);
+    } catch (error) {
+      envBypassMessage = error.message;
+    } finally {
+      delete process.env.SGSD_CODEX_CONTROL_TTY_OK;
+    }
+    const envBypassAfter = fingerprintFile(fixture.registryPath);
+    expect(envBypassMessage.includes('CONFIRM SGSD CODEX PROFILE triage sandbox danger-full-access'), 'SGSD_CODEX_CONTROL_TTY_OK must not bypass non-TTY dangerous mutation guard');
+    expect(envBypassAfter === envBypassBefore, 'env-var bypass attempt must not alter registry');
   } finally {
     if (previousLogPath === undefined) delete process.env.SGSD_CODEX_PROFILE_LOG;
     else process.env.SGSD_CODEX_PROFILE_LOG = previousLogPath;
-    if (previousTtyOk === undefined) delete process.env.SGSD_CODEX_CONTROL_TTY_OK;
-    else process.env.SGSD_CODEX_CONTROL_TTY_OK = previousTtyOk;
   }
-  const after = fingerprintFile(fixture.registryPath);
-  expect(refusalMessage.includes('CONFIRM SGSD CODEX PROFILE triage sandbox danger-full-access'), 'non-TTY resolver --set-cli danger-full-access must refuse with exact confirmation phrase');
-  expect(after === before, 'refused resolver danger mutation must not alter registry');
 
   const safeResult = setCliProfileField('triage', 'ephemeral', 'true', { registryPath: fixture.registryPath, logPath: fixture.logPath });
   const updated = loadFullRegistry(fixture.registryPath);

## Executor report
STATUS: DONE_WITH_CONCERNS (concern = sandbox bash blocked; environment only)
FILES_CHANGED: profile-resolver.cjs, sgsd-codex-control.sh

## Host verification (orchestrator-run, 2026-08-06)
- node run-self-test.cjs → 21/21, exit 0
- sgsd-codex-control.sh --self-test → PASS, exit 0
- codex-executor.sh --self-test → parity PASS, exit 0
- codex-exec.sh --self-test --skip-network → Probes 1-6 PASS, exit 0
- Bypass probe: SGSD_CODEX_CONTROL_TTY_OK=1 + correct phrase + no TTY →
  exit 1, refusal message, registry byte-identical

## Check also
- grep says remaining SGSD_CODEX_CONTROL_TTY_OK references exist only inside
  selfTestCliGuard's new regression assertion (set + delete around probe).
  Verify that claim against the diff.

## Report contract (exact)
SPEC_VERDICT: pass|fix_required|blocked
MISSING_REQUIREMENTS: none|<list>
EXTRA_SCOPE: none|<list>
VERIFICATION_MAPPING: <evidence → criterion>
ONE_LINER: <summary>
