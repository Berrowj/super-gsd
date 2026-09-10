---
schema_version: 1
plan: "170-11"
platform: linux-devcp
status: VERIFIED_ATC_PASS_AWAITING_DEPLOYMENT
checked_at: "2026-09-10T09:18:00Z"
baseline_revision: 94ce08146e39099e1d2110ba8550419180377850
windows: OPEN_REQUIRED
---

# Corrected Linux acceptance

The demonstrated hook and Fable-launcher defects have minimal fixes, native
regression coverage and independent SPEC approval. Registered FULL ATC now
passes with0 critical/0 warnings/100%; normal guarded publication/deployment
is pending at this checkpoint.
This report supersedes the flawed procedure's conclusions only where fresh
evidence below does so; earlier failed reports remain unchanged.

## Corrections and evidence

| Check | Observed result |
| --- | --- |
| Actual flat global hooks | Missing js-yaml/argparse closure and wrong validation root reproduced; fixed installer/loader. Real empty-home updater-layout test passes, including strict30 routes, adapted16 routes, source-local behavior and explicit absent-canonical failure. |
| Fable launch | General Claude preference was opus[1m], despite SGSD's Fable default. Linux greet/go now resolves the existing role selection and passes the model on actual direct Claude argv; supported overrides and rejection before side effects are tested. No preferences changed. |
| Astra | Earlier acceptance selected Codex0.144.3, which did not list Astra. Normal .local/bin/codex0.153.4 was already installed; its actual Architect/max turn now succeeds. No guessed model, model swap, upgrade or auth change. The original provider error was not retained, so its exact reason remains unknown. |
| Two-way bridge | Fresh Astra and Luna workers asked through sgsd_ask_orchestrator; challenge generated only after each pending question, held in supervisor memory until completion, exact owner/project/worker/request reply applied, transformed answer returned. Wrong owner/project and duplicate reply rejected. |
| Continuation | Astra kept its thread, opened a new turn/worker/run/attempt and recalled the previous answer without it being restated. Original report hash unchanged. |
| Native token capture | All5 native TokenUsageRecord responses from3 acceptance workers match canonical api_request identity, usage and payload hash. Zero missing, duplicate or cross-project matches. |
| MUDA and ATC | Fresh read-only rechecks pass original source bytes -> operational receipt -> canonical observation for real Clarity MUDA, an actual ATC review and its gate-value record. Real MUDA FAIL remains FAIL, not relabelled healthy. |
| Receiver efficiency | Actual global receiver2275022,61 samples/300.258 seconds:1.036% of one CPU core, peak RSS92,352,512 bytes (88.1MiB). No model calls by sampling. This is a bounded sample, not a long-term/no-backlog claim. |

Native suites: Atlas201/205, worker92/94, board8/8, model-routing3/3,
provenance18/18: **322 pass,0 fail,6 Node skips**, plus the Atlas runtime
suite's separately reported optional real-stack skip. Windows cases and optional
binary/real-stack probes are not claimed. T1 independent SPEC and T4 independent
SPEC both PASS. Existing routing/classifier self-tests additionally pass18/18
and25/25.

The final empty-home native install suite was rerun after the reference
correction:2/2 PASS. No production code changed after the combined suites.

## Registered FULL ATC history

The initial reviewer timed out at300 seconds after18 observed responses and
read-only source inspection. Its wrapper exit5 and timeout report remain intact.
A same-thread, no-tools continuation returned CRIT1 concerning incidental flat
board --describe loadability; that real block was recorded through the existing
review/gate writers. A native isolated fixture confirmed describe is read-only,
while flat wrapper, override routing config and profile resolver remain absent.
Independent SPEC found no supported dispatch expansion. The reference paragraph
was corrected to prohibit treating successful description as supported dispatch;
its stale missing-YAML statement failed the accuracy check before the edit and
the corrected reference passed afterward. Independent SPEC also passed the edit.

One focused same-thread adjudication returned FULL PASS,0 critical/0 warnings,
100%, explicitly withdrawing the prior finding. Both earlier failed/blocked
records remain unchanged; the new gate row is a separate actual invocation.
This was one retained review with bounded follow-ups, not a benchmark retry.

## Spend and data integrity

The three acceptance wrappers observed100,109 input +899 output =101,008
provider tokens across5 responses. Cache-read62,080 and reasoning495 are
subsets already included, not added again. These are observed usage, not a
billing/account-total assertion; the registered review and this development
session are separate spend.

Independent native reconciliation of the timed-out review matches18/18 responses:
1,260,422 input +6,928 output =1,267,350 tokens, including1,133,568 cache-read
tokens. Its verdict continuation matches1/1 response:126,771 input +1,972 output
=128,743 tokens, including125,824 cache-read tokens. These failed/review costs
are explicitly retained, not hidden behind the101,008-token acceptance total.
Adjudication usage is recorded separately in its final native addendum.

Two fresh workers reported native_usage_line_limit. Independent bounded source
inspection found only oversized non-usage world_state rows: all5 usage records
were present and exactly reconciled. The warning is retained, not suppressed.

The first Astra supervisor mistakenly read reply.id instead of reply.command_id
and initially wrote pass:false. The immutable original is preserved. A separate
addendum checks the actual persisted/applied command and exact identity, proves
the round trip passed, and records the harness error. No worker rerun was used
to replace that evidence.

The midpoint audit is WARN (65WARN,0FAIL across17 registered projects).
Historical unsupported/unsafe/malformed/absent-source records and provider
identity coverage remain explicit; operational backfill is still pending.
Selected exact reconciliation does not prove every historical request or every
possible SGSD action was captured. No billing-completeness claim.

## Deployment and remaining boundaries

Pre-update guard: all7 protected configuration/credential hashes,28 existing
tmux pane identities and53 inventoried project-pin paths unchanged during this
acceptance. Canonical DEVCP source is clean at the baseline revision.

Publication, normal sgsd-update, installed hashes, live Fable smoke and final
guard/audit are pending. No existing interactive session has been restarted.
Global deployment means this OS user's global runtime assets plus the chosen
Clarity project pin, not every old process, worktree pin or local shadow.

Researcher/Atlas remains correctly blocked pending an operator-approved exact
model ID. CEO/Contrarian are configured Fable; headless provider/Agent proof is
pending, distinct from a fresh interactive launcher session. Windows, longer
weekly observation and phase/milestone closure remain open.

## Evidence locations (private, content-free summaries)

DEVCP base:
`/home/jackberrow/.cache/sgsd-native-verification/overnight-capture-P2kULUxS/corrected-linux-D2p1vD/`

- correction-three-workers-native.json: SHA256 f46d4d4471cfcc92d2964c50a71ee2ea01271f60d1aa2679fddea352543986e9
- correction-astra-roundtrip-native.json: SHA256 ce583f9b51bfb48ebf8f793eeb55575fdb97ae1702095c26b07977a0858431f6
- astra-roundtrip.json (original unchanged), continuation-result.json, luna-result.json
- muda-recheck.json, atc-review-recheck.json, atc-gate-recheck.json
- test-atlas-combined.log, test-codex-worker-combined.log, test-board-dispatch-combined.log
- model-routing-contract.test.cjs.log, runtime-provenance.test.cjs.log
- guard-start.json, guard-pre-update.json, audit-midpoint.json
- T170-11-ATC-REPORT.txt (timeout), T170-11-ATC-FINISH-REPORT.txt (original CRIT)
- T170-11-ATC-EVIDENCE.json (block), T170-11-ATC-ADJUDICATE-REPORT.txt and -EVIDENCE.json (pass)
- correction-atc-timeout-native.json, correction-atc-finish-native.json, flat-board-scope-proof.json
- Receiver sample: sibling ../live-receiver-sample-TQJZVK/result.json

No prompts, challenge values, transcripts or credentials are copied into this
report. Native source bytes were inspected in place; only selected metadata,
hashes and token usage were reconciled.
