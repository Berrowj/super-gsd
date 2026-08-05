# Step 9.5 Per-Dispatch ATC — P145 TTYFIX diff (security-critical guard change)

Apply the ATC review (delete/simplify/anti-slop) + security review to the raw
diff below. Spec compliance already passed. Focus: is the new guard logic
correct, minimal, and free of new bypass channels? Consider: stdin/stdout TTY
detection edge cases on Windows (winpty/ConPTY/MSYS), whether refusal always
logs, whether the self-test additions are sound (fingerprint compare, env
cleanup on throw), and whether any residual override channel remains
(grep evidence: only remaining SGSD_CODEX_CONTROL_TTY_OK refs are inside the
new regression assertion).

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

## Context
- Guard now: `if (confirm === phrase && hasTty) return;` with
  hasTty = Boolean(process.stdin.isTTY && process.stdout.isTTY).
- Legit path: operator runs sgsd-codex-control.sh interactively; node inherits
  the real console TTY. Host self-tests all green; bypass probe refuses.

## Report contract (exact — all 5 lines mandatory)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <summary>
After the 5 required lines, emit one FINDINGS_DETAIL line per CRITICAL and
WARNING finding:
FINDINGS_DETAIL: [severity] [dimension] <description>
  severity: CRITICAL | WARNING | INFO
  dimension: naming | logic | security | performance | style | architecture
