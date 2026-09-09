# 170-07 trial-readiness executor evidence

Status: IN_PROGRESS. No new publication, deployment, paid DEVCP worker attempt,
acceptance pass, phase close or complete weekly coverage is claimed.

## Coverage census

Static and live evidence:

- `.planning/analyses/2026-09-09-atlas-operational-coverage-census.md`
- `.planning/analyses/2026-09-09-devcp-atlas-live-coverage-observation.md`

Both conclude PARTIAL. The source has provider capture but no normalization
adapter for SGSD operation/gate/finding/repair evidence. Eight of thirteen gate
registry entries declare no evidence path; the registry does not enumerate all
runtime gates. Native Clarity events in the bounded 07:55Z snapshot had no
phase/plan/task/gate attribution. Legacy source corruption and separate global/
project-local capture require explicit provenance, not wholesale summation.

## Repair reproduction

- D1 isolated native-Linux RED: an expired prepared boundary still reached
  `old_stopped`; expected only `prepared`. Exit 1; 0 pass / 1 fail / 0 skip.
  Whole test duration 614.34 ms, **not** a measured restart-call duration.
  Fixture `/tmp/sgsd-170-07-red-d1-min-oWDF5m`.
- D2 isolated native-Linux RED: the actual offline wrapper added seven temporary
  project registrations and associated run/lifecycle/gap evidence to an enabled
  parent Atlas fixture. Exit 1, intended state-immutability failure. Fixture
  `/home/jackberrow/.cache/sgsd-native-verification/trial-d2-xN6GGl`.

These synthetic fixtures establish bugs, not provider usage or production trial
economics. GREEN/review/deployment evidence will be appended after verification.

Root independently reran both initial regressions from a new isolated native
copy: **2 pass / 0 fail / 0 skip**, 8.411 seconds, Node22.23.1. All four tested
source/test hashes were unchanged after execution. Evidence:
`/home/jackberrow/.cache/sgsd-native-verification/root-trial-focused-9f1VsZ/{result.json,focused.log}`.
This is an intermediate result, not final repair acceptance: root inspection
then identified a possible post-acquisition lock leak and deadline expiry inside
the whole-/proc port scan. Both need separate regression/review before freezing.

## Intermediate integration and specification review

The first five-file freeze had manifest SHA-256
`7efa53e289f42a1d7f943f73a396acee70b597dd13f7d5f4525d5be4b545d824`.
Root's isolated native-Linux integration at 08:27Z recorded worker 92/0/2,
Atlas 92/0/4, and board/routing 15/0/0 (pass/fail/skip). No candidate input
changed during tests. Evidence:
`/home/jackberrow/.cache/sgsd-native-verification/reviewed-V9Q7tO/evidence/`.
The propagation result was 56/10/2, not green: seven previously known
snapshot-helper digest failures plus three fixture failures caused by root's
inventory omitting `.codex/hooks.json` and `.gitattributes`. Final integration
must include those two real tracked inputs; the guards must not be changed.

Independent specification review returned **FAIL** with two Important findings:
the offline timeout child still inherited parent cwd and could append a second
metrics ledger not covered by the first test; handoff-journal fsync could cross
the deadline before startup-lock ownership transfer. Both require new RED/GREEN
regressions, complete parent metrics-tree checks and a new source freeze. The
README also needs the cooperative/blocking-OS-call deadline caveat. No quality
PASS, publication or deployment is inferred from the intermediate suite passes.

The two review findings were reproduced with separate RED fixtures under
`/tmp/sgsd-170-07-specfix-evidence-x41jQk/`: diagnostic RED added
`codex-timeout-observability.jsonl` to the parent metrics tree; handoff RED entered
the handoff boundary after expiry. Root independently read the saved failures
(UTF-16LE logs, not corrupt telemetry). Both focused regressions subsequently
passed; relative wrapper paths containing spaces are covered too.

Specification re-review: **PASS**, both Important findings closed. Two Minor
README clarifications distinguish parent-project metrics from fixture metrics
and synchronous operations from a single OS call. Quality review is pending.

Root's second integration completed 08:43:37Z, Node22.23.1, source freeze
`1b09d85468e96702530b7ea42d51764657980afe5a4c3fa57ed4ed92173c2c51`:

| Suite | Pass | Fail | Skip |
|---|---:|---:|---:|
| Six-file worker | 92 | 0 | 2 |
| Atlas | 93 | 0 | 4 |
| Board and model routing | 15 | 0 | 0 |
| Propagation | 59 | 7 | 2 |

Evidence: `/home/jackberrow/.cache/sgsd-native-verification/reviewed-wGy0eg/evidence/`.
3,628 candidate inputs were hash-verified, including the two previously omitted
root files; 72 Phase150 artifacts were indexed in the isolated native Git
fixture. No source or candidate input changed during the run. All seven
propagation failure names and the installer digest
`536cf8e46d738febac48a420c10580ca825b73effb60ea6084a9387b75a14ee2`
match the published baseline's `reviewed-YDDdda/evidence/propagation.log` exactly.
No snapshot guard was changed, bypassed or certified; no all-repository-green
claim is made. The ordinary updater contract tests passed in this battery.

Quality review subsequently returned **FAIL**: profile resolution runs before
the offline isolation boundary and can append fallback rows to an inherited
`SGSD_CODEX_PROFILE_LOG` or the source-root default metrics sink. The executor
self-test runs its own fake child, whose resolver inherits that sink too; it is
not a delegation to the review wrapper. Root independently traced both paths.
This requires a private diagnostic profile-log destination before resolution and
an unknown-profile/sentinel-ledger regression for both wrappers. The existing
plan already permits `codex-executor.sh` for a shared self-test leak. A Minor
test teardown catch also swallowed its own failed-termination assertion and must
be narrowed. Publication remains held; the earlier suite passes do not close
these newly identified branches. No new DEVCP worker attempts or deployment.

## Final reviewed repair candidate

The fallback-log RED contained ten appended `unknown_profile` rows in the
protected sentinel ledger (the initial implementer summary mistakenly said nine;
root decoded the preserved assertion payload). Evidence:
`/tmp/sgsd-170-07-profilefix-evidence-p8wT2L/`.
The strengthened isolation regression passes for both wrappers, custom profile
sinks, and corrupt/missing registries using the default source sink. The private
sink is selected before resolution; normal production fallback logging remains
unchanged. The cleanup assertion now propagates. Handoff fault-test setup has a
15-second allowance to reach the injection on DEVCP's large process inventory;
the controlled expiry and original 20 ms / <1000 ms real return test are retained.

Final six-file source manifest:
`9b5bc1479b7fb47c230d92813cb2e4069c9b06d9bcf05537d4ddad0432a9062e`.
Independent SPEC **PASS**, then QUALITY **PASS**, both with no remaining findings.
Root independently reran the complete integration on that exact frozen candidate:
worker **92/0/2**, Atlas **93/0/4**, board/routing **15/0/0**, propagation **59/7/2**.
The seven failure names still exactly match the published baseline. Final syntax
checks (three Node, two Bash) and `git diff --check` pass. Source and candidate
hashes stayed unchanged throughout verification.

Final integration evidence:
`/home/jackberrow/.cache/sgsd-native-verification/reviewed-rbSrhT/evidence/`.
3,628 verified inputs, 85 overlays, 72 indexed Phase150 artifacts; inventory SHA
`beee5c8699e1a41590c99f673d37e3175288720cadaab6382924ddbd5fba6cb6`.
Completion timestamp 09:00:07Z. Target loaded receiver fingerprint:
`c44b0ad3d77721f7b5e796db4112f5ec1112164b5956c6df0af4956760ce60bc`.
Publication, guarded update and the single fresh acceptance remain subsequent
steps; no deployment or weekly-trial readiness is inferred from this candidate.

## Local diagnostic deviation and recovery

An implementer invocation through PowerShell/WSL lost the quoting around a
space-containing Node test-name pattern. Node discovered a broader local test
set in the source worktree instead of only the requested regression. This run
is **not valid scoped verification**. The owned Windows WSL clients were stopped;
the implementer separately revalidated and gracefully stopped its identified
remaining fixture receiver. Other prior processes were left alone. No DEVCP test
or production deployment was involved. No real provider call is evident in the
available diagnostic evidence; that is not an exhaustive network audit.

Two previously clean tracked fixture files were regenerated by that run:
`super-gsd/tools/chronicle/fixtures/sample-sidecar-output.json` and
`super-gsd/tools/context-registry/legal-keys.json`. Root preserved their generated
bytes and hash manifest outside the repository, then restored only those known
task-generated changes via apply_patch. Scoped git diff verified both match HEAD.
No user untracked data was deleted; a transient test stderr file disappeared
during the test's own lifecycle and was not removed by root.

Recovery evidence:
`C:/Users/jack.berrow/AppData/Local/Temp/sgsd-fifo-diagnostic-1c91537ed4d3442b96a4c52867785307/broad-test-recovery-5o34UG/manifest.json`.

The implementer then accidentally reused the broad-run log pathname for valid
D1 RED output, so the original broad-run log was overwritten. Remaining evidence
is the tool/session transcript, scoped process observations and the preserved
generated files; a complete original log is **not** claimed. Subsequent fixtures
and logs must use unique, non-overwriting evidence paths and direct argv or stdin
execution. Source-worktree test execution is stopped; native-Linux immutable
baseline copies and task-owned overlays are used instead.

Root's subsequent bounded mtime audit found nine ignored local metrics ledgers
modified during the broad-test interval (08:01–08:03Z): chaos-restart,
codex-tool-events, failure-injection, intent-map, plan-errors, plan-lock-validation,
pro-mode-stoplight, redis-projection and scenario-suite logs. Git status alone
had not exposed these. Their original content remains untouched; complete private
copies and metadata/hash manifests were preserved at
`C:/Users/jack.berrow/AppData/Local/Temp/sgsd-fifo-diagnostic-1c91537ed4d3442b96a4c52867785307/local-test-ledger-observation-A85EJD/manifest.json`.
Timestamped test-period rows are candidates for diagnostic exclusion, but the
exact appended range is not asserted without a before snapshot. No whole-ledger
deletion, truncation or rewrite was used to hide this contamination. The local
WSL default global Atlas root was absent at 08:13Z.

An independent read-only audit checked the seven new local cockpit PID records
twice (08:16:00Z and 08:16:35Z). PIDs82726,82727,82728,82729,82732,82761,82762
were all absent; no shutdown was warranted. Those stale records are retained.
This is a bounded exact-PID check, not a claim that every historical local test
process was audited. DEVCP production evidence and prior benchmark directories
were not modified by these local checks.
