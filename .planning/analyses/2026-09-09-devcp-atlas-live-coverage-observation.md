# DEVCP Atlas operational coverage — read-only observation

Observed: 2026-09-09T07:55:43Z. Source and current Clarity pin:
`935962c4413bf109af4a3c64a717f26dd0cc8fbd`; source clean. Receiver healthy,
fingerprint `1c4aadee1a71bd1038dc7c602f213a542aa1913bcfe83ddeb58d38092c7b65c0`.
Twelve existing panes were inventoried without restarting anything.

## Conclusion

**PARTIAL: native capture is operating; comprehensive SGSD operational and
weekly-economics coverage is not established.** A healthy receiver, schema fields
or an existing source ledger do not prove that gates/MUDA/ATC are ingested and
correlated. The installed audit returned WARN and `complete_coverage: false`.

Clarity's global canonical partition contained 178 complete rows: 3 lifecycle
and 175 Claude-native events. Types were coverage 3, handoff 1, api_request 24,
outcome 8 and tool 142. These are event-type counts, not successful billable
request totals. In particular a provider `outcome` is not SGSD gate acceptance.

There were 175 populated session IDs, 32 request IDs and 142 tool-use IDs.
**No row had milestone, phase, plan, task, gate or target-repository scope**, and
none had handoff, dispatch, gate-invocation, finding or repair IDs. Therefore
these events cannot yet answer how much an ATC/MUDA invocation cost, whether it
found a unique defect, or whether repair/rework reduced waste.

## Separate source evidence

The bounded read-only census found the following in Clarity's project-local
`.planning/metrics/`, not in the global Atlas semantic stream:

| Ledger | Complete parsed rows | Malformed complete lines |
| --- | ---: | ---: |
| muda-log.jsonl | 4 | 0 |
| codex-log.jsonl | 45 | 0 |
| codex-executor-log.jsonl | 181 | 89 |
| orchestrator-pulse.jsonl | 21 | 3 |
| codex-tool-events.jsonl | 2,019 | 0 |
| readiness-log.jsonl | 1 | 0 |

Activity-log and gate-evidence exceeded the 4 MiB per-file census limit and were
not parsed. They are **present but unscanned**, not absent. The collector bounded
total source reads to 64 MiB and explicitly records changing files and tails.
Its top-level identity-presence check is not a nested-schema validation.

The legacy project-local Atlas partitions contained another 2,544 parsed rows.
Those are a separate capture path; they must not be added to the global totals
without source-identity reconciliation. Historical source-ledger defects require
validated normalization/quarantine, never silent coercion into zero usage.

## Diagnostic exclusions and provenance

Preserve all canonical evidence. The seven `/tmp/tmp.IzIoC7ozEk/case-*` projects
from the prior unisolated offline self-test contain 14 lifecycle rows, not
provider usage. Two older synthetic benchmark projects are also registered;
they are deliberate benchmark traffic, not normal production workload. The
prior bare `global.cjs` diagnostic registration inside Clarity remains excluded
from workload comparisons by its recorded run identity, not by deleting rows.

The installed global audit does not certify unregistered projects or old
sessions. Per-user global installation is not proof that local shadows, other
pin-bearing trees, other users/containers, Windows or standalone CLIs capture.

## Evidence and reproduction

Local private evidence retained outside the repository:

- `C:/Users/jack.berrow/AppData/Local/Temp/sgsd-fifo-diagnostic-1c91537ed4d3442b96a4c52867785307/devcp-trial-coverage-readonly-1788940543892.json`
- Adjacent `devcp-trial-coverage-readonly.cjs`: exact one-use, read-only census.
- Adjacent `devcp-protection-snapshot-1788940543040.json`: source/install identity,
  protected file hashes, pane inventory and receiver health.

The census invokes the installed `audit.cjs` read-only API, then reads bounded
snapshots of registered canonical partitions and existing source ledgers. It
exports counts, permitted field presence and file hashes, not raw prompts,
responses, reasoning or credentials. It is a diagnostic, not a replacement gate
or a new telemetry pipeline. Re-running observes a new instant, not this snapshot.

See the separate source coverage census and original approved Atlas design for
the required correlation/reporting work. P171/P172 remain pending; this snapshot
does not start the frozen comparison baseline or justify savings claims.
