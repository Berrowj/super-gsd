FINDINGS: 0
CRITICAL: 0
WARNINGS: 0
PASS_RATE: 11/11
ONE_LINER: Recordless and invalid error results now fail before artifact writing, while legitimate failures and all status paths remain intact.
VERDICT: PASS
REQUIRED_CHANGES: none

The production-path write spy confirmed both invalid error cases throw without
invoking the artifact writer. A valid prepared record permits an honest
pre-emission failure and produces `api_error`; zero-hit and hit results remain
`empty_hit` and `success`. Only the API failure rendered the API Error section.

The new test reaches the intended acceptance seam with enrichment enabled, so it
does not pass for the wrong reason. All round-2 caller coverage, `ok:true`
enforcement, schemas, triage/bridge paths, and frozen P154 evidence are
unchanged from d63a6e6.

<!-- Reviewed commit e216712. Body salvaged from codex-live-output.txt after
     report truncation. 95,693 tokens. -->
