---
name: codex-exec-auth-denied-false-positive
description: codex-executor reports auth-denied whenever the PROMPT contains the substring "auth"; it greps stderr, and codex echoes the prompt there
metadata:
  type: error
---

# "codex-executor: auth-denied" usually is not an auth failure

`super-gsd/scripts/codex-executor.sh:374`:

```bash
if grep -qiE '(auth|401|unauthori[sz]ed)' "$STDERR_TMP" 2>/dev/null; then
```

Codex echoes the submitted prompt into stderr. So any prompt containing `auth`
as a SUBSTRING trips it: "authority", "authenticated", "author". Observed
2026-08-23 on P167 prompts containing "project-root authority".

The label is applied on a non-zero exit, so it does not cause the failure; it
MISREPORTS whatever the real failure was. That is worse than a harmless bug,
because the operator-facing conclusion becomes "credentials expired" and the
real cause goes uninvestigated.

**Before believing it, probe directly:**

```bash
echo "Reply with exactly: PROBE_OK" | codex exec --model gpt-5.6-sol \
  --sandbox read-only --skip-git-repo-check --cd . -
```

If that returns `PROBE_OK`, auth is fine and the label is noise. Also check
`$OPENAI_API_KEY` is unset, since the wrapper legitimately refuses (exit 4) when
it is set.

**Workaround until fixed:** avoid `auth*` words in dispatch prompts. **Real
fix:** match against codex's own error channel rather than the echoed prompt, or
anchor the pattern to actual auth-failure phrasing.

Related: [[codex-exec-set-e-silent-report-loss]].
